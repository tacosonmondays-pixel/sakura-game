// Player tag chips (DEV · ALPHA · BETA) next to names: chat lines, the lobby chat drawer, the player
// card, Messages, the clan roster and requests, the own profile header. tagChips(userId) returns a
// holder that fills itself from the tag cache (src/online/tags.js) and patches itself when a batch
// lands, so a row never waits for its chip. Tight places show one chip (DEV beats ALPHA beats BETA);
// the player card and the profile header show every chip. No tags (or no player_tags table on the
// server yet): an empty holder that takes no room.
import '../styles/online.css';
import { h } from '../components.js';
import { TAG_INFO, chipKinds, tagsOf, wantTags, onTags, selfId, onSelfId } from '../../online/tags.js';

/** Rendered holders (dropped once they left the page). */
const live = new Set();
const GRACE_MS = 15000;
let wired = false;

function paint(el) {
  const id = el._tagUid();
  const kinds = id ? chipKinds(tagsOf(id), { all: el._tagAll }) : [];
  if (el.dataset.tags === kinds.join(' ') && el.childElementCount === kinds.length) return;
  el.replaceChildren(...kinds.map((k) => tagChip(k)));
  el.dataset.tags = kinds.join(' ');
}

function wire() {
  if (wired) return;
  wired = true;
  onTags((ids) => {
    const changed = new Set(ids);
    const now = Date.now();
    for (const el of [...live]) {
      if (!el.isConnected) {
        if (el._tagSeen || now - el._tagBorn > GRACE_MS) live.delete(el);
        continue;
      }
      el._tagSeen = true;
      if (changed.has(el._tagUid())) paint(el);
    }
  });
  // the own profile header learns its account id a moment after the screen opens
  onSelfId((uid) => {
    if (uid) wantTags([uid]);
    for (const el of live) if (el._tagSelf && el.isConnected) paint(el);
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
  wire();
  const el = h(`span.tg-chips.tg-${size}`, { 'data-testid': 'tag-chips' });
  el._tagUid = () => (self ? selfId() : userId) || null;
  el._tagAll = all;
  el._tagSelf = self;
  el._tagBorn = Date.now();
  el.dataset.tags = '';
  paint(el);
  const id = el._tagUid();
  if (id) wantTags([id]);
  live.add(el);
  return el;
}
