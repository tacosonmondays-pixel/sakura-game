// Model quality (docs/art/tripo/model-quality.md), checked from the GLB data without WebGL:
//   * the re-rigged Tripo heroes (tools/tripo/rerig_tripo_chibi.py) are not T-posing: their arm bones carry the
//     arms, the idle clip hangs the free arm well below the shoulder line and the skinned mesh follows, and idle
//     really moves (the batch-2 autorig left them with arms on the head / chest bones and a 3-degree idle);
//   * the Green Slime (tools/blender/enemies/build_slime_green.py) is the jelly drop with a squash rig: body + top
//     bones, the 'jelly' look, a hop that squashes and stretches;
//   * the re-rigged batch-2 humanoid enemies (tools/tripo/rerig_tripo_enemy.py, docs/art/tripo/enemy-rigs.md): the
//     mesh of each arm (found by where the arm really is, not by the file's own bones) is skinned to that arm's
//     bones, the hands swing when they walk, the head bone carries only the head (event hats sit on it), a club
//     rides its hand, every clip moves, and the death ends lying down (the batch-2 autorig left their arms on the
//     head, shoulder or thigh bones and some arm bones empty);
//   * all stay inside the phone budgets (each GLB under 1 MB).
import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { ENEMY_ARMS, ENEMY_LODS, armProbes, probe } from './enemyArms.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const charDir = path.join(here, '..', '..', 'public', 'models', 'characters');
const enemyDir = path.join(here, '..', '..', 'public', 'models', 'enemies', 'tripo');

/** Full GLB parse: { json, bin }. */
function readGlb(file) {
  const buf = readFileSync(file);
  let off = 12;
  let json = null;
  let bin = null;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    off += 8;
    if (type === 0x4e4f534a) json = JSON.parse(buf.subarray(off, off + len).toString('utf8'));
    else if (type === 0x004e4942) bin = buf.subarray(off, off + len);
    off += len;
  }
  return { json, bin };
}

const COMP = { 5120: [1, 'getInt8', 127], 5121: [1, 'getUint8', 255], 5122: [2, 'getInt16', 32767], 5123: [2, 'getUint16', 65535], 5125: [4, 'getUint32', 0], 5126: [4, 'getFloat32', 0] };
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

/** An accessor as rows of numbers (normalised integers scaled back). */
function accessor({ json, bin }, i) {
  const a = json.accessors[i];
  const bv = json.bufferViews[a.bufferView];
  const [size, get, norm] = COMP[a.componentType];
  const n = NCOMP[a.type];
  const stride = bv.byteStride || size * n;
  const dv = new DataView(bin.buffer, bin.byteOffset + (bv.byteOffset || 0) + (a.byteOffset || 0));
  const rows = [];
  for (let k = 0; k < a.count; k++) {
    const row = [];
    for (let c = 0; c < n; c++) {
      let v = dv[get](k * stride + c * size, true);
      if (a.normalized && norm) v = Math.max(v / norm, -1);
      row.push(v);
    }
    rows.push(row);
  }
  return rows;
}

/** Node world matrices with one clip sampled at time t (linear keys; rotations nlerped). */
function poseAt(glb, clipName, t) {
  const { json } = glb;
  const local = json.nodes.map((n) => ({
    t: new THREE.Vector3(...(n.translation || [0, 0, 0])),
    r: new THREE.Quaternion(...(n.rotation || [0, 0, 0, 1])),
    s: new THREE.Vector3(...(n.scale || [1, 1, 1])),
  }));
  const anim = clipName ? json.animations.find((a) => a.name === clipName) : null;
  for (const ch of anim?.channels || []) {
    const s = anim.samplers[ch.sampler];
    const times = accessor(glb, s.input).map((r) => r[0]);
    const vals = accessor(glb, s.output);
    let k = 0;
    while (k < times.length - 2 && times[k + 1] < t) k++;
    const f = times.length > 1 ? THREE.MathUtils.clamp((t - times[k]) / Math.max(times[k + 1] - times[k], 1e-6), 0, 1) : 0;
    const a = vals[k];
    const b = vals[Math.min(k + 1, vals.length - 1)];
    const L = local[ch.target.node];
    if (ch.target.path === 'rotation') L.r.set(...a).slerp(new THREE.Quaternion(...b), f).normalize();
    else if (ch.target.path === 'translation') L.t.set(...a.map((x, i) => x + (b[i] - x) * f));
    else if (ch.target.path === 'scale') L.s.set(...a.map((x, i) => x + (b[i] - x) * f));
  }
  const world = new Array(json.nodes.length);
  const visit = (i, parent) => {
    const L = local[i];
    world[i] = parent.clone().multiply(new THREE.Matrix4().compose(L.t, L.r, L.s));
    for (const c of json.nodes[i].children || []) visit(c, world[i]);
  };
  for (const r of json.scenes[0].nodes) visit(r, new THREE.Matrix4());
  return world;
}

