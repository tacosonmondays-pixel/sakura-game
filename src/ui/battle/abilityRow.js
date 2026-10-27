// The selected girl's ability row (ABILITIES_SPEC §8.4; reused by the M4 drawer): under the panel header, before
// Target. One line with ⚡, the ability's name and its button — FIRE, the whole seconds left, ACTIVE 3s or WAVE —
// then one live line (≤ 60 characters, her current numbers) and the Auto switch. An ally's girl: the same row,
// read only. A kind this build does not run yet: "Comes in a later update". A locked ⚡ path is taught on the path
// rows instead (pathAbilityTeaser: the ⚡ T3 / ⚡+ T5 lines). Heroes: the Lv 7 skill row in the hero block.
//
//   abilityRowView(sim, t, { mine, pending })   pure: what the row shows (tests/battle-ui/abilityRow.test.js)
//   abilityLine(def, values, { coinMul })       pure: the ≤ 60-character live line
//   pathAbilityTeaser(def, path, nextTier, { later })  pure: "⚡ T3 Hawk Eye — unlocks Skyfall Volley"
//   createAbilityRow(ctx) → { el, update(t), sig(t), fit(), setFolded(on) }
//
// The row's two lines: the name line (⚡, her name, the button) and the live line with the Auto switch at its right.
// Auto never shares the name's line, so the name has the same room whether the row is open or closed (the M4 review,
// round r1: an open row's Auto pushed "Tidebreaker Shell" into an ellipsis on a phone).
import { h, isPhone } from './util.js';
import { svgEl } from '../components.js';
import { fmtNum } from '../format.js';
import { abilityText, abilityAim, abilityValues } from '../../data/abilityText.js';
import { abilityRuns } from '../../data/abilities.js';
import { abilityDef } from '../../sim/abilities.js';
import { wholeSeconds, refusalText, BOLT_SVG } from './abilityBar.js';

/** The live line's limits (UI_DIRECTION P3: a section holds ≤ 4 numbers and one ≤ 60-character line). */
export const LINE_MAX = 60;
export const LINE_NUMBERS = 3;

const DEPLOY_NOUN = { sentries: 'sentries', strips: 'strips', trap: 'mines', double: 'doubles', drone: 'drones', mirror: 'mirrors' };
const DEPLOY_ONE = { sentries: 'sentry', strips: 'strip', trap: 'mine', double: 'double', drone: 'drone', mirror: 'mirror' };
const r1 = (x) => Math.round(x * 10) / 10;
const tiles = (x) => `${fmtNum(x, 'range')} tiles`;
const secs = (x) => `${r1(x)}s`;

