// Co-op freeplay in battle (spec §10): the moment the goal is cleared (banner, the clear banked and
// saved at once), the 16/15 crossing (glitch banner, edge flash), routine "WAVE 37 · 37/15" banners,
// milestones (50 / 100 / 150, the Matriarch at 200, the Eclipse Wyrm at 250), first boss pair and
// first titan, visiting chapters and their affix, HP surges, the countdown to the Matriarch, the
// Finish vote (mine + the ally's prompt) and preloading the next wave's enemy models.
//
// Every one-shot effect is keyed in the battle's payout ledger (rewards.js freeplayLedger), which
// lives on the co-op session: a resync remounts the battle and replays its events, and nothing
// here may show or pay twice. The HUD pill, the clear card and the scout are derived from state.
import { h, enemyDef } from './util.js';
import { store } from '../../core/store.js';
import { createRng, hashString } from '../../core/rng.js';
import { FAMILIES } from '../../data/enemies.js';
import { CHAPTERS } from '../../data/stages.js';
import { preloadEnemies } from '../../models/index.js';
import { freeplayLedger, bankFreeplayClear } from '../../online/coop/rewards.js';
import { AFFIX_TEXT } from './scout.js';

/** Absolute-wave milestone banners. */
const MILESTONES = {
  50: ['WAVE 50 — CROWN HUNT', 'Minibosses every 10 waves'],
  100: ['WAVE 100 — BOSS RUSH', 'The Grave Lych and the Iron Colossus join the hunt'],
  150: ['WAVE 150 — THE PEAKS TREMBLE', 'A boss and a miniboss every 10 waves'],
};
/** "Iron Colossus" → "Iron Colossi", "Grave Lych" → "Grave Lychs" */
const plural = (name) => (/us$/.test(name) ? name.replace(/us$/, 'i') : /s$/.test(name) ? name : `${name}s`);
const shortScreen = () => typeof window !== 'undefined' && window.innerHeight <= 500;

/** The enemy that took the most lives on the battle's last wave (what a run "fell to"), or null. */
export function fellTo(sim) {
  const per = new Map();
  for (const l of sim.stats?.leakLog || []) if (l.wave === sim.wave) per.set(l.enemyId, (per.get(l.enemyId) || 0) + l.lives);
  let best = null;
  for (const [id, lives] of per) if (!best || lives > best[1]) best = [id, lives];
  return best ? enemyDef(best[0]) : null;
}

/** Families a list of enemy ids belongs to (model families, for preloading). */
function familiesOf(ids) {
  const out = new Set();
  for (const id of ids) {
    const d = enemyDef(id);
    if (d) out.add(d.model?.base || d.family);
  }
  return [...out].filter(Boolean);
}

/**
 * @param {object} ctx battle context (controller.js): sim, feed, shell, layer, coop
 * @param {{ session: object, lockstep: object, homeFamilies: string[] }} o
 */