function nodeIndex(json, name) {
  return json.nodes.findIndex((n) => n.name === name);
}

/** Angle (degrees) of the shoulder -> hand line under the horizontal: 0 = T-pose, 90 = hanging straight down. */
function armDrop(glb, world, side) {
  const a = new THREE.Vector3().setFromMatrixPosition(world[nodeIndex(glb.json, `upper_arm_${side}`)]);
  const b = new THREE.Vector3().setFromMatrixPosition(world[nodeIndex(glb.json, `hand_${side}`)]);
  return THREE.MathUtils.radToDeg(Math.atan2(a.y - b.y, Math.hypot(b.x - a.x, b.z - a.z)));
}

/** Vertices whose largest skin weight is on one of the named joints. */
function dominantCount(glb, names) {
  const { json } = glb;
  const prim = json.meshes[0].primitives[0];
  const joints = accessor(glb, prim.attributes.JOINTS_0);
  const weights = accessor(glb, prim.attributes.WEIGHTS_0);
  const skinJoints = json.skins[0].joints.map((j) => json.nodes[j].name);
  let n = 0;
  for (let i = 0; i < joints.length; i++) {
    let best = 0;
    for (let k = 1; k < 4; k++) if (weights[i][k] > weights[i][best]) best = k;
    if (names.includes(skinJoints[joints[i][best]])) n++;
  }
  return { n, of: joints.length };
}

/**
 * Linear-blend skinned positions of some vertices (stored frame) for a pose (node world matrices): the mesh as the
 * game draws it, not just its bones.
 */
function skinned(glb, world, idx) {
  const { json } = glb;
  const prim = json.meshes[0].primitives[0];
  const pos = accessor(glb, prim.attributes.POSITION);
  const joints = accessor(glb, prim.attributes.JOINTS_0);
  const weights = accessor(glb, prim.attributes.WEIGHTS_0);
  const skin = json.skins[0];
  const ibm = accessor(glb, skin.inverseBindMatrices).map((m) => new THREE.Matrix4().fromArray(m));
  const jm = skin.joints.map((j, k) => world[j].clone().multiply(ibm[k]));
  return idx.map((i) => {
    const v = new THREE.Vector3(...pos[i]);
    const out = new THREE.Vector3();
    for (let k = 0; k < 4; k++) if (weights[i][k] > 0) out.addScaledVector(v.clone().applyMatrix4(jm[joints[i][k]]), weights[i][k]);
    return out;
  });
}

/**
 * How far the mesh of one arm comes down in a pose: the median drop of the vertices around the upper arm (25-45 %
 * of the way from the shoulder to the hand) and around the hand (85-110 %), as a share of the arm's length. A
 * T-posed figure scores about 0 on both (its arm vertices sit on bones the clips do not lower).
 */
