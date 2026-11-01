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

  /** A preset, or a preset (laser when none) in a colour: the body that colour, a dark ink of its hue, a white-hot core. */
  const presetFor = (id, color) => {
    const named = id && presets[id] ? id : null;
    const key = String(color || '').toLowerCase();
    if (named && !key) return { id: named, p: presets[named] };
    const baseId = named || 'laser';
    const base = presets[baseId];
    if (!key) return { id: baseId, p: base };
    const tk = `${baseId}|${key}`;
    if (!tinted.has(tk)) {
      const c = new THREE.Color(key);
      const hsl = c.getHSL({});
      const ink = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 0.8 + 0.2), 0.14);
      const core = c.clone().lerp(new THREE.Color('#ffffff'), 0.88);
      tinted.set(tk, { ...base, label: `${base.label} (${key})`, body: key, ink: `#${ink.getHexString()}`, core: `#${core.getHexString()}`, lines: { ...base.lines, ink: `#${ink.getHexString()}` } });
    }
    return { id: baseId, p: tinted.get(tk) };
  };

  /**
   * Fires a beam from a to b (world [x, y, z]). opts: width (the sim's beam width) and widthScale, color (the preset,
   * or laser, in that colour), preset, from (a sweeping lance: its end slides in from here), zig (kinks: a zig-zag lance).
   * @returns {object|null} the beam's record (live, read-only)
   */
  function fire(a, b, { width = 0.2, widthScale = 1, color = null, preset = null, from = null, zig = null } = {}) {
    if (!a || !b) return null;
    const { id, p } = presetFor(preset, color);
    if (!p) return null;
    if (live.length >= MAX_BEAMS) live.shift();
    const rec = {
      id, p, a: [a[0], a[1], a[2]], b: [b[0], b[1], b[2]], from: from ? [from[0], from[1], from[2]] : null,
      W: Math.max(0.05, BEAM_HALF.base + BEAM_HALF.per * width) * (p.width ?? 1) * Math.max(0.5, widthScale),
      t: 0, seed: rnd() * 7, zig: Math.max(0, (zig ?? p.zig) | 0), pts: null, strikes: 0, nextStrike: p.restrike || 0.05,
      hitAt: -1, hitK: 1, muzK: 1, rot: rnd() * TAU, rays: [], sparks: [],
      col: { ink: lin(p.ink), body: lin(p.body), core: lin(p.core) },
      // (the sprites' and lines' colours, once: never parsed again per frame)
      fx: {
        muzzle: lin(p.muzzle?.color || '#ffffff'), star: lin(p.star?.color || '#ffffff'),
        ring: p.ringColor ? lin(p.ringColor) : null, scorch: lin(p.scorch?.color || '#000000'),
        sparks: p.sparksColor ? lin(p.sparksColor) : null, lineInk: lin(p.lines?.ink || '#000000'), lineCore: lin(p.lines?.color || '#ffffff'),
      },
      // (this frame's path and beats: worked out once, drawn layer by layer)
      st: { pts: null, k: 0, len: 0, w: 0, head: 99, tail: -99, cut: 0, on: false },
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

  /** A straight beam's path now, into its own buffer (a sweeping lance's end slides in). */
  function lineNow(rec) {
    const p = rec.p;
    const L = rec.line || (rec.line = new Float64Array(6));
    L[0] = rec.a[0];
    L[1] = rec.a[1];
    L[2] = rec.a[2];
    const k = !rec.from || reduceMotion ? 1 : Math.min(1, rec.t / (p.charge + p.punch * 0.5));
    const e = k >= 1 ? 1 : ease(k);
    for (let i = 0; i < 3; i++) L[3 + i] = k >= 1 ? rec.b[i] : rec.from[i] + (rec.b[i] - rec.from[i]) * e;
    return L;
  }

  /** Works out one beam's path and beats for this frame (rec.st); false when it is not drawn. */
  function state(rec) {
    const st = rec.st;
    const p = rec.p;
    const t = rec.t;
    const c = p.charge;
    const pu = p.punch;
    const h = p.hold;
    const f = fadeOf(p);
    st.on = t <= lifeOf(p);
    if (!st.on) return false;
    const pts = rec.pts || lineNow(rec);
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
    st.pts = pts;
    st.k = k;
    st.len = len;
    st.w = w;
    st.head = head;
    st.tail = tail;
    st.cut = cut;
    return true;
  }

  /** Every drawn beam's layer `layer` (0 ink, 1 body, 2 core): all the inks, then all the bodies, then all the cores. */
  function layerOf(list, layer) {
    const hdr = tier.hdr && bloom;
    S.a = 1;
    S.noise = 4;
    S.kind = layer === 1 && tier.bands ? BANDS : SOLID;
    S.minPx = layer === 0 ? BEAM_MIN_PX.ink : layer === 1 ? BEAM_MIN_PX.body : BEAM_MIN_PX.core;
    for (const rec of list) {
      const st = rec.st;
      const p = rec.p;
      const col = layer === 0 ? rec.col.ink : layer === 1 ? rec.col.body : rec.col.core;
      const dim = hdr && layer === 1 ? BODY_UNDER_BLOOM : 1;
      const lw = layer === 0 ? st.w + p.inkWidth : layer === 1 ? st.w : st.w * p.coreShare;
      S.r = col[0] * dim;
      S.g = col[1] * dim;
      S.b = col[2] * dim;
      S.hdr = layer === 2 && hdr ? p.hdr : 0;
      S.bandFreq = p.bandFreq;
      S.bandSpeed = reduceMotion ? 0 : p.bandSpeed;
      S.seed = rec.seed;
      S.head = st.head;
      S.tail = st.tail;
      S.cut = st.cut;
      const pts = st.pts;
      let u = 0;
      for (let s = 0; s < st.k; s++) {
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

  /** How many impact lines a beam bursts into now (0: none). */
  function raysOf(rec) {
    const L = rec.p.lines;
    if (!L || reduceMotion || rec.hitAt < 0 || rec.t - rec.hitAt >= L.life) return 0;
    return Math.min(tier.lines, rec.rays.length);
  }

  /** The inked impact lines of every landing beam (all the inks, then all the cores): bursting out flat to the camera. */
  function impactLines(list) {
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
    for (let layer = 0; layer < 2; layer++) {
      for (const rec of list) {
        const n = raysOf(rec);
        if (!n) continue;
        const L = rec.p.lines;
        const k = (rec.t - rec.hitAt) / L.life;
        const [x, y, z] = rec.b;
        const col = layer === 0 ? rec.fx.lineInk : rec.fx.lineCore;
        const extra = layer === 0 ? 0.018 : 0;
        S.r = col[0];
        S.g = col[1];
        S.b = col[2];
        S.a = rec.hitK;
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
      const [r, g, b] = rec.fx.muzzle;
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
      const [r, g, b] = rec.fx.star;
      bbA.push(x, y, z, s, s, stUv, r, g, b, (1 - k) * rec.hitK, reduceMotion ? 0 : rec.rot + tau * 4);
    }
    const body = rec.col.body;
    const ring = p.ring;
    if (tier.ring && ring && R[ring.sprite] && tau < ring.life) {
      const k = tau / ring.life;
      const s = ring.size * (0.35 + 0.65 * Math.sqrt(k)) * (1 + rec.W * 2);
      const [r, g, b] = rec.fx.ring || body;
      batches.groundA?.push(x, 0.05, z, s, s, R[ring.sprite], r, g, b, 0.55 * (1 - k) * rec.hitK);
    }
    const sc = p.scorch;
    if (tier.scorch && sc && R[sc.sprite] && tau < sc.life) {
      const k = tau / sc.life;
      const [r, g, b] = rec.fx.scorch;
      batches.groundN?.push(x, 0.045, z, sc.size * (1 + rec.W), sc.size * (1 + rec.W), R[sc.sprite], r, g, b, sc.alpha * (1 - k * k), reduceMotion ? 0 : rec.rot);
    }
    const sp = p.sparks;
    const spUv = sp && (R[sp.sprite] || R.spark);
    const count = reduceMotion ? Math.floor(tier.sparks / 2) : tier.sparks;
    if (spUv && bbA && tau < sp.life) {
      const k = tau / sp.life;
      const [r, g, b] = rec.fx.sparks || body;
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

  /** Draws every beam: their paths and beats once, then layer by layer, trimmed to the strokes' room (lines first). */
  const DRAW = [];
  function draw() {
    drawn = 0;
    DRAW.length = 0;
    let need = 0;
    let rays = 0;
    for (const rec of live) {
      if (!state(rec)) continue;
      DRAW.push(rec);
      need += rec.st.k * 3;
      rays += raysOf(rec) * 2;
    }
    let room = lines.room ? lines.room() : Infinity;
    // short of room: the impact lines go first, then the newest beams (a beam keeps all three layers or is not drawn)
    const withRays = need + rays <= room;
    while (DRAW.length && need > room) need -= DRAW.pop().st.k * 3;
    for (let layer = 0; layer < 3; layer++) layerOf(DRAW, layer);
    if (withRays) impactLines(DRAW);
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
      draw();
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
