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
  requirementFor, unseenEpisodeCount, episodeNumber, ownedReady, ownedRequirementFor,
} from '../../src/systems/storyTriggers.js';
import { grantUnit } from '../../src/systems/unlocks.js';
import { resolveText } from '../../src/data/story/tokens.js';
import { lockedToast } from '../../src/ui/story/archive.js';
import { SCENE_LIST, sceneById, LESSON_SCENES } from '../../src/data/story/index.js';
import { STORY_REWARDS } from '../../src/data/story/lessons.js';
import { CAMPAIGN_IDS, CHAPTERS, STAGE_MAP, act2Stage } from '../../src/data/stages.js';
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
  delete raw.missions.counters['story:new']; // a save from before the story never had the mark
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
      choices: { 'ch1.mid': 1, 'ch2.mid': 9, 'NOT AN ID': 0, 'ch3.mid': 1.5 },
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

  it('a fully cleared save (owning the side scenes\' girls) can reach every episode of the archive', () => {
    const p = clearUpTo(createProfile(), CAMPAIGN_IDS[CAMPAIGN_IDS.length - 1]);
    grantUnit(p, 'fuu'); // g2.class waits for Ruri, Iroha, Ena or Fuu (ifOwned); g3.fuu for Fuu
    grantUnit(p, 'iroha'); // g3.iroha
    grantUnit(p, 'noa'); // g3.noa
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

describe('Act II order and two-key requirements (Gate Arc; docs/CAMPAIGN.md "Act II")', () => {
  // synthetic scenes: the queue sorts by (chapter, act, n) from the trigger id alone, so they work before 1-6 exists
  const SYN = [
    { id: 'syn.c2', kind: 'epilogue', chapter: 2, trigger: { after: '2-1' } },
    { id: 'syn.g1', kind: 'event', chapter: 1, act: 2, trigger: { after: '1-10' } },
    { id: 'syn.c1', kind: 'epilogue', chapter: 1, trigger: { after: '1-5' } },
    { id: 'syn.g1b', kind: 'event', chapter: 1, act: 2, trigger: { after: '1-6' } },
  ];

  it('a 1-10 after-scene plays before a waiting 2-1 one, and 1-5 before 1-6', () => {
    const p = createProfile();
    const added = queueAfterClears(p, ['2-1', '1-10', '1-5', '1-6'], SYN, hasUnit);
    expect(added).toEqual(['syn.c1', 'syn.g1b', 'syn.g1', 'syn.c2']);
    p.story.queue = ['syn.c2', 'syn.g1'];
    expect(nextQueued(p, SYN, hasUnit).id).toBe('syn.g1');
    markSeen(p, 'syn.g1', { kind: 'event' });
    expect(nextQueued(p, SYN, hasUnit).id).toBe('syn.c2');
  });

  it('requirementFor names both stages of a two-key x-6; a single-key stage reads as before', () => {
    const base = { name: 'Fixture', mapId: 'sakura_court', desc: 'x', budget: [8, 200], pool: [{ enemy: 'slime_green', weight: 1, from: 1 }], fam: ['charm', 'rune'], scenery: { props: ['x'] } };
    // keep whatever is registered (Act II stages land in stages.js) and put it back afterwards
    const had = { '2-6': STAGE_MAP['2-6'], '1-6': STAGE_MAP['1-6'] };
    STAGE_MAP['2-6'] = act2Stage({ ...base, id: '2-6' });
    STAGE_MAP['1-6'] = act2Stage({ ...base, id: '1-6' });
    try {
      expect(requirementFor({ trigger: { before: '2-6' } })).toBe('Clear 2-5 {stage:2-5} and 1-10 {stage:1-10}');
      expect(requirementFor({ trigger: { before: '1-6' } })).toBe('Clear 1-5 {stage:1-5}');
      expect(requirementFor({ trigger: { before: '2-1' } })).toBe('Clear 1-5 {stage:1-5}');
      const p = clearUpTo(createProfile(), '2-5');
      expect(sceneUnlocked(p, { trigger: { before: '2-6' } })).toBe(false); // 1-10 is still missing
      expect(sceneUnlocked(p, { trigger: { before: '1-6' } })).toBe(true);
    } finally {
      for (const [id, st] of Object.entries(had)) {
        if (st) STAGE_MAP[id] = st;
        else delete STAGE_MAP[id];
      }
    }
  });
});

describe('ifOwned episodes wait for a girl the player owns (g2.class: Ruri, Iroha, Ena or Fuu)', () => {
  const CLASS = ['ruri', 'iroha', 'ena', 'fuu'];
  /** A save that cleared 2-9 (an after-trigger reads progress only, so this needs no stage data) and owns none of them. */
  const at29 = () => {
    const p = createProfile();
    for (const id of CLASS) delete p.units[id];
    p.progress.stages['2-9'] = { clears: 1, easy: false, normal: true, hard: false, nightmare: false };
    return p;
  };

  it('stays queued while none is owned, plays once one is, and never twice', () => {
    const p = at29();
    const cls = sceneById('g2.class');
    expect([...cls.ifOwned]).toEqual(CLASS);
    expect(ownedReady(p, cls)).toBe(false);
    expect(queueAfterClears(p, ['2-9'], SCENE_LIST, hasUnit)).toEqual(['g2.class', 'g2.roof']);
    // the class is skipped, not dropped: the roof plays first
    expect(nextQueued(p, SCENE_LIST, hasUnit).id).toBe('g2.roof');
    markSeen(p, sceneById('g2.roof'));
    expect(nextQueued(p, SCENE_LIST, hasUnit)).toBeNull();
    expect(pruneQueue(p, SCENE_LIST, hasUnit)).toEqual(['g2.class']);
    expect(nextQueued(p, SCENE_LIST, hasUnit)).toBeNull(); // still waiting, still queued
    expect(p.story.queue).toEqual(['g2.class']);
    // the archive lists it, locked with the girls it needs (never NEW)
    let row = episodeList(p, SCENE_LIST, hasUnit).find((r) => r.id === 'g2.class');
    expect(row).toMatchObject({ unlocked: false, isNew: false, seen: false });
    expect(row.requirement).toBe('Needs {name:ruri}, {name:iroha}, {name:ena} or {name:fuu}');
    expect(resolveText(row.requirement)).toBe('Needs Ruri, Iroha, Ena or Fuu');
    expect(lockedToast(row.requirement)).toBe('Needs Ruri, Iroha, Ena or Fuu. Recruit one of them to unlock this episode.');
    expect(unseenEpisodeCount(p, SCENE_LIST, hasUnit)).toBe(episodeList(p, SCENE_LIST, hasUnit).filter((r) => r.isNew).length);
    // one of them joins (any one): it plays next
    grantUnit(p, 'ena');
    expect(ownedReady(p, cls)).toBe(true);
    expect(nextQueued(p, SCENE_LIST, hasUnit).id).toBe('g2.class');
    row = episodeList(p, SCENE_LIST, hasUnit).find((r) => r.id === 'g2.class');
    expect(row).toMatchObject({ unlocked: true, isNew: true, requirement: null });
    expect(markSeen(p, cls).first).toBe(true);
    // never twice: not queued again, not offered again, a repeat mark grants nothing
    expect(nextQueued(p, SCENE_LIST, hasUnit)).toBeNull();
    expect(queueAfterClears(p, ['2-9'], SCENE_LIST, hasUnit)).toEqual([]);
    expect(markSeen(p, cls)).toEqual({ first: false, rewards: [] });
    expect(episodeList(p, SCENE_LIST, hasUnit).find((r) => r.id === 'g2.class')).toMatchObject({ seen: true, isNew: false });
  });

  it('a waiting scene keeps its place behind later clears and plays in campaign order once owned', () => {
    const p = at29();
    queueAfterClears(p, ['2-9'], SCENE_LIST, hasUnit);
    p.progress.stages['2-10'] = { clears: 1, easy: false, normal: true, hard: false, nightmare: false };
    queueAfterClears(p, ['2-10'], SCENE_LIST, hasUnit);
    expect(nextQueued(p, SCENE_LIST, hasUnit).id).toBe('g2.roof');
    markSeen(p, sceneById('g2.roof'));
    expect(nextQueued(p, SCENE_LIST, hasUnit).id).toBe('g2.after'); // the class waits, the act goes on
    grantUnit(p, 'iroha');
    expect(nextQueued(p, SCENE_LIST, hasUnit).id).toBe('g2.class'); // 2-9 plays before 2-10's remaining scenes
  });

  it('the trigger still comes first: before 2-9 is cleared the card asks for the stage, not the girls', () => {
    const p = createProfile();
    grantUnit(p, 'fuu');
    const row = episodeList(p, SCENE_LIST, hasUnit).find((r) => r.id === 'g2.class');
    expect(row.unlocked).toBe(false);
    expect(row.requirement).toBe('Clear 2-9 {stage:2-9}');
  });

  it('Act 3\'s three side scenes (Iroha 3-7, Noa 3-9, Fuu 3-10) wait for their girl, then play once each', () => {
    const SIDES = { 'g3.iroha': 'iroha', 'g3.noa': 'noa', 'g3.fuu': 'fuu' };
    const p = createProfile();
    for (const id of Object.values(SIDES)) delete p.units[id];
    const clear = (id) => { p.progress.stages[id] = { clears: 1, easy: false, normal: true, hard: false, nightmare: false }; };
    for (const [id, girl] of Object.entries(SIDES)) expect([...sceneById(id).ifOwned], id).toEqual([girl]);
    // after-triggers read progress only, so this needs no stage data
    for (const st of ['3-7', '3-8', '3-9', '3-10']) clear(st);
    expect(queueAfterClears(p, ['3-7', '3-8', '3-9', '3-10'], SCENE_LIST, hasUnit)).toEqual([
      'g3.iroha', 'g3.hammer', 'g3.noa', 'g3.after', 'g3.fuu', 'g3.epi',
    ]);
    // the main episodes play in order; the sides are skipped, not dropped
    for (const id of ['g3.hammer', 'g3.after', 'g3.epi']) {
      expect(nextQueued(p, SCENE_LIST, hasUnit).id).toBe(id);
      markSeen(p, sceneById(id));
    }
    expect(nextQueued(p, SCENE_LIST, hasUnit)).toBeNull();
    expect(pruneQueue(p, SCENE_LIST, hasUnit)).toEqual(['g3.iroha', 'g3.noa', 'g3.fuu']);
    const rows = Object.fromEntries(episodeList(p, SCENE_LIST, hasUnit).map((r) => [r.id, r]));
    expect(rows['g3.iroha']).toMatchObject({ unlocked: false, isNew: false, requirement: 'Needs {name:iroha}' });
    expect(rows['g3.noa'].requirement).toBe('Needs {name:noa}');
    expect(resolveText(rows['g3.fuu'].requirement)).toBe('Needs Fuu');
    // each girl opens only her own scene, and each plays once
    grantUnit(p, 'noa');
    expect(nextQueued(p, SCENE_LIST, hasUnit).id).toBe('g3.noa');
    expect(markSeen(p, sceneById('g3.noa')).first).toBe(true);
    expect(nextQueued(p, SCENE_LIST, hasUnit)).toBeNull();
    grantUnit(p, 'fuu');
    grantUnit(p, 'iroha');
    expect(nextQueued(p, SCENE_LIST, hasUnit).id).toBe('g3.iroha'); // 3-7 before 3-10
    markSeen(p, sceneById('g3.iroha'));
    expect(nextQueued(p, SCENE_LIST, hasUnit).id).toBe('g3.fuu');
    markSeen(p, sceneById('g3.fuu'));
    expect(nextQueued(p, SCENE_LIST, hasUnit)).toBeNull();
    expect(queueAfterClears(p, ['3-7', '3-9', '3-10'], SCENE_LIST, hasUnit)).toEqual([]);
    for (const id of Object.keys(SIDES)) expect(markSeen(p, sceneById(id))).toEqual({ first: false, rewards: [] });
  });

  it('Act 4 plays in order after 4-7, 4-8 and 4-10; Azami\'s join plays once, whether or not the save already has her', () => {
    // after-triggers read progress only, so this needs no stage data
    const run = (ownsAzami) => {
      const p = createProfile();
      if (ownsAzami) grantUnit(p, 'azami'); // a save that met her at 2-2 (the legacy grant or the catch-up letter)
      else delete p.units.azami;
      for (const st of ['4-7', '4-8', '4-10']) p.progress.stages[st] = { clears: 1, easy: false, normal: true, hard: false, nightmare: false };
      expect(queueAfterClears(p, ['4-10', '4-8', '4-7'], SCENE_LIST, hasUnit)).toEqual([
        'g4.azami', 'g4.cross', 'g4.logs', 'g4.after', 'g4.epi',
      ]);
      const played = [];
      for (let sc = nextQueued(p, SCENE_LIST, hasUnit); sc; sc = nextQueued(p, SCENE_LIST, hasUnit)) {
        played.push(sc.id);
        expect(markSeen(p, sc).first, sc.id).toBe(true);
      }
      expect(played).toEqual(['g4.azami', 'g4.cross', 'g4.logs', 'g4.after', 'g4.epi']);
      // never twice: a second clear queues nothing, a repeat mark grants nothing
      expect(queueAfterClears(p, ['4-7'], SCENE_LIST, hasUnit)).toEqual([]);
      expect(markSeen(p, sceneById('g4.azami'))).toEqual({ first: false, rewards: [] });
      const row = episodeList(p, SCENE_LIST, hasUnit).find((r) => r.id === 'g4.azami');
      expect(row).toMatchObject({ unlocked: true, seen: true, isNew: false, requirement: null });
    };
    run(true);
    run(false);
  });

  it('a before-scene with ifOwned is offered only once a listed girl is owned; requirement text for one or many', () => {
    const p = clearUpTo(createProfile(), '1-1');
    for (const id of CLASS) delete p.units[id];
    const syn = [{ id: 'syn.owned', kind: 'event', chapter: 1, trigger: { before: '1-2' }, ifOwned: ['fuu'] }];
    expect(beforeSceneFor(p, '1-2', syn, hasUnit)).toBeNull();
    grantUnit(p, 'fuu');
    expect(beforeSceneFor(p, '1-2', syn, hasUnit)?.id).toBe('syn.owned');
    expect(ownedRequirementFor(syn[0])).toBe('Needs {name:fuu}');
    expect(ownedRequirementFor({ ifOwned: ['ruri', 'ena'] })).toBe('Needs {name:ruri} or {name:ena}');
    expect(ownedRequirementFor(sceneById('g2.roof'))).toBeNull();
    expect(ownedReady(p, sceneById('g2.roof'))).toBe(true);
  });
});
