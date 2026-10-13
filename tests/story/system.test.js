// Story state, onboarding, triggers and the archive (STORY_SPEC §6 T-save-1, T-trig-1, T-trig-2, T-content-6,
// T-bundle-1). Pure Node tests over src/systems/story.js and src/systems/storyTriggers.js with the real scene list.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import {
  createProfile, migrateProfile, serializeProfile, deserializeProfile, loadSaveText, SAVE_VERSION,
} from '../../src/systems/save.js';
import {
  newStory, legacyStory, cleanStory, storyOf, clearedCampaign, onboardingRoute, tutorialRoute, setOpening, setTutorial,
  skipOnboarding, setStoryPrefs, stageOpen, STORY_VERSION, SEEN_LIMIT, QUEUE_LIMIT,
} from '../../src/systems/story.js';
import {
  beforeSceneFor, queueAfterClears, nextQueued, pruneQueue, markSeen, recordChoice, episodeList, sceneUnlocked,
  requirementFor, unseenEpisodeCount, episodeNumber,
} from '../../src/systems/storyTriggers.js';
import { SCENE_LIST, sceneById, LESSON_SCENES } from '../../src/data/story/index.js';
import { STORY_REWARDS } from '../../src/data/story/lessons.js';
import { CAMPAIGN_IDS, CHAPTERS } from '../../src/data/stages.js';
import { UNIT_MAP } from '../../src/data/units.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const hasUnit = (id) => !!UNIT_MAP[id];

/** Clear campaign stages in order up to and including `lastId` (Normal medal). */
function clearUpTo(p, lastId) {
  for (const id of CAMPAIGN_IDS) {
    p.progress.stages[id] = { clears: 1, easy: false, normal: true, hard: false, nightmare: false };
    if (id === lastId) break;
  }
  return p;
}
const legacySave = (lastId = null) => {
  const raw = JSON.parse(JSON.stringify(createProfile()));
  delete raw.story;
  const p = migrateProfile(raw);
  return lastId ? clearUpTo(p, lastId) : p;
};

describe('profile.story (T-save-1)', () => {
  it('createProfile starts a new story; SAVE_VERSION is untouched by this branch', () => {
    const p = createProfile();
    expect(SAVE_VERSION).toBe(2);
    expect(p.story).toEqual(newStory());
    expect(p.story).toMatchObject({ v: STORY_VERSION, legacy: false, opening: 'pending', tutorial: 'pending', welcome: 'pending' });
    expect(p.story.prefs).toEqual({ speed: 'normal', auto: false });
  });

  it('a save without a story block migrates as legacy (nothing forced, no welcome pull)', () => {
    const p = legacySave('2-3');
    expect(p.story).toEqual(legacyStory());
    expect(p.story).toMatchObject({ legacy: true, opening: 'legacy', tutorial: 'legacy', welcome: 'legacy' });
    expect(onboardingRoute(p)).toBeNull();
    expect(clearedCampaign(p).size).toBe(8); // 1-1…1-5, 2-1…2-3
  });

  it('round-trips through serialize/deserialize and loadSaveText', () => {
    const p = createProfile();
    setOpening(p, 'seen');
    markSeen(p, sceneById('ch1.mid'));
    recordChoice(p, 'ch1.mid', 1);
    setStoryPrefs(p, { speed: 'fast', auto: true });
    p.story.queue.push('ch1.epi');
    const back = deserializeProfile(serializeProfile(p));
    expect(back.story).toEqual(p.story);
    const loaded = loadSaveText(JSON.stringify(p)).profile;
    expect(loaded.story).toEqual(p.story);
  });

  it('cleanStory repairs junk and never throws', () => {
    for (const junk of [null, undefined, 3, 'x', [], [1, 2]]) expect(cleanStory(junk)).toEqual(legacyStory());
    const s = cleanStory({
      legacy: 'yes', opening: 'banana', tutorial: 7, welcome: {}, announced: 1,
      seen: ['opening', 'opening', 42, 'Bad Id', 'ch1.mid', ...Array.from({ length: 600 }, (_, i) => `x${i}`)],
      queue: 'ch1.epi',
      lessons: { home: { at: 5, read: true, claimed: 'no' }, nope: { at: 1 }, gear: 'x' },
      choices: { 'ch1.mid': 1, 'ch2.mid': 9, 'BAD ID': 0, 'ch3.mid': 1.5 },
      prefs: { speed: 'warp', auto: 'true' },
    });
    expect(s).toMatchObject({ legacy: false, opening: 'skipped', tutorial: 'skipped', welcome: 'pending', announced: false });
    expect(s.seen.slice(0, 2)).toEqual(['opening', 'ch1.mid']);
    expect(s.seen.length).toBe(SEEN_LIMIT);
    expect(s.queue).toEqual([]);
    expect(s.lessons).toEqual({ home: { at: 5, quiet: false, read: true, claimed: false } });
    expect(s.choices).toEqual({ 'ch1.mid': 1 });
    expect(s.prefs).toEqual({ speed: 'normal', auto: false });
    // a legacy block keeps legacy states
    expect(cleanStory({ legacy: true, opening: 'pending' }).opening).toBe('pending');
    expect(cleanStory({ legacy: true, opening: 'oops' }).opening).toBe('legacy');
    // queue: unique, capped, never holds a seen id
    const q = cleanStory({ seen: ['a1'], queue: ['a1', 'b1', 'b1', ...Array.from({ length: 20 }, (_, i) => `q${i}`)] }).queue;
    expect(q[0]).toBe('b1');
    expect(new Set(q).size).toBe(q.length);
    expect(q.length).toBeLessThanOrEqual(QUEUE_LIMIT);
    expect(q).not.toContain('a1');
  });

  it('storyOf is lazy: a profile without a block becomes legacy, a damaged one is repaired', () => {
    const p = createProfile();
    delete p.story;
    expect(storyOf(p)).toEqual(legacyStory());
    expect(p.story).toBe(storyOf(p));
    p.story = { opening: 'seen', seen: 'nope' };
    expect(storyOf(p)).toMatchObject({ opening: 'seen', seen: [], legacy: false });
    expect(storyOf(null)).toEqual(legacyStory());
  });

  it('a damaged story block never sends a player back through the opening', () => {
    const raw = JSON.parse(JSON.stringify(createProfile()));
    raw.story = { opening: 42 };
    expect(onboardingRoute(migrateProfile(raw))).toBeNull();
  });
});

