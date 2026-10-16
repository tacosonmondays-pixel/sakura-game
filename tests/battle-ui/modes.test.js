// Battle-mode and map-rule warnings, banners and pad hints (docs/specs/CODEX_MODES.md §8.3).
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { hasRealData } from '../../src/sim/data.js';
import { ruleWarnings, resultRibbonRow, dropsTitle } from '../../src/ui/battle/modes.js';

const mk = (stageId, mode, difficulty = 'normal') => new Sim({ stageId, difficulty, loadout: [{ unitId: 'aoi' }, { unitId: 'rei' }], options: { mode } });

describe.skipIf(!hasRealData())('rule warnings', () => {
  it('route warnings follow routeFlippedFor in Standard and Reverse Route', () => {
    for (const mode of ['standard', 'reverse']) {
      const s = mk('4-2', mode);
      expect(ruleWarnings(s, 1).some((w) => w.kind === 'route')).toBe(false);
      expect(ruleWarnings(s, 2).find((w) => w.kind === 'route')?.text).toBe('Wave 2 comes in through the goal gate. Cover the far end too.');
      expect(ruleWarnings(s, 3).some((w) => w.kind === 'route')).toBe(false);
    }
    expect(ruleWarnings(mk('4-1', 'reverse'), 2)).toEqual([]);
  });

  it('wave-1 mode warnings and Shifting Stars affinity', () => {
    expect(ruleWarnings(mk('6-3', 'ironclad'), 1).find((w) => w.kind === 'mode')?.text).toMatch(/^Ironclad: every enemy has \+6 armor \(bosses \+12\)\./);
    expect(ruleWarnings(mk('6-3', 'ironclad', 'hard'), 1).find((w) => w.kind === 'mode')?.text).toMatch(/\+4 armor \(bosses \+8\)/);
    expect(ruleWarnings(mk('1-1', 'laststand'), 1)[0]).toMatchObject({ kind: 'mode', severity: 'danger' });
    expect(ruleWarnings(mk('8-4', 'standard'), 2).find((w) => w.kind === 'affinity')?.text).toBe('Shifting Stars: Frost hits +50% this wave.');
  });

  it('results: no ribbon row for plain Standard wins; the drops header', () => {
    const s = mk('1-1', 'rush', 'hard');
    // (the ribbon row's text is checked in a browser by e2e/codex-modes.mjs step 5; tests run without a DOM)
    expect(resultRibbonRow({ mode: 'standard', newRibbon: false }, s, {})).toBeNull();
    expect(dropsTitle({ rewardDifficulty: 'normal' }, s, 'Drops')).toBe('Drops (Normal)');
    expect(dropsTitle({ rewardDifficulty: 'hard' }, s, 'Drops')).toBe('Drops');
  });
});
