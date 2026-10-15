import { describe, test, expect } from 'vitest';
import { resolveStats, crosspathBlock, mergeStatusList, applyModSet, normalizeBase } from '../../src/sim/mods.js';
import { UNITS, makeSim } from './fixtures.js';

describe('ModSet application', () => {
  test('damage add then mul: (base + Σadd) × Πmul', () => {
    const s = resolveStats(UNITS.archer, { tiers: [2, 0, 0] });
    expect(s.damage).toBeCloseTo((10 + 5) * 1.5, 6);
  });

  test('rateMul multiplies, range adds, grants, replace', () => {
    const s = resolveStats(UNITS.archer, { tiers: [5, 0, 2] });
    expect(s.range).toBeCloseTo(4.5, 6);
    expect(s.detection).toBe(true);
    expect(s.pierce).toBe(3);
    expect(s.armorPen).toBe(2);
    expect(s.projectiles).toBe(3);
    expect(s.attackType).toBe('mystic');
    expect(s.damage).toBeCloseTo(15 * 1.5 * 2, 6);
    const r = resolveStats(UNITS.archer, { tiers: [0, 2, 0] });
    expect(r.rate).toBeCloseTo(2 * 1.25 * 1.2, 6);
  });

  test('status append keeps stronger values per type', () => {
    const s = resolveStats(UNITS.archer, { tiers: [0, 4, 0] });
    const slow = s.status.filter((x) => x.type === 'slow');
    expect(slow).toHaveLength(1);
    expect(slow[0].amount).toBe(0.5);
    expect(slow[0].duration).toBe(1);
  });

  test('crit chance adds, mul takes max; eliteMul; mark max; aura and income merge', () => {
    const s = resolveStats(UNITS.archer, { tiers: [0, 0, 5] });
    expect(s.crit.chance).toBeCloseTo(0.2, 6);
    expect(s.crit.mul).toBe(2);
    expect(s.eliteMul).toBe(1.5);
    expect(s.mark).toEqual({ bonus: 0.2, duration: 2 });
    expect(s.aura.range).toBe(3);
    expect(s.aura.dmgMul).toBeCloseTo(1.1, 6);
    expect(s.income.perWave).toBe(50);
  });

  test('trap / turret / ramp / silence / reveal / knockback keys', () => {
    const s = normalizeBase({ damage: 1 }, { attackType: 'blast' });
    const acc = { damageAdd: 0, damageMul: 1 };
    applyModSet(s, {
      trap: { max: 2, damage: 10, splash: 0.5, status: [{ type: 'stun', duration: 1 }] },
      turret: { max: 1, damage: 3, range: 1, rate: 1.5 },
      ramp: { per: 0.1, max: 0.5 },
      silence: 1, reveal: 2, knockback: 0.5,
    }, acc);
    applyModSet(s, { trap: { max: 1 }, turret: { rate: 2 }, ramp: { per: 0.1 } }, acc);
    expect(s.trap.max).toBe(3);
    expect(s.trap.damage).toBe(10);
    expect(s.trap.splash).toBeCloseTo(1.3, 6);
    expect(s.trap.status[0].type).toBe('stun');
    expect(s.turret.max).toBe(1);
    expect(s.turret.rate).toBeCloseTo(3, 6);
    expect(s.turret.range).toBe(4);
    expect(s.ramp.per).toBeCloseTo(0.2, 6);
    expect(s.ramp.max).toBe(0.5);
    expect([s.silence, s.reveal, s.knockback]).toEqual([1, 2, 0.5]);
  });

  test('unit battle stats from the profile scale the result', () => {
    const s = resolveStats(UNITS.archer, { unitStats: { damageMul: 2, rateMul: 1.5, rangeMul: 1.1, critChance: 0.1, critMul: 1.2, armorPen: 1, awakenPassive: true } });
    expect(s.damage).toBeCloseTo(10 * 1.1 * 2, 6);
    expect(s.rate).toBeCloseTo(3, 6);
    expect(s.range).toBeCloseTo(3.85, 6);
    expect(s.crit.chance).toBeCloseTo(0.1, 6);
    expect(s.crit.mul).toBeCloseTo(1.8, 6);
    expect(s.armorPen).toBe(1);
  });

  test('mergeStatusList: missing chance means always', () => {
    const list = [{ type: 'stun', duration: 1, chance: 0.2 }];
    mergeStatusList(list, [{ type: 'stun', duration: 0.5 }]);
    expect(list[0].chance).toBeUndefined();
    expect(list[0].duration).toBe(1);
  });
});

