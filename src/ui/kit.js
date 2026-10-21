// The condensed UI's shared components as DOM builders (docs/specs/UI_DIRECTION.md §5). They only put the M0
// classes of src/ui/styles/components.css together (stat chip, ink strip + MORE, stickers, rarity tag, tab rail,
// icon button, gear tile), so every screen that adopts them looks the same. No styles of their own.
import { h } from './dom.js';
import { glyphSVG } from '../art/icons/glyphs.js';

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
