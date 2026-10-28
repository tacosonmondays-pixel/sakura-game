// The condensed UI's shared components as DOM builders (docs/specs/UI_DIRECTION.md §5). They only put the M0
// classes of src/ui/styles/components.css together (stat chip, ink strip + MORE, stickers, rarity tag, tab rail,
// icon button, gear tile), so every screen that adopts them looks the same. No styles of their own.
// UI M5 (§5.9, §5.10) adds the hub kit at the end: the countdown chip, the left section rail, the plate header,
// keyboard hints, the off-season band and the locked "Coming soon" tile (badges: ./badges.js; the host girl: ./host.js);
// the M5b review adds the secondary button and the count inside a button.
import { h } from './dom.js';
import { glyphSVG } from '../art/icons/glyphs.js';
import { countdownState, ticker } from './countdown.js';
import { soonSticker } from './badges.js';
import { inkSurface } from './surfaceMode.js';
import { lineGlyph, lineFor } from './lineGlyphs.js';
import { currencyIcon } from '../art/icons.js';
import { COLOUR_CURRENCIES } from './wallets.js';
import { noteTabPick, badge } from './motion.js';

/**
 * A line glyph (src/art/icons/glyphs.js) or raw svg markup as an inline icon. [ui-ink] On the menus and the home (a
 * surface mode on <body>) a name with a UI v2 line glyph (src/ui/lineGlyphs.js) draws that one first; game-data icons
 * and the battle keep their drawings.
 */
export function ico(nameOrSvg, cls = 'ui-ico') {
  const span = h(`span.${cls}`, { 'aria-hidden': 'true' });
  const line = !nameOrSvg.startsWith('<') && inkSurface() ? lineFor(nameOrSvg) : null;
  span.innerHTML = line ? lineGlyph(line, '', { kitSize: false }) : nameOrSvg.startsWith('<') ? nameOrSvg : glyphSVG(nameOrSvg);
  return span;
}

/**
 * [ui-ink] The colour coin or gem for a balance or a price (owner, Oct 27: "for the coins and premium currency bring
 * back the color icons"): the baked item art (src/art/icons.js currencyIcon, its 96 px small cut), sized by the kit
 * (.ui-cur-art: 20 px on a phone, 22 px on desktop; components.css, ink.css). Every other glyph stays a line glyph.
 * @param {'coins'|'gems'} kind
 * @param {string} [cls] extra classes ('a.b')
 */
export function curArt(kind, cls = '') {
  const k = COLOUR_CURRENCIES.includes(kind) ? kind : 'coins';
  const span = h(`span.ui-cur-art${cls ? `.${cls}` : ''}`, { 'aria-hidden': 'true', 'data-cur': k });
  span.innerHTML = currencyIcon(k, { px: 22 });
  return span;
}

/** Glyphs the game's icon set has no shape for (24 × 24, currentColor). */
export const KIT_SVG = {
  chevL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  chevR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  cube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.8l8 4.4v9.6l-8 4.4-8-4.4V7.2z"/><path d="M4 7.2l8 4.4 8-4.4M12 11.6v9.6"/></svg>',
  card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><rect x="5" y="2.8" width="14" height="18.4" rx="2.4"/><circle cx="12" cy="9.6" r="2.8"/><path d="M7.6 18c.8-2.6 2.4-3.9 4.4-3.9s3.6 1.3 4.4 3.9"/></svg>',
  starFill: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 16.8 6.2 20.1l1.4-6.4L2.7 9.3l6.5-.7z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  blossom: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor">'
    + [0, 72, 144, 216, 288].map((a) => `<ellipse cx="12" cy="6.6" rx="3.6" ry="5.2" transform="rotate(${a} 12 12)"/>`).join('')
    + '</g><circle cx="12" cy="12" r="2.4" fill="#ffd23f"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.6"/><path d="M12 7.4V12l3.2 2"/></svg>',
};

/** Replaces an element's children, skipping null / false (a plain replaceChildren() would print "null"). */
export function fillIn(el, ...kids) {
  el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false && k !== true));
  return el;
}

/** A tabular number (`.num`); `size` 's' (chip / button) or 'l' (headline). */
export const num = (text, size = '') => h(`span.num${size ? `.${size}` : ''}`, String(text));
/** A caps label (`.lbl`). */
export const lbl = (text) => h('span.lbl', text);

