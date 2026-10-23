// 'Lively figures' (livelyRig.js, livelySkirt.js, render/livelyPose.js, the GlbAnimator helpers in
// glbChibi.js) and 'Figure look: Clean cel / Glossy' (celFigure.js). Display only; these guard that the
// layers never drift, that the skirt springs keep the wholesome clamp (hem out ≤ 12°, in ≤ 3°), that the
// runtime skirt bones are invisible at rest, that Reduce motion halves the motion, how the animator picks
// its clips and layers the attack, that the settings are saved, and that none of it reaches the sim.
import { describe, it, expect, afterEach } from 'vitest';
import * as THREE from 'three';
import { LivelyRig, livelyRigInfo, livelyRandom } from '../../src/models/livelyRig.js';
import { addSkirtBones, SKIRT_BONES, SKIRT_DIRS } from '../../src/models/livelySkirt.js';
import { figureOptions, setFigureOptions } from '../../src/models/figureOptions.js';
import { linearToOklab, oklabToLinear, shadeOf } from '../../src/models/celFigure.js';
import { pickStateClip, pickHurtClip, splitClipByBody, upperBodyBones, ATTACK_LAYER, HURT_LAYER } from '../../src/models/glbChibi.js';
import { LivelyPose, LIVELY_LAND } from '../../src/render/livelyPose.js';
import { createProfile, serializeProfile, deserializeProfile } from '../../src/systems/save.js';
import { simId } from '../../tools/simId.mjs';

const D2R = Math.PI / 180;

/** A tiny humanoid (feet at y 0, facing +Z) with a back-hair bone, legs and a flared skirt. */
function figure() {
  const bones = {};
  const mk = (name, parent, pos) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(...pos);
    if (parent) bones[parent].add(b);
    bones[name] = b;
  };
  mk('root', null, [0, 0, 0]);
  mk('hips', 'root', [0, 1, 0]);
  mk('spine', 'hips', [0, 0.1, 0]);
  mk('chest', 'spine', [0, 0.2, 0]);
  mk('neck', 'chest', [0, 0.2, 0]);
  mk('head', 'neck', [0, 0.1, 0]);
  mk('hair_back', 'head', [0, 0, -0.1]);
  mk('shoulder_L', 'chest', [0.1, 0.15, 0]);
  mk('upper_arm_L', 'shoulder_L', [0.1, 0, 0]);
  mk('shoulder_R', 'chest', [-0.1, 0.15, 0]);
  mk('upper_arm_R', 'shoulder_R', [-0.1, 0, 0]);
  for (const [s, x] of [['L', 0.1], ['R', -0.1]]) {
    mk(`thigh_${s}`, 'hips', [x, 0, 0]);
    mk(`shin_${s}`, `thigh_${s}`, [0, -0.5, 0]);
    mk(`foot_${s}`, `shin_${s}`, [0, -0.45, 0]);
  }
  const list = Object.values(bones);
  const idx = (n) => list.indexOf(bones[n]);
  const pos = [];
  const si = [];
  const sw = [];
  const ring = (cx, y, r, bone, n = 10) => {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      pos.push(cx + Math.sin(a) * r, y, Math.cos(a) * r);
      si.push(idx(bone), 0, 0, 0);
      sw.push(1, 0, 0, 0);
    }
  };
  for (const [s, x] of [['L', 0.1], ['R', -0.1]]) {
    for (const y of [0.15, 0.25, 0.35, 0.45]) ring(x, y, 0.04, `shin_${s}`); // calves
    for (const y of [0.6, 0.75, 0.9]) ring(x, y, 0.05, `thigh_${s}`); // thighs
  }
  for (const [y, r] of [[1.0, 0.16], [0.9, 0.19], [0.8, 0.22], [0.7, 0.24], [0.6, 0.26]]) ring(0, y, r, 'hips', 14); // skirt
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
  const scene = new THREE.Group();
  scene.add(bones.root, mesh);
  scene.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(list), mesh.matrixWorld);
  return { scene, mesh, bones };
}

