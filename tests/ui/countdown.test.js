// UI M5a: the countdown chip's clock (src/ui/countdown.js, docs/specs/UI_DIRECTION.md §5.9): the text and the urgent
// flag for a time left, the local deadlines the menus count to, and the one shared ticker (it drops chips that left
// the page and stops when none are left).
import { describe, it, expect } from 'vitest';
import { countdownState, msToLocalMidnight, msToLocalWeekEnd, createTicker, TICK_MS, FAST_TICK_MS } from '../../src/ui/countdown.js';

const H = 3600e3;
const D = 24 * H;

describe('countdownState', () => {
  it('the chip text is the long time form, rounded up', () => {
    expect(countdownState(6 * D + 3.2 * H)).toMatchObject({ text: '6d 4h', urgent: false, done: false });
    expect(countdownState(6 * D)).toMatchObject({ text: '6d', urgent: false });
    expect(countdownState(11 * H)).toMatchObject({ text: '11h', urgent: true });
    expect(countdownState(12 * 60e3 + 5e3)).toMatchObject({ text: '12:05', urgent: true });
  });
  it('urgent under 24 h only', () => {
    expect(countdownState(D).urgent).toBe(false);
    expect(countdownState(D - 1000).urgent).toBe(true);
  });
  it('done at zero or below (and for a missing value), never "0s" while it runs', () => {
    expect(countdownState(0)).toMatchObject({ done: true, urgent: false, text: '' });
    expect(countdownState(-5)).toMatchObject({ done: true });
    expect(countdownState(undefined)).toMatchObject({ done: true });
    expect(countdownState(1).text).not.toBe('0s');
  });
});

describe('local deadlines', () => {
  it('midnight: the next local 00:00', () => {
    const t = new Date(2026, 9, 27, 12, 0, 0).getTime();
    expect(msToLocalMidnight(t)).toBe(12 * H);
    const late = new Date(2026, 9, 27, 23, 59, 30).getTime();
    expect(msToLocalMidnight(late)).toBe(30e3);
  });
  it('the week ends on the next local Monday 00:00 (Sunday counts as the last day)', () => {
    const tue = new Date(2026, 9, 27, 12, 0, 0).getTime(); // Tuesday
    expect(msToLocalWeekEnd(tue)).toBe(new Date(2026, 10, 2, 0, 0, 0).getTime() - tue);
    const sun = new Date(2026, 10, 1, 20, 0, 0).getTime(); // Sunday evening
    expect(msToLocalWeekEnd(sun)).toBe(new Date(2026, 10, 2, 0, 0, 0).getTime() - sun);
    const mon = new Date(2026, 10, 2, 0, 0, 1).getTime(); // just after the turn: a full week
    expect(msToLocalWeekEnd(mon)).toBe(new Date(2026, 10, 9, 0, 0, 0).getTime() - mon);
  });
});

/** Fake timers: run the pending one by hand. */
function fakeTimers() {
  const pending = new Map();
  let id = 0;
  return {
    setTimer: (fn, ms) => {
      pending.set(++id, { fn, ms });
      return id;
    },
    clearTimer: (t) => pending.delete(t),
    get count() {
      return pending.size;
    },
    get next() {
      return [...pending.values()][0];
    },
    fire() {
      const [k, v] = [...pending.entries()][0];
      pending.delete(k);
      v.fn();
    },
  };
}

describe('the shared ticker', () => {
  it('draws a chip at once, then every 30 s; every second under an hour', () => {
    const io = fakeTimers();
    const tk = createTicker(io);
    let clock = 0;
    const seen = [];
    tk.add({ endsAt: 2 * D, now: () => clock, alive: () => true, update: (s) => seen.push(s.text) });
    expect(seen).toEqual(['2d']);
    expect(io.next.ms).toBe(TICK_MS);
    clock = 2 * D - 30 * 60e3; // half an hour left
    io.fire();
    expect(seen.at(-1)).toBe('30:00');
    expect(io.next.ms).toBe(FAST_TICK_MS);
  });
  it('drops a chip that left the page and stops when none are left', () => {
    const io = fakeTimers();
    const tk = createTicker(io);
    let alive = true;
    let draws = 0;
    tk.add({ endsAt: D, now: () => 0, alive: () => alive, update: () => draws++ });
    expect(tk.size).toBe(1);
    expect(tk.running).toBe(true);
    io.fire();
    expect(draws).toBe(2);
    alive = false;
    io.fire();
    expect(tk.size).toBe(0);
    expect(tk.running).toBe(false);
    expect(io.count).toBe(0);
  });
  it('one timer for many chips', () => {
    const io = fakeTimers();
    const tk = createTicker(io);
    for (let i = 0; i < 5; i++) tk.add({ endsAt: (i + 2) * D, now: () => 0, alive: () => true, update: () => {} });
    expect(io.count).toBe(1);
  });
  it('a chip reaching zero says done', () => {
    const io = fakeTimers();
    const tk = createTicker(io);
    let clock = 0;
    let last = null;
    tk.add({ endsAt: 1000, now: () => clock, alive: () => true, update: (s) => { last = s; } });
    clock = 1500;
    io.fire();
    expect(last.done).toBe(true);
  });
});
