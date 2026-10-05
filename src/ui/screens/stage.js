// Stage preparation (owner: meta-a). Route: #/stage/<id>?difficulty=normal[&endless=1]
// Map preview, wave info, enemy scouting chips, recommended counters with one-tap
// "Add to formation", formation strip, difficulty picker with medals, drop table,
// first-clear rewards, Start and Sweep.
//
// Also exports small shared building blocks used by the other meta-a screens
// (campaign, bounty, assault, challenge): medal rows, drop lists, enemy chips, the
// rewards modal and the formation helpers.
import '../styles/meta-a.css';
import { h, clear, screen, panel, button, modal, toast, svgEl, itemTile, unitCard } from '../components.js';
import { navigate, buildHash, currentRoute } from '../router.js';
import { store } from '../../core/store.js';
import { createRng } from '../../core/rng.js';
import { formatNumber, formatPct } from '../../core/util.js';
import { STAGE_MAP, CHAPTERS, stageEnemies } from '../../data/stages.js';
import { getMap } from '../../data/maps.js';
import { ENEMY_MAP, FAMILIES, enemyTraits } from '../../data/enemies.js';
import { UNIT_MAP, unitsWithCapability, hasCapability } from '../../data/units.js';
import { getItem } from '../../data/items.js';
import {
  DIFFICULTIES, DIFFICULTY_ORDER, CAPABILITIES, TRAITS, MAP_TIERS, BATTLE, ITEM_RARITIES, ARMOR_CLASSES, UNIT_RARITIES,
} from '../../data/types.js';
import { stageThumbSVG } from '../../art/stageThumb.js';
import { medalIcon, traitIcon, capabilityIcon, uiIcon, gearIcon, armorClassIcon } from '../../art/icons.js';
import { stageMedals, isStageUnlocked, recommendedFor, isOwned } from '../../systems/unlocks.js';
import { canSweep, sweep, MAX_SWEEPS } from '../../systems/rewards.js';
import { currentEvent } from '../../systems/missions.js';
import { describeStat } from '../../systems/gear.js';

// ---------------------------------------------------------------------------
// Shared helpers (exported for the other meta-a screens)
// ---------------------------------------------------------------------------

