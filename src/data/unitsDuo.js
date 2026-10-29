// The duo unit (owner: units; docs/specs/DUO_LR.md §1, §4): Kohaku & Tsubaki, two students on one base
// who cost one slot. Appended to UNITS by one line in src/data/units.js, after the new girls.
//
// Kit (DUO_LR §1.2): Tsubaki's star shells are her main weapon (the mortar behaviour: aimed, delayed,
// whole map, ground only); Kohaku's constant prism beam is the partner weapon (the `duo` block: its own integer-tick
// timer, ticked after the main one, src/sim/duo.js); Refraction splits every 4th shell into shards of light
// at a fixed offset table (mystic, they hit flyers). Her ⚡ ability Prismfall lives in src/data/abilities.js.
//
// Looks: both are students (adult: false) in academy uniforms (Kohaku's lilac council blazer, Tsubaki's navy
// cadet uniform); the battle model stands both chibis on one base (src/models/duo.js). Prices sit inside the live windows (DUO_LR §1.3).
// v0.1.61 (owner, Oct 29: "make her wayyyy stronger"): her base +25% (shells 15, beam 6.25, shard share 0.5) and
// each path's tier 5 fitted to beat the best Kage by about a quarter on the balance rulers (docs/specs/DUO_LR.md
// §6); Grand Spectrum and the LR form run her beams to the map edge (src/sim/duo.js).

import { S, stats, tier, path, GACHA_ONLY } from './unitKit.js';

