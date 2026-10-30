// The LR bar (the owner, Oct 30: "LRs should beat every character, that's the point"; docs/BALANCE.md "The LR bar"):
// every LR tier-5 build (the duo's and Tenka's, in their LR form) deals at least LR_MARGIN (1.25) × the best non-LR
// build of any unit, heroes included, on a crowd and on a boss, on the round-5 bench (fully maxed, Umeko + Midori,
// seeds 9/1/2). LR_BAR pins the best non-LR numbers (tools/balance/lrBar.mjs --bar re-measures them).
import { describe, test, expect } from 'vitest';
import { defaultData } from '../../src/sim/data.js';
import { checkLr, LR_BAR, LR_MARGIN, LR_BUILDS, KNOWN } from '../../tools/balance/lrBar.mjs';

describe('the LR bar', () => {
  test('the bar is the best non-LR crowd and boss, with the known lab numbers in it', () => {
    expect(LR_MARGIN).toBe(1.25);
    expect(LR_BAR.crowd.dps).toBeGreaterThanOrEqual(Math.max(...KNOWN.map((k) => k.crowd)));
    expect(LR_BAR.boss.dps).toBeGreaterThanOrEqual(Math.max(...KNOWN.map((k) => k.boss)));
    expect(LR_BUILDS).toHaveLength(6);
  });

  test('every LR build is at least 1.25× the bar on a crowd and on a boss', () => {
    const out = checkLr(defaultData());
    for (const r of out) {
      expect(r.crowdX, `${r.unitId} ${r.build} crowd ${Math.round(r.crowd)} vs bar ${LR_BAR.crowd.dps}`).toBeGreaterThanOrEqual(LR_MARGIN);
      expect(r.bossX, `${r.unitId} ${r.build} boss ${Math.round(r.boss)} vs bar ${LR_BAR.boss.dps}`).toBeGreaterThanOrEqual(LR_MARGIN);
    }
  }, 300000);
});
