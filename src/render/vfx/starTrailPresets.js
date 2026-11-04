// Star trail presets (docs/VFX.md "Star trail"): plain data, read by src/render/vfx/starTrail.js. A shooting star: a
// concave 4-point star with its own halo and axis flares, a soft ribbon behind it (a white core in a wide glow, an
// iridescent colour band at its edges, a few waving strands), a crescent riding just ahead of it, and on landing a swell
// then a ring of glassy shards.
//
// Sizes are shares of the view's short side (the host's `setView(w, h)`), so the star reads the same on a phone held
// either way and on a laptop. Times are seconds of the host's visual clock. Colours are sRGB hex, exactly as drawn: the
// effect composes in display space (see paintStarRamp in starTrail.js).
//
//   flight     seconds of the flight, bend (the curve's control point off the chord, × the chord's length; the sign
//              picks the side), trail (seconds of flight the ribbon covers, sampled back along the known curve)
//   ribbon     width (half-width of the strip, glow included), head (its share of that width at the star), core colour
//              and coreGain (its brightness, ≥ 1 lifts a white core into the tone curve's shoulder), core / glow sigma
//              (× the half-width), glow and band gains, band centre |v| and width, hue (thin-film ramp: turns per second
//              of flight laid down, turns across the strip, drift a second), ramp (4 sRGB stops, a loop: the hue cycles
//              through them), wobble (the slow sideways waver), rim (an optional covering edge colour and its strength:
//              Nightglass's navy rim)
//   strands    colour, strength, half-width (× the strip's half-width; never under 1 CSS px), spread (how far apart
//              they fan, × the strip's half-width)
//   star       radius, colour (its heart is white), q (the concave edge: |x|^q + |y|^q = 1; smaller is thinner arms),
//              turn (degrees), twinkle (scale ± and Hz), halo (colour, size × radius, strength), flare (colour, length
//              × radius, strength)
//   crescent   colour, strength, ahead (× star radius), size (× star radius), cut (how far back the disc that carves
//              it sits, × its radius: larger is a fatter front, the horns ending sooner)
//   burst      swell (s), scale (the star at the top of the swell), halo (its growth), seconds (the shards), extra (shards
//              over the tier's count, still capped by the tier), reach (× short side), size (× short side), colours,
//              ring (the impact pulse at the top of the swell: radius from → to × short side over `seconds`, width
//              (the half-width of its band, a thin line in a soft glow, × short side), colour, strength; none with
//              Reduce Motion)
//   accentShare  how much a girl's accent tints the halo and strands (accentTint)
import { flashColor } from './flashGuard.js';

export const STAR_TRAIL_PRESETS = Object.freeze({
  // SSR: a white core, a pink / lavender / ice band that shifts like a soap film, a violet halo
  prism: deepFreeze({
    label: 'Prism (SSR)',
    flight: { seconds: 0.62, bend: 0.22, trail: 0.48 },
    ribbon: {
      width: 0.123, head: 0.19, core: '#ffffff', coreGain: 1.25, coreSigma: 0.168, glowSigma: 0.62, glow: 0.42, band: 0.95,
      bandAt: 0.3, bandWidth: 0.165, hue: [1.7, 0.42, 0.22], wobble: 0.07,
      ramp: ['#ff9fd5', '#c3a2ff', '#93d2ff', '#ffc4ea'],
      rim: null,
    },
    strands: { color: '#ffffff', alpha: 0.85, width: 0.013, spread: 0.82 },
    star: {
      radius: 0.046, color: '#ffe3f4', q: 0.62, turn: 12, twinkle: [0.06, 3],
      halo: { color: '#7a6cff', size: 3.4, alpha: 0.75 },
      flare: { color: '#efe9ff', length: 3.6, alpha: 0.8 },
    },
    crescent: { color: '#f2eeff', alpha: 0.65, ahead: 1.6, size: 1.25, cut: 0.42 },
    burst: {
      swell: 0.18, scale: 3.2, halo: 1.7, seconds: 0.36, extra: 0, reach: 0.3, size: 0.055,
      colors: ['#ffffff', '#ff9fd5', '#b89cff', '#8fd0ff'],
      ring: { from: 0.2, to: 0.45, seconds: 0.25, width: 0.012, color: '#e8e0ff', alpha: 0.32 },
    },
    accentShare: 0.45,
  }),
  // LR: a navy-rimmed ribbon with a white-gold core, gold strands, a gold crescent, a longer flight and a bigger burst
  nightglass: deepFreeze({
    label: 'Nightglass (LR)',
    flight: { seconds: 0.85, bend: 0.26, trail: 0.6 },
    ribbon: {
      width: 0.132, head: 0.19, core: '#fff3d2', coreGain: 1.25, coreSigma: 0.152, glowSigma: 0.6, glow: 0.4, band: 0.85,
      bandAt: 0.31, bandWidth: 0.155, hue: [1.3, 0.3, 0.16], wobble: 0.06,
      ramp: ['#ffcf73', '#ffe9b5', '#a9b9ff', '#ffd99a'],
      rim: { color: '#1b2766', alpha: 0.6 },
    },
    strands: { color: '#ffd27a', alpha: 0.9, width: 0.0143, spread: 0.82 },
    star: {
      radius: 0.05, color: '#fff0c4', q: 0.6, turn: 12, twinkle: [0.06, 2.6],
      halo: { color: '#ffe7a3', size: 3.4, alpha: 0.7 },
      flare: { color: '#fff4d6', length: 4, alpha: 0.85 },
    },
    crescent: { color: '#ffd27a', alpha: 0.65, ahead: 1.6, size: 1.3, cut: 0.42 },
    burst: {
      swell: 0.25, scale: 3.6, halo: 1.9, seconds: 0.45, extra: 2, reach: 0.36, size: 0.06,
      colors: ['#fff4d6', '#ffcf73', '#ffe3a0', '#9fb2ff'],
      ring: { from: 0.2, to: 0.45, seconds: 0.25, width: 0.012, color: '#ffeab8', alpha: 0.32 },
    },
    accentShare: 0.35,
  }),
});