function skinned(mesh) {
  mesh.parent.updateMatrixWorld(true);
  const p = mesh.geometry.attributes.position;
  const out = [];
  for (let i = 0; i < p.count; i++) out.push(mesh.applyBoneTransform(i, new THREE.Vector3().fromBufferAttribute(p, i)));
  return out;
}

afterEach(() => setFigureOptions({ lively: true, cel: true, flat: true, reduceMotion: false, quality: 'high' }));

describe('lively skeleton layer', () => {
  it('adds offsets after the mixer and takes every one of them back before the next update', () => {
    const { scene, bones } = figure();
    const asset = { scene };
    const rig = new LivelyRig(scene, asset, 7);
    expect(rig.ok).toBe(true);
    const names = ['hips', 'spine', 'chest', 'neck', 'head', 'shoulder_L', 'thigh_R', 'hair_back'];
    const before = names.map((n) => bones[n].quaternion.clone());
    let moved = 0;
    for (let k = 0; k < 120; k++) {
      rig.restore(); // (no clip here: nothing writes the bones, as for a bone a clip does not animate)
      rig.apply(0.5 + k / 30, 1 / 30, k > 60 ? 'disabled' : 'idle', { turn: 0.6, engaged: k % 40 < 10, windup: k % 40 > 30 ? 0.8 : 0, fire: Math.floor(k / 40) });
      scene.updateMatrixWorld(true);
      moved = Math.max(moved, bones.head.quaternion.angleTo(before[names.indexOf('head')]));
    }
    expect(moved).toBeGreaterThan(5 * (Math.PI / 180)); // the head really turns (lead + glances)
    rig.restore();
    names.forEach((n, i) => expect(bones[n].quaternion.angleTo(before[i])).toBeLessThan(1e-9));
  });

  it('runs the glances smaller on a clip that looks around by itself (glanceScale) and under Reduce motion', () => {
    const swing = (scale, reduce = false) => {
      setFigureOptions({ reduceMotion: reduce });
      const { scene, bones } = figure();
      const rig = new LivelyRig(scene, { scene }, 11);
      rig.glanceScale = scale;
      const rest = bones.head.quaternion.clone();
      let max = 0;
      for (let k = 0; k < 30 * 30; k++) {
        rig.restore();
        rig.apply(k / 30, 1 / 30, 'idle', null);
        max = Math.max(max, bones.head.quaternion.angleTo(rest));
      }
      return max;
    };
    const full = swing(1);
    expect(swing(0.4)).toBeLessThan(full * 0.75);
    expect(swing(1, true)).toBeLessThan(full * 0.75);
  });

  it('turns a face skinned across neck + head from the neck (extras.faceBone, Hikari): the head bone never shears it', () => {
    const { scene, bones } = figure();
    const rig = new LivelyRig(scene, { scene, extras: { faceBone: 'neck' } }, 5);
    const rest = bones.head.quaternion.clone();
    const neckRest = bones.neck.quaternion.clone();
    let neck = 0;
    for (let k = 0; k < 300; k++) {
      rig.restore();
      rig.apply(k / 30, 1 / 30, k > 150 ? 'disabled' : 'idle', { turn: 0.5, engaged: false, windup: 0, fire: 0 });
      expect(bones.head.quaternion.angleTo(rest)).toBeLessThan(1e-9);
      neck = Math.max(neck, bones.neck.quaternion.angleTo(neckRest));
    }
    expect(neck).toBeGreaterThan(5 * (Math.PI / 180)); // the head's share (turn lead, daze circle) moved to the neck
  });

  it('gives authored bun bones a small, quick bob (clamped at 10°)', () => {
    const { scene, bones } = figure();
    const bun = new THREE.Bone();
    bun.name = 'bun_L';
    bun.position.set(0.08, 0, -0.06);
    bones.head.add(bun);
    scene.updateMatrixWorld(true);
    const ch = livelyRigInfo({ scene }).chains.find((c) => c.names[0] === 'bun_L');
    expect(ch.anchor).toBe('head');
    expect(ch.kind.max).toBeLessThanOrEqual(10);
  });

  it('finds the spring chains a rig already has and skips rigs without a head', () => {
    const { scene } = figure();
    expect(livelyRigInfo({ scene }).chains.map((c) => c.names.join('>'))).toContain('hair_back');
    const bare = new THREE.Group();
    bare.add(new THREE.Bone());
    expect(livelyRigInfo({ scene: bare })).toBeNull();
    expect(new LivelyRig(bare, { scene: bare }, 1).ok).toBe(false);
  });
});

