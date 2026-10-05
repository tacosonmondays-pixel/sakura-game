// Core game vocabulary shared by every module. Other files must reference these
// keys rather than inventing new ones (see CONTRACTS.md).

// ---------------------------------------------------------------------------
// Attack types × armor classes (the type chart)
// ---------------------------------------------------------------------------

export const ATTACK_TYPES = {
  blast: { id: 'blast', name: 'Blast', color: '#ff8a3d', desc: 'Explosives and shells. Breaks heavy formations; useless against spirits.' },
  pierce: { id: 'pierce', name: 'Pierce', color: '#3da5ff', desc: 'Arrows, bullets and shuriken. Finds gaps in scales; struggles against plate.' },
  slash: { id: 'slash', name: 'Slash', color: '#ff4d6d', desc: 'Blades and claws. Shreds lightly armored crowds; bounces off plate.' },
  mystic: { id: 'mystic', name: 'Mystic', color: '#9b6bff', desc: 'Arcane energy. Reliable against nearly everything except warded foes.' },
  holy: { id: 'holy', name: 'Holy', color: '#ffd84d', desc: 'Sacred light. Devastating to spirits and silences oni fields.' },
};

export const ARMOR_CLASSES = {
  light: { id: 'light', name: 'Light', color: '#8fd16a', desc: 'Soft bodies: slimes, goblins, beasts, plants.' },
  heavy: { id: 'heavy', name: 'Heavy', color: '#8a94a6', desc: 'Plate and stone: orcs, constructs.' },
  spectral: { id: 'spectral', name: 'Spectral', color: '#a8e6ff', desc: 'Half in the spirit world: ghosts, wraiths, ghouls.' },
  warded: { id: 'warded', name: 'Warded', color: '#c77dff', desc: 'Magically protected: fae, oni, shrine guardians.' },
  scaled: { id: 'scaled', name: 'Scaled', color: '#e0a458', desc: 'Hard scales with gaps: lizardfolk, wyverns, dragons.' },
};

/** Damage multiplier for attackType (row) against armorClass (column). */
export const TYPE_CHART = {
  blast: { light: 1.0, heavy: 1.5, spectral: 0.5, warded: 1.0, scaled: 1.0 },
  pierce: { light: 1.25, heavy: 0.75, spectral: 0.5, warded: 1.0, scaled: 1.5 },
  slash: { light: 1.5, heavy: 0.6, spectral: 0.5, warded: 1.0, scaled: 0.75 },
  mystic: { light: 1.0, heavy: 1.25, spectral: 1.0, warded: 0.5, scaled: 1.25 },
  holy: { light: 1.0, heavy: 1.0, spectral: 2.0, warded: 1.25, scaled: 0.75 },
};

export function typeMultiplier(attackType, armorClass) {
  return TYPE_CHART[attackType]?.[armorClass] ?? 1;
}

/** Human readable effectiveness label for UI. */
export function effectivenessLabel(mult) {
  if (mult >= 1.5) return 'Super effective';
  if (mult > 1) return 'Effective';
  if (mult === 1) return 'Normal';
  if (mult > 0.5) return 'Resisted';
  return 'Weak';
}

// ---------------------------------------------------------------------------
// Elements — carried by attacks as status effects. Separate from attack type.
// ---------------------------------------------------------------------------

export const ELEMENTS = {
  fire: { id: 'fire', name: 'Fire', color: '#ff6b35', status: 'burn' },
  frost: { id: 'frost', name: 'Frost', color: '#7fdbff', status: 'slow' },
  lightning: { id: 'lightning', name: 'Lightning', color: '#ffe066', status: 'shock' },
  poison: { id: 'poison', name: 'Poison', color: '#7bd389', status: 'poison' },
  water: { id: 'water', name: 'Water', color: '#4cc9f0', status: 'soak' },
};

// ---------------------------------------------------------------------------
// Status effects the sim understands (StatusSpec.type)
// ---------------------------------------------------------------------------

