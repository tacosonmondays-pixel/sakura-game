// The shared direction table (docs/specs/ATTACK_SHAPES.md §4.1): RING_DIRS unit vectors, k = 0 pointing
// +y (the sim's facing convention), clockwise, built once at load with the deterministic sin / cos
// (src/core/detMath.js), so every engine aims and flies the same shots. 240 divides by 2, 3, 4, 5, 6,
// 8, 10, 12, 15, 16, 20, 24, 30, 40, 48 and 60, so every "N shots evenly round" and every 1/16 turn
// is exact. Moved out of src/sim/rings.js (Kinu's ring) for the attack shapes; ringDir stays there as
// an alias.
//
// Determinism: no trig at runtime. nearestDir replaces atan2 for aiming with dot products (+ − × and
// compares only); turnToward is integer arithmetic mod RING_DIRS.

import { DET_MATH } from '../core/detMath.js';
import { RING_DIRS } from './constants.js';

/** The table's unit vectors (x, y) by index. */
export const DIR_X = new Float64Array(RING_DIRS);
export const DIR_Y = new Float64Array(RING_DIRS);
for (let k = 0; k < RING_DIRS; k++) {
  const a = (2 * Math.PI * k) / RING_DIRS;
  DIR_X[k] = DET_MATH.sin(a);
  DIR_Y[k] = DET_MATH.cos(a);
}

/** Index k wrapped into [0, RING_DIRS). Integers in, an integer out. */
export function wrapDir(k) {
  return ((k % RING_DIRS) + RING_DIRS) % RING_DIRS;
}

/** Direction k of the table (wrapped). @returns {[number, number]} */
export function dir(k) {
  const i = wrapDir(k);
  return [DIR_X[i], DIR_Y[i]];
}

const COARSE = 10;

/**
 * The table index whose direction is closest to (dx, dy): the largest dot product. A coarse scan of
 * every COARSE-th entry, then the entries within COARSE − 1 of the best; equal dots go to the lower
 * index. (0, 0) gives 0.
 */
export function nearestDir(dx, dy) {
  let best = 0;
  let bestDot = -Infinity;
  for (let k = 0; k < RING_DIRS; k += COARSE) {
    const d = dx * DIR_X[k] + dy * DIR_Y[k];
    if (d > bestDot) {
      bestDot = d;
      best = k;
    }
  }
  let fine = best;
  for (let j = -(COARSE - 1); j <= COARSE - 1; j++) {
    const k = wrapDir(best + j);
    const d = dx * DIR_X[k] + dy * DIR_Y[k];
    if (d > bestDot || (d === bestDot && k < fine)) {
      bestDot = d;
      fine = k;
    }
  }
  return fine;
}

/** Moves index k at most maxSteps table steps toward kTarget, the short way round (half-turn ties go clockwise). */
export function turnToward(k, kTarget, maxSteps) {
  const half = RING_DIRS / 2;
  let diff = wrapDir(kTarget - k);
  if (diff > half) diff -= RING_DIRS;
  if (diff > maxSteps) diff = maxSteps;
  else if (diff < -maxSteps) diff = -maxSteps;
  return wrapDir(k + diff);
}