describe('runtime skirt bones', () => {
  it('gives a skirt four bones under the hips and changes nothing at rest', () => {
    const { scene, mesh, bones } = figure();
    const rest = skinned(mesh);
    const added = addSkirtBones(scene);
    expect(added).toEqual(SKIRT_BONES);
    expect(mesh.skeleton.bones.length).toBe(Object.keys(bones).length + 4);
    for (const n of SKIRT_BONES) expect(scene.getObjectByName(n).parent).toBe(bones.hips);
    const after = skinned(mesh);
    after.forEach((v, i) => expect(v.distanceTo(rest[i])).toBeLessThan(1e-5));
    // legs keep their own weights; the hem moves onto the skirt bones, the waistband barely
    const si = mesh.geometry.attributes.skinIndex;
    const sw = mesh.geometry.attributes.skinWeight;
    const base = Object.keys(bones).length;
    const skirtShare = (i) => [0, 1, 2, 3].reduce((s, k) => s + (si.getComponent(i, k) >= base ? sw.getComponent(i, k) : 0), 0);
    expect(skirtShare(0)).toBe(0); // a calf vertex
    const firstSkirt = 2 * 7 * 10; // after the leg rings
    expect(skirtShare(firstSkirt)).toBeLessThan(0.15); // waistband (y 1.0)
    expect(skirtShare(firstSkirt + 4 * 14)).toBeGreaterThan(0.9); // hem (y 0.6)
    // swung, the hem moves and the legs do not
    scene.getObjectByName('lv_skirt_F').rotation.x = -0.2;
    const swung = skinned(mesh);
    expect(swung[firstSkirt + 4 * 14].distanceTo(rest[firstSkirt + 4 * 14])).toBeGreaterThan(0.02);
    expect(swung[0].distanceTo(rest[0])).toBeLessThan(1e-6);
    expect(addSkirtBones(scene)).toEqual(SKIRT_BONES); // once per asset
  });

  it('adds nothing to a figure without a skirt', () => {
    const { scene, mesh, bones } = figure();
    // drop the skirt rings: legs only
    const n = 2 * 7 * 10;
    for (const k of ['position', 'skinIndex', 'skinWeight']) {
      const a = mesh.geometry.attributes[k];
      mesh.geometry.setAttribute(k, new a.constructor(a.array.slice(0, n * a.itemSize), a.itemSize));
    }
    expect(addSkirtBones(scene)).toEqual([]);
    expect(mesh.skeleton.bones.length).toBe(Object.keys(bones).length);
  });
});

