// Ena (projectile curse cards). Signature "Omen cards": each shot is a spinning crimson holo card
// trailing a thin red thread of light back toward her hand; a real hit pops a crimson flash. Curse
// bursts and the hex marks over cursed enemies are drawn by src/render/rosterFx.js / actors.js.
//   P0 (bloom) T3+: a petal flick on every hit
import { lookAt } from '../flair.js';
import { flash, sparks } from '../patterns/bursts.js';
import { hand, handFlash } from './util.js';
import { CORE, DECOR } from '../context.js';

const CRIMSON = '#ff4d6d';
const THREAD = '#ff2a4a';

export const ena = {
  id: 'ena',

  onAttack(ev, tw, t, ctx) {
    handFlash(ctx, t, ctx.col(CRIMSON), 0.3);
  },

  origin(p, t, idx, n, rec, ctx) {
    const h = hand(ctx, t);
    rec.mx = h.x;
    rec.my = h.y;
    rec.mz = h.h + 0.05;
    return true;
  },

  view(p, rec, t, v, ctx) {
    v.skip = true; // a card quad instead of the shuriken mesh
    ctx.quad(ctx.b.bbN, CORE, v.x, v.z, v.y, 0.26, 0.18, ctx.R.card || ctx.R.ticket, ctx.col('#ffd6de'), 1, ctx.time * 9 + rec.uid);
    ctx.quad(ctx.b.bbA, DECOR, v.x, v.z, v.y, 0.36, 0.36, ctx.R.glow, ctx.col(CRIMSON), 0.55);
    // the red thread: from the card back toward where it left her (fades as it flies)
    const k = 1 - Math.min(1, (rec.f || 0) / 0.7);
    if (k > 0.02) ctx.line(ctx.b.bbA, DECOR, rec.mx, rec.mz, rec.my, v.x, v.z, v.y, 0.035, ctx.col(THREAD), 0.75 * k);
    const vl = Math.hypot(p.vx, p.vy) || 1;
    ctx.line(ctx.b.bbA, DECOR, v.x, v.z, v.y, v.x - (p.vx / vl) * 0.35, v.z, v.y - (p.vy / vl) * 0.35, 0.05, ctx.col(THREAD), 0.8);
  },

  onImpact(rec, x, y, crit, radius, ctx) {
    flash(ctx, x, 0.4, y, 0.42, ctx.col(CRIMSON), 0.12);
    sparks(ctx, x, 0.4, y, 2, ctx.col('#ffb3c1'), 1.2);
    if (lookAt(rec.tw.look, 0) >= 3) {
      const p = ctx.spr(ctx.b.bbN, DECOR, ctx.R.petal, x, 0.5, y, 0.14, 0.1, 0.5, ctx.col(CRIMSON), 1);
      if (p) {
        p.vy = 0.6;
        p.vrot = 6;
      }
    }
  },
};
