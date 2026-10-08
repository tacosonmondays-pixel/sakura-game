// Campaign balance check (integration): for every campaign stage, the sim's autoPlan bot
// using ONLY the units a free-to-play player owns at that point (starters + free recruits
// granted by earlier stages) must win on Easy at the expected account level for that
// chapter. Normal / Hard / Nightmare are reported as a table (set BALANCE=full) and
// loosely asserted (most Normal stages winnable, Nightmare rarely).
//
//   npx vitest run tests/integration/balance.test.js                  # Easy gate (fast-ish)
//   BALANCE=full npx vitest run tests/integration/balance.test.js     # full table, all difficulties
//   BALANCE_OUT=/tmp/table.md also writes the table to a file (vitest hides console of passing tests)
import { describe, test, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { hasRealData, defaultData } from '../../src/sim/data.js';
import { runHeadless, autoPlan } from '../../src/sim/headless.js';
import { EXPECTED_LEVEL, freeUnitsBefore, statsAtLevel } from '../../tools/balance/f2p.mjs';

// The F2P roster (starters + free recruits from earlier stages) and the expected account level per
// chapter live in tools/balance/f2p.mjs, shared with the balance probe (tools/balance/measure.mjs).
export { EXPECTED_LEVEL };

const ready = hasRealData();
const FULL = process.env.BALANCE === 'full';

/** Runs one stage with the F2P roster. */
export function runStage(stageId, difficulty, level, seed = 1) {
  const d = defaultData();
  const { towers, hero } = freeUnitsBefore(d, stageId);
  const plan = autoPlan(stageId, [...towers, ...(hero ? [hero] : [])]);
  const r = runHeadless({
    stageId, difficulty, plan, seed, maxTime: 7200,
    loadout: towers.map((id) => ({ unitId: id, stats: statsAtLevel(id, level) })),
    hero: hero ? { unitId: hero, stats: statsAtLevel(hero, level) } : null,
  });
  return { won: r.won, wave: r.wave, total: r.sim.totalWaves, lives: r.lives, maxLives: r.maxLives, units: [...towers, ...(hero ? [hero] : [])] };
}

describe.skipIf(!ready)('campaign balance (autoPlan, free units only)', () => {
  test('every campaign stage is winnable on Easy at the expected level', () => {
    const d = defaultData();
    const campaign = Object.values(d.stages).filter((s) => s.kind === 'campaign');
    const lost = [];
    const rows = [];
    for (const s of campaign) {
      const r = runStage(s.id, 'easy', EXPECTED_LEVEL[s.chapter] || 1);
      rows.push(`${s.id.padEnd(4)} easy L${String(EXPECTED_LEVEL[s.chapter]).padEnd(2)} ${r.won ? 'WON ' : 'LOST'} wave ${r.wave}/${r.total} lives ${r.lives}/${r.maxLives}`);
      if (!r.won) lost.push(s.id);
    }
    console.log(`[balance] easy sweep:\n${rows.join('\n')}`);
    if (process.env.BALANCE_OUT && !FULL) writeFileSync(process.env.BALANCE_OUT, rows.join('\n') + '\n');
    expect(lost).toEqual([]);
  }, 600000);

  test.runIf(FULL)('full difficulty table', () => {
    const d = defaultData();
    const campaign = Object.values(d.stages).filter((s) => s.kind === 'campaign');
    const diffs = ['easy', 'normal', 'hard', 'nightmare'];
    const wins = Object.fromEntries(diffs.map((k) => [k, 0]));
    const rows = ['| Stage | Lv | Easy | Normal | Hard | Nightmare | Free units |', '|---|---|---|---|---|---|---|'];
    for (const s of campaign) {
      const lv = EXPECTED_LEVEL[s.chapter] || 1;
      const cells = [];
      let units = [];
      for (const k of diffs) {
        const r = runStage(s.id, k, lv);
        units = r.units;
        if (r.won) wins[k]++;
        cells.push(r.won ? `won (${r.lives}/${r.maxLives})` : `lost w${r.wave}/${r.total}`);
      }
      rows.push(`| ${s.id} | ${lv} | ${cells.join(' | ')} | ${units.join(', ')} |`);
    }
    rows.push(`| **wins** | | ${diffs.map((k) => `${wins[k]}/${campaign.length}`).join(' | ')} | |`);
    console.log(`[balance] full table:\n${rows.join('\n')}`);
    if (process.env.BALANCE_OUT) writeFileSync(process.env.BALANCE_OUT, rows.join('\n') + '\n');
    expect(wins.easy).toBe(campaign.length);
    expect(wins.normal).toBeGreaterThanOrEqual(Math.ceil(campaign.length * 0.6));
    expect(wins.nightmare).toBeLessThanOrEqual(Math.floor(campaign.length * 0.35));
  }, 3600000);
});
