import { describe, it, expect } from 'vitest';
import {
  createProfile, migrateProfile, serializeProfile, deserializeProfile, loadSaveText, migrationDropsData, backupNotice, SAVE_VERSION, STARTER_UNITS,
} from '../../src/systems/save.js';
import { SKIN_MAP } from '../../src/data/skins.js';
import { setSkin, equippedSkinId } from '../../src/systems/skins.js';
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
    expect(p.items.ticket_recruit10).toBeUndefined(); // [story] mailed at the 1-3 clear instead
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

// Achievements expansion (docs/specs/ACHIEVEMENTS.md §3.1–3.2): the §3.2 probe as a test. What this build writes must
// survive the migrateProfile an older cached tab runs (the same claim and counter cleaners since v0.1.27).
describe('achievements: old-build safety', () => {
  const written = () => {
    const p = createProfile();
    p.missions.achievements = { a_first_win: true, a_quad_40: true, a_fp_bosses_4: true };
    p.missions.counters = { coopWin: 3, 'ach:flawless': 2, 'ach:seenHR': 4, 'ach:seenTT': 2, 'gear:legendary': 1, 'gear10:mythic': '2', eventWin: 7, bad: true, obj: { x: 1 } };
    p.honors = { a_quad_40: true }; // a top-level block an older build would drop (ownership must never live in one)
    p.seenIntro = ['ach2'];
    return JSON.parse(JSON.stringify(p));
  };

  it('keeps unknown claimed ids and numeric counters, drops booleans and objects, keeps seenIntro', () => {
    const raw = written();
    const m = migrateProfile(raw);
    expect(migrationDropsData(raw)).toBe(false);
    expect(m.missions.achievements).toEqual({ a_first_win: true, a_quad_40: true, a_fp_bosses_4: true });
    expect(m.missions.counters).toMatchObject({ coopWin: 3, 'ach:flawless': 2, 'ach:seenHR': 4, 'ach:seenTT': 2, 'gear:legendary': 1, 'gear10:mythic': 2, eventWin: 7 });
    expect('bad' in m.missions.counters || 'obj' in m.missions.counters).toBe(false);
    expect('honors' in m).toBe(false);
    expect(m.seenIntro).toEqual(['ach2']);
  });

  it('falsy claims are dropped, true ones kept word for word', () => {
    const raw = written();
    raw.missions.achievements.a_chapter_1 = false;
    raw.missions.achievements.a_chapter_2 = 0;
    const m = migrateProfile(raw);
    expect(m.missions.achievements.a_chapter_1).toBeUndefined();
    expect(m.missions.achievements.a_chapter_2).toBeUndefined();
  });

  it('no new top-level key, no SAVE_VERSION bump, seenIntro "ach2" round-trips', () => {
    expect(SAVE_VERSION).toBe(2);
    // the achievements add no key; the only additive blocks are 'sensei' (the Sensei Profile, docs/specs/PROFILE.md §2)
    // and 'social' (v0.1.29's friends/messages/block list, already live), plus 'skins' (shop/event outfits owned; empty today)
    expect(Object.keys(createProfile())).toEqual(['version', 'createdAt', 'currencies', 'items', 'units', 'gear', 'gacha', 'progress', 'bestiary', 'formation', 'missions', 'shop', 'redeemed', 'settings', 'secretary', 'lobbyBg', 'bond', 'mail', 'patchGifts', 'stats', 'seenIntro', 'seq', 'battleSaves', 'story', 'sensei', 'social', 'skins']);
    const p = createProfile();
    p.seenIntro.push('ach2');
    expect(deserializeProfile(serializeProfile(p)).seenIntro).toContain('ach2');
  });
});

