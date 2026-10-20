// The new girls (owner: units; docs/specs/UNIT_GAPS.md §5): unique-mechanic students that fill the
// archetype gaps the live roster leaves (spike strips, a 360° ring shooter, a buff thrower, a sentry
// builder, …). Appended to UNITS by one line in src/data/units.js, after the returning girls, so the
// other files stay untouched. Their ⚡ abilities are rows in src/data/abilities.js like everyone's.
//
// Looks: every new girl is a student in an academy uniform with modern school tech, wholesome and
// fully covered (UNIT_GAPS §4.2; tests/data/units.test.js "look guard"). Look enums are the shared
// vocabulary; a new prop (a spike-strip reel, …) is a new weapon key every model builder knows.
//
// Costs: base inside the rarity band and tiers 1-4 inside UNIT_GAPS §5.1's bands (R 200-300, SR
// 380-560; T1 ~100-160, T2 220-380, T3 650-1300, T4 2000-4000). Tier 5 is the final tier (one girl per
// path at a time, owner Oct 15), so it sits in today's 12,000-36,000 window: the spec's T5 price × ~1.6,
// the factor the owner applied to every live girl. First-pass numbers measured with the balance bot
// (docs/BALANCE.md "New girls, wave 1").

import { S, stats, tier, path, free } from './unitKit.js';

// ---------------------------------------------------------------------------
// Azami — Checkpoint Prefect (spike strips; UNIT_GAPS §5.3, src/sim/strips.js)
// ---------------------------------------------------------------------------

const AZAMI = {
  id: 'azami',
  name: 'Azami',
  title: 'Checkpoint Prefect',
  kind: 'tower',
  rarity: 'R',
  adult: false,
  role: 'spiker',
  attackType: 'pierce',
  element: null,
  placement: 'land',
  materialFamily: 'cog',
  capabilities: ['trap'],
  pathCapabilities: ['armorShred', 'barrierBreak', 'stun', 'slow', 'detection', 'antiAir'],
  acquisition: free('2-2', 'Joins after 2-2: the Disciplinary Committee lends you its strictest prefect and her spike strips.'),
  palette: {
    hair: '#3b2d40', hairShade: '#241a29', eyes: '#c2414f', skin: '#ffe5d8',
    outfit: '#25262f', outfitShade: '#15161c', accent: '#a57cc4', halo: '#ffb3c1', weapon: '#b7bfcb',
  },
  look: {
    hairStyle: 'ponytail', bangs: 'swept', accessory: 'ribbon', outfit: 'blazer', weapon: 'strip',
    halo: 'ring', eyeStyle: 'sharp', expression: 'determined',
  },
  bio: 'The Disciplinary Committee\'s checkpoint prefect. A crisp black school blazer with a red committee armband, a white shirt and red tie, a pleated skirt, knee socks and loafers. Her high ponytail is tied with a thistle-purple ribbon, and she carries a clipboard, a whistle and a reel of folding spike strips on her hip.',
  personality: 'Strict about the rules and secretly soft on first-years: "No running in the halls — or on my road."',
  quote: 'Stop right there. Checkpoint!',
  tips: [
    'She lays spike strips on the road in her range: each strip hits every ground enemy on it once until its hits run out.',
    'Her placement chips: Near exit (default), Spread along the road, and Checkpoint at a point you aim (Checkpoint tier 3).',
    '⚡ Checkpoint Duty tier 3 teaches Spike Rain: a burst of extra strips spread along her whole road.',
    'Sticky Tar (Long Watch tier 3) keeps her strips through the wave break.',
  ],
  base: stats({
    cost: 300, behavior: 'strip', damage: 3, rate: 0.4, range: 2.8, projectileSpeed: 0, canHitAir: false,
    trap: { max: 8, damage: 3, triggerRadius: 0.45, armTime: 0.3, splash: 0, status: [] },
    strip: { hits: 6, ttl: 30 },
  }),
  paths: [
    path('sharp', 'Sharper Strips', 'Damage and blasts', [
      tier('Steel Points', 100, 'Strips +1 damage.', { trap: { damage: 1 } }),
      tier('Double Rows', 260, '+4 hits per strip.', { strip: { hits: 4 } }),
      tier('Shredder Strips', 850, 'Strips +4 damage; every hit cracks 1 armor for 3s (stacks 3 times).', { trap: { damage: 4, status: [S.shred(1, 3)] } }),
      tier('Charged Strips', 2600, 'A strip that runs out or expires explodes for 40 damage within 1 tile.', { strip: { boom: 40 } }),
      tier('Detonation Line', 15000, 'Strips +16 damage; the blasts deal 300 and stun for 0.5s; ×1.5 against barriers.', { trap: { damage: 16 }, strip: { boom: 260, boomStun: 0.5 }, barrierMul: 1.5 }),
    ]),
    path('checkpoint', 'Checkpoint Duty', 'Laying and placement', [
      tier('Fast Hands', 90, 'Lays strips 25% faster.', { rateMul: 1.25 }),
      tier('Patrol Route', 240, '+0.6 range; Spread covers every lane in her range.', { range: 0.6, strip: { lanes: true } }),
      tier('Checkpoint', 800, 'Checkpoint mode: strips land within 0.5 tiles of a point you aim. She lays 4× as fast in the first 3s of each wave.', { strip: { aim: true, opening: 3 } }),
      tier('Double Shift', 2400, 'Up to 12 strips; Spread lays 2 strips at a time.', { trap: { max: 4 }, strip: { pair: true } }),
      tier('Total Lockdown', 14500, 'Every 20s of a wave, a small Spike Rain of 6 strips lays itself.', { strip: { rain: 20, rainCount: 6 } }),
    ]),
    path('watch', 'Long Watch', 'Lasting strips', [
      tier('Treated Steel', 110, 'Strips last 45s.', { strip: { ttl: 15 } }),
      tier('Wide Strips', 280, 'Strips catch enemies 0.15 tiles further out.', { trap: { triggerRadius: 0.15 } }),
      tier('Sticky Tar', 900, 'Struck enemies are slowed 25% for 1.5s; strips carry into the next wave.', { trap: { status: [S.slow(0.25, 1.5)] }, strip: { carry: true } }),
      tier('Tall Barbs', 2800, 'Veil Sight; strips also catch flyers for half damage.', { detection: true, strip: { air: 0.5 } }),
      tier('Iron Discipline', 16000, 'Strips last until they are used up; +20 hits each; up to 20 strips.', { strip: { forever: true, hits: 20 }, trap: { max: 12 } }),
    ]),
  ],
  awakenPassive: { name: 'Prefect\'s Badge', desc: '+2 hits per strip and one more strip on the road.', mods: { strip: { hits: 2 }, trap: { max: 1 } } },
};

/** The new girls, in roster order. */
export const NEW_GIRLS = [AZAMI];
/** Their ids. */
export const NEW_GIRL_IDS = NEW_GIRLS.map((u) => u.id);
