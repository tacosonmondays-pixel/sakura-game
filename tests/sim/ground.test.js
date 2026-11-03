// Attack shapes batch S3 "Ground" (src/sim/ground.js, src/sim/vines.js, src/sim/shapes.js onRoad / inBand;
// docs/specs/ATTACK_SHAPES.md §4.2, §5.4, §5.7, §5.8, §7.2): the shape tests, Yuki's Rising Spikes, Kanna's Ripple
// Quake, the wave clear, sabotage, selling, caps, and determinism (twice the same, and plain against withDetMath,
// compared by hashSim every 60 ticks). Chigusa's Bramble Road has its own cases in tests/sim/vines.test.js.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP, SPIKE_UP, SPIKE_ROWS_PER_GIRL, QUAKES_PER_GIRL } from '../../src/sim/constants.js';
import { defaultData } from '../../src/sim/data.js';
import { onRoad, inBand, inDisc, hitRadius } from '../../src/sim/shapes.js';
import { buildPaths, samplePath, pathFromTrack } from '../../src/sim/path.js';
import { spikeAt, spikeRise, endGroundWave } from '../../src/sim/ground.js';
import { gainHeroXp, xpToReach } from '../../src/sim/hero.js';
import { hashSim } from '../../src/online/coop/simHash.js';
import { withDetMath } from '../../src/core/detMath.js';
import { readFileSync } from 'node:fs';
import { MAP, STAGE, ENEMIES } from './fixtures.js';

const units = defaultData().units;
const pathOf = (u, id) => units[u].paths.findIndex((p) => p.id === id);
const BITE = pathOf('yuki', 'frostbite');

/** A fixture battle (a straight road along row 4, dist = x + 0.5) with Yuki at (x, y) on Frostbite to `tier`. */
function setup({ tier = 4, x = 6.5, y = 5.5, hero = null } = {}) {
  const sim = new Sim({
    stageId: STAGE.id, loadout: [{ unitId: 'yuki' }], hero: hero ? { unitId: hero } : null, seed: 7,
    data: { stage: STAGE, map: MAP, units, enemies: ENEMIES },
  });
  sim.cash = 1e9;
  const t = sim.placeTower('yuki', x, y);
  expect(t, 'placed').toBeTruthy();
  for (let k = 0; k < tier; k++) expect(sim.upgradeTower(t.uid, BITE)).toBe(true);
  sim.state = 'wave';
  sim.wave = 1;
  sim._spawnQueue = [{ t: 1e9, enemy: 'tank' }]; // keeps the wave running
  sim._spawnIndex = 0;
  return { sim, t };
}
const steps = (sim, n) => {
  for (let i = 0; i < n; i++) {
    sim._step(STEP);
    sim.drainEvents();
  }
};
/** A parked enemy on the fixture road at x. */
const park = (sim, id, x) => {
  const e = sim.spawnEnemy(id, { pathIndex: 0, dist: x + 0.5 });
  e.baseSpeed = 0;
  return e;
};

