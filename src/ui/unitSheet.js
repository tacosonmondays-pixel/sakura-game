// Unit Sheet (owner request #152): the quick info sheet that opens when you hold a girl's card.
// Left: her card art + "Open full page". Right: Info (the student page's Info tab, word for
// word) | Upgrades (Self / Allies / Enemies / Coins legend + the 3 × 5 tree with tier details).
// Lazy chunk; student.js (Info content + describeMods) is fetched on first open and cached.
import { h, clear, svgEl, stars } from './components.js';
import { store } from '../core/store.js';
import { navigate } from './router.js';
import { UNIT_MAP } from '../data/units.js';
import { UNIT_RARITIES, ROLES } from '../data/types.js';
import { levelCap, unitPower, MAX_AWAKEN } from '../systems/progression.js';
import { portraitHTML } from '../art/portraits.js';
import { uiIcon } from '../art/icons.js';
import { onEscape } from './hold.js';
import { tagLegend, tagChips, TAG_GLYPHS } from './tagChips.js';
import { buildTreeModel } from './treeModel.js';
import { upgradeGrid, tierDetail } from './upgradeGrid.js';

let studentMod = null;
const loadStudent = () => (studentMod ||= import('./screens/student.js').catch((e) => {
  studentMod = null;
  throw e;
}));

let openSheet = null;

const fmt = (n) => Math.round(n).toLocaleString('en-US');
function howShort(unit) {
  const a = unit.acquisition || {};
  if (a.type === 'starter') return 'Starter';
  if (a.type === 'free') return `Free after ${a.afterStage}`;
  return 'Recruit';
}
const reduced = () => document.documentElement.hasAttribute('data-reduce-motion') || matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Opens (or replaces) the sheet.
 * @param {string} unitId
 * @param {{ tab?: 'info'|'upgrades', allowFullPage?: boolean, origin?: HTMLElement|null }} [o]
 * @returns {{ close(): void, el: HTMLElement }}
 */
