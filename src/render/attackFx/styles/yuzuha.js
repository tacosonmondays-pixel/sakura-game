// Yuzuha (taser darts + lane sentries, src/sim/sentries.js). Signature "Deploying" (FX-1):
//   - her own shots are darts (a dart mesh in her cyan, a short streak) with a cyan zap star on a hit;
//   - her sentries are fold-out models (src/render/placed/sentries.js): tossed, unfolding, scanning,
//     tracking; their bullets leave the barrel as short safety-orange tracers with a muzzle flash;
//   - Capture Nets arc out, open and drape; a catch wraps the walker and pops into coins (same file);
//   - her kill: a small zap burst.
import { flash, sparks, ripple } from '../patterns/bursts.js';
import { CORE, DECOR } from '../context.js';
import { impactFx } from '../impacts.js';
import { hand } from './util.js';

const VOLT = '#7fe0ff';
const VOLT_HEX = 0x7fe0ff;
const TRACER_HEX = 0xffd9a8;
const TRACER = '#ffb46a';

export const yuzuha = {
  id: 'yuzuha',

  onAttack(ev, tw, t, ctx) {
    if (ev.turretUid != null || !ctx.cap('muzzle')) return;
    const h = hand(ctx, t);
    flash(ctx, h.x, h.h + 0.1, h.y, 0.25, ctx.col(VOLT), 0.08);
  },

  view(p, rec, _t, v, ctx) {
    const vl = Math.hypot(p.vx, p.vy) || 1;
    if (rec.turretUid != null) {
      // a sentry's bullet: a short safety-orange tracer from its barrel
      v.tint = TRACER_HEX;
      v.glow = 0.16;
      v.sz = 1.6;
      ctx.line(ctx.b.bbA, DECOR, v.x, v.z, v.y, v.x - (p.vx / vl) * 0.32, v.z, v.y - (p.vy / vl) * 0.32, 0.06, ctx.col(TRACER), 0.75);
      return;
    }
    // her dart: the dart mesh in her cyan and a short streak
    v.kind = 'dart';
    v.tint = VOLT_HEX;
    v.glow = 0.2;
    ctx.line(ctx.b.bbA, DECOR, v.x, v.z, v.y, v.x - (p.vx / vl) * 0.3, v.z, v.y - (p.vy / vl) * 0.3, 0.07, ctx.col(VOLT), 0.7);
  },

  onImpact(rec, x, y, crit, radius, ctx) {
    if (rec.turretUid != null) {
      sparks(ctx, x, 0.35, y, 2, ctx.col(TRACER), 1.3);
      return;
    }
    // a cyan zap star on her dart's hit (her impact preset: weak, or crit)
    impactFx(ctx, 'yuzuha', crit ? 'crit' : 'weak', x, 0.38, y);
  },

  /** Her kill: a small zap burst. */
  onKill(ev, tw, t, ctx, x, h, y) {
    const c = ctx.col(VOLT);
    for (let i = 0; i < 2; i++) {
      const p = ctx.spr(ctx.b.bbA, CORE, ctx.R.star, x, h, y, 0.45 - i * 0.12, 0.1, 0.22 + i * 0.06, c, 1);
      if (p) {
        p.rot = i * 0.6;
        p.vrot = i ? -7 : 7;
      }
    }
    sparks(ctx, x, h, y, 4, c, 2);
    ripple(ctx, x, y, 0.08, 0.4, 0.2, c, 0, 'ring', false, 0.8);
    return true;
  },
};
