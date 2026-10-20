// Stage preparation (owner: meta-a). Route: #/stage/<id>?difficulty=normal[&mode=rush][&freeplay=<tier>][&endless=1]
// Solo Freeplay: on a cleared campaign stage a Freeplay row (Off · Blossom · Tempest · Crimson
// Moon) turns the run into a freeplay run, with the best wave per tier. endless=1 (the Tactical
// Challenge cards, the old endless runs) opens the same prep with freeplay on.
// Battle modes (docs/specs/CODEX_MODES.md): picked next to the difficulty once the stage is cleared;
// a mode and freeplay exclude each other (freeplay runs in Standard in v1).
// Map preview, wave info, enemy scouting chips, recommended counters with one-tap
// "Add to formation", formation strip, difficulty picker with medals, drop table,
// first-clear rewards, Start and Sweep. [events] An event stage offers only its own difficulties; one still
// locked there (Nightmare before its Normal / Hard medal) shows a lock and "Clear Hard first" but can be picked
// to look at its waves and rewards (Start stays off); a difficulty with its own waves (the Golem's Nightmare,
// src/data/events/wire.js eventBattleStage) shows that stage's waves, enemies, HP and start cash.
// With a saved battle (Save & quit, src/systems/battleSave.js)
// Start becomes Continue · Wave N/M and New game (which asks before deleting the save); with a
// Freeplay tier picked, New game is a Freeplay start beside Continue instead (freeplay runs are
// never saved, so the saved battle stays). Continue always plays the save as it was saved.
//
// Also exports small shared building blocks used by the other meta-a screens
// (campaign, bounty, assault, challenge): medal rows, drop lists, enemy chips, the
// rewards modal and the formation helpers.
import '../styles/meta-a.css';
import { h, clear, screen, panel, button, modal, toast, svgEl, itemTile, unitCard, confirmDialog } from '../components.js';
import { navigate, rememberParams } from '../router.js';
import { store } from '../../core/store.js';
import { createRng } from '../../core/rng.js';
import { formatNumber, formatPct } from '../../core/util.js';
import { STAGE_MAP, CHAPTERS, stageEnemies } from '../../data/stages.js';
import { getMap } from '../../data/maps.js';
import { ENEMY_MAP, FAMILIES, enemyTraits } from '../../data/enemies.js';
import { UNIT_MAP, unitsWithCapability, hasCapability } from '../../data/units.js';
import { getItem } from '../../data/items.js';
import {
  DIFFICULTIES, DIFFICULTY_ORDER, CAPABILITIES, TRAITS, MAP_TIERS, BATTLE, ITEM_RARITIES, ARMOR_CLASSES,
} from '../../data/types.js';
import { stageThumbSVG } from '../../art/stageThumb.js';
import { medalIcon, traitIcon, capabilityIcon, uiIcon, gearIcon, armorClassIcon } from '../../art/icons.js';
import { stageMedals, isStageUnlocked, recommendedFor, isOwned, canPlayEndless } from '../../systems/unlocks.js';
import { canSweep, sweep, MAX_SWEEPS } from '../../systems/rewards.js';
import { currentEvent } from '../../systems/missions.js';
import { describeStat } from '../../systems/gear.js';
import {
  initialMode, playMode, startLabel, livesFor, modeSubLine, ribbonCorner, firstClearNote, rulePanel, modePanel, withRuleMarks,
} from './stageModes.js';
import { FREEPLAY_TIERS, freeplayTable, freeplayTier } from '../../data/freeplay.js';
import { hasSoloFreeplay } from '../../data/freeplaySolo.js';
import { soloBestLines } from '../../systems/freeplayRewards.js';
import { TIER_PITCH, freeplaySummary } from '../freeplayText.js';
import { lastSoloTier, rememberSoloTier } from '../battle/soloFreeplay.js';
import { rarityInfo } from '../rarity.js';
import { modeId } from '../../data/modes.js';
import { modeText } from '../text/modes.js';
import {
  getBattleSave, slotKey, saveSummary, clearBattleSave, saveToEvict, savesByWorth, saveTitle, MAX_BATTLE_SAVES, runStartedAt,
} from '../../systems/battleSave.js';
import { portraitHTML } from '../../art/portraits.js';
import { eventStageStatus, eventPhase, phaseLabel, eventRunGate, eventDifficultyStatus } from '../../systems/events.js';
import { eventOfStage } from '../../data/events/index.js';
import { eventBattleStage } from '../../data/events/wire.js';
import { eventNow } from '../events/clock.js';

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

const KIND_LABEL = { campaign: 'Mission', resource: 'Bounty', boss: 'Total Assault', challenge: 'Tactical Challenge', event: 'Event' };

/** tile() with its rarity colour applied (custom properties need setProperty). */
export function tile(itemId, count = null, opts = {}) {
  const el = itemTile(itemId, count, opts);
  const color = ITEM_RARITIES[getItem(itemId)?.rarity]?.color;
  const t = el.classList.contains('item-tile') ? el : el.querySelector('.item-tile');
  if (color && t) cssVar(t, '--rarity', color);
  return el;
}

