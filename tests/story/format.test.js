// Story scene format (STORY_SPEC §1.2, T-format-1): builders normalise lines and reject unknown vocabulary.
import { describe, it, expect } from 'vitest';
import {
  scene, say, narrate, cue, choice, deriveCast, playableLines, spokenCount, tokensIn, forEachLine,
  FACES, FACE_IDS, FX, POSITIONS, NPCS, ENEMY_SPEAKERS,
} from '../../src/data/story/format.js';
import { isBackgroundId, stageOfBackground, isCgBackground, BACKGROUNDS } from '../../src/data/story/backgrounds.js';
import { STORY_MUSIC, STORY_SFX } from '../../src/data/story/music.js';
import { resolveText, tokenProblems } from '../../src/data/story/tokens.js';

describe('story format builders', () => {
  it('normalise say / narrate / cue / choice', () => {
    expect(say('aoi', 'Hello!', { at: 'left', face: 'joy' })).toEqual({ t: 'say', who: 'aoi', text: 'Hello!', at: 'left', face: 'joy' });
    expect(narrate('Spring.')).toEqual({ t: 'narrate', text: 'Spring.' });
    expect(cue({ bg: 'academy-day', music: 'home' })).toEqual({ t: 'cue', bg: 'academy-day', music: 'home' });
    const c = choice([{ text: 'A', lines: [say('aoi', 'a')] }, { text: 'B', lines: [narrate('b')] }]);
    expect(c.t).toBe('choice');
    expect(c.options).toHaveLength(2);
    expect(Object.isFrozen(c)).toBe(true);
  });

  it('rejects unknown faces, motions, positions, backgrounds, music and sfx', () => {
    expect(() => say('aoi', 'x', { face: 'smug' })).toThrow(/face/);
    expect(() => say('aoi', 'x', { fx: 'spin' })).toThrow(/fx/);
    expect(() => say('aoi', 'x', { at: 'top' })).toThrow(/position/);
    expect(() => say('aoi', 'x', { mood: 'joy' })).toThrow(/unknown field/);
    expect(() => cue({ bg: 'beach' })).toThrow(/background/);
    expect(() => cue({ music: 'disco' })).toThrow(/music/);
    expect(() => cue({ sfx: 'kazoo' })).toThrow(/sfx/);
    expect(() => cue({ flash: 'pink' })).toThrow(/flash/);
    expect(() => cue({ enter: [{ who: 'aoi', at: 'off' }] })).toThrow(/position/);
    expect(() => cue({})).toThrow(/empty/);
    expect(() => scene('x.y', { title: 'T', chapter: 1, kind: 'mid', trigger: null, bg: 'nowhere' }, [narrate('a')])).toThrow(/background/);
    expect(() => scene('x.y', { title: 'T', chapter: 1, kind: 'mid', trigger: null, bg: 'black', music: 'disco' }, [narrate('a')])).toThrow(/music/);
    expect(() => scene('x.y', { title: 'T', chapter: 1, kind: 'boss', trigger: null, bg: 'black' }, [narrate('a')])).toThrow(/kind/);
    expect(() => scene('x.y', { title: 'T', chapter: 1, kind: 'mid', trigger: { during: '1-1' }, bg: 'black' }, [narrate('a')])).toThrow(/trigger/);
  });

  it('rejects empty or padded text', () => {
    expect(() => say('aoi', '')).toThrow();
    expect(() => say('aoi', '   ')).toThrow();
    expect(() => narrate(' padded')).toThrow(/spaces/);
  });

  it('choices are flavour only: no effects field, 2–3 options with replies', () => {
    expect(() => choice([{ text: 'A', lines: [narrate('a')], effects: { gems: 5 } }, { text: 'B', lines: [narrate('b')] }])).toThrow(/unknown field/);
    expect(() => choice([{ text: 'A', lines: [narrate('a')] }])).toThrow(/options/);
    expect(() => choice([{ text: 'A', lines: [] }, { text: 'B', lines: [narrate('b')] }])).toThrow(/reply/);
  });

  it('derives the cast from on-stage speakers and cue entries, skipping NPCs, off-stage and ifUnit lines', () => {
    const lines = [
      say('hikari', 'Up here!', { at: 'off' }),
      cue({ enter: [{ who: 'hikari', at: 'center' }] }),
      say('slime_prince', 'Bloop.'),
      say('aoi', 'Hi!', { at: 'left' }),
      say('kanna', 'Rematch!', { at: 'off', ifUnit: 'kanna' }),
      choice([{ text: 'A', lines: [say('rei', 'Noted.')] }, { text: 'B', lines: [narrate('b')] }]),
    ];
    expect(deriveCast(lines)).toEqual(['hikari', 'aoi', 'rei']);
    const sc = scene('t.cast', { title: 'T', chapter: 1, kind: 'mid', trigger: { before: '1-5' }, bg: 'stage:1-5' }, lines);
    expect(sc.cast).toEqual(['hikari', 'aoi', 'rei']);
    expect(spokenCount(sc.lines)).toBe(4);
    expect(playableLines(sc, () => false).some((l) => l.who === 'kanna')).toBe(false);
    expect(playableLines(sc, (id) => id === 'kanna').some((l) => l.who === 'kanna')).toBe(true);
    let n = 0;
    forEachLine(sc, () => { n++; });
    expect(n).toBe(lines.length + 2);
  });

  it('ifOwned: a non-empty list of distinct unit ids from UNIT_MAP, frozen on the scene', () => {
    const meta = (ifOwned) => ({ title: 'T', chapter: 2, kind: 'event', trigger: { after: '2-9' }, bg: 'black', ifOwned });
    const sc = scene('t.owned', meta(['ruri', 'fuu']), [narrate('a')]);
    expect(sc.ifOwned).toEqual(['ruri', 'fuu']);
    expect(Object.isFrozen(sc.ifOwned)).toBe(true);
    expect(scene('t.plain', { ...meta(undefined) }, [narrate('a')]).ifOwned).toBeUndefined();
    expect(() => scene('t.x', meta([]), [narrate('a')])).toThrow(/ifOwned/);
    expect(() => scene('t.x', meta('ruri'), [narrate('a')])).toThrow(/ifOwned/);
    expect(() => scene('t.x', meta(['nobody']), [narrate('a')])).toThrow(/UNIT_MAP/);
    expect(() => scene('t.x', meta(['ruri', 'ruri']), [narrate('a')])).toThrow(/twice/);
    expect(() => scene('t.x', meta(['Ruri']), [narrate('a')])).toThrow(/bad id/);
  });

  it('vocabularies are closed and consistent', () => {
    expect(FACE_IDS).toContain('neutral');
    for (const f of Object.values(FACES)) if (f.fx) expect(FX).toContain(f.fx);
    expect(POSITIONS).toEqual(['left', 'center', 'right', 'off']);
    for (const id of ENEMY_SPEAKERS) expect(NPCS).toContain(id);
    expect(isBackgroundId('stage:3-5')).toBe(true);
    expect(isBackgroundId('stage:zzz')).toBe(false);
    expect(stageOfBackground('stage:8-5')).toBe('8-5');
    expect(isCgBackground('cg:hikari-rampart')).toBe(true);
    expect(isCgBackground('academy-day')).toBe(false);
    for (const [id, bg] of Object.entries(BACKGROUNDS)) expect(['paint', 'cg', 'solid'], id).toContain(bg.kind);
    for (const c of Object.values(STORY_MUSIC)) expect(!!(c.track || c.jingle || c.stop)).toBe(true);
    for (const v of Object.values(STORY_SFX)) expect(v).toMatch(/^[a-z]+\.[a-zA-Z]+$/);
  });

  it('resolves tokens from game data and reports broken ones', () => {
    expect(tokensIn('Hi {name:aoi} and {stage:1-5}!').map((t) => t.raw)).toEqual(['{name:aoi}', '{stage:1-5}']);
    expect(resolveText('Hi {name:aoi}!')).toBe('Hi Aoi!');
    expect(resolveText('{chapter:1}')).toBe('Sakura Gardens');
    expect(resolveText('{ult:hikari}')).toBe('Celestial Bloom');
    expect(resolveText('Clear {stage:1-5}')).toBe('Clear The Jelly Throne');
    expect(resolveText('{name:nobody}')).toBe('Nobody');
    expect(tokenProblems('{name:aoi} {stage:1-1} {chapter:8} {title:rei}')).toEqual([]);
    expect(tokenProblems('{name:nobody}')).toHaveLength(1);
    expect(tokenProblems('{colour:aoi}')).toHaveLength(1);
    expect(tokenProblems('{name:aoi')).toHaveLength(1);
  });
});
