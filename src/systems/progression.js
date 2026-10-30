// Student progression: levels, breakthroughs, awakening and battle multipliers
// (owner: systems). See CONTRACTS.md §5.
//
// Scaling is deliberately modest (heroes used to be overpowered):
//   damage +1.8% per level after 1, +2% per breakthrough gate, +5% per awaken star (additive)
//   → level 60 / 5 gates / ★5 ≈ ×2.41 damage before gear (level 85 at P6: ×2.86).
//   attack rate +0.4% per level after 1.
// Levels above 60 (Potential raises the cap, LEVEL_PAST_GATES) continue the same curve.

import { UNIT_MAP, getUnit } from '../data/units.js';
import { ITEMS, materialId, bookId, zenithId } from '../data/items.js';
import { ITEM_RARITY_ORDER } from '../data/types.js';
import { consumeItems, missingItems, itemCount, normalizeList } from './inventory.js';
import { gearStatTotals, gearFillIn, gearSetInfo, gearCaps, pierceUseCap, blastKit, heroBlastLevel } from './gear.js';
import { BATTLE_CAPS, DOT_BY_PIECES, fillStats } from '../data/gearStats.js';
import { averageCrit, ABIL_HASTE_CEIL, BLAST_K_MAX } from '../sim/setRules.js';
import { BLANK_FIVE } from '../data/gearAwaken.js';
import { powerKitOf } from '../data/powerKit.js';

export { BATTLE_CAPS };
import { track } from './missions.js';
import { potentialLevel, potentialPowerFactor } from './potential.js';
import { potentialTrack } from '../data/potential.js';
import { rankBoost } from './limitBreak.js';
import { mirrorUnit, LEVEL_MIRROR_PREFIX } from './ascensionSave.js';
import { writeRosterMark } from './rosterSave.js';

/** Breakthrough gates: 1–5 to level 60, then gates 6–10 (Ascension) to 85. */
export const MAX_BREAKTHROUGH = 10;
/** The gates every girl breaks with materials alone (gates past it also need Potential). */
export const BASE_GATES = 5;
export const MAX_AWAKEN = 5;
/** Coins charged per point of EXP applied (up to level 60; LEVEL_PAST_GATES prices the levels above). */
export const COINS_PER_EXP = 0.4;

/**
 * The levels past the breakthrough cap, in ONE table (docs/specs/POTENTIAL.md v3 §4; owner: level
 * 85 at P6, Akashic Tomes for the EXP). Once breakthrough gate 5 is open, her level cap is
 * `caps[P − 1]` (P = her Potential, src/systems/potential.js potentialLevel); every level above
 * `from` costs `exp` EXP (one `book`, an Akashic Tome) and `coins`. A later ascension (level gates
 * paid with family materials and a crown) replaces or extends this table and levelCap below; the
 * Potential ladders (src/data/potential.js) never change for it. Not co-op hashed: a girl's level
 * travels as a number.
 */
export const LEVEL_PAST_GATES = Object.freeze({
  /** the cap breakthrough gate 5 opens; the levels above it are Potential's */
  from: 60,
  /** her level cap at P1…P6 with every gate open (+3, +4, +5, +6, +7 per step) */
  caps: Object.freeze([60, 63, 67, 72, 78, 85]),
  /** EXP for each level above `from`: one Akashic Tome */
  exp: 30000,
  /** coins for each level above `from` (charged per EXP applied, like the levels below) */
  coins: 12000,
  /** the book the screens price a level in */
  book: bookId('legendary'),
});
/** What breakthrough gate 5 opens (60). */
export const BREAKTHROUGH_LEVEL_CAP = LEVEL_PAST_GATES.from;
/** Her level cap at P1…P6 once gate 5 is open. */
export const POTENTIAL_LEVEL_CAPS = LEVEL_PAST_GATES.caps;
export const EXP_PER_LEVEL_ABOVE_60 = LEVEL_PAST_GATES.exp;
export const COINS_PER_LEVEL_ABOVE_60 = LEVEL_PAST_GATES.coins;
/** The highest level any girl reaches (85, at P6). */
export const MAX_LEVEL = POTENTIAL_LEVEL_CAPS[POTENTIAL_LEVEL_CAPS.length - 1];

