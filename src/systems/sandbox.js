// Sandbox mode rules (owner: systems). A solo test range: any stage of any mode (campaign Acts I–II, side stages,
// events, every Bounty tier, Total Assault, Tactical Challenge, Titan Trials) or solo freeplay on any campaign stage,
// from any start wave; any girl (owned or not) at any build, by default the true maximum (L85, 10 gates, P6, ★5, LR
// for an LR unit) with a virtual gear preset; 999,999 battle coins, spawn controls, and nothing is ever saved from it —
// no clears, medals, drops, bestiary, mission or achievement progress (rewards.js skips a result that carries
// `sandbox: true`, and the battle never calls applyBattleResult for one). The virtual gear lives only in the battle's
// stats (sandboxProfile below builds a throwaway profile for unitBattleStats): never in the save.
// docs/specs/SANDBOX_CATCHUP.md lists what it covers; tests/systems/sandboxCoverage.test.js keeps it complete.
// Route: #/sandbox (stage), #/sandbox/team (squad + builds), then
// #/battle?stage=<id>&difficulty=…&sandbox=1&team=a.b&hero=x[&fp=tier][&wave=n][&bmode=m][&ttn=id&ttier=t&trank=n][&sb=build][&sx=id_build,…]

import { UNIT_MAP, UNITS } from '../data/units.js';
import { STAGES, STAGE_MAP, CAMPAIGN_IDS } from '../data/stages.js';
import { MAPS, MAP_MAP } from '../data/maps.js';
import { BATTLE, DIFFICULTIES } from '../data/types.js';
import { EVENT_STAGES, eventOfStage } from '../data/events/index.js';
import '../data/events/wire.js';
import { TITANS, TITAN_MAP, TITAN_TIERS, MAX_RANK, tierIndex } from '../data/titans.js';
import { FREEPLAY_TIERS, freeplayTier } from '../data/freeplay.js';
import { MODE_ORDER, modeId } from '../data/modes.js';
import { SLOT_IDS, ROLL_SLOTS, MAIN_STATS_BY_SLOT } from '../data/gearSlots.js';
import { SET_IDS, GEAR_SETS } from '../data/gearSets.js';
import { SUB_STAT_KEYS, subPool, newStatFits } from '../data/gearStats.js';
import { CLUBS } from '../data/clubs.js';
import { GEAR_SUBSTATS_BY_RARITY } from '../data/types.js';
import { LR_SET, LR_BLANK, UR_MAX_LEVEL, LR_MAX_LEVEL, TUNE_GOLD, TUNE_RAINBOW } from '../data/gearAwaken.js';
import { isLegendUnit } from '../data/banners.js';
import { unitBattleStats, MAX_AWAKEN, MAX_LEVEL, MAX_BREAKTHROUGH, GATE_CAPS, gatesAllowed, potentialLevelCap } from './progression.js';
import { MAX_POTENTIAL } from './potential.js';
import { LB_LEVEL, LB_STARS, rankBoost, RESONANCE_FROM_DAY } from './limitBreak.js';
import { potentialTrack } from '../data/potential.js';
import { gameDayStart } from '../core/reset.js';
import { MAX_GEAR_LEVEL, SUB_GROWTH_EVERY, mainStatRange, substatRange, recomputeGear, pieceName, nextGrowthIndex } from './gear.js';
import { coachPaths } from './buildCoach.js';
import { isStageCleared } from './unlocks.js';

/** Campaign stages cleared (any difficulty) before Sandbox opens. */
export const SANDBOX_UNLOCK_CLEARS = 7;
/** Battle coins a sandbox battle starts with. */
export const SANDBOX_COINS = 999999;
/** What the "+ coins" button adds, and the most a sandbox purse holds. */
export const SANDBOX_COIN_STEP = 100000;
export const SANDBOX_COIN_CAP = 9999999;
/** The highest start wave the picker takes. */
export const SANDBOX_MAX_START_WAVE = 999;
/** Start-wave quick picks (freeplay's milestones: the Matriarch at 200, the Eclipse Wyrm at 250). */
export const SANDBOX_WAVE_PICKS = Object.freeze([1, 50, 100, 150, 200, 250]);

