// Shared UI building blocks. Screens should use these so the whole game keeps one
// look (Blue Archive–style slanted white panels on a sky-blue backdrop).
import { h, fromHTML, clear } from './dom.js';
import { store } from '../core/store.js';
import { navigate, back } from './router.js';
import { formatNumber } from '../core/util.js';
import { itemIcon, uiIcon, currencyIcon, UI_ICON_NAMES } from '../art/icons.js';
import { cardArtSVG } from '../art/cardArt.js';
import { portraitHTML } from '../art/portraits.js';
import { lobbyIcon } from '../art/lobbyIcons.js';
import { getItem } from '../data/items.js';
import { getUnit } from '../data/units.js';
import { ITEM_RARITIES, UNIT_RARITIES, DIFFICULTY_ORDER } from '../data/types.js';
import { itemSources, itemCount } from '../systems/inventory.js';

/** Inline SVG string -> element wrapper span. */
export function svgEl(svg, cls = 'svg-icon') {
  const span = h(`span.${cls}`);
  span.innerHTML = svg;
  return span;
}

/**
 * A girl's drawn portrait wrapped in a span (src/art/portraits.js): lazy <img>, SVG card art
 * when she has no drawing or the file fails to load.
 * @param {string|object} unit unit id or UnitDef
 * @param {'full'|'card'|'bust'|'thumb'|'cut'|'cutS'} [kind]
 * @param {string} [cls] wrapper class
 */
export function portrait(unit, kind = 'bust', cls = 'pt-wrap', opts = {}) {
  const u = typeof unit === 'string' ? getUnit(unit) : unit;
  return svgEl(portraitHTML(u, kind, opts), cls);
}

// A drawn portrait that fails to load (offline, missing file) becomes the SVG card art.
if (typeof document !== 'undefined' && !globalThis.__sakuraPortraitFallback) {
  globalThis.__sakuraPortraitFallback = true;
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains('pt-img') || !img.parentNode) return;
    try {
      const u = getUnit(img.dataset.unit);
      const svg = fromHTML(cardArtSVG(u, { variant: img.dataset.svg || 'portrait' }));
      if (svg) img.replaceWith(svg);
    } catch {
      img.remove();
    }
  }, true);
}

// ---------------------------------------------------------------------------
// Icons: uiIcon() names plus a few UI-only glyphs (mail, menu grid, notice, fullscreen…)
// drawn in the same 24×24 currentColor line style.
// ---------------------------------------------------------------------------

const EXTRA_GLYPHS = {
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3.5 7l8.5 6.5L20.5 7"/>',
  menu: '<rect x="3.5" y="3.5" width="5" height="5" rx="1.2" fill="currentColor" stroke="none"/><rect x="9.5" y="3.5" width="5" height="5" rx="1.2" fill="currentColor" stroke="none"/><rect x="15.5" y="3.5" width="5" height="5" rx="1.2" fill="currentColor" stroke="none"/><rect x="3.5" y="9.5" width="5" height="5" rx="1.2" fill="currentColor" stroke="none"/><rect x="9.5" y="9.5" width="5" height="5" rx="1.2" fill="currentColor" stroke="none"/><rect x="15.5" y="9.5" width="5" height="5" rx="1.2" fill="currentColor" stroke="none"/><rect x="3.5" y="15.5" width="5" height="5" rx="1.2" fill="currentColor" stroke="none"/><rect x="9.5" y="15.5" width="5" height="5" rx="1.2" fill="currentColor" stroke="none"/><rect x="15.5" y="15.5" width="5" height="5" rx="1.2" fill="currentColor" stroke="none"/>',
  notice: '<path d="M4 10.5v3a1.5 1.5 0 0 0 1.5 1.5H8l7 4V5l-7 4H5.5A1.5 1.5 0 0 0 4 10.5z"/><path d="M18 9.5a3.5 3.5 0 0 1 0 5M9.5 15.5l1 4.5"/>',
  tasks: '<rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M7.5 8.5l1.6 1.6 3-3M7.5 14.5l1.6 1.6 3-3M14.5 8.5h2.5M14.5 14.5h2.5"/>',
  fullscreen: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
  exitFullscreen: '<path d="M9 4v5H4M15 4v5h5M20 15h-5v5M4 15h5v5"/>',
  rotate: '<rect x="6" y="3" width="12" height="18" rx="2.5"/><path d="M10.5 18.5h3"/><path d="M20.5 8.5a4 4 0 0 0-3.5-2.5M3.5 15.5a4 4 0 0 0 3.5 2.5"/>',
  story: '<path d="M3.5 5.5h6.5a2 2 0 0 1 2 2v12.5a2 2 0 0 0-2-2H3.5zM20.5 5.5H14a2 2 0 0 0-2 2v12.5a2 2 0 0 1 2-2h6.5z"/><path d="M5.8 9h4M5.8 12h4M14.2 9h4M14.2 12h4" stroke-width="1.4"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  account: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="11" r="2.2"/><path d="M5.5 16.5c.5-1.8 1.9-2.8 3.5-2.8s3 1 3.5 2.8M14.5 9.5h4M14.5 12.5h4"/>',
  expand: '<path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/>',
};

