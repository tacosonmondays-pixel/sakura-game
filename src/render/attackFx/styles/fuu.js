// Fuu (projectile gusts, knock-back). Signature "Turbine gusts": her fan spins a little mint swirl
// at her hand on every sweep, and each gust flies as a spinning mint swirl with a short wind streak;
// a real hit puffs a small swirl on the ground.
//   P1 (pull + splash) T3+: the landing swirl grows to the splash radius
//   P2 (grounding) T3+: a downdraft streak on the hit flyer
import { lookAt } from '../flair.js';
import { flash, sparks } from '../patterns/bursts.js';
import { decal } from '../patterns/markers.js';
import { SEG_GROW } from '../patterns/segments.js';
import { hand } from './util.js';
import { CORE, DECOR } from '../context.js';

const MINT = '#8ff0c8';
const PALE = '#e6fff4';

export const fuu = {
  id: 'fuu',

  onAttack(ev, tw, t, ctx) {
    if (!ctx.cap('muzzle')) return;
    const h = hand(ctx, t);
    const p = ctx.spr(ctx.b.bbA, CORE, ctx.R.swirl, h.x, h.h + 0.1, h.y, 0.3, 0.55, 0.22, ctx.col(MINT), 0.9);
    if (p) p.vrot = -14;
  },

  view(p, rec, _t, v, ctx) {
    v.skip = true; // drawn as a swirl, not as the needle mesh
    const c = ctx.col(MINT);
    const vl = Math.hypot(p.vx, p.vy) || 1;
    ctx.quad(ctx.b.bbA, CORE, v.x, v.z, v.y, 0.3, 0.3, ctx.R.swirl, c, 0.95, -ctx.time * 14 + rec.uid);
    ctx.line(ctx.b.bbA, DECOR, v.x, v.z, v.y, v.x - (p.vx / vl) * 0.4, v.z, v.y - (p.vy / vl) * 0.4, 0.08, ctx.col(PALE), 0.6);
  },

  onImpact(rec, x, y, crit, radius, ctx) {
    const lk = rec.tw.look;
    const s = lookAt(lk, 1) >= 3 && radius > 0 ? radius * 2 : 0.6;
    decal(ctx, ctx.R.swirl, x, y, s * 0.5, s, 0.4, ctx.col(MINT), 0.55, ctx.rand() * 6, true);
    sparks(ctx, x, 0.35, y, 2, ctx.col(PALE), 1.2);
    if (lookAt(lk, 2) >= 3) {
      ctx.segs.add(x, 1.4, y, x, 0.2, y, 0.12, ctx.col(PALE), 0.18, SEG_GROW);
      flash(ctx, x, 0.25, y, 0.35, ctx.col(MINT), 0.12);
    }
  },
};