/** The facts a kind leads with, in order; each returns a phrase or null (missing / zero). */
const FACT = {
  count: (v, def) => {
    if (!(v.count > 0) || !Number.isFinite(v.count)) return null;
    // (a strike on one enemy: "the strongest" is in its name, its bites and hold say more: Moon Pounce, Critical Mass)
    if (def.kind === 'strike' && v.count === 1) return null;
    const one = v.count === 1;
    const noun = def.kind === 'deploy' ? (one ? DEPLOY_ONE : DEPLOY_NOUN)[def.effect?.deploy] || 'placed' : one ? 'target' : 'targets';
    return `${v.count} ${noun}`;
  },
  shells: (v) => (v.shells > 1 ? `${v.shells} shells` : null),
  dmg: (v) => (v.dmg > 0 ? `${fmtNum(v.dmg)} dmg` : null),
  hits: (v) => (v.hits > 1 ? (v.count === 1 ? `${v.hits} hits` : `${v.hits} hits each`) : null),
  // (A3 M3: Kaze's Swoop and Storm Lance ground flyers; Omen Card's burst; Puppet Hex; Heavy Beat's armor crack;
  // Backdraft Fan's push and Star Snatch's carry; River Rush's soak; First Aid Call's lives)
  ground: (v) => (v.ground > 0 ? `ground ${secs(v.ground)}` : null),
  curseBurst: (v) => (v.curseBurst > 0 ? `bursts ${fmtNum(v.curseBurst)}` : null),
  hexPct: (v) => (v.hexPct > 0 ? `hex ${r1(v.hexPct)}%/s` : null),
  shred: (v) => (v.shred > 0 ? `−${v.shred} armor` : null),
  push: (v) => (v.push > 0 ? `${r1(v.push)} tile${v.push === 1 ? '' : 's'} back` : null),
  carry: (v) => (v.carry > 0 ? `carry ${r1(v.carry)} tiles` : null),
  soak: (v) => (v.soak > 0 ? `soak ${secs(v.soak)}` : null),
  lifeMax: (v) => (v.lifeMax > 0 ? `up to ${v.lifeMax} lives` : null),
  poisonMul: (v) => (v.poisonMul > 0 ? `poison ×${r1(v.poisonMul)}` : null),
  splash: (v) => (v.splash > 0 ? `${r1(v.splash)}-tile blast` : null),
  freeze: (v) => (v.freeze > 0 ? `freeze ${secs(v.freeze)}` : null),
  stun: (v) => (v.stun > 0 ? `pin ${secs(v.stun)}` : null),
  hold: (v) => (v.hold > 0 ? `hold ${secs(v.hold)}` : null),
  silence: (v) => (v.silence > 0 ? `silence ${secs(v.silence)}` : null),
  reveal: (v) => (v.reveal > 0 ? `reveal ${secs(v.reveal)}` : null),
  markPct: (v) => (v.markPct > 0 ? `+${Math.round(v.markPct)}% taken` : null),
  slowPct: (v) => (v.slowPct > 0 ? `slow ${Math.round(v.slowPct)}%` : null),
  rateMul: (v, def) => (def.kind === 'boost' && v.rateMul > 1 ? `×${r1(v.rateMul)} speed` : null),
  rateMulPct: (v, def) => (def.kind !== 'boost' && v.rateMulPct > 0 ? `+${v.rateMulPct}% speed` : null),
  dmgMulPct: (v, def) => (def.kind === 'rally' || def.kind === 'debuff' ? (v.dmgMulPct > 0 ? `+${v.dmgMulPct}% dmg` : null) : null),
  rangeMulPct: (v) => (v.rangeMulPct > 0 ? `+${v.rangeMulPct}% range` : null),
  range: (v, def) => (def.kind === 'boost' && v.range > 0 ? `+${r1(v.range)} reach` : null),
  chain: (v) => (v.chain > 0 ? `+${v.chain} jumps` : null),
  pierceAdd: (v) => (v.pierceAdd > 0 ? `+${v.pierceAdd} pierce` : null),
  spiralPierce: (v) => (v.spiralPierce > 0 ? `pierce ${v.spiralPierce}` : null),
  radius: (v) => (v.radius > 0 ? tiles(v.radius) : null),
  reach: (v) => (v.reach > 0 ? tiles(v.reach) : null),
  length: (v) => (v.length > 0 ? `${r1(v.length)} tiles` : null),
  dmgMul: (v, def) => (def.kind === 'runner' && v.dmgMul > 0 ? `${r1(v.dmgMul)}× hit` : null),
  dur: (v) => (v.dur > 0 ? secs(v.dur) : null),
};
const ORDER = {
  strike: ['count', 'dmg', 'hits', 'poisonMul', 'splash', 'stun', 'hold', 'ground', 'reach'],
  burst: ['shells', 'dmg', 'freeze', 'stun', 'slowPct', 'radius', 'reach'],
  boost: ['rateMul', 'range', 'chain', 'spiralPierce', 'shred', 'dur'],
  rally: ['rateMulPct', 'dmgMulPct', 'rangeMulPct', 'pierceAdd', 'radius', 'dur', 'lifeMax'],
  debuff: ['count', 'curseBurst', 'hexPct', 'silence', 'hold', 'markPct', 'reveal', 'slowPct', 'dmg', 'rangeMulPct', 'reach', 'dur'],
  deploy: ['count', 'dur', 'reach'],
  runner: ['length', 'dmgMul', 'push', 'soak'],
  move: ['count', 'push', 'carry', 'ground', 'reach'],
};

/**
 * The row's live line: her ability's leading facts with her current numbers, at most LINE_NUMBERS numbers and
 * LINE_MAX characters ("6 targets · 24 dmg · pin 0.5s").
 * @param {object} def the merged ability definition (abilityDef / abilityAtTier / skillAtLevel)
 * @param {object} v abilityValues(def, her stats)
 * @param {{ coinMul?: number }} [o] coinMul: the difficulty's coin rate × the mode's income rate (econ)
 */