/** Fresh UI-side rng (systems need one for drops / gacha). */
export function uiRng() {
  return createRng((Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0);
}

/** Set a CSS custom property (Object.assign on style ignores `--vars`). */
export function cssVar(el, name, value) {
  el.style.setProperty(name, value);
  return el;
}

const KIND_LABEL = { campaign: 'Mission', resource: 'Bounty', boss: 'Total Assault', challenge: 'Tactical Challenge' };

/** tile() with its rarity colour applied (custom properties need setProperty). */
export function tile(itemId, count = null, opts = {}) {
  const el = itemTile(itemId, count, opts);
  const color = ITEM_RARITIES[getItem(itemId)?.rarity]?.color;
  const t = el.classList.contains('item-tile') ? el : el.querySelector('.item-tile');
  if (color && t) cssVar(t, '--rarity', color);
  return el;
}

/** card() with its rarity colour applied. */
export function card(unitId, opts = {}) {
  const el = unitCard(unitId, opts);
  const color = UNIT_RARITIES[UNIT_MAP[unitId]?.rarity]?.color;
  if (color) cssVar(el, '--rarity', color);
  return el;
}

/** Row of reward tiles. */
export function rewardTiles(rewards, { size = 56 } = {}) {
  return h('div.reward-row', rewards.map((r) => tile(r.id, r.count, { size })));
}

/**
 * Update the current route's params in place (URL + the router's back stack) without
 * re-rendering, e.g. when a tab changes inside a screen.
 */
export function rememberParams(name, patch) {
  const route = currentRoute();
  if (route.name !== name || !route.params) return;
  Object.assign(route.params, patch);
  try {
    history.replaceState(null, '', buildHash(name, route.params));
  } catch {
    /* not in a browser */
  }
}

/** Short label like "Mission 1-3" / "Bounty" for a stage. */
export function stageLabel(stage) {
  if (!stage) return '';
  return stage.kind === 'campaign' ? `${KIND_LABEL.campaign} ${stage.id}` : KIND_LABEL[stage.kind];
}

/** "Clear 1-4 first" style requirement text (null when unlocked). */
export function requirementText(profile, stageId) {
  const stage = STAGE_MAP[stageId];
  if (!stage || isStageUnlocked(profile, stageId)) return null;
  const req = STAGE_MAP[stage.requires];
  return req ? `Clear ${req.kind === 'campaign' ? req.id : req.name} first` : 'Locked';
}

/** Row of the four difficulty medals (earned ones in colour). */
export function medalRow(profile, stageId, { size = 22, cls = '' } = {}) {
  const m = stageMedals(profile, stageId);
  const row = h(`div.ma-medals${cls ? `.${cls}` : ''}`, { title: DIFFICULTY_ORDER.map((d) => `${DIFFICULTIES[d].name}: ${m[d] ? 'cleared' : '—'}`).join(' · ') });
  for (const d of DIFFICULTY_ORDER) {
    const span = svgEl(medalIcon(d, { earned: m[d] }), `ma-medal${m[d] ? '.on' : ''}`);
    span.style.width = `${size}px`;
    span.style.height = `${size}px`;
    row.appendChild(span);
  }
  return row;
}

/** Tile for a GearInstance (rarity frame + slot icon + name). */
export function gearTile(gear, { size = 56 } = {}) {
  const rarity = ITEM_RARITIES[gear.rarity];
  const tile = h(
    'button.item-tile.ma-gear-tile',
    {
      style: { width: `${size}px` },
      title: `${gear.name} — ${describeStat(gear.main.stat, gear.main.value)}`,
      onclick: () => showGearInfo(gear),
    },
    svgEl(gearIcon(gear.slot, gear.rarity), 'item-tile-icon'),
  );
  cssVar(tile, '--rarity', rarity?.color || '#999');
  return tile;
}

function showGearInfo(gear) {
  const rarity = ITEM_RARITIES[gear.rarity];
  modal({
    title: 'Gear',
    body: h(
      'div.ma-gear-info',
      h('div.item-info-head', gearTile(gear, { size: 72 }), h('div', h('div.item-info-name', gear.name), h('span.rarity-badge', { style: { background: rarity?.color } }, rarity?.name), h('div.muted', `${gear.slot[0].toUpperCase()}${gear.slot.slice(1)} · Lv.${gear.level || 0}`))),
      h('div.ma-gear-main', describeStat(gear.main.stat, gear.main.value)),
      gear.subs?.length ? h('ul.ma-gear-subs', gear.subs.map((s) => h('li', describeStat(s.stat, s.value)))) : h('p.muted', 'No substats at this rarity.'),
      h('p.muted', 'Equip, enhance and reroll it from a student\'s Equipment tab or the Backpack.'),
    ),
    actions: [
      { label: 'Backpack', kind: 'ghost', onClick: (c) => { c(); navigate('backpack', { tab: 'equipment' }); } },
      { label: 'Close', kind: 'primary' },
    ],
  });
}

/**
 * Confirmation popup that resolves true/false (the shared confirmDialog resolves false
 * first because its onClose fires before the button handler resolves).
 * @returns {Promise<boolean>}
 */
export function ask(text, { title = 'Confirm', ok = 'Confirm', cancel = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    modal({
      title,
      body: typeof text === 'string' ? h('p', text) : text,
      actions: [
        { label: cancel, kind: 'ghost', onClick: (c) => { finish(false); c(); } },
        { label: ok, kind: danger ? 'danger' : 'yellow', testid: 'confirm-ok', onClick: (c) => { finish(true); c(); } },
      ],
      onClose: () => finish(false),
    });
  });
}

/** Rewards popup used after sweeps, purchases, claims. */
export function showRewardsModal({ title = 'Rewards', rewards = [], gear = [], note = null, extra = null, actions } = {}) {
  const body = h(
    'div.ma-rewards-modal',
    note ? h('p.muted', note) : null,
    rewards.length || gear.length
      ? h('div.ma-reward-grid', rewards.map((r) => tile(r.id, r.count, { size: 60, showName: true })), gear.map((g) => h('div.item-tile-wrap', gearTile(g, { size: 60 }), h('div.item-tile-name', g.name))))
      : h('p.empty', 'Nothing this time.'),
    extra,
  );
  const m = modal({ title, body, actions: actions || [{ label: 'OK', kind: 'yellow' }] });
  m.el.classList.add('ma-pop');
  return m;
}

