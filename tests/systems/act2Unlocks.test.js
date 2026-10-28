// Act II unlock plumbing (docs/CAMPAIGN.md "Act II"; docs/specs/GATE_ARC.md §20, §22 Q3): `requires` may hold two
// stages and is read only through stages.js stageRequires / requirementsMet; old saves keep every unlock, the "next
// stage" pointer and the results screen's Next button exactly as before.
import { describe, it, expect, afterEach } from 'vitest';
import {
  STAGES, STAGE_MAP, CAMPAIGN_IDS, CHAPTERS, stageRequires, requirementsMet, stageOrderKey, actStages, nextInAct, act2Stage,
  campaignStages,
} from '../../src/data/stages.js';
import { createProfile } from '../../src/systems/save.js';
import { isStageUnlocked, isStageCleared, nextStage, chapterProgress, chapterRibbons } from '../../src/systems/unlocks.js';
import { stageOpen } from '../../src/systems/story.js';
import { followingStage } from '../../src/ui/battle/setup.js';
import { veteran } from '../fixtures/veterans.js';

const ACT1 = CHAPTERS.flatMap((c) => c.stages);
const mark = (p, ids, d = 'normal') => {
  for (const id of ids) (p.progress.stages[id] ||= { easy: false, normal: false, hard: false, nightmare: false, clears: 0 })[d] = true;
  return p;
};
/** A save that cleared 1-1 … 3-2 on Normal. */
const upTo32 = () => mark(createProfile(), ACT1.slice(0, ACT1.indexOf('3-2') + 1));
/** The rule every build before the Gate Arc used (a single `requires` id). */
const oldUnlocked = (p, id) => {
  const s = STAGE_MAP[id];
  return !!s && (!s.requires || isStageCleared(p, s.requires));
};
const oldNext = (p) => ACT1.find((id) => !isStageCleared(p, id)) || null;
const SAVES = () => ({ fresh: createProfile(), upTo32: upTo32(), early: veteran('early'), mid: veteran('mid'), late: veteran('late') });

describe('stageRequires and requirementsMet', () => {
  it('reads null, one id and a list of ids', () => {
    expect(stageRequires({ requires: null })).toEqual([]);
    expect(stageRequires({})).toEqual([]);
    expect(stageRequires(null)).toEqual([]);
    expect(stageRequires({ requires: '1-5' })).toEqual(['1-5']);
    expect(stageRequires({ requires: ['2-5', '1-10'] })).toEqual(['2-5', '1-10']);
    expect(stageRequires({ requires: ['2-5', '', null] })).toEqual(['2-5']);
    expect(stageRequires('1-1')).toEqual([]);
    expect(stageRequires('2-1')).toEqual(['1-5']);
    expect(stageRequires('nope')).toEqual([]);
  });

  it('is met only when every requirement is cleared', () => {
    const cleared = new Set(['2-5']);
    const is = (id) => cleared.has(id);
    expect(requirementsMet({ requires: null }, is)).toBe(true);
    expect(requirementsMet({ requires: '2-5' }, is)).toBe(true);
    expect(requirementsMet({ requires: '1-10' }, is)).toBe(false);
    expect(requirementsMet({ requires: ['2-5', '1-10'] }, is)).toBe(false);
    cleared.add('1-10');
    expect(requirementsMet({ requires: ['2-5', '1-10'] }, is)).toBe(true);
  });

  it('every StageDef requirement names a real stage', () => {
    for (const s of STAGES) for (const id of stageRequires(s)) expect(STAGE_MAP[id], `${s.id} requires ${id}`).toBeTruthy();
  });
});

describe('old saves keep every unlock (Act I as before; Act II opens after 1-5)', () => {
  it('Act I is CAMPAIGN_IDS\'s head, in the same order; campaign stages carry act 1 and their finale', () => {
    expect(CAMPAIGN_IDS.slice(0, 40)).toEqual(ACT1);
    expect(campaignStages().slice(0, 40).map((s) => s.id)).toEqual(ACT1);
    for (const id of ACT1) {
      expect(STAGE_MAP[id].act, id).toBe(1);
      expect(STAGE_MAP[id].finale, id).toBe(id.split('-')[1] === '5');
    }
  });

  for (const [name, p] of Object.entries(SAVES())) {
    it(`${name}: every stage unlocks exactly as the old single-requires rule says, and story agrees`, () => {
      for (const s of STAGES) {
        expect(isStageUnlocked(p, s.id), `${name} ${s.id}`).toBe(oldUnlocked(p, s.id));
        expect(stageOpen(p, s.id), `${name} ${s.id} story`).toBe(isStageUnlocked(p, s.id));
      }
    });
    it(`${name}: nextStage is unchanged (first uncleared Act I stage)`, () => {
      expect(nextStage(p)).toBe(oldNext(p));
    });
  }

  it('veterans keep their next stage: fresh 1-1, up to 3-2 → 3-3, late (all Normal) → 1-1 already cleared → null', () => {
    const s = SAVES();
    expect(nextStage(s.fresh)).toBe('1-1');
    expect(nextStage(s.upTo32)).toBe('3-3');
    expect(nextStage(s.late)).toBe(null);
  });

  it('chapter progress and ribbons default to Act I', () => {
    const p = veteran('mid');
    for (const c of CHAPTERS) {
      expect(chapterProgress(p, c.id)).toEqual(chapterProgress(p, c.id, 1));
      expect(chapterProgress(p, c.id).total).toBe(5);
      // Act II: chapter 1's five (Gate Arc Step 1), none of them cleared by a veteran of the old build
      const n2 = c.id === 1 ? 5 : 0;
      expect(chapterProgress(p, c.id, 2)).toEqual({ cleared: 0, total: n2, medals: { easy: 0, normal: 0, hard: 0, nightmare: 0 } });
      expect(chapterRibbons(p, c.id, 2)).toEqual({ have: 0, total: n2 * 20 });
      expect(chapterRibbons(p, c.id).total).toBe(100);
    }
  });
});

