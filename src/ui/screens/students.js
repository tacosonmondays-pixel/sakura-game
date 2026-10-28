// Students list (owner: meta-b). The roster as kit girl tiles (UI v2 menus M3, V3: girlTile(), src/ui/components.js),
// with the owned/locked choice, the sort, its direction and a Filter sheet (role family, attack type, rarity, water)
// on one 44 px row. Unowned girls are shown locked with how they join.
// UI M5d (notes/ui-m5/PLAN.md §5 M5d): every label 12 px or more, one fact per slot, each count said once.
// [ui-ink] V3 (docs/specs/UI_V2_MENUS.md §5 M3): the tiles carry at most two numbers (LV and P); the role family is
// the tile's top-right glyph (the families the Filter sheet lists); the old inline filter panel is a kit sheet.
import '../styles/meta-b.css';
import '../styles/hubs.css';
import '../styles/v2-roster.css';
import { h, clear, screen, svgEl, girlTile, ROLE_GLYPH } from '../components.js';
import { store } from '../../core/store.js';
import { navigate } from '../router.js';
import { ROLES, ROLE_CATEGORIES, ATTACK_TYPES, UNIT_RARITIES } from '../../data/types.js';
import { UNITS } from '../../data/units.js';
import { unitPower } from '../../systems/progression.js';
import { potentialLevel } from '../../systems/potential.js';
import { attackTypeIcon } from '../../art/icons.js';
import { put } from './backpack.js';
import { displayRarity, DISPLAY_RARITY_RANK } from '../rarity.js';
import { ico, RARITY_CLASS } from '../kit.js';
import { openSheet } from '../sheet.js';
import { lg } from '../girlFrame.js';

// sorting by rarity puts UR (fully awakened SSRs, display only) above SSR; the rarity filter
// keeps matching the drop rarity, so "SSR" lists URs too
const RARITY_RANK = DISPLAY_RARITY_RANK;
/** The sorts, in the select's order. (M4's Growth sort takes its row here and its key in sortList's table.) */
export const SORTS = [
  { id: 'power', label: 'Power' },
  { id: 'level', label: 'Level' },
  { id: 'rarity', label: 'Rarity' },
  { id: 'potential', label: 'Potential' },
  { id: 'name', label: 'Name' },
];

/** Filter state survives navigation while the app is open. */
const state = { cat: null, type: null, rarity: null, owned: 'all', water: false, sort: 'power', desc: true };

function matches(u, profile) {
  const owned = !!profile.units[u.id];
  if (state.owned === 'owned' && !owned) return false;
  if (state.owned === 'locked' && owned) return false;
  if (state.cat && ROLES[u.role]?.category !== state.cat) return false;
  if (state.type && u.attackType !== state.type) return false;
  if (state.rarity && u.rarity !== state.rarity) return false;
  if (state.water && u.placement === 'land') return false;
  return true;
}

function sortList(list, profile) {
  const key = {
    power: (u) => (profile.units[u.id] ? unitPower(profile, u.id) : -1),
    level: (u) => profile.units[u.id]?.level ?? 0,
    rarity: (u) => RARITY_RANK[displayRarity(u, profile)] * 1000 + (profile.units[u.id]?.level ?? 0),
    // P6 first, then Power
    potential: (u) => (profile.units[u.id] ? potentialLevel(profile.units[u.id]) * 1e7 + unitPower(profile, u.id) : -1),
    name: (u) => u.name,
  }[state.sort];
  const dir = state.desc ? -1 : 1;
  return list.sort((a, b) => {
    // Owned girls always lead (unless filtering locked only), then the chosen key.
    const own = Number(!!profile.units[b.id]) - Number(!!profile.units[a.id]);
    if (own) return own;
    const ka = key(a);
    const kb = key(b);
    if (typeof ka === 'string') return dir * ka.localeCompare(kb);
    return dir * (ka - kb) || RARITY_RANK[displayRarity(b, profile)] - RARITY_RANK[displayRarity(a, profile)] || a.name.localeCompare(b.name);
  });
}

/** How many filters of the sheet are on (the Filter button carries a red dot, never the count: P7). */
const filtersOn = () => [state.cat, state.type, state.rarity, state.water || null].filter(Boolean).length;

/** One choice of the Filter sheet: a kit option (the inverse fill and the sakura bar when on). */
function opt({ label = null, on, onPick, icon = null, rar = null, testid = null, title = null }) {
  return h(`button.ui-opt.st-opt${on ? '.on' : ''}`, { type: 'button', 'aria-pressed': on ? 'true' : 'false', 'data-testid': testid, title, onclick: onPick },
    rar ? h(`span.ui-rar.${RARITY_CLASS[rar] || 'r'}`, rar) : null,
    icon,
    label ? h('span', label) : null);
}

