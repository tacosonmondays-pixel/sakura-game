// Roster safety (src/systems/rosterSave.js): a returning girl survives an older build that does not know
// her. Live v0.1.38 (and v0.1.39) keep only the 19 girls they know when they load and save: the girl
// is left out, the gear she wore is unequipped and her bond entry dropped, while missions.counters is
// kept word for word. Her 'own:' marks bring her back on the next load, and the mirrors already there
// ('pot:', 'pl:', 'bt:', 'lv:' / 'lvA:') bring back her duplicates, bought Potential, gates and level.
// `v0138Save` plays the older build the way its migrateProfile treats such a save (checked against the
// real v0.1.38 code with two stores on one storage while this was written).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UNITS } from '../../src/data/units.js';
import { EXPANSION_IDS } from '../../src/data/unitsExpansion.js';
import { NEW_GIRL_IDS } from '../../src/data/unitsNewGirls.js';
import { createProfile, migrateProfile, loadSaveText, SAVE_KEY } from '../../src/systems/save.js';
import { createStore, saveText } from '../../src/core/store.js';
import { grantUnit } from '../../src/systems/unlocks.js';
import { addItems } from '../../src/systems/inventory.js';
import { raisePotential, essenceBalance } from '../../src/systems/essence.js';
import { levelUp, breakthrough, breakthroughCost, awaken, awakenCost, levelCap, shadowLevel } from '../../src/systems/progression.js';
import { mirrorUnit } from '../../src/systems/ascensionSave.js';
import { addGear, rollGear, equipGear, unequipGear } from '../../src/systems/gear.js';
import { createRng } from '../../src/core/rng.js';
import { OWN_PREFIX, rosterMark, rosterMarkValue, writeRosterMarks } from '../../src/systems/rosterSave.js';

const NOW = Date.parse('2026-10-25T18:00:00Z');
/** The girls v0.1.38 knows: the roster before the returning girls. */
const OLD_IDS = new Set(UNITS.map((u) => u.id).filter((id) => !EXPANSION_IDS.includes(id)));
const clone = (x) => JSON.parse(JSON.stringify(x));
/** A unit without `obtainedAt` (a girl brought back joins at that load's time; only Potential's history count reads it). */
const sans = ({ obtainedAt, ...u }) => u;

/**
 * What v0.1.38 does to a save when it loads and saves it: only the girls it knows stay (each without
 * `pl` or `skin`, gates clamped to 5, level to 60), the gear a dropped girl wore is unequipped, her bond
 * entry and formation / secretary places go, and missions.counters is kept word for word.
 */
function v0138Save(p) {
  const raw = clone(p);
  for (const [id, u] of Object.entries(raw.units)) {
    if (!OLD_IDS.has(id)) {
      delete raw.units[id];
      delete raw.bond[id];
      continue;
    }
    delete u.pl;
    delete u.skin;
    u.breakthrough = Math.min(5, u.breakthrough);
    u.level = Math.min(60, u.level);
  }
  for (const g of Object.values(raw.gear)) if (g.equippedBy && !raw.units[g.equippedBy]) g.equippedBy = null;
  raw.formation.towers = raw.formation.towers.filter((id) => raw.units[id]);
  if (!raw.units[raw.formation.hero]) raw.formation.hero = 'hikari';
  if (!raw.units[raw.secretary]) raw.secretary = 'hikari';
  delete raw.skins;
  return raw;
}

/** Kanna (a returning SSR hero) with 3 duplicates, P3 bought with her own Essence, gates 7 at her cap, a charm on. */
function withKanna() {
  const p = createProfile();
  p.currencies.coins = 5e7;
  p.currencies.gems = 5000;
  grantUnit(p, 'kanna', NOW);
  p.currencies.gems -= 1200; // her recruit
  for (let i = 0; i < 3; i++) grantUnit(p, 'kanna', NOW);
  expect(raisePotential(p, 'kanna', 'own').ok).toBe(true);
  expect(raisePotential(p, 'kanna', 'own').ok).toBe(true);
  p.units.kanna.breakthrough = 7;
  p.units.kanna.level = levelCap(p.units.kanna);
  mirrorUnit(p, 'kanna');
  shadowLevel(p, 'kanna');
  const uid = addGear(p, rollGear(createRng(7), { slot: 'charm', rarity: 'epic', level: 6 }));
  expect(equipGear(p, 'kanna', uid).ok).toBe(true);
  p.formation.hero = 'kanna';
  return { p: migrateProfile(clone(p)), uid };
}

