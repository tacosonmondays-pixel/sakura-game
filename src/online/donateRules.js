// Clan material requests and donations (owner: "in clans you can request and donate materials,
// but only a limited quantity each day"). Pure rules shared by both adapters, the UI and the
// tests. Mirrored by the SQL table donate_items and the constants in donate() / request_materials()
// of supabase/migrations/20261013000000_social.sql (tests/online/socialSchema.test.js compares).
//
// Trust model: the server never sees inventories (saves are local), so a donation is "the server
// lets a clanmate grant up to the caps". The caps below — not the donor's honesty — bound what
// anyone can receive, and the tenure / account-age rules keep fresh alt accounts from feeding a
// main account.
import { ITEMS } from '../data/items.js';
import { ITEM_RARITIES } from '../data/types.js';

/**
 * Per rarity: request size, the most one donor may give to one request, donation points per
 * piece, requests per rolling 7 days (0 = no weekly cap) and whether the clan must be established.
 * Legendary materials are never requestable (an earned end-game gate).
 */
export const DONATE_RULES = Object.freeze({
  common: Object.freeze({ size: 10, perDonor: 5, points: 1, weeklyMax: 0, established: false }),
  rare: Object.freeze({ size: 6, perDonor: 3, points: 2, weeklyMax: 0, established: false }),
  superRare: Object.freeze({ size: 3, perDonor: 2, points: 5, weeklyMax: 3, established: false }),
  mythic: Object.freeze({ size: 1, perDonor: 1, points: 10, weeklyMax: 1, established: true }),
});

/** Donation points a player may give per game day, across all clans. SQL. */
export const DONOR_DAILY_POINTS = 30;
/** Donor reward: coins per point (≤ 1,500 a day) and clan XP per point. SQL (coins returned to the client). */
export const DONOR_COINS_PER_POINT = 50;
export const CLAN_XP_PER_POINT = 1;
/** Donors: in the clan ≥ 72 h and an online account ≥ 7 days old; requesters: in the clan ≥ 24 h. SQL. */
export const DONOR_MIN_TENURE_HOURS = 72;
export const DONOR_MIN_ACCOUNT_DAYS = 7;
export const REQUESTER_MIN_TENURE_HOURS = 24;
/** Mythic requests need an established clan: ≥ 14 days old with ≥ 5 members of ≥ 72 h. SQL. */
export const MYTHIC_MIN_CLAN_DAYS = 14;
export const MYTHIC_MIN_MEMBERS = 5;
export const MYTHIC_MEMBER_TENURE_HOURS = 72;
/** Donations wait for the requester this long (also after leaving the clan). SQL. */
export const CLAIM_KEEP_DAYS = 7;
/** A collect key can be replayed (crash recovery) for this long after the first collect. SQL. */
export const CLAIM_REPLAY_HOURS = 24;
/** No donations for a week after leaving the developer clan (its Supply Bot grants any item). SQL. */
export const DEV_LAB_COOLDOWN_DAYS = 7;
/** Server-side donation key tombstones: 'applied' ones are kept this long (replays, settle). SQL. */
export const KEY_KEEP_DAYS = 90;
/**
 * 'voided' tombstones only need to outlive a late donate() of the same game day (a request takes
 * donations on its own game day only), and one player may hold at most VOID_KEY_MAX of them:
 * settle_donations() cannot be used to fill the database (SECURITY #3). SQL.
 */
export const VOID_KEY_KEEP_DAYS = 2;
export const VOID_KEY_MAX = 100;
/** The client gives up on an unconfirmed donation older than this (never refunds it: no dupes). */
export const ESCROW_GIVE_UP_DAYS = 80;

/** Every requestable item: materials of every family, common → mythic (28 items). */
export function donatableItems() {
  return Object.values(ITEMS)
    .filter((i) => i.category === 'material' && DONATE_RULES[i.rarity])
    .sort((a, b) => a.sort - b.sort);
}

/**
 * @param {string} itemId
 * @returns {{ item: string, name: string, family: string, rarity: string, size: number, perDonor: number,
 *   points: number, weeklyMax: number, established: boolean }|null}
 */
export function requestRule(itemId) {
  const it = ITEMS[itemId];
  const r = it && it.category === 'material' ? DONATE_RULES[it.rarity] : null;
  if (!r) return null;
  return { item: it.id, name: it.name, family: it.family, rarity: it.rarity, ...r };
}

/** Rarity label ("Super Rare"). */
export function rarityName(rarity) {
  return ITEM_RARITIES[rarity]?.name || rarity;
}

/**
 * The most a donor can give to one request right now.
 * @param {{ rule: object, remaining: number, given: number, have: number, pointsLeft: number }} a
 */
export function maxDonation({ rule, remaining, given = 0, have = 0, pointsLeft = DONOR_DAILY_POINTS }) {
  if (!rule) return 0;
  return Math.max(0, Math.min(remaining, rule.perDonor - given, have, Math.floor(pointsLeft / rule.points)));
}

/** Coins for donating `points` points. */
export function donorReward(points) {
  return Math.max(0, Math.floor(points)) * DONOR_COINS_PER_POINT;
}
