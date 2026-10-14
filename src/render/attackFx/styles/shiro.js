// Shiro (hitscan sniper: the sim resolves her shot instantly). Signature "Glint and tracer":
// while she is about to fire, a scope glint pulses at her rifle and a faint sight line runs to
// her last target; on the shot a tracer flashes from the muzzle to the enemy the sim hit, with
// a muzzle cone and an ejected casing; extra tracers go to her other attributed hits.
//   P0 Execution: a wider tracer; T5 it lingers with a ring at the target
//   P1 Spotter's Mark: a red sight line + laser dot; T5 a hawk spotter
//   P2 Follow-up: T5 silver tracers
import { lookAt } from '../flair.js';
import { SEG_CORE, SEG_HOLD } from '../patterns/segments.js';
import { ripple } from '../patterns/bursts.js';
import { Spotter } from '../patterns/spotter.js';
import { hand, victims } from './util.js';
import { CORE, DECOR } from '../context.js';

export const shiro = {
  id: 'shiro',

  init() {
    return { spotter: new Spotter() };
  },

  onAttack(ev, tw, t, ctx, i, events) {
    const lk = tw.look;
    const p0 = lookAt(lk, 0);
    const silver = lookAt(lk, 2) >= 5;
    const h = hand(ctx, t);
    const mx = h.x;
    const my = h.y;
    const mh = h.h + 0.08;
    const col = ctx.col(silver ? '#e8eef8' : '#ffe8a8');
    const w = (p0 >= 3 ? 0.11 : 0.07) * (1 + 0.15 * lk.accent[0]);
    const life = p0 >= 5 ? 0.35 : 0.12;
    const e = ctx.enemy(ev.targetUid);
    if (e && ctx.cap('tracer')) {
      const eh = ctx.enemyH(e);
      ctx.segs.add(mx, mh, my, e.x, eh, e.z, w, col, life, SEG_CORE | SEG_HOLD);
      if (p0 >= 5) ripple(ctx, e.x, e.z, 0.1, 0.5, 0.3, col, 0, 'ring', true, 0.9);
      // muzzle cone pointing down the shot
      const ang = ctx.screenAngle(mx, mh, my, e.x - mx, eh - mh, e.z - my);
      const c = ctx.spr(ctx.b.bbA, CORE, ctx.R.cone, mx, mh, my, 0.36, 0.22, 0.07, ctx.col('#fff6d0'), 1);
      if (c) {
        c.asp = 0.6;
        c.rot = ang - Math.PI / 2;
      }
    }
    // casing
    const f = ctx.facing(t);
    const cs = ctx.spr(ctx.b.bbN, DECOR, ctx.R.white, mx, mh, my, 0.05, 0.05, 0.45, ctx.col('#e2c275'), 1);
    if (cs) {
      cs.vx = Math.cos(f) * 1.2;
      cs.vz = -Math.sin(f) * 1.2;
      cs.vy = 1.4;
      cs.g = -8;
      cs.asp = 2;
      cs.vrot = 14;
    }
    // follow-up hits (attributed to this shot), 0.04 s apart
    const max = Math.max(1, (t.eff?.projectiles || 1) * (t.eff?.pierce || 1));
    if (max > 1) {
      const v = victims(ctx, events, i, t.x, t.y, t.eff?.range || 10, ev.attackType || t.eff?.attackType, max);
      let k = 0;
      for (let j = 0; j < v.n; j++) {
        if (v.uids[j] === ev.targetUid) continue;
        const o = ctx.enemy(v.uids[j]);
        if (!o || !ctx.cap('tracer')) continue;
        const s = ctx.segs.add(mx, mh, my, o.x, ctx.enemyH(o), o.z, w * 0.8, col, life, SEG_CORE | SEG_HOLD);
        if (s) s.delay = 0.04 * ++k;
      }
    }
  },

  update(gdt, tw, t, ctx) {
    const lk = tw.look;
    const p1 = lookAt(lk, 1);
    const cd = t.cooldown;
    const e = ctx.enemy(tw.lastTargetUid);
    if (e && cd > 0 && cd <= 0.35 && ctx.inCombat(tw)) {
      const d2 = (e.x - t.x) ** 2 + (e.z - t.y) ** 2;
      const r = t.eff?.range || 10;
      if (d2 <= r * r) {
        const h = hand(ctx, t);
        const k = 1 - cd / 0.35;
        const pulse = 0.6 + 0.4 * Math.sin(ctx.time * 30);
        ctx.quad(ctx.b.bbA, CORE, h.x, h.h + 0.1, h.y, 0.3 * (0.6 + k) * pulse, 0.3 * (0.6 + k) * pulse, ctx.R.star, ctx.col('#ffffff'), 0.9, ctx.time * 3);
        const red = p1 >= 3;
        ctx.line(ctx.b.bbA, CORE, h.x, h.h + 0.08, h.y, e.x, ctx.enemyH(e), e.z, red ? 0.035 : 0.025, ctx.col(red ? '#ff4d6d' : '#d8f6ff'), (red ? 0.55 : 0.3) * k);
        if (red) ctx.quad(ctx.b.bbA, CORE, e.x, ctx.enemyH(e), e.z, 0.14, 0.14, ctx.R.glow, ctx.col('#ff4d6d'), 0.9);
      }
    }
    if (p1 >= 5 && ctx.q.familiars > 0) tw.data.spotter.update(ctx, gdt, t, tw.lastTargetUid, Math.min(6, t.eff?.range || 6), ctx.col('#f4e2c4'));
  },

  onStatus(ev, tw) {
    if (ev.status === 'mark' && ev.uid === tw.lastTargetUid) tw.data.spotter.diveAt();
  },
};
