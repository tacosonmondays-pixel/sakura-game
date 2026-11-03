// Toon beams: held beams, the charge-up and the impact crown on the shared toon core (docs/VFX.md "Toon beams", batch
// B3; display only, lab only: not wired into the battle yet, the lab is previews/beams.html). Hand-written shaders on
// src/render/vfx/toonCore.js, in the tornado's house look (luminous, layered, an inked outer silhouette, hard toon
// steps, noise erosion, premultiplied; never a soft glow tube):
//
//   body     a flowing band from the muzzle to the target: the house noise running out along it, a stepped ramp from
//            its white-hot middle out to its body colour, an ink rim on its outer silhouette only (none within
//            BEAM_FACE_CLEAR of the muzzle, so no ink ever crosses her face). Its start is hard-stepped (the head
//            races out as a spear tip, then the band punches in wider in two steps and settles); it holds; its end
//            thins in steps, its ink leaves (one front, muzzle first) and only then does the erosion open it, from
//            the muzzle on to the target, so it ends in its colour bands and never pops off. A zig-zag lance (Raika)
//            is the same band along a kinked path (mitred joints: no gap, no overlap), struck again on a stepped beat
//   prism    the duo's beam: a band per colour (the Grand Spectrum), side by side round the beam and twisting along it
//   charge   at the muzzle over her wind-up: a ring gathering in in hard steps and streaks converging on it, both
//            eroding in (no ink: it sits at her hand); its release bursts (flash-guarded) and erodes out
//   crown    at the hit point: an inked crown of tongues (stepped punch on the hit, its tongues re-rolled on a beat
//            while it holds), eroding out after its ink has left
//   ground   a stepped ring running out from the hit point (inked on its outer edge only, its ink leaving before it
//            breaks into dashes) and a glow pool under it that cools into a small scorch and erodes away
//
//   const beams = createToonBeamFx({ scene, camera, quality, reduceMotion, rand });
//   const b = beams.fire('umeko', [x, y, z], [x, y, z], { half, width });   // world points: the muzzle, the end
//   beams.aim(b, a, e, { hit })   // a held beam's ends this frame (a sweep, a walking enemy) and whether it hits
//   beams.release(b)              // a held beam ends (a fired lance ends by itself)
//   beams.update(dt)              // the visual clock's dt
//
// Draw cost: three instanced draw calls at most (the bodies, the camera-facing pieces, the ground pieces), 0 when idle.
// Every record, path and buffer is allocated once at the high tier's sizes; update() writes numbers into them.
// Randomness: the stream it is handed (createVisualRandom fork; without one a fixed fork of its own), never Math.random.
// Flash safety: every charge release and every impact asks the flash guard (flashGate) once; its answer scales the
// burst's white flash and the over-white boost (high with bloom only). Flashes & shake off: the guard is not asked,
// no burst flash, nothing over white. No preset colour is a harsh red. Reduce Motion: a still beam (no flow, no spin,
// no re-strike, no racing head, no punch), fading in; a still glow at the muzzle; no crown and no ring at the hit, a
// held glow pool instead; slower ends that erode in place.
//
// Credits (licence texts in public/licenses/): the beam's progress wipe and its outline over a core follow the idea of
// an "Energy Beams" shader (CC0, energy-beams-CC0-1.0.txt); the charge-up's gathering ring and the impact's ring follow
// the idea of a laser beam demo's charge and impact (MIT, laser-beam-MIT.txt). Our own GLSL, no code copied.
import * as THREE from 'three';
import {
  TOON_BEAM_PRESETS, TOON_BEAM_TIERS, TOON_BEAM_RAMP_W, BEAM_BAND, LANCE_HALF, MAX_TOON_BEAMS, MAX_BEAM_JOINTS,
} from './toonBeamPresets.js';
import { TOON_CORE, TOON_NOISE_N, TOON_REDUCE, paintToonNoise, paintToonRamp } from './toonCore.js';
import { createVisualRandom, visualSeed } from './random.js';

const TAU = Math.PI * 2;

// ------------------------------------------------------------------------------------------------ the beats

/** The erosion threshold while a piece is whole (its only edge is its slightly ragged outer silhouette). */
export const BEAM_YOUNG = 0.04;
/**
 * The body's threshold while it holds: higher than the other pieces', so its silhouette ripples with the flowing noise
 * (tongues along its edges), yet far under the least heat of its middle (0.3): never a hole while it holds.
 */
export const BODY_YOUNG = 0.12;
/** The threshold past every heat: nothing left. */
export const BEAM_OLD = 1.6;
/**
 * The beam's ink leaves at `end` of its end (± sweep / 2 along it: one clean front running from the muzzle on to the
 * target, so what is left of the rim is always one piece at the target end, never loose dashes), before the erosion
 * starts at BEAM_ERODE_AT: no hole and no fragment of an eroding beam is ever outlined.
 */
export const BEAM_INK = Object.freeze({ end: 0.12, sweep: 0.08 });
export const BEAM_ERODE_AT = 0.2;
/** The erosion front's lag along the beam: the muzzle end goes first, the target end last (Reduce Motion: in place). */
export const BEAM_LAG = 0.65;
/** No ink this near the muzzle (tiles along the beam): the beam leaves her hand, the ink never crosses her face. */
export const BEAM_FACE_CLEAR = 0.6;
/**
 * No ink within this radius (tiles, on screen) of her face (the beam's `face` point, her head): a beam from a familiar
 * behind her shoulder crosses her head on screen, and its ink must never cross her face.
 */
export const BEAM_FACE_R = 0.36;
/** The charge-up gathers this far (tiles) out of the muzzle towards the target: in front of her weapon, off her face. */
export const CHARGE_AHEAD = 0.16;
/** The ink rim: at least this many CSS px wide, and this much heat. */
export const BEAM_INK_PX = 1.7;
export const BEAM_INK_MIN = 0.05;
/** The ramp's steps from the middle out (heat above the cut): deep under BODY, then body, light, core, white over WHITE. */
export const BEAM_LEVELS = Object.freeze({ body: 0.16, light: 0.6, core: 0.9, white: 1.08 });
/** How much of the board each band hides (the glow cover: the colour is added, this share of the board hidden). */
export const BEAM_COVER = Object.freeze({ ink: 1, deep: 0.85, body: 0.74, light: 0.6, core: 0.86, white: 1 });
/** The canvas tiers add this share of a translucent band's colour (the linear target with bloom adds all of it). */
export const BEAM_CANVAS_ADD = 0.45;
/** The start: the head races out (preset.grow), then the band punches in at these widths, a step each PUNCH_STEP s. */
export const BEAM_PUNCH = Object.freeze([1.42, 1.16]);
export const PUNCH_STEP = 1 / 30;
/** The head's race in hard steps (its share of the length at each). */
export const HEAD_STEPS = 3;
/** The end thins in hard steps: the width share at each third of it. */
export const BEAM_END_WIDTH = Object.freeze([1, 0.84, 0.7]);
/** The leader's width share while the head races out. */
export const LEADER_WIDTH = 0.62;

/** The charge ring gathers in from CHARGE_R[0] to CHARGE_R[1] (× its size) in CHARGE_STEPS hard steps over the wind-up. */
export const CHARGE_R = Object.freeze([0.86, 0.36]);
export const CHARGE_STEPS = 4;
/** Its threshold at the wind-up's start (it erodes in to BEAM_YOUNG). */
export const CHARGE_IN = 0.75;
/** The release: the ring bursts out to CHARGE_BURST × its size and erodes out over this many s. */
export const CHARGE_RELEASE = 0.1;
export const CHARGE_BURST = 0.78;

