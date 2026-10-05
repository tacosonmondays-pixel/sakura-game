import { describe, test, expect } from 'vitest';
import { runHeadless, autoPlan } from '../../src/sim/headless.js';
import { Sim } from '../../src/sim/Sim.js';
import { testData, makeSim, run, STAGE, UNITS, ENEMIES, MAP } from './fixtures.js';

const data = testData();

describe('win and lose', () => {
  test('a solid defence wins; result() is ready for applyBattleResult', () => {
    const plan = [
      { at: 1, action: 'place', unitId: 'archer', tx: 3, ty: 3 },
      { at: 1, action: 'place', unitId: 'bomber', tx: 7, ty: 5 },
      { at: 1, action: 'upgrade', unitId: 'archer', tx: 3, ty: 3, path: 0 },
      { at: 2, action: 'place', unitId: 'archer', tx: 10, ty: 3 },
    ];
    const r = runHeadless({ stageId: 'test-1', difficulty: 'normal', plan, seed: 3, data });
    expect(r.won).toBe(true);
    expect(r.failed).toEqual([]);
    expect(r.pendingLeft).toBe(0);
    const res = r.result;
    expect(res).toMatchObject({ stageId: 'test-1', difficulty: 'normal', won: true, wave: 3, livesLeft: 100 });
    expect(res.encountered).toEqual(expect.arrayContaining(['slime', 'elite']));
    expect(res.kills.elite).toBe(1);
    expect(Object.keys(res.stats.damageByTower).length).toBeGreaterThanOrEqual(2);
    expect(res.stats.towersPlaced).toBe(3);
    expect(res.stats.cashEarned).toBeGreaterThan(0);
  });

  test('no defence loses and emits lost', () => {
    const stage = { ...STAGE, waves: 30, waveGen: { pool: [{ enemy: 'orc', weight: 1, from: 1 }], budget: { start: 200, growth: 1.2 }, spacing: 0.3 } };
    const sim = new Sim({ stageId: stage.id, difficulty: 'hard', seed: 1, data: testData({ stage }) });
    expect(sim.maxLives).toBe(50);
    sim.startNextWave();
    const events = [];
    for (let i = 0; i < 400 && sim.state !== 'lost'; i++) {
      sim.update(0.25);
      events.push(...sim.drainEvents());
      if (sim.state === 'between') sim.startNextWave();
    }
    expect(sim.state).toBe('lost');
    expect(sim.lives).toBe(0);
    expect(events.some((e) => e.type === 'lost')).toBe(true);
    expect(events.some((e) => e.type === 'leak')).toBe(true);
    expect(sim.result().won).toBe(false);
    expect(sim.placeTower('archer', 3, 3)).toBe(null);
  });

  test('nightmare has 1 life', () => {
    const sim = makeSim({ difficulty: 'nightmare' });
    expect(sim.lives).toBe(1);
  });

  test('autoStart chains waves', () => {
    const sim = makeSim({ options: { autoStart: true } });
    sim.placeTower('archer', 3, 3);
    sim.placeTower('bomber', 7, 5);
    sim.placeTower('archer', 10, 3);
    sim.startNextWave();
    run(sim, 120, 0.25);
    expect(sim.state).toBe('won');
  });

  test('startNextWave only from prep/between', () => {
    const sim = makeSim();
    expect(sim.state).toBe('prep');
    expect(sim.startNextWave()).toBe(true);
    expect(sim.state).toBe('wave');
    expect(sim.startNextWave()).toBe(false);
  });
});

