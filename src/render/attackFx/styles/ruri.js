// Ruri (projectile from her relay familiar). Signature "Kon's holo bolts": every bolt leaps out of
// Kon, the holographic white fox at her relay origin (his figure: src/render/companions.js, where he is
// drawn right now, even while he runs there; fallback: rosterFx.js's procedural fox at the origin):
// a blue flash at the fox, a blue holo bolt with a short trail, a small ring on a real hit.
//   P0 (hound) T3+: a white bite slash on the hit
//   P1 (falcon) T3+: a feather flick on the hit
//   P2 (otter) T3+: water ripple on the hit
import { lookAt } from '../flair.js';
import { flash, ripple } from '../patterns/bursts.js';
import { CORE, DECOR } from '../context.js';
import { impactFx } from '../impacts.js';

const BLUE = '#5ad1ff';
const PALE = '#d8f2ff';
const FOX_H = 0.42;

export const ruri = {
  id: 'ruri',

  onAttack(ev, tw, t, ctx) {
    if (!ctx.cap('muzzle')) return;
    const kon = ctx.actors?.companions?.konAt(t.uid);
    if (kon) flash(ctx, kon.x, kon.h, kon.z, 0.4, ctx.col(BLUE), 0.12);
    else flash(ctx, t.ox ?? t.x, FOX_H, t.oy ?? t.y, 0.5, ctx.col(BLUE), 0.12);
  },

  // the sim fires from the origin (t.ox, t.oy): the bolt leaves Kon's head where he is drawn
  origin(p, t, idx, n, rec, ctx) {
    const kon = ctx?.actors?.companions?.konAt(t.uid);
    if (kon) {
      rec.mx = kon.x;
      rec.my = kon.z;
      rec.mz = kon.h;
    } else {
      rec.mz = FOX_H;
    }
    return true;
  },

  view(p, rec, _t, v, ctx) {
    const c = ctx.col(BLUE);
    const vl = Math.hypot(p.vx, p.vy) || 1;
    ctx.quad(ctx.b.bbA, CORE, v.x, v.z, v.y, 0.3, 0.3, ctx.R.glow, c, 0.9);
    ctx.line(ctx.b.bbA, DECOR, v.x, v.z, v.y, v.x - (p.vx / vl) * 0.38, v.z, v.y - (p.vy / vl) * 0.38, 0.09, ctx.col(PALE), 0.7);
  },

  onImpact(rec, x, y, crit, radius, ctx) {
    const lk = rec.tw.look;
    ripple(ctx, x, y, 0.1, Math.max(0.4, radius), 0.3, ctx.col(BLUE), 0, 'ringSoft', true, 0.8);
    // her impact preset (FX-1): a blue star and sparks, brighter on a crit
    impactFx(ctx, 'ruri', crit ? 'crit' : 'weak', x, 0.35, y);
    if (lookAt(lk, 0) >= 3) {
      const p = ctx.spr(ctx.b.bbA, CORE, ctx.R.slash, x, 0.4, y, 0.5, 0.6, 0.14, ctx.col('#ffffff'), 0.9);
      if (p) p.rot = 0.6;
    }
    if (lookAt(lk, 1) >= 3) {
      const p = ctx.spr(ctx.b.bbN, DECOR, ctx.R.feather, x, 0.5, y, 0.22, 0.18, 0.4, ctx.col(PALE), 1);
      if (p) {
        p.vy = 0.8;
        p.vrot = 5;
      }
    }
    if (lookAt(lk, 2) >= 3) ripple(ctx, x, y, 0.2, 0.7, 0.4, ctx.col('#8fe3ff'), 0.05, 'ring', true, 0.7);
  },

  /** Her kill (FX-1): a fox-bite slash (two curved fangs) and fox-fire wisps rising in her blue. */
  onKill(ev, tw, t, ctx, x, h, y) {
    const pale = ctx.col(PALE);
    for (let i = 0; i < 2; i++) {
      const p = ctx.spr(ctx.b.bbA, CORE, ctx.R.slash, x + (i - 0.5) * 0.12, h, y, 0.42, 0.5, 0.14, pale, 0.9);
      if (p) p.rot = i ? 2.4 : 0.7;
    }
    const c = ctx.col(BLUE);
    const k = ctx.n(3);
    for (let i = 0; i < k; i++) {
      const a = (i / k) * Math.PI * 2;
      const p = ctx.spr(ctx.b.bbA, DECOR, ctx.R.glow, x + Math.cos(a) * 0.12, h, y + Math.sin(a) * 0.12, 0.18, 0.04, 0.6, c, 0.9);
      if (!p) break;
      p.vy = 0.9;
      p.vx = Math.cos(a) * 0.2;
      p.vz = Math.sin(a) * 0.2;
      p.drag = 1.2;
    }
    return true;
  },
};
