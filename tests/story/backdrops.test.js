// Story backdrops (Oct 27 set): every background a scene shows resolves to a real picture, every Act I campaign
// stage has its painted place (an Act II stage without one shows its map theme's night skyline, never the academy),
// no scene is left on the old academy painting where the stage -> place table names a place, and every file under
// public/art/lobby/story/ is listed (no orphan art ships).
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { SCENES } from '../../src/data/story/index.js';
import { forEachLine } from '../../src/data/story/format.js';
import {
  BACKGROUNDS, STAGE_PLACE, CHAPTER_FALLBACK_BG, SPARE_BACKGROUNDS, placeOfStage, stageOfBackground, timeOfBackground,
  isBackgroundId,
} from '../../src/data/story/backgrounds.js';
import { themeBackdropSVG } from '../../src/art/backdrops.js';
import {
  resolveBackground, backgroundUrls, imageDecoded, layersToDrop, fadedIn, FADE_FALLBACK_MS, PLACE_VARIANT,
} from '../../src/ui/story/backdrop.js';
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
        if (spec.kind === 'svg') {
          // an Act II stage without a painted place: its map theme's skyline, drawn in place (no file to load)
          expect(STAGE_MAP[spec.stageId]?.act, `${sc.id}: ${id} is an Act II stage`).toBe(2);
          expect(spec.html, `${sc.id}: ${id}`).toMatch(/<svg/);
          expect(backgroundUrls(id, sc.chapter)).toEqual([]);
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
        const spec = resolveBackground(id, sc.chapter);
        if (!STAGE_PLACE[stage] && STAGE_MAP[stage]?.act === 2) {
          expect(spec.kind, `${sc.id}: ${id} shows its theme skyline`).toBe('svg');
          continue;
        }
        expect(STAGE_PLACE[stage], `${sc.id}: ${id} has a place`).toBeTruthy();
        // (a `@dusk` / `@night` stage background shows the place's own -sunset / -night picture when listed)
        const time = timeOfBackground(id);
        const timed = time && `${STAGE_PLACE[stage]}-${time === 'dusk' ? 'sunset' : 'night'}`;
        const place = timed && BACKGROUNDS[timed] ? timed : STAGE_PLACE[stage];
        expect(spec.place, `${sc.id}: ${id}`).toBe(place);
        expect(fileOf(spec.url), `${sc.id}: ${id}`).toBe(`story/${place}.webp`);
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

  it('STAGE_PLACE: every stage exists, every Act I campaign stage has a place, every place is a story picture', () => {
    for (const [stage, place] of Object.entries(STAGE_PLACE)) {
      expect(STAGE_MAP[stage], `stage ${stage} exists`).toBeTruthy();
      expect(STAGE_MAP[stage].kind, `stage ${stage}`).toBe('campaign');
      expect(BACKGROUNDS[place]?.file, `${stage} -> ${place}`).toBe(`story/${place}.webp`);
      expect(placeOfStage(stage)).toBe(place);
    }
    for (const id of CAMPAIGN_IDS) {
      if (STAGE_PLACE[id]) continue;
      expect(STAGE_MAP[id].act, `campaign stage ${id} has a place (only an Act II stage may go without)`).toBe(2);
      expect(resolveBackground(`stage:${id}`, STAGE_MAP[id].chapter).kind, `stage ${id} shows its theme skyline`).toBe('svg');
    }
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

  it('the far north (4-9, 4-10) is no summer painting: the frozen villages and the snow bridge are drawn snowy', () => {
    for (const [stage, variant] of [['4-9', 'north'], ['4-10', 'northBridge']]) {
      expect(STAGE_PLACE[stage], stage).toBeUndefined();
      const spec = resolveBackground(`stage:${stage}`, 4);
      expect(spec.kind, stage).toBe('svg');
      expect(spec.html, stage).toBe(themeBackdropSVG('snow', { variant }));
      expect(spec.html, stage).not.toBe(themeBackdropSVG('snow'));
      expect(spec.html).not.toMatch(/NaN|undefined/);
    }
    expect(themeBackdropSVG('snow', { variant: 'north' })).not.toBe(themeBackdropSVG('snow', { variant: 'northBridge' }));
  });

  it('`stage:<id>@dusk` / `@night` picks a time of day: a skyline re-lit, a painted place\'s own picture when listed', () => {
    expect(stageOfBackground('stage:4-7@dusk')).toBe('4-7');
    expect(timeOfBackground('stage:4-7@dusk')).toBe('dusk');
    expect(timeOfBackground('stage:4-8@night')).toBe('night');
    expect(timeOfBackground('stage:4-7')).toBeNull();
    for (const bad of ['stage:4-7@noon', 'stage:4-7@', 'stage:4-7@dusk@night', 'academy-day@dusk']) expect(isBackgroundId(bad), bad).toBe(false);
    // a drawn skyline: the same place, re-lit (its own gradient ids, so a day and a dusk layer can crossfade)
    const day = resolveBackground('stage:4-7', 4);
    const dusk = resolveBackground('stage:4-7@dusk', 4);
    const night = resolveBackground('stage:4-8@night', 4);
    expect(dusk.html).toBe(themeBackdropSVG('city', { variant: 'highway', time: 'dusk' }));
    expect(night.html).toBe(themeBackdropSVG('city', { variant: 'highwaySnow', time: 'night' }));
    expect(dusk.html).not.toBe(day.html);
    expect(dusk.html).toContain('tb-city-highway-dusk-sky');
    expect(day.html).not.toContain('-dusk');
    for (const sp of [dusk, night]) expect(sp.html).not.toMatch(/NaN|undefined/);
    // a painted place: its -sunset picture when there is one, else the place as painted
    expect(resolveBackground('stage:1-1@dusk', 1).place).toBe('blossom-court-sunset');
    expect(resolveBackground('stage:2-1@night', 2).place).toBe('lakeshore');
  });

  it('Act 4\'s evening and night scenes play on a dusk or night backdrop, not the noon highway', () => {
    expect(SCENES['g4.azami'].bg).toBe('stage:4-7@dusk');
    expect(SCENES['g4.logs'].bg).toBe('stage:4-8@night');
    expect(SCENES['g4.epi'].bg).toBe('stage:4-7@dusk');
    const epiCues = [];
    forEachLine(SCENES['g4.epi'], (l) => { if (l.t === 'cue' && l.bg) epiCues.push(l.bg); });
    expect(epiCues).toEqual(['stage:4-5', 'stage:4-7@night']);
  });

  it("Act 5's places fit place and time: the drowned line underground, the reservoir after dark, Hilltop's night skyline", () => {
    const bgs = Object.fromEntries(ALL.filter((s) => s.id.startsWith('g5.')).map((s) => [s.id, sceneBackgrounds(s)]));
    expect(bgs).toEqual({
      'g5.pro': ['stage:5-6'], // the flooded platform (drowned)
      'g5.embers': ['stage:4-9@night'], // the far north, the keeper's camp at night
      'g5.mid': ['stage:5-8'], // the dark pump hall and the Noon Gate (drowned)
      'g5.raid': ['stage:2-6'], // Hilltop the same night (the campus skyline is drawn at night)
      'g5.whiteboard': ['shelter'], // the next morning (daylit)
      'g5.boss': ['stage:5-10@night'], // the reservoir at night
      'g5.after': ['stage:5-10@night', 'stage:5-10@dawn'], // "…First light.": the willow at dawn
      'g5.epi': ['stage:2-6'], // Hilltop, late that night
      'g5.board': ['shelter'], // the morning after (daylit)
    });
    // nothing in Act 5 sits on the academy painting or a bright noon backdrop under a night scene
    for (const ids of Object.values(bgs)) for (const id of ids) expect(id.startsWith('academy'), id).toBe(false);
    expect(resolveBackground('stage:4-9@night', 5).html).toBe(themeBackdropSVG('snow', { variant: 'north', time: 'night' }));
    expect(resolveBackground('stage:2-6', 5).html).toBe(themeBackdropSVG('campus'));
    // the Act 5 stages draw their own skylines (S5a's drowned and park variants by map, PLACE_VARIANT), never a painting
    for (const st of ['5-6', '5-8', '5-10']) {
      expect(STAGE_PLACE[st], st).toBeUndefined();
      expect(STAGE_MAP[st]?.act, `${st} is an Act II stage`).toBe(2);
      expect(resolveBackground(`stage:${st}`, 5).kind, st).toBe('svg');
    }
    const night = resolveBackground('stage:5-10@night', 5);
    expect([night.kind, night.time]).toEqual(['svg', 'night']);
    expect(night.html).not.toBe(resolveBackground('stage:5-10', 5).html);
  });

  it("Act 6's places fit place and time: the pump hall, then Vesperline under its eclipse, at night and at home", () => {
    const bgs = Object.fromEntries(ALL.filter((s) => s.id.startsWith('g6.')).map((s) => [s.id, sceneBackgrounds(s)]));
    expect(bgs).toEqual({
      'g6.pro': ['stage:5-8', 'stage:6-6'], // the drill in the pump hall, then through the gate onto the causeway
      'g6.sleep': ['stage:6-7@night'], // four in the morning under the sky-rail station canopy
      'g6.mid': ['stage:6-8'], // the museum rotunda (the frozen city's eclipse sky)
      'g6.chair': ['stage:6-9'], // the briefing room high in a lecture tower, over the tower ring
      'g6.boss': ['stage:6-10'], // the Vesper Gate's terminal at the white tower's foot
      'g6.after': ['stage:6-10'],
      'g6.epi': ['stage:6-10', 'shelter'], // the nest behind the tower, then Itomachi the next morning (daylit)
      'g6.doorie': ['shelter'], // Shelter 3, mid-morning (daylit)
      'g6.star1': ['stage:side-6-starfall@night'], // the observatory deck under the cracked dome, at night
      'g6.star2': ['stage:side-6-starfall@night'],
    });
    // nothing in Act 6 sits on the academy painting or a bright day backdrop under a night line
    for (const ids of Object.values(bgs)) for (const id of ids) expect(id.startsWith('academy'), id).toBe(false);
    // the side stage's id is a stage background, with a time of day
    expect(stageOfBackground('stage:side-6-starfall@night')).toBe('side-6-starfall');
    expect(timeOfBackground('stage:side-6-starfall@night')).toBe('night');
    expect(stageOfBackground('stage:side-6-starfall')).toBe('side-6-starfall');
    for (const bad of ['stage:side-6', 'stage:side--starfall', 'stage:side-6-Starfall', 'stage:side-6-starfall@noon']) {
      expect(isBackgroundId(bad), bad).toBe(false);
    }
    // the Act 6 stages and the Starfall Deck draw Vesperline's own skylines (S6a's variants by map), never a painting
    for (const st of ['6-6', '6-7', '6-8', '6-9', '6-10', 'side-6-starfall']) {
      expect(STAGE_PLACE[st], st).toBeUndefined();
      expect(STAGE_MAP[st]?.act, `${st} is an Act II stage`).toBe(2);
      const spec = resolveBackground(`stage:${st}`, 6);
      expect(spec.kind, st).toBe('svg');
      expect(spec.html, st).toBe(themeBackdropSVG('vesper', { variant: PLACE_VARIANT[STAGE_MAP[st].mapId] ?? null }));
    }
    for (const st of ['6-7', 'side-6-starfall']) {
      const night = resolveBackground(`stage:${st}@night`, 6);
      expect([night.kind, night.time], st).toEqual(['svg', 'night']);
      expect(night.html, st).not.toBe(resolveBackground(`stage:${st}`, 6).html);
    }
  });

  it('spares are real backgrounds', () => {
    for (const id of SPARE_BACKGROUNDS) expect(BACKGROUNDS[id], id).toBeTruthy();
  });
});

// The backdrop drops the old layer only once the new picture has decoded (imageDecoded true), so a slow decode
// never shows black between two places. Fake <img> objects: the suite has no DOM.
describe('imageDecoded (when the old background may go)', () => {
  const fakeImg = (props) => ({ complete: false, naturalWidth: 0, ...props });
  const listening = (fire) => {
    const handlers = {};
    const img = fakeImg({ addEventListener: (type, fn) => { handlers[type] = fn; } });
    queueMicrotask(() => handlers[fire]?.());
    return img;
  };

  it('a solid layer (no picture) is ready at once', async () => {
    expect(await imageDecoded(null)).toBe(true);
  });

  it('true once decode() resolves, however long it takes (no cap)', async () => {
    let done;
    const img = fakeImg({ decode: () => new Promise((r) => { done = r; }) });
    const p = imageDecoded(img);
    let settled = false;
    p.then(() => { settled = true; });
    await new Promise((r) => setTimeout(r, 30));
    expect(settled).toBe(false);
    done();
    expect(await p).toBe(true);
  });

  it('false when the picture fails; a decode() rejection on a painted picture still counts as ready', async () => {
    expect(await imageDecoded(fakeImg({ decode: () => Promise.reject(new Error('EncodingError')) }))).toBe(false);
    expect(await imageDecoded(fakeImg({ complete: true, naturalWidth: 1280, decode: () => Promise.reject(new Error('x')) }))).toBe(true);
  });

  it('without decode(): load is ready, error is not, an already complete picture answers at once', async () => {
    expect(await imageDecoded(listening('load'))).toBe(true);
    expect(await imageDecoded(listening('error'))).toBe(false);
    expect(await imageDecoded(fakeImg({ complete: true, naturalWidth: 640 }))).toBe(true);
    expect(await imageDecoded(fakeImg({ complete: true, naturalWidth: 0 }))).toBe(false);
  });
});

// A background change drops the old layers only once the new one has really faded in (M1, Oct 28): the decision
// (layersToDrop) and the fade-end signal (fadedIn) are pure, so they are tested here without a DOM.
describe('background crossfade: the old layers go only beneath a layer that covers', () => {
  const L = (name, covers = false) => ({ name, covers });
  const drop = (layers) => layersToDrop(layers, (l) => l.covers).map((l) => l.name);

  it('nothing goes while the new layer is still fading in (or its picture is not decoded)', () => {
    expect(drop([L('old', true), L('new')])).toEqual([]);
    expect(drop([L('old'), L('new')])).toEqual([]);
    expect(drop([])).toEqual([]);
  });

  it('once the new layer covers, every layer beneath it goes', () => {
    expect(drop([L('old', true), L('new', true)])).toEqual(['old']);
    expect(drop([L('a', true), L('b'), L('c', true)])).toEqual(['a', 'b']);
  });

  it('a second swap mid-fade: the first new layer finishing only clears what is beneath it, never the newer one', () => {
    // old (covering) <- A (finished first) <- B (still fading)
    expect(drop([L('old', true), L('A', true), L('B')])).toEqual(['old']);
    // B finishes before A: both A and old go
    expect(drop([L('old', true), L('A'), L('B', true)])).toEqual(['old', 'A']);
  });

  it('the topmost covering layer always stays (never zero coverage)', () => {
    for (const stack of [[L('a', true)], [L('a', true), L('b')], [L('a', true), L('b', true), L('c')]]) {
      const gone = new Set(drop(stack));
      const left = stack.filter((l) => !gone.has(l.name));
      expect(left.some((l) => l.covers), JSON.stringify(stack)).toBe(true);
    }
  });
});

describe('fadedIn (when a layer has finished its fade)', () => {
  const fakeLayer = () => {
    const handlers = new Set();
    return {
      addEventListener: (t, fn) => t === 'transitionend' && handlers.add(fn),
      removeEventListener: (t, fn) => handlers.delete(fn),
      fire(e) { for (const fn of [...handlers]) fn(e); },
      get listeners() { return handlers.size; },
    };
  };
  const fakeTimers = () => {
    const t = { pending: null, cleared: false, ms: null };
    t.setTimer = (fn, ms) => { t.pending = fn; t.ms = ms; return 1; };
    t.clearTimer = () => { t.cleared = true; };
    return t;
  };
  const settledAfter = async (p) => {
    let done = false;
    p.then(() => { done = true; });
    await new Promise((r) => setTimeout(r, 0));
    return done;
  };

  it("resolves on the layer's own opacity transitionend, and cleans up", async () => {
    const layer = fakeLayer();
    const t = fakeTimers();
    const p = fadedIn(layer, t);
    layer.fire({ target: {}, propertyName: 'opacity' }); // a child's transition bubbling up
    layer.fire({ target: layer, propertyName: 'transform' }); // another property
    expect(await settledAfter(p)).toBe(false);
    layer.fire({ target: layer, propertyName: 'opacity' });
    expect(await settledAfter(p)).toBe(true);
    expect(t.cleared).toBe(true);
    expect(layer.listeners).toBe(0);
  });

  it('falls back after FADE_FALLBACK_MS when transitionend never comes', async () => {
    const layer = fakeLayer();
    const t = fakeTimers();
    const p = fadedIn(layer, t);
    expect(t.ms).toBe(FADE_FALLBACK_MS);
    expect(FADE_FALLBACK_MS).toBeGreaterThan(420);
    expect(await settledAfter(p)).toBe(false);
    t.pending();
    expect(await settledAfter(p)).toBe(true);
    expect(layer.listeners).toBe(0);
  });
});
