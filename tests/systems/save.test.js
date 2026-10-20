import { describe, it, expect } from 'vitest';
import {
  createProfile, migrateProfile, serializeProfile, deserializeProfile, loadSaveText, migrationDropsData, backupNotice, SAVE_VERSION, STARTER_UNITS,
} from '../../src/systems/save.js';
import { addGear, equipGear, rollGear } from '../../src/systems/gear.js';
import { createRng } from '../../src/core/rng.js';
import { potentialState } from '../../src/systems/potential.js';
import { mirrorUnit } from '../../src/systems/ascensionSave.js';

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
    // gates 6–10 are kept (ASCENSION.md §F.1); her level still stops at her cap (60 at P1)
    expect(p.units.yuki).toMatchObject({ level: 60, exp: 0, breakthrough: 9, awaken: 2 });
    expect(p.units.notAUnit).toBeUndefined();
    // no missions block, so no 'ess:mig' marker: the one-time switch to Essence runs and pays the welcome pouch
    expect(p.items).toEqual({ book_rare: 3, memento: 60, moonpearl: 15 });
    expect(p.missions.counters['ess:mig']).toBe(1);
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
    // and 'social' (v0.1.29's friends/messages/block list, already live), and 'events' (limited events, EVENT_SPEC §3.5)
    expect(Object.keys(createProfile())).toEqual(['version', 'createdAt', 'currencies', 'items', 'units', 'gear', 'gacha', 'progress', 'bestiary', 'formation', 'missions', 'shop', 'redeemed', 'settings', 'secretary', 'lobbyBg', 'bond', 'mail', 'patchGifts', 'stats', 'seenIntro', 'seq', 'battleSaves', 'story', 'sensei', 'social', 'events']);
    const p = createProfile();
    p.seenIntro.push('ach2');
    expect(deserializeProfile(serializeProfile(p)).seenIntro).toContain('ach2');
  });
});

describe('levels above 60 (Potential v3 §4.6, gates 6–10: ASCENSION.md §B.1, §F)', () => {
  // a girl at Potential `p` with every gate her Potential allows open (4 + p) at `level`, and the
  // 'pl:' / 'bt:' mirrors Raise Potential and a gate write
  const save = (level, p, exp = 0) => {
    const s = createProfile();
    Object.assign(s.units.aoi, { level, exp, breakthrough: 4 + p, awaken: 2, ...potentialState(p) });
    mirrorUnit(s, 'aoi');
    return JSON.parse(JSON.stringify(migrateProfile(JSON.parse(JSON.stringify(s)))));
  };
  // what an older build does to a save on load (its cleanUnit allowlist): level ≤ min(60, 10 + 10·gates),
  // gates ≤ 5, `pl` dropped (missions.counters kept word for word)
  const olderBuildLoad = (raw) => {
    const out = JSON.parse(JSON.stringify(raw));
    for (const u of Object.values(out.units)) {
      u.level = Math.min(u.level, Math.min(60, 10 + 10 * u.breakthrough));
      u.breakthrough = Math.min(5, u.breakthrough);
      delete u.pl;
    }
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
    expect(raw.units.aoi).toMatchObject({ level: 72, exp: 12000, dupes: 3, pl: 4, breakthrough: 8 });
    expect(raw.missions.counters['lv:aoi']).toBe(72);
    expect(raw.missions.counters['pl:aoi']).toBe(4);
    expect(raw.missions.counters['bt:aoi']).toBe(8);
    const back = deserializeProfile(serializeProfile(raw));
    expect(back.units.aoi).toMatchObject({ level: 72, exp: 12000 });
    expect(migrateProfile(JSON.parse(JSON.stringify(back)))).toEqual(back);
  });

  it('the sanitizer keeps L72 while her Potential and gates are unknown, then migrate re-clamps to her cap', () => {
    // `pl` dropped and gates clamped to 5 (an older build's allowlist), restored from 'pl:' / 'bt:' → P4, gate 8 → cap 72
    const raw = save(72, 4, 500);
    delete raw.units.aoi.pl;
    delete raw.units.aoi.dupes;
    raw.units.aoi.breakthrough = 5;
    expect(migrateProfile(JSON.parse(JSON.stringify(raw))).units.aoi).toMatchObject({ level: 72, exp: 500, dupes: 3, pl: 4, breakthrough: 8 });
    // no mirrors: she is P1 at gate 5 → clamped to 60, EXP 0 (her duplicates stay Essence: the switch ran once already)
    const bare = save(72, 4, 500);
    delete bare.units.aoi.pl;
    bare.units.aoi.breakthrough = 5;
    delete bare.missions.counters['pl:aoi'];
    delete bare.missions.counters['bt:aoi'];
    delete bare.missions.counters['lv:aoi'];
    const m = migrateProfile(JSON.parse(JSON.stringify(bare)));
    expect(m.units.aoi.dupes).toBe(3);
    expect(m.units.aoi).toMatchObject({ level: 60, exp: 0, breakthrough: 5 });
    expect(m.units.aoi.pl || 1).toBe(1);
    // gates still cap first: a P6 girl at gate 3 stays capped at 40
    const gated = save(40, 6);
    gated.units.aoi.breakthrough = 3;
    gated.units.aoi.level = 85;
    expect(migrateProfile(gated).units.aoi.level).toBe(40);
  });

  it("an older build's clamp to 60 is restored from 'lv:<id>'", () => {
    const raw = save(78, 5, 9000);
    const old = olderBuildLoad(raw);
    expect(old.units.aoi).toMatchObject({ level: 60, breakthrough: 5 });
    expect(old.missions.counters['lv:aoi']).toBe(78);
    const m = migrateProfile(old);
    expect(m.units.aoi).toMatchObject({ level: 78, exp: 0, pl: 5, breakthrough: 9 });
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
