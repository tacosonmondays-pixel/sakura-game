// Shape tests for the attack shapes (docs/specs/ATTACK_SHAPES.md §4.2): squared distances only, so
// every engine decides the same victims. Callers take candidates from sim.grid (its own fixed order)
// and check eligibility with isEligible (src/sim/combat.js) themselves.
//
// S1 ("Wheels") needs inDisc and onLine; S2 ("Held") adds inCone (Hearth Stream) and nearSegment
// (Searchlight Sweep); S3 ("Ground") adds inBand (Ripple Quake) and onRoad (Bramble Road).

import { DIR_X, DIR_Y, COS2 } from './dirs.js';
import { segDistSq, pointAt } from './path.js';
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

// onRoad's clipped stretch ends (scratch, written by pointAt)
const ROAD_A = {};
const ROAD_B = {};

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
  const lo = d0 < 0 ? 0 : d0;
  const hi = d1 > path.length ? path.length : d1;
  if (hi < lo) return false;
  // the stretch's segments, the first and last clipped to [d0, d1] (pointAt at both ends)
  const A = pointAt(path, lo, ROAD_A);
  const B = pointAt(path, hi, ROAD_B, A.seg);
  const w2 = ROAD_SHARED * ROAD_SHARED;
  const pts = path.points;
  for (let s = A.seg; s <= B.seg; s++) {
    const dir = path.dirs[s];
    if (!dir || dir[0] * od[0] + dir[1] * od[1] <= ROAD_SAME_DIR) continue;
    const a = s === A.seg ? [A.x, A.y] : pts[s];
    const b = s === B.seg ? [B.x, B.y] : pts[s + 1];
    if (segDistSq(e.x, e.y, a[0], a[1], b[0], b[1]) <= w2) return true;
  }
  return false;
}

/**
 * Attack shapes S5 (docs/specs/ATTACK_SHAPES_S5.md rules 2, 3 and 6): the clean copy of her attack `spec` for a shape
 * hit at `mul` of one hit. Damage only: no statuses, marks, pushes, splash, silence or reveal; `noShare` (Ena's
 * threads neither share nor split it, Sim._hit); `shape` (its damage goes to t.shapeDealt, which every damage-ranked
 * pick leaves out). It rolls no crit: her expected crit, 1 + c × (m − 1) as computeHit reads them (src/sim/combat.js), is
 * in its damage, so the shared rng sees exactly live's draws. `share: mul` scales flat armour, the floor and a crystal
 * shell's count with it.
 */
export function shapeSpec(spec, mul) {
  const c = Math.min(1, Math.max(0, spec.critChance || 0));
  const m = spec.critMul || 1.5;
  const crit = c > 0 ? 1 + c * (m - 1) : 1;
  return {
    ...spec,
    damage: spec.damage * mul * crit,
    share: mul,
    critChance: 0,
    critMul: 1,
    status: [],
    procStatus: null,
    mark: null,
    silence: 0,
    reveal: 0,
    knockback: 0,
    gather: 0,
    splash: 0,
    hpPct: 0,
    barricade: null,
    noShare: true,
    shape: true,
  };
}

/**
 * The damage a girl's picks rank her by (attack shapes S5 rule 6): her damage without her S5 shape damage, so a partner
 * never loses a brew, link, rally or drink to an S5 girl (src/sim/buffs.js recentDps, src/sim/abilities.js
 * topDamageGirl, src/sim/drinks.js). Shown totals (results, the honest readout) keep all of it.
 */
export function allocDealt(t) {
  return t.damageDealt - (t.shapeDealt || 0);
}
