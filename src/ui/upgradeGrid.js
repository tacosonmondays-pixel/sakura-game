// Upgrade tree grid (owner request #152): 3 paths × 5 round tier icons with owned / next / later
// / blocked states, the crosspath cap, and each tier's name, one-line effect, Self / Allies /
// Enemies / Coins chips and cost. Shared by the Unit Sheet (static) and the in-battle Upgrade
// Tree (live / ally / preview). update(model) patches the existing nodes (no rebuild).
import { h } from './dom.js';
import { svgEl } from './components.js';
import { uiIcon } from '../art/icons.js';
import { tagChips, tagChip, tierIconEl, pathSummaryChips } from './tagChips.js';
import { tagText, TRANSFORM_TAG } from './upgradeTags.js';
import { fmtNum } from './format.js';

/** A price or a shortfall: money, rounded up ('–' when unknown). */
const fmt = (n) => fmtNum(n, 'money', { round: 'up' });
const STATE_WORD = { owned: 'owned', next: 'next', later: 'later', blocked: 'locked' };

function costText(cell) {
  if (cell.state === 'owned') return 'Owned';
  return fmt(cell.cost);
}

function ariaFor(cell) {
  const tags = cell.tags.map((t) => tagText(t)).join(' and ');
  return `T${cell.tier} ${cell.name}, ${tags || 'no tag'}, ${cell.state === 'owned' ? 'owned' : `${fmt(cell.cost)} coins`}, ${STATE_WORD[cell.state]}`;
}

/**
 * @param {object} model buildTreeModel() result
 * @param {{ onPick?: (cell) => void, selected?: {path:number,tier:number}|null, unit?: object }} [o]
 *   unit: the UnitDef (for the path summary chips)
 * @returns {HTMLElement & { update(model): void, select(path, tier): void, cellEl(path, tier): HTMLElement|null }}
 */
