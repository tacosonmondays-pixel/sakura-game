// Akane (projectile from her fan, splash, burn). Signature "Firework shell": every shot is a
// lobbed firework with a landing reticle on the ground at the sim's live aim point, shrinking
// as it comes down; on the real explosion a chrysanthemum of star sparks.
//   P0 Big Bang: T3 mini flashes inside the blast; T5 a decorative pop at the top of the arc
//   P1 Wildfire: an ember trail
//   P2 Rocket Science: T3 rockets instead of shells (no lob, flame glow + smoke); T4 they leave
//      from alternating shoulders; T5 thicker smoke and a red reticle
import { lookAt } from '../flair.js';
import { chrysanthemum, flash } from '../patterns/bursts.js';
import { reticle } from '../patterns/markers.js';
import { hand, handFlash } from './util.js';
import { DECOR } from '../context.js';

const COLS = ['#ff8c42', '#ffd23f', '#ff6b8b'];

export const akane = {
  id: 'akane',

  onAttack(ev, tw, t, ctx) {
    handFlash(ctx, t, ctx.col('#ffb070'), 0.34);
  },

  origin(p, t, idx, n, rec, ctx) {
    const rockets = lookAt(rec.tw.look, 2) >= 3;
    const h = hand(ctx, t);
    rec.mx = h.x;
    rec.my = h.y;
    rec.mz = h.h + 0.1;
    if (rockets && lookAt(rec.tw.look, 2) >= 4) {
      const f = ctx.facing(t);
      const side = rec.uid & 1 ? 0.2 : -0.2;
      rec.mx = t.x + Math.cos(f) * side;
      rec.my = t.y - Math.sin(f) * side;
      rec.mz = 0.85;
    }
    rec.bump = rockets ? 0 : 0.45 + 0.1 * (rec.est || 1);
    return true;
  },

  view(p, rec, _t, v, ctx) {
    const lk = rec.tw.look;
    const p2 = lookAt(lk, 2);
    const f = rec.f || 0;
    if (p2 >= 3) {
      v.kind = 'needle';
      v.scale = 1.8;
      v.tint = 0xfff0f0;
      v.glow = 0.35;
    } else {
      v.kind = 'fireball';
    }
    // landing reticle at the sim's live aim point (follows a homing target)
    reticle(ctx, p.tx ?? p.x, p.ty ?? p.y, rec.splash || 0.5, f, ctx.col(p2 >= 5 ? '#ff4d4d' : '#ffb347'));
    rec.trailT -= ctx.gdt;
    if (rec.trailT <= 0) {
      rec.trailT = 0.04;
      if (p2 >= 3) {
        const s = ctx.spr(ctx.b.bbN, DECOR, ctx.R.smoke, v.x, v.z, v.y, 0.12, p2 >= 5 ? 0.42 : 0.3, 0.45, ctx.col('#e8e4e0'), 0.6);
        if (s) s.vy = 0.15;
      } else if (lookAt(lk, 1) >= 1 || lk.accent[1] >= 1) {
        const s = ctx.spr(ctx.b.bbA, DECOR, ctx.R.glow, v.x, v.z, v.y, 0.14, 0.03, 0.35, ctx.col('#ff7a3a'), 0.9);
        if (s) {
          s.vy = -0.3;
          s.vx = (Math.random() - 0.5) * 0.3;
        }
      }
    }
    if (lookAt(lk, 0) >= 5 && p2 < 3 && !rec.a && f >= 0.5) {
      rec.a = 1;
      chrysanthemum(ctx, v.x, v.z, v.y, 5, [ctx.col('#ffd23f')], 0.1, 1.2);
    }
  },

  onImpact(rec, x, y, crit, radius, ctx) {
    const lk = rec.tw.look;
    const n = ctx.quality === 'high' ? 12 : ctx.quality === 'medium' ? 8 : 4;
    const cols = [ctx.col(COLS[0]), ctx.col(COLS[1]), ctx.col(COLS[2])];
    chrysanthemum(ctx, x, 0.5, y, n, cols, 0.16, 1.4 + radius);
    if (lookAt(lk, 0) >= 3) {
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + Math.random();
        const r = radius * 0.6 * Math.random();
        const p = flash(ctx, x + Math.sin(a) * r, 0.4, y + Math.cos(a) * r, 0.5, cols[k], 0.14);
        if (p) p.delay = 0.04 * (k + 1);
      }
    }
  },
};
