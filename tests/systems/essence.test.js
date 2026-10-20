// Essence (docs/specs/ASCENSION.md §A): duplicates give Essence, Essence + coins raise Potential, the
// hold cap and spares, Kindred Essence, the switch-over migration and stale-tab safety (S1).
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import { grantUnit } from '../../src/systems/unlocks.js';
import { addItems, itemCount } from '../../src/systems/inventory.js';
import { potentialLevel } from '../../src/systems/potential.js';
import { levelCap } from '../../src/systems/progression.js';
import {
  essenceBalance, essenceCap, raisePotential, canRaisePotential, POTENTIAL_STEP_COINS, releaseKindred, kindredUseful,
  fuseShards, migrateEssence, settleSpares, addChosenEssence, spareFifths, MIGRATION_MARK,
} from '../../src/systems/essence.js';

const rich = () => {
  const p = createProfile();
  p.currencies.coins = 10_000_000;
  return p;
};

describe('a duplicate gives Essence', () => {
  it('gives 1 Essence and nothing else; Potential is bought with a button', () => {
    const p = rich();
    grantUnit(p, 'kage');
    const r = grantUnit(p, 'kage');
    expect(r).toMatchObject({ isNew: false, essence: 1, spare: null, potential: 1, essenceHeld: 1, readyStep: 2 });
    expect(r.fragments).toBeUndefined();
    expect(itemCount(p, 'star_fragment')).toBe(0);
    expect(potentialLevel(p.units.kage)).toBe(1); // never automatic
    const up = raisePotential(p, 'kage');
    expect(up).toMatchObject({ ok: true, from: 1, to: 2, coins: POTENTIAL_STEP_COINS.SR[0], use: 'own' });
    expect(potentialLevel(p.units.kage)).toBe(2);
    expect(essenceBalance(p, 'kage')).toBe(0);
    expect(p.missions.counters['pl:kage']).toBe(2);
  });

  it('charges the §A.2 coins per rarity: R 37k, SR 95k, SSR 240k for P1 → P6', () => {
    const total = (r) => POTENTIAL_STEP_COINS[r].reduce((a, b) => a + b, 0);
    expect([total('R'), total('SR'), total('SSR')]).toEqual([37000, 95000, 240000]);
    const p = rich();
    for (let i = 0; i < 6; i++) grantUnit(p, 'kaede');
    const before = p.currencies.coins;
    for (let i = 0; i < 5; i++) expect(raisePotential(p, 'kaede').ok).toBe(true);
    expect(before - p.currencies.coins).toBe(240000);
    expect(raisePotential(p, 'kaede')).toMatchObject({ ok: false, error: 'max' });
  });

  it('refuses without Essence or coins, and never raises on its own', () => {
    const p = createProfile();
    expect(raisePotential(p, 'aoi')).toMatchObject({ ok: false, error: 'noEssence' });
    grantUnit(p, 'aoi');
    p.currencies.coins = 100;
    expect(raisePotential(p, 'aoi')).toMatchObject({ ok: false, error: 'coins' });
    expect(potentialLevel(p.units.aoi)).toBe(1);
  });
});

describe('hold cap and spares (§A.3)', () => {
  it('holds at most 6 − P; the copy past it is a spare with its rarity payout', () => {
    const p = rich();
    grantUnit(p, 'kage');
    for (let i = 0; i < 5; i++) expect(grantUnit(p, 'kage').essence).toBe(1);
    expect(essenceBalance(p, 'kage')).toBe(essenceCap(p.units.kage));
    const pts = p.gacha.recruitPoints;
    const r = grantUnit(p, 'kage');
    expect(r).toMatchObject({ essence: 0, spare: { mementos: 6, moonpearls: 1, points: 1 } });
    expect(p.gacha.recruitPoints).toBe(pts + 1);
    expect(itemCount(p, 'memento')).toBe(6);
    // raising uses one Essence and lowers the cap by one: a full girl stays full
    raisePotential(p, 'kage');
    expect(essenceBalance(p, 'kage')).toBe(essenceCap(p.units.kage));
    expect(grantUnit(p, 'kage').essence).toBe(0);
  });

  it('R spares give ⅕ point: the 5th one pays the point', () => {
    const p = rich();
    for (let i = 0; i < 6; i++) grantUnit(p, 'momo');
    const pts = p.gacha.recruitPoints;
    const pays = [];
    for (let i = 0; i < 5; i++) pays.push(grantUnit(p, 'momo').spare);
    expect(pays.map((s) => s.points)).toEqual([0, 0, 0, 0, 1]);
    expect(pays.every((s) => s.mementos === 2 && s.fifths === 1)).toBe(true);
    expect(p.gacha.recruitPoints).toBe(pts + 1);
    expect(spareFifths(p)).toBe(0);
  });

  it('an SSR spare pays 10 Moonpearls and 5 points', () => {
    const p = rich();
    for (let i = 0; i < 6; i++) grantUnit(p, 'kaede');
    expect(grantUnit(p, 'kaede').spare).toMatchObject({ mementos: 0, moonpearls: 10, points: 5 });
  });
});

