// Toon beams: held beams, the charge-up and the impact crown on the shared toon core (docs/VFX.md "Toon beams", batch
// B3; display only, lab only: not wired into the battle yet, the lab is previews/beams.html). Hand-written shaders on
// src/render/vfx/toonCore.js, in the tornado's house look (luminous layered strokes, hard toon steps, noise erosion, an
// ink rim on the true outer silhouette only, premultiplied; never a soft glow tube):
//
//   body     a band from the muzzle to the target in layers: its outer silhouette one clean curve an edge with swept
//            tongues streaming out along it; a sheath inside it (deep at its edge, the body colour in); strands twisting
//            round its middle, broken into swept strokes running out along it with the flow, each with its own deep
//            rim, light, core and white. Its ink rim is worked out from the silhouette's own curves (never from heat
//            minus the cut), so nothing inside the colour is ever inked; none near the muzzle, none under a crown, and
//            none of the body at all over her face on screen (it grows out of the edge of her head's box). Its start
//            is hard-stepped (the head races out as a spear tip, then the band punches in wider in two steps and
//            settles); it holds, whole; its end thins in steps, its ink leaves (one front, muzzle first) and only then
//            does the erosion open it, from the muzzle on to the target, so it ends in its colour bands and never pops
//            off. A zig-zag lance (Raika) is the same band along a kinked path (mitred joints: no gap, no overlap),
//            struck again on a stepped beat
//   prism    the duo's beam: a strand per colour (the Grand Spectrum) braided round it over a lilac sheath, twisting
//   charge   where the beam is first seen (past her head on screen) over her wind-up: a ring gathering in in hard
//            steps and streaks converging on it, both eroding in (no ink, nothing over her face); its release bursts
//            (flash-guarded) and erodes out
//   crown    at the hit point: a burst of uneven, curling tongues in two layers (no dark ink: it stands over the pool
//            and the enemy; its deep rim is its silhouette), re-rolled on a stepped beat, a white punch on the hit
//            (flash-guarded, at most once each CROWN_REBURST), its deep rim leaving before it erodes out; seam-free
//   ground   a stepped ring running out from the hit point (inked on its outer edge, front arc only, its ink leaving
//            before it breaks into dashes) and a glow pool under it that cools into a small scorch and erodes away
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
import { TOON_CORE, TOON_NOISE_N, TOON_REDUCE, paintToonNoise, paintToonRamp, toonHash } from './toonCore.js';
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
/**
 * The ink rim: at least this many CSS px wide, and at least BEAM_INK_X of the shape's own size (its weight varies a
 * little along it, a brush line). It is worked out from the outer silhouette's own curve (never from heat − cut), so
 * nothing inside the colour is ever inked: no near-hole, no noise valley, no seam.
 */
export const BEAM_INK_PX = 1.3;
export const BEAM_INK_X = 0.06;
/** …and never more than this share of the shape's half width (a narrow tip keeps colour in its middle). */
export const BEAM_INK_CAP = 0.42;
/** (The ground ring's ink, still from its heat: at least this much heat.) */
export const BEAM_INK_MIN = 0.05;
/**
 * The body's outer silhouette, one clean curve an edge: swept tongues streaming out along it, `pitch` × its half width
 * apart, their valleys at `valley` of the half width (their size and spacing from the house noise).
 */
export const BEAM_TONGUE = Object.freeze({ pitch: 2.6, valley: 0.6 });
/**
 * The strands twisting through the body round its middle (the tier's count; the prism: one a colour), running out
 * along it with the flow and broken into swept strokes (`dash` × the half width apart, thin at both ends, their tails
 * towards the muzzle): how far out they swing and their half width (shares of the body's), and the heat each band
 * starts at (its own deep rim over `rim`, light, core; white on the front strands only).
 */
export const BEAM_STRAND = Object.freeze({ reach: 0.44, half: 0.34, dash: 4.2, rim: 0.1, light: 0.26, core: 0.6, white: 0.95 });
/** Most strands a beam draws. */
export const MAX_STRANDS = 5;
/** The sheath (the body round the strands): its deep band under this heat, its light flecks over LIGHT. */
export const SHEATH = Object.freeze({ body: 0.12, light: 0.95 });
/** The body grows out of the edge of the circle round her face over this many half widths (none of it inside it). */
export const FACE_GROW = 1.4;
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
export const CHARGE_RELEASE = 0.18;
export const CHARGE_BURST = 0.92;
/**
 * The charge-up sits where the beam is first seen: past the circle round her face (on screen) by this share of its
 * size, so a muzzle behind her head (Miko's mirror) gathers in front of it; and nothing of it is drawn inside that circle.
 */
export const CHARGE_FACE_GAP = 0.5;

/** The crown punches in at these radius shares, a step each PUNCH_STEP s, then holds at 1. */
export const CROWN_PUNCH = Object.freeze([0.62, 1.18]);
/** The crown's ink leaves at `end` of its end (± wobble / 2), before its erosion starts at CROWN_ERODE_AT. */
export const CROWN_INK = Object.freeze({ end: 0.12, wobble: 0.08 });
export const CROWN_ERODE_AT = 0.2;
/** The crown's hole (share of its radius) once its burst is over: the enemy it hits stays visible through it. */
export const CROWN_HOLE = 0.34;
/**
 * The crown's tongues: the valleys between them (share of its radius), how much they curl (turns from its middle to
 * its rim; a new lean each beat) and the inner (light) layer's reach.
 */
export const CROWN_TONGUE = Object.freeze({ valley: 0.56, curl: 0.16, inner: 0.36 });
/** A crown on its own (a hit that left a held beam) ends over this many s. */
export const CROWN_END = 0.16;
/**
 * A held beam's crown bursts (its white punch, the flash guard asked) at most once in this many s: a hit that comes
 * back sooner (a sweep flicking across an enemy's edge) brings the crown back in its punch steps with no white and no
 * new ask, so a chattering hit can never strobe (at most 3 bursts a second).
 */
