// Luna ★ (hero · beam ×3, pierce). Signature "Star Lances": her beams start from a little moon
// familiar floating behind her shoulder, with a white core, a mystic sheath, star dots racing
// out and a star at the end. A beam slot that fires again at a similar angle slides its end
// from the previous one (sweeping lance) instead of snapping. Ends sit on the sim's beam line.
//   P0 wider beams; T5 crescent shocks at the ends
//   P1 Night Gravity: shrinking purple swirls at the beam ends
//   P2 Astral Court: star motes patrol the aura edge; T5 crescent halo over her head
import { lookAt } from '../flair.js';
import { SEG_CORE, SEG_SLIDE } from '../patterns/segments.js';
import { flash } from '../patterns/bursts.js';
import { decal } from '../patterns/markers.js';
import { drawRingFamiliars } from '../patterns/patrol.js';
import { CORE, DECOR, FAMILIAR } from '../context.js';

const MOON_H = 1.2;
const SLOTS = 8;

function moonPos(ctx, t, out) {
  const f = ctx.facing(t);
  const s = ctx.bodyScale(t);
  out.x = t.x - Math.sin(f) * 0.2 * s - Math.cos(f) * 0.22 * s;
  out.y = t.y - Math.cos(f) * 0.2 * s + Math.sin(f) * 0.22 * s;
  out.h = MOON_H * s + 0.04 * Math.sin(ctx.time * 2.1);
  return out;
}
const M = { x: 0, y: 0, h: 0 };

export const luna = {
  id: 'luna',

  init() {
    return { ex: new Float32Array(SLOTS), ey: new Float32Array(SLOTS), et: new Float32Array(SLOTS).fill(-99), slot: 0 };
  },

  onAttack(ev, tw) {
    tw.data.slot = 0; // beams of one volley come before their attack event
  },

  onBeam(ev, tw, t, ctx) {
    const d = tw.data;
    const k = d.slot++ % SLOTS;
    const lk = tw.look;
    const p0 = lookAt(lk, 0);
    moonPos(ctx, t, M);
    const ex = ev.to[0];
    const ey = ev.to[1];
    const w = Math.max(0.14, (ev.width || 0.15) * 1.5) * (1 + 0.1 * (p0 || lk.accent[0]));
    const sheath = ctx.col(p0 >= 5 ? '#e3d4ff' : '#b48cff');
    const s = ctx.segs.add(M.x, M.h, M.y, ex, 0.35, ey, w, sheath, 0.18, SEG_CORE);
    // sweeping lance: slide from this slot's previous end when the angle barely changed
    const a0 = Math.atan2(d.ex[k] - t.x, d.ey[k] - t.y);
    const a1 = Math.atan2(ex - t.x, ey - t.y);
    let da = Math.abs(a1 - a0);
    if (da > Math.PI) da = Math.PI * 2 - da;
    if (s && ctx.time - d.et[k] < 0.6 && da < 0.7) {
      s.flags |= SEG_SLIDE;
      s.sx = d.ex[k];
      s.sy = 0.35;
      s.sz = d.ey[k];
    }
    d.ex[k] = ex;
    d.ey[k] = ey;
    d.et[k] = ctx.time;
    // star dots racing out along the beam + an end star
    const dots = ctx.q.beamDots;
    for (let i = 0; i < dots; i++) {
      const p = ctx.spr(ctx.b.bbA, DECOR, ctx.R.star, M.x, M.h, M.y, 0.16, 0.08, 0.16, ctx.col('#fff6ff'), 1);
      if (!p) break;
      p.delay = i * 0.03;
      p.vx = (ex - M.x) / 0.16;
      p.vz = (ey - M.y) / 0.16;
      p.vy = (0.35 - M.h) / 0.16;
      p.vrot = 9;
    }
    ctx.spr(ctx.b.bbA, CORE, ctx.R.star, ex, 0.35, ey, 0.3, 0.12, 0.18, ctx.col('#ffffff'), 1);
    flash(ctx, M.x, M.h, M.y, 0.4, sheath, 0.1);
    if (p0 >= 5) {
      const p = ctx.spr(ctx.b.bbA, DECOR, ctx.R.slash, ex, 0.4, ey, 0.55, 0.8, 0.16, ctx.col('#e3d4ff'), 0.9);
      if (p) p.asp = 2;
    }
    if (lookAt(lk, 1) >= 3) decal(ctx, ctx.R.swirl, ex, ey, 0.9, 0.2, 0.5, ctx.col('#9b5de5'), 0.7, ctx.time * 3, true);
    return true;
  },

  update(gdt, tw, t, ctx) {
    // the moon familiar (always: it is where her beams come from)
    moonPos(ctx, t, M);
    const sc = 0.3 * ctx.readScale;
    ctx.quad(ctx.b.bbN, CORE, M.x, M.h, M.y, sc, sc, ctx.R.moon, ctx.col('#f3ecff'), 1, 0.3);
    ctx.quad(ctx.b.bbA, DECOR, M.x, M.h, M.y, sc * 2.2, sc * 2.2, ctx.R.glow, ctx.col('#b48cff'), 0.35);
    const p2 = lookAt(tw.look, 2);
    const aura = t.stats?.aura?.range || 0;
    if (p2 >= 3 && aura > 0 && ctx.q.familiars > 0) {
      const n = Math.min(ctx.q.lanterns, p2 >= 5 ? 5 : p2 + 0);
      drawRingFamiliars(ctx, t, ctx.R.star, n, aura, -0.3, 0.85, 0.18 * ctx.readScale, ctx.col('#e6dcff'), ctx.selectedUid === t.uid);
    }
    if (p2 >= 5) {
      const s = ctx.bodyScale(t);
      ctx.quad(ctx.b.bbA, FAMILIAR, t.x, 1.38 * s, t.y, 0.42, 0.42, ctx.R.moon, ctx.col('#e6dcff'), 0.8, ctx.time * 0.5);
    }
  },
};
