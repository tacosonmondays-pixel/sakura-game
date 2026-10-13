// Story state in the profile (owner: story; STORY_SPEC §5.1–5.2). Pure, Node-safe, no DOM.
//
// profile.story is added by createProfile (newStory) and carried + repaired by migrateProfile (cleanStory).
// No SAVE_VERSION bump: a save without the block was made before this feature, so it is "legacy" — nothing is
// forced on it and every feature it already had stays open. Everything else reads the block lazily through
// storyOf(profile), which also covers profiles built by other code paths.
//
// Kept light on purpose: save.js imports this file, so it only imports small data modules and NEVER the scene
// chunk (the story index and its scene files). Scene-aware logic lives in src/systems/storyTriggers.js.

import { STAGE_MAP, CAMPAIGN_IDS } from '../data/stages.js';
import { DIFFICULTY_ORDER } from '../data/types.js';
import { LESSON_IDS } from '../data/story/lessons.js';

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
