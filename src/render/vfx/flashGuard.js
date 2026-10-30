// Flash safety for the battle renderer (docs/VFX.md §M1). Every full-screen flash the renderer
// draws — the DOM screen flash, an impact frame — asks this guard first, and so does every bright,
// short flash sprite on the board (world flashes: blast cores, hit sparks, muzzle flashes):
//
//   - it counts flashing SCREEN AREA a second, not single flashes, so many small hits add up: a
//     full-screen flash counts 1 (one screen), a world flash its share of the screen × its strength.
//     In any FLASH_WINDOW (1 s) of wall time the counted area stays within AREA_BUDGET (3 screens);
//   - world flashes may use at most WORLD_BUDGET of it (the big moments keep room); past it a world
//     flash is drawn at WORLD_DIM strength (still there as a shape, too faint to count as a flash);
//   - never more than MAX_FLASHES (3) full-screen flashes in any second, whatever their size;
//   - a screen flash never peaks above MAX_FLASH (it is a radial tint over the board, so no frame
//     is ever full white), and with Reduce Motion never above SOFT_FLASH (and half the area budget);
//   - no large saturated red: a reddish flash (its red share of R + G + B, linear light, at or above
//     RED_SHARE — WCAG's saturated red is 0.8) is softened towards a dusty rose (flashColor) and
//     peaks at RED_FLASH at most;
//   - the boss vignette (a red edge) only swells in and out (vignetteStep), never flashes;
//   - an impact frame (a tinted frame and back) counts as IMPACT_COST full-screen flashes and waits
//     IMPACT_GAP after the last one; with Reduce Motion there are none (the caller draws a soft
//     tint instead).
//
// A screen flash over budget is not dropped silently: it gets a faint tint (≤ FAINT), too weak to
// count as a flash, so the hit still reads. Wall time comes from the visual clock's real timeline.

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

/** Flashing screen area counted in any FLASH_WINDOW (screens: a full-screen flash is 1). */
export const AREA_BUDGET = 3;
/** The part of AREA_BUDGET world flashes (bright sprites on the board) may use. */
export const WORLD_BUDGET = 2;
/** Strength a world flash is drawn at once the budget is spent (too faint to count). */
export const WORLD_DIM = 0.3;
/** With Reduce Motion both area budgets are this much smaller. */
export const SOFT_AREA = 0.5;
/** Time bins the area window is kept in (O(1) per flash, however many there are). */
const AREA_BINS = 20;

/**
 * Which sprites count as world flashes: additive, short-lived (≤ life s) and at least `size` world
 * units across — blast cores, hit sparks, muzzle and impact flashes. Lingering glows, motes, trails
 * and small sparks are not flashes.
 */
export const WORLD_FLASH = { life: 0.35, size: 0.3 };

/** Is an additive sprite of this life (s) and largest size (world units) a world flash? */
export function isWorldFlash(life, size) {
  return life > 0 && life <= WORLD_FLASH.life && size >= WORLD_FLASH.size;
}

/**
 * Share of the screen (0..1) a round flash `diameterPx` CSS px across covers in a view of
 * `viewW` × `viewH` CSS px; `fill`: how much of its circle is bright enough to flash (a soft glow
 * sprite only its middle).
 */
export function screenShare(diameterPx, viewW, viewH, fill = 0.5) {
  const d = Math.max(0, num(diameterPx));
  const a = Math.max(1, num(viewW)) * Math.max(1, num(viewH));
  return Math.min(1, (Math.max(0, num(fill)) * Math.PI * 0.25 * d * d) / a);
}

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

/**
 * Flashing area summed over a sliding window, kept in fixed time bins (one more bin than the window
 * holds, so the sum always covers at least the last FLASH_WINDOW seconds: never an undercount).
 */
export class AreaMeter {
  constructor(window = FLASH_WINDOW, bins = AREA_BINS) {
    this.binS = window / bins;
    this.bins = new Float64Array(bins + 1);
    this.head = -1; // index (time / binS) of the newest bin
    this.total = 0;
  }

