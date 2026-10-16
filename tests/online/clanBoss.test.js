// The clan boss caps (CLAN_BOSSES[].hitCap, mirrored by the migration's boss_hit_cap()) against
// the real sim: a maxed team that clears each Total Assault arena must fit under its boss's cap
// (else honest players would lose damage), the cap must stay close to that (else a forged
// submit gains a lot), and the fastest clear at 3× must not beat BOSS_FULL_RUN_SECONDS (the
// server's "a full run takes at least this long" allowance).
import { describe, it, expect } from 'vitest';
import { runHeadless, autoPlan } from '../../src/sim/headless.js';
import { UNITS } from '../../src/data/units.js';
import { BATTLE } from '../../src/data/types.js';
import { CLAN_BOSSES, BOSS_FULL_RUN_SECONDS } from '../../src/online/clanRules.js';

const towers = UNITS.filter((u) => u.kind !== 'hero').map((u) => u.id);
const hero = UNITS.find((u) => u.kind === 'hero')?.id;
const MAXED = { damageMul: 16, rateMul: 5.5, rangeMul: 1, critChance: 0.2, critMul: 1.5, armorPen: 0 };

describe('clan boss caps fit the real battles', () => {
  for (const boss of CLAN_BOSSES) {
    it(`${boss.id}: a maxed clear deals 75–100% of the cap, and takes ≥ ${BOSS_FULL_RUN_SECONDS} s at top speed`, () => {
      const plan = autoPlan(boss.stageId, [...towers.slice(0, 14), hero].filter(Boolean));
      const loadout = [...new Set(plan.filter((a) => a.action === 'place').map((a) => a.unitId))].filter((id) => id !== hero).map((unitId) => ({ unitId, stats: MAXED }));
      const r = runHeadless({ stageId: boss.stageId, difficulty: 'normal', plan, loadout, hero: hero ? { unitId: hero, stats: MAXED } : null, seed: 1 });
      const dealt = Object.values(r.sim.stats.damageByTower).reduce((a, b) => a + b, 0);
      expect(r.won, `${boss.id} cleared`).toBe(true);
      expect(dealt).toBeLessThanOrEqual(boss.hitCap);
      expect(dealt).toBeGreaterThanOrEqual(boss.hitCap * 0.75);
      expect(r.time / Math.max(...(BATTLE.speeds || [1, 2, 3]))).toBeGreaterThanOrEqual(BOSS_FULL_RUN_SECONDS);
    }, 60000);

    // Potential (src/data/potential.js): the same maxed team with every girl at P6 still fits the cap and
    // still takes the full-run allowance
    it(`${boss.id}: the same clear with every girl at Potential 6 stays under the cap and ≥ ${BOSS_FULL_RUN_SECONDS} s`, () => {
      const P6 = { ...MAXED, potential: 6 };
      const plan = autoPlan(boss.stageId, [...towers.slice(0, 14), hero].filter(Boolean));
      const loadout = [...new Set(plan.filter((a) => a.action === 'place').map((a) => a.unitId))].filter((id) => id !== hero).map((unitId) => ({ unitId, stats: P6 }));
      const r = runHeadless({ stageId: boss.stageId, difficulty: 'normal', plan, loadout, hero: hero ? { unitId: hero, stats: P6 } : null, seed: 1 });
      const dealt = Object.values(r.sim.stats.damageByTower).reduce((a, b) => a + b, 0);
      expect(r.won, `${boss.id} cleared`).toBe(true);
      expect(dealt).toBeLessThanOrEqual(boss.hitCap);
      expect(r.time / Math.max(...(BATTLE.speeds || [1, 2, 3]))).toBeGreaterThanOrEqual(BOSS_FULL_RUN_SECONDS);
    }, 60000);
  }
});
