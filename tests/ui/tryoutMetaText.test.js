// Tryout Day's meta text (src/ui/text/tryout.js): the Class Photo's reward lines and every Marble Jar item named.
import { describe, it, expect } from 'vitest';
import { rewardLines, JAR_TEXT, JAR_SHELVES, JAR_NOTES, JAR_ERRORS } from '../../src/ui/text/tryout.js';
import { TRYOUT_META } from '../../src/data/tryoutMeta.js';

const run = (o = {}) => ({
  grade: 1, week: 37, cap: 150, gradeUp: false, stamps: [],
  marbles: { earned: 37, paid: 37, over: 0, grade: 0, yearbook: 0, chest: 0 },
  box: { fill: 7, items: [{ id: 'book_common', count: 2 }, { id: 'mat_rune_common', count: 3 }] },
  coins: { waves: 28, paidWaves: 28, rate: 24, coins: 672 },
  ...o,
});

describe('the Class Photo reward lines', () => {
  it('Marbles with the week, the Lunchbox, coins, stamps and the Grade', () => {
    const lines = rewardLines(run({ gradeUp: true, stamps: ['girl:aoi', 'card:E01'], marbles: { earned: 37, paid: 37, over: 0, grade: 10, yearbook: 5, chest: 0 } }));
    expect(lines.map((l) => l.key)).toEqual(['marbles', 'box', 'coins', 'stamps', 'grade']);
    expect(lines[0].text).toBe('Marbles +37 · 37 / 150 this week · +10 Grade 1 first clear · +5 Yearbook');
    expect(lines[1].text).toMatch(/^Lunchbox 7\/7 full: 2× Doodle Notes, 3× /);
    expect(lines[2].text).toBe('+672 coins (28 waves × 24)');
    expect(lines[3].text).toBe('Yearbook: 2 new stamps');
    expect(lines[4].text).toBe('Grade 1 cleared: Grade 2 is open');
    expect(rewardLines(run({ gradeUp: true, grade: 12 })).at(-1).text).toBe('Grade 12 cleared: the whole ladder!');
  });

  it('says when a weekly limit is reached, and shows nothing for an already-paid co-op run', () => {
    const lines = rewardLines(run({ week: 150, marbles: { earned: 30, paid: 4, over: 26, grade: 0, yearbook: 0, chest: 0 }, box: { fill: 0, items: [], weekFull: true }, coins: { waves: 28, paidWaves: 0, rate: 24, coins: 0 } }));
    expect(lines.map((l) => l.text)).toEqual([
      'Marbles +4 · 150 / 150 this week · weekly cap reached',
      'Lunchbox: this week\'s 3 are already open',
      'Coins: this week\'s 150 waves are paid',
    ]);
    expect(rewardLines(run({ marbles: { earned: 37, paid: 7, over: 0, grade: 0, yearbook: 0, chest: 30 } }))[0].text).toMatch(/\+30 Weekly chest/);
    expect(rewardLines({ already: true })).toEqual([]);
    expect(rewardLines(null)).toEqual([]);
  });
});

describe('the Marble Jar text', () => {
  it('every item, shelf and refusal has words (12 px UI copy: short lines)', () => {
    for (const it of TRYOUT_META.jar) {
      expect(JAR_TEXT[it.id]?.name, it.id).toBeTruthy();
      expect(JAR_TEXT[it.id].line.length, it.id).toBeLessThanOrEqual(48);
      expect(JAR_SHELVES[it.shelf] && JAR_NOTES[it.shelf], it.shelf).toBeTruthy();
    }
    for (const e of ['funds', 'owned', 'soldOut', 'family', 'unknown']) expect(JAR_ERRORS[e]).toBeTruthy();
  });
});