/** @returns {number} campaign stages cleared on any difficulty */
export function campaignClears(profile) {
  return CAMPAIGN_IDS.filter((id) => isStageCleared(profile, id)).length;
}

/** @returns {boolean} */
export function isSandboxUnlocked(profile) {
  return campaignClears(profile) >= SANDBOX_UNLOCK_CLEARS;
}

/** The locked tile's line. */
export function sandboxLockText(profile) {
  const left = Math.max(0, SANDBOX_UNLOCK_CLEARS - campaignClears(profile));
  return `Clear ${SANDBOX_UNLOCK_CLEARS} stages to unlock (${left} to go)`;
}

// ---------------------------------------------------------------------------------------------
// Stages, by mode
// ---------------------------------------------------------------------------------------------

/** The map step's tabs, in order. `titan` entries are titans (tier and rank picked beside them), the rest stages. */
export const SANDBOX_GROUPS = Object.freeze([
  Object.freeze({ id: 'act1', name: 'Act I' }),
  Object.freeze({ id: 'act2', name: 'Act II' }),
  Object.freeze({ id: 'side', name: 'Side stages' }),
  Object.freeze({ id: 'event', name: 'Events' }),
  Object.freeze({ id: 'resource', name: 'Bounties' }),
  Object.freeze({ id: 'boss', name: 'Total Assault' }),
  Object.freeze({ id: 'challenge', name: 'Tactical Challenge' }),
  Object.freeze({ id: 'titan', name: 'Titan Trials' }),
]);

/** Which tab a stage sits under (null: a stage kind the Sandbox does not know, which the coverage test catches). */
export function sandboxGroupOf(stage) {
  if (!stage) return null;
  if (stage.kind === 'campaign') return (stage.act || 1) >= 2 ? 'act2' : 'act1';
  if (stage.kind === 'side' || stage.kind === 'event' || stage.kind === 'resource' || stage.kind === 'boss' || stage.kind === 'challenge') return stage.kind;
  return null;
}

/**
 * Every stage the Sandbox offers, in the game's order, each with its tab and map: every stage in STAGES plus every
 * event stage (past and running: they are registered in STAGE_MAP by src/data/events/wire.js).
 * @returns {{ id: string, group: string, stage: object, map: object }[]}
 */
export function sandboxStages() {
  const out = [];
  const seen = new Set();
  for (const s of [...STAGES, ...EVENT_STAGES.map((e) => STAGE_MAP[e.id] || e)]) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    const group = sandboxGroupOf(s);
    const map = MAP_MAP[s.mapId];
    if (group && map) out.push({ id: s.id, group, stage: s, map });
  }
  return out;
}

/** The titans the Titan Trials tab offers (any tier, any Mayhem rank). */
export function sandboxTitans() {
  return TITANS.map((t) => ({ id: t.id, titan: t, map: MAP_MAP[t.mapId] })).filter((t) => t.map);
}

/** A campaign stage takes freeplay (the stage up to its goal, then the freeplay waves). */
export const sandboxFreeplayOk = (stageId) => STAGE_MAP[stageId]?.kind === 'campaign' && Number.isFinite(STAGE_MAP[stageId]?.waves);
/** A campaign stage takes a battle mode (Reverse, Rush, …): never with freeplay. */
export const sandboxModeOk = (stageId) => STAGE_MAP[stageId]?.kind === 'campaign';

/** The difficulties a stage plays (an event stage keeps its own list). */
export function sandboxDifficulties(stageId) {
  const s = STAGE_MAP[stageId];
  return s?.kind === 'event' && Array.isArray(s.difficulties) && s.difficulties.length ? [...s.difficulties] : Object.keys(DIFFICULTIES);
}

/** A stage's event name, for the card. */
export const sandboxEventName = (stageId) => eventOfStage(stageId)?.name || null;