function meshArmDrop(glb, world, side) {
  const rest = poseAt(glb, null, 0);
  const S = new THREE.Vector3().setFromMatrixPosition(rest[nodeIndex(glb.json, `upper_arm_${side}`)]);
  const Hd = new THREE.Vector3().setFromMatrixPosition(rest[nodeIndex(glb.json, `hand_${side}`)]);
  const A = Hd.clone().sub(S);
  const l = A.length();
  const pos = accessor(glb, glb.json.meshes[0].primitives[0].attributes.POSITION);
  const groups = { upper: [], hand: [] };
  pos.forEach((p, i) => {
    const v = new THREE.Vector3(...p).sub(S);
    const t = v.dot(A) / (l * l);
    const d = v.clone().sub(A.clone().multiplyScalar(t)).length();
    if (t >= 0.25 && t <= 0.45 && d < 0.25 * l) groups.upper.push(i);
    if (t >= 0.85 && t <= 1.1 && d < 0.3 * l) groups.hand.push(i);
  });
  const out = {};
  for (const [g, idx] of Object.entries(groups)) {
    const a = skinned(glb, rest, idx);
    const b = skinned(glb, world, idx);
    const drops = a.map((v, k) => (v.y - b[k].y) / l).sort((x, y) => x - y);
    out[g] = drops.length ? drops[Math.floor(drops.length / 2)] : 0;
  }
  return out;
}

// the arm(s) that hang free in idle; the other holds her staff / trident / control bar at grip height
const HEROES = { luna: ['L'], nami: ['R'], kanna: ['L', 'R'], yoriko: ['R'] };

describe('re-rigged Tripo heroes: no T-pose', () => {
  for (const [id, free] of Object.entries(HEROES)) {
    for (const detail of ['full', 'lod']) {
      const file = path.join(charDir, `${id}${detail === 'lod' ? '.lod' : ''}.glb`);
      it(`${id} ${detail}: arm bones carry the arms, the idle hangs the free arm, every clip moves`, () => {
        expect(statSync(file).size).toBeLessThan(1024 * 1024);
        const glb = readGlb(file);
        expect(glb.json.asset.extras.generator).toBe('tools/tripo/rerig_tripo_chibi.py');
        // each arm's bones dominate a real share of the mesh (the batch-2 Nami: her left forearm and hand had none)
        for (const side of ['L', 'R']) {
          const { n, of } = dominantCount(glb, [`upper_arm_${side}`, `forearm_${side}`, `hand_${side}`]);
          expect(n / of, `${id} ${side} arm share`).toBeGreaterThan(0.01);
        }
        // the rest pose is the T-pose; the idle brings the free arm(s) well down at every moment of the loop
        const rest = poseAt(glb, null, 0);
        for (const side of ['L', 'R']) expect(Math.abs(armDrop(glb, rest, side)), `${id} rest ${side}`).toBeLessThan(15);
        const idle = glb.json.animations.find((a) => a.name === 'idle');
        const dur = Math.max(...idle.samplers.map((s) => glb.json.accessors[s.input].max[0]));
        for (const t of [0, dur * 0.25, dur * 0.5, dur * 0.75]) {
          const w = poseAt(glb, 'idle', t);
          for (const side of free) expect(armDrop(glb, w, side), `${id} idle ${side} bones at ${t.toFixed(2)} s`).toBeGreaterThan(50);
        }
        // ...and the mesh follows: the upper arm and the hand of each free arm come well down (the batch-2 files:
        // Luna's arms were on her head and chest bones, Kanna's upper arms on her unanimated shoulder bones)
        const w0 = poseAt(glb, 'idle', 0);
        for (const side of free) {
          const m = meshArmDrop(glb, w0, side);
          expect(m.upper, `${id} idle ${side} upper-arm mesh drop`).toBeGreaterThan(0.08);
          expect(m.hand, `${id} idle ${side} hand mesh drop`).toBeGreaterThan(0.4);
        }
        // every clip moves a hand or the head by a visible amount (the batch-2 idle: about 1 % of her height)
        const H = glb.json.asset.extras.height / glb.json.asset.extras.unitScale;
        for (const a of glb.json.animations) {
          const d = Math.max(...a.samplers.map((s) => glb.json.accessors[s.input].max[0]));
          const probe = ['hand_L', 'hand_R', 'head'].map((n) => nodeIndex(glb.json, n));
          let range = 0;
          const first = poseAt(glb, a.name, 0);
          for (let k = 1; k <= 6; k++) {
            const w = poseAt(glb, a.name, (d * k) / 6);
            for (const i of probe) range = Math.max(range, new THREE.Vector3().setFromMatrixPosition(w[i]).distanceTo(new THREE.Vector3().setFromMatrixPosition(first[i])));
          }
          expect(range / H, `${id} ${a.name} motion`).toBeGreaterThan(a.name === 'idle' ? 0.02 : 0.05);
        }
      });
    }
  }
});

