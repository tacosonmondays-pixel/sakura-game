import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STAGE, UNITS, ENEMIES } from './fixtures.js';
import { defaultData } from '../../src/sim/data.js';

// 22 × 13 serpentine map: the path snakes across rows 1, 5, 9 and exits at the bottom.
const PERF_MAP = {
  id: 'perf-map',
  name: 'Perf',
  theme: 'sakura',
  tier: 'expert',
  width: 22,
  height: 13,
  rows: Array.from({ length: 13 }, () => '......................'),
  paths: [[[-1, 1], [20, 1], [20, 5], [1, 5], [1, 9], [20, 9], [20, 13]]],
};

const PERF_ENEMIES = {
  ...ENEMIES,
  blob: { ...ENEMIES.slime, id: 'blob', hp: 1e7, speed: 0.4 },
  armoredBlob: { ...ENEMIES.orc, id: 'armoredBlob', hp: 1e7, speed: 0.35 },
  fieldOni: { ...ENEMIES.hasteOni, id: 'fieldOni', hp: 1e7, speed: 0.3, traits: { field: { kind: 'shield', radius: 2, amount: 0.3 } } },
  guardOrc: { ...ENEMIES.guard, id: 'guardOrc', hp: 1e7, speed: 0.3 },
  leech: { ...ENEMIES.ghoul, id: 'leech', hp: 1e7, speed: 0.35 },
  flyer: { ...ENEMIES.wyvern, id: 'flyer', hp: 1e7, speed: 0.5 },
};

function buildScenario() {
  const towers = ['archer', 'bomber', 'cleaver', 'chainer', 'beamer', 'priest', 'duelist', 'triple', 'engineer', 'trapper'];
  const sim = new Sim({
    stageId: 'perf',
    difficulty: 'normal',
    loadout: [...towers, 'chime'].map((unitId) => ({ unitId })),
    seed: 11,
    data: { stage: { ...STAGE, id: 'perf', mapId: 'perf-map', waves: 99 }, map: PERF_MAP, units: UNITS, enemies: PERF_ENEMIES },
  });
  sim.cash = 1e9;
  const spots = [];
  for (const ty of [3, 7, 11, 2, 6]) for (let tx = 1; tx < 21; tx += 2) spots.push([tx, ty]);
  let placed = 0;
  for (let i = 0; i < spots.length && placed < 30; i++) {
    const id = i % 10 === 9 ? 'chime' : towers[i % towers.length];
    if (sim.placeTower(id, spots[i][0], spots[i][1])) placed++;
  }
  sim.state = 'wave';
  sim.wave = 1;
  sim._spawnQueue = [];
  const kinds = ['blob', 'blob', 'blob', 'armoredBlob', 'fieldOni', 'guardOrc', 'leech', 'flyer'];
  const len = sim.pathData[0].length;
  for (let i = 0; i < 200; i++) sim.spawnEnemy(kinds[i % kinds.length], { dist: (i / 200) * (len - 8) });
  return { sim, placed };
}

describe('performance budget', () => {
  test('200 enemies + 30 towers: a 1/60 s step and a 3× speed frame stay well under 4 ms', () => {
    const { sim, placed } = buildScenario();
    expect(placed).toBe(30);
    expect(sim.enemies.length).toBe(200);
    for (let i = 0; i < 120; i++) {
      sim.update(1 / 60);
      sim.drainEvents();
    }
    const steps = 600;
    const t0 = performance.now();
    for (let i = 0; i < steps; i++) {
      sim.update(1 / 60);
      sim.drainEvents();
    }
    const perStep = (performance.now() - t0) / steps;
    const frames = 100;
    const t1 = performance.now();
    for (let i = 0; i < frames; i++) {
      sim.update(3 / 60);
      sim.drainEvents();
    }
    const per3x = (performance.now() - t1) / frames;
    console.log(`[perf] ${sim.enemies.length} enemies, ${sim.towers.length} towers, ${sim.projectiles.length} projectiles: ${perStep.toFixed(3)} ms/step, ${per3x.toFixed(3)} ms per 3× frame`);
    expect(sim.enemies.length).toBeGreaterThan(150);
    // Shared CI runners are slow and noisy, so the wall-clock budget is looser there (CI=true).
    expect(perStep).toBeLessThan(process.env.CI ? 6 : 2);
    expect(per3x).toBeLessThan(process.env.CI ? 12 : 4);
  });
});

