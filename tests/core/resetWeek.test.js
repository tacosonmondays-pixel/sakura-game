// The game week in src/core/reset.js (ENERGY_RESET_SPEC §3.1): gameDayNumber, gameWeekNumber, gameWeek and
// nextWeeklyReset. Two tracks wrote this block byte-identically (limited events and Ascension: the titan rotation,
// the weekly keys, the Craft Room and the weekly stores read it), so these tests pin the shared behaviour: the
// spec's R-1 gameWeek column, R-2 and the week half of R-5. Fixed UTC instants: any TZ.
import { describe, it, expect } from 'vitest';
import { gameDay, gameDayNumber, gameWeek, gameWeekNumber, nextWeeklyReset, nextDailyReset, chicagoParts, isNewPeriod } from '../../src/core/reset.js';

const H = 3600000;
const iso = (ms) => new Date(ms).toISOString();

// ENERGY_RESET_SPEC §3.1 prototype table: instant → gameWeek
const WEEKS = [
  ['2026-10-13T23:59:59.999Z', '2026-W42'],
  ['2026-10-14T00:00:00.000Z', '2026-W42'],
  ['2026-10-19T00:00:00.000Z', '2026-W43'], // Sun Oct 18 19:00 CDT: a new week
  ['2026-11-01T00:00:00.000Z', '2026-W44'],
  ['2026-11-01T07:30:00.000Z', '2026-W44'],
  ['2026-11-02T01:00:00.000Z', '2026-W45'], // Sun Nov 1 19:00 CST
  ['2027-03-14T01:00:00.000Z', '2027-W10'],
  ['2027-03-14T09:00:00.000Z', '2027-W10'],
  ['2027-03-15T00:00:00.000Z', '2027-W11'], // Sun Mar 14 19:00 CDT
  ['2026-03-08T01:00:00.000Z', '2026-W10'],
  ['2027-01-03T12:00:00.000Z', '2026-W53'],
  ['2027-01-04T01:00:00.000Z', '2027-W01'],
];

/** Sunday 19:00:00.000 on the Chicago wall clock. */
function isSundaySevenPm(u, opts) {
  const p = chicagoParts(u, opts);
  const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  return weekday === 0 && p.hour === 19 && p.minute === 0 && p.second === 0 && u % 1000 === 0;
}

describe('game week (Sunday 7 PM Central)', () => {
  it('gameWeek is the ISO week of the shifted date: the spec table (R-1), Intl and the US-rule fallback', () => {
    for (const fallback of [false, true]) {
      for (const [t, week] of WEEKS) expect(gameWeek(Date.parse(t), { fallback }), `${t} fallback=${fallback}`).toBe(week);
    }
  });

  it('nextWeeklyReset lands on a Sunday 19:00:00.000 Chicago after t, where the week moves on by one (R-2)', () => {
    for (const fallback of [false, true]) {
      const opts = { fallback };
      for (let t = Date.UTC(2026, 0, 1, 3); t < Date.UTC(2028, 0, 1); t += 29 * H + 23 * 60000) {
        const u = nextWeeklyReset(t, opts);
        expect(u > t && u - t <= 169 * H, iso(t)).toBe(true);
        expect(isSundaySevenPm(u, opts), iso(u)).toBe(true);
        expect(gameWeekNumber(u, opts)).toBe(gameWeekNumber(t, opts) + 1);
        expect(gameWeekNumber(u - 1, opts)).toBe(gameWeekNumber(t, opts));
        expect(gameWeek(u, opts) > gameWeek(u - 1, opts)).toBe(true);
        expect(nextDailyReset(u - 1, opts)).toBe(u);
      }
    }
  });

  it('weeks are 168 h, 169 h across fall-back and 167 h across spring-forward (R-2)', () => {
    const len = (t) => nextWeeklyReset(nextWeeklyReset(t)) - nextWeeklyReset(t);
    expect(iso(nextWeeklyReset(Date.parse('2026-10-14T00:00:00.000Z')))).toBe('2026-10-19T00:00:00.000Z');
    expect(len(Date.parse('2026-10-14T00:00:00.000Z'))).toBe(168 * H);
    expect(iso(nextWeeklyReset(Date.parse('2026-10-20T00:00:00.000Z')))).toBe('2026-10-26T00:00:00.000Z');
    expect(len(Date.parse('2026-10-20T00:00:00.000Z'))).toBe(169 * H); // → 2026-11-02T01:00Z
    expect(iso(nextWeeklyReset(Date.parse('2027-03-02T00:00:00.000Z')))).toBe('2027-03-08T01:00:00.000Z');
    expect(len(Date.parse('2027-03-02T00:00:00.000Z'))).toBe(167 * H); // → 2027-03-15T00:00Z
  });

  it('gameWeekNumber and gameWeek change at the same instants; gameDayNumber steps by one each game day', () => {
    let prev = Date.UTC(2026, 0, 1);
    for (let t = prev + 5 * H; t < Date.UTC(2028, 0, 1); t += 5 * H + 11 * 60000) {
      const weekMoved = gameWeek(t) !== gameWeek(prev);
      expect(gameWeekNumber(t) - gameWeekNumber(prev), iso(t)).toBe(weekMoved ? 1 : 0);
      const dayMoved = gameDay(t) !== gameDay(prev);
      expect(gameDayNumber(t) - gameDayNumber(prev), iso(t)).toBe(dayMoved ? 1 : 0);
      prev = t;
    }
    expect(gameWeekNumber(Date.parse('2026-10-19T00:00:00.000Z')) - gameWeekNumber(Date.parse('2026-10-18T23:59:59.999Z'))).toBe(1);
  });

  it('week keys never reset backwards, across a year boundary too (R-5)', () => {
    expect(isNewPeriod('2026-W53', '2027-W01')).toBe(true);
    expect(isNewPeriod('2027-W01', '2026-W53')).toBe(false);
    expect(isNewPeriod('2026-W44', '2026-W44')).toBe(false);
  });
});
