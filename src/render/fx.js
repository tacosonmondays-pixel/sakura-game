// Particle + transient effect layer: hit sparks, explosions, pulses, beams, chain lightning,
// slashes, death puffs, coin pops, floating numbers, upgrade sparkles. Everything is drawn
// through the shared quad batches (a handful of draw calls in total).
import * as THREE from 'three';

const TAU = Math.PI * 2;
const _c = new THREE.Color();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/** Particle flags */
const GROUND = 1;
const SPIN_X = 2; // coin flip: width oscillates

export class FxSystem {
  /**
   * @param {{ atlas, batches: { groundN, groundA, bbN, bbA, overlay }, camera: THREE.Camera }} o
   */
  constructor({ atlas, batches, camera }) {
    this.atlas = atlas;
    this.R = atlas.regions;
    this.b = batches;
    this.camera = camera;
    this.parts = [];
    this.free = [];
    this.max = 1200;
    this.density = 1;
    this.numbers = true;
    this.segments = []; // beams / lightning segments
    this.texts = [];
    this.maxTexts = 70;
    this.rand = Math.random;
  }

  setQuality(q) {
    this.max = q === 'high' ? 1600 : q === 'medium' ? 900 : 380;
    this.density = q === 'high' ? 1 : q === 'medium' ? 0.65 : 0.32;
    this.numbers = q !== 'low';
    this.maxTexts = q === 'high' ? 70 : 40;
  }

  /** Low-level particle spawn. Colours are THREE.Color or hex. */
  spawn(o) {
    if (this.parts.length >= this.max) return null;
    const p = this.free.pop() || {};
    p.batch = o.batch || 'bbN';
    p.uv = o.uv || this.R.glow;
    p.x = o.x; p.y = o.y; p.z = o.z;
    p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
    p.g = o.g || 0;
    p.drag = o.drag || 0;
    p.life = o.life || 0.5;
    p.t = 0;
    p.s0 = o.s0 ?? o.size ?? 0.2;
    p.s1 = o.s1 ?? p.s0;
    p.asp = o.asp || 1;
    p.rot = o.rot || 0;
    p.vrot = o.vrot || 0;
    p.a0 = o.a0 ?? 1;
    p.a1 = o.a1 ?? 0;
    p.fadeIn = o.fadeIn || 0;
    p.flags = o.flags || 0;
    const col = o.color instanceof THREE.Color ? o.color : _c.set(o.color || '#ffffff');
    p.r = col.r; p.gc = col.g; p.bc = col.b;
    p.ox = o.ox || 0;
    this.parts.push(p);
    return p;
  }

  n(count) {
    return Math.max(1, Math.round(count * this.density));
  }

  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------

  /** Small impact burst. */
  hit(x, y, z, color, { crit = false, strong = false } = {}) {
    const R = this.R;
    this.spawn({ batch: 'bbA', uv: R.spark, x, y, z, s0: crit ? 0.55 : strong ? 0.42 : 0.3, s1: 0.05, life: 0.18, color, rot: this.rand() * TAU });
    const k = this.n(crit ? 7 : 3);
    for (let i = 0; i < k; i++) {
      const a = this.rand() * TAU;
      const sp = 1.2 + this.rand() * 1.6;
      this.spawn({
        batch: 'bbA', uv: R.glow, x, y, z, vx: Math.cos(a) * sp, vy: 0.6 + this.rand() * 1.5, vz: Math.sin(a) * sp,
        g: -6, drag: 2, s0: 0.09, s1: 0.02, life: 0.25 + this.rand() * 0.15, color,
      });
    }
  }

