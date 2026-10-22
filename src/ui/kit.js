// The condensed UI's shared components as DOM builders (docs/specs/UI_DIRECTION.md §5). They only put the M0
// classes of src/ui/styles/components.css together (stat chip, ink strip + MORE, stickers, rarity tag, tab rail,
// icon button, gear tile), so every screen that adopts them looks the same. No styles of their own.
// UI M5 (§5.9, §5.10) adds the hub kit at the end: the countdown chip, the left section rail, the plate header,
// keyboard hints, the off-season band and the locked "Coming soon" tile (badges: ./badges.js; the host girl: ./host.js).
import { h } from './dom.js';
import { glyphSVG } from '../art/icons/glyphs.js';
import { countdownState, ticker } from './countdown.js';
import { soonSticker } from './badges.js';

/** A line glyph (src/art/icons/glyphs.js) or raw svg markup as an inline icon. */
export function ico(nameOrSvg, cls = 'ui-ico') {
  const span = h(`span.${cls}`, { 'aria-hidden': 'true' });
  span.innerHTML = nameOrSvg.startsWith('<') ? nameOrSvg : glyphSVG(nameOrSvg);
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

/** The MORE sticker: opens Details, looks the same everywhere (§5.2). */
export function moreSticker(onClick, { testid = null, label = 'More details' } = {}) {
  return h('button.ui-sticker.y.ui-more', { type: 'button', 'data-testid': testid, 'aria-label': label, onclick: onClick }, 'More ▸');
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
  for (const t of tabs) {
    const b = h(`button.ui-tab${t.locked ? '.locked' : ''}`, {
      type: 'button', role: 'tab', 'data-testid': `${testidPrefix}${t.id}`, 'data-tab': t.id,
      'aria-label': `${t.label}${t.locked ? ' (locked)' : ''}${t.dot ? ` (${t.dotTitle || 'new'})` : ''}`,
      onclick: () => onPick(t.id),
    }, h('span', t.locked ? ico('lock') : t.icon ? ico(t.icon) : null, t.label), t.dot ? h(`i.ui-dot${t.dotCls ? `.${t.dotCls}` : ''}`, { 'aria-hidden': 'true', title: t.dotTitle || null }) : null);
    btns.set(t.id, b);
    el.append(b);
  }
  el.setActive = (id) => {
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
  const el = h(`span.ui-cd${cls ? `.${cls}` : ''}`, { 'data-testid': testid, 'data-urgent': urgent ? null : 'off' },
    ico(KIT_SVG.clock), label ? [h('span.lbl.ui-cd-lbl', label), ' '] : null, time);
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
  for (const t of tabs) {
    const b = h('button.ui-stab', {
      type: 'button', role: 'tab', 'data-testid': `${testidPrefix}${t.id}`, 'data-tab': t.id,
      'aria-label': `${t.label}${t.dot ? ` (${t.dotTitle || 'something new'})` : ''}`,
      onclick: () => onPick(t.id),
    }, h('span.ui-stab-in', t.icon ? ico(t.icon) : null, h('span.ui-stab-word', t.label)), t.dot ? h('i.ui-bdg.dot', { 'aria-hidden': 'true' }) : null);
    btns.set(t.id, b);
    el.append(b);
  }
  el.setActive = (id) => {
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
 * A mode that is not out yet, as a hub tile (§5.4: a designed locked state, never a faded one; owner #108: the
 * Multiplayer hub's PvP "Coming soon" with Rival Run inside, Titan Co-op "Soon"). Glass (or the mode's art under a
 * glass veil), the ink "Coming soon" sticker at the top-left, a lock in an ink circle at the top-right, the title and
 * one line on what is inside. A tap explains (the screen opens its sheet); it never starts anything.
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
  h('span.ui-ltile-lock', { 'aria-hidden': 'true' }, ico('lock')),
  h('b.ui-ltile-title', title),
  line ? h('span.ui-ltile-line', line) : null);
}
