// Gear in battle (docs/specs/GEAR_STATS.md §A.3, §A.4, §B.3, §B.4, §C.3): Pierce per kit, Aura Power, gear
// ATK on burns, Range on auras, the club tricks and Skill Haste's read for tower abilities.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP } from '../../src/sim/constants.js';
import { resolveStats } from '../../src/sim/mods.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { CLUB_IDS } from '../../src/data/clubs.js';
import {
  SIM_CLUB_IDS, pierceCarry, pierceK, abilityHaste, abilityChargePerTick, firstBellCharge, trickClub, NOT_HASTED_KINDS, POP_BUDGET_MAX,
  followThroughBlast,
} from '../../src/sim/gearRules.js';
import { unitBattleStats } from '../../src/systems/progression.js';

const us = (o) => ({ ...unitBattleStats(null, 'aoi'), ...o });

describe('Pierce carry', () => {
  test('46 % Pierce: one more target on attacks 3, 5, 7, 9 …, the carry stays an integer below 100', () => {
    const t = {};
    const got = [];
    for (let i = 1; i <= 12; i++) if (pierceCarry(t, 'c', 46, 2)) got.push(i);
    expect(got).toEqual([3, 5, 7, 9, 11]);
    expect(Number.isInteger(t.c) && t.c < 100).toBe(true);
  });

  test('half rate and at most +1 a shot for Shiro, Momo and Miko; Follow-Through adds 100 after the cap', () => {
    expect(pierceK({ unitId: 'shiro', unitStats: { pierceK: 46 } })).toBe(23);
    expect(pierceK({ unitId: 'aoi', unitStats: { pierceK: 46 } })).toBe(46);
    // (the guard is 300 with LR gear: five Blank LR pieces double the 150 % cap, GEAR_UPDATE.md §4.3)
    expect(pierceK({ unitId: 'aoi', unitStats: { pierceK: 999 } })).toBe(300);
    expect(pierceK({ unitId: 'aoi', unitStats: { pierceK: 150 } }, true)).toBe(250);
    const t = {};
    expect(pierceCarry(t, 'c', 250, 1)).toBe(1);
  });
});

describe('resolveStats: gear reach', () => {
  test('blasts and traps widen ×(1 + 0.2 × Pierce) (×1.3 at the cap); a shooter keeps her splash 0', () => {
    const akane = UNIT_MAP.akane;
    const plain = resolveStats(akane, { unitStats: us({}) });
    const capped = resolveStats(akane, { unitStats: us({ pierceK: 150 }) });
    expect(capped.splash / plain.splash).toBeCloseTo(1.3, 9);
    const suzu = UNIT_MAP.suzu;
    expect(resolveStats(suzu, { unitStats: us({ pierceK: 100 }) }).trap.splash / resolveStats(suzu, { unitStats: us({}) }).trap.splash).toBeCloseTo(1.2, 9);
    expect(resolveStats(UNIT_MAP.aoi, { unitStats: us({ pierceK: 100 }) }).splash).toBe(0);
  });

  test('Aura Power grows the aura\'s bonus parts (Miko\'s +10 % → +11.5 % at 15 %), never its cost cut', () => {
    const miko = UNIT_MAP.miko;
    const a = resolveStats(miko, { unitStats: us({ auraPct: 0.15 }) }).aura;
    expect(a.dmgMul).toBeCloseTo(1.115, 9);
    const momoAura = resolveStats(UNIT_MAP.momo, { tiers: [0, 0, 0], unitStats: us({ auraPct: 0.15 }) }).aura;
    if (momoAura) expect(momoAura.costCut ?? 0).toBe(resolveStats(UNIT_MAP.momo, { unitStats: us({}) }).aura?.costCut ?? 0);
  });

  test('gear Range and the aura girls\' fill-in widen her aura', () => {
    const miko = UNIT_MAP.miko;
    const base = resolveStats(miko, { unitStats: us({}) }).aura.range;
    expect(resolveStats(miko, { unitStats: us({ rangeMul: 1.2, auraRangeMul: 1.05 }) }).aura.range).toBeCloseTo(base * 1.2 * 1.05, 9);
  });

  test('dotMul grows burn / poison dps, never the %-of-max-HP part', () => {
    const akane = UNIT_MAP.akane;
    const burn = (o) => resolveStats(akane, { tiers: [0, 0, 0], unitStats: us(o) }).status.find((s) => s.type === 'burn');
    const b0 = burn({});
    if (b0) expect(burn({ dotMul: 1.25 }).dps).toBeCloseTo(b0.dps * 1.25, 9);
  });

  test('no gear keys: the resolution is what it was (neutral defaults)', () => {
    for (const id of ['aoi', 'akane', 'miko', 'suzu', 'chika']) {
      expect(resolveStats(UNIT_MAP[id], { unitStats: us({ pierceK: 0, auraPct: 0, auraRangeMul: 1, dotMul: 1, club: null, clubN: 0 }) })).toEqual(resolveStats(UNIT_MAP[id], { unitStats: us({}) }));
    }
  });
});

