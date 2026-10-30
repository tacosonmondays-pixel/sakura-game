// Game-day bounds (ENERGY_RESET_SPEC §3.1 gameDayStart / gameDayEnd / isNewPeriod), the clock the
// limited events' windows are written in (EVENT_SPEC §3.2). Fixed UTC instants: any TZ.
import { describe, it, expect } from 'vitest';
import { gameDay, gameDayStart, gameDayEnd, isNewPeriod, nextDailyReset } from '../../src/core/reset.js';

const iso = (ms) => new Date(ms).toISOString();

describe('game-day bounds', () => {
  it('the Halloween 2026 window instants (EVENT_SPEC §3.2 table)', () => {
    expect(iso(gameDayStart('2026-10-24'))).toBe('2026-10-24T00:00:00.000Z'); // Fri Oct 23 19:00 CDT
    expect(iso(gameDayEnd('2026-11-01'))).toBe('2026-11-02T01:00:00.000Z'); // Sun Nov 1 19:00 CST
    expect(iso(gameDayEnd('2026-11-08'))).toBe('2026-11-09T01:00:00.000Z'); // Sun Nov 8 19:00 CST
    expect(iso(gameDayStart('2026-10-17'))).toBe('2026-10-17T00:00:00.000Z');
    // extended two weeks (owner, Oct 30): opens at ship, operations to Nov 15, the exchange to Nov 22
    expect(iso(gameDayStart('2026-10-20'))).toBe('2026-10-20T00:00:00.000Z'); // Mon Oct 19 19:00 CDT
    expect(iso(gameDayEnd('2026-11-15'))).toBe('2026-11-16T01:00:00.000Z'); // Sun Nov 15 19:00 CST
    expect(iso(gameDayEnd('2026-11-22'))).toBe('2026-11-23T01:00:00.000Z'); // Sun Nov 22 19:00 CST
  });

  it('the 25 h fall-back day and the 23 h spring-forward day', () => {
    expect(gameDayEnd('2026-11-01') - gameDayStart('2026-11-01')).toBe(25 * 3600000);
    expect(gameDayEnd('2027-03-14') - gameDayStart('2027-03-14')).toBe(23 * 3600000);
    expect(gameDayEnd('2026-10-20') - gameDayStart('2026-10-20')).toBe(24 * 3600000);
  });

  it('round-trips with gameDay and nextDailyReset, Intl and the US-rule fallback alike', () => {
    for (const fallback of [false, true]) {
      const opts = { fallback };
      for (let t = Date.UTC(2026, 0, 1, 7); t < Date.UTC(2028, 0, 1); t += 13 * 3600000 + 17 * 60000) {
        const key = gameDay(t, opts);
        const start = gameDayStart(key, opts);
        const end = gameDayEnd(key, opts);
        expect(start <= t && t < end).toBe(true);
        expect(gameDay(start, opts)).toBe(key);
        expect(gameDay(end - 1, opts)).toBe(key);
        expect(end).toBe(nextDailyReset(t, opts));
      }
    }
  });

  it('rejects malformed keys', () => {
    expect(() => gameDayStart('2026-1-2')).toThrow(RangeError);
  });

  it('isNewPeriod never goes backwards', () => {
    expect(isNewPeriod(null, '2026-10-24')).toBe(true);
    expect(isNewPeriod('2026-10-24', '2026-10-25')).toBe(true);
    expect(isNewPeriod('2026-10-25', '2026-10-24')).toBe(false);
    expect(isNewPeriod('2026-10-25', '2026-10-25')).toBe(false);
  });
});