const PER_LEVEL_DAMAGE = 0.018;
const PER_GATE_DAMAGE = 0.02;
const PER_STAR_DAMAGE = 0.05;
const PER_LEVEL_RATE = 0.004;

/**
 * Level cap after each number of gates (docs/specs/ASCENSION.md §B.1): 10 + 10 × gates up to gate 5
 * (60), then gates 6–10: 63 · 67 · 72 · 78 · 85.
 */
export const GATE_CAPS = Object.freeze([10, 20, 30, 40, 50, 60, 63, 67, 72, 78, 85]);

/** The Potential gate k (6–10) needs: P(k − 4). Gates 1–5 need none (P1). */
export function gatePotential(gate) {
  return gate > BASE_GATES ? gate - 4 : 1;
}

/** The most gates her Potential allows (P1 → 5 … P6 → 10). */
export function gatesAllowed(p) {
  return Math.min(MAX_BREAKTHROUGH, BASE_GATES + Math.max(0, Math.min(5, Math.floor(Number(p) || 1) - 1)));
}

/**
 * The level-cap rule with her gates and her Potential given: GATE_CAPS[gates], where gates past what
 * her Potential allows (a hostile mirror, an old save) do not count. Gate k needs P(k − 4), so the cap
 * is never above her Potential's cap (POTENTIAL_LEVEL_CAPS[P − 1]): a P6 girl at gate 7 is capped at
 * 67; a P2 girl stops after gate 6 (63). Callers that already know her P (a co-op loadout, the
 * Potential screens) pass it here, so nothing outside src/systems/potential.js potentialLevel says
 * where P comes from.
 * @param {number} gates breakthrough gates open (0…10)
 * @param {number} p her Potential (1…6)
 */
export function levelCapAt(gates, p) {
  const g = Math.max(0, Math.min(MAX_BREAKTHROUGH, Math.floor(Number(gates) || 0)));
  return GATE_CAPS[Math.min(g, gatesAllowed(p))];
}

/** Level cap for a unit state: levelCapAt(her gates, potentialLevel(her state)). */
export function levelCap(unitState) {
  return levelCapAt(unitState?.breakthrough, potentialLevel(unitState));
}

/**
 * The fewest gates (at least 5) that allow `level` at Potential `p`: a viewer that knows only her
 * level and P (a profile card carries at most 5 gates) rebuilds her state from it.
 */
export function gatesForLevel(level, p) {
  const top = gatesAllowed(p);
  for (let g = BASE_GATES; g <= top; g++) if (GATE_CAPS[g] >= level) return g;
  return top;
}

/**
 * Her level cap and what raises it next, for the screens: always her next gate (`nextGate`, cap
 * `next`); a gate her Potential does not open yet sets `by: 'potential'` with `nextP` (the P it needs).
 * `full` at gate 10.
 * @returns {{ cap: number, max: number, p: number, by: 'gate'|'potential', next: number|null, nextGate: number|null, nextP: number|null, full: boolean }}
 */
export function levelCapInfo(unitState) {
  const cap = levelCap(unitState);
  const gates = Math.max(0, Math.min(MAX_BREAKTHROUGH, Math.floor(Number(unitState?.breakthrough) || 0)));
  const p = potentialLevel(unitState);
  if (gates >= MAX_BREAKTHROUGH) return { cap, max: MAX_LEVEL, p, by: 'gate', next: null, nextGate: null, nextP: null, full: true };
  const gate = gates + 1;
  const needP = gatePotential(gate);
  return { cap, max: MAX_LEVEL, p, by: needP > p ? 'potential' : 'gate', next: GATE_CAPS[gate], nextGate: gate, nextP: needP > p ? needP : null, full: false };
}

/**
 * Her level cap at Potential `p` once every breakthrough gate is open: what the Potential screens
 * show next to each step ("+4% SPD · 67"; they show it only where it rises above the P1 cap). It
 * asks levelCapAt, so the screens follow whatever the level rule says (and an ascension that moves
 * the caps moves them here too).
 * @param {number} p 1…6
 */
export function potentialLevelCap(p) {
  return levelCapAt(MAX_BREAKTHROUGH, p);
}

