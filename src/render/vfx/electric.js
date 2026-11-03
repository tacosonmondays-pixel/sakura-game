// Electricity: crackle auras, the shocked-enemy crackle, an electric ground decal and two cast hooks (docs/VFX.md
// "Electricity", batch B2; display only, not wired into the battle yet: the lab is previews/electric.html). Built on
// the inked chain lightning's toon strokes (src/render/vfx/strokes.js: ink, body, white-hot core, crisp edges, erosion
// into dashes) and the shared toon core (src/render/vfx/toonCore.js) for the ground pieces:
//
//   aura     short micro-bolts round a body, hugging a capsule (its radius, height and feet), each re-struck on its
//            own beat every few frames (a stepped, hand-drawn crackle, no smooth wobble), a few forked; each strike's
//            leader races along it, holds, then erodes. No joint comes within FACE_CONE of the side facing the camera
//            (the crackle outlines the body, never crosses its face). A charge ring glows at its feet (turning in steps)
//   shock    the same crackle, smaller and short-lived, on an enemy's body after a chain hit: a first burst of
//            bolts, then sparser, then gone
//   scorch   the electric ground decal: Worley F2 − F1 cracks laid out in polar coordinates (so they radiate), a hard
//            step, an ink rim round every crack and round the burn's outer silhouette while it is young and whole, a
//            white-hot core in the young cracks and a glow round them, over a dark translucent burn; its ink leaves
//            (in patches) before it starts to erode, then it erodes from its rim inward, never outlining a hole
//   casts    Drumstorm (Raika): her crackle for the boost and a ring of bolts bursting out on every drum beat over a
//            glowing ring on the ground, a scorch on the first beat; Drone Surge (Chika): bolts arcing drone to drone
//            round her ring, re-struck in place on a beat (at most one off at a time), with little crackles where
//            they join
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
// Pools: a full pool reuses a record that is already ending, then the oldest shock, then (for a crackle, never for a
// shock: a shock is dropped instead) the crackle with the least time left, so a shock never takes a girl's crackle;
// a reused record's `gen` goes up and a cast that pointed at it lets go of it.
//
// Branching (our own rules, with ideas from three-stdlib's LightningStrike, MIT: public/licenses/three-stdlib-MIT.txt;
// re-implemented, no code taken): a path is built by halving its segments and pushing each new joint sideways by a share
// of the segment's length that shrinks each halving (ROUGHNESS: fractal kinks); the finest halving alternates sides (a
// drawn zig-zag, not a random walk); a fork leaves from an inner joint, turned off the parent's direction, shorter and
// thinner, one generation only; each bolt shows for only part of its strikes (its duty), so the crackle thins and
// thickens bolt by bolt instead of the whole aura blinking; a strike's leader grows from its start, then erodes away.
//
// Two looks (ELECTRIC_LOOKS; a preset's `look`, or createElectricFx({ look }) for every preset): A, the inked line-work
// above (the default); B, thicker opaque stepped bands plus a ground glow: every bolt wears stepped solid bands of its
// colour round its body (the ground ramp's deep band, its body colour, the glow band, the white-hot core), ink only
// outside the main bolts' bands (the beat rings' and the arcs'; none on the micro-bolts round bodies), fewer bolts held
// longer, and a glow on the ground under each beat ring. Both on the same strokes (SOLID layers only: strokes.js is
// unchanged) and the same ground call. Neither is the tornado's translucent layered light (that needs a translucent
// stroke mode in strokes.js: its own round).
//
// The house rule (INK_WOBBLE): ink leaves before erosion opens holes. Every eroding piece's ink leaves over a window of
// its life that ends before its erosion starts (a hard step a bolt segment or a ring pixel, wobbled), so it ends in its
// colour bands, never as loose dark dashes; a ring inks only when it is wide enough on screen to hold an outline beside
// its light (RING_INK_RING_PX, all or nothing a ring), and then not on its thin dash tips (RING_INK_PX).
//
// Flash safety: every strike asks the flash guard (flashGate, the battle's world-flash budget) with its size and its
// flicker; past the budget its core is drawn at the guard's answer and nothing goes over white. No preset colour is a
// harsh red (tests hold it), nothing is full screen, Flashes & shake off: no flicker and no over-white. Reduce Motion: no
// bolts round bodies or in the burst rings (a still glow ring instead), the arcs struck once and held, no flicker, no
// turning, slower lives, rings and scorches fading in. Randomness: the stream it is handed (createVisualRandom fork;
// without one, a fixed fork of its own, never one constant path), never Math.random.
import * as THREE from 'three';
import {
  ELECTRIC_PRESETS, ELECTRIC_TIERS, ELECTRIC_CASTS, ELECTRIC_LOOKS, MAX_AURAS, MAX_BURSTS, MAX_LINKS, MAX_LINK_NODES, MAX_SCORCHES,
  MAX_CASTS,
} from './electricPresets.js';
import { createStrokes, stroke, SOLID } from './strokes.js';
import { TOON_CORE, TOON_TIER, TOON_NOISE_N, TOON_RAMP_W, TOON_REDUCE, paintToonNoise, paintToonRamp } from './toonCore.js';
import { createVisualRandom, visualSeed } from './random.js';

const TAU = Math.PI * 2;
/** Stroke layers of look A, back to front (pushed layer by layer, so a later one covers an earlier one at every joint). */
export const ELECTRIC_LAYERS = Object.freeze(['ink', 'body', 'core']);
/**
 * Look B's layers, back to front: the ink (main bolts only, outside the sheath), the sheath's outer band (the ground
 * ramp's deep band), its inner band (the bolt's body colour), the body (in the glow band's colour) and the core. Every
 * pass pushes one layer of every segment (look A's segments skip the sheath's two), so all ink lies under all sheaths.
 */
export const ELECTRIC_LAYERS_B = Object.freeze(['ink', 'sheath', 'mid', 'body', 'core']);
/** Thinnest a layer is drawn (half width, CSS px): a micro-bolt never thins into shimmering hairs. */
export const ELECTRIC_MIN_PX = Object.freeze({ ink: 1.6, sheath: 1.5, mid: 1.2, body: 1.0, core: 0.5 });
/**
 * The house rule: ink leaves before erosion opens holes, so an eroding piece ends in its colour bands, never as loose
 * dark dashes. Every piece's ink leaves over a window of its life that ends before its erosion starts: its ink phase k
 * runs 0 → 1 over that window, and a bit of ink (a bolt's segment, a ring's pixel) stays while k + INK_WOBBLE × (w − ½)
 * < ½, w its own 0..1 (a segment's hash, a ring's noise): a hard step that goes in patches, all on while k < 0.1, all
 * gone once k ≥ 0.9 (before the window ends). The windows (each piece's erosion starts at its end or later):
 *   a strike (look A's crackle, shock, the little crackles where arcs join): the last part of its hold (STRIKE_INK),
 *   after the leader has grown, so a bolt is inked for most of the time it is whole
 *   a beat ring's bolts: BURST_INK of the ring's life (they erode over its second half)
 *   an arc web: the LINK_INK s before its last LINK_END s (its end or stop())
 *   the charge ring: the RING_INK_S s after its crackle ends (then it erodes over RING_END)
 *   a beat ring on the ground: BURST_INK of its life (whole at its young threshold until BURST_HOLD)
 *   the scorch: SCORCH_INK_AGE (its own step on the age, before SCORCH_HOLD)
 */
