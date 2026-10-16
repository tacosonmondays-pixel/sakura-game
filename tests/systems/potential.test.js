import { describe, it, expect, vi } from 'vitest';
import {
  potentialLevel, backfillDupes, restoreFromShadow, poissonQuantile, shadowPotential,
  POOL_SIZE_V0125, RARITY_SHARE, MAX_POTENTIAL, BACKFILL_MARKER, SHADOW_AT,
} from '../../src/systems/potential.js';
import { grantUnit } from '../../src/systems/unlocks.js';
import { pull, spark, redeemSelectTicket, SSR_SELECT_TICKET, POOL } from '../../src/systems/gacha.js';
import { buyOffer } from '../../src/systems/shop.js';
import { createProfile, migrateProfile, serializeProfile, deserializeProfile, loadSaveText, migrationDropsData, newUnitState, SAVE_VERSION } from '../../src/systems/save.js';
import { createRng } from '../../src/core/rng.js';
import { UNIT_MAP } from '../../src/data/units.js';

/** rng stub: always the same roll, always the pool entry named by `id` (or the first). */
const rngFor = (value, id) => ({ next: () => value, pick: (arr) => (arr.includes(id) ? id : arr[0]), int: (a) => a, range: (a) => a, chance: () => false });
const R_ROLL = 0.99; // ≥ SSR + SR rates → R
const SSR_ROLL = 0;

/** What a build from before M0 writes: its cleanUnit allowlist has no `dupes`. */
function asOldBuildSave(profile) {
  const raw = JSON.parse(JSON.stringify(profile));
  for (const u of Object.values(raw.units)) delete u.dupes;
  return raw;
}

/** A save from before M0 entirely: no `dupes`, no shadow. */
function asPreM0Save(profile) {
  const raw = asOldBuildSave(profile);
  for (const k of Object.keys(raw.missions.counters)) if (k.startsWith('pot:')) delete raw.missions.counters[k];
  return raw;
}

describe('potentialLevel', () => {
  it('is 1 + dupes, capped at 6, and 1 for anything odd', () => {
    expect(MAX_POTENTIAL).toBe(6);
    expect(potentialLevel(undefined)).toBe(1);
    expect(potentialLevel({})).toBe(1);
    expect(potentialLevel({ dupes: null })).toBe(1);
    expect(potentialLevel({ dupes: NaN })).toBe(1);
    expect(potentialLevel({ dupes: -3 })).toBe(1);
    expect(potentialLevel({ dupes: 0 })).toBe(1);
    expect(potentialLevel({ dupes: 2.9 })).toBe(3);
    expect(potentialLevel({ dupes: 5 })).toBe(6);
    expect(potentialLevel({ dupes: 99 })).toBe(6);
  });
});

describe('grantUnit counts duplicates', () => {
  it('new girl: dupes 0, P1, shadow written', () => {
    const p = createProfile();
    expect(grantUnit(p, 'kaede', 5000)).toEqual({ isNew: true, fragments: 0, potential: 1, potentialUp: false });
    expect(p.units.kaede.dupes).toBe(0);
    expect(p.missions.counters['pot:kaede']).toBe(0);
    expect(p.missions.counters[SHADOW_AT]).toBe(5000);
  });

  it('dupes 1…5 → P2…P6 with the same fragments as before; 6+ → fragments only, dupes keeps counting', () => {
    const p = createProfile();
    grantUnit(p, 'kaede');
    for (let n = 1; n <= 5; n++) {
      const r = grantUnit(p, 'kaede', 1000 + n);
      expect(r).toEqual({ isNew: false, fragments: 40, potential: n + 1, potentialUp: true });
      expect(p.units.kaede.dupes).toBe(n);
      expect(p.missions.counters['pot:kaede']).toBe(n);
      expect(p.missions.counters[SHADOW_AT]).toBe(1000 + n);
    }
    expect(grantUnit(p, 'kaede')).toEqual({ isNew: false, fragments: 40, potential: 6, potentialUp: false });
    expect(p.units.kaede.dupes).toBe(6);
    expect(p.items.star_fragment).toBe(40 * 6);
  });

  it('fragments per rarity are unchanged (R 2, SR 10, SSR 40)', () => {
    const p = createProfile();
    expect(grantUnit(p, 'aoi').fragments).toBe(2);
    grantUnit(p, 'kage');
    expect(grantUnit(p, 'kage').fragments).toBe(10);
    expect(grantUnit(p, 'hikari').fragments).toBe(40);
    expect(p.units.aoi.dupes).toBe(1);
    expect(p.units.kage.dupes).toBe(1);
    expect(p.units.hikari.dupes).toBe(1);
  });
});

