// [ui-ink] The UI v2 motion layer (owner, Oct 27: "add animated transitions"; the timings of the Oct 27 motion study).
// Its CSS is src/ui/styles/motion.css, under the surface mode classes like the rest of the kit (the menus and the
// home, never the battle). Every move is opacity or a transform (the individual translate / scale properties in CSS,
// which compose with a control's own skew and placement), run by the compositor; nothing here blocks input (no inert,
// no pointer-events), and a tap during any of it goes through. Reduce Motion (Settings → html[data-reduce-motion], or
// the system's prefers-reduced-motion): no movement, a 120 ms fade at most, numbers change at once, no pops.
//
//   enter(el, from, { i, base, step, dur })   one piece comes in: from 'top' (the bar, 12 px down), 'left' / 'right'
//                                             (12 / 16 px across), 'up' (8 px up), 'fade', 'scene' (the wallpaper
//                                             settles from 1.03) or 'girl' (8 px up and in), `base + i × step` ms late
//   homeEntrance({ first, scene, girl, top, rail, stack, tools })   the home's entrance (first open / a return)
//   stagger(els, from, o)                     pieces in turn (o.step apart, at most o.max steps): "stagger in" for any
//                                             screen; markup can do the same with data-mo="left" and style="--mo-d: 90ms"
//   countTo(el, value, { key, format })       a balance counts (400 ms, up to 600 for big jumps) from what it showed
//                                             last under `key`; the colour icon beside it pulses on a gain
//   badgeShown(el, key) / badgeGone(key)      a red dot or count pops (240 ms) the first time it shows for its key
//   tabSwap(el, dir)                          a tab's content crossfades in (120 ms) with a 12 px shift (180 ms) in the
//                                             direction of travel (kit.js rail()/sideRail() record it)
// Timings: MOTION_UI. The screen push / pop and its ink wipe live in src/ui/transitions/ (kind.js MOTION).
import { formatNumber } from '../core/util.js';

/** Timings (ms) of the motion layer (the Oct 27 study's table, the owner's "about 1 s" wallpaper settle). */
export const MOTION_UI = Object.freeze({
  // the home's first entrance (from the boot loader or a battle): the wallpaper settles from 1.03, the girl rises in,
  // the top bar comes down, the menu pieces come in from their own edges 40 ms apart
  sceneFirst: 1000, girlFirst: 360, girlFirstDelay: 80, barFirst: 240, barFirstDelay: 100, pieceFirst: 240, pieceFirstBase: 160, pieceFirstStep: 40,
  // coming back from a sub-screen: the same, shorter (the screen change itself is the slide-back's 220 ms)
  sceneReturn: 500, girlReturn: 220, barReturn: 180, pieceReturn: 200, pieceReturnBase: 0, pieceReturnStep: 30,
  /** the most pieces that wait their turn: the ninth and later come in with the eighth */
  maxSteps: 8,
  tabFade: 120, tabShift: 180, tabPx: 12,
  count: 400, countMax: 600, pulse: 240, pop: 240,
  reducedFade: 120,
});

const EASE_SNAP = 'cubic-bezier(0.3, 0, 0, 1)';

