// Banners (docs/specs/BANNERS.md §A, §B, §I.4): classes, rotation, pools, ppm weights, shared pity, the Legend
// Promise, spark windows and the grace, the Standard pick and welcome 10×, 'rotated' before payment.
import { describe, it, expect } from 'vitest';
import * as B from '../../src/systems/banners.js';
import { pull, spark, redeemSelectTicket, SSR_SELECT_TICKET } from '../../src/systems/gacha.js';
import { buyOffer, shopTabs } from '../../src/systems/shop.js';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import { createRng } from '../../src/core/rng.js';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { PINS, LISTS, STANDARD_SSR, UNIT_CLASS, PLANNED, LEGEND_PROMISE, GRACE_UNITS } from '../../src/data/banners.js';
import { gameDayStart, gameDayNumber } from '../../src/core/reset.js';
import { SHOP_OFFERS } from '../../src/data/shop.js';
import { simId } from '../../tools/simId.mjs';
import { rollFor } from '../fixtures/gachaRng.js';

const at = (key, hour = 12) => gameDayStart(key) + hour * 3600000; // inside game day `key`
const D0 = B.keyNumber(LISTS.tower[0].since);
const rich = (p) => { p.currencies.gems = 10_000_000; return p; };
const stub = (v) => ({ next: () => v, pick: (a) => a[0], int: (a) => a, range: (a) => a, chance: () => false });

describe('classes (§B)', () => {
  it('every unit has a class; the five original SSRs are standard; every R and SR is standard', () => {
    for (const u of UNITS) {
      const c = B.unitClass(u.id);
      expect(['standard', 'premium', 'legend', 'event']).toContain(c);
      if (u.rarity !== 'SSR') expect(c).toBe('standard');
    }
    for (const id of STANDARD_SSR) expect(B.unitClass(id)).toBe('standard');
    expect(B.unitClass('tenka')).toBe('legend');
    for (const id of ['kanna', 'yoriko', 'seiran', 'iroha', 'ena']) expect(B.unitClass(id)).toBe('premium');
  });
  it('class rows name real or planned units only', () => {
    for (const id of Object.keys(UNIT_CLASS)) expect(!!UNIT_MAP[id] || PLANNED.includes(id)).toBe(true);
  });
  it('the banner files never enter the co-op sim id', () => {
    const files = simId().files.join(' ');
    for (const f of ['banners.js', 'gacha.js', 'recruit.js', 'shop.js']) expect(files).not.toContain(f);
  });
});

