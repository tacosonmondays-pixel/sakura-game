// Sakura Sentinels — Mall tabs and offers (owner: systems). See CONTRACTS.md §5.
//
// Plain data. `resets`: 'daily' | 'weekly' | 'never' (lifetime limit) | null (unlimited, stock ignored).
// `currency`: 'coins' | 'gems' | 'recruitPoints' | 'token_boss' | 'token_bounty' | 'memento' | 'moonpearl'
// (an offer's own `currency` wins over its tab's: the Memento Exchange has two wallets).
// Spark offers grant a unit instead of an item (`unitId`, item null).
//
// Ascension's rows (docs/specs/ASCENSION.md §A.5, §C.10) add:
//   section        a shelf header inside the tab ('titan': the Titan shelf)
//   clock: 'game'  weekly stock on the game week (Sunday 7 PM Central), reset by src/systems/shop.js
//                  through its own marker 'shopwk:asc' (an older tab rolling the week never sells them out)
//   group, family  "choose family" rows: one offer per family sharing the group's weekly stock
//   needs          when the row shows: 'kindred:<id>' (a girl can use it), 'nightmareClear' (a Nightmare
//                  titan was won), 'ownedSSR' (Chosen SSR Essence: an owned SSR to pick)
//   everyOtherWeek on sale on even game weeks only ("Back next week" on odd ones)
//   chosenEssence  the row sells 1 Essence of a girl the player picks (rarity)

import { MATERIAL_FAMILIES, GACHA } from './types.js';
import { UNITS } from './units.js';

export const SHOP_TABS = [
  { id: 'general', name: 'General', currency: 'coins', desc: 'Everyday study supplies, paid with coins. Restocks daily.' },
  { id: 'gems', name: 'Gem Shop', currency: 'gems', desc: 'Premium bundles that save time. Weekly stock.' },
  { id: 'recruit', name: 'Recruit Exchange', currency: 'recruitPoints', desc: 'Every recruit earns 1 point. 200 points spark any SSR of your choice.' },
  { id: 'boss', name: 'Boss Exchange', currency: 'token_boss', desc: 'Assault Tokens from minibosses and Total Assault buy crowns and dice.' },
  { id: 'bounty', name: 'Bounty Exchange', currency: 'token_bounty', desc: 'Bounty Tokens buy gear boxes, books and reroll dice.' },
  { id: 'memento', name: 'Memento Exchange', currency: 'memento', wallets: ['memento', 'moonpearl'], desc: 'Spare duplicates become Mementos and Moonpearls. Spend them here.' },
];

/** Game-week rows (the Titan shelves and the Memento Exchange). */
const W = (id, tab, item, count, price, stock, extra = {}) => ({ id, tab, item, count, price, stock, resets: 'weekly', clock: 'game', ...extra });
/** One "choose family" row per family, sharing the group's weekly stock. */
const FAM = (prefix, tab, tier, count, price, stock, extra = {}) => FAMILIES.map((f) => W(`${prefix}_${f}`, tab, tier === 'zenith' ? `mat_${f}_zenith` : `mat_${f}_${tier}`, count, price, stock, { group: prefix, family: f, ...extra }));

const FAMILIES = Object.keys(MATERIAL_FAMILIES);

const o = (id, tab, item, count, price, stock, resets, extra = {}) => ({ id, tab, item, count, price, stock, resets, ...extra });

