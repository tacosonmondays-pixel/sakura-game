// The co-op plausibility clamp (src/online/coop/statLimits.js; gear-awaken spec §9.1, Potential v3
// §2.2 / §4.7 / §13.2): an honest loadout passes through unchanged, an absurd one is clamped the
// same way on both clients, `potential` is an integer 1–6 and every unit-stat key has a rule.
import { describe, it, expect } from 'vitest';
import { clampUnitStats, clampPlayer, clampStart, UNIT_STAT_LIMITS, LOADOUT_MAX } from '../../src/online/coop/statLimits.js';
import { createCoopSim, quantize } from '../../src/online/coop/commands.js';
import { withDetMath } from '../../src/online/coop/detMath.js';
import { DEFAULT_UNIT_STATS } from '../../src/sim/constants.js';
import { COOP } from '../../src/data/coop.js';
import { createProfile } from '../../src/systems/save.js';
import { unitBattleStats } from '../../src/systems/progression.js';
import { potentialState } from '../../src/systems/potential.js';
import { addGear, equipGear, rollGear } from '../../src/systems/gear.js';
import { createRng } from '../../src/core/rng.js';
import { UNITS } from '../../src/data/units.js';

/** Every girl at L85 ★5, gate 5, P6, in strong legendary gear (the honest top of this build). */
function maxedProfile() {
  const p = createProfile();
  const rng = createRng(77);
  for (const u of UNITS) {
    p.units[u.id] = { ...(p.units[u.id] || p.units.aoi), level: 85, exp: 0, breakthrough: 10, awaken: 5, ...potentialState(6), gear: { charm: null, ribbon: null, shoes: null } };
  }
  const piece = (slot, main, subs) => {
    const g = rollGear(rng, { slot, rarity: 'legendary' });
    g.main = { stat: main[0], value: main[1], base: main[1] };
    g.subs = subs.map(([stat, value]) => ({ stat, value, base: value, upgrades: 5 }));
    g.level = 10;
    return g;
  };
  equipGear(p, 'kage', addGear(p, piece('charm', ['atkPct', 0.6], [['critChance', 0.3], ['critDmg', 0.9], ['armorPen', 12], ['ratePct', 0.25]])));
  equipGear(p, 'kage', addGear(p, piece('ribbon', ['critDmg', 1.0], [['atkPct', 0.3], ['critChance', 0.3], ['armorPen', 10], ['ratePct', 0.2]])));
  equipGear(p, 'kage', addGear(p, piece('shoes', ['ratePct', 0.6], [['atkPct', 0.3], ['costCut', 0.2], ['ultHaste', 0.3], ['rangePct', 0.3]])));
  return p;
}

describe('the rules', () => {
  it('every DEFAULT_UNIT_STATS key and every unitBattleStats key has a rule', () => {
    for (const k of Object.keys(DEFAULT_UNIT_STATS)) expect(UNIT_STAT_LIMITS[k], k).toBeTruthy();
    for (const k of Object.keys(unitBattleStats(createProfile(), 'aoi'))) expect(UNIT_STAT_LIMITS[k], k).toBeTruthy();
  });

  it("keeps gear's ceilings and adds potential 1–6", () => {
    expect(UNIT_STAT_LIMITS.damageMul).toMatchObject({ lo: 0, hi: 10 });
    expect(UNIT_STAT_LIMITS.rateMul).toMatchObject({ lo: 0, hi: 5 });
    expect(UNIT_STAT_LIMITS.level).toMatchObject({ type: 'int', lo: 1, hi: 99 });
    expect(UNIT_STAT_LIMITS.potential).toMatchObject({ type: 'int', lo: 1, hi: 6 });
    // the honest UR maximum at level 85 (spec §4.7) already fits
    expect(clampUnitStats({ damageMul: 7.57, rateMul: 3.1, level: 85, potential: 6 })).toEqual({ damageMul: 7.57, rateMul: 3.1, level: 85, potential: 6 });
  });

  it('potential is clamped to an integer 1–6', () => {
    const p = (v) => clampUnitStats({ potential: v }).potential;
    expect([0, 1, 3.7, 6, 7, 99, -4].map(p)).toEqual([1, 1, 3, 6, 6, 6, 1]);
    expect([Number.NaN, Infinity, '6', null, undefined, {}].map(p)).toEqual([1, 1, 1, 1, 1, 1]);
  });
});