describe('weights (§A.1)', () => {
  const days = Array.from({ length: 40 }, (_, k) => D0 - 5 + k);
  it('every live banner totals exactly 1,000,000 ppm with SSR 1.5% · SR 18.5% · R 80%', () => {
    for (const d of days) {
      for (const b of [B.legendBanner(d), B.towerBanner(d), B.heroBanner(d), B.standardBanner(d)].filter(Boolean)) {
        const w = B.bannerWeights(b);
        expect(w.reduce((a, e) => a + e.ppm, 0)).toBe(1_000_000);
        const line = (r) => w.filter((e) => e.rarity === r).reduce((a, e) => a + e.ppm, 0);
        expect([line('SSR'), line('SR'), line('R')]).toEqual([15000, 185000, 800000]);
        expect(w.every((e) => e.ppm > 0 && Number.isInteger(e.ppm))).toBe(true);
      }
    }
  });
  it('a roll of 0.9999999 still returns a unit', () => {
    const w = B.bannerWeights(B.towerBanner(D0));
    expect(B.drawWeighted(w, stub(0.9999999)).unitId).toBeTruthy();
    expect(B.drawWeighted(w, stub(0.9999999), 'SSR').rarity).toBe('SSR');
  });
  it('select 1.0%, SR rate-ups 3.0% each; LR carved out of the SSR line', () => {
    const t = B.bannerRates(B.towerBanner(D0));
    expect(t.units.find((u) => u.tag === 'select').pct).toBe(1);
    expect(t.units.filter((u) => u.tag === 'up').map((u) => u.pct)).toEqual([3, 3, 3]);
    const pin = PINS.find((p) => p.unit === 'tenka');
    const debutDay = B.pinStartDay(pin);
    const lr = B.bannerRates(B.legendBanner(debutDay));
    expect(lr.units.find((u) => u.tag === 'legend').pct).toBeCloseTo(0.7, 6);
    expect(lr.lines.SSR).toBe(1.5);
    expect(lr.legendShare).toBeCloseTo(7 / 15, 6);
    const after = B.bannerRates(B.legendBanner(debutDay + pin.days + 30));
    expect(after.banner.legend).toBeTruthy();
    expect(after.units.find((u) => u.tag === 'legend').pct).toBeCloseTo(0.5, 6);
  });
  it('seeded rolls: the select is about 2/3 of SSRs; LR about 0.5% on her everyday banner', () => {
    const rng = createRng('banner-300k');
    const tw = B.bannerWeights(B.towerBanner(D0));
    const lr = B.bannerWeights(B.legendBanner(B.pinStartDay(PINS[0]) + 40));
    let ssr = 0, sel = 0, lrHits = 0;
    const N = 300000;
    for (let i = 0; i < N; i++) {
      const e = B.drawWeighted(tw, rng);
      if (e.rarity === 'SSR') { ssr++; if (e.tag === 'select') sel++; }
      if (B.drawWeighted(lr, rng).tag === 'legend') lrHits++;
    }
    expect(sel / ssr).toBeGreaterThan(0.62);
    expect(sel / ssr).toBeLessThan(0.71);
    expect(lrHits / N).toBeGreaterThan(0.0042);
    expect(lrHits / N).toBeLessThan(0.0058);
  });
});

describe('pools (§A.2, §B)', () => {
  it('Standard never holds a premium or LR unit; Student banners hold no heroes; Hikari is never featured', () => {
    for (let d = D0 - 2; d < D0 + 40; d++) {
      const s = B.standardBanner(d);
      for (const id of [...s.pool.SSR, ...s.pool.SR, ...s.pool.R]) expect(B.unitClass(id)).toBe('standard');
      const t = B.towerBanner(d);
      for (const id of [...t.pool.SSR, ...t.pool.SR, ...t.pool.R]) expect(UNIT_MAP[id].kind).toBe('tower');
      const h = B.heroBanner(d);
      expect(UNIT_MAP[h.select].kind).toBe('hero');
      expect(h.select).not.toBe('hikari');
      for (const b of [t, h, s]) {
        for (const id of [...b.pool.SSR, ...b.pool.SR]) expect(B.unitClass(id)).not.toBe('legend');
        expect(b.pool.SSR.filter((id) => B.unitClass(id) === 'premium').length).toBeLessThanOrEqual(1);
        expect(new Set(b.srUps).size).toBe(3);
        for (const id of b.srUps) expect(b.pool.SR).toContain(id);
      }
      // the Guardian's two SR towers never repeat today's Student SRs
      expect(h.srUps.filter((id) => t.srUps.includes(id))).toEqual([]);
    }
  });
  it('banner pools are subsets of the roster', () => {
    const b = B.legendBanner(B.pinStartDay(PINS[0]));
    for (const id of [...b.pool.SSR, ...b.pool.SR, ...b.pool.R]) expect(UNIT_MAP[id]).toBeTruthy();
  });
});

