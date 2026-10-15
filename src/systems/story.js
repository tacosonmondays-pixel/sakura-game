// Story state in the profile (owner: story; STORY_SPEC §5.1–5.2). Pure, Node-safe, no DOM.
//
// profile.story is added by createProfile (newStory) and carried + repaired by migrateProfile (cleanStory).
// No SAVE_VERSION bump: a save without the block was made before this feature, so it is "legacy" — nothing is
// forced on it and every feature it already had stays open. Everything else reads the block lazily through
// storyOf(profile), which also covers profiles built by other code paths.
//
// Marks in missions.counters (= 1) outlive an older build that drops profile.story when it rewrites the save
// (an old cached tab, a rollback deploy, an older desktop app on the same address: they all keep missions.counters
// word for word, as Potential's 'pot:' and Freeplay's 'fpm:' copies rely on): 'story:new' (created with the story,
// so not legacy), 'story:ann' (the legacy summary toast was shown), 'sl:<lesson>' (its reward was claimed) and
// 'ss:<scene>' (read or skipped: its first-read reward was paid). restoreStory rebuilds the block from them.
//
// Kept light on purpose: save.js imports this file, so it only imports small data modules (and systems save.js
// already pulls in) and NEVER the scene chunk (the story index and its scene files). Scene-aware logic lives in
// src/systems/storyTriggers.js.

import { STAGE_MAP, CAMPAIGN_IDS } from '../data/stages.js';
import { DIFFICULTY_ORDER } from '../data/types.js';
import { UNIT_MAP } from '../data/units.js';
import { LESSONS, LESSON_IDS, LESSON_MAP, FEATURE_GATES, WELCOME_MAIL, JOURNAL_TEXT } from '../data/story/lessons.js';
import { deliverMail } from './mail.js';
import { addItems } from './inventory.js';

export const STORY_VERSION = 1;
export const WELCOME_MAIL_ID = 'story-welcome-10pull';
/** Caps that keep a hand-edited or imported save small. */
export const SEEN_LIMIT = 500;
export const QUEUE_LIMIT = 10;

export const OPENING_STATES = ['pending', 'seen', 'skipped', 'legacy'];
export const TUTORIAL_STATES = ['pending', 'done', 'skipped', 'legacy'];
export const WELCOME_STATES = ['pending', 'mailed', 'legacy'];
/** Type-on speeds of the scene player (characters per second; Infinity = instant). */
export const TEXT_SPEEDS = { slow: 25, normal: 45, fast: 90, instant: Infinity };
export const SPEED_IDS = Object.keys(TEXT_SPEEDS);

/** The first battle: the real 1-1 on Easy with Hikari's coach (STORY_SPEC §2.3). */
export const TUTORIAL_STAGE = '1-1';
export const TUTORIAL_DIFFICULTY = 'easy';

const SCENE_ID_RE = /^[a-z0-9]+(\.[a-z0-9]+)*$/;
const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

/** missions.counters marks (see the header): created with the story; the legacy summary toast was shown. */
export const STORY_NEW_MARK = 'story:new';
export const STORY_ANNOUNCED_MARK = 'story:ann';
/** missions.counters mark prefixes: a claimed lesson ('sl:' + id), a scene read or skipped ('ss:' + id). */
export const LESSON_MARK = 'sl:';
export const SEEN_MARK = 'ss:';

/** profile.missions.counters, created on demand. */
function marks(profile) {
  const m = isObj(profile.missions) ? profile.missions : (profile.missions = {});
  return isObj(m.counters) ? m.counters : (m.counters = {});
}

const marked = (counters, key) => isObj(counters) && typeof counters[key] === 'number' && counters[key] > 0;

/** Ids after `prefix` among the set marks. */
const markedIds = (counters, prefix) => (isObj(counters)
  ? Object.keys(counters).filter((k) => k.startsWith(prefix) && marked(counters, k)).map((k) => k.slice(prefix.length))
  : []);

export function defaultPrefs() {
  return { speed: 'normal', auto: false };
}

/** A fresh save (createProfile): the opening and the tutorial are still ahead. */
export function newStory() {
  return {
    v: STORY_VERSION,
    legacy: false,
    opening: 'pending',
    tutorial: 'pending',
    welcome: 'pending',
    announced: false,
    seen: [],
    queue: [],
    lessons: {},
    choices: {},
    prefs: defaultPrefs(),
  };
}

