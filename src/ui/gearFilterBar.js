// Equipment filter bar (owner: "can you add a filter for equipment?"), shared by the Backpack's
// Equipment tab and a girl's Equipment tab. Rarity chips, then compact dropdowns for main stat,
// a wanted substat, equipped / spare / locked and the sort; "Showing 4 of 23" with Clear. The
// choice is remembered per place (Backpack / girl page) for the next visit.
import './styles/gearFilter.css';
import { h } from './components.js';
import { GEAR_MAIN_STATS, ITEM_RARITIES } from '../data/types.js';
import { GEAR_STAT_KEYS, BASE_STAT_KEYS, statName } from '../data/gearStats.js';
import {
  DEFAULT_GEAR_FILTER, GEAR_STATUSES, GEAR_SORTS, GEAR_DISPLAY_RARITIES, normalizeGearFilter, activeGearFilters,
} from '../systems/gearFilter.js';

const KEY = 'sakura-gear-filter';
const memory = {};

/** The remembered filter for a place ('backpack' | 'student'). */
export function loadGearFilter(place) {
  if (!memory[place]) {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(KEY) || '{}')[place];
    } catch {
      /* private mode / bad JSON: defaults */
    }
    memory[place] = normalizeGearFilter(saved || DEFAULT_GEAR_FILTER);
  }
  return memory[place];
}

export function saveGearFilter(place, filter) {
  memory[place] = normalizeGearFilter(filter);
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || '{}');
    all[place] = memory[place];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* not saved: still applies for this session */
  }
}

/**
 * The filter to apply to one list: a remembered main stat that this slot's gear can't have
 * (ATK chosen on Charms, now looking at Shoes) is ignored rather than emptying the list.
 */
export function gearFilterFor(place, slot = null, overrides = {}) {
  const f = { ...loadGearFilter(place), ...overrides };
  if (slot && f.main && !(GEAR_MAIN_STATS[slot] || []).includes(f.main)) f.main = null;
  return f;
}

function select(id, label, value, options, onPick) {
  const el = h('select.gf-select', { 'data-testid': `gear-filter-${id}`, 'aria-label': label },
    options.map(([v, text]) => h('option', { value: v ?? '', selected: (v ?? '') === (value ?? '') }, text)));
  el.addEventListener('change', () => onPick(el.value || null));
  return h('label.gf-field', h('span.gf-label', label), el);
}

/**
 * @param {{ place: string, slot?: string|null, shown: number, total: number, onChange: () => void,
 *   rarity?: string|null, onClearRarity?: () => void }} opts
 *   slot: when the list is one slot, only that slot's main stats are offered;
 *   rarity / onClearRarity: the screen already has its own rarity chips (Backpack) — the bar
 *   hides its rarity row, counts that rarity as a filter, and Clear also resets it
 */
export function gearFilterBar({ place, slot = null, shown, total, onChange, rarity, onClearRarity = null }) {
  const external = rarity !== undefined;
  const f = gearFilterFor(place, slot, external ? { rarity: null } : {});
  const set = (patch) => {
    saveGearFilter(place, { ...f, ...patch });
    onChange();
  };
  const mains = slot ? GEAR_MAIN_STATS[slot] || [] : BASE_STAT_KEYS;
  const active = activeGearFilters(f) + (external && rarity ? 1 : 0);
  return h('div.gf-bar', { 'data-testid': 'gear-filter' },
    external ? null : h('div.gf-rarities', { role: 'radiogroup', 'aria-label': 'Rarity' },
      [null, ...GEAR_DISPLAY_RARITIES].map((r) => h(`button.gf-rarity${(f.rarity ?? null) === r ? '.on' : ''}${r === 'UR' ? '.is-ur' : ''}`, {
        type: 'button',
        role: 'radio',
        'aria-checked': (f.rarity ?? null) === r ? 'true' : 'false',
        'data-testid': `gear-filter-rarity-${r || 'all'}`,
        style: r && ITEM_RARITIES[r] ? { '--gf': ITEM_RARITIES[r].color } : null,
        onclick: () => set({ rarity: r }),
      }, r ? ITEM_RARITIES[r]?.name || r : 'All'))),
    h('div.gf-row',
      select('main', 'Main stat', mains.includes(f.main) ? f.main : null, [[null, 'Any'], ...mains.map((s) => [s, statName(s)])], (v) => set({ main: v })),
      select('sub', 'Has substat', f.sub, [[null, 'Any'], ...GEAR_STAT_KEYS.map((s) => [s, statName(s)])], (v) => set({ sub: v })),
      select('status', 'Show', f.status, Object.entries(GEAR_STATUSES), (v) => set({ status: v || 'all' })),
      select('sort', 'Sort', f.sort, Object.entries(GEAR_SORTS), (v) => set({ sort: v || 'best' }))),
    h('div.gf-foot',
      h('span.gf-count', { 'data-testid': 'gear-filter-count' }, active ? `Showing ${shown} of ${total}` : `${total} piece${total === 1 ? '' : 's'}`),
      active ? h('button.gf-clear', {
        type: 'button',
        'data-testid': 'gear-filter-clear',
        onclick: () => {
          onClearRarity?.();
          set({ ...DEFAULT_GEAR_FILTER, sort: f.sort });
        },
      }, 'Clear filters') : null));
}
