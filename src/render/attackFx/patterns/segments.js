// Pooled line segments drawn as camera-facing quads: tracers, beams, chain hops, sight lines,
// ropes, thrust lines. Lives in game time. One or two quads per segment (zigzag: k each).
import * as THREE from 'three';
import { CORE } from '../context.js';

export const SEG_CORE = 1; // white inner line
export const SEG_FLICKER = 2;
export const SEG_ZIGZAG = 4; // k jittered sub-segments, re-jittered every frame
export const SEG_GROW = 8; // the end travels from a to b over the first 30% of life
export const SEG_FOLLOW = 16; // the end tracks enemy `followUid` every frame
export const SEG_NORMAL = 32; // normal blending (ropes, sight lines) instead of additive
export const SEG_HOLD = 64; // full alpha until the last 40% of life
export const SEG_SLIDE = 128; // the end slides from (sx, sh, sy) to b over the first 25% of life

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

export class Segments {
  constructor(ctx, cap = 96) {
    this.ctx = ctx;
    this.live = [];
    this.free = [];
    for (let i = 0; i < cap; i++) {
      this.free.push({ ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, sx: 0, sy: 0, sz: 0, w: 0, r: 1, g: 1, b: 1, a: 1, life: 0, t: 0, delay: 0, flags: 0, followUid: -1, k: 3, cls: CORE });
    }
  }

  get count() {
    return this.live.length;
  }

  /**
   * Adds a segment between world points (ground x, height, ground y for each end).
   * @returns {object|null} the record (set .delay / .cls / .k if needed)
   */
  add(ax, ah, ay, bx, bh, by, w, c, life, flags = 0, followUid = -1, a = 1) {
    const s = this.free.pop();
    if (!s) return null;
    s.ax = ax;
    s.ay = ah;
    s.az = ay;
    s.bx = bx;
    s.by = bh;
    s.bz = by;
    s.w = w;
    s.r = c.r;
    s.g = c.g;
    s.b = c.b;
    s.a = a;
    s.life = Math.max(1e-3, life);
    s.t = 0;
    s.delay = 0;
    s.flags = flags;
    s.followUid = followUid;
    s.k = 3;
    s.cls = CORE;
    this.live.push(s);
    return s;
  }

  update(gdt) {
    const ctx = this.ctx;
    const live = this.live;
    if (!live.length) return;
    const view = ctx.camera.matrixWorldInverse;
    let n = 0;
    for (let i = 0; i < live.length; i++) {
      const s = live[i];
      if (s.delay > 0) {
        s.delay -= gdt;
        live[n++] = s;
        continue;
      }
      s.t += gdt;
      if (s.t >= s.life) {
        this.free.push(s);
        continue;
      }
      live[n++] = s;
      if (s.flags & SEG_FOLLOW) {
        const e = ctx.enemy(s.followUid);
        if (e) {
          s.bx = e.x;
          s.by = ctx.enemyH(e);
          s.bz = e.z;
        }
      }
      const k = s.t / s.life;
      let fade = s.flags & SEG_HOLD ? (k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4) : 1 - k;
      if (s.flags & SEG_FLICKER) fade *= 0.6 + 0.4 * Math.sin(s.t * 90 + i);
      let bx = s.bx;
      let by = s.by;
      let bz = s.bz;
      if (s.flags & SEG_GROW && k < 0.3) {
        const g = k / 0.3;
        bx = s.ax + (s.bx - s.ax) * g;
        by = s.ay + (s.by - s.ay) * g;
        bz = s.az + (s.bz - s.az) * g;
      } else if (s.flags & SEG_SLIDE && k < 0.25) {
        const g = k / 0.25;
        bx = s.sx + (s.bx - s.sx) * g;
        by = s.sy + (s.by - s.sy) * g;
        bz = s.sz + (s.bz - s.sz) * g;
      }
      const B = s.flags & SEG_NORMAL ? ctx.b.bbN : ctx.b.bbA;
      const w = s.w * (0.6 + 0.4 * (1 - k));
      if (s.flags & SEG_ZIGZAG && s.k > 1) {
        const parts = Math.max(1, Math.min(8, s.k));
        let px = s.ax;
        let py = s.ay;
        let pz = s.az;
        const jit = 0.22 * Math.min(1, Math.hypot(bx - s.ax, bz - s.az) / 1.5 + 0.3);
        for (let p = 1; p <= parts; p++) {
          const t = p / parts;
          const j = p === parts ? 0 : jit;
          const nx = s.ax + (bx - s.ax) * t + (ctx.rand() - 0.5) * j;
          const ny = s.ay + (by - s.ay) * t + (ctx.rand() - 0.5) * j;
          const nz = s.az + (bz - s.az) * t + (ctx.rand() - 0.5) * j;
          this._quad(B, s, view, px, py, pz, nx, ny, nz, w, fade);
          px = nx;
          py = ny;
          pz = nz;
        }
      } else {
        this._quad(B, s, view, s.ax, s.ay, s.az, bx, by, bz, w, fade);
      }
    }
    live.length = n;
  }

  _quad(B, s, view, ax, ay, az, bx, by, bz, w, fade) {
    _a.set(ax, ay, az).applyMatrix4(view);
    _b.set(bx, by, bz).applyMatrix4(view);
    const dx = _b.x - _a.x;
    const dy = _b.y - _a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.01) return;
    const ang = Math.atan2(dy, dx);
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const mz = (az + bz) / 2;
    const ctx = this.ctx;
    const a = s.a * fade;
    ctx.quadRGB(B, s.cls, mx, my, mz, len + w * 0.5, w, ctx.R.beam, s.r, s.g, s.b, a, ang);
    if (s.flags & SEG_CORE) ctx.quadRGB(B, s.cls, mx, my, mz, len, w * 0.35, ctx.R.beam, 1, 1, 1, a, ang);
  }

  clear() {
    for (const s of this.live) this.free.push(s);
    this.live.length = 0;
  }
}

/**
 * Lightning chain through the sim's chain points: the first hop starts at (ax, ah, ay) (a
 * coil, a halo, a hand), each hop appears `stagger` game seconds after the previous one and is
 * drawn as `zig` jittered sub-segments. Ends sit on the sim's points.
 * @param {number[][]} points the chain event's points ([girl, e1, e2, …])
 */
export function chainBolt(ctx, ax, ah, ay, points, c, stagger = 0.018, zig = 3, w = 0.2, life = 0.2, hopH = 0.35) {
  let px = ax;
  let ph = ah;
  let py = ay;
  for (let i = 1; i < points.length; i++) {
    const [bx, by] = points[i];
    const s = ctx.segs.add(px, ph, py, bx, hopH, by, w, c, life, SEG_CORE | SEG_FLICKER | (zig > 1 ? SEG_ZIGZAG : 0));
    if (s) {
      s.k = zig;
      s.delay = (i - 1) * stagger;
    }
    px = bx;
    ph = hopH;
    py = by;
  }
}
