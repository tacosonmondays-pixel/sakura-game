// Hold-for-info (owner request #152): press and hold a girl's card or portrait for ~0.45 s and
// her Unit Sheet opens (src/ui/unitSheet.js, lazy). A pink ring fills while you hold; a quick
// tap, a scroll or a drag behaves exactly as before. Desktop: right-click (or `i` on a focused
// card). Also the shared pieces the battle Upgrade Tree uses: the hold gesture, the fill ring,
// the one-shot click swallower and the Escape stack.
//
// Contract (CONTRACTS.md §11): any element with data-unit="<id>" (or data-hold-unit) on a
// HOLD_ROUTES screen is a hold target; data-hold-info="off" on an ancestor opts out.
import './styles/hold.css';
import { currentRoute } from './router.js';
import { UNIT_MAP } from '../data/units.js';

export const HOLD_MS = 450;
export const BAR_HOLD_MS = 550;
export const RING_DELAY_MS = 120;
export const MOVE_CANCEL_PX = 10;
export const BAR_MOVE_CANCEL_PX = 8;
export const PEEK_DRAG_PX = 12;
export const SWALLOW_MS = 700;

/** Screens where holding a girl's card opens her sheet (battle has its own tree). */
export const HOLD_ROUTES = new Set(['formation', 'students', 'stage', 'recruit', 'coop', 'wiki', 'backpack', 'mall', 'campaign', 'rewards']);
/** Never a hold target inside these (the sheet itself, unflipped gacha cards, showcases, battle). */
const EXCLUDE = '[data-hold-info="off"], .us-overlay, .ma-gc:not(.flipped), .mb-showcase, .bt-root';
/** The visual "card" that scales and gets the ring (the nearest of these around the target). */
const ANCHOR = 'button, .unit-card, .ma-gc, .ol-unit, .mb-unit-mini, .mb-fslot';
/** Routes where "Open full page" would break something (leaving the co-op lobby closes the room). */
const NO_FULL_PAGE = new Set(['coop']);

// ---------------------------------------------------------------------------
// Gesture (pure timing + distance; no DOM) — unit tested in tests/ui/hold.test.js
// ---------------------------------------------------------------------------

/**
 * One press-and-hold. Feed it the pointer events of one element (or the document).
 *   down(e)  starts the timers (a second pointer while one is pending is ignored → false)
 *   move(e)  cancels beyond movePx before the fire; after the fire, an upward move beyond
 *            dragOutPx calls onDragOut once (peek → drag). Returns true while a fired hold
 *            should keep the caller from reacting to moves (e.g. starting a drag).
 *   up(e)    → true when the hold fired and was not turned into a drag (skip the tap action)
 * @param {{ ms?: number, movePx?: number, ringDelay?: number, onStart?: Function, onFire?: Function,
 *   onCancel?: Function, onDragOut?: Function|null, dragOutPx?: number }} o
 */
export function createHoldGesture({
  ms = HOLD_MS, movePx = MOVE_CANCEL_PX, ringDelay = RING_DELAY_MS, onStart = null, onFire = null, onCancel = null,
  onDragOut = null, dragOutPx = PEEK_DRAG_PX,
} = {}) {
  let p = null; // { id, x, y, fired, out, fireT, ringT }
  const clear = () => {
    if (!p) return;
    clearTimeout(p.fireT);
    clearTimeout(p.ringT);
  };
  const g = {
    down(e) {
      if (p) return false;
      const press = { id: e.pointerId, x: e.clientX, y: e.clientY, fired: false, out: false, fireT: 0, ringT: 0 };
      p = press;
      press.ringT = setTimeout(() => { if (p === press && !press.fired) onStart?.(); }, ringDelay);
      press.fireT = setTimeout(() => {
        if (p !== press) return;
        press.fired = true;
        clearTimeout(press.ringT);
        onFire?.();
      }, ms);
      return true;
    },
    move(e) {
      if (!p || e.pointerId !== p.id) return false;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      if (!p.fired) {
        if (Math.hypot(dx, dy) > movePx) g.cancel();
        return false;
      }
      if (p.out) return false;
      if (onDragOut && -dy > dragOutPx && Math.abs(dy) >= Math.abs(dx) * 0.8) {
        p.out = true;
        onDragOut();
        return false;
      }
      return true;
    },
    up(e) {
      if (!p || (e && e.pointerId != null && e.pointerId !== p.id)) return false;
      const press = p;
      clear();
      p = null;
      if (!press.fired) {
        onCancel?.();
        return false;
      }
      return !press.out;
    },
    cancel() {
      if (!p) return;
      const press = p;
      clear();
      p = null;
      if (!press.fired) onCancel?.();
    },
    get pending() {
      return !!p && !p.fired;
    },
    get fired() {
      return !!p && p.fired;
    },
    get draggedOut() {
      return !!p && p.out;
    },
  };
  return g;
}