/**
 * Every map with the stage that hosts it (the first stage drawn on it). Kept for older callers: the map step lists
 * stages now (sandboxStages).
 * @returns {{ map: object, stage: object }[]}
 */
export function sandboxMaps() {
  const out = [];
  for (const map of MAPS) {
    const stage = STAGES.find((s) => s.mapId === map.id);
    if (stage) out.push({ map, stage });
  }
  return out;
}

/** @returns {string|null} the host stage id of a map */
export function sandboxStageFor(mapId) {
  return STAGES.find((s) => s.mapId === mapId)?.id || null;
}

// ---------------------------------------------------------------------------------------------
// Builds: level, Potential, awakening, LR and a gear preset
// ---------------------------------------------------------------------------------------------

/** The gear rarities a set preset comes in. */
export const SANDBOX_SET_RARITIES = Object.freeze(['leg', 'ur', 'lr']);
/** 'best' in a set preset: her Build Coach set. */
export const BEST_SET = 'best';

/**
 * Every gear preset key: none · leg (best Legendary, no set) · leg-<set> · ur-<set> · lr-<set> (Set LR ×5) · blank
 * (Blank LR ×5), with <set> one of SET_IDS or 'best' (her Build Coach set).
 */
export const SANDBOX_GEAR_PRESETS = Object.freeze([
  'none', 'leg',
  ...SANDBOX_SET_RARITIES.flatMap((r) => [BEST_SET, ...SET_IDS].map((s) => `${r}-${s}`)),
  'blank',
]);

/**
 * The default build: everything at its true maximum (MAX_LEVEL, P MAX_POTENTIAL, ★MAX_AWAKEN, LR), her Build Coach set
 * at LR. Literal numbers: this module loads inside progression.js's own import cycle (via rewards.js), before its
 * constants exist; tests/systems/sandboxCoverage.test.js holds them equal to the game's caps.
 */
export const SANDBOX_MAX_BUILD = Object.freeze({ level: 85, p: 6, stars: 5, lr: true, gear: `lr-${BEST_SET}`, roll: 'max' });

/** Gear quality: 'max' (every line its best roll, pins) or 'typical' (every line its average roll, no pins). */
export const SANDBOX_ROLLS = Object.freeze(['max', 'typical']);
/** UR Resonance in a sandbox run: 'auto' follows the real clock (as for players), 'on' / 'off' force it. */
export const SANDBOX_RESONANCE = Object.freeze(['auto', 'on', 'off']);

/** Level quick picks: every level cap step from 60 (GATE_CAPS), and 40 / 20 / 1 (the test holds them to GATE_CAPS). */
export const SANDBOX_LEVEL_PICKS = Object.freeze([85, 78, 72, 67, 63, 60, 40, 20, 1]);

const int = (v, lo, hi, d) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};

/** The lowest Potential that lets her reach `level` (85 needs P6, 60 needs P1). */
export function potentialForLevel(level) {
  for (let p = 1; p <= MAX_POTENTIAL; p++) if (potentialLevelCap(p) >= level) return p;
  return MAX_POTENTIAL;
}

/** The fewest breakthrough gates a girl at `level` has (85 → 10, 60 → 5, 40 → 3). */
export function gatesForSandboxLevel(level) {
  for (let g = 0; g <= MAX_BREAKTHROUGH; g++) if (GATE_CAPS[g] >= level) return g;
  return MAX_BREAKTHROUGH;
}

/** A gear preset key, or the default when it is unknown. */
export const gearPresetOf = (key) => (SANDBOX_GEAR_PRESETS.includes(key) ? key : SANDBOX_MAX_BUILD.gear);

/**
 * A clean build: level 1…85, Potential raised to what the level needs, ★0…5, LR on/off, a known gear preset.
 * @returns {{ level: number, p: number, stars: number, lr: boolean, gear: string }}
 */
