// The shared 3 × 5 upgrade tree grid (docs/specs/UI_DIRECTION.md §6.1, §6.2): three path rows (path bar, name, one
// tag sticker for the path's main target) of five tier icons in a state ring — owned (filled ring + check), next
// (highlighted ring), later (plain), locked (lock-tinted, text kept at 4.5:1, never an opacity fade) — the fifth in
// the capstone frame. The girl page and the menu hold sheet show it without prices; the battle tree (M2) turns
// `prices` on (a cost button under each next cell) and puts the tier panel beside it.
//
//   const grid = treeGrid(buildTreeModel({ def }), { onPick: (cell) => … });
//   grid.update(model)            // patch states / prices in place (no rebuild)
//   grid.select(path, tier)       // highlight a cell (null clears)
//   tierPanel(cell, model, { onMore, actions })   // name · "TIER 3 · PATH" · up to 3 effect chips · price · MORE
//
// treeGridView() / tierPanelView() are the pure halves (tests/ui/treeGrid.test.js); the DOM halves only draw them.
// Cell testids stay `ut-cell-<path>-<tier>` and the panel's `ut-detail`, as the old grid had them.
import './styles/tree-grid.css';
import { h } from './dom.js';
import { fmtNum } from './format.js';
import { UPGRADE_TAGS, effectParts } from './upgradeTags.js';
import { tierIconEl, TAG_GLYPHS } from './tagChips.js';
import { ico, chip, num, lbl, moreSticker, KIT_SVG, curArt } from './kit.js';
import { ONE_PER_PATH_RULE } from './battle/rules.js';

/** The rule as one line on the Tree tab; the full rule and its examples sit behind "i". */
export const RULE_LINE = 'One path to tier 5, a second to tier 2.';
export const RULE_FULL = [
  'Upgrades are bought with battle coins during a stage.',
  'One path may go all the way to tier 5. A second path may reach tier 2. The third path locks once two paths are in use.',
  ONE_PER_PATH_RULE,
];
export const RULE_EXAMPLES = { valid: ['5-2-0', '2-0-5', '0-2-5'], invalid: ['3-3-0', '1-1-1'] };

const firstSentence = (t) => String(t || '').split(/(?<=[.!?])\s/)[0].trim();
const STATE_WORD = { owned: 'owned', next: 'next', later: 'later', blocked: 'locked' };
/** A price or requirement is money, rounded up (§2). */
const price = (n) => fmtNum(n, 'money', { round: 'up' });

/** The one tag sticker of a path: the target most of its tiers have (Self, Allies, Enemies, Coins). */
export function pathTag(row) {
  const top = row?.summary?.[0];
  if (!top || !UPGRADE_TAGS[top.id]) return null;
  return { id: top.id, word: UPGRADE_TAGS[top.id].label, title: `${UPGRADE_TAGS[top.id].label}: ${UPGRADE_TAGS[top.id].long}` };
}

/**
 * What the grid shows, as plain data.
 * @param {object} model buildTreeModel() result
 * @param {{ prices?: boolean, selected?: { path: number, tier: number }|null }} [o]
 *   prices: a price under each "next" cell (live / preview trees); off on the girl page and the hold sheet
 */
export function treeGridView(model, { prices = false, selected = null } = {}) {
  const live = model.mode === 'live' || model.mode === 'ally';
  return {
    label: `${model.name}'s upgrade tree`,
    rows: model.rows.map((row) => {
      const locked = live && row.cap === 0;
      const owned = row.cells.filter((c) => c.state === 'owned').length;
      return {
        index: row.index,
        name: row.name,
        tag: pathTag(row),
        // the ⚡ path: a sticker on its head (no number: the tier is in its title)
        ability: row.ability ? { name: row.ability.name, title: row.ability.live ? `Ability ${row.ability.name}: unlocks at tier ${row.ability.unlockTier}` : `Ability ${row.ability.name}: comes in a later update` } : null,
        locked,
        lockLine: locked ? 'Locked: two paths in use' : null,
        lockWhy: locked ? row.reason : null,
        capLine: live && row.cap === 2 ? 'Up to tier 2' : null,
        owned,
        cells: row.cells.map((c) => {
          const showPrice = prices && c.state === 'next';
          const sel = !!selected && selected.path === c.path && selected.tier === c.tier;
          return {
            path: c.path,
            tier: c.tier,
            name: c.name,
            state: c.state,
            capstone: !!c.capstone,
            icon: c.icon,
            held: c.holder ? c.holder.label : null,
            price: showPrice ? price(c.cost) : null,
            poor: showPrice && c.afford === false,
            selected: sel,
            testid: `ut-cell-${c.path}-${c.tier}`,
            aria: `Tier ${c.tier} ${c.name}, ${STATE_WORD[c.state]}${c.holder ? `, tier 5 held by ${c.holder.label}` : ''}${showPrice ? `, ${price(c.cost)} coins` : ''}`,
          };
        }),
      };
    }),
  };
}

