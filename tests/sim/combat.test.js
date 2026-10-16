import { describe, test, expect } from 'vitest';
import { TYPE_CHART } from '../../src/data/types.js';
import {
  computeHit, applyHitResult, computeDot, isEligible, effectiveArmor, BARRIER_BROKE, SHELL_BROKE,
} from '../../src/sim/combat.js';
import { applyStatus } from '../../src/sim/status.js';
import { fakeEnemy, hitSpec } from './fixtures.js';

describe('type chart', () => {
  test('every attack type × armor class uses TYPE_CHART', () => {
    for (const atk of Object.keys(TYPE_CHART)) {
      for (const cls of Object.keys(TYPE_CHART[atk])) {
        const r = computeHit(fakeEnemy({ armorClass: cls }), hitSpec({ attackType: atk, damage: 100 }));
        expect(r.toHp).toBeCloseTo(100 * TYPE_CHART[atk][cls], 6);
        expect(r.effective).toBe(TYPE_CHART[atk][cls]);
      }
    }
  });

  test('holy is super effective vs spectral, blast weak', () => {
    const ghost = fakeEnemy({ armorClass: 'spectral' });
    expect(computeHit(ghost, hitSpec({ attackType: 'holy' })).toHp).toBe(20);
    expect(computeHit(ghost, hitSpec({ attackType: 'blast' })).toHp).toBe(5);
  });
});

describe('armor, pen and shred', () => {
  test('flat armor reduces each hit, armorPen ignores some', () => {
    const orc = fakeEnemy({ armor: 4 });
    expect(computeHit(orc, hitSpec({ damage: 10 })).toHp).toBe(6);
    expect(computeHit(orc, hitSpec({ damage: 10, armorPen: 3 })).toHp).toBe(9);
    expect(computeHit(orc, hitSpec({ damage: 10, armorPen: 10 })).toHp).toBe(10);
  });

  test('minimum 1 damage through armor', () => {
    const orc = fakeEnemy({ armor: 50 });
    expect(computeHit(orc, hitSpec({ damage: 10 })).toHp).toBe(1);
  });

  test('shred stacks up to 3 times and lowers armor for everyone', () => {
    const orc = fakeEnemy({ armor: 10 });
    const shred = { type: 'shred', amount: 2, duration: 5 };
    applyStatus(orc, shred);
    expect(effectiveArmor(orc)).toBe(8);
    applyStatus(orc, shred);
    applyStatus(orc, shred);
    applyStatus(orc, shred);
    expect(orc.statuses.shred.stacks).toBe(3);
    expect(effectiveArmor(orc)).toBe(4);
    expect(computeHit(orc, hitSpec({ damage: 10 })).toHp).toBe(6);
  });
});

describe('crystal shell', () => {
  test('caps damage per hit until shattered after N hits', () => {
    const e = fakeEnemy({ hp: 1000, maxHp: 1000, crystalCap: 5, crystalHits: 3 });
    const big = hitSpec({ damage: 100 });
    let flags = 0;
    for (let i = 0; i < 3; i++) {
      const r = computeHit(e, big);
      expect(r.toHp).toBe(5);
      expect(r.shellHit).toBe(true);
      flags |= applyHitResult(e, r);
    }
    expect(flags & SHELL_BROKE).toBeTruthy();
    expect(e.crystalHits).toBe(0);
    expect(computeHit(e, big).toHp).toBe(100);
  });

  test('armor can reduce a capped hit to 0 (no min-1 while shelled)', () => {
    const e = fakeEnemy({ armor: 6, crystalCap: 5, crystalHits: 2 });
    expect(computeHit(e, hitSpec({ damage: 100 })).toHp).toBe(0);
  });
});

describe('barrier', () => {
  test('absorbs damage before hp; blast deals ×1.5 to barrier', () => {
    const e = fakeEnemy({ barrier: 30, maxBarrier: 30 });
    const r = computeHit(e, hitSpec({ damage: 10, attackType: 'blast' }));
    expect(r.toBarrier).toBe(15);
    expect(r.toHp).toBe(0);
    const p = computeHit(e, hitSpec({ damage: 10, attackType: 'mystic' }));
    expect(p.toBarrier).toBe(10);
  });

  test('overflow spills into hp at the normal rate and breaks the barrier', () => {
    const e = fakeEnemy({ barrier: 15, maxBarrier: 30 });
    const r = computeHit(e, hitSpec({ damage: 20, attackType: 'blast' }));
    expect(r.toBarrier).toBe(15);
    expect(r.toHp).toBeCloseTo(10, 6); // 30 barrier-damage - 15 = 15 → /1.5 = 10 hp
    expect(applyHitResult(e, r) & BARRIER_BROKE).toBeTruthy();
    expect(e.barrier).toBe(0);
  });

  test('barrierMul stacks with blast', () => {
    const e = fakeEnemy({ barrier: 100, maxBarrier: 100 });
    expect(computeHit(e, hitSpec({ damage: 10, attackType: 'blast', barrierMul: 2 })).toBarrier).toBe(30);
  });
});

