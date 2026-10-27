// The clan titan board's client side (docs/specs/ASCENSION.md §C.11): the rewards the game pays once it
// reads your rank for a past week (like the clan boss, src/online/clanRules.js), and what a score sends.
// The server (supabase/migrations/20261021000000_titan_board.sql) keeps the scores: it clamps damage to
// the tier's pool (×1.6 co-op), takes only the Titan of the Week and battles of at least 10 seconds.
// Pure; not co-op hashed.

import { tierStep } from '../data/titans.js';
import { UNIT_SCALE } from '../data/balance.js';

export const TITAN_BOARD_VERSION = 1;
/** The server refuses shorter battles. */
export const MIN_BOARD_SECONDS = 10;
/** Weekly board rewards by rank inside the clan; everyone with a Bronze gets the last row. */
export const BOARD_REWARDS = Object.freeze([
  { rank: 1, tokens: 30, title: 'Titan Ace' },
  { rank: 2, tokens: 20 },
  { rank: 3, tokens: 10 },
]);
export const BRONZE_TOKENS = 5;
/** missions.counters key: a week's board reward was paid ('tbclaim:<week>'). */
export const claimKey = (week) => `tbclaim:${week}`;

/** What a finished week pays: { tokens, title|null } (0 tokens without a rank or a Bronze). */
export function boardReward(rank, bronze) {
  const row = BOARD_REWARDS.find((r) => r.rank === rank);
  if (row) return { tokens: row.tokens, title: row.title || null };
  return { tokens: bronze ? BRONZE_TOKENS : 0, title: null };
}

/**
 * The arguments of submit_titan_best for one battle (null when it cannot count: under 10 s). The server clamps damage
 * to the tier's pool in today's units, so Option A of the owner's band (src/data/balance.js: every battle number
 * ×UNIT_SCALE; 1 under Option B) sends the battle's damage divided back by its scale.
 */
export function boardSubmission({ titanId, tier, rank = 0, damage, seconds, coop = false }) {
  if (!(seconds >= MIN_BOARD_SECONDS)) return null;
  return { titan: titanId, step: tierStep(tier, rank), damage: Math.max(0, Math.round((damage || 0) / UNIT_SCALE) || 0), seconds: Math.floor(seconds), coop: !!coop };
}
