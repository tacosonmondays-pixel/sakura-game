// [ui-ink] Which currencies a screen's top bar shows (notes/ui-v2/UI_V2_DIRECTION.md section 10, Q3): only the ones the
// screen spends. The home all three; the girl page coins and gems; the Mall the active shop's (General coins and gems
// with "+", as its mock-up draws it, section 12.11; gems on the Gem Shop; a token shop keeps its own wallet in its
// plate header until V5 moves it into the bar, so the bar shows none); Recruit tickets and gems; the Backpack as today
// (coins and gems). Every hub, list, the roster, stage prep and the rest: none.
// Pure (no DOM): components.js currencyPills() draws them, tests/ui/wallets.test.js checks the table.

/** The wallets the bar can show, in their order (a line glyph each; "+" opens where to get more). */
export const WALLET_DEFS = Object.freeze({
  tickets: { item: 'ticket_recruit', glyph: 'ticket', label: 'Recruit Tickets', plus: { route: 'mall', params: { tab: 'recruit' }, label: 'Get tickets' } },
  coins: { item: 'coins', glyph: 'coin', label: 'Coins', plus: null },
  gems: { item: 'gems', glyph: 'gem', label: 'Gems', plus: { route: 'mall', params: { tab: 'gems' }, label: 'Get gems' } },
});
export const WALLET_ORDER = Object.freeze(['tickets', 'coins', 'gems']);

/** Screens that spend currencies (route name → wallets). Everything else shows none. */
export const SCREEN_WALLETS = Object.freeze({
  lobby: ['tickets', 'coins', 'gems'],
  student: ['coins', 'gems'],
  recruit: ['tickets', 'gems'],
  backpack: ['coins', 'gems'],
});

/** The Mall: the active shop's own bar currencies (the token shops keep their wallet chip in the plate header). */
export const MALL_WALLETS = Object.freeze({
  general: ['coins', 'gems'],
  gems: ['gems'],
  recruit: [],
  boss: [],
  bounty: [],
  memento: [],
});

/**
 * @param {string|null|undefined} screen a route name
 * @param {{ tab?: string }} [params] the route's params (the Mall's shop)
 * @returns {string[]} wallet ids (WALLET_DEFS keys), in WALLET_ORDER
 */
export function walletsFor(screen, params = {}) {
  let ids = [];
  if (screen === 'mall') ids = MALL_WALLETS[params?.tab] ?? MALL_WALLETS.general;
  else ids = SCREEN_WALLETS[screen] || [];
  return WALLET_ORDER.filter((w) => ids.includes(w));
}