describe('the Green Slime: glossy jelly drop with a squash-and-stretch hop', () => {
  for (const detail of ['full', 'lod']) {
    const file = path.join(enemyDir, `slime_green${detail === 'lod' ? '.lod' : ''}.glb`);
    it(`${detail}: jelly look, body + top squash rig, the hop squashes, stretches and leaves the ground`, () => {
      expect(statSync(file).size).toBeLessThan(160 * 1024);
      const glb = readGlb(file);
      const { json } = glb;
      expect(json.asset.extras).toMatchObject({ id: 'slime_green', look: 'jelly', kind: 'blob', style: 'textured' });
      const joints = json.skins[0].joints.map((j) => json.nodes[j].name);
      expect(joints).toEqual(expect.arrayContaining(['root', 'body', 'top']));
      const body = nodeIndex(json, 'body');
      const move = json.animations.find((a) => a.name === 'move');
      let lo = Infinity;
      let hi = -Infinity;
      let lift = 0;
      const rest = poseAt(glb, null, 0);
      const y0 = new THREE.Vector3().setFromMatrixPosition(rest[body]).y;
      for (let k = 0; k <= 30; k++) {
        const w = poseAt(glb, 'move', k / 30);
        const s = new THREE.Vector3();
        w[body].decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
        lo = Math.min(lo, s.y);
        hi = Math.max(hi, s.y);
        lift = Math.max(lift, new THREE.Vector3().setFromMatrixPosition(w[body]).y - y0);
      }
      expect(move).toBeDefined();
      expect(lo).toBeLessThan(0.85); // squash on take-off and landing
      expect(hi).toBeGreaterThan(1.12); // stretch in the air
      expect(lift / (json.asset.extras.height / json.asset.extras.unitScale)).toBeGreaterThan(0.12); // a real hop
    });
  }
});

// ---- the batch-2 humanoid enemies --------------------------------------------------------------------------------
// (where their arms really are, the mesh rather than the file's bones: tests/models/enemyArms.js)

/** The stored mesh in the enemy's 1 m frame ([x its left, y its back, z up] per vertex). */
function frame1m(glb) {
  const k = glb.json.asset.extras.height / glb.json.asset.extras.unitScale;
  return accessor(glb, glb.json.meshes[0].primitives[0].attributes.POSITION).map(([x, y, z]) => [x / k, -z / k, y / k]);
}

/** Name of the bone with the largest weight on each vertex. */
function dominantNames(glb) {
  const { json } = glb;
  const prim = json.meshes[0].primitives[0];
  const joints = accessor(glb, prim.attributes.JOINTS_0);
  const weights = accessor(glb, prim.attributes.WEIGHTS_0);
  const names = json.skins[0].joints.map((j) => json.nodes[j].name);
  return joints.map((jt, i) => {
    let best = 0;
    for (let k = 1; k < 4; k++) if (weights[i][k] > weights[i][best]) best = k;
    return names[jt[best]];
  });
}

const clipLength = (json, name) => {
  const a = json.animations.find((x) => x.name === name);
  return Math.max(...a.samplers.map((s) => json.accessors[s.input].max[0]));
};

