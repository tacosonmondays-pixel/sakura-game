// UI M5b: a hub screen's host girl (docs/specs/UI_DIRECTION.md §5.10 E1), put together from the M5a kit: who she is
// (hosts.js), what she says in this state (hostLines.js) and her stand or bust chip (host.js). Every hub places her
// for its mode: the stand in her column, the chip in a header row with no column at all (placeHost), runs the
// collapse rule with its real layout (hubMode), pins the mode and moves her when a resize flips it (watchHostMode).
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

/** The viewport now (the collapse rule's input). */
export const viewport = () => ({ vw: globalThis.innerWidth || 1280, vh: globalThis.innerHeight || 720 });

/** The phone breakpoint the stylesheets use. */
export const isPhone = () => viewport().vh <= 480;

/**
 * Pure: the stand or the chip for a hub whose content sits beside her, from the content height that is left for the
 * list or grid under the screen's own header rows (`headerH`). The collapse rule of host.js.
 */
export function hubMode({ vw, vh, headerH = 0 }) {
  const topbar = vh <= 480 ? 40 : 48;
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
