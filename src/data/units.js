// Sakura Sentinels — the full roster (owner: units). See CONTRACTS.md §3 and docs/ROSTER.md.
//
// 19 original characters: 3 adult heroes (Hikari, Luna, Nami) and 16 academy students who
// serve as towers. Everything here is plain data plus tiny lookup helpers (no side effects).
//
// Conventions used by every entry:
// * `base` always carries every numeric BaseStats key (silence/reveal/knockback default to 0)
//   so additive mods never land on `undefined`. Optional objects (aura, income, trap, turret,
//   ramp, mark) are present only when the unit starts with them; an upgrade that introduces one
//   always supplies its complete shape (e.g. aura.range, ramp.per+max, mark.bonus+duration).
// * Tier mods are INCREMENTAL: owning tier 3 of a path applies the mods of tiers 1, 2 and 3.
// * Tier descriptions describe that tier's own change, written for the upgrade panel.
// * Element side effects are explicit: a fire unit lists its burn in `status`, frost lists its
//   slow, and so on — the sim never has to guess.
// * Heroes have no upgrade paths: they deploy for free and level 1–25 inside each battle along one
//   track (src/data/heroTracks.js). Their `paths` is empty and `hero.levels` holds all 25 levels.

import { HERO_TRACKS } from './heroTracks.js';

// ---------------------------------------------------------------------------
// Builders (internal)
// ---------------------------------------------------------------------------

/** StatusSpec builders. `chance` is omitted when it is 1 (the contract default). */
const withChance = (spec, chance) => (chance != null && chance < 1 ? { ...spec, chance } : spec);
const S = {
  slow: (amount, duration, chance) => withChance({ type: 'slow', amount, duration }, chance),
  freeze: (duration, chance) => withChance({ type: 'freeze', duration }, chance),
  stun: (duration, chance) => withChance({ type: 'stun', duration }, chance),
  shock: (duration, chance) => withChance({ type: 'shock', duration }, chance),
  burn: (dps, duration, chance) => withChance({ type: 'burn', dps, duration }, chance),
  poison: (dps, duration, chance) => withChance({ type: 'poison', dps, duration }, chance),
  shred: (amount, duration, chance) => withChance({ type: 'shred', amount, duration }, chance),
  vulnerable: (bonus, duration, chance) => withChance({ type: 'vulnerable', bonus, duration }, chance),
  soak: (duration, chance) => withChance({ type: 'soak', duration }, chance),
  silence: (duration, chance) => withChance({ type: 'silence', duration }, chance),
  reveal: (duration, chance) => withChance({ type: 'reveal', duration }, chance),
};

/** Full BaseStats with contract defaults; `o` overrides. */
function stats(o) {
  return {
    cost: 0,
    behavior: 'projectile',
    damage: 0,
    rate: 1,
    range: 3,
    projectiles: 1,
    pierce: 1,
    splash: 0,
    chain: 0,
    maxTargets: 99,
    projectileSpeed: 14,
    armorPen: 0,
    canHitAir: true,
    detection: false,
    eliteMul: 1,
    bossMul: 1,
    barrierMul: 1,
    silence: 0,
    reveal: 0,
    knockback: 0,
    ...o,
    status: o.status ? o.status : [],
    crit: { chance: 0, mul: 1.5, ...(o.crit || {}) },
  };
}

const tier = (name, cost, desc, mods) => ({ name, cost, desc, mods });
const path = (id, name, focus, tiers) => ({ id, name, focus, tiers });
const free = (afterStage, note) => ({ type: 'free', afterStage, note });
const STARTER = { type: 'starter' };
const GACHA_ONLY = { type: 'gacha' };

// ---------------------------------------------------------------------------
// Heroes — adult guardians (one per player). Free to deploy; they level 1–25 during each battle:
// one more defender early on, the team's strongest unit by the last waves.
// ---------------------------------------------------------------------------

const HIKARI = {
  id: 'hikari',
  name: 'Hikari',
  title: 'Dawnblade Captain',
  kind: 'hero',
  rarity: 'SSR',
  adult: true,
  role: 'vanguard',
  attackType: 'holy',
  element: null,
  placement: 'land',
  materialFamily: 'charm',
  capabilities: ['detection'],
  pathCapabilities: ['armorPen', 'reveal', 'silence', 'buff', 'cleanse', 'antiAir', 'stun'],
  acquisition: STARTER,
  palette: {
    // pink hair + teal eyes: her battle model is the owner's own Meshy figure, so the procedural
    // fallback chibi (shown before the GLB arrives / offline) matches it
    hair: '#f7a3bf', hairShade: '#dc7398', eyes: '#2bb8ad', skin: '#ffe6d6',
    outfit: '#ffffff', outfitShade: '#d9dfee', accent: '#f2c14e', halo: '#fff1a8', weapon: '#e8ecf5',
  },
  look: {
    hairStyle: 'long', bangs: 'swept', accessory: 'crown', outfit: 'armor', weapon: 'sword',
    halo: 'crown', eyeStyle: 'sharp', expression: 'smile',
  },
  bio: 'Captain of the Sentinel Guard and the academy\'s senior guardian. Long sakura-pink hair crowned with a braided circlet of little gold stars, a white-and-gold knight\'s coat over navy, a big teal bow and a jewelled star-guard sword that shines like sunrise. She walks the front line so her students never have to stand there alone.',
  personality: 'Warm, unshakable and quietly teasing — the confident big-sister commander everyone wants to impress.',
  quote: 'Stay behind me, girls. The dawn is never late.',
  tips: [
    'She deploys for free and has Veil Sight from the start — your first answer to veiled enemies.',
    'Place her on the inside of a double bend: her short cleave hits far more enemies on corners.',
    'Save Celestial Bloom for a packed wave, or to stun a miniboss right before the exit.',
    'From Lv 9 her aura cleanses sabotage; at Lv 19 it becomes a holy banner.',
  ],
  base: stats({
    cost: 0, behavior: 'pulse', damage: 6, rate: 1.0, range: 2.1, maxTargets: 3,
    projectileSpeed: 0, canHitAir: false, detection: true, crit: { chance: 0.05, mul: 1.5 },
  }),
  paths: [],
  awakenPassive: {
    name: 'Unbroken Dawn',
    desc: '+8% damage, and her strikes reveal veiled enemies for 1.5s.',
    mods: { damageMul: 1.08, reveal: 1.5 },
  },
  hero: {
    levels: HERO_TRACKS.hikari.levels,
    pathKeys: HERO_TRACKS.hikari.pathKeys,
    ult: {
      name: 'Celestial Bloom',
      desc: 'A sun blooms around Hikari: 160 holy damage within 4.5 tiles, a 1.2s stun, and every veiled foe is revealed for 8s.',
      unlockLevel: 3,
      cooldown: 70,
      effect: { type: 'nova', damage: 160, radius: 4.5, attackType: 'holy', status: [S.stun(1.2)], reveal: 8 },
      ranks: HERO_TRACKS.hikari.ultRanks,
    },
  },
};

const LUNA = {
  id: 'luna',
  name: 'Luna',
  title: 'Moonfox Oracle',
  kind: 'hero',
  rarity: 'SSR',
  adult: true,
  role: 'mystic',
  attackType: 'mystic',
  element: null,
  placement: 'land',
  materialFamily: 'rune',
  capabilities: ['antiAir'],
  pathCapabilities: ['armorPen', 'slow', 'stun', 'buff', 'detection'],
  acquisition: GACHA_ONLY,
  palette: {
    hair: '#c3b4e9', hairShade: '#9483c7', eyes: '#a69aff', skin: '#f8e4e0',
    outfit: '#343c72', outfitShade: '#23284f', accent: '#b9a6ff', halo: '#e6dcff', weapon: '#e8c56a',
  },
  look: {
    hairStyle: 'hime', bangs: 'hime', accessory: 'foxEars', outfit: 'dress', weapon: 'staff',
    halo: 'moon', eyeStyle: 'sleepy', expression: 'smile',
  },
  bio: 'The academy\'s fox-eared oracle of the night courses and a gentle, mysterious guardian. Long lavender hair, tall fox ears and a huge fluffy tail, a midnight-navy gown with a lavender skirt and violet bow, and a staff crowned with a golden crescent around a glowing moon-orb. Three threads of moonlight answer every flick of her tail.',
  personality: 'Soft-spoken, playful and a little mischievous; reads fortunes in teacups and is never wrong about the weather.',
  quote: 'Foxfire, rise. The night is on our side.',
  tips: [
    'Line her beams down a long straight: every beam pierces several enemies.',
    'Mystic is strong against armor and scales but halved by warded fae and oni.',
    'Moonfall slows the whole map AND speeds up every girl — fire it at the peak of a wave.',
  ],
  base: stats({
    cost: 0, behavior: 'beam', damage: 4, rate: 0.8, range: 3.6, projectiles: 3, pierce: 3,
    projectileSpeed: 0, canHitAir: true,
  }),
  paths: [],
  awakenPassive: {
    name: 'Moon\'s Favour',
    desc: 'Beams pierce 1 more enemy and reach 0.3 tiles further.',
    mods: { pierce: 1, range: 0.3 },
  },
  hero: {
    levels: HERO_TRACKS.luna.levels,
    pathKeys: HERO_TRACKS.luna.pathKeys,
    ult: {
      name: 'Moonfall',
      desc: 'The moon descends: every enemy is slowed by 50% for 5s and every girl attacks 30% faster for 8s.',
      unlockLevel: 3,
      cooldown: 80,
      effect: { type: 'timeWarp', slow: 0.5, duration: 5, rateBuff: 1.3, buffDuration: 8 },
      ranks: HERO_TRACKS.luna.ultRanks,
    },
  },
};

const NAMI = {
  id: 'nami',
  name: 'Nami',
  title: 'Tide Admiral',
  kind: 'hero',
  rarity: 'SR',
  adult: true,
  role: 'tideguard',
  attackType: 'mystic',
  element: 'frost',
  placement: 'amphibious',
  materialFamily: 'rime',
  capabilities: ['water', 'slow', 'antiAir'],
  pathCapabilities: ['armorPen', 'stun', 'buff'],
  acquisition: free('1-5', 'Joins after defeating the Slime Prince in 1-5 — the Moonlit Lakeshore is all water.'),
  palette: {
    hair: '#3d9fb0', hairShade: '#23707f', eyes: '#53d8db', skin: '#f2d2bd',
    outfit: '#24345e', outfitShade: '#152242', accent: '#f4f6fa', halo: '#9be7ff', weapon: '#d4af37',
  },
  look: {
    hairStyle: 'wavy', bangs: 'split', accessory: 'cap', outfit: 'coat', weapon: 'trident',
    halo: 'wave', eyeStyle: 'sharp', expression: 'cheerful',
  },
  bio: 'A retired admiral who now commands the academy harbour and Hikari\'s oldest friend. Long teal waves under a white captain\'s cap with a gold shell badge, a navy-and-gold admiral\'s coat over a crisp sailor blouse, and a gilded trident. When she raises it, the lake turns to ice around the enemy\'s feet.',
  personality: 'Composed, dry-witted and fiercely protective of her crew; nobody gets left on the dock, and her orders are short and always right.',
  quote: 'All hands! Raise the tide!',
  tips: [
    'Amphibious: she deploys on land or water — a lake beside the path keeps the good land spots free.',
    'Tidal Wave pushes the whole wave back 5 tiles: a lifesaver right before a leak.',
    'From Lv 9 her hits push enemies back into your kill zone; at Lv 24 her aura makes upgrades 10% cheaper for girls nearby (not hero levels).',
  ],
  base: stats({
    cost: 0, behavior: 'projectile', damage: 5, rate: 1.0, range: 3.2, splash: 0.5,
    projectileSpeed: 12, canHitAir: true, status: [S.slow(0.2, 1.2)],
  }),
  paths: [],
  awakenPassive: {
    name: 'Rising Tide',
    desc: 'Slow strengthened to 30% and +5% damage.',
    mods: { status: [S.slow(0.3, 1.6)], damageMul: 1.05 },
  },
  hero: {
    levels: HERO_TRACKS.nami.levels,
    pathKeys: HERO_TRACKS.nami.pathKeys,
    ult: {
      name: 'Tidal Wave',
      desc: 'A wave crashes down every path: 70 damage, enemies are pushed back 5 tiles (bosses resist) and slowed by 40% for 3s.',
      unlockLevel: 3,
      cooldown: 60,
      effect: { type: 'tide', damage: 70, pushback: 5, slow: 0.4, duration: 3 },
      ranks: HERO_TRACKS.nami.ultRanks,
    },
  },
};

// ---------------------------------------------------------------------------
// Towers — academy students (wholesome designs).
// ---------------------------------------------------------------------------

