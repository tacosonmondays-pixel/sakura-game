// End of battle: victory / defeat modal (applies the result once with a seeded rng and
// persists via store.commit), then the rewards view: medal, first-clear gems, item tiles,
// gear cards, unlocked girls (card art celebration) and new bestiary entries.
// Co-op freeplay past the goal gets a third sheet (FREEPLAY OVER / FREEPLAY COMPLETE): the big
// overflow pill "147/15", how it ended, a new best, the bosses beaten, the clear (banked at the
// goal) and the freeplay bonus. A Sandbox run gets one line and the way back (nothing earned or saved).
import { resultBand } from '../transitions/index.js';
import { h, icon, setVar, enemyToken, enemyDef, fmtCoins, fmtBig, fmtTime } from './util.js';
import { svgEl, itemTile, toast } from '../components.js';
import { store } from '../../core/store.js';
import { createRng, hashString } from '../../core/rng.js';
import { applyBattleResult, battleDropSeed } from '../../systems/rewards.js';
import { describeStat } from '../../systems/gear.js';
import { portraitHTML } from '../../art/portraits.js';
import { medalIcon, gearIcon, traitIcon } from '../../art/icons.js';
import { resultRibbonRow, dropsTitle } from './modes.js';
import { getItem } from '../../data/items.js';
import { getUnit } from '../../data/units.js';
import { ITEM_RARITIES, DIFFICULTIES, GEAR_SLOTS, TRAITS } from '../../data/types.js';
import { FAMILIES } from '../../data/enemies.js';
import { followingStage } from './setup.js';
import { isStageUnlocked } from '../../systems/unlocks.js';
import { fellTo } from './freeplay.js';
import { FREEPLAY_TIERS, freeplayTable } from '../../data/freeplay.js';
import { FREEPLAY_REWARDS, freeplayTomeLine } from '../../online/coop/rewards.js';
import { lastSoloTier } from './soloFreeplay.js';
import { TIER_PITCH } from '../freeplayText.js';
import { newlyReadyIds } from '../achToast.js';
import { ribbonArt } from '../honorFx.js';
import { HONOR_MAP } from '../../data/honors.js';
import { navigate } from '../router.js';
import { eventNow } from '../events/clock.js';
import { eventOfStage } from '../../data/events/index.js';
import { TITAN_MAP, tierLabel } from '../../data/titans.js';
import { RAINBOW_METER } from '../../systems/titanRewards.js';
import '../styles/titans.css';

/** Item tile with the rarity frame applied (falls back to a soft grey for unknown items). */
function rewardTile(id, count, size = 64) {
  const wrap = itemTile(id, count, { size, showName: true });
  const tile = wrap.classList.contains('item-tile') ? wrap : wrap.querySelector('.item-tile');
  setVar(tile, '--rarity', ITEM_RARITIES[getItem(id)?.rarity]?.color || '#9aa5b1');
  return wrap;
}

function gearCard(g) {
  const rarity = ITEM_RARITIES[g.rarity];
  const card = h(
    'div.bt-gear',
    h('div.bt-gear-head', svgEl(gearIcon(g.slot, g.rarity), 'bt-gear-ico'), h('div', h('div.bt-gear-name', g.name || `${rarity?.name} ${GEAR_SLOTS[g.slot]?.name}`), h('div.bt-gear-meta', `${rarity?.name || g.rarity} ${GEAR_SLOTS[g.slot]?.name || g.slot}`))),
    h('div.bt-gear-main', describeStat(g.main.stat, g.main.value)),
    g.subs?.length ? h('ul.bt-gear-subs', g.subs.map((s) => h('li', describeStat(s.stat, s.value)))) : h('div.bt-gear-subs.muted', 'No substats'),
  );
  setVar(card, '--rarity', rarity?.color);
  return card;
}

function unlockCard(unitId) {
  const u = getUnit(unitId);
  return h(
    'div.bt-unlock',
    h('div.bt-unlock-rays'),
    svgEl(portraitHTML(u, 'full', { eager: true }), 'bt-unlock-art'),
    h('div.bt-unlock-text', h('b', `${u.name} joined the academy!`), h('span', u.acquisition?.note || u.title || '')),
  );
}

