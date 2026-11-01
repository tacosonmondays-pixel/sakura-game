// Styled laser beams (docs/VFX.md "Beams"; display only): solid toon beams that land hard. Each one charges as a thin
// line racing out, punches in wider than it stays, holds with bright bands running out to the target, then leaves:
// it thins, its back end chases its front into the target, and it breaks into dashes. Where it lands: a star (flash-
// guarded), a burst of inked impact lines, sparks, a ring on the ground and a brief scorch. A zig-zag beam (a storm
// lance) is struck again on a stepped beat like the lightning.
//
//   const beams = createBeamFx({ scene, strokes, batches, atlas, camera, quality, reduceMotion, rand });
//   beams.fire([x, y, z], [x, y, z], { width, color, preset, from, zig })   // world points: the girl's, the end
//   beams.update(dt)   // the visual clock's dt, between the batches' (and the shared strokes') begin and end
//
// Draw cost: its lines are toon strokes (src/render/vfx/strokes.js), sharing the battle's one draw call of styled lines;
// standalone (tests, the lab) it makes its own. Plus a few quads in the existing batches. Randomness: the stream it is
// handed; never Math.random, never the sim's. Reduce Motion: no overshoot, no running bands, no chasing tail, no
// impact lines, no re-strike, still sprites, half the sparks.
import * as THREE from 'three';
import { BEAM_PRESETS, BEAM_TIERS, MAX_BEAMS } from './beamPresets.js';
import { createStrokes, stroke, SOLID, BANDS } from './strokes.js';
import { zigzagPath } from './lightning.js';

const TAU = Math.PI * 2;
/** Thinnest each layer is drawn (half width, CSS px). */
export const BEAM_MIN_PX = { ink: 3, body: 2, core: 1, line: 1 };
/** High with bloom: the body colour × this (under the grade's knee: it stays saturated). */
export const BODY_UNDER_BLOOM = 0.82;
/** A beam's half width from the sim's beam width (0.12 … 0.36): base + per × width. */
export const BEAM_HALF = { base: 0.05, per: 0.3 };

/** sRGB hex → linear [r, g, b] 0..1. */
function lin(hex) {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}
const ease = (k) => 1 - (1 - k) * (1 - k);

/**
 * @param {{ scene: THREE.Object3D, strokes?: object|null, batches?: object|null, atlas?: object|null, camera?: THREE.Camera|null,
 *   quality?: 'high'|'medium'|'low', reduceMotion?: boolean, rand?: () => number, presets?: object }} o
 */
