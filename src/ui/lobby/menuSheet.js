// [ui-ink] The home's main menu: a night side sheet from the right edge (UI v2 "Ink & Paper", notes/ui-v2/
// UI_V2_DIRECTION.md 12.2; the build plan's V2 step 4). It replaces the Menu Tab modal on the home.
//
// Two groups of rows, a line glyph and a 16 px caps label each, an optional red dot: SQUAD (Formation, Backpack with a
// dot when a box can be opened, Bestiary, Profile) and ACADEMY (Story, Journal with its dot, Notice with a dot when
// unread, Wiki); Settings on the footer row. No numbers, no yellow. It closes on its X, Esc and a tap outside it (and on
// any route change); it slides 16 px and fades in 220 ms (a 150 ms fade under Reduce motion).
// Where the Menu Tab's other entries went (C12): Mail is the top bar's mail button, Chat and Messages the chat button
// (its drawer), Multiplayer and Clan rows of the home's rail, Lobby Background the corner tool, Options and Account
// Settings, Equipment and Items the Backpack, Fullscreen Settings › Display. The Notice row keeps the old tray's hook
// (shortcut-notice).
import { h } from '../dom.js';
import { onEscape } from '../hold.js';
import { lineGlyph } from '../lineGlyphs.js';

const svg = (name, cls = '') => {
  const t = document.createElement('template');
  t.innerHTML = lineGlyph(name, cls);
  return t.content.firstElementChild;
};

/** The sheet's rows (pure data: tests/ui/menuSheet.test.js reads it). */
export const MENU_GROUPS = Object.freeze([
  Object.freeze({ id: 'squad', label: 'Squad', rows: Object.freeze([
    Object.freeze({ id: 'formation', label: 'Formation', glyph: 'shield', testid: 'menu-formation', route: 'formation' }),
    Object.freeze({ id: 'backpack', label: 'Backpack', glyph: 'backpack', testid: 'menu-backpack', route: 'backpack' }),
    Object.freeze({ id: 'bestiary', label: 'Bestiary', glyph: 'book', testid: 'menu-bestiary', route: 'bestiary' }),
    Object.freeze({ id: 'profile', label: 'Profile', glyph: 'user', testid: 'menu-profile', route: 'profile' }),
  ]) }),
  Object.freeze({ id: 'academy', label: 'Academy', rows: Object.freeze([
    Object.freeze({ id: 'story', label: 'Story', glyph: 'booktext', testid: 'menu-story', route: 'story' }),
    Object.freeze({ id: 'journal', label: 'Journal', aria: "Captain's Journal", glyph: 'journal', testid: 'menu-journal', route: 'journal' }),
    Object.freeze({ id: 'notice', label: 'Notice', glyph: 'megaphone', testid: 'shortcut-notice', route: null }),
    Object.freeze({ id: 'wiki', label: 'Wiki', glyph: 'library', testid: 'menu-wiki', route: 'wiki' }),
  ]) }),
]);
/** The footer row. */
export const MENU_FOOT = Object.freeze({ id: 'settings', label: 'Settings', glyph: 'settings', testid: 'settings', route: 'settings' });

let open = null;

/** True while the menu sheet is open. */
export const menuSheetOpen = () => !!open;

/**
 * Opens the menu sheet (a second call while it is open does nothing).
 * @param {{ dots?: Record<string, boolean>, go: (row: object) => void, onClose?: Function, reduced?: boolean }} o
 *   dots: a red dot per row id (backpack, journal, notice); go: a row was chosen (the sheet is closed first)
 * @returns {{ close: () => void, el: HTMLElement }}
 */
export function openMenuSheet({ dots = {}, go, onClose = null, reduced = false }) {
  if (open) return open;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    offEsc();
    window.removeEventListener('hashchange', close);
    layer.classList.add('closing');
    layer.inert = true;
    setTimeout(() => layer.remove(), reduced ? 0 : 150);
    open = null;
    document.body.classList.remove('home-menu-open');
    onClose?.();
  };
  const row = (r) => {
    const dot = dots[r.id];
    return h('a.ui-hrow', {
      href: r.route ? `#/${r.route}` : '#', role: 'button', 'data-testid': r.testid,
      'aria-label': `${r.aria || r.label}${dot ? (r.id === 'notice' ? ', unread' : ', something new') : ''}`,
      onclick: (e) => {
        e.preventDefault();
        close();
        go(r);
      },
    }, svg(r.glyph), h('span.menu-lbl', r.label), dot ? h('i.ui-dot', { 'data-testid': `${r.testid}-dot` }) : null);
  };
  const closeBtn = h('button.ui-ibtn', { type: 'button', 'aria-label': 'Close the menu', title: 'Close', 'data-testid': 'menu-sheet-close', onclick: () => close() }, svg('x'));
  const sheet = h(`aside.ui-sheet.side.home-menu${reduced ? '.ui-fade' : '.home-menu-in'}`, { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Menu', 'data-testid': 'menu-sheet' },
    h('div.m-head', h('span.lbl.ink', 'Menu'), h('span.sp'), h('span.ui-kbd', { 'aria-hidden': 'true' }, 'Esc'), closeBtn),
    ...MENU_GROUPS.flatMap((g) => [
      h('div.ui-sect.m-k', h('span.lbl', g.label), h('span.ui-rule')),
      h('div.m-grid', { 'data-group': g.id }, g.rows.map(row)),
    ]),
    h('div.m-foot', h('a.ui-hrow.foot', {
      href: `#/${MENU_FOOT.route}`, 'data-testid': MENU_FOOT.testid, 'aria-label': MENU_FOOT.label,
      onclick: (e) => { e.preventDefault(); close(); go(MENU_FOOT); },
    }, svg(MENU_FOOT.glyph), h('span.menu-lbl', MENU_FOOT.label))));
  const layer = h('div.home-menu-layer', { 'data-testid': 'menu-sheet-layer' },
    h('div.ui-scrim-full', { 'data-testid': 'menu-sheet-scrim', onclick: () => close() }), sheet);
  document.body.append(layer);
  document.body.classList.add('home-menu-open');
  const offEsc = onEscape(close);
  window.addEventListener('hashchange', close);
  requestAnimationFrame(() => closeBtn.focus({ preventScroll: true }));
  open = { close, el: sheet };
  return open;
}

/** Closes the menu sheet if it is open (the home's teardown). */
export function closeMenuSheet() {
  open?.close();
}
