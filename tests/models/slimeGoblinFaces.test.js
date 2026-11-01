// Faces that never stretch, blur or look hollow (docs/art/tripo/slime-goblin-faces.md), checked through the game's
// own runtime: the shipped GLBs parsed by three's GLTFLoader, built by glbEnemy.instantiateEnemy, played by its
// AnimationMixer and skinned as the GPU would (SkinnedMesh.applyBoneTransform).
//   * the Green Slime (tools/blender/enemies/build_slime_green.py): its eyes, highlights, mouth and blush are geometry
//     on their own bones; in every clip, sampled finer than its keys, those bones keep a world scale of 1 while the
//     body squashes and stretches, and every face part keeps its shape (its skinned vertices stay rigid); the face is
//     on the front only and untextured; hats still find its crown;
//   * the Goblin Runner (tools/tripo/rerig_tripo_enemy.py add_eyes): geometric glossy eyes with highlights on its head
//     bone over the painted ones; the eye material has no outline, and the outline hull (the one mesh that has one)
//     is the body's, pushed back in depth so it cannot fold out in front of the face (the dark rims round its eyes);
//   * the family meshes keep their hull as it was (no push).
import { describe, it, expect, beforeAll } from 'vitest';
import { statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { prepareEnemyAsset, instantiateEnemy, TRIPO_PAUSED, tripoEnemyKey, OUTLINE_PUSH } from '../../src/models/glbEnemy.js';
import { ENEMY_MAP } from '../../src/data/enemies.js';
import { loadGlb } from './loadGlb.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const enemyDir = path.join(here, '..', '..', 'public', 'models', 'enemies');
const file = (id, lod = false) => path.join(enemyDir, 'tripo', `${id}${lod ? '.lod' : ''}.glb`);
const FACE_BONES = ['eye_L', 'eye_R', 'mouth', 'blush_L', 'blush_R'];

async function build(key, id, quality = 'high', fileName = null) {
  const gltf = await loadGlb(fileName || path.join(enemyDir, `${key}.glb`));
  const asset = prepareEnemyAsset(key, gltf);
  const group = instantiateEnemy(asset, ENEMY_MAP[id], { quality });
  const meshes = [];
  group.traverse((o) => { if (o.isMesh) meshes.push(o); });
  return { asset, group, meshes, face: meshes.find((m) => m.name === 'face'), body: meshes.find((m) => m.name === 'body') };
}

/** Plays one clip alone at time t. */
function pose(group, asset, clip, t) {
  const mixer = group.userData.mixer;
  mixer.stopAllAction();
  const a = mixer.clipAction(asset.clips[clip]);
  a.reset();
  a.setLoop(THREE.LoopRepeat, Infinity);
  a.play();
  mixer.setTime(t);
  group.updateMatrixWorld(true);
}

/** World scale (x, y, z) of a bone relative to the model root (the glb:<key> group, scaled by the file's unitScale). */
function boneScale(group, name) {
  let bone = null;
  let root = null;
  group.traverse((o) => {
    if (o.isBone && o.name === name) bone = o;
    if (!root && o.name?.startsWith('glb:')) root = o;
  });
  const m = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(bone.matrixWorld);
  const s = new THREE.Vector3();
  m.decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
  return s;
}

/** Skinned positions of some vertices of a skinned mesh (its own space, as the GPU draws them). */
function skinnedAt(mesh, idx) {
  const pos = mesh.geometry.attributes.position;
  return idx.map((i) => mesh.applyBoneTransform(i, new THREE.Vector3().fromBufferAttribute(pos, i)));
}

/** Vertex indices of a skinned mesh by the bone that carries them. */
function byBone(mesh) {
  const si = mesh.geometry.attributes.skinIndex;
  const sw = mesh.geometry.attributes.skinWeight;
  const out = {};
  for (let i = 0; i < si.count; i++) {
    let best = 0;
    for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, best)) best = k;
    const name = mesh.skeleton.bones[si.getComponent(i, best)].name;
    (out[name] ||= []).push(i);
  }
  return out;
}

