// V2 characters: Blender-authored GLBs (public/models/characters/<id>.glb, built by
// tools/blender/build_characters.py). Loaded once with GLTFLoader, cloned per instance with
// SkeletonUtils, drawn with toon materials + an inverted-hull outline that follows skinning,
// animated by an AnimationMixer with the clips baked in the file (idle, walk, attack_<kind>,
// cheer, victory, hurt, pickup). Expressions are cells of the painted face atlas.
//
// Two detail levels per unit: 'full' (<id>.glb, quality high) and 'lod' (<id>.lod.glb,
// one subdivision level lower, quality medium/low, ~1/3 of the triangles).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { toonMaterial, outlineMaterial, gradientMap } from './toon.js';

const assets = new Map(); // `${id}|${detail}` -> asset | null (null = failed)
const loading = new Map(); // key -> Promise<asset|null>
let manifestPromise = null;
let manifestData = null;
let loaderPromise = null;

export const FACE_CELLS = ['idle', 'blink', 'attack', 'happy', 'hurt', 'dizzy', 'wink', 'shy', 'surprised'];
const FACE_GRID = 3;
const OUTLINE_WIDTH = 0.0048;
const FADE = 0.18;
const PRELOAD_CONCURRENCY = 6;

function baseUrl() {
  let base = '/';
  try {
    base = import.meta.env?.BASE_URL ?? '/';
  } catch {
    base = '/';
  }
  return base.replace(/\/?$/, '/');
}

/** Detail level for a quality setting. */
export function detailFor(quality) {
  return quality === 'high' ? 'full' : 'lod';
}

export function characterUrl(id, detail = 'full') {
  return `${baseUrl()}models/characters/${id}${detail === 'lod' ? '.lod' : ''}.glb`;
}

export function canLoadCharacters() {
  return typeof window !== 'undefined' && typeof document !== 'undefined' && typeof fetch === 'function';
}

/** Character asset if it has finished loading (synchronous), else null. */
export function getCharacter(id, detail = 'full') {
  return assets.get(`${id}|${detail}`) || null;
}