describe('levels above 60 (Potential v3 §4.6)', () => {
  // a girl with every gate open and `p` Potential at `level`
  const save = (level, p, exp = 0) => {
    const s = createProfile();
    Object.assign(s.units.aoi, { level, exp, breakthrough: 5, awaken: 2, dupes: p - 1 });
    return JSON.parse(JSON.stringify(migrateProfile(JSON.parse(JSON.stringify(s)))));
  };
  // what a build from before the level cap rose does to a save on load (its cleanUnit): level ≤ min(60, 10 + 10·gates)
  const olderBuildLoad = (raw) => {
    const out = JSON.parse(JSON.stringify(raw));
    for (const u of Object.values(out.units)) u.level = Math.min(u.level, Math.min(60, 10 + 10 * u.breakthrough));
    return out;
  };

  it('an L60 P1 save is unchanged, with no level shadow', () => {
    const raw = save(60, 1);
    const m = migrateProfile(JSON.parse(JSON.stringify(raw)));
    expect(m.units.aoi).toMatchObject({ level: 60, exp: 0, breakthrough: 5 });
    expect(m).toEqual(migrateProfile(JSON.parse(JSON.stringify(m))));
    expect(Object.keys(m.missions.counters).some((k) => k.startsWith('lv:'))).toBe(false);
  });

  it('an L72 P4 save round-trips and carries its shadow', () => {
    const raw = save(72, 4, 12000);
    expect(raw.units.aoi).toMatchObject({ level: 72, exp: 12000, dupes: 3 });
    expect(raw.missions.counters['lv:aoi']).toBe(72);
    const back = deserializeProfile(serializeProfile(raw));
    expect(back.units.aoi).toMatchObject({ level: 72, exp: 12000 });
    expect(migrateProfile(JSON.parse(JSON.stringify(back)))).toEqual(back);
  });

  it('the sanitizer keeps L72 while her duplicates are unknown, then migrate re-clamps to her cap', () => {
    // `dupes` dropped (an older build's allowlist) but restored from the pot: shadow → P4 → cap 72
    const raw = save(72, 4, 500);
    delete raw.units.aoi.dupes;
    expect(migrateProfile(JSON.parse(JSON.stringify(raw))).units.aoi).toMatchObject({ level: 72, exp: 500, dupes: 3 });
    // no shadow and no history: she is credited P1 → clamped to 60, EXP 0
    const bare = save(72, 4, 500);
    delete bare.units.aoi.dupes;
    delete bare.missions.counters['pot:aoi'];
    delete bare.missions.counters['lv:aoi'];
    const m = migrateProfile(JSON.parse(JSON.stringify(bare)));
    expect(m.units.aoi.dupes).toBe(0);
    expect(m.units.aoi).toMatchObject({ level: 60, exp: 0 });
    // gates still cap first: a P6 girl at gate 3 stays capped at 40
    const gated = save(40, 6);
    gated.units.aoi.breakthrough = 3;
    gated.units.aoi.level = 85;
    expect(migrateProfile(gated).units.aoi.level).toBe(40);
  });

  it("an older build's clamp to 60 is restored from 'lv:<id>'", () => {
    const raw = save(78, 5, 9000);
    const old = olderBuildLoad(raw);
    expect(old.units.aoi.level).toBe(60);
    expect(old.missions.counters['lv:aoi']).toBe(78);
    const m = migrateProfile(old);
    expect(m.units.aoi).toMatchObject({ level: 78, exp: 0 });
    const p4 = olderBuildLoad(save(70, 6, 9000));
    expect(migrateProfile(p4).units.aoi).toMatchObject({ level: 70, exp: 9000 });
  });

  it("a hostile 'lv:' shadow never lifts a girl above her levelCap", () => {
    const raw = save(60, 2);
    raw.missions.counters['lv:aoi'] = 1e9;
    raw.missions.counters['lv:rei'] = 85;
    raw.missions.counters['lv:nobody'] = 85;
    raw.missions.counters['lv:hikari'] = Number.NaN;
    const m = migrateProfile(raw);
    expect(m.units.aoi.level).toBe(63);
    expect(m.units.rei.level).toBe(1);
    expect(m.units.hikari.level).toBe(1);
    expect(m.units.nobody).toBeUndefined();
    // and a hand-edited level above the cap is clamped
    const edited = save(60, 3);
    edited.units.aoi.level = 99;
    expect(migrateProfile(edited).units.aoi).toMatchObject({ level: 67, exp: 0 });
  });
});

// ---------------------------------------------------------------------------
// Outfits (units[id].skin, profile.skins): additive v2 fields — docs/merge/ROSTER_WAVE_NOTES.md
// ---------------------------------------------------------------------------

/** A save as the build before outfits wrote it (no outfit fields). */
function v2Save() {
  const p = JSON.parse(JSON.stringify(createProfile()));
  p.version = 2;
  delete p.skins;
  for (const u of Object.values(p.units)) delete u.skin;
  p.units.yuki = { level: 12, exp: 3, breakthrough: 1, awaken: 1, gear: { charm: null, ribbon: null, shoes: null }, obtainedAt: 5, favorite: true };
  p.stats.battles = 9;
  return p;
}

