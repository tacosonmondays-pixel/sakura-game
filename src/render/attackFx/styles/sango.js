// Sango (projectile `shell`, the sim's own arc, splash, water). Signature "Coral cannon": the
// cannon kicks her back a little (recoil), with a puff of smoke and a water spout at the muzzle;
// a navy/gold reticle marks where the shell will land; on the real explosion a double ring
// (bright inner, thin outer to the full blast radius) and a spray.
//   P0 Armor-Breaker: T3 a crack decal on the ground
//   P1 Wide Fragmentation: T3 shrapnel sparks inside the blast
//   P2 Concentrated Siege: bigger shells (×1.15 at T3 → ×1.4 at T5), heavier smoke
import { lookAt } from '../flair.js';
import { waterCrown, sparks } from '../patterns/bursts.js';
import { doubleRing } from '../patterns/rings.js';
import { reticle, decal } from '../patterns/markers.js';
import { hand } from './util.js';
import { CORE, DECOR } from '../context.js';

export const sango = {
  id: 'sango',

  onAttack(ev, tw, t, ctx) {
    const e = ctx.enemy(ev.targetUid);
    if (e) ctx.lunge.start(t.uid, e.x - t.x, e.z - t.y, -0.08, 0.05, 0, 0.2);
    if (!ctx.cap('muzzle')) return;
    const h = hand(ctx, t);
    const heavy = lookAt(tw.look, 2) >= 3;
    for (let k = 0; k < (heavy ? 4 : 2); k++) {
      const p = ctx.spr(ctx.b.bbN, k ? DECOR : CORE, ctx.R.smoke, h.x, h.h + 0.1, h.y, 0.2, 0.5, 0.5, ctx.col('#e8eef2'), 0.75);
      if (p) {
        p.vy = 0.5 + k * 0.2;
        p.vx = (ctx.rand() - 0.5) * 0.4;
        p.vrot = 1;
      }
    }
    for (let k = 0; k < 3; k++) {
      const p = ctx.spr(ctx.b.bbN, DECOR, ctx.R.drop, h.x, h.h + 0.15, h.y, 0.1, 0.06, 0.35, ctx.col('#9fe8ff'), 0.9);
      if (!p) break;
      p.vy = 1.6;
      p.vx = (k - 1) * 0.4;
      p.g = -7;
    }
  },

  view(p, rec, _t, v, ctx) {
    const p2 = lookAt(rec.tw.look, 2);
    if (p2 >= 3) v.scale = p2 >= 5 ? 1.4 : p2 >= 4 ? 1.25 : 1.15;
    reticle(ctx, p.tx ?? p.x, p.ty ?? p.y, rec.splash || 0.8, rec.f || 0, ctx.col('#2f6fd6'), 0.9, ctx.col('#ffd166'));
  },

  onImpact(rec, x, y, crit, radius, ctx) {
    const lk = rec.tw.look;
    const r = Math.max(0.4, radius);
    doubleRing(ctx, x, y, r, ctx.col('#e6f6ff'), ctx.col('#1d4e89'));
    waterCrown(ctx, x, y, ctx.quality === 'low' ? 3 : 5, ctx.col('#bfefff'), r * 0.6);
    if (lookAt(lk, 0) >= 3) decal(ctx, ctx.R.crack, x, y, r * 1.2, r * 1.4, 0.8, ctx.col('#3a3530'), 0.55, ctx.rand() * 6);
    if (lookAt(lk, 1) >= 3) sparks(ctx, x, 0.35, y, 6, ctx.col('#ffd166'), 1.6 + r, CORE);
  },
};
