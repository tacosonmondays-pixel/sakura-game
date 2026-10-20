// Backpack (owner: meta-b). Items organised by CATEGORY (CONTRACTS §12): Enhancement, Awakening,
// Equipment, Tickets, Tokens & Currency (+ All). Rarity is a sort/filter. Tapping an item opens the
// shared item info (sources + Teleport). The Equipment tab also lists real gear and gear boxes.
//
// Also exports small shared pieces used by other meta-b screens: gearCard, requirementRow,
// requirementList, unitMini.
import '../styles/meta-b.css';
import { h, clear, screen, svgEl, button, itemTile, showItemInfo, modal, toast, confirmDialog } from '../components.js';
import { store } from '../../core/store.js';
import { navigate } from '../router.js';
import { createRng } from '../../core/rng.js';
import { formatNumber } from '../../core/util.js';
import { BACKPACK_TABS, ITEMS, ITEM_CATEGORIES, getItem, compareItemsByRarity } from '../../data/items.js';
import { ITEM_RARITIES, ITEM_RARITY_ORDER, GEAR_SLOTS, MATERIAL_FAMILIES } from '../../data/types.js';
import { UNITS, UNIT_MAP } from '../../data/units.js';
import { itemCount } from '../../systems/inventory.js';
import { gearList, salvageGear, salvageRewards, openGearBox, GEAR_BAG_MAX, OPEN_BATCH_MAX, gearCount } from '../../systems/gear.js';
import { gearIcon, uiIcon, itemIcon } from '../../art/icons.js';
import { applyGearFilter } from '../../systems/gearFilter.js';
import { salvageBlock, salvagePreview, salvageMany } from '../../systems/salvage.js';
import { gearFilterBar, gearFilterFor } from '../gearFilterBar.js';
import { portraitHTML } from '../../art/portraits.js';
import { isUR } from '../rarity.js';
import { boxSummary, SUMMARY_ABOVE } from '../gearSummary.js';
import { gearCard, gearActions, pickGearFor, rainbowBoxModal } from '../gearUr.js';

/** Gear cards drawn per page in the Equipment tab. */
const GEAR_PAGE = 200;
import '../styles/achievements.css'; // the gear summary

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
  // a fully awakened SSR (UR, display only) gets a still rainbow edge
  return h(`span.mb-unit-mini${isUR(u, store.profile) ? '.is-ur' : ''}`, { style: { width: `${size}px`, height: `${size}px` }, title: u.name }, svgEl(portraitHTML(u, 'thumb'), 'mb-unit-mini-art'));
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

/** Gear piece card (rainbow UR, ✦ marks, clubs): src/ui/gearUr.js. */
export { gearCard };

/** Short "how to get her" line for locked units. */
export function howToGet(unit) {
  const a = unit.acquisition || {};
  if (a.type === 'starter') return { short: 'Starter', long: 'Part of your starting team.' };
  if (a.type === 'free') return { short: `Free after ${a.afterStage}`, long: a.note || `Joins for free after clearing stage ${a.afterStage}.`, stageId: a.afterStage };
  return { short: 'Recruit', long: unit.rarity === 'SSR' ? 'Recruit (1.5%, pity at 90) or spark her with 200 Recruit Points.' : 'Recruit her in the gacha.' };
}

