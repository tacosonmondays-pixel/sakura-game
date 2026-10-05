import { describe, it, expect } from 'vitest';
import { POOL, rollOnce, pull, pullCost, canSpark, spark, expectedSSRRate, ratesTable } from '../../src/systems/gacha.js';
import { createProfile } from '../../src/systems/save.js';
import { createRng } from '../../src/core/rng.js';
import { UNITS } from '../../src/data/units.js';
import { GACHA, UNIT_RARITIES } from '../../src/data/types.js';

/** rng stub that always rolls the same value and picks the first pool entry. */
const fixedRng = (value, pickIndex = 0) => ({ next: () => value, pick: (arr) => arr[Math.min(pickIndex, arr.length - 1)], int: (a) => a, range: (a) => a, chance: () => false });

describe('pool', () => {
  it('contains every unit under its rarity', () => {
    const all = [...POOL.R, ...POOL.SR, ...POOL.SSR];
    expect(all.sort()).toEqual(UNITS.map((u) => u.id).sort());
    for (const u of UNITS) expect(POOL[u.rarity]).toContain(u.id);
  });
});

describe('rates', () => {
  it('matches 1.5% / 18.5% / 80% with pity over 200k pulls', () => {
    const state = { pity: 0, totalPulls: 0, recruitPoints: 0, history: [] };
    const rng = createRng('rates-200k');
    const N = 200000;
    const counts = { R: 0, SR: 0, SSR: 0 };
    let maxGap = 0;
    let gap = 0;
    for (let i = 0; i < N; i++) {
      const r = rollOnce(state, rng);
      counts[r.rarity]++;
      gap++;
      if (r.rarity === 'SSR') {
        maxGap = Math.max(maxGap, gap);
        gap = 0;
      }
    }
    const ssr = counts.SSR / N;
    expect(Math.abs(ssr - expectedSSRRate())).toBeLessThan(0.0015);
    expect(counts.SR / N).toBeGreaterThan(0.18);
    expect(counts.SR / N).toBeLessThan(0.19);
    expect(counts.R / N).toBeGreaterThan(0.785);
    expect(counts.R / N).toBeLessThan(0.805);
    expect(maxGap).toBeLessThanOrEqual(GACHA.pity);
    expect(state.totalPulls).toBe(N);
    expect(state.recruitPoints).toBe(N);
  });

  it('consolidated SSR rate is about 2%', () => {
    expect(expectedSSRRate()).toBeGreaterThan(0.015);
    expect(expectedSSRRate()).toBeLessThan(0.021);
    expect(ratesTable().perUnit.SSR.reduce((a, u) => a + u.rate, 0)).toBeCloseTo(0.015, 6);
  });
});

describe('pity', () => {
  it('guarantees an SSR exactly on the 90th pull without one', () => {
    const state = { pity: 0, totalPulls: 0, recruitPoints: 0, history: [] };
    const rng = fixedRng(0.99);
    for (let i = 1; i < 90; i++) {
      expect(rollOnce(state, rng).rarity).toBe('R');
      expect(state.pity).toBe(i);
    }
    const r = rollOnce(state, rng);
    expect(r.rarity).toBe('SSR');
    expect(r.pity).toBe(true);
    expect(state.pity).toBe(0);
  });

  it('a natural SSR resets pity', () => {
    const state = { pity: 50, totalPulls: 0, recruitPoints: 0, history: [] };
    expect(rollOnce(state, fixedRng(0.001)).rarity).toBe('SSR');
    expect(state.pity).toBe(0);
  });

  it('pity carries across pulls on the profile', () => {
    const p = createProfile();
    p.currencies.gems = 1_000_000;
    p.gacha.pity = 85;
    const r = pull(p, 10, fixedRng(0.99), { useTickets: false });
    expect(r.results.map((x) => x.rarity).indexOf('SSR')).toBe(4); // 86, 87, 88, 89, 90th
    expect(p.gacha.pity).toBe(5);
  });
});

