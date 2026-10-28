// Pooled ballistic lobs drawn by the style that threw them (the academy girls: Azami's folded strip,
// Wakaba's bottle). Unlike Tosses (one painted sprite, a seal landing) a lob carries a draw function
// and a landing function (module-level functions of the style, so a throw allocates nothing), an
// analytic arc trail (no position history: the trail is the same parabola a few steps back) and a
// ground shadow. Game time; a tossed trap's mark stays hidden until its lob lands (hidden()).
import { CORE, DECOR } from '../context.js';

/** Height of a lob at progress k (0..1): straight from h0 to h1 plus a parabola of `apex`. */
export function arcHeight(k, h0, h1, apex) {
  const c = k < 0 ? 0 : k > 1 ? 1 : k;
  return h0 + (h1 - h0) * c + apex * 4 * c * (1 - c);
}

/** Trail steps (progress offsets) and how many of them each quality draws. */
export const TRAIL_STEP = 0.07;
export function trailSteps(q, reduceMotion) {
  const n = q?.trails ?? 1;
  if (n <= 0) return 0;
  return reduceMotion ? 2 : n >= 2 ? 5 : 3;
}

export class Lobs {
  constructor(ctx, cap = 24) {
    this.ctx = ctx;
    this.cap = cap;
    this.live = [];
    this.free = [];
    for (let i = 0; i < cap; i++) this.free.push(this._blank());
    this.hiddenTraps = new Map();
  }

  _blank() {
    return {
      x0: 0, h0: 0, y0: 0, x1: 0, h1: 0, y1: 0, dur: 0.3, apex: 0.4, t: 0, delay: 0, size: 0.3, c: null, c2: null,
      spin: 0, rot: 0, trap: -1, draw: null, land: null, trail: true, a: 0, b: 0, tw: null,
    };
  }

  get count() {
    return this.live.length;
  }

  /**
   * Throws a lob from (x0, h0, y0) to (x1, h1, y1) over `dur` game seconds.
   * draw(o, x, h, y, k, ctx) draws the body; land(o, ctx) runs once at the end (both may be null).
   * @returns {object|null} the record (set .delay, .c2, .a, .b, .tw, .trail as needed) or null when full
   */
  throw(x0, h0, y0, x1, h1, y1, dur, apex, size, c, spin, draw, land, trapUid = -1) {
    const o = this.free.pop();
    if (!o) return null;
    o.x0 = x0;
    o.h0 = h0;
    o.y0 = y0;
    o.x1 = x1;
    o.h1 = h1;
    o.y1 = y1;
    o.dur = Math.max(0.05, dur);
    o.apex = apex;
    o.size = size;
    o.c = c;
    o.c2 = c;
    o.spin = this.ctx.reduceMotion ? spin * 0.25 : spin;
    o.rot = 0;
    o.t = 0;
    o.delay = 0;
    o.trap = trapUid;
    o.draw = draw;
    o.land = land;
    o.trail = true;
    o.a = 0;
    o.b = 0;
    o.tw = null;
    this.live.push(o);
    if (trapUid >= 0) this.hiddenTraps.set(trapUid, (this.hiddenTraps.get(trapUid) || 0) + 1);
    return o;
  }

  hidden(trapUid) {
    return this.hiddenTraps.has(trapUid);
  }

  update(gdt) {
    const ctx = this.ctx;
    const live = this.live;
    if (!live.length) return;
    const steps = trailSteps(ctx.q, ctx.reduceMotion);
    let n = 0;
    for (let i = 0; i < live.length; i++) {
      const o = live[i];
      if (o.delay > 0) {
        o.delay -= gdt;
        live[n++] = o;
        continue;
      }
      o.t += gdt;
      o.rot += o.spin * gdt;
      const k = Math.min(1, o.t / o.dur);
      if (k >= 1) {
        this._release(o);
        if (o.land) o.land(o, ctx);
        o.draw = null;
        o.land = null;
        o.tw = null;
        this.free.push(o);
        continue;
      }
      live[n++] = o;
      const x = o.x0 + (o.x1 - o.x0) * k;
      const y = o.y0 + (o.y1 - o.y0) * k;
      const h = arcHeight(k, o.h0, o.h1, o.apex);
      // trail: the same parabola a few steps back, fading (thin additive line pieces)
      if (o.trail && steps > 0) {
        let px = x;
        let py = y;
        let ph = h;
        for (let j = 1; j <= steps; j++) {
          const kj = k - j * TRAIL_STEP;
          if (kj <= 0) break;
          const qx = o.x0 + (o.x1 - o.x0) * kj;
          const qy = o.y0 + (o.y1 - o.y0) * kj;
          const qh = arcHeight(kj, o.h0, o.h1, o.apex);
          ctx.line(ctx.b.bbA, j === 1 ? CORE : DECOR, px, ph, py, qx, qh, qy, 0.1 * (1 - j / (steps + 1)) + 0.025, o.c2, 0.8 * (1 - j / (steps + 1)));
          px = qx;
          py = qy;
          ph = qh;
        }
      }
      if (o.draw) o.draw(o, x, h, y, k, ctx);
      const ss = 0.24 * (1 - Math.min(0.6, h * 0.35));
      ctx.quadRGB(ctx.b.groundN, DECOR, x, 0.06, y, ss, ss, ctx.R.shadow, 0.05, 0.05, 0.1, 0.3);
    }
    live.length = n;
  }

  _release(o) {
    if (o.trap < 0) return;
    const c = (this.hiddenTraps.get(o.trap) || 1) - 1;
    if (c <= 0) this.hiddenTraps.delete(o.trap);
    else this.hiddenTraps.set(o.trap, c);
    o.trap = -1;
  }

  clear() {
    for (const o of this.live) {
      o.draw = null;
      o.land = null;
      o.tw = null;
      this.free.push(o);
    }
    this.live.length = 0;
    this.hiddenTraps.clear();
  }
}
