// Pooled line segments: tracers, beams, chain hops, sight lines, ropes, thrust lines. Lives in game time.
// With the battle's toon strokes (ctx.strokes, src/render/vfx/strokes.js) every additive segment is a solid toon line:
// a dark ink line, the body colour and (SEG_CORE) a white-hot core, pushed layer by layer so the joints stay clean. It
// leaves by thinning and breaking into dashes instead of fading, flickers and re-jitters on a stepped beat (still under
// Reduce Motion). Without them (and for SEG_NORMAL ropes and sight lines) segments are camera-facing soft quads, one or
// two per segment (zigzag: k each).
import * as THREE from 'three';
import { CORE } from '../context.js';
import { stroke, SOLID } from '../../vfx/strokes.js';

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
/** Toon look: half widths from a segment's soft-quad width, and the stepped beat (s) of its flicker and re-jitter. */
export const TOON_SEG = { body: 0.3, ink: 0.02, core: 0.42, beat: 0.05, minPx: { ink: 2.2, body: 1.4, core: 0.7 } };
/** A small deterministic hash (0..1) for the stepped re-jitter. */
const hash = (x) => {
  const v = Math.sin(x * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
/** Floats per collected toon sub-segment. */
const TS = 12;
let toonBuf = new Float32Array(256 * TS);
const S = stroke();

export class Segments {
  constructor(ctx, cap = 96) {
    this.ctx = ctx;
    this.live = [];
    this.free = [];
    for (let i = 0; i < cap; i++) {
      this.free.push({ ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, sx: 0, sy: 0, sz: 0, w: 0, r: 1, g: 1, b: 1, a: 1, life: 0, t: 0, delay: 0, flags: 0, followUid: -1, k: 3, cls: CORE, seed: 0 });
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
    s.seed = this.ctx.rand() * 997;
    this.live.push(s);
    return s;
  }

  update(gdt) {
    const ctx = this.ctx;
    const live = this.live;
    if (!live.length) return;
    const view = ctx.camera.matrixWorldInverse;
    const toon = ctx.strokes || null;
    const rm = !!ctx.reduceMotion;
    let tn = 0; // toon sub-segments collected this frame
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
      const toonSeg = toon && !(s.flags & SEG_NORMAL);
      if (s.flags & SEG_FLICKER && !toonSeg) fade *= 0.6 + 0.4 * Math.sin(s.t * 90 + i);
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
      if (toonSeg) {
        // the toon line: thins and breaks into dashes as it leaves; stepped flicker and re-jitter
        const beat = Math.floor(s.t / TOON_SEG.beat);
        const fl = s.flags & SEG_FLICKER && !rm ? (beat % 2 ? 0.75 : 1) : 1;
        const hw = s.w * TOON_SEG.body * (0.45 + 0.55 * fade) * fl;
        const cut = fade < 0.5 ? (0.5 - fade) * 1.8 : 0;
        const parts = s.flags & SEG_ZIGZAG && s.k > 1 ? Math.max(1, Math.min(8, s.k)) : 1;
        const jit = parts > 1 ? 0.22 * Math.min(1, Math.hypot(bx - s.ax, bz - s.az) / 1.5 + 0.3) : 0;
        const js = s.seed + (rm ? 0 : beat * 7.31);
        if ((tn + parts) * TS > toonBuf.length) {
          const g = new Float32Array(Math.max(toonBuf.length * 2, (tn + parts) * TS));
          g.set(toonBuf);
          toonBuf = g;
        }
        let px = s.ax;
        let py = s.ay;
        let pz = s.az;
        for (let p = 1; p <= parts; p++) {
          const t = p / parts;
          const j = p === parts ? 0 : jit;
          const nx = s.ax + (bx - s.ax) * t + (hash(js + p * 3.1) - 0.5) * j;
          const ny = s.ay + (by - s.ay) * t + (hash(js + p * 5.7) - 0.5) * j;
          const nz = s.az + (bz - s.az) * t + (hash(js + p * 9.3) - 0.5) * j;
          const o = tn * TS;
          toonBuf[o] = px; toonBuf[o + 1] = py; toonBuf[o + 2] = pz;
          toonBuf[o + 3] = nx; toonBuf[o + 4] = ny; toonBuf[o + 5] = nz;
          toonBuf[o + 6] = hw;
          toonBuf[o + 7] = cut;
          toonBuf[o + 8] = s.seed;
          toonBuf[o + 9] = n - 1; // the record's slot in live (it was kept above: live[n - 1] === s)
          toonBuf[o + 10] = (p - 1) / parts;
          toonBuf[o + 11] = p / parts;
          tn++;
          px = nx;
          py = ny;
          pz = nz;
        }
        continue;
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
    if (tn) this._toon(toon, tn);
  }

  /** Pushes the collected toon sub-segments layer by layer: every ink line, then every body, then every core. */
  _toon(toon, tn) {
    const live = this.live;
    const hdr = this.ctx.bloom ? 0.3 : 0;
    // short of the strokes' room: the newest lines go (a line keeps all its layers or is not drawn)
    const room = toon.room ? toon.room() : Infinity;
    let need = 0;
    for (let q = 0; q < tn; q++) need += live[toonBuf[q * TS + 9]]?.flags & SEG_CORE ? 3 : 2;
    while (tn > 0 && need > room) {
      tn--;
      need -= live[toonBuf[tn * TS + 9]]?.flags & SEG_CORE ? 3 : 2;
    }
    S.kind = SOLID;
    S.head = 99;
    S.tail = -99;
    S.noise = 9;
    S.bandFreq = 0;
    S.bandSpeed = 0;
    for (let layer = 0; layer < 3; layer++) {
      S.minPx = layer === 0 ? TOON_SEG.minPx.ink : layer === 1 ? TOON_SEG.minPx.body : TOON_SEG.minPx.core;
      S.hdr = layer === 2 ? hdr : 0;
      for (let q = 0; q < tn; q++) {
        const o = q * TS;
        const s = live[toonBuf[o + 9]];
        if (!s) continue;
        if (layer === 2 && !(s.flags & SEG_CORE)) continue;
        const hw = toonBuf[o + 6];
        S.ax = toonBuf[o]; S.ay = toonBuf[o + 1]; S.az = toonBuf[o + 2];
        S.bx = toonBuf[o + 3]; S.by = toonBuf[o + 4]; S.bz = toonBuf[o + 5];
        S.ua = toonBuf[o + 10];
        S.ub = toonBuf[o + 11];
        S.cut = toonBuf[o + 7];
        S.seed = toonBuf[o + 8];
        S.a = s.a;
        if (layer === 0) {
          // the ink: a deep shade of the line's own hue
          S.wa = S.wb = hw + TOON_SEG.ink;
          S.r = s.r * 0.18 + 0.035;
          S.g = s.g * 0.18 + 0.02;
          S.b = s.b * 0.18 + 0.07;
        } else if (layer === 1) {
          S.wa = S.wb = hw;
          S.r = s.r;
          S.g = s.g;
          S.b = s.b;
        } else {
          S.wa = S.wb = hw * TOON_SEG.core;
          S.r = 0.85 + s.r * 0.15;
          S.g = 0.85 + s.g * 0.15;
          S.b = 0.85 + s.b * 0.15;
        }
        if (!toon.push(S)) return;
      }
    }
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
