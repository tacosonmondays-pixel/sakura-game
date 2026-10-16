// Chika (roaming drones `bullet`, own `bolt`; Tesla T4 → chain).
// Signature: her drones are drawn where the sim flies them (patterns/drones.js: a little orbit at
// home, a sway while hunting, the sim position at each shot). Her own shot is a spinning wrench toss.
//   P0 Sentry Works   T3 tighter formation · T4 plasma tint + engine trails + cyan bullets ·
//                     T5 two counter-rotating layers, gold, a command drone
//   P1 Repair Bay     T3 the oldest drone carries a green work light · T4 beacon ring every 2 s ·
//                     T5 banner glint on that drone
//   P2 Tesla          T3 micro-arcs at the nose · T4 drones dock over her coil while home, chain
//                     from the coil · T5 faster spin, gold-white bolts
import * as THREE from 'three';
import { DEFAULT_DRONE_LOOK } from '../patterns/drones.js';
import { chainBolt } from '../patterns/segments.js';
import { lookAt } from '../flair.js';
import { genericAttack } from './generic.js';
import { ripple, sparks, flash } from '../patterns/bursts.js';
import { CORE } from '../context.js';

const HALO_H = 1.35;
const _h = { x: 0, y: 0, h: 0 };

export const chika = {
  id: 'chika',

  init(tw) {
    tw.droneLook = { ...DEFAULT_DRONE_LOOK, tint: new THREE.Color('#ffffff'), eye: new THREE.Color('#7fe3ff') };
    return { beaconT: 0, wasDisabled: new Set(), arcT: 0 };
  },

  onUpgrade(tw, t) {
    const lk = tw.look;
    const L = tw.droneLook;
    L.tint.set('#ffffff');
    L.eye.set('#7fe3ff');
    L.scale = 1.15;
    L.formation = false;
    L.layers = false;
    L.trail = false;
    L.command = false;
    L.patrol = 0;
    L.dockW = 2.4;
    L.arcs = 0;
    L.bulletTint = 0;
    L.bulletGlow = -1;
    if (lk.accent[0] >= 1) {
      L.tint.set('#fff0d6');
      L.scale = 1.2;
    }
    const p0 = lookAt(lk, 0);
    const p1 = lookAt(lk, 1);
    const p2 = lookAt(lk, 2);
    if (p0 >= 3) {
      L.formation = true;
      L.scale = 1.24;
    }
    if (p0 >= 4) {
      L.tint.set('#a6ecff');
      L.eye.set('#c8f6ff');
      L.trail = true;
      L.bulletTint = 0x6fe0ff;
      L.bulletGlow = 0.3;
    }
    if (p0 >= 5) {
      L.layers = true;
      L.tint.set('#ffefb8');
      L.eye.set('#fff3b0');
      L.scale = 1.36;
      L.command = true;
      L.bulletTint = 0xffe08a;
    }
    if (p1 >= 3) L.patrol = t.stats?.aura?.range || 0;
    if (lk.accent[2] >= 1) L.eye.set('#d8f6ff');
    if (p2 >= 3) L.arcs = 2;
    if (p2 >= 5) L.dockW = 3.2;
  },

  onAttack(ev, tw, t, ctx) {
    genericAttack(ev, tw, t, ctx);
  },

  /** Her own shot (wrench toss) leaves her hand with a little lob. */
  origin(p, t, idx, n, rec, ctx) {
    if (p.kind !== 'bolt') return false;
    ctx.hand(t, _h);
    rec.mx = _h.x;
    rec.my = _h.y;
    rec.mz = _h.h + 0.1;
    rec.bump = 0.25;
    return true;
  },

  view(p, rec, _t, v, ctx) {
    if (rec.turretUid != null) {
      // drone bullet: a bright streak so each shot reads even when the drone is right there
      const vl = Math.hypot(p.vx, p.vy) || 1;
      const c = rec.tw.droneLook?.eye || ctx.col('#7fe3ff');
      v.scale = 1.3;
      ctx.line(ctx.b.bbA, CORE, v.x, v.z, v.y, v.x - (p.vx / vl) * 0.32, v.z, v.y - (p.vy / vl) * 0.32, 0.07, c, 0.85);
      return;
    }
    if (p.kind !== 'bolt') return;
    v.roll = ctx.time * 14 + rec.uid;
    v.sz = 0.8;
  },

  onBuild(ev, tw, t, ctx) {
    // repair-bay accent: a green wrench sparkle as the drone leaves the bay
    if (tw.look.accent[1] >= 1 && ctx.q.sparks) sparks(ctx, t.x, 0.7, t.y, 3, ctx.col('#7be08a'), 1.2);
  },

  /** Tesla Tower: chain lightning from the drone halo over her coil. */
  onChain(ev, tw, t, ctx) {
    if (!ev.points || ev.points.length < 2) return false;
    const p2 = lookAt(tw.look, 2);
    const c = ctx.col(p2 >= 5 ? '#fff6c8' : '#bfe6ff');
    chainBolt(ctx, t.x, HALO_H, t.y, ev.points, c, 0.018, ctx.q.zig, p2 >= 5 ? 0.26 : 0.2);
    flash(ctx, t.x, HALO_H, t.y, 0.45, c, 0.1);
    // 1–2 docked drones flick a mini-arc down to her coil
    const g = ctx.drones.groups.get(t.uid);
    if (g && ctx.q.sparks) {
      for (let k = 0; k < Math.min(2, g.list.length); k++) {
        const v = g.list[(k * 3 + (ctx.frame % 2)) % g.list.length];
        const s = ctx.segs.add(v.dx, v.dh, v.dy, t.x, 0.9, t.y, 0.06, c, 0.1, 4 | 2);
        if (s) s.k = 2;
      }
    }
    return true;
  },

  update(gdt, tw, t, ctx) {
    const d = tw.data;
    const p1 = lookAt(tw.look, 1);
    const aura = t.stats?.aura;
    if (p1 >= 4 && aura) {
      d.beaconT -= gdt;
      if (d.beaconT <= 0) {
        d.beaconT = 2;
        ripple(ctx, t.x, t.y, 0.3, aura.range, 0.9, ctx.col('#7be08a'), 0, 'ringSoft', true, 0.25);
      }
    }
    if (p1 >= 3 && aura) {
      // green "fix" spark on an ally whose sabotage clears inside her aura
      const sim = ctx.sim;
      for (let i = 0; i < sim.towers.length; i++) {
        const a = sim.towers[i];
        if (a.uid === t.uid) continue;
        const inside = (a.x - t.x) ** 2 + (a.y - t.y) ** 2 <= aura.range * aura.range;
        if (a.disabled > 0) {
          if (inside) d.wasDisabled.add(a.uid);
        } else if (d.wasDisabled.has(a.uid)) {
          d.wasDisabled.delete(a.uid);
          if (inside) {
            sparks(ctx, a.x, 0.8, a.y, 6, ctx.col('#7be08a'), 1.4, CORE);
            flash(ctx, a.x, 0.7, a.y, 0.5, ctx.col('#b9fbc0'), 0.15);
          }
        }
      }
    }
    if (p1 >= 5) {
      // banner glint over the patrol drone
      const g = ctx.drones.groups.get(t.uid);
      const v = g?.list[0];
      if (v && Math.sin(ctx.time * 3) > 0.6) ctx.quad(ctx.b.bbA, 1, v.dx, v.dh + 0.16, v.dy, 0.12, 0.12, ctx.R.star, ctx.col('#b9fbc0'), 0.9, ctx.time);
    }
  },
};
