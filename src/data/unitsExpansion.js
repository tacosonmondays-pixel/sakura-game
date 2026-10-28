// The returning girls (owner: units; roster Builder 4, docs/merge/ROSTER_SPEC.md §5 and
// docs/specs/UNIT_GAPS.md §4): nine girls from the owner's older build, back as playable units on the
// roster mechanics (src/sim: mortar shells, relay origins, grounding and the air bonus, gather and the
// push lock, curse spread, beam ramp, the strike / aimed / runner ults, hex). Appended to UNITS by one
// line in src/data/units.js, so the 19 originals' file stays untouched.
//
// Looks (owner, Oct 20): every returning student wears an academy school uniform with modern tech gear
// (gadgets, rigs, drones, launchers); the three heroes are adult staff in staff or officer uniforms. No
// fantasy or traditional outfits (tests/data/units.test.js "look guard"). Kohaku and Tsubaki are not
// here: they come back as one duo unit (track 1).
//
// Costs: tiers 1-4 at today's scale beside each girl's named peer (ROSTER_SPEC §5.2); tier 5 (the final
// tier, one girl per path at a time) inside today's 12,000-36,000 window. First-pass numbers, measured
// with the balance bench (docs/BALANCE.md "Roster wave"); the owner's balance pass comes later.
//
// Each girl's activated ability lives with everyone else's: the numbers in src/data/abilities.js (ABILITIES,
// attached by units.js like every girl's), the words in src/data/abilityText.js (A3 M3).

import { HERO_TRACKS } from './heroTracks.js';
import { S, stats, tier, path, free, GACHA_ONLY } from './unitKit.js';

// ---------------------------------------------------------------------------
// Heroes — adult staff (one per player, free to deploy, level 1–25 in battle)
// ---------------------------------------------------------------------------

const KANNA = {
  id: 'kanna',
  name: 'Kanna',
  title: 'Drum Club Advisor',
  kind: 'hero',
  rarity: 'SSR',
  adult: true,
  role: 'champion',
  attackType: 'slash',
  element: null,
  placement: 'land',
  materialFamily: 'blade',
  capabilities: ['detection', 'armorShred'],
  pathCapabilities: ['stun', 'armorPen', 'barrierBreak', 'antiAir', 'reveal', 'slow'],
  acquisition: GACHA_ONLY,
  palette: {
    hair: '#df6b82', hairShade: '#b04560', eyes: '#efc562', skin: '#fbe0d0',
    outfit: '#942e42', outfitShade: '#2a1a22', accent: '#f3e9d2', halo: '#ffcf73', weapon: '#8a5a3a',
  },
  look: {
    hairStyle: 'twintails', bangs: 'messy', accessory: 'horns', outfit: 'coat', weapon: 'mallet',
    halo: 'flame', eyeStyle: 'sharp', expression: 'cheerful',
  },
  bio: 'The academy\'s drum club advisor and reigning city festival champion, an adult staff member in a fitted red-and-black club track jacket with a drum crest, slacks and running shoes. Coral twin-tails ringed in gold, small ivory horns, a pair of carbon drumsticks and a shoulder-slung drum pad wired to a shockwave amp. Every beat cracks armor and staggers giants.',
  personality: 'Loud, warm and impossible to out-cheer; treats every battle like the festival finale and every student like her favourite band member.',
  quote: 'Hey, hey! Feel the beat? This is the main event!',
  tips: [
    'Her focus builds with every strike on the same enemy and cracks its armor for the team.',
    'Festival Drumfall hits the strongest enemy on the whole map: save it for an elite or a boss.',
    'Melee: her drumsticks reach flyers only from Lv 6.',
  ],
  base: stats({
    cost: 0, behavior: 'duel', damage: 7, rate: 1.0, range: 2.0, projectileSpeed: 0, canHitAir: false, detection: true,
    ramp: { per: 0.08, max: 0.6 }, status: [S.shred(1, 3)], crit: { chance: 0.05, mul: 1.5 },
  }),
  paths: [],
  awakenPassive: {
    name: 'Festival Spirit',
    desc: '+8% damage; focus builds 2% faster and reaches +10% further.',
    mods: { damageMul: 1.08, ramp: { per: 0.02, max: 0.1 } },
  },
  hero: {
    levels: HERO_TRACKS.kanna.levels,
    pathKeys: HERO_TRACKS.kanna.pathKeys,
    ult: {
      name: 'Festival Drumfall',
      desc: 'An amplified drum strike on the strongest enemy on the map: 260 damage that ignores armor, cracks 4 armor for 8s and staggers it for 1s; enemies within 1.5 tiles take 30%.',
      unlockLevel: 3,
      cooldown: 65,
      effect: { type: 'strike', target: 'strongest', damage: 260, armorPen: 99, splash: 1.5, splashMul: 0.3, status: [S.shred(4, 8), S.stun(1)] },
      ranks: HERO_TRACKS.kanna.ultRanks,
    },
  },
};

