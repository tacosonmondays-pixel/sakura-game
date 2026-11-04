// Light ribbons (docs/VFX.md "Light ribbons (look C)"; display only, opt-in: nothing uses it unless its look asks). A
// polyline (a bolt's path, a beam's) drawn the tornado's way: 2–4 translucent ribbons twist round a bright core (the
// prism: one ribbon a colour, braided), each with its own stepped toon bands from a deep hue at its edge to light in its
// middle. Their light adds where they overlap: per pixel the ribbons behind the core are laid first, then the core,
// then the ribbons in front, each premultiplied over the last. The near side of a twist burns brighter than the far side
// (the tornado's front arc), the house noise flows along the path, its ends are worn ragged by the noise, and its erosion
// threshold rises from its start on to its end. No ink inside: at most a thin outer silhouette rim, worked out from where
// the bundle's colour actually ends (never round a gap between ribbons or an erosion hole), drawn under every ribbon of
// every path (all of a frame's rims come first in the same draw call: a union outline), and only while the piece is
// whole (the caller's rim strength leaves before it erodes). An optional stepped glow on the ground under the path (the
// halo). Built on the shared toon core (src/render/vfx/toonCore.js): its noise, heat, cut, mask and index chunks.
//
//   const ribbons = createLightRibbons({ scene, ramps: [['#…', …], …] });  // one ramp row each, deep → white
//   const S = ribbonStyle();             // a scratch style: fill it, path() copies it in
//   ribbons.begin();                     // once a frame
//   ribbons.path(P, n, S);               // P: n joints (x, y, z, world); false when it does not fit (nothing drawn)
//   ribbons.end();                       // uploads what was pushed, shows or hides the meshes
//
// Draw cost: one instanced call for every ribbon of every path (rims and colours in one call, the rims first), one more
// for the halos (drawn with the ground pieces), none while nothing is pushed. Every buffer is allocated once; path()
// writes numbers into them and end() uploads them whole (no update ranges: nothing allocated a frame).
// Randomness: none of its own (a path's seed is the caller's, from its seeded stream). Time: none of its own (the
// caller's flow and spin; Reduce Motion holds them still). Flash safety: nothing here flashes; a path's strength, its
// core's and its over-white are the caller's (asked of the flash guard), and over-white only on high with bloom while
// Flashes & shake is on.
import * as THREE from 'three';
import { TOON_CORE, TOON_NOISE_N, TOON_RAMP_W, paintToonNoise, paintToonRamp } from './toonCore.js';

/** Most ribbons a path twists round its core (the prism's five colours; a single-colour bundle draws 2–4). */
export const MAX_RIBBONS = 5;
/** Most joints a path holds (2^3 halvings + 1, or a beam's kinks + 1). */
export const MAX_RIBBON_JOINTS = 12;
/**
 * By graphics tier: ribbons round a single-colour core, the prism's ribbons, the halo, the rim, over-white (high with
 * bloom only). Low: the callers draw their look A instead (the light ribbons' loops cost more than a stroke).
 */
export const LIGHT_RIBBON_TIERS = Object.freeze({
  high: Object.freeze({ ribbons: 4, prism: 5, halo: true, rim: true, hdr: true }),
  medium: Object.freeze({ ribbons: 3, prism: 5, halo: true, rim: true, hdr: false }),
  low: Object.freeze({ ribbons: 2, prism: 3, halo: false, rim: false, hdr: false, fallback: 'a' }),
});
/** How far heat above the cut walks along the ramp (the toon core's slope). */
export const RIBBON_SLOPE = 1.6;
/** The erosion threshold while whole (the noise only ripples the edges) and once gone (past every heat, the core's too). */
export const RIBBON_YOUNG = 0.06;
export const RIBBON_OLD = 2.2;
/**
 * How much of the board each band hides, by its index k on the tornado's 8-texel layout: deep (k < 0.25), body (< 0.5),
 * light (< 0.625), core (< 0.875), white. The colour itself is added (the glow cover): translucent bands, the white pure
 * light. Less than look B's solid bands (1) or the B3 beam's sheath (0.74–0.86): the board shows through every ribbon,
 * and where two ribbons cross they add up (a single thin ribbon has to hold its colour on a bright board by itself:
 * the tornado's rings stack 2–5 deep, a bundle's mostly 1–2).
 */
export const RIBBON_COVER = Object.freeze([0.6, 0.46, 0.3, 0.14, 0]);
/** The canvas tiers add this share of a band's colour where it covers little. */
export const RIBBON_CANVAS_ADD = 0.72;
/**
 * High with bloom draws into the linear target, where added light would sum past white into a soft bloom blob: there
 * every band covers the board in its own colour instead (the tornado's high), this strength × the layer's, so stacked
 * ribbons settle on the ramp's colours; each band × RIBBON_BLOOM_GAIN in display bytes (its own ramp row, the overshoot
 * the canvas gets for free, as the tornado's COVER_GAIN), coolest → hottest.
 */
export const RIBBON_COVER_K = 0.72;
export const RIBBON_BLOOM_GAIN = Object.freeze([1, 1.1, 1.25, 1.55, 1.75]);
/**
 * A ribbon's heat × this (band × (0.3 + n) × RIBBON_HEAT): at phone scale a ribbon is a few pixels wide, and the
 * tornado's full heat would put nearly all of it in its white band; scaled, its outer half is its deep band and its
 * middle the body band (light at the noise's peaks), so each ribbon reads as its own stroke where it crosses the others;
 * the core along the axis carries the light, core and white bands.
 */
