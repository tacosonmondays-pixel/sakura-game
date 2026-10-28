// Seiran's Dragonflight (src/sim/runners.js `toStart`, ABILITIES §5.2): the sky dragon flies from its
// entry all the way back to its road's START, on every road of every map at every rank, and strikes
// each visible enemy on that road once; its tail slides off START before runnerEnd; the flight takes
// at most her rank's time and never goes slower than the old pace; an aimed dragon on a stretch
// several roads share takes the branch with more enemies ahead; fixed-length runners (Marumi's Giant
// Strike, the fixture dragon) are unchanged; deterministic.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP } from '../../src/sim/constants.js';
import { defaultData } from '../../src/sim/data.js';
import { activateUlt, ultEffect } from '../../src/sim/hero.js';
import { startRunner, updateRunners, runnerSegment, runnerEntry } from '../../src/sim/runners.js';
import { buildPaths, pointAt } from '../../src/sim/path.js';
import { STAGE, ENEMIES } from './fixtures.js';

const { units, maps } = defaultData();
const SEIRAN = units.seiran;
/** Her ult effect at a hero level (rank 1 from Lv 3, rank 2 from Lv 10, rank 3 from Lv 20). */
const rankEffect = (level) => ultEffect({ def: SEIRAN, level, stats: null });
const RANKS = [[1, 3], [2, 10], [3, 20]];

/** A bare road world for the runner alone (no enemies, no grid hits). */
function roads(map) {
  const s = { pathData: buildPaths(map), runners: [], enemies: [], grid: { query() {} }, events: [], uid: 0 };
  s._nextUid = () => ++s.uid;
  s._emit = (type, data) => s.events.push({ type, ...data });
  s._hit = () => {};
  return s;
}

/** Flies every runner of `s` to its end; @returns {{ minDist, t, steps }} for the first runner. */
function fly(s, max = 30) {
  const r = s.runners[0];
  let minDist = r.dist;
  let t = 0;
  while (s.runners.length && t < max) {
    updateRunners(s, STEP);
    t += STEP;
    minDist = Math.min(minDist, r.dist);
  }
  return { minDist, t, r };
}

