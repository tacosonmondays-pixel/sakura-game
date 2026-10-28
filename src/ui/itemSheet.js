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
import { secondaryBtn, lbl, num } from './kit.js';
import { openSheet } from './sheet.js';
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
  const sources = itemSources(itemId).slice(0, 8);
  let sheet = null;
  const go = (fn) => () => { sheet?.close(); fn(); };

  const users = item?.category === 'material' && item.family ? UNITS.filter((u) => u.materialFamily === item.family) : [];
  const rows = sources.map((s, i) => h('li.bp-src',
    h('span.bp-src-t', s.label),
    s.note ? h('span.bp-src-note', s.note) : null,
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
  const actRow = h('div.bp-acts', acts);

  const body = h('div.bp-isheet', { 'data-testid': 'item-info' },
    h('div.bp-ihead',
      itemTile(itemId, null, { size: 72, onClick: () => {} }),
      h('div.bp-ihead-txt',
        h('div.bp-ihead-row', itemRarityTag(item?.rarity), h('span.bp-owned', lbl('Owned'), num(fmtNum(owned, 'count', { detail: true }), 's'))),
        item?.desc ? h('p.bp-desc', item.desc) : null)),
    users.length ? h('div.bp-users', lbl(`Used by · ${MATERIAL_FAMILIES[item.family]?.name || ''}`),
      h('div.bp-faces', users.map((u) => h('span.bp-face', { title: u.name, html: portraitHTML(u, 'thumb', { alt: u.name }) })))) : null,
    h('div.bp-where',
      h('h3.bp-kick', 'Where to get'),
      rows.length ? h('ul.bp-srcs', rows) : h('p.bp-desc', 'Not obtainable yet.')),
    acts.length ? actRow : null);

  // a Kindred Essence nobody can use: release it for a spare (a ghost action, one line saying why)
  if (item?.kindred && owned > 0) {
    import('../systems/essence.js').then((ess) => {
      if (ess.kindredUseful(store.profile, itemId) || !sheet) return;
      body.append(h('div.bp-acts.bp-release',
        h('span.bp-desc', 'No girl can use this Essence right now.'),
        button('Release for Mementos', { kind: 'ghost', small: true, testid: 'kindred-release', onClick: () => {
          const r = ess.releaseKindred(store.profile, itemId);
          if (!r.ok) return;
          store.commit('kindred-release');
          sheet?.close();
          onChange?.();
          toast(`Released: +${r.pay.mementos} Mementos${r.pay.moonpearls ? ` · +${r.pay.moonpearls} Moonpearls` : ''}`, 'good');
        } })));
    }).catch(() => {});
  }
  sheet = openSheet({ title: item?.name || itemId, body, testid: 'item-sheet', cls: 'bp-sheet' });
  return sheet;
}
