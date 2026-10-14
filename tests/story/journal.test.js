// Captain's Journal logic: lessons, feature gates, the welcome 10-pull and legacy saves from the live game
// (STORY_SPEC §6 T-lessons-2, T-gates-1, T-welcome-1). Pure Node tests over src/systems/story.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import {
  createProfile, migrateProfile, serializeProfile, deserializeProfile, loadSaveText, SAVE_VERSION,
} from '../../src/systems/save.js';
import {
  storyOf, checkLessons, lessonList, readLesson, claimLesson, unreadLessonCount, claimableLessonCount, journalDot,
  featureOpen, featureLockText, featureStage, lessonUnlocked, legacyAnnounceDue, setTutorial, onboardingRoute,
  WELCOME_MAIL_ID,
} from '../../src/systems/story.js';
import { claimMail, mailList } from '../../src/systems/mail.js';
import { itemCount } from '../../src/systems/inventory.js';
import { LESSON_IDS } from '../../src/data/story/lessons.js';
import { CAMPAIGN_IDS } from '../../src/data/stages.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LIVE = JSON.parse(readFileSync(join(ROOT, 'tests', 'story', 'fixtures', 'live-saves.json'), 'utf8'));

function clearUpTo(p, lastId) {
  for (const id of CAMPAIGN_IDS) {
    p.progress.stages[id] = { clears: 1, easy: false, normal: true, hard: false, nightmare: false };
    if (id === lastId) break;
  }
  return p;
}
const fresh = () => {
  const p = createProfile();
  setTutorial(p, 'done');
  return p;
};
const welcomeLetters = (p) => mailList(p).filter((l) => l.id === WELCOME_MAIL_ID);
const roundTrip = (p) => deserializeProfile(serializeProfile(p));

describe('lessons (T-lessons-2)', () => {
  it('nothing unlocks before the first battle; the tutorial opens "home"', () => {
    const p = createProfile();
    expect(checkLessons(p).unlocked).toEqual([]);
    setTutorial(p, 'skipped');
    expect(checkLessons(p)).toEqual({ unlocked: ['home'], quiet: false, mailed: false });
  });

  it('unlocks in order as stages are cleared, and is idempotent', () => {
    const p = fresh();
    expect(checkLessons(p, 1).unlocked).toEqual(['home']);
    clearUpTo(p, '1-1');
    expect(checkLessons(p, 2).unlocked).toEqual(['bestiary']);
    clearUpTo(p, '1-3');
    expect(checkLessons(p, 3)).toEqual({ unlocked: ['formation', 'recruit', 'levelup'], quiet: false, mailed: true });
    expect(checkLessons(p, 4)).toEqual({ unlocked: [], quiet: false, mailed: false });
    clearUpTo(p, '5-5');
    expect(checkLessons(p, 5).unlocked).toEqual(['paths', 'bounty', 'gear', 'commissions', 'challenge', 'awaken', 'assault']);
    expect(Object.keys(storyOf(p).lessons).sort()).toEqual([...LESSON_IDS].sort());
    expect(storyOf(p).lessons.home).toEqual({ at: 1, quiet: false, read: false, claimed: false });
  });

  it('readLesson marks read; claimLesson pays once and refuses locked, unknown and mail-only lessons', () => {
    const p = fresh();
    checkLessons(p);
    expect(readLesson(p, 'bestiary')).toEqual({ ok: false, error: 'locked' });
    expect(readLesson(p, 'nope')).toEqual({ ok: false, error: 'unknown' });
    expect(unreadLessonCount(p)).toBe(1);
    expect(readLesson(p, 'home')).toEqual({ ok: true, changed: true });
    expect(readLesson(p, 'home')).toEqual({ ok: true, changed: false });
    expect(unreadLessonCount(p)).toBe(0);
    expect(claimableLessonCount(p)).toBe(1);
    expect(journalDot(p)).toBe(true);

    const gems = p.currencies.gems;
    const r = claimLesson(p, 'home');
    expect(r.ok).toBe(true);
    expect(r.rewards).toEqual([{ id: 'gems', count: 100 }]);
    expect(p.currencies.gems).toBe(gems + 100);
    expect(claimLesson(p, 'home')).toEqual({ ok: false, error: 'claimed', rewards: [] });
    expect(p.currencies.gems).toBe(gems + 100);
    expect(claimLesson(p, 'gear')).toEqual({ ok: false, error: 'locked', rewards: [] });
    expect(claimLesson(p, 'nope').error).toBe('unknown');
    expect(journalDot(p)).toBe(false);

    clearUpTo(p, '1-3');
    checkLessons(p);
    expect(claimLesson(p, 'recruit')).toEqual({ ok: false, error: 'mailOnly', rewards: [] });
    const rows = lessonList(p);
    expect(rows.find((l) => l.id === 'recruit')).toMatchObject({ unlocked: true, claimable: false, mailOnly: true });
    expect(rows.find((l) => l.id === 'gear')).toMatchObject({ unlocked: false, claimable: false, requirement: 'Clear 2-1 {stage:2-1}' });
    expect(rows.find((l) => l.id === 'home').requirement).toBe('Finish the first battle');
    // claiming also counts as reading
    expect(claimLesson(p, 'levelup').ok).toBe(true);
    expect(storyOf(p).lessons.levelup.read).toBe(true);
  });

  it('lesson state survives a save round trip', () => {
    const p = clearUpTo(fresh(), '1-2');
    checkLessons(p);
    readLesson(p, 'home');
    claimLesson(p, 'bestiary');
    const q = roundTrip(p);
    expect(storyOf(q).lessons).toEqual(storyOf(p).lessons);
  });
});