/**
 * Crosspath rule diagram: one path to tier 5, a second to tier 2, the third locked.
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
    h('div.mb-cp-foot', 'Valid: 5-2-0, 2-0-4, 0-3-2 · Not allowed: 3-3-0, 1-1-1 · Each tier 5: one girl per path'));
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const ALL_TAB = { id: 'all', name: 'All', desc: 'Everything you own.' };
const SORTS = { rarityDesc: 'Rarity ↓', rarityAsc: 'Rarity ↑', count: 'Count', name: 'Name' };
// pick: null, or the Set of gear uids ticked for multi-salvage while "Multi-salvage" is on
const state = { tab: 'all', sort: 'rarityDesc', rarity: null, gearSlot: null, pick: null };

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
  // spare pieces can be enhanced, awakened, stitched, rerolled and clubbed here too (gear-awaken R21)
  let m = null;
  const bodyEl = h('div.mb-gear-modal');
  const draw = () => {
    const g = profile.gear[gear.uid];
    clear(bodyEl);
    if (!g) return;
    put(bodyEl,
      gearCard(g),
      gearActions(g, { onChange: () => { draw(); rerender(); } }),
      g.equippedBy ? null : h('div.mb-salvage-preview', h('div.mb-sub-title', 'Salvage returns'), h('div.reward-row', salvageRewards(g, profile).map((r) => rarityTile(r.id, r.count, { size: 48 })))));
  };
  draw();
  const actions = [];
  if (gear.equippedBy) actions.push({ label: `Open ${UNIT_MAP[gear.equippedBy]?.name || 'owner'}`, kind: 'primary', onClick: (close) => { close(); navigate('student', { id: gear.equippedBy, tab: 'gear' }); } });
  else {
    actions.push({
      label: 'Salvage', kind: 'danger', onClick: async (close) => {
        const g = profile.gear[gear.uid];
        if (!g) { close(); return; }
        if (g.locked) { toast('Unlock this gear before salvaging it.', 'bad'); return; }
        close();
        if (!(await confirmDialog(`Salvage ${g.name}? This cannot be undone.`, { title: 'Salvage gear', ok: 'Salvage' }))) return;
        const res = salvageGear(profile, g.uid);
        if (!res.ok) { toast(res.error === 'locked' ? 'Gear is locked.' : 'Cannot salvage equipped gear.', 'bad'); return; }
        store.commit('gear-salvage');
        toast(`Salvaged: ${res.rewards.map((r) => `${getItem(r.id)?.name} ×${formatNumber(r.count)}`).join(', ')}`, 'good');
        rerender();
      },
    });
  }
  actions.push({ label: 'Close', kind: 'ghost', testid: 'gear-modal-close' });
  m = modal({ title: 'Gear', body: bodyEl, actions, wide: true });
  return m;
}

function openBoxes(itemId, n, rerender) {
  const res = openGearBox(store.profile, itemId, createRng(Date.now() ^ Math.floor(performance.now() * 1000)), n);
  if (!res.ok) {
    toast(res.error === 'bagFull' ? `Your gear bag is full (${GEAR_BAG_MAX} pieces). Salvage some gear first.` : 'Could not open the box.', res.error === 'bagFull' ? 'info' : 'bad');
    return;
  }
  store.commit('gearbox-open');
  if (res.opened < Math.min(n, OPEN_BATCH_MAX)) toast(`Opened ${res.opened}: your gear bag is full (${GEAR_BAG_MAX} pieces). The rest stay in your backpack.`, 'info', 4200);
  modal({
    title: `${getItem(itemId)?.name} ×${res.opened}`,
    wide: res.gear.length > 2,
    // a big pile (achievement boxes add up): counts, the best 6 and the list below
    body: res.gear.length > SUMMARY_ABOVE ? boxSummary(res.gear) : h('div.mb-gear-grid.mb-pop', res.gear.map((g) => gearCard(g))),
    actions: [{ label: 'Nice!', kind: 'yellow', testid: 'box-open-ok' }],
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
        // the Rainbow Gear Box opens through a slot picker into rainbow (UR) gear (ASCENSION.md §C.8): one at a
        // time, never in Open all (gearUr.js rainbowBoxModal → systems/gear.js openRainbowBox)
        if (b.pickSlot) {
          return h('div.mb-box', { 'data-testid': `box-${b.id}` }, rarityTile(b.id, n, { size: 64 }), h('div.mb-box-name', b.name),
            h('div.row', button('Open', { kind: 'yellow', small: true, testid: 'rainbow-box-open', onClick: () => rainbowBoxModal(rerender) })), h('div.mb-box-note.muted', 'Pick charm, ribbon or shoes'));
        }
        return h('div.mb-box', rarityTile(b.id, n, { size: 64 }), h('div.mb-box-name', b.name),
          h('div.row', button('Open', { kind: 'yellow', small: true, onClick: () => openBoxes(b.id, 1, rerender) }), n > 1 ? button(`×${Math.min(10, n)}`, { kind: 'ghost', small: true, onClick: () => openBoxes(b.id, Math.min(10, n), rerender) }) : null,
            n > 10 ? button(n > OPEN_BATCH_MAX ? `Open ${OPEN_BATCH_MAX}` : `Open all (${n})`, { kind: 'ghost', small: true, testid: `open-all-${b.id}`, onClick: () => openBoxes(b.id, Math.min(n, OPEN_BATCH_MAX), rerender) }) : null));
      }))));
  }
  const slotGear = gearList(profile, { slot: state.gearSlot });
  // the page's own rarity chips (top row) filter gear too: one rarity control on this tab
  const gear = applyGearFilter(slotGear, gearFilterFor('backpack', state.gearSlot, { rarity: state.rarity }));
  const slotOpts = [{ id: null, label: 'All slots' }, ...Object.entries(GEAR_SLOTS).map(([id, s]) => ({ id, label: s.name, icon: gearIcon(id, 'rare') }))];
  const pick = state.pick;
  if (pick) {
    // only what is on screen can be salvaged: a filter or slot change drops hidden picks
    const shown = new Set(gear.map((g) => g.uid));
    for (const uid of pick) if (!shown.has(uid)) pick.delete(uid);
  }
  const cards = new Map();
  const pickTools = pick ? h('div.mb-pick-tools', { 'data-testid': 'salvage-tools' }) : null;
  const pickBar = pick ? h('div.mb-salvage-bar', { 'data-testid': 'salvage-bar' }) : null;
  const refreshPick = () => {
    for (const [uid, el] of cards) {
      el.classList.toggle('selected', pick.has(uid));
      el.setAttribute('aria-pressed', pick.has(uid) ? 'true' : 'false');
    }
    const pickable = gear.filter((g) => !salvageBlock(g));
    const all = pickable.length > 0 && pickable.every((g) => pick.has(g.uid));
    clear(pickTools);
    put(pickTools,
      h('span.mb-pick-hint', 'Tap gear to pick it. Locked and equipped gear is protected.'),
      pickable.length ? button(all ? 'Clear picks' : `Select all shown (${pickable.length})`, {
        kind: 'ghost',
        small: true,
        icon: all ? 'close' : 'check',
        testid: 'salvage-select-all',
        onClick: () => {
          if (all) pick.clear();
          else for (const g of pickable) pick.add(g.uid);
          refreshPick();
        },
      }) : null);
    const pv = salvagePreview(profile, [...pick]);
    clear(pickBar);
    put(pickBar,
      h('div.mb-sv-count', { 'data-testid': 'salvage-count' }, pv.uids.length ? `${pv.uids.length} picked` : 'Nothing picked'),
      h('div.mb-sv-rewards', pv.rewards.map((r) => h('span.mb-sv-reward', { title: getItem(r.id)?.name || r.id }, svgEl(itemIcon(r.id), 'mb-sv-icon'), formatNumber(r.count)))),
      button(pv.uids.length ? `Salvage ${pv.uids.length}` : 'Salvage', { kind: 'danger', icon: 'sell', disabled: !pv.uids.length, testid: 'salvage-go', onClick: () => salvagePicked(rerender) }));
  };
  const onCard = (g) => {
    if (!pick) return openGearModal(g, rerender);
    const why = salvageBlock(g);
    if (why) {
      toast(why === 'locked' ? 'Locked gear is protected. Unlock it first to salvage it.' : `Equipped by ${UNIT_MAP[g.equippedBy]?.name || 'a student'}. Unequip it first to salvage it.`, 'bad');
      return;
    }
    if (pick.has(g.uid)) pick.delete(g.uid);
    else pick.add(g.uid);
    refreshPick();
  };
  // drawn in pages, so a very full bag never freezes the screen
  const shownGear = gear.slice(0, state.gearShow || GEAR_PAGE);
  const more = gear.length - shownGear.length;
  const grid = gear.length
    ? h(`div.mb-gear-grid${pick ? '.picking' : ''}`, shownGear.map((g) => {
      const card = gearCard(g, { onClick: () => onCard(g) });
      if (pick) {
        if (salvageBlock(g)) card.classList.add('blocked');
        else {
          card.appendChild(h('span.mb-pick-check', { 'aria-hidden': 'true' }, svgEl(uiIcon('check'))));
          cards.set(g.uid, card);
        }
      }
      return card;
    }))
    : null;
  const moreBtn = more > 0
    ? button(`Show more (${more} left)`, { kind: 'ghost', small: true, testid: 'gear-show-more', onClick: () => { state.gearShow = (state.gearShow || GEAR_PAGE) + GEAR_PAGE; rerender(); } })
    : null;
  const canSalvage = slotGear.some((g) => !salvageBlock(g));
  host.appendChild(h(`section.mb-section${pick ? '.mb-picking' : ''}`,
    h('div.mb-section-head',
      h('h3.mb-h', `Gear (${gearCount(profile)}/${GEAR_BAG_MAX})`),
      chipRow(slotOpts, state.gearSlot, (id) => { state.gearSlot = id; rerender(); }),
      pick || canSalvage ? button(pick ? 'Done' : 'Multi-salvage', {
        kind: pick ? 'primary' : 'ghost',
        small: true,
        icon: pick ? 'check' : 'sell',
        testid: 'salvage-mode',
        onClick: () => { state.pick = pick ? null : new Set(); rerender(); },
      }) : null),
    slotGear.length ? gearFilterBar({ place: 'backpack', slot: state.gearSlot, shown: gear.length, total: slotGear.length, onChange: rerender, rarity: state.rarity, onClearRarity: () => { state.rarity = null; } }) : null,
    pickTools,
    grid || (slotGear.length
      ? emptyState('No gear matches these filters', 'Try another rarity or stat, or clear the filters.')
      : emptyState('No gear yet', 'Gear drops as boxes from Bounty · Workshop Yard and bosses, and the Mall sells boxes for tokens.', button('Go to Bounty', { kind: 'yellow', icon: 'bounty', onClick: () => navigate('bounty') }))),
    moreBtn ? h('div.mb-more', moreBtn) : null,
    pickBar));
  if (pick) refreshPick();
}

/** Multi-salvage: confirm (with a warning for Mythic+ or enhanced pieces), then salvage every pick. */
async function salvagePicked(rerender) {
  const profile = store.profile;
  const pv = salvagePreview(profile, [...state.pick]);
  if (!pv.uids.length) return;
  const n = pv.uids.length;
  const names = pv.precious.slice(0, 4).map((uid) => {
    const g = profile.gear[uid];
    return `${g.name} (${ITEM_RARITIES[g.rarity]?.name || g.rarity}${g.level ? ` +${g.level}` : ''})`;
  });
  const body = h('div.mb-sv-confirm',
    h('p', `Salvage ${n} piece${n === 1 ? '' : 's'} of gear? This cannot be undone.`),
    pv.precious.length ? h('p.mb-sv-warn', { 'data-testid': 'salvage-warn' },
      h('b', `Includes ${pv.precious.length} enhanced or Mythic+ piece${pv.precious.length === 1 ? '' : 's'}: `),
      names.join(', '), pv.precious.length > names.length ? ` and ${pv.precious.length - names.length} more` : '', '.') : null,
    h('div.mb-sub-title', 'You get'),
    h('div.reward-row', pv.rewards.map((r) => rarityTile(r.id, r.count, { size: 48 }))));
  if (!(await confirmDialog(body, { title: 'Multi-salvage', ok: `Salvage ${n}`, danger: true }))) return;
  const res = salvageMany(profile, pv.uids);
  if (!res.count) {
    toast('Nothing was salvaged.', 'bad');
    return;
  }
  store.commit('gear-salvage');
  state.pick?.clear();
  toast(`Salvaged ${res.count} piece${res.count === 1 ? '' : 's'}: ${res.rewards.map((r) => `${getItem(r.id)?.name || r.id} ×${formatNumber(r.count)}`).join(', ')}`, 'good', 3200);
  rerender();
}

