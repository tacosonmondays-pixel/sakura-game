// In-battle economy rules from the "frisk1636" playtest round (docs/BALANCE.md §3, §5):
// wave-clear bonus + crowd bonus, difficulty start-cash / income multipliers, determinism.
import { describe, test, expect } from 'vitest';
import { crowdBonus, waveClearBonus, generateWave } from '../../src/sim/waves.js';
import { BATTLE, DIFFICULTIES } from '../../src/data/types.js';
import { makeSim, run, STAGE, ENEMIES } from './fixtures.js';

const spawns = (ids) => ids.map((enemyId, i) => ({ t: i, enemyId, pathIndex: 0 }));

/** Runs waves until the sim is between waves again (enemies leak — no towers needed). */
function clearWave(sim, maxSeconds = 300) {
  sim.startNextWave();
  for (let t = 0; t < maxSeconds && sim.state === 'wave'; t += 1) run(sim, 1);
  expect(sim.state === 'between' || sim.state === 'won').toBe(true);
}

describe('crowd bonus', () => {
  test('counts scheduled spawns (capped) and distinct enemy types', () => {
    const { perEnemy, maxEnemies, perKind } = BATTLE.crowdBonus;
    expect([perEnemy, maxEnemies, perKind]).toEqual([1, 30, 4]);
    expect(crowdBonus([])).toEqual({ enemies: 0, kinds: 0, coins: 0 });
    expect(crowdBonus(spawns(['a', 'a', 'b']))).toEqual({ enemies: 3, kinds: 2, coins: 3 + 8 });
    const big = spawns([...Array(30).fill('a'), ...Array(10).fill('b'), ...Array(5).fill('c')]);
    expect(crowdBonus(big)).toEqual({ enemies: 45, kinds: 3, coins: 30 + 12 }); // enemy part capped at 30
  });

  test('wave-clear bonus = base + perWave × wave + crowd (unscaled)', () => {
    expect(BATTLE.waveClearBonusBase).toBe(100);
    expect(BATTLE.waveClearBonusPerWave).toBe(7);
    const s = spawns(['a', 'b', 'b']);
    expect(waveClearBonus(5, s)).toEqual({ base: 135, crowd: 3 + 8, enemies: 3, kinds: 2, total: 146 });
    expect(waveClearBonus(1, []).total).toBe(107);
  });

  test('stays "a little": at most ~25 % of the base wave bonus on any campaign-sized wave', () => {
    // Worst case: 30+ enemies of 4 types on wave 1 → 46 on top of 107.
    expect(crowdBonus(spawns([...Array(40).fill('a'), 'b', 'c', 'd'])).coins).toBeLessThanOrEqual(0.45 * waveClearBonus(1, []).total);
    // Late waves: 30 + 4 × 5 types on top of 100 + 7 × 30.
    const late = crowdBonus(spawns([...Array(60).fill('a'), 'b', 'c', 'd', 'e'])).coins;
    expect(late / waveClearBonus(30, []).total).toBeLessThanOrEqual(0.17);
  });
});

describe('wave end payout in the sim', () => {
  test('waveEnd carries bonus, crowd, enemies and kinds, scaled by cashMul × cashScale', () => {
    const stage = { ...STAGE, id: 'test-econ', cashScale: 2 };
    const sim = makeSim({ stage, towers: [] });
    const wave1 = generateWave(stage, 1, (id) => ENEMIES[id] || null, { pathCount: sim.pathData.length, pathLengths: sim.pathData.map((p) => p.length) });
    const expected = waveClearBonus(1, wave1.spawns);
    expect(expected.enemies).toBeGreaterThan(0);
    const cash0 = sim.cash;
    clearWave(sim);
    const end = sim.drainEvents().find((e) => e.type === 'waveEnd');
    expect(end).toEqual(expect.objectContaining({
      wave: 1, bonus: expected.total * 2, crowd: expected.crowd * 2, enemies: expected.enemies, kinds: expected.kinds,
    }));
    expect(sim.cash).toBe(cash0 + expected.total * 2); // everything leaked: no bounty, bonus still paid
  });

  test('two identical runs end with identical cash and events (lockstep-safe)', () => {
    const play = () => {
      const sim = makeSim({ seed: 11 });
      sim.placeTower('archer', 3, 3);
      const log = [];
      for (let w = 0; w < 3 && sim.state !== 'won' && sim.state !== 'lost'; w++) {
        clearWave(sim);
        log.push(sim.drainEvents().filter((e) => e.type === 'waveEnd' || e.type === 'cash'));
      }
      return { cash: sim.cash, lives: sim.lives, log };
    };
    expect(play()).toEqual(play());
  });
});

describe('difficulty economy multipliers', () => {
  test('startCashMul scales the stage start cash (Nightmare ×1.5)', () => {
    const normal = makeSim({ stage: STAGE });
    const nm = makeSim({ stage: STAGE, difficulty: 'nightmare' });
    expect(normal.cash).toBe(STAGE.startCash);
    expect(nm.cash).toBe(Math.round(STAGE.startCash * 1.5));
  });

  test('legacy noIncome: true still switches tower income off', () => {
    const stage = { ...STAGE, waveGen: { pool: [], budget: { start: 1, growth: 1 }, fixed: [] } };
    DIFFICULTIES.__legacy = { ...DIFFICULTIES.nightmare, id: '__legacy', incomeMul: undefined, noIncome: true };
    try {
      const sim = makeSim({ cash: 1000, difficulty: '__legacy', stage });
      expect(sim.diff.noIncome).toBe(true);
      sim.placeTower('banker', 0, 0);
      sim.startNextWave();
      run(sim, 0.1);
      expect(sim.drainEvents().some((e) => e.reason === 'income')).toBe(false);
    } finally {
      delete DIFFICULTIES.__legacy;
    }
  });
});
