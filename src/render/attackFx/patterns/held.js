// The plain look of the held attack shapes (attack shapes S2, src/sim/held.js; docs/specs/ATTACK_SHAPES.md §5.3,
// §5.9, A2 #9 "ship plain, polish later"): drawn every frame from the sim's own channel (t.ch: her aim k, the
// shape's half-angle / arc and her range), never from an event and never written to. Render only: no sim rng.
//   - Hearth Stream: four alpha-blended puffs laid along the cone, each as wide as the sim's cone at its middle and
//     clamped so its corners stay inside her range (T5), and one thin additive core line from her hand.
//   - Searchlight Sweep: an alpha-blended band along the beam (its sim half-width) and a thin additive core line.
// The flash guard (docs/VFX.md) counts additive sprites of 0.3 tiles and more: only the thin cores (< 0.3 tiles)
// are additive, the bodies are alpha-blended and held, so a channel never reads as a stream of flashes.
// Reduce Motion: no flicker of the flame widths.
import { CORE } from '../context.js';
import { DIR_X, DIR_Y, COS2 } from '../../../sim/dirs.js';
import { STREAM_KINDS } from '../../../sim/held.js';
import { SWEEP_HALF_WIDTH, COS2_MAX } from '../../../sim/constants.js';
import { hand } from '../styles/util.js';

const PUFFS = 4;
const SWEEP_BODY = '#fff3c4';
const SWEEP_CORE = '#ffffff';

/** Draws a girl's held channel, if she has one open (attackFx update, every frame). @returns {number} quads pushed */
export function drawHeld(ctx, t) {
  const ch = t.ch;
  const e = t.eff;
  if (!ch || !e || t.disabled > 0) return 0;
  const shape = e.behavior;
  if (shape !== 'stream' && shape !== 'sweep') return 0;
  const k = ch.k;
  const ux = DIR_X[k];
  const uy = DIR_Y[k];
  const L = e.range;
  const ox = t.ox;
  const oy = t.oy;
  const hd = hand(ctx, t);
  const N = ctx.b.bbN;
  const A = ctx.b.bbA;
  let n = 0;
  if (shape === 'stream') {
    const w = t.stats.stream;
    const kind = STREAM_KINDS[w?.kind] || STREAM_KINDS.fire;
    const h = Math.max(0, Math.min(COS2_MAX, w?.half ?? 12));
    const c2 = COS2[h];
    // the cone's half-width per tile of length (tan of the half-angle; a 90° cone is a half disc)
    const tan = c2 > 1e-9 ? Math.sqrt(Math.max(0, 1 - c2) / c2) : Infinity;
    const body = ctx.col(kind.color);
    // puffs over [0.15, 0.9 L]; each puff's half-width is the sim cone's at its middle, clamped so its far corners stay
    // inside her range (the sim's cone is the wedge of her range disc: T5)
    const end = 0.9 * L;
    const seg = (end - 0.15) / PUFFS;
    for (let i = 0; i < PUFFS; i++) {
      const s0 = 0.15 + seg * i;
      const s1 = s0 + seg;
      const mid = (s0 + s1) / 2;
      const wob = ctx.reduceMotion ? 0 : 0.06 * Math.sin(ctx.time * 9 + i * 1.7);
      const hw = Math.min(mid * tan, Math.sqrt(Math.max(0, L * L - s1 * s1))) * (1 - Math.abs(wob));
      const width = Math.max(0.3, 2 * hw);
      const ah = 0.55 - 0.1 * (i / PUFFS);
      if (ctx.line(N, CORE, ox + ux * s0, ah, oy + uy * s0, ox + ux * s1, ah - 0.05, oy + uy * s1, width, body, 0.34 - 0.05 * i)) n++;
    }
    if (ctx.line(A, CORE, hd.x, hd.h, hd.y, ox + ux * L * 0.8, 0.45, oy + uy * L * 0.8, 0.12, ctx.col(kind.core), 0.55)) n++;
  } else {
    // the band ends where its corners meet her range
    const Lb = Math.sqrt(Math.max(0, L * L - SWEEP_HALF_WIDTH * SWEEP_HALF_WIDTH));
    if (ctx.line(N, CORE, hd.x, hd.h, hd.y, ox + ux * Lb, 0.35, oy + uy * Lb, 2 * SWEEP_HALF_WIDTH, ctx.col(SWEEP_BODY), 0.32)) n++;
    if (ctx.line(A, CORE, hd.x, hd.h, hd.y, ox + ux * Lb, 0.35, oy + uy * Lb, 0.1, ctx.col(SWEEP_CORE), 0.6)) n++;
  }
  return n;
}
