// Ruri (projectile from her relay familiar). Signature "Kon's holo bolts": every bolt leaps out of
// Kon, the holographic white fox standing at her relay origin (drawn by src/render/rosterFx.js):
// a blue flash at the fox, a blue holo bolt with a short trail, a small ring on a real hit.
//   P0 (hound) T3+: a white bite slash on the hit
//   P1 (falcon) T3+: a feather flick on the hit
//   P2 (otter) T3+: water ripple on the hit
import { lookAt } from '../flair.js';
import { flash, ripple, sparks } from '../patterns/bursts.js';
import { CORE, DECOR } from '../context.js';

const BLUE = '#5ad1ff';
const PALE = '#d8f2ff';
const FOX_H = 0.42;

export const ruri = {
  id: 'ruri',

  onAttack(ev, tw, t, ctx) {
    if (!ctx.cap('muzzle')) return;
    const x = t.ox ?? t.x;
    const y = t.oy ?? t.y;
    flash(ctx, x, FOX_H, y, 0.5, ctx.col(BLUE), 0.12);
  },

  // the sim fires from the origin (t.ox, t.oy): only lift the muzzle to the fox's head
  origin(p, t, idx, n, rec) {
    rec.mz = FOX_H;
    return true;
  },

  view(p, rec, _t, v, ctx) {
    const c = ctx.col(BLUE);
    const vl = Math.hypot(p.vx, p.vy) || 1;
    ctx.quad(ctx.b.bbA, CORE, v.x, v.z, v.y, 0.3, 0.3, ctx.R.glow, c, 0.9);
    ctx.line(ctx.b.bbA, DECOR, v.x, v.z, v.y, v.x - (p.vx / vl) * 0.38, v.z, v.y - (p.vy / vl) * 0.38, 0.09, ctx.col(PALE), 0.7);
  },

  onImpact(rec, x, y, crit, radius, ctx) {
    const lk = rec.tw.look;
    ripple(ctx, x, y, 0.1, Math.max(0.4, radius), 0.3, ctx.col(BLUE), 0, 'ringSoft', true, 0.8);
    sparks(ctx, x, 0.35, y, 2, ctx.col(PALE), 1.2);
    if (lookAt(lk, 0) >= 3) {
      const p = ctx.spr(ctx.b.bbA, CORE, ctx.R.slash, x, 0.4, y, 0.5, 0.6, 0.14, ctx.col('#ffffff'), 0.9);
      if (p) p.rot = 0.6;
    }
    if (lookAt(lk, 1) >= 3) {
      const p = ctx.spr(ctx.b.bbN, DECOR, ctx.R.feather, x, 0.5, y, 0.22, 0.18, 0.4, ctx.col(PALE), 1);
      if (p) {
        p.vy = 0.8;
        p.vrot = 5;
      }
    }
    if (lookAt(lk, 2) >= 3) ripple(ctx, x, y, 0.2, 0.7, 0.4, ctx.col('#8fe3ff'), 0.05, 'ring', true, 0.7);
  },
};
