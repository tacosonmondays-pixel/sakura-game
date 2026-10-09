// End of battle: victory / defeat modal (applies the result once with a seeded rng and
// persists via store.commit), then the rewards view: medal, first-clear gems, item tiles,
// gear cards, unlocked girls (card art celebration) and new bestiary entries.
import { h, icon, setVar, enemyToken, enemyDef, fmtCoins, fmtTime } from './util.js';
import { svgEl, itemTile } from '../components.js';
import { store } from '../../core/store.js';
import { createRng, hashString } from '../../core/rng.js';
import { applyBattleResult } from '../../systems/rewards.js';
import { describeStat } from '../../systems/gear.js';
import { portraitHTML } from '../../art/portraits.js';
import { medalIcon, gearIcon, traitIcon } from '../../art/icons.js';
import { getItem } from '../../data/items.js';
import { getUnit } from '../../data/units.js';
import { ITEM_RARITIES, DIFFICULTIES, GEAR_SLOTS, TRAITS } from '../../data/types.js';
import { FAMILIES } from '../../data/enemies.js';
import { followingStage } from './setup.js';

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

/** Drawn stand of the MVP beside the victory sheet with a speech bubble (BA results style). */
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
function practiceNote() {
  return h('p.muted.bt-practice-note', { 'data-testid': 'practice-note' }, 'Practice run — this stage is still locked on your map, so nothing was saved: no clear, medal, drops or unlocks.');
}

/**
 * @param {object} ctx battle context
 */
export function createResults(ctx) {
  const { sim, stage } = ctx;
  let outcome = null;
  let applied = false;
  const el = h('div.bt-overlay.bt-result-overlay', { 'data-testid': 'result' });
  el.hidden = true;
  ctx.layer.append(el);

  /** Applies the battle result exactly once and persists it. */
  function apply() {
    if (applied) return outcome;
    applied = true;
    const result = sim.result();
    const rng = createRng(hashString(`${stage.id}:${sim.difficulty}:${sim.seed}:${Date.now()}`));
    try {
      outcome = applyBattleResult(store.profile, result, rng, { now: new Date() });
    } catch (e) {
      console.error('[battle] applyBattleResult failed', e);
      outcome = { firstClear: false, newMedal: false, medal: null, rewards: [], gear: [], unlockedUnits: [], discovered: [], gemsEarned: 0, error: true };
    }
    store.commit('battle-result');
    store.saveNow();
    ctx.onResultApplied?.(outcome);
    return outcome;
  }

  function actions(won) {
    const next = won ? followingStage(stage.id) : null;
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
    const items = [
      ['Waves', Number.isFinite(sim.totalWaves) ? `${r.wavesCleared}/${sim.totalWaves}` : `${r.wavesCleared}`],
      ['Lives', `${r.livesLeft}/${r.maxLives}`],
      ['Defeated', fmtCoins(Object.values(r.kills).reduce((a, b) => a + b, 0))],
      ['Time', fmtTime(r.stats.time)],
    ];
    return h('div.bt-summary', items.map(([k, v]) => h('div.bt-sum', h('span', k), h('b', v))));
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
      out.practice
        ? practiceNote()
        : h(
          'div.bt-medal-row',
          h(`div.bt-medal${out.newMedal ? '.new' : ''}`, svgEl(medalIcon(sim.difficulty), 'bt-medal-ico'), out.newMedal ? h('span.bt-medal-tag', 'New medal!') : h('span.bt-medal-tag.old', 'Medal owned')),
          out.firstClear ? h('div.bt-first', 'FIRST CLEAR') : null,
        ),
      summary(),
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
      h('div.bt-result-ribbon', 'DEFEAT'),
      h('div.bt-result-stage', `${stage.kind === 'campaign' ? `${stage.id} · ` : ''}${stage.name} — wave ${sim.wave}`),
      out.practice ? practiceNote() : null,
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
    if (out.practice) blocks.push(practiceNote());
    if (out.unlockedUnits.length) blocks.push(section('New student', h('div.bt-unlocks', out.unlockedUnits.map(unlockCard))));
    if (gems.length || out.firstClear) {
      blocks.push(section(
        out.firstClear ? 'First clear bonus' : 'Medal bonus',
        h('div.bt-tiles', gems.map((r) => rewardTile(r.id, r.count, 64)), out.firstClear && !gems.length ? h('p.muted', 'First clear!') : null),
      ));
    }
    if (!out.practice) {
      blocks.push(section(
        out.eventBonus ? 'Drops · event 2×' : 'Drops',
        others.length || out.gear.length
          ? h('div.bt-tiles', others.map((r) => rewardTile(r.id, r.count, 64)))
          : h('p.muted.bt-empty', 'No drops this time — harder difficulties roll more items.'),
      ));
    }
    if (out.gear.length) blocks.push(section('Gear', h('div.bt-gears', out.gear.map(gearCard))));
    if (out.discovered.length) blocks.push(section('Bestiary updated', discoveredRow(out.discovered)));
    const m = mvp();
    if (m) blocks.push(section('Top damage', m));
    const card = h(
      'div.bt-sheet.bt-result.bt-rewards',
      { 'data-testid': 'rewards' },
      h('div.bt-result-ribbon', 'REWARDS'),
      h('div.bt-medal-row.small', svgEl(medalIcon(sim.difficulty), 'bt-medal-ico'), h('span', out.practice ? `${DIFFICULTIES[sim.difficulty].name} practice run` : out.newMedal ? `${DIFFICULTIES[sim.difficulty].name} medal earned!` : `${DIFFICULTIES[sim.difficulty].name} cleared`)),
      h('div.bt-rewards-body', blocks),
      actions(true),
    );
    open(card);
  }

  function open(card, extra = null) {
    el.replaceChildren(...[extra, card].filter(Boolean));
    el.hidden = false;
    el.classList.remove('bt-in');
    void el.offsetWidth;
    el.classList.add('bt-in');
  }

  return {
    el,
    apply,
    showVictory,
    showDefeat,
    showRewards,
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
