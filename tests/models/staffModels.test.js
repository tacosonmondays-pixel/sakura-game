// The academy staff heroes rebuilt on the shared chibi pipeline (docs/art/tripo/staff-models.md,
// tools/blender/lib/staff.py), checked from the shipped GLBs through three's own GLTFLoader, AnimationMixer and
// skinning (SkinnedMesh.applyBoneTransform), full and LOD:
//   * Blender builds on the 'staff' profile with every clip the game plays for them;
//   * the proportions the owner asked for: about three heads tall (the Tripo figures were 1.8, a hat swallowing a
//     squat body), legs about a third of the height, a little taller than the girls (Aoi);
//   * the face is clear of the hard hat from the battle camera (48 degrees down, a quarter turn either way): in idle no
//     part of the hat lies on the line of sight to either painted eye;
//   * each prop is rigid on hand_R (weight >= 0.98, what src/models/weaponTip.js looks for) and big enough to read.
import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { loadGlb } from './loadGlb.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '..', '..', 'public', 'models', 'characters');
const STAFF = { norika: 'attack_sign', kogane: 'attack_wrench' };
const CLIPS = ['idle', 'walk', 'cheer', 'victory', 'hurt', 'pickup'];
const DEG = Math.PI / 180;

/** The parsed file with its meshes by material, a skinning helper (game units) and the bones' rest positions. */
async function open(id, lod = false) {
  const gltf = await loadGlb(path.join(dir, `${id}${lod ? '.lod' : ''}.glb`));
  const ex = gltf.parser.json.asset.extras;
  const k = ex.unitScale;
  const meshes = {};
  gltf.scene.traverse((o) => { if (o.isSkinnedMesh) meshes[o.material.name] = o; });
  gltf.scene.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  const skinned = (mesh, i) => {
    v.fromBufferAttribute(mesh.geometry.attributes.position, i);
    mesh.applyBoneTransform(i, v);
    return v.clone().applyMatrix4(mesh.matrixWorld).multiplyScalar(k);
  };
  const boneAt = (name) => {
    let b = null;
    gltf.scene.traverse((o) => { if (o.isBone && o.name === name) b = o; });
    return new THREE.Vector3().setFromMatrixPosition(b.matrixWorld).multiplyScalar(k);
  };
  const pose = (clip, t) => {
    const mixer = new THREE.AnimationMixer(gltf.scene);
    const a = mixer.clipAction(gltf.animations.find((c) => c.name === clip));
    a.play();
    mixer.setTime(t);
    gltf.scene.updateMatrixWorld(true);
  };
  return { gltf, ex, k, meshes, skinned, boneAt, pose };
}

/** Joint index and weight of the strongest influence of vertex i. */
function strongest(mesh, i) {
  const j = mesh.geometry.attributes.skinIndex;
  const w = mesh.geometry.attributes.skinWeight;
  let best = 0;
  let bw = -1;
  for (let c = 0; c < 4; c++) {
    const wc = w.getComponent(i, c);
    if (wc > bw) { bw = wc; best = j.getComponent(i, c); }
  }
  return { bone: mesh.skeleton.bones[best].name, w: bw };
}

