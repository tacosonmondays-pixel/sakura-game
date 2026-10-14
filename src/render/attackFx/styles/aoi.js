// Aoi (projectile `arrow`). Signature "Fletch streaks": every arrow trails a short white streak
// and her bow string flashes white.
//   P0 Piercing: comet tail 0.5; T5 a contrail from her bow to the aim point (0.3 s)
//   P1 Rapid Volley: a paper crane flies a figure-8 around her (never fires) and flaps faster
//      after each volley; 2 cranes at T4, 3 at T5
//   P2 Sky Hunter: a hawk spotter hovers just ahead of the enemy she is shooting, and dives
//      when a mark lands on it
import { lookAt } from '../flair.js';
import { figure8 } from '../patterns/patrol.js';
import { Spotter } from '../patterns/spotter.js';
import { SEG_GROW } from '../patterns/segments.js';
import { hand } from './util.js';
import { CORE, DECOR, FAMILIAR } from '../context.js';

const F8 = { x: 0, y: 0, dx: 0, dy: 0 };

export const aoi = {
  id: 'aoi',

  init() {
    return { spotter: new Spotter(), flap: 0 };
  },

  onAttack(ev, tw, t, ctx) {
    tw.data.flap = 1;
    if (!ctx.cap('muzzle')) return;
    const h = hand(ctx, t);
    ctx.spr(ctx.b.bbA, CORE, ctx.R.glow, h.x, h.h + 0.05, h.y, 0.3, 0.12, 0.08, ctx.col('#ffffff'), 1);
    const p = ctx.spr(ctx.b.bbA, DECOR, ctx.R.beam, h.x, h.h + 0.05, h.y, 0.4, 0.4, 0.08, ctx.col('#ffffff'), 0.9);
    if (p) {
      p.asp = 0.15;
      p.rot = Math.PI / 2;
    }
    if (lookAt(tw.look, 0) >= 5) {
      const e = ctx.enemy(ev.targetUid);
      if (e) ctx.segs.add(h.x, h.h, h.y, e.x, ctx.enemyH(e), e.z, 0.06, ctx.col('#e8f6ff'), 0.3, SEG_GROW, -1, 0.6);
    }
  },

  origin(p, t, idx, n, rec, ctx) {
    const h = hand(ctx, t);
    rec.mx = h.x;
    rec.my = h.y;
    rec.mz = h.h + 0.05;
    return true;
  },

  view(p, rec, _t, v, ctx) {
    const lk = rec.tw.look;
    const tail = lookAt(lk, 0) >= 3 ? 0.5 : 0.25 + 0.05 * lk.accent[0];
    const vl = Math.hypot(p.vx, p.vy) || 1;
    ctx.line(ctx.b.bbA, ctx.q.trails ? CORE : DECOR, v.x, v.z, v.y, v.x - (p.vx / vl) * tail, v.z, v.y - (p.vy / vl) * tail, 0.06, ctx.col('#ffffff'), 0.75);
  },

  update(gdt, tw, t, ctx) {
    const lk = tw.look;
    const d = tw.data;
    d.flap = Math.max(0, d.flap - gdt * 1.5);
    const p1 = lookAt(lk, 1);
    if (p1 >= 3 && ctx.q.familiars > 0) {
      const n = Math.min(ctx.q.familiars, p1 >= 5 ? 3 : p1 >= 4 ? 2 : 1);
      const lobe = 0.45 * (t.eff?.range || 3);
      for (let i = 0; i < n; i++) {
        figure8(t.x, t.y, lobe, ctx.time, 5, (i / n) * Math.PI * 2, i * 0.9, F8);
        const h = 1.2 + 0.08 * Math.sin(ctx.time * 2 + i);
        const flapRate = 6 + 10 * d.flap;
        const up = Math.sin(ctx.time * flapRate + i) > 0;
        const ang = ctx.screenAngle(F8.x, h, F8.y, F8.dx, 0, F8.dy);
        const flip = Math.cos(ang) < 0 ? -1 : 1;
        const s = 0.34 * ctx.readScale;
        if (!ctx.quad(ctx.b.bbN, FAMILIAR, F8.x, h, F8.y, s * flip, s * 0.66, up ? ctx.R.crane0 : ctx.R.crane1, ctx.col('#ffffff'), 1)) break;
        ctx.quadRGB(ctx.b.groundN, FAMILIAR, F8.x, 0.066, F8.y, 0.2, 0.14, ctx.R.shadow, 0.05, 0.05, 0.1, 0.22);
      }
    }
    if (lookAt(lk, 2) >= 3 && ctx.q.familiars > 0) {
      d.spotter.update(ctx, gdt, t, tw.lastTargetUid, (t.eff?.range || 3) + 0.5, ctx.col('#f4e2c4'));
    }
  },

  onStatus(ev, tw, t, ctx) {
    if (ev.status === 'mark' && ev.uid === tw.lastTargetUid && lookAt(tw.look, 2) >= 3) tw.data.spotter.diveAt();
  },
};
