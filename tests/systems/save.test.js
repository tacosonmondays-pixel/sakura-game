import { describe, it, expect } from 'vitest';
import {
  createProfile, migrateProfile, serializeProfile, deserializeProfile, loadSaveText, migrationDropsData, backupNotice, SAVE_VERSION, EXPORT_VERSION, STARTER_UNITS,
} from '../../src/systems/save.js';
import { SKIN_MAP } from '../../src/data/skins.js';
import { setSkin, equippedSkinId } from '../../src/systems/skins.js';
import { addGear, equipGear, rollGear, enhanceGear, awakenGear, stitchSub, openRainbowBox, RAINBOW_BOX_ID } from '../../src/systems/gear.js';
import { writeGearMarks } from '../../src/systems/gearMarks.js';
import { createRng } from '../../src/core/rng.js';
import { potentialState } from '../../src/systems/potential.js';
import { mirrorUnit } from '../../src/systems/ascensionSave.js';
import { raisePotential, essenceBalance, addChosenEssence } from '../../src/systems/essence.js';
import { gatesForLevel, POTENTIAL_LEVEL_CAPS } from '../../src/systems/progression.js';
import { addItems } from '../../src/systems/inventory.js';
import { ASCENSION_ITEM_IDS } from '../../src/data/items.js';
import { BASE_STAT_KEYS } from '../../src/data/gearStats.js';
import { SEED_ID, NEEDLE_ID, MIRRORED_ITEMS } from '../../src/data/gearAwaken.js';

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
    // (an export carries EXPORT_VERSION, apart from the stored save's SAVE_VERSION: GEAR_UPDATE.md §9.4)
    const p = { ...createProfile(), version: EXPORT_VERSION + 1 };
    expect(() => deserializeProfile(Buffer.from(JSON.stringify(p)).toString('base64'))).toThrow('Newer save');
    expect(deserializeProfile(serializeProfile(createProfile())).version).toBe(SAVE_VERSION);
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
    // and 'social' (v0.1.29's friends/messages/block list, already live), 'events' (limited events, EVENT_SPEC §3.5), plus 'skins' (shop/event outfits owned; empty today)
    expect(Object.keys(createProfile())).toEqual(['version', 'createdAt', 'currencies', 'items', 'units', 'gear', 'gacha', 'progress', 'bestiary', 'formation', 'missions', 'shop', 'redeemed', 'settings', 'secretary', 'lobbyBg', 'bond', 'mail', 'patchGifts', 'stats', 'seenIntro', 'seq', 'battleSaves', 'story', 'sensei', 'social', 'events', 'skins']);
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
    delete bare.missions.counters['lvA:aoi'];
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

  it("'lvA:' records only a settled level: a girl above her cap at the first Essence switch leaves none behind", () => {
    // a save from before Ascension (no 'ess:mig') with a P1 girl at gate 5 above her L60 cap: the switch's
    // mirrorUnit runs before settleLevels clamps her, so a mirror written there would hold L72 and a later
    // Raise Potential + gate would lift her to it on the next load, for free
    const raw = createProfile();
    delete raw.missions.counters['ess:mig'];
    Object.assign(raw.units.aoi, { level: 72, exp: 0, breakthrough: 5, dupes: 0 });
    const m = migrateProfile(JSON.parse(JSON.stringify(raw)));
    expect(m.units.aoi).toMatchObject({ level: 60, breakthrough: 5, pl: 1 });
    expect(m.missions.counters['lvA:aoi']).toBeUndefined();
    expect(m.missions.counters['lv:aoi']).toBeUndefined();
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
    raw.missions.counters['lvA:aoi'] = 1e9;
    raw.missions.counters['lvA:rei'] = 85;
    raw.missions.counters['lvA:hikari'] = -5;
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

describe('one save with UR gear and Ascension together (the merged migrateProfile chain, ASCENSION.md §F.2)', () => {
  // creditPotential → restoreGearMarks → restoreAscension → migrateEssence → settleSpares → fuseShards → settleLevels
  /** A store write + reload: the gear mirrors are written first (store.js), then the load migrates. */
  const reload = (p) => {
    writeGearMarks(p);
    return JSON.parse(JSON.stringify(migrateProfile(JSON.parse(JSON.stringify(p)))));
  };
  /** A build from before both tracks loads and saves it: unit and gear allowlists, unknown items dropped,
   *  missions.counters kept word for word. */
  const olderBuild = (raw) => {
    const q = JSON.parse(JSON.stringify(raw));
    for (const u of Object.values(q.units)) {
      delete u.pl;
      u.breakthrough = Math.min(5, u.breakthrough);
      u.level = Math.min(u.level, 60, 10 + 10 * u.breakthrough);
    }
    for (const g of Object.values(q.gear)) {
      delete g.ur;
      delete g.club;
      g.level = Math.min(10, g.level);
      g.subs = g.subs.filter((s) => BASE_STAT_KEYS.includes(s.stat)).map(({ tuned, ...s }) => s);
    }
    for (const id of [...ASCENSION_ITEM_IDS, ...MIRRORED_ITEMS]) delete q.items[id];
    return q;
  };

  /** A Potential-v3 build (v0.1.37, v0.1.38) loads and saves it. It knows `dupes` and the 'lv:' shadow but not
   *  `pl`, gates past 5, 'lvA:', UR gear or the Ascension items: its cleanUnit drops `pl` and clamps the gates to 5,
   *  and its settleLevels clamps her level to ITS cap, P = min(6, 1 + dupes), then rewrites 'lv:' to that clamped
   *  level when it is above 60 (its shadowLevel). Gear and items as the older build above. */
  const potentialV3Build = (raw) => {
    const q = olderBuild(raw);
    const c = q.missions.counters;
    for (const [id, u] of Object.entries(q.units)) {
      const src = raw.units[id];
      const bt = Math.min(5, src.breakthrough);
      const cap = bt < 5 ? 10 + 10 * bt : POTENTIAL_LEVEL_CAPS[Math.min(6, 1 + (src.dupes || 0)) - 1];
      const shadow = Math.floor(Number(c[`lv:${id}`]) || 0);
      let level = Math.min(src.level, bt < 5 ? cap : 85);
      if (shadow > level && level >= 60) level = Math.min(shadow, cap);
      Object.assign(u, { breakthrough: bt, level: Math.min(level, cap), exp: level > cap ? 0 : src.exp });
      if (u.level > 60) c[`lv:${id}`] = u.level;
    }
    return q;
  };

  function bothTracks() {
    const p = createProfile();
    p.currencies.coins = 5e7;
    addItems(p, [{ id: SEED_ID, count: 2 }, { id: NEEDLE_ID, count: 4 }, { id: RAINBOW_BOX_ID, count: 1 }, { id: 'kindred_r', count: 2 }]);
    // UR gear: an awakened club piece at +11 with a gold and a rainbow ✦ (gur: / gtn: / gcl:), worn by Aoi
    const a = addGear(p, rollGear(createRng(41), { slot: 'charm', rarity: 'legendary', level: 10, club: 'archery' }));
    expect(stitchSub(p, a, 0).ok).toBe(true);
    expect(awakenGear(p, a).ok).toBe(true);
    expect(stitchSub(p, a, 1).ok).toBe(true);
    expect(enhanceGear(p, a).ok).toBe(true);
    equipGear(p, 'aoi', a);
    // a box-born UR piece at +3 (gbx: / gbl:, `ur: 1` below +10)
    const b = openRainbowBox(p, 'ribbon', createRng(42)).gear.uid;
    for (let i = 0; i < 3; i++) expect(enhanceGear(p, b).ok).toBe(true);
    // Ascension: Aoi raised to P4, two steps with her own Essence and one with a Kindred (essU:), gate 8 at L72
    p.units.aoi.dupes = 2;
    expect(raisePotential(p, 'aoi', 'own').ok).toBe(true);
    expect(raisePotential(p, 'aoi', 'own').ok).toBe(true);
    expect(raisePotential(p, 'aoi', 'kindred_r').ok).toBe(true);
    Object.assign(p.units.aoi, { breakthrough: 8, level: 72 });
    mirrorUnit(p, 'aoi');
    return { p, a, b };
  }

  it('carries every mark of both tracks, and a second load changes nothing', () => {
    const { p, a, b } = bothTracks();
    const want = reload(p);
    const c = want.missions.counters;
    expect(want.gear[a]).toMatchObject({ ur: 1, level: 11, club: 'archery', equippedBy: 'aoi' });
    expect(want.gear[a].subs.filter((s) => s.tuned)).toHaveLength(2);
    expect(want.gear[b]).toMatchObject({ ur: 1, level: 3 });
    expect(c[`gur:${a}`]).toBe(11);
    expect(c[`gtn:${a}`]).toBeGreaterThan(0);
    expect(c[`gbx:${b}`]).toBeGreaterThan(0);
    expect(c[`gbl:${b}`]).toBe(0b111);
    expect(want.units.aoi).toMatchObject({ pl: 4, breakthrough: 8, level: 72, dupes: 2 });
    expect(c['pl:aoi']).toBe(4);
    expect(c['bt:aoi']).toBe(8);
    expect(c['essU:aoi']).toBe(1);
    expect(essenceBalance(want, 'aoi')).toBe(0);
    expect(reload(want)).toEqual(want);
  });

  it('an older build that saves over it loses nothing, and the load after it pays nothing twice', () => {
    const { p, a, b } = bothTracks();
    const want = reload(p);
    const stale = olderBuild(want);
    expect(stale.gear[a].ur).toBeUndefined();
    expect(stale.gear[b].ur).toBeUndefined();
    expect(stale.units.aoi).toMatchObject({ breakthrough: 5, level: 60 });
    expect(stale.units.aoi.pl).toBeUndefined();
    const back = JSON.parse(JSON.stringify(migrateProfile(stale)));
    // gear, girls, items, coins, mail and every counter exactly as before: no refund, no welcome pouch, no letter
    expect(back.gear).toEqual(want.gear);
    // (a P1 girl's `pl: 1` comes back as no `pl`, which is the same P1: potentialLevel, ASCENSION.md §A.1)
    const p1 = (units) => Object.fromEntries(Object.entries(units).map(([id, { pl, ...u }]) => [id, pl > 1 ? { ...u, pl } : u]));
    expect(p1(back.units)).toEqual(p1(want.units));
    expect(back.units.aoi).toMatchObject({ pl: 4, breakthrough: 8, level: 72, dupes: 2 });
    expect(back.items).toEqual(want.items);
    expect(back.currencies).toEqual(want.currencies);
    expect(back.mail).toEqual(want.mail);
    expect(back.missions.counters).toEqual(want.missions.counters);
    expect(essenceBalance(back, 'aoi')).toBe(0);
    // and the next loads stay put
    expect(reload(back)).toEqual(back);
    const twice = JSON.parse(JSON.stringify(migrateProfile(olderBuild(back))));
    expect({ ...twice, units: p1(twice.units) }).toEqual({ ...back, units: p1(back.units) });
  });

  it("a Potential-v3 tab that clamps a girl to its own cap and rewrites 'lv:' down loses no level ('lvA:')", () => {
    // Aoi with `dupes` duplicates, `kindred` Kindred steps and `chosen` Chosen Essence, at `level` with the gates it needs
    const girl = ({ dupes, kindred = 0, chosen = 0, level }) => {
      const p = createProfile();
      p.currencies.coins = 5e7;
      if (kindred) addItems(p, [{ id: 'kindred_r', count: kindred }]);
      p.units.aoi.dupes = dupes;
      for (let i = 0; i < chosen; i++) expect(addChosenEssence(p, 'aoi')).toBe(true);
      for (let i = 0; i < dupes + chosen; i++) expect(raisePotential(p, 'aoi', 'own').ok).toBe(true);
      for (let i = 0; i < kindred; i++) expect(raisePotential(p, 'aoi', 'kindred_r').ok).toBe(true);
      Object.assign(p.units.aoi, { breakthrough: gatesForLevel(level, p.units.aoi.pl), level, exp: 0 });
      mirrorUnit(p, 'aoi');
      return reload(p);
    };
    for (const [setup, v3Level] of [
      [{ dupes: 2, kindred: 1, level: 72 }, 67], // P4, the v3 tab sees P3
      [{ dupes: 1, kindred: 4, level: 85 }, 63], // P6, the v3 tab sees P2: 22 levels
      [{ dupes: 1, chosen: 2, level: 72 }, 63], // P4 from Chosen Essence
      [{ dupes: 3, kindred: 2, level: 85 }, 72],
      [{ dupes: 3, level: 72 }, 72], // P from duplicates only: the v3 tab keeps her level
    ]) {
      const want = girl(setup);
      const a = want.units.aoi;
      expect(want.missions.counters['lvA:aoi']).toBe(a.level);
      const stale = potentialV3Build(want);
      expect(stale.units.aoi.level).toBe(v3Level);
      expect(stale.missions.counters['lv:aoi']).toBe(v3Level);
      expect(stale.missions.counters['lvA:aoi']).toBe(a.level);
      const back = JSON.parse(JSON.stringify(migrateProfile(stale)));
      expect(back.units.aoi).toMatchObject({ level: a.level, pl: a.pl, breakthrough: a.breakthrough });
      expect(back.missions.counters['lv:aoi']).toBe(a.level);
      expect(back.missions.counters).toEqual(want.missions.counters);
      expect(reload(back)).toEqual(back);
      // and another v3 trip after it changes nothing either
      expect(JSON.parse(JSON.stringify(migrateProfile(potentialV3Build(back)))).units.aoi).toEqual(back.units.aoi);
    }
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

// Gear M0 re-review r2: a broken gear line drops only that line (a main: its piece), never the save
describe('a null or missing gear line (review M0 r2 M1)', () => {
  const withGear = () => {
    const p = createProfile();
    p.currencies.coins = 4321;
    const a = addGear(p, rollGear(createRng(1), { slot: 'charm', rarity: 'legendary', level: 4 }));
    const b = addGear(p, rollGear(createRng(2), { slot: 'ribbon', rarity: 'legendary', level: 4 }));
    return { p, a, b };
  };
  const load = (raw) => loadSaveText(JSON.stringify(raw));

  it('a null main drops that piece; the rest of the save loads', () => {
    const { p, a, b } = withGear();
    const raw = JSON.parse(JSON.stringify(p));
    raw.gear[a].main = null;
    const r = load(raw);
    expect(r.backup).not.toBe('corrupt');
    expect(r.profile.gear[a]).toBeUndefined();
    expect(r.profile.gear[b]).toBeTruthy();
    expect(r.profile.currencies.coins).toBe(4321);
  });

  it('a missing main drops that piece', () => {
    const { p, a, b } = withGear();
    const raw = JSON.parse(JSON.stringify(p));
    delete raw.gear[a].main;
    const r = load(raw);
    expect(r.backup).not.toBe('corrupt');
    expect(r.profile.gear[a]).toBeUndefined();
    expect(r.profile.gear[b]).toBeTruthy();
  });

  it('a null substat drops that line only', () => {
    const { p, a } = withGear();
    const raw = JSON.parse(JSON.stringify(p));
    const n = raw.gear[a].subs.length;
    raw.gear[a].subs[1] = null;
    const r = load(raw);
    expect(r.backup).not.toBe('corrupt');
    expect(r.profile.gear[a].subs).toHaveLength(n - 1);
    expect(r.profile.gear[a].main).toEqual(p.gear[a].main);
  });
});

describe('unit.accItem (review M0 r2 L3)', () => {
  it('an acc_ item id is kept; anything else is dropped', () => {
    const p = createProfile();
    const id = Object.keys(p.units)[0];
    p.units[id].accItem = 'acc_star_pin';
    expect(migrateProfile(JSON.parse(JSON.stringify(p))).units[id].accItem).toBe('acc_star_pin');
    for (const bad of ['star_pin', 'acc_', 'acc_BAD', 42, { id: 'acc_x' }, `acc_${'x'.repeat(40)}`]) {
      p.units[id].accItem = bad;
      expect(migrateProfile(JSON.parse(JSON.stringify(p))).units[id].accItem, String(bad)).toBeUndefined();
    }
  });
});
