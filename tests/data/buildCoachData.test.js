// The Build Coach's bench table (docs/specs/BUILD_COACH.md §7, §10).
import { describe, it, expect } from 'vitest';
import { UNITS } from '../../src/data/units.js';
import { SLOT_IDS } from '../../src/data/gearSlots.js';
import { LIVE_CLUBS } from '../../src/data/clubs.js';
import { SET_IDS } from '../../src/data/gearSets.js';
import { BUILD_COACH_DATA, BUILD_COACH_META } from '../../src/data/buildCoachData.js';
import { simId } from '../../tools/simId.mjs';

describe('buildCoachData', () => {
  it('has a row for every playable girl and path', () => {
    for (const u of UNITS) {
      const rows = BUILD_COACH_DATA[u.id];
      expect(rows, u.id).toBeTruthy();
      if (u.kind === 'tower') expect(rows.map((r) => r.path).sort()).toEqual([0, 1, 2]);
      for (const r of rows) {
        for (const s of SLOT_IDS) expect(r.mains[s], `${u.id} ${s}`).toBeTruthy();
        expect(LIVE_CLUBS).toContain(r.club.three);
        for (const s of r.sets) expect(SET_IDS).toContain(s);
        expect(['set', 'blank']).toContain(r.lr);
        expect(r.subs.length).toBeGreaterThan(0);
        if (r.measured) for (const v of Object.values(r.w)) expect(Number.isFinite(v) && v >= 0).toBe(true);
      }
    }
  });

  it('records the sim id it was measured on (a warning when stale)', () => {
    expect(BUILD_COACH_META.simId).toMatch(/^[0-9a-f]{12}$/);
    const now = simId().id;
    if (BUILD_COACH_META.simId !== now) console.warn(`buildCoachData was measured on sim ${BUILD_COACH_META.simId}, this build is ${now}: regenerate it (tools/balance/buildCoachBench.mjs)`);
  });

  it('is never imported by the sim (no hashed file reads it)', () => {
    expect(simId().files.some((f) => /buildCoach/.test(f))).toBe(false);
  });
});
