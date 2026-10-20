// src/core/reset.js — the 7 PM Central game day (owner decision D3), DST-aware. The table is
// ENERGY_RESET_SPEC §3.1 R-1 (the energy build extends the same module).
import { describe, it, expect } from 'vitest';
import { gameDay, nextDailyReset, formatCountdown, chicagoParts, chicagoOffsetFallback, RESET, gameDayNumber, gameWeekNumber, gameWeek, nextWeeklyReset } from '../../src/core/reset.js';

const TABLE = [
  ['2026-10-13T23:59:59.999Z', '2026-10-13', '2026-10-14T00:00:00.000Z'],
  ['2026-10-14T00:00:00.000Z', '2026-10-14', '2026-10-15T00:00:00.000Z'],
  ['2026-10-19T00:00:00.000Z', '2026-10-19', '2026-10-20T00:00:00.000Z'],
  ['2026-11-01T00:00:00.000Z', '2026-11-01', '2026-11-02T01:00:00.000Z'], // 25 h day
  ['2026-11-01T07:30:00.000Z', '2026-11-01', '2026-11-02T01:00:00.000Z'],
  ['2026-11-02T01:00:00.000Z', '2026-11-02', '2026-11-03T01:00:00.000Z'],
  ['2027-03-14T01:00:00.000Z', '2027-03-14', '2027-03-15T00:00:00.000Z'], // 23 h day
  ['2027-03-14T09:00:00.000Z', '2027-03-14', '2027-03-15T00:00:00.000Z'],
  ['2027-03-15T00:00:00.000Z', '2027-03-15', '2027-03-16T00:00:00.000Z'],
  ['2026-03-08T01:00:00.000Z', '2026-03-08', '2026-03-09T00:00:00.000Z'],
  ['2027-01-03T12:00:00.000Z', '2027-01-03', '2027-01-04T01:00:00.000Z'],
  ['2027-01-04T01:00:00.000Z', '2027-01-04', '2027-01-05T01:00:00.000Z'],
];