/**
 * The cell a live tree opens on before anything is tapped: the next tier of the most-upgraded open path
 * (ties: the lower path). Null when no path has a next tier (a static tree, everything bought or locked).
 */
export function defaultCell(model) {
  let best = null;
  for (const row of model.rows) {
    const next = row.cells.find((c) => c.state === 'next');
    if (!next) continue;
    if (!best || row.current > best.current) best = { current: row.current, cell: next };
  }
  return best ? best.cell : null;
}

/**
 * The tier panel, as plain data: its name, "Tier 3 · Path name", up to 3 effect chips, the price line and what
 * MORE opens (the tier's own words, every effect, the note).
 * @param {object} cell a TreeCell
 * @param {object} model the TreeModel
 * @param {{ describe?: ((mods: object) => string[])|null }} [o] describe: student.js describeMods (the long effect list)
 */
export function tierPanelView(cell, model, { describe = null } = {}) {
  const row = model.rows[cell.path];
  const chips = effectParts(cell.mods, 3);
  let priceLine = null;
  if (cell.state === 'owned') priceLine = { kind: 'owned', text: 'Owned' };
  else if (cell.state === 'blocked') priceLine = { kind: 'locked', text: cell.reason || row.reason || 'Locked by the path rule.' };
  else if (model.mode === 'static') priceLine = { kind: 'base', label: 'Base price', value: price(cell.cost), title: 'The price at Normal; the difficulty changes it.' };
  else priceLine = { kind: 'price', label: model.mode === 'ally' ? 'Her price' : 'Price', value: price(cell.cost), poor: cell.afford === false };
  return {
    path: cell.path,
    tier: cell.tier,
    name: cell.name,
    kicker: `Tier ${cell.tier} · ${row.name}`,
    state: cell.state,
    capstone: !!cell.capstone,
    icon: cell.icon,
    // a tier whose effect has no short phrase shows its own first sentence instead of a chip
    chips,
    line: chips.length ? null : firstSentence(cell.desc) || cell.short,
    priceLine,
    more: { desc: cell.desc, effects: describe ? describe(cell.mods) : [cell.short], note: cell.note || null },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------------------------------------------

const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

/**
 * @param {object} model buildTreeModel() result
 * @param {{ prices?: boolean, onPick?: ((cell: object) => void)|null, onPrice?: ((cell: object) => void)|null,
 *   selected?: { path: number, tier: number }|null, onRule?: (() => void)|null }} [o]
 *   onPrice: the cost button under a next cell (prices on); onRule: the "i" of a locked row's line
 * @returns {HTMLElement & { update(model: object): void, select(path: number|null, tier?: number): void,
 *   cellEl(path: number, tier: number): HTMLElement|null }}
 */
export function treeGrid(model, { prices = false, onPick = null, onPrice = null, selected = null, onRule = null } = {}) {
  let last = model;
  let sel = selected;
  const view0 = treeGridView(model, { prices, selected: sel });
  const grid = h('div.ug', { role: 'grid', 'aria-label': view0.label, 'data-testid': 'tree-grid' });
  const rowEls = [];
  const cellEls = [];

  view0.rows.forEach((r) => {
    const tag = r.tag ? chip({ icon: TAG_GLYPHS[r.tag.id] || null, text: r.tag.word, cls: `ug-tag.t-${r.tag.id}`, title: r.tag.title }) : null;
    const lock = h('span.ug-lock', { hidden: true }, ico('lock'), h('span.ug-lock-text'), onRule ? h('button.ug-why', { type: 'button', 'aria-label': 'Why is this path locked?', onclick: () => onRule(r.index) }, ico('info')) : null);
    const cap = h('span.ug-cap', { hidden: true });
    const abil = r.ability ? h('span.ug-abil', { title: r.ability.title, 'aria-label': r.ability.title, 'data-testid': `ug-abil-${r.index}` }, ico(KIT_SVG.bolt, 'ug-abil-ico')) : null;
    const head = h('div.ug-head', h('span.ug-bar', { 'aria-hidden': 'true' }), h('span.ug-pname', r.name), abil, tag, cap, lock);
    const fill = h('i');
    const cells = h('div.ug-cells', { role: 'row' }, h('span.ug-track', { 'aria-hidden': 'true' }, fill));
    const els = r.cells.map((c) => {
      const cost = h('button.ui-cost.dense.ug-price', { type: 'button', hidden: true, onclick: (e) => { e.stopPropagation(); onPrice?.(cellOf(c.path, c.tier)); } }, h('span', curArt('coins'), h('span.num')));
      const el = h(`div.ug-cell${c.capstone ? '.capstone' : ''}`, { 'data-path': c.path, 'data-tier': c.tier },
        h('button.ug-hit', {
          type: 'button', role: 'gridcell', 'data-testid': c.testid, 'data-path': c.path, 'data-tier': c.tier,
          onclick: () => { setSelected(c.path, c.tier); onPick?.(cellOf(c.path, c.tier)); },
        },
        h('span.ug-ring', tierIconEl(c.icon, 'ug-ico'), h('span.ug-badge', { 'aria-hidden': 'true', html: CHECK })),
        h('span.ug-name', c.name)),
        cost);
      el._parts = { cost, hit: el.firstChild };
      return el;
    });
    cells.append(...els);
    cellEls.push(els);
    const rowEl = h(`div.ug-row.p${r.index}`, { 'data-row': r.index }, head, cells);
    rowEl._parts = { lock, cap, fill };
    rowEls.push(rowEl);
    grid.append(rowEl);
  });

  const cellOf = (path, tier) => last.rows[path]?.cells[tier - 1] || null;

  function patch(m) {
    last = m;
    const v = treeGridView(m, { prices, selected: sel });
    v.rows.forEach((r, ri) => {
      const rowEl = rowEls[ri];
      if (!rowEl) return;
      rowEl.classList.toggle('locked', r.locked);
      const { lock, cap, fill } = rowEl._parts;
      lock.hidden = !r.locked;
      lock.querySelector('.ug-lock-text').textContent = r.lockLine || '';
      lock.title = r.lockWhy || '';
      cap.hidden = !r.capLine;
      cap.textContent = r.capLine || '';
      fill.style.width = `${(Math.max(0, r.owned - 1) / 4) * 100}%`;
      r.cells.forEach((c, ci) => {
        const el = cellEls[ri][ci];
        el.classList.remove('s-owned', 's-next', 's-later', 's-blocked');
        el.classList.add(`s-${c.state}`);
        el.classList.toggle('sel', c.selected);
        el.classList.toggle('held', !!c.held);
        el._parts.hit.setAttribute('aria-label', c.aria);
        el._parts.hit.setAttribute('aria-selected', c.selected ? 'true' : 'false');
        el._parts.hit.title = c.held ? `Tier 5 held by ${c.held}` : '';
        const { cost } = el._parts;
        cost.hidden = c.price == null;
        cost.classList.toggle('poor', !!c.poor);
        cost.querySelector('.num').textContent = c.price ?? '';
        cost.setAttribute('aria-label', c.price ? `Buy ${c.name} · ${c.price} coins` : '');
      });
    });
  }

  function setSelected(path, tier) {
    sel = path == null ? null : { path, tier };
    patch(last);
  }

  // arrow keys move between cells (←/→ tier, ↑/↓ path); Enter / Space pick (native buttons)
  grid.addEventListener('keydown', (e) => {
    const el = e.target.closest?.('.ug-hit');
    if (!el) return;
    const d = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
    if (!d) return;
    e.preventDefault();
    const p = Math.max(0, Math.min(cellEls.length - 1, Number(el.dataset.path) + d[0]));
    const t = Math.max(1, Math.min(cellEls[p].length, Number(el.dataset.tier) + d[1]));
    cellEls[p][t - 1]?._parts.hit.focus();
  });

  patch(model);
  grid.update = patch;
  grid.select = setSelected;
  grid.cellEl = (path, tier) => cellEls[path]?.[tier - 1] || null;
  return grid;
}

/**
 * The tier panel (§6.1 detail panel): the tier icon, its name, "TIER 3 · PATH", up to 3 effect chips, the price
 * line, MORE (the full tier text) and the actions (a Buy cost button in battle).
 * @param {object} cell @param {object} model
 * @param {{ describe?: Function|null, onMore?: ((view: object) => void)|null, actions?: Node[], onClose?: Function|null }} [o]
 */
export function tierPanel(cell, model, { describe = null, onMore = null, actions = [], onClose = null } = {}) {
  const v = tierPanelView(cell, model, { describe });
  const pl = v.priceLine;
  const priceEl = pl.kind === 'base' || pl.kind === 'price'
    ? h(`div.ugp-price${pl.poor ? '.poor' : ''}`, { title: pl.title || null }, lbl(pl.label), h('span.ui-pair', curArt('coins'), num(pl.value, 's')))
    : h(`div.ugp-state.${pl.kind}`, ico(pl.kind === 'owned' ? 'check' : 'lock'), h('span', pl.text));
  return h(`div.ugp.p${v.path}.s-${v.state}`, { 'data-testid': 'ut-detail' },
    h('div.ugp-head',
      h(`span.ug-ring.ugp-ring${v.capstone ? '.capstone' : ''}`, tierIconEl(v.icon, 'ug-ico')),
      h('div.ugp-title', h('div.ugp-name', v.name), lbl(v.kicker)),
      onClose ? h('button.ui-close.ugp-close', { type: 'button', 'aria-label': 'Close', onclick: onClose, html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' }) : null),
    v.chips.length ? h('div.ugp-chips', v.chips.map((t) => chip({ text: t, cls: 'ugp-chip' }))) : h('p.ugp-line', v.line),
    h('div.ugp-foot', priceEl, onMore ? moreSticker(() => onMore(v), { testid: 'ut-detail-more', label: `More about ${v.name}` }) : null),
    actions.length ? h('div.ugp-actions', actions) : null);
}
