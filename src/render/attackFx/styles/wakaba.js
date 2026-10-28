// Wakaba (buff thrower, src/sim/drinks.js). Signature "Water break!": a sky-blue sports bottle spins
// across a high arc with a water-blue trail, shedding a few drops, and bursts on the girl she picked:
// a crown of drops, short water spokes and a soft splash glow the size of the drink's splash. Every
// girl the splash reaches gets a rising droplet cue; a hydrated girl glints now and then while the
// drink lasts. Towel Snap: a white towel crescent at the walker and a blue slow cue.
//   P0 Energy Formula: T3 gold fizz in the splash; T5 a gold star pop on each girl it reaches
//   P1 Game Plan:      T3 Coach's Eye: the hydrated glint is a little eye-star; T5 star sparks in the trail
//   P2 First Aid:      T3 Towel Snap; T5 Championship Season: drops drift round her
// The bottle's 3D model (if the placed-object pass gives it one) can replace drawBottle below.
import { lookAt } from '../flair.js';
import { flash } from '../patterns/bursts.js';
import { spokes, statusCue, streak } from '../patterns/academy.js';
import { hand, every } from './util.js';
import { CORE, DECOR } from '../context.js';
import { GROUND, EASE_OUT } from '../quadPool.js';

const BLUE = '#59c1e8';
const WATER = '#bff0ff';
const CAP = '#ffffff';
const GOLD = '#ffd66b';
const TAU = Math.PI * 2;

/** Lob body: a sports bottle tumbling (blue body, white cap, a bright edge). */
function drawBottle(o, x, h, y, k, ctx) {
  const c = Math.cos(o.rot) * 0.11;
  const s = Math.sin(o.rot) * 0.11;
  // tumbling in the screen-ish plane: along world x and height
  ctx.line(ctx.b.bbN, CORE, x - c, h - s, y, x + c, h + s, y, 0.1, o.c, 1, ctx.R.white);
  ctx.line(ctx.b.bbN, CORE, x + c, h + s, y, x + c * 1.45, h + s * 1.45, y, 0.07, ctx.col(CAP), 1, ctx.R.white);
  ctx.line(ctx.b.bbA, CORE, x - c, h - s + 0.02, y, x + c, h + s + 0.02, y, 0.03, ctx.col(WATER), 0.9);
  // a drop shed now and then (game time)
  if (ctx.q.trails > 0 && Math.random() < ctx.gdt * 10) {
    const p = ctx.spr(ctx.b.bbN, DECOR, ctx.R.drop, x, h, y, 0.08, 0.06, 0.35, ctx.col(WATER), 0.9);
    if (p) {
      p.g = -7;
      p.asp = 0.7;
    }
  }
  if (o.b && ctx.q.sparks && Math.random() < ctx.gdt * 8) ctx.spr(ctx.b.bbA, DECOR, ctx.R.star, x, h, y, 0.12, 0.04, 0.3, ctx.col(GOLD), 1);
}

/** Lob landing: the splash on her pick and the cue on every girl it reaches. */
function landBottle(o, ctx) {
  const x = o.x1;
  const y = o.y1;
  const tw = o.tw;
  const lk = tw ? tw.look : null;
  const splash = Math.max(0.4, o.a || 0.8);
  const water = ctx.col(WATER);
  flash(ctx, x, 0.55, y, 0.6, water, 0.12);
  // the soft splash glow (no ring): a ground glow the size of the splash
  const g = ctx.spr(ctx.b.groundA, CORE, ctx.R.glow, x, 0.07, y, splash * 1.2, splash * 2.2, 0.4, ctx.col(BLUE), 0.55);
  if (g) g.flags = GROUND | EASE_OUT;
  spokes(ctx, x, y, ctx.q.trails > 0 ? 8 : 5, 0.15, Math.min(1.1, splash * 0.8), water, 0.18, Math.random(), 0.8, DECOR);
  // a crown of drops
  const n = ctx.n(8);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const p = ctx.spr(ctx.b.bbN, i < 3 ? CORE : DECOR, ctx.R.drop, x + Math.cos(a) * 0.1, 0.45, y + Math.sin(a) * 0.1, 0.11, 0.07, 0.5, water, 0.95);
    if (!p) continue;
    p.vx = Math.cos(a) * 1.2;
    p.vz = Math.sin(a) * 1.2;
    p.vy = 1.6;
    p.g = -8;
    p.asp = 0.7;
  }
  if (lk && lookAt(lk, 0) >= 3 && ctx.q.sparks) {
    for (let i = 0; i < 5; i++) {
      const p = ctx.spr(ctx.b.bbA, DECOR, ctx.R.bubble || ctx.R.glow, x + (Math.random() - 0.5) * splash, 0.15, y + (Math.random() - 0.5) * splash, 0.1, 0.06, 0.6, ctx.col(GOLD), 0.9);
      if (p) p.vy = 0.9 + Math.random() * 0.5;
    }
  }
  // every girl the splash reaches: a rising droplet (gold star pop at Championship Blend)
  const towers = ctx.sim.towers;
  const s2 = splash * splash;
  const gold = lk && lookAt(lk, 0) >= 5;
  let k = 0;
  for (let i = 0; i < towers.length && k < 6; i++) {
    const o2 = towers[i];
    if (o2.removed || o2.stats?.drink) continue;
    const dx = o2.x - x;
    const dy = o2.y - y;
    if (dx * dx + dy * dy > s2) continue;
    k++;
    statusCue(ctx, ctx.R.drop, o2.x, 0.95, o2.y, 0.2, water, 0.55);
    if (gold) ctx.spr(ctx.b.bbA, DECOR, ctx.R.star, o2.x, 1.05, o2.y, 0.1, 0.4, 0.3, ctx.col(GOLD), 1);
  }
}

