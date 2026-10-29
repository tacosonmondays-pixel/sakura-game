// The staff heroes on the board (src/render/staffFx.js): Norika's barricades and Hold the Line barriers, Kogane's
// Clear the Road plow and Big Yellow beside her. Display only: it reads the sim's state (frozen here, so a write
// throws) and draws instanced props.
import { describe, test, expect } from 'vitest';
import { StaffFx } from '../../src/render/staffFx.js';
import { buildPaths, pointAt } from '../../src/sim/path.js';
import { MAPS } from '../../src/data/maps.js';
import { TICKS } from '../../src/sim/barricades.js';

const MAP = MAPS.find((m) => m.id === 'lake_shore');
const noop = () => {};
const DT = 1 / 60;

function setup({ reduceMotion = false, quality = 'medium' } = {}) {
  const pathData = buildPaths(MAP);
  const sim = { pathData, runners: [], towers: [], heroes: [], time: 0, getTower: (uid) => sim.towers.find((t) => t.uid === uid) || null };
  const log = { puffs: 0, shards: 0, spawns: 0, rings: 0 };
  const fx = {
    puff: () => log.puffs++, shards: () => log.shards++, spawn: () => log.spawns++, ring: () => log.rings++, sparkle: noop, flash: noop,
  };
  const pushes = { overlay: 0, groundA: 0, groundN: 0 };
  const batch = (k) => ({ push: () => { pushes[k]++; return true; } });
  const R = { white: [0, 0, 1, 1], shadow: [0, 0, 1, 1], ring: [0, 0, 1, 1], ringDashed: [0, 0, 1, 1], disc: [0, 0, 1, 1], dot: [0, 0, 1, 1], smoke: [0, 0, 1, 1] };
  const views = new Map();
  const actors = { towers: views };
  const staff = new StaffFx({
    sim, scene: { add: noop }, fx, batches: { overlay: batch('overlay'), groundA: batch('groundA'), groundN: batch('groundN'), bbN: batch('overlay') },
    atlas: { regions: R }, actors, quality, reduceMotion,
  });
  const at = (d) => pointAt(pathData[0], d, {});
  return { sim, staff, log, pushes, views, at };
}

const norika = (bars, lines = []) => ({ uid: 1, def: { role: 'blocker' }, bars, lines });
const kogane = () => ({ uid: 2, x: 3, y: 3, def: { role: 'pilot', hero: { ult: { effect: { type: 'runner', runner: 'plow' } } } } });
const deepFreeze = (o) => {
  for (const v of Object.values(o)) if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  return Object.freeze(o);
};

