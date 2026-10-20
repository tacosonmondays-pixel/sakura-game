// The game's one reset clock (owner decision D3): daily things reset at 7 PM America/Chicago,
// daylight saving included. Pure, no imports, Node-safe. This is the subset of
// ENERGY_RESET_SPEC §3.1 that the social update needs (clan material requests, donation caps);
// the energy build extends this same file (gameWeek, gameDayStart, periodKeys, …) with the
// same names and signatures.
//
// The trick: take the Chicago wall-clock time and add 5 hours. 7 PM becomes midnight, so the
// game day is the date of that shifted clock. A game day is therefore NAMED BY THE DATE IT ENDS:
// Tuesday 7 PM → Wednesday 7 PM Central is '…-Wednesday'. Because the shift is applied to the
// wall clock (not to UTC), DST needs no special case: the switches happen at 02:00 local, far
// from 19:00.
//
// SQL mirror (supabase/migrations/20261013000000_social.sql): game_day_key(t) returns the same
// string and next_game_reset() the same instant. The orchestrator's expression
// ((now() at time zone 'America/Chicago') - interval '19 hours')::date flips at exactly the same
// instant but names the day by the date it STARTS (one day earlier); never store that one.

export const RESET = Object.freeze({ timeZone: 'America/Chicago', hour: 19, shiftHours: 5, label: '7 PM Central', weeklyLabel: 'Sunday 7 PM Central' });

const HOUR = 3600000;
const DAY = 24 * HOUR;

let cached = null;
let intlBroken = false;
/** Cached Intl formatter for Chicago wall time, or null when this engine lacks the zone. */
function formatter() {
  if (cached || intlBroken) return cached;
  try {
    cached = new Intl.DateTimeFormat('en-US', {
      timeZone: RESET.timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    intlBroken = true; // very old WebViews: RangeError for the time zone → the US rule below
  }
  return cached;
}

/**
 * Chicago's UTC offset in minutes at instant `t` by the US rule (−300 CDT from the second
 * Sunday of March 02:00 local, −360 CST from the first Sunday of November 02:00 local).
 * The fallback when Intl has no America/Chicago.
 */
export function chicagoOffsetFallback(t) {
  const y = new Date(t).getUTCFullYear();
  const sunday = (month, nth) => {
    const first = new Date(Date.UTC(y, month, 1)).getUTCDay();
    return 1 + ((7 - first) % 7) + 7 * (nth - 1);
  };
  const start = Date.UTC(y, 2, sunday(2, 2), 8); // 02:00 CST = 08:00 UTC
  const end = Date.UTC(y, 10, sunday(10, 1), 7); // 02:00 CDT = 07:00 UTC
  return t >= start && t < end ? -300 : -360;
}

/**
 * Chicago wall clock at `t`.
 * @param {number} [t] epoch ms
 * @param {{ fallback?: boolean }} [opts] fallback: force the US-rule path (tests)
 * @returns {{ year: number, month: number, day: number, hour: number, minute: number, second: number }}
 */
export function chicagoParts(t = Date.now(), { fallback = false } = {}) {
  const f = fallback ? null : formatter();
  if (f) {
    const out = {};
    for (const p of f.formatToParts(new Date(t))) if (p.type !== 'literal') out[p.type] = Number(p.value);
    return { year: out.year, month: out.month, day: out.day, hour: out.hour % 24, minute: out.minute, second: out.second };
  }
  const w = new Date(t + chicagoOffsetFallback(t) * 60000);
  return { year: w.getUTCFullYear(), month: w.getUTCMonth() + 1, day: w.getUTCDate(), hour: w.getUTCHours(), minute: w.getUTCMinutes(), second: w.getUTCSeconds() };
}

/** The Chicago wall clock at `t` as if it were UTC (ms). */
function wallMs(t, opts) {
  const p = chicagoParts(t, opts);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) + (((t % 1000) + 1000) % 1000);
}

const pad = (n) => String(n).padStart(2, '0');

/**
 * 'YYYY-MM-DD' of the game day containing `t`: the date of (Chicago wall time + 5 h).
 * SQL: game_day_key(t).
 */
export function gameDay(t = Date.now(), opts) {
  const s = new Date(wallMs(t, opts) + RESET.shiftHours * HOUR);
  return `${s.getUTCFullYear()}-${pad(s.getUTCMonth() + 1)}-${pad(s.getUTCDate())}`;
}

/**
 * The first instant after `t` whose Chicago wall time is 19:00:00.000 (ms). SQL: next_game_reset().
 * Days are 25 h long on the fall-back Sunday and 23 h on the spring-forward Sunday.
 */
export function nextDailyReset(t = Date.now(), opts) {
  const wall = wallMs(t, opts);
  const shiftedStart = Math.floor((wall + RESET.shiftHours * HOUR) / DAY) * DAY;
  const target = shiftedStart + DAY - RESET.shiftHours * HOUR; // the next 19:00 in wall terms
  let u = target - (wall - t);
  for (let i = 0; i < 3; i++) {
    const d = wallMs(u, opts) - target;
    if (d === 0) break;
    u -= d;
  }
  return u;
}

// ---------------------------------------------------------------------------
// The game week (ENERGY_RESET_SPEC §3.1): weekly things reset on Sunday at 7 PM Central. Same names
// and signatures as that spec, so the energy build can take these over unchanged.
// ---------------------------------------------------------------------------

/** Whole days since 1970-01-01 of gameDay(t) (a rotation index; never a date shown to players). */
export function gameDayNumber(t = Date.now(), opts) {
  const [y, m, d] = gameDay(t, opts).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY);
}

/**
 * Whole game weeks since the week of 1970-01-01 (Monday-based weeks of the shifted clock, so a week
 * runs Sunday 7 PM Central → Sunday 7 PM Central). Monotone in `t`; what counters store.
 */
export function gameWeekNumber(t = Date.now(), opts) {
  return Math.floor((gameDayNumber(t, opts) + 3) / 7);
}

/** 'YYYY-Www': the ISO week of the shifted date (gameDay), so it flips on Sunday at 7 PM Central. */
export function gameWeek(t = Date.now(), opts) {
  const [y, m, dd] = gameDay(t, opts).split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, dd));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d - yearStart) / DAY + 1) / 7);
  return `${d.getUTCFullYear()}-W${pad(week)}`;
}

/** The first instant after `t` that starts a new game week (a Sunday 19:00:00.000 Chicago). */
export function nextWeeklyReset(t = Date.now(), opts) {
  const week = gameWeekNumber(t, opts);
  let u = nextDailyReset(t, opts);
  for (let i = 0; i < 7 && gameWeekNumber(u, opts) === week; i++) u = nextDailyReset(u, opts);
  return u;
}

/** '2d 4h' | '3h 07m' | '12m' (at least '1m'); ms <= 0 → 'now'. */
export function formatCountdown(ms) {
  if (!(ms > 0)) return 'now';
  const m = Math.max(1, Math.floor(ms / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${pad(m % 60)}m`;
  return `${m}m`;
}

/**
 * '' on Central time, else the next reset in the device's own time, e.g. '9:00 AM your time'
 * (for players outside Central who would otherwise have to convert "7 PM Central").
 */
export function localResetHint(t = Date.now()) {
  const at = nextDailyReset(t);
  const p = chicagoParts(at);
  const chicagoOffset = (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(at / 1000) * 1000) / 60000;
  if (-new Date(at).getTimezoneOffset() === chicagoOffset) return '';
  try {
    return `${new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} your time`;
  } catch {
    return '';
  }
}
