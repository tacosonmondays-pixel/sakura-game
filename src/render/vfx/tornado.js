// Stylized tornado VFX (docs/VFX.md "Tornado"; display only). A column of flat rings that rise from the ground,
// grow wider, twist round a helix and sway on X/Z, each ring a band of painted noise cut by an erosion threshold that
// rises with its age (hard toon edge, no discard), coloured through a stepped ramp (nearest filter: flat toon bands).
// Premultiplied blend (One, OneMinusSrcAlpha). Medium and low: the cooler bands cover the board a little so the colour
// reads on a bright day, the band at k ≥ 0.8 (the top of the yellow, the white) is pure added light. High ("cover"):
// every band covers the board in its own colour (no red-over-green murk), its far arc eroded harder so what stands behind
// stays visible. With bloom on, high renders into the linear composer, where covering rings settle on the ramp's own
// colours, so it reads its own ramp row: the hot bands brighter by COVER_GAIN (the overshoot medium gets from adding on
// the screen), except at the very back of the funnel, which keeps the preset's own colours (amber, not a thin lime; the
// back's sides can still read yellow-green over grass greener than the game's); the k ≥ 0.8 band also goes `hdr` over
// white for the bloom. With bloom off, high draws on the canvas like medium and keeps the bands as given. Reduce Motion
// dims what medium and low add. High is eroded instead of thinned (RM_COVER): with bloom its cover adds no light in the
// linear composer and a thinner lemon over grass reads lime; with bloom off erosion only takes tongues away. Either way
// what stands behind a column that stands still stays readable.
//
//   const tornado = createTornadoFx({ scene, batches, atlas, quality, reduceMotion, rand });
//   tornado.spawn('fire', x, z, { seconds: 2, size: 1.2 });   // world x / z (the sim's x / y), the cast's radius
//   tornado.update(dt)    // the visual clock's dt, after the batches' begin() and before their end()
//
// Draw cost: one instanced draw call for every ring of every tornado (none while nothing is up), plus a few quads
// in the existing batches (the glowing ground ring in groundA, embers in bbA / petals in bbN). Every ring is born
// after the cast and none after it ends, so the column builds from the ground up and leaves by rising away.
// Randomness: the stream it is handed (createVisualRandom fork); never Math.random, never the sim's.
import * as THREE from 'three';
import { TORNADO_PRESETS, TORNADO_TIERS, MAX_TORNADOES } from './tornadoPresets.js';

const TAU = Math.PI * 2;
const RAMP_W = 8;
const NOISE_N = 128;
/**
 * High has more rings than medium, so each one is sparser: its erosion threshold starts this much higher × (1 − medium's
 * rings ÷ high's), the same for every ring of the tier (a uniform). It changes the shape only, never the colour: the
 * colour index still comes from the preset's own erosion.
 */
export const SPARSE_ERODE = 0.32;
/** High's cover blend: a ring's strength on the far arc and the near arc (the far arc fainter: it is behind). */
export const COVER_FRONT = [0.45, 0.85];
/** …and a young ring's share of it (the low rings where the walkers are stay faint: readable, never a light blob). */
export const COVER_YOUNG = 0.35;
/**
 * High's cover ramp: each band's colour × this gain in display (sRGB) bytes, clamped. Medium's hot bands are stacked
 * rings adding up on the screen (its yellow overshoots to lemon, its cream to white); covering rings never add, so high's
 * own ramp row carries that overshoot, one gain per band, coolest → hottest.
 */
export const COVER_GAIN = [1, 1.1, 1.25, 1.65, 1.9];
/** High's cover blend: how much harder the far arc erodes (fewer tongues behind the column: what stands behind stays visible). */
export const COVER_FAR_ERODE = 0.4;
/**
 * High under Reduce Motion (with bloom or without): the rings stand still, so what stands behind and inside a column
 * that is fully up must stay at least as readable as on medium. The column is eroded instead of thinned (a thinner
 * lemon over grass reads lime): every ring `all` harder, the far arc `far` harder still, and the colour index follows
 * the extra erosion (`all`), so the tongues that are left keep the whole ramp instead of only its hottest bands.
 */
export const RM_COVER = { far: 0.3, all: 0.22 };

