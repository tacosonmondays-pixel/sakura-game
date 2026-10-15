// src/core/reset.js — the 7 PM Central game day (owner decision D3), DST-aware. The table is
// ENERGY_RESET_SPEC §3.1 R-1 (the energy build extends the same module).
import { describe, it, expect } from 'vitest';
import { gameDay, nextDailyReset, formatCountdown, chicagoParts, chicagoOffsetFallback, RESET } from '../../src/core/reset.js';

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

  it('formatCountdown (R-4)', () => {
    expect(formatCountdown(0)).toBe('now');
    expect(formatCountdown(-5)).toBe('now');
    expect(formatCountdown(59000)).toBe('1m');
    expect(formatCountdown((3 * 60 + 7) * 60000)).toBe('3h 07m');
    expect(formatCountdown(((2 * 24 + 4) * 60 + 30) * 60000)).toBe('2d 4h');
    expect(formatCountdown(12 * 60000)).toBe('12m');
  });
});