describe('skirt springs keep the wholesome clamp', () => {
  /**
   * How far each skirt panel's hem swings away from (+) or toward (−) the legs, in degrees in the figure's
   * frame: the angle of its hem direction out of the vertical plane across that panel (a sideways sway of the
   * panel along the hips does not move it toward the legs and is not counted).
   */
  const hemAngles = (scene) => SKIRT_BONES.map((n, j) => {
    const q = scene.getObjectByName(n).quaternion; // the test figure's bones sit at identity rest
    const v = new THREE.Vector3(0, -1, 0).applyQuaternion(q);
    const u = new THREE.Vector3(SKIRT_DIRS[j][0], 0, SKIRT_DIRS[j][1]);
    return Math.asin(Math.max(-1, Math.min(1, v.dot(u)))) / D2R;
  });

  it('never swings a hem more than 12° out or 3° in, however hard she is shaken (high and medium)', () => {
    for (const quality of ['high', 'medium']) {
      setFigureOptions({ quality, reduceMotion: false });
      const { scene } = figure();
      addSkirtBones(scene);
      const rig = new LivelyRig(scene, { scene }, 3);
      let maxOut = 0;
      let maxIn = 0;
      for (let k = 0; k < 600; k++) {
        // violent shaking: the whole figure jerks around and spins (far beyond anything a battle does)
        const t = k / 60;
        scene.position.set(Math.sin(t * 23) * 0.6, Math.abs(Math.sin(t * 17)) * 0.3, Math.cos(t * 29) * 0.6);
        scene.rotation.y = Math.sin(t * 7) * 3;
        scene.updateMatrixWorld(true);
        rig.restore();
        rig.apply(t, 1 / 60, k % 200 > 150 ? 'disabled' : 'idle', { turn: Math.sin(t * 5), engaged: false, windup: 0, fire: k >> 5 });
        for (const a of hemAngles(scene)) {
          maxOut = Math.max(maxOut, a);
          maxIn = Math.min(maxIn, a);
        }
      }
      expect(maxOut, quality).toBeGreaterThan(6); // it really swings outward
      expect(maxOut, quality).toBeLessThanOrEqual(12 + 1e-6);
      expect(maxIn, quality).toBeGreaterThanOrEqual(-3 - 1e-6);
    }
  });

  it('runs no springs and no breathing on low quality', () => {
    setFigureOptions({ quality: 'low' });
    const { scene } = figure();
    addSkirtBones(scene);
    const rig = new LivelyRig(scene, { scene }, 3);
    for (let k = 0; k < 120; k++) {
      scene.position.x = Math.sin(k) * 0.5;
      scene.updateMatrixWorld(true);
      rig.restore();
      rig.apply(k / 60, 1 / 60, 'idle', null);
      for (const a of hemAngles(scene)) expect(Math.abs(a)).toBeLessThan(1e-9);
    }
  });
});

describe('lively maths', () => {
  it('moves half as much under Reduce motion', () => {
    const range = (reduce) => {
      setFigureOptions({ reduceMotion: reduce, quality: 'high' });
      const { scene, bones } = figure();
      const rig = new LivelyRig(scene, { scene }, 21);
      const rest = bones.spine.quaternion.clone();
      let max = 0;
      for (let k = 0; k < 30 * 40; k++) {
        rig.restore();
        rig.apply(k / 30, 1 / 30, 'idle', { turn: 0, engaged: true, windup: 0, fire: 0 }); // engaged: no glances
        max = Math.max(max, bones.spine.quaternion.angleTo(rest));
      }
      return max;
    };
    const ratio = range(true) / range(false);
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.6);
  });

  it('drops the happy bob under Reduce motion (victory moves exactly like idle there); without it the bob plays', () => {
    const heads = (state, reduce) => {
      setFigureOptions({ reduceMotion: reduce, quality: 'high' });
      const { scene, bones } = figure();
      const rig = new LivelyRig(scene, { scene }, 33);
      const out = [];
      for (let k = 0; k < 30 * 6; k++) {
        rig.restore();
        rig.apply(k / 30, 1 / 30, state, { turn: 0, engaged: true, windup: 0, fire: 0 }); // engaged: no glances
        out.push(bones.head.quaternion.clone());
      }
      return out;
    };
    const diff = (a, b) => Math.max(...a.map((q, i) => q.angleTo(b[i])));
    expect(diff(heads('victory', true), heads('idle', true))).toBeLessThan(1e-6); // (angleTo's own float noise)
    expect(diff(heads('victory', false), heads('idle', false))).toBeGreaterThan(3 * D2R);
  });

  it('says when a placed girl stands at full size (landed, squash settled), so her head can be measured', () => {
    const p = new LivelyPose(3);
    expect(p.settled).toBe(false);
    let landedAt = -1;
    let settledAt = -1;
    for (let k = 0; k < 120; k++) {
      p.update(1 / 60, {});
      if (p.landed && landedAt < 0) landedAt = k;
      if (p.settled && settledAt < 0) settledAt = k;
    }
    expect(landedAt).toBeGreaterThan(0);
    expect(settledAt).toBeGreaterThan(landedAt); // not on the landing frame: the squash first dies down
    expect(settledAt - landedAt).toBeLessThan(40); // within ~0.6 s
    expect(p.settled).toBe(true);
    const r = new LivelyPose(3);
    for (let k = 0; k < 6; k++) r.update(1 / 60, { reduceMotion: true });
    expect(r.settled).toBe(false); // still scaling in
    for (let k = 0; k < 6; k++) r.update(1 / 60, { reduceMotion: true });
    expect(r.settled).toBe(true); // the 0.15 s scale-in is done
  });

  it('seeds a repeatable, uniform random stream (desync of copies)', () => {
    const a = livelyRandom(42);
    const b = livelyRandom(42);
    const xs = Array.from({ length: 2000 }, () => a());
    expect(xs.slice(0, 5)).toEqual(Array.from({ length: 5 }, () => b()));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    expect(xs.reduce((s, x) => s + x, 0) / xs.length).toBeCloseTo(0.5, 1);
  });

  it('drops a placed girl in, squashes her on landing and settles; Reduce motion only scales her in', () => {
    const p = new LivelyPose(5);
    expect(p.dy).toBeCloseTo(LIVELY_LAND.height, 5);
    let minSy = 9;
    let landedAt = -1;
    for (let k = 0; k < 120; k++) {
      p.update(1 / 60, {});
      if (p.landed && landedAt < 0) landedAt = k;
      if (p.landed) minSy = Math.min(minSy, p.sy);
    }
    expect(landedAt).toBeGreaterThan(0);
    expect(p.dy).toBe(0);
    expect(minSy).toBeLessThan(0.9); // the landing squash reads
    expect(Math.abs(p.sy - 1)).toBeLessThan(0.02); // and settles (only the tiny breathing is left)
    const r = new LivelyPose(5);
    let rMin = 9;
    for (let k = 0; k < 120; k++) {
      r.update(1 / 60, { reduceMotion: true });
      expect(r.dy).toBe(0); // no drop
      rMin = Math.min(rMin, r.sy);
    }
    expect(rMin).toBeGreaterThan(0.98);
  });

  it('snaps forward on an attack, half as far under Reduce motion', () => {
    const peak = (reduce) => {
      const p = new LivelyPose(9);
      for (let k = 0; k < 120; k++) p.update(1 / 60, { reduceMotion: reduce }); // landed and settled
      p.fire(reduce);
      let max = 0;
      for (let k = 0; k < 60; k++) {
        p.update(1 / 60, { reduceMotion: reduce });
        max = Math.max(max, p.leanRad);
      }
      return max;
    };
    expect(peak(false)).toBeGreaterThan(2 * D2R);
    expect(peak(true)).toBeLessThan(peak(false) * 0.5);
  });
});

