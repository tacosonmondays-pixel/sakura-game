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
import { figureOptions } from './figureOptions.js';
import { LivelyRig, livelySeed, livelyRandom } from './livelyRig.js';
import { addSkirtBones } from './livelySkirt.js';
import { celFigureMaterial, figurePalette } from './celFigure.js';

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
  // stand-ins (standins.js) have no GLB on purpose: never request one
  if (isStandIn(id)) return Promise.resolve(null);
  // a LOD file that the manifest does not list falls back to the full model
  if (detail === 'lod' && manifestData && manifestData[id] && !manifestData[id].lod) detail = 'full';
  const key = `${id}|${detail}`;
  if (assets.has(key)) return Promise.resolve(assets.get(key));
  if (loading.has(key)) return loading.get(key);
  if (!canLoadCharacters()) return Promise.resolve(null);
  const p = loader()
    .then((l) => l.loadAsync(characterUrl(id, detail)))
    .then(async (gltf) => {
      const asset = prepareAsset(id, detail, gltf);
      await loadFlatMap(asset, gltf);
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
  const queue = list.filter((id) => !isStandIn(id));
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

/** A parsed GLTF → the character asset loadCharacter caches (exported for the node tests; no flat map). */
export function prepareAsset(id, detail, gltf) {
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);
  // lively figures: skirt bones of her own (at rest they deform exactly like before; livelySkirt.js)
  try {
    addSkirtBones(scene);
  } catch (e) {
    console.warn(`[models] ${id}: no skirt bones`, e?.message || e);
  }
  let faceTexture = null;
  let bodyMaps = null;
  let haloColor = new THREE.Color('#ffffff');
  let bodyGeometry = null;
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
      bodyGeometry = o.geometry;
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
  // a companion (Kon, Kaze, the doll: models/companions/, extras.companion) loads through this path too, but
  // keeps its own whole-body clips: no Lively animator (its attacks are driven by the hips)
  const companion = typeof extras.companion === 'string';
  // lively figures: the attack is layered over the base loop by body half (GlbAnimator.playAttack)
  const attackLayers = clips.attack && !companion ? splitClipByBody(clips.attack, upperBodyBones(scene)) : null;
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
    id, detail, scene, clips, attackLayers, companion, faceTexture, haloColor: haloFill, haloLine: `#${haloLine.getHexString()}`, height, extras,
    unitScale: extras.unitScale || 1, cells: extras.faceCells || FACE_CELLS, grid: extras.faceGrid || FACE_GRID,
    textured, bodyMaps, bodyGeometry, outlineTint: extras.outline || undefined, materials: {},
    eyes: textured && extras.eyes?.centers?.length === 2 ? extras.eyes : null,
  };
}

/**
 * The offline-flattened base colour of a painted figure (asset.extras.flat.texture: one more texture in
 * her GLB, written by the rig-rollout flatten: plaid gone, house colours, face protected). The clean cel
 * look draws on it; look B keeps the painted map. Its closed-eye lid colours (extras.flat.eyes) are the
 * flat skin. Loaded once with the GLB; a failure leaves the painted map in use.
 */
async function loadFlatMap(asset, gltf) {
  const flat = asset.extras?.flat;
  if (!asset.textured || !asset.bodyMaps || !Number.isInteger(flat?.texture)) return;
  try {
    const tex = await gltf.parser.getDependency('texture', flat.texture);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.userData.shared = true;
    asset.bodyMaps.flatMap = tex;
    if (asset.eyes && flat.eyes) {
      const over = Object.fromEntries(Object.entries(flat.eyes).filter(([, v]) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)));
      asset.flatEyes = { ...asset.eyes, ...over };
    }
  } catch (e) {
    console.warn(`[models] ${asset.id}: flat base colour unavailable`, e?.message || e);
  }
}

/** True when this figure is drawn in the clean cel look on its flattened base colour. */
function usesFlat(asset, cel) {
  return !!(cel && asset.bodyMaps?.flatMap && figureOptions().flat);
}