  _advance(now) {
    const idx = Math.floor(num(now) / this.binS);
    if (idx <= this.head) return;
    const n = this.bins.length;
    if (this.head < 0 || idx - this.head >= n) {
      this.bins.fill(0);
      this.total = 0;
    } else {
      for (let k = this.head + 1; k <= idx; k++) {
        const i = k % n;
        this.total -= this.bins[i];
        this.bins[i] = 0;
      }
    }
    this.head = idx;
    if (this.total < 1e-9) this.total = 0;
  }

  /** Area counted in the window ending at `now`. */
  sum(now) {
    this._advance(now);
    return this.total;
  }

  add(now, area) {
    this._advance(now);
    const a = Math.max(0, num(area));
    this.bins[this.head % this.bins.length] += a;
    this.total += a;
  }
}

export class FlashGuard {
  /** @param {{ reduceMotion?: boolean }} [o] */
  constructor({ reduceMotion = false } = {}) {
    this.reduceMotion = !!reduceMotion;
    this.times = []; // wall times of the full-screen flashes counted in the window
    this.area = new AreaMeter(); // all flashing area (screens)
    this.worldArea = new AreaMeter(); // the world flashes' part of it
    this.lastImpact = -Infinity;
    this.refused = 0;
    this.dimmed = 0; // world flashes drawn faint because the budget was spent
    this.worldCount = 0; // world flashes counted
  }

  /** Flashing area allowed in any window (screens). */
  get areaBudget() {
    return this.reduceMotion ? AREA_BUDGET * SOFT_AREA : AREA_BUDGET;
  }

  /** The part of it world flashes may use. */
  get worldBudget() {
    return this.reduceMotion ? WORLD_BUDGET * SOFT_AREA : WORLD_BUDGET;
  }

  /** Flashing area counted in the window ending at `now` (screens). */
  load(now) {
    return this.area.sum(num(now));
  }

  /**
   * A world flash (a bright, short sprite on the board) covering `area` of the screen (0..1) at
   * `strength` (0..1). Many small ones add up to the same area as one big one.
   * @returns {number} the strength factor to draw it at: 1, or WORLD_DIM once the budget is spent
   *   (a dimmed flash is too faint to count)
   */
  world(area, strength, now) {
    const t = num(now);
    const load = Math.min(1, Math.max(0, num(area))) * Math.min(1, Math.max(0, num(strength)));
    if (load <= 0) return 1;
    if (this.worldArea.sum(t) + load > this.worldBudget + 1e-9 || this.area.sum(t) + load > this.areaBudget + 1e-9) {
      this.dimmed++;
      return WORLD_DIM;
    }
    this.worldArea.add(t, load);
    this.area.add(t, load);
    this.worldCount++;
    return 1;
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
   * reddish (flashColor), so it peaks at RED_FLASH at most. It covers the whole screen: it needs one
   * free flash and one screen of free area (world flashes count there too).
   * @returns {number} the opacity to draw: capped; FAINT or less when the window is full
   */
  flash(strength, now, red = false) {
    const t = num(now);
    const s = Math.max(0, Math.min(num(strength), this.cap, red ? RED_FLASH : 1));
    if (s <= FAINT) return s;
    if (this.room(t) < 1 || this.area.sum(t) + 1 > this.areaBudget + 1e-9) {
      this.refused++;
      return Math.min(s, FAINT);
    }
    this.times.push(t);
    this.area.add(t, 1);
    return s;
  }

  /**
   * May an impact frame start at `now`? Never with Reduce Motion; it needs IMPACT_COST free
   * flashes (and as many screens of free area) and IMPACT_GAP since the last one. A yes books them.
   */
  impact(now) {
    const t = num(now);
    if (this.reduceMotion || t - this.lastImpact < IMPACT_GAP || this.room(t) < IMPACT_COST || this.area.sum(t) + IMPACT_COST > this.areaBudget + 1e-9) {
      this.refused++;
      return false;
    }
    for (let i = 0; i < IMPACT_COST; i++) this.times.push(t);
    this.area.add(t, IMPACT_COST);
    this.lastImpact = t;
    return true;
  }
}
