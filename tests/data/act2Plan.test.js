// The Act II plan (src/data/stages.js ACT2_PLAN; docs/CAMPAIGN.md "Act II"; docs/specs/GATE_ARC.md §19 Difficulty):
// all 40 rows are computed from the Act I ramp, and must equal the PROPOSED table of the Gate Arc tech notes (§5.2)
// within 0.01. These are the starting values of the first balance run: a change here is a balance decision.
import { describe, it, expect } from 'vitest';
import {
  ACT2_PLAN, ACT2_PLAN_MAP, CHAPTER_HP_PASS_MEAN, ACT2_MEDAL_GEM_MUL, CHAPTERS, HERO_HP_PASS, STAGE_MAP, CAMPAIGN_IDS,
  act2Stage, stageRequires,
} from '../../src/data/stages.js';
import { getMap } from '../../src/data/maps.js';

/** The PROPOSED Act II hpScale (x-6 … x-10) per chapter. */
const HP = {
  1: [2.15, 2.25, 2.37, 2.48, 2.6],
  2: [2.87, 3.01, 3.15, 3.31, 3.47],
  3: [2.87, 3.02, 3.16, 3.32, 3.49],
  4: [5.61, 5.89, 6.17, 6.49, 6.79],
  5: [6.37, 6.68, 7.01, 7.35, 7.72],
  6: [7.47, 7.84, 8.23, 8.62, 9.04],
  7: [11.74, 12.33, 12.94, 13.58, 14.24],
  8: [8.53, 8.94, 9.39, 9.85, 10.33],
};
/** The rung before the pass (hpScaleAt(5c + k − 1)). */
const RUNG = {
  1: [1.27, 1.33, 1.4, 1.47, 1.54], 2: [1.62, 1.7, 1.78, 1.87, 1.96], 3: [2.05, 2.16, 2.26, 2.37, 2.49],
  4: [2.61, 2.74, 2.87, 3.02, 3.16], 5: [3.32, 3.48, 3.65, 3.83, 4.02], 6: [4.22, 4.43, 4.65, 4.87, 5.11],
  7: [5.36, 5.63, 5.91, 6.2, 6.5], 8: [6.82, 7.15, 7.51, 7.88, 8.26],
};
const WAVES = {
  1: [18, 20, 20, 22, 22], 2: [22, 22, 24, 24, 25], 3: [24, 25, 25, 26, 26], 4: [25, 26, 26, 27, 28],
  5: [26, 27, 27, 28, 28], 6: [28, 28, 29, 29, 30], 7: [28, 29, 29, 30, 30], 8: [30, 30, 31, 31, 32],
};
/** cashScale at x-6 and x-10 and start cash at x-6 and x-10. */
const CASH = {
  1: [1.15, 1.3, 720, 740], 2: [1.34, 1.5, 750, 770], 3: [1.54, 1.73, 770, 790], 4: [1.78, 1.99, 800, 820],
  5: [2.05, 2.3, 830, 850], 6: [2.37, 2.66, 850, 870], 7: [2.74, 3.07, 880, 900], 8: [3.16, 3.55, 900, 900],
};
const MEANS = { 1: 1.69, 2: 1.77, 3: 1.4, 4: 2.15, 5: 1.92, 6: 1.77, 7: 2.19, 8: 1.25 };