export const RIBBON_HEAT = 0.5;
/** The rim: its width (CSS px), the shade of the deep band it is drawn in, and how much of the board it hides. */
export const RIBBON_RIM = Object.freeze({ px: 1.3, shade: 0.78, cover: 0.62 });
/** The core's thinnest half width (CSS px) and the ribbons' (each a share of the bundle; they pinch to it at the sides). */
export const RIBBON_MIN_PX = Object.freeze({ core: 0.7, ribbon: 0.9 });
/**
 * How far outside her face's box nothing is drawn either (CSS px): a pixel whose centre is just outside the box still
 * covers its edge, and at phone scale the box's margin is about a pixel.
 */
export const RIBBON_FACE_PX = 1.5;
/**
 * The halo on the ground: its threshold while whole, how far up the path its glow reaches (tiles; under higher parts it
 * fades out), how much of the ground it hides and adds, and the band range its index walks (`low` at its rim, the body
 * band, to `top` in its middle, the light band: a coloured glow on the ground, never a dark smudge, never a white light).
 */
export const RIBBON_HALO = Object.freeze({ young: 0.1, fall: 1.4, cover: 0.1, add: 0.62, low: 0.26, top: 0.62 });
/** The halo's height (over the road ribbon and the ground pieces' rings, under the water's). */
export const RIBBON_HALO_Y = 0.066;

// ------------------------------------------------------------------------------------------------ JS mirrors (tests)

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** A ribbon's phase at u (shader mirror): it twists along the path (twist turns a tile) and turns with spin. */
export function ribbonPhase(u, i, n, twist, spin, seed) {
  return Math.PI * 2 * (u * twist + i / Math.max(n, 1) + spin) + seed * 7;
}
/**
 * Ribbon i at its phase (shader mirror): its centre across the bundle (half widths), its half width, and how much it
 * faces the camera (cos of the phase: > 0 in front of the core). It swings `reach` round the axis and is widest where it
 * crosses the middle (face-on), thinnest at the sides (edge-on): a twisted ribbon seen from the side.
 */
export function ribbonGeometry(ph, reach, width, shape = 1) {
  const d = Math.cos(ph);
  return { c: reach * Math.sin(ph) * shape, w: width * (0.35 + 0.65 * Math.abs(d)) * shape, d };
}
/** Where a ribbon's colour ends (share of its half width): where its heat (band × (0.3 + n)) meets the cut. */
export function ribbonEdge(cut, n) {
  return Math.sqrt(Math.max(0, 1 - cut / (0.3 + n)));
}
/** The erosion's progress at share f of the path from its start (shader mirror): 0 whole … 1 gone, the start first. */
export function ribbonErosion(erode, lag, f) {
  return clamp(erode * (1 + lag) - lag * f, 0, 1);
}
/** The erosion threshold at share f of the path from its start (shader mirror): young → gone, the start first. */
export function ribbonCut(erode, lag, f, young = RIBBON_YOUNG) {
  return young + (RIBBON_OLD - young) * ribbonErosion(erode, lag, f);
}
/** The core's heat lift at share f (shader mirror): it goes with the erosion, so the core never outlives its ribbons. */
export function ribbonCoreLift(coreHeat, erode, lag, f) {
  return coreHeat * (1 - ribbonErosion(erode, lag, f));
}
/**
 * One pixel of a bundle (shader mirror, for the tests): at y across (in the bundle's half widths) with each ribbon's
 * noise in nz[i] and the core's in nc, is any colour drawn, and is the rim? The rim is the band just outside the
 * bundle's outer edges (the topmost and bottommost places where a ribbon's or the core's colour ends), so it can never
 * be inside a colour, nor round a gap between ribbons.
 * o: { y, u, n (ribbons), twist, spin, seed, reach, width, core (share), coreHeat, cut, shape, rimW (half widths) }
 */
export function ribbonPixel(o, nz, nc) {
  let top = -1e3;
  let bot = 1e3;
  let colour = false;
  for (let i = 0; i < o.n; i++) {
    const g = ribbonGeometry(ribbonPhase(o.u, i, o.n, o.twist, o.spin, o.seed), o.reach, o.width, o.shape);
    if (g.w < 1e-4) continue;
    const x = (o.y - g.c) / g.w;
    const band = 1 - x * x;
    const heat = band * (0.3 + nz[i]) * RIBBON_HEAT;
    if (band >= 0 && heat >= o.cut) colour = true;
    const xo = ribbonEdge(o.cut / RIBBON_HEAT, nz[i]);
    if (xo > 0) {
      top = Math.max(top, g.c + g.w * xo);
      bot = Math.min(bot, g.c - g.w * xo);
    }
  }
  const cw = o.core * o.shape;
  if (cw > 1e-4) {
    const x = o.y / cw;
    const band = 1 - x * x;
    if (band >= 0 && band * (0.3 + nc) + o.coreHeat >= o.cut) colour = true;
    const xo = Math.sqrt(Math.max(0, 1 - Math.max(o.cut - o.coreHeat, 0) / (0.3 + nc)));
    if (xo > 0) {
      top = Math.max(top, cw * xo);
      bot = Math.min(bot, -cw * xo);
    }
  }
  const e = Math.min(top - o.y, o.y - bot);
  const rim = bot <= top && e < 0 && e >= -o.rimW;
  return { colour, rim, e };
}

// ------------------------------------------------------------------------------------------------ shaders

const f3 = (v) => v.toFixed(3);

