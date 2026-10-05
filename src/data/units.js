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
// * Hero levelXp[i] = XP needed to go from level i+1 to level i+2 (9 entries for levels 2..10).

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
// Heroes — adult guardians (one per battle). Good, not carrying: level 1 ≈ a tier-2 tower,
// level 10 ≈ a strong tier-4 tower.
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
    hair: '#ffe08a', hairShade: '#e0a93b', eyes: '#ffb347', skin: '#ffe6d6',
    outfit: '#ffffff', outfitShade: '#d9dfee', accent: '#f2c14e', halo: '#fff1a8', weapon: '#e8ecf5',
  },
  look: {
    hairStyle: 'long', bangs: 'swept', accessory: 'crown', outfit: 'armor', weapon: 'sword',
    halo: 'crown', eyeStyle: 'sharp', expression: 'smile',
  },
  bio: 'Captain of the Sentinel Guard and the academy\'s senior guardian. Tall and poised, she wears a tailored white-and-gold knight\'s greatcoat over polished half-plate, a slim golden circlet in her long sunlit hair, and carries a longsword that burns with morning light. She walks the front line so her students never have to stand there alone.',
  personality: 'Warm, unshakable and quietly teasing — the confident big-sister commander everyone wants to impress.',
  quote: 'Stay behind me, girls. The dawn is never late.',
  tips: [
    'She has Veil Sight from the start — your first answer to veiled enemies.',
    'Place her on the inside of a double bend: her short cleave hits far more enemies on corners.',
    'Save Celestial Bloom for a packed wave, or to stun a miniboss right before the exit.',
    'Sanctuary turns her into a holy banner: Veil Sight, silence and buffs for the girls around her.',
  ],
  base: stats({
    cost: 520, behavior: 'pulse', damage: 6, rate: 1.0, range: 2.1, maxTargets: 3,
    projectileSpeed: 0, canHitAir: false, detection: true, crit: { chance: 0.05, mul: 1.5 },
  }),
  paths: [
    path('radiant', 'Radiant Edge', 'Holy cleave damage', [
      tier('Honed Light', 150, '+2 damage.', { damage: 2 }),
      tier('Wide Arc', 320, 'Each sweep hits 2 more enemies; +0.2 range.', { maxTargets: 2, range: 0.2 }),
      tier('Sunsteel Edge', 950, 'Ignores 3 armor and +4 damage — plate no longer stops the dawn.', { armorPen: 3, damage: 4 }),
      tier('Judgement Arc', 2700, '+10 damage, 3 more targets per sweep, 15% crits for ×2.', { damage: 10, maxTargets: 3, crit: { chance: 0.15, mul: 2 } }),
      tier('Noon Absolute', 9800, 'The sun at its zenith: +24 damage, +40% attack speed, 4 more targets, longer reach.', { damage: 24, rateMul: 1.4, maxTargets: 4, range: 0.5 }),
    ]),
    path('sanctuary', 'Sanctuary', 'Holy aura and silence', [
      tier('Guiding Light', 140, 'Girls within 2.6 tiles gain +6% range.', { aura: { range: 2.6, rangeMul: 1.06 } }),
      tier('Shared Light', 300, 'Aura: +5% attack speed.', { aura: { rateMul: 1.05 } }),
      tier('Blessed Ground', 1100, 'Aura shares Veil Sight and +10% damage; her hits silence fields and blinks for 0.6s.', { aura: { detection: true, dmgMul: 1.1 }, silence: 0.6 }),
      tier('Sanctified Banner', 3200, 'Aura +15% attack speed and reaches 3.2 tiles; hits reveal veiled foes for 2s.', { aura: { rateMul: 1.15, range: 3.2 }, reveal: 2 }),
      tier('Dawn Sanctuary', 11000, 'Aura +20% damage, cleanses sabotage and reaches 4 tiles; silence +0.8s.', { aura: { dmgMul: 1.2, range: 4, cleanse: true }, silence: 0.8 }),
    ]),
    path('lightbringer', 'Lightbringer', 'Reach, flyers and light lances', [
      tier('Bright Step', 120, '+0.3 range.', { range: 0.3 }),
      tier('Morning Tempo', 280, '+15% attack speed.', { rateMul: 1.15 }),
      tier('Skyward Radiance', 1000, 'Holy waves reach flying enemies; +0.6 range.', { canHitAir: true, range: 0.6 }),
      tier('Halo Lances', 2900, 'Her cleave becomes three piercing lances of light thrown at range; +4 damage.', { behavior: 'projectile', projectiles: 2, pierce: 3, range: 1, projectileSpeed: 16, damage: 4 }),
      tier('Celestial Choir', 10500, 'Five radiant lances, +20 damage; hits may stun and reveal veiled foes.', { projectiles: 2, damage: 20, status: [S.stun(0.4, 0.25)], reveal: 3 }),
    ]),
  ],
  awakenPassive: {
    name: 'Unbroken Dawn',
    desc: '+8% damage, and her strikes reveal veiled enemies for 1.5s.',
    mods: { damageMul: 1.08, reveal: 1.5 },
  },
  hero: {
    levelXp: [180, 320, 480, 680, 920, 1200, 1550, 1950, 2400],
    levels: [
      { level: 1, desc: 'Holy cleaves with Veil Sight.', mods: {} },
      { level: 2, desc: 'Steady Guard: +1 damage.', mods: { damage: 1 } },
      { level: 3, desc: 'Celestial Bloom unlocked; +5% attack speed.', mods: { rateMul: 1.05 } },
      { level: 4, desc: 'Wider Sweep: +1 target per sweep, +0.2 range.', mods: { maxTargets: 1, range: 0.2 } },
      { level: 5, desc: 'Radiant Focus: +2 damage, +5% crit chance.', mods: { damage: 2, crit: { chance: 0.05, mul: 1.5 } } },
      { level: 6, desc: 'Searing Dawn: hits reveal veiled enemies for 1.5s.', mods: { reveal: 1.5 } },
      { level: 7, desc: 'Captain\'s Resolve: +10% damage.', mods: { damageMul: 1.1 } },
      { level: 8, desc: 'Unwavering: +10% attack speed, +1 target.', mods: { rateMul: 1.1, maxTargets: 1 } },
      { level: 9, desc: 'Sunforged: +3 damage, ignores 1 armor.', mods: { damage: 3, armorPen: 1 } },
      { level: 10, desc: 'Dawnblade Ascendant: +15% damage, +0.3 range.', mods: { damageMul: 1.15, range: 0.3 } },
    ],
    ult: {
      name: 'Celestial Bloom',
      desc: 'A sun blooms around Hikari: 160 holy damage within 4.5 tiles, a 1.2s stun, and every veiled foe is revealed for 8s.',
      unlockLevel: 3,
      cooldown: 70,
      effect: { type: 'nova', damage: 160, radius: 4.5, attackType: 'holy', status: [S.stun(1.2)], reveal: 8 },
    },
  },
};