describe('save outfits (additive, no version bump)', () => {
  it('stays version 2 and new profiles start with no stored outfits', () => {
    expect(SAVE_VERSION).toBe(2);
    const p = createProfile();
    expect(p.skins).toEqual([]);
    for (const u of Object.values(p.units)) expect(u.skin).toBeNull();
  });

  it('a save from before outfits loads with outfits defaulted and nothing else lost', () => {
    const raw = v2Save();
    expect(migrationDropsData(raw)).toBe(false);
    const r = loadSaveText(JSON.stringify(raw));
    expect(r.backup).toBeNull();
    expect(r.version).toBe(2);
    const p = r.profile;
    expect(p.version).toBe(2);
    expect(p.skins).toEqual([]);
    for (const [id, u] of Object.entries(p.units)) {
      expect(u.skin, id).toBeNull();
      expect(equippedSkinId(p, id)).toBe(`${id}_default`);
    }
    expect(p.units.yuki).toMatchObject({ level: 12, breakthrough: 1, awaken: 1, favorite: true });
    expect(p.stats.battles).toBe(9);
  });

  it('a save keeps an equipped Sentinel Style through save, load and save codes', () => {
    const p = createProfile();
    expect(setSkin(p, 'aoi', 'aoi_sentinel').ok).toBe(true);
    const r = loadSaveText(JSON.stringify(p));
    expect(r.backup).toBeNull();
    expect(r.profile.units.aoi.skin).toBe('aoi_sentinel');
    expect(r.profile.units.rei.skin).toBeNull();
    const back = deserializeProfile(serializeProfile(r.profile));
    expect(back.units.aoi.skin).toBe('aoi_sentinel');
    expect(back).toEqual(r.profile);
  });

  it('the default row is stored as null; another girl\'s or a withUnit id in skins is dropped quietly', () => {
    const p = createProfile();
    p.units.aoi.skin = 'aoi_default';
    p.units.rei.skin = 'aoi_sentinel'; // another girl's outfit
    p.units.hikari.skin = 42;
    p.skins = ['aoi_sentinel', 'aoi_default', 7, 'aoi_sentinel'];
    expect(migrationDropsData(p)).toBe(false); // all known ids: nothing the player owned is lost
    const m = migrateProfile(JSON.parse(JSON.stringify(p)));
    expect(m.units.aoi.skin).toBeNull();
    expect(m.units.rei.skin).toBeNull();
    expect(m.units.hikari.skin).toBeNull();
    expect(m.skins).toEqual([]); // with-unit/default outfits are never stored
  });

  it('unknown outfit ids are cleared and count as lossy (backup kept)', () => {
    const p = createProfile();
    p.units.aoi.skin = 'aoi_summer2027';
    expect(migrationDropsData(p)).toBe(true);
    const r = loadSaveText(JSON.stringify(p));
    expect(r.backup).toBe('lossy');
    expect(r.profile.units.aoi.skin).toBeNull();

    const q = createProfile();
    q.skins = ['hikari_gala'];
    expect(migrationDropsData(q)).toBe(true);
    expect(migrateProfile(q).skins).toEqual([]);
  });

  it('keeps owned shop outfits and unequips ones the player does not own', () => {
    const SHOP = { id: 'aoi_testshop', unitId: 'aoi', name: 'Test', desc: '', kind: 'shop', asset: 'sentinel-aoi', acquisition: { type: 'shop' }, order: 20 };
    SKIN_MAP[SHOP.id] = SHOP;
    try {
      const p = createProfile();
      p.units.aoi.skin = SHOP.id; // equipped but not owned
      expect(migrateProfile(JSON.parse(JSON.stringify(p))).units.aoi.skin).toBeNull();
      p.skins = [SHOP.id, SHOP.id];
      const m = migrateProfile(JSON.parse(JSON.stringify(p)));
      expect(m.skins).toEqual([SHOP.id]);
      expect(m.units.aoi.skin).toBe(SHOP.id);
    } finally {
      delete SKIN_MAP[SHOP.id];
    }
  });

  it('is idempotent with outfits', () => {
    const p = createProfile();
    setSkin(p, 'aoi', 'aoi_sentinel');
    setSkin(p, 'hikari', 'hikari_sentinel');
    const once = migrateProfile(JSON.parse(JSON.stringify(p)));
    const twice = migrateProfile(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
    expect(once.units.hikari.skin).toBe('hikari_sentinel');
  });
});
