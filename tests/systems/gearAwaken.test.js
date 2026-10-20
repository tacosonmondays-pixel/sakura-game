// Rainbow UR gear (docs/specs/GEAR_AWAKEN.md §12.1): Rainbow Bloom, effective reads, enhance to +12, the
// Starlight Needle, rerolls and salvage with ✦ lines, and nothing ever priced below Legendary.
import { describe, it, expect } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import {
  rollGear, addGear, equipGear, enhanceGear, enhanceCost, rerollSubstats, rerollMainStat, rerollCost, mainRerollCost, salvageGear, salvageRewards,
  gearStatTotals, gearLines, urMul, isUrGear, canAwakenGear, awakenGear, stitchSub, takeBackStitch, stitchSlots, canLockPin, lineCeiling,
  setGearLocked, gearList, MAX_GEAR_LEVEL, subGrowth, enhanceInvested, gearTier,
} from '../../src/systems/gear.js';
import { createRng } from '../../src/core/rng.js';
import { ITEM_RARITY_ORDER } from '../../src/data/types.js';

const rich = () => {
  const p = createProfile();
  p.currencies.coins = 50_000_000;
  Object.assign(p.items, { dice_reroll: 1000, lock_pin: 100, dice_prism: 100, seed_rainbow: 10, needle_star: 20 });
  return p;
};
/** A Legendary +10 piece in the profile (no club). */
const gold10 = (p, slot = 'charm', seed = 3) => addGear(p, rollGear(createRng(seed), { slot, rarity: 'legendary', level: 10 }));

describe('Rainbow Bloom', () => {
  it('needs a Legendary at +10, 1 Seed and 80,000 coins; sets ur, locks, renames; stored values untouched', () => {
    const p = rich();
    const uid = gold10(p);
    const before = JSON.parse(JSON.stringify(p.gear[uid]));
    const coins = p.currencies.coins;
    const r = awakenGear(p, uid);
    expect(r.ok).toBe(true);
    const g = p.gear[uid];
    expect(isUrGear(g)).toBe(true);
    expect(g.locked).toBe(true);
    expect(g.name).toMatch(/of the Rainbow Sakura$/);
    expect(g.main).toEqual(before.main);
    expect(g.subs).toEqual(before.subs);
    expect(p.currencies.coins).toBe(coins - 80000);
    expect(p.items.seed_rainbow).toBe(9);
    expect(p.missions.counters[`gur:${uid}`]).toBe(10);
  });

  it('is refused for Mythic, below +10, already UR, or without a Seed', () => {
    const p = rich();
    const myth = addGear(p, rollGear(createRng(1), { rarity: 'mythic', level: 10 }));
    expect(canAwakenGear(p, myth).reason).toBe('rarity');
    const low = addGear(p, rollGear(createRng(2), { rarity: 'legendary', level: 9 }));
    expect(canAwakenGear(p, low).reason).toBe('level');
    const uid = gold10(p);
    awakenGear(p, uid);
    expect(canAwakenGear(p, uid).reason).toBe('already');
    p.items.seed_rainbow = 0;
    delete p.items.seed_rainbow;
    expect(awakenGear(p, gold10(p, 'shoes', 9)).error).toBe('missing');
  });

  it('reads every number ×8/7 (Armor Pierce ×1.105) through gearLines and the totals', () => {
    const p = rich();
    const uid = gold10(p, 'ribbon', 11);
    equipGear(p, 'aoi', uid);
    const before = gearStatTotals(p, 'aoi');
    awakenGear(p, uid);
    const after = gearStatTotals(p, 'aoi');
    expect(urMul('atkPct')).toBeCloseTo(8 / 7, 9);
    expect(urMul('armorPen')).toBeCloseTo(2.1 / 1.9, 9);
    for (const [k, v] of Object.entries(before)) if (v > 0) expect(after[k]).toBeCloseTo(v * urMul(k), k === 'armorPen' ? 0 : 3);
    const L = gearLines(p.gear[uid]);
    expect(L.main.value).toBeCloseTo(p.gear[uid].main.value * urMul(L.main.stat), 3);
  });

  it('enhances to +12 at tier-6 prices (28,800 / 31,200); +12 grows the least-upgraded line; Legendary still stops at +10', () => {
    const p = rich();
    const uid = gold10(p);
    expect(enhanceCost(p.gear[uid])).toBeNull();
    awakenGear(p, uid);
    expect(enhanceCost(p.gear[uid])).toBe(28800);
    expect(enhanceGear(p, uid).ok).toBe(true);
    expect(enhanceCost(p.gear[uid])).toBe(31200);
    const ups = p.gear[uid].subs.map((s) => s.upgrades || 0);
    const least = ups.indexOf(Math.min(...ups));
    const r = enhanceGear(p, uid);
    expect(r.level).toBe(12);
    expect(r.grewSub).toBe(least);
    expect(enhanceGear(p, uid).error).toBe('max');
    expect(p.gear[uid].subs.reduce((n, s) => n + (s.upgrades || 0), 0)).toBe(4);
  });

  it('the first Legendary +10 pays one Seed, once', () => {
    const p = createProfile();
    p.currencies.coins = 1e7;
    const a = addGear(p, rollGear(createRng(4), { rarity: 'legendary', level: 9 }));
    const b = addGear(p, rollGear(createRng(5), { rarity: 'legendary', level: 9 }));
    expect(enhanceGear(p, a).gift).toEqual([{ id: 'seed_rainbow', count: 1 }]);
    expect(enhanceGear(p, b).gift).toBeUndefined();
    expect(p.items.seed_rainbow).toBe(1);
  });
});

