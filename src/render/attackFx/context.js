// Shared per-renderer context handed to every attack style and pattern: time, quality knobs,
// colour cache, budget-aware quad pushes, pooled game-time quads and small read-only helpers
// over the renderer's actor views. Nothing here touches the sim.
import * as THREE from 'three';
import { QuadPool } from './quadPool.js';
import { createVisualRandom, visualSeed } from '../vfx/random.js';
import { createHaloRules } from '../vfx/halo.js';

/** Quad shed classes (§6 shed order: decor first, then familiars, then motes; core never). */
export const CORE = 0;
export const DECOR = 1;
export const FAMILIAR = 2;
export const MOTE = 3;
const SHED_AT = [Infinity, 0.6, 0.8, 0.95];

/** Quality knobs (docs/ATTACK_FX.md §Budgets). */
export const KNOBS = {
  high: { quadBudget: 900, familiars: 3, lanterns: 5, motes: 1, trails: 2, separation: true, bank: true, pass: true, clones: 3, beamDots: 4, zig: 3, sparks: true },
  medium: { quadBudget: 500, familiars: 2, lanterns: 3, motes: 0.65, trails: 1, separation: true, bank: true, pass: true, clones: 1, beamDots: 2, zig: 3, sparks: false },
  low: { quadBudget: 250, familiars: 0, lanterns: 0, motes: 0.25, trails: 0, separation: false, bank: false, pass: false, clones: 0, beamDots: 0, zig: 1, sparks: false },
};

/** Per-frame caps on event-driven decoration (state still updates past them). */
export const CAPS = { muzzle: 24, tracer: 16, impact: 16, sweep: 8, launch: 8 };

const _la = new THREE.Vector3();
const _lb = new THREE.Vector3();
const _halo = { w: 0, h: 0, uv: null, a: 0 };

const PART = {
  batch: 'bbA', uv: null, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, life: 0.3, s0: 0.2, s1: 0.2,
  asp: 1, rot: 0, vrot: 0, a0: 1, a1: 0, fadeIn: 0, flags: 0, color: null, ox: 0,
};

/**
 * @param {{ sim, actors, fx, batches, atlas, camera, rig, quality, reduceMotion, rand? }} o
 *   rand: the renderer's seeded visual random stream for attack FX (src/render/vfx/random.js)
 */
