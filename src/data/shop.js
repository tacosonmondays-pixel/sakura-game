// Sakura Sentinels — Mall tabs and offers (owner: systems). See CONTRACTS.md §5.
//
// Plain data. `resets`: 'daily' | 'weekly' | 'never' (lifetime limit) | null (unlimited, stock ignored).
// `currency`: 'coins' | 'gems' | 'recruitPoints' | 'token_boss' | 'token_bounty'.
// Spark offers grant a unit instead of an item (`unitId`, item null).

import { MATERIAL_FAMILIES, GACHA } from './types.js';
import { UNITS } from './units.js';

export const SHOP_TABS = [
  { id: 'general', name: 'General', currency: 'coins', desc: 'Everyday study supplies, paid with coins. Restocks daily.' },
  { id: 'gems', name: 'Gem Shop', currency: 'gems', desc: 'Premium bundles that save time. Weekly stock.' },
  { id: 'recruit', name: 'Recruit Exchange', currency: 'recruitPoints', desc: 'Every recruit earns 1 point. 200 points spark any SSR of your choice.' },
  { id: 'boss', name: 'Boss Exchange', currency: 'token_boss', desc: 'Assault Tokens from minibosses and Total Assault buy crowns and dice.' },
  { id: 'bounty', name: 'Bounty Exchange', currency: 'token_bounty', desc: 'Bounty Tokens buy gear boxes and reroll dice.' },
];

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
];

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
