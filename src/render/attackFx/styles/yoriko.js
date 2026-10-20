// Yoriko ★ (hero · twin thread needles, slow). Signature "Puppet threads": each needle stays tied to
// her control hand by a fine lilac thread while it flies, and a small lilac ring blooms on a real
// hit. Her Dream Detour ultimate keeps the renderer's tide look.
import { ripple, flash } from '../patterns/bursts.js';
import { hand, handFlash } from './util.js';
import { CORE, DECOR } from '../context.js';

const LILAC = '#c6b8f1';

export const yoriko = {
  id: 'yoriko',

  onAttack(ev, tw, t, ctx) {
    handFlash(ctx, t, ctx.col(LILAC), 0.32);
  },

  origin(p, t, idx, n, rec, ctx) {
    const h = hand(ctx, t);
    rec.mx = h.x;
    rec.my = h.y;
    rec.mz = h.h + 0.2;
    return true;
  },

  view(p, rec, _t, v, ctx) {
    const c = ctx.col(LILAC);
    ctx.quad(ctx.b.bbA, CORE, v.x, v.z, v.y, 0.2, 0.2, ctx.R.glow, c, 0.8);
    ctx.line(ctx.b.bbA, DECOR, rec.mx, rec.mz, rec.my, v.x, v.z, v.y, 0.03, c, 0.7);
  },

  onImpact(rec, x, y, crit, radius, ctx) {
    ripple(ctx, x, y, 0.08, 0.45, 0.3, ctx.col(LILAC), 0, 'ringSoft', true, 0.85);
    flash(ctx, x, 0.4, y, 0.3, ctx.col('#efe8ff'), 0.1);
  },
};
