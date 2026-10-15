// profile.sensei in the save (docs/specs/PROFILE.md §2): defaults, cleaning, older builds, round trips.
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile, migrationDropsData, serializeProfile, deserializeProfile } from '../../src/systems/save.js';
import { newSensei, cleanSensei, setSensei, markSensei, senseiFromMarks, SENSEI_MARK } from '../../src/systems/senseiSave.js';
import { freshSave, lateSave } from './profileFixtures.js';

const clone = (v) => JSON.parse(JSON.stringify(v));
/** What an older cached build (before profiles) writes: the same save without the block. */
const olderBuildSave = (p) => {
  const raw = clone(p);
  delete raw.sensei;
  return raw;
};

describe('profile.sensei', () => {
  it('createProfile has the empty block', () => {
    expect(createProfile().sensei).toEqual(newSensei());
  });

  it('migration keeps a valid block', () => {
    const p = lateSave();
    setSensei(p, { favorite: 'luna', avatar: 'nami', banner: 'theme:festival', frame: 'eclipse', title: 'fp_crimson', showcase: ['luna', 'nami', 'aoi'], pins: ['8-5:nightmare', 'ach:a_gold_40'], bio: 'Luna main!' });
    const m = migrateProfile(clone(p));
    expect(m.sensei).toEqual({ ...p.sensei, lost: false });
    expect(m.sensei.title).toBe('fp_crimson');
  });

  it('cleanSensei drops unowned, unearned, over-limit and recruit picks', () => {
    const p = freshSave();
    p.missions.achievements = { a_pulls_10: true, a_first_win: true };
    p.progress.stages['1-1'] = { clears: 1, easy: true };
    const s = cleanSensei({
      avatar: 'luna', favorite: 'aoi', banner: 'theme:volcano', frame: 'eclipse', title: 'fp_crimson',
      showcase: ['aoi', 'aoi', 'luna', 'rei', 'hikari', 'nope'], pins: ['1-1:easy', '1-1:easy', '1-1:hard', 'ach:a_pulls_10', 'ach:a_first_win', 'junk'],
      bio: 'x'.repeat(81), lost: 'yes',
    }, p);
    expect(s).toEqual({ avatar: null, favorite: 'aoi', banner: 'academy:day', frame: null, title: null, showcase: ['aoi', 'rei', 'hikari'], pins: ['1-1:easy', 'ach:a_first_win'], bio: '', lost: false });
    const many = Array.from({ length: 6 }, (_, i) => `1-${i % 5 + 1}:easy`);
    for (const id of ['1-2', '1-3', '1-4', '1-5']) p.progress.stages[id] = { clears: 1, easy: true };
    expect(cleanSensei({ pins: many }, p).pins).toHaveLength(4);
  });

  it('keeps a title / ach pin from a newer achievement pack while it is claimed', () => {
    const p = freshSave();
    p.missions.achievements = { a_newer_pack: true };
    const s = cleanSensei({ title: 'a_newer_pack', pins: ['ach:a_newer_pack'] }, p);
    expect(s.title).toBe('a_newer_pack');
    expect(s.pins).toEqual(['ach:a_newer_pack']);
  });

  it('a save with no block (from before profiles) loads with lost: true and loses nothing else', () => {
    const p = lateSave();
    const raw = olderBuildSave(p);
    for (const k of Object.keys(raw.missions.counters)) if (k.startsWith(SENSEI_MARK)) delete raw.missions.counters[k];
    const m = migrateProfile(raw);
    expect(m.sensei).toEqual({ ...newSensei(), lost: true });
    expect(Object.keys(m.units)).toEqual(Object.keys(p.units));
    expect(Object.keys(m.gear)).toHaveLength(Object.keys(p.gear).length);
    expect(migrationDropsData(raw)).toBe(false);
  });

  it('an older cached build never wipes the picks: they come back from the missions.counters shadows', () => {
    const p = lateSave();
    p.missions.achievements.a_newer_pack = true;
    setSensei(p, { favorite: 'luna', avatar: 'nami', banner: 'scene:sango', frame: 'ur', title: 'a_newer_pack', showcase: ['luna', 'nami', 'aoi', 'kaede'], pins: ['ach:a_gold_40', '8-5:nightmare', 'ach:a_newer_pack'], bio: 'hi' });
    const back = migrateProfile(olderBuildSave(migrateProfile(clone(p))));
    expect(back.sensei).toEqual({ ...p.sensei, bio: '', lost: false }); // the bio is the server's (mirror)
    // and the restored block writes its shadows again
    expect(senseiFromMarks(back)).toEqual(back.sensei);
  });

  it('shadows are numbers only (every older build keeps numbers) and stale ones are removed', () => {
    const p = freshSave();
    setSensei(p, { showcase: ['aoi', 'rei'] });
    setSensei(p, { showcase: ['aoi'] });
    const marks = Object.entries(p.missions.counters).filter(([k]) => k.startsWith(SENSEI_MARK));
    expect(marks.every(([, v]) => typeof v === 'number' && v > 0)).toBe(true);
    expect(p.missions.counters[`${SENSEI_MARK}s1`]).toBeUndefined();
    markSensei(p);
    expect(migrateProfile(clone(p))).toEqual(p);
  });

  it('cosmetic drops never count as lossy', () => {
    const raw = clone(freshSave());
    raw.sensei = { ...raw.sensei, showcase: ['luna'], pins: ['8-5:nightmare'] };
    expect(migrationDropsData(raw)).toBe(false);
  });

  it('export / import round trip keeps the block', () => {
    const p = lateSave();
    setSensei(p, { favorite: 'luna', showcase: ['luna', 'nami'], pins: ['ach:a_gold_40'] });
    const back = deserializeProfile(serializeProfile(migrateProfile(clone(p))));
    expect(back.sensei).toEqual(p.sensei);
  });
});
