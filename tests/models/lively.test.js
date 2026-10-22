// Prototype proto/rig-motion: 'Lively figures' (livelyRig.js, livelySkirt.js) and 'Clean cel
// textures' (celFigure.js). Display only; these guard that the layers never drift, that the runtime
// skirt bones are invisible at rest, and that the settings are saved.
import { describe, it, expect, afterEach } from 'vitest';
import * as THREE from 'three';
import { LivelyRig, livelyRigInfo } from '../../src/models/livelyRig.js';
import { addSkirtBones, SKIRT_BONES } from '../../src/models/livelySkirt.js';
import { figureOptions, setFigureOptions } from '../../src/models/figureOptions.js';
import { linearToOklab, oklabToLinear, shadeOf } from '../../src/models/celFigure.js';
import { createProfile, serializeProfile, deserializeProfile } from '../../src/systems/save.js';

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

describe('figure options and settings', () => {
  it('reads the saved settings (lively on, clean cel on by default) and keeps them through a save', () => {
    setFigureOptions({ livelyFigures: false, celFigures: false, reduceMotion: true, quality: 'low' });
    expect(figureOptions()).toMatchObject({ lively: false, cel: false, reduceMotion: true, quality: 'low' });
    const p = createProfile();
    expect(p.settings.livelyFigures).toBe(true);
    expect(p.settings.celFigures).toBe(true);
    p.settings.livelyFigures = false;
    p.settings.celFigures = false;
    const back = deserializeProfile(serializeProfile(p));
    expect(back.settings.livelyFigures).toBe(false);
    expect(back.settings.celFigures).toBe(false);
  });

  it('ignores the prototype\'s first key celTextures (its stored "off" was a default, not a choice)', () => {
    setFigureOptions({ celTextures: false });
    expect(figureOptions().cel).toBe(true);
    const p = createProfile();
    const raw = JSON.parse(JSON.stringify(p));
    delete raw.settings.celFigures;
    raw.settings.celTextures = false;
    const back = deserializeProfile(JSON.stringify(raw));
    expect(back.settings.celFigures).toBe(true);
    expect(back.settings.celTextures).toBeUndefined();
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
