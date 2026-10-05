import { describe, it, expect } from 'vitest';
import {
  UNITS, UNIT_MAP, UNIT_IDS, getUnit, towers, heroes, unitsByRarity, freeUnlocksByStage,
  hasCapability, unitsWithCapability, tierCost, pathCostTo,
} from '../../src/data/units.js';
import {
  ATTACK_TYPES, ELEMENTS, STATUSES, ROLES, CAPABILITIES, PLACEMENT, UNIT_RARITIES, MATERIAL_FAMILIES,
} from '../../src/data/types.js';

// ---------------------------------------------------------------------------
// Contract tables (CONTRACTS.md §3) — copied verbatim so drift is caught.
// ---------------------------------------------------------------------------

const ROSTER = [
  ['hikari', 'hero', 'SSR', 'vanguard', 'holy', null, 'land', 'charm', 'starter'],
  ['luna', 'hero', 'SSR', 'mystic', 'mystic', null, 'land', 'rune', 'gacha'],
  ['nami', 'hero', 'SR', 'tideguard', 'mystic', 'frost', 'water', 'rime', '1-5'],
  ['aoi', 'tower', 'R', 'marksman', 'pierce', null, 'land', 'feather', 'starter'],
  ['rei', 'tower', 'R', 'cleaver', 'slash', null, 'land', 'blade', 'starter'],
  ['yuki', 'tower', 'R', 'controller', 'mystic', 'frost', 'land', 'rime', '1-2'],
  ['momo', 'tower', 'R', 'economy', 'pierce', null, 'land', 'cog', 'gacha'],
  ['akane', 'tower', 'SR', 'bombardment', 'blast', 'fire', 'land', 'ember', 'gacha'],
  ['sango', 'tower', 'SR', 'artillery', 'blast', 'water', 'water', 'ember', '1-5'],
  ['kage', 'tower', 'SR', 'skirmisher', 'pierce', null, 'land', 'feather', '2-5'],
  ['umeko', 'tower', 'SR', 'support', 'mystic', 'water', 'water', 'charm', '3-2'],
  ['shiro', 'tower', 'SR', 'sniper', 'pierce', null, 'land', 'feather', '3-5'],
  ['midori', 'tower', 'SR', 'alchemist', 'mystic', 'poison', 'land', 'rune', '4-5'],
  ['suzu', 'tower', 'SR', 'trapper', 'blast', null, 'land', 'cog', '5-5'],
  ['raika', 'tower', 'SR', 'chain', 'mystic', 'lightning', 'land', 'rune', 'gacha'],
  ['miko', 'tower', 'SR', 'enchanter', 'holy', null, 'land', 'charm', 'gacha'],
  ['hotaru', 'tower', 'SSR', 'exorcist', 'holy', null, 'land', 'charm', 'gacha'],
  ['kaede', 'tower', 'SSR', 'duelist', 'slash', null, 'land', 'blade', 'gacha'],
  ['chika', 'tower', 'SSR', 'engineer', 'pierce', 'lightning', 'land', 'cog', 'gacha'],
];

const UNIT_KEYS = [
  'id', 'name', 'title', 'kind', 'rarity', 'adult', 'role', 'attackType', 'element', 'placement',
  'materialFamily', 'capabilities', 'pathCapabilities', 'acquisition', 'palette', 'look', 'bio',
  'personality', 'quote', 'tips', 'base', 'paths', 'awakenPassive',
];
const PALETTE_KEYS = ['hair', 'hairShade', 'eyes', 'skin', 'outfit', 'outfitShade', 'accent', 'halo', 'weapon'];
const LOOK_ENUMS = {
  hairStyle: ['twintails', 'ponytail', 'long', 'bob', 'braid', 'buns', 'short', 'side', 'hime', 'wavy'],
  bangs: ['straight', 'swept', 'split', 'hime', 'messy'],
  accessory: ['ribbon', 'bunnyEars', 'catEars', 'foxEars', 'hairpin', 'beret', 'witchHat', 'horns', 'flower', 'goggles', 'hood', 'headband', 'crown', 'none'],
  outfit: ['sailor', 'blazer', 'miko', 'kimono', 'hoodie', 'dress', 'armor', 'coat', 'apron', 'jumpsuit', 'robe'],
  weapon: ['bow', 'katana', 'staff', 'cannon', 'rifle', 'shuriken', 'tome', 'bell', 'wrench', 'lantern', 'flask', 'parasol', 'trident', 'fan', 'rapier', 'gohei', 'coinPurse', 'sword'],
  halo: ['ring', 'star', 'petal', 'gear', 'moon', 'flame', 'wave', 'crown', 'snow', 'bolt', 'leaf', 'eye'],
  eyeStyle: ['round', 'sharp', 'sleepy', 'sparkle', 'closed'],
  expression: ['smile', 'smug', 'calm', 'determined', 'shy', 'cheerful'],
};
const BEHAVIORS = ['projectile', 'pulse', 'duel', 'beam', 'chain', 'trap', 'turret', 'none'];
const BASE_REQUIRED = [
  'cost', 'behavior', 'damage', 'rate', 'range', 'projectiles', 'pierce', 'splash', 'chain', 'maxTargets',
  'projectileSpeed', 'armorPen', 'canHitAir', 'detection', 'status', 'crit', 'eliteMul', 'bossMul', 'barrierMul',
];
const BASE_OPTIONAL = ['aura', 'income', 'trap', 'turret', 'ramp', 'mark', 'silence', 'reveal', 'knockback'];
const AURA_KEYS = ['range', 'dmgMul', 'rateMul', 'rangeMul', 'detection', 'costCut', 'cleanse'];