describe("roster marks ('own:')", () => {
  it('a grant, a level-up, a gate, a star and every equip write her mark; every load and every write do too', () => {
    const p = createProfile();
    expect(p.missions.counters[OWN_PREFIX + 'aoi']).toBe(1000); // a starter from the start
    grantUnit(p, 'ena', NOW);
    expect(p.missions.counters['own:ena']).toBe(1000);
    addItems(p, [{ id: 'book_rare', count: 40 }, { id: 'coins', count: 5e6 }]);
    expect(levelUp(p, 'ena', { book_rare: 2 }).ok).toBe(true);
    expect(p.missions.counters['own:ena']).toBe(rosterMarkValue(p.units.ena));
    p.units.ena.level = levelCap(p.units.ena);
    addItems(p, breakthroughCost('ena', 1));
    expect(breakthrough(p, 'ena').ok).toBe(true);
    addItems(p, awakenCost('ena', 1));
    expect(awaken(p, 'ena').ok).toBe(true);
    expect(p.missions.counters['own:ena']).toBe(p.units.ena.level * 1000 + 1 * 10 + 1);
    const uid = addGear(p, rollGear(createRng(3), { slot: 'shoes', rarity: 'rare', level: 0 }));
    equipGear(p, 'ena', uid);
    expect(p.missions.counters['own:ena:shoes']).toBe(Number(uid.slice(1)));
    equipGear(p, 'aoi', uid); // moved to Aoi: Ena's slot mark goes with it
    expect('own:ena:shoes' in p.missions.counters).toBe(false);
    expect(p.missions.counters['own:aoi:shoes']).toBe(Number(uid.slice(1)));
    unequipGear(p, 'aoi', 'shoes');
    expect('own:aoi:shoes' in p.missions.counters).toBe(false);
    // a level set without levelUp (a load's settle, a migration) is caught by the next write and the next load
    p.units.ena.level = 11;
    const text = saveText(p, 1, 'tab');
    expect(JSON.parse(text).missions.counters['own:ena']).toBe(11011);
    expect(migrateProfile(JSON.parse(text)).missions.counters['own:ena']).toBe(11011);
  });

  it('a mark reads back as level, gates, stars and worn pieces; below 1000 or for a girl not known it is nothing', () => {
    const c = { 'own:kanna': 67072, 'own:kanna:charm': 12, 'own:ena': 999, 'own:nobody': 5000 };
    expect(rosterMark(c, 'kanna')).toEqual({ level: 67, breakthrough: 7, awaken: 2, gear: { charm: 'g12', ribbon: null, shoes: null } });
    expect(rosterMark(c, 'ena')).toBeNull();
    const raw = clone(createProfile());
    Object.assign(raw.missions.counters, c);
    const m = migrateProfile(raw);
    expect(m.units.nobody).toBeUndefined();
    expect(m.units.ena).toBeUndefined();
    expect(m.units.kanna).toMatchObject({ breakthrough: 7, awaken: 2 }); // a charm 'g12' that is not in the bag stays off
    expect(m.units.kanna.gear.charm).toBeNull();
  });

  it('a hostile mark gives no more than a hostile unit entry: every field is clamped by the sanitizer', () => {
    const raw = clone(createProfile());
    raw.missions.counters['own:iroha'] = 999999;
    const m = migrateProfile(raw);
    expect(m.units.iroha.breakthrough).toBeLessThanOrEqual(10);
    expect(m.units.iroha.awaken).toBeLessThanOrEqual(5);
    expect(m.units.iroha.level).toBe(levelCap(m.units.iroha));
  });
});

describe('a returning girl survives an older build that does not know her (v0.1.38 round trip)', () => {
  it('she comes back whole: level, gates, bought Potential, duplicates, Essence, the gear she wore; nothing else moves', () => {
    const { p: want, uid } = withKanna();
    const stale = v0138Save(want);
    expect(stale.units.kanna).toBeUndefined();
    expect(stale.gear[uid].equippedBy).toBeNull();
    const back = migrateProfile(stale);
    const k = back.units.kanna;
    expect(k).toMatchObject({ level: want.units.kanna.level, breakthrough: 7, awaken: 0, pl: 3, dupes: 3, exp: 0 });
    expect(k.level).toBe(67);
    expect(essenceBalance(back, 'kanna')).toBe(essenceBalance(want, 'kanna'));
    expect(k.gear.charm).toBe(uid);
    expect(back.gear[uid].equippedBy).toBe('kanna');
    expect(back.bond.kanna).toBe(0);
    expect(back.currencies).toEqual(want.currencies); // her recruit stays paid once
    expect(back.items).toEqual(want.items);
    // what is not kept: her place as the formation's hero (the player sets it again)
    expect(back.formation.hero).toBe('hikari');
    // the next load changes nothing, and a second trip through the older build gives the same girl
    expect(migrateProfile(clone(back))).toEqual(back);
    expect(sans(migrateProfile(v0138Save(back)).units.kanna)).toEqual(sans(k));
  });

  it('gates below 6 and stars come back too (no other mirror holds them)', () => {
    const p = createProfile();
    grantUnit(p, 'iroha', NOW);
    Object.assign(p.units.iroha, { level: 40, breakthrough: 3, awaken: 2 });
    const want = migrateProfile(clone(p));
    const back = migrateProfile(v0138Save(want));
    expect(back.units.iroha).toMatchObject({ level: 40, breakthrough: 3, awaken: 2, dupes: 0 });
  });

  it('a piece the older build put on another girl stays with her', () => {
    const { p: want, uid } = withKanna();
    const stale = v0138Save(want);
    stale.units.aoi.gear.charm = uid;
    stale.gear[uid].equippedBy = 'aoi';
    const back = migrateProfile(stale);
    expect(back.units.kanna.gear.charm).toBeNull();
    expect(back.units.aoi.gear.charm).toBe(uid);
    expect(back.gear[uid].equippedBy).toBe('aoi');
    expect('own:kanna:charm' in back.missions.counters).toBe(false);
  });

  it('recruiting her again after the round trip is a duplicate (1 Essence), never a fresh level-1 girl: her bought P3 stays', () => {
    const { p: want } = withKanna();
    const back = migrateProfile(v0138Save(want));
    const g = grantUnit(back, 'kanna', NOW + 1000);
    expect(g.isNew).toBe(false);
    expect(g.essence).toBe(1);
    const re = migrateProfile(JSON.parse(saveText(back, 3, 'tab')));
    expect(re.units.kanna).toMatchObject({ level: 67, breakthrough: 7, pl: 3, dupes: 4 });
    expect(re.missions.counters['pl:kanna']).toBe(3);
    expect(re.missions.counters['pot:kanna']).toBe(4);
  });

  it('the free girls (Hana, Noa) and every returning girl come back the same way', () => {
    const p = createProfile();
    for (const id of EXPANSION_IDS) grantUnit(p, id, NOW);
    const want = migrateProfile(clone(p));
    writeRosterMarks(want);
    const back = migrateProfile(v0138Save(want));
    for (const id of EXPANSION_IDS) expect(sans(back.units[id]), id).toEqual(sans(want.units[id]));
  });
});

