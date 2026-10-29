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
import { figurineMaterial, figurineOutlineMaterial, outlineBeforeRender, addOutlineNormals, OUTLINE_FRACTION, EYE_MODES } from './figurine.js';
import { selectToonMaterial, selectTwin } from './highlight.js';
import { isStandIn } from './standins.js';
import { UNIT_MAP } from '../data/units.js';

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
const CLIP_FALLBACK = { victory: 'cheer', pickup: 'cheer' };
// face cells -> eye states of a painted (textured) face; other cells keep the painted open eyes
const CELL_EYES = { blink: EYE_MODES.blink, wink: EYE_MODES.blink, happy: EYE_MODES.happy, hurt: EYE_MODES.hurt, dizzy: EYE_MODES.hurt };

export function baseUrl() {
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

/**
 * Optional extra extension appended to every model asset URL (`.glb` → `.glb.wasm`,
 * `manifest.json` → `manifest.json.wasm`) when `globalThis.__SAKURA_ASSET_EXT` is set — some
 * static hosts refuse `.glb` but serve `.wasm` byte-exact. Default: unchanged.
 */
export function assetExt() {
  return globalThis.__SAKURA_ASSET_EXT || '';
}

export function characterUrl(id, detail = 'full') {
  return `${baseUrl()}models/characters/${id}${detail === 'lod' ? '.lod' : ''}.glb${assetExt()}`;
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
      ? fetch(`${baseUrl()}models/characters/manifest.json${assetExt()}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
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
  // stand-ins (standins.js) have no GLB on purpose, and a duo unit has none of her own (her members' files
  // stand in for it, src/models/duo.js): never request one
  if (noFile(id)) return Promise.resolve(null);
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
  const queue = list.filter((id) => !noFile(id));
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

/** A model asset key that never has a file: a stand-in, or a duo unit's own id. */
function noFile(id) {
  return isStandIn(id) || !!UNIT_MAP[id]?.duo;
}

function prepareAsset(id, detail, gltf) {
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);
  let faceTexture = null;
  let bodyMaps = null;
  let haloColor = new THREE.Color('#ffffff');
  let height = 0.9;
  const extras = gltf.parser.json.asset?.extras || {};
  if (extras.height) height = extras.height;
  // 'textured': an imported (Meshy) figure whose painted base colour carries the face and the
  // outfit (figurine.js shading); its other meshes (the sword) use vertex colours like the
  // Blender-built girls.
  const textured = extras.style === 'textured';
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    const m = o.material;
    if (m?.name === 'head' && m.map) faceTexture = m.map;
    else if (textured && m?.map) {
      bodyMaps = { map: m.map, mrMap: m.metalnessMap || m.roughnessMap || null, normalMap: m.normalMap || null, normalScale: m.normalScale?.clone() };
      addOutlineNormals(o.geometry);
    }
    if (m?.name === 'halo') haloColor = (m.emissive && m.emissive.getHex() ? m.emissive : m.color).clone();
    if (o.geometry) o.geometry.userData.shared = true;
  });
  if (bodyMaps) {
    bodyMaps.map.colorSpace = THREE.SRGBColorSpace;
    for (const t of [bodyMaps.map, bodyMaps.mrMap, bodyMaps.normalMap]) {
      if (!t) continue;
      t.userData.shared = true;
      t.anisotropy = 4;
    }
  }
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
    textured, bodyMaps, outlineTint: extras.outline || undefined, materials: {},
    eyes: textured && extras.eyes?.centers?.length === 2 ? extras.eyes : null,
  };
}

/** Figurine body material of a textured asset (shared by its instances, one per eye state). */
function texturedMaterial(asset, highlight = false, eyeMode = 0) {
  const mode = asset.eyes ? eyeMode : 0;
  const key = `${highlight ? 'hl' : 'body'}|${mode}`;
  if (!asset.materials[key]) asset.materials[key] = figurineMaterial(asset.bodyMaps, { highlight, eyes: asset.eyes, eyeMode: mode });
  return asset.materials[key];
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
  let bodyOutline = null;
  let headMesh = null;
  root.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  for (const o of meshes) {
    const name = o.material?.name || 'body';
    const hasColors = !!o.geometry.attributes.color;
    let tint = '#3a2e44';
    let lineColors = hasColors;
    let lineMat = null;
    let lineWidth = name === 'halo' ? outlineWidth * 0.8 : outlineWidth;
    if (asset.textured && o.material?.map) {
      // the painted figure: figurine shading + her bold texture-tinted outline
      o.material = texturedMaterial(asset);
      o.name = 'body';
      lineMat = figurineOutlineMaterial(asset.bodyMaps.map, asset.height / asset.unitScale, asset.outlineTint);
      bodyMesh = o;
    } else if (asset.textured) {
      // props of a textured figure (the sword): vertex colours, outline in a deep shade of them
      o.material = toonMaterial({ vertexColors: hasColors });
      o.name = 'weapon';
      lineWidth = OUTLINE_FRACTION * 0.45 * (asset.height / asset.unitScale);
    } else if (name === 'head') {
      o.material = new THREE.MeshToonMaterial({ map: faceTex, gradientMap: gradientMap('soft'), color: '#ffffff' });
      o.name = 'head';
      headMesh = o;
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
      ol.material = lineMat || outlineMaterial(lineWidth, tint, lineColors);
      if (lineMat) ol.onBeforeRender = outlineBeforeRender;
      ol.name = 'outline';
      ol.userData.isOutline = true;
      ol.castShadow = false;
      ol.frustumCulled = false;
      if (o.isSkinnedMesh) ol.bind(o.skeleton, o.bindMatrix);
      o.parent.add(ol);
      if (o === bodyMesh) bodyOutline = ol;
    }
  }
  group.add(root);
  // painted face: blink / happy / hurt swap the body to that eye state's material
  const look = { hl: false, eyes: 0 };
  // a figure whose eye sockets are hollow carries a morph that fills them (extras.eyes.closedTarget, Tsubaki's
  // 'eyesClosed'): it is on while her eyes are closed, on the body and its outline
  const closedIdx = asset.eyes?.closedTarget != null ? bodyMesh?.morphTargetDictionary?.[asset.eyes.closedTarget] : undefined;
  const onEyes = asset.textured && asset.eyes && bodyMesh ? (mode) => {
    if (mode === look.eyes) return;
    look.eyes = mode;
    bodyMesh.material = texturedMaterial(asset, look.hl, mode);
    if (closedIdx != null) {
      for (const m of [bodyMesh, bodyOutline]) if (m?.morphTargetInfluences) m.morphTargetInfluences[closedIdx] = mode ? 1 : 0;
    }
  } : null;
  const anim = new GlbAnimator(root, asset, faceTex, unit, onEyes);
  group.userData.unitId = unit.id;
  group.userData.kind = 'chibi';
  group.userData.glb = true;
  group.userData.detail = asset.detail;
  group.userData.height = asset.height;
  group.userData.mixer = anim.mixer;
  group.userData.animate = (time, dt, state = 'idle') => anim.update(time, dt, state);
  group.userData.playAttack = () => anim.playAttack();
  // any other clip once (companions: 'appear'); girls only ship attack clips, so this is a no-op for them
  group.userData.playClip = (name) => anim.playClip(name);
  group.userData.assetId = asset.id;
  group.userData.setExpression = (name) => anim.setExpression(name);
  // selected: her own colours a little brighter with a soft light rim (highlight.js) on the body
  // (shared toon material) and the painted face (her own twin, made on the first tap)
  const headMat = headMesh?.material || null;
  let headHl = null;
  group.userData.setHighlight = (on) => {
    on = !!on;
    if (asset.textured) {
      if (!bodyMesh) return;
      look.hl = on;
      bodyMesh.material = texturedMaterial(asset, look.hl, look.eyes);
      return;
    }
    if (bodyMesh) {
      const vertexColors = !!bodyMesh.geometry.attributes.color;
      bodyMesh.material = on ? selectToonMaterial({ vertexColors }) : toonMaterial({ vertexColors });
    }
    if (headMesh) {
      if (on && !headHl) headHl = selectTwin(headMat);
      headMesh.material = on ? headHl : headMat;
    }
  };
  group.userData.dispose = () => {
    anim.dispose();
    faceTex?.dispose();
    for (const o of meshes) if (o.name === 'halo') o.material.dispose();
    headMat?.dispose();
    headHl?.dispose();
  };
  anim.update(0, 0, pose === 'attack' ? 'idle' : pose);
  return group;
}

/** Drives the mixer: state crossfades, one-shot attacks, blinking and expressions. */
class GlbAnimator {
  constructor(root, asset, faceTex, unit, onEyes = null) {
    this.mixer = new THREE.AnimationMixer(root);
    this.asset = asset;
    this.faceTex = faceTex;
    this.onEyes = onEyes;
    this.actions = {};
    for (const [name, clip] of Object.entries(asset.clips)) {
      const a = this.mixer.clipAction(clip);
      a.enabled = true;
      if (name.startsWith('attack') || name === 'appear') {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = false;
      }
      this.actions[name] = a;
    }
    this.state = null;
    this.current = null;
    this.attack = this.actions.attack || null;
    this.oneShot = null; // the one-shot clip playing (attack, or a companion's 'appear')
    this.oneShotCell = 'attack';
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
    // 'move': the companions' travel loop (girls have no such clip: idle)
    const map = { idle: 'idle', attack: 'idle', cheer: 'cheer', victory: 'victory', disabled: 'hurt', hurt: 'hurt', walk: 'walk', pickup: 'pickup', move: 'move' };
    let name = map[state] || 'idle';
    // imported figures ship a smaller clip set: celebrate with the cheer loop
    if (!this.actions[name] && CLIP_FALLBACK[name] && this.actions[CLIP_FALLBACK[name]]) name = CLIP_FALLBACK[name];
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
    this.playOnce(this.attack, 0.25, 'attack');
  }

  /** Plays a named clip once over the base loop ('appear': the base pose is hidden while it plays). */
  playClip(name) {
    if (name.startsWith('attack')) this.playAttack();
    else this.playOnce(this.actions[name] || null, 0, 'happy');
  }

  playOnce(action, baseWeight, cell) {
    if (!action) return;
    if (this.oneShot && this.oneShot !== action && this.attackLeft > 0) this.oneShot.fadeOut(0.08);
    this.oneShot = action;
    this.oneShotCell = cell;
    action.reset();
    action.setEffectiveWeight(1);
    action.fadeIn(0.06);
    action.play();
    this.attackLeft = action.getClip().duration;
    this.lastAttack = this.time;
    // dip the base pose while the attack plays so arms are not averaged with idle
    const base = this.current ? this.actions[this.current] : null;
    if (base) base.setEffectiveWeight(baseWeight);
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
      if (this.attackLeft <= 0) this.oneShot?.fadeOut(0.12);
    }
    this.mixer.update(dt);
    this.updateFace(time, dt, state);
  }

  updateFace(time, dt, state) {
    if (!this.faceTex && !this.onEyes) return;
    let cell = this.expression || 'idle';
    if (!this.expression) {
      if (state === 'disabled' || state === 'hurt') cell = 'dizzy';
      else if (state === 'cheer' || state === 'victory') cell = 'happy';
      else if (state === 'pickup') cell = 'surprised';
      else if (this.attackLeft > 0) cell = this.oneShotCell;
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
    if (this.onEyes) {
      this.onEyes(CELL_EYES[cell] || 0);
      return;
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
