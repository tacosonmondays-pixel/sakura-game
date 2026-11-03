// Electricity presets (docs/VFX.md "Electricity"; batch B2, display only, lab only: not wired into the battle yet).
// Plain data, read by src/render/vfx/electric.js. Each girl's crackle wears the colours of her chain lightning as it
// is live (src/render/vfx/lightningPresets.js and her attack style): the bolts' ink, body and white-hot core are the
// chain's own, and the ground pieces (the charge ring under a crackling body, the cracked scorch) step through a ramp
// built on the same hues.
//
//   ink / body / core   the micro-bolts' three toon layers, back to front (sRGB hex, exactly as drawn)
//   ground              the ground ramp, ink → hottest (8 bands, one ramp texel each): 0-1 ink, 2 the scorch (a dark
//                       translucent burn), 3 the deep band, 4 the body, 5 the glow band, 6 the core, 7 white
//   width / inkWidth    a micro-bolt's body half width and the ink beyond it (world units: a board tile is 1)
//   aura                the crackle round a body: bolts re-strike every restrike[0..1] s each (its own beat a bolt),
//                       a bolt is on for duty of its strikes; len: a bolt's length; zig: its kinks (× a joint's span);
//                       skew: how far each kink slides along its segment (long diagonals, short sharp jogs);
//                       stand: how far it stands off the body; fork: the chance a bolt forks (× the tier's forks);
//                       grow / hold / fade: a strike's leader, hold and erosion; ring: the charge ring on the ground
//                       (× the body's radius, its half width)
//   shock               the shocked-enemy crackle after a chain hit: life, the first burst of bolts, then sparser
//   burst               a drum-beat ring of bolts (Drumstorm): r0 → r1 (tiles) over life, bolts round it, a restrike
//   arc                 bolts arcing between points (Drone Surge): sag (× the span), zig; each arc is held and
//                       re-struck in place every restrike[0..1] s (its leader grows over grow s on its first strike
//                       only) and is on for duty of its strikes (never two arcs of a web off at once)
//   scorch              the electric ground decal: life, radius (tiles), erode [young, old]
//   flicker             the core dims this much on every other strike (asked of the flash guard first)
//   hdr                 high with bloom: the core this much over white (only while the flash guard allows it)
//   look                'a' (the default) or 'b' (ELECTRIC_LOOKS below; the lab's ?look= and createElectricFx's `look`
//                       override it)
import { LIGHTNING_PRESETS } from './lightningPresets.js';

const L = LIGHTNING_PRESETS;

/** The shape every preset shares (a girl's preset only changes the colours and a few lengths). */
const SHAPE = Object.freeze({
  width: 0.024,
  inkWidth: 0.014,
  coreShare: 0.32,
  taper: 0.5,
  aura: Object.freeze({
    restrike: Object.freeze([0.06, 0.11]), duty: 0.8, len: Object.freeze([0.26, 0.44]), zig: 0.34, skew: 0.2, wander: 0.22, stand: 0.045,
    fork: 0.6, grow: 0.025, hold: 0.04, fade: 0.03, ring: Object.freeze({ radius: 1.35, width: 0.04 }),
  }),
  shock: Object.freeze({ life: 0.5, burst: 4, restrike: Object.freeze([0.05, 0.09]), len: Object.freeze([0.24, 0.4]) }),
  burst: Object.freeze({ life: 0.32, r0: 0.35, r1: 1.45, height: 0.1, restrike: 0.05, zig: 0.32, spoke: 0.34 }),
  arc: Object.freeze({ sag: 0.14, zig: 0.3, wander: 0.12, restrike: Object.freeze([0.1, 0.16]), duty: 0.95, grow: 0.03 }),
  scorch: Object.freeze({ life: 1.7, radius: 0.62, erode: Object.freeze([0.04, 0.92]) }),
  flicker: 0.3,
  hdr: 0.35,
  look: 'a',
});

const preset = (label, chain, colours, extra = {}) => Object.freeze({
  label, chain, ...SHAPE, ...colours, ground: Object.freeze(colours.ground), ...extra,
});

export const ELECTRIC_PRESETS = Object.freeze({
  // Raika: her chain's gold with its violet ink (lightning `storm`)
  raika: preset('Raika (gold, violet ink)', 'storm', {
    ink: L.storm.ink, body: L.storm.body, core: L.storm.core,
    ground: ['#2a1a5c', '#2a1a5c', '#3a2c52', '#d9b636', '#ffd23f', '#ffe45c', '#fff6c8', '#ffffff'],
  }),
  // Chika: her Tesla chain's ice blue with its navy ink, a cyan glow band (lightning `tesla`)
  chika: preset('Chika (cyan, navy ink)', 'tesla', {
    ink: L.tesla.ink, body: L.tesla.body, core: L.tesla.core,
    ground: ['#0f2456', '#0f2456', '#1c3450', '#1fb2d8', '#8fdcff', '#62e6ff', '#e8fbff', '#ffffff'],
  }),
  // Tenka: violet-white (lightning `arcane`)
  tenka: preset('Tenka (violet-white, indigo ink)', 'arcane', {
    ink: L.arcane.ink, body: L.arcane.body, core: L.arcane.core,
    ground: ['#1b0f4d', '#1b0f4d', '#2c2350', '#7350dc', '#a67cff', '#d6c6ff', '#f5f0ff', '#ffffff'],
  }),
  // Seiran: her sky chain's light blue on a storm-blue glow with an indigo ink (her style's chain colour)
  seiran: preset('Seiran (storm blue, indigo ink)', 'seiran', {
    ink: '#16245e', body: '#9fd8ff', core: '#f2f9ff',
    ground: ['#16245e', '#16245e', '#1f2c50', '#3a6fd8', '#6fa8ff', '#9fd8ff', '#eef7ff', '#ffffff'],
  }),
  // Yuzuha: pink electric (lightning `sakura`)
  yuzuha: preset('Yuzuha (pink electric, plum ink)', 'sakura', {
    ink: L.sakura.ink, body: L.sakura.body, core: L.sakura.core,
    ground: ['#4a1234', '#4a1234', '#3a2030', '#d65aa8', '#ff8cc6', '#ffb3dd', '#fff3f9', '#ffffff'],
  }),
});

