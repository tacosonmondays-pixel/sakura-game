// Seiran's sky dragon on the board (src/render/rosterFx.js, docs/ATTACK_FX.md): display only. A dragon
// the wave clear removes mid-flight (Sim._checkWaveEnd empties sim.runners, no runnerEnd) finishes its
// flight to START as a local ghost within GHOST_TIME and sparkles there. With Auto start on it gets there
// before the next wave starts (that pause is 1 s of sim time: 0.5 / 0.33 s at 2x / 3x), and a ghost still
// flying when a wave starts anyway rushes to START: it is never dropped mid-road. A dragon that ended
// (runnerEnd) or whose girl was sold leaves no ghost. It never writes to the sim.
import { describe, test, expect } from 'vitest';
import { RosterFx } from '../../src/render/rosterFx.js';
import { buildPaths, pointAt } from '../../src/sim/path.js';
import { MAPS } from '../../src/data/maps.js';
import { Sim } from '../../src/sim/Sim.js';
import { AUTO_START_DELAY } from '../../src/sim/constants.js';
import { defaultData } from '../../src/sim/data.js';
import { activateUlt } from '../../src/sim/hero.js';
import { reversePath } from '../../src/sim/rules.js';
import { STAGE, ENEMIES } from '../sim/fixtures.js';

const MAP = MAPS.find((m) => m.id === 'lake_shore');
const noop = () => {};
const DT = 1 / 60;
/** The exit sparkle's colour (COL.sky); the entry sparkle is gold. */
const SKY = '#9fd8ff';
const GHOST_TIME = 1.2;
const GHOST_RUSH = 0.2;

/** A RosterFx on `sim` with a fake FX layer that logs every sparkle (x, z, colour, frame). */
function boardFor(sim) {
  const log = { frame: 0, sparkles: [] };
  const fx = {
    sparkle: (x, z, color) => log.sparkles.push({ x, z, color, frame: log.frame }),
    puff: noop, ring: noop, flash: noop, spawn: noop, shards: noop, beam: noop, n: (x) => x,
  };
  const batch = { push: noop };
  const roster = new RosterFx({ sim, scene: { add: noop }, fx, batches: { bbA: batch, groundN: batch, groundA: batch }, atlas: { regions: {} }, actors: null });
  const exits = () => log.sparkles.filter((s) => s.color === SKY);
  return { roster, log, exits };
}

function setup(map = MAP) {
  const sim = { pathData: buildPaths(map), runners: [], towers: [], time: 0, getTower: () => null, state: 'wave', _autoTimer: -1 };
  const b = boardFor(sim);
  return { sim, ...b, count: { get sparkle() { return b.log.sparkles.length; } }, L: sim.pathData[0].length };
}

/** START of road `i` (where the exit sparkle belongs). */
const startOf = (sim, i = 0) => pointAt(sim.pathData[i], 0, {});

/** A sim runner as runners.js builds it (the fields the renderer reads). */
const dragon = (uid, dist, speed = 13) => ({ uid, kind: 'dragon', pathIndex: 0, dist, speed, left: 5, end: -3, segments: 6, gap: 0.6, dead: false });
const launched = (r) => ({ type: 'runner', uid: r.uid, kind: 'dragon', pathIndex: 0, dist: r.dist, segments: r.segments, gap: r.gap, time: 5 });
const heads = (roster) => roster._dragon?.head.count ?? 0;

/** Flies `r` for one frame, then the wave clear removes it: the ghost is born. */
function clearWith(sim, roster, r) {
  sim.runners.push(r);
  roster.handle(launched(r));
  roster.update(DT);
  sim.runners.length = 0;
  sim.state = 'between';
  roster.handle({ type: 'waveEnd', wave: 1 });
}