describe('onboarding (T-trig-2)', () => {
  it('new save → opening, then never again once seen or skipped', () => {
    const p = createProfile();
    expect(onboardingRoute(p)).toEqual({ name: 'scene', params: { id: 'opening', next: 'tutorial' } });
    expect(setOpening(p, 'skipped')).toBe(true);
    expect(onboardingRoute(p)).toBeNull();
    expect(setOpening(p, 'pending')).toBe(false);
    expect(p.story.opening).toBe('skipped');
    // reading it in full later upgrades skipped → seen; seen stays seen
    expect(setOpening(p, 'seen')).toBe(true);
    expect(setOpening(p, 'skipped')).toBe(false);
    expect(p.story.opening).toBe('seen');
  });

  it('marking the opening seen (done or skipped) through markSeen updates story.opening', () => {
    const a = createProfile();
    markSeen(a, sceneById('opening'), { skipped: true });
    expect(a.story.opening).toBe('skipped');
    const b = createProfile();
    markSeen(b, sceneById('opening'));
    expect(b.story.opening).toBe('seen');
  });

  it('the tutorial route is 1-1 Easy with the coach flag; tutorial stays pending until done or skipped', () => {
    expect(tutorialRoute()).toEqual({ name: 'battle', params: { stage: '1-1', difficulty: 'easy', tutorial: '1' } });
    const p = createProfile();
    setOpening(p, 'seen');
    expect(p.story.tutorial).toBe('pending');
    expect(setTutorial(p, 'done')).toBe(true);
    expect(setTutorial(p, 'skipped')).toBe(false);
    expect(p.story.tutorial).toBe('done');
  });

  it('legacy saves are never onboarded; ?onboarding=0 skips both steps once', () => {
    expect(onboardingRoute(legacySave())).toBeNull();
    const p = createProfile();
    expect(skipOnboarding(p)).toBe(true);
    expect(p.story).toMatchObject({ opening: 'skipped', tutorial: 'skipped' });
    expect(skipOnboarding(p)).toBe(false);
    const l = legacySave();
    expect(skipOnboarding(l)).toBe(false);
    expect(l.story.opening).toBe('legacy');
  });
});

