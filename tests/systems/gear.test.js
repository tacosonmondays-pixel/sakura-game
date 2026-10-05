import { describe, it, expect } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import {
  rollGear, addGear, equipGear, unequipGear, rerollCost, rerollSubstats, rerollMainStat, enhanceCost, enhanceGear,
  salvageGear, gearStatTotals, describeStat, mainStatRange, substatRange, openGearBox, setGearLocked, MAX_GEAR_LEVEL,
} from '../../src/systems/gear.js';
import { createRng } from '../../src/core/rng.js';
import { GEAR_MAIN_STATS, GEAR_SUBSTATS_BY_RARITY, GEAR_STATS, ITEM_RARITY_ORDER } from '../../src/data/types.js';

const richProfile = () => {
  const p = createProfile();
  p.currencies.coins = 10_000_000;
  Object.assign(p.items, { dice_reroll: 1000, lock_pin: 100, dice_prism: 100 });
  return p;
};

describe('rollGear', () => {
  it('respects slot main stats, substat count, no duplicates and value ranges', () => {
    const rng = createRng('gear-ranges');
    for (const rarity of ITEM_RARITY_ORDER) {
      for (const slot of Object.keys(GEAR_MAIN_STATS)) {
        for (let i = 0; i < 150; i++) {
          const g = rollGear(rng, { slot, rarity });
          expect(g.slot).toBe(slot);
          expect(g.rarity).toBe(rarity);
          expect(g.level).toBe(0);
          expect(g.uid).toBeNull();
          expect(GEAR_MAIN_STATS[slot]).toContain(g.main.stat);
          const [mn, mx] = mainStatRange(g.main.stat, rarity);
          expect(g.main.value).toBeGreaterThanOrEqual(mn - 1e-9);
          expect(g.main.value).toBeLessThanOrEqual(mx + 1e-9);
          expect(g.subs.length).toBe(GEAR_SUBSTATS_BY_RARITY[rarity]);
          const stats = [g.main.stat, ...g.subs.map((s) => s.stat)];
          expect(new Set(stats).size).toBe(stats.length);
          for (const s of g.subs) {
            const [a, b] = substatRange(s.stat, rarity);
            expect(s.value).toBeGreaterThanOrEqual(a - 1e-9);
            expect(s.value).toBeLessThanOrEqual(b + 1e-9);
          }
          expect(typeof g.name).toBe('string');
          expect(g.name.length).toBeGreaterThan(3);
        }
      }
    }
  });

  it('rarity scales the values up', () => {
    for (const stat of Object.keys(GEAR_STATS)) {
      expect(substatRange(stat, 'legendary')[1]).toBeGreaterThan(substatRange(stat, 'common')[1]);
      expect(mainStatRange(stat, 'rare')[0]).toBeGreaterThanOrEqual(substatRange(stat, 'rare')[0]);
    }
  });

  it('is deterministic per seed', () => {
    expect(rollGear(createRng(9), { rarity: 'mythic' })).toEqual(rollGear(createRng(9), { rarity: 'mythic' }));
  });
});

describe('equip', () => {
  it('equips, swaps and moves between owners', () => {
    const p = createProfile();
    const rng = createRng(2);
    const a = addGear(p, rollGear(rng, { slot: 'charm', rarity: 'rare' }));
    const b = addGear(p, rollGear(rng, { slot: 'charm', rarity: 'rare' }));
    expect(a).not.toBe(b);
    expect(equipGear(p, 'aoi', a).ok).toBe(true);
    expect(p.gear[a].equippedBy).toBe('aoi');
    expect(equipGear(p, 'aoi', b)).toMatchObject({ ok: true, previous: a });
    expect(p.gear[a].equippedBy).toBeNull();
    expect(p.units.aoi.gear.charm).toBe(b);
    // move b to rei
    equipGear(p, 'rei', b);
    expect(p.units.aoi.gear.charm).toBeNull();
    expect(p.units.rei.gear.charm).toBe(b);
    expect(p.gear[b].equippedBy).toBe('rei');
    expect(unequipGear(p, 'rei', 'charm')).toEqual({ ok: true, uid: b });
    expect(p.gear[b].equippedBy).toBeNull();
    expect(equipGear(p, 'luna', a).ok).toBe(false);
  });

  it('gearStatTotals sums main + subs of worn gear', () => {
    const p = createProfile();
    const rng = createRng(3);
    const g1 = rollGear(rng, { slot: 'charm', rarity: 'superRare' });
    const g2 = rollGear(rng, { slot: 'shoes', rarity: 'superRare' });
    equipGear(p, 'aoi', addGear(p, g1));
    equipGear(p, 'aoi', addGear(p, g2));
    const t = gearStatTotals(p, 'aoi');
    const expect1 = {};
    for (const s of [g1.main, ...g1.subs, g2.main, ...g2.subs]) expect1[s.stat] = (expect1[s.stat] || 0) + s.value;
    for (const [k, v] of Object.entries(expect1)) expect(t[k]).toBeCloseTo(v, 3);
    expect(Object.keys(t).sort()).toEqual(Object.keys(GEAR_STATS).sort());
  });
});

