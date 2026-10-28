// The Craft Room sheet (docs/specs/ASCENSION.md §B.6, §D.5): from a family material's item sheet, Combine (3 → 1 of
// the next tier) or Swap (2 → 1 into another family), both for coins, with a live price. Always the full name "Craft
// Room": "Workshop" already names the Workshop Yard bounty.
// UI v2 M2: a kit bottom sheet (src/ui/sheet.js) with item tiles; each recipe is one row (in → out, its price with the
// colour coin, one ink action); the quantity and the target family are kit options; no yellow (the rows are
// alternatives, neither is the screen's one primary). Styles: src/ui/styles/v2-backpack.css ("CRAFT ROOM").
import './styles/meta-b.css';
import './styles/v2-backpack.css';
import { h } from './dom.js';
import { toast, itemTile } from './components.js';
import { inkBtn, curArt, num, lbl, fillIn } from './kit.js';
import { openSheet } from './sheet.js';
import { fmtNum } from './format.js';
import { store } from '../core/store.js';
import { ITEMS } from '../data/items.js';
import { MATERIAL_FAMILIES } from '../data/types.js';
import { itemIcon } from '../art/icons.js';
import { craftInfo, craftPreview, craft } from '../systems/craft.js';
import { itemCount } from '../systems/inventory.js';

const REASON = { missing: 'Not enough materials or coins', weekly: 'Weekly limit reached', top: 'Zenith is the top tier', family: 'Pick another family' };

/** The same material in another family (the swap target's tile). */
const famItem = (outId, from, to) => outId.replace(`_${from}_`, `_${to}_`).replace(/^mat_[a-z]+_/, `mat_${to}_`);

/** Open the Craft Room for one family material. */
export function openCraftRoom(itemId, onDone = null) {
  const info = craftInfo(itemId);
  if (!info) return null;
  let qty = 1;
  let toFamily = Object.keys(MATERIAL_FAMILIES).find((f) => f !== info.family);
  const body = h('div.craft-room.bp-craft', { 'data-testid': 'craft-room' });
  const draw = () => {
    const have = itemCount(store.profile, itemId);
    const comb = craftPreview(store.profile, 'combine', itemId, qty);
    const swap = craftPreview(store.profile, 'swap', itemId, qty, toFamily);
    const act = (p, kind, testid) => {
      const b = inkBtn(kind === 'combine' ? 'Combine' : 'Swap', {
        testid,
        title: !p.ok ? REASON[p.reason] || null : null,
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
      });
      // (a recipe the player cannot pay for: the kit's disabled ink button, and its row says why)
      b.disabled = !p.ok;
      return b;
    };
    // (desktop: tiles big enough for the 13 px count floor; an item tile's count scales with it)
    const tile = globalThis.matchMedia?.('(min-height: 481px)').matches ? 72 : 52;
    const line = (p, label, kind, testid) => h(`div.craft-row.bp-crow${p.ok ? '' : '.no'}`,
      h('div.craft-flow',
        itemTile(p.in.id, p.in.count || null, { size: tile, onClick: () => {} }), h('span.bp-arrow', { 'aria-hidden': 'true' }, '→'), itemTile(p.out.id, p.out.count || null, { size: tile, onClick: () => {} })),
      h('div.craft-meta',
        h('b.bp-crow-t', label),
        h('span.bp-price', curArt('coins'), num(fmtNum(p.coins, 'money', { round: 'up' }), 's'), Number.isFinite(p.left) ? h('span.bp-left', `${p.left} left this week`) : null),
        !p.ok && p.reason ? h('span.craft-why', REASON[p.reason] || '') : null),
      act(p, kind, testid));
    const step = (d, label, testid) => h('button.ui-opt.bp-step', { type: 'button', 'aria-label': label, 'data-testid': testid, onclick: () => { qty = Math.max(1, Math.min(99, qty + d)); draw(); } }, h('span', d < 0 ? '−' : '+'));
    fillIn(body,
      h('div.bp-craft-top',
        h('span.bp-owned', lbl('Owned'), num(fmtNum(have, 'count', { detail: true }), 's')),
        h('div.craft-qty.bp-qty', lbl('Results'), step(-1, 'One fewer', 'craft-less'), num(String(qty), 's'), step(1, 'One more', 'craft-more'))),
      comb.reason === 'top' ? null : line(comb, 'Combine 3 → 1', 'combine', 'craft-combine'),
      h('div.bp-kick', 'Swap into'),
      h('div.craft-fams.bp-opts', Object.keys(MATERIAL_FAMILIES).filter((f) => f !== info.family).map((f) => h(`button.ui-opt.bp-fam${f === toFamily ? '.on' : ''}`, {
        type: 'button', title: MATERIAL_FAMILIES[f].name, 'aria-label': MATERIAL_FAMILIES[f].name, 'aria-pressed': f === toFamily ? 'true' : 'false', 'data-testid': `craft-fam-${f}`,
        onclick: () => { toFamily = f; draw(); },
      }, h('span.bp-opt-ic', { 'aria-hidden': 'true', html: itemIcon(famItem(swap.out.id, info.family, f)) })))),
      line(swap, `Swap 2 → 1 · ${MATERIAL_FAMILIES[toFamily].name}`, 'swap', 'craft-swap'));
  };
  draw();
  return openSheet({ title: `Craft Room · ${ITEMS[itemId].name}`, body, testid: 'craft-sheet', cls: 'bp-sheet' });
}