const YORIKO = {
  id: 'yoriko',
  name: 'Yoriko',
  title: 'Drama Club Director',
  kind: 'hero',
  rarity: 'SSR',
  adult: true,
  role: 'puppeteer',
  attackType: 'mystic',
  element: null,
  placement: 'land',
  materialFamily: 'rune',
  capabilities: ['detection', 'slow', 'antiAir'],
  pathCapabilities: ['stun', 'buff', 'silence', 'armorPen'],
  acquisition: GACHA_ONLY,
  palette: {
    hair: '#ad94cb', hairShade: '#8470a6', eyes: '#c6b8f1', skin: '#fbe6e2',
    outfit: '#47416e', outfitShade: '#2c2848', accent: '#c6b8f1', halo: '#e6dcff', weapon: '#d8c9a8',
  },
  look: {
    hairStyle: 'ponytail', bangs: 'hime', accessory: 'catEars', outfit: 'coat', weapon: 'puppet',
    halo: 'moon', eyeStyle: 'sleepy', expression: 'smile',
  },
  bio: 'The drama club\'s director, an adult faculty member in a long navy staff coat cut like a stage coat over a lilac vest, gloves and a stage headset. Lavender hair in a high ponytail under a cat-ear headset, and a control bar that steers a little drone marionette in a tiny school uniform. Her threads slow the wave, and her final act sends it back to the start.',
  personality: 'Dreamy, theatrical and gently mischievous; narrates every battle like a stage play and gives every student a curtain call.',
  quote: 'And now... a change of scenery.',
  tips: [
    'Her threads slow two enemies at once.',
    'Dream Detour pushes every enemy back 5 tiles (bosses resist) and hexes them: a lifesaver right before a leak.',
    'From Lv 5 her stage aura helps the girls around her.',
  ],
  base: stats({
    cost: 0, damage: 6, rate: 0.9, range: 3.0, projectiles: 2, projectileSpeed: 13, canHitAir: true, detection: true,
    status: [S.slow(0.3, 0.9)],
  }),
  paths: [],
  awakenPassive: {
    name: 'Sweet Dreams',
    desc: 'Slows strengthened to 35% for 1.2s and +5% damage.',
    mods: { status: [S.slow(0.35, 1.2)], damageMul: 1.05 },
  },
  hero: {
    levels: HERO_TRACKS.yoriko.levels,
    pathKeys: HERO_TRACKS.yoriko.pathKeys,
    ult: {
      name: 'Dream Detour',
      desc: 'The curtain falls: every enemy takes 70 damage, is pushed back 5 tiles (bosses resist), slowed by 50% for 3s and hexed (1% of its max HP a second, no regen) for 5s.',
      unlockLevel: 3,
      cooldown: 72,
      effect: { type: 'tide', damage: 70, pushback: 5, slow: 0.5, duration: 3, status: [S.hex(0.01, 5)] },
      ranks: HERO_TRACKS.yoriko.ultRanks,
    },
  },
};

const SEIRAN = {
  id: 'seiran',
  name: 'Seiran',
  title: 'Sky Patrol Instructor',
  kind: 'hero',
  rarity: 'SSR',
  adult: true,
  role: 'stormrider',
  attackType: 'mystic',
  element: 'lightning',
  placement: 'amphibious',
  materialFamily: 'feather',
  capabilities: ['detection', 'antiAir', 'water', 'multiHit'],
  pathCapabilities: ['stun', 'grounding', 'armorPen', 'buff', 'slow'],
  acquisition: GACHA_ONLY,
  palette: {
    hair: '#80b9e4', hairShade: '#5791c0', eyes: '#c0e9f2', skin: '#fbe6dc',
    outfit: '#6f9fcf', outfitShade: '#3f6a96', accent: '#3e8c9e', halo: '#c0e9f2', weapon: '#e9c46a',
  },
  look: {
    hairStyle: 'wavy', bangs: 'swept', accessory: 'horns', outfit: 'coat', weapon: 'spear',
    halo: 'bolt', eyeStyle: 'sharp', expression: 'determined',
  },
  bio: 'The academy\'s aerial patrol flight instructor, an adult officer in a light-blue flight jacket with gold shoulder boards, a teal tie, a pleated skirt and flight boots. Light-blue waves, small golden horns, a flight headset and a telescoping storm lance that throws chain lightning. Her long sky dragon flies the patrol route with her, on land or over water.',
  personality: 'Free-spirited and confident; laughs in thunderstorms, races the dragon at dawn and never misses a safety briefing.',
  quote: 'Ride the storm with me!',
  tips: [
    'Deploys on land or water. Her chain lightning prefers flyers.',
    'Set her aim point: Dragonflight enters there and flies back along the road all the way to its start, grounding flyers and marking everything it hits.',
    'Without an aim the dragon enters at the exit end of the busiest path and flies the whole road.',
  ],
  base: stats({
    cost: 0, behavior: 'chain', damage: 5, rate: 0.8, range: 3.4, chain: 3, projectileSpeed: 0, canHitAir: true, detection: true,
    airMul: 1.25, status: [S.shock(0.15, 0.3)],
  }),
  paths: [],
  awakenPassive: {
    name: 'Storm\'s Eye',
    desc: 'One more jump and +0.2 range.',
    mods: { chain: 1, range: 0.2 },
  },
  hero: {
    levels: HERO_TRACKS.seiran.levels,
    pathKeys: HERO_TRACKS.seiran.pathKeys,
    ult: {
      name: 'Dragonflight',
      desc: 'Her sky dragon enters at her aim point (or the busy path\'s exit) and flies back along the road all the way to its start, in up to 5s: each enemy its 6 segments touch takes 140 lightning damage, flyers are grounded for 5s and everything is marked (+18% damage taken) for 5s; bosses take the damage only.',
      unlockLevel: 3,
      cooldown: 66,
      effect: {
        // toStart: the whole road back to START, in at most `time` s and never slower than `minSpeed` tiles/s
        // (src/sim/runners.js); the slowest pace is the old 10 tiles in 3s
        type: 'runner', runner: 'dragon', center: 'aim', toStart: true, damage: 140, time: 5, minSpeed: 10 / 3, segments: 6, gap: 0.6, attackType: 'mystic',
        status: [S.ground(5), S.mark(0.18, 5)],
      },
      ranks: HERO_TRACKS.seiran.ultRanks,
    },
  },
};

