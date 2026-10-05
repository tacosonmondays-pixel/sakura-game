// Sakura Sentinels — the bestiary (owner: world). See CONTRACTS.md §4 and docs/BESTIARY.md.
//
// 12 families, 74 enemies. Readability rules (CONTRACTS §12):
// * Ordinary enemies have exactly ONE rule — one trait, or none for plain fodder (their armor
//   class is their only quirk). Flat armor counts as the 'armored' rule.
// * Elites combine at most two familiar rules.
// * Minibosses and bosses telegraph every phase with an `announce` line.
// * Slimes are fragile coloured mimics: each copies ONE rule from another family.
//
// Numbers are before stage hpScale / difficulty (balance anchors in CONTRACTS §5b):
// hp, speed (tiles/s), armor (flat per hit), bounty (coins), leak (lives), threat (wave budget).
//
// Model hints for the 3D modeller: `model.base` is the family body, `variant` a short shape
// keyword and `props` a list from this vocabulary:
//   helmet, hood, crown, tiara, horns, mask, goggles, scarf, cape, wings, tail, mane, tusks,
//   shield, towerShield, club, axe, spear, sword, scythe, staff, lantern, bomb, smokePot,
//   backpack, wrench, drum, fan, mirror, chains, candle, bell, gears, chimney, cannon, crystals,
//   shell, leaves, flower, thorns, moss, mushroom, bubble, pearl, sparkle, ember, glider, bones.

/** @typedef {import('./types.js')} Types */

export const FAMILIES = {
  slime: {
    id: 'slime', name: 'Slimes', color: '#7bd389',
    desc: 'Wobbly jelly creatures that soak up the colour — and one rule — of whatever lives nearby.',
    behavior: 'Fragile mimics. Each colour copies exactly one trait from another family: gold runs, violet hides, iron wears plate, rose drinks its neighbours.',
  },
  goblin: {
    id: 'goblin', name: 'Goblins', color: '#a3c43a',
    desc: 'Quick, greedy tinkerers who never walk when they can sprint.',
    behavior: 'Fast runners. Some throw smoke (veiled), some sabotage girls, some carry bombs.',
  },
  orc: {
    id: 'orc', name: 'Orcs', color: '#6f8a5a',
    desc: 'Slow, stubborn warriors in heavy iron.',
    behavior: 'Tanky and armored. Shieldbearers guard the soldiers around them.',
  },
  ghost: {
    id: 'ghost', name: 'Ghosts', color: '#a8e6ff',
    desc: 'Lost lantern-lights of the Moonveil Shrine.',
    behavior: 'Spectral bodies shrug off blades and arrows. Some vanish behind veils, some phase out of reality.',
  },
  ghoul: {
    id: 'ghoul', name: 'Ghouls', color: '#8e7cc3',
    desc: 'Hungry marsh dead that steal life and slip through the fog.',
    behavior: 'Siphon health from nearby allies or blink forward along the path.',
  },
  oni: {
    id: 'oni', name: 'Oni', color: '#ff6b6b',
    desc: 'Festival demons who empower everyone around them.',
    behavior: 'Project haste, shield or regen fields. Holy hits silence the field for a moment.',
  },
  lizard: {
    id: 'lizard', name: 'Lizardfolk', color: '#e0a458',
    desc: 'Scaled lakeshore hunters, at home in reeds and shallow water.',
    behavior: 'Scaled hides (pierce finds the gaps). Hunters regenerate; sunscales shrug off fire.',
  },
  construct: {
    id: 'construct', name: 'Constructs', color: '#8a94a6',
    desc: 'Clockwork and crystal machines from the Foundry.',
    behavior: 'Heavy bodies with crystal shells (cap damage per hit) or barriers (break with blast).',
  },
  beast: {
    id: 'beast', name: 'Beasts', color: '#c08552',
    desc: 'Mountain wildlife driven mad by the dragon smoke.',
    behavior: 'Wolves grow furious as packmates fall; boars charge in bursts.',
  },
  fae: {
    id: 'fae', name: 'Fae', color: '#c77dff',
    desc: 'Mischievous festival spirits wrapped in glamour.',
    behavior: 'Warded against mystic magic. Illusionists spawn decoys that soak up shots.',
  },
  plant: {
    id: 'plant', name: 'Plants', color: '#5aa469',
    desc: 'Bog flora that walked out of the Gloomfen.',
    behavior: 'Seed pods burst into sprouts, thornroots wear bark armor, mosslings regrow.',
  },
  dragon: {
    id: 'dragon', name: 'Dragons', color: '#ff7f3f',
    desc: 'The brood of the Ashwing Matriarch.',
    behavior: 'Scaled and often airborne. Fire-warded ashdrakes laugh at burns.',
  },
};

export const FAMILY_ORDER = ['slime', 'goblin', 'orc', 'ghost', 'ghoul', 'oni', 'lizard', 'construct', 'beast', 'fae', 'plant', 'dragon'];

const DEFAULT_LEAK = { normal: 1, elite: 5, miniboss: 25, boss: Infinity };

/**
 * Fills defaults so every EnemyDef has the full contract shape.
 * @param {object} o partial EnemyDef
 * @returns {object} EnemyDef
 */
function enemy(o) {
  const tier = o.tier || 'normal';
  return {
    id: o.id,
    name: o.name,
    family: o.family,
    tier,
    hp: o.hp,
    speed: o.speed ?? 1,
    armorClass: o.armorClass,
    armor: o.armor ?? 0,
    bounty: o.bounty ?? 1,
    leak: o.leak ?? DEFAULT_LEAK[tier],
    threat: o.threat ?? 1,
    size: o.size ?? 0.8,
    color: o.color,
    accent: o.accent,
    model: { base: o.family, variant: o.variant || 'basic', props: o.props || [] },
    traits: o.traits || {},
    ...(o.phases ? { phases: o.phases } : {}),
    lore: o.lore,
    counters: o.counters,
    introducedIn: o.introducedIn,
  };
}

// ---------------------------------------------------------------------------
// Slimes — light, fragile, one borrowed rule each
// ---------------------------------------------------------------------------