/** Drop entries of a stage active at a difficulty (+ the ones gated behind harder difficulties). */
export function dropEntries(stage, difficulty) {
  const di = DIFFICULTY_ORDER.indexOf(difficulty);
  return (stage.drops || []).map((d) => ({
    ...d,
    active: !d.difficulty || DIFFICULTY_ORDER.indexOf(d.difficulty) <= di,
  }));
}

/** Grid of drop tiles with chance and count range. */
export function dropGrid(stage, difficulty, { dropMul = 1, compact = false } = {}) {
  const entries = dropEntries(stage, difficulty);
  // Merge duplicates (base roll + harder bonus roll) into one tile showing the best combined chance.
  const merged = new Map();
  for (const e of entries) {
    const cur = merged.get(e.item);
    if (!cur) merged.set(e.item, { item: e.item, rolls: [e] });
    else cur.rolls.push(e);
  }
  const grid = h(`div.ma-drops${compact ? '.compact' : ''}`);
  const rarityOrder = (id) => ITEM_RARITIES[getItem(id)?.rarity]?.order ?? 0;
  const list = [...merged.values()].sort((a, b) => {
    const aa = a.rolls.some((r) => r.active) ? 0 : 1;
    const bb = b.rolls.some((r) => r.active) ? 0 : 1;
    return aa - bb || rarityOrder(b.item) - rarityOrder(a.item);
  });
  for (const m of list) {
    const active = m.rolls.filter((r) => r.active);
    const chance = 1 - active.reduce((p, r) => p * (1 - r.chance), 1);
    const min = active.length ? Math.min(...active.map((r) => r.min)) : m.rolls[0].min;
    const max = active.length ? active.reduce((a, r) => a + r.max, 0) : m.rolls[0].max;
    const gated = m.rolls.filter((r) => !r.active);
    const isActive = active.length > 0;
    const range = min === max ? `×${formatNumber(min * dropMul)}` : `×${formatNumber(min * dropMul)}–${formatNumber(max * dropMul)}`;
    const label = isActive ? formatPct(chance, chance < 0.1 ? 1 : 0) : `${DIFFICULTIES[gated[0].difficulty].name}+`;
    grid.appendChild(
      h(
        `div.ma-drop${isActive ? '' : '.gated'}`,
        tile(m.item, null, { size: compact ? 48 : 56 }),
        h('div.ma-drop-chance', label),
        compact ? null : h('div.ma-drop-range', range),
        isActive && gated.length ? h('div.ma-drop-bonus', { title: `Extra roll on ${DIFFICULTIES[gated[0].difficulty].name}+` }, '+') : null,
      ),
    );
  }
  if (!list.length) grid.appendChild(h('p.muted', 'No drops.'));
  return grid;
}

const TIER_ORDER = { boss: 0, miniboss: 1, elite: 2, normal: 3 };

/** Enemy scouting chip (name, family colour, trait icons, New!). */
export function enemyChip(enemyId, { isNew = false, hpScale = 1, onClick } = {}) {
  const e = ENEMY_MAP[enemyId];
  if (!e) return null;
  const traits = enemyTraits(e);
  const tier = e.tier || 'normal';
  const chip = h(
    `button.ma-enemy.tier-${tier}`,
    { onclick: () => (onClick ? onClick(enemyId) : showEnemyInfo(enemyId, { hpScale })), 'data-enemy': enemyId },
    h('span.ma-enemy-dot'),
    h('span.ma-enemy-name', e.name),
    tier !== 'normal' ? h('span.ma-enemy-tier', tier === 'miniboss' ? 'MINIBOSS' : tier.toUpperCase()) : null,
    traits.length ? h('span.ma-enemy-traits', traits.slice(0, 3).map((t) => svgEl(traitIcon(t), 'ma-trait'))) : null,
    isNew ? h('span.badge-new', 'New!') : null,
  );
  cssVar(chip, '--fam', e.color || FAMILIES[e.family]?.color || '#888');
  return chip;
}

