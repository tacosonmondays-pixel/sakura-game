import { describe, it, expect } from 'vitest';
import {
  UNITS, UNIT_MAP, UNIT_IDS, getUnit, towers, heroes, unitsByRarity, freeUnlocksByStage,
  hasCapability, unitsWithCapability, tierCost, pathCostTo,
} from '../../src/data/units.js';
import { HERO_TRACKS, HERO_XP_STEPS, HERO_LEVEL_PRICES } from '../../src/data/heroTracks.js';
import { BATTLE } from '../../src/data/types.js';
import { resolveStats } from '../../src/sim/mods.js';
import { statsCapabilities } from '../../src/sim/report.js';
import { ROLE_TARGET_MODE } from '../../src/sim/constants.js';
import {
  ATTACK_TYPES, ELEMENTS, STATUSES, ROLES, CAPABILITIES, PLACEMENT, UNIT_RARITIES, MATERIAL_FAMILIES,
} from '../../src/data/types.js';

// ---------------------------------------------------------------------------
// Contract tables (CONTRACTS.md §3) — copied verbatim so drift is caught.
// ---------------------------------------------------------------------------

const ROSTER = [
  ['hikari', 'hero', 'SSR', 'vanguard', 'holy', null, 'land', 'charm', 'starter'],
  ['luna', 'hero', 'SSR', 'mystic', 'mystic', null, 'land', 'rune', 'gacha'],
  ['nami', 'hero', 'SR', 'tideguard', 'mystic', 'frost', 'amphibious', 'rime', '1-5'],
  ['aoi', 'tower', 'R', 'marksman', 'pierce', null, 'land', 'feather', 'starter'],
  ['rei', 'tower', 'R', 'cleaver', 'slash', null, 'land', 'blade', 'starter'],
  ['yuki', 'tower', 'R', 'controller', 'mystic', 'frost', 'land', 'rime', '1-2'],
  ['momo', 'tower', 'R', 'economy', 'pierce', null, 'land', 'cog', 'gacha'],
  ['akane', 'tower', 'SR', 'bombardment', 'blast', 'fire', 'land', 'ember', 'gacha'],
  ['sango', 'tower', 'SR', 'artillery', 'blast', 'water', 'amphibious', 'ember', '1-5'],
  ['kage', 'tower', 'SR', 'skirmisher', 'pierce', null, 'land', 'feather', '2-5'],
  ['umeko', 'tower', 'SR', 'support', 'mystic', 'water', 'amphibious', 'charm', '3-2'],
  ['shiro', 'tower', 'SR', 'sniper', 'pierce', null, 'land', 'feather', '3-5'],
  ['midori', 'tower', 'SR', 'alchemist', 'mystic', 'poison', 'land', 'rune', '4-5'],
  ['suzu', 'tower', 'SR', 'trapper', 'blast', null, 'land', 'cog', '5-5'],
  ['raika', 'tower', 'SR', 'chain', 'mystic', 'lightning', 'land', 'rune', 'gacha'],
  ['miko', 'tower', 'SR', 'enchanter', 'holy', null, 'land', 'charm', 'gacha'],
  ['hotaru', 'tower', 'SSR', 'exorcist', 'holy', null, 'land', 'charm', 'gacha'],
  ['kaede', 'tower', 'SSR', 'duelist', 'slash', null, 'land', 'blade', 'gacha'],
  ['chika', 'tower', 'SSR', 'engineer', 'pierce', 'lightning', 'land', 'cog', 'gacha'],
  // the new girls (BUILD_PLAN 6.1: Tenka first)
  ['tenka', 'tower', 'SSR', 'powerhouse', 'mystic', null, 'land', 'cog', 'gacha'],
  // the returning girls (roster wave, src/data/unitsExpansion.js)
  ['kanna', 'hero', 'SSR', 'champion', 'slash', null, 'land', 'blade', 'gacha'],
  ['yoriko', 'hero', 'SSR', 'puppeteer', 'mystic', null, 'land', 'rune', 'gacha'],
  ['seiran', 'hero', 'SSR', 'stormrider', 'mystic', 'lightning', 'amphibious', 'feather', 'gacha'],
  ['fuu', 'tower', 'R', 'displacement', 'mystic', null, 'land', 'rime', 'gacha'],
  ['hana', 'tower', 'R', 'falconer', 'pierce', null, 'land', 'feather', '7-5'],
  ['ruri', 'tower', 'SR', 'summoner', 'mystic', null, 'land', 'rune', 'gacha'],
  ['noa', 'tower', 'SR', 'purifier', 'holy', null, 'land', 'charm', '6-2'],
  ['iroha', 'tower', 'SSR', 'mirror', 'mystic', null, 'land', 'rune', 'gacha'],
  ['ena', 'tower', 'SSR', 'hexer', 'mystic', null, 'land', 'rune', 'gacha'],
  // the new girls (UNIT_GAPS §5, src/data/unitsNewGirls.js)
  ['azami', 'tower', 'R', 'spiker', 'pierce', null, 'land', 'cog', '2-2'],
  ['kinu', 'tower', 'R', 'ring', 'pierce', null, 'land', 'feather', 'gacha'],
  ['wakaba', 'tower', 'R', 'manager', 'pierce', null, 'land', 'charm', '6-5'],
  ['yuzuha', 'tower', 'SR', 'builder', 'pierce', 'lightning', 'land', 'cog', '4-2'],
  ['ouka', 'tower', 'SR', 'council', 'holy', null, 'land', 'charm', 'gacha'],
  ['chigusa', 'tower', 'SR', 'botanist', 'pierce', null, 'land', 'feather', 'gacha'],
  ['marumi', 'tower', 'SR', 'bowler', 'blast', null, 'land', 'cog', 'gacha'],
  // the duo unit (docs/specs/DUO_LR.md, src/data/unitsDuo.js)
  ['kohaku_tsubaki', 'tower', 'SSR', 'battery', 'blast', null, 'land', 'ember', 'gacha'],
  // the staff heroes of the banners wave (BANNERS §D, src/data/unitsStaff.js)
  ['kogane', 'hero', 'SSR', 'pilot', 'pierce', null, 'land', 'blade', 'gacha'],
  ['norika', 'hero', 'SR', 'blocker', 'blast', null, 'land', 'rime', 'gacha'],
];
const RETURNING = ['kanna', 'yoriko', 'seiran', 'fuu', 'hana', 'ruri', 'noa', 'iroha', 'ena'];

const UNIT_KEYS = [
  'id', 'name', 'title', 'kind', 'rarity', 'adult', 'role', 'attackType', 'element', 'placement',
  'materialFamily', 'capabilities', 'pathCapabilities', 'acquisition', 'palette', 'look', 'bio',
  'personality', 'quote', 'tips', 'base', 'paths', 'awakenPassive',
];
const PALETTE_KEYS = ['hair', 'hairShade', 'eyes', 'skin', 'outfit', 'outfitShade', 'accent', 'halo', 'weapon'];
const LOOK_ENUMS = {
  hairStyle: ['twintails', 'ponytail', 'long', 'bob', 'braid', 'buns', 'short', 'side', 'hime', 'wavy'],
  bangs: ['straight', 'swept', 'split', 'hime', 'messy'],
  accessory: ['ribbon', 'bunnyEars', 'catEars', 'foxEars', 'hairpin', 'beret', 'witchHat', 'horns', 'flower', 'goggles', 'hood', 'headband', 'crown', 'cap', 'none',
    // the staff heroes (BANNERS §D.3)
    'hardhat'],
  outfit: ['sailor', 'blazer', 'miko', 'kimono', 'hoodie', 'dress', 'armor', 'coat', 'apron', 'jumpsuit', 'robe',
    // the staff heroes (BANNERS §D.4: a staff blazer with a safety sash, over slacks)
    'sash'],
  weapon: ['bow', 'katana', 'staff', 'cannon', 'rifle', 'shuriken', 'tome', 'bell', 'wrench', 'lantern', 'flask', 'parasol', 'trident', 'fan', 'rapier', 'gohei', 'coinPurse', 'sword',
    'mic', 'shield', 'mirror', 'spear', 'mallet', 'puppet', 'cards',
    // the new girls' props (UNIT_GAPS §5)
    'strip', 'needle', 'tablet', 'banner', 'wateringCan', 'ball',
    // the staff heroes (BANNERS §D.4: Norika's STOP paddle)
    'sign'],
  halo: ['ring', 'star', 'petal', 'gear', 'moon', 'flame', 'wave', 'crown', 'snow', 'bolt', 'leaf', 'eye'],
  eyeStyle: ['round', 'sharp', 'sleepy', 'sparkle', 'closed'],
  expression: ['smile', 'smug', 'calm', 'determined', 'shy', 'cheerful'],
};
const BEHAVIORS = ['projectile', 'pulse', 'duel', 'beam', 'chain', 'trap', 'turret', 'mortar', 'strip', 'ring', 'drink', 'roll', 'none'];
const BASE_REQUIRED = [
  'cost', 'behavior', 'damage', 'rate', 'range', 'projectiles', 'pierce', 'splash', 'chain', 'maxTargets',
  'projectileSpeed', 'armorPen', 'canHitAir', 'detection', 'status', 'crit', 'eliteMul', 'bossMul', 'barrierMul',
];
// roster B3: airMul (×damage vs flyers), gather (pull the enemies ahead back), relay (familiar / mirror origin)
const BASE_OPTIONAL = ['aura', 'income', 'trap', 'turret', 'ramp', 'mark', 'silence', 'reveal', 'knockback', 'airMul', 'gather', 'relay',
  // the new girls (UNIT_GAPS §5): spike strips (src/sim/strips.js), the 360° ring (src/sim/rings.js)
  'strip', 'ring', 'drink', 'sentry', 'hub', 'vine', 'ball',
  // Kaede's blade arts (src/sim/towers.js bladeArts)
  'blade',
  // the duo's partner beam and prism (src/sim/duo.js)
  'duo',
  // Norika's barricades (src/sim/barricades.js)
  'barricade'];
