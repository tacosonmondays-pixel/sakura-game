import { describe, it, expect } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import {
  MAX_LEVEL, levelCap, expForLevel, totalExpToLevel, bookExpTotal, previewLevelUp, levelUp, autoSelectBooks,
  breakthroughCost, canBreakthrough, breakthrough, awakenCost, canAwaken, awaken, unitBattleStats, unitPower, COINS_PER_EXP,
} from '../../src/systems/progression.js';
import { addGear, equipGear, rollGear } from '../../src/systems/gear.js';
import { createRng } from '../../src/core/rng.js';
import { UNITS } from '../../src/data/units.js';
import { ITEMS } from '../../src/data/items.js';

describe('levels', () => {
  it('caps by breakthrough', () => {
    expect(levelCap({ breakthrough: 0 })).toBe(10);
    expect(levelCap({ breakthrough: 3 })).toBe(40);
    expect(levelCap({ breakthrough: 5 })).toBe(60);
    expect(levelCap({ breakthrough: 9 })).toBe(MAX_LEVEL);
  });

  it('exp curve grows and ends at 60', () => {
    for (let l = 1; l < 59; l++) expect(expForLevel(l + 1)).toBeGreaterThan(expForLevel(l));
    expect(expForLevel(60)).toBe(Infinity);
    expect(totalExpToLevel(1)).toBe(0);
    expect(totalExpToLevel(3)).toBe(expForLevel(1) + expForLevel(2));
    // Reaching 60 needs a lot of books (roughly 35 Akashic Tomes).
    expect(totalExpToLevel(60)).toBeGreaterThan(30 * 30000);
  });

  it('book exp uses item xp and ignores non-books', () => {
    expect(bookExpTotal({ book_common: 3, book_rare: 2, mat_feather_common: 10 })).toBe(300 + 1000);
    expect(ITEMS.book_legendary.xp).toBe(30000);
  });

  it('preview and levelUp agree and charge coins per applied exp', () => {
    const p = createProfile();
    const books = { book_common: 5 };
    const pre = previewLevelUp(p, 'aoi', books);
    expect(pre.exp).toBe(500);
    // level 1 → 100, level 2 → … ; 500 exp reaches at least level 3
    let lvl = 1;
    let left = 500;
    while (left >= expForLevel(lvl)) left -= expForLevel(lvl++);
    expect(pre.toLevel).toBe(lvl);
    expect(pre.expAfter).toBe(left);
    expect(pre.coinCost).toBe(Math.ceil(500 * COINS_PER_EXP));
    const coins = p.currencies.coins;
    const r = levelUp(p, 'aoi', books);
    expect(r).toMatchObject({ ok: true, fromLevel: 1, toLevel: lvl });
    expect(p.units.aoi.level).toBe(lvl);
    expect(p.units.aoi.exp).toBe(left);
    expect(p.items.book_common).toBe(15);
    expect(p.currencies.coins).toBe(coins - pre.coinCost);
    expect(p.missions.counters.levelUp).toBe(lvl - 1);
  });

  it('stops at the cap, wastes overflow without charging it', () => {
    const p = createProfile();
    p.items.book_legendary = 1;
    const pre = previewLevelUp(p, 'aoi', { book_legendary: 1 });
    expect(pre.toLevel).toBe(10);
    expect(pre.capped).toBe(true);
    expect(pre.wasted).toBe(30000 - totalExpToLevel(10));
    expect(pre.coinCost).toBe(Math.ceil(totalExpToLevel(10) * COINS_PER_EXP));
    expect(levelUp(p, 'aoi', { book_legendary: 1 }).ok).toBe(true);
    expect(p.units.aoi).toMatchObject({ level: 10, exp: 0 });
    expect(levelUp(p, 'aoi', { book_common: 1 })).toMatchObject({ ok: false, error: 'capped' });
  });

  it('refuses without books/coins and leaves the profile untouched', () => {
    const p = createProfile();
    expect(levelUp(p, 'aoi', {}).error).toBe('noBooks');
    expect(levelUp(p, 'luna', { book_common: 1 }).error).toBe('notOwned');
    expect(levelUp(p, 'aoi', { book_rare: 99 }).error).toBe('missing');
    p.currencies.coins = 0;
    const r = levelUp(p, 'aoi', { book_common: 1 });
    expect(r.error).toBe('missing');
    expect(p.items.book_common).toBe(20);
    expect(p.units.aoi.level).toBe(1);
  });

  it('autoSelectBooks reaches the cap when possible and uses only owned books', () => {
    const p = createProfile();
    const pick = autoSelectBooks(p, 'aoi');
    for (const [id, n] of Object.entries(pick)) expect(n).toBeLessThanOrEqual(p.items[id]);
    const need = totalExpToLevel(10);
    const exp = bookExpTotal(pick);
    const owned = bookExpTotal({ book_common: p.items.book_common, book_rare: p.items.book_rare });
    expect(exp).toBeGreaterThanOrEqual(Math.min(need, owned));
    // no huge overshoot: dropping the smallest book would fall short
    if (exp >= need) expect(exp - 100).toBeLessThan(need + 500);
    p.items.book_legendary = 3;
    const big = autoSelectBooks(p, 'aoi');
    expect(bookExpTotal(big)).toBeGreaterThanOrEqual(need);
  });
});

