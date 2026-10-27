// Story triggers, the after-scene queue, "seen" bookkeeping and archive rows (owner: story; STORY_SPEC §1.4,
// §1.5, §5.2). Pure, Node-safe, no DOM. The scene list is always passed in (SCENE_LIST from the lazy scene
// chunk), so this module never imports scene text itself.
//
// Trigger kinds (format.js): { opening: true } | { tutorial: 'won' } | { before: stageId } | { after: stageId }
// | { lesson: id } | null (archive only).

import { stageOrderKey, stageRequires } from '../data/stages.js';
import { storyRewardFor } from '../data/story/lessons.js';
import { addItems } from './inventory.js';
import {
  storyOf, stageCleared, stageOpen, setOpening, markSceneSeen, SEEN_LIMIT, QUEUE_LIMIT,
} from './story.js';

/** Play order of a trigger stage: (chapter, act, n), so a 1-10 after-scene plays before a waiting 2-1 one. */
const playOrder = (stageId) => stageOrderKey(stageId);

const availableFor = (hasUnit) => (sc) => !sc.ifUnit || !hasUnit || !!hasUnit(sc.ifUnit);

/**
 * The trigger is satisfied, so the episode can be played (and replayed) from the archive:
 * before X → X is unlocked; after X → X is cleared; opening, tutorial and archive-only scenes → always;
 * lesson scenes → never here (the journal decides).
 * @returns {boolean}
 */
export function sceneUnlocked(profile, scene) {
  const t = scene?.trigger;
  if (!t) return true;
  if (t.opening || t.tutorial) return true;
  if (t.before) return stageOpen(profile, t.before);
  if (t.after) return stageCleared(profile, t.after);
  return false;
}

/**
 * The `before` scene to play when stage prep for `stageId` opens: unseen, the stage is unlocked and not yet
 * cleared (a legacy player is never shown backlog), and its `ifUnit` girl exists.
 * @param {object} profile
 * @param {string} stageId
 * @param {object[]} scenes archive list (SCENE_LIST)
 * @param {(id: string) => boolean} [hasUnit]
 * @returns {object|null} scene
 */
export function beforeSceneFor(profile, stageId, scenes, hasUnit) {
  if (!stageId || !stageOpen(profile, stageId) || stageCleared(profile, stageId)) return null;
  const s = storyOf(profile);
  const ok = availableFor(hasUnit);
  return (scenes || []).find((sc) => sc.trigger?.before === stageId && ok(sc) && !s.seen.includes(sc.id)) || null;
}

/**
 * First clears → queue their `after` scenes (play order: chapter, act, n; no duplicates, nothing already seen). The queue is
 * persisted in the profile, so a scene interrupted by closing the app plays again next session.
 * @param {object} profile
 * @param {Iterable<string>} newlyCleared stage ids cleared by the last battle
 * @param {object[]} scenes archive list
 * @param {(id: string) => boolean} [hasUnit]
 * @returns {string[]} ids added to the queue
 */
export function queueAfterClears(profile, newlyCleared, scenes, hasUnit) {
  const cleared = new Set(newlyCleared || []);
  if (!cleared.size) return [];
  const s = storyOf(profile);
  const ok = availableFor(hasUnit);
  const add = (scenes || [])
    .filter((sc) => sc.trigger?.after && cleared.has(sc.trigger.after) && ok(sc) && !s.seen.includes(sc.id) && !s.queue.includes(sc.id))
    .sort((a, b) => playOrder(a.trigger.after) - playOrder(b.trigger.after));
  const added = [];
  for (const sc of add) {
    if (s.queue.length >= QUEUE_LIMIT) break;
    s.queue.push(sc.id);
    added.push(sc.id);
  }
  return added;
}

/**
 * Drops unknown, seen and unavailable ids from the queue (in place).
 * @returns {string[]} the remaining queue
 */
export function pruneQueue(profile, scenes, hasUnit) {
  const s = storyOf(profile);
  const known = new Map((scenes || []).map((sc) => [sc.id, sc]));
  const ok = availableFor(hasUnit);
  s.queue = [...new Set(s.queue)].filter((id) => known.has(id) && ok(known.get(id)) && !s.seen.includes(id)).slice(0, QUEUE_LIMIT);
  return s.queue;
}

/**
 * The next queued after-scene, in play order (chapter, act, n) of its trigger stage.
 * @returns {object|null} scene
 */
export function nextQueued(profile, scenes, hasUnit) {
  const queue = pruneQueue(profile, scenes, hasUnit);
  if (!queue.length) return null;
  const byId = new Map((scenes || []).map((sc) => [sc.id, sc]));
  const sorted = [...queue].sort((a, b) => playOrder(byId.get(a)?.trigger?.after) - playOrder(byId.get(b)?.trigger?.after));
  return byId.get(sorted[0]) || null;
}