const VERT = /* glsl */`
attribute vec4 iA; // x, z, t (seconds since the cast), seconds the column is fed
attribute vec4 iB; // phase, rnd, core (0/1), ramp row (v)
attribute vec4 iC; // r0, r1, height, twist
attribute vec4 iD; // sway, swayHz, spin, life
attribute vec4 iE; // helix, inner, alpha, hdr
attribute vec4 iF; // noise u, noise v, scroll, core heat
attribute vec4 iG; // erode young, erode old, body (cover), core radius share
varying vec2 vXZ;
varying float vAge;
varying float vOn;
varying vec4 vE;
varying vec4 vF;
varying vec4 vG;
varying float vRow;
varying float vRnd;
varying float vCore;
varying float vFront;
void main() {
  float t = iA.z;
  float life = iD.w;
  // the ring's age; it was born at t - age·life: only rings born inside the cast are drawn
  float age = fract(t / life + iB.x);
  float born = t - age * life;
  vOn = step(0.0, born) * step(born, iA.w);
  float g = pow(age, 0.7);
  float core = iB.z;
  float r = mix(iC.x, iC.y, g) * mix(1.0, iG.w, core);
  float a = iB.y * 6.2831853 + t * iD.z - age * iC.w;
  float c = cos(a), s = sin(a);
  vec2 p = position.xz * r;
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  // the helix: ring centres wander round the axis, more the higher they are
  float ha = t * iD.z * 0.6 + age * iC.w * 0.5 + iB.y * 6.2831853;
  vec2 helix = iE.x * g * vec2(cos(ha), sin(ha));
  vec2 sway = iD.x * g * vec2(sin(t * iD.y * 6.2831853 + age * 3.0), cos(t * iD.y * 5.1 + age * 2.6));
  vec3 wp = vec3(iA.x + p.x + helix.x + sway.x, 0.06 + age * iC.z, iA.y + p.y + helix.y + sway.y);
  // the arc facing the camera (+z) burns brighter, the far arc dimmer: the column reads as a funnel, not a stack
  vFront = 0.5 + 0.5 * (p.y / max(r, 1e-3));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(wp, 1.0);
  // the ring's own (unrotated) position: the angle is taken per pixel (no seam where atan wraps)
  vXZ = position.xz;
  vAge = age;
  vE = iE;
  vF = iF;
  vG = iG;
  vRow = iB.w;
  vRnd = iB.y;
  vCore = core;
}`;

