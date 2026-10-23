// The 'Lively figures' animator end to end (glbChibi.instantiateCharacter → GlbAnimator): which clips play
// under Reduce motion (the painted girls' calm *_short clips, also when the setting changes mid-battle), and
// that the companions (Kon, Kaze, Yoriko's doll), which load through the girls' path, keep the plain animator:
// their attacks are whole-body, driven by the hips, and the girls' attack split shrank them to about a third.
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { instantiateCharacter, prepareAsset, splitClipByBody, upperBodyBones, ATTACK_LAYER } from '../../src/models/glbChibi.js';
import { buildCompanion, companionKey } from '../../src/models/companions.js';
import { setFigureOptions } from '../../src/models/figureOptions.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const D2R = Math.PI / 180;

afterEach(() => setFigureOptions({ lively: true, cel: true, flat: true, reduceMotion: false, quality: 'high' }));

/** A small skinned humanoid with the painted girls' clip set (library loops + their old *_short clips). */
function girlGltf(extras = {}) {
  const bones = {};
  const mk = (name, parent, pos) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(...pos);
    if (parent) bones[parent].add(b);
    bones[name] = b;
  };
  mk('root', null, [0, 0, 0]);
  mk('hips', 'root', [0, 0.5, 0]);
  mk('spine', 'hips', [0, 0.1, 0]);
  mk('chest', 'spine', [0, 0.15, 0]);
  mk('neck', 'chest', [0, 0.15, 0]);
  mk('head', 'neck', [0, 0.08, 0]);
  const list = Object.values(bones);
  const geo = new THREE.BoxGeometry(0.3, 0.9, 0.2).translate(0, 0.45, 0);
  const n = geo.attributes.position.count;
  const si = [];
  const sw = [];
  for (let i = 0; i < n; i++) {
    si.push(list.indexOf(geo.attributes.position.getY(i) > 0.6 ? bones.chest : bones.hips), 0, 0, 0);
    sw.push(1, 0, 0, 0);
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial({ name: 'body' }));
  const scene = new THREE.Group();
  scene.add(bones.root, mesh);
  scene.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(list), mesh.matrixWorld);
  const q = (deg) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), deg * D2R).toArray();
  const hold = (name, dur, deg) => new THREE.AnimationClip(name, dur, [new THREE.QuaternionKeyframeTrack('chest.quaternion', [0, dur], [...q(deg), ...q(deg)])]);
  const animations = [
    hold('idle', 7.85, 20), hold('idle_short', 1.5, 2), hold('cheer', 1.85, -30), hold('cheer_short', 1.2, -5),
    hold('hurt', 1.2, 40), hold('hurt_short', 0.4, 10), hold('walk', 0.95, 0),
    new THREE.AnimationClip('attack_smash', 0.6, [
      new THREE.QuaternionKeyframeTrack('chest.quaternion', [0, 0.6], [...q(30), ...q(30)]),
      new THREE.VectorKeyframeTrack('hips.position', [0, 0.3, 0.6], [0, 0.5, 0, 0, 0.5, 0.3, 0, 0.5, 0]),
    ]),
  ];
  return { scene, animations, parser: { json: { asset: { extras: { height: 0.9, ...extras } } } } };
}

/** The clip each action of a figure's mixer plays, with its weight (only the running ones). */
function playing(g) {
  const mixer = g.userData.mixer;
  const out = {};
  for (const a of mixer._actions) if (a.isRunning() && a.getEffectiveWeight() > 0.01) out[a.getClip().name] = +a.getEffectiveWeight().toFixed(2);
  return out;
}

function run(g, from, secs, state) {
  const dt = 1 / 30;
  for (let k = 0; k < Math.round(secs * 30); k++) g.userData.animate(from + k * dt, dt, state);
  return from + secs;
}

describe('the lively animator under Reduce motion', () => {
  it('plays the calm *_short clips: idle, the stun (hurt_short once over idle_short) and victory', () => {
    setFigureOptions({ lively: true, reduceMotion: true });
    const asset = prepareAsset('noa', 'full', girlGltf());
    const g = instantiateCharacter(asset, { id: 'noa' }, { quality: 'low' });
    expect(g.userData.lively).toBe(true);
    let t = run(g, 0, 1, 'idle');
    expect(playing(g)).toEqual({ idle_short: 1 });
    t = run(g, t, 0.15, 'disabled');
    const stun = playing(g);
    expect(stun.hurt_short).toBeGreaterThan(0.5); // the 0.4 s twitch, not the 1.2 s library flinch
    expect(stun.hurt).toBeUndefined();
    expect(stun.idle).toBeUndefined();
    t = run(g, t, 1, 'victory');
    expect(playing(g)).toEqual({ cheer_short: 1 });
    g.userData.dispose();
  });

  it('follows the setting when it changes while she stands there (a 0.3 s crossfade either way)', () => {
    setFigureOptions({ lively: true, reduceMotion: false });
    const g = instantiateCharacter(prepareAsset('noa', 'full', girlGltf()), { id: 'noa' }, { quality: 'low' });
    let t = run(g, 0, 1, 'idle');
    expect(playing(g)).toEqual({ idle: 1 });
    setFigureOptions({ reduceMotion: true });
    t = run(g, t, 0.6, 'idle');
    expect(playing(g)).toEqual({ idle_short: 1 });
    setFigureOptions({ reduceMotion: false });
    t = run(g, t, 0.6, 'idle');
    expect(playing(g)).toEqual({ idle: 1 });
    g.userData.dispose();
  });

  it('Lively figures off keeps today\'s clips whatever Reduce motion says', () => {
    for (const reduceMotion of [false, true]) {
      setFigureOptions({ lively: false, reduceMotion });
      const g = instantiateCharacter(prepareAsset('noa', 'full', girlGltf()), { id: 'noa' }, { quality: 'low' });
      run(g, 0, 1, 'idle');
      expect(playing(g)).toEqual({ idle_short: 1 });
      g.userData.dispose();
    }
  });
});

