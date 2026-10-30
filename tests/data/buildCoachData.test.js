// The Build Coach's bench table (docs/specs/BUILD_COACH.md §7, §10).
import { describe, it, expect } from 'vitest';
import { UNITS } from '../../src/data/units.js';
import { SLOT_IDS, MAIN_STATS_BY_SLOT } from '../../src/data/gearSlots.js';
import { STEP } from '../../src/systems/buildCoachModel.js';
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
        for (const s of SLOT_IDS) expect(r.mains[s] === null || typeof r.mains[s] === 'string', `${u.id} ${s}`).toBe(true);
        expect(LIVE_CLUBS).toContain(r.club.three);
        for (const s of r.sets) expect(SET_IDS).toContain(s);
        expect(['set', 'blank']).toContain(r.lr);
        expect(r.subs.length).toBeGreaterThan(0);
        if (r.measured) for (const v of Object.values(r.w)) expect(Number.isFinite(v) && v >= 0).toBe(true);
      }
    }
  });

  it('review r1 B1: a measured row moves on some stat, and no damage reads absurd against the roster', () => {
    const rows = Object.values(BUILD_COACH_DATA).flat();
    const med = {};
    for (const r of ['crowd', 'boss']) {
      const v = rows.filter((x) => x.ruler === r).map((x) => x.dps).sort((a, b) => a - b);
      med[r] = v[Math.floor(v.length / 2)];
    }
    for (const [id, list] of Object.entries(BUILD_COACH_DATA)) {
      for (const r of list) {
        if (!r.measured) continue;
        expect(Object.values(r.w).some((v) => v > 0), `${id} ${r.name}: all-zero weights`).toBe(true);
        expect(r.dps, `${id} ${r.name}: ${r.dps} dps vs median ${med[r.ruler]}`).toBeLessThan(100 * med[r.ruler]);
      }
    }
  });

  it('review r1 M7: a support class opens on her support path; a slot whose options all weigh 0 says "any"', () => {
    for (const id of ['miko', 'momo', 'noa', 'umeko']) {
      const best = [...BUILD_COACH_DATA[id]].sort((a, b) => b.rank - a.rank)[0];
      expect(best.ruler, id).toBe('support');
    }
    const umeko = BUILD_COACH_DATA.umeko.find((r) => r.ruler === 'support');
    expect(umeko.mains.charm).toBe(null);
  });

  it('review r2 H1, M2: every measured row moves with ATK (>= 5 % a step); no Cost Reduction main or top-3 line; an estimate never takes a main from a measured stat', () => {
    for (const [id, list] of Object.entries(BUILD_COACH_DATA)) {
      for (const r of list) {
        if (!r.measured) continue;
        expect(r.w.atkPct * STEP.atkPct, `${id} ${r.name}`).toBeGreaterThanOrEqual(0.05);
        expect(Object.values(r.mains), `${id} ${r.name}`).not.toContain('costCut');
        expect(r.subs.slice(0, 3), `${id} ${r.name}`).not.toContain('costCut');
        for (const [slot, m] of Object.entries(r.mains)) {
          if (!m || !r.est.includes(m)) continue;
          const measuredOpts = MAIN_STATS_BY_SLOT[slot].filter((x) => !r.est.includes(x) && x !== 'costCut' && (r.w[x] || 0) > 0);
          expect(measuredOpts, `${id} ${r.name} ${slot}: ${m} is estimated`).toEqual([]);
        }
      }
    }
  });

  it('review r3 M1, L2: a flat DoT path plans without crit; an aura girl\'s unread path plans by her aura', () => {
    const tox = BUILD_COACH_DATA.midori.find((r) => r.name === 'Toxicology');
    expect(tox.measured).toBe(false);
    expect(tox.noCrit).toBe(true);
    expect(Object.values(tox.mains)).not.toContain('critChance');
    expect(Object.values(tox.mains)).not.toContain('critDmg');
    expect(tox.subs).not.toContain('critChance');
    expect(tox.subs).not.toContain('critDmg');
    for (const [id, nm] of [['miko', 'Purification'], ['umeko', 'Undertow Ripples']]) {
      const r = BUILD_COACH_DATA[id].find((x) => x.name === nm);
      expect(r.measured, `${id} ${nm}`).toBe(false);
      expect(r.mains.hair, `${id} ${nm}`).toBe('auraPct');
      expect(r.subs[0], `${id} ${nm}`).toBe('auraPct');
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