/** The crown punches in at these radius shares, a step each PUNCH_STEP s, then holds at 1. */
export const CROWN_PUNCH = Object.freeze([0.62, 1.18]);
/** The crown's ink leaves at `end` of its end (± wobble / 2), before its erosion starts at CROWN_ERODE_AT. */
export const CROWN_INK = Object.freeze({ end: 0.12, wobble: 0.08 });
export const CROWN_ERODE_AT = 0.2;
/** The crown's hole (share of its radius) once its burst is over: the enemy it hits stays visible through it. */
export const CROWN_HOLE = 0.4;
/** A crown on its own (a hit that left a held beam) ends over this many s. */
export const CROWN_END = 0.16;

/** The ground ring runs out in hard steps (radius shares over its life). */
export const RING_STEPS = Object.freeze([0.42, 0.66, 0.86, 1]);
/** Its ink leaves at `end` of its age (± wobble / 2), before it breaks into dashes at RING_ERODE_AT. */
export const RING_INK = Object.freeze({ end: 0.42, wobble: 0.1 });
export const RING_ERODE_AT = 0.54;
export const RING_OLD = 1.2;

/** Reduce Motion: a still beam, glow or pool fades in over this many s (no hard on-cut). */
export const REDUCE_FADE = 0.12;
/** The ground pieces' height (over the road ribbon, under the water's). */
export const BEAM_GROUND_Y = 0.062;

const PIECES = MAX_TOON_BEAMS * 2;
const SEGS = MAX_TOON_BEAMS * (MAX_BEAM_JOINTS - 1);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

// ------------------------------------------------------------------------------------------------ JS mirrors (tests)

/** Is the beam's ink still on at end progress e (−1: not ending), at share f of its length from the muzzle? (shader mirror) */
export function beamInked(e, f) {
  return e < 0 ? 1 : e + BEAM_INK.sweep * (0.5 - f) < BEAM_INK.end ? 1 : 0;
}
/** The beam's erosion threshold at end progress e, at share f of its length from the muzzle. (shader mirror) */
export function beamCut(e, f, lag = BEAM_LAG) {
  if (e < 0) return BODY_YOUNG;
  const k = clamp(((e - BEAM_ERODE_AT) / (1 - BEAM_ERODE_AT)) * (1 + lag) - lag * f, 0, 1);
  return BODY_YOUNG + (BEAM_OLD - BODY_YOUNG) * k;
}
/** The crown's ink and threshold at its end progress e. (shader mirrors) */
export function crownInked(e, n) {
  return e < 0 ? 1 : e + CROWN_INK.wobble * (n - 0.5) < CROWN_INK.end ? 1 : 0;
}
export function crownCut(e) {
  return e < 0 ? BEAM_YOUNG : BEAM_YOUNG + (BEAM_OLD - BEAM_YOUNG) * clamp((e - CROWN_ERODE_AT) / (1 - CROWN_ERODE_AT), 0, 1);
}
/** The ground ring's ink and threshold at its age (0..1). (shader mirrors) */
export function ringInked(age, n) {
  return age + RING_INK.wobble * (n - 0.5) < RING_INK.end ? 1 : 0;
}
export function ringCut(age) {
  return BEAM_YOUNG + (RING_OLD - BEAM_YOUNG) * clamp((age - RING_ERODE_AT) / (1 - RING_ERODE_AT), 0, 1);
}

// ------------------------------------------------------------------------------------------------ shaders

const f2 = (v) => v.toFixed(3);

/** Shared fragment helpers: the bands, the ink rim, a small hash (seeded by the record, never by time). */
const BEAM_HELPERS = /* glsl */`
uniform sampler2D uNoise;
uniform sampler2D uRamp;
uniform float uRows;  // ramp rows (three a preset: its bands, its stripes, its light stripes)
uniform float uAdd;   // the glow's added share where a band covers little: 1 into the linear target, less on the canvas
${TOON_CORE}
// [beam] the ramp texel of band i in row r of preset p (8 a row, NearestFilter: flat steps)
vec3 bRamp(float i, float p, float r) { return toonRamp(uRamp, (i + 0.5) / 8.0, (p * 3.0 + r + 0.5) / uRows); }
// [beam] 1 on a thin rim inside a shape's edge: at least px pixels on screen, and minW of its own heat
float bRim(float above, float px, float minW) { return step(above, max(minW, px * fwidth(above))); }
// [beam] a small hash of a whole number (a record's seed and a tongue's index: never time)
float bHash(float x) { return fract(sin(x * 12.9898 + 4.1414) * 43758.5453); }
// [beam] the stepped ramp from the middle out: body, light, core, white (heat above the cut); the hot band's flag in .y
vec2 bLevel(float above) {
  float b = ${BEAM_BAND.deep.toFixed(1)};
  b = mix(b, ${BEAM_BAND.body.toFixed(1)}, step(${f2(BEAM_LEVELS.body)}, above));
  b = mix(b, ${BEAM_BAND.light.toFixed(1)}, step(${f2(BEAM_LEVELS.light)}, above));
  b = mix(b, ${BEAM_BAND.core.toFixed(1)}, step(${f2(BEAM_LEVELS.core)}, above));
  float hot = step(${f2(BEAM_LEVELS.white)}, above);
  b = mix(b, ${BEAM_BAND.white.toFixed(1)}, hot);
  return vec2(b, hot);
}
float bCover(float b) {
  float c = ${f2(BEAM_COVER.deep)};
  c = mix(c, ${f2(BEAM_COVER.body)}, step(${(BEAM_BAND.body - 0.5).toFixed(1)}, b));
  c = mix(c, ${f2(BEAM_COVER.light)}, step(${(BEAM_BAND.light - 0.5).toFixed(1)}, b));
  c = mix(c, ${f2(BEAM_COVER.core)}, step(${(BEAM_BAND.core - 0.5).toFixed(1)}, b));
  c = mix(c, ${f2(BEAM_COVER.white)}, step(${(BEAM_BAND.white - 0.5).toFixed(1)}, b));
  return c;
}
`;

const BODY_VERT = /* glsl */`
attribute vec4 bA; // a: x, y, z, u at a (tiles from the muzzle)
attribute vec4 bB; // b: x, y, z, u at b
attribute vec4 bC; // the joint before a: x, y, z (a itself on the first segment), half width
attribute vec4 bD; // the joint after b: x, y, z (b itself on the last segment), the path's length
attribute vec4 bE; // head (u: nothing past it), end progress (-1: not ending), strength, the noise's scale along it
attribute vec4 bF; // preset, flow (noise offset along it), seed, over-white
attribute vec4 bG; // prism stripes (0: none), stripe spin, stripes a tile (twist), erosion lag
attribute vec4 bH; // her face: x, y, z, radius (0: none)
uniform float uPx; // world units per CSS px
varying vec2 vUV;  // along (u, tiles), across (v, -1 .. 1)
varying vec3 vFace; // the pixel's offset from her face in the view plane, and the face's radius
varying float vW;
varying float vL;
varying vec4 vE;
varying vec4 vF;
varying vec4 vG;
void main() {
  vec4 a = modelViewMatrix * vec4(bA.xyz, 1.0);
  vec4 b = modelViewMatrix * vec4(bB.xyz, 1.0);
  vec4 p = modelViewMatrix * vec4(bC.xyz, 1.0);
  vec4 q = modelViewMatrix * vec4(bD.xyz, 1.0);
  float s = position.x;    // 0 at a, 1 at b
  float side = position.y; // -1 .. 1 across
  vec2 d = b.xy - a.xy;
  float len = length(d);
  vec2 dir = len > 1e-5 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  // the joint's mitre: the bisector of this segment's normal and its neighbour's (no gap and no overlap at a kink)
  vec2 o = s < 0.5 ? a.xy - p.xy : q.xy - b.xy;
  float ol = length(o);
  vec2 od = ol > 1e-5 ? o / ol : dir;
  vec2 mm = nrm + vec2(-od.y, od.x);
  vec2 mitre = dot(mm, mm) > 1e-6 ? normalize(mm) : nrm;
  float mk = 1.0 / max(dot(mitre, nrm), 0.5);
  float w = max(bC.w, 1.5 * uPx);
  vec4 c = s < 0.5 ? a : b;
  vec2 xy = c.xy + mitre * (side * w * mk);
  gl_Position = projectionMatrix * vec4(xy, c.z, 1.0);
  vFace = vec3(xy - (modelViewMatrix * vec4(bH.xyz, 1.0)).xy, bH.w);
  vUV = vec2(mix(bA.w, bB.w, s), side);
  vW = w;
  vL = bD.w;
  vE = bE;
  vF = bF;
  vG = bG;
}`;