describe('rerolls', () => {
  it('reroll cost uses dice (+ lock pin when locking)', () => {
    const g = rollGear(createRng(1), { rarity: 'legendary' });
    expect(rerollCost(g, {}).map((c) => c.id)).toEqual(['dice_reroll', 'coins']);
    expect(rerollCost(g, { lockIndex: 1 }).map((c) => c.id)).toContain('lock_pin');
  });

  it('keeps the locked substat and spends dice + pin', () => {
    const p = richProfile();
    const rng = createRng('lock');
    const uid = addGear(p, rollGear(rng, { slot: 'ribbon', rarity: 'legendary' }));
    for (let i = 0; i < 50; i++) {
      const lockIndex = i % 4;
      const lockedBefore = { ...p.gear[uid].subs[lockIndex] };
      const dice = p.items.dice_reroll;
      const pins = p.items.lock_pin;
      const r = rerollSubstats(p, uid, rng, { lockIndex });
      expect(r.ok).toBe(true);
      const g = p.gear[uid];
      expect(g.subs[lockIndex]).toEqual(lockedBefore);
      expect(g.subs.length).toBe(4);
      const stats = [g.main.stat, ...g.subs.map((s) => s.stat)];
      expect(new Set(stats).size).toBe(5);
      expect(p.items.dice_reroll).toBe(dice - 3);
      expect(p.items.lock_pin).toBe(pins - 1);
    }
    expect(p.missions.counters.gearReroll).toBe(50);
  });

  it('reroll without lock changes subs and costs no pin; refuses when missing items', () => {
    const p = richProfile();
    const rng = createRng('nolock');
    const uid = addGear(p, rollGear(rng, { slot: 'charm', rarity: 'mythic' }));
    const before = JSON.stringify(p.gear[uid].subs);
    const r = rerollSubstats(p, uid, rng);
    expect(r.ok).toBe(true);
    expect(JSON.stringify(p.gear[uid].subs)).not.toBe(before);
    expect(p.items.lock_pin).toBe(100);
    p.items.dice_reroll = 0;
    delete p.items.dice_reroll;
    const snapshot = JSON.stringify(p.gear[uid]);
    expect(rerollSubstats(p, uid, rng)).toMatchObject({ ok: false, error: 'missing' });
    expect(JSON.stringify(p.gear[uid])).toBe(snapshot);
    const common = addGear(p, rollGear(rng, { rarity: 'common' }));
    expect(rerollSubstats(p, common, rng).error).toBe('noSubstats');
    p.items.dice_reroll = 5;
    expect(rerollSubstats(p, uid, rng, { lockIndex: 7 }).error).toBe('badLock');
  });

  it('keeps earned enhancement upgrades across rerolls', () => {
    const p = richProfile();
    const rng = createRng('upg');
    const uid = addGear(p, rollGear(rng, { slot: 'shoes', rarity: 'legendary' }));
    for (let i = 0; i < 9; i++) enhanceGear(p, uid);
    const total = () => p.gear[uid].subs.reduce((a, s) => a + s.upgrades, 0);
    expect(total()).toBe(3);
    rerollSubstats(p, uid, rng, { lockIndex: 0 });
    expect(total()).toBe(3);
    rerollSubstats(p, uid, rng);
    expect(total()).toBe(3);
  });

  it('main stat reroll picks a different slot stat and resolves clashes', () => {
    const p = richProfile();
    const rng = createRng('main');
    const uid = addGear(p, rollGear(rng, { slot: 'ribbon', rarity: 'legendary' }));
    for (let i = 0; i < 40; i++) {
      const prev = p.gear[uid].main.stat;
      const prisms = p.items.dice_prism;
      expect(rerollMainStat(p, uid, rng).ok).toBe(true);
      const g = p.gear[uid];
      expect(g.main.stat).not.toBe(prev);
      expect(GEAR_MAIN_STATS.ribbon).toContain(g.main.stat);
      const stats = [g.main.stat, ...g.subs.map((s) => s.stat)];
      expect(new Set(stats).size).toBe(stats.length);
      expect(p.items.dice_prism).toBe(prisms - 1);
    }
    delete p.items.dice_prism;
    expect(rerollMainStat(p, uid, rng).error).toBe('missing');
  });
});