export function createBeamFx({ scene, strokes = null, batches = null, atlas = null, camera = null, quality = 'medium', reduceMotion = false, rand = null, presets = BEAM_PRESETS }) {
  const R = atlas?.regions || {};
  const rnd = rand || (() => 0.5);
  let tierId = BEAM_TIERS[quality] ? quality : 'medium';
  let tier = BEAM_TIERS[tierId];
  let bloom = false;
  const own = !strokes;
  const lines = strokes || createStrokes({ scene, max: 2048, name: 'beamFx' });
  const S = stroke();
  const live = [];
  const tinted = new Map();
  let time = 0;
  let drawn = 0;
  // the screen's right and up in the world (impact lines burst flat to the camera)
  const right = new THREE.Vector3(1, 0, 0);
  const up = new THREE.Vector3(0, 1, 0);

  const presetFor = (id, color) => {
    if (id && presets[id]) return { id, p: presets[id] };
    const base = presets.laser;
    const key = String(color || '').toLowerCase();
    if (!key) return { id: 'laser', p: base };
    // the beam's own colour: the body; a dark ink of its hue; a white-hot core with a hint of it
    if (!tinted.has(key)) {
      const c = new THREE.Color(key);
      const hsl = c.getHSL({});
      const ink = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 0.8 + 0.2), 0.14);
      const core = c.clone().lerp(new THREE.Color('#ffffff'), 0.88);
      tinted.set(key, { ...base, label: `Laser (${key})`, body: key, ink: `#${ink.getHexString()}`, core: `#${core.getHexString()}`, lines: { ...base.lines, ink: `#${ink.getHexString()}` } });
    }
    return { id: 'laser', p: tinted.get(key) };
  };

  /**
   * Fires a beam from a to b (world [x, y, z]). opts: width (the sim's beam width), color (no preset: the beam in
   * that colour), preset, from (a sweeping lance: its end slides in from here), zig (kinks: a zig-zag lance).
   * @returns {object|null} the beam's record (live, read-only)
   */
  function fire(a, b, { width = 0.2, color = null, preset = null, from = null, zig = null } = {}) {
    if (!a || !b) return null;
    const { id, p } = presetFor(preset, color);
    if (!p) return null;
    if (live.length >= MAX_BEAMS) live.shift();
    const rec = {
      id, p, a: [a[0], a[1], a[2]], b: [b[0], b[1], b[2]], from: from ? [from[0], from[1], from[2]] : null,
      W: Math.max(0.05, BEAM_HALF.base + BEAM_HALF.per * width) * (p.width ?? 1),
      t: 0, seed: rnd() * 7, zig: Math.max(0, (zig ?? p.zig) | 0), pts: null, strikes: 0, nextStrike: p.restrike || 0.05,
      hitAt: -1, hitK: 1, muzK: 1, rot: rnd() * TAU, rays: [], sparks: [],
      col: { ink: lin(p.ink), body: lin(p.body), core: lin(p.core) },
    };
    for (let i = 0; i < 8; i++) rec.rays.push([(i / 8 + (rnd() - 0.5) * 0.07) * TAU, 0.7 + 0.6 * rnd()]);
    for (let i = 0; i < 5; i++) rec.sparks.push([rnd() * TAU, 0.6 + 0.6 * rnd(), 0.5 + rnd(), 0.7 + 0.6 * rnd()]);
    if (rec.zig > 1) rec.pts = zigzagPath(rec.a[0], rec.a[1], rec.a[2], rec.b[0], rec.b[1], rec.b[2], rec.zig, p, rnd);
    // the muzzle flare is a bright, short flash on the board: it asks the flash guard
    const mz = p.muzzle;
    rec.muzK = api.flashGate && mz ? api.flashGate(mz.size + rec.W * 1.5, R[mz.sprite] || R.glow, 0.9) : 1;
    live.push(rec);
    return rec;
  }

  const fadeOf = (p) => p.fade * (reduceMotion ? 1.5 : 1);
  const lifeOf = (p) => p.charge + p.punch + p.hold + fadeOf(p);
  const fxLife = (p) => Math.max(p.star?.life ?? 0, p.lines?.life ?? 0, p.sparks?.life ?? 0, p.ring?.life ?? 0, p.scorch?.life ?? 0);
  const endOf = (rec) => Math.max(lifeOf(rec.p), rec.p.charge + fxLife(rec.p));

  /** Where the beam's end is now (a sweeping lance slides in). */
  function endNow(rec) {
    const p = rec.p;
    if (!rec.from || reduceMotion) return rec.b;
    const k = Math.min(1, rec.t / (p.charge + p.punch * 0.5));
    if (k >= 1) return rec.b;
    const e = ease(k);
    return [rec.from[0] + (rec.b[0] - rec.from[0]) * e, rec.from[1] + (rec.b[1] - rec.from[1]) * e, rec.from[2] + (rec.b[2] - rec.from[2]) * e];
  }

  /** Pushes one beam's three layers (ink, body, core) along its path. */
  function strokesOf(rec) {
    const p = rec.p;
    const t = rec.t;
    const c = p.charge;
    const pu = p.punch;
    const h = p.hold;
    const f = fadeOf(p);
    if (t > lifeOf(p)) return;
    const b = endNow(rec);
    const pts = rec.pts || [rec.a[0], rec.a[1], rec.a[2], b[0], b[1], b[2]];
    const k = pts.length / 3 - 1;
    let len = 0;
    for (let s = 0; s < k; s++) len += Math.hypot(pts[s * 3 + 3] - pts[s * 3], pts[s * 3 + 4] - pts[s * 3 + 1], pts[s * 3 + 5] - pts[s * 3 + 2]);
    let w = rec.W;
    let head = 99;
    let tail = -99;
    let cut = 0;
    if (t < c) {
      head = (t / c) * len; // charge: a thin line racing out
      w = rec.W * 0.32;
    } else if (t < c + pu) {
      w = rec.W * (1 + (reduceMotion ? 0 : p.overshoot) * (1 - ease((t - c) / pu))); // punch: wider, settling
    } else if (t >= c + pu + h) {
      const q = Math.min(1, (t - c - pu - h) / f); // leave: thin, the tail chases the front, dashes
      w = rec.W * (1 - 0.55 * q);
      if (p.tailChase && !reduceMotion) tail = q * q * len;
      cut = q * p.erode;
    }
    const hdr = tier.hdr && bloom;
    const layers = [
      ['ink', w + p.inkWidth, rec.col.ink, SOLID, 0],
      ['body', w, rec.col.body, tier.bands ? BANDS : SOLID, 0],
      ['core', w * p.coreShare, rec.col.core, SOLID, hdr ? p.hdr : 0],
    ];
    S.seed = rec.seed;
    S.noise = 4;
    S.head = head;
    S.tail = tail;
    S.cut = cut;
    S.a = 1;
    for (const [layer, lw, col, kind, hd] of layers) {
      const dim = hdr && layer === 'body' ? BODY_UNDER_BLOOM : 1;
      S.r = col[0] * dim;
      S.g = col[1] * dim;
      S.b = col[2] * dim;
      S.kind = kind;
      S.hdr = hd;
      S.minPx = BEAM_MIN_PX[layer];
      S.bandFreq = p.bandFreq;
      S.bandSpeed = reduceMotion ? 0 : p.bandSpeed;
      let u = 0;
      for (let s = 0; s < k; s++) {
        const o = s * 3;
        const sl = Math.hypot(pts[o + 3] - pts[o], pts[o + 4] - pts[o + 1], pts[o + 5] - pts[o + 2]);
        S.ax = pts[o]; S.ay = pts[o + 1]; S.az = pts[o + 2];
        S.bx = pts[o + 3]; S.by = pts[o + 4]; S.bz = pts[o + 5];
        S.wa = lw;
        S.wb = lw;
        S.ua = u;
        S.ub = u + sl;
        u += sl;
        if (lines.push(S)) drawn++;
      }
    }
  }

  /** The inked impact lines: short strokes bursting out flat to the camera, thinning as they fly. */
  function impactLines(rec) {
    const L = rec.p.lines;
    const n = reduceMotion ? 0 : Math.min(tier.lines, rec.rays.length);
    if (!L || n <= 0 || rec.hitAt < 0) return;
    const tau = rec.t - rec.hitAt;
    if (tau >= L.life) return;
    const k = tau / L.life;
    const [x, y, z] = rec.b;
    const ink = lin(L.ink);
    const core = lin(L.color);
    S.kind = SOLID;
    S.hdr = 0;
    S.head = 99;
    S.tail = -99;
    S.cut = 0;
    S.ua = 0;
    S.ub = 1;
    S.bandFreq = 0;
    S.bandSpeed = 0;
    S.minPx = BEAM_MIN_PX.line;
    S.a = rec.hitK;
    for (const [col, extra] of [[ink, 0.018], [core, 0]]) {
      S.r = col[0];
      S.g = col[1];
      S.b = col[2];
      for (let i = 0; i < n; i++) {
        const [ang, sz] = rec.rays[i];
        const r0 = 0.16 + (0.25 + rec.W) * ease(k) * sz;
        const r1 = r0 + L.length * sz * (1 - k) * 0.8;
        const cx = Math.cos(ang);
        const cy = Math.sin(ang);
        const dx = right.x * cx + up.x * cy;
        const dy = right.y * cx + up.y * cy;
        const dz = right.z * cx + up.z * cy;
        S.ax = x + dx * r0; S.ay = y + dy * r0; S.az = z + dz * r0;
        S.bx = x + dx * r1; S.by = y + dy * r1; S.bz = z + dz * r1;
        S.wa = L.width * (1 - 0.6 * k) + extra;
        S.wb = L.width * 0.25 + extra;
        S.seed = i;
        if (lines.push(S)) drawn++;
      }
    }
  }

  /** The muzzle flare, the star, sparks, the ground ring and the scorch: quads in the existing batches. */
  function quads(rec) {
    if (!batches) return;
    const p = rec.p;
    const bbA = batches.bbA;
    const t = rec.t;
    const mz = p.muzzle;
    const mUv = mz && (R[mz.sprite] || R.glow);
    const up0 = p.charge + p.punch;
    if (mUv && bbA && t < up0) {
      const s = (mz.size + rec.W * 1.5) * (t < p.charge ? 0.5 + 0.5 * (t / p.charge) : 1 - 0.4 * ((t - p.charge) / p.punch));
      const [r, g, b] = lin(mz.color);
      bbA.push(rec.a[0], rec.a[1], rec.a[2], s, s, mUv, r, g, b, 0.9 * rec.muzK);
    }
    if (rec.hitAt < 0) return;
    const tau = t - rec.hitAt;
    const [x, y, z] = rec.b;
    const st = p.star;
    const stUv = st && (R[st.sprite] || R.star);
    if (stUv && bbA && tau < st.life) {
      const k = tau / st.life;
      const s = (st.size + rec.W * 2) * (reduceMotion ? 0.75 : k < 0.25 ? 0.6 + (k / 0.25) * 0.55 : 1.15 - (k - 0.25) * 0.8);
      const [r, g, b] = lin(st.color);
      bbA.push(x, y, z, s, s, stUv, r, g, b, (1 - k) * rec.hitK, reduceMotion ? 0 : rec.rot + tau * 4);
    }
    const body = rec.col.body;
    const ring = p.ring;
    if (tier.ring && ring && R[ring.sprite] && tau < ring.life) {
      const k = tau / ring.life;
      const s = ring.size * (0.35 + 0.65 * Math.sqrt(k)) * (1 + rec.W * 2);
      const [r, g, b] = p.ringColor ? lin(p.ringColor) : body;
      batches.groundA?.push(x, 0.05, z, s, s, R[ring.sprite], r, g, b, 0.55 * (1 - k) * rec.hitK);
    }
    const sc = p.scorch;
    if (tier.scorch && sc && R[sc.sprite] && tau < sc.life) {
      const k = tau / sc.life;
      const [r, g, b] = lin(sc.color);
      batches.groundN?.push(x, 0.045, z, sc.size * (1 + rec.W), sc.size * (1 + rec.W), R[sc.sprite], r, g, b, sc.alpha * (1 - k * k), reduceMotion ? 0 : rec.rot);
    }
    const sp = p.sparks;
    const spUv = sp && (R[sp.sprite] || R.spark);
    const count = reduceMotion ? Math.floor(tier.sparks / 2) : tier.sparks;
    if (spUv && bbA && tau < sp.life) {
      const k = tau / sp.life;
      const [r, g, b] = p.sparksColor ? lin(p.sparksColor) : body;
      // they spray back towards the girl a little (the beam's force)
      const bx = rec.a[0] - x;
      const bz = rec.a[2] - z;
      const bl = Math.hypot(bx, bz) || 1;
      for (let i = 0; i < count; i++) {
        const [ang, spd, vy, sz] = rec.sparks[i];
        const v = sp.speed * spd * (reduceMotion ? 0.5 : 1);
        const vx = Math.cos(ang) * v * 0.7 + (bx / bl) * v * 0.5;
        const vz = Math.sin(ang) * v * 0.7 + (bz / bl) * v * 0.5;
        const s = sp.size * sz * (1 - 0.5 * k);
        bbA.push(x + vx * tau, Math.max(0.05, y + vy * tau - 4.5 * tau * tau), z + vz * tau, s, s, spUv, r, g, b, 1 - k, 0);
      }
    }
  }

  const api = {
    fire,
    /** The flash guard's gate for world flashes ((size, uv, strength) → strength multiplier); set by the renderer. */
    flashGate: null,
    hold(on) {
      if (own) lines.hold(on);
    },
    setPixel(worldPerPx) {
      if (own) lines.setPixel(worldPerPx);
    },
    get mesh() {
      return lines.mesh;
    },
    /** Advances and draws (the visual clock's dt; call between the batches' begin and end). */
    update(dt) {
      time += dt;
      if (camera) {
        camera.updateMatrixWorld?.();
        right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
        up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
      }
      for (let i = live.length - 1; i >= 0; i--) {
        const rec = live[i];
        rec.t += dt;
        if (rec.t > endOf(rec) + 0.02) {
          live.splice(i, 1);
          continue;
        }
        const p = rec.p;
        if (rec.hitAt < 0 && rec.t >= p.charge) {
          rec.hitAt = rec.t;
          const st = p.star;
          rec.hitK = api.flashGate && st ? api.flashGate(st.size + rec.W * 2, R[st.sprite] || R.star, 1) : 1;
        }
        // a zig-zag lance: a new path on the beat (Reduce Motion: one still path)
        if (rec.zig > 1 && !reduceMotion && rec.t >= rec.nextStrike) {
          while (rec.t >= rec.nextStrike) rec.nextStrike += p.restrike || 0.05;
          rec.strikes++;
          rec.pts = zigzagPath(rec.a[0], rec.a[1], rec.a[2], rec.b[0], rec.b[1], rec.b[2], rec.zig, p, rnd);
        }
      }
      if (own) lines.begin();
      drawn = 0;
      for (const rec of live) strokesOf(rec);
      for (const rec of live) impactLines(rec);
      for (const rec of live) quads(rec);
      if (own) lines.end(time);
    },
    setQuality(q) {
      tierId = BEAM_TIERS[q] ? q : 'medium';
      tier = BEAM_TIERS[tierId];
    },
    /** Bloom on (high only): the core goes above white, the body stays under the grade's knee. */
    setGlow(q, on) {
      bloom = q === 'high' && !!on;
    },
    get live() {
      return live;
    },
    get stats() {
      return { beams: live.length, strokes: drawn, visible: lines.mesh.visible, tier: tierId };
    },
    clear() {
      live.length = 0;
      drawn = 0;
      if (own) {
        lines.begin();
        lines.end(time);
      }
    },
    dispose() {
      if (own) lines.dispose();
    },
  };
  return api;
}