describe('ward, soak, mark, crit, tier bonuses', () => {
  test('element ward halves damage of that element', () => {
    const e = fakeEnemy({ ward: 'fire' });
    expect(computeHit(e, hitSpec({ element: 'fire' })).toHp).toBe(5);
    expect(computeHit(e, hitSpec({ element: 'frost' })).toHp).toBe(10);
  });

  test('ward blocks the element status', () => {
    const e = fakeEnemy({ ward: 'fire' });
    expect(applyStatus(e, { type: 'burn', dps: 5, duration: 2 }, { element: 'fire' })).toBe(null);
    expect(applyStatus(e, { type: 'slow', amount: 0.3, duration: 2 }, { element: 'fire' })).toBe('new');
  });

  test('soak boosts frost and lightning', () => {
    const e = fakeEnemy({ statuses: { soak: { type: 'soak', left: 2 } } });
    expect(computeHit(e, hitSpec({ element: 'frost' })).toHp).toBeCloseTo(11.5, 6);
    expect(computeHit(e, hitSpec({ element: 'fire' })).toHp).toBe(10);
  });

  test('mark and vulnerable add up', () => {
    const e = fakeEnemy();
    applyStatus(e, { type: 'mark', bonus: 0.2, duration: 2 });
    applyStatus(e, { type: 'vulnerable', bonus: 0.1, duration: 2 });
    expect(computeHit(e, hitSpec()).toHp).toBeCloseTo(13, 6);
  });

  test('crit uses the roll', () => {
    const spec = hitSpec({ critChance: 0.5, critMul: 2 });
    expect(computeHit(fakeEnemy(), spec, 0.1).crit).toBe(true);
    expect(computeHit(fakeEnemy(), spec, 0.1).toHp).toBe(20);
    expect(computeHit(fakeEnemy(), spec, 0.9).crit).toBe(false);
  });

  test('eliteMul applies to elites and bosses, bossMul to bosses only', () => {
    const spec = hitSpec({ eliteMul: 2, bossMul: 3 });
    expect(computeHit(fakeEnemy({ tier: 'normal' }), spec).toHp).toBe(10);
    expect(computeHit(fakeEnemy({ tier: 'elite' }), spec).toHp).toBe(20);
    expect(computeHit(fakeEnemy({ tier: 'boss' }), spec).toHp).toBe(60);
  });
});

describe('guardian and shield fields', () => {
  test('guardian reduction applies to everything except blast', () => {
    const e = fakeEnemy({ guard: 0.5 });
    expect(computeHit(e, hitSpec({ attackType: 'mystic' })).toHp).toBe(5);
    expect(computeHit(e, hitSpec({ attackType: 'blast' })).toHp).toBe(10);
  });

  test('field shield reduces all damage', () => {
    const e = fakeEnemy({ shield: 0.4 });
    expect(computeHit(e, hitSpec({ attackType: 'blast' })).toHp).toBeCloseTo(6, 6);
  });
});

describe('eligibility', () => {
  test('veiled needs detection or reveal', () => {
    const e = fakeEnemy({ veiled: true });
    expect(isEligible(e, hitSpec())).toBe(false);
    expect(isEligible(e, hitSpec({ detection: true }))).toBe(true);
    e.revealed = true;
    expect(isEligible(e, hitSpec())).toBe(true);
  });

  test('phasing only takes holy/mystic', () => {
    const e = fakeEnemy({ phasing: true });
    expect(computeHit(e, hitSpec({ attackType: 'pierce' }))).toBe(null);
    expect(computeHit(e, hitSpec({ attackType: 'holy' }))).not.toBe(null);
    expect(computeHit(e, hitSpec({ attackType: 'mystic' }))).not.toBe(null);
  });

  test('airborne only hit by canHitAir', () => {
    const e = fakeEnemy({ airborne: true });
    expect(isEligible(e, hitSpec({ canHitAir: false }))).toBe(false);
    expect(isEligible(e, hitSpec({ canHitAir: true }))).toBe(true);
  });
});

