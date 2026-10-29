// Shape tests for the attack shapes (docs/specs/ATTACK_SHAPES.md §4.2): squared distances only, so
// every engine decides the same victims. Callers take candidates from sim.grid (its own fixed order)
// and check eligibility with isEligible (src/sim/combat.js) themselves.
//
// S1 ("Wheels") needs inDisc and onLine; S2 ("Held") adds inCone (Hearth Stream) and nearSegment
// (Searchlight Sweep); S3-S4 add inBand and onRoad here.

import { DIR_X, DIR_Y, COS2 } from './dirs.js';
import { segDistSq } from './path.js';
import { COS2_MAX } from './constants.js';

/** Enemy collision radius for shots, beams and shapes (moved here from src/sim/towers.js, which re-exports it). */
export function hitRadius(e) {
  return 0.3 + 0.06 * (e.def.size ?? 1);
}

/** Is an enemy at (ex, ey) with hit radius hr touching the disc of radius r around (cx, cy)? */
export function inDisc(cx, cy, r, ex, ey, hr) {
  const dx = ex - cx;
  const dy = ey - cy;
  const rr = r + hr;
  return dx * dx + dy * dy <= rr * rr;
}

/**
 * Is an enemy at offset (ex, ey) from an origin on the ray along the unit vector (dx, dy), within
 * `len` of the origin, its body (hr) within `halfWidth` of the line? (Pinwheel Stream's lock.)
 */
export function onLine(ex, ey, dx, dy, len, halfWidth, hr) {
  const dot = ex * dx + ey * dy;
  if (dot <= 0) return false;
  const cross = ex * dy - ey * dx;
  const w = halfWidth + hr;
  const l = len + hr;
  return cross * cross <= w * w && ex * ex + ey * ey <= l * l;
}

/**
 * Is an enemy at offset (ex, ey) from the cone's apex, hit radius hr, inside the cone along table direction k
 * with half-angle h table steps (clamped to 0…COS2_MAX) and length L? Its body reaches L + hr; touching the
 * apex (d² ≤ hr²) counts; otherwise it must be ahead (dot > 0) with dot² ≥ COS2[h] × d² (no square roots).
 * `k` must be a wrapped table index.
 */
export function inCone(ex, ey, k, h, L, hr) {
  const d2 = ex * ex + ey * ey;
  const lr = L + hr;
  if (d2 > lr * lr) return false;
  if (d2 <= hr * hr) return true;
  const dot = ex * DIR_X[k] + ey * DIR_Y[k];
  if (dot <= 0) return false;
  const c2 = COS2[h < 0 ? 0 : h > COS2_MAX ? COS2_MAX : h];
  return dot * dot >= c2 * d2;
}

/** Is an enemy at (px, py), hit radius hr, within halfWidth of the segment (ax, ay)-(bx, by)? (linePierce's rule) */
export function nearSegment(px, py, ax, ay, bx, by, halfWidth, hr) {
  const w = halfWidth + hr;
  return segDistSq(px, py, ax, ay, bx, by) <= w * w;
}