/**
 * Stat chip (§5.1): icon · number · optional caps label; one fact. `title` is the full fact ("Attack +22%").
 * @param {{ icon?: string|null, value?: string|null, label?: string|null, text?: string|null, cls?: string, title?: string }} o
 *   text: a tag (icon + one word, no number)
 */
export function chip({ icon = null, value = null, label = null, text = null, cls = '', title = null } = {}) {
  return h(`span.ui-chip${text != null ? '.tag' : ''}${cls ? `.${cls}` : ''}`, { title: title || null, 'aria-label': title || null },
    icon ? ico(icon) : null,
    value != null ? num(value) : null,
    label ? lbl(label) : null,
    text != null ? h('span', text) : null);
}

/** "+N": the rest of a chip row (more than 3), always a button. */
export function moreChip(n, { onClick, title = null, testid = null } = {}) {
  return h('button.ui-chip.more-n', { type: 'button', title, 'aria-label': title || `${n} more`, 'data-testid': testid, onclick: onClick }, num(`+${n}`));
}

/** A tilted sticker (MORE, NEW, grades): `kind` '' (white), 'y', 'p' or 'ink'. */
export const sticker = (text, kind = '', props = {}) => h(`span.ui-sticker${kind ? `.${kind}` : ''}`, props, text);

/**
 * The MORE sticker: opens Details, looks the same everywhere (§5.2). [ui-ink] On the menus it is the cyan ghost
 * control "Details ›" (UI v2 Q5: one yellow per screen), same place, same job, same test ids.
 */
export function moreSticker(onClick, { testid = null, label = 'More details' } = {}) {
  return h('button.ui-sticker.y.ui-more', { type: 'button', 'data-testid': testid, 'aria-label': label, onclick: onClick }, inkSurface() ? 'Details ›' : 'More ▸');
}

/**
 * The ink strip (§5.2): exactly 3 headline stats + MORE. Only the first number takes the plate accent.
 * @param {{ label: string, value: string, unit?: string|null, title?: string|null, delta?: string|null }[]} cells
 *   delta: an upgrade preview under the number ("▲ +3%"; a "▼ …" one takes the down colour)
 * @param {{ onMore?: Function|null, testid?: string|null, moreTestid?: string|null }} [o]
 */
export function statStrip(cells, { onMore = null, testid = null, moreTestid = null } = {}) {
  return h('div.ui-strip', { 'data-testid': testid, role: 'group', 'aria-label': cells.map((c) => c.title || `${c.label} ${c.value}${c.unit || ''}`).join(', ') },
    cells.slice(0, 3).map((c, i) => h('div.ui-cell', { title: c.title || null },
      lbl(c.label),
      h(`span.num${i === 0 ? '.acc' : ''}`, c.value, c.unit ? h('small', c.unit) : null),
      c.delta ? h(`span.ui-delta${String(c.delta).startsWith('▼') ? '.dn' : ''}`, c.delta) : null)),
    onMore ? h('div.ui-strip-more', moreSticker(onMore, { testid: moreTestid })) : null);
}

/** Display rarity → the rarity-tag class (§5.6): R, SR, SSR, UR, LR. */
export const RARITY_CLASS = Object.freeze({ R: 'r', SR: 'sr', SSR: 'ssr', UR: 'ur', LR: 'lr' });

/**
 * Rarity tag (§5.6): an ink pill with rarity-coloured letters, three letters wide. UR and LR letters are gradients
 * (an inner span); `ring` adds UR's rainbow edge (a urRing() element from rarity.js).
 */
export function rarityTag(rarity, { testid = null, ring = null, title = null } = {}) {
  const cls = RARITY_CLASS[rarity] || 'r';
  const gradient = rarity === 'UR' || rarity === 'LR';
  return h(`span.ui-rtag.${cls}${rarity === 'UR' ? '.is-ur' : ''}`, { 'data-testid': testid, title },
    gradient ? h(`span${rarity === 'UR' ? '.ur-text' : ''}`, rarity) : rarity, ring);
}

/**
 * Page tabs (§5.3): a slanted rail, icon + one word. `tabs`: [{ id, label, icon, locked?, dot? }]. Tab ids and
 * their `data-testid` (`tab-<id>` unless `testidPrefix` says otherwise) never change when labels get shorter.
 * @returns {HTMLElement & { setActive(id: string): void }}
 */
