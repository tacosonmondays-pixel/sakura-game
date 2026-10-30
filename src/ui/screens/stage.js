// Stage preparation (owner: meta-a). Route: #/stage/<id>?difficulty=normal[&mode=rush][&freeplay=<tier>][&endless=1]
// UI v2 M1 (docs/specs/UI_V2_MENUS.md §5 M1, UI_DIRECTION.md §6.3): one screen in the Ink & Paper kit, no scroll at
// 844x390. The map band (map, name plate, tier sticker, the stage ink strip WAVES · ♥ LIVES · START, one mission
// sentence + "i"), the 2 × 2 difficulty grid with the rewards not earned yet, the selected difficulty's one rule
// sentence, the Mode chip, one Counters row, one Drops row, and the footer: Sweep ×1 / ×10 as secondary (or one lock
// line) beside Start · <Difficulty>, the screen's one yellow. Four kit sheets hold the rest: Counters (each need, the
// girls who cover it with one-tap Add, the formation), Drops (chances, quantity ranges, the first clear, medal gems),
// Mode (battle modes, docs/specs/CODEX_MODES.md, and Solo Freeplay: Off · Blossom · Tempest · Crimson Moon, with the
// best wave per tier; a mode and freeplay exclude each other, freeplay runs in Standard in v1) and "i" (the full
// mission text, the map rule, the enemies with scouting, map name and clears). endless=1 (the Tactical Challenge
// cards) opens the same prep with freeplay on.
// [events] An event stage offers only its own difficulties; one still locked there (Nightmare before its Normal /
// Hard medal) shows a lock and "Clear Hard first" but can be picked to look at its waves and rewards (Start stays
// off); a difficulty with its own waves (the Golem's Nightmare, src/data/events/wire.js eventBattleStage) shows that
// stage's waves, enemies, HP and start cash. The event line (which event, its countdown, the candy per win) sits
// under the strip.
// With a saved battle (Save & quit, src/systems/battleSave.js) the saved line takes the mission line's place and
// Start becomes Continue · Wave N/M beside New game (which asks before deleting the save); with a Freeplay tier
// picked, New game is a Freeplay start beside Continue instead (freeplay runs are never saved, so the saved battle
// stays). Continue always plays the save as it was saved.
//
// Also exports small shared building blocks used by the other meta-a screens
// (campaign, bounty, assault, challenge): medal rows, drop lists, enemy chips, the
// rewards modal and the formation helpers.
import '../styles/meta-a.css';
import '../styles/v2-stage.css';
import { h, clear, screen, button, modal, toast, svgEl, itemTile, unitCard, confirmDialog } from '../components.js';
import { navigate, rememberParams } from '../router.js';
import { store } from '../../core/store.js';
import { createRng } from '../../core/rng.js';
import { formatNumber, formatPct } from '../../core/util.js';
import { STAGE_MAP, CHAPTERS, stageEnemies, stageRequires } from '../../data/stages.js';
import { getMap } from '../../data/maps.js';
import { ENEMY_MAP, FAMILIES, enemyTraits } from '../../data/enemies.js';
import { UNIT_MAP, unitsWithCapability, hasCapability } from '../../data/units.js';
import { getItem } from '../../data/items.js';
import {
  DIFFICULTIES, DIFFICULTY_ORDER, CAPABILITIES, TRAITS, BATTLE, ITEM_RARITIES, ARMOR_CLASSES,
} from '../../data/types.js';
import { MAP_TIER_VIEW } from '../../data/mapTierNames.js';
import { stageThumbSVG } from '../../art/stageThumb.js';
import { medalIcon, traitIcon, capabilityIcon, uiIcon, gearIcon, armorClassIcon, modeIcon } from '../../art/icons.js';
import { ico, curArt, iconBtn, secondaryBtn, inkBtn, countdownChip, fillIn } from '../kit.js';
import { openSheet, closeSheets } from '../sheet.js';
import { fmtNum } from '../format.js';
import { lineGlyph } from '../lineGlyphs.js';
import { stageMedals, isStageUnlocked, isStageCleared, recommendedFor, isOwned, canPlayEndless } from '../../systems/unlocks.js';
import { canSweep, sweep, MAX_SWEEPS, medalGems as medalGemsFor } from '../../systems/rewards.js';
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
import { mechanicFor } from '../text/acts.js';
import {
  getBattleSave, slotKey, saveSummary, clearBattleSave, saveToEvict, savesByWorth, saveTitle, MAX_BATTLE_SAVES, runStartedAt,
} from '../../systems/battleSave.js';
import { portraitHTML } from '../../art/portraits.js';
import { eventStageStatus, eventPhase, phaseLabel, eventRunGate, eventDifficultyStatus, eventSweepsLeft, eventWindow } from '../../systems/events.js';
import { RESET, localResetHint } from '../../core/reset.js';
import { eventOfStage } from '../../data/events/index.js';
import { eventBattleStage } from '../../data/events/wire.js';
import { eventNow } from '../events/clock.js';
import { supportPanel, supportParam } from './stageSupport.js'; // [friend support]
import { supportAllowed } from '../../systems/friendSupport.js'; // [friend support] the Support row on prep
import { isFriendshipLive } from '../../systems/banners.js'; // [friend support] the row waits for the server's SQL
import { supportPick } from '../battle/supportPick.js';
import { wentOnline } from '../online/common.js';

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

const KIND_LABEL = { campaign: 'Mission', resource: 'Bounty', boss: 'Total Assault', challenge: 'Tactical Challenge', event: 'Event', side: 'Side' };

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

/** Short label like "Mission 1-3" / "Bounty" / "Side" for a stage. */
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

/**
 * The stages still blocking a locked stage, in its `requires` order (an Act II x-6 can need two); [] when it has none
 * left. Unknown ids are skipped.
 * @returns {object[]} StageDefs
 */
export function missingRequirements(profile, stageId) {
  return stageRequires(stageId).filter((id) => !isStageCleared(profile, id)).map((id) => STAGE_MAP[id]).filter(Boolean);
}

/** "Clear 1-4 first" style requirement text (null when unlocked); a two-key stage names what is still missing. */
export function requirementText(profile, stageId) {
  const stage = STAGE_MAP[stageId];
  if (stage?.kind === 'event') {
    const st = eventStageStatus(profile, stageId, eventNow());
    return st.ok ? null : st.text;
  }
  if (!stage || isStageUnlocked(profile, stageId)) return null;
  const missing = missingRequirements(profile, stageId);
  return missing.length ? `Clear ${missing.map((r) => (r.kind === 'campaign' ? r.id : r.name)).join(' and ')} first` : 'Locked';
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
      'data-tier': rarity ? gear.rarity : 'common',
      onclick: () => showGearInfo(gear),
    },
    svgEl(gearIcon(gear.slot, gear.rarity, { px: size }), 'item-tile-icon'),
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
    // the least it pays: every sure roll stacks (an event's guaranteed candy, base + its Nightmare roll); otherwise
    // the smallest roll that lands
    const sure = active.filter((r) => r.chance >= 1);
    const min = sure.length ? sure.reduce((a, r) => a + r.min, 0) : active.length ? Math.min(...active.map((r) => r.min)) : m.rolls[0].min;
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
// Screen (UI v2 M1: docs/specs/UI_DIRECTION.md §6.3, the stage prep after-board in the Ink & Paper kit)
// One screen, no scroll at 844x390: the map band on the left (the map with its name plate and tier sticker, the stage
// ink strip WAVES · ♥ LIVES · START, one mission sentence + "i"), the decision on the right (the 2 × 2 difficulty
// grid with the rewards not earned yet, the selected difficulty's one rule sentence and the Mode chip, one Counters
// row, one Drops row) and the footer (Sweep as secondary or one lock line, Start · <Difficulty> as the one yellow).
// Everything else sits one tap away in four kit sheets: Counters (each need, the girls who cover it, Add, the
// formation), Drops (percentages, quantity ranges, the first clear), Mode (battle modes and Freeplay, with their
// explainers and locks) and "i" (the full mission text, the map rule, the enemies, map name and clears).
// ---------------------------------------------------------------------------