/** The Filter sheet: role family, attack type, rarity and water; a tap applies at once (tap again: off). */
function openFilter(rerender) {
  const body = h('div.st-fsheet');
  const draw = () => {
    const row = (title, kids) => h('section.st-fsec', h('h3.st-fkick', title), h('div.st-opts', kids));
    const set = (k, v) => () => { state[k] = state[k] === v ? null : v; draw(); rerender(); };
    body.replaceChildren(
      row('Role', Object.entries(ROLE_CATEGORIES).map(([id, c]) => opt({ label: c.name, on: state.cat === id, onPick: set('cat', id), icon: lg(ROLE_GLYPH[id] || 'sword'), testid: `students-cat-${id}` }))),
      row('Attack', Object.values(ATTACK_TYPES).map((t) => opt({ label: t.name, on: state.type === t.id, onPick: set('type', t.id), icon: svgEl(attackTypeIcon(t.id), 'st-opt-ic'), testid: `students-type-${t.id}` }))),
      row('Rarity', [
        ...Object.values(UNIT_RARITIES).map((r) => opt({ rar: r.id, on: state.rarity === r.id, onPick: set('rarity', r.id), testid: `students-rarity-${r.id}`, title: r.name })),
        opt({ label: 'Water', on: state.water, onPick: () => { state.water = !state.water; draw(); rerender(); }, icon: lg('waves'), testid: 'students-water', title: 'Girls who can stand in water' }),
      ]),
      h('div.st-facts', filtersOn()
        ? h('button.btn.ui-sec.st-clear', { type: 'button', 'data-testid': 'students-clear', onclick: () => { Object.assign(state, { cat: null, type: null, rarity: null, water: false }); draw(); rerender(); } }, h('span.btn-label', 'Clear filters'))
        : h('p.st-fnone', 'Showing every girl. Tap a choice to narrow the list.')));
  };
  draw();
  return openSheet({ title: 'Filter', body, testid: 'students-filter-sheet', cls: 'st-sheet' });
}

export function render(root) {
  const { el, body } = screen('Students');
  el.classList.add('mb-screen', 'mb-students-screen', 'st-screen');
  root.appendChild(el);
  const profile = store.profile;

  const bar = h('div.st-bar');
  const grid = h('div.mb-student-grid.st-grid');
  const summary = h('div.st-summary');
  put(body, bar, summary, grid);

  const rerender = () => {
    const ownedCount = UNITS.filter((u) => profile.units[u.id]).length;
    const on = filtersOn();
    clear(bar);
    put(bar,
      h('div.st-seg', { role: 'group', 'aria-label': 'Show' },
        ['all', 'owned', 'locked'].map((o) => h(`button.ui-opt.st-opt${state.owned === o ? '.on' : ''}`, {
          type: 'button', 'aria-pressed': state.owned === o ? 'true' : 'false', 'data-testid': `students-show-${o}`,
          onclick: () => { state.owned = o; rerender(); },
        }, { all: 'All', owned: 'Owned', locked: 'Locked' }[o]))),
      h('span.st-gap'),
      // (a native select: a phone opens its own picker; e2e reads .mb-sort select)
      h('label.ui-opt.st-opt.st-sort.mb-sort', { title: 'Sort' }, ico('sort'),
        h('select', { 'aria-label': 'Sort', 'data-testid': 'students-sort', onchange: (e) => { state.sort = e.target.value; rerender(); } }, SORTS.map((s) => h('option', { value: s.id, selected: s.id === state.sort }, s.label))),
        lg('chevD', 'ui-ico.st-sort-chev')),
      h('button.ui-opt.st-opt.st-dir', {
        type: 'button', 'data-testid': 'students-dir', 'aria-label': state.desc ? 'Highest first' : 'Lowest first', title: state.desc ? 'Highest first' : 'Lowest first',
        onclick: () => { state.desc = !state.desc; rerender(); },
      }, lg(state.desc ? 'chevD' : 'chevU')),
      h(`button.ui-opt.st-opt.st-filter${on ? '.on' : ''}`, { type: 'button', 'data-testid': 'students-filter', 'aria-label': on ? `Filter, ${on} on` : 'Filter', onclick: () => openFilter(rerender) },
        ico('filter'), h('span', 'Filter'), on ? h('i.ui-dot', { 'aria-hidden': 'true' }) : null));

    const list = sortList(UNITS.filter((u) => matches(u, profile)), profile);
    // each count said once: how many are recruited; how many show only while something is filtered out
    clear(summary);
    put(summary, h('span.lbl', 'Recruited'), h('span.num', `${ownedCount}/${UNITS.length}`),
      list.length !== UNITS.length ? [h('span.st-sep', { 'aria-hidden': 'true' }), h('span.lbl', 'Shown'), h('span.num', String(list.length))] : null);
    clear(grid);
    grid.classList.remove('mb-fade');
    void grid.offsetWidth;
    grid.classList.add('mb-fade');
    if (!list.length) {
      grid.appendChild(h('div.st-empty', h('b', 'No students match'), h('p', 'Try clearing a filter.')));
      return;
    }
    list.forEach((u, i) => {
      const st = profile.units[u.id];
      const c = girlTile(u.id, { owned: !!st, level: st?.level ?? null, cls: 'ui-in', onClick: () => navigate('student', { id: u.id }) });
      c.style.setProperty('--i', String(Math.min(i, 20)));
      grid.appendChild(c);
    });
  };
  rerender();
}