/**
 * By graphics tier (docs/VFX.md phones first). bolts: micro-bolts round a body (shock: round a shocked enemy); levels:
 * the halvings of a bolt's path (2^levels segments); forks: forks a bolt may have; burst: bolts round a drum-beat
 * ring; arcLevels: an arc's halvings; nodes: little bolts at each point an arc joins; halo: the scorch's glow round its
 * cracks; hdr: the core over white for the bloom (high, bloom on); cap: most stroke layers drawn at once.
 */
export const ELECTRIC_TIERS = Object.freeze({
  high: Object.freeze({ bolts: 8, shock: 4, levels: 2, forks: 1, burst: 10, arcLevels: 3, nodes: 2, halo: true, hdr: true, cap: 2400 }),
  medium: Object.freeze({ bolts: 6, shock: 3, levels: 2, forks: 1, burst: 8, arcLevels: 3, nodes: 1, halo: true, hdr: false, cap: 1500 }),
  low: Object.freeze({ bolts: 4, shock: 2, levels: 1, forks: 0, burst: 6, arcLevels: 2, nodes: 0, halo: false, hdr: false, cap: 720 }),
});

/**
 * Cast hooks (lab presets for now; the battle's ⚡ casts are not wired to them yet). Drumstorm: a crackle on Raika for
 * the boost, a burst ring of bolts on every drum beat and a cracked scorch on the first. Drone Surge: bolts arcing from
 * drone to drone round the ring, and a short crackle on Chika as they launch.
 */
export const ELECTRIC_CASTS = Object.freeze({
  'raika.drumstorm': Object.freeze({ kind: 'drumstorm', preset: 'raika', duration: 5, beat: 0.5, scorchEvery: 4 }),
  'chika.droneSurge': Object.freeze({ kind: 'droneSurge', preset: 'chika', duration: 12, launch: 0.6 }),
});

/**
 * The two looks (a preset's `look`; the lab's ?look=a|b and createElectricFx({ look }) override it for every preset):
 *   a   inked line-work, the default: the chain lightning's layers (ink, body, white-hot core) on every bolt
 *   b   thicker opaque stepped bands plus a ground glow: every bolt wears stepped solid bands of its own colour round its
 *       body, back to front the ground ramp's deep band (`bands[0]` × the body's half width), the bolt's body colour
 *       (`bands[1]` ×), the glow band (the body itself, × `width`) and the white-hot core (`coreShare` of it): hard toon
 *       steps, each band solid (premultiplied, no soft blur). Ink only outside the bands of the main bolts (the beat
 *       rings' and the arcs'); the micro-bolts round bodies (crackles, shocks, the little crackles where arcs join) have
 *       none. A crackle shows `bolts` × the tier's bolts, each held `hold` × longer and re-struck `restrike` × less often
 *       (the same light on screen, less scribble); a beat ring's bolts each span `burstSpan` × the ring (gaps between
 *       them), re-struck `burstRestrike` × less often (wider bands bursting out would light more of the screen at once).
 *       A glow on the ground under each beat ring (`pool.burst` × the ring's radius): the toon core's heat and hard step
 *       over the ground ramp's deep and body bands, added light that covers little (`pool.cover`), eroding in and out.
 *       `pool.aura` (× a crackle's radius) puts one under each crackle too; 0, none: at 1:1 a tinted disc under every
 *       crackling girl read as a selection or range disc, not as light (the B2 round 2 review)
 * Neither is in the tornado's family: its look comes from translucent overlapping brush ribbons with no ink, and B's
 * bands are opaque. A look like that needs an opt-in translucent stroke mode in strokes.js that handles the joints (its
 * own round, with the tornado diff).
 */
export const ELECTRIC_LOOKS = Object.freeze({
  a: Object.freeze({ id: 'a', sheath: false }),
  b: Object.freeze({
    id: 'b',
    sheath: true,
    bands: Object.freeze([2.15, 1.5]),
    width: 0.8,
    coreShare: 0.42,
    bolts: 0.75,
    hold: 1.5,
    restrike: 1.3,
    burstRestrike: 2,
    burstSpan: 0.7,
    pool: Object.freeze({ aura: 0, burst: 0.6, cover: Object.freeze([0.06, 0.14]), strength: 0.4, erode: Object.freeze([0.22, 1.35]) }),
  }),
});

/** Which girls' electricity will use which preset once it is wired (display only; not wired yet). */
export const ELECTRIC_GIRLS = Object.freeze({ raika: 'raika', chika: 'chika', tenka: 'tenka', seiran: 'seiran', yuzuha: 'yuzuha' });

/** Pools (allocated once): crackling bodies (auras and shocks), drum-beat rings, arc webs and their points, scorches, casts. */
export const MAX_AURAS = 12;
export const MAX_BURSTS = 6;
export const MAX_LINKS = 2;
export const MAX_LINK_NODES = 8;
export const MAX_SCORCHES = 8;
export const MAX_CASTS = 4;
