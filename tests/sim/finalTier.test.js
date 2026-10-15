// One final tier per path (owner, Oct 15): any number of copies of a girl, but per girl type and player only
// one copy may own each path's final tier. src/sim/finalTier.js + Sim.upgradeStatus / upgradeTower.
import { describe, test, expect } from 'vitest';
import { makeSim, UNITS } from './fixtures.js';
import { FINAL_TIER, finalTierOf, findFinalHolder } from '../../src/sim/finalTier.js';

const SPOTS = [[1.5, 1.5], [9.5, 1.5], [1.5, 6.5], [9.5, 6.5], [13.5, 6.5], [14.5, 1.5]];

function setup(n = 3, opts = {}) {
  const sim = makeSim({ cash: 1e9, ...opts });
  const girls = SPOTS.slice(0, n).map(([x, y]) => {
    const t = sim.placeTower('archer', x, y);
    expect(t, `spot ${x},${y}`).toBeTruthy();
    return t;
  });
  return { sim, girls };
}

const buy = (sim, t, path, n) => {
  for (let i = 0; i < n; i++) expect(sim.upgradeTower(t.uid, path), `${t.uid} path ${path} #${i}`).toBe(true);
};

describe('one final tier per path per girl type', () => {
  test('the final tier is the path\'s last tier (tier 5; 0 without tiers)', () => {
    expect(FINAL_TIER).toBe(5);
    expect(finalTierOf(UNITS.archer, 0)).toBe(5);
    expect(finalTierOf({ paths: [] }, 0)).toBe(0); // a hero after the hero rework has no paths
    expect(finalTierOf({ paths: [{ tiers: [{}, {}, {}] }] }, 0)).toBe(3);
  });

  test('a second copy is refused the same path\'s tier 5 (reason, holder, no cash spent)', () => {
    const { sim, girls: [a, b] } = setup(2);
    buy(sim, a, 0, 5);
    buy(sim, b, 0, 4); // tier 4 is never capped
    const cash = sim.cash;
    const st = sim.upgradeStatus(b.uid, 0);
    expect(st).toMatchObject({ tier: 4, locked: true, reason: 'onePerPath', holder: a.uid });
    expect(st.next.name).toBe('Storm');
    expect(st.cost).toBeGreaterThan(0);
    expect(sim.upgradeTower(b.uid, 0)).toBe(false);
    expect(sim.cash).toBe(cash);
    expect(b.tiers).toEqual([4, 0, 0]);
    expect(sim.finalTierHolder(b.uid, 0)).toBe(a);
    expect(sim.finalTierHolder(a.uid, 0)).toBe(null); // never her own holder
    expect(sim.finalTierHolders('archer')).toEqual([a.uid, null, null]);
    // every other status carries holder: null
    expect(sim.upgradeStatus(a.uid, 0)).toMatchObject({ reason: 'max', holder: null });
    expect(sim.upgradeStatus(b.uid, 2)).toMatchObject({ reason: null, holder: null });
  });

  test('other paths stay free: one 5-x-x, one x-5-x and one x-x-5 are all legal', () => {
    const { sim, girls: [a, b, c] } = setup(3);
    buy(sim, a, 0, 5);
    buy(sim, a, 1, 2);
    buy(sim, b, 1, 5);
    buy(sim, b, 2, 2);
    buy(sim, c, 2, 5);
    buy(sim, c, 0, 2);
    expect([a, b, c].map((t) => t.tiers.join('-'))).toEqual(['5-2-0', '0-5-2', '2-0-5']);
    expect(sim.finalTierHolders('archer')).toEqual([a.uid, b.uid, c.uid]);
  });

  test('selling (or losing) the holder frees the slot at once', () => {
    const { sim, girls: [a, b] } = setup(2);
    buy(sim, a, 0, 5);
    buy(sim, b, 0, 4);
    expect(sim.upgradeStatus(b.uid, 0).reason).toBe('onePerPath');
    sim.sellTower(a.uid);
    expect(sim.upgradeStatus(b.uid, 0)).toMatchObject({ locked: false, reason: null, holder: null });
    expect(sim.upgradeTower(b.uid, 0)).toBe(true);
    expect(b.tiers[0]).toBe(5);
    // a removed girl still in a list never holds anything
    a.removed = true;
    expect(findFinalHolder([a, b], 'archer', 0, 0, b.uid)).toBe(null);
  });

  test('tier 4 is never capped, and other girl types are not affected', () => {
    const sim = makeSim({ cash: 1e9 });
    const a = sim.placeTower('archer', 1.5, 1.5);
    const s1 = sim.placeTower('sniper', 9.5, 1.5);
    const s2 = sim.placeTower('sniper', 1.5, 6.5);
    buy(sim, a, 0, 5);
    buy(sim, s1, 0, 5); // another type: her own slot
    buy(sim, s2, 0, 4);
    expect(sim.upgradeStatus(s2.uid, 0)).toMatchObject({ reason: 'onePerPath', holder: s1.uid });
    const a2 = sim.placeTower('archer', 9.5, 6.5);
    buy(sim, a2, 0, 4);
    expect(sim.upgradeStatus(a2.uid, 0)).toMatchObject({ reason: 'onePerPath', holder: a.uid });
  });

  test('heroes are exempt', () => {
    const sim = makeSim({ cash: 1e9, hero: 'heroine' });
    const h = sim.placeTower('heroine', 8.5, 5.6);
    expect(h.isHero).toBe(true);
    buy(sim, h, 0, 5);
    expect(sim.finalTierHolder(h.uid, 0)).toBe(null);
    // a hero copy (impossible in play: one hero per battle) never holds or is blocked
    const fake = { ...h, uid: 999, tiers: [5, 0, 0] };
    expect(findFinalHolder([h, fake], 'heroine', 0, 0)).toBe(null);
  });

  test('per player: another owner\'s copy never blocks', () => {
    const { sim, girls: [a, b] } = setup(2);
    b.owner = 1;
    buy(sim, a, 0, 5);
    buy(sim, b, 0, 5);
    expect(b.tiers[0]).toBe(5);
    expect(sim.finalTierHolders('archer', 0)).toEqual([a.uid, null, null]);
    expect(sim.finalTierHolders('archer', 1)).toEqual([b.uid, null, null]);
  });

  test('the crosspath rule still wins for tier 3+ on a second path', () => {
    const { sim, girls: [a, b] } = setup(2);
    buy(sim, a, 0, 5);
    buy(sim, b, 0, 3);
    buy(sim, b, 1, 2);
    expect(sim.upgradeStatus(b.uid, 1)).toMatchObject({ reason: 'crosspath', holder: null });
    expect(sim.upgradeStatus(b.uid, 2)).toMatchObject({ reason: 'crosspath', holder: null });
    buy(sim, b, 0, 1);
    expect(sim.upgradeStatus(b.uid, 0).reason).toBe('onePerPath');
  });

  test('cash comes after the rule: a broke second copy still sees the lock', () => {
    const { sim, girls: [a, b] } = setup(2);
    buy(sim, a, 0, 5);
    buy(sim, b, 0, 4);
    sim.cash = 0;
    expect(sim.upgradeStatus(b.uid, 0).reason).toBe('onePerPath');
    expect(sim.upgradeStatus(a.uid, 1).reason).toBe('cash');
  });

  test('{ restoring: true } (battle-save restore only) grandfathers a pre-rule save', () => {
    const { sim, girls: [a, b, c] } = setup(3);
    buy(sim, a, 0, 5);
    buy(sim, b, 0, 4);
    expect(sim.upgradeTower(b.uid, 0)).toBe(false);
    expect(sim.upgradeTower(b.uid, 0, { restoring: true })).toBe(true);
    expect(b.tiers[0]).toBe(5);
    // the lowest uid is "the holder"; a third copy at tier 4 sees the lock
    buy(sim, c, 0, 4);
    expect(sim.upgradeStatus(c.uid, 0)).toMatchObject({ reason: 'onePerPath', holder: a.uid });
    // selling one holder leaves the other holding
    sim.sellTower(a.uid);
    expect(sim.upgradeStatus(c.uid, 0)).toMatchObject({ reason: 'onePerPath', holder: b.uid });
    // crosspath is still validated while restoring (an edited save stays refused)
    buy(sim, c, 1, 2);
    expect(sim.upgradeTower(c.uid, 1, { restoring: true })).toBe(false);
  });
});