function discoveredRow(ids) {
  return h('div.bt-discovered', ids.map((id) => {
    const e = enemyDef(id);
    const fam = FAMILIES[e?.family];
    return h('div.bt-disc', enemyToken(id, { size: 40 }), h('div.bt-disc-name', e?.name || id), h('div.bt-disc-fam', fam?.name || ''));
  }));
}

const VICTORY_LINES = [
  'We did it, Sensei! Did you see that?',
  'Victory! Your plan was perfect, Sensei.',
  'Hehe, not a single petal out of place!',
  'Mission complete! Can we get crêpes now?',
];

/** The girl who celebrates on the victory sheet: top damage, else the hero, else the first tower. */
function victoryGirl(ctx) {
  let id = null;
  try {
    id = ctx.sim.debrief()?.damage?.[0]?.unitId || null;
  } catch {
    id = null;
  }
  const f = ctx.profile?.formation || {};
  id ||= f.hero || f.towers?.[0] || null;
  try {
    return id ? getUnit(id) : null;
  } catch {
    return null;
  }
}

/** Drawn stand of the MVP beside the victory sheet with a speech bubble (academy results style). */
function victoryStand(ctx, seed = 0) {
  const u = victoryGirl(ctx);
  if (!u) return null;
  return h('div.bt-win-girl', { 'aria-hidden': 'true', 'data-testid': 'victory-girl' },
    svgEl(portraitHTML(u, 'cut', { eager: true }), 'bt-win-girl-art'),
    h('div.bt-win-bubble', h('b', `MVP · ${u.name}`), h('span', VICTORY_LINES[Math.abs(seed) % VICTORY_LINES.length])),
  );
}

function section(title, ...children) {
  return h('section.bt-rsec', h('div.bt-rsec-title', title), ...children);
}

/** Practice runs (a deep link to a stage still locked on the map) save nothing. */
function practiceNote(out = null) {
  // a practice result with its own reason (a limited event's gate: out.note says why) is not a locked stage
  if (out?.note) return null;
  return h('p.muted.bt-practice-note', { 'data-testid': 'practice-note' }, 'Practice run — this stage is still locked on your map, so nothing was saved: no clear, medal, drops or unlocks.');
}

/**
 * Solo "Keep going" on the victory and rewards sheets: the tier chips (Blossom · Tempest · Crimson
 * Moon, the last one picked first) and a violet → pink KEEP GOING ▶ 16/15 button.
 */
function keepGoingBlock(ctx) {
  if (!ctx.canKeepGoing?.()) return null;
  const G = ctx.sim.totalWaves;
  let tier = lastSoloTier();
  const hint = h('small.bt-keep-hint');
  const chips = h('div.bt-keep-tiers', { role: 'radiogroup' });
  const paint = () => {
    chips.replaceChildren(...FREEPLAY_TIERS.map((id) => h(`button.bt-keep-tier.bt-keep-${id}${id === tier ? '.on' : ''}`, {
      role: 'radio', 'aria-checked': id === tier ? 'true' : 'false', 'data-testid': `keep-tier-${id}`, 'data-tier': id,
      onclick: () => { tier = id; paint(); },
    }, freeplayTable(id).name)));
    hint.textContent = `${TIER_PITCH[tier]} Your clear is saved; the run goes on until you fall or finish.`;
  };
  paint();
  return h('div.bt-keep', { 'data-testid': 'keep-going-block' },
    h('div.bt-keep-head', h('b', 'Keep going?'), chips),
    hint,
    h('button.bt-cta.bt-keep-btn', { 'data-testid': 'keep-going', onclick: () => ctx.keepGoing(tier) },
      h('span', 'KEEP GOING'), h('small', `Wave ${G + 1}/${G}`), icon('play', 'bt-ico-sm')));
}

/**
 * @param {object} ctx battle context
 */
/** "★ 2 achievements ready ›" with up to 3 static ribbon minis (never auto-claims; achievements spec §5.5). */
function achLine() {
  const ids = newlyReadyIds();
  if (!ids.length) return null;
  const minis = ids.filter((id) => HONOR_MAP[id]).slice(0, 3).map((id) => ribbonArt(id, 22, { still: true }));
  return h('button.bt-ach-line', { 'data-testid': 'result-achievements', onclick: () => navigate('commissions', { tab: 'achievements', highlight: ids[0] }) },
    h('span', `★ ${ids.length} achievement${ids.length === 1 ? '' : 's'} ready`), minis, h('b', '›'));
}