// The attack shapes S1 stress case (docs/specs/ATTACK_SHAPES.md §7.2 step 7): 6 copies of each shape girl at
// her shape tiers (Momo's Coin Wheel, Kage's Blade Cyclone, Hotaru's Firefly Halo, all at tier 5), 200 enemies,
// the same budget.
describe('performance budget: attack shapes', () => {
  test('18 shape girls + 200 enemies: a step stays under the same limits, straight shots within their caps', () => {
    const real = defaultData().units;
    const SHAPES = [['momo', 'cointoss'], ['kage', 'steel'], ['hotaru', 'lantern']];
    const sim = new Sim({
      stageId: 'perf',
      difficulty: 'normal',
      loadout: SHAPES.map(([unitId]) => ({ unitId })),
      seed: 11,
      data: { stage: { ...STAGE, id: 'perf', mapId: 'perf-map', waves: 99 }, map: PERF_MAP, units: real, enemies: PERF_ENEMIES },
    });
    sim.cash = 1e12;
    const spots = [];
    for (const ty of [3, 7, 11]) for (let tx = 1; tx < 21; tx += 2) spots.push([tx, ty]);
    let placed = 0;
    for (let i = 0; i < spots.length && placed < 18; i++) {
      const [id, pathId] = SHAPES[placed % 3];
      const t = sim.placeTower(id, spots[i][0], spots[i][1]);
      if (!t) continue;
      placed++;
      const p = real[id].paths.findIndex((q) => q.id === pathId);
      // (beyond any real board: six final tiers of one path, so the one-per-path rule is skipped as a save restore does)
      for (let k = 0; k < 5; k++) sim.upgradeTower(t.uid, p, { restoring: true });
    }
    expect(placed).toBe(18);
    expect(sim.towers.filter((t) => t.eff.behavior === 'wheel')).toHaveLength(6);
    expect(sim.towers.filter((t) => t.eff.behavior === 'spin')).toHaveLength(6);
    expect(sim.towers.filter((t) => t.stats.halo)).toHaveLength(6);
    sim.state = 'wave';
    sim.wave = 1;
    sim._spawnQueue = [];
    const kinds = ['blob', 'blob', 'blob', 'armoredBlob', 'fieldOni', 'guardOrc', 'leech', 'flyer'];
    const len = sim.pathData[0].length;
    for (let i = 0; i < 200; i++) sim.spawnEnemy(kinds[i % kinds.length], { dist: (i / 200) * (len - 8) });
    for (let i = 0; i < 120; i++) {
      sim.update(1 / 60);
      sim.drainEvents();
    }
    const steps = 600;
    let maxStraight = 0;
    const t0 = performance.now();
    for (let i = 0; i < steps; i++) {
      sim.update(1 / 60);
      sim.drainEvents();
      if (i % 20 === 0) maxStraight = Math.max(maxStraight, sim.projectiles.filter((p) => p.straight && !p.dead).length);
    }
    const perStep = (performance.now() - t0) / steps;
    console.log(`[perf] shapes: ${sim.enemies.length} enemies, ${sim.towers.length} girls, ${maxStraight} straight shots at most: ${perStep.toFixed(3)} ms/step`);
    expect(sim.enemies.length).toBeGreaterThan(150);
    expect(maxStraight).toBeGreaterThan(0);
    expect(maxStraight).toBeLessThanOrEqual(400);
    expect(perStep).toBeLessThan(process.env.CI ? 6 : 2);
  });
});