/** The selected difficulty's one rule sentence: what the strip does not already say (it shows the lives). */
const DIFF_RULE = {
  easy: '−15% HP, +10% coins',
  normal: 'Upgrades + the right counters',
  hard: '+35% HP, faster enemies',
  nightmare: '+75% HP, no income',
};

/**
 * The battle screen's code, downloaded in idle time once stage prep is open (Start then has it at once).
 * Titan Trials (its own battle prep) calls it too.
 */
export function warmBattle() {
  const run = () => import('./battle.js').catch(() => {});
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 2000 });
  else setTimeout(run, 600);
}

/** A UI v2 line glyph the kit's ico() has no alias for yet (chevD, waves) as an inline icon. */
const lineIco = (name, cls = 'ui-ico') => ico(lineGlyph(name, '', { kitSize: false }), cls);

/**
 * The top bar's title (UI_DIRECTION 6.3 mock: "Campaign" over the map's "4-3 Shield Wall" plate): where the stage
 * lives (Campaign, Bounty, Total Assault, Tactical Challenge, the event's own name); the id and name are on the plate.
 */
function prepTitle(stage, endless) {
  if (endless) return 'Freeplay';
  if (stage.kind === 'campaign') return 'Campaign';
  if (stage.kind === 'event') return eventOfStage(stage.id)?.name || KIND_LABEL.event;
  return KIND_LABEL[stage.kind] || stage.name;
}

