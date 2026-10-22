// Hit-stop director (docs/VFX.md §M1): decides which moments freeze EVERYTHING that is drawn, and
// for how long, on top of the visual clock's own limits (src/render/vfx/clock.js: ≤ 60 ms per
// freeze, a gap after each). The battle never waits: only the visual clock holds.
//
// The global freeze is only for the biggest moments:
//   boss    a boss killed                          60 ms, any time the clock allows
//   impact  an impact frame (hero ult, boss kill)  60 ms, any time the clock allows
//
// Heavy hits and crits never freeze the board: they hold only the struck enemy's look for a few
// frames (src/render/vfx/localHold.js, picked by the hitting girl's impact preset,
// src/render/vfx/impactPresets.js). This director also counts the hits of the last second, so
// those local holds can thin out in a busy fight. Reduce Motion or the Flashes & shake setting
// off: no freeze at all.

export const HIT_STOP = {
  boss: { seconds: 0.06 },
  impact: { seconds: 0.06 },
};
/** Hits per second above which a fight counts as busy. */
export const BUSY_HITS = 25;
/** A hit dealing at least this share of a heavy enemy's max HP is a big hit (a small shake too). */
export const BIG_SHARE = 0.12;
/** A crit on an ordinary enemy counts as a big moment only when it deals at least this share of her max HP. */
export const CRIT_SHARE = 0.3;
/** Enemy tiers that count as heavy. */
export const HEAVY = new Set(['elite', 'miniboss', 'boss']);

export class HitStopDirector {
  /**
   * @param {import('./clock.js').VisualClock} clock
   * @param {{ enabled?: () => boolean }} [o] enabled: the Hit effects setting (read on every request)
   */
  constructor(clock, { enabled = () => true } = {}) {
    this.clock = clock;
    this.enabled = enabled;
    this.hits = []; // [frameT, count] of the last second
    this.hitCount = 0;
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
  }

  /** More than BUSY_HITS hits in the last second? */
  get busy() {
    this._prune(this._now());
    return this.hitCount > BUSY_HITS;
  }

  /**
   * Asks for a global freeze of `kind` (HIT_STOP key).
   * @returns {number} seconds of freeze granted (0 = refused)
   */
  request(kind) {
    const k = HIT_STOP[kind];
    if (!k || this.clock.reduceMotion || !this.enabled()) return this._no();
    const before = this.clock.freezeLeft;
    const left = this.clock.hitStop(k.seconds);
    const got = Math.max(0, left - before);
    if (left <= 0 || (got <= 0 && before <= 0)) return this._no();
    this.granted++;
    return got > 0 ? got : left;
  }

  _no() {
    this.refused++;
    return 0;
  }
}

/**
 * Is a sim 'hit' a big moment? A big share of a heavy enemy ('big': it also gets a small camera
 * shake) or a crit for a big share of anyone ('crit'). Ordinary hits on ordinary enemies never are
 * (a tower defense hits all the time).
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
