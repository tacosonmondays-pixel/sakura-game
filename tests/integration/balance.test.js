// Campaign balance sweep (integration). The full table is slow (40 stages × 4 difficulties),
// so it only runs with BALANCE=1:  BALANCE=1 npx vitest run tests/integration/balance.test.js
// It plays every campaign stage with sim/headless autoPlan using ONLY the girls a free player
// owns at that point (starters + free unlocks from earlier stages) at the expected account
// level for the chapter, and prints a table. Assertions encode the balance targets:
//   Easy: every stage won · Normal: most stages won · Nightmare: rarely won by the bot.
import { describe, test, expect } from 'vitest';
import { hasRealData } from '../../src/sim/data.js';
import { runHeadless, autoPlan } from '../../src/sim/headless.js';
import { UNITS } from '../../src/data/units.js';
import { campaignStages } from '../../src/data/stages.js';
import { unitBattleStats } from '../../src/systems/progression.js';

/** Typical F2P level per chapter (books from bounty + campaign drops). */
export const EXPECTED_LEVEL = { 1: 1, 2: 8, 3: 14, 4: 20, 5: 25, 6: 30, 7: 35, 8: 40 };
const DIFFS = (process.env.BALANCE_DIFFS || 'easy,normal,hard,nightmare').split(',');

function freeUnitsBefore(stageId, order) {
  const idx = order.get(stageId);
  const avail = UNITS.filter((u) => {
    const a = u.acquisition || {};
    if (a.type === 'starter') return true;
    return a.type === 'free' && order.has(a.afterStage) && order.get(a.afterStage) < idx;
  });
  const recency = (u) => (u.acquisition?.type === 'free' ? order.get(u.acquisition.afterStage) : -1);
  const towers = avail.filter((u) => u.kind === 'tower').sort((a, b) => recency(b) - recency(a)).slice(0, 8);
  const hero = avail.filter((u) => u.kind === 'hero').sort((a, b) => recency(b) - recency(a))[0];
  return { towers: towers.map((u) => u.id), hero: hero?.id || null };
}

function statsAt(unitId, level) {
  const profile = { units: { [unitId]: { level, breakthrough: Math.min(5, Math.floor((level - 1) / 10)), awaken: 0, gear: {} } }, gear: {} };
  return unitBattleStats(profile, unitId);
}

/** Plays one stage; returns { won, wave, total, lives, maxLives }. */
export function playStage(stage, difficulty, order, { level = EXPECTED_LEVEL[stage.chapter] || 1, seed = 1 } = {}) {
  const { towers, hero } = freeUnitsBefore(stage.id, order);
  const plan = autoPlan(stage.id, [...towers, ...(hero ? [hero] : [])]);
  const r = runHeadless({
    stageId: stage.id, difficulty, plan, seed, maxTime: 7200,
    loadout: towers.map((id) => ({ unitId: id, stats: statsAt(id, level) })),
    hero: hero ? { unitId: hero, stats: statsAt(hero, level) } : null,
  });
  return { won: r.won, wave: r.wave, total: r.sim.totalWaves, lives: r.lives, maxLives: r.maxLives, units: [...towers, hero].filter(Boolean) };
}

describe.skipIf(!hasRealData() || !process.env.BALANCE)('campaign balance sweep', () => {
  test('free units at expected levels', () => {
    const stages = campaignStages();
    const order = new Map(stages.map((s, i) => [s.id, i]));
    const wins = Object.fromEntries(DIFFS.map((d) => [d, 0]));
    const lines = [`stage | lvl | ${DIFFS.map((d) => d.padEnd(16)).join(' | ')}`];
    for (const stage of stages) {
      const cells = DIFFS.map((d) => {
        const r = playStage(stage, d, order);
        if (r.won) wins[d]++;
        return `${r.won ? 'WIN ' : 'loss'} ${`w${r.wave}/${r.total}`.padEnd(7)} ${String(r.lives).padStart(3)}`.padEnd(16);
      });
      lines.push(`${stage.id.padEnd(5)} | ${String(EXPECTED_LEVEL[stage.chapter]).padStart(3)} | ${cells.join(' | ')}`);
    }
    lines.push(`wins  |     | ${DIFFS.map((d) => `${wins[d]}/${stages.length}`.padEnd(16)).join(' | ')}`);
    console.log(`[balance]\n${lines.join('\n')}`);
    if (wins.easy != null) expect(wins.easy).toBe(stages.length);
    if (wins.normal != null) expect(wins.normal).toBeGreaterThanOrEqual(Math.ceil(stages.length * 0.6));
    if (wins.nightmare != null) expect(wins.nightmare).toBeLessThanOrEqual(Math.floor(stages.length * 0.35));
  }, 1800000);
});