describe('Kindred Essence (§A.4)', () => {
  it('stands in only for a girl with none of her own, of its rarity or lower', () => {
    const p = rich();
    addItems(p, [{ id: 'kindred_r', count: 1 }, { id: 'kindred_sr', count: 1 }]);
    grantUnit(p, 'kage'); // SR girl, no Essence of her own
    expect(canRaisePotential(p, 'kage', 'kindred_r')).toMatchObject({ ok: false, reason: 'kindred' });
    expect(raisePotential(p, 'kage', 'kindred_sr')).toMatchObject({ ok: true, to: 2, use: 'kindred_sr' });
    expect(p.missions.counters['essU:kage']).toBe(1);
    expect(itemCount(p, 'kindred_sr')).toBe(0);
    // her own Essence comes first: Kindred is refused while she has one
    grantUnit(p, 'kage');
    expect(canRaisePotential(p, 'kage', 'kindred_r')).toMatchObject({ ok: false, reason: 'kindred' });
    expect(essenceBalance(p, 'kage')).toBe(1);
  });

  it('a Kindred nobody can use is released for a spare, without recruit points', () => {
    const p = rich();
    addItems(p, [{ id: 'kindred_r', count: 1 }]);
    expect(releaseKindred(p, 'kindred_r')).toMatchObject({ ok: false, error: 'useful' });
    for (const id of Object.keys(p.units)) p.units[id].pl = 6;
    for (const id of ['aoi']) expect(potentialLevel(p.units[id])).toBe(6);
    expect(kindredUseful(p, 'kindred_r')).toBe(false);
    const pts = p.gacha.recruitPoints;
    expect(releaseKindred(p, 'kindred_r')).toMatchObject({ ok: true, pay: { mementos: 2, points: 0 } });
    expect(p.gacha.recruitPoints).toBe(pts);
  });

  it('10 shards fuse into a whole (Kindred SSR and the Rainbow Crown)', () => {
    const p = createProfile();
    addItems(p, [{ id: 'kindred_shard_ssr', count: 23 }, { id: 'crown_rainbow_shard', count: 10 }]);
    expect(fuseShards(p)).toEqual([{ id: 'kindred_ssr', count: 2 }, { id: 'crown_rainbow', count: 1 }]);
    expect([itemCount(p, 'kindred_shard_ssr'), itemCount(p, 'kindred_ssr'), itemCount(p, 'crown_rainbow_shard'), itemCount(p, 'crown_rainbow')]).toEqual([3, 2, 0, 1]);
  });

  it('a Chosen Essence adds to her own balance, refused at her cap', () => {
    const p = rich();
    grantUnit(p, 'kaede');
    for (let i = 0; i < 5; i++) expect(addChosenEssence(p, 'kaede')).toBe(true);
    expect(addChosenEssence(p, 'kaede')).toBe(false);
    expect(essenceBalance(p, 'kaede')).toBe(5);
  });
});

