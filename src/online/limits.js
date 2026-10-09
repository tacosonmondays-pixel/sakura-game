// Rate limits shared by the client limiter, the local adapter's mock server and
// supabase/schema.sql (tests/online/schema.test.js checks the SQL uses the same numbers).
// The client limiter only gives instant feedback ("Slow down, 1.4 s"); the server limits
// are the real ones.

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/**
 * action → { gapMs: minimum time between two hits, max: hits per window, windowMs }.
 * @type {Record<string, {gapMs: number, max: number, windowMs: number, label: string}>}
 */
export const RULES = Object.freeze({
  chat: { gapMs: 2 * SEC, max: 20, windowMs: MIN, label: 'chat message' },
  clan_create: { gapMs: 10 * MIN, max: 3, windowMs: DAY, label: 'new clan' },
  // joins, requests, leaves and invite-code tries (a wrong code counts too: no brute force)
  clan_join: { gapMs: 0, max: 10, windowMs: HOUR, label: 'clan join / request / leave' },
  boss_hit: { gapMs: 0, max: 3, windowMs: DAY, label: 'clan boss attempt' },
  // starting a clan boss battle uses no attempt; this only stops a script flooding the table
  boss_start: { gapMs: 0, max: 20, windowMs: HOUR, label: 'clan boss battle' },
  // creating AND redeeming codes; a wrong code counts too (brute force), see redeem_transfer
  transfer: { gapMs: 0, max: 5, windowMs: HOUR, label: 'transfer code' },
  // client-only: the Supply Bot only changes the local save and never reaches a rate table
  dev_grant: { gapMs: 300, max: 60, windowMs: MIN, label: 'supply request' },
  // opening or joining a co-op room (open_room / join_room; a wrong code counts too)
  room: { gapMs: 1 * SEC, max: 20, windowMs: HOUR, label: 'co-op room' },
});

/**
 * Pure verdict for one action given the earlier hit times (ms, any order).
 * @param {{gapMs: number, max: number, windowMs: number}} rule
 * @param {number[]} hits
 * @param {number} now
 * @returns {{ ok: boolean, retryMs: number }}
 */
export function verdict(rule, hits, now) {
  if (!rule) return { ok: true, retryMs: 0 };
  const recent = hits.filter((t) => now - t < rule.windowMs).sort((a, b) => a - b);
  let retry = 0;
  const last = recent[recent.length - 1];
  if (last != null && rule.gapMs > 0 && now - last < rule.gapMs) retry = Math.max(retry, rule.gapMs - (now - last));
  if (recent.length >= rule.max) {
    const oldest = recent[recent.length - rule.max];
    retry = Math.max(retry, oldest + rule.windowMs - now);
  }
  return { ok: retry <= 0, retryMs: Math.max(0, Math.ceil(retry)) };
}

/**
 * Sliding-window + minimum-gap limiter.
 * @param {Record<string, {gapMs: number, max: number, windowMs: number}>} [rules]
 * @param {() => number} [now]
 */
export function createLimiter(rules = RULES, now = () => Date.now()) {
  const log = new Map();
  const prune = (action, t) => {
    const rule = rules[action];
    const list = (log.get(action) || []).filter((x) => !rule || t - x < rule.windowMs);
    log.set(action, list);
    return list;
  };
  return {
    /** Would `action` pass right now? Does not record anything. */
    check(action) {
      const t = now();
      return verdict(rules[action], prune(action, t), t);
    },
    /** Records `action` when allowed. @returns {{ ok: boolean, retryMs: number }} */
    hit(action) {
      const t = now();
      const list = prune(action, t);
      const v = verdict(rules[action], list, t);
      if (v.ok) list.push(t);
      return v;
    },
    /** Forget one action (e.g. the server refused it for another reason). */
    undo(action) {
      const list = log.get(action);
      if (list?.length) list.pop();
    },
    reset() {
      log.clear();
    },
  };
}

/** "1.4 s", "12 s", "3 min", "2 h" */
export function formatRetry(ms) {
  const s = Math.max(0, ms) / 1000;
  if (s < 10) return `${s.toFixed(1)} s`;
  if (s < 90) return `${Math.ceil(s)} s`;
  if (s < 5400) return `${Math.ceil(s / 60)} min`;
  return `${Math.ceil(s / 3600)} h`;
}