export const STATUSES = {
  slow: { name: 'Slowed', desc: 'Moves slower. amount = fraction removed (0.3 = 30% slower). Strongest slow wins.' },
  freeze: { name: 'Frozen', desc: 'Cannot move. Bosses take 25% duration.' },
  stun: { name: 'Stunned', desc: 'Cannot move or use abilities. Bosses take 25% duration.' },
  burn: { name: 'Burning', desc: 'Takes fire damage per second (dps). Respects armor class but ignores flat armor.' },
  poison: { name: 'Poisoned', desc: 'Takes damage per second ignoring armor, and cannot heal or regenerate.' },
  shock: { name: 'Shocked', desc: 'Very short stun (duration) used by lightning.' },
  soak: { name: 'Soaked', desc: 'Takes +15% frost and lightning damage.' },
  shred: { name: 'Armor broken', desc: 'Flat armor reduced by amount. Stacks up to 3 times.' },
  mark: { name: 'Marked', desc: 'Takes +bonus damage from every source.' },
  vulnerable: { name: 'Brittle', desc: 'Takes +bonus damage from every source (frost variant of mark).' },
  silence: { name: 'Silenced', desc: 'Fields, siphons, blinks and phasing are switched off.' },
  reveal: { name: 'Revealed', desc: 'Veiled enemy can be targeted by anyone.' },
};

// ---------------------------------------------------------------------------
// Roles (unit classes) and capabilities
// ---------------------------------------------------------------------------

export const ROLE_CATEGORIES = {
  dps: { name: 'DPS', color: '#ff5d73' },
  control: { name: 'Control', color: '#4cc9f0' },
  support: { name: 'Support', color: '#80ed99' },
  frag: { name: 'Frag', color: '#ff9f1c' },
  economy: { name: 'Economy', color: '#ffd166' },
  hero: { name: 'Hero', color: '#c77dff' },
};

export const ROLES = {
  vanguard: { name: 'Vanguard', category: 'hero', goodAgainst: 'Spirits and mixed waves', limitation: 'Short reach', desc: 'Frontline hero with holy cleaves.' },
  mystic: { name: 'Mystic', category: 'hero', goodAgainst: 'Armored and scaled foes', limitation: 'Weak to warded enemies', desc: 'Arcane hero with piercing beams.' },
  tideguard: { name: 'Tideguard', category: 'hero', goodAgainst: 'Fast enemies near water', limitation: 'Must stand in water', desc: 'Amphibious frost hero.' },
  marksman: { name: 'Marksman', category: 'dps', goodAgainst: 'Ordinary enemies, runners, crystal shells', limitation: 'Heavy armor shrugs off small hits', desc: 'Cheap, reliable single-target shooter.' },
  sniper: { name: 'Sniper', category: 'dps', goodAgainst: 'Casters, elites, bosses, armor', limitation: 'Overkills small fry; poor crowd coverage', desc: 'Map-wide heavy shots with priority targeting.' },
  cleaver: { name: 'Cleaver', category: 'dps', goodAgainst: 'Crowds at corners and choke points', limitation: 'Short reach; cannot hit flyers', desc: 'Melee sweeps that hit everything nearby.' },
  duelist: { name: 'Duelist', category: 'dps', goodAgainst: 'One tough enemy that stays in range', limitation: 'Overwhelmed by swarms', desc: 'Focused melee whose damage builds on the same target.' },
  controller: { name: 'Controller', category: 'control', goodAgainst: 'Fast goblins, blinkers, leaks', limitation: 'Low damage; bosses resist', desc: 'Slows and freezes.' },
  bombardment: { name: 'Bombardment', category: 'frag', goodAgainst: 'Dense swarms and reinforcements', limitation: 'Fire-warded foes, lone targets', desc: 'Explosive fireballs that leave burns.' },
  artillery: { name: 'Artillery', category: 'frag', goodAgainst: 'Armored formations and barriers', limitation: 'Slow; wasted on scattered runners', desc: 'Siege shells that break armor for the whole team.' },
  skirmisher: { name: 'Skirmisher', category: 'dps', goodAgainst: 'Scattered fast or hidden enemies', limitation: 'Low damage per hit vs armor', desc: 'Rapid multi-target attacks with innate detection.' },
  chain: { name: 'Chain Caster', category: 'dps', goodAgainst: 'Spread-out groups', limitation: 'Loses value against a lone target', desc: 'Lightning that jumps between enemies.' },
  enchanter: { name: 'Enchanter', category: 'support', goodAgainst: 'Making every nearby girl stronger', limitation: 'Cannot defend alone', desc: 'Buffs nearby allies.' },
  alchemist: { name: 'Alchemist', category: 'dps', goodAgainst: 'High HP, armor and healers', limitation: 'Needs time; some foes resist poison', desc: 'Poison and acid that ignore armor and stop healing.' },
  economy: { name: 'Economy', category: 'economy', goodAgainst: 'Funding a stronger late game', limitation: 'Delays early defense', desc: 'Generates coins every wave.' },
  exorcist: { name: 'Exorcist', category: 'control', goodAgainst: 'Spirits, veils and oni fields', limitation: 'Specialist, not a universal carry', desc: 'Holy pulses, reveal and silence.' },
  support: { name: 'Support', category: 'support', goodAgainst: 'Detection and team buffs', limitation: 'Cannot defend alone', desc: 'Utility aura (detection, range, speed).' },
  trapper: { name: 'Trapper', category: 'control', goodAgainst: 'Leaks near the exit; sappers', limitation: 'Needs time to set traps', desc: 'Stockpiles rune traps along the path.' },
  engineer: { name: 'Engineer', category: 'support', goodAgainst: 'Sabotage and long straight paths', limitation: 'Turrets are fragile in damage', desc: 'Builds sentries and repairs disabled allies.' },
};

