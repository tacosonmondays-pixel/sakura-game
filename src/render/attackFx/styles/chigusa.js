// Chigusa (thorn seeds, vines and thorn beds, src/sim/vines.js). Signature "Everything grows": her fan of
// seeds flies as little green seed-leaves turning along their flight with a curling tendril behind;
// a seed that lands pops a leafy puff and two small thorns snap up. Her Creeping Vine whips out from
// her watering can as a growing green line, bursts leaves on the walker and coils round it for as
// long as the sim holds it.
//   P0 Wild Growth: T3+ Bloom Rush: the seeds blush pink and shed petals as her bloom climbs; T5 a
//                   gold pollen glow on every seed
//   P1 Greenhouse:  T1+ the slow curls a little tendril at the walker's feet; T3+ Strangler Vine: thorn
//                   pricks on the held walker; T5 a second coil and leaves circling it; a new thorn bed
//                   bursts thorns where it grows (the bed itself belongs to the placed-object pass)
//   P2 Harvest:     T3+ the poison bubbles green over the walker
import { lookAt } from '../flair.js';
import { flash, shardBurst, petalSpiral } from '../patterns/bursts.js';
import { spikes, coil, statusCue, hash01 } from '../patterns/academy.js';
import { hand, every } from './util.js';
import { CORE, DECOR } from '../context.js';

const LEAF = '#6fcf5e';
const DEEP = '#2f8a3a';
const PINK = '#ff9ec4';
const POLLEN = '#ffe27a';
const TENDRIL = '#a6e86f';

/** Bloom Rush level 0..1 of a girl (her attack-speed ramp, read from the sim). */
function bloomOf(t) {
  const v = t.stats?.vine;
  if (!v || !(v.bloom > 0)) return 0;
  return Math.min(v.bloom, (v.bloomPer || 0) * (t.bloomT || 0)) / v.bloom;
}