const AOI = {
  id: 'aoi',
  name: 'Aoi',
  title: 'Wind Ranger',
  kind: 'tower',
  rarity: 'R',
  adult: false,
  role: 'marksman',
  attackType: 'pierce',
  element: null,
  placement: 'land',
  materialFamily: 'feather',
  capabilities: ['antiAir', 'multiHit'],
  pathCapabilities: ['armorPen', 'detection', 'priority', 'stun'],
  acquisition: STARTER,
  palette: {
    hair: '#529d67', hairShade: '#367a4c', eyes: '#88df94', skin: '#ffe5d6',
    outfit: '#568c55', outfitShade: '#3d6a3d', accent: '#88df94', halo: '#c4f5b0', weapon: '#a8794a',
  },
  look: {
    hairStyle: 'ponytail', bangs: 'swept', accessory: 'hairpin', outfit: 'coat', weapon: 'bow',
    halo: 'leaf', eyeStyle: 'round', expression: 'cheerful',
  },
  bio: 'A first-year from the archery club and the academy\'s most dependable shot. A long green ponytail with a leaf clip, a green ranger tunic under a hooded cape, leather bracers and a wooden longbow she polishes every evening after practising until sunset.',
  personality: 'Earnest, upbeat and a little competitive; keeps a notebook of every target she has ever missed (it is very short).',
  quote: 'Breathe in, draw, release — next!',
  tips: [
    'Cheap and dependable — a great first placement on any map.',
    'Many small hits crack crystal shells quickly, and she can shoot flyers.',
    'Rapid Volley tier 3 gives her Veil Sight; Piercing Arrows tier 3 lets her ignore armor.',
  ],
  base: stats({
    cost: 200, behavior: 'projectile', damage: 4, rate: 1.4, range: 3.2, projectileSpeed: 16,
    canHitAir: true, crit: { chance: 0.05, mul: 1.5 },
  }),
  paths: [
    path('piercing', 'Piercing Arrows', 'Pierce and armor', [
      tier('Sharpened Tips', 100, '+1 damage; arrows pierce 1 more enemy.', { damage: 1, pierce: 1 }),
      tier('Fletcher\'s Focus', 220, '+1 pierce, +0.3 range.', { pierce: 1, range: 0.3 }),
      tier('Steel Broadheads', 650, 'Ignores 2 armor, +2 damage.', { armorPen: 2, damage: 2 }),
      tier('Comet Arrow', 2200, '+6 damage, +4 pierce, faster arrows, +30% against elites, ignores 2 more armor; +25% damage.', { damage: 6, pierce: 4, projectileSpeed: 10, eliteMul: 1.3, armorPen: 2, damageMul: 1.25 }),
      tier('Skyline Breaker', 17000, 'Arrows punch through whole columns: +18 damage, +10 pierce, ignores 8 more armor, +1 range, 10% crits ×2.5; +50% damage.', { damage: 18, pierce: 10, armorPen: 8, range: 1, crit: { chance: 0.1, mul: 2.5 }, damageMul: 1.5 }),
    ]),
    path('volley', 'Rapid Volley', 'Speed and multi-shot', [
      tier('Quick Draw', 90, '+20% attack speed.', { rateMul: 1.2 }),
      tier('Twin Nock', 250, 'Shoots 2 targets at once.', { projectiles: 1 }),
      tier('Hawk Eye', 600, 'Veil Sight; +0.4 range and +15% attack speed.', { detection: true, range: 0.4, rateMul: 1.15 }),
      tier('Arrow Storm', 2400, '4 targets per volley, +50% attack speed, ignores 3 armor; +20% damage.', { projectiles: 2, rateMul: 1.5, armorPen: 3, damageMul: 1.2 }),
      tier('Thousand Feathers', 19000, '6 targets per volley, double attack speed, +3 damage, ignores 4 more armor; +55% damage.', { projectiles: 2, rateMul: 2, damage: 3, armorPen: 4, damageMul: 1.55 }),
    ]),
    path('hunter', 'Sky Hunter', 'Elites, bosses and marking', [
      tier('Long Bow', 80, '+0.5 range.', { range: 0.5 }),
      tier('Wind Reading', 200, '+0.3 range, +5% crit chance.', { range: 0.3, crit: { chance: 0.05, mul: 1.5 } }),
      tier('Falcon Mark', 700, 'Marked targets take +12% damage from everyone for 3s; +25% against elites.', { mark: { bonus: 0.12, duration: 3 }, eliteMul: 1.25 }),
      tier('Pinning Gale', 2000, '+5 damage and +50% damage; 15% chance to pin (0.3s stun) with a slight push-back.', { damage: 5, status: [S.stun(0.3, 0.15)], knockback: 0.15, damageMul: 1.5 }),
      tier('Apex Huntress', 19000, '+22 damage, +30% attack speed, ×1.5 vs elites and bosses (×1.8 more vs bosses), 15% crits ×3; +7% damage.', { damage: 22, rateMul: 1.3, eliteMul: 1.5, bossMul: 1.8, crit: { chance: 0.15, mul: 3 }, damageMul: 1.07 }),
    ]),
  ],
  awakenPassive: {
    name: 'Clear Skies',
    desc: '+10% damage and +0.3 range.',
    mods: { damageMul: 1.1, range: 0.3 },
  },
};

const REI = {
  id: 'rei',
  name: 'Rei',
  title: 'Sakura Samurai',
  kind: 'tower',
  rarity: 'R',
  adult: false,
  role: 'cleaver',
  attackType: 'slash',
  element: null,
  placement: 'land',
  materialFamily: 'blade',
  capabilities: ['multiHit'],
  pathCapabilities: ['armorPen', 'stun', 'silence', 'armorShred'],
  acquisition: STARTER,
  palette: {
    hair: '#303851', hairShade: '#1b2033', eyes: '#b39eff', skin: '#ffe2d2',
    outfit: '#4c568a', outfitShade: '#333b63', accent: '#9d86d8', halo: '#ffc2d6', weapon: '#dfe6f0',
  },
  look: {
    hairStyle: 'bob', bangs: 'straight', accessory: 'ribbon', outfit: 'blazer', weapon: 'katana',
    halo: 'petal', eyeStyle: 'sharp', expression: 'calm',
  },
  bio: 'The tea-and-garden club\'s calm, quiet swordswoman, who practises her draw every dawn under the cherry trees. A neat navy-black bob with a small dark bow and a gold star pin, an indigo uniform jacket with a lilac ribbon, a pleated skirt and a katana with a pink silk bow on the hilt. She draws once — and everything in reach falls like petals.',
  personality: 'Calm, polite and unshakeable; tends the club\'s roses between waves and drinks her tea far too hot.',
  quote: 'One breath. One cut. Next.',
  tips: [
    'Put her on the inside of a corner so the path wraps around her.',
    'Slash shreds light armor but bounces off plate — pair her with an armor breaker.',
    'Melee: she cannot hit flyers.',
    'Duelist Stance (tier 4) turns her into a single-target boss fighter.',
  ],
  base: stats({
    cost: 240, behavior: 'pulse', damage: 4, rate: 0.9, range: 1.8, maxTargets: 3,
    projectileSpeed: 0, canHitAir: false,
  }),
  paths: [
    path('whirlwind', 'Whirlwind', 'Wider cleave', [
      tier('Long Reach', 100, '+0.2 range; each sweep hits 1 more enemy.', { range: 0.2, maxTargets: 1 }),
      tier('Spinning Draw', 260, '+20% attack speed; +1 target.', { rateMul: 1.2, maxTargets: 1 }),
      tier('Crescent Gale', 800, 'Sweeps hit up to 9 enemies; +2 damage, +0.3 range.', { maxTargets: 4, damage: 2, range: 0.3 }),
      tier('Tempest Dance', 2500, '+50% attack speed, +4 damage, 4 more targets, +25% vs elites; +30% damage.', { rateMul: 1.5, damage: 4, maxTargets: 4, eliteMul: 1.25, damageMul: 1.3 }),
      tier('Thousand Petal Storm', 22500, 'A blade hurricane: hits everything in reach (20 more targets), +14 damage, +60% speed, +0.6 range, 10% crits ×2, ×2.5 vs bosses; +25% damage.', { maxTargets: 20, damage: 14, rateMul: 1.6, range: 0.6, crit: { chance: 0.1, mul: 2 }, bossMul: 2.5, damageMul: 1.25 }),
    ]),
    path('duelist', 'Duelist Stance', 'Single-target focus', [
      tier('Sharpened Edge', 110, '+2 damage.', { damage: 2 }),
      tier('Iai Draw', 280, '10% crits for ×2 damage.', { crit: { chance: 0.1, mul: 2 } }),
      tier('Focused Strikes', 850, '+4 damage, ignores 2 armor, +20% against elites.', { damage: 4, armorPen: 2, eliteMul: 1.2 }),
      tier('Duelist Stance', 2600, 'Switches to a one-on-one stance: single target, +10% damage per consecutive hit (max +80%); +8 damage, +20% attack speed, +30% damage.', { behavior: 'duel', ramp: { per: 0.1, max: 0.8 }, damage: 8, rateMul: 1.2, damageMul: 1.3 }),
      tier('Final Crescent', 19000, '+20 damage; ramp +5% more per hit and +120% higher (up to +200%); ×1.4 vs bosses, 15% crits ×3; +25% damage.', { damage: 20, ramp: { per: 0.05, max: 1.2 }, bossMul: 1.4, crit: { chance: 0.15, mul: 3 }, damageMul: 1.25 }),
    ]),
    path('counter', 'Counter Form', 'Interrupting counter-slashes', [
      tier('Ready Guard', 90, '+10% attack speed.', { rateMul: 1.1 }),
      tier('Parry Rhythm', 240, '+1 damage, +0.2 range.', { damage: 1, range: 0.2 }),
      tier('Riposte', 750, 'Counter-slashes silence for 0.5s (stops blinks and siphons); 25% chance to stun.', { silence: 0.5, status: [S.stun(0.35, 0.25)] }),
      tier('Breaking Rhythm', 2300, 'Slashes crack armor (-3 for 3.5s, stacks ×3) and knock back slightly (0.2); +3 damage, +15% damage.', { status: [S.shred(3, 3.5)], knockback: 0.2, damage: 3, damageMul: 1.15 }),
      tier('Kenshi\'s Answer', 13000, '+10 damage, 6 more targets, 40% stun for 0.7s, struck foes turn Brittle (+20% for 3s), silence +1.2s; +90% damage.', { damage: 10, maxTargets: 6, status: [S.stun(0.7, 0.4), S.vulnerable(0.2, 3)], silence: 1.2, damageMul: 1.9 }),
    ]),
  ],
  awakenPassive: {
    name: 'Iron Focus',
    desc: 'Sweeps hit 1 more enemy and deal +8% damage.',
    mods: { maxTargets: 1, damageMul: 1.08 },
  },
};

