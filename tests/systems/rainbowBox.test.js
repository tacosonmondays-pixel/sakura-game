// The Rainbow Gear Box seam (integration of track 2 UR gear and track 3 Ascension, docs/specs/ASCENSION.md §C.8):
// Titan Trials grant the box through titanRewards.grantGearBox, the Backpack's slot picker opens it through
// UR gear's openRainbowBox into real rainbow UR gear (+0, four substats), and the `gbx:` mirror keeps a
// box-born piece below +10 rainbow through a save round trip and an older build that drops `ur`.
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import { addItems, itemCount } from '../../src/systems/inventory.js';
import { createRng } from '../../src/core/rng.js';
import { GEAR_SLOTS, GEAR_MAIN_STATS } from '../../src/data/types.js';
import { MARK, SEED_ID, UR_MAX_LEVEL } from '../../src/data/gearAwaken.js';
import {
  openGearBox, openRainbowBox, boxMark, isUrGear, gearLines, enhanceGear, enhanceCost, salvageGear, salvageRewards, setGearLocked, rerollMainStat,
  stitchSlots, enhanceInvested, RAINBOW_BOX_ID, MAX_GEAR_LEVEL,
} from '../../src/systems/gear.js';
import { writeGearMarks } from '../../src/systems/gearMarks.js';
import { grantGearBox } from '../../src/systems/titanRewards.js';
import { applyTitanResult } from '../../src/systems/titans.js';
import { RAINBOW_METER, METER_KEY } from '../../src/systems/titanRewards.js';

const T0 = Date.UTC(2026, 9, 21, 12);

/** A save with the Titan Trials gates cleared, coins to spare. */
function ready() {
  const p = createProfile();
  for (const id of ['3-5', '6-5', '8-5']) p.progress.stages[id] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
  p.currencies.coins = 1e8;
  return p;
}
/** What a store write + a reload does to the profile (store.js saveText writes the gear mirrors first). */
const reload = (p) => {
  writeGearMarks(p);
  return migrateProfile(JSON.parse(JSON.stringify(p)));
};
/** An older build that knows no `ur`: it drops the flag (and clamps the level to 10) and keeps counters word for word. */
const olderBuild = (p) => {
  const q = JSON.parse(JSON.stringify(p));
  for (const g of Object.values(q.gear)) {
    delete g.ur;
    g.level = Math.min(g.level, MAX_GEAR_LEVEL);
  }
  return q;
};

describe('Rainbow Gear Box → real UR gear', () => {
  it('a Titan Trials Rainbow box waits in the Backpack, the plain Open refuses it, the slot picker opens it into UR +0', () => {
    const p = ready();
    const g0 = grantGearBox(p, 'rainbow', createRng(1));
    expect(g0).toEqual({ item: { id: RAINBOW_BOX_ID, count: 1 }, gear: null });
    expect(itemCount(p, RAINBOW_BOX_ID)).toBe(1);
    expect(openGearBox(p, RAINBOW_BOX_ID, createRng(2))).toMatchObject({ ok: false, error: 'pickSlot' });
    const before = Object.keys(p.gear).length;
    const r = openRainbowBox(p, 'ribbon', createRng(3));
    expect(r.ok).toBe(true);
    const g = r.gear;
    expect(Object.keys(p.gear).length).toBe(before + 1);
    expect(p.gear[g.uid]).toBe(g);
    expect(g).toMatchObject({ slot: 'ribbon', rarity: 'legendary', ur: 1, level: 0, locked: true, equippedBy: null });
    expect(isUrGear(g)).toBe(true);
    expect(g.subs).toHaveLength(4);
    expect(g.name).toMatch(/of the Rainbow Sakura$/);
    expect(g.club).toBeTruthy(); // a fresh Mythic+ piece joins a club like every box piece
    expect(itemCount(p, RAINBOW_BOX_ID)).toBe(0);
    // the UR read: every number ×8/7 over its stored Legendary value
    expect(gearLines(g).main.value).toBeGreaterThan(g.main.value);
    // UR rules: up to +12, both ✦ slots
    expect(stitchSlots(g)).toMatchObject({ gold: { open: true }, rainbow: { open: true } });
    const c = p.missions.counters;
    expect(c[`${MARK.box}${g.uid}`]).toBe(Object.keys(GEAR_SLOTS).indexOf('ribbon') * 100 + GEAR_MAIN_STATS.ribbon.indexOf(g.main.stat) + 1);
    expect(c[`${MARK.box}${g.uid}`]).toBe(boxMark(g));
  });

  it('a Mayhem chest that forces the Rainbow box (Meter) ends as rainbow UR gear in the picked slot', () => {
    const p = ready();
    p.missions.counters['tbest:wyrm'] = 3;
    p.missions.counters[METER_KEY] = RAINBOW_METER - 1;
    const res = applyTitanResult(p, { titanId: 'wyrm', tier: 'mayhem', rank: 0, seed: 7, read: { share: 1, victory: true, damage: 1, pool: 1, leaked: false }, kills: { wyrm: 1 }, encountered: ['fp_eclipse_wyrm'] }, { now: T0 });
    expect(res.box).toBe('rainbow');
    expect(itemCount(p, RAINBOW_BOX_ID)).toBe(1);
    const r = openRainbowBox(p, 'shoes', createRng(9));
    expect(r.ok).toBe(true);
    expect(r.gear).toMatchObject({ slot: 'shoes', rarity: 'legendary', ur: 1, level: 0 });
  });

  it('refuses an unknown slot, no box, or a full gear bag (and keeps the box)', () => {
    const p = ready();
    expect(openRainbowBox(p, 'charm', createRng(1))).toMatchObject({ ok: false, error: 'missing' });
    addItems(p, [{ id: RAINBOW_BOX_ID, count: 1 }]);
    expect(openRainbowBox(p, 'hat', createRng(1))).toMatchObject({ ok: false, error: 'slot' });
    for (let i = 0; i < 1000; i++) p.gear[`x${i}`] = { uid: `x${i}` };
    expect(openRainbowBox(p, 'charm', createRng(1))).toMatchObject({ ok: false, error: 'bagFull' });
    expect(itemCount(p, RAINBOW_BOX_ID)).toBe(1);
  });

  it('enhances from +0 to +12 at UR (tier-6) prices', () => {
    const p = ready();
    addItems(p, [{ id: RAINBOW_BOX_ID, count: 1 }]);
    const { gear: g } = openRainbowBox(p, 'charm', createRng(5));
    expect(enhanceCost(g)).toBe(800 * 6);
    let spent = 0;
    while (enhanceCost(g) != null) {
      spent += enhanceCost(g);
      expect(enhanceGear(p, g.uid).ok).toBe(true);
    }
    expect(g.level).toBe(UR_MAX_LEVEL);
    expect(spent).toBe(216000);
  });
});

