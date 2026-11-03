// Textured Tripo props drawn by the instanced battle layers (display only). Each file is one textured mesh
// (public/models/props/<id>.glb, built by tools/tripo/build_tripo_prop.py: glTF +Y up, +Z front, origin on
// the floor under its centre, game units). Until a file has loaded, or if it fails, the layers keep their
// procedural shapes, so nothing here can stop a battle.
//
//   loadTripoProp('suzu_bell')       // starts the load once; resolves { geometry, material, extras } | null
//   getTripoProp('suzu_bell')        // the loaded prop (synchronous) or null
//   clearTripoProps()                // frees them all (BattleRenderer, when its last instance goes)
//
// Files: norika_barricade (staffFx bars), big_yellow (staffFx walker and plow), suzu_bell (staffFx bells over
// the flat trap rune), norika_hold_line (staffFx Hold the Line barriers, batch 2), seiran_dragon_head (rosterFx's
// sky dragon head, batch 2; its body beads and tail stay procedural). Story landmarks: src/render/tripoLandmarks.js.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { baseUrl, assetExt, canLoadCharacters } from '../models/glbChibi.js';

export const TRIPO_PROPS = Object.freeze(['norika_barricade', 'big_yellow', 'suzu_bell', 'norika_hold_line', 'seiran_dragon_head']);

const loaded = new Map(); // id -> prop | null
const pending = new Map(); // id -> Promise
let gltfLoader = null;

export function tripoPropUrl(id) {
  return `${baseUrl()}models/props/${id}.glb${assetExt()}`;
}

/** The first mesh of a loaded scene as a prop (geometry baked to the file's root space). */
export function propFromScene(root, extras = {}) {
  root.updateMatrixWorld(true);
  let mesh = null;
  root.traverse((o) => {
    if (!mesh && o.isMesh) mesh = o;
  });
  if (!mesh) throw new Error('no mesh');
  const geometry = mesh.geometry.clone();
  geometry.applyMatrix4(mesh.matrixWorld);
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const map = mesh.material?.map || null;
  if (map) map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshLambertMaterial({ map, color: '#ffffff' });
  return { geometry, material, extras };
}

/** Installs a prop without a network (node tests). */
export function setTripoProp(id, prop) {
  loaded.set(id, prop);
  pending.set(id, Promise.resolve(prop));
}

/** Frees every loaded prop (geometry, material, texture); call when the last battle renderer is disposed. */
export function clearTripoProps() {
  for (const prop of loaded.values()) {
    if (!prop) continue;
    prop.geometry?.dispose();
    prop.material?.map?.dispose();
    prop.material?.dispose();
  }
  loaded.clear();
  pending.clear();
}

export function getTripoProp(id) {
  return loaded.get(id) || null;
}

export function loadTripoProp(id) {
  if (pending.has(id)) return pending.get(id);
  if (!canLoadCharacters()) return Promise.resolve(null);
  gltfLoader ??= new GLTFLoader();
  const p = gltfLoader
    .loadAsync(tripoPropUrl(id))
    .then((gltf) => {
      const prop = propFromScene(gltf.scene, gltf.parser?.json?.asset?.extras || {});
      // the clone keeps the prop; the loaded scene's own geometry is not used again
      gltf.scene.traverse((o) => o.geometry?.dispose());
      if (pending.get(id) !== p) {
        // cleared (the last battle closed) while it loaded: drop it, a later battle loads it afresh
        prop.geometry.dispose();
        prop.material.map?.dispose();
        prop.material.dispose();
        return null;
      }
      loaded.set(id, prop);
      return prop;
    })
    .catch((e) => {
      console.warn(`[props] ${id} unavailable, keeping the procedural shape`, e?.message || e);
      if (pending.get(id) === p) loaded.set(id, null);
      return null;
    });
  pending.set(id, p);
  return p;
}
