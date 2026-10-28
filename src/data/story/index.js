// Story scene registry (owner: story; STORY_SPEC §1.1). The one lazy chunk with every scene's text:
// src/ui/story/install.js loads it with import('../../data/story/index.js'). src/systems/** never imports it.
//
//   SCENES            id → scene (archive episodes and lesson mini-scenes)
//   SCENE_LIST        archive episodes in campaign order (opening, tutorial outro, chapters 1–8)
//   LESSON_SCENES     the journal's "Hikari explains" mini-scenes (never auto-played, no reward)
//   sceneAvailable    false while a scene's `ifUnit` girl is not in the roster yet (feature/roster adds her)

import opening from './scenes/opening.js';
import ch1 from './scenes/ch1.js';
import g1 from './scenes/g1.js';
import ch2 from './scenes/ch2.js';
import g2 from './scenes/g2.js';
import ch3 from './scenes/ch3.js';
import ch4 from './scenes/ch4.js';
import ch5 from './scenes/ch5.js';
import ch6 from './scenes/ch6.js';
import ch7 from './scenes/ch7.js';
import ch8 from './scenes/ch8.js';
import lessonScenes from './scenes/lessons.js';

// Gate Arc episodes (gN, chapter N's Act II) are filed right after chapter N's own: the archive tab stays by chapter
// and the mystery lint reads them in play order
const ALL = [...opening, ...ch1, ...g1, ...ch2, ...g2, ...ch3, ...ch4, ...ch5, ...ch6, ...ch7, ...ch8, ...lessonScenes];

export const SCENES = {};
for (const s of ALL) {
  if (SCENES[s.id]) throw new Error(`story: duplicate scene id "${s.id}"`);
  SCENES[s.id] = s;
}
Object.freeze(SCENES);

/** Archive episodes, in the order they play through the campaign. */
export const SCENE_LIST = Object.freeze(ALL.filter((s) => s.kind !== 'lesson'));
/** Journal mini-scenes (trigger { lesson: id }). */
export const LESSON_SCENES = Object.freeze(ALL.filter((s) => s.kind === 'lesson'));

/** @returns {object|null} */
export function sceneById(id) {
  return SCENES[id] || null;
}

/**
 * Scenes whose trigger has the given key ('opening' | 'tutorial' | 'before' | 'after' | 'lesson'),
 * optionally matching its value (e.g. scenesWithTrigger('after', '1-5') → [ch1.epi]). Archive order.
 */
export function scenesWithTrigger(kind, value) {
  return ALL.filter((s) => s.trigger && Object.prototype.hasOwnProperty.call(s.trigger, kind)
    && (value === undefined || s.trigger[kind] === value));
}

/** @returns {object[]} a chapter's archive episodes (0 = opening + tutorial outro) */
export function chapterScenes(chapter) {
  return SCENE_LIST.filter((s) => s.chapter === chapter);
}

/**
 * A scene plays only when its `ifUnit` girl exists. Lines with `ifUnit` are filtered separately by the player
 * (format.js playableLines).
 * @param {object} sc
 * @param {(id: string) => boolean} hasUnit
 */
export function sceneAvailable(sc, hasUnit) {
  return !sc.ifUnit || !!hasUnit(sc.ifUnit);
}

export { playableLines, spokenCount, forEachLine } from './format.js';
export { resolveText } from './tokens.js';
