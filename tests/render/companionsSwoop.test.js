// Kaze on Kaze's Swoop (A3 M3 review): the Swoop is map-wide, but Kaze never crosses the map for it. He dives only on
// the targets within Hana's reach (as far as his plain swoops go), each flight capped there; a far target takes
// abilityFx's feather strike from the sky (round 2: swoopTargets tells it which are his). Reduce motion: no dive at
// all — he stays on her shoulder, turns to the first target and plays his attack (the owner is motion-sensitive; Kon
// stays put for Moon Pounce the same way).
//
// This drives the real Companions class over a real Sim (the fixture map, the real Hana). Only what needs a browser
// is stubbed, as in companionsLab.test.js: the GLB figure (a plain THREE.Group with a playAttack counter), the girls'
// views and the drawn enemies (actors.enemyPos).
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Sim } from '../../src/sim/Sim.js';
import { pointAt } from '../../src/sim/path.js';
import { STAGE, testData } from '../sim/fixtures.js';
import { defaultData } from '../../src/sim/data.js';
import { Companions } from '../../src/render/companions.js';
import { loadCompanionManifest, setCompanionManifest, companionEntry, HomeAnchor } from '../../src/models/companions.js';
import { sortieState, diveReach, DIVE_TIME, MAX_DIVES } from '../../src/render/companionLogic.js';

const manifest = JSON.parse(readFileSync(new URL('../../public/models/companions/manifest.json', import.meta.url), 'utf8'));
const D = defaultData();
const QUIET = { ...STAGE, waves: 5, waveGen: { pool: [], budget: { start: 1, growth: 1 } } };
const HANA = [8.5, 3.4];

/** Hana on the fixture map, Kaze on her shoulder; `enemies` uid -> { x, y, z, height } is what the board draws. */
async function board({ reduceMotion = false } = {}) {
  const sim = new Sim({ stageId: QUIET.id, seed: 5, loadout: [{ unitId: 'hana' }], data: testData({ stage: QUIET, units: D.units, enemies: D.enemies }) });
  sim.cash = 1e9;
  const hana = sim.placeTower('hana', ...HANA);
  expect(hana).toBeTruthy();
  const enemies = new Map();
  const views = new Map();
  const actors = { towers: views, enemies, enemyPos: (uid) => enemies.get(uid) || null };
  const c = new Companions({ sim, scene: new THREE.Scene(), actors, terrain: null, quality: 'high', reduceMotion });
  await loadCompanionManifest();
  setCompanionManifest(manifest);
  c.ready = true;
  let attacks = 0;
  c._create = (t, cid) => {
    if (!views.get(t.uid)) return null;
    const entry = companionEntry(cid);
    const a = {
      uid: t.uid, unitId: t.unitId, cid, entry, group: new THREE.Group(), detail: 'lod', anchor: new HomeAnchor(entry),
      home: new THREE.Vector3(), facing: 0, face: 0, faceT: 0, state: 'idle', barRest: null, battleScale: 1, height: 0.2,
      kon: null, sortie: sortieState(),
    };
    a.group.userData.playAttack = () => attacks++;
    c.root.add(a.group);
    return a;
  };
  // her view stands on her spot (x = sim x, z = sim y), facing +z
  const model = new THREE.Group();
  model.position.set(hana.x, 0, hana.y);
  views.set(hana.uid, { model, facing: 0 });
  const frame = (dt = 1 / 60) => c.update(dt);
  frame();
  const kaze = () => c.list.get(hana.uid);
  expect(kaze()?.cid).toBe('kaze');
  /** Kaze's horizontal distance from his perch now. */
  const fromHome = () => {
    const a = kaze();
    return Math.hypot(a.group.position.x - a.home.x, a.group.position.z - a.home.z);
  };
  /** Runs `secs` of frames; returns the farthest he got from his perch and the most he moved in one frame. */
  const fly = (secs) => {
    let far = 0;
    let step = 0;
    let last = kaze().group.position.clone();
    for (let t = 0; t < secs; t += 1 / 60) {
      frame();
      far = Math.max(far, fromHome());
      step = Math.max(step, kaze().group.position.distanceTo(last));
      last = kaze().group.position.clone();
    }
    return { far, step };
  };
  const swoop = (targets) => c.handle({ type: 'ability', towerUid: hana.uid, id: 'hana.swoop', kind: 'strike', targets });
  return { sim, hana, c, enemies, kaze, fly, swoop, attacks: () => attacks };
}
/** An enemy drawn `d` tiles from Hana along +x (flyers float about a tile up). */
const at = (hana, d, dz = 0) => ({ x: hana.x + d, y: 1, z: hana.y + dz, height: 0.5 });

