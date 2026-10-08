// Supply Bot — the developer clan's sandbox (owner request: the Rosie777 clan's bot grants
// materials in any quantity). Clearly labelled as a developer tool; grants go straight into the
// local save (addItems + store.commit), like every other reward.
import '../styles/online.css';
import { h, button, itemTile, toast, svgEl } from '../components.js';
import { store } from '../../core/store.js';
import { formatNumber } from '../../core/util.js';
import { BACKPACK_TABS, itemsByTab, getItem } from '../../data/items.js';
import { itemCount } from '../../systems/inventory.js';
import { supplyGrant, SUPPLY_MAX } from '../../online/supply.js';
import { getBackend } from '../../online/backend.js';
import { formatRetry } from '../../online/limits.js';

const PRESETS = [1, 10, 100, 1000, 99999];
const BOT_FACE = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="16" width="44" height="36" rx="12" fill="#e8f4ff" stroke="#22385c" stroke-width="3"/><path d="M32 6v10" stroke="#22385c" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="6" r="4" fill="#ff7aa8" stroke="#22385c" stroke-width="2"/><circle cx="24" cy="33" r="4.5" fill="#2b7fff"/><circle cx="40" cy="33" r="4.5" fill="#2b7fff"/><path d="M24 43q8 5 16 0" fill="none" stroke="#22385c" stroke-width="3" stroke-linecap="round"/><rect x="4" y="28" width="6" height="12" rx="3" fill="#ffdd4a" stroke="#22385c" stroke-width="2"/><rect x="54" y="28" width="6" height="12" rx="3" fill="#ffdd4a" stroke="#22385c" stroke-width="2"/></svg>';

export function createSupplyBot() {
  let tab = BACKPACK_TABS[0].id;
  let picked = null;
  const grid = h('div.ol-sb-grid', { 'data-testid': 'supply-grid' });
  const tabs = h('div.ol-seg.ol-sb-tabs');
  const qty = h('input.ol-input.ol-sb-qty', { type: 'number', min: 1, max: SUPPLY_MAX, value: 100, 'data-testid': 'supply-qty' });
  const presets = h('div.ol-sb-presets', PRESETS.map((n) => h('button.ol-chip-btn', { type: 'button', onclick: () => { qty.value = String(n); } }, formatNumber(n))));
  const pickedEl = h('div.ol-sb-picked');
  const log = h('ul.ol-sb-log', { 'data-testid': 'supply-log' });

  function paintTabs() {
    tabs.replaceChildren(...BACKPACK_TABS.map((t) => h(`button.ol-seg-btn${t.id === tab ? '.on' : ''}`, { type: 'button', onclick: () => { tab = t.id; paintTabs(); paintGrid(); } }, t.name)));
  }
  function paintGrid() {
    const items = itemsByTab(tab);
    const pick = (id) => {
      picked = id;
      paintGrid();
      paintPicked();
    };
    grid.replaceChildren(...items.map((it) => h(`div.ol-sb-item${picked === it.id ? '.on' : ''}`, { title: it.name },
      itemTile(it.id, itemCount(store.profile, it.id), { size: 56, onClick: pick }))));
  }
  function paintPicked() {
    const it = picked && getItem(picked);
    pickedEl.replaceChildren(it ? h('span', 'Selected: ', h('b', it.name), h('small.muted', ` · you have ${formatNumber(itemCount(store.profile, it.id))}`)) : h('span.muted', 'Pick an item on the left.'));
  }

  const grant = button('Grant', {
    kind: 'yellow', icon: 'gift', testid: 'supply-grant',
    onClick: () => {
      if (!picked) {
        toast('Pick an item first.', 'info');
        return;
      }
      const v = getBackend().limiter.hit('dev_grant');
      if (!v.ok) {
        toast(`Supply Bot is recharging — ${formatRetry(v.retryMs)}`, 'info');
        return;
      }
      const res = supplyGrant(store.profile, picked, qty.value);
      if (!res) {
        toast('Enter a quantity of 1 or more.', 'bad');
        return;
      }
      store.commit('supply-bot');
      const it = getItem(picked);
      toast(`Supply Bot delivered ${formatNumber(res[0].count)} × ${it.name}`, 'good');
      log.prepend(h('li', h('b', `+${formatNumber(res[0].count)}`), ` ${it.name}`, h('small.muted', ` · ${new Date().toLocaleTimeString()}`)));
      while (log.children.length > 6) log.lastElementChild.remove();
      paintGrid();
      paintPicked();
    },
  });

  paintTabs();
  paintGrid();
  paintPicked();
  const el = h('section.ol-sb', { 'data-testid': 'supply-bot' },
    h('div.ol-sb-banner', { role: 'note' }, h('b', 'DEVELOPER SANDBOX'), h('span', 'Items from the Supply Bot are for testing. They skip normal progression — do not use on a save you care about.')),
    h('div.ol-sb-body',
      h('div.ol-sb-left', tabs, grid),
      h('div.ol-sb-right',
        h('div.ol-sb-bot', svgEl(BOT_FACE, 'ol-sb-face'), h('div', h('b', 'Supply Bot'), h('p.muted', 'Beep! Any material, currency or ticket, any amount.'))),
        pickedEl,
        h('label.ol-label', 'Quantity'), qty, presets,
        grant,
        log)));
  return { el, destroy: () => el.remove() };
}