describe('feature gates (T-gates-1)', () => {
  it('new save: Equipment closed until 2-1, Awakening until 3-2', () => {
    const p = fresh();
    expect(featureOpen(p, 'gear')).toBe(false);
    expect(featureOpen(p, 'awaken')).toBe(false);
    clearUpTo(p, '1-5');
    expect(featureOpen(p, 'gear')).toBe(false);
    clearUpTo(p, '2-1');
    expect(featureOpen(p, 'gear')).toBe(true); // before checkLessons too: the condition is enough
    expect(featureOpen(p, 'awaken')).toBe(false);
    clearUpTo(p, '3-2');
    expect(featureOpen(p, 'awaken')).toBe(true);
  });

  it('opens early when the profile already shows use', () => {
    const a = fresh();
    a.items.gearbox_rare = 1;
    expect(featureOpen(a, 'gear')).toBe(true);
    const b = fresh();
    b.gear.g1 = { uid: 'g1', slot: 'charm' };
    expect(featureOpen(b, 'gear')).toBe(true);
    const c = fresh();
    c.units.aoi.awaken = 1;
    expect(featureOpen(c, 'awaken')).toBe(true);
    const d = fresh();
    d.items.crown_slime = 2;
    expect(featureOpen(d, 'awaken')).toBe(true);
    expect(featureOpen(d, 'gear')).toBe(false);
  });

  it('legacy saves have every feature open with 0 clears; lesson ids work as features', () => {
    const raw = JSON.parse(JSON.stringify(createProfile()));
    delete raw.story;
    const p = migrateProfile(raw);
    for (const f of ['gear', 'awaken', ...LESSON_IDS]) expect(featureOpen(p, f), f).toBe(true);
    const q = fresh();
    expect(featureOpen(q, 'home')).toBe(true);
    expect(featureOpen(q, 'bounty')).toBe(false);
    expect(lessonUnlocked(q, 'bounty')).toBe(false);
    expect(featureOpen(q, 'something-else')).toBe(true);
  });

  it('lock text names the stage and Hikari', () => {
    expect(featureLockText('gear')).toBe('Equipment unlocks after 2-1 {stage:2-1} — {name:hikari} will teach you!');
    expect(featureLockText('awaken')).toContain('{stage:3-2}');
    expect(featureStage('gear')).toBe('2-1');
    expect(featureStage('awaken')).toBe('3-2');
  });
});

