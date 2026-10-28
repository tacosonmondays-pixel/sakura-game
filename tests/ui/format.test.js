// fmtNum, the one number style (docs/specs/UI_DIRECTION.md §2): the short form, money kept exact longer, the
// rounding direction per kind (balances down, prices up, stats nearest), signs and units.
import { describe, it, expect } from 'vitest';
import { fmtNum, fmtItemCount, MINUS, isUrgent } from '../../src/ui/format.js';

describe('fmtNum: counts, rewards, damage, HP', () => {
  it('exact with separators below 10,000', () => {
    expect(fmtNum(0)).toBe('0');
    expect(fmtNum(2600)).toBe('2,600');
    expect(fmtNum(9999)).toBe('9,999');
    expect(fmtNum(11.8)).toBe('12');
  });
  it('short from 10,000: lowercase k, uppercase M and B, one decimal, no trailing .0', () => {
    expect(fmtNum(10000)).toBe('10k');
    expect(fmtNum(12000)).toBe('12k');
    expect(fmtNum(12345)).toBe('12.3k');
    expect(fmtNum(300000)).toBe('300k');
    expect(fmtNum(1234567)).toBe('1.2M');
    expect(fmtNum(1.2e9)).toBe('1.2B');
    expect(fmtNum(25310)).toBe('25.3k');
  });
  it('stats, damage and HP round to the nearest value', () => {
    expect(fmtNum(34687)).toBe('34.7k');
    expect(fmtNum(9999.6)).toBe('10k');
  });
  it('a value that rounds up to the next unit moves to it', () => {
    expect(fmtNum(999950)).toBe('1M');
    expect(fmtNum(999949)).toBe('999.9k');
  });
  it('round: down never promises more than is true', () => {
    expect(fmtNum(42350, 'count', { round: 'down' })).toBe('42.3k');
    expect(fmtNum(999999, 'count', { round: 'down' })).toBe('999.9k');
    expect(fmtNum(9999.9, 'count', { round: 'down' })).toBe('9,999');
  });
  it('Details: exact with separators', () => {
    expect(fmtNum(34687, 'count', { detail: true })).toBe('34,687');
    expect(fmtNum(1234567, 'count', { detail: true })).toBe('1,234,567');
  });
  it('negative values use the real minus sign', () => {
    expect(fmtNum(-12345)).toBe(`${MINUS}12.3k`);
  });
  it('a missing or non-finite value reads "–"', () => {
    expect(fmtNum(null)).toBe('–');
    expect(fmtNum(undefined)).toBe('–');
    expect(fmtNum(NaN)).toBe('–');
    expect(fmtNum(Infinity)).toBe('–');
  });
});

describe('fmtNum: item stacks', () => {
  it('×n in the count corner, rounded down', () => {
    expect(fmtNum(42, 'stack')).toBe('×42');
    expect(fmtNum(42350, 'stack')).toBe('×42.3k');
    expect(fmtNum(300000, 'stack')).toBe('×300k');
    expect(fmtNum(42350, 'stack', { detail: true })).toBe('×42,350');
  });
});

describe('fmtNum: money the player spends', () => {
  it('a balance stays exact up to 999,999, then shortens rounding down', () => {
    expect(fmtNum(284650, 'money')).toBe('284,650');
    expect(fmtNum(16570, 'money')).toBe('16,570');
    expect(fmtNum(999999, 'money')).toBe('999,999');
    expect(fmtNum(1284650, 'money')).toBe('1.2M');
    expect(fmtNum(1999999, 'money')).toBe('1.9M');
    expect(fmtNum(2.5e9, 'money')).toBe('2.5B');
  });
  it('a price or requirement rounds up', () => {
    expect(fmtNum(1250000, 'money', { round: 'up' })).toBe('1.3M');
    expect(fmtNum(999999.5, 'money', { round: 'up' })).toBe('1M');
    expect(fmtNum(564.2, 'money', { round: 'up' })).toBe('565');
    expect(fmtNum(565, 'money', { round: 'up' })).toBe('565');
  });
  it('Details: exact', () => {
    expect(fmtNum(1284650, 'money', { detail: true })).toBe('1,284,650');
  });
});

describe('fmtNum: bonuses, rates, multipliers, ranges', () => {
  it('percent: integer with a sign; Details one decimal', () => {
    expect(fmtNum(0.224, 'pct')).toBe('+22%');
    expect(fmtNum(0.224, 'pct', { detail: true })).toBe('+22.4%');
    expect(fmtNum(-0.1, 'pct')).toBe(`${MINUS}10%`);
    expect(fmtNum(0.2, 'pct', { detail: true })).toBe('+20%');
  });
  it('flat: one decimal at most, always signed', () => {
    expect(fmtNum(4, 'flat')).toBe('+4');
    expect(fmtNum(10, 'flat')).toBe('+10');
    expect(fmtNum(2.14, 'flat')).toBe('+2.1');
    expect(fmtNum(-3, 'flat')).toBe(`${MINUS}3`);
  });
  it('rate: 1.9/s; Details 1.92/s', () => {
    expect(fmtNum(1.923, 'rate')).toBe('1.9/s');
    expect(fmtNum(1.923, 'rate', { detail: true })).toBe('1.92/s');
    expect(fmtNum(2, 'rate')).toBe('2/s');
  });
  it('multiplier: the × sign, not the letter x', () => {
    expect(fmtNum(1.5, 'mul')).toBe('×1.5');
    expect(fmtNum(1.25, 'mul', { detail: true })).toBe('×1.25');
    expect(fmtNum(2, 'mul')).toBe('×2');
  });
  it('range: 4.3 on Glance, 4.30 tiles in Details', () => {
    expect(fmtNum(4.3, 'range')).toBe('4.3');
    expect(fmtNum(4.3, 'range', { detail: true })).toBe('4.30 tiles');
  });
});

