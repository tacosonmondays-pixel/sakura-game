// Electricity: crackle auras, the shocked-enemy crackle, an electric ground decal and two cast hooks (docs/VFX.md
// "Electricity", batch B2; display only, not wired into the battle yet: the lab is previews/electric.html). Built on
// the inked chain lightning's toon strokes (src/render/vfx/strokes.js: ink, body, white-hot core, crisp edges, erosion
// into dashes) and the shared toon core (src/render/vfx/toonCore.js) for the ground pieces:
//
//   aura     short micro-bolts round a body, hugging a capsule (its radius, height and feet), each re-struck on its
//            own beat every few frames (a stepped, hand-drawn crackle, no smooth wobble), a few forked; each strike's
//            leader races along it, holds, then erodes. A charge ring glows on the ground at its feet (turning in steps)
//   shock    the same crackle, smaller and short-lived, on an enemy's body after a chain hit: a first burst of
//            bolts, then sparser, then gone
//   scorch   the electric ground decal: Worley F2 − F1 cracks laid out in polar coordinates (so they radiate), a hard
//            step, an ink rim round every crack and round the burn, a white-hot core in the young cracks and a glow
//            round them, over a dark translucent burn; it leaves by erosion from its rim inward
//   casts    Drumstorm (Raika): her crackle for the boost and a ring of bolts bursting out on every drum beat over a
//            glowing ring on the ground, a scorch on the first beat; Drone Surge (Chika): bolts arcing drone to drone
//            round her ring, re-struck on a beat, with little crackles where they join
//
//   const elec = createElectricFx({ scene, camera, quality, reduceMotion, rand });
//   const a = elec.aura('raika', x, z, { radius: 0.27, height: 0.95 });   // world x / z (the sim's x / y)
//   elec.shock('chika', x, z);  elec.scorch('raika', x, z);  elec.cast('raika.drumstorm', x, z);
//   elec.cast('chika.droneSurge', x, z, { points });   // points: [{ x, y, z }, …] the caller moves (the drones)
//   elec.update(dt)                                    // the visual clock's dt
//
// Draw cost: the bolts are toon strokes: standalone (the lab, tests) one instanced draw call of its own, in a battle the
// shared strokes' call; the ground pieces (charge rings, burst rings, scorches) one instanced call. At most 2 while
// anything is up, 0 when idle. Every record, path and buffer is allocated once at the high tier's sizes; update()
// writes numbers into them (nothing allocated a frame; the stroke list is capped, a whole bolt or none).
//
// Branching (our own rules, with ideas from three-stdlib's LightningStrike, MIT: public/licenses/three-stdlib-MIT.txt;
// re-implemented, no code taken): a path is built by halving its segments and pushing each new joint sideways by a share
// of the segment's length that shrinks each halving (ROUGHNESS: fractal kinks); the finest halving alternates sides (a
// drawn zig-zag, not a random walk); a fork leaves from an inner joint, turned off the parent's direction, shorter and
// thinner, one generation only; each bolt shows for only part of its strikes (its duty), so the crackle thins and
// thickens bolt by bolt instead of the whole aura blinking; a strike's leader grows from its start, then erodes away.
//
// Flash safety: every strike asks the flash guard (flashGate, the battle's world-flash budget) with its size and its
// flicker; past the budget its core is drawn at the guard's answer and nothing goes over white. No preset colour is a
// harsh red (tests hold it), nothing is full screen, Flashes & shake off: no flicker and no over-white. Reduce Motion: no
// bolts round bodies or in the burst rings (a still glow ring instead), the arcs struck once and held, no flicker, no
// turning, slower lives. Randomness: the stream it is handed (createVisualRandom fork), never Math.random.
import * as THREE from 'three';
import {
  ELECTRIC_PRESETS, ELECTRIC_TIERS, ELECTRIC_CASTS, MAX_AURAS, MAX_BURSTS, MAX_LINKS, MAX_LINK_NODES, MAX_SCORCHES, MAX_CASTS,
} from './electricPresets.js';
import { createStrokes, stroke, SOLID } from './strokes.js';
import { TOON_CORE, TOON_TIER, TOON_NOISE_N, TOON_RAMP_W, TOON_REDUCE, paintToonNoise, paintToonRamp } from './toonCore.js';

const TAU = Math.PI * 2;
/** Stroke layers, back to front (pushed layer by layer, so a later one covers an earlier one at every joint). */
export const ELECTRIC_LAYERS = Object.freeze(['ink', 'body', 'core']);
/** Thinnest a layer is drawn (half width, CSS px): a micro-bolt never thins into shimmering hairs. */
export const ELECTRIC_MIN_PX = Object.freeze({ ink: 1.6, body: 1.0, core: 0.5 });
/** Each halving's sideways push × this (the fractal: big bends first, small kinks last). */
export const ROUGHNESS = 0.58;
/** The ground pieces' height (over the road ribbon, under the water's). */
export const ELECTRIC_GROUND_Y = 0.064;
/** Reduce Motion: the still glow rings' strength. */
export const ELECTRIC_REDUCE_ALPHA = 0.85;
/** The canvas tiers add this share of a translucent band's colour (the linear target with bloom adds all of it). */
export const ELECTRIC_CANVAS_ADD = 0.45;
/** Scorch bands: how much of the board each hides (the burn is translucent, the glow added light, the ink solid). */
export const SCORCH_COVER = Object.freeze({ burn: 0.26, halo: 0.14, crack: 0.9, core: 1, ink: 1 });
/** Ring bands: the same for the charge and burst rings. */
export const RING_COVER = Object.freeze({ body: 0.2, glow: 0.4, core: 0.85, ink: 1 });
/** Ground ramp bands (presets' `ground`). */
export const GROUND_BAND = Object.freeze({ ink: 0, burn: 2, deep: 3, body: 4, glow: 5, core: 6, white: 7 });
/** The charge ring's erosion while it is up (broken into a few turning dashes; Reduce Motion: nearly whole and still). */
export const AURA_RING_CUT = 0.42;
/** The charge ring turns in steps of this (turns) every RING_STEP s (none under Reduce Motion). */
export const RING_TURN = 0.137;
export const RING_STEP = 0.1;

const MAX_LEVELS = 3;
/** Joints a path can hold: 2^levels + 1 at the deepest tier; a fork one halving fewer. */
const MAX_J = (1 << MAX_LEVELS) + 1;
const MAX_FJ = (1 << (MAX_LEVELS - 1)) + 1;
const MAX_AURA_BOLTS = Math.max(ELECTRIC_TIERS.high.bolts, ELECTRIC_TIERS.high.shock);
const MAX_BURST_BOLTS = ELECTRIC_TIERS.high.burst;
const MAX_NODE_BOLTS = ELECTRIC_TIERS.high.nodes;
/** Share of a body's bolts struck over its top (the rest along its left and right edges). */
export const TOP_SHARE = 0.22;
/** High with bloom: the body colour × this, under the grade's knee so it stays saturated (as the chain lightning's). */
export const BODY_UNDER_BLOOM = 0.82;
/** Floats per collected segment. */
const SEG = 16;
const MAX_SEGS = Math.floor(ELECTRIC_TIERS.high.cap / ELECTRIC_LAYERS.length);
const MAX_GROUND = MAX_AURAS + MAX_BURSTS + MAX_SCORCHES;

const AURA = 0;
const SHOCK = 1;

const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * A fractal path into P (x, y, d triples), 2^levels + 1 joints from a to b: each halving puts a joint at the middle of a
 * segment and pushes it across the a-b plane by ± `wander` × the segment's length × ROUGHNESS^level; the last halving
 * alternates sides by `zig` and slides each joint `skew` along its segment, alternately forward and back (long
 * diagonals and short sharp jogs: a drawn zig-zag, not a random walk); d (the third value: how far off the surface)
 * wanders by ± dWander × the segment's length. Returns the joint count.
 */
export function fractalPath(P, levels, ax, ay, ad, bx, by, bd, wander, zig, dWander, rnd, skew = 0) {
  FP[0] = ax; FP[1] = ay; FP[2] = ad; FP[3] = bx; FP[4] = by; FP[5] = bd;
  FP[6] = wander; FP[7] = zig; FP[8] = dWander; FP[9] = skew;
  return fractalFill(P, levels, rnd);
}

