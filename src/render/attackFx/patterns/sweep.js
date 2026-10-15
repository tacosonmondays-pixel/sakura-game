// Arc sweeps for area girls: light rays / a crescent sweeping across the angular span of the
// enemies the attack really hit, never wider than the sim radius.
import { CORE, DECOR } from '../context.js';
import { GROUND, EASE_OUT } from '../quadPool.js';
import { wrapAngle } from '../math/steer.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/**
 * Angular span of the victims around (cx, cy) (angles: atan2(dx, dy), like tower facing).
 * Padded by `pad` each side, at least `minSpan`, a full circle above 300°.
 * Writes out.a0, out.a1, out.r (mean distance), out.n. Pure.
 * @param {{x:number,y:number}[]|null} pts victim points (or use ctx enemy views via uids)
 */
export function spanOf(cx, cy, xs, ys, n, out, pad = 20 * DEG, minSpan = 100 * DEG, fallback = 0) {
  out.n = n;
  if (!n) {
    out.a0 = fallback - minSpan / 2;
    out.a1 = fallback + minSpan / 2;
    out.r = 1;
    return out;
  }
  let sx = 0;
  let sy = 0;
  let rs = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - cx;
    const dy = ys[i] - cy;
    const d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
    sx += dx / d;
    sy += dy / d;
    rs += d;
  }
  const mean = Math.atan2(sx, sy);
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < n; i++) {
    const dv = wrapAngle(Math.atan2(xs[i] - cx, ys[i] - cy) - mean);
    if (dv < lo) lo = dv;
    if (dv > hi) hi = dv;
  }
  let a0 = mean + lo - pad;
  let a1 = mean + hi + pad;
  if (a1 - a0 < minSpan) {
    const m = (a0 + a1) / 2;
    a0 = m - minSpan / 2;
    a1 = m + minSpan / 2;
  }
  if (a1 - a0 > 300 * DEG) {
    a0 = mean - Math.PI;
    a1 = mean + Math.PI;
  }
  out.a0 = a0;
  out.a1 = a1;
  out.r = rs / n;
  return out;
}

/** Ground light rays from (cx, cy) fanning a0 → a1 one after another over `dur`. */
export function raySweep(ctx, cx, cy, a0, a1, r, count, dur, c, width = 0.32, life = 0.22, a = 0.95) {
  for (let i = 0; i < count; i++) {
    const k = count > 1 ? i / (count - 1) : 0.5;
    const ang = a0 + (a1 - a0) * k;
    const len = r * (0.82 + 0.18 * Math.sin(k * Math.PI));
    const x = cx + Math.sin(ang) * len * 0.5;
    const y = cy + Math.cos(ang) * len * 0.5;
    const p = ctx.spr(ctx.b.groundA, i % 2 ? DECOR : CORE, ctx.R.ray, x, 0.08, y, width, width, life, c, a);
    if (!p) continue;
    p.asp = 1;
    p.s0 = len * 0.7;
    p.s1 = len;
    p.asp = width / len; // w = s·asp keeps the ray's width while its length grows
    p.rot = ang + Math.PI;
    p.delay = dur * k;
    p.flags = GROUND | EASE_OUT;
  }
}

/** Soft ground fan decal covering the swept span (90° wedge sprites side by side). */
export function fanDecal(ctx, cx, cy, a0, a1, r, c, life = 0.3, a = 0.35) {
  const span = a1 - a0;
  const n = Math.max(1, Math.ceil(span / (90 * DEG) - 0.05));
  const step = span / n;
  for (let i = 0; i < n; i++) {
    const mid = a0 + step * (i + 0.5);
    const p = ctx.spr(ctx.b.groundA, DECOR, ctx.R.fan, cx, 0.065, cy, r * 1.6, r * 2, life, c, a);
    if (!p) continue;
    p.rot = mid + Math.PI;
    p.asp = Math.min(1, (step / (90 * DEG)) * 1.05);
    p.flags = GROUND | EASE_OUT;
  }
}

/**
 * Crescent that sweeps across the span at radius r: `steps` slash sprites lit one after the
 * other (billboards standing at the enemies' body height).
 */
export function crescentSweep(ctx, cx, cy, a0, a1, r, dur, c, size = 0.8, steps = 5, h = 0.4, life = 0.14) {
  for (let i = 0; i < steps; i++) {
    const k = steps > 1 ? i / (steps - 1) : 0.5;
    const ang = a0 + (a1 - a0) * k;
    const x = cx + Math.sin(ang) * r;
    const y = cy + Math.cos(ang) * r;
    const p = ctx.spr(ctx.b.bbA, i % 2 ? DECOR : CORE, ctx.R.slash, x, h, y, size * 0.8, size, life, c, 0.95);
    if (!p) continue;
    p.asp = 2;
    // tangent of the arc on screen ≈ the crescent's long axis
    p.rot = ctx.screenAngle(x, h, y, Math.cos(ang), 0, -Math.sin(ang)) + Math.PI;
    p.delay = dur * k;
    p.flags = EASE_OUT;
  }
}

/** Point on the arc (for victims markers). */
export function arcPoint(cx, cy, ang, r, out) {
  out.x = cx + Math.sin(ang) * r;
  out.y = cy + Math.cos(ang) * r;
  return out;
}

export { TAU, DEG };