describe('rotation (§A.4)', () => {
  it('changes at 7 PM Central, across the Nov 1 time change too', () => {
    const p = createProfile();
    for (const key of ['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03']) {
      const start = gameDayStart(key);
      expect(B.bannerDay(p, start - 1)).toBe(B.keyNumber(key) - 1);
      expect(B.bannerDay(p, start)).toBe(B.keyNumber(key));
    }
  });
  it('a device clock before the release day shows the release-day banner (no negative index)', () => {
    expect(B.towerBanner(D0 - 400).select).toBe(LISTS.tower[0].list[0]);
    expect(B.listAt('tower', 0).i).toBe(0);
  });
  it('gb:seen is forward-only: a clock set back shows the latest day already seen', () => {
    const p = createProfile();
    const later = at('2026-11-20');
    B.noteBannerDay(p, later);
    expect(B.bannerDay(p, at('2026-11-12'))).toBe(B.keyNumber('2026-11-20'));
    B.noteBannerDay(p, at('2026-11-12'));
    expect(p.missions.counters['gb:seen']).toBe(B.keyNumber('2026-11-20'));
    expect(B.bannerDay(p, at('2026-11-22'))).toBe(B.keyNumber('2026-11-22'));
  });
  it('pins: a debut wins its slot for its days; two pins in one slot never overlap; no LR unit on a Spotlight', () => {
    for (const pin of PINS) {
      expect(Number.isFinite(Date.parse(pin.start))).toBe(true);
      expect(['tower', 'hero', 'legend']).toContain(pin.slot);
      if (pin.slot !== 'legend') expect(B.unitClass(pin.unit)).not.toBe('legend');
      else expect(B.unitClass(pin.unit)).toBe('legend');
      // the start instant is a 7 PM Central reset: it opens a game day exactly
      expect(gameDayStart(B.numberKey(B.pinStartDay(pin)))).toBe(Date.parse(pin.start));
      for (const q of PINS) {
        if (q === pin || q.slot !== pin.slot) continue;
        const a = B.pinStartDay(pin), b = B.pinStartDay(q);
        expect(a + pin.days <= b || b + q.days <= a).toBe(true);
      }
    }
    const tenka = PINS.find((x) => x.unit === 'tenka');
    const d = B.pinStartDay(tenka);
    for (let k = 0; k < tenka.days; k++) expect(B.legendBanner(d + k)).toMatchObject({ legend: 'tenka', debut: true });
    expect(B.legendBanner(d + tenka.days).debut).toBe(false);
  });
  it('look-ahead shows the next two days, and an LR unit is never in the everyday tab before her debut', () => {
    const la = B.lookAhead('tower', D0, 2);
    expect(la.map((x) => x.select)).toEqual([B.towerBanner(D0 + 1).select, B.towerBanner(D0 + 2).select]);
    const tenka = PINS.find((x) => x.unit === 'tenka');
    expect(B.legendBanner(B.pinStartDay(tenka) - 1)).toBeNull();
  });
});