/** A save from before the story existed: nothing forced, no welcome pull (it got the creation ticket). */
export function legacyStory() {
  return { ...newStory(), legacy: true, opening: 'legacy', tutorial: 'legacy', welcome: 'legacy' };
}

const sceneIds = (v, limit) => (Array.isArray(v)
  ? [...new Set(v.filter((x) => typeof x === 'string' && x.length <= 64 && SCENE_ID_RE.test(x)))].slice(0, limit)
  : []);

function cleanLessons(raw) {
  const out = {};
  if (!isObj(raw)) return out;
  for (const id of LESSON_IDS) {
    const l = raw[id];
    if (!isObj(l)) continue;
    const at = typeof l.at === 'number' && Number.isFinite(l.at) && l.at >= 0 ? l.at : 0;
    out[id] = { at, quiet: l.quiet === true, read: l.read === true, claimed: l.claimed === true };
  }
  return out;
}

function cleanChoices(raw) {
  const out = {};
  if (!isObj(raw)) return out;
  for (const [id, v] of Object.entries(raw)) {
    if (!SCENE_ID_RE.test(id) || id.length > 64) continue;
    if (Number.isInteger(v) && v >= 0 && v <= 2) out[id] = v;
  }
  return out;
}

/**
 * migrateProfile: repairs a stored story block. A missing or non-object block means the save predates the
 * story (legacy). Bad enums never force the opening or tutorial again (they become 'skipped'). Never throws.
 * @param {any} raw
 * @returns {object} story block
 */
export function cleanStory(raw) {
  if (!isObj(raw)) return legacyStory();
  const legacy = raw.legacy === true;
  const s = legacy ? legacyStory() : newStory();
  const pick = (v, list, bad) => (list.includes(v) ? v : bad);
  s.opening = pick(raw.opening, OPENING_STATES, legacy ? 'legacy' : 'skipped');
  s.tutorial = pick(raw.tutorial, TUTORIAL_STATES, legacy ? 'legacy' : 'skipped');
  // a damaged welcome state stays claimable on a new save: mail.delivered still guards the one grant
  s.welcome = pick(raw.welcome, WELCOME_STATES, legacy ? 'legacy' : 'pending');
  s.announced = raw.announced === true;
  s.seen = sceneIds(raw.seen, SEEN_LIMIT);
  s.queue = sceneIds(raw.queue, QUEUE_LIMIT).filter((id) => !s.seen.includes(id));
  s.lessons = cleanLessons(raw.lessons);
  s.choices = cleanChoices(raw.choices);
  const prefs = isObj(raw.prefs) ? raw.prefs : {};
  s.prefs = { speed: SPEED_IDS.includes(prefs.speed) ? prefs.speed : 'normal', auto: prefs.auto === true };
  return s;
}

/**
 * migrateProfile: the story block from the stored one and the missions.counters marks (see the header). A save
 * without a block is legacy unless 'story:new' says it was created with the story: then an older build dropped
 * the block, and it comes back as a new player's who is past the opening (nothing forced again; the welcome pull
 * still due unless its letter was delivered). Claimed lessons, read scenes and the legacy toast come back from
 * their marks either way. Never throws.
 * @param {any} raw profile.story as stored
 * @param {object} [counters] the migrated profile's missions.counters
 * @param {string[]} [delivered] the migrated profile's mail.delivered
 * @returns {object} story block
 */
export function restoreStory(raw, counters = null, delivered = []) {
  let s;
  if (isObj(raw)) s = cleanStory(raw);
  else if (marked(counters, STORY_NEW_MARK)) {
    s = newStory();
    s.opening = 'skipped';
    s.tutorial = 'skipped';
    s.welcome = Array.isArray(delivered) && delivered.includes(WELCOME_MAIL_ID) ? 'mailed' : 'pending';
  } else s = legacyStory();
  for (const id of markedIds(counters, LESSON_MARK)) {
    if (!LESSON_MAP[id]) continue;
    const l = s.lessons[id] || { at: 0, quiet: s.legacy, read: true, claimed: true };
    s.lessons[id] = { ...l, read: true, claimed: true };
  }
  const seen = markedIds(counters, SEEN_MARK).filter((id) => id.length <= 64 && SCENE_ID_RE.test(id) && !s.seen.includes(id));
  if (seen.length) {
    s.seen = [...s.seen, ...seen].slice(-SEEN_LIMIT);
    s.queue = s.queue.filter((id) => !s.seen.includes(id));
  }
  if (marked(counters, STORY_ANNOUNCED_MARK)) s.announced = true;
  return s;
}

