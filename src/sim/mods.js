// Tower stat resolution: BaseStats + ModSets (upgrade tiers, hero milestones, awaken
// passive) + profile battle stats. Implements the ModSet table in CONTRACTS.md §3 exactly:
// add keys are summed, mul keys multiplied, grants OR-ed, replace keys take the last
// value, status lists merge by type keeping the stronger numbers.

import { DEFAULT_UNIT_STATS } from './constants.js';

const ADD_KEYS = ['range', 'projectiles', 'pierce', 'chain', 'maxTargets', 'splash', 'armorPen', 'projectileSpeed', 'silence', 'reveal', 'knockback'];
const MUL_KEYS = ['rateMul', 'eliteMul', 'bossMul', 'barrierMul'];
const REPLACE_KEYS = ['attackType', 'element', 'behavior'];

function normAura(a = {}) {
  return {
    range: a.range ?? 0,
    dmgMul: a.dmgMul ?? 1,
    rateMul: a.rateMul ?? 1,
    rangeMul: a.rangeMul ?? 1,
    detection: !!a.detection,
    costCut: a.costCut ?? 0,
    cleanse: !!a.cleanse,
  };
}

function normTrap(t = {}) {
  return {
    max: t.max ?? 0,
    damage: t.damage ?? 0,
    triggerRadius: t.triggerRadius ?? 0.6,
    armTime: t.armTime ?? 1.0,
    splash: t.splash ?? 0.8,
    status: (t.status || []).map((s) => ({ ...s })),
  };
}

function normTurret(t = {}) {
  return {
    max: t.max ?? 0,
    damage: t.damage ?? 0,
    rate: t.rate ?? 1,
    range: t.range ?? 3,
    attackType: t.attackType ?? null,
    status: (t.status || []).map((s) => ({ ...s })),
  };
}

/**
 * Merges StatusSpecs into a list: a new type is appended, an existing type keeps the
 * stronger value of every numeric field (amount, dps, bonus, duration, chance).
 * @param {object[]} list mutated
 * @param {object[]} specs
 */
export function mergeStatusList(list, specs) {
  for (const spec of specs || []) {
    if (!spec || !spec.type) continue;
    const cur = list.find((s) => s.type === spec.type);
    if (!cur) {
      list.push({ ...spec });
      continue;
    }
    for (const k of Object.keys(spec)) {
      if (k === 'type' || k === 'chance') continue;
      if (typeof spec[k] === 'number') cur[k] = typeof cur[k] === 'number' ? Math.max(cur[k], spec[k]) : spec[k];
      else if (cur[k] === undefined) cur[k] = spec[k];
    }
    // A missing chance means "always" (1), which is the strongest possible value.
    if (cur.chance === undefined || spec.chance === undefined) delete cur.chance;
    else cur.chance = Math.max(cur.chance, spec.chance);
  }
  return list;
}

/**
 * Fills BaseStats defaults so later code never checks for undefined.
 * @param {object} base UnitDef.base
 * @param {object} unitDef for attackType/element defaults
 */
export function normalizeBase(base = {}, unitDef = {}) {
  const b = base || {};
  return {
    cost: b.cost ?? 0,
    behavior: b.behavior ?? 'projectile',
    attackType: b.attackType ?? unitDef.attackType ?? 'pierce',
    element: b.element !== undefined ? b.element : (unitDef.element ?? null),
    damage: b.damage ?? 0,
    rate: b.rate ?? 1,
    range: b.range ?? 3,
    projectiles: b.projectiles ?? 1,
    pierce: b.pierce ?? 1,
    splash: b.splash ?? 0,
    chain: b.chain ?? 0,
    maxTargets: b.maxTargets ?? 99,
    projectileSpeed: b.projectileSpeed ?? 14,
    armorPen: b.armorPen ?? 0,
    canHitAir: b.canHitAir ?? true,
    detection: !!b.detection,
    status: (b.status || []).map((s) => ({ ...s })),
    crit: { chance: b.crit?.chance ?? 0, mul: b.crit?.mul ?? 1.5 },
    eliteMul: b.eliteMul ?? 1,
    bossMul: b.bossMul ?? 1,
    barrierMul: b.barrierMul ?? 1,
    aura: b.aura ? normAura(b.aura) : null,
    income: b.income ? { perWave: b.income.perWave ?? 0, interest: b.income.interest ?? 0 } : null,
    trap: b.trap ? normTrap(b.trap) : null,
    turret: b.turret ? normTurret(b.turret) : null,
    ramp: b.ramp ? { per: b.ramp.per ?? 0, max: b.ramp.max ?? 0 } : null,
    mark: b.mark ? { bonus: b.mark.bonus ?? 0, duration: b.mark.duration ?? 0 } : null,
    silence: b.silence ?? 0,
    reveal: b.reveal ?? 0,
    knockback: b.knockback ?? 0,
  };
}

