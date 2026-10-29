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

  test('roaming drones: leash and speed add, unit rangeMul scales leash, build divides by rateMul, defaults', () => {
    const s = normalizeBase({ turret: { max: 1, damage: 2, rate: 1, range: 1 } });
    expect([s.turret.leash, s.turret.speed, s.turret.build]).toEqual([0, 3, 0]); // anchored by default
    const acc = { damageAdd: 0, damageMul: 1 };
    const r = normalizeBase({ turret: { max: 2, damage: 3, rate: 1.5, range: 1, leash: 4, speed: 3.5, build: 4 } });
    applyModSet(r, { turret: { leash: 0.25, speed: 1 } }, acc);
    applyModSet(r, { turret: { leash: 0.5 } }, acc);
    expect(r.turret.leash).toBeCloseTo(4.75, 9);
    expect(r.turret.speed).toBeCloseTo(4.5, 9);
    const def = { ...UNITS.roamer };
    const st = resolveStats(def, { unitStats: { rangeMul: 1.1, rateMul: 2 } });
    expect(st.turret.leash).toBeCloseTo(3 * 1.1, 9);
    expect(st.turret.range).toBeCloseTo(1 * 1.1, 9);
    expect(st.turret.build).toBeCloseTo(0.5, 9);
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

describe('crosspath rules', () => {
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

  test('gear Cost Reduction (profile costMul) makes every upgrade cheaper, and that is what it charges', () => {
    const full = makeSim({ cash: 5000 });
    const geared = makeSim({ cash: 5000, stats: { archer: { costMul: 0.8 } } }); // a 20% Cost Reduction roll
    const a = full.placeTower('archer', 3, 3);
    const b = geared.placeTower('archer', 3, 3);
    for (let tier = 0; tier < 2; tier++) {
      const fullCost = full.upgradeStatus(a.uid, 0).cost;
      const gearCost = geared.upgradeStatus(b.uid, 0).cost;
      expect(gearCost).toBeLessThan(fullCost);
      const cash = geared.cash;
      expect(geared.upgradeTower(b.uid, 0)).toBe(true);
      expect(cash - geared.cash).toBe(gearCost);
      full.upgradeTower(a.uid, 0);
    }
    expect([full.towers[0].spent - full.placeCost('archer'), geared.towers[0].spent - geared.placeCost('archer')]).toEqual([300, 240]);
  });
});

describe('limited buffs and aura pen / crit (ModSet vocabulary)', () => {
  test('brew and link accumulate: targets max, multipliers multiply, pen and crit add, overclock replaces', () => {
    const s = normalizeBase({ damage: 1 });
    expect(s.brew).toBe(null);
    expect(s.link).toBe(null);
    const acc = { damageAdd: 0, damageMul: 1 };
    applyModSet(s, { brew: { targets: 1, dmgMul: 1.15 } }, acc);
    applyModSet(s, { brew: { dmgMul: 1.05, armorPen: 1 } }, acc);
    applyModSet(s, { brew: { targets: 3, rateMul: 1.2, armorPen: 2, critChance: 0.1 } }, acc);
    expect(s.brew).toMatchObject({ targets: 3, rateMul: 1.2, armorPen: 3, critChance: 0.1, overclock: null });
    expect(s.brew.dmgMul).toBeCloseTo(1.2075, 12);
    applyModSet(s, { link: { targets: 2, rateMul: 1.4, overclock: { every: 20, time: 6, rateMul: 1.25 } } }, acc);
    applyModSet(s, { link: { targets: 1, rateMul: 1.143, overclock: { every: 15, time: 5, rateMul: 1.5 } } }, acc);
    expect(s.link.targets).toBe(2);
    expect(s.link.rateMul).toBeCloseTo(1.6002, 12);
    expect(s.link.overclock).toEqual({ every: 15, time: 5, rateMul: 1.5 });
  });

  test('hpPct keeps the strongest numbers', () => {
    const s = normalizeBase({});
    expect(s.hpPct).toBe(null);
    const acc = { damageAdd: 0, damageMul: 1 };
    applyModSet(s, { hpPct: { pct: 0.03, boss: 0.003, cap: 2 } }, acc);
    applyModSet(s, { hpPct: { pct: 0.01, boss: 0.005, cap: 1 } }, acc);
    expect(s.hpPct).toEqual({ pct: 0.03, boss: 0.005, cap: 2 });
  });

  test('aura armorPen and critChance add within one girl\'s aura', () => {
    const s = normalizeBase({ aura: { range: 3, armorPen: 2 } });
    expect(s.aura).toMatchObject({ armorPen: 2, critChance: 0 });
    applyModSet(s, { aura: { armorPen: 2, critChance: 0.05 } }, { damageAdd: 0, damageMul: 1 });
    expect(s.aura).toMatchObject({ armorPen: 4, critChance: 0.05, range: 3 });
  });
});

// Potential (src/data/potential.js): P1 / absent is bit-identical to the build before Potential,
// and each kind of step lands where the spec says (docs/specs/POTENTIAL.md v3 §5, §13.2).
import { UNITS as REAL_UNITS, UNIT_MAP as REAL } from '../../src/data/units.js';
import { POWER } from '../../src/data/balance.js';

// balance round 5 (src/data/balance.js): her damage row, and `buff` on the bonus part of an aura
const pdmg = (id) => POWER[id]?.dmg ?? 1;
const pbuff = (id) => POWER[id]?.buff ?? 1;
const grow = (v, id) => 1 + (v - 1) * pbuff(id);
const ungrow = (v, id) => 1 + (v - 1) / pbuff(id);

describe('Potential in resolveStats', () => {
  test('P1 and no potential: every girl × tiers × hero level × stats hashes as before Potential', () => {
    const TIERS = [[0, 0, 0], [5, 0, 2], [2, 5, 0], [0, 2, 5]];
    const out = [];
    // the 19 girls the hash was taken on: a new girl (Tenka, the returning girls) never moves it, and
    // every key she brings appears on her own stats only (src/sim/mods.js), so these resolve as before
    const PINNED = ['hikari', 'luna', 'nami', 'aoi', 'rei', 'yuki', 'momo', 'akane', 'sango', 'kage', 'umeko', 'shiro',
      'midori', 'suzu', 'raika', 'miko', 'hotaru', 'kaede', 'chika'];
    expect(PINNED.every((id) => REAL[id])).toBe(true);
    for (const u of REAL_UNITS.filter((d) => PINNED.includes(d.id))) for (const tiers of TIERS) for (const heroLevel of [0, 1, 10]) {
      for (const us of [null, { damageMul: 1.3, rateMul: 1.1, rangeMul: 1.05, critChance: 0.1, awakenPassive: true, potential: 1 }]) {
        const st = resolveStats(u, { tiers, heroLevel: u.kind === 'hero' ? heroLevel : 0, unitStats: us });
        // the roster merge's neutral keys (airMul 1, gather 0, relay null) are not part of the pinned hash
        delete st.airMul;
        delete st.gather;
        delete st.relay;
        out.push(st);
      }
    }
    let h = 0x811c9dc5;
    const t = JSON.stringify(out);
    for (let i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    // computed on the train head before the Potential merge (train/battle-2 049dd9b: hero rework,
    // Chika rework and path cap; same script, same 456 resolutions; landing plan §10 #9). Was
    // '456:9c7c19b9' on the commit before Potential M1, before those three changed the data.
    // '456:30217027' before gear's reach (docs/specs/GEAR_STATS.md §B.3): gear Range (rangeMul 1.05 here)
    // now also widens an aura's radius; nothing else in these resolutions moved.
    // '456:055ce472' before Kaede's AoE rework (her `blade` block and new tiers, Crimson Eternity ×1.6 vs
    // bosses); every other girl's resolutions are bit-identical (checked with Kaede left out, P1 and P6)
    // '456:bd28cc90' before the attack shapes S1 (Momo's Coin Wheel, Kage's Blade Cyclone, Hotaru's Firefly
    // Halo: new tier data on one path each); with those three left out the 384 others hash 8cb286a4 before and after
    // '456:be9bef3b' before the attack shapes S2 (Akane's Hearth Stream, Umeko's Searchlight Sweep: new tier data on
    // one path each); with those two left out the 408 others hash 4158a051 before and after ('456:f509ac67' before the
    // review dropped Inferno Queen's unused splash)
    // '456:77d05324' before the attack shapes S3 (Yuki's Rising Spikes: new tier data on her Frostbite path; Chigusa and
    // Kanna are not pinned here); with Yuki left out the 432 others hash 05819da7 before and after
    // balance round 5 on top (src/data/balance.js: rows and hero curves; its round-by-round hashes on feature/balance-r5)
    expect(`${out.length}:${h.toString(16).padStart(8, '0')}`).toBe('456:95695334');
  });

  // Potential v3 (docs/specs/POTENTIAL.md v3 §5): the exact P6 numbers of the real ladders
  test('Kage P6: speed × the SR track, 8 % more shuriken and +1 armor ignored (P3), tempo, pierce 2 → 3 (P5), the Storm every 8th throw', () => {
    const p1 = resolveStats(REAL.kage, { unitStats: { potential: 1 } });
    const p6 = resolveStats(REAL.kage, { unitStats: { potential: 6 } });
    expect(p6.rate).toBeCloseTo(p1.rate * 1.04 * 1.05 * 1.05 * 1.06 * 1.07, 12);
    expect(p6.damage).toBe(p1.damage);
    expect([p1.pierce, p6.pierce]).toEqual([2, 3]);
    expect(resolveStats(REAL.kage, { unitStats: { potential: 4 } }).pierce).toBe(2);
    expect(p6.armorPen).toBe(p1.armorPen + 1);
    expect(p6.projScale).toBe(0.08);
    expect(resolveStats(REAL.kage, { unitStats: { potential: 3 } }).projScale).toBe(0.08);
    expect(p6.tempo).toEqual({ per: 0.01, max: 0.06, idle: 1 });
    expect(p6.proc).toEqual({ name: 'Shuriken Storm', every: 8, of: 'attack', status: [], echo: true });
    // Thousand Shadows (5-2-0): pierce 5 → 6
    expect(resolveStats(REAL.kage, { tiers: [5, 2, 0], unitStats: { potential: 6 } }).pierce).toBe(resolveStats(REAL.kage, { tiers: [5, 2, 0] }).pierce + 1);
  });

  test('Shiro P6: Silver Line every 4th shot (pierce +2) as a White Heron round ×1.5; her other shots never pierce more', () => {
    const p1 = resolveStats(REAL.shiro, { unitStats: { potential: 1 } });
    const p5 = resolveStats(REAL.shiro, { unitStats: { potential: 5 } });
    const p6 = resolveStats(REAL.shiro, { unitStats: { potential: 6 } });
    expect([p5.pierce, p6.pierce]).toEqual([p1.pierce, p1.pierce]);
    expect(p6.armorPen).toBe(p1.armorPen + 2);
    expect(p5.proc).toEqual({ name: 'Silver Line', every: 5, of: 'attack', status: [], pierce: 2 });
    expect(p6.proc).toEqual({ name: 'Silver Line', every: 4, of: 'attack', status: [], pierce: 2, damageMul: 1.5 });
  });

  test('Kaede P5: Maple Gale sharpens her blade arts ×1.1; P6: every 3rd strike ×1.5 (One Blade), ×1.2 vs bosses', () => {
    const p1 = resolveStats(REAL.kaede, { unitStats: { potential: 1 } });
    const p5 = resolveStats(REAL.kaede, { unitStats: { potential: 5 } });
    const p6 = resolveStats(REAL.kaede, { unitStats: { potential: 6 } });
    expect([p1.blade.shareMul, p5.blade.shareMul]).toEqual([1, 1.1]);
    expect('proc' in p5).toBe(false);
    expect(p6.proc).toEqual({ name: 'One Blade', every: 3, of: 'attack', status: [], damageMul: 1.5 });
    expect(p6.bossMul).toBeCloseTo(resolveStats(REAL.kaede).bossMul * 1.2, 12);
    // her maple splash keys on her focus cap before Potential (Scarlet Focus raises the cap, not the key)
    expect(p6.ramp.max).toBeCloseTo(p1.ramp.max + 0.3, 12);
    expect(p6.blade.capMax).toBe(p1.blade.capMax);
  });

  test('Aoi P6: damage ×1.04×1.04×1.05, rate ×1.04², +1 armor ignored, crit +3 % +6 %, Twin Fletch every 10th with the hawk', () => {
    const p1 = resolveStats(REAL.aoi, { unitStats: { potential: 1 } });
    const p6 = resolveStats(REAL.aoi, { unitStats: { potential: 6 } });
    expect(p6.damage).toBeCloseTo(p1.damage * 1.04 * 1.04 * 1.05, 12);
    expect(p6.rate).toBeCloseTo(p1.rate * 1.04 * 1.04, 12);
    expect(p6.range).toBe(p1.range);
    expect(p6.crit.chance).toBeCloseTo(p1.crit.chance + 0.03 + 0.06, 12);
    expect([p1.pierce, p6.pierce]).toEqual([1, 1]);
    expect(p6.armorPen).toBe(p1.armorPen + 1);
    expect(p6.proc).toMatchObject({ name: 'Twin Fletch', every: 10, echo: true, nova: { radius: 0, share: 1, volley: true } });
    expect(resolveStats(REAL.aoi, { unitStats: { potential: 3 } }).crit.chance).toBeCloseTo(p1.crit.chance + 0.03, 12);
  });

  test('Potential multiplies on top of level and gear (one product with damageMul)', () => {
    const s = resolveStats(REAL.aoi, { unitStats: { damageMul: 1.5, potential: 2 } });
    expect(s.damage).toBeCloseTo(REAL.aoi.base.damage * 1.5 * 1.04 * pdmg('aoi'), 12);
  });

  test('Chika P6: drones +1, 0.3 tiles more reach, damage and speed from her track, overclock merged, armor crack, +1 linked girl', () => {
    const a = resolveStats(REAL.chika, { unitStats: { potential: 1 } });
    const b = resolveStats(REAL.chika, { unitStats: { potential: 6 } });
    expect(b.turret.max).toBe(a.turret.max + 1);
    expect(b.turret.range).toBeCloseTo(a.turret.range + 0.3, 12);
    expect(b.turret.damage).toBeCloseTo(a.turret.damage * 1.05 * 1.07 * 1.09, 12);
    expect(b.turret.rate).toBeCloseTo(a.turret.rate * 1.07 * 1.08, 12);
    expect(b.turret.overclock).toEqual({ every: 20, time: 6, rateMul: 1.75 });
    expect(b.status).toEqual([{ type: 'shred', amount: 1, duration: 3 }]);
    expect(b.armorPen).toBe(a.armorPen + 1);
    const l1 = resolveStats(REAL.chika, { tiers: [0, 5, 2], unitStats: { potential: 1 } }).link.targets;
    expect(resolveStats(REAL.chika, { tiers: [0, 5, 2], unitStats: { potential: 6 } }).link.targets).toBe(l1 + 1);
    expect(resolveStats(REAL.chika, { tiers: [0, 5, 2], unitStats: { potential: 5 } }).link.targets).toBe(l1);
  });

  test('Suzu P6: trap damage × her track, two more traps, a slow on her seals, the Temple Bell every 4th trap', () => {
    const a = resolveStats(REAL.suzu, { tiers: [3, 0, 0], unitStats: { potential: 1 } });
    const b = resolveStats(REAL.suzu, { tiers: [3, 0, 0], unitStats: { potential: 6 } });
    expect(b.trap.damage).toBeCloseTo(a.trap.damage * 1.04 * 1.05 * 1.07, 12);
    expect(b.trap.max).toBe(a.trap.max + 2);
    expect(b.status).toEqual([{ type: 'slow', amount: 0.2, duration: 1.5 }]);
    expect(b.proc).toEqual({ name: 'Temple Bell', every: 4, of: 'trap', damageMul: 1.8, splash: 0.4, silence: 1, status: [{ type: 'vulnerable', bonus: 0.1, duration: 3 }] });
  });

  test('Momo P6: coins per wave × the coins track (30 → 35.80), lucky coins, harvest every 6th clear, bounty aura', () => {
    expect(resolveStats(REAL.momo, { unitStats: { potential: 6 } }).income.perWave).toBeCloseTo(30 * 1.03 * 1.03 * 1.04 * 1.04 * 1.04, 9);
    const t = resolveStats(REAL.momo, { tiers: [0, 0, 3], unitStats: { potential: 1 } }).income.perWave;
    const s = resolveStats(REAL.momo, { tiers: [0, 0, 3], unitStats: { potential: 6 } });
    expect(s.income.perWave).toBeCloseTo(t * 1.03 * 1.03 * 1.04 * 1.04 * 1.04, 9);
    expect(s.harvest).toEqual({ share: 1, every: 6 });
    expect(s.bountyAura).toBe(1.1);
    expect(s.proc).toMatchObject({ name: 'Fortune Flick', every: 6, damageMul: 4 });
  });

  test('auras: Miko ×1.03⁵ damage, +1 pen, 0.4 tiles wider, enemy Brittle; Umeko tier-0 speed aura 1 → 1.03⁵, wider, pen and crit', () => {
    const m1 = resolveStats(REAL.miko, { unitStats: { potential: 1 } }).aura;
    const m6 = resolveStats(REAL.miko, { unitStats: { potential: 6 } }).aura;
    expect(m6.dmgMul).toBeCloseTo(grow(ungrow(m1.dmgMul, 'miko') * 1.03 ** 5, 'miko'), 12);
    expect(m6.range).toBeCloseTo(m1.range + 0.4, 12);
    expect(m6.armorPen).toBeCloseTo(m1.armorPen + 1 * pbuff('miko'), 12);
    expect(m6.foeVuln).toBeCloseTo(0.06 * pbuff('miko'), 12);
    expect(resolveStats(REAL.umeko, { unitStats: { potential: 1 } }).aura.rateMul).toBe(1);
    const u6 = resolveStats(REAL.umeko, { unitStats: { potential: 6 } }).aura;
    expect(u6.rateMul).toBeCloseTo(grow(1.03 ** 5, 'umeko'), 12);
    expect(u6.range).toBeCloseTo(resolveStats(REAL.umeko).aura.range + 0.7, 12);
    expect(u6.armorPen).toBeCloseTo(1 * pbuff('umeko'), 12);
    expect(u6.critChance).toBeCloseTo(0.06 * pbuff('umeko'), 12);
  });

  test('Hotaru: holy ×1.2 vs spectral, 1 more target, a firefly aura; Kaede: kept focus, +2 % focus, +30 points cap, bosses ×1.2; heroes\' ultimates', () => {
    const d = (id, p, f, more = {}) => f(resolveStats(REAL[id], { unitStats: { potential: p }, ...more }));
    expect(d('hotaru', 6, (s) => s.classMul)).toEqual({ spectral: 1.2 });
    expect(d('hotaru', 6, (s) => s.maxTargets) - d('hotaru', 2, (s) => s.maxTargets)).toBe(1);
    expect(d('hotaru', 6, (s) => s.aura)).toMatchObject({ range: 2.6 });
    expect(d('hotaru', 6, (s) => s.aura.dmgMul)).toBeCloseTo(grow(1.06 * 1.06, 'hotaru'), 12);
    expect(d('kaede', 6, (s) => s.keepRamp)).toBe(0.5);
    expect(d('kaede', 6, (s) => s.ramp.per) - d('kaede', 1, (s) => s.ramp.per)).toBeCloseTo(0.02, 12);
    expect(d('kaede', 6, (s) => s.ramp.max) - d('kaede', 1, (s) => s.ramp.max)).toBeCloseTo(0.3, 12);
    expect(d('kaede', 6, (s) => s.bossMul) / d('kaede', 5, (s) => s.bossMul)).toBeCloseTo(1.2, 12);
    expect(d('luna', 6, (s) => s.ult, { heroLevel: 1 })).toMatchObject({ haste: 0.2, duration: 2, buffDuration: 3, rateBuff: 0.1 });
    expect(d('hikari', 6, (s) => s.ult, { heroLevel: 1 })).toMatchObject({ haste: 0.2, radius: 1, damageMul: 1.75 });
    expect(d('nami', 6, (s) => s.ult, { heroLevel: 1 })).toMatchObject({ haste: 0.15, damageMul: 1.5 });
  });

  test('a claimed Potential above 6 or a non-number cannot do more than P6 / P1', () => {
    expect(resolveStats(REAL.aoi, { unitStats: { potential: 50 } })).toEqual(resolveStats(REAL.aoi, { unitStats: { potential: 6 } }));
    expect(resolveStats(REAL.aoi, { unitStats: { potential: '6' } })).toEqual(resolveStats(REAL.aoi));
  });
});

describe('resolveStats `extra` (a running ability boost, src/sim/abilities.js)', () => {
  test('no `extra` (or null) resolves bit-identically to before it existed', () => {
    for (const id of ['aoi', 'rei', 'raika', 'chika']) {
      const u = REAL[id];
      const tiers = [3, 0, 2];
      expect(resolveStats(u, { tiers, extra: null })).toEqual(resolveStats(u, { tiers }));
      expect(resolveStats(u, { tiers, unitStats: { potential: 6 }, extra: undefined })).toEqual(resolveStats(u, { tiers, unitStats: { potential: 6 } }));
    }
  });

  test('applies last: after the tiers, the awaken passive and Potential, before the damage and the unit stats', () => {
    const u = REAL.rei;
    const us = { awakenPassive: true, potential: 4, rateMul: 1.2, rangeMul: 1.1, damageMul: 1.5 };
    const plain = resolveStats(u, { tiers: [3, 0, 0], unitStats: us });
    const boosted = resolveStats(u, { tiers: [3, 0, 0], unitStats: us, extra: { rateMul: 2.5, range: 0.6, maxTargets: 99, damage: 2 } });
    expect(boosted.rate).toBeCloseTo(plain.rate * 2.5, 9);
    expect(boosted.range).toBeCloseTo(plain.range + 0.6 * 1.1, 9); // the add is scaled by her gear range like a tier's
    expect(boosted.maxTargets).toBe(plain.maxTargets + 99);
    expect(boosted.damage).toBeGreaterThan(plain.damage);
    // a list applies in order; a status merges like a tier's (certain: a missing chance wins)
    const raika = resolveStats(REAL.raika, { tiers: [0, 0, 3], extra: [{ rateMul: 1.6 }, { chain: 2, status: [{ type: 'shock', duration: 0.25 }] }] });
    const base = resolveStats(REAL.raika, { tiers: [0, 0, 3] });
    expect(raika.chain).toBe(base.chain + 2);
    expect(raika.status.find((s) => s.type === 'shock')).toEqual({ type: 'shock', duration: 0.25 });
  });
});

// Roster B3 keys (ROSTER_SPEC §6.2): airMul multiplies, gather adds, relay reach adds (only for a relay
// girl), and the neutral defaults.
describe('roster B3 mod keys', () => {
  test('defaults, airMul (mul), gather (add), relay reach (add, relay girls only), both', () => {
    const s = normalizeBase({});
    expect([s.airMul, s.gather, s.relay]).toEqual([1, 0, null]);
    const r = normalizeBase({ airMul: 2, relay: { kind: 'mirror', reach: 3, both: true } });
    applyModSet(r, { airMul: 1.5, gather: 0.2, relay: { reach: 0.5 } }, { damageAdd: 0, damageMul: 1 });
    expect(r.airMul).toBe(3);
    expect(r.gather).toBeCloseTo(0.2, 12);
    expect(r.relay).toEqual({ kind: 'mirror', reach: 3.5, both: true });
    const n = normalizeBase({});
    applyModSet(n, { relay: { reach: 1 } }, { damageAdd: 0, damageMul: 1 });
    expect(n.relay).toBe(null);
  });
});