describe('Dragonflight flies the whole road back to START', () => {
  test('her data: every rank flies to START, at most 5 / 4.5 / 4 s, never slower than the old 10/3, 14/3.5, 18/4 pace', () => {
    const want = { 1: [5, 10 / 3, 6], 2: [4.5, 4, 8], 3: [4, 4.5, 10] };
    for (const [rank, level] of RANKS) {
      const e = rankEffect(level);
      expect(e.type).toBe('runner');
      expect(e.toStart, `rank ${rank}`).toBe(true);
      expect([e.time, e.minSpeed, e.segments]).toEqual(want[rank]);
    }
  });

  test('every road of every map, entered at its exit, is flown end to end within her rank time', () => {
    const owner = { uid: 1, removed: false };
    let roadsSeen = 0;
    for (const map of Object.values(maps)) {
      const s = roads(map);
      for (const path of s.pathData) {
        roadsSeen++;
        for (const [rank, level] of RANKS) {
          const e = rankEffect(level);
          s.events.length = 0;
          const r = startRunner(s, owner, e, { status: [] }, null, { pathIndex: path.index, dist: path.length });
          const tail = (r.segments - 1) * r.gap;
          const { minDist, t } = fly(s);
          const where = `${map.id} road ${path.index + 1} (${path.length.toFixed(1)} tiles) rank ${rank}`;
          // the head reached START: ≥ 99% of the road flown (the old flight covered 11-49% at rank 1)
          expect((path.length - Math.max(0, minDist)) / path.length, where).toBeGreaterThanOrEqual(0.99);
          // and the whole body left the road there before it ended
          expect(minDist, where).toBeLessThanOrEqual(-tail + 1e-6);
          expect(t, where).toBeLessThanOrEqual(e.time + STEP + 1e-9);
          expect(r.speed, where).toBeGreaterThanOrEqual(e.minSpeed - 1e-9);
          expect(s.events.filter((x) => x.type === 'runnerEnd'), where).toHaveLength(1);
        }
      }
    }
    expect(roadsSeen).toBeGreaterThanOrEqual(65);
  });

  test('an aimed entry flies from the aim to START; a short flight keeps the old pace', () => {
    const s = roads(maps.sakura_lane);
    const path = s.pathData[0];
    const owner = { uid: 1, removed: false };
    // the diag case: aim at 55% of the road, rank 2
    const mid = pointAt(path, path.length * 0.55, {});
    const e2 = rankEffect(10);
    const r = startRunner(s, owner, e2, { status: [] }, { x: mid.x, y: mid.y });
    expect(r.dist).toBeCloseTo(path.length * 0.55, 0);
    const a = fly(s);
    expect(a.minDist).toBeLessThanOrEqual(-(r.segments - 1) * r.gap + 1e-6);
    expect(a.t).toBeLessThanOrEqual(e2.time + STEP + 1e-9);
    // 6 tiles from START at rank 1: 6 + 3 tiles of body at the old 10/3 tiles/s (1.8 s + 0.9 s)
    const near = pointAt(path, 6, {});
    const e1 = rankEffect(3);
    const q = startRunner(s, owner, e1, { status: [] }, { x: near.x, y: near.y });
    const entry = q.dist;
    expect(entry).toBeCloseTo(6, 0);
    expect(q.speed).toBeCloseTo(10 / 3, 9);
    const b = fly(s);
    expect(b.minDist).toBeLessThanOrEqual(-(q.segments - 1) * q.gap + 1e-6);
    expect(b.t).toBeCloseTo((entry + 3) / (10 / 3), 1);
  });

  test('the head leaves the road at START first; the tail is off the road when runnerEnd fires', () => {
    const s = roads(maps.lake_shore);
    const path = s.pathData[0];
    const r = startRunner(s, { uid: 1, removed: false }, rankEffect(20), { status: [] }, null, { pathIndex: 0, dist: path.length });
    let headGoneTailOn = false;
    let endedAt = null;
    while (s.runners.length) {
      updateRunners(s, STEP);
      const head = runnerSegment(s, r, 0);
      const tail = runnerSegment(s, r, r.segments - 1);
      if (!head && tail) headGoneTailOn = true;
      if (s.events.some((x) => x.type === 'runnerEnd')) {
        endedAt = r.dist;
        break;
      }
    }
    expect(headGoneTailOn).toBe(true);
    // the tail bead is at (or past) START when it ends, every other bead already off the road
    expect(endedAt + (r.segments - 1) * r.gap).toBeLessThanOrEqual(1e-6);
    expect(runnerSegment(s, r, r.segments - 2)).toBe(null);
  });

  test('fixed-length runners are unchanged: Marumi\'s ball (length and to the spawn) never passes START', () => {
    const s = roads(maps.sakura_court);
    const owner = { uid: 1, removed: false };
    const r = startRunner(s, owner, { length: 12, time: 2, segments: 3, gap: 0.5, runner: 'giantBall' }, { status: [] }, null, { pathIndex: 0, dist: 30 });
    expect(r.end).toBe(0);
    const a = fly(s);
    expect(a.r.dist).toBeCloseTo(18, 6);
    expect(a.t).toBeCloseTo(2, 6);
    const q = startRunner(s, owner, { length: 9, time: 9 / 6, segments: 3, gap: 0.5, runner: 'giantBall' }, { status: [] }, null, { pathIndex: 0, dist: 9 });
    const b = fly(s);
    // it stops at START, as before (never below it)
    expect(b.minDist).toBeGreaterThanOrEqual(0);
    expect(b.minDist).toBeCloseTo(0, 9);
    expect(q.dist).toBe(b.minDist);
  });
});

