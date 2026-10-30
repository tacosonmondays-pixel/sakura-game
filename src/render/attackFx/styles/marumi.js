// Marumi (rolling bomb balls, src/sim/balls.js). Signature "STRIKE!": every ball she rolls spins (a
// bright seam turning with the distance it rolls), its fuse glints and it kicks up dust behind it.
// Spin Shot makes each ricochet readable, on every path that bounces:
//   - a squash puff at each bounce point: a flat wide flash, a skid across the hop and two dust puffs;
//   - the hop itself: the ball leaves the ground and flies an arc to its next walker (its height a
//     parabola over the leg's progress, the sim's straight flight underneath), squashed for a moment
//     after the bounce, spinning, with a warm arc trail back to the bounce point;
//   - the next walker is called out by sparks flung its way.
// Her lob at flyers (every path) spins on its arc with a short warm trail and lands with the same puff.
//   P0 Heavy Ball: T3+ the stun spins three stars round the walker's head; T4+ the rolling ball glows
//                  orange (Wrecking Ball)
//   P1 Lane Master: T3+ Split Pins fly out of the blast as little white pins, tumbling
//   P2 Spin Shot:  T3+ a pink spin swirl under the rolling ball; T5 Glow Bowl's finale is a firework
// The rolling ball on the road is src/render/actors.js; while this layer draws the hop (ballArcs), the
// actors pass draws a flying ball as its ground shadow only.
import { lookAt } from '../flair.js';
import { sparks, flash, chrysanthemum } from '../patterns/bursts.js';
import { arcHeight } from '../patterns/lobs.js';
import { squashPuff, spokes, legProgress, squash, groundRot } from '../patterns/academy.js';
import { pointAt } from '../../../sim/path.js';
import { BALLS_PER_GIRL } from '../../../sim/constants.js';
import { hand, every } from './util.js';
import { CORE, DECOR } from '../context.js';
import { GROUND } from '../quadPool.js';

const SPARK = '#ffc46b';
const PIN = '#f6efe0';
const ORANGE = '#f28a3c';
const PINK = '#ff7fb5';
const DUST = '#c9b99a';
const BALL = '#2f3550';
const RIM = '#ffd08a';
const LEGS = BALLS_PER_GIRL + 2;
const STUNS = 4;
const PT = { x: 0, y: 0, facing: 0, seg: 0 };

/** Arc of a hop: apex height for a leg of length len (tiles). */
export function hopApex(len) {
  return Math.min(0.75, 0.22 + 0.16 * len);
}

/** A few sparks flung from (x, y) toward (tx, ty): the way the ball goes next. */
function toward(ctx, x, y, tx, ty, c) {
  const dx = tx - x;
  const dy = ty - y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-6) return;
  const k = ctx.n(4);
  for (let i = 0; i < k; i++) {
    const s = 2.4 + i * 0.5;
    const p = ctx.spr(ctx.b.bbA, DECOR, ctx.R.glow, x, 0.22, y, 0.1, 0.03, 0.22, c, 1);
    if (!p) continue;
    p.vx = (dx / d) * s + (i - 1.5) * 0.25 * (-dy / d);
    p.vz = (dy / d) * s + (i - 1.5) * 0.25 * (dx / d);
    p.vy = 0.5;
    p.g = -4;
    p.drag = 3;
  }
}

/** The leg slot of ball `uid` (or a free / the oldest one when `make`). */
function legOf(d, uid, make) {
  const legs = d.legs;
  let free = null;
  for (let i = 0; i < LEGS; i++) {
    const l = legs[i];
    if (l.uid === uid) return l;
    if (!free && l.uid < 0) free = l;
  }
  if (!make) return null;
  if (!free) {
    free = legs[0];
    for (let i = 1; i < LEGS; i++) if (legs[i].t > free.t) free = legs[i];
  }
  free.uid = uid;
  free.t = 0;
  return free;
}