describe('the Green Slime: a face that never stretches', () => {
  for (const lod of [false, true]) {
    const label = lod ? 'light file' : 'full file';
    let s;
    beforeAll(async () => {
      s = await build(`tripo/slime_green${lod ? '.lod' : ''}`, 'slime_green', lod ? 'medium' : 'high');
    });

    it(`${label}: is back on the road, under 1 MB, with its light file`, () => {
      expect(TRIPO_PAUSED).not.toContain('slime_green');
      expect(tripoEnemyKey(ENEMY_MAP.slime_green, 'full')).toBe('tripo/slime_green');
      expect(tripoEnemyKey(ENEMY_MAP.slime_green, 'lod')).toBe('tripo/slime_green.lod');
      expect(statSync(file('slime_green', lod)).size).toBeLessThan(lod ? 160 * 1024 : 1024 * 1024);
      expect(s.asset.extras).toMatchObject({ look: 'jelly', face: 'geometry' });
    });

    it(`${label}: the face is its own untextured vertex-coloured mesh on the front, on five face bones, never outlined`, () => {
      expect(s.face).toBeTruthy();
      expect(s.face.material.map).toBeFalsy();
      expect(s.face.material.vertexColors).toBe(true);
      expect(s.face.material.userData.outline).toBeFalsy();
      expect(s.face.geometry.attributes.uv).toBeUndefined();
      expect(s.group.userData.rigidFace).toBe(true);
      const outlines = s.meshes.filter((m) => m.userData.isOutline);
      expect(outlines).toHaveLength(1);
      expect(outlines[0].geometry).toBe(s.body.geometry);
      expect(Object.keys(byBone(s.face)).sort()).toEqual([...FACE_BONES].sort());
      // every face vertex is on the front half (glTF +z) and wholly on one face bone
      const pos = s.face.geometry.attributes.position;
      const sw = s.face.geometry.attributes.skinWeight;
      for (let i = 0; i < pos.count; i++) {
        expect(pos.getZ(i)).toBeGreaterThan(0);
        expect(Math.max(sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i))).toBeGreaterThan(0.99);
      }
      // dark eyes and white highlights (filled, glossy: no ring)
      const col = s.face.geometry.attributes.color;
      let dark = 0;
      let white = 0;
      for (let i = 0; i < col.count; i++) {
        const l = 0.2126 * col.getX(i) + 0.7152 * col.getY(i) + 0.0722 * col.getZ(i);
        if (l < 0.03) dark++;
        if (l > 0.9) white++;
      }
      expect(dark).toBeGreaterThan(20);
      expect(white).toBeGreaterThan(20);
    });

    it(`${label}: in every clip the face bones keep a world scale of 1 and each part keeps its shape while the body squashes`, () => {
      const parts = byBone(s.face);
      // rest shape of each part: distances from its first vertex to every other one
      pose(s.group, s.asset, 'idle', 0);
      const restSk = {};
      for (const b of FACE_BONES) restSk[b] = skinnedAt(s.face, parts[b]);
      for (const clip of ['move', 'idle', 'hit', 'death', 'special']) {
        const dur = s.asset.clips[clip].duration;
        let bodyLo = Infinity;
        let bodyHi = -Infinity;
        let worst = 0;
        let worstShape = 0;
        for (let t = 0; t <= dur + 1e-6; t += 1 / 120) {
          pose(s.group, s.asset, clip, Math.min(t, dur - 1e-4));
          const bs = boneScale(s.group, 'body');
          bodyLo = Math.min(bodyLo, bs.y);
          bodyHi = Math.max(bodyHi, bs.y);
          for (const b of FACE_BONES) {
            const sc = boneScale(s.group, b);
            worst = Math.max(worst, Math.abs(sc.x - 1), Math.abs(sc.y - 1), Math.abs(sc.z - 1));
            const sk = skinnedAt(s.face, parts[b]);
            const r = restSk[b];
            for (let k = 1; k < sk.length; k += 3) {
              const d0 = r[k].distanceTo(r[0]);
              if (d0 < 1e-3) continue;
              worstShape = Math.max(worstShape, Math.abs(sk[k].distanceTo(sk[0]) - d0) / d0);
            }
          }
        }
        expect(worst, `${clip}: face bone scale off 1 by ${worst}`).toBeLessThan(0.01);
        expect(worstShape, `${clip}: a face part changes shape by ${(worstShape * 100).toFixed(2)} %`).toBeLessThan(0.01);
        // ...while the jelly does squash (the move's landing splat, the hit) and stretch
        if (clip === 'move') {
          expect(bodyLo).toBeLessThan(0.86);
          expect(bodyHi).toBeGreaterThan(1.1);
        }
        if (clip === 'hit') expect(bodyLo).toBeLessThan(0.85);
      }
    });

    it(`${label}: no face part sinks into the jelly or floats off it, between the keys too`, () => {
      // under each (sampled) face vertex, at rest: the body triangle its normal ray hits and where (barycentric);
      // in every pose, the gap from the skinned face vertex to that same point of the skinned body, along the
      // vertex's skinned normal
      pose(s.group, s.asset, 'idle', 0);
      const fp = s.face.geometry.attributes.position;
      const fn = s.face.geometry.attributes.normal;
      const bp = s.body.geometry.attributes.position;
      const idx = s.body.geometry.index;
      const tris = [];
      for (let k = 0; k < idx.count; k += 3) tris.push([idx.getX(k), idx.getX(k + 1), idx.getX(k + 2)]);
      const V = (i) => new THREE.Vector3().fromBufferAttribute(bp, i);
      const probes = [];
      const ray = new THREE.Ray();
      const hit = new THREE.Vector3();
      for (let i = 0; i < fp.count; i += 4) {
        const v = new THREE.Vector3().fromBufferAttribute(fp, i);
        const n = new THREE.Vector3().fromBufferAttribute(fn, i).normalize();
        ray.set(v.clone().addScaledVector(n, 0.05), n.clone().negate());
        let best = null;
        for (const t of tris) {
          const [a, b, c] = t.map(V);
          if (!ray.intersectTriangle(a, b, c, false, hit)) continue;
          const d = hit.distanceTo(ray.origin);
          if (best && best.d <= d) continue;
          const bary = new THREE.Vector3();
          THREE.Triangle.getBarycoord(hit, a, b, c, bary);
          best = { d, t, bary };
        }
        if (best) probes.push({ i, n, ...best });
      }
      expect(probes.length).toBeGreaterThan(fp.count / 8);
      const si = s.face.geometry.attributes.skinIndex;
      const gap = () => probes.map((p) => {
        const v = skinnedAt(s.face, [p.i])[0];
        const [a, b, c] = skinnedAt(s.body, p.t);
        const h = a.multiplyScalar(p.bary.x).addScaledVector(b, p.bary.y).addScaledVector(c, p.bary.z);
        const bone = s.face.skeleton.bones[si.getX(p.i)];
        const m = new THREE.Matrix4().multiplyMatrices(bone.matrixWorld, s.face.skeleton.boneInverses[si.getX(p.i)]);
        const n = p.n.clone().transformDirection(m);
        return v.sub(h).dot(n);
      });
      const rest = gap();
      const unit = 1 / s.asset.unitScale; // stored units per model unit (the build's millimetres are model units)
      for (const clip of ['move', 'idle', 'hit', 'death', 'special']) {
        const dur = s.asset.clips[clip].duration;
        let lo = Infinity;
        let hi = -Infinity;
        for (let t = 0; t <= dur + 1e-6; t += 1 / 120) {
          pose(s.group, s.asset, clip, Math.min(t, dur - 1e-4));
          gap().forEach((g, k) => {
            lo = Math.min(lo, g);
            hi = Math.max(hi, g - rest[k]);
          });
        }
        expect(lo / unit, `${clip}: a face vertex comes within ${(lo / unit * 1000).toFixed(1)} mm of the jelly`).toBeGreaterThan(0.0008);
        expect(hi / unit, `${clip}: a face vertex floats ${(hi / unit * 1000).toFixed(1)} mm further out than at rest`).toBeLessThan(0.006);
      }
    });

    it(`${label}: event hats still ride its crown, above its face`, () => {
      pose(s.group, s.asset, 'idle', 0);
      const hat = new THREE.Object3D();
      expect(s.group.userData.attach(hat, 'head')).toBe(true);
      expect(hat.parent.parent.name).toBe('top');
      s.group.updateMatrixWorld(true);
      const hatAt = new THREE.Vector3().setFromMatrixPosition(hat.matrixWorld);
      let eye = null;
      s.group.traverse((o) => { if (o.isBone && o.name === 'eye_L') eye = o; });
      expect(hatAt.y).toBeGreaterThan(new THREE.Vector3().setFromMatrixPosition(eye.matrixWorld).y);
    });
  }
});

