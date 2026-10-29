// The Akashic Tome sources for the levels above 60 (docs/specs/POTENTIAL.md v3 §4.4): Library
// Courtyard III on Nightmare 20 %, a Tome per freeplay cache (at most 2 a week per account, solo and
// co-op together) and the Bounty Exchange row (40 Bounty Tokens, 2 a week). Duplicates past P6 no
// longer pay Tomes (docs/specs/ASCENSION.md §A.3): they are spares that convert into Mementos,
// Moonpearls and recruit points.
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import { createRng } from '../../src/core/rng.js';
import { weekKey } from '../../src/core/util.js';
import { itemCount, itemSources } from '../../src/systems/inventory.js';
import { STAGE_MAP } from '../../src/data/stages.js';
import { SHOP_OFFER_MAP } from '../../src/data/shop.js';
import { buyOffer } from '../../src/systems/shop.js';
import { grantUnit } from '../../src/systems/unlocks.js';
import { pull, spark, POOL } from '../../src/systems/gacha.js';
import { rngOn } from '../fixtures/gachaRng.js';
import { potentialLevel } from '../../src/systems/potential.js';
import { raisePotential, essenceBalance, SPARE_PAY } from '../../src/systems/essence.js';
import { LEVEL_PAST_GATES } from '../../src/systems/progression.js';
import { applyCoopFreeplayEnd, freeplayCacheTomes, freeplayTomeLine, FREEPLAY_REWARDS, FP_TOME_PREFIX } from '../../src/online/coop/rewards.js';
import { applySoloFreeplayEnd } from '../../src/systems/freeplayRewards.js';
import { UNIT_MAP } from '../../src/data/units.js';

const TOME = 'book_legendary';

describe('Library Courtyard III', () => {
  it('drops an Akashic Tome 20 % of Nightmare runs (and only on Nightmare)', () => {
    const tome = STAGE_MAP['res-books-3'].drops.filter((d) => d.item === TOME);
    expect(tome).toHaveLength(1);
    expect(tome[0]).toMatchObject({ chance: 0.2, min: 1, max: 1, difficulty: 'nightmare' });
    // the other tiers carry no Tome
    expect(STAGE_MAP['res-books-1'].drops.some((d) => d.item === TOME)).toBe(false);
    expect(STAGE_MAP['res-books-2'].drops.some((d) => d.item === TOME)).toBe(false);
  });
});

describe('Bounty Exchange', () => {
  it('sells an Akashic Tome for 40 Bounty Tokens, 2 a week', () => {
    const o = SHOP_OFFER_MAP.bty_book_tome;
    expect(o).toMatchObject({ tab: 'bounty', item: TOME, count: 1, price: 40, stock: 2, resets: 'weekly', currency: 'token_bounty' });
    const p = createProfile();
    p.items.token_bounty = 200;
    const monday = new Date(2026, 9, 12, 12);
    expect(buyOffer(p, 'bty_book_tome', 1, monday).ok).toBe(true);
    expect(buyOffer(p, 'bty_book_tome', 1, monday).ok).toBe(true);
    expect(buyOffer(p, 'bty_book_tome', 1, monday)).toMatchObject({ ok: false, error: 'soldOut' });
    expect(itemCount(p, TOME)).toBe(2);
    expect(itemCount(p, 'token_bounty')).toBe(120);
    // a new week restocks it
    expect(buyOffer(p, 'bty_book_tome', 1, new Date(2026, 9, 19, 12)).ok).toBe(true);
  });
});

