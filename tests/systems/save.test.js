import { describe, it, expect } from 'vitest';
import {
  createProfile, migrateProfile, serializeProfile, deserializeProfile, loadSaveText, migrationDropsData, backupNotice, SAVE_VERSION, STARTER_UNITS,
} from '../../src/systems/save.js';
import { addGear, equipGear, rollGear } from '../../src/systems/gear.js';
import { createRng } from '../../src/core/rng.js';

describe('createProfile', () => {
  it('starts with the starters, formation, gems and a 10x ticket', () => {
    const p = createProfile();
    expect(p.version).toBe(SAVE_VERSION);
    expect(Object.keys(p.units).sort()).toEqual([...STARTER_UNITS].sort());
    expect(p.units.hikari).toMatchObject({ level: 1, exp: 0, breakthrough: 0, awaken: 0, gear: { charm: null, ribbon: null, shoes: null } });
    expect(p.formation).toEqual({ hero: 'hikari', towers: ['aoi', 'rei'] });
    expect(p.currencies.gems).toBe(2400);
    expect(p.currencies.coins).toBeGreaterThan(0);
    expect(p.items.ticket_recruit10).toBe(1);
    expect(p.items.book_common).toBeGreaterThan(0);
    expect(p.gacha).toEqual({ pity: 0, totalPulls: 0, recruitPoints: 0, history: [] });
    expect(p.secretary).toBe('hikari');
    expect(p.settings.quality).toBe('high');
    expect(p.missions.login).toEqual({ lastDay: null, streak: 0, claimedDays: [] });
  });

  it('returns independent objects', () => {
    const a = createProfile();
    const b = createProfile();
    a.settings.lighting.exposure = 2;
    a.units.aoi.level = 9;
    expect(b.settings.lighting.exposure).toBe(1);
    expect(b.units.aoi.level).toBe(1);
  });
});

