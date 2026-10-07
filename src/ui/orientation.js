// Landscape-first helpers (owner: ui). On phones and tablets held in portrait we show a friendly
// "Please rotate your device 🌸" overlay with an animated phone. It can always be dismissed
// (portrait still works, CONTRACTS §0); in battle the button reads "Play in portrait anyway".
// In fullscreen / installed PWA mode we try screen.orientation.lock('landscape').
// Also exposes the fullscreen toggle used by Settings and the Menu Tab.
//
// Pure helpers (shouldPrompt, isLandscapeSize, isHandheld) take plain values so they can be
// unit-tested without a DOM.
import { h } from './dom.js';

const DISMISS_KEY = 'sakura-ui-rotate-dismissed';
/** Routes that really prefer landscape: the prompt's dismiss button is worded for battle there. */
export const LANDSCAPE_PREFERRED_ROUTES = ['battle'];
/** Largest short screen side (CSS px) still treated as a phone or tablet (iPad Pro 12.9" = 1024). */
export const HANDHELD_MAX_SHORT_SIDE = 1024;

/** True when width ≥ height (landscape) — also true for square-ish viewports. */
export function isLandscapeSize(width, height) {
  return width >= height;
}

/**
 * Phone / tablet test from plain values: a coarse primary pointer on a screen whose short side
 * is at most HANDHELD_MAX_SHORT_SIDE. Touchscreen laptops (fine primary pointer) and big touch
 * monitors do not count.
 * @param {{ coarse: boolean, screenWidth: number, screenHeight: number }} s
 */
export function isHandheld({ coarse, screenWidth, screenHeight }) {
  return !!coarse && Math.min(screenWidth, screenHeight) <= HANDHELD_MAX_SHORT_SIDE;
}

/**
 * Decide whether the rotate prompt should show. It is always dismissable.
 * @param {{ touch: boolean, width: number, height: number, route: string|null, dismissed: boolean }} s
 *   touch = a phone or tablet (isHandheld), width/height = the viewport
 * @returns {{ show: boolean, dismissable: boolean, dismissLabel: string }}
 */
export function shouldPrompt({ touch, width, height, route, dismissed }) {
  const battle = LANDSCAPE_PREFERRED_ROUTES.includes(route || '');
  const portrait = !isLandscapeSize(width, height);
  return { show: !!touch && portrait && !dismissed, dismissable: true, dismissLabel: battle ? 'Play in portrait anyway' : 'Continue in portrait' };
}

/** True on phones and tablets (see isHandheld). */
export function isHandheldDevice() {
  try {
    return isHandheld({ coarse: !!window.matchMedia?.('(pointer: coarse)').matches, screenWidth: screen.width, screenHeight: screen.height });
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

/**
 * Dismiss (true) or bring back (false, Settings → "Show again") the rotate prompt for this
 * session — memory and sessionStorage together — and re-evaluate it right away.
 */
export function setDismissed(v) {
  writeDismissed(!!v);
  update();
}

/** @returns {boolean} the prompt is dismissed for this session */
export function isDismissed() {
  return dismissed;
}

function buildOverlay() {
  const dismissLabel = h('span.btn-label', 'Continue in portrait');
  const dismissBtn = h('button.btn.btn-ghost', { onclick: () => setDismissed(true), 'data-testid': 'rotate-dismiss' }, dismissLabel);
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
  el.dismissLabel = dismissLabel;
  return el;
}

/** Re-evaluate the prompt against the current viewport and route. */
export function update() {
  if (!overlay) return;
  const handheld = isHandheldDevice();
  const r = shouldPrompt({ touch: handheld && !isAutomated(), width: window.innerWidth, height: window.innerHeight, route: currentRoute, dismissed });
  overlay.hidden = !r.show;
  overlay.dismissBtn.hidden = !r.dismissable;
  overlay.dismissLabel.textContent = r.dismissLabel;
  document.documentElement.classList.toggle('portrait-touch', handheld && !isLandscapeSize(window.innerWidth, window.innerHeight));
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
    update(); // battle words the dismiss button "Play in portrait anyway"
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
