// The plain look of the link attack shapes (attack shapes S4, docs/specs/ATTACK_SHAPES.md §5.6, §5.10, A2 #9 "ship
// plain, polish later"): drawn every frame from the sim's own state (sim.tethers), never from an event and never written
// to. Render only: no sim rng, no randomness at all.
//   - Spirit Tether: each living group a thread from member to member in tie order (her target first): a row of small
//     alpha beads hanging in a shallow sag between two members (a fixed sag curve, 4f(1 − f)), and a small knot on each
//     member; the thread fades over its last half second.
//   - Homecoming Throw: the fans are her own projectile records (src/sim/links.js), drawn by the projectile layer as
//     her gusts; nothing more here.
// Every body is alpha-blended (gN); the only additive quads (gA) are the knots, THREAD_KNOT tiles wide, under the flash
// guard's 0.3-tile line (docs/VFX.md), so none of this counts as a flash.

/** Beads this far apart along a thread (tiles), their size, the thread's height and its sag at mid-span (tiles). */
export const THREAD_STEP = 0.16;
export const THREAD_BEAD = 0.07;
export const THREAD_H = 0.42;
export const THREAD_SAG = 0.14;
/** A member's additive knot (tiles): under the flash guard's 0.3. */
export const THREAD_KNOT = 0.14;
/** Beads at most on one span (a long span is drawn sparser). */
const MAX_BEADS = 24;

/**
 * Pushes the link shapes into the ground batches (Actors.drawGround, every frame).
 * @param {object} sim the live Sim (read only)
 * @param {{ push: Function }} gN alpha batch
 * @param {{ push: Function }} gA additive batch
 * @param {object} R atlas regions (disc)
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
      if (m.dead) continue;
      gA.push(m.x, THREAD_H, m.y, THREAD_KNOT, THREAD_KNOT, R.disc, 1, 0.55, 0.65, 0.7 * a, 0);
      n++;
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
  const beads = Math.min(MAX_BEADS, Math.max(2, Math.ceil(len / THREAD_STEP)));
  for (let i = 1; i < beads; i++) {
    const f = i / beads;
    const h = THREAD_H - THREAD_SAG * 4 * f * (1 - f);
    gN.push(p.x + dx * f, h, p.y + dy * f, THREAD_BEAD, THREAD_BEAD, R.disc, 0.86, 0.22, 0.36, 0.85 * a, 0);
  }
  return beads - 1;
}
