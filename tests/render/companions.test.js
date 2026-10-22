// Companion actors (src/render/companionLogic.js rules, src/models/companions.js contract helpers).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  konState, konStep, konSpot, konAttacks, KON_SPEED, KON_SELF, sortieState, startSortie, sortieStep, retarget, reconcile,
  SWOOP_TIME, DASH_TIME, DASH_REACH, DASH_STOP, KON, konBrain, konBrainStep, konBolt, konPost, konHome, laneDirAt,
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
    // FX-1: he acts on her bolts by her side too (he used to sit through the battle there)
    expect(konAttacks(s)).toBe(true);
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

describe("Kon's intent (FX-1): guard, hop, pounce, patrol, play, pat, rest", () => {
  // Ruri at (5, 5), her relay origin on the road at (5, 3.8); the camera looks from +z (screen down)
  const input = (o = {}) => ({
    px: 5, pz: 3.8, hx: 5.3, hz: 5.3, ox: 5, oz: 3.8, lx: 1, lz: 0, enemy: false, ex: 0, ez: 0, near: false, wave: true, calm: false,
    cooldown: -1, engaged: false, ...o,
  });
  const steps = (b, secs, I, dt = 1 / 60, each = null) => {
    for (let t = 0; t < secs; t += dt) {
      konBrainStep(b, dt, typeof I === 'function' ? I(t) : I);
      each?.(b);
    }
    return b;
  };
  const dist = (b, x, z) => Math.hypot(b.x - x, b.z - z);

  it('guards an enemy in range: crouched, facing it, small side-steps along the lane, never past the leash', () => {
    const b = konBrain(7);
    const I = input({ enemy: true, near: true, ex: 7, ez: 3.8 });
    let maxOff = 0;
    let sideSteps = 0;
    let last = b.side;
    steps(b, 8, I, 1 / 60, (k) => {
      maxOff = Math.max(maxOff, dist(k, 5, 3.8));
      if (k.side !== last) sideSteps++;
      last = k.side;
      expect(dist(k, I.ox, I.oz)).toBeLessThanOrEqual(KON.LEASH + 1e-6);
    });
    expect(b.act).toBe('guard');
    expect(b.sy).toBeLessThan(1); // crouched
    expect(Math.abs(b.yaw - Math.PI / 2)).toBeLessThan(0.1); // facing the enemy at +x
    expect(sideSteps).toBeGreaterThan(1);
    expect(maxOff).toBeLessThanOrEqual(KON.STEP + 1e-6);
  });

  it('a bolt is a real hop toward the target, out and back (0.25 tiles, 0.12 high); every 4th is a big pounce', () => {
    const b = konBrain(3);
    const I = input({ enemy: true, near: true, ex: 6.5, ez: 3.8 });
    steps(b, 0.5, I);
    konBolt(b, 6.5, 3.8);
    let maxH = 0;
    let maxOut = 0;
    steps(b, KON.HOP_T + 0.02, I, 1 / 120, (k) => {
      maxH = Math.max(maxH, k.h);
      maxOut = Math.max(maxOut, k.x - 5);
    });
    expect(maxH).toBeCloseTo(KON.HOP_H, 2);
    expect(maxOut).toBeCloseTo(KON.HOP_OUT, 2);
    expect(b.act).toBe('guard');
    expect(Math.abs(b.x - 5)).toBeLessThan(0.05); // back at his post
    konBolt(b, 6.5, 3.8);
    konBolt(b, 6.5, 3.8);
    konBolt(b, 6.5, 3.8); // the 4th
    expect(b.bbig).toBe(true);
    steps(b, 1 / 60, I);
    expect(b.act).toBe('pounce');
    let ph = 0;
    let pitchMin = 0;
    let pitchMax = 0;
    steps(b, KON.POUNCE_T, I, 1 / 120, (k) => {
      ph = Math.max(ph, k.h);
      pitchMin = Math.min(pitchMin, k.pitch);
      pitchMax = Math.max(pitchMax, k.pitch);
      expect(dist(k, I.ox, I.oz)).toBeLessThanOrEqual(KON.LEASH + 1e-6);
    });
    expect(ph).toBeGreaterThan(0.4);
    expect(pitchMin).toBeLessThan(0); // nose up…
    expect(pitchMax).toBeGreaterThan(0); // …then nose first
    // landing squash, then a trot back to the post
    let squash = 1;
    let trotted = false;
    steps(b, 1.5, I, 1 / 60, (k) => {
      squash = Math.min(squash, k.sy);
      trotted ||= k.act === 'trot';
    });
    expect(squash).toBeLessThan(0.9);
    expect(trotted).toBe(true);
    expect(b.act).toBe('guard');
  });

  it('pre-roll: with Ruri firing, the hop starts from her countdown so its top lands on the shot; the bolt then keeps it', () => {
    const b = konBrain(5);
    const I = input({ enemy: true, near: true, ex: 6.5, ez: 3.8, engaged: true, cooldown: 1 });
    steps(b, 0.3, I);
    expect(b.act).toBe('guard');
    I.cooldown = KON.HOP_T * 0.5;
    steps(b, 1 / 60, I);
    expect(b.act).toBe('hop');
    expect(b.pre).toBe(true);
    // by the time the cooldown reaches 0 he is at the top of the hop
    steps(b, KON.HOP_T * 0.5 - 1 / 60, { ...I, cooldown: 0.01 });
    const top = b.h;
    expect(top).toBeGreaterThan(KON.HOP_H * 0.9);
    konBolt(b, 6.5, 3.8);
    steps(b, 1 / 60, I);
    expect(b.act).toBe('hop'); // not restarted
    expect(b.h).toBeGreaterThan(KON.HOP_H * 0.9);
  });

  it('patrols when nothing is in range for 2 s of a wave (a figure-eight, sniffing), then guards again', () => {
    const b = konBrain(11);
    const I = input({ wave: true });
    let acts = new Set();
    steps(b, 8, I, 1 / 60, (k) => acts.add(k.act));
    expect(acts.has('patrol')).toBe(true);
    expect(acts.has('sniff')).toBe(true);
    expect(dist(b, 5, 3.8)).toBeLessThanOrEqual(KON.LEASH + 1e-6);
    steps(b, 0.1, input({ wave: true, enemy: true, near: true, ex: 6, ez: 3.8 }));
    expect(b.act).toBe('guard');
  });

  it('plays between waves (tail chase, roll, scratch, a pounce at nothing, a pat by Ruri with a heart), then naps after 20 s', () => {
    const b = konBrain(2);
    const I = input({ wave: false });
    const subs = new Set();
    let heart = false;
    let rested = false;
    let nearRuri = false;
    steps(b, 40, I, 1 / 30, (k) => {
      if (k.act === 'play') subs.add(k.sub);
      heart ||= k.heart;
      if (k.act === 'rest') rested = true;
      if (dist(k, 5.3, 5.3) < 0.05) nearRuri = true;
    });
    expect(subs.size).toBeGreaterThan(2);
    expect(rested).toBe(true);
    expect(b.sleep).toBe(true);
    expect(nearRuri).toBe(true); // he naps (and is patted) beside her, on the camera side
    // seeded: the same uid plays the same way
    const c = konBrain(2);
    const subs2 = new Set();
    steps(c, 40, I, 1 / 30, (k) => k.act === 'play' && subs2.add(k.sub));
    expect([...subs2]).toEqual([...subs]);
    // an enemy coming near wakes him, ears up, and he trots back to guard
    steps(b, 1.5, input({ wave: true, near: true, enemy: true, ex: 6, ez: 3.8 }));
    expect(['guard', 'trot', 'hop']).toContain(b.act);
    // the pat: he trots to Ruri, she pats him (a heart), and he trots back to his post
    const p = konBrain(1);
    steps(p, 0.1, I);
    p.act = 'play';
    p.sub = 'sit';
    p.t = 0;
    p.sitT = 0;
    p.next = 'pat';
    let patHeart = false;
    let atRuri = false;
    steps(p, 4, I, 1 / 60, (k) => {
      patHeart ||= k.heart;
      if (k.sub === 'pat' && k.act === 'play' && dist(k, 5.3, 5.3) < 0.02) atRuri = true;
    });
    expect(atRuri).toBe(true);
    expect(patHeart).toBe(true);
    expect(heart || patHeart).toBe(true);
  });

  it('Reduce Motion: no hops off the spot, no spins; he re-projects (fades out and in) instead of trotting', () => {
    const b = konBrain(4);
    const I = input({ calm: true, enemy: true, near: true, ex: 6.5, ez: 3.8 });
    steps(b, 0.3, I);
    konBolt(b, 6.5, 3.8);
    let maxH = 0;
    let moved = 0;
    steps(b, 0.5, I, 1 / 120, (k) => {
      maxH = Math.max(maxH, k.h);
      moved = Math.max(moved, dist(k, 5, 3.8));
    });
    expect(maxH).toBeLessThanOrEqual(KON.YIP_H + 1e-6);
    expect(moved).toBeLessThan(1e-6);
    // between waves only calm plays; going to Ruri is a fade, not a trot
    const c = konBrain(9);
    const acts = new Set();
    let faded = false;
    steps(c, 30, input({ calm: true, wave: false }), 1 / 30, (k) => {
      acts.add(k.act === 'play' ? k.sub : k.act);
      faded ||= k.fade < 1;
      expect(k.roll).toBe(0);
    });
    expect(acts.has('trot')).toBe(false);
    expect(acts.has('tail')).toBe(false);
    expect(faded).toBe(true);
  });

  it('his post: the relay origin, slid sideways when it sits straight behind Ruri from the camera; by her when there is none', () => {
    const out = { x: 0, z: 0 };
    // the origin 1.2 tiles behind her (−z, away from a camera at +z): slid sideways, within the leash
    konPost({ x: 5, y: 5, ox: 5, oy: 3.8, origin: { x: 5, y: 3.8 } }, 0, 1, out);
    expect(Math.abs(out.x - 5)).toBeGreaterThan(0.3);
    expect(Math.hypot(out.x - 5, out.z - 3.8)).toBeLessThanOrEqual(KON.LEASH);
    // in front of her: unchanged
    konPost({ x: 5, y: 5, ox: 5, oy: 6.2, origin: { x: 5, y: 6.2 } }, 0, 1, out);
    expect([out.x, out.z]).toEqual([5, 6.2]);
    // her origin is her own spot: a post in front of her (camera side)
    konPost({ x: 5, y: 5, ox: 5, oy: 5, origin: { x: 5, y: 5 } }, 0, 1, out);
    expect(out.z).toBeGreaterThan(5.2);
    konHome(5, 5, 0, 1, out);
    expect(out.z).toBeGreaterThan(5);
    const lane = { x: 0, z: 0 };
    laneDirAt([{ points: [[0, 0], [10, 0]], dirs: [[1, 0]] }], 3, 0.4, lane);
    expect([lane.x, lane.z]).toEqual([1, 0]);
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
