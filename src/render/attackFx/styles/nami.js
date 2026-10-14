// Nami ★ (hero · projectile `orb`, splash, frost slow). Signature "Tide Trident": the water orb
// swells as it flies, leaving a little wake of ripples on the ground; on a real impact a water
// crown splashes up.
//   P0 Frostbrand: icy wake, frost shards on impact
//   P1 Undertow: a whirl swirl on impact (the knockback is real)
//   P2 Harbor Watch: gulls circle the aura edge (3 at T5)
import { lookAt } from '../flair.js';
import { waterCrown, shardBurst } from '../patterns/bursts.js';
import { decal } from '../patterns/markers.js';
import { drawRingFamiliars } from '../patterns/patrol.js';
import { hand, handFlash } from './util.js';
import { DECOR } from '../context.js';
import { GROUND, EASE_OUT } from '../quadPool.js';

export const nami = {
  id: 'nami',

  onAttack(ev, tw, t, ctx) {
    handFlash(ctx, t, ctx.col('#8fe3ff'), 0.36);
  },

  origin(p, t, idx, n, rec, ctx) {
    const h = hand(ctx, t);
    rec.mx = h.x;
    rec.my = h.y;
    rec.mz = h.h + 0.15;
    return true;
  },

  view(p, rec, _t, v, ctx) {
    const f = rec.f || 0;
    v.scale = 0.8 + 0.55 * f;
    if (ctx.q.trails < 1) return;
    rec.trailT -= ctx.gdt;
    if (rec.trailT <= 0) {
      rec.trailT = 0.06;
      const icy = lookAt(rec.tw.look, 0) >= 3 || rec.tw.look.accent[0] >= 2;
      const r = ctx.spr(ctx.b.groundA, DECOR, ctx.R.ring, v.x, 0.07, v.y, 0.1, 0.45, 0.4, ctx.col(icy ? '#d8f6ff' : '#7fd6ff'), 0.6);
      if (r) r.flags = GROUND | EASE_OUT;
    }
  },

  onImpact(rec, x, y, crit, radius, ctx) {
    const lk = rec.tw.look;
    waterCrown(ctx, x, y, ctx.quality === 'low' ? 3 : 6, ctx.col('#9fe8ff'), Math.max(0.35, radius));
    if (lookAt(lk, 0) >= 3) shardBurst(ctx, x, 0.4, y, 5, ctx.col('#d8f6ff'));
    if (lookAt(lk, 1) >= 3) decal(ctx, ctx.R.swirl, x, y, 0.9, 0.4, 0.5, ctx.col('#4cc9f0'), 0.75, 0, true);
  },

  update(gdt, tw, t, ctx) {
    const p2 = lookAt(tw.look, 2);
    if (p2 < 3 || ctx.q.familiars <= 0) return;
    const r = t.stats?.aura?.range || 0; // gulls circle exactly at the aura edge
    if (!r) return;
    const n = Math.min(ctx.q.familiars, p2 >= 5 ? 3 : 2);
    drawRingFamiliars(ctx, t, ctx.R.bird, n, r, 0.45, 1.5, 0.26 * ctx.readScale, ctx.col('#ffffff'), ctx.selectedUid === t.uid, 0.1);
  },
};