export function normalizeBuild(b = {}) {
  const level = int(b.level, 1, MAX_LEVEL, SANDBOX_MAX_BUILD.level);
  const p = Math.max(potentialForLevel(level), int(b.p, 1, MAX_POTENTIAL, SANDBOX_MAX_BUILD.p));
  const stars = int(b.stars, 0, MAX_AWAKEN, SANDBOX_MAX_BUILD.stars);
  const lr = b.lr == null ? SANDBOX_MAX_BUILD.lr : !!b.lr && b.lr !== '0';
  return { level, p, stars, lr, gear: gearPresetOf(b.gear), roll: SANDBOX_ROLLS.includes(b.roll) ? b.roll : SANDBOX_MAX_BUILD.roll };
}

/** A build as a route token: `85-6-5-1-m-lr-best` (level-P-stars-lr-roll-gear; roll m = max, t = typical). */
export function buildToken(b) {
  const n = normalizeBuild(b);
  return `${n.level}-${n.p}-${n.stars}-${n.lr ? 1 : 0}-${n.roll === 'typical' ? 't' : 'm'}-${n.gear}`;
}

/** A route token back to a build (anything unreadable falls back to the maximum). */
export function parseBuildToken(s) {
  const parts = String(s || '').split('-');
  if (parts.length < 5) return normalizeBuild(SANDBOX_MAX_BUILD);
  const [level, p, stars, lr, ...rest] = parts;
  // (a token from before the roll field: level-P-stars-lr-gear, Max roll)
  const roll = rest[0] === 't' ? 'typical' : 'max';
  if (rest[0] === 't' || rest[0] === 'm') rest.shift();
  return normalizeBuild({ level, p, stars, lr: lr === '1', gear: rest.join('-'), roll });
}

/** Per-girl builds as a route param: `kage_60-1-5-0-none,tenka_85-6-5-1-lr-geometry`. */
export function buildsParam(builds = {}) {
  return Object.entries(builds).filter(([id]) => UNIT_MAP[id]).map(([id, b]) => `${id}_${buildToken(b)}`).join(',');
}

/** The per-girl builds param back to `{ unitId: build }` (unknown girls dropped). */
export function parseBuildsParam(s) {
  const out = {};
  for (const part of String(s || '').split(',')) {
    const i = part.lastIndexOf('_', part.indexOf('-') < 0 ? part.length : part.indexOf('-'));
    if (i <= 0) continue;
    const id = part.slice(0, i);
    if (UNIT_MAP[id]) out[id] = parseBuildToken(part.slice(i + 1));
  }
  return out;
}

/** Whether a build makes this girl LR (an LR unit, LR on, at Limit Break's L60 and ★5). */
export const sandboxIsLr = (unitId, b) => isLegendUnit(unitId) && !!b.lr && b.stars >= LB_STARS && b.level >= LB_LEVEL;

/** What a gear preset means: { rarity: 'none'|'leg'|'ur'|'lr'|'blank', set: string|null, slots }. */
export function gearPresetInfo(key, unitId = null) {
  const k = gearPresetOf(key);
  if (k === 'none') return { rarity: 'none', set: null, slots: [] };
  if (k === 'leg') return { rarity: 'leg', set: null, slots: [...ROLL_SLOTS] };
  if (k === 'blank') return { rarity: 'blank', set: null, slots: [...SLOT_IDS] };
  const [rarity, set] = k.split('-');
  return { rarity, set: set === BEST_SET ? bestSetFor(unitId) : set, slots: [...SLOT_IDS] };
}

/** Her Build Coach set (her best path's first set), else Geometry. */
export function bestSetFor(unitId) {
  const s = unitId ? coachPaths(unitId)[0]?.sets?.[0] : null;
  return SET_IDS.includes(s) ? s : 'geometry';
}

/** The main stat a slot gets: her coach's pick, else her best substat the slot can carry as a main, else its first. */
function mainFor(slot, row) {
  const pool = MAIN_STATS_BY_SLOT[slot] || [];
  const want = row?.mains?.[slot];
  if (pool.includes(want)) return want;
  return (row?.subs || []).find((s) => pool.includes(s)) || pool[0];
}

