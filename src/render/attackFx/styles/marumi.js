// Marumi (rolling bomb balls, src/sim/balls.js). Signature "STRIKE!": the balls themselves are drawn per
// frame in src/render/actors.js; a blast is the shared 'explode' burst; a roll pops a little dust puff
// at her hand. Every blast of a ball ('ballPop') adds a small impact pop: a warm flash, a quick ring and
// a few sparks thrown toward the walker the ball bounces on to (Spin Shot), so each ricochet reads as a
// hit and a turn. The Glow Bowl finale is a bigger pop: a firework of pin-white and orange stars and a
// double ring.
import { sparks, flash, ripple, chrysanthemum } from '../patterns/bursts.js';
import { DECOR } from '../context.js';
import { hand } from './util.js';

const SPARK = '#ffc46b';
const PIN = '#f6efe0';
const ORANGE = '#f28a3c';

/** A few sparks flung from (x, y) toward (tx, ty): the way the ball goes next. */
function toward(ctx, x, y, tx, ty, c) {
  const dx = tx - x;
  const dy = ty - y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-6) return;
  const k = ctx.n(4);
  for (let i = 0; i < k; i++) {
    const s = 2.4 + i * 0.5;
    const p = ctx.spr(ctx.b.bbA, DECOR, ctx.R.glow, x, 0.22, y, 0.1, 0.03, 0.22, c, 1);
    if (!p) continue;
    p.vx = (dx / d) * s + (i - 1.5) * 0.25 * (-dy / d);
    p.vz = (dy / d) * s + (i - 1.5) * 0.25 * (dx / d);
    p.vy = 0.5;
    p.g = -4;
    p.drag = 3;
  }
}

export const marumi = {
  id: 'marumi',

  onAttack(ev, tw, t, ctx) {
    if (ev.kind !== 'roll' && ev.kind !== 'lob') return;
    const h = hand(ctx, t);
    sparks(ctx, h.x, h.h, h.y, 3, ctx.col(SPARK), 1);
  },

  onOther(ev, tw, t, ctx) {
    if (ev.type !== 'ballPop') return false;
    if (ev.fin) {
      chrysanthemum(ctx, ev.x, 0.35, ev.y, 10, [ctx.col(PIN), ctx.col(ORANGE), ctx.col(SPARK)], 0.18, 2.8);
      ripple(ctx, ev.x, ev.y, 0.2, 1.4, 0.4, ctx.col(SPARK));
      ripple(ctx, ev.x, ev.y, 0.1, 0.9, 0.35, ctx.col(PIN), 0.06);
      return false;
    }
    flash(ctx, ev.x, 0.25, ev.y, 0.55, ctx.col(SPARK), 0.1);
    ripple(ctx, ev.x, ev.y, 0.1, 0.55, 0.22, ctx.col(PIN));
    if (ev.tx != null) toward(ctx, ev.x, ev.y, ev.tx, ev.ty, ctx.col(SPARK));
    return false;
  },
};