/**
 * By graphics tier (the game's settings.quality; most phones run high, so high's cost is the phone cost).
 *   joints    ribbon joints (2 vertices each)            strands   waving strands in the ribbon (≤ MAX_STRANDS)
 *   glow      the wide glow's width (× high's: medium's strip is narrower, so fewer fragments); halo: the halo's size
 *   shards    landing shards (presets may add `extra`, never past MAX_SHARDS)   sprites   sprite instances at most
 *             (the star's STAR_SPRITES + the ring's RING_ARCS + the shards: medium holds 22 so its 8 shards, Nightglass's
 *             10, and the landing ring all fit; instances are cheap, the fragment area is what the caps hold down)
 *   dpr       the host canvas's device-pixel-ratio cap    fragCap   peak estimated fragment area, in screens (tests)
 *
 * Low has no WebGL at all. Step 2 of the plan draws a 2D-canvas fallback for it on its own canvas above the cards
 * (never the effects canvas behind them): one tapered gradient path along the last few head positions, a 4-point star
 * built from quadratic curves, and a small fixed spark pool at the landing. Any WebGL failure falls back to it too.
 */
export const STAR_TRAIL_TIERS = Object.freeze({
  high: Object.freeze({ webgl: true, joints: 32, strands: 3, glow: 1, halo: 1, shards: 10, sprites: 24, dpr: 1.5, fragCap: 0.42 }),
  medium: Object.freeze({ webgl: true, joints: 16, strands: 2, glow: 0.7, halo: 0.8, shards: 8, sprites: 22, dpr: 1, fragCap: 0.3 }),
  low: Object.freeze({ webgl: false, joints: 0, strands: 0, glow: 0, halo: 0, shards: 0, sprites: 0, dpr: 1, fragCap: 0 }),
});

/** Buffer sizes (the high tier's): sized once, never grown. */
export const MAX_JOINTS = 32;
export const MAX_STRANDS = 3;
export const MAX_SPRITES = 24;
export const MAX_SHARDS = 14;
/** The landing ring is drawn as this many arcs (instances in the sprite call), each on a quad just big enough for its
 * arc: a whole-ring quad would cost about 0.4 screens of fragments at its widest, the arcs about 0.07 (844x390). */
export const RING_ARCS = 8;
/** Sprites the star itself takes while the shards fly (halo, two flares, the star; the crescent is gone by then). The
 * shards get what a tier has left after these and the ring's arcs. */
export const STAR_SPRITES = 4;

/**
 * Reduce Motion: no flight, no ribbon, no shards, no twinkle, no swell. A still star, its halo and the crescent fade in
 * where the star would land, hold, and fade out. The host's landing flash is FAINT at most (its own flash() helper).
 */
export const STAR_TRAIL_CALM = Object.freeze({
  fadeIn: 0.4, hold: 0.7, fadeOut: 0.45, flight: false, ribbon: false, shards: false, twinkle: false, swell: false,
  crescent: true, halo: 0.75, flare: 0.55, scale: 1.25,
});

/** The ramp texture: RAMP_W texels a row, one row per preset (at most RAMP_ROWS presets). */
export const RAMP_W = 64;
export const RAMP_ROWS = 4;

/** Accent clamps: mixed at least this far towards white, and at most this saturated ((max − min) ÷ max, display). */
export const ACCENT_WHITE = 0.4;
export const ACCENT_MAX_SAT = 0.45;

const toRgb = (hex) => {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  return [0, 2, 4].map((o) => parseInt(h.slice(o, o + 2), 16) / 255);
};
const toHex = (rgb) => `#${rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')}`;
const isHex = (c) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(c || ''));

/**
 * A girl's accent (her mark's accent colour) made safe for the star: mixed towards white (pastel), its saturation
 * capped, then passed through the flash guard's colour helper (a reddish colour is softened towards a dusty rose: no
 * large saturated red, docs/VFX.md). @returns {string|null} '#rrggbb', or null for no / a bad colour
 */
export function pastelAccent(hex) {
  if (!isHex(hex)) return null;
  let c = toRgb(hex).map((v) => v + (1 - v) * ACCENT_WHITE);
  const sat = (x) => {
    const mx = Math.max(...x);
    return mx > 0 ? (mx - Math.min(...x)) / mx : 0;
  };
  for (let k = 0; k < 24 && sat(c) > ACCENT_MAX_SAT; k++) c = c.map((v) => v + (1 - v) * 0.08);
  return flashColor(toHex(c)).color;
}

/** mix of two hex colours in display space. */
export function mixHex(a, b, t) {
  const x = toRgb(a);
  const y = toRgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}

/**
 * The halo and strand colours of a preset for one girl: her pastel accent mixed in by the preset's accentShare.
 * With no accent, the preset's own. @returns {{ halo: string, strand: string }}
 */
export function accentTint(preset, accent) {
  const a = pastelAccent(accent);
  if (!a) return { halo: preset.star.halo.color, strand: preset.strands.color };
  const k = preset.accentShare ?? 0.4;
  return { halo: mixHex(preset.star.halo.color, a, k), strand: mixHex(preset.strands.color, a, k * 0.6) };
}

function deepFreeze(o) {
  for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v);
  return Object.freeze(o);
}