// ---------------------------------------------------------------------------
// Towers — academy students in school uniforms with tech gear
// ---------------------------------------------------------------------------

const FUU = {
  id: 'fuu',
  name: 'Fuu',
  title: 'Dance Club Turbine Dancer',
  kind: 'tower',
  rarity: 'R',
  adult: false,
  role: 'displacement',
  attackType: 'mystic',
  element: null,
  placement: 'land',
  materialFamily: 'rime',
  capabilities: ['antiAir', 'multiHit'],
  pathCapabilities: ['slow', 'stun', 'grounding', 'reveal'],
  acquisition: GACHA_ONLY,
  palette: {
    hair: '#7f5240', hairShade: '#4e3128', eyes: '#6ecebc', skin: '#ffe8dc',
    outfit: '#eef6e8', outfitShade: '#8fcfb0', accent: '#4f9e88', halo: '#c8ffe8', weapon: '#e9d8a6',
  },
  look: {
    hairStyle: 'twintails', bangs: 'swept', accessory: 'hairpin', outfit: 'hoodie', weapon: 'fan',
    halo: 'leaf', eyeStyle: 'sparkle', expression: 'cheerful',
  },
  bio: 'A first-year from the dance club. Cocoa-brown twin-tails tied with mint ribbons and leaf-and-star pins, a mint track jacket over a white sailor top, a pleated skirt over sport leggings and sneakers, and a big folding fan with a little turbine in every rib. One sweep and a whole column of goblins tumbles back down the path.',
  personality: 'Breezy, carefree and impossible to pin down; hums while she fights and never walks when she can twirl.',
  quote: 'Back you go~ Again! And again!',
  tips: [
    'Her gusts push enemies back into your kill zone; each enemy can only be pushed once every 1.2 seconds.',
    'Gathering Dance pulls the enemies ahead of her target back into a clump for splash girls.',
    'Bosses barely move: pair her with damage, not instead of it.',
    '⚡ Returning Gale tier 3 teaches Backdraft Fan: one great sweep that blows a whole crowd back up the road.',
  ],
  base: stats({ cost: 260, damage: 2, rate: 0.7, range: 3.0, projectiles: 3, projectileSpeed: 13, knockback: 0.6, canHitAir: true }),
  paths: [
    path('gale', 'Returning Gale', 'Push-back', [
      tier('Brisk Fans', 90, 'Gusts push 0.15 tiles further.', { knockback: 0.15 }),
      tier('Twin Gusts', 240, 'One more gust per sweep.', { projectiles: 1 }),
      tier('Gale Wall', 700, 'Push +0.2 tiles; gusts slow by 25% for 1s.', { knockback: 0.2, status: [S.slow(0.25, 1)] }),
      tier('Typhoon Fans', 2200, 'Two more gusts, push +0.25 tiles, +6 damage.', { projectiles: 2, knockback: 0.25, damage: 6 }),
      tier('Heaven\'s Gate Wind', 14000, 'Two more gusts, push +0.4 tiles, +14 damage, +40% attack speed.', { projectiles: 2, knockback: 0.4, damage: 14, rateMul: 1.4 }),
    ]),
    path('gather', 'Gathering Dance', 'Clump the wave', [
      tier('Light Steps', 80, '+0.4 range.', { range: 0.4 }),
      tier('Spin Step', 220, '+15% attack speed.', { rateMul: 1.15 }),
      tier('Gathering Dance', 650, 'Gusts pull the enemies ahead of her target back toward it and splash 0.4 tiles.', { gather: 0.35, splash: 0.4 }),
      tier('Whirlwind Waltz', 2400, 'Stronger pull, wider splash, +4 damage; Brittle +10% for 2s.', { gather: 0.15, splash: 0.4, damage: 4, status: [S.vulnerable(0.1, 2)] }),
      tier('Eye of the Storm', 13000, 'Strongest pull, +18 damage, wider splash; 20% of gusts stun for 0.4s.', { gather: 0.1, damage: 18, splash: 0.4, status: [S.stun(0.4, 0.2)] }),
    ]),
    path('ground', 'Grounding Breeze', 'Flyers and veils', [
      tier('Turbine Tune', 100, '+1 damage.', { damage: 1 }),
      tier('Wide Sweep', 260, '+0.3 range.', { range: 0.3 }),
      tier('Grounding Breeze', 800, 'Gusts knock flyers down for 1.5s and reveal veiled enemies.', { status: [S.ground(1.5)], reveal: 1.5 }),
      tier('Downdraft', 2600, 'Flyers stay down 2.5s; ×1.5 against flyers; +4 damage.', { status: [S.ground(2.5)], airMul: 1.5, damage: 4 }),
      tier('Sky Sweeper', 15000, '×1.4 against flyers, +18 damage, two more gusts, +30% attack speed.', { airMul: 1.4, damage: 18, projectiles: 2, rateMul: 1.3 }),
    ]),
  ],
  awakenPassive: { name: 'Tailwind', desc: 'Gusts push 0.1 tiles further and +0.2 range.', mods: { knockback: 0.1, range: 0.2 } },
};

