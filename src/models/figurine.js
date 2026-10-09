// Shading for imported, hand-painted figures (the owner's own Meshy chibi of Hikari), the
// "look B" the owner picked in the lighting study: her painted texture as a smooth vinyl
// figurine (PBR with her own metal / roughness, gold stays metallic), lit by the scene plus a
// small studio environment map, with less green ground bounce and a gentle neutral tone curve,
// and a bold inverted-hull outline tinted from her own texture (deep plum on hair and white
// cloth, brown on gold, near-black on navy).
//
// Everything is cached per asset / texture, so every instance of her shares two programs.
import * as THREE from 'three';

/** Environment strength on her material (the study used 0.4 to 0.6). */
export const FIGURINE_ENV = 0.55;
/** Exposure of her own neutral tone curve (applied only when the renderer does no tone mapping). */
export const FIGURINE_EXPOSURE = 0.92;
/** How much of the hemisphere light's colour she keeps (0 = grey bounce, 1 = the green ground as is). */
export const FIGURINE_HEMI_SAT = 0.3;

/**
 * Outline as fractions of her height: 0.94 % wide (1.6 cm on a 1.7 m figure, the width the
 * owner picked for close-ups), at least OUTLINE_MIN_PX screen pixels (a battle-size figure is
 * ~80 px tall, where 0.94 % would be < 1 px), at most 2.5x the base width; and pushed back
 * 11.8 % (20 cm) in depth so it only shows at real silhouette edges instead of leaking through
 * the coat, thighs, braid and temple strands.
 */
export const OUTLINE_FRACTION = 0.0094;
export const OUTLINE_MIN_PX = 1.7;
export const OUTLINE_MAX_K = 2.5;
export const OUTLINE_DEPTH_FRACTION = 0.118;
/** Multiplied with her texture for the outline colour. */
export const OUTLINE_TINT = '#5b3a55';

let env = null;

/**
 * A tiny equirectangular studio (white top light, pale blue-grey horizon, warm grey floor, a
 * soft box in front-right and a rim box behind-left). Built on the CPU, so it needs no renderer:
 * three.js turns it into a PMREM per renderer on first use (battle, student viewer, lobby).
 */
export function studioEnvironment() {
  if (env) return env;
  const W = 128;
  const H = 64;
  const data = new Uint8Array(W * H * 4);
  const stops = [[0, [255, 255, 255]], [0.45, [223, 230, 242]], [0.55, [185, 178, 173]], [1, [111, 102, 96]]];
  const grad = (t) => {
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const [t0, c0] = stops[i - 1];
        const [t1, c1] = stops[i];
        const k = (t - t0) / (t1 - t0);
        return c0.map((c, j) => c + (c1[j] - c) * k);
      }
    }
    return stops[stops.length - 1][1];
  };
  // soft boxes in (u, t) where t = 0 at the zenith: front-right key box and a rim box behind-left
  const boxes = [[0.586, 0.82, 0.156, 0.352], [0.078, 0.254, 0.195, 0.43]];
  const soft = (x, a, b, e = 0.025) => Math.min(1, Math.max(0, Math.min(x - a, b - x) / e + 0.5));
  for (let j = 0; j < H; j++) {
    const v = (j + 0.5) / H; // row 0 = v 0 = straight down (DataTexture rows are not flipped)
    const t = 1 - v;
    const base = grad(t);
    for (let i = 0; i < W; i++) {
      const u = (i + 0.5) / W;
      let b = 0;
      for (const [u0, u1, t0, t1] of boxes) b = Math.max(b, soft(u, u0, u1) * soft(t, t0, t1));
      const o = (j * W + i) * 4;
      for (let c = 0; c < 3; c++) data[o + c] = Math.round(base[c] + (255 - base[c]) * b);
      data[o + 3] = 255;
    }
  }
  env = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  env.mapping = THREE.EquirectangularReflectionMapping;
  env.colorSpace = THREE.SRGBColorSpace;
  env.magFilter = THREE.LinearFilter;
  env.minFilter = THREE.LinearFilter;
  env.generateMipmaps = false;
  env.needsUpdate = true;
  env.userData.shared = true;
  return env;
}