const SLIMES = [
  enemy({
    id: 'slime_green', name: 'Green Slime', family: 'slime', hp: 14, speed: 1.0, armorClass: 'light',
    bounty: 1, threat: 1, size: 0.7, color: '#7bd389', accent: '#c9f5c0', variant: 'drop', props: [],
    lore: 'The first thing every sentinel ever defeats. It mostly wants to be petted.',
    counters: 'Anything works. A single Aoi handles the early waves.',
    introducedIn: '1-1',
  }),
  enemy({
    id: 'slime_droplet', name: 'Slime Droplet', family: 'slime', hp: 5, speed: 1.3, armorClass: 'light',
    bounty: 0, threat: 0.4, size: 0.6, color: '#b8f2e6', accent: '#ffffff', variant: 'droplet', props: [],
    lore: 'A tiny blob shaken loose from a bigger slime. It bounces faster than it thinks.',
    counters: 'Splash and pierce mop them up; Rei at a corner deletes whole puddles.',
    introducedIn: '2-3',
  }),
  enemy({
    id: 'slime_gold', name: 'Gold Slime', family: 'slime', hp: 12, speed: 1.15, armorClass: 'light',
    bounty: 3, threat: 1.6, size: 0.7, color: '#ffd23f', accent: '#fff3b0', variant: 'drop', props: ['sparkle'],
    traits: { hasty: { mul: 2, every: 4, duration: 1.2 } },
    lore: 'Borrowed a goblin\'s sprint and a little of its greed. Shines brightest mid-dash.',
    counters: 'Hasty: Yuki\'s slow cancels the burst value; keep a second shooter near the exit.',
    introducedIn: '1-3',
  }),
  enemy({
    id: 'slime_pearl', name: 'Pearl Slime', family: 'slime', hp: 20, speed: 0.9, armorClass: 'light',
    bounty: 3, threat: 1.8, size: 0.72, color: '#f2e9e4', accent: '#c9ada7', variant: 'drop', props: ['pearl'],
    traits: { regen: { pct: 0.04, delay: 2 } },
    lore: 'Grew a lizard\'s knack for healing while sunning on lakeshore stones.',
    counters: 'Regenerating: keep it under steady fire so it never gets 2 quiet seconds. Poison stops it outright.',
    introducedIn: '2-1',
  }),
  enemy({
    id: 'slime_prism', name: 'Prism Slime', family: 'slime', hp: 28, speed: 0.95, armorClass: 'light',
    bounty: 4, threat: 3, size: 0.85, color: '#ff8fd8', accent: '#8fe3ff', variant: 'rainbow', props: ['sparkle'],
    traits: { splitter: { spawn: 'slime_droplet', count: 3 } },
    lore: 'A rainbow slime that refracts into three droplets when it pops.',
    counters: 'Splitter: finish it early on the path, or let splash and pierce catch the droplets.',
    introducedIn: '2-3',
  }),
  enemy({
    id: 'slime_violet', name: 'Violet Slime', family: 'slime', hp: 16, speed: 1.0, armorClass: 'light',
    bounty: 3, threat: 2, size: 0.7, color: '#9d4edd', accent: '#e0aaff', variant: 'drop', props: ['sparkle'],
    traits: { veiled: true },
    lore: 'Soaked in shrine incense until it learned to fade like a ghost.',
    counters: 'Veiled: needs Veil Sight — Kage, Hikari, or anyone inside Umeko\'s aura.',
    introducedIn: '3-2',
  }),
  enemy({
    id: 'slime_iron', name: 'Iron Slime', family: 'slime', hp: 22, speed: 0.9, armorClass: 'light', armor: 2,
    bounty: 5, threat: 2.5, size: 0.75, color: '#7d8597', accent: '#c0c7d1', variant: 'drop', props: ['helmet'],
    lore: 'Swallowed an orc helmet and decided it was armor now.',
    counters: 'Armored (2): weak chip damage bounces off. Use Shiro\'s armor pierce or Sango\'s shells.',
    introducedIn: '4-1',
  }),
  enemy({
    id: 'slime_rose', name: 'Rose Slime', family: 'slime', hp: 20, speed: 0.95, armorClass: 'light',
    bounty: 6, threat: 2.5, size: 0.72, color: '#ff5d8f', accent: '#ffc2d4', variant: 'drop', props: ['flower'],
    traits: { siphon: { radius: 1.5, rate: 2 } },
    lore: 'Learned to drink from its neighbours by hanging around marsh ghouls.',
    counters: 'Siphon: poison it (Midori) or snipe it first with Priority targeting.',
    introducedIn: '5-1',
  }),
  enemy({
    id: 'slime_crystal', name: 'Quartz Slime', family: 'slime', hp: 24, speed: 0.9, armorClass: 'light',
    bounty: 9, threat: 2.5, size: 0.75, color: '#a5f3fc', accent: '#e0fbff', variant: 'drop', props: ['crystals'],
    traits: { crystal: { cap: 4, hits: 8 } },
    lore: 'Slept in a Foundry crystal vat and woke up wearing it.',
    counters: 'Crystal Shell: many small hits shatter it — Aoi, Kage and Raika love these.',
    introducedIn: '6-1',
  }),
  enemy({
    id: 'slime_ember', name: 'Ember Slime', family: 'slime', hp: 18, speed: 1.0, armorClass: 'light',
    bounty: 6, threat: 2, size: 0.72, color: '#ff7b00', accent: '#ffd29d', variant: 'drop', props: ['ember'],
    traits: { volatile: { radius: 1.4, stun: 1.2 } },
    lore: 'A slime that ate furnace coal. It pops like a firework — right next to your girls.',
    counters: 'Volatile: kill it far from your melee girls, or stand them inside a cleanse aura.',
    introducedIn: '6-4',
  }),
  enemy({
    id: 'slime_mimic', name: 'Mimic Slime', family: 'slime', hp: 40, speed: 0.9, armorClass: 'light',
    bounty: 18, threat: 4, size: 0.85, color: '#c9a227', accent: '#6b4f1d', variant: 'chest', props: ['shell'],
    traits: { decoy: { count: 2, every: 5, spawn: 'slime_glimmer' } },
    lore: 'Hides inside a festival prize chest and coughs up fake copies of itself.',
    counters: 'Illusionist: rapid multi-hit girls clear the glimmer decoys so your heavy hitters stay on the chest.',
    introducedIn: '7-3',
  }),
  enemy({
    id: 'slime_glimmer', name: 'Glimmer Copy', family: 'slime', hp: 6, speed: 1.2, armorClass: 'light',
    bounty: 0, leak: 0, threat: 0.5, size: 0.6, color: '#ffe066', accent: '#fff8d6', variant: 'droplet', props: ['sparkle'],
    lore: 'A shiny fake coughed up by a Mimic Slime. It pops on the first touch.',
    counters: 'Decoy: it never costs lives, but it soaks up shots. Rapid hitters clear them.',
    introducedIn: '7-3',
  }),
  enemy({
    id: 'slime_bubble', name: 'Bubble Slime', family: 'slime', hp: 16, speed: 1.0, armorClass: 'light',
    bounty: 9, threat: 2, size: 0.72, color: '#90e0ef', accent: '#ffffff', variant: 'bubble', props: ['bubble'],
    traits: { airborne: true },
    lore: 'Blew itself up like a balloon to follow the wyverns over the peaks.',
    counters: 'Airborne: Rei and other ground-only girls can\'t touch it. Aoi, Yuki and Kage can.',
    introducedIn: '8-1',
  }),
  enemy({
    id: 'slime_courtier', name: 'Royal Guard Slime', family: 'slime', tier: 'elite', hp: 180, speed: 0.8,
    armorClass: 'light', armor: 1, bounty: 18, threat: 14, size: 1.15, color: '#4ea8de', accent: '#ffd166',
    variant: 'knight', props: ['helmet', 'spear'],
    traits: { splitter: { spawn: 'slime_green', count: 3 } },
    lore: 'Sworn to the Slime Prince. When it falls, its jelly keeps marching as three green recruits.',
    counters: 'Light armor plus a split: steady damage first, then splash or a cleaver for the leftovers.',
    introducedIn: '1-5',
  }),
  enemy({
    id: 'slime_prince', name: 'Slime Prince', family: 'slime', tier: 'miniboss', hp: 2600, speed: 0.5,
    armorClass: 'light', bounty: 280, leak: 25, threat: 120, size: 2.2, color: '#48cae4', accent: '#ffd166',
    variant: 'royal', props: ['crown', 'cape'],
    traits: { splitter: { spawn: 'slime_courtier', count: 3 } },
    phases: [
      { atHp: 0.66, announce: 'The Slime Prince wobbles with rage — Gold Slimes spill from his cape!', set: { traits: { summoner: { spawn: 'slime_gold', count: 2, every: 5 } } } },
      { atHp: 0.33, announce: 'The Prince bounces into a royal sprint!', set: { speed: 0.7, traits: { hasty: { mul: 1.8, every: 5, duration: 1.5 } } } },
    ],
    lore: 'Heir to the Jelly Throne of Sakura Gardens. He insists the garden is his by right of being very large.',
    counters: 'Pile damage on him early. When he pops he becomes three Royal Guards — keep a cleaver or splash near the exit.',
    introducedIn: '1-5',
  }),
];

