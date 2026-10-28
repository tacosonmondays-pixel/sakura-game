// Scene player helpers (pure parts of src/ui/story/*): auto-advance timing, title cards, name plates, emote
// glyph coverage, background resolution and the scene route's next hop. The DOM player itself is covered by
// e2e/story.mjs at 844×390 and 1280×720.
import { describe, it, expect } from 'vitest';
import { autoDelay, titleCardText, plateFor } from '../../src/ui/story/player.js';
import { EMOTES, emoteSVG } from '../../src/ui/story/emotes.js';
import { resolveBackground, backgroundUrls } from '../../src/ui/story/backdrop.js';
import { nextRoute } from '../../src/ui/story/scene.js';
import { FACES } from '../../src/data/story/format.js';
import { BACKGROUNDS, CHAPTER_FALLBACK_BG, STAND_NUDGE } from '../../src/data/story/backgrounds.js';
import { sceneById, SCENES } from '../../src/data/story/index.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { ENEMY_MAP, FAMILIES } from '../../src/data/enemies.js';
import { TEXT_SPEEDS } from '../../src/systems/story.js';

describe('scene player timing', () => {
  it('auto waits 900 ms + 30 ms per character, capped at 4 s', () => {
    expect(autoDelay('')).toBe(900);
    expect(autoDelay('abcd')).toBe(1020);
    expect(autoDelay('x'.repeat(200))).toBe(4000);
    expect(autoDelay('♡♡')).toBe(960); // characters, not UTF-16 units
  });

  it('type-on speeds follow the spec (slow 25, normal 45, fast 90, instant)', () => {
    expect(TEXT_SPEEDS).toEqual({ slow: 25, normal: 45, fast: 90, instant: Infinity });
  });
});

describe('title cards and plates', () => {
  it('title card names the chapter, the episode and the resolved title', () => {
    expect(titleCardText(sceneById('opening'), 1)).toEqual({ kicker: 'Opening', title: `Meet ${UNIT_MAP.hikari.name}`, sub: 'Episode 1' });
    const c = titleCardText(sceneById('ch2.pro'), 1);
    expect(c.kicker).toBe('Chapter 2 · Moonlit Lakeshore');
    expect(c.sub).toBe('Episode 1');
    expect(titleCardText(sceneById('lesson.home')).kicker).toBe("Captain's Journal");
    // a Gate Arc (Act II) episode names its act, not "Event Story"
    expect(titleCardText(sceneById('g1.pro'), 1)).toEqual({ kicker: 'Chapter 1 · Rush Hour', title: 'Two Sunrises', sub: 'Episode 1' });
    expect(titleCardText({ ...sceneById('g1.pro'), act: undefined }).kicker).toBe('Event Story');
  });

  it('plates come from data: girls by unit id, monsters by enemy id, plain speakers and overrides', () => {
    expect(plateFor('aoi')).toMatchObject({ name: UNIT_MAP.aoi.name, title: UNIT_MAP.aoi.title, color: UNIT_MAP.aoi.palette.accent });
    const prince = plateFor('slime_prince');
    expect(prince).toMatchObject({ name: ENEMY_MAP.slime_prince.name, color: FAMILIES[ENEMY_MAP.slime_prince.family].color, enemy: true });
    expect(plateFor('sensei').name).toBe('Sensei');
    expect(plateFor('unknown').name).toBe('???');
    expect(plateFor('hikari', '???')).toMatchObject({ name: '???', title: '' });
    expect(plateFor('narrator')).toBeNull();
    expect(plateFor('kanna').name).toBe('Kanna'); // a girl not merged yet still gets a readable plate
  });
});

describe('emotes', () => {
  it('every face glyph is drawn', () => {
    for (const [face, def] of Object.entries(FACES)) {
      if (!def.glyph) continue;
      expect(EMOTES[def.glyph], `${face} → ${def.glyph}`).toBeTruthy();
      expect(emoteSVG(def.glyph)).toMatch(/^<svg[^>]*viewBox="0 0 48 48"/);
    }
    expect(emoteSVG(null)).toBe('');
    expect(emoteSVG('nope')).toBe('');
  });
});