/** Her substats on a piece: her coach order first, then the rest of the slot's pool (never the main stat). */
function subsFor(slot, club, main, row, n) {
  const pool = subPool(slot, club);
  const order = [...new Set([...(row?.subs || []), ...SUB_STAT_KEYS])];
  return order.filter((s) => s !== main && pool.includes(s) && newStatFits(s, slot)).slice(0, n);
}

/**
 * Her virtual pieces for a gear preset, at the max-roll profile: every line at its best +0 roll (stored in Legendary
 * form, as UR and LR pieces are), the piece at its top level (+10, UR +12, LR +18), its ▲ growths as the game hands
 * them out (the least-upgraded line, ties first), every ✦ slot it has stitched (gold, rainbow, the Nightglass ✦ on LR)
 * on her best lines, the Tie Pin and its Collar Pins (one, LR two) marked. Main stats and substats from her Build Coach
 * row; her coach's club split (3 + 2). Pure: a fresh array every call, never stored.
 * @returns {object[]} GearInstance list (uids `sbx:<unit>:<slot>`)
 */
export function sandboxGear(unitId, presetKey, roll = 'max') {
  const typical = roll === 'typical';
  const mid = ([a, b]) => (a + b) / 2;
  const info = gearPresetInfo(presetKey, unitId);
  if (!info.slots.length) return [];
  const row = coachPaths(unitId)[0] || null;
  const ur = info.rarity !== 'leg';
  const lr = info.rarity === 'lr' ? LR_SET : info.rarity === 'blank' ? LR_BLANK : 0;
  const level = lr ? LR_MAX_LEVEL : ur ? UR_MAX_LEVEL : MAX_GEAR_LEVEL;
  const clubs = [row?.club?.three, row?.club?.three, row?.club?.three, row?.club?.two, row?.club?.two].map((c) => (CLUBS[c] ? c : null));
  return info.slots.map((slot, i) => {
    const club = clubs[i];
    const mainStat = mainFor(slot, row);
    const subs = subsFor(slot, club, mainStat, row, GEAR_SUBSTATS_BY_RARITY.legendary).map((stat) => ({ stat, base: typical ? mid(substatRange(stat, 'legendary')) : substatRange(stat, 'legendary')[1], value: 0, upgrades: 0, tuned: 0 }));
    const g = {
      uid: `sbx:${unitId}:${slot}`, slot, rarity: 'legendary', level,
      main: { stat: mainStat, base: typical ? mid(mainStatRange(mainStat, 'legendary')) : mainStatRange(mainStat, 'legendary')[1], value: 0, ...(typical ? {} : { top: 1 }) },
      subs, locked: true, equippedBy: unitId, name: '', club,
      ...(ur ? { ur: 1 } : {}), ...(lr ? { lr } : {}), ...(info.set && lr !== LR_BLANK ? { set: info.set } : {}),
    };
    for (let n = Math.floor(level / SUB_GROWTH_EVERY); n > 0 && subs.length; n--) subs[nextGrowthIndex(g)].upgrades += 1;
    if (subs[0]) subs[0].tuned |= TUNE_GOLD;
    if (ur && subs[1]) subs[1].tuned |= TUNE_RAINBOW;
    if (lr && subs[0]) subs[0].night = 1;
    if (!typical) for (const s of subs.slice(0, lr ? 2 : 1)) s.top = 1;
    g.name = pieceName(g);
    return recomputeGear(g);
  });
}

/**
 * A throwaway profile holding one girl at a build (her virtual gear worn, her Limit Break when the build is LR): what
 * unitBattleStats reads. Never the player's save.
 */
export function sandboxProfile(unitId, build = SANDBOX_MAX_BUILD) {
  const b = normalizeBuild(build);
  const pieces = sandboxGear(unitId, b.gear, b.roll);
  const gear = Object.fromEntries(pieces.map((g) => [g.uid, g]));
  const worn = Object.fromEntries(pieces.map((g) => [g.slot, g.uid]));
  const lr = sandboxIsLr(unitId, b);
  return {
    units: { [unitId]: { level: b.level, awaken: b.stars, breakthrough: Math.min(gatesForSandboxLevel(b.level), gatesAllowed(b.p)), pl: b.p, gear: worn } },
    gear,
    missions: { counters: lr ? { [`lr:${unitId}`]: 1, [`lbt:${unitId}`]: 1 } : {} },
  };
}