const BODY_FRAG = /* glsl */`
varying vec2 vUV;
varying vec3 vFace;
varying float vW;
varying float vL;
varying vec4 vE;
varying vec4 vF;
varying vec4 vG;
${BEAM_HELPERS}
void main() {
  float u = vUV.x;
  float v = vUV.y;
  float L = max(vL, 1e-3);
  float W = vW;
  // its shape along it: it grows out of a point at the muzzle, a spear tip while the head races out, round at the target
  float sIn = clamp(u / max(2.0 * W, 0.12), 0.0, 1.0);
  float sHead = clamp((vE.x - u) / (1.6 * W), 0.0, 1.0);
  float sEnd = clamp((L - u) / (0.9 * W), 0.0, 1.0);
  float shape = min(sqrt(sIn), min(sHead, sqrt(sEnd)));
  float x = v / max(shape, 1e-3);
  // (where its shape is a sliver, nothing: no lone pixels on its centre line past the head)
  float band = shape < 0.04 ? -1.0 : 1.0 - x * x;
  // the house noise running out along it (flow), barely across it: its silhouette stays one clean curve (no islands)
  float n = toonNoise(uNoise, vec2(u * vE.w - vF.y, v * 0.1 + vF.z), vF.y * 0.27);
  float heat = toonHeat(band, n) + 0.12 * pow(max(band, 0.0), 6.0);
  // its end: the ink leaves first (one clean front from the muzzle on), then the threshold rises from the muzzle on
  float e = vE.y;
  float inked = e < 0.0 ? 1.0 : step(e + ${f2(BEAM_INK.sweep)} * (0.5 - u / L), ${f2(BEAM_INK.end)});
  float k = e < 0.0 ? 0.0 : clamp((e - ${f2(BEAM_ERODE_AT)}) / ${f2(1 - BEAM_ERODE_AT)} * (1.0 + vG.w) - vG.w * (u / L), 0.0, 1.0);
  float cut = mix(${f2(BODY_YOUNG)}, ${f2(BEAM_OLD)}, k);
  float m = toonMask(heat, cut) * step(0.0, band);
  float above = heat - cut;
  // ink: a rim inside the outer silhouette only, never near the muzzle (her face)
  float clear = step(${f2(BEAM_FACE_CLEAR)} + 0.1 * (n - 0.5), u) * step(vFace.z, length(vFace.xy));
  float ink = bRim(above, ${f2(BEAM_INK_PX)}, ${f2(BEAM_INK_MIN)}) * inked * clear;
  vec2 lv = bLevel(above);
  float bi = lv.x;
  vec3 col;
  if (vG.x > 0.5) {
    // the prism: a band per colour round the beam (2N round it, N facing the camera), side by side and twisting
    float N = vG.x;
    float phi = asin(clamp(x, -1.0, 1.0));
    float sIdx = (phi / 3.14159265 + 0.5) * N + vG.y + u * vG.z;
    float idx = mod(floor(sIdx), N);
    float row = step(${f2(BEAM_LEVELS.core)}, above) + 1.0;
    col = bRamp(1.0 + idx, vF.x, row);
    col = mix(col, bRamp(7.0, vF.x, 1.0), lv.y);
    bi = mix(${BEAM_BAND.body.toFixed(1)}, ${BEAM_BAND.light.toFixed(1)}, step(${f2(BEAM_LEVELS.core)}, above));
    // (the stripes have no deep band: their own colour to the rim)
    bi = mix(bi, ${BEAM_BAND.white.toFixed(1)}, lv.y);
  } else {
    col = bRamp(bi, vF.x, 0.0);
  }
  float cover = bCover(bi);
  col = mix(col, bRamp(${BEAM_BAND.ink.toFixed(1)}, vF.x, 0.0), ink);
  cover = mix(cover, ${f2(BEAM_COVER.ink)}, ink);
  // the white band goes a little over white on high with bloom (through the flash guard)
  col *= 1.0 + vF.w * lv.y * (1.0 - ink);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  gl_FragColor = toonAdd(gl_FragColor.rgb, m * vE.z, mix(uAdd, 1.0, cover), cover);
}`;

const SPOT_VERT = /* glsl */`
attribute vec4 sA; // centre x, y, z, size (world: the quad's half extent)
attribute vec4 sB; // mode (0 charge, 1 crown), scale (charge: its progress 0..1; crown: its radius share), end (-1), seed
attribute vec4 sC; // preset, over-white, strength, flash (the burst's white, through the flash guard)
attribute vec4 sD; // charge: ring radius, ring half width, streaks, streak reach | crown: tongues, beat, hole, -
varying vec2 vQ;
varying vec4 vB;
varying vec4 vC;
varying vec4 vD;
void main() {
  vec4 c = modelViewMatrix * vec4(sA.xyz, 1.0);
  c.xy += position.xy * sA.w * step(0.0005, sC.z);
  // a crown stands in front of the enemy it hits (none of it cut by the body: no slivers), its hole keeps it visible
  c.z += sB.x * sA.w * 1.5;
  gl_Position = projectionMatrix * c;
  vQ = position.xy;
  vB = sB;
  vC = sC;
  vD = sD;
}`;

