// Styled chain lightning (docs/VFX.md "Lightning"; display only). Every hop of a chain is a zig-zag bolt (sharp kinks,
// a fork or two) drawn in flat toon layers, back to front: a soft glow, a dark ink line, the body colour and a white-hot
// core. Each layer of each segment is a capsule (round caps, so the joints are clean) cut with a crisp anti-aliased
// edge. Each hop's leader races from girl to target in a few frames. The path is struck again on a stepped beat
// (hand-drawn crackle, no smooth wobble). The bolt leaves by erosion: it breaks into dashes and is gone. Each target
// gets a star, sparks and a ring on the ground.
//
//   const lightning = createLightningFx({ scene, batches, atlas, quality, reduceMotion, rand });
//   lightning.strike([[x, y, z], [x, y, z], …], { color })   // world points: the girl first, then each target
//   lightning.update(dt)   // the visual clock's dt, after the batches' begin() and before their end()
//
// Draw cost: one instanced draw call for every bolt (none while nothing is up), plus a few quads in the existing
// batches (stars and sparks in bbA, petals in bbN, the ground rings in groundA). Randomness: the stream it is handed
// (createVisualRandom fork); never Math.random, never the sim's. Reduce Motion: one still path per hop (no re-strike,
// no flicker), slower erosion, no turning sprites, half the sparks.
import * as THREE from 'three';
import { LIGHTNING_PRESETS, LIGHTNING_TIERS, LIGHTNING_BY_COLOR, MAX_BOLTS } from './lightningPresets.js';

const TAU = Math.PI * 2;
/** Layers, back to front (the instance order inside the one draw call: a later layer covers an earlier one). */
export const LIGHTNING_LAYERS = ['glow', 'ink', 'body', 'core'];
/** Thinnest a layer is drawn (half width, CSS px): a bolt never thins into shimmering hairs on a phone. */
export const MIN_PX = { glow: 4, ink: 2.4, body: 1.6, core: 0.8 };
/** High with bloom: the glow layer at this strength (the bloom off the core does most of the glowing). */
export const GLOW_UNDER_BLOOM = 0.45;
/** High with bloom: the body colour × this, kept under the grade's knee (src/render/vfx/grade.js) so it stays saturated. */
export const BODY_UNDER_BLOOM = 0.82;
/** The whole chain arrives within this (s): long chains hop faster. */
export const CHAIN_SPAN = 0.24;
/** Floats per collected segment (see collect()). */
const SEG = 16;

const VERT = /* glsl */`
attribute vec4 iA; // a: x, y, z, half width
attribute vec4 iB; // b: x, y, z, half width
attribute vec4 iC; // u at a, u at b (0..1 along the hop), head (the leader has reached this u), cut (erosion)
attribute vec4 iD; // linear colour, strength
attribute vec4 iE; // kind (0 solid, 1 glow), seed, hdr, thinnest half width (px)
uniform float uPx; // world units per CSS pixel (0: no floor)
varying vec2 vQ;   // the pixel in the capsule's frame: along from a, across (world units)
varying float vLen;
varying vec2 vW;
varying vec2 vU;
varying vec4 vC;   // head, cut, seed, kind
varying vec4 vCol;
varying float vHdr;
void main() {
  vec4 a = modelViewMatrix * vec4(iA.xyz, 1.0);
  vec4 b = modelViewMatrix * vec4(iB.xyz, 1.0);
  vec2 d = b.xy - a.xy;
  float len = length(d);
  vec2 dir = len > 1e-5 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float floorW = iE.w * uPx;
  float wa = max(iA.w, floorW);
  float wb = max(iB.w, floorW);
  float w = max(wa, wb);
  float s = position.x; // 0 at a, 1 at b; the quad runs one half width past each end (the round caps)
  vec2 p = mix(a.xy - dir * w, b.xy + dir * w, s) + nrm * (w * position.y);
  gl_Position = projectionMatrix * vec4(p, mix(a.z, b.z, s), 1.0);
  vQ = vec2(mix(-w, len + w, s), w * position.y);
  vLen = len;
  vW = vec2(wa, wb);
  vU = iC.xy;
  vC = vec4(iC.zw, iE.y, iE.x);
  vCol = iD;
  vHdr = iE.z;
}`;

