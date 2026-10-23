// Hana's and Ruri's library idle (the 338 loop that 'Lively figures' plays) seen through the 48° battle camera
// stands like her shipped idle, which the same GLB keeps as `idle_short`. Review round 1: the library idle
// stands with an adult's slouch (lower spine ~19° forward) on bent knees, so at battle scale Ruri's face sank
// under her bangs and both girls read squatter. build_girl.py's posture pass (tools/blender/lively/) puts the
// spine chain's mean pitch and the stance height back to her shipped clip's.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PITCH = (48 * Math.PI) / 180; // the battle camera's look-down
const SCREEN_UP = new THREE.Vector3(0, Math.cos(PITCH), -Math.sin(PITCH));
const TO_CAMERA = new THREE.Vector3(0, Math.sin(PITCH), Math.cos(PITCH));

/** Parses a shipped GLB in node (textures stubbed: only the mesh, skeleton and clips matter here). */
function loadGlb(file) {
  const buf = readFileSync(file);
  const loader = new GLTFLoader();
  loader.register((parser) => {
    parser.loadTextureImage = () => Promise.resolve(new THREE.Texture());
    return { name: 'stubTextures' };
  });
  return new Promise((res, rej) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej));
}

/**
 * Her figure on the battle camera's screen over one clip (sampled at 3 Hz for 8 s), means of:
 * eyes = how far below the top of her figure her eyes sit (× her screen height: higher = face under the hair),
 * height = her screen height (smaller = squatter), face = her face's angle away from the camera (deg).
 */
function onScreen(gltf, clipName) {
  const ex = gltf.parser.json.asset.extras;
  const root = skeletonClone(gltf.scene);
  root.updateMatrixWorld(true);
  const faceName = ex.faceBone === 'neck' ? 'neck' : 'head';
  let face = null;
  let body = null;
  root.traverse((o) => {
    if (!face && o.isBone && o.name === faceName) face = o;
    if (o.isSkinnedMesh && (!body || o.geometry.attributes.position.count > body.geometry.attributes.position.count)) body = o;
  });
  const restInv = face.matrixWorld.clone().invert();
  const restQi = face.getWorldQuaternion(new THREE.Quaternion()).invert();
  const eyes = ex.eyes.centers.map((c) => new THREE.Vector3(...c).applyMatrix4(root.matrixWorld));
  const mixer = new THREE.AnimationMixer(root);
  mixer.clipAction(gltf.animations.find((a) => a.name === clipName)).play();
  const v = new THREE.Vector3();
  const M = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const f = new THREE.Vector3();
  const acc = { eyes: 0, height: 0, face: 0, n: 0 };
  for (let k = 0; k < 8 * 30; k++) {
    mixer.update(k === 0 ? 0 : 1 / 30);
    if (k % 10) continue;
    root.updateMatrixWorld(true);
    let top = -Infinity;
    let bottom = Infinity;
    const pos = body.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 3) {
      const s = body.getVertexPosition(i, v).applyMatrix4(body.matrixWorld).dot(SCREEN_UP);
      top = Math.max(top, s);
      bottom = Math.min(bottom, s);
    }
    M.multiplyMatrices(face.matrixWorld, restInv);
    const eye = eyes.reduce((s, e) => s + e.clone().applyMatrix4(M).dot(SCREEN_UP), 0) / eyes.length;
    acc.eyes += (top - eye) / (top - bottom);
    acc.height += top - bottom;
    face.getWorldQuaternion(q).multiply(restQi);
    acc.face += (f.set(0, 0, 1).applyQuaternion(q).angleTo(TO_CAMERA) * 180) / Math.PI;
    acc.n++;
  }
  return { eyes: acc.eyes / acc.n, height: acc.height / acc.n, face: acc.face / acc.n };
}

describe('library idle posture at the battle camera', () => {
  for (const id of ['ruri', 'hana']) {
    for (const detail of ['', '.lod']) {
      it(`${id}${detail}: eyes, height and face angle match her shipped idle (before the fix: +0.036 to +0.045, 0.91 to 0.93×, +1.7° to +2.7°)`, async () => {
        const gltf = await loadGlb(path.join(here, '..', '..', 'public', 'models', 'characters', `${id}${detail}.glb`));
        const shipped = onScreen(gltf, 'idle_short');
        const lively = onScreen(gltf, 'idle');
        expect(Math.abs(lively.eyes - shipped.eyes)).toBeLessThan(0.02);
        expect(lively.height / shipped.height).toBeGreaterThan(0.95);
        expect(Math.abs(lively.face - shipped.face)).toBeLessThan(1);
      });
    }
  }
});