/**
 * Body material of a textured asset (shared by its instances, one per eye state): look B
 * (figurine.js), or the 'Clean cel' figure look (celFigure.js) when `cel` is set and her palette
 * could be measured (on the flattened base colour when the GLB has one).
 */
function texturedMaterial(asset, highlight = false, eyeMode = 0, cel = false) {
  const mode = asset.eyes ? eyeMode : 0;
  const flat = usesFlat(asset, cel);
  const palette = cel ? figurePalette(asset, asset.bodyGeometry, flat) : null;
  const key = `${palette ? (flat ? 'celflat|' : 'cel|') : ''}${highlight ? 'hl' : 'body'}|${mode}`;
  if (!asset.materials[key]) {
    asset.materials[key] = palette
      ? celFigureMaterial(flat ? { ...asset.bodyMaps, map: asset.bodyMaps.flatMap } : asset.bodyMaps,
        { highlight, eyes: flat ? asset.flatEyes || asset.eyes : asset.eyes, eyeMode: mode, palette, flat })
      : figurineMaterial(asset.bodyMaps, { highlight, eyes: asset.eyes, eyeMode: mode });
  }
  return asset.materials[key];
}

// ---------------------------------------------------------------------------
// Animator helpers (pure; tests/models/lively.test.js)
// ---------------------------------------------------------------------------

/**
 * 'Lively figures': how an attack sits on the base loop. The attack clip is split by body half
 * (splitClipByBody): the upper half plays at UPPER weight over the base loop's 1 (the mixer averages by
 * weight: 4 : 1 = 80 % attack, the same arm pose the old 0.25 dip gave), the lower half at LOWER (1/3 : 1
 * = 25 %: a hint of the step into the strike), so her legs and hips keep the base loop's weight shift
 * and the base loop itself is never dipped. Off: the old whole-body one-shot over a base at 0.25.
 */
export const ATTACK_LAYER = Object.freeze({ upper: 4, lower: 1 / 3, fadeIn: 0.12, fadeOut: 0.25 });

/**
 * 'Lively figures': the stun's whole-body 'hurt' one-shot plays over the base loop dipped to `base` (0.2 : 1 =
 * 83 % hurt). Under Reduce motion the base loop keeps its full weight (1 : 1), so the flinch moves half as far,
 * like the rest of the lively motion.
 */
export const HURT_LAYER = Object.freeze({ base: 0.2, baseReduced: 1 });

/**
 * Names of the upper-body nodes of a figure: her first spine bone ('spine', else 'spine1' or 'chest')
 * and everything under it (chest, neck, head, arms, hands, a held prop, hair). Empty when she has none.
 */
export function upperBodyBones(scene) {
  const out = new Set();
  let top = null;
  for (const n of ['spine', 'spine1', 'chest']) {
    scene.traverse((o) => {
      if (!top && o.isBone && o.name === n) top = o;
    });
    if (top) break;
  }
  if (top) top.traverse((o) => { if (o.name) out.add(o.name); });
  return out;
}

/**
 * Splits a clip into its upper-body tracks and the rest (root, hips, legs, a skirt): two clips of the
 * same length that share the original tracks. Null when either half would be empty (nothing to layer).
 */
export function splitClipByBody(clip, upper) {
  if (!clip || !upper?.size) return null;
  const up = [];
  const lo = [];
  for (const tr of clip.tracks) {
    const node = THREE.PropertyBinding.parseTrackName(tr.name).nodeName;
    (upper.has(node) ? up : lo).push(tr);
  }
  if (!up.length) return null;
  return {
    upper: new THREE.AnimationClip(`${clip.name}|upper`, clip.duration, up),
    lower: lo.length ? new THREE.AnimationClip(`${clip.name}|lower`, clip.duration, lo) : null,
  };
}

const STATE_CLIPS = { idle: 'idle', attack: 'idle', cheer: 'cheer', victory: 'victory', disabled: 'hurt', hurt: 'hurt', walk: 'walk', pickup: 'pickup', move: 'move', happy: 'happy' };

