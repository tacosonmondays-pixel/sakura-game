// Styled laser beam presets (docs/VFX.md "Beams"; display only). Plain data, like the lightning and tornado presets.
//
// A beam is a solid toon line in three layers (a dark ink line, the body with bright bands running out to the target, a
// white-hot core). It fires in four beats. Charge: a thin line races out from the girl. Punch: it slams in wider than it
// stays, then settles. Hold: the bands run. Leave: it thins, its back end chases its front into the target, and it
// breaks into dashes. Where it lands: a star, a burst of inked impact lines, sparks, a ring on the ground and a brief
// scorch. Colours are sRGB hex; widths are half widths in world units; times are seconds.
const IMPACT = {
  star: { sprite: 'star', size: 0.5, color: '#ffffff', life: 0.16 },
  lines: { count: 8, length: 0.5, width: 0.03, life: 0.15, color: '#ffffff', ink: '#1a1033' },
  sparks: { sprite: 'spark', size: 0.09, speed: 2.4, life: 0.26 },
  ring: { sprite: 'ring', size: 0.9, life: 0.2 },
  scorch: { sprite: 'disc', color: '#2a2034', size: 0.34, life: 0.55, alpha: 0.32 },
  muzzle: { sprite: 'glow', size: 0.34, color: '#ffffff' },
};

export const BEAM_PRESETS = {
  laser: {
    label: 'Laser (any colour: the beam\'s own)',
    ink: '#1a1440',
    body: '#5ab8ff',
    core: '#ffffff',
    width: 1, // × the half width from the sim's beam width
    inkWidth: 0.026, // the ink line beyond the body
    coreShare: 0.45, // the core's half width ÷ the body's
    charge: 0.04, // the thin line racing out
    punch: 0.07, // slams in this much wider (overshoot) and settles
    overshoot: 0.7,
    hold: 0.06,
    fade: 0.11, // thins, its back end chases its front, breaks into dashes
    tailChase: true,
    erode: 0.9, // how far the erosion goes while it leaves (1: all of it)
    bandFreq: 2.2, // bright bands per world unit
    bandSpeed: 7, // band cycles a second (running out to the target)
    hdr: 0.35, // high + bloom: the core this much above white
    zig: 0, // kinks (0: a straight beam)
    restrike: 0.05, // a zig-zag beam's new path this often
    jag: 0.12,
    jagMax: 0.3,
    zigzag: 0.85,
    skew: 0.3,
    lift: 0.35,
    ...IMPACT,
    sparksColor: null, // null: the body colour
    ringColor: null,
  },
  moon: {
    label: 'Moon lance (violet)',
    ink: '#1d0f4f',
    body: '#a77bff',
    core: '#fbf6ff',
    width: 1,
    inkWidth: 0.026,
    coreShare: 0.48,
    charge: 0.045,
    punch: 0.08,
    overshoot: 0.6,
    hold: 0.07,
    fade: 0.12,
    tailChase: true,
    erode: 0.9,
    bandFreq: 1.8,
    bandSpeed: 5,
    hdr: 0.35,
    zig: 0,
    restrike: 0.05,
    jag: 0.12,
    jagMax: 0.3,
    zigzag: 0.85,
    skew: 0.3,
    lift: 0.35,
    ...IMPACT,
    star: { ...IMPACT.star, color: '#f4ecff' },
    lines: { ...IMPACT.lines, color: '#f4ecff', ink: '#1d0f4f' },
    sparks: { ...IMPACT.sparks, sprite: 'star' },
    sparksColor: '#d9c4ff',
    ringColor: '#a77bff',
  },
  holy: {
    label: 'Holy ray (gold)',
    ink: '#4a2a05',
    body: '#ffd65a',
    core: '#fffdf0',
    width: 1.1,
    inkWidth: 0.026,
    coreShare: 0.5,
    charge: 0.04,
    punch: 0.07,
    overshoot: 0.75,
    hold: 0.07,
    fade: 0.11,
    tailChase: true,
    erode: 0.85,
    bandFreq: 2,
    bandSpeed: 6,
    hdr: 0.35,
    zig: 0,
    restrike: 0.05,
    jag: 0.12,
    jagMax: 0.3,
    zigzag: 0.85,
    skew: 0.3,
    lift: 0.35,
    ...IMPACT,
    star: { ...IMPACT.star, color: '#fff8d6' },
    lines: { ...IMPACT.lines, color: '#fff8d6', ink: '#4a2a05' },
    sparksColor: '#ffe9a0',
    ringColor: '#ffd65a',
  },
  storm: {
    label: 'Storm lance (gold zig-zag)',
    ink: '#33216e',
    body: '#ffd23f',
    core: '#fffbea',
    width: 1,
    inkWidth: 0.026,
    coreShare: 0.45,
    charge: 0.035,
    punch: 0.06,
    overshoot: 0.6,
    hold: 0.06,
    fade: 0.1,
    tailChase: true,
    erode: 0.9,
    bandFreq: 2.4,
    bandSpeed: 9,
    hdr: 0.35,
    zig: 6,
    restrike: 0.05,
    jag: 0.12,
    jagMax: 0.32,
    zigzag: 0.85,
    skew: 0.3,
    lift: 0.35,
    ...IMPACT,
    star: { ...IMPACT.star, color: '#fff6cc' },
    lines: { ...IMPACT.lines, color: '#fff6cc', ink: '#33216e' },
    sparksColor: '#ffe45c',
    ringColor: '#ffd23f',
  },
};

/** Detail per graphics tier: impact lines, sparks, the ground ring and scorch, running bands, the core above white. */
export const BEAM_TIERS = {
  high: { lines: 8, sparks: 5, ring: true, scorch: true, bands: true, hdr: true },
  medium: { lines: 6, sparks: 3, ring: true, scorch: true, bands: true, hdr: false },
  low: { lines: 0, sparks: 0, ring: false, scorch: false, bands: false, hdr: false },
};

/** Most beams alive at once (a new one past it replaces the oldest). */
export const MAX_BEAMS = 32;