// ---------------------------------------------------------------------------
// Fill ring (one reused element, compositor-only animation)
// ---------------------------------------------------------------------------

let ringEl = null;
let ringAnchor = null;
let ringPopT = 0;

/** Shows the pink fill ring centred on `anchor`, filling over `durMs`. */
export function showHoldRing(anchor, durMs = HOLD_MS - RING_DELAY_MS) {
  if (typeof document === 'undefined' || !anchor?.getBoundingClientRect) return;
  if (!ringEl) {
    ringEl = document.createElement('div');
    ringEl.className = 'hold-ring';
    ringEl.setAttribute('aria-hidden', 'true');
    ringEl.innerHTML = '<svg viewBox="0 0 40 40"><circle class="hold-ring-bg" cx="20" cy="20" r="17"/><circle class="hold-ring-track" cx="20" cy="20" r="15"/><circle class="hold-ring-fill" cx="20" cy="20" r="15" pathLength="100"/></svg><span class="hold-ring-i">i</span>';
  }
  clearTimeout(ringPopT);
  hideHoldRing();
  const r = anchor.getBoundingClientRect();
  const size = Math.max(36, Math.min(64, 0.55 * Math.min(r.width, r.height)));
  ringEl.style.left = `${Math.round(r.left + r.width / 2)}px`;
  ringEl.style.top = `${Math.round(r.top + r.height / 2)}px`;
  ringEl.style.setProperty('--s', `${Math.round(size)}px`);
  ringEl.style.setProperty('--d', `${Math.max(60, durMs)}ms`);
  ringEl.classList.remove('run', 'pop');
  document.body.appendChild(ringEl);
  void ringEl.offsetWidth; // restart the fill
  ringEl.classList.add('run');
  ringAnchor = anchor;
  anchor.classList.add('hold-active');
}

/** Removes the ring (pop: a 120 ms pop-out when the hold fired). */
export function hideHoldRing({ pop = false } = {}) {
  if (ringAnchor) ringAnchor.classList.remove('hold-active');
  ringAnchor = null;
  if (!ringEl?.isConnected) return;
  if (pop) {
    ringEl.classList.add('pop');
    const el = ringEl;
    ringPopT = setTimeout(() => el.remove(), 130);
  } else ringEl.remove();
}

// ---------------------------------------------------------------------------
// Click swallower + Escape stack
// ---------------------------------------------------------------------------

let swallow = null;

/**
 * Eats the click that follows a fired hold (so the card's tap action — remove, toggle, swap,
 * navigate — does not also run, and the sheet's backdrop does not catch the release). Expires on
 * the first click, on the next pointerdown, or SWALLOW_MS after the release (some mobile
 * browsers send no click after a long press).
 */
export function swallowNextClick({ ms = SWALLOW_MS } = {}) {
  if (typeof window === 'undefined') return;
  swallow?.off();
  let timer = 0;
  const off = () => {
    clearTimeout(timer);
    document.removeEventListener('click', onClick, true);
    window.removeEventListener('pointerdown', onDown, true);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onUp, true);
    if (swallow === entry) swallow = null;
  };
  const onClick = (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    off();
  };
  const onDown = () => off();
  const onUp = () => {
    clearTimeout(timer);
    timer = setTimeout(off, ms);
  };
  const entry = { off };
  swallow = entry;
  document.addEventListener('click', onClick, true);
  window.addEventListener('pointerdown', onDown, true);
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('pointercancel', onUp, true);
  timer = setTimeout(off, 8000); // safety: never outlive a stuck press
}

const escStack = [];
function onEscKey(e) {
  if (e.key !== 'Escape' || !escStack.length) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  escStack[escStack.length - 1]();
}

/** Escape closes the topmost registered overlay only. @returns {() => void} unregister */
export function onEscape(fn) {
  if (!escStack.length) window.addEventListener('keydown', onEscKey, true);
  escStack.push(fn);
  return () => {
    const i = escStack.lastIndexOf(fn);
    if (i >= 0) escStack.splice(i, 1);
    if (!escStack.length) window.removeEventListener('keydown', onEscKey, true);
  };
}

// ---------------------------------------------------------------------------
// Meta screens: delegated hold → Unit Sheet
// ---------------------------------------------------------------------------