describe('the sky dragon after a wave clear', () => {
  test('it flies on to START within GHOST_TIME, then sparkles there; the sim is never written', () => {
    const { sim, roster, exits, L } = setup();
    const r = dragon(7, L);
    sim.runners.push(r);
    roster.handle(launched(r));
    roster.update(DT);
    expect(heads(roster)).toBe(1);
    r.dist = L * 0.7; // the sim moved it on
    roster.update(DT);
    // the last enemy falls: the sim empties its runners (no runnerEnd) and the wave ends
    sim.runners.length = 0;
    expect(roster.handle({ type: 'waveEnd', wave: 1 })).toBe(false); // the renderer still sees it
    roster.update(DT);
    expect(roster._ghosts).toHaveLength(1);
    expect(heads(roster)).toBe(1);
    let t = DT;
    while (roster._ghosts.length && t < 5) {
      roster.update(DT);
      t += DT;
    }
    expect(roster._ghosts).toHaveLength(0);
    expect(t).toBeLessThanOrEqual(GHOST_TIME + 2 * DT);
    expect(exits()).toHaveLength(1); // the exit sparkle, on START itself
    expect(exits()[0].x).toBeCloseTo(startOf(sim).x, 9);
    expect(exits()[0].z).toBeCloseTo(startOf(sim).y, 9);
    roster.update(DT);
    expect(heads(roster)).toBe(0);
    expect(r.dist).toBe(L * 0.7);
    expect(sim.runners).toHaveLength(0);
  });

  test('a ghost still flying when the next wave starts rushes to START within GHOST_RUSH and sparkles there (never dropped mid-road)', () => {
    const { sim, roster, exits, L } = setup();
    clearWith(sim, roster, dragon(3, L * 0.9));
    roster.update(DT);
    expect(roster._ghosts).toHaveLength(1);
    // the player starts the next wave at once (or the game sped up after the clear)
    sim.state = 'wave';
    expect(roster.handle({ type: 'waveStart', wave: 2 })).toBe(false);
    let frames = 0;
    while (roster._ghosts.length && frames < 300) {
      roster.update(DT);
      frames++;
    }
    expect(roster._ghosts).toHaveLength(0);
    expect(frames * DT).toBeLessThanOrEqual(GHOST_RUSH + 2 * DT);
    expect(exits()).toHaveLength(1);
    expect(exits()[0].x).toBeCloseTo(startOf(sim).x, 9);
    expect(exits()[0].z).toBeCloseTo(startOf(sim).y, 9);
    roster.update(DT);
    expect(heads(roster)).toBe(0);
  });

  test('a wave start that flips the route (reverse rules) leaves the rushing ghost on its own road, to its own START', () => {
    const { sim, roster, exits, L } = setup();
    const start0 = startOf(sim);
    clearWith(sim, roster, dragon(6, L * 0.8));
    roster.update(DT);
    // startNextWave → setRouteOrientation: sim.pathData becomes the reversed roads (START and exit swap)
    sim.pathData = sim.pathData.map(reversePath);
    sim.state = 'wave';
    roster.handle({ type: 'waveStart', wave: 2 });
    for (let k = 0; k < 30 && roster._ghosts.length; k++) roster.update(DT);
    expect(roster._ghosts).toHaveLength(0);
    expect(exits()).toHaveLength(1);
    expect(exits()[0].x).toBeCloseTo(start0.x, 9);
    expect(exits()[0].z).toBeCloseTo(start0.y, 9);
    expect(Math.hypot(exits()[0].x - startOf(sim).x, exits()[0].z - startOf(sim).y)).toBeGreaterThan(1);
  });

  test('a dragon removed before its first frame still finishes (seeded from the runner event)', () => {
    const { roster, exits, L } = setup();
    roster.handle(launched(dragon(9, L)));
    roster.handle({ type: 'waveEnd', wave: 1 });
    expect(roster._ghosts).toHaveLength(1);
    for (let k = 0; k < 90; k++) roster.update(DT);
    expect(roster._ghosts).toHaveLength(0);
    expect(exits()).toHaveLength(1);
  });

  test('no ghost for a dragon that ended (runnerEnd) or whose girl was sold', () => {
    const { sim, roster, count, L } = setup();
    const a = dragon(1, 2);
    const b = dragon(2, L * 0.5);
    sim.runners.push(a, b);
    roster.handle(launched(a));
    roster.handle(launched(b));
    roster.update(DT);
    expect(heads(roster)).toBe(2);
    // a ends at START (runnerEnd: the usual sparkle); b's girl is sold (the sim drops it silently)
    sim.runners.length = 0;
    roster.handle({ type: 'runnerEnd', uid: 1, towerUid: 1, hits: 0 });
    expect(count.sparkle).toBe(1);
    roster.update(DT);
    roster.handle({ type: 'waveEnd', wave: 1 });
    roster.update(DT);
    expect(roster._ghosts).toHaveLength(0);
    expect(heads(roster)).toBe(0);
    expect(count.sparkle).toBe(1);
  });

  test('at 3x game speed it is never slower on screen than the dragon was flying', () => {
    const { sim, roster, exits } = setup();
    roster.setTimeScale(3);
    // 10 tiles of road + 3 of body left at 25 tiles/s (sim): 39 real frames at 1x, 13 at 3x
    clearWith(sim, roster, dragon(4, 10, 25));
    sim.state = 'won'; // no next wave (and no Auto start) to hurry it
    let frames = 0;
    while (roster._ghosts.length && frames < 300) {
      roster.update(DT);
      frames++;
    }
    expect(exits()).toHaveLength(1);
    expect(frames).toBeLessThanOrEqual(Math.ceil(13 / (25 * 3) / DT) + 1);
  });
});