describe('Skill Haste on tower abilities (the clean read for the abilities track)', () => {
  test('half of her capped Skill Haste; rallies and debuffs take none', () => {
    expect(abilityHaste({ ultHaste: 0.38 })).toBeCloseTo(0.19, 9);
    expect(abilityHaste({ ultHaste: 0.9 })).toBeCloseTo(0.25, 9);
    for (const k of NOT_HASTED_KINDS) expect(abilityHaste({ ultHaste: 0.5 }, k)).toBe(0);
    expect(abilityHaste({})).toBe(0);
  });

  test('integer charge per tick = round(100 / (1 − h)): 100 with none, 133 at the cap', () => {
    expect(abilityChargePerTick({ ultHaste: 0 })).toBe(100);
    expect(abilityChargePerTick({ ultHaste: 0.5 })).toBe(133);
    expect(abilityChargePerTick({ ultHaste: 0.5 }, 'rally')).toBe(100);
    // Kage's two Skill Haste lines (38 %): Shadow Doubles' 40 s cooldown → about 32 s
    expect(40 * 100 / abilityChargePerTick({ ultHaste: 0.38 })).toBeCloseTo(32.5, 1);
  });

  test('First Bell: 10 % of a full charge for the Bell Club set only', () => {
    expect(firstBellCharge({ club: 'bell', clubN: 3 }, 4000)).toBe(400);
    expect(firstBellCharge({ club: 'bell', clubN: 2 }, 4000)).toBe(0);
    expect(firstBellCharge({ club: 'bell', clubN: 3 }, 4000, 'rally')).toBe(0);
  });
});