export const CROWN_REBURST = 0.34;
/** No body ink within this many crown radii of the target while a crown is up (past its punch and its tongue tips). */
export const CROWN_INK_CLEAR = 1.3;

/**
 * The ground ring runs out in hard steps (radius shares over its life): from its first step its inked outer edge is
 * already outside the glow pool (ink over the pool's colour would be ink inside the colour).
 */
export const RING_STEPS = Object.freeze([0.6, 0.76, 0.9, 1]);
/** Its ink leaves at `end` of its age (± wobble / 2), before it breaks into dashes at RING_ERODE_AT. */
export const RING_INK = Object.freeze({ end: 0.42, wobble: 0.1 });
export const RING_ERODE_AT = 0.54;
/** The ring is inked on its front arc only (the half facing the camera, +z): where it faces past this share. */
export const RING_INK_FRONT = -0.05;
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
const fract = (x) => x - Math.floor(x);
/** bHash() as the shaders have it (a record's seed and a tongue's index: never time). (shader mirror) */
export function beamHash(x) {
  return fract(Math.sin(x * 12.9898 + 4.1414) * 43758.5453);
}
/** bTongue(): a smooth tongue over f in 0..1 peaking at pk. (shader mirror) */
export function beamTongue(f, pk) {
  const g = Math.pow(clamp(f, 0, 1), Math.log(0.5) / Math.log(clamp(pk, 0.05, 0.95)));
  const s = Math.sin(Math.PI * g);
  return s * s;
}
/**
 * The crown's outer radius (share of its radius) at angle u (0..1, as atan wraps it), radius share rr, N tongues, a
 * whole seed and the beat: periodic in u, so the wrap falls between two tongues. (shader mirror)
 */
export function crownOuter(u, rr, N, seed, beat) {
  const cu = u + CROWN_TONGUE.curl * rr + 0.13 * beamHash(beat + seed);
  const sec = cu * N + 0.3 * Math.sin(TAU * 2 * cu + seed);
  const fi = ((Math.floor(sec) % N) + N) % N;
  const len = 0.42 + 0.58 * beamHash(fi + beat * 3.1 + seed * 7);
  const pk = 0.3 + 0.4 * beamHash(fi * 1.7 + beat + seed);
  return CROWN_TONGUE.valley + (1 - CROWN_TONGUE.valley) * len * beamTongue(fract(sec), pk);
}

// ------------------------------------------------------------------------------------------------ shaders

const f2 = (v) => v.toFixed(3);

/** Shared fragment helpers: the bands, the ink rims, a small hash (seeded by the record, never by time). */
const BEAM_HELPERS = /* glsl */`
uniform sampler2D uNoise;
uniform sampler2D uRamp;
uniform float uRows;  // ramp rows (three a preset: its bands, its stripes, its light stripes)
uniform float uAdd;   // the glow's added share where a band covers little: 1 into the linear target, less on the canvas
${TOON_CORE}
// [beam] the ramp texel of band i in row r of preset p (8 a row, NearestFilter: flat steps)
vec3 bRamp(float i, float p, float r) { return toonRamp(uRamp, (i + 0.5) / 8.0, (p * 3.0 + r + 0.5) / uRows); }
// [beam] 1 on a thin rim inside a shape's edge: at least px pixels on screen, and minW of its own heat (the ground ring)
float bRim(float above, float px, float minW) { return step(above, max(minW, px * fwidth(above))); }
// [beam] 1 on the ink rim inside an outer silhouette: rim is a continuous distance-like value from the silhouette's own
// curve (0 on it, rising inward), so its screen width is px pixels (or minW of the shape) and nothing inside is inked
// (never more than cap of it: a narrow tip keeps colour in its middle)
float bEdgeInk(float rim, float px, float minW, float cap) { return step(rim, min(max(minW, px * fwidth(rim)), cap)) * step(0.0, rim); }
// [beam] how far a pixel is out of her face on screen (view plane units; <= 0 inside it, large when there is no face):
// f.xy its offset from her face, f.z the face's radius (a circle) or its box's half width, f.w the box's half height
float bFaceDist(vec4 f) {
  if (f.z <= 0.0) return 1e3;
  if (f.w <= 0.0) return length(f.xy) - f.z;
  vec2 q = abs(f.xy) - f.zw;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}
// [beam] a small hash of a whole number (a record's seed and a tongue's index: never time)
float bHash(float x) { return fract(sin(x * 12.9898 + 4.1414) * 43758.5453); }
// [beam] a smooth tongue over f in 0..1 peaking at pk (no cusp at its tip or its valleys: a clean silhouette to ink)
float bTongue(float f, float pk) {
  float g = pow(clamp(f, 0.0, 1.0), log(0.5) / log(clamp(pk, 0.05, 0.95)));
  float s = sin(3.14159265 * g);
  return s * s;
}
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
attribute vec4 bG; // strands, their spin (turns), their turns a tile along it, erosion lag
attribute vec4 bH; // her face: x, y, z, its radius on screen (0: none) | its box's half width
attribute vec4 bI; // prism (1: a strand a colour), her face box's half height (0: a circle), no ink this near the target (tiles), -
uniform float uPx; // world units per CSS px
varying vec2 vUV;  // along (u, tiles), across (v, -1 .. 1)
varying vec4 vFace; // the pixel's offset from her face in the view plane, the face's radius (or box half width, height)
varying float vW;
varying float vL;
varying vec4 vE;
varying vec4 vF;
varying vec4 vG;
varying vec2 vPrism2;
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
  vFace = vec4(xy - (modelViewMatrix * vec4(bH.xyz, 1.0)).xy, bH.w, bI.y);
  vUV = vec2(mix(bA.w, bB.w, s), side);
  vW = w;
  vL = bD.w;
  vE = bE;
  vF = bF;
  vG = bG;
  vPrism2 = bI.xz;
}`;

