// Self / Allies / Enemies / Coins chips (owner request #152): every chip carries its word and its
// own colour + glyph, so colour is never the only signal. Used by the battle upgrade panel, the
// student Tree tab, the Unit Sheet, the in-battle Upgrade Tree and the wiki legend.
import './styles/unit-info.css';
import { h } from './dom.js';
import { svgEl } from './components.js';
import { uiIcon, capabilityIcon, statusIcon, attackTypeIcon, elementIcon } from '../art/icons.js';
import { UPGRADE_TAGS, TRANSFORM_TAG, TAG_ORDER, tagText, pathSummary, tilesText } from './upgradeTags.js';

const svg = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;

/** 24×24 line glyphs (currentColor). */
export const TAG_GLYPHS = {
  self: svg('<circle cx="9" cy="8" r="3.6"/><path d="M2.8 20.5c.6-3.8 3-5.8 6.2-5.8s5.6 2 6.2 5.8"/><path d="M19 15V4.5M15.8 7.6 19 4.4l3.2 3.2"/>'),
  allies: svg('<circle cx="7.5" cy="8.5" r="3"/><circle cx="16.5" cy="8.5" r="3"/><path d="M2 19.5c.4-3 2.5-4.8 5.5-4.8M22 19.5c-.4-3-2.5-4.8-5.5-4.8"/><path d="M12 13.5v7M8.5 17h7"/>'),
  enemies: svg('<path d="M8 2.8l4 4 4-4"/><path d="M4.2 21c0-5.2 3.4-9.2 7.8-9.2s7.8 4 7.8 9.2z"/><circle cx="9.3" cy="16.6" r="0.6" fill="currentColor"/><circle cx="14.7" cy="16.6" r="0.6" fill="currentColor"/>'),
  coins: svg('<circle cx="12" cy="12" r="8.6"/><path d="M14.8 9.2c-.5-1-1.5-1.5-2.8-1.5-1.6 0-2.7.8-2.7 2s1.1 1.7 2.7 2.1 2.9.9 2.9 2.2-1.2 2.1-2.9 2.1c-1.4 0-2.5-.6-3-1.6M12 6v1.7M12 16.1v1.9"/>'),
  transform: svg('<path d="M12 2.8l2 5.8 5.8 2-5.8 2-2 5.8-2-5.8-5.8-2 5.8-2z"/><path d="M19 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>'),
};

/** Upgrade-tree glyph: three rows of tier dots (Tree button in the battle panel). */
export const TREE_GLYPH = `<svg viewBox="0 0 24 24" aria-hidden="true">${[[5, 4], [12, 2], [19, 0]].map(([y, owned]) => [3, 7.5, 12, 16.5, 21]
  .map((x, i) => (i < owned
    ? `<circle cx="${x}" cy="${y}" r="2.1" fill="currentColor"/>`
    : `<circle cx="${x}" cy="${y}" r="1.5" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.7"/>`)).join('')).join('')}</svg>`;

const ICON_SETS = { ui: uiIcon, cap: capabilityIcon, status: statusIcon, attack: attackTypeIcon, element: elementIcon };

/** The tier's round-icon badge as an element. */
export function tierIconEl(icon, cls = 'ut-ico') {
  const fn = ICON_SETS[icon?.set] || uiIcon;
  return svgEl(fn(icon?.key), cls);
}

/**
 * One chip: glyph + word ("Allies · 2.6 tiles").
 * @param {object} tag a Tag from upgradeTags.js, or { id: 'transform' }
 * @param {{ size?: 'xs'|'sm'|'md', long?: boolean, letter?: boolean, text?: string }} [o]
 *   long: the explanation sentence beside the chip; letter: glyph + first letter only; tight: the
 *   shortest words (tree cells: "Allies · 2.6", "Enemies")
 */
