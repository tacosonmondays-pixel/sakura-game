// Hold gesture timing (owner request #152): what fires, what cancels, and the click swallower
// that keeps a fired hold from also running the card's tap action.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHoldGesture, swallowNextClick, HOLD_MS, BAR_HOLD_MS, SWALLOW_MS, MOVE_CANCEL_PX, PEEK_DRAG_PX, HOLD_ROUTES, HOLD_EXCLUDE, LATE_FIRE_MS } from '../../src/ui/hold.js';
import { attachBoardInput, LONG_PRESS_MS } from '../../src/render/boardInput.js';

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

  // A long frame (a busy phone) can hold the page past the hold's deadline while the finger has
  // already lifted: the timer and the queued pointerup are both waiting. A late timer looks again
  // one task later, after the queued input ran, so that slow tap stays a tap.
  it('a timer that runs late behind a long frame waits for a queued release: the tap goes through', () => {
    let t = 0;
    const { g, calls } = make({ ms: BAR_HOLD_MS, now: () => t });
    g.down(ev());
    t = 2000; // a 2 s frame: the timer runs ~1.45 s late
    vi.advanceTimersByTime(BAR_HOLD_MS);
    expect(calls.fire).toBe(0);
    expect(g.pending).toBe(true);
    expect(g.up(ev())).toBe(false); // the release that was queued behind the timer
    vi.advanceTimersByTime(1000);
    expect(calls.fire).toBe(0);
    expect(calls.cancel).toBe(1);
  });

  it('a late timer with the finger still down fires one task later (a real hold stays a hold)', () => {
    let t = 0;
    const { g, calls } = make({ ms: BAR_HOLD_MS, now: () => t });
    g.down(ev());
    t = BAR_HOLD_MS + LATE_FIRE_MS + 1;
    vi.advanceTimersByTime(BAR_HOLD_MS);
    expect(calls.fire).toBe(0);
    vi.advanceTimersByTime(1); // the next task
    expect(calls.fire).toBe(1);
    expect(g.up(ev())).toBe(true);
    // on time (or only a little late) it fires at once, as before
    const b = make({ ms: BAR_HOLD_MS, now: () => t });
    b.g.down(ev());
    t += BAR_HOLD_MS + LATE_FIRE_MS;
    vi.advanceTimersByTime(BAR_HOLD_MS);
    expect(b.calls.fire).toBe(1);
  });

  it('board long press: a late timer waits for the queued release too', () => {
    let t = 0;
    const target = new EventTarget();
    target.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 400 });
    const long = [];
    const taps = [];
    const input = attachBoardInput(target, {
      rig: { panBy() {}, zoomAt() {}, reset() {}, isDefault: true },
      pick: () => ({ towerUid: 7 }),
      gestures: () => ({ pan: false, zoom: false, reset: false, tapSlop: 12 }),
      onTap: (p) => taps.push(p),
      onLongPress: (p) => long.push(p),
      now: () => t,
    });
    const pe = (type, x = 100, y = 100) => Object.assign(new Event(type), { pointerId: 1, pointerType: 'touch', button: 0, clientX: x, clientY: y });
    target.dispatchEvent(pe('pointerdown'));
    t = 1500; // a long frame: the timer runs late, the finger had lifted at ~200 ms
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(long).toHaveLength(0);
    t = 1501;
    target.dispatchEvent(pe('pointerup'));
    vi.advanceTimersByTime(1000);
    expect(long).toHaveLength(0);
    // a real long press still fires (one task late when its timer ran late)
    t = 5000;
    target.dispatchEvent(pe('pointerdown'));
    t = 5000 + LONG_PRESS_MS + LATE_FIRE_MS + 50;
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(long).toHaveLength(0);
    vi.advanceTimersByTime(1); // the next task
    expect(long).toHaveLength(1);
    expect(long[0].towerUid).toBe(7);
    target.dispatchEvent(pe('pointerup'));
    input.dispose();
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

  it('never a target: face-down recruit cards, the SSR showcase, the sheet itself, the battle', () => {
    const ex = HOLD_EXCLUDE.split(',').map((x) => x.trim());
    for (const sel of ['.ma-gc:not(.flipped)', '.ma-showcase', '.us-overlay', '.bt-root', '[data-hold-info="off"]']) expect(ex).toContain(sel);
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
