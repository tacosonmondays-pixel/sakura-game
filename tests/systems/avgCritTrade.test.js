// Release v0.1.66 (the coordinator's decision 2 on the no-nerf gate's Wakaba cells): a girl whose crit lines are dead
// (fillStats) gets them as ATK on every hit, and only what reads her average crit (traps and curses: damage × avgCrit;
// burns and poisons: dotMul × avgCrit) takes the better of that ATK and the average crit. So no damage source of any
// girl falls below the ATK fill-in path (fillOnlyBattleStats), the path live had.
import { describe, it, expect } from 'vitest';
import { UNITS } from '../../src/data/units.js';
import { unitBattleStats, fillOnlyBattleStats } from '../../src/systems/progression.js';
import { maxedProfile, LOW_PROFILES } from '../../tools/balance/maxedProfile.mjs';

const EPS = 1e-3; // (r4 rounding on each factor)

describe('the average crit never costs a damage source (per source, every unit)', () => {
  for (const profile of ['maxed', ...Object.keys(LOW_PROFILES)]) {
    it(`${profile}: hits, traps / curses and burns / poisons are each at least the ATK fill-in path`, () => {
      const traded = [];
      for (const u of UNITS) {
        const p = maxedProfile(u.id, { profile });
        const a = unitBattleStats(p, u.id);
        const f = fillOnlyBattleStats(p, u.id);
        // hits (shots, towels, abilities, S5 shapes): damageMul only
        expect(a.damageMul, `${u.id} hits`).toBeGreaterThanOrEqual(f.damageMul - EPS);
        // traps and curses: damageMul × avgCrit
        expect(a.damageMul * a.avgCrit, `${u.id} traps`).toBeGreaterThanOrEqual(f.damageMul * f.avgCrit - EPS);
        // burns and poisons: dotMul × avgCrit
        expect(a.dotMul * a.avgCrit, `${u.id} dots`).toBeGreaterThanOrEqual(f.dotMul * f.avgCrit - EPS);
        if (Math.abs(a.avgCrit - f.avgCrit) > EPS) traded.push(u.id);
      }
      if (profile === 'maxed') expect(traded.sort()).toEqual(['ouka', 'suzu', 'wakaba']);
    });
  }

  it('Wakaba, Ouka and Suzu: every hit at the fill-in ATK; Suzu\'s traps and DoTs at the better (average-crit) path', () => {
    for (const id of ['wakaba', 'ouka', 'suzu']) {
      const p = maxedProfile(id);
      const a = unitBattleStats(p, id);
      const f = fillOnlyBattleStats(p, id);
      expect(a.damageMul).toBe(f.damageMul);
      expect(a.avgCrit).toBeGreaterThan(1);
    }
    const p = maxedProfile('suzu');
    const a = unitBattleStats(p, 'suzu');
    const f = fillOnlyBattleStats(p, 'suzu');
    expect(a.damageMul * a.avgCrit).toBeGreaterThan(f.damageMul * 2);
  });
});