/** Designed empty state block. */
export function emptyState(title, text, action = null, icon = 'backpack') {
  return h('div.mb-empty', h('div.mb-empty-art', svgEl(uiIcon(icon))), h('div.mb-empty-title', title), h('p.muted', text), action);
}

export function render(root, params = {}) {
  if (params.tab && (params.tab === 'all' || BACKPACK_TABS.some((t) => t.id === params.tab))) state.tab = params.tab;
  state.pick = null;
  const { el, body } = screen('Backpack');
  el.classList.add('mb-screen');
  root.appendChild(el);

  const tabsEl = h('nav.mb-tabs');
  const toolbar = h('div.mb-toolbar');
  const content = h('div.mb-bp-content');
  put(body, tabsEl, toolbar, content);

  // keepScroll: a filter change or a salvage redraws the page where you were; a new tab starts at the top
  const rerender = (keepScroll = true) => {
    const profile = store.profile;
    const scrollTop = keepScroll === false ? 0 : body.scrollTop;
    const tabsList = [ALL_TAB, ...BACKPACK_TABS];
    clear(tabsEl);
    for (const t of tabsList) {
      const count = t.id === 'equipment' ? ownedItems(t.id).length + Object.keys(profile.gear).length : ownedItems(t.id).length;
      tabsEl.appendChild(h(`button.mb-tab${t.id === state.tab ? '.active' : ''}`, { 'data-testid': `tab-${t.id}`, onclick: () => { state.tab = t.id; state.pick = null; history.replaceState(history.state, '', `#/backpack?tab=${t.id}`); rerender(false); } }, t.name, h('span.mb-tab-count', String(count))));
    }
    const activeTab = tabsEl.querySelector('.mb-tab.active');
    // bring the active tab into view by scrolling the strip only, resting on a whole tab (no sliver)
    requestAnimationFrame(() => snapTabStrip(tabsEl, activeTab));
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
            h('div.mb-item-name', { style: cssVars({ '--rarity': ITEM_RARITIES[ITEMS[id].rarity].color }) }, ITEMS[id].name),
            ITEMS[id].usable === 'ssrSelect' ? button('Use', { kind: 'yellow', small: true, icon: 'sparkle', testid: `use-${id}`, onClick: () => import('../selectTicket.js').then((m) => m.openSelectTicket()) })
              // the Seed, the Needle and the Armband: pick a piece, then its Awaken / Stitch / club modal
              : ['gearAwaken', 'gearStitch', 'gearClub'].includes(ITEMS[id].usable) && itemCount(profile, id) > 0
                ? button('Use', { kind: 'yellow', small: true, icon: 'sparkle', testid: `use-${id}`, onClick: () => pickGearFor(id, () => { store.commit('gear-use'); rerender(); }) })
                : null)))));
      }
    } else if (state.tab !== 'equipment') {
      content.appendChild(emptyState(state.rarity ? 'Nothing of that rarity' : 'Nothing here yet', state.tab === 'tickets' ? 'Recruit tickets come from the login calendar, weekly commissions and the Mall.' : 'Clear stages and Bounty arenas to fill your backpack.', button('Go to Mission', { kind: 'yellow', icon: 'map', onClick: () => navigate('campaign') })));
    }
    if (state.tab === 'equipment') renderGearSection(content, rerender);
    body.scrollTop = scrollTop;
  };
  rerender();
  // 'select-ticket': using an SSR Select Ticket from here must drop its tile at once, not on re-entry
  const off = store.on('change', (e) => { if (e?.reason === 'replace' || e?.reason === 'select-ticket') rerender(); });
  return () => off();
}

/** Scroll a horizontal tab strip so `active` is fully visible and the strip starts on a whole tab. */
export function snapTabStrip(strip, active) {
  if (!strip || !active || !strip.clientWidth) return;
  const base = strip.getBoundingClientRect().left - strip.scrollLeft;
  const left = (t) => t.getBoundingClientRect().left - base;
  const pad = parseFloat(getComputedStyle(strip).paddingLeft) || 0;
  const need = left(active) + active.offsetWidth + pad - strip.clientWidth;
  if (need <= 0) {
    strip.scrollLeft = 0;
    return;
  }
  const first = [...strip.children].find((t) => left(t) - pad >= need);
  strip.scrollLeft = first ? left(first) - pad : need;
}
