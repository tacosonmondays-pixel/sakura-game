// CHAPTER_SCENE_IDS (src/data/story/sceneIndex.js) is the ids-only copy of the story chapters the achievements read,
// because systems code must never import the scene chunk. It must equal each chapter's archive episodes minus those
// with a scene-level `ifUnit` (they cannot play until their girl joins). This test is the one place that imports both.
import { describe, it, expect } from 'vitest';
import { CHAPTER_SCENE_IDS } from '../../src/data/story/sceneIndex.js';
import { SCENE_LIST } from '../../src/data/story/index.js';

describe('CHAPTER_SCENE_IDS', () => {
  it('equals each chapter\'s scenes from SCENE_LIST minus the scene-level ifUnit ones', () => {
    for (let c = 1; c <= 8; c++) {
      const want = SCENE_LIST.filter((s) => s.chapter === c && !s.ifUnit).map((s) => s.id);
      expect(CHAPTER_SCENE_IDS[c], `chapter ${c}`).toEqual(want);
    }
    expect(Object.keys(CHAPTER_SCENE_IDS).map(Number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('every chapter keeps at least one scene', () => {
    for (const ids of Object.values(CHAPTER_SCENE_IDS)) expect(ids.length).toBeGreaterThan(0);
  });

  it('the join scenes waiting for the roster merge are left out', () => {
    const waiting = SCENE_LIST.filter((s) => s.ifUnit).map((s) => s.id);
    expect(waiting.length).toBeGreaterThan(0);
    for (const id of waiting) expect(Object.values(CHAPTER_SCENE_IDS).flat()).not.toContain(id);
  });
});
