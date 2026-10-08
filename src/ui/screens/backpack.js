// Backpack (owner: meta-b). Items organised by CATEGORY (CONTRACTS §12): Enhancement, Awakening,
// Equipment, Tickets, Tokens & Currency (+ All). Rarity is a sort/filter. Tapping an item opens the
// shared item info (sources + Teleport). The Equipment tab also lists real gear and gear boxes.
//
// Also exports small shared pieces used by other meta-b screens: gearCard, requirementRow,
// requirementList, unitMini.
import '../styles/meta-b.css';
import { h, clear, screen, svgEl, button, itemTile, showItemInfo, modal, toast, rarityBadge, confirmDialog } from '../components.js';
import { store } from '../../core/store.js';
import { navigate } from '../router.js';
import { createRng } from '../../core/rng.js';
import { formatNumber } from '../../core/util.js';
import { BACKPACK_TABS, ITEMS, ITEM_CATEGORIES, getItem, compareItemsByRarity } from '../../data/items.js';
import { ITEM_RARITIES, ITEM_RARITY_ORDER, GEAR_SLOTS, MATERIAL_FAMILIES } from '../../data/types.js';
import { UNITS, UNIT_MAP } from '../../data/units.js';
import { itemCount } from '../../systems/inventory.js';
import { gearList, describeStat, setGearLocked, salvageGear, salvageRewards, openGearBox, MAX_GEAR_LEVEL } from '../../systems/gear.js';
import { gearIcon, uiIcon, itemIcon } from '../../art/icons.js';
import { cardArtSVG } from '../../art/cardArt.js';

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

/** Element.append that skips null/false (native append would print "null"). */
export function put(el, ...kids) {
  for (const k of kids.flat(Infinity)) if (k != null && k !== false && k !== true) el.append(k);
  return el;
}

/** CSS custom properties as an inline style string (null values skipped). */
export function cssVars(obj) {
  return Object.entries(obj).filter(([, v]) => v != null).map(([k, v]) => `${k}:${v}`).join(';');
}

/** itemTile() with its rarity colour applied. */
export function rarityTile(itemId, count = null, opts = {}) {
  const el = itemTile(itemId, count, opts);
  const color = ITEM_RARITIES[getItem(itemId)?.rarity]?.color;
  const tileEl = el.classList.contains('item-tile') ? el : el.querySelector('.item-tile');
  if (color && tileEl) tileEl.style.setProperty('--rarity', color);
  return el;
}

/** Tiny round portrait of a unit (gear owner chips, formation hints). */
export function unitMini(unitId, { size = 28 } = {}) {
  const u = UNIT_MAP[unitId];
  if (!u) return null;
  return h('span.mb-unit-mini', { style: { width: `${size}px`, height: `${size}px` }, title: u.name }, svgEl(cardArtSVG(u, { variant: 'thumb' }), 'mb-unit-mini-art'));
}

/**
 * One requirement line: [icon] Name — owned / required — Where to get (Teleport via item info).
 * @param {{id:string,count:number}} cost
 */
export function requirementRow({ id, count }) {
  const profile = store.profile;
  const item = getItem(id);
  const have = itemCount(profile, id);
  const ok = have >= count;
  return h(
    `div.mb-req${ok ? '.ok' : '.short'}`,
    { 'data-item': id },
    rarityTile(id, null, { size: 44 }),
    h('div.mb-req-text',
      h('div.mb-req-name', item?.name || id),
      h('div.mb-req-count', h('b', formatNumber(have)), ` / ${formatNumber(count)}`, ok ? h('span.mb-req-check', svgEl(uiIcon('check'))) : h('span.mb-req-need', ` need ${formatNumber(count - have)}`))),
    id === 'coins' && ok ? null : button(ok ? 'Where' : 'Get', { kind: ok ? 'ghost' : 'yellow', small: true, icon: 'teleport', onClick: () => showItemInfo(id) }),
  );
}

/**
 * Compact cost line: [icon] have/need per item; tapping an item opens its sources (Teleport).
 * @param {{id:string,count:number}[]} costs
 */
