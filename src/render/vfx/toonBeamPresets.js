// Toon beam presets (docs/VFX.md "Toon beams", batch B3; display only, lab only: not wired into the battle yet). Plain
// data, read by src/render/vfx/toonBeams.js. A toon beam is a flowing band on the shared toon core: the house noise
// running out along it, a stepped ramp from its white-hot middle out to its body colour, an ink rim on its outer
// silhouette only (none near the muzzle: her face), in hard-stepped beats:
//
//   charge   a ring gathers in at the muzzle, streaks converge on it, both eroding in over her wind-up
//   start    the release (flash-guarded): the head races out as a spear tip, then the band punches in wider in two
//            hard steps and settles
//   sustain  the bands flow out to the target; at the hit point an inked crown of tongues (re-rolled on a stepped
//            beat), a stepped ring on the ground and a glow pool under it (the impact asks the flash guard)
//   end      the band thins in steps, its ink leaves (one front, muzzle first), then it erodes out along itself, from the muzzle on
//            to the target, ending in its colour bands (never loose ink), and the pool cools into a scorch and erodes
//
// Colours are sRGB hex, exactly as drawn (painted as sRGB bytes, decoded once on the GPU); widths are half widths in
// tiles; times are seconds. Every colour is today's (the styles and patterns named on each preset); every width
// matches today's beam (the sim's half width, or the fired lance's BEAM_HALF from the sim's beam width).

/** Ramp texels a row (NearestFilter: flat steps). */
export const TOON_BEAM_RAMP_W = 8;
/** Texel of each band in a preset's main row (`ramp`: ink, deep, body, light, core, white; the last two spare). */
export const BEAM_BAND = Object.freeze({ ink: 0, deep: 1, body: 2, light: 3, core: 4, white: 5 });
/** A fired lance's half width from the sim's beam width (0.12 … 0.36): base + per × width (as src/render/vfx/beams.js). */
export const LANCE_HALF = Object.freeze({ base: 0.05, per: 0.3 });
/** The prism beam's half width from Kohaku's beam (src/render/attackFx/styles/kohaku_tsubaki.js w): × this. */
export const PRISM_HALF_SHARE = 0.6;
/** A held beam's half width from the sim's (0.25): the share of today's soft band that reads on screen. */
export const HELD_VISIBLE = 0.62;
/** The prism's stripe colours: the duo's Grand Spectrum (kohaku_tsubaki.js SPECTRUM, the white is the core thread). */
export const PRISM_SPECTRUM = Object.freeze(['#c9a8ff', '#8fd8ff', '#ffd27a', '#ff9ad5', '#9dffc4']);

/**
 * The wind-ups the charge-up runs over, read from today's patterns: a staff girl's cast clip (src/models/weapons.js
 * `cast`, 0.6 s, its wind-up the first 0.3 of it), Miko's gohei (`sweep`, 0.5 s × 0.3) and the duo's beam lock
 * (kohaku_tsubaki.js FADE_IN, 0.08 s).
 */
export const WINDUPS = Object.freeze({ staff: 0.6 * 0.3, gohei: 0.5 * 0.3, prism: 0.08 });

const IMPACT = Object.freeze({
  crown: Object.freeze({ size: 0.34, beat: 0.08 }), // the crown's radius (tiles, × the beam's width share) and re-roll beat
  ring: Object.freeze({ size: 0.56, life: 0.34, every: 0.7 }), // the stepped ground ring: radius, life, again every (held)
  pool: Object.freeze({ size: 0.3, linger: 0.4 }), // the glow pool: radius, how long its scorch lingers after the end
});

