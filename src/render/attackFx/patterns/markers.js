// Ground markers: landing reticles under lobbed shells (at the sim's live aim point) and
// short-lived decals (stains, scorch, cracks, fans). Phone rule: nothing lingers > 0.9 s.
import { CORE } from '../context.js';
import { GROUND, EASE_OUT } from '../quadPool.js';

/**
 * Landing reticle drawn this frame at the sim's aim point (p.tx, p.ty), shrinking as the shell
 * comes down (k = flight progress 0..1).
 */
export function reticle(ctx, x, y, splash, k, c, a = 0.85, inner = null) {
  const s = Math.max(0.35, splash * 2) * (1 - 0.7 * Math.min(1, k));
  const R = ctx.R;
  ctx.quad(ctx.b.groundN, CORE, x, 0.075, y, s, s, R.reticle, c, a * (0.55 + 0.45 * k), ctx.time * 1.6);
  ctx.quad(ctx.b.groundA, CORE, x, 0.078, y, s * 0.5, s * 0.5, R.glow, inner || c, 0.35 + 0.3 * k);
}

/** Flat decal (crack, swirl, fan, scorch) that fades over `life` game seconds. */
export function decal(ctx, uv, x, y, s0, s1, life, c, a = 0.6, rot = 0, additive = false) {
  const p = ctx.spr(additive ? ctx.b.groundA : ctx.b.groundN, CORE, uv, x, 0.05, y, s0, s1, Math.min(0.9, life), c, a);
  if (p) {
    p.rot = rot;
    p.flags = GROUND | EASE_OUT;
  }
  return p;
}
