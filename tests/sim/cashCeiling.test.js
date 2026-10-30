// The maths ceiling on cash (docs/specs/GEAR_UPDATE.md r3 L16): Treasurer's lifted interest grows cash wave over wave,
// so cash (pooled and each co-op wallet) stops at CASH_MAX; it stays a finite exact integer and the carry never NaN.
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { CASH_MAX, INCOME_INTEREST_SET_MAX, INCOME_INTEREST_MAX } from '../../src/sim/constants.js';
import { unitBattleStats } from '../../src/systems/progression.js';

const momo = { ...unitBattleStats(null, 'momo'), set: 'treasurer', setN: 5 };

function treasurerBoard() {
  const sim = new Sim({ stageId: '1-3', difficulty: 'normal', seed: 3, loadout: [{ unitId: 'momo', stats: momo }], options: { autoStart: false, endless: true } });
  sim.cash = 1e6;
  for (let y = 0.55; y < sim.map.height; y += 0.35) {
    for (let x = 0.55; x < sim.map.width; x += 0.35) {
      if (sim.towers.length < 6 && !sim.placementReason('momo', x, y)) sim.placeTower('momo', x, y);
    }
  }
  // Piggy Bank's interest (path 1 tier 5) on the first; the rest at tier 4
  sim.cash = 1e9;
  for (const t of sim.towers) for (let k = 0; k < 5; k++) sim.upgradeTower(t.uid, 0);
  return sim;
}

describe('cash ceiling', () => {
  it('2,000 wave clears of a Treasurer board at the interest ceiling: finite, an exact integer, ≤ CASH_MAX', () => {
    expect(CASH_MAX).toBe(1e12);
    expect(INCOME_INTEREST_SET_MAX).toBe(5000);
    expect(INCOME_INTEREST_SET_MAX).toBeGreaterThan(INCOME_INTEREST_MAX);
    const sim = treasurerBoard();
    expect(sim.towers.length).toBeGreaterThan(0);
    expect(sim.towers.some((t) => t.stats.income?.interest > 0)).toBe(true);
    sim.cash = CASH_MAX - 1e6;
    for (let w = 0; w < 2000; w++) {
      sim.state = 'wave';
      sim._spawnIndex = sim._spawnQueue.length;
      sim.enemies.length = 0;
      sim._checkWaveEnd();
      sim.drainEvents();
    }
    expect(Number.isFinite(sim.cash)).toBe(true);
    expect(Number.isInteger(sim.cash)).toBe(true);
    expect(sim.cash).toBe(CASH_MAX);
    expect(Number.isNaN(sim._cashCarry)).toBe(false);
    expect(JSON.parse(JSON.stringify({ c: sim.cash })).c).toBe(CASH_MAX);
  });

  it('owner-credited coins stop at CASH_MAX too (solo cash and a co-op wallet)', () => {
    const sim = treasurerBoard();
    sim.cash = CASH_MAX - 5;
    expect(sim._gainCashFor(0, 100)).toBe(5);
    expect(sim.cash).toBe(CASH_MAX);
    sim.ownerCash = [CASH_MAX - 3, 0];
    expect(sim._gainCashFor(0, 100)).toBe(3);
    expect(sim.ownerCash[0]).toBe(CASH_MAX);
  });
});