describe('crosspath rules (BTD6)', () => {
  test('at most two paths, only one above tier 2', () => {
    expect(crosspathBlock([0, 0, 0], 0)).toBe(null);
    expect(crosspathBlock([2, 2, 0], 2)).toBe('crosspath');
    expect(crosspathBlock([2, 2, 0], 0)).toBe(null);
    expect(crosspathBlock([3, 2, 0], 1)).toBe('crosspath');
    expect(crosspathBlock([3, 1, 0], 1)).toBe(null);
    expect(crosspathBlock([5, 2, 0], 0)).toBe('max');
    expect(crosspathBlock([4, 0, 2], 2)).toBe('crosspath');
  });

  test('sim.upgradeStatus reports reasons and costs', () => {
    const sim = makeSim();
    const t = sim.placeTower('archer', 3, 3);
    expect(sim.upgradeStatus(t.uid, 0)).toMatchObject({ tier: 0, cost: 100, locked: false, reason: null });
    for (let i = 0; i < 3; i++) expect(sim.upgradeTower(t.uid, 0)).toBe(true);
    expect(sim.upgradeTower(t.uid, 1)).toBe(true);
    expect(sim.upgradeTower(t.uid, 1)).toBe(true);
    expect(sim.upgradeStatus(t.uid, 1)).toMatchObject({ tier: 2, locked: true, reason: 'crosspath' });
    expect(sim.upgradeStatus(t.uid, 2)).toMatchObject({ tier: 0, locked: true, reason: 'crosspath' });
    sim.upgradeTower(t.uid, 0);
    sim.upgradeTower(t.uid, 0);
    expect(sim.upgradeStatus(t.uid, 0)).toMatchObject({ tier: 5, next: null, locked: true, reason: 'max' });
    sim.cash = 0;
    const t2 = sim.towers.length;
    expect(t2).toBe(1);
  });

  test('cash lock and upgrade spends + applies mods', () => {
    const sim = makeSim({ cash: 450 });
    const t = sim.placeTower('archer', 3, 3);
    expect(sim.cash).toBe(250);
    expect(sim.upgradeTower(t.uid, 0)).toBe(true);
    expect(sim.cash).toBe(150);
    expect(t.eff.damage).toBe(15);
    expect(sim.upgradeStatus(t.uid, 0)).toMatchObject({ locked: true, reason: 'cash', cost: 200 });
    expect(sim.upgradeTower(t.uid, 0)).toBe(false);
    expect(t.spent).toBe(300);
  });

  test('difficulty and profile costMul scale tower and upgrade costs', () => {
    const sim = makeSim({ difficulty: 'nightmare', stats: { archer: { costMul: 0.9 } } });
    expect(sim.placeCost('archer')).toBe(215); // 200 × 1.2 × 0.9 = 216 → 215
    const t = sim.placeTower('archer', 3, 3);
    expect(sim.upgradeStatus(t.uid, 0).cost).toBe(110); // 100 × 1.08 = 108 → 110
  });
});

// Potential (src/data/potential.js): P1 / absent is bit-identical to the build before Potential,
// and each kind of step lands where the spec says (docs/specs/POTENTIAL.md §11.1).
import { UNITS as REAL_UNITS, UNIT_MAP as REAL } from '../../src/data/units.js';