const LUNA = {
  id: 'luna',
  name: 'Luna',
  title: 'Moonlit Archmage',
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
    hair: '#cdbbff', hairShade: '#8b74d9', eyes: '#a26bff', skin: '#f8e4e0',
    outfit: '#2a2350', outfitShade: '#17122e', accent: '#c9a8ff', halo: '#e6dcff', weapon: '#7a5cff',
  },
  look: {
    hairStyle: 'hime', bangs: 'hime', accessory: 'witchHat', outfit: 'robe', weapon: 'tome',
    halo: 'moon', eyeStyle: 'sleepy', expression: 'smug',
  },
  bio: 'The academy\'s Archmage of the Night Courses and its most glamorous teacher. Luna drifts through battle in a flowing midnight gown-robe embroidered with constellations and a wide star-stitched witch hat over lavender hime-cut hair, her grimoire floating open at her side. Three moon-silver beams answer every flick of her fingers.',
  personality: 'Languid, elegant and fond of dramatic entrances; secretly grades homework with little moon stickers.',
  quote: 'Hush now. Let the moon do the talking.',
  tips: [
    'Line her beams down a long straight: every beam pierces several enemies.',
    'Mystic is strong against armor and scales but halved by warded fae and oni.',
    'Moonfall slows the whole map AND speeds up every girl — fire it at the peak of a wave.',
  ],
  base: stats({
    cost: 620, behavior: 'beam', damage: 4, rate: 0.8, range: 3.6, projectiles: 3, pierce: 3,
    projectileSpeed: 0, canHitAir: true,
  }),
  paths: [
    path('lances', 'Lunar Lances', 'Piercing beam damage', [
      tier('Focused Moonlight', 160, '+1 beam damage.', { damage: 1 }),
      tier('Silver Thread', 340, 'Each beam pierces 2 more enemies.', { pierce: 2 }),
      tier('Eclipse Prism', 1100, 'Beams ignore 3 armor and deal +3 damage.', { armorPen: 3, damage: 3 }),
      tier('Full Moon Lance', 3200, '+8 damage, +4 pierce and +25% against elites.', { damage: 8, pierce: 4, eliteMul: 1.25 }),
      tier('Lunatic Lance', 11500, 'Five beams, +24 damage, +30% attack speed.', { projectiles: 2, damage: 24, rateMul: 1.3 }),
    ]),
    path('gravity', 'Night Gravity', 'Slows and brittle', [
      tier('Dusk Veil', 140, 'Beams slow by 15% for 1s.', { status: [S.slow(0.15, 1)] }),
      tier('Heavy Night', 300, '+0.4 range.', { range: 0.4 }),
      tier('Lunar Gravity', 1000, 'Slow 30%, and struck foes turn Brittle: +10% damage from everyone.', { status: [S.slow(0.3, 1.5), S.vulnerable(0.1, 2)] }),
      tier('Starfall Bind', 3400, '+20% damage; 15% chance to stun for 0.5s.', { damageMul: 1.2, status: [S.stun(0.5, 0.15)] }),
      tier('Event Horizon', 10500, 'Gravity collapse: freeze chance, 50% slows, Brittle +20%, +20% attack speed.', { status: [S.freeze(1.2, 0.2), S.slow(0.5, 2.5), S.vulnerable(0.2, 3)], rateMul: 1.2 }),
    ]),
    path('court', 'Astral Court', 'Team buffs', [
      tier('Starlit Study', 150, 'Girls within 3 tiles gain +5% range.', { aura: { range: 3, rangeMul: 1.05 } }),
      tier('Night Lessons', 320, 'Aura: +5% attack speed.', { aura: { rateMul: 1.05 } }),
      tier('Celestial Court', 1200, 'Aura shares Veil Sight and +10% damage.', { aura: { detection: true, dmgMul: 1.1 } }),
      tier('Moon Court Regalia', 3600, 'Aura +12% attack speed and reaches 3.6 tiles; +4 damage.', { aura: { rateMul: 1.12, range: 3.6 }, damage: 4 }),
      tier('Queen of the Night Sky', 12000, 'Aura +20% damage, +10% range and speed; a fourth beam.', { aura: { dmgMul: 1.2, rangeMul: 1.1, rateMul: 1.1 }, projectiles: 1 }),
    ]),
  ],
  awakenPassive: {
    name: 'Moon\'s Favour',
    desc: 'Beams pierce 1 more enemy and reach 0.3 tiles further.',
    mods: { pierce: 1, range: 0.3 },
  },
  hero: {
    levelXp: [200, 350, 520, 720, 960, 1250, 1600, 2000, 2450],
    levels: [
      { level: 1, desc: 'Three piercing moon beams.', mods: {} },
      { level: 2, desc: 'Arcane Focus: +1 damage.', mods: { damage: 1 } },
      { level: 3, desc: 'Moonfall unlocked; +0.2 range.', mods: { range: 0.2 } },
      { level: 4, desc: 'Threaded Light: +1 pierce.', mods: { pierce: 1 } },
      { level: 5, desc: 'Night Tempo: +1 damage, +8% attack speed.', mods: { damage: 1, rateMul: 1.08 } },
      { level: 6, desc: 'Silver Edge: ignores 1 armor.', mods: { armorPen: 1 } },
      { level: 7, desc: 'Fourth Phase: a fourth beam.', mods: { projectiles: 1 } },
      { level: 8, desc: 'Tidal Moon: +2 damage.', mods: { damage: 2 } },
      { level: 9, desc: 'Midnight Cadence: +10% attack speed.', mods: { rateMul: 1.1 } },
      { level: 10, desc: 'Lunar Sovereign: +15% damage, +2 pierce.', mods: { damageMul: 1.15, pierce: 2 } },
    ],
    ult: {
      name: 'Moonfall',
      desc: 'The moon descends: every enemy is slowed by 50% for 5s and every girl attacks 30% faster for 8s.',
      unlockLevel: 3,
      cooldown: 80,
      effect: { type: 'timeWarp', slow: 0.5, duration: 5, rateBuff: 1.3, buffDuration: 8 },
    },
  },
};

const NAMI = {
  id: 'nami',
  name: 'Nami',
  title: 'Tideguard Commodore',
  kind: 'hero',
  rarity: 'SR',
  adult: true,
  role: 'tideguard',
  attackType: 'mystic',
  element: 'frost',
  placement: 'water',
  materialFamily: 'rime',
  capabilities: ['water', 'slow', 'antiAir'],
  pathCapabilities: ['armorPen', 'stun', 'buff'],
  acquisition: free('1-5', 'Joins after defeating the Slime Prince in 1-5 — the Moonlit Lakeshore is all water.'),
  palette: {
    hair: '#2ec4b6', hairShade: '#16897f', eyes: '#4cc9f0', skin: '#f2d2bd',
    outfit: '#1d3557', outfitShade: '#122440', accent: '#e9c46a', halo: '#9be7ff', weapon: '#d4af37',
  },
  look: {
    hairStyle: 'wavy', bangs: 'split', accessory: 'flower', outfit: 'coat', weapon: 'trident',
    halo: 'wave', eyeStyle: 'sharp', expression: 'calm',
  },
  bio: 'A retired naval commodore who now guards the academy harbor. Sun-kissed and statuesque, she wears a fitted navy greatcoat with gold epaulettes and a sea-blossom pinned in her long teal waves, and stands knee-deep in the shallows with a gilded trident. Her strikes freeze the tide around her foes.',
  personality: 'Laid-back and dryly funny until the horn sounds — then every order is crisp, calm and exactly right.',
  quote: 'Tide\'s turning. Hold the line and let the sea do the rest.',
  tips: [
    'Deploys only on water tiles — lakes beside the path are perfect.',
    'Tidal Wave pushes the whole wave back 5 tiles: a lifesaver right before a leak.',
    'Undertow keeps pushing enemies back into your kill zone; Harbor Watch buffs nearby girls.',
  ],
  base: stats({
    cost: 460, behavior: 'projectile', damage: 5, rate: 1.0, range: 3.2, splash: 0.5,
    projectileSpeed: 12, canHitAir: true, status: [S.slow(0.2, 1.2)],
  }),
  paths: [
    path('frostbrand', 'Frostbrand', 'Freezing strikes', [
      tier('Cold Current', 130, '+1 damage.', { damage: 1 }),
      tier('Biting Spray', 300, 'Slow strengthened to 25% for 1.5s.', { status: [S.slow(0.25, 1.5)] }),
      tier('Rime Spear', 950, 'Brittle +12%, ignores 1 armor, wider splash.', { status: [S.vulnerable(0.12, 2.5)], armorPen: 1, splash: 0.3 }),
      tier('Glacier Breaker', 2900, '+6 damage; 20% chance to freeze for 0.8s.', { damage: 6, status: [S.freeze(0.8, 0.2)] }),
      tier('Absolute Zero Tide', 9800, '+18 damage, 30% freeze for 1.5s, huge splash, +25% attack speed.', { damage: 18, status: [S.freeze(1.5, 0.3)], splash: 0.6, rateMul: 1.25 }),
    ]),
    path('undertow', 'Undertow', 'Push-back control', [
      tier('Riptide', 140, '+0.3 range.', { range: 0.3 }),
      tier('Undertow', 320, 'Hits push enemies back 0.2 tiles (not bosses).', { knockback: 0.2 }),
      tier('Whirlpool', 1000, 'Bigger splash, stronger push-back and a 35% slow.', { splash: 0.5, knockback: 0.2, status: [S.slow(0.35, 1.5)] }),
      tier('Maelstrom', 3200, '+4 damage, further push-back, 20% chance to stun for 0.4s.', { damage: 4, knockback: 0.3, status: [S.stun(0.4, 0.2)] }),
      tier('Leviathan\'s Wake', 10500, 'A tidal hammer: +14 damage, massive splash and push-back, +20% speed.', { damage: 14, splash: 0.8, knockback: 0.6, rateMul: 1.2 }),
    ]),
    path('harbor', 'Harbor Watch', 'Fleet support', [
      tier('Sea Breeze', 120, 'Girls within 2.8 tiles attack 5% faster.', { aura: { range: 2.8, rateMul: 1.05 } }),
      tier('Lighthouse', 300, '+0.5 range.', { range: 0.5 }),
      tier('Captain\'s Orders', 1000, 'Aura +10% attack speed and +5% range.', { aura: { rateMul: 1.1, rangeMul: 1.05 } }),
      tier('Fleet Formation', 3000, 'Aura +12% damage and reaches 3.4 tiles.', { aura: { dmgMul: 1.12, range: 3.4 } }),
      tier('Admiral of the Tides', 11000, 'Aura +15% damage, +10% speed, 10% cheaper upgrades; +10 damage.', { aura: { dmgMul: 1.15, rateMul: 1.1, costCut: 0.1 }, damage: 10 }),
    ]),
  ],
  awakenPassive: {
    name: 'Rising Tide',
    desc: 'Slow strengthened to 30% and +5% damage.',
    mods: { status: [S.slow(0.3, 1.6)], damageMul: 1.05 },
  },
  hero: {
    levelXp: [160, 300, 450, 640, 870, 1150, 1480, 1860, 2300],
    levels: [
      { level: 1, desc: 'Frost strikes from the water that slow.', mods: {} },
      { level: 2, desc: 'Salt Spray: +1 damage.', mods: { damage: 1 } },
      { level: 3, desc: 'Tidal Wave unlocked; +0.2 range.', mods: { range: 0.2 } },
      { level: 4, desc: 'Rolling Surf: +0.2 splash.', mods: { splash: 0.2 } },
      { level: 5, desc: 'Cold Front: slow strengthened to 25%.', mods: { status: [S.slow(0.25, 1.4)] } },
      { level: 6, desc: 'Deep Current: +2 damage.', mods: { damage: 2 } },
      { level: 7, desc: 'Steady Helm: +10% attack speed.', mods: { rateMul: 1.1 } },
      { level: 8, desc: 'Rimebite: struck foes turn Brittle (+8% damage taken) for 2s.', mods: { status: [S.vulnerable(0.08, 2)] } },
      { level: 9, desc: 'High Tide: +2 damage.', mods: { damage: 2 } },
      { level: 10, desc: 'Tidecaller: +15% damage; hits push enemies back 0.15 tiles.', mods: { damageMul: 1.15, knockback: 0.15 } },
    ],
    ult: {
      name: 'Tidal Wave',
      desc: 'A wave crashes down every path: 70 damage, enemies are pushed back 5 tiles (bosses resist) and slowed by 40% for 3s.',
      unlockLevel: 3,
      cooldown: 60,
      effect: { type: 'tide', damage: 70, pushback: 5, slow: 0.4, duration: 3 },
    },
  },
};