const NEUTRAL = /* glsl */ `
uniform float figExposure;
uniform float figHemiSat;
vec3 figHemi( vec3 c ) {
  float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
  return mix( vec3( l ), c, figHemiSat );
}
// Khronos PBR Neutral (three.js NeutralToneMapping) with her own exposure
vec3 figNeutral( vec3 color ) {
  const float StartCompression = 0.8 - 0.04;
  const float Desaturation = 0.15;
  color *= figExposure;
  float x = min( color.r, min( color.g, color.b ) );
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max( color.r, max( color.g, color.b ) );
  if ( peak < StartCompression ) return color;
  float d = 1. - StartCompression;
  float newPeak = 1. - d * d / ( peak + d - StartCompression );
  color *= newPeak / peak;
  float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
  return mix( color, vec3( newPeak ), g );
}
`;

const HEMI_CALL = 'irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );';

/**
 * Her body material (shared per asset). `maps` = { map, mrMap?, normalMap? } from the GLB.
 * Without a metal/roughness map she is a plain satin dielectric.
 */
export function figurineMaterial(maps, { highlight = false } = {}) {
  const { map, mrMap = null, normalMap = null, normalScale = null } = maps;
  const m = new THREE.MeshStandardMaterial({
    map,
    roughness: mrMap ? 1 : 0.45,
    metalness: mrMap ? 1 : 0,
    roughnessMap: mrMap,
    metalnessMap: mrMap,
    normalMap,
    envMap: studioEnvironment(),
    envMapIntensity: FIGURINE_ENV,
    emissive: highlight ? new THREE.Color('#4d6dff') : new THREE.Color('#000000'),
    emissiveIntensity: highlight ? 0.35 : 0,
  });
  // GLTFLoader flips normalScale.y for meshes without tangents (derivative tangent frames)
  if (normalMap && normalScale) m.normalScale.copy(normalScale);
  const lights = THREE.ShaderChunk.lights_fragment_begin.replace(HEMI_CALL, HEMI_CALL.replace('+= ', '+= figHemi( ').replace(';', ' );'));
  m.onBeforeCompile = (shader) => {
    shader.uniforms.figExposure = { value: FIGURINE_EXPOSURE };
    shader.uniforms.figHemiSat = { value: FIGURINE_HEMI_SAT };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NEUTRAL}`)
      .replace('#include <lights_fragment_begin>', lights)
      .replace('#include <tonemapping_fragment>', '#include <tonemapping_fragment>\n#ifndef TONE_MAPPING\n\tgl_FragColor.rgb = figNeutral( gl_FragColor.rgb );\n#endif');
  };
  m.customProgramCacheKey = () => `figurine|${!!mrMap}|${!!normalMap}`;
  m.userData.shared = true;
  return m;
}

const hullCache = new Map();
const _vp = new THREE.Vector4();

/**
 * The bold inverted-hull outline of a textured figure. Pushed along `outlineNormal` (normals
 * averaged over the UV-seam copies of a vertex, so the hull never cracks), at least
 * OUTLINE_MIN_PX on screen, tinted by the figure's own texture, and pushed back in depth (less
 * near the feet, so the ground does not swallow the boots' line).
 * @param {THREE.Texture} map her base colour
 * @param {number} height her height in the mesh's local units
 */
export function figurineOutlineMaterial(map, height, tint = OUTLINE_TINT) {
  const key = `${map?.uuid}|${height.toFixed(4)}|${tint}`;
  let m = hullCache.get(key);
  if (m) return m;
  m = new THREE.MeshBasicMaterial({ color: tint, map, side: THREE.BackSide, toneMapped: false });
  const uniforms = {
    outlineWidth: { value: OUTLINE_FRACTION * height },
    outlineMaxK: { value: OUTLINE_MAX_K },
    outlineZ: { value: OUTLINE_DEPTH_FRACTION * height },
    outlineMinPx: { value: OUTLINE_MIN_PX },
    outlineViewH: { value: 720 },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
uniform float outlineWidth;
uniform float outlineMaxK;
uniform float outlineZ;
uniform float outlineMinPx;
uniform float outlineViewH;
attribute vec3 outlineNormal;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
float olScale = length( modelMatrix[ 0 ].xyz );
{
  vec4 olO = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
  float olPx = projectionMatrix[ 1 ][ 1 ] * 0.5 * outlineViewH / ( isOrthographic ? 1.0 : max( 0.05, -olO.z ) ) * olScale;
  float olW = clamp( outlineMinPx / max( olPx, 1e-4 ), outlineWidth, outlineWidth * outlineMaxK );
  transformed += normalize( outlineNormal ) * olW;
}`)
      .replace('#include <project_vertex>', `#include <project_vertex>
{
  // depth-only push away from the camera ("Z offset"): screen x/y unchanged, so the silhouette
  // keeps its full width while hull parts lying just behind her own surface stay hidden
  float olFeet = max( 0.0, ( modelMatrix * vec4( transformed, 1.0 ) ).y - modelMatrix[ 3 ].y );
  float olZ = min( outlineZ * olScale, olFeet * 0.8 );
  vec4 olP = projectionMatrix * vec4( mvPosition.xy, mvPosition.z - olZ, 1.0 );
  gl_Position.z = olP.z / olP.w * gl_Position.w;
}`);
  };
  m.customProgramCacheKey = () => 'figurine-hull';
  m.userData.shared = true;
  m.userData.outline = true;
  m.userData.uniforms = uniforms;
  hullCache.set(key, m);
  return m;
}