describe('triggers (T-trig-1)', () => {
  it('before-scenes play on stage prep only while unseen, unlocked and not yet cleared', () => {
    const p = createProfile();
    expect(beforeSceneFor(p, '1-5', SCENE_LIST, hasUnit)).toBeNull(); // locked
    clearUpTo(p, '1-4');
    expect(stageOpen(p, '1-5')).toBe(true);
    expect(beforeSceneFor(p, '1-5', SCENE_LIST, hasUnit)?.id).toBe('ch1.mid');
    expect(beforeSceneFor(p, '1-4', SCENE_LIST, hasUnit)).toBeNull(); // no scene for 1-4
    markSeen(p, sceneById('ch1.mid'));
    expect(beforeSceneFor(p, '1-5', SCENE_LIST, hasUnit)).toBeNull(); // seen
    const q = clearUpTo(createProfile(), '1-5');
    expect(beforeSceneFor(q, '1-5', SCENE_LIST, hasUnit)).toBeNull(); // already cleared
  });

  it('a legacy save is not shown backlog, but meets the scene at its frontier', () => {
    const p = legacySave('3-4');
    for (const id of ['1-5', '2-1', '2-5', '3-1']) expect(beforeSceneFor(p, id, SCENE_LIST, hasUnit)).toBeNull();
    expect(beforeSceneFor(p, '3-5', SCENE_LIST, hasUnit)?.id).toBe('ch3.mid');
  });

  it('queueAfterClears queues epilogues in campaign order without duplicates', () => {
    const p = createProfile();
    clearUpTo(p, '2-5');
    const added = queueAfterClears(p, ['2-5', '1-2', '1-5'], SCENE_LIST, hasUnit);
    expect(added).toEqual(['ch1.yuki', 'ch1.epi', 'ch2.epi']);
    expect(queueAfterClears(p, ['1-5'], SCENE_LIST, hasUnit)).toEqual([]);
    expect(p.story.queue).toEqual(['ch1.yuki', 'ch1.epi', 'ch2.epi']);
    expect(queueAfterClears(p, ['1-3', '1-4'], SCENE_LIST, hasUnit)).toEqual([]); // no after-scenes there
    expect(queueAfterClears(p, [], SCENE_LIST, hasUnit)).toEqual([]);
  });

  it('nextQueued plays in campaign order and the queue drops seen and unknown ids', () => {
    const p = createProfile();
    clearUpTo(p, '2-5');
    p.story.queue = ['ch2.epi', 'nope.scene', 'ch1.epi', 'ch1.epi'];
    expect(nextQueued(p, SCENE_LIST, hasUnit).id).toBe('ch1.epi');
    expect(p.story.queue).toEqual(['ch2.epi', 'ch1.epi']);
    markSeen(p, sceneById('ch1.epi'));
    expect(p.story.queue).toEqual(['ch2.epi']);
    expect(nextQueued(p, SCENE_LIST, hasUnit).id).toBe('ch2.epi');
    markSeen(p, sceneById('ch2.epi'), { skipped: true });
    expect(nextQueued(p, SCENE_LIST, hasUnit)).toBeNull();
    p.story.queue = ['ch1.epi']; // seen meanwhile
    expect(pruneQueue(p, SCENE_LIST, hasUnit)).toEqual([]);
  });

  it('scenes for girls not in the roster yet are never queued or offered', () => {
    const noa = SCENE_LIST.find((s) => s.ifUnit && s.trigger?.after);
    if (!noa) return;
    const p = createProfile();
    clearUpTo(p, noa.trigger.after);
    const roster = (id) => id !== noa.ifUnit && hasUnit(id);
    expect(queueAfterClears(p, [noa.trigger.after], SCENE_LIST, roster)).not.toContain(noa.id);
    expect(episodeList(p, SCENE_LIST, roster).some((r) => r.id === noa.id)).toBe(false);
    const withHer = (id) => id === noa.ifUnit || hasUnit(id);
    expect(queueAfterClears(p, [noa.trigger.after], SCENE_LIST, withHer)).toContain(noa.id);
  });

  it('markSeen grants the first-read reward once; replays and repeats grant nothing; skipping counts', () => {
    const p = createProfile();
    const gems = p.currencies.gems;
    const r1 = markSeen(p, sceneById('ch1.mid'), { skipped: true });
    expect(r1).toEqual({ first: true, rewards: STORY_REWARDS.mid });
    expect(p.currencies.gems).toBe(gems + 20);
    expect(markSeen(p, sceneById('ch1.mid'))).toEqual({ first: false, rewards: [] });
    expect(p.currencies.gems).toBe(gems + 20);
    // the opening and the tutorial outro give no gems
    expect(markSeen(p, sceneById('opening')).rewards).toEqual([]);
    expect(markSeen(p, sceneById('tut.outro')).rewards).toEqual([]);
    expect(p.currencies.gems).toBe(gems + 20);
    // by id with a kind
    expect(markSeen(p, 'ch2.pro', { kind: 'prologue' }).rewards).toEqual([{ id: 'gems', count: 20 }]);
    expect(markSeen(p, null)).toEqual({ first: false, rewards: [] });
  });

  it('first-read rewards over the whole archive stay near 500 gems', () => {
    const p = createProfile();
    const gems = p.currencies.gems;
    for (const sc of SCENE_LIST) markSeen(p, sc);
    const earned = p.currencies.gems - gems;
    expect(earned).toBeGreaterThanOrEqual(400);
    expect(earned).toBeLessThanOrEqual(600);
  });

  it('episodeList: unlock states, requirements, episode numbers and NEW counts', () => {
    const p = createProfile();
    const rows = episodeList(p, SCENE_LIST, hasUnit);
    expect(rows.every((r) => r.scene.kind !== 'lesson')).toBe(true);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId.opening).toMatchObject({ unlocked: true, seen: false, isNew: true, episode: 1, chapter: 0 });
    expect(byId['tut.outro']).toMatchObject({ unlocked: true, episode: 2 });
    expect(byId['ch1.yuki']).toMatchObject({ unlocked: false, requirement: 'Clear 1-2 {stage:1-2}', firstReward: [{ id: 'gems', count: 20 }] });
    expect(byId['ch1.mid']).toMatchObject({ unlocked: false, requirement: 'Clear 1-4 {stage:1-4}' });
    expect(byId['ch2.pro'].requirement).toBe('Clear 1-5 {stage:1-5}');
    expect(unseenEpisodeCount(p, SCENE_LIST, hasUnit)).toBe(2);
    clearUpTo(p, '1-5');
    markSeen(p, sceneById('opening'));
    const after = Object.fromEntries(episodeList(p, SCENE_LIST, hasUnit).map((r) => [r.id, r]));
    expect(after.opening).toMatchObject({ seen: true, isNew: false, firstReward: [] });
    expect(after['ch1.epi']).toMatchObject({ unlocked: true, isNew: true, requirement: null });
    expect(after['ch2.pro'].unlocked).toBe(true); // 2-1 is open once 1-5 is cleared
    expect(after['ch2.mid'].unlocked).toBe(false);
    // every chapter's episodes number 1..n in archive order
    for (const ch of [0, ...CHAPTERS.map((c) => c.id)]) {
      const nums = rows.filter((r) => r.chapter === ch).map((r) => r.episode);
      expect(nums).toEqual(nums.map((_, i) => i + 1));
    }
    expect(episodeNumber(sceneById('ch1.mid'), SCENE_LIST, hasUnit)).toBe(byId['ch1.mid'].episode);
  });

  it('sceneUnlocked follows the trigger; lesson scenes are never unlocked by the archive', () => {
    const p = createProfile();
    expect(sceneUnlocked(p, sceneById('opening'))).toBe(true);
    expect(sceneUnlocked(p, sceneById('ch1.epi'))).toBe(false);
    expect(sceneUnlocked(p, { trigger: null })).toBe(true);
    for (const l of LESSON_SCENES) expect(sceneUnlocked(p, l)).toBe(false);
    expect(requirementFor({ trigger: { lesson: 'home' } })).toMatch(/Journal/);
    expect(requirementFor({ trigger: { before: '1-1' } })).toBeNull();
  });

  it('a fully cleared save can reach every episode of the archive', () => {
    const p = clearUpTo(createProfile(), CAMPAIGN_IDS[CAMPAIGN_IDS.length - 1]);
    const rows = episodeList(p, SCENE_LIST, hasUnit);
    expect(rows.length).toBeGreaterThanOrEqual(27);
    expect(rows.filter((r) => !r.unlocked)).toEqual([]);
  });
});