export function upgradeGrid(model, { onPick = null, selected = null, unit = null } = {}) {
  const grid = h('div.ut-grid', { role: 'grid', 'aria-label': `${model.name}'s upgrade tree` });
  const cellEls = [];
  const rowEls = [];
  let sel = selected;

  model.rows.forEach((row) => {
    const reason = h('span.ut-row-reason');
    const capTag = h('span.ut-row-cap');
    const head = h('div.ut-row-head',
      h('span.ut-row-num', String(row.index + 1)),
      h('span.ut-row-name', row.name),
      h('span.ut-row-focus', row.focus),
      capTag,
      reason,
      unit ? pathSummaryChips(unit, row.index, { size: 'xs' }) : null);
    const cells = h('div.ut-cells', { role: 'row' });
    const els = row.cells.map((c) => {
      const circle = h('span.ut-circle', tierIconEl(c.icon, 'ut-ico'), h('span.ut-badge'));
      const cost = h('span.ut-cost');
      const el = h('button.ut-cell', {
        type: 'button',
        role: 'gridcell',
        'data-testid': `ut-cell-${c.path}-${c.tier}`,
        'data-path': c.path,
        'data-tier': c.tier,
        onclick: () => {
          setSelected(c.path, c.tier);
          onPick?.(current().rows[c.path].cells[c.tier - 1]);
        },
      },
      circle,
      h('span.ut-tier-num', `T${c.tier}`),
      h('span.ut-name', c.name),
      h('span.ut-eff', c.short),
      h('span.ut-foot', tagChips(c.tags, { size: 'xs', max: 2, tight: true }), cost));
      if (c.capstone) el.classList.add('capstone');
      el._parts = { cost };
      return el;
    });
    cells.append(...els);
    cellEls.push(els);
    const rowEl = h(`div.ut-row.p${row.index}`, { 'data-row': row.index }, head, cells);
    rowEl._parts = { reason, capTag };
    rowEls.push(rowEl);
    grid.append(rowEl);
  });

  let last = model;
  const current = () => last;

  function patch(m) {
    last = m;
    m.rows.forEach((row, ri) => {
      const rowEl = rowEls[ri];
      rowEl.classList.toggle('cap0', row.cap === 0 && m.mode !== 'static' && m.mode !== 'preview');
      rowEl.classList.toggle('cap2', row.cap === 2);
      // path cap: "V held" when another copy of hers holds this path's tier 5
      const capText = row.cap === 2 ? 'cap T2' : row.cap === 0 && (m.mode === 'live' || m.mode === 'ally') ? 'locked' : '';
      rowEl._parts.capTag.textContent = capText || (row.finalHeld ? 'V held' : '');
      rowEl._parts.capTag.classList.toggle('ut-row-final', !capText && !!row.finalHeld);
      rowEl._parts.capTag.title = !capText && row.finalHeld ? `Tier 5 held by ${row.finalHeld.label}` : '';
      rowEl._parts.capTag.hidden = !rowEl._parts.capTag.textContent;
      rowEl._parts.reason.textContent = row.reason || '';
      rowEl._parts.reason.hidden = !row.reason;
      row.cells.forEach((c, ci) => {
        const el = cellEls[ri][ci];
        el.classList.remove('s-owned', 's-next', 's-later', 's-blocked');
        el.classList.add(`s-${c.state}`);
        el.classList.toggle('poor', c.afford === false);
        el.classList.toggle('static', m.mode === 'static' || m.mode === 'preview');
        el._parts.cost.textContent = costText(c);
        el._parts.cost.title = c.afford === false && m.cash != null ? `Need ${fmt(c.cost - m.cash)} more coins` : '';
        el.setAttribute('aria-label', ariaFor(c));
      });
    });
    paintSelection();
  }

  function paintSelection() {
    for (const els of cellEls) for (const el of els) {
      const on = !!sel && Number(el.dataset.path) === sel.path && Number(el.dataset.tier) === sel.tier;
      el.classList.toggle('sel', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
    }
  }

  function setSelected(path, tier) {
    sel = path == null ? null : { path, tier };
    paintSelection();
  }

  // arrow keys move between cells (←/→ tier, ↑/↓ path); Enter / Space pick (native button)
  grid.addEventListener('keydown', (e) => {
    const el = e.target.closest?.('.ut-cell');
    if (!el) return;
    const p = Number(el.dataset.path);
    const t = Number(el.dataset.tier);
    const d = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
    if (!d) return;
    e.preventDefault();
    const np = Math.max(0, Math.min(cellEls.length - 1, p + d[0]));
    const nt = Math.max(1, Math.min(cellEls[np].length, t + d[1]));
    cellEls[np][nt - 1]?.focus();
  });

  patch(model);
  grid.update = patch;
  grid.select = setSelected;
  grid.cellEl = (path, tier) => cellEls[path]?.[tier - 1] || null;
  return grid;
}

/**
 * Tier detail card (sheet: below the grid; battle: in the left panel).
 * @param {object} cell TreeCell
 * @param {object} model TreeModel
 * @param {{ describe?: ((mods) => string[])|null, actions?: HTMLElement[], onBack?: Function|null }} [o]
 */
export function tierDetail(cell, model, { describe = null, actions = [], onBack = null } = {}) {
  const row = model.rows[cell.path];
  const bullets = describe ? describe(cell.mods) : null;
  const status = statusLine(cell, model, row);
  const longs = [];
  for (const t of cell.tags) {
    longs.push(h('div.ut-d-long', tagChip(t, { size: 'xs' }), h('span', tagText(t, { long: true }))));
    if (t.transform) longs.push(h('div.ut-d-long', tagChip({ id: 'transform' }, { size: 'xs' }), h('span', TRANSFORM_TAG.long)));
  }
  return h(`div.ut-detail.p${cell.path}.s-${cell.state}`, { 'data-testid': 'ut-detail' },
    h('div.ut-d-head',
      h(`span.ut-d-circle.s-${cell.state}${cell.capstone ? '.capstone' : ''}`, tierIconEl(cell.icon, 'ut-ico')),
      h('div.ut-d-title',
        h('div.ut-d-name', h('span.ut-d-tier', `T${cell.tier}`), cell.name),
        h('div.ut-d-path', `Path ${cell.path + 1} · ${row.name}`)),
      onBack ? h('button.ut-d-back', { type: 'button', title: 'Back', 'aria-label': 'Back', onclick: onBack }, svgEl(uiIcon('close'), 'ut-d-back-ico')) : null),
    tagChips(cell.tags, { size: 'sm' }),
    h('p.ut-d-desc', cell.desc),
    bullets?.length ? h('ul.ut-d-mods', bullets.map((b) => h('li', b))) : h('div.ut-d-short', cell.short),
    h('div.ut-d-longs', longs),
    cell.note ? h('div.ut-d-note', h('b', 'Note: '), cell.note) : null,
    h(`div.ut-d-status.s-${cell.state}${cell.afford === false ? '.poor' : ''}`, { 'data-testid': 'ut-detail-status' }, status),
    actions.length ? h('div.ut-d-actions', actions) : null);
}

function statusLine(cell, model, row) {
  const cost = `${fmt(cell.cost)} coins`;
  if (cell.state === 'owned') return [svgEl(uiIcon('check'), 'ut-s-ico'), 'Owned'];
  if (cell.state === 'blocked') return [svgEl(uiIcon('lock'), 'ut-s-ico'), cell.reason || row.reason || 'Locked by the crosspath rule.'];
  switch (model.mode) {
    case 'static': return `Base ${cost} · varies with difficulty`;
    case 'preview': return `Not deployed · ${cost} here`;
    case 'ally': return `Her price · ${cost} (${model.ownerName || 'her owner'} upgrades her)`;
    default:
      if (cell.state === 'next') {
        return cell.afford === false && model.cash != null ? `Next · ${cost} · need ${fmt(cell.cost - model.cash)} more` : `Next · ${cost}`;
      }
      return `Later · ${cost} (buy T${cell.tier - 1} first)`;
  }
}
