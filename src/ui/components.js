// Shared UI building blocks. Screens should use these so the whole game keeps one
// look (Blue Archive–style slanted white panels on a sky-blue backdrop).
import { h, fromHTML, clear } from './dom.js';
import { store } from '../core/store.js';
import { navigate, back } from './router.js';
import { formatNumber } from '../core/util.js';
import { itemIcon, uiIcon, currencyIcon } from '../art/icons.js';
import { cardArtSVG } from '../art/cardArt.js';
import { getItem } from '../data/items.js';
import { getUnit } from '../data/units.js';
import { ITEM_RARITIES, UNIT_RARITIES } from '../data/types.js';
import { itemSources } from '../systems/inventory.js';

/** Inline SVG string -> element wrapper span. */
export function svgEl(svg, cls = 'svg-icon') {
  const span = h(`span.${cls}`);
  span.innerHTML = svg;
  return span;
}

export function button(label, { kind = 'primary', onClick, disabled = false, icon = null, title, small = false, testid } = {}) {
  const b = h(
    `button.btn.btn-${kind}${small ? '.btn-small' : ''}`,
    { onclick: onClick, disabled, title, 'data-testid': testid },
    icon ? svgEl(uiIcon(icon), 'btn-icon') : null,
    h('span.btn-label', label),
  );
  return b;
}

/** Top bar with back/home, title, currencies and settings. Auto-updates on store change. */
export function topBar({ title = '', showBack = true, showHome = true, extra = null } = {}) {
  const coins = h('span.cur-val', { 'data-testid': 'coins' });
  const gems = h('span.cur-val', { 'data-testid': 'gems' });
  const refresh = () => {
    const p = store.profile;
    coins.textContent = formatNumber(p.currencies.coins);
    gems.textContent = formatNumber(p.currencies.gems);
  };
  refresh();
  const bar = h(
    'header.topbar',
    showBack ? h('button.topbar-back', { onclick: () => back(), title: 'Back', 'data-testid': 'back' }, svgEl(uiIcon('back'))) : null,
    h('div.topbar-title', title),
    h('div.topbar-spacer'),
    extra,
    h('div.cur-pill', svgEl(currencyIcon('coins')), coins),
    h('div.cur-pill', svgEl(currencyIcon('gems')), gems, h('button.cur-plus', { onclick: () => navigate('mall'), title: 'Mall' }, '+')),
    h('button.topbar-icon', { onclick: () => navigate('settings'), title: 'Settings', 'data-testid': 'settings' }, svgEl(uiIcon('settings'))),
    showHome ? h('button.topbar-icon', { onclick: () => navigate('lobby'), title: 'Home', 'data-testid': 'home' }, svgEl(uiIcon('home'))) : null,
  );
  const off = store.on('change', refresh);
  bar.cleanup = off;
  // auto-cleanup when removed from DOM
  const mo = new MutationObserver(() => {
    if (!bar.isConnected) {
      off();
      mo.disconnect();
    }
  });
  queueMicrotask(() => bar.parentNode && mo.observe(document.body, { childList: true, subtree: true }));
  return bar;
}

/** Screen scaffold: returns {el, body}. el already contains the top bar. */
export function screen(title, opts = {}) {
  const body = h('main.screen-body');
  const el = h(`div.screen${opts.cls ? `.${opts.cls}` : ''}`, topBar({ title, ...opts }), body);
  return { el, body };
}

export function panel(title, ...children) {
  return h('section.panel', title ? h('h3.panel-title', title) : null, ...children);
}

/** Tabs. items: [{id,label,badge?}] -> element with .setActive(id) */
export function tabs(items, activeId, onChange) {
  const el = h('nav.tabs', { role: 'tablist' });
  const render = (active) => {
    clear(el);
    for (const it of items) {
      el.appendChild(
        h(
          `button.tab${it.id === active ? '.active' : ''}`,
          { role: 'tab', 'aria-selected': it.id === active ? 'true' : 'false', 'data-testid': `tab-${it.id}`, onclick: () => { render(it.id); onChange(it.id); } },
          it.label,
          it.badge ? h('span.tab-badge') : null,
        ),
      );
    }
  };
  render(activeId);
  el.setActive = render;
  return el;
}

let modalStack = [];
/**
 * modal({title, body: Node|string, actions:[{label, kind, onClick(close)}], wide, onClose})
 * @returns {{close: () => void, el: HTMLElement}}
 */
export function modal({ title = '', body = null, actions = [{ label: 'OK', kind: 'primary' }], wide = false, onClose = null, dismissable = true } = {}) {
  const close = () => {
    overlay.classList.add('closing');
    setTimeout(() => overlay.remove(), 160);
    modalStack = modalStack.filter((m) => m !== overlay);
    onClose?.();
  };
  const dialog = h(
    `div.modal${wide ? '.modal-wide' : ''}`,
    { role: 'dialog', 'aria-modal': 'true' },
    title ? h('div.modal-title', title) : null,
    h('div.modal-body', typeof body === 'string' ? h('p', body) : body),
    actions.length
      ? h('div.modal-actions', actions.map((a) => button(a.label, { kind: a.kind || 'ghost', testid: a.testid, onClick: () => (a.onClick ? a.onClick(close) : close()) })))
      : null,
  );
  const overlay = h('div.modal-overlay', { onclick: (e) => { if (dismissable && e.target === overlay) close(); } }, dialog);
  document.body.appendChild(overlay);
  modalStack.push(overlay);
  return { close, el: dialog };
}

