// Styled chain-lightning presets (docs/VFX.md "Lightning"; display only). Plain data: the dev lab (?lightningLab,
// src/render/vfx/lightningPanel.js) edits a copy and "Copy preset" gives back an object in this shape.
//
// A bolt is drawn in flat toon layers, back to front: an optional soft glow (glowAlpha > 0; none of the shipped presets
// use it: a halo outside the ink reads as a dark stripe inside a glow), a dark ink line (so a pale bolt reads on a bright
// day board), the body colour and a white-hot core. On high with bloom the core goes above white and the bloom glows. Colours are sRGB hex; widths are
// half widths in world units (a board tile is 1); times are seconds.
export const LIGHTNING_PRESETS = {
  storm: {
    label: 'Storm (gold, violet ink)',
    ink: '#33216e',
    body: '#ffd23f',
    core: '#fffbea',
    glow: '#ffe45c',
    width: 0.06, // the body's half width at the start of a hop
    inkWidth: 0.024, // the ink line beyond the body
    coreShare: 0.42, // the core's half width ÷ the body's
    glowWidth: 2.6, // the glow's half width ÷ the body's
    glowAlpha: 0, // the glow layer's strength (0: no glow layer)
    taper: 0.62, // width at a hop's end ÷ its start
    hopThin: 0.05, // each further hop this much thinner (down to 60%)
    jag: 0.14, // kink size ÷ hop length
    jagMax: 0.34,
    zigzag: 0.78, // 0: random kinks … 1: a strict zig-zag
    skew: 0.3, // the joints step long / short along the hop (0: even): long diagonals and short sharp jogs
    lift: 0.35, // share of each kink that goes up / down instead of sideways
    branch: 1, // × the tier's branches
    branchLen: [0.24, 0.44], // ÷ hop length
    grow: 0.05, // the leader: how long a hop takes to reach its target
    hopDelay: 0.03, // the next hop starts this much later (less on long chains: the whole chain within 0.24 s)
    hold: 0.09,
    fade: 0.13, // erosion: the bolt breaks into dashes and is gone
    restrike: 0.05, // a new path this often: the stepped, hand-drawn crackle
    flicker: 0.28, // the core dims this much on every other strike
    hdr: 0.35, // high + bloom: the core this much above white, so the bloom catches it
    star: { sprite: 'star', size: 0.5, color: '#fff6cc', life: 0.16 },
    sparks: { sprite: 'spark', color: '#ffe45c', size: 0.09, speed: 2.6, life: 0.28, additive: true },
    ground: { sprite: 'ring', color: '#ffd23f', size: 0.85, life: 0.2 },
    source: { color: '#fff3b0', size: 0.28 },
  },
  sakura: {
    label: 'Sakura (pink, plum ink)',
    ink: '#5e1640',
    body: '#ff8cc6',
    core: '#fff3f9',
    glow: '#ff9fd2',
    width: 0.06,
    inkWidth: 0.024,
    coreShare: 0.42,
    glowWidth: 2.6,
    glowAlpha: 0,
    taper: 0.62,
    hopThin: 0.05,
    jag: 0.13,
    jagMax: 0.32,
    zigzag: 0.62,
    skew: 0.26,
    lift: 0.5,
    branch: 1,
    branchLen: [0.22, 0.4],
    grow: 0.055,
    hopDelay: 0.032,
    hold: 0.1,
    fade: 0.15,
    restrike: 0.06,
    flicker: 0.22,
    hdr: 0.3,
    star: { sprite: 'star', size: 0.48, color: '#ffe6f3', life: 0.17 },
    sparks: { sprite: 'petal', color: '#ffb3d9', size: 0.12, speed: 1.6, life: 0.42, additive: false },
    ground: { sprite: 'ring', color: '#ff8cc6', size: 0.85, life: 0.22 },
    source: { color: '#ffe0f0', size: 0.28 },
  },
  arcane: {
    label: 'Arcane (violet, indigo ink)',
    ink: '#1b0f4d',
    body: '#a67cff',
    core: '#f5f0ff',
    glow: '#b48cff',
    width: 0.06,
    inkWidth: 0.024,
    coreShare: 0.42,
    glowWidth: 2.6,
    glowAlpha: 0,
    taper: 0.62,
    hopThin: 0.05,
    jag: 0.15,
    jagMax: 0.36,
    zigzag: 0.88,
    skew: 0.32,
    lift: 0.4,
    branch: 1,
    branchLen: [0.24, 0.44],
    grow: 0.05,
    hopDelay: 0.03,
    hold: 0.09,
    fade: 0.13,
    restrike: 0.05,
    flicker: 0.3,
    hdr: 0.35,
    star: { sprite: 'star', size: 0.5, color: '#efe6ff', life: 0.16 },
    sparks: { sprite: 'dot', color: '#c9a8ff', size: 0.08, speed: 2.4, life: 0.3, additive: true },
    ground: { sprite: 'ring', color: '#a67cff', size: 0.85, life: 0.2 },
    source: { color: '#e4d6ff', size: 0.28 },
  },
  tesla: {
    label: 'Tesla (ice blue, navy ink)',
    ink: '#0f2456',
    body: '#8fdcff',
    core: '#f3fcff',
    glow: '#a8e6ff',
    width: 0.06,
    inkWidth: 0.024,
    coreShare: 0.42,
    glowWidth: 2.6,
    glowAlpha: 0,
    taper: 0.62,
    hopThin: 0.05,
    jag: 0.15,
    jagMax: 0.34,
    zigzag: 0.85,
    skew: 0.32,
    lift: 0.45,
    branch: 1,
    branchLen: [0.22, 0.4],
    grow: 0.045,
    hopDelay: 0.028,
    hold: 0.08,
    fade: 0.12,
    restrike: 0.045,
    flicker: 0.3,
    hdr: 0.35,
    star: { sprite: 'star', size: 0.46, color: '#eefaff', life: 0.15 },
    sparks: { sprite: 'spark', color: '#a8e6ff', size: 0.08, speed: 2.8, life: 0.24, additive: true },
    ground: { sprite: 'ring', color: '#8fdcff', size: 0.8, life: 0.18 },
    source: { color: '#e0f6ff', size: 0.26 },
  },
};

/**
 * Detail per graphics tier. segs: kinks per hop; branches: forks per hop (× the preset's `branch`); sparks: per hit;
 * ground: a ring flash under each hit; glow: the soft glow layer (on high with bloom it is drawn fainter: the bloom off
 * the core does most of the glowing); hdr: the core goes above white for the bloom (high only, bloom on); cap: most
 * segment layers drawn at once.
 */
export const LIGHTNING_TIERS = {
  high: { segs: 6, branches: 2, branchSegs: 3, sparks: 5, ground: true, glow: true, hdr: true, cap: 3072 },
  medium: { segs: 5, branches: 1, branchSegs: 2, sparks: 3, ground: true, glow: true, hdr: false, cap: 2048 },
  low: { segs: 4, branches: 0, branchSegs: 0, sparks: 0, ground: false, glow: false, hdr: false, cap: 1024 },
};

/** The chain colours the battle sends (src/render/themes.js FX_COLORS) and their preset; any other colour: storm, recoloured. */
export const LIGHTNING_BY_COLOR = { '#ffe45c': 'storm', '#b48cff': 'arcane', '#bfe6ff': 'tesla', '#fff6c8': 'storm' };

/** Most bolts alive at once (a new one past it replaces the oldest). */
export const MAX_BOLTS = 24;