describe('migrateProfile', () => {
  it('never throws on garbage and returns a valid profile', () => {
    for (const raw of [null, undefined, 42, 'x', [], {}, { version: 'nope' }, { units: 5 }, { version: 2, units: { aoi: 'bad' }, gacha: 7 }]) {
      const p = migrateProfile(raw);
      expect(p.version).toBe(SAVE_VERSION);
      expect(p.units.hikari).toBeTruthy();
      expect(p.formation.hero).toBe('hikari');
    }
  });

  it('turns a pre-release stub save into a fresh profile', () => {
    const p = migrateProfile({ version: 1, currencies: { coins: 0, gems: 0 }, items: {}, units: {}, gear: {}, settings: {} });
    expect(p.currencies.gems).toBe(2400);
  });

  it('keeps valid data and repairs partial data', () => {
    const base = createProfile();
    base.units.yuki = { level: 999, exp: -5, breakthrough: 9, awaken: 2 };
    base.units.notAUnit = { level: 3 };
    base.items = { book_rare: 3, bogus_item: 4, mat_feather_rare: -2, coins: 5 };
    base.currencies = { coins: 'NaN', gems: 500 };
    base.formation = { hero: 'luna', towers: ['aoi', 'aoi', 'yuki', 'kaede', 'hikari'] };
    base.gacha = { pity: 200, totalPulls: 5, recruitPoints: 5, history: [{ unitId: 'aoi', rarity: 'SSR', at: 1 }, { unitId: 'nope' }] };
    delete base.settings;
    delete base.missions;
    const p = migrateProfile(base);
    expect(p.units.yuki).toMatchObject({ level: 60, exp: 0, breakthrough: 5, awaken: 2 });
    expect(p.units.notAUnit).toBeUndefined();
    expect(p.items).toEqual({ book_rare: 3 });
    expect(p.currencies).toEqual({ coins: 0, gems: 500 });
    expect(p.formation).toEqual({ hero: 'hikari', towers: ['aoi', 'yuki'] }); // luna/kaede not owned, hikari is a hero
    expect(p.gacha.pity).toBe(89);
    expect(p.gacha.history).toEqual([{ unitId: 'aoi', rarity: 'R', at: 1 }]);
    expect(p.settings.lighting).toEqual({ exposure: 1, warmth: 0 });
    expect(p.missions.daily).toEqual({});
  });

  it('level is clamped to the breakthrough cap', () => {
    const base = createProfile();
    base.units.aoi.level = 35;
    base.units.aoi.breakthrough = 1;
    expect(migrateProfile(base).units.aoi.level).toBe(20);
  });

  it('repairs gear ownership references', () => {
    const p = createProfile();
    const rng = createRng(1);
    const a = addGear(p, rollGear(rng, { slot: 'charm', rarity: 'rare' }));
    const b = addGear(p, rollGear(rng, { slot: 'ribbon', rarity: 'rare' }));
    equipGear(p, 'aoi', a);
    p.units.rei.gear.charm = a; // conflicting claim
    p.units.rei.gear.shoes = 'missing';
    p.gear[b].equippedBy = 'hikari'; // hikari does not reference it
    const m = migrateProfile(JSON.parse(JSON.stringify(p)));
    expect(m.units.aoi.gear.charm).toBe(a);
    expect(m.gear[a].equippedBy).toBe('aoi');
    expect(m.units.rei.gear.charm).toBeNull();
    expect(m.units.rei.gear.shoes).toBeNull();
    expect(m.gear[b].equippedBy).toBeNull();
    expect(m.seq.gear).toBeGreaterThanOrEqual(2);
  });

  it('is idempotent', () => {
    const p = createProfile();
    const once = migrateProfile(JSON.parse(JSON.stringify(p)));
    const twice = migrateProfile(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });
});

describe('serialize / deserialize', () => {
  it('roundtrips a profile including unicode', () => {
    const p = createProfile();
    p.units.aoi.level = 7;
    p.redeemed.push('WELCOME');
    p.seenIntro.push('桜 sakura ✿');
    const text = serializeProfile(p);
    expect(text).toMatch(/^[A-Za-z0-9+/=]+$/);
    const back = deserializeProfile(text);
    expect(back).toEqual(migrateProfile(JSON.parse(JSON.stringify(p))));
    expect(back.seenIntro).toContain('桜 sakura ✿');
  });

  it('tolerates whitespace / line breaks from copy-paste', () => {
    const p = createProfile();
    const text = serializeProfile(p);
    const wrapped = text.replace(/(.{60})/g, '$1\n');
    expect(deserializeProfile(`  ${wrapped}  `).currencies.gems).toBe(2400);
  });

  it('throws Invalid save on garbage', () => {
    const bad = ['', '   ', 'hello world', '!!!!', btoa('not json'), btoa('{"a":1}'), btoa('[1,2]'), btoa('null'), null, 42];
    for (const b of bad) expect(() => deserializeProfile(b)).toThrow('Invalid save');
  });

  it('refuses a save code from a newer build instead of stripping it', () => {
    const p = createProfile();
    p.version = SAVE_VERSION + 1;
    expect(() => deserializeProfile(serializeProfile(p))).toThrow('Newer save');
  });
});

describe('loadSaveText (what store.load keeps a backup of)', () => {
  it('nothing stored or a clean save: no backup', () => {
    expect(loadSaveText(null)).toMatchObject({ backup: null, version: null });
    expect(loadSaveText('').profile.units.hikari).toBeTruthy();
    const p = createProfile();
    p.units.yuki = { level: 4 };
    p.items.mat_rime_common = 3;
    addGear(p, rollGear(createRng(2), { slot: 'shoes', rarity: 'superRare' }));
    const r = loadSaveText(JSON.stringify(p));
    expect(r.backup).toBeNull();
    expect(r.version).toBe(SAVE_VERSION);
    expect(r.profile.units.yuki.level).toBe(4);
    expect(migrationDropsData(p)).toBe(false);
  });

  it('unreadable text loads fresh and asks for a backup', () => {
    for (const text of ['{"version":2,"units":', 'not json', '42', 'null', '[1,2]']) {
      const r = loadSaveText(text);
      expect(r.backup, text).toBe('corrupt');
      expect(r.profile.currencies.gems).toBe(2400);
    }
  });

  it('a save from a newer build is never migrated: fresh profile + backup', () => {
    const p = createProfile();
    p.version = SAVE_VERSION + 1;
    p.units.futureGirl = { level: 50 };
    p.currencies.gems = 77;
    const r = loadSaveText(JSON.stringify(p));
    expect(r.backup).toBe('newer');
    expect(r.version).toBe(SAVE_VERSION + 1);
    expect(r.profile.currencies.gems).toBe(2400);
    expect(r.profile.units.futureGirl).toBeUndefined();
  });

  it('a lossy migration (unknown units, items or gear) keeps a backup', () => {
    const withUnit = createProfile();
    withUnit.units.futureGirl = { level: 3 };
    const r = loadSaveText(JSON.stringify(withUnit));
    expect(r.backup).toBe('lossy');
    expect(r.profile.units.futureGirl).toBeUndefined();
    expect(r.profile.units.hikari).toBeTruthy();

    const withItem = createProfile();
    withItem.items.mat_star_mythic = 2;
    expect(loadSaveText(JSON.stringify(withItem)).backup).toBe('lossy');
    withItem.items.mat_star_mythic = 0; // nothing of it to lose
    expect(loadSaveText(JSON.stringify(withItem)).backup).toBeNull();

    const withGear = createProfile();
    withGear.gear.g9 = { uid: 'g9', slot: 'gloves', rarity: 'rare', main: { stat: 'atkPct', value: 3 } };
    expect(loadSaveText(JSON.stringify(withGear)).backup).toBe('lossy');

    expect(loadSaveText(JSON.stringify({ version: 1, currencies: { coins: 5, gems: 9 } })).backup).toBe('lossy'); // stub save
    expect(loadSaveText('{}').backup).toBeNull();
  });

  it('notices say whether the backup was kept', () => {
    for (const reason of ['corrupt', 'newer', 'lossy']) {
      expect(backupNotice(reason)).toMatch(/kept as a backup/);
      expect(backupNotice(reason, false)).toMatch(/no backup could be made/);
    }
  });
});