const HANA = {
  id: 'hana',
  name: 'Hana',
  title: 'Wildlife Club Drone Falconer',
  kind: 'tower',
  rarity: 'R',
  adult: false,
  role: 'falconer',
  attackType: 'pierce',
  element: null,
  placement: 'land',
  materialFamily: 'feather',
  capabilities: ['antiAir', 'grounding'],
  pathCapabilities: ['armorPen', 'priority', 'detection', 'stun'],
  acquisition: free('7-5', 'Joins after 7-5, right before the wyverns of the Ashwing Peaks: her falcon drone knocks flyers out of the sky.'),
  palette: {
    hair: '#865844', hairShade: '#5e3c2c', eyes: '#dbc17c', skin: '#fbe2cf',
    outfit: '#798d5b', outfitShade: '#55663e', accent: '#dbc17c', halo: '#e8f5c8', weapon: '#8a5a3a',
  },
  look: {
    hairStyle: 'braid', bangs: 'swept', accessory: 'none', outfit: 'coat', weapon: 'bow',
    halo: 'star', eyeStyle: 'sharp', expression: 'calm',
  },
  bio: 'The wildlife club\'s field ranger. Auburn hair in a long braid, an olive hooded field jacket over her sailor uniform, a skirt over tights, trail boots and a falconry glove with a little control screen. She shoots a compound bow with a rangefinder sight, and Kaze, the falcon drone she built in the robotics lab, rides on her shoulder and swoops out at every enemy she shoots, flyers first.',
  personality: 'Quiet, patient and fiercely loyal; talks to Kaze more than to people and knows every bird call on the mountain.',
  quote: 'Kaze, dive! Bring them down to me.',
  tips: [
    'Her shots hunt flyers first (Air targeting) and hit them twice as hard.',
    'Grounded flyers can be hit by Rei, Akane, Sango and every other ground-only girl.',
    'She joins after 7-5, just in time for the Ashwing Peaks.',
    '⚡ Falconry tier 3 teaches Kaze\'s Swoop: Kaze strikes the flyers anywhere on the map and knocks them out of the sky.',
  ],
  base: stats({ cost: 240, damage: 4, rate: 1.1, range: 3.8, projectileSpeed: 18, canHitAir: true, airMul: 2, status: [S.ground(1.2)] }),
  paths: [
    path('falconry', 'Falconry', 'Damage to flyers', [
      tier('Sharp Talons', 100, '+1 damage.', { damage: 1 }),
      tier('Updraft Sense', 240, '+0.4 range; ×1.1 against flyers.', { range: 0.4, airMul: 1.1 }),
      tier('Talon Dive', 700, 'Flyers stay down 2.2s; ignores 1 armor.', { status: [S.ground(2.2)], armorPen: 1 }),
      tier('Raptor Strike', 2200, '+10 damage, ×1.25 against flyers, +30% against elites.', { damage: 10, airMul: 1.25, eliteMul: 1.3 }),
      tier('Sky Sovereign', 14000, '+30 damage, ×1.3 against flyers, a second arrow, +30% attack speed.', { damage: 30, airMul: 1.3, projectiles: 2, rateMul: 1.3 }),
    ]),
    path('mark', 'Hunter\'s Mark', 'Marking for the team', [
      tier('Recurve Bow', 80, '+0.4 range.', { range: 0.4 }),
      tier('Keen Eye', 200, '5% crits for ×1.5.', { crit: { chance: 0.05, mul: 1.5 } }),
      tier('Hunter\'s Mark', 700, 'Hits mark the target: +12% damage from everyone for 3s.', { mark: { bonus: 0.12, duration: 3 } }),
      tier('Hunting Call', 2000, 'Mark +18%; Kaze\'s camera grants Veil Sight; +4 damage.', { mark: { bonus: 0.18, duration: 3 }, detection: true, damage: 4 }),
      tier('Apex Falconry', 13000, 'Mark +25% for 4s, +26 damage, +50% against elites, +30% against bosses.', { mark: { bonus: 0.25, duration: 4 }, damage: 26, eliteMul: 1.5, bossMul: 1.3 }),
    ]),
    path('feathers', 'Rapid Feathers', 'Volleys', [
      tier('Quick Nock', 90, '+15% attack speed.', { rateMul: 1.15 }),
      tier('Twin Feathers', 250, 'One more arrow.', { projectiles: 1 }),
      tier('Feather Storm', 600, 'One more arrow; arrows pierce 1 more enemy.', { projectiles: 1, pierce: 1 }),
      tier('Featherfall Volley', 2400, 'Two more arrows, +40% attack speed.', { projectiles: 2, rateMul: 1.4 }),
      tier('Thousand Wings', 15000, 'Two more arrows, +50% attack speed, +10 damage; 15% of arrows stun for 0.3s.', { projectiles: 2, rateMul: 1.5, damage: 10, status: [S.stun(0.3, 0.15)] }),
    ]),
  ],
  awakenPassive: { name: 'Keen Eyes', desc: '+0.3 range and +8% damage.', mods: { range: 0.3, damageMul: 1.08 } },
};

