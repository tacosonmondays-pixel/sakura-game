// Tryout Day M3 menus (docs/specs/TRYOUT_DAY.md §13.2, §13.3, §13.10): the hub's state and Wakaba's line for it, the
// Marbles wallet on the Tryout routes only, the Jar's shelf counts, the Yearbook's page kinds, the Grade twist and
// locked-Grade lines.
import { describe, it, expect } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import { TRYOUT } from '../../src/data/tryout.js';
import { linesFor } from '../../src/ui/hostLines.js';
import { walletsFor, walletDef, walletValue } from '../../src/ui/wallets.js';
import { hubState, stateWord, TRYOUT_HOST } from '../../src/ui/screens/tryout.js';
import { shelfCount, shelfTabs } from '../../src/ui/screens/tryoutJar.js';
import { pageKind, sectionCounts, sectionTabs } from '../../src/ui/screens/tryoutYearbook.js';
import { newRunRecord, putTryoutRun, TRYOUT_UNLOCK } from '../../src/systems/tryoutRuns.js';
import { gradeTwist, gradeWhy, HUB_TEXT, CLASS_TEXT } from '../../src/ui/text/tryout.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { canHost } from '../../src/ui/hosts.js';

const open = () => {
  const p = createProfile();
  for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5', '2-1', '2-2', '2-3', '2-4', '2-5']) p.progress.stages[id] = { normal: true, clears: 1 };
  return p;
};

describe('the Tryout hub', () => {
  it('Wakaba hosts: a student in uniform with finished art', () => {
    expect(UNIT_MAP[TRYOUT_HOST]?.name).toBe('Wakaba');
    expect(canHost(TRYOUT_HOST)).toBe(true);
  });
  it('the four states: locked, fresh, run in progress, weekly done; Wakaba\'s first line follows', () => {
    const locked = hubState(createProfile());
    expect(stateWord(locked)).toBe('locked');
    expect(linesFor('tryout', locked)[0]).toBe(`Clear ${TRYOUT_UNLOCK} and tryouts open!`);
    const p = open();
    const fresh = hubState(p);
    expect(stateWord(fresh)).toBe('fresh');
    expect(fresh.weeklyOpen).toBe(false); // (before a Grade 4 clear)
    expect(linesFor('tryout', fresh)[0]).toBe('Tryouts today! Pick your three!');
    putTryoutRun(p, newRunRecord(p, { seed: 7, grade: 1, mapId: 'sakura_terrace', hero: 'hikari', squad: ['aoi', 'rei', 'azami'] }));
    const run = hubState(p);
    expect(stateWord(run)).toBe('run');
    expect(linesFor('tryout', run)[0]).toBe('Your class is waiting, Sensei!');
    expect(linesFor('tryout', run)).not.toContain('Tryouts today! Pick your three!');
    expect(stateWord({ locked: false, running: false, weeklyDone: true })).toBe('weekly-done');
  });
  it('Marbles sit in the top bar on the Tryout routes only (#/tryout, /class, /jar and /yearbook are all the route "tryout")', () => {
    expect(walletDef('marbles')).toMatchObject({ label: 'Marbles', glyph: 'marble' });
    expect(walletsFor('tryout')).toContain('marbles');
    for (const r of ['lobby', 'student', 'recruit', 'backpack', 'mall', 'campaign', 'coop']) expect(walletsFor(r), r).not.toContain('marbles');
  });
  it('the bar counts Marbles from the mission counters (registerWallet count), without writing to the save', () => {
    const p = open();
    p.missions.counters = { ...(p.missions.counters || {}), 'ty:mb': 37 };
    const before = JSON.stringify(p);
    expect(walletDef('marbles').item).toBe(null);
    expect(walletValue('marbles', p, () => 0)).toBe(37);
    expect(JSON.stringify(p)).toBe(before);
  });
  it('the locked tiles say what opens them', () => {
    expect(HUB_TEXT.locked(TRYOUT_UNLOCK)).toBe(`Clear ${TRYOUT_UNLOCK} to open`);
    expect(HUB_TEXT.weeklyLocked).toMatch(/Grade 4/);
  });
});

describe('Before Class text', () => {
  it('every Grade has a twist line from the run table, no gaps', () => {
    for (let n = 1; n <= 12; n++) {
      const line = gradeTwist(TRYOUT.grades, TRYOUT.windows, n);
      expect(line, `Grade ${n}`).toMatch(/\S/);
      expect(line, `Grade ${n}`).not.toMatch(/undefined|NaN/);
    }
    expect(gradeTwist(TRYOUT.grades, TRYOUT.windows, 1)).toMatch(/^Spring Term/);
    expect(gradeTwist(TRYOUT.grades, TRYOUT.windows, 12)).toMatch(/no healing/);
  });
  it('a locked Grade says why', () => {
    expect(gradeWhy('ladder', 3, '4-5')).toBe('Clear Grade 2 to open Grade 3.');
    expect(gradeWhy('window', 3, '4-5')).toMatch(/4-5/);
    expect(gradeWhy('build', 13, '')).toMatch(/later/);
    expect(CLASS_TEXT.pickMore(1)).toBe('Pick 1 more girl to start.');
  });
});

describe('the Jar and the Yearbook', () => {
  it('shelf counts: owned / for sale, Materials stock left / weekly stock', () => {
    expect(shelfCount('desk', [{ owned: true }, { owned: false }])).toBe('1/2');
    expect(shelfCount('material', [{ left: 2, perWeek: 3 }, { left: 0, perWeek: 2 }])).toBe('2/5');
    // the kit rail's tabs: a glyph, the word, the count (sideRail { icon, count })
    const tabs = shelfTabs({ desk: [{ owned: true }, { owned: false }], cosmetic: [], material: [{ left: 1, perWeek: 2 }] });
    expect(tabs.map((t) => [t.id, t.icon, t.count])).toEqual([['desk', 'desk', '1/2'], ['cosmetic', 'sparkles', '0/0'], ['material', 'box', '1/2']]);
  });
  it('a page per student: colour (yours), pencil (a Loaner who tried out), blank', () => {
    expect(pageKind({ stamped: true, colour: true })).toBe('colour');
    expect(pageKind({ stamped: true, colour: false })).toBe('pencil');
    expect(pageKind({ stamped: false, colour: false })).toBe('blank');
    expect(sectionCounts({ girls: [{ stamped: true }, { stamped: false }], cards: [{ taken: true }], bosses: ['x'], records: [] })).toEqual({ girls: '1/2', cards: '1/1', bosses: '1', records: '0' });
    const tabs = sectionTabs({ girls: [{ stamped: true }, { stamped: false }], cards: [{ taken: true }], bosses: ['x'], records: [] });
    expect(tabs.map((t) => [t.id, t.icon, t.count])).toEqual([['girls', 'cap', '1/2'], ['cards', 'stamp', '1/1'], ['bosses', 'crown', '1'], ['records', 'trophy', '0']]);
  });
});