describe('pull', () => {
  it('ten-pull guarantees at least one SR', () => {
    const p = createProfile();
    p.currencies.gems = 100000;
    const r = pull(p, 10, fixedRng(0.99), { useTickets: false });
    expect(r.ok).toBe(true);
    expect(r.results).toHaveLength(10);
    expect(r.results.slice(0, 9).every((x) => x.rarity === 'R')).toBe(true);
    expect(r.results[9].rarity).toBe('SR');
    // statistically: no 10-pull without SR+
    const rng = createRng('tenpulls');
    for (let i = 0; i < 300; i++) {
      p.currencies.gems = 1200;
      const res = pull(p, 10, rng, { useTickets: false });
      expect(res.results.some((x) => x.rarity !== 'R')).toBe(true);
    }
  });

  it('duplicates turn into star fragments; new units are granted', () => {
    const p = createProfile();
    p.currencies.gems = 10000;
    // aoi is owned (R) → dupe
    const rIdx = POOL.R.indexOf('aoi');
    const r1 = pull(p, 1, fixedRng(0.99, rIdx));
    expect(r1.results[0]).toMatchObject({ unitId: 'aoi', isNew: false, fragments: UNIT_RARITIES.R.fragmentsOnDupe });
    expect(p.items.star_fragment).toBe(2);
    // first SSR in pool not owned → new
    const target = POOL.SSR.find((id) => !p.units[id]);
    const r2 = pull(p, 1, fixedRng(0.001, POOL.SSR.indexOf(target)));
    expect(r2.results[0]).toMatchObject({ unitId: target, rarity: 'SSR', isNew: true, fragments: 0 });
    expect(p.units[target].level).toBe(1);
    const r3 = pull(p, 1, fixedRng(0.001, POOL.SSR.indexOf(target)));
    expect(r3.results[0].fragments).toBe(40);
    expect(p.items.star_fragment).toBe(42);
    expect(p.gacha.history).toHaveLength(3);
    expect(p.stats.pulls).toBe(3);
  });

  it('spends tickets first, then gems', () => {
    const p = createProfile();
    const rng = createRng('spend');
    expect(p.currencies.gems).toBe(2400);
    let r = pull(p, 10, rng);
    expect(r.spent).toMatchObject({ gems: 0, tickets: 1 });
    expect(p.items.ticket_recruit10).toBeUndefined();
    expect(p.currencies.gems).toBe(2400);
    r = pull(p, 10, rng);
    expect(r.spent.gems).toBe(1200);
    expect(p.currencies.gems).toBe(1200);
    p.items.ticket_recruit = 3;
    r = pull(p, 10, rng);
    expect(r.spent).toMatchObject({ gems: 840, tickets: 3 });
    expect(p.currencies.gems).toBe(360);
    expect(p.items.ticket_recruit).toBeUndefined();
    p.items.ticket_recruit = 1;
    r = pull(p, 1, rng);
    expect(r.spent).toMatchObject({ gems: 0, tickets: 1 });
    r = pull(p, 1, rng, { useTickets: true });
    expect(r.spent.gems).toBe(120);
    expect(p.currencies.gems).toBe(240);
    p.items.ticket_recruit = 5;
    r = pull(p, 1, rng, { useTickets: false });
    expect(r.spent.gems).toBe(120);
    expect(p.items.ticket_recruit).toBe(5);
    expect(p.gacha.totalPulls).toBe(33);
    expect(p.gacha.recruitPoints).toBe(33);
    expect(p.missions.counters.pull).toBe(33);
  });

  it('refuses without currency and changes nothing', () => {
    const p = createProfile();
    delete p.items.ticket_recruit10;
    p.currencies.gems = 1199;
    const before = JSON.stringify(p);
    const r = pull(p, 10, createRng(1));
    expect(r).toMatchObject({ ok: false, error: 'gems', results: [] });
    expect(JSON.stringify(p)).toBe(before);
    expect(pull(p, 3, createRng(1)).error).toBe('count');
    expect(pullCost(p, 1).gems).toBe(120);
  });
});

describe('spark', () => {
  it('trades 200 recruit points for a chosen SSR', () => {
    const p = createProfile();
    expect(canSpark(p)).toBe(false);
    expect(spark(p, 'kaede').error).toBe('points');
    p.gacha.recruitPoints = 205;
    expect(spark(p, 'aoi').error).toBe('notSSR');
    const r = spark(p, 'kaede');
    expect(r).toMatchObject({ ok: true, unitId: 'kaede', isNew: true });
    expect(p.units.kaede).toBeTruthy();
    expect(p.gacha.recruitPoints).toBe(5);
  });
});
