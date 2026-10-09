// Shared toon materials, gradient maps and inverted-hull outlines.
// Everything here is cached so dozens of characters share a handful of programs.
import * as THREE from 'three';

let gradient3 = null;
let gradient2 = null;
let gradientSoft = null;
const toonCache = new Map();
const outlineCache = new Map();
const basicCache = new Map();

/**
 * Toon ramps shared by every toon material: 3 = shadow / mid / lit (bodies), 2 = hard
 * two-tone, 'soft' = a barely-there shadow step used on faces so the painted eyes stay bright.
 */
export function gradientMap(steps = 3) {
  if (steps === 2) {
    if (!gradient2) gradient2 = makeRamp([150, 255]);
    return gradient2;
  }
  if (steps === 'soft') {
    if (!gradientSoft) gradientSoft = makeRamp([214, 255]);
    return gradientSoft;
  }
  if (!gradient3) gradient3 = makeRamp([168, 222, 255]);
  return gradient3;
}

function makeRamp(values) {
  const data = new Uint8Array(values.length * 4);
  values.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  const tex = new THREE.DataTexture(data, values.length, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Cached toon material. Vertex colours are on by default (all our geometry carries
 * baked colours), so one material serves every part of every character.
 * @param {object} opts { color, vertexColors, emissive, emissiveIntensity, transparent, opacity, side, key }
 */
export function toonMaterial(opts = {}) {
  const {
    color = '#ffffff', vertexColors = true, emissive = '#000000', emissiveIntensity = 1,
    transparent = false, opacity = 1, side = THREE.FrontSide, depthWrite = true,
  } = opts;
  const key = [color, vertexColors, emissive, emissiveIntensity, transparent, opacity, side, depthWrite].join('|');
  let m = toonCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({
      color, vertexColors, emissive, emissiveIntensity, transparent, opacity, side, depthWrite,
      gradientMap: gradientMap(3),
    });
    m.userData.shared = true;
    toonCache.set(key, m);
  }
  return m;
}

/** Cached unlit material (halos, glows, eyes of enemies). */
export function basicMaterial(opts = {}) {
  const {
    color = '#ffffff', vertexColors = false, transparent = false, opacity = 1,
    side = THREE.FrontSide, depthWrite = true, blending = THREE.NormalBlending, toneMapped = true,
  } = opts;
  const key = [color, vertexColors, transparent, opacity, side, depthWrite, blending, toneMapped].join('|');
  let m = basicCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, vertexColors, transparent, opacity, side, depthWrite, blending, toneMapped });
    m.userData.shared = true;
    basicCache.set(key, m);
  }
  return m;
}

/**
 * Inverted-hull outline material: back faces pushed out along the vertex normal.
 * Uses the vertex colours multiplied by a dark tint, so outlines are a deep shade of the
 * surface colour (anime "coloured line art") rather than flat black.
 * @param {number} width outline thickness in the mesh's local units
 * @param {string} tint multiplier for vertex colours
 */
export function outlineMaterial(width = 0.04, tint = '#3a2e44', vertexColors = true) {
  const key = `${width.toFixed(4)}|${tint}|${vertexColors}`;
  let m = outlineCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: tint, side: THREE.BackSide, vertexColors });
    m.userData.shared = true;
    m.userData.outline = true;
    m.onBeforeCompile = (shader) => {
      shader.uniforms.outlineWidth = { value: width };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float outlineWidth;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * outlineWidth;');
    };
    m.customProgramCacheKey = () => `outline-${key}`;
    outlineCache.set(key, m);
  }
  return m;
}

/** Linear-space colour helpers (THREE.Color stores linear components). */
export function col(hex) {
  return new THREE.Color(hex);
}

export function mix(a, b, t) {
  return col(a).lerp(col(b), t);
}

export function shade(hex, f) {
  const c = col(hex);
  return c.multiplyScalar(f);
}

/** Returns '#rrggbb' for a colour lerp (sRGB space, for canvas drawing). */
export function mixHex(a, b, t) {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  return `#${ca.lerp(cb, t).getHexString()}`;
}

export function lightenHex(a, t) {
  return mixHex(a, '#ffffff', t);
}

export function darkenHex(a, t) {
  return mixHex(a, '#000000', t);
}