const KOHAKU_TSUBAKI = {
  id: 'kohaku_tsubaki',
  name: 'Kohaku & Tsubaki',
  title: 'Prism Battery',
  kind: 'tower',
  rarity: 'SSR',
  adult: false,
  role: 'battery',
  attackType: 'blast',
  element: null,
  placement: 'land',
  materialFamily: 'ember',
  // one round base for both girls, the size of a hero's (src/sim/placement.js footprintRadius)
  footprint: 0.5,
  duo: { members: ['kohaku', 'tsubaki'] },
  capabilities: ['antiAir'],
  pathCapabilities: ['armorPen', 'armorShred', 'barrierBreak', 'slow', 'stun', 'silence'],
  acquisition: GACHA_ONLY,
  palette: {
    // Tsubaki's navy and gold with Kohaku's amber prism light
    hair: '#3c3f6e', hairShade: '#272a52', eyes: '#f2b44c', skin: '#fbe4d6',
    outfit: '#24345e', outfitShade: '#162140', accent: '#f6c66a', halo: '#ffe3a1', weapon: '#c9a24c',
  },
  look: {
    hairStyle: 'side', bangs: 'swept', accessory: 'cap', outfit: 'coat', weapon: 'cannon',
    halo: 'star', eyeStyle: 'sharp', expression: 'determined',
  },
  bio: 'Two friends from the academy who always work as a pair. Tsubaki, of the security club\'s cadet corps, wears a navy cadet cap and uniform with a grey vest and carries binoculars and a star launcher on her shoulder that drops shells anywhere on the map. Kohaku, the student council\'s science secretary, wears a lilac council blazer with a short cape, a plaid skirt and a gold monocle, and tunes a prism crystal that bends light into a constant, piercing beam. When Tsubaki\'s shell passes through Kohaku\'s prism, it splits into shards of starlight.',
  personality: 'Tsubaki is calm and precise and keeps time for both of them; Kohaku is curious and cheerful and always measuring angles. They finish each other\'s plans.',
  quote: 'You mark the spot, I\'ll bend the light. Starfall!',
  tips: [
    'Tsubaki\'s shells reach the whole map but only hit the ground; Kohaku\'s constant beam guards the sky close to them.',
    'Kohaku\'s beam stays on while an enemy is in reach and pierces the enemies lined up behind it: line it up along a straight.',
    'Every 4th shell splits into shards of light that hit flyers too: give them an aim point where the road bunches up.',
    '⚡ Refraction tier 3 teaches Prismfall: a barrage of split shells on her aim point, or on the densest crowd anywhere.',
  ],
  base: stats({
    // Tsubaki's star shells: aimed, MORTAR_DELAY s to land, the whole map, ground only
    cost: 850, behavior: 'mortar', damage: 15, rate: 0.35, range: 30, splash: 1.1, projectileSpeed: 0, canHitAir: false,
    // Kohaku's prism beam (the partner weapon) and Refraction (src/sim/duo.js)
    duo: {
      beamDmg: 6.25, beamRate: 0.7, beamRange: 3.6, beamPierce: 4, beams: 1,
      every: 4, shards: 3, shardShare: 0.5, shardSplash: 0.6,
    },
  }),
  paths: [
    path('starfall', 'Starfall Battery', 'More and bigger shells; elites and bosses', [
      tier('Packed Charges', 180, 'Shells +2 damage.', { damage: 2 }),
      tier('Quick Reload', 400, 'Tsubaki fires 15% faster.', { rateMul: 1.15 }),
      tier('Starfall Battery', 1300, '+1 shell per volley and +0.2 splash.', { projectiles: 1, splash: 0.2 }),
      tier('Falling Star', 4200, 'Shells +10 damage, ×1.3 vs elites and ×1.5 vs barriers.', { damage: 10, eliteMul: 1.3, barrierMul: 1.5 }),
      tier('Thousand Star Bombardment', 26000, '+2 shells per volley, +30 damage; Kohaku\'s beam ×60; ×10 vs bosses (shells and beam); shells stun for 0.3s.', { projectiles: 2, damage: 30, bossMul: 10, duo: { beamMul: 60 }, status: [S.stun(0.3)] }),
    ]),
    path('corridor', 'Prism Corridor', 'Kohaku\'s beam: flyers and armour', [
      tier('Polished Lens', 170, 'Kohaku\'s beam pierces 1 more enemy.', { duo: { beamPierce: 1 } }),
      tier('Long Focus', 380, 'Kohaku\'s beam reaches 0.3 tiles further.', { duo: { beamRange: 0.3 } }),
      tier('Prism Corridor', 1250, 'Kohaku holds 1 more constant beam, on another enemy; beams ignore 2 armour and deal ×1.3 vs flyers.', { duo: { beams: 1, beamPen: 2, beamAir: 1.3 } }),
      tier('Resonant Light', 4000, 'Her beam grows stronger the longer it holds the same enemy (up to +60%).', { duo: { rampPer: 0.08, rampMax: 0.6 } }),
      tier('Grand Spectrum', 24000, '+2 constant beams, +16 beam damage, beam ×11.7, shells ×6.4, ×11.5 vs bosses; each beam runs on through its enemy to the edge of the map, hitting everything on that line, and silences for 1s on lock-on and every 2s it holds.', { damageMul: 6.4, bossMul: 11.5, duo: { beams: 2, beamDmg: 16, beamPierce: 3, beamSilence: 1, edge: 1, beamMul: 11.7 } }),
    ]),
    path('refraction', 'Refraction', 'The two together: more shells split into light', [
      tier('Cut Facets', 160, 'Every 3rd shell splits.', { duo: { every: 3 } }),
      tier('Twin Timing', 400, 'Shards slow enemies 20% for 1s.', { duo: { shardSlow: 0.2, slowTime: 1 } }),
      tier('Refraction', 1350, 'Every 2nd shell splits, into 4 shards.', { duo: { every: 2, shards: 4 } }),
      tier('Shatterlight', 4300, 'Shards crack 2 armour and leave enemies Brittle (+12% damage taken) for 3s.', { duo: { shardShred: 2, shardVuln: 0.12 } }),
      tier('Constellation Lattice', 28000, 'Every shell splits, into 5 shards; shards +20 damage; shells and shards ×36.8, Kohaku\'s beam ×150, ×2.75 vs bosses.', { damageMul: 36.8, bossMul: 2.75, duo: { every: 1, shards: 5, shardDmg: 20, beamMul: 150 } }),
    ]),
  ],
  awakenPassive: {
    name: 'Twin Star Bond',
    desc: 'Every split shell makes 1 more shard; +6% damage (shells, shards and beam).',
    mods: { damageMul: 1.06, duo: { shardAdd: 1, beamMul: 1.06 } },
  },
};

/** The duo units, appended to UNITS after the new girls. */
export const DUO_UNITS = [KOHAKU_TSUBAKI];
export const DUO_UNIT_IDS = DUO_UNITS.map((u) => u.id);