const AURA_KEYS = ['range', 'dmgMul', 'rateMul', 'rangeMul', 'detection', 'costCut', 'cleanse', 'armorPen', 'critChance'];
// limited buffs (src/sim/buffs.js): Midori's brew, Chika's tune-up link
const LIMITED_KEYS = ['targets', 'dmgMul', 'rateMul', 'armorPen', 'critChance', 'overclock'];

// Tier cost windows from CONTRACTS.md §5b.
// Tier 5 (the final tier: one girl per path at a time) costs 1.6–2.5× its old price (owner, Oct 15).
const TIER_COST = [[80, 450], [80, 450], [500, 1400], [1800, 4500], [12000, 36000]];
// heroes are exempt from the one-per-path rule and keep their prices (their paths become a level track
// in the hero rework)
const HERO_TIER5_COST = [7000, 16000];
// Named price-band exceptions (CONTRACTS.md §5b): a role allowed outside the live base and tier windows.
// Only the powerhouse uses one (Tenka, BUILD_PLAN 6.2: a deliberate late-game investment, base 1800);
// her T5 is re-checked at the balance pass. Tier 1 keeps the live window.
const PRICE_BANDS = {
  powerhouse: { base: [1500, 2000], tiers: [[80, 450], [450, 900], [2000, 3500], [6000, 10000], [20000, 36000]] },
};
const LIVE_BASE_COST = [150, 900];

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isPos = (v) => isNum(v) && v > 0;
const isColor = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

const STATUS_FIELDS = {
  slow: ['amount', 'duration'],
  freeze: ['duration'],
  stun: ['duration'],
  shock: ['duration'],
  silence: ['duration'],
  reveal: ['duration'],
  soak: ['duration'],
  burn: ['dps', 'duration'],
  poison: ['dps', 'duration'],
  shred: ['amount', 'duration'],
  mark: ['bonus', 'duration'],
  vulnerable: ['bonus', 'duration'],
  // roster B3
  ground: ['duration'],
  curse: ['burstMul', 'radius', 'duration'],
  hex: ['pct', 'duration'],
};

/** Returns a list of problems with a StatusSpec array. */
function statusErrors(list, where) {
  const errs = [];
  if (!Array.isArray(list)) return [`${where}: status must be an array`];
  for (const s of list) {
    if (!s || !STATUSES[s.type] || !STATUS_FIELDS[s.type]) { errs.push(`${where}: unknown status ${JSON.stringify(s)}`); continue; }
    // burn / poison may also eat a share of max HP per second (`pct`)
    const allowed = ['type', 'chance', ...STATUS_FIELDS[s.type], ...(s.type === 'burn' || s.type === 'poison' ? ['pct'] : [])];
    if ('pct' in s && !(isPos(s.pct) && s.pct < 0.05)) errs.push(`${where}: status ${s.type}.pct must be in (0, 0.05)`);
    for (const k of Object.keys(s)) if (!allowed.includes(k)) errs.push(`${where}: status ${s.type} has unknown key ${k}`);
    for (const f of STATUS_FIELDS[s.type]) if (!isPos(s[f])) errs.push(`${where}: status ${s.type}.${f} must be > 0`);
    if (s.type === 'slow' && s.amount >= 1) errs.push(`${where}: slow amount must be < 1`);
    if ('chance' in s && !(s.chance > 0 && s.chance <= 1)) errs.push(`${where}: status chance out of range`);
  }
  return errs;
}

function objErrors(obj, allowed, where, check) {
  const errs = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [`${where} must be an object`];
  for (const [k, v] of Object.entries(obj)) {
    if (!allowed.includes(k)) errs.push(`${where}: unknown key ${k}`);
    else errs.push(...check(k, v, `${where}.${k}`));
  }
  return errs;
}

const numCheck = (k, v, w) => (isNum(v) ? [] : [`${w} must be a number`]);
const trueCheck = (k, v, w) => (v === true ? [] : [`${w} must be true`]);

/** Validates a ModSet against the vocabulary in CONTRACTS.md §3 (unknown keys rejected). */
function modSetErrors(mods, where) {
  const errs = [];
  if (!mods || typeof mods !== 'object' || Array.isArray(mods)) return [`${where}: mods must be an object`];
  const M = {
    damage: numCheck, range: numCheck, splash: numCheck, armorPen: numCheck, projectileSpeed: numCheck,
    silence: numCheck, reveal: numCheck, knockback: numCheck,
    projectiles: (k, v, w) => (Number.isInteger(v) ? [] : [`${w} must be an integer`]),
    pierce: (k, v, w) => (Number.isInteger(v) ? [] : [`${w} must be an integer`]),
    chain: (k, v, w) => (Number.isInteger(v) ? [] : [`${w} must be an integer`]),
    maxTargets: (k, v, w) => (Number.isInteger(v) ? [] : [`${w} must be an integer`]),
    damageMul: (k, v, w) => (isPos(v) ? [] : [`${w} must be > 0`]),
    rateMul: (k, v, w) => (isPos(v) ? [] : [`${w} must be > 0`]),
    eliteMul: (k, v, w) => (isPos(v) ? [] : [`${w} must be > 0`]),
    bossMul: (k, v, w) => (isPos(v) ? [] : [`${w} must be > 0`]),
    barrierMul: (k, v, w) => (isPos(v) ? [] : [`${w} must be > 0`]),
    canHitAir: trueCheck,
    detection: trueCheck,
    attackType: (k, v, w) => (ATTACK_TYPES[v] ? [] : [`${w} unknown attack type ${v}`]),
    element: (k, v, w) => (ELEMENTS[v] ? [] : [`${w} unknown element ${v}`]),
    behavior: (k, v, w) => (BEHAVIORS.includes(v) ? [] : [`${w} unknown behavior ${v}`]),
    status: (k, v, w) => statusErrors(v, w),
    crit: (k, v, w) => objErrors(v, ['chance', 'mul'], w, numCheck),
    aura: (k, v, w) => objErrors(v, AURA_KEYS, w, (kk, vv, ww) => (['detection', 'cleanse'].includes(kk) ? trueCheck(kk, vv, ww) : numCheck(kk, vv, ww))),
    income: (k, v, w) => objErrors(v, ['perWave', 'interest'], w, numCheck),
    trap: (k, v, w) => objErrors(v, ['max', 'damage', 'splash', 'triggerRadius', 'status'], w, (kk, vv, ww) => (kk === 'status' ? statusErrors(vv, ww) : numCheck(kk, vv, ww))),
    turret: (k, v, w) => objErrors(v, ['max', 'damage', 'range', 'rate', 'leash', 'speed'], w, numCheck),
    ramp: (k, v, w) => objErrors(v, ['per', 'max'], w, numCheck),
    mark: (k, v, w) => objErrors(v, ['bonus', 'duration'], w, numCheck),
    brew: (k, v, w) => objErrors(v, LIMITED_KEYS.filter((x) => x !== 'overclock'), w, numCheck),
    link: (k, v, w) => objErrors(v, LIMITED_KEYS, w, (kk, vv, ww) => (kk === 'overclock' ? objErrors(vv, ['every', 'time', 'rateMul'], ww, numCheck) : numCheck(kk, vv, ww))),
    hpPct: (k, v, w) => objErrors(v, ['pct', 'boss', 'cap'], w, numCheck),
    // Tenka (BUILD_PLAN 6.1): Joint Research, Gravity Well, Last Line
    lab: (k, v, w) => objErrors(v, ['rounds', 'power'], w, (kk, vv, ww) => {
      if (kk === 'rounds') return Number.isInteger(vv) && vv > 0 ? [] : [`${ww} must be a whole number > 0`];
      return isNum(vv) && vv >= 1 ? [] : [`${ww} must be >= 1`];
    }),
    well: (k, v, w) => objErrors(v, ['every', 'time', 'radius', 'pull', 'slow', 'vuln'], w, (kk, vv, ww) => {
      if (kk === 'slow' || kk === 'vuln') return isPos(vv) && vv < 1 ? [] : [`${ww} must be in (0, 1)`];
      return isPos(vv) ? [] : [`${ww} must be > 0`];
    }),
    lastLine: (k, v, w) => [
      ...objErrors(v, ['radius', 'max', 'time', 'cooldown'], w, (kk, vv, ww) => {
        if (kk === 'max') return Number.isInteger(vv) && vv > 0 ? [] : [`${ww} must be a whole number > 0`];
        return isPos(vv) ? [] : [`${ww} must be > 0`];
      }),
      ...['radius', 'max', 'time', 'cooldown'].filter((f) => !(f in (v || {}))).map((f) => `${w} needs ${f}`),
    ],
    // roster B3
    airMul: (k, v, w) => (isPos(v) ? [] : [`${w} must be > 0`]),
    gather: numCheck,
    relay: (k, v, w) => objErrors(v, ['reach'], w, numCheck),
    // the new girls (UNIT_GAPS §5)
    strip: (k, v, w) => stripErrors(v, w),
    ring: (k, v, w) => ringErrors(v, w),
    drink: (k, v, w) => drinkErrors(v, w),
    sentry: (k, v, w) => sentryErrors(v, w),
    hub: (k, v, w) => hubErrors(v, w),
    vine: (k, v, w) => objErrors(v, VINE_NUMS, w, numCheck),
    ball: (k, v, w) => ballErrors(v, w),
    blade: (k, v, w) => objErrors(v, BLADE_NUMS, w, numCheck),
    duo: (k, v, w) => objErrors(v, DUO_NUMS, w, numCheck),
    // the staff heroes (BANNERS §D): Kogane's Move recharge, Norika's barricades
    moveCd: (k, v, w) => (isPos(v) ? [] : [`${w} must be > 0`]),
    barricade: (k, v, w) => barricadeErrors(v, w),
  };
  for (const [k, v] of Object.entries(mods)) {
    if (!M[k]) errs.push(`${where}: unknown mod key "${k}"`);
    else errs.push(...M[k](k, v, `${where}.${k}`));
  }
  return errs;
}