/** Times inside and before UR Resonance's first week (rankBoost's `now`). */
const RESONANCE_AT = { on: () => gameDayStart(RESONANCE_FROM_DAY) + 12 * 3600 * 1000, off: () => 0 };

/**
 * Her battle stats at a build (default: the true maximum). `resonance` 'on' / 'off' forces UR Resonance (and the LR
 * boost that rides its week) instead of the real clock ('auto'): her boost factors are swapped for the forced ones on
 * damage, attack speed and aura (src/systems/limitBreak.js rankBoost, the factors unitBattleStats multiplies in).
 */
export function sandboxUnitStats(unitId, build = SANDBOX_MAX_BUILD, { resonance = 'auto' } = {}) {
  const profile = sandboxProfile(unitId, build);
  const s = unitBattleStats(profile, unitId);
  if (!RESONANCE_AT[resonance] || !UNIT_MAP[unitId]) return s;
  const track = potentialTrack(UNIT_MAP[unitId]);
  const now = rankBoost(profile, unitId, track);
  const want = rankBoost(profile, unitId, track, RESONANCE_AT[resonance]());
  const r4 = (v) => Math.round(v * 10000) / 10000;
  return {
    ...s,
    damageMul: r4(s.damageMul / now.damage * want.damage),
    rateMul: r4(s.rateMul / now.rate * want.rate),
    auraPct: r4((s.auraPct + 1) / now.aura * want.aura - 1),
  };
}

/** Her build in a squad: her own, else the squad's. */
export const buildFor = (unitId, squad = SANDBOX_MAX_BUILD, own = {}) => normalizeBuild(own?.[unitId] || squad);

// ---------------------------------------------------------------------------------------------
// Squad and route
// ---------------------------------------------------------------------------------------------

/**
 * Any girl in the roster may join, owned or not. Unknown ids, duplicates, a hero in a tower slot
 * (or the other way round) are dropped; at most BATTLE.maxTowers students.
 * @param {string[]} team
 * @param {string|null} hero
 * @returns {{ towers: string[], hero: string|null }}
 */
export function sandboxFormation(team = [], hero = null) {
  const towers = [...new Set((team || []).filter((id) => UNIT_MAP[id]?.kind === 'tower'))].slice(0, BATTLE.maxTowers);
  return { towers, hero: hero && UNIT_MAP[hero]?.kind === 'hero' ? hero : null };
}

/** Every girl the sandbox offers (every unit in the game, held ones too), students first, then heroes. */
export function sandboxRoster(kind = null) {
  return UNITS.filter((u) => (kind ? u.kind === kind : true));
}

/** Route params → team list ('a.b.c' or 'a,b,c'). */
export function parseTeam(s) {
  return String(s || '').split(/[.,]/).map((x) => x.trim()).filter(Boolean);
}

/** A start wave: 1…SANDBOX_MAX_START_WAVE. */
export const startWaveOf = (v) => int(v, 1, SANDBOX_MAX_START_WAVE, 1);

/**
 * The battle route params of a sandbox run. `stageId` (or the older `mapId`: its host stage); `titan` { id, tier, rank }
 * for Titan Trials; `freeplay` a tier on a campaign stage; `startWave`; `mode` a battle mode on a campaign stage;
 * `build` the squad build; `builds` per-girl builds.
 */
