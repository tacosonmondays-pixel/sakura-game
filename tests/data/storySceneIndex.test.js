// CHAPTER_SCENE_IDS (src/data/story/sceneIndex.js) is the ids-only copy of the story chapters the achievements read,
// because systems code must never import the scene chunk. It must equal each chapter's archive episodes minus those
// with a scene-level `ifUnit` (they cannot play until their girl joins). This test is the one place that imports both.
import { describe, it, expect } from 'vitest';
import { CHAPTER_SCENE_IDS, ACT_SCENE_IDS } from '../../src/data/story/sceneIndex.js';
import { SCENE_LIST } from '../../src/data/story/index.js';

describe('CHAPTER_SCENE_IDS', () => {
  it('equals each chapter\'s Act I scenes from SCENE_LIST minus the scene-level ifUnit ones', () => {
    for (let c = 1; c <= 8; c++) {
      const want = SCENE_LIST.filter((s) => s.chapter === c && (s.act ?? 1) === 1 && !s.ifUnit).map((s) => s.id);
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

describe('ACT_SCENE_IDS (Gate Arc episodes per act, kept apart so Story Time never goes backwards)', () => {
  it("'chapter:act' keys list exactly that act's scenes from SCENE_LIST minus the ifUnit ones", () => {
    for (const [key, ids] of Object.entries(ACT_SCENE_IDS)) {
      const [c, act] = key.split(':').map(Number);
      expect(act, key).toBeGreaterThan(1);
      const want = SCENE_LIST.filter((s) => s.chapter === c && (s.act ?? 1) === act && !s.ifUnit).map((s) => s.id);
      expect(ids, key).toEqual(want);
    }
    // every Act II scene in the chunk is indexed
    const indexed = new Set(Object.values(ACT_SCENE_IDS).flat());
    for (const s of SCENE_LIST.filter((x) => (x.act ?? 1) > 1 && !x.ifUnit)) expect(indexed.has(s.id), s.id).toBe(true);
    expect(Object.keys(ACT_SCENE_IDS)).toEqual(['1:2', '2:2', '3:2', '4:2', '5:2', '6:2']);
    expect(ACT_SCENE_IDS['2:2']).toHaveLength(11);
    expect(ACT_SCENE_IDS['3:2']).toHaveLength(9);
    expect(ACT_SCENE_IDS['4:2']).toHaveLength(7);
    expect(ACT_SCENE_IDS['5:2']).toHaveLength(9);
    // Act 6: six cutscenes, g6.sleep, g6.doorie, and the duo's two scenes around the side stage side-6-starfall
    expect(ACT_SCENE_IDS['6:2']).toHaveLength(10);
    expect(ACT_SCENE_IDS['6:2'].slice(-2)).toEqual(['g6.star1', 'g6.star2']);
  });

  it('an ifOwned episode is listed (it always exists in code; only its playback waits for an owned girl)', () => {
    const owned = SCENE_LIST.filter((s) => s.ifOwned).map((s) => s.id);
    expect(owned).toEqual(['g2.class', 'g3.iroha', 'g3.noa', 'g3.fuu']);
    for (const id of owned) expect(Object.values(ACT_SCENE_IDS).flat()).toContain(id);
  });

  it('never shares an id with CHAPTER_SCENE_IDS', () => {
    const act1 = new Set(Object.values(CHAPTER_SCENE_IDS).flat());
    for (const id of Object.values(ACT_SCENE_IDS).flat()) expect(act1.has(id), id).toBe(false);
  });
});