describe('pulls on banners (§A.1)', () => {
  it("a banner that rotated while the screen was open is refused with 'rotated' before payment", () => {
    const p = rich(createProfile());
    const day1 = at('2026-11-10');
    const b = B.bannerOfSlot(p, 'tower', day1);
    const gems = p.currencies.gems;
    const r = pull(p, 1, createRng(1), { bannerId: b.id, now: gameDayStart('2026-11-11') + 5 });
    expect(r).toMatchObject({ ok: false, error: 'rotated' });
    expect(p.currencies.gems).toBe(gems);
    expect(p.gacha.totalPulls).toBe(0);
    expect(pull(p, 1, createRng(1), { bannerId: b.id, now: day1 }).ok).toBe(true);
  });
  it('one pity shared by every gem banner; on an LR Banner the pity pull is the LR unit by her share', () => {
    const p = rich(createProfile());
    const now = at('2026-11-10');
    const tower = B.bannerOfSlot(p, 'tower', now);
    for (let i = 0; i < 89; i++) pull(p, 1, stub(0.99), { bannerId: tower.id, now });
    expect(p.gacha.pity).toBe(89);
    const lr = B.bannerOfSlot(p, 'legend', now);
    const r = pull(p, 1, stub(0.99), { bannerId: lr.id, now });
    expect(r.results[0]).toMatchObject({ rarity: 'SSR', pity: true });
    expect(p.gacha.pity).toBe(0);
    // the share: over many seeded pity pulls about 7/15 land on Tenka in her debut week
    const rng = createRng('lr-pity');
    const w = B.bannerWeights(lr);
    let hit = 0;
    for (let i = 0; i < 30000; i++) if (B.drawWeighted(w, rng, 'SSR').tag === 'legend') hit++;
    expect(hit / 30000).toBeGreaterThan(0.44);
    expect(hit / 30000).toBeLessThan(0.50);
  });
  it('the Legend Promise: the 300th pull on her LR Banners is her, and it resets when she arrives', () => {
    const p = rich(createProfile());
    const now = at('2026-11-10');
    const lr = B.bannerOfSlot(p, 'legend', now);
    p.missions.counters['gl:tenka'] = LEGEND_PROMISE - 1;
    p.gacha.pity = 10;
    const r = pull(p, 1, stub(0.99), { bannerId: lr.id, now });
    expect(r.results[0]).toMatchObject({ unitId: 'tenka', promise: true, isNew: true });
    expect(p.missions.counters['gl:tenka']).toBe(0);
    expect(p.gacha.pity).toBe(0);
    // pulls elsewhere never count toward her Promise
    pull(p, 10, stub(0.99), { bannerId: B.bannerOfSlot(p, 'tower', now).id, now });
    expect(p.missions.counters['gl:tenka']).toBe(0);
    pull(p, 1, stub(0.99), { bannerId: lr.id, now });
    expect(p.missions.counters['gl:tenka']).toBe(1);
  });
  it('LR pulls still earn recruit points (for other girls)', () => {
    const p = rich(createProfile());
    const now = at('2026-11-10');
    pull(p, 10, stub(0.99), { bannerId: B.bannerOfSlot(p, 'legend', now).id, now });
    expect(p.gacha.recruitPoints).toBe(10);
  });
  it('history keeps the banner, and survives a reload', () => {
    const p = rich(createProfile());
    const now = at('2026-11-10');
    const b = B.bannerOfSlot(p, 'hero', now);
    pull(p, 1, createRng(5), { bannerId: b.id, now });
    p.gacha.recruitPoints = 200;
    spark(p, 'kaede', { now });
    const back = migrateProfile(JSON.parse(JSON.stringify(p)));
    expect(back.gacha.history[0].banner).toBe(b.id);
    expect(back.gacha.history[1]).toMatchObject({ unitId: 'kaede', spark: true });
  });
});

describe('the Standard banner (§A.2)', () => {
  it('the player picks its select SSR, once a game day', () => {
    const p = createProfile();
    const now = at('2026-11-10');
    expect(B.standardPick(p)).toBe(STANDARD_SSR[0]);
    expect(B.setStandardPick(p, 'kaede', now).ok).toBe(true);
    expect(B.bannerOfSlot(p, 'standard', now).select).toBe('kaede');
    expect(B.setStandardPick(p, 'chika', now)).toMatchObject({ ok: false, error: 'today' });
    expect(B.setStandardPick(p, 'iroha', at('2026-11-12'))).toMatchObject({ ok: false, error: 'notStandard' });
    expect(B.setStandardPick(p, 'chika', at('2026-11-11')).ok).toBe(true);
    expect(B.bannerWeights(B.bannerOfSlot(p, 'standard', at('2026-11-11'))).find((e) => e.tag === 'select')).toMatchObject({ unitId: 'chika', ppm: 10000 });
  });
  it('the first Standard 10× guarantees a standard SSR she does not own, once, and resets pity', () => {
    const p = rich(createProfile());
    const now = at('2026-11-10');
    const sb = B.bannerOfSlot(p, 'standard', now);
    p.gacha.pity = 40;
    const r = pull(p, 10, stub(0.99), { bannerId: sb.id, now });
    const ssr = r.results.filter((x) => x.rarity === 'SSR');
    expect(ssr).toHaveLength(1);
    expect(ssr[0].welcome).toBe(true);
    expect(STANDARD_SSR).toContain(ssr[0].unitId);
    expect(ssr[0].isNew).toBe(true);
    expect(p.gacha.pity).toBe(0);
    const again = pull(p, 10, stub(0.99), { bannerId: sb.id, now });
    expect(again.results.filter((x) => x.rarity === 'SSR')).toHaveLength(0);
  });
  it('the welcome falls back to any standard SSR when all are owned', () => {
    const p = rich(createProfile());
    for (const id of STANDARD_SSR) p.units[id] ||= { ...p.units.hikari };
    const now = at('2026-11-10');
    const r = pull(p, 10, stub(0.99), { bannerId: B.bannerOfSlot(p, 'standard', now).id, now });
    expect(r.results.filter((x) => x.rarity === 'SSR')).toHaveLength(1);
  });
});

