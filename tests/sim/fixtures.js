// Inline fixtures for sim tests — independent of the real data files.
import { Sim } from '../../src/sim/Sim.js';

// 16 × 9 map. Path runs straight along row 4 from off-map left (-1) to off-map right (16).
export const MAP = {
  id: 'test-map',
  name: 'Test Field',
  theme: 'sakura',
  tier: 'beginner',
  width: 16,
  height: 9,
  rows: [
    '................',
    '....~~~~........',
    '....~~~~...TT...',
    '................',
    '................',
    '................',
    '.....RR.........',
    '..,,,...........',
    'XXXXXXXXXXXXXXXX',
  ],
  paths: [[[-1, 4], [16, 4]]],
};

// Two lanes: row 2 and row 6.
export const MAP2 = {
  id: 'test-map-2',
  name: 'Twin Lanes',
  theme: 'lake',
  tier: 'beginner',
  width: 12,
  height: 9,
  rows: Array.from({ length: 9 }, () => '............'),
  paths: [[[-1, 2], [12, 2]], [[-1, 6], [12, 6]]],
};

const tier = (name, cost, mods) => ({ name, cost, desc: name, mods });
const path = (id, tiers) => ({ id, name: id, focus: id, tiers });
const flatPaths = () => [
  path('a', [tier('a1', 100, {}), tier('a2', 100, {}), tier('a3', 100, {}), tier('a4', 100, {}), tier('a5', 100, {})]),
  path('b', [tier('b1', 100, {}), tier('b2', 100, {}), tier('b3', 100, {}), tier('b4', 100, {}), tier('b5', 100, {})]),
  path('c', [tier('c1', 100, {}), tier('c2', 100, {}), tier('c3', 100, {}), tier('c4', 100, {}), tier('c5', 100, {})]),
];

function unit(id, extra) {
  return {
    id,
    name: id,
    title: id,
    kind: 'tower',
    rarity: 'R',
    adult: false,
    role: 'marksman',
    attackType: 'pierce',
    element: null,
    placement: 'land',
    materialFamily: 'feather',
    capabilities: [],
    pathCapabilities: [],
    acquisition: { type: 'starter' },
    look: { weapon: 'bow' },
    paths: flatPaths(),
    awakenPassive: { name: 'p', desc: 'p', mods: { damageMul: 1.1 } },
    ...extra,
    base: {
      cost: 200, behavior: 'projectile', damage: 10, rate: 2, range: 3.5, projectiles: 1, pierce: 1, splash: 0,
      chain: 0, maxTargets: 99, projectileSpeed: 20, armorPen: 0, canHitAir: true, detection: false, status: [],
      crit: { chance: 0, mul: 1.5 }, eliteMul: 1, bossMul: 1, barrierMul: 1,
      ...(extra.base || {}),
    },
  };
}