const RURI = {
  id: 'ruri',
  name: 'Ruri',
  title: 'Library Club Holo-Summoner',
  kind: 'tower',
  rarity: 'SR',
  adult: false,
  role: 'summoner',
  attackType: 'mystic',
  element: null,
  placement: 'land',
  materialFamily: 'rune',
  capabilities: ['antiAir'],
  pathCapabilities: ['armorShred', 'stun', 'detection', 'grounding', 'slow'],
  acquisition: GACHA_ONLY,
  palette: {
    hair: '#577cce', hairShade: '#3a5aa6', eyes: '#89c5fc', skin: '#ffe8de',
    outfit: '#34477a', outfitShade: '#232f55', accent: '#89c5fc', halo: '#cfe6ff', weapon: '#5ad1ff',
  },
  look: {
    hairStyle: 'braid', bangs: 'split', accessory: 'hairpin', outfit: 'blazer', weapon: 'tome',
    halo: 'star', eyeStyle: 'round', expression: 'shy',
  },
  bio: 'A library committee first-year. Deep-blue hair with a side braid and a star clip, a navy academy blazer over a sweater vest, a sky-blue ribbon tie, a plaid skirt, knee socks and a library armband. Her grimoire is a rugged tablet that projects Kon, a little holographic white fox, to the edge of the lane, and every bolt she casts leaps out of Kon.',
  personality: 'Shy and polite with people, endlessly chatty with her fox; bookmarks every page with pressed flowers.',
  quote: 'Kon, go! ...Please be careful!',
  tips: [
    'Kon fights from the edge of the nearest lane, so Ruri can stand far back.',
    'Her range ring is centred on Kon, not on Ruri.',
    'Moonhound bites crack armor, Star Falcon hits flyers harder (switch her to Air targeting), Tide Otter reaches further and soaks.',
    '⚡ Moonhound tier 3 teaches Moon Pounce: Kon leaps on the strongest enemy in reach, bites hard and holds it in place.',
  ],
  base: stats({ cost: 400, damage: 7, rate: 0.9, range: 2.4, projectileSpeed: 14, canHitAir: true, relay: { kind: 'familiar', reach: 3.5 } }),
  paths: [
    path('hound', 'Moonhound', 'Ground familiar', [
      tier('Sharp Fangs', 130, '+1 damage.', { damage: 1 }),
      tier('Twin Bite', 300, 'One more bite per attack.', { projectiles: 1 }),
      tier('Moonhound', 950, 'Bites splash 0.5 tiles and shred 1 armor for 3s.', { splash: 0.5, status: [S.shred(1, 3)] }),
      tier('Silver Pack', 2800, 'One more bite, +8 damage, wider splash.', { projectiles: 1, damage: 8, splash: 0.3 }),
      tier('Moon Wolf Alpha', 20000, '+26 damage, wider splash; 20% of bites stun for 0.4s.', { damage: 26, splash: 0.4, status: [S.stun(0.4, 0.2)] }),
    ]),
    path('falcon', 'Star Falcon', 'Air familiar', [
      tier('Sky Perch', 120, '+0.3 range.', { range: 0.3 }),
      tier('Swift Wings', 280, '+15% attack speed.', { rateMul: 1.15 }),
      tier('Star Falcon', 900, '×1.5 against flyers; Kon gains Veil Sight.', { airMul: 1.5, detection: true }),
      tier('Starlit Talons', 2700, 'Flyers are knocked down for 2s; ×1.3 against flyers; +4 damage.', { status: [S.ground(2)], airMul: 1.3, damage: 4 }),
      tier('Constellation Raptor', 18000, '+24 damage, +40% attack speed, ×1.2 against flyers, one more bolt.', { damage: 24, rateMul: 1.4, airMul: 1.2, projectiles: 1 }),
    ]),
    path('otter', 'Tide Otter', 'Reach and water', [
      tier('River Paws', 140, 'Kon can stand 0.6 tiles further from Ruri.', { relay: { reach: 0.6 } }),
      tier('Splash Play', 320, 'Bolts soak for 2s.', { status: [S.soak(2)] }),
      tier('Tide Otter', 1000, 'Kon reaches 0.8 tiles further; bolts slow 20% and push 0.1 tiles.', { relay: { reach: 0.8 }, status: [S.slow(0.2, 1)], knockback: 0.1 }),
      tier('Riverkeeper', 3000, 'Water bolts: +4 damage, 30% slows.', { element: 'water', damage: 4, status: [S.slow(0.3, 1.5)] }),
      tier('Great Otter Spirit', 21000, '+22 damage, bolts splash 0.8 tiles, +30% attack speed.', { damage: 22, splash: 0.8, rateMul: 1.3 }),
    ]),
  ],
  awakenPassive: { name: 'Bonded Familiar', desc: '+8% damage and Kon reaches 0.3 tiles further.', mods: { damageMul: 1.08, relay: { reach: 0.3 } } },
};