describe('spark, Select Ticket and Chosen Essence (§A.1)', () => {
  it('an LR unit is never sparked or Select-Ticketed, at the system level', () => {
    const p = createProfile();
    p.gacha.recruitPoints = 1000;
    expect(spark(p, 'tenka')).toMatchObject({ ok: false, error: 'legend' });
    p.items[SSR_SELECT_TICKET] = 1;
    expect(redeemSelectTicket(p, 'tenka')).toMatchObject({ ok: false });
    expect(p.items[SSR_SELECT_TICKET]).toBe(1);
    expect(SHOP_OFFERS.find((o) => o.unitId === 'tenka')).toBeUndefined();
    expect(B.chosenEssenceAllowed(p, 'tenka')).toBe(false);
    expect(B.selectTicketPool()).not.toContain('tenka');
  });
  it('a standard SSR sparks any day; a premium only on her Spotlight day (after the grace)', () => {
    const p = createProfile();
    p.gacha.recruitPoints = 10000;
    B.noteBannerDay(p, at('2026-11-10')); // grace starts
    const outside = at('2026-12-20'); // > 30 days later
    expect(spark(p, 'kaede', { now: outside }).ok).toBe(true);
    // find a day iroha is and is not on the Student Spotlight
    let on = null, off = null;
    for (let k = 0; k < 10; k++) {
      const key = B.numberKey(B.keyNumber('2026-12-20') + k);
      if (B.towerBanner(B.keyNumber(key)).select === 'iroha') on ||= key; else off ||= key;
    }
    expect(spark(p, 'iroha', { now: at(off) })).toMatchObject({ ok: false, error: 'window' });
    expect(spark(p, 'iroha', { now: at(off) }).days).toBeGreaterThan(0);
    expect(spark(p, 'iroha', { now: at(on) }).ok).toBe(true);
  });
  it('the five roster-wave SSRs stay sparkable any day for 30 game days after banners first load', () => {
    const p = createProfile();
    p.gacha.recruitPoints = 10000;
    B.noteBannerDay(p, at('2026-11-10'));
    for (const id of GRACE_UNITS) expect(B.sparkRule(p, id, at('2026-12-08')).ok).toBe(true);
    const late = at('2026-12-15');
    expect(GRACE_UNITS.some((id) => !B.sparkRule(p, id, late).ok)).toBe(true);
  });
  it('the Mall spark row of a premium girl is closed outside her window, and the purchase is refused', () => {
    const p = createProfile();
    p.gacha.recruitPoints = 1000;
    p.missions.counters['gs:g1'] = 1; // grace long over
    let day = B.keyNumber('2026-12-20');
    while (B.towerBanner(day).select === 'ena') day++;
    const now = new Date(at(B.numberKey(day)));
    const row = shopTabs(p, now).flatMap((t) => t.offers).find((o) => o.id === 'spark_ena');
    expect(row).toMatchObject({ closed: true });
    expect(buyOffer(p, 'spark_ena', 1, now)).toMatchObject({ ok: false, error: 'window' });
    expect(p.gacha.recruitPoints).toBe(1000);
  });
});