const YUKI = {
  id: 'yuki',
  name: 'Yuki',
  title: 'Frost Mage',
  kind: 'tower',
  rarity: 'R',
  adult: false,
  role: 'controller',
  attackType: 'mystic',
  element: 'frost',
  placement: 'land',
  materialFamily: 'rime',
  capabilities: ['slow', 'antiAir'],
  pathCapabilities: ['stun', 'armorShred', 'silence', 'armorPen'],
  acquisition: free('1-2', 'Joins after 1-2, right before hasty goblins sprint in.'),
  palette: {
    hair: '#e4eff8', hairShade: '#b2c6dc', eyes: '#77d9ef', skin: '#fff0ea',
    outfit: '#cfe6fa', outfitShade: '#8fb8e0', accent: '#bfe8ff', halo: '#d6f3ff', weapon: '#9fd8ff',
  },
  look: {
    hairStyle: 'bob', bangs: 'straight', accessory: 'hairpin', outfit: 'dress', weapon: 'staff',
    halo: 'snow', eyeStyle: 'round', expression: 'shy',
  },
  bio: 'A shy second-year from the library committee who studies frost magic between the shelves. A silver-white bob with a snowflake hairpin, a white fur-trimmed capelet over a pale-blue dress and a staff topped with an ice crystal. Wherever she walks the air turns crisp and enemies slow to a crawl.',
  personality: 'Soft-spoken and shy, hates being rushed, and has never once been late.',
  quote: '...Slow down. Please.',
  tips: [
    'Slowed enemies stay in everyone\'s range longer — place her early along the path.',
    'Frostbite makes enemies Brittle so every girl deals more damage to them.',
    'Bosses shrug off most freeze time: lean on slows, not freezes, against them.',
  ],
  base: stats({
    cost: 220, behavior: 'projectile', damage: 2, rate: 1.0, range: 3.0, splash: 0.6,
    projectileSpeed: 10, canHitAir: true, status: [S.slow(0.3, 1.5)],
  }),
  paths: [
    path('deepfreeze', 'Deep Freeze', 'Stronger slowdown', [
      tier('Chill', 90, 'Slow strengthened to 35%.', { status: [S.slow(0.35, 1.6)] }),
      tier('Snowfall', 240, '+0.3 splash.', { splash: 0.3 }),
      tier('Flash Freeze', 700, '20% chance to freeze for 0.6s; slow 45%.', { status: [S.freeze(0.6, 0.2), S.slow(0.45, 1.8)] }),
      tier('Glacial Prison', 2200, '33% chance to freeze for 1.1s, +0.4 splash, +20% attack speed, +15% damage.', { status: [S.freeze(1.1, 0.33)], splash: 0.4, rateMul: 1.2, damageMul: 1.15 }),
      tier('Eternal Winter', 13500, 'Becomes a blizzard: pulses hit every enemy in range (+0.6 range, +6 damage) with 62% slows for 2.8s and 38% freezes for 1.7s; struck foes turn Brittle (+20%); +80% damage.', { behavior: 'pulse', range: 0.6, damage: 6, status: [S.slow(0.62, 2.8), S.freeze(1.7, 0.38), S.vulnerable(0.2, 2.5)], damageMul: 1.8 }),
    ]),
    path('frostbite', 'Frostbite', 'Frost vulnerability', [
      tier('Sharp Ice', 100, '+1 damage.', { damage: 1 }),
      tier('Icicle Lance', 260, '+1 damage; icicles pierce 1 more enemy.', { damage: 1, pierce: 1 }),
      tier('Brittle Frost', 800, 'Struck foes turn Brittle: +15% damage from everyone for 2.5s.', { status: [S.vulnerable(0.15, 2.5)] }),
      tier('Shatter Point', 2600, 'Brittle +30%; frost cracks armor (-2, stacks ×3); +5 damage, +25% damage.', { status: [S.vulnerable(0.3, 3), S.shred(2, 3)], damage: 5, damageMul: 1.25 }),
      tier('Diamond Dust', 18000, '+15 damage, Brittle +45%, 20% crits ×2.5, +30% attack speed, ignores 3 armor; +50% damage.', { damage: 15, status: [S.vulnerable(0.45, 3.5)], crit: { chance: 0.2, mul: 2.5 }, rateMul: 1.3, armorPen: 3, damageMul: 1.5 }),
    ]),
    path('permafrost', 'Permafrost', 'Lingering control', [
      tier('Frost Trail', 80, '+0.3 range.', { range: 0.3 }),
      tier('Lingering Cold', 220, 'Slows last 2.5s.', { status: [S.slow(0.3, 2.5)] }),
      tier('Hoarfrost Field', 650, 'Wide frost patches (+0.5 splash), 3s slows, and chills silence blinks and siphons for 0.6s.', { splash: 0.5, status: [S.slow(0.35, 3)], silence: 0.6 }),
      tier('Avalanche Herald', 2400, 'Push-back 0.3 tiles, 18% chance to freeze for 0.7s, +25% attack speed, +15% damage.', { knockback: 0.3, status: [S.freeze(0.7, 0.18)], rateMul: 1.25, damageMul: 1.15 }),
      tier('Frozen Time', 13000, '58% slows for 4.5s, 28% freezes for 1.4s, frost cracks armor (-2, stacks ×3), enormous splash (+0.8), ×1.5 vs bosses, +5 damage; +80% damage.', { status: [S.slow(0.58, 4.5), S.freeze(1.4, 0.28), S.shred(2, 4)], splash: 0.8, bossMul: 1.5, damage: 5, damageMul: 1.8 }),
    ]),
  ],
  awakenPassive: {
    name: 'First Snow',
    desc: 'Slow strengthened to 35% and +0.2 range.',
    mods: { status: [S.slow(0.35, 1.6)], range: 0.2 },
  },
};

const MOMO = {
  id: 'momo',
  name: 'Momo',
  title: 'Starlight Idol',
  kind: 'tower',
  rarity: 'R',
  adult: false,
  role: 'economy',
  attackType: 'pierce',
  element: null,
  placement: 'land',
  materialFamily: 'cog',
  capabilities: ['income', 'antiAir'],
  pathCapabilities: ['buff', 'armorPen'],
  acquisition: GACHA_ONLY,
  palette: {
    hair: '#e985ba', hairShade: '#c55e93', eyes: '#9663ca', skin: '#ffe7da',
    outfit: '#c04a92', outfitShade: '#8f3570', accent: '#d23c8f', halo: '#ffc0e5', weapon: '#c7ccd8',
  },
  look: {
    hairStyle: 'twintails', bangs: 'straight', accessory: 'ribbon', outfit: 'dress', weapon: 'mic',
    halo: 'star', eyeStyle: 'sparkle', expression: 'cheerful',
  },
  bio: 'The academy\'s rising idol and the pride of the idol club. Pink twin-tails tied with magenta bows, a frilly magenta-and-white idol dress, white gloves and a sparkly hand microphone. Every concert she gives between waves fills the battle treasury.',
  personality: 'Bubbly, tireless and always on stage; winks at everyone and remembers every fan\'s name.',
  quote: 'Thank you, everyone! Encore~!',
  tips: [
    'Place her early: her income pays out at the end of every wave.',
    'Merch Table tier 3 makes upgrades cheaper for the girls around her (not hero levels).',
    'Her glow-stick toss is weak — never rely on her to hold a lane alone.',
    'Nightmare difficulty switches off all wave income, hers included.',
  ],
  base: stats({
    cost: 300, behavior: 'projectile', damage: 2, rate: 0.8, range: 2.8, projectileSpeed: 12,
    canHitAir: true, income: { perWave: 30, interest: 0 },
  }),
  paths: [
    path('orchard', 'Fan Club', 'Wave income', [
      tier('Fresh Stock', 150, '+20 coins per wave.', { income: { perWave: 20 } }),
      tier('Market Stall', 350, '+40 coins per wave.', { income: { perWave: 40 } }),
      tier('Peach Emporium', 1100, '+100 coins per wave.', { income: { perWave: 100 } }),
      tier('Sakura Trading Co.', 3500, '+350 coins per wave.', { income: { perWave: 350 } }),
      tier('Golden Peach Bank', 19000, '+1,500 coins per wave and 5% interest on your coins (max 150).', { income: { perWave: 1500, interest: 0.05 } }),
    ]),
    path('ledger', 'Merch Table', 'Interest and discounts', [
      tier('Piggy Bank', 120, 'Earn 2% interest on your coins each wave (max 150).', { income: { interest: 0.02 } }),
      tier('Compound Ledger', 300, '+2% interest and +10 coins per wave.', { income: { perWave: 10, interest: 0.02 } }),
      tier('Coupon Book', 900, 'Girls within 2.5 tiles pay 8% less for upgrades.', { aura: { range: 2.5, costCut: 0.08 } }),
      tier('Wholesale Deals', 2800, 'Discount rises to 15% within 3.2 tiles; +40 coins per wave and +3% interest.', { aura: { range: 3.2, costCut: 0.07 }, income: { perWave: 40, interest: 0.03 } }),
      tier('Golden Ledger', 14500, 'Discount rises to 25%; +400 coins per wave and +5% interest.', { aura: { costCut: 0.1 }, income: { perWave: 400, interest: 0.05 } }),
    ]),
    path('cointoss', 'Encore Toss', 'Lucky attacks', [
      tier('Heavy Coins', 100, '+2 damage.', { damage: 2 }),
      tier('Double Toss', 260, 'Throws at 2 targets; +20% attack speed.', { projectiles: 1, rateMul: 1.2 }),
      tier('Gold Rush', 800, 'Solid gold coins ignore 2 armor, +3 damage, pierce 2 more.', { armorPen: 2, damage: 3, pierce: 2 }),
      tier('Jackpot', 2400, '20% crits for ×3, +6 damage, ignores 2 armor, +40 coins per wave; +25% damage.', { crit: { chance: 0.2, mul: 3 }, damage: 6, income: { perWave: 40 }, armorPen: 2, damageMul: 1.25 }),
      tier('Fortune\'s Favourite', 17000, 'A coin storm: +60% speed, 4 targets, +10 damage, +150 coins per wave; +55% damage.', { rateMul: 1.6, projectiles: 2, damage: 10, income: { perWave: 150 }, damageMul: 1.55 }),
    ]),
  ],
  awakenPassive: {
    name: 'Lucky Peach',
    desc: '+25 coins per wave.',
    mods: { income: { perWave: 25 } },
  },
};

const AKANE = {
  id: 'akane',
  name: 'Akane',
  title: 'Flame Witch',
  kind: 'tower',
  rarity: 'SR',
  adult: false,
  role: 'bombardment',
  attackType: 'blast',
  element: 'fire',
  placement: 'land',
  materialFamily: 'ember',
  capabilities: [],
  pathCapabilities: ['antiAir', 'stun', 'armorPen', 'armorShred', 'barrierBreak'],
  acquisition: GACHA_ONLY,
  palette: {
    hair: '#dc634b', hairShade: '#a8402f', eyes: '#ffbb60', skin: '#ffe3d1',
    outfit: '#6a2a4c', outfitShade: '#4a1d36', accent: '#d8473f', halo: '#ff9f1c', weapon: '#7a3b2a',
  },
  look: {
    hairStyle: 'long', bangs: 'swept', accessory: 'witchHat', outfit: 'dress', weapon: 'staff',
    halo: 'flame', eyeStyle: 'sharp', expression: 'smug',
  },
  bio: 'The pyrotechnics club\'s self-declared flame witch. Long orange-red hair under a huge plum witch\'s hat with a gold star, a red-and-plum dress with a gold bow, and a staff ringed in gold around a burning red crystal. Her fireballs burst like festival fireworks — and she signs every one with a heart.',
  personality: 'Loud, proud and impossible to discourage; signs every explosion with a heart.',
  quote: 'Ooh, they\'re all bunched up. Showtime!',
  tips: [
    'Best against tightly packed swarms, splitters and broods.',
    'Burns ignore flat armor, but fire-warded foes resist them.',
    'Fireballs cannot hit flyers until Phoenix Feather (Wildfire tier 4) or a tier 5.',
  ],
  base: stats({
    cost: 480, behavior: 'projectile', damage: 6, rate: 0.7, range: 3.1, splash: 1.0,
    projectileSpeed: 9, canHitAir: false, status: [S.burn(2, 2)],
  }),
  paths: [
    path('bigbang', 'Big Bang', 'Bigger explosions', [
      tier('Extra Powder', 140, '+0.3 explosion radius.', { splash: 0.3 }),
      tier('Heavier Shells', 320, '+2 damage.', { damage: 2 }),
      tier('Cluster Bloom', 1000, 'Throws two fireballs at different targets; +0.3 radius.', { projectiles: 1, splash: 0.3 }),
      tier('Grand Finale', 3200, '+10 damage and huge blasts (+0.5) that may stun (20%, 0.3s); +25% vs elites, +30% damage.', { damage: 10, splash: 0.5, status: [S.stun(0.3, 0.2)], eliteMul: 1.25, damageMul: 1.3 }),
      tier('Hanabi Sky Festival', 30000, 'A five-shell firework barrage (+20 damage, +0.6 splash, +30% speed) that also bursts in the sky to hit flyers; ×2.5 vs bosses, +25% damage.', { projectiles: 3, damage: 20, splash: 0.6, rateMul: 1.3, canHitAir: true, bossMul: 2.5, damageMul: 1.25 }),
    ]),
    path('wildfire', 'Wildfire', 'Lingering burns', [
      tier('Hot Coals', 120, 'Burns deal 3/s for 2.5s.', { status: [S.burn(3, 2.5)] }),
      tier('Kindling', 280, '+15% attack speed.', { rateMul: 1.15 }),
      tier('Napalm Bloom', 900, 'Burns deal 6/s for 3.5s; +0.2 range.', { status: [S.burn(6, 3.5)], range: 0.2 }),
      tier('Phoenix Feather', 2800, 'Fireballs arc high enough to hit flyers; burns 12/s plus 0.15% of max HP/s for 4s; +4 damage, +20% damage.', { canHitAir: true, status: [{ type: 'burn', dps: 12, pct: 0.0015, duration: 4 }], damage: 4, damageMul: 1.2 }),
      tier('Inferno Queen', 16000, 'Burns 40/s plus 0.3% of max HP/s for 5s (bosses 0.03%), wider blasts (+0.5), +40% attack speed, +6 damage; +50% damage.', { status: [{ type: 'burn', dps: 40, pct: 0.003, duration: 5 }], splash: 0.5, rateMul: 1.4, damage: 6, damageMul: 1.5 }),
    ]),
    path('rocketry', 'Rocket Science', 'Range, speed and armor', [
      tier('Long Fuse', 100, '+0.4 range.', { range: 0.4 }),
      tier('Quick Loader', 260, '+20% attack speed.', { rateMul: 1.2 }),
      tier('Shaped Charge', 850, 'Ignores 3 armor and cracks it (-1, stacks ×3).', { armorPen: 3, status: [S.shred(1, 3)] }),
      tier('Rocket Barrage', 2600, 'Rockets fire in pairs at two targets; +35% attack speed, faster rockets, +0.6 range, ignores 2 more armor; +25% damage.', { projectiles: 1, rateMul: 1.35, projectileSpeed: 8, range: 0.6, armorPen: 2, damageMul: 1.25 }),
      tier('Skybreaker Missile', 19000, 'Guided missiles: +40 damage, +0.4 splash, hit flyers, ×1.8 vs bosses, ×1.5 vs barriers; +40% damage.', { damage: 40, canHitAir: true, bossMul: 1.8, barrierMul: 1.5, splash: 0.4, damageMul: 1.4 }),
    ]),
  ],
  awakenPassive: {
    name: 'Ember Heart',
    desc: 'Burns deal 4/s for 2.5s; +0.2 explosion radius.',
    mods: { status: [S.burn(4, 2.5)], splash: 0.2 },
  },
};

