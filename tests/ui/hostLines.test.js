// UI M5a: what the host girl says (src/ui/hostLines.js, docs/specs/UI_DIRECTION.md §5.10 E1): every line ≤ 60
// characters with at most one number, in every state; the state picks the first line; a long name never breaks it.
import { describe, it, expect } from 'vitest';
import { LINES, linesFor, lineOk, numberCount, MAX_LINE } from '../../src/ui/hostLines.js';
import { HOSTS } from '../../src/ui/hosts.js';

/** A spread of states per screen: empty, busy, edge counts. */
const STATES = {
  missions: [{}, { next: '2-3 Shield Wall', titansOpen: true, doubleDrop: 'the Meadow' }, { next: '12-5 The Very Long Name of a Final Stage Indeed' }],
  commissions: [{}, { ready: 1 }, { ready: 3 }, { ready: 12, loginReady: true }, { allDone: true }],
  login: [{}, { claimable: true }, { day: 4 }, { day: 7, claimable: false }],
  bounty: [{}, { endsSoon: true }],
  assault: [{}, { locked: true }],
  titans: [{}, { keys: 1 }, { keys: 12, newWeek: true }],
  mall: [{}, { restockSoon: true }],
  mail: [{}, { gifts: 1 }, { gifts: 2 }, { gifts: 140 }],
  happening: [{}, { running: 1 }, { running: 3, endingSoon: 'Pumpkin Lantern Night' }, { endingSoon: 'A Festival Name So Long It Could Never Fit One Line' }],
  multiplayer: [{}, { invites: 1 }, { invites: 4 }],
};

describe('host lines', () => {
  it('every hosted screen has a line table', () => {
    for (const screen of Object.keys(HOSTS)) expect(LINES[screen], screen).toBeTypeOf('function');
  });
  it('every line in every state is 1-60 characters with at most one number, and never empty', () => {
    for (const [screen, states] of Object.entries(STATES)) {
      for (const s of states) {
        const lines = linesFor(screen, s);
        expect(lines.length, `${screen} ${JSON.stringify(s)}`).toBeGreaterThan(0);
        for (const l of lines) {
          expect(l.length, l).toBeLessThanOrEqual(MAX_LINE);
          expect(numberCount(l), l).toBeLessThanOrEqual(1);
        }
      }
    }
  });
  it('the state picks the first line', () => {
    expect(linesFor('mail', { gifts: 2 })[0]).toBe('2 letters came with gifts!');
    expect(linesFor('mail', { gifts: 1 })[0]).toBe('A letter came with a gift!');
    expect(linesFor('mail', {})[0]).toBe('All caught up. No new mail.');
    expect(linesFor('commissions', { ready: 3 })[0]).toBe('3 commissions are ready to claim!');
    expect(linesFor('commissions', { allDone: true })[0]).toBe('All done today. Nice work, Sensei!');
    expect(linesFor('happening', { running: 3, endingSoon: 'Pumpkin Lantern Night' })[0]).toBe('Pumpkin Lantern Night ends soon, Sensei!');
    expect(linesFor('multiplayer', { invites: 1 })[0]).toBe('A friend invited you! Want to join?');
    expect(linesFor('missions', { next: '2-3 Shield Wall' })[0]).toBe('Next up: 2-3 Shield Wall. Shall we go?');
  });
  it('a line that would break the rules is skipped, the next one shows', () => {
    const long = linesFor('happening', { endingSoon: 'A Festival Name So Long It Could Never Fit One Line' });
    expect(long[0]).toBe('Nothing limited right now. Rest up!');
    const twoNumbers = linesFor('missions', { next: '12-5 Stage 3' });
    expect(twoNumbers.every((l) => numberCount(l) <= 1)).toBe(true);
    expect(twoNumbers[0]).not.toMatch(/Next up/);
  });
  it('numbers: a stage id, a time and a grouped count each count once', () => {
    expect(numberCount('Next up: 2-3 Shield Wall')).toBe(1);
    expect(numberCount('Back at 12:05')).toBe(1);
    expect(numberCount('1,200 coins')).toBe(1);
    expect(numberCount('2 of 5')).toBe(2);
    expect(lineOk('x'.repeat(61))).toBe(false);
    expect(lineOk('')).toBe(false);
  });
  it('an unknown screen has no lines', () => {
    expect(linesFor('nowhere', {})).toEqual([]);
  });
});
