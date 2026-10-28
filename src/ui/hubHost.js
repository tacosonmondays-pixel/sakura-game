// UI M5b: a hub screen's host girl (docs/specs/UI_DIRECTION.md §5.10 E1), put together from the M5a kit: who she is
// (hosts.js), what she says in this state (hostLines.js) and her stand or bust chip (host.js). Every hub places her
// for its mode: the stand in her column, the chip in a header row with no column at all (placeHost), runs the
// collapse rule with its real layout (hubMode), pins the mode and moves her when a resize flips it (watchHostMode).
// UI M5c: the list screens' host (listHost, listMode): the same pieces, kind 'list', on the right of the list.
import { UNIT_MAP } from '../data/units.js';
import { hostStand, hostMode } from './host.js';
import { hostFor } from './hosts.js';
import { linesFor } from './hostLines.js';

/**
 * @param {string} screen a hosts.js HOSTS key ('missions', 'commissions', 'login', 'bounty', 'assault', 'titans')
 * @param {object} profile the save
 * @param {{ state?: object, guest?: string|null, mode?: 'stand'|'chip'|null, testid?: string }} [o]
 *   state: the screen's state for hostLines.js; guest: this week's double-drop guest (Bounty)
 * @returns {ReturnType<typeof hostStand>}
 */
export function hubHost(screen, profile, { state = {}, guest = null, mode = null, testid = 'host' } = {}) {
  const unit = UNIT_MAP[hostFor(screen, profile, { guest })];
  return hostStand(unit, { lines: linesFor(screen, state), kind: 'hub', mode, testid });
}

/**
 * UI M5c: a list screen's host (E1 on the E3 list screens: the Mailroom, the Mall, Happening Now). Kind 'list': her
 * stand on the RIGHT at 26% (phones) / 30% (desktop), so the left rail and the list keep the left thumb.
 * @param {string} screen 'mail' | 'mall' | 'happening' (hosts.js HOSTS)
 * @param {object} profile the save
 * @param {{ state?: object, mode?: 'stand'|'chip'|null, testid?: string }} [o]
 */
export function listHost(screen, profile, { state = {}, mode = null, testid = 'host' } = {}) {
  const unit = UNIT_MAP[hostFor(screen, profile)];
  return hostStand(unit, { lines: linesFor(screen, state), kind: 'list', mode, testid });
}

/** The left rail's width on the list screens (hubs.css --ls-rail-w): phones (max-height 480 px) / larger. */
export const LIST_RAIL_W = Object.freeze({ phone: 128, desk: 168 });

/** Pure: the stand or the chip for a list screen (the collapse rule of host.js, with the rail's width). */
export function listMode({ vw, vh }) {
  return hostMode({ vw, vh, kind: 'list', railW: vh <= 480 ? LIST_RAIL_W.phone : LIST_RAIL_W.desk }).mode;
}

/**
 * [ui-v2 M5] A scrolling list at rest never cuts a control across its middle (P6: a tap is 44 px): when an edge of the
 * list crosses a button with the button's middle still in view, the list moves to the nearest place (up or down, at
 * most 66 px) where every button shows whole or has its middle out of view. Runs once now and after every scroll that
 * comes to rest, like a soft scroll snap. Returns the stop function.
 * @param {HTMLElement} list the scroller
 * @returns {() => void}
 */
export function keepWholeTaps(list) {
  if (!list?.addEventListener) return () => {};
  const CONTROLS = 'button:not(:disabled), [role="button"], a[href]';
  const settle = () => {
    if (!list.isConnected || list.scrollHeight <= list.clientHeight + 1) return;
    const box = list.getBoundingClientRect();
    const rects = [...list.querySelectorAll(CONTROLS)].map((c) => c.getBoundingClientRect()).filter((r) => r.height > 0);
    // (a control is fine whole in view, wholly out of it, or cut with its middle out of view)
    const clean = (d) => rects.every((r) => {
      const top = r.top - d;
      const bottom = r.bottom - d;
      const mid = (top + bottom) / 2;
      if (top >= box.top - 0.5 && bottom <= box.bottom + 0.5) return true;
      if (bottom <= box.top || top >= box.bottom) return true;
      return mid < box.top || mid > box.bottom;
    });
    const s = list.scrollTop;
    const max = list.scrollHeight - list.clientHeight;
    // the nearest resting place, up or down, by at most one tap and a half
    for (let k = 0; k <= 66; k++) {
      for (const d of k ? [-k, k] : [0]) {
        if (s + d < 0 || s + d > max) continue;
        if (!clean(d)) continue;
        if (d) list.scrollTop = s + d;
        return;
      }
    }
  };
  let t = null;
  const later = () => {
    clearTimeout(t);
    t = setTimeout(settle, 140);
  };
  list.addEventListener('scroll', later, { passive: true });
  requestAnimationFrame(() => requestAnimationFrame(settle));
  return () => {
    clearTimeout(t);
    list.removeEventListener('scroll', later);
  };
}

