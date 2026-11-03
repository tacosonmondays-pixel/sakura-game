// Water splash presets (docs/VFX.md "Water splash"; display only): plain data, read by src/render/vfx/water.js. A splash
// is the tornado's house look turned into a short-lived burst: a crown wall that rises from the impact with a spiked,
// noise-wobbled lip that erodes into droplets; droplets that leave the spike tips in pairs, stay merged while they are
// close and split as they part (two soft fields cut by one hard threshold); a foam ring on the ground and ripples
// running out past it. Every shape is cut by an erosion threshold rising with its age and coloured through a few flat
// bands with an ink line on its silhouette (src/render/vfx/toonCore.js). Sizes in tiles at size 1 (× the tier's scale),
// times in seconds.
//
//   ramp    the crown and drop bands, ink → hottest (sRGB hex, exactly as drawn; 8, one ramp texel each): 0-1 ink, 2
//           deep teal, 3 the far wall's inside, 4 the body, 5 the glow band and the drops' middles, 6 the crest, 7 pure
//           white (the drops' shine). The broad whites sit just under the bloom's threshold (no soft halo round a whole
//           wall or ring); on high with bloom the crest and the shine go `hdr` over white
//   foam    the ground bands (foam ring and ripples), ink → white: 0-1 ink, 2 the ring's water, 3 its glow band (and the
//           wet glow), 5 the bubbles, 7 the impact's core
//   crown   life, r0 / r1 (radius at the foot when born / when spread), height, flare (how far the lip leans out),
//           erode [young, old], spikes (points round the lip, by tier), noise (scale along the wall)
//   jet     the centre column after the crown: delay, life, r (radius), height, erode
//   drops   pairs launch from the spike tips between launch[0] and launch[1] (share of the crown's life): speed (out),
//           up, gravity, size (radius), split (the second drop's speed share), erode [young, old] (the clip)
//   foamRing life, r0 / r1, width, erode
//   ripple  life, r0 / r1, width, spacing (s between rings), erode, decay
//   hdr     extra brightness of the crest and the shine (high with bloom only; the glow the bloom catches)
//   alpha   overall strength
export const WATER_PRESETS = Object.freeze({
  // Nami and Sango: fresh water, teal and white
  fresh: Object.freeze({
    label: 'Fresh water (teal and white)',
    ramp: Object.freeze(['#0a3a5c', '#0a3a5c', '#0e7d9f', '#17aebd', '#33cfd0', '#8cefe6', '#eafbff', '#ffffff']),
    foam: Object.freeze(['#0d5a7a', '#0d5a7a', '#2bb7c4', '#7fe6e2', '#c8fbf6', '#eafbff', '#eafbff', '#ffffff']),
    crown: Object.freeze({ life: 0.62, r0: 0.15, r1: 0.4, height: 0.56, flare: 0.62, erode: Object.freeze([0.02, 0.8]), spikes: Object.freeze([9, 7, 6]), noise: 1.1 }),
    jet: Object.freeze({ delay: 0.2, life: 0.52, r: 0.065, height: 0.6, erode: Object.freeze([0.04, 0.86]) }),
    drops: Object.freeze({ launch: Object.freeze([0.3, 0.46]), speed: Object.freeze([0.75, 1.2]), up: Object.freeze([1.5, 2.2]), gravity: 8.5, size: 0.085, split: 0.68, erode: Object.freeze([0.2, 0.62]) }),
    foamRing: Object.freeze({ life: 1.2, r0: 0.16, r1: 0.6, width: 0.22, erode: Object.freeze([0.1, 0.98]) }),
    ripple: Object.freeze({ life: 1.4, r0: 0.34, r1: 0.98, width: 0.075, spacing: 0.3, erode: Object.freeze([0.04, 0.98]), decay: 1.5 }),
    hdr: 0.25, alpha: 1,
  }),
  // Umeko and Wakaba: a lighter river tone
  river: Object.freeze({
    label: 'River (light blue and white)',
    ramp: Object.freeze(['#1b5584', '#1b5584', '#2f8fca', '#4fb3e6', '#7fd0f3', '#c3eeff', '#eaf8ff', '#ffffff']),
    foam: Object.freeze(['#2a6fa0', '#2a6fa0', '#5db8e8', '#a6e1fb', '#dcf6ff', '#eaf8ff', '#eaf8ff', '#ffffff']),
    crown: Object.freeze({ life: 0.62, r0: 0.15, r1: 0.4, height: 0.52, flare: 0.62, erode: Object.freeze([0.02, 0.8]), spikes: Object.freeze([9, 7, 6]), noise: 1.1 }),
    jet: Object.freeze({ delay: 0.2, life: 0.52, r: 0.065, height: 0.56, erode: Object.freeze([0.04, 0.86]) }),
    drops: Object.freeze({ launch: Object.freeze([0.3, 0.46]), speed: Object.freeze([0.75, 1.2]), up: Object.freeze([1.5, 2.2]), gravity: 8.5, size: 0.08, split: 0.68, erode: Object.freeze([0.2, 0.62]) }),
    foamRing: Object.freeze({ life: 1.2, r0: 0.16, r1: 0.6, width: 0.22, erode: Object.freeze([0.1, 0.98]) }),
    ripple: Object.freeze({ life: 1.4, r0: 0.34, r1: 0.98, width: 0.075, spacing: 0.3, erode: Object.freeze([0.04, 0.98]), decay: 1.5 }),
    hdr: 0.22, alpha: 1,
  }),
  // a hook for later (Frost Net, Yuki): icy bands, a stiffer crown that holds at the top before it breaks. Not tuned,
  // not on the board; the frost family (B8) will own its look
  frost: Object.freeze({
    label: 'Frost (hook, later)',
    hook: true,
    ramp: Object.freeze(['#2c4f86', '#2c4f86', '#5f93d6', '#8fbcef', '#bfe2ff', '#e6f6ff', '#eef8ff', '#ffffff']),
    foam: Object.freeze(['#3a64a0', '#3a64a0', '#86b8ec', '#c4e4ff', '#e6f5ff', '#eef8ff', '#eef8ff', '#ffffff']),
    crown: Object.freeze({ life: 0.8, r0: 0.15, r1: 0.36, height: 0.5, flare: 0.4, erode: Object.freeze([0.02, 0.7]), spikes: Object.freeze([8, 7, 6]), noise: 0.8 }),
    jet: Object.freeze({ delay: 0.24, life: 0.6, r: 0.06, height: 0.5, erode: Object.freeze([0.04, 0.8]) }),
    drops: Object.freeze({ launch: Object.freeze([0.34, 0.5]), speed: Object.freeze([0.6, 0.95]), up: Object.freeze([1.3, 1.9]), gravity: 9, size: 0.07, split: 0.7, erode: Object.freeze([0.22, 0.6]) }),
    foamRing: Object.freeze({ life: 1.3, r0: 0.16, r1: 0.56, width: 0.16, erode: Object.freeze([0.06, 0.98]) }),
    ripple: Object.freeze({ life: 1.3, r0: 0.32, r1: 1.0, width: 0.045, spacing: 0.22, erode: Object.freeze([0.08, 0.98]), decay: 2.6 }),
    hdr: 0.22, alpha: 1,
  }),
});

/**
 * By graphics tier (docs/VFX.md phones first): drop pairs, ripple rings, the centre jet, the spike set (index into a
 * preset's crown.spikes: high has the most points round the lip), whether the white highlight may go over white for
 * the bloom (high, only while the bloom is on) and the splash's scale (× its size: high and medium draw it a quarter
 * larger so it reads beside a chibi at 844×390; low keeps its fill rate).
 */
export const WATER_TIERS = Object.freeze({
  high: Object.freeze({ pairs: 5, ripples: 2, jet: true, spikes: 0, hdr: true, scale: 1.25 }),
  medium: Object.freeze({ pairs: 3, ripples: 2, jet: true, spikes: 1, hdr: false, scale: 1.25 }),
  low: Object.freeze({ pairs: 2, ripples: 1, jet: false, spikes: 2, hdr: false, scale: 1 }),
});

/** At most this many splashes at once (a new one reuses the oldest's slot). */
export const MAX_SPLASHES = 8;

/** Which girls' water will splash with which preset once it is wired into the battle (display only; not wired yet). */
export const WATER_SPLASH_GIRLS = Object.freeze({ nami: 'fresh', sango: 'fresh', umeko: 'river', wakaba: 'river' });
