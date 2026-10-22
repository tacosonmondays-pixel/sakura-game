// 'Clean cel textures' (prototype proto/rig-motion, owner decision #149: "the texture looks obviously
// generated"; switch: src/models/figureOptions.js). A comparison look for the painted Meshy figures,
// next to look B (figurine.js, the owner's pick in the lighting study), following the style brief:
// "each material is a flat base plus one hard shadow".
//
//  - Palette snap: the figure's own palette is measured once per asset from her base colour (k-means
//    in OKLab over the texels her UVs use). Every texel is pulled to its nearest palette colour, so
//    the baked shading, specular blobs and colour noise of the AI texture flatten into clean blocks.
//    Texels far from every palette colour (small painted details) and her eyes keep their paint.
//  - One hard shadow: lit or shaded by the key light only (a sharp, anti-aliased step), no
//    environment, specular or normal map. The shaded tone is per palette colour, hue-shifted the way
//    the brief asks (white / grey cloth toward lavender, warm colours toward rose, skin barely).
//  - Her face never takes a shadow stripe (the area around her measured eye boxes stays lit).
//  - Eyes still close (blink / ^ ^ / > <) with figurine.js's eyelid code; the outline hull and the
//    selection look are unchanged.
// One program per eye-box variant for all figures (palette = uniforms), cached per asset.
import * as THREE from 'three';
import { FIGURINE_EYES_GLSL, eyeUniforms } from './figurine.js';
import { SELECT_HIGHLIGHT, SELECT_PROGRAM_KEY, patchSelectShader } from './highlight.js';

export const CEL = Object.freeze({
  /** Palette size asked of k-means (near-duplicates merge, rare colours drop; at most 16 stay). */
  k: 18,
  /** How far a texel is pulled onto its palette colour (1 = fully). */
  snap: 0.9,
  /** OKLab distance up to which a texel snaps fully, and from which it keeps its paint. */
  near: 0.045,
  far: 0.1,
  /** N·L of the key light where the shadow starts. */
  edge: 0.18,
  /** Brightness of the lit tone: lights / π × gain (≈ albedo under the battle and viewer lights). */
  gain: 1.18,
  /** Minimum lit share on her face (1 = never shaded). */
  face: 1,
});

const MAX_PAL = 16;
const paletteCache = new WeakMap();

const s2l = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

export function linearToOklab(r, g, b) {
  const l = Math.cbrt(Math.max(0, 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b));
  const m = Math.cbrt(Math.max(0, 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b));
  const s = Math.cbrt(Math.max(0, 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b));
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToLinear(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => Math.min(1, Math.max(0, c)));
}

/**
 * The shaded tone of a palette colour (OKLab in, OKLab out), after the style brief: white and grey
 * cloth go darker and toward lavender (hue ~285°), warm colours go darker and 12° toward rose, skin
 * (light, warm, soft) barely darkens; other hues darken a little toward violet.
 */