export function render(root, params = {}) {
  const stage = STAGE_MAP[params.id];
  if (stage) warmBattle();
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
  const { el, body } = screen(prepTitle(stage, endless), { cls: 'ma-stage-screen stp-screen' });
  root.appendChild(el);

  const state = {
    difficulty: DIFFICULTIES[params.difficulty] ? params.difficulty : defaultDifficulty(store.profile, stage),
    freeplay: fpOk ? freeplayTier(params.freeplay) || (endless ? lastSoloTier() : null) : null,
    sheet: null, // the open sheet: { kind, api }
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

  const ctx = { endless, redraw: null, openSheetOf: null };
  const draw = () => {
    clear(body);
    body.appendChild(buildPrep(stage, state, ctx));
    fitFooter(body);
    // an open sheet follows the screen (a mode picked in it, a girl added from it, a sweep)
    if (state.sheet) fillIn(state.sheet.api.body, sheetBody(stage, state, ctx, state.sheet.kind));
  };
  ctx.redraw = draw;
  ctx.openSheetOf = (kind) => {
    const def = SHEETS[kind];
    const api = openSheet({
      title: def.title(stage, state), body: sheetBody(stage, state, ctx, kind), testid: def.testid, cls: `stp-sheet.stp-sheet-${kind}`,
      onClose: () => { if (state.sheet?.api === api) state.sheet = null; },
    });
    state.sheet = { kind, api };
  };
  draw();
  const onResize = () => fitFooter(body);
  window.addEventListener('resize', onResize);
  // (the web fonts can widen the labels after the first draw)
  document.fonts?.ready?.then(() => { if (body.isConnected) fitFooter(body); });
  const off = store.on('change', (e) => {
    // 'sweep' adds clears, 'formation' an Add from the Counters sheet, 'battle-save' a New game: redraw in place
    if (e?.reason === 'formation' || e?.reason === 'sweep' || e?.reason === 'replace' || e?.reason === 'battle-save') draw();
  });
  return () => {
    off();
    window.removeEventListener('resize', onResize);
    closeSheets();
  };
}

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

/** Everything one draw of prep reads, worked out once (the screen and its sheets share it). */
function prepFacts(stage, state, { endless }) {
  const profile = store.profile;
  const evStatus = stage.kind === 'event' ? eventStageStatus(profile, stage.id, eventNow()) : null;
  const unlocked = evStatus ? evStatus.ok : isStageUnlocked(profile, stage.id);
  const event = currentEvent();
  const isEndless = stage.kind === 'challenge'; // only the colosseum is endless now; campaign maps play freeplay
  // [events] the stage this difficulty plays (its own waves, enemies, HP and coins: the Golem's Nightmare)
  const played = (stage.kind === 'event' && eventBattleStage(stage.id, state.difficulty)) || stage;
  const fpOn = !!state.freeplay && canPlayEndless(profile, stage.id);
  const rec = unlocked ? getBattleSave(profile, slotKey(stage.id, isEndless)) : null;
  return {
    profile,
    evStatus,
    unlocked,
    req: requirementText(profile, stage.id),
    event,
    dropMul: event.stageIds.includes(stage.id) ? event.dropMul : 1,
    medals: stageMedals(profile, stage.id),
    entry: profile.progress?.stages?.[stage.id],
    played,
    // [events] whether that difficulty is open yet (Nightmare after the Normal / Hard medal)
    diffGate: evStatus ? eventDifficultyStatus(profile, stage.id, state.difficulty) : { ok: true, text: '' },
    isEndless,
    fpOk: hasSoloFreeplay(stage.id) && unlocked,
    fpOn,
    fpName: fpOn ? freeplayTable(state.freeplay).name : null,
    rec,
    // battle modes and freeplay live behind the Mode chip (campaign maps; Tactical Challenge's freeplay prep: freeplay only)
    hasMode: !isEndless && stage.kind === 'campaign',
    endless,
  };
}

/**
 * [friend support] The Support row (BANNERS §E.1): the friend's girl picked for the next New game, or the offer; it opens
 * the Friend Support sheet (stageSupport.js supportPanel: the friends' Support Students, Refresh, the rules line). Shown
 * once the player has gone online (only then can a friend lend one), on the stages that take a Support Student.
 */
function supportRow(stage, state, ctx) {
  // (only while Friend Support is live on the server, the Friendship tab's own switch: a deploy that lands before the
  // friend support SQL shows no Support slot, supabase/migrations/20261028000000_friend_support.sql)
  if (!wentOnline() || !isFriendshipLive() || !supportAllowed(store.profile, stage, { difficulty: state.difficulty })) return null;
  const pick = supportParam(stage, state) ? supportPick() : null;
  const who = pick && UNIT_MAP[pick.unitId] ? `${UNIT_MAP[pick.unitId].name} · ${pick.name || 'a friend'}` : null;
  const open = () => {
    const body = supportPanel(stage, state);
    if (!body) return;
    // the row shows the pick made in the sheet once it closes
    openSheet({ title: 'Friend Support', body, testid: 'support-sheet', cls: 'stp-sheet.stp-sheet-support', onClose: () => { if (row.isConnected) ctx.redraw(); } });
  };
  const row = h('button.stp-row.stp-support', { type: 'button', 'data-testid': 'prep-support', 'aria-label': who ? `Friend Support: ${who}. Change` : 'Friend Support: borrow a friend\'s girl', onclick: open },
    h('span.lbl.stp-row-k', 'Support'),
    // (it takes the row's room and wraps to two lines before it would cut; it pushes the chevron to the row's end)
    h('span.stp-support-pick', who || 'Borrow a friend\'s girl'),
    ico('chevR', 'ui-ico.stp-chev'));
  return row;
}

function buildPrep(stage, state, ctx) {
  const f = prepFacts(stage, state, ctx);
  const right = rightColumn(stage, state, ctx, f);
  // [friend support] friends' Support Students (campaign, Bounty and solo Freeplay): a row at the foot of the map band,
  // whose map shrinks to make room (the right column is all flex: none and would push Start off a 390 px-tall phone)
  const sup = f.unlocked ? supportRow(stage, state, ctx) : null;
  return h('div.stp', { 'data-testid': 'stage-prep' }, mapBand(stage, state, ctx, f, sup), h('div.stp-right', right));
}

function safeMap(id) {
  try {
    return getMap(id);
  } catch {
    return null;
  }
}

// ----- the map band ------------------------------------------------------------------------------------------------

function mapBand(stage, state, ctx, f, supportEl = null) {
  const map = safeMap(stage.mapId);
  const tier = MAP_TIER_VIEW[f.played.tier];
  // the whole map, always: drawn at its own shape and fitted (never cropped) into the band, the edge's colour around
  // it when the band's shape differs (a short landscape band, the Support row taking height)
  const tw = 480;
  const th = map ? Math.round((tw * (map.height || 12)) / (map.width || 20)) : 300;
  const thumb = h('div.stp-thumb', { 'aria-hidden': 'true', html: map ? withRuleMarks(stageThumbSVG(map, { width: tw, height: th, ruined: stage.scenery?.ruined }), map, stage.rule, tw, th) : '' });
  const svg = thumb.querySelector('svg');
  svg?.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const edge = svg?.querySelector(':scope > rect')?.getAttribute('fill');
  const tags = [
    tier ? h('span.stp-tier', { style: { '--tier': tier.color }, title: `Map tier: ${tier.name}` }, tier.name) : null,
    f.dropMul > 1 ? h('span.ui-chip.cy.stp-tag', `${f.dropMul}× drops`) : null,
    f.isEndless ? h('span.ui-chip.ink.stp-tag', 'Endless') : null,
    f.fpOn ? h(`span.ui-chip.ink.stp-tag.stp-fp-${state.freeplay}`, { 'data-testid': 'prep-fp-badge' }, `Freeplay · ${f.fpName}`) : null,
  ].filter(Boolean);
  const mapEl = h('div.ui-panel.stp-map', { style: { '--map-ar': `${tw} / ${th}`, ...(edge ? { '--map-edge': edge } : {}) } }, thumb,
    tags.length ? h('div.stp-map-tags', tags) : null,
    h('div.stp-plate', stage.kind === 'campaign' ? h('span.num.stp-plate-id', stage.id) : null, h('span.stp-plate-name', stage.name)));

  const lives = f.fpOn || f.isEndless ? DIFFICULTIES[state.difficulty].lives : livesFor(state.difficulty, state.mode);
  const strip = h('div.ui-strip.stp-strip.ma-facts', { role: 'group', 'aria-label': 'Stage' },
    stripCell('Waves', f.isEndless ? '∞' : f.fpOn ? `${stage.waves}+∞` : String(f.played.waves), lineIco('waves')),
    stripCell('Lives', String(lives), ico('heart')),
    stripCell('Start', fmtNum(Math.round(f.played.startCash), 'money'), curArt('coins')));

  const infoBtn = iconBtn('info', { label: 'Mission, map rule and enemies', testid: 'prep-info', cls: 'stp-ibtn', onClick: () => ctx.openSheetOf('info') });
  // a saved battle takes the mission line's place (the "i" keeps the mission); an event its line above it
  const save = f.rec || eventSaveOf(stage, f);
  // ([events] the event line is the band's sentence there: the mission waits behind the "i" with the enemies)
  const line = save ? savedLine(save) : f.evStatus ? h('p.stp-mission.stp-mission-k', 'Mission, map and enemies') : h('p.stp-mission', missionLine(stage));
  return h('section.stp-band',
    mapEl,
    strip,
    h('div.stp-sweepslot', { hidden: true }),
    f.evStatus ? eventLine(stage, state) : null,
    h('div.stp-line', line, infoBtn),
    supportEl);
}

function stripCell(label, value, icon) {
  return h('div.ui-cell.ma-fact', h('span.lbl.ma-fact-label', icon, label), h('span.num.ma-fact-value', value));
}

/** The mission's first sentence (the "i" sheet has the rest). */
function missionLine(stage) {
  const d = String(stage.desc || '');
  return (d.match(/^.*?[.!?](?=\s|$)/) || [d])[0].trim();
}

/** [events] A battle saved while the operations were open still pays by its start time (EVENT_SPEC §3.2). */
function eventSaveOf(stage, f) {
  if (f.unlocked || !f.evStatus) return null;
  const s = getBattleSave(f.profile, slotKey(stage.id, false));
  return s && eventRunGate(f.profile, stage, runStartedAt(s)).ok ? s : null;
}

/** [events] The event line: which event, its countdown, the candy per win. */
function eventLine(stage, state) {
  const ev = eventOfStage(stage.id);
  const now = eventNow();
  const phase = eventPhase(ev, now, store.profile);
  const per = dropEntries(stage, state.difficulty).filter((e) => e.active && e.item === ev.currency.id).reduce((a, e) => a + e.min, 0);
  const w = eventWindow(ev);
  const clock = phase === 'active' ? countdownChip(w.endAt - now, { label: 'Ends', cls: 's', now: eventNow, testid: 'event-phase-chip' })
    : h('span.lbl', phaseLabel(ev, phase, now));
  return h('div.stp-event.ev-prep', { 'data-testid': 'event-prep' },
    h('div.stp-event-head', h('span.lbl.stp-event-k', 'Event'), clock),
    phase === 'active'
      ? h('div.stp-event-candy', h('span.stp-event-ico', staticTile(ev.currency.id, 28)), h('span', `${ev.currency.name} ×${per} per win${stage.boss ? '' : ' · sweeps count'}`))
      : h('p.stp-event-candy', 'The operations have ended: your rewards are yours to keep.'));
}

/**
 * A saved battle in two lines: "Saved · Hard" (+ its mode) with three faces of the frozen team beside it, then
 * "Wave 12 of 25 · ♥ 63 · 2 h ago". Separators sit inside a line, never at its ends.
 */
function savedLine(rec) {
  const sum = saveSummary(rec);
  const head = sum.endless ? 'Saved run' : ['Saved', DIFFICULTIES[sum.difficulty].name, savedModeName(rec)].filter(Boolean).join(' · ');
  const where = [sum.endless ? `Wave ${sum.next}` : `Wave ${sum.next} of ${sum.of}`, `♥ ${sum.lives}`, sum.ago];
  const team = [rec.hero?.unitId, ...(rec.loadout || []).map((e) => e.unitId)].filter((id) => id && UNIT_MAP[id]);
  const note = 'Continues with the team you started with.';
  return h('div.stp-saved', { 'data-testid': 'stage-saved', title: note },
    h('div.stp-saved-top', h('b.stp-saved-head', head),
      h('span.stp-saved-team', { 'aria-hidden': 'true' }, team.slice(0, 3).map((id) => h('span.stp-face', { html: portraitHTML(UNIT_MAP[id], 'thumb') })))),
    // (the dots between the parts are drawn by v2-stage.css, so a part that wraps never leaves one at a line's end)
    h('div.stp-saved-where', { 'aria-label': where.join(', ') }, where.map((t) => h('span', t))));
}

/** The battle mode a saved run plays ("Goblin Rush"), or null for Standard (and saves from before modes). */
function savedModeName(rec) {
  const m = modeId(rec?.mode);
  return m === 'standard' ? null : modeText(m).name;
}

/** An item tile drawn as a picture (inside a row that is itself the button: no button in a button). */
function staticTile(itemId, size) {
  const b = tile(itemId, null, { size });
  const s = h('span');
  s.className = b.className;
  s.setAttribute('style', b.getAttribute('style') || '');
  for (const [k, v] of Object.entries(b.dataset)) s.dataset[k] = v;
  s.innerHTML = b.innerHTML;
  return s;
}

// ----- the right column --------------------------------------------------------------------------------------------

function rightColumn(stage, state, ctx, f) {
  const out = [];
  if (!f.isEndless) out.push(difficultyPanel(stage, state, ctx, f));
  out.push(h('div.stp-rows', countersRow(stage, ctx), dropsRow(stage, state, ctx, f)));
  out.push(footer(stage, state, ctx, f));
  return out;
}

function difficultyPanel(stage, state, ctx, f) {
  const grid = h('div.stp-diffs', { role: 'radiogroup', 'aria-label': 'Difficulty' });
  const order = stage.difficulties || DIFFICULTY_ORDER;
  grid.dataset.n = String(order.length);
  for (const d of order) grid.appendChild(diffButton(stage, state, ctx, f, d));
  return h('section.ui-panel.stp-diff', grid, h('div.stp-ruleline', startBlock(state, f) || ruleSentence(stage, state, f), modeChip(stage, state, ctx, f)));
}

/** Why Start is off, in the rule sentence's place: a difficulty still locked, or an empty formation (null: it is not). */
function startBlock(state, f) {
  if (!f.unlocked) return null;
  if (!f.diffGate.ok) return h('p.stp-rule.stp-note.ma-locked-note', { 'data-testid': 'diff-locked-note' }, ico('lock'), `${DIFFICULTIES[state.difficulty].name}: ${f.diffGate.text}`);
  if (formationIds(f.profile).length) return null;
  return h('p.stp-rule.stp-note.ma-locked-note', { 'data-testid': 'formation-note' }, ico('lock'),
    f.rec ? `${f.fpOn ? 'Freeplay' : 'New game'} needs a girl in your formation` : 'Add a girl to your formation to start');
}

function diffButton(stage, state, ctx, f, d) {
  const def = DIFFICULTIES[d];
  // [events] still locked here (a lock and "Clear Hard first"; it can be picked to look at it)
  const gate = stage.kind === 'event' ? eventDifficultyStatus(f.profile, stage.id, d) : null;
  const locked = !!gate && !gate.ok;
  const on = state.difficulty === d;
  const earned = !!f.medals[d];
  // the corner: the lock, the ribbon state under a battle mode, or the medal gems while not earned (P7: an earned
  // reward is not shown again; the medal says it)
  const lockLine = locked ? h('span.ma-diff-sub.stp-d-lock', { 'data-testid': `diff-lock-${d}` }, ico('lock'), gate.text) : null;
  const corner = locked
    ? null
    : ribbonCorner(f.profile, stage.id, d, state.mode)
      ?? (earned ? null : h('span.ma-diff-gems.stp-d-gems', { title: `First ${def.name} clear: ${medalGemsFor(stage, d)} gems` }, curArt('gems'), h('span.num', String(medalGemsFor(stage, d)))));
  const savedHere = f.rec && f.rec.difficulty === d;
  return h(`button.ui-opt.ma-diff.stp-d.diff-${d}${on ? '.on.active' : ''}${locked ? '.locked' : ''}${earned ? '.earned' : ''}`, {
    type: 'button',
    role: 'radio',
    'aria-checked': on ? 'true' : 'false',
    'data-testid': `diff-${d}`,
    'aria-label': `${def.name}${earned ? ', cleared' : ''}${locked ? `, ${gate.text}` : ''}`,
    ...(locked ? { 'data-locked': '1', title: `${def.name}: ${gate.text}` } : {}),
    // in the URL too: after a battle (Quit, the back gesture, Retry → Quit) prep comes back on it
    onclick: () => { state.difficulty = d; rememberParams('stage', { difficulty: d }); ctx.redraw(); },
  },
  svgEl(medalIcon(d, { earned }), 'stp-d-medal'),
  h('span.stp-d-text', h('span.stp-d-name', def.name), lockLine),
  corner,
  savedHere ? h('span.ma-diff-saved.stp-d-saved', { 'data-testid': 'diff-saved', title: 'Your saved battle plays this difficulty' }, 'Saved') : null);
}

/** The selected difficulty's one sentence ([events] its own name and line when it has its own waves). */
function ruleSentence(stage, state, f) {
  const d = state.difficulty;
  const variant = stage.kind === 'event' ? f.played.variant : null;
  if (variant) {
    return h('p.stp-rule', { 'data-testid': 'event-variant', title: variant.desc },
      h('b', `${DIFFICULTIES[variant.difficulty].name}: ${variant.name}`), variant.sub ? ` · ${variant.sub}` : '');
  }
  if (f.fpOn) {
    return h('p.stp-rule', { 'data-testid': 'diff-rule' }, h('b', DIFFICULTIES[d].name), ` · ${d === 'nightmare' ? '1 life: the first leak ends freeplay' : DIFF_RULE[d]}`);
  }
  return h('p.stp-rule', { 'data-testid': 'diff-rule' }, h('b', DIFFICULTIES[d].name), ` · ${modeSubLine(DIFF_RULE[d], d, state.mode)}`);
}

/** The Mode chip: "Standard ▾", "Goblin Rush ▾", "Freeplay · Blossom ▾" (opens the Mode sheet). */
function modeChip(stage, state, ctx, f) {
  if (!f.hasMode && !(f.endless && f.fpOk)) return null;
  const name = f.fpOn ? f.fpName : modeText(state.mode).name;
  const icon = f.fpOn ? ico('sparkles', 'ui-ico.stp-mode-ico') : svgEl(modeIcon(state.mode), 'stp-mode-ico');
  return h('button.ui-hit.stp-modechip', { type: 'button', 'data-testid': 'prep-mode', 'aria-label': `${f.fpOn ? 'Freeplay' : 'Battle mode'}: ${name}. Change`, onclick: () => ctx.openSheetOf('mode') },
    h('span.ui-btn.sec.dense', icon, h('span.stp-mode-name', name), lineIco('chevD')));
}

function countersRow(stage, ctx) {
  const profile = store.profile;
  const rec = recommendedFor(profile, stage.id);
  const inForm = new Set(formationIds(profile));
  const covered = rec.needs.filter((cap) => (rec.ownedCounters[cap] || []).some((id) => inForm.has(id))).length;
  const all = covered === rec.needs.length;
  return h(`button.stp-row.stp-counters${all ? '.ok' : '.short'}`, {
    type: 'button', 'data-testid': 'prep-counters', onclick: () => ctx.openSheetOf('counters'),
    'aria-label': rec.needs.length ? `Counters: ${covered} of ${rec.needs.length} covered by your formation` : 'Counters: none needed',
  },
  h('span.lbl.stp-row-k', 'Counters'),
  h('span.stp-needs', rec.needs.slice(0, 3).map((cap) => h(`span.stp-need${(rec.ownedCounters[cap] || []).some((id) => inForm.has(id)) ? '.ok' : ''}`, { title: CAPABILITIES[cap]?.name || cap },
    svgEl(capabilityIcon(cap), 'stp-need-ico'), h('span.stp-need-name', CAPABILITIES[cap]?.name || cap)))),
  rec.needs.length
    ? h('span.stp-cover', h('span.num', `${covered}/${rec.needs.length}`), ico(all ? 'check' : 'info', `ui-ico.stp-cover-ico${all ? '.ok' : ''}`))
    : h('span.stp-cover.none', 'Any team'),
  ico('chevR', 'ui-ico.stp-chev'));
}

/** The drop icons the row shows: the first-clear reward first (FIRST), then the stage's drops, at most 5. */
function dropIcons(stage, state, f) {
  const cleared = DIFFICULTY_ORDER.some((d) => f.medals[d]);
  const first = !cleared && !f.isEndless ? (stage.firstClear || []).map((r) => ({ id: r.id, first: true })) : [];
  const rarity = (id) => ITEM_RARITIES[getItem(id)?.rarity]?.order ?? 0;
  const seen = new Set(first.map((x) => x.id));
  const drops = [];
  for (const e of dropEntries(stage, state.difficulty)) {
    if (!e.active || seen.has(e.item)) continue;
    seen.add(e.item);
    drops.push({ id: e.item, first: false });
  }
  drops.sort((a, b) => rarity(b.id) - rarity(a.id));
  return [...first.slice(0, 1), ...drops].slice(0, 5);
}

function dropsRow(stage, state, ctx, f) {
  const icons = dropIcons(stage, state, f);
  const unlocks = DIFFICULTY_ORDER.some((d) => f.medals[d]) ? [] : (stage.unlocks?.units || []).filter((id) => UNIT_MAP[id]);
  // the first clear's reward (a girl who joins, else the first-clear item) in its own group with FIRST beside it
  const firstPic = unlocks.length
    ? h('span.stp-drop.stp-drop-girl', { title: `${UNIT_MAP[unlocks[0]].name} joins on the first clear` }, h('span.stp-face', { html: portraitHTML(UNIT_MAP[unlocks[0]], 'thumb') }))
    : icons[0]?.first ? h('span.stp-drop', staticTile(icons[0].id, 40)) : null;
  const rest = icons.filter((x) => !x.first).slice(0, firstPic ? 3 : 5);
  return h('button.stp-row.stp-drops', { type: 'button', 'data-testid': 'prep-drops', 'aria-label': 'Drops: chances and amounts', onclick: () => ctx.openSheetOf('drops') },
    h('span.lbl.stp-row-k', stage.kind === 'challenge' ? 'Rewards' : 'Drops'),
    h('span.stp-drop-list', { 'aria-hidden': 'true' },
      firstPic ? h('span.stp-firstgrp', h('span.ui-sticker.stp-first', 'First'), firstPic) : null,
      rest.map((x) => h('span.stp-drop', staticTile(x.id, 40)))),
    ico('chevR', 'ui-ico.stp-chev'));
}

// ----- the footer: Sweep (secondary) · Start (the one yellow) ------------------------------------------------------

function footer(stage, state, ctx, f) {
  const profile = f.profile;
  const left = h('div.stp-foot-l');
  const right = h('div.stp-foot-r');
  const formationOk = formationIds(profile).length > 0;

  if (!f.unlocked) {
    left.appendChild(h('span.stp-note.ma-locked-note', ico('lock'), f.req));
    const evSave = eventSaveOf(stage, f);
    if (evSave) {
      const sum = saveSummary(evSave);
      right.appendChild(primary(`Continue · Wave ${sum.next}/${sum.of}`, {
        testid: 'stage-continue', title: 'This battle started before the operations closed, so it still pays.',
        onClick: () => navigate('battle', { stage: stage.id, difficulty: evSave.difficulty, resume: evSave.id }),
      }));
    }
    const reqStage = missingRequirements(profile, stage.id)[0] || null; // (the first one still to clear)
    const go = f.evStatus
      ? { label: 'Back to the event', testid: 'stage-to-event', onClick: () => navigate('event', { id: stage.event, tab: f.evStatus.reason === 'episode' ? 'story' : 'stages' }) }
      : reqStage ? { label: `Go to ${reqStage.kind === 'campaign' ? reqStage.id : reqStage.name}`, testid: 'stage-go-req', onClick: () => navigate('stage', { id: reqStage.id }) } : null;
    if (go) right.appendChild(evSave ? secondaryBtn(go.label, { icon: 'teleport', testid: go.testid, onClick: go.onClick }) : primary(go.label, { icon: 'teleport', testid: go.testid, onClick: go.onClick }));
    return h('div.stp-foot', left, right);
  }

  const rec = f.rec;
  // a new run: Tactical Challenge's map cards keep endless=1 (the run belongs there), a picked tier makes it a solo
  // freeplay run (never saved: src/systems/battleSave.js isSavableRun)
  const newMode = f.isEndless || f.fpOn ? 'standard' : playMode(state.difficulty, state.mode);
  const battleParams = () => {
    const p = { stage: stage.id, difficulty: state.difficulty };
    if (newMode !== 'standard') p.mode = newMode;
    if (f.endless) p.endless = 1;
    if (f.fpOn) p.freeplay = state.freeplay;
    const owner = supportParam(stage, state); // [friend support] the friend's girl picked on the Support row
    if (owner) p.sup = owner;
    return p;
  };
  const newDiff = DIFFICULTIES[state.difficulty].name;

  // the left: Sweep (secondary) or the one line saying how sweep opens (why Start is off: the rule line, startBlock).
  // fitFooter() makes the sweeps compact, or moves them under the strip, when the actions leave them no room.
  // (beside a saved battle's two actions, Sweep ×10 alone: ×1 makes room for New game and Continue)
  if (!f.isEndless) left.append(...sweepControls(stage, state, { many: !f.rec }));

  if (rec) {
    // Continue works without a formation: the team is the one frozen in the save. Continue always plays the saved run as
    // it was saved: its difficulty (the saved line and the grid's "Saved" say which) and its mode
    const sum = saveSummary(rec);
    const savedDiff = DIFFICULTIES[sum.difficulty].name;
    let other;
    if (f.fpOn) {
      // a freeplay run is never saved: it starts beside the saved battle and leaves it as it is (the chip says Freeplay)
      other = secondaryBtn(f.fpName, {
        icon: 'play', testid: 'stage-start', disabled: !formationOk,
        title: `Start · ${newDiff} · ${f.fpName} freeplay (your saved battle stays)`,
        onClick: () => navigate('battle', battleParams()),
      });
    } else {
      const full = f.isEndless ? 'New game' : newMode !== 'standard' ? `New game · ${newDiff} · ${modeText(newMode).name}` : `New game · ${newDiff}`;
      other = secondaryBtn('New game', {
        testid: 'stage-new', disabled: !formationOk || !f.diffGate.ok, title: full,
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
    right.append(other, primary(sum.endless ? `Continue · Wave ${sum.next}` : `Continue · Wave ${sum.next}/${sum.of}`, {
      testid: 'stage-continue',
      onClick: () => navigate('battle', { stage: stage.id, difficulty: rec.difficulty, resume: rec.id }),
    }));
    return h('div.stp-foot.has-save', left, right);
  }

  right.appendChild(primary(f.isEndless ? 'Start endless' : f.fpOn ? `Start · ${newDiff} · ${f.fpName}` : startLabel(state.difficulty, state.mode), {
    testid: 'stage-start',
    disabled: !formationOk || !f.diffGate.ok,
    onClick: async () => {
      // saved battles full: the player picks which one this battle replaces (nothing is deleted until the new battle
      // first saves; a freeplay run never saves, so never asks)
      const params = battleParams();
      if (!f.fpOn && saveToEvict(store.profile, slotKey(stage.id, f.isEndless))) {
        const victim = await pickSaveToReplace(store.profile);
        if (!victim) return;
        params.evict = victim.id;
      }
      navigate('battle', params);
    },
  }));
  return h('div.stp-foot', left, right);
}

/** The screen's one yellow: Start / Continue (a play glyph and the label; room for a cost after it). */
function primary(label, { testid, onClick, disabled = false, title = null, icon = 'play' }) {
  return h('button.ui-btn.pri.stp-start.ma-start-btn', { type: 'button', 'data-testid': testid, disabled, title: title || label, onclick: onClick },
    ico(icon), h('span.btn-label', label));
}

function sweepControls(stage, state, { many = true } = {}) {
  const profile = store.profile;
  const allowed = canSweep(profile, stage.id, eventNow());
  const medals = stageMedals(profile, stage.id);
  const best = Math.max(...DIFFICULTY_ORDER.map((d, i) => (medals[d] ? i : -1)));
  const okDiff = DIFFICULTY_ORDER.indexOf(state.difficulty) <= best;
  if (!allowed) {
    const lockText = stage.kind !== 'event' ? 'Sweep: clear on Hard' : stage.boss ? 'The boss cannot be swept' : 'Sweep: clear it once';
    return [h('span.stp-note.stp-sweep-lock', ico('lock'), lockText)];
  }
  // [events] the event's daily sweeps (all its stages together): what's left is on the button; none → refill time
  const refill = `Sweeps refill at ${RESET.label}`;
  const refillTitle = () => { const hint = localResetHint(eventNow()); return hint ? `${refill} (${hint})` : refill; };
  const doSweep = (times) => {
    const r = sweep(profile, stage.id, state.difficulty, times, uiRng(), { now: new Date(eventNow()) });
    if (!r.ok) {
      toast(r.error === 'event' ? 'The event operations are closed' : r.error === 'limit' ? refill : r.error === 'difficulty' ? `Clear ${DIFFICULTIES[state.difficulty].name} first to sweep it` : 'Sweep is locked', 'bad');
      return;
    }
    store.commit('sweep');
    const evLeft = r.sweepsLeft;
    showRewardsModal({
      title: `Sweep ×${r.runs.length} · ${DIFFICULTIES[state.difficulty].name}`,
      rewards: r.rewards,
      gear: r.gear,
      note: `${stageLabel(stage)} · ${stage.name}${evLeft == null ? '' : evLeft > 0 ? ` · ${evLeft} left today` : ` · ${refill}`}`,
      actions: [
        evLeft === 0 ? null : { label: 'Sweep again', kind: 'ghost', onClick: (c) => { c(); doSweep(times); } },
        { label: 'OK', kind: 'yellow' },
      ].filter(Boolean),
    });
  };
  // (×1 only while it differs from the main button: at 1 left that one is "Sweep ×1", at 0 it is the refill time)
  const left = stage.kind === 'event' ? eventSweepsLeft(profile, stage.event, eventNow()).left : null;
  const out = left === 0;
  const lockTitle = out ? refillTitle() : okDiff ? undefined : `Clear ${DIFFICULTIES[state.difficulty].name} to sweep it`;
  const manyLabel = left == null ? `Sweep ×${MAX_SWEEPS}` : out ? refill : `Sweep ×${Math.min(MAX_SWEEPS, left)} · ${left} left today`;
  const btns = [];
  if (many && (left == null || left > 1)) btns.push(sweepLabel(secondaryBtn('Sweep ×1', { icon: 'ff', disabled: !okDiff, title: lockTitle || 'Sweep ×1', testid: 'sweep-1', onClick: () => doSweep(1), cls: 'stp-sweep' })));
  btns.push(sweepLabel(secondaryBtn(manyLabel, { icon: 'ff2', disabled: !okDiff || out, title: lockTitle || manyLabel, testid: 'sweep-10', onClick: () => doSweep(MAX_SWEEPS), cls: 'stp-sweep' })));
  return [h('div.stp-sweeps', { role: 'group', 'aria-label': 'Sweep' }, btns)];
}

/**
 * Splits a sweep button's label so its compact form ("×10") can fold the word and the daily count away; the text
 * stays whole for screen readers and tests ("Sweep ×10 · 10 left today").
 */
function sweepLabel(btn) {
  const b = btn.matches?.('button') ? btn : btn.querySelector('button');
  const lab = b?.querySelector('.btn-label');
  const m = /^Sweep (×\d+)(.*)$/.exec(lab?.textContent || '');
  if (m) {
    lab.replaceChildren(...[h('span.stp-sw-word', 'Sweep '), m[1], m[2] ? h('span.stp-sw-more', m[2]) : null].filter(Boolean));
    b.setAttribute('aria-label', `Sweep ${m[1]}${m[2]}`);
  }
  return btn;
}

/**
 * The footer never lets the sweeps run under Start. Folds, in order, until the left side fits: both sweeps with their
 * words; Sweep ×10 alone (×1 folds away first); "×10" alone; then the sweeps (or the line saying how sweep opens) move
 * under the stage strip, where the map gives up the height. Run after every draw and on resize.
 */
function fitFooter(scope) {
  const home = scope.querySelector('.stp-foot-l');
  const slot = scope.querySelector('.stp-sweepslot');
  const item = scope.querySelector('.stp-sweeps, .stp-sweep-lock');
  if (!item || !home || !slot) return;
  item.classList.remove('solo', 'compact');
  if (item.parentElement !== home) home.prepend(item);
  slot.hidden = true;
  // (by layout widths: a skewed button's corners poke a few px past its box, which is no overflow)
  const fits = () => {
    const kids = item.matches('.stp-sweeps') ? [...item.children].filter((k) => k.offsetWidth) : [item];
    const need = kids.reduce((a, k) => a + k.offsetWidth, 0) + 6 * (kids.length - 1);
    return need <= home.clientWidth + 1;
  };
  if (fits()) return;
  if (item.matches('.stp-sweeps')) {
    if (item.querySelector('[data-testid="sweep-1"]')) {
      item.classList.add('solo');
      if (fits()) return;
    }
    item.classList.add('compact');
    if (fits()) return;
    item.classList.remove('compact');
  }
  slot.append(item);
  slot.hidden = false;
}

// ----- the four sheets ---------------------------------------------------------------------------------------------

const SHEETS = {
  counters: { testid: 'counters-sheet', title: () => 'Counters' },
  drops: { testid: 'drops-sheet', title: (stage) => (stage.kind === 'challenge' ? 'Rewards per run' : 'Drops') },
  mode: { testid: 'mode-sheet', title: (stage) => (stage.kind === 'campaign' ? 'Mode & Freeplay' : 'Freeplay') },
  info: { testid: 'info-sheet', title: (stage) => stage.name },
};

function sheetBody(stage, state, ctx, kind) {
  const f = prepFacts(stage, state, ctx);
  if (kind === 'counters') return countersSheet(stage);
  if (kind === 'drops') return dropsSheet(stage, state, f);
  if (kind === 'mode') return modeSheet(stage, state, ctx, f);
  return infoSheet(stage, state, f);
}

/** A section of a sheet: a caps kicker over its body. */
const sec = (kicker, ...kids) => h('section.stp-sec', kicker ? h('h3.stp-sec-k', kicker) : null, ...kids);

function countersSheet(stage) {
  const profile = store.profile;
  const rec = recommendedFor(profile, stage.id);
  const inForm = new Set(formationIds(profile));
  const out = [];
  if (!rec.needs.length) out.push(h('p.stp-p', 'No special counters needed: a balanced formation with upgrades will do.'));
  else {
    const covered = rec.needs.filter((cap) => (rec.ownedCounters[cap] || []).some((id) => inForm.has(id))).length;
    out.push(h('p.stp-p', h('b.num', `${covered}/${rec.needs.length}`), ' needs covered by your formation'));
  }
  const list = h('div.stp-needlist');
  for (const cap of rec.needs) {
    const owners = rec.ownedCounters[cap] || [];
    const has = owners.some((id) => inForm.has(id));
    const status = has ? 'ok' : owners.length ? 'warn' : 'bad';
    const statusText = has ? 'In formation' : owners.length ? 'Not in formation' : 'No girl yet';
    const girls = owners.length
      ? h('div.stp-girls', owners.slice(0, 6).map((id) => {
        const u = UNIT_MAP[id];
        const inF = inForm.has(id);
        const viaPath = !hasCapability(u, cap, { includePaths: false });
        return h(`div.stp-cu${inF ? '.in' : ''}`,
          girlFace(id, { onClick: () => navigate('student', { id }), sel: inF, tag: viaPath ? 'via upgrade' : null }),
          inF ? h('span.stp-cu-in', ico('check'), 'Ready') : inkBtn('Add', { testid: `add-${id}`, onClick: () => addToFormation(id), cls: 'stp-add' }));
      }))
      : h('div.stp-cands', h('span.lbl', 'Who can help'),
        unitsWithCapability(cap).slice(0, 4).map((u) => h('button.ui-chip.stp-cand', { type: 'button', onclick: () => navigate('student', { id: u.id }) }, h('span', u.name), h('span.stp-cand-how', acquisitionHint(u)))));
    list.appendChild(h(`div.stp-needrow.${status}`,
      h('div.stp-needhead',
        svgEl(capabilityIcon(cap), 'stp-need-ico'),
        h('div.stp-needtext', h('b', CAPABILITIES[cap]?.name || cap), h('span.desc', CAPABILITIES[cap]?.desc || '')),
        h(`span.ui-chip.stp-status.${status}`, statusText)),
      girls));
  }
  out.push(list);
  out.push(formationSec());
  return out;
}

/** A girl's face as a kit tile (today's portraits; M3's girl tile takes over): her thumb, her name, LV. */
function girlFace(id, { onClick = null, sel = false, tag = null, hero = false } = {}) {
  const u = UNIT_MAP[id];
  const lv = store.profile.units[id]?.level;
  // (a tile, budgeted on its own: P3)
  return h(`button.stp-girl${sel ? '.sel' : ''}${hero ? '.hero' : ''}`, { type: 'button', title: tag ? `${u.name} (${tag})` : u.name, 'aria-pressed': sel ? 'true' : null, 'data-probe': 'tile', onclick: onClick },
    h('span.stp-girl-art', { html: portraitHTML(u, 'thumb') }),
    h('span.stp-girl-cap', h('span.stp-girl-name', u.name), lv ? h('span.stp-girl-lv', `LV ${lv}`) : null, tag ? h('span.stp-girl-tag', tag) : null));
}

function formationSec() {
  const profile = store.profile;
  const f = profile.formation || { hero: null, towers: [] };
  const slots = [];
  slots.push(f.hero ? girlFace(f.hero, { onClick: () => navigate('formation'), hero: true }) : h('button.stp-girl.empty', { type: 'button', onclick: () => navigate('formation') }, h('span.lbl', 'Hero')));
  for (let i = 0; i < BATTLE.maxTowers; i++) {
    const id = f.towers?.[i];
    slots.push(id ? girlFace(id, { onClick: () => navigate('formation') }) : h('button.stp-girl.empty', { type: 'button', 'aria-label': 'Empty slot', onclick: () => navigate('formation') }, ico('plus')));
  }
  return sec('Formation',
    h('div.stp-formation', slots),
    h('div.stp-sec-foot', h('span.lbl', `${(f.towers || []).length}/${BATTLE.maxTowers} girls${f.hero ? ' + hero' : ''}`),
      h('button.ui-btn.ghost.stp-edit', { type: 'button', onclick: () => navigate('formation') }, 'Edit formation', ico('chevR'))));
}

function dropsSheet(stage, state, f) {
  const out = [];
  if (f.dropMul > 1) out.push(h('p.stp-p.ma-event-note', h('span.ui-chip.cy', `${f.dropMul}×`), ` ${f.event.name}: drop counts doubled this week.`));
  out.push(sec(`${DIFFICULTIES[state.difficulty].name}${f.fpOn ? ` · ${f.fpName}` : ''}`, dropGrid(stage, state.difficulty, { dropMul: f.dropMul }),
    f.fpOn ? h('p.stp-p.desc', 'Freeplay: these drop at the stage clear; past it, coins every wave and a freeplay cache every 25 waves.') : null));
  if (!f.isEndless) {
    const cleared = DIFFICULTY_ORDER.some((d) => f.medals[d]);
    const order = stage.kind === 'event' && stage.difficulties ? stage.difficulties : DIFFICULTY_ORDER;
    const unlocks = (stage.unlocks?.units || []).filter((id) => UNIT_MAP[id]);
    out.push(sec('First clear',
      cleared ? h('p.stp-p.desc', 'Claimed.') : h('div.stp-fc', rewardTiles(stage.firstClear || [], { size: 64 }), h('span.desc', 'Any difficulty, once.')),
      !cleared && unlocks.length ? h('div.stp-unlocks', unlocks.map((id) => h('div.stp-unlock', girlFace(id, { onClick: () => navigate('student', { id }) }),
        h('div', h('b', `${UNIT_MAP[id].name} joins for free`), h('span.desc', UNIT_MAP[id].acquisition?.note || `Clear this stage to recruit ${UNIT_MAP[id].name}.`))))) : null));
    out.push(sec('Medal gems · once per difficulty',
      h('div.stp-medalgems', order.map((d) => h(`div.stp-mg${f.medals[d] ? '.done' : ''}`, { 'data-probe': 'tile' },
        svgEl(medalIcon(d, { earned: f.medals[d] }), 'stp-mg-medal'),
        h('span.stp-mg-name', DIFFICULTIES[d].name),
        f.medals[d] ? h('span.stp-mg-got', ico('check'), 'Claimed') : h('span.stp-mg-gems', curArt('gems'), h('span.num', String(medalGemsFor(stage, d))))))),
      firstClearNote(state.mode)));
  }
  return out;
}

function modeSheet(stage, state, ctx, f) {
  const out = [];
  // Freeplay first: on a short landscape screen the battle modes would push it out of sight
  if (f.fpOk || f.hasMode) out.push(freeplaySec(stage, state, { endless: f.endless, redraw: ctx.redraw, saved: f.rec }));
  if (f.hasMode && !f.endless) {
    out.push(modePanel(f.profile, stage, state, (m) => {
      state.mode = m;
      rememberParams('stage', { mode: m });
      // a mode turns freeplay off (freeplay runs in Standard in v1)
      if (m !== 'standard' && state.freeplay) {
        state.freeplay = null;
        rememberFreeplay(null);
      }
      ctx.redraw();
    }));
  }
  return out;
}

function infoSheet(stage, state, f) {
  const map = safeMap(stage.mapId);
  const chapter = stage.chapter && stage.kind === 'campaign' ? CHAPTERS.find((c) => c.id === stage.chapter) : null;
  const out = [];
  // the mission, then who comes (scouting comes before the details), the map rule, the map and the clears
  out.push(sec(stage.kind === 'campaign' ? 'Mission' : stageLabel(stage),
    h('p.stp-p', stage.desc),
    f.played.variant ? h('p.stp-p.stp-variant', h('b', `${DIFFICULTIES[f.played.variant.difficulty].name}: ${f.played.variant.name}`), ` ${f.played.variant.desc}`) : null,
    mechanicFor(chapter, stage) ? h('p.stp-p.desc.stp-mech', ico('info'), mechanicFor(chapter, stage)) : null));
  // the enemies (scouting): tap one for HP, traits and counters
  const introduces = new Set(stage.introduces || []);
  const ids = stageEnemies(f.played).filter((id) => ENEMY_MAP[id]);
  ids.sort((a, b) => (TIER_ORDER[ENEMY_MAP[a].tier] ?? 3) - (TIER_ORDER[ENEMY_MAP[b].tier] ?? 3) || Number(introduces.has(b)) - Number(introduces.has(a)));
  const newTraits = (stage.introduces || []).filter((k) => TRAITS[k]);
  out.push(sec('Enemies',
    newTraits.length ? h('div.stp-newmech', newTraits.map((t) => h('p.stp-p', svgEl(traitIcon(t), 'ma-trait'), h('b', ` ${TRAITS[t].name}`), h('span.desc', ` · new: ${TRAITS[t].desc}`)))) : null,
    h('div.stp-enemies.ma-enemy-list', ids.map((id) => enemyChip(id, { isNew: introduces.has(id), hpScale: f.played.hpScale * DIFFICULTIES[state.difficulty].hpMul }))),
    h('p.stp-p.desc', 'Tap an enemy for HP, traits and counters.')));
  const rule = rulePanel(stage);
  if (rule) out.push(rule);
  out.push(h('dl.stp-facts.ma-facts',
    infoFact('Map', map?.name || stage.mapId),
    f.isEndless && f.entry?.bestWave ? infoFact('Best wave', String(f.entry.bestWave)) : null,
    !f.isEndless && f.entry?.clears ? infoFact('Clears', String(f.entry.clears)) : null));
  return out;
}

function infoFact(label, value) {
  return h('div.stp-fact.ma-fact', h('dt.lbl', label), h('dd.stp-fact-v', value));
}

/** Keeps the freeplay pick in the URL (null removes it), so Retry / Quit come back to it. */
function rememberFreeplay(tier) {
  rememberParams('stage', { freeplay: tier || null });
}

/**
 * Solo Freeplay in the Mode sheet: Off · Blossom · Tempest · Crimson Moon (the co-op tiers), what freeplay brings on
 * this stage, the best wave per tier ("Best: wave 87 (Tempest)"), or how to unlock it. `saved`: this stage's saved
 * battle (a normal run), which a freeplay run leaves as it is.
 */
function freeplaySec(stage, state, { endless, redraw, saved = null }) {
  const profile = store.profile;
  const cleared = canPlayEndless(profile, stage.id) && hasSoloFreeplay(stage.id);
  const bests = soloBestLines(profile, stage.id);
  const bestBox = bests.length
    ? h('div.stp-fp-bests', { 'data-testid': 'prep-fp-best' }, bests.map((b) => h(`span.ui-chip.stp-fp-best.stp-fp-${b.tier}`, b.text)))
    : null;
  if (!cleared) {
    return sec('Freeplay', h('p.stp-p.stp-lockline', { 'data-testid': 'prep-fp-locked' }, ico('lock'), `Clear ${stage.id} once to start it in Freeplay, or tap Keep going on the victory screen to go past wave ${stage.waves}.`), bestBox);
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
  const opt = (id, label, extra = {}) => h(`button.ui-opt.stp-fp-opt${(state.freeplay || 'off') === id ? '.on' : ''}`, {
    type: 'button', role: 'radio', 'aria-checked': (state.freeplay || 'off') === id ? 'true' : 'false', 'data-tier': id, onclick: () => pick(id === 'off' ? null : id), ...extra,
  }, label);
  const seg = h('div.stp-fp-seg', { role: 'radiogroup', 'aria-label': 'Freeplay', 'data-testid': 'prep-freeplay' },
    endless ? null : opt('off', 'Off'),
    ...FREEPLAY_TIERS.map((id) => opt(id, freeplayTable(id).name, { 'data-testid': `prep-fp-${id}`, title: TIER_PITCH[id] })));
  const t = freeplayTable(state.freeplay);
  return sec('Freeplay',
    seg,
    t
      ? h(`div.stp-fp-info.stp-fp-${t.id}`, { 'data-testid': 'prep-fp-info' },
        h('p.stp-p', h('b', TIER_PITCH[t.id]), ' ', freeplaySummary(stage.id, t.id) || ''),
        h('p.stp-p.desc', 'Rewards for the clear are saved at the last stage wave; past it you earn coins every wave, a cache every 25 waves and boss tokens. Finish any time from the pause menu.'),
        state.difficulty === 'nightmare' ? h('p.stp-p.stp-warn', '1 life: the first leak ends freeplay.') : null,
        saved ? h('p.stp-p.desc', { 'data-testid': 'prep-fp-save-note' }, 'Freeplay runs aren\'t saved when you quit, so your saved battle here stays as it is.') : null)
      : h('p.stp-p.desc', `Off: the battle ends at wave ${stage.waves}. You can still Keep going from the victory screen.`),
    bestBox);
}