/** Writes the missions.counters marks of the profile's story block (migrateProfile; idempotent). */
export function markStory(profile) {
  if (!isObj(profile?.story)) return;
  const s = profile.story;
  const c = marks(profile);
  if (s.legacy !== true) c[STORY_NEW_MARK] = 1;
  if (s.announced === true) c[STORY_ANNOUNCED_MARK] = 1;
  if (isObj(s.lessons)) for (const [id, l] of Object.entries(s.lessons)) if (l?.claimed === true) c[LESSON_MARK + id] = 1;
  if (Array.isArray(s.seen)) for (const id of s.seen) if (typeof id === 'string') c[SEEN_MARK + id] = 1;
}

/** A scene was read or skipped (storyTriggers markSeen): its mark survives an older build. */
export function markSceneSeen(profile, sceneId) {
  if (isObj(profile) && typeof sceneId === 'string' && sceneId) marks(profile)[SEEN_MARK + sceneId] = 1;
}

/** The legacy summary toast was shown (once per save). */
export function markAnnounced(profile) {
  if (!isObj(profile)) return;
  storyOf(profile).announced = true;
  marks(profile)[STORY_ANNOUNCED_MARK] = 1;
}

function looksClean(s) {
  return isObj(s) && s.v === STORY_VERSION && Array.isArray(s.seen) && Array.isArray(s.queue)
    && isObj(s.lessons) && isObj(s.choices) && isObj(s.prefs) && typeof s.opening === 'string';
}

/**
 * The profile's story block, created lazily: a profile without one is a legacy save. A damaged block is
 * repaired in place. Always use this instead of reading profile.story directly.
 * @param {object} profile
 * @returns {object}
 */
export function storyOf(profile) {
  if (!isObj(profile)) return legacyStory();
  if (!isObj(profile.story)) profile.story = legacyStory();
  else if (!looksClean(profile.story)) profile.story = cleanStory(profile.story);
  return profile.story;
}

/** @returns {boolean} the stage was cleared on any difficulty */
export function stageCleared(profile, stageId) {
  const e = profile?.progress?.stages?.[stageId];
  return !!e && DIFFICULTY_ORDER.some((d) => e[d]);
}

/** Same rule as systems/unlocks.js isStageUnlocked (kept local: unlocks.js imports save.js). */
export function stageOpen(profile, stageId) {
  const stage = STAGE_MAP[stageId];
  if (!stage) return false;
  return !stage.requires || stageCleared(profile, stage.requires);
}

/** @returns {Set<string>} campaign stage ids cleared on any difficulty */
export function clearedCampaign(profile) {
  return new Set(CAMPAIGN_IDS.filter((id) => stageCleared(profile, id)));
}

/**
 * Where a new player must go before the lobby: the "Meet Hikari" opening while it is still pending.
 * @returns {{ name: string, params: object } | null}
 */
export function onboardingRoute(profile) {
  const s = storyOf(profile);
  if (s.legacy || s.opening !== 'pending') return null;
  return { name: 'scene', params: { id: 'opening', next: 'tutorial' } };
}

/** The coached first battle (route params for router.navigate). */
export function tutorialRoute() {
  return { name: 'battle', params: { stage: TUTORIAL_STAGE, difficulty: TUTORIAL_DIFFICULTY, tutorial: '1' } };
}

/** Opening finished or skipped. Never moves back to 'pending'. @returns {boolean} changed */
export function setOpening(profile, state) {
  if (state !== 'seen' && state !== 'skipped') return false;
  const s = storyOf(profile);
  if (s.opening === state || s.opening === 'legacy') return false;
  // a skipped opening that is later read in full counts as seen; a seen one stays seen
  if (s.opening === 'seen') return false;
  s.opening = state;
  return true;
}

/** Tutorial done or skipped. Never moves back to 'pending'. @returns {boolean} changed */
export function setTutorial(profile, state) {
  if (state !== 'done' && state !== 'skipped') return false;
  const s = storyOf(profile);
  if (s.tutorial === state || s.tutorial === 'legacy' || s.tutorial === 'done') return false;
  s.tutorial = state;
  return true;
}

