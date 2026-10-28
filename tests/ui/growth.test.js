// The Potential Board's Growth % (src/ui/potentialBoard/growth.js; docs/specs/POTENTIAL_BOARD.md "Growth"): the plan's
// worked examples, the clamps, the LR weighting and the unit-state reader. Display only, never saved.
import { describe, test, expect } from 'vitest';
import { growthPct, growthParts, growthOf } from '../../src/ui/potentialBoard/growth.js';

describe('Growth %', () => {
  test("the plan's examples: Aoi P4 LV 48 with 4 gates is 53 %; P6 LV 85 with 10 gates is 100 %", () => {
    expect(growthPct({ p: 4, level: 48, gates: 4 })).toBe(53);
    expect(growthPct({ p: 6, level: 85, gates: 10 })).toBe(100);
    expect(growthPct({ p: 1, level: 1, gates: 0 })).toBe(0);
  });

  test('an LR unit: 90 % at the top without the LR step, 100 % with it', () => {
    expect(growthPct({ p: 6, level: 85, gates: 10, lr: true })).toBe(90);
    expect(growthPct({ p: 6, level: 85, gates: 10, lr: true, lrDone: true })).toBe(100);
    // 0.9 of the unfloored growth: Aoi's 53.19 % → 47.87 → 47
    expect(growthPct({ p: 4, level: 48, gates: 4, lr: true })).toBe(47);
    expect(growthPct({ p: 1, level: 1, gates: 0, lr: true })).toBe(0);
  });

  test('each part weighs what the plan says: Potential 50, gates 30, level 20', () => {
    expect(growthPct({ p: 6, level: 1, gates: 0 })).toBe(50);
    expect(growthPct({ p: 1, level: 1, gates: 10 })).toBe(30);
    expect(growthPct({ p: 1, level: 85, gates: 0 })).toBe(20);
    expect(growthParts({ p: 4, level: 48, gates: 4 })).toEqual({ units: 11170, potential: 30, gates: 12, level: 11 });
  });

  test('floored, never rounded up, and monotone in every input', () => {
    // LV 60 at P1 with 5 gates: 15 + 59 × 5 / 21 = 29.05 → 29
    expect(growthPct({ p: 1, level: 60, gates: 5 })).toBe(29);
    let last = -1;
    for (let level = 1; level <= 85; level++) {
      const g = growthPct({ p: 3, level, gates: 6 });
      expect(g).toBeGreaterThanOrEqual(last);
      last = g;
    }
    for (let p = 1; p < 6; p++) expect(growthPct({ p: p + 1, level: 30, gates: 3 })).toBeGreaterThan(growthPct({ p, level: 30, gates: 3 }));
    for (let gates = 0; gates < 10; gates++) expect(growthPct({ p: 2, level: 30, gates: gates + 1 })).toBeGreaterThan(growthPct({ p: 2, level: 30, gates }));
  });

  test('out-of-range and missing numbers clamp (an old save, a hostile mirror)', () => {
    expect(growthPct({ p: 9, level: 300, gates: 40 })).toBe(100);
    expect(growthPct({ p: -2, level: -5, gates: -1 })).toBe(0);
    expect(growthPct({})).toBe(0);
    expect(growthPct()).toBe(0);
    expect(growthPct({ p: '4', level: '48', gates: '4' })).toBe(53);
  });

  test('growthOf reads her unit state (bought Potential `pl`, `breakthrough`, `level`); not owned → 0', () => {
    expect(growthOf({ pl: 4, level: 48, breakthrough: 4 })).toBe(53);
    expect(growthOf({ level: 85, breakthrough: 10 })).toBe(50); // no `pl` = P1
    expect(growthOf({ pl: 6, level: 85, breakthrough: 10 }, { lr: true })).toBe(90);
    expect(growthOf({ pl: 6, level: 85, breakthrough: 10 }, { lr: true, lrDone: true })).toBe(100);
    expect(growthOf(null)).toBe(0);
    expect(growthOf(undefined)).toBe(0);
  });
});