describe('breakthrough', () => {
  it('costs the unit family with escalating rarity', () => {
    const order = ['common', 'rare', 'superRare', 'mythic', 'legendary'];
    for (const u of UNITS) {
      let lastTop = -1;
      for (let gate = 1; gate <= 5; gate++) {
        const cost = breakthroughCost(u.id, gate);
        const mats = cost.filter((c) => c.id.startsWith('mat_'));
        expect(mats.length).toBeGreaterThan(0);
        for (const m of mats) expect(m.id.startsWith(`mat_${u.materialFamily}_`)).toBe(true);
        const top = Math.max(...mats.map((m) => order.indexOf(m.id.split('_')[2])));
        expect(top).toBeGreaterThan(lastTop);
        lastTop = top;
        expect(cost.find((c) => c.id === 'coins').count).toBeGreaterThan(0);
      }
    }
    expect(breakthroughCost('aoi', 1)).toEqual([{ id: 'mat_feather_common', count: 8 }, { id: 'coins', count: 5000 }]);
  });

  it('is gated by level cap and materials', () => {
    const p = createProfile();
    expect(canBreakthrough(p, 'aoi')).toMatchObject({ ok: false, reason: 'level' });
    p.units.aoi.level = 10;
    p.items.mat_feather_common = 3;
    const c = canBreakthrough(p, 'aoi');
    expect(c).toMatchObject({ ok: false, reason: 'missing' });
    expect(c.missing).toEqual([{ id: 'mat_feather_common', need: 8, have: 3 }]);
    expect(breakthrough(p, 'aoi').ok).toBe(false);
    p.items.mat_feather_common = 8;
    const coins = p.currencies.coins;
    expect(breakthrough(p, 'aoi')).toMatchObject({ ok: true, gate: 1, cap: 20 });
    expect(p.items.mat_feather_common).toBeUndefined();
    expect(p.currencies.coins).toBe(coins - 5000);
    expect(canBreakthrough(p, 'aoi').reason).toBe('level');
    p.units.aoi.breakthrough = 5;
    p.units.aoi.level = 60;
    expect(canBreakthrough(p, 'aoi').reason).toBe('max');
  });
});

describe('awakening', () => {
  it('uses crowns per star, star fragments and coins', () => {
    const crownsFor = (star) => awakenCost('aoi', star).filter((c) => c.id.startsWith('crown_')).map((c) => c.id);
    expect(crownsFor(1)).toEqual(['crown_slime']);
    expect(crownsFor(2)).toContain('crown_iron');
    expect(crownsFor(3)).toContain('crown_cog');
    expect(crownsFor(4)).toEqual(['crown_oni']);
    expect(crownsFor(5)).toContain('crown_dragon');
    let lastCoins = 0;
    for (let s = 1; s <= 5; s++) {
      const cost = awakenCost('kaede', s);
      expect(cost.find((c) => c.id === 'star_fragment').count).toBeGreaterThan(0);
      const coins = cost.find((c) => c.id === 'coins').count;
      expect(coins).toBeGreaterThan(lastCoins);
      lastCoins = coins;
    }
  });

  it('awakens with materials and unlocks the passive at 3 stars', () => {
    const p = createProfile();
    expect(canAwaken(p, 'aoi').ok).toBe(false);
    p.currencies.coins = 10_000_000;
    Object.assign(p.items, { crown_slime: 1, crown_iron: 2, crown_cog: 1, crown_oni: 2, crown_dragon: 1, star_fragment: 500 });
    for (let s = 1; s <= 5; s++) {
      const r = awaken(p, 'aoi');
      expect(r.ok).toBe(true);
      expect(r.star).toBe(s);
      expect(unitBattleStats(p, 'aoi').awakenPassive).toBe(s >= 3);
    }
    expect(canAwaken(p, 'aoi').reason).toBe('max');
    expect(p.items.crown_dragon).toBeUndefined();
    expect(p.items.star_fragment).toBe(500 - (10 + 20 + 30 + 50 + 80));
  });
});

describe('battle stats', () => {
  it('neutral at level 1 and modest at the top', () => {
    const p = createProfile();
    const s = unitBattleStats(p, 'aoi');
    expect(s).toMatchObject({ damageMul: 1, rateMul: 1, rangeMul: 1, critChance: 0, critMul: 1, armorPen: 0, costMul: 1, ultHaste: 0, awakenPassive: false, level: 1, awaken: 0 });
    Object.assign(p.units.aoi, { level: 60, breakthrough: 5, awaken: 5 });
    const top = unitBattleStats(p, 'aoi');
    expect(top.damageMul).toBeGreaterThan(2.3);
    expect(top.damageMul).toBeLessThan(2.5);
    expect(top.rateMul).toBeCloseTo(1 + 0.004 * 59, 4);
    expect(unitPower(p, 'aoi')).toBeGreaterThan(unitPower(createProfile(), 'aoi'));
  });

  it('includes gear totals', () => {
    const p = createProfile();
    const rng = createRng(5);
    const charm = rollGear(rng, { slot: 'charm', rarity: 'legendary' });
    charm.main = { stat: 'atkPct', value: 0.2, base: 0.2 };
    charm.subs = [{ stat: 'critChance', value: 0.1, base: 0.1, upgrades: 0 }, { stat: 'armorPen', value: 2, base: 2, upgrades: 0 }, { stat: 'costCut', value: 0.05, base: 0.05, upgrades: 0 }, { stat: 'ultHaste', value: 0.1, base: 0.1, upgrades: 0 }];
    equipGear(p, 'hikari', addGear(p, charm));
    const s = unitBattleStats(p, 'hikari');
    expect(s.damageMul).toBeCloseTo(1.2, 4);
    expect(s.critChance).toBeCloseTo(0.1, 4);
    expect(s.armorPen).toBe(2);
    expect(s.costMul).toBeCloseTo(0.95, 4);
    expect(s.ultHaste).toBeCloseTo(0.1, 4);
  });

  it('works for unowned units', () => {
    expect(unitBattleStats(createProfile(), 'luna').level).toBe(1);
  });
});