/**
 * Applies one ModSet to normalized stats in place. Damage add/mul are accumulated in
 * `acc` and resolved by resolveStats as (base + Σadd) × Πmul.
 */
export function applyModSet(s, mods, acc) {
  if (!mods) return s;
  for (const key of Object.keys(mods)) {
    const v = mods[key];
    if (v === undefined || v === null) continue;
    if (key === 'damage') acc.damageAdd += v;
    else if (key === 'damageMul') acc.damageMul *= v;
    else if (ADD_KEYS.includes(key)) s[key] += v;
    else if (MUL_KEYS.includes(key)) {
      if (key === 'rateMul') s.rate *= v;
      else s[key] *= v;
    } else if (key === 'canHitAir' || key === 'detection') {
      if (v) s[key] = true;
    } else if (REPLACE_KEYS.includes(key)) s[key] = v;
    else if (key === 'status') mergeStatusList(s.status, Array.isArray(v) ? v : [v]);
    else if (key === 'crit') {
      if (v.chance) s.crit.chance += v.chance;
      if (v.mul) s.crit.mul = Math.max(s.crit.mul, v.mul);
    } else if (key === 'aura') {
      if (!s.aura) s.aura = normAura();
      if (v.range != null) s.aura.range = Math.max(s.aura.range, v.range);
      if (v.dmgMul != null) s.aura.dmgMul *= v.dmgMul;
      if (v.rateMul != null) s.aura.rateMul *= v.rateMul;
      if (v.rangeMul != null) s.aura.rangeMul *= v.rangeMul;
      if (v.detection) s.aura.detection = true;
      if (v.costCut != null) s.aura.costCut += v.costCut;
      if (v.cleanse) s.aura.cleanse = true;
    } else if (key === 'income') {
      if (!s.income) s.income = { perWave: 0, interest: 0 };
      s.income.perWave += v.perWave ?? 0;
      s.income.interest += v.interest ?? 0;
    } else if (key === 'trap') {
      if (!s.trap) s.trap = normTrap();
      s.trap.max += v.max ?? 0;
      s.trap.damage += v.damage ?? 0;
      s.trap.splash += v.splash ?? 0;
      if (v.status) mergeStatusList(s.trap.status, v.status);
    } else if (key === 'turret') {
      if (!s.turret) s.turret = normTurret();
      s.turret.max += v.max ?? 0;
      s.turret.damage += v.damage ?? 0;
      s.turret.range += v.range ?? 0;
      if (v.rate != null) s.turret.rate *= v.rate;
      if (v.attackType) s.turret.attackType = v.attackType;
      if (v.status) mergeStatusList(s.turret.status, v.status);
    } else if (key === 'ramp') {
      if (!s.ramp) s.ramp = { per: 0, max: 0 };
      s.ramp.per += v.per ?? 0;
      s.ramp.max += v.max ?? 0;
    } else if (key === 'mark') {
      if (!s.mark) s.mark = { bonus: 0, duration: 0 };
      s.mark.bonus = Math.max(s.mark.bonus, v.bonus ?? 0);
      s.mark.duration = Math.max(s.mark.duration, v.duration ?? 0);
    }
    // Unknown keys are ignored on purpose (only the contract keys are understood).
  }
  return s;
}