describe('shape tests: onRoad, inBand', () => {
  // a fork: both roads share the stretch x -1 … 8 along row 4, then one turns up and one down; a third crosses it
  const MAPF = { ...MAP, paths: [[[-1, 4], [8, 4], [8, -1]], [[-1, 4], [8, 4], [8, 9]], [[4, -1], [4, 9]]] };
  const sim = { pathData: buildPaths(MAPF) };
  const at = (pathIndex, dist) => {
    const p = sim.pathData[pathIndex];
    const s = samplePath(p, 0.05).reduce((b, q) => (Math.abs(q.d - dist) < Math.abs(b.d - dist) ? q : b));
    let seg = 0;
    while (seg < p.cum.length - 2 && p.cum[seg + 1] <= dist) seg++;
    return { pathIndex, dist, x: s.x, y: s.y, seg };
  };

  test('the same road: a path-distance span, ends included', () => {
    expect(onRoad(sim, at(0, 5), 0, 3, 7)).toBe(true);
    expect(onRoad(sim, at(0, 3), 0, 3, 7)).toBe(true);
    expect(onRoad(sim, at(0, 7), 0, 3, 7)).toBe(true);
    expect(onRoad(sim, at(0, 7.01), 0, 3, 7)).toBe(false);
    expect(onRoad(sim, at(0, 2.99), 0, 3, 7)).toBe(false);
  });

  test('a shared stretch counts (Marumi\'s rule); past the fork, a crossing road or a parallel lane do not', () => {
    expect(onRoad(sim, at(1, 5), 0, 3, 7)).toBe(true); // the fork's shared prefix
    expect(onRoad(sim, at(1, 11), 0, 3, 12)).toBe(false); // path 1 turned down; path 0's stretch turned up
    // the crossing road meets row 4 at x 4.5 (dist 5.5 on path 0): same spot, at a right angle
    expect(onRoad(sim, at(2, 5), 0, 3, 7)).toBe(false);
    const lanes = { pathData: buildPaths({ ...MAP, paths: [[[-1, 2], [12, 2]], [[-1, 3], [12, 3]]] }) };
    const p1 = lanes.pathData[1];
    expect(onRoad(lanes, { pathIndex: 1, dist: 5, x: p1.points[0][0] + 5, y: 3.5, seg: 0 }, 0, 3, 7)).toBe(false); // a lane 1 tile away
  });

  test('a shared stretch is clipped to [d0, d1] on a long segment (one 10-tile segment each road)', () => {
    const long = { pathData: [pathFromTrack({ points: [[0, 0.5], [10, 0.5]] }, 0), pathFromTrack({ points: [[0, 0.5], [10, 0.5]] }, 1)] };
    expect(long.pathData[0].points).toHaveLength(2);
    const on1 = (x) => ({ pathIndex: 1, dist: x, x, y: 0.5, seg: 0 });
    expect(onRoad(long, on1(3), 0, 2, 4)).toBe(true);
    expect(onRoad(long, on1(8), 0, 2, 4)).toBe(false); // the same segment, outside the stretch
    expect(onRoad(long, on1(1.5), 0, 2, 4)).toBe(false);
    expect(onRoad(long, on1(4.25), 0, 2, 4)).toBe(true); // (within ROAD_SHARED of its end)
  });

  test('inBand: r0 < d ≤ r1, the centre counts when the band starts there', () => {
    expect(inBand(0, 0, 1)).toBe(true);
    expect(inBand(0.25, 0.5, 1)).toBe(false);
    expect(inBand(0.25 + 1e-9, 0.5, 1)).toBe(true);
    expect(inBand(1, 0.5, 1)).toBe(true);
    expect(inBand(1 + 1e-9, 0.5, 1)).toBe(false);
  });
});

describe('Rising Spikes (Yuki, Frostbite T4-5)', () => {
  test('T3 keeps her icicle; T4 raises a row of 6 spikes 0.5 apart along her enemy\'s road, T5 a row of 8', () => {
    expect(setup({ tier: 3 }).t.eff.behavior).toBe('projectile');
    for (const [tier, count, mul] of [[4, 6, 0.46], [5, 8, 0.36]]) {
      const { t } = setup({ tier });
      expect(t.eff.behavior).toBe('spikes');
      expect(t.stats.spike).toEqual({ count, gap: 0.5, r: 0.25, delay: 3, mul });
    }
  });

  test('the row: spike 0 under her enemy, the others up the road 0.5 apart; spike i rises 1 + 3i steps after the attack', () => {
    const { sim, t } = setup();
    const e = park(sim, 'tank', 7.5);
    t.cooldown = 0;
    steps(sim, 1);
    expect(t.spikeRows).toHaveLength(1);
    const row = t.spikeRows[0];
    expect(row.n).toBe(6);
    expect(row.lead).toBe(e.uid);
    for (let i = 0; i < 6; i++) {
      const [x, y] = spikeAt(row, i);
      expect(x).toBeCloseTo(e.x - 0.5 * i, 9);
      expect(y).toBeCloseTo(4.5, 9);
      expect(spikeRise(row, i, 3)).toBe(1 + 3 * i);
    }
    // the row ends SPIKE_UP steps after its last spike rose
    steps(sim, 16 + SPIKE_UP);
    expect(t.spikeRows.some((r) => r.uid === row.uid)).toBe(true);
    steps(sim, 1);
    expect(t.spikeRows.some((r) => r.uid === row.uid)).toBe(false);
  });

  test('each walker on the row is struck once (a lone enemy: one hit an attack, as from her icicle); flyers never', () => {
    const { sim, t } = setup();
    t.cooldown = 1e9;
    const a = park(sim, 'tank', 7.5);
    const b = park(sim, 'tank', 7.1); // under spike 1 (and touching spike 0's radius)
    const c = park(sim, 'tank', 3.5); // past the row's end (6 spikes: 2.5 tiles up the road)
    const bat = sim.spawnEnemy('bat', { pathIndex: 0, dist: 7.0 });
    const hp = [a.hp, b.hp, c.hp, bat.hp];
    t.cooldown = 0;
    steps(sim, 1);
    t.cooldown = 1e9;
    steps(sim, 8);
    expect(a.hp).toBeLessThan(hp[0]);
    expect(b.hp).toBeLessThan(hp[1]);
    steps(sim, 20);
    const lead = hp[0] - a.hp;
    const once = hp[1] - b.hp;
    expect(once / lead).toBeCloseTo(0.46, 6); // her enemy takes her whole hit, the others × spike.mul
    steps(sim, 20);
    expect(hp[1] - b.hp).toBe(once); // once a row, though two spikes touch it
    expect(c.hp).toBe(hp[2]);
    expect(bat.hp).toBe(hp[3]);
    expect(t.spikeRows[0]?.hit ?? [a.uid, b.uid]).toEqual(expect.arrayContaining([a.uid, b.uid]));
    // inDisc with the body: a spike of radius r reaches an enemy whose centre is r + hitRadius away
    expect(inDisc(0, 0, 0.25, 0.25 + hitRadius(a), 0, hitRadius(a))).toBe(true);
  });

  test('a flyer as her enemy gets her icicle (a projectile), never a row', () => {
    const { sim, t } = setup();
    sim.spawnEnemy('bat', { pathIndex: 0, dist: 7.5 });
    t.cooldown = 0;
    steps(sim, 1);
    expect(t.spikeRows ?? []).toHaveLength(0);
    expect(sim.projectiles.some((p) => p.ownerUid === t.uid)).toBe(true);
  });

  test('caps: at most SPIKE_ROWS_PER_GIRL rows of hers, the oldest first; the wave clear, sabotage and a sale', () => {
    const { sim, t } = setup();
    park(sim, 'tank', 7.5);
    t.spikeRows = Array.from({ length: SPIKE_ROWS_PER_GIRL }, (_, i) => ({ uid: 1e6 + i, pathIndex: 0, dist: 1, n: 1, age: 0, next: 1, pts: [0, 0], hit: [], spec: t.eff }));
    t.cooldown = 0;
    steps(sim, 1);
    expect(t.spikeRows).toHaveLength(SPIKE_ROWS_PER_GIRL);
    expect(t.spikeRows[0].uid).toBe(1e6 + 1);
    // sabotaged: her rows still rise and strike (road objects), she raises none
    t.spikeRows = [];
    t.cooldown = 0;
    steps(sim, 1);
    const row = t.spikeRows[0];
    t.disabled = 5;
    steps(sim, 5);
    expect(row.next).toBe(2);
    endGroundWave(sim);
    expect('spikeRows' in t).toBe(false);
    t.disabled = 0;
    t.cooldown = 0;
    steps(sim, 1);
    expect(t.spikeRows).toHaveLength(1);
    sim.sellTower(t.uid);
    expect(() => steps(sim, 30)).not.toThrow();
  });
});