/**
 * An episode was read to the end or skipped. The first time it counts, it grants the first-read reward
 * (STORY_REWARDS by kind; skipping counts, as in most story players); a replay grants nothing. It leaves the queue.
 * The opening also updates story.opening.
 * @param {object} profile
 * @param {object|string} scene scene object, or its id (pass `kind` then)
 * @param {{ skipped?: boolean, kind?: string }} [opts]
 * @returns {{ first: boolean, rewards: Array<{id: string, count: number}> }}
 */
export function markSeen(profile, scene, { skipped = false, kind } = {}) {
  const id = typeof scene === 'string' ? scene : scene?.id;
  if (!id) return { first: false, rewards: [] };
  const sceneKind = typeof scene === 'object' ? scene.kind : kind;
  const s = storyOf(profile);
  s.queue = s.queue.filter((q) => q !== id);
  if (typeof scene === 'object' && scene.trigger?.opening) setOpening(profile, skipped ? 'skipped' : 'seen');
  if (s.seen.includes(id)) return { first: false, rewards: [] };
  s.seen.push(id);
  if (s.seen.length > SEEN_LIMIT) s.seen = s.seen.slice(-SEEN_LIMIT);
  markSceneSeen(profile, id); // its first-read reward never pays twice, even after an older build
  const rewards = sceneKind ? storyRewardFor(sceneKind) : [];
  if (rewards.length) addItems(profile, rewards);
  return { first: true, rewards };
}

/** Flavour only: stores the chosen option index for the log. Changes nothing else. */
export function recordChoice(profile, sceneId, index) {
  if (typeof sceneId !== 'string' || !Number.isInteger(index) || index < 0 || index > 2) return false;
  storyOf(profile).choices[sceneId] = index;
  return true;
}

/**
 * Requirement shown on a locked archive card (tokens resolve through src/data/story/tokens.js). A `before` scene names
 * every stage its stage needs (an Act II x-6 needs two).
 * @returns {string|null} e.g. "Clear 2-5 {stage:2-5}" → "Clear 2-5 Basilisk Moon";
 *   "Clear 2-5 {stage:2-5} and 1-10 {stage:1-10}" for a two-key stage
 */
export function requirementFor(scene) {
  const t = scene?.trigger;
  if (!t) return null;
  if (t.after) return `Clear ${t.after} {stage:${t.after}}`;
  if (t.before) {
    const req = stageRequires(t.before);
    return req.length ? `Clear ${req.map((id) => `${id} {stage:${id}}`).join(' and ')}` : null;
  }
  if (t.lesson) return "Unlocks in the Captain's Journal";
  return null;
}

/**
 * Archive rows for every playable episode, in campaign order.
 * @param {object} profile
 * @param {object[]} scenes archive list (SCENE_LIST; lesson scenes are skipped)
 * @param {(id: string) => boolean} [hasUnit]
 * @returns {Array<{ id, chapter, kind, title, episode, unlocked, seen, isNew, requirement, firstReward, scene }>}
 */
export function episodeList(profile, scenes, hasUnit) {
  const s = storyOf(profile);
  const ok = availableFor(hasUnit);
  const counters = {};
  const rows = [];
  for (const sc of scenes || []) {
    if (sc.kind === 'lesson' || !ok(sc)) continue;
    counters[sc.chapter] = (counters[sc.chapter] || 0) + 1;
    const unlocked = sceneUnlocked(profile, sc);
    const seen = s.seen.includes(sc.id);
    rows.push({
      id: sc.id,
      chapter: sc.chapter,
      kind: sc.kind,
      title: sc.title,
      episode: counters[sc.chapter],
      unlocked,
      seen,
      isNew: unlocked && !seen,
      requirement: unlocked ? null : requirementFor(sc),
      firstReward: seen ? [] : storyRewardFor(sc.kind),
      scene: sc,
    });
  }
  return rows;
}

/** @returns {number} unlocked episodes the player has not read yet (archive NEW dots) */
export function unseenEpisodeCount(profile, scenes, hasUnit) {
  return episodeList(profile, scenes, hasUnit).filter((r) => r.isNew).length;
}

/** @returns {number} the episode's number inside its chapter (archive order, 1-based), or 0 */
export function episodeNumber(scene, scenes, hasUnit) {
  if (!scene) return 0;
  const ok = availableFor(hasUnit);
  const list = (scenes || []).filter((sc) => sc.chapter === scene.chapter && sc.kind !== 'lesson' && ok(sc));
  return list.findIndex((sc) => sc.id === scene.id) + 1;
}