export const chigusa = {
  id: 'chigusa',

  init() {
    return { prickT: 0, curls: [{ uid: -1, t: 1 }, { uid: -1, t: 1 }, { uid: -1, t: 1 }, { uid: -1, t: 1 }] };
  },

  onAttack(ev, tw, t, ctx) {
    if (!ctx.cap('muzzle')) return;
    const h = hand(ctx, t);
    // a spritz of green from her can
    const p = ctx.spr(ctx.b.bbA, CORE, ctx.R.glow, h.x, h.h + 0.05, h.y, 0.22, 0.32, 0.1, ctx.col(TENDRIL), 1);
    if (p) p.asp = 1.6;
  },

  view(p, rec, _t, v, ctx) {
    v.skip = true;
    const vl = Math.hypot(p.vx, p.vy) || 1;
    const ux = p.vx / vl;
    const uy = p.vy / vl;
    const lk = rec.tw.look;
    const owner = ctx.sim.getTower(rec.ownerUid);
    const bloom = owner && lookAt(lk, 0) >= 3 ? bloomOf(owner) : 0;
    // the seed-leaf: green, blushing pink with the bloom, turning along its flight
    const c = ctx.col(LEAF);
    const pk = ctx.col(PINK);
    const r = c.r + (pk.r - c.r) * bloom;
    const g = c.g + (pk.g - c.g) * bloom;
    const b = c.b + (pk.b - c.b) * bloom;
    const rot = ctx.screenAngle(v.x, v.z, v.y, ux, 0, uy) - Math.PI / 2 + (ctx.reduceMotion ? 0 : Math.sin(ctx.time * 18 + rec.uid) * 0.4);
    ctx.quadRGB(ctx.b.bbN, CORE, v.x, v.z, v.y, 0.12, 0.17, ctx.R.leaf || ctx.R.petal, r, g, b, 1, rot);
    ctx.quadRGB(ctx.b.bbA, CORE, v.x, v.z, v.y, 0.2, 0.2, ctx.R.glow, r, g, b, 0.45);
    if (lookAt(lk, 0) >= 5) ctx.quad(ctx.b.bbA, DECOR, v.x, v.z + 0.03, v.y, 0.26, 0.26, ctx.R.glow, ctx.col(POLLEN), 0.55);
    if (ctx.q.trails <= 0) return;
    // a tendril curling behind it (two pieces swaying)
    const sw = ctx.reduceMotion ? 0.02 : Math.sin(ctx.time * 14 + rec.uid * 1.3) * 0.05;
    const td = ctx.col(lk.accent[1] >= 1 || lookAt(lk, 1) > 0 ? DEEP : TENDRIL);
    const ax = v.x - ux * 0.06;
    const ay = v.y - uy * 0.06;
    const mx = ax - ux * 0.14 - uy * sw;
    const my = ay - uy * 0.14 + ux * sw;
    ctx.line(ctx.b.bbA, DECOR, ax, v.z, ay, mx, v.z, my, 0.03, td, 0.85);
    ctx.line(ctx.b.bbA, DECOR, mx, v.z, my, mx - ux * 0.14 + uy * sw, v.z - 0.02, my - uy * 0.14 - ux * sw, 0.022, td, 0.55);
    // Bloom Rush petals: more of them as the bloom climbs
    if (bloom > 0.15 && Math.random() < ctx.gdt * 14 * bloom) {
      const q = ctx.spr(ctx.b.bbN, DECOR, ctx.R.petal || ctx.R.leaf, v.x, v.z, v.y, 0.08, 0.06, 0.45, pk, 1);
      if (q) {
        q.vy = -0.3;
        q.vrot = 6;
      }
    }
  },

  onImpact(rec, x, y, crit, radius, ctx) {
    const c = ctx.col(LEAF);
    flash(ctx, x, 0.35, y, 0.32, c, 0.08, DECOR);
    if (ctx.q.sparks) petalSpiral(ctx, ctx.R.leaf || ctx.R.petal, x, y, 3, c, 0.45, 0.4);
    const a = hash01(rec.uid) * 6.28;
    spikes(ctx, x, y, Math.cos(a), Math.sin(a), 0.18, 2, 0.16, ctx.col(DEEP), 0.18, DECOR);
  },

  onStatus(ev, tw, t, ctx) {
    const e = ctx.enemy(ev.uid);
    if (!e) return;
    if (ev.status === 'slow') {
      // a tendril curl at its feet for a moment (fixed slots, oldest reused)
      const curls = tw.data.curls;
      let best = curls[0];
      for (let i = 1; i < curls.length; i++) if (curls[i].t > best.t) best = curls[i];
      best.uid = ev.uid;
      best.t = 0;
    } else if (ev.status === 'poison') {
      const p = statusCue(ctx, ctx.R.bubble || ctx.R.glow, e.x, ctx.enemyH(e) + 0.15, e.z, 0.16, ctx.col('#9be36b'), 0.5);
      if (p) p.vy = 0.7;
    }
  },

  onOther(ev, tw, t, ctx) {
    if (ev.type === 'vine') {
      // the vine whip: a green line growing from her can to the walker, leaves bursting there
      const e = ctx.enemy(ev.targetUid);
      const h = hand(ctx, t);
      const ex = e ? e.x : ev.x;
      const ey = e ? e.z : ev.y;
      const eh = e ? ctx.enemyH(e) * 0.6 : 0.3;
      ctx.segs.add(h.x, h.h, h.y, ex, eh, ey, 0.11, ctx.col(LEAF), 0.28, 8 | 1);
      const s = ctx.segs.add(h.x, h.h - 0.05, h.y, ex, eh - 0.04, ey, 0.05, ctx.col(DEEP), 0.3, 8 | 4);
      if (s) s.k = 3;
      petalSpiral(ctx, ctx.R.leaf || ctx.R.petal, ex, ey, 5, ctx.col(LEAF), 0.5, 0.45);
      return false;
    }
    if (ev.type === 'thornBed') {
      // thorns burst up where the bed grows
      for (let i = 0; i < 3; i++) {
        const a = i * 2.09 + hash01(ev.uid) * 2;
        spikes(ctx, ev.x + Math.sin(a) * 0.18, ev.y + Math.cos(a) * 0.18, Math.cos(a), -Math.sin(a), 0.2, 2, 0.22, ctx.col(DEEP), 0.2, DECOR);
      }
      if (ctx.q.sparks) shardBurst(ctx, ev.x, 0.15, ev.y, 3, ctx.col(LEAF), 1.2);
      return false;
    }
    return false;
  },

  update(gdt, tw, t, ctx) {
    const d = tw.data;
    // the vine coils round the walker the sim holds (t.vineHold), for as long as it holds
    const hold = t.vineHold;
    if (hold) {
      const e = ctx.enemy(hold.uid);
      if (e) {
        const p1 = lookAt(tw.look, 1);
        const spin = ctx.reduceMotion ? 0.5 : ctx.time * 3.2;
        const top = Math.max(0.35, ctx.enemyH(e));
        coil(ctx, e.x, e.z, 0.26, 0.05, top, ctx.q.trails > 0 ? 6 : 4, spin, ctx.col(LEAF), 0.95, 0.05);
        if (p1 >= 5) coil(ctx, e.x, e.z, 0.32, 0.08, top * 0.8, 5, -spin + 1.5, ctx.col(DEEP), 0.85, 0.04);
        if (p1 >= 5 && ctx.q.familiars > 0) {
          for (let i = 0; i < 3; i++) {
            const a = spin * 1.3 + i * 2.09;
            ctx.quad(ctx.b.bbN, DECOR, e.x + Math.sin(a) * 0.36, 0.3 + 0.1 * i, e.z + Math.cos(a) * 0.36, 0.12, 0.12, ctx.R.leaf || ctx.R.petal, ctx.col(LEAF), 1, a);
          }
        }
        // Strangler Vine: thorn pricks while it squeezes
        if (p1 >= 3 && every(d, 'prickT', gdt, 0.5) && ctx.q.sparks) shardBurst(ctx, e.x, top * 0.6, e.z, 2, ctx.col('#d9f27a'), 1);
      }
    }
    // tendril curls (Creepers' slow)
    const curls = d.curls;
    for (let i = 0; i < curls.length; i++) {
      const c = curls[i];
      if (c.t >= 0.6) continue;
      c.t += gdt;
      const e = ctx.enemy(c.uid);
      if (!e) {
        c.t = 1;
        continue;
      }
      coil(ctx, e.x, e.z, 0.2, 0.04, 0.2, 4, c.t * 6 + c.uid, ctx.col(TENDRIL), 0.8 * (1 - c.t / 0.6), 0.03);
    }
  },
};