describe('animator', () => {
  const set = (...names) => (n) => names.includes(n);

  it('picks the base loop for each state (lively: the stun is the idle; off: the old *_short clips)', () => {
    const noa = set('idle', 'idle_short', 'cheer', 'cheer_short', 'hurt', 'hurt_short', 'happy', 'walk', 'attack_smash');
    expect(pickStateClip('idle', noa, true)).toBe('idle');
    expect(pickStateClip('attack', noa, true)).toBe('idle');
    expect(pickStateClip('disabled', noa, true)).toBe('idle'); // hurt plays once on top (setState)
    expect(pickStateClip('victory', noa, true)).toBe('cheer'); // imported figures: victory → cheer
    expect(pickStateClip('happy', noa, true)).toBe('happy');
    expect(pickStateClip('idle', noa, false)).toBe('idle_short');
    expect(pickStateClip('disabled', noa, false)).toBe('hurt_short');
    expect(pickStateClip('victory', noa, false)).toBe('cheer_short');
    expect(pickStateClip('move', noa, false)).toBe('idle_short'); // unknown loop: the old idle when off
    expect(pickStateClip('move', noa, true)).toBe('idle');
    const blender = set('idle', 'walk', 'attack_cast', 'cheer', 'victory', 'hurt', 'pickup');
    expect(pickStateClip('victory', blender, true)).toBe('victory');
    expect(pickStateClip('disabled', blender, false)).toBe('hurt');
    expect(pickStateClip('pickup', blender, true)).toBe('pickup');
    expect(pickStateClip('idle', set('walk'), true)).toBeNull();
  });

  it('under Reduce motion (lively on) picks the calm *_short clips and the short hurt twitch', () => {
    const noa = set('idle', 'idle_short', 'cheer', 'cheer_short', 'hurt', 'hurt_short', 'happy', 'walk', 'attack_smash');
    expect(pickStateClip('idle', noa, true, true)).toBe('idle_short');
    expect(pickStateClip('attack', noa, true, true)).toBe('idle_short');
    expect(pickStateClip('disabled', noa, true, true)).toBe('idle_short'); // the stun's base loop
    expect(pickStateClip('victory', noa, true, true)).toBe('cheer_short');
    expect(pickStateClip('cheer', noa, true, true)).toBe('cheer_short');
    expect(pickStateClip('happy', noa, true, true)).toBe('happy'); // no calm twin
    expect(pickHurtClip(noa, true)).toBe('hurt_short');
    expect(pickHurtClip(noa, false)).toBe('hurt');
    // a figure without old clips (the Blender girls) keeps what it has
    const blender = set('idle', 'walk', 'attack_cast', 'cheer', 'victory', 'hurt', 'pickup');
    expect(pickStateClip('idle', blender, true, true)).toBe('idle');
    expect(pickStateClip('victory', blender, true, true)).toBe('victory');
    expect(pickHurtClip(blender, true)).toBe('hurt');
    expect(pickHurtClip(set('idle'), true)).toBeNull();
  });

  it('splits an attack by body half: arms and torso on top, legs mostly keep the base loop', () => {
    const { scene, bones } = figure();
    const upper = upperBodyBones(scene);
    for (const n of ['spine', 'chest', 'neck', 'head', 'hair_back', 'upper_arm_R']) expect(upper.has(n), n).toBe(true);
    for (const n of ['root', 'hips', 'thigh_L', 'shin_R', 'foot_L']) expect(upper.has(n), n).toBe(false);
    const q = (axis, deg) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis), deg * D2R).toArray();
    const hold = (name, quat, dur) => new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, [0, dur], [...quat, ...quat]);
    const idle = new THREE.AnimationClip('idle', 4, [hold('thigh_L', q([1, 0, 0], 10), 4), hold('chest', q([1, 0, 0], 0), 4)]);
    const attack = new THREE.AnimationClip('attack_smash', 0.6, [
      hold('thigh_L', q([1, 0, 0], -30), 0.6), hold('chest', q([1, 0, 0], 40), 0.6),
      new THREE.VectorKeyframeTrack('root.position', [0, 0.6], [0, 0, 0, 0, 0.1, 0]),
    ]);
    const split = splitClipByBody(attack, upper);
    expect(split.upper.tracks.map((t) => t.name)).toEqual(['chest.quaternion']);
    expect(split.lower.tracks.map((t) => t.name).sort()).toEqual(['root.position', 'thigh_L.quaternion']);
    expect(split.upper.duration).toBe(0.6);
    // mixed as GlbAnimator.playLayers does: the base loop at weight 1, the halves at ATTACK_LAYER's weights
    const mixer = new THREE.AnimationMixer(scene);
    mixer.clipAction(idle).play();
    mixer.clipAction(split.upper).setEffectiveWeight(ATTACK_LAYER.upper).play();
    mixer.clipAction(split.lower).setEffectiveWeight(ATTACK_LAYER.lower).play();
    mixer.update(0.3);
    const pitch = (b) => 2 * Math.asin(bones[b].quaternion.x) / D2R;
    expect(pitch('chest')).toBeCloseTo(40 * 0.8, 0); // 80 % attack on top, as the old 0.25 dip gave
    expect(pitch('thigh_L')).toBeCloseTo(10 * 0.75 - 30 * 0.25, 0); // the legs keep 75 % of the base loop
    expect(splitClipByBody(attack, new Set())).toBeNull();
  });

  it('halves the stun flinch under Reduce motion (the base loop keeps its weight under the hurt one-shot)', () => {
    const { scene, bones } = figure();
    const q = (deg) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), deg * D2R).toArray();
    const idle = new THREE.AnimationClip('idle', 4, [new THREE.QuaternionKeyframeTrack('chest.quaternion', [0, 4], [...q(0), ...q(0)])]);
    const hurt = new THREE.AnimationClip('hurt', 1.2, [new THREE.QuaternionKeyframeTrack('chest.quaternion', [0, 1.2], [...q(30), ...q(30)])]);
    const flinch = (baseWeight) => {
      const mixer = new THREE.AnimationMixer(scene);
      mixer.clipAction(idle).setEffectiveWeight(baseWeight).play();
      mixer.clipAction(hurt).play();
      mixer.update(0.5);
      const deg = (2 * Math.asin(bones.chest.quaternion.x)) / D2R;
      mixer.stopAllAction();
      mixer.uncacheRoot(scene);
      return deg;
    };
    const full = flinch(HURT_LAYER.base);
    expect(full).toBeGreaterThan(24);
    expect(flinch(HURT_LAYER.baseReduced) / full).toBeLessThan(0.65);
  });
});

