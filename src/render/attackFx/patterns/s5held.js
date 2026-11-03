// The plain look of the S5b held shapes (docs/specs/ATTACK_SHAPES_S5.md §6, "ship plain, polish later"), drawn every
// frame from the sim's own records, never from an event and never written to. Render only: no sim rng.
//   - Spore Mist (Midori, t.mist): S2's cone puffs in her greens along the mist's aim, as wide as the sim's cone and
//     as long as its reach; no additive core (a mist has no hot centre).
//   - Moonbeam Sweep (Luna, t.moon): each beam an alpha band (its sim half-width) and a thin additive core while the
//     pass runs, fading over MOON_LINGER steps after it ends.
// Only the moonbeam cores are additive and they are thin (< 0.3 tiles: the flash guard, docs/VFX.md); the bodies are
// alpha-blended and held. Reduce Motion: no flicker of the mist widths.
import { CORE } from '../context.js';
import { DIR_X, DIR_Y, COS2 } from '../../../sim/dirs.js';
import { STREAM_KINDS } from '../../../sim/held.js';
import { moonDir } from '../../../sim/s5shapes.js';
import { COS2_MAX, MOON_HALF_WIDTH, MOON_LINGER } from '../../../sim/constants.js';
import { hand } from '../styles/util.js';

const PUFFS = 4;
const MOON_BODY = '#d9ceff';
const MOON_CORE = '#f6f2ff';

/** Draws a girl's Spore Mist and moonbeam pass, if open (attackFx update, every frame). @returns {number} quads pushed */
export function drawS5Held(ctx, t) {
  const e = t.eff;
  if (!e || t.disabled > 0) return 0;
  let n = 0;
  if (t.mist && t.stats?.mist) n += mist(ctx, t, e);
  if (t.moon && t.stats?.moon) n += moon(ctx, t, e);
  return n;
}

function mist(ctx, t, e) {
  const w = t.stats.mist;
  const k = t.mist.k;
  const ux = DIR_X[k];
  const uy = DIR_Y[k];
  const L = e.range * (w.len || 1);
  const h = Math.max(0, Math.min(COS2_MAX, Math.round(w.half || 30)));
  const c2 = COS2[h];
  const tan = c2 > 1e-9 ? Math.sqrt(Math.max(0, 1 - c2) / c2) : Infinity;
  const body = ctx.col(STREAM_KINDS.poison.color);
  const N = ctx.b.bbN;
  const end = 0.92 * L;
  const seg = (end - 0.15) / PUFFS;
  let n = 0;
  for (let i = 0; i < PUFFS; i++) {
    const s0 = 0.15 + seg * i;
    const s1 = s0 + seg;
    const mid = (s0 + s1) / 2;
    const wob = ctx.reduceMotion ? 0 : 0.05 * Math.sin(ctx.time * 4 + i * 1.3);
    const hw = Math.min(mid * tan, Math.sqrt(Math.max(0, L * L - s1 * s1))) * (1 - Math.abs(wob));
    if (ctx.line(N, CORE, t.ox + ux * s0, 0.4, t.oy + uy * s0, t.ox + ux * s1, 0.36, t.oy + uy * s1, Math.max(0.3, 2 * hw), body, 0.26 - 0.03 * i)) n++;
  }
  return n;
}

function moon(ctx, t, e) {
  const m = t.moon;
  const left = m.i <= m.P ? 1 : Math.max(0, 1 - (m.i - m.P) / MOON_LINGER);
  if (!(left > 0)) return 0;
  const L = e.range;
  const Lb = Math.sqrt(Math.max(0, L * L - MOON_HALF_WIDTH * MOON_HALF_WIDTH));
  const hd = hand(ctx, t);
  let n = 0;
  for (let b = 0; b < m.hits.length; b++) {
    const k = moonDir(m, b);
    const x1 = t.ox + DIR_X[k] * Lb;
    const y1 = t.oy + DIR_Y[k] * Lb;
    if (ctx.line(ctx.b.bbN, CORE, hd.x, hd.h, hd.y, x1, 0.35, y1, 2 * MOON_HALF_WIDTH, ctx.col(MOON_BODY), 0.3 * left)) n++;
    if (ctx.line(ctx.b.bbA, CORE, hd.x, hd.h, hd.y, x1, 0.35, y1, 0.1, ctx.col(MOON_CORE), 0.55 * left)) n++;
  }
  return n;
}
