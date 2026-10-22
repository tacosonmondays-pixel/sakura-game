// Impact presets (FX-1, the first of the impact library): a girl's own hit spark in her colours, in three
// strengths — weak (a basic hit, tier 1: ≤ 6 shapes, ≤ 0.3 s), strong (a blast, a big hit) and crit (tier 2:
// ≤ 10 shapes, a brighter, bigger star). The enemy's flash, squash and hold are the renderer's (vfx/); this is
// the layer on top that says whose hit it was. Her kill pop lives in her style (onKill).
//   impactFx(ctx, 'yuzuha', crit ? 'crit' : 'weak', x, h, y)
import { CORE, DECOR } from './context.js';

/** Per girl: main / light colours, the motif sprite, sizes and spark counts per strength. */
export const IMPACT = {
  marumi: { main: '#f28a3c', light: '#fff2c0', motif: 'star', weak: [0.3, 3], strong: [0.42, 4], crit: [0.55, 6] },
  azami: { main: '#d3dae4', light: '#ffe6f2', motif: 'shard', weak: [0.26, 3], strong: [0.36, 4], crit: [0.48, 6] },
  yuzuha: { main: '#7fe0ff', light: '#e8fbff', motif: 'star', weak: [0.3, 3], strong: [0.38, 4], crit: [0.44, 6] },
  ruri: { main: '#5ad1ff', light: '#d8f2ff', motif: 'star', weak: [0.28, 2], strong: [0.36, 3], crit: [0.46, 5] },
};

/**
 * Her hit spark at (x, h, y): a motif sprite (spinning star / steel shard) and a few sparks in her colours;
 * a crit adds a light core. @returns {number} shapes drawn
 */
export function impactFx(ctx, girl, cls, x, h, y) {
  const P = IMPACT[girl];
  if (!P) return 0;
  const [size, n] = P[cls] || P.weak;
  const main = ctx.col(P.main);
  let shapes = 0;
  const m = ctx.spr(ctx.b.bbA, CORE, ctx.R[P.motif] || ctx.R.star, x, h, y, size, size * 0.45, cls === 'crit' ? 0.24 : 0.18, main, 1);
  if (m) {
    m.vrot = 9;
    shapes++;
  }
  if (cls === 'crit') {
    const c = ctx.spr(ctx.b.bbA, CORE, ctx.R.glow, x, h, y, size * 0.8, size * 0.3, 0.12, ctx.col(P.light), 1);
    if (c) shapes++;
  }
  const k = ctx.n(n);
  for (let i = 0; i < k; i++) {
    const a = ctx.rand() * Math.PI * 2;
    const p = ctx.spr(ctx.b.bbA, DECOR, ctx.R.glow, x, h, y, 0.08, 0.02, 0.26, i & 1 ? ctx.col(P.light) : main, 1);
    if (!p) break;
    p.vx = Math.cos(a) * 1.5;
    p.vz = Math.sin(a) * 1.5;
    p.vy = 0.6 + ctx.rand() * 1.1;
    p.g = -6;
    p.drag = 2;
    shapes++;
  }
  return shapes;
}