const SANGO = {
  id: 'sango',
  name: 'Sango',
  title: 'Coral Corsair',
  kind: 'tower',
  rarity: 'SR',
  adult: false,
  role: 'artillery',
  attackType: 'blast',
  element: 'water',
  placement: 'amphibious',
  materialFamily: 'ember',
  capabilities: ['water', 'barrierBreak'],
  pathCapabilities: ['armorPen', 'armorShred', 'antiAir', 'stun'],
  acquisition: free('1-5', 'Joins after 1-5 to teach water placement on the Lakeshore; later her shells crack armor and barriers.'),
  palette: {
    hair: '#e98288', hairShade: '#c45f68', eyes: '#67caca', skin: '#ffe4d6',
    outfit: '#eff7ff', outfitShade: '#c8d6e6', accent: '#1d4e89', halo: '#7fd6ff', weapon: '#b8873a',
  },
  look: {
    hairStyle: 'side', bangs: 'swept', accessory: 'beret', outfit: 'sailor', weapon: 'cannon',
    halo: 'wave', eyeStyle: 'round', expression: 'determined',
  },
  bio: 'The harbour cadets\' cannoneer. Coral-pink hair in a side braid under a navy beret with a shell badge, a white-and-pink sailor coat with navy trim, and a brass telescope-cannon she maintains like a family heirloom. Her shells crack plate and pop barriers.',
  personality: 'Serious, by-the-book and secretly delighted by loud noises.',
  quote: 'Shell loaded! Armor\'s about to have a very bad day.',
  tips: [
    'Amphibious: she deploys on land or water, and her shells reach far.',
    'Blast deals +50% to barriers, and Sango adds even more on top.',
    'Armor-Breaker Shells lower armor for every girl that hits the target afterwards.',
    'Air-Burst Flak (Wide Fragmentation tier 4) lets her shoot down flyers.',
  ],
  base: stats({
    cost: 560, behavior: 'projectile', damage: 14, rate: 0.45, range: 4.2, splash: 0.8,
    projectileSpeed: 8, canHitAir: false, barrierMul: 1.25, status: [S.soak(2)],
  }),
  paths: [
    path('breaker', 'Armor-Breaker Shells', 'Shred armor and barriers', [
      tier('Hardened Tips', 150, 'Ignores 1 armor.', { armorPen: 1 }),
      tier('Crack Shot', 340, 'Shells crack armor: -1 for 3s (stacks ×3).', { status: [S.shred(1, 3)] }),
      tier('Plate Splitter', 1100, 'Shred -2 for 4s, ignores 2 more armor, +4 damage.', { status: [S.shred(2, 4)], armorPen: 2, damage: 4 }),
      tier('Siege Breaker', 3500, 'Shred -4 for 5s (stacks ×3), ×1.5 vs barriers, +10 damage; +25% damage.', { status: [S.shred(4, 5)], barrierMul: 1.5, damage: 10, damageMul: 1.25 }),
      tier('Fortress Fall', 25000, 'Shred -6 (×3: -18 armor) and Brittle +20% for the whole team; +50 damage, +30% speed, ×1.5 vs barriers; +50% damage.', { status: [S.shred(6, 6), S.vulnerable(0.2, 4)], damage: 50, rateMul: 1.3, barrierMul: 1.5, damageMul: 1.5 }),
    ]),
    path('frag', 'Wide Fragmentation', 'Splash and flak', [
      tier('Packed Shrapnel', 140, '+0.3 splash.', { splash: 0.3 }),
      tier('Spread Charge', 300, '+3 damage.', { damage: 3 }),
      tier('Fragmentation Rounds', 1000, '+0.6 splash, +3 damage; 15% chance to stun for 0.25s.', { splash: 0.6, damage: 3, status: [S.stun(0.25, 0.15)] }),
      tier('Air-Burst Flak', 3000, 'Shells burst mid-air to hit flyers; +40% attack speed, +0.4 splash, +25% vs elites; +30% damage.', { canHitAir: true, rateMul: 1.4, splash: 0.4, eliteMul: 1.25, damageMul: 1.3 }),
      tier('Carpet Bombardment', 27500, 'Four shells per salvo at different targets, +18 damage, +0.8 splash, +20% speed; ×2.5 vs bosses, +25% damage.', { projectiles: 3, damage: 18, splash: 0.8, rateMul: 1.2, bossMul: 2.5, damageMul: 1.25 }),
    ]),
    path('siege', 'Concentrated Siege', 'Huge single shells', [
      tier('Range Finder', 120, '+0.6 range.', { range: 0.6 }),
      tier('Bigger Bore', 320, '+6 damage.', { damage: 6 }),
      tier('Siege Mortar', 1200, '+16 damage, +1 range, +25% against elites.', { damage: 16, range: 1, eliteMul: 1.25 }),
      tier('Dreadnought Shell', 3800, '+40 damage, ×1.3 vs bosses, 25% chance to stun for 0.6s; +40% damage.', { damage: 40, bossMul: 1.3, status: [S.stun(0.6, 0.25)], damageMul: 1.4 }),
      tier('Leviathan Cannon', 35000, '+120 damage, ×1.3 vs elites and ×1.8 vs bosses, +2 range, +0.5 splash; every shell knocks enemies back (0.5); +15% damage.', { damage: 120, bossMul: 1.8, eliteMul: 1.3, range: 2, splash: 0.5, knockback: 0.5, damageMul: 1.15 }),
    ]),
  ],
  awakenPassive: {
    name: 'Coral Bastion',
    desc: 'Ignores 2 armor and deals +15% to barriers.',
    mods: { armorPen: 2, barrierMul: 1.15 },
  },
};

const KAGE = {
  id: 'kage',
  name: 'Kage',
  title: 'Shadow Ninja',
  kind: 'tower',
  rarity: 'SR',
  adult: false,
  role: 'skirmisher',
  attackType: 'pierce',
  element: null,
  placement: 'land',
  materialFamily: 'feather',
  capabilities: ['detection', 'antiAir', 'multiHit'],
  pathCapabilities: ['reveal', 'priority', 'armorPen', 'stun'],
  acquisition: free('2-5', 'Joins after 2-5, just before veiled enemies haunt the Moonveil Shrine.'),
  palette: {
    hair: '#70568a', hairShade: '#4d3a63', eyes: '#d89fe8', skin: '#f5ddd2',
    outfit: '#574670', outfitShade: '#2e2540', accent: '#3b3150', halo: '#c4b5fd', weapon: '#c0c7d6',
  },
  look: {
    hairStyle: 'bob', bangs: 'messy', accessory: 'headband', outfit: 'kimono', weapon: 'shuriken',
    halo: 'moon', eyeStyle: 'sharp', expression: 'smug',
  },
  bio: 'The courier club\'s fastest runner and a ninja prodigy. A short purple bob under a dark headband marked with a silver crescent moon, a purple short-kimono jacket with silver embroidery and a lilac bow, a long dark scarf and a handful of silver shuriken. Nothing hides from her — not even veiled spirits.',
  personality: 'Playful, sly and allergic to sitting still; leaves cat-paw doodles on every delivery.',
  quote: 'Saw you. Saw you too.',
  tips: [
    'Innate Veil Sight: she hits veiled enemies from the moment she is placed.',
    'Many fast hits shatter crystal shells and pop illusion decoys.',
    'Shadow Mark tier 3 reveals veiled foes for the whole team.',
  ],
  base: stats({
    cost: 400, behavior: 'projectile', damage: 3, rate: 2.0, range: 3.0, projectiles: 2, pierce: 2,
    projectileSpeed: 18, canHitAir: true, detection: true,
  }),
  paths: [
    path('steel', 'Storm of Steel', 'Rapid multi-target', [
      tier('Quick Hands', 140, '+20% attack speed.', { rateMul: 1.2 }),
      tier('Triple Star', 320, 'Throws at 3 targets.', { projectiles: 1 }),
      tier('Shuriken Cyclone', 1000, '5 targets, +1 pierce, +15% attack speed.', { projectiles: 2, pierce: 1, rateMul: 1.15 }),
      tier('Blade Rain', 3000, '7 targets, +50% attack speed, +4 damage, ignores 5 armor; +20% damage.', { projectiles: 2, rateMul: 1.5, damage: 4, armorPen: 5, damageMul: 1.2 }),
      tier('Thousand Shadows', 26000, 'Shadow clones join in: 13 targets, +60% speed, +3 damage, +2 pierce, ignores 4 more armor, ×1.3 vs bosses; +65% damage.', { projectiles: 6, rateMul: 1.6, damage: 3, pierce: 2, armorPen: 4, bossMul: 1.3, damageMul: 1.65 }),
    ]),
    path('shadowmark', 'Shadow Mark', 'Reveal and mark', [
      tier('Keen Senses', 120, '+0.4 range.', { range: 0.4 }),
      tier('Shadow Step', 300, '+1 damage.', { damage: 1 }),
      tier('Unmasking Kunai', 900, 'Hits reveal veiled foes for everyone (3s) and mark them (+10% damage taken).', { reveal: 3, mark: { bonus: 0.1, duration: 3 } }),
      tier('Assassin\'s Mark', 2700, 'Mark +20% for 4s, ×1.4 vs elites, +4 damage, ignores 2 armor; +25% damage.', { mark: { bonus: 0.2, duration: 4 }, eliteMul: 1.4, damage: 4, armorPen: 2, damageMul: 1.25 }),
      tier('Night Sovereign', 18000, 'Mark +35% for 5s, reveal lasts 3s longer, +10 damage, 15% crits ×2.5, ignores 3 more armor; +50% damage.', { mark: { bonus: 0.35, duration: 5 }, reveal: 3, damage: 10, crit: { chance: 0.15, mul: 2.5 }, armorPen: 3, damageMul: 1.5 }),
    ]),
    path('kunai', 'Kunai Craft', 'Armor-piercing steel', [
      tier('Tempered Steel', 130, '+1 damage.', { damage: 1 }),
      tier('Weighted Kunai', 280, 'Ignores 1 armor.', { armorPen: 1 }),
      tier('Paralytic Kunai', 850, '15% chance to stun for 0.2s; ignores 1 more armor; +2 damage.', { status: [S.stun(0.2, 0.15)], armorPen: 1, damage: 2 }),
      tier('Kusarigama', 2600, 'Chained blades: +4 pierce, +5 damage, ignores 5 more armor; +25% damage.', { pierce: 4, damage: 5, armorPen: 5, damageMul: 1.25 }),
      tier('Black Lotus', 19000, '+16 damage, 25% stun for 0.5s, ignores 7 more armor, +30% speed; +60% damage.', { damage: 16, status: [S.stun(0.5, 0.25)], armorPen: 7, rateMul: 1.3, damageMul: 1.6 }),
    ]),
  ],
  awakenPassive: {
    name: 'Moonless Night',
    desc: 'Hits reveal veiled foes for 1.5s; +8% attack speed.',
    mods: { reveal: 1.5, rateMul: 1.08 },
  },
};