describe('ACT2_PLAN', () => {
  it('has 40 rows, c-6 … c-10 for chapters 1-8, in (chapter, n) order; chapters 1-3 registered (Steps 1-3)', () => {
    expect(ACT2_PLAN).toHaveLength(40);
    expect(ACT2_PLAN.map((r) => r.id)).toEqual(CHAPTERS.flatMap((c) => [6, 7, 8, 9, 10].map((n) => `${c.id}-${n}`)));
    for (const r of ACT2_PLAN) {
      expect(ACT2_PLAN_MAP[r.id]).toBe(r);
      expect(r.n).toBe(5 + r.k);
      expect(Object.isFrozen(r)).toBe(true);
    }
    // Gate Arc Steps 1-3 register chapters 1-3's Act II (c-6 … c-10), appended after Act I
    for (const r of ACT2_PLAN) expect(!!STAGE_MAP[r.id], r.id).toBe(r.chapter <= 3);
    expect(CAMPAIGN_IDS).toHaveLength(55);
    expect(CAMPAIGN_IDS.slice(40)).toEqual([1, 2, 3].flatMap((c) => [6, 7, 8, 9, 10].map((n) => `${c}-${n}`)));
  });

  it('chapter means of the hero-rework HP pass are 1.69 / 1.77 / 1.4 / 2.15 / 1.92 / 1.77 / 2.19 / 1.25', () => {
    expect({ ...CHAPTER_HP_PASS_MEAN }).toEqual(MEANS);
    for (const ch of CHAPTERS) {
      const mean = ch.stages.reduce((a, id) => a + HERO_HP_PASS[id], 0) / 5;
      expect(CHAPTER_HP_PASS_MEAN[ch.id]).toBeCloseTo(mean, 2);
    }
  });

  it('hpScale = rung × chapter mean, equal to the proposed table (±0.01); hpPass is the mean', () => {
    for (const r of ACT2_PLAN) {
      expect(Math.abs(r.hpScale - HP[r.chapter][r.k - 1]), `${r.id} hpScale ${r.hpScale}`).toBeLessThanOrEqual(0.01);
      expect(Math.abs(r.hpScale / r.hpPass - RUNG[r.chapter][r.k - 1]), `${r.id} rung`).toBeLessThanOrEqual(0.01);
      expect(r.hpPass).toBe(MEANS[r.chapter]);
    }
    // spot checks named in the build plan, and the campaign's new top (7-10 > 7-5's 12.26)
    expect(ACT2_PLAN_MAP['1-6'].hpScale).toBe(2.15);
    expect(ACT2_PLAN_MAP['7-10'].hpScale).toBe(14.24);
    expect(Math.max(...ACT2_PLAN.map((r) => r.hpScale))).toBe(14.24);
  });

  it('every Act II starts at or above its own x-5 (base ramp) and climbs within the act', () => {
    for (const ch of CHAPTERS) {
      const rows = ACT2_PLAN.filter((r) => r.chapter === ch.id);
      const x5 = STAGE_MAP[`${ch.id}-5`];
      expect(rows[0].hpScale / rows[0].hpPass, `${ch.id}-6 base vs ${ch.id}-5`).toBeGreaterThanOrEqual(x5.hpScale / x5.hpPass);
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i].hpScale, rows[i].id).toBeGreaterThan(rows[i - 1].hpScale);
        expect(rows[i].waves, rows[i].id).toBeGreaterThanOrEqual(rows[i - 1].waves);
        expect(rows[i].startCash, rows[i].id).toBeGreaterThanOrEqual(rows[i - 1].startCash);
      }
    }
  });

  it('waves come from chapter c+1\'s Act I row (chapter 8: 30/30/31/31/32)', () => {
    for (const r of ACT2_PLAN) {
      expect(r.waves, r.id).toBe(WAVES[r.chapter][r.k - 1]);
      if (r.chapter < 8) expect(r.waves, r.id).toBe(STAGE_MAP[`${r.chapter + 1}-${r.k}`].waves);
    }
  });

  it('cashScale and start cash come from the pre-pass rung; start cash never above 900', () => {
    for (const ch of CHAPTERS) {
      const rows = ACT2_PLAN.filter((r) => r.chapter === ch.id);
      const [c6, c10, s6, s10] = CASH[ch.id];
      expect(rows[0].cashScale, `${ch.id}-6`).toBeCloseTo(c6, 2);
      expect(rows[4].cashScale, `${ch.id}-10`).toBeCloseTo(c10, 2);
      expect(rows[0].startCash, `${ch.id}-6`).toBe(s6);
      expect(rows[4].startCash, `${ch.id}-10`).toBe(s10);
    }
    for (const r of ACT2_PLAN) expect(r.startCash, r.id).toBeLessThanOrEqual(900);
  });

  it('tier comes from the (c+1)-k slot (chapter 8: expert); drops and Ironclad from chapter c+1 (8 keeps 8)', () => {
    for (const r of ACT2_PLAN) {
      expect(r.tier, r.id).toBe(r.chapter < 8 ? STAGE_MAP[`${r.chapter + 1}-${r.k}`].tier : 'expert');
      expect(r.dropChapter).toBe(Math.min(8, r.chapter + 1));
      expect(r.modeChapter).toBe(Math.min(8, r.chapter + 1));
      expect(r.medalGemMul).toBe(0.5);
    }
    expect(ACT2_MEDAL_GEM_MUL).toBe(0.5);
    expect(['1-6', '1-7', '1-8', '1-9', '1-10'].map((id) => ACT2_PLAN_MAP[id].tier)).toEqual(['beginner', 'intermediate', 'intermediate', 'intermediate', 'advanced']);
  });

  it('requires: x-6 needs x-5 and (c-1)-10 (1-6 only 1-5); x-7 … x-10 the Act II stage before; x-10 is the finale', () => {
    for (const r of ACT2_PLAN) {
      const want = r.k > 1 ? `${r.chapter}-${4 + r.k}` : r.chapter === 1 ? '1-5' : [`${r.chapter}-5`, `${r.chapter - 1}-10`];
      expect(r.requires, r.id).toEqual(want);
      expect(r.finale, r.id).toBe(r.k === 5);
    }
  });
});