/** card() with its rarity colour applied (the rarity unitCard shows: UR for a fully awakened SSR). */
export function card(unitId, opts = {}) {
  const el = unitCard(unitId, opts);
  if (el.dataset.rarity) cssVar(el, '--rarity', rarityInfo(el.dataset.rarity).color);
  return el;
}

/** Row of reward tiles. */
export function rewardTiles(rewards, { size = 56 } = {}) {
  return h('div.reward-row', rewards.map((r) => tile(r.id, r.count, { size })));
}

/** (moved to the router; kept here for the screens that import it from stage prep) */
export { rememberParams };

/** Short label like "Mission 1-3" / "Bounty" for a stage. */
export function stageLabel(stage) {
  if (!stage) return '';
  return stage.kind === 'campaign' ? `${KIND_LABEL.campaign} ${stage.id}` : KIND_LABEL[stage.kind];
}

/** Name of a saved battle's stage for prep, badges and the lobby: "Mission 1-3", "Endless 2-4", "Library Courtyard II". */
export function savedStageLabel(rec) {
  return saveTitle(rec).name;
}

/** "Hard · wave 5 of 14 · 2 h ago" / "wave 31 · 1 d ago" (with the mode first where the name lacks it). */
export function savedDetail(rec, { ago = true } = {}) {
  const sum = saveSummary(rec);
  const { mode } = saveTitle(rec);
  return [
    mode,
    sum.endless ? null : DIFFICULTIES[sum.difficulty].name,
    savedModeName(rec),
    sum.endless ? `wave\u00a0${sum.next}` : `wave\u00a0${sum.next}\u00a0of\u00a0${sum.of}`,
    ago ? sum.ago.replace(/ /g, '\u00a0') : null,
  ].filter(Boolean).join(' · ');
}

/**
 * "Saved battles full": the player picks which saved battle makes room for a new one (the one
 * with the least play is picked first; endless runs come last). Resolves the chosen record, or
 * null on Cancel. Nothing is deleted here: the battle deletes it when it first saves (`evict`).
 * @returns {Promise<object|null>}
 */
export function pickSaveToReplace(profile) {
  const list = savesByWorth(profile);
  return new Promise((resolve) => {
    let picked = list[0] || null;
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    const rows = h('div.ma-evict-list', { role: 'radiogroup' });
    const paint = () => {
      for (const b of rows.children) {
        const on = b.dataset.id === picked?.id;
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
      }
    };
    for (const rec of list) {
      rows.appendChild(h('button.ma-evict-row', { role: 'radio', 'data-id': rec.id, 'data-testid': `evict-${rec.slot}`, onclick: () => { picked = rec; paint(); } },
        h('span.ma-evict-dot'),
        h('span.ma-evict-text', h('b', savedStageLabel(rec)), h('small', savedDetail(rec)))));
    }
    paint();
    modal({
      title: 'Saved battles full',
      body: h('div.ma-evict', h('p', `You can keep ${MAX_BATTLE_SAVES} saved battles. Pick the one to delete so this new battle can be saved:`), rows,
        h('p.muted.ma-evict-note', 'It is deleted once this battle saves for the first time (when you place a girl or start a wave).')),
      actions: [
        { label: 'Cancel', kind: 'ghost', testid: 'evict-cancel', onClick: (c) => { finish(null); c(); } },
        { label: 'Delete & start', kind: 'danger', icon: 'play', testid: 'evict-start', onClick: (c) => { finish(picked); c(); } },
      ],
      onClose: () => finish(null),
    }).el.classList.add('ma-evict-modal');
  });
}

/**
 * "Saved · W12" badge for a stage card with a saved battle (null without one).
 * @param {object} profile
 * @param {string} stageId
 * @param {boolean} [endless] the endless run on that map
 */
export function savedBadge(profile, stageId, endless = false) {
  const rec = getBattleSave(profile, slotKey(stageId, endless));
  if (!rec) return null;
  return h('span.ma-saved-badge', { 'data-testid': 'saved-badge', title: `Saved battle: ${savedDetail(rec)}. Continue it from the stage screen.` }, svgEl(uiIcon('play'), 'ma-saved-badge-ico'), `Saved · W${saveSummary(rec).next}`);
}

/** "Clear 1-4 first" style requirement text (null when unlocked). */
export function requirementText(profile, stageId) {
  const stage = STAGE_MAP[stageId];
  if (stage?.kind === 'event') {
    const st = eventStageStatus(profile, stageId, eventNow());
    return st.ok ? null : st.text;
  }
  if (!stage || isStageUnlocked(profile, stageId)) return null;
  const req = STAGE_MAP[stage.requires];
  return req ? `Clear ${req.kind === 'campaign' ? req.id : req.name} first` : 'Locked';
}

