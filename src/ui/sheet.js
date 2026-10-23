// Bottom sheet and Details sheet (docs/specs/UI_DIRECTION.md §5.4, P1) on the M0 shells of components.css:
// a --scrim behind, an ink header with the title and a 44 px close, a scrolling body. A sheet closes on a tap
// outside it, its close button, a swipe down on its header, Escape (topmost only) and any route change.
// At most two layers are open at once (P1): opening a third replaces the topmost.
import { h } from './dom.js';
import { onEscape } from './hold.js';
import { glyphSVG } from '../art/icons/glyphs.js';
import { inkSurface } from './surfaceMode.js';
import { lineGlyph } from './lineGlyphs.js';
// [ui-ink] On the menus (UI v2, src/ui/styles/ink.css) a sheet floats as a white panel with its bleed ink head and a
// 2 px blur behind it (low 10); the Details sheet keeps the full height with straight sides.

const stack = [];
const reduced = () => document.documentElement.hasAttribute('data-reduce-motion') || !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
/** Layers above everything a menu screen opens (modals 100, the hold sheet 170, toasts 200 stay readable). */
const Z = 180;
export const MAX_LAYERS = 2;

/**
 * @param {{ title: string, body: Node|Node[], full?: boolean, testid?: string|null, cls?: string,
 *   onClose?: (() => void)|null, head?: Node|null }} o
 *   full: the Details sheet (full height, scrolls); head: extra header content after the title (an "i", a chip)
 * @returns {{ close(): void, el: HTMLElement, body: HTMLElement }}
 */
export function openSheet({ title, body, full = false, testid = null, cls = '', onClose = null, head = null }) {
  while (stack.length >= MAX_LAYERS) stack[stack.length - 1].close();
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    offEsc();
    window.removeEventListener('hashchange', close);
    const i = stack.indexOf(api);
    if (i >= 0) stack.splice(i, 1);
    layer.classList.add('closing');
    layer.inert = true;
    setTimeout(() => layer.remove(), reduced() ? 0 : 140);
    onClose?.();
  };
  const closeBtn = h('button.ui-close', { type: 'button', 'aria-label': 'Close', title: 'Close', 'data-testid': testid ? `${testid}-close` : 'sheet-close', onclick: () => close() });
  closeBtn.innerHTML = inkSurface() ? lineGlyph('x', '', { kitSize: false }) : glyphSVG('close');
  const header = h('header.ui-head', h('h2.ui-title', title), head, closeBtn);
  const bodyEl = h('div.ui-body', body);
  const sheet = h(`section.ui-sheet${full ? '.full' : ''}${reduced() ? '' : '.enter'}${cls ? `.${cls}` : ''}`, {
    role: 'dialog', 'aria-modal': 'true', 'aria-label': title, 'data-testid': testid,
  }, header, bodyEl);
  const layer = h('div.ui-layer', { 'data-hold-info': 'off', style: { zIndex: String(Z + stack.length * 2) } },
    h('div.ui-scrim', { onclick: () => close() }), sheet);

  // swipe down on the header closes it (a drag of 60 px or more)
  let y0 = null;
  header.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; y0 = e.clientY; });
  header.addEventListener('pointerup', (e) => { if (y0 != null && e.clientY - y0 > 60) close(); y0 = null; });
  header.addEventListener('pointercancel', () => { y0 = null; });

  document.body.append(layer);
  const offEsc = onEscape(close);
  window.addEventListener('hashchange', close);
  requestAnimationFrame(() => closeBtn.focus({ preventScroll: true }));
  const api = { close, el: sheet, body: bodyEl };
  stack.push(api);
  return api;
}

/** Closes every open sheet (a screen's teardown). */
export function closeSheets() {
  for (const s of [...stack].reverse()) s.close();
}

/** How many sheets are open (tests, e2e). */
export const openSheets = () => stack.length;
