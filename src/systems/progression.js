// Student progression: levels, breakthroughs, awakening and battle multipliers
// (owner: systems). See CONTRACTS.md §5.
//
// Scaling is deliberately modest (heroes used to be overpowered):
//   damage +1.8% per level after 1, +2% per breakthrough gate, +5% per awaken star (additive)
//   → level 60 / 5 gates / ★5 ≈ ×2.41 damage before gear.
//   attack rate +0.4% per level after 1.

import { UNIT_MAP, getUnit } from '../data/units.js';
import { ITEMS, materialId, bookId } from '../data/items.js';
import { ITEM_RARITY_ORDER } from '../data/types.js';
import { consumeItems, missingItems, itemCount, normalizeList } from './inventory.js';
import { gearStatTotals } from './gear.js';
import { track } from './missions.js';

export const MAX_LEVEL = 60;
export const MAX_BREAKTHROUGH = 5;
export const MAX_AWAKEN = 5;
/** Coins charged per point of EXP applied. */
export const COINS_PER_EXP = 0.4;

const PER_LEVEL_DAMAGE = 0.018;
const PER_GATE_DAMAGE = 0.02;
const PER_STAR_DAMAGE = 0.05;
const PER_LEVEL_RATE = 0.004;

/** Level cap for a unit state: 10 + 10 × breakthrough (max 60). */
export function levelCap(unitState) {
  return Math.min(MAX_LEVEL, 10 + 10 * (unitState?.breakthrough || 0));
}

/** EXP to go from `level` to `level + 1` (Infinity at max). */
export function expForLevel(level) {
  if (level >= MAX_LEVEL) return Infinity;
  return Math.round((40 * level ** 1.75 + 60) / 10) * 10;
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
    coinCost: Math.ceil(sim.applied * COINS_PER_EXP),
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

/** Per gate: [rarity, count] pairs + coins. Rarity escalates with each gate. */
const GATE_COSTS = [
  { mats: [['common', 8]], coins: 5000 },
  { mats: [['common', 12], ['rare', 5]], coins: 15000 },
  { mats: [['rare', 10], ['superRare', 4]], coins: 40000 },
  { mats: [['superRare', 10], ['mythic', 3]], coins: 100000 },
  { mats: [['mythic', 8], ['legendary', 2]], coins: 250000 },
];

/**
 * Cost of breakthrough gate 1..5 (raises the cap from 10·gate to 10·gate + 10).
 * @returns {{id:string,count:number}[]}
 */
export function breakthroughCost(unitId, gate) {
  const unit = getUnit(unitId);
  const g = GATE_COSTS[gate - 1];
  if (!g) return [];
  return [...g.mats.map(([r, count]) => ({ id: materialId(unit.materialFamily, r), count })), { id: 'coins', count: g.coins }];
}

/**
 * @returns {{ ok: boolean, reason?: 'notOwned'|'max'|'level'|'missing', missing: {id,need,have}[], gate?: number, cost?: object[] }}
 */
export function canBreakthrough(profile, unitId) {
  const unit = profile.units[unitId];
  if (!unit) return { ok: false, reason: 'notOwned', missing: [] };
  if (unit.breakthrough >= MAX_BREAKTHROUGH) return { ok: false, reason: 'max', missing: [] };
  const gate = unit.breakthrough + 1;
  const cost = breakthroughCost(unitId, gate);
  const missing = missingItems(profile, cost);
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
  track(profile, 'spendCoins', check.cost.find((c) => c.id === 'coins').count);
  return { ok: true, star: unit.awaken, passiveUnlocked: unit.awaken === 3 };
}

// ---------------------------------------------------------------------------
// Battle stats
// ---------------------------------------------------------------------------

/**
 * Multipliers fed into the sim (CONTRACTS §5 / INTEGRATION_NOTES [sim]).
 * Unowned units get neutral level-1 stats so previews still work.
 * @returns {{ damageMul, rateMul, rangeMul, critChance, critMul, armorPen, costMul, ultHaste, awakenPassive, level, awaken, breakthrough }}
 */
export function unitBattleStats(profile, unitId) {
  const unit = profile?.units?.[unitId] || { level: 1, awaken: 0, breakthrough: 0 };
  const g = gearStatTotals(profile || { units: {}, gear: {} }, unitId);
  const level = unit.level || 1;
  const stars = unit.awaken || 0;
  const gates = unit.breakthrough || 0;
  const r4 = (v) => Math.round(v * 10000) / 10000;
  return {
    damageMul: r4((1 + PER_LEVEL_DAMAGE * (level - 1) + PER_GATE_DAMAGE * gates + PER_STAR_DAMAGE * stars) * (1 + g.atkPct)),
    rateMul: r4((1 + PER_LEVEL_RATE * (level - 1)) * (1 + g.ratePct)),
    rangeMul: r4(1 + g.rangePct),
    critChance: r4(Math.min(0.75, g.critChance)),
    critMul: r4(1 + g.critDmg),
    armorPen: Math.round(g.armorPen * 10) / 10,
    costMul: r4(Math.max(0.75, 1 - g.costCut)),
    ultHaste: r4(Math.min(0.5, g.ultHaste)),
    awakenPassive: stars >= 3,
    level,
    awaken: stars,
    breakthrough: gates,
  };
}

/**
 * Single number for sorting/UI: base DPS × multipliers × range factor, plus a small rarity weight.
 * @returns {number}
 */
export function unitPower(profile, unitId) {
  const def = UNIT_MAP[unitId];
  if (!def) return 0;
  const s = unitBattleStats(profile, unitId);
  const b = def.base;
  const hits = Math.max(1, b.projectiles || 1) * (b.splash > 0 ? 1.5 : 1) * (b.chain > 0 ? 1 + b.chain * 0.5 : 1);
  const dps = Math.max(0.5, (b.damage || 0) * (b.rate || 0) * hits);
  const crit = 1 + s.critChance * ((b.crit?.mul || 1.5) * s.critMul - 1);
  const range = Math.sqrt(Math.max(1, (b.range || 1) * s.rangeMul));
  const rarity = { R: 1, SR: 1.1, SSR: 1.2 }[def.rarity] || 1;
  return Math.round(dps * s.damageMul * s.rateMul * crit * range * rarity * 10 + s.level * 5 + s.awaken * 50);
}
