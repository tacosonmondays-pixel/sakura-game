// Particle + transient effect layer: hit sparks, explosions, pulses, beams, chain lightning,
// slashes, death puffs, coin pops, floating numbers, upgrade sparkles. Everything is drawn
// through the shared quad batches (a handful of draw calls in total).
import * as THREE from 'three';
import { createVisualRandom, visualSeed } from './vfx/random.js';
import { createHaloRules } from './vfx/halo.js';
import { isWorldFlash } from './vfx/flashGuard.js';

const TAU = Math.PI * 2;
const _c = new THREE.Color();
const _c2 = new THREE.Color();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/** Particle flags */
const GROUND = 1;
const SPIN_X = 2; // coin flip: width oscillates
const LATE_FADE = 4; // alpha holds at a0 for the first `hold` share of life (default 60 %), then fades (a cel shape, not a mist)

/**
 * Blasts (docs/VFX.md "Blasts"): the body is an alpha-blended cel puff in the blast's colour (three
 * grey values in the atlas, tinted), so the colour grade and the bloom cannot wash it out; only a
 * small hot core is additive. Sizes are × the blast radius; a: peak opacity; hold: the share of its
 * life it keeps that opacity before fading.
 *
 * The body and the lit puff are SEATED on the ground: the billboard is anchored at the blast's spot
 * on the road and drawn upward from it (a view-space lift of half its height), so no part of it ever
 * dips under the ground (no straight cut along its bottom). Its depth is that spot's, a little toward
 * the camera (SEAT_FRONT): the struck walker standing there has its legs in the smoke while its body
 * and head (her flash and hold) are drawn over the cloud, which billows up behind her, and so is
 * anyone in front of it. It is see-through (a < 1) and starts to fade early, so the road and the
 * girls never vanish under a blast.
 */
export const BLAST = {
  core: { s0: 0.55, s1: 0.8, life: 0.1, max: 1.2 }, // additive white-hot centre (the only glowing part; × min(r, max)): small and quick, so the struck walker's own flash and hold read through it
  body: { s0: 0.96, s1: 1.2, life: 0.3, a: 0.8, hold: 0.35 }, // cel puff: swells 1 → 1.25, holds, then fades
  lit: { s0: 0.52, s1: 0.65, life: 0.24, a: 0.8, hold: 0.35, at: 0.42 }, // a lighter cel puff on its upper part (at: its bottom, × the body's height)
  fire: { s: 0.26, a: 0.85, hold: 0.35, max: 10 }, // cel fire puffs flung out from round the hit (size × r, at most `max`)
  ring: { s0: 0.5, s1: 2.05, life: 0.3 }, // hard alpha ring on the ground
};
/** Body size of a Spin Shot bounce blast (× the usual), so the Glow Bowl finale is the one big cloud. */
export const BOUNCE_BODY = 0.6;
/** Height of a seated blast's anchor: just above the road (PATH_H 0.05), so its bottom never z-fights it. */
const SEAT_Y = 0.07;
/**
 * How far a seated blast's anchor is moved toward the camera, along the view direction (world
 * units). The battle camera is orthographic, so this changes only depth, never where it is drawn:
 * the cloud wraps the lower third of a walker standing on the spot (its legs in the smoke) while its
 * body and head, flash and hold included, stay in front; and a crowd standing round the blast does
 * not hide the whole cloud.
 */
const SEAT_FRONT = 0.12;
const _dir = new THREE.Vector3();
/** How much of a billboard's height is vertical in the world (the battle camera looks down 48°: cos ≈ 0.67). */
const UP_Y = 0.7;

/**
 * Is the 'explode' at events[j] one of Marumi's Spin Shot bounces (not her ball's first hit, not the
 * Glow Bowl finale, not a Wrecking Ball blast)? Her blast is followed, after its pins' hits, by the
 * ball's 'ballPop'; it is a bounce when that ball's previous pop sent it on to a next walker (the
 * renderer keeps those ball uids in `bouncing`: noteBallPop). Reads the events only.
 * @param {object[]} events @param {number} j @param {Set<number>} bouncing
 */
export function bounceBlast(events, j, bouncing) {
  const ev = events[j];
  if (ev.towerUid == null || !bouncing || !bouncing.size) return false;
  const end = Math.min(events.length, j + 64);
  for (let k = j + 1; k < end; k++) {
    const e = events[k];
    if (e.type === 'ballPop') return e.towerUid === ev.towerUid && !e.fin && bouncing.has(e.uid);
    if (e.type === 'explode') return false;
  }
  return false;
}

/**
 * Keeps `bouncing` (the balls on a Spin Shot bounce) up to date from Marumi's ball events: a pop that
 * sends the ball on to a next walker (tx set, not the finale) marks it; any other pop, or the ball's
 * end, clears it. Call for every event, after drawing its blast.
 */