export function sandboxBattleParams({ stageId = null, mapId = null, difficulty = 'normal', towers = [], hero = null, titan = null, freeplay = null, startWave = 1, mode = 'standard', build = null, builds = null, resonance = 'auto', heroMax = true }) {
  const stage = stageId || sandboxStageFor(mapId);
  const out = { stage, difficulty, sandbox: 1, team: towers.join('.'), hero: hero || undefined };
  if (titan && TITAN_MAP[titan.id]) {
    const tier = tierIndex(titan.tier) >= 0 ? titan.tier : 'normal';
    Object.assign(out, { stage: undefined, difficulty: undefined, ttn: titan.id, ttier: tier, ...(tier === 'mayhem' ? { trank: int(titan.rank, 0, MAX_RANK, 0) } : {}) });
  } else {
    const fp = freeplay && sandboxFreeplayOk(stage) ? freeplayTier(freeplay) : null;
    if (fp) out.fp = fp;
    const m = modeId(mode);
    if (!fp && m !== 'standard' && sandboxModeOk(stage)) out.bmode = m;
  }
  const w = startWaveOf(startWave);
  if (w > 1) out.wave = w;
  if (build) {
    const t = buildToken(build);
    if (t !== buildToken(SANDBOX_MAX_BUILD)) out.sb = t;
  }
  const sx = builds ? buildsParam(builds) : '';
  if (sx) out.sx = sx;
  if (resonance === 'on' || resonance === 'off') out.res = resonance;
  if (heroMax === false) out.hmax = 0;
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}

/**
 * The run a sandbox request carries (setup.js parseBattleParams): titan, freeplay tier, start wave, battle mode, the
 * squad build and per-girl builds. Unknown or invalid values fall back (no titan, no freeplay, wave 1, Standard, max).
 * @returns {{ titan: { id, tier, rank }|null, freeplay: string|null, startWave: number, mode: string, build: object, builds: object,
 *   resonance: 'auto'|'on'|'off', heroMax: boolean }}
 */
export function parseSandboxRun(params = {}, stageId = null) {
  const titan = TITAN_MAP[params.ttn] ? { id: String(params.ttn), tier: TITAN_TIERS.includes(params.ttier) ? params.ttier : 'normal', rank: 0 } : null;
  if (titan && titan.tier === 'mayhem') titan.rank = int(params.trank, 0, MAX_RANK, 0);
  const freeplay = !titan && params.fp && sandboxFreeplayOk(stageId) && FREEPLAY_TIERS.includes(params.fp) ? params.fp : null;
  let mode = !titan && !freeplay && sandboxModeOk(stageId) ? modeId(params.bmode) : 'standard';
  if (!MODE_ORDER.includes(mode)) mode = 'standard';
  return {
    titan, freeplay, mode,
    startWave: startWaveOf(params.wave),
    build: params.sb ? parseBuildToken(params.sb) : normalizeBuild(SANDBOX_MAX_BUILD),
    builds: parseBuildsParam(params.sx),
    resonance: SANDBOX_RESONANCE.includes(params.res) ? params.res : 'auto',
    // a later start wave levels the hero to Lv 25 + Mastery when she is placed (`hmax=0` turns it off)
    heroMax: String(params.hmax ?? '1') !== '0',
  };
}

/** What a sandbox battle hands the results sheet: nothing earned, nothing saved. */
export function sandboxOutcome() {
  return { sandbox: true, firstClear: false, newMedal: false, medal: null, rewards: [], gear: [], unlockedUnits: [], discovered: [], gemsEarned: 0, eventBonus: false, practice: false };
}

/** Names for the screens. */
export const GEAR_RARITY_LABEL = Object.freeze({ none: 'None', leg: 'Legendary', ur: 'UR', lr: 'Set LR', blank: 'Blank LR' });
/** A gear preset's label: "LR set · Geometry Set", "Best Legendary (no set)", "Blank LR ×5". */
export function gearPresetLabel(key, unitId = null) {
  const k = gearPresetOf(key);
  if (k === 'none') return 'No gear';
  if (k === 'leg') return 'Best Legendary (no set)';
  if (k === 'blank') return 'Blank LR ×5';
  const [r, s] = k.split('-');
  const setName = s === BEST_SET ? (unitId ? `${GEAR_SETS[bestSetFor(unitId)].name} (coach)` : 'her coach set') : GEAR_SETS[s]?.name;
  return `${r === 'lr' ? 'LR set' : r === 'ur' ? 'UR set' : 'Legendary set'} · ${setName}`;
}