// ---------------------------------------------------------------------------
// Goblins — light and fast
// ---------------------------------------------------------------------------

const GOBLINS = [
  enemy({
    id: 'goblin_runner', name: 'Goblin Runner', family: 'goblin', hp: 10, speed: 1.7, armorClass: 'light',
    bounty: 1, threat: 1, size: 0.7, color: '#a3c43a', accent: '#6b4226', variant: 'scout', props: ['scarf'],
    lore: 'Steals one sakura petal per run and is extremely proud of it.',
    counters: 'Runner: fast and fragile. Place shooters near the start and the end so none slip past.',
    introducedIn: '1-2',
  }),
  enemy({
    id: 'goblin_dasher', name: 'Goblin Dasher', family: 'goblin', hp: 14, speed: 1.5, armorClass: 'light',
    bounty: 1, threat: 2, size: 0.72, color: '#c5d86d', accent: '#e85d04', variant: 'scout', props: ['goggles', 'scarf'],
    traits: { hasty: { mul: 2.2, every: 3.5, duration: 1 } },
    lore: 'Wears racing goggles it found in a festival lost-and-found. Bursts ahead every few seconds.',
    counters: 'Hasty: Yuki\'s slow and freeze turn the sprint into a stroll.',
    introducedIn: '1-3',
  }),
  enemy({
    id: 'goblin_smoke', name: 'Smoke Thrower', family: 'goblin', hp: 18, speed: 1.4, armorClass: 'light',
    bounty: 3, threat: 2.5, size: 0.72, color: '#6c757d', accent: '#adb5bd', variant: 'scout', props: ['hood', 'smokePot'],
    traits: { veiled: true },
    lore: 'Hurls pots of shrine incense and runs inside the cloud.',
    counters: 'Veiled: Kage and Hikari see through smoke; Umeko shares Veil Sight with her neighbours.',
    introducedIn: '3-2',
  }),
  enemy({
    id: 'goblin_sapper', name: 'Goblin Sapper', family: 'goblin', hp: 30, speed: 1.3, armorClass: 'light',
    bounty: 11, threat: 4, size: 0.75, color: '#8d6e3f', accent: '#ffd43b', variant: 'tinker', props: ['wrench', 'backpack'],
    traits: { sabotage: { radius: 1.6, duration: 3, cooldown: 6 } },
    lore: 'Jams a wrench into anything that looks important — including your girls\' weapons.',
    counters: 'Sabotage: Suzu\'s traps catch sappers before they reach anyone; Hikari\'s banner cleanses.',
    introducedIn: '6-3',
  }),
  enemy({
    id: 'goblin_bomber', name: 'Goblin Bomber', family: 'goblin', hp: 26, speed: 1.25, armorClass: 'light',
    bounty: 9, threat: 3, size: 0.75, color: '#bc4749', accent: '#2b2d42', variant: 'tinker', props: ['bomb'],
    traits: { volatile: { radius: 1.6, stun: 1.5 } },
    lore: 'Carries a powder keg twice its size. Nobody has told it the keg is the dangerous part.',
    counters: 'Volatile: pop it at range, away from melee girls, or protect them with a cleanse aura.',
    introducedIn: '6-4',
  }),
  enemy({
    id: 'goblin_glider', name: 'Goblin Glider', family: 'goblin', hp: 20, speed: 1.5, armorClass: 'light',
    bounty: 12, threat: 3, size: 0.75, color: '#90be6d', accent: '#f9c74f', variant: 'scout', props: ['glider', 'goggles'],
    traits: { airborne: true },
    lore: 'Built wings from paper lanterns and a stolen kite. Somehow it works.',
    counters: 'Airborne: needs anti-air — Aoi, Kage, Yuki, Shiro or Nami.',
    introducedIn: '8-2',
  }),
  enemy({
    id: 'goblin_chief', name: 'Goblin Chieftain', family: 'goblin', tier: 'elite', hp: 240, speed: 1.2,
    armorClass: 'light', bounty: 90, threat: 16, size: 1.1, color: '#588157', accent: '#ffb703',
    variant: 'chief', props: ['crown', 'club'],
    traits: { hasty: { mul: 1.8, every: 5, duration: 1.2 }, summoner: { spawn: 'goblin_runner', count: 2, every: 5 } },
    lore: 'Leads from the front, mostly by running faster than everyone else and yelling for backup.',
    counters: 'Hasty summoner: slow it and snipe it with Priority targeting before the runners pile up.',
    introducedIn: '6-5',
  }),
  enemy({
    id: 'goblin_machine', name: 'Goblin Machine', family: 'goblin', tier: 'miniboss', hp: 3000, speed: 0.5,
    armorClass: 'heavy', armor: 4, bounty: 1300, leak: 25, threat: 150, size: 2.4, color: '#b08968', accent: '#ffd43b',
    variant: 'machine', props: ['gears', 'chimney', 'cannon'],
    traits: { barrier: { hp: 900, regenDelay: 6 }, summoner: { spawn: 'goblin_runner', count: 3, every: 6 } },
    phases: [
      { atHp: 0.6, announce: 'Barrier reboot! The Goblin Machine\'s shield generator roars back to life!', set: { traits: { barrier: { hp: 1200, regenDelay: 5 }, summoner: { spawn: 'goblin_dasher', count: 3, every: 6 } } } },
      { atHp: 0.25, announce: 'Overdrive — the Machine vents steam and launches Sappers!', set: { speed: 0.75, traits: { summoner: { spawn: 'goblin_sapper', count: 2, every: 7 } } } },
    ],
    lore: 'Forty goblins, one stolen boiler and zero safety inspections. It walks, it shields, it honks.',
    counters: 'Break the barrier with blast (Sango, Suzu) then crack the plate with armor pierce. Traps and a cleanse handle the sappers it launches.',
    introducedIn: '6-5',
  }),
];

// ---------------------------------------------------------------------------
// Orcs — heavy and tanky
// ---------------------------------------------------------------------------