/** EXP to go from `level` to `level + 1` (Infinity at max; one Akashic Tome per level from 60). */
export function expForLevel(level) {
  if (level >= MAX_LEVEL) return Infinity;
  if (level >= BREAKTHROUGH_LEVEL_CAP) return EXP_PER_LEVEL_ABOVE_60;
  return Math.round((40 * level ** 1.75 + 60) / 10) * 10;
}

/** EXP a state holds in the levels above 60 (0 below 60). */
const expAbove60 = (level, exp) => (level >= BREAKTHROUGH_LEVEL_CAP ? (level - BREAKTHROUGH_LEVEL_CAP) * EXP_PER_LEVEL_ABOVE_60 + exp : 0);

/**
 * Coins for `applied` EXP that took a girl from (level, exp) to (toLevel, toExp): COINS_PER_EXP up to
 * level 60, LEVEL_PAST_GATES' coins per level above it (12,000 per 30,000 EXP).
 */
function coinsFor(unit, toLevel, toExp, applied) {
  const above = Math.max(0, Math.min(applied, expAbove60(toLevel, toExp) - expAbove60(unit.level, unit.exp)));
  return Math.ceil((applied - above) * COINS_PER_EXP + (above * COINS_PER_LEVEL_ABOVE_60) / EXP_PER_LEVEL_ABOVE_60);
}

/**
 * The level shadow: `missions.counters['lv:<id>']` = her level once it is above 60. A build from
 * before the level cap rose clamps a girl's level to 60 when it loads and saves (its cleanUnit), but
 * keeps `missions.counters` word for word; migrateProfile (src/systems/save.js) lifts her back to
 * min(shadow, levelCap). At most the EXP inside one level is lost that way.
 * Ascension writes the same level to its own mirror, 'lvA:<id>' (ascensionSave.js LEVEL_MIRROR_PREFIX):
 * a Potential-v3 build (v0.1.37, v0.1.38) does not know `pl`, clamps a girl whose bought P is above
 * 1 + dupes to its lower cap and rewrites 'lv:' down to that clamped level, but never writes 'lvA:'.
 */
export const LEVEL_SHADOW_PREFIX = 'lv:';

/** Write her level shadows ('lv:' and 'lvA:') when her level is above 60 (levelUp calls it; so does every load). */
export function shadowLevel(profile, unitId) {
  const level = profile?.units?.[unitId]?.level;
  if (!(level > BREAKTHROUGH_LEVEL_CAP)) return;
  const c = ((profile.missions ||= {}).counters ||= {});
  if (c[LEVEL_SHADOW_PREFIX + unitId] !== level) c[LEVEL_SHADOW_PREFIX + unitId] = level;
  if (c[LEVEL_MIRROR_PREFIX + unitId] !== level) c[LEVEL_MIRROR_PREFIX + unitId] = level;
}

/** The level her shadows hold: the higher of 'lv:<id>' and 'lvA:<id>' (0 when neither is set). */
export function shadowedLevel(counters, unitId) {
  const read = (k) => Math.max(0, Math.floor(Number(counters?.[k]) || 0));
  return Math.max(read(LEVEL_SHADOW_PREFIX + unitId), read(LEVEL_MIRROR_PREFIX + unitId));
}

/**
 * After a load (the sanitizer let levels up to MAX_LEVEL through before her duplicates were known):
 * restore a level an older build clamped (to 60, or to a Potential-v3 cap) from her shadows
 * (max of 'lv:' and 'lvA:'), never above levelCap, then clamp her to levelCap (EXP 0 when clamped or
 * at the cap, as a level-up at the cap leaves it) and rewrite both shadows. A hostile shadow never
 * lifts a girl above her cap. Idempotent.
 * @param {object} profile
 * @returns {string[]} ids whose level changed
 */
export function settleLevels(profile) {
  const changed = [];
  const c = profile?.missions?.counters || {};
  for (const [id, u] of Object.entries(profile?.units || {})) {
    const cap = levelCap(u);
    const before = u.level;
    const shadow = shadowedLevel(c, id);
    // only a girl at 60 or above (where an older build's clamp leaves her) is lifted
    if (shadow > u.level && u.level >= BREAKTHROUGH_LEVEL_CAP) {
      u.level = Math.min(shadow, cap);
      if (u.level >= cap) u.exp = 0;
    }
    if (u.level > cap) {
      u.level = cap;
      u.exp = 0;
    }
    if (u.level !== before) changed.push(id);
    shadowLevel(profile, id);
  }
  return changed;
}

