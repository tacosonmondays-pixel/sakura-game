// Hana (projectile `arrow`, air bonus, grounding). Signature "Falconer's arrow": every arrow trails a
// warm gold streak; when she shoots a flyer her falcon drone Kaze dives from above onto that same
// enemy (a hawk silhouette + a white dive streak; only when his 3D figure is not drawn, which swoops on
// her attacks itself: src/render/companions.js) and a dust ring marks the grounding.
//   P0 (falconry) T3+: Kaze dives on every shot, flyer or not
//   P2 (volleys) T3+: longer streaks
import { lookAt } from '../flair.js';
import { flash, ripple } from '../patterns/bursts.js';
import { SEG_GROW } from '../patterns/segments.js';
import { hand, handFlash } from './util.js';
import { CORE, DECOR } from '../context.js';

const GOLD = '#f2dc96';
const DIVE = '#ffffff';

export const hana = {
  id: 'hana',

  onAttack(ev, tw, t, ctx) {
    handFlash(ctx, t, ctx.col('#fff4d0'), 0.34);
    const e = ctx.enemy(ev.targetUid);
    if (!e) return;
    const air = e.y > 0.2;
    if (!air && lookAt(tw.look, 0) < 3) return;
    if (!ctx.cap('tracer')) return;
    // Kaze's own figure swoops (src/render/companions.js): the hawk sprite is only the fallback
    if (ctx.actors?.companions?.has(t.uid)) return;
    // Kaze dives from above-behind onto the enemy she shot (T1: the sim's target)
    const h = ctx.enemyH(e);
    const sx = e.x - 0.5;
    const sy = e.z - 0.3;
    ctx.segs.add(sx, h + 1.6, sy, e.x, h, e.z, 0.1, ctx.col(DIVE), 0.22, SEG_GROW);
    const hk = ctx.spr(ctx.b.bbN, CORE, ctx.R.hawk, sx, h + 1.6, sy, 0.38 * ctx.readScale, 0.3, 0.22, ctx.col('#d9b48a'), 1);
    if (hk) {
      hk.vx = (e.x - sx) / 0.22;
      hk.vz = (e.z - sy) / 0.22;
      hk.vy = -1.6 / 0.22;
    }
  },

  origin(p, t, idx, n, rec, ctx) {
    const h = hand(ctx, t);
    rec.mx = h.x;
    rec.my = h.y;
    rec.mz = h.h + 0.05;
    return true;
  },

  view(p, rec, _t, v, ctx) {
    const tail = lookAt(rec.tw.look, 2) >= 3 ? 0.55 : 0.4;
    const vl = Math.hypot(p.vx, p.vy) || 1;
    ctx.line(ctx.b.bbA, ctx.q.trails ? CORE : DECOR, v.x, v.z, v.y, v.x - (p.vx / vl) * tail, v.z, v.y - (p.vy / vl) * tail, 0.08, ctx.col(GOLD), 0.8);
  },

  onStatus(ev, tw, t, ctx) {
    if (ev.status !== 'ground') return;
    const e = ctx.enemy(ev.uid);
    if (!e) return;
    ripple(ctx, e.x, e.z, 0.15, 0.6, 0.35, ctx.col('#d8c8a0'), 0, 'ringSoft', false, 0.8);
    flash(ctx, e.x, ctx.enemyH(e), e.z, 0.4, ctx.col(GOLD), 0.12);
  },
};