describe('club tricks in a battle', () => {
  const run = (unitId, stats, steps = 60 * 240) => {
    const sim = new Sim({ stageId: '1-3', difficulty: 'normal', seed: 7, loadout: [{ unitId, stats: { ...unitBattleStats(null, unitId), damageMul: 3, ...stats } }], options: { autoStart: false } });
    sim.cash = 1e6;
    const spot = (() => {
      for (let y = 0.55; y < sim.map.height; y += 0.35) for (let x = 0.55; x < sim.map.width; x += 0.35) if (!sim.placementReason(unitId, x, y) && sim.placement.pathDistance(x, y) < 1.2) return [x, y];
      return null;
    })();
    const t = sim.placeTower(unitId, spot[0], spot[1]);
    const ev = { attack: 0, tricks: {}, explode: [], traps: 0 };
    for (let w = 0; w < 4 && steps > 0; w++) {
      sim.startNextWave();
      for (; steps > 0 && sim.state === 'wave'; steps--) {
        sim.update(STEP);
        for (const e of sim.drainEvents()) {
          if (e.type === 'attack' && e.towerUid === t.uid && !e.turretUid) ev.attack++;
          if (e.type === 'clubTrick') ev.tricks[e.kind] = (ev.tricks[e.kind] || 0) + 1;
          if (e.type === 'explode') ev.explode.push(e.radius);
          if (e.type === 'trapTriggered') ev.traps++;
        }
      }
    }
    return { sim, t, ev };
  };

  test('Big Beat fires on every 10th counted attack; 2 pieces do nothing', () => {
    const { ev } = run('aoi', { club: 'taiko', clubN: 3 });
    expect(ev.attack).toBeGreaterThan(20);
    expect(ev.tricks.bigBeat).toBe(Math.floor(ev.attack / 10));
    expect(run('aoi', { club: 'taiko', clubN: 2 }).ev.tricks.bigBeat).toBeUndefined();
  });

  test('Finishing Thrust every 25th attack; Follow-Through every 5th', () => {
    const f = run('aoi', { club: 'fencing', clubN: 3 }).ev;
    expect(f.attack).toBeGreaterThan(25);
    expect(f.tricks.thrust ?? 0).toBe(Math.floor(f.attack / 25));
    const a = run('aoi', { club: 'archery', clubN: 3 }).ev;
    expect(a.tricks.followThrough).toBe(Math.floor(a.attack / 5));
  });

  test('Follow-Through widens a blast kit\'s 5th blast and a trap girl\'s 5th trap: ×(1 + 0.2 × (Pierce + 1)) over ×(1 + 0.2 × Pierce)', () => {
    expect(followThroughBlast({})).toBeCloseTo(1.2, 12);
    expect(followThroughBlast({ pierceK: 150 })).toBeCloseTo(1.5 / 1.3, 12);
    expect(followThroughBlast({ pierceK: 999 })).toBeCloseTo((1 + 0.2 * 4) / (1 + 0.2 * 3), 12);
    const radii = (ev, r) => {
      const wide = ev.explode.filter((x) => Math.abs(x - r.wide) < 1e-9).length;
      const plain = ev.explode.filter((x) => Math.abs(x - r.plain) < 1e-9).length;
      expect(wide + plain, 'every blast is her plain or her Follow-Through radius').toBe(ev.explode.length);
      return wide;
    };
    // Akane (a travelling shell) and Yuki (a blast kit) shoot: every 5th attack's blast is the wide one
    for (const [id, pk] of [['akane', 0], ['akane', 150], ['yuki', 46]]) {
      const { t, ev } = run(id, { club: 'archery', clubN: 3, pierceK: pk });
      const plain = t.eff.splash;
      const wide = radii(ev, { plain, wide: plain * followThroughBlast({ pierceK: pk }) });
      expect(ev.tricks.followThrough, id).toBe(Math.floor(ev.attack / 5));
      expect(wide, `${id} +${pk}`).toBeGreaterThan(0);
      expect(wide, `${id} +${pk}`).toBeLessThanOrEqual(ev.tricks.followThrough * t.eff.projectiles);
      // 2 pieces: no trick, no wide blast
      const two = run(id, { club: 'archery', clubN: 2, pierceK: pk });
      expect(two.ev.tricks.followThrough).toBeUndefined();
      expect(two.ev.explode.every((x) => Math.abs(x - plain) < 1e-9)).toBe(true);
    }
    // Suzu: her traps count, every 5th that goes off blasts wider (her placements do not count)
    const s = run('suzu', { club: 'archery', clubN: 3 });
    const plain = Math.max(s.t.trapSpec.splash, s.t.trapSpec.triggerRadius);
    const wide = radii(s.ev, { plain, wide: Math.max(s.t.trapSpec.splash * followThroughBlast({}), s.t.trapSpec.triggerRadius) });
    expect(s.ev.traps).toBeGreaterThan(9);
    expect(s.ev.tricks.followThrough).toBe(Math.floor(s.ev.traps / 5));
    expect(wide).toBe(s.ev.tricks.followThrough);
    expect(s.t.trapFtN).toBe(s.ev.traps % 5);
    expect(run('suzu', { club: 'archery', clubN: 2 }).ev.tricks.followThrough).toBeUndefined();
  });

  test('Finale Pop spends the shared budget and never runs it below zero', () => {
    const { sim, ev } = run('akane', { club: 'pyro', clubN: 3 });
    expect(ev.tricks.finalePop).toBeGreaterThan(0);
    expect(sim.popBudget).toBeGreaterThanOrEqual(0);
    expect(sim.popBudget).toBeLessThanOrEqual(POP_BUDGET_MAX);
  });

  test('Pierce carries on her shots: the carry moves and she never deals less, same seed', () => {
    const go = (o) => run('aoi', { damageMul: 0.4, ...o }, 60 * 120);
    const a = go({ pierceK: 150 });
    const b = go({});
    expect(a.t.pierceCarry).toBeDefined();
    expect(b.t.pierceCarry).toBeUndefined();
    expect(a.sim.stats.damageByTower[a.t.uid] || 0).toBeGreaterThanOrEqual(b.sim.stats.damageByTower[b.t.uid] || 0);
  });

  test('a run is identical twice (no hidden state, no engine maths)', () => {
    const a = run('chika', { pierceK: 100, club: 'taiko', clubN: 3 }, 60 * 40);
    const b = run('chika', { pierceK: 100, club: 'taiko', clubN: 3 }, 60 * 40);
    expect(a.sim.stats.damageByTower).toEqual(b.sim.stats.damageByTower);
    expect(a.t.droneCarry).toBe(b.t.droneCarry);
  });
});

describe('guards', () => {
  test('the sim\'s club ids are the save\'s', () => {
    expect(SIM_CLUB_IDS).toEqual(CLUB_IDS);
    expect(trickClub({ club: 'tea', clubN: 3 })).toBe('tea');
    expect(trickClub({ club: 'nope', clubN: 3 })).toBeNull();
  });

  test('src/sim never imports the menu-side gear files (they stay out of the co-op hash)', () => {
    const dir = join(process.cwd(), 'src/sim');
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) {
      const src = readFileSync(join(dir, f), 'utf8');
      expect(src, f).not.toMatch(/data\/(gearStats|clubs|gearAwaken)\.js/);
    }
  });
});
