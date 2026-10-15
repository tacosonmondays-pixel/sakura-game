// Normalized online errors. Both adapters throw OnlineError so the UI can show one message
// per code (and a countdown for `rate_limited`).
import { formatRetry } from './limits.js';
import { formatCountdown, RESET } from '../core/reset.js';

// needs_update: a social feature whose server functions are not installed yet (the frontend
// deploys before the owner runs supabase/migrations/20261013000000_social.sql);
// daily_limit:<ms>: a cap of the 7 PM Central game day (retryMs = time until the reset)
export const ERROR_CODES = ['rate_limited', 'offline', 'not_member', 'name_taken', 'forbidden', 'invalid', 'not_found', 'full', 'already_member', 'expired', 'needs_update', 'daily_limit'];
const CODE_RE = /\b(rate_limited|daily_limit|needs_update|not_member|name_taken|forbidden|invalid|not_found|full|already_member|expired)(?::(\d+))?/;
const CODE_STRIP = /^.*?\b(rate_limited|daily_limit|needs_update|not_member|name_taken|forbidden|invalid|not_found|full|already_member|expired)(:\d+)?:?\s*/;

export class OnlineError extends Error {
  /**
   * @param {string} code one of ERROR_CODES
   * @param {string} [message]
   * @param {{ retryMs?: number, definitive?: boolean }} [extra] definitive: the server (or the
   *   client before any request) refused it for sure, so nothing was applied — a donation in
   *   escrow may be refunded at once. Everything else (a 502, a timeout, an unknown error) may
   *   have committed on the server and is settled later (src/online/donateLedger.js).
   */
  constructor(code, message = '', extra = {}) {
    super(message || code);
    this.name = 'OnlineError';
    this.code = ERROR_CODES.includes(code) ? code : 'invalid';
    this.retryMs = extra.retryMs || 0;
    this.definitive = !!extra.definitive;
  }
}

/**
 * True when a Supabase error says the function / table does not exist yet (PostgREST
 * PGRST202 / PGRST205, Postgres 42883 / 42P01, HTTP 404): the social migration has not run.
 */
export function isMissingFeature(e) {
  if (!e) return false;
  if (['PGRST202', 'PGRST205', '42883', '42P01'].includes(e.code)) return true;
  if (e.status === 404 || e.statusCode === 404) return true;
  return /Could not find the (function|table)|function .* does not exist|relation .* does not exist/i.test(String(e.message || ''));
}

/**
 * Turns anything thrown (a Postgres error from Supabase, a network failure, an OnlineError)
 * into an OnlineError. Server functions raise 'code:detail' messages, e.g. 'rate_limited:1400'.
 * @returns {OnlineError}
 */
export function toOnlineError(e) {
  if (e instanceof OnlineError) return e;
  const msg = String(e?.message || e?.error_description || e || '');
  const m = msg.match(CODE_RE);
  if (m) {
    const detail = msg.replace(CODE_STRIP, '');
    const retryMs = m[1] === 'rate_limited' ? Number(m[2]) || 2000 : m[1] === 'daily_limit' ? Number(m[2]) || 0 : 0;
    // a 'code: detail' raised by a server function (Postgres P0001) is a definitive refusal
    return new OnlineError(m[1], detail || m[1], { retryMs, definitive: e?.code === 'P0001' });
  }
  // the project exists but supabase/migrations has not been applied yet (tables missing)
  if (e?.code === 'PGRST205' || e?.code === '42P01' || /schema cache|relation .* does not exist/i.test(msg)) return new OnlineError('offline', 'The game server is not set up yet.');
  if (e?.code === '23505') return new OnlineError('name_taken', 'That name is already taken.');
  if (e?.code === '42501' || /row-level security|permission denied/i.test(msg)) return new OnlineError('forbidden', 'Not allowed.');
  if (/fetch|network|Failed to|timeout|offline|socket/i.test(msg)) return new OnlineError('offline', 'Cannot reach the server.');
  return new OnlineError('invalid', msg || 'Something went wrong.');
}

/** Player-facing text for an error. */
export function errorText(e) {
  const err = toOnlineError(e);
  switch (err.code) {
    case 'rate_limited': return `Slow down — try again in ${formatRetry(err.retryMs)}.`;
    case 'offline': return 'Online features are offline right now.';
    case 'not_member': return 'You are not in that clan.';
    case 'name_taken': return 'That name is already taken.';
    // the server's reason when it gave one ("forbidden: you can't send messages right now")
    case 'forbidden': return err.message && err.message !== 'forbidden' ? sentence(err.message) : 'You are not allowed to do that.';
    case 'not_found': return err.message && err.message !== 'not_found' ? err.message : 'Not found.';
    case 'full': return 'That clan is full.';
    case 'already_member': return 'Leave your current clan first.';
    case 'expired': return 'That code has expired or was already used.';
    case 'needs_update': return 'Needs the latest server update — chat, clans and co-op still work.';
    case 'daily_limit': return err.retryMs ? `Daily limit reached — resets at ${RESET.label} (in ${formatCountdown(err.retryMs)}).` : `Daily limit reached — resets at ${RESET.label}.`;
    default: return err.message && err.message !== 'invalid' ? sentence(err.message) : 'That did not work.';
  }
}

/** 'you blocked them' → 'You blocked them.' */
function sentence(text) {
  const t = String(text).trim();
  if (!t) return t;
  const s = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?…)]$/.test(s) ? s : `${s}.`;
}
