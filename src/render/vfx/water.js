// Toon water splash (docs/VFX.md "Water splash", batch B1; display only, not wired into the battle yet: the lab is
// previews/water-splash.html). The tornado's house look (src/render/vfx/toonCore.js) turned into a short burst:
//
//   crown   an open wall rising from the impact; its lip has whole-number spikes wobbled by the noise and erodes first,
//           so the tongues part from it; it spreads, slumps and goes down from the top (a narrow centre jet follows it
//           on high and medium). A translucent, glowing body in wide flowing bands: the far wall's inside a shade
//           deeper, a light glow band up the middle of the near wall, a white crest under the lip; ink only on the
//           silhouette (the eroded edge, the lip, where the wall turns edge-on), and it leaves as the wall goes down
//   drops   pairs leave the spike tips as the crown breaks: two soft fields cut by one hard threshold (the clip), so a
//           pair is one blob while its drops are close and splits as the faster one pulls away; each drop stretches
//           along its flight, keeps an aqua body (never an ink-only speck), a white shine and a thin ink rim while it is
//           big enough on screen, erodes out over the last of its flight and is gone under a few pixels
//   ground  the foam ring (a translucent band of water carrying round white bubbles, painted into the noise's B channel:
//           a union of bubbles along its middle that part, shrink and pop as it ages; ink on its outer edge only, a
//           light glow band on its inner half, a faint wet glow inside it that dries out) with the impact disc at its
//           centre for the first moments, and ripples running out past it: light lines inked on their outer edge only,
//           whole while young, breaking into dashes as they run out
//
// Every shape is in or out (a hard step, no soft fringe, no discard) and coloured through a few flat bands. Blend: the
// glow cover (premultiplied One / OneMinusSrcAlpha): the colour is encoded for the target first, then the whole of it is
// added and each band hides its own share of the board (the bodies little: translucent, luminous water; the whites
// more; the ink all of it). On the canvas tiers the translucent bands add WATER_CANVAS_ADD of their colour, so every
// tier reads alike. On high with bloom the crest and the shine go a little over white (the glow the bloom catches); the
// impact disc's sparkle asks the flash guard first (flashGate) and is off with Flashes & shake off. High and medium draw
// the splash a quarter larger (WATER_TIERS scale) so it reads beside a chibi at 844×390.
//
//   const water = createWaterFx({ scene, camera, quality, reduceMotion, rand });
//   water.splash('fresh', x, z, { size: 1 });   // world x / z (the sim's x / y), size × the preset's tiles × the tier's scale
//   water.update(dt)                             // the visual clock's dt
//
// Draw cost: one instanced draw call per layer kind (crown, drops, ground: at most 3 while a splash is up, 0 when
// idle); the crown and the jet are written only during their own lives, and a ground quad hugs its ring as it is now
// (none outside its life). Every buffer is allocated once, for MAX_SPLASHES at the high tier, and update() writes numbers
// into it and uploads it whole (no update ranges: nothing allocated a frame). Reduce Motion: no crown, drops, jet or
// ripples; a still foam ring (its bubbles held) that fades by erosion, slower (TOON_REDUCE.life) and a touch lighter
// (WATER_REDUCE_ALPHA). Randomness: the stream it is handed (createVisualRandom fork), never Math.random.
//
// Credits (licence texts, with their authors, in public/licenses/): the drops' clip of two feathered fields into merging
// blobs follows the idea of the "Procedural Metaballic Splash" shader (MIT, metaballic-splash-MIT.txt; our own code, no
// shader copied); the foam ring's outlined band (a step on a distance band, its outline on the outside, wobbled by
// noise) follows a waterfall shader breakdown's foam (CC0, waterfall-foam-CC0-1.0.txt); the ripples' spaced rings
// running out with an exponential decay follow the stylized-components water ripples (MIT, stylized-components-MIT.txt),
// here cut by a rising threshold into dashes instead of fading. The round bubbles are our own lattice (the house hash).
import * as THREE from 'three';
import { WATER_PRESETS, WATER_TIERS, MAX_SPLASHES } from './waterPresets.js';
import {
  TOON_CORE, TOON_TIER, TOON_NOISE_N, TOON_RAMP_W, TOON_REDUCE, paintToonNoise, paintToonRamp, toonSparse, toonSmooth, toonHash,
} from './toonCore.js';

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
attribute vec4 cE; // kind (0 crown, 1 jet), noise along, 0, 0
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

