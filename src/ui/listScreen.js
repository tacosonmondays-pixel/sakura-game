// UI M5c: the list screens' frame (docs/specs/UI_DIRECTION.md §5.10 E1, E2, E3, E6; notes/ui-m5/PLAN.md §5 M5c): the
// Mailroom, the Mall, Happening Now and Settings. The painted location behind (E6), the left section rail (E3, kit.js
// sideRail: the same tab-<id> test ids as every tab rail), the list panel under its ink plate header (E2), and the
// host girl on the right (E1, kind 'list': 26% on phones, 30% on desktop) or, by the collapse rule, as a chip in the
// plate header with no column at all. Styles: hubs.css "M5c" (.ls-*). The screen draws its own rows into `list`.
//
//   const ls = listScreen({ title: 'Mailroom', cls: 'mbx-screen', location: 'mail', host: 'mail', state, sections, active, onPick });
//   root.append(ls.el); ls.setHead('Unclaimed', [claimAll]); ls.list.replaceChildren(...rows);
import { h } from './dom.js';
import { screen } from './components.js';
import { sideRail, plateHead } from './kit.js';
import { hubBackdrop } from './hubArt.js';
import { listHost, listMode, placeHost, viewport, watchHostMode, keepWholeTaps } from './hubHost.js';
import { linesFor } from './hostLines.js';
import { store } from '../core/store.js';
import { tabSwap } from './motion.js';

/**
 * @param {{ title: string, cls?: string, location?: string|null, host?: string|null, state?: object,
 *   sections: { id: string, label: string, icon?: string|null, dot?: boolean, dotTitle?: string }[], active: string,
 *   onPick: (id: string) => void, railLabel?: string, headTestid?: string|null, panel?: boolean }} o
 *   location: a hubArt.js HUB_LOCATIONS key, or null for the plain sky; host: the hosts.js screen key ('mail', 'mall',
 *   'happening'), or null for no host (Settings); panel: false leaves the list without its glass panel and plate
 *   header (Settings: each section brings its own); wholeTaps: [ui-v2 M5] the list at rest never cuts a control across
 *   its middle (hubHost.js keepWholeTaps: the Mailroom, Happening Now)
 * @returns {{ el: HTMLElement, body: HTMLElement, ls: HTMLElement, rail: ReturnType<typeof sideRail>, head: HTMLElement,
 *   list: HTMLElement, host: HTMLElement|null, setHead: (title: string, right?: any[]) => void,
 *   setLines: (state: object) => void, setSections: (sections: object[], active: string) => void, cleanup: () => void }}
 */
export function listScreen({ title, cls = '', location = 'academy', host: hostKey = null, state = {}, sections, active, onPick, railLabel = 'Sections', headTestid = null, panel = true, wholeTaps = false }) {
  const { el, body } = screen(title, { cls: `ls-screen${cls ? ` ${cls}` : ''}` });
  if (location) el.insertBefore(hubBackdrop(location), el.firstChild);
  el.dataset.keys = 'on'; // (E8: Esc goes back here even when the screen has no yellow for Space to press)

  // a section picked on the rail: the list redraws, then comes in (motion.js tabSwap: a crossfade and a 12 px shift)
  const pick = (id) => {
    onPick(id);
    tabSwap(panelEl);
  };
  let rail = sideRail(sections, active, pick, { label: railLabel, cls: 'ls-rail' });
  const head = plateHead(title, { right: [], testid: headTestid });
  const titleSpan = head.querySelector('.ui-plate-title > span');
  const right = head.querySelector('.ui-plate-right');
  const list = h('div.ls-list');
  const panelEl = panel ? h('section.ls-panel', head, list) : h('section.ls-panel.bare', list);
  const ls = h(`div.ls${hostKey ? '' : '.no-host'}`, rail, panelEl);
  body.append(ls);

  let host = null;
  let drawn = null;
  let offResize = () => {};
  if (hostKey) {
    drawn = listMode(viewport());
    host = listHost(hostKey, store.profile, { state, mode: drawn });
    placeHost(host, drawn, { hb: ls, slot: panel ? head : null });
    // a resize that flips the collapse rule (a phone turned, a window resized) moves her to her other place
    offResize = watchHostMode(el, () => drawn, () => listMode(viewport()), () => {
      drawn = listMode(viewport());
      placeHost(host, drawn, { hb: ls, slot: panel ? head : null });
    });
  }

  const offWhole = wholeTaps ? keepWholeTaps(list) : () => {};

  return {
    el,
    body,
    ls,
    get rail() {
      return rail;
    },
    head,
    list,
    host,
    /** The plate header's title and its right side (the host chip, when she is one, stays where she is). */
    setHead(text, kids = []) {
      titleSpan.textContent = text;
      right.replaceChildren(...[kids].flat(Infinity).filter((k) => k != null && k !== false && k !== true));
    },
    /** Her lines for a new state (after a claim, a new day). */
    setLines(next) {
      if (host) host.setLines(linesFor(hostKey, next || {}));
    },
    /** A rail with new dots (after a claim): the same tabs, rebuilt in place. */
    setSections(next, now) {
      const fresh = sideRail(next, now, pick, { label: railLabel, cls: 'ls-rail' });
      rail.replaceWith(fresh);
      rail = fresh;
    },
    cleanup() {
      offResize();
      offWhole();
    },
  };
}