// Tier cost windows from CONTRACTS.md §5b.
const TIER_COST = [[80, 450], [80, 450], [500, 1400], [1800, 4500], [7000, 16000]];

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
};

/** Returns a list of problems with a StatusSpec array. */
function statusErrors(list, where) {
  const errs = [];
  if (!Array.isArray(list)) return [`${where}: status must be an array`];
  for (const s of list) {
    if (!s || !STATUSES[s.type] || !STATUS_FIELDS[s.type]) { errs.push(`${where}: unknown status ${JSON.stringify(s)}`); continue; }
    const allowed = ['type', 'chance', ...STATUS_FIELDS[s.type]];
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
    trap: (k, v, w) => objErrors(v, ['max', 'damage', 'splash', 'status'], w, (kk, vv, ww) => (kk === 'status' ? statusErrors(vv, ww) : numCheck(kk, vv, ww))),
    turret: (k, v, w) => objErrors(v, ['max', 'damage', 'range', 'rate'], w, numCheck),
    ramp: (k, v, w) => objErrors(v, ['per', 'max'], w, numCheck),
    mark: (k, v, w) => objErrors(v, ['bonus', 'duration'], w, numCheck),
  };
  for (const [k, v] of Object.entries(mods)) {
    if (!M[k]) errs.push(`${where}: unknown mod key "${k}"`);
    else errs.push(...M[k](k, v, `${where}.${k}`));
  }
  return errs;
}

function baseErrors(b, where) {
  const errs = [];
  for (const k of BASE_REQUIRED) if (!(k in b)) errs.push(`${where}: missing ${k}`);
  for (const k of Object.keys(b)) if (!BASE_REQUIRED.includes(k) && !BASE_OPTIONAL.includes(k)) errs.push(`${where}: unknown key ${k}`);
  if (!BEHAVIORS.includes(b.behavior)) errs.push(`${where}: bad behavior`);
  for (const k of ['cost', 'rate', 'range', 'projectiles', 'pierce', 'maxTargets']) if (!isPos(b[k])) errs.push(`${where}: ${k} must be > 0`);
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
  if (b.trap) {
    errs.push(...objErrors(b.trap, ['max', 'damage', 'triggerRadius', 'armTime', 'splash', 'status'], `${where}.trap`, (k, v, w) => (k === 'status' ? statusErrors(v, w) : numCheck(k, v, w))));
    for (const k of ['max', 'damage', 'triggerRadius', 'armTime', 'splash', 'status']) if (!(k in b.trap)) errs.push(`${where}: trap missing ${k}`);
  }
  if (b.turret) {
    errs.push(...objErrors(b.turret, ['max', 'damage', 'rate', 'range', 'attackType', 'status'], `${where}.turret`, (k, v, w) => {
      if (k === 'status') return statusErrors(v, w);
      if (k === 'attackType') return ATTACK_TYPES[v] ? [] : [`${w} unknown attack type`];
      return numCheck(k, v, w);
    }));
    for (const k of ['max', 'damage', 'rate', 'range']) if (!(k in b.turret)) errs.push(`${where}: turret missing ${k}`);
  }
  if (b.ramp) errs.push(...objErrors(b.ramp, ['per', 'max'], `${where}.ramp`, numCheck));
  if (b.mark) errs.push(...objErrors(b.mark, ['bonus', 'duration'], `${where}.mark`, numCheck));
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
  if (m.aura && ((m.aura.dmgMul ?? 1) > 1 || (m.aura.rateMul ?? 1) > 1 || (m.aura.rangeMul ?? 1) > 1 || (m.aura.costCut ?? 0) > 0)) acc.add('buff');
  if (m.aura?.cleanse) acc.add('cleanse');
  if (m.income) acc.add('income');
  if (m.turret) acc.add('summon');
  if (m.trap) acc.add('trap');
  const statuses = [...(m.status || []), ...(m.trap?.status || []), ...(m.turret?.status || [])];
  for (const s of statuses) {
    if (s.type === 'slow') acc.add('slow');
    if (s.type === 'freeze') { acc.add('slow'); acc.add('stun'); }
    if (s.type === 'stun') acc.add('stun');
    if (s.type === 'shred') acc.add('armorShred');
    if (s.type === 'poison') acc.add('antiHeal');
    if (s.type === 'silence') acc.add('silence');
    if (s.type === 'reveal') acc.add('reveal');
  }
  return acc;
}
const MANUAL_CAPS = ['multiHit', 'priority'];

