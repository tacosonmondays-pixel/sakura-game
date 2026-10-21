// Flash safety for the battle renderer (docs/VFX.md §M1). Every full-screen flash the renderer
// draws — the DOM screen flash, an impact frame — asks this guard first:
//
//   - never more than MAX_FLASHES (3) flashes in any FLASH_WINDOW (1 s) of wall time;
//   - a screen flash never peaks above MAX_FLASH (it is a radial tint over the board, so no frame
//     is ever full white), and with Reduce Motion never above SOFT_FLASH;
//   - an impact frame (a dark ink frame and back) counts as IMPACT_COST flashes and waits
//     IMPACT_GAP after the last one; with Reduce Motion there are none (the caller draws a soft
//     tint instead).
//
// A request over budget is not dropped silently: it gets a faint tint (≤ FAINT), too weak to count
// as a flash, so the hit still reads. Wall time comes from the visual clock's real timeline.

/** Most flashes in any FLASH_WINDOW seconds. */
export const MAX_FLASHES = 3;
/** The sliding window the flash count covers (s). */
export const FLASH_WINDOW = 1;
/** Peak opacity of the screen-flash layer (it is a radial tint: no frame is ever full white). */
export const MAX_FLASH = 0.55;
/** Peak opacity with Reduce Motion. */
export const SOFT_FLASH = 0.2;
/** A tint at or below this opacity is too faint to count as a flash (and is always allowed). */
export const FAINT = 0.08;
/** One impact frame (dark frame, then the board again) counts as this many flashes. */
export const IMPACT_COST = 2;
/** Shortest wall time between two impact frames (s). */
export const IMPACT_GAP = 1.2;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export class FlashGuard {
  /** @param {{ reduceMotion?: boolean }} [o] */
  constructor({ reduceMotion = false } = {}) {
    this.reduceMotion = !!reduceMotion;
    this.times = []; // wall times of the flashes counted in the window
    this.lastImpact = -Infinity;
    this.refused = 0;
  }

  _prune(now) {
    const t = this.times;
    let k = 0;
    while (k < t.length && t[k] <= now - FLASH_WINDOW) k++;
    if (k) t.splice(0, k);
  }

  /** Flashes still allowed in the window ending at `now`. */
  room(now) {
    this._prune(num(now));
    return Math.max(0, MAX_FLASHES - this.times.length);
  }

  /** The peak a screen flash may reach. */
  get cap() {
    return this.reduceMotion ? SOFT_FLASH : MAX_FLASH;
  }

  /**
   * A screen flash of `strength` (layer opacity 0..1) at wall time `now`.
   * @returns {number} the opacity to draw: capped; FAINT or less when the window is full
   */
  flash(strength, now) {
    const t = num(now);
    const s = Math.max(0, Math.min(num(strength), this.cap));
    if (s <= FAINT) return s;
    if (this.room(t) < 1) {
      this.refused++;
      return Math.min(s, FAINT);
    }
    this.times.push(t);
    return s;
  }

  /**
   * May an impact frame start at `now`? Never with Reduce Motion; it needs IMPACT_COST free
   * flashes and IMPACT_GAP since the last one. A yes books the flashes.
   */
  impact(now) {
    const t = num(now);
    if (this.reduceMotion || t - this.lastImpact < IMPACT_GAP || this.room(t) < IMPACT_COST) {
      this.refused++;
      return false;
    }
    for (let i = 0; i < IMPACT_COST; i++) this.times.push(t);
    this.lastImpact = t;
    return true;
  }
}