describe('welcome 10-pull: no double grant (T-welcome-1)', () => {
  it('createProfile no longer grants the ticket; 0–2 clears → no mail', () => {
    const p = fresh();
    expect(itemCount(p, 'ticket_recruit10')).toBe(0);
    expect(storyOf(p).welcome).toBe('pending');
    for (const id of ['1-1', '1-2']) {
      clearUpTo(p, id);
      expect(checkLessons(p).mailed).toBe(false);
    }
    expect(welcomeLetters(p)).toHaveLength(0);
  });

  it('1-3 cleared → exactly one letter with one 10× ticket, however often it is checked', () => {
    const p = clearUpTo(fresh(), '1-3');
    expect(checkLessons(p).mailed).toBe(true);
    for (let i = 0; i < 3; i++) expect(checkLessons(p).mailed).toBe(false);
    expect(storyOf(p).welcome).toBe('mailed');
    const letters = welcomeLetters(p);
    expect(letters).toHaveLength(1);
    expect(letters[0].rewards).toEqual([{ id: 'ticket_recruit10', count: 1 }]);
    expect(letters[0].from).toBe('Hikari');
    expect(letters[0].body).not.toMatch(/\{/);
    expect(claimMail(p, WELCOME_MAIL_ID).ok).toBe(true);
    expect(itemCount(p, 'ticket_recruit10')).toBe(1);
    // round trip, then check again: still one letter, still one ticket
    const q = roundTrip(p);
    checkLessons(q);
    expect(welcomeLetters(q)).toHaveLength(1);
    expect(itemCount(q, 'ticket_recruit10')).toBe(1);
  });

  it('a welcome state reset by an odd import still cannot regrant (mail.delivered guards)', () => {
    const p = clearUpTo(fresh(), '1-3');
    checkLessons(p);
    claimMail(p, WELCOME_MAIL_ID);
    storyOf(p).welcome = 'pending';
    const q = roundTrip(p);
    expect(storyOf(q).welcome).toBe('pending');
    expect(checkLessons(q).mailed).toBe(false);
    expect(storyOf(q).welcome).toBe('mailed');
    expect(welcomeLetters(q)).toHaveLength(1);
    expect(itemCount(q, 'ticket_recruit10')).toBe(1);
    // even with the claimed letter dropped from the mailbox
    q.mail.letters = [];
    storyOf(q).welcome = 'pending';
    expect(checkLessons(q).mailed).toBe(false);
    expect(mailList(q)).toHaveLength(0);
  });

  it('legacy saves are never mailed, at 5 clears or after reaching 1-3 later', () => {
    const raw = JSON.parse(JSON.stringify(createProfile()));
    delete raw.story;
    const a = clearUpTo(migrateProfile(raw), '1-5');
    expect(storyOf(a).welcome).toBe('legacy');
    expect(checkLessons(a).mailed).toBe(false);
    const b = migrateProfile(JSON.parse(JSON.stringify(raw)));
    checkLessons(b);
    clearUpTo(b, '1-3');
    expect(checkLessons(b).mailed).toBe(false);
    expect(welcomeLetters(a).length + welcomeLetters(b).length).toBe(0);
  });

  it('a reset (fresh createProfile) is pending again', () => {
    const p = clearUpTo(fresh(), '1-3');
    checkLessons(p);
    expect(storyOf(createProfile()).welcome).toBe('pending');
  });
});

describe('saves written by the live game (before the story)', () => {
  for (const [name, text] of Object.entries(LIVE).filter(([k]) => k !== 'note')) {
    it(`${name}: loads as legacy — nothing forced, nothing lost, nothing granted twice`, () => {
      const rawJson = JSON.parse(Buffer.from(text, 'base64').toString('utf8'));
      expect(rawJson.story).toBeUndefined();
      expect(rawJson.version).toBe(SAVE_VERSION);
      const { profile: p, backup } = loadSaveText(JSON.stringify(rawJson));
      expect(backup).toBeNull();
      const before = { items: { ...p.items }, currencies: { ...p.currencies }, units: Object.keys(p.units), stages: Object.keys(p.progress.stages) };
      expect(before.items).toEqual(rawJson.items);
      expect(before.currencies).toEqual(rawJson.currencies);
      expect(before.stages).toEqual(Object.keys(rawJson.progress.stages));

      const s = storyOf(p);
      expect(s).toMatchObject({ legacy: true, opening: 'legacy', tutorial: 'legacy', welcome: 'legacy' });
      expect(onboardingRoute(p)).toBeNull();
      for (const f of ['gear', 'awaken']) expect(featureOpen(p, f)).toBe(true);

      const r = checkLessons(p);
      expect(r.quiet).toBe(true);
      expect(r.mailed).toBe(false);
      expect(r.unlocked[0]).toBe('home');
      expect(legacyAnnounceDue(p)).toBe(r.unlocked.length);
      // play on to 1-5 and beyond: still no welcome letter, ticket count untouched by the story
      clearUpTo(p, '2-1');
      checkLessons(p);
      expect(welcomeLetters(p)).toHaveLength(0);
      expect(itemCount(p, 'ticket_recruit10')).toBe(rawJson.items.ticket_recruit10 || 0);
      // the backlog pays its small thank-you once
      const claimable = claimableLessonCount(p);
      expect(claimable).toBeGreaterThan(0);
      for (const l of lessonList(p)) if (l.claimable) expect(claimLesson(p, l.id).ok).toBe(true);
      for (const l of lessonList(p)) expect(l.claimable).toBe(false);
      // and the story block persists as legacy
      expect(storyOf(roundTrip(p)).legacy).toBe(true);
    });
  }

  it('the mid-game save unlocks the lessons for what it already cleared', () => {
    const { profile: p } = loadSaveText(Buffer.from(LIVE.midgame, 'base64').toString('utf8'));
    expect(checkLessons(p).unlocked).toEqual(['home', 'bestiary', 'formation', 'recruit', 'levelup', 'paths', 'bounty', 'gear', 'commissions', 'challenge']);
  });
});