const SPOT_FRAG = /* glsl */`
varying vec2 vQ;
varying vec4 vB;
varying vec4 vC;
varying vec4 vD;
${BEAM_HELPERS}
void main() {
  float r = length(vQ);
  float u = atan(vQ.y, vQ.x) / 6.2831853 + 0.5;
  float seed = vB.w;
  float m;
  float above;
  float ink = 0.0;
  float flash;
  if (vB.x < 0.5) {
    // the charge-up: a ring gathering in and streaks converging on it, eroding in over the wind-up (no ink: it sits
    // at her hand, near her face); its release bursts and erodes out
    float R = vD.x;
    float hw = vD.y;
    float xr = (r - R) / max(hw, 1e-3);
    float ring = 1.0 - xr * xr;
    float streak = 0.0;
    float N = vD.z;
    if (N > 0.5) {
      float sec = u * N + seed;
      float fi = floor(sec);
      float h = bHash(fi + seed * 7.0);
      float across = (fract(sec) - 0.5 - (h - 0.5) * 0.4) / N * 6.2831853 * r;
      float r0 = R + hw * 0.5;
      float r1 = R + vD.w * (0.65 + 0.35 * h);
      float al = (r - r0) / max(r1 - r0, 1e-3);
      float sw = 0.15 * (1.0 - 0.55 * al);
      streak = (1.0 - (across / sw) * (across / sw)) * step(0.0, al) * step(al, 1.0);
    }
    float band = max(ring, streak);
    float n = toonNoise(uNoise, vec2(u * 3.0 + seed, r * 0.7 + seed * 0.37), 0.0);
    float heat = toonHeat(band, n);
    float cut = vB.z < 0.0 ? mix(${f2(CHARGE_IN)}, ${f2(BEAM_YOUNG)}, vB.y) : mix(${f2(BEAM_YOUNG)}, ${f2(BEAM_OLD)}, vB.z);
    m = toonMask(heat, cut) * step(0.0, band);
    above = heat - cut;
    // the release's white flash inside the ring (flash-guarded)
    flash = step(r, R * 0.85) * vC.w;
  } else {
    // the crown: a ring of tongues round the hit point (their lengths re-rolled on the beat), its hole open once the
    // hit's flash is over (the enemy stays visible through it), inked on its outer silhouette only while whole; its
    // ink leaves before it erodes out
    float N = vD.x;
    float sec = u * N + seed;
    float fi = floor(sec);
    float len = 0.55 + 0.45 * bHash(fi + vD.y * 3.1 + seed);
    float tri = 1.0 - abs(fract(sec) - 0.5) * 2.0;
    float Rt = vB.y * (0.5 + 0.5 * len * pow(tri, 1.3));
    float Rin = vB.y * vD.z;
    float x = (r - Rin) / max(Rt - Rin, 1e-3);
    float band = Rin > 0.0 ? 1.0 - (2.0 * x - 1.0) * (2.0 * x - 1.0) : 1.0 - x * x;
    float n = toonNoise(uNoise, vec2(u * 2.0 + seed, r * 0.35 + vD.y * 0.13), 0.0);
    float heat = toonHeat(band, n) + 0.2 * pow(max(band, 0.0), 4.0);
    float e = vB.z;
    float inked = e < 0.0 ? 1.0 : step(e + ${f2(CROWN_INK.wobble)} * (n - 0.5), ${f2(CROWN_INK.end)});
    float cut = e < 0.0 ? ${f2(BEAM_YOUNG)} : mix(${f2(BEAM_YOUNG)}, ${f2(BEAM_OLD)}, clamp((e - ${f2(CROWN_ERODE_AT)}) / ${f2(1 - CROWN_ERODE_AT)}, 0.0, 1.0));
    m = toonMask(heat, cut) * step(0.0, band);
    above = heat - cut;
    // (the outer silhouette only: never the hole's edge)
    ink = bRim(above, ${f2(BEAM_INK_PX)}, ${f2(BEAM_INK_MIN)}) * inked * step(0.5, x);
    // the hit's white flash in its middle while it bursts (flash-guarded)
    flash = step(r, vB.y * 0.42) * vC.w * (1.0 - ink);
    m = max(m, step(r, vB.y * 0.42) * vC.w);
  }
  vec2 lv = bLevel(above);
  float bi = mix(lv.x, ${BEAM_BAND.white.toFixed(1)}, flash);
  float hot = max(lv.y, flash);
  vec3 col = bRamp(bi, vC.x, 0.0);
  float cover = bCover(bi);
  col = mix(col, bRamp(${BEAM_BAND.ink.toFixed(1)}, vC.x, 0.0), ink);
  cover = mix(cover, ${f2(BEAM_COVER.ink)}, ink);
  col *= 1.0 + vC.y * hot * (1.0 - ink);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  gl_FragColor = toonAdd(gl_FragColor.rgb, m * vC.z, mix(uAdd, 1.0, cover), cover);
}`;

const GROUND_VERT = /* glsl */`
attribute vec4 gA; // x, z, size (the quad's half extent), mode (0 ring, 1 pool)
attribute vec4 gB; // ring: age 0..1 | pool: its scale; end (-1), seed, strength
attribute vec4 gC; // preset, ring radius (share of size), ring half width (share), flow
varying vec2 vP;
varying vec4 vA;
varying vec4 vB;
varying vec4 vC;
void main() {
  vec2 p = position.xz * gA.z * step(0.0005, gB.w);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(gA.x + p.x, ${BEAM_GROUND_Y.toFixed(3)} + 0.002 * gA.w, gA.y + p.y, 1.0);
  vP = position.xz;
  vA = gA;
  vB = gB;
  vC = gC;
}`;

const GROUND_FRAG = /* glsl */`
varying vec2 vP;
varying vec4 vA;
varying vec4 vB;
varying vec4 vC;
${BEAM_HELPERS}
void main() {
  float r = length(vP);
  float u = atan(vP.y, vP.x) / 6.2831853 + 0.5;
  float seed = vB.z;
  float m;
  float above;
  float ink = 0.0;
  float cool = 0.0;
  if (vA.w < 0.5) {
    // the stepped ring: a light line running out in hard steps, inked on its outer edge only; its ink leaves
    // before it breaks into dashes (colour, never ink)
    float age = vB.x;
    float xr = (r - vC.y) / max(vC.z, 1e-3);
    float band = 1.0 - xr * xr;
    float n = toonNoise(uNoise, vec2(u * 4.0 + seed, 0.35 + seed), 0.0);
    float heat = toonHeat(band, n);
    float inked = step(age + ${f2(RING_INK.wobble)} * (n - 0.5), ${f2(RING_INK.end)});
    float cut = mix(${f2(BEAM_YOUNG)}, ${f2(RING_OLD)}, clamp((age - ${f2(RING_ERODE_AT)}) / ${f2(1 - RING_ERODE_AT)}, 0.0, 1.0));
    m = toonMask(heat, cut) * step(0.0, band);
    above = heat - cut;
    ink = bRim(above, ${f2(BEAM_INK_PX)}, ${f2(BEAM_INK_MIN)}) * step(0.0, xr) * inked;
  } else {
    // the glow pool under the hit point: light bands that cool as the beam ends (a small scorch) and erode from
    // its rim inward (no ink)
    float x = r / max(vB.x, 1e-3);
    float band = 1.0 - x * x;
    float n = toonNoise(uNoise, vec2(u * 3.0 + seed, x * 0.5 + seed * 0.41 - vC.w), 0.0);
    float heat = toonHeat(band, n) + 0.12 * pow(max(band, 0.0), 3.0);
    float e = vB.y;
    float cut = e < 0.0 ? ${f2(BEAM_YOUNG)} : mix(${f2(BEAM_YOUNG)}, ${f2(BEAM_OLD)}, clamp(e, 0.0, 1.0));
    m = toonMask(heat, cut) * step(0.0, band);
    above = heat - cut;
    cool = e < 0.0 ? 0.0 : step(0.25, e + 0.2 * (n - 0.5)) + step(0.5, e + 0.2 * (n - 0.5));
  }
  vec2 lv = bLevel(above);
  float bi = max(${BEAM_BAND.deep.toFixed(1)}, lv.x - cool);
  vec3 col = bRamp(bi, vC.x, 0.0);
  float cover = bCover(bi) * (vA.w < 0.5 ? 1.0 : 0.6);
  col = mix(col, bRamp(${BEAM_BAND.ink.toFixed(1)}, vC.x, 0.0), ink);
  cover = mix(cover, ${f2(BEAM_COVER.ink)}, ink);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  gl_FragColor = toonAdd(gl_FragColor.rgb, m * vB.w, mix(uAdd, 1.0, cover), cover);
}`;

/** Every shader's text (the tests read the beats out of them). */
export const TOON_BEAM_SHADERS = Object.freeze({ BODY_VERT, BODY_FRAG, SPOT_VERT, SPOT_FRAG, GROUND_VERT, GROUND_FRAG });