export function shadeOf([L, a, b]) {
  const C = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  let L2;
  let C2;
  let h2;
  const warm = h <= 110 || h >= 330;
  if (warm && L > 0.8 && C < 0.1 && h >= 20 && h <= 85) {
    L2 = L * 0.93; C2 = C * 1.05; h2 = h - 4; // skin
  } else if (C < 0.035) {
    L2 = L * 0.8; C2 = C + 0.028; h2 = 285; // whites, greys
  } else if (warm) {
    L2 = L * 0.82; C2 = C * 1.05; h2 = h - 12; // warm: toward rose
  } else {
    L2 = L * 0.8; C2 = C; h2 = h + 8; // cool: toward violet
  }
  const hr = (h2 * Math.PI) / 180;
  return [L2, C2 * Math.cos(hr), C2 * Math.sin(hr)];
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Measures a figure's palette from her base-colour image: only texels under her UV triangles count
 * (the unused texture space is left out). Returns null without a DOM canvas (node tests).
 * @param {CanvasImageSource} image
 * @param {THREE.BufferGeometry|null} geometry her body geometry (uv + index) for the coverage mask
 * @returns {{ n: number, lab: number[][], rgb: number[][], ratio: number[][], counts: number[] } | null}
 */
export function extractPalette(image, geometry = null, k = CEL.k) {
  if (typeof document === 'undefined' || !image) return null;
  // 256² keeps most of the many small UV islands of a Meshy texture apart (a smaller copy blends
  // neighbouring islands into muddy in-between colours); k-means then runs on ≤ 24k of the texels
  const S = 256;
  let px;
  let mask = null;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(image, 0, 0, S, S);
    px = g.getImageData(0, 0, S, S).data;
    const uv = geometry?.attributes?.uv;
    if (uv) {
      const mc = document.createElement('canvas');
      mc.width = mc.height = S;
      const mg = mc.getContext('2d', { willReadFrequently: true });
      mg.fillStyle = '#fff';
      mg.beginPath();
      const idx = geometry.index;
      const tri = idx ? idx.count / 3 : uv.count / 3;
      // glTF UVs: (0, 0) = the image's top-left (GLTFLoader keeps flipY false)
      for (let t = 0; t < tri; t++) {
        for (let j = 0; j < 3; j++) {
          const v = idx ? idx.getX(t * 3 + j) : t * 3 + j;
          const x = uv.getX(v) * S;
          const y = uv.getY(v) * S;
          if (j === 0) mg.moveTo(x, y);
          else mg.lineTo(x, y);
        }
        mg.closePath();
      }
      mg.fill();
      mask = mg.getImageData(0, 0, S, S).data;
    }
  } catch (e) {
    console.warn('[cel] palette unavailable', e?.message || e);
    return null;
  }
  let pts = [];
  for (let i = 0; i < S * S; i++) {
    if (px[i * 4 + 3] < 128) continue;
    if (mask && mask[i * 4 + 3] < 200) continue;
    pts.push(linearToOklab(s2l(px[i * 4] / 255), s2l(px[i * 4 + 1] / 255), s2l(px[i * 4 + 2] / 255)));
  }
  if (pts.length < 64) return null;
  // k-means++ (seeded) + Lloyd iterations in OKLab
  const rand = rng(pts.length * 2654435761);
  if (pts.length > 24000) {
    const step = pts.length / 24000;
    pts = Array.from({ length: 24000 }, (_, i) => pts[Math.floor(i * step)]);
  }
  const centers = [pts[Math.floor(rand() * pts.length)].slice()];
  const d2 = new Float64Array(pts.length).fill(Infinity);
  while (centers.length < k) {
    const c = centers[centers.length - 1];
    let sum = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const e = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
      if (e < d2[i]) d2[i] = e;
      sum += d2[i];
    }
    let r = rand() * sum;
    let pick = pts.length - 1;
    for (let i = 0; i < pts.length; i++) {
      r -= d2[i];
      if (r <= 0) { pick = i; break; }
    }
    centers.push(pts[pick].slice());
  }
  const assign = new Int32Array(pts.length);
  let counts = new Array(k).fill(0);
  for (let it = 0; it < 12; it++) {
    const acc = centers.map(() => [0, 0, 0]);
    counts = new Array(centers.length).fill(0);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      let best = Infinity;
      let bi = 0;
      for (let j = 0; j < centers.length; j++) {
        const c = centers[j];
        const e = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (e < best) { best = e; bi = j; }
      }
      assign[i] = bi;
      counts[bi]++;
      acc[bi][0] += p[0]; acc[bi][1] += p[1]; acc[bi][2] += p[2];
    }
    for (let j = 0; j < centers.length; j++) if (counts[j]) centers[j] = acc[j].map((x) => x / counts[j]);
  }
  // merge near-duplicates, drop rare colours, most common first
  let list = centers.map((c, j) => ({ c, n: counts[j] })).filter((e) => e.n > 0);
  list.sort((a, b) => b.n - a.n);
  const merged = [];
  for (const e of list) {
    const m = merged.find((x) => Math.hypot(x.c[0] - e.c[0], x.c[1] - e.c[1], x.c[2] - e.c[2]) < 0.03);
    if (m) {
      const n = m.n + e.n;
      m.c = m.c.map((x, i) => (x * m.n + e.c[i] * e.n) / n);
      m.n = n;
    } else merged.push({ c: e.c.slice(), n: e.n });
  }
  // one material = one flat base: clusters of the same hue and chroma that differ only by a little
  // lightness are the same paint under baked light / shade, so they merge (no blotchy bands where a
  // baked gradient crosses between them)
  const lch = (c) => [c[0], Math.hypot(c[1], c[2]), Math.atan2(c[2], c[1])];
  for (let changed = true; changed;) {
    changed = false;
    outer: for (let i = 0; i < merged.length; i++) {
      for (let j = i + 1; j < merged.length; j++) {
        const [L1, C1, h1] = lch(merged[i].c);
        const [L2, C2, h2] = lch(merged[j].c);
        let dh = Math.abs(h1 - h2);
        if (dh > Math.PI) dh = 2 * Math.PI - dh;
        const sameHue = (C1 < 0.03 && C2 < 0.03) || (Math.min(C1, C2) > 0.035 && dh < 0.24);
        if (!sameHue || Math.abs(L1 - L2) > 0.11 || Math.abs(C1 - C2) > 0.045) continue;
        const a = merged[i];
        const b = merged[j];
        const n = a.n + b.n;
        a.c = a.c.map((x, k2) => (x * a.n + b.c[k2] * b.n) / n);
        a.n = n;
        merged.splice(j, 1);
        changed = true;
        break outer;
      }
    }
  }
  merged.sort((a, b) => b.n - a.n);
  list = merged.filter((e) => e.n >= pts.length * 0.0025).slice(0, MAX_PAL);
  const out = { n: list.length, lab: [], rgb: [], ratio: [], counts: list.map((e) => e.n) };
  for (const e of list) {
    // the cluster means carry the texture's baked shading: the colour drawn is lifted a touch
    // toward the clean, bright base the brief asks for (L +4 %, chroma +10 %; near-neutrals get
    // purer instead, so white cloth stays white, not cream); matching uses the mean
    const cMul = Math.hypot(e.c[1], e.c[2]) < 0.05 ? 0.6 : 1.1;
    const lift = [Math.min(0.98, e.c[0] * 1.04 + 0.01), e.c[1] * cMul, e.c[2] * cMul];
    const base = oklabToLinear(...lift);
    const shade = oklabToLinear(...shadeOf(lift));
    out.lab.push(e.c);
    out.rgb.push(base);
    out.ratio.push(base.map((x, i) => Math.min(1.15, Math.max(0.35, x > 0.003 ? shade[i] / x : 0.8))));
  }
  return out;
}

