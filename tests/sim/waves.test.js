import { describe, test, expect } from 'vitest';
import { generateWave, summarizeWave } from '../../src/sim/waves.js';
import { MAX_SPAWNS_PER_WAVE } from '../../src/sim/constants.js';
import { ENEMIES, STAGE, MAP2, makeSim, run } from './fixtures.js';

const lookup = (id) => ENEMIES[id] || null;

const STAGE_BIG = {
  ...STAGE,
  id: 'test-big',
  waves: 20,
  waveGen: {
    pool: [
      { enemy: 'slime', weight: 4, from: 1, to: 10 },
      { enemy: 'runner', weight: 2, from: 3 },
      { enemy: 'orc', weight: 2, from: 5 },
      { enemy: 'elite', weight: 1, from: 8 },
    ],
    budget: { start: 8, growth: 1.15 },
    spacing: 0.6,
    groups: 3,
    fixed: [{ wave: 10, enemy: 'boss', count: 1, delay: 5 }],
  },
};

describe('wave generation', () => {
  test('deterministic for the same stage + wave (independent of battle seed)', () => {
    for (let w = 1; w <= 20; w++) {
      expect(generateWave(STAGE_BIG, w, lookup)).toEqual(generateWave(STAGE_BIG, w, lookup));
    }
    const a = makeSim({ seed: 1, stage: STAGE_BIG });
    const b = makeSim({ seed: 999, stage: STAGE_BIG });
    for (let w = 1; w <= 20; w++) expect(a.waveInfo(w)).toEqual(b.waveInfo(w));
  });

  test('respects pool from/to windows and grows the budget', () => {
    const ids = (w) => new Set(generateWave(STAGE_BIG, w, lookup).spawns.map((s) => s.enemyId));
    for (let w = 1; w <= 4; w++) expect(ids(w).has('orc')).toBe(false);
    for (let w = 11; w <= 20; w++) expect(ids(w).has('slime')).toBe(false);
    for (let w = 1; w <= 7; w++) expect(ids(w).has('elite')).toBe(false);
    const threat = (w) => generateWave(STAGE_BIG, w, lookup).spawns.reduce((a, s) => a + (ENEMIES[s.enemyId].threat ?? 1), 0);
    expect(threat(15)).toBeGreaterThan(threat(2) * 3);
  });

  test('later waves mix more groups; fixed spawns arrive with their delay', () => {
    const w1 = generateWave(STAGE_BIG, 1, lookup);
    expect(w1.groups).toHaveLength(1);
    const w10 = generateWave(STAGE_BIG, 10, lookup);
    expect(w10.groups.filter((g) => !g.fixed).length).toBeGreaterThanOrEqual(2);
    const boss = w10.groups.find((g) => g.fixed);
    expect(boss).toMatchObject({ enemyId: 'boss', count: 1, start: 5 });
    expect(w10.spawns.find((s) => s.enemyId === 'boss').t).toBe(5);
  });

  test('spawn times are sorted and spaced', () => {
    const w = generateWave(STAGE_BIG, 12, lookup);
    for (let i = 1; i < w.spawns.length; i++) expect(w.spawns[i].t).toBeGreaterThanOrEqual(w.spawns[i - 1].t);
  });

  test('huge budgets are capped and converted into HP', () => {
    const st = { ...STAGE_BIG, waveGen: { ...STAGE_BIG.waveGen, budget: { start: 5000, growth: 1 } } };
    const w = generateWave(st, 1, lookup);
    expect(w.spawns.length).toBeLessThanOrEqual(MAX_SPAWNS_PER_WAVE);
    expect(w.hpMul).toBeGreaterThan(10);
  });

  test('two-lane maps alternate lanes', () => {
    const sim = makeSim({ map: { ...MAP2, id: 'test-map' } });
    const w = sim._getWave(3);
    const lanes = new Set(w.spawns.map((s) => s.pathIndex));
    expect(lanes).toEqual(new Set([0, 1]));
  });

  test('summaries list counts and trait keys for scouting', () => {
    const sum = summarizeWave(generateWave(STAGE_BIG, 10, lookup), lookup);
    const boss = sum.find((s) => s.enemyId === 'boss');
    expect(boss).toMatchObject({ count: 1, tier: 'boss' });
    expect(boss.traits).toContain('airborne'); // from its phase
    const sim = makeSim({ stage: STAGE_BIG });
    expect(sim.nextWavePreview()).toEqual(sim.waveInfo(1));
    expect(sim.waveInfo(0)).toEqual([]);
    expect(sim.waveInfo(21)).toEqual([]);
    const orcInfo = summarizeWave(generateWave(STAGE_BIG, 9, lookup), lookup).find((s) => s.enemyId === 'orc');
    if (orcInfo) expect(orcInfo.traits).toContain('armored');
  });
});

describe('endless / challenge mode', () => {
  test('options.endless continues past the last wave with growing HP', () => {
    const stage = { ...STAGE, waves: 2, waveGen: { pool: [{ enemy: 'slime', weight: 1, from: 1 }], budget: { start: 2, growth: 1 }, spacing: 0.1 } };
    const sim = makeSim({ stage, options: { endless: true } });
    expect(sim.totalWaves).toBe(Infinity);
    expect(sim._getWave(6).hpMul).toBeGreaterThan(sim._getWave(2).hpMul * 1.2);
    sim.placeTower('archer', 3, 3);
    sim.placeTower('archer', 9, 5);
    for (let i = 0; i < 5; i++) {
      expect(sim.startNextWave()).toBe(true);
      run(sim, 15, 0.25);
    }
    expect(sim.state).toBe('between');
    expect(sim.wavesCleared).toBe(5);
    expect(sim.result()).toMatchObject({ won: false, wavesCleared: 5 });
  });

  test('a stage with waves = Infinity is endless', () => {
    const stage = { ...STAGE, id: 'challenge', kind: 'challenge', waves: Infinity };
    const sim = makeSim({ stage });
    expect(sim.endless).toBe(true);
    expect(sim.waveInfo(100).length).toBeGreaterThan(0);
  });
});