export const TOON_BEAM_PRESETS = Object.freeze({
  // Umeko's Searchlight Sweep (src/render/attackFx/patterns/held.js SWEEP_BODY #fff3c4, core #ffffff; the sim's
  // SWEEP_HALF_WIDTH 0.25 × HELD_VISIBLE, the share of today's soft band that reads): warm lantern light, amber-brown ink
  umeko: Object.freeze({
    label: 'Searchlight Sweep (Umeko)',
    held: true,
    half: 0.25 * HELD_VISIBLE,
    windup: WINDUPS.staff,
    grow: 0.08,
    hold: 0, // (held: until release())
    fade: 0.26,
    flow: 2.4, // tiles a second the noise runs out along the beam
    noise: Object.freeze([0.2, 0.1]), // [along (texture tiles a tile), across]
    coreHeat: 0.18,
    charge: Object.freeze({ size: 0.44 }),
    ramp: Object.freeze(['#3a2806', '#d9b85a', '#ffe08a', '#fff3c4', '#fffbe6', '#ffffff', '#ffffff', '#ffffff']),
    hdr: 0.3,
    zig: 0,
    ...IMPACT,
  }),
  // Luna's moonbeams (her Moonbeam Sweep, src/render/attackFx/patterns/s5held.js MOON_BODY #d9ceff, MOON_CORE #f6f2ff;
  // the sim's MOON_HALF_WIDTH 0.25 × HELD_VISIBLE; the moon lance's ink, and its body as the deep band, beamPresets.js
  // `moon`: pale moonlight with a violet rim, never a heavy purple tube)
  luna: Object.freeze({
    label: 'Moonbeams (Luna)',
    held: true,
    half: 0.25 * HELD_VISIBLE,
    windup: WINDUPS.staff,
    grow: 0.07,
    hold: 0,
    fade: 0.22,
    flow: 2.0,
    noise: Object.freeze([0.18, 0.1]),
    coreHeat: 0.16,
    charge: Object.freeze({ size: 0.4 }),
    ramp: Object.freeze(['#1d0f4f', '#a77bff', '#c4a8ff', '#d9ceff', '#ece6ff', '#f6f2ff', '#f6f2ff', '#f6f2ff']),
    hdr: 0.3,
    zig: 0,
    ...IMPACT,
  }),
  // Kohaku & Tsubaki's prism beam (kohaku_tsubaki.js: LILAC #c9a8ff, the Grand Spectrum stripes, a white core; the
  // beam's width w × PRISM_HALF_SHARE): a band per colour, side by side and twisting
  kohaku: Object.freeze({
    label: 'Prism beam (Kohaku & Tsubaki)',
    held: true,
    prism: true,
    half: 0.25 * PRISM_HALF_SHARE,
    windup: WINDUPS.prism,
    grow: 0.06,
    hold: 0,
    fade: 0.18,
    flow: 2.0,
    twist: 0.9, // stripe turns a tile along the beam
    spin: 1.6, // stripe turns a second (Reduce Motion: none)
    noise: Object.freeze([0.2, 0.1]),
    coreHeat: 0.14,
    charge: Object.freeze({ size: 0.4 }),
    ramp: Object.freeze(['#24154f', '#9a6cf2', '#c9a8ff', '#ddc8ff', '#efe6ff', '#ffffff', '#ffffff', '#ffffff']),
    stripes: PRISM_SPECTRUM,
    hdr: 0.3,
    zig: 0,
    ...IMPACT,
  }),
  // Miko's holy ray (src/render/vfx/beamPresets.js `holy`: ink #4a2a05, body #ffd65a, core #fffdf0, width × 1.1)
  miko: Object.freeze({
    label: 'Holy ray (Miko)',
    held: false,
    width: 1.1, // × the lance's half width from the sim's beam width
    windup: WINDUPS.gohei,
    grow: 0.05,
    hold: 0.14, // the holy ray's punch + hold
    fade: 0.18,
    flow: 3.0,
    noise: Object.freeze([0.24, 0.1]),
    coreHeat: 0.18,
    charge: Object.freeze({ size: 0.4 }),
    ramp: Object.freeze(['#4a2a05', '#d9ad48', '#ffd65a', '#ffe680', '#fff3c0', '#fffdf0', '#fffdf0', '#fffdf0']),
    hdr: 0.35,
    zig: 0,
    ...IMPACT,
  }),
  // Raika's Overcharge lance (beamPresets.js `storm`: ink #33216e, body #ffd23f, core #fffbea; a zig-zag struck again
  // on the beat, raika.js: 6 kinks, 2 on low)
  raika: Object.freeze({
    label: 'Overcharge lance (Raika)',
    held: false,
    width: 1,
    windup: WINDUPS.staff,
    grow: 0.04,
    hold: 0.12,
    fade: 0.16,
    flow: 3.6,
    noise: Object.freeze([0.26, 0.1]),
    coreHeat: 0.18,
    charge: Object.freeze({ size: 0.4 }),
    ramp: Object.freeze(['#33216e', '#e0b44a', '#ffd23f', '#ffe45c', '#fff6cc', '#fffbea', '#fffbea', '#fffbea']),
    hdr: 0.35,
    zig: 6, // kinks (straight: 0)
    restrike: 0.05, // a new zig-zag path this often (on twos; Reduce Motion: one still path)
    jag: 0.14, // sideways push × the segment's length …
    jagMax: 0.3, // … at most this many tiles
    lift: 0.3, // share of the push that goes up or down
    ...IMPACT,
  }),
});

/**
 * Detail per graphics tier: crown tongues, charge streaks, the ground ring and glow pool, prism stripes, the zig-zag's
 * kinks, and whether the white band may go over white (high, with the bloom on, through the flash guard).
 */
export const TOON_BEAM_TIERS = Object.freeze({
  high: Object.freeze({ tongues: 9, streaks: 8, ring: true, pool: true, prism: 5, zig: 6, hdr: true }),
  medium: Object.freeze({ tongues: 7, streaks: 6, ring: true, pool: true, prism: 5, zig: 6, hdr: false }),
  low: Object.freeze({ tongues: 5, streaks: 0, ring: false, pool: false, prism: 3, zig: 2, hdr: false }),
});

/** Most toon beams up at once (a new one past it takes a beam already ending, else the oldest). */
export const MAX_TOON_BEAMS = 16;
/** Most joints a beam's path holds (the zig-zag's kinks + 1). */
export const MAX_BEAM_JOINTS = 8;

/** Who will use which preset once the layer is wired (docs/VFX.md "Toon beams"; nothing reads it in the battle yet). */
export const TOON_BEAM_GIRLS = Object.freeze({
  umeko: 'umeko', // Moonlit Beacon T5: Searchlight Sweep (held.js 'sweep')
  luna: 'luna', // Moonbeam Sweep (s5held.js 'moon'), and later her moon lances
  kohaku_tsubaki: 'kohaku', // her constant prism beam (kohaku_tsubaki.js)
  miko: 'miko', // Purification T5: the holy ray (miko.js onBeam)
  raika: 'raika', // Overcharge T4: the zig-zag lance (raika.js onBeam)
});