describe('box-born UR survives saves (gbx: mirror)', () => {
  it('a +0 box piece stays UR at +0 through a store write and reload; no gur: mark, no free Seed, no level bump', () => {
    const p = ready();
    addItems(p, [{ id: RAINBOW_BOX_ID, count: 1 }]);
    const { gear } = openRainbowBox(p, 'charm', createRng(4));
    const seeds = itemCount(p, SEED_ID);
    const back = reload(p);
    const g = back.gear[gear.uid];
    expect(g).toMatchObject({ ur: 1, level: 0, rarity: 'legendary', slot: 'charm' });
    expect(back.missions.counters[`${MARK.ur}${gear.uid}`]).toBeUndefined();
    expect(itemCount(back, SEED_ID)).toBe(seeds);
    // idempotent
    const again = reload(back);
    expect(again.gear[gear.uid]).toMatchObject({ ur: 1, level: 0 });
    expect(itemCount(again, SEED_ID)).toBe(seeds);
  });

  it('an older build that drops `ur` gives it back on the next load, at its own level', () => {
    const p = ready();
    addItems(p, [{ id: RAINBOW_BOX_ID, count: 1 }]);
    const { gear } = openRainbowBox(p, 'shoes', createRng(6));
    for (let i = 0; i < 4; i++) enhanceGear(p, gear.uid);
    writeGearMarks(p);
    const back = migrateProfile(olderBuild(p));
    expect(back.gear[gear.uid]).toMatchObject({ ur: 1, level: 4 });
  });

  it('a Prism Dice main-stat change moves the mark with it', () => {
    const p = ready();
    addItems(p, [{ id: RAINBOW_BOX_ID, count: 1 }, { id: 'dice_prism', count: 5 }]);
    const { gear } = openRainbowBox(p, 'ribbon', createRng(8));
    expect(rerollMainStat(p, gear.uid, createRng(2)).ok).toBe(true);
    writeGearMarks(p);
    expect(p.missions.counters[`${MARK.box}${gear.uid}`]).toBe(boxMark(p.gear[gear.uid]));
    const back = migrateProfile(olderBuild(p));
    expect(back.gear[gear.uid].ur).toBe(1);
  });

  it("an older build's Prism Dice on a box piece below +10 keeps it UR: uid + slot match, the mark follows the new main stat", () => {
    const p = ready();
    addItems(p, [{ id: RAINBOW_BOX_ID, count: 1 }]);
    const { gear } = openRainbowBox(p, 'ribbon', createRng(8));
    for (let i = 0; i < 3; i++) expect(enhanceGear(p, gear.uid).ok).toBe(true);
    writeGearMarks(p);
    const key = `${MARK.box}${gear.uid}`;
    const mark = p.missions.counters[key];
    const ref = reload(p);
    setGearLocked(ref, gear.uid, false);
    const refRewards = salvageRewards(ref.gear[gear.uid], ref);
    expect(refRewards).toContainEqual({ id: SEED_ID, count: 1 });
    // the older build sees a plain Legendary +3 and rerolls its main stat (it has no lock check), leaving gbx: as it was
    const old = olderBuild(p);
    addItems(old, [{ id: 'dice_prism', count: 1 }]);
    const stat = old.gear[gear.uid].main.stat;
    expect(rerollMainStat(old, gear.uid, createRng(2)).ok).toBe(true);
    expect(old.gear[gear.uid].main.stat).not.toBe(stat);
    expect(old.missions.counters[key]).toBe(mark);
    expect(boxMark(old.gear[gear.uid])).not.toBe(mark);
    const back = migrateProfile(JSON.parse(JSON.stringify(old)));
    const g = back.gear[gear.uid];
    expect(g).toMatchObject({ ur: 1, level: 3, slot: 'ribbon', rarity: 'legendary' });
    expect(g.main.stat).toBe(old.gear[gear.uid].main.stat);
    expect(back.missions.counters[key]).toBe(boxMark(g));
    // still a UR: its salvage returns the Seed and counts its UR-priced levels (gbl:) as before the reroll
    setGearLocked(back, gear.uid, false);
    expect(salvageRewards(back.gear[gear.uid], back)).toEqual(refRewards);
    // idempotent, and a mark for another slot never makes a Legendary UR
    expect(reload(back).gear[gear.uid]).toEqual(back.gear[gear.uid]);
    const wrong = olderBuild(p);
    wrong.missions.counters[key] = ((mark + 99) % 300) + 1;
    expect(Math.floor((wrong.missions.counters[key] - 1) / 100)).not.toBe(Math.floor((mark - 1) / 100));
    expect(migrateProfile(wrong).gear[gear.uid].ur).toBeUndefined();
  });

  it('a hostile ur flag on a +0 Legendary without the mark is dropped', () => {
    const p = ready();
    addItems(p, [{ id: RAINBOW_BOX_ID, count: 1 }]);
    const { gear } = openRainbowBox(p, 'charm', createRng(4));
    writeGearMarks(p);
    const q = JSON.parse(JSON.stringify(p));
    delete q.missions.counters[`${MARK.box}${gear.uid}`];
    expect(migrateProfile(q).gear[gear.uid].ur).toBeUndefined();
  });

  it('salvage pays the Legendary payout + 1 Rainbow Seed and zeroes the mark; an older build\'s salvage is paid its Seed once', () => {
    const p = ready();
    addItems(p, [{ id: RAINBOW_BOX_ID, count: 2 }]);
    const a = openRainbowBox(p, 'charm', createRng(1)).gear;
    const b = openRainbowBox(p, 'ribbon', createRng(2)).gear;
    setGearLocked(p, a.uid, false);
    const seeds = itemCount(p, SEED_ID);
    const r = salvageGear(p, a.uid);
    expect(r.ok).toBe(true);
    expect(r.rewards).toContainEqual({ id: SEED_ID, count: 1 });
    expect(r.rewards).toContainEqual({ id: 'lock_pin', count: 1 });
    expect(itemCount(p, SEED_ID)).toBe(seeds + 1);
    expect(p.missions.counters[`${MARK.box}${a.uid}`]).toBe(0);
    // reload: the zeroed mark pays nothing
    expect(itemCount(reload(p), SEED_ID)).toBe(seeds + 1);
    // an older build salvages `b` (it pays no Seed and keeps the counters): the next load pays it, once
    writeGearMarks(p);
    const old = olderBuild(p);
    delete old.gear[b.uid];
    const back = migrateProfile(old);
    expect(itemCount(back, SEED_ID)).toBe(seeds + 2);
    expect(back.missions.counters[`${MARK.box}${b.uid}`]).toBe(0);
    expect(itemCount(migrateProfile(JSON.parse(JSON.stringify(back))), SEED_ID)).toBe(seeds + 2);
  });
});