export const INK_WOBBLE = 0.8;
/**
 * A strike's ink window, shares of its hold: inked whole through the first half of the hold, gone (wobble and all) at
 * 0.95 of it, before the erosion starts at its end (the hold over the whole window left a bolt uninked for about half
 * of its ~6-frame strike).
 */
export const STRIKE_INK = Object.freeze([0.5, 1]);
/**
 * A ring inks at all only when its band's widest on-screen half width (its full half width over the pixel along the
 * least foreshortened screen direction: on the battle's orthographic camera the same for every pixel of it) is at least
 * this many px: a thinner ring has no room for an outline beside its light, and its ink would show only where it is
 * widest (at 3 and 9 o'clock) as isolated dark ticks. All or nothing a ring, never a few brackets.
 */
export const RING_INK_RING_PX = 3.5;
/** An inked ring's rim only where its band is at least this many px wide on screen: thin dash tips draw none. */
export const RING_INK_PX = 1.5;
/** The charge ring: its ink leaves over RING_INK_S s once its crackle ends, then it erodes out over RING_END s. */
export const RING_INK_S = 0.08;
export const RING_END = 0.3;
/** A beat ring (its bolts and its ground ring): the ink leaves over this share of its life; the ground ring holds whole to BURST_HOLD. */
export const BURST_INK = Object.freeze([0.26, 0.44]);
export const BURST_HOLD = 0.5;
/** An arc web's ink leaves over this many s before its last LINK_END s (at its end, or after stop()). */
export const LINK_INK = 0.1;
/** The scorch's last flecks: from SCORCH_END.from of its age the cut climbs `add` more, past its hottest heat (no pop). */
export const SCORCH_END = Object.freeze({ from: 0.82, add: 0.5 });
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
/** Look B's glow pools: the ground pieces' share, and the heat above the cut where the hotter middle starts. */
const POOL = ELECTRIC_LOOKS.b.pool;
export const POOL_STEP = 0.32;
/** A crackle's glow pool turns its noise by POOL_TURN every POOL_STEP_S s (none under Reduce Motion). */
export const POOL_TURN = 0.06;
export const POOL_STEP_S = 0.2;
/** A shock's ring (Reduce Motion only): its ink leaves over this share of its life, then it erodes over the rest. */
export const SHOCK_RING_INK = 0.3;
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
/**
 * The face cone (rad round the body from the side facing the camera): no joint of a bolt round a body comes nearer
 * it, so the crackle outlines the body and never crosses its face or chest. Side bolts end at least FACE_MARGIN
 * further out (room for their kinks); over the top they start on the back half and only run up (to the crown).
 */