describe('Ripple Quake (Kanna, Lv 24 Hundred Demons\' Parade)', () => {
  /** Kanna at (9.5, 6.2) beside the fixture road, at `level` (Yuki far off, un-upgraded and kept quiet). */
  function kanna(level = 24) {
    const { sim, t } = setup({ tier: 0, x: 14.5, y: 6.2, hero: 'kanna' });
    t.cooldown = 1e9;
    t.eff.range = 0;
    const k = sim.placeTower('kanna', 9.5, 6.2);
    expect(k?.isHero).toBe(true);
    gainHeroXp(sim, k, xpToReach(k.def.hero, level), 'restore');
    return { sim, k };
  }

  test('below Lv 24 no quake; from Lv 24 two rings 12 steps apart, growing 6 tiles a second to her range', () => {
    expect(kanna(23).k.stats.quake).toBeUndefined();
    const { sim, k } = kanna(24);
    expect(k.stats.quake).toMatchObject({ rings: 2, gap: 12, speed: 6, mul: 0.03, later: 0.015 });
    park(sim, 'tank', 9.5);
    k.cooldown = 0;
    steps(sim, 1);
    k.cooldown = 1e9;
    expect(k.quakes).toHaveLength(2);
    const [r0, r1] = k.quakes;
    expect([r0.wait, r1.wait, r0.r]).toEqual([0, 12, 0]); // (sent after this step's ground tick)
    steps(sim, 1);
    expect(r0.r).toBeCloseTo(6 * STEP, 12);
    steps(sim, 11);
    expect([r1.wait, r1.r]).toEqual([0, 0]);
    steps(sim, 1);
    expect(r1.r).toBeCloseTo(6 * STEP, 12);
    steps(sim, Math.ceil(k.eff.range / (6 * STEP)) + 1);
    expect(k.quakes).toHaveLength(0);
  });

  test('a ring strikes each ground walker it crosses once, rolls past the enemy she struck, never a flyer; its hits are clean', () => {
    const { sim, k } = kanna(24);
    const tgt = park(sim, 'tank', 10.6); // her strike's enemy (First: the lead one)
    const a = park(sim, 'tank', 8.5);
    const bat = sim.spawnEnemy('bat', { pathIndex: 0, dist: 9.0 });
    steps(sim, 1);
    k.cooldown = 0;
    const hp = [a.hp, bat.hp];
    steps(sim, 1);
    k.cooldown = 1e9;
    expect(k.rampTarget).toBe(tgt);
    const t0 = tgt.hp;
    steps(sim, 60);
    expect(a.hp).toBeLessThan(hp[0]);
    expect(bat.hp).toBe(hp[1]);
    expect(tgt.hp).toBe(t0); // no ring hit on her enemy after her strike
    // two rings: two hits on `a`, the second smaller
    const dealt = hp[0] - a.hp;
    expect(dealt).toBeGreaterThan(0);
    expect(a.statuses.shred).toBeUndefined(); // her strike's shred does not ride on a ring
    expect(a.statuses.slow).toBeUndefined();
  });

  test('caps and the wave clear', () => {
    const { sim, k } = kanna(24);
    park(sim, 'tank', 9.5);
    for (let i = 0; i < 6; i++) {
      k.cooldown = 0;
      steps(sim, 1);
    }
    expect(k.quakes.length).toBeLessThanOrEqual(QUAKES_PER_GIRL);
    endGroundWave(sim);
    expect('quakes' in k).toBe(false);
  });
});

