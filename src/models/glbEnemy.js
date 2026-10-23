// V2 enemies: one Blender-authored GLB per family (public/models/enemies/<family>.glb, built by
// tools/blender/enemies/build_enemies.py). A family file holds the rigged base body, every prop
// and variant piece its enemies use (mesh objects named "<vis>|<group>|<material>") and the
// clips move / idle / hit / death / special. An enemy instance is assembled from the pieces its
// EnemyDef.model asks for, merged into ONE skinned mesh per material (body, glow) + an outline,
// bound to a SkeletonUtils clone of the family skeleton, and tinted at runtime: the vertex
// colour alpha is a tint role (0 = def.color, 0.5 = def.accent, 1 = literal colour).
// The face is a painted atlas (6 expression cells) blended over the tinted skin in the shader.
//
// Enemies v2 (route (c), display only; the rules live in enemyDisplay.js):
//  - look: clean cel (flat base + one hard shadow from the key light, the painted face never shaded),
//    the girls' default; 'glossy' (their other Figure look) keeps the old 3-step toon ramp
//  - outline: the girls' line rule (0.94 % of the height, at least 1.7 screen px, the surface times their
//    plum line tint) up close; a deeper line while the monster is small on screen, where a light line gets
//    lost on grass; the hull never dips under the soles (the ground hid the line under the feet)
//  - size: displayScale(def) per family and tier; userData.height follows, and userData.barHeight (the
//    drawn top: ears, horns, hair) puts the HP bar and status icons above the head (actors.js)
//  - colours: a small OKLab lift, lighter bases for the 8 darkest elites and bosses
//  - normals averaged over vertices that share a position, so the shadow line and the hull do not break
//    along colour borders and the face window
//  - a lively layer in EnemyAnimator: each monster starts its loops at its own point, runs 0.94-1.06x as
//    fast and glances about now and then (half as much under Reduce motion)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { gradientMap } from './toon.js';
import { OUTLINE_FRACTION, OUTLINE_MIN_PX, OUTLINE_TINT } from './figurine.js';
import { displayScale, displayColors, liftLinear, PALETTE_LIFT, enemyLook, enemyReduceMotion } from './enemyDisplay.js';

const assets = new Map(); // family -> asset | null
const loading = new Map();
const mergedCache = new Map();
let manifestPromise = null;
let manifestData = null;
let loaderPromise = null;

export const ENEMY_FACE_CELLS = ['idle', 'blink', 'hit', 'angry', 'dead', 'cast'];
const FACE_GRID = [3, 2];
const FADE = 0.14;
const PRELOAD_CONCURRENCY = 4;

const STATUS_TINT = {
  freeze: '#9fe3ff', slow: '#bfe6ff', poison: '#7bd389', burn: '#ff8a3d', shock: '#ffe066',
  stun: '#fff3a3', mark: '#ff5d73', vulnerable: '#a5f3fc', silence: '#b197fc', soak: '#4cc9f0',
  shred: '#c9a27e', reveal: '#fff59d',
};
const STATUS_ORDER = ['freeze', 'burn', 'poison', 'shock', 'stun', 'slow', 'silence', 'mark', 'vulnerable', 'soak', 'shred'];

function baseUrl() {
  let base = '/';
  try {
    base = import.meta.env?.BASE_URL ?? '/';
  } catch {
    base = '/';
  }
  return base.replace(/\/?$/, '/');
}

/** Optional extra extension for every model asset URL (see glbChibi.assetExt). */
function assetExt() {
  return globalThis.__SAKURA_ASSET_EXT || '';
}

/** URL of a family GLB. */
export function enemyUrl(family) {
  return `${baseUrl()}models/enemies/${family}.glb${assetExt()}`;
}

export function canLoadEnemies() {
  return typeof window !== 'undefined' && typeof document !== 'undefined' && typeof fetch === 'function';
}

/** Family asset when loaded (synchronous), else null. */
export function getFamily(family) {
  return assets.get(family) || null;
}