const NOA = {
  id: 'noa',
  name: 'Noa',
  title: 'Health Committee Medic',
  kind: 'tower',
  rarity: 'SR',
  adult: false,
  role: 'purifier',
  attackType: 'holy',
  element: null,
  placement: 'land',
  materialFamily: 'charm',
  capabilities: ['cleanse', 'buff', 'antiAir'],
  pathCapabilities: ['detection', 'silence', 'reveal', 'stun', 'slow'],
  acquisition: free('6-2', 'Joins after 6-2, right before the sappers of Sabotage!: her sanctuary keeps nearby girls from being jammed.'),
  palette: {
    hair: '#c69462', hairShade: '#9a6c3f', eyes: '#c26a78', skin: '#fff0ea',
    outfit: '#d9dde2', outfitShade: '#a9b0b8', accent: '#7fd6b5', halo: '#ffe0ec', weapon: '#f0a6bf',
  },
  look: {
    hairStyle: 'buns', bangs: 'hime', accessory: 'flower', outfit: 'blazer', weapon: 'shield',
    halo: 'petal', eyeStyle: 'round', expression: 'smile',
  },
  bio: 'A health committee second-year. Honey-brown hair in two low buns with blossom pins, a light-grey blazer over a mint cardigan, a white blouse with a mint ribbon and an armband with a sakura emblem. She carries a deployable ward shield with a sakura emitter, and inside its field nothing can jam, stun or scare her friends.',
  personality: 'Kind, steady and endlessly patient; carries plasters and everyone\'s favourite snack.',
  quote: 'You\'re safe here. I\'ve got you.',
  tips: [
    'Girls inside her sanctuary cannot be sabotaged or stunned by volatile slimes.',
    'Her chimes are weak, but holy: they silence field oni and end phasing.',
    'Blessings from Noa and Miko do not stack: the stronger one wins.',
    '⚡ Pure Sanctuary tier 3 teaches First Aid Call: nobody near her can be jammed or stunned for a while, and enemies falling close to her bring back lives.',
  ],
  base: stats({
    cost: 360, behavior: 'pulse', damage: 1, rate: 0.5, range: 2.4, maxTargets: 4, projectileSpeed: 0, canHitAir: true,
    aura: { range: 2.6, cleanse: true, dmgMul: 1.08 },
  }),
  paths: [
    path('sanctuary', 'Pure Sanctuary', 'Cleansing aura', [
      tier('Wider Field', 120, 'Her sanctuary reaches 3.0 tiles.', { aura: { range: 3.0 } }),
      tier('Calm Breath', 300, 'Girls in it attack 5% faster.', { aura: { rateMul: 1.05 } }),
      tier('Pure Sanctuary', 950, 'The sanctuary shares Veil Sight; chimes silence for 0.6s.', { aura: { detection: true }, silence: 0.6 }),
      tier('Hallowed Ground', 3000, 'Reaches 3.6 tiles, +5% damage; chimes reveal veils for 2s.', { aura: { range: 3.6, dmgMul: 1.05 }, reveal: 2 }),
      tier('Eternal Sanctuary', 19000, 'Reaches 4.2 tiles, +8% damage, +8% attack speed, 8% cheaper upgrades.', { aura: { range: 4.2, dmgMul: 1.08, rateMul: 1.08, costCut: 0.08 } }),
    ]),
    path('blessing', 'Bright Blessing', 'Damage aura', [
      tier('Morning Check', 140, 'Aura +3% damage.', { aura: { dmgMul: 1.03 } }),
      tier('Warm Light', 320, 'Aura +5% range.', { aura: { rangeMul: 1.05 } }),
      tier('Bright Blessing', 1100, 'Aura +5% damage and +5% attack speed.', { aura: { dmgMul: 1.05, rateMul: 1.05 } }),
      tier('Choir of Petals', 3400, 'Aura +8% attack speed and +4% damage; +0.3 range.', { aura: { rateMul: 1.08, dmgMul: 1.04 }, range: 0.3 }),
      tier('Radiant Hymn', 22000, 'Aura +8% damage, +6% attack speed, +6% range.', { aura: { dmgMul: 1.08, rateMul: 1.06, rangeMul: 1.06 } }),
    ]),
    path('hymn', 'Ward Chime', 'Holy chimes', [
      tier('Gentle Chime', 100, '+1 damage.', { damage: 1 }),
      tier('Quick Triage', 260, '+20% attack speed.', { rateMul: 1.2 }),
      tier('Ward Chime', 850, 'Chimes reach 4 more enemies; 15% stun for 0.3s.', { maxTargets: 4, status: [S.stun(0.3, 0.15)] }),
      tier('Sakura Aegis', 2600, '+4 damage, 25% slows, +0.4 range.', { damage: 4, status: [S.slow(0.25, 1.5)], range: 0.4 }),
      tier('Thousand Petal Ward', 18000, '+10 damage, 6 more enemies per chime, +30% attack speed.', { damage: 10, maxTargets: 6, rateMul: 1.3 }),
    ]),
  ],
  awakenPassive: { name: 'Gentle Light', desc: 'Aura +3% damage and +0.2 range.', mods: { aura: { dmgMul: 1.03 }, range: 0.2 } },
};