/** The palette of an asset's painted body (measured once, cached). */
export function figurePalette(asset, geometry = null) {
  if (paletteCache.has(asset)) return paletteCache.get(asset);
  const p = asset.bodyMaps?.map?.image ? extractPalette(asset.bodyMaps.map.image, geometry) : null;
  paletteCache.set(asset, p);
  return p;
}

function paletteUniforms(p) {
  const lab = [];
  const rgb = [];
  const ratio = [];
  for (let i = 0; i < MAX_PAL; i++) {
    if (i < p.n) {
      lab.push(new THREE.Vector3(...p.lab[i]));
      rgb.push(new THREE.Vector3(...p.rgb[i]));
      ratio.push(new THREE.Vector3(...p.ratio[i]));
    } else {
      lab.push(new THREE.Vector3(99, 0, 0));
      rgb.push(new THREE.Vector3(1, 1, 1));
      ratio.push(new THREE.Vector3(0.8, 0.8, 0.8));
    }
  }
  return {
    figPalLab: { value: lab },
    figPalRgb: { value: rgb },
    figPalRatio: { value: ratio },
    figPalN: { value: p.n },
  };
}

const CEL_UNIFORMS = {
  figSnap: { value: CEL.snap },
  figCelEdge: { value: CEL.edge },
  figCelGain: { value: CEL.gain },
  figCelFace: { value: CEL.face },
};
/** The shared cel uniforms (live tuning in previews/lively.html). */
export const celUniforms = CEL_UNIFORMS;

const CEL_GLSL = /* glsl */ `
uniform vec3 figPalLab[ ${MAX_PAL} ];
uniform vec3 figPalRgb[ ${MAX_PAL} ];
uniform vec3 figPalRatio[ ${MAX_PAL} ];
uniform int figPalN;
uniform float figSnap;
uniform float figCelEdge;
uniform float figCelGain;
uniform float figCelFace;
vec3 figShadeRatio = vec3( 0.8 );
vec3 figOkLab( vec3 c ) {
  vec3 lms = vec3(
    0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b,
    0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b,
    0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b );
  lms = pow( max( lms, vec3( 0.0 ) ), vec3( 1.0 / 3.0 ) );
  return vec3(
    0.2104542553 * lms.x + 0.7936177850 * lms.y - 0.0040720468 * lms.z,
    1.9779984951 * lms.x - 2.4285922050 * lms.y + 0.4505937099 * lms.z,
    0.0259040371 * lms.x + 0.7827717662 * lms.y - 0.8086757660 * lms.z );
}
// pulls a texel onto its nearest palette colour (keep = 1: leave it as painted) and picks the
// shaded tone of that palette colour
void figCelSnap( inout vec3 col, float keep ) {
  vec3 lab = figOkLab( col );
  float best = 1e9;
  int bi = 0;
  for ( int i = 0; i < ${MAX_PAL}; i ++ ) {
    if ( i >= figPalN ) break;
    vec3 d = lab - figPalLab[ i ];
    float e = dot( d, d );
    if ( e < best ) { best = e; bi = i; }
  }
  float w = figSnap * ( 1.0 - smoothstep( ${CEL.near.toFixed(3)}, ${CEL.far.toFixed(3)}, sqrt( best ) ) ) * ( 1.0 - keep );
  col = mix( col, figPalRgb[ bi ], w );
  figShadeRatio = figPalRatio[ bi ];
}
`;