export function createContext(o) {
  const colors = new Map();
  const capsLeft = { muzzle: 0, tracer: 0, impact: 0, sweep: 0, launch: 0 };
  const ctx = {
    sim: o.sim,
    actors: o.actors,
    fx: o.fx,
    b: o.batches,
    R: o.atlas.regions,
    camera: o.camera,
    rig: o.rig,
    quality: 'medium',
    q: KNOBS.medium,
    reduceMotion: !!o.reduceMotion,
    /** seeded render-only random numbers [0, 1) — never Math.random, never the sim's rng */
    rand: o.rand || createVisualRandom(visualSeed('attackFx')),
    /** game seconds since creation (drives every attack-FX motion) */
    time: 0,
    /** real seconds since creation (clip throttle) */
    rtime: 0,
    gdt: 0,
    rdt: 0,
    timeScale: 1,
    frame: 0,
    quads: 0,
    shed: 0,
    readScale: 1,
    selectedUid: null,
    /** scratch arrays for victim lookups (reused) */
    victims: [],
    vpos: [],
    /** fake glow without bloom (src/render/vfx/halo.js): halo quads count as decoration */
    halo: createHaloRules(o.atlas.regions),
    halosLeft: 0,
    halos: 0,
    CORE, DECOR, FAMILIAR, MOTE,

    setQuality(q) {
      ctx.quality = KNOBS[q] ? q : 'medium';
      ctx.q = KNOBS[ctx.quality];
    },

    /** Cached THREE.Color for a hex string or 0xRRGGBB number. */
    col(hex) {
      let c = colors.get(hex);
      if (!c) {
        c = new THREE.Color(hex);
        colors.set(hex, c);
      }
      return c;
    },

    /** Starts a renderer frame: resets the budget counters and event caps. */
    beginFrame() {
      ctx.quads = 0;
      ctx.halos = 0;
      ctx.halosLeft = ctx.halo.cfg ? ctx.halo.cfg.max : 0;
      for (const k in CAPS) capsLeft[k] = CAPS[k];
    },

    /** Bloom on: no halos; off: this tier's halos (BattleRenderer calls it with the quality). */
    setGlow(tier, bloom) {
      ctx.halo.set(tier, bloom);
    },

    /** Takes one unit of a per-frame cap; false once it is spent. */
    cap(kind) {
      if (capsLeft[kind] <= 0) return false;
      capsLeft[kind]--;
      return true;
    },

    /** May a quad of this class still be drawn this frame? */
    allow(cls) {
      return ctx.quads < ctx.q.quadBudget * SHED_AT[cls];
    },

    /** Budget-aware quad push (x, h, y = world x, height, depth). */
    quadRGB(B, cls, x, h, y, w, hh, uv, r, g, b, a, rot = 0, ox = 0, oy = 0) {
      if (cls !== CORE && ctx.quads >= ctx.q.quadBudget * SHED_AT[cls]) {
        ctx.shed++;
        return false;
      }
      // a soft halo under a bright additive sprite (no bloom on this tier): decoration, shed first
      if (ctx.halosLeft > 0 && B === ctx.b.bbA && ctx.quads < ctx.q.quadBudget * SHED_AT[DECOR] && ctx.halo.of(uv, w, hh, a, _halo)
        && B.push(x, h, y, _halo.w, _halo.h, _halo.uv, r, g, b, _halo.a, rot, ox, oy)) {
        ctx.quads++;
        ctx.halos++;
        ctx.halosLeft--;
      }
      if (B.push(x, h, y, w, hh, uv, r, g, b, a, rot, ox, oy)) {
        ctx.quads++;
        return true;
      }
      return false;
    },

    quad(B, cls, x, h, y, w, hh, uv, c, a, rot = 0, ox = 0, oy = 0) {
      return ctx.quadRGB(B, cls, x, h, y, w, hh, uv, c.r, c.g, c.b, a, rot, ox, oy);
    },

    /**
     * Camera-facing line quad between two world points (ground x, height, ground y), drawn
     * with `uv` stretched along it (default: the soft beam sprite).
     */
    line(B, cls, ax, ah, ay, bx, bh, by, w, c, a, uv = null) {
      const view = ctx.camera.matrixWorldInverse;
      _la.set(ax, ah, ay).applyMatrix4(view);
      _lb.set(bx, bh, by).applyMatrix4(view);
      const dx = _lb.x - _la.x;
      const dy = _lb.y - _la.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 0.005) return false;
      return ctx.quadRGB(B, cls, (ax + bx) / 2, (ah + bh) / 2, (ay + by) / 2, len, w, uv || ctx.R.beam, c.r, c.g, c.b, a, Math.atan2(dy, dx));
    },

    /** Screen-plane angle (billboard rot) of a world direction (dx, dh, dy). */
    screenAngle(x, h, y, dx, dh, dy) {
      const view = ctx.camera.matrixWorldInverse;
      _la.set(x, h, y).applyMatrix4(view);
      _lb.set(x + dx, h + dh, y + dy).applyMatrix4(view);
      return Math.atan2(_lb.y - _la.y, _lb.x - _la.x);
    },

    /** Game-time pooled quad (see QuadPool.spawn). */
    spr(B, cls, uv, x, h, y, s0, s1, life, c, a0 = 1) {
      if (cls !== CORE && !ctx.allow(cls)) {
        ctx.shed++;
        return null;
      }
      return ctx.pool.spawn(B, cls, uv, x, h, y, s0, s1, life, c, a0);
    },

    /**
     * Real-time FxSystem particle without allocating a spawn object. Returns the particle so
     * the caller can set vx/vy/vz/g/drag/rot/vrot/asp/a1/fadeIn, or null when fx is full.
     */
    part(batch, uv, x, h, y, s0, s1, life, c, a0 = 1) {
      PART.batch = batch;
      PART.uv = uv;
      PART.x = x;
      PART.y = h;
      PART.z = y;
      PART.s0 = s0;
      PART.s1 = s1;
      PART.life = life;
      PART.color = c;
      PART.a0 = a0;
      return ctx.fx.spawn(PART);
    },

    /** Particle count scaled by the fx density of the current quality. */
    n(count) {
      return ctx.fx.n(count);
    },

    /** Live enemy view (actors) or null; hidden / tunnel enemies count as missing. */
    enemy(uid) {
      if (uid == null) return null;
      const v = ctx.actors.enemies.get(uid);
      return v && !v.hidden ? v : null;
    },

    /** Body-centre height of an enemy view. */
    enemyH(v) {
      return v.y + v.height * 0.55;
    },

    tower(uid) {
      return ctx.actors.towers.get(uid) || null;
    },

    /** Drawn facing of a girl (her view's lerped facing, else the sim's). */
    facing(t) {
      const v = ctx.actors.towers.get(t.uid);
      return v ? v.facing : t.facing || 0;
    },

    /** Model scale factor of a girl relative to an ordinary tower. */
    bodyScale(t) {
      const v = ctx.actors.towers.get(t.uid);
      return v ? v.scale / 1.22 : 1;
    },

    /** Weapon-hand point of a girl. Writes out.x, out.y (ground), out.h (height). */
    hand(t, out) {
      const f = ctx.facing(t);
      const s = ctx.bodyScale(t);
      out.x = t.x + Math.sin(f) * 0.22 * s;
      out.y = t.y + Math.cos(f) * 0.22 * s;
      out.h = 0.55 * s;
      return out;
    },

    /** Is this girl "in combat" (she attacked less than 1.5 game seconds ago)? */
    inCombat(tw) {
      return ctx.time - tw.lastAttackT < 1.5;
    },
  };
  ctx.pool = new QuadPool(ctx, 768);
  ctx.setQuality(o.quality || 'medium');
  return ctx;
}
