// Afterimages and shadow clones: plain chibi silhouettes (no faces, no detail), tinted.
import { FAMILIAR, DECOR } from '../context.js';

/**
 * Afterimage dashing `frac` of the way from (x, y) toward (tx, ty) and fading in `life`.
 */
export function afterimage(ctx, x, y, tx, ty, c, a = 0.55, life = 0.15, frac = 0.6, size = 0.62) {
  const p = ctx.spr(ctx.b.bbN, DECOR, ctx.R.silhouette, x, size * 0.55, y, size, size * 0.9, life, c, a);
  if (!p) return null;
  p.asp = 0.75;
  p.vx = ((tx - x) * frac) / life;
  p.vz = ((ty - y) * frac) / life;
  return p;
}

/** One persistent shadow clone this frame (with a soft ground shadow). */
export function drawClone(ctx, x, y, c, a = 0.65, size = 0.62, bob = 0) {
  if (!ctx.quad(ctx.b.bbN, FAMILIAR, x, size * 0.52 + bob, y, size * 0.75, size, ctx.R.silhouette, c, a)) return false;
  ctx.quadRGB(ctx.b.groundN, FAMILIAR, x, 0.066, y, 0.4, 0.4, ctx.R.shadow, 0.05, 0.04, 0.1, 0.3);
  return true;
}
