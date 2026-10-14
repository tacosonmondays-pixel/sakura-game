// CPU estimate of how bright the figurine shading (src/models/figurine.js) renders a painted
// albedo on a camera-facing surface: three.js r18x's physical lights for a rough dielectric
// (hemisphere with her grey bounce, directional lights, the studio environment's diffuse
// irradiance), then her neutral tone curve. Diffuse only: specular adds a few % on dark colours.
// Checked against real renders (previews harness, 2026-10): viewer lights hair est (245,147,169)
// vs rendered (244,151,173), skin est (245,224,205) vs (243,222,204); battle lights hair
// (242,143,163) vs (241,148,168), skin (242,221,199) vs (240,218,199).
import * as THREE from 'three';
import { studioEnvironment, FIGURINE_ENV, FIGURINE_EXPOSURE, FIGURINE_HEMI_SAT } from '../../src/models/figurine.js';
import { VIEWER_LIGHTS } from '../../src/models/viewer.js';
import { resolveLook } from '../../src/render/themes.js';

const s2l = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const l2s = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const rgb = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; }; // linear

/** Cosine-weighted mean radiance of the studio environment round normal n. */
export function envIrradiance(n) {
  const { data, width: W, height: H } = studioEnvironment().image;
  const acc = [0, 0, 0];
  let wsum = 0;
  for (let j = 0; j < H; j++) {
    const lat = ((j + 0.5) / H - 0.5) * Math.PI; // row 0 = straight down
    for (let i = 0; i < W; i++) {
      const lon = ((i + 0.5) / W - 0.5) * 2 * Math.PI;
      const d = [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
      const w = Math.max(0, d[0] * n[0] + d[1] * n[1] + d[2] * n[2]) * Math.cos(lat);
      const o = (j * W + i) * 4;
      for (let k = 0; k < 3; k++) acc[k] += s2l(data[o + k] / 255) * w;
      wsum += w;
    }
  }
  return acc.map((v) => v / wsum);
}

function neutral(c, exposure) {
  const start = 0.8 - 0.04;
  c = c.map((v) => v * exposure);
  const x = Math.min(...c);
  const off = x < 0.08 ? x - 6.25 * x * x : 0.04;
  c = c.map((v) => v - off);
  const peak = Math.max(...c);
  if (peak < start) return c;
  const d = 1 - start;
  const np = 1 - (d * d) / (peak + d - start);
  c = c.map((v) => (v * np) / peak);
  const g = 1 - 1 / (0.15 * (peak - np) + 1);
  return c.map((v) => v + (np - v) * g);
}

/** Light rigs: the student viewer's studio and a battle theme's lights (BattleRenderer layout). */
export function lightRigs(theme = 'sakura') {
  const L = resolveLook(theme, {}).light;
  return {
    viewer: { hemi: VIEWER_LIGHTS.hemi, dirs: [VIEWER_LIGHTS.key, VIEWER_LIGHTS.rim] },
    battle: {
      hemi: { sky: L.sky, ground: L.ground, intensity: L.hemi },
      dirs: [{ color: L.key, intensity: L.keyI, position: [-6, 12, 7] }, { color: L.fill, intensity: L.fillI, position: [6, 6, -7] }],
    },
  };
}

/** Estimated on-screen sRGB (0-255) of albedo `hex` facing the camera (normal +Z). */
export function estimateFigurine(hex, rig, { env = FIGURINE_ENV, exposure = FIGURINE_EXPOSURE, hemiSat = FIGURINE_HEMI_SAT, n = [0, 0, 1] } = {}) {
  const a = rgb(hex);
  const sky = rgb(rig.hemi.sky);
  const ground = rgb(rig.hemi.ground);
  const w = 0.5 * n[1] + 0.5;
  let hemi = sky.map((s, k) => (ground[k] + (s - ground[k]) * w) * rig.hemi.intensity);
  const lum = 0.2126 * hemi[0] + 0.7152 * hemi[1] + 0.0722 * hemi[2];
  hemi = hemi.map((v) => lum + (v - lum) * hemiSat);
  const direct = [0, 0, 0];
  for (const d of rig.dirs) {
    const p = d.position;
    const ndl = Math.max(0, (p[0] * n[0] + p[1] * n[1] + p[2] * n[2]) / Math.hypot(...p));
    rgb(d.color).forEach((v, k) => { direct[k] += v * d.intensity * ndl; });
  }
  const e = envIrradiance(n);
  const lit = a.map((v, k) => v * ((hemi[k] + direct[k]) / Math.PI + e[k] * env * 0.96));
  return neutral(lit, exposure).map((v) => Math.round(l2s(Math.min(1, Math.max(0, v))) * 255));
}

/** Rec. 709 luma of the gamma-encoded (sRGB 0-255) colour: how bright it reads on screen. */
export function luma(c) {
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** sRGB 0-255 of a hex albedo. */
export function srgb(hex) {
  return rgb(hex).map((v) => Math.round(l2s(v) * 255));
}
