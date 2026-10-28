// [ui-ink] The home's main menu: a night side sheet from the right edge (UI v2 "Ink & Paper", notes/ui-v2/
// UI_V2_DIRECTION.md 12.2; home layout B "Quiet Home", the Oct 27 layout study). It replaces the Menu Tab modal on the
// home, and it lists everything the quiet home does not show.
//
// Its head: MENU, then the home's own tools, HIDE UI (lobby-hide) and BACKGROUND (lobby-bg), as slanted buttons; Esc and
// the X. Then three groups of rows, a line glyph and a 16 px caps label each, an optional red dot, in two columns (her
// face stays clear on the left): SQUAD (Formation, Backpack with a dot when a box can be opened, Bestiary, Profile),
// ACADEMY (Story, Journal with its dot, Notice with a dot when unread, Wiki) and SOCIAL (Clan, with a dot when clan
// donations are ready), Settings beside it. No numbers, no yellow. It closes on its X, Esc and a tap outside it (and on
// any route change); it comes in from the right (from the bottom on a phone held upright), its rows 20 ms apart, and
// goes in 160 ms (motion.css; a 120 ms fade under Reduce motion).
// A modal dialog for the keys too: while it is open the rest of the page is inert (Tab never reaches the faded home
// behind it) and Tab wraps inside it; its rows are buttons (Enter and Space); closed by its X, Esc or a tap outside it,
// the focus goes back to the button that opened it (opener).
// Where the Menu Tab's other entries went (C12): Mail is the top bar's mail button, Chat and Messages the chat button
// (its drawer), Multiplayer the home's CO-OP tab, Lobby Background this head, Options and Account Settings, Equipment
// and Items the Backpack, Fullscreen Settings › Display. The Notice row keeps the old tray's hook (shortcut-notice);
// Clan keeps the old dock's (dock-clan).
import { h } from '../dom.js';
import { onEscape } from '../hold.js';
import { lineGlyph } from '../lineGlyphs.js';
import { stagger } from '../motion.js';

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
  Object.freeze({ id: 'social', label: 'Social', rows: Object.freeze([
    Object.freeze({ id: 'clan', label: 'Clan', glyph: 'flag', testid: 'dock-clan', route: 'clan' }),
  ]) }),
]);
/** The footer row. */
export const MENU_FOOT = Object.freeze({ id: 'settings', label: 'Settings', glyph: 'settings', testid: 'settings', route: 'settings' });

let open = null;

/** True while the menu sheet is open. */
export const menuSheetOpen = () => !!open;

/**
 * Opens the menu sheet (a second call while it is open does nothing).
 * @param {{ dots?: Record<string, boolean>, go: (row: object) => void, onClose?: Function, reduced?: boolean,
 *   tools?: { id: string, label: string, aria?: string, glyph: string, testid: string, go: Function }[],
 *   opener?: (() => HTMLElement|null)|null }} o
 *   dots: a red dot per row id (backpack, journal, notice, clan); go: a row was chosen (the sheet is closed first);
 *   tools: the home's own buttons in the head (hide the UI, the background picker), each closing the sheet first;
 *   opener: the button the focus goes back to when the sheet is dismissed (its X, Esc, a tap outside it)
 * @returns {{ close: () => void, el: HTMLElement }}
 */