describe('Potential in resolveStats', () => {
  test('P1 and no potential: every girl × tiers × hero level × stats hashes as before Potential', () => {
    const TIERS = [[0, 0, 0], [5, 0, 2], [2, 5, 0], [0, 2, 5]];
    const out = [];
    for (const u of REAL_UNITS) for (const tiers of TIERS) for (const heroLevel of [0, 1, 10]) {
      for (const us of [null, { damageMul: 1.3, rateMul: 1.1, rangeMul: 1.05, critChance: 0.1, awakenPassive: true, potential: 1 }]) {
        out.push(resolveStats(u, { tiers, heroLevel: u.kind === 'hero' ? heroLevel : 0, unitStats: us }));
      }
    }
    let h = 0x811c9dc5;
    const t = JSON.stringify(out);
    for (let i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    // computed on the commit before Potential M1 (same script, same 456 resolutions)
    expect(`${out.length}:${h.toString(16).padStart(8, '0')}`).toBe('456:9c7c19b9');
  });

  test('Aoi P6: damage ×1.02×1.03, rate ×1.02, range ×1.03, crit +0.03; P4 has no crit yet', () => {
    const p1 = resolveStats(REAL.aoi, { unitStats: { potential: 1 } });
    const p6 = resolveStats(REAL.aoi, { unitStats: { potential: 6 } });
    expect(p6.damage).toBeCloseTo(p1.damage * 1.02 * 1.03, 12);
    expect(p6.rate).toBeCloseTo(p1.rate * 1.02, 12);
    expect(p6.range).toBeCloseTo(p1.range * 1.03, 12);
    expect(p6.crit.chance).toBeCloseTo(p1.crit.chance + 0.03, 12);
    expect(resolveStats(REAL.aoi, { unitStats: { potential: 4 } }).crit.chance).toBe(p1.crit.chance);
  });

  test('Potential multiplies on top of level and gear (one product with damageMul)', () => {
    const s = resolveStats(REAL.aoi, { unitStats: { damageMul: 1.5, potential: 2 } });
    expect(s.damage).toBeCloseTo(REAL.aoi.base.damage * 1.5 * 1.02, 12);
  });

  test('Chika: drones get damage, speed and range', () => {
    const a = resolveStats(REAL.chika, { unitStats: { potential: 1 } }).turret;
    const b = resolveStats(REAL.chika, { unitStats: { potential: 6 } }).turret;
    expect(b.range).toBeCloseTo(a.range * 1.03, 12);
    expect(b.rate).toBeCloseTo(a.rate * 1.02 * 1.02 * 1.03, 12);
    expect(b.damage).toBeCloseTo(a.damage * 1.03, 12);
  });

  test('Suzu: trap damage', () => {
    const a = resolveStats(REAL.suzu, { tiers: [3, 0, 0], unitStats: { potential: 1 } }).trap;
    const b = resolveStats(REAL.suzu, { tiers: [3, 0, 0], unitStats: { potential: 6 } }).trap;
    expect(b.damage).toBeCloseTo(a.damage * 1.03 * 1.03, 12);
  });

  test('Momo: coins per wave 30 → 31.518 at P6 (after upgrades too)', () => {
    expect(resolveStats(REAL.momo, { unitStats: { potential: 6 } }).income.perWave).toBeCloseTo(31.518, 9);
    const t = resolveStats(REAL.momo, { tiers: [0, 0, 3], unitStats: { potential: 1 } }).income.perWave;
    expect(resolveStats(REAL.momo, { tiers: [0, 0, 3], unitStats: { potential: 6 } }).income.perWave).toBeCloseTo(t * 1.02 * 1.03, 9);
  });

  test('auras: Miko dmgMul ×1.0201, Umeko tier-0 speed aura 1 → 1.0201', () => {
    const m1 = resolveStats(REAL.miko, { unitStats: { potential: 1 } }).aura.dmgMul;
    expect(resolveStats(REAL.miko, { unitStats: { potential: 6 } }).aura.dmgMul).toBeCloseTo(m1 * 1.0201, 12);
    expect(resolveStats(REAL.umeko, { unitStats: { potential: 1 } }).aura.rateMul).toBe(1);
    expect(resolveStats(REAL.umeko, { unitStats: { potential: 6 } }).aura.rateMul).toBeCloseTo(1.0201, 12);
  });

  test('Hotaru silence +0.1 s, Kaede focus cap +0.05, Shiro boss ×1.05, Luna elite ×1.05', () => {
    const d = (id, p, f) => f(resolveStats(REAL[id], { unitStats: { potential: p } }));
    expect(d('hotaru', 6, (s) => s.silence) - d('hotaru', 5, (s) => s.silence)).toBeCloseTo(0.1, 12);
    expect(d('kaede', 6, (s) => s.ramp.max) - d('kaede', 5, (s) => s.ramp.max)).toBeCloseTo(0.05, 12);
    expect(d('shiro', 6, (s) => s.bossMul) / d('shiro', 5, (s) => s.bossMul)).toBeCloseTo(1.05, 12);
    expect(d('luna', 6, (s) => s.eliteMul) / d('luna', 5, (s) => s.eliteMul)).toBeCloseTo(1.05, 12);
  });

  test('a claimed Potential above 6 or a non-number cannot do more than P6 / P1', () => {
    expect(resolveStats(REAL.aoi, { unitStats: { potential: 50 } })).toEqual(resolveStats(REAL.aoi, { unitStats: { potential: 6 } }));
    expect(resolveStats(REAL.aoi, { unitStats: { potential: '6' } })).toEqual(resolveStats(REAL.aoi));
  });
});