describe('freeplay caches', () => {
  const fp = (o = {}) => ({
    stageId: '1-3', difficulty: 'normal', won: false, wave: 40, wavesCleared: 39, livesLeft: 0, maxLives: 100,
    encountered: [], kills: {}, stats: {}, freeplay: 'blossom', goal: 15, goalReached: true, finished: false, ...o,
  });
  const banked = { goal: 15, kills: {}, encountered: [] };
  const week = new Date(2026, 9, 14, 12);

  it('each cache adds one Akashic Tome until the account has 2 that week; the third adds none', () => {
    expect(FREEPLAY_REWARDS.cacheTome).toEqual({ item: TOME, perCache: 1, weeklyCap: 2 });
    const p = createProfile();
    // 15 + 25 = one cache
    const a = applyCoopFreeplayEnd(p, fp({ wavesCleared: 40 }), createRng(1), { banked, now: week });
    expect(a.freeplay).toMatchObject({ caches: 1, tomes: 1 });
    expect(a.rewards).toContainEqual({ id: TOME, count: 1 });
    expect(p.missions.counters[FP_TOME_PREFIX + weekKey(week)]).toBe(1);
    const b = applyCoopFreeplayEnd(p, fp({ wavesCleared: 40 }), createRng(2), { banked, now: week });
    expect(b.freeplay.tomes).toBe(1);
    const c = applyCoopFreeplayEnd(p, fp({ wavesCleared: 40 }), createRng(3), { banked, now: week });
    expect(c.freeplay).toMatchObject({ caches: 1, tomes: 0 });
    expect(c.rewards.some((r) => r.id === TOME)).toBe(false);
    expect(p.missions.counters[FP_TOME_PREFIX + weekKey(week)]).toBe(2);
  });

  it('a long run pays at most the week\'s 2, however many caches it opens', () => {
    const p = createProfile();
    const out = applyCoopFreeplayEnd(p, fp({ wavesCleared: 15 + 200 }), createRng(4), { banked, now: week });
    expect(out.freeplay).toMatchObject({ caches: 8, tomes: 2 });
    expect(out.rewards.filter((r) => r.id === TOME).reduce((n, r) => n + r.count, 0)).toBeLessThanOrEqual(2 + 8); // cache rolls of a book stage aside
  });

  it('the freeplay results line names the cache Tome and the week, or why none came', () => {
    const p = createProfile();
    const a = applyCoopFreeplayEnd(p, fp({ wavesCleared: 40 }), createRng(1), { banked, now: week });
    expect(freeplayTomeLine(p, a.freeplay, week)).toBe('+1 Akashic Tome (1 of 2 this week)');
    const b = applySoloFreeplayEnd(p, fp({ wavesCleared: 15 + 75 }), createRng(2), { banked, now: week });
    expect(b.freeplay).toMatchObject({ caches: 3, tomes: 1 });
    expect(freeplayTomeLine(p, b.freeplay, week)).toBe('+1 Akashic Tome (2 of 2 this week)');
    const c = applyCoopFreeplayEnd(p, fp({ wavesCleared: 40 }), createRng(3), { banked, now: week });
    expect(freeplayTomeLine(p, c.freeplay, week)).toBe('Akashic Tomes: weekly limit reached (2 a week, back next week)');
    // two Tomes in one run; no cache: no line
    const q = createProfile();
    const d = applyCoopFreeplayEnd(q, fp({ wavesCleared: 15 + 50 }), createRng(4), { banked, now: week });
    expect(freeplayTomeLine(q, d.freeplay, week)).toBe('+2 Akashic Tomes (2 of 2 this week)');
    expect(freeplayTomeLine(q, applyCoopFreeplayEnd(q, fp({ wavesCleared: 30 }), createRng(5), { banked, now: week }).freeplay, week)).toBe(null);
  });

  it('solo and co-op share the counter', () => {
    const p = createProfile();
    expect(applySoloFreeplayEnd(p, fp({ wavesCleared: 40 }), createRng(5), { banked, now: week }).freeplay.tomes).toBe(1);
    expect(applyCoopFreeplayEnd(p, fp({ wavesCleared: 40 }), createRng(6), { banked, now: week }).freeplay.tomes).toBe(1);
    expect(applySoloFreeplayEnd(p, fp({ wavesCleared: 40 }), createRng(7), { banked, now: week }).freeplay.tomes).toBe(0);
  });

  it("a new week starts again at 0 and its key deletes older 'fpTome:' keys; the counter survives a reload", () => {
    const p = createProfile();
    freeplayCacheTomes(p, 5, week);
    const old = FP_TOME_PREFIX + weekKey(week);
    expect(p.missions.counters[old]).toBe(2);
    // an older build keeps missions.counters word for word
    const loaded = migrateProfile(JSON.parse(JSON.stringify(p)));
    expect(loaded.missions.counters[old]).toBe(2);
    expect(freeplayCacheTomes(loaded, 1, week)).toBe(0);
    const next = new Date(2026, 9, 21, 12);
    expect(freeplayCacheTomes(loaded, 1, next)).toBe(1);
    expect(loaded.missions.counters[old]).toBeUndefined();
    expect(loaded.missions.counters[FP_TOME_PREFIX + weekKey(next)]).toBe(1);
    // no cache: nothing counted, nothing deleted
    expect(freeplayCacheTomes(loaded, 0, new Date(2026, 10, 30))).toBe(0);
    expect(loaded.missions.counters[FP_TOME_PREFIX + weekKey(next)]).toBe(1);
  });

  it('the Tome comes after the cache rolls: every other reward is what it was', () => {
    const roll = (p) => applyCoopFreeplayEnd(p, fp({ stageId: '4-5', goal: 26, wavesCleared: 26 + 77, difficulty: 'hard' }), createRng(9), { banked: { goal: 26, kills: {}, encountered: [] }, now: week });
    const fresh = roll(createProfile());
    const capped = createProfile();
    capped.missions.counters[FP_TOME_PREFIX + weekKey(week)] = 2;
    const none = roll(capped);
    expect(none.freeplay.tomes).toBe(0);
    const withoutTome = (out) => out.rewards.map((r) => (r.id === TOME ? { ...r, count: r.count - out.freeplay.tomes } : r)).filter((r) => r.count > 0);
    expect(withoutTome(fresh)).toEqual(withoutTome(none));
  });
});