describe('enhance & salvage', () => {
  it('enhances to +10, main grows, every 3rd level grows a sub', () => {
    const p = richProfile();
    const rng = createRng('enh');
    const uid = addGear(p, rollGear(rng, { slot: 'charm', rarity: 'superRare' }));
    const main0 = p.gear[uid].main.value;
    let lastCost = 0;
    for (let l = 1; l <= MAX_GEAR_LEVEL; l++) {
      const cost = enhanceCost(p.gear[uid]);
      expect(cost).toBeGreaterThan(lastCost);
      lastCost = cost;
      const coins = p.currencies.coins;
      const r = enhanceGear(p, uid);
      expect(r.ok).toBe(true);
      expect(r.level).toBe(l);
      expect(p.currencies.coins).toBe(coins - cost);
      expect(r.grewSub != null).toBe(l % 3 === 0);
    }
    expect(p.gear[uid].main.value).toBeGreaterThan(main0);
    expect(enhanceCost(p.gear[uid])).toBeNull();
    expect(enhanceGear(p, uid).error).toBe('max');
    expect(p.gear[uid].subs.map((s) => s.upgrades)).toEqual([2, 1]);
  });

  it('enhance refuses without coins', () => {
    const p = createProfile();
    p.currencies.coins = 10;
    const uid = addGear(p, rollGear(createRng(1), { rarity: 'rare' }));
    expect(enhanceGear(p, uid).error).toBe('missing');
    expect(p.gear[uid].level).toBe(0);
  });

  it('salvage refunds and refuses equipped/locked gear', () => {
    const p = createProfile();
    const rng = createRng('salv');
    const uid = addGear(p, rollGear(rng, { slot: 'charm', rarity: 'legendary' }));
    equipGear(p, 'aoi', uid);
    expect(salvageGear(p, uid).error).toBe('equipped');
    unequipGear(p, 'aoi', 'charm');
    setGearLocked(p, uid, true);
    expect(salvageGear(p, uid).error).toBe('locked');
    setGearLocked(p, uid, false);
    const coins = p.currencies.coins;
    const r = salvageGear(p, uid);
    expect(r.ok).toBe(true);
    expect(p.gear[uid]).toBeUndefined();
    expect(p.currencies.coins).toBeGreaterThan(coins);
    expect(p.items.dice_reroll).toBe(3);
  });

  it('opens gear boxes into gear of the box rarity', () => {
    const p = createProfile();
    p.items.gearbox_mythic = 2;
    const r = openGearBox(p, 'gearbox_mythic', createRng(4), 2);
    expect(r.ok).toBe(true);
    expect(r.gear).toHaveLength(2);
    for (const g of r.gear) {
      expect(g.rarity).toBe('mythic');
      expect(p.gear[g.uid]).toBe(g);
    }
    expect(p.items.gearbox_mythic).toBeUndefined();
    expect(openGearBox(p, 'gearbox_mythic', createRng(4)).ok).toBe(false);
  });
});

describe('describeStat', () => {
  it('formats percentages and flat stats', () => {
    expect(describeStat('atkPct', 0.052)).toBe('+5.2% ATK');
    expect(describeStat('armorPen', 2)).toBe('+2 Armor Pierce');
    expect(describeStat('critDmg', 0.1)).toBe('+10% Crit DMG');
  });
});