// Spike strips (src/sim/mods.js normStrip): numbers add, flags are `true`.
const STRIP_NUMS = ['hits', 'ttl', 'boom', 'boomR', 'boomStun', 'air', 'opening', 'rain', 'rainCount'];
const STRIP_FLAGS = ['forever', 'carry', 'aim', 'lanes', 'pair'];
function stripErrors(v, w) {
  return objErrors(v, [...STRIP_NUMS, ...STRIP_FLAGS], w, (kk, vv, ww) => (STRIP_FLAGS.includes(kk) ? trueCheck(kk, vv, ww) : numCheck(kk, vv, ww)));
}

// The 360° ring (src/sim/mods.js normRing).
const RING_NUMS = ['travel', 'scissors', 'scissorDmg', 'scissorMul', 'spiral', 'spiralPierce'];
const RING_FLAGS = ['turn', 'heat', 'double', 'sparks'];
function ringErrors(v, w) {
  return objErrors(v, [...RING_NUMS, ...RING_FLAGS], w, (kk, vv, ww) => (RING_FLAGS.includes(kk) ? trueCheck(kk, vv, ww) : numCheck(kk, vv, ww)));
}

// The buff thrower's drink (src/sim/mods.js normDrink).
const DRINK_NUMS = ['splash', 'shots', 'dmg', 'rate', 'range', 'pierce', 'season', 'towelDmg'];
const DRINK_FLAGS = ['detection', 'cleanse', 'permanent', 'towel', 'life'];
function drinkErrors(v, w) {
  return objErrors(v, [...DRINK_NUMS, ...DRINK_FLAGS], w, (kk, vv, ww) => (DRINK_FLAGS.includes(kk) ? trueCheck(kk, vv, ww) : numCheck(kk, vv, ww)));
}

// The sentry builder (src/sim/mods.js normSentry).
const SENTRY_NUMS = ['max', 'every', 'speed', 'ttl', 'damage', 'rate', 'range', 'burst', 'nets', 'netBudget'];
const SENTRY_FLAGS = ['kits', 'netElite', 'netBoss'];
function sentryErrors(v, w) {
  return objErrors(v, [...SENTRY_NUMS, ...SENTRY_FLAGS], w, (kk, vv, ww) => (SENTRY_FLAGS.includes(kk) ? trueCheck(kk, vv, ww) : numCheck(kk, vv, ww)));
}

// Norika's barricades (src/sim/mods.js normBarricade): numbers add, flags are `true`.
const BARRICADE_NUMS = ['count', 'budget', 'budgetMul', 'rebuild', 'rebuildCut', 'held', 'bounce', 'breakSlow', 'releaseSlow', 'oneWay', 'lineAdd'];
const BARRICADE_FLAGS = ['reveal', 'miniHalf', 'detour'];
function barricadeErrors(v, w) {
  return objErrors(v, [...BARRICADE_NUMS, ...BARRICADE_FLAGS], w, (kk, vv, ww) => (BARRICADE_FLAGS.includes(kk) ? trueCheck(kk, vv, ww) : numCheck(kk, vv, ww)));
}

// The bowler (src/sim/mods.js normBall): numbers add, flags are `true`.
const BALL_NUMS = ['travel', 'speed', 'through', 'share', 'lobMul', 'pins', 'pinDmg', 'pinPierce', 'bounce', 'reach', 'finish'];
const BALL_FLAGS = ['hook', 'lob', 'pushBig'];
function ballErrors(v, w) {
  return objErrors(v, [...BALL_NUMS, ...BALL_FLAGS], w, (kk, vv, ww) => (BALL_FLAGS.includes(kk) ? trueCheck(kk, vv, ww) : numCheck(kk, vv, ww)));
}

// The duo (src/sim/mods.js normDuo): Kohaku's beam and the prism; every field a number.
const DUO_NUMS = ['beamDmg', 'beamRate', 'beamRange', 'beamPierce', 'beams', 'beamPen', 'beamAir', 'beamMul', 'rampPer', 'rampMax', 'beamSilence',
  'every', 'shards', 'shardAdd', 'shardShare', 'shardDmg', 'shardSplash', 'shardSlow', 'slowTime', 'shardShred', 'shardVuln', 'vulnTime', 'fullEvery'];

// The nature caster (src/sim/mods.js normVine): numbers add.
// Kaede's blade arts (src/sim/mods.js normBlade): numbers add, shareMul multiplies
const BLADE_NUMS = ['every', 'radius', 'share', 'targets', 'crescents', 'cLen', 'cWidth', 'cShare', 'cTargets', 'storm', 'sShare', 'sTargets', 'wave', 'wWidth', 'wShare', 'wTargets', 'maple', 'mShare', 'mTargets', 'shareMul'];
const VINE_NUMS = ['every', 'hold', 'dps', 'beds', 'bedDmg', 'bedTtl', 'bloom', 'bloomPer', 'bloomIdle', 'lives', 'livesCap'];

// The campus hub (src/sim/mods.js normHub).
const HUB_NUMS = ['radius', 'costCut', 'sellMul', 'freeTiers', 'killBounty', 'cdCut', 'rateMul', 'rangeMul', 'dmgMul', 'typeFloor', 'banners', 'bannerRange', 'bannerReach', 'radiusAdd', 'cutAdd'];
const HUB_FLAGS = ['detection', 'airGrant', 'cleanse'];
function hubErrors(v, w) {
  return objErrors(v, [...HUB_NUMS, ...HUB_FLAGS], w, (kk, vv, ww) => (HUB_FLAGS.includes(kk) ? trueCheck(kk, vv, ww) : numCheck(kk, vv, ww)));
}

