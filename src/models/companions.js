// Companion figures: Kon (Ruri's holographic fox), Kaze (Hana's falcon drone) and Yoriko's drone
// marionette, as separate GLBs in public/models/companions/ (built by
// tools/blender/companions/build_companions.py; docs/MODELS.md "Companions"). They load and instance
// through the girls' own path (glbChibi.js: GLTFLoader, SkeletonUtils clone, toon ramp + inverted-hull
// outline, AnimationMixer, face cells). The manifest is the contract: `owner` names the girl,
// `home.offset` / `home.follow` place the figure beside her, the clips are idle / move / attack / appear.
// A Meshy file that keeps the contract drops in without code changes.
//
// Display only: nothing here reads or writes the sim.
import * as THREE from 'three';
import { loadCharacter, getCharacter, instantiateCharacter, canLoadCharacters, baseUrl, assetExt } from './glbChibi.js';

let manifestPromise = null;
let manifest = null;
const ownerIndex = new Map(); // girl unit id -> companion id

/** Asset key of a companion for glbChibi's cache (resolves to models/companions/<id>.glb). */
export function companionKey(id) {
  return `../companions/${id}`;
}

/** Reads public/models/companions/manifest.json once (null in node / offline). */
export function loadCompanionManifest() {
  if (!manifestPromise) {
    manifestPromise = canLoadCharacters()
      ? fetch(`${baseUrl()}models/companions/manifest.json${assetExt()}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      : Promise.resolve(null);
    manifestPromise.then((m) => setCompanionManifest(m));
  }
  return manifestPromise;
}

/** Installs a manifest (also used by the node tests). */
export function setCompanionManifest(m) {
  manifest = m && typeof m === 'object' ? m : null;
  ownerIndex.clear();
  if (manifest) for (const [id, e] of Object.entries(manifest)) if (e?.owner) ownerIndex.set(e.owner, id);
}

/** The loaded manifest (null until it arrives). */
export function companionManifest() {
  return manifest;
}

/** Companion id of a girl (by the manifest's `owner`), or null. */
export function companionOf(unitId) {
  return (unitId && ownerIndex.get(unitId)) || null;
}

/** Manifest entry of a companion, or null. */
export function companionEntry(id) {
  return (manifest && manifest[id]) || null;
}

/** Loads a companion GLB ('full' | 'lod'); resolves the asset or null. */
export function loadCompanion(id, detail = 'lod') {
  return loadCharacter(companionKey(id), detail);
}

/** A loaded companion asset at `detail` (exact = false: the other detail when only that one is here). */
export function getCompanion(id, detail = 'lod', exact = false) {
  const a = getCharacter(companionKey(id), detail);
  if (a || exact) return a;
  return getCharacter(companionKey(id), detail === 'full' ? 'lod' : 'full');
}

// ---------------------------------------------------------------------------
// Instances
// ---------------------------------------------------------------------------

let prepassMat = null;

/**
 * One companion figure. userData: animate(time, dt, 'idle'|'move'), playAttack(), playClip('appear'),
 * companionId, height, bar (the doll's thread-top bone or null), dispose().
 * @param {object} asset from loadCompanion / getCompanion
 * @param {{ quality?: string }} [opts]
 */
export function buildCompanion(asset, { quality = 'high' } = {}) {
  const id = asset.extras?.companion || String(asset.id).split('/').pop();
  const g = instantiateCharacter(asset, { id }, { quality });
  g.name = `companion:${id}`;
  g.userData.kind = 'companion';
  g.userData.companionId = id;
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });
  if (asset.extras?.holo) applyHolo(g, asset.extras.holo);
  const th = asset.extras?.threads;
  g.userData.bar = th?.bone ? g.getObjectByName(th.bone) || null : null;
  return g;
}

/**
 * Kon's hologram: body + face a little see-through with a pale-blue lift, after a depth-only pre-pass so only
 * the front surface blends (without it his legs show through his chest).
 */
function applyHolo(g, holo) {
  const opacity = THREE.MathUtils.clamp(holo.opacity ?? 0.88, 0.3, 1);
  const tint = new THREE.Color(holo.tint || '#8fd8ff');
  const meshes = [];
  g.traverse((o) => {
    if (o.isMesh && !o.userData.isOutline && (o.name === 'body' || o.name === 'head')) meshes.push(o);
  });
  if (!prepassMat) {
    prepassMat = new THREE.MeshBasicMaterial({ colorWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 });
    prepassMat.userData.shared = true;
  }
  for (const o of meshes) {
    const src = o.material;
    // shared (cached toon) materials get one holo twin per source material; a per-instance one (the face) is edited
    let m = src;
    if (src.userData?.shared) {
      src.userData.holoTwin ??= (() => {
        const c = src.clone();
        c.userData = { shared: true };
        return c;
      })();
      m = src.userData.holoTwin;
    }
    m.transparent = true;
    m.opacity = opacity;
    if (m.emissive) m.emissive.copy(tint).multiplyScalar(0.18);
    o.material = m;
    o.renderOrder = 2;
    const pre = o.clone();
    pre.material = prepassMat;
    pre.renderOrder = 1;
    pre.name = 'holoDepth';
    pre.userData.isOutline = true;
    if (o.isSkinnedMesh) pre.bind(o.skeleton, o.bindMatrix);
    o.parent.add(pre);
  }
}

// ---------------------------------------------------------------------------
// Home anchor: where the companion sits beside its girl
// ---------------------------------------------------------------------------

const _bonePos = new THREE.Vector3();
const _inv = new THREE.Matrix4();

/**
 * Position of `boneName` in an asset's instance space (its root scaled by unitScale) in the idle pose at t = 0,
 * which is the pose the manifest's home offsets were measured in. Cached on the asset; null when missing.
 */
export function boneAtIdle(asset, boneName) {
  if (!asset || !boneName) return null;
  asset.boneIdle ??= {};
  if (boneName in asset.boneIdle) return asset.boneIdle[boneName];
  const scene = asset.scene;
  const bone = scene.getObjectByName(boneName);
  if (!bone) {
    asset.boneIdle[boneName] = null;
    return null;
  }
  const saved = [];
  scene.traverse((o) => saved.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]));
  const clip = asset.clips?.idle;
  if (clip) {
    const mixer = new THREE.AnimationMixer(scene);
    mixer.clipAction(clip).play();
    mixer.update(0);
    scene.updateMatrixWorld(true);
    _bonePos.setFromMatrixPosition(bone.matrixWorld);
    mixer.stopAllAction();
    mixer.uncacheRoot(scene);
  } else {
    scene.updateMatrixWorld(true);
    _bonePos.setFromMatrixPosition(bone.matrixWorld);
  }
  for (const [o, p, q, s] of saved) {
    o.position.copy(p);
    o.quaternion.copy(q);
    o.scale.copy(s);
  }
  scene.updateMatrixWorld(true);
  const p = _bonePos.clone().multiplyScalar(asset.unitScale || 1);
  asset.boneIdle[boneName] = p;
  return p;
}

/**
 * The companion's home point in its girl's group space: the manifest offset, riding her `follow` bone
 * (the offset is kept from that bone's idle position, so he moves with her shoulder / raised hand).
 * Rebinds itself when her figure changes (procedural placeholder → GLB, a new view).
 */
export class HomeAnchor {
  /** @param {{ home?: { offset?: number[], follow?: string|null } }} entry manifest entry */
  constructor(entry) {
    const off = entry?.home?.offset;
    this.offset = new THREE.Vector3(off?.[0] ?? 0.25, off?.[1] ?? 0, off?.[2] ?? 0.15);
    this.follow = entry?.home?.follow || null;
    this.delta = this.offset.clone();
    this.girl = null;
    this.glb = false;
    this.bone = null;
  }

  /** Points the anchor at a girl's figure (cheap when unchanged). */
  bind(girl) {
    const glb = !!girl?.userData?.glb;
    if (girl === this.girl && glb === this.glb) return;
    this.girl = girl;
    this.glb = glb;
    this.bone = null;
    this.delta.copy(this.offset);
    if (!girl || !glb || !this.follow) return;
    const bone = girl.getObjectByName(this.follow);
    const asset = getCharacter(girl.userData.assetId, girl.userData.detail);
    const rest = bone && asset ? boneAtIdle(asset, this.follow) : null;
    if (!rest) return;
    this.bone = bone;
    this.delta.copy(this.offset).sub(rest);
    girl.updateMatrixWorld(true);
  }

  /**
   * Home point in the girl's group space (uses the last rendered bone matrices, so it lags her pose by one frame).
   * @param {THREE.Vector3} out
   */
  local(out) {
    if (!this.bone || !this.girl) return out.copy(this.offset);
    _inv.copy(this.girl.matrixWorld).invert().multiply(this.bone.matrixWorld);
    return out.setFromMatrixPosition(_inv).add(this.delta);
  }
}

// ---------------------------------------------------------------------------
// Figure viewers (student page): the companion in its home pose beside her
// ---------------------------------------------------------------------------

const _home = new THREE.Vector3();

/**
 * Adds the girl's companion (if she has one) to her figure group at its home spot, idle, riding her follow
 * bone. Wraps the group's animate() and dispose(); safe to call before the files arrive (attaches later).
 * @param {THREE.Group} girl a buildChibi group
 * @param {string} unitId
 * @param {{ quality?: string, detail?: 'full'|'lod' }} [opts]
 */
export function attachCompanionFigure(girl, unitId, { quality = 'high', detail = 'full' } = {}) {
  if (!girl || girl.userData.companionAttached || !canLoadCharacters()) return;
  girl.userData.companionAttached = true;
  let fig = null;
  let gone = false;
  const dispose = girl.userData.dispose;
  girl.userData.dispose = () => {
    gone = true;
    fig?.userData.dispose?.();
    dispose?.();
  };
  loadCompanionManifest().then((m) => {
    const id = m ? companionOf(unitId) : null;
    if (!id || gone) return null;
    return loadCompanion(id, detail).then((asset) => ({ id, asset }));
  }).then((r) => {
    if (!r?.asset || gone) return;
    fig = buildCompanion(r.asset, { quality });
    const anchor = new HomeAnchor(companionEntry(r.id));
    fig.userData.playClip?.('appear');
    const place = () => {
      if (fig.parent !== girl) girl.add(fig);
      anchor.bind(girl);
      anchor.local(_home);
      fig.position.copy(_home);
    };
    place();
    const animate = girl.userData.animate;
    girl.userData.animate = (time, dt, state) => {
      animate?.(time, dt, state);
      place();
      fig.userData.animate?.(time, dt, 'idle');
    };
    const playAttack = girl.userData.playAttack;
    girl.userData.playAttack = () => {
      playAttack?.();
      fig.userData.playAttack?.();
    };
  }).catch(() => {});
}
