// Yuki (projectile `orb`, splash, frost; Deep Freeze T5 → pulse). Signature "Snowball lob":
// a white snowball lobbed from her staff with a little sparkle trail; on a real impact a snow
// puff, a frost ring and ice shards.
//   P0 Deep Freeze: T3 an 8-shard crystal burst; T5 "Blizzard Ring" — snow streaks orbit at her
//      pulse radius while she fights and pull in on every pulse
//   P1 Frostbite: T3 icicles instead of snowballs (no lob), shattering on impact
//   P2 Permafrost: a short frost trail on the ground under the shot
import { lookAt } from '../flair.js';
import { shardBurst, ripple, flash } from '../patterns/bursts.js';
import { hand, handFlash } from './util.js';
import { CORE, DECOR, MOTE } from '../context.js';
import { GROUND, EASE_OUT } from '../quadPool.js';

const SNOW = '#f4fbff';
const ICE = '#aee8ff';

export const yuki = {
  id: 'yuki',

  init() {
    return { tight: 0 };
  },

  onAttack(ev, tw, t, ctx) {
    if (ev.kind === 'pulse') return;
    handFlash(ctx, t, ctx.col(ICE), 0.3);
  },

  origin(p, t, idx, n, rec, ctx) {
    const h = hand(ctx, t);
    rec.mx = h.x;
    rec.my = h.y;
    rec.mz = h.h + 0.25;
    rec.bump = lookAt(rec.tw.look, 1) >= 3 ? 0 : 0.25 + 0.06 * (rec.est || 1);
    return true;
  },

  view(p, rec, _t, v, ctx) {
    const lk = rec.tw.look;
    if (lookAt(lk, 1) >= 3) {
      v.kind = 'needle';
      v.tint = 0xaee8ff;
      v.scale = 1.3;
      v.glow = 0.25;
    } else {
      v.tint = 0xf4fbff;
      v.scale = 1.15;
    }
    rec.trailT -= ctx.gdt;
    if (rec.trailT > 0) return;
    rec.trailT = 0.05;
    if (ctx.q.trails >= 1) {
      const s = ctx.spr(ctx.b.bbA, DECOR, ctx.R.snow, v.x, v.z, v.y, 0.12, 0.02, 0.3, ctx.col(SNOW), 0.9);
      if (s) s.vy = -0.4;
    }
    if (lookAt(lk, 2) >= 1 || lk.accent[2] >= 1) {
      const g = ctx.spr(ctx.b.groundA, DECOR, ctx.R.soft, v.x, 0.06, v.y, 0.18, 0.3, 0.4, ctx.col(ICE), 0.45);
      if (g) g.flags = GROUND | EASE_OUT;
    }
  },

  onImpact(rec, x, y, crit, radius, ctx) {
    const lk = rec.tw.look;
    const icicle = lookAt(lk, 1) >= 3;
    if (!icicle) ctx.fx.puff(x, 0.3, y, '#ffffff', ctx.quality === 'low' ? 3 : 5, 0.3, 0.3);
    ripple(ctx, x, y, 0.1, Math.max(0.3, radius), 0.3, ctx.col(ICE), 0, 'ring', true, 0.85);
    shardBurst(ctx, x, 0.35, y, lookAt(lk, 0) >= 3 ? 8 : icicle ? 6 : 4, ctx.col('#d8f6ff'));
  },

  /** Blizzard Ring (Deep Freeze T5): the default pulse ring is replaced by the orbiting snow. */
  onPulse(ev, tw, t, ctx) {
    tw.data.tight = 0.25;
    flash(ctx, t.x, 0.8, t.y, 0.6, ctx.col(ICE), 0.12);
    ripple(ctx, ev.x, ev.y, ev.radius * 0.4, ev.radius, 0.3, ctx.col(ICE), 0, 'ring', true, 0.35);
    return true;
  },

  update(gdt, tw, t, ctx) {
    const d = tw.data;
    if (t.eff?.behavior !== 'pulse') return;
    d.tight = Math.max(0, d.tight - gdt);
    if (!ctx.inCombat(tw)) return;
    const R = (t.eff?.range || 1) * 0.95;
    const n = ctx.quality === 'high' ? 18 : ctx.quality === 'medium' ? 10 : 6;
    const k = d.tight > 0 ? Math.sin((d.tight / 0.25) * Math.PI) : 0;
    const snow = ctx.col(SNOW);
    for (let i = 0; i < n; i++) {
      const a = ctx.time * (1.8 + (i % 3) * 0.3) + (i / n) * Math.PI * 2;
      const r = R * (1 - 0.5 * k) * (0.85 + 0.15 * Math.sin(i * 1.7 + ctx.time));
      const x = t.x + Math.sin(a) * r;
      const y = t.y + Math.cos(a) * r;
      const h = 0.25 + 0.5 * ((i * 0.37) % 1);
      if (!ctx.quad(ctx.b.bbA, i < 6 ? CORE : MOTE, x, h, y, 0.16, 0.06, ctx.R.snow, snow, 0.85, a)) break;
    }
  },
};