function baseErrors(b, where) {
  const errs = [];
  for (const k of BASE_REQUIRED) if (!(k in b)) errs.push(`${where}: missing ${k}`);
  for (const k of Object.keys(b)) if (!BASE_REQUIRED.includes(k) && !BASE_OPTIONAL.includes(k)) errs.push(`${where}: unknown key ${k}`);
  if (!BEHAVIORS.includes(b.behavior)) errs.push(`${where}: bad behavior`);
  if (!(isNum(b.cost) && b.cost >= 0)) errs.push(`${where}: cost must be >= 0`);
  for (const k of ['rate', 'range', 'projectiles', 'pierce', 'maxTargets']) if (!isPos(b[k])) errs.push(`${where}: ${k} must be > 0`);
  for (const k of ['damage', 'splash', 'chain', 'projectileSpeed', 'armorPen']) if (!(isNum(b[k]) && b[k] >= 0)) errs.push(`${where}: ${k} must be >= 0`);
  for (const k of ['eliteMul', 'bossMul', 'barrierMul']) if (!isPos(b[k])) errs.push(`${where}: ${k} must be > 0`);
  if (typeof b.canHitAir !== 'boolean' || typeof b.detection !== 'boolean') errs.push(`${where}: canHitAir/detection must be booleans`);
  errs.push(...statusErrors(b.status, `${where}.status`));
  errs.push(...objErrors(b.crit, ['chance', 'mul'], `${where}.crit`, numCheck));
  if (!('chance' in b.crit) || !('mul' in b.crit)) errs.push(`${where}: crit needs chance + mul`);
  for (const k of ['silence', 'reveal', 'knockback']) if (k in b && !(isNum(b[k]) && b[k] >= 0)) errs.push(`${where}: ${k} must be >= 0`);
  if (b.aura) {
    errs.push(...objErrors(b.aura, AURA_KEYS, `${where}.aura`, (k, v, w) => (['detection', 'cleanse'].includes(k) ? trueCheck(k, v, w) : numCheck(k, v, w))));
    if (!isPos(b.aura.range)) errs.push(`${where}: aura needs a range`);
  }
  if (b.income) errs.push(...objErrors(b.income, ['perWave', 'interest'], `${where}.income`, numCheck));
  if (b.sentry) errs.push(...sentryErrors(b.sentry, `${where}.sentry`));
  if (b.barricade) errs.push(...barricadeErrors(b.barricade, `${where}.barricade`));
  if (b.vine) errs.push(...objErrors(b.vine, VINE_NUMS, `${where}.vine`, numCheck));
  if (b.duo) {
    errs.push(...objErrors(b.duo, DUO_NUMS, `${where}.duo`, numCheck));
    if (b.behavior !== 'mortar') errs.push(`${where}: the duo's main weapon is the mortar`);
    for (const k of ['beamDmg', 'beamRate', 'beamRange', 'beamPierce']) if (!isPos(b.duo[k])) errs.push(`${where}: duo.${k} must be > 0`);
  }
  if (b.ball) {
    errs.push(...ballErrors(b.ball, `${where}.ball`));
    if (b.behavior !== 'roll') errs.push(`${where}: ball needs the roll behavior`);
  }
  if (b.hub) {
    errs.push(...hubErrors(b.hub, `${where}.hub`));
    if (b.behavior !== 'none') errs.push(`${where}: a hub never attacks (behavior none)`);
  }
  if (b.drink) {
    errs.push(...drinkErrors(b.drink, `${where}.drink`));
    if (b.behavior !== 'drink') errs.push(`${where}: drink needs the drink behavior`);
  }
  if (b.ring) {
    errs.push(...ringErrors(b.ring, `${where}.ring`));
    if (b.behavior !== 'ring') errs.push(`${where}: ring needs the ring behavior`);
  }
  if (b.strip) {
    errs.push(...stripErrors(b.strip, `${where}.strip`));
    if (!b.trap) errs.push(`${where}: a strip girl lays traps (trap)`);
    if (b.behavior !== 'strip') errs.push(`${where}: strip needs the strip behavior`);
  }
  if (b.trap) {
    errs.push(...objErrors(b.trap, ['max', 'damage', 'triggerRadius', 'armTime', 'splash', 'status'], `${where}.trap`, (k, v, w) => (k === 'status' ? statusErrors(v, w) : numCheck(k, v, w))));
    for (const k of ['max', 'damage', 'triggerRadius', 'armTime', 'splash', 'status']) if (!(k in b.trap)) errs.push(`${where}: trap missing ${k}`);
  }
  if (b.turret) {
    errs.push(...objErrors(b.turret, ['max', 'damage', 'rate', 'range', 'leash', 'speed', 'build', 'attackType', 'status'], `${where}.turret`, (k, v, w) => {
      if (k === 'status') return statusErrors(v, w);
      if (k === 'attackType') return ATTACK_TYPES[v] ? [] : [`${w} unknown attack type`];
      return numCheck(k, v, w);
    }));
    for (const k of ['max', 'damage', 'rate', 'range']) if (!(k in b.turret)) errs.push(`${where}: turret missing ${k}`);
  }
  if (b.ramp) errs.push(...objErrors(b.ramp, ['per', 'max'], `${where}.ramp`, numCheck));
  if (b.mark) errs.push(...objErrors(b.mark, ['bonus', 'duration'], `${where}.mark`, numCheck));
  if ('airMul' in b && !isPos(b.airMul)) errs.push(`${where}: airMul must be > 0`);
  if ('gather' in b && !(isNum(b.gather) && b.gather >= 0)) errs.push(`${where}: gather must be >= 0`);
  if (b.relay) {
    errs.push(...objErrors(b.relay, ['kind', 'reach', 'both'], `${where}.relay`, (k, v, w) => {
      if (k === 'kind') return ['familiar', 'mirror'].includes(v) ? [] : [`${w} must be familiar or mirror`];
      if (k === 'both') return v === true ? [] : [`${w} must be true`];
      return isPos(v) ? [] : [`${w} must be > 0`];
    }));
  }
  return errs;
}

/** Capabilities a stat block / ModSet demonstrably grants (multiHit is judgement → manual). */
function derivedCaps(m, acc = new Set()) {
  if (m.canHitAir === true) acc.add('antiAir');
  if (m.detection === true || m.aura?.detection) acc.add('detection');
  if ((m.armorPen ?? 0) > 0) acc.add('armorPen');
  if ((m.barrierMul ?? 1) > 1) acc.add('barrierBreak');
  if ((m.silence ?? 0) > 0) acc.add('silence');
  if ((m.reveal ?? 0) > 0) acc.add('reveal');
  if (m.mark) acc.add('priority');
  if (m.aura && ((m.aura.dmgMul ?? 1) > 1 || (m.aura.rateMul ?? 1) > 1 || (m.aura.rangeMul ?? 1) > 1 || (m.aura.costCut ?? 0) > 0
    || (m.aura.armorPen ?? 0) > 0 || (m.aura.critChance ?? 0) > 0)) acc.add('buff');
  if (m.brew || m.link) acc.add('buff');
  if (m.aura?.cleanse) acc.add('cleanse');
  if (m.income) acc.add('income');
  if (m.turret) acc.add('summon');
  if (m.trap) acc.add('trap');
  // spike strips: Charged Strips' blast stun, Tall Barbs' flyer share
  if ((m.strip?.boomStun ?? 0) > 0) acc.add('stun');
  if ((m.strip?.air ?? 0) > 0) acc.add('antiAir');
  // a sports drink buffs girls; Coach's Eye, Ice Pack and Towel Snap
  if (m.drink && 'splash' in m.drink) acc.add('buff');
  if (m.drink?.detection) acc.add('detection');
  if (m.drink?.cleanse) acc.add('cleanse');
  if (m.drink?.towel) acc.add('slow');
  // lane sentries are summons; Specialist Kits' flash sentries reveal
  if ((m.sentry?.max ?? 0) > 0) acc.add('summon');
  if (m.sentry?.kits) acc.add('reveal');
  // the campus hub: her rules are a buff for the girls in her radius; Hall Monitors, Emergency Protocol, Sponsorship
  if (m.hub && 'radius' in m.hub) acc.add('buff');
  if (m.hub?.detection) acc.add('detection');
  if (m.hub?.cleanse) acc.add('cleanse');
  if ((m.hub?.killBounty ?? 0) > 0) acc.add('income');
  // a bowler's lob throws her blast at flyers (Marumi: her base kit)
  if (m.ball?.lob) acc.add('antiAir');
  // the duo: Kohaku's beam hits flyers (her base kit); its armour pen and silence, the shards' slow and armour crack
  if ((m.duo?.beamDmg ?? 0) > 0) acc.add('antiAir');
  if ((m.duo?.beamPen ?? 0) > 0) acc.add('armorPen');
  if ((m.duo?.beamSilence ?? 0) > 0) acc.add('silence');
  if ((m.duo?.shardSlow ?? 0) > 0) acc.add('slow');
  if ((m.duo?.shardShred ?? 0) > 0) acc.add('armorShred');
  const statuses = [...(m.status || []), ...(m.trap?.status || []), ...(m.turret?.status || [])];
  for (const s of statuses) {
    if (s.type === 'slow') acc.add('slow');
    if (s.type === 'freeze') { acc.add('slow'); acc.add('stun'); }
    if (s.type === 'stun') acc.add('stun');
    if (s.type === 'shred') acc.add('armorShred');
    if (s.type === 'poison') acc.add('antiHeal');
    if (s.type === 'silence') acc.add('silence');
    if (s.type === 'reveal') acc.add('reveal');
    if (s.type === 'ground') acc.add('grounding');
  }
  return acc;
}
const MANUAL_CAPS = ['multiHit', 'priority'];

const allTiers = (u) => u.paths.flatMap((p, pi) => p.tiers.map((t, ti) => ({ ...t, pathIndex: pi, tierNumber: ti + 1, pathId: p.id })));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('roster matches the contract table', () => {
  it('has exactly the contract ids in order (19, Tenka, the nine returning girls, the new girls)', () => {
    expect(UNITS.map((u) => u.id)).toEqual(ROSTER.map((r) => r[0]));
    expect(UNIT_IDS).toEqual(ROSTER.map((r) => r[0]));
    expect(new Set(UNIT_IDS).size).toBe(ROSTER.length);
  });

  it.each(ROSTER)('%s matches kind/rarity/role/type/element/placement/family/acquisition', (id, kind, rarity, role, attackType, element, placement, family, acq) => {
    const u = UNIT_MAP[id];
    expect(u).toBeTruthy();
    expect(u.kind).toBe(kind);
    expect(u.rarity).toBe(rarity);
    expect(u.role).toBe(role);
    expect(u.attackType).toBe(attackType);
    expect(u.element).toBe(element);
    expect(u.placement).toBe(placement);
    expect(u.materialFamily).toBe(family);
    if (acq === 'starter' || acq === 'gacha') {
      expect(u.acquisition).toEqual({ type: acq });
    } else {
      expect(u.acquisition.type).toBe('free');
      expect(u.acquisition.afterStage).toBe(acq);
      expect(typeof u.acquisition.note).toBe('string');
      expect(u.acquisition.note.length).toBeGreaterThan(10);
    }
  });

  it('only heroes are adults', () => {
    for (const u of UNITS) expect(u.adult).toBe(u.kind === 'hero');
  });
});

