// [workbench] The in-tab "ready" toast (docs/specs/BANNERS.md §G: no push notifications). While the game is open
// and visible, a Workbench craft that finishes toasts once, outside battles (one finishing mid-battle toasts after
// it), and the lobby's Backpack dock button gets its dot. Read-only: it never writes the save ('wb:seen' is only
// written on Workbench actions).
import { slotState } from '../systems/workbench.js';
import { WB_MAX_SLOTS } from '../data/workbench.js';
import { currentRoute } from './router.js';

const EVERY_MS = 15000;

/** @param {{ profile: object }} store */
export function installWorkbenchWatch(store) {
  if (typeof window === 'undefined') return () => {};
  const told = new Set();
  // crafts already done when the game opens are announced by the lobby dot, not a toast
  const readyNow = () => {
    const out = [];
    for (let s = 1; s <= WB_MAX_SLOTS; s++) {
      const st = slotState(store.profile, s, Date.now());
      if (st.ready) out.push({ key: `${s}:${st.recipeId}`, st });
    }
    return out;
  };
  for (const r of readyNow()) told.add(r.key);
  const tick = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    const ready = readyNow();
    // a slot collected (or emptied) since: its next craft may toast again
    for (const k of [...told]) if (!ready.some((r) => r.key === k)) told.delete(k);
    if (!ready.length) return;
    const route = currentRoute().name;
    if (route === 'lobby') {
      // the home's Menu button wears the dot (its Backpack row does too, once the menu opens)
      const btn = document.querySelector('[data-testid="top-menu"]');
      if (btn && !btn.querySelector('.ui-dot')) {
        const dot = document.createElement('i');
        dot.className = 'ui-dot';
        dot.dataset.testid = 'top-menu-dot';
        btn.appendChild(dot);
      }
    }
    if (route === 'battle') return;
    const fresh = ready.filter((r) => !told.has(r.key));
    if (!fresh.length) return;
    for (const r of fresh) told.add(r.key);
    const names = fresh.map((r) => r.st.recipe.out.map((o) => o.id)).flat();
    import('./components.js').then(({ toast }) => import('../data/items.js').then(({ ITEMS }) => {
      const what = fresh.length === 1 ? (ITEMS[names[0]]?.name || 'A craft') : `${fresh.length} crafts`;
      toast(`Workbench: ${what} ${fresh.length === 1 ? 'is' : 'are'} ready to collect!`, 'good', 4200);
    })).catch(() => {});
  };
  const timer = setInterval(tick, EVERY_MS);
  return () => clearInterval(timer);
}