const IROHA = {
  id: 'iroha',
  name: 'Iroha',
  title: 'Art Club Mirror Technician',
  kind: 'tower',
  rarity: 'SSR',
  adult: false,
  role: 'mirror',
  attackType: 'mystic',
  element: null,
  placement: 'land',
  materialFamily: 'rune',
  capabilities: ['antiAir'],
  pathCapabilities: ['reveal', 'detection', 'armorPen', 'silence', 'slow', 'stun'],
  acquisition: GACHA_ONLY,
  palette: {
    hair: '#40304e', hairShade: '#281c33', eyes: '#c8bfe1', skin: '#fbe6dc',
    outfit: '#3a3d48', outfitShade: '#24262e', accent: '#9b5a8c', halo: '#e6dcff', weapon: '#d9d4e6',
  },
  look: {
    hairStyle: 'buns', bangs: 'straight', accessory: 'hairpin', outfit: 'sailor', weapon: 'mirror',
    halo: 'ring', eyeStyle: 'sleepy', expression: 'calm',
  },
  bio: 'An art club second-year. Black hair in buns with a round silver ornament, a charcoal sailor uniform with a plum scarf, a long plum cardigan and black tights. She carries a smart hand mirror on a lanyard and sets a hovering mirror panel on a little drone easel beside a far lane; her bolts fire from her own mirror and from the panel at once.',
  personality: 'Reserved, elegant and a perfectionist; can spend an hour polishing a single spot.',
  quote: 'Look closer. The mirror sees what you missed.',
  tips: [
    'She fires from two places: where she stands and from her mirror panel.',
    'Aim the panel beside a lane she cannot reach; without an aim it goes to the nearest lane edge.',
    'The second range ring is centred on the panel.',
    '⚡ Mirror Hall tier 3 teaches Mirror Shift: her panel jumps where you aim and splits the team\'s shots in two.',
  ],
  base: stats({
    cost: 600, damage: 4, rate: 0.7, range: 2.3, projectiles: 2, projectileSpeed: 15, canHitAir: true,
    relay: { kind: 'mirror', reach: 3.7, both: true },
  }),
  paths: [
    path('hall', 'Mirror Hall', 'More reflections', [
      tier('Bright Glass', 160, '+1 damage.', { damage: 1 }),
      tier('Second Pane', 360, 'One more bolt from each point.', { projectiles: 1 }),
      tier('Mirror Hall', 1200, 'Bolts pierce 2 more enemies and reveal veils for 1.5s.', { pierce: 2, reveal: 1.5 }),
      tier('Hall of Reflections', 3600, 'Two more bolts, +4 damage.', { projectiles: 2, damage: 4 }),
      tier('Infinite Reflection', 26000, 'Two more bolts, +12 damage, pierce +2, +30% attack speed.', { projectiles: 2, damage: 12, pierce: 2, rateMul: 1.3 }),
    ]),
    path('silver', 'Silver Reflection', 'Reach and precision', [
      tier('Long Frame', 130, 'The panel can stand 0.6 tiles further away.', { relay: { reach: 0.6 } }),
      tier('Clear Silver', 340, '+0.3 range.', { range: 0.3 }),
      tier('Silver Reflection', 1100, 'Veil Sight; the panel reaches 0.8 tiles further.', { detection: true, relay: { reach: 0.8 } }),
      tier('Moonlit Looking-Glass', 3500, '+0.6 range, +5 damage, ignores 3 armor.', { range: 0.6, damage: 5, armorPen: 3 }),
      tier('Mirror of Truth', 25000, '+14 damage, +50% against elites, silences for 0.8s, ignores 3 more armor.', { damage: 14, eliteMul: 1.5, silence: 0.8, armorPen: 3 }),
    ]),
    path('shard', 'Shattered Glass', 'Splash and control', [
      tier('Quick Polish', 140, '+12% attack speed.', { rateMul: 1.12 }),
      tier('Splintered Glass', 320, 'Bolts splash 0.4 tiles.', { splash: 0.4 }),
      tier('Glass Shards', 1150, 'Wider splash; 20% slows for 1s.', { splash: 0.3, status: [S.slow(0.2, 1)] }),
      tier('Glass Storm', 3600, '+5 damage, wider splash; 15% stun for 0.3s.', { damage: 5, splash: 0.4, status: [S.stun(0.3, 0.15)] }),
      tier('Kaleidoscope Burst', 27000, '+13 damage, splash +0.6, +30% attack speed.', { damage: 13, splash: 0.6, rateMul: 1.3 }),
    ]),
  ],
  awakenPassive: { name: 'Polished Silver', desc: 'Bolts pierce 1 more enemy and +6% damage.', mods: { pierce: 1, damageMul: 1.06 } },
};