export function noteBallPop(ev, bouncing) {
  if (ev.type === 'ballPop') {
    if (ev.tx != null && !ev.fin) bouncing.add(ev.uid);
    else bouncing.delete(ev.uid);
  } else if (ev.type === 'ballEnd') bouncing.delete(ev.uid);
}

export class FxSystem {
  /**
   * @param {{ atlas, batches: { groundN, groundA, bbN, bbA, overlay }, camera: THREE.Camera, rand?: () => number }} o
   *   rand: the renderer's seeded visual random stream for effects (src/render/vfx/random.js)
   */
  constructor({ atlas, batches, camera, rand = null }) {
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
    this.rand = rand || createVisualRandom(visualSeed('fx'));
    // fake glow without bloom (src/render/vfx/halo.js): halo quads under bright additive
    // particles, inside the particle limit
    this.halo = createHaloRules(this.R);
    this.halos = 0; // halos drawn last frame
    this._h = { w: 0, h: 0, uv: null, a: 0 };
    /**
     * The flash guard for world flashes (src/render/vfx/flashGuard.js), set by the renderer:
     * (size in world units, atlas region, strength) → strength factor. Bright, short additive
     * sprites ask it, so many small flashes add up to the screen area they really cover.
     */
    this.flashGate = null;
  }

  setQuality(q) {
    this.max = q === 'high' ? 1600 : q === 'medium' ? 900 : 380;
    this.density = q === 'high' ? 1 : q === 'medium' ? 0.65 : 0.32;
    this.numbers = q !== 'low';
    this.maxTexts = q === 'high' ? 70 : 40;
  }

