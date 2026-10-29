// The plain look of the link attack shapes (attack shapes S4, docs/specs/ATTACK_SHAPES.md §5.6, §5.10, A2 #9 "ship
// plain, polish later"): drawn every frame from the sim's own state (sim.tethers), never from an event and never written
// to. Render only: no sim rng, no randomness at all.
//   - Spirit Tether: each living group a thread from member to member in tie order (her target first), skipping members
//     that are dead or in a tunnel. A span is THREAD_PARTS solid ground quads stretched along it (the `white` sprite),
//     a dark under-stroke and a bright pink line on top, hanging in a shallow sag (a fixed curve, 4f(1 − f)) a little
//     above the ground, so it reads on grass and stone at phone size. Each member wears a pink ring on the ground under
//     its feet (outside its body) and a small bright knot in the middle of it. The thread fades over its last half second.
//   - Homecoming Throw: the fans are her own projectile records (src/sim/links.js), drawn by the projectile layer as
//     her gusts; nothing more here.
// Every body is alpha-blended (gN); the only additive quads (gA) are the knots, THREAD_KNOT tiles wide, under the 0.3-tile
// line at which an additive sprite counts as a world flash (the flash guard of the effects track: docs/VFX.md on the
// `feature/vfx` branch, summarised in docs/specs/ATTACK_SHAPES.md §2.5), so none of this counts as a flash.

/** A span's line widths (tiles): the dark under-stroke and the bright line; its height over the ground and its sag. */
export const THREAD_UNDER = 0.18;
export const THREAD_LINE = 0.1;
export const THREAD_H = 0.16;
export const THREAD_SAG = 0.08;
/** Ground quads a span is made of (the sag's steps). */
export const THREAD_PARTS = 4;
/** A member's ground ring (tiles) and its additive knot (under the flash guard's 0.3). */
export const THREAD_RING = 0.85;
export const THREAD_KNOT = 0.16;

/**
 * Pushes the link shapes into the ground batches (Actors.drawGround, every frame).
 * @param {object} sim the live Sim (read only)
 * @param {{ push: Function }} gN alpha batch
 * @param {{ push: Function }} gA additive batch
 * @param {object} R atlas regions (white, ring, disc)
 * @returns {number} quads pushed
 */
export function drawLinkShapes(sim, gN, gA, R) {
  const list = sim.tethers;
  if (!list || !list.length) return 0;
  let n = 0;
  for (const g of list) {
    const a = g.left < 30 ? Math.max(0, g.left / 30) : 1;
    if (!(a > 0)) continue;
    let prev = null;
    for (const m of g.m) {
      if (m.dead || m.hidden) continue;
      gN.push(m.x, 0.05, m.y, THREAD_RING, THREAD_RING, R.ring, 1, 0.42, 0.68, 0.9 * a, 0);
      gA.push(m.x, 0.055, m.y, THREAD_KNOT, THREAD_KNOT, R.disc, 1, 0.6, 0.8, 0.8 * a, 0);
      n += 2;
      if (prev) n += span(gN, R, prev, m, a);
      prev = m;
    }
  }
  return n;
}

function span(gN, R, p, q, a) {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (!(len > 1e-6)) return 0;
  // a ground quad's width runs along world (cos rot, −sin rot) in (x, z); z is the sim's y
  const rot = Math.atan2(-dy, dx);
  const part = len / THREAD_PARTS;
  for (let i = 0; i < THREAD_PARTS; i++) {
    const f = (i + 0.5) / THREAD_PARTS;
    const h = THREAD_H - THREAD_SAG * 4 * f * (1 - f);
    const x = p.x + dx * f;
    const y = p.y + dy * f;
    gN.push(x, h, y, part + 0.02, THREAD_UNDER, R.white, 0.22, 0.04, 0.12, 0.7 * a, rot);
    gN.push(x, h + 0.004, y, part + 0.02, THREAD_LINE, R.white, 1, 0.38, 0.66, 0.95 * a, rot);
  }
  return 2 * THREAD_PARTS;
}