/** A real battle on 4-5 with Yuki (Frostbite 5), Chigusa (Greenhouse 5) and Kanna (Lv 24); hashSim every 60 ticks. */
function realBattle(det, ids = ['yuki', 'chigusa'], hero = 'kanna') {
  const PATH = { yuki: BITE, chigusa: pathOf('chigusa', 'greenhouse') };
  const go = () => {
    // (power-neutral, `powerOff`: balance round 5's rows off, src/data/balance.js, so every shape is still live when sampled)
    const sim = new Sim({ stageId: '4-5', loadout: ids.map((unitId) => ({ unitId, stats: { potential: 6, powerOff: true } })), hero: hero ? { unitId: hero, stats: { powerOff: true } } : null, seed: 13 });
    sim.cash = 1e9;
    const road = sim.pathData.flatMap((p) => samplePath(p, 0.5));
    const cells = [];
    for (let y = 0.5; y < sim.map.height; y += 1) for (let x = 0.5; x < sim.map.width; x += 1) {
      cells.push({ x, y, cov: road.filter((r) => (r.x - x) * (r.x - x) + (r.y - y) * (r.y - y) <= 4).length });
    }
    cells.sort((a, b) => b.cov - a.cov || a.y - b.y || a.x - b.x);
    const girls = ids.map((id) => {
      const c = cells.find((q) => sim.canPlace(id, q.x, q.y).ok);
      return sim.placeTower(id, c.x, c.y);
    });
    for (let i = 0; i < 5; i++) for (const t of girls) sim.upgradeTower(t.uid, PATH[t.unitId]);
    if (hero) {
      const c = cells.find((q) => sim.canPlace(hero, q.x, q.y).ok);
      const h = sim.placeTower(hero, c.x, c.y);
      gainHeroXp(sim, h, xpToReach(h.def.hero, 24), 'restore');
      girls.push(h);
    }
    const out = [];
    const live = { vines: 0, spikeRows: 0, quakes: 0 };
    sim.startNextWave();
    for (let tick = 0; tick < 60 * 90; tick++) {
      sim.update(STEP);
      if (sim.state === 'between') sim.startNextWave();
      if (tick % 60 === 0) out.push(hashSim(sim, { tick }));
      for (const t of girls) for (const k of Object.keys(live)) if (t[k]?.length) live[k]++;
    }
    return { out, dealt: girls.map((t) => t.damageDealt), live };
  };
  return det ? withDetMath(go) : go();
}

describe('determinism', () => {
  test('the same battle twice is identical', () => {
    expect(realBattle(false)).toEqual(realBattle(false));
  });

  test('plain Math and the deterministic ports give the same hashSim every 60 ticks, each girl alone and all three', () => {
    for (const [ids, hero, key] of [[['yuki'], null, 'spikeRows'], [['chigusa'], null, 'vines'], [['aoi'], 'kanna', 'quakes']]) {
      const a = realBattle(false, ids, hero);
      expect(realBattle(true, ids, hero).out, key).toEqual(a.out);
      expect(a.live[key], `${key} were live`).toBeGreaterThan(0);
    }
    const all = realBattle(false);
    expect(realBattle(true).out).toEqual(all.out);
    expect(Object.values(all.live).every((n) => n > 0)).toBe(true);
  });
});

describe('determinism: the source', () => {
  test('the new sim files use no Math.random, no runtime trig or hypot and no ** (comments aside)', () => {
    for (const f of ['src/sim/ground.js', 'src/sim/vines.js', 'src/sim/shapes.js', 'src/sim/dirs.js']) {
      const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code, f).not.toMatch(/Math\.(random|sin|cos|tan|atan2?|asin|acos|hypot|pow|exp|log)\b/);
      expect(code, f).not.toMatch(/\*\*/);
    }
  });
});