  /** Bloom on (high): no halos; off (medium, low, high without bloom): halos for this tier. */
  setGlow(tier, bloom) {
    this.halo.set(tier, bloom);
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
    p.hold = o.hold ?? 0.6; // LATE_FADE: the share of life at full opacity
    p.lift = o.lift || 0; // billboards: drawn this many of their own heights up (view space) from the point (a seated shape)
    const col = o.color instanceof THREE.Color ? o.color : _c.set(o.color || '#ffffff');
    p.r = col.r; p.gc = col.g; p.bc = col.b;
    p.ox = o.ox || 0;
    // a world flash asks the flash guard (flashing screen area a second); past the budget it is drawn faint
    if (this.flashGate && p.batch === 'bbA') {
      const size = Math.max(p.s0, p.s1) * Math.max(1, p.asp);
      if (isWorldFlash(p.life, size)) {
        const k = this.flashGate(size, p.uv, Math.min(1, p.a0));
        p.a0 *= k;
        p.a1 *= k;
      }
    }
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

  /**
   * Explosion (BLAST): a small additive hot core, an alpha-blended cel puff body in the blast's
   * colour that swells and holds, a lighter cel puff on its upper part, a hard shock ring, cel fire
   * puffs, smoke, scorch and debris. Only the core is additive, so the grade and bloom keep its
   * punch. The body and the lit puff sit on the ground behind the struck walker (BLAST: seated).
   * @param {{ volatile?: boolean, scale?: number }} [o] scale: the cel puffs' size (a Spin Shot
   *   bounce draws BOUNCE_BODY; the ring still shows the blast's real reach)
   */
  explosion(x, z, radius, color, { volatile = false, scale = 1 } = {}) {
    const R = this.R;
    const r = Math.max(0.5, radius);
    const rb = r * scale;
    const cel = R.celPuff || R.smoke;
    const body = volatile ? '#ff5a4a' : color;
    const lit = _c2.set(body).lerp(_c.set('#fff4dc'), 0.45).getHex();
    const B = BLAST;
    // the core stays small on a big blast (sized by min(r, core.max)) and high enough that the ground never cuts it
    const cr = Math.min(rb, B.core.max);
    this.spawn({ batch: 'bbA', uv: R.glow, x, y: Math.max(0.4, SEAT_Y + UP_Y * cr * B.core.s1 * 0.5), z, s0: cr * B.core.s0, s1: cr * B.core.s1, life: B.core.life, color: volatile ? '#ffc2b0' : '#fff2c8', a0: 1 });
    // seated cel puffs (lift 0.5: the quad's bottom edge on the anchor; a small tilt keeps the lit side up),
    // anchored on the spot and moved SEAT_FRONT toward the camera (depth only: the same place on screen)
    this.camera.getWorldDirection(_dir);
    const ax = x - _dir.x * SEAT_FRONT;
    const ay = SEAT_Y - _dir.y * SEAT_FRONT;
    const az = z - _dir.z * SEAT_FRONT;
    this.spawn({
      batch: 'bbN', uv: cel, x: ax, y: ay, z: az, s0: rb * B.body.s0, s1: rb * B.body.s1, life: B.body.life, color: body,
      a0: B.body.a, a1: 0, hold: B.body.hold, rot: (this.rand() - 0.5) * 0.5, lift: 0.5, flags: LATE_FADE,
    });
    this.spawn({
      batch: 'bbN', uv: cel, x: ax, y: ay, z: az, s0: rb * B.lit.s0, s1: rb * B.lit.s1, life: B.lit.life, color: lit,
      a0: B.lit.a, a1: 0, hold: B.lit.hold, rot: (this.rand() - 0.5) * 0.5, lift: 0.5 + (B.lit.at * B.body.s1) / B.lit.s1, flags: LATE_FADE,
    });
    this.spawn({ batch: 'groundN', uv: R.ringThick || R.ring, x, y: 0.06, z, s0: r * B.ring.s0, s1: r * B.ring.s1, life: B.ring.life, color: body, a0: 0.85, flags: GROUND });
    this.spawn({ batch: 'groundN', uv: R.shadow, x, y: 0.03, z, s0: r * 1.3, s1: r * 1.5, life: 1.6, color: '#2a1a14', a0: 0.35, a1: 0, flags: GROUND });
    const k = this.n(Math.min(B.fire.max, 4 + rb * 3));
    const fs = B.fire.s * rb;
    for (let i = 0; i < k; i++) {
      const a = this.rand() * TAU;
      const d = (0.25 + this.rand() * 0.35) * r; // they burst out round the struck walker, not over it
      const sp = 0.6 + this.rand() * 1.4;
      this.spawn({
        batch: 'bbN', uv: cel, x: x + Math.cos(a) * d, y: Math.max(0.2, fs * 0.5) + this.rand() * 0.3, z: z + Math.sin(a) * d,
        vx: Math.cos(a) * sp, vy: 0.8 + this.rand(), vz: Math.sin(a) * sp, drag: 3, s0: fs, s1: 0.08, life: 0.35 + this.rand() * 0.2,
        color: i % 2 ? body : lit, a0: B.fire.a, a1: 0, hold: B.fire.hold, rot: this.rand() * TAU, flags: LATE_FADE,
      });
      if (i % 2 === 0) {
        this.spawn({
          batch: 'bbN', uv: R.smoke, x: x + Math.cos(a) * d, y: 0.25, z: z + Math.sin(a) * d,
          vx: Math.cos(a) * sp * 0.5, vy: 0.7 + this.rand() * 0.5, vz: Math.sin(a) * sp * 0.5, drag: 2, s0: 0.3 * rb, s1: 0.8 * rb,
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
    // halos: at most the tier's count, and particles + halos never past the particle limit
    const hc = this.halo.cfg;
    let haloLeft = hc ? Math.max(0, Math.min(hc.max, this.max - parts.length)) : 0;
    const h = this._h;
    this.halos = 0;
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
      let a = p.flags & LATE_FADE ? (k < p.hold ? p.a0 : p.a0 + (p.a1 - p.a0) * ((k - p.hold) / (1 - p.hold))) : p.a0 + (p.a1 - p.a0) * k;
      if (p.fadeIn && p.t < p.fadeIn) a *= p.t / p.fadeIn;
      let w = s * p.asp;
      if (p.flags & SPIN_X) w *= Math.abs(Math.cos(p.t * 9));
      const B = this.b[p.batch];
      if (haloLeft > 0 && p.batch === 'bbA' && this.halo.of(p.uv, w, s, a, h) && B.push(p.x, p.y, p.z, h.w, h.h, h.uv, p.r, p.gc, p.bc, h.a, p.rot)) {
        haloLeft--;
        this.halos++;
      }
      B.push(p.x, p.y, p.z, w, s, p.uv, p.r, p.gc, p.bc, a, p.rot, 0, p.lift * s);
    }
    parts.length = n;
    this._drawSegments(dt, haloLeft);
    this._drawTexts(dt);
  }

  _drawSegments(dt, haloLeft = 0) {
    const segs = this.segments;
    if (!segs.length) return;
    const view = this.camera.matrixWorldInverse;
    const R = this.R;
    const h = this._h;
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
      const bw = len + s.w * 0.5;
      const bh = s.w * (0.6 + 0.4 * k);
      if (haloLeft > 0 && this.halo.of(R.beam, bw, bh, k * fl, h) && this.b.bbA.push(mx, my, mz, h.w, h.h, h.uv, s.color.r, s.color.g, s.color.b, h.a, ang)) {
        haloLeft--;
        this.halos++;
      }
      this.b.bbA.push(mx, my, mz, bw, bh, R.beam, s.color.r, s.color.g, s.color.b, k * fl, ang);
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