export const SHOP_OFFERS = [
  // --- General (coins) -------------------------------------------------------
  o('gen_book_common', 'general', 'book_common', 5, 2500, 4, 'daily'),
  o('gen_book_rare', 'general', 'book_rare', 2, 6000, 3, 'daily'),
  ...FAMILIES.map((f) => o(`gen_mat_${f}_common`, 'general', `mat_${f}_common`, 3, 3000, 2, 'daily')),
  ...FAMILIES.map((f) => o(`gen_mat_${f}_rare`, 'general', `mat_${f}_rare`, 1, 8000, 1, 'daily')),
  o('gen_dice', 'general', 'dice_reroll', 1, 12000, 1, 'daily'),
  o('gen_ticket', 'general', 'ticket_recruit', 1, 40000, 1, 'weekly', { highlight: true }),

  // --- Gems --------------------------------------------------------------------
  o('gem_coins', 'gems', 'coins', 30000, 60, 3, 'daily'),
  o('gem_book_sr', 'gems', 'book_superRare', 2, 150, 3, 'weekly'),
  o('gem_dice', 'gems', 'dice_reroll', 3, 120, 2, 'weekly'),
  o('gem_lock', 'gems', 'lock_pin', 1, 150, 2, 'weekly'),
  o('gem_gearbox', 'gems', 'gearbox_superRare', 1, 180, 2, 'weekly'),
  ...FAMILIES.map((f) => o(`gem_mat_${f}_sr`, 'gems', `mat_${f}_superRare`, 2, 100, 2, 'weekly')),

  // --- Recruit Exchange (recruit points) --------------------------------------
  ...UNITS.filter((u) => u.rarity === 'SSR').map((u) => o(`spark_${u.id}`, 'recruit', null, 1, GACHA.sparkCost, null, null, { unitId: u.id, highlight: true })),
  o('rp_fragment', 'recruit', 'star_fragment', 10, 30, 3, 'weekly'),

  // --- Boss Exchange (Assault Tokens) -----------------------------------------
  o('boss_crown_slime', 'boss', 'crown_slime', 1, 12, 3, 'weekly'),
  o('boss_crown_iron', 'boss', 'crown_iron', 1, 35, 2, 'weekly'),
  o('boss_crown_cog', 'boss', 'crown_cog', 1, 35, 2, 'weekly'),
  o('boss_crown_oni', 'boss', 'crown_oni', 1, 70, 1, 'weekly'),
  o('boss_crown_dragon', 'boss', 'crown_dragon', 1, 150, 1, 'weekly'),
  o('boss_dice_prism', 'boss', 'dice_prism', 1, 50, 1, 'weekly'),
  o('boss_lock_pin', 'boss', 'lock_pin', 1, 25, 3, 'weekly'),
  o('boss_fragment', 'boss', 'star_fragment', 10, 40, 2, 'weekly'),
  o('boss_ticket', 'boss', 'ticket_recruit', 1, 60, 1, 'weekly', { highlight: true }),

  // --- Bounty Exchange (Bounty Tokens) ----------------------------------------
  o('bty_gearbox_rare', 'bounty', 'gearbox_rare', 1, 8, 3, 'daily'),
  o('bty_dice', 'bounty', 'dice_reroll', 1, 6, 3, 'daily'),
  o('bty_gearbox_sr', 'bounty', 'gearbox_superRare', 1, 25, 4, 'weekly'),
  o('bty_gearbox_mythic', 'bounty', 'gearbox_mythic', 1, 80, 1, 'weekly'),
  o('bty_gearbox_legendary', 'bounty', 'gearbox_legendary', 1, 200, 1, 'weekly'),
  o('bty_lock', 'bounty', 'lock_pin', 1, 20, 3, 'weekly'),
  o('bty_book_sr', 'bounty', 'book_superRare', 1, 10, 5, 'weekly'),
  // an Akashic Tome is one level above 60 (Potential v3 §4.4)
  o('bty_book_tome', 'bounty', 'book_legendary', 1, 40, 2, 'weekly'),

  // --- Boss Exchange: the Titan shelf (Assault Tokens; ASCENSION.md §C.10) ----------------
  W('ts_crown_shard', 'boss', 'crown_rainbow_shard', 1, 40, 1, { section: 'titan', highlight: true }),
  ...FAM('ts_zenith', 'boss', 'zenith', 1, 60, 1, { section: 'titan' }),
  ...FAM('ts_legendary', 'boss', 'legendary', 1, 25, 4, { section: 'titan' }),
  ...FAM('ts_mythic', 'boss', 'mythic', 1, 8, 6, { section: 'titan' }),
  W('ts_tome', 'boss', 'book_legendary', 1, 30, 2, { section: 'titan' }),
  W('ts_kindred_r', 'boss', 'kindred_r', 1, 15, 2, { section: 'titan', needs: 'kindred:kindred_r' }),
  W('ts_kindred_sr', 'boss', 'kindred_sr', 1, 60, 1, { section: 'titan', needs: 'kindred:kindred_sr' }),
  W('ts_kindred_shard', 'boss', 'kindred_shard_ssr', 1, 50, 1, { section: 'titan', needs: 'nightmareClear', everyOtherWeek: true }),
  W('ts_celestial', 'boss', 'gearbox_legendary', 1, 120, 1, { section: 'titan' }),

  // --- Gem Shop: the Titan shelf for spenders (never crowns, crown shards, keys or boxes) -------
  ...FAM('gts_zenith', 'gems', 'zenith', 1, 250, 2, { section: 'titan' }),
  W('gts_kindred_shard', 'gems', 'kindred_shard_ssr', 1, 1500, 1, { section: 'titan' }),

  // --- Memento Exchange: Mementos (lower) -------------------------------------------------
  W('mem_ticket', 'memento', 'ticket_recruit', 1, 60, 1, { currency: 'memento', highlight: true }),
  W('mem_fragment', 'memento', 'star_fragment', 10, 15, 8, { currency: 'memento' }),
  W('mem_tome', 'memento', 'book_legendary', 1, 20, 2, { currency: 'memento' }),
  ...FAM('mem_mythic', 'memento', 'mythic', 1, 20, 2, { currency: 'memento' }),
  ...FAM('mem_sr', 'memento', 'superRare', 2, 10, 4, { currency: 'memento' }),
  W('mem_kindred_r', 'memento', 'kindred_r', 1, 30, 1, { currency: 'memento', needs: 'kindred:kindred_r' }),
  W('mem_dice', 'memento', 'dice_reroll', 1, 6, 3, { currency: 'memento' }),
  W('mem_coins', 'memento', 'coins', 20000, 10, 3, { currency: 'memento' }),
  // --- Memento Exchange: Moonpearls (higher) ----------------------------------------------
  W('mp_ticket10', 'memento', 'ticket_recruit10', 1, 150, 1, { currency: 'moonpearl', highlight: true }),
  W('mp_chosen_ssr', 'memento', null, 1, 120, 1, { currency: 'moonpearl', chosenEssence: 'SSR', needs: 'ownedSSR', highlight: true }),
  W('mp_crown_shard', 'memento', 'crown_rainbow_shard', 1, 12, 2, { currency: 'moonpearl' }),
  ...FAM('mp_zenith', 'memento', 'zenith', 1, 15, 1, { currency: 'moonpearl' }),
  ...FAM('mp_legendary', 'memento', 'legendary', 1, 6, 2, { currency: 'moonpearl' }),
  W('mp_celestial', 'memento', 'gearbox_legendary', 1, 25, 1, { currency: 'moonpearl' }),
];

/** The key that counts a row's weekly stock: its group's ('group:<id>') or its own id. */
export const stockKey = (offer) => (offer.group ? `group:${offer.group}` : offer.id);

/** offerId -> offer (with `currency` filled from its tab). */
export const SHOP_OFFER_MAP = Object.fromEntries(SHOP_OFFERS.map((offer) => {
  const tab = SHOP_TABS.find((t) => t.id === offer.tab);
  offer.currency = offer.currency || tab.currency;
  return [offer.id, offer];
}));

/** @returns {object|undefined} offer by id */
export function getOffer(id) {
  return SHOP_OFFER_MAP[id];
}

/** @returns {object[]} every offer that sells this item */
export function offersForItem(itemId) {
  return SHOP_OFFERS.filter((offer) => offer.item === itemId);
}