/**
 * The 1-1 stage prep prompt ("Shall we finish our first lesson together?") is due: a new player met Hikari
 * (opening seen or skipped) but left the coached battle before winning it or skipping it.
 * @returns {boolean}
 */
export function tutorialPromptDue(profile, stageId = TUTORIAL_STAGE) {
  const s = storyOf(profile);
  return stageId === TUTORIAL_STAGE && !s.legacy && s.tutorial === 'pending' && (s.opening === 'seen' || s.opening === 'skipped');
}

/** `?onboarding=0` (e2e / screenshots): mark a pending opening and tutorial skipped. @returns {boolean} changed */
export function skipOnboarding(profile) {
  const a = storyOf(profile).opening === 'pending' && setOpening(profile, 'skipped');
  const b = storyOf(profile).tutorial === 'pending' && setTutorial(profile, 'skipped');
  return !!(a || b);
}

/** Scene player preferences. Unknown values are ignored. @returns {object} prefs */
export function setStoryPrefs(profile, { speed, auto } = {}) {
  const p = storyOf(profile).prefs;
  if (SPEED_IDS.includes(speed)) p.speed = speed;
  if (typeof auto === 'boolean') p.auto = auto;
  return p;
}

/** @returns {boolean} the scene was marked seen (done or skipped) */
export function sceneSeen(profile, sceneId) {
  return storyOf(profile).seen.includes(sceneId);
}

// ---- Captain's Journal (STORY_SPEC §3) -------------------------------------------------------------------

/** {name:<id>} only (the welcome letter is stored as plain text; the journal UI resolves every token itself). */
const fillNames = (text) => String(text).replace(/\{name:([a-z0-9_]+)\}/g, (m, id) => UNIT_MAP[id]?.name ?? m);

/** The lesson's unlock condition holds right now (tutorial done/skipped/legacy, or its stage cleared). */
function lessonDue(profile, lesson) {
  if (lesson.unlock.tutorial) {
    const s = storyOf(profile);
    return s.legacy || s.tutorial !== 'pending';
  }
  return stageCleared(profile, lesson.unlock.stage);
}

/** @returns {boolean} the lesson is unlocked (recorded, or its condition already holds) */
export function lessonUnlocked(profile, id) {
  const lesson = LESSON_MAP[id];
  if (!lesson) return false;
  return !!storyOf(profile).lessons[id] || lessonDue(profile, lesson);
}

/**
 * The welcome 10-pull (§3.4): mailed once when 1-3 is cleared on a new save. Guarded twice: story.welcome must
 * still be 'pending' (legacy saves are 'legacy': they got the creation ticket) AND the mail id must never have
 * been delivered (an import that reset the story block still cannot regrant it).
 * @returns {boolean} the letter was delivered now
 */
export function deliverWelcome(profile, now = Date.now()) {
  const s = storyOf(profile);
  if (s.legacy || s.welcome !== 'pending' || !stageCleared(profile, LESSON_MAP.recruit.unlock.stage)) return false;
  if ((profile.mail?.delivered || []).includes(WELCOME_MAIL_ID)) {
    s.welcome = 'mailed';
    return false;
  }
  const letter = deliverMail(profile, {
    id: WELCOME_MAIL_ID,
    from: fillNames(WELCOME_MAIL.from),
    title: fillNames(WELCOME_MAIL.title),
    body: fillNames(WELCOME_MAIL.body),
    rewards: WELCOME_MAIL.rewards,
  }, now);
  s.welcome = 'mailed';
  return !!letter;
}

/**
 * Unlocks every lesson whose condition holds and mails the welcome pull. Idempotent. Legacy saves unlock
 * quietly (one summary toast instead of one per lesson).
 * @returns {{ unlocked: string[], quiet: boolean, mailed: boolean }}
 */
export function checkLessons(profile, now = Date.now()) {
  const s = storyOf(profile);
  const unlocked = [];
  for (const lesson of LESSONS) {
    if (s.lessons[lesson.id] || !lessonDue(profile, lesson)) continue;
    s.lessons[lesson.id] = { at: now, quiet: s.legacy, read: false, claimed: false };
    unlocked.push(lesson.id);
  }
  const mailed = deliverWelcome(profile, now);
  return { unlocked, quiet: s.legacy, mailed };
}

/** Lessons delivered by mail have nothing to claim in the journal. */
const mailOnly = (lesson) => lesson.via === 'mail';

/**
 * Journal rows, in lesson order.
 * @returns {Array<object>} { ...lesson, unlocked, read, claimed, claimable, mailOnly, requirement }
 */