export function abilityLine(def, v, { coinMul = 1 } = {}) {
  if (def.kind === 'econ') {
    const coins = Math.round((v.coins || 0) * coinMul);
    return `+${fmtNum(coins, 'money')} coins · twice per wave`;
  }
  const parts = [];
  let nums = 0;
  for (const key of ORDER[def.kind] || ['dur']) {
    const phrase = FACT[key]?.(v, def);
    if (!phrase) continue;
    const n = (phrase.match(/\d+(?:\.\d+)?/g) || []).length;
    if (nums + n > LINE_NUMBERS) continue;
    const next = [...parts, phrase].join(' · ');
    if (next.length > LINE_MAX) break;
    parts.push(phrase);
    nums += n;
  }
  return parts.join(' · ') || abilityText(def.id)?.short || '';
}

/**
 * The ⚡ teaser on a path row's next tier: tier 3 unlocks the ability, tier 5 upgrades it. `later`: a kind this
 * build does not run yet — by default the one rule (abilityRuns, src/data/abilities.js, which the sim's
 * abilityStatus().later agrees with). Null on other tiers and paths without ⚡.
 */
export function pathAbilityTeaser(def, pathIndex, nextTier, { later = null } = {}) {
  const path = def?.paths?.[pathIndex];
  const entry = path?.ability;
  if (!entry) return null;
  if (later == null) later = !abilityRuns(entry);
  const name = abilityText(entry.id)?.name || entry.id;
  const tier = path.tiers?.[nextTier - 1]?.name || '';
  if (nextTier === (entry.unlockTier ?? 3)) return later ? `⚡ T${nextTier} ${tier} — ${name} comes in a later update` : `⚡ T${nextTier} ${tier} — unlocks ${name}`;
  if (nextTier === 5 && entry.t5) return later ? null : `⚡+ T5 ${tier} — upgrades ${name}`;
  return null;
}

const BLOCKED_LABEL = { disabled: 'JAMMED', cap: 'MAX', noIncome: 'OFF', moving: 'MOVING' };

/**
 * What her ability row shows, or null when there is none to show here (no ability, or a tower girl whose ⚡ tier is
 * not reached: the path rows teach that one).
 * @param {import('../../sim/Sim.js').Sim} sim
 * @param {object} t TowerRT
 * @param {{ mine?: boolean, pending?: boolean }} [o] mine: the local player's girl (else read only)
 * @returns {{ id: string, name: string, state: string, button: { label: string, enabled: boolean }|null, chip: string|null,
 *   line: string, auto: boolean, canAuto: boolean, readOnly: boolean, hero: boolean, aim: string|null, title: string }|null}
 */
export function abilityRowView(sim, t, { mine = true, pending = false } = {}) {
  if (!t) return null;
  const st = sim.abilityStatus(t.uid);
  if (!st) return null;
  const text = abilityText(st.id);
  const name = text?.name || st.id;
  const base = { id: st.id, name, hero: !!t.isHero, readOnly: !mine, aim: abilityAim(st.id), auto: false, canAuto: false, button: null, chip: null };
  if (!st.unlocked) {
    // a hero's skill that waits (Kanna's Heavy Beat) says so at every level: no "LV 7" for a skill that will not come
    // then (a teaser that never comes true is a promise); a tower girl's says so once her ⚡ tier is reached
    const reached = t.isHero || (t.tiers?.[st.path] || 0) >= (st.unlockTier ?? 3);
    if (st.later && reached) return { ...base, state: 'later', line: 'Comes in a later update', title: `${name} comes in a later update.` };
    if (t.isHero) {
      const at = fmtNum(st.unlockLevel ?? 7, 'level');
      return { ...base, state: 'locked', chip: at, line: `Unlocks at ${at}`, title: `${name} unlocks at hero ${at}.` };
    }
    return null;
  }
  const def = abilityDef(t);
  let line = text?.short || '';
  try {
    line = abilityLine(def, abilityValues(def, t.eff), { coinMul: (sim.diff?.cashMul ?? 1) * (sim.incomeMul ?? 1) });
  } catch {
    /* the short phrase stays */
  }
  let state;
  if (pending) state = 'pending';
  else if (st.ready) state = 'ready';
  else if (st.reason === 'cooldown') state = 'charging';
  else if (st.reason === 'active') state = 'active';
  else if (st.reason === 'notWave' || st.reason === 'ended') state = 'between';
  else state = 'blocked';
  const label = state === 'ready' ? (mine ? 'FIRE' : 'READY')
    : state === 'charging' ? wholeSeconds(st.cooldownLeft)
      : state === 'active' ? `ACTIVE ${wholeSeconds(st.activeLeft)}`
        : state === 'between' ? 'WAVE'
          : state === 'pending' ? '…'
            : BLOCKED_LABEL[st.reason] || '—';
  const why = state === 'ready' ? 'Ready' : state === 'pending' ? 'Sent' : refusalText(st.reason, { secondsLeft: st.cooldownLeft, name });
  return {
    ...base,
    state,
    button: mine ? { label, enabled: state === 'ready' } : null,
    chip: mine ? null : label,
    line,
    auto: !!st.auto,
    canAuto: mine,
    title: `${name}: ${why}`,
  };
}