export const CAPABILITIES = {
  detection: { name: 'Veil Sight', desc: 'Can target veiled enemies.' },
  antiAir: { name: 'Anti-Air', desc: 'Can hit airborne enemies.' },
  armorPen: { name: 'Armor Pierce', desc: 'Ignores some flat armor.' },
  armorShred: { name: 'Armor Break', desc: 'Lowers enemy armor for everyone.' },
  barrierBreak: { name: 'Barrier Break', desc: 'Deals bonus damage to barriers.' },
  slow: { name: 'Slow', desc: 'Slows or freezes enemies.' },
  stun: { name: 'Stun', desc: 'Stops enemies briefly.' },
  silence: { name: 'Silence', desc: 'Switches off fields, siphons, blinks and phasing.' },
  antiHeal: { name: 'Anti-Heal', desc: 'Stops regeneration and siphoning.' },
  reveal: { name: 'Reveal', desc: 'Strips veils so the whole team can hit.' },
  buff: { name: 'Buff', desc: 'Strengthens nearby allies.' },
  income: { name: 'Income', desc: 'Generates coins.' },
  cleanse: { name: 'Cleanse', desc: 'Removes sabotage and disables from allies.' },
  summon: { name: 'Summon', desc: 'Creates turrets or familiars.' },
  trap: { name: 'Traps', desc: 'Places traps on the path.' },
  water: { name: 'Water Deploy', desc: 'Can be placed on water.' },
  multiHit: { name: 'Rapid Hits', desc: 'Many small hits — good against crystal shells.' },
  priority: { name: 'Priority Targeting', desc: 'Can target casters and elites first.' },
};

// ---------------------------------------------------------------------------
// Enemy traits (EnemyDef.traits keys). Counters reference CAPABILITIES keys.
// ---------------------------------------------------------------------------

