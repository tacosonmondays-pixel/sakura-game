// Backpack (owner: meta-b). Items organised by CATEGORY (CONTRACTS §12): Enhancement, Awakening,
// Equipment, Tickets, Tokens & Currency (+ All). Rarity is a filter. Tapping an item opens the item sheet
// (src/ui/itemSheet.js: sources with Go, Use, Craft Room).
//
// UI v2 menus M2 (docs/specs/UI_V2_MENUS.md §5 M2, docs/specs/UI_DIRECTION.md §6.4, the Ink & Paper kit):
//   - one-word rail ALL · ENHANCE · AWAKEN · GEAR · TICKETS · TOKENS (kit rail(); red dots, never counts; it fits at
//     844 with no sideways scroll; the tab ids and their test ids are the old ones);
//   - a toolbar of secondary buttons: Filter · Sort on the item tabs; Supplies ▸ · Filter · Sort · Salvage (danger) on
//     GEAR, the capacity only from 90 % full;
//   - GEAR opens on the gear itself: a grid of ~96 px gear tiles (src/ui/gearTile.js: +level bottom right, main stat
//     icon top right, wearer face bottom left, the 5.6 rarity ladder with UR's rainbow), one number a tile. Boxes, dice
//     and the gear tools moved into the Supplies sheet; the four dropdowns and the chips into the Filter sheet;
//   - salvage mode: the toolbar turns into Select all / Done, a tile shows its main stat value, picks wear the kit's
//     selected-tile marks, and an ink salvage bar stays at the bottom.
// Styles: src/ui/styles/v2-backpack.css (every rule under body.ui-day).
//
// Also exports small shared pieces used by other meta-b screens: put, cssVars, rarityTile, unitMini, howToGet,
// crosspathDiagram, emptyState, gearCard.
import { unitClass } from '../../data/banners.js'; // [banners] howToGet: held, LR Banner, Spotlight
import '../styles/meta-b.css';
import '../styles/v2-backpack.css';
import { h, clear, screen, svgEl, button, itemTile, modal, toast, confirmDialog } from '../components.js';
import { rail, secondaryBtn, inkBtn, ico, lbl, num, fillIn } from '../kit.js';
import { openSheet } from '../sheet.js';
import { tabSwap } from '../motion.js';
import { lineGlyph } from '../lineGlyphs.js';
import { pickMarks } from '../pickMarks.js';
import { fmtNum } from '../format.js';
import { store } from '../../core/store.js';
import { navigate } from '../router.js';
import { createRng } from '../../core/rng.js';
import { formatNumber } from '../../core/util.js';
import { BACKPACK_TABS, ITEMS, ITEM_CATEGORIES, getItem, compareItemsByRarity } from '../../data/items.js';
import { ITEM_RARITIES, ITEM_RARITY_ORDER, MATERIAL_FAMILIES } from '../../data/types.js';
import { SHOWN_SLOTS, slotName } from '../../data/gearSlots.js';
import { UNIT_MAP } from '../../data/units.js';
import { itemCount } from '../../systems/inventory.js';
import { workbenchReady } from '../../systems/workbench.js';
import { gearList, salvageGear, salvageRewards, openGearBox, GEAR_BAG_MAX, OPEN_BATCH_MAX, gearCount } from '../../systems/gear.js';
import { gearIcon, uiIcon, itemIcon } from '../../art/icons.js';
import { applyGearFilter, activeGearFilters, GEAR_SORTS } from '../../systems/gearFilter.js';
import { salvageBlock, salvagePreview, salvageMany } from '../../systems/salvage.js';
import { loadoutUseText } from '../../systems/teams.js';
import { gearFilterBar, gearFilterFor, loadGearFilter, saveGearFilter } from '../gearFilterBar.js';
import { gearTile } from '../gearTile.js';
import { openItemSheet } from '../itemSheet.js';
import { portraitHTML } from '../../art/portraits.js';
import { isUR } from '../rarity.js';
import { boxSummary, SUMMARY_ABOVE } from '../gearSummary.js';
import { gearCard, gearActions, pickGearFor, rainbowBoxModal } from '../gearUr.js';
import { openPieceSheet } from '../girlGear.js';
import '../styles/achievements.css'; // the gear summary

