// Landscape-first helpers (owner: ui). On touch devices held in portrait we show a friendly
// "Please rotate your device 🌸" overlay with an animated phone; non-battle screens can
// dismiss it. In fullscreen / installed PWA mode we try screen.orientation.lock('landscape').
// Also exposes the fullscreen toggle used by Settings and the Menu Tab.
//
// Pure helpers (shouldPrompt, isLandscapeSize) take plain values so they can be unit-tested
// without a DOM.
import { h } from './dom.js';

const DISMISS_KEY = 'sakura-ui-rotate-dismissed';
/** Routes where the overlay cannot be dismissed (the battle really needs landscape). */
export const LANDSCAPE_ONLY_ROUTES = ['battle'];

/** True when width ≥ height (landscape) — also true for square-ish viewports. */
export function isLandscapeSize(width, height) {
  return width >= height;
}

/**
 * Decide whether the rotate prompt should show.
 * @param {{ touch: boolean, width: number, height: number, route: string|null, dismissed: boolean }} s
 * @returns {{ show: boolean, dismissable: boolean }}
 */
export function shouldPrompt({ touch, width, height, route, dismissed }) {
  const portrait = !isLandscapeSize(width, height);
  const forced = LANDSCAPE_ONLY_ROUTES.includes(route || '');
  if (!touch || !portrait) return { show: false, dismissable: !forced };
  if (forced) return { show: true, dismissable: false };
  return { show: !dismissed, dismissable: true };
}

export function isTouchDevice() {
  try {
    if (navigator.maxTouchPoints > 0) return true;
    return !!window.matchMedia?.('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

export function isFullscreen() {
  try {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  } catch {
    return false;
  }
}

export function isStandalone() {
  try {
    return window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  } catch {
    return false;
  }
}

/** Try to lock the screen to landscape (only works in fullscreen / installed apps). */
export async function lockLandscape() {
  try {
    if (screen.orientation?.lock && (isFullscreen() || isStandalone())) {
      await screen.orientation.lock('landscape');
      return true;
    }
  } catch {
    /* unsupported or denied — the overlay still guides the player */
  }
  return false;
}

export async function requestFullscreen() {
  const el = document.documentElement;
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    await lockLandscape();
    return isFullscreen();
  } catch (e) {
    console.warn('[orientation] fullscreen refused', e);
    return false;
  }
}

export async function exitFullscreen() {
  try {
    if (document.exitFullscreen) await document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  } catch {
    /* ignore */
  }
  return isFullscreen();
}

export async function toggleFullscreen() {
  return isFullscreen() ? exitFullscreen() : requestFullscreen();
}

export function canFullscreen() {
  try {
    return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  } catch {
    return false;
  }
}

let overlay = null;
let dismissed = false;
let currentRoute = null;
let forced = false;

/**
 * Automation (Playwright / e2e) runs phones in portrait and clicks through the UI; the
 * prompt would swallow those clicks, so it stays off under `navigator.webdriver` unless a
 * test forces it with setForce(true) or `?rotate=1`.
 */
function isAutomated() {
  try {
    if (forced) return false;
    if (/[?&]rotate=1/.test(location.search)) return false;
    return navigator.webdriver === true;
  } catch {
    return false;
  }
}

/** Test hook: force the prompt logic on (ignores the automation guard). */
export function setForce(v) {
  forced = !!v;
  update();
}

function readDismissed() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(v) {
  dismissed = v;
  try {
    if (v) sessionStorage.setItem(DISMISS_KEY, '1');
    else sessionStorage.removeItem(DISMISS_KEY);
  } catch {
    /* ignore */
  }
}

function buildOverlay() {
  const dismissBtn = h('button.btn.btn-ghost', { onclick: () => { writeDismissed(true); update(); }, 'data-testid': 'rotate-dismiss' }, h('span.btn-label', 'Continue in portrait'));
  const fsBtn = h('button.btn.btn-yellow', { onclick: async () => { await requestFullscreen(); update(); }, 'data-testid': 'rotate-fullscreen' }, h('span.btn-label', 'Go fullscreen'));
  const el = h(
    'div.rotate-overlay',
    { role: 'dialog', 'aria-live': 'polite', 'data-testid': 'rotate-overlay', hidden: true },
    h('div.rotate-phone'),
    h('div.rotate-title', 'Please rotate your device 🌸'),
    h('p.rotate-text', 'Sakura Sentinels is designed for landscape — turn your phone sideways for the full academy view.'),
    h('div.row', canFullscreen() ? fsBtn : null, dismissBtn),
  );
  el.dismissBtn = dismissBtn;
  return el;
}

/** Re-evaluate the prompt against the current viewport and route. */
export function update() {
  if (!overlay) return;
  const r = shouldPrompt({ touch: isTouchDevice() && !isAutomated(), width: window.innerWidth, height: window.innerHeight, route: currentRoute, dismissed });
  overlay.hidden = !r.show;
  overlay.dismissBtn.hidden = !r.dismissable;
  document.documentElement.classList.toggle('portrait-touch', isTouchDevice() && !isLandscapeSize(window.innerWidth, window.innerHeight));
  return r;
}

/**
 * Mount the overlay and start listening for resize / orientation / route changes.
 * @returns {() => void} stop
 */
export function initOrientation({ route = null } = {}) {
  if (typeof window === 'undefined' || overlay) return () => {};
  dismissed = readDismissed();
  currentRoute = route;
  overlay = buildOverlay();
  document.body.appendChild(overlay);
  const onResize = () => update();
  const onRoute = (e) => {
    currentRoute = e?.detail?.name || null;
    // Entering battle re-arms the prompt (it cannot be dismissed there anyway).
    update();
  };
  const onFullscreen = () => {
    if (isFullscreen()) lockLandscape();
    update();
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  window.addEventListener('screenchange', onRoute);
  document.addEventListener('fullscreenchange', onFullscreen);
  update();
  return () => {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onResize);
    window.removeEventListener('screenchange', onRoute);
    document.removeEventListener('fullscreenchange', onFullscreen);
    overlay?.remove();
    overlay = null;
  };
}
