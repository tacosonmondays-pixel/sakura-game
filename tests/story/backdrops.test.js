// Story backdrops (Oct 27 set): every background a scene shows resolves to a real picture, every campaign stage
// has its painted place, no scene is left on the old academy painting where the stage -> place table names a
// place, and every file under public/art/lobby/story/ is listed (no orphan art ships).
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { SCENES } from '../../src/data/story/index.js';
import { forEachLine } from '../../src/data/story/format.js';
import {
  BACKGROUNDS, STAGE_PLACE, CHAPTER_FALLBACK_BG, SPARE_BACKGROUNDS, placeOfStage, stageOfBackground,
} from '../../src/data/story/backgrounds.js';
import { resolveBackground, backgroundUrls } from '../../src/ui/story/backdrop.js';
import { STAGE_MAP, CAMPAIGN_IDS } from '../../src/data/stages.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOBBY_ART = join(ROOT, 'public', 'art', 'lobby');
const STORY_ART = join(LOBBY_ART, 'story');
const ALL = Object.values(SCENES);
const ACADEMY_FILE = 'academy.webp';
/** The repo-relative file behind an art URL (lobbyArtUrl adds the deploy base). */
const fileOf = (url) => url.slice(url.indexOf('art/lobby/') + 'art/lobby/'.length);

/** Every background id a scene shows: its opening one plus every cue({ bg }). */
function sceneBackgrounds(sc) {
  const ids = [sc.bg];
  forEachLine(sc, (l) => { if (l.t === 'cue' && l.bg) ids.push(l.bg); });
  return ids;
}

describe('story backdrops', () => {
  it('every background every scene uses resolves to an existing file (or a solid colour)', () => {
    for (const sc of ALL) {
      for (const id of sceneBackgrounds(sc)) {
        const spec = resolveBackground(id, sc.chapter);
        if (spec.kind === 'solid') {
          expect(spec.color, `${sc.id}: ${id}`).toBeTruthy();
          continue;
        }
        expect(existsSync(join(LOBBY_ART, fileOf(spec.url))), `${sc.id}: ${id} -> ${spec.url}`).toBe(true);
        expect(existsSync(join(LOBBY_ART, fileOf(spec.thumb))), `${sc.id}: ${id} thumb -> ${spec.thumb}`).toBe(true);
        expect(backgroundUrls(id, sc.chapter)).toEqual([spec.url]);
      }
    }
  });

  it('no scene falls back to the academy painting where STAGE_PLACE names a place', () => {
    for (const sc of ALL) {
      for (const id of sceneBackgrounds(sc)) {
        const stage = stageOfBackground(id);
        if (!stage) continue;
        expect(STAGE_PLACE[stage], `${sc.id}: ${id} has a place`).toBeTruthy();
        const spec = resolveBackground(id, sc.chapter);
        expect(spec.place, `${sc.id}: ${id}`).toBe(STAGE_PLACE[stage]);
        expect(fileOf(spec.url), `${sc.id}: ${id}`).toBe(`story/${STAGE_PLACE[stage]}.webp`);
      }
    }
  });

  it('scenes no longer show the old academy painting (it stays the lobby picture and the stage fallback)', () => {
    for (const sc of ALL) {
      for (const id of sceneBackgrounds(sc)) {
        const spec = resolveBackground(id, sc.chapter);
        if (spec.url) expect(fileOf(spec.url), `${sc.id}: ${id}`).not.toBe(ACADEMY_FILE);
      }
    }
  });

  it('STAGE_PLACE: every stage exists, every campaign stage has a place, every place is a story picture', () => {
    for (const [stage, place] of Object.entries(STAGE_PLACE)) {
      expect(STAGE_MAP[stage], `stage ${stage} exists`).toBeTruthy();
      expect(STAGE_MAP[stage].kind, `stage ${stage}`).toBe('campaign');
      expect(BACKGROUNDS[place]?.file, `${stage} -> ${place}`).toBe(`story/${place}.webp`);
      expect(placeOfStage(stage)).toBe(place);
    }
    for (const id of CAMPAIGN_IDS) expect(STAGE_PLACE[id], `campaign stage ${id} has a place`).toBeTruthy();
  });

  it('the chapter fallback stays the academy painting for a stage without a place', () => {
    for (const id of Object.values(CHAPTER_FALLBACK_BG)) expect(BACKGROUNDS[id].file).toBe(ACADEMY_FILE);
    expect(placeOfStage('9-9')).toBeNull();
    expect(fileOf(resolveBackground('stage:9-9', 5).url)).toBe(ACADEMY_FILE);
  });

  it('every story picture and thumb is listed in BACKGROUNDS, and every listed one exists', () => {
    const files = readdirSync(STORY_ART).filter((f) => f.endsWith('.webp'));
    const thumbs = readdirSync(join(STORY_ART, 'thumbs')).filter((f) => f.endsWith('.webp'));
    const listed = Object.values(BACKGROUNDS).filter((b) => b.file?.startsWith('story/'));
    expect(files.length).toBe(31);
    expect(listed.map((b) => b.file).sort()).toEqual(files.map((f) => `story/${f}`).sort());
    expect(listed.map((b) => b.thumb).sort()).toEqual(thumbs.map((f) => `story/thumbs/${f}`).sort());
    for (const f of files) expect(statSync(join(STORY_ART, f)).size, `${f} size`).toBeLessThanOrEqual(220 * 1024);
    for (const f of thumbs) expect(statSync(join(STORY_ART, 'thumbs', f)).size, `thumbs/${f} size`).toBeLessThanOrEqual(24 * 1024);
  });

  it('story places paint their own time of day (day tint only) and carry a focal point in range', () => {
    for (const [id, bg] of Object.entries(BACKGROUNDS)) {
      if (!bg.file?.startsWith('story/')) continue;
      expect(bg.kind, id).toBe('paint');
      expect(bg.tint, id).toBe('day');
      expect(bg.blur || 0, id).toBe(0);
      const m = /^(\d{1,3})% (\d{1,3})%$/.exec(bg.focus || '');
      expect(m, `${id} focus "${bg.focus}"`).toBeTruthy();
      for (const v of [Number(m[1]), Number(m[2])]) expect(v >= 0 && v <= 100, `${id} focus ${bg.focus}`).toBe(true);
    }
  });

  it('spares are real backgrounds', () => {
    for (const id of SPARE_BACKGROUNDS) expect(BACKGROUNDS[id], id).toBeTruthy();
  });
});