/** The hold target under `node` on the current screen, or null. */
export function holdTarget(node, route = currentRoute().name) {
  if (!node || typeof node.closest !== 'function' || !HOLD_ROUTES.has(route)) return null;
  const el = node.closest('[data-hold-unit],[data-unit]');
  if (!el || el.closest(EXCLUDE)) return null;
  const unitId = el.dataset.holdUnit || el.dataset.unit;
  if (!UNIT_MAP[unitId]) return null;
  return { el, unitId, anchor: el.closest(ANCHOR) || el };
}

let sheetMod = null;
const loadSheet = () => (sheetMod ||= import('./unitSheet.js').catch((e) => {
  sheetMod = null;
  throw e;
}));

/** Opens a girl's Unit Sheet from any screen (lazy chunk). */
export function openSheetFor(unitId, opts = {}) {
  return loadSheet()
    .then((m) => m.openUnitSheet(unitId, opts))
    .catch((e) => console.warn('[hold] unit sheet unavailable', e));
}

let uninstall = null;

/** Installs the delegated document listeners once (src/main.js). @returns {() => void} */
export function installHoldInfo() {
  if (uninstall) return uninstall;
  let active = null; // { target, g, route, id }
  let lastFire = -1e9;

  const detach = () => {
    document.removeEventListener('pointermove', onMove, true);
    document.removeEventListener('pointerup', onUp, true);
    document.removeEventListener('pointercancel', onUp, true);
    document.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('blur', onAbort);
    document.removeEventListener('visibilitychange', onAbort);
  };
  const end = () => {
    detach();
    active = null;
  };
  const open = (target, route) => {
    openSheetFor(target.unitId, { allowFullPage: !NO_FULL_PAGE.has(route), origin: target.anchor });
  };

  function onDown(e) {
    if (active) return; // a second finger never starts another hold
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const route = currentRoute().name;
    const target = holdTarget(e.target, route);
    if (!target) return;
    const g = createHoldGesture({
      ms: HOLD_MS,
      movePx: MOVE_CANCEL_PX,
      onStart: () => showHoldRing(target.anchor, HOLD_MS - RING_DELAY_MS),
      onCancel: () => hideHoldRing(),
      onFire: () => {
        lastFire = performance.now();
        navigator.vibrate?.(10);
        swallowNextClick();
        hideHoldRing({ pop: true });
        open(target, route);
      },
    });
    active = { target, g, route, id: e.pointerId };
    g.down(e);
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onUp, true);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('blur', onAbort);
    document.addEventListener('visibilitychange', onAbort);
  }
  function onMove(e) {
    if (!active) return;
    active.g.move(e);
    if (!active.g.pending && !active.g.fired) end();
  }
  function onUp(e) {
    if (!active || e.pointerId !== active.id) return;
    active.g.up(e);
    end();
  }
  function onScroll(e) {
    // only a scroll that moves the held card cancels (a chat log or ticker scrolling elsewhere does not)
    const s = e.target;
    if (!active?.g.pending || !(s === document || s === document.documentElement || s?.contains?.(active.target.el))) return;
    active.g.cancel();
    end();
  }
  function onAbort() {
    if (!active) return;
    active.g.cancel();
    hideHoldRing();
    end();
  }
  function onContext(e) {
    const target = holdTarget(e.target);
    if (!target) return;
    e.preventDefault();
    // a touch long-press (Android) already opened her sheet through the hold
    if (active || performance.now() - lastFire < 1500) return;
    open(target, currentRoute().name);
  }
  function onKey(e) {
    if (e.key !== 'i' && e.key !== 'I') return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const target = holdTarget(e.target);
    if (!target) return;
    e.preventDefault();
    open(target, currentRoute().name);
  }
  let prefetched = false;
  function onScreen(e) {
    if (prefetched || !HOLD_ROUTES.has(e.detail?.name)) return;
    prefetched = true;
    const go = () => loadSheet().catch(() => {});
    if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 4000 });
    else setTimeout(go, 1500);
  }

  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('contextmenu', onContext, true);
  document.addEventListener('keydown', onKey);
  window.addEventListener('screenchange', onScreen);
  onScreen({ detail: { name: currentRoute().name } });
  document.documentElement.dataset.holdInfo = 'on'; // e2e: the delegated listeners are up
  uninstall = () => {
    document.removeEventListener('pointerdown', onDown, true);
    document.removeEventListener('contextmenu', onContext, true);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('screenchange', onScreen);
    detach();
    delete document.documentElement.dataset.holdInfo;
    uninstall = null;
  };
  return uninstall;
}
