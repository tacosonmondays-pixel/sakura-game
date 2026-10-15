// Co-op freeplay battle UI helpers: big-number formatting (boss bar, results) and the scout's
// pressure chip (what the coming freeplay wave carries).
import { describe, it, expect } from 'vitest';
import { fmtBig } from '../../src/ui/battle/util.js';
import { freeplayPressureInfo, pressureText } from '../../src/ui/battle/scout.js';
import { createCoopSim } from '../../src/online/coop/commands.js';

describe('fmtBig', () => {
  it('k / M / B / T with three significant digits, plain below 100,000', () => {
    expect(fmtBig(0)).toBe('0');
    expect(fmtBig(99999)).toBe('99,999');
    expect(fmtBig(100000)).toBe('100k');
    expect(fmtBig(130000)).toBe('130k');
    expect(fmtBig(568000)).toBe('568k');
    expect(fmtBig(1250000)).toBe('1.25M');
    expect(fmtBig(132300000)).toBe('132M');
    expect(fmtBig(13230000)).toBe('13.2M');
    expect(fmtBig(24.9e9)).toBe('24.9B');
    expect(fmtBig(7.6e12)).toBe('7.6T');
    expect(fmtBig(3e9)).toBe('3B');
    expect(fmtBig(NaN)).toBe('0');
  });
});

describe('the freeplay pressure chip', () => {
  const start = (freeplay) => ({
    seed: 1, stageId: '1-3', difficulty: 'normal', freeplay,
    players: [{ slot: 0, uid: 'a', name: 'A', loadout: [{ unitId: 'aoi' }], hero: null }, { slot: 1, uid: 'b', name: 'B', loadout: [{ unitId: 'rei' }], hero: null }],
  });

  it('is null at or before the goal and outside freeplay', () => {
    const { sim } = createCoopSim(start('blossom'));
    expect(freeplayPressureInfo(sim, 15)).toBeNull();
    expect(freeplayPressureInfo(createCoopSim(start(null)).sim, 16)).toBeNull();
  });

  it('reads the wave HP ramp, armor, speed and Resolve; orange once Resolve is short', () => {
    const { sim } = createCoopSim(start('crimson'));
    const early = freeplayPressureInfo(sim, 16);
    expect(early).toMatchObject({ tier: 'crimson', tierName: 'Crimson Moon', armor: 0, cc: 6, warn: false });
    expect(early.hp).toBeGreaterThan(1);
    const late = freeplayPressureInfo(sim, 15 + 60);
    expect(late.armor).toBe(6);
    expect(late.cc).toBe(1);
    expect(late.warn).toBe(true);
    expect(late.speedPct).toBe(18);
    expect(late.hp).toBeGreaterThan(early.hp);
    const text = pressureText(late);
    expect(text).toMatch(/^Freeplay pressure \(Crimson Moon\): enemies have [\d.,k]+× their base HP, \+6 armor, and move 18 % faster\./);
    expect(text).toMatch(/stuns after 1 s in total and knockback after \d+ tiles?/);
    expect(text).not.toMatch(/undefined|NaN/);
  });
});