describe('reset clock (7 PM Central)', () => {
  it('names the game day by the date it ends and finds the next 7 PM Central (R-1)', () => {
    for (const [t, day, next] of TABLE) {
      expect(gameDay(Date.parse(t)), t).toBe(day);
      expect(new Date(nextDailyReset(Date.parse(t))).toISOString(), t).toBe(next);
    }
    expect(RESET.label).toBe('7 PM Central');
  });

  it('flips exactly at 19:00:00.000 Chicago wall time', () => {
    const at = Date.parse('2026-10-14T00:00:00Z'); // Tue 7 PM CDT
    expect(gameDay(at - 1)).toBe('2026-10-13');
    expect(gameDay(at)).toBe('2026-10-14');
    expect(nextDailyReset(at - 1)).toBe(at);
    expect(nextDailyReset(at)).toBe(at + 86400000);
  });

  it('the US-rule fallback equals Intl every hour of 2026–2028 (R-3)', () => {
    for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2029, 0, 1); t += 3600000) {
      const a = chicagoParts(t);
      const b = chicagoParts(t, { fallback: true });
      if (a.hour !== b.hour || a.day !== b.day) throw new Error(`${new Date(t).toISOString()}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
      expect(gameDay(t, { fallback: true })).toBe(gameDay(t));
    }
    expect(chicagoOffsetFallback(Date.parse('2026-07-01T12:00:00Z'))).toBe(-300);
    expect(chicagoOffsetFallback(Date.parse('2026-12-01T12:00:00Z'))).toBe(-360);
  });

  it('every game day is 23, 24 or 25 hours long', () => {
    let t = Date.UTC(2026, 0, 1);
    const lengths = new Set();
    for (let i = 0; i < 800; i++) {
      const n = nextDailyReset(t);
      if (i) lengths.add((n - t) / 3600000);
      t = n;
    }
    expect([...lengths].sort()).toEqual([23, 24, 25]);
  });

  it('gameWeek follows the §3.1 table (R-1): Sunday 7 PM Central starts the week, 2026-W53 → 2027-W01', () => {
    const WEEKS = [
      ['2026-10-13T23:59:59.999Z', '2026-W42'],
      ['2026-10-14T00:00:00.000Z', '2026-W42'],
      ['2026-10-19T00:00:00.000Z', '2026-W43'],
      ['2026-11-01T00:00:00.000Z', '2026-W44'],
      ['2026-11-01T07:30:00.000Z', '2026-W44'],
      ['2026-11-02T01:00:00.000Z', '2026-W45'],
      ['2027-03-14T01:00:00.000Z', '2027-W10'],
      ['2027-03-14T09:00:00.000Z', '2027-W10'],
      ['2027-03-15T00:00:00.000Z', '2027-W11'],
      ['2026-03-08T01:00:00.000Z', '2026-W10'],
      ['2027-01-03T12:00:00.000Z', '2026-W53'],
      ['2027-01-04T01:00:00.000Z', '2027-W01'],
    ];
    for (const [t, week] of WEEKS) {
      expect(gameWeek(Date.parse(t)), t).toBe(week);
      expect(gameWeek(Date.parse(t), { fallback: true }), `${t} (fallback)`).toBe(week);
    }
    // the year boundary flips on the Sunday 7 PM Central, and the week number moves by exactly 1
    const flip = Date.parse('2027-01-04T01:00:00.000Z');
    expect(gameWeek(flip - 1)).toBe('2026-W53');
    expect(gameWeek(flip)).toBe('2027-W01');
    expect(gameWeekNumber(flip)).toBe(gameWeekNumber(flip - 1) + 1);
  });

  it('gameDayNumber / gameWeekNumber: pinned values (counters and SQL titan_game_week store them)', () => {
    const at = (t, o) => [gameDayNumber(Date.parse(t), o), gameWeekNumber(Date.parse(t), o)];
    for (const o of [undefined, { fallback: true }]) {
      expect(at('1970-01-01T12:00:00Z', o)).toEqual([0, 0]);
      expect(at('2026-10-14T12:00:00Z', o)).toEqual([20740, 2963]);
      expect(at('2026-10-18T23:59:59.999Z', o)).toEqual([20744, 2963]); // Sun 18:59:59 CDT
      expect(at('2026-10-19T00:00:00.000Z', o)).toEqual([20745, 2964]); // Sun 19:00 CDT
      expect(at('2026-10-21T12:00:00Z', o)).toEqual([20747, 2964]);
      expect(at('2027-01-04T00:59:59.999Z', o)).toEqual([20821, 2974]);
      expect(at('2027-01-04T01:00:00.000Z', o)).toEqual([20822, 2975]);
    }
    // a game day number moves by exactly 1 at every daily reset, the 23 h and 25 h days included
    let t = Date.UTC(2026, 0, 1);
    for (let i = 0; i < 800; i++) {
      const n = nextDailyReset(t);
      expect(gameDayNumber(n), new Date(n).toISOString()).toBe(gameDayNumber(n - 1) + 1);
      expect(gameDayNumber(n - 1)).toBe(gameDayNumber(t));
      t = n;
    }
  });

  it('nextWeeklyReset is always a Sunday 19:00:00 Chicago, 168 h apart (169 h across fall-back, 167 h across spring-forward) (R-2)', () => {
    for (const opts of [undefined, { fallback: true }]) {
      let t = Date.UTC(2026, 0, 1);
      const gaps = {};
      let prev = null;
      for (let i = 0; i < 160; i++) {
        const u = nextWeeklyReset(t, opts);
        const w = chicagoParts(u, opts);
        const label = new Date(u).toISOString();
        expect(new Date(Date.UTC(w.year, w.month - 1, w.day)).getUTCDay(), label).toBe(0); // a Sunday
        expect([w.hour, w.minute, w.second, u % 1000], label).toEqual([19, 0, 0, 0]);
        // the week number moves by exactly 1 there, and nowhere in between
        expect(gameWeekNumber(u, opts), label).toBe(gameWeekNumber(u - 1, opts) + 1);
        expect(gameWeekNumber(u - 1, opts), label).toBe(gameWeekNumber(t, opts));
        expect(gameWeek(u, opts)).not.toBe(gameWeek(u - 1, opts));
        if (prev != null) {
          const h = (u - prev) / 3600000;
          gaps[h] = (gaps[h] || 0) + 1;
          // a 169 h week holds the November fall-back, a 167 h week the March spring-forward
          if (h === 169) expect(new Date(u).getUTCMonth(), label).toBe(10);
          if (h === 167) expect(new Date(u).getUTCMonth(), label).toBe(2);
        }
        prev = u;
        t = u;
      }
      expect(Object.keys(gaps).map(Number).sort()).toEqual([167, 168, 169]);
      expect(gaps[169]).toBe(3); // 2026, 2027, 2028
      expect(gaps[167]).toBe(3);
    }
    // from inside a week: the coming Sunday 19:00 Central
    expect(new Date(nextWeeklyReset(Date.parse('2026-10-21T12:00:00Z'))).toISOString()).toBe('2026-10-26T00:00:00.000Z');
    expect(new Date(nextWeeklyReset(Date.parse('2026-10-19T00:00:00.000Z'))).toISOString()).toBe('2026-10-26T00:00:00.000Z');
    expect(new Date(nextWeeklyReset(Date.parse('2026-10-18T23:59:59.999Z'))).toISOString()).toBe('2026-10-19T00:00:00.000Z');
    expect(new Date(nextWeeklyReset(Date.parse('2026-10-26T12:00:00Z'))).toISOString()).toBe('2026-11-02T01:00:00.000Z'); // the 169 h week
  });

  it('formatCountdown (R-4)', () => {
    expect(formatCountdown(0)).toBe('now');
    expect(formatCountdown(-5)).toBe('now');
    expect(formatCountdown(59000)).toBe('1m');
    expect(formatCountdown((3 * 60 + 7) * 60000)).toBe('3h 07m');
    expect(formatCountdown(((2 * 24 + 4) * 60 + 30) * 60000)).toBe('2d 4h');
    expect(formatCountdown(12 * 60000)).toBe('12m');
  });
});