describe('the staff heroes (Blender builds to the reference proportions)', () => {
  let aoiTop = 0;
  beforeAll(async () => {
    const aoi = await open('aoi');
    const body = aoi.meshes.body;
    for (let i = 0; i < body.geometry.attributes.position.count; i++) aoiTop = Math.max(aoiTop, aoi.skinned(body, i).y);
  });

  for (const [id, attack] of Object.entries(STAFF)) {
    for (const lod of [false, true]) {
      describe(`${id}${lod ? ' (LOD)' : ''}`, () => {
        let f;
        beforeAll(async () => { f = await open(id, lod); });

        it('is a Blender build on the staff profile with every clip', () => {
          expect(f.ex).toMatchObject({ unit: id, build: 'staff', generator: 'tools/blender/build_characters.py', unitScale: 2, lod });
          const names = f.gltf.animations.map((a) => a.name);
          for (const c of [...CLIPS, attack]) expect(names, c).toContain(c);
          expect(Object.keys(f.meshes).sort()).toEqual(['body', 'halo', 'head']);
        });

        it('stands about three heads tall, legs a third of her height, a little taller than Aoi', () => {
          const body = f.meshes.body;
          let top = 0;
          for (let i = 0; i < body.geometry.attributes.position.count; i++) top = Math.max(top, f.skinned(body, i).y);
          // the build puts the head bone 0.03 above the chin and the crotch 0.025 under the hip joints
          const chin = f.boneAt('head').y - 0.03;
          const crotch = f.boneAt('thigh_L').y - 0.025;
          const heads = top / (top - chin); // to the top of the hard hat (to the hair crown it is ~2.8)
          expect(heads).toBeGreaterThan(2.5);
          expect(heads).toBeLessThan(3.2);
          expect(crotch / top).toBeGreaterThan(0.28);
          expect(top / aoiTop).toBeGreaterThan(1.03);
          expect(top / aoiTop).toBeLessThan(1.15);
        });

        it('keeps the hard hat off her eyes from the battle camera in idle', () => {
          f.pose('idle', 0);
          const face = f.meshes.head;
          const body = f.meshes.body;
          // the painted eyes: the face atlas maps u across the head's width and v from chin to top (eye_v 0.42, eyes
          // 0.195 of the width either side, tools/blender/lib/face.py adult); the nearest front vertex of the face
          const g = face.geometry;
          g.computeBoundingBox();
          const bb = g.boundingBox;
          const eyes = [-1, 1].map((s) => {
            const want = new THREE.Vector3((bb.min.x + bb.max.x) / 2 + s * 0.195 * (bb.max.x - bb.min.x), bb.min.y + 0.42 * (bb.max.y - bb.min.y), bb.max.z);
            let best = -1;
            let bd = Infinity;
            const p = new THREE.Vector3();
            for (let i = 0; i < g.attributes.position.count; i++) {
              p.fromBufferAttribute(g.attributes.position, i);
              const d = p.distanceTo(want);
              if (d < bd) { bd = d; best = i; }
            }
            return f.skinned(face, best);
          });
          // the hat: the head bone's safety-yellow vertices (dome, brim, ridge)
          const col = body.geometry.attributes.color;
          const hat = [];
          for (let i = 0; i < body.geometry.attributes.position.count; i++) {
            if (strongest(body, i).bone !== 'head') continue;
            const r = col.getX(i);
            const gg = col.getY(i);
            const b = col.getZ(i);
            if (r > 0.6 && gg > 0.3 && gg < 0.85 && b < 0.15) hat.push(f.skinned(body, i));
          }
          expect(hat.length).toBeGreaterThan(100);
          let closest = Infinity;
          for (const yaw of [-30, -15, 0, 15, 30]) {
            const d = new THREE.Vector3(Math.sin(yaw * DEG) * Math.cos(48 * DEG), Math.sin(48 * DEG), Math.cos(yaw * DEG) * Math.cos(48 * DEG));
            for (const e of eyes) {
              for (const h of hat) {
                const w = h.clone().sub(e);
                const t = w.dot(d);
                if (t <= 0) continue;
                closest = Math.min(closest, w.sub(d.clone().multiplyScalar(t)).length());
              }
            }
          }
          // nothing of the hat within 2.5 cm of a sight line (the dome's vertex spacing): the brim is well above the eyes
          expect(closest).toBeGreaterThan(0.025);
        });

        it('never flips a limb between keys (sign-continuous rotation keys, no bone turns 45 degrees in 10 ms)', () => {
          // three.js interpolates cubic-spline rotations component by component: two neighbouring keys of opposite sign
          // swing the bone through a near-zero quaternion (the exported legs and tails flipped up to 150 degrees)
          const json = f.gltf.parser.json;
          for (const clip of f.gltf.animations) {
            for (const tr of clip.tracks.filter((t) => t.name.endsWith('.quaternion'))) {
              const v = tr.values;
              const n = tr.times.length;
              for (let k = 1; k < n; k++) {
                // CUBICSPLINE: in-tangent, value, out-tangent per key
                const a = (k - 1) * 12 + 4;
                const b = k * 12 + 4;
                const dot = v[a] * v[b] + v[a + 1] * v[b + 1] + v[a + 2] * v[b + 2] + v[a + 3] * v[b + 3];
                expect(dot, `${clip.name} ${tr.name} key ${k}`).toBeGreaterThan(0);
              }
            }
            const bones = [];
            f.gltf.scene.traverse((o) => { if (o.isBone) bones.push(o); });
            const mixer = new THREE.AnimationMixer(f.gltf.scene);
            mixer.clipAction(clip).play();
            let prev = null;
            let worst = 0;
            const q = new THREE.Quaternion();
            for (let t = 0; t <= clip.duration + 1e-6; t += 0.01) {
              mixer.setTime(t);
              f.gltf.scene.updateMatrixWorld(true);
              const cur = bones.map((bn) => bn.getWorldQuaternion(q).clone());
              if (prev) for (let i = 0; i < cur.length; i++) worst = Math.max(worst, 2 * Math.acos(Math.min(1, Math.abs(cur[i].dot(prev[i])))) / DEG);
              prev = cur;
            }
            expect(worst, `${clip.name}: the fastest bone turns ${worst.toFixed(1)} degrees in 10 ms`).toBeLessThan(45);
          }
          expect(json.animations.length).toBe(7);
        });

        it('her prop and the hat\'s sticker are wound outward (an inside-out part draws as its dark outline in the game)', () => {
          // a part built with a mirrored basis has its faces wound inside out: three culls its face and the outline hull
          // (the back faces of a pushed-out copy) shows instead, a dark disc where the red paddle should be. Each closed
          // piece of the prop (and of Kogane's sticker) must enclose a positive signed volume.
          const body = f.meshes.body;
          const g = body.geometry;
          const pos = g.attributes.position;
          const index = g.index.array;
          const col = g.attributes.color;
          const handRest = new THREE.Vector3().setFromMatrixPosition(body.skeleton.boneInverses[body.skeleton.bones.findIndex((b) => b.name === 'hand_R')].clone().invert());
          const p = new THREE.Vector3();
          const inProp = (i) => {
            const s = strongest(body, i);
            return s.bone === 'hand_R' && s.w >= 0.98 && p.fromBufferAttribute(pos, i).distanceTo(handRest) > 0.12 * f.ex.height / f.k;
          };
          const inSticker = (i) => strongest(body, i).bone === 'head' && col.getX(i) > 0.8 && col.getY(i) > 0.2 && col.getY(i) < 0.5 && col.getZ(i) > 0.3;
          /** Signed volumes of the connected pieces made of triangles whose three corners pass `keep`. */
          const pieces = (keep) => {
            const parent = new Map();
            const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
            const tris = [];
            for (let t = 0; t < index.length; t += 3) {
              const [a, b, c] = [index[t], index[t + 1], index[t + 2]];
              if (!keep(a) || !keep(b) || !keep(c)) continue;
              tris.push([a, b, c]);
              for (const v of [a, b, c]) if (!parent.has(v)) parent.set(v, v);
              parent.set(find(b), find(a));
              parent.set(find(c), find(a));
            }
            const groups = new Map();
            for (const tri of tris) {
              const r = find(tri[0]);
              if (!groups.has(r)) groups.set(r, []);
              groups.get(r).push(tri);
            }
            const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
            return [...groups.values()].filter((ts) => ts.length >= 8).map((ts) => {
              const c = new THREE.Vector3();
              for (const tri of ts) for (const k of tri) c.add(p.fromBufferAttribute(pos, k));
              c.multiplyScalar(1 / (ts.length * 3));
              let vol = 0;
              for (const tri of ts) {
                tri.forEach((k, j) => v[j].fromBufferAttribute(pos, k).sub(c));
                vol += v[0].dot(v[1].clone().cross(v[2]));
              }
              return vol;
            });
          };
          const prop = pieces(inProp);
          expect(prop.length).toBeGreaterThan(0);
          for (const vol of prop) expect(vol, 'each piece of the prop is wound outward').toBeGreaterThan(0);
          if (id === 'kogane') {
            const sticker = pieces(inSticker);
            expect(sticker.length, 'the sakura sticker\'s petals').toBeGreaterThanOrEqual(5);
            for (const vol of sticker) expect(vol, 'each petal is wound outward').toBeGreaterThan(0);
          }
        });

        it('holds her prop rigid in her right hand, big enough to read', () => {
          f.pose('idle', 0);
          const body = f.meshes.body;
          const hand = f.boneAt('hand_R');
          const pts = [];
          for (let i = 0; i < body.geometry.attributes.position.count; i++) {
            const s = strongest(body, i);
            if (s.bone !== 'hand_R' || s.w < 0.98) continue;
            const p = f.skinned(body, i);
            if (p.distanceTo(hand) > 0.12 * f.ex.height) pts.push(p);
          }
          expect(pts.length).toBeGreaterThan(40);
          const box = new THREE.Box3().setFromPoints(pts);
          const size = box.getSize(new THREE.Vector3());
          expect(Math.max(size.x, size.y, size.z)).toBeGreaterThan(0.1);
          // held up in idle (the paddle face, the wrench's jaw): above her hand
          expect(box.max.y).toBeGreaterThan(hand.y + 0.1);
        });
      });
    }
  }
});