export function rail(tabs, active, onPick, { testidPrefix = 'tab-', label = 'Sections', cls = '' } = {}) {
  const el = h(`nav.ui-rail${cls ? `.${cls}` : ''}`, { role: 'tablist', 'aria-label': label });
  const btns = new Map();
  const order = tabs.map((t) => t.id);
  let on = active;
  for (const t of tabs) {
    const b = h(`button.ui-tab${t.locked ? '.locked' : ''}`, {
      type: 'button', role: 'tab', 'data-testid': `${testidPrefix}${t.id}`, 'data-tab': t.id,
      'aria-label': `${t.label}${t.locked ? ' (locked)' : ''}${t.dot ? ` (${t.dotTitle || 'new'})` : ''}`,
      onclick: () => { noteTabPick(order.indexOf(on), order.indexOf(t.id)); onPick(t.id); }, // (motion.js tabSwap's direction)
    }, h('span', t.locked ? ico('lock') : t.icon ? ico(t.icon) : null, t.label),
    badge(t.dot ? h(`i.ui-dot${t.dotCls ? `.${t.dotCls}` : ''}`, { 'aria-hidden': 'true', title: t.dotTitle || null }) : null, `tab:${testidPrefix}${t.id}`));
    btns.set(t.id, b);
    el.append(b);
  }
  el.setActive = (id) => {
    on = id;
    for (const [k, b] of btns) {
      b.classList.toggle('on', k === id);
      b.setAttribute('aria-selected', k === id ? 'true' : 'false');
    }
  };
  el.setActive(active);
  return el;
}

/**
 * [ui-ink] Folder tabs (S4, ink.css "folder tabs on a panel"): the ink strip on top of a `.ui-tabbed` panel, the open
 * tab a hole of the panel's own white with the sakura mark; its 44 px hit area hangs into the body's padding. The same
 * `tabs` shape, test ids and setActive() as rail(), so a screen swaps one for the other (the girl page, V3).
 * @returns {HTMLElement & { setActive(id: string): void }}
 */
export function folderTabs(tabs, active, onPick, { testidPrefix = 'tab-', label = 'Sections', cls = '' } = {}) {
  const el = h(`nav.ui-tabs${cls ? `.${cls}` : ''}`, { role: 'tablist', 'aria-label': label });
  const btns = new Map();
  const order = tabs.map((t) => t.id);
  let on = active;
  for (const t of tabs) {
    const b = h(`button.ui-tab${t.locked ? '.locked' : ''}`, {
      type: 'button', role: 'tab', 'data-testid': `${testidPrefix}${t.id}`, 'data-tab': t.id,
      'aria-label': `${t.label}${t.locked ? ' (locked)' : ''}${t.dot ? ` (${t.dotTitle || 'new'})` : ''}`,
      onclick: () => { noteTabPick(order.indexOf(on), order.indexOf(t.id)); onPick(t.id); },
    },
    h('span.mark', { 'aria-hidden': 'true' }),
    t.locked ? ico('lock') : t.icon ? ico(t.icon) : null, h('span.ui-tab-word', t.label),
    badge(t.dot ? h(`i.ui-dot${t.dotCls ? `.${t.dotCls}` : ''}`, { 'aria-hidden': 'true', title: t.dotTitle || null }) : null, `tab:${testidPrefix}${t.id}`),
    h('span.hit', { 'aria-hidden': 'true' }));
    btns.set(t.id, b);
    el.append(b);
  }
  el.setActive = (id) => {
    on = id;
    for (const [k, b] of btns) {
      b.classList.toggle('on', k === id);
      b.setAttribute('aria-selected', k === id ? 'true' : 'false');
    }
  };
  el.setActive(active);
  return el;
}

/** Icon button (§5.5): 44 × 44, icon only, an accessible name. `glass` for one sitting on art. */
export function iconBtn(icon, { label, onClick = null, testid = null, cls = '', title = null } = {}) {
  return h(`button.ui-ibtn${cls ? `.${cls}` : ''}`, { type: 'button', 'aria-label': label, title: title || label, 'data-testid': testid, onclick: onClick }, ico(icon));
}

/** Ghost button (§5.5): text only, the text-safe blue. */
export function ghostBtn(text, { onClick = null, testid = null, icon = null, title = null } = {}) {
  return h('button.ui-ghost', { type: 'button', 'data-testid': testid, title, onclick: onClick }, text, icon ? ico(icon) : null);
}

/** Star glyph row (no digits): `n` of `max` lit. */
export function starRow(n, max = 5, { cls = 'ui-stars' } = {}) {
  return h(`span.${cls}`, { role: 'img', 'aria-label': `${n} of ${max} stars` },
    Array.from({ length: max }, (_, i) => ico(KIT_SVG.starFill, `ui-star${i < n ? '.on' : ''}`)));
}