/**
 * The water's band picks and its output (shared by the three fragment shaders): a ramp texel by its band number, a thin
 * ink line at least ~1.3 px wide on screen (a little wider in a close-up), and the premultiplied glow cover. The colour is
 * encoded for the target first and premultiplied after it (so a fade on the sRGB canvas darkens it, never lightens it);
 * then the whole colour is added and `cover` of the board behind is hidden: a translucent, glowing body where cover < 1,
 * an opaque toon band where cover = 1. Keep the include and the premultiply together (`waterOut`, below).
 */
const WATER_BANDS = /* glsl */`
uniform float uAdd; // [water] the glow's added share where it covers little: 1 into the linear target, less on the canvas
// [water] the ramp texel of band i (8 a row, NearestFilter: flat steps)
float wBand(float i) { return (i + 0.5) / 8.0; }
// [water] 1 on a thin rim inside a shape's edge (above = how far a pixel is inside it): at least px pixels on screen,
// and min of the shape's own units in a close-up
float wRim(float above, float px, float minW) { return step(above, max(minW, px * fwidth(above))); }
`;
/**
 * The fragment's last lines: encode `col`, then premultiply: colour × A × strength, alpha A × cover (see WATER_BANDS;
 * the strength is 1 where a band covers fully and uAdd's share where it covers little).
 */
const waterOut = (col, A, cover) => `gl_FragColor = vec4(${col}, 1.0);
  #include <colorspace_fragment>
  float wCover = ${cover};
  gl_FragColor = toonAdd(gl_FragColor.rgb, ${A}, mix(uAdd, 1.0, wCover), wCover);`;
/**
 * On the canvas (medium, low, high without bloom) the colour adds in display values, which lands far brighter than the
 * same add in the linear target (high with bloom): the translucent bands add this much there, so every tier reads alike.
 */
export const WATER_CANVAS_ADD = 0.4;

/** Ramp bands of the crown and the drops (fresh: 0, 1 ink, 2 deep teal, 3 teal, 4 aqua, 5 light aqua, 6 crest white, 7 the shine). */
export const WATER_BAND = Object.freeze({ ink: 0, deep: 3, body: 4, glow: 5, crest: 6, shine: 7 });
/** How much of the board each crown band hides (the rest shows through, the colour is added: luminous water). */
export const CROWN_COVER = Object.freeze({ deep: 0.42, body: 0.5, glow: 0.62, crest: 0.9, ink: 1 });

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
${WATER_BANDS}
void main() {
  float age = vAge;
  float u = atan(vDir.y, vDir.x) / 6.2831853 + vC.x; // the angle per pixel: no seam; whole-number scales wrap
  // the lip: the spike tips reach the top, the gaps between them dip (the jet has none)
  float s = abs(fract(u * vD.z) - 0.5) * 2.0;
  float lip = mix(1.0 - 0.36 * s * s, 1.0, vE.x);
  float vv = vV / lip;
  // solid up the wall and falling to 0 just under the lip line; a shallow noise (the house heat over 0.7 .. 1) and a
  // threshold climbing faster up the wall, so the wall stays whole while the lip erodes into tongues, then goes down
  // from the top (no cracks across its body)
  float v2 = vv * vv;
  float band = 1.0 - v2 * v2;
  float n = toonNoise(uNoise, vec2(u * 3.0, vV * vE.y - age * 0.8), age * 0.3);
  float heat = toonHeat(band, 0.4 + 0.3 * n);
  float cut = toonCut(vD.xy, age) + 0.5 * age * vv;
  float m = toonMask(heat, cut + uSparse) * step(0.0, band) * vOn;
  // ink on the silhouette only: a thin rim inside the eroded edge (the lip, the tongues) and where the wall turns
  // edge-on to the camera; never across the body. It leaves as the wall goes down (a low remnant is all edge: no
  // scribble of ink lines), and the receding edge turns crest white
  // (the narrow jet's top erodes into wiggles sooner: its ink leaves sooner)
  float inked = 1.0 - smoothstep(mix(0.5, 0.28, vE.x), mix(0.68, 0.42, vE.x), age);
  float ink = max(wRim(heat - cut, 1.3, 0.035), step(0.9, vRim)) * inked;
  float edge = wRim(heat - cut, 1.3, 0.035) * (1.0 - inked);
  // the body: wide flowing bands (their edges wobbled by a broad noise), a glow band up the middle of the near wall and
  // a white crest under the lip; the far wall's inside a shade deeper (seen through the near wall: layered water)
  float front = gl_FrontFacing ? vFront : 0.0;
  float n2 = toonNoise(uNoise, vec2(u * 2.0, vV * 0.5 - age * 0.5), 0.0);
  float y = vv + 0.22 * (n2 - 0.5);
  float glow = step(abs(y - 0.48), 0.2) * step(0.3, front);
  float crest = max(step(0.76, y), edge);
  float b = mix(${WATER_BAND.deep.toFixed(1)}, ${WATER_BAND.body.toFixed(1)}, step(0.45, front));
  float cover = mix(${CROWN_COVER.deep}, ${CROWN_COVER.body}, step(0.45, front));
  b = mix(b, ${WATER_BAND.glow.toFixed(1)}, glow);
  cover = mix(cover, ${CROWN_COVER.glow}, glow);
  b = mix(b, ${WATER_BAND.crest.toFixed(1)}, crest);
  cover = mix(cover, ${CROWN_COVER.crest}, crest);
  b = mix(b, ${WATER_BAND.ink.toFixed(1)}, ink);
  cover = mix(cover, ${CROWN_COVER.ink.toFixed(1)}, ink);
  vec3 col = toonRamp(uRamp, wBand(b), vC.y);
  // on high with bloom the crest goes a little over white: the glow along the lip the bloom catches
  col *= 1.0 + vC.w * crest * (1.0 - ink);
  float A = m * smoothstep(0.0, 0.04, age) * (1.0 - smoothstep(0.76, 1.0, age)) * vC.z;
  ${waterOut('col', 'A', 'cover')}
}`;

const DROPS_VERT = /* glsl */`
attribute vec4 dA; // drop A: world x, y, z, radius
attribute vec4 dB; // drop B: world x, y, z, radius
attribute vec4 dC; // flight direction (world, normalised), stretch along it
attribute vec4 dD; // age (0..1 of the pair's flight), ramp row, alpha, hdr
attribute vec4 dE; // erode young, erode old, 0, 0
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

