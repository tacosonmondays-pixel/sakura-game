// The Potential Board's Growth % (docs/specs/POTENTIAL_BOARD.md "Growth"; UI_V2_MENUS.md section 6). Display only: it is
// computed from her state every time it is shown and never saved, never rewarded and never badged.
//
//   growth = floor(100 × (0.5 × (P − 1) / 5 + 0.3 × gates / 10 + 0.2 × (level − 1) / 84))
//   a unit with an LR step: floor(0.9 × that (unfloored) + 10 × (LR done))
//
// Worked in whole numbers so a floor never slips on a rounding error: × 100 the three parts are 10 per Potential step,
// 3 per breakthrough gate and 5/21 per level, so growth × 210 = 2100 (P − 1) + 630 gates + 50 (level − 1).
// Aoi at P4, LV 48 with 4 gates: (6300 + 2520 + 2350) / 210 = 53.19 → 53 %.
// Pure: no DOM, no store; the screens pass her numbers in (or her unit state to growthOf).

import { potentialLevel, MAX_POTENTIAL } from '../../systems/potential.js';
import { MAX_BREAKTHROUGH, MAX_LEVEL } from '../../systems/progression.js';

/** Growth × 210 at the top (P6, 10 gates, LV 85): 2100 × 5 + 630 × 10 + 50 × 84. */
const FULL = 21000;

const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(Number(v) || 0)));

/**
 * Her growth in 210ths of a percent (exact), and the three parts in whole percent points (each floored; for a
 * tooltip: "Potential 30 · Gates 12 · Level 11").
 * @param {{ p?: number, gates?: number, level?: number }} s
 * @returns {{ units: number, potential: number, gates: number, level: number }}
 */
export function growthParts({ p = 1, gates = 0, level = 1 } = {}) {
  const pp = clampInt(p, 1, MAX_POTENTIAL) - 1;
  const gg = clampInt(gates, 0, MAX_BREAKTHROUGH);
  const ll = clampInt(level, 1, MAX_LEVEL) - 1;
  return {
    units: 2100 * pp + 630 * gg + 50 * ll,
    potential: 10 * pp,
    gates: 3 * gg,
    level: Math.floor((50 * ll) / 210),
  };
}

/**
 * Growth %: 0…100, floored.
 * @param {{ p?: number, gates?: number, level?: number, lr?: boolean, lrDone?: boolean }} s
 *   p her Potential (1…6), gates her breakthrough gates (0…10), level (1…85); `lr` she has an LR step (the
 *   Board's crest point), `lrDone` she has taken it
 * @returns {number}
 */
export function growthPct({ p = 1, gates = 0, level = 1, lr = false, lrDone = false } = {}) {
  const { units } = growthParts({ p, gates, level });
  if (!lr) return Math.floor(units / 210);
  // 0.9 × units / 210 + 10 × done = (9 × units + 21000 × done) / 2100
  return Math.floor((9 * units + FULL * (lrDone ? 1 : 0)) / 2100);
}

/**
 * Growth % from her unit state (profile.units[id]); a girl not owned → 0.
 * @param {object|null|undefined} unitState
 * @param {{ lr?: boolean, lrDone?: boolean }} [o]
 * @returns {number}
 */
export function growthOf(unitState, { lr = false, lrDone = false } = {}) {
  if (!unitState) return 0;
  return growthPct({ p: potentialLevel(unitState), gates: unitState.breakthrough, level: unitState.level, lr, lrDone });
}
