// Honor Ribbon elements, title plates and the live-effect governor (owner: ui; docs/specs/ACHIEVEMENTS.md §2.3–2.5).
//
// A ribbon is <span class="rb rb-<class> rb-<s|m|l> fx-<effect>"> holding the SVG (src/art/honors.js) and, for a
// special, its effect layers. Effects run only while the element has `.live`; every `.live` rule in honors.css sits
// inside (prefers-reduced-motion: no-preference) and html:not([data-reduce-motion]), and without `.live` each special
// shows its designed rest frame. Losing `.live` means `animation: none`, never `paused` (paused animations keep their
// layers). The governor keeps at most `budget` specials live per screen root, drops them all while a modal or overlay
// is open or the page is hidden, and runs none under either Reduce Motion source.

import './styles/honors.css';
import { honorSVG, honorMasks, honorSizeTier, fxLayers } from '../art/honors.js';
import { HONOR_MAP, TITLE_MAP } from '../data/honors.js';

let masksInstalled = false;
/** Sets the --rbm-* mask images on <html> once (idempotent; called at boot and by every ribbon). */
export function installHonorMasks() {
  if (masksInstalled || typeof document === 'undefined') return;
  masksInstalled = true;
  const st = document.documentElement.style;
  for (const [k, v] of Object.entries(honorMasks())) st.setProperty(k, v);
}

/** Either Reduce Motion source is on: the system preference or the in-game setting. */
export function reducedMotion() {
  if (typeof document === 'undefined') return true;
  if (document.documentElement.hasAttribute('data-reduce-motion')) return true;
  try {
    return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const template = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html;
  return t.content.firstElementChild;
};

/**
 * An Honor Ribbon element, drawn natively at `size` px (never scaled).
 * @param {string} id the achievement id that grants it (= the ribbon id)
 * @param {number} [size] 40 rows/toasts/pins · 64 the Case grid · 160 detail and fanfare
 * @param {{ locked?: boolean, secret?: boolean, live?: boolean, prio?: number, still?: boolean, title?: string }} [opts]
 *   locked = grey silhouette with a padlock · secret = grey with "?" · live = animate now (ignored under Reduce
 *   Motion; lists leave this to liveHonors) · prio = the governor's priority · still = never animate
 * @returns {HTMLElement}
 */
export function ribbonArt(id, size = 40, { locked = false, secret = false, live = false, prio = 0, still = false, title = null } = {}) {
  installHonorMasks();
  const h = HONOR_MAP[id];
  const cls = h?.class || 'plain';
  const t = honorSizeTier(size);
  const grey = locked || secret;
  const fx = !grey && cls === 'special' ? h.effect : null;
  const el = template(`<span class="rb rb-${cls} rb-${t}${fx ? ` fx-${fx}` : ''}${grey ? ' locked' : ''}${still ? ' still' : ''}" style="--s:${size}px">${honorSVG(id, { locked, secret })}${fx ? fxLayers(fx, t) : ''}${!grey && cls === 'shiny' ? '<span class="rb-once"></span>' : ''}</span>`);
  el.dataset.honor = id;
  if (prio) el.dataset.prio = String(prio);
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', title || (secret ? 'Secret Honor Ribbon' : `${h?.name || 'Honor Ribbon'}${locked ? ' (not earned yet)' : ''}`));
  if (fx && live && !still && !reducedMotion()) el.classList.add('live');
  return el;
}

/** Same as ribbonArt (the name the achievement screens use). */
export const ribbonEl = ribbonArt;

/** A shiny ribbon plays its one light pass (first seen or claimed; skipped under Reduce Motion). */
export function revealShiny(el) {
  if (!el || reducedMotion()) return;
  el.classList.remove('reveal');
  void el.offsetWidth; // restart the one-shot
  el.classList.add('reveal');
}

const PLATE_GLYPH = { standard: '✦', gold: '★', prism: '✦' };
/**
 * A title on its plate: Standard (violet → pink), Gold (foil) or Prism (rainbow ring; only the equipped plate under
 * the name moves, so plates are still unless `live`).
 * @param {string} id title id (an achievement id or fp_ashwing / fp_crimson)
 * @param {{ live?: boolean, small?: boolean, locked?: boolean, text?: string }} [opts] text: shown instead of the
 *   title's name (e.g. "—" for an id this build doesn't know)
 * @returns {HTMLElement}
 */
export function titlePlate(id, { live = false, small = false, locked = false, text = null } = {}) {
  const t = TITLE_MAP[id];
  const plate = t?.plate || 'standard';
  const el = document.createElement('span');
  el.className = `tp tp-${plate}${live && !reducedMotion() ? ' live' : ''}${small ? ' sm' : ''}${locked ? ' locked' : ''}`;
  el.dataset.title = id;
  if (plate === 'prism') {
    const ring = document.createElement('i');
    ring.className = 'tp-ring';
    el.appendChild(ring);
  }
  const label = document.createElement('span');
  label.className = 'tp-text';
  label.textContent = `${PLATE_GLYPH[plate]} ${text ?? t?.name ?? '—'}`;
  el.appendChild(label);
  el.setAttribute('aria-label', `Title: ${text ?? t?.name ?? 'unknown'}`);
  return el;
}

const OVERLAY_SEL = '.modal-overlay, .ach-fanfare';
/**
 * Keeps at most `budget` specials under `root` live: visible ones only, highest `data-prio` first, none while a
 * modal or overlay outside `root` is open, the page is hidden, or Reduce Motion is on. Call again after a re-render
 * (it re-scans). Returns a stop() that clears every `.live` it set.
 * @param {HTMLElement} root
 * @param {{ budget?: number, ignoreOverlays?: boolean }} [opts]
 */
export function liveHonors(root, { budget = 3, ignoreOverlays = false } = {}) {
  if (!root || typeof document === 'undefined') return () => {};
  const visible = new Set();
  let els = [];
  const overlayOpen = () => !ignoreOverlays && [...document.querySelectorAll(OVERLAY_SEL)].some((o) => !root.contains(o) && !o.contains(root));
  const apply = () => {
    const off = reducedMotion() || document.hidden || overlayOpen();
    const want = off ? [] : [...visible].filter((e) => e.isConnected)
      .sort((a, b) => (+b.dataset.prio || 0) - (+a.dataset.prio || 0)).slice(0, budget);
    for (const e of els) e.classList.toggle('live', want.includes(e));
  };
  const io = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entries) => {
      for (const en of entries) (en.isIntersecting ? visible.add(en.target) : visible.delete(en.target));
      apply();
    }, { root: null, threshold: 0.01 })
    : null;
  const scan = () => {
    const now = [...root.querySelectorAll('.rb[class*="fx-"]:not(.still)')];
    for (const e of els) if (!now.includes(e)) { io?.unobserve(e); visible.delete(e); }
    for (const e of now) if (!els.includes(e)) { if (io) io.observe(e); else visible.add(e); }
    els = now;
    apply();
  };
  scan();
  const mo = new MutationObserver(() => scan());
  mo.observe(root, { childList: true, subtree: true });
  const bodyMo = new MutationObserver(() => apply());
  bodyMo.observe(document.body, { childList: true });
  const htmlMo = new MutationObserver(() => apply());
  htmlMo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduce-motion'] });
  document.addEventListener('visibilitychange', apply);
  const stop = () => {
    io?.disconnect();
    mo.disconnect();
    bodyMo.disconnect();
    htmlMo.disconnect();
    document.removeEventListener('visibilitychange', apply);
    for (const e of els) e.classList.remove('live');
  };
  stop.refresh = scan;
  return stop;
}
