// Friend Support rules (docs/specs/BANNERS.md §E) shared by the client, the local adapter's mock server and
// supabase/migrations/20261028000000_friend_support.sql (tests/online/supportSchema.test.js and
// tests/online/localSupport.test.js check both sides). Pure: no game data here.
import { validCard, cardHash } from './profileRules.js';

/** FP for each side of one paying borrow. */
export const SUPPORT_FP = 10;
/** Paying borrows a borrower gets a game day (50 FP). */
export const BORROW_CAP = 5;
/** Paying lends a lender gets a game day (10 × 10 = 100 FP). */
export const LEND_CAP = 10;
/** The client-side wallet's ceiling (missions.counters 'frp:bal'). */
export const FP_WALLET_CAP = 5000;
/** A friendship pays after this long (E.4). */
export const FRIEND_MIN_HOURS = 24;
/** Both accounts pay after this many days (E.4). */
export const ACCOUNT_MIN_DAYS = 7;
/** No FP this long after leaving the developer clan (the donation rule). */
export const DEV_LAB_DAYS = 7;
/** Uncollected lender rows are dropped after this many days ("Uncollected FP expires after 7 days"). */
export const UNCOLLECTED_DAYS = 7;
/** Collected rows and collect keys are dropped after this many days. */
export const CLAIMED_KEEP_DAYS = 30;
/** A collect key replays its total this long; older: 'stale_key'. */
export const CLAIM_REPLAY_HOURS = 24;
/** Bounded housekeeping: rows deleted per call. */
export const HOUSEKEEP_BATCH = 500;
/** The wave a support run must reach (or win a shorter stage) for its FP. */
export const SUPPORT_PAY_WAVE = 3;
/** Candidates are cached this long per session (Refresh asks again). */
export const CANDIDATES_TTL_MS = 5 * 60 * 1000;
/** "Lend my Support Student to". */
export const LEND = Object.freeze(['friends', 'nobody']);
export const LEND_DEFAULT = 'friends';

/** Why a borrow pays nothing (null: it pays). */
export const WHY_TEXT = Object.freeze({
  pair: 'Friend Points from this friend already paid today',
  borrower_cap: 'You earned today\'s Friend Points from borrowing (5 a day)',
  lender_cap: 'This friend\'s student already earned 100 FP today',
  new_friend: 'New friends earn Friend Points after a day',
  new_account: 'Friend Points start once both accounts are a week old',
  dev_lab: 'No Friend Points right after the developer clan',
  void: 'That battle was on an earlier day',
});

/** SQL valid_card_unit: one profile-card showcase entry ({ id, lv, bt, aw, p?, sk?, g? }; LR is `aw: 6`). */
export function validCardUnit(u) {
  return u != null && typeof u === 'object' && !Array.isArray(u) && validCard({ v: 1, units: [u] }) && JSON.stringify(u).length <= 2048;
}

/** The hash the sync compares (FNV-1a of the unit and the setting, as the card hash). */
export function supportHash(unit, lend) {
  return cardHash({ u: unit ?? null, l: lend });
}

/** A borrow pays once the run reached wave SUPPORT_PAY_WAVE (the wave has started), or won a shorter stage. */
export function supportPays({ wave = 0, won = false } = {}) {
  return !!won || Math.floor(Number(wave) || 0) >= SUPPORT_PAY_WAVE;
}
