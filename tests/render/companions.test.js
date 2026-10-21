// Companion actors (src/render/companionLogic.js rules, src/models/companions.js contract helpers).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  konState, konStep, konSpot, konAttacks, KON_SPEED, KON_SELF, sortieState, startSortie, sortieStep, retarget, reconcile,
  SWOOP_TIME, DASH_TIME, DASH_REACH, DASH_STOP,
} from '../../src/render/companionLogic.js';
import { setCompanionManifest, companionOf, companionEntry, HomeAnchor, boneAtIdle } from '../../src/models/companions.js';

const run = (s, secs, homeX, homeZ, spot, dt = 1 / 60) => {
  for (let t = 0; t < secs; t += dt) konStep(s, dt, homeX, homeZ, spot);
  return s;
};

describe('Kon: home → travel → at his spot', () => {
  it('sits by Ruri while her relay origin is her own spot', () => {
    const t = { x: 5, y: 5, ox: 5.1, oy: 5, origin: { x: 5.1, y: 5 } };
    expect(konSpot(t, { x: 0, z: 0 })).toBe(null);
    const s = run(konState(), 1, 5.3, 5.2, konSpot(t, { x: 0, z: 0 }));
    expect(s.mode).toBe('home');
    expect([s.x, s.z]).toEqual([5.3, 5.2]);
    expect(konAttacks(s)).toBe(false);
    // no origin at all (not a relay girl yet): home too
    expect(konSpot({ x: 1, y: 1, ox: 4, oy: 4, origin: null }, { x: 0, z: 0 })).toBe(null);
    expect(KON_SELF).toBeGreaterThan(0);
  });

  it('appears by her, then runs along the ground to the relay origin and sits there', () => {
    const t = { x: 2, y: 2, ox: 4, oy: 2, origin: { x: 4, y: 2 } };
    const spot = konSpot(t, { x: 0, z: 0 });
    expect(spot).toEqual({ x: 4, z: 2 });
    const s = konState();
    s.hold = 0.5;
    run(s, 0.4, 2.2, 2.1, spot);
    expect(s.mode).toBe('home'); // the appear clip plays by Ruri first
    run(s, 0.2, 2.2, 2.1, spot);
    expect(s.mode).toBe('travel');
    expect(s.x).toBeGreaterThan(2.2);
    expect(s.x).toBeLessThan(4);
    expect(s.dx).toBeGreaterThan(0); // he faces where he runs
    expect(konAttacks(s)).toBe(false); // busy running: Ruri's bolts do not play his attack
    run(s, (1.8 / KON_SPEED) + 0.2, 2.2, 2.1, spot);
    expect(s.mode).toBe('spot');
    expect([s.x, s.z]).toEqual([4, 2]);
    expect(konAttacks(s)).toBe(true);
  });

  it('runs to a new spot when the origin moves and back to her when it goes away', () => {
    const s = konState();
    run(s, 3, 1, 1, { x: 3, z: 1 });
    expect(s.mode).toBe('spot');
    konStep(s, 1 / 60, 1, 1, { x: 3.6, z: 1 });
    expect(s.mode).toBe('travel');
    run(s, 1, 1, 1, { x: 3.6, z: 1 });
    expect([s.mode, s.x]).toEqual(['spot', 3.6]);
    konStep(s, 1 / 60, 1, 1, null);
    expect(s.mode).toBe('travel');
    run(s, 2, 1, 1, null);
    expect([s.mode, s.x, s.z]).toEqual(['home', 1, 1]);
    // at home he follows her home point exactly
    konStep(s, 1 / 60, 1.5, 0.8, null);
    expect([s.x, s.z]).toEqual([1.5, 0.8]);
  });
});

describe('Kaze swoop / doll dash', () => {
  it('one sortie in flight: attacks while busy are skipped, the next one starts after it lands', () => {
    const s = sortieState();
    expect(startSortie(s, 3, 0.4, 0, SWOOP_TIME, 7)).toBe(true);
    expect(startSortie(s, -3, 0.4, 0, SWOOP_TIME, 8)).toBe(false);
    expect(s.uid).toBe(7);
    const out = {};
    let far = 0;
    let sawOut = false;
    for (let t = 0; t < SWOOP_TIME - 0.02; t += 1 / 60) {
      sortieStep(s, 1 / 60, 0, 0.6, 0, out);
      far = Math.max(far, out.x);
      sawOut ||= out.out;
    }
    expect(s.busy).toBe(true);
    expect(far).toBeGreaterThan(2.9); // reached the target
    expect(sawOut).toBe(true);
    sortieStep(s, 0.05, 0, 0.6, 0, out);
    expect(s.busy).toBe(false); // back on the shoulder
    expect([out.x, out.y, out.z]).toEqual([0, 0.6, 0]);
    expect(startSortie(s, -3, 0.4, 0, SWOOP_TIME, 8)).toBe(true);
  });

  it('follows a moving target while in flight', () => {
    const s = sortieState();
    startSortie(s, 2, 0.3, 0, SWOOP_TIME, 1);
    retarget(s, 2, 0.3, 1.5);
    const out = {};
    sortieStep(s, SWOOP_TIME / 2, 0, 0.5, 0, out);
    expect(out.z).toBeGreaterThan(1.4);
  });

  it('the doll dashes at most DASH_REACH and stops short of the target', () => {
    const s = sortieState();
    startSortie(s, 5, 0.3, 0, DASH_TIME);
    const out = {};
    let far = 0;
    for (let t = 0; t < DASH_TIME; t += 1 / 120) far = Math.max(far, sortieStep(s, 1 / 120, 0, 0.3, 0, out, { reach: DASH_REACH, stop: DASH_STOP, lift: 0.1 }).x);
    expect(far).toBeLessThanOrEqual(DASH_REACH + 1e-6);
    expect(far).toBeGreaterThan(DASH_REACH - 0.05);
    const near = sortieState();
    startSortie(near, 0.6, 0.3, 0, DASH_TIME);
    let reach = 0;
    for (let t = 0; t < DASH_TIME; t += 1 / 120) reach = Math.max(reach, sortieStep(near, 1 / 120, 0, 0.3, 0, out, { reach: DASH_REACH, stop: DASH_STOP }).x);
    expect(reach).toBeLessThanOrEqual(0.6 - DASH_STOP + 1e-6);
  });
});