describe('backgrounds', () => {
  it('paint, CG and solid backgrounds resolve to lobby art files', () => {
    for (const id of Object.keys(BACKGROUNDS)) {
      const spec = resolveBackground(id);
      expect(spec.kind).toBe(BACKGROUNDS[id].kind);
      if (spec.kind === 'solid') expect(spec.color).toBeTruthy();
      else expect(spec.url).toMatch(/art\/lobby\/.+\.webp$/);
    }
    expect(resolveBackground('cg:aoi-archery').cg).toBe(true);
  });

  it('stage stills fall back to their chapter academy tint (still provider optional)', () => {
    const spec = resolveBackground('stage:2-1', 2);
    expect(spec).toMatchObject({ stageId: '2-1', fallback: true, kind: 'paint', tint: BACKGROUNDS[CHAPTER_FALLBACK_BG[2]].tint });
    expect(resolveBackground('stage:8-5').tint).toBe(BACKGROUNDS[CHAPTER_FALLBACK_BG[8]].tint);
    expect(backgroundUrls('stage:1-5', 1)[0]).toMatch(/academy\.webp$/);
    expect(backgroundUrls('black')).toEqual([]);
  });

  it('every background any scene uses resolves', () => {
    const ids = new Set();
    for (const sc of Object.values(SCENES)) {
      ids.add(sc.bg);
      for (const l of sc.lines) if (l.t === 'cue' && l.bg) ids.add(l.bg);
    }
    for (const id of ids) expect(resolveBackground(id, 1).kind, id).toMatch(/paint|cg|solid|svg/);
  });

  it('stand nudges only name roster girls', () => {
    for (const id of Object.keys(STAND_NUDGE)) expect(UNIT_MAP[id], id).toBeTruthy();
  });
});

describe('scene route', () => {
  it('next hop: tutorial battle, archive tab, journal, lobby, or back', () => {
    expect(nextRoute({ next: 'tutorial' })).toEqual({ name: 'battle', params: { stage: '1-1', difficulty: 'easy', tutorial: '1' }, replace: true });
    expect(nextRoute({ next: 'story', ch: '3' })).toEqual({ name: 'story', params: { ch: '3' }, replace: true });
    expect(nextRoute({ next: 'journal', lesson: 'gear' })).toEqual({ name: 'journal', params: { id: 'gear' }, replace: true });
    expect(nextRoute({ next: 'lobby' }).name).toBe('lobby');
    expect(nextRoute({})).toBeNull();
  });
});

describe('story music hook', () => {
  it('stemMix turns lists, level maps and the director state into finite levels', async () => {
    const { stemMix } = await import('../../src/ui/story/music.js');
    expect(stemMix(['base', 'melody'])).toEqual({ base: 1, melody: 1 });
    expect(stemMix({ base: 1, melody: 0 })).toEqual({ base: 1, melody: 0 });
    expect(stemMix({ base: { target: 1, value: 0.4 }, prep: { target: 0, value: 0 } })).toEqual({ base: 1, prep: 0 });
    expect(stemMix({ base: NaN, x: 'no', y: { foo: 1 } })).toBeNull();
    expect(stemMix(null)).toBeNull();
  });
});

describe('Act II stage backgrounds', () => {
  it('a stage:1-6 … 1-10 background is the city skyline, not the academy; Act I stages keep the academy tint', () => {
    for (const id of ['1-6', '1-10']) {
      const b = resolveBackground(`stage:${id}`, 1);
      expect(b.kind, id).toBe('svg');
      expect(b.html, id).toMatch(/aria-label="city scenery"/);
      expect(backgroundUrls(`stage:${id}`, 1)).toEqual([]);
    }
    expect(resolveBackground('stage:1-5', 1).kind).toBe('paint');
  });

  it('2-7 and 2-10 show their own places (the jetty, the old lamp) over the campus night', () => {
    const plain = resolveBackground('stage:2-6', 2).html;
    const jetty = resolveBackground('stage:2-7', 2).html;
    const lamp = resolveBackground('stage:2-10', 2).html;
    expect(plain).toMatch(/aria-label="campus scenery"/);
    expect(new Set([plain, jetty, lamp]).size).toBe(3);
  });
});

