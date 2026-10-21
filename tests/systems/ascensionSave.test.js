// Ascension M0 reader (docs/specs/ASCENSION.md §F): the 16 new items, a save that keeps gates 6–10
// and bought Potential, and the mirrors that bring them back after an older build saved over them.
import { describe, it, expect } from 'vitest';
import { ITEMS, ASCENSION_ITEM_IDS, zenithId } from '../../src/data/items.js';
import { MATERIAL_FAMILIES } from '../../src/data/types.js';
import { createProfile, migrateProfile, migrationDropsData } from '../../src/systems/save.js';
import { addItems, consumeItems } from '../../src/systems/inventory.js';
import { mirrorUnit, PL_PREFIX, BT_PREFIX, INV_PREFIX } from '../../src/systems/ascensionSave.js';
import { donatableItems } from '../../src/online/donateRules.js';
import { openGearBox } from '../../src/systems/gear.js';
import { buildCard, validCard, cleanViewedCard, snapshotToMiniProfile } from '../../src/online/profileCard.js';
import { createRng } from '../../src/core/rng.js';

/** What a build from before Ascension does to a save when it loads and saves it (its cleanUnit allowlist). */
function olderBuildSave(p) {
  const raw = JSON.parse(JSON.stringify(p));
  for (const u of Object.values(raw.units)) {
    delete u.pl;
    u.breakthrough = Math.min(5, u.breakthrough);
    u.level = Math.min(60, u.level);
  }
  for (const id of ASCENSION_ITEM_IDS) delete raw.items[id];
  return raw;
}

describe('Ascension items (M0)', () => {
  it('adds the 16 ids of §F.3 with their categories', () => {
    expect(ASCENSION_ITEM_IDS).toHaveLength(16);
    for (const id of ASCENSION_ITEM_IDS) expect(ITEMS[id], id).toBeTruthy();
    for (const f of Object.keys(MATERIAL_FAMILIES)) {
      const z = ITEMS[zenithId(f)];
      expect(z).toMatchObject({ category: 'material', rarity: 'legendary', tier: 'zenith', family: f });
    }
    expect(ITEMS.crown_rainbow.category).toBe('crown');
    expect(ITEMS.kindred_shard_ssr.category).toBe('fragment');
    expect(ITEMS.gearbox_rainbow).toMatchObject({ category: 'gearbox', pickSlot: true });
    expect([ITEMS.memento.category, ITEMS.moonpearl.category]).toEqual(['token', 'token']);
    expect(ITEMS.crown_rainbow.name).toBe('Rainbow Crown');
    expect(ITEMS.mat_feather_zenith.name).toBe('Zenith Plume');
  });

  it('clans can never request Zenith (donations stop at mythic)', () => {
    expect(donatableItems().some((i) => i.tier === 'zenith')).toBe(false);
  });

  it('the plain Open refuses the Rainbow Gear Box (only its slot picker opens it)', () => {
    const p = createProfile();
    addItems(p, [{ id: 'gearbox_rainbow', count: 2 }]);
    const r = openGearBox(p, 'gearbox_rainbow', createRng(1), 2);
    expect(r).toMatchObject({ ok: false, error: 'pickSlot' });
    expect(p.items.gearbox_rainbow).toBe(2);
    expect(Object.keys(p.gear)).toHaveLength(0);
  });
});

describe('Ascension save reader (M0)', () => {
  it('keeps bought Potential, gates up to 10 and levels up to 85', () => {
    const p = createProfile();
    Object.assign(p.units.aoi, { level: 80, breakthrough: 9, pl: 5, dupes: 4 });
    const m = migrateProfile(JSON.parse(JSON.stringify(p)));
    expect(m.units.aoi).toMatchObject({ breakthrough: 9, pl: 5, dupes: 4 });
    // a hostile save cannot pass the field ranges
    Object.assign(p.units.rei, { breakthrough: 40, pl: 12 });
    const h = migrateProfile(JSON.parse(JSON.stringify(p)));
    expect(h.units.rei.breakthrough).toBe(10);
    expect(h.units.rei.pl).toBe(6);
  });

  it('mirrors the 16 items in missions.counters (a spent one mirrors 0)', () => {
    const p = createProfile();
    addItems(p, [{ id: 'memento', count: 60 }, { id: 'crown_rainbow_shard', count: 3 }]);
    expect(p.missions.counters[INV_PREFIX + 'memento']).toBe(60);
    consumeItems(p, [{ id: 'crown_rainbow_shard', count: 3 }]);
    expect(p.missions.counters[INV_PREFIX + 'crown_rainbow_shard']).toBe(0);
    addItems(p, [{ id: 'book_rare', count: 1 }]);
    expect(INV_PREFIX + 'book_rare' in p.missions.counters).toBe(false);
  });

  it('an older build that saves over the data loses nothing (S1)', () => {
    const p = createProfile();
    Object.assign(p.units.aoi, { level: 78, breakthrough: 9, pl: 5, dupes: 4 });
    mirrorUnit(p, 'aoi');
    p.missions.counters['lv:aoi'] = 78;
    addItems(p, [{ id: 'moonpearl', count: 15 }, { id: 'mat_feather_zenith', count: 2 }]);
    expect(p.missions.counters[PL_PREFIX + 'aoi']).toBe(5);
    expect(p.missions.counters[BT_PREFIX + 'aoi']).toBe(9);
    const stale = olderBuildSave(p);
    expect(stale.units.aoi.breakthrough).toBe(5);
    const back = migrateProfile(stale);
    expect(back.units.aoi).toMatchObject({ breakthrough: 9, pl: 5 });
    expect(back.items).toMatchObject({ moonpearl: 15, mat_feather_zenith: 2 });
    // and the item the player spent stays spent
    consumeItems(back, [{ id: 'moonpearl', count: 15 }]);
    const again = migrateProfile(olderBuildSave(back));
    expect(again.items.moonpearl).toBeUndefined();
  });

  it('a hostile mirror is clamped to the field range', () => {
    const p = createProfile();
    p.missions.counters[BT_PREFIX + 'aoi'] = 99;
    p.missions.counters[PL_PREFIX + 'aoi'] = 99;
    const m = migrateProfile(JSON.parse(JSON.stringify(p)));
    expect(m.units.aoi.breakthrough).toBe(10);
    expect(m.units.aoi.pl).toBe(6);
  });

  it('a save holding the new items is not flagged lossy by this build', () => {
    const p = createProfile();
    addItems(p, [{ id: 'kindred_r', count: 1 }, { id: 'gearbox_rainbow', count: 1 }]);
    expect(migrationDropsData(JSON.parse(JSON.stringify(p)))).toBe(false);
  });
});

describe('profile card with gates past 5 (M0, §F.4)', () => {
  it('sends at most 5 gates and the viewer still reads her real Potential and cap', () => {
    const p = createProfile();
    Object.assign(p.units.aoi, { level: 85, breakthrough: 10, pl: 6, dupes: 5 });
    p.sensei = { ...(p.sensei || {}), showcase: ['aoi'] };
    const card = buildCard(p);
    const entry = card.units.find((u) => u.id === 'aoi');
    expect(entry.bt).toBe(5);
    expect(validCard(card)).toBe(true);
    const viewed = cleanViewedCard(card).units.find((u) => u.id === 'aoi');
    expect(viewed).toMatchObject({ bt: 5, lv: 85 });
    const mini = snapshotToMiniProfile(viewed);
    expect(mini.units.aoi.pl).toBe(viewed.p);
  });
});