export function openMenuSheet({ dots = {}, go, onClose = null, reduced = false, tools = [], opener = null }) {
  if (open) return open;
  let closed = false;
  // (the page behind the sheet: inert while it is open, so Tab and a screen reader stay in the dialog)
  const behind = [];
  const close = (how) => {
    if (closed) return;
    closed = true;
    offEsc();
    window.removeEventListener('hashchange', close);
    for (const n of behind) n.inert = false;
    layer.classList.add('closing');
    layer.inert = true;
    setTimeout(() => layer.remove(), reduced ? 0 : 160);
    open = null;
    document.body.classList.remove('home-menu-open');
    onClose?.();
    // dismissed (X, Esc, a tap outside): the focus goes back to the button that opened it
    if (how === 'dismiss') {
      const back = opener?.();
      if (back?.isConnected) back.focus({ preventScroll: true });
    }
  };
  const dismiss = () => close('dismiss');
  const row = (r) => {
    const dot = dots[r.id];
    return h('button.ui-hrow', {
      type: 'button', 'data-testid': r.testid,
      'aria-label': `${r.aria || r.label}${dot ? (r.id === 'notice' ? ', unread' : ', something new') : ''}`,
      onclick: () => {
        close();
        go(r);
      },
    }, svg(r.glyph), h('span.menu-lbl', r.label), dot ? h('i.ui-dot', { 'data-testid': `${r.testid}-dot` }) : null);
  };
  const tool = (t) => h('button.ui-btn.sec.m-tool', { type: 'button', 'data-testid': t.testid, 'aria-label': t.aria || t.label, title: t.aria || t.label,
    onclick: () => { close(); t.go(); } }, svg(t.glyph), h('span', t.label));
  const closeBtn = h('button.ui-ibtn', { type: 'button', 'aria-label': 'Close the menu', title: 'Close', 'data-testid': 'menu-sheet-close', onclick: () => dismiss() }, svg('x'));
  const group = (g) => h('section.m-group', { 'data-group': g.id },
    h('div.ui-sect.m-k', h('span.lbl', g.label), h('span.ui-rule')),
    h('div.m-grid', { 'data-group': g.id }, g.rows.map(row)));
  const sheet = h(`aside.ui-sheet.side.home-menu${reduced ? '.ui-fade' : '.home-menu-in'}`, { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Menu', 'data-testid': 'menu-sheet' },
    h('div.m-head', h('span.lbl.ink', 'Menu'), h('span.ui-spacer'), h('div.m-tools', tools.map(tool)), h('span.ui-kbd', { 'aria-hidden': 'true' }, 'Esc'), closeBtn),
    h('div.m-cols',
      ...MENU_GROUPS.map(group),
      h('div.m-foot', h('button.ui-hrow.foot', {
        type: 'button', 'data-testid': MENU_FOOT.testid, 'aria-label': MENU_FOOT.label,
        onclick: () => { close(); go(MENU_FOOT); },
      }, svg(MENU_FOOT.glyph), h('span.menu-lbl', MENU_FOOT.label)))));
  const layer = h('div.home-menu-layer', { 'data-testid': 'menu-sheet-layer' },
    h('div.ui-scrim-full', { 'data-testid': 'menu-sheet-scrim', onclick: () => dismiss() }), sheet);
  // Tab wraps inside the sheet (its first and last controls)
  sheet.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey) return;
    const all = [...sheet.querySelectorAll('button:not([disabled]), a[href]')].filter((x) => x.getClientRects().length);
    if (!all.length) return;
    const at = all.indexOf(document.activeElement);
    if (e.shiftKey ? at <= 0 : at === all.length - 1) {
      e.preventDefault();
      all[e.shiftKey ? all.length - 1 : 0].focus({ preventScroll: true });
    }
  });
  for (const n of document.body.children) {
    if (!n.inert && n.tagName !== 'SCRIPT') {
      n.inert = true;
      behind.push(n);
    }
  }
  document.body.append(layer);
  // its rows come in after it, 20 ms apart (motion.css: the sheet 240 ms from its edge with its scrim; out 160 ms)
  if (!reduced) stagger(sheet.querySelectorAll('.m-tools > .m-tool, .m-grid > .ui-hrow, .m-foot > .ui-hrow'), 'right', { base: 60, step: 20, dur: 200 });
  document.body.classList.add('home-menu-open');
  const offEsc = onEscape(dismiss);
  window.addEventListener('hashchange', close);
  requestAnimationFrame(() => { if (!closed) closeBtn.focus({ preventScroll: true }); });
  open = { close, el: sheet };
  return open;
}

/** Closes the menu sheet if it is open (the home's teardown). */
export function closeMenuSheet() {
  open?.close();
}