describe('choices are flavour only (T-content-6)', () => {
  it('recordChoice changes nothing but story.choices', () => {
    const p = createProfile();
    const before = JSON.parse(JSON.stringify(p));
    expect(recordChoice(p, 'opening', 1)).toBe(true);
    expect(recordChoice(p, 'opening', 7)).toBe(false);
    expect(recordChoice(p, 42, 0)).toBe(false);
    const after = JSON.parse(JSON.stringify(p));
    expect(after.story.choices).toEqual({ opening: 1 });
    after.story.choices = {};
    expect(after).toEqual(before);
  });
});

describe('bundle (T-bundle-1)', () => {
  it('save.js, story.js and storyTriggers.js never import the scene chunk', () => {
    for (const f of ['src/systems/save.js', 'src/systems/story.js', 'src/systems/storyTriggers.js', 'src/ui/story/install.js']) {
      const src = readFileSync(join(ROOT, f), 'utf8');
      const statics = [...src.matchAll(/^import[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
      expect(statics.filter((s) => /data\/story\/(index|scenes)/.test(s)), f).toEqual([]);
    }
  });

  it('main.js only loads the story UI lazily', () => {
    const src = readFileSync(join(ROOT, 'src/main.js'), 'utf8');
    const statics = [...src.matchAll(/^import[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    expect(statics.filter((s) => /story/.test(s))).toEqual([]);
    expect(src).toMatch(/import\(['"]\.\/ui\/story\/install\.js['"]\)/);
  });
});
