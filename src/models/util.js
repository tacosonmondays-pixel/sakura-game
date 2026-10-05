// Disposal and silhouette helpers.
import * as THREE from 'three';

let silhouetteMat = null;
let silhouetteSkinMat = null;

/**
 * In place: every material becomes flat black (bestiary "undiscovered" state). Outlines,
 * glows and faces are hidden so the shape reads as a clean silhouette.
 */
export function makeSilhouette(group) {
  if (!silhouetteMat) {
    silhouetteMat = new THREE.MeshBasicMaterial({ color: '#0b0b12' });
    silhouetteMat.userData.shared = true;
    silhouetteSkinMat = silhouetteMat;
  }
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData.isOutline || o.name === 'face' || o.name === 'haloGlow' || o.userData.fx) {
      o.visible = false;
      return;
    }
    o.userData.originalMaterial = o.userData.originalMaterial || o.material;
    o.material = o.isSkinnedMesh ? silhouetteSkinMat : silhouetteMat;
  });
  group.userData.silhouette = true;
  return group;
}

/** Disposes geometries/materials/textures that are not shared caches. */
export function disposeObject(obj) {
  if (!obj) return;
  obj.userData?.dispose?.();
  obj.traverse((o) => {
    if (o.isMesh || o.isLine || o.isPoints) {
      if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const orig = o.userData?.originalMaterial;
      if (orig) mats.push(orig);
      for (const m of mats) {
        if (!m || m.userData?.shared) continue;
        for (const k of ['map', 'alphaMap', 'emissiveMap']) {
          if (m[k] && !m[k].userData?.shared) m[k].dispose?.();
        }
        m.dispose?.();
      }
    }
  });
  obj.removeFromParent?.();
}
