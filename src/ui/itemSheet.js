// The item sheet (UI v2 menus M2; docs/specs/UI_V2_MENUS.md §3 "Item sheet"): what an item is, how many you hold,
// where to get more, and what you can do with it, as a kit bottom sheet (src/ui/sheet.js). The Backpack's tiles and
// the Supplies sheet open it; the shared itemTile() default (components.js showItemInfo, the kit's modal) is the same
// content in the older dialog until the kit lane points it here.
//   - "Where to get" rows carry SECONDARY Go buttons (P2: at most one yellow; the old dialog had one yellow Teleport
//     per row). Test ids stay: teleport-<stage>, item-use, item-craft, kindred-release.
//   - The one yellow is Use on a usable ticket (SSR Select). Craft Room and the gear tools' Use are secondary.
// Styles: src/ui/styles/v2-backpack.css ("ITEM SHEET").
import './styles/v2-backpack.css';
import { h } from './dom.js';
import { button, itemTile, toast } from './components.js';
import { secondaryBtn, ghostBtn, lbl, num } from './kit.js';
import { openSheet } from './sheet.js';
import { lineGlyph } from './lineGlyphs.js';
import { navigate } from './router.js';
import { store } from '../core/store.js';
import { fmtNum } from './format.js';
import { getItem } from '../data/items.js';
import { ITEM_RARITIES, MATERIAL_FAMILIES } from '../data/types.js';
import { UNITS } from '../data/units.js';
import { itemSources, itemCount } from '../systems/inventory.js';
import { portraitHTML } from '../art/portraits.js';

/** The gear tools a piece is picked for (gearUr.js pickGearFor). */
const GEAR_TOOLS = ['gearAwaken', 'gearStitch', 'gearClub'];

/** A rarity tag for an item: the ink pill with rarity-coloured letters (§5.6), the full rarity name. */
export function itemRarityTag(rarity) {
  const r = ITEM_RARITIES[rarity];
  return h(`span.ui-rtag.${rarity || 'common'}.bp-rtag`, r?.name || rarity || 'Common');
}

/**
 * Open the item sheet.
 * @param {string} itemId
 * @param {{ onChange?: Function|null }} [o] onChange: something was used or released (the caller redraws)
 * @returns {{ close(): void, el: HTMLElement, body: HTMLElement }}
 */