/**
 * 'Lively figures' under Reduce motion: the library loops (the 7.85 s 338 idle looks around, about 30° of
 * head swing; the 298 cheer throws both arms up) are replaced by the figure's calm `*_short` clips (her shipped
 * idle / cheer / hurt, 6–9° of head swing), the stun's flinch is the 0.4 s `hurt_short` twitch, and the layer's
 * glances on top run at most at `glance` (× the layer's own Reduce motion half).
 */
export const CALM = Object.freeze({ glance: 0.25 });

/**
 * The base loop for an animator state. `has(name)` says whether the figure carries a clip.
 *  - 'move': the companions' travel loop (girls have none: idle); 'happy': a between-wave mood loop
 *  - lively: the stun plays 'hurt' once over a slowed idle (GlbAnimator.setState), so its loop is idle
 *  - imported figures ship a smaller clip set: victory / pickup fall back to the cheer
 *  - lively off, or lively under Reduce motion (`calm`): a figure that carries its old clip as `<name>_short`
 *    (the shipped idle / cheer / hurt next to the new library clips) plays that; off = exactly as before
 */
export function pickStateClip(state, has, lively, calm = false) {
  let name = STATE_CLIPS[state] || 'idle';
  if (lively && (state === 'disabled' || state === 'hurt')) name = 'idle';
  if (!has(name) && CLIP_FALLBACK[name] && has(CLIP_FALLBACK[name])) name = CLIP_FALLBACK[name];
  const short = !lively || calm;
  if (short && has(`${name}_short`)) name = `${name}_short`;
  return has(name) ? name : (has('idle') ? (short && has('idle_short') ? 'idle_short' : 'idle') : null);
}

/** The stun's one-shot flinch of a lively figure: `hurt`, or under Reduce motion (`calm`) her shorter `hurt_short`. */
export function pickHurtClip(has, calm = false) {
  if (calm && has('hurt_short')) return 'hurt_short';
  return has('hurt') ? 'hurt' : null;
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
 * group) so a procedural placeholder can be upgraded when the GLB arrives. `lively`: run the 'Lively
 * figures' animator (default: the setting, for girls; never for a companion asset).
 */