// ------------------------------------------------------------------------------------------------ the layer

/** The ramp rows: three a preset (its bands; its stripes; its light stripes), painted once. */
export function paintBeamRamp(ids, presets = TOON_BEAM_PRESETS) {
  const rows = [];
  for (const id of ids) {
    const p = presets[id];
    rows.push({ bands: p.ramp });
    if (p.stripes) {
      const pad = (list) => {
        const out = [p.ramp[0], ...list];
        while (out.length < TOON_BEAM_RAMP_W - 1) out.push(p.ramp[BEAM_BAND.white]);
        out.push('#ffffff');
        return out.slice(0, TOON_BEAM_RAMP_W);
      };
      const light = p.stripes.map((h) => `#${new THREE.Color(h).lerp(new THREE.Color('#ffffff'), 0.5).getHexString()}`);
      rows.push({ bands: pad(p.stripes) }, { bands: pad(light) });
    } else {
      rows.push({ bands: p.ramp }, { bands: p.ramp });
    }
  }
  return paintToonRamp(rows, TOON_BEAM_RAMP_W);
}

function beamRec(slot) {
  return {
    on: false, gen: 0, slot, id: '', p: null, pi: 0, held: false, prism: false,
    A: new Float64Array(3), B: new Float64Array(3), F: new Float64Array(3), faceR: 0, P: new Float32Array(MAX_BEAM_JOINTS * 3), U: new Float32Array(MAX_BEAM_JOINTS), nj: 2,
    half: 0.1, t: 0, wu: 0.18, endAt: Infinity, fade: 0.2, seed: 0, next: 0, strikes: 0,
    relK: 1, hitK: 1, released: false, hit: true, crownAt: -1, crownEnd: -1, beat: 0, beatAt: 0, ringAt: -1, rings: 0,
    flow: 0, spin: 0, stripes: 0, gates: 0,
  };
}

/**
 * @param {{ scene: THREE.Object3D, camera?: THREE.Camera|null, quality?: 'high'|'medium'|'low', reduceMotion?: boolean,
 *   rand?: () => number, presets?: object, flashes?: boolean }} o
 */
