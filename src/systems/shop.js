// Mall: tabs, offers, stock limits and purchases (owner: systems). See CONTRACTS.md §5
// and src/data/shop.js.
//
// Ascension's rows (docs/specs/ASCENSION.md §A.5, §C.10) run on the GAME week (Sunday 7 PM Central,
// src/core/reset.js) with their own marker 'shopwk:asc' in missions.counters: when it differs from
// this game week, their counts (and their groups') are cleared. An older tab that rolls the local
// week first therefore never leaves them sold out, and the local-week reset below never touches them.

import { SHOP_TABS, SHOP_OFFERS, SHOP_OFFER_MAP, stockKey } from '../data/shop.js';
import { UNIT_MAP } from '../data/units.js';
import { dayKey, weekKey } from '../core/util.js';
import { gameWeekNumber } from '../core/reset.js';
import { addItems, consumeItems, itemCount } from './inventory.js';
import { isOwned, ownedUnits } from './unlocks.js';
import { spark } from './gacha.js';
import { track } from './missions.js';
import { kindredUseful, canAddChosenEssence, addChosenEssence, fuseShards, essenceBalance, essenceCap } from './essence.js';

/** missions.counters key: the game week Ascension's rows were last reset for. */
export const ASC_SHOP_MARK = 'shopwk:asc';

const isGameClock = (o) => o.clock === 'game';

/** Reset daily/weekly stock counters when the day/week changed. Idempotent. */
export function refreshShop(profile, now = new Date()) {
  const shop = (profile.shop ||= { day: null, week: null, bought: {} });
  shop.bought ||= {};
  const day = dayKey(now);
  const week = weekKey(now);
  if (shop.day !== day) {
    for (const o of SHOP_OFFERS) if (o.resets === 'daily' && !isGameClock(o)) delete shop.bought[o.id];
    shop.day = day;
  }
  if (shop.week !== week) {
    for (const o of SHOP_OFFERS) if (o.resets === 'weekly' && !isGameClock(o)) delete shop.bought[o.id];
    shop.week = week;
  }
  const c = ((profile.missions ||= {}).counters ||= {});
  const gw = gameWeekNumber(+now);
  if (c[ASC_SHOP_MARK] !== gw) {
    for (const o of SHOP_OFFERS) if (isGameClock(o)) delete shop.bought[stockKey(o)];
    c[ASC_SHOP_MARK] = gw;
  }
  return shop;
}

/** Balance of a shop currency ('coins'|'gems'|'recruitPoints'|'token_boss'|'token_bounty'|'memento'|'moonpearl'). */
export function currencyBalance(profile, currency) {
  return itemCount(profile, currency);
}

/** Owned SSR girls who can take one more Essence (the Chosen SSR Essence row). */
export function chosenEssenceTargets(profile, rarity = 'SSR') {
  return ownedUnits(profile).filter((id) => UNIT_MAP[id]?.rarity === rarity && canAddChosenEssence(profile, id));
}

/** Does a row show at all? (§A.4 "no dead rows") */
function rowShows(profile, o) {
  if (!o.needs) return true;
  if (o.needs.startsWith('kindred:')) return kindredUseful(profile, o.needs.slice(8));
  if (o.needs === 'nightmareClear') return Object.entries(profile.missions?.counters || {}).some(([k, v]) => k.startsWith('tbest:') && v >= 3);
  if (o.needs === 'ownedSSR') return ownedUnits(profile).some((id) => UNIT_MAP[id]?.rarity === 'SSR');
  return true;
}

/** Off this week (an every-other-week row on an odd game week). */
const offWeek = (o, now) => !!o.everyOtherWeek && gameWeekNumber(+now) % 2 === 1;

function describeOffer(profile, offer, now) {
  const bought = profile.shop.bought[stockKey(offer)] || 0;
  const limited = offer.resets != null && offer.stock != null;
  const away = offWeek(offer, now);
  const chosen = offer.chosenEssence ? chosenEssenceTargets(profile, offer.chosenEssence) : null;
  return {
    id: offer.id,
    item: offer.item,
    unitId: offer.unitId || null,
    count: offer.count,
    price: offer.price,
    currency: offer.currency,
    stock: limited ? offer.stock : null,
    bought,
    remaining: limited ? Math.max(0, offer.stock - bought) : null,
    resets: offer.resets,
    soldOut: (limited && bought >= offer.stock) || away,
    away,
    affordable: currencyBalance(profile, offer.currency) >= offer.price,
    owned: offer.unitId ? isOwned(profile, offer.unitId) : undefined,
    highlight: !!offer.highlight,
    section: offer.section || null,
    group: offer.group || null,
    family: offer.family || null,
    chosenEssence: offer.chosenEssence || null,
    // a Chosen Essence row with nobody below her hold cap is greyed (§A.5)
    blocked: chosen ? !chosen.length : false,
    targets: chosen,
  };
}