const UMEKO = {
  id: 'umeko',
  name: 'Umeko',
  title: 'Pearl Warden',
  kind: 'tower',
  rarity: 'SR',
  adult: false,
  role: 'support',
  attackType: 'mystic',
  element: 'water',
  placement: 'amphibious',
  materialFamily: 'charm',
  capabilities: ['water', 'detection', 'antiAir'],
  pathCapabilities: ['reveal', 'buff', 'silence', 'slow', 'stun'],
  acquisition: free('3-2', 'Joins after 3-2 as the shrine\'s veils grow thick — her aura shares Veil Sight with nearby girls.'),
  palette: {
    hair: '#e2f4ee', hairShade: '#9fd6c6', eyes: '#72bdaf', skin: '#ffe6dc',
    outfit: '#f4fbf8', outfitShade: '#6ebcb4', accent: '#f0c75e', halo: '#c8fff0', weapon: '#88e0c8',
  },
  look: {
    hairStyle: 'long', bangs: 'hime', accessory: 'flower', outfit: 'robe', weapon: 'staff',
    halo: 'wave', eyeStyle: 'sleepy', expression: 'smile',
  },
  bio: 'The dreamy lookout of the sea shrine. Long white hair that fades to seafoam at the tips, a gold shell hairpin, a white-and-teal shrine robe and a shell-fan staff studded with pearls. She floats a lantern on the water at dusk, and nothing hidden escapes its light.',
  personality: 'Dreamy and unhurried, hums sea shanties, and notices absolutely everything.',
  quote: 'Nothing hides in my waters~',
  tips: [
    'Amphibious: land or water. Every girl inside her aura gains Veil Sight.',
    'She barely attacks — place her where many girls stand within reach of her aura.',
    'Lighthouse tier 3 strips veils for everyone, even girls outside her aura.',
  ],
  base: stats({
    cost: 380, behavior: 'pulse', damage: 1, rate: 0.6, range: 2.4, maxTargets: 6,
    projectileSpeed: 0, canHitAir: true, detection: true, status: [S.soak(2)],
    aura: { range: 2.6, detection: true },
  }),
  paths: [
    path('lighthouse', 'Lighthouse', 'Veil Sight and reveal', [
      tier('Clear Water', 120, 'Aura reaches 3 tiles.', { aura: { range: 3 } }),
      tier('Beacon', 300, '+0.4 range; aura reaches 3.4 tiles.', { range: 0.4, aura: { range: 3.4 } }),
      tier('Revealing Tide', 950, 'Pulses reveal veiled foes for everyone for 3s; +2 damage.', { reveal: 3, damage: 2 }),
      tier('Moonlit Beacon', 3000, 'Aura reaches 4.5 tiles and gives +10% range and +5% damage; reveal +2s.', { aura: { range: 4.5, rangeMul: 1.1, dmgMul: 1.05 }, reveal: 2 }),
      tier('Sea of Lanterns', 15000, 'Aura reaches 6 tiles: +15% range, +15% damage, and girls in it ignore 3 armor; reveals last 3s longer and pulses silence for 0.8s.', { aura: { range: 6, rangeMul: 1.15, dmgMul: 1.15, armorPen: 3 }, reveal: 3, silence: 0.8 }),
    ]),
    path('plumrain', 'Plum Rain', 'Team buffs', [
      tier('Warm Current', 140, 'Aura: +5% attack speed.', { aura: { rateMul: 1.05 } }),
      tier('Blossom Shower', 320, 'Aura: +5% damage.', { aura: { dmgMul: 1.05 } }),
      tier('Spring Tide', 1100, 'Aura: +10% attack speed, +5% damage.', { aura: { rateMul: 1.1, dmgMul: 1.05 } }),
      tier('Festival of Plums', 3400, 'Aura: +15% damage, +10% attack speed.', { aura: { dmgMul: 1.15, rateMul: 1.1 } }),
      tier('Blooming Ocean', 17500, 'Aura: +20% damage and speed, +10% range, +10% crit chance, 5% cheaper upgrades.', { aura: { dmgMul: 1.2, rateMul: 1.2, rangeMul: 1.1, costCut: 0.05, critChance: 0.1 } }),
    ]),
    path('ripples', 'Undertow Ripples', 'Water control', [
      tier('Ripples', 100, '+1 damage.', { damage: 1 }),
      tier('Drag Current', 260, 'Pulses slow by 20% for 1.5s.', { status: [S.slow(0.2, 1.5)] }),
      tier('Whirl Ward', 850, 'Slow 35%; pulses push enemies back 0.15 tiles.', { status: [S.slow(0.35, 2)], knockback: 0.15 }),
      tier('Maelstrom Bloom', 2600, '20% chance to stun for 0.45s; +4 damage, 4 more targets, +15% damage.', { status: [S.stun(0.45, 0.2)], damage: 4, maxTargets: 4, damageMul: 1.15 }),
      tier('Tidal Sanctuary', 14500, '55% slows for 3.5s and Brittle +15%, strong push-back (0.4), +10 damage, +0.6 range, 12 more targets; +80% damage.', { status: [S.slow(0.55, 3.5), S.vulnerable(0.15, 3)], knockback: 0.4, damage: 10, range: 0.6, maxTargets: 12, damageMul: 1.8 }),
    ]),
  ],
  awakenPassive: {
    name: 'Spring Blessing',
    desc: 'Aura reaches 3 tiles and grants +5% attack speed.',
    mods: { aura: { range: 3, rateMul: 1.05 } },
  },
};

const SHIRO = {
  id: 'shiro',
  name: 'Shiro',
  title: 'Moon Sniper',
  kind: 'tower',
  rarity: 'SR',
  adult: false,
  role: 'sniper',
  attackType: 'pierce',
  element: null,
  placement: 'land',
  materialFamily: 'feather',
  capabilities: ['armorPen', 'antiAir', 'priority'],
  pathCapabilities: ['detection', 'reveal', 'stun', 'buff'],
  acquisition: free('3-5', 'Joins after 3-5, right before the armored orcs of Ironhold Pass.'),
  palette: {
    hair: '#d2d6de', hairShade: '#a3a9b8', eyes: '#84bdf8', skin: '#fbe8de',
    outfit: '#414f68', outfitShade: '#2a3446', accent: '#2e3b58', halo: '#b8f2e6', weapon: '#2d3142',
  },
  look: {
    hairStyle: 'short', bangs: 'straight', accessory: 'beret', outfit: 'blazer', weapon: 'rifle',
    halo: 'eye', eyeStyle: 'sleepy', expression: 'calm',
  },
  bio: 'A quiet marksman from the rifle club. Short silver-white hair with long side locks, a navy beret, a navy-and-slate uniform with gold buttons and a dark scoped rifle that never leaves her side. From the bell tower she can see the whole map — and hit it.',
  personality: 'Deadpan, patient and quietly kind; keeps a pocket full of candy for her spotters.',
  quote: 'Target confirmed.',
  tips: [
    'Range 10 covers most of the map — place her anywhere safe.',
    'Set her to Priority to delete casters, siphoners and field oni first.',
    'She ignores armor: the free answer to orc plate.',
  ],
  base: stats({
    cost: 450, behavior: 'projectile', damage: 18, rate: 0.4, range: 10, projectileSpeed: 0,
    armorPen: 3, canHitAir: true, eliteMul: 1.25, crit: { chance: 0.1, mul: 2 },
  }),
  paths: [
    path('execution', 'Execution', 'Elite execution', [
      tier('Full Metal Jacket', 160, '+6 damage, ignores 1 more armor.', { damage: 6, armorPen: 1 }),
      tier('Heavy Calibre', 380, '+10 damage.', { damage: 10 }),
      tier('Elite Hunter', 1300, '+25 damage, ×1.5 vs elites, ignores 2 more armor.', { damage: 25, eliteMul: 1.5, armorPen: 2 }),
      tier('Deadeye', 4000, '+60 damage, ×1.4 vs bosses, +10% crits at ×3; +30% damage.', { damage: 60, bossMul: 1.4, crit: { chance: 0.1, mul: 3 }, damageMul: 1.3 }),
      tier('Cross-Map Execution', 35000, '+250 damage, ×1.4 elites, ×1.3 bosses, ignores 6 more armor; every shot staggers (0.6s stun) and takes 3% of the target\'s current HP (bosses 0.3%, at most 2× the shot); +15% damage.', { damage: 250, eliteMul: 1.4, bossMul: 1.3, armorPen: 6, status: [S.stun(0.6)], hpPct: { pct: 0.03, boss: 0.003, cap: 2 }, damageMul: 1.15 }),
    ]),
    path('spotter', 'Spotter\'s Mark', 'Marked targets take more allied damage', [
      tier('Spotter Scope', 120, '+1 range.', { range: 1 }),
      tier('Tracer Round', 300, '+4 damage.', { damage: 4 }),
      tier('Spotter\'s Mark', 1000, 'Thermal scope (Veil Sight); marked foes take +15% damage from everyone for 4s.', { detection: true, mark: { bonus: 0.15, duration: 4 } }),
      tier('Kill Zone', 3200, 'Mark +30% for 6s; shots reveal veiled foes for 4s; +20% damage.', { mark: { bonus: 0.3, duration: 6 }, reveal: 4, damageMul: 1.2 }),
      tier('Overwatch Network', 17500, 'Mark +50% for 8s; girls within 4 tiles gain Veil Sight, +10% range and ignore 4 armor; +20 damage, +80% damage.', { mark: { bonus: 0.5, duration: 8 }, aura: { range: 4, detection: true, rangeMul: 1.1, armorPen: 4 }, damage: 20, damageMul: 1.8 }),
    ]),
    path('followup', 'Follow-up Shots', 'Faster follow-ups', [
      tier('Bolt Polish', 130, '+20% attack speed.', { rateMul: 1.2 }),
      tier('Quick Cycle', 320, '+20% attack speed.', { rateMul: 1.2 }),
      tier('Double Tap', 1100, 'Fires at the two highest-priority targets; +15% attack speed.', { projectiles: 1, rateMul: 1.15 }),
      tier('Semi-Auto Conversion', 3400, '+80% attack speed, +4 damage; rounds over-penetrate 2 more enemies; +30% damage.', { rateMul: 1.8, damage: 4, pierce: 2, damageMul: 1.3 }),
      tier('Silver Storm', 30000, 'Four targets per volley, double attack speed, +12 damage, +15% crits ×2, ignores 4 armor, ×1.25 vs elites and bosses (×1.25 more vs bosses); +15% damage.', { projectiles: 2, rateMul: 2, damage: 12, crit: { chance: 0.15, mul: 2 }, armorPen: 4, eliteMul: 1.25, bossMul: 1.25, damageMul: 1.15 }),
    ]),
  ],
  awakenPassive: {
    name: 'One Shot, One Bloom',
    desc: '+10% crit chance; crits deal ×2.5.',
    mods: { crit: { chance: 0.1, mul: 2.5 } },
  },
};

const MIDORI = {
  id: 'midori',
  name: 'Midori',
  title: 'Potion Alchemist',
  kind: 'tower',
  rarity: 'SR',
  adult: false,
  role: 'alchemist',
  attackType: 'mystic',
  element: 'poison',
  placement: 'land',
  materialFamily: 'rune',
  capabilities: ['antiHeal'],
  pathCapabilities: ['armorShred', 'armorPen', 'barrierBreak', 'antiAir', 'slow', 'stun', 'buff'],
  acquisition: free('4-5', 'Joins after 4-5, before the regenerating, siphoning ghouls of Gloomfen Marsh.'),
  palette: {
    hair: '#72c7ac', hairShade: '#4a9a80', eyes: '#c3f290', skin: '#ffe6d5',
    outfit: '#5d8975', outfitShade: '#41664f', accent: '#d9b34a', halo: '#b9fbc0', weapon: '#80ed99',
  },
  look: {
    hairStyle: 'bob', bangs: 'split', accessory: 'goggles', outfit: 'apron', weapon: 'flask',
    halo: 'leaf', eyeStyle: 'round', expression: 'cheerful',
  },
  bio: 'The alchemy club\'s cheerful menace. A mint-green bob with round gold goggles pushed up on her head, a green dress under a cream apron, a satchel of clinking flasks and a round green potion with a star stopper. Her brews melt armor and stop anything from healing.',
  personality: 'Curious, chaotic and proud of it; labels every flask "probably safe".',
  quote: 'Hypothesis: this will melt. Let\'s test it!',
  tips: [
    'Poison ignores armor and stops regeneration and siphon healing.',
    'Lob flasks where enemies bunch up — poison sticks to everyone in the splash.',
    'Corrosion shreds armor for the whole team.',
    'Her brews pick the strongest girl in range — tap Pick to choose.',
  ],
  base: stats({
    cost: 420, behavior: 'projectile', damage: 2, rate: 0.8, range: 3.0, splash: 0.7,
    projectileSpeed: 9, canHitAir: false, status: [S.poison(3, 4)],
  }),
  paths: [
    path('toxicology', 'Toxicology', 'Stronger poison', [
      tier('Concentrate', 130, 'Poison deals 4/s for 4.5s. Toxic Tonic: she brews 1 girl in range for +15% damage.', { status: [S.poison(4, 4.5)], brew: { targets: 1, dmgMul: 1.15 } }),
      tier('Wide Flask', 300, '+0.3 splash; Toxic Tonic +5% stronger (+21% damage).', { splash: 0.3, brew: { dmgMul: 1.05 } }),
      tier('Wither Bloom', 950, 'Poison deals 8/s for 5s; +0.3 splash; Toxic Tonic brews 2 girls (+12% more: +35% damage).', { status: [S.poison(8, 5)], splash: 0.3, brew: { targets: 2, dmgMul: 1.12 } }),
      tier('Plague Garden', 3000, 'Poison deals 18/s plus 0.1% of max HP/s for 6s; +30% attack speed, +0.4 splash; Toxic Tonic +15% more (+55% damage).', { status: [{ type: 'poison', dps: 18, pct: 0.001, duration: 6 }], rateMul: 1.3, splash: 0.4, brew: { dmgMul: 1.15 } }),
      tier('Verdant Apocalypse', 21000, 'Poison deals 56/s plus 0.25% of max HP/s for 7s (bosses 0.025%) in enormous clouds (+0.8 splash); +30% attack speed, +6 damage. Toxic Tonic: +100% damage on 3 girls (+29% more).', { status: [{ type: 'poison', dps: 56, pct: 0.0025, duration: 7 }], splash: 0.8, rateMul: 1.3, damage: 6, brew: { targets: 3, dmgMul: 1.29 } }),
    ]),
    path('corrosion', 'Corrosion', 'Acid that dissolves armor', [
      tier('Acid Splash', 120, '+2 damage. Acid Edge: she brews 1 girl in range to ignore 2 armor.', { damage: 2, brew: { targets: 1, armorPen: 2 } }),
      tier('Etching Agent', 280, 'Acid cracks armor: -1 for 3s (stacks ×3); Acid Edge pen +1 (3).', { status: [S.shred(1, 3)], brew: { armorPen: 1 } }),
      tier('Melting Point', 900, 'Shred -2 for 4s; ignores 2 armor; Acid Edge brews 2 girls, pen +2 (5).', { status: [S.shred(2, 4)], armorPen: 2, brew: { targets: 2, armorPen: 2 } }),
      tier('Philosopher\'s Acid', 2800, 'Shred -4 for 5s and Brittle +15%; +6 damage, +20% damage; Acid Edge pen +3 (8) and +10% damage.', { status: [S.shred(4, 5), S.vulnerable(0.15, 3)], damage: 6, damageMul: 1.2, brew: { armorPen: 3, dmgMul: 1.1 } }),
      tier('Universal Solvent', 15000, 'Shred -6 (×3: -18 armor), Brittle +30%, +16 damage, ×1.5 vs barriers, +60% damage. Acid Edge: pen 12 and +25% damage on 3 girls (+4 pen, +14%).', { status: [S.shred(6, 6), S.vulnerable(0.3, 4)], damage: 16, barrierMul: 1.5, damageMul: 1.6, brew: { targets: 3, armorPen: 4, dmgMul: 1.14 } }),
    ]),
    path('fieldkit', 'Field Kit', 'Mist, flyers and paralysis', [
      tier('Long Toss', 100, '+0.4 range. Swift Draught: she brews 1 girl in range for +12% attack speed.', { range: 0.4, brew: { targets: 1, rateMul: 1.12 } }),
      tier('Quick Mix', 260, '+20% attack speed; Swift Draught +5% stronger (+18%).', { rateMul: 1.2, brew: { rateMul: 1.05 } }),
      tier('Drifting Mist', 850, 'Gas clouds rise high enough to hit flyers and slow by 25% for 2s; Swift Draught brews 2 girls (+10% more: +29%).', { canHitAir: true, status: [S.slow(0.25, 2)], brew: { targets: 2, rateMul: 1.1 } }),
      tier('Paralysis Spore', 2600, '20% chance to stun for 0.4s; +0.4 splash, +20% attack speed, ignores 2 armor, +20% damage; Swift Draught brews 3 girls (+12% more: +45%).', { status: [S.stun(0.4, 0.2)], splash: 0.4, rateMul: 1.2, armorPen: 2, damageMul: 1.2, brew: { targets: 3, rateMul: 1.12 } }),
      tier('Elixir Barrage', 22500, 'Four flasks per throw, +50% attack speed, poison 12/s, +6 damage. Swift Draught: +70% attack speed and +10% crit chance on 4 girls (+17% more).', { projectiles: 3, rateMul: 1.5, status: [S.poison(12, 5)], damage: 6, brew: { targets: 4, rateMul: 1.17, critChance: 0.1 } }),
    ]),
  ],
  awakenPassive: {
    name: 'Perfect Formula',
    desc: '+10% damage and +0.2 splash.',
    mods: { damageMul: 1.1, splash: 0.2 },
  },
};