const FRAG = /* glsl */`
uniform sampler2D uNoise;
uniform sampler2D uRamp;
uniform float uTime;
uniform float uSparse; // the tier's sparser erosion (high): the mask only, never the colour
uniform float uCover;  // 1 on high: every band covers the board in its own colour (see the header)
uniform vec2 uFront;   // COVER_FRONT
uniform float uYoung;  // COVER_YOUNG
uniform float uFar;    // COVER_FAR_ERODE
uniform vec2 uRm;      // high under Reduce Motion: RM_COVER (far, all); (0, 0) otherwise
varying vec2 vXZ;
varying float vAge;
varying float vOn;
varying vec4 vE;
varying vec4 vF;
varying vec4 vG;
varying float vRow;
varying float vRnd;
varying float vCore;
varying float vFront;
void main() {
  float d = length(vXZ);
  float vD = (d - vE.y) / (1.0 - vE.y); // 0 at the preset's hole, 1 at the rim
  // the flame band across the ring (0 at its edges, 1 in its middle; inside the hole it is negative: nothing)
  float x = vD * 2.0 - 1.0;
  float band = 1.0 - x * x;
  float u = atan(vXZ.y, vXZ.x) / 6.2831853 + vRnd; // whole-number u scales: the noise wraps seamlessly
  vec2 uv = vec2(u * vF.x, vD * vF.y - vAge * 0.9 - uTime * vF.z * 0.35);
  float n = texture2D(uNoise, uv).r * 0.85 + texture2D(uNoise, uv * vec2(2.0, 1.7) + vec2(0.37, uTime * vF.z * 0.2)).g * 0.15;
  n = smoothstep(0.25, 0.75, n); // bolder: fewer, bigger tongues
  float heat = band * (0.3 + 1.0 * n) + vCore * vF.w;
  float cut = mix(vG.x, vG.y, vAge); // the preset's erosion
  // the hard toon edge: in or out, no soft fringe and no discard (high's far arc erodes harder: it is behind)
  float m = step(cut + uSparse + (uFar + uRm.x) * (1.0 - vFront) + uRm.y, heat) * step(0.0, band);
  // the colour index from the preset's erosion (the tier's sparser mask never darkens it)
  float k = clamp((heat - cut - uRm.y) * 1.6, 0.0, 0.999) * mix(0.7, 1.0, vFront);
  vec3 col = texture2D(uRamp, vec2(k, vRow)).rgb;
  float hot = step(0.8, k);
  // the band at k ≥ 0.8 (the top of the yellow, the white) burns above white (high + bloom: vE.w > 0)
  col *= 1.0 + vE.w * hot;
  float fade = smoothstep(0.0, 0.1, vAge) * (1.0 - smoothstep(0.82, 1.0, vAge));
  if (uCover > 0.5) {
    // high: a toon layer over the board in its own colour (premultiplied over: in the linear composer, high with bloom,
    // stacked rings settle on the ramp colour; on the canvas, bloom off, the output's encoding lifts them like medium's)
    // On the cover row (the upper half of the ramp), the very back of the funnel (vFront < 0.2) takes the preset's own
    // colours, blending into the cover row's towards the sides: amber there, where a thin lemon over grass would read lime
    if (vRow > 0.5) col = mix(texture2D(uRamp, vec2(k, vRow - 0.5)).rgb * (1.0 + vE.w * hot), col, smoothstep(0.0, 0.2, vFront));
    float A = m * fade * vOn * vE.z * mix(uFront.x, uFront.y, vFront) * mix(uYoung, 1.0, smoothstep(0.12, 0.45, vAge));
    gl_FragColor = vec4(col * A, A);
    #include <colorspace_fragment>
    return;
  }
  float a = m * fade * vOn * mix(0.35, 1.0, vFront);
  // premultiplied (One, OneMinusSrcAlpha): the cooler bands cover the board a little (body: the colour reads on a
  // bright day), the band at k ≥ 0.8 is purely added light (alpha 0): one draw call gives the toon body and the glow.
  // Readability: the low rings (where the walkers are) and the near arc cover little, so the crowd stays visible.
  float body = vG.z * (1.0 - step(0.8, k)) * (1.0 - vCore) * smoothstep(0.12, 0.45, vAge) * mix(1.0, 0.45, vFront);
  gl_FragColor = vec4(col * a * vE.z, a * body);
  #include <colorspace_fragment>
}`;

/** sRGB hex → linear [r, g, b] 0..1 (the batches take linear colours; the ramp is painted as sRGB bytes). */
function lin(hex) {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}