/** The shared ribbon chunk: the ramp lookup, the band cover, a premultiplied layer, "over", a ribbon's colour edge. */
export const LIGHT_RIBBON_GLSL = /* glsl */`
uniform sampler2D uNoise;
uniform sampler2D uRamp;
uniform float uRows;    // ramp rows (each preset's row, then its row × the bloom gains)
uniform float uGainRow; // 0 on the canvas; into the linear target (bloom) the gain rows: uRows / 2
uniform float uAdd;     // a band's added share where it covers little (the canvas)
uniform float uCoverMode; // 1 into the linear target (high with bloom): every band covers in its own colour
${TOON_CORE}
// [light ribbon] ramp row r's texel at index k (8 a row, NearestFilter: flat steps)
vec3 lrRamp(float k, float r) { return toonRamp(uRamp, k, (r + uGainRow + 0.5) / uRows); }
// [light ribbon] how much of the board a band hides (index k on the tornado's 8-texel layout): translucent, the white none
float lrCover(float k) {
  float c = ${f3(RIBBON_COVER[0])};
  c = mix(c, ${f3(RIBBON_COVER[1])}, step(0.25, k));
  c = mix(c, ${f3(RIBBON_COVER[2])}, step(0.5, k));
  c = mix(c, ${f3(RIBBON_COVER[3])}, step(0.625, k));
  c = mix(c, ${f3(RIBBON_COVER[4])}, step(0.875, k));
  return c;
}
// [light ribbon] one band layer, premultiplied (the colour encoded for the target first): on the canvas its light added
// and \`cover\` of the board hidden; into the linear target (bloom) it covers the board in its own colour
vec4 lrLayer(vec3 col, float A, float cover) {
  vec3 e = linearToOutputTexel(vec4(col, 1.0)).rgb;
  vec4 add = vec4(e * A * mix(uAdd, 1.0, cover), A * cover);
  float c = A * ${f3(RIBBON_COVER_K)};
  return mix(add, vec4(e * c, c), uCoverMode);
}
// [light ribbon] premultiplied over: L laid on acc
vec4 lrOver(vec4 L, vec4 acc) { return L + acc * (1.0 - L.a); }
// [light ribbon] where a ribbon's colour ends (share of its half width): its heat band x (0.3 + n) meets the cut
float lrEdge(float cut, float n) { return sqrt(max(0.0, 1.0 - cut / (0.3 + n))); }
`;

const VERT = /* glsl */`
attribute vec4 lA; // a: x, y, z, u at a (tiles along the path)
attribute vec4 lB; // b: x, y, z, u at b
attribute vec4 lC; // the joint before a: x, y, z (a itself on the first segment); the bundle's half width (world)
attribute vec4 lD; // the joint after b: x, y, z (b itself on the last segment); the path's length
attribute vec4 lE; // head (u: nothing past it), tail (u: nothing before it), erosion (0 whole .. 1 gone), its lag along
attribute vec4 lF; // ramp row (the core's), flow (the noise's offset along, tiles), seed, strength
attribute vec4 lG; // ribbons, twist (turns a tile), spin (turns), the core's half width (share of the bundle's; 0 none)
attribute vec4 lH; // over-white, rim strength (0 none), its ends (0 round .. 1 pointed), mode (0 colour, 1 rim)
attribute vec4 lI; // her face: x, y, z, its box's half width (0: no face)
attribute vec4 lJ; // her face box's half height, the ribbons' row step (the prism: a row each), core heat, noise along
attribute vec4 lK; // width share at the end, the core's strength, the ribbons' reach, each ribbon's half width (shares)
attribute vec4 lM; // the rim only from u = x to u = y (tiles: none near a muzzle, none under a crown), -, -
uniform float uPx;    // world units per CSS px
uniform float uRimPx; // the rim's width (CSS px)
varying vec2 vUV;     // along (u, tiles), across (-1 .. 1 over the strip)
varying float vSW;    // the strip's half width here (world)
varying float vBW;    // the bundle's half width here (world)
varying float vL;
varying vec4 vE;
varying vec4 vF;
varying vec4 vG;
varying vec4 vH;
varying vec4 vJ;
varying vec4 vK;
varying vec2 vM;
varying vec4 vFace;   // the pixel's offset from her face (view plane), its box's half width, half height
void main() {
  vec4 a = modelViewMatrix * vec4(lA.xyz, 1.0);
  vec4 b = modelViewMatrix * vec4(lB.xyz, 1.0);
  vec4 p = modelViewMatrix * vec4(lC.xyz, 1.0);
  vec4 q = modelViewMatrix * vec4(lD.xyz, 1.0);
  float s = position.x;    // 0 at a, 1 at b
  float side = position.y; // -1 .. 1 across
  vec2 d = b.xy - a.xy;
  float len = length(d);
  vec2 dir = len > 1e-6 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  // the joint's mitre: the bisector of this segment's normal and its neighbour's (no gap and no overlap at a kink; both
  // segments of a joint work out the same corners from the same three joints)
  vec2 o = s < 0.5 ? a.xy - p.xy : q.xy - b.xy;
  float ol = length(o);
  vec2 od = ol > 1e-6 ? o / ol : dir;
  vec2 mm = nrm + vec2(-od.y, od.x);
  vec2 mitre = dot(mm, mm) > 1e-6 ? normalize(mm) : nrm;
  float ch = max(dot(mitre, nrm), 0.25);
  float th = sqrt(max(1.0 / (ch * ch) - 1.0, 0.0));
  // the strip: the bundle and room for its rim, narrowed at a sharp kink so its inner edge never folds back past a
  // neighbour's (the ribbons pinch there, a kink in the bolt)
  float sw = lC.w + (uRimPx + 1.5) * uPx;
  float shortest = ol > 1e-6 ? min(len, ol) : len;
  float k = th > 1e-3 ? min(1.0, 0.9 * shortest / max(sw * th, 1e-6)) : 1.0;
  vec4 c = s < 0.5 ? a : b;
  vec2 xy = c.xy + mitre * (side * sw * k / ch);
  gl_Position = projectionMatrix * vec4(xy, c.z, 1.0);
  vUV = vec2(mix(lA.w, lB.w, s), side);
  vSW = sw * k;
  vBW = lC.w * k;
  vL = lD.w;
  vE = lE;
  vF = lF;
  vG = lG;
  vH = lH;
  vJ = lJ;
  vK = lK;
  vM = lM.xy;
  vFace = vec4(xy - (modelViewMatrix * vec4(lI.xyz, 1.0)).xy, lI.w, lJ.x);
}`;