/** The viewport now (the collapse rule's input). */
export const viewport = () => ({ vw: globalThis.innerWidth || 1280, vh: globalThis.innerHeight || 720 });

/** The phone breakpoint the stylesheets use. */
export const isPhone = () => viewport().vh <= 480;

/**
 * A hub whose slanted tiles need the width (`wideGrid`: Missions, Titan Trials) keeps her stand on a screen taller than
 * a phone only from this width. Beside her 35% column the tiles cut their names short below it (the UI M5 final
 * review: at 1024x768 Missions' small tiles read "Ti… Tr…", "M… pl…", "S…" and the titans "Foundry…", "Gloom R…"; at
 * 1180x820 the Multiplayer tile ended in "…" and "★ Titan of the Week" ran under its token; 1280x720 fits). Under it,
 * tablets in landscape (1024x768, 1180x820) show her chip and the tiles take the whole width. Phones keep the rule
 * above (their tiles have their own phone sizes).
 */
export const WIDE_GRID_VW = 1240;

/**
 * Pure: the stand or the chip for a hub whose content sits beside her, from the content height that is left for the
 * list or grid under the screen's own header rows (`headerH`). The collapse rule of host.js, plus WIDE_GRID_VW for a
 * hub whose tiles need the width (`wideGrid`).
 * @param {{ vw: number, vh: number, headerH?: number, wideGrid?: boolean }} o
 */
export function hubMode({ vw, vh, headerH = 0, wideGrid = false }) {
  const topbar = vh <= 480 ? 40 : 48;
  if (wideGrid && vh > 480 && vw < WIDE_GRID_VW) return 'chip';
  return hostMode({ vw, vh, kind: 'hub', contentH: vh - topbar - headerH }).mode;
}

/**
 * Puts a hub's host where her mode says (the collapse rule, host.js). 'stand': the first child of the hub grid `hb`,
 * her column on. 'chip': the start of `slot`, a header row (the list's plate header, a top row or a strip over a
 * grid); `hb` drops her column (.no-host), so the list keeps the whole width (the UI M5b review: a chip in a column
 * squeezed small phones' lists). The slot gets .has-host: a plate header's title then reads for screen readers only
 * (the tab rail or the top bar already names the list; hubs.css).
 * @param {HTMLElement} host hubHost()
 * @param {'stand'|'chip'} mode
 * @param {{ hb: HTMLElement, slot?: HTMLElement|null }} at
 */
export function placeHost(host, mode, { hb, slot = null }) {
  const chip = mode === 'chip' && !!slot;
  host.dataset.mode = chip ? 'chip' : 'stand';
  hb.classList.toggle('no-host', chip);
  for (const s of hb.querySelectorAll('.has-host')) if (s !== slot) s.classList.remove('has-host');
  slot?.classList.toggle('has-host', chip);
  if (chip) slot.prepend(host);
  else hb.prepend(host);
}

/**
 * Redraws the screen when a resize flips the collapse rule (a phone turned, a window resized). Stops by itself once
 * `el` has left the page.
 * @param {HTMLElement} el the screen root
 * @param {() => string} current the mode drawn now
 * @param {() => string} wanted the mode the rule asks for now
 * @param {() => void} redraw
 */
export function watchHostMode(el, current, wanted, redraw) {
  if (!globalThis.addEventListener) return () => {};
  let t = null;
  const on = () => {
    if (!el.isConnected) {
      globalThis.removeEventListener('resize', on);
      return;
    }
    clearTimeout(t);
    t = setTimeout(() => { if (el.isConnected && wanted() !== current()) redraw(); }, 120);
  };
  globalThis.addEventListener('resize', on);
  return () => {
    clearTimeout(t);
    globalThis.removeEventListener('resize', on);
  };
}