describe('actors follow the girls on the board', () => {
  it('creates one per girl with a companion, keeps it, drops it when she is sold', () => {
    const of = (u) => ({ ruri: 'kon', hana: 'kaze', yoriko: 'doll' })[u] || null;
    const list = new Map();
    const made = [];
    const dropped = [];
    const make = (t, cid) => (t.unitId === 'hana' && t.loading ? null : (made.push(cid), { uid: t.uid }));
    const drop = (a) => dropped.push(a.uid);
    const towers = [{ uid: 1, unitId: 'ruri' }, { uid: 2, unitId: 'aoi' }, { uid: 3, unitId: 'hana', loading: true }, { uid: 4, unitId: 'yoriko' }, { uid: 5, unitId: 'ruri' }];
    reconcile(list, towers, of, make, drop, 1);
    expect([...list.keys()].sort()).toEqual([1, 4, 5]); // co-op partners' Ruri too; Hana's files still loading
    delete towers[2].loading;
    reconcile(list, towers, of, make, drop, 2);
    expect([...list.keys()].sort()).toEqual([1, 3, 4, 5]);
    expect(made).toEqual(['kon', 'doll', 'kon', 'kaze']);
    // Ruri (uid 1) sold, Yoriko removed
    reconcile(list, towers.filter((t) => t.uid !== 1 && t.uid !== 4), of, make, drop, 3);
    expect([...list.keys()].sort()).toEqual([3, 5]);
    expect(dropped.sort()).toEqual([1, 4]);
    expect(list.get(3).cid).toBe('kaze');
    // a new battle: everything goes
    reconcile(list, [], of, make, drop, 4);
    expect(list.size).toBe(0);
  });
});

describe('the manifest contract', () => {
  const manifest = JSON.parse(readFileSync(new URL('../../public/models/companions/manifest.json', import.meta.url), 'utf8'));

  it('maps each girl to her companion by owner', () => {
    setCompanionManifest(manifest);
    expect(companionOf('ruri')).toBe('kon');
    expect(companionOf('hana')).toBe('kaze');
    expect(companionOf('yoriko')).toBe('doll');
    expect(companionOf('aoi')).toBe(null);
    expect(companionEntry('kaze').home.follow).toBe('shoulder_L');
    setCompanionManifest(null);
    expect(companionOf('ruri')).toBe(null);
  });

  it('home anchor: the offset itself without a follow bone (and on a procedural placeholder)', () => {
    const a = new HomeAnchor(manifest.kon);
    a.bind(new THREE.Group());
    expect(a.local(new THREE.Vector3()).toArray()).toEqual(manifest.kon.home.offset);
    const k = new HomeAnchor(manifest.kaze);
    k.bind(new THREE.Group()); // not a GLB figure: no bone to ride
    expect(k.local(new THREE.Vector3()).toArray()).toEqual(manifest.kaze.home.offset);
  });

  it('measures a bone in the idle pose at t = 0 and leaves the source scene untouched', () => {
    const scene = new THREE.Group();
    const root = new THREE.Bone();
    root.name = 'root';
    const hand = new THREE.Bone();
    hand.name = 'hand_L';
    hand.position.set(0.1, 0.2, 0);
    root.add(hand);
    scene.add(root);
    const clip = new THREE.AnimationClip('idle', 1, [new THREE.VectorKeyframeTrack('hand_L.position', [0, 1], [0.1, 0.4, 0.05, 0.1, 0.5, 0.05])]);
    const asset = { scene, clips: { idle: clip }, unitScale: 2 };
    const p = boneAtIdle(asset, 'hand_L');
    expect(p.toArray().map((v) => +v.toFixed(5))).toEqual([0.2, 0.8, 0.1]);
    expect(hand.position.toArray()).toEqual([0.1, 0.2, 0]);
    expect(boneAtIdle(asset, 'nope')).toBe(null);
  });
});