describe('every duplicate source counts', () => {
  it('a 10-pull of an owned girl adds 10', () => {
    const p = createProfile();
    p.items.ticket_recruit10 = 1;
    const r = pull(p, 10, rngFor(R_ROLL, 'aoi'));
    expect(r.ok).toBe(true);
    // the guarantee turns the 10th into an SR (the first SR in the pool), the other nine are Aoi
    expect(p.units.aoi.dupes).toBe(9);
    const sr = POOL.SR[0];
    expect(p.units[sr].dupes).toBe(0);
    expect(p.missions.counters['pot:aoi']).toBe(9);
    expect(p.items.star_fragment).toBe(9 * 2);
  });

  it('a single pull of an owned girl adds 1', () => {
    const p = createProfile();
    p.items.ticket_recruit = 1;
    expect(pull(p, 1, rngFor(R_ROLL, 'rei')).ok).toBe(true);
    expect(p.units.rei.dupes).toBe(1);
    expect(p.missions.counters['pot:rei']).toBe(1);
  });

  it('two copies of a new girl in one 10-pull: the first joins, the second is a duplicate', () => {
    const p = createProfile();
    p.items.ticket_recruit10 = 1;
    pull(p, 10, rngFor(SSR_ROLL, 'kaede'));
    expect(p.units.kaede.dupes).toBe(9);
  });

  it('a spark of an owned SSR adds 1; of a new one, 0', () => {
    const p = createProfile();
    p.gacha.recruitPoints = 400;
    expect(spark(p, 'kaede')).toMatchObject({ ok: true, isNew: true, potential: 1, potentialUp: false });
    expect(spark(p, 'kaede')).toMatchObject({ ok: true, isNew: false, fragments: 40, potential: 2, potentialUp: true });
    expect(p.units.kaede.dupes).toBe(1);
    // grant and history share one timestamp
    expect(p.gacha.history.at(-1).at).toBe(p.missions.counters[SHADOW_AT]);
  });

  it('an SSR Select Ticket on an owned SSR adds 1', () => {
    const p = createProfile();
    p.items[SSR_SELECT_TICKET] = 2;
    expect(redeemSelectTicket(p, 'hikari')).toMatchObject({ ok: true, isNew: false, fragments: 40, potential: 2, potentialUp: true });
    expect(p.units.hikari.dupes).toBe(1);
    expect(redeemSelectTicket(p, 'luna')).toMatchObject({ ok: true, isNew: true });
    expect(p.units.luna.dupes).toBe(0);
    expect(p.gacha.history.at(-1).at).toBe(p.missions.counters[SHADOW_AT]);
  });

  it('the Mall Recruit Exchange (spark offer) on an owned SSR adds 1', () => {
    const p = createProfile();
    p.gacha.recruitPoints = 200;
    const r = buyOffer(p, 'spark_hikari');
    expect(r).toMatchObject({ ok: true, unit: { unitId: 'hikari', isNew: false, fragments: 40 } });
    expect(p.units.hikari.dupes).toBe(1);
  });

  it('a stage clear never produces a duplicate (free girls only join once)', () => {
    const p = createProfile();
    grantUnit(p, 'yuki');
    expect(p.units.yuki.dupes).toBe(0);
  });
});