describe('UnitDef schema', () => {
  it.each(UNITS.map((u) => [u.id, u]))('%s has exactly the contract keys and valid vocabulary', (id, u) => {
    // (a duo adds its members and its base's footprint: docs/specs/DUO_LR.md §4)
    const expectedKeys = u.kind === 'hero' ? [...UNIT_KEYS, 'hero'] : u.duo ? [...UNIT_KEYS, 'duo', 'footprint'] : UNIT_KEYS;
    expect(Object.keys(u).sort()).toEqual([...expectedKeys].sort());
    expect(UNIT_RARITIES[u.rarity]).toBeTruthy();
    expect(ROLES[u.role]).toBeTruthy();
    expect(ATTACK_TYPES[u.attackType]).toBeTruthy();
    expect(u.element === null || !!ELEMENTS[u.element]).toBe(true);
    expect(PLACEMENT[u.placement]).toBeTruthy();
    expect(MATERIAL_FAMILIES[u.materialFamily]).toBeTruthy();
    for (const c of [...u.capabilities, ...u.pathCapabilities]) expect(CAPABILITIES[c], `${id} cap ${c}`).toBeTruthy();
    expect(new Set(u.capabilities).size).toBe(u.capabilities.length);
    expect(new Set(u.pathCapabilities).size).toBe(u.pathCapabilities.length);
    expect(u.capabilities.filter((c) => u.pathCapabilities.includes(c))).toEqual([]);
  });

  it.each(UNITS.map((u) => [u.id, u]))('%s has a full palette, look and text', (id, u) => {
    expect(Object.keys(u.palette).sort()).toEqual([...PALETTE_KEYS].sort());
    for (const k of PALETTE_KEYS) expect(isColor(u.palette[k]), `${id}.palette.${k}`).toBe(true);
    expect(Object.keys(u.look).sort()).toEqual(Object.keys(LOOK_ENUMS).sort());
    for (const [k, values] of Object.entries(LOOK_ENUMS)) expect(values, `${id}.look.${k}`).toContain(u.look[k]);
    for (const k of ['name', 'title', 'bio', 'personality', 'quote']) {
      expect(typeof u[k]).toBe('string');
      expect(u[k].trim().length).toBeGreaterThan(1);
    }
    expect(u.bio.length).toBeGreaterThan(80);
    expect(u.tips.length).toBeGreaterThanOrEqual(2);
    expect(u.tips.length).toBeLessThanOrEqual(4);
    for (const t of u.tips) expect(t.length).toBeGreaterThan(10);
  });

  it.each(UNITS.map((u) => [u.id, u]))('%s base stats are complete and valid', (id, u) => {
    expect(baseErrors(u.base, `${id}.base`)).toEqual([]);
  });

  it('every girl is visually distinct', () => {
    const hair = new Set(UNITS.map((u) => u.palette.hair.toLowerCase()));
    expect(hair.size).toBe(UNITS.length);
    const signature = new Set(UNITS.map((u) => `${u.look.hairStyle}|${u.look.accessory}|${u.look.outfit}|${u.look.weapon}`));
    expect(signature.size).toBe(UNITS.length);
    const hairAccessory = new Set(UNITS.map((u) => `${u.look.hairStyle}|${u.look.accessory}`));
    expect(hairAccessory.size).toBe(UNITS.length);
  });
});

describe('upgrade paths', () => {
  it('heroes have no upgrade paths (they level along their track)', () => {
    for (const u of heroes()) expect(u.paths, u.id).toEqual([]);
  });

  it.each(towers().map((u) => [u.id, u]))('%s has 3 paths × 5 tiers with valid ModSets', (id, u) => {
    expect(u.paths).toHaveLength(3);
    expect(new Set(u.paths.map((p) => p.id)).size).toBe(3);
    for (const p of u.paths) {
      // `ability`: the ⚡ path's ability, attached from src/data/abilities.js (tests/data/abilities.test.js)
      expect(Object.keys(p).filter((k) => k !== 'ability').sort()).toEqual(['focus', 'id', 'name', 'tiers']);
      expect(p.name.length).toBeGreaterThan(2);
      expect(p.focus.length).toBeGreaterThan(2);
      expect(p.tiers).toHaveLength(5);
      for (const [i, t] of p.tiers.entries()) {
        const where = `${id}.${p.id}.t${i + 1}`;
        expect(Object.keys(t).sort(), where).toEqual(['cost', 'desc', 'mods', 'name']);
        expect(t.name.length, where).toBeGreaterThan(2);
        expect(t.desc.length, where).toBeGreaterThan(5);
        expect(Object.keys(t.mods).length, `${where} must change something`).toBeGreaterThan(0);
        expect(modSetErrors(t.mods, where)).toEqual([]);
      }
    }
  });

  it.each(UNITS.map((u) => [u.id, u]))('%s tier costs increase and sit inside the balance windows', (id, u) => {
    const band = PRICE_BANDS[u.role]?.tiers;
    for (const p of u.paths) {
      const costs = p.tiers.map((t) => t.cost);
      for (let i = 0; i < 5; i++) {
        expect(Number.isInteger(costs[i]), `${id}.${p.id} t${i + 1}`).toBe(true);
        const win = i === 4 && u.kind === 'hero' ? HERO_TIER5_COST : band ? band[i] : TIER_COST[i];
        expect(costs[i], `${id}.${p.id} t${i + 1} min`).toBeGreaterThanOrEqual(win[0]);
        expect(costs[i], `${id}.${p.id} t${i + 1} max`).toBeLessThanOrEqual(win[1]);
        if (i > 0) expect(costs[i], `${id}.${p.id} t${i + 1} increases`).toBeGreaterThan(costs[i - 1]);
      }
    }
  });

  it('named price bands (CONTRACTS §5b): only the powerhouse role has one, and only a girl priced outside the live windows needs it', () => {
    expect(Object.keys(PRICE_BANDS)).toEqual(['powerhouse']);
    for (const role of Object.keys(PRICE_BANDS)) expect(ROLES[role], role).toBeTruthy();
    // the powerhouse is a damage dealer (CONTRACTS §3, T0): the Students role filter, the role badge colour
    // and the card theme all read this category
    expect(ROLES.powerhouse).toMatchObject({ name: 'Powerhouse', category: 'dps' });
    for (const u of towers()) {
      const live = u.base.cost >= LIVE_BASE_COST[0] && u.base.cost <= LIVE_BASE_COST[1]
        && u.paths.every((p) => p.tiers.every((t, i) => t.cost >= TIER_COST[i][0] && t.cost <= TIER_COST[i][1]));
      if (!live) expect(PRICE_BANDS[u.role], `${u.id} is priced outside the live windows without a named band`).toBeTruthy();
    }
    // the powerhouse band really is the exception: Tenka sits outside the live windows, inside her band
    const tenka = getUnit('tenka');
    expect(tenka.role).toBe('powerhouse');
    expect(tenka.base.cost).toBeGreaterThan(LIVE_BASE_COST[1]);
    expect(tenka.paths.some((p) => p.tiers[2].cost > TIER_COST[2][1])).toBe(true);
  });

  it('transformations (behavior/attackType/element) only appear at tier 4-5', () => {
    for (const u of UNITS) {
      for (const t of allTiers(u)) {
        if ('behavior' in t.mods || 'attackType' in t.mods || 'element' in t.mods) {
          expect(t.tierNumber, `${u.id}.${t.pathId} t${t.tierNumber}`).toBeGreaterThanOrEqual(4);
        }
      }
    }
  });

  it('every tier 3+ changes behaviour, not just numbers', () => {
    const PLAIN = ['damage', 'damageMul', 'rateMul', 'range', 'projectileSpeed'];
    const viaAbility = [];
    for (const u of UNITS) {
      for (const t of allTiers(u)) {
        if (t.tierNumber < 3) continue;
        const keys = Object.keys(t.mods);
        if (keys.some((k) => !PLAIN.includes(k))) continue;
        // a plain-numbers tier passes only as the ⚡ path's tier 5 whose ⚡+ brings an effect field her
        // ability did not have (a new mechanic, not bigger numbers): Tenka's Zero Point boost tail
        const a = u.paths[t.pathIndex].ability;
        const added = t.tierNumber === 5 && a?.t5 ? Object.keys(a.t5.effect || {}).filter((k) => !(k in (a.effect || {}))) : [];
        expect(added.length > 0, `${u.id}.${t.pathId} t${t.tierNumber} only tweaks numbers`).toBe(true);
        viaAbility.push(`${u.id}.${t.pathId}`);
      }
    }
    // and only where it was agreed (BUILD_PLAN 6.1): another girl's plain tier 5 needs a deliberate entry here
    expect(viaAbility).toEqual(['tenka.rails']);
  });

  it('objects introduced by upgrades arrive complete (aura range, ramp per+max, mark bonus+duration)', () => {
    for (const u of UNITS) {
      for (const p of u.paths) {
        let hasAura = !!u.base.aura;
        let hasRamp = !!u.base.ramp;
        let hasMark = !!u.base.mark;
        for (const [i, t] of p.tiers.entries()) {
          const where = `${u.id}.${p.id}.t${i + 1}`;
          if (t.mods.aura && !hasAura) { expect(isPos(t.mods.aura.range), `${where} aura.range`).toBe(true); hasAura = true; }
          if (t.mods.ramp && !hasRamp) { expect(isPos(t.mods.ramp.per) && isPos(t.mods.ramp.max), `${where} ramp`).toBe(true); hasRamp = true; }
          if (t.mods.mark && !hasMark) { expect(isPos(t.mods.mark.bonus) && isPos(t.mods.mark.duration), `${where} mark`).toBe(true); hasMark = true; }
          if (t.mods.trap) expect(!!u.base.trap, `${where} trap mods need a trap unit`).toBe(true);
          if (t.mods.turret) expect(!!u.base.turret, `${where} turret mods need a turret unit`).toBe(true);
          // (Chigusa's Harvest brings her coins with a tier: applyModSet creates the income block)
          if (t.mods.income) expect(!!u.base.income || !!u.base.vine, `${where} income mods need an income unit`).toBe(true);
          if (t.mods.relay) expect(!!u.base.relay, `${where} relay mods need a familiar / mirror unit`).toBe(true);
        }
        // Tenka's keys: a well arrives with its cadence, size and duration; Last Line whole (the validator)
        let hasWell = false;
        let hasLab = false;
        for (const [i, t] of p.tiers.entries()) {
          const where = `${u.id}.${p.id}.t${i + 1}`;
          if (t.mods.well && !hasWell) { expect(isPos(t.mods.well.every) && isPos(t.mods.well.time) && isPos(t.mods.well.radius), `${where} well`).toBe(true); hasWell = true; }
          if (t.mods.lab && !hasLab) { expect(t.mods.lab.rounds > 0, `${where} lab.rounds`).toBe(true); hasLab = true; }
        }
      }
    }
  });

  it('lab, well and lastLine are Tenka\'s alone until their behaviour lands (BUILD_PLAN 6.9: T1 wells, T2 the lab)', () => {
    const users = new Set();
    for (const u of UNITS) for (const t of allTiers(u)) if (t.mods.lab || t.mods.well || t.mods.lastLine) users.add(u.id);
    expect([...users]).toEqual(['tenka']);
    // they resolve onto her stats (normalised), and onto nobody else's
    const lab = resolveStats(getUnit('tenka'), { tiers: [5, 2, 0] });
    expect(lab.lab).toEqual({ rounds: 2, power: 3 });
    expect('well' in lab || 'lastLine' in lab).toBe(false);
    const sing = resolveStats(getUnit('tenka'), { tiers: [0, 2, 5] });
    expect(sing.well).toEqual({ every: 8, time: 6, radius: 2, pull: 1.2, slow: 0.3, vuln: 0.2 });
    expect(sing.lastLine).toEqual({ radius: 1.5, max: 30, time: 8, cooldown: 120 });
    expect('lab' in sing).toBe(false);
    for (const u of UNITS.filter((x) => x.id !== 'tenka')) {
      const st = resolveStats(u, { tiers: [5, 2, 0] });
      expect('lab' in st || 'well' in st || 'lastLine' in st, u.id).toBe(false);
    }
  });

  it.each(UNITS.map((u) => [u.id, u]))('%s awaken passive is a valid ModSet', (id, u) => {
    const a = u.awakenPassive;
    expect(Object.keys(a).sort()).toEqual(['desc', 'mods', 'name']);
    expect(a.name.length).toBeGreaterThan(2);
    expect(a.desc.length).toBeGreaterThan(5);
    expect(Object.keys(a.mods).length).toBeGreaterThan(0);
    expect(modSetErrors(a.mods, `${id}.awaken`)).toEqual([]);
  });
});

