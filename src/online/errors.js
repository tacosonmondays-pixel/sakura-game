// Normalized online errors. Both adapters throw OnlineError so the UI can show one message
// per code (and a countdown for `rate_limited`).

export const ERROR_CODES = ['rate_limited', 'offline', 'not_member', 'name_taken', 'forbidden', 'invalid', 'not_found', 'full', 'already_member', 'expired'];

export class OnlineError extends Error {
  /**
   * @param {string} code one of ERROR_CODES
   * @param {string} [message]
   * @param {{ retryMs?: number }} [extra]
   */
  constructor(code, message = '', extra = {}) {
    super(message || code);
    this.name = 'OnlineError';
    this.code = ERROR_CODES.includes(code) ? code : 'invalid';
    this.retryMs = extra.retryMs || 0;
  }
}

/**
 * Turns anything thrown (a Postgres error from Supabase, a network failure, an OnlineError)
 * into an OnlineError. Server functions raise 'code:detail' messages, e.g. 'rate_limited:1400'.
 * @returns {OnlineError}
 */
export function toOnlineError(e) {
  if (e instanceof OnlineError) return e;
  const msg = String(e?.message || e?.error_description || e || '');
  const m = msg.match(/\b(rate_limited|not_member|name_taken|forbidden|invalid|not_found|full|already_member|expired)(?::(\d+))?/);
  if (m) {
    const detail = msg.replace(/^.*?\b(rate_limited|not_member|name_taken|forbidden|invalid|not_found|full|already_member|expired)(:\d+)?:?\s*/, '');
    return new OnlineError(m[1], detail || m[1], { retryMs: m[1] === 'rate_limited' ? Number(m[2]) || 2000 : 0 });
  }
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
    case 'forbidden': return 'You are not allowed to do that.';
    case 'not_found': return err.message && err.message !== 'not_found' ? err.message : 'Not found.';
    case 'full': return 'That clan is full.';
    case 'already_member': return 'Leave your current clan first.';
    case 'expired': return 'That code has expired or was already used.';
    default: return err.message && err.message !== 'invalid' ? err.message : 'That did not work.';
  }
}