const ORCS = [
  enemy({
    id: 'orc_grunt', name: 'Orc Grunt', family: 'orc', hp: 45, speed: 0.75, armorClass: 'heavy',
    bounty: 4, threat: 3.5, size: 1.0, color: '#6f8a5a', accent: '#8d6e63', variant: 'grunt', props: ['club'],
    lore: 'A big, patient lump of muscle. Has no armor yet — just a lot of health.',
    counters: 'Plain tank: focus fire and upgrade damage. Blast and mystic hit heavy bodies hardest.',
    introducedIn: '1-4',
  }),
  enemy({
    id: 'orc_ironhide', name: 'Ironhide Orc', family: 'orc', hp: 60, speed: 0.7, armorClass: 'heavy', armor: 3,
    bounty: 13, threat: 5, size: 1.05, color: '#52734d', accent: '#9aa5b1', variant: 'soldier', props: ['helmet', 'axe'],
    lore: 'Bolted iron plates straight onto its skin. Small arrows just ping off.',
    counters: 'Armored (3): Shiro pierces it, Sango\'s shells shred it for everyone. Avoid chip damage.',
    introducedIn: '4-1',
  }),
  enemy({
    id: 'orc_shieldbearer', name: 'Orc Shieldbearer', family: 'orc', hp: 75, speed: 0.65, armorClass: 'heavy',
    bounty: 16, threat: 7, size: 1.1, color: '#3a5a40', accent: '#dda15e', variant: 'soldier', props: ['towerShield', 'helmet'],
    traits: { guardian: { radius: 1.6, reduction: 0.35 } },
    lore: 'Holds a tower shield over its comrades. It does not protect itself, which it finds noble.',
    counters: 'Guardian: allies near it take 35% less — except from blast. Shell the formation or snipe the shieldbearer first.',
    introducedIn: '4-3',
  }),
  enemy({
    id: 'orc_berserker', name: 'Orc Berserker', family: 'orc', hp: 55, speed: 0.85, armorClass: 'heavy',
    bounty: 12, threat: 5, size: 1.0, color: '#9b2226', accent: '#e9d8a6', variant: 'berserker', props: ['axe', 'mane'],
    traits: { enrage: { mul: 0.15, max: 0.9 } },
    lore: 'Paints itself red before battle. Every fallen orc nearby makes it run harder.',
    counters: 'Pack Fury: kill the pack evenly with splash, or slow it so the fury doesn\'t matter.',
    introducedIn: '4-2',
  }),
  enemy({
    id: 'orc_warlord', name: 'Orc Warlord', family: 'orc', tier: 'elite', hp: 380, speed: 0.6, armorClass: 'heavy', armor: 5,
    bounty: 80, threat: 24, size: 1.35, color: '#344e41', accent: '#ffb703', variant: 'warlord', props: ['helmet', 'towerShield', 'cape'],
    traits: { guardian: { radius: 1.8, reduction: 0.3 } },
    lore: 'A veteran of a hundred sieges with a shield the size of a door.',
    counters: 'Armored guardian: armor break (Sango) or Shiro\'s pierce, then blast the escort while the guard is up.',
    introducedIn: '4-4',
  }),
  enemy({
    id: 'orc_general', name: 'Orc General', family: 'orc', tier: 'miniboss', hp: 3400, speed: 0.45, armorClass: 'heavy', armor: 6,
    bounty: 840, leak: 25, threat: 160, size: 2.4, color: '#283618', accent: '#ffd166', variant: 'general', props: ['helmet', 'cape', 'sword', 'towerShield'],
    traits: { guardian: { radius: 2, reduction: 0.3 } },
    phases: [
      { atHp: 0.6, announce: 'The Orc General plants his tower shield — armor and guard surge!', set: { armor: 10, speed: 0.35, traits: { guardian: { radius: 2.4, reduction: 0.5 } } } },
      { atHp: 0.3, announce: 'The General throws down his shield and charges in a berserk rage!', set: { armor: 2, speed: 0.8, traits: { guardian: null, hasty: { mul: 1.7, every: 4, duration: 1.5 } } } },
    ],
    lore: 'Commander of the Ironhold garrison. Believes retreat is a word for other people.',
    counters: 'Phase 2 armor 10: only armor pierce and shred matter — stack Shiro and Sango. Phase 3 he sprints: have Yuki ready.',
    introducedIn: '4-5',
  }),
];

// ---------------------------------------------------------------------------
// Ghosts — spectral
// ---------------------------------------------------------------------------

const GHOSTS = [
  enemy({
    id: 'ghost_wisp', name: 'Shrine Wisp', family: 'ghost', hp: 12, speed: 1.25, armorClass: 'spectral',
    bounty: 2, threat: 1.2, size: 0.6, color: '#caf0f8', accent: '#90e0ef', variant: 'wisp', props: ['candle'],
    lore: 'A candle flame that forgot to go out. Arrows pass through it like mist.',
    counters: 'Spectral: pierce and slash do half damage. Holy (Hikari) and mystic (Yuki) work well.',
    introducedIn: '3-1',
  }),
  enemy({
    id: 'ghost_veilwraith', name: 'Veil Wraith', family: 'ghost', hp: 24, speed: 1.0, armorClass: 'spectral',
    bounty: 4, threat: 3, size: 0.85, color: '#bde0fe', accent: '#4361ee', variant: 'wraith', props: ['hood'],
    traits: { veiled: true },
    lore: 'Wears the shrine\'s mourning veil. Unless you can see spirits, it isn\'t there at all.',
    counters: 'Veiled + spectral: Kage spots it, Hikari\'s holy light burns it.',
    introducedIn: '3-1',
  }),
  enemy({
    id: 'ghost_phantom', name: 'Phantom', family: 'ghost', hp: 30, speed: 0.95, armorClass: 'spectral',
    bounty: 5, threat: 3, size: 0.85, color: '#e0c3fc', accent: '#7b2cbf', variant: 'wraith', props: ['chains'],
    traits: { phasing: { every: 4, duration: 1.5 } },
    lore: 'Flickers between this world and the next every few heartbeats.',
    counters: 'Phasing: while intangible only holy and mystic hits land. A holy hit snaps it back.',
    introducedIn: '3-3',
  }),
  enemy({
    id: 'ghost_lanternbearer', name: 'Lantern Bearer', family: 'ghost', tier: 'elite', hp: 220, speed: 0.75, armorClass: 'spectral',
    bounty: 38, threat: 16, size: 1.15, color: '#ffe8a3', accent: '#ff9e00', variant: 'bearer', props: ['lantern', 'hood'],
    traits: { veiled: true, summoner: { spawn: 'ghost_wisp', count: 2, every: 6 } },
    lore: 'Carries the lantern that calls lost wisps home — straight down your path.',
    counters: 'Veiled summoner: you need Veil Sight to touch it at all. Snipe it with Priority so the wisps stop coming.',
    introducedIn: '3-4',
  }),
  enemy({
    id: 'ghost_hollowknight', name: 'Hollow Samurai', family: 'ghost', tier: 'elite', hp: 260, speed: 0.7, armorClass: 'spectral', armor: 2,
    bounty: 46, threat: 16, size: 1.25, color: '#adb5bd', accent: '#d00000', variant: 'samurai', props: ['helmet', 'sword', 'mask'],
    traits: { phasing: { every: 5, duration: 1.5 } },
    lore: 'Empty armor still guarding a shrine that fell long ago.',
    counters: 'Armored and phasing: holy damage ignores the phase and hits spirits ×2.',
    introducedIn: '3-5',
  }),
];

// ---------------------------------------------------------------------------
// Ghouls — spectral life-stealers and blinkers
// ---------------------------------------------------------------------------