describe('in a battle (sakura_court, the road in the report)', () => {
  /** Seiran (Lv `level`) beside sakura_court's road, a still tank every 1.5 tiles, a wave running. */
  function battle(level, seed = 11) {
    const map = maps.sakura_court;
    const stage = { ...STAGE, mapId: map.id };
    const sim = new Sim({ stageId: STAGE.id, loadout: [{ unitId: 'aoi' }], hero: { unitId: 'seiran' }, seed, data: { stage, map, units, enemies: ENEMIES } });
    sim.cash = 1e9;
    const road = sim.pathData[0];
    const mid = pointAt(road, road.length * 0.5, {});
    let spot = null;
    for (let y = 0.25; y < map.height; y += 0.25) {
      for (let x = 0.25; x < map.width; x += 0.25) {
        const d = Math.hypot(x - mid.x, y - mid.y);
        if (d < 1 || (spot && d >= spot.d)) continue;
        if (sim.canPlace('seiran', x, y).ok) spot = { x, y, d };
      }
    }
    const h = sim.placeTower('seiran', spot.x, spot.y);
    expect(h, 'placed').toBeTruthy();
    h.level = level;
    h.ultUnlocked = true;
    h.ultCooldown = 0;
    sim.state = 'wave';
    sim.wave = 1;
    sim._spawnQueue = [{ t: 1e9, enemy: 'tank' }]; // keeps the wave running
    sim._spawnIndex = 0;
    const tanks = [];
    for (let d = 0.5; d < road.length - 0.3; d += 1.5) {
      const e = sim.spawnEnemy('tank', { pathIndex: 0, dist: d });
      e.baseSpeed = 0;
      e.speed = 0;
      tanks.push(e);
    }
    sim.drainEvents();
    return { sim, h, road, tanks };
  }

  /** Casts Dragonflight and steps until the dragon is gone. */
  function cast(b) {
    const { sim, tanks } = b;
    const visible = tanks.filter((e) => !e.hidden);
    const hp0 = new Map(tanks.map((e) => [e.uid, e.hp]));
    expect(activateUlt(sim)).toBe(true);
    const r = sim.runners[0];
    const entry = r.dist;
    let minDist = entry;
    let t = 0;
    const events = [];
    while (sim.runners.length && t < 10) {
      sim._step(STEP);
      t += STEP;
      minDist = Math.min(minDist, r.dist);
      events.push(...sim.drainEvents().filter((x) => x.type === 'runnerEnd'));
    }
    return { r, entry, minDist, t, events, visible, hp0 };
  }

  test.each(RANKS)('rank %i: enters at the exit, covers the whole 63-tile road and hits every visible enemy once', (rank, level) => {
    const b = battle(level);
    const { r, entry, minDist, t, events, visible, hp0 } = cast(b);
    expect(entry).toBeCloseTo(b.road.length, 6); // the busiest (only) road's exit: the bottom of the screen
    // ≥ 99% of the road flown (the old flight stopped after 10 / 14 / 18 tiles: 16-28%)
    expect((entry - Math.max(0, minDist)) / b.road.length).toBeGreaterThanOrEqual(0.99);
    expect(minDist).toBeLessThanOrEqual(-(r.segments - 1) * r.gap + 1e-6);
    expect(t).toBeLessThanOrEqual(rankEffect(level).time + STEP + 1e-9);
    expect(events).toHaveLength(1);
    expect(events[0].hits).toBe(visible.length);
    expect(r.hit.size).toBe(visible.length);
    // struck once each (r.hit is the once-only ledger), and every one of them is marked
    for (const e of visible) {
      expect(r.hit.has(e.uid)).toBe(true);
      expect(hp0.get(e.uid) - e.hp).toBeGreaterThan(0);
      expect(e.statuses.mark, `tank at ${e.dist.toFixed(1)}`).toBeTruthy();
    }
    // tunnels still shelter enemies (hidden ones are never struck)
    for (const e of b.tanks) if (e.hidden) expect(r.hit.has(e.uid)).toBe(false);
  });

  test('the same cast twice gives the same flight, hits and damage', () => {
    const go = () => {
      const b = battle(10, 5);
      const c = cast(b);
      return JSON.stringify([c.entry, c.minDist, c.t, c.events, b.tanks.map((e) => [e.uid, e.hp, Object.keys(e.statuses || {}).sort()])]);
    };
    expect(go()).toBe(go());
  });

  test('the wave clear still ends the dragon mid-flight in the sim (a calm point holds no runners)', () => {
    const b = battle(3);
    expect(activateUlt(b.sim)).toBe(true);
    b.sim._step(STEP);
    expect(b.sim.runners).toHaveLength(1);
    for (const e of b.tanks) e.dead = true;
    b.sim._spawnQueue = [];
    for (let k = 0; k < 10 && b.sim.state === 'wave'; k++) b.sim._step(STEP);
    expect(b.sim.state).not.toBe('wave');
    expect(b.sim.runners).toHaveLength(0);
  });
});

