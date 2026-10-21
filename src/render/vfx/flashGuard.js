// Flash safety for the battle renderer (docs/VFX.md §M1). Every full-screen flash the renderer
// draws — the DOM screen flash, an impact frame — asks this guard first:
//
//   - never more than MAX_FLASHES (3) flashes in any FLASH_WINDOW (1 s) of wall time;
//   - a screen flash never peaks above MAX_FLASH (it is a radial tint over the board, so no frame
//     is ever full white), and with Reduce Motion never above SOFT_FLASH;
//   - no large saturated red: a reddish flash (its red share of R + G + B, linear light, at or above
//     RED_SHARE — WCAG's saturated red is 0.8) is softened towards a dusty rose (flashColor) and
//     peaks at RED_FLASH at most;
//   - the boss vignette (a red edge) only swells in and out (vignetteStep), never flashes;
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

/** A colour whose red share of R + G + B (linear light) reaches this counts as reddish. */
export const RED_SHARE = 0.6;
/** Peak opacity of a reddish screen flash (after its colour is softened). */
export const RED_FLASH = 0.25;

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const enc = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const hex2 = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');

/** Red share of R + G + B in linear light (0 for black). @param {number[]} rgb linear */
export function redShare([r, g, b]) {
  const t = r + g + b;
  return t > 1e-6 ? r / t : 0;
}

const _colors = new Map();
/**
 * The colour a screen flash may use: a reddish one (redShare ≥ RED_SHARE) is mixed towards its own
 * grey until its red share is just under RED_SHARE — a dusty rose instead of a saturated red.
 * @param {string} color '#rgb' / '#rrggbb' (anything else is passed through, not reddish)
 * @returns {{ color: string, red: boolean }} (cached: do not mutate)
 */
export function flashColor(color) {
  const key = String(color || '#ffffff');
  let out = _colors.get(key);
  if (out) return out;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(key);
  if (!m) {
    out = { color: key, red: false };
  } else {
    let h = m[1];
    if (h.length === 3) h = h.replace(/./g, (c) => c + c);
    const rgb = [0, 2, 4].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255));
    if (redShare(rgb) < RED_SHARE) {
      out = { color: key, red: false };
    } else {
      const l = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
      let c = rgb;
      for (let k = 0.9; k >= 0 && redShare(c) >= RED_SHARE - 0.02; k -= 0.05) c = rgb.map((v) => l + (v - l) * k);
      out = { color: `#${c.map((v) => hex2(enc(v))).join('')}`, red: true };
    }
  }
  if (_colors.size > 64) _colors.clear();
  _colors.set(key, out);
  return out;
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** The boss vignette (a red edge over the board): fastest rise (opacity a second) and its peak. */
export const VIGNETTE_RISE = 1.5;
export const VIGNETTE_PEAK = 0.6;

/**
 * One frame of the boss vignette, a saturated red edge: it follows `target` (its slow pulse, or the
 * spike of a boss spawn / phase) but rises at most VIGNETTE_RISE a second and never past
 * VIGNETTE_PEAK, so a spike swells in over a quarter second instead of flashing red; it falls at
 * `fall` a second. @returns {number} the vignette opacity to draw
 */
export function vignetteStep(cur, target, dt, fall = 0.8) {
  const t = Math.min(VIGNETTE_PEAK, Math.max(0, num(target)));
  const c = num(cur);
  const d = Math.max(0, num(dt));
  return t >= c ? Math.min(t, c + VIGNETTE_RISE * d) : Math.max(t, c - fall * d);
}

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
   * A screen flash of `strength` (layer opacity 0..1) at wall time `now`; `red`: its colour is
   * reddish (flashColor), so it peaks at RED_FLASH at most.
   * @returns {number} the opacity to draw: capped; FAINT or less when the window is full
   */
  flash(strength, now, red = false) {
    const t = num(now);
    const s = Math.max(0, Math.min(num(strength), this.cap, red ? RED_FLASH : 1));
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