/** Drops: how much of the board the body hides (they are small: nearly solid), and when they are gone (px on screen). */
export const DROP_COVER = 0.9;
/** A drop whose eroded radius is under this many pixels is gone (no specks); under DROP_INK_PX it has no ink rim. */
export const DROP_MIN_PX = 1.3;
export const DROP_INK_PX = 3.2;

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
${WATER_BANDS}
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
  // the clip: both fields summed and cut by one hard threshold, so close drops are one blob and part as they separate;
  // over the last of the flight the threshold climbs faster (they erode out before they are specks)
  float F = wBlob(vQ, vPA, vR.x, vFly, vR.z) + wBlob(vQ, vPB, vR.y, vFly, vR.z);
  float cut = toonCut(vE.xy, vR.w) + 0.5 * smoothstep(0.5, 1.0, vR.w);
  float m = toonMask(F, cut + uSparse);
  // a drop's eroded radius on screen (F > c inside d < r * sqrt(1 - sqrt(c))): too small, it is gone; small, no ink
  float wpp = max(fwidth(vQ.x), 1e-6);
  float shrink = sqrt(max(0.0, 1.0 - sqrt(clamp(cut + uSparse, 0.0, 0.999))));
  float rA = vR.x * shrink;
  float rB = vR.y * shrink;
  float px = max(rA, rB) / wpp;
  m *= step(${DROP_MIN_PX.toFixed(2)}, px);
  float above = F - cut;
  float ink = wRim(above, 1.1, 0.0) * step(${DROP_INK_PX.toFixed(2)}, px);
  // the body never goes below aqua (no ink-only dark specks), its middle a lighter band; each drop has a white shine up
  // and to its left, at least a pixel wide
  vec2 off = vec2(-0.34, 0.36);
  float sA = step(length(vQ - vPA - off * rA), max(rA * 0.36, wpp * 0.75));
  float sB = step(length(vQ - vPB - off * rB), max(rB * 0.36, wpp * 0.75));
  float shine = max(sA, sB) * (1.0 - ink);
  float b = mix(${WATER_BAND.body.toFixed(1)}, ${WATER_BAND.glow.toFixed(1)}, step(0.32, above));
  b = mix(b, ${WATER_BAND.ink.toFixed(1)}, ink);
  b = mix(b, ${WATER_BAND.shine.toFixed(1)}, shine);
  vec3 col = toonRamp(uRamp, wBand(b), vD.y);
  // the shine goes a little over white on high with bloom: a sparkle, never the body
  col *= 1.0 + vD.w * shine;
  ${waterOut('col', 'm * vD.z', `mix(${DROP_COVER}, 1.0, max(ink, shine))`)}
}`;

/** Ground bands (the foam ramp: 0, 1 ink, 2 teal, 3 aqua, 4 light aqua, 5 / 6 foam white, 7 the impact's core). */
export const FOAM_BAND = Object.freeze({ ink: 0, rim: 2, body: 2, glow: 3, bubble: 5, core: 7 });
/** How much of the board the foam hides: the body is translucent water (the colour added), the bubbles nearly solid. */
export const FOAM_COVER = Object.freeze({ body: 0.5, glow: 0.58, bubble: 0.92, ink: 1 });
/** The wet glow inside the foam ring: its strength (A) and the share of the board it hides (a faint added light). */
export const FOAM_POOL = Object.freeze({ alpha: 0.38, cover: 0.3 });
/** Bubbles round the foam ring (whole: the painted tile wraps) and the painted lattice (cells a side of the tile). */
export const FOAM_AROUND = 2;
export const FOAM_BUBBLE_CELLS = 6;
/**
 * The foam's ink leaves at this share of its age (± wobble / 2 by the noise, a hard step: in patches): before the
 * eroding band breaks into slivers thinner than its ink rim, which would be drawn all ink (dark dashes).
 */
export const FOAM_INK_AGE = Object.freeze({ end: 0.66, wobble: 0.12 });
/** A bubble whose radius is under this many pixels is gone (no stipple); under FOAM_RIM_PX it has no rim. */
export const FOAM_MIN_PX = 2;
export const FOAM_RIM_PX = 3.5;

// the ring's radius now (the foam spreads, fast then slow, held at half under Reduce Motion; a ripple runs out on an
// exponential): the vertex shader sizes the quad to it, the fragment draws it
const RING_R = /* glsl */`
float wRingR(vec4 b, float age, float still) {
  return b.x < 0.5 ? mix(b.y, b.z, mix(1.0 - pow(1.0 - age, 2.2), 0.5, still)) : mix(b.y, b.z, 1.0 - exp(-2.2 * age));
}`;

const GROUND_VERT = /* glsl */`
attribute vec4 gA; // x, z, t (s since the splash), life (s)
attribute vec4 gB; // mode (0 foam ring, 1 ripple), r0, r1, width
attribute vec4 gC; // seed, ramp row, alpha, the impact disc's over-white (high with bloom, through the flash guard)
attribute vec4 gD; // erode young, erode old, delay (s), still (1 under Reduce Motion)
attribute vec4 gE; // decay (ripples), 0, 0, the foam's outer edge now (ripples: drawn only out past it)
varying vec2 vP;
varying vec4 vA;
varying vec4 vB;
varying vec4 vC;
varying vec4 vD;
varying vec4 vE;
${RING_R}
void main() {
  // the quad hugs the ring as it is now (its band and the bubbles spilling past it), and is empty outside its life:
  // no fragments for the ground it has not reached yet
  float t = gA.z - gD.z;
  float age = clamp(t / gA.w, 0.0, 1.0);
  float on = step(0.0, t) * step(t, gA.w);
  float ext = (wRingR(gB, age, gD.w) + gB.w * 1.5) * on;
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
${WATER_BANDS}
${RING_R}
void main() {
  float t = vA.z - vD.z;
  float age = clamp(t / vA.w, 0.0, 1.0);
  float on = step(0.0, t) * step(t, vA.w);
  float still = vD.w;
  float move = 1.0 - still;
  float r = length(vP);
  float u = atan(vP.y, vP.x) / 6.2831853 + vC.x;
  float R = wRingR(vB, age, still);
  float m;
  float b;
  float cover;
  float aMul = 1.0;
  float sparkle = 0.0;
  if (vB.x < 0.5) {
    // the foam ring: a translucent band of water (it spreads, held still under Reduce Motion, and thins) carrying round
    // white bubbles that ride it; the band erodes from its edges first, the bubbles shrink and pop last
    float x = (r - R) / (vB.w * mix(1.0, 0.8, age) * mix(1.0, 0.75, still));
    float band = 1.0 - x * x;
    float n = toonNoise(uNoise, vec2(u * 4.0, r * 1.25 - age * 0.3 * move), 0.0);
    float heat = toonHeat(band, 0.45 + 0.3 * n);
    float cut = toonCut(vD.xy, pow(age, 0.9));
    float body = toonMask(heat, cut) * step(0.0, band);
    // the white foam: the union of round bubbles (a painted lattice of cones in B, laid round the ring so they stay
    // round whatever its radius), thickest along the ring's middle, so its edge is scalloped; as the threshold climbs
    // they part into single bubbles that shrink and pop, after the water under them has gone
    vec2 uv = vec2(u * ${FOAM_AROUND.toFixed(1)}, (r - R) * ${FOAM_AROUND.toFixed(1)} / (6.2831853 * max(R, 0.05)) + vC.x);
    float cells = toonCells(uNoise, toonSwirl(uNoise, uv, 0.015 * move));
    float bh = cells * clamp(band + 0.15, 0.0, 1.0);
    float bc = mix(0.1, 0.92, pow(age, 1.5));
    float bub = step(bc, bh);
    // a bubble's radius on screen (the cone falls 1 a radius): too small, it is gone; small, no rim
    float px = (1.0 - bc) / max(fwidth(bh), 1e-5);
    bub *= step(${FOAM_MIN_PX.toFixed(2)}, px);
    // ink on the band's outer silhouette only; the inner half is the ring's light glow band (its edge wobbled: it flows).
    // The ink leaves before the band breaks into slivers thinner than the rim (a sliver would be all ink: dark dashes):
    // a hard step on the age, wobbled by the noise, so the rim goes in patches and the eroding slivers end teal
    float inked = step(age + ${FOAM_INK_AGE.wobble.toFixed(2)} * (n - 0.5), ${FOAM_INK_AGE.end.toFixed(2)});
    float ink = wRim(heat - cut, 1.3, 0.03) * step(0.0, x) * body * (1.0 - bub) * inked;
    float glow = step(x + 0.35 * (n - 0.5), -0.1);
    // a bubble out on its own (the band gone round it) keeps a thin teal rim, never ink, and only when it is big
    float rim = wRim(bh - bc, 1.1, 0.025) * (1.0 - body) * step(${FOAM_RIM_PX.toFixed(2)}, px) * bub;
    b = mix(${FOAM_BAND.body.toFixed(1)}, ${FOAM_BAND.glow.toFixed(1)}, glow);
    cover = mix(${FOAM_COVER.body}, ${FOAM_COVER.glow}, glow);
    b = mix(b, ${FOAM_BAND.bubble.toFixed(1)}, bub);
    cover = mix(cover, ${FOAM_COVER.bubble}, bub);
    b = mix(b, ${FOAM_BAND.rim.toFixed(1)}, rim);
    b = mix(b, ${FOAM_BAND.ink.toFixed(1)}, ink);
    cover = mix(cover, ${FOAM_COVER.ink.toFixed(1)}, ink);
    // the impact: a filled disc in the middle for the first moments, its core white (none under Reduce Motion)
    float plop = move * (1.0 - smoothstep(0.0, 0.13, age)) * max(0.0, 1.0 - r / (vB.y * 1.15));
    float disc = step(0.05, plop * (1.1 + 0.4 * n));
    float core = step(0.55, plop);
    b = mix(b, ${FOAM_BAND.bubble.toFixed(1)}, disc * (1.0 - core));
    b = mix(b, ${FOAM_BAND.core.toFixed(1)}, core);
    cover = mix(cover, 1.0, disc);
    // the wet glow inside the ring: one faint flat step of light water on the ground (the tornado's glow pool, here
    // with a hard edge), eroding away by the noise as the ring ages
    // (its own noise on the ground's plane: the ring's polar noise would erode it into spokes)
    float np = toonNoise(uNoise, vP * 0.9 + vec2(vC.x, 0.37), 0.0);
    float pool = step(r, R - 0.55 * vB.w) * step(pow(age, 1.1) + 0.45 * np, 0.72) * (1.0 - max(max(body, bub), disc));
    b = mix(b, ${FOAM_BAND.glow.toFixed(1)}, pool);
    cover = mix(cover, ${FOAM_POOL.cover}, pool);
    aMul = mix(1.0, ${FOAM_POOL.alpha}, pool);
    m = max(max(max(body, bub), disc), pool);
    sparkle = core;
  } else {
    // a ripple: a thin light line running out, fast then slow, breaking into dashes as its threshold climbs; inked on
    // its outer edge only, translucent inside
    float x = (r - R) / (vB.w * mix(1.0, 0.7, age));
    float band = 1.0 - x * x;
    float n = toonNoise(uNoise, vec2(u * 9.0, age * 0.45 + vC.x), 0.0);
    float heat = toonHeat(band, n);
    // (the exponential decay of a ring, cut instead of faded: whole while young, dashes as it runs out)
    float cut = mix(vD.x, vD.y, pow(1.0 - exp(-vE.x * age), 1.8));
    // (only out past the foam's outer edge, vE.w: the translucent foam would show a ripple under it)
    m = toonMask(heat, cut) * step(0.0, band) * step(vE.w, r);
    float ink = wRim(heat - cut, 1.1, 0.06) * step(0.0, x);
    b = mix(${FOAM_BAND.glow.toFixed(1)}, ${FOAM_BAND.bubble.toFixed(1)}, step(0.35, heat - cut));
    cover = mix(0.6, 1.0, ink);
    b = mix(b, ${FOAM_BAND.ink.toFixed(1)}, ink);
  }
  vec3 col = toonRamp(uRamp, wBand(b), vC.y);
  // the impact core's sparkle (high with bloom, through the flash guard; off with Flashes & shake off)
  col *= 1.0 + vC.w * sparkle;
  float A = m * aMul * on * smoothstep(0.0, 0.02, age) * (1.0 - smoothstep(0.82, 1.0, age)) * vC.z;
  ${waterOut('col', 'A', 'cover')}
}`;

/**
 * The foam's round bubbles, painted once into the noise texture's B channel (bytes, n × n, tileable): one bubble a cell
 * of a `cells` × `cells` periodic lattice, its centre jittered inside the cell and its radius varied; a cone, 1 at a
 * bubble's centre and 0 at its radius (the largest over the 3 × 3 cells round a texel). Cut by a rising threshold each
 * bubble is a round disc that shrinks and is gone. Our own lattice (the house hash), seeded.
 */
export function paintFoamBubbles(data, n = TOON_NOISE_N, cells = FOAM_BUBBLE_CELLS, seed = 31) {
  const wrap = (i) => ((i % cells) + cells) % cells;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const px = ((x + 0.5) / n) * cells;
      const py = ((y + 0.5) / n) * cells;
      const ix = Math.floor(px);
      const iy = Math.floor(py);
      let best = 0;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const cx = wrap(ix + i);
          const cy = wrap(iy + j);
          const fx = ix + i + 0.25 + 0.5 * toonHash(cx, cy, seed);
          const fy = iy + j + 0.25 + 0.5 * toonHash(cx, cy, seed + 1);
          const rad = 0.44 + 0.2 * toonHash(cx, cy, seed + 2);
          const v = 1 - Math.hypot(px - fx, py - fy) / rad;
          if (v > best) best = v;
        }
      }
      data[(y * n + x) * 4 + 2] = Math.round(Math.max(0, Math.min(1, best)) * 255);
    }
  }
  return data;
}

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
  // (R, G the house noise, A the swirl; B the foam's round bubbles, painted here: no Worley cells)
  const noise = new THREE.DataTexture(paintFoamBubbles(paintToonNoise(TOON_NOISE_N, 13, { swirl: true })), TOON_NOISE_N, TOON_NOISE_N, THREE.RGBAFormat);
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
      uniforms: { uRamp: { value: ramp }, uSparse: { value: 0 }, uCover: { value: 1 }, uAdd: { value: WATER_CANVAS_ADD }, ...uniforms },
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
    // (high and medium draw it larger, so it reads beside a chibi at battle scale; low keeps its fill)
    rec.size = Math.max(0.3, size) * (tier.scale ?? 1);
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
      E[j] = 0; E[j + 1] = c.noise; E[j + 2] = 0; E[j + 3] = 0;
    } else {
      const c = p.jet;
      A[j] = rec.x; A[j + 1] = rec.z; A[j + 2] = rec.t; A[j + 3] = c.life;
      B[j] = c.r * s; B[j + 1] = c.r * s * 1.25; B[j + 2] = c.height * s; B[j + 3] = -0.45;
      C[j] = rec.seed + 0.37; C[j + 1] = rec.rowC; C[j + 2] = p.alpha; C[j + 3] = hdr;
      D[j] = c.erode[0]; D[j + 1] = c.erode[1]; D[j + 2] = 1; D[j + 3] = c.delay;
      E[j] = 1; E[j + 1] = 1.6; E[j + 2] = 0; E[j + 3] = 0;
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
    DE[j] = d.erode[0]; DE[j + 1] = d.erode[1]; DE[j + 2] = 0; DE[j + 3] = 0;
    return true;
  }

  /** The foam ring's outer edge now (JS mirror of the ground shader's ring: its radius plus most of its half-width). */
  function foamOuter(rec) {
    const f = rec.p.foamRing;
    const s = rec.size;
    const age = Math.min(1, Math.max(0, rec.t / (f.life * (rm ? TOON_REDUCE.life : 1))));
    const R = lerp(f.r0, f.r1, 1 - Math.pow(1 - age, 2.2)) * s;
    return R + f.width * s * lerp(1, 0.8, age) * 0.85;
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
      E[j] = 0; E[j + 1] = 0; E[j + 2] = 0; E[j + 3] = 0;
    } else {
      const f = p.ripple;
      A[j] = rec.x; A[j + 1] = rec.z; A[j + 2] = rec.t; A[j + 3] = f.life;
      B[j] = 1; B[j + 1] = f.r0 * s * (1 + 0.12 * ring); B[j + 2] = f.r1 * s * (1 - 0.1 * ring); B[j + 3] = f.width * s;
      C[j] = rec.seed + 0.21 * (ring + 1); C[j + 1] = rec.rowG; C[j + 2] = p.alpha; C[j + 3] = 0;
      D[j] = f.erode[0]; D[j + 1] = f.erode[1]; D[j + 2] = p.crown.life * 0.3 + f.spacing * ring; D[j + 3] = 0;
      E[j] = f.decay; E[j + 1] = 0; E[j + 2] = 0; E[j + 3] = foamOuter(rec);
    }
  }

  function upload(L) {
    L.geo.instanceCount = L.n;
    // whole-buffer uploads, no update ranges: the buffers are small (a few KB in all) and a range is a new object a frame
    if (L.n) for (const a of L.list) a.needsUpdate = true;
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
          // the crown and the jet only during their own lives (no empty wall rasterised for the ripple tail)
          const p = rec.p;
          if (rec.t < p.crown.life) writeCrown(rec, crown.n++, 0);
          if (tier.jet && rec.t >= p.jet.delay && rec.t < p.jet.delay + p.jet.life) writeCrown(rec, crown.n++, 1);
          for (let k = 0; k < tier.pairs; k++) if (writePair(rec, k, drops.n)) drops.n++;
        }
        // the ripples first, so the foam ring (drawn after them in the same call) sits over them
        if (!rm) for (let r = 0; r < tier.ripples; r++) writeGround(rec, ground.n++, 1, r);
        writeGround(rec, ground.n++, 0, 0);
      }
      // high has more drops than medium, each clipped a little smaller (the mask only)
      drops.mesh.material.uniforms.uSparse.value = toonSparse(tier.pairs, WATER_TIERS.medium.pairs, DROP_SPARSE);
      // the linear target (high with bloom) takes the whole add; the canvas a share of it
      for (const L of layers) L.mesh.material.uniforms.uAdd.value = bloom ? 1 : WATER_CANVAS_ADD;
      for (const L of layers) upload(L);
    },
    /** The graphics tier (new splashes take its size; the ones up keep theirs and take its ripple tail). */
    setQuality(q) {
      tier = WATER_TIERS[q] || WATER_TIERS.medium;
      tierName = WATER_TIERS[q] ? q : 'medium';
      for (const rec of pool) if (rec.on) rec.seconds = splashSeconds(rec.p, tier, rm);
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
    /** Settings → Flashes & shake (off: no impact sparkle, on the splashes already up too). */
    setFlashes(on) {
      flashOn = !!on;
      if (!flashOn) for (const rec of pool) rec.plopK = 0;
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