describe('figure options and settings', () => {
  it('reads the saved settings (lively on, clean cel look by default) and keeps them through a save', () => {
    setFigureOptions({ livelyFigures: false, figureLook: 'glossy', reduceMotion: true, quality: 'low' });
    expect(figureOptions()).toMatchObject({ lively: false, cel: false, reduceMotion: true, quality: 'low' });
    setFigureOptions({ figureLook: 'cel' });
    expect(figureOptions().cel).toBe(true);
    const p = createProfile();
    expect(p.settings.livelyFigures).toBe(true);
    expect(p.settings.figureLook).toBe('cel');
    p.settings.livelyFigures = false;
    p.settings.figureLook = 'glossy';
    const back = deserializeProfile(serializeProfile(p));
    expect(back.settings.livelyFigures).toBe(false);
    expect(back.settings.figureLook).toBe('glossy');
    p.settings.figureLook = 'shiny';
    expect(deserializeProfile(serializeProfile(p)).settings.figureLook).toBe('cel');
  });

  it('reads a branch build\'s chosen celFigures: false once as Glossy, and ignores celTextures (an unchosen default)', () => {
    setFigureOptions({ celTextures: false, celFigures: false });
    expect(figureOptions().cel).toBe(true);
    const raw = JSON.parse(JSON.stringify(createProfile()));
    delete raw.settings.figureLook;
    raw.settings.celFigures = false;
    let back = deserializeProfile(JSON.stringify(raw));
    expect(back.settings.figureLook).toBe('glossy');
    expect(back.settings.celFigures).toBeUndefined();
    delete raw.settings.celFigures;
    raw.settings.celTextures = false;
    back = deserializeProfile(JSON.stringify(raw));
    expect(back.settings.figureLook).toBe('cel');
    expect(back.settings.celTextures).toBeUndefined();
  });
});