const FRAG = /* glsl */`
uniform float uPx;
uniform float uRimPx;
uniform float uYoung;
varying vec2 vUV;
varying float vSW;
varying float vBW;
varying float vL;
varying vec4 vE;
varying vec4 vF;
varying vec4 vG;
varying vec4 vH;
varying vec4 vJ;
varying vec4 vK;
varying vec2 vM;
varying vec4 vFace;
${LIGHT_RIBBON_GLSL}
// [light ribbon] how far a pixel is out of her face on screen (view plane; <= 0 inside it, large without a face)
float lrFace(vec4 f) {
  if (f.z <= 0.0) return 1e3;
  if (f.w <= 0.0) return length(f.xy) - f.z;
  vec2 q = abs(f.xy) - f.zw;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}
void main() {
  float u = vUV.x;
  float L = max(vL, 1e-3);
  float W = max(vBW, 1e-5);
  float y = vUV.y * vSW / W;   // across, in the bundle's half widths
  float pxB = uPx / W;         // one CSS px, in the bundle's half widths
  float f = clamp(u / L, 0.0, 1.0);
  // its shape along it: out of a point at its start, a tip while its head races out (and behind a tail), round or
  // pointed at its end, out of the edge of her face's box (none of it inside it), its width tapering to its end
  float pw = mix(0.5, 1.0, vH.z);
  float e0 = pow(clamp(u / max(2.0 * W, 0.05), 0.0, 1.0), pw);
  float e1 = pow(clamp((L - u) / max(1.4 * W, 0.04), 0.0, 1.0), pw);
  float eH = clamp((vE.x - u) / max(1.6 * W, 0.04), 0.0, 1.0);
  float eT = clamp((u - vE.y) / max(1.6 * W, 0.04), 0.0, 1.0);
  float fd = lrFace(vFace) - ${f3(RIBBON_FACE_PX)} * uPx;
  float eF = sqrt(clamp(fd / (1.4 * W), 0.0, 1.0));
  float shape = min(min(e0, e1), min(min(eH, eT), eF));
  float sh = shape * mix(1.0, vK.x, f);
  float alive = step(0.02, shape) * step(0.0, fd);
  // the erosion: young (whole) .. gone, rising from the start on to the end (its lag; 0: in place); the core's lift goes
  // with it (it erodes with its ribbons, never outliving them as a bare line)
  float ke = clamp(vE.z * (1.0 + vE.w) - vE.w * f, 0.0, 1.0);
  float cut = mix(uYoung, ${f3(RIBBON_OLD)}, ke);
  float lift = vJ.z * (1.0 - ke);
  float ut = u - vF.y;         // the flowing frame: the noise and the twist run out along the path together
  float ns = vJ.w;
  float sd = vF.z;
  float N = vG.x;
  float hdr = vH.x;
  // the ribbons, then the core; the bundle's outer edges where their colour ends (for the rim)
  vec4 Lr[${MAX_RIBBONS}];
  float Dr[${MAX_RIBBONS}];
  float top = -1e3;
  float bot = 1e3;
  for (int i = 0; i < ${MAX_RIBBONS}; i++) {
    Lr[i] = vec4(0.0);
    Dr[i] = 0.0;
  }
  for (int i = 0; i < ${MAX_RIBBONS}; i++) {
    float fi = float(i);
    if (fi >= N) break;
    float ph = 6.2831853 * (ut * vG.y + fi / max(N, 1.0) + vG.z) + sd * 7.0;
    float dp = cos(ph);
    float c = vK.z * sin(ph) * sh;
    float w = max(vK.w * (0.35 + 0.65 * abs(dp)) * sh, ${f3(RIBBON_MIN_PX.ribbon)} * pxB * min(1.0, sh * 4.0));
    float x = (y - c) / max(w, 1e-4);
    float band = 1.0 - x * x;
    float n = toonNoise(uNoise, vec2(ut * ns + fi * 0.37 + sd, x * 0.15 + fi * 0.23 + sd * 1.7), vF.y * 0.21 + fi * 0.13);
    float heat = toonHeat(band, n) * ${f3(RIBBON_HEAT)};
    float m = toonMask(heat, cut) * step(0.0, band) * alive;
    float front = 0.5 + 0.5 * dp;
    float kk = toonIndexS(heat - cut, ${f3(RIBBON_SLOPE)}, mix(0.72, 1.0, front));
    vec3 col = lrRamp(kk, vF.x + vJ.y * (fi + 1.0)) * (1.0 + hdr * toonHot(kk));
    Lr[i] = lrLayer(col, m * vF.w * mix(0.55, 1.0, front), lrCover(kk));
    Dr[i] = dp;
    float xo = lrEdge(cut / ${f3(RIBBON_HEAT)}, n);
    if (xo > 0.0 && w > 1e-4) {
      top = max(top, c + w * xo);
      bot = min(bot, c - w * xo);
    }
  }
  // the bright core along the axis (heat lifted by its core heat: its middle in the hot bands)
  float cw = vG.w > 0.0 ? max(vG.w * sh, ${f3(RIBBON_MIN_PX.core)} * pxB * min(1.0, sh * 4.0)) : 0.0;
  vec4 Lc = vec4(0.0);
  if (cw > 1e-4) {
    float xc = y / cw;
    float bandC = 1.0 - xc * xc;
    float nC = toonNoise(uNoise, vec2(ut * ns * 1.3 + 0.71 + sd, 0.5 + sd * 0.61), vF.y * 0.17);
    float heatC = toonHeat(bandC, nC) + lift;
    float mC = toonMask(heatC, cut) * step(0.0, bandC) * alive;
    float kC = toonIndexS(heatC - cut, ${f3(RIBBON_SLOPE)}, 1.0);
    vec3 colC = lrRamp(kC, vF.x) * (1.0 + hdr * toonHot(kC));
    Lc = lrLayer(colC, mC * vF.w * vK.y, lrCover(kC));
    float xoC = sqrt(max(0.0, 1.0 - max(cut - lift, 0.0) / (0.3 + nC)));
    if (xoC > 0.0) {
      top = max(top, cw * xoC);
      bot = min(bot, -cw * xoC);
    }
  }
  if (vH.w > 0.5) {
    // the rim: the band just outside the bundle's outer edges (a gap between ribbons and a hole are inside them), in a
    // deeper shade of its deep band, never black; drawn before every colour of the frame (a union outline)
    float e = min(top - y, y - bot);
    float rim = step(-uRimPx * pxB, e) * (1.0 - step(0.0, e)) * step(bot, top) * alive * vH.y * step(vM.x, u) * step(u, vM.y);
    gl_FragColor = lrLayer(lrRamp(0.05, vF.x) * ${f3(RIBBON_RIM.shade)}, rim, ${f3(RIBBON_RIM.cover)});
    return;
  }
  // back to front: the ribbons behind the core, the core, the ribbons in front (their light adds where they cross)
  vec4 acc = vec4(0.0);
  for (int i = 0; i < ${MAX_RIBBONS}; i++) if (Dr[i] < 0.0) acc = lrOver(Lr[i], acc);
  acc = lrOver(Lc, acc);
  for (int i = 0; i < ${MAX_RIBBONS}; i++) if (Dr[i] >= 0.0) acc = lrOver(Lr[i], acc);
  gl_FragColor = acc;
}`;