export const UNITS = {
  archer: unit('archer', {
    paths: [
      path('power', [
        tier('Sharp', 100, { damage: 5 }),
        tier('Sharper', 200, { damageMul: 1.5 }),
        tier('Piercing', 600, { pierce: 2, armorPen: 2 }),
        tier('Volley', 2000, { projectiles: 2 }),
        tier('Storm', 8000, { damageMul: 2, attackType: 'mystic' }),
      ]),
      path('speed', [
        tier('Quick', 100, { rateMul: 1.25 }),
        tier('Quicker', 200, { rateMul: 1.2 }),
        tier('Frost tips', 600, { status: [{ type: 'slow', amount: 0.3, duration: 1 }] }),
        tier('Frostier', 2000, { status: [{ type: 'slow', amount: 0.5, duration: 0.5 }] }),
        tier('Gale', 8000, { rateMul: 2 }),
      ]),
      path('sight', [
        tier('Long', 100, { range: 1 }),
        tier('Eagle eye', 200, { detection: true }),
        tier('Crit', 600, { crit: { chance: 0.2, mul: 2 } }),
        tier('Hunter', 2000, { eliteMul: 1.5, mark: { bonus: 0.2, duration: 2 } }),
        tier('Legend', 8000, { aura: { range: 3, dmgMul: 1.1 }, income: { perWave: 50 } }),
      ]),
    ],
  }),
  seer: unit('seer', { capabilities: ['detection'], base: { detection: true } }),
  bomber: unit('bomber', {
    attackType: 'blast', element: 'fire', role: 'bombardment', look: { weapon: 'cannon' },
    base: { damage: 20, rate: 1, splash: 1.2, projectileSpeed: 12, status: [{ type: 'burn', dps: 5, duration: 2 }] },
  }),
  cleaver: unit('cleaver', {
    attackType: 'slash', role: 'cleaver', look: { weapon: 'katana' },
    base: { behavior: 'pulse', damage: 10, rate: 1, range: 2, canHitAir: false, maxTargets: 99 },
  }),
  duelist: unit('duelist', {
    attackType: 'slash', role: 'duelist',
    base: { behavior: 'duel', damage: 10, rate: 2, range: 2, ramp: { per: 0.25, max: 1 } },
  }),
  beamer: unit('beamer', {
    attackType: 'mystic', role: 'mystic',
    base: { behavior: 'beam', damage: 10, rate: 1, range: 6, pierce: 3, projectiles: 1 },
  }),
  chainer: unit('chainer', {
    attackType: 'mystic', element: 'lightning', role: 'chain',
    base: { behavior: 'chain', damage: 10, rate: 1, range: 4, chain: 3 },
  }),
  trapper: unit('trapper', {
    attackType: 'blast', role: 'trapper',
    base: { behavior: 'trap', damage: 0, rate: 4, range: 3, trap: { max: 3, damage: 40, triggerRadius: 0.6, armTime: 0.2, splash: 0.8, status: [] } },
  }),
  engineer: unit('engineer', {
    attackType: 'pierce', role: 'engineer',
    base: { behavior: 'turret', damage: 0, rate: 4, range: 3, turret: { max: 2, damage: 6, rate: 3, range: 3.5 } },
  }),
  banker: unit('banker', {
    role: 'economy',
    base: { behavior: 'none', damage: 0, income: { perWave: 100, interest: 0 } },
  }),
  chime: unit('chime', {
    role: 'enchanter', attackType: 'holy',
    base: { behavior: 'none', damage: 0, range: 3, aura: { range: 3, dmgMul: 1.5, rateMul: 1.2, detection: true, costCut: 0.1 } },
  }),
  medic: unit('medic', {
    role: 'engineer',
    base: { behavior: 'none', damage: 0, range: 3, aura: { range: 3, cleanse: true } },
  }),
  priest: unit('priest', {
    attackType: 'holy', role: 'exorcist',
    base: { behavior: 'pulse', damage: 5, rate: 2, range: 3 },
  }),
  boat: unit('boat', { placement: 'water', attackType: 'blast', element: 'water' }),
  lancer: unit('lancer', { base: { range: 14, pierce: 3, projectileSpeed: 30 } }),
  triple: unit('triple', { base: { projectiles: 3, range: 4 } }),
  sniper: unit('sniper', { role: 'sniper', look: { weapon: 'rifle' }, base: { damage: 50, rate: 0.5, range: 10, projectileSpeed: 0 } }),
  heroine: unit('heroine', {
    kind: 'hero', rarity: 'SSR', adult: true, role: 'vanguard', attackType: 'holy',
    base: { cost: 500, damage: 10, rate: 1, range: 3, detection: true },
    hero: {
      levelXp: [100, 200, 300, 400, 500, 600, 700, 800, 900],
      levels: [
        { level: 2, desc: 'sharper', mods: { damage: 5 } },
        { level: 3, desc: 'ult', mods: { rateMul: 1.2 } },
        { level: 5, desc: 'reach', mods: { range: 1 } },
      ],
      ult: { name: 'Bloom', desc: 'nova', unlockLevel: 3, cooldown: 30, effect: { type: 'nova', damage: 100, radius: 0, attackType: 'holy', reveal: 3 } },
    },
  }),
  warper: unit('warper', {
    kind: 'hero', rarity: 'SSR', adult: true, role: 'mystic', attackType: 'mystic',
    base: { cost: 500, damage: 10, rate: 1, range: 3 },
    hero: {
      levelXp: [10, 10, 10, 10, 10, 10, 10, 10, 10],
      levels: [],
      ult: { name: 'Moonfall', desc: 'warp', unlockLevel: 1, cooldown: 20, effect: { type: 'timeWarp', slow: 0.5, duration: 3, rateBuff: 0.5, buffDuration: 4 } },
    },
  }),
  tider: unit('tider', {
    kind: 'hero', rarity: 'SR', adult: true, role: 'tideguard', attackType: 'mystic', placement: 'water',
    base: { cost: 500, damage: 10, rate: 1, range: 3 },
    hero: {
      levelXp: [10, 10, 10, 10, 10, 10, 10, 10, 10],
      levels: [],
      ult: { name: 'Tidal Wave', desc: 'tide', unlockLevel: 1, cooldown: 20, effect: { type: 'tide', damage: 5, pushback: 3, slow: 0.3, duration: 2 } },
    },
  }),
};