/**
 * fractalPath's work, its numbers read from the scratch FP (a: x, y, d; b: x, y, d; wander, zig, dWander, skew): the
 * layer's hot path fills FP and calls this, so no number is boxed into an argument on the way (nothing allocated).
 */
const FP = new Float64Array(10);
function fractalFill(P, levels, rnd) {
  const zig = FP[7];
  const dWander = FP[8];
  const skew = FP[9];
  const last = 1 << levels;
  P[0] = FP[0]; P[1] = FP[1]; P[2] = FP[2];
  P[last * 3] = FP[3]; P[last * 3 + 1] = FP[4]; P[last * 3 + 2] = FP[5];
  const flip = rnd() < 0.5 ? 1 : -1;
  let amp = FP[6];
  for (let l = 0; l < levels; l++) {
    const half = last >> (l + 1);
    const fine = l === levels - 1;
    for (let i = half; i < last; i += half * 2) {
      const a = (i - half) * 3;
      const b = (i + half) * 3;
      const m = i * 3;
      const dx = P[b] - P[a];
      const dy = P[b + 1] - P[a + 1];
      const len = Math.sqrt(dx * dx + dy * dy) || 1e-6;
      const alt = ((i / half) % 4 === 1) ? 1 : -1;
      const s = fine ? alt * flip * zig * (0.6 + 0.4 * rnd()) : (rnd() * 2 - 1) * amp;
      const f = fine ? 0.5 + alt * flip * skew : 0.5;
      P[m] = P[a] + dx * f - (dy / len) * s * len;
      P[m + 1] = P[a + 1] + dy * f + (dx / len) * s * len;
      P[m + 2] = (P[a + 2] + P[b + 2]) * 0.5 + (rnd() * 2 - 1) * dWander * len;
    }
    amp *= ROUGHNESS;
  }
  return last + 1;
}

/** A capsule's radius at height y (its axis upright, feet at y0, top at y0 + h, radius rc; hemispheres at both ends). */
export function capsuleRadius(rc, y0, h, y) {
  const r = Math.min(rc, h / 2);
  const lo = y0 + r;
  const hi = y0 + h - r;
  if (y < lo) {
    const k = (lo - y) / r;
    return r * Math.sqrt(Math.max(0, 1 - k * k));
  }
  if (y > hi) {
    const k = (y - hi) / r;
    return r * Math.sqrt(Math.max(0, 1 - k * k));
  }
  return r;
}

// ------------------------------------------------------------------------------------------------ the ground shaders

const GROUND_VERT = /* glsl */`
attribute vec4 gA; // x, z, age (0..1), strength
attribute vec4 gB; // mode (0 scorch, 1 ring), radius now, ring half width, the ring's turn (turns)
attribute vec4 gC; // seed, ramp row, over-white (high with bloom, through the flash guard), halo (tier)
attribute vec4 gD; // erode young, erode old, still (Reduce Motion), the cracks' reach (0..1)
varying vec2 vP;
varying vec4 vA;
varying vec4 vB;
varying vec4 vC;
varying vec4 vD;
void main() {
  // the quad hugs the piece as it is now (none at strength 0)
  float ext = (gB.x < 0.5 ? gB.y * 1.04 : gB.y + gB.z * 1.6) * step(0.0005, gA.w);
  vec2 p = position.xz * ext;
  vec3 wp = vec3(gA.x + p.x, ${ELECTRIC_GROUND_Y.toFixed(3)} + 0.002 * gB.x, gA.y + p.y);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(wp, 1.0);
  vP = p;
  vA = gA;
  vB = gB;
  vC = gC;
  vD = gD;
}`;

/**
 * The crack net: the painted Worley lattice (cells a side of the tile), tiles round the scorch (whole: it wraps) and
 * out from its middle to its rim (× √ of the radius: cells narrow towards the middle, so the cracks radiate).
 */
export const SCORCH_CELLS = 6;
export const SCORCH_AROUND = 1;
export const SCORCH_OUT = 0.62;
/** A crack narrower on screen than this many of its rim's pixels draws no ink rim (it would be all ink: dark specks). */
export const SCORCH_INK_PX = 6;
/** The burn's outer edge is inked until this share of the scorch's age (± the noise; a hard step, in patches). */
export const SCORCH_EDGE_INK = 0.3;

const GROUND_FRAG = /* glsl */`
uniform sampler2D uNoise;
uniform sampler2D uRamp;
uniform float uAdd; // the glow's added share where a band covers little: 1 into the linear target, less on the canvas
${TOON_TIER}
varying vec2 vP;
varying vec4 vA;
varying vec4 vB;
varying vec4 vC;
varying vec4 vD;
${TOON_CORE}
// [electric] the ramp texel of band i (8 a row, NearestFilter: flat steps)
float eBand(float i) { return (i + 0.5) / 8.0; }
// [electric] 1 on a thin rim inside a shape's edge: at least px pixels on screen, and minW of its own units
float eRim(float above, float px, float minW) { return step(above, max(minW, px * fwidth(above))); }
void main() {
  float age = vA.z;
  float R = max(vB.y, 1e-3);
  float r = length(vP);
  float u = atan(vP.y, vP.x) / 6.2831853 + vC.x;
  float m;
  float b;
  float cover;
  float hot = 0.0;
  if (vB.x < 0.5) {
    // the scorch: a burn eroding from its rim inward (the house heat over a radial band), the cracks in it
    float x = r / R;
    float n = toonNoise(uNoise, vec2(u * 3.0, x * 0.8 + vC.x), 0.0);
    float band = 1.0 - x * x;
    float heat = toonHeat(band, n);
    float cut = toonCut(vD.xy, age);
    float burn = toonMask(heat, cut) * step(0.0, band);
    // the crack net: Worley F2 - F1 (B) laid out round the middle and out from it (the cells narrow towards the middle,
    // so the cracks radiate); a hard step on its edges, a little thinner out at the rim; they race out first
    vec2 cuv = vec2(u * ${SCORCH_AROUND.toFixed(1)}, sqrt(x) * ${SCORCH_OUT.toFixed(2)} + vC.x * 0.61);
    float e = toonCells(uNoise, toonSwirl(uNoise, cuv, 0.012 * (1.0 - vD.z)));
    float fw = max(fwidth(e), 1e-4);
    float w = mix(0.15, 0.09, x);
    float zone = burn * toonMask(heat, cut + 0.06) * step(x, vD.w);
    float crack = step(e, w) * zone;
    // its middle white-hot while young (the core cools first, in patches), then the body colour, then the deep band
    float core = step(e, w * 0.45) * zone * step(age + 0.2 * n, 0.42);
    float deep = crack * step(0.62, age + 0.2 * n);
    // ink: a rim round every crack (its share of the crack's width, never under ~1 px) and round the burn's edge;
    // a crack thinner on screen than its rim would be all ink, so the rim leaves where the crack is under SCORCH_INK_PX
    float rimW = max(0.4 * w, 1.1 * fw);
    float wide = step(${SCORCH_INK_PX.toFixed(1)} * fw, w);
    // (the burn is inked on its outer silhouette only, and only while young: the holes it erodes inside are never
    // outlined, so an old burn goes in quiet tongues, never a scribble)
    float burnInk = eRim(heat - cut, 1.2, 0.025) * burn * step(0.55, x) * step(age + 0.15 * n, ${SCORCH_EDGE_INK.toFixed(2)});
    float ink = max((1.0 - crack) * zone * step(e, w + rimW) * wide, burnInk);
    // a glow round the young cracks (high and medium)
    float halo = (1.0 - crack) * (1.0 - ink) * zone * step(e, w * 2.4) * vC.w * step(age + 0.25 * n, 0.55);
    b = ${GROUND_BAND.burn.toFixed(1)};
    cover = ${SCORCH_COVER.burn};
    b = mix(b, ${GROUND_BAND.glow.toFixed(1)}, halo);
    cover = mix(cover, ${SCORCH_COVER.halo}, halo);
    b = mix(b, ${GROUND_BAND.body.toFixed(1)}, crack);
    cover = mix(cover, ${SCORCH_COVER.crack}, crack);
    b = mix(b, ${GROUND_BAND.deep.toFixed(1)}, deep);
    b = mix(b, ${GROUND_BAND.core.toFixed(1)}, core);
    cover = mix(cover, ${SCORCH_COVER.core.toFixed(1)}, core);
    b = mix(b, ${GROUND_BAND.ink.toFixed(1)}, ink);
    cover = mix(cover, ${SCORCH_COVER.ink.toFixed(1)}, ink);
    hot = core;
    m = burn;
  } else {
    // a ring (the charge ring under a crackling body, a drum beat's ring): a band of light broken by the polar noise
    // (it turns in steps), inked on its outer edge, its middle hotter
    float x = (r - R) / max(vB.z, 1e-3);
    float band = 1.0 - x * x;
    float n = toonNoise(uNoise, vec2(u * 4.0 + vB.w, 0.35 + vC.x), 0.0);
    float heat = toonHeat(band, n);
    float cut = toonCut(vD.xy, age);
    m = toonMask(heat, cut) * step(0.0, band);
    float above = heat - cut;
    float ink = eRim(above, 1.2, 0.03) * step(0.0, x);
    float glow = step(0.22, above);
    float core = step(0.48, above);
    b = mix(${GROUND_BAND.body.toFixed(1)}, ${GROUND_BAND.glow.toFixed(1)}, glow);
    cover = mix(${RING_COVER.body}, ${RING_COVER.glow}, glow);
    b = mix(b, ${GROUND_BAND.core.toFixed(1)}, core);
    cover = mix(cover, ${RING_COVER.core}, core);
    b = mix(b, ${GROUND_BAND.ink.toFixed(1)}, ink);
    cover = mix(cover, ${RING_COVER.ink.toFixed(1)}, ink);
    hot = core * (1.0 - ink);
  }
  vec3 col = toonRamp(uRamp, eBand(b), vC.y);
  // the hot band goes a little over white on high with bloom (only while the flash guard allows it)
  col *= 1.0 + vC.z * hot;
  float A = m * vA.w;
  // the glow cover (as the water's): encode for the target first, then premultiply; add all of the colour and hide
  // \`cover\` of the board (translucent glowing bands where it is small, solid ink and cores where it is 1)
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  float eCover = cover;
  gl_FragColor = toonAdd(gl_FragColor.rgb, A, mix(uAdd, 1.0, eCover), eCover);
}`;

