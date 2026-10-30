// [ui-ink] Which currencies a screen's top bar shows (notes/ui-v2/UI_V2_DIRECTION.md section 10, Q3): only the ones the
// screen spends. The home all three; the girl page coins and gems; the Mall the active shop's (General coins and gems
// with "+", as its mock-up draws it, section 12.11; gems on the Gem Shop; a token shop keeps its own wallet in its
// plate header until V5 moves it into the bar, so the bar shows none); Recruit tickets and gems; the Backpack as today
// (coins and gems). Every hub, list, the roster, stage prep and the rest: none.
// Pure (no DOM): components.js currencyPills() draws them, tests/ui/wallets.test.js checks the table.
// Icons (owner, Oct 27: "for the coins and premium currency bring back the color icons"): coins and gems wear their
// colour art (`art`: a src/art/icons.js currencyIcon kind, drawn by kit.js curArt()); tickets keep their line glyph.

/** The wallets the bar can show, in their order (an icon each: `art` colour art or `glyph` a line glyph; "+" opens where to get more). */
export const WALLET_DEFS = Object.freeze({
  tickets: { item: 'ticket_recruit', glyph: 'ticket', art: null, label: 'Recruit Tickets', plus: { route: 'mall', params: { tab: 'recruit' }, label: 'Get tickets' } },
  coins: { item: 'coins', glyph: null, art: 'coins', label: 'Coins', plus: null },
  gems: { item: 'gems', glyph: null, art: 'gems', label: 'Gems', plus: { route: 'mall', params: { tab: 'gems' }, label: 'Get gems' } },
});

/** The currencies that wear their colour art wherever a balance or a price shows (kit.js curArt). */
export const COLOUR_CURRENCIES = Object.freeze(['coins', 'gems']);
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

// ---------------------------------------------------------------------------------------------------------------
// A mode's own currency (Tryout Day's Marbles, an event's token): registered once by the mode's module, shown in the
// bar on that mode's screens only, in WALLET_ORDER after the core three.
// ---------------------------------------------------------------------------------------------------------------
const EXTRA = new Map();

/**
 * Registers a mode currency for the top bar.
 * @param {{ id: string, item?: string|null, count?: ((profile: object) => number)|null, label: string, art?: string|null,
 *   glyph?: string|null, plus?: { route: string, params?: object, label: string }|null, screens: string[] }} def
 *   item: the save's item id (itemCount), or count: reads the balance from the save itself (a mode that keeps it
 *   elsewhere: Tryout Day's Marbles in its mission counters; it only reads, never writes); art: a colour icon kind
 *   (kit.js curArt) or glyph: a line glyph name; screens: the route names whose bar shows it
 */
export function registerWallet({ id, item = null, count = null, label, art = null, glyph = null, plus = null, screens = [] }) {
  if (!id || WALLET_DEFS[id] || EXTRA.has(id)) throw new Error(`registerWallet: "${id}" is taken or empty`);
  if (!item && typeof count !== 'function') throw new Error(`registerWallet: "${id}" needs an item or a count(profile)`);
  EXTRA.set(id, Object.freeze({ item, count, label, art, glyph: glyph || (art ? null : 'sparkles'), plus, screens: Object.freeze([...screens]) }));
}

/** A wallet's definition: a core one (WALLET_DEFS) or a registered mode currency (null when unknown). */
export const walletDef = (id) => WALLET_DEFS[id] || EXTRA.get(id) || null;

const RO = new WeakMap();
/** A read-only view of the save for a mode's count(profile): any write throws, so a top bar never changes the save. */
function readOnly(o) {
  if (!o || typeof o !== 'object') return o;
  let v = RO.get(o);
  if (!v) {
    const no = () => { throw new TypeError('a wallet count(profile) must not write to the save'); };
    v = new Proxy(o, { get: (t, k) => readOnly(Reflect.get(t, k)), set: no, deleteProperty: no, defineProperty: no, setPrototypeOf: no });
    RO.set(o, v);
  }
  return v;
}

/**
 * A wallet's balance: its count(profile) when it has one (a whole number, never below 0; it gets a read-only view of
 * the save, so a write throws), else the save's item count.
 * @param {string} id
 * @param {object} profile the save (only read)
 * @param {(profile: object, item: string) => number} itemCount the inventory reader (systems/inventory.js itemCount)
 */
export function walletValue(id, profile, itemCount) {
  const d = walletDef(id);
  if (!d) return 0;
  if (typeof d.count === 'function') return Math.max(0, Math.floor(Number(d.count(readOnly(profile))) || 0));
  return itemCount(profile, d.item);
}

/**
 * @param {string|null|undefined} screen a route name
 * @param {{ tab?: string }} [params] the route's params (the Mall's shop)
 * @returns {string[]} wallet ids (WALLET_DEFS keys), in WALLET_ORDER
 */
export function walletsFor(screen, params = {}) {
  let ids = [];
  if (screen === 'mall') ids = MALL_WALLETS[params?.tab] ?? MALL_WALLETS.general;
  else ids = SCREEN_WALLETS[screen] || [];
  const extra = [...EXTRA].filter(([, d]) => d.screens.includes(screen)).map(([id]) => id);
  return [...WALLET_ORDER.filter((w) => ids.includes(w)), ...extra];
}
