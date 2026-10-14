// Roaming drones (Chika's kit) and the wing's flight modes: docs/specs/CHIKA_REWORK.md §3, §9, §16.
import { describe, test, expect } from 'vitest';
import { makeSim, startEmptyWave, run } from './fixtures.js';
import { topTargets, selectTargets, makeDrone, restoreDrone } from '../../src/sim/towers.js';
import { STEP, DRONE_SLOTS } from '../../src/sim/constants.js';
import { createRng } from '../../src/core/rng.js';

const LANE_Y = 4.5;

function park(sim, id, x, extra = {}) {
  const e = sim.spawnEnemy(id, { dist: x + 0.5, ...extra }); // the lane runs from x = -0.5
  e.baseSpeed = 0;
  return e;
}

/** Keeps the wave open with nothing spawning (drones are built only during waves). */
function holdWave(sim) {
  sim._spawnQueue = [{ t: 1e9, enemyId: 'slime', pathIndex: 0 }];
  sim._spawnIndex = 0;
}

/** A roamer 3 tiles below the lane (her own 2.0 range cannot reach it; drones reach 3 + 1). */
function setup(opts = {}) {
  const sim = makeSim({ seed: 3, ...opts });
  startEmptyWave(sim);
  holdWave(sim);
  const t = sim.placeTower('roamer', opts.x ?? 8.5, opts.y ?? 7.5);
  return { sim, t };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function stepN(sim, n, each) {
  for (let i = 0; i < n; i++) {
    sim.update(STEP);
    if (each) each(i);
  }
}

describe('roaming drones', () => {
  test('the drone slot table matches the old spawn angles', () => {
    for (let n = 0; n < 16; n++) {
      const a = n * 2.39996 + 0.6;
      expect(DRONE_SLOTS[n][0]).toBeCloseTo(Math.sin(a), 15);
      expect(DRONE_SLOTS[n][1]).toBeCloseTo(Math.cos(a), 15);
    }
  });

  test('drones reach an enemy beyond her range and never leave the roam disc', () => {
    const { sim, t } = setup();
    const e = park(sim, 'tank', 8.5);
    expect(dist(t, e)).toBeGreaterThan(t.eff.range);
    let maxOut = 0;
    stepN(sim, 240, () => {
      for (const d of t.turrets) maxOut = Math.max(maxOut, Math.hypot(d.x - t.x, d.y - t.y) - t.turretSpec.leash);
    });
    expect(t.turrets).toHaveLength(2);
    expect(maxOut).toBeLessThanOrEqual(1e-9);
    expect(e.hp).toBeLessThan(e.maxHp);
    expect(t.droneDmg).toBeGreaterThan(0);
    expect(t.damageDealt).toBe(t.droneDmg); // her bolt cannot reach it
    expect(Math.max(...t.turrets.map((d) => dist(d, t)))).toBeGreaterThan(t.eff.range);
  });

  test('a shrinking disc sends drones straight back inside, never outward', () => {
    const { sim, t } = setup();
    park(sim, 'tank', 11); // 3.9 tiles out: the drones wait at the disc's edge
    run(sim, 3);
    const leash = t.turretSpec.leash;
    t.turretSpec.leash = leash - 0.4;
    const L = t.turretSpec.leash;
    const excess = Math.max(...t.turrets.map((d) => Math.hypot(d.x - t.x, d.y - t.y) - L));
    expect(excess).toBeGreaterThan(0);
    const limit = Math.ceil(excess / (t.turretSpec.speed * STEP)) + 1;
    let prev = t.turrets.map((d) => Math.hypot(d.x - t.x, d.y - t.y));
    let inside = -1;
    stepN(sim, 120, (i) => {
      const now = t.turrets.map((d) => Math.hypot(d.x - t.x, d.y - t.y));
      now.forEach((r, k) => {
        if (prev[k] > L + 1e-9) expect(r).toBeLessThanOrEqual(prev[k] + 1e-12);
      });
      if (inside < 0 && now.every((r) => r <= L + 1e-9)) inside = i + 1;
      prev = now;
    });
    expect(inside).toBeGreaterThan(0);
    expect(inside).toBeLessThanOrEqual(limit);
  });

  test('home exactly after the last enemy dies; counters add up', () => {
    const { sim, t } = setup();
    for (let k = 0; k < 4; k++) park(sim, 'slime', 7 + k);
    run(sim, 10);
    expect(sim.enemies).toHaveLength(0);
    run(sim, t.turretSpec.leash / t.turretSpec.speed + 0.1);
    for (const d of t.turrets) {
      expect(d.x).toBe(t.x + d.hx);
      expect(d.y).toBe(t.y + d.hy);
    }
    const sum = (k) => t.turrets.reduce((a, d) => a + d[k], 0);
    expect(sum('dmg')).toBeCloseTo(t.droneDmg, 9);
    expect(sum('kills')).toBe(t.droneKills);
    expect(sum('shots')).toBe(t.droneShots);
    expect(t.droneKills).toBeLessThanOrEqual(t.kills);
    expect(t.kills).toBe(4);
  });

  test('her bolt fires before the wing is full, and it is credited to her alone', () => {
    const { sim, t } = setup({ x: 8.5, y: 6.4 });
    const e = park(sim, 'tank', 8.5);
    t.turretSpec.rate = 0; // drones never fire
    t.stats.turret.max = 0; // and none are built
    run(sim, 2);
    expect(t.turrets).toHaveLength(0);
    expect(e.hp).toBeLessThan(e.maxHp);
    expect(t.droneDmg).toBe(0);
    expect(t.damageDealt).toBeGreaterThan(0);
  });

  test('First spreads the wing over two enemies; Strong focuses it on the strongest', () => {
    const { sim, t } = setup();
    park(sim, 'tank', 7.5);
    const elite = park(sim, 'elite', 9.5);
    run(sim, 2);
    const first = new Set(t.turrets.map((d) => d.targetUid));
    expect(first.size).toBe(2);
    sim.setTargetMode(t.uid, 'strong');
    run(sim, 1.2);
    expect(t.turrets.every((d) => d.targetUid === elite.uid)).toBe(true);
  });

  test('a stronger enemy entering reach takes the whole Strong wing within a second', () => {
    const { sim, t } = setup();
    sim.setTargetMode(t.uid, 'strong');
    park(sim, 'tank', 8.5);
    run(sim, 2);
    const boss = park(sim, 'boss', 9.5);
    boss.hp = boss.maxHp = 1e9;
    run(sim, 1.05);
    expect(t.turrets.every((d) => d.targetUid === boss.uid)).toBe(true);
  });

  test('guided shots: they pass through an enemy in the way and fizzle when the target dies', () => {
    const { sim, t } = setup();
    const target = park(sim, 'tank', 11); // 3.9 tiles out: the drones shoot from the disc's edge, 0.9 away
    run(sim, 3);
    // a blocker parked right on the line between a drone and its target
    const d = t.turrets[0];
    const blocker = sim.spawnEnemy('tank', { dist: 9.5 });
    blocker.baseSpeed = 0;
    blocker.x = (d.x + target.x) / 2;
    blocker.y = (d.y + target.y) / 2;
    run(sim, 2);
    expect(blocker.hp).toBe(blocker.maxHp);
    // a bullet whose target dies fizzles: no hit, gone next step
    sim.drainEvents();
    let guard = 0;
    while (!sim.projectiles.some((p) => p.guided) && guard++ < 120) sim.update(STEP);
    const p = sim.projectiles.find((q) => q.guided);
    expect(p).toBeTruthy();
    p.target.dead = true;
    sim.update(STEP);
    expect(sim.projectiles.includes(p)).toBe(false);
    expect(sim.drainEvents().some((ev) => ev.type === 'fizzle' && ev.uid === p.uid)).toBe(true);
  });

  test('a sabotaged girl stalls her drones; they resume after', () => {
    const { sim, t } = setup();
    park(sim, 'tank', 8.5);
    run(sim, 1);
    t.disabled = 1;
    const at = t.turrets.map((d) => [d.x, d.y]);
    const shots = t.droneShots;
    run(sim, 0.9);
    expect(t.turrets.map((d) => [d.x, d.y])).toEqual(at);
    expect(t.droneShots).toBe(shots);
    run(sim, 1);
    expect(t.droneShots).toBeGreaterThan(shots);
  });

  test('sappers: a girl in reach first; otherwise they jam the nearest drone (3 s)', () => {
    const { sim, t } = setup();
    // girl in reach: today's rule
    const s1 = park(sim, 'sapper', 8.5);
    s1.y = 6.5;
    run(sim, 0.1);
    expect(t.disabled).toBeGreaterThan(0);
    s1.dead = true;
    run(sim, 3.5);
    expect(t.disabled).toBe(0);
    // no girl in reach: the nearest drone is jammed, hovers and holds fire
    park(sim, 'tank', 8.5);
    run(sim, 2);
    const s2 = park(sim, 'sapper', 9.5);
    const near = [...t.turrets].sort((a, b) => dist(a, s2) - dist(b, s2))[0];
    run(sim, 0.05);
    expect(t.disabled).toBe(0);
    expect(near.jam).toBeGreaterThan(2.5);
    const at = [near.x, near.y];
    const shots = near.shots;
    run(sim, 2);
    expect([near.x, near.y]).toEqual(at);
    expect(near.shots).toBe(shots);
    expect(sim.droneStats(t.uid).find((x) => x.uid === near.uid).state).toBe('jammed');
  });

  test('a volatile death next to a drone does nothing to it or to her', () => {
    const { sim, t } = setup();
    park(sim, 'tank', 8.5);
    run(sim, 2.5);
    const d = t.turrets[0];
    const b = sim.spawnEnemy('bomb', { dist: 1 });
    b.baseSpeed = 0;
    b.x = d.x;
    b.y = d.y + 0.2;
    sim._killEnemy(b, null);
    expect(t.disabled).toBe(0);
    expect(d.jam).toBe(0);
  });

  test('selling removes the drones and their bullets in flight', () => {
    const { sim, t } = setup();
    park(sim, 'tank', 8.5);
    let guard = 0;
    while (!sim.projectiles.some((p) => p.guided) && guard++ < 600) sim.update(STEP);
    sim.sellTower(t.uid);
    expect(t.turrets).toHaveLength(0);
    sim.update(STEP);
    expect(sim.projectiles.some((p) => p.owner === t)).toBe(false);
  });

  test('build timer: turret.build seconds, shortened by attack-speed auras; a chain transform keeps building', () => {
    const { sim, t } = setup();
    sim.upgradeTower(t.uid, 0); // max 3
    sim.update(STEP);
    expect(t.turrets).toHaveLength(1); // the first one at once
    run(sim, 0.95);
    expect(t.turrets).toHaveLength(1);
    run(sim, 0.1);
    expect(t.turrets).toHaveLength(2);
    // an attack-speed aura (×1.2) shortens it to 1 / 1.2 s
    const sim2 = makeSim({ seed: 3 });
    startEmptyWave(sim2);
    holdWave(sim2);
    const t2 = sim2.placeTower('roamer', 8.5, 7.5);
    sim2.placeTower('chime', 9.5, 6.5);
    expect(t2.turretSpec.build).toBeCloseTo(1 / 1.2, 9);
    sim2.update(STEP);
    run(sim2, 0.85);
    expect(t2.turrets).toHaveLength(2);
    // chain transform
    const sim3 = makeSim({ seed: 3 });
    startEmptyWave(sim3);
    holdWave(sim3);
    const t3 = sim3.placeTower('roamer', 8.5, 7.5);
    sim3.upgradeTower(t3.uid, 2);
    expect(t3.eff.behavior).toBe('chain');
    run(sim3, 1.5);
    expect(t3.turrets).toHaveLength(2);
  });

  test('topTargets equals a stable sort + truncate in every mode, ties included', () => {
    const sim = makeSim({ seed: 3 });
    startEmptyWave(sim);
    const rng = createRng(77);
    const spec = { canHitAir: true, detection: true, attackType: 'pierce' };
    for (let round = 0; round < 200; round++) {
      for (const e of sim.enemies) e.dead = true;
      sim._removeDead();
      const n = 1 + Math.floor(rng.next() * 25);
      for (let i = 0; i < n; i++) {
        const id = ['slime', 'orc', 'elite', 'tank'][Math.floor(rng.next() * 4)];
        const e = sim.spawnEnemy(id, { dist: Math.floor(rng.next() * 8) * 2 }); // integer dists: ties
        if (rng.next() < 0.3) e.remaining = 5;
      }
      sim.grid.rebuild(sim.enemies);
      for (const mode of ['first', 'last', 'strong', 'close', 'elite']) {
        const k = 1 + Math.floor(rng.next() * 6);
        const want = selectTargets(sim, 8, 4.5, 6, spec, mode, Math.max(2, k));
        const out = topTargets(sim, 8, 4.5, 6, spec, mode, Math.max(2, k), [], []);
        expect(out.map((e) => e.uid)).toEqual(want.map((e) => e.uid));
      }
    }
  });

  test('a dead quarry left at a calm point changes nothing (no per-drone timers)', () => {
    const play = (leaveQuarry) => {
      const { sim, t } = setup();
      for (let k = 0; k < 3; k++) park(sim, 'slime', 7 + k);
      run(sim, 8);
      expect(sim.enemies).toHaveLength(0);
      if (leaveQuarry) t.turrets[0].tgt = { dead: true, uid: -5 };
      for (let k = 0; k < 3; k++) park(sim, 'slime', 8 + k);
      run(sim, 6);
      return t.turrets.map((d) => [d.x, d.y, d.dmg, d.shots]);
    };
    expect(play(true)).toEqual(play(false));
  });

  test('battle-save rows: 12 fields round trip, old 5-field rows restore with zero counters', () => {
    const { t } = setup();
    const d = makeDrone(t, 99, 3, 2, 4);
    Object.assign(d, { x: 3.25, y: 1.5, facing: 0.5, cooldown: 0.1, dmg: 12.5, kills: 2, shots: 9, jam: 1.25 });
    const row = [d.uid, d.x, d.y, d.facing, d.cooldown, d.n, d.slot, d.dmg, d.kills, d.shots, d.born, d.jam];
    const back = restoreDrone(t, row, 0);
    for (const k of ['uid', 'x', 'y', 'facing', 'cooldown', 'n', 'slot', 'dmg', 'kills', 'shots', 'born', 'jam', 'hx', 'hy']) expect(back[k]).toBe(d[k]);
    const old = restoreDrone(t, [7, 1, 2, 0.3, 0.2], 1);
    expect(old).toMatchObject({ uid: 7, n: 2, slot: 1, dmg: 0, kills: 0, shots: 0, born: 0, jam: 0, x: 1, y: 2 });
  });

  test('droneStats, findDrone and towerStats (own vs drones)', () => {
    const { sim, t } = setup({ x: 8.5, y: 6.4 });
    park(sim, 'tank', 8.5);
    run(sim, 4);
    const ds = sim.droneStats(t.uid);
    expect(ds.map((d) => d.n)).toEqual([1, 2]);
    expect(ds.every((d) => d.state === 'hunting')).toBe(true);
    expect(sim.findDrone(ds[1].uid).drone).toBe(t.turrets[1]);
    expect(sim.findDrone(t.uid)).toBe(null);
    const st = sim.towerStats(t.uid);
    expect(st.turret).toMatchObject({ leash: 3, speed: 4, build: 1, range: 1, active: 2, dealt: t.droneDmg, kills: t.droneKills, shots: t.droneShots, flight: 'hover' });
    expect(st.own.dealt).toBeCloseTo(t.damageDealt - t.droneDmg, 9);
    expect(st.own.dps).toBeCloseTo(2, 9); // 2 damage × 1/s
  });
});

describe('flight modes', () => {
  test('only roaming-drone girls fly; bad modes and points are refused', () => {
    const { sim, t } = setup();
    const a = sim.placeTower('archer', 2.5, 7.5);
    expect(sim.setFlight(a.uid, 'hold', 3, 3)).toBe(false);
    expect(sim.setFlight(t.uid, 'zoom')).toBe(false);
    expect(sim.setFlight(t.uid, 'hold', NaN, 1)).toBe(false);
    expect(sim.setFlight(t.uid, 'patrol', 1, 1)).toBe(false);
    expect(sim.flightInfo(t.uid).mode).toBe('hover');
    expect(sim.flightInfo(a.uid)).toBe(null);
  });

  test('Hold: the wing roams around a point inside her signal range (far points are pulled in)', () => {
    const { sim, t } = setup({ x: 1.5, y: 7.5 });
    const e = park(sim, 'tank', 8.5); // 7.6 tiles away: out of Hover reach (4)
    run(sim, 2);
    expect(t.droneDmg).toBe(0);
    expect(sim.setFlight(t.uid, 'hold', 8.5, 4.5)).toBe(true);
    const info = sim.flightInfo(t.uid);
    expect(info.mode).toBe('hold');
    expect(info.signal).toBe(6);
    expect(Math.hypot(info.a[0] - t.x, info.a[1] - t.y)).toBeCloseTo(6, 9); // pulled in to 6 tiles
    run(sim, 4);
    expect(e.hp).toBeLessThan(e.maxHp);
    for (const d of t.turrets) expect(Math.hypot(d.x - info.a[0], d.y - info.a[1])).toBeLessThanOrEqual(t.turretSpec.leash + 1e-9);
  });

  test('Patrol: the wing position travels between the two points and back', () => {
    const { sim, t } = setup();
    sim.setFlight(t.uid, 'patrol', 6, 5, 11, 5);
    const xs = [];
    stepN(sim, 60 * 8, () => xs.push(t.flight.cx));
    expect(Math.max(...xs)).toBe(11);
    expect(Math.min(...xs)).toBe(6);
    expect(xs.indexOf(6, 10)).toBeGreaterThan(xs.indexOf(11)); // and back
    // speed: drone speed × FLIGHT_PATROL_SPEED_MUL
    expect(xs[30] - xs[0]).toBeCloseTo(30 * STEP * t.turretSpec.speed * 0.6, 9);
  });

  test('Pursuit: map-wide, the drones fly to an enemy far beyond her reach at their speed', () => {
    const { sim, t } = setup({ x: 1.5, y: 7.5 });
    const e = park(sim, 'tank', 14.5);
    sim.setFlight(t.uid, 'pursuit');
    run(sim, 0.5);
    const d0 = t.turrets[0];
    const travel = Math.hypot(e.x - t.x, e.y - t.y);
    // not instant: half a second covers 2 tiles at 4 tiles/s
    expect(Math.hypot(d0.x - t.x, d0.y - t.y)).toBeLessThanOrEqual(0.62 + 4 * 0.5 + 1e-9);
    run(sim, travel / t.turretSpec.speed + 1);
    expect(e.hp).toBeLessThan(e.maxHp);
    // back home when it is gone
    e.dead = true;
    run(sim, travel / t.turretSpec.speed + 0.5);
    for (const d of t.turrets) expect([d.x, d.y]).toEqual([t.x + d.hx, t.y + d.hy]);
  });

  test('switching modes keeps the points; Hover returns the wing to her', () => {
    const { sim, t } = setup();
    sim.setFlight(t.uid, 'hold', 10, 3);
    run(sim, 3);
    sim.setFlight(t.uid, 'hover');
    expect(sim.flightInfo(t.uid).a).toEqual([10, 3]);
    run(sim, 4);
    for (const d of t.turrets) expect(Math.hypot(d.x - t.x, d.y - t.y)).toBeLessThanOrEqual(t.turretSpec.leash + 1e-9);
  });
});