export function openUnitSheet(unitId, { tab = 'info', allowFullPage = true, origin = null } = {}) {
  const unit = UNIT_MAP[unitId];
  if (!unit) return { close() {}, el: null };
  openSheet?.close({ restoreFocus: false });

  const profile = store.profile;
  const st = profile?.units?.[unit.id] || null;
  const r = UNIT_RARITIES[unit.rarity];
  let closed = false;
  let current = tab === 'upgrades' ? 'upgrades' : 'info';
  const bodies = {};

  const close = ({ restoreFocus = true } = {}) => {
    if (closed) return;
    closed = true;
    offEsc();
    window.removeEventListener('hashchange', onHash);
    overlay.classList.add('closing');
    setTimeout(() => overlay.remove(), reduced() ? 0 : 150);
    if (openSheet === api) openSheet = null;
    if (restoreFocus && origin?.isConnected) origin.focus?.({ preventScroll: true });
  };
  const onHash = () => close({ restoreFocus: false });

  // ---- header
  const meta = h('div.us-meta');
  if (st) {
    meta.append(
      h('span.us-level', h('span', 'Lv.'), h('b', String(st.level)), h('span.us-muted', ` / ${levelCap(st)}`)),
      stars(st.awaken || 0, MAX_AWAKEN),
      h('span.us-power', svgEl(uiIcon('sword'), 'us-power-ico'), fmt(unitPower(profile, unit.id))));
  } else {
    meta.append(h('span.us-locked', svgEl(uiIcon('lock'), 'us-lock-ico'), howShort(unit)));
  }
  const closeBtn = h('button.us-close', { type: 'button', 'data-testid': 'unit-sheet-close', title: 'Close', 'aria-label': 'Close', onclick: () => close() }, svgEl(uiIcon('close'), 'us-close-ico'));
  const head = h('header.us-head',
    h('span.us-rarity', { style: { '--rarity': r?.color || '#999' } }, r?.name || unit.rarity),
    h('div.us-names', h('div.us-name', unit.name), h('div.us-title', unit.title || ROLES[unit.role]?.name || '')),
    meta,
    closeBtn);

  // ---- left column: card art + full page
  const fullBtn = allowFullPage
    ? h('button.us-full', {
      type: 'button',
      'data-testid': 'unit-sheet-open-page',
      onclick: () => {
        close({ restoreFocus: false });
        navigate('student', { id: unit.id, tab: current === 'upgrades' ? 'tree' : 'info' });
      },
    }, h('span.us-full-long', 'Open full page'), h('span.us-full-short', 'Full page'), svgEl(uiIcon('play'), 'us-full-ico'))
    : null;
  const left = h('aside.us-left',
    h('div.us-art', { style: { '--rarity': r?.color || '#999' } }, svgEl(portraitHTML(unit, 'card', { eager: true, awaken: st?.awaken || 0 }), 'us-art-img')),
    fullBtn);

  // ---- tabs
  const tabBar = h('nav.us-tabs', { role: 'tablist' });
  const host = h('div.us-body', { tabindex: '-1' });
  const tabBtns = {};
  for (const [id, label] of [['info', 'Info'], ['upgrades', 'Upgrades']]) {
    tabBtns[id] = h('button.us-tab', {
      type: 'button', role: 'tab', 'data-testid': `unit-sheet-tab-${id}`,
      onclick: () => show(id),
    }, id === 'upgrades' ? svgEl(TAG_GLYPHS.allies, 'us-tab-ico') : null, label);
    tabBar.append(tabBtns[id]);
  }

  const sheet = h('div.us-sheet', { role: 'dialog', 'aria-modal': 'true', 'aria-label': `${unit.name} — info`, 'data-testid': 'unit-sheet', 'data-unit-sheet': unit.id },
    head,
    h('div.us-main', left, h('div.us-right', tabBar, host)));
  const overlay = h('div.modal-overlay.us-overlay', { 'data-hold-info': 'off', onclick: (e) => { if (e.target === overlay) close(); } }, sheet);
  if (reduced()) overlay.classList.add('us-still');

  function show(id) {
    current = id;
    for (const [k, b] of Object.entries(tabBtns)) {
      b.classList.toggle('on', k === id);
      b.setAttribute('aria-selected', k === id ? 'true' : 'false');
    }
    clear(host);
    host.scrollTop = 0;
    if (!bodies[id]) bodies[id] = id === 'info' ? buildInfo() : buildUpgrades();
    host.append(bodies[id]);
  }

  function shimmer() {
    return h('div.us-shimmer', h('span'), h('span'), h('span'));
  }
  function failBox(retry) {
    return h('div.us-fail', h('p', 'Couldn\'t load her details — check your connection.'), h('button.btn.btn-primary.btn-small', { type: 'button', onclick: retry }, 'Retry'));
  }

  function buildInfo() {
    const box = h('div.us-info', shimmer());
    const fill = () => loadStudent().then((m) => {
      if (closed) return;
      box.replaceChildren(m.infoTab(unit));
    }).catch((e) => {
      console.warn('[unitSheet] student page unavailable', e);
      box.replaceChildren(failBox(() => {
        box.replaceChildren(shimmer());
        fill();
      }));
    });
    fill();
    return box;
  }

  function buildUpgrades() {
    const model = buildTreeModel({ def: unit, mode: 'static' });
    const detailHost = h('div.us-detail-host');
    let describe = null;
    let selected = null;
    const renderDetail = () => {
      clear(detailHost);
      if (!selected) {
        detailHost.append(h('p.us-hint', 'Tap a tier to see exactly what it does.'));
        return;
      }
      detailHost.append(tierDetail(selected, model, { describe }));
    };
    const grid = upgradeGrid(model, {
      unit,
      onPick: (cell) => {
        selected = cell;
        renderDetail();
        requestAnimationFrame(() => detailHost.scrollIntoView?.({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }));
      },
    });
    grid.classList.add('ut-grid-sheet');
    loadStudent().then((m) => {
      describe = m.describeMods;
      if (selected && !closed) renderDetail();
    }).catch(() => {});
    renderDetail();
    const body = h('div.us-upgrades',
      tagLegend({ size: 'sm' }),
      h('p.us-rule', model.rule, ' Prices are the base cost; difficulty changes them.'),
      grid,
      detailHost,
      model.hero ? heroBlock(model.hero) : null,
      model.passive ? h('div.us-passive', h('div.us-sub', '★3 awakening passive'), h('div.us-passive-row', h('b', model.passive.name), tagChips(model.passive.tags, { size: 'xs' })), h('div.us-muted', model.passive.desc)) : null);
    return body;
  }

  function heroBlock(hero) {
    return h('div.us-hero',
      h('div.us-sub', 'Hero ultimate'),
      h('div.us-ult', h('span.us-ult-badge', 'ULT'), h('div', h('div.us-ult-name', h('b', hero.ult.name), tagChips(hero.ult.tags, { size: 'xs' })), h('div', hero.ult.desc), h('div.us-muted', `Unlocks at hero level ${hero.ult.unlockLevel}${hero.ult.cooldown ? ` · cooldown ${hero.ult.cooldown}s` : ''}`))),
      h('div.us-sub', 'In-battle levels'),
      h('ol.us-levels', hero.levels.map((l) => h('li', h('span.us-lv-num', String(l.level)), h('span.us-lv-desc', l.desc), l.tags.length ? tagChips(l.tags, { size: 'xs' }) : null))));
  }

  document.body.append(overlay);
  const offEsc = onEscape(() => close());
  window.addEventListener('hashchange', onHash);
  show(current);
  requestAnimationFrame(() => closeBtn.focus({ preventScroll: true }));

  const api = { close, el: sheet, show };
  openSheet = api;
  return api;
}

/** Closes the open sheet, if any (route changes, battle teardown). */
export function closeUnitSheet() {
  openSheet?.close({ restoreFocus: false });
}
