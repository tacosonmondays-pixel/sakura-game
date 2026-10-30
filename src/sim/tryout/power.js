// Tryout Day (docs/specs/TRYOUT_DAY.md §9.2): the band. A girl's account stats count inside a run, raised
// to the Run Level floor and capped near a Lv 60 geared girl; a Loaner (a girl the player does not own)
// plays at the floor. Pure functions of the frozen account stats and the period, so a Continue or a co-op
// rejoin rebuilds exactly the numbers the Sim wrote in place at that period's start (§12.2).
import { TRYOUT } from '../../data/tryout.js';
import { DEFAULT_UNIT_STATS } from '../constants.js';
import { lengthOf } from './plan.js';

/** Run Level of period p: even integer steps from the first to the last Run Level. */
export function runLevelOf(length, p) {
  const len = lengthOf(length);
  const { first, last } = TRYOUT.runLevel;
  const i = Math.min(len.periods, Math.max(1, p | 0)) - 1;
  return first + Math.floor(((last - first) * i) / Math.max(1, len.periods - 1));
}

/** The floor's damage and attack-speed multipliers at a Run Level. */
export function floorAt(level) {
  return { damageMul: 1 + TRYOUT.perLevel.damage * (level - 1), rateMul: 1 + TRYOUT.perLevel.rate * (level - 1) };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * A girl's stats inside the run at a Run Level: each key clamped between the floor and the band cap.
 * `acct` null = a Loaner (the floor, P1, no gear, no club, no awakening passive).
 * @param {object|null} acct her frozen account stats (unitBattleStats' shape)
 * @param {number} level the Run Level
 * @returns {object} a full unit-stats object (DEFAULT_UNIT_STATS' keys)
 */
export function bandStats(acct, level) {
  const f = floorAt(level);
  const c = TRYOUT.bandCap;
  if (!acct) return { ...DEFAULT_UNIT_STATS, damageMul: f.damageMul, rateMul: f.rateMul, level };
  const a = { ...DEFAULT_UNIT_STATS, ...acct };
  return {
    ...a,
    damageMul: clamp(a.damageMul, f.damageMul, c.damageMul),
    rateMul: clamp(a.rateMul, f.rateMul, c.rateMul),
    rangeMul: clamp(a.rangeMul, 1, c.rangeMul),
    critChance: clamp(a.critChance, 0, c.critChance),
    critMul: clamp(a.critMul, 1, c.critMul),
    armorPen: clamp(a.armorPen, 0, c.armorPen),
    costMul: clamp(a.costMul, c.costMul, 1),
    ultHaste: clamp(a.ultHaste, 0, c.ultHaste),
    pierceK: clamp(Math.floor(a.pierceK || 0), 0, c.pierceK),
    auraPct: clamp(a.auraPct, 0, c.auraPct),
    auraRangeMul: clamp(a.auraRangeMul, 1, c.auraRangeMul),
    dotMul: clamp(a.dotMul, 1, c.dotMul),
    potential: clamp(Math.floor(a.potential || 1), 1, c.potential),
    level: Math.max(level, Math.min(85, a.level | 0)),
  };
}