describe('with Auto start on, the ghost reaches START before the next wave starts', () => {
  /**
   * The wave clears with the dragon `back` tiles from START on `mapId`'s first road; the fake sim counts the
   * Auto start pause down on its own clock (AUTO_START_DELAY of sim time) as controller.js runs it:
   * sim first (dt × speed), then the board (dt). `speeds` is the game speed per frame (a switch is followed).
   */
  function autoRun(mapId, back, speeds) {
    const { sim, roster, log, exits } = setup(MAPS.find((m) => m.id === mapId));
    const L = sim.pathData[0].length;
    const speedAt = (f) => speeds[Math.min(f, speeds.length - 1)];
    roster.setTimeScale(speedAt(0));
    clearWith(sim, roster, dragon(5, Math.min(L, back), 13));
    sim._autoTimer = AUTO_START_DELAY;
    let started = null;
    for (let f = 0; f < 600 && started == null; f++) {
      log.frame = f;
      const s = speedAt(f);
      roster.setTimeScale(s);
      sim._autoTimer -= DT * s;
      if (sim._autoTimer <= 0) {
        sim._autoTimer = -1;
        sim.state = 'wave';
        started = f;
        roster.handle({ type: 'waveStart', wave: 2 });
      }
      roster.update(DT);
    }
    return { sim, roster, exits, started, L };
  }

  test.each([
    ['sakura_terrace', 1], ['sakura_terrace', 2], ['sakura_terrace', 3],
    ['arena_colosseum', 1], ['arena_colosseum', 2], ['arena_colosseum', 3],
  ])('%s at %ix: the whole road left, it sparkles on START at least a frame before the wave starts', (mapId, speed) => {
    const { sim, roster, exits, started } = autoRun(mapId, 999, [speed]);
    expect(started).not.toBe(null);
    expect(exits(), 'exactly one exit sparkle').toHaveLength(1);
    expect(exits()[0].frame).toBeLessThan(started);
    expect(exits()[0].x).toBeCloseTo(startOf(sim).x, 9);
    expect(exits()[0].z).toBeCloseTo(startOf(sim).y, 9);
    expect(roster._ghosts).toHaveLength(0);
  });

  test('the game sped up from 1x to 3x after the clear: it still gets there first', () => {
    const speeds = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3];
    const { sim, exits, started } = autoRun('arena_colosseum', 999, speeds);
    expect(exits()).toHaveLength(1);
    expect(exits()[0].frame).toBeLessThan(started);
    expect(exits()[0].x).toBeCloseTo(startOf(sim).x, 9);
  });

  test('a short way left keeps the dragon\'s own pace (Auto start does not hurry it)', () => {
    // 2 tiles + 3 of body at 13 tiles/s: 0.38 s, well inside the 0.9 s before the next wave
    const { exits, started } = autoRun('sakura_terrace', 2, [1]);
    expect(exits()).toHaveLength(1);
    expect(exits()[0].frame).toBeLessThanOrEqual(Math.ceil(5 / 13 / DT) + 1);
    expect(started).toBeGreaterThan(exits()[0].frame);
  });
});

