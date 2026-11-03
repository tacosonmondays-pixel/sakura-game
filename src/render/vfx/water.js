// Toon water splash (docs/VFX.md "Water splash", batch B1; display only, not wired into the battle yet: the lab is
// previews/water-splash.html). The tornado's house look (src/render/vfx/toonCore.js) turned into a short burst:
//
//   crown   an open wall rising from the impact; its lip has whole-number spikes wobbled by the noise and erodes first,
//           so the tongues part from it; it spreads, slumps and breaks up into blobs (a narrow centre jet follows it on
//           high and medium). The arc facing the camera is brighter, the inside of the wall darker, and where the wall
//           turns edge-on to the camera it gets an ink line.
//   drops   pairs leave the spike tips as the crown breaks: two soft fields cut by one hard threshold (the clip), so a
//           pair is one blob while its drops are close and splits as the faster one pulls away; each drop stretches
//           along its flight, carries a small shine, shrinks and is gone when it lands (the threshold rises with its age)
//   ground  the foam ring (a band of Worley cells pushed along the painted swirl, its threshold rising: it breaks into
//           bubbles and dissolves) with the impact disc at its centre for the first moments, and ripples running out past
//           it: light lines inked on their outer edge only, whole while young, breaking into dashes as they run out
//
// Every shape is in or out (a hard step, no soft fringe, no discard) and coloured through a few flat bands whose
// darkest band sits at its edge: its own ink rim. Premultiplied cover blend on every tier (water covers the board, it
// is not light); on high with bloom the white highlight band goes a little over white (the sparkle the bloom catches),
// and the impact disc's sparkle asks the flash guard first (flashGate) and is off with Flashes & shake off.
//
//   const water = createWaterFx({ scene, camera, quality, reduceMotion, rand });
//   water.splash('fresh', x, z, { size: 1 });   // world x / z (the sim's x / y), size × the preset's tiles
//   water.update(dt)                             // the visual clock's dt
//
// Draw cost: one instanced draw call per layer kind (crown, drops, ground: at most 3 while a splash is up, 0 when
// idle); every buffer is allocated once, for MAX_SPLASHES at the high tier, and update() writes numbers into it (no
// allocation a frame). Reduce Motion: no crown, drops, jet or ripples; a still foam ring that fades by erosion, slower
// (TOON_REDUCE.life) and a touch lighter (WATER_REDUCE_ALPHA). Randomness: the stream it is handed (createVisualRandom
// fork), never Math.random.
//
// Credits (licence texts, with their authors, in public/licenses/): the drops' clip of two feathered fields into merging
// blobs follows the idea of the "Procedural Metaballic Splash" shader (MIT, metaballic-splash-MIT.txt; our own code, no
// shader copied); the foam ring's outlined band (a step on a distance band plus a lower, offset step for its outline,
// wobbled by noise) follows a waterfall shader breakdown's foam (CC0, waterfall-foam-CC0-1.0.txt); the ripples' spaced
// rings running out with an exponential decay follow the stylized-components water ripples (MIT,
// stylized-components-MIT.txt), here cut by a rising threshold into dashes instead of fading.
import * as THREE from 'three';
import { WATER_PRESETS, WATER_TIERS, MAX_SPLASHES } from './waterPresets.js';
import { TOON_CORE, TOON_TIER, TOON_NOISE_N, TOON_RAMP_W, TOON_REDUCE, paintToonNoise, paintToonRamp, toonSparse, toonSmooth } from './toonCore.js';

/**
 * Reduce Motion: the still foam ring's strength. Water covers the board, so the core's 0.7 (a dimmer added light) would
 * read as a washed-out translucent ring; the still ring stays nearly solid and leaves by eroding, slower (TOON_REDUCE.life).
 */
export const WATER_REDUCE_ALPHA = 0.92;
/** The ground layer's height (over the road ribbon, terrain.js PATH_H 0.05). */
export const WATER_GROUND_Y = 0.07;
/** Radial segments and rings of the crown wall (one geometry for every tier). */
export const CROWN_SEGMENTS = 40;
/** Drop pairs a splash can hold (the high tier's). */
const MAX_PAIRS = WATER_TIERS.high.pairs;
/** Ripple rings a splash can hold (the high tier's). */
const MAX_RIPPLES = WATER_TIERS.high.ripples;
/** Randoms kept per drop pair: spike offset, speed, up, size, launch, split angle, split up. */
const PAIR_RND = 7;
/** High's extra drop clip (more drops than medium, each a little smaller: the mask only, never the colour). */
export const DROP_SPARSE = 0.12;
/** How far the drops' index walks along the ramp (lower than the crown's: the body stays aqua, the shine is the white). */
export const DROP_SLOPE = 0.72;
/** The crown's index slope: the house's 1.6 (a thin ink rim; the body is held at teal, the lip lifted to white). */
export const CROWN_SLOPE = 1.6;