export const wakaba = {
  id: 'wakaba',

  init() {
    return { glintT: 0, mistT: 0 };
  },

  onAttack(ev, tw, t, ctx) {
    if (ev.kind === 'drink') {
      // the toss itself is the 'drink' event (onOther); here only the release glint
      if (!ctx.cap('muzzle')) return;
      const h = hand(ctx, t);
      flash(ctx, h.x, h.h + 0.1, h.y, 0.28, ctx.col(WATER), 0.08);
      return;
    }
    if (ev.kind === 'towel') {
      // Towel Snap: a white crescent at the walker, the flick from her hand
      const e = ctx.enemy(ev.targetUid);
      if (!e) return;
      const h = hand(ctx, t);
      const eh = ctx.enemyH(e);
      ctx.segs.add(h.x, h.h + 0.1, h.y, e.x, eh, e.z, 0.08, ctx.col('#ffffff'), 0.1, 8 | 1);
      const p = ctx.spr(ctx.b.bbA, CORE, ctx.R.slash, e.x, eh, e.z, 0.5, 0.75, 0.14, ctx.col('#ffffff'), 1);
      if (p) {
        p.asp = 2.2;
        p.rot = ctx.screenAngle(e.x, eh, e.z, e.x - t.x, 0, e.z - t.y) + Math.PI / 2;
      }
    }
  },

  onOther(ev, tw, t, ctx) {
    if (ev.type !== 'drink' || ev.x == null) return false;
    const h = hand(ctx, t);
    const d = Math.hypot(ev.x - h.x, ev.y - h.y);
    const o = ctx.lobs.throw(h.x, h.h + 0.15, h.y, ev.x, 0.6, ev.y, 0.3 + 0.05 * d, 0.7 + 0.15 * d, 0.3, ctx.col(BLUE), 9, drawBottle, landBottle);
    if (o) {
      o.c2 = ctx.col(WATER);
      o.a = ev.splash || t.stats?.drink?.splash || 0.8;
      o.b = lookAt(tw.look, 1) >= 5 ? 1 : 0;
      o.tw = tw;
    }
    return false;
  },

  onStatus(ev, tw, t, ctx) {
    if (ev.status !== 'slow') return;
    const e = ctx.enemy(ev.uid);
    if (!e) return;
    // a blue chevron pointing down (slowed)
    const p = statusCue(ctx, ctx.R.chevron || ctx.R.glow, e.x, ctx.enemyH(e) + 0.25, e.z, 0.24, ctx.col('#8fe3ff'), 0.45);
    if (p) {
      p.rot = Math.PI;
      p.vy = -0.4;
    }
  },

  update(gdt, tw, t, ctx) {
    const d = tw.data;
    // a hydrated girl glints now and then (an eye-star with Coach's Eye)
    if (every(d, 'glintT', gdt, 0.9)) {
      const towers = ctx.sim.towers;
      const eye = lookAt(tw.look, 1) >= 3;
      const c = ctx.col(eye ? '#fff3b0' : WATER);
      let k = 0;
      for (let i = 0; i < towers.length && k < 8; i++) {
        const o = towers[i];
        if (o.hydrated?.src !== t.uid) continue;
        k++;
        const p = ctx.spr(ctx.b.bbA, DECOR, eye ? ctx.R.star : ctx.R.drop, o.x + 0.12, 0.85, o.y, 0.12, 0.08, 0.5, c, 0.9);
        if (p) p.vy = 0.35;
      }
    }
    // Championship Season: drops drift round her
    if (lookAt(tw.look, 2) >= 5 && !ctx.reduceMotion && every(d, 'mistT', gdt, 0.35)) {
      const a = Math.random() * TAU;
      const r = 0.4 + Math.random() * 0.5;
      const p = streak(ctx, DECOR, t.x + Math.sin(a) * r, 0.25, t.y + Math.cos(a) * r, Math.cos(a), 0, -Math.sin(a), 0.18, 0.05, 0.6, ctx.col(WATER), 0.7);
      if (p) p.vy = 0.3;
    }
  },
};