/** System "reduce motion" or the in-game setting (html[data-reduce-motion]). */
export function reduced() {
  try {
    if (globalThis.document?.documentElement?.hasAttribute('data-reduce-motion')) return true;
    return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const FROM = new Set(['top', 'left', 'right', 'up', 'fade', 'scene', 'girl']);

/**
 * One piece comes in. CSS runs it (motion.css [data-mo]); the attribute goes when it ends, so a later redraw never
 * replays it. While a cover (the boot loader, a battle's cut) still hides the screen, it waits at its first frame.
 * @param {Element|null} el
 * @param {'top'|'left'|'right'|'up'|'fade'|'scene'|'girl'} [from]
 * @param {{ i?: number, base?: number, step?: number, dur?: number|null, max?: number }} [o]
 */
export function enter(el, from = 'up', { i = 0, base = 0, step = 30, dur = null, max = MOTION_UI.maxSteps } = {}) {
  if (!el?.setAttribute) return el;
  el.setAttribute('data-mo', FROM.has(from) ? from : 'up');
  el.style.setProperty('--mo-d', `${Math.round(base + Math.min(Math.max(0, i), max - 1) * step)}ms`);
  if (dur != null) el.style.setProperty('--mo-t', `${Math.round(dur)}ms`);
  const done = (e) => {
    if (e && e.target !== el) return;
    el.removeEventListener('animationend', done);
    el.removeEventListener('animationcancel', done);
    el.removeAttribute('data-mo');
    el.style.removeProperty('--mo-d');
    el.style.removeProperty('--mo-t');
  };
  el.addEventListener('animationend', done);
  el.addEventListener('animationcancel', done);
  return el;
}

/**
 * Pieces in turn ("stagger in"): each from the same edge, `step` ms apart after `base`.
 * @param {Iterable<Element>} els
 * @param {'top'|'left'|'right'|'up'|'fade'|'scene'|'girl'} [from]
 * @param {{ base?: number, step?: number, dur?: number|null, max?: number, start?: number }} [o] start: the first index
 * @returns {number} how many pieces it started
 */
export function stagger(els, from = 'up', { base = 0, step = 30, dur = null, max = MOTION_UI.maxSteps, start = 0 } = {}) {
  let i = start;
  for (const el of els) if (el) enter(el, from, { i: i++, base, step, dur, max });
  return i - start;
}

// ---------------------------------------------------------------------------------------------------------------
// the home's entrance
// ---------------------------------------------------------------------------------------------------------------

/**
 * The home comes in. First open (from the boot loader or a battle's cut; it waits under the cover and plays from the
 * reveal): the wallpaper settles from 1.03 over 1 s, the girl rises in (360 ms, 80 late), the top bar comes down
 * (240, 100 late), the rail's rows come in from the left and the right stack from the right, 40 ms apart from 160 ms,
 * the corner tools fade in last; all still by about 0.7 s (the wallpaper by 1 s). A return from a sub-screen: the same
 * shorter (the wallpaper from 1.015 in 500, the rest 180-200 ms, 30 ms apart from the start). Taps work from the first
 * frame; Reduce Motion: a 120 ms fade (motion.css). Home layouts pass their own pieces (src/ui/screens/lobby.js).
 * @param {{ first: boolean, scene?: Element|null, live?: Element|null, girl?: Element|null, top?: Element|null,
 *   rail?: Element|null, stack?: Element[], tools?: Element|null }} o
 */
export function homeEntrance({ first, scene = null, live = null, girl = null, top = null, rail = null, stack = [], tools = null }) {
  const M = MOTION_UI;
  for (const s of [scene, live]) {
    if (!s) continue;
    if (!first) s.style.setProperty('--mo-s', '1.015');
    enter(s, 'scene', { dur: first ? M.sceneFirst : M.sceneReturn });
  }
  enter(girl, 'girl', { base: first ? M.girlFirstDelay : 0, dur: first ? M.girlFirst : M.girlReturn });
  enter(top, 'top', { base: first ? M.barFirstDelay : 0, dur: first ? M.barFirst : M.barReturn });
  const base = first ? M.pieceFirstBase : M.pieceReturnBase;
  const step = first ? M.pieceFirstStep : M.pieceReturnStep;
  const dur = first ? M.pieceFirst : M.pieceReturn;
  const rows = rail ? [...rail.children] : [];
  stagger(rows, 'left', { base, step, dur });
  const right = stack.flatMap((x) => (x ? [...x.children] : []));
  stagger(right, 'right', { base: base + step, step, dur });
  enter(tools, 'fade', { base: base + step * Math.max(rows.length, right.length + 1), dur });
}

// ---------------------------------------------------------------------------------------------------------------
// numbers that count
// ---------------------------------------------------------------------------------------------------------------

/** What each counted balance shows right now (key → number), so a redrawn bar goes on from where the last one was. */
const shownValue = new Map();
/** The count running on each element. */
const running = new WeakMap();

/** How long a count from `a` to `b` runs (ms): 400, a little longer for big jumps, never over 600. */
export function countDuration(a, b) {
  const d = Math.abs(Number(b) - Number(a));
  if (!d) return 0;
  return Math.min(MOTION_UI.countMax, MOTION_UI.count + Math.round(Math.max(0, Math.log10(d) - 2) * 40));
}

/** Ease-out cubic. */
export const easeOutCubic = (t) => 1 - (1 - t) ** 3;

/**
 * Shows `value` in `el` (tabular digits come from the kit's .num). With a `key`, a change from what that key showed
 * last counts there (ease-out, 400-600 ms); the colour coin or gem beside it pulses on a gain. Reduce Motion, a first
 * draw, or no change: the number is set at once. While it counts, the element carries data-counting (e2e waits for it
 * to go) and its aria-label-free text ends on the exact value.
 * @param {HTMLElement} el
 * @param {number} value
 * @param {{ key?: string|null, format?: (n: number) => string }} [o]
 */
export function countTo(el, value, { key = null, format = formatNumber } = {}) {
  if (!el) return;
  const v = Number(value) || 0;
  const prev = running.get(el);
  if (prev) prev.stop();
  const from = key != null && shownValue.has(key) ? shownValue.get(key) : v;
  const raf = globalThis.requestAnimationFrame;
  if (key == null || from === v || reduced() || typeof raf !== 'function') {
    if (key != null) shownValue.set(key, v);
    el.textContent = format(v);
    el.removeAttribute?.('data-counting');
    return;
  }
  const dur = countDuration(from, v);
  let t0 = null;
  let id = 0;
  let stopped = false;
  const stop = () => {
    stopped = true;
    if (id) globalThis.cancelAnimationFrame?.(id);
    el.removeAttribute('data-counting');
    running.delete(el);
  };
  running.set(el, { stop });
  el.setAttribute('data-counting', '');
  el.textContent = format(from);
  if (v > from) gainPulse(el);
  let frames = 0;
  const step = (now) => {
    if (stopped) return;
    // (a bar redrawn mid-count: this element left the page; the new one goes on from the value shown here)
    if (++frames > 1 && !el.isConnected) {
      stopped = true;
      running.delete(el);
      return;
    }
    if (t0 == null) t0 = now;
    const p = Math.min(1, (now - t0) / dur);
    const cur = p >= 1 ? v : from + (v - from) * easeOutCubic(p);
    shownValue.set(key, cur);
    el.textContent = format(cur);
    if (p < 1) id = raf(step);
    else stop();
  };
  id = raf(step);
}

/** The value a key shows now (tests, e2e). */
export const shownCount = (key) => shownValue.get(key);

/** The colour icon beside a counting number pulses (1 → 1.12 → 1) and throws two sparkles. */
function gainPulse(numEl) {
  const art = numEl.parentElement?.querySelector(':scope > .ui-cur-art');
  if (!art || reduced()) return;
  art.classList.remove('mo-gain');
  void art.offsetWidth; // (restart it when a second gain lands mid-pulse)
  art.classList.add('mo-gain');
  const off = (e) => {
    if (e.target !== art) return;
    art.classList.remove('mo-gain');
    art.removeEventListener('animationend', off);
  };
  art.addEventListener('animationend', off);
}

// ---------------------------------------------------------------------------------------------------------------
// badges that pop
// ---------------------------------------------------------------------------------------------------------------

/** key → whether its badge was on show at its last draw. */
const badgeOn = new Map();

/**
 * A red dot or count is drawn: it pops (scale 0.4 → 1, the one overshoot) when it was not on show at the last draw of
 * its key (the first time in this session, or back after it went). Returns `el`.
 * @template {Element|null} T
 * @param {T} el
 * @param {string} key
 * @returns {T}
 */
export function badgeShown(el, key) {
  if (!el || !key) return el;
  if (badgeOn.get(key) !== true && !reduced()) {
    el.classList.add('mo-pop');
    el.addEventListener('animationend', () => el.classList.remove('mo-pop'), { once: true });
  }
  badgeOn.set(key, true);
  return el;
}

/** The badge of `key` is not drawn this time (so the next one to show pops). */
export function badgeGone(key) {
  if (key) badgeOn.set(key, false);
}

/** One call for a badge that may or may not be drawn: badgeShown when `el`, badgeGone when not. */
export function badge(el, key) {
  return el ? badgeShown(el, key) : (badgeGone(key), el);
}

// ---------------------------------------------------------------------------------------------------------------
// tabs
// ---------------------------------------------------------------------------------------------------------------

let lastPick = { dir: 0, at: -1e9 };
const now = () => (globalThis.performance?.now?.() ?? Date.now());

/** A tab rail was tapped: which way along it the pick went (-1 back, 1 on), for the content's shift. */
export function noteTabPick(fromIndex, toIndex) {
  lastPick = { dir: Math.sign((toIndex ?? 0) - (fromIndex ?? 0)), at: now() };
}

/** The direction of the tab pick of the last half second (0: none). */
export function recentTabDir() {
  return now() - lastPick.at < 500 ? lastPick.dir : 0;
}

/**
 * A tab's new content comes in: a 120 ms crossfade and a 12 px shift (180 ms) in the direction of travel; Reduce
 * Motion: the fade only. Transform and opacity on the content's own box (WAAPI: the compositor runs it).
 * @param {HTMLElement|null} el the tab's content (its panel)
 * @param {number} [dir] -1, 0 or 1 (default: the last rail pick)
 */
export function tabSwap(el, dir = recentTabDir()) {
  if (!el || typeof el.animate !== 'function') return;
  try {
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MOTION_UI.tabFade, easing: 'linear' });
    if (!reduced() && dir) {
      el.animate([{ transform: `translateX(${MOTION_UI.tabPx * dir}px)` }, { transform: 'none' }], { duration: MOTION_UI.tabShift, easing: EASE_SNAP });
    }
  } catch {
    /* an element that left the page */
  }
}