export const TRAITS = {
  armored: { name: 'Armored', desc: 'Flat damage reduction on every hit.', counters: ['armorPen', 'armorShred'] },
  barrier: { name: 'Barrier', desc: 'A separate shield pool that must be broken first. Blast deals +50% to barriers.', counters: ['barrierBreak'] },
  crystal: { name: 'Crystal Shell', desc: 'Damage per hit is capped until the shell shatters after enough hits.', counters: ['multiHit'] },
  veiled: { name: 'Veiled', desc: 'Cannot be targeted without Veil Sight or Reveal.', counters: ['detection', 'reveal'] },
  regen: { name: 'Regenerating', desc: 'Heals after a short delay without damage.', counters: ['antiHeal'] },
  hasty: { name: 'Hasty', desc: 'Periodic speed bursts.', counters: ['slow', 'trap'] },
  volatile: { name: 'Volatile', desc: 'Explodes on death, stunning nearby girls.', counters: [] },
  airborne: { name: 'Airborne', desc: 'Flies over ground-only attacks.', counters: ['antiAir'] },
  ward: { name: 'Elemental Ward', desc: 'Immune to one element’s status and takes half damage from it.', counters: [] },
  brood: { name: 'Brood', desc: 'Releases smaller enemies when defeated.', counters: [] },
  siphon: { name: 'Siphon', desc: 'Drains nearby allies to heal itself.', counters: ['antiHeal', 'priority', 'silence'] },
  blink: { name: 'Blink', desc: 'Teleports forward along the path. Slows and stuns interrupt it.', counters: ['slow', 'stun', 'silence'] },
  field: { name: 'Field Caster', desc: 'Projects a haste, shield or regen field on nearby allies.', counters: ['silence', 'priority'] },
  phasing: { name: 'Phasing', desc: 'Periodically becomes intangible; only Holy and Mystic hits land. Holy hits stop phasing.', counters: ['silence'] },
  guardian: { name: 'Guardian', desc: 'Shields nearby allies from damage. Blast ignores the guard.', counters: ['armorShred'] },
  sabotage: { name: 'Sabotage', desc: 'Disables girls it passes near for a few seconds.', counters: ['cleanse', 'trap'] },
  decoy: { name: 'Illusionist', desc: 'Spawns fragile decoys that soak up shots.', counters: ['multiHit'] },
  enrage: { name: 'Pack Fury', desc: 'Speeds up when packmates fall.', counters: ['slow'] },
  summoner: { name: 'Summoner', desc: 'Calls reinforcements over time.', counters: ['priority'] },
  splitter: { name: 'Splitter', desc: 'Splits into smaller copies when defeated.', counters: [] },
};

// ---------------------------------------------------------------------------
// Placement, targeting, difficulty
// ---------------------------------------------------------------------------

export const PLACEMENT = {
  land: { name: 'Land', desc: 'Placed on grass and stone.' },
  water: { name: 'Water', desc: 'Placed only on water tiles.' },
  amphibious: { name: 'Amphibious', desc: 'Placed on land or water.' },
};

export const TARGET_MODES = {
  first: 'First',
  last: 'Last',
  strong: 'Strong',
  close: 'Close',
  elite: 'Priority', // casters / field oni / siphoners / elites first
};

export const DIFFICULTIES = {
  easy: { id: 'easy', name: 'Easy', hpMul: 0.85, speedMul: 1.0, cashMul: 1.1, costMul: 0.9, lives: 150, medal: 'bronze', firstClearGems: 20 },
  normal: { id: 'normal', name: 'Normal', hpMul: 1.0, speedMul: 1.0, cashMul: 1.0, costMul: 1.0, lives: 100, medal: 'silver', firstClearGems: 40 },
  hard: { id: 'hard', name: 'Hard', hpMul: 1.35, speedMul: 1.1, cashMul: 0.95, costMul: 1.08, lives: 50, medal: 'gold', firstClearGems: 60 },
  nightmare: { id: 'nightmare', name: 'Nightmare', hpMul: 1.75, speedMul: 1.15, cashMul: 0.9, costMul: 1.2, lives: 1, medal: 'sakura', firstClearGems: 100, noIncome: true },
};
export const DIFFICULTY_ORDER = ['easy', 'normal', 'hard', 'nightmare'];

/** Map difficulty tiers (Bloons-style map picker groups). */
export const MAP_TIERS = {
  beginner: { name: 'Beginner', color: '#7bd389' },
  intermediate: { name: 'Intermediate', color: '#4cc9f0' },
  advanced: { name: 'Advanced', color: '#ff9f1c' },
  expert: { name: 'Expert', color: '#ff4d6d' },
};

// ---------------------------------------------------------------------------
// Rarities
// ---------------------------------------------------------------------------

export const UNIT_RARITIES = {
  R: { id: 'R', name: 'R', stars: 1, color: '#7aa7d9', fragmentsOnDupe: 2 },
  SR: { id: 'SR', name: 'SR', stars: 2, color: '#ffc94d', fragmentsOnDupe: 10 },
  SSR: { id: 'SSR', name: 'SSR', stars: 3, color: '#ff7ad9', fragmentsOnDupe: 40 },
};

