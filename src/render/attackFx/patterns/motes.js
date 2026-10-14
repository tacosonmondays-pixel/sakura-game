// Mote swarms (Hotaru's fireflies, Hikari's light motes): small lights idling around a girl
// that streak to the enemies her attack really hit (attributed victims only), burst there and
// respawn near her a little later. Fixed arrays per swarm, no allocation per frame.
import { MOTE, CORE } from '../context.js';

const IDLE = 0;
const STREAK = 1;
const WAIT = 2;

export class Swarm {
  constructor(max = 16) {
    this.max = max;
    this.n = 0;
    this.x = new Float32Array(max);
    this.y = new Float32Array(max);
    this.h = new Float32Array(max);
    this.ph = new Float32Array(max);
    this.r = new Float32Array(max);
    this.st = new Uint8Array(max);
    this.t = new Float32Array(max);
    this.fx = new Float32Array(max); // streak start
    this.fy = new Float32Array(max);
    this.fh = new Float32Array(max);
    this.uid = new Float64Array(max);
    this.tx = new Float32Array(max); // last known target point
    this.ty = new Float32Array(max);
    this.th = new Float32Array(max);
    this.seeded = false;
  }

  /** Number of motes (≤ max). */
  setCount(n) {
    n = Math.max(0, Math.min(this.max, n | 0));
    for (let i = this.n; i < n; i++) {
      this.st[i] = IDLE;
      this.ph[i] = (i * 2.39996) % (Math.PI * 2);
      this.r[i] = 0.4 + ((i * 0.618) % 1) * 0.5;
      this.seeded = false;
    }
    this.n = n;
  }

  /** Index of an idle mote (closest to the target) or -1. */
  _idle(ex, ey) {
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < this.n; i++) {
      if (this.st[i] !== IDLE) continue;
      const d = (this.x[i] - ex) ** 2 + (this.y[i] - ey) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  /** Sends one idle mote to enemy `uid` (a real victim); flight `dur` game seconds. */
  launch(ctx, uid, dur = 0.06) {
    const e = ctx.enemy(uid);
    if (!e) return false;
    const i = this._idle(e.x, e.z);
    if (i < 0) return false;
    this.st[i] = STREAK;
    this.t[i] = dur;
    this.fx[i] = this.x[i];
    this.fy[i] = this.y[i];
    this.fh[i] = this.h[i];
    this.uid[i] = uid;
    this.tx[i] = e.x;
    this.ty[i] = e.z;
    this.th[i] = ctx.enemyH(e);
    this.dur = dur;
    return true;
  }

  /**
   * Moves the swarm: idle motes wander on slow loops inside the annulus [rMin, rMax]·R
   * around (cx, cy); streaking motes fly to their victim and call onArrive(ctx, i, x, h, y).
   */
  update(ctx, gdt, cx, cy, R, hBase, onArrive, arg) {
    const time = ctx.time;
    for (let i = 0; i < this.n; i++) {
      const st = this.st[i];
      if (st === IDLE) {
        const a = this.ph[i] + time * (0.35 + 0.1 * (i % 3));
        const rr = R * (this.r[i] + 0.08 * Math.sin(time * 0.9 + i * 1.3));
        const gx = cx + Math.sin(a) * rr;
        const gy = cy + Math.cos(a) * rr;
        const gh = hBase + 0.18 * Math.sin(time * 1.3 + i * 2.1);
        if (!this.seeded) {
          this.x[i] = gx;
          this.y[i] = gy;
          this.h[i] = gh;
        } else {
          const k = 1 - Math.exp(-3 * gdt);
          this.x[i] += (gx - this.x[i]) * k;
          this.y[i] += (gy - this.y[i]) * k;
          this.h[i] += (gh - this.h[i]) * k;
        }
      } else if (st === STREAK) {
        const e = ctx.enemy(this.uid[i]);
        if (e) {
          this.tx[i] = e.x;
          this.ty[i] = e.z;
          this.th[i] = ctx.enemyH(e);
        }
        this.t[i] -= gdt;
        const k = 1 - Math.max(0, this.t[i]) / (this.dur || 0.06);
        this.x[i] = this.fx[i] + (this.tx[i] - this.fx[i]) * k;
        this.y[i] = this.fy[i] + (this.ty[i] - this.fy[i]) * k;
        this.h[i] = this.fh[i] + (this.th[i] - this.fh[i]) * k;
        if (this.t[i] <= 0) {
          if (onArrive) onArrive(ctx, i, this.tx[i], this.th[i], this.ty[i], arg);
          this.st[i] = WAIT;
          this.t[i] = 0.6;
        }
      } else {
        this.t[i] -= gdt;
        if (this.t[i] <= 0) {
          // respawn next to her
          this.st[i] = IDLE;
          this.x[i] = cx + Math.sin(this.ph[i]) * 0.2;
          this.y[i] = cy + Math.cos(this.ph[i]) * 0.2;
          this.h[i] = hBase;
        }
      }
    }
    this.seeded = true;
  }

  /** Draws idle motes (shed class MOTE) and streaking ones (CORE: they show real hits). */
  draw(ctx, uv, c, size, blink = true, glowC = null) {
    const B = ctx.b.bbA;
    const time = ctx.time;
    for (let i = 0; i < this.n; i++) {
      const st = this.st[i];
      if (st === WAIT) continue;
      if (st === STREAK) {
        ctx.quad(B, CORE, this.x[i], this.h[i], this.y[i], size * 1.4, size * 1.4, uv, c, 1);
        ctx.line(B, CORE, this.fx[i], this.fh[i], this.fy[i], this.x[i], this.h[i], this.y[i], size * 0.6, c, 0.5);
        continue;
      }
      const b = blink ? 0.45 + 0.55 * Math.max(0, Math.sin(time * 3.1 + i * 1.7)) : 1;
      if (!ctx.quad(B, MOTE, this.x[i], this.h[i], this.y[i], size, size, uv, c, b)) continue;
      if (glowC) ctx.quad(B, MOTE, this.x[i], this.h[i], this.y[i], size * 2.4, size * 2.4, ctx.R.glow, glowC, 0.25 * b);
    }
  }
}