describe('lockstep', () => {
  it('keeps every figure file out of the co-op graph (display only: the sim id cannot move)', () => {
    const { files } = simId();
    expect(files.length).toBeGreaterThan(20);
    for (const f of ['src/models/livelyRig.js', 'src/models/livelySkirt.js', 'src/models/celFigure.js', 'src/models/figureOptions.js', 'src/models/glbChibi.js', 'src/render/livelyPose.js', 'src/render/actors.js']) {
      expect(files, f).not.toContain(f);
    }
  });
});

describe('cel palette colour maths', () => {
  it('round-trips OKLab and shades darker with the brief hue shifts', () => {
    for (const c of [[0.9, 0.5, 0.2], [0.05, 0.3, 0.8], [0.95, 0.95, 0.95]]) {
      const back = oklabToLinear(...linearToOklab(...c));
      back.forEach((x, i) => expect(x).toBeCloseTo(c[i], 4));
    }
    const white = linearToOklab(0.95, 0.95, 0.95);
    const shadeW = shadeOf(white);
    expect(shadeW[0]).toBeLessThan(white[0]);
    const hue = (Math.atan2(shadeW[2], shadeW[1]) * 180) / Math.PI + 360;
    expect(hue % 360).toBeCloseTo(285, 0); // white cloth shades toward lavender
    const skin = linearToOklab(0.97, 0.79, 0.66);
    expect(shadeOf(skin)[0] / skin[0]).toBeGreaterThan(0.9); // skin barely darkens
  });
});