export function createResults(ctx) {
  const { sim, stage } = ctx;
  let outcome = null;
  let applied = false;
  const el = h('div.bt-overlay.bt-result-overlay', { 'data-testid': 'result' });
  el.hidden = true;
  ctx.layer.append(el);

  /**
   * Applies the battle result exactly once and persists it. A saved run (ctx.saver) rolls its
   * drops from the run seed (finishing it again from an older copy of the profile rolls the
   * same), gets the event bonus of the week it started in, and its save is deleted in the same
   * synchronous write as the rewards: never paid twice, never continued after the payout.
   */
  function apply() {
    if (applied) return outcome;
    applied = true;
    const result = sim.result();
    if (ctx.req?.sandbox) result.sandbox = true;
    const saver = ctx.saver || null;
    const rng = createRng(saver ? battleDropSeed(stage.id, sim.difficulty, saver.seed) : hashString(`${stage.id}:${sim.difficulty}:${sim.seed}:${Date.now()}`));
    try {
      // co-op / clan boss battles bring their own reward rules (ctx.applyResult)
      outcome = ctx.applyResult
        ? ctx.applyResult(store.profile, result, rng)
        : applyBattleResult(store.profile, result, rng, { now: new Date(eventNow()), eventAt: saver ? new Date(saver.createdAt) : null, startedAt: ctx.startedAt ?? null });
    } catch (e) {
      console.error('[battle] applyBattleResult failed', e);
      outcome = { firstClear: false, newMedal: false, medal: null, rewards: [], gear: [], unlockedUnits: [], discovered: [], gemsEarned: 0, error: true };
    }
    saver?.finish(store.profile); // (a sandbox run never has a saver: isSavableRun)
    // a sandbox run changes nothing, so there is nothing to save
    if (!outcome.sandbox && !ctx.req?.sandbox) {
      store.commit('battle-result');
      // the result sheet says so when the payout could not be written (storage full, saving
      // paused, or another tab moved on): a reload would bring the old state back
      if (!store.saveNow()) outcome.saveFailed = store.lastSaveError || 'quota';
    }
    if (outcome.sandboxUnlocked) toast('Sandbox unlocked! Find it on the Missions screen.', 'good', 4200);
    ctx.onResultApplied?.(outcome);
    return outcome;
  }

  const SAVE_FAILED = {
    quota: 'Your rewards couldn\'t be saved on this device (storage is full). Free up some space and keep the game open.',
    held: 'Saving is paused on this device, so these rewards were not saved.',
    stale: 'The game was played in another tab, so these rewards were not saved here.',
  };
  /** A line on the result sheet when the payout was not written. */
  function saveFailedNote(out) {
    return out.saveFailed ? h('p.bt-save-failed', { 'data-testid': 'result-save-failed' }, SAVE_FAILED[out.saveFailed] || SAVE_FAILED.quota) : null;
  }

  /** Sandbox: one line and the way back (nothing was earned or saved). */
  function showSandbox() {
    apply();
    const card = h(
      'div.bt-sheet.bt-result.bt-sandbox-result',
      { 'data-testid': 'sandbox-result' },
      h('div.bt-result-ribbon', 'SANDBOX'),
      h('p.bt-sandbox-line', 'Sandbox: no rewards'),
      summary(),
      actions(false),
    );
    open(card);
  }

  function actions(won) {
    if (ctx.extraActions) {
      return h('div.bt-result-actions', ctx.extraActions().map((a) => h(`button.${a.cta ? 'bt-cta' : 'bt-btn'}`, { 'data-testid': a.testid, onclick: a.onClick }, a.icon ? icon(a.icon, 'bt-ico-sm') : null, a.label)));
    }
    // Next Stage only leads somewhere playable: 1-10's next is 2-6, which also waits for 2-5 (a two-key stage)
    const following = won ? followingStage(stage.id) : null;
    const next = following && isStageUnlocked(store.profile, following) ? following : null;
    return h(
      'div.bt-result-actions',
      next ? h('button.bt-cta', { 'data-testid': 'next-stage', onclick: () => ctx.goNext(next) }, 'Next Stage', icon('play', 'bt-ico-sm')) : null,
      h('button.bt-btn', { 'data-testid': 'retry', onclick: () => ctx.restart() }, icon('refresh', 'bt-ico-sm'), 'Retry'),
      h('button.bt-btn', { 'data-testid': 'back-map', onclick: () => ctx.goMap() }, icon('map', 'bt-ico-sm'), 'Map'),
      h('button.bt-btn', { 'data-testid': 'home', onclick: () => ctx.goHome() }, icon('home', 'bt-ico-sm'), 'Home'),
    );
  }

  function summary() {
    const r = sim.result();
    const over = !!r.freeplay && r.wavesCleared > sim.totalWaves;
    const items = [
      ['Waves', Number.isFinite(sim.totalWaves) ? `${r.wavesCleared}/${sim.totalWaves}` : `${r.wavesCleared}`],
      ['Lives', `${r.livesLeft}/${r.maxLives}`],
      ['Defeated', fmtBig(Object.values(r.kills).reduce((a, b) => a + b, 0))],
      ['Time', fmtTime(r.stats.time)],
    ];
    // your own hero only (co-op: her own counters, never the ally's)
    const mine = sim.hero;
    const hr = mine ? r.heroes?.[mine.heroIndex] : null;
    const heroLine = hr ? h('p.bt-sum-hero', { 'data-testid': 'result-hero' }, `${mine.def.name} reached Lv ${hr.level}${hr.levelsBought ? ` (${hr.levelsBought} level${hr.levelsBought === 1 ? '' : 's'} bought)` : ''}`) : null;
    return h('div.bt-summary-wrap', h('div.bt-summary', items.map(([k, v], i) => h(`div.bt-sum${over && i === 0 ? '.bt-sum-over' : ''}`, h('span', k), h('b', v)))), heroLine);
  }

  function mvp() {
    let d = null;
    try {
      d = sim.debrief();
    } catch {
      return null;
    }
    const top = (d.damage || []).slice(0, 3);
    if (!top.length) return null;
    return h('div.bt-mvp', top.map((row, i) => {
      let art = null;
      try {
        art = svgEl(portraitHTML(getUnit(row.unitId), 'thumb'), 'bt-mvp-art');
      } catch {
        art = h('span.bt-mvp-art');
      }
      return h(`div.bt-mvp-row${i === 0 ? '.top' : ''}`, art, h('div.bt-mvp-info', h('b', `${i === 0 ? 'MVP · ' : ''}${row.name}`), h('span.bt-mvp-bar', h('span', { style: { width: `${Math.round(row.share * 100)}%` } })), h('small', `${fmtCoins(row.damage)} dmg · ${Math.round(row.share * 100)}%`)));
    }));
  }

  function showVictory() {
    const out = apply();
    const diff = DIFFICULTIES[sim.difficulty];
    const card = h(
      'div.bt-sheet.bt-result.bt-win',
      h('div.bt-result-ribbon', 'VICTORY!'),
      h('div.bt-result-stage', `${stage.kind === 'campaign' ? `${stage.id} · ` : ''}${stage.name} — ${diff.name}`),
      saveFailedNote(out),
      out.note ? h('p.bt-coop-note', { 'data-testid': 'result-note' }, out.note) : null,
      ctx.resultLine?.() || null,
      achLine(),
      out.practice || out.coop
        ? (out.practice ? practiceNote(out) : null)
        : out.mode && out.mode !== 'standard' ? resultRibbonRow(out, sim, store.profile) : h(
          'div.bt-medal-row',
          h(`div.bt-medal${out.newMedal ? '.new' : ''}`, svgEl(medalIcon(sim.difficulty), 'bt-medal-ico'), out.newMedal ? h('span.bt-medal-tag', 'New medal!') : h('span.bt-medal-tag.old', 'Medal owned')),
          out.firstClear ? h('div.bt-first', 'FIRST CLEAR') : null,
        ),
      out.mode === 'standard' ? resultRibbonRow(out, sim, store.profile) : null,
      summary(),
      out.practice ? null : keepGoingBlock(ctx),
      out.practice
        ? actions(true)
        : h('div.bt-result-actions', h('button.bt-cta.bt-cta-big', { 'data-testid': 'view-rewards', onclick: () => showRewards() }, 'Rewards', icon('gift', 'bt-ico-sm'))),
    );
    open(card, victoryStand(ctx, sim.wave || 0));
  }

  function showDefeat() {
    const out = apply();
    let d = null;
    try {
      d = sim.debrief();
    } catch (e) {
      console.warn('[battle] debrief failed', e);
    }
    const leaks = (d?.leaks?.enemies || []).slice(0, 4);
    const traits = (d?.leaks?.traits || []).slice(0, 3);
    const card = h(
      'div.bt-sheet.bt-result.bt-lose',
      h('div.bt-result-ribbon', ctx.endedRun ? 'RUN OVER' : 'DEFEAT'),
      h('div.bt-result-stage', `${stage.kind === 'campaign' ? `${stage.id} · ` : ''}${stage.name} — wave ${sim.wave}`),
      out.practice ? practiceNote(out) : null,
      saveFailedNote(out),
      out.note ? h('p.bt-coop-note', { 'data-testid': 'result-note' }, out.note) : null,
      ctx.resultLine?.() || null,
      achLine(),
      summary(),
      h('div.bt-rsec-title', 'Debrief'),
      h('ul.bt-debrief', (d?.lines || ['The defence fell.']).map((l) => h('li', l))),
      leaks.length
        ? h('div.bt-leaks', leaks.map((l) => h('div.bt-leak', enemyToken(l.enemyId, { size: 30 }), h('div', h('b', l.name), h('small', `${l.count} slipped through · −${l.lives} ♥`)))))
        : null,
      traits.length
        ? h('div.bt-leak-traits', traits.map((t) => h('span.bt-cap', svgEl(traitIcon(t.trait), 'bt-cap-ico'), `${TRAITS[t.trait]?.name || t.trait} −${t.lives}`)))
        : null,
      out.rewards.length ? h('div.bt-rsec', h('div.bt-rsec-title', 'Consolation'), h('div.bt-tiles', out.rewards.map((r) => rewardTile(r.id, r.count, 56)))) : null,
      actions(false),
    );
    open(card);
  }

  function showRewards() {
    const out = apply();
    const gems = out.rewards.filter((r) => r.id === 'gems');
    const others = out.rewards.filter((r) => r.id !== 'gems');
    const blocks = [];
    if (out.practice && !out.note) blocks.push(practiceNote(out));
    if (out.unlockedUnits.length) blocks.push(section('New student', h('div.bt-unlocks', out.unlockedUnits.map(unlockCard))));
    if (gems.length || out.firstClear) {
      blocks.push(section(
        out.firstClear ? 'First clear bonus' : 'Medal bonus',
        h('div.bt-tiles', gems.map((r) => rewardTile(r.id, r.count, 64)), out.firstClear && !gems.length ? h('p.muted', 'First clear!') : null),
      ));
    }
    if (!out.practice) {
      blocks.push(section(
        dropsTitle(out, sim, out.eventBonus ? 'Drops · event 2×' : 'Drops'),
        others.length || out.gear.length
          ? h('div.bt-tiles', others.map((r) => rewardTile(r.id, r.count, 64)))
          : h('p.muted.bt-empty', 'No drops this time — harder difficulties roll more items.'),
      ));
    }
    // the drawn MVP busts come right after the drops, so a phone sees them without scrolling
    const m = mvp();
    if (m) blocks.push(section('Top damage', m));
    if (out.gear.length) blocks.push(section('Gear', h('div.bt-gears', out.gear.map(gearCard))));
    if (out.discovered.length) blocks.push(section('Bestiary updated', discoveredRow(out.discovered)));
    // [events] a first clear that opened an event episode says so
    if (out.event?.newEpisodes?.length) {
      const ev = eventOfStage(stage.id);
      blocks.push(section('Event story', h('div.bt-event-eps', { 'data-testid': 'result-episodes' }, out.event.newEpisodes.map((id) => h('p', `New episode unlocked: ${ev?.episodes.find((e) => e.id === id)?.title || id}`)))));
    }
    const card = h(
      'div.bt-sheet.bt-result.bt-rewards',
      { 'data-testid': 'rewards' },
      h('div.bt-result-ribbon', 'REWARDS'),
      out.mode && out.mode !== 'standard' && !out.coop && !out.practice
        ? resultRibbonRow(out, sim, store.profile)
        : h('div.bt-medal-row.small', svgEl(medalIcon(sim.difficulty), 'bt-medal-ico'), h('span', out.coop ? `Co-op · ${DIFFICULTIES[sim.difficulty].name} cleared together` : out.practice ? `${DIFFICULTIES[sim.difficulty].name} practice run` : out.newMedal ? `${DIFFICULTIES[sim.difficulty].name} medal earned!` : `${DIFFICULTIES[sim.difficulty].name} cleared`)),
      ctx.resultLine?.() || null,
      achLine(),
      h('div.bt-rewards-body', blocks),
      out.practice ? null : keepGoingBlock(ctx),
      actions(true),
    );
    open(card);
  }

  /** Freeplay past the goal (co-op or solo): FREEPLAY OVER (fell) or FREEPLAY COMPLETE (Finish). */
  function showFreeplay() {
    const out = apply();
    const r = sim.result();
    const fp = out.freeplay || {};
    const table = sim.stage.freeplay;
    const won = r.won;
    const diff = DIFFICULTIES[sim.difficulty];
    const killer = won ? null : fellTo(sim);
    // finished with the ally still there (both voted), or alone after the ally left the run
    const alone = !ctx.coop || [...ctx.coop.lockstep.peers.values()].every((p) => p.gone);
    const subline = won
      ? (alone ? `Finished after wave ${r.wavesCleared}` : `Finished together after wave ${r.wavesCleared}`)
      : `Fell on wave ${sim.wave}${killer ? ` to the ${killer.name}` : ''}`;
    const bosses = Object.entries(r.kills || {}).filter(([id]) => ['boss', 'miniboss'].includes(enemyDef(id)?.tier))
      .sort(([a], [b]) => (enemyDef(a).tier === 'boss' ? 0 : 1) - (enemyDef(b).tier === 'boss' ? 0 : 1));
    const bankRewards = out.bank?.rewards || [];
    const fpRewards = out.freeplayRewards || [];
    const tiles = (list) => (list.length ? h('div.bt-tiles', list.map((x) => rewardTile(x.id, x.count, 56))) : h('p.muted.bt-empty', 'Nothing this time.'));
    const bonusLines = [
      !fp.waves ? 'No freeplay waves cleared yet.'
        : fp.waveCoins != null ? `${fp.waves} freeplay wave${fp.waves === 1 ? '' : 's'} × ${fmtCoins(fp.waveCoins)} coins (${table.name} on ${stage.id})`
          : `${fp.waves} freeplay wave${fp.waves === 1 ? '' : 's'} × ${fmtCoins(40)} coins${table.rewardMul !== 1 ? ` × ${table.rewardMul} (${table.name})` : ''}`,
      fp.caches ? `${fp.caches} freeplay cache${fp.caches === 1 ? '' : 's'} (one every ${FREEPLAY_REWARDS.cacheEvery} waves)` : null,
      // a cache's Akashic Tome, or why none came (the week's limit, solo and co-op together)
      freeplayTomeLine(store.profile, fp),
      fp.tokens ? `${fp.tokens} Assault Token${fp.tokens === 1 ? '' : 's'} for bosses beaten` : null,
    ].filter(Boolean);
    const card = h(
      `div.bt-sheet.bt-result.bt-free${won ? '.bt-free-done' : ''}`,
      { 'data-testid': 'freeplay-result', 'data-tier': table.id },
      h('div.bt-result-ribbon', won ? 'FREEPLAY COMPLETE' : 'FREEPLAY OVER'),
      h('div.bt-free-head',
        h(`div.bt-free-pill`, { 'data-tier': table.id, 'data-testid': 'freeplay-reached' }, h('b.bt-wave-n', String(r.wavesCleared)), h('span.bt-wave-goal', `/${sim.totalWaves}`)),
        h('div.bt-free-meta',
          h('b', `Cleared wave ${r.wavesCleared} / ${sim.totalWaves}`),
          h('span', subline),
          h('small', `${stage.kind === 'campaign' ? `${stage.id} · ` : ''}${stage.name} — ${diff.name} · Freeplay ${table.name}`))),
      fp.newBest
        ? h('div.bt-free-best', { 'data-testid': 'freeplay-best' }, `New best on ${stage.id} (${table.name})!`)
        : fp.best ? h('div.bt-free-best.old', `Your best on ${stage.id} (${table.name}): ${fp.best}/${sim.totalWaves}`) : null,
      // as on the victory and defeat sheets: the freeplay payout could not be written
      saveFailedNote(out),
      out.note ? h('p.bt-coop-note', { 'data-testid': 'result-note' }, out.note) : null,
      ctx.resultLine?.() || null,
      achLine(),
      bosses.length ? section('Bosses beaten', h('div.bt-free-bosses', bosses.map(([id, n]) => h('div.bt-free-boss', { title: enemyDef(id)?.name || id }, enemyToken(id, { size: 40 }), h('small', `${enemyDef(id)?.name || id}${n > 1 ? ` ×${n}` : ''}`))))) : null,
      summary(),
      section(`Stage clear · saved at ${sim.totalWaves}/${sim.totalWaves}`, tiles(bankRewards)),
      section('Freeplay bonus', h('ul.bt-free-lines', bonusLines.map((l) => h('li', l))), tiles(fpRewards),
        (fp.milestones || []).length ? h('div.bt-free-milestones', fp.milestones.map((m) => h('div.bt-free-ms', h('b', m.label), h('span', [m.gems ? `+${m.gems} gems` : '', m.title ? `Title: ${m.title}` : '', m.frame ? 'New profile frame' : ''].filter(Boolean).join(' · '))))) : null),
      (() => {
        const m = mvp();
        return m ? section('Top damage', m) : null;
      })(),
      (() => {
        let d = null;
        try {
          d = sim.debrief();
        } catch {
          d = null;
        }
        return d?.lines?.length ? section('Debrief', h('ul.bt-debrief', d.lines.slice(0, 3).map((l) => h('li', l)))) : null;
      })(),
      actions(won),
    );
    open(card);
  }

  /**
   * Titan Trials (docs/specs/ASCENSION.md §C.5): the damage notch on her HP bar, then what it paid,
   * the Victory Chest on a win (its gear box first), a first clear, and the Rainbow Meter.
   */
  function showTitan() {
    const out = apply();
    const t = ctx.titan || {};
    const read = t.tracker?.read() || { share: 0, victory: false, leaked: false };
    const name = TITAN_MAP[t.id]?.name || 'The titan';
    const pct = Math.round(Math.min(1, read.share) * 100);
    const notch = out.notch;
    const ribbon = out.practice ? 'PRACTICE' : notch ? (notch.id === 'victory' ? 'VICTORY!' : notch.name.toUpperCase()) : 'NOT COUNTED';
    const line = out.practice
      ? 'Practice run: no Trial Key used and no rewards.'
      : !notch ? 'This one didn\'t count — try again! Your Trial Key was not used.'
        : notch.id === 'victory' ? `${name} defeated!`
          : read.leaked ? `${name} got away! You reached ${notch.name}.` : `You reached ${notch.name}.`;
    const bar = h('div.tt-hpbar', { 'data-testid': 'titan-bar', style: { '--fill': `${pct}%` } },
      h('div.tt-hpfill'),
      [25, 50, 75].map((at) => h(`span.tt-notch${pct >= at ? '.hit' : ''}`, { style: { left: `${at}%` } })),
      h('b.tt-hppct', `${pct}%`));
    const chestIds = new Set((out.chest?.items || []).map((x) => x.id));
    // first-clear-only items (gems, Kindred, a whole crown) show under First clear, not again here
    const fcOnly = new Set((out.firstClear?.items || []).map((x) => x.id).filter((id) => !['star_fragment', 'token_boss', 'crown_rainbow_shard'].includes(id) && !/^mat_/.test(id)));
    const tableTiles = out.rewards.filter((r) => !chestIds.has(r.id) && !fcOnly.has(r.id) && r.id !== 'gearbox_rainbow');
    const chestTiles = out.rewards.filter((r) => chestIds.has(r.id) || r.id === 'gearbox_rainbow');
    const blocks = [];
    if (out.firstClear) blocks.push(section('First clear', h('div.bt-tiles', [...out.firstClear.items].map((r) => rewardTile(r.id, r.count, 56)))));
    if (notch?.id === 'victory') {
      const boxLine = out.box === 'rainbow'
        ? h('p.tt-rainbow', { 'data-testid': 'titan-rainbow' }, out.rainbowForced ? 'Rainbow Meter full: a Rainbow Gear Box!' : 'A Rainbow Gear Box! Open it in the Backpack.')
        : null;
      blocks.push(section('Victory Chest', boxLine, chestTiles.length ? h('div.bt-tiles', chestTiles.map((r) => rewardTile(r.id, r.count, 56))) : null));
    }
    if (tableTiles.length) blocks.push(section(notch?.id === 'victory' ? 'Damage rewards' : `${notch?.name || ''} rewards`, h('div.bt-tiles', tableTiles.map((r) => rewardTile(r.id, r.count, 56)))));
    if (out.gear.length) blocks.push(section('Gear', h('div.bt-gears', out.gear.map(gearCard))));
    const m = mvp();
    if (m) blocks.push(section('Top damage', m));
    const card = h(
      `div.bt-sheet.bt-result.bt-titan${notch?.id === 'victory' ? '.bt-win' : ''}`,
      { 'data-testid': 'titan-result', 'data-notch': notch?.id || (out.practice ? 'practice' : 'none') },
      h('div.bt-result-ribbon', ribbon),
      h('div.bt-result-stage', `${name} — ${tierLabel(t.tier, t.rank)}`),
      bar,
      h('p.tt-result-line', { 'data-testid': 'titan-line' }, line),
      out.unlocked ? h('p.tt-unlocked', { 'data-testid': 'titan-unlocked' }, `${out.unlocked} unlocked!`) : null,
      saveFailedNote(out),
      achLine(),
      h('div.bt-rewards-body', blocks),
      !out.practice ? h('p.muted.tt-keys', `Trial Keys left: ${out.keysLeft}${out.meter != null && t.tier === 'mayhem' ? ` · Rainbow Meter ${out.meter}/${RAINBOW_METER}` : ''}`) : null,
      actions(!!read.victory),
    );
    // [transitions] the fused-crown toasts wait for the VICTORY band, like the rest of this sheet
    open(card).then(() => {
      for (const f of out.fused || []) toast(f.id === 'crown_rainbow' ? 'A Rainbow Crown! Gate 9 or 10 can open.' : `${getItem(f.id)?.name || f.id} fused!`, 'good', 4200);
    });
  }

  function open(card, extra = null) {
    const first = el.hidden;
    el.replaceChildren(...[extra, card].filter(Boolean));
    // a victory stand takes the left side: the sheet moves right so it never covers her or her bubble
    el.classList.toggle('has-girl', !!extra?.classList?.contains('bt-win-girl'));
    el.hidden = false;
    el.classList.remove('bt-in', 'bt-banded');
    // the end of a battle: a slanted band with VICTORY / DEFEAT sweeps across first (it starts once
    // this sheet's build has had its frames), then the sheet rises as the band's exit ends; the band
    // never catches taps, the sheet takes them from its first visible frame
    const word = !first ? null : card.classList.contains('bt-win') ? 'VICTORY' : card.classList.contains('bt-lose') ? (ctx.endedRun ? 'RUN OVER' : 'DEFEAT') : null;
    const band = word ? resultBand(el, word, { tone: card.classList.contains('bt-win') ? 'win' : 'lose' }) : null;
    if (band) {
      el.classList.add('bt-banded');
      band.then(() => {
        if (card.parentNode === el) el.classList.remove('bt-banded');
      });
    }
    void el.offsetWidth;
    el.classList.add('bt-in');
    /** resolves once the sheet is up (after the band, when one plays) */
    return Promise.resolve(band).catch(() => {});
  }

  return {
    el,
    apply,
    showVictory,
    showDefeat,
    showRewards,
    showFreeplay,
    showSandbox,
    showTitan,
    /** Solo Keep going: the battle goes on, so the next end applies (and shows) its own result. */
    reset() {
      applied = false;
      outcome = null;
      el.hidden = true;
      el.replaceChildren();
    },
    get outcome() {
      return outcome;
    },
    get open() {
      return !el.hidden;
    },
    destroy() {
      el.remove();
    },
  };
}
