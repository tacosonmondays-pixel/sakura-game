// The campaign screen's act rows (src/ui/screens/campaignActs.js; docs/CAMPAIGN.md "Act II"), pure helpers only (no
// DOM): a chapter with one act draws one row with no header (the screen as before); a chapter with an Act II draws two,
// with headers, the two-key lock text and a NEW flag while Act II is open and untouched. Chapters 1 and 2's Act II are
// real (Gate Arc Steps 1-2), so the "fixture" rows below run on live stages (no fixture ids are injected any more).
import { describe, it, expect, afterEach } from 'vitest';
import { CHAPTERS, STAGE_MAP, act2Stage } from '../../src/data/stages.js';
import { createProfile } from '../../src/systems/save.js';
import { actRows, actIsNew, chapterHasNewAct, actTitle, actIds } from '../../src/ui/screens/campaignActs.js';

const ACT1 = CHAPTERS.flatMap((c) => c.stages);
const FIXTURE_IDS = []; // (2-6 … 2-10 were fixtures until Step 2 registered them)
const base = { name: 'Fixture', mapId: 'sakura_court', desc: 'x', budget: [8, 200], pool: [{ enemy: 'slime_green', weight: 1, from: 1 }], fam: ['charm', 'rune'], scenery: { props: ['x'] } };
const inject = () => { for (const id of FIXTURE_IDS) STAGE_MAP[id] = act2Stage({ ...base, id }); };
const mark = (p, ids) => {
  for (const id of ids) p.progress.stages[id] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
  return p;
};
/** A chapter row as S1d will have it: Act I plus five Act II ids and the act's name. */
const withAct2 = (c, name = 'Rush Hour') => ({ ...CHAPTERS[c - 1], act2: [6, 7, 8, 9, 10].map((n) => `${c}-${n}`), act2Name: name });

afterEach(() => { for (const id of FIXTURE_IDS) delete STAGE_MAP[id]; });

describe('one act (chapters 5-8 in this build)', () => {
  it('one row, no header, the chapter\'s five stages; never NEW', () => {
    const p = mark(createProfile(), ACT1.slice(0, 7));
    for (const c of CHAPTERS.slice(4)) {
      const rows = actRows(p, c);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ act: 1, ids: c.stages, header: null, isNew: false, total: 5 });
      expect(chapterHasNewAct(p, c)).toBe(false);
      expect(actIds(c, 2)).toEqual([]);
    }
    expect(actRows(p, CHAPTERS[1])[0]).toMatchObject({ unlocked: true, cleared: 2 });
    expect(actRows(p, CHAPTERS[4])[0]).toMatchObject({ unlocked: false, lockText: 'Clear 4-5 first', cleared: 0 });
  });
});

describe('chapter 2: Act II · Hilltop After Dark (registered, the first live two-key)', () => {
  it('locked until both 2-5 and 1-10 are cleared, then NEW', () => {
    const p = mark(createProfile(), ACT1.slice(0, 10)); // through 2-5, chapter 1's Act II not played
    const rows = actRows(p, CHAPTERS[1]);
    expect(rows.map((r) => r.header)).toEqual(['Act I · The Morning', 'Act II · Hilltop After Dark']);
    expect(rows[1]).toMatchObject({ ids: ['2-6', '2-7', '2-8', '2-9', '2-10'], unlocked: false, isNew: false, lockText: 'Clear 1-10 first' });
    mark(p, ['1-6', '1-7', '1-8', '1-9', '1-10']);
    expect(actRows(p, CHAPTERS[1])[1]).toMatchObject({ unlocked: true, isNew: true });
    expect(chapterHasNewAct(p, CHAPTERS[1])).toBe(true);
  });
});

describe('chapter 1: Act I and Act II · Rush Hour (registered)', () => {
  it('two rows with headers; Act II opens on 1-5 with NEW, as on the screen', () => {
    const p = mark(createProfile(), ACT1.slice(0, 7));
    const rows = actRows(p, CHAPTERS[0]);
    expect(rows.map((r) => r.header)).toEqual(['Act I · The Morning', 'Act II · Rush Hour']);
    expect(rows[0]).toMatchObject({ act: 1, unlocked: true, lockText: null, cleared: 5 });
    expect(rows[1]).toMatchObject({ act: 2, ids: ['1-6', '1-7', '1-8', '1-9', '1-10'], unlocked: true, isNew: true, cleared: 0, total: 5 });
    expect(chapterHasNewAct(p, CHAPTERS[0])).toBe(true);
    expect(actIds(CHAPTERS[0], 2)).toEqual(['1-6', '1-7', '1-8', '1-9', '1-10']);
  });
});

describe('two acts (fixture Act II stages)', () => {
  it('headers "Act I · The Morning" and "Act II · <act2Name>" (fallback "The Noon")', () => {
    inject();
    const p = createProfile();
    const rows = actRows(p, withAct2(1));
    expect(rows.map((r) => r.header)).toEqual(['Act I · The Morning', 'Act II · Rush Hour']);
    expect(rows[1].ids).toEqual(['1-6', '1-7', '1-8', '1-9', '1-10']);
    expect(actTitle({ id: 3 }, 2)).toBe('Act II · The Noon');
  });

  it('Act II of chapter 1 opens on 1-5 and is NEW until one of its stages is cleared', () => {
    inject();
    const ch = withAct2(1);
    const p = mark(createProfile(), ACT1.slice(0, 4)); // through 1-4
    let row = actRows(p, ch)[1];
    expect(row).toMatchObject({ unlocked: false, lockText: 'Clear 1-5 first', isNew: false });
    expect(actIsNew(p, ch, 2)).toBe(false);
    mark(p, ['1-5']);
    row = actRows(p, ch)[1];
    expect(row).toMatchObject({ unlocked: true, lockText: null, isNew: true, cleared: 0 });
    expect(chapterHasNewAct(p, ch)).toBe(true);
    mark(p, ['1-6']);
    row = actRows(p, ch)[1];
    expect(row).toMatchObject({ isNew: false, cleared: 1, total: 5 });
    expect(chapterHasNewAct(p, ch)).toBe(false);
  });

  it('a two-key x-6 names whatever is still missing: both, then only 1-10', () => {
    inject();
    const ch2 = withAct2(2, 'Hilltop After Dark');
    const p = createProfile();
    expect(actRows(p, ch2)[1].lockText).toBe('Clear 2-5 and 1-10 first');
    mark(p, ACT1.slice(0, 10)); // Act I through 2-5
    expect(actRows(p, ch2)[1]).toMatchObject({ unlocked: false, lockText: 'Clear 1-10 first', isNew: false });
    mark(p, ['1-6', '1-7', '1-8', '1-9', '1-10']);
    expect(actRows(p, ch2)[1]).toMatchObject({ unlocked: true, lockText: null, isNew: true });
    expect(chapterHasNewAct(p, ch2)).toBe(true);
  });
});

describe('an echo stage (1-10 echoes 1-5)', () => {
  it('echoSource names the Act I stage on the echoed map; other maps have none', async () => {
    const { echoSource } = await import('../../src/ui/screens/campaignActs.js');
    const { getMap } = await import('../../src/data/maps.js');
    const src = echoSource(getMap(STAGE_MAP['1-10'].mapId));
    expect(src.stageId).toBe('1-5');
    expect(src.map.id).toBe('sakura_court');
    expect(echoSource(getMap('noon_station_plaza'))).toBe(null);
  });
});