/** Gear tiles drawn per page in the Equipment tab. */
const GEAR_PAGE = 200;
/** The capacity shows in the toolbar only from this share of the bag (P7: hide a capacity far from full). */
const CAP_SHOW = 0.9;

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

/** Gear piece card (rainbow UR, ✦ marks, clubs): src/ui/gearUr.js. */
export { gearCard };

/** Short "how to get her" line for locked units. */
export function howToGet(unit) {
  const a = unit.acquisition || {};
  if (a.type === 'starter') return { short: 'Starter', long: 'Part of your starting team.' };
  if (a.type === 'free') return { short: `Free after ${a.afterStage}`, long: a.note || `Joins for free after clearing stage ${a.afterStage}.`, stageId: a.afterStage };
  // [banners] where she can be pulled (BANNERS §B): LR units only on their LR Banner, premium SSRs on their Spotlights
  const cls = unitClass(unit.id);
  if (cls === 'held') return { short: 'Coming soon', long: 'She joins the academy in a later update.' };
  if (cls === 'legend') return { short: 'LR Banner', long: 'LR unit: recruit her on her own LR Banner (Legend Promise at 300). She cannot be sparked.' };
  if (unit.rarity === 'SSR' && cls === 'premium') return { short: 'Spotlight', long: `Recruit her on her ${unit.kind === 'hero' ? 'Guardian' : 'Student'} Spotlight (1.0%), or spark her there with 200 Recruit Points.` };
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

/** Designed empty state block (the girl page and Formation use it too). */
export function emptyState(title, text, action = null, icon = 'backpack') {
  return h('div.mb-empty', h('div.mb-empty-art', svgEl(uiIcon(icon))), h('div.mb-empty-title', title), h('p.muted', text), action);
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/** A line glyph as icon markup for the kit's ico() / rail() (the Backpack's day surface). */
const LG = (name) => lineGlyph(name, '', { kitSize: false });

/** The one-word rail (§6.4): the same tab ids as BACKPACK_TABS, shorter words, a line glyph each. */
const TAB_WORDS = {
  all: ['All', 'grid'], enhancement: ['Enhance', 'level'], awakening: ['Awaken', 'star'], equipment: ['Gear', 'shield'], tickets: ['Tickets', 'ticket'], tokens: ['Tokens', 'coin'],
};
const TAB_IDS = ['all', ...BACKPACK_TABS.map((t) => t.id)];

/** Item tab sorts (the Sort sheet). */
const SORTS = { rarityDesc: 'Rarest first', rarityAsc: 'Commonest first', count: 'Most owned', name: 'Name' };
// pick: null, or the Set of gear uids ticked for multi-salvage while salvage mode is on
const state = { tab: 'all', sort: 'rarityDesc', rarity: null, gearSlot: null, pick: null, gearShow: 0 };

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
  book: 'Books', material: 'Materials', crown: 'Crowns', fragment: 'Star Fragments', dice: 'Gear tools',
  gearbox: 'Gear boxes', ticket: 'Tickets', token: 'Tokens', event: 'Event tokens', currency: 'Currency',
};

/**
 * Splits an already-sorted id list into display groups: one per category, and materials further split by family.
 * @param {string[]} ids
 * @returns {{ key: string, title: string, ids: string[] }[]}
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
        order: (ITEM_CATEGORIES[it.category]?.order ?? 9) * 10 + (fam ? Object.keys(MATERIAL_FAMILIES).indexOf(fam) : 0),
        ids: [],
      });
    }
    groups.get(key).ids.push(id);
  }
  return [...groups.values()].sort((a, b) => a.order - b.order);
}

/** The gear tools a piece is picked for (Seed, Needle, Armband). */
const GEAR_TOOLS = ['gearAwaken', 'gearStitch', 'gearClub'];

/** A gear box that can be opened now (the Supplies dot and GEAR's tab dot). */
function boxReady(profile) {
  if (gearCount(profile) >= GEAR_BAG_MAX) return false;
  return Object.values(ITEMS).some((i) => i.category === 'gearbox' && itemCount(profile, i.id) > 0);
}

/** A kit tool button (secondary, 44 px), with an optional red dot and an "on" state (a filter is set). */
function toolBtn(label, { icon = null, testid = null, onClick, dot = false, on = false, title = null, cls = '', narrow = false } = {}) {
  const b = secondaryBtn(label, { icon, testid, onClick, title, cls: `bp-tool${on ? '.on' : ''}${narrow ? '.bp-icon-narrow' : ''}${cls ? `.${cls}` : ''}` });
  if (dot) b.append(h('i.ui-dot.bp-tool-dot', { 'aria-hidden': 'true' }));
  // narrow: an upright phone shows the glyph only (v2-backpack.css), so the word is its accessible name
  if (dot || narrow) b.setAttribute('aria-label', dot ? `${label} (a box can be opened)` : `${title && title !== label ? `${title}: ` : ''}${label}`);
  return b;
}

/** Salvage on an upright phone: its glyph only (§6.4 "Salvage (icon, danger)"), the word in its aria-label. */
function narrowed(b) {
  b.classList.add('bp-icon-narrow');
  b.setAttribute('aria-label', b.textContent.trim());
  return b;
}

/** A row of kit options (the Filter and Sort sheets): `.ui-opt` parallelograms, the picked one ink with a pink bar. */
function optRow(options, active, onPick, prefix) {
  return h('div.bp-opts', { role: 'radiogroup' }, options.map((o) => h(`button.ui-opt.bp-opt${(o.id ?? null) === (active ?? null) ? '.on' : ''}`, {
    type: 'button', role: 'radio', 'aria-checked': (o.id ?? null) === (active ?? null) ? 'true' : 'false',
    'data-testid': `${prefix}-${o.id ?? 'any'}`, onclick: () => onPick(o.id ?? null),
  }, o.icon ? h('span.bp-opt-ic', { 'aria-hidden': 'true', html: o.icon }) : null, h('span', o.label))));
}

/** A section of a sheet: a caps kicker over its content. */
const sheetSec = (title, ...kids) => h('section.bp-ssec', h('h3.bp-kick', title), ...kids);

const rarityOpts = () => [{ id: null, label: 'Any' }, ...ITEM_RARITY_ORDER.map((r) => ({ id: r, label: ITEM_RARITIES[r].name }))];

/** Item tabs: the Filter sheet (rarity). */
function openItemFilter(rerender) {
  const bodyEl = h('div.bp-fsheet');
  const draw = () => fillIn(bodyEl, sheetSec('Rarity', optRow(rarityOpts(), state.rarity, (id) => { state.rarity = id; draw(); rerender(); }, 'bp-rarity')));
  draw();
  return openSheet({ title: 'Filter', body: bodyEl, testid: 'item-filter-sheet', cls: 'bp-sheet' });
}

/** The Sort sheet: one choice, then it closes. */
function openSortSheet(options, active, onPick, prefix) {
  let sheet = null;
  const bodyEl = h('div.bp-fsheet', optRow(Object.entries(options).map(([id, label]) => ({ id, label })), active, (id) => { sheet?.close(); onPick(id); }, prefix));
  sheet = openSheet({ title: 'Sort', body: bodyEl, testid: 'sort-sheet', cls: 'bp-sheet' });
  return sheet;
}

function openGearModal(gear, rerender) {
  // [ui-ink] UI v2 M3: the girl page's piece sheet in its spare mode (src/ui/girlGear.js openPieceSheet): enhance, awaken,
  // stitch, reroll, club, lock and salvage, or open the girl who wears it; the Backpack only opens it
  return openPieceSheet(gear, { onChange: rerender });
}

/** Open `n` boxes; `after` redraws whatever is open (the Supplies sheet, the grid). */
function openBoxes(itemId, n, after) {
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
  after();
}

/** The Supplies sheet (§6.4): the gear boxes (Open, Open ×10, Open all) and the gear tools, one line each. */
function openSupplies(rerender) {
  const profile = store.profile;
  const bodyEl = h('div.bp-supplies');
  let sheet = null;
  const row = (it, { line = null, acts = [], testid = null } = {}) => h('div.bp-srow', { 'data-testid': testid },
    rarityTile(it.id, itemCount(profile, it.id), { size: bigTiles() ? 72 : 56, onClick: () => openItemSheet(it.id, { onChange: () => { draw(); rerender(); } }) }),
    h('div.bp-srow-txt', h('b.bp-srow-name', it.name), line ? h('span.bp-srow-line', line) : null),
    acts.length ? h('div.bp-srow-acts', acts) : null);
  const draw = () => {
    const after = () => { draw(); rerender(); };
    const boxes = Object.values(ITEMS).filter((i) => i.category === 'gearbox' && itemCount(profile, i.id) > 0).sort((a, b) => compareItemsByRarity(a.id, b.id));
    const tools = Object.values(ITEMS).filter((i) => i.category === 'dice' && itemCount(profile, i.id) > 0).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    const boxRows = boxes.map((b) => {
      const n = itemCount(profile, b.id);
      // the Rainbow Gear Box opens through a slot picker into rainbow (UR) gear (ASCENSION.md §C.8): one at a time,
      // never in Open all (gearUr.js rainbowBoxModal → systems/gear.js openRainbowBox); its moment needs the screen
      if (b.pickSlot) {
        return row(b, { testid: `box-${b.id}`, line: 'Pick charm, ribbon or shoes', acts: [inkBtn('Open', { testid: 'rainbow-box-open', onClick: () => { sheet?.close(); rainbowBoxModal(rerender); } })] });
      }
      return row(b, {
        testid: `box-${b.id}`,
        acts: [
          inkBtn('Open', { testid: `box-open-${b.id}`, onClick: () => openBoxes(b.id, 1, after) }),
          n > 1 ? secondaryBtn(`Open ×${Math.min(10, n)}`, { testid: `box-open10-${b.id}`, onClick: () => openBoxes(b.id, Math.min(10, n), after) }) : null,
          n > 10 ? secondaryBtn(n > OPEN_BATCH_MAX ? `Open ${OPEN_BATCH_MAX}` : 'Open all', { testid: `open-all-${b.id}`, title: n > OPEN_BATCH_MAX ? null : `Open all ${n}`, onClick: () => openBoxes(b.id, Math.min(n, OPEN_BATCH_MAX), after) }) : null,
        ].filter(Boolean),
      });
    });
    const toolRows = tools.map((t) => row(t, {
      testid: `tool-${t.id}`,
      line: oneLine(t.desc),
      acts: GEAR_TOOLS.includes(t.usable) ? [inkBtn('Use', { testid: `use-${t.id}`, onClick: () => { sheet?.close(); pickGearFor(t.id, () => { store.commit('gear-use'); rerender(); }); } })] : [],
    }));
    fillIn(bodyEl,
      boxRows.length ? sheetSec('Gear boxes', h('div.bp-srows', boxRows)) : null,
      toolRows.length ? sheetSec('Gear tools', h('div.bp-srows', toolRows)) : null,
      !boxRows.length && !toolRows.length ? h('p.bp-desc', 'No boxes or tools yet. Bounty · Workshop Yard and bosses drop gear boxes.') : null);
  };
  draw();
  sheet = openSheet({ title: 'Supplies', body: bodyEl, testid: 'supplies-sheet', cls: 'bp-sheet' });
  return sheet;
}

/** Desktop and tablets: tiles big enough for the 13 px count floor (an item tile's count scales with it). */
const bigTiles = () => !!globalThis.matchMedia?.('(min-height: 481px)').matches;

/** The first sentence of an item's text (the Supplies sheet's one line). */
function oneLine(text) {
  const t = String(text || '').trim();
  const m = /^(.+?[.!?])(\s|$)/.exec(t);
  return m ? m[1] : t;
}

/** Equipment: the Filter sheet (rarity, slot, main stat, substat, show). */
function openGearFilter(rerender) {
  const profile = store.profile;
  const bodyEl = h('div.bp-fsheet.bp-gfsheet');
  const slotOpts = [{ id: null, label: 'All' }, ...SHOWN_SLOTS.map((id) => ({ id, label: slotName(id), icon: gearIcon(id, 'rare') }))];
  const changed = () => { draw(); rerender(); };
  const draw = () => {
    const slotGear = gearList(profile, { slot: state.gearSlot });
    const gear = applyGearFilter(slotGear, gearFilterFor('backpack', state.gearSlot, { rarity: state.rarity }));
    fillIn(bodyEl,
      sheetSec('Rarity', optRow(rarityOpts(), state.rarity, (id) => { state.rarity = id; changed(); }, 'bp-rarity')),
      sheetSec('Slot', optRow(slotOpts, state.gearSlot, (id) => { state.gearSlot = id; changed(); }, 'bp-slot')),
      gearFilterBar({
        place: 'backpack', slot: state.gearSlot, shown: gear.length, total: slotGear.length, onChange: changed, sort: false,
        rarity: state.rarity, onClearRarity: () => { state.rarity = null; state.gearSlot = null; },
      }));
  };
  draw();
  return openSheet({ title: 'Filter', body: bodyEl, testid: 'gear-filter-sheet', cls: 'bp-sheet' });
}

/** The selected marks on a gear tile, on or off (the kit's selected-tile rule: frame kept, pink chip and bar). */
function markPicked(el, on) {
  el.classList.toggle('selected', on);
  el.setAttribute('aria-pressed', on ? 'true' : 'false');
  for (const n of el.querySelectorAll(':scope > .ui-pick, :scope > .ui-pickbar')) n.remove();
  if (on) el.append(...pickMarks());
}

/** The Equipment tab's content: the toolbar (into `tools`), the grid, and the salvage bar while picking. */
function renderGear(tools, host, rerender) {
  const profile = store.profile;
  const slotGear = gearList(profile, { slot: state.gearSlot });
  // one rarity control on this page (the Filter sheet's): it filters gear too
  const filter = gearFilterFor('backpack', state.gearSlot, { rarity: state.rarity });
  const gear = applyGearFilter(slotGear, filter);
  const pick = state.pick;
  if (pick) {
    // only what is on screen can be salvaged: a filter or slot change drops hidden picks
    const shown = new Set(gear.map((g) => g.uid));
    for (const uid of pick) if (!shown.has(uid)) pick.delete(uid);
  }
  const filtersOn = activeGearFilters({ ...filter, rarity: null }) + (state.rarity ? 1 : 0) + (state.gearSlot ? 1 : 0);
  const filterBtn = toolBtn('Filter', { icon: 'filter', testid: 'bp-filter', narrow: true, on: filtersOn > 0, title: filtersOn ? 'Filters are on' : null, onClick: () => openGearFilter(rerender) });
  const total = gearCount(profile);

  const tiles = new Map();
  const pickTools = pick ? h('div.bp-picktools', { 'data-testid': 'salvage-tools' }) : null;
  const pickBar = pick ? h('div.mb-salvage-bar.bp-svbar', { 'data-testid': 'salvage-bar' }) : null;
  const refreshPick = () => {
    for (const [uid, el] of tiles) markPicked(el, pick.has(uid));
    const pickable = gear.filter((g) => !salvageBlock(g, profile));
    const all = pickable.length > 0 && pickable.every((g) => pick.has(g.uid));
    fillIn(pickTools,
      h('span.bp-hint', 'Tap gear to pick it'),
      pickable.length ? secondaryBtn(all ? 'Clear picks' : 'Select all', {
        icon: all ? 'close' : 'check',
        testid: 'salvage-select-all',
        title: all ? null : `Pick all ${pickable.length} shown`,
        cls: 'bp-tool',
        onClick: () => {
          if (all) pick.clear();
          else for (const g of pickable) pick.add(g.uid);
          refreshPick();
        },
      }) : null);
    const pv = salvagePreview(profile, [...pick]);
    fillIn(pickBar,
      h('div.mb-sv-count', { 'data-testid': 'salvage-count' }, pv.uids.length ? `${pv.uids.length} picked` : 'Nothing picked'),
      h('div.mb-sv-rewards', pv.rewards.map((r) => h('span.mb-sv-reward', { title: getItem(r.id)?.name || r.id }, svgEl(itemIcon(r.id), 'mb-sv-icon'), h('span.num', fmtNum(r.count, 'count', { detail: true }))))),
      button(pv.uids.length ? `Salvage ${pv.uids.length}` : 'Salvage', { kind: 'danger', icon: 'sell', disabled: !pv.uids.length, testid: 'salvage-go', onClick: () => salvagePicked(rerender) }));
  };
  const onTile = (g) => {
    if (!pick) return openGearModal(g, rerender);
    const why = salvageBlock(g, profile);
    if (why) {
      toast(why === 'locked' ? 'Locked gear is protected. Unlock it first to salvage it.'
        : why === 'loadout' ? `${loadoutUseText(profile, g.uid)} uses this piece. Salvage it from her page or take it out of the loadout first.`
          : `Equipped by ${UNIT_MAP[g.equippedBy]?.name || 'a student'}. Unequip it first to salvage it.`, 'bad');
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
    ? h(`div.mb-gear-grid.bp-ggrid${pick ? '.picking' : ''}`, { 'data-testid': 'gear-grid' }, shownGear.map((g) => {
      // salvage mode shows the main stat value (the owner's default: the value only where you pick)
      const tile = gearTile(g, { mainIcon: true, wearer: true, value: !!pick, cls: 'mb-gear.bp-gtile', onClick: () => onTile(g) });
      if (pick) {
        if (salvageBlock(g, profile)) {
          tile.classList.add('blocked');
          if (g.locked) tile.append(h('span.bp-lockb', { 'aria-hidden': 'true' }, ico('lock')));
        } else tiles.set(g.uid, tile);
      }
      return tile;
    }))
    : null;

  // the toolbar
  if (pick) {
    put(tools, filterBtn, pickTools, h('span.bp-gap'),
      toolBtn('Done', { icon: 'check', testid: 'salvage-mode', onClick: () => { state.pick = null; rerender(); } }));
  } else {
    const canSalvage = slotGear.some((g) => !salvageBlock(g));
    const fsort = loadGearFilter('backpack').sort;
    put(tools,
      toolBtn('Supplies', { icon: 'box', testid: 'supplies-open', dot: boxReady(profile), onClick: () => openSupplies(rerender), cls: 'bp-supplies-btn' }),
      filterBtn,
      toolBtn(GEAR_SORTS[fsort] || 'Sort', { icon: 'sort', testid: 'bp-sort', title: 'Sort', narrow: true, onClick: () => openSortSheet(GEAR_SORTS, fsort, (id) => { saveGearFilter('backpack', { ...loadGearFilter('backpack'), sort: id }); rerender(); }, 'gear-sort') }),
      h('span.bp-gap'),
      total >= GEAR_BAG_MAX * CAP_SHOW ? h('span.bp-cap', { 'data-testid': 'gear-capacity', title: 'Gear bag' }, lbl('Bag'), num(`${total}/${GEAR_BAG_MAX}`, 's')) : null,
      canSalvage ? narrowed(button('Salvage', { kind: 'danger', icon: 'sell', testid: 'salvage-mode', onClick: () => { state.pick = new Set(); rerender(); } })) : null);
  }

  const moreBtn = more > 0
    ? secondaryBtn(`Show ${Math.min(more, GEAR_PAGE)} more`, { testid: 'gear-show-more', onClick: () => { state.gearShow = (state.gearShow || GEAR_PAGE) + GEAR_PAGE; rerender(); } })
    : null;
  // salvage mode: the rail steps aside and the grid scrolls in its own window above the salvage bar, so the bar never
  // sits over a tile (v2-backpack.css .bp-picking)
  const list = pick ? h('div.bp-scroll') : host;
  put(list,
    grid || (slotGear.length
      ? bpEmpty('No gear matches these filters', 'Try another rarity or stat, or clear the filters.', secondaryBtn('Clear filters', { icon: 'close', testid: 'bp-clear-filters', onClick: () => { state.rarity = null; state.gearSlot = null; saveGearFilter('backpack', { ...loadGearFilter('backpack'), rarity: null, main: null, sub: null, status: 'all' }); rerender(); } }))
      : bpEmpty('No gear yet', 'Gear drops as boxes from Bounty · Workshop Yard and bosses, and the Mall sells boxes for tokens.', button('Go to Bounty', { kind: 'yellow', icon: 'bounty', onClick: () => navigate('bounty') }))),
    moreBtn ? h('div.bp-more', moreBtn) : null);
  if (pick) put(host, list, pickBar);
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

/** The Backpack's empty state: a kit panel with a line glyph, a title, one line and the one action that helps. */
function bpEmpty(title, text, action = null, icon = 'backpack') {
  return h('div.bp-empty', ico(icon, 'ui-ico.bp-empty-ic'), h('b.bp-empty-t', title), h('p.bp-desc', text), action);
}

/** An item tab's grid: one kicker per category (materials per family), the item tiles with their names. */
function renderItems(host, rerender) {
  const profile = store.profile;
  const ids = sortItems(ownedItems(state.tab));
  if (!ids.length) {
    host.append(bpEmpty(state.rarity ? 'Nothing of that rarity' : 'Nothing here yet', state.tab === 'tickets' ? 'Recruit tickets come from the login calendar, weekly commissions and the Mall.' : 'Clear stages and Bounty arenas to fill your backpack.',
      state.rarity ? secondaryBtn('Any rarity', { icon: 'close', testid: 'bp-clear-filters', onClick: () => { state.rarity = null; rerender(); } }) : button('Go to Mission', { kind: 'yellow', icon: 'map', onClick: () => navigate('campaign') })));
    return;
  }
  const onChange = () => rerender();
  for (const g of groupItems(ids)) {
    host.append(h('section.mb-item-group.bp-group',
      h('h3.bp-kick', g.title),
      h('div.mb-item-grid.bp-igrid', g.ids.map((id) => {
        const it = ITEMS[id];
        // a usable item keeps its own Use (the old test ids), an ink row button under its name: never a yellow
        const use = it.usable === 'ssrSelect' ? inkBtn('Use', { testid: `use-${id}`, onClick: () => import('../selectTicket.js').then((m) => m.openSelectTicket()) })
          : GEAR_TOOLS.includes(it.usable) ? inkBtn('Use', { testid: `use-${id}`, onClick: () => pickGearFor(id, () => { store.commit('gear-use'); rerender(); }) }) : null;
        return h(`div.mb-item-cell.bp-icell${use ? '.has-use' : ''}`,
          rarityTile(id, itemCount(profile, id), { size: 72, onClick: () => openItemSheet(id, { onChange }) }),
          h('div.mb-item-name', it.name),
          use);
      }))));
  }
}

export function render(root, params = {}) {
  if (params.tab && TAB_IDS.includes(params.tab)) state.tab = params.tab;
  state.pick = null;
  state.gearShow = 0;
  const { el, body } = screen('Backpack');
  el.classList.add('mb-screen', 'bp-screen');
  root.appendChild(el);

  const railHost = h('div.bp-railhost');
  const toolbar = h('div.bp-tools', { 'data-testid': 'bp-toolbar' });
  const content = h('div.bp-content');
  body.append(h('div.bp', railHost, toolbar, content));

  // keepScroll: a filter change or a salvage redraws the page where you were; a new tab starts at the top
  const rerender = (keepScroll = true) => {
    const profile = store.profile;
    const scrollTop = keepScroll === false ? 0 : body.scrollTop;
    const dots = { equipment: boxReady(profile), tickets: itemCount(profile, 'ticket_ssr_select') > 0 };
    const bar = rail(TAB_IDS.map((id) => ({
      id, label: TAB_WORDS[id][0], icon: LG(TAB_WORDS[id][1]), dot: !!dots[id],
      dotTitle: id === 'equipment' ? 'a box can be opened' : 'a ticket to use',
    })), state.tab, (id) => {
      state.tab = id;
      state.pick = null;
      state.gearShow = 0;
      history.replaceState(history.state, '', `#/backpack?tab=${id}`);
      rerender(false);
      tabSwap(content);
    }, { label: 'Backpack', cls: 'bp-rail' });
    for (const b of bar.querySelectorAll('.ui-tab')) {
      b.classList.add('mb-tab');
      b.classList.toggle('active', b.dataset.tab === state.tab);
      // each word in its own span: a narrow upright screen shows the open tab's word only (its name stays in aria-label)
      const sp = b.querySelector(':scope > span');
      for (const n of [...(sp?.childNodes || [])]) if (n.nodeType === 3 && n.nodeValue.trim()) sp.replaceChild(h('span.bp-tab-word', n.nodeValue), n);
    }
    fillIn(railHost, bar);

    clear(toolbar);
    clear(content);
    content.dataset.tab = state.tab;
    el.classList.toggle('bp-picking', !!state.pick && state.tab === 'equipment');
    if (state.tab === 'equipment') {
      renderGear(toolbar, content, rerender);
    } else {
      const rarityOn = !!state.rarity;
      // (an empty or one-item tab has nothing to filter or sort; a rarity filter that emptied it keeps its button)
      if (rarityOn || ownedItems(state.tab).length > 1) put(toolbar,
        toolBtn(rarityOn ? ITEM_RARITIES[state.rarity].name : 'Filter', { icon: 'filter', testid: 'bp-filter', narrow: true, on: rarityOn, title: rarityOn ? 'Rarity filter is on' : 'Filter by rarity', onClick: () => openItemFilter(rerender) }),
        toolBtn(SORTS[state.sort], { icon: 'sort', testid: 'bp-sort', title: 'Sort', narrow: true, onClick: () => openSortSheet(SORTS, state.sort, (id) => { state.sort = id; rerender(); }, 'item-sort') }));
      renderItems(content, rerender);
    }
    // [workbench] the club lab (timed Workbench + instant Craft Room, BANNERS §G): its one entry, on every tab but while
    // picking gear to salvage; a dot when a craft is ready (the Menu's Backpack row lights by the same rule)
    if (!(state.pick && state.tab === 'equipment')) {
      const ready = workbenchReady(profile);
      const wb = toolBtn('Workbench', { icon: 'timer', testid: 'backpack-workbench', narrow: true, dot: ready, onClick: () => navigate('workbench'), cls: 'bp-wb-btn' });
      wb.setAttribute('aria-label', ready ? 'Workbench (a craft is ready)' : 'Workbench');
      // with the other tools: before the GEAR tab's gap (so never after the danger Salvage), else after Sort
      const gap = toolbar.querySelector(':scope > .bp-gap');
      if (gap) toolbar.insertBefore(wb, gap);
      else toolbar.append(wb);
    }
    body.scrollTop = scrollTop;
  };
  rerender();
  // 'select-ticket': using an SSR Select Ticket from here must drop its tile at once, not on re-entry
  const off = store.on('change', (e) => { if (e?.reason === 'replace' || e?.reason === 'select-ticket') rerender(); });
  return () => off();
}
