// Momo (projectile `bullet` from her coin purse + wave income). Signature "Coin flick": her
// shots are spinning gold coins flicked in a small lob; on a real hit the coin hops off with a
// tink. On her wave income a little fountain of coins pops out of her purse.
//   P0 Peach Orchard: petals in the fountain; T5 a golden ring
//   P1 Savings Pact: T3 coupons patrol her aura edge
//   P2 Coin Toss: T3 bigger glowing coins; T4/T5 a jackpot burst on a critical hit
import { lookAt } from '../flair.js';
import { coinHop, sparks, ripple, chrysanthemum } from '../patterns/bursts.js';
import { drawRingFamiliars } from '../patterns/patrol.js';
import { hand } from './util.js';
import { CORE, DECOR } from '../context.js';
import { SPIN_X } from '../quadPool.js';

const GOLD = '#ffd43b';

export const momo = {
  id: 'momo',

  onAttack(ev, tw, t, ctx) {
    if (!ctx.cap('muzzle')) return;
    const h = hand(ctx, t);
    ctx.spr(ctx.b.bbA, CORE, ctx.R.star, h.x, h.h + 0.1, h.y, 0.34, 0.1, 0.14, ctx.col(GOLD), 1);
  },

  origin(p, t, idx, n, rec, ctx) {
    const h = hand(ctx, t);
    rec.mx = h.x;
    rec.my = h.y;
    rec.mz = h.h + 0.1;
    rec.bump = 0.3 + 0.05 * (rec.est || 1);
    return true;
  },

  view(p, rec, _t, v, ctx) {
    v.skip = true;
    const lk = rec.tw.look;
    const big = lookAt(lk, 2) >= 3;
    // a coin you can follow on a phone (≈ 12 CSS px), a touch bigger with each Coin Toss accent,
    // in a soft gold glow, with a glint each time it turns face-on
    const s = (big ? 0.36 : 0.3 + 0.02 * lk.accent[2]) * ctx.readScale;
    const flip = Math.abs(Math.cos(ctx.time * 14 + rec.uid));
    const gold = ctx.col(GOLD);
    ctx.quad(ctx.b.bbA, DECOR, v.x, v.z, v.y, s * (big ? 2.2 : 1.7), s * (big ? 2.2 : 1.7), ctx.R.glow, gold, big ? 0.45 : 0.32);
    ctx.quad(ctx.b.bbN, CORE, v.x, v.z, v.y, s * Math.max(0.15, flip), s, ctx.R.coin, ctx.col('#ffffff'), 1);
    if (flip > 0.92) ctx.quad(ctx.b.bbA, DECOR, v.x, v.z + 0.02, v.y, s * 1.3, s * 1.3, ctx.R.star, ctx.col('#fff6c8'), 0.9, rec.uid);
    ctx.quadRGB(ctx.b.groundN, CORE, v.x, 0.065, v.y, 0.18, 0.18, ctx.R.shadow, 0.05, 0.05, 0.1, 0.25);
  },

  onImpact(rec, x, y, crit, radius, ctx) {
    const e = rec.targetUid != null ? ctx.enemy(rec.targetUid) : null;
    const h = e ? ctx.enemyH(e) : 0.45;
    coinHop(ctx, x, h, y);
    sparks(ctx, x, h, y, 3, ctx.col('#fff3b0'), 1.4, CORE);
    if (crit && lookAt(rec.tw.look, 2) >= 4) {
      for (let k = 0; k < 6; k++) coinHop(ctx, x, h, y);
      ripple(ctx, x, y, 0.1, 0.7, 0.3, ctx.col(GOLD), 0, 'ring', true, 1);
      chrysanthemum(ctx, x, h + 0.2, y, 6, [ctx.col(GOLD), ctx.col('#ffffff')], 0.14, 1.6);
    }
  },

  /** Wave income: a fountain of coins from her purse. */
  onCash(ev, tw, t, ctx) {
    if (ev.reason !== 'income') return;
    const n = Math.max(3, Math.min(12, Math.round((ev.amount || 30) / 10)));
    const h = hand(ctx, t);
    const k = ctx.n(n);
    for (let i = 0; i < k; i++) {
      const p = ctx.spr(ctx.b.bbN, i < 3 ? CORE : DECOR, ctx.R.coin, h.x, h.h + 0.1, h.y, 0.18, 0.16, 0.8, ctx.col('#ffffff'), 1);
      if (!p) break;
      const a = (i / k) * Math.PI * 2;
      p.vx = Math.cos(a) * 0.7;
      p.vz = Math.sin(a) * 0.7;
      p.vy = 2.6 + Math.random() * 0.8;
      p.g = -7;
      p.flags = SPIN_X;
    }
    const lk = tw.look;
    if (lookAt(lk, 0) >= 3 || lk.accent[0] >= 2) {
      for (let i = 0; i < 5; i++) {
        const p = ctx.spr(ctx.b.bbN, DECOR, ctx.R.petal, t.x, 1, t.y, 0.12, 0.08, 0.8, ctx.col('#ffb3c6'), 1);
        if (!p) break;
        const a = Math.random() * Math.PI * 2;
        p.vx = Math.cos(a) * 0.8;
        p.vz = Math.sin(a) * 0.8;
        p.vy = 1.2;
        p.g = -1.5;
        p.vrot = 4;
      }
    }
    if (lookAt(lk, 0) >= 5) ripple(ctx, t.x, t.y, 0.2, 1, 0.5, ctx.col(GOLD), 0, 'ringThick', true, 0.8);
  },

  update(gdt, tw, t, ctx) {
    const p1 = lookAt(tw.look, 1);
    const aura = t.stats?.aura?.range || 0;
    if (p1 >= 3 && aura > 0 && ctx.q.familiars > 0) {
      drawRingFamiliars(ctx, t, ctx.R.ticket, Math.min(ctx.q.familiars, p1 >= 5 ? 3 : 2), aura, 0.4, 0.8, 0.32 * ctx.readScale, ctx.col('#ffe9a8'), ctx.selectedUid === t.uid);
    }
  },
};