describe('two tabs on one save: a v0.1.38 tab left open across the deploy (store level)', () => {
  let ls;
  beforeEach(() => {
    const m = new Map();
    ls = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
    vi.stubGlobal('localStorage', ls);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('this build recruits Kanna, the old tab claims a reward and saves over it, the reload has her back and the gems spent once', () => {
    const tab = createStore({ debounceMs: 1 });
    tab.load();
    tab.profile.currencies.gems = 5000;
    grantUnit(tab.profile, 'kanna', NOW);
    tab.profile.currencies.gems -= 1200;
    expect(tab.saveNow()).toBe(true);
    // the v0.1.38 tab: refresh (loads the newer save as lossy, Kanna left out), a reward, commit + saveNow
    const stored = ls.getItem(SAVE_KEY);
    const { saveRev } = JSON.parse(stored);
    const old = v0138Save(loadSaveText(stored).profile);
    addItems(old, [{ id: 'book_rare', count: 1 }]);
    ls.setItem(SAVE_KEY, `{"saveRev":${saveRev + 1},"saveBy":"oldtab0000ab",${JSON.stringify(old).slice(1)}`);
    expect(JSON.parse(ls.getItem(SAVE_KEY)).units.kanna).toBeUndefined();
    // this tab turns stale (the old tab wrote last); its reload loads the save the old tab wrote
    expect(tab.checkStale()).toBe(true);
    const reloaded = createStore({ debounceMs: 1 });
    reloaded.load();
    expect(reloaded.profile.units.kanna).toBeTruthy();
    expect(reloaded.profile.currencies.gems).toBe(3800);
    expect(reloaded.profile.items.book_rare).toBe(tab.profile.items.book_rare + 1);
  });
});

describe('the new girls (UNIT_GAPS §5) survive a v0.1.39 tab', () => {
  it('a tab that does not know the seven drops them; their own: marks bring each back on the next load', () => {
    const NEW = NEW_GIRL_IDS;
    expect(NEW).toEqual(['azami', 'kinu', 'wakaba', 'yuzuha', 'ouka', 'chigusa', 'marumi']);
    const p = createProfile();
    p.currencies.coins = 5e7;
    for (const [i, id] of NEW.entries()) {
      grantUnit(p, id, NOW);
      p.units[id].level = 10 + i;
      p.units[id].breakthrough = 1;
    }
    const before = migrateProfile(clone(p));
    for (const id of NEW) expect(before.missions.counters[OWN_PREFIX + id]).toBe(rosterMarkValue(before.units[id]));
    // v0.1.39 keeps only the girls it knows (every girl but the seven); counters stay word for word
    const known = new Set(UNITS.map((u) => u.id).filter((id) => !NEW.includes(id)));
    const raw = clone(before);
    for (const id of Object.keys(raw.units)) if (!known.has(id)) {
      delete raw.units[id];
      delete raw.bond?.[id];
    }
    raw.formation.towers = raw.formation.towers.filter((id) => raw.units[id]);
    const back = migrateProfile(raw);
    for (const id of NEW) {
      expect(back.units[id], id).toBeTruthy();
      expect(back.units[id].level).toBe(before.units[id].level);
      expect(back.units[id].breakthrough).toBe(before.units[id].breakthrough);
    }
  });
});