describe('the Goblin Runner: bright eyes, no outline round them', () => {
  for (const lod of [false, true]) {
    const label = lod ? 'light file' : 'full file';
    let g;
    beforeAll(async () => {
      g = await build(`tripo/goblin_runner${lod ? '.lod' : ''}`, 'goblin_runner', lod ? 'medium' : 'high');
    });

    it(`${label}: is back on the road`, () => {
      expect(TRIPO_PAUSED).not.toContain('goblin_runner');
      expect(tripoEnemyKey(ENEMY_MAP.goblin_runner, lod ? 'lod' : 'full')).toBe(`tripo/goblin_runner${lod ? '.lod' : ''}`);
    });

    it(`${label}: the eye material has no outline; the one hull is the body's, pushed back in depth`, () => {
      expect(g.face, 'the eyes').toBeTruthy();
      expect(g.face.material.userData.outline).toBeFalsy();
      expect(g.face.material.map).toBeFalsy();
      const outlines = g.meshes.filter((m) => m.userData.isOutline || m.material?.userData?.outline);
      expect(outlines).toHaveLength(1);
      expect(outlines[0].geometry).toBe(g.body.geometry);
      expect(outlines[0].geometry).not.toBe(g.face.geometry);
      const mat = outlines[0].material;
      expect(mat.userData.push).toBeGreaterThan(0);
      // the shader really pushes the hull back (screen x / y unchanged)
      const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.basic.vertexShader.replace('#include <common>', '#include <common>\nuniform vec3 uMain;'), fragmentShader: THREE.ShaderLib.basic.fragmentShader };
      mat.onBeforeCompile(shader);
      expect(shader.uniforms.outlineZ.value).toBeCloseTo(mat.userData.push);
      expect(shader.vertexShader).toMatch(/mvPosition\.z - olZ/);
    });

    it(`${label}: the eyes are filled and glossy (dark with white highlights), on the head bone, in front of the face`, () => {
      expect(Object.keys(byBone(g.face))).toEqual(['head']);
      const col = g.face.geometry.attributes.color;
      let dark = 0;
      let white = 0;
      for (let i = 0; i < col.count; i++) {
        const l = 0.2126 * col.getX(i) + 0.7152 * col.getY(i) + 0.0722 * col.getZ(i);
        if (l < 0.03) dark++;
        if (l > 0.9) white++;
      }
      expect(dark).toBeGreaterThan(20);
      expect(white).toBeGreaterThan(10);
      // two eyes (the dark vertices), either side of the middle, high on the head; the whole face on its front,
      // above the neck
      const pos = g.face.geometry.attributes.position;
      const box = new THREE.Box3().setFromBufferAttribute(g.body.geometry.attributes.position);
      const H = box.max.y - box.min.y;
      let left = 0;
      let right = 0;
      for (let i = 0; i < pos.count; i++) {
        const h = (pos.getY(i) - box.min.y) / H;
        expect(h).toBeGreaterThan(0.6);
        expect(pos.getZ(i)).toBeGreaterThan(0);
        const l = 0.2126 * col.getX(i) + 0.7152 * col.getY(i) + 0.0722 * col.getZ(i);
        if (l >= 0.03 || col.getZ(i) < col.getX(i)) continue; // (the eyes: dark navy)
        expect(h, 'an eye vertex').toBeGreaterThan(0.75);
        if (pos.getX(i) > 0) left++;
        else right++;
      }
      expect(left).toBeGreaterThan(20);
      expect(right).toBeGreaterThan(20);
    });

    it(`${label}: the face flashes and tints with the body; a hit pops the model evenly (rigidFace)`, () => {
      expect(g.group.userData.rigidFace).toBe(true);
      g.group.userData.hitFlash(null, 1);
      g.group.userData.setStatus({ freeze: 1 });
      g.group.userData.animate(0, 0, { moving: false });
      expect(g.face.material.emissive.equals(g.body.material.emissive)).toBe(true);
      expect(g.face.material.color.equals(g.body.material.color)).toBe(true);
      expect(g.face.material.emissive.r).toBeGreaterThan(0.5);
      g.group.userData.setStatus({});
    });

    it(`${label}: the wide toothy grin is now a small smile with a tongue (review r2 F2)`, () => {
      const pos = g.face.geometry.attributes.position;
      const col = g.face.geometry.attributes.color;
      const box = new THREE.Box3().setFromBufferAttribute(g.body.geometry.attributes.position);
      const W = box.max.x - box.min.x;
      let mouthX = 0;
      let tongue = 0;
      let skin = 0;
      for (let i = 0; i < pos.count; i++) {
        const [r, gg, b] = [col.getX(i), col.getY(i), col.getZ(i)];
        if (r > 0.08 && r > 2 * gg && r > 1.5 * b && r < 0.3) mouthX = Math.max(mouthX, Math.abs(pos.getX(i))); // the berry mouth
        if (r > 0.7 && gg > 0.15 && gg < 0.4 && b > 0.2) tongue++;
        if (gg > r && gg > b && gg > 0.15) skin++; // the green patch over the old grin
      }
      expect(mouthX, 'the smile is narrow').toBeGreaterThan(0);
      expect(mouthX / W, 'under a third of the old grin across (it ran about ±0.12 of the 1 m figure)').toBeLessThan(0.05);
      expect(tongue).toBeGreaterThan(5);
      expect(skin, 'the skin patch over the grin').toBeGreaterThan(40);
    });
  }

  it('at low quality nothing is outlined and the eyes still draw', async () => {
    const g = await build('tripo/goblin_runner.lod', 'goblin_runner', 'low');
    expect(g.meshes.filter((m) => m.userData.isOutline)).toHaveLength(0);
    expect(g.face).toBeTruthy();
  });
});

describe('the hull push is for the textured (Tripo) enemies only', () => {
  it('a family mesh keeps its outline as it was', async () => {
    const gltf = await loadGlb(path.join(enemyDir, 'slime.glb'));
    const asset = prepareEnemyAsset('slime', gltf);
    const group = instantiateEnemy(asset, ENEMY_MAP.slime_gold, { quality: 'high' });
    const outlines = [];
    group.traverse((o) => { if (o.isMesh && o.userData.isOutline) outlines.push(o); });
    expect(outlines.length).toBeGreaterThan(0);
    for (const o of outlines) expect(o.material.userData.push).toBe(0);
  });

  it('every other Tripo enemy gets it too (the creases round the Wolf\'s, Wyvern\'s and Oni\'s eyes)', async () => {
    expect(OUTLINE_PUSH).toBeGreaterThanOrEqual(2);
    for (const id of ['beast_wolf', 'dragon_wyvern', 'oni_brute', 'ghost_wisp']) {
      const g = await build(`tripo/${id}`, id, 'high', file(id));
      const ol = g.meshes.filter((m) => m.userData.isOutline);
      expect(ol.length, id).toBe(1);
      expect(ol[0].material.userData.push, id).toBeGreaterThan(0);
    }
  });
});