export function openItemSheet(itemId, { onChange = null } = {}) {
  const item = getItem(itemId);
  const profile = store.profile;
  const owned = itemCount(profile, itemId);
  // up to eight places, as before; each row shows its drop chance (a repeated row: P3 budgets it per row,
  // data-probe="tile"): a short chance ("90%", "Hard+ 6%") as a muted suffix, a longer note on its own wrapping line
  const sources = itemSources(itemId).slice(0, 8);
  let sheet = null;
  const go = (fn) => () => { sheet?.close(); fn(); };

  const users = item?.category === 'material' && item.family ? UNITS.filter((u) => u.materialFamily === item.family) : [];
  const rows = sources.map((s, i) => h('li.bp-src', { 'data-probe': 'tile' },
    s.note && s.note.length > NOTE_INLINE
      ? h('span.bp-src-t.two', h('span.bp-src-l', s.label), h('span.bp-src-note', s.note))
      : h('span.bp-src-t', s.label, s.note ? h('span.bp-chance', s.note) : null),
    s.stageId
      ? secondaryBtn('Go', { testid: `teleport-${s.stageId}`, title: `Go to ${s.label}`, cls: 'bp-go', onClick: go(() => navigate('stage', { id: s.stageId })) })
      : s.route ? secondaryBtn('Go', { testid: `item-go-${i}`, title: `Go to ${s.label}`, cls: 'bp-go', onClick: go(() => navigate(s.route, s.params || {})) }) : null));

  const acts = [];
  // the one yellow: a ticket that picks a girl
  if (item?.usable === 'ssrSelect' && owned > 0) {
    acts.push(button('Use', { kind: 'yellow', icon: 'sparkle', testid: 'item-use', onClick: go(() => import('./selectTicket.js').then((m) => m.openSelectTicket())) }));
  }
  // the gear tools: pick a piece, then its Awaken / Stitch / club modal
  if (GEAR_TOOLS.includes(item?.usable) && owned > 0) {
    acts.push(secondaryBtn('Use', { icon: 'sparkle', testid: 'item-use', onClick: go(() => import('./gearUr.js').then((m) => m.pickGearFor(itemId, () => { store.commit('gear-use'); onChange?.(); }))) }));
  }
  // [ascension] family materials: the Craft Room (combine 3 → 1, swap 2 → 1)
  if (item?.category === 'material' && item.family) {
    acts.push(secondaryBtn('Craft Room', { icon: 'swap', testid: 'item-craft', onClick: go(() => import('./craftRoom.js').then((m) => m.openCraftRoom(itemId, onChange))) }));
  }

  const body = h('div.bp-isheet', { 'data-testid': 'item-info' },
    h('div.bp-ihead',
      itemTile(itemId, null, { size: globalThis.matchMedia?.('(max-height: 480px)').matches ? 56 : 72, onClick: () => {} }),
      h('div.bp-ihead-txt',
        // the actions sit in the owned row, beside the facts (one row less, so more places show on a landscape phone)
        h('div.bp-ihead-row', itemRarityTag(item?.rarity), h('span.bp-owned', lbl('Owned'), num(fmtNum(owned, 'count', { detail: true }), 's')),
          acts.length ? h('div.bp-acts.bp-ihead-acts', acts) : null),
        item?.desc ? h('p.bp-desc', item.desc) : null)),
    users.length ? h('div.bp-users', lbl(`Used by · ${MATERIAL_FAMILIES[item.family]?.name || ''}`),
      h('div.bp-faces', users.map((u) => h('span.bp-face', { title: u.name, html: portraitHTML(u, 'thumb', { alt: u.name }) })))) : null,
    h('div.bp-where',
      h('h3.bp-kick', rows.length ? `Where to get · ${rows.length}` : 'Where to get'),
      rows.length ? h('ul.bp-srcs', rows) : h('p.bp-desc', 'Not obtainable yet.')));

  // a Kindred Essence nobody can use: release it for a spare (a ghost action, one line saying why)
  if (item?.kindred && owned > 0) {
    import('../systems/essence.js').then((ess) => {
      if (ess.kindredUseful(store.profile, itemId) || !sheet) return;
      body.insertBefore(h('div.bp-acts.bp-release',
        h('span.bp-desc', 'No girl can use this Essence right now.'),
        button('Release for Mementos', { kind: 'ghost', small: true, testid: 'kindred-release', onClick: () => {
          const r = ess.releaseKindred(store.profile, itemId);
          if (!r.ok) return;
          store.commit('kindred-release');
          sheet?.close();
          onChange?.();
          toast(`Released: +${r.pay.mementos} Mementos${r.pay.moonpearls ? ` · +${r.pay.moonpearls} Moonpearls` : ''}`, 'good');
        } })), body.querySelector('.bp-where'));
    }).catch(() => {});
  }
  sheet = openSheet({ title: item?.name || itemId, body, testid: 'item-sheet', cls: 'bp-sheet' });
  // when the sheet cannot show every place, the list scrolls on its own, sized to whole rows: no Go button is cut in half
  // by the sheet's edge, and the item and its actions stay in view
  requestAnimationFrame(() => fitRows(sheet.body, body.querySelector('.bp-srcs')));
  return sheet;
}

/** A note longer than this goes on its own line under the place (a sentence would run under Go on a phone). */
const NOTE_INLINE = 16;

/**
 * Caps a list inside a scrolling sheet body to the whole rows that fit, and lets the list scroll instead, with an
 * "N more" ghost button under it (and a soft fade on its last row) while places are hidden below.
 */
function fitRows(scroller, list) {
  if (!scroller || !list?.children.length) return;
  if (scroller.scrollHeight - scroller.clientHeight <= 1) return;
  const more = ghostBtn('More', { icon: lineGlyph('chevD', '', { kitSize: false }), testid: 'item-more-places', onClick: () => list.scrollBy({ top: Math.max(48, list.clientHeight - 24), behavior: 'smooth' }) });
  more.classList.add('bp-more-places');
  list.after(more);
  const over = scroller.scrollHeight - scroller.clientHeight;
  const room = list.getBoundingClientRect().height - over;
  let used = 0;
  for (const row of list.children) {
    const rh = row.getBoundingClientRect().height;
    if (used + rh > room) break;
    used += rh;
  }
  // (at least one whole row; a screen too short for even that keeps the sheet's own scroll)
  if (used <= 0) {
    more.remove();
    return;
  }
  list.style.maxHeight = `${Math.ceil(used)}px`;
  list.classList.add('fit');
  const label = more.firstChild;
  const update = () => {
    const bottom = list.getBoundingClientRect().bottom;
    const hidden = [...list.children].filter((r) => r.getBoundingClientRect().bottom > bottom + 1).length;
    more.hidden = hidden === 0;
    list.classList.toggle('more', hidden > 0);
    label.nodeValue = `${hidden} more`;
    more.setAttribute('aria-label', `${hidden} more place${hidden === 1 ? '' : 's'} to get it`);
  };
  list.addEventListener('scroll', update, { passive: true });
  update();
}
