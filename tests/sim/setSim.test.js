// Gear sets in battle (docs/specs/GEAR_UPDATE.md §2.4, §3.2, §3.4, §4.5, §8.3): each passive, the set caps the sim
// reads, Control Strength before boss resistance and the CC budget, You're It, Buff Duration per kind, super crits and
// the average crit; no rng draw added.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP } from '../../src/sim/constants.js';
import { resolveStats } from '../../src/sim/mods.js';
import { applyStatus } from '../../src/sim/status.js';
import { computeHit, computeDot } from '../../src/sim/combat.js';
import { applyRallies, applyBuffExtras } from '../../src/sim/buffs.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { SET_IDS } from '../../src/data/gearSets.js';
import {
  SIM_SET_IDS, SET_PASSIVES, setPassive, statusCtxFor, splitCrit, averageCrit, SUPER_CRIT_MUL, controlMulOf, itBonusOf, buffDur, pushMul,
} from '../../src/sim/setRules.js';
import { abilityHaste, abilityChargePerTick, superchargeMul, firstBellCharge } from '../../src/sim/gearRules.js';
import { unitBattleStats } from '../../src/systems/progression.js';

const us = (o) => ({ ...unitBattleStats(null, 'aoi'), ...o });
const enemy = (o = {}) => ({ dead: false, airborne: false, tier: 'normal', statuses: {}, armorClass: 'light', hp: 1000, maxHp: 1000, barrier: 0, armor: 0, ...o });

describe('set rules', () => {
  test('the sim\'s set ids equal the menu\'s', () => {
    expect(SIM_SET_IDS).toEqual(SET_IDS);
  });

  test('a passive needs 4 pieces; 5 its stronger numbers; the LR form only with setLr at 5', () => {
    expect(setPassive({ set: 'geometry', setN: 3 })).toBeNull();
    expect(setPassive({ set: 'geometry', setN: 4 })).toBe(SET_PASSIVES.geometry[4]);
    expect(setPassive({ set: 'geometry', setN: 5 })).toBe(SET_PASSIVES.geometry[5]);
    expect(setPassive({ set: 'geometry', setN: 5, setLr: true })).toBe(SET_PASSIVES.geometry.lr);
    expect(setPassive({ set: 'chess', setN: 5 })).toBeNull();
    expect(setPassive({ set: 'geometry', setN: 4 }, 'spirit')).toBeNull();
  });

  test('statusCtxFor sets the applier\'s uid, Control Strength and You\'re It (neutral for no girl)', () => {
    const ctx = statusCtxFor({}, { uid: 9, unitStats: { controlMul: 1.3, set: 'freezetag', setN: 4 } });
    expect(ctx).toEqual({ sourceUid: 9, controlMul: 1.3, itBonus: 0.06 });
    expect(statusCtxFor(ctx, null)).toEqual({ sourceUid: null, controlMul: 1, itBonus: 0 });
    expect(controlMulOf({ controlMul: 1.5, set: 'freezetag', setN: 5, setLr: true })).toBeCloseTo(1.5 * 1.15, 9);
    expect(itBonusOf({ set: 'freezetag', setN: 5 })).toBe(0.08);
  });

  test('crit above 100 %: the part over 1 is the super-crit chance; the average crit counts it', () => {
    expect(splitCrit(0.6)).toEqual([0.6, 0]);
    expect(splitCrit(1.25)).toEqual([1, 0.25]);
    expect(splitCrit(9)).toEqual([1, 1]);
    expect(averageCrit(0, 2)).toBe(1);
    expect(averageCrit(0.5, 2)).toBeCloseTo(1.5, 9);
    expect(averageCrit(1.5, 2)).toBeCloseTo(1 + 1 + 0.5 * 2 * (SUPER_CRIT_MUL - 1), 9);
  });
});