/** Enemy details popup (scouting; works before discovery). */
export function showEnemyInfo(enemyId, { hpScale = 1 } = {}) {
  const e = ENEMY_MAP[enemyId];
  if (!e) return;
  const traits = enemyTraits(e);
  const fam = FAMILIES[e.family];
  const discovered = !!store.profile.bestiary?.[enemyId]?.discovered;
  const body = h(
    'div.ma-enemy-info',
    h('div.row', h('span.chip', fam?.name || e.family), h('span.chip', svgEl(armorClassIcon(e.armorClass)), ARMOR_CLASSES[e.armorClass]?.name || e.armorClass), e.tier !== 'normal' ? h('span.chip.ma-chip-warn', e.tier) : null, discovered ? null : h('span.chip', 'Not yet in bestiary')),
    h('table.stat-table', h('tbody',
      h('tr', h('td', 'HP here'), h('td', formatNumber(Math.round(e.hp * hpScale)))),
      h('tr', h('td', 'Speed'), h('td', `${e.speed} tiles/s`)),
      e.armor ? h('tr', h('td', 'Armor'), h('td', String(e.armor))) : null,
      h('tr', h('td', 'Lives on leak'), h('td', e.tier === 'boss' ? 'All' : String(e.leak ?? (e.tier === 'miniboss' ? 25 : e.tier === 'elite' ? 5 : 1)))),
    )),
    traits.length
      ? h('ul.ma-trait-list', traits.map((t) => h('li', svgEl(traitIcon(t), 'ma-trait-lg'), h('div', h('b', TRAITS[t]?.name || t), h('div.muted', TRAITS[t]?.desc || '')))))
      : h('p.muted', 'Plain fodder — no special rule.'),
    e.phases?.length ? h('div', h('h4', 'Phases'), h('ol.ma-phases', e.phases.map((p) => h('li', h('b', `${Math.round(p.atHp * 100)}% HP — `), p.announce)))) : null,
    e.counters ? h('p.ma-counter-tip', svgEl(uiIcon('info'), 'ma-inline-icon'), e.counters) : null,
  );
  modal({ title: e.name, body, actions: [{ label: 'Bestiary', kind: 'ghost', onClick: (c) => { c(); navigate('bestiary', { id: enemyId }); } }, { label: 'Close', kind: 'primary' }] });
}

/** Units in the current formation (hero + towers). */
export function formationIds(profile) {
  const f = profile.formation || { hero: null, towers: [] };
  return [f.hero, ...(f.towers || [])].filter(Boolean);
}

/**
 * Put a unit into the formation. Heroes replace the hero slot; towers are appended,
 * or (when 8 towers are set) the player picks who to swap out.
 * @returns {Promise<boolean>} true when the formation changed
 */
export function addToFormation(unitId) {
  const p = store.profile;
  const u = UNIT_MAP[unitId];
  if (!u || !isOwned(p, unitId)) return Promise.resolve(false);
  p.formation ||= { hero: null, towers: [] };
  p.formation.towers ||= [];
  if (u.kind === 'hero') {
    if (p.formation.hero === unitId) return Promise.resolve(false);
    p.formation.hero = unitId;
    store.commit('formation');
    toast(`${u.name} leads the formation`, 'good');
    return Promise.resolve(true);
  }
  if (p.formation.towers.includes(unitId)) return Promise.resolve(false);
  if (p.formation.towers.length < BATTLE.maxTowers) {
    p.formation.towers.push(unitId);
    store.commit('formation');
    toast(`${u.name} joined the formation`, 'good');
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const grid = h('div.ma-swap-grid');
    const m = modal({
      title: `Swap in ${u.name}`,
      body: h('div', h('p.muted', 'The formation is full (8 girls). Tap the girl to send to the bench.'), grid),
      actions: [{ label: 'Cancel', kind: 'ghost', onClick: (c) => { c(); resolve(false); } }],
      onClose: () => resolve(false),
    });
    for (const id of p.formation.towers) {
      grid.appendChild(card(id, {
        variant: 'square',
        level: p.units[id]?.level,
        onClick: () => {
          const i = p.formation.towers.indexOf(id);
          p.formation.towers.splice(i, 1, unitId);
          store.commit('formation');
          toast(`${u.name} swapped in for ${UNIT_MAP[id].name}`, 'good');
          m.close();
          resolve(true);
        },
      }));
    }
  });
}

