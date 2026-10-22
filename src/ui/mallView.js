// UI M5c: what the Mall shows besides its offers (docs/specs/UI_DIRECTION.md P2, P7, §5.5, §5.9, §5.10 E3; notes Q6).
// Pure (no DOM): src/ui/screens/mall.js draws it, tests/ui/mallView.test.js checks the rules.
//
// - The rail: all six shops, one word each (Q6: six one-word tabs fit the rail at 844 x 390; the fallback would group
//   Boss + Bounty as "Tokens").
// - Each balance once (P7): coins and gems live in the top bar's currency pills, so their shops show no wallet; a
//   token shop shows its wallet ONCE, as one chip in the plate header (the Memento Exchange: both of its currencies
//   in that one chip).
// - The restock: one countdown chip in the plate header for the shop's own cycle (daily at local midnight, weekly on
//   Monday, or the game week for the Memento Exchange); a game-week shelf inside a shop (the Titan shelf) carries its
//   own chip on its shelf title. Recurring cycles: never red (§5.9 note).

/** The currencies the top bar's pills already show (components.js currencyPills). */
export const BAR_CURRENCIES = Object.freeze(['coins', 'gems']);

/** The rail: one word and one icon per shop (the tab ids, and so the tab-<id> test ids, never change). */
export const SHOP_RAIL = Object.freeze({
  general: { label: 'General', icon: 'coin' },
  gems: { label: 'Gems', icon: 'crystal' },
  recruit: { label: 'Recruit', icon: 'gacha' },
  boss: { label: 'Boss', icon: 'assault' },
  bounty: { label: 'Bounty', icon: 'bounty' },
  memento: { label: 'Memento', icon: 'sparkle' },
});

/** The rail's tabs for shopTabs() (an unknown shop: its first word). */
export function railTabs(tabs) {
  return tabs.map((t) => ({ id: t.id, label: SHOP_RAIL[t.id]?.label || String(t.name).split(' ')[0], icon: SHOP_RAIL[t.id]?.icon || 'mall' }));
}

/**
 * The wallets a shop shows in its plate header: every currency it is paid with that the top bar does not show.
 * @param {{ wallets: { currency: string, balance: number }[] }} tab a shopTabs() row
 * @returns {{ currency: string, balance: number }[]} [] for the coin and gem shops
 */
export function walletChips(tab) {
  return (tab?.wallets || []).filter((w) => !BAR_CURRENCIES.includes(w.currency));
}

/**
 * Where each balance shows on a shop screen: 'bar' (the top bar's pills) or 'head' (the wallet chip). Every currency
 * the shop is paid with shows exactly once.
 * @returns {Record<string, ('bar'|'head')[]>}
 */
export function balancePlaces(tab) {
  const out = {};
  for (const c of BAR_CURRENCIES) out[c] = ['bar'];
  for (const w of walletChips(tab)) (out[w.currency] ||= []).push('head');
  return out;
}

/** An offer on a game-week shelf (the Titan shelves, the Memento Exchange: Sunday 7 PM Central). */
export const onGameWeek = (o) => !!o.section || o.currency === 'memento' || o.currency === 'moonpearl';

/** An offer's restock cycle: 'daily', 'weekly' (local Monday), 'game' (the game week) or null (never). */
export function cycleOf(o) {
  if (!o?.resets || o.resets === 'never') return null;
  if (onGameWeek(o)) return 'game';
  return o.resets === 'daily' ? 'daily' : 'weekly';
}

/**
 * The shop's restock chip: the cycle most of its limited offers outside a shelf follow (General: daily; the Gem Shop,
 * Bounty and Boss Exchanges: weekly; the Memento Exchange: the game week), or null when none restock. An offer on
 * another cycle says its own on its card (stockLine).
 */
export function restockKind(tab) {
  const n = { daily: 0, weekly: 0, game: 0 };
  for (const o of tab?.offers || []) {
    const c = !o.section && o.stock != null ? cycleOf(o) : null;
    if (c) n[c]++;
  }
  const best = Object.entries(n).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : null;
}

/** The chip's caps label for a restock kind. */
export const RESTOCK_LABEL = Object.freeze({ daily: 'Daily', weekly: 'Weekly', game: 'Weekly' });

/** Midori's state (hostLines.js 'mall'): the shop restocks within the hour. */
export function mallHostState(msToRestock) {
  return { restockSoon: Number.isFinite(msToRestock) && msToRestock > 0 && msToRestock < 3600e3 };
}

/**
 * An offer's stock line: "3/4 left" on the shop's own cycle (the plate header's chip says it) or on a shelf with its
 * own chip; an offer on another cycle names it ("Weekly 1/1"); "Sold out"; null when its stock is unlimited.
 * @param {object} o a shopTabs() offer
 * @param {string|null} [shopKind] restockKind() of its shop
 */
export function stockLine(o, shopKind = null) {
  if (o.away) return 'Back next week';
  if (o.blocked) return 'No SSR can hold more';
  if (o.stock == null) return null;
  if (!(o.remaining > 0)) return 'Sold out';
  const c = cycleOf(o);
  if (o.section || !c || c === shopKind) return `${o.remaining}/${o.stock} left`;
  return `${RESTOCK_LABEL[c]} ${o.remaining}/${o.stock}`;
}