/** Tileable value noise (0..255), two octave sets in R and G: painted once, no image files. */
export function paintTornadoNoise(n = NOISE_N, seed = 7) {
  const hash = (x, y, s) => {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const value = (x, y, period, s) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    let fx = x - xi;
    let fy = y - yi;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const w = (i) => ((i % period) + period) % period;
    const a = hash(w(xi), w(yi), s);
    const b = hash(w(xi + 1), w(yi), s);
    const c = hash(w(xi), w(yi + 1), s);
    const d = hash(w(xi + 1), w(yi + 1), s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  const fbm = (u, v, base, oct, s) => {
    let sum = 0;
    let amp = 0.5;
    let tot = 0;
    for (let o = 0; o < oct; o++) {
      const p = base << o;
      sum += value(u * p, v * p, p, s + o) * amp;
      tot += amp;
      amp *= 0.5;
    }
    return sum / tot;
  };
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / n;
      const v = y / n;
      const i = (y * n + x) * 4;
      data[i] = Math.round(fbm(u, v, 4, 3, seed) * 255);
      data[i + 1] = Math.round(fbm(u, v, 8, 2, seed + 11) * 255);
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
  }
  return data;
}

/**
 * The ramp: two rows per preset, RAMP_W texels, the preset's bands spread evenly (flat steps). Rows 0…n−1 are the bands
 * as given (sRGB hex, painted as sRGB bytes: the texture is decoded once, on the GPU); rows n…2n−1 are high's cover rows
 * (each band × COVER_GAIN in display bytes, clamped: the overshoot medium gets from adding).
 */
export function paintTornadoRamp(ids, presets = TORNADO_PRESETS) {
  const n = ids.length;
  const data = new Uint8Array(RAMP_W * n * 2 * 4);
  ids.forEach((id, row) => {
    const ramp = presets[id].ramp;
    for (let x = 0; x < RAMP_W; x++) {
      const band = Math.min(ramp.length - 1, Math.floor((x / RAMP_W) * ramp.length));
      const hex = ramp[band].replace('#', '');
      const rgb = [0, 2, 4].map((o) => parseInt(hex.slice(o, o + 2), 16));
      // (the gain for this band: the hottest band takes the last gain whatever the ramp's length)
      const g = COVER_GAIN[Math.round((band / Math.max(1, ramp.length - 1)) * (COVER_GAIN.length - 1))];
      for (const [r, mul] of [[row, 1], [n + row, g]]) {
        const i = (r * RAMP_W + x) * 4;
        data[i] = Math.min(255, Math.round(rgb[0] * mul));
        data[i + 1] = Math.min(255, Math.round(rgb[1] * mul));
        data[i + 2] = Math.min(255, Math.round(rgb[2] * mul));
        data[i + 3] = 255;
      }
    }
  });
  return data;
}

/**
 * @param {{ scene: THREE.Object3D, batches?: object|null, atlas?: object|null, quality?: 'high'|'medium'|'low',
 *   reduceMotion?: boolean, rand?: () => number, presets?: object }} o
 */
export function createTornadoFx({ scene, batches = null, atlas = null, quality = 'medium', reduceMotion = false, rand = null, presets = TORNADO_PRESETS }) {
  const ids = Object.keys(presets);
  // (the ramp has two rows per preset: as given, then high's cover row)
  const rowOf = (id, cover = false) => (ids.indexOf(id) + (cover ? ids.length : 0) + 0.5) / (ids.length * 2);
  const R = atlas?.regions || {};
  const rnd = rand || (() => 0.5);
  let tier = TORNADO_TIERS[quality] || TORNADO_TIERS.medium;
  let bloom = false;
  const live = [];
  const perMax = TORNADO_TIERS.high.rings + TORNADO_TIERS.high.core;
  const max = perMax * MAX_TORNADOES;

  // (the hole is the preset's `inner`, cut per pixel: the geometry starts inside every preset's hole)
  const ring = new THREE.RingGeometry(0.3, 1, 40, 1).rotateX(-Math.PI / 2);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = ring.index;
  geo.setAttribute('position', ring.attributes.position);
  const attrs = {};
  for (const k of ['iA', 'iB', 'iC', 'iD', 'iE', 'iF', 'iG']) {
    attrs[k] = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute(k, attrs[k]);
  }
  geo.instanceCount = 0;
  const noise = new THREE.DataTexture(paintTornadoNoise(), NOISE_N, NOISE_N, THREE.RGBAFormat);
  noise.wrapS = noise.wrapT = THREE.RepeatWrapping;
  noise.magFilter = THREE.LinearFilter;
  noise.minFilter = THREE.LinearFilter;
  noise.needsUpdate = true;
  const ramp = new THREE.DataTexture(paintTornadoRamp(ids, presets), RAMP_W, ids.length * 2, THREE.RGBAFormat);
  ramp.magFilter = THREE.NearestFilter;
  ramp.minFilter = THREE.NearestFilter;
  ramp.colorSpace = THREE.SRGBColorSpace;
  ramp.needsUpdate = true;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uNoise: { value: noise }, uRamp: { value: ramp }, uTime: { value: 0 }, uSparse: { value: 0 }, uCover: { value: 0 },
      uFront: { value: new THREE.Vector2(COVER_FRONT[0], COVER_FRONT[1]) }, uYoung: { value: COVER_YOUNG },
      uFar: { value: 0 },
      uRm: { value: new THREE.Vector2(0, 0) },
    },
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
  mesh.renderOrder = 22;
  mesh.visible = false;
  mesh.name = 'tornadoFx';
  scene.add(mesh);
  let time = 0;
  let held = false;

  /** Starts a tornado. @returns {object|null} its record (live, read-only) */
  function spawn(presetId, x, z, { seconds = 2, size = 1 } = {}) {
    const p = presets[presetId];
    if (!p) return null;
    if (live.length >= MAX_TORNADOES) live.shift();
    const rec = { id: presetId, p, x, z, t: 0, seconds: Math.max(0.3, seconds), size: Math.max(0.4, size) * (p.scale ?? 1), phase: [], embers: [] };
    for (let i = 0; i < perMax; i++) rec.phase.push([rnd(), rnd()]);
    for (let i = 0; i < TORNADO_TIERS.high.embers; i++) rec.embers.push([rnd(), rnd(), rnd(), Math.floor(rnd() * 3)]);
    live.push(rec);
    return rec;
  }

  function write(rec, start) {
    const p = rec.p;
    const rm = reduceMotion;
    const life = p.life * (rm ? 2.2 : 1);
    const n = tier.rings;
    const nc = tier.core;
    const total = n + nc;
    // the band at k ≥ 0.8 over white for the bloom: high with bloom on only (the bloom state, not the preset)
    const hdr = tier.hdr && bloom ? p.hdr : 0;
    // high with bloom (the linear composer: no overshoot of its own) takes the cover row; with bloom off the canvas's
    // own blend already overshoots like medium's, so it keeps the bands as given
    const row = rowOf(rec.id, !!(tier.cover && bloom));
    for (let i = 0; i < total; i++) {
      const j = (start + i) * 4;
      const core = i >= n ? 1 : 0;
      const k = core ? (i - n) / Math.max(1, nc) : i / n;
      const [r0, r1] = rec.phase[i];
      const A = attrs.iA.array;
      A[j] = rec.x; A[j + 1] = rec.z; A[j + 2] = rec.t; A[j + 3] = rec.seconds;
      const B = attrs.iB.array;
      B[j] = (k + r0 * 0.35 / n) % 1; B[j + 1] = r1; B[j + 2] = core; B[j + 3] = row;
      const C = attrs.iC.array;
      C[j] = p.r0 * rec.size; C[j + 1] = p.r1 * rec.size; C[j + 2] = p.height * (0.8 + 0.2 * rec.size); C[j + 3] = rm ? 0 : p.twist;
      const D = attrs.iD.array;
      D[j] = rm ? 0 : p.sway; D[j + 1] = p.swayHz; D[j + 2] = rm ? 0 : p.spin; D[j + 3] = life;
      const E = attrs.iE.array;
      E[j] = rm ? 0 : p.helix; E[j + 1] = p.inner; E[j + 2] = p.alpha * (rm && !tier.cover ? 0.7 : 1) * (core ? 0.18 : 1); E[j + 3] = hdr;
      const F = attrs.iF.array;
      F[j] = p.noise[0]; F[j + 1] = p.noise[1]; F[j + 2] = rm ? 0 : p.scroll; F[j + 3] = p.core?.heat ?? 0;
      const G = attrs.iG.array;
      G[j] = p.erode[0]; G[j + 1] = p.erode[1]; G[j + 2] = Math.min(0.95, p.body ?? 0.5); G[j + 3] = p.core?.radius ?? 0.45;
    }
    return total;
  }

  /** The column's strength now: 0 → 1 over its first ring's rise, back to 0 as its last rings leave. */
  /** Seconds a ring (or an ember) takes to leave: the column is gone this long after it stops being fed. */
  const tail = (p) => Math.max(p.life, (p.embers?.life ?? 0) * 1.25) * (reduceMotion ? 2.2 : 1);
  const strength = (rec) => {
    const life = rec.p.life * (reduceMotion ? 2.2 : 1);
    const on = Math.min(1, rec.t / (life * 0.5));
    const off = rec.t <= rec.seconds ? 1 : Math.max(0, 1 - (rec.t - rec.seconds) / life);
    return on * off;
  };

  function quads(rec) {
    if (!batches) return;
    const p = rec.p;
    const k = strength(rec);
    if (k <= 0) return;
    const y = 0.05;
    const size = p.r1 * rec.size * p.base.size * 1.7;
    const pulse = reduceMotion ? 1 : 1 + 0.06 * Math.sin(rec.t * p.base.pulse * TAU);
    const [r, g, b] = lin(p.base.color);
    const [ir, ig, ib] = lin(p.base.inner);
    if (R.ringSoft) batches.groundA?.push(rec.x, y, rec.z, size * pulse, size * pulse, R.ringSoft, r, g, b, 0.28 * k, reduceMotion ? 0 : rec.t * 0.6);
    if (R.ring) batches.groundA?.push(rec.x, y, rec.z, size * 0.62 * pulse, size * 0.62 * pulse, R.ring, ir, ig, ib, 0.4 * k, reduceMotion ? 0 : -rec.t);
    // embers: an analytic spiral (no state): born inside the cast, rising and widening, fading at the top
    const e = p.embers;
    const uv = R[e.sprite] || R.spark;
    const batch = e.additive ? batches.bbA : batches.bbN;
    if (!uv || !batch) return;
    for (let i = 0; i < tier.embers; i++) {
      const [ph, ang, sz, ci] = rec.embers[i];
      const life = e.life * (0.75 + 0.5 * sz) * (reduceMotion ? 2 : 1);
      const age = ((rec.t / life + ph) % 1 + 1) % 1;
      const born = rec.t - age * life;
      if (born < 0 || born > rec.seconds) continue;
      const g = Math.pow(age, 0.7);
      const rad = (p.r0 + (p.r1 - p.r0) * g) * rec.size * (1.05 + 0.25 * sz);
      const a = ang * TAU + (reduceMotion ? 0 : rec.t * p.spin * 0.9 + age * 2.5);
      const fade = Math.min(1, age * 8) * (1 - age);
      const [cr, cg, cb] = lin(e.colors[ci % e.colors.length]);
      const s = e.size * (0.7 + 0.6 * sz) * (1 - 0.4 * age);
      batch.push(rec.x + Math.cos(a) * rad, 0.15 + age * p.height * 1.08, rec.z + Math.sin(a) * rad, s, s, uv, cr, cg, cb, fade * (e.additive ? 1 : 0.95), e.additive || reduceMotion ? 0 : a + rec.t * 3);
    }
  }

  return {
    spawn,
    /** Keeps a live column fed for at least `seconds` more (a cast's next shell landed). */
    feed(rec, seconds) {
      if (rec && live.includes(rec)) rec.seconds = Math.max(rec.seconds, rec.t + seconds);
    },
    /** Impact frames: the column sits them out (both frames; update() keeps it hidden while held). */
    hold(on) {
      held = !!on;
      if (held) mesh.visible = false;
    },
    /** The ring mesh (impact frames hide it with the normal-blend layers). */
    get mesh() {
      return mesh;
    },
    /** Advances and draws (the visual clock's dt; call between the batches' begin and end). */
    update(dt) {
      time += dt;
      let n = 0;
      for (let i = live.length - 1; i >= 0; i--) {
        const rec = live[i];
        rec.t += dt;
        if (rec.t > rec.seconds + tail(rec.p) + 0.05) live.splice(i, 1);
      }
      for (const rec of live) {
        n += write(rec, n);
        quads(rec);
      }
      material.uniforms.uTime.value = time;
      // high: more rings, each sparser (the mask only), and the cover blend
      material.uniforms.uSparse.value = Math.max(0, 1 - TORNADO_TIERS.medium.rings / tier.rings) * SPARSE_ERODE;
      material.uniforms.uCover.value = tier.cover ? 1 : 0;
      material.uniforms.uFar.value = tier.cover ? COVER_FAR_ERODE : 0;
      // Reduce Motion on high: the column eroded, not thinned (RM_COVER)
      const rmc = reduceMotion && tier.cover;
      material.uniforms.uRm.value.set(rmc ? RM_COVER.far : 0, rmc ? RM_COVER.all : 0);
      geo.instanceCount = n;
      for (const a of Object.values(attrs)) {
        a.clearUpdateRanges();
        if (n) a.addUpdateRange(0, n * 4);
        a.needsUpdate = n > 0;
      }
      mesh.visible = n > 0 && !held;
    },
    setQuality(q) {
      tier = TORNADO_TIERS[q] || TORNADO_TIERS.medium;
    },
    /** Bloom on (high only): the band at k ≥ 0.8 (the top of the yellow, the white) gets the HDR boost. */
    setGlow(q, on) {
      bloom = q === 'high' && !!on;
    },
    /** Live tornadoes (dev panel, tests). */
    get live() {
      return live;
    },
    get stats() {
      return { live: live.length, rings: geo.instanceCount, visible: mesh.visible, tier: { ...tier } };
    },
    clear() {
      live.length = 0;
      geo.instanceCount = 0;
      mesh.visible = false;
    },
    dispose() {
      scene.remove(mesh);
      geo.dispose();
      ring.dispose();
      material.dispose();
      noise.dispose();
      ramp.dispose();
    },
  };
}