const GHOULS = [
  enemy({
    id: 'ghoul_bonewalker', name: 'Bonewalker', family: 'ghoul', hp: 22, speed: 0.9, armorClass: 'spectral',
    bounty: 6, threat: 1.5, size: 0.75, color: '#e9e3d5', accent: '#6c584c', variant: 'skeleton', props: ['bones'],
    lore: 'Rattles out of the bog whenever something important calls.',
    counters: 'Plain spectral fodder: mystic and holy hit it fully.',
    introducedIn: '5-1',
  }),
  enemy({
    id: 'ghoul_shambler', name: 'Bog Shambler', family: 'ghoul', hp: 50, speed: 0.8, armorClass: 'spectral',
    bounty: 14, threat: 3, size: 0.95, color: '#6a994e', accent: '#386641', variant: 'shambler', props: ['moss'],
    lore: 'A marsh-soaked ghoul that keeps walking because nobody told it to stop.',
    counters: 'Plain but spectral: bring mystic or holy damage; pierce does half.',
    introducedIn: '5-1',
  }),
  enemy({
    id: 'ghoul_leech', name: 'Leech Ghoul', family: 'ghoul', hp: 45, speed: 0.85, armorClass: 'spectral',
    bounty: 13, threat: 4.5, size: 0.95, color: '#8e7cc3', accent: '#ff4d6d', variant: 'leech', props: ['chains'],
    traits: { siphon: { radius: 1.6, rate: 3 } },
    lore: 'Drinks the life out of whatever walks beside it, friend or not.',
    counters: 'Siphon: Midori\'s poison stops the healing; Priority targeting removes it first.',
    introducedIn: '5-1',
  }),
  enemy({
    id: 'ghoul_skulker', name: 'Fog Skulker', family: 'ghoul', hp: 35, speed: 0.9, armorClass: 'spectral',
    bounty: 10, threat: 4, size: 0.85, color: '#5e548e', accent: '#9fffcb', variant: 'skulker', props: ['hood'],
    traits: { blink: { every: 5, distance: 3 } },
    lore: 'Steps into the fog and out again three tiles later. Watch for the green mark.',
    counters: 'Blink: a slow, stun or silence during the warning cancels the jump.',
    introducedIn: '5-2',
  }),
  enemy({
    id: 'ghoul_gravepriest', name: 'Grave Priest', family: 'ghoul', tier: 'elite', hp: 320, speed: 0.7, armorClass: 'spectral',
    bounty: 90, threat: 20, size: 1.2, color: '#4a4e69', accent: '#c9184a', variant: 'priest', props: ['staff', 'hood', 'candle'],
    traits: { siphon: { radius: 1.8, rate: 4 }, summoner: { spawn: 'ghoul_bonewalker', count: 2, every: 6 } },
    lore: 'Chants the marsh dead awake and feeds on them as they rise.',
    counters: 'Siphoning summoner: poison it (no healing) and kill it with Priority before its congregation grows.',
    introducedIn: '5-4',
  }),
  enemy({
    id: 'grave_lych', name: 'Grave Lych', family: 'ghoul', tier: 'boss', hp: 12000, speed: 0.4, armorClass: 'spectral', armor: 3,
    bounty: 2000, threat: 400, size: 2.8, color: '#3c096c', accent: '#80ffdb', variant: 'lych', props: ['crown', 'staff', 'cape', 'candle'],
    traits: { regen: { pct: 0.01, delay: 3 }, summoner: { spawn: 'ghoul_bonewalker', count: 3, every: 7 } },
    phases: [
      { atHp: 0.7, announce: 'The Grave Lych slips between worlds — it begins to phase!', set: { traits: { phasing: { every: 6, duration: 2 } } } },
      { atHp: 0.4, announce: 'The Lych calls the Leech Ghouls to feed it!', set: { traits: { summoner: { spawn: 'ghoul_leech', count: 2, every: 6 }, regen: { pct: 0.015, delay: 2.5 } } } },
      { atHp: 0.15, announce: 'Its phylactery cracks — the Lych lurches for the exit!', set: { speed: 0.6, traits: { phasing: null } } },
    ],
    lore: 'Lord of the Gloomfen dead, crowned in candle-wax. It has been dying for three hundred years and is very good at it.',
    counters: 'Poison (Midori) shuts down its regeneration and its leeches; holy hits snap it out of phasing. Keep splash for the summons.',
    introducedIn: 'boss-lych',
  }),
];

// ---------------------------------------------------------------------------
// Oni — warded field casters
// ---------------------------------------------------------------------------

const ONI = [
  enemy({
    id: 'oni_brute', name: 'Oni Brute', family: 'oni', hp: 70, speed: 0.75, armorClass: 'warded',
    bounty: 32, threat: 4, size: 1.1, color: '#e63946', accent: '#f1faee', variant: 'brute', props: ['horns', 'club'],
    lore: 'Came for the festival food, stayed for the fighting.',
    counters: 'Warded: mystic does half. Pierce, slash, blast and holy all work.',
    introducedIn: '7-1',
  }),
  enemy({
    id: 'oni_haste', name: 'Wind Oni', family: 'oni', hp: 60, speed: 0.85, armorClass: 'warded',
    bounty: 28, threat: 6, size: 1.05, color: '#52b788', accent: '#d8f3dc', variant: 'caster', props: ['horns', 'fan'],
    traits: { field: { kind: 'haste', radius: 2, amount: 0.35 } },
    lore: 'Fans a festival wind that sends everyone nearby racing ahead.',
    counters: 'Haste field: snipe the caster with Priority, or silence it with a holy hit.',
    introducedIn: '7-1',
  }),
  enemy({
    id: 'oni_shield', name: 'Ward Oni', family: 'oni', hp: 65, speed: 0.75, armorClass: 'warded',
    bounty: 30, threat: 6, size: 1.05, color: '#457b9d', accent: '#a8dadc', variant: 'caster', props: ['horns', 'mask'],
    traits: { field: { kind: 'shield', radius: 2, amount: 0.35 } },
    lore: 'Its mask hums with a barrier that blunts every blow on its friends.',
    counters: 'Shield field (35% less damage nearby): kill the caster first — holy hits switch the field off.',
    introducedIn: '7-2',
  }),
  enemy({
    id: 'oni_bloom', name: 'Bloom Oni', family: 'oni', hp: 60, speed: 0.8, armorClass: 'warded',
    bounty: 28, threat: 6, size: 1.05, color: '#ff8fab', accent: '#ffe5ec', variant: 'caster', props: ['horns', 'flower'],
    traits: { field: { kind: 'regen', radius: 2, amount: 0.03 } },
    lore: 'Scatters festival petals that knit wounds closed.',
    counters: 'Regen field: poison blocks the healing; holy hits silence it.',
    introducedIn: '7-4',
  }),
  enemy({
    id: 'oni_taiko', name: 'Taiko Oni', family: 'oni', tier: 'elite', hp: 340, speed: 0.65, armorClass: 'warded', armor: 2,
    bounty: 160, threat: 22, size: 1.35, color: '#9d0208', accent: '#ffba08', variant: 'drummer', props: ['horns', 'drum'],
    traits: { field: { kind: 'haste', radius: 2.6, amount: 0.4 } },
    lore: 'Beats the festival drum so loudly the whole parade breaks into a run.',
    counters: 'Armored haste caster: Shiro on Priority, or a holy silence, before the parade outruns you.',
    introducedIn: '7-4',
  }),
  enemy({
    id: 'oni_champion', name: 'Oni Champion', family: 'oni', tier: 'miniboss', hp: 3200, speed: 0.5, armorClass: 'warded', armor: 3,
    bounty: 1840, leak: 25, threat: 170, size: 2.5, color: '#d00000', accent: '#ffd60a', variant: 'champion', props: ['horns', 'mask', 'club', 'cape'],
    traits: { field: { kind: 'haste', radius: 2.8, amount: 0.3 } },
    phases: [
      { atHp: 0.75, announce: 'The Oni Champion switches stance — a Shield field flares!', set: { traits: { field: { kind: 'shield', radius: 2.8, amount: 0.4 } } } },
      { atHp: 0.5, announce: 'Bloom stance — the Champion\'s field begins to heal its escort!', set: { traits: { field: { kind: 'regen', radius: 2.8, amount: 0.03 } } } },
      { atHp: 0.25, announce: 'Final stance — the Champion rotates Haste and Shield every few seconds!', set: { speed: 0.6, traits: { field: { kinds: ['haste', 'shield'], every: 5, radius: 3, amount: 0.35 } } } },
    ],
    lore: 'Undefeated grand champion of the Oni Festival tournament. Has never lost a staring contest.',
    counters: 'Holy hits silence each stance — Hikari next to the path is gold. Poison its regen stance; slow its haste stance.',
    introducedIn: '7-5',
  }),
];

