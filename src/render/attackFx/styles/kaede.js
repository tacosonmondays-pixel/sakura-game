// Kaede (duel with a damage ramp, rapier). Signature "Maple lunge": she steps at her target with
// a rapier glint, a white thrust line and a slash sized by her ramp; maple leaves orbit her, one more for
// every two hits in a row (orange turning crimson), and scatter when the ramp resets.
//   P0 Unbroken Rhythm: T3 up to 8 leaves; T5 glowing leaves
//   P1 Flowing Blade: an afterimage streak along the lunge; T5 a leaf burst on each hit
//   P2 Guard Breaker: a pommel shock ring when her stun lands on her target
// Blade arts (the sim's 'bladeArt' event, src/sim/towers.js bladeArts), in the same maple palette:
//   Maple Cleave: an orange crescent sweeping across her target and a soft ring the size of the cut
//   wind crescents (Flowing Blade 3+): white-gold crescents flying out along each line of the fan
//   maple storm (Flowing Blade 5): a whirl of maple leaves and a crimson ring around her
//   shockwave (Guard Breaker 4-5): a ground ray along the line with armor shards along it
//   maple splash (Unbroken Rhythm 3+, at full focus): crimson leaves bursting from her target
import { lookAt } from '../flair.js';
import { SEG_CORE } from '../patterns/segments.js';
import { ripple, petalSpiral, shardBurst } from '../patterns/bursts.js';
import { crescentSweep, raySweep } from '../patterns/sweep.js';
import { afterimage } from '../patterns/clones.js';
import { genericAttack } from './generic.js';
import { CORE, DECOR, FAMILIAR } from '../context.js';

const ORANGE = [1, 0.55, 0.15];
const CRIMSON = [0.85, 0.1, 0.18];
/** The sim's crescent fan step (towers.js FAN_COS / FAN_SIN). */
const FAN = 0.32;

/** A wind crescent flying from (x, y) along (ux, uy) for len tiles: a streak and three slash sprites. */
function windCrescent(ctx, x, y, ux, uy, len, c) {
  const ex = x + ux * len;
  const ey = y + uy * len;
  ctx.segs.add(x + ux * 0.3, 0.45, y + uy * 0.3, ex, 0.45, ey, 0.14, c, 0.1, SEG_CORE);
  for (let i = 0; i < 3; i++) {
    const k = 0.4 + i * 0.3;
    const px = x + ux * len * k;
    const py = y + uy * len * k;
    const p = ctx.spr(ctx.b.bbA, i ? DECOR : CORE, ctx.R.slash, px, 0.45, py, 0.55, 0.75, 0.14, c, 0.95);
    if (!p) continue;
    p.asp = 2;
    // the crescent's long axis lies across its flight
    p.rot = ctx.screenAngle(px, 0.45, py, -uy, 0, ux) + Math.PI;
    p.delay = 0.03 * i;
  }
}

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

  onOther(ev, tw, t, ctx) {
    if (ev.type !== 'bladeArt') return false;
    if (ev.kind === 'maple') {
      // full focus: crimson leaves burst from her target as far as they cut
      petalSpiral(ctx, ctx.R.maple, ev.x, ev.y, 4 + Math.min(4, ev.hits || 0), ctx.col('#e0313f'), ev.radius, 0.45);
      return true;
    }
    const a = Math.atan2(ev.dx, ev.dy);
    // the Maple Cleave across her target, sized to the cut
    if (ev.radius > 0) {
      crescentSweep(ctx, ev.x, ev.y, a - 1.1, a + 1.1, ev.radius * 0.75, 0.1, ctx.col('#ff9e57'), 0.85, 5, 0.4, 0.16);
      ripple(ctx, ev.x, ev.y, 0.2, ev.radius, 0.25, ctx.col('#ff7b2e'), 0, 'ringSoft', true, 0.55);
    }
    // wind crescents: straight through her target, then pairs either side (the sim's fan)
    const n = ev.crescents || 0;
    if (n > 0 && ev.cLen > 0) {
      const c = ctx.col(lookAt(tw.look, 1) >= 5 ? '#ffe7a3' : '#ffffff');
      for (let i = 0; i < n; i++) {
        const k = Math.ceil(i / 2) * (i % 2 ? -1 : 1);
        const ang = a + k * FAN;
        windCrescent(ctx, t.x, t.y, Math.sin(ang), Math.cos(ang), ev.cLen, c);
      }
    }
    // the maple storm whirls round her
    if (ev.storm > 0) {
      petalSpiral(ctx, ctx.R.maple, t.x, t.y, 10, ctx.col('#ff6b2e'), ev.storm, 0.7);
      petalSpiral(ctx, ctx.R.maple, t.x, t.y, 6, ctx.col('#c8203a'), ev.storm * 0.7, 0.6);
      ripple(ctx, t.x, t.y, 0.4, ev.storm, 0.35, ctx.col('#e0313f'), 0.05, 'ringSoft', true, 0.5);
    }
    // the shockwave splits the ground along her line; armor shards fly where it runs
    if (ev.wave > 0) {
      raySweep(ctx, t.x, t.y, a, a, ev.wave, 1, 0, ctx.col('#ffd166'), 0.42, 0.3, 0.9);
      for (let i = 1; i <= 3; i++) {
        const d = (ev.wave * i) / 3;
        if (ctx.cap('muzzle')) shardBurst(ctx, t.x + Math.sin(a) * d, 0.2, t.y + Math.cos(a) * d, 3, ctx.col('#b0b8c4'), 1.4);
      }
    }
    return true;
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