describe('Starlight Needle', () => {
  it('gold first then rainbow; 1 on Legendary +10, 2 on UR; both may sit on one line', () => {
    const p = rich();
    const uid = gold10(p);
    const g = p.gear[uid];
    const v0 = g.subs[0].value;
    expect(stitchSub(p, uid, 0).slot).toBe('gold');
    expect(g.subs[0].tuned).toBe(1);
    expect(g.subs[0].value).toBeCloseTo(v0 + subGrowth(g.subs[0].stat, 'legendary'), 4);
    expect(stitchSub(p, uid, 1).error).toBe('full');
    awakenGear(p, uid);
    expect(stitchSlots(g).free).toBe('rainbow');
    expect(stitchSub(p, uid, 0).slot).toBe('rainbow');
    expect(g.subs[0].tuned).toBe(3);
    expect(stitchSlots(g).free).toBeNull();
    expect(p.items.needle_star).toBe(18);
  });

  it('is refused below +10 and on Mythic', () => {
    const p = rich();
    const low = addGear(p, rollGear(createRng(2), { rarity: 'legendary', level: 8 }));
    expect(stitchSub(p, low, 0).error).toBe('level');
    const myth = addGear(p, rollGear(createRng(6), { rarity: 'mythic', level: 10 }));
    expect(stitchSub(p, myth, 0).error).toBe('rarity');
  });

  it('take back: −10,000 coins, the Needle returns, the value is restored (rainbow before gold)', () => {
    const p = rich();
    const uid = gold10(p);
    const g = p.gear[uid];
    const v0 = g.subs[2].value;
    stitchSub(p, uid, 2);
    awakenGear(p, uid);
    stitchSub(p, uid, 2);
    const coins = p.currencies.coins;
    const needles = p.items.needle_star;
    expect(takeBackStitch(p, uid, 2).ok).toBe(true);
    expect(g.subs[2].tuned).toBe(1);
    expect(takeBackStitch(p, uid, 2).ok).toBe(true);
    expect(g.subs[2].tuned).toBeUndefined();
    expect(g.subs[2].value).toBeCloseTo(v0, 4);
    expect(p.currencies.coins).toBe(coins - 20000);
    expect(p.items.needle_star).toBe(needles + 2);
  });

  it('the crazy line: +74 % Crit DMG ✦✦ is within the UR ceiling', () => {
    expect(lineCeiling('critDmg', { ur: true, ups: 4, tuned: 3 })).toBeGreaterThan(lineCeiling('critDmg', { ups: 3 }));
    expect(lineCeiling('critDmg', { ur: true, ups: 1, tuned: 3 })).toBeGreaterThan(0.74);
  });
});