/** The live line with each " · " phrase kept whole (no-break spaces inside a phrase), so it wraps only between them. */
export function keepPhrases(line) {
  return String(line || '').split(' · ').map((p) => p.replace(/ /g, '\u00a0')).join(' · ');
}

/** What a re-render needs to know (the seconds tick in place). */
export function rowSignature(v) {
  return v ? `${v.id}|${v.state}|${v.auto}|${v.readOnly}|${v.line}` : '-';
}

/**
 * The row's DOM. update(t) paints the live parts (the button's seconds) every frame without rebuilding it.
 * @param {object} ctx battle context (sim, coop?, castAbility, setAbilityAuto, aim, abilityPending)
 */
export function createAbilityRow(ctx) {
  const { sim } = ctx;
  let t = null;
  let view = null;
  // phones show the row as one 44 px line; a tap on her ability's name opens the live line and Auto (battle.css)
  let open = false;
  let openUid = null;
  // a wide drawer at its number budget folds the live line and Auto behind a tap on her name, as on a phone (setFolded)
  let folded = false;
  const name = h('button.bt-abrow-name', {
    type: 'button', 'aria-expanded': 'false', 'data-testid': 'ability-row-name',
    onclick: () => {
      open = !open;
      openUid = t?.uid ?? null;
      el.classList.toggle('open', open);
      name.setAttribute('aria-expanded', open ? 'true' : 'false');
      fit(); // (the ▾ turns ▴; Auto opens on the live line, never beside her name)
    },
  });
  const fire = h('button.bt-abrow-fire', { type: 'button', 'data-testid': 'ability-fire', onclick: () => onFire() });
  const chip = h('span.bt-abrow-chip', { 'data-testid': 'ability-state' });
  const line = h('span.bt-abrow-line', { 'data-testid': 'ability-line' });
  const auto = h('button.bt-abrow-auto', {
    type: 'button', role: 'switch', 'aria-checked': 'false', 'data-testid': 'ability-row-auto',
    onclick: () => {
      if (!t || !view?.canAuto) return;
      const on = auto.getAttribute('aria-checked') !== 'true';
      ctx.setAbilityAuto?.([t.uid], on);
      paintAuto(on);
    },
  }, 'Auto', h('span.bt-abrow-knob', { 'aria-hidden': 'true' }));
  const el = h('div.bt-abrow', { 'data-testid': 'ability-row' },
    h('div.bt-abrow-top', svgEl(BOLT_SVG, 'bt-abrow-bolt'), name, fire, chip),
    h('div.bt-abrow-sub', line, auto));
  let fireW = -1; // the button's width the last fit() saw ("FIRE", "12", "ACTIVE 3", "WAVE" differ)

  /**
   * Her ability's name is never cut (UI_DIRECTION P6; the M4 review: "Tidebreaker Sh…"): when it would not fit its line
   * beside the button, it takes two smaller lines, so the row stays one row high; when even its longest word would not
   * fit one of those lines (a fallback font before the web font arrives), the ⚡ steps away to give it the room. Run
   * again on a render, a resize, a web font's arrival and when the button's label changes width.
   */
  function fit() {
    name.classList.remove('bt-abrow-2l');
    el.classList.remove('bt-abrow-nobolt');
    fireW = fire.isConnected ? fire.getBoundingClientRect().width : -1;
    if (!name.isConnected || !overflows()) return;
    name.classList.add('bt-abrow-2l');
    if (overflows({ word: true })) el.classList.add('bt-abrow-nobolt');
  }

  /**
   * Does her name (with its ▾) run past its box? Measured to the subpixel on an unsized copy: a button's scrollWidth is a
   * whole number, and a 0.6 px overflow still draws an ellipsis ("Shadow Doubl…"). `word`: its longest word alone, at
   * the size the name has now (the two-line size once that is on).
   */
  function overflows({ word = false } = {}) {
    const copy = name.cloneNode(true);
    copy.removeAttribute('data-testid');
    copy.setAttribute('aria-hidden', 'true');
    copy.style.cssText = 'position: absolute; visibility: hidden; width: auto; min-width: 0; max-width: none; flex: none; white-space: nowrap';
    if (word) copy.textContent = (name.textContent || '').split(/\s+/).reduce((a, b) => (b.length > a.length ? b : a), '');
    name.parentElement.append(copy);
    const over = copy.getBoundingClientRect().width > name.getBoundingClientRect().width + 0.01;
    copy.remove();
    return over;
  }

  function paintAuto(on) {
    auto.classList.toggle('on', !!on);
    auto.setAttribute('aria-checked', on ? 'true' : 'false');
  }

  function onFire() {
    if (!t || !view || view.readOnly || ctx.ended) return;
    if (view.aim && view.state === 'ready' && ctx.aim?.startAbility) {
      if (ctx.aim.abilityId === view.id) {
        ctx.aim.cancel();
        ctx.castAbility?.(t.uid, { group: false, aim: null, id: view.id });
      } else ctx.aim.startAbility({ uid: t.uid, id: view.id, kind: view.aim, name: view.name, from: 'panel' });
      return;
    }
    ctx.castAbility?.(t.uid, { group: false, aim: null, id: view.id });
  }

  function viewOf(tower) {
    const mine = !ctx.coop || ctx.coop.isMine(tower.uid);
    const id = tower.abil?.id;
    return abilityRowView(sim, tower, { mine, pending: !!(id && ctx.abilityPending?.has?.(id)) });
  }

  /** Builds or repaints the row for girl `tower`; returns the element, or null when she shows none. */
  function update(tower) {
    t = tower;
    view = tower ? viewOf(tower) : null;
    if (!view) return null;
    if (openUid !== tower.uid) {
      open = false;
      openUid = tower.uid;
      name.setAttribute('aria-expanded', 'false');
    }
    el.className = `bt-abrow s-${view.state}${view.readOnly ? ' ro' : ''}${view.hero ? ' hero' : ''}${open ? ' open' : ''}${folded ? ' fold' : ''}`;
    el.title = view.title;
    if (name.textContent !== view.name) name.textContent = view.name;
    const label = `${view.name}: ${view.line}`;
    if (name.getAttribute('aria-label') !== label) name.setAttribute('aria-label', label);
    fire.hidden = !view.button;
    if (view.button) {
      if (fire.textContent !== view.button.label) {
        fire.textContent = view.button.label;
        // (a wider label narrows her name's box: fit again when the button's width changed)
        if (fireW >= 0 && el.isConnected && fire.getBoundingClientRect().width !== fireW) fit();
      }
      fire.classList.toggle('ready', view.button.enabled);
      fire.setAttribute('aria-label', `${view.name}: ${view.button.label === 'FIRE' ? 'fire' : view.title}`);
    }
    chip.hidden = !view.chip;
    if (view.chip && chip.textContent !== view.chip) chip.textContent = view.chip;
    // (a phone's later-ability note is short, beside the name on its one line; the title keeps the sentence)
    // (a phrase never breaks inside, "1.5 tiles" stays whole: the line wraps only between its phrases, beside Auto)
    const words = view.state === 'later' && isPhone() ? 'Later update' : keepPhrases(view.line);
    if (line.textContent !== words) line.textContent = words;
    auto.hidden = !view.canAuto;
    paintAuto(view.auto);
    return el;
  }

  return {
    el,
    update,
    fit,
    /** The drawer is at its 13 numbers (towerPanel fitNumbers): the live line and Auto open with a tap on her name. */
    setFolded(on) {
      folded = !!on;
      el.classList.toggle('fold', folded);
    },
    /** Her row's signature (state, Auto, line; not the seconds): towerPanel's re-render key. */
    sig: (tower) => rowSignature(tower ? viewOf(tower) : null),
    get view() {
      return view;
    },
  };
}
