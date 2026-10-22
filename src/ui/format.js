// One number style everywhere (docs/specs/UI_DIRECTION.md §2, principle P5). Display only: whether something is
// affordable is always decided from the exact values, never from these strings.
//
//   fmtNum(34687)                          "34.7k"     count, reward, damage, HP (nearest)
//   fmtNum(34687, 'count', { detail: true })  "34,687"
//   fmtNum(42350, 'stack')                 "×42.3k"    item stack (down)
//   fmtNum(284650, 'money')                "284,650"   a balance (down); exact up to 999,999
//   fmtNum(1250000, 'money', { round: 'up' })  "1.3M"  a price or requirement (up)
//   fmtNum(0.224, 'pct')                   "+22%"      ({ detail } → "+22.4%")
//   fmtNum(2.14, 'flat')                   "+2.1"
//   fmtNum(1.923, 'rate')                  "1.9/s"     ({ detail } → "1.92/s")
//   fmtNum(1.5, 'mul')                     "×1.5"      ({ detail } → "×1.25")
//   fmtNum(65, 'time')                     "1:05"      (up: never "0s" while something still runs)
//   fmtNum(40000, 'time')                  "12h"       (from 1 h: hours; from 1 day: "6d 4h" or "6d"; all up)
//   fmtNum(4.3, 'range')                   "4.3"       ({ detail } → "4.30 tiles")
//   fmtNum(48, 'level', { cap: 50 })       "LV 48/50"
//   fmtNum(3, 'progress', { of: 5 })       "3/5"       (down)

export const MINUS = '−';

const HOUR_S = 3600;
const DAY_S = 24 * HOUR_S;

/** A countdown under 24 h (§5.9: its time turns --bad-on-plate). `sec` is the time left in seconds. */
export function isUrgent(sec) {
  const s = Number(sec);
  return Number.isFinite(s) && s > 0 && s < DAY_S;
}

const ROUND = {
  down: (x) => Math.floor(x + 1e-9),
  up: (x) => Math.ceil(x - 1e-9),
  nearest: (x) => Math.round(x),
};
const DEFAULT_ROUND = { count: 'nearest', stack: 'down', money: 'down', progress: 'down', time: 'up' };

const group = (n) => Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
const sign = (n) => (n < 0 ? MINUS : '');

/** At most `digits` decimals, trailing zeros dropped (2.10 → "2.1", 3.0 → "3"). */
function trim(x, digits, rule = 'nearest') {
  const f = 10 ** digits;
  const v = ROUND[rule](Math.abs(x) * f) / f;
  const txt = v.toFixed(digits);
  return digits ? txt.replace(/\.?0+$/, '') : txt;
}

/**
 * The short form: 12.3k, 1.2M, 1.2B, one decimal at most. `from` is where shortening starts (10,000 for counts,
 * 1,000,000 for money). A value that rounds up to the next unit moves to it (999,950 → "1M", never "1000k").
 */
function short(n, from, rule) {
  const a = Math.abs(n);
  const whole = ROUND[rule](a);
  if (whole < from) return sign(n) + group(whole);
  const units = [[1e3, 'k'], [1e6, 'M'], [1e9, 'B']].filter(([u]) => u * 1000 > from);
  let i = units.length - 1;
  while (i > 0 && units[i][0] > whole) i--;
  let v = ROUND[rule]((a / units[i][0]) * 10) / 10;
  if (v >= 1000 && i < units.length - 1) v = ROUND[rule]((a / units[++i][0]) * 10) / 10;
  return sign(n) + trim(v, 1) + units[i][1];
}

const signed = (n, body) => (n < 0 ? MINUS : '+') + body;

/**
 * @param {number} value
 * @param {'count'|'stack'|'money'|'pct'|'flat'|'rate'|'mul'|'time'|'range'|'level'|'progress'} [kind]
 * @param {{ detail?: boolean, round?: 'down'|'up'|'nearest', whole?: boolean, cap?: number, of?: number }} [opt]
 *   detail: the Details form (exact counts, one more decimal); round: overrides the kind's rounding direction
 *   (balances and owned counts down, prices and requirements up, stats nearest); whole: whole seconds (cooldowns);
 *   cap: a level's cap; of: a progress total.
 * @returns {string} '–' for a missing or non-finite value
 */
export function fmtNum(value, kind = 'count', opt = {}) {
  if (value == null || !Number.isFinite(Number(value))) return '–';
  const n = Number(value);
  const { detail = false } = opt;
  const rule = opt.round || DEFAULT_ROUND[kind] || 'nearest';
  switch (kind) {
    case 'count':
      return detail ? sign(n) + group(ROUND[rule](Math.abs(n))) : short(n, 1e4, rule);
    case 'stack':
      return `×${detail ? group(ROUND[rule](n)) : short(n, 1e4, rule)}`;
    case 'money':
      return detail ? sign(n) + group(ROUND[rule](Math.abs(n))) : short(n, 1e6, rule);
    case 'pct':
      return signed(n, `${trim(n * 100, detail ? 1 : 0, rule)}%`);
    case 'flat':
      return signed(n, trim(n, 1, rule));
    case 'rate':
      return `${sign(n)}${trim(n, detail ? 2 : 1, rule)}/s`;
    case 'mul':
      return `×${trim(n, detail ? 2 : 1, rule)}`;
    case 'range':
      return detail ? `${Math.abs(n).toFixed(2)} tiles` : trim(n, 1, rule);
    case 'time': {
      if (n <= 0) return '0s';
      if (opt.whole || n >= 1) {
        const s = ROUND[rule](n);
        // the long forms (§5.9 countdown chip): "6d 4h", "6d", "11h"; under an hour "12:05" as before
        if (s >= DAY_S) {
          const hrs = ROUND[rule](s / HOUR_S);
          const d = Math.floor(hrs / 24);
          return hrs % 24 ? `${d}d ${hrs % 24}h` : `${d}d`;
        }
        if (s >= HOUR_S) return `${ROUND[rule](s / HOUR_S)}h`;
        return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
      }
      return `${trim(n, 1, rule)}s`;
    }
    case 'level':
      return `LV ${ROUND.down(n)}${opt.cap != null ? `/${ROUND.down(opt.cap)}` : ''}`;
    case 'progress':
      return `${ROUND[rule](n)}${opt.of != null ? `/${ROUND[rule](opt.of)}` : ''}`;
    default:
      throw new Error(`fmtNum: unknown kind "${kind}"`);
  }
}
