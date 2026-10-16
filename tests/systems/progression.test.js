import { describe, it, expect } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import {
  MAX_LEVEL, levelCap, expForLevel, totalExpToLevel, bookExpTotal, previewLevelUp, levelUp, autoSelectBooks,
  breakthroughCost, canBreakthrough, breakthrough, awakenCost, canAwaken, awaken, unitBattleStats, unitPower, COINS_PER_EXP,
  BREAKTHROUGH_LEVEL_CAP, POTENTIAL_LEVEL_CAPS, EXP_PER_LEVEL_ABOVE_60, COINS_PER_LEVEL_ABOVE_60, LEVEL_PAST_GATES,
  potentialLevelCap, LEVEL_SHADOW_PREFIX, settleLevels, levelCapInfo,
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
    // a P1 girl past gate 5 is capped at 60 (MAX_LEVEL is 85 now, P6's cap)
    expect(levelCap({ breakthrough: 9 })).toBe(60);
    expect(MAX_LEVEL).toBe(85);
  });

  it('exp curve grows to 60, then one Akashic Tome per level, and ends at 85', () => {
    for (let l = 1; l < 59; l++) expect(expForLevel(l + 1)).toBeGreaterThan(expForLevel(l));
    expect(expForLevel(59)).toBe(50300);
    for (let l = 60; l < 85; l++) expect(expForLevel(l)).toBe(30000);
    expect(expForLevel(85)).toBe(Infinity);
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

describe('levels past 60 (Potential raises the cap; docs/specs/POTENTIAL.md v3 §4)', () => {
  const girl = (level, gates, p, exp = 0) => ({ level, exp, breakthrough: gates, awaken: 0, dupes: p - 1, gear: { charm: null, ribbon: null, shoes: null } });
  const withGirl = (st, coins = 10_000_000) => {
    const p = createProfile();
    p.units.aoi = { ...p.units.aoi, ...st };
    p.currencies.coins = coins;
    return p;
  };

  it('one table holds the caps and the price of a level above 60', () => {
    expect(LEVEL_PAST_GATES).toMatchObject({ from: 60, caps: [60, 63, 67, 72, 78, 85], exp: 30000, coins: 12000, book: 'book_legendary' });
    expect(Object.isFrozen(LEVEL_PAST_GATES)).toBe(true);
    expect(Object.isFrozen(LEVEL_PAST_GATES.caps)).toBe(true);
    expect(BREAKTHROUGH_LEVEL_CAP).toBe(60);
    expect(POTENTIAL_LEVEL_CAPS).toBe(LEVEL_PAST_GATES.caps);
    expect(EXP_PER_LEVEL_ABOVE_60).toBe(ITEMS[LEVEL_PAST_GATES.book].xp);
    expect(ITEMS[LEVEL_PAST_GATES.book].name).toBe('Akashic Tome');
    expect(COINS_PER_LEVEL_ABOVE_60).toBe(12000);
    expect(MAX_LEVEL).toBe(POTENTIAL_LEVEL_CAPS[5]);
    // every step raises the cap by more than the last: +3, +4, +5, +6, +7
    expect(POTENTIAL_LEVEL_CAPS.slice(1).map((c, i) => c - POTENTIAL_LEVEL_CAPS[i])).toEqual([3, 4, 5, 6, 7]);
  });

  it('gates 0–4 cap at 10…50 whatever her Potential; gate 5 caps at 60 / 63 / 67 / 72 / 78 / 85 for P1…P6', () => {
    for (let gates = 0; gates < 5; gates++) for (let p = 1; p <= 6; p++) expect(levelCap(girl(1, gates, p))).toBe(10 + 10 * gates);
    expect([1, 2, 3, 4, 5, 6].map((p) => levelCap(girl(60, 5, p)))).toEqual([60, 63, 67, 72, 78, 85]);
    expect([1, 2, 3, 4, 5, 6].map((p) => potentialLevelCap(p))).toEqual([60, 63, 67, 72, 78, 85]);
    // duplicates past P6 never raise it further
    expect(levelCap({ breakthrough: 5, dupes: 40 })).toBe(85);
    expect(levelCap({ breakthrough: 5, dupes: null })).toBe(60);
    expect(levelCap(undefined)).toBe(10);
  });

  it('levelCapInfo says what raises her cap next (the screens\' copy)', () => {
    expect(levelCapInfo(girl(30, 2, 6))).toEqual({ cap: 30, max: 85, p: 6, by: 'gate', next: 40, nextGate: 3, full: false });
    // gate 5 opens her Potential's cap at once: a P4 girl at gate 4 goes from 50 to 72
    expect(levelCap({ ...girl(50, 4, 4), breakthrough: 5 })).toBe(72);
    expect(levelCapInfo(girl(72, 5, 4))).toEqual({ cap: 72, max: 85, p: 4, by: 'potential', next: 78, nextP: 5, full: false });
    expect(levelCapInfo(girl(60, 5, 1))).toMatchObject({ cap: 60, next: 63, nextP: 2 });
    expect(levelCapInfo(girl(85, 5, 6))).toEqual({ cap: 85, max: 85, p: 6, by: 'potential', next: null, nextP: null, full: true });
  });

  it('60 → 85 is 750,000 EXP (25 Tomes); 1 → 85 is 1,856,630', () => {
    expect(totalExpToLevel(60)).toBe(1_106_630);
    expect(totalExpToLevel(85)).toBe(1_856_630);
    expect(totalExpToLevel(85) - totalExpToLevel(60)).toBe(25 * 30000);
    expect(totalExpToLevel(99)).toBe(totalExpToLevel(85));
  });

  it('charges 12,000 coins and one Akashic Tome per level above 60', () => {
    const p = withGirl(girl(60, 5, 4));
    p.items.book_legendary = 20;
    const pre = previewLevelUp(p, 'aoi', { book_legendary: 3 });
    expect(pre).toMatchObject({ fromLevel: 60, toLevel: 63, exp: 90000, expAfter: 0, coinCost: 36000, capped: false, wasted: 0, cap: 72 });
    const one = previewLevelUp(p, 'aoi', { book_legendary: 1 });
    expect(one).toMatchObject({ toLevel: 61, coinCost: 12000 });
    // part of a level: coins per EXP applied, at the same rate
    expect(previewLevelUp(p, 'aoi', { book_mythic: 1 }).coinCost).toBe(Math.ceil(8000 * 12000 / 30000));
    const coins = p.currencies.coins;
    expect(levelUp(p, 'aoi', { book_legendary: 3 })).toMatchObject({ ok: true, fromLevel: 60, toLevel: 63, coinCost: 36000 });
    expect(p.currencies.coins).toBe(coins - 36000);
    expect(p.items.book_legendary).toBe(17);
    expect(unitBattleStats(p, 'aoi').level).toBe(63);
  });

  it('a level-up across 60 charges each band at its own price', () => {
    const p = withGirl(girl(59, 5, 2));
    p.items.book_legendary = 5;
    // 59 → 60 takes 50,300 EXP (live price), the next 30,000 are one level above 60
    const pre = previewLevelUp(p, 'aoi', { book_legendary: 3 });
    expect(pre.toLevel).toBe(61);
    expect(pre.expAfter).toBe(90000 - 50300 - 30000);
    expect(pre.coinCost).toBe(Math.ceil(50300 * COINS_PER_EXP + (90000 - 50300) * 12000 / 30000));
  });

  it('stops at her Potential cap and wastes the overflow (not charged)', () => {
    const p = withGirl(girl(70, 5, 4, 1000));
    p.items.book_legendary = 10;
    const pre = previewLevelUp(p, 'aoi', { book_legendary: 3 });
    expect(pre).toMatchObject({ toLevel: 72, expAfter: 0, capped: true, cap: 72 });
    expect(pre.wasted).toBe(90000 - (60000 - 1000));
    expect(pre.coinCost).toBe(Math.ceil((60000 - 1000) * 12000 / 30000));
    expect(levelUp(p, 'aoi', { book_legendary: 3 }).ok).toBe(true);
    expect(levelUp(p, 'aoi', { book_legendary: 1 })).toMatchObject({ ok: false, error: 'capped' });
    // a P1 girl past gate 5 still stops at 60
    const p1 = withGirl(girl(60, 5, 1));
    p1.items.book_legendary = 1;
    expect(levelUp(p1, 'aoi', { book_legendary: 1 })).toMatchObject({ ok: false, error: 'capped' });
  });

  it('Auto Select fills the books to her Potential cap', () => {
    const p = withGirl(girl(60, 5, 6));
    p.items.book_legendary = 30;
    const auto = autoSelectBooks(p, 'aoi');
    expect(auto.book_legendary).toBe(25);
    expect(previewLevelUp(p, 'aoi', auto)).toMatchObject({ toLevel: 85, wasted: 0, coinCost: 300000 });
  });

  it('her curve continues: L85 ★5 gate 5 is damage ×2.862 and attack speed ×1.336 (times gear)', () => {
    const p = withGirl({ ...girl(85, 5, 6), awaken: 5 });
    const s = unitBattleStats(p, 'aoi');
    expect(s.damageMul).toBeCloseTo(2.862, 4);
    expect(s.rateMul).toBeCloseTo(1.336, 4);
    expect(s.potential).toBe(6);
    const charm = rollGear(createRng(3), { slot: 'charm', rarity: 'legendary' });
    charm.main = { stat: 'atkPct', value: 0.2, base: 0.2 };
    charm.subs = [{ stat: 'ratePct', value: 0.1, base: 0.1, upgrades: 0 }];
    equipGear(p, 'aoi', addGear(p, charm));
    const g = unitBattleStats(p, 'aoi');
    expect(g.damageMul).toBeCloseTo(2.862 * 1.2, 3);
    expect(g.rateMul).toBeCloseTo(1.336 * 1.1, 3);
    // DPS vs L60: ×1.283 at 85
    const l60 = unitBattleStats(withGirl({ ...girl(60, 5, 6), awaken: 5 }), 'aoi');
    expect((s.damageMul * s.rateMul) / (l60.damageMul * l60.rateMul)).toBeCloseTo(1.283, 2);
  });

  it('writes the level shadow once she is above 60', () => {
    const p = withGirl(girl(60, 5, 3));
    p.items.book_legendary = 5;
    levelUp(p, 'aoi', { book_legendary: 2 });
    expect(p.missions.counters[LEVEL_SHADOW_PREFIX + 'aoi']).toBe(62);
    const q = withGirl(girl(30, 2, 3));
    q.items.book_legendary = 1;
    levelUp(q, 'aoi', { book_legendary: 1 });
    expect(q.missions.counters[LEVEL_SHADOW_PREFIX + 'aoi']).toBeUndefined();
  });

  it('settleLevels: restores a 60-clamped girl from her shadow, never above her cap, and clamps', () => {
    const p = withGirl(girl(60, 5, 4, 12000));
    p.missions.counters['lv:aoi'] = 72;
    expect(settleLevels(p)).toEqual(['aoi']);
    expect(p.units.aoi).toMatchObject({ level: 72, exp: 0 });
    const mid = withGirl(girl(60, 5, 6, 12000));
    mid.missions.counters['lv:aoi'] = 72;
    settleLevels(mid);
    expect(mid.units.aoi).toMatchObject({ level: 72, exp: 12000 });
    // a hostile shadow lifts her only to her cap
    const h = withGirl(girl(60, 5, 2));
    h.missions.counters['lv:aoi'] = 999;
    settleLevels(h);
    expect(h.units.aoi.level).toBe(63);
    // a girl below 60 is never lifted by a shadow
    const low = withGirl(girl(40, 5, 6, 5));
    low.missions.counters['lv:aoi'] = 85;
    settleLevels(low);
    expect(low.units.aoi).toMatchObject({ level: 40, exp: 5 });
    // above her cap: clamped, EXP 0
    const over = withGirl(girl(80, 5, 3, 777));
    settleLevels(over);
    expect(over.units.aoi).toMatchObject({ level: 67, exp: 0 });
    // idempotent, and P1 girls at 60 are untouched
    const again = JSON.stringify(p);
    expect(settleLevels(p)).toEqual([]);
    expect(JSON.stringify(p)).toBe(again);
    const plain = withGirl(girl(60, 5, 1, 0));
    expect(settleLevels(plain)).toEqual([]);
    expect(plain.missions.counters['lv:aoi']).toBeUndefined();
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