describe('saves (§I.3)', () => {
  it('the new counters survive an older build rewriting the save', () => {
    const p = rich(createProfile());
    const now = at('2026-11-10');
    pull(p, 10, stub(0.99), { bannerId: B.bannerOfSlot(p, 'legend', now).id, now });
    B.setStandardPick(p, 'chika', now);
    const back = migrateProfile(JSON.parse(JSON.stringify(p)));
    for (const k of ['gb:seen', 'gs:g1', 'gs:pick', 'gs:pickDay', 'gl:tenka']) expect(back.missions.counters[k]).toBe(p.missions.counters[k]);
    expect(B.standardPick(back)).toBe('chika');
  });
  it('rollFor (the test fixture) lands on the asked girl', () => {
    expect(B.drawWeighted(B.bannerWeights(B.standardBanner(gameDayNumber())), stub(rollFor('aoi'))).unitId).toBe('aoi');
  });
});

describe('G0 housekeeping', () => {
  it('an old save with the Beta letter shows the amended text after migrateProfile', async () => {
    const { BETA_GIFT_ID } = await import('../../src/systems/mail.js');
    const p = createProfile();
    p.mail.letters = [{ id: BETA_GIFT_ID, from: 'Sakura Academy Staff', title: 'Thank you, beta Sensei!', body: 'please accept ... an SSR Select Ticket (choose ANY SSR student you like), a big bundle', rewards: [{ id: 'gems', count: 3000 }], sentAt: 1, expiresAt: null, claimed: false }];
    p.mail.delivered = [BETA_GIFT_ID];
    const back = migrateProfile(JSON.parse(JSON.stringify(p)));
    const l = back.mail.letters.find((x) => x.id === BETA_GIFT_ID);
    expect(l.body).not.toContain('ANY SSR');
    expect(l.body).toContain('LR units arrive only through their LR Banners');
    expect(l.rewards).toEqual([{ id: 'gems', count: 3000 }]);
    expect(migrateProfile(JSON.parse(JSON.stringify(back))).mail.letters[0].body).toBe(l.body);
  });
  it('the banner counter prefixes never collide with the existing namespaces', () => {
    const mine = ['gl:', 'gs:', 'gb:', 'gc:', 'frp:', 'wb:', 'lr:', 'lbt:'];
    const existing = ['ach:', 'bt:', 'clan:', 'craft:', 'evb:', 'evm:', 'evo:', 'evp:', 'evr:', 'evs:', 'evsw:', 'evswd:', 'evt:', 'fpm:', 'fpu:', 'gear:', 'inv:', 'join:', 'lv:', 'own:', 'pfs:', 'pg:', 'pl:', 'pot:', 'sl:', 'ss:', 'tag:', 'tagt:', 'tbest:', 'essB:', 'essU:', 'essX:', 'spk:'];
    for (const a of mine) for (const b of existing) expect(a.startsWith(b) || b.startsWith(a)).toBe(false);
  });
});