// ------------------------------------------------------------------------------------------------ JS mirrors
// The crown's vertex maths in JS (the drops leave from where its lip is): keep in step with CROWN_VERT.

/** The crown's spread over its age (fast out, slow settle). */
export function crownSpread(age) {
  return 1 - Math.pow(1 - age, 2.6);
}
/** The crown's rise (all of it in the first 38 % of its age). */
export function crownRise(age) {
  return 1 - Math.pow(1 - Math.min(age / 0.38, 1), 3);
}
/** The crown's slump as it breaks. */
export function crownSink(age) {
  return 1 - 0.45 * toonSmooth(0.45, 1, age);
}

// ------------------------------------------------------------------------------------------------ shaders

const CROWN_VERT = /* glsl */`
attribute vec4 cA; // x, z, t (s since the splash), life (s)
attribute vec4 cB; // r0, r1, height, flare (< 0: the jet pinches in)
attribute vec4 cC; // seed, ramp row, alpha, hdr
attribute vec4 cD; // erode young, erode old, spikes, delay (s)
attribute vec4 cE; // kind (0 crown, 1 jet), noise along, slope, 0
varying vec2 vDir;
varying float vV;
varying float vAge;
varying float vOn;
varying float vFront;
varying float vRim;
varying vec4 vC;
varying vec4 vD;
varying vec4 vE;
float wSpread(float a) { return 1.0 - pow(1.0 - a, 2.6); }
float wRise(float a) { return 1.0 - pow(1.0 - min(a / 0.38, 1.0), 3.0); }
float wSink(float a) { return 1.0 - 0.45 * smoothstep(0.45, 1.0, a); }
void main() {
  float t = cA.z - cD.w;
  float age = clamp(t / cA.w, 0.0, 1.0);
  vOn = step(0.0, t) * step(t, cA.w);
  float v = position.y;
  vec2 dir = normalize(position.xz);
  float g = wSpread(age);
  float r = mix(cB.x, cB.y, g);
  float h = cB.z * wRise(age) * wSink(age);
  // the lip leans out as it rises (the jet's pinches in)
  float lean = cB.w * v * v * (0.6 + 0.4 * g);
  float rr = r * max(0.05, 1.0 + lean);
  vec3 wp = vec3(cA.x + dir.x * rr, ${WATER_GROUND_Y.toFixed(3)} + v * h, cA.y + dir.y * rr);
  // the wall's normal (radial, tipped down where the lip leans out), in view space: edge-on to the camera = its outline
  float drdv = r * cB.w * 2.0 * v * (0.6 + 0.4 * g);
  vec3 nv = normalize(mat3(viewMatrix) * normalize(vec3(dir.x * max(h, 0.02), -drdv, dir.y * max(h, 0.02))));
  vRim = 1.0 - abs(nv.z);
  // the arc facing the camera (whatever the board's turn)
  vFront = clamp(0.5 + 0.5 * (mat3(viewMatrix) * vec3(dir.x, 0.0, dir.y)).z / 0.75, 0.0, 1.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(wp, 1.0);
  vDir = position.xz;
  vV = v;
  vAge = age;
  vC = cC;
  vD = cD;
  vE = cE;
}`;

const CROWN_FRAG = /* glsl */`
uniform sampler2D uNoise;
uniform sampler2D uRamp;
${TOON_TIER}
varying vec2 vDir;
varying float vV;
varying float vAge;
varying float vOn;
varying float vFront;
varying float vRim;
varying vec4 vC;
varying vec4 vD;
varying vec4 vE;
${TOON_CORE}
void main() {
  float age = vAge;
  float u = atan(vDir.y, vDir.x) / 6.2831853 + vC.x; // the angle per pixel: no seam; whole-number scales wrap
  // the lip: the spike tips reach the top, the gaps between them dip (the jet has none)
  float s = abs(fract(u * vD.z) - 0.5) * 2.0;
  float lip = mix(1.0 - 0.36 * s * s, 1.0, vE.x);
  float vv = vV / lip;
  // solid up the wall and falling to 0 just under the lip line: the tongues keep a body (an ink rim, not all ink)
  float v2 = vv * vv;
  float band = 1.0 - v2 * v2;
  float n = toonNoise(uNoise, vec2(u * 3.0, vV * vE.y - age * 0.8), age * 0.3);
  float heat = toonHeat(band, n);
  float cut = toonCut(vD.xy, age);
  // the lip goes first (its tongues part into the drops), then the whole wall breaks into blobs
  float m = toonMask(heat, cut + 0.32 * age * vv + uSparse) * step(0.0, band) * vOn;
  float gain = mix(0.74, 1.0, vFront) * (gl_FrontFacing ? 1.0 : 0.8);
  float k = toonIndexS(heat - cut, vE.z, gain);
  // a thin ink rim at every edge (the house slope), the wall's body held at teal, the lip lifted to white (it catches
  // the light); never the top texel (the sparkle is the drops' and the impact's)
  float lipK = smoothstep(0.4, 0.9, vv);
  k = min(k * (1.0 + 0.6 * lipK), 0.62 + 0.24 * lipK);
  // where the wall turns edge-on to the camera: an ink line round its outline
  k *= 1.0 - step(0.88, vRim);
  vec3 col = toonRamp(uRamp, k, vC.y);
  float A = m * smoothstep(0.0, 0.04, age) * (1.0 - smoothstep(0.82, 1.0, age)) * vC.z;
  gl_FragColor = toonCover(col, A);
  #include <colorspace_fragment>
}`;

