// Player tag chips (DEV · ALPHA · BETA) next to names: chat lines, the lobby chat drawer, the player
// card, Messages, the clan roster and requests, the own profile header. tagChips(userId) returns a
// holder that fills itself from the tag cache (src/online/tags.js) and patches itself when a batch
// lands, so a row never waits for its chip. Tight places show one chip (DEV beats ALPHA beats BETA);
// the player card and the profile header show every chip. No tags (or no player_tags table on the
// server yet): an empty holder that takes no room.
//
// No registry of every holder: when a batch lands, the holders on the page are found in the page
// (document.querySelectorAll), so a row a screen dropped is never kept alive from here. The only
// holders kept are the few made before their tags were known that are not on the page yet (rows
// are built first and attached a moment later): at most EARLY_MAX, for at most GRACE_MS each.
import '../styles/online.css';
import { h } from '../dom.js';
import { TAG_INFO, chipKinds, tagsOf, wantTags, onTags, selfId, onSelfId, tagsDisabled } from '../../online/tags.js';

/** Holders waiting for their first batch while not on the page (painted even when detached). */
const early = new Set();
const GRACE_MS = 15000;
const EARLY_MAX = 200;
let wired = false;

function paint(el) {
  const id = el._tagUid();
  const kinds = id ? chipKinds(tagsOf(id), { all: el._tagAll }) : [];
  if (el.dataset.tags === kinds.join(' ') && el.childElementCount === kinds.length) return;
  el.replaceChildren(...kinds.map((k) => tagChip(k)));
  el.dataset.tags = kinds.join(' ');
}

/**
 * Drops the early holders that are on the page now (the page finds them), already painted from a
 * batch (their tags are known), or too old; then the oldest past EARLY_MAX.
 */
function prune(now = Date.now()) {
  for (const el of early) {
    const id = el._tagUid();
    if (el.isConnected || (id && tagsOf(id)) || now - el._tagBorn > GRACE_MS) early.delete(el);
  }
  for (const el of early) {
    if (early.size <= EARLY_MAX) break;
    early.delete(el);
  }
}

/** Repaints every holder on the page (and every early one) that `test` picks. */
function repaint(test) {
  const onPage = typeof document === 'undefined' ? [] : document.querySelectorAll('.tg-chips');
  for (const el of onPage) if (el._tagUid && test(el)) paint(el);
  for (const el of early) if (!el.isConnected && test(el)) paint(el);
  prune();
}

function wire() {
  if (wired) return;
  wired = true;
  onTags((ids) => {
    const changed = new Set(ids);
    repaint((el) => changed.has(el._tagUid()));
  });
  // the own profile header learns its account id a moment after the screen opens
  onSelfId((uid) => {
    if (uid) wantTags([uid]);
    repaint((el) => el._tagSelf);
  });
}

/** One chip: rounded, bold small capitals, the tag's colour; screen readers say "Developer" etc. */
export function tagChip(kind) {
  const info = TAG_INFO[kind];
  return h(`span.tg-chip.tg-${kind}`, { role: 'img', 'aria-label': info.label, title: info.label, 'data-testid': 'tag-chip', 'data-tag': kind }, info.chip);
}

/**
 * The tag chips of a player, filled from the cache (and patched when it learns more).
 * @param {string|null} userId the player's account id (ignored with self)
 * @param {{ all?: boolean, self?: boolean, size?: 'sm'|'md'|'lg' }} [opts] all: every chip (cards,
 *   profile header) instead of the top one; self: this tab's own account (the profile header)
 * @returns {HTMLElement}
 */
export function tagChips(userId, { all = false, self = false, size = 'sm' } = {}) {
  const el = h(`span.tg-chips.tg-${size}`, { 'data-testid': 'tag-chips' });
  el.dataset.tags = '';
  // a server without the player_tags table: an empty holder, never patched, nothing kept
  if (tagsDisabled()) return el;
  wire();
  el._tagUid = () => (self ? selfId() : userId) || null;
  el._tagAll = all;
  el._tagSelf = self;
  el._tagBorn = Date.now();
  paint(el);
  const id = el._tagUid();
  if (id) wantTags([id]);
  // tags not known yet: a batch is on its way and may land before the row is attached
  if (!id || !tagsOf(id)) {
    early.add(el);
    if (early.size > EARLY_MAX) prune();
  }
  return el;
}

/** Test hook: how many holders this module keeps. */
export function _tagChipState() {
  return { early: early.size };
}
