// Companion actors (src/render/companionLogic.js rules, src/models/companions.js contract helpers).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  konState, konStep, konSpot, konAttacks, KON_SPEED, KON_SELF, sortieState, startSortie, sortieStep, retarget, reconcile,
  SWOOP_TIME, DASH_TIME, DASH_REACH, DASH_STOP, swoopDives, MAX_DIVES, DIVE_TIME, POUNCE_TIME, POUNCE_STOP, POUNCE_LIFT,
  diveReach, DIVE_SLACK, konGait, KON_HOP, KON_STRIDE, pounceStep, POUNCE_CROUCH, POUNCE_LAND, POUNCE_REBOUND, stoopStep,
  STOOP_RISE, perchState, queueSwoop, perchFree, perchStep, perchClear, SWOOP_REST, trailState, trailPush, trailAt, trailFade,
  trailClear, TRAIL_LIFE,
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

describe('their girls\' ⚡ abilities (A3 M3): Kaze\'s dives, Kon\'s pounce', () => {
  it('Kaze\'s Swoop queues one dive per target within her reach, in strike order, at most MAX_DIVES; Reduce motion: none (M3 review)', () => {
    expect(swoopDives([7, 3, 9])).toEqual([7, 3, 9]);
    expect(swoopDives(Array.from({ length: 12 }, (_, i) => i + 1))).toHaveLength(MAX_DIVES);
    expect(MAX_DIVES).toBe(8); // Thousand Wings' 8 flyers fit
    expect(swoopDives(null)).toEqual([]);
    expect(swoopDives([null, 4])).toEqual([4]);
    // a map-wide Swoop: the far targets take abilityFx's feather strike, he dives on the near ones (strike order kept)
    const near = new Set([3, 11]);
    expect(swoopDives([7, 3, 9, 11], { inReach: (u) => near.has(u) })).toEqual([3, 11]);
    expect(swoopDives([7, 9], { inReach: (u) => near.has(u) })).toEqual([]);
    // Reduce motion: no dive at all, near or far (he stays on her shoulder; the strikes fade in)
    expect(swoopDives([7, 3, 9], { reduceMotion: true })).toEqual([]);
    expect(swoopDives([3], { reduceMotion: true, inReach: () => true })).toEqual([]);
    // quicker than his own swoops, so eight dives stay under five seconds
    expect(DIVE_TIME).toBeLessThan(SWOOP_TIME);
    expect(DIVE_TIME * MAX_DIVES).toBeLessThan(5);
  });

  it('a dive goes no farther than her reach (diveReach), even after a target that walks off', () => {
    expect(diveReach(3.8)).toBeCloseTo(3.8 + DIVE_SLACK, 9);
    expect(diveReach(undefined)).toBe(DIVE_SLACK);
    const reach = diveReach(3.8);
    const s = sortieState();
    expect(startSortie(s, 2, 0.4, 0, DIVE_TIME, 5)).toBe(true);
    retarget(s, 17, 0.4, 0); // the target is now across the map
    const out = {};
    let far = 0;
    for (let t = 0; t < DIVE_TIME; t += 1 / 120) far = Math.max(far, sortieStep(s, 1 / 120, 0, 0.6, 0, out, { reach, lift: 0.45 }).x);
    expect(far).toBeLessThanOrEqual(reach + 1e-9);
    expect(far).toBeGreaterThan(reach - 0.05);
    // an average speed a falcon can show: at most twice her reach in one dive
    expect((2 * reach) / DIVE_TIME).toBeLessThan(20);
  });

  it('Kon\'s pounce is a leap: out to just short of the target, high in the middle, back to where he stood', () => {
    const s = sortieState();
    expect(startSortie(s, 4, 0.2, 0, POUNCE_TIME, 12)).toBe(true);
    const out = { x: 0, y: 0, z: 0, out: false };
    let top = 0;
    let far = 0;
    for (let t = 0; t < POUNCE_TIME * 0.999; t += 1 / 120) {
      sortieStep(s, 1 / 120, 0, 0.1, 0, out, { stop: POUNCE_STOP, lift: POUNCE_LIFT });
      top = Math.max(top, out.y);
      far = Math.max(far, out.x);
    }
    expect(far).toBeGreaterThan(4 - POUNCE_STOP - 0.05);
    expect(far).toBeLessThanOrEqual(4 - POUNCE_STOP + 1e-9);
    expect(top).toBeGreaterThan(0.1 + POUNCE_LIFT * 0.9);
    sortieStep(s, 0.05, 0, 0.1, 0, out, { stop: POUNCE_STOP, lift: POUNCE_LIFT });
    expect(s.busy).toBe(false);
    expect([out.x, out.y, out.z]).toEqual([0, 0.1, 0]);
  });

  it('the figure layer listens for her ⚡ (the sim\'s ability ids, Reduce motion honoured)', () => {
    const src = readFileSync(new URL('../../src/render/companions.js', import.meta.url), 'utf8');
    expect(src).toContain("const SWOOP_ID = 'hana.swoop'");
    expect(src).toContain("const POUNCE_ID = 'ruri.moonPounce'");
    expect(src).toMatch(/swoopDives\(targets, \{\s*reduceMotion: this\.reduceMotion,/);
    expect(src).toMatch(/if \(this\.reduceMotion\) return;/);
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

describe('their signature moves (visual rework): Kon\'s run and pounce, Kaze\'s stoop and perch, the trails', () => {
  it('Kon bounds along his run: a hop, a pitch and a dust puff per stride; still when he is not running; a 1.5-tile run reads', () => {
    const s = konState();
    const g = { lift: 0, pitch: 0, stretch: 1 };
    konStep(s, 1 / 60, 0, 0, null);
    expect(konGait(s, g)).toEqual({ lift: 0, pitch: 0, stretch: 1 });
    const spot = { x: 1.5, z: 0 };
    let lifts = 0;
    let top = 0;
    let frames = 0;
    let steps = 0;
    let lastSteps = s.steps;
    while (s.mode !== 'spot' && frames < 600) {
      konStep(s, 1 / 60, 0, 0, spot);
      frames++;
      konGait(s, g);
      top = Math.max(top, g.lift);
      if (g.lift > 0.02) lifts++;
      if (s.steps !== lastSteps) {
        steps++;
        lastSteps = s.steps;
      }
    }
    expect(s.mode).toBe('spot');
    // about a second on screen (it used to be 0.6 s), every stride a bound
    expect(frames / 60).toBeGreaterThan(0.9);
    expect(top).toBeCloseTo(KON_HOP, 2);
    expect(lifts).toBeGreaterThan(frames / 3);
    expect(steps).toBe(Math.floor(1.5 / KON_STRIDE));
    expect(konGait(s, g).lift).toBe(0); // sitting at his spot
  });

  it('Moon Pounce reads in beats: a crouch in place, an arc leap, one impact just short of the target, a hop back', () => {
    const s = sortieState();
    expect(startSortie(s, 3, 0.2, 0, POUNCE_TIME, 9)).toBe(true);
    const out = {};
    const order = [];
    let hits = 0;
    let hitAt = null;
    let top = 0;
    let minSquash = 1;
    let crouchMoved = 0;
    for (let t = 0; t < POUNCE_TIME + 0.1; t += 1 / 120) {
      pounceStep(s, 1 / 120, 0, 0.1, 0, out);
      if (out.phase && order[order.length - 1] !== out.phase) order.push(out.phase);
      if (out.phase === 'crouch') {
        crouchMoved = Math.max(crouchMoved, Math.abs(out.x));
        minSquash = Math.min(minSquash, out.squash);
      }
      if (out.hit) {
        hits++;
        hitAt = [out.x, out.y, out.z];
      }
      top = Math.max(top, out.y);
    }
    expect(order).toEqual(['crouch', 'leap', 'impact', 'return']);
    expect(crouchMoved).toBe(0); // the anticipation is on the spot
    expect(minSquash).toBeLessThan(0.75);
    expect(hits).toBe(1);
    expect(hitAt[0]).toBeCloseTo(3 - POUNCE_STOP, 5);
    expect(top).toBeGreaterThan(0.1 + POUNCE_LIFT * 0.9);
    expect(s.busy).toBe(false);
    expect([out.x, out.y, out.z]).toEqual([0, 0.1, 0]);
    // the beats are long enough to see: the crouch a fifth of a second, the impact more than a tenth
    expect(POUNCE_CROUCH * POUNCE_TIME).toBeGreaterThanOrEqual(0.2);
    expect((POUNCE_REBOUND - POUNCE_LAND) * POUNCE_TIME).toBeGreaterThanOrEqual(0.15);
  });

  it('the pounce follows a walking target until he lands, then the hop back starts from where he landed', () => {
    const s = sortieState();
    startSortie(s, 3, 0.2, 0, POUNCE_TIME, 9);
    const out = {};
    pounceStep(s, POUNCE_TIME * 0.3, 0, 0.1, 0, out);
    retarget(s, 3, 0.2, 1);
    pounceStep(s, POUNCE_TIME * 0.25, 0, 0.1, 0, out); // landed (impact)
    expect(out.phase).toBe('impact');
    const land = [out.x, out.z];
    expect(land[1]).toBeGreaterThan(0.5);
    retarget(s, 6, 0.2, -2); // it walks off after the impact: he does not chase it
    pounceStep(s, 1 / 60, 0, 0.1, 0, out);
    expect([out.x, out.z]).toEqual(land);
  });

  it('Kaze\'s swoop: a climb above both ends, a stoop onto the target (one strike), a swing back; capped at her reach', () => {
    const s = sortieState();
    startSortie(s, 3, 0.6, 0, SWOOP_TIME, 4);
    const out = {};
    const order = [];
    let hits = 0;
    let strike = null;
    let top = 0;
    for (let t = 0; t < SWOOP_TIME + 0.05; t += 1 / 120) {
      stoopStep(s, 1 / 120, 0, 0.9, 0, out);
      if (out.phase && order[order.length - 1] !== out.phase) order.push(out.phase);
      if (out.hit) {
        hits++;
        strike = [out.x, out.y];
      }
      if (out.phase === 'climb' || out.phase === 'stoop') top = Math.max(top, out.y);
    }
    expect(order).toEqual(['climb', 'stoop', 'return']);
    expect(hits).toBe(1);
    expect(strike[0]).toBeCloseTo(3, 5);
    expect(strike[1]).toBeCloseTo(0.6, 5);
    expect(top).toBeGreaterThan(0.9 + STOOP_RISE * 0.9); // the stoop comes from above
    expect(s.busy).toBe(false);
    expect([out.x, out.y, out.z]).toEqual([0, 0.9, 0]);
    // a dive across the map: capped at her reach, and never a screen-crossing dart (under half a tile a frame)
    const reach = diveReach(4.9);
    const d = sortieState();
    startSortie(d, 17, 1, 0, DIVE_TIME, 5);
    let far = 0;
    let step = 0;
    let lx = 0;
    let ly = 0.9;
    for (let t = 0; t < DIVE_TIME; t += 1 / 60) {
      stoopStep(d, 1 / 60, 0, 0.9, 0, out, { reach });
      far = Math.max(far, out.x);
      step = Math.max(step, Math.hypot(out.x - lx, out.y - ly));
      lx = out.x;
      ly = out.y;
    }
    expect(far).toBeLessThanOrEqual(reach + 1e-9);
    expect(step).toBeLessThan(0.5);
  });

  it('the perch at high attack speed: one swoop in flight, at most one waiting (the latest, a flyer kept), a rest between', () => {
    const p = perchState();
    const s = sortieState();
    const out = {};
    const started = [];
    // she shoots every 0.08 s for 8 s (a maxed volley Hana); uid = the shot's number, every 5th a flyer
    const dt = 1 / 60;
    let shot = 0;
    let next = 0;
    let overlap = false;
    for (let t = 0; t < 8; t += dt) {
      if (t >= next) {
        next += 0.08;
        shot++;
        if (perchFree(p, s.busy)) {
          if (startSortie(s, 2, 0.5, 0, SWOOP_TIME, shot)) started.push(shot);
        } else queueSwoop(p, shot, shot % 5 === 0);
      }
      stoopStep(s, dt, 0, 0.9, 0, out);
      const u = perchStep(p, dt, s.busy);
      if (u != null) {
        if (s.busy) overlap = true;
        if (startSortie(s, 2, 0.5, 0, SWOOP_TIME, u)) started.push(u);
      }
    }
    // 100 shots, but only as many swoops as fit one after another with a rest on her shoulder
    expect(shot).toBeGreaterThan(90);
    expect(overlap).toBe(false);
    expect(started.length).toBeLessThanOrEqual(Math.ceil(8 / (SWOOP_TIME + SWOOP_REST)) + 1);
    expect(started.length).toBeGreaterThanOrEqual(Math.floor(8 / (SWOOP_TIME + SWOOP_REST + 0.1)));
    // after the first, each swoop goes for a flyer she shot while he was out (flyers first)
    for (const u of started.slice(1)) expect(u % 5).toBe(0);
    // a walker never pushes out a waiting flyer; a newer flyer does
    const q = perchState();
    queueSwoop(q, 10, true);
    queueSwoop(q, 11, false);
    expect(q.next).toBe(10);
    queueSwoop(q, 12, true);
    expect(q.next).toBe(12);
    perchClear(q);
    expect(q.next).toBe(null);
  });

  it('trails: a fixed ring of recent points, newest first, fading out; nothing made after it is built', () => {
    const tr = trailState(4);
    const xs = tr.x;
    for (let i = 0; i < 6; i++) trailPush(tr, i, 0, 0, i * 0.05);
    expect(tr.count).toBe(4);
    expect(tr.x).toBe(xs); // the same arrays
    expect([0, 1, 2, 3].map((i) => tr.x[trailAt(tr, i)])).toEqual([5, 4, 3, 2]);
    expect(trailAt(tr, 4)).toBe(-1);
    expect(trailPush(tr, 5.01, 0, 0, 0.3)).toBe(false); // too close to the last one
    expect(trailFade(0.25, 0.25)).toBe(1);
    expect(trailFade(0, 0.25 + TRAIL_LIFE)).toBe(0);
    trailClear(tr);
    expect(tr.count).toBe(0);
  });
});
