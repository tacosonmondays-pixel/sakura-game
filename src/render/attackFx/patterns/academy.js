// Shape helpers for the academy girls' attacks (Azami, Kinu, Wakaba, Yuzuha, Ouka, Chigusa, Marumi).
// Thin, bright-edged additive pieces built from the pooled game-time quads (ctx.spr) or drawn for
// this frame only (ctx.line / ctx.quadRGB): streaks, spikes, ground spokes, zigzags, a net patch, a
// coil, a squash puff. Nothing allocates per call; the pure maths at the bottom is unit tested
// (tests/render/academyFx.test.js).
import { CORE, DECOR } from '../context.js';
import { GROUND, EASE_OUT } from '../quadPool.js';

const TAU = Math.PI * 2;

/** Ground-quad rotation that lays a quad's long (local x) axis along world direction (ux, uy). */
export function groundRot(ux, uy) {
  return Math.atan2(-uy, ux);
}

/** Deterministic 0..1 hash of an integer (display jitter that does not flicker per frame). */
export function hash01(n) {
  let x = (n | 0) * 374761393 + 668265263;
  x = (x ^ (x >>> 13)) * 1274126177;
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/**
 * Progress of a bounce leg: how far along the straight line from the leg start (sx, sy) to the
 * target (tx, ty) the ball at (x, y) is (0 at the start, 1 on the target). Uses the distance
 * travelled over travelled + remaining, so a moving target never sends it backwards much.
 */
export function legProgress(sx, sy, x, y, tx, ty) {
  const a = Math.hypot(x - sx, y - sy);
  const b = Math.hypot(tx - x, ty - y);
  const s = a + b;
  return s < 1e-6 ? 1 : a / s;
}

/** Squash factor of a ball that just bounced: wide and flat at t = 0, round by `dur`. */
export function squash(t, dur = 0.12) {
  if (t >= dur || dur <= 0) return 1;
  const k = t / dur;
  return 1 + 0.6 * (1 - k) * (1 - k);
}

/**
 * A pooled streak lying along the world direction (dx, dh, dy), centred at (x, h, y): len long,
 * `thick` wide. grow: starts at 60% and eases out to full size. Returns the quad or null.
 */
export function streak(ctx, cls, x, h, y, dx, dh, dy, len, thick, life, c, a = 1, grow = true) {
  const p = ctx.spr(ctx.b.bbA, cls, ctx.R.beam, x, h, y, grow ? thick * 0.6 : thick, thick, life, c, a);
  if (!p) return null;
  p.asp = len / Math.max(1e-3, thick);
  p.rot = ctx.screenAngle(x, h, y, dx, dh, dy);
  if (grow) p.flags = EASE_OUT;
  return p;
}

/**
 * n short bright spikes jutting up along the ground line through (x, y) with direction (ux, uy). With
 * `dark`, each spike gets a dark normal-blend body under its bright edge, so it reads on a pale road.
 */
export function spikes(ctx, x, y, ux, uy, span, n, len, c, life = 0.2, cls = CORE, dark = null) {
  for (let i = 0; i < n; i++) {
    const k = n > 1 ? i / (n - 1) - 0.5 : 0;
    const px = x + ux * span * k;
    const py = y + uy * span * k;
    const hgt = (0.85 + 0.3 * hash01(i * 7 + n)) * len;
    if (dark) {
      const q = ctx.spr(ctx.b.bbN, i === 0 ? CORE : cls, ctx.R.white, px, 0.08 + hgt * 0.5, py, 0.07, 0.07, life, dark, 0.9);
      if (q) {
        q.asp = hgt / 0.07;
        q.rot = ctx.screenAngle(px, 0.08 + hgt * 0.5, py, 0, 1, 0);
        q.delay = 0.015 * i;
      }
    }
    const p = streak(ctx, i === 0 ? CORE : cls, px, 0.08 + hgt * 0.5, py, 0, 1, 0, hgt, dark ? 0.05 : 0.065, life, c, 1, !dark);
    if (p) p.delay = 0.015 * i;
  }
}

/** Radial spokes on the ground around (x, y): a starburst from r0 to r1. */
export function spokes(ctx, x, y, n, r0, r1, c, life = 0.16, phase = 0, a = 0.9, cls = CORE, additive = true) {
  const len = r1 - r0;
  const mid = (r0 + r1) / 2;
  for (let i = 0; i < n; i++) {
    const ang = phase + (i / n) * TAU;
    const ux = Math.sin(ang);
    const uy = Math.cos(ang);
    const p = ctx.spr(additive ? ctx.b.groundA : ctx.b.groundN, i < 4 ? CORE : cls, ctx.R.beam, x + ux * mid, 0.075, y + uy * mid, 0.05, 0.08, life, c, a);
    if (!p) continue;
    p.asp = len / 0.065;
    p.rot = groundRot(ux, uy);
    p.flags = GROUND | EASE_OUT;
  }
}

/** One flat ground streak along (ux, uy) centred at (x, y) (a skid, a slap mark). */
export function groundStreak(ctx, x, y, ux, uy, len, thick, c, life = 0.25, a = 0.8, cls = CORE, additive = true) {
  const p = ctx.spr(additive ? ctx.b.groundA : ctx.b.groundN, cls, ctx.R.beam, x, 0.072, y, thick * 0.6, thick, life, c, a);
  if (!p) return null;
  p.asp = len / Math.max(1e-3, thick);
  p.rot = groundRot(ux, uy);
  p.flags = GROUND | EASE_OUT;
  return p;
}

/** This frame only: a jittered zigzag from a to b in k pieces (an electric dart, a fork). */
export function zigzag(ctx, cls, ax, ah, ay, bx, bh, by, k, amp, w, c, a = 1) {
  let px = ax;
  let ph = ah;
  let py = ay;
  for (let i = 1; i <= k; i++) {
    const f = i / k;
    const j = i === k ? 0 : (ctx.rand() - 0.5) * 2 * amp;
    const qx = ax + (bx - ax) * f + j;
    const qh = ah + (bh - ah) * f + j * 0.6;
    const qy = ay + (by - ay) * f - j;
    if (!ctx.line(ctx.b.bbA, cls, px, ph, py, qx, qh, qy, w, c, a)) return;
    px = qx;
    ph = qh;
    py = qy;
  }
}

/** Short electric forks out of (x, h, y), pooled segments re-jittered each frame (capped by caller). */
export function forks(ctx, x, h, y, n, len, c, life = 0.14, phase = 0) {
  for (let i = 0; i < n; i++) {
    const ang = phase + (i / n) * TAU;
    const s = ctx.segs.add(x, h, y, x + Math.sin(ang) * len, h + 0.12 * ((i % 2) * 2 - 1), y + Math.cos(ang) * len, 0.08, c, life, 4 | 1);
    if (s) s.k = 3;
  }
}

/** This frame only: a little net patch (two crossing pairs of lines) on the ground at (x, y). */
export function netPatch(ctx, x, y, s, rot, c, a = 0.8) {
  const ux = Math.cos(rot) * s;
  const uy = Math.sin(rot) * s;
  const B = ctx.b.bbA;
  // u = (ux, uy), v = (-uy, ux): two lines along u offset ±0.35 v, two along v offset ±0.35 u
  for (let i = -1; i <= 1; i += 2) {
    const vx = -uy * 0.35 * i;
    const vy = ux * 0.35 * i;
    ctx.line(B, DECOR, x - ux + vx, 0.12, y - uy + vy, x + ux + vx, 0.12, y + uy + vy, 0.025, c, a);
    const wx = ux * 0.35 * i;
    const wy = uy * 0.35 * i;
    ctx.line(B, DECOR, x + uy + wx, 0.12, y - ux + wy, x - uy + wx, 0.12, y + ux + wy, 0.025, c, a);
  }
}

/**
 * This frame only: a coil of `n` short strokes winding round a point at height h0..h1 (a vine
 * wrapped round a held enemy, a towel twist). time drives the turn.
 */
export function coil(ctx, x, y, r, h0, h1, n, time, c, a = 0.9, w = 0.04) {
  const B = ctx.b.bbA;
  let px = x + Math.sin(time) * r;
  let py = y + Math.cos(time) * r;
  let ph = h0;
  for (let i = 1; i <= n; i++) {
    const ang = time + i * 1.25;
    const qx = x + Math.sin(ang) * r;
    const qy = y + Math.cos(ang) * r;
    const qh = h0 + ((h1 - h0) * i) / n;
    if (!ctx.line(B, i === 1 ? CORE : DECOR, px, ph, py, qx, qh, qy, w, c, a)) return;
    px = qx;
    py = qy;
    ph = qh;
  }
}

/** A squash puff where a ball hits the ground: a flat wide flash, two dust puffs thrown sideways. */
export function squashPuff(ctx, x, y, ux, uy, c, dust, size = 1, additive = true) {
  const p = ctx.spr(ctx.b.bbA, CORE, ctx.R.glow, x, 0.14, y, 0.5 * size, 0.85 * size, 0.16, c, 1);
  if (p) {
    p.asp = 2.2;
    p.flags = EASE_OUT;
  }
  groundStreak(ctx, x, y, -uy, ux, 0.7 * size, 0.16 * size, c, 0.2, 0.7, CORE, additive);
  const n = ctx.reduceMotion ? 1 : 2;
  for (let s = -1; s <= 1; s += 2) {
    for (let i = 0; i < n; i++) {
      const q = ctx.spr(ctx.b.bbN, DECOR, ctx.R.smoke || ctx.R.soft, x, 0.12, y, 0.16 * size, 0.34 * size, 0.42, dust, 0.55);
      if (!q) continue;
      const sp = 1.1 + i * 0.5;
      q.vx = (-uy * s + ux * 0.2) * sp;
      q.vz = (ux * s + uy * 0.2) * sp;
      q.vy = 0.35;
      q.drag = 4;
      q.flags = EASE_OUT;
    }
  }
}

/** A small rising status cue over an enemy (sprite, colour), DECOR. */
export function statusCue(ctx, uv, x, h, y, size, c, life = 0.45) {
  const p = ctx.spr(ctx.b.bbA, DECOR, uv, x, h, y, size * 0.6, size, life, c, 1);
  if (!p) return null;
  p.vy = 0.5;
  p.drag = 2;
  p.flags = EASE_OUT;
  return p;
}

export { TAU };