/**
 * Mall tabs with live stock.
 * @returns {{ id, name, desc, currency, balance, wallets: { currency: string, balance: number }[], offers: object[] }[]}
 */
export function shopTabs(profile, now = new Date()) {
  refreshShop(profile, now);
  return SHOP_TABS.map((tab) => ({
    id: tab.id,
    name: tab.name,
    desc: tab.desc,
    currency: tab.currency,
    balance: currencyBalance(profile, tab.currency),
    wallets: (tab.wallets || [tab.currency]).map((c) => ({ currency: c, balance: currencyBalance(profile, c) })),
    offers: SHOP_OFFERS.filter((o) => o.tab === tab.id && rowShows(profile, o)).map((o) => describeOffer(profile, o, now)),
  }));
}

/**
 * Buy an offer `qty` times. Payment and stock are checked before anything changes.
 * Spark offers grant the unit (a duplicate gives her Essence) and ignore qty. A Chosen Essence row
 * needs `opts.unitId` (an owned girl of its rarity below her hold cap) and ignores qty.
 * @returns {{ ok: boolean, error?: 'unknown'|'qty'|'soldOut'|'funds'|'hidden'|'pick', rewards: object[], unit?: object, fused?: object[] }}
 */
export function buyOffer(profile, offerId, qty = 1, now = new Date(), opts = {}) {
  const offer = SHOP_OFFER_MAP[offerId];
  if (!offer) return { ok: false, error: 'unknown', rewards: [] };
  refreshShop(profile, now);
  if (!rowShows(profile, offer)) return { ok: false, error: 'hidden', rewards: [] };
  if (offWeek(offer, now)) return { ok: false, error: 'soldOut', rewards: [] };
  const single = offer.unitId || offer.chosenEssence;
  const n = single ? 1 : Math.floor(qty);
  if (!(n >= 1)) return { ok: false, error: 'qty', rewards: [] };
  const key = stockKey(offer);
  const bought = profile.shop.bought[key] || 0;
  if (offer.resets != null && offer.stock != null && bought + n > offer.stock) return { ok: false, error: 'soldOut', rewards: [] };
  if (offer.unitId) {
    const r = spark(profile, offer.unitId);
    if (!r.ok) return { ok: false, error: r.error === 'points' ? 'funds' : 'unknown', rewards: [] };
    profile.shop.bought[key] = bought + 1;
    const rewards = r.spare ? [{ id: 'memento', count: r.spare.mementos }, { id: 'moonpearl', count: r.spare.moonpearls }].filter((x) => x.count > 0) : [];
    return { ok: true, rewards, unit: { unitId: r.unitId, isNew: r.isNew, essence: r.essence, spare: r.spare, potential: r.potential, essenceHeld: r.essenceHeld, readyStep: r.readyStep } };
  }
  if (offer.chosenEssence) {
    const id = opts.unitId;
    if (!id || UNIT_MAP[id]?.rarity !== offer.chosenEssence || !canAddChosenEssence(profile, id)) return { ok: false, error: 'pick', rewards: [] };
    if (!consumeItems(profile, [{ id: offer.currency, count: offer.price }])) return { ok: false, error: 'funds', rewards: [] };
    addChosenEssence(profile, id);
    profile.shop.bought[key] = bought + 1;
    return { ok: true, rewards: [], essence: { unitId: id, held: essenceBalance(profile, id), cap: essenceCap(profile.units[id]) } };
  }
  const price = offer.price * n;
  if (!consumeItems(profile, [{ id: offer.currency, count: price }])) return { ok: false, error: 'funds', rewards: [] };
  profile.shop.bought[key] = bought + n;
  if (offer.currency === 'coins') track(profile, 'spendCoins', price);
  const rewards = addItems(profile, [{ id: offer.item, count: offer.count * n }]);
  const fused = fuseShards(profile);
  return { ok: true, rewards, fused };
}
