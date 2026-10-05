import { describe, test, expect } from 'vitest';
import { makeSim, run, STAGE } from './fixtures.js';

const STAGE_W = {
  ...STAGE,
  id: 'test-warn',
  waves: 3,
  introduces: ['veil', 'veiled'],
  waveGen: {
    pool: [{ enemy: 'veil', weight: 1, from: 1 }],
    budget: { start: 4, growth: 1 },
    spacing: 0.4,
    groups: 1,
    fixed: [{ wave: 2, enemy: 'boss', count: 1, delay: 1 }],
  },
};

describe('pre-wave warnings', () => {
  test('flags new enemies and traits the field cannot answer, with formation suggestions', () => {
    const sim = makeSim({ stage: STAGE_W });
    sim.placeTower('archer', 3, 3);
    const w = sim.waveWarnings();
    const counter = w.find((x) => x.kind === 'counter' && x.trait === 'veiled');
    expect(counter).toBeTruthy();
    expect(counter.severity).toBe('danger');
    expect(counter.capabilities).toEqual(['detection', 'reveal']);
    expect(counter.suggest).toContain('seer');
    expect(counter.text).toMatch(/^Veiled enemies incoming \(veil ×4\) — bring Veil Sight or Reveal\. seer can help\.$/);
    expect(w.find((x) => x.kind === 'new' && x.enemyId === 'veil')).toBeTruthy();
    expect(w[0].severity).toBe('danger');

    sim.placeTower('seer', 5, 3);
    expect(sim.waveWarnings().some((x) => x.trait === 'veiled')).toBe(false);
  });

  test('announces bosses on their wave', () => {
    const sim = makeSim({ stage: STAGE_W });
    const w2 = sim.waveWarnings(2);
    expect(w2[0]).toMatchObject({ kind: 'boss', severity: 'danger', enemyId: 'boss' });
    expect(sim.waveWarnings(99)).toEqual([]);
  });
});

describe('leak records and debrief', () => {
  test('records leaks per enemy and wave and explains the defeat', () => {
    const sim = makeSim({ stage: STAGE_W, difficulty: 'hard' });
    sim.placeTower('archer', 3, 3);
    sim.startNextWave();
    run(sim, 30, 0.25);
    expect(sim.stats.leaksByEnemy.veil).toBe(4);
    expect(sim.stats.leaksByWave[1]).toBe(4);
    expect(sim.stats.leakLog[0]).toMatchObject({ wave: 1, enemyId: 'veil', lives: 1 });
    const d = sim.debrief();
    expect(d.livesLost).toBe(4);
    expect(d.leaks.enemies[0]).toMatchObject({ enemyId: 'veil', count: 4, lives: 4 });
    expect(d.leaks.traits[0]).toMatchObject({ trait: 'veiled', lives: 4 });
    expect(d.lines[0]).toBe('Most leaks were veil on wave 1 (4 lives).');
    expect(d.lines[1]).toMatch(/Veiled enemies caused 100% of lost lives and none of your girls had Veil Sight or Reveal\. Try seer\./);
    const r = sim.result();
    expect(r.stats.leakLog).toHaveLength(4);
  });

  test('flawless wins say so and credit the top damage dealer', () => {
    const stage = { ...STAGE, waves: 1 };
    const sim = makeSim({ stage });
    sim.placeTower('archer', 3, 3);
    sim.placeTower('bomber', 7, 5);
    sim.startNextWave();
    run(sim, 30, 0.25);
    expect(sim.state).toBe('won');
    const d = sim.debrief();
    expect(d.lines[0]).toBe('Flawless defence — no lives lost.');
    expect(d.damage[0].unitId).toMatch(/archer|bomber/);
    expect(d.lines[1]).toMatch(/dealt the most damage/);
  });
});