describe('Coin banner (§A.1b, §A.2)', async () => {
  const { pullFixed, fpBalance } = await import('../../src/systems/gacha.js');
  const { COIN_SPARE } = await import('../../src/systems/essence.js');
  const cleared = (p) => { p.progress.stages['6-5'] = { clears: 1, easy: true, normal: false, hard: false, nightmare: false }; return p; };
  const maxed = () => {
    const p = cleared(createProfile());
    for (const u of UNITS) if (B.unitClass(u.id) === 'standard') p.units[u.id] ||= { ...p.units.hikari, dupes: 50 };
    p.currencies.coins = 1e9;
    return p;
  };
  it('opens after the first 6-5 clear', () => {
    const p = createProfile();
    p.currencies.coins = 1e9;
    expect(pullFixed(p, 'coin', 1, createRng(1))).toMatchObject({ ok: false, error: 'locked' });
    expect(B.activeBanners(p).some((b) => b.slot === 'coin')).toBe(false);
    cleared(p);
    expect(B.activeBanners(p).some((b) => b.slot === 'coin')).toBe(true);
    expect(pullFixed(p, 'coin', 1, createRng(1)).ok).toBe(true);
  });
  it('coin pulls never touch pity, recruit points, history, spk:r, Mementos or Moonpearls (spares pay coins)', () => {
    const p = maxed();
    p.gacha.pity = 33;
    const before = JSON.stringify({ g: p.gacha, spk: p.missions.counters['spk:r'] || 0, m: p.items.memento || 0, mp: p.items.moonpearl || 0, pulls: p.stats.pulls });
    const now = at('2026-11-10');
    let coinsBack = 0;
    for (const w of ['2026-11-10', '2026-11-17', '2026-11-24', '2026-12-01', '2026-12-08']) {
      for (let k = 0; k < 2; k++) {
        const r = pullFixed(p, 'coin', 10, createRng(`${w}-${k}`), { now: at(w) });
        expect(r.ok).toBe(true);
        expect(r.results.some((x) => x.rarity !== 'R')).toBe(true);
        coinsBack += r.results.reduce((a, x) => a + (x.spare?.coins || 0), 0);
        for (const x of r.results) if (x.spare) expect(x.spare).toMatchObject({ mementos: 0, moonpearls: 0, points: 0 });
      }
    }
    expect(coinsBack).toBeGreaterThan(0);
    expect(JSON.stringify({ g: p.gacha, spk: p.missions.counters['spk:r'] || 0, m: p.items.memento || 0, mp: p.items.moonpearl || 0, pulls: p.stats.pulls })).toBe(before);
    expect(p.missions.counters['gc:t']).toBe(100);
    void now; void COIN_SPARE;
  });
  it('20 pulls a game week, forward-only', () => {
    const p = maxed();
    const now = at('2026-11-10');
    expect(pullFixed(p, 'coin', 10, createRng(1), { now }).ok).toBe(true);
    expect(pullFixed(p, 'coin', 10, createRng(2), { now }).ok).toBe(true);
    expect(pullFixed(p, 'coin', 1, createRng(3), { now })).toMatchObject({ ok: false, error: 'cap' });
    expect(B.coinPullsLeft(p, now)).toBe(0);
    // the next game week (Sunday 7 PM Central) refills it; a clock set back does not
    expect(B.coinPullsLeft(p, at('2026-11-16'))).toBe(20);
    expect(pullFixed(p, 'coin', 1, createRng(4), { now: at('2026-11-16') }).ok).toBe(true);
    expect(B.coinPullsLeft(p, now)).toBe(19);
  });
  it('Coin and Friendship tables: tiny standard-only SSR line, select 2/3 of it, SR rate-ups 2.5%', () => {
    const d = B.keyNumber('2026-11-10');
    for (const b of [B.coinBanner(d), B.friendBanner(d)]) {
      const w = B.bannerWeights(b);
      expect(w.reduce((a, e) => a + e.ppm, 0)).toBe(1_000_000);
      for (const e of w) expect(B.unitClass(e.unitId)).toBe('standard');
      expect(w.filter((e) => e.tag === 'up').map((e) => e.ppm)).toEqual([25000, 25000, 25000]);
    }
    expect(B.bannerWeights(B.coinBanner(d)).filter((e) => e.rarity === 'SSR').reduce((a, e) => a + e.ppm, 0)).toBe(2500);
    expect(B.bannerWeights(B.friendBanner(d)).filter((e) => e.rarity === 'SSR').reduce((a, e) => a + e.ppm, 0)).toBe(3000);
    expect(fpBalance(createProfile())).toBe(0);
  });
});