const allTiers = (u) => u.paths.flatMap((p, pi) => p.tiers.map((t, ti) => ({ ...t, pathIndex: pi, tierNumber: ti + 1, pathId: p.id })));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('roster matches the contract table', () => {
  it('has exactly the 19 contract ids in order', () => {
    expect(UNITS.map((u) => u.id)).toEqual(ROSTER.map((r) => r[0]));
    expect(UNIT_IDS).toEqual(ROSTER.map((r) => r[0]));
    expect(new Set(UNIT_IDS).size).toBe(19);
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
    const expectedKeys = u.kind === 'hero' ? [...UNIT_KEYS, 'hero'] : UNIT_KEYS;
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
  it.each(UNITS.map((u) => [u.id, u]))('%s has 3 paths × 5 tiers with valid ModSets', (id, u) => {
    expect(u.paths).toHaveLength(3);
    expect(new Set(u.paths.map((p) => p.id)).size).toBe(3);
    for (const p of u.paths) {
      expect(Object.keys(p).sort()).toEqual(['focus', 'id', 'name', 'tiers']);
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
    for (const p of u.paths) {
      const costs = p.tiers.map((t) => t.cost);
      for (let i = 0; i < 5; i++) {
        expect(Number.isInteger(costs[i]), `${id}.${p.id} t${i + 1}`).toBe(true);
        expect(costs[i], `${id}.${p.id} t${i + 1} min`).toBeGreaterThanOrEqual(TIER_COST[i][0]);
        expect(costs[i], `${id}.${p.id} t${i + 1} max`).toBeLessThanOrEqual(TIER_COST[i][1]);
        if (i > 0) expect(costs[i], `${id}.${p.id} t${i + 1} increases`).toBeGreaterThan(costs[i - 1]);
      }
    }
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
    for (const u of UNITS) {
      for (const t of allTiers(u)) {
        if (t.tierNumber < 3) continue;
        const keys = Object.keys(t.mods);
        expect(keys.some((k) => !PLAIN.includes(k)), `${u.id}.${t.pathId} t${t.tierNumber} only tweaks numbers`).toBe(true);
      }
    }
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
          if (t.mods.income) expect(!!u.base.income, `${where} income mods need an income unit`).toBe(true);
        }
      }
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
      const melee = ['pulse', 'duel'].includes(u.base.behavior) && ['cleaver', 'duelist', 'vanguard'].includes(u.role);
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
    expect(umeko.placement).toBe('water');
    const chika = getUnit('chika');
    expect(chika.base.behavior).toBe('turret');
    expect(chika.base.turret.max).toBeGreaterThan(0);
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

  it('water units exist: two towers and a hero', () => {
    const water = UNITS.filter((u) => u.placement === 'water');
    expect(water.map((u) => u.id).sort()).toEqual(['nami', 'sango', 'umeko']);
  });

  it('respects the balance anchors', () => {
    const aoi = getUnit('aoi').base;
    expect([aoi.cost, aoi.damage, aoi.rate, aoi.range]).toEqual([200, 4, 1.4, 3.2]);
    for (const u of towers()) {
      expect(u.base.cost, u.id).toBeGreaterThanOrEqual(150);
      expect(u.base.cost, u.id).toBeLessThanOrEqual(900);
    }
    for (const u of heroes()) {
      expect(u.base.cost, u.id).toBeGreaterThanOrEqual(450);
      expect(u.base.cost, u.id).toBeLessThanOrEqual(650);
    }
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
    for (const cap of ['detection', 'antiAir', 'armorPen', 'armorShred', 'barrierBreak', 'slow', 'stun', 'silence', 'antiHeal', 'reveal', 'buff', 'trap', 'water', 'multiHit', 'priority']) {
      const owners = unitsWithCapability(cap).map((u) => u.id).filter((id) => freeIds.includes(id));
      expect(owners.length, `free counter for ${cap}`).toBeGreaterThan(0);
    }
  });
});

describe('hero definitions', () => {
  const ULT = { hikari: 'nova', luna: 'timeWarp', nami: 'tide' };

  it.each(heroes().map((u) => [u.id, u]))('%s HeroDef is complete', (id, u) => {
    const h = u.hero;
    expect(Object.keys(h).sort()).toEqual(['levelXp', 'levels', 'ult']);
    expect(h.levelXp).toHaveLength(9);
    for (let i = 0; i < 9; i++) {
      expect(isPos(h.levelXp[i])).toBe(true);
      if (i > 0) expect(h.levelXp[i]).toBeGreaterThan(h.levelXp[i - 1]);
    }
    expect(h.levels.map((l) => l.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const l of h.levels) {
      expect(Object.keys(l).sort()).toEqual(['desc', 'level', 'mods']);
      expect(l.desc.length).toBeGreaterThan(5);
      expect(modSetErrors(l.mods, `${id}.L${l.level}`)).toEqual([]);
    }
    const ult = h.ult;
    expect(Object.keys(ult).sort()).toEqual(['cooldown', 'desc', 'effect', 'name', 'unlockLevel']);
    expect(ult.unlockLevel).toBe(3);
    expect(ult.cooldown).toBeGreaterThanOrEqual(30);
    expect(ult.effect.type).toBe(ULT[id]);
    const e = ult.effect;
    if (e.type === 'nova') {
      expect(isPos(e.damage) && isNum(e.radius) && e.radius >= 0 && !!ATTACK_TYPES[e.attackType]).toBe(true);
      if (e.status) expect(statusErrors(e.status, `${id}.ult`)).toEqual([]);
    } else if (e.type === 'timeWarp') {
      expect(e.slow > 0 && e.slow < 1 && isPos(e.duration) && e.rateBuff > 1 && isPos(e.buffDuration)).toBe(true);
    } else {
      expect(isPos(e.damage) && isPos(e.pushback) && e.slow > 0 && e.slow < 1 && isPos(e.duration)).toBe(true);
    }
  });

  it('towers carry no HeroDef', () => {
    for (const u of towers()) expect(u.hero).toBeUndefined();
  });

  it('heroes are nerfed: level 10 ≈ a strong tier-4 tower, not a carry', () => {
    // Fold level milestones into base damage/rate and compare raw single-target DPS with Aoi tier 4.
    const aoi = getUnit('aoi');
    const aoiT4 = (aoi.base.damage + 1 + 1 * 0 + 2 + 6) * aoi.base.rate; // Piercing Arrows 1-4 (per target)
    for (const u of heroes()) {
      let dmg = u.base.damage; let dmgMul = 1; let rate = u.base.rate;
      for (const l of u.hero.levels) {
        dmg += l.mods.damage || 0;
        dmgMul *= l.mods.damageMul || 1;
        rate *= l.mods.rateMul || 1;
      }
      const dps = dmg * dmgMul * rate;
      expect(dps, u.id).toBeGreaterThan(aoiT4 * 0.4);
      expect(dps, u.id).toBeLessThan(aoiT4 * 1.5);
    }
  });
});

describe('helpers', () => {
  it('getUnit returns defs and throws on unknown ids', () => {
    expect(getUnit('aoi').name).toBe('Aoi');
    expect(() => getUnit('nobody')).toThrow(/Unknown unit/);
  });

  it('towers() and heroes() split the roster', () => {
    expect(towers()).toHaveLength(16);
    expect(heroes().map((u) => u.id)).toEqual(['hikari', 'luna', 'nami']);
  });

  it('unitsByRarity builds the gacha pools', () => {
    expect(unitsByRarity('R').map((u) => u.id)).toEqual(['aoi', 'rei', 'yuki', 'momo']);
    expect(unitsByRarity('SSR').map((u) => u.id)).toEqual(['hikari', 'luna', 'hotaru', 'kaede', 'chika']);
    expect(unitsByRarity('SSR', { kind: 'tower' }).map((u) => u.id)).toEqual(['hotaru', 'kaede', 'chika']);
    const total = ['R', 'SR', 'SSR'].reduce((n, r) => n + unitsByRarity(r).length, 0);
    expect(total).toBe(19);
  });

  it('freeUnlocksByStage maps stages to free recruits', () => {
    expect(freeUnlocksByStage()).toEqual({
      '1-2': ['yuki'], '1-5': ['nami', 'sango'], '2-5': ['kage'], '3-2': ['umeko'],
      '3-5': ['shiro'], '4-5': ['midori'], '5-5': ['suzu'],
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
    expect(unitsWithCapability('antiHeal', { kind: 'tower' }).map((u) => u.id)).toEqual(['midori']);
  });

  it('tier cost helpers add up', () => {
    expect(tierCost('aoi', 0, 1)).toBe(100);
    expect(pathCostTo('aoi', 0, 0)).toBe(0);
    expect(pathCostTo('aoi', 0, 3)).toBe(100 + 220 + 650);
    expect(() => tierCost('aoi', 0, 6)).toThrow();
  });
});