describe('Control Strength and You\'re It in applyStatus', () => {
  test('her control lasts × controlMul, before boss resistance and the CC budget; a slow\'s strength never changes', () => {
    const e = enemy();
    applyStatus(e, { type: 'slow', amount: 0.3, duration: 2 }, { controlMul: 1.5 });
    expect(e.statuses.slow.left).toBeCloseTo(3, 9);
    expect(e.statuses.slow.amount).toBeCloseTo(0.3, 9);
    const boss = enemy({ tier: 'boss', ccLeft: 2 });
    applyStatus(boss, { type: 'stun', duration: 2 }, { controlMul: 2 });
    expect(boss.statuses.stun.left).toBeLessThanOrEqual(2 + 1e-9); // the budget still holds
    const plain = enemy();
    applyStatus(plain, { type: 'burn', dps: 5, duration: 2 }, { controlMul: 2 });
    expect(plain.statuses.burn.left).toBe(2); // not a control status
  });

  test('You\'re It: the stronger bonus wins and the mark lasts the longer time; ×1 + bonus in computeHit, bosses at half', () => {
    const e = enemy();
    applyStatus(e, { type: 'slow', amount: 0.3, duration: 1 }, { itBonus: 0.06 });
    expect(e.it).toEqual({ bonus: 0.06, left: 60 });
    applyStatus(e, { type: 'freeze', duration: 2 }, { itBonus: 0.04 });
    expect(e.it).toEqual({ bonus: 0.06, left: 120 });
    applyStatus(e, { type: 'burn', dps: 1, duration: 9 }, { itBonus: 0.5 });
    expect(e.it.bonus).toBe(0.06);
    const hit = { damage: 100, attackType: 'physical' };
    const a = computeHit(enemy(), hit, 1, 1, {}).toHp;
    const b = computeHit(e, hit, 1, 1, {}).toHp;
    expect(b / a).toBeCloseTo(1.06, 6);
    const boss = enemy({ tier: 'boss', it: { bonus: 0.06, left: 10 } });
    expect(computeHit(boss, hit, 1, 1, {}).toHp / computeHit(enemy({ tier: 'boss' }), hit, 1, 1, {}).toHp).toBeCloseTo(1.03, 6);
  });

  test('You\'re It reaches burns and poisons too (computeDot, review r2 L18)', () => {
    const plain = computeDot(enemy(), 'poison', 10, 'physical', {}).toHp;
    expect(computeDot(enemy({ it: { bonus: 0.06, left: 5 } }), 'poison', 10, 'physical', {}).toHp / plain).toBeCloseTo(1.06, 9);
  });

  test('You\'re It lasts the longer of its time and the status\'s merged time (review M2 r1 L1)', () => {
    const e = enemy();
    applyStatus(e, { type: 'slow', amount: 0.3, duration: 3 }, {});
    applyStatus(e, { type: 'slow', amount: 0.3, duration: 1 }, { itBonus: 0.06 });
    expect(e.it.left).toBe(180);
    expect(pushMul({ controlMul: 1.5 })).toBeCloseTo(1.25, 9);
  });

  test('a sure crit needs no draw; a super crit uses the same draw', () => {
    const hit = { damage: 100, attackType: 'physical', critChance: 0.2, critMul: 2 };
    expect(computeHit(enemy(), { ...hit, sure: 1 }, 0.99, 1, {}).crit).toBe(true);
    expect(computeHit(enemy(), { ...hit, sure: 1.2 }, 0.99, 1, {}).toHp).toBeCloseTo(240, 6);
    const sup = { ...hit, critChance: 1, superChance: 0.3 };
    const s1 = computeHit(enemy(), sup, 0.1, 1, {});
    const s2 = computeHit(enemy(), sup, 0.5, 1, {});
    expect(s1.superCrit && !s2.superCrit).toBe(true);
    expect(s1.toHp / s2.toHp).toBeCloseTo(SUPER_CRIT_MUL, 6);
  });
});