const SUZU = {
  id: 'suzu',
  name: 'Suzu',
  title: 'Bell Trapper',
  kind: 'tower',
  rarity: 'SR',
  adult: false,
  role: 'trapper',
  attackType: 'blast',
  element: null,
  placement: 'land',
  materialFamily: 'cog',
  capabilities: ['trap'],
  pathCapabilities: ['barrierBreak', 'slow', 'stun', 'detection', 'reveal', 'silence'],
  acquisition: free('5-5', 'Joins after 5-5, before goblin sappers start sabotaging girls in the Clockwork Foundry.'),
  palette: {
    hair: '#d6a65b', hairShade: '#ad8139', eyes: '#f2cd7a', skin: '#ffe8da',
    outfit: '#f6f1e4', outfitShade: '#428d8b', accent: '#3f9a96', halo: '#ffd166', weapon: '#e9c46a',
  },
  look: {
    hairStyle: 'side', bangs: 'straight', accessory: 'ribbon', outfit: 'kimono', weapon: 'bell',
    halo: 'ring', eyeStyle: 'sparkle', expression: 'cheerful',
  },
  bio: 'The bell club\'s mischievous bell-maker. Golden-blonde hair with a big looped side curl and teal ribbons, a white-and-teal kimono with golden bells on the obi, and a little bell rack she rings to set her traps. Enemies who step on her bells hear one last cheerful ring.',
  personality: 'Mischievous and sing-song, loves pranks, and is far more organised than she lets on.',
  quote: 'Ring, ring~ You\'re not going anywhere.',
  tips: [
    'Traps go on path tiles inside her range — place her near the exit to catch leakers.',
    'Traps catch sappers before they can sabotage your girls.',
    'Spirit Seals tier 3 reveals veiled foes; tier 4 turns her seals holy.',
  ],
  base: stats({
    cost: 380, behavior: 'trap', damage: 12, rate: 0.4, range: 2.6, projectileSpeed: 0,
    canHitAir: false,
    trap: { max: 4, damage: 12, triggerRadius: 0.6, armTime: 1.0, splash: 0.8, status: [] },
  }),
  paths: [
    path('mines', 'Explosive Mines', 'Big booms', [
      tier('Bigger Charges', 120, 'Traps +6 damage.', { trap: { damage: 6 } }),
      tier('Stockpile', 300, 'Up to 6 traps at once.', { trap: { max: 2 } }),
      tier('Blast Mines', 1000, 'Traps +20 damage with bigger blasts; ×1.5 vs barriers.', { trap: { damage: 20, splash: 0.4 }, barrierMul: 1.5 }),
      tier('Chain Mines', 3000, 'Up to 10 traps, +42 damage, sets traps 40% faster.', { trap: { max: 4, damage: 42 }, rateMul: 1.4 }),
      tier('Grand Bell Detonation', 22000, 'Traps +220 damage, huge blasts (+1 splash), 4 more traps, +30% set speed, ×1.8 vs bosses.', { trap: { damage: 220, splash: 1, max: 4 }, rateMul: 1.3, bossMul: 1.8 }),
    ]),
    path('binding', 'Binding Traps', 'Slow and root', [
      tier('Sticky Seal', 110, 'Traps slow by 30% for 2s.', { trap: { status: [S.slow(0.3, 2)] } }),
      tier('Quick Set', 280, 'Sets traps 25% faster.', { rateMul: 1.25 }),
      tier('Binding Bell', 900, 'Traps root enemies in place (1s stun).', { trap: { status: [S.stun(1)] } }),
      tier('Sealing Net', 2800, 'Slow 55% for 3.5s, wider nets (+0.45), 2 more traps.', { trap: { status: [S.slow(0.55, 3.5)], splash: 0.45, max: 2 } }),
      tier('Thousand Bell Prison', 16000, 'Traps freeze for 3s and leave foes Brittle (+20% for 4s); 6 more traps, wider seals (+0.7), +40% set speed.', { trap: { status: [S.freeze(3), S.vulnerable(0.2, 4)], max: 6, splash: 0.7 }, rateMul: 1.4 }),
    ]),
    path('seals', 'Spirit Seals', 'Reveal and silence', [
      tier('Ofuda Ink', 100, '+0.4 range.', { range: 0.4 }),
      tier('Sacred Paper', 260, 'Traps +4 damage.', { trap: { damage: 4 } }),
      tier('Revealing Seal', 850, 'Veil Sight; traps reveal veiled foes for 4s.', { detection: true, trap: { status: [S.reveal(4)] } }),
      tier('Exorcism Seal', 2600, 'Seals turn Holy (great vs spirits) and silence for 3s; traps +22 damage.', { attackType: 'holy', trap: { status: [S.silence(3)], damage: 22 } }),
      tier('Great Barrier Seal', 19000, 'Traps +120 damage, silence 5s, Brittle +30%, 4 more traps, +30% set speed, ×1.5 vs bosses.', { trap: { damage: 120, status: [S.silence(5), S.vulnerable(0.3, 4)], max: 4 }, rateMul: 1.3, bossMul: 1.5 }),
    ]),
  ],
  awakenPassive: {
    name: 'Ringing Bells',
    desc: '2 more traps at once; traps +6 damage.',
    mods: { trap: { max: 2, damage: 6 } },
  },
};

const RAIKA = {
  id: 'raika',
  name: 'Raika',
  title: 'Storm Caller',
  kind: 'tower',
  rarity: 'SR',
  adult: false,
  role: 'chain',
  attackType: 'mystic',
  element: 'lightning',
  placement: 'land',
  materialFamily: 'rune',
  capabilities: ['antiAir', 'multiHit'],
  pathCapabilities: ['armorPen', 'stun', 'silence', 'armorShred'],
  acquisition: GACHA_ONLY,
  palette: {
    hair: '#e8c356', hairShade: '#c29a2e', eyes: '#e4b9ff', skin: '#ffe6d8',
    outfit: '#6671a1', outfitShade: '#454e7a', accent: '#d9a93a', halo: '#fff3a3', weapon: '#f2c14e',
  },
  look: {
    hairStyle: 'long', bangs: 'messy', accessory: 'horns', outfit: 'dress', weapon: 'staff',
    halo: 'bolt', eyeStyle: 'sparkle', expression: 'cheerful',
  },
  bio: 'A thunder-mage prodigy from the taiko and weather club who treats every battle like a concert. Long golden hair with two curled ram-horn tufts, a periwinkle-and-indigo dress with a lilac bow, and a staff crowned with a big gold star that throws lightning from enemy to enemy.',
  personality: 'Hyper, loud and endlessly fun; taps out rhythms on every surface within reach.',
  quote: 'Feel the beat? That\'s thunder!',
  tips: [
    'Lightning jumps between enemies — the more spread out the wave, the better.',
    'Soaked enemies take +15% lightning damage: pair her with Sango, Umeko or Nami.',
    'Overcharge tier 4 turns her into a piercing lightning lance.',
  ],
  base: stats({
    cost: 480, behavior: 'chain', damage: 5, rate: 0.9, range: 3.2, chain: 3,
    projectileSpeed: 0, canHitAir: true, status: [S.shock(0.15, 0.3)],
  }),
  paths: [
    path('forked', 'Forked Lightning', 'More jumps', [
      tier('Conductive', 130, '+1 jump.', { chain: 1 }),
      tier('Static Field', 300, '+1 jump, +0.3 range.', { chain: 1, range: 0.3 }),
      tier('Forked Bolt', 1000, 'Casts two bolts at once; +2 jumps.', { projectiles: 1, chain: 2 }),
      tier('Storm Network', 3000, '+4 jumps, +30% attack speed, +3 damage, ignores 3 armor; +25% damage.', { chain: 4, rateMul: 1.3, damage: 3, armorPen: 3, damageMul: 1.25 }),
      tier('Raijin\'s Wrath', 22000, '+10 jumps, +12 damage, +40% attack speed, 50% shock (0.3s), ×2.5 vs bosses; +30% damage.', { chain: 10, damage: 12, rateMul: 1.4, status: [S.shock(0.3, 0.5)], bossMul: 2.5, damageMul: 1.3 }),
    ]),
    path('overcharge', 'Overcharge', 'Heavy single bolts', [
      tier('Capacitor', 140, '+2 damage.', { damage: 2 }),
      tier('High Voltage', 320, '+2 damage, ignores 1 armor.', { damage: 2, armorPen: 1 }),
      tier('Thunderclap', 1000, '+5 damage, 25% chance to stun for 0.5s, ignores 1 more armor.', { damage: 5, status: [S.stun(0.5, 0.25)], armorPen: 1 }),
      tier('Lightning Lance', 3200, 'Becomes a piercing lightning lance (beam): +14 damage, pierces 4, +25% vs elites, ignores 2 armor; +25% damage.', { behavior: 'beam', damage: 14, pierce: 3, eliteMul: 1.25, armorPen: 2, damageMul: 1.25 }),
      tier('Heaven\'s Drum', 23000, '+40 damage, +30% attack speed, 35% stun for 0.8s, ×1.6 vs bosses; +35% damage.', { damage: 40, rateMul: 1.3, status: [S.stun(0.8, 0.35)], bossMul: 1.6, damageMul: 1.35 }),
    ]),
    path('rhythm', 'Storm Rhythm', 'Tempo and interrupts', [
      tier('Tempo', 120, '+15% attack speed.', { rateMul: 1.15 }),
      tier('Crackle', 280, 'Shock chance rises to 40% (0.2s).', { status: [S.shock(0.2, 0.4)] }),
      tier('Drum Roll', 900, '+30% attack speed; jolts silence blinks and siphons for 0.5s.', { rateMul: 1.3, silence: 0.5 }),
      tier('Thunder Festival', 2800, '+40% attack speed, +2 jumps, silence +0.5s, ignores 3 armor; +25% damage.', { rateMul: 1.4, chain: 2, silence: 0.5, armorPen: 3, damageMul: 1.25 }),
      tier('Endless Thunder', 20000, 'Double attack speed, +8 damage, +3 jumps; struck foes turn Brittle (+15%) and crack (-1 armor, stacks ×3); +45% damage.', { rateMul: 2, damage: 8, chain: 3, status: [S.vulnerable(0.15, 3), S.shred(1, 3)], damageMul: 1.45 }),
    ]),
  ],
  awakenPassive: {
    name: 'Static Soul',
    desc: '+1 jump; shock chance rises to 35%.',
    mods: { chain: 1, status: [S.shock(0.2, 0.35)] },
  },
};

