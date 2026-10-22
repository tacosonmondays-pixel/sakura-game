// The host girl of a hub or list screen (docs/specs/UI_DIRECTION.md §5.10 E1; owner #69): her drawn stand with a
// speech bubble. Who she is: ./hosts.js; what she says: ./hostLines.js. Styles: components.css "M5" (.ui-host).
//
// - Width: 'hub' screens up to 35% of the width (295 px at 844, 448 px at 1280); 'list' screens up to 26% on
//   phones and 30% on desktop, standing on the RIGHT so the left rail and the list keep the left thumb. Detail
//   screens are not hosts (their art band keeps 28%).
// - The bubble: white glass, radius 24, a tail, ONE line in --fs-body 700 over her lower third, never over the list
//   (at most 34 characters on a hub, 24 on a list: hostLines.js MAX_LINE, measured by e2e/m5-kit.mjs). aria-live
//   polite. A tap shows the next line. Reduce motion: no bounce.
// - The collapse rule: when the list or grid column would drop under 420 px, the content window under 300 px, or a
//   hub is under 800 px wide (STAND_MIN_VW: her 35% column could no longer hold a one-line bubble beside a list that
//   still fits: small landscape phones, 667x375 and 740x360), she becomes a bust chip with the same bubble beside it
//   (data-mode="chip"). The chip takes no column: the screen drops its host column (the list gets the full width) and
//   places her in a spare row (a header: the list's plate header, a top row or a strip over a grid), never over the
//   list. In a header row the chip is the small one (hubs.css: a 40 px bust); --host-chip (96 px) elsewhere.
import { h } from './dom.js';
import { portraitHTML } from '../art/portraits.js';
import { lineOk } from './hostLines.js';

export const HOST_SHARE = Object.freeze({ hub: 0.35, listPhone: 0.26, listDesk: 0.3 });
export const MIN_LIST_W = 420;
export const MIN_CONTENT_H = 300;
/** A hub narrower than this shows the chip (UI M5b review: 667x375 and 740x360 phones). */
export const STAND_MIN_VW = 800;
export const CHIP_PX = 96;
const PHONE_H = 480; // the phone breakpoint the stylesheets use (max-height: 480px)

/** Her width share of the viewport for a screen kind at this viewport. */
export function hostShare(kind, vh) {
  if (kind === 'hub') return HOST_SHARE.hub;
  return vh <= PHONE_H ? HOST_SHARE.listPhone : HOST_SHARE.listDesk;
}

/**
 * Pure: the stand or the bust chip, by the collapse rule.
 * @param {{ vw: number, vh: number, kind?: 'hub'|'list', railW?: number, gutters?: number, contentH?: number|null }} o
 *   railW: the left rail's width (list screens); gutters: the screen's side gutters and gaps; contentH: the content
 *   window (default: the viewport under the top bar)
 * @returns {{ mode: 'stand'|'chip', hostW: number, listW: number }} hostW: the column she takes (0 as a chip: she
 *   sits in a header row and the list keeps the whole width)
 */
export function hostMode({ vw, vh, kind = 'hub', railW = 0, gutters = 56, contentH = null }) {
  const hostW = Math.round(vw * hostShare(kind, vh));
  const listW = vw - hostW - railW - gutters;
  const content = contentH ?? vh - (vh <= PHONE_H ? 40 : 48);
  const narrow = kind === 'hub' && vw < STAND_MIN_VW;
  const mode = narrow || listW < MIN_LIST_W || content < MIN_CONTENT_H ? 'chip' : 'stand';
  return { mode, hostW: mode === 'chip' ? 0 : hostW, listW: mode === 'chip' ? vw - railW - gutters : listW };
}

/**
 * Her stand (or bust chip) and bubble.
 * @param {object} unit a UnitDef (hosts.js hostFor → UNIT_MAP)
 * @param {{ lines?: string[], kind?: 'hub'|'list', railW?: number, gutters?: number, contentH?: number|null,
 *   forceChip?: boolean, mode?: 'stand'|'chip'|null, onLine?: ((i: number, line: string) => void)|null, testid?: string }} [o]
 *   mode: pins the stand or the chip (a screen that ran hostMode() with its real layout and placed her for it; it
 *   redraws itself when a resize flips the rule)
 * @returns {HTMLElement & { setLines(lines: string[]): void, line(): string, mode(): string }}
 */
export function hostStand(unit, { lines = [], kind = 'hub', railW = 0, gutters = 56, contentH = null, forceChip = false, mode: pinned = null, onLine = null, testid = 'host' } = {}) {
  if (pinned === 'chip') forceChip = true;
  const fits = (l) => lineOk(l, kind === 'list' ? 'list' : 'hub');
  let list = (lines || []).filter(fits);
  let i = 0;
  const text = h('span.ui-host-line');
  const bubble = h('button.ui-host-bubble', { type: 'button', 'aria-live': 'polite', 'data-testid': `${testid}-bubble` }, text);
  // (data-hold-info off: her art is scenery here, a hold never opens her info sheet)
  const el = h('div.ui-host', { 'data-kind': kind, 'data-testid': testid, 'data-host': unit?.id || '', 'data-hold-info': 'off' },
    h('div.ui-host-art', { 'aria-hidden': 'true', html: unit ? portraitHTML(unit, 'cut', { eager: true }) : '' }),
    h('div.ui-host-bust', { 'aria-hidden': 'true', html: unit ? portraitHTML(unit, 'bust', { eager: true }) : '' }),
    bubble);
  const show = (pop) => {
    const line = list[i] || '';
    text.textContent = line;
    bubble.hidden = !line;
    bubble.setAttribute('aria-label', `${unit?.name || 'Host'}: ${line}${list.length > 1 ? ' (tap for the next line)' : ''}`);
    if (pop) {
      bubble.classList.remove('pop');
      void bubble.offsetWidth; // restart the little bounce (none under Reduce motion: CSS)
      bubble.classList.add('pop');
    }
  };
  bubble.addEventListener('click', (e) => {
    e.stopPropagation();
    if (list.length < 2) return;
    i = (i + 1) % list.length;
    show(true);
    onLine?.(i, list[i]);
  });
  const layout = () => {
    const vw = globalThis.innerWidth || 1280;
    const vh = globalThis.innerHeight || 720;
    el.dataset.mode = forceChip ? 'chip' : pinned === 'stand' ? 'stand' : hostMode({ vw, vh, kind, railW, gutters, contentH }).mode;
  };
  layout();
  if (!forceChip && !pinned && globalThis.addEventListener) {
    // (built and attached in the same task: a resize that finds her off the page means her screen is gone)
    const onResize = () => {
      if (!el.isConnected) {
        globalThis.removeEventListener('resize', onResize);
        return;
      }
      layout();
    };
    globalThis.addEventListener('resize', onResize);
  }
  show(false);
  el.setLines = (next) => {
    list = (next || []).filter(fits);
    i = 0;
    show(false);
  };
  el.line = () => list[i] || '';
  el.mode = () => el.dataset.mode;
  return el;
}