describe('the sim reads the set\'s keys', () => {
  test('crit chance over 1 resolves to a super-crit chance; blasts read blastK; average crit on non-critting traps and burns', () => {
    // only Geometry's set cap or five Blank LR pieces (critCeil 2) pass 100 % (review r2 L15)
    const s = resolveStats(UNIT_MAP.aoi, { unitStats: us({ critChance: 1.3, critCeil: 2 }) });
    expect(s.crit.chance).toBe(1);
    expect(s.crit.super).toBeCloseTo(0.3 + (UNIT_MAP.aoi.base.crit?.chance || 0), 9);
    const capped = resolveStats(UNIT_MAP.aoi, { unitStats: us({ critChance: 1.3 }) });
    expect(capped.crit.chance).toBe(1);
    expect(capped.crit.super).toBeUndefined();
    expect(resolveStats(UNIT_MAP.aoi, { unitStats: us({ critChance: 0.9, set: 'geometry', setN: 5 }) }).crit.super ?? 0).toBeCloseTo(Math.max(0, 0.9 + (UNIT_MAP.aoi.base.crit?.chance || 0) - 1), 9);
    const akane = UNIT_MAP.akane;
    const plain = resolveStats(akane, { unitStats: us({}) });
    expect(resolveStats(akane, { unitStats: us({ pierceK: 150, blastK: 500 }) }).splash / plain.splash).toBeCloseTo(2, 9);
    const burn = (st) => st.status.find((x) => x.type === 'burn')?.dps || 0;
    if (burn(plain) > 0) expect(burn(resolveStats(akane, { unitStats: us({ avgCrit: 1.4 }) })) / burn(plain)).toBeCloseTo(1.4, 9);
    const suzu = UNIT_MAP.suzu;
    expect(resolveStats(suzu, { unitStats: us({ avgCrit: 1.5 }) }).trap.damage / resolveStats(suzu, { unitStats: us({}) }).trap.damage).toBeCloseTo(1.5, 9);
  });

  test('Power Bank: abilHaste (up to 0.75), Supercharge charge and damage, its LR form\'s wave-start charge; never for rallies', () => {
    expect(abilityHaste({ ultHaste: 0.5 })).toBe(0.25);
    expect(abilityHaste({ ultHaste: 0.5, abilHaste: 0.6 })).toBe(0.6);
    expect(abilityHaste({ abilHaste: 2 })).toBe(0.75);
    expect(abilityHaste({ abilHaste: 0.6 }, 'rally')).toBe(0);
    expect(abilityChargePerTick({ set: 'powerbank', setN: 4 })).toBe(110);
    expect(abilityChargePerTick({ set: 'powerbank', setN: 4 }, 'rally')).toBe(100);
    expect(abilityChargePerTick({ set: 'powerbank', setN: 5, abilHaste: 0.75 })).toBe(460);
    expect(superchargeMul({ set: 'powerbank', setN: 5 })).toBe(1.25);
    expect(firstBellCharge({ set: 'powerbank', setN: 5, setLr: true }, 1000)).toBe(200);
    expect(firstBellCharge({ set: 'powerbank', setN: 5 }, 1000)).toBe(0);
  });

  test('Buff Duration: 1 without it', () => {
    expect(buffDur(null)).toBe(1);
    expect(buffDur({ buffDurMul: 1.4 })).toBe(1.4);
  });
});