// ---------------------------------------------------------------------------------------------------------------
// UI M5: the hub kit (§5.9, §5.10)
// ---------------------------------------------------------------------------------------------------------------

/**
 * The countdown chip (§5.9, E4): an ink pill with a clock, an optional caps label and the time left from
 * fmtNum(…, 'time') ("6d 4h", "11h", "12:05"). Under 24 h the time turns --bad-on-plate (`.urgent`), for a deadline
 * where something is lost at zero (an event's end, the exchange closing, mail expiry, limited stock). A recurring
 * cycle (a daily or weekly reset, a restock, the next login gift) or an opening passes `urgent: false` and stays
 * white: a daily reset is always under 24 h, and red on half the timers all day teaches players to ignore it (the
 * M5a review; flagged to the owner as a §5.9 amendment). The one shared ticker (./countdown.js) keeps it current and
 * lets it go once its screen is gone. The only way to write "time left" on a Glance surface.
 *
 * At zero the label goes and `doneText` stands alone ("Reset!", "Ended", "Expired"), never "Resets in Now"; `onDone`
 * lets the screen redraw (the new day's list, the next phase). A chip built already at zero never calls onDone, so a
 * redraw that lands on a stale clock cannot loop.
 * @param {number} msLeft
 * @param {{ label?: string|null, testid?: string|null, now?: () => number, doneText?: string|null, cls?: string,
 *   urgent?: boolean, onDone?: Function|null }} [o] now: the clock it counts on (an event's preview clock);
 *   urgent: false for a recurring reset or an opening (never red); doneText: what it says at zero (default "Reset!"
 *   for a recurring chip, else "Ended"); onDone: called once when it reaches zero on screen
 * @returns {HTMLElement}
 */
export function countdownChip(msLeft, { label = null, testid = null, now = () => Date.now(), doneText = null, cls = '', urgent = true, onDone = null } = {}) {
  const endsAt = now() + (Number(msLeft) || 0);
  const done = doneText || (urgent ? 'Ended' : 'Reset!');
  const time = h('span.num.ui-cd-time');
  // [ui-ink] one countdown chip everywhere (low 12): the line clock on the menus
  const el = h(`span.ui-cd${cls ? `.${cls}` : ''}`, { 'data-testid': testid, 'data-urgent': urgent ? null : 'off' },
    ico(inkSurface() ? 'clock' : KIT_SVG.clock), label ? [h('span.lbl.ui-cd-lbl', label), ' '] : null, time);
  let seen = false;
  let misses = 0;
  let fired = !(Number(msLeft) > 0); // (born at zero: nothing to announce)
  ticker.add({
    endsAt,
    now,
    alive: () => {
      if (el.isConnected) return (seen = true);
      return !seen && ++misses < 3; // not on the page yet (built before it is attached)
    },
    update: (s) => {
      const text = s.done ? done : s.text;
      if (time.textContent !== text) time.textContent = text;
      el.classList.toggle('urgent', urgent && s.urgent);
      el.classList.toggle('done', s.done);
      el.setAttribute('aria-label', s.done || !label ? text : `${label} ${text}`);
      if (s.done && !fired) {
        fired = true;
        // (only from the page: a chip its screen already replaced stays quiet)
        if (onDone && el.isConnected) onDone();
      }
    },
  });
  return el;
}

/** The chip's text and urgency for a time left, without a chip (tests, aria text). */
export const countdownText = (msLeft) => countdownState(msLeft);

/**
 * The left section rail (E3) for list screens with 2-5 sections: vertical, active = an ink slab with yellow italic
 * text at −8°, inactive = white glass with ink text, ≥ 44 px, red dots only. The vertical sibling of rail(): the
 * same `tabs` shape and the same `tab-<id>` test ids.
 * @returns {HTMLElement & { setActive(id: string): void }}
 */