export const ITEM_RARITIES = {
  common: { id: 'common', name: 'Common', order: 0, color: '#9aa5b1' },
  rare: { id: 'rare', name: 'Rare', order: 1, color: '#4a90e2' },
  superRare: { id: 'superRare', name: 'Super Rare', order: 2, color: '#a86bff' },
  mythic: { id: 'mythic', name: 'Mythic', order: 3, color: '#ff5a7a' },
  legendary: { id: 'legendary', name: 'Legendary', order: 4, color: '#ffb627' },
};
export const ITEM_RARITY_ORDER = ['common', 'rare', 'superRare', 'mythic', 'legendary'];

// ---------------------------------------------------------------------------
// Upgrade material families — each unit uses exactly one family.
// ---------------------------------------------------------------------------

export const MATERIAL_FAMILIES = {
  feather: { name: 'Feathers', color: '#6ec6ff', desc: 'Marksmen, snipers and skirmishers.' },
  blade: { name: 'Blade Shards', color: '#ff6b81', desc: 'Melee fighters.' },
  ember: { name: 'Embers', color: '#ff9f43', desc: 'Bombardment and artillery.' },
  rime: { name: 'Rime Crystals', color: '#a5f3fc', desc: 'Frost and control.' },
  charm: { name: 'Charms', color: '#ffd6e7', desc: 'Holy, support and heroes of light.' },
  rune: { name: 'Runes', color: '#b197fc', desc: 'Mystic casters and alchemists.' },
  cog: { name: 'Cogs', color: '#ffd43b', desc: 'Engineers, trappers and economy.' },
};

// ---------------------------------------------------------------------------
// Gear
// ---------------------------------------------------------------------------

export const GEAR_SLOTS = {
  charm: { name: 'Charm', desc: 'Offensive trinket.' },
  ribbon: { name: 'Ribbon', desc: 'Focus and precision.' },
  shoes: { name: 'Shoes', desc: 'Speed and utility.' },
};

/** Stats gear can roll. `pct` stats are fractions (0.05 = +5%). range = [min,max] per rarity step. */
export const GEAR_STATS = {
  atkPct: { name: 'ATK', pct: true, base: [0.03, 0.06] },
  ratePct: { name: 'Attack Speed', pct: true, base: [0.02, 0.05] },
  rangePct: { name: 'Range', pct: true, base: [0.02, 0.04] },
  critChance: { name: 'Crit Rate', pct: true, base: [0.02, 0.05] },
  critDmg: { name: 'Crit DMG', pct: true, base: [0.05, 0.12] },
  armorPen: { name: 'Armor Pierce', pct: false, base: [1, 2] },
  costCut: { name: 'Cost Reduction', pct: true, base: [0.01, 0.03] },
  ultHaste: { name: 'Ult Haste', pct: true, base: [0.03, 0.07] },
};
export const GEAR_MAIN_STATS = {
  charm: ['atkPct', 'critDmg'],
  ribbon: ['critChance', 'rangePct', 'armorPen'],
  shoes: ['ratePct', 'costCut', 'ultHaste'],
};
/** Substat count by gear rarity. */
export const GEAR_SUBSTATS_BY_RARITY = { common: 0, rare: 1, superRare: 2, mythic: 3, legendary: 4 };

// ---------------------------------------------------------------------------
// Gacha
// ---------------------------------------------------------------------------

export const GACHA = {
  costSingle: 120,
  costTen: 1200,
  rates: { SSR: 0.015, SR: 0.185, R: 0.8 },
  pity: 90, // guaranteed SSR on the 90th pull without one
  tenPullGuaranteeSR: true,
  sparkCost: 200, // recruit points to pick any SSR
};

// ---------------------------------------------------------------------------
// Battle constants
// ---------------------------------------------------------------------------

export const BATTLE = {
  maxTowers: 8, // towers in formation (plus 1 hero)
  sellRefund: 0.7,
  waveClearBonusBase: 80, // coins at end of each wave (+ wave index * 6)
  maxHeroLevel: 10,
  speeds: [1, 2, 3],
};
