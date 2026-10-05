import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STAGE, UNITS, ENEMIES } from './fixtures.js';

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
    expect(perStep).toBeLessThan(2);
    expect(per3x).toBeLessThan(4);
  });
});