export function sideRail(tabs, active, onPick, { testidPrefix = 'tab-', label = 'Sections', cls = '' } = {}) {
  const el = h(`nav.ui-srail${cls ? `.${cls}` : ''}`, { role: 'tablist', 'aria-label': label, 'aria-orientation': 'vertical' });
  const btns = new Map();
  const order = tabs.map((t) => t.id);
  let on = active;
  for (const t of tabs) {
    const b = h('button.ui-stab', {
      type: 'button', role: 'tab', 'data-testid': `${testidPrefix}${t.id}`, 'data-tab': t.id,
      'aria-label': `${t.label}${t.dot ? ` (${t.dotTitle || 'something new'})` : ''}`,
      onclick: () => { noteTabPick(order.indexOf(on), order.indexOf(t.id)); onPick(t.id); }, // (down the rail: the content comes up)
    }, h('span.ui-stab-in', t.icon ? ico(t.icon) : null, h('span.ui-stab-word', t.label)), badge(t.dot ? h('i.ui-bdg.dot', { 'aria-hidden': 'true' }) : null, `stab:${testidPrefix}${t.id}`));
    btns.set(t.id, b);
    el.append(b);
  }
  el.setActive = (id) => {
    on = id;
    for (const [k, b] of btns) {
      b.classList.toggle('on', k === id);
      b.setAttribute('aria-selected', k === id ? 'true' : 'false');
    }
  };
  el.setActive(active);
  return el;
}

/** The plate header band (E2): a list panel's slanted ink title bar, white display italics, an optional right side. */
export function plateHead(title, { right = null, testid = null } = {}) {
  return h('div.ui-plate-head', { 'data-testid': testid }, h('h3.ui-plate-title', h('span', title)), right ? h('div.ui-plate-right', right) : null);
}

/** A keyboard hint (E8): a small ink chip ("Space" under the primary, "Esc" by a close). Hidden on touch screens. */
export function kbdHint(key = 'Space') {
  return h('kbd.ui-kbd', { 'aria-hidden': 'true' }, key);
}

/**
 * The off-season / idle band (E9): full-bleed location art behind one ink band with one sentence and the next date.
 * @param {{ text: string, date?: string|null, art?: HTMLElement|null, testid?: string|null }} o
 *   art: the location (hubArt.js hubBackdrop(location)); date: "Back Dec 18"
 */
export function offSeasonBand({ text, date = null, art = null, testid = null }) {
  return h('div.ui-offseason', { 'data-testid': testid },
    art,
    h('div.ui-offseason-band', h('p.ui-offseason-text', text), date ? h('span.ui-offseason-date', date) : null));
}

/**
 * The ink row button (§5.5 cost shape, UI M5b): an ink plate with a yellow italic verb ("Claim") for the action of
 * one row in a list, so the screen keeps its one yellow primary (P2). 44 px tall (40 in a dense row on phones).
 * @param {string} label a verb of at most two words
 * @param {{ onClick?: Function|null, testid?: string|null, title?: string|null, cls?: string }} [o]
 */
export function inkBtn(label, { onClick = null, testid = null, title = null, cls = '' } = {}) {
  return h(`button.ui-cost.dense.ui-ink${cls ? `.${cls}` : ''}`, { type: 'button', 'data-testid': testid, title, onclick: onClick },
    h('span.ui-cost-lbl', label));
}

/**
 * A secondary button (§5.5; the UI M5b review): white glass, a 2 px --line edge, an ink label, slanted like every
 * button. For the actions beside a screen's one yellow (Sweep, Filter, Open all), so two loud fills never read as two
 * primaries. Disabled: a --sky-1 fill, --muted words and a lock, never opacity (§5.5); `reason` puts the one line that
 * says why beside it (and in the title).
 * @param {string} label a verb of at most two words, plus what it does ("Sweep ×10 · Hard")
 * @param {{ icon?: string|null, onClick?: Function|null, testid?: string|null, title?: string|null, disabled?: boolean,
 *   reason?: string|null, cls?: string }} [o]
 * @returns {HTMLElement} the button; with `disabled` and `reason`, a span holding the button and its reason line
 */
export function secondaryBtn(label, { icon = null, onClick = null, testid = null, title = null, disabled = false, reason = null, cls = '' } = {}) {
  const b = h(`button.btn.ui-sec${cls ? `.${cls}` : ''}`, {
    type: 'button', 'data-testid': testid, title: title || (disabled ? reason : null), disabled, onclick: onClick,
    'aria-label': disabled && reason ? `${label}: ${reason}` : null,
  }, disabled ? ico('lock', 'ui-ico.ui-sec-ico') : icon ? ico(icon, 'ui-ico.ui-sec-ico') : null, h('span.btn-label', label));
  if (!disabled || !reason) return b;
  return h('span.ui-sec-wrap', b, h('span.ui-sec-why', { 'aria-hidden': 'true' }, reason));
}