describe('box-born UR salvage refunds what its levels really cost (gbl:)', () => {
  const PAYOUT = 300 * 25; // the Legendary base payout
  const coinsOf = (rewards) => rewards.find((r) => r.id === 'coins')?.count || 0;
  /** Enhance to `to`, returning the coins it took. */
  const enhanceTo = (p, uid, to) => {
    const before = itemCount(p, 'coins');
    while (p.gear[uid].level < to) expect(enhanceGear(p, uid).ok).toBe(true);
    return before - itemCount(p, 'coins');
  };

  it('a box piece taken +0 → +10 → +12 at UR prices salvages for half of all of it (was 13,000 short)', () => {
    const p = ready();
    addItems(p, [{ id: RAINBOW_BOX_ID, count: 1 }]);
    const { gear } = openRainbowBox(p, 'charm', createRng(11));
    const uid = gear.uid;
    const to10 = enhanceTo(p, uid, MAX_GEAR_LEVEL);
    expect(to10).toBe(156000);
    expect(p.missions.counters[`${MARK.boxPaid}${uid}`]).toBe(1023);
    setGearLocked(p, uid, false);
    expect(coinsOf(salvageRewards(p.gear[uid], p))).toBe(PAYOUT + to10 / 2);
    // without the profile the preview stays at the Legendary price (never above what was spent)
    expect(coinsOf(salvageRewards(p.gear[uid]))).toBe(PAYOUT + 65000);
    const spent = to10 + enhanceTo(p, uid, UR_MAX_LEVEL);
    expect(spent).toBe(216000);
    // the mark survives a store write + reload
    const q = reload(p);
    expect(q.missions.counters[`${MARK.boxPaid}${uid}`]).toBe(1023);
    const before = itemCount(q, 'coins');
    const r = salvageGear(q, uid);
    expect(r.ok).toBe(true);
    expect(coinsOf(r.rewards)).toBe(PAYOUT + spent / 2);
    expect(itemCount(q, 'coins') - before).toBe(PAYOUT + spent / 2);
    expect(q.missions.counters[`${MARK.boxPaid}${uid}`]).toBeUndefined();
    expect(q.missions.counters[`${MARK.box}${uid}`]).toBe(0);
    // nothing more on the next load
    expect(itemCount(reload(q), 'coins')).toBe(itemCount(q, 'coins'));
  });

  it('levels an older build sold at Legendary prices refund at Legendary prices: never more than was spent', () => {
    const p = ready();
    addItems(p, [{ id: RAINBOW_BOX_ID, count: 1 }]);
    const { gear } = openRainbowBox(p, 'ribbon', createRng(12));
    const uid = gear.uid;
    let spent = enhanceTo(p, uid, 3); // UR prices
    writeGearMarks(p);
    // an older build sees a Legendary +3 and sells +3 → +7 at Legendary prices (it writes no gbl: bits)
    const old = olderBuild(p);
    expect(isUrGear(old.gear[uid])).toBe(false);
    spent += enhanceTo(old, uid, 7);
    expect(old.missions.counters[`${MARK.boxPaid}${uid}`]).toBe(0b111);
    const back = reload(old);
    expect(back.gear[uid]).toMatchObject({ ur: 1, level: 7 });
    spent += enhanceTo(back, uid, UR_MAX_LEVEL); // UR prices again
    expect(back.missions.counters[`${MARK.boxPaid}${uid}`]).toBe(0b1110000111);
    setGearLocked(back, uid, false);
    const refund = coinsOf(salvageRewards(back.gear[uid], back));
    expect(refund).toBe(PAYOUT + Math.floor(spent / 2));
    // the old tab's four levels do not count at UR prices: less than a box piece paid at UR prices all the way
    expect(refund).toBeLessThan(PAYOUT + 216000 / 2);
    expect(coinsOf(salvageGear(back, uid).rewards)).toBe(refund);
  });

  it('an older build\'s salvage of a +12 box piece is made whole on the next load, once', () => {
    const p = ready();
    addItems(p, [{ id: RAINBOW_BOX_ID, count: 1 }]);
    const { gear } = openRainbowBox(p, 'shoes', createRng(13));
    const uid = gear.uid;
    const spent = enhanceTo(p, uid, UR_MAX_LEVEL);
    setGearLocked(p, uid, false);
    writeGearMarks(p);
    const seeds = itemCount(p, SEED_ID);
    // the older build sees a Legendary +10 and pays its Legendary salvage, then keeps the counters word for word
    const old = olderBuild(p);
    const oldPay = PAYOUT + Math.floor(enhanceInvested(old.gear[uid]) / 2);
    expect(oldPay).toBe(PAYOUT + 65000);
    const start = itemCount(old, 'coins');
    old.currencies.coins += oldPay;
    delete old.gear[uid];
    const back = migrateProfile(old);
    // + the +11 / +12 refund (gur:) + the UR-over-Legendary half of +0 … +9 (gbl:) = half of all 216,000
    expect(itemCount(back, 'coins') - start).toBe(PAYOUT + spent / 2);
    expect(itemCount(back, SEED_ID)).toBe(seeds + 1);
    expect(back.missions.counters[`${MARK.boxPaid}${uid}`]).toBeUndefined();
    expect(back.missions.counters[`${MARK.box}${uid}`]).toBe(0);
    const again = migrateProfile(JSON.parse(JSON.stringify(back)));
    expect(itemCount(again, 'coins')).toBe(itemCount(back, 'coins'));
    expect(itemCount(again, SEED_ID)).toBe(seeds + 1);
  });
});