const DROPS_VERT = /* glsl */`
attribute vec4 dA; // drop A: world x, y, z, radius
attribute vec4 dB; // drop B: world x, y, z, radius
attribute vec4 dC; // flight direction (world, normalised), stretch along it
attribute vec4 dD; // age (0..1 of the pair's flight), ramp row, alpha, hdr
attribute vec4 dE; // erode young, erode old, slope, 0
varying vec2 vQ;
varying vec2 vPA;
varying vec2 vPB;
varying vec2 vFly;
varying vec4 vR;
varying vec4 vD;
varying vec4 vE;
void main() {
  // camera-facing: the view's right and up in world space (the rows of the view matrix)
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 c = 0.5 * (dA.xyz + dB.xyz);
  float hs = 0.5 * length(dA.xyz - dB.xyz) + 1.9 * max(dA.w, dB.w) * dC.w;
  vec2 q = position.xy * 2.0 * hs;
  vec3 wp = c + right * q.x + up * q.y;
  vQ = q;
  vPA = vec2(dot(dA.xyz - c, right), dot(dA.xyz - c, up));
  vPB = vec2(dot(dB.xyz - c, right), dot(dB.xyz - c, up));
  vec2 f = vec2(dot(dC.xyz, right), dot(dC.xyz, up));
  vFly = length(f) > 1e-4 ? normalize(f) : vec2(0.0, 1.0);
  vR = vec4(dA.w, dB.w, mix(1.0, dC.w, clamp(length(f) * 1.4, 0.0, 1.0)), dD.x);
  vD = dD;
  vE = dE;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;

const DROPS_FRAG = /* glsl */`
uniform sampler2D uRamp;
${TOON_TIER}
varying vec2 vQ;
varying vec2 vPA;
varying vec2 vPB;
varying vec2 vFly;
varying vec4 vR;
varying vec4 vD;
varying vec4 vE;
${TOON_CORE}
// one drop's feathered field: 1 at its middle, 0 at its radius (stretched along its flight)
float wBlob(vec2 q, vec2 p, float r, vec2 fly, float stretch) {
  vec2 d = q - p;
  float a = dot(d, fly) / stretch;
  float b = dot(d, vec2(-fly.y, fly.x));
  float x = (a * a + b * b) / max(r * r, 1e-6);
  float f = max(0.0, 1.0 - x);
  return f * f;
}
void main() {
  // the clip: both fields summed and cut by one hard threshold, so close drops are one blob and part as they separate
  float F = wBlob(vQ, vPA, vR.x, vFly, vR.z) + wBlob(vQ, vPB, vR.y, vFly, vR.z);
  float cut = toonCut(vE.xy, vR.w) + uSparse;
  float m = toonMask(F, cut);
  // the shine: a small field up and to the left of each drop
  vec2 off = vec2(-0.3, 0.34);
  float H = wBlob(vQ, vPA + off * vR.x, vR.x * 0.4, vFly, 1.0) + wBlob(vQ, vPB + off * vR.y, vR.y * 0.4, vFly, 1.0);
  float above = F - cut;
  float k = toonIndexS(above, vE.z, 1.0);
  k = max(k, 0.92 * step(0.3, H) * step(0.1, above));
  vec3 col = toonRamp(uRamp, k, vD.y);
  // the shine (the ramp's top texel) goes a little over white on high with bloom: a sparkle, never the body
  col *= 1.0 + vD.w * step(0.875, k);
  gl_FragColor = toonCover(col, m * vD.z);
  #include <colorspace_fragment>
}`;

const GROUND_VERT = /* glsl */`
attribute vec4 gA; // x, z, t (s since the splash), life (s)
attribute vec4 gB; // mode (0 foam ring, 1 ripple), r0, r1, width
attribute vec4 gC; // seed, ramp row, alpha, the impact disc's over-white (high with bloom, through the flash guard)
attribute vec4 gD; // erode young, erode old, delay (s), still (1 under Reduce Motion)
attribute vec4 gE; // decay (ripples), slope, gain (ripples stay aqua, the foam goes white), 0
varying vec2 vP;
varying vec4 vA;
varying vec4 vB;
varying vec4 vC;
varying vec4 vD;
varying vec4 vE;
void main() {
  float ext = gB.z + gB.w * 1.6;
  vec2 p = position.xz * ext;
  vec3 wp = vec3(gA.x + p.x, ${WATER_GROUND_Y.toFixed(3)} + 0.003 * gB.x, gA.y + p.y);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(wp, 1.0);
  vP = p;
  vA = gA;
  vB = gB;
  vC = gC;
  vD = gD;
  vE = gE;
}`;

const GROUND_FRAG = /* glsl */`
uniform sampler2D uNoise;
uniform sampler2D uRamp;
${TOON_TIER}
varying vec2 vP;
varying vec4 vA;
varying vec4 vB;
varying vec4 vC;
varying vec4 vD;
varying vec4 vE;
${TOON_CORE}
void main() {
  float t = vA.z - vD.z;
  float age = clamp(t / vA.w, 0.0, 1.0);
  float on = step(0.0, t) * step(t, vA.w);
  float still = vD.w;
  float move = 1.0 - still;
  float r = length(vP);
  float u = atan(vP.y, vP.x) / 6.2831853 + vC.x;
  float band;
  float heat;
  float cut;
  float plop = 0.0;
  float inner = 0.0;
  if (vB.x < 0.5) {
    // the foam ring: spreads out (held still under Reduce Motion), thins, and its band of bubbles (Worley cells pushed
    // along the swirl) erodes away: it breaks into bubbles and dissolves
    float R = mix(vB.y, vB.z, mix(1.0 - pow(1.0 - age, 2.2), 0.5, still));
    float x = (r - R) / (vB.w * mix(1.0, 0.8, age) * mix(1.0, 0.75, still));
    band = 1.0 - x * x;
    vec2 uv = vec2(u * 4.0, r * 1.25 - age * 0.3 * move);
    float cells = toonCells(uNoise, toonSwirl(uNoise, uv, 0.04 * move));
    float n = toonNoise(uNoise, uv * 0.5, 0.0);
    // (the cells take over as it ages: a band of foam that breaks into bubbles)
    heat = toonHeat(band, mix(n, cells, 0.35 + 0.45 * age));
    // the impact: a filled disc in the middle for the first moments (none under Reduce Motion)
    plop = move * (1.0 - smoothstep(0.0, 0.13, age)) * max(0.0, 1.0 - r / (vB.y * 1.15));
    heat = max(heat, plop * (1.1 + 0.4 * n));
    band = max(band, plop);
    cut = toonCut(vD.xy, pow(age, 1.6)); // (it lingers as bubbles before it dissolves)
  } else {
    // a ripple: a thin ring running out, fast then slow, breaking into dashes as its threshold climbs
    float R = mix(vB.y, vB.z, 1.0 - exp(-2.2 * age));
    float x = (r - R) / (vB.w * mix(1.0, 0.7, age));
    band = 1.0 - x * x;
    inner = step(x, 0.0); // (the inner half of the line: never ink, so a ripple is a light line inked on its outside)
    float n = toonNoise(uNoise, vec2(u * 9.0, age * 0.45 + vC.x), 0.0);
    heat = toonHeat(band, n);
    // (the exponential decay of a ring, cut instead of faded: whole while young, dashes as it runs out)
    cut = mix(vD.x, vD.y, pow(1.0 - exp(-vE.x * age), 1.8));
  }
  float m = toonMask(heat, cut) * step(0.0, band) * on;
  // the broad foam stops under the top texel; the impact's core reaches it
  float k = min(0.86, toonIndexS(heat - cut, vE.y, vE.z));
  k = max(k, 0.42 * inner);
  k = max(k, 0.95 * step(0.55, plop) * step(0.15, heat - cut));
  vec3 col = toonRamp(uRamp, k, vC.y);
  // the impact core's sparkle (high with bloom, through the flash guard; off with Flashes & shake off)
  col *= 1.0 + vC.w * step(0.875, k);
  float A = m * smoothstep(0.0, 0.02, age) * (1.0 - smoothstep(0.82, 1.0, age)) * vC.z;
  gl_FragColor = toonCover(col, A);
  #include <colorspace_fragment>
}`;

// ------------------------------------------------------------------------------------------------ the layer

const lerp = (a, b, k) => a + (b - a) * k;
/** Seconds a drop thrown up at `vy` from `h` above the ground takes to land under gravity `g`. */
const landTime = (vy, g, h) => (vy + Math.sqrt(vy * vy + 2 * g * Math.max(0, h))) / g;
/** A drop's radius `tt` s into a flight of `te` s: it shrinks as it falls and is gone when it lands. */
const dropRadius = (r0, tt, te) => (tt >= te ? 0 : r0 * (1 - 0.45 * (tt / te)));

/** Seconds a splash is up: its last ripple or its foam, whichever ends last. */
export function splashSeconds(p, tier, reduceMotion = false) {
  if (reduceMotion) return p.foamRing.life * TOON_REDUCE.life;
  const crown = Math.max(p.crown.life, tier.jet ? p.jet.delay + p.jet.life : 0);
  const ripples = p.ripple.spacing * Math.max(0, tier.ripples - 1) + p.ripple.life + p.crown.life * 0.3;
  return Math.max(crown + 0.6, p.foamRing.life, ripples);
}

/**
 * @param {{ scene: THREE.Object3D, camera?: THREE.Camera|null, quality?: 'high'|'medium'|'low', reduceMotion?: boolean,
 *   rand?: () => number, presets?: object, flashes?: boolean }} o
 */
export function createWaterFx({ scene, camera = null, quality = 'medium', reduceMotion = false, rand = null, presets = WATER_PRESETS, flashes = true }) {
  const ids = Object.keys(presets);
  // two ramp rows per preset: the crown and drops, then the ground (foam and ripples)
  const rowOf = (id, ground = false) => (ids.indexOf(id) + (ground ? ids.length : 0) + 0.5) / (ids.length * 2);
  const rnd = rand || (() => 0.5);
  let tier = WATER_TIERS[quality] || WATER_TIERS.medium;
  let tierName = WATER_TIERS[quality] ? quality : 'medium';
  let bloom = false;
  let rm = !!reduceMotion;
  let flashOn = flashes !== false;
  let held = false;

  // ---- textures (painted once: no image files)
  const noise = new THREE.DataTexture(paintToonNoise(TOON_NOISE_N, 13, { cells: 8, swirl: true }), TOON_NOISE_N, TOON_NOISE_N, THREE.RGBAFormat);
  noise.wrapS = noise.wrapT = THREE.RepeatWrapping;
  noise.magFilter = THREE.LinearFilter;
  noise.minFilter = THREE.LinearFilter;
  noise.needsUpdate = true;
  const rampRows = [...ids.map((id) => ({ bands: presets[id].ramp })), ...ids.map((id) => ({ bands: presets[id].foam }))];
  const ramp = new THREE.DataTexture(paintToonRamp(rampRows, TOON_RAMP_W), TOON_RAMP_W, ids.length * 2, THREE.RGBAFormat);
  ramp.magFilter = THREE.NearestFilter;
  ramp.minFilter = THREE.NearestFilter;
  ramp.colorSpace = THREE.SRGBColorSpace;
  ramp.needsUpdate = true;

  const material = (vert, frag, uniforms, order) => {
    const m = new THREE.ShaderMaterial({
      uniforms: { uRamp: { value: ramp }, uSparse: { value: 0 }, uCover: { value: 1 }, ...uniforms },
      vertexShader: vert,
      fragmentShader: frag,
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
    return { m, order };
  };

  /** An instanced layer: its geometry, one vec4 attribute per name, `max` instances, preallocated. */
  function layer(name, base, names, max, mat) {
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.attributes.position);
    const attrs = {};
    for (const k of names) {
      attrs[k] = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(k, attrs[k]);
    }
    geo.instanceCount = 0;
    const mesh = new THREE.Mesh(geo, mat.m);
    mesh.frustumCulled = false;
    mesh.renderOrder = mat.order;
    mesh.visible = false;
    mesh.name = name;
    scene.add(mesh);
    return { geo, base, attrs, list: Object.values(attrs), mesh, max, n: 0 };
  }

  const crownBase = new THREE.CylinderGeometry(1, 1, 1, CROWN_SEGMENTS, 5, true).translate(0, 0.5, 0);
  const dropBase = new THREE.PlaneGeometry(1, 1);
  const groundBase = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const crown = layer('waterCrown', crownBase, ['cA', 'cB', 'cC', 'cD', 'cE'], MAX_SPLASHES * 2, material(CROWN_VERT, CROWN_FRAG, { uNoise: { value: noise } }, 22));
  const drops = layer('waterDrops', dropBase, ['dA', 'dB', 'dC', 'dD', 'dE'], MAX_SPLASHES * MAX_PAIRS, material(DROPS_VERT, DROPS_FRAG, {}, 23));
  const ground = layer('waterGround', groundBase, ['gA', 'gB', 'gC', 'gD', 'gE'], MAX_SPLASHES * (1 + MAX_RIPPLES), material(GROUND_VERT, GROUND_FRAG, { uNoise: { value: noise } }, 6));
  const layers = [crown, drops, ground];

  // ---- the crown's triangles back to front for the view (one draw call holds the far wall's inside and the near
  // wall's outside: the far one must go first); re-sorted only when the camera turns
  const crownIndex = crownBase.index.array;
  const triCount = crownIndex.length / 3;
  const triOrder = new Uint32Array(triCount);
  const triDepth = new Float32Array(triCount);
  const triCopy = crownIndex.slice();
  let viewKey = NaN;
  function sortCrown() {
    if (!camera) return;
    const e = camera.matrixWorld.elements;
    // the camera looks along -z of its frame: forward = -(e8, e9, e10)
    const fx = -e[8];
    const fy = -e[9];
    const fz = -e[10];
    const key = Math.round(fx * 1000) * 1e6 + Math.round(fz * 1000) * 1e3 + Math.round(fy * 1000);
    if (key === viewKey) return;
    viewKey = key;
    const pos = crownBase.attributes.position.array;
    for (let i = 0; i < triCount; i++) {
      let d = 0;
      for (let j = 0; j < 3; j++) {
        const v = triCopy[i * 3 + j] * 3;
        d += pos[v] * fx + pos[v + 1] * 0.5 * fy + pos[v + 2] * fz;
      }
      triDepth[i] = d;
      triOrder[i] = i;
    }
    triOrder.sort((a, b) => triDepth[b] - triDepth[a]); // far first
    for (let i = 0; i < triCount; i++) {
      const s = triOrder[i] * 3;
      crownIndex[i * 3] = triCopy[s];
      crownIndex[i * 3 + 1] = triCopy[s + 1];
      crownIndex[i * 3 + 2] = triCopy[s + 2];
    }
    crownBase.index.needsUpdate = true;
  }

  // ---- the splash pool (allocated once; a splash fills a free record, or the oldest)
  const pool = [];
  for (let i = 0; i < MAX_SPLASHES; i++) {
    pool.push({ on: false, id: '', p: null, x: 0, z: 0, t: 0, size: 1, seed: 0, rowC: 0, rowG: 0, plopK: 1, seconds: 0, pairs: new Float32Array(MAX_PAIRS * PAIR_RND) });
  }
  let live = 0;

  /** Starts a splash. @returns {object|null} its record (live, read-only) */
  function splash(presetId, x, z, { size = 1 } = {}) {
    const p = presets[presetId];
    if (!p) return null;
    let rec = pool.find((r) => !r.on);
    if (!rec) {
      rec = pool[0];
      for (const r of pool) if (r.t > rec.t) rec = r;
    } else live++;
    rec.on = true;
    rec.id = presetId;
    rec.p = p;
    rec.x = x;
    rec.z = z;
    rec.t = 0;
    rec.size = Math.max(0.3, size);
    rec.seed = rnd();
    rec.rowC = rowOf(presetId, false);
    rec.rowG = rowOf(presetId, true);
    for (let i = 0; i < MAX_PAIRS * PAIR_RND; i++) rec.pairs[i] = rnd();
    // the impact sparkle asks the flash guard once (its size on the board, full strength)
    rec.plopK = flashOn && api.flashGate ? api.flashGate(p.foamRing.r0 * 2.6 * rec.size, null, 1) : (flashOn ? 1 : 0);
    rec.seconds = splashSeconds(p, tier, rm);
    return rec;
  }

  // ---- writers (numbers into the preallocated arrays)
  function writeCrown(rec, i, kind) {
    const p = rec.p;
    const s = rec.size;
    const j = i * 4;
    const A = crown.attrs.cA.array;
    const B = crown.attrs.cB.array;
    const C = crown.attrs.cC.array;
    const D = crown.attrs.cD.array;
    const E = crown.attrs.cE.array;
    const hdr = tier.hdr && bloom ? p.hdr : 0;
    if (kind === 0) {
      const c = p.crown;
      A[j] = rec.x; A[j + 1] = rec.z; A[j + 2] = rec.t; A[j + 3] = c.life;
      B[j] = c.r0 * s; B[j + 1] = c.r1 * s; B[j + 2] = c.height * s; B[j + 3] = c.flare;
      C[j] = rec.seed; C[j + 1] = rec.rowC; C[j + 2] = p.alpha; C[j + 3] = hdr;
      D[j] = c.erode[0]; D[j + 1] = c.erode[1]; D[j + 2] = c.spikes[tier.spikes] ?? c.spikes[0]; D[j + 3] = 0;
      E[j] = 0; E[j + 1] = c.noise; E[j + 2] = CROWN_SLOPE; E[j + 3] = 0;
    } else {
      const c = p.jet;
      A[j] = rec.x; A[j + 1] = rec.z; A[j + 2] = rec.t; A[j + 3] = c.life;
      B[j] = c.r * s; B[j + 1] = c.r * s * 1.25; B[j + 2] = c.height * s; B[j + 3] = -0.45;
      C[j] = rec.seed + 0.37; C[j + 1] = rec.rowC; C[j + 2] = p.alpha; C[j + 3] = hdr;
      D[j] = c.erode[0]; D[j + 1] = c.erode[1]; D[j + 2] = 1; D[j + 3] = c.delay;
      E[j] = 1; E[j + 1] = 1.6; E[j + 2] = CROWN_SLOPE; E[j + 3] = 0;
    }
  }

  /** Writes a drop pair's instance, or returns false when it is not in flight. */
  function writePair(rec, k, i) {
    const p = rec.p;
    const d = p.drops;
    const c = p.crown;
    const s = rec.size;
    const R = rec.pairs;
    const o = k * PAIR_RND;
    const spikes = c.spikes[tier.spikes] ?? c.spikes[0];
    const pairs = tier.pairs;
    // from a spike tip: the crown shader's tips sit at fract(u × spikes) = 0.5, u = angle / 2π + seed
    const m = Math.floor(((k + 0.5) * spikes) / pairs + (R[o] - 0.5) * 0.6);
    const ang = Math.PI * 2 * ((m + 0.5) / spikes - rec.seed);
    const tl = c.life * lerp(d.launch[0], d.launch[1], R[o + 4]);
    const tau = rec.t - tl;
    if (tau <= 0) return false;
    const al = tl / c.life;
    const g = crownSpread(al);
    const rLip = lerp(c.r0, c.r1, g) * s * (1 + c.flare * (0.6 + 0.4 * g));
    const yLip = WATER_GROUND_Y + c.height * s * crownRise(al) * crownSink(al);
    const k2 = Math.sqrt(s);
    const vh = lerp(d.speed[0], d.speed[1], R[o + 1]) * k2;
    const vy = lerp(d.up[0], d.up[1], R[o + 2]) * k2;
    const gr = d.gravity;
    // drop A, and drop B a little slower and to one side: one blob while they are close, two as they part
    const angB = ang + (R[o + 5] - 0.5) * 0.3;
    const vhB = vh * d.split;
    const vyB = vy * (0.86 + 0.1 * R[o + 6]);
    const tA = landTime(vy, gr, yLip - WATER_GROUND_Y);
    const tB = landTime(vyB, gr, yLip - WATER_GROUND_Y);
    const tEnd = Math.max(tA, tB);
    if (tau >= tEnd) return false;
    const r0 = d.size * s * (0.85 + 0.3 * R[o + 3]);
    const yA = yLip + vy * tau - 0.5 * gr * tau * tau;
    const yB = yLip + vyB * tau - 0.5 * gr * tau * tau;
    const j = i * 4;
    const DA = drops.attrs.dA.array;
    const DB = drops.attrs.dB.array;
    const DC = drops.attrs.dC.array;
    const DD = drops.attrs.dD.array;
    const DE = drops.attrs.dE.array;
    DA[j] = rec.x + Math.cos(ang) * (rLip + vh * tau);
    DA[j + 1] = Math.max(WATER_GROUND_Y, yA);
    DA[j + 2] = rec.z + Math.sin(ang) * (rLip + vh * tau);
    DA[j + 3] = dropRadius(r0, tau, tA);
    DB[j] = rec.x + Math.cos(angB) * (rLip + vhB * tau);
    DB[j + 1] = Math.max(WATER_GROUND_Y, yB);
    DB[j + 2] = rec.z + Math.sin(angB) * (rLip + vhB * tau);
    DB[j + 3] = dropRadius(r0, tau, tB) * 0.82;
    // flight direction (drop A's velocity now) and how far a fast drop stretches along it
    const fx = Math.cos(ang) * vh;
    const fy = vy - gr * tau;
    const fz = Math.sin(ang) * vh;
    const sp = Math.hypot(fx, fy, fz) || 1;
    DC[j] = fx / sp; DC[j + 1] = fy / sp; DC[j + 2] = fz / sp; DC[j + 3] = 1 + 0.55 * Math.min(1, sp / 2.4);
    DD[j] = tau / tEnd; DD[j + 1] = rec.rowC; DD[j + 2] = p.alpha; DD[j + 3] = tier.hdr && bloom ? p.hdr : 0;
    DE[j] = d.erode[0]; DE[j + 1] = d.erode[1]; DE[j + 2] = DROP_SLOPE; DE[j + 3] = 0;
    return true;
  }

  function writeGround(rec, i, mode, ring) {
    const p = rec.p;
    const s = rec.size;
    const j = i * 4;
    const A = ground.attrs.gA.array;
    const B = ground.attrs.gB.array;
    const C = ground.attrs.gC.array;
    const D = ground.attrs.gD.array;
    const E = ground.attrs.gE.array;
    if (mode === 0) {
      const f = p.foamRing;
      A[j] = rec.x; A[j + 1] = rec.z; A[j + 2] = rec.t; A[j + 3] = f.life * (rm ? TOON_REDUCE.life : 1);
      B[j] = 0; B[j + 1] = f.r0 * s; B[j + 2] = f.r1 * s; B[j + 3] = f.width * s;
      C[j] = rec.seed; C[j + 1] = rec.rowG; C[j + 2] = p.alpha * (rm ? WATER_REDUCE_ALPHA : 1); C[j + 3] = !rm && tier.hdr && bloom ? p.hdr * rec.plopK : 0;
      D[j] = f.erode[0]; D[j + 1] = f.erode[1]; D[j + 2] = 0; D[j + 3] = rm ? 1 : 0;
      E[j] = 0; E[j + 1] = 2.4; E[j + 2] = 1; E[j + 3] = 0;
    } else {
      const f = p.ripple;
      A[j] = rec.x; A[j + 1] = rec.z; A[j + 2] = rec.t; A[j + 3] = f.life;
      B[j] = 1; B[j + 1] = f.r0 * s * (1 + 0.12 * ring); B[j + 2] = f.r1 * s * (1 - 0.1 * ring); B[j + 3] = f.width * s;
      C[j] = rec.seed + 0.21 * (ring + 1); C[j + 1] = rec.rowG; C[j + 2] = p.alpha; C[j + 3] = 0;
      D[j] = f.erode[0]; D[j + 1] = f.erode[1]; D[j + 2] = p.crown.life * 0.3 + f.spacing * ring; D[j + 3] = 0;
      E[j] = f.decay; E[j + 1] = 2.0; E[j + 2] = 0.74; E[j + 3] = 0;
    }
  }

  function upload(L) {
    L.geo.instanceCount = L.n;
    for (const a of L.list) {
      a.clearUpdateRanges();
      if (L.n) a.addUpdateRange(0, L.n * 4);
      a.needsUpdate = L.n > 0;
    }
    L.mesh.visible = L.n > 0 && !held;
  }

  const api = {
    splash,
    /** The flash guard (BattleRenderer's flashGate): asked once per splash for the impact sparkle. */
    flashGate: null,
    /** Impact frames: the splash sits them out (update() keeps it hidden while held). */
    hold(on) {
      held = !!on;
      if (held) for (const L of layers) L.mesh.visible = false;
    },
    /** The three layer meshes (crown, drops, ground). */
    get meshes() {
      return layers.map((L) => L.mesh);
    },
    /** Advances and draws (the visual clock's dt). */
    update(dt) {
      sortCrown();
      crown.n = 0;
      drops.n = 0;
      ground.n = 0;
      for (const rec of pool) {
        if (!rec.on) continue;
        rec.t += dt;
        if (rec.t > rec.seconds) {
          rec.on = false;
          live--;
          continue;
        }
        if (!rm) {
          writeCrown(rec, crown.n++, 0);
          if (tier.jet) writeCrown(rec, crown.n++, 1);
          for (let k = 0; k < tier.pairs; k++) if (writePair(rec, k, drops.n)) drops.n++;
        }
        // the ripples first, so the foam ring (drawn after them in the same call) sits over them
        if (!rm) for (let r = 0; r < tier.ripples; r++) writeGround(rec, ground.n++, 1, r);
        writeGround(rec, ground.n++, 0, 0);
      }
      // high has more drops than medium, each clipped a little smaller (the mask only)
      drops.mesh.material.uniforms.uSparse.value = toonSparse(tier.pairs, WATER_TIERS.medium.pairs, DROP_SPARSE);
      for (const L of layers) upload(L);
    },
    setQuality(q) {
      tier = WATER_TIERS[q] || WATER_TIERS.medium;
      tierName = WATER_TIERS[q] ? q : 'medium';
    },
    /** Bloom on (high only): the white highlight band goes a little over white. */
    setGlow(q, on) {
      bloom = q === 'high' && !!on;
    },
    /** Settings → Reduce motion (new splashes and the ones up). */
    setReduceMotion(on) {
      rm = !!on;
      for (const rec of pool) if (rec.on) rec.seconds = splashSeconds(rec.p, tier, rm);
    },
    /** Settings → Flashes & shake (off: no impact sparkle). */
    setFlashes(on) {
      flashOn = !!on;
    },
    /** Live splashes (lab, tests). */
    get live() {
      return pool.filter((r) => r.on);
    },
    get stats() {
      return {
        live, tier: tierName, crown: crown.geo.instanceCount, drops: drops.geo.instanceCount, ground: ground.geo.instanceCount,
        calls: layers.filter((L) => L.mesh.visible).length,
      };
    },
    /** The preallocated arrays (tests: they never grow). */
    get buffers() {
      return layers.flatMap((L) => L.list.map((a) => a.array));
    },
    clear() {
      for (const rec of pool) rec.on = false;
      live = 0;
      for (const L of layers) {
        L.n = 0;
        upload(L);
      }
    },
    dispose() {
      for (const L of layers) {
        scene.remove(L.mesh);
        L.geo.dispose();
        L.mesh.material.dispose();
      }
      crownBase.dispose();
      dropBase.dispose();
      groundBase.dispose();
      noise.dispose();
      ramp.dispose();
    },
  };
  return api;
}
