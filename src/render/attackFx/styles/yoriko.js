// Yoriko ★ (hero · twin thread needles, slow). Signature "Marionette": her doll (src/render/marionette.js) hangs
// on strings from her control bar and strikes on each attack; the needles are small silver-lilac pins the doll
// flings (they leave the doll where it is drawn, never her feet, and draw no line back to anyone), and the sim's
// hit gets a short bright slash flash, apart from the strings. Without the doll's figure (files loading, an
// error) the needles leave her hand. Her Dream Detour ultimate keeps the renderer's tide look.
import { flash, ripple } from '../patterns/bursts.js';
import { hand } from './util.js';
import { CORE, DECOR } from '../context.js';

const LILAC = '#c6b8f1';
const PIN = '#f1ecff';
const SLASH = '#ffffff';
/** The needle's length (tiles) along its flight. */
const NEEDLE = 0.2;

export const yoriko = {
  id: 'yoriko',

  onAttack(ev, tw, t, ctx) {
    if (!ctx.cap('muzzle')) return;
    // a small glint where the needles leave: the doll's hands (or her hand without the doll)
    const d = ctx.actors?.companions?.dollAt?.(t.uid);
    if (d) ctx.spr(ctx.b.bbA, CORE, ctx.R.glow, d.x, d.h, d.z, 0.16, 0.24, 0.08, ctx.col(PIN), 0.9);
    else {
      const h = hand(ctx, t);
      ctx.spr(ctx.b.bbA, CORE, ctx.R.glow, h.x, h.h, h.y, 0.2, 0.28, 0.08, ctx.col(LILAC), 0.9);
    }
  },

  origin(p, t, idx, n, rec, ctx) {
    const d = ctx.actors?.companions?.dollAt?.(t.uid);
    if (d) {
      rec.mx = d.x;
      rec.my = d.z;
      rec.mz = d.h;
      return true;
    }
    const h = hand(ctx, t);
    rec.mx = h.x;
    rec.my = h.y;
    rec.mz = h.h + 0.2;
    return true;
  },

  // a needle: a thin bright pin along its flight with a tiny glint at the point (no thread back to the doll)
  view(p, rec, _t, v, ctx) {
    const vl = Math.hypot(p.vx || 0, p.vy || 0) || 1;
    const ux = (p.vx || 0) / vl;
    const uy = (p.vy || 0) / vl;
    ctx.line(ctx.b.bbA, CORE, v.x, v.z, v.y, v.x - ux * NEEDLE, v.z, v.y - uy * NEEDLE, 0.035, ctx.col(PIN), 0.95);
    ctx.quad(ctx.b.bbA, DECOR, v.x, v.z, v.y, 0.09, 0.09, ctx.R.glow, ctx.col(LILAC), 0.7);
  },

  // the sim's hit: a short bright slash (two crossed cuts) and a faint lilac ring
  onImpact(rec, x, y, crit, radius, ctx) {
    const s = crit ? 0.5 : 0.4;
    const a = ctx.spr(ctx.b.bbA, CORE, ctx.R.slash, x, 0.42, y, s, s * 1.2, 0.14, ctx.col(SLASH), 1);
    if (a) {
      a.asp = 2.2;
      a.rot = 0.7;
    }
    const b = ctx.spr(ctx.b.bbA, CORE, ctx.R.slash, x, 0.42, y, s * 0.75, s * 0.9, 0.12, ctx.col(PIN), 0.95);
    if (b) {
      b.asp = 2.2;
      b.rot = -0.75;
    }
    flash(ctx, x, 0.4, y, 0.14, ctx.col(PIN), 0.06);
    ripple(ctx, x, y, 0.06, 0.3, 0.2, ctx.col(LILAC), 0, 'ringSoft', true, 0.55);
  },
};