// ---------------------------------------------------------------------------
// Lizardfolk — scaled
// ---------------------------------------------------------------------------

const LIZARDS = [
  enemy({
    id: 'lizard_skink', name: 'Reed Skink', family: 'lizard', hp: 22, speed: 1.25, armorClass: 'scaled',
    bounty: 3, threat: 1.8, size: 0.75, color: '#e0a458', accent: '#7f5539', variant: 'skink', props: ['tail'],
    lore: 'A young lakeshore scout, all tail and enthusiasm.',
    counters: 'Scaled: pierce (Aoi, Kage) finds the gaps for ×1.5; slash only ×0.75.',
    introducedIn: '2-1',
  }),
  enemy({
    id: 'lizard_hunter', name: 'Marsh Hunter', family: 'lizard', hp: 40, speed: 0.95, armorClass: 'scaled',
    bounty: 6, threat: 3.5, size: 0.95, color: '#606c38', accent: '#dda15e', variant: 'hunter', props: ['spear', 'tail'],
    traits: { regen: { pct: 0.05, delay: 2 } },
    lore: 'Wounds close over in seconds — a gift from the lake spirits, it says.',
    counters: 'Regenerating: concentrate fire so it never rests. Later, Midori\'s poison stops it cold.',
    introducedIn: '2-2',
  }),
  enemy({
    id: 'lizard_sunscale', name: 'Sunscale Warrior', family: 'lizard', hp: 50, speed: 0.9, armorClass: 'scaled',
    bounty: 7, threat: 4, size: 1.0, color: '#f4a261', accent: '#e76f51', variant: 'warrior', props: ['shield', 'tail'],
    traits: { ward: 'fire' },
    lore: 'Basks on hot rocks until fire feels like a warm bath.',
    counters: 'Fire Ward: burns barely tickle it. Use pierce, frost or water shells instead.',
    introducedIn: '2-4',
  }),
  enemy({
    id: 'lizard_basilisk', name: 'Bog Basilisk', family: 'lizard', tier: 'elite', hp: 300, speed: 0.7, armorClass: 'scaled', armor: 3,
    bounty: 42, threat: 18, size: 1.4, color: '#386641', accent: '#f2e8cf', variant: 'basilisk', props: ['tail', 'crystals'],
    traits: { regen: { pct: 0.02, delay: 3 } },
    lore: 'An ancient lake beast with stone-hard scales that slowly regrow.',
    counters: 'Armored and regenerating: Sango\'s shells crack the scales; keep it under constant fire.',
    introducedIn: '2-5',
  }),
];

// ---------------------------------------------------------------------------
// Constructs — heavy, crystal shells and barriers
// ---------------------------------------------------------------------------

const CONSTRUCTS = [
  enemy({
    id: 'construct_cogling', name: 'Cogling', family: 'construct', hp: 35, speed: 1.05, armorClass: 'heavy',
    bounty: 13, threat: 2.5, size: 0.75, color: '#b08968', accent: '#ffd43b', variant: 'cogling', props: ['gears'],
    lore: 'A wind-up helper that wandered off the assembly line.',
    counters: 'Heavy body: blast and mystic deal extra; slash bounces off.',
    introducedIn: '6-1',
  }),
  enemy({
    id: 'construct_shellback', name: 'Shellback', family: 'construct', hp: 50, speed: 0.8, armorClass: 'heavy',
    bounty: 18, threat: 4.5, size: 1.0, color: '#4cc9f0', accent: '#e0fbfc', variant: 'beetle', props: ['crystals', 'shell'],
    traits: { crystal: { cap: 5, hits: 10 } },
    lore: 'A clockwork beetle under a quartz dome. Big hits just bounce.',
    counters: 'Crystal Shell (max 5 per hit for 10 hits): rapid hitters shatter it, then heavy hitters finish.',
    introducedIn: '6-1',
  }),
  enemy({
    id: 'construct_aegis', name: 'Aegis Automaton', family: 'construct', hp: 50, speed: 0.8, armorClass: 'heavy',
    bounty: 18, threat: 5, size: 1.0, color: '#4895ef', accent: '#bde0fe', variant: 'automaton', props: ['shield', 'gears'],
    traits: { barrier: { hp: 60, regenDelay: 4 } },
    lore: 'Projects a humming energy dome that recharges if you stop hitting it.',
    counters: 'Barrier: blast deals +50% to it — Sango, Suzu, Akane. Keep the pressure on so it can\'t recharge.',
    introducedIn: '6-2',
  }),
  enemy({
    id: 'construct_sentry', name: 'Iron Sentry', family: 'construct', hp: 70, speed: 0.7, armorClass: 'heavy', armor: 4,
    bounty: 25, threat: 5.5, size: 1.05, color: '#6c757d', accent: '#ff4d6d', variant: 'sentry', props: ['helmet', 'gears'],
    lore: 'A walking foundry door. Armor 4 means small hits do just 1 damage.',
    counters: 'Armored (4): armor pierce and shred, or big blast shells.',
    introducedIn: '6-3',
  }),
  enemy({
    id: 'construct_warden', name: 'Prism Warden', family: 'construct', tier: 'elite', hp: 300, speed: 0.6, armorClass: 'heavy',
    bounty: 110, threat: 24, size: 1.4, color: '#7209b7', accent: '#4cc9f0', variant: 'warden', props: ['crystals', 'shield'],
    traits: { barrier: { hp: 200, regenDelay: 5 }, crystal: { cap: 8, hits: 14 } },
    lore: 'Foundry guardian wrapped in a barrier and, under that, a crystal shell.',
    counters: 'Barrier then shell: blast first, then many quick hits.',
    introducedIn: '6-4',
  }),
  enemy({
    id: 'iron_colossus', name: 'Iron Colossus', family: 'construct', tier: 'boss', hp: 14000, speed: 0.35, armorClass: 'heavy', armor: 6,
    bounty: 2500, threat: 420, size: 3, color: '#495057', accent: '#4cc9f0', variant: 'colossus', props: ['crystals', 'gears', 'chimney'],
    traits: { crystal: { cap: 30, hits: 40 } },
    phases: [
      { atHp: 0.7, announce: 'The Colossus grows a new crystal plate!', set: { traits: { crystal: { cap: 25, hits: 50 } } } },
      { atHp: 0.4, announce: 'Furnace surge — thicker crystal and hardened plate!', set: { armor: 8, traits: { crystal: { cap: 20, hits: 60 } } } },
      { atHp: 0.15, announce: 'The shell shatters — its core is exposed and it stomps forward!', set: { armor: 4, speed: 0.55, traits: { crystal: null } } },
    ],
    lore: 'The Foundry\'s masterpiece: a walking furnace sheathed in living crystal. It regrows its shell under pressure.',
    counters: 'Every phase brings a fresh shell — keep rapid hitters (Aoi, Kage, Raika) on it, and armor shred for the plate underneath.',
    introducedIn: 'boss-colossus',
  }),
];