/** SVG markup for a UI glyph: every uiIcon() name plus the extra ones above. */
export function glyph(name) {
  if (EXTRA_GLYPHS[name]) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${EXTRA_GLYPHS[name]}</g></svg>`;
  }
  return uiIcon(UI_ICON_NAMES.includes(name) ? name : 'info');
}

export function button(label, { kind = 'primary', onClick, disabled = false, icon = null, title, small = false, testid } = {}) {
  const b = h(
    `button.btn.btn-${kind}${small ? '.btn-small' : ''}`,
    { onclick: onClick, disabled, title, 'data-testid': testid },
    icon ? svgEl(glyph(icon), 'btn-icon') : null,
    h('span.btn-label', label),
  );
  return b;
}

/** Square icon button with an optional label under it and a badge / dot. */
export function iconButton(icon, { onClick, title, testid, label = null, badge = null, dot = false, cls = '' } = {}) {
  return h(
    `button.icon-btn${cls ? `.${cls}` : ''}`,
    { onclick: onClick, title: title || label || undefined, 'aria-label': title || label || icon, 'data-testid': testid },
    svgEl(glyph(icon)),
    label ? h('span.icon-btn-label', label) : null,
    badge != null && badge !== false ? h(`span.icon-btn-badge${badge === true ? '.yellow' : ''}`, badge === true ? '!' : String(badge)) : null,
    dot ? h('span.notif-dot') : null,
  );
}

// ---------------------------------------------------------------------------
// Account level (derived from the profile; there is no stored level).
// ---------------------------------------------------------------------------

const MEDAL_XP = { easy: 15, normal: 25, hard: 40, nightmare: 60 };
export const ACCOUNT_MAX_LEVEL = 99;

/** XP needed to go from `level` to `level + 1`. */
export function accountXpForLevel(level) {
  return 60 + 30 * Math.max(1, level);
}

/**
 * Account level derived from progress (medals, wins, pulls, roster). Deterministic, so
 * the badge never needs a stored field.
 * @returns {{ level: number, xp: number, into: number, need: number, pct: number }}
 */
export function accountLevel(profile) {
  let xp = 0;
  const stages = profile?.progress?.stages || {};
  for (const entry of Object.values(stages)) {
    if (!entry) continue;
    for (const d of DIFFICULTY_ORDER) if (entry[d]) xp += MEDAL_XP[d];
    xp += Math.min(50, (entry.clears || 0) * 2);
  }
  const stats = profile?.stats || {};
  xp += (stats.wins || 0) * 8 + (stats.battles || 0) * 2 + (stats.pulls || 0) * 3;
  xp += Object.keys(profile?.units || {}).length * 20;
  for (const u of Object.values(profile?.units || {})) xp += Math.max(0, (u?.level || 1) - 1) * 4 + (u?.awaken || 0) * 15;
  let level = 1;
  let rest = xp;
  while (level < ACCOUNT_MAX_LEVEL && rest >= accountXpForLevel(level)) {
    rest -= accountXpForLevel(level);
    level++;
  }
  const need = level >= ACCOUNT_MAX_LEVEL ? 0 : accountXpForLevel(level);
  return { level, xp, into: rest, need, pct: need ? rest / need : 1 };
}

/** Lobby-style "Lv. 3 · Sensei · xp bar" badge (auto-updates on store change). */
export function levelBadge(profile = store.profile, { name = 'Sensei', onClick = null } = {}) {
  const lvl = h('b');
  const xpText = h('span');
  const bar = h('i');
  const el = h(
    `${onClick ? 'button' : 'div'}.lvl-badge`,
    { onclick: onClick || undefined, 'data-testid': 'account-level', title: 'Account level' },
    h('span.lvl-badge-lv', h('small', 'Lv.'), lvl),
    h('span.lvl-badge-name', name),
    h('span.lvl-badge-xp', h('span.lvl-badge-bar', bar), xpText),
  );
  const paint = () => {
    const a = accountLevel(store.profile);
    lvl.textContent = String(a.level);
    xpText.textContent = a.need ? `${formatNumber(a.into)}/${formatNumber(a.need)}` : 'MAX';
    bar.style.width = `${Math.round(a.pct * 100)}%`;
  };
  paint();
  autoCleanup(el, store.on('change', paint));
  return el;
}

/** Reduce-motion attribute on <html> mirrors the in-game setting (CSS reacts to it). */
export function applyMotionPreference(profile = store.profile) {
  try {
    const on = !!profile?.settings?.reduceMotion;
    document.documentElement.toggleAttribute('data-reduce-motion', on);
  } catch {
    /* no DOM */
  }
}

/** Remove a store listener once the element leaves the DOM. */
function autoCleanup(el, off) {
  el.cleanup = off;
  const mo = new MutationObserver(() => {
    if (!el.isConnected) {
      off();
      mo.disconnect();
    }
  });
  queueMicrotask(() => el.parentNode && mo.observe(document.body, { childList: true, subtree: true }));
}

/** Coins + gems pills (gems carry a "+" that opens the Mall). Auto-updates. */
export function currencyPills({ plus = true } = {}) {
  const coins = h('span.cur-val', { 'data-testid': 'coins' });
  const gems = h('span.cur-val', { 'data-testid': 'gems' });
  const refresh = () => {
    const p = store.profile;
    coins.textContent = formatNumber(p.currencies.coins);
    gems.textContent = formatNumber(p.currencies.gems);
  };
  refresh();
  const el = h(
    'div.topbar-group.cur-pills',
    h('div.cur-pill', svgEl(currencyIcon('coins')), coins),
    h('div.cur-pill', svgEl(currencyIcon('gems')), gems, plus ? h('button.cur-plus', { onclick: () => navigate('mall', { tab: 'gems' }), title: 'Mall', 'aria-label': 'Get gems' }, '+') : null),
  );
  autoCleanup(el, store.on('change', refresh));
  return el;
}

/** Top bar with back/home, title, currencies and settings. Auto-updates on store change. */
export function topBar({ title = '', showBack = true, showHome = true, extra = null } = {}) {
  const bar = h(
    'header.topbar',
    showBack ? h('button.topbar-back', { onclick: () => back(), title: 'Back', 'data-testid': 'back' }, svgEl(uiIcon('back'))) : null,
    h('div.topbar-title', title),
    h('div.topbar-spacer'),
    extra,
    currencyPills(),
    h('div.topbar-group',
      h('button.topbar-icon', { onclick: () => navigate('settings'), title: 'Settings', 'data-testid': 'settings' }, svgEl(uiIcon('settings'))),
      showHome ? h('button.topbar-icon', { onclick: () => navigate('lobby'), title: 'Home', 'data-testid': 'home' }, svgEl(uiIcon('home'))) : null,
    ),
  );
  return bar;
}

/** Screen scaffold: returns {el, body}. el already contains the top bar. */
export function screen(title, opts = {}) {
  applyMotionPreference();
  const body = h('main.screen-body');
  const el = h('div.screen', topBar({ title, ...opts }), body);
  if (opts.cls) el.classList.add(...String(opts.cls).split(/\s+/).filter(Boolean));
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
export function modal({ title = '', body = null, actions = [{ label: 'OK', kind: 'primary' }], wide = false, onClose = null, dismissable = true, cls = '' } = {}) {
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    overlay.classList.add('closing');
    setTimeout(() => overlay.remove(), 160);
    modalStack = modalStack.filter((m) => m !== overlay);
    onClose?.();
  };
  const dialog = h(
    `div.modal${wide ? '.modal-wide' : ''}${cls ? `.${cls}` : ''}`,
    { role: 'dialog', 'aria-modal': 'true' },
    title ? h('div.modal-title', title) : null,
    h('div.modal-body', typeof body === 'string' ? h('p', body) : body),
    actions.length
      ? h('div.modal-actions', actions.map((a) => button(a.label, { kind: a.kind || 'ghost', testid: a.testid, icon: a.icon, onClick: () => (a.onClick ? a.onClick(close) : close()) })))
      : null,
  );
  const overlay = h('div.modal-overlay', { onclick: (e) => { if (dismissable && e.target === overlay) close(); } }, dialog);
  document.body.appendChild(overlay);
  modalStack.push(overlay);
  return { close, el: dialog };
}

/**
 * Yes/no dialog. Resolves true on OK, false on cancel / backdrop tap. `okKind` picks the OK
 * button style (default 'primary'; `danger` wins).
 */
export function confirmDialog(text, { title = 'Confirm', ok = 'Confirm', cancel = 'Cancel', danger = false, okKind = 'primary' } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (v) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    modal({
      title,
      body: text,
      actions: [
        { label: cancel, kind: 'ghost', testid: 'confirm-cancel', onClick: (c) => { settle(false); c(); } },
        { label: ok, kind: danger ? 'danger' : okKind, testid: 'confirm-ok', onClick: (c) => { settle(true); c(); } },
      ],
      onClose: () => settle(false),
    });
  });
}

/**
 * Blue Archive "Menu Tab" popup: a white header with a centred title, yellow underline and an
 * X, then a 2-column grid of light buttons with illustrated icons — Options, Account,
 * Equipment, Items, Bestiary, Wiki, Fullscreen, plus any `extra` entries a screen adds
 * (the lobby adds Secretary and Notice).
 * @param {{ extra?: {icon: string, label: string, testid?: string, go: () => void}[] }} [opts]
 */
export function menuTabModal({ extra = [] } = {}) {
  const entries = [
    { icon: 'options', label: 'Options', go: () => navigate('settings') },
    { icon: 'account', label: 'Account', go: () => navigate('settings', { section: 'save' }) },
    { icon: 'equipment', label: 'Equipment', go: () => navigate('backpack', { tab: 'equipment' }) },
    { icon: 'items', label: 'Items', go: () => navigate('backpack') },
    { icon: 'bestiary', label: 'Bestiary', go: () => navigate('bestiary') },
    { icon: 'wiki', label: 'Wiki', go: () => navigate('wiki') },
    ...extra,
  ];
  const grid = h('div.menu-tab-grid');
  const m = modal({
    title: 'Menu Tab',
    body: grid,
    actions: [],
    cls: 'menu-tab',
  });
  const ico = (name, key) => svgEl(lobbyIcon(name, { uid: `menu-${key}`, shadow: false }), 'menu-tab-icon');
  for (const e of entries) {
    const key = e.label.toLowerCase();
    grid.appendChild(h('button.menu-tab-btn', { onclick: () => { m.close(); e.go(); }, 'data-testid': e.testid || `menu-${key}` }, ico(e.icon, key), h('span', e.label)));
  }
  const fs = h('button.menu-tab-btn', { 'data-testid': 'menu-fullscreen' }, ico('fullscreen', 'fullscreen'), h('span', 'Fullscreen'));
  fs.addEventListener('click', async () => {
    try {
      const o = await import('./orientation.js');
      await o.toggleFullscreen();
      fs.querySelector('span:last-child').textContent = o.isFullscreen() ? 'Exit fullscreen' : 'Fullscreen';
    } catch (e) {
      console.warn('[menu] fullscreen unavailable', e);
    }
  });
  grid.appendChild(fs);
  m.el.querySelector('.modal-title')?.appendChild(h('button.menu-tab-x', { onclick: () => m.close(), 'aria-label': 'Close', 'data-testid': 'menu-close' }, svgEl(glyph('close'), 'menu-tab-x-icon')));
  return m;
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
  // Belt and braces: custom properties must go through setProperty.
  tile.style.setProperty('--rarity', rarity?.color || '#999');
  if (!showName) return tile;
  return h('div.item-tile-wrap', tile, h('div.item-tile-name', item?.name || itemId));
}

/** Item info modal with description, owned count and "where to get" teleports. */
export function showItemInfo(itemId) {
  const item = getItem(itemId);
  const owned = itemCount(store.profile, itemId);
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
  const actions = [{ label: 'Close', kind: 'ghost' }];
  // usable items (SSR Select Ticket): open their picker
  if (item?.usable === 'ssrSelect' && owned > 0) {
    actions.push({ label: 'Use', kind: 'yellow', testid: 'item-use', onClick: (close) => { close(); import('./selectTicket.js').then((mod) => mod.openSelectTicket()); } });
  }
  const m = modal({ title: 'Item', body, actions });
  return m;
}

/** Character card thumbnail. variant: 'tall' (Arknights-style portrait) | 'square'. */
export function unitCard(unitId, { onClick, owned = true, level = null, awaken = 0, variant = 'tall', selected = false } = {}) {
  const u = getUnit(unitId);
  const r = UNIT_RARITIES[u.rarity];
  const art = svgEl(portraitHTML(u, variant === 'tall' ? 'card' : 'thumb', { awaken }), 'unit-card-art');
  const el = h(
    `button.unit-card.unit-card-${variant}${owned ? '' : '.locked'}${selected ? '.selected' : ''}`,
    { onclick: onClick, 'data-unit': unitId, style: { '--rarity': r.color } },
    art,
    h('div.unit-card-rarity', r.name),
    level != null ? h('div.unit-card-level', `Lv.${level}`) : null,
    awaken ? h('div.unit-card-stars', '★'.repeat(awaken)) : null,
    h('div.unit-card-name', u.name),
    owned ? null : h('div.unit-card-lock', svgEl(uiIcon('lock'))),
  );
  el.style.setProperty('--rarity', r.color);
  return el;
}

/** Row of reward tiles from [{id, count}] */
export function rewardRow(rewards) {
  return h('div.reward-row', rewards.map((r) => itemTile(r.id, r.count, { size: 56 })));
}

export { h, fromHTML, clear };
