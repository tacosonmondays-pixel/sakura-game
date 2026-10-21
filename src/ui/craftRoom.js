// The Craft Room sheet (docs/specs/ASCENSION.md §B.6, §D.5): from a family material's info sheet,
// Combine (3 → 1 of the next tier) or Swap (2 → 1 into another family), both for coins, with a live
// price. Always the full name "Craft Room": "Workshop" already names the Workshop Yard bounty.
import './styles/meta-b.css';
import { h } from './dom.js';
import { modal, button, toast, svgEl, itemTile } from './components.js';
import { store } from '../core/store.js';
import { formatNumber } from '../core/util.js';
import { ITEMS } from '../data/items.js';
import { MATERIAL_FAMILIES } from '../data/types.js';
import { itemIcon } from '../art/icons.js';
import { craftInfo, craftPreview, craft } from '../systems/craft.js';
import { itemCount } from '../systems/inventory.js';

const REASON = { missing: 'Not enough materials or coins', weekly: 'Weekly limit reached', top: 'Zenith is the top tier', family: 'Pick another family' };

/** Open the Craft Room for one family material. */
export function openCraftRoom(itemId, onDone = null) {
  const info = craftInfo(itemId);
  if (!info) return null;
  let qty = 1;
  let toFamily = Object.keys(MATERIAL_FAMILIES).find((f) => f !== info.family);
  const body = h('div.craft-room', { 'data-testid': 'craft-room' });
  const draw = () => {
    body.replaceChildren();
    const have = itemCount(store.profile, itemId);
    const comb = craftPreview(store.profile, 'combine', itemId, qty);
    const swap = craftPreview(store.profile, 'swap', itemId, qty, toFamily);
    const line = (p, label, kind, testid) => h('div.craft-row',
      h('div.craft-flow',
        itemTile(p.in.id, p.in.count || null, { size: 44, onClick: () => {} }), h('b', '→'), itemTile(p.out.id, p.out.count || null, { size: 44, onClick: () => {} })),
      h('div.craft-meta',
        h('b', label),
        h('span.muted', `${formatNumber(p.coins)} coins${Number.isFinite(p.left) ? ` · ${p.left} left this week` : ''}`),
        !p.ok && p.reason ? h('span.craft-why', REASON[p.reason] || '') : null),
      button(kind === 'combine' ? 'Combine' : 'Swap', {
        kind: p.ok ? 'yellow' : 'ghost', small: true, disabled: !p.ok, testid,
        onClick: () => {
          const r = craft(store.profile, kind, itemId, qty, kind === 'swap' ? toFamily : null);
          if (!r.ok) {
            toast(REASON[r.reason] || 'Cannot craft that.', 'bad');
            return;
          }
          store.commit('craft');
          toast(`Crafted ${ITEMS[r.out.id].name} ×${r.out.count}`, 'good');
          onDone?.();
          draw();
        },
      }));
    body.append(
      h('p.muted', `${ITEMS[itemId].name} · owned ${formatNumber(have)}`),
      h('div.craft-qty', h('span', 'Results'), h('button.chip', { onclick: () => { qty = Math.max(1, qty - 1); draw(); } }, '−'), h('b', String(qty)), h('button.chip', { onclick: () => { qty = Math.min(99, qty + 1); draw(); } }, '+')),
      comb.reason === 'top' ? null : line(comb, 'Combine 3 → 1', 'combine', 'craft-combine'),
      h('div.craft-fams', Object.keys(MATERIAL_FAMILIES).filter((f) => f !== info.family).map((f) => h(`button.chip${f === toFamily ? '.on' : ''}`, { title: MATERIAL_FAMILIES[f].name, onclick: () => { toFamily = f; draw(); } }, svgEl(itemIcon(swap.out.id.replace(`_${info.family}_`, `_${f}_`).replace(/^mat_[a-z]+_/, `mat_${f}_`)), 'craft-fam-ico')))),
      line(swap, `Swap 2 → 1 (${MATERIAL_FAMILIES[toFamily].name})`, 'swap', 'craft-swap'),
    );
  };
  draw();
  return modal({ title: 'Craft Room', body, actions: [{ label: 'Close', kind: 'ghost' }] });
}
