// missions.counters holds more than mission event counts: Potential M0 mirrors every girl's
// duplicate count there ('pot:<unitId>', 'pot:at'), co-op freeplay marks every paid
// once-per-account milestone there ('fpm:<tier>:<id>'), patch notes mark every claimed gift
// ('pg:<noteId>') and the story marks a save created with it ('story:new'), the legacy toast
// ('story:ann'), claimed lessons ('sl:<id>') and read scenes ('ss:<id>'), because older builds keep
// that map word for word when they rewrite a save. The namespaces must never read each other's keys,
// and each must survive an older build dropping its main copy (units[id].dupes, progress.freeplay,
// profile.patchGifts, profile.story).
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import { grantUnit } from '../../src/systems/unlocks.js';
import { createRng } from '../../src/core/rng.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { SHADOW_PREFIX, SHADOW_AT, restoreFromShadow } from '../../src/systems/potential.js';
import { MILESTONE_MARK, applyCoopFreeplayEnd, freeplayRecords } from '../../src/online/coop/rewards.js';
import { PATCH_NOTES } from '../../src/data/patchNotes.js';
import { PATCH_MARK, claimAllPatchGifts, unclaimedPatchGifts, claimPatchGift } from '../../src/systems/patchGifts.js';
import {
  STORY_NEW_MARK, STORY_ANNOUNCED_MARK, LESSON_MARK, SEEN_MARK, WELCOME_MAIL_ID,
  skipOnboarding, checkLessons, claimLesson, lessonList, claimableLessonCount, markAnnounced, legacyAnnounceDue,
} from '../../src/systems/story.js';
import { markSeen } from '../../src/systems/storyTriggers.js';
import { claimAllMail } from '../../src/systems/mail.js';
import { LEVEL_SHADOW_PREFIX } from '../../src/systems/progression.js';
import { FP_TOME_PREFIX } from '../../src/online/coop/rewards.js';
import { TRACK_EVENTS } from '../../src/data/missions.js';

/**
 * An older build (before patch notes and the story; it keeps missions.counters word for word, as
 * live v0.1.27's cleanNumberMap does) rewrites the save: no patchGifts, no story block.
 */
function throughOldBuild(p) {
  const old = JSON.parse(JSON.stringify(p));
  delete old.patchGifts;
  delete old.story;
  return migrateProfile(old);
}
const clear = (p, ...ids) => { for (const id of ids) p.progress.stages[id] = { clears: 1, easy: true, normal: false, hard: false, nightmare: false }; };
const scene = (id, kind = 'prologue') => ({ id, kind, trigger: { before: '2-1' } });

const fpResult = (o = {}) => ({
  stageId: '1-3', difficulty: 'normal', won: false, wave: 160, wavesCleared: 152, livesLeft: 0, maxLives: 100,
  encountered: ['slime_green'], kills: { slime_green: 10, dragon_ashwing: 1 }, stats: {},
  freeplay: 'blossom', goal: 15, goalReached: true, finished: false, ...o,
});