describe('which road on a map with shared stretches', () => {
  // mountain_fortress: road 2 joins road 1 about 15.7 tiles before the shared exit
  const map = maps.mountain_fortress;
  const enemy = (pathIndex, dist) => ({ pathIndex, dist, dead: false, hidden: false });
  const world = (enemies) => ({ pathData: buildPaths(map), enemies });

  test('an aim on the shared stretch takes the branch with more enemies ahead (ties: the nearer road, then road 1)', () => {
    const P = buildPaths(map);
    const at = pointAt(P[1], P[1].length - 6, {});
    const on0 = pointAt(P[0], P[0].length - 6, {});
    expect(Math.hypot(at.x - on0.x, at.y - on0.y)).toBeLessThan(0.05); // really one road there
    const aim = { x: at.x, y: at.y };
    // road 2's own branch is busier
    expect(runnerEntry(world([enemy(1, 3), enemy(1, 6), enemy(1, 9), enemy(0, 4)]), aim).pathIndex).toBe(1);
    // road 1's is
    expect(runnerEntry(world([enemy(1, 3), enemy(0, 4), enemy(0, 8)]), aim).pathIndex).toBe(0);
    // enemies behind the entry (nearer the exit) are never met, so they do not count
    expect(runnerEntry(world([enemy(1, P[1].length - 1), enemy(1, P[1].length - 2), enemy(0, 4)]), aim).pathIndex).toBe(0);
    // dead and tunnel-hidden enemies do not count either
    expect(runnerEntry(world([{ ...enemy(1, 3), dead: true }, { ...enemy(1, 5), hidden: true }, enemy(0, 4)]), aim).pathIndex).toBe(0);
    // a tie: the nearer road (here the same point on both: road 1)
    const e = runnerEntry(world([]), aim);
    expect([0, 1]).toContain(e.pathIndex);
    expect(e.dist).toBeCloseTo(P[e.pathIndex].length - 6, 0);
  });

  test('an aim on one road\'s own stretch keeps that road, however busy the other is', () => {
    const P = buildPaths(map);
    const own = pointAt(P[1], 3, {}); // road 2 before it joins
    const crowd = [1, 2, 3, 4, 5, 6].map((d) => enemy(0, d));
    const e = runnerEntry(world(crowd), { x: own.x, y: own.y });
    expect(e.pathIndex).toBe(1);
    expect(e.dist).toBeCloseTo(3, 0);
  });

  test('without an aim: the exit of the road with the most enemies, flown to that road\'s own START', () => {
    const s = roads(map);
    s.enemies.push(enemy(1, 3), enemy(1, 6), enemy(0, 4));
    const r = startRunner(s, { uid: 1, removed: false }, rankEffect(3), { status: [] });
    expect(r.pathIndex).toBe(1);
    expect(r.dist).toBeCloseTo(s.pathData[1].length, 9);
    const a = fly(s);
    expect(a.minDist).toBeLessThanOrEqual(-(r.segments - 1) * r.gap + 1e-6);
  });
});