export const FACE_CONE = 1.0;
export const FACE_MARGIN = 0.25;
/** Reduce Motion: a still ring or scorch fades in (and a beat's ring out) over this many s (no hard on-cut). */
export const REDUCE_FADE = 0.12;
/** A stopped link's web erodes out over this many s (as at the end of its life). */
export const LINK_END = 0.3;
/** High with bloom: the body colour × this, under the grade's knee so it stays saturated (as the chain lightning's). */
export const BODY_UNDER_BLOOM = 0.82;
/** Floats per collected segment. */
const SEG = 17;
const MAX_SEGS = Math.floor(ELECTRIC_TIERS.high.cap / ELECTRIC_LAYERS.length);
/** Ground pieces: a scorch each, a charge ring and a glow pool (look B) per crackle, a ring and a pool per beat. */
const MAX_GROUND = 2 * MAX_AURAS + 2 * MAX_BURSTS + MAX_SCORCHES;

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
attribute vec4 gB; // mode (0 scorch, 1 ring, 2 glow pool), radius now, ring half width, the noise's turn (turns)
attribute vec4 gC; // seed, ramp row, over-white (high with bloom, through the flash guard), halo (tier)
attribute vec4 gD; // erode young, erode old, still (Reduce Motion), the cracks' reach (scorch) or the ink phase (ring)
varying vec2 vP;
varying vec4 vA;
varying vec4 vB;
varying vec4 vC;
varying vec4 vD;
void main() {
  // the quad hugs the piece as it is now (none at strength 0)
  float disc = step(gB.x, 0.5) + step(1.5, gB.x);
  float ext = mix(gB.y + gB.z * 1.6, gB.y * 1.04, disc) * step(0.0005, gA.w);
  vec2 p = position.xz * ext;
  vec3 wp = vec3(gA.x + p.x, ${ELECTRIC_GROUND_Y.toFixed(3)} + 0.002 * min(gB.x, 1.0), gA.y + p.y);
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
/**
 * The scorch holds whole for this share of its age (its erosion threshold stays at its young value, erode[0]: the only
 * edges it has are its ragged outer silhouette), then erodes from its rim inward over the rest.
 */
export const SCORCH_HOLD = 0.2;
/**
 * All the scorch's ink (its silhouette and every crack's rim) leaves at `end` of its age, ± `wobble` / 2 by the noise
 * (a hard step, so it goes in patches): gone, wobble and all, before the hold ends, so no hole the erosion opens and no
 * fragment of an eroding crack is ever outlined (they end in the body, deep and burn bands: no dark scribble).
 */
export const SCORCH_INK_AGE = Object.freeze({ end: 0.09, wobble: 0.02 });
/**
 * The burn is inked outside this share of its radius only. While it holds, every edge it has lies out there (heat =
 * band × (0.3 + noise) ≥ 0.3 × (1 − x²) > erode[0] inside √(1 − erode[0] / 0.3), 0.93 for the presets): its outer
 * silhouette, never an inner hole.
 */
export const SCORCH_RIM_X = 0.88;
/** toonHeat's floor (heat = band × (0.3 + noise), noise 0..1): the least heat a band can have at a given radius. */
export const SCORCH_HEAT_FLOOR = 0.3;

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
    // whole while it holds (the threshold at its young value), then eroding from its rim inward; its last flecks: the
    // cut climbs past the hottest heat by the end of its life, so they shrink away (never pop off)
    float cut = toonCut(vD.xy, max(0.0, age - ${SCORCH_HOLD.toFixed(2)}) / ${(1 - SCORCH_HOLD).toFixed(2)});
    cut += max(0.0, age - ${SCORCH_END.from.toFixed(2)}) / ${(1 - SCORCH_END.from).toFixed(2)} * ${SCORCH_END.add.toFixed(2)};
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
    // ink: a rim round every crack (its share of the crack's width, never under ~1 px) and round the burn's outer
    // silhouette; a crack thinner on screen than its rim would be all ink, so the rim leaves where the crack is under
    // SCORCH_INK_PX. Only while young and whole: all of it leaves (a hard step on the age, wobbled by the noise: in
    // patches) before the hold ends, so the holes the erosion opens and the fragments of eroding cracks are never
    // outlined (an old burn goes in quiet tongues, its cracks end in the body and deep bands, never a scribble)
    float rimW = max(0.4 * w, 1.1 * fw);
    float wide = step(${SCORCH_INK_PX.toFixed(1)} * fw, w);
    float inked = step(age + ${SCORCH_INK_AGE.wobble.toFixed(2)} * (n - 0.5), ${SCORCH_INK_AGE.end.toFixed(2)});
    float burnInk = eRim(heat - cut, 1.2, 0.025) * burn * step(${SCORCH_RIM_X.toFixed(2)}, x);
    float ink = max((1.0 - crack) * zone * step(e, w + rimW) * wide, burnInk) * inked;
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
  } else if (vB.x < 1.5) {
    // a ring (the charge ring under a crackling body, a drum beat's ring): a band of light broken by the polar noise
    // (it turns in steps), its middle hotter, inked on its outer edge. The ink only while it holds whole: it leaves in
    // patches (a hard step on its ink phase, vD.w, wobbled by the noise) before the erosion opens a hole (the CPU holds
    // the erosion age, vA.z, at 0 until the ink is gone), so an eroding ring ends in its light bands. All or nothing a
    // ring: only when its band's widest on-screen half width is at least RING_INK_RING_PX (its half width over the
    // pixel along the least foreshortened direction: one value for the whole ring on an orthographic camera), else a
    // thin ring would ink only where it is widest, as stray dark ticks; and then only where the band is at least
    // RING_INK_PX wide on screen (its half width here is xo: the noise runs round it, not across; the gradient's length,
    // the same in every direction), so a thin dash tip or a sliver draws no ink
    float x = (r - R) / max(vB.z, 1e-3);
    float band = 1.0 - x * x;
    float n = toonNoise(uNoise, vec2(u * 4.0 + vB.w, 0.35 + vC.x), 0.0);
    float heat = toonHeat(band, n);
    float cut = toonCut(vD.xy, age);
    m = toonMask(heat, cut) * step(0.0, band);
    float above = heat - cut;
    float xo = sqrt(max(0.0, 1.0 - cut / (${SCORCH_HEAT_FLOOR.toFixed(1)} + n)));
    float pxW = max(min(length(dFdx(vP)), length(dFdy(vP))), 1e-6);
    float ringInk = step(${RING_INK_RING_PX.toFixed(1)}, vB.z / pxW);
    float wideR = step(${RING_INK_PX.toFixed(1)} * length(vec2(dFdx(x), dFdy(x))), xo);
    float inkOn = step(vD.w + ${INK_WOBBLE.toFixed(2)} * (n - 0.5), 0.5);
    float ink = eRim(above, 1.2, 0.03) * step(0.0, x) * wideR * inkOn * ringInk;
    float glow = step(0.22, above);
    float core = step(0.48, above);
    b = mix(${GROUND_BAND.body.toFixed(1)}, ${GROUND_BAND.glow.toFixed(1)}, glow);
    cover = mix(${RING_COVER.body}, ${RING_COVER.glow}, glow);
    b = mix(b, ${GROUND_BAND.core.toFixed(1)}, core);
    cover = mix(cover, ${RING_COVER.core}, core);
    b = mix(b, ${GROUND_BAND.ink.toFixed(1)}, ink);
    cover = mix(cover, ${RING_COVER.ink.toFixed(1)}, ink);
    hot = core * (1.0 - ink);
  } else {
    // a glow pool (look B): light lying on the ground under a crackle or a beat ring. The house heat over a disc, a hard
    // step (a ragged edge in tongues), its hotter middle in the glow band; added light that covers little; no ink
    float x = r / R;
    float band = 1.0 - x * x;
    float n = toonNoise(uNoise, vec2(u * 3.0 + vB.w, x * 0.7 + vC.x), 0.0);
    float heat = toonHeat(band, n);
    float cut = toonCut(vD.xy, age);
    m = toonMask(heat, cut) * step(0.0, band);
    float hotter = step(${POOL_STEP.toFixed(2)}, heat - cut);
    b = mix(${GROUND_BAND.deep.toFixed(1)}, ${GROUND_BAND.body.toFixed(1)}, hotter);
    cover = mix(${POOL.cover[0].toFixed(2)}, ${POOL.cover[1].toFixed(2)}, hotter);
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
    w: 0, seed: 0, k: 1, odd: 0, L: 0, fu: 0, lead: 0, shown: false,
  };
}

/**
 * @param {{ scene: THREE.Object3D, camera?: THREE.Camera|null, strokes?: object|null, quality?: 'high'|'medium'|'low',
 *   reduceMotion?: boolean, rand?: () => number, presets?: object, flashes?: boolean, look?: 'a'|'b'|null }} o
 *   strokes: the battle's shared toon strokes (its owner begins and ends them each frame); none: its own
 *   look: every preset in this look (ELECTRIC_LOOKS); none: each preset's own `look`
 */