const MIKO = {
  id: 'miko',
  name: 'Miko',
  title: 'Shrine Keeper',
  kind: 'tower',
  rarity: 'SR',
  adult: false,
  role: 'enchanter',
  attackType: 'holy',
  element: null,
  placement: 'land',
  materialFamily: 'charm',
  capabilities: ['buff', 'antiAir'],
  pathCapabilities: ['silence', 'reveal', 'detection', 'cleanse', 'armorPen'],
  acquisition: GACHA_ONLY,
  palette: {
    hair: '#373448', hairShade: '#1f1d2a', eyes: '#bc80a3', skin: '#fff0e8',
    outfit: '#ffffff', outfitShade: '#e6e6ef', accent: '#d0384a', halo: '#ffd6e7', weapon: '#f5f0e1',
  },
  look: {
    hairStyle: 'hime', bangs: 'hime', accessory: 'ribbon', outfit: 'miko', weapon: 'gohei',
    halo: 'petal', eyeStyle: 'closed', expression: 'calm',
  },
  bio: 'Keeper of the academy shrine. Long straight black hair with a big red bow, a white haori over red hakama and a gohei wand with white paper streamers. Her prayers make every girl nearby strike a little harder.',
  personality: 'Serene and formal, with an unexpected competitive streak at festival games.',
  quote: 'May the blossoms guide your aim.',
  tips: [
    'Every girl within her aura deals +10% damage — place her in the middle of your best girls.',
    'Sacred Grounds gives Veil Sight, cleanses sabotage and makes upgrades cheaper for the whole cluster (not hero levels).',
    'Purification turns her talismans into silencing holy strikes.',
  ],
  base: stats({
    cost: 450, behavior: 'projectile', damage: 2, rate: 0.8, range: 2.8, projectileSpeed: 12,
    canHitAir: true, aura: { range: 2.5, dmgMul: 1.1 },
  }),
  paths: [
    path('blessing', 'Blessing', 'Damage aura', [
      tier('Prayer Beads', 140, 'Aura damage +5%.', { aura: { dmgMul: 1.05 } }),
      tier('Wider Shrine', 320, 'Aura reaches 3 tiles.', { aura: { range: 3 } }),
      tier('Divine Favour', 1100, 'Aura +10% damage and +5% attack speed.', { aura: { dmgMul: 1.1, rateMul: 1.05 } }),
      tier('Kagura Dance', 3400, 'Aura +15% attack speed and girls in it ignore 2 armor; reaches 3.5 tiles.', { aura: { rateMul: 1.15, range: 3.5, armorPen: 2 } }),
      tier('Goddess\'s Festival', 18500, 'Aura +30% damage, +12% speed, +10% range and 2 more armor pen (4), reaching 4.2 tiles.', { aura: { dmgMul: 1.3, rateMul: 1.12, rangeMul: 1.1, range: 4.2, armorPen: 2 } }),
    ]),
    path('purify', 'Purification', 'Holy talismans', [
      tier('Ofuda', 120, '+2 damage.', { damage: 2 }),
      tier('Purifying Talisman', 300, '+25% attack speed.', { rateMul: 1.25 }),
      tier('Exorcism Rite', 950, 'Talismans silence for 0.8s and reveal veiled foes for 2s.', { silence: 0.8, reveal: 2 }),
      tier('Divine Wind', 3000, 'Three talismans per throw, +6 damage, +2 pierce, ignores 2 armor; +25% damage.', { projectiles: 2, damage: 6, pierce: 2, armorPen: 2, damageMul: 1.25 }),
      tier('Amaterasu\'s Mirror', 20000, 'A mirror of sunlight: a piercing holy beam (pierces 6), +20 damage, +1.5 range, silence +1s, ×1.5 vs bosses; +35% damage.', { behavior: 'beam', damage: 20, pierce: 6, silence: 1, range: 1.5, bossMul: 1.5, damageMul: 1.35 }),
    ]),
    path('grounds', 'Sacred Grounds', 'Utility aura', [
      tier('Incense', 100, 'Aura: +5% range.', { aura: { rangeMul: 1.05 } }),
      tier('Wind Chime', 260, 'Girls in her aura pay 5% less for upgrades.', { aura: { costCut: 0.05 } }),
      tier('Watchful Kami', 900, 'Aura grants Veil Sight.', { aura: { detection: true } }),
      tier('Purifying Bells', 2700, 'Aura cleanses sabotage and disables; +8% range, +5% attack speed.', { aura: { cleanse: true, rangeMul: 1.08, rateMul: 1.05 } }),
      tier('Heavenly Shrine', 14500, 'Aura reaches 4 tiles: 12% cheaper upgrades (17% in total), +15% damage, +10% speed, +5% crit chance.', { aura: { costCut: 0.12, range: 4, dmgMul: 1.15, rateMul: 1.1, critChance: 0.05 } }),
    ]),
  ],
  awakenPassive: {
    name: 'Grand Blessing',
    desc: 'Aura damage +5%.',
    mods: { aura: { dmgMul: 1.05 } },
  },
};

const HOTARU = {
  id: 'hotaru',
  name: 'Hotaru',
  title: 'Lantern Keeper',
  kind: 'tower',
  rarity: 'SSR',
  adult: false,
  role: 'exorcist',
  attackType: 'holy',
  element: null,
  placement: 'land',
  materialFamily: 'charm',
  capabilities: ['detection', 'reveal', 'silence', 'antiAir'],
  pathCapabilities: ['stun', 'slow', 'buff', 'cleanse'],
  acquisition: GACHA_ONLY,
  palette: {
    hair: '#eab184', hairShade: '#c98a5a', eyes: '#e8ab4d', skin: '#fdeee6',
    outfit: '#f3ead8', outfitShade: '#438f97', accent: '#2f7f86', halo: '#fff59d', weapon: '#ffd93d',
  },
  look: {
    hairStyle: 'bob', bangs: 'swept', accessory: 'beret', outfit: 'robe', weapon: 'lantern',
    halo: 'ring', eyeStyle: 'round', expression: 'calm',
  },
  bio: 'A gentle exorcist-in-training who walks the shrine paths at night. A honey-orange bob under a teal beret with a gold star, a teal haori over a cream dress and a hooked staff with a glowing paper lantern. Fireflies follow her everywhere; veils and spirits melt in her light.',
  personality: 'Gentle, a little otherworldly and stubbornly brave; talks to the fireflies by name.',
  quote: 'Be still... the lights will guide you home.',
  tips: [
    'Her pulses reveal veiled foes and silence oni fields, siphons, blinks and phasing.',
    'Holy deals double damage to ghosts and wraiths.',
    'Place her where field casters walk — silenced fields stop buffing the wave.',
  ],
  base: stats({
    cost: 650, behavior: 'pulse', damage: 6, rate: 0.8, range: 2.6, maxTargets: 8,
    projectileSpeed: 0, canHitAir: true, detection: true, reveal: 3, silence: 1,
  }),
  paths: [
    path('lantern', 'Lantern Light', 'Holy damage', [
      tier('Brighter Wick', 160, '+2 damage.', { damage: 2 }),
      tier('Firefly Swarm', 380, 'Pulses hit 4 more enemies; +0.2 range.', { maxTargets: 4, range: 0.2 }),
      tier('Spirit Bane', 1200, '+6 damage, 10% crits ×2.', { damage: 6, crit: { chance: 0.1, mul: 2 } }),
      tier('Requiem Lanterns', 3600, '+14 damage, +30% attack speed, +25% vs elites; struck foes turn Brittle (+10%); +30% damage.', { damage: 14, rateMul: 1.3, status: [S.vulnerable(0.1, 2)], eliteMul: 1.25, damageMul: 1.3 }),
      tier('Thousand Souls Festival', 32500, '+40 damage, +1.2 range, +30% attack speed; pulses hit everything in range (40 more targets), ×2.5 vs bosses; +25% damage.', { damage: 40, range: 1.2, rateMul: 1.3, maxTargets: 40, bossMul: 2.5, damageMul: 1.25 }),
    ]),
    path('prayer', 'Silent Prayer', 'Silence and stillness', [
      tier('Hush', 150, 'Silence lasts 0.4s longer.', { silence: 0.4 }),
      tier('Calm Waters', 340, 'Pulses slow by 20% for 1.5s.', { status: [S.slow(0.2, 1.5)] }),
      tier('Sealing Chant', 1100, 'Silence +1s; 20% chance to stun for 0.3s.', { silence: 1, status: [S.stun(0.3, 0.2)] }),
      tier('Quiet Night', 3400, 'Silence +1.8s; struck foes turn Brittle (+18%); +15% damage.', { silence: 1.8, status: [S.vulnerable(0.18, 3)], damageMul: 1.15 }),
      tier('Absolute Stillness', 19000, 'Silence +3.5s, 40% stun for 0.9s, 45% slows, Brittle +25%, +1 range; double damage.', { silence: 3.5, status: [S.stun(0.9, 0.4), S.slow(0.45, 3), S.vulnerable(0.25, 3)], range: 1, damageMul: 2 }),
    ]),
    path('guiding', 'Guiding Lights', 'Team support', [
      tier('Glowing Path', 140, '+0.3 range.', { range: 0.3 }),
      tier('Shared Glow', 320, 'Girls within 3 tiles gain +5% range.', { aura: { range: 3, rangeMul: 1.05 } }),
      tier('Will-o\'-Wisps', 1000, 'Aura grants Veil Sight; reveals last 3s longer.', { aura: { detection: true }, reveal: 3 }),
      tier('Firefly Grove', 3200, 'Aura +15% damage and cleanses sabotage.', { aura: { dmgMul: 1.15, cleanse: true } }),
      tier('Night of Fireflies', 17500, 'Aura +20% damage, +15% speed and girls in it ignore 3 armor, 4.5 tiles; reveals +4s.', { aura: { dmgMul: 1.2, rateMul: 1.15, range: 4.5, armorPen: 3 }, reveal: 4 }),
    ]),
  ],
  awakenPassive: {
    name: 'Lantern of Return',
    desc: 'Silence +0.5s and +8% damage.',
    mods: { silence: 0.5, damageMul: 1.08 },
  },
};