/** Total EXP from level 1 to `level`. */
export function totalExpToLevel(level) {
  let t = 0;
  for (let l = 1; l < Math.min(level, MAX_LEVEL); l++) t += expForLevel(l);
  return t;
}

/** {itemId: count} of books -> EXP (non-books ignored). */
export function bookExpTotal(books) {
  let exp = 0;
  for (const [id, count] of Object.entries(books || {})) {
    const item = ITEMS[id];
    if (item?.category === 'book' && count > 0) exp += item.xp * Math.floor(count);
  }
  return exp;
}

const booksToCosts = (books) => normalizeList(Object.entries(books || {}).map(([id, count]) => ({ id, count })));

/** Simulate adding EXP to a unit state. */
function simulateExp(unit, gained) {
  const cap = levelCap(unit);
  let level = unit.level;
  let exp = unit.exp + gained;
  let applied = gained;
  while (level < cap && exp >= expForLevel(level)) {
    exp -= expForLevel(level);
    level += 1;
  }
  let capped = false;
  if (level >= cap) {
    capped = true;
    applied -= exp; // overflow beyond the cap is wasted (and not charged)
    exp = 0;
  }
  return { level, exp, applied: Math.max(0, applied), capped };
}

/**
 * Preview spending books on a unit.
 * @returns {{ fromLevel: number, toLevel: number, exp: number, expAfter: number, coinCost: number, capped: boolean, wasted: number, cap: number }}
 */
export function previewLevelUp(profile, unitId, books) {
  const unit = profile.units[unitId];
  if (!unit) return { fromLevel: 0, toLevel: 0, exp: 0, expAfter: 0, coinCost: 0, capped: false, wasted: 0, cap: 0 };
  const exp = bookExpTotal(books);
  const sim = simulateExp(unit, exp);
  return {
    fromLevel: unit.level,
    toLevel: sim.level,
    exp,
    expAfter: sim.exp,
    coinCost: coinsFor(unit, sim.level, sim.exp, sim.applied),
    capped: sim.capped,
    wasted: exp - sim.applied,
    cap: levelCap(unit),
  };
}

/**
 * Spend books (+ coins) on a unit.
 * @returns {{ ok: boolean, error?: 'notOwned'|'capped'|'noBooks'|'missing', missing?: object[], fromLevel: number, toLevel: number }}
 */
export function levelUp(profile, unitId, books) {
  const unit = profile.units[unitId];
  if (!unit) return { ok: false, error: 'notOwned', fromLevel: 0, toLevel: 0 };
  const fromLevel = unit.level;
  if (unit.level >= levelCap(unit)) return { ok: false, error: 'capped', fromLevel, toLevel: fromLevel };
  const bookCosts = booksToCosts(books).filter((c) => ITEMS[c.id]?.category === 'book');
  if (!bookCosts.length) return { ok: false, error: 'noBooks', fromLevel, toLevel: fromLevel };
  const preview = previewLevelUp(profile, unitId, Object.fromEntries(bookCosts.map((c) => [c.id, c.count])));
  const costs = [...bookCosts, { id: 'coins', count: preview.coinCost }];
  if (!consumeItems(profile, costs)) return { ok: false, error: 'missing', missing: missingItems(profile, costs), fromLevel, toLevel: fromLevel };
  unit.level = preview.toLevel;
  unit.exp = preview.expAfter;
  shadowLevel(profile, unitId);
  writeRosterMark(profile, unitId);
  if (preview.toLevel > fromLevel) track(profile, 'levelUp', preview.toLevel - fromLevel);
  track(profile, 'spendCoins', preview.coinCost);
  return { ok: true, fromLevel, toLevel: unit.level, coinCost: preview.coinCost };
}

/**
 * Books to reach the level cap (or as far as owned books go). Uses big books first without
 * overshooting, then the smallest book that finishes the job.
 * @returns {Object<string, number>} {itemId: count}
 */