describe('act2Stage (the builder S1d registers stages with)', () => {
  const base = {
    name: 'Fixture', mapId: 'sakura_court', desc: 'A fixture stage.', budget: [8, 200],
    pool: [{ enemy: 'slime_green', weight: 1, from: 1 }], fam: ['charm', 'rune'], scenery: { props: ['streetLamps'] },
  };

  it('takes every number from the plan; 1-10 first clear = 120 gems + a recruit ticket', () => {
    const s = act2Stage({ ...base, id: '1-10', crown: { id: 'crown_slime', chance: 0.35, tokens: 1 } });
    const r = ACT2_PLAN_MAP['1-10'];
    expect(getMap(s.mapId)).toBeTruthy();
    expect(s).toMatchObject({
      kind: 'campaign', chapter: 1, act: 2, finale: true, waves: r.waves, hpScale: r.hpScale, hpPass: r.hpPass,
      cashScale: r.cashScale, startCash: r.startCash, tier: r.tier, requires: '1-9', medalGemMul: 0.5, modeChapter: 2, lives: 100,
    });
    expect(s.firstClear).toEqual([{ id: 'coins', count: 2000 }, { id: 'book_rare', count: 2 }, { id: 'gems', count: 120 }, { id: 'ticket_recruit', count: 1 }]);
    // chapter 2's drop table (2-x coins), the crown on top
    const coins = s.drops.find((d) => d.item === 'coins');
    expect([coins.min, coins.max]).toEqual([900, 1500]);
    expect(s.drops.map((d) => d.item)).toContain('crown_slime');
    expect(s.waveGen.budget.start).toBe(8);
  });

  it('a two-key x-6 carries both requirements as a fresh array', () => {
    const s = act2Stage({ ...base, id: '2-6' });
    expect(s.requires).toEqual(['2-5', '1-10']);
    expect(s.requires).not.toBe(ACT2_PLAN_MAP['2-6'].requires);
    expect(stageRequires(s)).toEqual(['2-5', '1-10']);
    expect(act2Stage({ ...base, id: '2-6' }).firstClear.some((x) => x.id === 'gems')).toBe(false);
  });

  it('refuses a planned field and a non-Act II id', () => {
    expect(() => act2Stage({ ...base, id: '1-6', hpScale: 3 })).toThrow(/ACT2_PLAN/);
    expect(() => act2Stage({ ...base, id: '1-6', waves: 12 })).toThrow(/ACT2_PLAN/);
    expect(() => act2Stage({ ...base, id: '1-6', requires: '1-4' })).toThrow(/ACT2_PLAN/);
    expect(() => act2Stage({ ...base, id: '1-5' })).toThrow(/Act II/);
    expect(() => act2Stage({ ...base, id: '1-11' })).toThrow(/Act II/);
  });
});