const BODY_FRAG = /* glsl */`
varying vec2 vUV;
varying vec4 vFace;
varying float vW;
varying float vL;
varying vec4 vE;
varying vec4 vF;
varying vec4 vG;
varying vec2 vPrism2;
${BEAM_HELPERS}
void main() {
  float u = vUV.x;
  float v = vUV.y;
  float L = max(vL, 1e-3);
  float W = vW;
  // its shape along it: it grows out of a point where it is first seen (the muzzle, or the edge of the circle round her
  // face on screen: none of it inside that circle), a spear tip while the head races out, round at the target
  float sIn = clamp(u / max(2.0 * W, 0.12), 0.0, 1.0);
  float sHead = clamp((vE.x - u) / (1.6 * W), 0.0, 1.0);
  float sEnd = clamp((L - u) / (0.9 * W), 0.0, 1.0);
  float fd = bFaceDist(vFace);
  float sFace = clamp(fd / (${f2(FACE_GROW)} * W), 0.0, 1.0);
  float shape = min(min(sqrt(sIn), sHead), min(sqrt(sEnd), sqrt(sFace)));
  float x = v / max(shape, 1e-3);
  float ax = abs(x);
  float ns = vE.w;
  float sd = vF.z;
  // (u in the flowing frame: the noise, the edge's tongues and the strands all run out along it together)
  float ut = u - vF.y / max(ns, 1e-3);
  // the outer silhouette: one clean curve an edge (each a function of u alone), swept tongues streaming out along it
  // (their spacing and size from the house noise), smooth everywhere: its ink rim is worked out from these curves
  // (how far in from the nearer one), never from the heat, so nothing inside the colour is ever inked
  vec2 nt = texture2D(uNoise, vec2(ut * ns * 1.4, 0.23 + sd)).rg;
  vec2 nb = texture2D(uNoise, vec2(ut * ns * 1.4, 0.64 + sd)).rg;
  float pt = ut / max(${f2(BEAM_TONGUE.pitch)} * W, 0.02);
  float eT = ${f2(BEAM_TONGUE.valley)} + ${f2(1 - BEAM_TONGUE.valley)} * bTongue(fract(pt + 0.9 * nt.x), 0.3) * (0.3 + 0.7 * smoothstep(0.2, 0.8, nt.y));
  float eB = ${f2(BEAM_TONGUE.valley)} + ${f2(1 - BEAM_TONGUE.valley)} * bTongue(fract(pt + 0.5 + 0.9 * nb.x), 0.3) * (0.3 + 0.7 * smoothstep(0.2, 0.8, nb.y));
  float rim = min(eT - x, x + eB);
  float edge = x > 0.0 ? eT : eB;
  vec2 ne = x > 0.0 ? nt : nb;
  float inside = step(0.0, rim) * step(0.04, shape);
  // the sheath round the strands: its deep band at the outer edge, the body colour in (the band edge broken by the noise)
  float xs = ax / max(edge, 1e-3);
  float n0 = toonNoise(uNoise, vec2(ut * ns, v * 0.1 + sd), vF.y * 0.27);
  float h0 = toonHeat(1.0 - xs * xs, n0);
  // the strands: ribbons twisting round its middle (the front ones wider and hotter), each broken by its own noise into
  // tongues and dashes as it runs out along it; the front-most one that shows wins the pixel
  float K = vG.x;
  float front = -2.0;
  float hS = 0.0;
  float iS = 0.0;
  for (int i = 0; i < ${MAX_STRANDS}; i++) {
    float fi = float(i);
    if (fi >= K) break;
    float ph = 6.2831853 * (ut * vG.z + fi / max(K, 1.0) + vG.y) + sd * 7.0;
    float dp = cos(ph);
    // (a stroke of it: tapered at both ends, its length hashed a stroke)
    float ds = ut / max(${f2(BEAM_STRAND.dash)} * W, 0.02) + fi * 0.37 + sd * 3.0;
    float dl = 0.55 + 0.35 * bHash(floor(ds) + fi * 13.0 + sd);
    float df = fract(ds) / dl;
    float along = df < 1.0 ? bTongue(df, 0.62) : 0.0;
    float bx = (x - ${f2(BEAM_STRAND.reach)} * sin(ph)) / max(${f2(BEAM_STRAND.half)} * (1.0 + 0.3 * dp) * sqrt(along), 1e-3);
    float nS = texture2D(uNoise, vec2(ut * ns * 1.8 + fi * 0.37, 0.61 + fi * 0.19 + sd)).g;
    float h = (1.0 - bx * bx) * (0.45 + smoothstep(0.2, 0.8, nS)) * (0.7 + 0.3 * dp);
    if (h > ${f2(BEAM_STRAND.rim)} && dp > front) {
      front = dp;
      hS = h;
      iS = fi;
    }
  }
  // its end: the ink leaves first (one clean front from the muzzle on), then the threshold rises from the muzzle on
  float e = vE.y;
  float inked = e < 0.0 ? 1.0 : step(e + ${f2(BEAM_INK.sweep)} * (0.5 - u / L), ${f2(BEAM_INK.end)});
  float k = e < 0.0 ? 0.0 : clamp((e - ${f2(BEAM_ERODE_AT)}) / ${f2(1 - BEAM_ERODE_AT)} * (1.0 + vG.w) - vG.w * (u / L), 0.0, 1.0);
  float cut = mix(${f2(BODY_YOUNG)}, ${f2(BEAM_OLD)}, k);
  // (how far the erosion has risen: 0 while it holds, so it is whole inside its silhouette, never a hole)
  float gone = cut - ${f2(BODY_YOUNG)};
  float m = inside * step(gone, max(h0, hS));
  // the bands: the sheath's deep and body, the strands' light and core, white on the front strands' hottest
  float a0 = h0 - gone;
  float bi = ${BEAM_BAND.deep.toFixed(1)};
  bi = mix(bi, ${BEAM_BAND.body.toFixed(1)}, step(${f2(SHEATH.body)}, a0));
  bi = mix(bi, ${BEAM_BAND.light.toFixed(1)}, step(${f2(SHEATH.light)}, a0));
  float aS = hS - gone;
  float isS = step(${f2(BEAM_STRAND.rim)}, aS);
  float sLight = step(${f2(BEAM_STRAND.light)}, aS);
  float sCore = step(${f2(BEAM_STRAND.core)}, aS);
  float sHot = step(${f2(BEAM_STRAND.white)}, aS) * step(0.25, front);
  // (each stroke over the sheath: its own deep rim, then light, core, white: a layer on a layer)
  float sb = mix(${BEAM_BAND.deep.toFixed(1)}, ${BEAM_BAND.light.toFixed(1)}, sLight);
  sb = mix(mix(sb, ${BEAM_BAND.core.toFixed(1)}, sCore), ${BEAM_BAND.white.toFixed(1)}, sHot);
  bi = mix(bi, sb, isS);
  float hot = step(${(BEAM_BAND.white - 0.5).toFixed(1)}, bi);
  vec3 col = bRamp(bi, vF.x, 0.0);
  if (vPrism2.x > 0.5) {
    // the prism: each strand its own colour of the spectrum (its light row over the core heat), the white its peaks
    vec3 sc = bRamp(1.0 + iS, vF.x, 1.0 + sCore);
    col = mix(col, mix(sc, bRamp(7.0, vF.x, 1.0), sHot), sLight);
  }
  float cover = bCover(bi);
  // ink: a rim inside the outer silhouette only (from its curve), never near the muzzle or the circle round her face;
  // under Reduce Motion only once it is in at full strength (no muddy half-strength rim while it fades in)
  // (and none under the crown at a hit: the crown's own rim is the silhouette there)
  float clear = step(${f2(BEAM_FACE_CLEAR)} + 0.1 * (nt.x - 0.5), u) * step(0.999, sFace) * step(0.999, vE.z) * step(u, L - vPrism2.y);
  float ink = bEdgeInk(rim, ${f2(BEAM_INK_PX)}, ${f2(BEAM_INK_X)} * (0.55 + 0.9 * ne.y), ${f2(BEAM_INK_CAP)}) * inside * inked * clear;
  col = mix(col, bRamp(${BEAM_BAND.ink.toFixed(1)}, vF.x, 0.0), ink);
  cover = mix(cover, ${f2(BEAM_COVER.ink)}, ink);
  // the white band goes a little over white on high with bloom (through the flash guard)
  col *= 1.0 + vF.w * hot * (1.0 - ink);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  gl_FragColor = toonAdd(gl_FragColor.rgb, m * vE.z, mix(uAdd, 1.0, cover), cover);
}`;