describe('save: new field, round trip, old saves', () => {
  it('newUnitState and createProfile carry dupes 0 and the starters\' shadow', () => {
    expect(newUnitState().dupes).toBe(0);
    const p = createProfile();
    for (const id of ['hikari', 'aoi', 'rei']) {
      expect(p.units[id].dupes).toBe(0);
      expect(p.missions.counters[`pot:${id}`]).toBe(0);
    }
    expect(typeof p.missions.counters[SHADOW_AT]).toBe('number');
    expect(p.version).toBe(SAVE_VERSION);
  });

  it('a recruit of an owned girl survives export/import and a reload', () => {
    const p = createProfile();
    p.items.ticket_recruit = 1;
    pull(p, 1, rngFor(R_ROLL, 'aoi'));
    expect(p.units.aoi.dupes).toBe(1);
    expect(deserializeProfile(serializeProfile(p)).units.aoi.dupes).toBe(1);
    const reloaded = loadSaveText(JSON.stringify(p));
    expect(reloaded.backup).toBe(null);
    expect(reloaded.profile.units.aoi.dupes).toBe(1);
    // and keeps counting after the reload
    const q = reloaded.profile;
    q.items.ticket_recruit = 1;
    pull(q, 1, rngFor(R_ROLL, 'aoi'));
    expect(loadSaveText(JSON.stringify(q)).profile.units.aoi.dupes).toBe(2);
  });

  it('migrate keeps dupes, is idempotent, and does not mark a save that had them', () => {
    const p = createProfile();
    grantUnit(p, 'aoi');
    grantUnit(p, 'aoi');
    const once = migrateProfile(JSON.parse(JSON.stringify(p)));
    const twice = migrateProfile(JSON.parse(JSON.stringify(once)));
    expect(once.units.aoi.dupes).toBe(2);
    expect(twice.units.aoi.dupes).toBe(2);
    expect(twice.seenIntro).not.toContain(BACKFILL_MARKER);
  });

  it('loading the same save later gives the same profile (pot:at only moves when a count changes)', () => {
    const p = createProfile();
    grantUnit(p, 'aoi');
    const a = migrateProfile(JSON.parse(JSON.stringify(p)));
    const spy = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000);
    try {
      expect(migrateProfile(JSON.parse(JSON.stringify(a)))).toEqual(a);
    } finally {
      spy.mockRestore();
    }
  });

  it('clamps garbage dupes', () => {
    const raw = asPreM0Save(createProfile());
    raw.units.aoi.dupes = -4;
    raw.units.rei.dupes = 'x';
    raw.units.hikari.dupes = 3.7;
    const p = migrateProfile(raw);
    expect(p.units.aoi.dupes).toBe(0);
    expect(p.units.rei.dupes).toBe(0);
    expect(p.units.hikari.dupes).toBe(3);
  });

  it('a v0.1.25 save (no dupes) is backfilled once, marked, and shadowed', () => {
    const p = createProfile();
    p.items.ticket_recruit = 3;
    pull(p, 1, rngFor(R_ROLL, 'aoi'));
    pull(p, 1, rngFor(R_ROLL, 'aoi'));
    pull(p, 1, rngFor(R_ROLL, 'momo'));
    const raw = asPreM0Save(p);
    expect(migrationDropsData(raw)).toBe(false);
    const m = migrateProfile(raw);
    expect(m.units.aoi.dupes).toBe(2);
    expect(m.units.momo.dupes).toBe(0);
    expect(m.units.rei.dupes).toBe(0);
    expect(m.seenIntro).toContain(BACKFILL_MARKER);
    expect(m.missions.counters['pot:aoi']).toBe(2);
    expect(m.missions.counters['pot:momo']).toBe(0);
    expect(migrateProfile(JSON.parse(JSON.stringify(m))).seenIntro.filter((s) => s === BACKFILL_MARKER)).toHaveLength(1);
  });

  it('a save without gacha state backfills everyone to 0', () => {
    const raw = asPreM0Save(createProfile());
    delete raw.gacha;
    const m = migrateProfile(raw);
    for (const u of Object.values(m.units)) expect(u.dupes).toBe(0);
  });
});