// ---------------------------------------------------------------------------
// Beasts — light, enrage and charge
// ---------------------------------------------------------------------------

const BEASTS = [
  enemy({
    id: 'beast_wolf', name: 'Dusk Wolf', family: 'beast', hp: 26, speed: 1.3, armorClass: 'light',
    bounty: 6, threat: 2, size: 0.85, color: '#6d6875', accent: '#e5989b', variant: 'wolf', props: ['tail', 'mane'],
    traits: { enrage: { mul: 0.12, max: 0.8 } },
    lore: 'Hunts in packs. Each lost packmate makes the others run harder.',
    counters: 'Pack Fury: kill the pack together with splash or slow them down.',
    introducedIn: '4-2',
  }),
  enemy({
    id: 'beast_boar', name: 'Boar Charger', family: 'beast', hp: 40, speed: 1.0, armorClass: 'light',
    bounty: 4, threat: 3, size: 0.95, color: '#7f5539', accent: '#ede0d4', variant: 'boar', props: ['tusks'],
    traits: { hasty: { mul: 2.6, every: 5, duration: 1.2 } },
    lore: 'Lowers its tusks and charges every few seconds, for no reason at all.',
    counters: 'Hasty: slows blunt the charge; traps near the exit catch it mid-sprint.',
    introducedIn: '1-4',
  }),
  enemy({
    id: 'beast_bear', name: 'Moss Bear', family: 'beast', hp: 110, speed: 0.65, armorClass: 'light',
    bounty: 24, threat: 6, size: 1.3, color: '#5a4a3a', accent: '#a7c957', variant: 'bear', props: ['moss'],
    lore: 'Slept for a hundred years and woke up grumpy. Just a lot of health.',
    counters: 'Plain tank on a light body: slash and pierce shred it.',
    introducedIn: '4-2',
  }),
  enemy({
    id: 'beast_alpha', name: 'Alpha Wolf', family: 'beast', tier: 'elite', hp: 260, speed: 1.15, armorClass: 'light',
    bounty: 60, threat: 18, size: 1.3, color: '#22223b', accent: '#ff595e', variant: 'wolf', props: ['mane', 'tail', 'scarf'],
    traits: { enrage: { mul: 0.15, max: 1 }, summoner: { spawn: 'beast_wolf', count: 2, every: 6 } },
    lore: 'Its howl calls the pack from every ridge in Ironhold.',
    counters: 'Summoner with Pack Fury: snipe it first, then let splash handle the pack.',
    introducedIn: '4-4',
  }),
];

// ---------------------------------------------------------------------------
// Fae — warded tricksters
// ---------------------------------------------------------------------------

const FAE = [
  enemy({
    id: 'fae_sprite', name: 'Lantern Sprite', family: 'fae', hp: 14, speed: 1.5, armorClass: 'warded',
    bounty: 6, threat: 1.5, size: 0.6, color: '#f15bb5', accent: '#fee440', variant: 'sprite', props: ['wings', 'sparkle'],
    lore: 'A giggling festival sprite that skips along the lantern strings.',
    counters: 'Warded runner: mystic is halved. Aoi and Kage handle them well.',
    introducedIn: '7-3',
  }),
  enemy({
    id: 'fae_mirage', name: 'Mirage', family: 'fae', hp: 6, speed: 1.2, armorClass: 'warded',
    bounty: 0, leak: 0, threat: 0.5, size: 0.7, color: '#e0aaff', accent: '#ffffff', variant: 'mirage', props: ['sparkle'],
    lore: 'A shimmering copy that pops on the first touch.',
    counters: 'Decoy: it never costs lives, but it soaks up shots. Rapid multi-hit girls clear them.',
    introducedIn: '7-3',
  }),
  enemy({
    id: 'fae_illusionist', name: 'Fae Illusionist', family: 'fae', hp: 45, speed: 0.9, armorClass: 'warded',
    bounty: 21, threat: 5, size: 0.9, color: '#c77dff', accent: '#ffd6ff', variant: 'illusionist', props: ['mirror', 'wings'],
    traits: { decoy: { count: 2, every: 4, spawn: 'fae_mirage' } },
    lore: 'Throws mirror-copies of itself ahead to soak up your shots.',
    counters: 'Illusionist: multi-hit girls (Kage, Raika, Rei) pop the mirages; Shiro on Priority ignores them.',
    introducedIn: '7-3',
  }),
  enemy({
    id: 'fae_sylph', name: 'Wind Sylph', family: 'fae', hp: 30, speed: 1.2, armorClass: 'warded',
    bounty: 17, threat: 3.5, size: 0.8, color: '#9bf6ff', accent: '#caffbf', variant: 'sylph', props: ['wings'],
    traits: { airborne: true },
    lore: 'Rides the updrafts over Ashwing Peaks.',
    counters: 'Airborne: anti-air only. Pierce hits its ward fully.',
    introducedIn: '8-2',
  }),
  enemy({
    id: 'fae_queen', name: 'Mirror Queen', family: 'fae', tier: 'elite', hp: 280, speed: 0.8, armorClass: 'warded',
    bounty: 130, threat: 20, size: 1.25, color: '#7b2cbf', accent: '#ffd6ff', variant: 'queen', props: ['tiara', 'mirror', 'wings'],
    traits: { veiled: true, decoy: { count: 3, every: 5, spawn: 'fae_mirage' } },
    lore: 'Queen of the festival glamour. You see her mirages long before you see her.',
    counters: 'Veiled illusionist: Veil Sight to target her, multi-hit for the mirages.',
    introducedIn: '7-4',
  }),
];

// ---------------------------------------------------------------------------
// Plants — brood, bark armor, regrowth
// ---------------------------------------------------------------------------

const PLANTS = [
  enemy({
    id: 'plant_sprout', name: 'Bog Sprout', family: 'plant', hp: 8, speed: 1.35, armorClass: 'light',
    bounty: 0, threat: 0.6, size: 0.6, color: '#95d5b2', accent: '#ffafcc', variant: 'sprout', props: ['leaves'],
    lore: 'Hops out of a burst seed pod and runs for it.',
    counters: 'Swarm: splash or a cleaver near the pods.',
    introducedIn: '5-2',
  }),
  enemy({
    id: 'plant_seedpod', name: 'Seed Pod', family: 'plant', hp: 40, speed: 0.75, armorClass: 'light',
    bounty: 11, threat: 4, size: 0.9, color: '#52b788', accent: '#ffb4a2', variant: 'pod', props: ['leaves', 'flower'],
    traits: { brood: { spawn: 'plant_sprout', count: 4 } },
    lore: 'A walking seed pod that bursts into four sprouts.',
    counters: 'Brood: kill pods early on the path so the sprouts have far to run, with splash waiting.',
    introducedIn: '5-2',
  }),
  enemy({
    id: 'plant_thornroot', name: 'Thornroot', family: 'plant', hp: 55, speed: 0.7, armorClass: 'light', armor: 3,
    bounty: 15, threat: 5, size: 1.0, color: '#6f4518', accent: '#90a955', variant: 'root', props: ['thorns'],
    lore: 'Bark as tough as plate — but bark burns and splits.',
    counters: 'Armored (3) on a light body: slash with armor pierce, or shred it.',
    introducedIn: '5-3',
  }),
  enemy({
    id: 'plant_mossling', name: 'Mossling', family: 'plant', hp: 35, speed: 0.9, armorClass: 'light',
    bounty: 10, threat: 3, size: 0.8, color: '#80b918', accent: '#d4e09b', variant: 'mossling', props: ['moss', 'mushroom'],
    traits: { regen: { pct: 0.05, delay: 2 } },
    lore: 'Regrows anything you chop off, given two quiet seconds.',
    counters: 'Regenerating: poison stops it; steady fire works too.',
    introducedIn: '5-3',
  }),
  enemy({
    id: 'plant_treant', name: 'Elder Treant', family: 'plant', tier: 'elite', hp: 400, speed: 0.5, armorClass: 'light', armor: 3,
    bounty: 110, threat: 24, size: 1.5, color: '#3a5a40', accent: '#ff8fab', variant: 'treant', props: ['leaves', 'moss', 'flower'],
    traits: { brood: { spawn: 'plant_seedpod', count: 2 } },
    lore: 'The oldest willow in the fen, walking at last. Seed pods fall when it does.',
    counters: 'Armored brood: break the bark, and keep splash behind it for the pods and sprouts.',
    introducedIn: '5-4',
  }),
];