/** The count inside a button ("Claim all ⓫"): one ink pill, the same on every screen (the UI M5b review). */
export function btnCount(n, { cls = '' } = {}) {
  return h(`span.num.ui-btn-n${cls ? `.${cls}` : ''}`, String(n));
}

/**
 * [ui-v2 M5] A hub tile (V4: the kit's .ui-hubtile, ink.css): painted art above a solid ink caption band; the tile IS
 * the action (P2: no button on it). The caption holds an optional caps kicker, the title (display italics) and one
 * line; the top-right corner holds a countdown chip (countdownChip, never red for a weekly cycle) or a badge; a sticker
 * ("Open!", "Coming soon", In Progress) sits at the top of the caption. A locked tile keeps its art (greyed by the kit)
 * and says what opens it in the caption, after a lock glyph; a tap on it explains (the screen's onClick), it never
 * starts anything. Words wrap, never end in "…" (P6).
 * @param {{ title: string, kicker?: string|null, line?: string|null, art?: string|HTMLElement|null, corner?: any,
 *   sticker?: HTMLElement|null, lock?: string|null, dot?: boolean, sm?: boolean, onClick?: Function|null,
 *   testid?: string|null, cls?: string, label?: string|null }} o
 *   art: an image URL (the painted location) or an element (a drawn scene, wrapped in .ui-hubtile-art);
 *   corner: the top-right children (a countdown chip, a badge); lock: the unlock rule ("Clear 5-5 first");
 *   dot: a red claim dot at the top-right; sm: the small tile (a two-line caption); label: the accessible name when
 *   the words alone do not say it
 * @returns {HTMLButtonElement}
 */
export function hubTile({ title, kicker = null, line = null, art = null, corner = null, sticker = null, lock = null, dot = false, sm = false, onClick = null, testid = null, cls = '', label = null }) {
  const locked = !!lock;
  const artEl = typeof art === 'string'
    ? h('img', { src: art, alt: '', loading: 'lazy', decoding: 'async', draggable: false })
    : art ? h('span.ui-hubtile-art', { 'aria-hidden': 'true' }, art) : null;
  const tr = [corner, dot ? h('i.ui-dot', { 'aria-hidden': 'true' }) : null].flat(Infinity).filter(Boolean);
  return h(`button.ui-hubtile${sm ? '.sm' : ''}${locked ? '.locked' : ''}${cls ? `.${cls}` : ''}`, {
    type: 'button', 'data-testid': testid, 'data-locked': locked ? 'lock' : null, 'aria-label': label, title: lock, onclick: onClick,
  },
  artEl,
  tr.length ? h('span.tr', tr) : null,
  h('span.cap',
    sticker,
    kicker ? h('span.lbl', kicker) : null,
    h('span.name', title),
    line ? h('span.ui-hubtile-line', line) : null,
    locked ? h('span.ui-hubtile-lock', ico('lock'), h('span', lock)) : null));
}

/**
 * A mode that is not out yet, as a hub tile (§5.4: a designed locked state, never a faded one; owner #108: the
 * Multiplayer hub's PvP "Coming soon" with Rival Run inside, Titan Co-op "Soon"). Glass (or the mode's art under a
 * glass veil), the ink "Coming soon" sticker at the top-left, the title and one line on what is inside. One lock: the
 * sticker's (a second one in an ink circle at the top-right said it twice, and on a narrow tile a long sticker ran over
 * it: UI M5d review 2). A tap explains (the screen opens its sheet); it never starts anything.
 * @param {{ title: string, line?: string|null, soon?: string, art?: HTMLElement|null, onClick?: Function|null,
 *   testid?: string|null, cls?: string }} o line: "Rival Run inside" (or what opens it); soon: the sticker's words
 * @returns {HTMLElement}
 */
export function lockedTile({ title, line = null, soon = 'Coming soon', art = null, onClick = null, testid = null, cls = '' }) {
  return h(`button.ui-ltile${cls ? `.${cls}` : ''}`, {
    type: 'button', 'data-testid': testid, 'data-locked': 'soon', 'aria-label': `${title}, ${soon}${line ? `. ${line}` : ''}`, onclick: onClick,
  },
  art ? h('span.ui-ltile-art', { 'aria-hidden': 'true' }, art) : null,
  soonSticker({ text: soon, testid: testid ? `${testid}-soon` : null }),
  h('b.ui-ltile-title', title),
  line ? h('span.ui-ltile-line', line) : null);
}
