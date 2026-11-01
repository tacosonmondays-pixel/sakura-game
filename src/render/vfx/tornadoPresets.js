// Tornado presets (docs/VFX.md "Tornado"): plain data, read by src/render/vfx/tornado.js. A tornado is a
// column of flat rings that rise from the ground, grow wider, twist round a helix and sway; each ring's
// flame is a band of painted noise cut by a threshold that rises with its age, with a hard toon edge, and
// coloured through a stepped ramp (few flat bands, no gradients). All sizes are in tiles, times in seconds.
//
//   life      seconds a ring takes to rise from the ground to the top
//   height    how high the rings rise
//   r0 / r1   ring radius at the ground / at the top (× the cast's size)
//   inner     the ring's hole, as a share of its radius (the flame band runs from inner to 1)
//   spin      turns of the whole column (radians a second); twist: extra turn of a ring over its rise
//   helix     how far the ring centres wander round the column's axis (tiles at the top)
//   sway      sideways drift of the upper rings on X/Z (tiles at the top), swayHz its speed
//   noise     [around, along] scale of the noise in the ring's polar coordinates; scroll: its drift
//   erode     [young, old] threshold: the flame breaks up into tongues and wisps as a ring ages
//   ramp      the toon bands, coolest → hottest (sRGB); the hottest band alone gets the HDR boost
//   hdr       extra brightness of the hottest band (high tier with bloom only; feeds the bloom)
//   alpha     overall strength (the colour added / painted)
//   body      how much the cooler bands cover what is behind them (0 = pure added light; the hottest band always is)
//   scale     size of the column × the cast's radius
//   core      the bright inner column on high: radius share, extra heat
//   base      the glowing ring on the ground: colour, size (× r1), pulse Hz
//   embers    sparks (or petals, droplets) spiralling up: atlas sprite, colours, size, additive or not
export const TORNADO_PRESETS = Object.freeze({
  // Akane's Starmine Barrage: a festival-fire vortex the shells fall into
  fire: Object.freeze({
    label: 'Fire tornado',
    life: 1.05, height: 3.0, r0: 0.3, r1: 1.0, inner: 0.42,
    spin: 3.2, twist: 3.6, helix: 0.16, sway: 0.22, swayHz: 1.3,
    noise: Object.freeze([2, 0.8]), scroll: 1.4, erode: Object.freeze([0.06, 0.58]),
    ramp: Object.freeze(['#b8203a', '#f0442c', '#ff8a2a', '#ffcf4a', '#fff4c8']),
    hdr: 0.3, alpha: 0.75, body: 0.55, scale: 1.25,
    core: Object.freeze({ radius: 0.45, heat: 0.12 }),
    base: Object.freeze({ color: '#ff7a2e', inner: '#ffd27a', size: 1.15, pulse: 2.2 }),
    embers: Object.freeze({ sprite: 'spark', colors: Object.freeze(['#ffd23f', '#ff8c42', '#fff1b0']), size: 0.13, additive: true, life: 1.1 }),
  }),
  // a sakura-pink petal whirl (for Rei's Hurricane Draw, later)
  sakura: Object.freeze({
    label: 'Sakura petal tornado',
    life: 1.25, height: 2.8, r0: 0.32, r1: 0.98, inner: 0.45,
    spin: 2.6, twist: 3.0, helix: 0.14, sway: 0.18, swayHz: 1.0,
    noise: Object.freeze([3, 1]), scroll: 1.0, erode: Object.freeze([0.08, 0.6]),
    ramp: Object.freeze(['#c2407a', '#ec6fa4', '#ff9cc4', '#ffd0e2', '#fff6fa']),
    hdr: 0.3, alpha: 0.67, body: 0.55, scale: 1.25,
    core: Object.freeze({ radius: 0.42, heat: 0.1 }),
    base: Object.freeze({ color: '#ff8fbf', inner: '#ffe0ee', size: 1.1, pulse: 1.6 }),
    embers: Object.freeze({ sprite: 'petal', colors: Object.freeze(['#ffb7d1', '#ff8fbf', '#ffe4ef']), size: 0.17, additive: false, life: 1.5 }),
  }),
  // a cyan wind / water vortex
  vortex: Object.freeze({
    label: 'Cyan wind vortex',
    life: 0.95, height: 2.9, r0: 0.26, r1: 1.05, inner: 0.48,
    spin: 4.2, twist: 4.4, helix: 0.12, sway: 0.16, swayHz: 1.6,
    noise: Object.freeze([2, 1.1]), scroll: 1.9, erode: Object.freeze([0.08, 0.6]),
    ramp: Object.freeze(['#1f5fb8', '#2f9fe0', '#4fd8ea', '#a8f4f2', '#f2ffff']),
    hdr: 0.3, alpha: 0.71, body: 0.55, scale: 1.25,
    core: Object.freeze({ radius: 0.4, heat: 0.1 }),
    base: Object.freeze({ color: '#4fd0f0', inner: '#d8fbff', size: 1.15, pulse: 2.6 }),
    embers: Object.freeze({ sprite: 'dot', colors: Object.freeze(['#bff6ff', '#7fe2f5', '#ffffff']), size: 0.09, additive: true, life: 0.9 }),
  }),
});

/**
 * By graphics tier (docs/VFX.md phones first): rings in the column, core rings (high only), embers, and
 * whether the HDR boost may run (high, and only while the bloom is on).
 */
export const TORNADO_TIERS = Object.freeze({
  high: Object.freeze({ rings: 22, core: 6, embers: 12, hdr: true }),
  medium: Object.freeze({ rings: 13, core: 0, embers: 6, hdr: false }),
  low: Object.freeze({ rings: 8, core: 0, embers: 0, hdr: false }),
});

/** At most this many tornadoes at once (more casts reuse the oldest's slot). */
export const MAX_TORNADOES = 3;

/** Which girl's cast spawns which tornado (display only: the sim event is only read). */
export const TORNADO_CASTS = Object.freeze({
  'akane.starmine': 'fire',
});