const HALO_VERT = /* glsl */`
attribute vec4 hA; // a: x, z, u at a, the path's height over the ground at a
attribute vec4 hB; // b: x, z, u at b, its height at b
attribute vec4 hC; // the joint before a: x, z; the joint after b: x, z
attribute vec4 hD; // half width (world), the path's length, strength, erosion (0 whole .. 1 gone)
attribute vec4 hE; // ramp row, flow, seed, the erosion's lag
attribute vec4 hF; // head, tail (u: none of it past the path's racing head or before its tail), -, -
varying vec2 vUV;
varying float vW;
varying float vL;
varying float vHt;
varying vec4 vD;
varying vec4 vE2;
varying vec2 vHT;
void main() {
  vec2 a = hA.xy;
  vec2 b = hB.xy;
  float s = position.x;
  float side = position.y;
  vec2 d = b - a;
  float len = length(d);
  vec2 dir = len > 1e-6 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  vec2 o = s < 0.5 ? a - hC.xy : hC.zw - b;
  float ol = length(o);
  vec2 od = ol > 1e-6 ? o / ol : dir;
  vec2 mm = nrm + vec2(-od.y, od.x);
  vec2 mitre = dot(mm, mm) > 1e-6 ? normalize(mm) : nrm;
  float ch = max(dot(mitre, nrm), 0.25);
  float th = sqrt(max(1.0 / (ch * ch) - 1.0, 0.0));
  float shortest = ol > 1e-6 ? min(len, ol) : len;
  float k = th > 1e-3 ? min(1.0, 0.9 * shortest / max(hD.x * th, 1e-6)) : 1.0;
  vec2 c = s < 0.5 ? a : b;
  vec2 xz = c + mitre * (side * hD.x * k / ch);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(xz.x, ${RIBBON_HALO_Y.toFixed(3)}, xz.y, 1.0);
  vUV = vec2(mix(hA.z, hB.z, s), side);
  vW = hD.x * k;
  vL = hD.y;
  vHt = mix(hA.w, hB.w, s);
  vD = hD;
  vE2 = hE;
  vHT = hF.xy;
}`;

const HALO_FRAG = /* glsl */`
varying vec2 vUV;
varying float vW;
varying float vL;
varying float vHt;
varying vec4 vD;
varying vec4 vE2;
varying vec2 vHT;
${LIGHT_RIBBON_GLSL}
void main() {
  float u = vUV.x;
  float L = max(vL, 1e-3);
  float f = clamp(u / L, 0.0, 1.0);
  float W = max(vW, 1e-4);
  // a stepped glow lying on the ground under the path: round at its ends (and behind its racing head: it follows the
  // path out, never all of it at once), the house heat across it flowing along it, a hard step, its body band at its rim
  // and its light band in (a coloured glow, never a white light); fainter under the higher parts of the path; it erodes
  // with it
  float ends = min(clamp(u / max(W, 0.03), 0.0, 1.0), clamp((L - u) / max(W, 0.03), 0.0, 1.0));
  float sh = sqrt(min(ends, min(clamp((vHT.x - u) / max(W, 0.03), 0.0, 1.0), clamp((u - vHT.y) / max(W, 0.03), 0.0, 1.0))));
  float x = vUV.y / max(sh, 1e-3);
  float band = 1.0 - x * x;
  float n = toonNoise(uNoise, vec2((u - vE2.y) * 0.7 + vE2.z, x * 0.2 + vE2.z * 1.3), vE2.y * 0.13);
  float heat = toonHeat(band, n);
  float cut = mix(${f3(RIBBON_HALO.young)}, ${f3(RIBBON_OLD)}, clamp(vD.w * (1.0 + vE2.w) - vE2.w * f, 0.0, 1.0));
  float m = toonMask(heat, cut) * step(0.0, band) * step(0.02, sh);
  float kk = mix(${f3(RIBBON_HALO.low)}, ${f3(RIBBON_HALO.top)}, clamp((heat - cut) * ${f3(RIBBON_SLOPE)}, 0.0, 1.0));
  vec3 col = lrRamp(kk, vE2.x);
  float fall = clamp(1.0 - vHt / ${f3(RIBBON_HALO.fall)}, 0.0, 1.0);
  float A = m * vD.z * fall;
  vec3 e = linearToOutputTexel(vec4(col, 1.0)).rgb;
  gl_FragColor = vec4(e * A * ${f3(RIBBON_HALO.add)}, A * ${f3(RIBBON_HALO.cover)});
}`;