describe('set passives in a battle', () => {
  const run = (unitId, stats, steps = 60 * 200, extra = null) => {
    const loadout = [{ unitId, stats: { ...unitBattleStats(null, unitId), damageMul: 3, critChance: 0.2, ...stats } }];
    if (extra) loadout.push({ unitId: extra, stats: unitBattleStats(null, extra) });
    const sim = new Sim({ stageId: '1-3', difficulty: 'normal', seed: 7, loadout, options: { autoStart: false } });
    sim.cash = 1e6;
    const spots = [];
    for (let y = 0.55; y < sim.map.height; y += 0.35) for (let x = 0.55; x < sim.map.width; x += 0.35) if (!sim.placementReason(unitId, x, y) && sim.placement.pathDistance(x, y) < 1.2) spots.push([x, y]);
    const t = sim.placeTower(unitId, spots[0][0], spots[0][1]);
    let o = null;
    if (extra) {
      const near = spots.find(([x, y]) => Math.hypot(x - t.x, y - t.y) >= 1 && Math.hypot(x - t.x, y - t.y) <= 1.8 && !sim.placementReason(extra, x, y));
      o = near ? sim.placeTower(extra, near[0], near[1]) : null;
    }
    const ev = { attack: 0, set: {}, hits: 0, crits: 0, rallyMax: 1, cash: 0 };
    for (let w = 0; w < 4 && steps > 0; w++) {
      sim.startNextWave();
      for (; steps > 0 && sim.state === 'wave'; steps--) {
        sim.update(STEP);
        if (o) ev.rallyMax = Math.max(ev.rallyMax, o.buff.dmgMul);
        for (const e of sim.drainEvents()) {
          if (e.type === 'attack' && e.towerUid === t.uid && !e.turretUid) ev.attack++;
          if (e.type === 'setTrick') ev.set[e.kind] = (ev.set[e.kind] || 0) + 1;
        }
      }
    }
    return { sim, t, o, ev };
  };

  test('Right Angle: every 4th counted attack is a sure crit (every 3rd in the LR form); 3 pieces do nothing', () => {
    const { ev, t } = run('aoi', { set: 'geometry', setN: 4 });
    expect(ev.attack).toBeGreaterThan(20);
    expect(ev.set.rightAngle).toBe(Math.floor(ev.attack / 4));
    expect(t.angleN).toBe(ev.attack % 4);
    expect(run('aoi', { set: 'geometry', setN: 5, setLr: true }).ev.set.rightAngle).toBe(Math.floor(run('aoi', { set: 'geometry', setN: 5, setLr: true }).ev.attack / 3));
    expect(run('aoi', { set: 'geometry', setN: 3 }).ev.set.rightAngle).toBeUndefined();
  });

  test('Confetti Burst bursts on every 6th attack within the shared budget; never below zero', () => {
    const { sim, ev } = run('aoi', { set: 'popper', setN: 4 });
    expect(ev.set.confetti || 0).toBeGreaterThan(0);
    expect(ev.set.confetti).toBeLessThanOrEqual(Math.floor(ev.attack / 6));
    expect(sim.burstBudget).toBeGreaterThanOrEqual(0);
  });

  test('Big Cheer: a rally on the girls near her every 20 s (her nearest 2 without an aura)', () => {
    const { ev } = run('aoi', { set: 'spirit', setN: 4 }, 60 * 200, 'rei');
    expect(ev.set.cheer || 0).toBeGreaterThan(0);
    expect(ev.rallyMax).toBeCloseTo(1.12, 6);
  });

  test('Big Cheer multiplies on top of an ability rally (its own key, review M2 r1 M4)', () => {
    const src = { uid: 1, x: 0, y: 0 };
    const t = { uid: 2, x: 0.5, y: 0 };
    const sim = { getTower: (uid) => (uid === 1 ? src : null), _rallies: [
      { src: 1, r2: 4, dmgMul: 1.2, rateMul: 1, rangeMul: 1, left: 10 },
      { src: 1, r2: 4, dmgMul: 1.12, rateMul: 1, rangeMul: 1, left: 10, cheer: true },
    ] };
    const nb = { dmgMul: 1, rateMul: 1, rangeMul: 1 };
    applyRallies(sim, t, nb, {});
    expect(nb.dmgMul).toBeCloseTo(1.2 * 1.12, 9);
  });

  test('crit buffs pass 100 % into super crits only under her ceiling (review M2 r1 M3)', () => {
    const t = (critCeil) => ({ stats: { crit: { chance: 1, super: 0.1 }, armorPen: 0 }, unitStats: { critCeil }, eff: { critChance: 1 } });
    const a = t(2);
    applyBuffExtras(a, { critChance: 0.2, armorPen: 0 });
    expect(a.eff.critChance).toBe(1);
    expect(a.eff.superChance).toBeCloseTo(0.3, 9);
    const b = t(1);
    applyBuffExtras(b, { critChance: 0.2, armorPen: 0 });
    expect(b.eff.superChance).toBeUndefined();
  });

  test('Bake Sale pays more coins than the same battle without the set', () => {
    const a = run('aoi', { set: 'treasurer', setN: 4 });
    const b = run('aoi', {});
    expect(a.sim.stats.cashEarned).toBeGreaterThan(b.sim.stats.cashEarned);
  });

  test('no rng draw added: a sure crit and a super crit reuse the hit\'s one crit draw', () => {
    const sim = new Sim({ stageId: '1-3', difficulty: 'normal', seed: 7, loadout: [{ unitId: 'aoi', stats: us({ damageMul: 3, critChance: 1.2, set: 'geometry', setN: 5 }) }], options: { autoStart: false } });
    let draws = 0;
    const next = sim.rng.next.bind(sim.rng);
    sim.rng.next = () => { draws++; return next(); };
    const hit = sim._hit.bind(sim);
    const per = [];
    sim._hit = (e, tower, spec, scale, drone) => {
      const before = draws;
      const r = hit(e, tower, spec, scale, drone);
      if (spec.sure) per.push(draws - before);
      return r;
    };
    let spot = null;
    for (let y = 0.55; y < sim.map.height && !spot; y += 0.35) for (let x = 0.55; x < sim.map.width && !spot; x += 0.35) if (!sim.placementReason('aoi', x, y) && sim.placement.pathDistance(x, y) < 1.2) spot = [x, y];
    sim.placeTower('aoi', spot[0], spot[1]);
    sim.startNextWave();
    for (let i = 0; i < 60 * 60 && sim.state === 'wave'; i++) sim.update(STEP);
    expect(per.length).toBeGreaterThan(0);
    expect(per.every((d) => d === 1)).toBe(true);
  });
});
