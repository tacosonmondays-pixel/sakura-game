// Mall: tabs, offers, stock limits and purchases (owner: systems). See CONTRACTS.md §5
// and src/data/shop.js.

import { SHOP_TABS, SHOP_OFFERS, SHOP_OFFER_MAP } from '../data/shop.js';
import { dayKey, weekKey } from '../core/util.js';
import { addItems, consumeItems, itemCount } from './inventory.js';
import { isOwned } from './unlocks.js';
import { spark } from './gacha.js';
import { track } from './missions.js';

/** Reset daily/weekly stock counters when the day/week changed. Idempotent. */
export function refreshShop(profile, now = new Date()) {
  const shop = (profile.shop ||= { day: null, week: null, bought: {} });
  shop.bought ||= {};
  const day = dayKey(now);
  const week = weekKey(now);
  if (shop.day !== day) {
    for (const o of SHOP_OFFERS) if (o.resets === 'daily') delete shop.bought[o.id];
    shop.day = day;
  }
  if (shop.week !== week) {
    for (const o of SHOP_OFFERS) if (o.resets === 'weekly') delete shop.bought[o.id];
    shop.week = week;
  }
  return shop;
}

/** Balance of a shop currency ('coins'|'gems'|'recruitPoints'|'token_boss'|'token_bounty'). */
export function currencyBalance(profile, currency) {
  return itemCount(profile, currency);
}

function describeOffer(profile, offer) {
  const bought = profile.shop.bought[offer.id] || 0;
  const limited = offer.resets != null && offer.stock != null;
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
    soldOut: limited && bought >= offer.stock,
    affordable: currencyBalance(profile, offer.currency) >= offer.price,
    owned: offer.unitId ? isOwned(profile, offer.unitId) : undefined,
    highlight: !!offer.highlight,
  };
}

/**
 * Mall tabs with live stock.
 * @returns {{ id, name, desc, currency, balance, offers: object[] }[]}
 */
export function shopTabs(profile, now = new Date()) {
  refreshShop(profile, now);
  return SHOP_TABS.map((tab) => ({
    id: tab.id,
    name: tab.name,
    desc: tab.desc,
    currency: tab.currency,
    balance: currencyBalance(profile, tab.currency),
    offers: SHOP_OFFERS.filter((o) => o.tab === tab.id).map((o) => describeOffer(profile, o)),
  }));
}

/**
 * Buy an offer `qty` times. Payment and stock are checked before anything changes.
 * Spark offers grant the unit (duplicates → Star Fragments) and ignore qty.
 * @returns {{ ok: boolean, error?: 'unknown'|'qty'|'soldOut'|'funds', rewards: object[], unit?: object }}
 */
export function buyOffer(profile, offerId, qty = 1, now = new Date()) {
  const offer = SHOP_OFFER_MAP[offerId];
  if (!offer) return { ok: false, error: 'unknown', rewards: [] };
  refreshShop(profile, now);
  const n = offer.unitId ? 1 : Math.floor(qty);
  if (!(n >= 1)) return { ok: false, error: 'qty', rewards: [] };
  const bought = profile.shop.bought[offer.id] || 0;
  if (offer.resets != null && offer.stock != null && bought + n > offer.stock) return { ok: false, error: 'soldOut', rewards: [] };
  if (offer.unitId) {
    const r = spark(profile, offer.unitId);
    if (!r.ok) return { ok: false, error: r.error === 'points' ? 'funds' : 'unknown', rewards: [] };
    profile.shop.bought[offer.id] = bought + 1;
    return { ok: true, rewards: r.fragments ? [{ id: 'star_fragment', count: r.fragments }] : [], unit: { unitId: r.unitId, isNew: r.isNew, fragments: r.fragments } };
  }
  const price = offer.price * n;
  if (!consumeItems(profile, [{ id: offer.currency, count: price }])) return { ok: false, error: 'funds', rewards: [] };
  profile.shop.bought[offer.id] = bought + n;
  if (offer.currency === 'coins') track(profile, 'spendCoins', price);
  return { ok: true, rewards: addItems(profile, [{ id: offer.item, count: offer.count * n }]) };
}
