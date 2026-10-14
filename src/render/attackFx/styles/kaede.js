// Kaede (duel with a damage ramp, rapier). Signature "Maple lunge": she steps at her target with
// a rapier glint, a white thrust line and a slash sized by her ramp; maple leaves orbit her, one more for
// every two hits in a row (orange turning crimson), and scatter when the ramp resets.
//   P0 Unbroken Rhythm: T3 up to 8 leaves; T5 glowing leaves
//   P1 Flowing Blade: an afterimage streak along the lunge; T5 a leaf burst on each hit
//   P2 Guard Breaker: a pommel shock ring when her stun lands on her target
import { lookAt } from '../flair.js';
import { SEG_CORE } from '../patterns/segments.js';
import { ripple, petalSpiral } from '../patterns/bursts.js';
import { afterimage } from '../patterns/clones.js';
import { genericAttack } from './generic.js';
import { CORE, DECOR, FAMILIAR } from '../context.js';

const ORANGE = [1, 0.55, 0.15];
const CRIMSON = [0.85, 0.1, 0.18];

export const kaede = {
  id: 'kaede',

  init() {
    return { leaves: 0, ramp: 0 };
  },

  onAttack(ev, tw, t, ctx) {
    if (ev.kind !== 'slash') return genericAttack(ev, tw, t, ctx);
    const d = tw.data;
    const lk = tw.look;
    const ramp = ev.ramp || 0;
    const maxLeaves = lookAt(lk, 0) >= 3 ? 8 : 6;
    // ramp reset → the leaves scatter
    if (ramp < d.ramp && d.leaves > 0) petalSpiral(ctx, ctx.R.maple, t.x, t.y, d.leaves, ctx.col('#ff7b2e'), 1, 0.6);
    d.ramp = ramp;
    d.leaves = Math.min(maxLeaves, Math.floor(ramp / 2));
    const e = ctx.enemy(ev.targetUid);
    if (!e) return;
    const dx = e.x - t.x;
    const dy = e.z - t.y;
    const len = Math.hypot(dx, dy) || 1;
    ctx.lunge.start(t.uid, dx, dy, 0.25, 0.05, 0.04, 0.15);
    const h = ctx.enemyH(e);
    // base cue sized for a phone: the step forward, a rapier glint and a white thrust line that
    // holds ≈ 0.1 s, then the slash on her target
    const sx = t.x + (dx / len) * 0.3;
    const sy = t.y + (dy / len) * 0.3;
    if (ctx.cap('muzzle')) ctx.spr(ctx.b.bbA, CORE, ctx.R.star, sx, 0.55, sy, 0.38, 0.1, 0.1, ctx.col('#ffffff'), 1);
    ctx.segs.add(sx, 0.5, sy, e.x, h, e.z, 0.1, ctx.col('#ffffff'), 0.12, SEG_CORE);
    // the slash grows with the ramp
    const size = 0.9 + Math.min(0.7, ramp * 0.06);
    const k = Math.min(1, ramp / 12);
    const c = ctx.col('#ffffff');
    const p = ctx.spr(ctx.b.bbA, CORE, ctx.R.slash, e.x, h, e.z, size * 0.8, size * 1.2, 0.16, c, 1);
    if (p) {
      p.asp = 2;
      p.rot = (Math.random() - 0.5) * 1.4;
      p.r = ORANGE[0] + (CRIMSON[0] - ORANGE[0]) * k;
      p.gc = ORANGE[1] + (CRIMSON[1] - ORANGE[1]) * k;
      p.bc = ORANGE[2] + (CRIMSON[2] - ORANGE[2]) * k;
    }
    if (lookAt(lk, 1) >= 1 && ctx.q.clones > 0) afterimage(ctx, t.x, t.y, e.x, e.z, ctx.col('#ff9e57'), 0.35, 0.12, 0.35, 0.6 * ctx.bodyScale(t));
    if (lookAt(lk, 1) >= 5) petalSpiral(ctx, ctx.R.maple, e.x, e.z, 5, ctx.col('#ff6b2e'), 0.6, 0.45);
  },

  onStatus(ev, tw, t, ctx) {
    if (ev.status !== 'stun' || lookAt(tw.look, 2) < 1 || ev.uid !== tw.lastTargetUid) return;
    const e = ctx.enemy(ev.uid);
    if (e) ripple(ctx, e.x, e.z, 0.1, 0.6, 0.25, ctx.col('#ffe066'), 0, 'ringThick', true, 0.9);
  },

  update(gdt, tw, t, ctx) {
    const d = tw.data;
    if (!d.leaves) return;
    const glow = lookAt(tw.look, 0) >= 5;
    const k = Math.min(1, d.ramp / 12);
    const r = ORANGE[0] + (CRIMSON[0] - ORANGE[0]) * k;
    const g = ORANGE[1] + (CRIMSON[1] - ORANGE[1]) * k;
    const b = ORANGE[2] + (CRIMSON[2] - ORANGE[2]) * k;
    const s = ctx.bodyScale(t);
    for (let i = 0; i < d.leaves; i++) {
      const a = ctx.time * 2.2 + (i / d.leaves) * Math.PI * 2;
      const x = t.x + Math.sin(a) * 0.45 * s;
      const y = t.y + Math.cos(a) * 0.45 * s;
      const h = (0.55 + 0.12 * Math.sin(a * 2 + i)) * s;
      if (!ctx.quadRGB(ctx.b.bbN, FAMILIAR, x, h, y, 0.15, 0.15, ctx.R.maple, r, g, b, 1, a)) break;
      if (glow) ctx.quadRGB(ctx.b.bbA, DECOR, x, h, y, 0.3, 0.3, ctx.R.glow, r, g, b, 0.5);
    }
  },
};