/** Reads public/models/characters/manifest.json (list of generated units). */
export function loadManifest() {
  if (!manifestPromise) {
    manifestPromise = canLoadCharacters()
      ? fetch(`${baseUrl()}models/characters/manifest.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      : Promise.resolve(null);
    manifestPromise.then((m) => { manifestData = m; });
  }
  return manifestPromise;
}

function loader() {
  if (!loaderPromise) loaderPromise = Promise.resolve(new GLTFLoader());
  return loaderPromise;
}

/** Loads one character GLB at a detail level (cached; resolves null when unavailable). */
export function loadCharacter(id, detail = 'full') {
  // a LOD file that the manifest does not list falls back to the full model
  if (detail === 'lod' && manifestData && manifestData[id] && !manifestData[id].lod) detail = 'full';
  const key = `${id}|${detail}`;
  if (assets.has(key)) return Promise.resolve(assets.get(key));
  if (loading.has(key)) return loading.get(key);
  if (!canLoadCharacters()) return Promise.resolve(null);
  const p = loader()
    .then((l) => l.loadAsync(characterUrl(id, detail)))
    .then((gltf) => {
      const asset = prepareAsset(id, detail, gltf);
      assets.set(key, asset);
      if (detail === 'lod') assets.set(`${id}|lod`, asset);
      return asset;
    })
    .catch((e) => {
      if (detail === 'lod') {
        // no LOD file: use the full model for medium/low as well
        return loadCharacter(id, 'full').then((a) => { assets.set(key, a); return a; });
      }
      console.warn(`[models] character ${id} unavailable, using fallback`, e?.message || e);
      assets.set(key, null);
      return null;
    })
    .finally(() => loading.delete(key));
  loading.set(key, p);
  return p;
}

/** Loads several characters (all from the manifest when ids is omitted), a few at a time. */
export async function preloadCharacters(ids = null, detail = 'full') {
  let list = ids;
  if (!list) {
    const manifest = await loadManifest();
    list = manifest ? Object.keys(manifest) : [];
  } else {
    await loadManifest();
  }
  const queue = [...list];
  let any = false;
  const worker = async () => {
    while (queue.length) {
      const id = queue.shift();
      const a = await loadCharacter(id, detail);
      if (a) any = true;
    }
  };
  await Promise.all(Array.from({ length: Math.min(PRELOAD_CONCURRENCY, queue.length) }, worker));
  return any;
}

function prepareAsset(id, detail, gltf) {
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);
  let faceTexture = null;
  let haloColor = new THREE.Color('#ffffff');
  let height = 0.9;
  const extras = gltf.parser.json.asset?.extras || {};
  if (extras.height) height = extras.height;
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    const m = o.material;
    if (m?.name === 'head' && m.map) faceTexture = m.map;
    if (m?.name === 'halo') haloColor = (m.emissive && m.emissive.getHex() ? m.emissive : m.color).clone();
    if (o.geometry) o.geometry.userData.shared = true;
  });
  const clips = {};
  for (const clip of gltf.animations) {
    clips[clip.name] = clip;
    if (clip.name.startsWith('attack')) clips.attack = clip;
  }
  if (faceTexture) {
    faceTexture.userData.shared = true;
    faceTexture.colorSpace = THREE.SRGBColorSpace;
    faceTexture.anisotropy = 4;
  }
  // halos are pale in the palettes; push saturation so they read on light backgrounds
  const hsl = {};
  haloColor.getHSL(hsl);
  const haloFill = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 1.25 + 0.15), Math.min(0.78, hsl.l));
  const haloLine = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 1.4 + 0.3), Math.max(0.2, hsl.l * 0.5));
  return {
    id, detail, scene, clips, faceTexture, haloColor: haloFill, haloLine: `#${haloLine.getHexString()}`, height, extras,
    unitScale: extras.unitScale || 1, cells: extras.faceCells || FACE_CELLS, grid: extras.faceGrid || FACE_GRID,
  };
}

// ---------------------------------------------------------------------------
// Instances
// ---------------------------------------------------------------------------

/** Kept for API symmetry (SkeletonUtils is now imported statically). */
export async function ensureSkeletonUtils() {
  return skeletonClone;
}

export function skeletonUtilsReady() {
  return true;
}

/**
 * Builds an instance of a loaded character. Fills `group` in place (the public buildChibi
 * group) so a procedural placeholder can be upgraded when the GLB arrives.
 */
export function instantiateCharacter(asset, unit, { quality = 'high', pose = 'idle' } = {}, group = new THREE.Group()) {
  const root = skeletonClone(asset.scene);
  root.name = `glb:${unit.id}`;
  root.scale.setScalar(asset.unitScale);
  const outlineWidth = OUTLINE_WIDTH / asset.unitScale;
  const faceTex = asset.faceTexture ? asset.faceTexture.clone() : null;
  if (faceTex) {
    faceTex.userData = {};
    faceTex.repeat.set(1 / asset.grid, 1 / asset.grid);
    faceTex.wrapS = faceTex.wrapT = THREE.ClampToEdgeWrapping;
  }
  const meshes = [];
  let bodyMesh = null;
  root.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  for (const o of meshes) {
    const name = o.material?.name || 'body';
    const hasColors = !!o.geometry.attributes.color;
    let tint = '#3a2e44';
    let lineColors = hasColors;
    if (name === 'head') {
      o.material = new THREE.MeshToonMaterial({ map: faceTex, gradientMap: gradientMap('soft'), color: '#ffffff' });
      o.name = 'head';
      tint = '#4a3344';
    } else if (name === 'halo') {
      o.material = new THREE.MeshBasicMaterial({ color: asset.haloColor, toneMapped: false });
      o.name = 'halo';
      tint = asset.haloLine;
      lineColors = false;
    } else {
      o.material = toonMaterial({ vertexColors: hasColors });
      o.name = 'body';
      bodyMesh = o;
    }
    o.castShadow = name !== 'halo';
    o.receiveShadow = false;
    o.frustumCulled = false;
    if (quality !== 'low') {
      const ol = o.clone();
      ol.material = outlineMaterial(name === 'halo' ? outlineWidth * 0.8 : outlineWidth, tint, lineColors);
      ol.name = 'outline';
      ol.userData.isOutline = true;
      ol.castShadow = false;
      ol.frustumCulled = false;
      if (o.isSkinnedMesh) ol.bind(o.skeleton, o.bindMatrix);
      o.parent.add(ol);
    }
  }
  group.add(root);
  const anim = new GlbAnimator(root, asset, faceTex, unit);
  group.userData.unitId = unit.id;
  group.userData.kind = 'chibi';
  group.userData.glb = true;
  group.userData.detail = asset.detail;
  group.userData.height = asset.height;
  group.userData.mixer = anim.mixer;
  group.userData.animate = (time, dt, state = 'idle') => anim.update(time, dt, state);
  group.userData.playAttack = () => anim.playAttack();
  group.userData.setExpression = (name) => anim.setExpression(name);
  group.userData.setHighlight = (on) => {
    if (!bodyMesh) return;
    if (on) {
      if (!bodyMesh.userData.hl) {
        bodyMesh.userData.hl = new THREE.MeshToonMaterial({ vertexColors: !!bodyMesh.geometry.attributes.color, color: '#ffffff', emissive: '#4d6dff', emissiveIntensity: 0.35, gradientMap: gradientMap(3) });
      }
      bodyMesh.material = bodyMesh.userData.hl;
    } else {
      bodyMesh.material = toonMaterial({ vertexColors: !!bodyMesh.geometry.attributes.color });
    }
  };
  group.userData.dispose = () => {
    anim.dispose();
    faceTex?.dispose();
    for (const o of meshes) {
      if (o.name === 'head' || o.name === 'halo') o.material.dispose();
      o.userData.hl?.dispose();
    }
  };
  anim.update(0, 0, pose === 'attack' ? 'idle' : pose);
  return group;
}

/** Drives the mixer: state crossfades, one-shot attacks, blinking and expressions. */
class GlbAnimator {
  constructor(root, asset, faceTex, unit) {
    this.mixer = new THREE.AnimationMixer(root);
    this.asset = asset;
    this.faceTex = faceTex;
    this.actions = {};
    for (const [name, clip] of Object.entries(asset.clips)) {
      const a = this.mixer.clipAction(clip);
      a.enabled = true;
      if (name.startsWith('attack')) {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = false;
      }
      this.actions[name] = a;
    }
    this.state = null;
    this.current = null;
    this.attack = this.actions.attack || null;
    this.attackLeft = 0;
    this.lastAttack = -10;
    this.time = 0;
    this.phase = hashPhase(unit.id);
    this.blinkNext = 1.5 + this.phase * 2;
    this.blinkT = -1;
    this.cell = -1;
    this.expression = null;
    this.setState('idle', 0);
  }

  stateClip(state) {
    const map = { idle: 'idle', attack: 'idle', cheer: 'cheer', victory: 'victory', disabled: 'hurt', hurt: 'hurt', walk: 'walk', pickup: 'pickup' };
    const name = map[state] || 'idle';
    return this.actions[name] ? name : (this.actions.idle ? 'idle' : null);
  }

  setState(state, fade = FADE) {
    const name = this.stateClip(state);
    this.state = state;
    if (!name || name === this.current) return;
    const next = this.actions[name];
    const prev = this.current ? this.actions[this.current] : null;
    next.reset();
    next.setEffectiveWeight(1);
    next.setEffectiveTimeScale(1);
    if (prev && fade > 0) {
      next.play();
      prev.crossFadeTo(next, fade, false);
    } else {
      prev?.stop();
      next.play();
    }
    this.current = name;
  }

  playAttack() {
    if (!this.attack) return;
    this.attack.reset();
    this.attack.setEffectiveWeight(1);
    this.attack.fadeIn(0.06);
    this.attack.play();
    this.attackLeft = this.attack.getClip().duration;
    this.lastAttack = this.time;
    // dip the base pose while the attack plays so arms are not averaged with idle
    const base = this.current ? this.actions[this.current] : null;
    if (base) base.setEffectiveWeight(0.25);
  }

  setExpression(name) {
    this.expression = name;
  }

  update(time, dt, state) {
    this.time = time;
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    if (state !== this.state) this.setState(state);
    if (state === 'attack' && this.attackLeft <= 0 && time - this.lastAttack > 1.1) this.playAttack();
    if (this.attackLeft > 0) {
      this.attackLeft -= dt;
      if (this.attackLeft <= 0.2 && this.current) this.actions[this.current].setEffectiveWeight(1);
      if (this.attackLeft <= 0) this.attack.fadeOut(0.12);
    }
    this.mixer.update(dt);
    this.updateFace(time, dt, state);
  }

  updateFace(time, dt, state) {
    if (!this.faceTex) return;
    let cell = this.expression || 'idle';
    if (!this.expression) {
      if (state === 'disabled' || state === 'hurt') cell = 'dizzy';
      else if (state === 'cheer' || state === 'victory') cell = 'happy';
      else if (state === 'pickup') cell = 'surprised';
      else if (this.attackLeft > 0) cell = 'attack';
      else {
        if (time >= this.blinkNext && this.blinkT < 0) this.blinkT = 0;
        if (this.blinkT >= 0) {
          this.blinkT += dt;
          cell = 'blink';
          if (this.blinkT > 0.12) {
            this.blinkT = -1;
            this.blinkNext = time + 2.2 + (((Math.sin(time * 12.9898 + this.phase) * 43758.5453) % 1) + 1) % 1 * 3;
          }
        }
      }
    }
    const idx = Math.max(0, this.asset.cells.indexOf(cell));
    if (idx !== this.cell) {
      this.cell = idx;
      const g = this.asset.grid;
      this.faceTex.offset.set((idx % g) / g, Math.floor(idx / g) / g);
    }
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
  }
}

function hashPhase(id = '') {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000;
}
