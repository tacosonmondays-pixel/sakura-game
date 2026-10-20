// The loader gate: one timing rule for every loader in the game (the black loading screen, the
// corner chip, the small slimes inside panels), so none of them ever flashes.
//   · A load that is done within SHOW_AFTER_MS (150 ms) never shows anything.
//   · Once a loader is visible it stays at least MIN_SHOWN_MS (450 ms).
// Pure: the clock and the timers are injected, so the tests drive time by hand.
//
// The DOM side arms a loader the moment a load starts and lets CSS turn it visible after the
// 150 ms delay (an animation-delay on opacity, run by the compositor, so it shows on time even
// while the main thread is stuck parsing a model). The gate only has to know when that happened:
// a load that started at `startAt` became visible at startAt + showAfter.

export const SHOW_AFTER_MS = 150;
export const MIN_SHOWN_MS = 450;

/**
 * @param {object} [o]
 * @param {number} [o.showAfter]  ms before a running load turns its loader visible
 * @param {number} [o.minShown]   ms a visible loader stays at least
 * @param {() => number} [o.now]
 * @param {(fn: () => void, ms: number) => any} [o.setTimer]
 * @param {(id: any) => void} [o.clearTimer]
 * @param {(info: { startAt: number }) => void} [o.onArm]  a load started while idle (arm the loader)
 * @param {() => void} [o.onShow]    showAfter passed with the load still running (informational)
 * @param {() => void} [o.onCancel]  the load ended before showAfter: the loader was never visible
 * @param {() => (void|Promise<void>)} [o.onHide]  the loader was visible and its time is up: hide it
 */
export function createGate(o = {}) {
  const showAfter = o.showAfter ?? SHOW_AFTER_MS;
  const minShown = o.minShown ?? MIN_SHOWN_MS;
  const now = o.now || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  const setTimer = o.setTimer || ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = o.clearTimer || ((id) => clearTimeout(id));
  const call = (fn, ...a) => {
    try {
      return fn?.(...a);
    } catch (e) {
      console.warn('[loader] gate callback failed', e);
      return undefined;
    }
  };

  /** The current busy period: from the first begin() until the loader is hidden (or dropped). */
  let period = null;

  function finish(p) {
    if (period === p) period = null;
    if (p.showTimer != null) clearTimer(p.showTimer);
    if (p.hideTimer != null) clearTimer(p.hideTimer);
    p.showTimer = null;
    p.hideTimer = null;
  }

  /**
   * A load starts. While another one is still running (or its loader is still waiting out its
   * minimum), the new one takes its place: the loader stays exactly as it is.
   * @param {{ startAt?: number }} [opts] startAt: when the loader was armed, if earlier than now
   *   (the boot loader in index.html is armed from the first paint; a loader caught while fading
   *   out counts as visible since now - showAfter)
   * @returns {{ end: () => Promise<{ shown: boolean, superseded?: boolean }>, readonly superseded: boolean }}
   */
  function begin({ startAt } = {}) {
    let p = period;
    if (p) {
      // supersede: the previous ticket ends quietly (it keeps nothing on screen of its own)
      if (p.ticket) p.ticket._supersede();
      if (p.hideTimer != null) {
        clearTimer(p.hideTimer);
        p.hideTimer = null;
      }
      p.waiting = null;
    } else {
      const t0 = startAt ?? now();
      p = { startAt: t0, ticket: null, showTimer: null, hideTimer: null, shown: false, waiting: null };
      period = p;
      call(o.onArm, { startAt: t0 });
      const left = t0 + showAfter - now();
      if (left <= 0) {
        p.shown = true;
        call(o.onShow);
      } else {
        p.showTimer = setTimer(() => {
          p.showTimer = null;
          if (period !== p || p.shown) return;
          p.shown = true;
          call(o.onShow);
        }, left);
      }
    }
    const ticket = makeTicket(p);
    p.ticket = ticket;
    return ticket;
  }

  function makeTicket(p) {
    let superseded = false;
    let ended = null;
    let settle = null;
    const ticket = {
      get superseded() {
        return superseded;
      },
      _supersede() {
        if (superseded) return;
        superseded = true;
        const visible = now() - p.startAt >= showAfter;
        if (settle) settle({ shown: visible, superseded: true });
        else ended = Promise.resolve({ shown: visible, superseded: true });
      },
      /** The load is done: resolves once the screen may be revealed (the loader is gone or never came). */
      end() {
        if (ended) return ended;
        if (superseded) return (ended = Promise.resolve({ shown: false, superseded: true }));
        ended = new Promise((resolve) => {
          settle = resolve;
        });
        const t = now();
        if (t - p.startAt < showAfter) {
          // never visible: drop it at once
          finish(p);
          call(o.onCancel);
          settle({ shown: false });
          return ended;
        }
        if (!p.shown) {
          p.shown = true; // (its show timer was held up by a long task: CSS showed it anyway)
          call(o.onShow);
        }
        const hideAt = p.startAt + showAfter + minShown;
        const hide = () => {
          p.hideTimer = null;
          if (superseded || period !== p) return;
          finish(p);
          const out = call(o.onHide);
          Promise.resolve(out).catch(() => {}).then(() => settle({ shown: true }));
        };
        p.waiting = ticket;
        if (hideAt - t > 0) p.hideTimer = setTimer(hide, hideAt - t);
        else hide();
        return ended;
      },
    };
    return ticket;
  }

  return {
    begin,
    /** 'idle' | 'armed' (running, not visible yet) | 'shown' (visible, running or waiting out its minimum) */
    get state() {
      if (!period) return 'idle';
      return now() - period.startAt >= showAfter ? 'shown' : 'armed';
    },
    /** When the current loader became (or becomes) visible, or null when idle. */
    get visibleAt() {
      return period ? period.startAt + showAfter : null;
    },
    /** Drops whatever is pending without hiding through onHide (page teardown, tests). */
    reset() {
      if (period) finish(period);
      period = null;
    },
    showAfter,
    minShown,
  };
}

/**
 * Progress for the loader's line: a number in 0..1, or null when the progress is unknown (the line
 * is hidden then: never a fake bar).
 * @param {unknown} p
 * @returns {number|null}
 */
export function clampProgress(p) {
  if (p == null || p === '' || typeof p === 'boolean') return null;
  const n = Number(p);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1, n));
}