describe('missions.counters namespaces: Potential shadows vs freeplay milestone marks', () => {
  it('the prefixes are disjoint and no girl id can spell the Potential timestamp key', () => {
    expect(SHADOW_PREFIX).not.toBe(MILESTONE_MARK);
    expect(SHADOW_PREFIX.startsWith(MILESTONE_MARK) || MILESTONE_MARK.startsWith(SHADOW_PREFIX)).toBe(false);
    expect(SHADOW_AT.startsWith(SHADOW_PREFIX)).toBe(true);
    expect(SHADOW_AT.startsWith(MILESTONE_MARK)).toBe(false);
    expect(UNIT_MAP[SHADOW_AT.slice(SHADOW_PREFIX.length)]).toBeUndefined(); // no girl called 'at'
  });

  it('both survive an older build dropping dupes and progress.freeplay, and neither reads the other', () => {
    const p = createProfile();
    grantUnit(p, 'kaede', 1000);
    grantUnit(p, 'kaede', 2000); // a duplicate: dupes 1
    applyCoopFreeplayEnd(p, fpResult(), createRng(1), { banked: null });
    const c = p.missions.counters;
    const pot = Object.keys(c).filter((k) => k.startsWith(SHADOW_PREFIX));
    const fpm = Object.keys(c).filter((k) => k.startsWith(MILESTONE_MARK));
    expect(c[`${SHADOW_PREFIX}kaede`]).toBe(1);
    expect(fpm).toEqual(expect.arrayContaining(['fpm:blossom:w100', 'fpm:blossom:w150', 'fpm:blossom:matriarch']));
    expect(pot.filter((k) => fpm.includes(k))).toEqual([]);

    // an older cached build rewrites the save: no dupes on the girls, no progress.freeplay
    const old = JSON.parse(JSON.stringify(p));
    for (const u of Object.values(old.units)) delete u.dupes;
    delete old.progress.freeplay;
    const back = migrateProfile(old);
    expect(back.units.kaede.dupes).toBe(1);
    expect(back.units.aoi.dupes).toBe(0);
    // the freeplay records come back from the 'fpm:' marks only (no 'pot:' key turns into a milestone)
    const rec = freeplayRecords(back);
    expect(rec.done.sort()).toEqual(['blossom:matriarch', 'blossom:w100', 'blossom:w150']);
    // and the Potential restore reads only its own keys (milestone marks are not girls)
    expect(Object.keys(restoreFromShadow(back.units, back.missions.counters, []))).not.toContain('blossom:w100');
    // nothing pays twice
    const gems = back.currencies.gems;
    const again = applyCoopFreeplayEnd(back, fpResult({ wavesCleared: 160 }), createRng(1), { banked: null });
    expect(again.freeplay.milestones).toEqual([]);
    expect(back.currencies.gems).toBe(gems);
  });
});