describe('determinism', () => {
  const plan = [
    { at: 1, action: 'place', unitId: 'archer', tx: 3, ty: 3 },
    { at: 1, action: 'place', unitId: 'chainer', tx: 9, ty: 5 },
    { at: 2, action: 'upgrade', unitId: 'archer', tx: 3, ty: 3, path: 2 },
    { at: 2, action: 'upgrade', unitId: 'archer', tx: 3, ty: 3, path: 2 },
    { at: 2, action: 'upgrade', unitId: 'archer', tx: 3, ty: 3, path: 2 }, // crit (uses rng)
  ];

  test('same seed + same plan → identical battle', () => {
    const a = runHeadless({ stageId: 'test-1', plan, seed: 42, data }).result;
    const b = runHeadless({ stageId: 'test-1', plan, seed: 42, data }).result;
    expect(a).toEqual(b);
  });

  test('frame size does not change the outcome (fixed timestep)', () => {
    const mk = () => {
      const s = makeSim({ seed: 5 });
      s.placeTower('archer', 3, 3);
      s.placeTower('bomber', 7, 5);
      s.startNextWave();
      return s;
    };
    const a = mk();
    const b = mk();
    for (let i = 0; i < 80; i++) a.update(0.25);
    for (let i = 0; i < 80 * 15; i++) b.update(1 / 60);
    expect(a.time).toBeCloseTo(b.time, 6);
    expect(a.cash).toBe(b.cash);
    expect(a.kills).toEqual(b.kills);
    expect(a.enemies.map((e) => [e.uid, e.hp])).toEqual(b.enemies.map((e) => [e.uid, e.hp]));
  });
});

describe('autoPlan', () => {
  const STAGE_V = {
    ...STAGE,
    id: 'test-veil',
    waves: 8,
    startCash: 700,
    waveGen: {
      pool: [{ enemy: 'slime', weight: 3, from: 1 }, { enemy: 'veil', weight: 2, from: 3 }, { enemy: 'orc', weight: 1, from: 4 }],
      budget: { start: 8, growth: 1.25 },
      spacing: 0.7,
      groups: 2,
      fixed: [],
    },
  };
  const vdata = testData({ stage: STAGE_V });

  test('places on well-covered legal tiles and schedules detection when veils are coming', () => {
    const plan = autoPlan('test-veil', ['archer', 'bomber', 'cleaver', 'banker'], { data: vdata });
    expect(plan.length).toBeGreaterThan(8);
    const places = plan.filter((a) => a.action === 'place');
    const sim = new Sim({ stageId: 'test-veil', data: vdata, loadout: ['archer', 'bomber', 'cleaver', 'banker'].map((unitId) => ({ unitId })) });
    sim.cash = 1e9;
    for (const p of places) expect(sim.canPlace(p.unitId, p.tx, p.ty).ok).toBe(true);
    // archer reaches detection on path 2 (tier 2) early in the plan
    const firstDetect = plan.findIndex((a) => a.action === 'upgrade' && a.unitId === 'archer' && a.path === 2);
    expect(firstDetect).toBeGreaterThan(-1);
    expect(firstDetect).toBeLessThan(6);
    const archer = places.find((p) => p.unitId === 'archer');
    expect(Math.abs(archer.ty - 4)).toBeLessThanOrEqual(2);
  });

  test('autoPlan output beats the stage in runHeadless', () => {
    const units = ['archer', 'bomber', 'cleaver'];
    const plan = autoPlan('test-veil', units, { data: vdata });
    const r = runHeadless({ stageId: 'test-veil', plan, seed: 9, data: vdata });
    expect(r.won).toBe(true);
    expect(r.result.kills.veil).toBeGreaterThan(0);
  });

  test('hero in the unit list is placed', () => {
    const plan = autoPlan('test-1', ['archer', 'heroine'], { data });
    expect(plan.some((a) => a.action === 'place' && a.unitId === 'heroine')).toBe(true);
    const r = runHeadless({ stageId: 'test-1', plan, seed: 1, data });
    expect(r.sim.hero).toBeTruthy();
    expect(r.won).toBe(true);
  });

  test('water units only get water tiles', () => {
    const plan = autoPlan('test-1', ['boat'], { data });
    const p = plan.find((a) => a.action === 'place');
    expect(MAP.rows[p.ty][p.tx]).toBe('~');
    void UNITS;
    void ENEMIES;
  });
});