describe('Norika\'s barricades', () => {
  test('one prop per standing barricade, none while broken, back (with a puff) when rebuilt', () => {
    const { sim, staff, at, log } = setup();
    const p = at(4);
    const q = at(6);
    const bars = [{ uid: 10, x: p.x, y: p.y, hp: 100, max: 100, down: 0 }, { uid: 11, x: q.x, y: q.y, hp: 100, max: 100, down: 0 }];
    sim.heroes.push(norika(bars));
    staff.update(DT);
    expect(staff._meshes.bars.count).toBe(2);
    bars[1].hp = 0;
    bars[1].down = 3 * TICKS;
    staff.update(DT);
    expect(staff._meshes.bars.count).toBe(1);
    const puffs = log.puffs;
    bars[1].down = 0;
    bars[1].hp = 100;
    staff.update(DT);
    expect(staff._meshes.bars.count).toBe(2);
    expect(log.puffs).toBe(puffs + 1);
  });

  test('a budget bar shows only while one is being pushed; it faces across the road', () => {
    const { sim, staff, at, pushes } = setup();
    const p = at(4);
    const bars = [{ uid: 10, x: p.x, y: p.y, hp: 100, max: 100, down: 0 }];
    sim.heroes.push(norika(bars));
    staff.update(DT);
    expect(pushes.overlay).toBe(0);
    expect(staff._bars.get(10).yaw).toBeCloseTo(p.facing, 5);
    bars[0].hp = 30;
    staff.update(DT);
    expect(pushes.overlay).toBe(2); // the frame and the fill
  });

  test('Hold the Line barriers are their own props and shrink away at the end of their time', () => {
    const { sim, staff, at } = setup({ reduceMotion: true });
    const p = at(5);
    const lines = [{ uid: 20, x: p.x, y: p.y, hp: 400 * TICKS, left: 12 * TICKS, held: 0.1, mini: false }];
    sim.heroes.push(norika([], lines));
    staff.update(DT);
    expect(staff._meshes.lines.count).toBe(1);
    expect(staff._meshes.bars.count).toBe(0);
    const scale = () => {
      const m = new (staff._meshes.lines.instanceMatrix.array.constructor)(16);
      for (let i = 0; i < 16; i++) m[i] = staff._meshes.lines.instanceMatrix.array[i];
      return Math.hypot(m[0], m[1], m[2]);
    };
    const full = scale();
    lines[0].left = Math.round(TICKS * 0.25);
    staff.update(DT);
    expect(scale()).toBeLessThan(full * 0.6);
    sim.heroes[0].lines.length = 0; // their time ran out: gone
    staff.update(DT);
    expect(staff._meshes.lines.count).toBe(0);
  });

  test('the state is never written', () => {
    const { sim, staff, at } = setup();
    const p = at(4);
    sim.heroes.push(norika([{ uid: 10, x: p.x, y: p.y, hp: 40, max: 100, down: 0 }], [{ uid: 20, x: p.x, y: p.y, hp: 5, left: 9, held: 0, mini: false }]));
    deepFreeze(sim.heroes);
    for (let i = 0; i < 30; i++) staff.update(DT);
    expect(staff._meshes.bars.count).toBe(1);
  });
});

describe('Kogane: Big Yellow and Clear the Road', () => {
  test('Big Yellow stands behind her figure; out plowing, it drives the road with its blade, then comes back', () => {
    const { sim, staff, views, log } = setup();
    const k = kogane();
    sim.heroes.push(k);
    sim.towers.push(k);
    views.set(2, { scale: 1.36, facing: 0, model: { position: { x: 3, y: 0.05, z: 3 }, scale: { x: 1.36 } } });
    staff.update(DT);
    expect(staff._meshes.walkers.count).toBe(1);
    expect(staff._meshes.blades.count).toBe(0);
    const L = sim.pathData[0].length;
    const r = { uid: 50, ownerUid: 2, kind: 'plow', pathIndex: 0, dist: L - 2, speed: 3.2, left: 2.5, end: 0, segments: 2, gap: 0.6, dead: false };
    sim.runners.push(r);
    staff.update(DT);
    // only the road one: she sent it out
    expect(staff._meshes.walkers.count).toBe(1);
    expect(staff._meshes.blades.count).toBe(1);
    expect(log.spawns).toBeGreaterThan(0); // dust
    sim.runners.length = 0; // runnerEnd
    const puffs = log.puffs;
    staff.update(DT);
    expect(log.puffs).toBe(puffs + 1);
    expect(staff._meshes.blades.count).toBe(0);
    expect(staff._meshes.walkers.count).toBe(1); // back beside her
  });

  test('the low setting skips the dust; her ult is told apart from a sky dragon', () => {
    const { sim, staff, log } = setup({ quality: 'low' });
    const k = kogane();
    sim.towers.push(k);
    sim.runners.push({ uid: 50, ownerUid: 2, kind: 'plow', pathIndex: 0, dist: 5, speed: 3.2, left: 2.5, end: 0, segments: 2, gap: 0.6, dead: false });
    staff.update(DT);
    expect(log.spawns).toBe(0);
    expect(staff.isPlowUlt({ type: 'ult', effect: 'runner', towerUid: 2 })).toBe(true);
    expect(staff.isPlowUlt({ type: 'ult', effect: 'runner', towerUid: 99 })).toBe(false);
    expect(staff.ultColor({ type: 'ult', effect: 'barricade', towerUid: 1 })).toBeTruthy();
  });

  test('a battle without the staff heroes builds nothing', () => {
    const { sim, staff } = setup();
    sim.heroes.push({ uid: 3, def: { role: 'support' } });
    staff.update(DT);
    expect(staff._meshes).toBeNull();
  });
});
