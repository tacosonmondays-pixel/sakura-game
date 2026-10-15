// Familiars on fixed loops (stateless: positions are a function of game time).
//   ring patrol — evenly spaced on a circle (aura-edge lanterns, bells, gulls, motes)
//   figure-8   — a lemniscate centred on the girl (Aoi's paper crane)
// Aura familiars patrol EXACTLY at the aura radius so they show its real edge.
import { FAMILIAR, CORE } from '../context.js';

/** Point i of n on a circle (cx, cy, r) rotating at w rad/s. Writes out.x/y/ang. */
export function ringPoint(cx, cy, r, i, n, time, w, phase, out) {
  const a = phase + (i / Math.max(1, n)) * Math.PI * 2 + time * w;
  out.x = cx + Math.sin(a) * r;
  out.y = cy + Math.cos(a) * r;
  out.ang = a;
  return out;
}

/** Lemniscate of Bernoulli with lobe length `lobe`, one lap every `period` s. Writes out.x/y/dx/dy. */
export function figure8(cx, cy, lobe, time, period, phase, heading, out) {
  const t = phase + (time / period) * Math.PI * 2;
  const s = Math.sin(t);
  const c = Math.cos(t);
  const den = 1 + s * s;
  const u = (lobe * c) / den;
  const v = (lobe * s * c) / den;
  const ch = Math.cos(heading);
  const sh = Math.sin(heading);
  out.x = cx + u * ch - v * sh;
  out.y = cy + u * sh + v * ch;
  // derivative for facing
  const t2 = t + 0.01;
  const s2 = Math.sin(t2);
  const c2 = Math.cos(t2);
  const d2 = 1 + s2 * s2;
  const u2 = (lobe * c2) / d2;
  const v2 = (lobe * s2 * c2) / d2;
  out.dx = (u2 - u) * ch - (v2 - v) * sh;
  out.dy = (u2 - u) * sh + (v2 - v) * ch;
  return out;
}

const _rp = { x: 0, y: 0, ang: 0 };

/**
 * Draws n aura-edge familiars (billboards with a ground shadow) around a girl.
 * @param {number} r aura radius (exact)
 * @param {boolean} sel her aura is selected (α 0.7 → 1)
 */
export function drawRingFamiliars(ctx, t, uv, n, r, w, h, size, c, sel, bob = 0.05, cls = FAMILIAR) {
  const a = sel ? 1 : 0.75;
  for (let i = 0; i < n; i++) {
    ringPoint(t.x, t.y, r, i, n, ctx.time, w, t.uid * 0.37, _rp);
    const hh = h + bob * Math.sin(ctx.time * 2.3 + i * 1.9);
    if (!ctx.quad(ctx.b.bbN, cls, _rp.x, hh, _rp.y, size, size, uv, c, a)) return;
    ctx.quadRGB(ctx.b.groundN, cls, _rp.x, 0.065, _rp.y, size * 0.7, size * 0.7, ctx.R.shadow, 0.05, 0.05, 0.1, 0.22);
  }
}

/** Faint ground ring at an aura edge (only while she is selected). */
export function auraEdge(ctx, t, r, c, a = 0.25) {
  ctx.quad(ctx.b.groundA, CORE, t.x, 0.07, t.y, r * 2, r * 2, ctx.R.ring, c, a);
}
