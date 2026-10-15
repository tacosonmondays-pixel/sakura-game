// Ballistic sprite tosses (Suzu's seals). A tossed trap's rune stays hidden until the seal
// lands on the trap's real sim position (trapHidden), then a little bounce + ring.
import { CORE } from '../context.js';

export const LAND_SEAL = 1;

export class Tosses {
  constructor(ctx, cap = 32) {
    this.ctx = ctx;
    this.live = [];
    this.free = [];
    for (let i = 0; i < cap; i++) this.free.push({});
    this.hiddenTraps = new Map(); // trap uid → open tosses
  }

  /**
   * Throws a sprite from (x0, h0, y0) to the ground point (x1, y1).
   * @returns {object|null}
   */
  throw(uv, x0, h0, y0, x1, y1, dur, apex, size, c, spin = 12, trapUid = -1, land = LAND_SEAL, landColor = null) {
    const o = this.free.pop();
    if (!o) return null;
    o.uv = uv;
    o.x0 = x0;
    o.h0 = h0;
    o.y0 = y0;
    o.x1 = x1;
    o.y1 = y1;
    o.dur = Math.max(0.05, dur);
    o.apex = apex;
    o.size = size;
    o.c = c;
    o.lc = landColor || c;
    o.spin = spin;
    o.t = 0;
    o.trap = trapUid;
    o.land = land;
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
    let n = 0;
    for (let i = 0; i < live.length; i++) {
      const o = live[i];
      o.t += gdt;
      const k = Math.min(1, o.t / o.dur);
      const x = o.x0 + (o.x1 - o.x0) * k;
      const y = o.y0 + (o.y1 - o.y0) * k;
      const h = o.h0 * (1 - k) + 0.08 + o.apex * 4 * k * (1 - k);
      if (k >= 1) {
        this._land(o);
        this.free.push(o);
        continue;
      }
      live[n++] = o;
      ctx.quad(ctx.b.bbN, CORE, x, h, y, o.size * 0.5, o.size, o.uv, ctx.col('#ffffff'), 1, o.t * o.spin);
      const ss = 0.22 * (1 - Math.min(0.6, h * 0.4));
      ctx.quadRGB(ctx.b.groundN, CORE, x, 0.06, y, ss, ss, ctx.R.shadow, 0.05, 0.05, 0.1, 0.3);
    }
    live.length = n;
  }

  _land(o) {
    const ctx = this.ctx;
    if (o.trap >= 0) {
      const c = (this.hiddenTraps.get(o.trap) || 1) - 1;
      if (c <= 0) this.hiddenTraps.delete(o.trap);
      else this.hiddenTraps.set(o.trap, c);
    }
    if (o.land === LAND_SEAL) {
      // little bounce of the seal into the ground + a soft ring
      const p = ctx.spr(ctx.b.bbN, CORE, o.uv, o.x1, 0.12, o.y1, o.size, o.size * 0.7, 0.18, ctx.col('#ffffff'), 1);
      if (p) {
        p.vy = 0.6;
        p.g = -9;
        p.asp = 0.5;
      }
      const r = ctx.spr(ctx.b.groundA, CORE, ctx.R.ringSoft, o.x1, 0.07, o.y1, 0.15, 0.8, 0.3, o.lc, 0.9);
      if (r) r.flags = 8;
    }
  }

  clear() {
    for (const o of this.live) this.free.push(o);
    this.live.length = 0;
    this.hiddenTraps.clear();
  }
}