export function createFreeplayBattle(ctx, { session, lockstep: ls, homeFamilies = [] }) {
  const { sim } = ctx;
  const fp = sim.stage.freeplay;
  const G = sim.totalWaves;
  const ledger = freeplayLedger(session, ls.start.seed);
  const mySlot = ls.mySlot;
  const allyName = () => session.player(1 - mySlot)?.name || 'Your ally';
  /** true the first time `key` is seen in this battle (across remounts) */
  const once = (key) => {
    if (ledger.fx.has(key)) return false;
    ledger.fx.add(key);
    return true;
  };
  const announcedAtStart = new Set(); // bosses the waveStart banner already named (this mount)
  let pendingVote = null; // my Finish vote, queued but not applied yet
  let flashTimer = 0;

  // ---- the bank: the clear, saved the moment the goal is cleared ---------------------------------
  function bank() {
    if (ledger.bank || !(sim.wavesCleared >= G)) return;
    const result = sim.result();
    const rng = createRng(hashString(`${sim.stage.id}:${sim.difficulty}:${sim.seed}:fp-bank:${Date.now()}`));
    try {
      bankFreeplayClear(ledger, store.profile, result, rng);
    } catch (e) {
      console.error('[battle] freeplay bank failed', e);
      return;
    }
    store.commit('battle-result');
    store.saveNow?.();
    ctx.feed.push(`Clear rewards saved ✓ — drops for both`, 'good', { key: 'fp-bank', ms: 3600 });
  }

  // ---- the vote ----------------------------------------------------------------------------------
  const prompt = h('div.bt-vote-prompt', { 'data-testid': 'finish-prompt' });
  prompt.hidden = true;
  ctx.layer.append(prompt);
  const appliedVote = (slot) => !!ls.coop.endVotes?.()[slot];
  const afterGoal = () => sim.wavesCleared >= G && !ctx.ended;
  function myVote() {
    return pendingVote ?? appliedVote(mySlot);
  }
  function vote(v) {
    if (!afterGoal()) return;
    pendingVote = !!v;
    ls.queue('end', [!!v]);
    prompt.hidden = true;
    if (v && !ls.peers.values().next().value?.gone) ctx.feed.push(`Finish vote cast — the run ends once ${allyName()} agrees.`, 'info', { key: 'fp-vote', ms: 2600 });
  }
  function showPrompt() {
    prompt.replaceChildren(
      h('span', h('b', allyName()), ' wants to finish here'),
      h('button.bt-vote-yes', { 'data-testid': 'finish-agree', onclick: () => vote(true) }, 'Finish'),
      h('button.bt-vote-no', { onclick: () => { prompt.hidden = true; } }, 'Keep going'),
    );
    prompt.hidden = false;
  }
  /** A lockstep command ran (mine or my ally's). */
  function onApplied(cmd, res) {
    if (cmd.k !== 'end') return;
    if (cmd.p === mySlot) {
      pendingVote = null;
      return;
    }
    if (!res.ok) return;
    if (cmd.a[0] && !myVote() && !ctx.ended) showPrompt();
    else if (!cmd.a[0]) prompt.hidden = true;
  }

  // ---- banners and toasts --------------------------------------------------------------------------
  function edgeFlash() {
    ctx.shell.classList.remove('bt-free-flash');
    void ctx.shell.offsetWidth;
    ctx.shell.classList.add('bt-free-flash');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => ctx.shell.classList.remove('bt-free-flash'), 700);
  }

  function visitorToast(info) {
    const chapters = info.visitors || [];
    if (!chapters.length) return;
    const parts = chapters.map((c) => {
      const roster = fp.chapters[c - 1];
      const fams = [];
      for (const id of roster?.normals || []) {
        const f = enemyDef(id)?.family;
        if (f && !fams.includes(f) && !homeFamilies.includes(f)) fams.push(f);
      }
      const names = fams.slice(0, 2).map((f) => FAMILIES[f]?.name || f);
      const chName = CHAPTERS.find((ch) => ch.id === c)?.name || '';
      return `Chapter ${c}${chName ? ` (${chName})` : ''}${names.length ? `: ${names.join(' & ')}` : ''}`;
    });
    const affix = info.affix ? ` · ${AFFIX_TEXT[info.affix]?.[0] || info.affix}` : '';
    ctx.feed.push(`Visitors from ${parts.join(' + ')}${affix}`, 'new', { key: `fp-rot-${info.rotation}`, ms: 4600 });
  }

  function onWaveStart(n) {
    if (!(n > G)) return;
    let info = null;
    try {
      info = sim.freeplayInfo(n);
    } catch {
      info = null;
    }
    const d = n - G;
    // the crossing: 16/15 — once per battle
    if (d === 1 && once('cross')) {
      ctx.feed.announce(`${n}/${G}`, `BEYOND THE LAST WAVE · ${fp.name}`, 'free', 1800, { glitch: true });
      edgeFlash();
    } else if (n === fp.finale?.wave && once('finale')) {
      ctx.feed.announce('WAVE 200 — THE ASHWING MATRIARCH', 'Mother of every dragon. Hold the line.', 'finale', 3600);
      announcedAtStart.add(fp.finale.enemy);
    } else if (fp.calamity && n === fp.calamity.wave && once('calamity')) {
      ctx.feed.announce('LAST LIGHT — THE ECLIPSE WYRM', 'It carries the Matriarch inside it.', 'finale', 3600);
      announcedAtStart.add(fp.calamity.enemy);
    } else if (MILESTONES[n] && once(`m${n}`)) {
      ctx.feed.announce(MILESTONES[n][0], MILESTONES[n][1], 'free', 2600);
    } else if (info?.boss?.kind === 'titan' && once('titan')) {
      const id = info.boss.bosses[0];
      const def = enemyDef(id);
      const split = def?.traits?.splitter;
      const inner = split?.spawn ? enemyDef(split.spawn) : null;
      const sub = !inner ? 'A giant that holds giants.' : (split.count ?? 2) === 1 ? `Breaks open into the ${inner.name}!` : `Breaks into two ${plural(inner.name)}!`;
      ctx.feed.announce(`TITAN — ${def?.name || id}`, sub, 'boss', 3000);
      announcedAtStart.add(id);
    } else if (info?.boss?.kind === 'boss' && info.boss.bosses.length > 1 && info.boss.bosses.every((id) => enemyDef(id)?.tier === 'boss') && once('twin')) {
      ctx.feed.announce('TWIN BOSSES', info.boss.bosses.map((id) => enemyDef(id)?.name || id).join(' & '), 'boss', 2800);
      for (const id of info.boss.bosses) announcedAtStart.add(id);
    } else if (!shortScreen()) {
      // routine freeplay waves: a short ribbon (short screens: the pill's slam is enough)
      ctx.feed.announce(`WAVE ${n}`, `${n}/${G} · Beyond`, 'free', 1100);
    }
    if (!info) return;
    // a new visiting chapter (every rotation) and its affix
    if ((d - 1) % fp.rotateEvery === 0 && once(`rot-${info.rotation}`)) visitorToast(info);
    // an HP band edge: enemies now grow faster
    for (const [first, growth] of fp.hpBands) {
      if (n === first && n > G + 1 && once(`band-${first}`)) {
        const pct = (growth - 1000) / 10;
        ctx.feed.push(`HP SURGE · +${pct} % per wave from now on`, 'warn', { key: `fp-band-${first}`, ms: 4200 });
      }
    }
    // the countdown to the Matriarch
    const fin = fp.finale?.wave;
    if (fin && n >= fin - 5 && n < fin && once(`count-${n}`)) {
      const left = fin - n;
      ctx.feed.push(`Something vast is coming — ${left} wave${left === 1 ? '' : 's'}`, 'bad', { key: `fp-count-${n}`, ms: 4200 });
    }
  }

  /** A boss or miniboss spawned: the big ribbon on its first appearance only, then a toast. */
  function onBossSpawn(def) {
    if (announcedAtStart.has(def.id)) return true;
    if (once(`boss-${def.id}`)) return false; // first appearance: the controller's usual ribbon
    ctx.feed.push(`${def.name} returns!`, 'warn', { key: `fp-returns-${def.id}`, ms: 2600 });
    return true;
  }

  function onDeath(ev) {
    if (ev.id === fp.finale?.enemy && sim.wave > G && once('matriarch-down')) {
      ctx.feed.announce('MATRIARCH DOWN!', 'Overtime — how far can you go?', 'good', 3600);
    }
  }

  function onWaveEnd() {
    // the next wave's visitors: their models load while the board is quiet (no placeholder pop-in)
    try {
      const ids = sim.waveInfo(sim.wave + 1).map((r) => r.enemyId);
      const fams = familiesOf(ids).filter((f) => !homeFamilies.includes(f));
      if (fams.length) preloadEnemies(fams).catch?.(() => {});
    } catch (e) {
      console.warn('[battle] freeplay preload failed', e);
    }
  }

  /** The run ended: remember it on the session for the room ("Last run: 147/15 · Tempest · fell to …"). */
  function onEnd() {
    const killer = sim.state === 'lost' ? fellTo(sim) : null;
    session.lastRun = {
      stageId: sim.stage.id, tier: fp.id, wave: sim.wavesCleared, goal: G,
      text: sim.state === 'won' ? 'finished together' : killer ? `fell to the ${killer.name}` : `fell on wave ${sim.wave}`,
    };
  }

  return {
    ledger,
    vote,
    onEnd,
    myVote,
    afterGoal,
    onApplied,
    onBossSpawn,
    /** Sim events (before the controller's own handling). */
    handle(ev) {
      switch (ev.type) {
        case 'goal':
          if (once('goal')) ctx.feed.announce('STAGE CLEAR!', 'Rewards saved ✓ · Freeplay ready', 'good', 2600);
          bank();
          break;
        case 'waveStart':
          onWaveStart(ev.wave);
          break;
        case 'waveEnd':
          onWaveEnd();
          break;
        case 'death':
          onDeath(ev);
          break;
        default:
          break;
      }
    },
    /** Every frame: the bank also follows the state (a replay that lost the goal event still banks). */
    update() {
      if (!ledger.bank && sim.wavesCleared >= G) bank();
      if (!prompt.hidden && (ctx.ended || myVote() || !appliedVote(1 - mySlot))) prompt.hidden = true;
    },
    destroy() {
      clearTimeout(flashTimer);
      prompt.remove();
    },
  };
}
