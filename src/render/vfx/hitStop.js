// Hit-stop director (docs/VFX.md §M1): decides which hits freeze what is drawn, and for how long,
// on top of the visual clock's own limits (src/render/vfx/clock.js: ≤ 60 ms per freeze, a gap
// after each). The battle never waits: only the visual clock holds.
//
//   crit    a critical hit on a heavy enemy (elite, miniboss, boss) or worth ≥ CRIT_SHARE of
//           any enemy's max HP                     40 ms, at most one per 1.2 s, none in busy fights
//   big     a hit worth ≥ BIG_SHARE of a heavy enemy's max HP
//                                                  50 ms, at most one per 0.6 s (twice that when busy)
//   boss    a boss killed                          60 ms, any time the clock allows
//   impact  an impact frame (hero ult, boss kill)  60 ms, any time the clock allows
//
// "Busy" = more than BUSY_HITS hits in the last second: a big wave never turns into constant
// stutter. On top, the low kinds (crit, big) may hold at most LOW_BUDGET seconds of every
// LOW_WINDOW. Reduce Motion or the Hit effects setting off: no freeze at all.

export const HIT_STOP = {
  crit: { seconds: 0.04, gap: 1.2, low: true },
  big: { seconds: 0.05, gap: 0.6, low: true },
  boss: { seconds: 0.06, gap: 0, low: false },
  impact: { seconds: 0.06, gap: 0, low: false },
};
/** Hits per second above which a fight counts as busy. */
export const BUSY_HITS = 25;
/** Frozen frame time the low kinds may use per LOW_WINDOW (s). */
export const LOW_BUDGET = 0.1;
export const LOW_WINDOW = 2;
/** A hit dealing at least this share of a heavy enemy's max HP is a big hit. */
export const BIG_SHARE = 0.12;
/** A crit on an ordinary enemy freezes only when it deals at least this share of her max HP. */
export const CRIT_SHARE = 0.3;
/** Enemy tiers that count as heavy. */
const HEAVY = new Set(['elite', 'miniboss', 'boss']);

export class HitStopDirector {
  /**
   * @param {import('./clock.js').VisualClock} clock
   * @param {{ enabled?: () => boolean }} [o] enabled: the Hit effects setting (read on every request)
   */
  constructor(clock, { enabled = () => true } = {}) {
    this.clock = clock;
    this.enabled = enabled;
    this.last = {}; // kind -> frame time of its last freeze
    this.hits = []; // [frameT, count] of the last second
    this.hitCount = 0;
    this.low = []; // [frameT, seconds] freezes of the low kinds
    this.granted = 0;
    this.refused = 0;
  }

  _now() {
    return this.clock.frameT;
  }

  /** Counts this frame's hits (busy detection). */
  noteHits(n) {
    if (!(n > 0)) return;
    const t = this._now();
    this.hits.push(t, n);
    this.hitCount += n;
    this._prune(t);
  }

  _prune(t) {
    const h = this.hits;
    let k = 0;
    while (k < h.length && h[k] <= t - 1) {
      this.hitCount -= h[k + 1];
      k += 2;
    }
    if (k) h.splice(0, k);
    const l = this.low;
    let j = 0;
    while (j < l.length && l[j] <= t - LOW_WINDOW) j += 2;
    if (j) l.splice(0, j);
  }

  /** More than BUSY_HITS hits in the last second? */
  get busy() {
    this._prune(this._now());
    return this.hitCount > BUSY_HITS;
  }

  _lowUsed() {
    let s = 0;
    for (let i = 1; i < this.low.length; i += 2) s += this.low[i];
    return s;
  }

  /**
   * Asks for a freeze of `kind` (HIT_STOP key).
   * @returns {number} seconds of freeze granted (0 = refused)
   */
  request(kind) {
    const k = HIT_STOP[kind];
    if (!k || this.clock.reduceMotion || !this.enabled()) return this._no();
    const t = this._now();
    this._prune(t);
    const busy = this.hitCount > BUSY_HITS;
    if (k.low) {
      if (kind === 'crit' && busy) return this._no();
      const gap = busy ? k.gap * 2 : k.gap;
      if (t - (this.last[kind] ?? -Infinity) < gap) return this._no();
      if (this._lowUsed() + k.seconds > LOW_BUDGET + 1e-9) return this._no();
    }
    const before = this.clock.freezeLeft;
    const left = this.clock.hitStop(k.seconds);
    const got = Math.max(0, left - before);
    if (left <= 0 || (got <= 0 && before <= 0)) return this._no();
    this.last[kind] = t;
    if (k.low && got > 0) this.low.push(t, got);
    this.granted++;
    return got > 0 ? got : left;
  }

  _no() {
    this.refused++;
    return 0;
  }
}

/**
 * Which freeze (if any) a sim 'hit' event asks for: ordinary hits on ordinary enemies never
 * freeze (a tower defense hits all the time).
 * @param {{ crit?: boolean, amount?: number }} ev
 * @param {{ maxHp?: number, tier?: string|null }|null} enemy the enemy's view (max HP, tier)
 * @returns {'big'|'crit'|null}
 */
export function hitKind(ev, enemy) {
  const max = enemy?.maxHp || 0;
  if (!(max > 0)) return null;
  const share = (ev.amount || 0) / max;
  const heavy = HEAVY.has(enemy.tier);
  if (heavy && share >= BIG_SHARE) return 'big';
  if (ev.crit && (heavy || share >= CRIT_SHARE)) return 'crit';
  return null;
}