/** Every shader's text (the tests read them). */
export const LIGHT_RIBBON_SHADERS = Object.freeze({ VERT, FRAG, HALO_VERT, HALO_FRAG });

// ------------------------------------------------------------------------------------------------ the layer

/**
 * A scratch style to fill and hand to path() (copied in). Every value per path:
 *   row           the ramp row (createLightRibbons' `ramps` index) of its core and, with rowStep 0, of its ribbons
 *   rowStep       the prism: ribbon i takes row + rowStep × (i + 1) (one colour a ribbon); 0: every ribbon the core's row
 *   half          the bundle's half width (world)
 *   ribbons       ribbons round the core (the tier caps it); reach / width: how far each swings round the axis and its
 *                 half width (shares of the bundle's half width)
 *   twist / spin  turns a tile along the path / the phase now (turns; the caller turns it: Reduce Motion holds it)
 *   flow          the noise's offset along the path now (tiles; the caller runs it: Reduce Motion holds it)
 *   core          the core's half width (share; 0: none); coreHeat lifts its heat into the hot bands; coreK its strength
 *   noise         the noise's scale along the path (texture tiles a tile)
 *   seed          the path's own (from the caller's seeded stream)
 *   head / tail   nothing past share head of its length (a leader racing out: ≥ 1 whole) or before share tail
 *   erode / lag   0 whole … 1 gone, rising from the start on with lag (0: in place)
 *   strength      0..1; hdr: over-white of its hot band (high with bloom only, through the flash guard)
 *   rim           the rim's strength now (0: none; it must leave before the erosion starts); only from share rimFrom
 *                 of its length to rimTo (none near a muzzle, none under a crown)
 *   halo          the halo's half width on the ground (world; 0: none) and haloK its strength (it follows head and
 *                 tail; a caller fades it in with haloK: a glow that comes on at once is a large change in one frame)
 *   pointed       its ends (0 round … 1 pointed); taper: its width share at its end
 *   face          her face (world x, y, z) and faceBox (half width, half height in the view plane; 0: none): none of it
 *                 is drawn inside the box, and it grows out of its edge
 */
export function ribbonStyle() {
  return {
    row: 0, rowStep: 0, half: 0.06, ribbons: 3, reach: 0.62, width: 0.5, twist: 1.2, spin: 0, flow: 0, core: 0.22,
    coreHeat: 0.55, coreK: 1, noise: 0.8, seed: 0, head: 99, tail: -99, erode: 0, lag: 0, strength: 1, hdr: 0, rim: 0,
    halo: 0, haloK: 1, pointed: 0, taper: 1, fx: 0, fy: 0, fz: 0, faceW: 0, faceH: 0, rimFrom: 0, rimTo: 1,
  };
}

/**
 * @param {{ scene: THREE.Object3D, ramps: string[][], max?: number, haloMax?: number, rims?: boolean,
 *   quality?: 'high'|'medium'|'low', reduceMotion?: boolean, renderOrder?: number, haloOrder?: number, name?: string,
 *   young?: number }} o
 *   ramps: the ramp rows (sRGB hex, deep → white, 5 bands spread over 8 texels as the tornado's), one a row
 *   max: most segments a frame (rims: as many rim instances again); haloMax: most halo segments a frame
 */
