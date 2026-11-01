// The plain look of the S5b held shapes (docs/specs/ATTACK_SHAPES_S5.md §6, "ship plain, polish later"), drawn every
// frame from the sim's own records, never from an event and never written to. Render only: no sim rng.
//   - Spore Mist (Midori, t.mist): S2's cone puffs in her greens along the mist's aim, as wide as the sim's cone and
//     as long as its reach; no additive core (a mist has no hot centre).
//   - Moonbeam Sweep (Luna, t.moon): each beam an alpha band (its sim half-width) and a thin additive core while the
//     pass runs, fading over MOON_LINGER steps after it ends. With the VFX library on (ctx.strokes) it is a toon beam
//     instead (MOON_TOON: ink, a banded lavender body, a white core; half as wide as the band, part see-through, and it
//     breaks into dashes as it lingers).
// Only the moonbeam cores are additive and they are thin (< 0.3 tiles: the flash guard, docs/VFX.md); the bodies are
// alpha-blended and held. Reduce Motion: no flicker of the mist widths.
import { CORE } from '../context.js';
import { DIR_X, DIR_Y, COS2 } from '../../../sim/dirs.js';
import { STREAM_KINDS } from '../../../sim/held.js';
import { moonDir } from '../../../sim/s5shapes.js';
import { COS2_MAX, MOON_HALF_WIDTH, MOON_LINGER } from '../../../sim/constants.js';
import { hand } from '../styles/util.js';
import { stroke, SOLID, BANDS } from '../../vfx/strokes.js';

const PUFFS = 4;
const MOON_BODY = '#d9ceff';
const MOON_CORE = '#f6f2ff';
/**
 * The toon moonbeam (with the VFX library): the body's half width, the ink round it, the core's share, its strength
 * (part see-through: it is held over the board for a while), the running bands (per world unit, per second; still under
 * Reduce Motion and on low), how far it erodes as it lingers, the thinnest each layer is drawn (CSS px).
 */
export const MOON_TOON = { half: 0.11, ink: 0.02, core: 0.42, a: 0.75, bandFreq: 3, bandSpeed: 1.5, erode: 0.8, minPx: { ink: 2.2, body: 1.4, core: 0.7 } };
const _S = stroke();
const MOON_INK = [0.16, 0.12, 0.32];
/** The body's and core's colours as the strokes take them (linear), read once through the context's colour cache. */
const MOON_RGB = { body: null, core: null };
const rgbOf = (ctx, key, hex) => {
  if (!MOON_RGB[key]) {
    const c = ctx.col(hex);
    MOON_RGB[key] = [c.r, c.g, c.b];
  }
  return MOON_RGB[key];
};

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
  // the toon beam when the library is on (an error pushing it: the library switches off and the old band is drawn)
  if (ctx.strokes) {
    try {
      // (strokes, not quads: nothing against the styles' quad budget)
      if (moonToon(ctx, t, m, hd, Lb, left) >= 0) return 0;
    } catch (err) {
      if (!ctx.vfxError) throw err;
      ctx.vfxError(err);
    }
  }
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

/** The moonbeams as toon strokes (all the inks, then the bodies, then the cores). @returns {number} strokes, or -1 when they do not fit */
function moonToon(ctx, t, m, hd, Lb, left) {
  const L = ctx.strokes;
  const nb = m.hits.length;
  if (!nb) return 0;
  if (L.room && L.room() < nb * 3) return -1;
  const T = MOON_TOON;
  const S = _S;
  const body = rgbOf(ctx, 'body', MOON_BODY);
  const core = rgbOf(ctx, 'core', MOON_CORE);
  const bands = !ctx.reduceMotion && ctx.quality !== 'low';
  S.head = 99;
  S.tail = -99;
  S.noise = 6;
  S.hdr = 0;
  S.thru = 0;
  S.a = T.a * left;
  S.cut = (1 - left) * T.erode;
  S.ua = 0;
  let n = 0;
  for (let layer = 0; layer < 3; layer++) {
    S.kind = layer === 1 && bands ? BANDS : SOLID;
    S.bandFreq = layer === 1 && bands ? T.bandFreq : 0;
    S.bandSpeed = layer === 1 && bands ? T.bandSpeed : 0;
    S.minPx = layer === 0 ? T.minPx.ink : layer === 1 ? T.minPx.body : T.minPx.core;
    const c = layer === 0 ? MOON_INK : layer === 1 ? body : core;
    S.r = c[0];
    S.g = c[1];
    S.b = c[2];
    S.wa = S.wb = layer === 0 ? T.half + T.ink : layer === 1 ? T.half : T.half * T.core;
    for (let b = 0; b < nb; b++) {
      const k = moonDir(m, b);
      S.ax = hd.x; S.ay = hd.h; S.az = hd.y;
      S.bx = t.ox + DIR_X[k] * Lb; S.by = 0.35; S.bz = t.oy + DIR_Y[k] * Lb;
      S.ub = Math.hypot(S.bx - S.ax, S.by - S.ay, S.bz - S.az);
      S.seed = b * 1.7 + 0.3;
      if (L.push(S)) n++;
    }
  }
  return n;
}
