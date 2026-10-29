// Shape tests for the attack shapes (docs/specs/ATTACK_SHAPES.md §4.2): squared distances only, so
// every engine decides the same victims. Callers take candidates from sim.grid (its own fixed order)
// and check eligibility with isEligible (src/sim/combat.js) themselves.
//
// S1 ("Wheels") needs inDisc and onLine; S2-S4 add inCone, inBand, nearSegment and onRoad here.

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
