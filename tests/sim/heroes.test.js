// Two heroes in one Sim (co-op: one per player, by player index) and the view trap: sim.hero /
// sim.heroConfig follow the active player, so nothing inside the step may read them.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { testData, TOWER_IDS, STAGE, run } from './fixtures.js';

const SPOTS = [[8.5, 5.6], [8.5, 2.4]];

function twoHeroSim(a = 'warper', b = 'heroine', stage = { ...STAGE, waves: 10 }) {
  return new Sim({
    stageId: stage.id,
    loadout: TOWER_IDS.map((unitId) => ({ unitId })),
    heroes: [{ unitId: a }, { unitId: b }],
    seed: 5,
    options: { autoStart: true },
    data: testData({ stage }),
  });
}

describe('two heroes', () => {
  test('heroConfigs by index; switching heroConfig places the other hero; sim.hero follows it', () => {
    const sim = twoHeroSim();
    expect(sim.heroConfigs.map((c) => [c.unitId, c.index])).toEqual([['warper', 0], ['heroine', 1]]);
    expect(sim.heroConfig).toBe(sim.heroConfigs[0]);
    const h0 = sim.placeTower('warper', ...SPOTS[0]);
    expect(sim.canPlace('warper', 3.5, 6.5).reason).toBe('heroPlaced');
    expect(sim.canPlace('heroine', 3.5, 6.5).reason).toBe('notInLoadout');
    sim.heroConfig = sim.heroConfigs[1];
    expect(sim.hero).toBe(null);
    const h1 = sim.placeTower('heroine', ...SPOTS[1]);
    expect(h1).toMatchObject({ isHero: true, heroIndex: 1 });
    expect(sim.hero).toBe(h1);
    expect(sim.heroes).toEqual([h0, h1]);
    sim.heroConfig = sim.heroConfigs[0];
    expect(sim.hero).toBe(h0);
    expect(sim.result().heroes.map((r) => r.unitId)).toEqual(['warper', 'heroine']);
  });

  test('both heroes get wave and time XP; two of the same hero are allowed', () => {
    const sim = twoHeroSim('warper', 'warper', { ...STAGE, waves: 2, waveGen: { pool: [], budget: { start: 1, growth: 1 } } });
    const h0 = sim.placeTower('warper', ...SPOTS[0]);
    sim.heroConfig = sim.heroConfigs[1];
    const h1 = sim.placeTower('warper', ...SPOTS[1]);
    sim.heroConfig = sim.heroConfigs[0];
    expect(h0 && h1 && h0 !== h1).toBe(true);
    sim.startNextWave();
    run(sim, 0.5);
    expect(h0.xp).toBeGreaterThan(0);
    expect(h1.xp).toBe(h0.xp);
  });
});

describe('view trap', () => {
  test('reading sim.hero / sim.heroConfig inside the step throws (the trap is on in tests)', () => {
    const sim = twoHeroSim();
    expect(globalThis.__SIM_VIEW_TRAP__).toBe(true);
    sim._stepping = true;
    expect(() => sim.hero).toThrow(/inside the step/);
    expect(() => sim.heroConfig).toThrow(/inside the step/);
    sim._stepping = false;
    expect(() => sim.hero).not.toThrow();
  });

  test('a 10-wave two-hero battle with ults, buys and moves never trips it', () => {
    const sim = twoHeroSim('warper', 'tider');
    sim.cash = 1e6;
    sim.placeTower('warper', ...SPOTS[0]);
    sim.heroConfig = sim.heroConfigs[1];
    const t = sim.placeTower('tider', 5.5, 1.5);
    expect(t).toBeTruthy();
    sim.heroConfig = sim.heroConfigs[0];
    sim.placeTower('archer', 3.5, 6.5);
    sim.placeTower('bomber', 11.5, 6.5);
    sim.startNextWave();
    let steps = 0;
    while (sim.state !== 'won' && sim.state !== 'lost' && steps < 60 * 900) {
      sim.update(1 / 60);
      steps++;
      if (steps % 120 === 0) {
        for (const i of [0, 1]) {
          sim.heroConfig = sim.heroConfigs[i];
          sim.activateUlt();
          const st = sim.heroLevelStatus();
          if (!st.reason) sim.buyHeroLevel({ level: st.level + 1, maxPrice: st.price });
        }
        sim.heroConfig = sim.heroConfigs[0];
        if (steps % 600 === 0) sim.moveHero(steps % 1200 ? SPOTS[1][0] - 3 : SPOTS[0][0], steps % 1200 ? SPOTS[1][1] : SPOTS[0][1]);
      }
    }
    expect(sim.state).toBe('won');
    expect(sim.heroes.every((h) => h.level > 5)).toBe(true);
  });
});