export function confirmDialog(text, { title = 'Confirm', ok = 'Confirm', cancel = 'Cancel' } = {}) {
  return new Promise((resolve) => {
    modal({
      title,
      body: text,
      actions: [
        { label: cancel, kind: 'ghost', onClick: (c) => { c(); resolve(false); } },
        { label: ok, kind: 'primary', testid: 'confirm-ok', onClick: (c) => { c(); resolve(true); } },
      ],
      onClose: () => resolve(false),
    });
  });
}

export function toast(message, kind = 'info', ms = 2200) {
  let host = document.querySelector('.toast-host');
  if (!host) document.body.appendChild((host = h('div.toast-host')));
  const t = h(`div.toast.toast-${kind}`, message);
  host.appendChild(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}

export function stars(n, max = 5) {
  return h('span.stars', Array.from({ length: max }, (_, i) => h(`span.star${i < n ? '.on' : ''}`, '★')));
}

export function rarityBadge(rarity) {
  const r = UNIT_RARITIES[rarity] || ITEM_RARITIES[rarity];
  return h('span.rarity-badge', { style: { background: r?.color || '#999' } }, r?.name || rarity);
}

/** Square item tile with rarity frame, icon and count. Click opens item info by default. */
export function itemTile(itemId, count = null, { onClick, size = 64, showName = false } = {}) {
  const item = getItem(itemId);
  const rarity = item ? ITEM_RARITIES[item.rarity] : null;
  const tile = h(
    'button.item-tile',
    {
      style: { width: `${size}px`, '--rarity': rarity?.color || '#999' },
      title: item ? item.name : itemId,
      'data-item': itemId,
      onclick: () => (onClick ? onClick(itemId) : showItemInfo(itemId)),
    },
    svgEl(itemIcon(itemId), 'item-tile-icon'),
    count != null ? h('span.item-count', `×${formatNumber(count)}`) : null,
  );
  if (!showName) return tile;
  return h('div.item-tile-wrap', tile, h('div.item-tile-name', item?.name || itemId));
}

/** Item info modal with description, owned count and "where to get" teleports. */
export function showItemInfo(itemId) {
  const item = getItem(itemId);
  const owned = store.profile.items[itemId] || 0;
  const sources = itemSources(itemId);
  const body = h(
    'div.item-info',
    h('div.item-info-head', itemTile(itemId, null, { onClick: () => {}, size: 80 }), h('div', h('div.item-info-name', item?.name || itemId), rarityBadge(item?.rarity || 'common'), h('div.muted', `Owned: ${formatNumber(owned)}`))),
    h('p', item?.desc || ''),
    h('h4', 'Where to get'),
    sources.length
      ? h(
          'ul.source-list',
          sources.slice(0, 8).map((s) =>
            h(
              'li.source-row',
              h('span.source-name', s.label),
              h('span.muted', s.note || ''),
              s.stageId ? button('Teleport', { kind: 'yellow', small: true, icon: 'teleport', testid: `teleport-${s.stageId}`, onClick: () => { m.close(); navigate('stage', { id: s.stageId }); } }) : s.route ? button('Go', { kind: 'yellow', small: true, onClick: () => { m.close(); navigate(s.route, s.params || {}); } }) : null,
            ),
          ),
        )
      : h('p.muted', 'Not obtainable yet.'),
  );
  const m = modal({ title: 'Item', body, actions: [{ label: 'Close', kind: 'ghost' }] });
  return m;
}

/** Character card thumbnail. variant: 'tall' (Arknights-style portrait) | 'square'. */
export function unitCard(unitId, { onClick, owned = true, level = null, awaken = 0, variant = 'tall', selected = false } = {}) {
  const u = getUnit(unitId);
  const r = UNIT_RARITIES[u.rarity];
  const art = svgEl(cardArtSVG(u, { variant: variant === 'tall' ? 'portrait' : 'thumb' }), 'unit-card-art');
  return h(
    `button.unit-card.unit-card-${variant}${owned ? '' : '.locked'}${selected ? '.selected' : ''}`,
    { onclick: onClick, 'data-unit': unitId, style: { '--rarity': r.color } },
    art,
    h('div.unit-card-rarity', r.name),
    level != null ? h('div.unit-card-level', `Lv.${level}`) : null,
    awaken ? h('div.unit-card-stars', '★'.repeat(awaken)) : null,
    h('div.unit-card-name', u.name),
    owned ? null : h('div.unit-card-lock', svgEl(uiIcon('lock'))),
  );
}

/** Row of reward tiles from [{id, count}] */
export function rewardRow(rewards) {
  return h('div.reward-row', rewards.map((r) => itemTile(r.id, r.count, { size: 56 })));
}

export { h, fromHTML, clear };