describe('missions.counters marks: patch gifts and the story outlive an older build', () => {
  it('the new prefixes are disjoint from each other and from pot: / fpm:', () => {
    // (v3: the level shadow 'lv:<id>' and the freeplay cache Tome counter 'fpTome:<week>' too)
    const all = [SHADOW_PREFIX, MILESTONE_MARK, PATCH_MARK, LESSON_MARK, SEEN_MARK, STORY_NEW_MARK, STORY_ANNOUNCED_MARK, LEVEL_SHADOW_PREFIX, FP_TOME_PREFIX];
    for (const a of all) for (const b of all) if (a !== b) expect(a.startsWith(b)).toBe(false);
    for (const e of TRACK_EVENTS || []) for (const a of all) expect(String(e).startsWith(a)).toBe(false);
    // a fresh profile carries the story mark (and nothing else new)
    const p = createProfile();
    expect(p.missions.counters[STORY_NEW_MARK]).toBe(1);
    expect(Object.keys(p.missions.counters).filter((k) => /^(pg|sl|ss):/.test(k))).toEqual([]);
    // and it survives its own migrate unchanged (idempotent)
    expect(migrateProfile(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it('claimed patch gifts stay claimed after an older build drops profile.patchGifts', () => {
    const p = createProfile();
    claimPatchGift(p, PATCH_NOTES[0].id);
    expect(p.missions.counters[PATCH_MARK + PATCH_NOTES[0].id]).toBe(1);
    claimAllPatchGifts(p);
    expect(Object.keys(p.missions.counters).filter((k) => k.startsWith(PATCH_MARK))).toHaveLength(PATCH_NOTES.length);
    const back = throughOldBuild(p);
    expect(unclaimedPatchGifts(back)).toEqual([]);
    expect(Object.keys(back.patchGifts).sort()).toEqual(PATCH_NOTES.map((n) => n.id).sort());
    const gems = back.currencies.gems;
    expect(claimAllPatchGifts(back)).toEqual({ ok: false, count: 0, rewards: [] });
    expect(back.currencies.gems).toBe(gems);
    // a claim made before the marks existed gets its mark at the next load
    const pre = createProfile();
    pre.patchGifts = { [PATCH_NOTES[1].id]: true };
    expect(migrateProfile(JSON.parse(JSON.stringify(pre))).missions.counters[PATCH_MARK + PATCH_NOTES[1].id]).toBe(1);
  });

  it('a new player\'s story block comes back as a new player\'s (not legacy): claimed lessons and read scenes stay paid', () => {
    const p = createProfile();
    skipOnboarding(p);
    clear(p, '1-1', '1-2', '1-3');
    checkLessons(p);
    const claimable = lessonList(p).filter((l) => l.claimable).map((l) => l.id);
    expect(claimable.length).toBeGreaterThan(0);
    for (const id of claimable) expect(claimLesson(p, id).ok).toBe(true);
    for (const id of claimable) expect(p.missions.counters[LESSON_MARK + id]).toBe(1);
    expect(markSeen(p, scene('ch2.prologue')).first).toBe(true);
    expect(p.missions.counters[`${SEEN_MARK}ch2.prologue`]).toBe(1);
    claimAllMail(p);

    const back = throughOldBuild(p);
    expect(back.story.legacy).toBe(false);
    expect(back.story.opening).toBe('skipped'); // nothing forced again
    expect(back.story.tutorial).toBe('skipped');
    expect(back.story.welcome).toBe('mailed'); // its letter was delivered
    checkLessons(back);
    expect(claimableLessonCount(back)).toBe(0);
    const gems = back.currencies.gems;
    for (const id of claimable) expect(claimLesson(back, id)).toEqual({ ok: false, error: 'claimed', rewards: [] });
    expect(markSeen(back, scene('ch2.prologue'))).toEqual({ first: false, rewards: [] });
    expect(back.currencies.gems).toBe(gems);
    expect(checkLessons(back).mailed).toBe(false);
    // and the rebuilt block is stable: loading it again changes nothing
    expect(migrateProfile(JSON.parse(JSON.stringify(back)))).toEqual(back);
  });

  it('a new player who has not cleared 1-3 when an older build touches the save still gets the welcome 10-pull once', () => {
    const p = createProfile();
    skipOnboarding(p);
    clear(p, '1-1');
    const back = throughOldBuild(p);
    expect(back.story.legacy).toBe(false);
    expect(back.story.welcome).toBe('pending');
    clear(back, '1-2', '1-3');
    expect(checkLessons(back).mailed).toBe(true);
    expect(back.mail.delivered).toContain(WELCOME_MAIL_ID);
    // through the older build again: the letter's delivery still guards a second one
    const again = throughOldBuild(back);
    expect(again.story.welcome).toBe('mailed');
    expect(checkLessons(again).mailed).toBe(false);
  });

  it('a legacy save stays legacy, and its claimed lessons and the summary toast stay done', () => {
    const p = createProfile();
    delete p.story;
    delete p.missions.counters[STORY_NEW_MARK]; // a save from before the story
    const legacy = migrateProfile(JSON.parse(JSON.stringify(p)));
    expect(legacy.story.legacy).toBe(true);
    expect(legacy.missions.counters[STORY_NEW_MARK]).toBeUndefined();
    clear(legacy, '1-1', '1-2', '1-3');
    checkLessons(legacy);
    expect(legacyAnnounceDue(legacy)).toBeGreaterThan(0);
    markAnnounced(legacy);
    const claimed = lessonList(legacy).filter((l) => l.claimable).map((l) => l.id);
    for (const id of claimed) claimLesson(legacy, id);
    const back = throughOldBuild(legacy);
    expect(back.story.legacy).toBe(true);
    expect(back.story.welcome).toBe('legacy');
    expect(legacyAnnounceDue(back)).toBe(0);
    checkLessons(back);
    expect(claimableLessonCount(back)).toBe(0);
    expect(back.story.lessons[claimed[0]].quiet).toBe(true);
  });

  it('marks never turn into another namespace\'s data', () => {
    const p = createProfile();
    claimAllPatchGifts(p);
    skipOnboarding(p);
    clear(p, '1-1');
    checkLessons(p);
    claimLesson(p, 'home');
    const back = throughOldBuild(p);
    // no mark became a girl, a freeplay milestone or a scene / lesson of the wrong kind
    expect(Object.keys(restoreFromShadow(back.units, back.missions.counters, []))).toEqual([]);
    expect(freeplayRecords(back).done).toEqual([]);
    expect(back.story.seen).toEqual([]);
    expect(Object.keys(back.story.lessons)).toEqual(['home']);
  });
});
