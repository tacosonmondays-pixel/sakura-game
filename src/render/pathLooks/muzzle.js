// Path looks: does a piece stand between the battle camera and a girl's weapon-tip muzzle? (e2e / review check;
// docs/specs/path-looks.md §7). Display only, used by BattleRenderer.pathLooksMuzzleBlocked.
import * as THREE from 'three';

/** Is this object, or any of its ancestors up to `stop`, a path-look node? */
export function inPathLook(o, stop = null) {
  for (let n = o; n && n !== stop; n = n.parent) if (typeof n.name === 'string' && n.name.startsWith('pathLook')) return true;
  return false;
}

/**
 * @param {{ model: THREE.Object3D, holders: THREE.Object3D[], muzzle: THREE.Vector3, camera: THREE.Camera }} o
 *   model: her figure group; holders: what her pieces hang from (the merged group, its holder bones); muzzle: world point
 * @returns {false|'hidden'|string} false: no piece on the camera ray; 'hidden': a piece is on it but her own figure
 *   (never a piece) already hides the tip; else the blocking pieces' names
 */
export function muzzleBlocked({ model, holders, muzzle, camera }) {
  const pieces = [];
  for (const h of holders || []) {
    h.traverse((o) => {
      if (!o.isMesh || o.userData.isOutline) return;
      if (o.isSkinnedMesh) o.boundingSphere = null; // posed as drawn this frame
      pieces.push(o);
    });
  }
  if (!pieces.length) return false;
  const p = new THREE.Vector3().copy(muzzle);
  const ray = new THREE.Raycaster();
  const ndc = p.clone().project(camera);
  ray.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  const dist = ray.ray.origin.distanceTo(p);
  const hit = ray.intersectObjects(pieces, false).find((h) => h.distance < dist - 0.005);
  if (!hit) return false;
  // her own figure: every mesh of the model that is not a piece (review r4: the merged meshes are named pathLookMesh /
  // pathLookHull AND anything under a pathLook node is skipped, so a piece can never count as her figure)
  const pieceSet = new Set(pieces);
  const body = [];
  model.traverse((o) => {
    if (!o.isMesh || o.userData.isOutline || pieceSet.has(o) || inPathLook(o, model.parent)) return;
    if (o.isSkinnedMesh) o.boundingSphere = null;
    body.push(o);
  });
  if (ray.intersectObjects(body, false).some((h) => h.distance < dist - 0.005)) return 'hidden';
  let o = hit.object;
  while (o && !o.userData.pieces) o = o.parent;
  return o ? o.userData.pieces.join('+') : 'piece';
}
