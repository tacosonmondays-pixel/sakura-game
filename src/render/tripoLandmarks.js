// Story landmarks as Tripo models (batch 2, display only). A map piece whose type is listed here is placed by
// terrain.js as its own little group (the procedural pieces, as before) instead of being merged into the map's
// batched geometry; when its file (public/models/props/landmarks/<type>.glb, tools/tripo/build_tripo_prop.py)
// arrives, the procedural meshes in that group are hidden and the Tripo mesh stands in their place, fitted into
// their bounding box (by height, never wider than the procedural footprint). Its glow meshes (userData.glow), glow
// sprites and emitters stay, so night and blackout lights keep working.
// Until the file loads, or if it fails, the procedural piece is what you see. (The hammerTear, 3-10's tear in the sky, keeps its
// procedural glow: its pulsing tear is the point of it; its Tripo model is not shipped.)
//
//   landmarkKey(type, variant)        // the file id for a map piece, or null (terrain.js, while placing)
//   attachLandmarks(groups)           // starts the loads, swaps each group in when its file is in; { dispose() }
import * as THREE from 'three';
import { loadTripoProp } from './tripoProps.js';
import { canLoadCharacters } from '../models/glbChibi.js';

/** Map piece type → the variants that get the Tripo model (null: every variant). */
export const TRIPO_LANDMARKS = Object.freeze({
  dryFountain: null,
  oldLamp: null,
  clockTower: null,
  doorieStatue: null,
  lockGate: null,
  greatWillow: null,
  spindle: null,
  finishGantry: null,
  ticketGates: null,
  // the campus's school buildings: only the classroom wing (variant 0) is the Tripo school
  schoolBlock: Object.freeze([0]),
});

/**
 * File id (props/landmarks/<type>) for a placed map piece, or null when it stays procedural. Only where a model can
 * load (a browser): elsewhere (node, the tests) every map is built exactly as before, all pieces merged.
 */
export function landmarkKey(type, variant = 0, canLoad = canLoadCharacters()) {
  if (!canLoad || !Object.prototype.hasOwnProperty.call(TRIPO_LANDMARKS, type)) return null;
  const v = TRIPO_LANDMARKS[type];
  return !v || v.includes(variant) ? `landmarks/${type}` : null;
}

const _box = new THREE.Box3();
const _pb = new THREE.Box3();

/** Puts the Tripo mesh into `group` in place of its procedural meshes (fitted to their bounds). */
export function swapLandmark(group, prop) {
  if (group.userData.tripoLandmark) return group.userData.tripoLandmark;
  _box.makeEmpty();
  let shadow = false;
  // the solid pieces only: the glow meshes (userData.glow, lamps and lit windows) stay on and stay out of the fit
  const procedural = group.children.filter((c) => c.isMesh && !c.userData.glow && c.name !== 'tripo:landmark');
  for (const c of procedural) {
    if (!c.geometry.boundingBox) c.geometry.computeBoundingBox();
    _box.union(c.geometry.boundingBox);
    shadow ||= c.castShadow;
  }
  if (!prop.geometry.boundingBox) prop.geometry.computeBoundingBox();
  _pb.copy(prop.geometry.boundingBox);
  if (_box.isEmpty() || _pb.isEmpty()) return null;
  const h = _box.max.y - _box.min.y;
  const ph = Math.max(1e-6, _pb.max.y - _pb.min.y);
  const foot = Math.max(_box.max.x - _box.min.x, _box.max.z - _box.min.z);
  const pfoot = Math.max(1e-6, _pb.max.x - _pb.min.x, _pb.max.z - _pb.min.z);
  const s = Math.min(h / ph, (foot * 1.1) / pfoot);
  const mesh = new THREE.Mesh(prop.geometry, prop.material);
  mesh.name = 'tripo:landmark';
  mesh.scale.setScalar(s);
  mesh.position.set(
    (_box.min.x + _box.max.x) / 2 - s * (_pb.min.x + _pb.max.x) / 2,
    _box.min.y - s * _pb.min.y,
    (_box.min.z + _box.max.z) / 2 - s * (_pb.min.z + _pb.max.z) / 2,
  );
  mesh.castShadow = shadow;
  for (const c of procedural) c.visible = false;
  group.add(mesh);
  group.userData.tripoLandmark = mesh;
  return mesh;
}

/**
 * Starts loading the Tripo model of every landmark group (group.userData.landmark = its file id) and swaps each
 * group in when its file arrives, unless the map is gone by then.
 */
export function attachLandmarks(groups) {
  let live = true;
  for (const group of groups) {
    const id = group.userData.landmark;
    if (!id) continue;
    loadTripoProp(id).then((prop) => {
      if (live && prop) swapLandmark(group, prop);
    }).catch(() => {});
  }
  return {
    count: groups.length,
    dispose() {
      live = false;
    },
  };
}