describe('Kaze on Kaze\'s Swoop: never across the map', () => {
  test('full motion: dives on the targets within her reach only, in strike order; the far ones are left to abilityFx\'s strike', async () => {
    const { hana, c, enemies, kaze, fly, swoop, attacks } = await board();
    const reach = diveReach(hana.eff.range);
    expect(reach).toBeGreaterThan(3);
    enemies.set(1, at(hana, 9.5)); // across the map
    enemies.set(2, at(hana, 1.8, 0.6)); // by her
    enemies.set(3, at(hana, 8.6, -0.4)); // across the map
    enemies.set(4, at(hana, -2.2)); // by her, the other side
    swoop([1, 2, 3, 4]);
    // the queue: the near two, strike order kept
    expect(kaze().diving).toBe(true);
    expect(kaze().sortie.uid).toBe(2);
    expect(kaze().dives).toEqual([4]);
    expect(attacks()).toBe(1);
    // what abilityFx asks right after the event: his targets (the far two get its feather strike from the sky)
    expect(c.swoopTargets(hana.uid)).toEqual([2, 4]);
    expect(c.swoopTargets(hana.uid + 99)).toBeNull();
    const { far, step } = fly(2 * DIVE_TIME + 0.4);
    expect(far).toBeLessThan(reach);
    expect(far).toBeGreaterThan(1.5); // he really flew out to the near ones
    expect(attacks()).toBe(2);
    // back on her shoulder, nothing queued
    expect(!!kaze().diving).toBe(false);
    expect(kaze().sortie.busy).toBe(false);
    expect(kaze().dives).toEqual([]);
    // never a screen-crossing dart: the fastest frame is well under a tile at 60 fps
    expect(step).toBeLessThan(0.5);
  });

  test('full motion: every target far off (Hana at one end, the flyers at the other) — no dive; he calls it from her shoulder, turned to the first', async () => {
    const { hana, c, enemies, kaze, fly, swoop, attacks } = await board();
    for (let i = 0; i < MAX_DIVES; i++) enemies.set(10 + i, at(hana, 8 + i * 0.4, (i % 3) - 1));
    swoop(Array.from({ length: MAX_DIVES }, (_, i) => 10 + i));
    expect(!!kaze().diving).toBe(false);
    expect(kaze().dives).toEqual([]);
    expect(c.swoopTargets(hana.uid)).toEqual([]); // every one gets abilityFx's strike
    expect(attacks()).toBe(1); // his attack clip, in place
    const a = fly(0.5);
    // turned toward the first target (off to her +x: about +90°) while he calls it
    const first = at(hana, 8, -1);
    expect(kaze().facing).toBeCloseTo(Math.atan2(first.x - kaze().home.x, first.z - kaze().home.z), 1);
    const b = fly(1);
    expect(Math.max(a.far, b.far)).toBeLessThan(1e-6);
  });

  test('her plain shots at high attack speed: he swoops at the enemy she shot, one at a time, the next after a rest; never a blur', async () => {
    const { hana, c, enemies, kaze, swoop } = await board();
    const reach = diveReach(hana.eff.range);
    // a walker and a flyer by her; she shoots every 0.08 s, the flyer every fourth shot
    enemies.set(31, { x: hana.x + 2, y: 0.1, z: hana.y + 0.5, height: 0.5, airborne: false });
    enemies.set(32, { x: hana.x - 1.5, y: 1, z: hana.y + 1, height: 0.5, airborne: true });
    const shoot = (uid) => c.handle({ type: 'attack', towerUid: hana.uid, targetUid: uid });
    const flights = [];
    let far = 0;
    let step = 0;
    let last = kaze().group.position.clone();
    let wasBusy = false;
    let shot = 0;
    for (let t = 0, next = 0; t < 6; t += 1 / 60) {
      if (t >= next) {
        next += 0.08;
        shoot(++shot % 4 === 0 ? 32 : 31);
      }
      c.update(1 / 60);
      const a = kaze();
      if (a.sortie.busy && !wasBusy) flights.push(a.sortie.uid);
      wasBusy = a.sortie.busy;
      far = Math.max(far, Math.hypot(a.group.position.x - a.home.x, a.group.position.z - a.home.z));
      step = Math.max(step, a.group.position.distanceTo(last));
      last = a.group.position.clone();
    }
    // 75 shots, about five swoops (one second each and a rest), every one at an enemy she shot, the flyer kept
    expect(shot).toBeGreaterThan(70);
    expect(flights.length).toBeGreaterThanOrEqual(4);
    expect(flights.length).toBeLessThanOrEqual(6);
    expect(flights[0]).toBe(31);
    for (const u of flights.slice(1)) expect(u).toBe(32);
    expect(far).toBeLessThanOrEqual(reach + 1e-6);
    expect(step).toBeLessThan(0.5);
    // her ⚡ takes over: the waiting swoop is dropped, and her shots wait until the dives are done
    swoop([31]);
    expect(kaze().perch.next).toBe(null);
    shoot(32);
    expect(kaze().perch.next).toBe(null);
  });

  test('the real sim: Hana\'s own attack events send him out at the enemy each one names (flyers first is the sim\'s pick)', async () => {
    const { sim, hana, c, enemies, kaze } = await board();
    // a slime on the road by her (the fixture's first road), drawn where the sim has it
    let best = null;
    sim.pathData.forEach((p, pi) => {
      for (let dist = 0; dist <= p.length; dist += 0.25) {
        const pt = pointAt(p, dist, {});
        const d = Math.hypot(pt.x - hana.x, pt.y - hana.y);
        if (!best || d < best.d) best = { d, pi, dist };
      }
    });
    expect(best.d).toBeLessThan(2);
    sim.startNextWave();
    const e = sim.spawnEnemy('slime_green', { pathIndex: best.pi, dist: Math.max(0, best.dist - 1.5), hpMul: 2000 });
    expect(e).toBeTruthy();
    const named = new Set();
    const flown = new Set();
    for (let i = 0; i < 60 * 6; i++) {
      sim.update(1 / 60);
      enemies.clear();
      for (const x of sim.enemies) if (!x.dead) enemies.set(x.uid, { x: x.x, y: 0.1, z: x.y, height: 0.5, airborne: !!x.airborne });
      for (const ev of sim.drainEvents()) {
        if (ev.type === 'attack' && ev.towerUid === hana.uid) named.add(ev.targetUid);
        c.handle(ev);
      }
      c.update(1 / 60);
      if (kaze().sortie.busy) flown.add(kaze().sortie.uid);
    }
    expect(named.size).toBeGreaterThan(0);
    expect(flown.size).toBeGreaterThan(0);
    for (const u of flown) expect(named.has(u)).toBe(true);
  });

  test('a near target that walks away mid-dive: he still turns back at her reach', async () => {
    const { hana, enemies, fly, swoop } = await board();
    const reach = diveReach(hana.eff.range);
    enemies.set(5, at(hana, 2));
    swoop([5]);
    enemies.set(5, at(hana, 12)); // (an enemy view that jumps far: the dive follows it, capped)
    const { far } = fly(DIVE_TIME + 0.2);
    expect(far).toBeLessThanOrEqual(reach + 1e-6);
  });

  test('Reduce motion: no dive at all, near or far — he stays on her shoulder, turns to the first target and plays his attack', async () => {
    const { hana, c, enemies, kaze, fly, swoop, attacks } = await board({ reduceMotion: true });
    enemies.set(1, at(hana, 1.6)); // by her
    enemies.set(2, at(hana, 9.5)); // across the map
    swoop([1, 2]);
    expect(!!kaze().diving).toBe(false);
    expect(kaze().dives).toEqual([]);
    expect(c.swoopTargets(hana.uid)).toEqual([]); // both get abilityFx's still strike
    expect(kaze().sortie.busy).toBe(false);
    expect(attacks()).toBe(1);
    const { far } = fly(2);
    expect(far).toBeLessThan(1e-6);
    // the far-map case of the review (Hana at the left end, three flyers at the right): the same
    enemies.clear();
    for (const [uid, d] of [[7, 17.9], [8, 17.1], [9, 16.4]]) enemies.set(uid, at(hana, d));
    swoop([7, 8, 9]);
    expect(kaze().dives).toEqual([]);
    expect(fly(2).far).toBeLessThan(1e-6);
    expect(attacks()).toBe(2);
  });
});