function enemy(id, extra = {}) {
  return {
    id, name: id, family: 'slime', tier: 'normal', hp: 10, speed: 1, armorClass: 'light', armor: 0,
    bounty: 1, leak: 1, threat: 1, size: 1, color: '#88ff88', accent: '#ffffff',
    model: { base: 'slime', variant: 'basic', props: [] }, traits: {}, lore: '', counters: '', introducedIn: '1-1',
    ...extra,
  };
}

export const ENEMIES = {
  slime: enemy('slime'),
  tank: enemy('tank', { hp: 100000, speed: 0.0001 }),
  orc: enemy('orc', { family: 'orc', hp: 60, armor: 3, armorClass: 'heavy', speed: 0.7, threat: 5 }),
  crystal: enemy('crystal', { family: 'construct', hp: 100, armorClass: 'heavy', traits: { crystal: { cap: 5, hits: 4 } } }),
  barrier: enemy('barrier', { family: 'construct', hp: 50, armorClass: 'heavy', traits: { barrier: { hp: 30 } } }),
  veil: enemy('veil', { family: 'ghost', hp: 20, traits: { veiled: true } }),
  ghost: enemy('ghost', { family: 'ghost', hp: 40, armorClass: 'spectral', traits: { phasing: { every: 0.1, duration: 5 } } }),
  ghoul: enemy('ghoul', { family: 'ghoul', hp: 50, speed: 0.0001, traits: { siphon: { radius: 2, rate: 5 } } }),
  blinker: enemy('blinker', { family: 'ghoul', hp: 50, speed: 0.5, traits: { blink: { every: 2, distance: 3 } } }),
  oni: enemy('oni', { family: 'oni', hp: 200, speed: 0.0001, armorClass: 'warded', tier: 'elite', traits: { field: { kind: 'shield', radius: 2, amount: 0.5 } } }),
  hasteOni: enemy('hasteOni', { family: 'oni', hp: 200, armorClass: 'warded', tier: 'elite', traits: { field: { kind: 'haste', radius: 2, amount: 0.5 } } }),
  guard: enemy('guard', { family: 'orc', hp: 200, speed: 0.0001, armorClass: 'heavy', traits: { guardian: { radius: 2, reduction: 0.5 } } }),
  pod: enemy('pod', { family: 'plant', hp: 10, traits: { brood: { spawn: 'slime', count: 3 } } }),
  wyvern: enemy('wyvern', { family: 'dragon', hp: 30, armorClass: 'scaled', traits: { airborne: true } }),
  bomb: enemy('bomb', { hp: 5, traits: { volatile: { radius: 2, stun: 2 } } }),
  sapper: enemy('sapper', { family: 'goblin', hp: 1000, speed: 0.5, traits: { sabotage: { radius: 2, duration: 3, cooldown: 5 } } }),
  lizard: enemy('lizard', { family: 'lizard', hp: 100, speed: 0.0001, armorClass: 'scaled', traits: { regen: { pct: 0.1, delay: 0.5 }, ward: 'fire' } }),
  runner: enemy('runner', { family: 'goblin', hp: 10, speed: 1, traits: { hasty: { mul: 3, every: 1, duration: 0.5 } } }),
  wolf: enemy('wolf', { family: 'beast', hp: 30, speed: 1, traits: { enrage: { mul: 0.2, max: 0.6 } } }),
  summoner: enemy('summoner', { family: 'ghoul', hp: 300, speed: 0.0001, traits: { summoner: { spawn: 'slime', count: 2, every: 1 } } }),
  illusion: enemy('illusion', { family: 'fae', hp: 300, speed: 0.0001, armorClass: 'warded', traits: { decoy: { spawn: 'slime', count: 2, every: 1 } } }),
  elite: enemy('elite', { tier: 'elite', hp: 300, threat: 20, speed: 0.5 }),
  boss: enemy('boss', {
    family: 'dragon', tier: 'boss', hp: 1000, speed: 0.5, armorClass: 'scaled', threat: 100, leak: 9999,
    phases: [{ atHp: 0.5, announce: 'The Matriarch takes flight!', set: { speed: 1, traits: { airborne: true } } }],
  }),
};