// ---------------------------------------------------------------------------
// Towers — academy students (wholesome designs).
// ---------------------------------------------------------------------------

const AOI = {
  id: 'aoi',
  name: 'Aoi',
  title: 'Sky Archer',
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
    hair: '#6cc4ff', hairShade: '#2f86d6', eyes: '#2563c9', skin: '#ffe5d6',
    outfit: '#ffffff', outfitShade: '#cfe2f5', accent: '#ff6f91', halo: '#a6e1ff', weapon: '#f4d27a',
  },
  look: {
    hairStyle: 'ponytail', bangs: 'swept', accessory: 'hairpin', outfit: 'sailor', weapon: 'bow',
    halo: 'ring', eyeStyle: 'round', expression: 'cheerful',
  },
  bio: 'A first-year from the archery club and the academy\'s most dependable shot. Sky-blue ponytail, a white feather hairpin, a crisp sailor uniform with a pink scarf — and a bow she polishes every evening after practising until sunset.',
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
      tier('Comet Arrow', 2200, '+6 damage, +4 pierce, faster arrows, +30% against elites.', { damage: 6, pierce: 4, projectileSpeed: 10, eliteMul: 1.3 }),
      tier('Skyline Breaker', 8500, 'Arrows punch through whole columns: +18 damage, +10 pierce, ignores 6 more armor.', { damage: 18, pierce: 10, armorPen: 6, range: 1, crit: { chance: 0.1, mul: 2.5 } }),
    ]),
    path('volley', 'Rapid Volley', 'Speed and multi-shot', [
      tier('Quick Draw', 90, '+20% attack speed.', { rateMul: 1.2 }),
      tier('Twin Nock', 250, 'Shoots 2 targets at once.', { projectiles: 1 }),
      tier('Hawk Eye', 600, 'Veil Sight; +0.4 range and +15% attack speed.', { detection: true, range: 0.4, rateMul: 1.15 }),
      tier('Arrow Storm', 2400, '4 targets per volley, +50% attack speed.', { projectiles: 2, rateMul: 1.5 }),
      tier('Thousand Feathers', 9500, '6 targets per volley, double attack speed, +3 damage.', { projectiles: 2, rateMul: 2, damage: 3 }),
    ]),
    path('hunter', 'Sky Hunter', 'Elites, bosses and marking', [
      tier('Long Bow', 80, '+0.5 range.', { range: 0.5 }),
      tier('Wind Reading', 200, '+0.3 range, +5% crit chance.', { range: 0.3, crit: { chance: 0.05, mul: 1.5 } }),
      tier('Falcon Mark', 700, 'Marked targets take +12% damage from everyone for 3s; +25% against elites.', { mark: { bonus: 0.12, duration: 3 }, eliteMul: 1.25 }),
      tier('Pinning Gale', 2000, '+5 damage; 15% chance to pin (0.3s stun) with a slight push-back.', { damage: 5, status: [S.stun(0.3, 0.15)], knockback: 0.15 }),
      tier('Apex Huntress', 7500, '+22 damage, +30% attack speed, ×1.5 vs elites and bosses, 15% crits ×3.', { damage: 22, rateMul: 1.3, eliteMul: 1.5, bossMul: 1.5, crit: { chance: 0.15, mul: 3 } }),
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
  title: 'Crescent Cleaver',
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
    hair: '#2b2f45', hairShade: '#171a29', eyes: '#e63946', skin: '#ffe2d2',
    outfit: '#3c4a6b', outfitShade: '#26304a', accent: '#e63946', halo: '#ff8fa3', weapon: '#dfe6f0',
  },
  look: {
    hairStyle: 'short', bangs: 'messy', accessory: 'headband', outfit: 'blazer', weapon: 'katana',
    halo: 'star', eyeStyle: 'sharp', expression: 'determined',
  },
  bio: 'Vice-captain of the kendo club, who swings an oversized steel nodachi as if it weighed nothing. Short ink-navy hair, a red hachimaki headband and a blazer with the sleeves rolled up. She loves corners — the tighter the crowd, the wider her grin.',
  personality: 'Blunt, loud and fiercely competitive; secretly feeds every stray cat on campus.',
  quote: 'Line them up. I\'ll take them all at once!',
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
      tier('Tempest Dance', 2500, '+50% attack speed, +4 damage, 4 more targets.', { rateMul: 1.5, damage: 4, maxTargets: 4 }),
      tier('Thousand Petal Storm', 9000, 'A blade hurricane: hits everything in reach, +14 damage, +60% speed.', { maxTargets: 20, damage: 14, rateMul: 1.6, range: 0.6, crit: { chance: 0.1, mul: 2 } }),
    ]),
    path('duelist', 'Duelist Stance', 'Single-target focus', [
      tier('Sharpened Edge', 110, '+2 damage.', { damage: 2 }),
      tier('Iai Draw', 280, '10% crits for ×2 damage.', { crit: { chance: 0.1, mul: 2 } }),
      tier('Focused Strikes', 850, '+4 damage, ignores 2 armor, +20% against elites.', { damage: 4, armorPen: 2, eliteMul: 1.2 }),
      tier('Duelist Stance', 2600, 'Switches to a one-on-one stance: single target, +10% damage per consecutive hit (max +80%).', { behavior: 'duel', ramp: { per: 0.1, max: 0.8 }, damage: 8, rateMul: 1.2 }),
      tier('Final Crescent', 9500, '+20 damage, ramp up to +150%, +40% vs bosses, 15% crits ×3.', { damage: 20, ramp: { per: 0.05, max: 0.7 }, bossMul: 1.4, crit: { chance: 0.15, mul: 3 } }),
    ]),
    path('counter', 'Counter Form', 'Interrupting counter-slashes', [
      tier('Ready Guard', 90, '+10% attack speed.', { rateMul: 1.1 }),
      tier('Parry Rhythm', 240, '+1 damage, +0.2 range.', { damage: 1, range: 0.2 }),
      tier('Riposte', 750, 'Counter-slashes silence for 0.5s (stops blinks and siphons); 25% chance to stun.', { silence: 0.5, status: [S.stun(0.35, 0.25)] }),
      tier('Breaking Rhythm', 2300, 'Slashes crack armor (-2, stacks ×3) and knock back slightly; +3 damage.', { status: [S.shred(2, 3)], knockback: 0.2, damage: 3 }),
      tier('Kenshi\'s Answer', 8000, '+10 damage, 4 more targets, 35% stun for 0.6s, silence +1s.', { damage: 10, maxTargets: 4, status: [S.stun(0.6, 0.35)], silence: 1 }),
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
  title: 'Snowdrift Mage',
  kind: 'tower',
  rarity: 'R',
  adult: false,
  role: 'controller',
  attackType: 'mystic',
  element: 'frost',
  placement: 'land',
  materialFamily: 'rime',
  capabilities: ['slow', 'antiAir'],
  pathCapabilities: ['stun', 'armorShred', 'silence'],
  acquisition: free('1-2', 'Joins after 1-2, right before hasty goblins sprint in.'),
  palette: {
    hair: '#cdeeff', hairShade: '#8cc8ee', eyes: '#5fc8f5', skin: '#fff0ea',
    outfit: '#bfe6ff', outfitShade: '#8ec5ea', accent: '#ffffff', halo: '#d6f3ff', weapon: '#9fd8ff',
  },
  look: {
    hairStyle: 'bob', bangs: 'straight', accessory: 'hood', outfit: 'dress', weapon: 'staff',
    halo: 'snow', eyeStyle: 'sleepy', expression: 'shy',
  },
  bio: 'A quiet snow mage from the northern dorm who lives inside a fluffy hooded winter dress. Her pale bob and sleepy eyes hide a precise mind: every snowflake she casts lands exactly where a goblin is about to step.',
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
      tier('Glacial Prison', 2200, '30% chance to freeze for 1s, bigger splash, +20% attack speed.', { status: [S.freeze(1, 0.3)], splash: 0.4, rateMul: 1.2 }),
      tier('Eternal Winter', 8500, 'Becomes a blizzard: pulses hit every enemy in range with 60% slows and frequent freezes.', { behavior: 'pulse', range: 0.6, damage: 6, status: [S.slow(0.6, 2.5), S.freeze(1.5, 0.35)] }),
    ]),
    path('frostbite', 'Frostbite', 'Frost vulnerability', [
      tier('Sharp Ice', 100, '+1 damage.', { damage: 1 }),
      tier('Icicle Lance', 260, '+1 damage; icicles pierce 1 more enemy.', { damage: 1, pierce: 1 }),
      tier('Brittle Frost', 800, 'Struck foes turn Brittle: +15% damage from everyone for 2.5s.', { status: [S.vulnerable(0.15, 2.5)] }),
      tier('Shatter Point', 2600, 'Brittle +25%; frost cracks armor (-2, stacks ×3); +5 damage.', { status: [S.vulnerable(0.25, 3), S.shred(2, 3)], damage: 5 }),
      tier('Diamond Dust', 9000, '+15 damage, Brittle +35%, 20% crits ×2.5, +30% attack speed.', { damage: 15, status: [S.vulnerable(0.35, 3.5)], crit: { chance: 0.2, mul: 2.5 }, rateMul: 1.3 }),
    ]),
    path('permafrost', 'Permafrost', 'Lingering control', [
      tier('Frost Trail', 80, '+0.3 range.', { range: 0.3 }),
      tier('Lingering Cold', 220, 'Slows last 2.5s.', { status: [S.slow(0.3, 2.5)] }),
      tier('Hoarfrost Field', 650, 'Wide frost patches (+0.5 splash), 3s slows, and chills silence blinks and siphons for 0.6s.', { splash: 0.5, status: [S.slow(0.35, 3)], silence: 0.6 }),
      tier('Avalanche Herald', 2400, 'Push-back 0.3 tiles, 15% freeze chance, +25% attack speed.', { knockback: 0.3, status: [S.freeze(0.6, 0.15)], rateMul: 1.25 }),
      tier('Frozen Time', 8000, '55% slows for 4s, 25% freezes, enormous splash, ×1.5 vs bosses.', { status: [S.slow(0.55, 4), S.freeze(1.2, 0.25)], splash: 0.8, bossMul: 1.5, damage: 5 }),
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
  title: 'Peach Merchant',
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
    hair: '#ffb4a2', hairShade: '#f08a7a', eyes: '#ff7a8a', skin: '#ffe7da',
    outfit: '#fff3c4', outfitShade: '#f5d98b', accent: '#ff8fab', halo: '#ffd166', weapon: '#e6b422',
  },
  look: {
    hairStyle: 'buns', bangs: 'straight', accessory: 'bunnyEars', outfit: 'apron', weapon: 'coinPurse',
    halo: 'star', eyeStyle: 'sparkle', expression: 'cheerful',
  },
  bio: 'Student manager of the academy store, with peach-pink double buns, a bunny-ear headband and a frilly shop apron stuffed with receipts. She funds the whole defense with clever deals — and throws (fully refundable) coins at monsters.',
  personality: 'Bubbly, shrewd and always counting; offers a "friend discount" to literally everyone.',
  quote: 'Every coin counts — especially the ones I throw!',
  tips: [
    'Place her early: her income pays out at the end of every wave.',
    'Savings Pact tier 3 makes upgrades cheaper for the girls around her.',
    'Her coin toss is weak — never rely on her to hold a lane alone.',
    'Nightmare difficulty switches off all wave income, hers included.',
  ],
  base: stats({
    cost: 300, behavior: 'projectile', damage: 2, rate: 0.8, range: 2.8, projectileSpeed: 12,
    canHitAir: true, income: { perWave: 30, interest: 0 },
  }),
  paths: [
    path('orchard', 'Peach Orchard', 'Wave income', [
      tier('Fresh Stock', 150, '+20 coins per wave.', { income: { perWave: 20 } }),
      tier('Market Stall', 350, '+40 coins per wave.', { income: { perWave: 40 } }),
      tier('Peach Emporium', 1100, '+100 coins per wave.', { income: { perWave: 100 } }),
      tier('Sakura Trading Co.', 3500, '+300 coins per wave.', { income: { perWave: 300 } }),
      tier('Golden Peach Bank', 12000, '+900 coins per wave and 5% interest on your coins (max 150).', { income: { perWave: 900, interest: 0.05 } }),
    ]),
    path('ledger', 'Savings Pact', 'Interest and discounts', [
      tier('Piggy Bank', 120, 'Earn 2% interest on your coins each wave (max 150).', { income: { interest: 0.02 } }),
      tier('Compound Ledger', 300, '+2% interest and +10 coins per wave.', { income: { perWave: 10, interest: 0.02 } }),
      tier('Coupon Book', 900, 'Girls within 2.5 tiles pay 8% less for upgrades.', { aura: { range: 2.5, costCut: 0.08 } }),
      tier('Wholesale Deals', 2800, 'Discount rises to 15% within 3.2 tiles; +3% interest.', { aura: { range: 3.2, costCut: 0.07 }, income: { interest: 0.03 } }),
      tier('Golden Ledger', 9000, 'Discount rises to 25%; +250 coins per wave and +5% interest.', { aura: { costCut: 0.1 }, income: { perWave: 250, interest: 0.05 } }),
    ]),
    path('cointoss', 'Coin Toss', 'Lucky attacks', [
      tier('Heavy Coins', 100, '+2 damage.', { damage: 2 }),
      tier('Double Toss', 260, 'Throws at 2 targets; +20% attack speed.', { projectiles: 1, rateMul: 1.2 }),
      tier('Gold Rush', 800, 'Solid gold coins ignore 2 armor, +3 damage, pierce 2 more.', { armorPen: 2, damage: 3, pierce: 2 }),
      tier('Jackpot', 2400, '20% crits for ×3, +6 damage, +40 coins per wave.', { crit: { chance: 0.2, mul: 3 }, damage: 6, income: { perWave: 40 } }),
      tier('Fortune\'s Favourite', 8500, 'A coin storm: +60% speed, 4 targets, +10 damage, +100 coins per wave.', { rateMul: 1.6, projectiles: 2, damage: 10, income: { perWave: 100 } }),
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
  title: 'Firework Demolitionist',
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
    hair: '#ff3b3b', hairShade: '#b51f2a', eyes: '#ffb703', skin: '#ffe3d1',
    outfit: '#ff8c42', outfitShade: '#d2601a', accent: '#ffd23f', halo: '#ff9f1c', weapon: '#c1121f',
  },
  look: {
    hairStyle: 'twintails', bangs: 'swept', accessory: 'horns', outfit: 'jumpsuit', weapon: 'fan',
    halo: 'flame', eyeStyle: 'sharp', expression: 'smug',
  },
  bio: 'President of the pyrotechnics club. Scarlet twintails, little ember-horn hair clips (she insists they are real), soot-smudged orange demolition overalls and a steel war-fan that flings fireballs. She treats every wave as a fireworks show.',
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
      tier('Grand Finale', 3200, '+10 damage and huge blasts that may stun (20%, 0.3s).', { damage: 10, splash: 0.5, status: [S.stun(0.3, 0.2)] }),
      tier('Hanabi Sky Festival', 12000, 'A five-shell firework barrage that also bursts in the sky to hit flyers.', { projectiles: 3, damage: 20, splash: 0.6, rateMul: 1.3, canHitAir: true }),
    ]),
    path('wildfire', 'Wildfire', 'Lingering burns', [
      tier('Hot Coals', 120, 'Burns deal 3/s for 2.5s.', { status: [S.burn(3, 2.5)] }),
      tier('Kindling', 280, '+15% attack speed.', { rateMul: 1.15 }),
      tier('Napalm Bloom', 900, 'Burns deal 6/s for 3.5s; +0.2 range.', { status: [S.burn(6, 3.5)], range: 0.2 }),
      tier('Phoenix Feather', 2800, 'Fireballs arc high enough to hit flyers; burns 10/s; +4 damage.', { canHitAir: true, status: [S.burn(10, 4)], damage: 4 }),
      tier('Inferno Queen', 10000, 'Burns 25/s for 5s, wider blasts, +40% attack speed.', { status: [S.burn(25, 5)], splash: 0.5, rateMul: 1.4, damage: 6 }),
    ]),
    path('rocketry', 'Rocket Science', 'Range, speed and armor', [
      tier('Long Fuse', 100, '+0.4 range.', { range: 0.4 }),
      tier('Quick Loader', 260, '+20% attack speed.', { rateMul: 1.2 }),
      tier('Shaped Charge', 850, 'Ignores 3 armor and cracks it (-1, stacks ×3).', { armorPen: 3, status: [S.shred(1, 3)] }),
      tier('Rocket Barrage', 2600, 'Rockets fire in pairs at two targets; +35% attack speed, faster rockets, +0.6 range.', { projectiles: 1, rateMul: 1.35, projectileSpeed: 8, range: 0.6 }),
      tier('Skybreaker Missile', 9500, 'Guided missiles: +40 damage, hit flyers, ×1.4 vs bosses, ×1.5 vs barriers.', { damage: 40, canHitAir: true, bossMul: 1.4, barrierMul: 1.5, splash: 0.4 }),
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
  title: 'Coral Battery',
  kind: 'tower',
  rarity: 'SR',
  adult: false,
  role: 'artillery',
  attackType: 'blast',
  element: 'water',
  placement: 'water',
  materialFamily: 'ember',
  capabilities: ['water', 'barrierBreak'],
  pathCapabilities: ['armorPen', 'armorShred', 'antiAir', 'stun'],
  acquisition: free('1-5', 'Joins after 1-5 to teach water placement on the Lakeshore; later her shells crack armor and barriers.'),
  palette: {
    hair: '#ff7f6e', hairShade: '#d94f45', eyes: '#1d7fa8', skin: '#ffe4d6',
    outfit: '#ffffff', outfitShade: '#cfe0ee', accent: '#1d4e89', halo: '#7fd6ff', weapon: '#5c6b7a',
  },
  look: {
    hairStyle: 'side', bangs: 'swept', accessory: 'goggles', outfit: 'sailor', weapon: 'cannon',
    halo: 'wave', eyeStyle: 'round', expression: 'determined',
  },
  bio: 'A marine cadet who mans a shoulder cannon twice her size from a little coral raft. Coral-pink side ponytail, diving goggles pushed up on her forehead and a crisp navy-trimmed sailor uniform. Her shells crack orc plate and shatter barriers so her friends can finish the job.',
  personality: 'Serious, by-the-book and secretly delighted by loud noises.',
  quote: 'Shell loaded! Armor\'s about to have a very bad day.',
  tips: [
    'Deploys on water only, and her shells reach far.',
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
      tier('Siege Breaker', 3500, 'Shred -3, ×1.5 vs barriers, +10 damage.', { status: [S.shred(3, 5)], barrierMul: 1.5, damage: 10 }),
      tier('Fortress Fall', 12500, 'Shred -5 and Brittle +20% for the whole team; +50 damage, +30% speed, ×1.5 vs barriers.', { status: [S.shred(5, 6), S.vulnerable(0.2, 4)], damage: 50, rateMul: 1.3, barrierMul: 1.5 }),
    ]),
    path('frag', 'Wide Fragmentation', 'Splash and flak', [
      tier('Packed Shrapnel', 140, '+0.3 splash.', { splash: 0.3 }),
      tier('Spread Charge', 300, '+3 damage.', { damage: 3 }),
      tier('Fragmentation Rounds', 1000, '+0.6 splash, +3 damage; 15% chance to stun for 0.25s.', { splash: 0.6, damage: 3, status: [S.stun(0.25, 0.15)] }),
      tier('Air-Burst Flak', 3000, 'Shells burst mid-air to hit flyers; +40% attack speed, +0.4 splash.', { canHitAir: true, rateMul: 1.4, splash: 0.4 }),
      tier('Carpet Bombardment', 11000, 'Four shells per salvo at different targets, +18 damage, +0.8 splash.', { projectiles: 3, damage: 18, splash: 0.8, rateMul: 1.2 }),
    ]),
    path('siege', 'Concentrated Siege', 'Huge single shells', [
      tier('Range Finder', 120, '+0.6 range.', { range: 0.6 }),
      tier('Bigger Bore', 320, '+6 damage.', { damage: 6 }),
      tier('Siege Mortar', 1200, '+16 damage, +1 range, +25% against elites.', { damage: 16, range: 1, eliteMul: 1.25 }),
      tier('Dreadnought Shell', 3800, '+40 damage, ×1.3 vs bosses, 25% chance to stun for 0.6s.', { damage: 40, bossMul: 1.3, status: [S.stun(0.6, 0.25)] }),
      tier('Leviathan Cannon', 14000, '+120 damage, ×1.5 vs bosses, +2 range; every shell knocks enemies back.', { damage: 120, bossMul: 1.5, eliteMul: 1.3, range: 2, splash: 0.5, knockback: 0.5 }),
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
  title: 'Shadow Courier',
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
    hair: '#3d3552', hairShade: '#221d30', eyes: '#b8a1ff', skin: '#f5ddd2',
    outfit: '#2b2a3d', outfitShade: '#191826', accent: '#8a5cf6', halo: '#c4b5fd', weapon: '#c0c7d6',
  },
  look: {
    hairStyle: 'short', bangs: 'messy', accessory: 'catEars', outfit: 'hoodie', weapon: 'shuriken',
    halo: 'moon', eyeStyle: 'sharp', expression: 'smug',
  },
  bio: 'The courier club\'s fastest runner — and, unofficially, a ninja. Charcoal-violet short hair, a black cat-ear hood and an oversized hoodie that hides a bandolier of shuriken. Her senses pick out veiled things that slip past everyone else.',
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
      tier('Blade Rain', 3000, '7 targets, +50% attack speed, +2 damage.', { projectiles: 2, rateMul: 1.5, damage: 2 }),
      tier('Thousand Shadows', 10500, 'Shadow clones join in: 13 targets, +60% speed, +5 damage, +2 pierce.', { projectiles: 6, rateMul: 1.6, damage: 5, pierce: 2 }),
    ]),
    path('shadowmark', 'Shadow Mark', 'Reveal and mark', [
      tier('Keen Senses', 120, '+0.4 range.', { range: 0.4 }),
      tier('Shadow Step', 300, '+1 damage.', { damage: 1 }),
      tier('Unmasking Kunai', 900, 'Hits reveal veiled foes for everyone (3s) and mark them (+10% damage taken).', { reveal: 3, mark: { bonus: 0.1, duration: 3 } }),
      tier('Assassin\'s Mark', 2700, 'Mark +20% for 4s, ×1.4 vs elites, +4 damage.', { mark: { bonus: 0.2, duration: 4 }, eliteMul: 1.4, damage: 4 }),
      tier('Night Sovereign', 9000, 'Mark +30%, reveal lasts 6s, +10 damage, 15% crits ×2.5.', { mark: { bonus: 0.3, duration: 5 }, reveal: 3, damage: 10, crit: { chance: 0.15, mul: 2.5 } }),
    ]),
    path('kunai', 'Kunai Craft', 'Armor-piercing steel', [
      tier('Tempered Steel', 130, '+1 damage.', { damage: 1 }),
      tier('Weighted Kunai', 280, 'Ignores 1 armor.', { armorPen: 1 }),
      tier('Paralytic Kunai', 850, '15% chance to stun for 0.2s; ignores 1 more armor; +2 damage.', { status: [S.stun(0.2, 0.15)], armorPen: 1, damage: 2 }),
      tier('Kusarigama', 2600, 'Chained blades: +4 pierce, +5 damage, ignores 2 more armor.', { pierce: 4, damage: 5, armorPen: 2 }),
      tier('Black Lotus', 9500, '+16 damage, 25% stun for 0.5s, ignores 3 more armor, +30% speed.', { damage: 16, status: [S.stun(0.5, 0.25)], armorPen: 3, rateMul: 1.3 }),
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
  title: 'Lantern-Float Lookout',
  kind: 'tower',
  rarity: 'SR',
  adult: false,
  role: 'support',
  attackType: 'mystic',
  element: 'water',
  placement: 'water',
  materialFamily: 'charm',
  capabilities: ['water', 'detection', 'antiAir'],
  pathCapabilities: ['reveal', 'buff', 'silence', 'slow', 'stun'],
  acquisition: free('3-2', 'Joins after 3-2 as the shrine\'s veils grow thick — her aura shares Veil Sight with nearby girls.'),
  palette: {
    hair: '#b5598e', hairShade: '#7f3a63', eyes: '#ff9ec7', skin: '#ffe6dc',
    outfit: '#e8f6ff', outfitShade: '#b6dbef', accent: '#ff7eb6', halo: '#ffc2dd', weapon: '#ff9cc8',
  },
  look: {
    hairStyle: 'side', bangs: 'hime', accessory: 'flower', outfit: 'dress', weapon: 'parasol',
    halo: 'petal', eyeStyle: 'sleepy', expression: 'smile',
  },
  bio: 'A gentle lifeguard-in-training who floats on a lotus raft beneath a plum-pink parasol hung with tiny lanterns. Plum side ponytail, plum blossoms behind one ear and a breezy pale-blue summer dress. Her lantern-lit ripples let every girl nearby see through veils.',
  personality: 'Dreamy and unhurried, hums sea shanties, and notices absolutely everything.',
  quote: 'Nothing hides in my waters~',
  tips: [
    'Water only. Every girl inside her aura gains Veil Sight.',
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
      tier('Moonlit Beacon', 3000, 'Aura reaches 4.5 tiles and gives +10% range; reveal +2s.', { aura: { range: 4.5, rangeMul: 1.1 }, reveal: 2 }),
      tier('Sea of Lanterns', 9500, 'Aura reaches 6 tiles: +15% range, +10% damage; pulses silence for 0.8s.', { aura: { range: 6, rangeMul: 1.15, dmgMul: 1.1 }, reveal: 3, silence: 0.8 }),
    ]),
    path('plumrain', 'Plum Rain', 'Team buffs', [
      tier('Warm Current', 140, 'Aura: +5% attack speed.', { aura: { rateMul: 1.05 } }),
      tier('Blossom Shower', 320, 'Aura: +5% damage.', { aura: { dmgMul: 1.05 } }),
      tier('Spring Tide', 1100, 'Aura: +10% attack speed, +5% damage.', { aura: { rateMul: 1.1, dmgMul: 1.05 } }),
      tier('Festival of Plums', 3400, 'Aura: +12% damage, +8% attack speed.', { aura: { dmgMul: 1.12, rateMul: 1.08 } }),
      tier('Blooming Ocean', 11000, 'Aura: +15% damage and speed, +10% range, 5% cheaper upgrades.', { aura: { dmgMul: 1.15, rateMul: 1.15, rangeMul: 1.1, costCut: 0.05 } }),
    ]),
    path('ripples', 'Undertow Ripples', 'Water control', [
      tier('Ripples', 100, '+1 damage.', { damage: 1 }),
      tier('Drag Current', 260, 'Pulses slow by 20% for 1.5s.', { status: [S.slow(0.2, 1.5)] }),
      tier('Whirl Ward', 850, 'Slow 35%; pulses push enemies back 0.15 tiles.', { status: [S.slow(0.35, 2)], knockback: 0.15 }),
      tier('Maelstrom Bloom', 2600, '15% chance to stun for 0.4s; +4 damage, 4 more targets.', { status: [S.stun(0.4, 0.15)], damage: 4, maxTargets: 4 }),
      tier('Tidal Sanctuary', 9000, '50% slows for 3s, strong push-back, +10 damage, +0.6 range.', { status: [S.slow(0.5, 3)], knockback: 0.4, damage: 10, range: 0.6, maxTargets: 10 }),
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
  title: 'Silent Overwatch',
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
    hair: '#f2f2f7', hairShade: '#c2c4d6', eyes: '#4fd1c5', skin: '#fbe8de',
    outfit: '#33415c', outfitShade: '#1f2a40', accent: '#e2c275', halo: '#b8f2e6', weapon: '#2d3142',
  },
  look: {
    hairStyle: 'long', bangs: 'straight', accessory: 'beret', outfit: 'blazer', weapon: 'rifle',
    halo: 'eye', eyeStyle: 'sleepy', expression: 'calm',
  },
  bio: 'Ace of the rifle team. Long silver-white hair under a navy beret, a gold-buttoned military-cut blazer, a scope-shaped halo, and a long rifle taller than she is. She speaks in single sentences and never misses the target that matters most.',
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
      tier('Deadeye', 4000, '+60 damage, ×1.4 vs bosses, +10% crits at ×3.', { damage: 60, bossMul: 1.4, crit: { chance: 0.1, mul: 3 } }),
      tier('Cross-Map Execution', 14000, '+250 damage, ×1.4 elites, ×1.3 bosses; every shot staggers (0.6s stun) and ignores 6 more armor.', { damage: 250, eliteMul: 1.4, bossMul: 1.3, armorPen: 6, status: [S.stun(0.6)] }),
    ]),
    path('spotter', 'Spotter\'s Mark', 'Marked targets take more allied damage', [
      tier('Spotter Scope', 120, '+1 range.', { range: 1 }),
      tier('Tracer Round', 300, '+4 damage.', { damage: 4 }),
      tier('Spotter\'s Mark', 1000, 'Thermal scope (Veil Sight); marked foes take +15% damage from everyone for 4s.', { detection: true, mark: { bonus: 0.15, duration: 4 } }),
      tier('Kill Zone', 3200, 'Mark +25% for 6s; shots reveal veiled foes for 4s.', { mark: { bonus: 0.25, duration: 6 }, reveal: 4 }),
      tier('Overwatch Network', 11000, 'Mark +40% for 8s; girls within 4 tiles gain Veil Sight and +10% range; +20 damage.', { mark: { bonus: 0.4, duration: 8 }, aura: { range: 4, detection: true, rangeMul: 1.1 }, damage: 20 }),
    ]),
    path('followup', 'Follow-up Shots', 'Faster follow-ups', [
      tier('Bolt Polish', 130, '+20% attack speed.', { rateMul: 1.2 }),
      tier('Quick Cycle', 320, '+20% attack speed.', { rateMul: 1.2 }),
      tier('Double Tap', 1100, 'Fires at the two highest-priority targets; +15% attack speed.', { projectiles: 1, rateMul: 1.15 }),
      tier('Semi-Auto Conversion', 3400, '+80% attack speed, +4 damage; rounds over-penetrate 2 more enemies.', { rateMul: 1.8, damage: 4, pierce: 2 }),
      tier('Silver Storm', 12000, 'Four targets per volley, double attack speed, +12 damage, +15% crits.', { projectiles: 2, rateMul: 2, damage: 12, crit: { chance: 0.15, mul: 2 } }),
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
  title: 'Verdant Apothecary',
  kind: 'tower',
  rarity: 'SR',
  adult: false,
  role: 'alchemist',
  attackType: 'mystic',
  element: 'poison',
  placement: 'land',
  materialFamily: 'rune',
  capabilities: ['antiHeal'],
  pathCapabilities: ['armorShred', 'armorPen', 'barrierBreak', 'antiAir', 'slow', 'stun'],
  acquisition: free('4-5', 'Joins after 4-5, before the regenerating, siphoning ghouls of Gloomfen Marsh.'),
  palette: {
    hair: '#7bd389', hairShade: '#3fa35b', eyes: '#2e8b57', skin: '#ffe6d5',
    outfit: '#f4f1de', outfitShade: '#d6d1b1', accent: '#9b5de5', halo: '#b9fbc0', weapon: '#80ed99',
  },
  look: {
    hairStyle: 'braid', bangs: 'split', accessory: 'goggles', outfit: 'apron', weapon: 'flask',
    halo: 'leaf', eyeStyle: 'round', expression: 'smug',
  },
  bio: 'Self-proclaimed genius of the alchemy lab. Mint-green twin braids, brass lab goggles, a canvas apron covered in suspicious stains and a belt of bubbling flasks. Her brews ignore armor and stop monsters from healing.',
  personality: 'Curious, chaotic and proud of it; labels every flask "probably safe".',
  quote: 'Hypothesis: this will melt. Let\'s test it!',
  tips: [
    'Poison ignores armor and stops regeneration and siphon healing.',
    'Lob flasks where enemies bunch up — poison sticks to everyone in the splash.',
    'Corrosion shreds armor for the whole team.',
  ],
  base: stats({
    cost: 420, behavior: 'projectile', damage: 2, rate: 0.8, range: 3.0, splash: 0.7,
    projectileSpeed: 9, canHitAir: false, status: [S.poison(3, 4)],
  }),
  paths: [
    path('toxicology', 'Toxicology', 'Stronger poison', [
      tier('Concentrate', 130, 'Poison deals 4/s for 4.5s.', { status: [S.poison(4, 4.5)] }),
      tier('Wide Flask', 300, '+0.3 splash.', { splash: 0.3 }),
      tier('Wither Bloom', 950, 'Poison deals 8/s for 5s; +0.3 splash.', { status: [S.poison(8, 5)], splash: 0.3 }),
      tier('Plague Garden', 3000, 'Poison deals 16/s for 6s; +30% attack speed, +0.4 splash.', { status: [S.poison(16, 6)], rateMul: 1.3, splash: 0.4 }),
      tier('Verdant Apocalypse', 10500, 'Poison deals 40/s for 7s in enormous clouds; +30% attack speed.', { status: [S.poison(40, 7)], splash: 0.8, rateMul: 1.3, damage: 6 }),
    ]),
    path('corrosion', 'Corrosion', 'Acid that dissolves armor', [
      tier('Acid Splash', 120, '+2 damage.', { damage: 2 }),
      tier('Etching Agent', 280, 'Acid cracks armor: -1 for 3s (stacks ×3).', { status: [S.shred(1, 3)] }),
      tier('Melting Point', 900, 'Shred -2 for 4s; ignores 2 armor.', { status: [S.shred(2, 4)], armorPen: 2 }),
      tier('Philosopher\'s Acid', 2800, 'Shred -3 and Brittle +15%; +6 damage.', { status: [S.shred(3, 5), S.vulnerable(0.15, 3)], damage: 6 }),
      tier('Universal Solvent', 9500, 'Shred -5, Brittle +25%, +16 damage, ×1.5 vs barriers.', { status: [S.shred(5, 6), S.vulnerable(0.25, 4)], damage: 16, barrierMul: 1.5 }),
    ]),
    path('fieldkit', 'Field Kit', 'Mist, flyers and paralysis', [
      tier('Long Toss', 100, '+0.4 range.', { range: 0.4 }),
      tier('Quick Mix', 260, '+20% attack speed.', { rateMul: 1.2 }),
      tier('Drifting Mist', 850, 'Gas clouds rise high enough to hit flyers and slow by 25% for 2s.', { canHitAir: true, status: [S.slow(0.25, 2)] }),
      tier('Paralysis Spore', 2600, '20% chance to stun for 0.4s; +0.4 splash, +20% attack speed.', { status: [S.stun(0.4, 0.2)], splash: 0.4, rateMul: 1.2 }),
      tier('Elixir Barrage', 9000, 'Four flasks per throw, +50% attack speed, poison 10/s, +6 damage.', { projectiles: 3, rateMul: 1.5, status: [S.poison(10, 5)], damage: 6 }),
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
  title: 'Bell Seal Trapper',
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
    hair: '#f4a261', hairShade: '#c9752f', eyes: '#e76f51', skin: '#ffe8da',
    outfit: '#fff6f0', outfitShade: '#f0d3c4', accent: '#d62828', halo: '#ffd166', weapon: '#e9c46a',
  },
  look: {
    hairStyle: 'twintails', bangs: 'straight', accessory: 'foxEars', outfit: 'kimono', weapon: 'bell',
    halo: 'ring', eyeStyle: 'sparkle', expression: 'cheerful',
  },
  bio: 'A shrine-trained seal maker with a fox-ear headpiece and golden bells woven into her orange twintails. In a red-and-white kimono she scatters ofuda traps along the path near the exit; every jingle means something just got caught.',
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
      tier('Chain Mines', 3000, 'Up to 10 traps, +30 damage, sets traps 40% faster.', { trap: { max: 4, damage: 30 }, rateMul: 1.4 }),
      tier('Grand Bell Detonation', 11000, 'Traps +120 damage, huge blasts, 4 more traps, ×1.3 vs bosses.', { trap: { damage: 120, splash: 1, max: 4 }, rateMul: 1.3, bossMul: 1.3 }),
    ]),
    path('binding', 'Binding Traps', 'Slow and root', [
      tier('Sticky Seal', 110, 'Traps slow by 30% for 2s.', { trap: { status: [S.slow(0.3, 2)] } }),
      tier('Quick Set', 280, 'Sets traps 25% faster.', { rateMul: 1.25 }),
      tier('Binding Bell', 900, 'Traps root enemies in place (1s stun).', { trap: { status: [S.stun(1)] } }),
      tier('Sealing Net', 2800, 'Slow 50% for 3s, wider nets, 2 more traps.', { trap: { status: [S.slow(0.5, 3)], splash: 0.4, max: 2 } }),
      tier('Thousand Bell Prison', 10000, 'Traps freeze for 2.5s; 4 more traps, wider seals, +30% set speed.', { trap: { status: [S.freeze(2.5)], max: 4, splash: 0.6 }, rateMul: 1.3 }),
    ]),
    path('seals', 'Spirit Seals', 'Reveal and silence', [
      tier('Ofuda Ink', 100, '+0.4 range.', { range: 0.4 }),
      tier('Sacred Paper', 260, 'Traps +4 damage.', { trap: { damage: 4 } }),
      tier('Revealing Seal', 850, 'Veil Sight; traps reveal veiled foes for 4s.', { detection: true, trap: { status: [S.reveal(4)] } }),
      tier('Exorcism Seal', 2600, 'Seals turn Holy (great vs spirits) and silence for 3s; traps +16 damage.', { attackType: 'holy', trap: { status: [S.silence(3)], damage: 16 } }),
      tier('Great Barrier Seal', 9500, 'Traps +60 damage, silence 5s, Brittle +25%, 4 more traps.', { trap: { damage: 60, status: [S.silence(5), S.vulnerable(0.25, 4)], max: 4 }, rateMul: 1.3 }),
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
  title: 'Thunderdrum Prodigy',
  kind: 'tower',
  rarity: 'SR',
  adult: false,
  role: 'chain',
  attackType: 'mystic',
  element: 'lightning',
  placement: 'land',
  materialFamily: 'rune',
  capabilities: ['antiAir', 'multiHit'],
  pathCapabilities: ['armorPen', 'stun', 'silence'],
  acquisition: GACHA_ONLY,
  palette: {
    hair: '#ffd60a', hairShade: '#c9a000', eyes: '#4cc9f0', skin: '#ffe6d8',
    outfit: '#22223b', outfitShade: '#13132a', accent: '#ffd60a', halo: '#fff3a3', weapon: '#9ad1ff',
  },
  look: {
    hairStyle: 'buns', bangs: 'messy', accessory: 'hairpin', outfit: 'hoodie', weapon: 'staff',
    halo: 'bolt', eyeStyle: 'sparkle', expression: 'cheerful',
  },
  bio: 'The taiko club\'s star drummer, who turned her rhythm into lightning. Electric-yellow hair in two drum-round buns, a zig-zag bolt hairpin, a dark hoodie with glowing trim and a lightning-rod staff. Her bolts leap from monster to monster in time with the beat.',
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
      tier('Storm Network', 3000, '+4 jumps, +30% attack speed, +3 damage.', { chain: 4, rateMul: 1.3, damage: 3 }),
      tier('Raijin\'s Wrath', 11000, '+10 jumps, +12 damage, +40% attack speed, 50% shock.', { chain: 10, damage: 12, rateMul: 1.4, status: [S.shock(0.3, 0.5)] }),
    ]),
    path('overcharge', 'Overcharge', 'Heavy single bolts', [
      tier('Capacitor', 140, '+2 damage.', { damage: 2 }),
      tier('High Voltage', 320, '+2 damage, ignores 1 armor.', { damage: 2, armorPen: 1 }),
      tier('Thunderclap', 1000, '+5 damage, 25% chance to stun for 0.5s, ignores 1 more armor.', { damage: 5, status: [S.stun(0.5, 0.25)], armorPen: 1 }),
      tier('Lightning Lance', 3200, 'Becomes a piercing lightning lance (beam): +14 damage, pierces 4, +25% vs elites.', { behavior: 'beam', damage: 14, pierce: 3, eliteMul: 1.25 }),
      tier('Heaven\'s Drum', 11500, '+40 damage, +30% attack speed, 35% stun for 0.8s, ×1.3 vs bosses.', { damage: 40, rateMul: 1.3, status: [S.stun(0.8, 0.35)], bossMul: 1.3 }),
    ]),
    path('rhythm', 'Storm Rhythm', 'Tempo and interrupts', [
      tier('Tempo', 120, '+15% attack speed.', { rateMul: 1.15 }),
      tier('Crackle', 280, 'Shock chance rises to 40% (0.2s).', { status: [S.shock(0.2, 0.4)] }),
      tier('Drum Roll', 900, '+30% attack speed; jolts silence blinks and siphons for 0.5s.', { rateMul: 1.3, silence: 0.5 }),
      tier('Thunder Festival', 2800, '+40% attack speed, +2 jumps, silence +0.5s.', { rateMul: 1.4, chain: 2, silence: 0.5 }),
      tier('Endless Thunder', 10000, 'Double attack speed, +8 damage, +3 jumps; struck foes turn Brittle (+15%).', { rateMul: 2, damage: 8, chain: 3, status: [S.vulnerable(0.15, 3)] }),
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
  title: 'Shrine Blessing Keeper',
  kind: 'tower',
  rarity: 'SR',
  adult: false,
  role: 'enchanter',
  attackType: 'holy',
  element: null,
  placement: 'land',
  materialFamily: 'charm',
  capabilities: ['buff', 'antiAir'],
  pathCapabilities: ['silence', 'reveal', 'detection', 'cleanse'],
  acquisition: GACHA_ONLY,
  palette: {
    hair: '#1b1b2f', hairShade: '#0b0b18', eyes: '#c1121f', skin: '#fff0e8',
    outfit: '#ffffff', outfitShade: '#e6e6ef', accent: '#d90429', halo: '#ffd6e7', weapon: '#f5f0e1',
  },
  look: {
    hairStyle: 'hime', bangs: 'hime', accessory: 'ribbon', outfit: 'miko', weapon: 'gohei',
    halo: 'petal', eyeStyle: 'closed', expression: 'calm',
  },
  bio: 'The shrine maiden who blesses the academy gates every morning. Long black hime-cut hair tied with a big red-and-white ribbon, classic white haori and red hakama, and a gohei wand trailing paper streamers. She rarely fights herself — girls near her simply hit harder.',
  personality: 'Serene and formal, with an unexpected competitive streak at festival games.',
  quote: 'May the blossoms guide your aim.',
  tips: [
    'Every girl within her aura deals +10% damage — place her in the middle of your best girls.',
    'Sacred Grounds gives Veil Sight and cleanses sabotage for the whole cluster.',
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
      tier('Kagura Dance', 3400, 'Aura +12% attack speed and reaches 3.5 tiles.', { aura: { rateMul: 1.12, range: 3.5 } }),
      tier('Goddess\'s Festival', 11500, 'Aura +20% damage, +10% speed and range, reaching 4.2 tiles.', { aura: { dmgMul: 1.2, rateMul: 1.1, rangeMul: 1.1, range: 4.2 } }),
    ]),
    path('purify', 'Purification', 'Holy talismans', [
      tier('Ofuda', 120, '+2 damage.', { damage: 2 }),
      tier('Purifying Talisman', 300, '+25% attack speed.', { rateMul: 1.25 }),
      tier('Exorcism Rite', 950, 'Talismans silence for 0.8s and reveal veiled foes for 2s.', { silence: 0.8, reveal: 2 }),
      tier('Divine Wind', 3000, 'Three talismans per throw, +6 damage, +2 pierce.', { projectiles: 2, damage: 6, pierce: 2 }),
      tier('Amaterasu\'s Mirror', 10000, 'A mirror of sunlight: a piercing holy beam, +20 damage, +1.5 range, silence +1s.', { behavior: 'beam', damage: 20, pierce: 6, silence: 1, range: 1.5 }),
    ]),
    path('grounds', 'Sacred Grounds', 'Utility aura', [
      tier('Incense', 100, 'Aura: +5% range.', { aura: { rangeMul: 1.05 } }),
      tier('Wind Chime', 260, 'Girls in her aura pay 5% less for upgrades.', { aura: { costCut: 0.05 } }),
      tier('Watchful Kami', 900, 'Aura grants Veil Sight.', { aura: { detection: true } }),
      tier('Purifying Bells', 2700, 'Aura cleanses sabotage and disables; +5% range.', { aura: { cleanse: true, rangeMul: 1.05 } }),
      tier('Heavenly Shrine', 9000, 'Aura reaches 4 tiles: 15% cheaper upgrades in total, +8% damage and speed.', { aura: { costCut: 0.1, range: 4, dmgMul: 1.08, rateMul: 1.08 } }),
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
  title: 'Firefly Exorcist',
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
    hair: '#2d3e75', hairShade: '#1a2550', eyes: '#ffe66d', skin: '#fdeee6',
    outfit: '#f1ecff', outfitShade: '#cbbff0', accent: '#ffe66d', halo: '#fff59d', weapon: '#ffd93d',
  },
  look: {
    hairStyle: 'wavy', bangs: 'split', accessory: 'hood', outfit: 'robe', weapon: 'lantern',
    halo: 'ring', eyeStyle: 'round', expression: 'calm',
  },
  bio: 'A soft-spoken exorcist who carries a paper lantern full of fireflies. Wavy midnight-blue hair with glowing tips under a sheer ceremonial veil-hood, flowing white robes, and golden eyes that see the spirit world. Her holy light reveals veiled spirits and silences oni fields.',
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
      tier('Requiem Lanterns', 3600, '+14 damage, +30% attack speed; struck foes turn Brittle (+10%).', { damage: 14, rateMul: 1.3, status: [S.vulnerable(0.1, 2)] }),
      tier('Thousand Souls Festival', 13000, '+40 damage, +1.2 range, +30% attack speed; pulses hit everything in range.', { damage: 40, range: 1.2, rateMul: 1.3, maxTargets: 40 }),
    ]),
    path('prayer', 'Silent Prayer', 'Silence and stillness', [
      tier('Hush', 150, 'Silence lasts 0.4s longer.', { silence: 0.4 }),
      tier('Calm Waters', 340, 'Pulses slow by 20% for 1.5s.', { status: [S.slow(0.2, 1.5)] }),
      tier('Sealing Chant', 1100, 'Silence +1s; 20% chance to stun for 0.3s.', { silence: 1, status: [S.stun(0.3, 0.2)] }),
      tier('Quiet Night', 3400, 'Silence +1.5s; struck foes turn Brittle (+15%).', { silence: 1.5, status: [S.vulnerable(0.15, 3)] }),
      tier('Absolute Stillness', 12000, 'Silence +3s, 35% stun for 0.8s, 40% slows, +1 range.', { silence: 3, status: [S.stun(0.8, 0.35), S.slow(0.4, 3)], range: 1 }),
    ]),
    path('guiding', 'Guiding Lights', 'Team support', [
      tier('Glowing Path', 140, '+0.3 range.', { range: 0.3 }),
      tier('Shared Glow', 320, 'Girls within 3 tiles gain +5% range.', { aura: { range: 3, rangeMul: 1.05 } }),
      tier('Will-o\'-Wisps', 1000, 'Aura grants Veil Sight; reveals last 3s longer.', { aura: { detection: true }, reveal: 3 }),
      tier('Firefly Grove', 3200, 'Aura +12% damage and cleanses sabotage.', { aura: { dmgMul: 1.12, cleanse: true } }),
      tier('Night of Fireflies', 11000, 'Aura +15% damage, +12% speed, 4.5 tiles; reveals +4s.', { aura: { dmgMul: 1.15, rateMul: 1.12, range: 4.5 }, reveal: 4 }),
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
  title: 'Crimson Maple Duelist',
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
    hair: '#7a1f2b', hairShade: '#4a0f18', eyes: '#f4a261', skin: '#fde7da',
    outfit: '#1f1b24', outfitShade: '#0f0d12', accent: '#e85d04', halo: '#ff9e57', weapon: '#e5e5e5',
  },
  look: {
    hairStyle: 'ponytail', bangs: 'split', accessory: 'ribbon', outfit: 'coat', weapon: 'rapier',
    halo: 'leaf', eyeStyle: 'sharp', expression: 'determined',
  },
  bio: 'Heir to an old fencing school. A high burgundy ponytail tied with a maple-orange ribbon, a long black duelist\'s coat with crimson lining, and a rapier that is never sheathed during a wave. She picks the strongest monster on the field and does not let go until it falls.',
  personality: 'Proud, honourable and intense — but she bows to every opponent, even slimes.',
  quote: 'You. Only you. En garde.',
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
      tier('Autumn Requiem', 3800, 'Ramp +20% per hit up to +200%; +30% attack speed, +8 damage.', { ramp: { per: 0.04, max: 0.5 }, rateMul: 1.3, damage: 8 }),
      tier('Crimson Eternity', 14000, '+24 damage, ramp +25% per hit up to +250%, ×1.5 vs bosses, +30% speed.', { damage: 24, ramp: { per: 0.05, max: 0.5 }, bossMul: 1.5, rateMul: 1.3 }),
    ]),
    path('flowing', 'Flowing Blade', 'Reach and precision', [
      tier('Light Step', 130, '+0.3 range.', { range: 0.3 }),
      tier('Flash Step', 340, '+4 damage.', { damage: 4 }),
      tier('Wind Severing', 1100, 'Air-cutting slashes reach flyers; +0.6 range.', { canHitAir: true, range: 0.6 }),
      tier('Iaijutsu Master', 3500, '+20% crit chance at ×2.5, +10 damage.', { crit: { chance: 0.2, mul: 2.5 }, damage: 10 }),
      tier('Thousand Leaves Draw', 12500, '+60% attack speed, +16 damage, +10% crits, +0.5 range.', { rateMul: 1.6, damage: 16, crit: { chance: 0.1, mul: 2.5 }, range: 0.5 }),
    ]),
    path('breaker', 'Guard Breaker', 'Armor and stuns', [
      tier('Heavy Hilt', 140, '+3 damage.', { damage: 3 }),
      tier('Pommel Strike', 320, '15% chance to stun for 0.2s.', { status: [S.stun(0.2, 0.15)] }),
      tier('Armor Cleaver', 1150, 'Slices plate open for everyone (-2 armor, stacks ×3); ignores 4 armor.', { status: [S.shred(2, 4)], armorPen: 4 }),
      tier('Guard Breaker', 3600, 'Brittle +20%, 25% stun for 0.5s, +6 damage.', { status: [S.vulnerable(0.2, 3), S.stun(0.5, 0.25)], damage: 6 }),
      tier('Heaven-Splitting Strike', 13500, '+60 damage, shred -5, ×1.4 vs elites, ×1.3 vs bosses.', { damage: 60, status: [S.shred(5, 6)], eliteMul: 1.4, bossMul: 1.3 }),
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
  title: 'Gadget Prodigy',
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
    hair: '#8d6e63', hairShade: '#5d4037', eyes: '#ffb300', skin: '#ffe5d4',
    outfit: '#ffb703', outfitShade: '#e09400', accent: '#264653', halo: '#ffd166', weapon: '#adb5bd',
  },
  look: {
    hairStyle: 'bob', bangs: 'messy', accessory: 'goggles', outfit: 'jumpsuit', weapon: 'wrench',
    halo: 'gear', eyeStyle: 'sparkle', expression: 'smile',
  },
  bio: 'Robotics club prodigy with a chestnut bob, tinted workshop goggles and a sunflower-yellow jumpsuit with far too many pockets. She builds sentry drones mid-battle, patches up sabotaged friends, and never goes anywhere without her giant wrench.',
  personality: 'Fast-talking and endlessly inventive; names every drone and grieves each one dramatically.',
  quote: 'Give me ten seconds and a wrench!',
  tips: [
    'She builds drones over time — place her early beside a long straight.',
    'Repair Bay tier 3 cleanses sabotage for every girl in her aura.',
    'Tesla Tower (tier 4) trades drone building for a chain-lightning coil.',
  ],
  base: stats({
    cost: 650, behavior: 'turret', damage: 3, rate: 0.25, range: 3.0, projectileSpeed: 16,
    canHitAir: true,
    turret: { max: 2, damage: 3, rate: 1.5, range: 2.6, attackType: 'pierce', status: [S.shock(0.1, 0.15)] },
  }),
  paths: [
    path('sentry', 'Sentry Works', 'More and better drones', [
      tier('Spare Parts', 160, '+1 drone (3 at once).', { turret: { max: 1 } }),
      tier('Better Barrels', 380, 'Drones +2 damage.', { turret: { damage: 2 } }),
      tier('Sentry Grid', 1200, '+2 drones, +0.5 drone range, drones fire 20% faster.', { turret: { max: 2, range: 0.5, rate: 1.2 } }),
      tier('Plasma Sentries', 3600, 'Drones +5 damage and fire 25% faster.', { turret: { damage: 5, rate: 1.25 } }),
      tier('Mecha-Fortress Protocol', 13000, '+4 drones (9 at once), +12 drone damage, +30% fire rate, +1 drone range.', { turret: { max: 4, damage: 12, rate: 1.3, range: 1 } }),
    ]),
    path('repair', 'Repair Bay', 'Cleanse and buffs', [
      tier('Toolbelt', 140, 'Girls within 2.6 tiles attack 5% faster.', { aura: { range: 2.6, rateMul: 1.05 } }),
      tier('Pit Crew', 320, 'Aura reaches 3 tiles and gives +5% range.', { aura: { range: 3, rangeMul: 1.05 } }),
      tier('Field Repairs', 1100, 'Aura cleanses sabotage and disables; +10% attack speed.', { aura: { cleanse: true, rateMul: 1.1 } }),
      tier('Signal Tower', 3400, 'Radar: aura grants Veil Sight and +10% range.', { aura: { detection: true, rangeMul: 1.1 } }),
      tier('Grand Workshop', 12000, 'Aura +15% damage, +10% speed, 8% cheaper upgrades; +2 drones.', { aura: { dmgMul: 1.15, rateMul: 1.1, costCut: 0.08 }, turret: { max: 2 } }),
    ]),
    path('tesla', 'Tesla Engineering', 'Lightning conversion', [
      tier('Copper Coils', 130, 'Drones +1 damage.', { turret: { damage: 1 } }),
      tier('Arc Capacitors', 300, 'Drones fire 20% faster.', { turret: { rate: 1.2 } }),
      tier('Storm Battery', 1000, 'Drones +3 damage and +0.5 range; Chika\'s own shots shock (25%).', { turret: { damage: 3, range: 0.5 }, status: [S.shock(0.25, 0.25)] }),
      tier('Tesla Tower', 3300, 'Stops building drones and becomes a tesla coil: mystic lightning chains through 5 enemies, ignoring 2 armor.', { behavior: 'chain', attackType: 'mystic', rateMul: 4, chain: 4, damage: 6, armorPen: 2 }),
      tier('Thunderforge Reactor', 12500, '+6 jumps, +24 damage, +50% attack speed, 30% stun for 0.5s.', { chain: 6, damage: 24, rateMul: 1.5, status: [S.stun(0.5, 0.3)] }),
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