describe('play order and the Next button', () => {
  it('stageOrderKey sorts (chapter, act, n): 1-5 < 1-6 < 1-10 < 2-1; other ids last', () => {
    const ids = ['2-1', '1-10', '1-6', '1-5', 'res-books-1', '1-1', '8-10', '8-5'];
    expect([...ids].sort((a, b) => stageOrderKey(a) - stageOrderKey(b) || (a < b ? -1 : 1))).toEqual(['1-1', '1-5', '1-6', '1-10', '2-1', '8-5', '8-10', 'res-books-1']);
    expect(stageOrderKey('boss-lych')).toBe(Infinity);
    expect(stageOrderKey(undefined)).toBe(Infinity);
    expect(stageOrderKey('1-10')).toBeLessThan(stageOrderKey('2-1'));
  });

  it('followingStage stays inside Act I: 1-5 → 2-1, 7-5 → 8-1, 8-5 → null (never 1-6); non-campaign → null', () => {
    expect(followingStage('1-1')).toBe('1-2');
    expect(followingStage('1-5')).toBe('2-1');
    expect(followingStage('7-5')).toBe('8-1');
    expect(followingStage('8-5')).toBe(null);
    expect(followingStage('res-books-1')).toBe(null);
    expect(followingStage('nope')).toBe(null);
    for (let i = 0; i < ACT1.length - 1; i++) expect(nextInAct(ACT1[i])).toBe(ACT1[i + 1]);
  });

  it('actStages: Act I is chapter.stages, Act II chapter.act2 (chapter 1 only so far; empty until it ships)', () => {
    for (const c of CHAPTERS) {
      expect(actStages(c.id, 1)).toEqual(c.stages);
      expect(actStages(String(c.id), '1')).toEqual(c.stages);
      expect(actStages(c.id, 2)).toEqual(c.act2);
      expect(c.act2).toEqual(c.id === 1 ? ['1-6', '1-7', '1-8', '1-9', '1-10'] : []);
    }
    expect(actStages(9, 1)).toEqual([]);
    expect(actStages(1, 3)).toEqual([]);
  });
});

describe('a two-key x-6 (fixture stage injected into STAGE_MAP for the test)', () => {
  // (1-10 is a real stage since Step 1; only 2-6 is a fixture)
  const FIX = ['2-6'];
  afterEach(() => { for (const id of FIX) delete STAGE_MAP[id]; });
  const inject = () => {
    const base = { name: 'Fixture', mapId: 'sakura_court', desc: 'x', budget: [8, 200], pool: [{ enemy: 'slime_green', weight: 1, from: 1 }], fam: ['charm', 'rune'], scenery: { props: ['x'] } };
    STAGE_MAP['2-6'] = act2Stage({ ...base, id: '2-6' });
  };

  it('needs both 2-5 and 1-10, in unlocks and in story', () => {
    inject();
    const p = mark(createProfile(), ACT1.slice(0, 10)); // through 2-5
    expect(isStageUnlocked(p, '2-6')).toBe(false);
    expect(stageOpen(p, '2-6')).toBe(false);
    mark(p, ['1-10']);
    expect(isStageUnlocked(p, '2-6')).toBe(true);
    expect(stageOpen(p, '2-6')).toBe(true);
    const q = mark(createProfile(), ['1-10']); // 1-10 alone (impossible in play) is not enough either
    expect(isStageUnlocked(q, '2-6')).toBe(false);
  });

  it('orders and chains by act: 1-10 sorts before 2-1 and 2-6 after 2-5', () => {
    inject();
    expect(stageOrderKey('1-10')).toBeLessThan(stageOrderKey('2-1'));
    expect(stageOrderKey('2-6')).toBeGreaterThan(stageOrderKey('2-5'));
    expect(STAGE_MAP['2-6'].act).toBe(2);
  });
});