describe('in a real battle with Auto start on (the review case: the dragon clears the wave)', () => {
  const { units, maps } = defaultData();

  /** Seiran (rank 1) beside the road, three 1-HP still enemies by the exit, wave 1 of 3 running, Auto start on. */
  function battle(mapId) {
    const map = maps[mapId];
    const stage = { ...STAGE, mapId: map.id };
    const sim = new Sim({ stageId: STAGE.id, loadout: [{ unitId: 'aoi' }], hero: { unitId: 'seiran' }, seed: 7, options: { autoStart: true }, data: { stage, map, units, enemies: ENEMIES } });
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
    h.level = 3;
    h.ultUnlocked = true;
    h.ultCooldown = 0;
    sim.state = 'wave';
    sim.wave = 1;
    sim._spawnQueue = [];
    sim._spawnIndex = 0;
    for (const back of [6, 7.5, 9]) {
      const e = sim.spawnEnemy('tank', { pathIndex: 0, dist: road.length - back });
      e.hp = 1;
      e.baseSpeed = 0;
      e.speed = 0;
    }
    sim.drainEvents();
    return sim;
  }

  /** Frames as controller.js runs them: sim.update(dt × speed), the drained events to the board, board.update(dt). */
  function play(mapId, speed, withBoard = true) {
    const sim = battle(mapId);
    const { roster, log, exits } = boardFor(sim);
    roster.setTimeScale(speed);
    expect(activateUlt(sim)).toBe(true);
    const out = { waveEnd: null, waveStart: null, ghostLeft: null };
    for (let f = 0; f < 60 * 8 && out.waveStart == null; f++) {
      log.frame = f;
      sim.update(DT * speed);
      for (const ev of sim.drainEvents()) {
        if (ev.type === 'waveEnd') out.waveEnd = f;
        if (ev.type === 'waveStart') out.waveStart = f;
        if (withBoard) roster.handle(ev);
      }
      if (out.waveEnd === f && withBoard) out.ghostLeft = roster._ghosts[0] ? roster._ghosts[0].dist - roster._ghosts[0].end : 0;
      if (withBoard) roster.update(DT);
    }
    out.exits = exits();
    out.start = pointAt(sim.pathData[0], 0, {});
    out.simState = JSON.stringify([sim.time, sim.wave, sim.state, sim.cash, sim.enemies.length, sim.runners.length]);
    return out;
  }

  test.each([
    ['sakura_terrace', 1], ['sakura_terrace', 2], ['sakura_terrace', 3],
    ['arena_colosseum', 1], ['arena_colosseum', 3],
  ])('%s at %ix: one exit sparkle on START before the next wave starts; the sim runs the same without the board', (mapId, speed) => {
    const a = play(mapId, speed);
    expect(a.waveEnd, 'the dragon cleared the wave').not.toBe(null);
    expect(a.ghostLeft, 'mid-flight, far from START').toBeGreaterThan(15);
    expect(a.waveStart, 'Auto start began wave 2').not.toBe(null);
    expect(a.exits).toHaveLength(1);
    expect(a.exits[0].frame).toBeLessThan(a.waveStart);
    expect(a.exits[0].x).toBeCloseTo(a.start.x, 9);
    expect(a.exits[0].z).toBeCloseTo(a.start.y, 9);
    // display only: the board never changes what the sim does
    expect(play(mapId, speed, false).simState).toBe(a.simState);
  });
});