/** Reads public/models/enemies/manifest.json (families that were generated). */
export function loadEnemyManifest() {
  if (!manifestPromise) {
    manifestPromise = canLoadEnemies()
      ? fetch(`${baseUrl()}models/enemies/manifest.json${assetExt()}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      : Promise.resolve(null);
    manifestPromise.then((m) => { manifestData = m; });
  }
  return manifestPromise;
}

function loader() {
  if (!loaderPromise) loaderPromise = Promise.resolve(new GLTFLoader());
  return loaderPromise;
}

/** Loads one family GLB (cached; resolves null when unavailable). */
export function loadFamily(family) {
  if (assets.has(family)) return Promise.resolve(assets.get(family));
  if (loading.has(family)) return loading.get(family);
  if (!canLoadEnemies()) return Promise.resolve(null);
  const p = loadEnemyManifest()
    .then((m) => {
      if (m && !m[family]) return null;
      return loader().then((l) => l.loadAsync(enemyUrl(family))).then((gltf) => prepareAsset(family, gltf));
    })
    .catch((e) => {
      console.warn(`[models] enemy family ${family} unavailable, using procedural fallback`, e?.message || e);
      return null;
    })
    .then((asset) => {
      assets.set(family, asset);
      return asset;
    })
    .finally(() => loading.delete(family));
  loading.set(family, p);
  return p;
}

/** Loads every family in the manifest (or the given ones), a few files at a time. */
export async function preloadEnemies(families = null) {
  const manifest = await loadEnemyManifest();
  const list = families || (manifest ? Object.keys(manifest) : []);
  const queue = [...list];
  let any = false;
  const worker = async () => {
    while (queue.length) {
      const a = await loadFamily(queue.shift());
      if (a) any = true;
    }
  };
  await Promise.all(Array.from({ length: Math.min(PRELOAD_CONCURRENCY, queue.length) }, worker));
  return any;
}

/**
 * "<vis>|<group>|<material>" object names from the Blender pipeline. The GLTFLoader strips
 * ':' from node names, so props/variants are stored as 'prop-x' / 'var-x'.
 */
export function parsePieceName(name = '') {
  let [vis = 'base', group = 'main', material = 'body'] = String(name).split('|');
  vis = vis.replace(/^(prop|var)[-:]/, '$1:');
  return { vis, group, material };
}

/**
 * Averages the normals of vertices that share a position (the pack step keeps colour borders and the
 * face-UV window as split vertices; each copy only sees its own side's faces, which breaks the cel shadow
 * line and cracks the outline hull there). Copies facing away (> 90 deg: the two sides of a thin plate)
 * are left out of each other's average so it never collapses.
 */
export function weldNormals(geo) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  if (!pos || !nor) return;
  const n = pos.count;
  const groups = new Map();
  const keys = new Array(n);
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
    keys[i] = k;
    const g = groups.get(k);
    if (g) g.push(i);
    else groups.set(k, [i]);
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const g = groups.get(keys[i]);
    const nx = nor.getX(i);
    const ny = nor.getY(i);
    const nz = nor.getZ(i);
    if (g.length < 2) {
      out[i * 3] = nx; out[i * 3 + 1] = ny; out[i * 3 + 2] = nz;
      continue;
    }
    let ax = 0;
    let ay = 0;
    let az = 0;
    for (const j of g) {
      const jx = nor.getX(j);
      const jy = nor.getY(j);
      const jz = nor.getZ(j);
      if (j !== i && nx * jx + ny * jy + nz * jz < 0) continue;
      ax += jx; ay += jy; az += jz;
    }
    const l = Math.hypot(ax, ay, az) || 1;
    out[i * 3] = ax / l; out[i * 3 + 1] = ay / l; out[i * 3 + 2] = az / l;
  }
  for (let i = 0; i < n; i++) nor.setXYZ(i, out[i * 3], out[i * 3 + 1], out[i * 3 + 2]);
  nor.needsUpdate = true;
}

function prepareAsset(family, gltf) {
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);
  const extras = gltf.parser.json.asset?.extras || {};
  const pieces = [];
  let faceTexture = null;
  let template = null;
  const corner = extras.faceCorner || [0.01, 0.01];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    const info = parsePieceName(o.name);
    const material = o.material?.name === 'glow' ? 'glow' : (o.material?.name === 'body' ? 'body' : info.material);
    if (material === 'body' && o.material?.map && !faceTexture) faceTexture = o.material.map;
    // the pack step leaves NORMAL out (smooth subsurf shells): rebuild it once per family, averaged over
    // the copies of a vertex that colour borders / the face window split apart
    if (!o.geometry.attributes.normal) {
      o.geometry.computeVertexNormals();
      weldNormals(o.geometry);
    }
    if (material === 'body' && !o.geometry.attributes.uv) {
      // faceless parts ship without UVs: park them on the transparent atlas corner
      const n = o.geometry.attributes.position.count;
      const uv = new Uint16Array(n * 2);
      for (let i = 0; i < n; i++) {
        uv[i * 2] = Math.round(corner[0] * 65535);
        uv[i * 2 + 1] = Math.round(corner[1] * 65535);
      }
      o.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2, true));
    }
    o.geometry.userData.shared = true;
    pieces.push({ ...info, material, geometry: o.geometry, mesh: o });
    if (o.isSkinnedMesh && !template) template = o;
  });
  if (faceTexture) {
    faceTexture.userData.shared = true;
    faceTexture.colorSpace = THREE.SRGBColorSpace;
    faceTexture.generateMipmaps = false;
    faceTexture.minFilter = THREE.LinearFilter;
    faceTexture.magFilter = THREE.LinearFilter;
    faceTexture.wrapS = faceTexture.wrapT = THREE.ClampToEdgeWrapping;
  }
  const clips = {};
  for (const clip of gltf.animations) clips[clip.name] = clip;
  const props = new Set();
  const variants = new Set();
  for (const p of pieces) {
    if (p.vis.startsWith('prop:')) props.add(p.vis.slice(5));
    if (p.vis.startsWith('var:')) variants.add(p.vis.slice(4));
  }
  return {
    family, scene, pieces, template, clips, faceTexture, extras,
    height: extras.height || 1, unitScale: extras.unitScale || 1, translucent: extras.translucent || 0,
    cells: extras.faceCells || ENEMY_FACE_CELLS, grid: extras.faceGrid || FACE_GRID,
    variantTable: extras.variants || {}, props, variants,
  };
}

// ---------------------------------------------------------------------------
// Piece selection + merging
// ---------------------------------------------------------------------------

/**
 * Which pieces an EnemyDef shows: base groups (minus the variant's hide list and the groups its props
 * hide, extras.propHide: e.g. the goblin's hair crest under a hood or a crown), its props, its variant.
 */
export function visiblePieces(asset, def) {
  const variant = def.model?.variant || 'basic';
  const props = new Set(def.model?.props || []);
  const hide = new Set(asset.variantTable[variant]?.hide || []);
  const propHide = asset.extras?.propHide || {};
  for (const p of props) for (const g of propHide[p] || []) hide.add(g);
  return asset.pieces.filter((p) => {
    if (p.vis === 'base') return !hide.has(p.group);
    if (p.vis.startsWith('prop:')) return props.has(p.vis.slice(5));
    if (p.vis.startsWith('var:')) return p.vis.slice(4) === variant;
    return false;
  });
}

function mergedKey(asset, def) {
  const variant = def.model?.variant || 'basic';
  return `${asset.family}|${variant}|${[...(def.model?.props || [])].sort().join(',')}`;
}

const topCache = new Map();
const _topBox = new THREE.Box3();

/**
 * How high the def's visible base pieces (body, ears, horns, hair; no props) reach in the bind pose, as a
 * share of the family's nominal height (at least 1): the HP bar sits above it (actors.js barHeight).
 */
export function baseTopShare(asset, def) {
  const key = mergedKey(asset, def);
  if (topCache.has(key)) return topCache.get(key);
  let top = -Infinity;
  for (const p of visiblePieces(asset, def)) {
    if (p.vis !== 'base' || p.material !== 'body') continue;
    if (!p.geometry.boundingBox) p.geometry.computeBoundingBox();
    _topBox.copy(p.geometry.boundingBox).applyMatrix4(p.mesh.matrixWorld);
    top = Math.max(top, _topBox.max.y * asset.unitScale);
  }
  const share = Number.isFinite(top) ? Math.max(1, top / (asset.height || 1)) : 1;
  topCache.set(key, share);
  return share;
}

function mergedFor(asset, def) {
  const key = mergedKey(asset, def);
  let m = mergedCache.get(key);
  if (m) return m;
  const vis = visiblePieces(asset, def);
  const out = {};
  for (const material of ['body', 'glow']) {
    const geos = vis.filter((p) => p.material === material).map((p) => p.geometry);
    if (!geos.length) continue;
    const g = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (!g) continue;
    g.userData.shared = true;
    out[material] = g;
  }
  mergedCache.set(key, out);
  return out;
}

// ---------------------------------------------------------------------------
// Attachment slots (render-side extras such as event costumes ride on a bone)
// ---------------------------------------------------------------------------

/** Bones a slot rides on, first match wins ('top' = the blob families' upper body). */
const SLOT_BONES = { head: ['head', 'top'], back: ['chest'] };
const slotCache = new Map(); // mergedKey|slot -> { bone, local: Matrix4, dims } | null

function quantile(sorted, q) {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];
}

/**
 * The frame of a slot in its bone's local space: origin at the centre of the vertices that
 * bone mostly drives, unit = their radius (head: mean of the half height and half depth, so
 * wide ears do not blow it up). dims (in that unit): top, front, back, side half extents.
 */
function slotFrame(asset, def, slot, bodyMesh, model) {
  const key = `${mergedKey(asset, def)}|${slot}`;
  if (slotCache.has(key)) return slotCache.get(key);
  let out = null;
  const geo = bodyMesh?.geometry;
  const skel = bodyMesh?.isSkinnedMesh ? bodyMesh.skeleton : null;
  const bi = skel ? (SLOT_BONES[slot] || []).map((n) => skel.bones.findIndex((b) => b.name === n)).find((i) => i >= 0) ?? -1 : -1;
  if (bi >= 0 && geo?.attributes.skinIndex && geo.attributes.skinWeight) {
    // skinned position in model space = Σ w · bone.matrixWorld · boneInverse · bindMatrix · v,
    // then out of the model's world (the enemy may already stand somewhere on the board, so
    // nothing here may rely on the mesh's per-frame bindMatrixInverse)
    model.updateWorldMatrix(true, true);
    const invModel = model.matrixWorld.clone().invert();
    const boneToModel = skel.bones.map((b, j) => invModel.clone().multiply(b.matrixWorld).multiply(skel.boneInverses[j]).multiply(bodyMesh.bindMatrix));
    const pos = geo.attributes.position;
    const si = geo.attributes.skinIndex;
    const sw = geo.attributes.skinWeight;
    const v = new THREE.Vector3();
    const t = new THREE.Vector3();
    const acc = new THREE.Vector3();
    const xs = [];
    const ys = [];
    const zs = [];
    for (let i = 0; i < pos.count; i++) {
      let best = 0;
      let bw = -1;
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k);
        if (w > bw) { bw = w; best = si.getComponent(i, k); }
      }
      if (best !== bi) continue;
      v.fromBufferAttribute(pos, i);
      acc.set(0, 0, 0);
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k);
        if (w > 0) acc.addScaledVector(t.copy(v).applyMatrix4(boneToModel[si.getComponent(i, k)]), w);
      }
      xs.push(acc.x); ys.push(acc.y); zs.push(acc.z);
    }
    if (xs.length >= 8) {
      for (const a of [xs, ys, zs]) a.sort((p, q) => p - q);
      const lo = [quantile(xs, 0.05), quantile(ys, 0.05), quantile(zs, 0.05)];
      const hi = [quantile(xs, 0.95), quantile(ys, 0.95), quantile(zs, 0.95)];
      const half = hi.map((h, k) => Math.max(1e-4, (h - lo[k]) / 2));
      const R = slot === 'head' ? (half[1] + half[2]) / 2 : (half[0] + half[1] + half[2]) / 3;
      const center = new THREE.Vector3((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2);
      const frame = new THREE.Matrix4().compose(center, new THREE.Quaternion(), new THREE.Vector3(R, R, R));
      const bone = skel.bones[bi];
      const boneInModel = invModel.clone().multiply(bone.matrixWorld);
      const local = boneInModel.invert().multiply(frame);
      // blob: the slot is a whole-body blob (slime / ghost / plant 'top'), not a separate head
      out = { bone: bone.name, local, dims: { top: half[1] / R, front: half[2] / R, back: half[2] / R, side: half[0] / R, blob: bone.name === 'top' } };
    }
  }
  slotCache.set(key, out);
  return out;
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

const ROLE_VERTEX = `
vColor = vec4( 1.0 );
#ifdef USE_COLOR_ALPHA
  float tintRole = color.a;
  vec3 tintBase = color.rgb;
  vColor.rgb = tintRole > 0.75 ? tintBase : ( tintRole < 0.25 ? tintBase * uMain : tintBase * uAccent );
#endif
`;

function patchRoles(shader, tint) {
  shader.uniforms.uMain = { value: tint.main };
  shader.uniforms.uAccent = { value: tint.accent };
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nuniform vec3 uMain;\nuniform vec3 uAccent;')
    .replace('#include <color_vertex>', ROLE_VERTEX);
}

const FACE_FRAGMENT = `
#ifdef USE_MAP
  vec4 faceTexel = texture2D( map, vMapUv );
#else
  vec4 faceTexel = vec4( 0.0 );
#endif`;

/**
 * Clean cel of the enemies, the girls' 'Figure look: Clean cel' (celFigure.js) on tinted vertex colours:
 * N·L of the key light (the first directional light) where the shadow starts, the lit tone's brightness
 * (lights / π × gain) and the shaded tone's multiplier (a little darker and toward lavender).
 */
export const ENEMY_CEL = Object.freeze({ edge: 0.18, gain: 1.15, shade: [0.8, 0.78, 0.88] });

const CEL_GLSL = `
uniform float celEdge;
uniform float celGain;
uniform vec3 celShade;
vec3 enemyCelLight( vec3 base, vec3 n, out vec3 lit ) {
  float k = 1.0;
  vec3 light = ambientLightColor;
  #if NUM_HEMI_LIGHTS > 0
    light += hemisphereLights[ 0 ].skyColor;
  #endif
  #if NUM_DIR_LIGHTS > 0
    float nl = dot( n, directionalLights[ 0 ].direction );
    float aa = max( fwidth( nl ) * 0.75, 0.01 );
    k = smoothstep( celEdge - aa, celEdge + aa, nl );
    light += directionalLights[ 0 ].color;
  #endif
  float lum = dot( light, vec3( 0.2126, 0.7152, 0.0722 ) );
  lit = mix( vec3( lum ), light, 0.35 ) * celGain * RECIPROCAL_PI;
  return mix( base * celShade, base, k ) * lit;
}
`;

/**
 * Body material: tinted vertex colours + the painted face blended on top.
 * look 'cel': flat base + one hard shadow, the face never shaded; 'glossy': the old 3-step toon ramp.
 */
function bodyMaterial(faceTex, tint, opacity, look = 'cel') {
  const cel = look === 'cel';
  const m = new THREE.MeshToonMaterial({
    vertexColors: true, map: faceTex, gradientMap: gradientMap(cel ? 2 : 3), color: '#ffffff',
    transparent: opacity < 1, opacity, depthWrite: true,
  });
  m.onBeforeCompile = (shader) => {
    patchRoles(shader, tint);
    if (cel) {
      shader.uniforms.celEdge = { value: ENEMY_CEL.edge };
      shader.uniforms.celGain = { value: ENEMY_CEL.gain };
      shader.uniforms.celShade = { value: new THREE.Vector3(...ENEMY_CEL.shade) };
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <lights_pars_begin>', `#include <lights_pars_begin>\n${CEL_GLSL}`)
        .replace('#include <map_fragment>', FACE_FRAGMENT)
        .replace('#include <opaque_fragment>', `
vec3 celLit;
outgoingLight = enemyCelLight( diffuseColor.rgb, normal, celLit ) + totalEmissiveRadiance;
outgoingLight = mix( outgoingLight, faceTexel.rgb * min( celLit, vec3( 1.0 ) ) + totalEmissiveRadiance, faceTexel.a );
#include <opaque_fragment>`);
      return;
    }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_fragment>', FACE_FRAGMENT)
      .replace('#include <opaque_fragment>', `
vec3 faceLr = outgoingLight / max( diffuseColor.rgb, vec3( 1e-3 ) );
float faceL = clamp( max( faceLr.r, max( faceLr.g, faceLr.b ) ), 0.74, 1.0 );
outgoingLight = mix( outgoingLight, faceTexel.rgb * faceL + totalEmissiveRadiance, faceTexel.a );
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => (cel ? 'enemy-body-cel' : 'enemy-body');
  m.userData.tint = tint;
  m.userData.look = cel ? 'cel' : 'glossy';
  return m;
}

/** Unlit glow pieces (eyes, cores, sparks); accent-role pieces follow def.accent. */
function glowMaterial(tint, opacity) {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, transparent: opacity < 1, opacity });
  m.onBeforeCompile = (shader) => patchRoles(shader, tint);
  m.customProgramCacheKey = () => 'enemy-glow';
  return m;
}

/**
 * The enemies' outline rule. Width: the girls' 0.94 % of the model height, at least 1.7 screen px (no
 * upper clamp: a 40 px monster needs the minimum). Colour: the tinted surface times a line tint that eases
 * from the deep enemy tint (below smallPx tall on screen) to the girls' plum line tint (above bigPx), so a
 * battle-size monster keeps a firm line on grass and a close-up one gets the girls' line. floor: the hull
 * never dips under this height (world units) above the model's origin plane, the ground it stands on, which
 * otherwise swallowed the line under the feet.
 */
export const ENEMY_OUTLINE = Object.freeze({ fraction: OUTLINE_FRACTION, minPx: OUTLINE_MIN_PX, smallPx: 40, bigPx: 140, floor: 0.003 });

const _vp = new THREE.Vector4();

/** Per draw: the viewport height and pixel ratio the outline's on-screen width needs. */
function outlineBeforeRender(renderer, _scene, _camera, _geometry, material) {
  const u = material?.userData?.uniforms;
  if (!u) return;
  renderer.getCurrentViewport(_vp);
  const dpr = Math.max(1, renderer.getPixelRatio());
  u.olViewH.value = _vp.w || 720;
  u.olDpr.value = dpr;
  u.olMinPx.value = ENEMY_OUTLINE.minPx * dpr;
}

/** Inverted hull outline following the skin (see ENEMY_OUTLINE). heightLocal: the model height in mesh units. */
function outlineMaterial(tint, heightLocal, deepTint, seeThrough) {
  const m = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.BackSide, vertexColors: true, transparent: seeThrough, depthWrite: !seeThrough, toneMapped: false });
  const uniforms = {
    olH: { value: heightLocal },
    olMinPx: { value: ENEMY_OUTLINE.minPx },
    olViewH: { value: 720 },
    olDpr: { value: 1 },
    olDeep: { value: new THREE.Color(deepTint) },
    olSoft: { value: new THREE.Color(OUTLINE_TINT) },
  };
  const f = (x) => x.toFixed(4);
  m.onBeforeCompile = (shader) => {
    patchRoles(shader, tint);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('uniform vec3 uMain;', 'uniform vec3 uMain;\nuniform float olH;\nuniform float olMinPx;\nuniform float olViewH;\nuniform float olDpr;\nvarying float vOlT;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  float olScale = length( modelMatrix[ 0 ].xyz );
  vec4 olO = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
  float olPx = projectionMatrix[ 1 ][ 1 ] * 0.5 * olViewH / ( isOrthographic ? 1.0 : max( 0.05, -olO.z ) ) * olScale;
  vOlT = smoothstep( ${f(ENEMY_OUTLINE.smallPx)}, ${f(ENEMY_OUTLINE.bigPx)}, olH * olPx / olDpr );
  transformed += normalize( normal ) * max( ${f(ENEMY_OUTLINE.fraction)} * olH, olMinPx / max( olPx, 1e-4 ) );
}`)
      .replace('#include <project_vertex>', `#include <project_vertex>
{
  float olLift = modelMatrix[ 3 ].y + ${f(ENEMY_OUTLINE.floor)} - ( modelMatrix * vec4( transformed, 1.0 ) ).y;
  if ( olLift > 0.0 ) {
    mvPosition += viewMatrix * vec4( 0.0, olLift, 0.0, 0.0 );
    gl_Position = projectionMatrix * mvPosition;
  }
}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 olDeep;\nuniform vec3 olSoft;\nvarying float vOlT;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix( olDeep, olSoft, vOlT );');
  };
  m.customProgramCacheKey = () => `enemy-outline-rule-${seeThrough}`;
  m.userData.outline = true;
  m.userData.uniforms = uniforms;
  return m;
}

// ---------------------------------------------------------------------------
// Instances
// ---------------------------------------------------------------------------

function hashPhase(id = '') {
  let h = 0;
  for (let i = 0; i < String(id).length; i++) h = (h * 31 + String(id).charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000;
}

/**
 * Builds an enemy instance from a loaded family asset. Fills `group` in place (so a
 * procedural placeholder can be upgraded when the GLB arrives).
 */
export function instantiateEnemy(asset, def, { quality = 'high' } = {}, group = new THREE.Group()) {
  const size = def.size || 1;
  const modelScale = 0.6 * size / (asset.height || 1);
  // display only: the model is drawn bigger, the sim's def.size (and hit radius) is untouched
  const ds = displayScale(def);
  const look = enemyLook();
  group.name = `enemy:${def.id}`;
  const model = new THREE.Group();
  model.scale.setScalar(modelScale * ds);
  group.add(model);

  const root = skeletonClone(asset.scene);
  root.name = `glb:${asset.family}`;
  root.scale.setScalar(asset.unitScale);
  const clonedMeshes = [];
  root.traverse((o) => { if (o.isMesh) clonedMeshes.push(o); });
  const tmpl = clonedMeshes.find((o) => o.isSkinnedMesh) || clonedMeshes[0];
  for (const m of clonedMeshes) m.removeFromParent();
  model.add(root);

  const colors = displayColors(def);
  const tint = {
    main: new THREE.Color().setRGB(...liftLinear(colors.color)),
    accent: new THREE.Color().setRGB(...liftLinear(colors.accent, PALETTE_LIFT.accentShare)),
  };
  const variantInfo = asset.variantTable[def.model?.variant || 'basic'] || {};
  const baseOpacity = variantInfo.opacity || (asset.translucent ? asset.translucent : 1);
  const faceTex = asset.faceTexture ? asset.faceTexture.clone() : null;
  if (faceTex) {
    faceTex.userData = {};
    faceTex.repeat.set(1 / asset.grid[0], 1 / asset.grid[1]);
  }
  const geos = mergedFor(asset, def);
  const bodyMat = bodyMaterial(faceTex, tint, baseOpacity, look);
  const glowMat = glowMaterial(tint, Math.min(1, baseOpacity + 0.3));
  const see = baseOpacity < 1;
  // the deep line of a battle-size monster: a deep shade of its (original) colour toward plum
  const lineTint = new THREE.Color(colors.line).multiplyScalar(0.32).lerp(new THREE.Color('#2a1f3d'), 0.45);
  const outlineMat = quality !== 'low' ? outlineMaterial(tint, (asset.height || 1) / asset.unitScale, lineTint, see) : null;

  const skinned = (geometry, material) => {
    let mesh;
    if (tmpl?.isSkinnedMesh) {
      mesh = new THREE.SkinnedMesh(geometry, material);
      mesh.position.copy(tmpl.position);
      mesh.quaternion.copy(tmpl.quaternion);
      mesh.scale.copy(tmpl.scale);
      (tmpl.parent || root).add(mesh);
      mesh.bind(tmpl.skeleton, tmpl.bindMatrix);
    } else {
      mesh = new THREE.Mesh(geometry, material);
      root.add(mesh);
    }
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    return mesh;
  };
  const bodyMesh = geos.body ? skinned(geos.body, bodyMat) : null;
  if (bodyMesh) {
    bodyMesh.name = 'body';
    bodyMesh.renderOrder = see ? 1 : 0;
  }
  const outlines = [];
  if (bodyMesh && outlineMat) {
    const o = skinned(geos.body, outlineMat);
    o.name = 'outline';
    o.userData.isOutline = true;
    o.castShadow = false;
    o.onBeforeRender = outlineBeforeRender;
    o.renderOrder = see ? 2 : 0;
    outlines.push(o);
  }
  let glowMesh = null;
  if (geos.glow) {
    glowMesh = skinned(geos.glow, glowMat);
    glowMesh.name = 'glow';
    glowMesh.userData.fx = true;
    glowMesh.castShadow = false;
    glowMesh.renderOrder = see ? 3 : 1;
  }

  // Barrier bubble (hidden until setBarrier > 0), in enemy space.
  const bubbleMat = new THREE.MeshBasicMaterial({ color: '#9ec5ff', transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending });
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(asset.height * 0.62, 20, 14), bubbleMat);
  bubble.userData.fx = true;
  bubble.position.y = asset.height * 0.5;
  bubble.visible = false;
  model.add(bubble);

  const anim = new EnemyAnimator(root, asset, faceTex, def, variantInfo.move || 'move', { reduceMotion: enemyReduceMotion() });
  const st = {
    flash: 0, veiled: false, phasing: false, barrier: 0, statuses: {}, tint: null, frozen: false,
    phase: hashPhase(def.id) * Math.PI * 2, hitFace: 0, dead: false,
  };
  const tmp = new THREE.Color();
  const white = new THREE.Color('#ffffff');

  const applyLook = (time) => {
    let opacity = baseOpacity;
    if (st.veiled) opacity = 0.32 + 0.12 * Math.sin(time * 6 + st.phase);
    if (st.phasing) opacity = Math.min(opacity, 0.38 + 0.08 * Math.sin(time * 9));
    bodyMat.opacity = opacity;
    bodyMat.transparent = opacity < 1;
    bodyMat.depthWrite = opacity >= 0.75;
    glowMat.opacity = Math.min(1, opacity + 0.3);
    glowMat.transparent = glowMat.opacity < 1;
    const sil = group.userData.silhouette;
    // a body that no longer writes depth would show the hull's far side through itself
    for (const o of outlines) o.visible = !(st.veiled || st.phasing || sil || opacity < 0.75);
    bodyMat.color.copy(white);
    bodyMat.emissive.setRGB(0, 0, 0);
    if (st.tint) {
      bodyMat.color.lerp(tmp.set(st.tint), st.frozen ? 0.6 : 0.4);
      const pulse = st.statuses.burn || st.statuses.shock ? 0.5 + 0.5 * Math.sin(time * 14) : 1;
      bodyMat.emissive.copy(tmp.set(st.tint)).multiplyScalar(0.18 * pulse);
    }
    if (st.phasing) bodyMat.emissive.add(tmp.set('#5c7cfa').multiplyScalar(0.25));
    if (st.flash > 0) bodyMat.emissive.add(tmp.setRGB(1, 1, 1).multiplyScalar(st.flash * 0.9));
    if (st.barrier > 0) {
      bubble.visible = true;
      bubbleMat.opacity = 0.12 + 0.22 * st.barrier + 0.05 * Math.sin(time * 4);
      bubble.scale.setScalar(1 + 0.03 * Math.sin(time * 3));
    } else {
      bubble.visible = false;
    }
  };

  group.userData.kind = 'enemy';
  group.userData.enemyId = def.id;
  group.userData.family = asset.family;
  group.userData.glb = true;
  group.userData.height = 0.6 * size * ds;
  // the drawn top of the body (ears, horns, hair included): the HP bar goes above it, not across it
  group.userData.barHeight = 0.6 * size * ds * baseTopShare(asset, def);
  group.userData.displayScale = ds;
  group.userData.look = look;
  group.userData.mixer = anim.mixer;
  group.userData.animate = (time, dt = 0.016, { moving = true, speed = 1 } = {}) => {
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    st.flash = Math.max(0, st.flash - dt * 6);
    st.hitFace = Math.max(0, st.hitFace - dt);
    const frozen = st.frozen || !!st.statuses.stun || !!st.statuses.shock;
    anim.update(time, dt, { moving, speed, frozen, stunned: !!st.statuses.stun && !st.frozen, hit: st.hitFace > 0, dead: st.dead });
    applyLook(time);
  };
  group.userData.hitFlash = () => {
    st.flash = 1;
    st.hitFace = 0.28;
    if (!st.dead) anim.playOnce('hit', 0.2);
  };
  group.userData.setVeiled = (on) => { st.veiled = !!on; };
  group.userData.setPhasing = (on) => { st.phasing = !!on; };
  group.userData.setBarrier = (frac) => { st.barrier = Math.max(0, Math.min(1, Number(frac) || 0)); };
  group.userData.setStatus = (map) => {
    st.statuses = {};
    for (const [k, v] of Object.entries(map || {})) if (v) st.statuses[k] = v;
    const top = STATUS_ORDER.find((k) => st.statuses[k]);
    st.tint = top ? STATUS_TINT[top] : null;
    st.frozen = !!st.statuses.freeze;
  };
  /** Plays the death clip (squash / topple / poof); returns its length in seconds. */
  group.userData.playDeath = () => {
    st.dead = true;
    return anim.playOnce('death', 0, true);
  };
  /** One-shot special (field cast, siphon, blink wind-up, roar); returns its length. */
  group.userData.playSpecial = () => (st.dead ? 0 : anim.playOnce('special', 0.15));
  /** Loops the special clip while a field is being projected. */
  group.userData.setCasting = (on) => anim.setCasting(!!on);
  group.userData.setExpression = (name) => anim.setExpression(name);
  /**
   * Rides `obj` on a slot ('head' | 'back'), built in slot units (origin at the slot's centre,
   * 1 = its radius, +y up, +z forward). Calls obj.userData.fit(dims) with the slot's half
   * extents. Returns false when this body has no such slot. Kept across a placeholder upgrade.
   */
  group.userData.attach = (obj, slot = 'head') => {
    const f = slotFrame(asset, def, slot, bodyMesh, model);
    const bone = f && bodyMesh.skeleton.bones.find((b) => b.name === f.bone);
    if (!bone) return false;
    const anchor = new THREE.Group();
    anchor.name = `slot:${slot}`;
    anchor.matrixAutoUpdate = false;
    anchor.matrix.copy(f.local);
    anchor.add(obj);
    bone.add(anchor);
    obj.userData.fit?.(f.dims);
    (group.userData.attachments ||= []).push({ obj, slot });
    return true;
  };
  group.userData.dispose = () => {
    group.userData.disposed = true;
    anim.dispose();
    faceTex?.dispose();
    bodyMat.dispose();
    glowMat.dispose();
    outlineMat?.dispose();
    bubbleMat.dispose();
    bubble.geometry.dispose();
  };
  group.userData.animate(0, 0, { moving: false });
  return group;
}

/**
 * The enemies' lively layer, so a wave does not move in lockstep: every monster starts its loops at its
 * own point, plays them speed × (1 ± speed) and turns its head by up to glance degrees for about
 * glanceTime seconds every glanceEvery[0]-[1] seconds. Reduce motion halves the speed spread and the glance.
 */
export const ENEMY_LIVELY = Object.freeze({ speed: 0.06, glance: 9, glanceTime: 0.9, glanceEvery: [4.5, 9] });

let livelySeq = 0;
/** Per-instance numbers in [0, 1): a golden-ratio sequence (display only, deterministic per build order). */
function livelySeed() {
  livelySeq = (livelySeq + 0.6180339887) % 1;
  return livelySeq;
}
const _glanceQ = new THREE.Quaternion();
const _yAxis = new THREE.Vector3(0, 1, 0);

/** Drives the mixer: move/idle loops, one-shot hit/death/special, face cells, the lively layer. */
class EnemyAnimator {
  constructor(root, asset, faceTex, def, moveName = 'move', { reduceMotion = false } = {}) {
    const calm = reduceMotion ? 0.5 : 1;
    this.lively = {
      offset: livelySeed(),
      rate: 1 + (livelySeed() * 2 - 1) * ENEMY_LIVELY.speed * calm,
      glance: ENEMY_LIVELY.glance * calm,
      side: livelySeed() < 0.5 ? -1 : 1,
      next: ENEMY_LIVELY.glanceEvery[0] + livelySeed() * (ENEMY_LIVELY.glanceEvery[1] - ENEMY_LIVELY.glanceEvery[0]),
      t: -1,
      clock: 0,
    };
    this.head = root.getObjectByName('head') || null;
    this.headBase = this.head ? this.head.quaternion.clone() : null;
    this.mixer = new THREE.AnimationMixer(root);
    this.asset = asset;
    this.faceTex = faceTex;
    this.moveName = asset.clips[moveName] ? moveName : 'move';
    this.actions = {};
    for (const [name, clip] of Object.entries(asset.clips)) {
      const a = this.mixer.clipAction(clip);
      if (name === 'hit' || name === 'death' || name === 'special') {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = name === 'death';
      }
      this.actions[name] = a;
    }
    this.base = null;
    this.oneShot = null;
    this.oneShotLeft = 0;
    this.casting = false;
    this.phase = hashPhase(def.id);
    this.blinkNext = 1.2 + this.phase * 3;
    this.blinkT = -1;
    this.cell = -1;
    this.expression = null;
    this.idleCell = def.tier && def.tier !== 'normal' ? 'angry' : 'idle';
    this.dead = false;
    this.setBase('idle', 0);
  }

  setBase(name, fade = FADE) {
    if (!this.actions[name]) name = this.actions.move ? 'move' : (this.actions.idle ? 'idle' : null);
    if (!name || name === this.base) return;
    const next = this.actions[name];
    const prev = this.base ? this.actions[this.base] : null;
    next.reset();
    // lively: each monster enters its loops at its own point
    next.time = this.lively.offset * next.getClip().duration;
    next.setEffectiveWeight(1);
    next.play();
    if (prev && fade > 0) prev.crossFadeTo(next, fade, false);
    else prev?.stop();
    this.base = name;
  }

  playOnce(name, fade = 0.1, final = false) {
    const a = this.actions[name];
    if (!a) return 0;
    if (this.oneShot && this.oneShot !== a) this.oneShot.stop();
    a.reset();
    a.setEffectiveWeight(1);
    if (fade > 0) a.fadeIn(fade);
    a.play();
    this.oneShot = a;
    this.oneShotLeft = a.getClip().duration;
    this.final = final;
    if (final) this.dead = true;
    return this.oneShotLeft;
  }

  setCasting(on) {
    this.casting = on;
  }

  setExpression(name) {
    this.expression = name;
  }

  update(time, dt, { moving, speed, frozen, stunned, hit, dead }) {
    if (!this.dead) this.setBase(moving ? this.moveName : 'idle');
    const base = this.base ? this.actions[this.base] : null;
    if (base) {
      const sp = THREE.MathUtils.clamp(speed || 1, 0.3, 3);
      base.setEffectiveTimeScale(frozen ? 0 : (this.base === this.moveName ? 0.55 + sp * 0.55 : 1) * this.lively.rate);
      base.setEffectiveWeight(this.oneShotLeft > 0 ? (this.final ? 0 : 0.2) : 1);
    }
    if (this.casting && this.oneShotLeft <= 0 && !this.dead && this.actions.special) this.playOnce('special', 0.2);
    if (this.oneShotLeft > 0) {
      this.oneShotLeft -= frozen && !this.final ? 0 : dt;
      if (this.oneShotLeft <= 0 && !this.final) {
        this.oneShot?.fadeOut(0.12);
        this.oneShot = null;
      }
    }
    if (stunned) this.mixer.getRoot().rotation.z = Math.sin(time * 10) * 0.05;
    else this.mixer.getRoot().rotation.z = 0;
    // the head without last frame's glance, in case the playing clip does not key it
    if (this.head) this.head.quaternion.copy(this.headBase);
    this.mixer.update(frozen && !this.final ? 0 : dt);
    if (this.head) {
      this.headBase.copy(this.head.quaternion);
      const yaw = this.glanceYaw(frozen ? 0 : dt, hit || dead || this.dead || frozen);
      if (yaw) this.head.quaternion.multiply(_glanceQ.setFromAxisAngle(_yAxis, yaw));
    }
    this.updateFace(time, dt, { hit, dead: dead || this.dead, casting: this.casting || (this.oneShot === this.actions.special && this.oneShotLeft > 0) });
  }

  /** Head yaw (radians) of the occasional glance: a smooth out-and-back turn; none while hit / dead / frozen. */
  glanceYaw(dt, busy) {
    const L = this.lively;
    L.clock += dt;
    if (L.t < 0) {
      if (L.clock < L.next || busy) return 0;
      L.t = 0;
      L.side = -L.side;
    }
    L.t += dt;
    const k = L.t / ENEMY_LIVELY.glanceTime;
    if (k >= 1 || busy) {
      L.t = -1;
      L.clock = 0;
      const [a, b] = ENEMY_LIVELY.glanceEvery;
      L.next = a + livelySeed() * (b - a);
      return 0;
    }
    // turn, hold a moment, turn back
    const env = THREE.MathUtils.smoothstep(k, 0, 0.3) * (1 - THREE.MathUtils.smoothstep(k, 0.65, 1));
    return THREE.MathUtils.degToRad(L.glance) * L.side * env;
  }

  updateFace(time, dt, { hit, dead, casting }) {
    if (!this.faceTex) return;
    let cell = this.expression;
    if (!cell) {
      if (dead) cell = 'dead';
      else if (hit) cell = 'hit';
      else if (casting) cell = 'cast';
      else {
        cell = this.idleCell;
        if (time >= this.blinkNext && this.blinkT < 0) this.blinkT = 0;
        if (this.blinkT >= 0) {
          this.blinkT += dt;
          cell = 'blink';
          if (this.blinkT > 0.12) {
            this.blinkT = -1;
            this.blinkNext = time + 2.4 + ((Math.sin(time * 12.9898 + this.phase) * 43758.5453) % 1 + 1) % 1 * 3;
          }
        }
      }
    }
    const idx = Math.max(0, this.asset.cells.indexOf(cell));
    if (idx !== this.cell) {
      this.cell = idx;
      const [cols, rows] = this.asset.grid;
      this.faceTex.offset.set((idx % cols) / cols, Math.floor(idx / cols) / rows);
    }
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
  }
}