/** Per-draw: viewport height and pixel ratio for the outline's on-screen minimum width. */
export function outlineBeforeRender(renderer, _scene, _camera, _geometry, material) {
  const u = material?.userData?.uniforms;
  if (!u) return;
  renderer.getCurrentViewport(_vp);
  u.outlineViewH.value = _vp.w || 720;
  u.outlineMinPx.value = OUTLINE_MIN_PX * Math.max(1, renderer.getPixelRatio());
}

/**
 * Adds `outlineNormal` to a geometry: the normal averaged over every copy of the same position
 * (UV seams split vertices; pushing each copy along its own normal cracks the hull). Copies
 * facing away (> 90 deg, zero-thickness folds) are left out so the average never collapses.
 */
export function addOutlineNormals(geo) {
  if (geo.attributes.outlineNormal || !geo.attributes.normal) return;
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const n = pos.count;
  const groups = new Map();
  const keys = new Array(n);
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * 1e5)},${Math.round(pos.getY(i) * 1e5)},${Math.round(pos.getZ(i) * 1e5)}`;
    keys[i] = k;
    const g = groups.get(k);
    if (g) g.push(i);
    else groups.set(k, [i]);
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const nx = nor.getX(i);
    const ny = nor.getY(i);
    const nz = nor.getZ(i);
    let ax = 0;
    let ay = 0;
    let az = 0;
    for (const j of groups.get(keys[i])) {
      const jx = nor.getX(j);
      const jy = nor.getY(j);
      const jz = nor.getZ(j);
      if (j !== i && nx * jx + ny * jy + nz * jz < 0) continue;
      ax += jx;
      ay += jy;
      az += jz;
    }
    const l = Math.hypot(ax, ay, az) || 1;
    out[i * 3] = ax / l;
    out[i * 3 + 1] = ay / l;
    out[i * 3 + 2] = az / l;
  }
  geo.setAttribute('outlineNormal', new THREE.BufferAttribute(out, 3));
}