describe('capabilities are honest', () => {
  it.each(UNITS.map((u) => [u.id, u]))('%s declared capabilities match its stats and upgrades', (id, u) => {
    const baseCaps = derivedCaps(u.base);
    if (u.placement === 'water' || u.placement === 'amphibious') baseCaps.add('water');
    for (const c of baseCaps) expect(u.capabilities, `${id} base grants ${c}`).toContain(c);
    for (const c of u.capabilities) if (!MANUAL_CAPS.includes(c)) expect(baseCaps.has(c), `${id} claims ${c} at base`).toBe(true);

    const reach = new Set();
    for (const t of allTiers(u)) derivedCaps(t.mods, reach);
    if (u.hero) for (const l of u.hero.levels) derivedCaps(l.mods, reach);
    const declared = new Set([...u.capabilities, ...u.pathCapabilities]);
    for (const c of reach) expect(declared.has(c), `${id} upgrades grant ${c} but it is not declared`).toBe(true);
    for (const c of u.pathCapabilities) if (!MANUAL_CAPS.includes(c)) expect(reach.has(c), `${id} claims path cap ${c}`).toBe(true);
  });
});

describe('design requirements', () => {
  it('free counters exist from the start', () => {
    const h = getUnit('hikari');
    expect(h.base.detection).toBe(true);
    expect(h.attackType).toBe('holy');
    expect(getUnit('kage').base.detection).toBe(true);
    expect(getUnit('shiro').base.armorPen).toBeGreaterThan(0);
    expect(getUnit('midori').base.status.some((s) => s.type === 'poison')).toBe(true);
    const sango = getUnit('sango');
    expect(sango.base.barrierMul).toBeGreaterThan(1);
    expect(sango.capabilities).toContain('barrierBreak');
    expect(sango.pathCapabilities).toContain('armorShred');
    for (const id of ['aoi', 'kage', 'shiro']) expect(getUnit(id).base.canHitAir, id).toBe(true);
  });

  it('melee girls cannot hit air at base', () => {
    for (const u of UNITS) {
      const melee = ['pulse', 'duel'].includes(u.base.behavior) && ['cleaver', 'duelist', 'vanguard', 'champion'].includes(u.role);
      if (melee) expect(u.base.canHitAir, u.id).toBe(false);
    }
    for (const id of ['rei', 'kaede', 'hikari']) {
      expect(getUnit(id).base.range).toBeGreaterThanOrEqual(1.6);
      expect(getUnit(id).base.range).toBeLessThanOrEqual(2.2);
    }
  });

  it('signature behaviours match the design brief', () => {
    const momo = getUnit('momo');
    expect(momo.base.income.perWave).toBeGreaterThan(0);
    expect(momo.base.damage).toBeGreaterThan(0);
    expect(momo.base.damage).toBeLessThanOrEqual(3);
    expect(getUnit('miko').base.aura.dmgMul).toBeGreaterThan(1);
    const umeko = getUnit('umeko');
    expect(umeko.base.aura.detection).toBe(true);
    expect(umeko.placement).toBe('amphibious');
    const chika = getUnit('chika');
    // her own weak wrench bolt, plus a wing of roaming drones that fly past her range ring
    expect(chika.base.behavior).toBe('projectile');
    expect(chika.base.turret.max).toBeGreaterThan(0);
    expect(chika.base.turret.leash).toBeGreaterThan(chika.base.range);
    const tesla = chika.paths[2].tiers[3];
    expect(tesla.desc).not.toMatch(/Stops building/);
    // the coil keeps 9 damage × 1.0/s: (2 + 7) damage, 0.8 × 1.25 rate
    expect(chika.base.damage + tesla.mods.damage).toBe(9);
    expect(chika.base.rate * tesla.mods.rateMul).toBeCloseTo(1, 9);
    expect(chika.paths.some((p) => p.tiers.some((t) => t.mods.aura?.cleanse))).toBe(true);
    expect(getUnit('suzu').base.behavior).toBe('trap');
    const kaede = getUnit('kaede');
    expect(kaede.base.behavior).toBe('duel');
    expect(kaede.base.ramp.per).toBeGreaterThan(0);
    expect(getUnit('raika').base.behavior).toBe('chain');
    expect(getUnit('raika').base.chain).toBeGreaterThan(0);
    const luna = getUnit('luna');
    expect(luna.base.behavior).toBe('beam');
    expect(luna.base.projectiles).toBe(3);
    const hotaru = getUnit('hotaru');
    expect(hotaru.base.behavior).toBe('pulse');
    expect(hotaru.attackType).toBe('holy');
    expect(hotaru.base.reveal).toBeGreaterThan(0);
    expect(hotaru.base.silence).toBeGreaterThan(0);
    const rei = getUnit('rei');
    expect(rei.base.behavior).toBe('pulse');
    expect(rei.base.maxTargets).toBeLessThan(10);
    expect(rei.paths.some((p) => p.tiers.some((t) => t.mods.behavior === 'duel'))).toBe(true);
  });

  it('the free cleanse (vs sabotage) is reachable by Lv 10 of the starter hero', () => {
    const hikari = getUnit('hikari');
    const first = hikari.hero.levels.find((l) => l.mods.aura?.cleanse);
    expect(first.level).toBeLessThanOrEqual(10);
  });

  it('water units exist: two towers and two heroes (amphibious again, as in the Codex)', () => {
    const water = UNITS.filter((u) => u.placement === 'water' || u.placement === 'amphibious');
    expect(water.map((u) => u.id).sort()).toEqual(['nami', 'sango', 'seiran', 'umeko']);
  });

  // Owner, Oct 14 / Oct 20: new girls wear academy school uniforms with modern tech gear, never fantasy
  // or traditional outfits; adult staff wear staff / officer coats. Live girls and skins keep theirs.
  it('look guard: the returning girls use no fantasy or traditional looks', () => {
    const BANNED = { outfit: ['miko', 'kimono', 'robe', 'armor', 'dress'], accessory: ['witchHat'] };
    const SCHOOL = ['sailor', 'blazer', 'hoodie', 'coat', 'jumpsuit'];
    for (const id of RETURNING) {
      const u = getUnit(id);
      for (const [k, banned] of Object.entries(BANNED)) expect(banned, `${id}.look.${k}`).not.toContain(u.look[k]);
      expect(SCHOOL, `${id} wears a school / staff uniform`).toContain(u.look.outfit);
      expect(u.bio, `${id} bio names her uniform`).toMatch(/uniform|blazer|jacket|coat|cardigan/i);
      expect(u.bio, `${id} bio has no fantasy outfit words`).not.toMatch(/kimono|hanfu|robe|armou?red|witch|habit|miko/i);
    }
    for (const id of ['kanna', 'yoriko', 'seiran']) expect(getUnit(id).bio, `${id} is staff`).toMatch(/adult/);
    // Hana's bio matches the sim and her companion (M2): Kaze swoops out on every enemy she shoots (src/render/
    // companions.js: a swoop on each of her attacks), flyers first (her default target mode, Air: ROLE_TARGET_MODE)
    const hana = getUnit('hana').bio;
    expect(hana).not.toMatch(/until a flyer shows up/);
    expect(hana).toMatch(/Kaze[^.]*swoops out at every enemy she shoots, flyers first/);
    expect(ROLE_TARGET_MODE[getUnit('hana').role]).toBe('air');
  });

  it('Ouka\'s Club Mentors / Festival of Clubs say both: the speed since v0.1.40 and the ability recharge (owner default Q1)', () => {
    const tiers = getUnit('ouka').paths.find((p) => p.id === 'assembly').tiers;
    const mentors = tiers.find((t) => t.name === 'Club Mentors');
    const festival = tiers.find((t) => t.name === 'Festival of Clubs');
    expect(mentors.mods.hub).toEqual({ rateMul: 1.15, cdCut: 0.15 });
    expect(festival.mods.hub).toEqual({ rateMul: 1.25, rangeMul: 1.15, cdCut: 0.25 });
    expect(mentors.desc).toBe('Girls in her radius attack 15% faster, and their abilities recharge 15% faster.');
    expect(festival.desc).toBe('Girls in her radius attack 25% faster and reach 15% further; their abilities recharge 25% faster.');
    // every number the text says is one her mods carry
    for (const t of [mentors, festival]) {
      const pcts = [...t.desc.matchAll(/(\d+)%/g)].map((m) => Number(m[1]) / 100);
      const mods = Object.values(t.mods.hub).map((v) => Math.round((v > 1 ? v - 1 : v) * 100) / 100);
      for (const x of pcts) expect(mods, `${t.name} ${x}`).toContain(x);
    }
  });

  it('respects the balance anchors', () => {
    const aoi = getUnit('aoi').base;
    expect([aoi.cost, aoi.damage, aoi.rate, aoi.range]).toEqual([200, 4, 1.4, 3.2]);
    for (const u of towers()) {
      const [lo, hi] = PRICE_BANDS[u.role]?.base ?? LIVE_BASE_COST;
      expect(u.base.cost, u.id).toBeGreaterThanOrEqual(lo);
      expect(u.base.cost, u.id).toBeLessThanOrEqual(hi);
    }
    for (const u of heroes()) expect(u.base.cost, u.id).toBe(0); // heroes deploy for free
    const shiro = getUnit('shiro').base.range;
    expect(shiro).toBeGreaterThanOrEqual(8);
    expect(shiro).toBeLessThanOrEqual(12);
    // R towers ≈ 5–7 raw single-target DPS per 200 coins (attackers only).
    for (const id of ['aoi']) {
      const b = getUnit(id).base;
      const dpsPer200 = (b.damage * b.rate * b.projectiles) / b.cost * 200;
      expect(dpsPer200).toBeGreaterThanOrEqual(5);
      expect(dpsPer200).toBeLessThanOrEqual(7);
    }
  });

  it('every mechanic in the type chart has at least one free counter', () => {
    const freeIds = UNITS.filter((u) => u.acquisition.type !== 'gacha').map((u) => u.id);
    for (const cap of ['detection', 'antiAir', 'armorPen', 'armorShred', 'barrierBreak', 'slow', 'stun', 'silence', 'antiHeal', 'reveal', 'buff', 'trap', 'water', 'multiHit', 'priority', 'cleanse']) {
      const owners = unitsWithCapability(cap).map((u) => u.id).filter((id) => freeIds.includes(id));
      expect(owners.length, `free counter for ${cap}`).toBeGreaterThan(0);
    }
  });
});