export function costChips(costs) {
  const profile = store.profile;
  return h('div.mb-cost-chips', costs.map(({ id, count }) => {
    const have = itemCount(profile, id);
    const ok = have >= count;
    return h(`button.mb-cost-chip${ok ? '' : '.short'}`, { title: getItem(id)?.name || id, 'data-item': id, onclick: () => showItemInfo(id) },
      svgEl(itemIcon(id), 'mb-cost-icon'),
      h('span', h('b', formatNumber(have)), h('small', ` / ${formatNumber(count)}`)));
  }));
}

/** Column of requirement rows. */
export function requirementList(costs) {
  return h('div.mb-req-list', costs.map((c) => requirementRow(c)));
}

/**
 * Gear piece card: icon, name, +level, main stat, substats, owner and lock.
 * @param {object} gear GearInstance
 * @param {{ onClick?: Function, compact?: boolean, highlightSubs?: number[], selected?: boolean, actions?: Node }} [opts]
 */
export function gearCard(gear, { onClick = null, compact = false, highlightSubs = [], selected = false, actions = null } = {}) {
  const r = ITEM_RARITIES[gear.rarity];
  const owner = gear.equippedBy ? UNIT_MAP[gear.equippedBy] : null;
  const tag = onClick ? 'button' : 'div';
  return h(
    `${tag}.mb-gear${compact ? '.compact' : ''}${selected ? '.selected' : ''}`,
    { style: cssVars({ '--rarity': r?.color || '#999' }), onclick: onClick, 'data-gear': gear.uid },
    h('div.mb-gear-head',
      svgEl(gearIcon(gear.slot, gear.rarity), 'mb-gear-icon'),
      h('div.mb-gear-title',
        h('div.mb-gear-name', gear.name),
        h('div.mb-gear-meta', rarityBadge(gear.rarity), h('span.mb-gear-slot', GEAR_SLOTS[gear.slot]?.name || gear.slot), h('span.mb-gear-level', `+${gear.level}`))),
      gear.locked ? h('span.mb-gear-lock', { title: 'Locked' }, svgEl(uiIcon('lock'))) : null),
    h('div.mb-gear-main', describeStat(gear.main.stat, gear.main.value)),
    compact && !gear.subs.length ? null : h('ul.mb-gear-subs',
      gear.subs.length
        ? gear.subs.map((s, i) => h(`li${highlightSubs.includes(i) ? '.hl' : ''}`, describeStat(s.stat, s.value), s.upgrades ? h('span.mb-sub-up', '▲'.repeat(s.upgrades)) : null))
        : h('li.muted', 'No substats (Common)')),
    owner ? h('div.mb-gear-owner', unitMini(owner.id, { size: 22 }), h('span', owner.name)) : null,
    actions,
  );
}

/** Short "how to get her" line for locked units. */
export function howToGet(unit) {
  const a = unit.acquisition || {};
  if (a.type === 'starter') return { short: 'Starter', long: 'Part of your starting team.' };
  if (a.type === 'free') return { short: `Free after ${a.afterStage}`, long: a.note || `Joins for free after clearing stage ${a.afterStage}.`, stageId: a.afterStage };
  return { short: 'Recruit', long: unit.rarity === 'SSR' ? 'Recruit (1.5%, pity at 90) or spark her with 200 Recruit Points.' : 'Recruit her in the gacha.' };
}

/**
 * Crosspath rule diagram (BTD6-style): one path to tier 5, a second to tier 2, the third locked.
 * @param {{ labels?: string[] }} [opts] optional path names
 */