// The attack shapes S2 stress case (docs/specs/ATTACK_SHAPES.md §7.2 step 7): 6 copies of each held shape girl at
// tier 5 (Akane's Hearth Stream, Umeko's Searchlight Sweep), 200 enemies, the same budget as S1's case.
describe('performance budget: held attack shapes', () => {
  test('12 held girls + 200 enemies: a step stays under the same limits, every channel open', () => {
    const real = defaultData().units;
    const HELD = [['akane', 'wildfire'], ['umeko', 'lighthouse']];
    const sim = new Sim({
      stageId: 'perf',
      difficulty: 'normal',
      loadout: HELD.map(([unitId]) => ({ unitId })),
      seed: 12,
      data: { stage: { ...STAGE, id: 'perf', mapId: 'perf-map', waves: 99 }, map: PERF_MAP, units: real, enemies: PERF_ENEMIES },
    });
    sim.cash = 1e12;
    const spots = [];
    for (const ty of [3, 7, 11]) for (let tx = 1; tx < 21; tx += 2) spots.push([tx, ty]);
    let placed = 0;
    for (let i = 0; i < spots.length && placed < 12; i++) {
      const [id, pathId] = HELD[placed % 2];
      const t = sim.placeTower(id, spots[i][0], spots[i][1]);
      if (!t) continue;
      placed++;
      const p = real[id].paths.findIndex((q) => q.id === pathId);
      for (let k = 0; k < 5; k++) sim.upgradeTower(t.uid, p, { restoring: true });
    }
    expect(placed).toBe(12);
    expect(sim.towers.filter((t) => t.eff.behavior === 'stream')).toHaveLength(6);
    expect(sim.towers.filter((t) => t.eff.behavior === 'sweep')).toHaveLength(6);
    sim.state = 'wave';
    sim.wave = 1;
    sim._spawnQueue = [];
    const kinds = ['blob', 'blob', 'blob', 'armoredBlob', 'fieldOni', 'guardOrc', 'leech', 'flyer'];
    const len = sim.pathData[0].length;
    for (let i = 0; i < 200; i++) sim.spawnEnemy(kinds[i % kinds.length], { dist: (i / 200) * (len - 8) });
    for (let i = 0; i < 120; i++) {
      sim.update(1 / 60);
      sim.drainEvents();
    }
    const steps = 600;
    let open = 0;
    const t0 = performance.now();
    for (let i = 0; i < steps; i++) {
      sim.update(1 / 60);
      sim.drainEvents();
      if (i % 20 === 0) open = Math.max(open, sim.towers.filter((t) => t.ch).length);
    }
    const perStep = (performance.now() - t0) / steps;
    console.log(`[perf] held shapes: ${sim.enemies.length} enemies, ${sim.towers.length} girls, ${open} channels open at most: ${perStep.toFixed(3)} ms/step`);
    expect(sim.enemies.length).toBeGreaterThan(150);
    expect(open).toBeGreaterThanOrEqual(10);
    expect(perStep).toBeLessThan(process.env.CI ? 6 : 2);
  });
});

// Kohaku's long beam (src/sim/duo.js): Grand Spectrum's four held beams run to the map edge and hit everything on
// their line (up to PRISM_EDGE_PIERCE). Four duos at Grand Spectrum in the LR form (16 map-long beams) on a crowded
// 6-x map, 200 walkers: the same step budget.
describe('performance budget: the long beam', () => {
  test('4 duos × 4 map-long beams + 200 enemies on 6-3: a step stays under the same limits', () => {
    const sim = new Sim({ stageId: '6-3', loadout: [{ unitId: 'kohaku_tsubaki', stats: { lr: true } }], seed: 3 });
    sim.cash = 1e12;
    const spots = [];
    for (let y = 0.5; y < sim.map.height && spots.length < 4; y += 1) {
      for (let x = 0.5; x < sim.map.width && spots.length < 4; x += 1) {
        if (sim.canPlace('kohaku_tsubaki', x, y).ok) {
          const t = sim.placeTower('kohaku_tsubaki', x, y);
          if (t) spots.push(t);
        }
      }
    }
    expect(spots).toHaveLength(4);
    // (beyond any real board: four final tiers of one path, so the one-per-path rule is skipped as a save restore does)
    for (const t of spots) for (let k = 0; k < 5; k++) sim.upgradeTower(t.uid, 1, { restoring: true });
    expect(spots.every((t) => t.beamSpec?.edge && t.beamSpec.projectiles === 4)).toBe(true);
    sim.state = 'wave';
    sim.wave = 1;
    sim._spawnQueue = [];
    const kinds = ['orc_grunt', 'orc_grunt', 'slime_courtier', 'orc_grunt'];
    for (let i = 0; i < 200; i++) {
      const pi = i % sim.pathData.length;
      const e = sim.spawnEnemy(kinds[i % kinds.length], { pathIndex: pi, dist: (i / 200) * (sim.pathData[pi].length - 2) });
      if (e) e.hp = e.maxHp = 1e9;
    }
    for (let i = 0; i < 120; i++) {
      sim.update(1 / 60);
      sim.drainEvents();
    }
    const steps = 600;
    const t0 = performance.now();
    for (let i = 0; i < steps; i++) {
      sim.update(1 / 60);
      sim.drainEvents();
    }
    const perStep = (performance.now() - t0) / steps;
    const held = spots.reduce((n, t) => n + (t.prismBeams || []).filter((b) => b.e).length, 0);
    console.log(`[perf] long beam: ${sim.enemies.length} enemies, ${held} held beams: ${perStep.toFixed(3)} ms/step`);
    expect(held).toBeGreaterThan(0);
    expect(perStep).toBeLessThan(process.env.CI ? 6 : 2);
  });
});