describe('an honest loadout is the identity', () => {
  it('clamp(unitBattleStats(every girl at L85 P6, strong gear)) equals the input, key order kept', () => {
    const p = maxedProfile();
    for (const u of UNITS) {
      const s = unitBattleStats(p, u.id);
      expect(s.level).toBe(85);
      expect(s.potential).toBe(6);
      const c = clampUnitStats(s);
      expect(c).toEqual(s);
      expect(Object.keys(c)).toEqual(Object.keys(s));
    }
    const kage = unitBattleStats(p, 'kage');
    expect(kage.damageMul).toBeGreaterThan(5);
    expect(clampUnitStats(kage)).toEqual(kage);
    // a fresh save's girls too, and the neutral stats
    const fresh = createProfile();
    for (const u of UNITS) expect(clampUnitStats(unitBattleStats(fresh, u.id))).toEqual(unitBattleStats(fresh, u.id));
    expect(clampUnitStats({ ...DEFAULT_UNIT_STATS })).toEqual({ ...DEFAULT_UNIT_STATS });
  });

  it('a start player passes through unchanged (a partial stats object stays partial, a missing one missing)', () => {
    const player = { slot: 1, uid: 'g', name: 'G', loadout: [{ unitId: 'aoi', stats: { potential: 6 } }, { unitId: 'rei' }], hero: { unitId: 'hikari', stats: unitBattleStats(maxedProfile(), 'hikari') } };
    expect(clampPlayer(player)).toEqual(player);
  });
});

describe('a hostile loadout', () => {
  const hostile = { damageMul: 1000, rateMul: -3, rangeMul: Number.NaN, critChance: 5, critMul: 0, armorPen: 1e9, costMul: 0.01, ultHaste: 9, awakenPassive: 'yes', level: 1e9, awaken: 99, breakthrough: -1, potential: 99, rainbow: 3, pierceK: 9999, auraPct: 5, auraRangeMul: 0, dotMul: 'x', club: 'chess', clubN: 7, __proto__x: 1, damage: 5000 };

  it('clamps every field to its rule, falls back on non-numbers and drops unknown keys', () => {
    expect(clampUnitStats(hostile)).toEqual({ damageMul: 10, rateMul: 0, rangeMul: 1, critChance: 0.75, critMul: 1, armorPen: 50, costMul: 0.75, ultHaste: 0.5, awakenPassive: false, level: 99, awaken: 5, breakthrough: 0, potential: 6, rainbow: 3, pierceK: 200, auraPct: 0.3, auraRangeMul: 1, dotMul: 1, club: null, clubN: 3 });
    expect(clampUnitStats('nope')).toEqual({});
    expect(clampUnitStats([1, 2])).toEqual({});
    expect(clampUnitStats(null)).toBeNull();
  });

  it('caps the loadout at towersPerPlayer + 1 and drops malformed entries', () => {
    expect(LOADOUT_MAX).toBe(COOP.towersPerPlayer + 1);
    const ids = UNITS.filter((u) => u.kind === 'tower').map((u) => u.id);
    const p = clampPlayer({ slot: 0, loadout: [null, 'aoi', { stats: {} }, ...ids.map((unitId) => ({ unitId, stats: hostile }))], hero: { stats: hostile } });
    expect(p.loadout.length).toBeLessThanOrEqual(LOADOUT_MAX);
    expect(p.loadout.every((e) => typeof e.unitId === 'string' && e.stats.damageMul === 10)).toBe(true);
    expect(p.hero).toBeNull();
  });

  it('both clients clamp the same start message the same way and agree on every hash', () => {
    const raw = {
      v: { proto: 5 }, seed: 5150, stageId: '1-3', difficulty: 'normal',
      players: [
        { slot: 0, uid: 'host', name: 'Host', loadout: [{ unitId: 'aoi', stats: unitBattleStats(createProfile(), 'aoi') }], hero: null, color: 1 },
        { slot: 1, uid: 'cheat', name: 'Cheat', loadout: [{ unitId: 'rei', stats: hostile }], hero: null, color: 2 },
      ],
    };
    // what session.js begin() hands the Lockstep on the host (its own message) and on the guest
    const start = clampStart(raw);
    expect(clampStart(start)).toEqual(start);
    expect(start.players[0]).toEqual(raw.players[0]);
    expect({ ...start, players: null }).toEqual({ ...raw, players: null });
    const A = createCoopSim(start, { mySlot: 0 });
    const B = createCoopSim(clampStart(JSON.parse(JSON.stringify(raw))), { mySlot: 1 });
    expect(A.players[1].loadout[0].stats).toMatchObject({ damageMul: 10, level: 99, potential: 6 });
    let seq = 0;
    const cmd = (pl, k, a = []) => ({ t: 0, p: pl, s: seq++, k, a });
    const spot = withDetMath(() => {
      for (let y = 0.55; y < A.sim.map.height; y += 0.35) for (let x = 0.55; x < A.sim.map.width; x += 0.35) {
        const q = quantize(x, y);
        if (!A.sim.placementReason('rei', q[0] / 1024, q[1] / 1024)) return q;
      }
      return null;
    });
    for (const c of [A, B]) expect(c.apply(cmd(1, 'place', ['rei', ...spot])).ok).toBe(true);
    const rei = A.sim.towers[0];
    expect(rei.unitStats.damageMul).toBe(10);
    expect(rei.unitStats.potential).toBe(6);
    expect(Number.isFinite(rei.stats.damage) && Number.isFinite(rei.stats.range)).toBe(true);
    expect(A.hash()).toBe(B.hash());
    for (const c of [A, B]) c.apply(cmd(0, 'wave'));
    for (let i = 0; i < 300; i++) {
      A.step();
      B.step();
    }
    expect(A.hash()).toBe(B.hash());
  });
});