describe('hero definitions', () => {
  const ULT = { hikari: 'nova', luna: 'timeWarp', nami: 'tide', kanna: 'strike', yoriko: 'tide', seiran: 'runner', kogane: 'runner', norika: 'barricade' };
  // Every old upgrade tier and level milestone, frozen: the 25-level track must carry each exactly once.
  const OLD_REFS = {
    hikari: ['radiant', 'sanctuary', 'lightbringer'],
    luna: ['lances', 'gravity', 'court'],
    nami: ['frostbrand', 'undertow', 'harbor'],
    kanna: ['rhythm', 'oni', 'dance'],
    yoriko: ['threads', 'theatre', 'nightmare'],
    seiran: ['tempest', 'skyguard', 'rain'],
    kogane: ['drill', 'dozer', 'pods'],
    norika: ['barrier', 'guard', 'detour'],
  };
  // Live (pre-rework) price of the cheapest path source of each capability (tiers 1..n summed);
  // 'T5' = only a tier 5 granted it (exempt from rule 5, it stays on its tier-5 level).
  const OLD_CHEAPEST = {
    hikari: { armorPen: 1420, reveal: 4740, silence: 1540, buff: 140, cleanse: 4740, antiAir: 1400, stun: 'T5' },
    luna: { armorPen: 1600, slow: 140, stun: 4840, buff: 150, detection: 1670 },
    nami: { armorPen: 1380, stun: 460, buff: 120 },
    // the returning heroes: their roster-spec paths (ROSTER_SPEC §5.2), never live as paths
    kanna: { stun: 1470, armorPen: 140, barrierBreak: 1540, antiAir: 1400, reveal: 4300, slow: 'T5' },
    yoriko: { stun: 1380, buff: 140, silence: 1440, armorPen: 1400 },
    seiran: { stun: 1570, grounding: 1440, armorPen: 'T5', buff: 420, slow: 1420 },
    // the staff heroes: their old tower paths (UNIT_GAPS §5.11, §5.12 prices; BANNERS §D.3, §D.4 tiers), never live
    kogane: { antiAir: 1370, detection: 1430, stun: 430, barrierBreak: 4630, armorShred: 4960 },
    norika: { antiAir: 120, detection: 390, slow: 1340 },
  };
  const priceTo = (level) => HERO_LEVEL_PRICES.slice(0, level - 1).reduce((a, b) => a + b, 0);

  it('the cap is 25 and the shared XP / price tables have 24 positive, non-decreasing entries', () => {
    expect(BATTLE.maxHeroLevel).toBe(25);
    for (const t of [HERO_XP_STEPS, HERO_LEVEL_PRICES]) {
      expect(t).toHaveLength(24);
      for (let i = 0; i < 24; i++) {
        expect(isPos(t[i])).toBe(true);
        if (i > 0) expect(t[i]).toBeGreaterThanOrEqual(t[i - 1]);
      }
    }
    expect(HERO_XP_STEPS.reduce((a, b) => a + b, 0)).toBe(24280);
    expect(priceTo(25)).toBe(40285);
  });

  it.each(heroes().map((u) => [u.id, u]))('%s HeroDef is a complete 25-level track', (id, u) => {
    const h = u.hero;
    expect(u.base.cost).toBe(0);
    expect(u.paths).toEqual([]);
    // `skill`: the Lv 7 skill, attached from src/data/abilities.js (tests/data/abilities.test.js); every hero has one
    // since A3 M3 attached the returning heroes' too
    expect(h.skill, id).toBeTruthy();
    expect(Object.keys(h).sort()).toEqual(['levels', 'pathKeys', 'skill', 'ult']);
    expect(h.levels).toBe(HERO_TRACKS[id].levels);
    expect(h.pathKeys).toEqual(OLD_REFS[id]);
    expect(h.levels.map((l) => l.level)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    for (const l of h.levels) {
      expect(['desc', 'from', 'level', 'mods'].every((k) => k in l), `${id}.L${l.level}`).toBe(true);
      expect(Object.keys(l).every((k) => ['also', 'desc', 'from', 'level', 'mods'].includes(k))).toBe(true);
      expect(l.desc.length).toBeGreaterThan(5);
      expect(modSetErrors(l.mods, `${id}.L${l.level}`)).toEqual([]);
      if (l.level > 1) expect(Object.keys(l.mods).length, `${id}.L${l.level} must give something`).toBeGreaterThan(0);
    }
    // `from` covers every old tier and milestone exactly once
    const want = ['base', ...OLD_REFS[id].flatMap((p) => [1, 2, 3, 4, 5].map((t) => `${p}.${t}`)),
      ...[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `L${n}`)].sort();
    expect(h.levels.map((l) => l.from).sort()).toEqual(want);
    // `also` points at a later level's `from`
    for (const l of h.levels) for (const ref of l.also || []) {
      const target = h.levels.find((x) => x.from === ref);
      expect(target && target.level > l.level, `${id}.L${l.level} also ${ref}`).toBe(true);
    }
    const ult = h.ult;
    expect(Object.keys(ult).sort()).toEqual(['cooldown', 'desc', 'effect', 'name', 'ranks', 'unlockLevel']);
    expect(ult.unlockLevel).toBe(3);
    expect(ult.cooldown).toBeGreaterThanOrEqual(30);
    expect(ult.effect.type).toBe(ULT[id]);
    expect(ult.ranks.map((r) => r.level)).toEqual([10, 20]);
    for (const r of ult.ranks) {
      expect(r.level > 3 && r.level <= 25).toBe(true);
      expect(r.cooldownMul > 0 && r.cooldownMul <= 1).toBe(true);
      expect(r.desc.length).toBeGreaterThan(5);
    }
    let e = ult.effect;
    for (const r of [null, ...ult.ranks]) {
      if (r) e = { ...e, ...r.effect };
      expect(e.type).toBe(ULT[id]);
      if (e.type === 'nova') {
        expect(isPos(e.damage) && isNum(e.radius) && e.radius >= 0 && !!ATTACK_TYPES[e.attackType]).toBe(true);
      } else if (e.type === 'timeWarp') {
        expect(e.slow > 0 && e.slow < 1 && isPos(e.duration) && e.rateBuff > 1 && isPos(e.buffDuration)).toBe(true);
      } else if (e.type === 'strike') {
        expect(isPos(e.damage) && ['strongest', 'first'].includes(e.target) && (e.splash ?? 0) >= 0).toBe(true);
        if (e.splash) expect(e.splashMul > 0 && e.splashMul <= 1).toBe(true);
      } else if (e.type === 'barricade') {
        // Hold the Line: count barricades of `budget` for `duration` s, +held damage on the enemies they hold
        expect(Number.isInteger(e.count) && e.count >= 1 && isPos(e.budget) && isPos(e.duration) && e.held >= 0 && typeof e.mini === 'boolean').toBe(true);
      } else if (e.type === 'runner') {
        expect(isPos(e.damage) && isPos(e.time) && Number.isInteger(e.segments) && e.segments >= 1 && isPos(e.gap)).toBe(true);
        // a fixed flight (`length` tiles) or the whole road back to START (`toStart`, never slower than `minSpeed`)
        expect(e.toStart ? e.toStart === true && isPos(e.minSpeed) && e.length === undefined : isPos(e.length)).toBe(true);
        expect(e.center === undefined || e.center === 'aim').toBe(true);
      } else {
        expect(isPos(e.damage) && isPos(e.pushback) && e.slow > 0 && e.slow < 1 && isPos(e.duration)).toBe(true);
      }
      if (e.status) expect(statusErrors(e.status, `${id}.ult`)).toEqual([]);
    }
  });

  it.each(heroes().map((u) => [u.id, u]))('%s: counters come early (rule 5)', (id, u) => {
    for (const cap of u.pathCapabilities) {
      let first = 0;
      const grants = (st) => statsCapabilities(st).has(cap) || (cap === 'detection' && !!st.aura?.detection); // Veil Sight aura
      for (let L = 1; L <= 25 && !first; L++) if (grants(resolveStats(u, { heroLevel: L }))) first = L;
      expect(first, `${id} never grants ${cap}`).toBeGreaterThan(0);
      const old = OLD_CHEAPEST[id][cap];
      expect(old, `${id} ${cap} needs a frozen old price`).toBeDefined();
      if (old === 'T5') {
        expect(u.hero.levels[first - 1].from.endsWith('.5'), `${id} ${cap} stays on its tier 5`).toBe(true);
      } else {
        expect(first <= 10 || priceTo(first) <= 1.5 * old, `${id} ${cap} first at Lv ${first} (${priceTo(first)} coins)`).toBe(true);
      }
    }
  });

  it.each(heroes().map((u) => [u.id, u]))('%s Lv 25 stats are frozen (catches accidental power changes)', (id, u) => {
    expect(resolveStats(u, { heroLevel: 25 })).toMatchSnapshot();
  });

  it('a hero with her own levelXp must carry levelPrices of the same length', () => {
    for (const u of heroes()) {
      if (u.hero.levelXp) {
        expect(u.hero.levelXp).toHaveLength(24);
        expect(u.hero.levelPrices).toHaveLength(24);
      } else expect(u.hero.levelPrices).toBeUndefined();
    }
  });

  it('towers carry no HeroDef', () => {
    for (const u of towers()) expect(u.hero).toBeUndefined();
  });
});

describe('helpers', () => {
  it('getUnit returns defs and throws on unknown ids', () => {
    expect(getUnit('aoi').name).toBe('Aoi');
    expect(() => getUnit('nobody')).toThrow(/Unknown unit/);
  });

  // counts come from the contract table, so a new girl is one ROSTER row (no number to bump)
  const rosterIds = (pred) => ROSTER.filter(pred).map((r) => r[0]);

  it('towers() and heroes() split the roster', () => {
    expect(towers().map((u) => u.id)).toEqual(rosterIds((r) => r[1] === 'tower'));
    expect(heroes().map((u) => u.id)).toEqual(rosterIds((r) => r[1] === 'hero'));
    expect(towers().length + heroes().length).toBe(UNITS.length);
    expect(heroes().slice(0, 3).map((u) => u.id)).toEqual(['hikari', 'luna', 'nami']);
  });

  it('unitsByRarity builds the gacha pools', () => {
    for (const rarity of ['R', 'SR', 'SSR']) {
      expect(unitsByRarity(rarity).map((u) => u.id), rarity).toEqual(rosterIds((r) => r[2] === rarity));
      expect(unitsByRarity(rarity, { kind: 'tower' }).map((u) => u.id), rarity).toEqual(rosterIds((r) => r[2] === rarity && r[1] === 'tower'));
    }
    expect(unitsByRarity('R').slice(0, 4).map((u) => u.id)).toEqual(['aoi', 'rei', 'yuki', 'momo']);
    expect(unitsByRarity('SSR', { kind: 'tower' }).map((u) => u.id)).toContain('tenka');
    const total = ['R', 'SR', 'SSR'].reduce((n, r) => n + unitsByRarity(r).length, 0);
    expect(total).toBe(ROSTER.length);
  });

  it('freeUnlocksByStage maps stages to free recruits', () => {
    expect(freeUnlocksByStage()).toEqual({
      '1-2': ['yuki'], '1-5': ['nami', 'sango'], '2-2': ['azami'], '2-5': ['kage'], '3-2': ['umeko'], '4-2': ['yuzuha'],
      '3-5': ['shiro'], '4-5': ['midori'], '5-5': ['suzu'], '6-2': ['noa'], '6-5': ['wakaba'], '7-5': ['hana'],
    });
  });

  it('capability helpers find counters', () => {
    expect(hasCapability('kage', 'detection')).toBe(true);
    expect(hasCapability('aoi', 'detection')).toBe(true);
    expect(hasCapability('aoi', 'detection', { includePaths: false })).toBe(false);
    const det = unitsWithCapability('detection').map((u) => u.id);
    expect(det).toEqual(expect.arrayContaining(['hikari', 'kage', 'umeko', 'hotaru']));
    // base owners first
    const firstPathOnly = det.findIndex((id) => !getUnit(id).capabilities.includes('detection'));
    expect(det.slice(firstPathOnly).every((id) => !getUnit(id).capabilities.includes('detection'))).toBe(true);
    expect(unitsWithCapability('antiHeal', { kind: 'tower' }).map((u) => u.id)).toEqual(['midori', 'ena', 'chigusa']);
  });

  it('tier cost helpers add up', () => {
    expect(tierCost('aoi', 0, 1)).toBe(100);
    expect(pathCostTo('aoi', 0, 0)).toBe(0);
    expect(pathCostTo('aoi', 0, 3)).toBe(100 + 220 + 650);
    expect(() => tierCost('aoi', 0, 6)).toThrow();
  });
});