/** Where the player can get a unit they do not own yet (one short sentence). */
export function acquisitionHint(unit) {
  const a = unit.acquisition || {};
  if (a.type === 'free') return `Free after ${a.afterStage}`;
  if (a.type === 'starter') return 'Starter';
  return 'Recruit';
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const DIFF_SUMMARY = {
  easy: 'Forgiving: −15% HP, +10% coins',
  normal: 'Upgrades + right counters',
  hard: '+35% HP, faster, 50 lives',
  nightmare: '+75% HP, 1 life, no income',
};

export function render(root, params = {}) {
  const stage = STAGE_MAP[params.id];
  if (!stage) {
    const { el, body } = screen('Stage');
    body.appendChild(h('div.empty', 'This stage does not exist. ', button('Back to the map', { kind: 'primary', onClick: () => navigate('campaign') })));
    root.appendChild(el);
    return;
  }
  const endless = params.endless === '1' || params.endless === 1 || params.endless === true;
  const title = stage.kind === 'campaign' ? `${stage.id} ${stage.name}` : stage.name;
  const { el, body } = screen(endless ? `Endless · ${title}` : title, { cls: 'ma-stage-screen' });
  root.appendChild(el);

  const state = {
    difficulty: DIFFICULTIES[params.difficulty] ? params.difficulty : defaultDifficulty(store.profile, stage),
  };
  if (endless || stage.kind === 'challenge') state.difficulty = DIFFICULTIES[params.difficulty] ? params.difficulty : 'normal';

  const draw = () => {
    clear(body);
    body.appendChild(buildPrep(stage, state, { endless, redraw: draw }));
  };
  draw();
  const off = store.on('change', (e) => {
    if (e?.reason === 'formation' || e?.reason === 'replace') draw();
  });
  return () => off();
}

/** First difficulty without a medal (so the player is nudged up the ladder). */
function defaultDifficulty(profile, stage) {
  if (stage.kind === 'challenge') return 'normal';
  const m = stageMedals(profile, stage.id);
  if (!m.normal) return 'normal';
  if (!m.hard) return 'hard';
  if (!m.nightmare) return 'nightmare';
  return 'hard';
}

function buildPrep(stage, state, { endless, redraw }) {
  const profile = store.profile;
  const map = safeMap(stage.mapId);
  const unlocked = isStageUnlocked(profile, stage.id);
  const req = requirementText(profile, stage.id);
  const event = currentEvent();
  const dropMul = event.stageIds.includes(stage.id) ? event.dropMul : 1;
  const medals = stageMedals(profile, stage.id);
  const entry = profile.progress?.stages?.[stage.id];
  const isEndless = endless || stage.kind === 'challenge';

  const wrap = h('div.ma-prep');

  // ----- Left: map + info + enemies ------------------------------------------------
  const left = h('div.ma-prep-col.left');
  const tier = MAP_TIERS[stage.tier];
  const hero = h(
    'div.ma-prep-map',
    h('div.ma-prep-thumb', { html: map ? stageThumbSVG(map, { width: 480, height: 300 }) : '' }),
    h('div.ma-prep-map-top',
      tier ? h('span.ma-tier-badge', { style: { background: tier.color } }, tier.name) : null,
      dropMul > 1 ? h('span.ma-event-badge', `${dropMul}× drops`) : null,
      isEndless ? h('span.ma-endless-badge', 'Endless') : null,
    ),
    h('div.ma-prep-name',
      h('span.ma-prep-id', stage.kind === 'campaign' ? stage.id : stageLabel(stage)),
      h('span.ma-prep-title', stage.name),
    ),
    stage.kind !== 'challenge' && !endless ? medalRow(profile, stage.id, { size: 26, cls: 'ma-prep-medals' }) : null,
  );
  left.appendChild(hero);

  const chapter = stage.chapter ? CHAPTERS.find((c) => c.id === stage.chapter) : null;
  left.appendChild(panel(
    stageLabel(stage),
    h('p.ma-stage-desc', stage.desc),
    h('div.ma-facts',
      fact('Waves', isEndless ? '∞' : String(stage.waves)),
      fact('Lives', String(DIFFICULTIES[state.difficulty].lives)),
      fact('Start cash', formatNumber(Math.round(stage.startCash))),
      fact('Map', map?.name || stage.mapId),
      isEndless && entry?.bestWave ? fact('Best wave', String(entry.bestWave)) : null,
      !isEndless && entry?.clears ? fact('Clears', String(entry.clears)) : null,
    ),
    chapter ? h('p.muted.ma-mechanic', svgEl(uiIcon('info'), 'ma-inline-icon'), chapter.mechanic) : null,
  ));

  // Enemies
  const introduces = new Set(stage.introduces || []);
  const ids = stageEnemies(stage).filter((id) => ENEMY_MAP[id]);
  ids.sort((a, b) => (TIER_ORDER[ENEMY_MAP[a].tier] ?? 3) - (TIER_ORDER[ENEMY_MAP[b].tier] ?? 3) || Number(introduces.has(b)) - Number(introduces.has(a)));
  const newTraits = (stage.introduces || []).filter((k) => TRAITS[k]);
  left.appendChild(panel(
    'Enemies',
    newTraits.length ? h('div.ma-new-mech', h('span.badge-new', 'New mechanic'), newTraits.map((t) => h('span.ma-new-trait', svgEl(traitIcon(t), 'ma-trait'), h('b', TRAITS[t].name), h('span.muted', ` — ${TRAITS[t].desc}`)))) : null,
    h('div.ma-enemy-list', ids.map((id) => enemyChip(id, { isNew: introduces.has(id), hpScale: stage.hpScale * DIFFICULTIES[state.difficulty].hpMul }))),
    h('p.muted.ma-hint', 'Tap an enemy for HP, traits and counters.'),
  ));
  wrap.appendChild(left);

  // ----- Right: difficulty, counters, formation, drops, actions ------------------
  const right = h('div.ma-prep-col.right');

  if (!isEndless) right.appendChild(panel('Difficulty', difficultyPicker(stage, state, medals, redraw)));
  else if (endless) right.appendChild(panel('Endless mode', h('p', 'Waves keep coming after the map\'s last wave — survive as long as you can. Your best wave on this map is recorded. Medals are not awarded in endless runs.')));

  right.appendChild(countersPanel(stage));
  right.appendChild(formationPanel());

  const dropsPanel = panel(
    stage.kind === 'challenge' ? 'Rewards per run' : 'Drops',
    dropMul > 1 ? h('div.ma-event-note', h('span.ma-event-badge', `${dropMul}×`), `${event.name}: drop counts doubled this week.`) : null,
    endless ? h('p.muted', 'Endless runs pay coins for every wave survived instead of drops.') : dropGrid(stage, state.difficulty, { dropMul }),
  );
  right.appendChild(dropsPanel);

  if (!isEndless) right.appendChild(firstClearPanel(stage, medals));

  // Actions
  const formationOk = formationIds(profile).length > 0;
  const actions = h('div.ma-prep-actions');
  if (!unlocked) {
    actions.appendChild(h('div.ma-locked-note', svgEl(uiIcon('lock'), 'ma-inline-icon'), req));
    const reqStage = STAGE_MAP[stage.requires];
    if (reqStage) actions.appendChild(button(`Go to ${reqStage.kind === 'campaign' ? reqStage.id : reqStage.name}`, { kind: 'primary', icon: 'teleport', onClick: () => navigate('stage', { id: reqStage.id }) }));
  } else {
    if (!isEndless) actions.appendChild(sweepControls(stage, state));
    const start = button(isEndless ? 'Start endless' : `Start · ${DIFFICULTIES[state.difficulty].name}`, {
      kind: 'yellow',
      icon: 'play',
      testid: 'stage-start',
      disabled: !formationOk,
      onClick: () => {
        const p = { stage: stage.id, difficulty: state.difficulty };
        if (endless) p.endless = 1;
        navigate('battle', p);
      },
    });
    start.classList.add('ma-start-btn');
    if (!formationOk) actions.appendChild(h('div.ma-locked-note', 'Add at least one girl to your formation.'));
    actions.appendChild(start);
  }
  right.appendChild(actions);
  wrap.appendChild(right);
  return wrap;
}

function safeMap(id) {
  try {
    return getMap(id);
  } catch {
    return null;
  }
}

function fact(label, value) {
  return h('div.ma-fact', h('div.ma-fact-label', label), h('div.ma-fact-value', value));
}

function difficultyPicker(stage, state, medals, redraw) {
  const row = h('div.ma-diffs', { role: 'radiogroup' });
  for (const d of DIFFICULTY_ORDER) {
    const def = DIFFICULTIES[d];
    const b = h(
      `button.ma-diff.diff-${d}${state.difficulty === d ? '.active' : ''}`,
      {
        role: 'radio',
        'aria-checked': state.difficulty === d ? 'true' : 'false',
        'data-testid': `diff-${d}`,
        onclick: () => { state.difficulty = d; redraw(); },
      },
      svgEl(medalIcon(d, { earned: medals[d] }), 'ma-diff-medal'),
      h('span.ma-diff-name', def.name),
      h('span.ma-diff-sub', DIFF_SUMMARY[d]),
      medals[d] ? h('span.ma-diff-check', svgEl(uiIcon('check'))) : h('span.ma-diff-gems', `+${def.firstClearGems}`),
    );
    row.appendChild(b);
  }
  return row;
}

function countersPanel(stage) {
  const profile = store.profile;
  const rec = recommendedFor(profile, stage.id);
  const inForm = new Set(formationIds(profile));
  if (!rec.needs.length) {
    return panel('Recommended', h('p.muted', 'No special counters needed — a balanced formation with upgrades will do.'));
  }
  const list = h('div.ma-counters');
  let covered = 0;
  for (const cap of rec.needs) {
    const owners = rec.ownedCounters[cap] || [];
    const has = owners.some((id) => inForm.has(id));
    if (has) covered++;
    const status = has ? 'ok' : owners.length ? 'warn' : 'bad';
    const statusText = has ? 'In formation' : owners.length ? 'Not in formation' : 'No owned counter';
    const row = h(`div.ma-counter.${status}`,
      h('div.ma-counter-head',
        svgEl(capabilityIcon(cap), 'ma-cap-icon'),
        h('div.ma-counter-text', h('b', CAPABILITIES[cap]?.name || cap), h('div.muted', CAPABILITIES[cap]?.desc || '')),
        h(`span.ma-status.${status}`, statusText),
      ),
    );
    const units = h('div.ma-counter-units');
    if (owners.length) {
      for (const id of owners.slice(0, 6)) {
        const u = UNIT_MAP[id];
        const viaPath = !hasCapability(u, cap, { includePaths: false });
        const inF = inForm.has(id);
        units.appendChild(h(
          `div.ma-cu${inF ? '.in' : ''}`,
          card(id, { variant: 'square', level: profile.units[id]?.level, selected: inF, onClick: () => navigate('student', { id }) }),
          viaPath ? h('span.ma-cu-tag', 'via upgrade') : null,
          inF
            ? h('span.ma-cu-in', svgEl(uiIcon('check'), 'ma-inline-icon'), 'Ready')
            : button('Add', { kind: 'yellow', small: true, icon: 'plus', testid: `add-${id}`, onClick: () => addToFormation(id) }),
        ));
      }
    } else {
      const cands = unitsWithCapability(cap).slice(0, 4);
      units.appendChild(h('div.ma-counter-missing',
        h('span.muted', 'Who can help: '),
        cands.map((u) => h('button.chip.ma-cand', { onclick: () => navigate('student', { id: u.id }) }, u.name, h('span.muted', ` · ${acquisitionHint(u)}`))),
      ));
    }
    row.appendChild(units);
    list.appendChild(row);
  }
  return panel(
    'Recommended counters',
    h('div.ma-counter-summary', h('b', `${covered}/${rec.needs.length}`), ' needs covered by your formation'),
    list,
  );
}

function formationPanel() {
  const profile = store.profile;
  const f = profile.formation || { hero: null, towers: [] };
  const strip = h('div.ma-formation-strip');
  const heroSlot = f.hero
    ? h('div.ma-fslot.hero', card(f.hero, { variant: 'square', level: profile.units[f.hero]?.level, onClick: () => navigate('formation') }), h('span.ma-fslot-tag', 'Hero'))
    : h('button.ma-fslot.empty.hero', { onclick: () => navigate('formation') }, h('span', 'Hero'));
  strip.appendChild(heroSlot);
  for (let i = 0; i < BATTLE.maxTowers; i++) {
    const id = f.towers?.[i];
    strip.appendChild(id
      ? h('div.ma-fslot', card(id, { variant: 'square', level: profile.units[id]?.level, onClick: () => navigate('formation') }))
      : h('button.ma-fslot.empty', { onclick: () => navigate('formation'), title: 'Empty slot' }, svgEl(uiIcon('plus'), 'ma-inline-icon')));
  }
  return panel(
    'Formation',
    strip,
    h('div.ma-formation-foot', h('span.muted', `${(f.towers || []).length}/${BATTLE.maxTowers} girls${f.hero ? ' + hero' : ' · no hero'}`), button('Edit formation', { kind: 'ghost', small: true, icon: 'formation', onClick: () => navigate('formation') })),
  );
}

function firstClearPanel(stage, medals) {
  const cleared = DIFFICULTY_ORDER.some((d) => medals[d]);
  const medalGems = DIFFICULTY_ORDER.map((d) => h(
    `div.ma-fc-medal${medals[d] ? '.done' : ''}`,
    svgEl(medalIcon(d, { earned: medals[d] }), 'ma-fc-medal-icon'),
    h('span', medals[d] ? 'Claimed' : `+${DIFFICULTIES[d].firstClearGems}`),
  ));
  const unlocks = (stage.unlocks?.units || []).filter((id) => UNIT_MAP[id]);
  return panel(
    'First clear',
    h('div.ma-fc', h('div', h('div.ma-sub', cleared ? 'First clear — claimed' : 'First clear (any difficulty)'), h(`div.ma-fc-rewards${cleared ? '.done' : ''}`, rewardTiles(stage.firstClear || []))),
      h('div', h('div.ma-sub', 'Medal gems (once per difficulty)'), h('div.ma-fc-medals', medalGems))),
    unlocks.length
      ? h('div.ma-unlock-note', unlocks.map((id) => h('div.ma-unlock-unit', card(id, { variant: 'square', owned: isOwned(store.profile, id) }), h('div', h('b', `${UNIT_MAP[id].name} joins for free`), h('div.muted', UNIT_MAP[id].acquisition?.note || `Clear this stage to recruit ${UNIT_MAP[id].name}.`)))))
      : null,
  );
}

function sweepControls(stage, state) {
  const profile = store.profile;
  const allowed = canSweep(profile, stage.id);
  const medals = stageMedals(profile, stage.id);
  const best = Math.max(...DIFFICULTY_ORDER.map((d, i) => (medals[d] ? i : -1)));
  const okDiff = DIFFICULTY_ORDER.indexOf(state.difficulty) <= best;
  const box = h('div.ma-sweep');
  if (!allowed) {
    box.appendChild(h('div.ma-sweep-lock', svgEl(uiIcon('lock'), 'ma-inline-icon'), 'Sweep unlocks after a Hard clear'));
    return box;
  }
  const doSweep = (times) => {
    const r = sweep(profile, stage.id, state.difficulty, times, uiRng());
    if (!r.ok) {
      toast(r.error === 'difficulty' ? `Clear ${DIFFICULTIES[state.difficulty].name} first to sweep it` : 'Sweep is locked', 'bad');
      return;
    }
    store.commit('sweep');
    showRewardsModal({
      title: `Sweep ×${r.runs.length} · ${DIFFICULTIES[state.difficulty].name}`,
      rewards: r.rewards,
      gear: r.gear,
      note: `${stageLabel(stage)} · ${stage.name}`,
      actions: [
        { label: 'Sweep again', kind: 'ghost', onClick: (c) => { c(); doSweep(times); } },
        { label: 'OK', kind: 'yellow' },
      ],
    });
  };
  const lockTitle = okDiff ? undefined : `Clear ${DIFFICULTIES[state.difficulty].name} to sweep it`;
  box.appendChild(button('Sweep ×1', { kind: 'ghost', icon: 'ff', disabled: !okDiff, title: lockTitle, testid: 'sweep-1', onClick: () => doSweep(1) }));
  box.appendChild(button(`Sweep ×${MAX_SWEEPS}`, { kind: 'primary', icon: 'ff2', disabled: !okDiff, title: lockTitle, testid: 'sweep-10', onClick: () => doSweep(MAX_SWEEPS) }));
  return box;
}