const KAEDE = {
  id: 'kaede',
  name: 'Kaede',
  title: 'Crimson Fencer',
  kind: 'tower',
  rarity: 'SSR',
  adult: false,
  role: 'duelist',
  attackType: 'slash',
  element: null,
  placement: 'land',
  materialFamily: 'blade',
  capabilities: ['priority'],
  pathCapabilities: ['armorPen', 'armorShred', 'stun', 'antiAir'],
  acquisition: GACHA_ONLY,
  palette: {
    hair: '#ad5148', hairShade: '#7f3530', eyes: '#edbf76', skin: '#fde7da',
    outfit: '#a6314a', outfitShade: '#6e1f33', accent: '#e8742c', halo: '#ff9e57', weapon: '#e5e5e5',
  },
  look: {
    hairStyle: 'side', bangs: 'split', accessory: 'flower', outfit: 'coat', weapon: 'rapier',
    halo: 'leaf', eyeStyle: 'sharp', expression: 'determined',
  },
  bio: 'Captain of the fencing club. Long crimson hair with a maple-leaf ornament, a red-and-gold fencing coat over an ivory blouse, dark boots and a slender rapier with a gold basket guard. Every strike on the same opponent lands faster and harder than the last.',
  personality: 'Elegant, competitive and a little dramatic; salutes every opponent with a flourish.',
  quote: 'En garde — and do try to keep up.',
  tips: [
    'Her damage builds with every consecutive hit on the same target.',
    'Use Strong or Priority targeting so she locks onto the toughest enemy.',
    'Melee: she cannot hit flyers until Flowing Blade tier 3.',
  ],
  base: stats({
    cost: 600, behavior: 'duel', damage: 10, rate: 1.1, range: 2.0, projectileSpeed: 0,
    canHitAir: false, eliteMul: 1.1, crit: { chance: 0.1, mul: 1.75 }, ramp: { per: 0.1, max: 0.8 },
  }),
  paths: [
    path('rhythm', 'Unbroken Rhythm', 'Damage ramp', [
      tier('Steady Footwork', 150, 'Ramp builds +2% faster per hit and reaches +20% higher.', { ramp: { per: 0.02, max: 0.2 } }),
      tier('Second Wind', 360, '+15% attack speed.', { rateMul: 1.15 }),
      tier('Maple Cascade', 1200, 'Ramp +16% per hit up to +150%; ignores 3 armor.', { ramp: { per: 0.04, max: 0.5 }, armorPen: 3 }),
      tier('Autumn Requiem', 3800, 'Ramp +20% per hit up to +200%; +30% attack speed, +8 damage; +30% damage.', { ramp: { per: 0.04, max: 0.5 }, rateMul: 1.3, damage: 8, damageMul: 1.3 }),
      tier('Crimson Eternity', 28000, '+24 damage, ramp +25% per hit up to +300%, ×1.5 vs bosses, +30% speed; +30% damage.', { damage: 24, ramp: { per: 0.05, max: 1 }, bossMul: 1.5, rateMul: 1.3, damageMul: 1.3 }),
    ]),
    path('flowing', 'Flowing Blade', 'Reach and precision', [
      tier('Light Step', 130, '+0.3 range.', { range: 0.3 }),
      tier('Flash Step', 340, '+4 damage.', { damage: 4 }),
      tier('Wind Severing', 1100, 'Air-cutting slashes reach flyers; +0.6 range.', { canHitAir: true, range: 0.6 }),
      tier('Iaijutsu Master', 3500, '+20% crit chance at ×2.5, +10 damage; +30% damage.', { crit: { chance: 0.2, mul: 2.5 }, damage: 10, damageMul: 1.3 }),
      tier('Thousand Leaves Draw', 25000, '+60% attack speed, +16 damage, +15% crits at ×3, +0.5 range; +40% damage.', { rateMul: 1.6, damage: 16, crit: { chance: 0.15, mul: 3 }, range: 0.5, damageMul: 1.4 }),
    ]),
    path('breaker', 'Guard Breaker', 'Armor and stuns', [
      tier('Heavy Hilt', 140, '+3 damage.', { damage: 3 }),
      tier('Pommel Strike', 320, '15% chance to stun for 0.2s.', { status: [S.stun(0.2, 0.15)] }),
      tier('Armor Cleaver', 1150, 'Slices plate open for everyone (-2 armor, stacks ×3); ignores 4 armor.', { status: [S.shred(2, 4)], armorPen: 4 }),
      tier('Guard Breaker', 3600, 'Brittle +20%, 25% stun for 0.5s, cracks armor (-3, stacks ×3), +6 damage; +30% damage.', { status: [S.vulnerable(0.2, 3), S.stun(0.5, 0.25), S.shred(3, 4)], damage: 6, damageMul: 1.3 }),
      tier('Heaven-Splitting Strike', 27000, '+60 damage, shred -6 (×3: -18 armor), ×1.4 vs elites, ×1.3 vs bosses, ignores 2 armor; +45% damage.', { damage: 60, status: [S.shred(6, 6)], eliteMul: 1.4, bossMul: 1.3, armorPen: 2, damageMul: 1.45 }),
    ]),
  ],
  awakenPassive: {
    name: 'Maple Resolve',
    desc: 'Ramp +2% per hit (+20% max) and +10% against elites.',
    mods: { ramp: { per: 0.02, max: 0.2 }, eliteMul: 1.1 },
  },
};

const CHIKA = {
  id: 'chika',
  name: 'Chika',
  title: 'Clockwork Mechanic',
  kind: 'tower',
  rarity: 'SSR',
  adult: false,
  role: 'engineer',
  attackType: 'pierce',
  element: 'lightning',
  placement: 'land',
  materialFamily: 'cog',
  capabilities: ['summon', 'antiAir'],
  pathCapabilities: ['buff', 'cleanse', 'detection', 'armorPen', 'stun'],
  acquisition: GACHA_ONLY,
  palette: {
    hair: '#bd7647', hairShade: '#8f5530', eyes: '#eaba57', skin: '#ffe5d4',
    outfit: '#38475f', outfitShade: '#26303f', accent: '#2f8f9a', halo: '#ffd166', weapon: '#adb5bd',
  },
  look: {
    hairStyle: 'short', bangs: 'messy', accessory: 'goggles', outfit: 'jumpsuit', weapon: 'wrench',
    halo: 'gear', eyeStyle: 'sparkle', expression: 'smile',
  },
  bio: 'The robotics club\'s youngest genius. Short orange hair under teal goggles, a mustard shirt and navy overalls covered in pockets, a satchel of spare parts and a wrench almost as big as she is. She builds sentries faster than anyone can name them.',
  personality: 'Fast-talking and endlessly inventive; names every drone and grieves each one dramatically.',
  quote: 'Give me ten seconds and a wrench!',
  tips: [
    'Her drones fly out to hunt up to 4 tiles away — tap one to see its stats.',
    'Flight modes: Hover near her, Hold a point, Patrol between two points, or Pursuit anywhere on the map.',
    'Repair Bay tier 3 cleanses sabotage for every girl in her aura.',
    'Tesla Tower (tier 4) turns her wrench bolt into a chain-lightning coil; her drones keep flying.',
  ],
  base: stats({
    cost: 650, behavior: 'projectile', damage: 2, rate: 0.8, range: 3.0, projectileSpeed: 16,
    canHitAir: true,
    turret: {
      max: 2, damage: 3, rate: 1.5, range: 1.0, leash: 4.0, speed: 3.5, build: 4, attackType: 'pierce', status: [S.shock(0.1, 0.15)],
    },
  }),
  paths: [
    path('sentry', 'Sentry Works', 'More and better drones', [
      tier('Spare Parts', 160, '+1 drone (3 at once).', { turret: { max: 1 } }),
      tier('Better Barrels', 380, 'Drones +2 damage.', { turret: { damage: 2 } }),
      tier('Sentry Grid', 1200, '+2 drones; drones fire 20% faster and fly 0.25 tiles farther.', { turret: { max: 2, leash: 0.25, rate: 1.2 } }),
      tier('Plasma Sentries', 3600, 'Drones +7 damage and fire 25% faster; her own bolt +30% damage.', { turret: { damage: 7, rate: 1.25 }, damageMul: 1.3 }),
      tier('Mecha-Fortress Protocol', 32500, '+4 drones (9 at once), +20 drone damage, +30% fire rate; drones fly 0.5 tiles farther and faster; ×1.25 vs bosses.', { turret: { max: 4, damage: 20, rate: 1.3, leash: 0.5, speed: 1 }, bossMul: 1.25 }),
    ]),
    path('repair', 'Repair Bay', 'Cleanse and buffs', [
      tier('Toolbelt', 140, 'Girls within 2.6 tiles attack 5% faster.', { aura: { range: 2.6, rateMul: 1.05 } }),
      tier('Pit Crew', 320, 'Aura reaches 3 tiles and gives +5% range.', { aura: { range: 3, rangeMul: 1.05 } }),
      tier('Field Repairs', 1100, 'Aura cleanses sabotage and disables; +10% attack speed.', { aura: { cleanse: true, rateMul: 1.1 } }),
      tier('Signal Tower', 3400, 'Radar: aura grants Veil Sight and +10% range. Tune-up: links 1 girl in her aura for +40% attack speed, +15% damage and +2 armor pen.', { aura: { detection: true, rangeMul: 1.1 }, link: { targets: 1, rateMul: 1.4, dmgMul: 1.15, armorPen: 2 } }),
      tier('Grand Workshop', 19000, 'Tune-up links 2 girls: +60% attack speed, +30% damage, +4 armor pen; every 20s she overclocks them for 6s (×1.25: double speed). Aura: 8% cheaper upgrades; +2 drones.', { aura: { costCut: 0.08 }, turret: { max: 2 }, link: { targets: 2, rateMul: 1.143, dmgMul: 1.13, armorPen: 2, overclock: { every: 20, time: 6, rateMul: 1.25 } } }),
    ]),
    path('tesla', 'Tesla Engineering', 'Lightning conversion', [
      tier('Copper Coils', 130, 'Drones +1 damage.', { turret: { damage: 1 } }),
      tier('Arc Capacitors', 300, 'Drones fire 20% faster.', { turret: { rate: 1.2 } }),
      tier('Storm Battery', 1000, 'Drones +3 damage and fly 0.25 tiles farther; Chika\'s own shots shock (25%).', { turret: { damage: 3, leash: 0.25 }, status: [S.shock(0.25, 0.25)] }),
      tier('Tesla Tower', 3300, 'Her wrench bolt becomes a tesla coil: mystic lightning chains through 5 enemies, ignoring 4 armor; +25% damage. Her drones keep flying.', { behavior: 'chain', attackType: 'mystic', rateMul: 1.25, chain: 4, damage: 7, armorPen: 4, damageMul: 1.25 }),
      tier('Thunderforge Reactor', 25000, '+6 jumps, +24 damage, +50% attack speed, 30% stun for 0.5s, ×1.6 vs bosses, drones +2 damage; +30% damage.', { chain: 6, damage: 24, rateMul: 1.5, status: [S.stun(0.5, 0.3)], bossMul: 1.6, turret: { damage: 2 }, damageMul: 1.3 }),
    ]),
  ],
  awakenPassive: {
    name: 'Prototype Mk-II',
    desc: '+1 drone; drones +2 damage.',
    mods: { turret: { max: 1, damage: 2 } },
  },
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/** Every unit, heroes first, then towers in roster-table order. */
export const UNITS = [
  HIKARI, LUNA, NAMI,
  AOI, REI, YUKI, MOMO, AKANE, SANGO, KAGE, UMEKO, SHIRO, MIDORI, SUZU, RAIKA, MIKO, HOTARU, KAEDE, CHIKA,
];

/** id -> UnitDef */
export const UNIT_MAP = Object.fromEntries(UNITS.map((u) => [u.id, u]));

/** All unit ids in roster order. */
export const UNIT_IDS = UNITS.map((u) => u.id);

/**
 * Look up a unit definition.
 * @param {string} id unit id, e.g. 'aoi'
 * @returns {object} UnitDef
 * @throws {Error} when the id is unknown
 */
export function getUnit(id) {
  const u = UNIT_MAP[id];
  if (!u) throw new Error(`Unknown unit: ${id}`);
  return u;
}

/** @returns {object[]} every UnitDef with kind === 'tower' */
export function towers() {
  return UNITS.filter((u) => u.kind === 'tower');
}

/** @returns {object[]} every UnitDef with kind === 'hero' */
export function heroes() {
  return UNITS.filter((u) => u.kind === 'hero');
}

/**
 * Units of one rarity (gacha pool helper).
 * @param {'R'|'SR'|'SSR'} rarity
 * @param {{ kind?: 'tower'|'hero'|null }} [opts] optionally restrict to towers or heroes
 * @returns {object[]}
 */
export function unitsByRarity(rarity, { kind = null } = {}) {
  return UNITS.filter((u) => u.rarity === rarity && (!kind || u.kind === kind));
}

/**
 * Free recruits keyed by the stage whose first clear grants them.
 * @returns {Object<string, string[]>} e.g. { '1-2': ['yuki'], '1-5': ['nami', 'sango'], ... }
 */
export function freeUnlocksByStage() {
  const out = {};
  for (const u of UNITS) {
    if (u.acquisition.type !== 'free') continue;
    (out[u.acquisition.afterStage] ||= []).push(u.id);
  }
  return out;
}

/**
 * Does the unit offer a capability (CAPABILITIES key)?
 * @param {object|string} unit UnitDef or id
 * @param {string} cap capability key, e.g. 'detection'
 * @param {{ includePaths?: boolean }} [opts] also count capabilities reachable through upgrades (default true)
 * @returns {boolean}
 */
export function hasCapability(unit, cap, { includePaths = true } = {}) {
  const u = typeof unit === 'string' ? getUnit(unit) : unit;
  return u.capabilities.includes(cap) || (includePaths && u.pathCapabilities.includes(cap));
}

/**
 * Units that counter a mechanic, base-capability owners first.
 * @param {string} cap capability key
 * @param {{ includePaths?: boolean, kind?: 'tower'|'hero'|null }} [opts]
 * @returns {object[]}
 */
export function unitsWithCapability(cap, { includePaths = true, kind = null } = {}) {
  const list = UNITS.filter((u) => (!kind || u.kind === kind) && hasCapability(u, cap, { includePaths }));
  return list.sort((a, b) => Number(b.capabilities.includes(cap)) - Number(a.capabilities.includes(cap)));
}

/**
 * Cost of one upgrade tier.
 * @param {object|string} unit UnitDef or id
 * @param {number} pathIndex 0..2
 * @param {number} tierNumber 1..5
 * @returns {number} battle coins (before difficulty/aura discounts)
 */
export function tierCost(unit, pathIndex, tierNumber) {
  const u = typeof unit === 'string' ? getUnit(unit) : unit;
  const t = u.paths[pathIndex]?.tiers[tierNumber - 1];
  if (!t) throw new Error(`No tier ${tierNumber} in path ${pathIndex} of ${u.id}`);
  return t.cost;
}

/**
 * Total coins to buy a path up to a tier (excluding the placement cost).
 * @param {object|string} unit UnitDef or id
 * @param {number} pathIndex 0..2
 * @param {number} tierNumber 0..5
 * @returns {number}
 */
export function pathCostTo(unit, pathIndex, tierNumber) {
  const u = typeof unit === 'string' ? getUnit(unit) : unit;
  return u.paths[pathIndex].tiers.slice(0, tierNumber).reduce((sum, t) => sum + t.cost, 0);
}