describe('stale tab: an older build that drops dupes cannot lower the count', () => {
  it('restores from the shadow plus the history after pot:at', () => {
    // 1. the M0 build: Aoi has 3 duplicates
    const p = createProfile();
    p.items.ticket_recruit = 3;
    for (let i = 0; i < 3; i++) pull(p, 1, rngFor(R_ROLL, 'aoi'));
    const saved = migrateProfile(JSON.parse(JSON.stringify(p)));
    expect(saved.units.aoi.dupes).toBe(3);
    const at = saved.missions.counters[SHADOW_AT];
    // 2. an out-of-date tab saves over it: dupes gone, counters kept, 3 more recruits of Aoi,
    //    one new girl (Momo) and a duplicate of her
    const stale = asOldBuildSave(saved);
    stale.gacha.totalPulls += 5;
    stale.units.momo = { ...stale.units.aoi, obtainedAt: at + 20, level: 1 };
    stale.gacha.history.push(
      { unitId: 'aoi', rarity: 'R', at: at + 10 },
      { unitId: 'aoi', rarity: 'R', at: at + 10 },
      { unitId: 'momo', rarity: 'R', at: at + 20 },
      { unitId: 'aoi', rarity: 'R', at: at + 30 },
      { unitId: 'momo', rarity: 'R', at: at + 40 },
    );
    // 3. the next load on the M0 build
    const back = migrateProfile(stale);
    expect(back.units.aoi.dupes).toBe(6); // old 3 + 3, never lower
    expect(back.units.momo.dupes).toBe(1); // her first copy is not a duplicate
    expect(back.units.rei.dupes).toBe(0);
    expect(back.missions.counters['pot:aoi']).toBe(6);
    // 4. and it stays put on later loads
    expect(migrateProfile(JSON.parse(JSON.stringify(back))).units.aoi.dupes).toBe(6);
  });

  it('an import of an old-client export with a lower dupes keeps the shadow', () => {
    expect(restoreFromShadow({ aoi: { dupes: 1, obtainedAt: 0 } }, { 'pot:aoi': 4, 'pot:at': 10 }, [])).toEqual({ aoi: 4 });
    expect(restoreFromShadow({ aoi: { dupes: 5, obtainedAt: 0 } }, { 'pot:aoi': 4, 'pot:at': 10 }, [])).toEqual({});
  });

  it('a girl with no shadow is left to the backfill', () => {
    expect(restoreFromShadow({ kage: { dupes: null, obtainedAt: 0 } }, { 'pot:at': 10 }, [])).toEqual({});
  });

  it('shadowPotential creates missions/counters when missing', () => {
    const p = { units: { aoi: { dupes: 2 } } };
    shadowPotential(p, 'aoi', 7);
    expect(p.missions.counters).toEqual({ 'pot:aoi': 2, 'pot:at': 7 });
  });
});