describe('the switch to Essence (§A.7) and older builds (S1)', () => {
  /** A save written by Potential v3 (automatic P = 1 + dupes, no Essence marks). */
  function v3Save(build) {
    const p = createProfile();
    build(p);
    const raw = JSON.parse(JSON.stringify(p));
    delete raw.missions.counters[MIGRATION_MARK];
    for (const u of Object.values(raw.units)) delete u.pl;
    for (const k of Object.keys(raw.missions.counters)) if (k.startsWith('pl:')) delete raw.missions.counters[k];
    return raw;
  }

  it('counted duplicates become Potential for free; past P6 they size the welcome pouch', () => {
    const raw = v3Save((p) => {
      grantUnit(p, 'kage');
      p.units.kage.dupes = 3;
      grantUnit(p, 'momo');
      p.units.momo.dupes = 25;
    });
    const m = migrateProfile(raw);
    expect(potentialLevel(m.units.kage)).toBe(4);
    expect(potentialLevel(m.units.momo)).toBe(6);
    expect(essenceBalance(m, 'kage')).toBe(0);
    expect(essenceBalance(m, 'momo')).toBe(0);
    expect(m.missions.counters['essX:momo']).toBe(20);
    // 20 R spares = 40 Mementos → the floor 60; Moonpearls floor 15
    expect(itemCount(m, 'memento')).toBe(60);
    expect(itemCount(m, 'moonpearl')).toBe(15);
    expect(m.mail.letters.some((l) => (l.rewards || []).some((r) => r.id === 'memento'))).toBe(false);
    // idempotent: loading again pays nothing more
    const again = migrateProfile(JSON.parse(JSON.stringify(m)));
    expect(itemCount(again, 'memento')).toBe(60);
    expect(potentialLevel(again.units.kage)).toBe(4);
  });

  it('caps the pouch at 300 Mementos + 60 Moonpearls', () => {
    const raw = v3Save((p) => {
      for (const id of ['kage', 'momo', 'suzu', 'chika', 'midori']) {
        grantUnit(p, id);
        p.units[id].dupes = 200;
      }
    });
    const m = migrateProfile(raw);
    expect(itemCount(m, 'memento')).toBe(300);
    expect(itemCount(m, 'moonpearl')).toBe(60);
  });

  it('no level ever drops: an L72 P4 girl at gate 5 keeps L72 (gates 6–8 counted as broken)', () => {
    const raw = v3Save((p) => {
      Object.assign(p.units.aoi, { level: 72, breakthrough: 5, dupes: 3 });
      p.missions.counters['lv:aoi'] = 72;
    });
    const m = migrateProfile(raw);
    expect(m.units.aoi).toMatchObject({ level: 72, breakthrough: 8, pl: 4 });
    expect(levelCap(m.units.aoi)).toBe(72);
  });

  it('a level an older build clamped to 60 comes back through the migration (the lv: shadow)', () => {
    const raw = v3Save((p) => {
      Object.assign(p.units.aoi, { level: 60, breakthrough: 5, dupes: 5 });
      p.missions.counters['lv:aoi'] = 85;
    });
    const m = migrateProfile(raw);
    expect(m.units.aoi).toMatchObject({ level: 85, breakthrough: 10, pl: 6 });
  });

  it('a stale-tab duplicate past her cap pays nothing at load (only essX rises)', () => {
    const p = rich();
    grantUnit(p, 'kage');
    for (let i = 0; i < 5; i++) grantUnit(p, 'kage');
    expect(essenceBalance(p, 'kage')).toBe(5);
    // an older build adds a duplicate (and paid it its own way)
    p.units.kage.dupes += 1;
    const mem = itemCount(p, 'memento');
    const pts = p.gacha.recruitPoints;
    expect(settleSpares(p)).toEqual(['kage']);
    expect(essenceBalance(p, 'kage')).toBe(5);
    expect(itemCount(p, 'memento')).toBe(mem);
    expect(p.gacha.recruitPoints).toBe(pts);
  });

  it('bought Potential survives an older build that drops pl (the pl: mirror)', () => {
    const p = rich();
    grantUnit(p, 'kage');
    grantUnit(p, 'kage');
    raisePotential(p, 'kage');
    const raw = JSON.parse(JSON.stringify(p));
    delete raw.units.kage.pl;
    const m = migrateProfile(raw);
    expect(potentialLevel(m.units.kage)).toBe(2);
    expect(essenceBalance(m, 'kage')).toBe(0);
  });

  it('migrateEssence runs once per save', () => {
    const p = createProfile();
    expect(migrateEssence(p)).toEqual({ ran: false });
  });
});