export function createLightRibbons({ scene, ramps, max = 512, haloMax = 256, rims = true, quality = 'medium', reduceMotion = false, renderOrder = 22, haloOrder = 6, name = 'lightRibbons', young = RIBBON_YOUNG }) {
  let tierName = LIGHT_RIBBON_TIERS[quality] ? quality : 'medium';
  let tier = LIGHT_RIBBON_TIERS[tierName];
  let bloom = false;
  let flashOn = true;
  let rm = !!reduceMotion;
  let held = false;

  // ---- textures (painted once: no image files): the house noise; the ramp rows, then each × the bloom gains
  const noise = new THREE.DataTexture(paintToonNoise(TOON_NOISE_N, 61), TOON_NOISE_N, TOON_NOISE_N, THREE.RGBAFormat);
  noise.wrapS = noise.wrapT = THREE.RepeatWrapping;
  noise.magFilter = THREE.LinearFilter;
  noise.minFilter = THREE.LinearFilter;
  noise.needsUpdate = true;
  const rows = [...ramps.map((bands) => ({ bands })), ...ramps.map((bands) => ({ bands, gains: RIBBON_BLOOM_GAIN }))];
  const ramp = new THREE.DataTexture(paintToonRamp(rows, TOON_RAMP_W), TOON_RAMP_W, rows.length, THREE.RGBAFormat);
  ramp.magFilter = THREE.NearestFilter;
  ramp.minFilter = THREE.NearestFilter;
  ramp.colorSpace = THREE.SRGBColorSpace;
  ramp.needsUpdate = true;
  const shared = {
    uNoise: { value: noise }, uRamp: { value: ramp }, uRows: { value: rows.length }, uGainRow: { value: 0 },
    uAdd: { value: RIBBON_CANVAS_ADD }, uCoverMode: { value: 0 },
  };
  const material = (vert, frag, extra) => new THREE.ShaderMaterial({
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
  const ribbonMat = material(VERT, FRAG, { uPx: { value: 0.02 }, uRimPx: { value: RIBBON_RIM.px }, uYoung: { value: young } });
  const haloMat = material(HALO_VERT, HALO_FRAG, {});

  // the strip: two columns (a, b) × three rows across (-1, 0, 1)
  const strip = new THREE.BufferGeometry();
  strip.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0], 3));
  strip.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5]);
  const layer = (names, count, mat, order, label) => {
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = strip.index;
    geo.setAttribute('position', strip.attributes.position);
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
    mesh.name = label;
    scene.add(mesh);
    return { geo, attrs, mesh, A: attrs.map((x) => x.array) };
  };
  // (with rims: the rim instances first, [0, max), the colours after them, [max, 2 max), moved down behind the rims at end())
  const RIMS = rims ? max : 0;
  const main = layer(['lA', 'lB', 'lC', 'lD', 'lE', 'lF', 'lG', 'lH', 'lI', 'lJ', 'lK', 'lM'], RIMS + max, ribbonMat, renderOrder, name);
  const halo = layer(['hA', 'hB', 'hC', 'hD', 'hE', 'hF'], haloMax, haloMat, haloOrder, `${name}Halo`);
  const [lA, lB, lC, lD, lE, lF, lG, lH, lI, lJ, lK, lM] = main.A;
  const [hA, hB, hC, hD, hE, hF] = halo.A;
  /** Arc length at each joint of the path being pushed. */
  const U = new Float64Array(MAX_RIBBON_JOINTS);
  let nr = 0;
  let nc = 0;
  let nh = 0;
  let drawn = 0;
  let drawnHalo = 0;
  let refused = 0;
  const STATS = { segments: 0, rims: 0, halo: 0, refused: 0, calls: 0, tier: tierName };

  /**
   * Writes one instance of segment s (joints j, j + 1) of path P (n joints) at index at, in mode (0 colour, 1 rim). (Its
   * length is read from U here: a double passed to a call is boxed, an allocation a call.)
   */
  function writeSeg(at, P, n, j, S, mode, count) {
    const L = U[n - 1];
    const q = at * 4;
    const a = j * 3;
    const b = a + 3;
    const pv = j > 0 ? a - 3 : a;
    const nx = j < n - 2 ? b + 3 : b;
    lA[q] = P[a]; lA[q + 1] = P[a + 1]; lA[q + 2] = P[a + 2]; lA[q + 3] = U[j];
    lB[q] = P[b]; lB[q + 1] = P[b + 1]; lB[q + 2] = P[b + 2]; lB[q + 3] = U[j + 1];
    lC[q] = P[pv]; lC[q + 1] = P[pv + 1]; lC[q + 2] = P[pv + 2]; lC[q + 3] = S.half;
    lD[q] = P[nx]; lD[q + 1] = P[nx + 1]; lD[q + 2] = P[nx + 2]; lD[q + 3] = L;
    lE[q] = S.head * L; lE[q + 1] = S.tail * L; lE[q + 2] = S.erode; lE[q + 3] = S.lag;
    lF[q] = S.row; lF[q + 1] = rm ? 0 : S.flow; lF[q + 2] = S.seed; lF[q + 3] = S.strength;
    lG[q] = count; lG[q + 1] = S.twist; lG[q + 2] = rm ? 0 : S.spin; lG[q + 3] = S.core;
    lH[q] = tier.hdr && bloom && flashOn ? S.hdr : 0; lH[q + 1] = S.rim; lH[q + 2] = S.pointed; lH[q + 3] = mode;
    lI[q] = S.fx; lI[q + 1] = S.fy; lI[q + 2] = S.fz; lI[q + 3] = S.faceW;
    lJ[q] = S.faceH; lJ[q + 1] = S.rowStep; lJ[q + 2] = S.coreHeat; lJ[q + 3] = S.noise;
    lK[q] = S.taper; lK[q + 1] = S.coreK; lK[q + 2] = S.reach; lK[q + 3] = S.width;
    lM[q] = S.rimFrom * L; lM[q + 1] = S.rimTo * L; lM[q + 2] = 0; lM[q + 3] = 0;
  }

  /** The halo's segments of path P (its ground strip; heights over the ground in the w's). */
  function writeHalo(P, n, S) {
    const L = U[n - 1];
    const W = S.halo;
    for (let j = 0; j < n - 1 && nh < haloMax; j++) {
      const q = nh * 4;
      const a = j * 3;
      const b = a + 3;
      const pv = j > 0 ? a - 3 : a;
      const nx = j < n - 2 ? b + 3 : b;
      hA[q] = P[a]; hA[q + 1] = P[a + 2]; hA[q + 2] = U[j]; hA[q + 3] = P[a + 1];
      hB[q] = P[b]; hB[q + 1] = P[b + 2]; hB[q + 2] = U[j + 1]; hB[q + 3] = P[b + 1];
      hC[q] = P[pv]; hC[q + 1] = P[pv + 2]; hC[q + 2] = P[nx]; hC[q + 3] = P[nx + 2];
      hD[q] = W; hD[q + 1] = L; hD[q + 2] = S.strength * S.haloK; hD[q + 3] = S.erode;
      hE[q] = S.row; hE[q + 1] = rm ? 0 : S.flow; hE[q + 2] = S.seed; hE[q + 3] = S.lag;
      hF[q] = S.head * L; hF[q + 1] = S.tail * L; hF[q + 2] = 0; hF[q + 3] = 0;
      nh++;
    }
  }

  /** Uploads a layer's first n instances (whole arrays, no update ranges: nothing allocated) and shows or hides it. */
  const upload = (Lr, n) => {
    Lr.geo.instanceCount = n;
    for (let i = 0; i < Lr.attrs.length; i++) if (n > 0) Lr.attrs[i].needsUpdate = true;
    Lr.mesh.visible = n > 0 && !held;
  };

  const api = {
    /** Starts a frame. */
    begin() {
      nr = 0;
      nc = 0;
      nh = 0;
    },
    /** Segments that still fit this frame (a caller trims to it: a whole path or none). */
    room() {
      return max - nc;
    },
    /**
     * Pushes one path: n joints (x, y, z triples) in P, its style S (copied). Returns false when it does not fit (nothing
     * of it is drawn: a whole path or none).
     */
    path(P, n, S) {
      if (n < 2 || n > MAX_RIBBON_JOINTS) return false;
      const k = n - 1;
      if (nc + k > max) {
        refused++;
        return false;
      }
      // its arc length joint by joint (no variadic Math.hypot: it boxes its arguments)
      U[0] = 0;
      for (let j = 1; j < n; j++) {
        const o = j * 3;
        const dx = P[o] - P[o - 3];
        const dy = P[o + 1] - P[o - 2];
        const dz = P[o + 2] - P[o - 1];
        U[j] = U[j - 1] + Math.sqrt(dx * dx + dy * dy + dz * dz);
      }
      const cap = S.rowStep > 0 ? tier.prism : tier.ribbons;
      const count = S.ribbons < cap ? S.ribbons : cap;
      const rim = rims && tier.rim && S.rim > 0;
      for (let j = 0; j < k; j++) {
        writeSeg(RIMS + nc, P, n, j, S, 0, count);
        nc++;
        if (rim) {
          writeSeg(nr, P, n, j, S, 1, count);
          nr++;
        }
      }
      if (S.halo > 0 && tier.halo) writeHalo(P, n, S);
      return true;
    },
    /** Ends the frame: the colours moved down behind the rims (one draw: every rim first), uploaded, shown or hidden. */
    end() {
      if (RIMS && nc > 0 && nr < RIMS) {
        for (let i = 0; i < main.A.length; i++) main.A[i].copyWithin(nr * 4, RIMS * 4, (RIMS + nc) * 4);
      }
      drawn = nr + nc;
      drawnHalo = nh;
      upload(main, drawn);
      upload(halo, drawnHalo);
    },
    /** Impact frames: it sits them out (end() keeps the meshes hidden while held). */
    hold(on) {
      held = !!on;
      if (held) {
        main.mesh.visible = false;
        halo.mesh.visible = false;
      }
    },
    /** World units per CSS pixel (the camera rig's scale): the thinnest a core is drawn, the rim's width. */
    setPixel(worldPerPx) {
      ribbonMat.uniforms.uPx.value = worldPerPx > 0 ? worldPerPx : 0.02;
    },
    /** The graphics tier (ribbons a bundle, halo, rim, over-white). */
    setQuality(q) {
      tierName = LIGHT_RIBBON_TIERS[q] ? q : 'medium';
      tier = LIGHT_RIBBON_TIERS[tierName];
    },
    /** Bloom on (high only): into the linear target, the cover blend and the gain rows; over-white. */
    setGlow(q, on) {
      bloom = q === 'high' && !!on;
      for (const m of [ribbonMat, haloMat]) {
        m.uniforms.uCoverMode.value = bloom ? 1 : 0;
        m.uniforms.uGainRow.value = bloom ? ramps.length : 0;
      }
    },
    /** Settings → Reduce motion: nothing flows or turns (the paths hold still; lives and strength are the caller's). */
    setReduceMotion(on) {
      rm = !!on;
    },
    /** Settings → Flashes & shake (off: nothing over white). */
    setFlashes(on) {
      flashOn = !!on;
    },
    get meshes() {
      return [main.mesh, halo.mesh];
    },
    /**
     * The ramp texture, its row count and the gain rows' offset now (a family's own pieces in the same bands: the
     * beams' crown): row r's texel at index k is (k, (r + gainRow + 0.5) / rows).
     */
    get ramp() {
      return ramp;
    },
    get rampRows() {
      return rows.length;
    },
    get gainRow() {
      return bloom ? ramps.length : 0;
    },
    get tier() {
      return tier;
    },
    get count() {
      return nc;
    },
    /**
     * Counts (lab, tests; one object filled in place on every read: nothing allocated): segments and rims drawn last
     * frame, halo segments, refused paths, draw calls.
     */
    get stats() {
      STATS.segments = nc;
      STATS.rims = nr;
      STATS.halo = drawnHalo;
      STATS.refused = refused;
      STATS.calls = (main.mesh.visible ? 1 : 0) + (halo.mesh.visible ? 1 : 0);
      STATS.tier = tierName;
      return STATS;
    },
    /** The preallocated arrays (tests: they never grow). */
    get buffers() {
      return [...main.A, ...halo.A, U];
    },
    clear() {
      nr = nc = nh = 0;
      drawn = drawnHalo = 0;
      upload(main, 0);
      upload(halo, 0);
    },
    dispose() {
      scene.remove(main.mesh);
      scene.remove(halo.mesh);
      main.geo.dispose();
      halo.geo.dispose();
      strip.dispose();
      ribbonMat.dispose();
      haloMat.dispose();
      noise.dispose();
      ramp.dispose();
    },
  };
  return api;
}