describe('fmtNum: time, level, progress', () => {
  it('time rounds up and never shows 0s while something still runs', () => {
    expect(fmtNum(0.5, 'time')).toBe('0.5s');
    expect(fmtNum(0.01, 'time')).toBe('0.1s');
    expect(fmtNum(12, 'time')).toBe('12s');
    expect(fmtNum(11.2, 'time')).toBe('12s');
    expect(fmtNum(65, 'time')).toBe('1:05');
    expect(fmtNum(59.5, 'time')).toBe('1:00');
    expect(fmtNum(0, 'time')).toBe('0s');
  });
  it('cooldowns in whole seconds', () => {
    expect(fmtNum(0.3, 'time', { whole: true })).toBe('1s');
    expect(fmtNum(4.01, 'time', { whole: true })).toBe('5s');
  });
  it('time left on a countdown chip (UI M5, §5.9): "6d 4h", "6d", "11h", "12:05", rounded up', () => {
    const H = 3600;
    const D = 24 * H;
    expect(fmtNum(6 * D + 4 * H, 'time')).toBe('6d 4h');
    expect(fmtNum(6 * D + 3 * H + 1, 'time')).toBe('6d 4h'); // up: an hour started counts
    expect(fmtNum(6 * D, 'time')).toBe('6d');
    expect(fmtNum(6 * D - 1, 'time')).toBe('6d'); // 5d 23h 59m 59s rounds up to the next whole day
    expect(fmtNum(D, 'time')).toBe('1d');
    expect(fmtNum(D + 1, 'time')).toBe('1d 1h');
    expect(fmtNum(11 * H, 'time')).toBe('11h');
    expect(fmtNum(10 * H + 1, 'time')).toBe('11h');
    expect(fmtNum(D - 1, 'time')).toBe('24h'); // under a day it stays in hours (never "1d" while urgent)
    expect(fmtNum(H, 'time')).toBe('1h');
    expect(fmtNum(H - 0.4, 'time')).toBe('1h'); // 59:59.6 rounds up into the hour
    expect(fmtNum(12 * 60 + 5, 'time')).toBe('12:05');
    expect(fmtNum(8000, 'time')).toBe('3h'); // was "133:20"
    expect(fmtNum(45, 'time')).toBe('45s');
  });
  it('never "0s" while a countdown still runs', () => {
    expect(fmtNum(0.0001, 'time')).not.toBe('0s');
    expect(fmtNum(0.4, 'time', { whole: true })).toBe('1s');
  });
  it('isUrgent: under 24 h, and only while it runs', () => {
    expect(isUrgent(23 * 3600)).toBe(true);
    expect(isUrgent(24 * 3600 - 1)).toBe(true);
    expect(isUrgent(24 * 3600)).toBe(false);
    expect(isUrgent(6 * 86400)).toBe(false);
    expect(isUrgent(0)).toBe(false);
    expect(isUrgent(-5)).toBe(false);
    expect(isUrgent(NaN)).toBe(false);
  });
  it('level: LV 48, or LV 48/50 where the cap matters', () => {
    expect(fmtNum(48, 'level')).toBe('LV 48');
    expect(fmtNum(48, 'level', { cap: 50 })).toBe('LV 48/50');
  });
  it('progress: 3/5 with no spaces, rounded down', () => {
    expect(fmtNum(3, 'progress', { of: 5 })).toBe('3/5');
    expect(fmtNum(2.9, 'progress', { of: 5 })).toBe('2/5');
  });
  it('an unknown kind throws', () => {
    expect(() => fmtNum(1, 'nope')).toThrow(/unknown kind/);
  });
});

describe('fmtItemCount: the item tile count badge (x450K)', () => {
  it('a lowercase x, exact with no separator up to 9,999', () => {
    expect(fmtItemCount(0)).toBe('x0');
    expect(fmtItemCount(1)).toBe('x1');
    expect(fmtItemCount(15)).toBe('x15');
    expect(fmtItemCount(2400)).toBe('x2400');
    expect(fmtItemCount(9999)).toBe('x9999');
  });
  it('from 10,000: one decimal at most, no trailing .0, uppercase K, M and B', () => {
    expect(fmtItemCount(10000)).toBe('x10K');
    expect(fmtItemCount(42350)).toBe('x42.3K');
    expect(fmtItemCount(450000)).toBe('x450K');
    expect(fmtItemCount(300000)).toBe('x300K');
    expect(fmtItemCount(1250000)).toBe('x1.2M');
    expect(fmtItemCount(3.4e9)).toBe('x3.4B');
  });
  it('rounds down: a stack never shows more than you own', () => {
    expect(fmtItemCount(42399)).toBe('x42.3K');
    expect(fmtItemCount(999999)).toBe('x999.9K');
    expect(fmtItemCount(1999999)).toBe('x1.9M');
    expect(fmtItemCount(9999.9)).toBe('x9999');
    expect(fmtItemCount(2.7)).toBe('x2');
  });
  it('fits the phone tile: never longer than "x999.9K" (7 characters) below a trillion', () => {
    for (const n of [7, 2400, 9999, 10000, 42350, 450000, 999999, 1250000, 999999999, 2.5e11]) expect(fmtItemCount(n).length).toBeLessThanOrEqual(7);
  });
  it('nothing for a missing value, x0 for a negative one', () => {
    expect(fmtItemCount(null)).toBe('');
    expect(fmtItemCount(undefined)).toBe('');
    expect(fmtItemCount(NaN)).toBe('');
    expect(fmtItemCount(-3)).toBe('x0');
  });
});