  /** Explosion with flash, shock ring, fire puffs, smoke and scorch. */
  explosion(x, z, radius, color, { volatile = false } = {}) {
    const R = this.R;
    const r = Math.max(0.5, radius);
    this.spawn({ batch: 'bbA', uv: R.glow, x, y: 0.35, z, s0: r * 1.6, s1: r * 2.2, life: 0.22, color: volatile ? '#ff5a4a' : '#ffd08a', a0: 1 });
    this.spawn({ batch: 'groundA', uv: R.ringSoft, x, y: 0.06, z, s0: r * 0.4, s1: r * 2.05, life: 0.32, color, flags: GROUND });
    this.spawn({ batch: 'groundN', uv: R.shadow, x, y: 0.03, z, s0: r * 1.3, s1: r * 1.5, life: 1.6, color: '#2a1a14', a0: 0.35, a1: 0, flags: GROUND });
    const k = this.n(Math.min(14, 5 + r * 4));
    for (let i = 0; i < k; i++) {
      const a = this.rand() * TAU;
      const d = this.rand() * r * 0.6;
      const sp = 0.6 + this.rand() * 1.4;
      this.spawn({
        batch: 'bbA', uv: R.soft, x: x + Math.cos(a) * d, y: 0.2 + this.rand() * 0.3, z: z + Math.sin(a) * d,
        vx: Math.cos(a) * sp, vy: 0.8 + this.rand(), vz: Math.sin(a) * sp, drag: 3, s0: 0.35 * r, s1: 0.1, life: 0.35 + this.rand() * 0.2,
        color: i % 2 ? color : '#ffe08a',
      });
      if (i % 2 === 0) {
        this.spawn({
          batch: 'bbN', uv: R.smoke, x: x + Math.cos(a) * d, y: 0.25, z: z + Math.sin(a) * d,
          vx: Math.cos(a) * sp * 0.5, vy: 0.7 + this.rand() * 0.5, vz: Math.sin(a) * sp * 0.5, drag: 2, s0: 0.3 * r, s1: 0.8 * r,
          life: 0.8 + this.rand() * 0.4, color: '#7a6a66', a0: 0.55, fadeIn: 0.1, rot: this.rand() * TAU, vrot: (this.rand() - 0.5) * 2,
        });
      }
    }
    const debris = this.n(6);
    for (let i = 0; i < debris; i++) {
      const a = this.rand() * TAU;
      const sp = 2 + this.rand() * 2.5;
      this.spawn({
        batch: 'bbN', uv: R.shard, x, y: 0.3, z, vx: Math.cos(a) * sp, vy: 2.5 + this.rand() * 2, vz: Math.sin(a) * sp, g: -12,
        s0: 0.1, s1: 0.06, life: 0.6, color: '#5a4a44', a0: 1, a1: 0.6, rot: this.rand() * TAU, vrot: 10,
      });
    }
  }

  /** Expanding ring for pulses / auras / waves. */
  ring(x, z, r0, r1, life, color, { additive = true, uv = 'ringSoft', y = 0.06, a0 = 1 } = {}) {
    this.spawn({ batch: additive ? 'groundA' : 'groundN', uv: this.R[uv] || this.R.ringSoft, x, y, z, s0: r0 * 2, s1: r1 * 2, life, color, a0, flags: GROUND });
  }

  pulse(x, z, radius, color) {
    this.ring(x, z, radius * 0.25, radius, 0.38, color);
    this.spawn({ batch: 'groundA', uv: this.R.disc, x, y: 0.05, z, s0: radius * 1.6, s1: radius * 2, life: 0.3, color, a0: 0.35, flags: GROUND });
    const k = this.n(8);
    for (let i = 0; i < k; i++) {
      const a = (i / k) * TAU;
      this.spawn({
        batch: 'bbA', uv: this.R.spark, x: x + Math.cos(a) * radius * 0.9, y: 0.2, z: z + Math.sin(a) * radius * 0.9, vy: 0.8,
        s0: 0.22, s1: 0.04, life: 0.4, color,
      });
    }
  }

  /** Straight energy beam between two sim points. */
  beam(from, to, width, color, { life = 0.16, y = 0.45 } = {}) {
    this.segments.push({ ax: from[0], ay: y, az: from[1], bx: to[0], by: y * 0.7, bz: to[1], w: Math.max(0.14, width * 1.6), color: new THREE.Color(color), life, t: 0, core: true });
    this.spawn({ batch: 'bbA', uv: this.R.glow, x: to[0], y: y * 0.7, z: to[1], s0: width * 3, s1: width * 1.5, life: life * 1.4, color });
    this.spawn({ batch: 'bbA', uv: this.R.glow, x: from[0], y, z: from[1], s0: width * 3, s1: width, life, color });
  }