describe('damage over time', () => {
  test('burn respects type chart but skips flat armor; poison ignores both', () => {
    const e = fakeEnemy({ armor: 50, armorClass: 'heavy' });
    expect(computeDot(e, 'burn', 10, 'blast').toHp).toBe(15);
    expect(computeDot(e, 'poison', 10, 'mystic').toHp).toBe(10);
  });

  test('dot hits barrier first and skips crystal cap', () => {
    const e = fakeEnemy({ barrier: 4, crystalHits: 5, crystalCap: 1 });
    const r = computeDot(e, 'poison', 10, 'mystic');
    expect(r.toBarrier).toBe(4);
    expect(r.toHp).toBe(6);
  });
});

describe('armor floor, % max HP damage over time, execution shot', () => {
  test('the armor floor (freeplay only) keeps 25% of a hit through armor', () => {
    const plain = fakeEnemy({ armor: 30 });
    expect(computeHit(plain, hitSpec({ damage: 20 })).toHp).toBe(1); // campaign: min 1
    const fp = fakeEnemy({ armor: 30, armorFloor: 0.25 });
    expect(computeHit(fp, hitSpec({ damage: 20 })).toHp).toBe(5);
    expect(computeHit(fp, hitSpec({ damage: 100 })).toHp).toBe(70); // armor 30 < 75%: unchanged
    // a crystal shell is untouched (no floor, no min 1)
    const shell = fakeEnemy({ armor: 30, armorFloor: 0.25, crystalHits: 3, crystalCap: 5 });
    expect(computeHit(shell, hitSpec({ damage: 20 })).toHp).toBe(0);
  });

  test('burn / poison pct: share of max HP per second, ×0.1 on bosses, through ward and barrier', async () => {
    const { Sim } = await import('../../src/sim/Sim.js');
    const { makeSim, startEmptyWave } = await import('./fixtures.js');
    const sim = makeSim();
    startEmptyWave(sim);
    const e = sim.spawnEnemy('tank', { dist: 3 });
    e.statuses.poison = { type: 'poison', dps: 10, pct: 0.01, duration: 100, left: 100 };
    const hp0 = e.hp;
    sim.update(1);
    expect(hp0 - e.hp).toBeCloseTo((10 + 0.01 * e.maxHp) * 1, 3);
    const b = sim.spawnEnemy('boss', { dist: 2 });
    b.statuses.burn = { type: 'burn', dps: 0, pct: 0.01, duration: 100, left: 100, attackType: 'mystic' };
    const bh = b.hp;
    sim.update(1 / 60);
    expect(bh - b.hp).toBeCloseTo(0.01 * 0.1 * b.maxHp / 60 * TYPE_CHART.mystic[b.armorClass], 6);
    expect(Sim).toBeTruthy();
  });

  test('status merge keeps the stronger pct (one burn / one poison per enemy)', () => {
    const e = fakeEnemy();
    applyStatus(e, { type: 'poison', dps: 40, duration: 5 }, {});
    applyStatus(e, { type: 'poison', dps: 10, pct: 0.0025, duration: 7 }, {});
    expect(e.statuses.poison).toMatchObject({ dps: 40, pct: 0.0025, duration: 7 });
    applyStatus(e, { type: 'poison', dps: 5, pct: 0.001, duration: 1 }, {});
    expect(e.statuses.poison.pct).toBe(0.0025);
  });

  test('hpPct adds a share of current HP, capped at cap × the hit; bosses take the boss rate', () => {
    const spec = hitSpec({ damage: 100, hpPct: { pct: 0.03, boss: 0.003, cap: 2 } });
    expect(computeHit(fakeEnemy({ hp: 1000, maxHp: 1000 }), spec).toHp).toBe(130);
    expect(computeHit(fakeEnemy({ hp: 1e6, maxHp: 1e6 }), spec).toHp).toBe(300); // capped at 2 × 100
    expect(computeHit(fakeEnemy({ hp: 1e5, maxHp: 1e5, tier: 'boss' }), spec).toHp).toBe(300); // 100 + min(0.3% × 1e5, 2 × 100)
    expect(computeHit(fakeEnemy({ hp: 2e4, maxHp: 1e5, tier: 'boss' }), spec).toHp).toBe(160); // current HP, not max
    expect(computeHit(fakeEnemy({ hp: 1000, maxHp: 1000, crystalHits: 2, crystalCap: 50 }), spec).toHp).toBe(50);
  });
});