export function tagChip(tag, { size = 'sm', long = false, letter = false, tight = false, text = null } = {}) {
  const transform = tag.id === 'transform';
  const info = transform ? TRANSFORM_TAG : UPGRADE_TAGS[tag.id] || UPGRADE_TAGS.self;
  const word = text || (transform ? info.label : tagText(tag, { compact: size === 'xs', tight }));
  const longText = transform ? info.long : tagText(tag, { long: true });
  const chip = h(`span.tag-chip.tag-${size}${letter ? '.tag-letter' : ''}`, {
    'data-tag': transform ? 'transform' : tag.id,
    'data-letter': info.letter,
    title: `${transform ? info.label : tagText(tag)}: ${longText}`,
    'aria-label': `${transform ? info.label : tagText(tag)}`,
  }, svgEl(TAG_GLYPHS[transform ? 'transform' : tag.id] || TAG_GLYPHS.self, 'tag-glyph'), h('span.tag-word', letter ? info.letter : word));
  if (!long) return chip;
  return h('div.tag-line', chip, h('span.tag-long', longText));
}

/** Tag list → chips, with a separate violet "New attack" chip after a transforming Self tag. */
export function expandTags(tags = []) {
  const out = [];
  for (const t of tags) {
    out.push(t);
    if (t.transform) out.push({ id: 'transform' });
  }
  return out;
}

/**
 * Row of chips (span.tag-chips).
 * @param {object[]} tags
 * @param {{ size?: 'xs'|'sm'|'md', max?: number, letter?: boolean, tight?: boolean }} [o] max: chips shown before "+N"
 */
export function tagChips(tags = [], { size = 'sm', max = Infinity, letter = false, tight = false } = {}) {
  const all = expandTags(tags);
  const shown = all.slice(0, max);
  const rest = all.length - shown.length;
  return h('span.tag-chips', shown.map((t) => tagChip(t, { size, letter, tight })), rest > 0 ? h(`span.tag-chip.tag-${size}.tag-more`, { title: all.slice(max).map((t) => (t.id === 'transform' ? TRANSFORM_TAG.label : tagText(t))).join(', ') }, `+${rest}`) : null);
}

/** Path tally chips: "Allies ×5 · 4 tiles", "Enemies ×3" (title says how many help all). */
export function pathSummaryChips(unit, path, { size = 'sm' } = {}) {
  const sum = pathSummary(unit, path);
  return h('span.tag-chips.tag-summary', sum.map((s) => {
    const info = UPGRADE_TAGS[s.id];
    let text = `${info.label} ×${s.count}`;
    if (s.id === 'allies' && s.radius) text += ` · ${tilesText(s.radius, { unit: size !== 'xs' })}`;
    const chip = tagChip({ id: s.id, radius: s.radius, team: s.team > 0 }, { size, text });
    const bits = [`${s.count} of 5 tiers: ${info.long}`];
    if (s.team) bits.push(`${s.team} of them help every girl (marks, Brittle, shred or reveal).`);
    if (s.transform) bits.push(`${s.transform} change how she attacks.`);
    chip.title = bits.join(' ');
    return chip;
  }));
}

/**
 * The four tags (+ New attack) with their meaning.
 * @param {{ long?: boolean, size?: 'xs'|'sm'|'md' }} [o] long: one line of explanation per tag
 */
export function tagLegend({ long = false, size = 'sm' } = {}) {
  const tags = [...TAG_ORDER.map((id) => ({ id })), { id: 'transform' }];
  if (!long) return h('div.tag-legend', { 'data-testid': 'tag-legend' }, tags.map((t) => tagChip(t, { size })));
  return h('div.tag-legend.tag-legend-long', { 'data-testid': 'tag-legend' },
    tagLine({ id: 'self' }, size),
    tagLine({ id: 'transform' }, size),
    tagLine({ id: 'allies' }, size, 'Buffs the other girls standing inside her aura circle (the chip shows its radius). Never herself. Auras of the same kind don\'t stack: each girl gets the strongest one. Discount auras also make new girls placed inside cheaper.'),
    tagLine({ id: 'enemies' }, size),
    tagLine({ id: 'enemies', team: true }, size),
    tagLine({ id: 'coins' }, size));
}

function tagLine(tag, size, text = null) {
  const line = tagChip(tag, { size, long: true });
  if (text) line.querySelector('.tag-long').textContent = text;
  return line;
}
