// Shape tests for the attack shapes (docs/specs/ATTACK_SHAPES.md §4.2): squared distances only, so
// every engine decides the same victims. Callers take candidates from sim.grid (its own fixed order)
// and check eligibility with isEligible (src/sim/combat.js) themselves.
//
// S1 ("Wheels") needs inDisc and onLine; S2 ("Held") adds inCone (Hearth Stream) and nearSegment
// (Searchlight Sweep); S3 ("Ground") adds inBand (Ripple Quake) and onRoad (Bramble Road).

import { DIR_X, DIR_Y, COS2 } from './dirs.js';
import { segDistSq, segmentAt } from './path.js';
import { COS2_MAX, ROAD_SHARED, ROAD_SAME_DIR } from './constants.js';

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

/**
 * Is an enemy at squared distance d2 from a ring's centre inside the band the ring swept this step, r0 < d ≤ r1
 * (Kinu's heat ring rule, src/sim/rings.js)? r0 ≤ 0: the band starts at the centre (d = 0 counts).
 */
export function inBand(d2, r0, r1) {
  if (r0 > 0 && d2 <= r0 * r0) return false;
  return d2 <= r1 * r1;
}

/**
 * Is walker `e` on the stretch [d0, d1] (path distance) of road `pathIndex`? The 1-D test: e.pathIndex === pathIndex
 * and d0 ≤ e.dist ≤ d1. Shared stretches follow Marumi's rule (src/sim/balls.js sameRoad): a walker on another path
 * counts when its spot is within ROAD_SHARED of a segment of the stretch and its road runs the same way there
 * (unit direction dot > ROAD_SAME_DIR), so a fork's shared prefix or a join's shared suffix is one road, and a
 * crossing or an overpass is not. Squared distances and dot products only.
 */
export function onRoad(sim, e, pathIndex, d0, d1) {
  if (e.pathIndex === pathIndex) return e.dist >= d0 && e.dist <= d1;
  const path = sim.pathData[pathIndex];
  const other = sim.pathData[e.pathIndex];
  if (!path || !other || e.seg == null) return false;
  const od = other.dirs[e.seg];
  if (!od) return false;
  const s0 = segmentAt(path, d0 < 0 ? 0 : d0);
  const s1 = segmentAt(path, d1 > path.length ? path.length : d1, s0);
  const w2 = ROAD_SHARED * ROAD_SHARED;
  const pts = path.points;
  for (let s = s0; s <= s1; s++) {
    const a = pts[s];
    const b = pts[s + 1];
    const dir = path.dirs[s];
    if (!b || dir[0] * od[0] + dir[1] * od[1] <= ROAD_SAME_DIR) continue;
    if (segDistSq(e.x, e.y, a[0], a[1], b[0], b[1]) <= w2) return true;
  }
  return false;
}
