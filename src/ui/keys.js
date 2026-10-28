// Keyboard on desktop (docs/specs/UI_DIRECTION.md §5.10 E8; notes Q14): Space presses the screen's one primary
// button (`[data-primary]`), and Escape closes or goes back, in this order:
//   1. the onEscape stack (src/ui/hold.js: an open hold sheet or tree; it handles the key itself, first),
//   2. the top modal, when it may be dismissed (the same as a tap outside it),
//   3. the screen's back arrow (the same as tapping it; no arrow, no step).
// Never in a battle or a story scene (they have their own keys), never while typing, and Space never while a
// window is open or a button has focus (Space already presses that button). Hub and list screens only (Q14): a
// screen opts in by marking its primary with data-primary (or its root with data-keys="on"); on any other screen
// both keys do nothing at all, as before. The hints: kit.js kbdHint().
import { currentRoute } from './router.js';

/** Routes with keys of their own (the battle: pause / speed; the scene player: next line / skip; the title). */
export const OWN_KEYS = Object.freeze(new Set(['battle', 'scene', 'title']));

/**
 * Pure: what a key press does.
 * @param {{ key?: string, code?: string, repeat?: boolean, altKey?: boolean, ctrlKey?: boolean, metaKey?: boolean,
 *   shiftKey?: boolean, defaultPrevented?: boolean }} e
 * @param {{ route?: string, optedIn?: boolean, typing?: boolean, focusOnControl?: boolean, modalOpen?: boolean }} ctx
 *   optedIn: the screen on show takes the keys (a [data-primary] or data-keys="on"); typing: focus in an input, a
 *   text area or an editable; focusOnControl: focus on a button or link; modalOpen: a modal or a sheet is open
 * @returns {'primary'|'escape'|null}
 */
export function shouldHandle(e, ctx = {}) {
  if (!e || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return null;
  if (!ctx.optedIn || OWN_KEYS.has(ctx.route)) return null;
  if (ctx.typing) return null;
  if (e.key === 'Escape') return e.repeat ? null : 'escape';
  if (e.key === ' ' || e.code === 'Space') {
    if (e.repeat || e.shiftKey || ctx.modalOpen || ctx.focusOnControl) return null;
    return 'primary';
  }
  return null;
}

const visible = (el) => !!el && el.isConnected && el.getClientRects().length > 0
  && (!el.checkVisibility || el.checkVisibility({ opacityProperty: true, visibilityProperty: true }));

/** The open modal overlays, topmost last (ones fading out excluded). */
const openOverlays = (doc) => [...doc.querySelectorAll('.modal-overlay:not(.closing)')];

/** The page's state for shouldHandle(). */
export function keyContext(doc = document, route = currentRoute().name) {
  const a = doc.activeElement;
  const tag = a?.tagName;
  const typing = !!a && (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || a.isContentEditable);
  const focusOnControl = !!a && a !== doc.body && (tag === 'BUTTON' || tag === 'A' || a.getAttribute?.('role') === 'button' || a.getAttribute?.('role') === 'tab');
  const modalOpen = openOverlays(doc).length > 0 || !!doc.querySelector('.ui-layer:not(.closing)');
  const optedIn = !!doc.querySelector('#app [data-primary], #app [data-keys="on"]');
  return { route, optedIn, typing, focusOnControl, modalOpen };
}

/** The one visible, enabled [data-primary] of the screen, or null (none, or more than one: nothing is guessed). */
export function primaryButton(doc = document) {
  const all = [...doc.querySelectorAll('#app [data-primary]')].filter((el) => visible(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true');
  return all.length === 1 ? all[0] : null;
}

/** Escape without an onEscape layer: the top dismissable modal, else the back arrow. @returns {boolean} handled */
export function escapeStep(doc = document) {
  const overlays = openOverlays(doc);
  if (overlays.length) {
    // a tap on the overlay itself is how a modal closes when it may (components.js modal({ dismissable }))
    overlays[overlays.length - 1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  }
  if (doc.querySelector('.ui-layer:not(.closing)')) return false; // a sheet closes through its own onEscape
  // (the Mailroom's arrow keeps the old modal's test id, mail-close: UI M5c)
  const backBtn = [...doc.querySelectorAll('#app [data-testid="back"], #app .topbar-back')].find(visible);
  if (backBtn) {
    backBtn.click();
    return true;
  }
  return false;
}

let uninstall = null;

/** Installs the keys once (main.js). @returns {() => void} uninstall */
export function installKeys({ win = window, doc = document, route = () => currentRoute().name } = {}) {
  if (uninstall) return uninstall;
  const onKey = (e) => {
    let r = null;
    try {
      r = route();
    } catch {
      r = null;
    }
    const what = shouldHandle(e, keyContext(doc, r));
    if (what === 'primary') {
      const btn = primaryButton(doc);
      if (!btn) return;
      e.preventDefault();
      btn.click();
    } else if (what === 'escape') {
      if (escapeStep(doc)) e.preventDefault();
    }
  };
  // bubble phase on window: hold.js's onEscape stack (capture) goes first and stops the key when it used it
  win.addEventListener('keydown', onKey);
  doc.documentElement.dataset.keys = 'on'; // e2e: the listener is up
  uninstall = () => {
    win.removeEventListener('keydown', onKey);
    delete doc.documentElement.dataset.keys;
    uninstall = null;
  };
  return uninstall;
}