// after <lights_pars_begin> (it reads the light uniforms)
const CEL_LIGHT_GLSL = /* glsl */ `
// flat base + one hard shadow from the key light (the first directional light), brightness from
// the scene's sky + key light so night stages stay darker
vec3 figCelLight( vec3 base, vec3 n, float face ) {
  float k = 1.0;
  vec3 light = ambientLightColor;
  #if NUM_HEMI_LIGHTS > 0
    light += hemisphereLights[ 0 ].skyColor;
  #endif
  #if NUM_DIR_LIGHTS > 0
    float nl = dot( n, directionalLights[ 0 ].direction );
    float aa = max( fwidth( nl ) * 0.75, 0.01 );
    k = smoothstep( figCelEdge - aa, figCelEdge + aa, nl );
    light += directionalLights[ 0 ].color;
  #endif
  k = max( k, face * figCelFace );
  float lum = dot( light, vec3( 0.2126, 0.7152, 0.0722 ) );
  vec3 lit = mix( vec3( lum ), light, 0.35 ) * figCelGain * RECIPROCAL_PI;
  return mix( base * figShadeRatio, base, k ) * lit;
}
`;

// eye boxes (open) and the face around them, in the bind-pose position space of figurine.js
const FACE_GLSL = /* glsl */ `
float figEyeBoxes() {
  float m = 0.0;
  for ( int i = 0; i < 2; i ++ ) {
    vec3 d = vFigPos - figEyeC[ i ];
    if ( d.z < - figEyeDepth ) continue;
    vec2 a = abs( vec2( d.x, d.y ) / figEyeR[ i ] );
    float sq = sqrt( sqrt( a.x * a.x * a.x * a.x + a.y * a.y * a.y * a.y ) );
    m = max( m, 1.0 - smoothstep( 1.0, 1.3, sq ) );
  }
  return m;
}
float figFace() {
  vec3 c = 0.5 * ( figEyeC[ 0 ] + figEyeC[ 1 ] );
  float span = max( abs( figEyeC[ 0 ].x - figEyeC[ 1 ].x ), 1e-4 );
  vec2 d = ( vFigPos.xy - c.xy - vec2( 0.0, -0.35 * span ) ) / span;
  float front = smoothstep( c.z - span * 0.9, c.z - span * 0.45, vFigPos.z );
  return ( 1.0 - smoothstep( 1.0, 1.4, length( d * vec2( 1.0, 0.95 ) ) ) ) * front;
}
`;

const materialCache = new WeakMap();

/**
 * The cel body material of a painted figure (shared per asset and eye state, like figurine.js).
 * @param {{ map: THREE.Texture }} maps her GLB maps (only the base colour is used)
 * @param {{ highlight?: boolean, eyes?: object|null, eyeMode?: number, palette: object }} o
 */
export function celFigureMaterial(maps, { highlight = false, eyes = null, eyeMode = 0, palette }) {
  const m = new THREE.MeshLambertMaterial({
    map: maps.map,
    emissive: new THREE.Color(highlight ? SELECT_HIGHLIGHT.emissive : '#000000'),
    emissiveIntensity: highlight ? SELECT_HIGHLIGHT.glow : 0,
  });
  let palU = materialCache.get(palette);
  if (!palU) {
    palU = paletteUniforms(palette);
    materialCache.set(palette, palU);
  }
  const eyeU = eyes ? eyeUniforms(eyes) : null;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, palU, CEL_UNIFORMS);
    let fs = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${eyeU ? FIGURINE_EYES_GLSL + FACE_GLSL : ''}${CEL_GLSL}`)
      .replace('#include <lights_pars_begin>', `#include <lights_pars_begin>\n${CEL_LIGHT_GLSL}`);
    fs = fs.replace('#include <map_fragment>', `#include <map_fragment>
#ifdef USE_MAP
${eyeU ? '\tfigCloseEyes( diffuseColor.rgb, sampledDiffuseColor.rgb );\n\tfigCelSnap( diffuseColor.rgb, max( figEyeBoxes(), figEyeM ) );' : '\tfigCelSnap( diffuseColor.rgb, 0.0 );'}
#endif`);
    fs = fs.replace('#include <opaque_fragment>', `outgoingLight = figCelLight( diffuseColor.rgb, normal, ${eyeU ? 'figFace()' : '0.0'} ) + totalEmissiveRadiance;\n#include <opaque_fragment>`);
    shader.fragmentShader = fs;
    if (eyeU) {
      Object.assign(shader.uniforms, eyeU, { figEyeMode: { value: eyeMode } });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vFigPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvFigPos = vec3( position );');
    }
    if (highlight) patchSelectShader(shader);
  };
  m.customProgramCacheKey = () => `celfig|${!!eyeU}${highlight ? `|${SELECT_PROGRAM_KEY}` : ''}`;
  m.userData.shared = true;
  m.userData.eyeMode = eyeMode;
  m.userData.cel = true;
  if (highlight) m.userData.selectHighlight = true;
  return m;
}