  /** Jagged chain lightning through points. */
  chain(points, color) {
    const col = new THREE.Color(color);
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, az] = points[i];
      const [bx, bz] = points[i + 1];
      const ay = i === 0 ? 0.55 : 0.35;
      const by = 0.35;
      let px = ax;
      let py = ay;
      let pz = az;
      const parts = 3;
      for (let k = 1; k <= parts; k++) {
        const t = k / parts;
        const jitter = k === parts ? 0 : 0.22;
        const nx = ax + (bx - ax) * t + (this.rand() - 0.5) * jitter;
        const ny = ay + (by - ay) * t + (this.rand() - 0.5) * jitter;
        const nz = az + (bz - az) * t + (this.rand() - 0.5) * jitter;
        this.segments.push({ ax: px, ay: py, az: pz, bx: nx, by: ny, bz: nz, w: 0.2, color: col, life: 0.2, t: 0, core: true, flicker: true });
        px = nx;
        py = ny;
        pz = nz;
      }
      this.spawn({ batch: 'bbA', uv: this.R.glow, x: bx, y: by, z: bz, s0: 0.6, s1: 0.2, life: 0.25, color });
    }
  }

  /** Crescent sword swipe at a target. */
  slash(x, z, angle, color, size = 0.9) {
    this.spawn({ batch: 'bbA', uv: this.R.slash, x, y: 0.4, z, s0: size, s1: size * 1.3, asp: 2, life: 0.18, color, rot: angle, a0: 1 });
    this.spawn({ batch: 'bbA', uv: this.R.slash, x, y: 0.42, z, s0: size * 0.7, s1: size * 1.1, asp: 2, life: 0.14, color: '#ffffff', rot: angle, a0: 0.8 });
  }

  /** Soft cloud puff (deaths, placement dust). */
  puff(x, y, z, color, count = 6, spread = 0.35, size = 0.35) {
    const k = this.n(count);
    for (let i = 0; i < k; i++) {
      const a = this.rand() * TAU;
      const sp = 0.4 + this.rand() * 0.9;
      this.spawn({
        batch: 'bbN', uv: this.R.smoke, x: x + Math.cos(a) * spread * 0.3, y, z: z + Math.sin(a) * spread * 0.3,
        vx: Math.cos(a) * sp, vy: 0.4 + this.rand() * 0.6, vz: Math.sin(a) * sp, drag: 3.5,
        s0: size * 0.6, s1: size * 1.4, life: 0.5 + this.rand() * 0.3, color, a0: 0.85, rot: this.rand() * TAU, vrot: (this.rand() - 0.5) * 3,
      });
    }
  }

  /** Enemy defeat: poof + sparkles + coloured bits. */
  death(x, y, z, size, color) {
    const s = Math.max(0.6, size);
    this.puff(x, y + 0.2, z, '#ffffff', 6 + s * 2, 0.4 * s, 0.38 * s);
    this.spawn({ batch: 'bbA', uv: this.R.glow, x, y: y + 0.3, z, s0: 0.6 * s, s1: 1.1 * s, life: 0.2, color: '#ffffff', a0: 0.8 });
    const k = this.n(5);
    for (let i = 0; i < k; i++) {
      const a = this.rand() * TAU;
      const sp = 1.2 + this.rand() * 1.5;
      this.spawn({
        batch: 'bbN', uv: this.R.dot, x, y: y + 0.3, z, vx: Math.cos(a) * sp, vy: 1.8 + this.rand() * 1.5, vz: Math.sin(a) * sp,
        g: -9, s0: 0.1, s1: 0.05, life: 0.55, color, a0: 1, a1: 0.3,
      });
      this.spawn({
        batch: 'bbA', uv: this.R.star, x, y: y + 0.4, z, vx: Math.cos(a) * sp * 0.4, vy: 1 + this.rand(), vz: Math.sin(a) * sp * 0.4,
        drag: 2, s0: 0.16, s1: 0.02, life: 0.5, color: '#fff3b0', rot: this.rand() * TAU, vrot: 6,
      });
    }
  }

  /** Coin pop with "+N". */
  coin(x, y, z, amount) {
    this.spawn({ batch: 'bbN', uv: this.R.coin, x, y: y + 0.4, z, vy: 1.6, g: -2.2, s0: 0.26, s1: 0.22, life: 0.75, color: '#ffffff', a0: 1, a1: 0, flags: SPIN_X });
    if (amount > 0 && this.numbers) this.text(`+${amount}`, x + 0.18, y + 0.62, z, '#ffd43b', 0.2, 0.8, 0.7);
  }

  /** Upgrade / level-up celebration. */
  sparkle(x, z, color, { count = 14, height = 1.1, ring = true } = {}) {
    if (ring) this.ring(x, z, 0.2, 0.9, 0.5, color);
    const k = this.n(count);
    for (let i = 0; i < k; i++) {
      const a = this.rand() * TAU;
      const r = 0.15 + this.rand() * 0.35;
      this.spawn({
        batch: 'bbA', uv: i % 3 ? this.R.star : this.R.spark, x: x + Math.cos(a) * r, y: 0.1 + this.rand() * 0.3, z: z + Math.sin(a) * r,
        vy: height + this.rand() * height, drag: 1.2, s0: 0.2, s1: 0.04, life: 0.7 + this.rand() * 0.4, color, rot: this.rand() * TAU, vrot: 4,
      });
    }
  }

  /** Bright flash sprite. */
  flash(x, y, z, color, size = 1, life = 0.2) {
    this.spawn({ batch: 'bbA', uv: this.R.glow, x, y, z, s0: size, s1: size * 1.4, life, color });
  }

  /** Shards (crystal shell / barrier break). */
  shards(x, y, z, color, count = 8) {
    const k = this.n(count);
    for (let i = 0; i < k; i++) {
      const a = this.rand() * TAU;
      const sp = 1.5 + this.rand() * 2;
      this.spawn({
        batch: 'bbA', uv: this.R.shard, x, y, z, vx: Math.cos(a) * sp, vy: 1 + this.rand() * 2, vz: Math.sin(a) * sp, g: -8,
        s0: 0.16, s1: 0.08, life: 0.55, color, rot: this.rand() * TAU, vrot: 9,
      });
    }
  }

  /** Floating text (damage numbers, +coins, LV UP). */
  text(str, x, y, z, color, size = 0.2, life = 0.7, rise = 0.6) {
    if (this.texts.length >= this.maxTexts) this.texts.shift();
    this.texts.push({ str: String(str), x, y, z, color: new THREE.Color(color), size, life, t: 0, rise, ox: (this.rand() - 0.5) * 0.15 });
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------

  /** Advances and draws all particles into the batches (batches already begun). */
  update(dt) {
    const parts = this.parts;
    let n = 0;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.t += dt;
      if (p.t >= p.life) {
        this.free.push(p);
        continue;
      }
      parts[n++] = p;
      if (p.drag) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
        p.vz *= k;
      }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.g && p.y < 0.03 && !(p.flags & GROUND)) {
        p.y = 0.03;
        p.vy *= -0.3;
        p.vx *= 0.6;
        p.vz *= 0.6;
      }
      p.rot += p.vrot * dt;
      const k = p.t / p.life;
      const s = p.s0 + (p.s1 - p.s0) * k;
      let a = p.a0 + (p.a1 - p.a0) * k;
      if (p.fadeIn && p.t < p.fadeIn) a *= p.t / p.fadeIn;
      let w = s * p.asp;
      if (p.flags & SPIN_X) w *= Math.abs(Math.cos(p.t * 9));
      this.b[p.batch].push(p.x, p.y, p.z, w, s, p.uv, p.r, p.gc, p.bc, a, p.rot);
    }
    parts.length = n;
    this._drawSegments(dt);
    this._drawTexts(dt);
  }

  _drawSegments(dt) {
    const segs = this.segments;
    if (!segs.length) return;
    const view = this.camera.matrixWorldInverse;
    const R = this.R;
    let n = 0;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      s.t += dt;
      if (s.t >= s.life) continue;
      segs[n++] = s;
      _a.set(s.ax, s.ay, s.az).applyMatrix4(view);
      _b.set(s.bx, s.by, s.bz).applyMatrix4(view);
      const dx = _b.x - _a.x;
      const dy = _b.y - _a.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.01) continue;
      const ang = Math.atan2(dy, dx);
      const k = 1 - s.t / s.life;
      const fl = s.flicker ? 0.6 + 0.4 * Math.sin(s.t * 90) : 1;
      const mx = (s.ax + s.bx) / 2;
      const my = (s.ay + s.by) / 2;
      const mz = (s.az + s.bz) / 2;
      this.b.bbA.push(mx, my, mz, len + s.w * 0.5, s.w * (0.6 + 0.4 * k), R.beam, s.color.r, s.color.g, s.color.b, k * fl, ang);
      if (s.core) this.b.bbA.push(mx, my, mz, len, s.w * 0.35 * (0.5 + 0.5 * k), R.beam, 1, 1, 1, k * fl, ang);
    }
    segs.length = n;
  }

  _drawTexts(dt) {
    const texts = this.texts;
    if (!texts.length) return;
    const ov = this.b.overlay;
    const asp = this.atlas.glyphAspect;
    let n = 0;
    for (let i = 0; i < texts.length; i++) {
      const t = texts[i];
      t.t += dt;
      if (t.t >= t.life) continue;
      texts[n++] = t;
      const k = t.t / t.life;
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.6 : 1.2 - Math.min(0.2, (k - 0.15) * 0.6);
      const size = t.size * pop;
      const a = k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1;
      const y = t.y + t.rise * (1 - (1 - k) * (1 - k));
      const cw = size * asp * 0.78;
      const len = t.str.length;
      for (let c = 0; c < len; c++) {
        const uv = this.atlas.glyph(t.str[c]);
        if (!uv) continue;
        ov.push(t.x + t.ox, y, t.z, size * asp, size, uv, t.color.r, t.color.g, t.color.b, a, 0, (c - (len - 1) / 2) * cw, 0);
      }
    }
    texts.length = n;
  }

  clear() {
    this.parts.length = 0;
    this.segments.length = 0;
    this.texts.length = 0;
  }
}