export function instantiateCharacter(asset, unit, { quality = 'high', pose = 'idle', lively = null } = {}, group = new THREE.Group()) {
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
  let headMesh = null;
  // the figure look (Clean cel / Glossy) is picked when the figure is built (figureOptions.js)
  const cel = !!(asset.textured && figureOptions().cel);
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
      o.material = texturedMaterial(asset, false, 0, cel);
      o.name = 'body';
      // (the clean cel look tints her line from the flattened colours too: no noisy line tint)
      lineMat = figurineOutlineMaterial(usesFlat(asset, cel) ? asset.bodyMaps.flatMap : asset.bodyMaps.map, asset.height / asset.unitScale, asset.outlineTint);
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
    }
  }
  group.add(root);
  // painted face: blink / happy / hurt swap the body to that eye state's material
  const look = { hl: false, eyes: 0 };
  const onEyes = asset.textured && asset.eyes && bodyMesh ? (mode) => {
    if (mode === look.eyes) return;
    look.eyes = mode;
    bodyMesh.material = texturedMaterial(asset, look.hl, mode, cel);
  } : null;
  const livelyOn = typeof lively === 'boolean' ? lively && !asset.companion : !asset.companion && figureOptions().lively;
  const anim = new GlbAnimator(root, asset, faceTex, unit, onEyes, livelyOn);
  group.userData.unitId = unit.id;
  group.userData.kind = 'chibi';
  group.userData.glb = true;
  group.userData.detail = asset.detail;
  group.userData.height = asset.height;
  group.userData.mixer = anim.mixer;
  // drive (optional, written by the battle: src/render/livelyPose.js): turn / engaged / windup / fire
  group.userData.animate = (time, dt, state = 'idle') => anim.update(time, dt, state, group.userData.drive || null);
  group.userData.lively = !!anim.lively;
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
      bodyMesh.material = texturedMaterial(asset, look.hl, look.eyes, cel);
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
  constructor(root, asset, faceTex, unit, onEyes = null, livelyOn = false) {
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
    // 'Lively figures' (figureOptions.js): loops start at a random point and run at 0.94-1.06x so
    // copies of one girl never bob in unison; softer crossfades; disabled = 'hurt' once, then a
    // dazed idle; the skeleton layer (livelyRig.js) on top of the mixer. Girls only (instantiateCharacter):
    // a companion keeps the plain animator. Under Reduce motion (`calm`) the painted girls play their calm
    // *_short clips (CALM)
    this.livelyOn = !!livelyOn;
    this.lively = null;
    this.calm = this.livelyOn && !!figureOptions().reduceMotion;
    if (this.livelyOn) {
      const seed = livelySeed(unit.id || '');
      const rig = new LivelyRig(root, asset, seed);
      if (rig.ok) this.lively = rig;
      this.rand = livelyRandom(seed ^ 0x5bd1e995);
      this.loopScale = 0.94 + this.rand() * 0.12;
      // the stun's flinch plays once (hurt, or hurt_short under Reduce motion); neither is ever a base loop here
      for (const hurt of [this.actions.hurt, this.actions.hurt_short]) {
        if (!hurt) continue;
        hurt.setLoop(THREE.LoopOnce, 1);
        hurt.clampWhenFinished = false;
      }
      // the attack by body half (ATTACK_LAYER): arms and torso over the base loop, legs keep its weight shift
      const L = asset.attackLayers;
      if (L) {
        this.attackLayers = [[L.upper, ATTACK_LAYER.upper], [L.lower, ATTACK_LAYER.lower]].filter(([c]) => c).map(([c, w]) => {
          const a = this.mixer.clipAction(c);
          a.setLoop(THREE.LoopOnce, 1);
          a.clampWhenFinished = false;
          a.layerWeight = w;
          return a;
        });
      }
    }
    this.oneShots = []; // every action of the one-shot playing (a layered attack has two)
    this.setState('idle', 0);
  }

  stateClip(state) {
    return pickStateClip(state, (n) => !!this.actions[n], this.livelyOn, this.calm);
  }

  /**
   * The lively layer's glances run at clipMarks[clip].glance on a clip that looks around by itself; under
   * Reduce motion at most at CALM.glance.
   */
  markGlances(name) {
    if (!this.lively) return;
    const g = this.asset.extras?.clipMarks?.[name]?.glance;
    const s = typeof g === 'number' && g >= 0 && g <= 1 ? g : 1;
    this.lively.glanceScale = this.calm ? Math.min(s, CALM.glance) : s;
  }

  setState(state, fade = FADE) {
    const name = this.stateClip(state);
    const prevState = this.state;
    this.state = state;
    if (this.livelyOn) {
      if (fade > 0) fade = 0.3;
      const dazed = state === 'disabled' || state === 'hurt';
      if (dazed && prevState !== 'disabled' && prevState !== 'hurt') {
        const hurt = pickHurtClip((n) => !!this.actions[n], this.calm);
        this.playOnce(hurt ? this.actions[hurt] : null, figureOptions().reduceMotion ? HURT_LAYER.baseReduced : HURT_LAYER.base, 'hurt');
      }
      if (name && name === this.current) {
        this.actions[name].setEffectiveTimeScale(this.loopScale * (dazed ? 0.7 : 1));
        return;
      }
    }
    if (!name || name === this.current) return;
    const next = this.actions[name];
    const prev = this.current ? this.actions[this.current] : null;
    next.reset();
    next.setEffectiveWeight(1);
    next.setEffectiveTimeScale(1);
    if (this.livelyOn && next.loop === THREE.LoopRepeat) {
      next.time = this.rand() * next.getClip().duration;
      next.setEffectiveTimeScale(this.loopScale * (state === 'disabled' || state === 'hurt' ? 0.7 : 1));
    }
    if (prev && fade > 0) {
      next.play();
      prev.crossFadeTo(next, fade, false);
    } else {
      prev?.stop();
      next.play();
    }
    this.current = name;
    this.markGlances(name);
  }

  playAttack() {
    // lively: layered by body half over an undipped base loop; off: the old whole-body one-shot
    if (this.attackLayers?.length) this.playLayers(this.attackLayers, 'attack');
    else this.playOnce(this.attack, 0.25, 'attack');
  }

  /** Plays a named clip once over the base loop ('appear': the base pose is hidden while it plays). */
  playClip(name) {
    if (name.startsWith('attack')) this.playAttack();
    else this.playOnce(this.actions[name] || null, 0, 'happy');
  }

  /** Fades out a different one-shot that is still playing (a new one takes over). */
  endOneShot(next) {
    if (this.attackLeft > 0 && this.oneShots.length && this.oneShots[0] !== next) for (const a of this.oneShots) a.fadeOut(0.08);
  }

  playOnce(action, baseWeight, cell) {
    if (!action) return;
    this.endOneShot(action);
    this.oneShot = action;
    this.oneShots = [action];
    this.oneShotCell = cell;
    action.reset();
    action.setEffectiveWeight(1);
    action.fadeIn(this.livelyOn ? 0.12 : 0.06);
    action.play();
    this.attackLeft = action.getClip().duration;
    this.lastAttack = this.time;
    this.baseWeight = baseWeight;
    // dip the base pose while the one-shot plays so arms are not averaged with idle
    const base = this.current ? this.actions[this.current] : null;
    if (base) base.setEffectiveWeight(baseWeight);
  }

  /** A one-shot made of weighted layers (the lively attack): the base loop keeps its full weight. */
  playLayers(layers, cell) {
    this.endOneShot(layers[0]);
    this.oneShot = layers[0];
    this.oneShots = layers;
    this.oneShotCell = cell;
    for (const a of layers) {
      a.reset();
      a.setEffectiveWeight(a.layerWeight);
      a.fadeIn(ATTACK_LAYER.fadeIn);
      a.play();
    }
    this.attackLeft = layers[0].getClip().duration;
    this.lastAttack = this.time;
    // a hurt that was still playing had dipped the base loop: give it back its weight
    const base = this.current ? this.actions[this.current] : null;
    if (base && (this.baseWeight ?? 1) < 1) base.setEffectiveWeight(1);
    this.baseWeight = 1;
  }

  setExpression(name) {
    this.expression = name;
  }

  update(time, dt, state, drive = null) {
    this.time = time;
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    if (this.livelyOn && !!figureOptions().reduceMotion !== this.calm) {
      // Reduce motion switched while she stands here: her calm (or library) loop takes over with a crossfade
      this.calm = !this.calm;
      if (this.state != null && state === this.state) this.setState(state);
      this.markGlances(this.current);
    }
    if (state !== this.state) this.setState(state);
    if (state === 'attack' && this.attackLeft <= 0 && time - this.lastAttack > 1.1) this.playAttack();
    if (this.attackLeft > 0) {
      this.attackLeft -= dt;
      const base = this.current ? this.actions[this.current] : null;
      if (this.livelyOn) {
        // lively: a dipped base loop (the hurt) comes back over the last 0.3 s, the one-shot fades out over
        // 0.25 s (a layered attack never dipped it, so its base is left alone and keeps any crossfade)
        const bw = this.baseWeight ?? 1;
        if (base && bw < 1 && this.attackLeft <= 0.3) base.setEffectiveWeight(Math.min(1, bw + (1 - bw) * (1 - Math.max(0, this.attackLeft) / 0.3)));
        if (this.attackLeft <= 0) {
          for (const a of this.oneShots) a.fadeOut(ATTACK_LAYER.fadeOut);
          this.baseWeight = 1;
        }
      } else {
        if (this.attackLeft <= 0.2 && base) base.setEffectiveWeight(1);
        if (this.attackLeft <= 0) this.oneShot?.fadeOut(0.12);
      }
    }
    if (this.lively) this.lively.dazeHold = this.attackLeft > 0 && this.oneShotCell === 'hurt';
    this.lively?.restore();
    this.mixer.update(dt);
    this.lively?.apply(time, dt, state, drive);
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