const ENA = {
  id: 'ena',
  name: 'Ena',
  title: 'Occult Club Fortune Hacker',
  kind: 'tower',
  rarity: 'SSR',
  adult: false,
  role: 'hexer',
  attackType: 'mystic',
  element: null,
  placement: 'land',
  materialFamily: 'rune',
  capabilities: ['antiAir'],
  pathCapabilities: ['antiHeal', 'armorShred', 'silence', 'stun'],
  acquisition: GACHA_ONLY,
  palette: {
    hair: '#c27594', hairShade: '#94506e', eyes: '#e2a4cf', skin: '#fbe4dc',
    outfit: '#2b2530', outfitShade: '#17131a', accent: '#c8243c', halo: '#ffb3d1', weapon: '#f2e6ea',
  },
  look: {
    hairStyle: 'braid', bangs: 'split', accessory: 'flower', outfit: 'blazer', weapon: 'cards',
    halo: 'moon', eyeStyle: 'sharp', expression: 'smug',
  },
  bio: 'The occult club\'s fortune-teller. Rose-pink hair with a braid and a red rose ornament, a black academy blazer with a crimson tie, a long black cardigan and a wrist launcher that deals holo curse cards on red threads of light. When a cursed enemy falls, the curse blooms onto its neighbours.',
  personality: 'Teasing, dramatic and fond of ominous predictions, which are usually about lunch.',
  quote: 'Draw a card. Oh dear... that one\'s for you.',
  tips: [
    'Cursed enemies burst when they fall, hurting their neighbours and passing on a weaker curse.',
    'A curse spreads at most two more times: dense waves chain beautifully.',
    'Withering Script stops regeneration like poison.',
    '⚡ Cursed Bloom tier 3 teaches Omen Card: a cursed card for every enemy around her, so a dense wave bursts in a chain.',
  ],
  base: stats({ cost: 580, damage: 12, rate: 1.0, range: 3.2, projectileSpeed: 14, canHitAir: true, status: [S.curse(0.8, 1.1, 4)] }),
  paths: [
    path('bloom', 'Cursed Bloom', 'Bigger bursts', [
      tier('Deeper Ink', 150, 'Curse bursts for 120% of the cursing hit.', { status: [S.curse(1.2, 1.1, 4)] }),
      tier('Wider Bloom', 340, 'Bursts reach 1.4 tiles.', { status: [S.curse(1.2, 1.4, 4)] }),
      tier('Cursed Bloom', 1100, 'Bursts for 200% of the hit within 1.6 tiles; cards splash 0.4 tiles.', { status: [S.curse(2.0, 1.6, 5)], splash: 0.4 }),
      tier('Red Spider Lily', 3400, 'Bursts reach 1.9 tiles; +14 damage.', { status: [S.curse(2.0, 1.9, 5)], damage: 14 }),
      tier('Garden of Calamity', 24000, 'Bursts for 220% within 2.3 tiles; +40 damage, +30% attack speed.', { status: [S.curse(2.2, 2.3, 6)], damage: 40, rateMul: 1.3 }),
    ]),
    path('withering', 'Withering Script', 'Anti-heal and armor', [
      tier('Fine Stylus', 130, '+1 damage.', { damage: 1 }),
      tier('Long Feed', 300, '+0.4 range.', { range: 0.4 }),
      tier('Withering Script', 1000, 'Cards poison 1.5 a second for 4s and stop regeneration.', { status: [S.poison(1.5, 4)] }),
      tier('Black Ink Hex', 3200, 'Shreds 2 armor for 4s; +14 damage.', { status: [S.shred(2, 4)], damage: 14 }),
      tier('Unwritten Name', 23000, 'Poison 6 a second for 5s, +45 damage, +40% against elites.', { status: [S.poison(6, 5)], damage: 45, eliteMul: 1.4 }),
    ]),
    path('fate', 'Shared Fate', 'Brittle and control', [
      tier('Quick Deal', 140, '+12% attack speed.', { rateMul: 1.12 }),
      tier('Lucky Card', 320, '5% crits for ×1.5.', { crit: { chance: 0.05, mul: 1.5 } }),
      tier('Shared Fate', 1050, 'Brittle +12% for 3s; silences for 0.5s.', { status: [S.vulnerable(0.12, 3)], silence: 0.5 }),
      tier('Red Threads', 3500, 'One more card; Brittle +18%; +12 damage.', { projectiles: 1, status: [S.vulnerable(0.18, 3)], damage: 12 }),
      tier('Threads of Destiny', 25000, 'Two more cards, Brittle +25%, 15% stun for 0.4s, +40 damage.', { projectiles: 2, status: [S.vulnerable(0.25, 3), S.stun(0.4, 0.15)], damage: 40 }),
    ]),
  ],
  awakenPassive: { name: 'Lingering Hex', desc: 'Curses burst for the whole hit within 1.2 tiles and last 5s.', mods: { status: [S.curse(1.0, 1.2, 5)] } },
};

/** The nine returning girls, in roster order (heroes first, then towers by rarity). */
export const EXPANSION_UNITS = [KANNA, YORIKO, SEIRAN, FUU, HANA, RURI, NOA, IROHA, ENA];
/** Their ids (the 19 originals are everything else). */
export const EXPANSION_IDS = EXPANSION_UNITS.map((u) => u.id);