/** This frame: the ball at (x, h, y), squashed by sq, its seam at angle a, a warm rim. */
function drawBall(ctx, x, h, y, sq, a, hot) {
  const s = 0.34;
  ctx.quad(ctx.b.bbA, CORE, x, h, y, s * 1.9 * sq, s * 1.9 / sq, ctx.R.glow, ctx.col(hot ? ORANGE : RIM), 0.35);
  ctx.quad(ctx.b.bbN, CORE, x, h, y, s * sq, s / sq, ctx.R.disc, ctx.col(BALL), 1);
  // the seam: a bright line across the ball, turning
  const c = Math.cos(a) * s * 0.45 * sq;
  const sn = Math.sin(a) * s * 0.45 / sq;
  ctx.line(ctx.b.bbA, CORE, x - c, h - sn, y, x + c, h + sn, y, 0.03, ctx.col(RIM), 1);
  ctx.quad(ctx.b.bbA, DECOR, x + 0.05, h + s * 0.45 / sq, y, 0.1, 0.1, ctx.R.star, ctx.col('#fff1c8'), 1, a);
}

export const marumi = {
  id: 'marumi',

  init() {
    const legs = [];
    for (let i = 0; i < LEGS; i++) legs.push({ uid: -1, sx: 0, sy: 0, t: 0, seen: 0 });
    const stuns = [];
    for (let i = 0; i < STUNS; i++) stuns.push({ uid: -1, t: 1 });
    return { legs, stuns, dustT: 0, frame: 0 };
  },

  onAttack(ev, tw, t, ctx) {
    if (ev.kind !== 'roll' && ev.kind !== 'lob') return;
    const h = hand(ctx, t);
    if (ev.kind === 'lob') {
      if (ctx.cap('muzzle')) flash(ctx, h.x, h.h + 0.1, h.y, 0.3, ctx.col(ORANGE), 0.08);
      return;
    }
    sparks(ctx, h.x, h.h, h.y, 3, ctx.col(SPARK), 1);
  },

  view(p, rec, _t, v, ctx) {
    if (p.kind !== 'shell') return;
    // the lob: spinning, with a short warm trail of the last drawn points
    v.roll = ctx.reduceMotion ? 0 : ctx.time * 14 + rec.uid;
    let tr = rec.mTrail;
    if (!tr || tr.length !== 9) tr = rec.mTrail = new Float32Array(9);
    if (rec.mUid !== rec.uid) {
      rec.mUid = rec.uid;
      for (let i = 0; i < 9; i += 3) {
        tr[i] = v.x;
        tr[i + 1] = v.z;
        tr[i + 2] = v.y;
      }
    }
    if (ctx.q.trails > 0) {
      const c = ctx.col(SPARK);
      let px = v.x;
      let ph = v.z;
      let py = v.y;
      for (let i = 0; i < 9; i += 3) {
        ctx.line(ctx.b.bbA, i ? DECOR : CORE, px, ph, py, tr[i], tr[i + 1], tr[i + 2], 0.07 - i * 0.006, c, 0.75 - i * 0.07);
        px = tr[i];
        ph = tr[i + 1];
        py = tr[i + 2];
      }
    }
    // shift the history every other frame (≈ 30 Hz)
    if ((ctx.frame & 1) === 0) {
      for (let i = 8; i >= 3; i--) tr[i] = tr[i - 3];
      tr[0] = v.x;
      tr[1] = v.z;
      tr[2] = v.y;
    }
  },

  onImpact(rec, x, y, crit, radius, ctx) {
    if (rec.kind !== 'shell') return;
    squashPuff(ctx, x, y, 1, 0, ctx.col(SPARK), ctx.col(DUST), 0.9, false);
  },

  onStatus(ev, tw, t, ctx) {
    if (ev.status !== 'stun') return;
    const stuns = tw.data.stuns;
    let best = stuns[0];
    for (let i = 1; i < STUNS; i++) if (stuns[i].t > best.t) best = stuns[i];
    best.uid = ev.uid;
    best.t = 0;
  },

  onOther(ev, tw, t, ctx) {
    if (ev.type === 'pins') {
      // Split Pins: little white pins tumbling out of the blast
      const n = Math.min(9, ctx.n(ev.n || 0));
      for (let i = 0; i < n; i++) {
        const a = (i / Math.max(1, n)) * 6.283 + ctx.rand() * 0.5;
        const p = ctx.spr(ctx.b.bbA, i < 3 ? CORE : DECOR, ctx.R.beam, ev.x, 0.3, ev.y, 0.07, 0.07, 0.55, ctx.col(PIN), 1);
        if (!p) continue;
        p.asp = 3;
        p.vx = Math.sin(a) * 1.8;
        p.vz = Math.cos(a) * 1.8;
        p.vy = 1.8 + ctx.rand();
        p.g = -7;
        p.vrot = ctx.reduceMotion ? 0 : 12;
      }
      return false;
    }
    if (ev.type !== 'ballPop') return false;
    const lk = tw.look;
    if (ev.fin) {
      // Glow Bowl finale: a firework of pin-white, orange and spark stars and two bursts of spokes
      chrysanthemum(ctx, ev.x, 0.35, ev.y, 12, [ctx.col(PIN), ctx.col(ORANGE), ctx.col(SPARK)], 0.18, 2.8);
      spokes(ctx, ev.x, ev.y, 12, 0.2, 1.5, ctx.col(SPARK), 0.3, 0, 0.95, CORE, false);
      spokes(ctx, ev.x, ev.y, 8, 0.15, 0.95, ctx.col(PIN), 0.26, 0.4, 0.9, DECOR, false);
      return false;
    }
    flash(ctx, ev.x, 0.25, ev.y, 0.55, ctx.col(SPARK), 0.1);
    if (ev.tx == null) return false;
    // a bounce: the squash puff across the hop, sparks flung toward the next walker, and the leg
    // starts here (update draws the hop)
    const dx = ev.tx - ev.x;
    const dy = ev.ty - ev.y;
    const d = Math.hypot(dx, dy) || 1;
    squashPuff(ctx, ev.x, ev.y, dx / d, dy / d, ctx.col(lookAt(lk, 2) >= 3 ? PINK : SPARK), ctx.col(DUST), 1, false);
    toward(ctx, ev.x, ev.y, ev.tx, ev.ty, ctx.col(SPARK));
    const l = legOf(tw.data, ev.uid, true);
    l.sx = ev.x;
    l.sy = ev.y;
    l.t = 0;
    l.seen = tw.data.frame + 1; // this frame's update (it counts the frame first)
    return false;
  },

  update(gdt, tw, t, ctx) {
    const d = tw.data;
    d.frame++;
    const lk = tw.look;
    const balls = t.balls;
    const hot = lookAt(lk, 0) >= 4;
    const dust = ctx.q.trails > 0 && every(d, 'dustT', gdt, 0.12);
    if (balls) {
      for (let i = 0; i < balls.length; i++) {
        const bl = balls[i];
        const f = bl.fly;
        if (f) {
          // the hop: an arc from the bounce point to its walker over the sim's straight flight
          let l = legOf(d, bl.uid, false);
          if (!l) {
            // a hop already under way when we first see it: its leg starts where the ball is
            l = legOf(d, bl.uid, true);
            l.sx = f.x;
            l.sy = f.y;
          }
          l.seen = d.frame;
          l.t += gdt;
          let tx = f.x;
          let ty = f.y;
          const list = ctx.sim.enemies;
          for (let q = 0; q < list.length; q++) {
            if (list[q].uid === f.uid) {
              tx = list[q].x;
              ty = list[q].y;
              break;
            }
          }
          const k = legProgress(l.sx, l.sy, f.x, f.y, tx, ty);
          const len = Math.hypot(tx - l.sx, ty - l.sy);
          const apex = hopApex(len);
          const h = arcHeight(k, 0.2, 0.2, apex);
          // the trail: the same arc from the bounce point to the ball
          if (ctx.q.trails > 0 && k > 0.02) {
            const steps = ctx.reduceMotion ? 3 : 6;
            let px = f.x;
            let py = f.y;
            let ph = h;
            const c = ctx.col(lookAt(lk, 2) >= 3 ? PINK : SPARK);
            for (let j = 1; j <= steps; j++) {
              const kj = k * (1 - j / steps);
              const r = kj / k;
              const qx = l.sx + (f.x - l.sx) * r;
              const qy = l.sy + (f.y - l.sy) * r;
              const qh = arcHeight(kj, 0.2, 0.2, apex);
              ctx.line(ctx.b.bbA, j === 1 ? CORE : DECOR, px, ph, py, qx, qh, qy, 0.13 * (1 - j / (steps + 1)) + 0.03, c, 0.85 * (1 - j / (steps + 1)));
              px = qx;
              py = qy;
              ph = qh;
            }
          }
          const spin = ctx.reduceMotion ? 0.6 : ctx.time * 18 + bl.uid;
          drawBall(ctx, f.x, h, f.y, squash(l.t, 0.12), spin, hot);
          continue;
        }
        // rolling: the ball on the road, its seam turning with the distance rolled, the fuse glinting
        const path = ctx.sim.pathData[bl.pathIndex];
        if (!path) continue;
        const p = pointAt(path, bl.dist, PT);
        const dir = path.dirs[p.seg];
        const ux = dir ? -dir[0] : 0;
        const uy = dir ? -dir[1] : 1;
        const c = ctx.col(hot ? ORANGE : RIM);
        drawBall(ctx, p.x, 0.2, p.y, 1, ctx.reduceMotion ? 0.6 : -bl.dist * 5.5, hot);
        if (hot) ctx.quad(ctx.b.groundA, DECOR, p.x, 0.075, p.y, 0.7, 0.7, ctx.R.glow, ctx.col(ORANGE), 0.5);
        if (lookAt(lk, 2) >= 3 && ctx.R.swirl) ctx.quadRGB(ctx.b.groundA, DECOR, p.x, 0.074, p.y, 0.6, 0.6, ctx.R.swirl, 1, 0.5, 0.71, 0.55, ctx.reduceMotion ? 0 : -ctx.time * 9);
        if (dust) {
          const q = ctx.spr(ctx.b.bbN, DECOR, ctx.R.smoke || ctx.R.soft, p.x - ux * 0.25, 0.1, p.y - uy * 0.25, 0.14, 0.32, 0.4, ctx.col(DUST), 0.5);
          if (q) {
            q.vy = 0.25;
            q.vx = -ux * 0.4;
            q.vz = -uy * 0.4;
          }
          const s = ctx.spr(ctx.b.groundN, DECOR, ctx.R.beam, p.x - ux * 0.3, 0.07, p.y - uy * 0.3, 0.08, 0.08, 0.25, c, 0.4);
          if (s) {
            s.asp = 4;
            s.rot = groundRot(ux, uy);
            s.flags = GROUND;
          }
        }
      }
    }
    // free the legs of balls that stopped hopping
    for (let i = 0; i < LEGS; i++) {
      const l = d.legs[i];
      if (l.uid >= 0 && l.seen !== d.frame) {
        l.uid = -1;
        l.t = 0;
      }
    }
    // Concussion stars round the stunned walker's head
    const stuns = d.stuns;
    for (let i = 0; i < STUNS; i++) {
      const s = stuns[i];
      if (s.t >= 0.6) continue;
      s.t += gdt;
      const e = ctx.enemy(s.uid);
      if (!e) {
        s.t = 1;
        continue;
      }
      const h = ctx.enemyH(e) + 0.3;
      for (let j = 0; j < 3; j++) {
        const a = (ctx.reduceMotion ? 0 : s.t * 9) + j * 2.09;
        ctx.quad(ctx.b.bbA, DECOR, e.x + Math.sin(a) * 0.2, h, e.z + Math.cos(a) * 0.2, 0.12, 0.12, ctx.R.star, ctx.col('#ffe066'), 1 - s.t / 0.6, a);
      }
    }
  },
};