// ------------------------------------------------------------------------------------------------ the layer

/** One bolt's slot: its path (local coordinates of its owner), one fork, its strike's timing and flash answer. */
function boltSlot() {
  return {
    on: false, t0: -1, next: 0, n: 0, P: new Float32Array(MAX_J * 3), nf: 0, fj: 0, F: new Float32Array(MAX_FJ * 3),
    w: 0, seed: 0, k: 1, odd: 0, L: 0, fu: 0,
  };
}

/**
 * @param {{ scene: THREE.Object3D, camera?: THREE.Camera|null, strokes?: object|null, quality?: 'high'|'medium'|'low',
 *   reduceMotion?: boolean, rand?: () => number, presets?: object, flashes?: boolean }} o
 *   strokes: the battle's shared toon strokes (its owner begins and ends them each frame); none: its own
 */
export function createElectricFx({ scene, camera = null, strokes = null, quality = 'medium', reduceMotion = false, rand = null, presets = ELECTRIC_PRESETS, flashes = true }) {
  const ids = Object.keys(presets);
  const rnd = rand || (() => 0.5);
  let tierName = ELECTRIC_TIERS[quality] ? quality : 'medium';
  let tier = ELECTRIC_TIERS[tierName];
  let bloom = false;
  let rm = !!reduceMotion;
  let flashOn = flashes !== false;
  let held = false;
  /** The layer's clock and the view's turn (typed: no boxed closure numbers): [0] time, [1] the camera's azimuth. */
  const CLK = new Float64Array([0, Math.PI / 2]);
  let drawn = 0;
  let gates = 0;

  // ---- the bolts: toon strokes (one call of its own, or the battle's shared one)
  const own = !strokes;
  const lines = strokes || createStrokes({ scene, max: ELECTRIC_TIERS.high.cap, name: 'electricFx' });
  const S = stroke();
  const segs = new Float32Array(MAX_SEGS * SEG);
  /** Linear colours per preset: ink, body, core (parsed once). */
  const cols = new Float32Array(ids.length * 9);
  ids.forEach((id, i) => {
    ['ink', 'body', 'core'].forEach((k, j) => {
      const c = new THREE.Color(presets[id][k]);
      cols[i * 9 + j * 3] = c.r;
      cols[i * 9 + j * 3 + 1] = c.g;
      cols[i * 9 + j * 3 + 2] = c.b;
    });
  });

  // ---- the ground pieces: one instanced call (textures painted once: no image files)
  const noise = new THREE.DataTexture(paintToonNoise(TOON_NOISE_N, 41, { cells: SCORCH_CELLS, swirl: true }), TOON_NOISE_N, TOON_NOISE_N, THREE.RGBAFormat);
  noise.wrapS = noise.wrapT = THREE.RepeatWrapping;
  noise.magFilter = THREE.LinearFilter;
  noise.minFilter = THREE.LinearFilter;
  noise.needsUpdate = true;
  const ramp = new THREE.DataTexture(paintToonRamp(ids.map((id) => ({ bands: presets[id].ground })), TOON_RAMP_W), TOON_RAMP_W, ids.length, THREE.RGBAFormat);
  ramp.magFilter = THREE.NearestFilter;
  ramp.minFilter = THREE.NearestFilter;
  ramp.colorSpace = THREE.SRGBColorSpace;
  ramp.needsUpdate = true;
  const rowOf = (i) => (i + 0.5) / ids.length;
  const groundBase = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = groundBase.index;
  geo.setAttribute('position', groundBase.attributes.position);
  const gAttrs = {};
  for (const k of ['gA', 'gB', 'gC', 'gD']) {
    gAttrs[k] = new THREE.InstancedBufferAttribute(new Float32Array(MAX_GROUND * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute(k, gAttrs[k]);
  }
  const gList = Object.values(gAttrs);
  geo.instanceCount = 0;
  const material = new THREE.ShaderMaterial({
    uniforms: { uNoise: { value: noise }, uRamp: { value: ramp }, uSparse: { value: 0 }, uCover: { value: 1 }, uAdd: { value: ELECTRIC_CANVAS_ADD } },
    vertexShader: GROUND_VERT,
    fragmentShader: GROUND_FRAG,
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
  const ground = new THREE.Mesh(geo, material);
  ground.frustumCulled = false;
  ground.renderOrder = 6;
  ground.visible = false;
  ground.name = 'electricGround';
  scene.add(ground);
  let gn = 0;

  // ---- the pools (allocated once)
  const auras = [];
  for (let i = 0; i < MAX_AURAS; i++) {
    const bolts = [];
    for (let b = 0; b < MAX_AURA_BOLTS; b++) bolts.push(boltSlot());
    auras.push({ on: false, kind: AURA, id: '', p: null, pi: 0, x: 0, z: 0, y0: 0, lift: 0, rad: 0.27, h: 0.9, size: 1, t: 0, life: Infinity, end: 0, follow: null, seed: 0, bolts });
  }
  const bursts = [];
  for (let i = 0; i < MAX_BURSTS; i++) {
    const bolts = [];
    for (let b = 0; b < MAX_BURST_BOLTS; b++) bolts.push(boltSlot());
    bursts.push({ on: false, id: '', p: null, pi: 0, x: 0, z: 0, size: 1, t: 0, life: 0, next: 0, k: 1, seed: 0, bolts });
  }
  const links = [];
  for (let i = 0; i < MAX_LINKS; i++) {
    const arcs = [];
    const nodes = [];
    for (let b = 0; b < MAX_LINK_NODES; b++) arcs.push(boltSlot());
    for (let b = 0; b < MAX_LINK_NODES * MAX_NODE_BOLTS; b++) nodes.push(boltSlot());
    links.push({ on: false, id: '', p: null, pi: 0, pts: null, n: 0, closed: true, t: 0, life: 0, end: 0, size: 1, sag: new Float32Array(MAX_LINK_NODES), arcs, nodes });
  }
  const scorches = [];
  for (let i = 0; i < MAX_SCORCHES; i++) scorches.push({ on: false, id: '', p: null, pi: 0, x: 0, z: 0, rad: 0.6, t: 0, life: 1, seed: 0, k: 1 });
  const casts = [];
  for (let i = 0; i < MAX_CASTS; i++) casts.push({ on: false, id: '', def: null, x: 0, z: 0, t: 0, dur: 0, beats: 0, next: 0, aura: null, link: null, follow: null, size: 1 });

  /** A free record of a pool, or its oldest. */
  const take = (pool) => {
    let rec = null;
    for (const r of pool) if (!r.on) {
      rec = r;
      break;
    }
    if (!rec) {
      rec = pool[0];
      for (const r of pool) if (r.t > rec.t) rec = r;
    }
    return rec;
  };

  // ---- the view: bolts start on the body's silhouette and the side facing the camera
  function view() {
    if (!camera) return;
    const e = camera.matrixWorld.elements;
    if (Math.abs(e[8]) + Math.abs(e[10]) > 1e-4) CLK[1] = Math.atan2(e[10], e[8]);
  }

  /** Anything up (any record of any pool)? */
  function busy() {
    for (const r of casts) if (r.on) return true;
    for (const r of auras) if (r.on) return true;
    for (const r of bursts) if (r.on) return true;
    for (const r of links) if (r.on) return true;
    for (const r of scorches) if (r.on) return true;
    return false;
  }

  /** The flash guard's answer for one strike (its size, world units; its strength). */
  function gate(size, strength) {
    if (!flashOn || !api.flashGate) return 1;
    gates++;
    return api.flashGate(size, null, strength);
  }

  // ---- strikes (a new path for a bolt: on its beat, never per frame)

  /** A bolt round a capsule (local: arc length round it, height, off the surface). */
  function strikeCapsule(s, rec, lenR, levels, forks) {
    const p = rec.p;
    const rad = rec.rad;
    const y0 = rec.y0;
    const h = rec.h;
    const size = rec.size;
    const a = p.aura;
    // along the body's silhouette (its left and right edges as the camera sees it) and over its top, running mostly up
    // and down it: the crackle outlines the body and never covers its face
    const top = rnd() < TOP_SHARE;
    const side = rnd() < 0.5 ? -1 : 1;
    const th0 = top ? CLK[1] + (rnd() * 2 - 1) * 1.3 : CLK[1] + side * (Math.PI / 2 + (rnd() - 0.5) * 0.9);
    const ay = top ? y0 + h * (0.72 + 0.2 * rnd()) : y0 + h * (0.12 + 0.66 * rnd());
    const L = lerp(lenR[0], lenR[1], rnd()) * size;
    const ang = top ? rnd() * TAU : (rnd() < 0.5 ? 1 : -1) * Math.PI / 2 + (rnd() - 0.5) * 1.3;
    const ax = th0 * rad;
    const bx = ax + Math.cos(ang) * L;
    const by = clamp(ay + Math.sin(ang) * L, y0 + 0.02 * h, y0 + h);
    const stand = a.stand * size;
    FP[0] = ax; FP[1] = ay; FP[2] = stand * (0.5 + 0.6 * rnd());
    FP[3] = bx; FP[4] = by; FP[5] = stand * (0.5 + 0.6 * rnd());
    FP[6] = a.wander; FP[7] = a.zig; FP[8] = 0.35; FP[9] = a.skew;
    s.n = fractalFill(s.P, levels, rnd);
    s.L = L;
    s.nf = 0;
    if (forks > 0 && s.n > 2 && rnd() < a.fork) {
      const j = 1 + Math.floor(rnd() * (s.n - 2));
      const fx = s.P[j * 3];
      const fy = s.P[j * 3 + 1];
      const fd = s.P[j * 3 + 2];
      const dir = Math.atan2(s.P[(j + 1) * 3 + 1] - s.P[(j - 1) * 3 + 1], s.P[(j + 1) * 3] - s.P[(j - 1) * 3]) + (rnd() < 0.5 ? -1 : 1) * (0.55 + 0.55 * rnd());
      const FL = L * (0.38 + 0.25 * rnd());
      // (a fork reaches out off the body: it breaks the silhouette)
      FP[0] = fx; FP[1] = fy; FP[2] = fd;
      FP[3] = fx + Math.cos(dir) * FL; FP[4] = clamp(fy + Math.sin(dir) * FL, y0, y0 + h); FP[5] = fd + stand * (1.5 + 1.5 * rnd());
      FP[6] = a.wander; FP[7] = a.zig; FP[8] = 0.3; FP[9] = a.skew;
      s.nf = fractalFill(s.F, Math.max(1, levels - 1), rnd);
      s.fj = j;
      s.fu = FL / Math.max(L, 1e-4);
    }
    s.w = p.width * size * (0.8 + 0.4 * rnd());
    s.seed = rnd() * 7;
  }

  /** Strikes slot s of an aura or a shock (its flash asked, its next beat set). */
  function strikeAuraBolt(rec, s, restrike) {
    const p = rec.p;
    const lenR = rec.kind === SHOCK ? p.shock.len : p.aura.len;
    strikeCapsule(s, rec, lenR, tier.levels, tier.forks);
    s.t0 = rec.t;
    s.on = rnd() < p.aura.duty;
    s.odd ^= 1;
    s.k = s.on ? gate(s.L, p.flicker) : 1;
    s.next = rec.t + lerp(restrike[0], restrike[1], rnd());
  }

  /** Strikes the bolts of a drum-beat ring (local: angle × r1, out from the ring, up). */
  function strikeBurst(rec) {
    const p = rec.p;
    const B = p.burst;
    const K = tier.burst;
    const span = TAU / K;
    const R1 = B.r1 * rec.size;
    const levels = tier.arcLevels;
    for (let i = 0; i < K; i++) {
      const s = rec.bolts[i];
      const th0 = rec.seed * TAU + i * span + (rnd() - 0.5) * span * 0.25;
      const th1 = th0 + span * (0.6 + 0.25 * rnd());
      FP[0] = th0 * R1; FP[1] = 0; FP[2] = 0; FP[3] = th1 * R1; FP[4] = 0; FP[5] = 0;
      FP[6] = 0.18; FP[7] = B.zig; FP[8] = 0.4; FP[9] = p.aura.skew;
      s.n = fractalFill(s.P, levels, rnd);
      // (the "out" share of each joint is its y in the a-b plane: the kinks bend in and out of the ring)
      s.L = (th1 - th0) * R1;
      s.nf = 0;
      if (tier.forks > 0 && i % 2 === 0) {
        // a spoke: a short bolt shooting out of the ring
        const j = 1 + Math.floor(rnd() * (s.n - 2));
        const fx = s.P[j * 3];
        const fy = s.P[j * 3 + 1];
        const FL = B.spoke * rec.size * (0.7 + 0.6 * rnd());
        FP[0] = fx; FP[1] = fy; FP[2] = 0; FP[3] = fx + (rnd() - 0.5) * FL * 0.5; FP[4] = fy + FL; FP[5] = 0.05 * rec.size;
        FP[6] = 0.2; FP[7] = B.zig; FP[8] = 0.3; FP[9] = p.aura.skew;
        s.nf = fractalFill(s.F, Math.max(1, levels - 1), rnd);
        s.fj = j;
        s.fu = FL / Math.max(s.L, 1e-4);
      }
      s.w = p.width * rec.size * 1.3 * (0.85 + 0.3 * rnd());
      s.seed = rnd() * 7;
      s.t0 = rec.t;
      s.on = true;
      s.odd ^= 1;
    }
    rec.k = gate(2 * R1, 0.6);
  }

  /** Strikes the arc of a link between its points i and i + 1 (local: share along, up, sideways; × the span). */
  function strikeArc(rec, s, i) {
    const p = rec.p;
    const A = p.arc;
    FP[0] = 0; FP[1] = 0; FP[2] = 0; FP[3] = 1; FP[4] = 0; FP[5] = 0;
    FP[6] = A.wander; FP[7] = A.zig; FP[8] = 0.25; FP[9] = p.aura.skew;
    s.n = fractalFill(s.P, tier.arcLevels, rnd);
    rec.sag[i] = (rnd() < 0.7 ? 1 : -1) * A.sag * (0.6 + 0.6 * rnd());
    s.nf = 0;
    s.L = 1;
    s.w = p.width * rec.size * 1.2 * (0.85 + 0.3 * rnd());
    s.seed = rnd() * 7;
    s.t0 = rec.t;
    s.on = rm || rnd() < A.duty;
    s.odd ^= 1;
    s.next = rec.t + lerp(A.restrike[0], A.restrike[1], rnd());
  }

  // ---- starting things

  /**
   * A crackle round a body. opts: radius, height, y0 (feet), size (× the bolts' lengths and widths), life (s; Infinity:
   * until stop()), follow ({ x, z } read every frame: it moves with the body).
   * @returns {object|null} its record (live, read-only)
   */
  function aura(presetId, x, z, { radius = 0.27, height = 0.95, y0 = 0, size = 1, life = Infinity, follow = null, kind = AURA } = {}) {
    const p = presets[presetId];
    if (!p) return null;
    const rec = take(auras);
    rec.on = true;
    rec.kind = kind;
    rec.id = presetId;
    rec.p = p;
    rec.pi = ids.indexOf(presetId);
    rec.x = x;
    rec.z = z;
    rec.y0 = y0;
    rec.rad = Math.max(0.05, radius);
    rec.h = Math.max(rec.rad * 2, height);
    rec.size = Math.max(0.3, size);
    rec.t = 0;
    rec.life = life * (rm && Number.isFinite(life) ? TOON_REDUCE.life : 1);
    rec.end = -1;
    rec.follow = follow;
    rec.seed = rnd();
    const count = kind === SHOCK ? tier.shock : tier.bolts;
    for (let b = 0; b < MAX_AURA_BOLTS; b++) {
      const s = rec.bolts[b];
      s.on = false;
      s.t0 = -1;
      s.odd = 0;
      // the shock's first burst strikes at once; the others start on staggered beats
      s.next = kind === SHOCK && b < p.shock.burst ? 0 : (b / Math.max(1, count)) * p.aura.restrike[1];
    }
    return rec;
  }

  /** The shocked-enemy crackle (smaller and short-lived) on a body at x, z. */
  function shock(presetId, x, z, { radius = 0.24, height = 0.62, y0 = 0, size = 0.8, follow = null } = {}) {
    const p = presets[presetId];
    if (!p) return null;
    return aura(presetId, x, z, { radius, height, y0, size, life: p.shock.life, follow, kind: SHOCK });
  }

  /** The cracked, glowing electric scorch on the ground at x, z (size × the preset's radius). */
  function scorch(presetId, x, z, { size = 1 } = {}) {
    const p = presets[presetId];
    if (!p) return null;
    const rec = take(scorches);
    rec.on = true;
    rec.id = presetId;
    rec.p = p;
    rec.pi = ids.indexOf(presetId);
    rec.x = x;
    rec.z = z;
    rec.rad = p.scorch.radius * Math.max(0.3, size);
    rec.t = 0;
    rec.life = p.scorch.life * (rm ? TOON_REDUCE.life : 1);
    rec.seed = rnd();
    rec.k = gate(rec.rad * 2, 0.5);
    return rec;
  }

  /** One drum beat's burst ring of bolts at x, z. */
  function burst(presetId, x, z, { size = 1 } = {}) {
    const p = presets[presetId];
    if (!p) return null;
    const rec = take(bursts);
    rec.on = true;
    rec.id = presetId;
    rec.p = p;
    rec.pi = ids.indexOf(presetId);
    rec.x = x;
    rec.z = z;
    rec.size = Math.max(0.3, size);
    rec.t = 0;
    rec.life = p.burst.life * (rm ? TOON_REDUCE.life : 1);
    rec.seed = rnd();
    rec.k = 1;
    for (const s of rec.bolts) s.on = false;
    if (!rm) strikeBurst(rec);
    rec.next = p.burst.restrike;
    return rec;
  }

  /** Bolts arcing between points (moved by the caller), in a loop when closed. */
  function link(presetId, points, { life = 6, closed = true, size = 1 } = {}) {
    const p = presets[presetId];
    if (!p || !Array.isArray(points) || points.length < 2) return null;
    const rec = take(links);
    rec.on = true;
    rec.id = presetId;
    rec.p = p;
    rec.pi = ids.indexOf(presetId);
    rec.pts = points;
    rec.n = Math.min(points.length, MAX_LINK_NODES);
    rec.closed = closed && rec.n > 2;
    rec.t = 0;
    rec.life = life * (rm ? TOON_REDUCE.life : 1);
    rec.end = -1;
    rec.size = Math.max(0.3, size);
    for (const s of rec.arcs) {
      s.on = false;
      s.t0 = -1;
      s.odd = 0;
      s.next = 0;
    }
    for (const s of rec.nodes) {
      s.on = false;
      s.next = rnd() * p.aura.restrike[1];
    }
    return rec;
  }

  /**
   * A cast hook (ELECTRIC_CASTS). 'raika.drumstorm' at her feet; 'chika.droneSurge' with opts.points (the drones).
   * opts.duration overrides the cast's; opts.follow moves it with her.
   */
  function cast(castId, x, z, { points = null, duration = null, follow = null, size = 1, radius = 0.27, height = 0.95 } = {}) {
    const def = ELECTRIC_CASTS[castId];
    if (!def || !presets[def.preset]) return null;
    const rec = take(casts);
    rec.on = true;
    rec.id = castId;
    rec.def = def;
    rec.x = x;
    rec.z = z;
    rec.t = 0;
    rec.beats = 0;
    rec.next = 0.05;
    rec.size = size;
    rec.dur = (duration ?? def.duration) * (rm ? TOON_REDUCE.life : 1);
    rec.follow = follow;
    rec.link = null;
    if (def.kind === 'drumstorm') {
      rec.aura = aura(def.preset, x, z, { radius, height, size, life: duration ?? def.duration, follow });
    } else {
      rec.aura = aura(def.preset, x, z, { radius, height, size, life: def.launch, follow });
      if (points) rec.link = link(def.preset, points, { life: duration ?? def.duration, size });
    }
    return rec;
  }

  /** Ends a crackle, a link or a cast (its bolts finish their strikes, then erode; its ring erodes out). */
  function stop(rec) {
    if (!rec || !rec.on) return;
    if (rec.def) {
      if (rec.aura) stop(rec.aura);
      if (rec.link) stop(rec.link);
      rec.on = false;
      return;
    }
    if ('bolts' in rec && 'kind' in rec) rec.life = Math.min(rec.life, rec.t);
    else if ('arcs' in rec) rec.life = Math.min(rec.life, rec.t);
  }

  // ---- collecting the strokes (world segments, a whole bolt or none)
  // The hot path's numbers live in typed scratch arrays, read where they are needed and never handed over as arguments:
  // a non-integer number passed to a helper the engine does not inline, or written into a closure variable, is a new
  // heap object each time (garbage every frame). Records, slots and presets are passed; numbers are not.
  let sn = 0;
  /** The mapped world point. */
  const WP = new Float64Array(3);
  /** The first joint of the path being pushed. */
  const PJ = new Float64Array(3);
  /** The path being pushed: u0, u1, w0, w1, head, cut, seed, preset index, core strength, over-white, taper. */
  const PP = new Float64Array(11);
  /** A strike's state now: head, cut, shrink, core strength, over-white; [5] the beat ring's radius now. */
  const ST = new Float64Array(6);
  /** Ramp rows by preset index. */
  const ROWS = new Float32Array(ids.length);
  for (let i = 0; i < ids.length; i++) ROWS[i] = rowOf(i);

  // the mappings: the local joint at P[o .. o + 2] → WP (world)
  /** Round a capsule: arc length round it, height, off the surface (capsuleRadius inlined). */
  function mapCapsule(rec, P, o) {
    const rad = rec.rad;
    const y = P[o + 1];
    const rr = Math.min(rad, rec.h / 2);
    const lo = rec.y0 + rr;
    const hi = rec.y0 + rec.h - rr;
    let r = rr;
    if (y < lo) {
      const k = (lo - y) / rr;
      r = rr * Math.sqrt(Math.max(0, 1 - k * k));
    } else if (y > hi) {
      const k = (y - hi) / rr;
      r = rr * Math.sqrt(Math.max(0, 1 - k * k));
    }
    r += P[o + 2];
    const th = P[o] / rad;
    WP[0] = rec.x + Math.cos(th) * r;
    WP[1] = y + rec.lift;
    WP[2] = rec.z + Math.sin(th) * r;
  }
  /** Round a beat ring: angle × r1, out from the ring (its radius now in ST[5]), up. */
  function mapBurst(rec, P, o) {
    const B = rec.p.burst;
    const th = P[o] / (B.r1 * rec.size);
    const out = P[o + 1];
    const r = ST[5] + out;
    WP[0] = rec.x + Math.cos(th) * r;
    WP[1] = B.height + P[o + 2] + Math.max(0, out) * 0.15;
    WP[2] = rec.z + Math.sin(th) * r;
  }
  /** Along an arc: share along, up, sideways (× its span), bowed by its sag. */
  const arc = { ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, sx: 1, sz: 0, len: 1, sag: 0 };
  function mapArc(c, P, o) {
    const f = P[o];
    const bow = c.sag * 4 * f * (1 - f);
    WP[0] = c.ax + (c.bx - c.ax) * f + c.sx * P[o + 2] * c.len;
    WP[1] = c.ay + (c.by - c.ay) * f + (P[o + 1] + bow) * c.len;
    WP[2] = c.az + (c.bz - c.az) * f + c.sz * P[o + 2] * c.len;
  }
  /** A point's little crackle: struck round a small sphere at the ground's band, drawn round the point, lifted to it. */
  const nodeRec = { x: 0, z: 0, rad: 0.07, y0: 0, h: 0.14, lift: 0, size: 0.6, p: null };

  let maxSegs = MAX_SEGS;

  /**
   * Pushes one path's segments: its n joints from P mapped by `map` round `ctx`, the rest from PP. Returns false when it
   * does not fit (nothing pushed).
   */
  function pushPath(P, n, map, ctx) {
    const k = n - 1;
    if (k <= 0) return true;
    if (sn + k > maxSegs) return false;
    const u0 = PP[0];
    const u1 = PP[1];
    const w0 = PP[2];
    const w1 = PP[3];
    for (let j = 0; j <= k; j++) {
      map(ctx, P, j * 3);
      if (j === 0) {
        PJ[0] = WP[0];
        PJ[1] = WP[1];
        PJ[2] = WP[2];
        continue;
      }
      const o = sn * SEG;
      const fa = (j - 1) / k;
      const fb = j / k;
      // (the segment starts at the previous joint: the path's first, or the end of the segment pushed just before)
      if (j === 1) {
        segs[o] = PJ[0]; segs[o + 1] = PJ[1]; segs[o + 2] = PJ[2];
      } else {
        segs[o] = segs[o - SEG + 3]; segs[o + 1] = segs[o - SEG + 4]; segs[o + 2] = segs[o - SEG + 5];
      }
      segs[o + 3] = WP[0]; segs[o + 4] = WP[1]; segs[o + 5] = WP[2];
      segs[o + 6] = w0 + (w1 - w0) * fa;
      segs[o + 7] = w0 + (w1 - w0) * fb;
      segs[o + 8] = u0 + (u1 - u0) * fa;
      segs[o + 9] = u0 + (u1 - u0) * fb;
      segs[o + 10] = PP[4];
      segs[o + 11] = PP[5];
      segs[o + 12] = PP[6];
      segs[o + 13] = PP[7];
      segs[o + 14] = PP[8];
      segs[o + 15] = PP[9];
      sn++;
    }
    return true;
  }

  /** A strike's leader head, erosion and the core's strength now (into ST); false when it is over. */
  function strikeState(s, rec, a) {
    const age = rec.t - s.t0;
    if (age < 0 || age > a.grow + a.hold + a.fade) return false;
    ST[0] = a.grow > 0 ? age / a.grow : 99;
    ST[1] = age > a.grow + a.hold ? Math.min(1.05, ((age - a.grow - a.hold) / Math.max(1e-4, a.fade)) * 1.05) : 0;
    ST[2] = 1 - 0.35 * ST[1];
    ST[3] = (flashOn && !rm ? 1 - rec.p.flicker * s.odd : 1) * Math.min(1, s.k);
    ST[4] = tier.hdr && bloom && flashOn && s.k >= 1 ? 1 : 0;
    return true;
  }

  /** Pushes a bolt and its fork (the strike's state in ST, its preset index and taper in PP[7], PP[10]). */
  function pushBolt(s, map, ctx) {
    const w0 = s.w * ST[2];
    const w1 = s.w * PP[10] * ST[2];
    PP[0] = 0; PP[1] = 1; PP[2] = w0; PP[3] = w1;
    PP[4] = ST[0]; PP[5] = ST[1]; PP[6] = s.seed; PP[8] = ST[3]; PP[9] = ST[4];
    if (!pushPath(s.P, s.n, map, ctx)) return false;
    if (s.nf > 1) {
      const uj = s.fj / (s.n - 1);
      const wj = (w0 + (w1 - w0) * uj) * 0.62;
      PP[0] = uj; PP[1] = uj + s.fu; PP[2] = wj; PP[3] = wj * 0.35;
      pushPath(s.F, s.nf, map, ctx);
    }
    return true;
  }

  function collect() {
    sn = 0;
    maxSegs = Math.min(MAX_SEGS, Math.floor(tier.cap / ELECTRIC_LAYERS.length), Math.floor((lines.room ? lines.room() : Infinity) / ELECTRIC_LAYERS.length));
    if (rm) {
      // Reduce Motion: only the links' arcs, struck once and held
      for (const rec of links) if (rec.on) collectLink(rec);
      return sn;
    }
    for (const rec of auras) {
      if (!rec.on) continue;
      const a = rec.p.aura;
      const count = rec.kind === SHOCK ? tier.shock : tier.bolts;
      PP[7] = rec.pi;
      PP[10] = rec.p.taper;
      for (let b = 0; b < count; b++) {
        const s = rec.bolts[b];
        if (!s.on || !strikeState(s, rec, a)) continue;
        if (!pushBolt(s, mapCapsule, rec)) return sn;
      }
    }
    for (const rec of bursts) {
      if (!rec.on) continue;
      const B = rec.p.burst;
      const age = rec.t / rec.life;
      ST[5] = lerp(B.r0, B.r1, 1 - Math.pow(1 - Math.min(1, age), 3)) * rec.size;
      PP[7] = rec.pi;
      PP[10] = 0.7;
      for (let i = 0; i < tier.burst; i++) {
        const s = rec.bolts[i];
        if (!s.on) continue;
        // a beat's bolts: the leader races round the ring at the start, the bolts erode over its second half
        ST[0] = Math.min(99, rec.t / Math.max(1e-4, B.restrike));
        ST[1] = age > 0.5 ? Math.min(1.05, ((age - 0.5) / 0.5) * 1.05) : 0;
        ST[2] = 1 - 0.35 * ST[1];
        ST[3] = (flashOn ? 1 - rec.p.flicker * s.odd : 1) * Math.min(1, rec.k);
        ST[4] = tier.hdr && bloom && flashOn && rec.k >= 1 ? 1 : 0;
        if (!pushBolt(s, mapBurst, rec)) return sn;
      }
    }
    for (const rec of links) if (rec.on) collectLink(rec);
    return sn;
  }

  function collectLink(rec) {
    const p = rec.p;
    const A = p.arc;
    const edges = rec.closed ? rec.n : rec.n - 1;
    // the web erodes out over its last 0.3 s
    const left = rec.life - rec.t;
    const cutAll = left < 0.3 ? Math.min(1.05, ((0.3 - left) / 0.3) * 1.05) : 0;
    PP[7] = rec.pi;
    for (let i = 0; i < edges; i++) {
      const s = rec.arcs[i];
      if (!s.on) continue;
      const pa = rec.pts[i];
      const pb = rec.pts[(i + 1) % rec.n];
      arc.ax = pa.x; arc.ay = pa.y; arc.az = pa.z;
      arc.bx = pb.x; arc.by = pb.y; arc.bz = pb.z;
      const hx = pb.x - pa.x;
      const hz = pb.z - pa.z;
      const dy = pb.y - pa.y;
      const hl = Math.sqrt(hx * hx + hz * hz);
      arc.sx = hl > 1e-4 ? -hz / hl : 1;
      arc.sz = hl > 1e-4 ? hx / hl : 0;
      arc.len = Math.sqrt(hx * hx + dy * dy + hz * hz);
      arc.sag = rec.sag[i];
      const age = rec.t - s.t0;
      ST[0] = rm ? 99 : A.grow > 0 ? age / A.grow : 99;
      ST[1] = cutAll;
      ST[2] = 1 - 0.35 * cutAll;
      ST[3] = (flashOn && !rm ? 1 - p.flicker * s.odd : 1) * Math.min(1, s.k);
      ST[4] = tier.hdr && bloom && flashOn && s.k >= 1 ? 1 : 0;
      PP[10] = 0.8;
      if (!pushBolt(s, mapArc, arc)) return;
    }
    if (rm) return;
    // the little crackles where the arcs join (round each point, a tiny sphere)
    const a = p.aura;
    PP[10] = p.taper;
    for (let i = 0; i < rec.n; i++) {
      const pt = rec.pts[i];
      nodeRec.x = pt.x;
      nodeRec.z = pt.z;
      nodeRec.lift = pt.y - nodeRec.rad;
      for (let b = 0; b < tier.nodes; b++) {
        const s = rec.nodes[i * MAX_NODE_BOLTS + b];
        if (!s.on || !strikeState(s, rec, a)) continue;
        if (!pushBolt(s, mapCapsule, nodeRec)) return;
      }
    }
  }

  /** Pushes the collected segments layer by layer (ink, body, core); returns how many strokes. */
  function write(count) {
    let j = 0;
    const dimBody = tier.hdr && bloom ? BODY_UNDER_BLOOM : 1;
    for (let li = 0; li < ELECTRIC_LAYERS.length; li++) {
      S.minPx = MIN_PX_BY_LAYER[li];
      S.kind = SOLID;
      const dim = li === 1 ? dimBody : 1;
      for (let s = 0; s < count; s++) {
        const o = s * SEG;
        const pi = segs[o + 13];
        const p = plist[pi];
        const wa = segs[o + 6];
        const wb = segs[o + 7];
        let ka = wa;
        let kb = wb;
        let alpha = 1;
        if (li === 0) {
          ka = wa + p.inkWidth * (wa > 0 ? Math.max(0.7, Math.min(1, wa / p.width)) : 1);
          kb = wb + p.inkWidth * (wb > 0 ? Math.max(0.7, Math.min(1, wb / p.width)) : 1);
        } else if (li === 2) {
          ka = wa * p.coreShare;
          kb = wb * p.coreShare;
          alpha = segs[o + 14];
        }
        const c = pi * 9 + li * 3;
        S.ax = segs[o]; S.ay = segs[o + 1]; S.az = segs[o + 2]; S.wa = ka;
        S.bx = segs[o + 3]; S.by = segs[o + 4]; S.bz = segs[o + 5]; S.wb = kb;
        S.ua = segs[o + 8]; S.ub = segs[o + 9]; S.head = segs[o + 10]; S.tail = -99;
        S.r = cols[c] * dim; S.g = cols[c + 1] * dim; S.b = cols[c + 2] * dim; S.a = alpha;
        S.seed = segs[o + 12]; S.hdr = li === 2 && segs[o + 15] > 0 ? p.hdr : 0;
        S.cut = segs[o + 11]; S.noise = 7; S.bandFreq = 0; S.bandSpeed = 0;
        if (!lines.push(S)) return j;
        j++;
      }
    }
    return j;
  }
  /** The presets by index, and each layer's pixel floor. */
  const plist = ids.map((id) => presets[id]);
  const MIN_PX_BY_LAYER = ELECTRIC_LAYERS.map((l) => ELECTRIC_MIN_PX[l]);

  // ---- the ground pieces (numbers into the preallocated attributes, through the scratch GP)
  /**
   * GP: x, z, age, strength; mode (0 scorch, 1 ring), radius, ring half width, turn; seed, preset index, over-white, halo;
   * erode young, erode old, still, reach.
   */
  const GP = new Float64Array(16);
  function pushGround() {
    if (gn >= MAX_GROUND) return;
    const j = gn * 4;
    const A = gAttrs.gA.array;
    const B = gAttrs.gB.array;
    const C = gAttrs.gC.array;
    const D = gAttrs.gD.array;
    A[j] = GP[0]; A[j + 1] = GP[1]; A[j + 2] = GP[2]; A[j + 3] = GP[3];
    B[j] = GP[4]; B[j + 1] = GP[5]; B[j + 2] = GP[6]; B[j + 3] = GP[7];
    C[j] = GP[8]; C[j + 1] = ROWS[GP[9]]; C[j + 2] = GP[10]; C[j + 3] = GP[11];
    D[j] = GP[12]; D[j + 1] = GP[13]; D[j + 2] = GP[14]; D[j + 3] = GP[15];
    gn++;
  }

  function writeGround() {
    gn = 0;
    const hdrOn = tier.hdr && bloom && flashOn;
    const still = rm ? 1 : 0;
    const strength = rm ? ELECTRIC_REDUCE_ALPHA : 1;
    // scorches first (under the rings)
    for (const rec of scorches) {
      if (!rec.on) continue;
      GP[0] = rec.x; GP[1] = rec.z; GP[2] = Math.min(1, rec.t / rec.life); GP[3] = Math.min(1, rec.t / 0.03) * strength;
      GP[4] = 0; GP[5] = rec.rad; GP[6] = 0; GP[7] = 0;
      GP[8] = rec.seed; GP[9] = rec.pi; GP[10] = hdrOn && rec.k >= 1 ? rec.p.hdr : 0; GP[11] = tier.halo ? 1 : 0;
      GP[12] = rec.p.scorch.erode[0]; GP[13] = rec.p.scorch.erode[1]; GP[14] = still;
      GP[15] = rm ? 1 : 1 - Math.pow(1 - Math.min(1, rec.t / 0.12), 3);
      pushGround();
    }
    // the charge ring at a crackling body's feet (Reduce Motion: the still glow ring that stands for the crackle)
    for (const rec of auras) {
      if (!rec.on || (rec.kind === SHOCK && !rm)) continue;
      const g = rec.p.aura.ring;
      const ending = rec.t > rec.life ? Math.min(1, (rec.t - rec.life) / 0.3) : 0;
      const shockAge = rec.kind === SHOCK ? Math.min(1, rec.t / rec.life) : 0;
      GP[0] = rec.x; GP[1] = rec.z; GP[2] = Math.max(ending, shockAge); GP[3] = Math.min(1, rec.t / 0.1) * strength;
      GP[4] = 1; GP[5] = rec.rad * g.radius * (rec.kind === SHOCK ? 0.85 : 1); GP[6] = g.width * rec.size;
      GP[7] = rm ? 0 : Math.floor(rec.t / RING_STEP) * RING_TURN;
      GP[8] = rec.seed; GP[9] = rec.pi; GP[10] = 0; GP[11] = 0;
      GP[12] = rm ? 0.04 : AURA_RING_CUT; GP[13] = 0.95; GP[14] = still; GP[15] = 0;
      pushGround();
    }
    // a drum beat's ring on the ground, bursting out under its bolts (Reduce Motion: still, at most of its reach);
    // no over-white on the ring: the bolts over it carry the glow (a wide ring over white would bloom into a soft halo)
    for (const rec of bursts) {
      if (!rec.on) continue;
      const B = rec.p.burst;
      const age = Math.min(1, rec.t / rec.life);
      GP[0] = rec.x; GP[1] = rec.z; GP[2] = age; GP[3] = strength;
      GP[4] = 1; GP[5] = (rm ? lerp(B.r0, B.r1, 0.75) : lerp(B.r0, B.r1, 1 - Math.pow(1 - age, 3))) * rec.size * 0.94;
      GP[6] = 0.04 * rec.size; GP[7] = 0;
      GP[8] = rec.seed; GP[9] = rec.pi; GP[10] = 0; GP[11] = 0;
      GP[12] = rm ? 0.04 : 0.22; GP[13] = 0.95; GP[14] = still; GP[15] = 0;
      pushGround();
    }
    geo.instanceCount = gn;
    if (gn) for (const a of gList) a.needsUpdate = true;
    ground.visible = gn > 0 && !held;
  }

  // ---- stepping the records

  function stepAura(rec, dt) {
    const f = rec.follow;
    if (f) {
      rec.x = f.x;
      rec.z = f.z ?? f.y;
    }
    rec.t += dt;
    const p = rec.p;
    const tail = p.aura.grow + p.aura.hold + p.aura.fade;
    if (rec.t > rec.life + Math.max(tail, 0.3)) {
      rec.on = false;
      return;
    }
    if (rm || rec.t > rec.life) return;
    const count = rec.kind === SHOCK ? tier.shock : tier.bolts;
    const restrike = rec.kind === SHOCK ? p.shock.restrike : p.aura.restrike;
    // the shock thins out over its life (its later strikes more often off)
    for (let b = 0; b < count; b++) {
      const s = rec.bolts[b];
      if (rec.t >= s.next) {
        strikeAuraBolt(rec, s, restrike);
        if (rec.kind === SHOCK && rec.t > rec.life * 0.4 && rnd() < 0.4) s.on = false;
      }
    }
  }

  function stepBurst(rec, dt) {
    rec.t += dt;
    if (rec.t > rec.life) {
      rec.on = false;
      return;
    }
    if (rm) return;
    // re-struck on the beat while it bursts out (its first half), then it erodes on its last path
    if (rec.t >= rec.next && rec.t < rec.life * 0.5) {
      while (rec.t >= rec.next) rec.next += rec.p.burst.restrike;
      strikeBurst(rec);
    }
  }

  function stepLink(rec, dt) {
    rec.t += dt;
    if (rec.t > rec.life) {
      rec.on = false;
      return;
    }
    const p = rec.p;
    const edges = rec.closed ? rec.n : rec.n - 1;
    for (let i = 0; i < edges; i++) {
      const s = rec.arcs[i];
      // Reduce Motion: struck once and held (it still follows its points)
      if (rm ? s.t0 < 0 || !s.on : rec.t >= s.next && rec.t < rec.life - 0.3) {
        strikeArc(rec, s, i);
        const pa = rec.pts[i];
        const pb = rec.pts[(i + 1) % rec.n];
        s.k = s.on ? gate(Math.hypot(pb.x - pa.x, pb.y - pa.y, pb.z - pa.z), p.flicker) : 1;
      }
    }
    if (rm) return;
    for (let i = 0; i < rec.n; i++) {
      for (let b = 0; b < tier.nodes; b++) {
        const s = rec.nodes[i * MAX_NODE_BOLTS + b];
        if (rec.t >= s.next && rec.t < rec.life - 0.3) {
          nodeRec.p = p;
          strikeCapsule(s, nodeRec, p.shock.len, 1, 0);
          // (struck at the origin's band; drawn round the point by its own frame each frame)
          s.t0 = rec.t;
          s.on = rnd() < p.aura.duty;
          s.odd ^= 1;
          s.k = s.on ? gate(s.L, p.flicker) : 1;
          s.next = rec.t + lerp(p.aura.restrike[0], p.aura.restrike[1], rnd());
        }
      }
    }
  }

  function stepCast(rec, dt) {
    rec.t += dt;
    const f = rec.follow;
    if (f) {
      rec.x = f.x;
      rec.z = f.z ?? f.y;
    }
    if (rec.t > rec.dur) {
      rec.on = false;
      return;
    }
    const def = rec.def;
    if (def.kind === 'drumstorm') {
      while (rec.t >= rec.next && rec.next < rec.dur) {
        burst(def.preset, rec.x, rec.z, { size: rec.size });
        if (rec.beats % def.scorchEvery === 0) scorch(def.preset, rec.x, rec.z, { size: rec.size * 1.2 });
        rec.beats++;
        rec.next += def.beat * (rm ? TOON_REDUCE.life : 1);
      }
    }
  }

  const api = {
    aura,
    shock,
    scorch,
    burst,
    link,
    cast,
    stop,
    /** The flash guard's gate for world flashes ((size, uv, strength) → strength multiplier); set by the renderer. */
    flashGate: null,
    /** Impact frames: everything sits them out (its own strokes; the battle's shared strokes are held by their owner). */
    hold(on) {
      held = !!on;
      if (own) lines.hold(on);
      if (held) ground.visible = false;
    },
    /** World units per CSS pixel (the camera rig's scale): the thinnest a layer is drawn (its own strokes). */
    setPixel(worldPerPx) {
      if (own) lines.setPixel(worldPerPx);
    },
    /** The meshes it draws in (the strokes', the ground's). */
    get meshes() {
      return [lines.mesh, ground];
    },
    /** Advances and draws (the visual clock's dt). */
    update(dt) {
      CLK[0] += dt;
      // idle: nothing up and nothing drawn last frame (its meshes already hidden): no work at all
      if (!busy() && drawn === 0 && gn === 0) return;
      view();
      for (const rec of casts) if (rec.on) stepCast(rec, dt);
      for (const rec of auras) if (rec.on) stepAura(rec, dt);
      for (const rec of bursts) if (rec.on) stepBurst(rec, dt);
      for (const rec of links) if (rec.on) stepLink(rec, dt);
      for (const rec of scorches) {
        if (!rec.on) continue;
        rec.t += dt;
        if (rec.t > rec.life) rec.on = false;
      }
      if (own) lines.begin();
      const count = collect();
      drawn = count ? write(count) : 0;
      if (own) lines.end(CLK[0]);
      material.uniforms.uAdd.value = bloom ? 1 : ELECTRIC_CANVAS_ADD;
      writeGround();
    },
    /** The graphics tier (records up keep going with its counts). */
    setQuality(q) {
      tierName = ELECTRIC_TIERS[q] ? q : 'medium';
      tier = ELECTRIC_TIERS[tierName];
    },
    /** Bloom on (high only): the cores go a little over white. */
    setGlow(q, on) {
      bloom = q === 'high' && !!on;
    },
    /** Settings → Reduce motion (new pieces and the ones up). */
    setReduceMotion(on) {
      rm = !!on;
    },
    /** Settings → Flashes & shake (off: no flicker, nothing over white). */
    setFlashes(on) {
      flashOn = !!on;
    },
    get stats() {
      let a = 0;
      let sh = 0;
      for (const r of auras) if (r.on) {
        if (r.kind === SHOCK) sh++;
        else a++;
      }
      return {
        tier: tierName, auras: a, shocks: sh, bursts: bursts.filter((r) => r.on).length, links: links.filter((r) => r.on).length,
        scorches: scorches.filter((r) => r.on).length, casts: casts.filter((r) => r.on).length, segments: sn, strokes: drawn,
        ground: geo.instanceCount, gates, calls: (own && lines.mesh.visible ? 1 : 0) + (ground.visible ? 1 : 0),
      };
    },
    /** Live records (lab, tests). */
    get live() {
      return {
        auras: auras.filter((r) => r.on), bursts: bursts.filter((r) => r.on), links: links.filter((r) => r.on),
        scorches: scorches.filter((r) => r.on), casts: casts.filter((r) => r.on),
      };
    },
    /** The preallocated arrays (tests: they never grow). */
    get buffers() {
      const out = [segs, cols, ...gList.map((a) => a.array)];
      for (const r of auras) for (const s of r.bolts) out.push(s.P, s.F);
      for (const r of bursts) for (const s of r.bolts) out.push(s.P, s.F);
      for (const r of links) {
        out.push(r.sag);
        for (const s of r.arcs) out.push(s.P, s.F);
        for (const s of r.nodes) out.push(s.P, s.F);
      }
      return out;
    },
    clear() {
      for (const pool of [auras, bursts, links, scorches, casts]) for (const r of pool) r.on = false;
      sn = 0;
      drawn = 0;
      if (own) {
        lines.begin();
        lines.end(CLK[0]);
      }
      gn = 0;
      geo.instanceCount = 0;
      ground.visible = false;
    },
    dispose() {
      if (own) lines.dispose();
      scene.remove(ground);
      geo.dispose();
      groundBase.dispose();
      material.dispose();
      noise.dispose();
      ramp.dispose();
    },
  };
  return api;
}