describe('re-rigged batch-2 enemies: arms on arm bones, hands that swing, a head that is a head', () => {
  for (const [id, spec] of Object.entries(ENEMY_ARMS)) {
    for (const detail of ENEMY_LODS.has(id) ? ['full', 'lod'] : ['full']) {
      const file = path.join(enemyDir, `${id}${detail === 'lod' ? '.lod' : ''}.glb`);
      it(`${id} ${detail}`, () => {
        expect(statSync(file).size).toBeLessThan(1024 * 1024);
        const glb = readGlb(file);
        const { json } = glb;
        expect(json.asset.extras).toMatchObject({ id, generator: 'tools/tripo/rerig_tripo_enemy.py', kind: 'humanoid' });
        const P = frame1m(glb);
        const dom = dominantNames(glb);
        const H = json.asset.extras.height / json.asset.extras.unitScale;
        const rest = poseAt(glb, null, 0);
        for (const side of ['L', 'R']) {
          const chain = new RegExp(`^(shoulder|upper_arm|forearm|hand)_${side}$`);
          // the upper arm, the forearm and the hand of the real arm are each skinned to this arm's bones (the batch-2
          // files: the Orc's and Oni's arms on the head bone, the Daimyo's on the thighs, the upper arms of the
          // Goblin, Bonewalker, Skink, Colossus and Titan on the head)
          const probes = armProbes(spec, side);
          for (const [part, at] of Object.entries(probes)) {
            const idx = probe(P, at, spec.r);
            expect(idx.length, `${id} ${side} ${part}: vertices found`).toBeGreaterThan(3);
            const on = idx.filter((i) => chain.test(dom[i])).length / idx.length;
            expect(on, `${id} ${side} ${part}: share on the ${side} arm bones`).toBeGreaterThan(0.6);
          }
          // ...and the hand swings when it walks: the hand's skinned vertices travel over the move clip
          const hand = probe(P, probes.hand, spec.r);
          const a = skinned(glb, rest, hand);
          const dur = clipLength(json, 'move');
          let travel = 0;
          for (let k = 1; k <= 8; k++) {
            const b = skinned(glb, poseAt(glb, 'move', (dur * k) / 8), hand);
            const d = a.map((v, i) => v.distanceTo(b[i])).sort((x, y) => x - y);
            travel = Math.max(travel, d[Math.floor(d.length / 2)]);
          }
          expect(travel / H, `${id} ${side} hand swing in move`).toBeGreaterThan(0.025);
        }
        // the head bone carries the head and nothing below the neck (event hats and the head slot sit on it)
        const headZ = P.filter((_, i) => dom[i] === 'head').map((p) => p[2]).sort((x, y) => x - y);
        expect(headZ.length).toBeGreaterThan(20);
        expect(headZ[Math.floor(headZ.length * 0.05)], `${id} head bone's lowest vertices`).toBeGreaterThan(spec.neck - 0.05);
        // a club rides its hand
        if (spec.club) {
          const idx = P.map((_, i) => i).filter((i) => Math.hypot(...P[i].map((v, c) => v - spec.club.at[c])) < 0.1);
          expect(idx.length).toBeGreaterThan(3);
          expect(idx.filter((i) => dom[i] === spec.club.bone).length / idx.length, `${id} club on ${spec.club.bone}`).toBeGreaterThan(0.9);
        }
        // every clip moves the mesh (the batch-2 idle moved the arms by about 1 % of the height)
        const all = P.map((_, i) => i).filter((i) => i % 7 === 0);
        const base = skinned(glb, rest, all);
        for (const a of json.animations) {
          const d = clipLength(json, a.name);
          let mx = 0;
          for (let k = 0; k <= 6; k++) {
            const w = skinned(glb, poseAt(glb, a.name, (d * k) / 6), all);
            for (let i = 0; i < w.length; i++) mx = Math.max(mx, w[i].distanceTo(base[i]));
          }
          expect(mx / H, `${id} ${a.name} motion`).toBeGreaterThan(a.name === 'idle' ? 0.02 : 0.06);
        }
        // the death ends lying down (its head near the floor; the battle then shrinks and fades it)
        const head = nodeIndex(json, 'head');
        const end = poseAt(glb, 'death', clipLength(json, 'death'));
        const y0 = new THREE.Vector3().setFromMatrixPosition(rest[head]).y;
        expect(new THREE.Vector3().setFromMatrixPosition(end[head]).y / y0, `${id} death ends lying`).toBeLessThan(0.45);
      });
    }
  }
});
