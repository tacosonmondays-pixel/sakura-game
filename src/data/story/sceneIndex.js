// Story scene ids per chapter, ids only (owner: story + achievements; docs/specs/ACHIEVEMENTS.md R24).
// src/systems/** must never import the scene chunk (./index.js), so the "Story Time" / "Storyteller"
// achievements read this table instead. It lists each chapter's archive episodes WITHOUT a scene-level
// `ifUnit` (those cannot play until their girl joins), and never changes when a girl joins, so a chapter's
// progress can't go backwards. tests/data/storySceneIndex.test.js checks it against the scene chunk.

export const CHAPTER_SCENE_IDS = Object.freeze({
  1: Object.freeze(['ch1.yuki', 'ch1.mid', 'ch1.epi']),
  2: Object.freeze(['ch2.pro', 'ch2.azami', 'ch2.mid', 'ch2.epi']),
  3: Object.freeze(['ch3.pro', 'ch3.umeko', 'ch3.mid', 'ch3.epi']),
  4: Object.freeze(['ch4.pro', 'ch4.yuzuha', 'ch4.mid', 'ch4.epi']),
  5: Object.freeze(['ch5.pro', 'ch5.mid', 'ch5.epi']),
  6: Object.freeze(['ch6.pro', 'ch6.mid', 'ch6.wakaba', 'ch6.epi']),
  7: Object.freeze(['ch7.pro', 'ch7.mid', 'ch7.epi']),
  8: Object.freeze(['ch8.pro', 'ch8.mid', 'ch8.epi']),
});

/**
 * Arc 1 episodes per act, keyed 'chapter:act' ('1:2' = chapter 1's Act II, the Gate Arc's Act 1), ids only, with the
 * same rules as CHAPTER_SCENE_IDS. Kept apart from CHAPTER_SCENE_IDS on purpose: a chapter's "Story Time" progress
 * never goes backwards when its Act II episodes ship. Filled as each act's scenes land (Act 1: seven episodes).
 */
export const ACT_SCENE_IDS = Object.freeze({
  '1:2': Object.freeze(['g1.pro', 'g1.mahiru', 'g1.yuzuha', 'g1.mid', 'g1.poster', 'g1.boss', 'g1.epi']),
});