export function createToonBeamFx({ scene, camera = null, quality = 'medium', reduceMotion = false, rand = null, presets = TOON_BEAM_PRESETS, flashes = true }) {
  void camera;
  const ids = Object.keys(presets);
  const rnd = rand || createVisualRandom(visualSeed('toonBeams', 'fallback'));
  let tierName = TOON_BEAM_TIERS[quality] ? quality : 'medium';
  let tier = TOON_BEAM_TIERS[tierName];
  let bloom = false;
  let rm = !!reduceMotion;
  let flashOn = flashes !== false;
  let held = false;
  let gates = 0;
  let drawnSegs = 0;
  let drawnSpots = 0;
  let drawnGround = 0;

  // ---- textures (painted once: no image files)
  const noise = new THREE.DataTexture(paintToonNoise(TOON_NOISE_N, 53), TOON_NOISE_N, TOON_NOISE_N, THREE.RGBAFormat);
  noise.wrapS = noise.wrapT = THREE.RepeatWrapping;
  noise.magFilter = THREE.LinearFilter;
  noise.minFilter = THREE.LinearFilter;
  noise.needsUpdate = true;
  const ramp = new THREE.DataTexture(paintBeamRamp(ids, presets), TOON_BEAM_RAMP_W, ids.length * 3, THREE.RGBAFormat);
  ramp.magFilter = THREE.NearestFilter;
  ramp.minFilter = THREE.NearestFilter;
  ramp.colorSpace = THREE.SRGBColorSpace;
  ramp.needsUpdate = true;
  const shared = { uNoise: { value: noise }, uRamp: { value: ramp }, uRows: { value: ids.length * 3 }, uAdd: { value: BEAM_CANVAS_ADD } };

  const material = (vert, frag, extra = {}) => new THREE.ShaderMaterial({
    uniforms: { ...shared, ...extra },
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
  const layer = (base, names, count, mat, order, name) => {
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.attributes.position);
    const attrs = [];
    for (const k of names) {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4).setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(k, a);
      attrs.push(a);
    }
    geo.instanceCount = 0;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = order;
    mesh.visible = false;
    mesh.name = name;
    scene.add(mesh);
    return { geo, attrs, mesh, A: attrs.map((a) => a.array) };
  };

  // the body strip: two columns (a, b) × three rows across (-1, 0, 1)
  const strip = new THREE.BufferGeometry();
  strip.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0], 3));
  strip.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5]);
  const quad = new THREE.PlaneGeometry(2, 2);
  const flat = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const bodyMat = material(BODY_VERT, BODY_FRAG, { uPx: { value: 0.02 } });
  const spotMat = material(SPOT_VERT, SPOT_FRAG);
  const groundMat = material(GROUND_VERT, GROUND_FRAG);
  const body = layer(strip, ['bA', 'bB', 'bC', 'bD', 'bE', 'bF', 'bG', 'bH'], SEGS, bodyMat, 22, 'toonBeamBody');
  const spots = layer(quad, ['sA', 'sB', 'sC', 'sD'], PIECES, spotMat, 23, 'toonBeamSpots');
  const ground = layer(flat, ['gA', 'gB', 'gC'], PIECES, groundMat, 6, 'toonBeamGround');
  const layers = [body, spots, ground];
  // (the attribute arrays, named once: the hot path never destructures, so nothing is allocated a frame)
  const [bA, bB, bC, bD, bE, bF, bG, bH] = body.A;
  const [sA, sB, sC, sD] = spots.A;
  const [gA, gB, gC] = ground.A;

  // ---- the pool of records (allocated once)
  const recs = [];
  for (let i = 0; i < MAX_TOON_BEAMS; i++) recs.push(beamRec(i));

  /** The flash guard's answer for one flash (its size, world units). */
  function gate(size, strength) {
    if (!flashOn || !api.flashGate) return 1;
    gates++;
    return api.flashGate(size, null, strength);
  }

  // ---- the beats of a record (seconds from its fire)
  const windupOf = (rec) => rec.wu;
  const landAt = (rec) => rec.wu + (rm ? 0 : rec.p.grow);
  const fadeOf = (rec) => rec.fade * (rm ? TOON_REDUCE.life : 1);
  const poolTail = (rec) => rec.p.pool.linger * (rm ? TOON_REDUCE.life : 1);
  /** End progress of the beam now: −1 while it is not ending, 0..1 while it ends. */
  const endOf = (rec) => (rec.t < rec.endAt ? -1 : Math.min(1, (rec.t - rec.endAt) / fadeOf(rec)));
  /** When it is all gone: the beam, its crown, its last ring and its pool's scorch. */
  const doneAt = (rec) => {
    let t = rec.endAt + fadeOf(rec);
    if (rec.endAt < landAt(rec)) t = Math.max(t, windupOf(rec) + CHARGE_RELEASE);
    t = Math.max(t, rec.endAt + fadeOf(rec) + poolTail(rec));
    if (rec.ringAt >= 0) t = Math.max(t, rec.ringAt + rec.p.ring.life);
    if (rec.crownEnd >= 0) t = Math.max(t, rec.crownEnd + CROWN_END);
    return t;
  };

  /** A free record, else one already ending (the furthest gone), else the oldest. */
  function take() {
    let best = null;
    for (let i = 0; i < recs.length; i++) if (!recs[i].on) return recs[i];
    for (let i = 0; i < recs.length; i++) {
      const r = recs[i];
      if (r.t >= r.endAt && (!best || r.t - r.endAt > best.t - best.endAt)) best = r;
    }
    if (!best) for (let i = 0; i < recs.length; i++) if (!best || recs[i].t > best.t) best = recs[i];
    return best;
  }

  /** The beam's path into rec.P (joints) and rec.U (u at each joint): straight, or a zig-zag struck again on the beat. */
  function strike(rec) {
    const p = rec.p;
    const A = rec.A;
    const B = rec.B;
    const P = rec.P;
    const kinks = p.zig > 0 ? Math.min(p.zig, tier.zig, MAX_BEAM_JOINTS - 1) : 1;
    const n = Math.max(1, kinks);
    const dx = B[0] - A[0];
    const dy = B[1] - A[1];
    const dz = B[2] - A[2];
    const hl = Math.hypot(dx, dz) || 1;
    const px = -dz / hl;
    const pz = dx / hl;
    const seg = Math.hypot(dx, dy, dz) / n;
    for (let j = 0; j <= n; j++) {
      const f = j / n;
      let x = A[0] + dx * f;
      let y = A[1] + dy * f;
      let z = A[2] + dz * f;
      if (j > 0 && j < n && p.zig > 0) {
        // long diagonals and short jogs: alternate sides, each joint slid a little along its segment
        const side = j % 2 ? 1 : -1;
        const amp = Math.min(p.jagMax, p.jag * seg) * (0.6 + 0.4 * rnd()) * (j === 1 || j === n - 1 ? 0.6 : 1);
        const slide = (j % 2 ? 0.22 : -0.22) / n;
        x += dx * slide + px * side * amp;
        z += dz * slide + pz * side * amp;
        y += dy * slide + side * amp * p.lift * (rnd() - 0.5) * 2;
      }
      P[j * 3] = x;
      P[j * 3 + 1] = y;
      P[j * 3 + 2] = z;
    }
    rec.nj = n + 1;
    let u = 0;
    rec.U[0] = 0;
    for (let j = 1; j <= n; j++) {
      const o = j * 3;
      u += Math.hypot(P[o] - P[o - 3], P[o + 1] - P[o - 2], P[o + 2] - P[o - 1]);
      rec.U[j] = u;
    }
    rec.strikes++;
  }

  /**
   * Fires a beam from a (the muzzle) to b (world [x, y, z]). opts: half (its half width, tiles), width (a fired lance:
   * the sim's beam width → LANCE_HALF × preset.width), held (until release(); default: the preset's), hold (a fired
   * lance's sustain, s), hit (a crown at b; default true), windup (s: override the preset's wind-up), face (her head,
   * world [x, y, z]: no ink within faceR of it on screen; aim() may move it), faceR (tiles, BEAM_FACE_R).
   * @returns {object|null} its record (live, read-only; its `gen` goes up when the record is handed out again)
   */
  function fire(id, a, b, { half = null, width = null, held: hld = null, hold = null, hit = true, windup = null, face = null, faceR = BEAM_FACE_R } = {}) {
    const p = presets[id];
    if (!p || !a || !b) return null;
    const rec = take();
    rec.gen++;
    rec.on = true;
    rec.id = id;
    rec.p = p;
    rec.pi = ids.indexOf(id);
    rec.held = hld ?? !!p.held;
    rec.prism = !!p.prism;
    for (let i = 0; i < 3; i++) {
      rec.A[i] = a[i];
      rec.B[i] = b[i];
      rec.F[i] = face ? face[i] : 0;
    }
    rec.faceR = face ? faceR : 0;
    rec.half = half ?? (width != null ? (LANCE_HALF.base + LANCE_HALF.per * width) * (p.width ?? 1) : p.half ?? 0.12);
    rec.t = 0;
    rec.fade = p.fade;
    const w = Math.max(0.02, windup ?? p.windup);
    rec.wu = w;
    rec.endAt = rec.held ? Infinity : w + (rm ? 0 : p.grow) + (rm ? 0 : BEAM_PUNCH.length * PUNCH_STEP) + (hold ?? p.hold);
    rec.seed = Math.floor(rnd() * 997) + 1;
    rec.strikes = 0;
    rec.next = w + (p.restrike || 0.05);
    rec.relK = 1;
    rec.hitK = 1;
    rec.released = false;
    rec.hit = !!hit;
    rec.crownAt = -1;
    rec.crownEnd = -1;
    rec.beat = 0;
    rec.beatAt = 0;
    rec.ringAt = -1;
    rec.rings = 0;
    rec.flow = rnd() * 4;
    rec.spin = 0;
    rec.stripes = rec.prism ? Math.min(tier.prism, p.stripes.length) : 0;
    strike(rec);
    return rec;
  }

  /** A held beam's ends this frame (world [x, y, z]), whether it hits something at b (its crown), and her face. */
  function aim(rec, a, b, { hit = rec?.hit, face = null } = {}) {
    if (!rec || !rec.on) return;
    for (let i = 0; i < 3; i++) {
      rec.A[i] = a[i];
      rec.B[i] = b[i];
      if (face) rec.F[i] = face[i];
    }
    // a hit that starts while it holds bursts a new crown (and asks the flash guard); one that stops ends it
    if (rec.t >= landAt(rec) && rec.t < rec.endAt) {
      if (hit && !rec.hit) startCrown(rec);
      if (!hit && rec.hit && rec.crownAt >= 0) rec.crownEnd = rec.t;
    }
    rec.hit = !!hit;
    if (!(rec.p.zig > 0) || rm) strike(rec);
    else {
      // (a zig-zag keeps its kinks until the next beat: only its ends follow)
      const n = rec.nj - 1;
      const o = n * 3;
      rec.P[0] = a[0]; rec.P[1] = a[1]; rec.P[2] = a[2];
      rec.P[o] = b[0]; rec.P[o + 1] = b[1]; rec.P[o + 2] = b[2];
    }
  }

  /** A held beam ends now (it erodes out along itself; its crown and pool with it). */
  function release(rec) {
    if (!rec || !rec.on || rec.released) return;
    rec.released = true;
    if (rec.t < rec.endAt) rec.endAt = rec.t;
  }

  function startCrown(rec) {
    rec.crownAt = rec.t;
    rec.crownEnd = -1;
    rec.beat = 0;
    rec.beatAt = rec.t;
    const s = rec.p.crown.size * crownScale(rec);
    rec.hitK = rm ? 1 : gate(2 * s, 1);
  }
  const crownScale = (rec) => 0.7 + rec.half * 2.4;

  function step(rec, dt) {
    rec.t += dt;
    const p = rec.p;
    const t = rec.t;
    const w = rec.wu;
    // the release: once, as the wind-up ends (a world flash: the guard is asked)
    if (t - dt < w && t >= w) rec.relK = rm ? 1 : gate(2 * CHARGE_BURST * p.charge.size, 1);
    // the impact: once, as the head lands (a held beam: again on every new hit)
    const land = landAt(rec);
    if (t - dt < land && t >= land && t < rec.endAt) {
      if (rec.hit) startCrown(rec);
      if (tier.ring && !rm) {
        rec.ringAt = t;
        rec.rings = 1;
      }
    }
    if (t >= land && t < rec.endAt) {
      // a held beam that hits: a new ring now and then
      if (rec.held && rec.hit && tier.ring && !rm && rec.ringAt >= 0 && t - rec.ringAt >= p.ring.every) {
        rec.ringAt = t;
        rec.rings++;
      }
      // the crown's tongues re-rolled on the beat
      if (!rm && t - rec.beatAt >= p.crown.beat) {
        while (t - rec.beatAt >= p.crown.beat) rec.beatAt += p.crown.beat;
        rec.beat++;
      }
    }
    if (rec.crownAt >= 0 && rec.crownEnd < 0 && t >= rec.endAt) rec.crownEnd = -2; // (it ends with the beam)
    if (!rm) {
      rec.flow += dt * p.flow * p.noise[0];
      if (rec.prism) rec.spin += dt * p.spin;
      // a zig-zag lance: a new path on the beat (Reduce Motion: one still path)
      if (p.zig > 0 && t >= rec.next && t < rec.endAt + fadeOf(rec)) {
        while (t >= rec.next) rec.next += p.restrike || 0.05;
        strike(rec);
      }
    }
    if (t > doneAt(rec) + 0.02) rec.on = false;
  }

  // ---- writing the instances

  /** The beam's width share now (the leader, the punch, the end's steps). */
  function widthOf(rec) {
    const t = rec.t;
    const land = landAt(rec);
    if (rm) return 1;
    if (t < land) return LEADER_WIDTH;
    const e = endOf(rec);
    if (e >= 0) return BEAM_END_WIDTH[Math.min(BEAM_END_WIDTH.length - 1, Math.floor(e * BEAM_END_WIDTH.length))];
    const k = Math.floor((t - land) / PUNCH_STEP);
    return k < BEAM_PUNCH.length ? BEAM_PUNCH[k] : 1;
  }

  /** The beam's segments into the body layer; returns the next free instance. */
  function writeBody(rec, at) {
    const p = rec.p;
    const t = rec.t;
    const w = rec.wu;
    // (released before it fired: no beam, only the charge eroding out)
    if (t < w || rec.endAt < w) return at;
    const e = endOf(rec);
    if (e >= 1) return at;
    const L = rec.U[rec.nj - 1];
    // the head races out in hard steps (Reduce Motion: whole at once, fading in)
    let head = L + 1;
    if (!rm && t < landAt(rec)) head = L * (Math.floor(((t - w) / p.grow) * HEAD_STEPS) + 1) / HEAD_STEPS;
    const alpha = rm ? smooth(0, REDUCE_FADE, t - w) : 1;
    const half = rec.half * widthOf(rec);
    const hdr = tier.hdr && bloom && flashOn ? p.hdr * Math.min(1, rec.relK) : 0;
    const P = rec.P;
    const n = rec.nj - 1;
    for (let s = 0; s < n && at < SEGS; s++) {
      const j = at * 4;
      const a = s * 3;
      const b = a + 3;
      const pv = s > 0 ? a - 3 : a;
      const nx = s < n - 1 ? b + 3 : b;
      bA[j] = P[a]; bA[j + 1] = P[a + 1]; bA[j + 2] = P[a + 2]; bA[j + 3] = rec.U[s];
      bB[j] = P[b]; bB[j + 1] = P[b + 1]; bB[j + 2] = P[b + 2]; bB[j + 3] = rec.U[s + 1];
      bC[j] = P[pv]; bC[j + 1] = P[pv + 1]; bC[j + 2] = P[pv + 2]; bC[j + 3] = half;
      bD[j] = P[nx]; bD[j + 1] = P[nx + 1]; bD[j + 2] = P[nx + 2]; bD[j + 3] = L;
      bE[j] = head; bE[j + 1] = e; bE[j + 2] = alpha; bE[j + 3] = p.noise[0];
      bF[j] = rec.pi; bF[j + 1] = rec.flow; bF[j + 2] = rec.seed * 0.013; bF[j + 3] = hdr;
      bG[j] = rec.stripes; bG[j + 1] = rec.spin * rec.stripes; bG[j + 2] = rec.prism ? p.twist * rec.stripes : 0; bG[j + 3] = rm ? 0 : BEAM_LAG;
      bH[j] = rec.F[0]; bH[j + 1] = rec.F[1]; bH[j + 2] = rec.F[2]; bH[j + 3] = rec.faceR;
      at++;
    }
    return at;
  }

  /** The charge-up (and its release) at the muzzle; returns the next free instance. */
  function writeCharge(rec, at) {
    const p = rec.p;
    const t = rec.t;
    const w = rec.wu;
    const rel = rm ? REDUCE_FADE : CHARGE_RELEASE;
    // (a beam released before it fired: the charge erodes out from where it was)
    const stop = Math.min(rec.endAt, w);
    if (t >= w + rel && t >= stop + rel) return at;
    if (at >= PIECES) return at;
    const j = at * 4;
    const size = p.charge.size * (0.8 + rec.half * 1.6);
    let k;
    let end = -1;
    let R;
    let flash = 0;
    if (t < stop) {
      // gathering in, in hard steps (Reduce Motion: a still glow, fading in)
      k = rm ? 1 : Math.floor((t / Math.max(1e-3, w)) * CHARGE_STEPS) / (CHARGE_STEPS - 1);
      k = Math.min(1, k);
      R = rm ? CHARGE_R[1] : CHARGE_R[0] + (CHARGE_R[1] - CHARGE_R[0]) * k;
    } else {
      // the release: the ring bursts out and erodes; a short white flash inside it (through the flash guard)
      const q = Math.min(1, (t - stop) / rel);
      k = 1;
      end = q;
      R = rm ? CHARGE_R[1] : CHARGE_R[1] + (CHARGE_BURST - CHARGE_R[1]) * Math.min(1, q * 2);
      flash = !rm && flashOn && stop === w ? rec.relK * (q < 0.5 ? 1 : 0) : 0;
    }
    const alpha = rm ? (t < stop ? smooth(0, REDUCE_FADE, t) : 1) * 0.85 : 1;
    // (a little out of the muzzle towards the target: in front of her weapon, off her face)
    const dx = rec.P[3] - rec.A[0];
    const dy = rec.P[4] - rec.A[1];
    const dz = rec.P[5] - rec.A[2];
    const dl = Math.hypot(dx, dy, dz) || 1;
    const ahead = Math.min(CHARGE_AHEAD, dl * 0.3) / dl;
    sA[j] = rec.A[0] + dx * ahead; sA[j + 1] = rec.A[1] + dy * ahead; sA[j + 2] = rec.A[2] + dz * ahead; sA[j + 3] = size;
    sB[j] = 0; sB[j + 1] = k; sB[j + 2] = end; sB[j + 3] = rec.seed * 0.017;
    sC[j] = rec.pi; sC[j + 1] = tier.hdr && bloom && flashOn ? p.hdr * rec.relK : 0; sC[j + 2] = alpha; sC[j + 3] = flash;
    sD[j] = R; sD[j + 1] = rm ? 0.16 : 0.1 + 0.07 * k; sD[j + 2] = rm ? 0 : tier.streaks; sD[j + 3] = rm ? 0 : 0.5 * (1 - k) + 0.12;
    return at + 1;
  }

  /** The crown at the hit point; returns the next free instance. */
  function writeCrown(rec, at) {
    if (rm || rec.crownAt < 0 || at >= PIECES) return at;
    const p = rec.p;
    const t = rec.t;
    let e = -1;
    if (rec.crownEnd === -2) e = endOf(rec);
    else if (rec.crownEnd >= 0) e = Math.min(1, (t - rec.crownEnd) / CROWN_END);
    if (e >= 1) return at;
    const age = t - rec.crownAt;
    const k = Math.floor(age / PUNCH_STEP);
    const scale = k < CROWN_PUNCH.length ? CROWN_PUNCH[k] : 1;
    const size = p.crown.size * crownScale(rec) * 1.25;
    const j = at * 4;
    sA[j] = rec.B[0]; sA[j + 1] = rec.B[1]; sA[j + 2] = rec.B[2]; sA[j + 3] = size;
    sB[j] = 1; sB[j + 1] = scale / 1.25; sB[j + 2] = e; sB[j + 3] = rec.seed * 0.019;
    sC[j] = rec.pi; sC[j + 1] = tier.hdr && bloom && flashOn ? p.hdr * rec.hitK : 0; sC[j + 2] = 1;
    sC[j + 3] = flashOn && k < CROWN_PUNCH.length ? rec.hitK : 0;
    sD[j] = tier.tongues; sD[j + 1] = rec.beat; sD[j + 2] = k < CROWN_PUNCH.length ? 0 : CROWN_HOLE; sD[j + 3] = 0;
    return at + 1;
  }

  /** The glow pool and the stepped ring on the ground; returns the next free instance. */
  function writeGround(rec, at) {
    const p = rec.p;
    const t = rec.t;
    const land = landAt(rec);
    if (t < land || rec.endAt < land) return at;
    const x = rec.B[0];
    const z = rec.B[2];
    const sc = crownScale(rec);
    // the pool: whenever the beam has landed (low: none, except under Reduce Motion: its held glow)
    if ((tier.pool || rm) && at < PIECES) {
      const e = t < rec.endAt ? -1 : Math.min(1, (t - rec.endAt) / (fadeOf(rec) + poolTail(rec)));
      if (e < 1) {
        const age = t - land;
        const grow = rm ? 1 : age < PUNCH_STEP ? 0.6 : 1;
        const alpha = rm ? smooth(0, REDUCE_FADE, age) : 1;
        const j = at * 4;
        const size = p.pool.size * sc;
        gA[j] = x; gA[j + 1] = z; gA[j + 2] = size; gA[j + 3] = 1;
        gB[j] = grow; gB[j + 1] = e; gB[j + 2] = rec.seed * 0.023; gB[j + 3] = alpha;
        gC[j] = rec.pi; gC[j + 1] = 0; gC[j + 2] = 0; gC[j + 3] = rec.flow * 0.3;
        at++;
      }
    }
    // the stepped ring (high and medium; none under Reduce Motion)
    if (rec.ringAt >= 0 && at < PIECES) {
      const age = (t - rec.ringAt) / p.ring.life;
      if (age < 1) {
        const j = at * 4;
        const size = p.ring.size * sc * 1.15;
        const R = RING_STEPS[Math.min(RING_STEPS.length - 1, Math.floor(age * RING_STEPS.length))] / 1.15;
        gA[j] = x; gA[j + 1] = z; gA[j + 2] = size; gA[j + 3] = 0;
        gB[j] = age; gB[j + 1] = -1; gB[j + 2] = rec.seed * 0.029 + rec.rings * 0.31; gB[j + 3] = 1;
        gC[j] = rec.pi; gC[j + 1] = R; gC[j + 2] = 0.075; gC[j + 3] = 0;
        at++;
      }
    }
    return at;
  }

  // (uploaded whole, with no update ranges: three's addUpdateRange makes an object a call, and the buffers are small)
  const upload = (L, n) => {
    L.geo.instanceCount = n;
    for (let i = 0; i < L.attrs.length; i++) if (n > 0) L.attrs[i].needsUpdate = true;
    L.mesh.visible = n > 0 && !held;
  };

  function anyOn() {
    for (let i = 0; i < recs.length; i++) if (recs[i].on) return true;
    return false;
  }

  const api = {
    fire,
    aim,
    release,
    /** The flash guard's gate for world flashes ((size, uv, strength) → strength multiplier); set by the renderer. */
    flashGate: null,
    /** Impact frames: everything sits them out. */
    hold(on) {
      held = !!on;
      if (held) for (const L of layers) L.mesh.visible = false;
    },
    /** World units per CSS pixel (the camera rig's scale): the thinnest a beam is drawn. */
    setPixel(worldPerPx) {
      bodyMat.uniforms.uPx.value = worldPerPx;
    },
    get meshes() {
      return layers.map((L) => L.mesh);
    },
    /** Advances and draws (the visual clock's dt). */
    update(dt) {
      // idle: nothing up and nothing drawn last frame: no work at all
      if (!anyOn() && drawnSegs + drawnSpots + drawnGround === 0) return;
      for (let i = 0; i < recs.length; i++) if (recs[i].on) step(recs[i], dt);
      let nb = 0;
      let ns = 0;
      let ng = 0;
      for (let i = 0; i < recs.length; i++) {
        const rec = recs[i];
        if (!rec.on) continue;
        ng = writeGround(rec, ng);
        nb = writeBody(rec, nb);
        ns = writeCharge(rec, ns);
        ns = writeCrown(rec, ns);
      }
      const add = bloom ? 1 : BEAM_CANVAS_ADD;
      bodyMat.uniforms.uAdd.value = add;
      spotMat.uniforms.uAdd.value = add;
      groundMat.uniforms.uAdd.value = add;
      upload(body, nb);
      upload(spots, ns);
      upload(ground, ng);
      drawnSegs = nb;
      drawnSpots = ns;
      drawnGround = ng;
    },
    /** The graphics tier (beams up keep going with its counts). */
    setQuality(q) {
      tierName = TOON_BEAM_TIERS[q] ? q : 'medium';
      tier = TOON_BEAM_TIERS[tierName];
      for (let i = 0; i < recs.length; i++) {
        const r = recs[i];
        if (r.on && r.prism) r.stripes = Math.min(tier.prism, r.p.stripes.length);
      }
    },
    /** Bloom on (high only): the white bands go a little over white. */
    setGlow(q, on) {
      bloom = q === 'high' && !!on;
    },
    /** Settings → Reduce motion (new beams and the ones up). */
    setReduceMotion(on) {
      rm = !!on;
    },
    /** Settings → Flashes & shake (off: no burst flash, nothing over white, the guard not asked). */
    setFlashes(on) {
      flashOn = !!on;
    },
    get stats() {
      let n = 0;
      for (let i = 0; i < recs.length; i++) if (recs[i].on) n++;
      return {
        tier: tierName, beams: n, segments: drawnSegs, spots: drawnSpots, ground: drawnGround, gates,
        calls: (body.mesh.visible ? 1 : 0) + (spots.mesh.visible ? 1 : 0) + (ground.mesh.visible ? 1 : 0),
      };
    },
    /** Live records (lab, tests). */
    get live() {
      return recs.filter((r) => r.on);
    },
    /** The preallocated arrays (tests: they never grow). */
    get buffers() {
      const out = [];
      for (const L of layers) out.push(...L.A);
      for (const r of recs) out.push(r.A, r.B, r.F, r.P, r.U);
      return out;
    },
    /** The phase of a record now: 'charge', 'start', 'sustain', 'end' or 'off' (lab captions, tests). */
    phase(rec) {
      if (!rec || !rec.on) return 'off';
      if (rec.t < rec.wu) return 'charge';
      if (rec.t >= rec.endAt) return 'end';
      if (rec.t < landAt(rec) + BEAM_PUNCH.length * PUNCH_STEP) return 'start';
      return 'sustain';
    },
    clear() {
      for (const r of recs) r.on = false;
      for (const L of layers) upload(L, 0);
      drawnSegs = drawnSpots = drawnGround = 0;
    },
    dispose() {
      for (const L of layers) {
        scene.remove(L.mesh);
        L.geo.dispose();
      }
      strip.dispose();
      quad.dispose();
      flat.dispose();
      bodyMat.dispose();
      spotMat.dispose();
      groundMat.dispose();
      noise.dispose();
      ramp.dispose();
    },
  };
  return api;
}
