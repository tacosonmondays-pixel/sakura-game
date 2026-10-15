// Rei (pulse sweep; Duelist T4 → duel `slash`). Signature "Crimson Crescent": one thin crescent
// sweeps across the angular span of the enemies the sweep really hit, at their distance, with a
// light X cut and a few petal flecks on each victim (petal-coloured light, no gore).
//   P0 Whirlwind: T3 a second crescent just behind; T5 a petal vortex
//   P1 Duelist: T4 iai lunge — she darts 0.22 toward the target, a white line cuts through it
//   P2 Counter Form: a parry glint ring at her feet; T3+ a "clang" star when her hit stuns or
//      silences
import { lookAt } from '../flair.js';
import { spanOf, crescentSweep } from '../patterns/sweep.js';
import { ripple, petalSpiral, flash } from '../patterns/bursts.js';
import { SEG_CORE } from '../patterns/segments.js';
import { genericAttack } from './generic.js';
import { victims } from './util.js';
import { CORE, DECOR } from '../context.js';

const SPAN = { a0: 0, a1: 0, r: 1, n: 0 };
const CRIMSON = '#ff4d6d';
const PETAL = '#ffb3c6';

function xCut(ctx, x, h, y, c) {
  for (let k = 0; k < 2; k++) {
    const p = ctx.spr(ctx.b.bbA, CORE, ctx.R.beam, x, h, y, 0.42, 0.5, 0.12, c, 0.95);
    if (p) {
      p.asp = 0.14;
      p.rot = k ? Math.PI / 4 + Math.PI / 2 : Math.PI / 4;
      p.rot += Math.PI / 2;
      p.delay = k * 0.03;
    }
  }
}

export const rei = {
  id: 'rei',

  onPulse(ev, tw, t, ctx, i, events) {
    const v = victims(ctx, events, i, ev.x, ev.y, ev.radius, ev.attackType, t.eff?.maxTargets || 3);
    spanOf(ev.x, ev.y, v.xs, v.ys, v.n, SPAN, 0.3, 1.4, ctx.facing(t));
    const r = Math.min(ev.radius, Math.max(0.6, SPAN.r));
    const lk = tw.look;
    const p0 = lookAt(lk, 0);
    const col = ctx.col(CRIMSON);
    if (ctx.cap('sweep')) {
      crescentSweep(ctx, ev.x, ev.y, SPAN.a0, SPAN.a1, r, 0.12, col, 0.7 * tw.intensity, ctx.quality === 'low' ? 3 : 5, 0.42);
      if (p0 >= 3) crescentSweep(ctx, ev.x, ev.y, SPAN.a0 - 0.2, SPAN.a1 + 0.2, Math.min(ev.radius, r * 1.15), 0.12, ctx.col(PETAL), 0.6, 4, 0.5);
      if (p0 >= 5 && ctx.q.sparks) petalSpiral(ctx, ctx.R.petal, ev.x, ev.y, 12, ctx.col(PETAL), Math.min(ev.radius, 1.6), 0.7);
      if (lookAt(lk, 2) >= 1 || lk.accent[2] >= 1) ripple(ctx, t.x, t.y, 0.15, 0.55, 0.22, ctx.col('#ffffff'), 0, 'ring', true, 0.7);
    }
    for (let k = 0; k < v.n; k++) {
      const e = ctx.enemy(v.uids[k]);
      if (!e) continue;
      const h = ctx.enemyH(e);
      xCut(ctx, e.x, h, e.z, ctx.col('#ffe3ea'));
      if (ctx.q.sparks) {
        for (let j = 0; j < 3; j++) {
          const p = ctx.spr(ctx.b.bbN, DECOR, ctx.R.petal, e.x, h, e.z, 0.1, 0.07, 0.45, ctx.col(PETAL), 1);
          if (!p) break;
          const a = Math.random() * Math.PI * 2;
          p.vx = Math.cos(a) * 0.9;
          p.vz = Math.sin(a) * 0.9;
          p.vy = 0.8;
          p.g = -3;
          p.vrot = 6;
        }
      }
    }
    return true;
  },

  onAttack(ev, tw, t, ctx) {
    if (ev.kind !== 'slash') return;
    // Duelist: iai lunge + a white line through the target + the slash
    const e = ctx.enemy(ev.targetUid);
    if (!e) return genericAttack(ev, tw, t, ctx);
    const dx = e.x - t.x;
    const dy = e.z - t.y;
    const d = Math.hypot(dx, dy) || 1;
    ctx.lunge.start(t.uid, dx, dy, 0.22, 0.06, 0.04, 0.16);
    const h = ctx.enemyH(e);
    ctx.segs.add(e.x - (dx / d) * 0.5, h, e.z - (dy / d) * 0.5, e.x + (dx / d) * 0.45, h, e.z + (dy / d) * 0.45, 0.08, ctx.col('#ffffff'), 0.12, SEG_CORE);
    genericAttack(ev, tw, t, ctx);
    if ((ev.ramp || 0) >= 6) flash(ctx, e.x, h, e.z, 0.5, ctx.col(CRIMSON), 0.12);
  },

  onStatus(ev, tw, t, ctx) {
    if (lookAt(tw.look, 2) < 3) return;
    if (ev.status !== 'stun' && ev.status !== 'silence') return;
    const e = ctx.enemy(ev.uid);
    if (!e) return;
    const p = ctx.spr(ctx.b.bbA, CORE, ctx.R.star, e.x, ctx.enemyH(e) + 0.2, e.z, 0.4, 0.15, 0.2, ctx.col('#fff3b0'), 1);
    if (p) p.vrot = 10;
  },
};