export function createElectricFx({ scene, camera = null, strokes = null, quality = 'medium', reduceMotion = false, rand = null, presets = ELECTRIC_PRESETS, flashes = true, look = null }) {
  const ids = Object.keys(presets);
  // ---- the looks, by preset index (1: look B, the luminous sheath and the glow pools)
  const LB = ELECTRIC_LOOKS.b;
  const LOOKB = new Uint8Array(ids.length);
  ids.forEach((id, i) => {
    LOOKB[i] = ELECTRIC_LOOKS[ELECTRIC_LOOKS[look] ? look : presets[id].look]?.sheath ? 1 : 0;
  });
  /** The look every preset is in ('a', 'b', or 'mixed'), worked out once (stats). */
  const LOOK_NAME = LOOKB.every((v) => v) ? 'b' : LOOKB.some((v) => v) ? 'mixed' : 'a';
  /** Stroke layers a segment can take (the cap is counted in whole segments of this many). */
  const LAYERS = LOOKB.some((v) => v) ? ELECTRIC_LAYERS_B.length : ELECTRIC_LAYERS.length;
  // (without a stream: a fixed fork of its own, so every bolt still has its own path, never one constant shape)
  const rnd = rand || createVisualRandom(visualSeed('electric', 'fallback'));
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
  /**
   * Linear colours per preset and layer (ELECTRIC_LAYERS_B: ink, sheath, mid, body, core; parsed once): look A's body is
   * the bolt's body colour; look B's sheath is the ground ramp's deep band, its mid band the bolt's body colour and its
   * body the glow band (brighter inward, to the white-hot core).
   */
  const NL = ELECTRIC_LAYERS_B.length;
  const cols = new Float32Array(ids.length * NL * 3);
  ids.forEach((id, i) => {
    const p = presets[id];
    const hexes = [p.ink, p.ground[GROUND_BAND.deep], p.body, LOOKB[i] ? p.ground[GROUND_BAND.glow] : p.body, p.core];
    hexes.forEach((hex, j) => {
      const c = new THREE.Color(hex);
      cols[(i * NL + j) * 3] = c.r;
      cols[(i * NL + j) * 3 + 1] = c.g;
      cols[(i * NL + j) * 3 + 2] = c.b;
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
    auras.push({ on: false, gen: 0, kind: AURA, id: '', p: null, pi: 0, x: 0, z: 0, y0: 0, lift: 0, rad: 0.27, h: 0.9, size: 1, t: 0, life: Infinity, end: 0, follow: null, seed: 0, bolts });
  }
  const bursts = [];
  for (let i = 0; i < MAX_BURSTS; i++) {
    const bolts = [];
    for (let b = 0; b < MAX_BURST_BOLTS; b++) bolts.push(boltSlot());
    bursts.push({ on: false, gen: 0, id: '', p: null, pi: 0, x: 0, z: 0, size: 1, t: 0, life: 0, next: 0, k: 1, seed: 0, bolts });
  }
  const links = [];
  for (let i = 0; i < MAX_LINKS; i++) {
    const arcs = [];
    const nodes = [];
    for (let b = 0; b < MAX_LINK_NODES; b++) arcs.push(boltSlot());
    for (let b = 0; b < MAX_LINK_NODES * MAX_NODE_BOLTS; b++) nodes.push(boltSlot());
    links.push({ on: false, gen: 0, id: '', p: null, pi: 0, pts: null, n: 0, closed: true, t: 0, life: 0, end: 0, size: 1, sag: new Float32Array(MAX_LINK_NODES), arcs, nodes });
  }
  const scorches = [];
  for (let i = 0; i < MAX_SCORCHES; i++) scorches.push({ on: false, gen: 0, id: '', p: null, pi: 0, x: 0, z: 0, rad: 0.6, t: 0, life: 1, seed: 0, k: 1 });
  const casts = [];
  for (let i = 0; i < MAX_CASTS; i++) casts.push({ on: false, gen: 0, id: '', def: null, x: 0, z: 0, t: 0, dur: 0, beats: 0, next: 0, aura: null, link: null, follow: null, size: 1 });

  /**
   * A record handed out again: its generation goes up (a caller holding it can tell), and a cast that pointed at it
   * (its crackle or its web) lets go of it, so stopping that cast never ends someone else's piece.
   */
  const reuse = (rec) => {
    rec.gen++;
    if (rec.on) {
      for (const c of casts) {
        if (c.aura === rec) c.aura = null;
        if (c.link === rec) c.link = null;
      }
    }
    return rec;
  };
  /** A free record of a pool, or its oldest. */
  const take = (pool) => {
    for (const r of pool) if (!r.on) return reuse(r);
    let rec = pool[0];
    for (const r of pool) if (r.t > rec.t) rec = r;
    return reuse(rec);
  };
  /**
   * A crackle's record (auras and shocks share the pool): a free one; else one already ending (past its life, its last
   * strikes eroding: the furthest gone); else the oldest shock; else, for a crackle, the one with the least time left
   * (then the oldest). A shock never takes a girl's crackle: with every record a crackle, the shock is dropped (null).
   */
  const takeAura = (kind) => {
    for (const r of auras) if (!r.on) return reuse(r);
    let rec = null;
    for (const r of auras) if (r.t > r.life && (!rec || r.t - r.life > rec.t - rec.life)) rec = r;
    if (!rec) for (const r of auras) if (r.kind === SHOCK && (!rec || r.t > rec.t)) rec = r;
    if (!rec && kind !== SHOCK) {
      for (const r of auras) {
        const left = r.life - r.t;
        const best = rec ? rec.life - rec.t : Infinity;
        if (!rec || left < best || (left === best && r.t > rec.t)) rec = r;
      }
    }
    return rec ? reuse(rec) : null;
  };

  // ---- the view: bolts start on the body's silhouette and the side facing the camera
  function view() {
    if (!camera) return;
    const e = camera.matrixWorld.elements;
    if (Math.abs(e[8]) + Math.abs(e[10]) > 1e-4) CLK[1] = Math.atan2(e[10], e[8]);
  }

  /** Anything up (any record of any pool)? */
  function busy() {
    for (let ri = 0; ri < casts.length; ri++) {
      const r = casts[ri];
      if (r.on) return true;
    }
    for (let ri = 0; ri < auras.length; ri++) {
      const r = auras[ri];
      if (r.on) return true;
    }
    for (let ri = 0; ri < bursts.length; ri++) {
      const r = bursts[ri];
      if (r.on) return true;
    }
    for (let ri = 0; ri < links.length; ri++) {
      const r = links[ri];
      if (r.on) return true;
    }
    for (let ri = 0; ri < scorches.length; ri++) {
      const r = scorches[ri];
      if (r.on) return true;
    }
    return false;
  }

  /** The flash guard's answer for one strike (its size, world units; its strength). */
  function gate(size, strength) {
    if (!flashOn || !api.flashGate) return 1;
    gates++;
    return api.flashGate(size, null, strength);
  }

  // ---- strikes (a new path for a bolt: on its beat, never per frame)

  /**
   * Keeps a path's n joints in P (local: arc length round the capsule, height, off it) on the body and out of the face
   * cone: a joint's height stays between the feet and the top (its kinks never poke past the crown), and a joint nearer
   * the side facing the camera than FACE_CONE is set on the cone's edge on the bolt's own side (`side`, ±1: it never
   * crosses the face to the other edge).
   */
  function hugBody(P, n, rec, side) {
    const rad = rec.rad;
    const y0 = rec.y0;
    const y1 = rec.y0 + rec.h;
    const rr = Math.min(rad, rec.h / 2);
    for (let j = 0; j < n; j++) {
      const o = j * 3;
      let d = P[o] / rad - CLK[1];
      d -= TAU * Math.round(d / TAU);
      if (d < FACE_CONE && d > -FACE_CONE) P[o] += (side * FACE_CONE - d) * rad;
      if (P[o + 1] < y0) P[o + 1] = y0;
      else if (P[o + 1] > y1) P[o + 1] = y1;
      // never through the axis: near the crown or the feet (where the capsule narrows) a kink's negative stand-off
      // would flip the joint to the far side of the body (capsuleRadius inlined)
      const y = P[o + 1];
      let cr = rr;
      if (y < y0 + rr) {
        const k = (y0 + rr - y) / rr;
        cr = rr * Math.sqrt(Math.max(0, 1 - k * k));
      } else if (y > y1 - rr) {
        const k = (y - y1 + rr) / rr;
        cr = rr * Math.sqrt(Math.max(0, 1 - k * k));
      }
      if (cr + P[o + 2] < 0.004) P[o + 2] = 0.004 - cr;
    }
  }

  /** A bolt round a capsule (local: arc length round it, height, off the surface). */
  function strikeCapsule(s, rec, lenR, levels, forks) {
    const p = rec.p;
    const rad = rec.rad;
    const y0 = rec.y0;
    const h = rec.h;
    const size = rec.size;
    const a = p.aura;
    // along the body's silhouette (its left and right edges as the camera sees it, running mostly up and down it) and
    // over its top (from the back half, running up to the crown): the crackle outlines the body, and no joint comes
    // within FACE_CONE of the side facing the camera, so it never crosses the face or the chest
    const top = rnd() < TOP_SHARE;
    const side = rnd() < 0.5 ? -1 : 1;
    const d0 = top ? Math.PI / 2 + rnd() * (Math.PI / 2) : Math.PI / 2 + (rnd() - 0.5) * 0.9;
    const ay = top ? y0 + h * (0.72 + 0.2 * rnd()) : y0 + h * (0.12 + 0.66 * rnd());
    const L = lerp(lenR[0], lenR[1], rnd()) * size;
    const ang = top ? Math.PI / 2 + (rnd() - 0.5) * 1.6 : (rnd() < 0.5 ? 1 : -1) * Math.PI / 2 + (rnd() - 0.5) * 1.3;
    const ax = (CLK[1] + side * d0) * rad;
    // its end at least FACE_MARGIN outside the cone (room for the kinks), on its own side
    const db = Math.max(FACE_CONE + FACE_MARGIN, d0 + (side * Math.cos(ang) * L) / rad);
    const bx = (CLK[1] + side * db) * rad;
    const by = clamp(ay + Math.sin(ang) * L, y0 + 0.02 * h, y0 + h);
    const stand = a.stand * size;
    FP[0] = ax; FP[1] = ay; FP[2] = stand * (0.5 + 0.6 * rnd());
    FP[3] = bx; FP[4] = by; FP[5] = stand * (0.5 + 0.6 * rnd());
    FP[6] = a.wander; FP[7] = a.zig; FP[8] = 0.35; FP[9] = a.skew;
    s.n = fractalFill(s.P, levels, rnd);
    hugBody(s.P, s.n, rec, side);
    s.L = L;
    s.nf = 0;
    if (forks > 0 && s.n > 2 && rnd() < a.fork) {
      const j = 1 + Math.floor(rnd() * (s.n - 2));
      const fx = s.P[j * 3];
      const fy = s.P[j * 3 + 1];
      const fd = s.P[j * 3 + 2];
      const base = Math.atan2(s.P[(j + 1) * 3 + 1] - s.P[(j - 1) * 3 + 1], s.P[(j + 1) * 3] - s.P[(j - 1) * 3]);
      const turn = (rnd() < 0.5 ? -1 : 1) * (0.55 + 0.55 * rnd());
      // (a fork reaches out off the body: it breaks the silhouette; of its two turns, the one away from the face)
      const dir = side * Math.cos(base + turn) >= side * Math.cos(base - turn) ? base + turn : base - turn;
      const FL = L * (0.38 + 0.25 * rnd());
      FP[0] = fx; FP[1] = fy; FP[2] = fd;
      FP[3] = fx + Math.cos(dir) * FL; FP[4] = clamp(fy + Math.sin(dir) * FL, y0, y0 + h); FP[5] = fd + stand * (1.5 + 1.5 * rnd());
      FP[6] = a.wander; FP[7] = a.zig; FP[8] = 0.3; FP[9] = a.skew;
      s.nf = fractalFill(s.F, Math.max(1, levels - 1), rnd);
      hugBody(s.F, s.nf, rec, side);
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
    s.next = rec.t + lerp(restrike[0], restrike[1], rnd()) * (LOOKB[rec.pi] ? LB.restrike : 1);
  }

  /** Strikes the bolts of a drum-beat ring (local: angle × r1, out from the ring, up). */
  function strikeBurst(rec) {
    const p = rec.p;
    const B = p.burst;
    const K = tier.burst;
    const span = TAU / K;
    const reach = LOOKB[rec.pi] ? LB.burstSpan : 1;
    const R1 = B.r1 * rec.size;
    const levels = tier.arcLevels;
    for (let i = 0; i < K; i++) {
      const s = rec.bolts[i];
      const th0 = rec.seed * TAU + i * span + (rnd() - 0.5) * span * 0.25;
      const th1 = th0 + span * (0.6 + 0.25 * rnd()) * reach;
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

  /**
   * Strikes the arc of a link between its points i and i + 1 (local: share along, up, sideways; × the span). Its first
   * strike races its leader out from the point; later ones re-strike in place, whole at once (a held web that re-kinks
   * on the beat, never half-grown arcs ending in mid-air). An arc is off for 1 − duty of its strikes, but never while
   * another arc of the web is off: at most one gap in the web at a time.
   */
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
    s.lead = s.shown ? 0 : A.grow;
    s.on = rm || rnd() < A.duty || linkGap(rec, i);
    if (s.on) s.shown = true;
    s.odd ^= 1;
    s.next = rec.t + lerp(A.restrike[0], A.restrike[1], rnd());
  }
  /** Is another arc of the link (not i) struck and off now? */
  function linkGap(rec, i) {
    const edges = rec.closed ? rec.n : rec.n - 1;
    for (let k = 0; k < edges; k++) if (k !== i && rec.arcs[k].t0 >= 0 && !rec.arcs[k].on) return true;
    return false;
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
    const rec = takeAura(kind);
    if (!rec) return null;
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
    rec.next = p.burst.restrike * (LOOKB[rec.pi] ? LB.burstRestrike : 1);
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
      s.lead = 0;
      s.shown = false;
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
    // (a web's ink leaves over LINK_INK s, then it erodes out over its last LINK_END s, as at the end of its life: no
    // re-strike from now)
    else if ('arcs' in rec) rec.life = Math.min(rec.life, rec.t + LINK_INK + LINK_END);
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
  /** The path being pushed: u0, u1, w0, w1, head, cut, seed, preset index, core strength, over-white, taper, ink phase. */
  const PP = new Float64Array(12);
  /**
   * A strike's state now: head, cut, shrink, core strength, over-white; [5] the beat ring's radius now; [6] its ink phase
   * (INK_WOBBLE: 0 inked, ≥ 1 gone; 99: no ink, look B's micro-bolts).
   */
  const ST = new Float64Array(7);
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
  const nodeRec = { x: 0, z: 0, rad: 0.07, y0: 0, h: 0.14, lift: 0, size: 0.6, p: null, pi: 0 };

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
      segs[o + 16] = PP[11];
      sn++;
    }
    return true;
  }

  /**
   * A strike's leader head, erosion and the core's strength now (into ST); false when it is over. Its ink leaves over the
   * last part of its hold (STRIKE_INK: after the leader has grown and most of the hold, before the erosion: ST[6]); look
   * B's micro-bolts have none, and hold longer.
   */
  function strikeState(s, rec, a) {
    const age = rec.t - s.t0;
    const b = LOOKB[rec.pi];
    const hold = a.hold * (b ? LB.hold : 1);
    if (age < 0 || age > a.grow + hold + a.fade) return false;
    ST[0] = a.grow > 0 ? age / a.grow : 99;
    ST[1] = age > a.grow + hold ? Math.min(1.05, ((age - a.grow - hold) / Math.max(1e-4, a.fade)) * 1.05) : 0;
    ST[2] = 1 - 0.35 * ST[1];
    ST[3] = (flashOn && !rm ? 1 - rec.p.flicker * s.odd : 1) * Math.min(1, s.k);
    ST[4] = tier.hdr && bloom && flashOn && s.k >= 1 ? 1 : 0;
    ST[6] = b ? 99 : ((age - a.grow) / Math.max(1e-4, hold) - STRIKE_INK[0]) / (STRIKE_INK[1] - STRIKE_INK[0]);
    return true;
  }

  /** Pushes a bolt and its fork (the strike's state in ST, its preset index and taper in PP[7], PP[10]). */
  function pushBolt(s, map, ctx) {
    const w0 = s.w * ST[2];
    const w1 = s.w * PP[10] * ST[2];
    PP[0] = 0; PP[1] = 1; PP[2] = w0; PP[3] = w1;
    PP[4] = ST[0]; PP[5] = ST[1]; PP[6] = s.seed; PP[8] = ST[3]; PP[9] = ST[4]; PP[11] = ST[6];
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
    maxSegs = Math.min(MAX_SEGS, Math.floor(tier.cap / LAYERS), Math.floor((lines.room ? lines.room() : Infinity) / LAYERS));
    if (rm) {
      // Reduce Motion: only the links' arcs, struck once and held
      for (let ri = 0; ri < links.length; ri++) {
        const rec = links[ri];
        if (rec.on) collectLink(rec);
      }
      return sn;
    }
    for (let ri = 0; ri < auras.length; ri++) {
      const rec = auras[ri];
      if (!rec.on) continue;
      const a = rec.p.aura;
      const count = boltCount(rec);
      PP[7] = rec.pi;
      PP[10] = rec.p.taper;
      for (let b = 0; b < count; b++) {
        const s = rec.bolts[b];
        if (!s.on || !strikeState(s, rec, a)) continue;
        if (!pushBolt(s, mapCapsule, rec)) return sn;
      }
    }
    for (let ri = 0; ri < bursts.length; ri++) {
      const rec = bursts[ri];
      if (!rec.on) continue;
      const B = rec.p.burst;
      const age = rec.t / rec.life;
      ST[5] = lerp(B.r0, B.r1, 1 - Math.pow(1 - Math.min(1, age), 3)) * rec.size;
      PP[7] = rec.pi;
      PP[10] = 0.7;
      for (let i = 0; i < tier.burst; i++) {
        const s = rec.bolts[i];
        if (!s.on) continue;
        // a beat's bolts: the leader races round the ring at the start, the ink leaves over BURST_INK of its life, then
        // the bolts erode over its second half
        ST[0] = Math.min(99, rec.t / Math.max(1e-4, B.restrike));
        ST[1] = age > 0.5 ? Math.min(1.05, ((age - 0.5) / 0.5) * 1.05) : 0;
        ST[2] = 1 - 0.35 * ST[1];
        ST[3] = (flashOn ? 1 - rec.p.flicker * s.odd : 1) * Math.min(1, rec.k);
        ST[4] = tier.hdr && bloom && flashOn && rec.k >= 1 ? 1 : 0;
        ST[6] = (age - BURST_INK[0]) / (BURST_INK[1] - BURST_INK[0]);
        if (!pushBolt(s, mapBurst, rec)) return sn;
      }
    }
    for (let ri = 0; ri < links.length; ri++) {
      const rec = links[ri];
      if (rec.on) collectLink(rec);
    }
    return sn;
  }

  function collectLink(rec) {
    const p = rec.p;
    const A = p.arc;
    const edges = rec.closed ? rec.n : rec.n - 1;
    // the web's ink leaves over the LINK_INK s before its last LINK_END s, then it erodes out over those
    const left = rec.life - rec.t;
    const cutAll = left < LINK_END ? Math.min(1.05, ((LINK_END - left) / LINK_END) * 1.05) : 0;
    const inkK = (LINK_END + LINK_INK - left) / LINK_INK;
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
      ST[0] = rm ? 99 : s.lead > 0 ? age / s.lead : 99;
      ST[1] = cutAll;
      ST[2] = 1 - 0.35 * cutAll;
      ST[3] = (flashOn && !rm ? 1 - p.flicker * s.odd : 1) * Math.min(1, s.k);
      ST[4] = tier.hdr && bloom && flashOn && s.k >= 1 ? 1 : 0;
      ST[6] = inkK;
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

  /**
   * Pushes the collected segments layer by layer (ELECTRIC_LAYERS_B: ink, sheath, mid, body, core; look A's segments
   * skip the sheath's two); returns how many strokes. A segment's ink is pushed only while its piece's ink phase leaves
   * it on there (INK_WOBBLE: a hard step a segment, wobbled by a hash of its bolt's seed and its place along it), so a
   * bolt's ink leaves in patches before it erodes and its dashes end in its colour.
   */
  function write(count) {
    let j = 0;
    const dimBody = tier.hdr && bloom ? BODY_UNDER_BLOOM : 1;
    const inkAll = 0.5 - INK_WOBBLE / 2;
    const inkNone = 0.5 + INK_WOBBLE / 2;
    for (let li = 0; li < NL; li++) {
      S.minPx = MIN_PX_BY_LAYER[li];
      S.kind = SOLID;
      for (let s = 0; s < count; s++) {
        const o = s * SEG;
        const pi = segs[o + 13];
        const b = LOOKB[pi];
        if (!b && (li === 1 || li === 2)) continue;
        if (li === 0) {
          const k = segs[o + 16];
          if (k >= inkNone) continue;
          if (k > inkAll) {
            const h = Math.sin(segs[o + 12] * 12.9898 + segs[o + 8] * 78.233) * 43758.5453;
            if (k + INK_WOBBLE * (h - Math.floor(h) - 0.5) >= 0.5) continue;
          }
        }
        const p = plist[pi];
        // look B: the body a little narrower, its sheath's bands round it
        const wa = segs[o + 6] * (b ? LB.width : 1);
        const wb = segs[o + 7] * (b ? LB.width : 1);
        const dim = li === 3 || (b && li > 0 && li < 3) ? dimBody : 1;
        let ka = wa;
        let kb = wb;
        let alpha = 1;
        if (li === 0) {
          const oa = b ? wa * LB.bands[0] : wa;
          const ob = b ? wb * LB.bands[0] : wb;
          ka = oa + p.inkWidth * (wa > 0 ? Math.max(0.7, Math.min(1, segs[o + 6] / p.width)) : 1);
          kb = ob + p.inkWidth * (wb > 0 ? Math.max(0.7, Math.min(1, segs[o + 7] / p.width)) : 1);
        } else if (li === 1 || li === 2) {
          ka = wa * LB.bands[li - 1];
          kb = wb * LB.bands[li - 1];
        } else if (li === 4) {
          const share = b ? LB.coreShare : p.coreShare;
          ka = wa * share;
          kb = wb * share;
          alpha = segs[o + 14];
        }
        const c = (pi * NL + li) * 3;
        S.ax = segs[o]; S.ay = segs[o + 1]; S.az = segs[o + 2]; S.wa = ka;
        S.bx = segs[o + 3]; S.by = segs[o + 4]; S.bz = segs[o + 5]; S.wb = kb;
        S.ua = segs[o + 8]; S.ub = segs[o + 9]; S.head = segs[o + 10]; S.tail = -99;
        S.r = cols[c] * dim; S.g = cols[c + 1] * dim; S.b = cols[c + 2] * dim; S.a = alpha;
        S.seed = segs[o + 12]; S.hdr = li === 4 && segs[o + 15] > 0 ? p.hdr : 0;
        S.cut = segs[o + 11]; S.noise = 7; S.bandFreq = 0; S.bandSpeed = 0;
        if (!lines.push(S)) return j;
        j++;
      }
    }
    return j;
  }
  /** The presets by index, and each layer's pixel floor. */
  const plist = ids.map((id) => presets[id]);
  const MIN_PX_BY_LAYER = ELECTRIC_LAYERS_B.map((l) => ELECTRIC_MIN_PX[l]);
  /** A crackle's bolts: the tier's (a shock's smaller count), fewer in look B. */
  function boltCount(rec) {
    const n = rec.kind === SHOCK ? tier.shock : tier.bolts;
    return LOOKB[rec.pi] ? Math.max(1, Math.round(n * LB.bolts)) : n;
  }

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
    for (let ri = 0; ri < scorches.length; ri++) {
      const rec = scorches[ri];
      if (!rec.on) continue;
      // (in over 2 frames; Reduce Motion: faded in, no hard on-cut)
      GP[0] = rec.x; GP[1] = rec.z; GP[2] = Math.min(1, rec.t / rec.life); GP[3] = Math.min(1, rec.t / (rm ? REDUCE_FADE : 0.03)) * strength;
      GP[4] = 0; GP[5] = rec.rad; GP[6] = 0; GP[7] = 0;
      GP[8] = rec.seed; GP[9] = rec.pi; GP[10] = hdrOn && rec.k >= 1 ? rec.p.hdr : 0; GP[11] = tier.halo ? 1 : 0;
      GP[12] = rec.p.scorch.erode[0]; GP[13] = rec.p.scorch.erode[1]; GP[14] = still;
      GP[15] = rm ? 1 : 1 - Math.pow(1 - Math.min(1, rec.t / 0.12), 3);
      pushGround();
    }
    // look B: a glow pool under each beat ring (and, with pool.aura over 0, under each crackle: none under a shock),
    // under the rings; eroding in (from its young threshold) and out when it ends, turning in slow steps
    for (let ri = 0; ri < auras.length && POOL.aura > 0; ri++) {
      const rec = auras[ri];
      if (!rec.on || rec.kind === SHOCK || !LOOKB[rec.pi]) continue;
      const over = rec.t - rec.life;
      GP[0] = rec.x; GP[1] = rec.z; GP[2] = over > 0 ? Math.min(1, over / RING_END) : 0;
      GP[3] = Math.min(1, rec.t / 0.12) * POOL.strength * strength;
      GP[4] = 2; GP[5] = rec.rad * POOL.aura; GP[6] = 0; GP[7] = rm ? 0 : Math.floor(rec.t / POOL_STEP_S) * POOL_TURN;
      GP[8] = rec.seed; GP[9] = rec.pi; GP[10] = 0; GP[11] = 0;
      GP[12] = POOL.erode[0]; GP[13] = POOL.erode[1]; GP[14] = still; GP[15] = 0;
      pushGround();
    }
    for (let ri = 0; ri < bursts.length; ri++) {
      const rec = bursts[ri];
      if (!rec.on || !LOOKB[rec.pi]) continue;
      const B = rec.p.burst;
      const age = Math.min(1, rec.t / rec.life);
      const fade = rm ? clamp(Math.min(rec.t, rec.life - rec.t) / REDUCE_FADE, 0, 1) : Math.min(1, rec.t / 0.05);
      GP[0] = rec.x; GP[1] = rec.z; GP[2] = age; GP[3] = fade * POOL.strength * strength;
      GP[4] = 2; GP[5] = (rm ? lerp(B.r0, B.r1, 0.75) : lerp(B.r0, B.r1, 1 - Math.pow(1 - age, 3))) * rec.size * POOL.burst;
      GP[6] = 0; GP[7] = 0;
      GP[8] = rec.seed; GP[9] = rec.pi; GP[10] = 0; GP[11] = 0;
      GP[12] = POOL.erode[0]; GP[13] = POOL.erode[1]; GP[14] = still; GP[15] = 0;
      pushGround();
    }
    // the charge ring at a crackling body's feet (Reduce Motion: the still glow ring that stands for the crackle). Its
    // ink leaves over RING_INK_S once the crackle ends, then it erodes out over RING_END (the erosion age, GP[2], held
    // at 0 until the ink is gone; a shock's ring under Reduce Motion: over the first SHOCK_RING_INK of its life)
    for (let ri = 0; ri < auras.length; ri++) {
      const rec = auras[ri];
      if (!rec.on || (rec.kind === SHOCK && !rm)) continue;
      const g = rec.p.aura.ring;
      const over = rec.t - rec.life;
      let inkK = over > 0 ? over / RING_INK_S : 0;
      let age = over > RING_INK_S ? Math.min(1, (over - RING_INK_S) / RING_END) : 0;
      if (rec.kind === SHOCK) {
        const sa = Math.min(1, rec.t / rec.life);
        inkK = Math.max(inkK, sa / SHOCK_RING_INK);
        age = Math.max(age, Math.max(0, sa - SHOCK_RING_INK) / (1 - SHOCK_RING_INK));
      }
      GP[0] = rec.x; GP[1] = rec.z; GP[2] = age; GP[3] = Math.min(1, rec.t / 0.1) * strength;
      GP[4] = 1; GP[5] = rec.rad * g.radius * (rec.kind === SHOCK ? 0.85 : 1); GP[6] = g.width * rec.size;
      GP[7] = rm ? 0 : Math.floor(rec.t / RING_STEP) * RING_TURN;
      GP[8] = rec.seed; GP[9] = rec.pi; GP[10] = 0; GP[11] = 0;
      GP[12] = rm ? 0.04 : AURA_RING_CUT; GP[13] = 0.95; GP[14] = still; GP[15] = inkK;
      pushGround();
    }
    // a drum beat's ring on the ground, bursting out under its bolts (Reduce Motion: still, at most of its reach, faded
    // in and out over REDUCE_FADE: no hard on-cut or off-cut each beat); no over-white on the ring: the bolts over it
    // carry the glow (a wide ring over white would bloom into a soft halo). Whole (its young threshold) until
    // BURST_HOLD of its life, its ink leaving over BURST_INK before that, then it erodes over the rest
    for (let ri = 0; ri < bursts.length; ri++) {
      const rec = bursts[ri];
      if (!rec.on) continue;
      const B = rec.p.burst;
      const age = Math.min(1, rec.t / rec.life);
      const fade = rm ? clamp(Math.min(rec.t, rec.life - rec.t) / REDUCE_FADE, 0, 1) : 1;
      GP[0] = rec.x; GP[1] = rec.z; GP[2] = Math.max(0, age - BURST_HOLD) / (1 - BURST_HOLD); GP[3] = fade * strength;
      GP[4] = 1; GP[5] = (rm ? lerp(B.r0, B.r1, 0.75) : lerp(B.r0, B.r1, 1 - Math.pow(1 - age, 3))) * rec.size * 0.94;
      GP[6] = 0.04 * rec.size; GP[7] = 0;
      GP[8] = rec.seed; GP[9] = rec.pi; GP[10] = 0; GP[11] = 0;
      GP[12] = rm ? 0.04 : 0.22; GP[13] = 0.95; GP[14] = still; GP[15] = (age - BURST_INK[0]) / (BURST_INK[1] - BURST_INK[0]);
      pushGround();
    }
    geo.instanceCount = gn;
    if (gn) for (let ri = 0; ri < gList.length; ri++) {
      const a = gList[ri];
      a.needsUpdate = true;
    }
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
    const tail = p.aura.grow + p.aura.hold * (LOOKB[rec.pi] ? LB.hold : 1) + p.aura.fade;
    // (its last strikes erode out; its charge ring's ink leaves, then it erodes out)
    if (rec.t > rec.life + Math.max(tail, RING_INK_S + RING_END)) {
      rec.on = false;
      return;
    }
    if (rm || rec.t > rec.life) return;
    const count = boltCount(rec);
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
      while (rec.t >= rec.next) rec.next += rec.p.burst.restrike * (LOOKB[rec.pi] ? LB.burstRestrike : 1);
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
      // Reduce Motion: struck once and held (it still follows its points); no re-strike once its ink starts leaving
      if (rm ? s.t0 < 0 || !s.on : rec.t >= s.next && rec.t < rec.life - LINK_END - LINK_INK) {
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
        if (rec.t >= s.next && rec.t < rec.life - LINK_END - LINK_INK) {
          nodeRec.p = p;
          nodeRec.pi = rec.pi;
          strikeCapsule(s, nodeRec, p.shock.len, 1, 0);
          // (struck at the origin's band; drawn round the point by its own frame each frame)
          s.t0 = rec.t;
          s.on = rnd() < p.aura.duty;
          s.odd ^= 1;
          s.k = s.on ? gate(s.L, p.flicker) : 1;
          s.next = rec.t + lerp(p.aura.restrike[0], p.aura.restrike[1], rnd()) * (LOOKB[rec.pi] ? LB.restrike : 1);
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

  /** The stats getter's one object (its look worked out once). */
  const STATS = {
    tier: tierName, auras: 0, shocks: 0, bursts: 0, links: 0, scorches: 0, casts: 0, segments: 0, strokes: 0, ground: 0, gates: 0,
    calls: 0, look: LOOK_NAME,
  };
  /** How many records of a pool are on. */
  function countOn(pool) {
    let n = 0;
    for (let i = 0; i < pool.length; i++) if (pool[i].on) n++;
    return n;
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
      for (let ri = 0; ri < casts.length; ri++) {
        const rec = casts[ri];
        if (rec.on) stepCast(rec, dt);
      }
      for (let ri = 0; ri < auras.length; ri++) {
        const rec = auras[ri];
        if (rec.on) stepAura(rec, dt);
      }
      for (let ri = 0; ri < bursts.length; ri++) {
        const rec = bursts[ri];
        if (rec.on) stepBurst(rec, dt);
      }
      for (let ri = 0; ri < links.length; ri++) {
        const rec = links[ri];
        if (rec.on) stepLink(rec, dt);
      }
      for (let ri = 0; ri < scorches.length; ri++) {
        const rec = scorches[ri];
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
    /**
     * Counts (lab, tests; not for a battle's per-frame path): one object, filled in place on every read (nothing
     * allocated), so read it, never keep it.
     */
    get stats() {
      STATS.auras = 0;
      STATS.shocks = 0;
      for (let ri = 0; ri < auras.length; ri++) {
        const r = auras[ri];
        if (!r.on) continue;
        if (r.kind === SHOCK) STATS.shocks++;
        else STATS.auras++;
      }
      STATS.tier = tierName;
      STATS.bursts = countOn(bursts);
      STATS.links = countOn(links);
      STATS.scorches = countOn(scorches);
      STATS.casts = countOn(casts);
      STATS.segments = sn;
      STATS.strokes = drawn;
      STATS.ground = geo.instanceCount;
      STATS.gates = gates;
      STATS.calls = (own && lines.mesh.visible ? 1 : 0) + (ground.visible ? 1 : 0);
      return STATS;
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