/**
 * ModSets that apply to a tower: upgrade tiers (tier 1 of every path, then tier 2, ... so
 * high-tier transformations win), hero milestones up to `level`, then the awaken passive.
 * @param {object} def UnitDef
 * @param {number[]} tiers [a, b, c]
 * @param {number} heroLevel 0 for towers
 * @param {boolean} awakenPassive
 */
export function collectModSets(def, tiers = [0, 0, 0], heroLevel = 0, awakenPassive = false) {
  const sets = [];
  for (let t = 1; t <= 5; t++) {
    for (let p = 0; p < 3; p++) {
      if ((tiers[p] || 0) >= t) {
        const tier = def.paths?.[p]?.tiers?.[t - 1];
        if (tier?.mods) sets.push(tier.mods);
      }
    }
  }
  if (heroLevel > 0 && def.hero?.levels) {
    const lv = [...def.hero.levels].sort((a, b) => a.level - b.level);
    for (const m of lv) if (m.level <= heroLevel && m.mods) sets.push(m.mods);
  }
  if (awakenPassive && def.awakenPassive?.mods) sets.push(def.awakenPassive.mods);
  return sets;
}

/**
 * Applies profile battle stats (unitBattleStats) on top of resolved stats.
 * critMul multiplies the crit damage multiplier; critChance/armorPen add.
 */
export function applyUnitStats(s, us = DEFAULT_UNIT_STATS) {
  const u = { ...DEFAULT_UNIT_STATS, ...(us || {}) };
  s.damage *= u.damageMul;
  s.rate *= u.rateMul;
  s.range *= u.rangeMul;
  s.crit.chance = Math.min(1, s.crit.chance + (u.critChance || 0));
  s.crit.mul *= u.critMul || 1;
  s.armorPen += u.armorPen || 0;
  if (s.trap) s.trap.damage *= u.damageMul;
  if (s.turret) {
    s.turret.damage *= u.damageMul;
    s.turret.rate *= u.rateMul;
    s.turret.range *= u.rangeMul;
  }
  return s;
}

/**
 * Full stat resolution for a tower/hero.
 * @param {object} def UnitDef
 * @param {{ tiers?: number[], heroLevel?: number, unitStats?: object }} opts
 */
export function resolveStats(def, { tiers = [0, 0, 0], heroLevel = 0, unitStats = null } = {}) {
  const s = normalizeBase(def.base, def);
  const acc = { damageAdd: 0, damageMul: 1 };
  const us = { ...DEFAULT_UNIT_STATS, ...(unitStats || {}) };
  for (const m of collectModSets(def, tiers, heroLevel, !!us.awakenPassive)) applyModSet(s, m, acc);
  s.damage = (s.damage + acc.damageAdd) * acc.damageMul;
  applyUnitStats(s, us);
  s.projectiles = Math.max(1, Math.round(s.projectiles));
  s.pierce = Math.max(1, Math.round(s.pierce));
  s.chain = Math.max(0, Math.round(s.chain));
  s.maxTargets = Math.max(1, Math.round(s.maxTargets));
  if (s.trap) s.trap.max = Math.max(0, Math.round(s.trap.max));
  if (s.turret) s.turret.max = Math.max(0, Math.round(s.turret.max));
  return s;
}

/**
 * BTD6 crosspath rule: at most two paths may have tiers > 0 and only one path may go
 * above tier 2; tier N requires tier N-1 (implicit: tiers only ever increase by one).
 * @returns {null|'max'|'crosspath'} reason the next tier of `path` is unavailable
 */
export function crosspathBlock(tiers, path, maxTier = 5) {
  const cur = tiers[path] || 0;
  if (cur >= maxTier) return 'max';
  const next = cur + 1;
  const others = [0, 1, 2].filter((p) => p !== path);
  if (cur === 0 && others.filter((p) => (tiers[p] || 0) > 0).length >= 2) return 'crosspath';
  if (next > 2 && others.some((p) => (tiers[p] || 0) > 2)) return 'crosspath';
  return null;
}
