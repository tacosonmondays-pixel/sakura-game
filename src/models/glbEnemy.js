// V2 enemies: one Blender-authored GLB per family (public/models/enemies/<family>.glb, built by
// tools/blender/enemies/build_enemies.py). A family file holds the rigged base body, every prop
// and variant piece its enemies use (mesh objects named "<vis>|<group>|<material>") and the
// clips move / idle / hit / death / special. An enemy instance is assembled from the pieces its
// EnemyDef.model asks for, merged into ONE skinned mesh per material (body, glow) + an outline,
// bound to a SkeletonUtils clone of the family skeleton, and tinted at runtime: the vertex
// colour alpha is a tint role (0 = def.color, 0.5 = def.accent, 1 = literal colour).
// The face is a painted atlas (6 expression cells) blended over the tinted skin in the shader.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { gradientMap } from './toon.js';

const assets = new Map(); // family -> asset | null
const loading = new Map();
const mergedCache = new Map();
let manifestPromise = null;
let manifestData = null;
let loaderPromise = null;

export const ENEMY_FACE_CELLS = ['idle', 'blink', 'hit', 'angry', 'dead', 'cast'];
const FACE_GRID = [3, 2];
const OUTLINE_WORLD = 0.011;
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

/** Which pieces an EnemyDef shows: base groups (minus the variant's hide list), its props, its variant. */
export function visiblePieces(asset, def) {
  const variant = def.model?.variant || 'basic';
  const props = new Set(def.model?.props || []);
  const hide = new Set(asset.variantTable[variant]?.hide || []);
  return asset.pieces.filter((p) => {
    if (p.vis === 'base') return !hide.has(p.group);
    if (p.vis.startsWith('prop:')) return props.has(p.vis.slice(5));
    if (p.vis.startsWith('var:')) return p.vis.slice(4) === variant;
    return false;
  });
}

function mergedFor(asset, def) {
  const variant = def.model?.variant || 'basic';
  const key = `${asset.family}|${variant}|${[...(def.model?.props || [])].sort().join(',')}`;
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

/** Toon body: tinted vertex colours + the painted face blended on top (mostly unlit). */
function bodyMaterial(faceTex, tint, opacity) {
  const m = new THREE.MeshToonMaterial({
    vertexColors: true, map: faceTex, gradientMap: gradientMap(3), color: '#ffffff',
    transparent: opacity < 1, opacity, depthWrite: true,
  });
  m.onBeforeCompile = (shader) => {
    patchRoles(shader, tint);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_fragment>', `
#ifdef USE_MAP
  vec4 faceTexel = texture2D( map, vMapUv );
#else
  vec4 faceTexel = vec4( 0.0 );
#endif`)
      .replace('#include <opaque_fragment>', `
vec3 faceLr = outgoingLight / max( diffuseColor.rgb, vec3( 1e-3 ) );
float faceL = clamp( max( faceLr.r, max( faceLr.g, faceLr.b ) ), 0.74, 1.0 );
outgoingLight = mix( outgoingLight, faceTexel.rgb * faceL + totalEmissiveRadiance, faceTexel.a );
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'enemy-body';
  m.userData.tint = tint;
  return m;
}

/** Unlit glow pieces (eyes, cores, sparks); accent-role pieces follow def.accent. */
function glowMaterial(tint, opacity) {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, transparent: opacity < 1, opacity });
  m.onBeforeCompile = (shader) => patchRoles(shader, tint);
  m.customProgramCacheKey = () => 'enemy-glow';
  return m;
}

/** Inverted hull outline following the skin; a deep shade of the tinted surface colour. */
function outlineMaterial(tint, width, lineTint, seeThrough) {
  const m = new THREE.MeshBasicMaterial({ color: lineTint, side: THREE.BackSide, vertexColors: true, transparent: seeThrough, depthWrite: !seeThrough });
  m.onBeforeCompile = (shader) => {
    patchRoles(shader, tint);
    shader.uniforms.outlineWidth = { value: width };
    shader.vertexShader = shader.vertexShader
      .replace('uniform vec3 uMain;', 'uniform vec3 uMain;\nuniform float outlineWidth;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize( objectNormal ) * outlineWidth;');
  };
  m.customProgramCacheKey = () => `enemy-outline-${seeThrough}`;
  m.userData.outline = true;
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
  group.name = `enemy:${def.id}`;
  const model = new THREE.Group();
  model.scale.setScalar(modelScale);
  group.add(model);

  const root = skeletonClone(asset.scene);
  root.name = `glb:${asset.family}`;
  root.scale.setScalar(asset.unitScale);
  const clonedMeshes = [];
  root.traverse((o) => { if (o.isMesh) clonedMeshes.push(o); });
  const tmpl = clonedMeshes.find((o) => o.isSkinnedMesh) || clonedMeshes[0];
  for (const m of clonedMeshes) m.removeFromParent();
  model.add(root);

  const tint = { main: new THREE.Color(def.color || '#ffffff'), accent: new THREE.Color(def.accent || def.color || '#ffffff') };
  const variantInfo = asset.variantTable[def.model?.variant || 'basic'] || {};
  const baseOpacity = variantInfo.opacity || (asset.translucent ? asset.translucent : 1);
  const faceTex = asset.faceTexture ? asset.faceTexture.clone() : null;
  if (faceTex) {
    faceTex.userData = {};
    faceTex.repeat.set(1 / asset.grid[0], 1 / asset.grid[1]);
  }
  const geos = mergedFor(asset, def);
  const bodyMat = bodyMaterial(faceTex, tint, baseOpacity);
  const glowMat = glowMaterial(tint, Math.min(1, baseOpacity + 0.3));
  const see = baseOpacity < 1;
  const outlineWidth = OUTLINE_WORLD * (0.7 + 0.45 * Math.sqrt(size)) / (asset.unitScale * modelScale);
  const lineTint = new THREE.Color(def.color || '#888888').multiplyScalar(0.32).lerp(new THREE.Color('#2a1f3d'), 0.45);
  const outlineMat = quality !== 'low' ? outlineMaterial(tint, outlineWidth, `#${lineTint.getHexString()}`, see) : null;

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

  const anim = new EnemyAnimator(root, asset, faceTex, def, variantInfo.move || 'move');
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
  group.userData.height = 0.6 * size;
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

/** Drives the mixer: move/idle loops, one-shot hit/death/special, face cells. */
class EnemyAnimator {
  constructor(root, asset, faceTex, def, moveName = 'move') {
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
      base.setEffectiveTimeScale(frozen ? 0 : (this.base === this.moveName ? 0.55 + sp * 0.55 : 1));
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
    this.mixer.update(frozen && !this.final ? 0 : dt);
    this.updateFace(time, dt, { hit, dead: dead || this.dead, casting: this.casting || (this.oneShot === this.actions.special && this.oneShotLeft > 0) });
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
