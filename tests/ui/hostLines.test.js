// UI M5a: what the host girl says (src/ui/hostLines.js, docs/specs/UI_DIRECTION.md §5.10 E1). Every line in every
// state is true in that state (a tap cycles through all of them), fits her bubble's character cap (34 on a hub, 24 on
// a list) with at most one number, and each screen keeps a neutral line that shows in every state.
import { describe, it, expect } from 'vitest';
import { LINES, linesFor, lineOk, lineKind, numberCount, MAX_LINE, LIST_SCREENS } from '../../src/ui/hostLines.js';
import { HOSTS } from '../../src/ui/hosts.js';
import { HOST_STATE_AXES, hostStates } from '../fixtures/hostStates.js';

const n = (v) => (v == null || v === '' ? null : Math.max(0, Math.floor(Number(v))));
const always = () => true;

/**
 * What each line claims, as [pattern, (state, match) => is it true]. A line that matches no pattern fails the test
 * too, so a new line can only ship with its claim written down here.
 */
const CLAIMS = {
  missions: [
    [/^Next up: (.+)!$/, (s, m) => s.next === m[1]],
    [/^Titan Trials are open this week!$/, (s) => !!s.titansOpen],
    [/^Double drops in (.+)!$/, (s, m) => s.doubleDrop === m[1]],
    [/^I'll cheer you on, Sensei!$/, always],
  ],
  commissions: [
    [/^A commission is ready!$/, (s) => n(s.ready) === 1],
    [/^(\d+) commissions are ready!$/, (s, m) => n(s.ready) === Number(m[1]) && n(s.ready) > 1],
    [/^Today's login gift is waiting!$/, (s) => !!s.loginReady],
    [/^All done today\. Nice work!$/, (s) => !!s.allDone && !(n(s.ready) > 0) && !s.loginReady],
    [/^Little by little, it all counts!$/, always],
  ],
  login: [
    [/^Today's login gift is waiting!$/, (s) => !!s.claimable],
    [/^Day (\d+) stamped\. See you tomorrow!$/, (s, m) => !s.claimable && n(s.day) === Number(m[1])],
    [/^A new gift every day you drop by!$/, always],
  ],
  bounty: [
    [/^Double drops end soon\. Last call!$/, (s) => !!s.endsSoon],
    [/^Double drops until the reset!$/, always],
    [/^Bring a full team, Sensei!$/, always],
  ],
  assault: [
    [/^Clear more stages first, Sensei!$/, (s) => !!s.locked],
    [/^Bosses drop crowns\. Shall we try\?$/, (s) => !s.locked],
    [/^The crowns wait at the top!$/, always],
  ],
  titans: [
    [/^Clear more stages first, Sensei!$/, (s) => !!s.locked],
    [/^One Trial Key left\. Make it count!$/, (s) => !s.locked && n(s.keys) === 1],
    [/^(\d+) Trial Keys this week\. Ready\?$/, (s, m) => !s.locked && n(s.keys) === Number(m[1]) && n(s.keys) > 1],
    [/^No keys left\. More next week!$/, (s) => !s.locked && n(s.keys) === 0],
    [/^A new titan stands this week!$/, (s) => !s.locked && !!s.newWeek],
    [/^Let's find its weak spot!$/, (s) => !s.locked && n(s.keys) !== 0], // an invitation: only with keys (or unknown)
    [/^Every titan has a weak spot\.$/, always],
  ],
  mall: [
    [/^Fresh stock soon!$/, (s) => !!s.restockSoon],
    [/^Welcome in, Sensei!$/, always],
    [/^Take your time!$/, always],
  ],
  mail: [
    [/^A letter has a gift!$/, (s) => n(s.gifts) === 1],
    [/^(\d+) letters have gifts!$/, (s, m) => n(s.gifts) === Number(m[1]) && n(s.gifts) > 1],
    [/^Don't forget to claim!$/, (s) => n(s.gifts) > 0],
    [/^All caught up, Sensei!$/, (s) => n(s.gifts) === 0],
    [/^Mail from the academy!$/, always],
  ],
  happening: [
    [/^An event ends soon!$/, (s) => !!s.endingSoon],
    [/^(.+) ends soon!$/, (s, m) => s.endingSoon === m[1]],
    [/^One thing on right now!$/, (s) => n(s.running) === 1],
    [/^(\d+) things on right now!$/, (s, m) => n(s.running) === Number(m[1]) && n(s.running) > 1],
    [/^Quiet for now\. Rest up!$/, (s) => n(s.running) === 0 && !s.endingSoon],
    [/^Events pop up here!$/, always],
  ],
  multiplayer: [
    [/^A friend invited you! Join\?$/, (s) => n(s.invites) === 1],
    [/^(\d+) invites are waiting!$/, (s, m) => n(s.invites) === Number(m[1]) && n(s.invites) > 1],
    [/^Make a room and invite a friend!$/, always],
    [/^Let's team up, Sensei!$/, always],
  ],
};

/** null when the line is true in `s`, else why not. */
function contradiction(screen, line, s) {
  for (const [re, ok] of CLAIMS[screen]) {
    const m = line.match(re);
    if (m) return ok(s, m) ? null : `claims ${re} but the state is ${JSON.stringify(s)}`;
  }
  return `has no claim written in the test (${JSON.stringify(s)})`;
}

describe('host lines', () => {
  it('every hosted screen has a line table, a claim table and a state grid', () => {
    for (const screen of Object.keys(HOSTS)) {
      expect(LINES[screen], screen).toBeTypeOf('function');
      expect(CLAIMS[screen], screen).toBeTruthy();
      expect(HOST_STATE_AXES[screen], screen).toBeTruthy();
    }
  });

  it('every line in every state is true in that state (a tap never cycles to a line that contradicts the screen)', () => {
    const bad = [];
    for (const screen of Object.keys(LINES)) {
      for (const s of hostStates(screen)) {
        for (const line of linesFor(screen, s)) {
          const why = contradiction(screen, line, s);
          if (why) bad.push(`${screen}: "${line}" ${why}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('each screen has a neutral line that shows in every state, and every state has a line', () => {
    for (const screen of Object.keys(LINES)) {
      const states = hostStates(screen);
      const sets = states.map((s) => linesFor(screen, s));
      expect(sets.every((l) => l.length > 0), screen).toBe(true);
      const everywhere = sets.reduce((acc, l) => acc.filter((x) => l.includes(x)));
      expect(everywhere.length, `${screen}: a line true in every state`).toBeGreaterThan(0);
      // the neutral lines close the cycle: the last line shown is one of them in every state
      for (const l of sets) expect(everywhere, screen).toContain(l[l.length - 1]);
    }
  });

  it('every line fits its bubble: ≤ 34 characters on a hub, ≤ 24 on a list, at most one number', () => {
    for (const screen of Object.keys(LINES)) {
      const max = MAX_LINE[lineKind(screen)];
      for (const s of hostStates(screen)) {
        for (const l of linesFor(screen, s)) {
          expect(l.length, `${screen}: "${l}"`).toBeLessThanOrEqual(max);
          expect(numberCount(l), l).toBeLessThanOrEqual(1);
        }
      }
    }
    expect([...LIST_SCREENS].sort()).toEqual(['happening', 'mail', 'mall']);
    expect(lineKind('missions')).toBe('hub');
  });

  it('the state picks the first line', () => {
    expect(linesFor('mail', { gifts: 2 })[0]).toBe('2 letters have gifts!');
    expect(linesFor('mail', { gifts: 1 })[0]).toBe('A letter has a gift!');
    expect(linesFor('mail', { gifts: 0 })[0]).toBe('All caught up, Sensei!');
    expect(linesFor('commissions', { ready: 3 })[0]).toBe('3 commissions are ready!');
    expect(linesFor('commissions', { allDone: true, ready: 0 })[0]).toBe('All done today. Nice work!');
    expect(linesFor('happening', { running: 3, endingSoon: 'Halloween' })[0]).toBe('Halloween ends soon!');
    expect(linesFor('multiplayer', { invites: 1 })[0]).toBe('A friend invited you! Join?');
    expect(linesFor('missions', { next: '2-3 Shield Wall' })[0]).toBe('Next up: 2-3 Shield Wall!');
    expect(linesFor('assault', { locked: true })[0]).toBe('Clear more stages first, Sensei!');
  });

  it('the empty-state lines show only in the empty state (the M5a review cases)', () => {
    expect(linesFor('mail', { gifts: 2 })).not.toContain('All caught up, Sensei!');
    expect(linesFor('mail', { gifts: 2 })).toEqual(['2 letters have gifts!', 'Don\'t forget to claim!', 'Mail from the academy!']);
    expect(linesFor('happening', { running: 3 })).not.toContain('Quiet for now. Rest up!');
    expect(linesFor('happening', { endingSoon: 'Halloween', running: 0 })).not.toContain('Quiet for now. Rest up!');
    expect(linesFor('assault', { locked: true })).not.toContain('Bosses drop crowns. Shall we try?');
    expect(linesFor('titans', { keys: 0 })).not.toContain('Let\'s find its weak spot!');
    expect(linesFor('commissions', { allDone: true, loginReady: true })).not.toContain('All done today. Nice work!');
  });

  it('a line that would break the rules is skipped, and a true line shows in its place', () => {
    const long = linesFor('happening', { endingSoon: 'A Festival Name So Long It Could Never Fit One Line', running: 1 });
    expect(long[0]).toBe('An event ends soon!');
    expect(linesFor('happening', { endingSoon: 'Pumpkin Lantern Night' })[0]).toBe('An event ends soon!'); // 32 > 24
    const twoNumbers = linesFor('missions', { next: '12-5 Stage 3' });
    expect(twoNumbers.every((l) => numberCount(l) <= 1)).toBe(true);
    expect(twoNumbers[0]).not.toMatch(/Next up/);
  });

  it('a cute host says "Let\'s", never "Let us"', () => {
    for (const screen of Object.keys(LINES)) for (const s of hostStates(screen)) for (const l of linesFor(screen, s)) expect(l, screen).not.toMatch(/\bLet us\b/);
  });

  it('numbers: a stage id, a time and a grouped count each count once; the caps by kind', () => {
    expect(numberCount('Next up: 2-3 Shield Wall')).toBe(1);
    expect(numberCount('Back at 12:05')).toBe(1);
    expect(numberCount('1,200 coins')).toBe(1);
    expect(numberCount('2 of 5')).toBe(2);
    expect(lineOk('x'.repeat(34))).toBe(true);
    expect(lineOk('x'.repeat(35))).toBe(false);
    expect(lineOk('x'.repeat(24), 'list')).toBe(true);
    expect(lineOk('x'.repeat(25), 'list')).toBe(false);
    expect(lineOk('')).toBe(false);
  });

  it('an unknown screen has no lines', () => {
    expect(linesFor('nowhere', {})).toEqual([]);
  });
});