describe('duplicates past P6 (spares, no Tomes)', () => {
  /** Grant her, five duplicates (Essence), then Raise Potential to P6 with them. */
  const toP6 = (p, id) => {
    if (!p.units[id]) grantUnit(p, id);
    for (let i = 0; i < 5; i++) expect(grantUnit(p, id)).toMatchObject({ essence: 1, spare: null });
    for (let i = 0; i < 5; i++) expect(raisePotential(p, id).ok).toBe(true);
    expect(potentialLevel(p.units[id])).toBe(6);
    expect(essenceBalance(p, id)).toBe(0);
  };

  it('pay no Akashic Tomes and no Star Fragments: SR 6 Mementos + 1 Moonpearl + 1 point, SSR 10 Moonpearls + 5 points, R 2 Mementos + ⅕ point', () => {
    expect(SPARE_PAY).toEqual({ R: { memento: 2, moonpearl: 0, fifths: 1 }, SR: { memento: 6, moonpearl: 1, fifths: 5 }, SSR: { memento: 0, moonpearl: 10, fifths: 25 } });
    const p = createProfile();
    p.currencies.coins = 10_000_000;
    for (const id of ['kage', 'kaede', 'momo', 'aoi']) toP6(p, id);
    // below P6 every duplicate was her Essence: no Tome, no fragment, no spare
    expect(itemCount(p, TOME)).toBe(0);
    const frag = itemCount(p, 'star_fragment');
    const points = p.gacha.recruitPoints;
    const sr = grantUnit(p, 'kage');
    expect(sr).toEqual({ isNew: false, essence: 0, spare: { mementos: 6, moonpearls: 1, points: 1, fifths: 5 }, potential: 6, essenceHeld: 0, readyStep: null, potentialUp: false });
    expect(grantUnit(p, 'kaede')).toMatchObject({ essence: 0, spare: { mementos: 0, moonpearls: 10, points: 5 } });
    expect(grantUnit(p, 'momo')).toMatchObject({ essence: 0, spare: { mementos: 2, moonpearls: 0, points: 0, fifths: 1 } });
    expect(grantUnit(p, 'aoi')).toMatchObject({ essence: 0, spare: { mementos: 2, moonpearls: 0, points: 0, fifths: 1 } });
    expect(itemCount(p, TOME)).toBe(0);
    expect(itemCount(p, 'star_fragment')).toBe(frag);
    expect(itemCount(p, 'memento')).toBe(6 + 2 + 2);
    expect(itemCount(p, 'moonpearl')).toBe(1 + 10);
    expect(p.gacha.recruitPoints).toBe(points + 1 + 5);
    expect(p.missions.counters['spk:r']).toBe(2);
    // heroes by their rarity (Luna SSR, Nami SR)
    expect(SPARE_PAY[UNIT_MAP.luna.rarity].moonpearl).toBe(10);
    expect(SPARE_PAY[UNIT_MAP.nami.rarity].memento).toBe(6);
  });

  it('recruits, sparks and the Mall spark convert them the same way', () => {
    const p = createProfile();
    p.currencies.gems = 100000;
    p.currencies.coins = 10_000_000;
    const ssr = ['luna', 'hotaru', 'kaede', 'chika'].find((id) => !p.units[id]); // a standard SSR (on the Standard banner)
    toP6(p, ssr);
    const fixed = rngOn(ssr);
    const before = p.gacha.recruitPoints;
    const r = pull(p, 1, fixed);
    expect(r.results[0]).toMatchObject({ unitId: ssr, isNew: false, potential: 6 });
    // the recruit's own point + the spare's 5
    expect(p.gacha.recruitPoints).toBe(before + 1 + 5);
    expect(itemCount(p, 'moonpearl')).toBe(10);
    p.gacha.recruitPoints = 200;
    expect(spark(p, ssr)).toMatchObject({ ok: true, isNew: false, essence: 0, spare: { moonpearls: 10, points: 5 }, potential: 6 });
    expect(p.gacha.recruitPoints).toBe(5); // a spark on a P6 SSR returns 5 of its 200 points
    p.gacha.recruitPoints = 200;
    const mall = buyOffer(p, `spark_${ssr}`);
    expect(mall).toMatchObject({ ok: true, unit: { unitId: ssr, isNew: false, essence: 0, spare: { moonpearls: 10, points: 5 }, potential: 6 } });
    // the Mall's rewards list shows the spare's payout, never Tomes or fragments
    expect(mall.rewards).toEqual([{ id: 'moonpearl', count: 10 }]);
    expect(itemCount(p, 'moonpearl')).toBe(30);
    expect(itemCount(p, TOME)).toBe(0);
    expect(p.missions.counters[`essX:${ssr}`]).toBe(3);
  });
});

describe('where to find Akashic Tomes', () => {
  it('item info lists its sources: the stage, the Bounty Exchange, freeplay caches and the titans; no longer duplicates', () => {
    const src = itemSources(TOME);
    const labels = src.map((s) => s.label);
    expect(labels.some((l) => /Library Courtyard III/.test(l))).toBe(true);
    expect(labels.some((l) => /Bounty Exchange/.test(l))).toBe(true);
    expect(labels).toContain('Freeplay caches');
    expect(labels).toContain('Titan Trials');
    expect(labels.some((l) => /duplicate/i.test(l))).toBe(false);
    expect(LEVEL_PAST_GATES.book).toBe(TOME);
  });
});