// ---------------------------------------------------------------------------
// Dragons — scaled, airborne, fire-warded
// ---------------------------------------------------------------------------

const DRAGONS = [
  enemy({
    id: 'dragon_wyvern', name: 'Ash Wyvern', family: 'dragon', hp: 60, speed: 1.1, armorClass: 'scaled',
    bounty: 35, threat: 6, size: 1.1, color: '#ff7f3f', accent: '#ffd166', variant: 'wyvern', props: ['wings', 'tail'],
    traits: { airborne: true },
    lore: 'A young wyvern circling the peaks, scouting for its Matriarch.',
    counters: 'Airborne: Rei, Akane and Sango can\'t reach it without upgrades. Aoi, Kage and Shiro\'s pierce hit scales ×1.5.',
    introducedIn: '8-1',
  }),
  enemy({
    id: 'dragon_ashdrake', name: 'Ashdrake', family: 'dragon', hp: 90, speed: 0.8, armorClass: 'scaled',
    bounty: 50, threat: 6, size: 1.2, color: '#9d0208', accent: '#ff9e00', variant: 'drake', props: ['tail', 'horns', 'ember'],
    traits: { ward: 'fire' },
    lore: 'A wingless drake that wallows in lava. Fire just makes it comfortable.',
    counters: 'Fire Ward: Akane\'s burns are halved. Frost, pierce and mystic hit it fully.',
    introducedIn: '8-3',
  }),
  enemy({
    id: 'dragon_cinder', name: 'Cinder Wyvern', family: 'dragon', tier: 'elite', hp: 360, speed: 0.95, armorClass: 'scaled',
    bounty: 210, threat: 26, size: 1.45, color: '#6a040f', accent: '#ffba08', variant: 'wyvern', props: ['wings', 'tail', 'horns', 'ember'],
    traits: { airborne: true, ward: 'fire' },
    lore: 'An elder of the brood with embers in its wings.',
    counters: 'Airborne and fire-warded: anti-air pierce (Shiro, Aoi, Kage) or frost.',
    introducedIn: '8-4',
  }),
  enemy({
    id: 'dragon_ashwing', name: 'Ashwing Matriarch', family: 'dragon', tier: 'boss', hp: 10000, speed: 0.4, armorClass: 'scaled', armor: 4,
    bounty: 3000, threat: 450, size: 3, color: '#370617', accent: '#ffba08', variant: 'matriarch', props: ['wings', 'tail', 'horns', 'crown', 'ember'],
    traits: { ward: 'fire' },
    phases: [
      { atHp: 0.75, announce: 'The Ashwing Matriarch takes to the sky — her wyverns answer the call!', set: { traits: { airborne: true, summoner: { spawn: 'dragon_wyvern', count: 2, every: 8 } } } },
      { atHp: 0.45, announce: 'She lands in a storm of cinders — her scales harden!', set: { armor: 7, speed: 0.5, traits: { airborne: null, summoner: { spawn: 'dragon_ashdrake', count: 1, every: 9 } } } },
      { atHp: 0.2, announce: 'Final flight! The Matriarch soars for the exit with her elders!', set: { armor: 4, speed: 0.6, traits: { airborne: true, summoner: { spawn: 'dragon_cinder', count: 1, every: 10 } } } },
    ],
    lore: 'Mother of every dragon on the peaks. Her wingbeat scatters ash across three valleys.',
    counters: 'Bring anti-air for her flights, armor break for her landing, and never rely on fire. Pierce hits her scales ×1.5.',
    introducedIn: '8-5',
  }),
];

export const ENEMIES = [
  ...SLIMES, ...GOBLINS, ...ORCS, ...GHOSTS, ...GHOULS, ...ONI,
  ...LIZARDS, ...CONSTRUCTS, ...BEASTS, ...FAE, ...PLANTS, ...DRAGONS,
];

export const ENEMY_MAP = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));

/**
 * Look up an enemy definition.
 * @param {string} id enemy id, e.g. 'slime_green'
 * @returns {object} EnemyDef
 * @throws {Error} when the id is unknown
 */
export function getEnemy(id) {
  const e = ENEMY_MAP[id];
  if (!e) throw new Error(`Unknown enemy: ${id}`);
  return e;
}

/**
 * Every enemy of one family, in bestiary order (normal → elite → miniboss → boss).
 * @param {string} familyId FAMILIES key
 * @returns {object[]}
 */
export function enemiesByFamily(familyId) {
  const rank = { normal: 0, elite: 1, miniboss: 2, boss: 3 };
  return ENEMIES.filter((e) => e.family === familyId).sort((a, b) => rank[a.tier] - rank[b.tier]);
}

/**
 * Trait keys of an enemy including those gained in boss phases ('armored' when armor > 0).
 * @param {object|string} enemyOrId EnemyDef or id
 * @returns {string[]} TRAITS keys
 */
export function enemyTraits(enemyOrId) {
  const e = typeof enemyOrId === 'string' ? getEnemy(enemyOrId) : enemyOrId;
  const keys = [];
  if (e.armor > 0) keys.push('armored');
  for (const [k, v] of Object.entries(e.traits)) if (v && !keys.includes(k)) keys.push(k);
  for (const ph of e.phases || []) {
    if (ph.set?.armor > 0 && !keys.includes('armored')) keys.push('armored');
    for (const [k, v] of Object.entries(ph.set?.traits || {})) if (v && !keys.includes(k)) keys.push(k);
  }
  return keys;
}

/**
 * Enemy ids an enemy can produce (splits, broods, summons, decoys — including boss phases).
 * @param {object|string} enemyOrId
 * @returns {string[]}
 */
export function spawnedBy(enemyOrId) {
  const e = typeof enemyOrId === 'string' ? getEnemy(enemyOrId) : enemyOrId;
  const out = new Set();
  const visit = (t) => {
    for (const k of ['brood', 'splitter', 'summoner', 'decoy']) if (t?.[k]?.spawn) out.add(t[k].spawn);
  };
  visit(e.traits);
  for (const ph of e.phases || []) visit(ph.set?.traits);
  return [...out];
}