export function lessonList(profile) {
  const s = storyOf(profile);
  return LESSONS.map((lesson) => {
    const st = s.lessons[lesson.id];
    const unlocked = !!st;
    return {
      ...lesson,
      unlocked,
      read: !!st?.read,
      claimed: !!st?.claimed,
      claimable: unlocked && !st.claimed && !mailOnly(lesson) && lesson.rewards.length > 0,
      mailOnly: mailOnly(lesson),
      requirement: lesson.unlock.tutorial ? JOURNAL_TEXT.requirementTutorial : JOURNAL_TEXT.requirement(lesson.unlock.stage),
    };
  });
}

/** Opening a lesson marks it read. @returns {{ ok: boolean, error?: 'locked'|'unknown', changed?: boolean }} */
export function readLesson(profile, id) {
  if (!LESSON_MAP[id]) return { ok: false, error: 'unknown' };
  const st = storyOf(profile).lessons[id];
  if (!st) return { ok: false, error: 'locked' };
  const changed = !st.read;
  st.read = true;
  return { ok: true, changed };
}

/**
 * Pays a lesson's rewards once.
 * @returns {{ ok: boolean, error?: 'locked'|'claimed'|'unknown'|'mailOnly', rewards: object[] }}
 */
export function claimLesson(profile, id) {
  const lesson = LESSON_MAP[id];
  if (!lesson) return { ok: false, error: 'unknown', rewards: [] };
  if (mailOnly(lesson)) return { ok: false, error: 'mailOnly', rewards: [] };
  const st = storyOf(profile).lessons[id];
  if (!st) return { ok: false, error: 'locked', rewards: [] };
  if (st.claimed) return { ok: false, error: 'claimed', rewards: [] };
  st.claimed = true;
  st.read = true;
  marks(profile)[LESSON_MARK + id] = 1; // survives an older build dropping profile.story
  return { ok: true, rewards: addItems(profile, lesson.rewards) };
}

/** @returns {number} unlocked lessons not opened yet */
export function unreadLessonCount(profile) {
  return lessonList(profile).filter((l) => l.unlocked && !l.read).length;
}

/** @returns {number} unlocked lessons with rewards still waiting */
export function claimableLessonCount(profile) {
  return lessonList(profile).filter((l) => l.claimable).length;
}

/** @returns {boolean} the journal deserves a red dot */
export function journalDot(profile) {
  return unreadLessonCount(profile) + claimableLessonCount(profile) > 0;
}

/** The profile already shows the player uses a gated feature (never hide what they have). */
function usedEvidence(profile, featureId) {
  const items = Object.entries(profile?.items || {}).filter(([, n]) => n > 0).map(([id]) => id);
  if (featureId === 'gear') {
    return Object.keys(profile?.gear || {}).length > 0 || items.some((id) => id.startsWith('gearbox_'));
  }
  if (featureId === 'awaken') {
    return Object.values(profile?.units || {}).some((u) => (u?.awaken || 0) > 0) || items.some((id) => id.startsWith('crown_'));
  }
  return false;
}

/**
 * Hard feature gates on new saves (§3.3, D8): 'gear' (Student → Equipment) and 'awaken' (Student → Awakening).
 * Any lesson id works too (open once that lesson is unlocked). Legacy saves: always open.
 * @returns {boolean}
 */
export function featureOpen(profile, featureId) {
  const s = storyOf(profile);
  if (s.legacy) return true;
  const gate = FEATURE_GATES[featureId];
  if (gate) return lessonUnlocked(profile, gate.lesson) || usedEvidence(profile, featureId);
  if (LESSON_MAP[featureId]) return lessonUnlocked(profile, featureId);
  return true;
}

/** The locked-feature line (story tokens unresolved: resolve with src/data/story/tokens.js). */
export function featureLockText(featureId) {
  return JOURNAL_TEXT.lockText(featureId);
}

/** The stage that opens a gated feature. @returns {string|null} */
export function featureStage(featureId) {
  return FEATURE_GATES[featureId]?.stage ?? null;
}

/** Legacy saves see one summary toast the first time the journal exists. @returns {number} lessons (0 = none due) */
export function legacyAnnounceDue(profile) {
  const s = storyOf(profile);
  if (!s.legacy || s.announced) return 0;
  return lessonList(profile).filter((l) => l.unlocked).length;
}