const FRAG = /* glsl */`
varying vec2 vQ;
varying float vLen;
varying vec2 vW;
varying vec2 vU;
varying vec4 vC;
varying vec4 vCol;
varying float vHdr;
float h1(float x) { return fract(sin(x * 91.3458) * 47453.5453); }
float vn(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(h1(i), h1(i + 1.0), f);
}
void main() {
  float t = clamp(vQ.x / max(vLen, 1e-5), 0.0, 1.0);
  float dist = length(vec2(vQ.x - t * vLen, vQ.y));
  float r = mix(vW.x, vW.y, t);
  float u = mix(vU.x, vU.y, t);
  // the leader: nothing past the head yet
  float on = step(u, vC.x);
  // erosion: a hard cut through a noise along the hop (the same seed on every layer: the dashes line up)
  float n = vn(u * 9.0 + vC.z) * 0.7 + vn(u * 23.0 + vC.z * 1.7) * 0.3;
  on *= step(vC.y, n);
  float m;
  if (vC.w < 0.5) {
    float aa = fwidth(dist) * 0.75;
    m = 1.0 - smoothstep(r - aa, r + aa, dist); // a crisp toon edge, anti-aliased
  } else {
    float g = clamp(1.0 - dist / r, 0.0, 1.0);
    m = g * g;
  }
  float a = m * on * vCol.a;
  // premultiplied (One, OneMinusSrcAlpha): the solid layers cover what is behind them, the glow is added light
  gl_FragColor = vec4(vCol.rgb * (1.0 + vHdr) * a, vC.w < 0.5 ? a : 0.0);
  #include <colorspace_fragment>
}`;

/** sRGB hex → linear [r, g, b] 0..1. */
function lin(hex) {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}

/**
 * One zig-zag path from a to b: n segments, the inner joints pushed alternately to either side (sideways and a share
 * up / down), smaller near the ends. Returns [x, y, z, …] for the n + 1 joints.
 */
export function zigzagPath(ax, ay, az, bx, by, bz, n, p, rnd, jagMul = 1) {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const len = Math.hypot(dx, dy, dz);
  let sx = -dz;
  let sz = dx;
  const sl = Math.hypot(sx, sz);
  if (sl > 1e-6) {
    sx /= sl;
    sz /= sl;
  } else {
    sx = 1;
    sz = 0;
  }
  const amp = Math.min(p.jagMax, p.jag * len) * jagMul;
  const flip = rnd() < 0.5 ? 1 : -1;
  // the joints step long, short, long… along the hop: long diagonals and short sharp jogs (a drawn bolt, not a square wave)
  const skew = (p.skew ?? 0) * (rnd() < 0.5 ? 1 : -1);
  const out = [ax, ay, az];
  for (let i = 1; i < n; i++) {
    const f = Math.min(0.96, Math.max(0.04, (i + (i % 2 ? skew : -skew) + (rnd() - 0.5) * 0.2) / n));
    const env = Math.sqrt(Math.sin(Math.PI * f));
    const zig = (i % 2 ? 1 : -1) * flip * (0.55 + 0.45 * rnd());
    const o = amp * env * (zig * p.zigzag + (rnd() * 2 - 1) * (1 - p.zigzag));
    const side = o * (1 - p.lift);
    out.push(ax + dx * f + sx * side, Math.max(0.06, ay + dy * f + o * p.lift), az + dz * f + sz * side);
  }
  out.push(bx, by, bz);
  return out;
}

