// Iroha (projectile ×2 from her mirror panel and from herself). Signature "Mirror bolts": each
// bolt is a silver glint with a plum trail; the mirror panel (drawn by src/render/rosterFx.js) flashes
// when a volley leaves it, her hand when she fires too.
//   P1+ T3: a second, wider plum trail
import { lookAt } from '../flair.js';
import { flash, sparks } from '../patterns/bursts.js';
import { hand } from './util.js';
import { CORE, DECOR } from '../context.js';

const SILVER = '#eeeaff';
const PLUM = '#a46cd0';
const MIRROR_H = 0.6;

export const iroha = {
  id: 'iroha',

  onAttack(ev, tw, t, ctx) {
    if (!ctx.cap('muzzle')) return;
    const x = t.ox ?? t.x;
    const y = t.oy ?? t.y;
    flash(ctx, x, MIRROR_H, y, 0.55, ctx.col(SILVER), 0.12);
    if (t.origin && (x !== t.x || y !== t.y)) {
      const h = hand(ctx, t);
      flash(ctx, h.x, h.h, h.y, 0.3, ctx.col(PLUM), 0.1);
    }
  },

  // her two firing points: the sim spawn S is wherever this bolt really started (mirror or her)
  origin(p, t, idx, n, rec, ctx) {
    const vl = Math.hypot(p.vx, p.vy) || 1;
    const sx = p.x - (p.vx / vl) * (p.travel || 0);
    const sy = p.y - (p.vy / vl) * (p.travel || 0);
    rec.sx = sx;
    rec.sy = sy;
    const fromMirror = Math.hypot(sx - (t.ox ?? t.x), sy - (t.oy ?? t.y)) < Math.hypot(sx - t.x, sy - t.y) || !t.origin;
    if (fromMirror && t.origin) {
      rec.mx = sx;
      rec.my = sy;
      rec.mz = MIRROR_H;
    } else {
      const h = hand(ctx, t);
      rec.mx = h.x;
      rec.my = h.y;
      rec.mz = h.h;
    }
    return true;
  },

  view(p, rec, _t, v, ctx) {
    const vl = Math.hypot(p.vx, p.vy) || 1;
    const dx = p.vx / vl;
    const dy = p.vy / vl;
    ctx.quad(ctx.b.bbA, CORE, v.x, v.z, v.y, 0.26, 0.26, ctx.R.star, ctx.col(SILVER), 0.95, ctx.time * 6);
    ctx.line(ctx.b.bbA, DECOR, v.x, v.z, v.y, v.x - dx * 0.42, v.z, v.y - dy * 0.42, 0.09, ctx.col(PLUM), 0.8);
    if (lookAt(rec.tw.look, 1) >= 3) ctx.line(ctx.b.bbA, DECOR, v.x, v.z, v.y, v.x - dx * 0.3, v.z, v.y - dy * 0.3, 0.18, ctx.col(PLUM), 0.35);
  },

  onImpact(rec, x, y, crit, radius, ctx) {
    flash(ctx, x, 0.4, y, 0.4, ctx.col(SILVER), 0.12);
    sparks(ctx, x, 0.4, y, 3, ctx.col(PLUM), 1.4);
  },
};
