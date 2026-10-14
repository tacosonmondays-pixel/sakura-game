// Hold gesture timing (owner request #152): what fires, what cancels, and the click swallower
// that keeps a fired hold from also running the card's tap action.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHoldGesture, swallowNextClick, HOLD_MS, BAR_HOLD_MS, SWALLOW_MS, MOVE_CANCEL_PX, PEEK_DRAG_PX, HOLD_ROUTES } from '../../src/ui/hold.js';

const ev = (x = 100, y = 100, id = 1) => ({ pointerId: id, clientX: x, clientY: y });

describe('createHoldGesture', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const make = (extra = {}) => {
    const calls = { start: 0, fire: 0, cancel: 0, out: 0 };
    const g = createHoldGesture({
      onStart: () => calls.start++, onFire: () => calls.fire++, onCancel: () => calls.cancel++, ...extra,
    });
    return { g, calls };
  };

  it('down → 449 ms → up: no fire, the tap goes through', () => {
    const { g, calls } = make();
    g.down(ev());
    vi.advanceTimersByTime(HOLD_MS - 1);
    expect(g.up(ev())).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(calls.fire).toBe(0);
    expect(calls.cancel).toBe(1);
  });

  it('down → 450 ms: fires once, the following up is swallowed', () => {
    const { g, calls } = make();
    g.down(ev());
    vi.advanceTimersByTime(119);
    expect(calls.start).toBe(0); // nothing visible for a quick tap
    vi.advanceTimersByTime(1);
    expect(calls.start).toBe(1);
    vi.advanceTimersByTime(HOLD_MS - 120);
    expect(calls.fire).toBe(1);
    expect(g.fired).toBe(true);
    expect(g.up(ev())).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(calls.fire).toBe(1);
  });

  it('moving past 10 px cancels; 9 px still fires', () => {
    const a = make();
    a.g.down(ev(100, 100));
    vi.advanceTimersByTime(200);
    a.g.move(ev(100 + MOVE_CANCEL_PX + 1, 100));
    vi.advanceTimersByTime(HOLD_MS);
    expect(a.calls.fire).toBe(0);
    expect(a.calls.cancel).toBe(1);
    expect(a.g.pending).toBe(false);

    const b = make();
    b.g.down(ev(100, 100));
    b.g.move(ev(109, 100));
    vi.advanceTimersByTime(HOLD_MS);
    expect(b.calls.fire).toBe(1);
  });

  it('pointercancel (native scroll took over) cancels', () => {
    const { g, calls } = make();
    g.down(ev());
    vi.advanceTimersByTime(200);
    g.cancel();
    vi.advanceTimersByTime(HOLD_MS);
    expect(calls.fire).toBe(0);
    expect(calls.cancel).toBe(1);
  });

  it('a second pointer is ignored while one is pending', () => {
    const { g, calls } = make();
    expect(g.down(ev(100, 100, 1))).toBe(true);
    expect(g.down(ev(300, 100, 2))).toBe(false);
    g.move(ev(400, 100, 2)); // the other finger moving does not cancel
    vi.advanceTimersByTime(HOLD_MS);
    expect(calls.fire).toBe(1);
    expect(g.up(ev(300, 100, 2))).toBe(false); // not our pointer
    expect(g.up(ev(100, 100, 1))).toBe(true);
  });

  it('bar peek: after the fire, moving up past 12 px turns it into a drag', () => {
    const { g, calls } = make({ ms: BAR_HOLD_MS, onDragOut: () => calls.out++ });
    g.down(ev(100, 300));
    vi.advanceTimersByTime(BAR_HOLD_MS);
    expect(calls.fire).toBe(1);
    expect(g.move(ev(102, 300 - 5))).toBe(true); // still a peek: the bar must not drag yet
    expect(g.move(ev(102, 300 - PEEK_DRAG_PX - 1))).toBe(false);
    expect(calls.out).toBe(1);
    expect(g.move(ev(102, 200))).toBe(false); // the drag now owns the moves
    expect(calls.out).toBe(1);
    expect(g.up(ev(102, 200))).toBe(false); // released as a drag, not a hold
  });

  it('bar peek: a sideways move after the fire does not start a drag', () => {
    const { g, calls } = make({ ms: BAR_HOLD_MS, onDragOut: () => calls.out++ });
    g.down(ev(100, 300));
    vi.advanceTimersByTime(BAR_HOLD_MS);
    g.move(ev(160, 296));
    expect(calls.out).toBe(0);
    expect(g.up(ev(160, 296))).toBe(true);
  });

  it('constants match the spec', () => {
    expect(HOLD_MS).toBe(450);
    expect(BAR_HOLD_MS).toBe(550);
    expect(SWALLOW_MS).toBe(700);
    for (const r of ['formation', 'students', 'stage', 'recruit', 'coop', 'wiki']) expect(HOLD_ROUTES.has(r)).toBe(true);
    expect(HOLD_ROUTES.has('battle')).toBe(false);
    expect(HOLD_ROUTES.has('student')).toBe(false);
    expect(HOLD_ROUTES.has('lobby')).toBe(false);
  });
});

/** Minimal DOM-like event target (Node's EventTarget ignores `capture` when removing). */
class FakeTarget {
  constructor() { this.ls = []; }
  addEventListener(type, fn, opts) { this.ls.push({ type, fn, capture: !!(opts === true || opts?.capture) }); }
  removeEventListener(type, fn, opts) {
    const capture = !!(opts === true || opts?.capture);
    const i = this.ls.findIndex((l) => l.type === type && l.fn === fn && l.capture === capture);
    if (i >= 0) this.ls.splice(i, 1);
  }
  dispatchEvent(e) {
    let stopped = false;
    e.stopImmediatePropagation = () => { stopped = true; };
    for (const l of [...this.ls].sort((a, b) => b.capture - a.capture)) {
      if (l.type !== e.type || !this.ls.includes(l)) continue;
      l.fn(e);
      if (stopped) break;
    }
    return !e.defaultPrevented;
  }
}

describe('swallowNextClick', () => {
  let saved;
  beforeEach(() => {
    vi.useFakeTimers();
    saved = { window: globalThis.window, document: globalThis.document };
    globalThis.window = new FakeTarget();
    globalThis.document = new FakeTarget();
  });
  afterEach(() => {
    vi.useRealTimers();
    globalThis.window = saved.window;
    globalThis.document = saved.document;
  });
  const click = () => {
    const e = new Event('click', { cancelable: true });
    let reached = false;
    const listener = () => { reached = true; };
    document.addEventListener('click', listener);
    document.dispatchEvent(e);
    document.removeEventListener('click', listener);
    return { prevented: e.defaultPrevented, reached };
  };

  it('eats exactly one click', () => {
    swallowNextClick();
    expect(click()).toEqual({ prevented: true, reached: false });
    expect(click()).toEqual({ prevented: false, reached: true });
  });

  it('expires 700 ms after the release (some phones send no click after a long press)', () => {
    swallowNextClick();
    window.dispatchEvent(new Event('pointerup'));
    vi.advanceTimersByTime(SWALLOW_MS + 1);
    expect(click().reached).toBe(true);
  });

  it('expires on the next press', () => {
    swallowNextClick();
    window.dispatchEvent(new Event('pointerdown'));
    expect(click().reached).toBe(true);
  });
});
