// The countdown chip's clock (docs/specs/UI_DIRECTION.md §5.9, E4): what a chip says for a time left, the deadlines
// the menus count down to, and ONE shared ticker for every chip on screen. Pure (no DOM): kit.js countdownChip()
// draws the chip and hands it to the ticker.
//
//   countdownState(5 * 3600e3)   { sec: 18000, text: '5h', urgent: true, done: false }
//   msToLocalMidnight()          the daily commissions and the Mall's daily stock (local midnight)
//   msToLocalWeekEnd()           the weekly double drops, weekly commissions and weekly stock (Monday, local)
//
// The ticker wakes every 30 s, or every second while a chip shows minutes and seconds (under an hour). A chip that
// left the page (its screen was replaced) drops out on the next tick, and the ticker stops when none are left, so a
// screen never has to stop it itself.
import { fmtNum, isUrgent } from './format.js';

export const TICK_MS = 30000;
export const FAST_TICK_MS = 1000;

/**
 * What a chip shows for `msLeft`.
 * @returns {{ sec: number, text: string, urgent: boolean, done: boolean }}
 */
export function countdownState(msLeft) {
  const ms = Number(msLeft);
  if (!Number.isFinite(ms) || ms <= 0) return { sec: 0, text: '', urgent: false, done: true };
  const sec = ms / 1000;
  return { sec, text: fmtNum(sec, 'time'), urgent: isUrgent(sec), done: false };
}

/** Milliseconds to the next local midnight. */
export function msToLocalMidnight(now = Date.now()) {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now;
}

/** Milliseconds to the next local Monday 00:00 (the ISO week the weekly rotations use, src/core/util.js weekKey). */
export function msToLocalWeekEnd(now = Date.now()) {
  const d = new Date(now);
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  next.setDate(next.getDate() + (7 - (d.getDay() || 7)));
  return next.getTime() - now;
}

/**
 * A ticker for countdown items. An item: { endsAt, now(): ms, update(state), alive(): boolean }.
 * @param {{ setTimer?: Function, clearTimer?: Function }} [io] timers (tests pass fakes)
 */
export function createTicker({ setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (t) => clearTimeout(t) } = {}) {
  const items = new Set();
  let timer = null;
  let due = Infinity;
  const left = (it) => it.endsAt - it.now();
  const interval = () => {
    for (const it of items) if (left(it) < 3600000) return FAST_TICK_MS;
    return TICK_MS;
  };
  const schedule = () => {
    if (!items.size) {
      stop();
      return;
    }
    const ms = interval();
    const at = Date.now() + ms;
    if (timer != null && due <= at) return;
    if (timer != null) clearTimer(timer);
    due = at;
    timer = setTimer(() => {
      timer = null;
      due = Infinity;
      tick();
    }, ms);
  };
  function tick() {
    for (const it of [...items]) {
      if (!it.alive()) {
        items.delete(it);
        continue;
      }
      it.update(countdownState(left(it)));
    }
    schedule();
  }
  function stop() {
    if (timer != null) clearTimer(timer);
    timer = null;
    due = Infinity;
  }
  return {
    /** Adds an item and draws it once now. */
    add(it) {
      items.add(it);
      it.update(countdownState(left(it)));
      schedule();
      return () => items.delete(it);
    },
    tick,
    stop,
    get size() {
      return items.size;
    },
    get running() {
      return timer != null;
    },
  };
}

/** The one ticker every countdown chip shares. */
export const ticker = createTicker();