describe('rerolls and salvage with ✦ lines', () => {
  it('a substat reroll keeps every ✦ line with its ▲; ≥ 2 lines still reroll; ▲ are conserved at +12', () => {
    const p = rich();
    const uid = gold10(p);
    stitchSub(p, uid, 1);
    awakenGear(p, uid);
    enhanceGear(p, uid);
    enhanceGear(p, uid);
    stitchSub(p, uid, 3);
    const g = p.gear[uid];
    const kept = [JSON.stringify(g.subs[1]), JSON.stringify(g.subs[3])];
    expect(canLockPin(g, 0)).toBe(false); // would leave only one line to reroll
    expect(rerollSubstats(p, uid, createRng(77), { lockIndex: 0 }).error).toBe('badLock');
    const r = rerollSubstats(p, uid, createRng(77));
    expect(r.ok).toBe(true);
    expect([JSON.stringify(g.subs[1]), JSON.stringify(g.subs[3])]).toEqual(kept);
    expect(g.subs.reduce((n, s) => n + (s.upgrades || 0), 0)).toBe(4);
    expect(isUrGear(g)).toBe(true);
    expect(new Set(g.subs.map((s) => s.stat)).size).toBe(4);
  });

  it('a main-stat reroll: the player picks the stat; a clashing ✦ line keeps its ▲ and ✦; the name stays Rainbow', () => {
    const p = rich();
    const uid = gold10(p, 'ribbon', 21);
    const g = p.gear[uid];
    awakenGear(p, uid);
    const choices = ['critChance', 'rangePct', 'armorPen'].filter((s) => s !== g.main.stat);
    const clashI = g.subs.findIndex((s) => choices.includes(s.stat));
    if (clashI >= 0) stitchSub(p, uid, clashI);
    const want = clashI >= 0 ? g.subs[clashI].stat : choices[0];
    const ups = clashI >= 0 ? g.subs[clashI].upgrades || 0 : 0;
    expect(rerollMainStat(p, uid, createRng(5), { stat: 'atkPct' }).error).toBe('badStat');
    expect(rerollMainStat(p, uid, createRng(5), { stat: want }).ok).toBe(true);
    expect(g.main.stat).toBe(want);
    if (clashI >= 0) {
      expect(g.subs[clashI].stat).not.toBe(want);
      expect(g.subs[clashI].tuned).toBe(1);
      expect(g.subs[clashI].upgrades || 0).toBe(ups);
    }
    expect(g.name).toMatch(/Rainbow Sakura$/);
  });

  it('salvage: UR is refused while locked; unlocked it pays the Legendary payout + the Seed + every Needle', () => {
    const p = rich();
    const uid = gold10(p);
    stitchSub(p, uid, 0);
    awakenGear(p, uid);
    stitchSub(p, uid, 0);
    enhanceGear(p, uid);
    expect(salvageGear(p, uid).error).toBe('locked');
    setGearLocked(p, uid, false);
    const rw = Object.fromEntries(salvageRewards(p.gear[uid]).map((r) => [r.id, r.count]));
    expect(rw.seed_rainbow).toBe(1);
    expect(rw.needle_star).toBe(2);
    expect(rw.lock_pin).toBe(1);
    expect(rw.coins).toBe(300 * 25 + Math.floor(enhanceInvested(p.gear[uid]) * 0.5));
    expect(salvageGear(p, uid).ok).toBe(true);
    expect(p.missions.counters[`gur:${uid}`]).toBeUndefined();
  });

  it('nothing is priced below Legendary for a UR piece (no Common fallback)', () => {
    const p = rich();
    const leg = p.gear[gold10(p)];
    const ur = JSON.parse(JSON.stringify(leg));
    ur.ur = 1;
    for (let lv = 10; lv <= 12; lv++) {
      ur.level = lv;
      expect(rerollCost(ur)[1].count).toBeGreaterThanOrEqual(rerollCost(leg)[1].count);
      expect(mainRerollCost(ur)[1].count).toBeGreaterThanOrEqual(mainRerollCost(leg)[1].count);
      expect(salvageRewards(ur)[0].count).toBeGreaterThanOrEqual(salvageRewards(leg)[0].count);
    }
    expect(gearTier(ur)).toBe(5);
    expect(gearTier(leg)).toBe(ITEM_RARITY_ORDER.indexOf('legendary'));
  });

  it('gearList ranks UR above Legendary', () => {
    const p = rich();
    const a = gold10(p, 'charm', 1);
    const b = gold10(p, 'charm', 2);
    awakenGear(p, b);
    expect(gearList(p)[0].uid).toBe(b);
    expect(MAX_GEAR_LEVEL).toBe(10);
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Sources (gear-awaken §6, gear-stats §C.4)
// ---------------------------------------------------------------------------
import { missionList, claimMission, track as trackEvent } from '../../src/systems/missions.js';
import { SHOP_OFFERS } from '../../src/data/shop.js';
import { itemSources } from '../../src/systems/inventory.js';
import { applyCoopFreeplayEnd, freeplayWeekNeedle } from '../../src/online/coop/rewards.js';
import { migrateProfile } from '../../src/systems/save.js';

describe('Rainbow Hunt, Club Day and the shop', () => {
  it('Rainbow Hunt is hidden before 5-5, counts Total Assault clears (sweeps too) and pays a Seed + a Needle, no gems', () => {
    const p = createProfile();
    expect(missionList(p).weekly.some((m) => m.id === 'w_rainbow')).toBe(false);
    p.progress.stages['5-5'] = { easy: true, normal: false, hard: false, nightmare: false, clears: 1 };
    expect(missionList(p).weekly.some((m) => m.id === 'w_rainbow')).toBe(true);
    trackEvent(p, 'assaultClear', 3);
    const r = claimMission(p, 'weekly', 'w_rainbow');
    expect(r.ok).toBe(true);
    expect(r.rewards).toEqual([{ id: 'seed_rainbow', count: 1 }, { id: 'needle_star', count: 1 }]);
  });

  it('a row still behind its stage never holds "every weekly claimed" back', () => {
    const p = createProfile();
    for (const m of missionList(p).weekly) trackEvent(p, m.id === 'w_dailies5' ? 'dailyDone' : 'battleWin', 0);
    expect(missionList(p).weekly.every((m) => !m.id.startsWith('w_rainbow'))).toBe(true);
  });

  it('the Bounty Exchange sells one Needle (30 tokens) and two Armbands (10) a week; nothing for gems', () => {
    const needle = SHOP_OFFERS.find((o) => o.id === 'bty_needle');
    expect([needle.currency, needle.price, needle.stock, needle.resets]).toEqual(['token_bounty', 30, 1, 'weekly']);
    const band = SHOP_OFFERS.find((o) => o.id === 'bty_club_band');
    expect([band.price, band.stock]).toEqual([10, 2]);
    for (const id of ['seed_rainbow', 'needle_star', 'club_band']) {
      expect(SHOP_OFFERS.some((o) => o.item === id && o.currency === 'gems')).toBe(false);
      expect(itemSources(id).length, id).toBeGreaterThan(0);
    }
  });
});

describe('Freeplay: the weekly Needle and the milestone items', () => {
  it('the first cache of the week holds a Needle, once a week', () => {
    const p = createProfile();
    expect(freeplayWeekNeedle(p)).toBe(1);
    expect(freeplayWeekNeedle(p)).toBe(0);
  });

  it('wave 150 pays 2 Needles and the Matriarch a Seed once per tier; a save that had them before gets the items once on load', () => {
    const p = createProfile();
    const res = { stageId: '4-5', difficulty: 'normal', freeplay: 'blossom', goal: 30, wavesCleared: 160, kills: { dragon_ashwing: 1 }, encountered: [] };
    const out = applyCoopFreeplayEnd(p, res, createRng(1));
    const got = Object.fromEntries(out.rewards.map((r) => [r.id, r.count]));
    expect(got.seed_rainbow).toBe(1);
    expect(got.needle_star).toBe(2 + 1); // + the week's first cache Needle
    const again = applyCoopFreeplayEnd(p, res, createRng(2));
    expect(again.rewards.some((r) => r.id === 'seed_rainbow')).toBe(false);
    // retro: an older save with the marks but no items paid
    const q = createProfile();
    q.missions.counters['fpm:tempest:matriarch'] = 1;
    q.missions.counters['fpm:tempest:w150'] = 1;
    const back = migrateProfile(JSON.parse(JSON.stringify(q)));
    expect(back.items.seed_rainbow).toBe(1);
    expect(back.items.needle_star).toBe(2);
    expect(migrateProfile(JSON.parse(JSON.stringify(back))).items).toEqual(back.items);
  });
});

import { celestialRun, CELESTIAL_PITY } from '../../src/systems/rewards.js';

describe('Celestial bad-luck counter', () => {
  it('40 Hard Total Assault runs without a Legendary: the next one adds a Celestial piece; any Legendary resets; Normal never counts', () => {
    const p = createProfile();
    expect(celestialRun(p, 'boss-lych', 'normal', [])).toBeNull();
    expect(p.missions.counters['pity:cel']).toBeUndefined();
    for (let i = 0; i < CELESTIAL_PITY; i++) expect(celestialRun(p, 'boss-lych', 'hard', [])).toBeNull();
    const g = celestialRun(p, 'boss-lych', 'hard', []);
    expect(g.rarity).toBe('legendary');
    expect(p.missions.counters['pity:cel']).toBe(0);
    celestialRun(p, 'res-gear-3', 'nightmare', []);
    expect(p.missions.counters['pity:cel']).toBe(1);
    celestialRun(p, 'res-gear-3', 'nightmare', [{ rarity: 'legendary' }]);
    expect(p.missions.counters['pity:cel']).toBe(0);
  });
});