/**
 * @param {{ scene: THREE.Object3D, batches?: object|null, atlas?: object|null, quality?: 'high'|'medium'|'low',
 *   reduceMotion?: boolean, rand?: () => number, presets?: object }} o
 */
export function createLightningFx({ scene, batches = null, atlas = null, quality = 'medium', reduceMotion = false, rand = null, presets = LIGHTNING_PRESETS }) {
  const R = atlas?.regions || {};
  const rnd = rand || (() => 0.5);
  let tier = LIGHTNING_TIERS[quality] || LIGHTNING_TIERS.medium;
  let tierId = LIGHTNING_TIERS[quality] ? quality : 'medium';
  let bloom = false;
  const live = [];
  const max = LIGHTNING_TIERS.high.cap;
  /** Recoloured storm presets for chain colours with no preset of their own (cached by colour). */
  const tinted = new Map();

  const quad = new THREE.BufferGeometry();
  quad.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 0, 1, 0, 1, 1, 0], 3));
  quad.setIndex([0, 1, 2, 2, 1, 3]);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  const attrs = {};
  for (const k of ['iA', 'iB', 'iC', 'iD', 'iE']) {
    attrs[k] = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute(k, attrs[k]);
  }
  geo.instanceCount = 0;
  const material = new THREE.ShaderMaterial({
    uniforms: { uPx: { value: 0 } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquation: THREE.AddEquation,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 24;
  mesh.visible = false;
  mesh.name = 'lightningFx';
  scene.add(mesh);
  let held = false;
  /** Collected segments this frame (SEG floats each), grown as needed. */
  let segs = new Float32Array(1024 * SEG);

  const presetFor = (id, color) => {
    if (id && presets[id]) return { id, p: presets[id] };
    const key = String(color || '').toLowerCase();
    const mapped = LIGHTNING_BY_COLOR[key];
    if (mapped && presets[mapped]) return { id: mapped, p: presets[mapped] };
    if (!key || !presets.storm) return { id: 'storm', p: presets.storm };
    // any other chain colour: storm's shape in that colour (a white-hot core, the colour, a dark ink of its hue)
    if (!tinted.has(key)) {
      const c = new THREE.Color(key);
      const hsl = c.getHSL({});
      const ink = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 0.8 + 0.2), 0.16);
      const core = c.clone().lerp(new THREE.Color('#ffffff'), 0.85);
      const s = presets.storm;
      tinted.set(key, { ...s, label: `Storm (${key})`, body: key, glow: key, core: `#${core.getHexString()}`, ink: `#${ink.getHexString()}`, sparks: { ...s.sparks, color: key }, ground: { ...s.ground, color: key } });
    }
    return { id: 'storm', p: tinted.get(key) };
  };

  /** Live segment layers (for the detail a new bolt gets). */
  const load = () => {
    let n = 0;
    for (const b of live) n += b.segCount;
    return n * 4;
  };

  function makeHop(bolt, i, a, b) {
    const hop = { a, b, i, t0: i * bolt.hopDelay, seed: rnd() * 7, rot: rnd() * TAU, hitAt: -1, hitK: 1, sparks: [], pts: null, br: [] };
    for (let s = 0; s < LIGHTNING_TIERS.high.sparks; s++) hop.sparks.push([rnd() * TAU, 0.6 + 0.6 * rnd(), 0.5 + rnd(), 0.7 + 0.6 * rnd()]);
    strikeHop(bolt, hop);
    return hop;
  }

  /** A new path for one hop (its leader, kinks and forks): at spawn, and on every re-strike. */
  function strikeHop(bolt, hop) {
    const p = bolt.p;
    const [ax, ay, az] = hop.a;
    const [bx, by, bz] = hop.b;
    const n = bolt.n;
    hop.pts = zigzagPath(ax, ay, az, bx, by, bz, n, p, rnd);
    hop.w = p.width * Math.max(0.6, 1 - p.hopThin * hop.i) * (0.88 + 0.24 * rnd());
    hop.br.length = 0;
    const len = Math.hypot(bx - ax, by - ay, bz - az);
    const hl = Math.hypot(bx - ax, bz - az);
    const nb = Math.round(bolt.branches * (p.branch ?? 1));
    for (let k = 0; k < nb && n > 1 && len > 0.3; k++) {
      const j = 1 + Math.floor(rnd() * (n - 1));
      const fx = hop.pts[j * 3];
      const fy = hop.pts[j * 3 + 1];
      const fz = hop.pts[j * 3 + 2];
      const hx = hl > 1e-4 ? (bx - ax) / hl : 1;
      const hz = hl > 1e-4 ? (bz - az) / hl : 0;
      const ang = (rnd() < 0.5 ? -1 : 1) * (0.35 + 0.45 * rnd());
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const L = len * (p.branchLen[0] + (p.branchLen[1] - p.branchLen[0]) * rnd());
      const ex = fx + (hx * c - hz * s) * L;
      const ez = fz + (hx * s + hz * c) * L;
      const ey = Math.max(0.06, fy - L * (0.12 + 0.25 * rnd()));
      const u0 = j / n;
      hop.br.push({ pts: zigzagPath(fx, fy, fz, ex, ey, ez, bolt.bn, p, rnd, 0.8), u0, u1: u0 + L / Math.max(len, 1e-4) });
    }
  }

  /**
   * Strikes a chain. points: world [x, y, z] for the girl, then each target in order. opts: { preset, color, forks }
   * (forks: extra forks per hop on tiers that fork at all, e.g. Raika's Forked path).
   * @returns {object|null} the bolt's record (live, read-only)
   */
  function strike(points, { preset = null, color = null, forks = 0 } = {}) {
    if (!Array.isArray(points) || points.length < 2) return null;
    const { id, p } = presetFor(preset, color);
    if (!p) return null;
    if (live.length >= MAX_BOLTS) live.shift();
    const hops = points.length - 1;
    // busy board: fewer kinks, no forks (the cap is never the thing that cuts a bolt short)
    const busy = load() / tier.cap;
    const n = busy > 0.9 ? 3 : busy > 0.6 ? Math.max(3, tier.segs - 2) : tier.segs;
    const branches = busy > 0.6 || tier.branches <= 0 ? 0 : Math.min(3, tier.branches + Math.max(0, forks | 0));
    const bolt = {
      id, p, t: 0, n, bn: Math.max(2, tier.branchSegs), branches, hops: [],
      hopDelay: Math.min(p.hopDelay, CHAIN_SPAN / hops), strikes: 0, nextStrike: p.restrike,
      col: { glow: lin(p.glow), ink: lin(p.ink), body: lin(p.body), core: lin(p.core) },
      segCount: 0,
    };
    for (let i = 0; i < hops; i++) bolt.hops.push(makeHop(bolt, i, points[i].slice(0, 3), points[i + 1].slice(0, 3)));
    bolt.segCount = hops * (n + branches * bolt.bn);
    live.push(bolt);
    return bolt;
  }

  // timings (Reduce Motion: a slower erosion)
  const fadeOf = (p) => p.fade * (reduceMotion ? 1.6 : 1);
  const hopEnd = (p) => p.grow + p.hold + fadeOf(p);
  const fxEnd = (p) => Math.max(p.star?.life ?? 0, p.sparks?.life ?? 0, p.ground?.life ?? 0);
  const boltEnd = (bolt) => (bolt.hops.length - 1) * bolt.hopDelay + Math.max(hopEnd(bolt.p), bolt.p.grow + fxEnd(bolt.p));

  /** Collects every drawn segment of every live bolt into `segs` (SEG floats each); returns the count. */
  function collect() {
    let n = 0;
    const need = (k) => {
      if ((n + k) * SEG > segs.length) {
        const g = new Float32Array(Math.max(segs.length * 2, (n + k) * SEG));
        g.set(segs);
        segs = g;
      }
    };
    for (let bi = 0; bi < live.length; bi++) {
      const bolt = live[bi];
      const p = bolt.p;
      const fade = fadeOf(p);
      const coreA = reduceMotion ? 1 : 1 - (p.flicker || 0) * (bolt.strikes % 2);
      for (const hop of bolt.hops) {
        const age = bolt.t - hop.t0;
        if (age < 0 || age > hopEnd(p)) continue;
        const head = p.grow > 0 ? age / p.grow : 99;
        const cut = age > p.grow + p.hold ? Math.min(1.05, ((age - p.grow - p.hold) / fade) * 1.05) : 0;
        const shrink = 1 - 0.35 * cut;
        const lines = [[hop.pts, 0, 1, hop.w, hop.w * p.taper], ...hop.br.map((b) => [b.pts, b.u0, b.u1, hop.w * (1 + (p.taper - 1) * b.u0) * 0.55, hop.w * 0.2])];
        for (const [pts, u0, u1, w0, w1] of lines) {
          const k = pts.length / 3 - 1;
          need(k);
          for (let s = 0; s < k; s++) {
            const fa = s / k;
            const fb = (s + 1) / k;
            const o = n * SEG;
            segs[o] = pts[s * 3]; segs[o + 1] = pts[s * 3 + 1]; segs[o + 2] = pts[s * 3 + 2];
            segs[o + 3] = pts[s * 3 + 3]; segs[o + 4] = pts[s * 3 + 4]; segs[o + 5] = pts[s * 3 + 5];
            segs[o + 6] = (w0 + (w1 - w0) * fa) * shrink;
            segs[o + 7] = (w0 + (w1 - w0) * fb) * shrink;
            segs[o + 8] = u0 + (u1 - u0) * fa;
            segs[o + 9] = u0 + (u1 - u0) * fb;
            segs[o + 10] = head;
            segs[o + 11] = cut;
            segs[o + 12] = hop.seed;
            segs[o + 13] = bi;
            segs[o + 14] = coreA;
            segs[o + 15] = hop.w;
            n++;
          }
        }
      }
    }
    return n;
  }

  /** Writes the collected segments as instances, layer by layer (back to front); returns the instance count. */
  function write(count) {
    const layers = LIGHTNING_LAYERS.filter((l) => l !== 'glow' || tier.glow);
    // over the cap: the glow goes first, then the newest segments (the bolts are short-lived)
    let use = layers;
    if (count * use.length > tier.cap && use[0] === 'glow') use = use.slice(1);
    const per = Math.min(count, Math.floor(tier.cap / use.length));
    const hdr = tier.hdr && bloom;
    const A = attrs.iA.array;
    const B = attrs.iB.array;
    const C = attrs.iC.array;
    const D = attrs.iD.array;
    const E = attrs.iE.array;
    let j = 0;
    for (const layer of use) {
      const kind = layer === 'glow' ? 1 : 0;
      const minPx = MIN_PX[layer];
      for (let s = 0; s < per; s++) {
        const o = s * SEG;
        const bolt = live[segs[o + 13]];
        const p = bolt.p;
        if (kind && !(p.glowAlpha > 0)) continue; // (no glow layer for this preset)
        const wa = segs[o + 6];
        const wb = segs[o + 7];
        const ref = segs[o + 15] || 1;
        let ka = wa;
        let kb = wb;
        let alpha = 1;
        if (layer === 'glow') {
          ka = wa * p.glowWidth;
          kb = wb * p.glowWidth;
          alpha = p.glowAlpha * (hdr ? GLOW_UNDER_BLOOM : 1);
        } else if (layer === 'ink') {
          // (thinner with the bolt, but a fork keeps a visible line)
          ka = wa + p.inkWidth * Math.max(0.7, wa / ref);
          kb = wb + p.inkWidth * Math.max(0.7, wb / ref);
        } else if (layer === 'core') {
          ka = wa * p.coreShare;
          kb = wb * p.coreShare;
          alpha = segs[o + 14];
        }
        const c = bolt.col[layer];
        const dim = hdr && layer === 'body' ? BODY_UNDER_BLOOM : 1;
        const q = j * 4;
        A[q] = segs[o]; A[q + 1] = segs[o + 1]; A[q + 2] = segs[o + 2]; A[q + 3] = ka;
        B[q] = segs[o + 3]; B[q + 1] = segs[o + 4]; B[q + 2] = segs[o + 5]; B[q + 3] = kb;
        C[q] = segs[o + 8]; C[q + 1] = segs[o + 9]; C[q + 2] = segs[o + 10]; C[q + 3] = segs[o + 11];
        D[q] = c[0] * dim; D[q + 1] = c[1] * dim; D[q + 2] = c[2] * dim; D[q + 3] = alpha;
        E[q] = kind; E[q + 1] = segs[o + 12]; E[q + 2] = layer === 'core' && hdr ? p.hdr : 0; E[q + 3] = minPx;
        j++;
      }
    }
    return j;
  }

  /** The point at u (0..1) along a hop's main path. */
  function along(pts, u) {
    const k = pts.length / 3 - 1;
    const f = Math.max(0, Math.min(1, u)) * k;
    const s = Math.min(k - 1, Math.floor(f));
    const t = f - s;
    return [pts[s * 3] + (pts[s * 3 + 3] - pts[s * 3]) * t, pts[s * 3 + 1] + (pts[s * 3 + 4] - pts[s * 3 + 1]) * t, pts[s * 3 + 2] + (pts[s * 3 + 5] - pts[s * 3 + 2]) * t];
  }

  /** Stars, sparks, ground rings, the leader's tip and the girl's flare: quads in the existing batches. */
  function quads(bolt) {
    if (!batches) return;
    const p = bolt.p;
    const bbA = batches.bbA;
    const glowUv = R.glow;
    // the girl's flare while the first hop is up (small and lingering: not a flash)
    const h0 = bolt.hops[0];
    const a0 = bolt.t - h0.t0;
    const up = p.grow + p.hold;
    if (glowUv && bbA && a0 >= 0 && a0 < up && p.source) {
      const [r, g, b] = lin(p.source.color);
      bbA.push(h0.a[0], h0.a[1], h0.a[2], p.source.size, p.source.size, glowUv, r, g, b, 0.85 * (1 - a0 / up));
    }
    for (const hop of bolt.hops) {
      const age = bolt.t - hop.t0;
      if (age < 0) continue;
      // the leader's tip
      if (age < p.grow && glowUv && bbA) {
        const [x, y, z] = along(hop.pts, age / p.grow);
        const [r, g, b] = bolt.col.core;
        bbA.push(x, y, z, 0.2, 0.2, glowUv, r, g, b, 0.9);
      }
      if (age < p.grow) continue;
      if (hop.hitAt < 0) {
        hop.hitAt = bolt.t;
        // the star is a bright, short flash on the board: it asks the flash guard (src/render/vfx/flashGuard.js)
        hop.hitK = api.flashGate && p.star ? api.flashGate(p.star.size, R[p.star.sprite] || R.star, 1) : 1;
      }
      const tau = bolt.t - hop.hitAt;
      const [x, y, z] = hop.b;
      const st = p.star;
      const stUv = st && (R[st.sprite] || R.star);
      if (stUv && bbA && tau < st.life) {
        const k = tau / st.life;
        const s = st.size * (reduceMotion ? 0.75 : k < 0.3 ? 0.6 + (k / 0.3) * 0.5 : 1.1 - (k - 0.3) * 0.7);
        const [r, g, b] = lin(st.color);
        bbA.push(x, y, z, s, s, stUv, r, g, b, (1 - k) * hop.hitK, reduceMotion ? 0 : hop.rot + tau * 5);
      }
      const gr = p.ground;
      if (tier.ground && gr && R[gr.sprite] && tau < gr.life) {
        const k = tau / gr.life;
        const s = gr.size * (0.35 + 0.65 * Math.sqrt(k));
        const [r, g, b] = lin(gr.color);
        batches.groundA?.push(x, 0.05, z, s, s, R[gr.sprite], r, g, b, 0.55 * (1 - k) * hop.hitK);
      }
      const sp = p.sparks;
      const spUv = sp && (R[sp.sprite] || R.spark);
      const batch = sp?.additive ? bbA : batches.bbN;
      const count = reduceMotion ? Math.floor(tier.sparks / 2) : tier.sparks;
      if (spUv && batch && tau < sp.life) {
        const k = tau / sp.life;
        const [r, g, b] = lin(sp.color);
        for (let i = 0; i < count; i++) {
          const [ang, spd, vy, sz] = hop.sparks[i];
          const v = sp.speed * spd * (reduceMotion ? 0.5 : 1);
          const s = sp.size * sz * (1 - 0.5 * k);
          batch.push(x + Math.cos(ang) * v * tau, Math.max(0.05, y + vy * tau - 4.5 * tau * tau), z + Math.sin(ang) * v * tau, s, s, spUv, r, g, b, 1 - k, sp.additive || reduceMotion ? 0 : ang + tau * 6);
        }
      }
    }
  }

  const api = {
    strike,
    /** The flash guard's gate for world flashes ((size, uv, strength) → strength multiplier); set by the renderer. */
    flashGate: null,
    /** Impact frames: the bolts sit them out (update() keeps the mesh hidden while held). */
    hold(on) {
      held = !!on;
      if (held) mesh.visible = false;
    },
    /** World units per CSS pixel (the camera rig's scale): the thinnest a layer is drawn. */
    setPixel(worldPerPx) {
      material.uniforms.uPx.value = worldPerPx > 0 ? worldPerPx : 0;
    },
    get mesh() {
      return mesh;
    },
    /** Advances and draws (the visual clock's dt; call between the batches' begin and end). */
    update(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const bolt = live[i];
        bolt.t += dt;
        if (bolt.t > boltEnd(bolt) + 0.02) {
          live.splice(i, 1);
          continue;
        }
        // the stepped crackle: a new path on the beat (Reduce Motion: one still path)
        if (!reduceMotion && bolt.p.restrike > 0 && bolt.t >= bolt.nextStrike) {
          while (bolt.t >= bolt.nextStrike) bolt.nextStrike += bolt.p.restrike;
          bolt.strikes++;
          for (const hop of bolt.hops) {
            const age = bolt.t - hop.t0;
            if (age >= 0 && age <= hopEnd(bolt.p)) strikeHop(bolt, hop);
          }
        }
      }
      const count = collect();
      const n = count ? write(count) : 0;
      for (const bolt of live) quads(bolt);
      geo.instanceCount = n;
      for (const a of Object.values(attrs)) {
        a.clearUpdateRanges();
        if (n) a.addUpdateRange(0, n * 4);
        a.needsUpdate = n > 0;
      }
      mesh.visible = n > 0 && !held;
    },
    setQuality(q) {
      tierId = LIGHTNING_TIERS[q] ? q : 'medium';
      tier = LIGHTNING_TIERS[tierId];
    },
    /** Bloom on (high only): the core goes above white, the glow layer steps back. */
    setGlow(q, on) {
      bloom = q === 'high' && !!on;
    },
    get live() {
      return live;
    },
    get stats() {
      return { bolts: live.length, instances: geo.instanceCount, visible: mesh.visible, tier: tierId };
    },
    clear() {
      live.length = 0;
      geo.instanceCount = 0;
      mesh.visible = false;
    },
    dispose() {
      scene.remove(mesh);
      geo.dispose();
      quad.dispose();
      material.dispose();
    },
  };
  return api;
}