const SPOT_VERT = /* glsl */`
attribute vec4 sA; // centre x, y, z, size (world: the quad's half extent)
attribute vec4 sB; // mode (0 charge, 1 crown), scale (charge: its progress 0..1; crown: its radius share), end (-1), seed (whole)
attribute vec4 sC; // preset, over-white, strength, flash (the burst's white, through the flash guard)
attribute vec4 sD; // charge: ring radius, ring half width, streaks, her face box's half height | crown: tongues, beat, hole, -
attribute vec4 sE; // her face: x, y, z, radius (0: none) or box half width: nothing of it inside it on screen
varying vec2 vQ;
varying vec4 vB;
varying vec4 vC;
varying vec4 vD;
varying vec4 vFace;
void main() {
  vec4 c = modelViewMatrix * vec4(sA.xyz, 1.0);
  c.xy += position.xy * sA.w * step(0.0005, sC.z);
  vFace = vec4(c.xy - (modelViewMatrix * vec4(sE.xyz, 1.0)).xy, sE.w, sB.x < 0.5 ? sD.w : 0.0);
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
varying vec4 vFace;
${BEAM_HELPERS}
void main() {
  float r = length(vQ);
  // the angle 0..1 (it wraps at -x: every index below is taken mod its count and every offset is whole, so the wrap
  // falls between two tongues or streaks, never inside one)
  float u = atan(vQ.y, vQ.x) / 6.2831853 + 0.5;
  float seed = vB.w;
  float m;
  float above;
  float bi;
  float hot;
  float ink = 0.0;
  if (vB.x < 0.5) {
    // the charge-up: a ring gathering in and streaks converging on it, eroding in over the wind-up (no ink: it sits
    // by her hand); its release bursts and erodes out
    float R = vD.x;
    float hw = vD.y;
    float xr = (r - R) / max(hw, 1e-3);
    float ring = 1.0 - xr * xr;
    float streak = 0.0;
    float N = vD.z;
    if (N > 0.5) {
      float sec = u * N + seed;
      float fi = mod(floor(sec), N);
      float h = bHash(fi + seed * 7.0);
      float across = (fract(sec) - 0.5 - (h - 0.5) * 0.4) / N * 6.2831853 * r;
      float r0 = R + hw * 0.5;
      float r1 = R + (0.5 * (1.0 - vB.y) + 0.12) * (0.65 + 0.35 * h);
      float al = (r - r0) / max(r1 - r0, 1e-3);
      float sw = 0.15 * (1.0 - 0.55 * al);
      streak = (1.0 - (across / sw) * (across / sw)) * step(0.0, al) * step(al, 1.0);
    }
    float band = max(ring, streak);
    float n = toonNoise(uNoise, vec2(u * 3.0, r * 0.7 + seed * 0.37), 0.0);
    float heat = toonHeat(band, n);
    float cut = vB.z < 0.0 ? mix(${f2(CHARGE_IN)}, ${f2(BEAM_YOUNG)}, vB.y) : mix(${f2(BEAM_YOUNG)}, ${f2(BEAM_OLD)}, vB.z);
    m = toonMask(heat, cut) * step(0.0, band);
    above = heat - cut;
    // the release's white flash inside the ring (flash-guarded)
    float flash = step(r, R * 0.85) * vC.w;
    vec2 lv = bLevel(above);
    bi = mix(lv.x, ${BEAM_BAND.white.toFixed(1)}, flash);
    hot = max(lv.y, flash);
  } else {
    // the crown: a burst of uneven, curling tongues round the hit point in two layers (the outer one in the body colour
    // with its own deep rim, the inner one light, a core round its middle), their lengths and leans re-rolled on the
    // beat; its hole open once the hit's flash is over (the enemy stays visible through it). No dark ink: it stands over
    // the glow pool and the enemy, so its silhouette is drawn in its deep band (as the tornado's rings are); that deep
    // rim leaves before it erodes out, so it ends in its lighter bands
    float N = vD.x;
    float R = vB.y;
    float beat = vD.y;
    float rr = r / max(R, 1e-3);
    float cu = u + ${f2(CROWN_TONGUE.curl)} * rr + 0.13 * bHash(beat + seed);
    float sec = cu * N + 0.3 * sin(6.2831853 * 2.0 * cu + seed);
    float fi = mod(floor(sec), N);
    float len = 0.42 + 0.58 * bHash(fi + beat * 3.1 + seed * 7.0);
    float pk = 0.3 + 0.4 * bHash(fi * 1.7 + beat + seed);
    float Rt = ${f2(CROWN_TONGUE.valley)} + ${f2(1 - CROWN_TONGUE.valley)} * len * bTongue(fract(sec), pk);
    // the inner layer: half a tongue round, curled further, shorter
    float cu2 = cu + 0.08 * rr;
    float sec2 = cu2 * N + 0.5 + 0.3 * sin(6.2831853 * 2.0 * cu2 + seed);
    float fi2 = mod(floor(sec2), N);
    float len2 = 0.5 + 0.5 * bHash(fi2 * 2.3 + beat * 1.9 + seed);
    float Ri = ${f2(CROWN_TONGUE.inner)} + 0.3 * len2 * bTongue(fract(sec2), 1.0 - pk);
    float hole = vD.z;
    float inside = step(rr, Rt) * step(hole, rr);
    float n = toonNoise(uNoise, vec2(u * 2.0 + seed, r * 0.35 + beat * 0.13), 0.0);
    float rim = Rt - rr;
    float e = vB.z;
    float inked = e < 0.0 ? 1.0 : step(e + ${f2(CROWN_INK.wobble)} * (n - 0.5), ${f2(CROWN_INK.end)});
    float cut = e < 0.0 ? ${f2(BEAM_YOUNG)} : mix(${f2(BEAM_YOUNG)}, ${f2(BEAM_OLD)}, clamp((e - ${f2(CROWN_ERODE_AT)}) / ${f2(1 - CROWN_ERODE_AT)}, 0.0, 1.0));
    float gone = cut - ${f2(BEAM_YOUNG)};
    float heat = clamp(rim / 0.4, 0.0, 1.0) * (0.3 + n) + 0.5 * step(rr, Ri);
    m = inside * step(gone, heat);
    above = heat - gone;
    bi = mix(${BEAM_BAND.body.toFixed(1)}, ${BEAM_BAND.deep.toFixed(1)}, inked * step(rim, max(0.1 + 0.08 * n, ${f2(BEAM_INK_PX)} * fwidth(rim))));
    bi = mix(bi, ${BEAM_BAND.light.toFixed(1)}, step(rr, Ri) * step(gone, 0.3));
    bi = mix(bi, ${BEAM_BAND.core.toFixed(1)}, step(rr, 0.24 + 0.08 * n) * step(gone, 0.15));
    // the hit's white flash in its middle while it bursts (flash-guarded)
    float flash = step(rr, 0.42) * vC.w;
    m = max(m, flash);
    bi = mix(bi, ${BEAM_BAND.white.toFixed(1)}, flash);
    hot = step(${(BEAM_BAND.white - 0.5).toFixed(1)}, bi);
  }
  // nothing inside her face on screen (a charge-up by her hand)
  m *= step(0.0, bFaceDist(vFace));
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
    // the stepped ring: a light line running out in hard steps, inked on its outer edge only (its front arc); its ink
    // leaves before it breaks into dashes (colour, never ink)
    float age = vB.x;
    float xr = (r - vC.y) / max(vC.z, 1e-3);
    float band = 1.0 - xr * xr;
    float n = toonNoise(uNoise, vec2(u * 4.0 + seed, 0.35 + seed), 0.0);
    float heat = toonHeat(band, n);
    float inked = step(age + ${f2(RING_INK.wobble)} * (n - 0.5), ${f2(RING_INK.end)});
    float cut = mix(${f2(BEAM_YOUNG)}, ${f2(RING_OLD)}, clamp((age - ${f2(RING_ERODE_AT)}) / ${f2(1 - RING_ERODE_AT)}, 0.0, 1.0));
    m = toonMask(heat, cut) * step(0.0, band);
    above = heat - cut;
    // (its front arc only: the far arc runs behind the crown and the beam on screen, where its ink would be a dash
    // inside their colour)
    // (worked out from its actual outer edge, where its heat meets the cut: xr = sqrt(1 - cut / (0.3 + n)), never from
    // heat minus the cut, so no pixel inside its colour is inked)
    float xo = sqrt(max(1.0 - cut / (0.3 + n), 0.0));
    ink = bEdgeInk((xo - xr) * vC.z, ${f2(BEAM_INK_PX)}, ${f2(BEAM_INK_X)} * vC.z, 0.45 * vC.z) * m * step(0.0, xr) * inked * step(${f2(RING_INK_FRONT)}, vP.y / max(r, 1e-3));
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
    A: new Float64Array(3), B: new Float64Array(3), F: new Float64Array(3), faceR: 0, faceH: 0, P: new Float32Array(MAX_BEAM_JOINTS * 3), U: new Float32Array(MAX_BEAM_JOINTS), nj: 2,
    V: new Float64Array(3), // where the beam is first seen (the muzzle, or past the circle round her face on screen)
    half: 0.1, t: 0, wu: 0.18, endAt: Infinity, fade: 0.2, seed: 0, next: 0, strikes: 0,
    landT: 0, fadeT: 0.2, poolT: 0.4, cScale: 1, crownS: 0.3, chargeS: 0.4,
    relK: 1, hitK: 1, released: false, hit: true, crownAt: -1, crownEnd: -1, burstAt: -1, crownFlash: true, chargeDone: false, beat: 0, beatAt: 0, ringAt: -1, rings: 0,
    flow: 0, spin: 0, stripes: 0, gates: 0,
  };
}

/**
 * @param {{ scene: THREE.Object3D, camera?: THREE.Camera|null, quality?: 'high'|'medium'|'low', reduceMotion?: boolean,
 *   rand?: () => number, presets?: object, flashes?: boolean }} o
 */
export function createToonBeamFx({ scene, camera = null, quality = 'medium', reduceMotion = false, rand = null, presets = TOON_BEAM_PRESETS, flashes = true }) {
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
  const body = layer(strip, ['bA', 'bB', 'bC', 'bD', 'bE', 'bF', 'bG', 'bH', 'bI'], SEGS, bodyMat, 22, 'toonBeamBody');
  const spots = layer(quad, ['sA', 'sB', 'sC', 'sD', 'sE'], PIECES, spotMat, 23, 'toonBeamSpots');
  const ground = layer(flat, ['gA', 'gB', 'gC'], PIECES, groundMat, 6, 'toonBeamGround');
  const layers = [body, spots, ground];
  // (the attribute arrays, named once: the hot path never destructures, so nothing is allocated a frame)
  const [bA, bB, bC, bD, bE, bF, bG, bH, bI] = body.A;
  const [sA, sB, sC, sD, sE] = spots.A;
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

  // ---- the beats of a record (seconds from its fire), worked out once into plain number fields (at its fire and on
  // a Reduce Motion change): the hot path reads fields, never a helper's double result (it would be boxed a call).
  // cScale: the crown's and pool's scale; crownS: the crown's outer radius once its burst is over (the body's ink
  // stops there); chargeS: the charge-up's size
  function beats(rec) {
    const p = rec.p;
    const slow = rm ? TOON_REDUCE.life : 1;
    rec.landT = rec.wu + (rm ? 0 : p.grow);
    rec.fadeT = rec.fade * slow;
    rec.poolT = p.pool.linger * slow;
    rec.cScale = 0.7 + rec.half * 2.4;
    rec.crownS = p.crown.size * rec.cScale;
    rec.chargeS = p.charge.size * (0.8 + rec.half * 1.6);
  }
  /** When it is all gone: the beam, its crown, its last ring and its pool's scorch (asked only once it ends). */
  const doneAt = (rec) => {
    let t = rec.endAt + rec.fadeT;
    if (rec.endAt < rec.landT) t = Math.max(t, rec.wu + CHARGE_RELEASE);
    t = Math.max(t, rec.endAt + rec.fadeT + rec.poolT);
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
    // (no variadic Math.min / Math.hypot in the hot path: they box their arguments, bytes a frame)
    let kinks = 1;
    if (p.zig > 0) {
      kinks = p.zig < tier.zig ? p.zig : tier.zig;
      if (kinks > MAX_BEAM_JOINTS - 1) kinks = MAX_BEAM_JOINTS - 1;
    }
    const n = kinks > 1 ? kinks : 1;
    const dx = B[0] - A[0];
    const dy = B[1] - A[1];
    const dz = B[2] - A[2];
    const hl = Math.sqrt(dx * dx + dz * dz) || 1;
    const px = -dz / hl;
    const pz = dx / hl;
    const seg = Math.sqrt(dx * dx + dy * dy + dz * dz) / n;
    for (let j = 0; j <= n; j++) {
      const f = j / n;
      let x = A[0] + dx * f;
      let y = A[1] + dy * f;
      let z = A[2] + dz * f;
      if (j > 0 && j < n && p.zig > 0) {
        // long diagonals and short jogs: alternate sides, each joint slid a little along its segment
        const side = j % 2 ? 1 : -1;
        // (its jitter hashed from the record's seed and the strike's count: seeded, and no boxed draw a joint)
        const jag = p.jag * seg;
        const amp = (jag < p.jagMax ? jag : p.jagMax) * (0.6 + 0.4 * toonHash(rec.seed, rec.strikes * 16 + j, 1)) * (j === 1 || j === n - 1 ? 0.6 : 1);
        const slide = (j % 2 ? 0.22 : -0.22) / n;
        x += dx * slide + px * side * amp;
        z += dz * slide + pz * side * amp;
        y += dy * slide + side * amp * p.lift * (toonHash(rec.seed, rec.strikes * 16 + j, 2) - 0.5) * 2;
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
      const ex = P[o] - P[o - 3];
      const ey = P[o + 1] - P[o - 2];
      const ez = P[o + 2] - P[o - 1];
      u += Math.sqrt(ex * ex + ey * ey + ez * ez);
      rec.U[j] = u;
    }
    rec.strikes++;
  }

  /**
   * Fires a beam from a (the muzzle) to b (world [x, y, z]). opts: half (its half width, tiles), width (a fired lance:
   * the sim's beam width → LANCE_HALF × preset.width), held (until release(); default: the preset's), hold (a fired
   * lance's sustain, s), hit (a crown at b; default true), windup (s: override the preset's wind-up), face (her head,
   * world [x, y, z]; aim() may move it): none of the beam or its charge-up is drawn over it on screen, inside a circle
   * of faceR (tiles, BEAM_FACE_R) round it, or inside faceBox ([half width, half height] in the view plane, tiles: the
   * box round her head on screen) when given.
   * @returns {object|null} its record (live, read-only; its `gen` goes up when the record is handed out again)
   */
  function fire(id, a, b, { half = null, width = null, held: hld = null, hold = null, hit = true, windup = null, face = null, faceR = BEAM_FACE_R, faceBox = null } = {}) {
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
    rec.faceR = face ? (faceBox ? faceBox[0] : faceR) : 0;
    rec.faceH = face && faceBox ? faceBox[1] : 0;
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
    rec.burstAt = -1;
    rec.crownFlash = true;
    rec.chargeDone = false;
    rec.ringAt = -1;
    rec.rings = 0;
    rec.flow = rnd() * 4;
    rec.spin = 0;
    rec.stripes = rec.prism ? Math.min(tier.prism, p.stripes.length) : 0;
    beats(rec);
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
    if (rec.t >= rec.landT && rec.t < rec.endAt) {
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
    // a hit back within CROWN_REBURST of the last burst: the crown comes back in its punch steps, with no white and
    // no new ask of the flash guard (a chattering hit never strobes)
    if (rec.burstAt >= 0 && rec.t - rec.burstAt < CROWN_REBURST) {
      rec.crownFlash = false;
      return;
    }
    rec.burstAt = rec.t;
    rec.crownFlash = true;
    const s = rec.p.crown.size * rec.cScale;
    rec.hitK = rm ? 1 : gate(2 * s, 1);
  }

  function step(rec, dt) {
    rec.t += dt;
    const p = rec.p;
    const t = rec.t;
    const w = rec.wu;
    // the release: once, as the wind-up ends (a world flash: the guard is asked)
    if (t - dt < w && t >= w) rec.relK = rm ? 1 : gate(2 * CHARGE_BURST * p.charge.size, 1);
    // the impact: once, as the head lands (a held beam: again on every new hit)
    const land = rec.landT;
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
      if (p.zig > 0 && t >= rec.next && t < rec.endAt + rec.fadeT) {
        while (t >= rec.next) rec.next += p.restrike || 0.05;
        strike(rec);
      }
    }
    if (t >= rec.endAt && t > doneAt(rec) + 0.02) rec.on = false;
  }

  // ---- writing the instances

  /** The beam's segments into the body layer; returns the next free instance. */
  function writeBody(rec, at) {
    const p = rec.p;
    const t = rec.t;
    const w = rec.wu;
    // (released before it fired: no beam, only the charge eroding out)
    if (t < w || rec.endAt < w) return at;
    // its end progress: −1 while it is not ending, 0..1 while it ends
    const e = t < rec.endAt ? -1 : Math.min(1, (t - rec.endAt) / rec.fadeT);
    if (e >= 1) return at;
    const L = rec.U[rec.nj - 1];
    // the head races out in hard steps (Reduce Motion: whole at once, fading in)
    let head = L + 1;
    if (!rm && t < rec.landT) head = L * (Math.floor(((t - w) / p.grow) * HEAD_STEPS) + 1) / HEAD_STEPS;
    const alpha = rm ? smooth(0, REDUCE_FADE, t - w) : 1;
    // its width share now: the leader, the punch, the end's steps (Reduce Motion: whole)
    let ws = 1;
    if (!rm) {
      if (t < rec.landT) ws = LEADER_WIDTH;
      else if (e >= 0) ws = BEAM_END_WIDTH[Math.min(BEAM_END_WIDTH.length - 1, Math.floor(e * BEAM_END_WIDTH.length))];
      else {
        const k = Math.floor((t - rec.landT) / PUNCH_STEP);
        ws = k < BEAM_PUNCH.length ? BEAM_PUNCH[k] : 1;
      }
    }
    const half = rec.half * ws;
    const hdr = tier.hdr && bloom && flashOn ? p.hdr * Math.min(1, rec.relK) : 0;
    const P = rec.P;
    const n = rec.nj - 1;
    // (no body ink under a crown that is up: its own rim is the silhouette there)
    const crownUp = !rm && rec.crownAt >= 0 && !(rec.crownEnd >= 0 && t - rec.crownEnd >= CROWN_END);
    const endClear = crownUp ? CROWN_INK_CLEAR * rec.crownS : 0;
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
      bG[j] = rec.prism ? rec.stripes : tier.strands; bG[j + 1] = rec.spin; bG[j + 2] = p.twist ?? 0.6; bG[j + 3] = rm ? 0 : BEAM_LAG;
      bH[j] = rec.F[0]; bH[j + 1] = rec.F[1]; bH[j + 2] = rec.F[2]; bH[j + 3] = rec.faceR;
      bI[j] = rec.prism ? 1 : 0; bI[j + 1] = rec.faceH; bI[j + 2] = endClear; bI[j + 3] = 0;
      at++;
    }
    return at;
  }

  /**
   * Where the beam is first seen, into rec.V: the muzzle, or (her face given and a camera to see it by) the first point
   * of its path past her face on screen, CHARGE_FACE_GAP of the charge-up's size more out. Plain numbers, no double
   * argument or result (they would be boxed across the call): no allocation.
   */
  function visibleStart(rec) {
    const gap = CHARGE_FACE_GAP * rec.chargeS;
    const A = rec.A;
    const P = rec.P;
    const V = rec.V;
    let t = 0;
    if (camera && rec.faceR > 0) {
      const m = camera.matrixWorldInverse.elements;
      const F = rec.F;
      // the view plane (x, y) of the muzzle, the first joint after it and her face
      const ax = m[0] * A[0] + m[4] * A[1] + m[8] * A[2] + m[12];
      const ay = m[1] * A[0] + m[5] * A[1] + m[9] * A[2] + m[13];
      const bx = m[0] * P[3] + m[4] * P[4] + m[8] * P[5] + m[12];
      const by = m[1] * P[3] + m[5] * P[4] + m[9] * P[5] + m[13];
      const fx = m[0] * F[0] + m[4] * F[1] + m[8] * F[2] + m[12];
      const fy = m[1] * F[0] + m[5] * F[1] + m[9] * F[2] + m[13];
      const dx = bx - ax;
      const dy = by - ay;
      const ox = ax - fx;
      const oy = ay - fy;
      const dd = dx * dx + dy * dy;
      if (rec.faceH > 0) {
        // her head's box, `gap` wider: where the path leaves it (the nearer of its two exits along the path)
        const hx = rec.faceR + gap;
        const hy = rec.faceH + gap;
        if (ox > -hx && ox < hx && oy > -hy && oy < hy && dd > 1e-9) {
          const tx = dx > 1e-9 ? (hx - ox) / dx : dx < -1e-9 ? (-hx - ox) / dx : Infinity;
          const ty = dy > 1e-9 ? (hy - oy) / dy : dy < -1e-9 ? (-hy - oy) / dy : Infinity;
          t = tx < ty ? tx : ty;
        }
      } else {
        const R = rec.faceR + gap;
        const c = ox * ox + oy * oy - R * R;
        if (c <= 0 && dd > 1e-9) {
          // the far root of |o + t d| = R: where the path leaves the circle
          const bh = ox * dx + oy * dy;
          t = (-bh + Math.sqrt(bh * bh - dd * c)) / dd;
        }
      }
      t = t < 0 ? 0 : t > 0.6 ? 0.6 : t;
    }
    V[0] = A[0] + (P[3] - A[0]) * t;
    V[1] = A[1] + (P[4] - A[1]) * t;
    V[2] = A[2] + (P[5] - A[2]) * t;
  }

  /** The charge-up (and its release) where the beam is first seen; returns the next free instance. */
  function writeCharge(rec, at) {
    // (once it is over, a flag: nothing else read, no double touched)
    if (rec.chargeDone) return at;
    const p = rec.p;
    const t = rec.t;
    const w = rec.wu;
    const rel = rm ? REDUCE_FADE : CHARGE_RELEASE;
    // (a beam released before it fired: the charge erodes out from where it was)
    const stop = rec.endAt < w ? rec.endAt : w;
    if (t >= w + rel && t >= stop + rel) {
      rec.chargeDone = true;
      return at;
    }
    if (at >= PIECES) return at;
    const j = at * 4;
    const size = rec.chargeS;
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
      flash = !rm && flashOn && stop === w ? rec.relK * (q < 0.34 ? 1 : 0) : 0;
    }
    const alpha = rm ? (t < stop ? smooth(0, REDUCE_FADE, t) : 1) * 0.85 : 1;
    // where the beam is first seen (past her face on screen), and a little out of it towards the target
    visibleStart(rec);
    const V = rec.V;
    const dx = rec.P[3] - V[0];
    const dy = rec.P[4] - V[1];
    const dz = rec.P[5] - V[2];
    const dl = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const ahead = Math.min(CHARGE_AHEAD, dl * 0.3) / dl;
    sA[j] = V[0] + dx * ahead; sA[j + 1] = V[1] + dy * ahead; sA[j + 2] = V[2] + dz * ahead; sA[j + 3] = size;
    sB[j] = 0; sB[j + 1] = k; sB[j + 2] = end; sB[j + 3] = rec.seed % 89;
    sC[j] = rec.pi; sC[j + 1] = tier.hdr && bloom && flashOn ? p.hdr * rec.relK : 0; sC[j + 2] = alpha; sC[j + 3] = flash;
    sD[j] = R; sD[j + 1] = rm ? 0.16 : 0.1 + 0.07 * k; sD[j + 2] = rm ? 0 : tier.streaks; sD[j + 3] = rec.faceH;
    sE[j] = rec.F[0]; sE[j + 1] = rec.F[1]; sE[j + 2] = rec.F[2]; sE[j + 3] = rec.faceR;
    return at + 1;
  }

  /** The crown at the hit point; returns the next free instance. */
  function writeCrown(rec, at) {
    if (rm || rec.crownAt < 0 || at >= PIECES) return at;
    const p = rec.p;
    const t = rec.t;
    let e = -1;
    if (rec.crownEnd === -2) e = t < rec.endAt ? -1 : Math.min(1, (t - rec.endAt) / rec.fadeT);
    else if (rec.crownEnd >= 0) e = Math.min(1, (t - rec.crownEnd) / CROWN_END);
    if (e >= 1) return at;
    const age = t - rec.crownAt;
    const k = Math.floor(age / PUNCH_STEP);
    const scale = k < CROWN_PUNCH.length ? CROWN_PUNCH[k] : 1;
    const size = p.crown.size * rec.cScale * 1.25;
    const j = at * 4;
    sA[j] = rec.B[0]; sA[j + 1] = rec.B[1]; sA[j + 2] = rec.B[2]; sA[j + 3] = size;
    sB[j] = 1; sB[j + 1] = scale / 1.25; sB[j + 2] = e; sB[j + 3] = rec.seed % 97;
    sC[j] = rec.pi; sC[j + 1] = tier.hdr && bloom && flashOn ? p.hdr * rec.hitK : 0; sC[j + 2] = 1;
    sC[j + 3] = flashOn && rec.crownFlash && k < CROWN_PUNCH.length ? rec.hitK : 0;
    sD[j] = tier.tongues; sD[j + 1] = rec.beat; sD[j + 2] = k < CROWN_PUNCH.length ? 0 : CROWN_HOLE; sD[j + 3] = 0;
    sE[j] = 0; sE[j + 1] = 0; sE[j + 2] = 0; sE[j + 3] = 0;
    return at + 1;
  }

  /** The glow pool and the stepped ring on the ground; returns the next free instance. */
  function writeGround(rec, at) {
    const p = rec.p;
    const t = rec.t;
    const land = rec.landT;
    if (t < land || rec.endAt < land) return at;
    const x = rec.B[0];
    const z = rec.B[2];
    const sc = rec.cScale;
    // the pool: whenever the beam has landed (low: none, except under Reduce Motion: its held glow)
    if ((tier.pool || rm) && at < PIECES) {
      const e = t < rec.endAt ? -1 : Math.min(1, (t - rec.endAt) / (rec.fadeT + rec.poolT));
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
      for (let i = 0; i < recs.length; i++) if (recs[i].on) beats(recs[i]);
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
      for (const r of recs) out.push(r.A, r.B, r.F, r.P, r.U, r.V);
      return out;
    },
    /** The phase of a record now: 'charge', 'start', 'sustain', 'end' or 'off' (lab captions, tests). */
    phase(rec) {
      if (!rec || !rec.on) return 'off';
      if (rec.t < rec.wu) return 'charge';
      if (rec.t >= rec.endAt) return 'end';
      if (rec.t < rec.landT + BEAM_PUNCH.length * PUNCH_STEP) return 'start';
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