describe('backfillDupes', () => {
  const C = 1_000_000_000; // createdAt
  const OLD = C + 1_000_000; // oldest kept history entry
  const NOW = C + 5_000_000;
  /** 100 history entries of filler girls from OLD on, plus `extra` (sorted by time). */
  function gachaWith(totalPulls, extra = []) {
    const filler = Array.from({ length: 100 - extra.length }, (_, i) => ({ unitId: 'sango', rarity: 'SR', at: OLD + i }));
    return { totalPulls, history: [...filler, ...extra].sort((a, b) => a.at - b.at) };
  }

  it('pins the v0.1.25 pool sizes and shares', () => {
    expect(POOL_SIZE_V0125).toEqual({ R: 4, SR: 10, SSR: 5 });
    expect(RARITY_SHARE).toEqual({ R: 0.785, SR: 0.194, SSR: 0.0203 });
    expect(Object.isFrozen(POOL_SIZE_V0125)).toBe(true);
  });

  it('per rarity: R and SR at average luck, SSR cautious (1,000 recruits fell out)', () => {
    const units = {
      aoi: { dupes: null, obtainedAt: C }, // R starter
      kage: { dupes: null, obtainedAt: C }, // SR
      kaede: { dupes: null, obtainedAt: C }, // SSR
      momo: { dupes: null, obtainedAt: C + 500_000 }, // R, joined halfway: f = 0.5
      hikari: { dupes: 4, obtainedAt: C }, // already counted: untouched
    };
    const out = backfillDupes(units, gachaWith(1100), { createdAt: C, now: NOW });
    expect(out.aoi).toBe(Math.floor((1000 * 0.785) / 4)); // 196
    expect(out.kage).toBe(Math.floor((1000 * 0.194) / 10)); // 19
    expect(out.kaede).toBe(3); // λ = 4.06; Poisson 25th percentile (average luck would say 4)
    expect(out.kaede).toBe(poissonQuantile((1000 * 0.0203) / 5, 0.25));
    expect(out.momo).toBe(Math.floor((1000 * 0.785) / 4 * 0.5)); // 98
    expect(out).not.toHaveProperty('hikari');
  });

  it('adds her kept-history duplicates to the estimate', () => {
    const extra = [{ unitId: 'aoi', rarity: 'R', at: OLD + 50 }, { unitId: 'kaede', rarity: 'SSR', at: OLD + 60 }];
    const out = backfillDupes({ aoi: { dupes: null, obtainedAt: C }, kaede: { dupes: null, obtainedAt: C } }, gachaWith(200, extra), { createdAt: C, now: NOW });
    expect(out.aoi).toBe(1 + Math.floor((100 * 0.785) / 4)); // 1 + 19
    expect(out.kaede).toBe(1 + poissonQuantile((100 * 0.0203) / 5)); // λ 0.406 → 0
    expect(out.kaede).toBe(1);
  });

  it('first copy rules: gacha-first girl, spark skew, starter, free girl recruited later', () => {
    const t = OLD + 10;
    const history = [
      { unitId: 'momo', rarity: 'R', at: t }, // Momo joins
      { unitId: 'momo', rarity: 'R', at: t }, // same 10-pull: a duplicate
      { unitId: 'luna', rarity: 'SSR', at: t + 1001 }, // spark, 1 ms after her obtainedAt
      { unitId: 'aoi', rarity: 'R', at: t }, // starter: every entry is a duplicate
      { unitId: 'yuki', rarity: 'R', at: t + 3_600_000 }, // free girl (stage clear), recruited an hour later
    ];
    const units = {
      momo: { dupes: null, obtainedAt: t },
      luna: { dupes: null, obtainedAt: t + 1000 },
      aoi: { dupes: null, obtainedAt: C },
      yuki: { dupes: null, obtainedAt: t + 5 },
    };
    expect(backfillDupes(units, { totalPulls: history.length, history }, { createdAt: C, now: NOW })).toEqual({ momo: 1, luna: 0, aoi: 1, yuki: 1 });
  });

  it('entries before she joined do not count', () => {
    const history = [{ unitId: 'kage', rarity: 'SR', at: OLD }];
    expect(backfillDupes({ kage: { dupes: null, obtainedAt: OLD + 10 } }, { totalPulls: 1, history }, { createdAt: C, now: NOW })).toEqual({ kage: 0 });
  });

  it('obtainedAt missing (set to now by migrate) → 0', () => {
    expect(backfillDupes({ kage: { dupes: null, obtainedAt: NOW } }, gachaWith(1100), { createdAt: C, now: NOW })).toEqual({ kage: 0 });
  });

  it('empty history but totalPulls > 0: the estimate runs up to now', () => {
    const out = backfillDupes({ aoi: { dupes: null, obtainedAt: C } }, { totalPulls: 400, history: [] }, { createdAt: C, now: NOW });
    expect(out.aoi).toBe(Math.floor((400 * 0.785) / 4));
  });

  it('createdAt missing (now) → history only', () => {
    expect(backfillDupes({ aoi: { dupes: null, obtainedAt: C } }, gachaWith(1100), { now: NOW })).toEqual({ aoi: 0 });
  });

  it('no gacha → 0 for everyone', () => {
    expect(backfillDupes({ aoi: { dupes: null, obtainedAt: C } }, undefined, { createdAt: C, now: NOW })).toEqual({ aoi: 0 });
  });

  it('poissonQuantile', () => {
    expect(poissonQuantile(0)).toBe(0);
    expect(poissonQuantile(-1)).toBe(0);
    expect(poissonQuantile(0.2)).toBe(0); // P(0) = 0.82
    expect(poissonQuantile(4.06)).toBe(3);
    expect(poissonQuantile(100)).toBeGreaterThan(90);
    expect(poissonQuantile(100)).toBeLessThan(100);
  });

  it('property: ≤ 100 real recruits → the backfill equals the truth; > 100 with the estimate off → never above it', () => {
    for (let seed = 0; seed < 200; seed++) {
      const p = createProfile();
      const rng = createRng(`pot-${seed}`);
      const tens = 1 + (seed % 10); // 10…100 recruits
      p.items.ticket_recruit10 = tens;
      for (let i = 0; i < tens; i++) pull(p, 10, rng);
      const truth = Object.fromEntries(Object.entries(p.units).map(([id, u]) => [id, u.dupes]));
      const m = migrateProfile(asPreM0Save(p));
      for (const [id, n] of Object.entries(truth)) expect(m.units[id].dupes, `${seed} ${id}`).toBe(n);
    }
    for (let seed = 0; seed < 20; seed++) {
      const p = createProfile();
      const rng = createRng(`pot-big-${seed}`);
      p.items.ticket_recruit10 = 25;
      for (let i = 0; i < 25; i++) pull(p, 10, rng);
      const raw = asPreM0Save(p);
      const units = Object.fromEntries(Object.entries(raw.units).map(([id, u]) => [id, { ...u, dupes: null }]));
      const out = backfillDupes(units, { totalPulls: raw.gacha.history.length, history: raw.gacha.history }, { createdAt: raw.createdAt });
      for (const [id, n] of Object.entries(out)) expect(n, `${seed} ${id}`).toBeLessThanOrEqual(p.units[id].dupes);
    }
  });

  it('every owned rarity has a pinned pool size', () => {
    for (const id of Object.keys(UNIT_MAP)) expect(POOL_SIZE_V0125[UNIT_MAP[id].rarity]).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// M1: battle stats, Power, pull() fields and the describer
// ---------------------------------------------------------------------------
import { unitBattleStats, unitPower } from '../../src/systems/progression.js';
import { describePotentialStep, potentialView, potentialSummary, potentialPowerFactor, dupesToNext, dupesToMax, potentialSteps } from '../../src/systems/potential.js';
import { UNITS as ALL_UNITS } from '../../src/data/units.js';

describe('M1: unitBattleStats().potential and unitPower', () => {
  it('carries P (unowned → 1, capped at 6)', () => {
    const p = createProfile();
    expect(unitBattleStats(p, 'aoi').potential).toBe(1);
    expect(unitBattleStats(p, 'kaede').potential).toBe(1);
    p.units.aoi.dupes = 3;
    expect(unitBattleStats(p, 'aoi').potential).toBe(4);
    p.units.aoi.dupes = 40;
    expect(unitBattleStats(p, 'aoi').potential).toBe(6);
    expect(unitBattleStats(null, 'aoi').potential).toBe(1);
  });

  it('Power grows with every step for every girl (supports and economy included)', () => {
    for (const u of ALL_UNITS) {
      const p = createProfile();
      p.units[u.id] ||= newUnitState(0);
      let prev = unitPower(p, u.id);
      for (let d = 1; d <= 5; d++) {
        p.units[u.id].dupes = d;
        const cur = unitPower(p, u.id);
        expect(cur, `${u.id} P${d + 1}`).toBeGreaterThan(prev);
        prev = cur;
      }
    }
  });

  it('P1 Power is unchanged by Potential', () => {
    const p = createProfile();
    p.units.aoi.dupes = 0;
    const s = unitBattleStats(p, 'aoi');
    expect(s.potential).toBe(1);
    expect(potentialPowerFactor(UNIT_MAP.aoi, 1)).toBe(1);
  });
});

describe('M1: pull() result fields', () => {
  it('a 10-pull of an owned R girl reports P and ▲ per result, fragments unchanged', () => {
    const p = createProfile();
    p.items.ticket_recruit10 = 1;
    const r = pull(p, 10, rngFor(R_ROLL, 'aoi'));
    expect(r.ok).toBe(true);
    // nine Aoi, then the ten-pull guarantee's SR (a new girl)
    const aoi = r.results.slice(0, 9);
    expect(aoi.map((x) => x.potential)).toEqual([2, 3, 4, 5, 6, 6, 6, 6, 6]);
    expect(aoi.map((x) => x.potentialUp)).toEqual([true, true, true, true, true, false, false, false, false]);
    expect(aoi.every((x) => x.fragments === 2)).toBe(true);
    expect(r.results[9]).toMatchObject({ isNew: true, potential: 1, potentialUp: false });
  });
  it('a new girl is P1 without ▲', () => {
    const p = createProfile();
    p.items.gems = 100000;
    const r = pull(p, 1, rngFor(SSR_ROLL, 'kaede'));
    expect(r.results[0]).toMatchObject({ unitId: 'kaede', isNew: true, potential: 1, potentialUp: false, fragments: 0 });
  });
});

describe('M1: the describer', () => {
  it('short labels are ≤ 9 characters and every step has text', () => {
    for (const u of ALL_UNITS) {
      for (const s of potentialSteps(u)) {
        const parts = describePotentialStep(s, u);
        expect(parts.length, `${u.id} P${s.step}`).toBeGreaterThan(0);
        for (const x of parts) {
          expect(x.short.length, x.short).toBeLessThanOrEqual(9);
          expect(x.long.length).toBeGreaterThan(4);
        }
      }
    }
  });
  it('labels as in the spec table', () => {
    const lbl = (id, step) => describePotentialStep(potentialSteps(UNIT_MAP[id])[step - 2], UNIT_MAP[id]);
    expect(lbl('aoi', 2)[0]).toEqual({ short: '+2% DMG', long: '+2% damage', who: 'self' });
    expect(lbl('aoi', 6)[0].long).toBe('+3% crit chance');
    expect(lbl('momo', 3)[0].short).toBe('+2% COIN');
    expect(lbl('miko', 4)[0]).toEqual({ short: '+1% AURA', long: 'aura +1% damage', who: 'allies' });
    expect(lbl('umeko', 6)[0].long).toBe('aura +1% attack speed');
    expect(lbl('hotaru', 6)[0]).toEqual({ short: '+0.1s SIL', long: 'silence +0.1 s', who: 'enemies' });
    expect(lbl('kaede', 6)[0].short).toBe('+5% FOCUS');
    expect(lbl('suzu', 4)[0].long).toBe('+3% damage (traps)');
    expect(lbl('chika', 2)[0].long).toBe('+3% range (drones too)');
    expect(lbl('luna', 6)[0].long).toBe('+5% damage to elites');
    expect(lbl('nami', 6)[0].long).toBe('+5% damage to bosses');
  });
  it('view: six nodes, active up to P, next one marked; unowned shows none active', () => {
    const v = potentialView(UNIT_MAP.aoi, { dupes: 2 });
    expect(v.map((n) => n.step)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(v.map((n) => n.active)).toEqual([true, true, true, false, false, false]);
    expect(v.map((n) => n.next)).toEqual([false, false, false, true, false, false]);
    expect(v[5].name).toBe("Fletcher's Focus");
    expect(potentialView(UNIT_MAP.aoi, null).some((n) => n.active)).toBe(false);
    expect(potentialSummary(UNIT_MAP.aoi, 4)).toBe('+2% damage, +2% attack speed, +3% range');
    expect(potentialSummary(UNIT_MAP.aoi, 1)).toBe('');
    expect(dupesToNext({ dupes: 2 })).toBe(1);
    expect(dupesToNext({ dupes: 9 })).toBe(0);
    expect(dupesToMax({ dupes: 2 })).toBe(3);
  });
});