/** Row of the four difficulty medals (earned ones in colour). */
export function medalRow(profile, stageId, { size = 22, cls = '' } = {}) {
  const m = stageMedals(profile, stageId);
  const order = STAGE_MAP[stageId]?.difficulties || DIFFICULTY_ORDER; // [events] only the stage's own
  const row = h(`div.ma-medals${cls ? `.${cls}` : ''}`, { title: order.map((d) => `${DIFFICULTIES[d].name}: ${m[d] ? 'cleared' : '—'}`).join(' · ') });
  for (const d of order) {
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
 * Confirmation popup for the meta-a screens: the shared confirmDialog with a yellow OK button.
 * @returns {Promise<boolean>}
 */
export function ask(text, { title = 'Confirm', ok = 'Confirm', cancel = 'Cancel', danger = false } = {}) {
  return confirmDialog(text, { title, ok, cancel, danger, okKind: 'yellow' });
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
  // freeplay (and the old endless=1) on a map only where it is offered: cleared campaign maps
  const wantsEndless = params.endless === '1' || params.endless === 1 || params.endless === true;
  const fpOk = hasSoloFreeplay(stage.id) && canPlayEndless(store.profile, stage.id);
  const endless = wantsEndless && fpOk; // Tactical Challenge's map cards: freeplay prep, never Off
  const title = stage.kind === 'campaign' ? `${stage.id} ${stage.name}` : stage.name;
  const { el, body } = screen(endless ? `Freeplay · ${title}` : title, { cls: 'ma-stage-screen' });
  root.appendChild(el);

  const state = {
    difficulty: DIFFICULTIES[params.difficulty] ? params.difficulty : defaultDifficulty(store.profile, stage),
    freeplay: fpOk ? freeplayTier(params.freeplay) || (endless ? lastSoloTier() : null) : null,
  };
  if (endless || stage.kind === 'challenge') state.difficulty = DIFFICULTIES[params.difficulty] ? params.difficulty : 'normal';
  // [events] an event stage offers only its own difficulties (operations Normal / Nightmare, the boss Normal / Hard / Nightmare)
  if (stage.difficulties && !stage.difficulties.includes(state.difficulty)) state.difficulty = defaultDifficulty(store.profile, stage);
  // a saved battle here: the picker starts on its difficulty (it only changes the New game run).
  // One slot per stage: freeplay runs are never saved, and endless=1 on a campaign map is
  // Tactical Challenge's freeplay prep (the old endless runs there are freeplay now)
  const saved = getBattleSave(store.profile, slotKey(stage.id, stage.kind === 'challenge'));
  if (saved && DIFFICULTIES[saved.difficulty]) state.difficulty = saved.difficulty;
  // battle mode (docs/specs/CODEX_MODES.md §8.1): remembered in the route like the difficulty
  state.mode = initialMode(store.profile, stage, params, endless);

  const draw = () => {
    clear(body);
    body.appendChild(buildPrep(stage, state, { endless, redraw: draw }));
  };
  draw();
  // one column (portrait phones): a saved battle's Continue / New game moves to the top of the
  // page; turning the phone redraws it in place
  const mq = typeof matchMedia === 'function' ? matchMedia(ONE_COLUMN) : null;
  const onLayout = () => {
    if (getBattleSave(store.profile, slotKey(stage.id, stage.kind === 'challenge'))) draw();
  };
  mq?.addEventListener?.('change', onLayout);
  const off = store.on('change', (e) => {
    // 'sweep' adds clears: without it the Clears fact stayed stale until the stage was re-entered.
    // Redraw in place, keeping the page and column scroll (the Sweep bar is pinned at the bottom).
    if (e?.reason === 'formation' || e?.reason === 'sweep' || e?.reason === 'replace' || e?.reason === 'battle-save') {
      const scrolled = () => [body, ...body.querySelectorAll('.ma-prep-col')];
      const keep = scrolled().map((n) => n.scrollTop);
      draw();
      scrolled().forEach((n, i) => { n.scrollTop = keep[i] || 0; });
    }
  });
  return () => {
    off();
    mq?.removeEventListener?.('change', onLayout);
  };
}

/** Stage prep's one-column layout (portrait phones): see meta-a.css `.ma-prep`. */
const ONE_COLUMN = '(max-width: 699px)';
const oneColumn = () => typeof matchMedia === 'function' && matchMedia(ONE_COLUMN).matches;

/** First difficulty without a medal (so the player is nudged up the ladder). */
function defaultDifficulty(profile, stage) {
  if (stage.kind === 'challenge') return 'normal';
  const m = stageMedals(profile, stage.id);
  // [events] every medal held: an operation opens on its hardest (the best sweep), the boss on its first
  if (stage.difficulties) return stage.difficulties.find((d) => !m[d]) || (stage.kind === 'event' && !stage.boss ? stage.difficulties.at(-1) : stage.difficulties[0]);
  if (!m.normal) return 'normal';
  if (!m.hard) return 'hard';
  if (!m.nightmare) return 'nightmare';
  return 'hard';
}

function buildPrep(stage, state, { endless, redraw }) {
  const profile = store.profile;
  const map = safeMap(stage.mapId);
  const evStatus = stage.kind === 'event' ? eventStageStatus(profile, stage.id, eventNow()) : null;
  const unlocked = evStatus ? evStatus.ok : isStageUnlocked(profile, stage.id);
  const req = requirementText(profile, stage.id);
  const event = currentEvent();
  const dropMul = event.stageIds.includes(stage.id) ? event.dropMul : 1;
  const medals = stageMedals(profile, stage.id);
  const entry = profile.progress?.stages?.[stage.id];
  // [events] the stage this difficulty plays (its own waves, enemies, HP and coins: the Golem's Nightmare),
  // and whether that difficulty is open yet (Nightmare after the Normal / Hard medal)
  const played = (stage.kind === 'event' && eventBattleStage(stage.id, state.difficulty)) || stage;
  const diffGate = evStatus ? eventDifficultyStatus(profile, stage.id, state.difficulty) : { ok: true, text: '' };
  // only the colosseum is endless now; campaign maps play freeplay (state.freeplay)
  const isEndless = stage.kind === 'challenge';
  const fpOk = hasSoloFreeplay(stage.id) && unlocked;
  const fpOn = !!state.freeplay && canPlayEndless(profile, stage.id);

  const wrap = h('div.ma-prep');

  // ----- Left: map + info + enemies ------------------------------------------------
  const left = h('div.ma-prep-col.left');
  const tier = MAP_TIERS[played.tier];
  const thumb = h('div.ma-prep-thumb', { html: map ? withRuleMarks(stageThumbSVG(map, { width: 480, height: 300 }), map, stage.rule, 480, 300) : '' });
  // The thumb box is sized by CSS (landscape phones cap its height); the map fills it edge to edge.
  thumb.querySelector('svg')?.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  const hero = h(
    'div.ma-prep-map',
    thumb,
    h('div.ma-prep-map-top',
      tier ? h('span.ma-tier-badge', { style: { background: tier.color } }, tier.name) : null,
      dropMul > 1 ? h('span.ma-event-badge', `${dropMul}× drops`) : null,
      isEndless ? h('span.ma-endless-badge', 'Endless') : null,
      fpOn ? h(`span.ma-fp-badge.ma-fp-${state.freeplay}`, { 'data-testid': 'prep-fp-badge' }, `Freeplay · ${freeplayTable(state.freeplay).name}`) : null,
    ),
    h('div.ma-prep-name',
      h('span.ma-prep-id', stage.kind === 'campaign' ? stage.id : stageLabel(stage)),
      h('span.ma-prep-title', stage.name),
    ),
    stage.kind !== 'challenge' ? medalRow(profile, stage.id, { size: 26, cls: 'ma-prep-medals' }) : null,
  );
  left.appendChild(hero);

  const chapter = stage.chapter && stage.kind === 'campaign' ? CHAPTERS.find((c) => c.id === stage.chapter) : null;
  left.appendChild(panel(
    stageLabel(stage),
    h('p.ma-stage-desc', stage.desc),
    played.variant ? h('div.ma-variant', { 'data-testid': 'event-variant' }, h('b', `${DIFFICULTIES[played.variant.difficulty].name}: ${played.variant.name}`), h('span', played.variant.desc)) : null,
    h('div.ma-facts',
      fact('Waves', isEndless ? '∞' : fpOn ? `${stage.waves} + ∞` : String(played.waves)),
      fact('Lives', String(livesFor(state.difficulty, state.mode))),
      fact('Start cash', formatNumber(Math.round(played.startCash))),
      fact('Map', map?.name || stage.mapId),
      isEndless && entry?.bestWave ? fact('Best wave', String(entry.bestWave)) : null,
      !isEndless && entry?.clears ? fact('Clears', String(entry.clears)) : null,
    ),
    chapter ? h('p.muted.ma-mechanic', svgEl(uiIcon('info'), 'ma-inline-icon'), chapter.mechanic) : null,
  ));
  const rule = rulePanel(stage);
  if (rule) left.appendChild(rule);

  // Enemies
  const introduces = new Set(stage.introduces || []);
  const ids = stageEnemies(played).filter((id) => ENEMY_MAP[id]);
  ids.sort((a, b) => (TIER_ORDER[ENEMY_MAP[a].tier] ?? 3) - (TIER_ORDER[ENEMY_MAP[b].tier] ?? 3) || Number(introduces.has(b)) - Number(introduces.has(a)));
  const newTraits = (stage.introduces || []).filter((k) => TRAITS[k]);
  left.appendChild(panel(
    'Enemies',
    newTraits.length ? h('div.ma-new-mech', h('span.badge-new', 'New mechanic'), newTraits.map((t) => h('span.ma-new-trait', svgEl(traitIcon(t), 'ma-trait'), h('b', TRAITS[t].name), h('span.muted', ` — ${TRAITS[t].desc}`)))) : null,
    h('div.ma-enemy-list', ids.map((id) => enemyChip(id, { isNew: introduces.has(id), hpScale: played.hpScale * DIFFICULTIES[state.difficulty].hpMul }))),
    h('p.muted.ma-hint', 'Tap an enemy for HP, traits and counters.'),
  ));
  wrap.appendChild(left);

  // ----- Right: difficulty, counters, formation, drops, actions ------------------
  const right = h('div.ma-prep-col.right');
  if (evStatus) right.appendChild(eventPrepPanel(stage, state));

  const rec = unlocked ? getBattleSave(profile, slotKey(stage.id, isEndless)) : null;
  // with a saved battle the picker only sets a new run's difficulty: the save's card says "Saved"
  if (!isEndless) right.appendChild(panel(rec ? (fpOn ? 'Freeplay difficulty' : 'New game difficulty') : 'Difficulty', difficultyPicker(stage, state, medals, redraw, rec ? rec.difficulty : null)));
  if (!isEndless && !endless && stage.kind === 'campaign') {
    // a mode turns freeplay off (freeplay runs in Standard in v1); with a saved battle it sets the
    // New game's mode only (Continue plays the saved run's own mode: the saved line names it)
    right.appendChild(modePanel(profile, stage, state, (m) => {
      state.mode = m;
      rememberParams('stage', { mode: m });
      if (m !== 'standard' && state.freeplay) {
        state.freeplay = null;
        rememberFreeplay(null);
      }
      redraw();
    }));
  }
  if (fpOk) right.appendChild(freeplayPanel(stage, state, { endless, redraw, saved: rec }));

  right.appendChild(countersPanel(stage));
  right.appendChild(formationPanel());

  const dropsPanel = panel(
    stage.kind === 'challenge' ? 'Rewards per run' : 'Drops',
    dropMul > 1 ? h('div.ma-event-note', h('span.ma-event-badge', `${dropMul}×`), `${event.name}: drop counts doubled this week.`) : null,
    dropGrid(stage, state.difficulty, { dropMul }),
    fpOn ? h('p.muted.ma-hint', 'Freeplay: these drop at the stage clear; past it, coins every wave and a freeplay cache every 25 waves.') : null,
  );
  right.appendChild(dropsPanel);

  if (!isEndless) right.appendChild(firstClearPanel(stage, medals, state.mode));
  // [events] a difficulty still locked here: it can be looked at, not started (or swept)
  const diffLock = diffGate.ok ? null : h('div.ma-locked-note', { 'data-testid': 'diff-locked-note' }, svgEl(uiIcon('lock'), 'ma-inline-icon'), `${DIFFICULTIES[state.difficulty].name}: ${diffGate.text}`);

  // Actions
  const formationOk = formationIds(profile).length > 0;
  const actions = h('div.ma-prep-actions');
  if (!unlocked) {
    actions.appendChild(h('div.ma-locked-note', svgEl(uiIcon('lock'), 'ma-inline-icon'), req));
    // [events] a battle saved while the operations were open still pays by its start time (EVENT_SPEC
    // §3.2): after the end its Continue stays (no New game), so the run can be finished
    const evSave = evStatus ? getBattleSave(profile, slotKey(stage.id, false)) : null;
    if (evSave && eventRunGate(profile, stage, runStartedAt(evSave)).ok) {
      const sum = saveSummary(evSave);
      actions.appendChild(savedLine(evSave));
      const cont = button(`Continue · Wave ${sum.next}/${sum.of}`, {
        kind: 'yellow',
        icon: 'play',
        testid: 'stage-continue',
        title: 'This battle started before the operations closed, so it still pays.',
        onClick: () => navigate('battle', { stage: stage.id, difficulty: evSave.difficulty, resume: evSave.id }),
      });
      cont.classList.add('ma-start-btn', 'ma-continue-btn');
      actions.appendChild(cont);
    }
    const reqStage = STAGE_MAP[stage.requires];
    if (evStatus) actions.appendChild(button('Back to the event', { kind: 'primary', icon: 'teleport', testid: 'stage-to-event', onClick: () => navigate('event', { id: stage.event, tab: evStatus.reason === 'episode' ? 'story' : 'stages' }) }));
    else if (reqStage) actions.appendChild(button(`Go to ${reqStage.kind === 'campaign' ? reqStage.id : reqStage.name}`, { kind: 'primary', icon: 'teleport', onClick: () => navigate('stage', { id: reqStage.id }) }));
  } else {
    if (rec) actions.appendChild(savedLine(rec));
    // (the "Sweep unlocks after a Hard clear" note waits while a saved battle needs the room)
    if (!isEndless && (!rec || canSweep(profile, stage.id))) actions.appendChild(sweepControls(stage, state));
    // a new run: Tactical Challenge's map cards keep endless=1 (the run belongs there), a picked
    // tier makes it a solo freeplay run (never saved: src/systems/battleSave.js isSavableRun)
    const newMode = isEndless || fpOn ? 'standard' : playMode(state.difficulty, state.mode);
    const battleParams = () => {
      const p = { stage: stage.id, difficulty: state.difficulty };
      if (newMode !== 'standard') p.mode = newMode;
      if (endless) p.endless = 1;
      if (fpOn) p.freeplay = state.freeplay;
      return p;
    };
    const fpName = fpOn ? freeplayTable(state.freeplay).name : null;
    if (rec) {
      // Continue works without a formation: the team is the one frozen in the save
      const sum = saveSummary(rec);
      const savedDiff = DIFFICULTIES[sum.difficulty].name;
      const newDiff = DIFFICULTIES[state.difficulty].name;
      let other;
      if (fpOn) {
        // a freeplay run is never saved: it starts beside the saved battle and leaves it as it is
        // ("FREEPLAY" over the tier, so Crimson Moon fits the half-width button on a phone)
        other = button(h('span.ma-fp-start-text', h('small', 'Freeplay'), h('b', fpName)), {
          kind: 'ghost',
          title: `Start · ${newDiff} · ${fpName} freeplay (your saved battle stays)`,
          testid: 'stage-start',
          disabled: !formationOk,
          onClick: () => navigate('battle', battleParams()),
        });
        other.classList.add('ma-fp-start-btn');
      } else {
        // "New game · Hard · Goblin Rush" (codex §8.1): the run the button starts, mode included
        const newLabel = isEndless ? 'New game' : newMode !== 'standard' ? `New game · ${newDiff} · ${modeText(newMode).name}` : `New game · ${newDiff}`;
        other = button(newLabel, {
          kind: 'ghost',
          title: newLabel,
          testid: 'stage-new',
          disabled: !formationOk || !diffGate.ok,
          onClick: async () => {
            const text = sum.endless
              ? `Start a new run on ${savedStageLabel(rec)}? Your saved run (wave ${sum.next}) will be deleted.`
              : `Start a new ${newDiff}${newMode !== 'standard' ? ` ${modeText(newMode).name}` : ''} battle on ${savedStageLabel(rec)}? Your saved ${savedDiff}${savedModeName(rec) ? ` ${savedModeName(rec)}` : ''} battle (wave ${sum.next} of ${sum.of}) will be deleted.`;
            const ok = await ask(text, { title: 'New game', ok: 'New game', cancel: 'Keep it', danger: true });
            if (!ok) return;
            clearBattleSave(store.profile, rec.slot, rec.id);
            store.commit('battle-save');
            store.saveNow();
            navigate('battle', battleParams());
          },
        });
      }
      other.classList.add('ma-new-btn');
      // Continue always plays the saved run as it was saved: its difficulty (the saved line and the
      // picker's "Saved" card say which) and its mode, whatever tier the Freeplay row has picked
      const cont = button(sum.endless ? `Continue · Wave ${sum.next}` : `Continue · Wave ${sum.next}/${sum.of}`, {
        kind: 'yellow',
        icon: 'play',
        testid: 'stage-continue',
        onClick: () => navigate('battle', { stage: stage.id, difficulty: rec.difficulty, resume: rec.id }),
      });
      cont.classList.add('ma-start-btn', 'ma-continue-btn');
      if (!formationOk) actions.appendChild(h('div.ma-locked-note', `${fpOn ? 'Freeplay' : 'New game'} needs at least one girl in your formation.`));
      if (diffLock) actions.appendChild(diffLock);
      actions.appendChild(h('div.ma-save-btns', other, cont));
      actions.classList.add('has-save');
    } else {
      const start = button(isEndless ? 'Start endless' : fpOn ? `Start · ${DIFFICULTIES[state.difficulty].name} · ${fpName}` : startLabel(state.difficulty, state.mode), {
        kind: 'yellow',
        icon: 'play',
        testid: 'stage-start',
        disabled: !formationOk || !diffGate.ok,
        onClick: async () => {
          // saved battles full: the player picks which one this battle replaces (nothing is
          // deleted until the new battle first saves; a freeplay run never saves, so never asks)
          const params = battleParams();
          if (!fpOn && saveToEvict(store.profile, slotKey(stage.id, isEndless))) {
            const victim = await pickSaveToReplace(store.profile);
            if (!victim) return;
            params.evict = victim.id;
          }
          navigate('battle', params);
        },
      });
      start.classList.add('ma-start-btn');
      if (!formationOk) actions.appendChild(h('div.ma-locked-note', 'Add at least one girl to your formation.'));
      if (diffLock) actions.appendChild(diffLock);
      actions.appendChild(start);
    }
  }
  // one column (portrait phones): a saved battle's choice leads the page instead of waiting
  // below both columns; otherwise the bar stays pinned at the bottom of the right column
  if (rec && oneColumn()) {
    actions.classList.add('ma-prep-actions-top');
    left.prepend(actions);
  } else right.appendChild(actions);
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

/** "Saved battle · Hard · wave 12 of 25 · ♥ 63 · 12 min ago" + the frozen team. */
/** The battle mode a saved run plays ("Goblin Rush"), or null for Standard (and saves from before modes). */
function savedModeName(rec) {
  const m = modeId(rec?.mode);
  return m === 'standard' ? null : modeText(m).name;
}

function savedLine(rec) {
  const sum = saveSummary(rec);
  // each part stays whole when the line wraps ("♥ 63", "12 min ago"); "Saved battle · Hard · Goblin Rush · …"
  const parts = sum.endless
    ? ['Saved run', `wave ${sum.next}`, `♥ ${sum.lives}`, sum.ago]
    : ['Saved battle', DIFFICULTIES[sum.difficulty].name, savedModeName(rec), `wave ${sum.next} of ${sum.of}`, `♥ ${sum.lives}`, sum.ago].filter(Boolean);
  const team = [rec.hero?.unitId, ...(rec.loadout || []).map((e) => e.unitId)].filter((id) => id && UNIT_MAP[id]);
  const note = 'Continues with the team you started with.';
  return h(
    'div.ma-saved',
    { 'data-testid': 'stage-saved', title: note },
    h('div.ma-saved-text', h('b', parts.flatMap((p, i) => [i ? ' · ' : null, h('span.ma-saved-seg', p)]).filter(Boolean)), h('small', note)),
    h('div.ma-saved-team', { 'aria-hidden': 'true', title: note }, team.slice(0, 9).map((id) => h('span.ma-saved-face', { html: portraitHTML(UNIT_MAP[id], 'thumb') }))),
  );
}

/** Keeps the freeplay pick in the URL (null removes it), so Retry / Quit come back to it. */
function rememberFreeplay(tier) {
  rememberParams('stage', { freeplay: tier || null });
}

/**
 * Solo Freeplay: Off · Blossom · Tempest · Crimson Moon (the co-op tiers), what freeplay brings on
 * this stage, the best wave per tier ("Best: wave 87 (Tempest)"), or how to unlock it. `saved`: this
 * stage's saved battle (a normal run), which a freeplay run leaves as it is.
 */
function freeplayPanel(stage, state, { endless, redraw, saved = null }) {
  const profile = store.profile;
  const cleared = canPlayEndless(profile, stage.id);
  const bests = soloBestLines(profile, stage.id);
  const bestBox = bests.length
    ? h('div.ma-fp-bests', { 'data-testid': 'prep-fp-best' }, bests.map((b) => h(`span.ma-fp-best.ma-fp-${b.tier}`, b.text)))
    : null;
  if (!cleared) {
    return panel('Freeplay', h('p.muted', { 'data-testid': 'prep-fp-locked' }, `Clear ${stage.id} once to start it in Freeplay — or tap Keep going on the victory screen to go past wave ${stage.waves}.`), bestBox);
  }
  const pick = (tier) => {
    state.freeplay = tier;
    if (tier) rememberSoloTier(tier);
    // freeplay runs in Standard (v1): turning it on sets the battle mode back to Standard
    if (tier && state.mode !== 'standard') {
      state.mode = 'standard';
      rememberParams('stage', { mode: 'standard' });
    }
    rememberFreeplay(tier);
    redraw();
  };
  const seg = h('div.ma-fp-seg', { role: 'radiogroup', 'data-testid': 'prep-freeplay' },
    endless ? null : h(`button.ma-fp-btn${!state.freeplay ? '.on' : ''}`, { type: 'button', role: 'radio', 'aria-checked': !state.freeplay ? 'true' : 'false', 'data-tier': 'off', onclick: () => pick(null) }, 'Off'),
    ...FREEPLAY_TIERS.map((id) => h(`button.ma-fp-btn.ma-fp-btn-${id}${state.freeplay === id ? '.on' : ''}`, {
      type: 'button', role: 'radio', 'aria-checked': state.freeplay === id ? 'true' : 'false', 'data-tier': id, 'data-testid': `prep-fp-${id}`, title: TIER_PITCH[id], onclick: () => pick(id),
    }, freeplayTable(id).name)));
  const t = freeplayTable(state.freeplay);
  return panel('Freeplay',
    seg,
    t
      ? h(`div.ma-fp-info.ma-fp-${t.id}`, { 'data-testid': 'prep-fp-info' },
        h('p', h('b', TIER_PITCH[t.id]), ' ', freeplaySummary(stage.id, t.id) || ''),
        h('p.muted', 'Rewards for the clear are saved at the last stage wave; past it you earn coins every wave, a cache every 25 waves and boss tokens. Finish any time from the pause menu.'),
        state.difficulty === 'nightmare' ? h('p.ma-fp-warn', '1 life — the first leak ends freeplay.') : null,
        saved ? h('p.muted', { 'data-testid': 'prep-fp-save-note' }, 'Freeplay runs aren\'t saved when you quit, so your saved battle here stays as it is.') : null)
      : h('p.muted', `Off: the battle ends at wave ${stage.waves}. You can still Keep going from the victory screen.`),
    bestBox);
}

function fact(label, value) {
  return h('div.ma-fact', h('div.ma-fact-label', label), h('div.ma-fact-value', value));
}

function difficultyPicker(stage, state, medals, redraw, savedDifficulty = null) {
  const row = h('div.ma-diffs', { role: 'radiogroup' });
  for (const d of stage.difficulties || DIFFICULTY_ORDER) {
    const def = DIFFICULTIES[d];
    // [events] still locked here (a lock and "Clear Hard first"; it can be picked to look at it), and a
    // difficulty with its own waves says what it is ("20 waves · two Golems · 1 life")
    const gate = stage.kind === 'event' ? eventDifficultyStatus(store.profile, stage.id, d) : null;
    const locked = !!gate && !gate.ok;
    const variant = stage.kind === 'event' ? eventBattleStage(stage.id, d)?.variant : null;
    const b = h(
      `button.ma-diff.diff-${d}${state.difficulty === d ? '.active' : ''}${locked ? '.locked' : ''}`,
      {
        role: 'radio',
        'aria-checked': state.difficulty === d ? 'true' : 'false',
        'data-testid': `diff-${d}`,
        ...(locked ? { 'data-locked': '1', title: `${def.name}: ${gate.text}` } : {}),
        // in the URL too: after a battle (Quit, the back gesture, Retry → Quit) prep comes back on it
        onclick: () => { state.difficulty = d; rememberParams('stage', { difficulty: d }); redraw(); },
      },
      svgEl(medalIcon(d, { earned: medals[d] }), 'ma-diff-medal'),
      h('span.ma-diff-name', def.name),
      locked
        ? h('span.ma-diff-sub', { 'data-testid': `diff-lock-${d}` }, svgEl(uiIcon('lock'), 'ma-diff-lock'), gate.text)
        : h('span.ma-diff-sub', modeSubLine(variant?.sub || DIFF_SUMMARY[d], d, state.mode)),
      ribbonCorner(store.profile, stage.id, d, state.mode)
        ?? (medals[d] ? h('span.ma-diff-check', svgEl(uiIcon('check'))) : h('span.ma-diff-gems', `+${def.firstClearGems}`)),
      savedDifficulty === d ? h('span.ma-diff-saved', { 'data-testid': 'diff-saved', title: 'Your saved battle plays this difficulty' }, 'Saved') : null,
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

function firstClearPanel(stage, medals, mode = 'standard') {
  const cleared = DIFFICULTY_ORDER.some((d) => medals[d]);
  // [events] only the difficulties the stage offers (an operation: Normal and Nightmare)
  const medalGems = (stage.kind === 'event' && stage.difficulties ? stage.difficulties : DIFFICULTY_ORDER).map((d) => h(
    `div.ma-fc-medal${medals[d] ? '.done' : ''}`,
    svgEl(medalIcon(d, { earned: medals[d] }), 'ma-fc-medal-icon'),
    h('span', medals[d] ? 'Claimed' : `+${DIFFICULTIES[d].firstClearGems}`),
  ));
  const unlocks = (stage.unlocks?.units || []).filter((id) => UNIT_MAP[id]);
  return panel(
    'First clear',
    h('div.ma-fc', h('div', h('div.ma-sub', cleared ? 'First clear — claimed' : 'First clear (any difficulty)'), h(`div.ma-fc-rewards${cleared ? '.done' : ''}`, rewardTiles(stage.firstClear || []))),
      h('div', h('div.ma-sub', 'Medal gems (once per difficulty)'), h('div.ma-fc-medals', medalGems), firstClearNote(mode))),
    unlocks.length
      ? h('div.ma-unlock-note', unlocks.map((id) => h('div.ma-unlock-unit', card(id, { variant: 'square', owned: isOwned(store.profile, id) }), h('div', h('b', `${UNIT_MAP[id].name} joins for free`), h('div.muted', UNIT_MAP[id].acquisition?.note || `Clear this stage to recruit ${UNIT_MAP[id].name}.`)))))
      : null,
  );
}

/** [events] The event line above the difficulty: which event, its countdown, the candy per win. */
function eventPrepPanel(stage, state) {
  const ev = eventOfStage(stage.id);
  const now = eventNow();
  const phase = eventPhase(ev, now, store.profile);
  const per = dropEntries(stage, state.difficulty).filter((e) => e.active && e.item === ev.currency.id).reduce((a, e) => a + e.min, 0);
  return h('section.panel.ev-prep', { 'data-testid': 'event-prep' },
    h('div.ev-prep-row',
      h('span.ev-chip', 'Event'),
      h('b.ev-prep-name', ev.name),
      h('span.ev-prep-time', phaseLabel(ev, phase, now)),
    ),
    phase === 'active'
      ? h('div.ev-prep-row', tile(ev.currency.id, null, { size: 32 }), h('span', `${ev.currency.name} ×${per} per win${stage.boss ? '' : ' · sweeps count'}`))
      : h('p.muted', 'This event\'s operations have ended — your rewards are yours to keep.'),
  );
}

function sweepControls(stage, state) {
  const profile = store.profile;
  const allowed = canSweep(profile, stage.id, eventNow());
  const medals = stageMedals(profile, stage.id);
  const best = Math.max(...DIFFICULTY_ORDER.map((d, i) => (medals[d] ? i : -1)));
  const okDiff = DIFFICULTY_ORDER.indexOf(state.difficulty) <= best;
  const box = h('div.ma-sweep');
  if (!allowed) {
    const lockText = stage.kind !== 'event' ? 'Sweep unlocks after a Hard clear' : stage.boss ? 'The boss cannot be swept' : 'Sweep unlocks after the first clear';
    box.appendChild(h('div.ma-sweep-lock', svgEl(uiIcon('lock'), 'ma-inline-icon'), lockText));
    return box;
  }
  const doSweep = (times) => {
    const r = sweep(profile, stage.id, state.difficulty, times, uiRng(), { now: new Date(eventNow()) });
    if (!r.ok) {
      toast(r.error === 'event' ? 'The event operations are closed' : r.error === 'difficulty' ? `Clear ${DIFFICULTIES[state.difficulty].name} first to sweep it` : 'Sweep is locked', 'bad');
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