describe('companions keep the plain animator', () => {
  it('a companion asset (extras.companion) gets no attack split and no Lively animator, even when asked', () => {
    setFigureOptions({ lively: true });
    const kon = prepareAsset(companionKey('kon'), 'lod', girlGltf({ companion: 'kon' }));
    expect(kon.companion).toBe(true);
    expect(kon.attackLayers).toBeNull();
    for (const lively of [null, true]) {
      const g = instantiateCharacter(kon, { id: 'kon' }, { quality: 'low', lively });
      expect(g.userData.lively).toBe(false);
      g.userData.dispose();
    }
    expect(buildCompanion(kon, { quality: 'low' }).userData.lively).toBe(false);
    // a girl from the same file still gets it
    const girl = prepareAsset('noa', 'full', girlGltf());
    expect(girl.companion).toBe(false);
    expect(girl.attackLayers).not.toBeNull();
    expect(instantiateCharacter(girl, { id: 'noa' }, { quality: 'low' }).userData.lively).toBe(true);
  });

  /** Parses a shipped GLB in node (textures stubbed: only the skeleton and clips matter here). */
  async function loadGlb(file) {
    const buf = readFileSync(file);
    const loader = new GLTFLoader();
    loader.register((parser) => {
      parser.loadTextureImage = () => Promise.resolve(new THREE.Texture());
      return { name: 'stubTextures' };
    });
    return new Promise((res, rej) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej));
  }

  /** How far any bone travels from where it stood when the attack started, over the attack (× her height). */
  function reach(root, step, secs, height) {
    root.updateMatrixWorld(true);
    const bones = [];
    root.traverse((o) => { if (o.isBone) bones.push(o); });
    const start = bones.map((b) => b.getWorldPosition(new THREE.Vector3()));
    const p = new THREE.Vector3();
    let max = 0;
    for (let k = 0; k < Math.round(secs * 60); k++) {
      step(1 / 60, k / 60);
      root.updateMatrixWorld(true);
      bones.forEach((b, i) => { max = Math.max(max, b.getWorldPosition(p).distanceTo(start[i])); });
    }
    return max / height;
  }

  for (const id of ['kon', 'doll']) {
    it(`${id}: the shipped attack reaches as far as before Lively figures (not a third of it)`, async () => {
      setFigureOptions({ lively: true, reduceMotion: false });
      const gltf = await loadGlb(path.join(here, '..', '..', 'public', 'models', 'companions', `${id}.lod.glb`));
      const asset = prepareAsset(companionKey(id), 'lod', gltf);
      const dur = asset.clips.attack.duration;
      // the game's figure, through buildCompanion
      const g = buildCompanion(asset, { quality: 'low' });
      run(g, 0, 0.5, 'idle');
      g.userData.playAttack();
      const game = reach(g, (dt, t) => g.userData.animate(0.5 + t, dt, 'idle'), dur, asset.height);
      // the old whole-body one-shot (base loop dipped to 0.25), as shipped before Lively figures
      const oldRoot = skeletonClone(asset.scene);
      const m0 = new THREE.AnimationMixer(oldRoot);
      m0.clipAction(asset.clips.idle).play();
      m0.update(0.5);
      m0.clipAction(asset.clips.idle).setEffectiveWeight(0.25);
      m0.clipAction(asset.clips.attack).setLoop(THREE.LoopOnce, 1).fadeIn(0.06).play();
      const old = reach(oldRoot, (dt) => m0.update(dt), dur, asset.height);
      // the girls' split by body half (what Lively figures gave the companions before this fix)
      const split = splitClipByBody(asset.clips.attack, upperBodyBones(asset.scene));
      const liveRoot = skeletonClone(asset.scene);
      const m1 = new THREE.AnimationMixer(liveRoot);
      m1.clipAction(asset.clips.idle).play();
      m1.update(0.5);
      for (const [c, w] of [[split.upper, ATTACK_LAYER.upper], [split.lower, ATTACK_LAYER.lower]]) m1.clipAction(c).setLoop(THREE.LoopOnce, 1).setEffectiveWeight(w).fadeIn(ATTACK_LAYER.fadeIn).play();
      const layered = reach(liveRoot, (dt) => m1.update(dt), dur, asset.height);
      expect(g.userData.lively).toBe(false);
      expect(game).toBeGreaterThan(old * 0.9);
      expect(game).toBeGreaterThan(layered * 2);
    });
  }
});
