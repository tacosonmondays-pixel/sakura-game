// Students list (owner: meta-b). Arknights-style tall portrait cards with filters
// (role category, attack type, rarity, owned/all, water) and sorting (level, rarity, power, name).
// Unowned girls are shown locked with how to get them.
import '../styles/meta-b.css';
import { h, clear, screen, svgEl, unitCard } from '../components.js';
import { store } from '../../core/store.js';
import { navigate } from '../router.js';
import { ROLES, ROLE_CATEGORIES, ATTACK_TYPES, UNIT_RARITIES } from '../../data/types.js';
import { UNITS } from '../../data/units.js';
import { unitPower } from '../../systems/progression.js';
import { roleIcon, attackTypeIcon, uiIcon } from '../../art/icons.js';
import { howToGet, cssVars, put } from './backpack.js';

const RARITY_RANK = { R: 0, SR: 1, SSR: 2 };
const SORTS = [
  { id: 'power', label: 'Power' },
  { id: 'level', label: 'Level' },
  { id: 'rarity', label: 'Rarity' },
  { id: 'name', label: 'Name' },
];

/** Filter state survives navigation while the app is open. */
const state = { cat: null, type: null, rarity: null, owned: 'all', water: false, sort: 'power', desc: true, filtersOpen: false };

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
    rarity: (u) => RARITY_RANK[u.rarity] * 1000 + (profile.units[u.id]?.level ?? 0),
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
    return dir * (ka - kb) || RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || a.name.localeCompare(b.name);
  });
}

function chips(options, active, onPick) {
  return h('div.mb-chips', options.map((o) => h(`button.mb-chip${o.id === active ? '.on' : ''}`, { onclick: () => onPick(o.id), style: o.color ? cssVars({ '--chip': o.color }) : null, title: o.title || o.label },
    o.icon ? svgEl(o.icon, 'mb-chip-icon') : null, o.label ? h('span', o.label) : null)));
}

function studentCard(u, profile) {
  const st = profile.units[u.id];
  const how = st ? null : howToGet(u);
  const card = unitCard(u.id, {
    owned: !!st, level: st?.level ?? null, awaken: st?.awaken || 0, variant: 'tall',
    onClick: () => navigate('student', { id: u.id }),
  });
  card.classList.add('mb-tall');
  card.style.setProperty('--rarity', UNIT_RARITIES[u.rarity].color);
  put(card,
    h('div.mb-card-badges',
      svgEl(roleIcon(u.role), 'mb-card-badge'),
      svgEl(attackTypeIcon(u.attackType), 'mb-card-badge'),
      u.placement !== 'land' ? h('span.mb-card-water', svgEl(uiIcon('water'))) : null),
    u.kind === 'hero' ? h('div.mb-card-hero', 'HERO') : null,
    how ? h('div.mb-card-how', how.short) : null,
    st ? h('div.mb-card-role', ROLES[u.role]?.name) : null,
  );
  return card;
}

export function render(root) {
  const { el, body } = screen('Students');
  el.classList.add('mb-screen');
  root.appendChild(el);
  const profile = store.profile;

  const bar = h('div.mb-filterbar');
  const grid = h('div.mb-student-grid');
  const summary = h('div.mb-summary');
  put(body, bar, summary, grid);

  const rerender = () => {
    clear(bar);
    const ownedCount = UNITS.filter((u) => profile.units[u.id]).length;
    const activeFilters = [state.cat, state.type, state.rarity, state.water || null].filter(Boolean).length;
    put(bar,
      h('div.mb-filter-top',
        h('div.mb-seg',
          ['all', 'owned', 'locked'].map((o) => h(`button.mb-seg-btn${state.owned === o ? '.on' : ''}`, { onclick: () => { state.owned = o; rerender(); } }, { all: 'All', owned: `Owned ${ownedCount}`, locked: 'Locked' }[o]))),
        h('div.mb-sort',
          h('label.mb-select', svgEl(uiIcon('sort'), 'mb-select-icon'),
            h('select', { 'aria-label': 'Sort', onchange: (e) => { state.sort = e.target.value; rerender(); } }, SORTS.map((s) => h('option', { value: s.id, selected: s.id === state.sort }, s.label)))),
          h('button.mb-icon-btn', { title: state.desc ? 'Descending' : 'Ascending', onclick: () => { state.desc = !state.desc; rerender(); } }, state.desc ? '↓' : '↑'),
          h(`button.mb-icon-btn.mb-filter-toggle${state.filtersOpen ? '.on' : ''}`, { title: 'Filters', onclick: () => { state.filtersOpen = !state.filtersOpen; rerender(); } }, svgEl(uiIcon('filter')), activeFilters ? h('span.mb-filter-count', String(activeFilters)) : null))),
      h(`div.mb-filter-body${state.filtersOpen ? '.open' : ''}`,
        h('div.mb-filter-row', h('span.mb-filter-label', 'Role'),
          chips([{ id: null, label: 'All' }, ...Object.entries(ROLE_CATEGORIES).map(([id, c]) => ({ id, label: c.name, color: c.color }))], state.cat, (id) => { state.cat = id; rerender(); })),
        h('div.mb-filter-row', h('span.mb-filter-label', 'Type'),
          chips([{ id: null, label: 'All' }, ...Object.values(ATTACK_TYPES).map((t) => ({ id: t.id, label: t.name, icon: attackTypeIcon(t.id), color: t.color }))], state.type, (id) => { state.type = id; rerender(); })),
        h('div.mb-filter-row', h('span.mb-filter-label', 'Rarity'),
          chips([{ id: null, label: 'All' }, ...Object.values(UNIT_RARITIES).map((r) => ({ id: r.id, label: r.name, color: r.color }))], state.rarity, (id) => { state.rarity = id; rerender(); }),
          h(`button.mb-chip.mb-water-toggle${state.water ? '.on' : ''}`, { onclick: () => { state.water = !state.water; rerender(); }, style: cssVars({ '--chip': '#4cc9f0' }) }, svgEl(uiIcon('water'), 'mb-chip-icon'), h('span', 'Water')),
          activeFilters ? h('button.mb-chip.mb-clear', { onclick: () => { Object.assign(state, { cat: null, type: null, rarity: null, water: false }); rerender(); } }, 'Clear') : null)),
    );

    const list = sortList(UNITS.filter((u) => matches(u, profile)), profile);
    clear(summary);
    put(summary, h('span', `${list.length} shown`), h('span.muted', ` · ${ownedCount} / ${UNITS.length} recruited`));
    clear(grid);
    grid.classList.remove('mb-fade');
    void grid.offsetWidth;
    grid.classList.add('mb-fade');
    if (!list.length) {
      grid.appendChild(h('div.mb-empty', h('div.mb-empty-title', 'No students match'), h('p.muted', 'Try clearing a filter.')));
      return;
    }
    list.forEach((u, i) => {
      const c = studentCard(u, profile);
      c.style.setProperty('--i', String(Math.min(i, 20)));
      grid.appendChild(c);
    });
  };
  rerender();
}