export function autoSelectBooks(profile, unitId) {
  const unit = profile.units[unitId];
  if (!unit) return {};
  const cap = levelCap(unit);
  if (unit.level >= cap) return {};
  let need = -unit.exp;
  for (let l = unit.level; l < cap; l++) need += expForLevel(l);
  const out = {};
  const owned = Object.fromEntries(ITEM_RARITY_ORDER.map((r) => [bookId(r), itemCount(profile, bookId(r))]));
  for (const r of [...ITEM_RARITY_ORDER].reverse()) {
    const id = bookId(r);
    const xp = ITEMS[id].xp;
    const n = Math.min(owned[id], Math.floor(need / xp));
    if (n > 0) {
      out[id] = n;
      owned[id] -= n;
      need -= n * xp;
    }
  }
  if (need > 0) {
    // Finish with the smallest remaining book that covers the rest, else dump everything left.
    const finisher = ITEM_RARITY_ORDER.map(bookId).find((id) => owned[id] > 0 && ITEMS[id].xp >= need);
    if (finisher) out[finisher] = (out[finisher] || 0) + 1;
    else {
      for (const r of ITEM_RARITY_ORDER) {
        const id = bookId(r);
        while (owned[id] > 0 && need > 0) {
          out[id] = (out[id] || 0) + 1;
          owned[id] -= 1;
          need -= ITEMS[id].xp;
        }
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Breakthrough (level cap gates) — uses the unit's material family
// ---------------------------------------------------------------------------

/**
 * Per gate: [rarity, count] pairs (`zenith` = the family's Zenith item) + Rainbow Crowns + coins.
 * Gates 6–10 are Ascension's (docs/specs/ASCENSION.md §B.2).
 */
const GATE_COSTS = [
  { mats: [['common', 8]], coins: 5000 },
  { mats: [['common', 12], ['rare', 5]], coins: 15000 },
  { mats: [['rare', 10], ['superRare', 4]], coins: 40000 },
  { mats: [['superRare', 10], ['mythic', 3]], coins: 100000 },
  { mats: [['mythic', 8], ['legendary', 2]], coins: 250000 },
  { mats: [['mythic', 8], ['legendary', 2]], coins: 150000 },
  { mats: [['mythic', 10], ['legendary', 3], ['zenith', 1]], coins: 200000 },
  { mats: [['legendary', 4], ['zenith', 2]], coins: 300000 },
  { mats: [['legendary', 5], ['zenith', 3]], crowns: 1, coins: 450000 },
  { mats: [['legendary', 6], ['zenith', 4]], crowns: 1, coins: 800000 },
];

const matFor = (family, tier) => (tier === 'zenith' ? zenithId(family) : materialId(family, tier));

/**
 * Cost of breakthrough gate 1..10.
 * @returns {{id:string,count:number}[]}
 */
export function breakthroughCost(unitId, gate) {
  const unit = getUnit(unitId);
  const g = GATE_COSTS[gate - 1];
  if (!g) return [];
  return [
    ...g.mats.map(([r, count]) => ({ id: matFor(unit.materialFamily, r), count })),
    ...(g.crowns ? [{ id: 'crown_rainbow', count: g.crowns }] : []),
    { id: 'coins', count: g.coins },
  ];
}

/**
 * @returns {{ ok: boolean, reason?: 'notOwned'|'max'|'potential'|'level'|'missing', missing: {id,need,have}[], gate?: number, cost?: object[], needP?: number, needLevel?: number }}
 */
export function canBreakthrough(profile, unitId) {
  const unit = profile.units[unitId];
  if (!unit) return { ok: false, reason: 'notOwned', missing: [] };
  if (unit.breakthrough >= MAX_BREAKTHROUGH) return { ok: false, reason: 'max', missing: [] };
  const gate = unit.breakthrough + 1;
  const cost = breakthroughCost(unitId, gate);
  const missing = missingItems(profile, cost);
  const needP = gatePotential(gate);
  if (potentialLevel(unit) < needP) return { ok: false, reason: 'potential', missing, gate, cost, needP };
  if (unit.level < levelCap(unit)) return { ok: false, reason: 'level', missing, gate, cost, needLevel: levelCap(unit) };
  if (missing.length) return { ok: false, reason: 'missing', missing, gate, cost };
  return { ok: true, missing: [], gate, cost };
}

/** Pass the next gate. @returns {{ ok: boolean, error?: string, missing?: object[], gate?: number, cap?: number }} */
export function breakthrough(profile, unitId) {
  const check = canBreakthrough(profile, unitId);
  if (!check.ok) return { ok: false, error: check.reason, missing: check.missing };
  if (!consumeItems(profile, check.cost)) return { ok: false, error: 'missing', missing: missingItems(profile, check.cost) };
  const unit = profile.units[unitId];
  unit.breakthrough += 1;
  mirrorUnit(profile, unitId);
  writeRosterMark(profile, unitId);
  track(profile, 'spendCoins', check.cost.find((c) => c.id === 'coins').count);
  return { ok: true, gate: unit.breakthrough, cap: levelCap(unit) };
}

// ---------------------------------------------------------------------------
// Awakening (stars) — crowns from boss drops + Star Fragments + coins
// ---------------------------------------------------------------------------

const AWAKEN_COSTS = [
  { crowns: [['crown_slime', 1]], fragments: 10, coins: 20000 },
  { crowns: [['crown_iron', 1]], fragments: 20, coins: 50000 },
  { crowns: [['crown_cog', 1], ['crown_iron', 1]], fragments: 30, coins: 100000 },
  { crowns: [['crown_oni', 1]], fragments: 50, coins: 200000 },
  { crowns: [['crown_dragon', 1], ['crown_oni', 1]], fragments: 80, coins: 400000 },
];

/**
 * Cost to reach awaken star 1..5.
 * @returns {{id:string,count:number}[]}
 */
export function awakenCost(unitId, star) {
  getUnit(unitId);
  const c = AWAKEN_COSTS[star - 1];
  if (!c) return [];
  return [...c.crowns.map(([id, count]) => ({ id, count })), { id: 'star_fragment', count: c.fragments }, { id: 'coins', count: c.coins }];
}

/** @returns {{ ok: boolean, reason?: string, missing: object[], star?: number, cost?: object[] }} */
export function canAwaken(profile, unitId) {
  const unit = profile.units[unitId];
  if (!unit) return { ok: false, reason: 'notOwned', missing: [] };
  if (unit.awaken >= MAX_AWAKEN) return { ok: false, reason: 'max', missing: [] };
  const star = unit.awaken + 1;
  const cost = awakenCost(unitId, star);
  const missing = missingItems(profile, cost);
  if (missing.length) return { ok: false, reason: 'missing', missing, star, cost };
  return { ok: true, missing: [], star, cost };
}

/** Awaken one star. ★3 unlocks the unit's awakenPassive. */
export function awaken(profile, unitId) {
  const check = canAwaken(profile, unitId);
  if (!check.ok) return { ok: false, error: check.reason, missing: check.missing };
  if (!consumeItems(profile, check.cost)) return { ok: false, error: 'missing', missing: missingItems(profile, check.cost) };
  const unit = profile.units[unitId];
  unit.awaken += 1;
  writeRosterMark(profile, unitId);
  track(profile, 'spendCoins', check.cost.find((c) => c.id === 'coins').count);
  return { ok: true, star: unit.awaken, passiveUnlocked: unit.awaken === 3 };
}

// ---------------------------------------------------------------------------
// Battle stats
// ---------------------------------------------------------------------------

/** Most a girl's burns and poisons grow from her gear ATK (half of it reaches them, gear-stats §B.3). */
export const GEAR_DOT_CAP = 1.25;

/**
 * Multipliers fed into the sim (CONTRACTS §5 / INTEGRATION_NOTES [sim]).
 * Unowned units get neutral level-1 stats so previews still work.
 * `potential` (1…6) is her Potential (src/systems/potential.js); the sim adds its steps.
 * Gear (docs/specs/GEAR_STATS.md, GEAR_AWAKEN.md): every total is capped here (BATTLE_CAPS, the MAX tags),
 * Every Line Counts adds its fill-in to the gear ATK part (Umeko / Miko: to Aura Power and aura radius),
 * and the club set travels as `club` / `clubN` for the sim's tricks. `pierceK` is her Pierce in whole
 * hundredths (the sim never handles the fraction); `rainbow` (UR pieces worn) is for the renderer only.
 * This is the one place gear reaches a tower's battle stats.
 * @returns {{ damageMul, rateMul, rangeMul, critChance, critMul, armorPen, costMul, ultHaste, pierceK, auraPct, auraRangeMul, dotMul, club, clubN, rainbow, awakenPassive, level, awaken, breakthrough, potential }}
 */
export function unitBattleStats(profile, unitId) {
  const a = battleStatsAt(profile, unitId, blastKit(unitId));
  // a hero whose blasts come with her levels (Kogane, Lv 15): her 200–300 % Pierce band as ATK until then, as reach
  // from then (the sim switches at her level-up: src/sim/mods.js resolveStats, `pierceAtkMul`; review M3 r4 LOW 2)
  if (!(heroBlastLevel(unitId) > 1)) return a;
  const b = battleStatsAt(profile, unitId, false);
  const mul = b.damageMul / a.damageMul;
  return mul > 1 + 1e-9 ? { ...a, pierceAtkMul: Math.round(mul * 10000) / 10000 } : a;
}

/** unitBattleStats with her Pierce judged as a blast kit's (`blast`: all of it reach) or a shot kit's (200 %, then ATK). */
function battleStatsAt(profile, unitId, blast) {
  const unit = profile?.units?.[unitId] || { level: 1, awaken: 0, breakthrough: 0 };
  const prof = profile || { units: {}, gear: {} };
  const g = gearStatTotals(prof, unitId);
  const set = gearSetInfo(prof, unitId);
  // her caps, with her 5-piece set cap lifted (GEAR_UPDATE.md §3.2)
  const C = gearCaps(set);
  let fill = gearFillIn(prof, unitId, { blast });
  // her average crit on damage that cannot crit (traps that never crit, burns, poisons: §8.3 lever 1). Never weaker:
  // where her crit lines fill in as ATK, she gets the better of that fill-in and the average crit
  const critChance = Math.min(C.critChance, g.critChance);
  const critMul = 1 + Math.min(C.critDmg, g.critDmg);
  let avgCrit = averageCrit(critChance, (UNIT_MAP[unitId]?.base?.crit?.mul || 1.5) * critMul);
  const dead = fillStats(unitId, { awaken: unit.awaken || 0, potential: potentialLevel(unit) });
  // (the aura girls' crit lines fill into their aura: never both, so no average crit for them)
  if (fill.target === 'aura' && (dead.has('critChance') || dead.has('critDmg'))) avgCrit = 1;
  if (fill.target === 'atk' && (dead.has('critChance') || dead.has('critDmg'))) {
    const alt = gearFillIn(prof, unitId, { skip: ['critChance', 'critDmg'], blast });
    if ((1 + g.atkPct + alt.total) * avgCrit > 1 + g.atkPct + fill.total) fill = alt;
    else avgCrit = 1;
  }
  const atkFill = fill.target === 'atk' ? fill.total : 0;
  const auraFill = fill.target === 'aura' ? fill.total : 0;
  const gearAtk = g.atkPct + atkFill;
  const level = unit.level || 1;
  const stars = unit.awaken || 0;
  const gates = unit.breakthrough || 0;
  const r4 = (v) => Math.round(v * 10000) / 10000;
  // gear ATK's share of her burns and poisons and its cap grow with the pieces she wears (§8.3 lever 2)
  const [dotShare, dotBase] = DOT_BY_PIECES[Math.min(5, set.pieces)];
  // five Blank LR pieces double the cap's bonus part (×2.0 → ×3.0)
  const dotCap = set.blankN >= BLANK_FIVE ? 1 + 2 * (dotBase - 1) : dotBase;
  // her ⚡ ability's haste: half her capped Skill Haste; Power Bank's set cap gives it half of all of it (§3.2)
  // (rounded as before the sets: 0.5 × her rounded haste, so no existing girl's charge per tick moves)
  const abilHaste = Math.min(ABIL_HASTE_CEIL, 0.5 * r4(Math.min(C.ultHaste, g.ultHaste)));
  // Party Popper's set cap: her blasts read all her Pierce up to 500 % (shots keep the cap)
  const blastK = set.set === 'popper' && set.setN >= 5 ? Math.min(BLAST_K_MAX, Math.round(100 * Math.min(C.piercePct, g.piercePct))) : 0;
  // what only the set cap lifts stays at her LR-raised cap for the rest of her kit: her hero ult's haste (the battle
  // reads ≤ 75 %) and her shots' Pierce
  const B = gearCaps({ ...set, set: null, setN: 0 });
  // [banners G3/G6] UR Resonance (★5 SSR) and Limit Break (LR) multiply on top, along her Potential axis
  const boost = rankBoost(prof, unitId, UNIT_MAP[unitId] ? potentialTrack(UNIT_MAP[unitId]) : null);
  return {
    damageMul: r4((1 + PER_LEVEL_DAMAGE * (level - 1) + PER_GATE_DAMAGE * gates + PER_STAR_DAMAGE * stars) * (1 + gearAtk) * boost.damage),
    rateMul: r4((1 + PER_LEVEL_RATE * (level - 1)) * (1 + g.ratePct) * boost.rate),
    rangeMul: r4(1 + Math.min(C.rangePct, g.rangePct)),
    critChance: r4(critChance),
    critMul: r4(critMul),
    armorPen: Math.round(Math.min(C.armorPen, g.armorPen) * 10) / 10,
    costMul: r4(Math.max(1 - C.costCut, 1 - g.costCut)),
    ultHaste: r4(Math.min(B.ultHaste, g.ultHaste)),
    // (a kit with no blasts stops at the 200 % a shot uses: the rest fills in as ATK, gearFillIn; review M3 r2 #1)
    pierceK: Math.round(100 * Math.min(pierceUseCap(unitId, B.piercePct, blast), g.piercePct)),
    auraPct: r4((1 + Math.min(C.auraPct, g.auraPct) + auraFill) * boost.aura - 1),
    auraRangeMul: r4((1 + Math.min(C.auraRangePct, g.auraRangePct)) * (1 + auraFill)),
    dotMul: r4(Math.min(dotCap, 1 + dotShare * gearAtk)),
    club: set.club,
    clubN: Math.min(3, set.clubN),
    rainbow: Math.min(3, set.ur),
    // the gear update (GEAR_UPDATE.md §2.4, §3.4): her set (4+ pieces), Buff Duration, Control Strength, her ⚡
    // ability's haste, her blasts' Pierce and her average crit (src/sim/setRules.js reads them)
    set: set.set,
    setN: set.set ? set.setN : 0,
    setLr: set.setLr, // five Set LR pieces of her set: its LR Set Form
    // crit over 100 % (super crits) only with Geometry's set cap or five Blank LR pieces (their caps pass 100 %)
    critCeil: C.critChance > 1 ? 2 : 1,
    buffDurMul: r4(1 + Math.min(C.buffDurPct, g.buffDurPct)),
    controlMul: r4(1 + Math.min(C.controlPct, g.controlPct)),
    abilHaste,
    blastK,
    avgCrit: r4(avgCrit),
    awakenPassive: stars >= 3,
    level,
    awaken: stars,
    breakthrough: gates,
    potential: potentialLevel(profile?.units?.[unitId]),
    lr: boost.lr, // [banners G6] her LR ability form (Prismfall · Twin Star) reads it in the sim
  };
}

/**
 * Single number for sorting/UI: base DPS × her balance round 5 factor (src/data/powerKit.js, never below 1) ×
 * multipliers × range factor, plus a small rarity weight; Potential multiplies in its whole-girl steps and adds 20 per
 * step (so every girl's Power moves). `kit: false` = Power without the round's factor (tests).
 * @returns {number}
 */
export function unitPower(profile, unitId, { kit = true } = {}) {
  const def = UNIT_MAP[unitId];
  if (!def) return 0;
  const s = unitBattleStats(profile, unitId);
  const b = def.base;
  const hits = Math.max(1, b.projectiles || 1) * (b.splash > 0 ? 1.5 : 1) * (b.chain > 0 ? 1 + b.chain * 0.5 : 1);
  const dps = Math.max(0.5, (b.damage || 0) * (b.rate || 0) * hits);
  const crit = 1 + s.critChance * ((b.crit?.mul || 1.5) * s.critMul - 1);
  const range = Math.sqrt(Math.max(1, (b.range || 1) * s.rangeMul));
  const rarity = { R: 1, SR: 1.1, SSR: 1.2 }[def.rarity] || 1;
  const pot = potentialPowerFactor(def, s.potential);
  const k = kit ? powerKitOf(unitId) : 1;
  return Math.round(dps * k * s.damageMul * s.rateMul * crit * range * rarity * pot * 10 + s.level * 5 + s.awaken * 50 + (s.potential - 1) * 20);
}