export const STAGE = {
  id: 'test-1',
  kind: 'campaign',
  chapter: 1,
  name: 'Test Stage',
  mapId: 'test-map',
  desc: '',
  waves: 3,
  waveGen: {
    pool: [{ enemy: 'slime', weight: 3, from: 1 }, { enemy: 'orc', weight: 1, from: 2 }],
    budget: { start: 6, growth: 1.3 },
    spacing: 0.5,
    groups: 2,
    fixed: [{ wave: 3, enemy: 'elite', count: 1, delay: 1 }],
  },
  hpScale: 1,
  startCash: 100000,
  lives: 100,
  introduces: [],
  recommended: [],
  unlocks: {},
  requires: null,
  drops: [],
  firstClear: [],
  scenery: { props: [] },
  tier: 'beginner',
};

export const TOWER_IDS = Object.keys(UNITS).filter((id) => UNITS[id].kind === 'tower');

/** Data override object for new Sim({ data }). */
export function testData(extra = {}) {
  return { stage: STAGE, map: MAP, units: UNITS, enemies: ENEMIES, ...extra };
}

/**
 * Sim with every fixture tower in the loadout and lots of cash.
 * @param {object} opts { stage, map, hero, difficulty, seed, options, cash }
 */
export function makeSim(opts = {}) {
  const sim = new Sim({
    stageId: (opts.stage || STAGE).id,
    difficulty: opts.difficulty || 'normal',
    loadout: (opts.towers || TOWER_IDS).map((unitId) => ({ unitId, stats: opts.stats?.[unitId] })),
    hero: opts.hero ? { unitId: opts.hero, stats: opts.heroStats } : null,
    seed: opts.seed ?? 7,
    options: opts.options || {},
    data: testData({ stage: opts.stage || STAGE, map: opts.map || MAP }),
  });
  if (opts.cash != null) sim.cash = opts.cash;
  return sim;
}

/** Puts the sim into an active wave with nothing scheduled (for hand-spawned enemies). */
export function startEmptyWave(sim) {
  sim.state = 'wave';
  sim.wave = Math.max(1, sim.wave);
  sim._spawnQueue = [];
  sim._spawnIndex = 0;
}

/** Runs the sim for `seconds` of game time. */
export function run(sim, seconds, dt = 1 / 60) {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) sim.update(dt);
}

/** Minimal EnemyRT-like object for pure combat tests. */
export function fakeEnemy(over = {}) {
  return {
    uid: 1, id: 'x', def: { size: 1 }, tier: 'normal', armorClass: 'light', armor: 0, hp: 100, maxHp: 100,
    barrier: 0, maxBarrier: 0, crystalHits: 0, crystalCap: 0, statuses: {}, veiled: false, revealed: false,
    phasing: false, airborne: false, ward: null, guard: 0, shield: 0, dead: false, traits: {},
    ...over,
  };
}

/** Plain hit spec for combat tests. */
export function hitSpec(over = {}) {
  return {
    damage: 10, attackType: 'mystic', element: null, critChance: 0, critMul: 1.5, armorPen: 0, eliteMul: 1, bossMul: 1,
    barrierMul: 1, detection: false, canHitAir: true, status: [], mark: null, silence: 0, reveal: 0, knockback: 0,
    ...over,
  };
}