export function crosspathDiagram({ labels = ['Main path', 'Second path', 'Third path'] } = {}) {
  const rowsDef = [
    { tiers: 5, max: 5, note: 'One path may go all the way to tier 5', cls: 'main' },
    { tiers: 2, max: 2, note: 'A second path may reach tier 2', cls: 'cross' },
    { tiers: 0, max: 0, note: 'The third path stays locked', cls: 'locked' },
  ];
  return h('div.mb-crosspath',
    rowsDef.map((r, i) => h(`div.mb-cp-row.${r.cls}`,
      h('div.mb-cp-label', labels[i] || ''),
      h('div.mb-cp-pips', [1, 2, 3, 4, 5].map((t) => h(`span.mb-cp-pip${t <= r.tiers ? '.on' : ''}${t > r.max ? '.cap' : ''}`, t <= r.tiers ? String(t) : r.cls === 'locked' ? '' : ''))),
      h('div.mb-cp-note', r.cls === 'locked' ? svgEl(uiIcon('lock'), 'mb-cp-lock') : null, r.note))),
    h('div.mb-cp-foot', 'Valid: 5-2-0, 2-0-4, 0-3-2 · Not allowed: 3-3-0, 1-1-1'));
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const ALL_TAB = { id: 'all', name: 'All', desc: 'Everything you own.' };
const SORTS = { rarityDesc: 'Rarity ↓', rarityAsc: 'Rarity ↑', count: 'Count', name: 'Name' };
const state = { tab: 'all', sort: 'rarityDesc', rarity: null, gearSlot: null };

function ownedItems(tabId) {
  const profile = store.profile;
  return Object.values(ITEMS)
    .filter((i) => (tabId === 'all' || i.tab === tabId) && itemCount(profile, i.id) > 0)
    .map((i) => i.id);
}

function sortItems(ids) {
  const profile = store.profile;
  const list = state.rarity ? ids.filter((id) => ITEMS[id].rarity === state.rarity) : ids.slice();
  switch (state.sort) {
    case 'rarityAsc': return list.sort((a, b) => -compareItemsByRarity(a, b));
    case 'count': return list.sort((a, b) => itemCount(profile, b) - itemCount(profile, a));
    case 'name': return list.sort((a, b) => ITEMS[a].name.localeCompare(ITEMS[b].name));
    default: return list.sort(compareItemsByRarity);
  }
}

const CATEGORY_TITLES = {
  book: 'Books', material: 'Materials', crown: 'Crowns', fragment: 'Star Fragments', dice: 'Reroll items',
  gearbox: 'Gear boxes', ticket: 'Tickets', token: 'Tokens', currency: 'Currency',
};

/**
 * Splits an already-sorted id list into display groups: one per category, and materials
 * further split by family (with the girls who use that family).
 * @param {string[]} ids
 * @returns {{ key: string, title: string, ids: string[], color?: string, users?: string[] }[]}
 */
function groupItems(ids) {
  const groups = new Map();
  for (const id of ids) {
    const it = ITEMS[id];
    const fam = it.category === 'material' ? it.family : null;
    const key = fam ? `material:${fam}` : it.category;
    if (!groups.has(key)) {
      const famDef = fam ? MATERIAL_FAMILIES[fam] : null;
      groups.set(key, {
        key,
        title: famDef ? `${famDef.name}` : CATEGORY_TITLES[it.category] || it.category,
        color: famDef?.color || null,
        users: fam ? UNITS.filter((u) => u.materialFamily === fam).map((u) => u.id) : null,
        order: (ITEM_CATEGORIES[it.category]?.order ?? 9) * 10 + (fam ? Object.keys(MATERIAL_FAMILIES).indexOf(fam) : 0),
        ids: [],
      });
    }
    groups.get(key).ids.push(id);
  }
  return [...groups.values()].sort((a, b) => a.order - b.order);
}

function chipRow(options, active, onPick, cls = '') {
  return h(`div.mb-chips${cls}`, options.map((o) => h(`button.mb-chip${o.id === active ? '.on' : ''}`, { onclick: () => onPick(o.id), style: o.color ? cssVars({ '--chip': o.color }) : null }, o.icon ? svgEl(o.icon, 'mb-chip-icon') : null, o.label)));
}

function openGearModal(gear, rerender) {
  const profile = store.profile;
  const actions = [];
  const body = h('div.mb-gear-modal',
    gearCard(gear),
    h('p.muted', `Enhance and reroll from a student's Equipment tab. Max level +${MAX_GEAR_LEVEL}.`),
    gear.equippedBy ? null : h('div.mb-salvage-preview', h('div.mb-sub-title', 'Salvage returns'), h('div.reward-row', salvageRewards(gear).map((r) => rarityTile(r.id, r.count, { size: 48 })))),
  );
  actions.push({ label: gear.locked ? 'Unlock' : 'Lock', kind: 'ghost', onClick: (close) => { setGearLocked(profile, gear.uid, !gear.locked); store.commit('gear-lock'); close(); rerender(); } });
  if (gear.equippedBy) actions.push({ label: `Open ${UNIT_MAP[gear.equippedBy]?.name || 'owner'}`, kind: 'primary', onClick: (close) => { close(); navigate('student', { id: gear.equippedBy, tab: 'gear' }); } });
  else {
    actions.push({
      label: 'Salvage', kind: 'danger', onClick: async (close) => {
        if (gear.locked) { toast('Unlock this gear before salvaging it.', 'bad'); return; }
        close();
        if (!(await confirmDialog(`Salvage ${gear.name}? This cannot be undone.`, { title: 'Salvage gear', ok: 'Salvage' }))) return;
        const res = salvageGear(profile, gear.uid);
        if (!res.ok) { toast(res.error === 'locked' ? 'Gear is locked.' : 'Cannot salvage equipped gear.', 'bad'); return; }
        store.commit('gear-salvage');
        toast(`Salvaged: ${res.rewards.map((r) => `${getItem(r.id)?.name} ×${formatNumber(r.count)}`).join(', ')}`, 'good');
        rerender();
      },
    });
  }
  actions.push({ label: 'Close', kind: 'ghost' });
  modal({ title: 'Gear', body, actions });
}

function openBoxes(itemId, n, rerender) {
  const res = openGearBox(store.profile, itemId, createRng(Date.now() ^ Math.floor(performance.now() * 1000)), n);
  if (!res.ok) { toast('Could not open the box.', 'bad'); return; }
  store.commit('gearbox-open');
  modal({
    title: `${getItem(itemId)?.name} ×${n}`,
    wide: res.gear.length > 2,
    body: h('div.mb-gear-grid.mb-pop', res.gear.map((g) => gearCard(g))),
    actions: [{ label: 'Nice!', kind: 'yellow' }],
  });
  rerender();
}

function renderGearSection(host, rerender) {
  const profile = store.profile;
  const boxes = Object.values(ITEMS).filter((i) => i.category === 'gearbox' && itemCount(profile, i.id) > 0).sort((a, b) => compareItemsByRarity(a.id, b.id));
  if (boxes.length) {
    host.appendChild(h('section.mb-section',
      h('h3.mb-h', 'Gear boxes'),
      h('div.mb-box-row', boxes.map((b) => {
        const n = itemCount(profile, b.id);
        return h('div.mb-box', rarityTile(b.id, n, { size: 64 }), h('div.mb-box-name', b.name),
          h('div.row', button('Open', { kind: 'yellow', small: true, onClick: () => openBoxes(b.id, 1, rerender) }), n > 1 ? button(`×${Math.min(10, n)}`, { kind: 'ghost', small: true, onClick: () => openBoxes(b.id, Math.min(10, n), rerender) }) : null));
      }))));
  }
  const gear = gearList(profile, { slot: state.gearSlot });
  const slotOpts = [{ id: null, label: 'All slots' }, ...Object.entries(GEAR_SLOTS).map(([id, s]) => ({ id, label: s.name, icon: gearIcon(id, 'rare') }))];
  host.appendChild(h('section.mb-section',
    h('div.mb-section-head', h('h3.mb-h', `Gear (${Object.keys(profile.gear).length})`), chipRow(slotOpts, state.gearSlot, (id) => { state.gearSlot = id; rerender(); })),
    gear.length
      ? h('div.mb-gear-grid', gear.map((g) => gearCard(g, { onClick: () => openGearModal(g, rerender) })))
      : emptyState('No gear yet', 'Gear drops as boxes from Bounty · Workshop Yard and bosses, and the Mall sells boxes for tokens.', button('Go to Bounty', { kind: 'yellow', icon: 'bounty', onClick: () => navigate('bounty') }))));
}

/** Designed empty state block. */
export function emptyState(title, text, action = null, icon = 'backpack') {
  return h('div.mb-empty', h('div.mb-empty-art', svgEl(uiIcon(icon))), h('div.mb-empty-title', title), h('p.muted', text), action);
}

export function render(root, params = {}) {
  if (params.tab && (params.tab === 'all' || BACKPACK_TABS.some((t) => t.id === params.tab))) state.tab = params.tab;
  const { el, body } = screen('Backpack');
  el.classList.add('mb-screen');
  root.appendChild(el);

  const tabsEl = h('nav.mb-tabs');
  const toolbar = h('div.mb-toolbar');
  const content = h('div.mb-bp-content');
  put(body, tabsEl, toolbar, content);

  const rerender = () => {
    const profile = store.profile;
    const tabsList = [ALL_TAB, ...BACKPACK_TABS];
    clear(tabsEl);
    for (const t of tabsList) {
      const count = t.id === 'equipment' ? ownedItems(t.id).length + Object.keys(profile.gear).length : ownedItems(t.id).length;
      tabsEl.appendChild(h(`button.mb-tab${t.id === state.tab ? '.active' : ''}`, { 'data-testid': `tab-${t.id}`, onclick: () => { state.tab = t.id; history.replaceState(null, '', `#/backpack?tab=${t.id}`); rerender(); } }, t.name, h('span.mb-tab-count', String(count))));
    }
    const activeTab = tabsEl.querySelector('.mb-tab.active');
    requestAnimationFrame(() => activeTab?.scrollIntoView?.({ block: 'nearest', inline: 'center' }));
    clear(toolbar);
    const rarityOpts = [{ id: null, label: 'Any rarity' }, ...ITEM_RARITY_ORDER.map((r) => ({ id: r, label: ITEM_RARITIES[r].name, color: ITEM_RARITIES[r].color }))];
    put(toolbar,
      h('div.mb-tab-desc', (tabsList.find((t) => t.id === state.tab) || ALL_TAB).desc),
      h('div.mb-toolbar-row',
        chipRow(rarityOpts, state.rarity, (id) => { state.rarity = id; rerender(); }, '.mb-chips-rarity'),
        h('label.mb-select', svgEl(uiIcon('sort'), 'mb-select-icon'),
          h('select', { onchange: (e) => { state.sort = e.target.value; rerender(); } }, Object.entries(SORTS).map(([id, label]) => h('option', { value: id, selected: id === state.sort }, label))))),
    );

    clear(content);
    content.classList.remove('mb-fade');
    void content.offsetWidth;
    content.classList.add('mb-fade');
    const ids = sortItems(ownedItems(state.tab)).filter((id) => state.tab !== 'equipment' || ITEMS[id].category !== 'gearbox');
    if (ids.length) {
      for (const g of groupItems(ids)) {
        content.appendChild(h('section.mb-item-group', { style: g.color ? cssVars({ '--grp': g.color }) : null },
          h('div.mb-item-group-head',
            h('h3.mb-h', g.title),
            h('span.mb-item-group-count', String(g.ids.length)),
            g.users?.length ? h('div.mb-item-group-users', h('span.muted', 'Used by'), g.users.map((id) => unitMini(id, { size: 24 }))) : null),
          h('div.mb-item-grid', g.ids.map((id) => h('div.mb-item-cell',
            rarityTile(id, itemCount(profile, id), { size: 72 }),
            h('div.mb-item-name', { style: cssVars({ '--rarity': ITEM_RARITIES[ITEMS[id].rarity].color }) }, ITEMS[id].name))))));
      }
    } else if (state.tab !== 'equipment') {
      content.appendChild(emptyState(state.rarity ? 'Nothing of that rarity' : 'Nothing here yet', state.tab === 'tickets' ? 'Recruit tickets come from the login calendar, weekly commissions and the Mall.' : 'Clear stages and Bounty arenas to fill your backpack.', button('Go to Mission', { kind: 'yellow', icon: 'map', onClick: () => navigate('campaign') })));
    }
    if (state.tab === 'equipment') renderGearSection(content, rerender);
  };
  rerender();
  // 'select-ticket': using an SSR Select Ticket from here must drop its tile at once, not on re-entry
  const off = store.on('change', (e) => { if (e?.reason === 'replace' || e?.reason === 'select-ticket') rerender(); });
  return () => off();
}

