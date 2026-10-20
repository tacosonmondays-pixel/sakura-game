// Tower stat resolution: BaseStats + ModSets (upgrade tiers, hero milestones, awaken
// passive, Potential steps) + profile battle stats. Implements the ModSet table in CONTRACTS.md §3 exactly:
// add keys are summed, mul keys multiplied, grants OR-ed, replace keys take the last
// value, status lists merge by type keeping the stronger numbers.
// Potential v3 keys (src/data/potential.js; mechanics in src/sim/potential.js) are understood here
// too and appear on the stats ONLY when a step sets them, so a girl at P1 resolves exactly as before:
// statusAdd (adds onto a status she has), proc (her rhythm), ult (a hero's ultimate), aura.rangeAdd /
// aura.foeVuln, turret.overclock, brew / link targetsAdd, bountyAura, harvest, dotSpread, keepRamp,
// projScale, tempo, classMul.

import { DEFAULT_UNIT_STATS } from './constants.js';
import { HERO_GROWTH } from '../data/heroTracks.js';
import { potentialFold } from '../data/potential.js';
import { BREW_TARGETS_MAX } from './constants.js';

const ADD_KEYS = ['range', 'projectiles', 'pierce', 'chain', 'maxTargets', 'splash', 'armorPen', 'projectileSpeed', 'silence', 'reveal', 'knockback', 'gather'];
const MUL_KEYS = ['rateMul', 'eliteMul', 'bossMul', 'barrierMul', 'airMul'];
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
    armorPen: a.armorPen ?? 0,
    critChance: a.critChance ?? 0,
  };
}

/** A limited buff (Midori's brew, Chika's tune-up link): `targets` girls, ×dmgMul ×rateMul, +armorPen +critChance. */
function normLimited(b = {}) {
  return {
    targets: b.targets ?? 0,
    dmgMul: b.dmgMul ?? 1,
    rateMul: b.rateMul ?? 1,
    armorPen: b.armorPen ?? 0,
    critChance: b.critChance ?? 0,
    overclock: b.overclock ? { every: b.overclock.every ?? 20, time: b.overclock.time ?? 6, rateMul: b.overclock.rateMul ?? 1 } : null,
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
    // roaming drones: roam radius (0 = anchored), flight speed (tiles/s), seconds per drone (0 = 1 / base rate)
    leash: t.leash ?? 0,
    speed: t.speed ?? 3,
    build: t.build ?? 0,
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
    brew: b.brew ? normLimited(b.brew) : null,
    link: b.link ? normLimited(b.link) : null,
    hpPct: b.hpPct ? { pct: b.hpPct.pct ?? 0, boss: b.hpPct.boss ?? 0, cap: b.hpPct.cap ?? 0 } : null,
    silence: b.silence ?? 0,
    reveal: b.reveal ?? 0,
    knockback: b.knockback ?? 0,
    // roster merge (ROSTER_SPEC §6.2): flyer damage multiplier, gather pull, relay origin
    airMul: b.airMul ?? 1,
    gather: b.gather ?? 0,
    relay: b.relay ? { kind: b.relay.kind, reach: b.relay.reach ?? 3 } : null,
  };
}

/** Numeric StatusSpec fields statusAdd adds (N2). */
const ADD_FIELDS = ['amount', 'dps', 'pct', 'bonus', 'duration'];

function addStatusFields(cur, spec) {
  for (const k of ADD_FIELDS) if (typeof spec[k] === 'number') cur[k] = (typeof cur[k] === 'number' ? cur[k] : 0) + spec[k];
  // a missing chance means "always" and stays so; a chance adds, capped at 1
  if (typeof spec.chance === 'number' && typeof cur.chance === 'number') cur.chance = Math.min(1, cur.chance + spec.chance);
}

/**
 * N2 statusAdd: wherever she already has the status type (her own list, her traps', her drones'),
 * ADD its numbers; if she has it nowhere, append a copy to her own list (traps and drones copy it).
 * `mark` adds to her mark (creating it). Never the keep-stronger merge, which would hide a weaker step.
 */
export function addStatuses(s, specs) {
  for (const spec of specs || []) {
    if (!spec || !spec.type) continue;
    if (spec.type === 'mark') {
      if (!s.mark) s.mark = { bonus: 0, duration: 0 };
      s.mark.bonus += spec.bonus || 0;
      s.mark.duration += spec.duration || 0;
      continue;
    }
    let found = false;
    for (const list of [s.status, s.trap?.status, s.turret?.status]) {
      const cur = list?.find((x) => x.type === spec.type);
      if (cur) {
        addStatusFields(cur, spec);
        found = true;
      }
    }
    if (!found) s.status.push({ ...spec });
  }
}

/** N3: two rhythm ModSets merge in step order: later fields replace, status lists merge by type. */
function mergeProc(cur, v) {
  const out = cur ? { ...cur, status: cur.status.map((x) => ({ ...x })) } : { name: null, every: 0, of: 'attack', status: [] };
  for (const k of Object.keys(v)) {
    if (k === 'status') mergeStatusList(out.status, v.status);
    else if (v[k] && typeof v[k] === 'object') out[k] = { ...v[k] };
    else out[k] = v[k];
  }
  return out;
}

/** N4: a hero's ultimate (src/sim/hero.js ultEffect): numbers add, damageMul multiplies, lists append. */
function mergeUlt(cur, v) {
  const u = cur || { haste: 0, radius: 0, duration: 0, buffDuration: 0, rateBuff: 0, damageMul: 1, status: [], statusAdd: [] };
  for (const k of ['haste', 'radius', 'duration', 'buffDuration', 'rateBuff']) if (typeof v[k] === 'number') u[k] += v[k];
  if (typeof v.damageMul === 'number') u.damageMul *= v.damageMul;
  for (const x of v.status || []) u.status.push({ ...x });
  for (const x of v.statusAdd || []) u.statusAdd.push({ ...x });
  return u;
}

/** Potential v3 keys (absent at P1: nothing here runs for a girl without the step). */
const POTENTIAL_KEYS = {
  statusAdd: (s, v) => addStatuses(s, Array.isArray(v) ? v : [v]),
  proc: (s, v) => { s.proc = mergeProc(s.proc, v); },
  ult: (s, v) => { s.ult = mergeUlt(s.ult, v); },
  bountyAura: (s, v) => { s.bountyAura = Math.max(s.bountyAura || 1, v); },
  harvest: (s, v) => { s.harvest = { share: 1, ...(s.harvest || {}), ...v }; },
  dotSpread: (s, v) => { s.dotSpread = { ...v }; },
  keepRamp: (s, v) => { s.keepRamp = Math.max(s.keepRamp || 0, v); },
  projScale: (s, v) => { s.projScale = (s.projScale || 0) + v; },
  tempo: (s, v) => { s.tempo = { ...(s.tempo || {}), ...v }; },
  classMul: (s, v) => {
    const m = { ...(s.classMul || {}) };
    for (const [k, x] of Object.entries(v)) m[k] = (m[k] ?? 1) * x;
    s.classMul = m;
  },
};

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
      if (v.armorPen != null) s.aura.armorPen += v.armorPen;
      if (v.critChance != null) s.aura.critChance += v.critChance;
      // Potential: reach added after every max rule (resolveStats), enemy Brittle inside her aura (N5, N6)
      if (v.rangeAdd != null && acc) acc.auraRangeAdd = (acc.auraRangeAdd || 0) + v.rangeAdd;
      if (v.foeVuln != null) s.aura.foeVuln = (s.aura.foeVuln || 0) + v.foeVuln;
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
      s.turret.leash += v.leash ?? 0;
      s.turret.speed += v.speed ?? 0;
      if (v.rate != null) s.turret.rate *= v.rate;
      if (v.attackType) s.turret.attackType = v.attackType;
      if (v.status) mergeStatusList(s.turret.status, v.status);
      // Potential (N11): her drones' own overclock timer; a later step's fields replace earlier ones
      if (v.overclock) s.turret.overclock = { ...(s.turret.overclock || {}), ...v.overclock };
    } else if (key === 'ramp') {
      if (!s.ramp) s.ramp = { per: 0, max: 0 };
      s.ramp.per += v.per ?? 0;
      s.ramp.max += v.max ?? 0;
    } else if (key === 'mark') {
      if (!s.mark) s.mark = { bonus: 0, duration: 0 };
      s.mark.bonus = Math.max(s.mark.bonus, v.bonus ?? 0);
      s.mark.duration = Math.max(s.mark.duration, v.duration ?? 0);
    } else if (key === 'brew' || key === 'link') {
      // Potential (N12): one more girl, added after the max rule (resolveStats); never creates a brew / link
      if (v.targetsAdd != null && acc) acc[`${key}Add`] = (acc[`${key}Add`] || 0) + v.targetsAdd;
      if (!Object.keys(v).some((k) => k !== 'targetsAdd')) continue;
      // limited buffs (src/sim/buffs.js): targets = max, multipliers multiply, pen and crit add, overclock replaces
      if (!s[key]) s[key] = normLimited();
      const l = s[key];
      l.targets = Math.max(l.targets, v.targets ?? 0);
      if (v.dmgMul != null) l.dmgMul *= v.dmgMul;
      if (v.rateMul != null) l.rateMul *= v.rateMul;
      if (v.armorPen != null) l.armorPen += v.armorPen;
      if (v.critChance != null) l.critChance += v.critChance;
      if (v.overclock) l.overclock = { every: v.overclock.every ?? 20, time: v.overclock.time ?? 6, rateMul: v.overclock.rateMul ?? 1 };
    } else if (key === 'hpPct') {
      // execution shot (src/sim/combat.js): + pct of the target's current HP (boss on minibosses / bosses),
      // at most cap × the hit; the strongest numbers win
      if (!s.hpPct) s.hpPct = { pct: 0, boss: 0, cap: 0 };
      s.hpPct.pct = Math.max(s.hpPct.pct, v.pct ?? 0);
      s.hpPct.boss = Math.max(s.hpPct.boss, v.boss ?? 0);
      s.hpPct.cap = Math.max(s.hpPct.cap, v.cap ?? 0);
    } else if (key === 'relay') {
      // only a girl who already has a familiar / mirror can extend its reach
      if (s.relay) s.relay.reach += v.reach ?? 0;
    } else if (Object.hasOwn(POTENTIAL_KEYS, key)) POTENTIAL_KEYS[key](s, v);
    // Unknown keys are ignored on purpose (only the contract keys are understood).
  }
  return s;
}

/**
 * ModSets that apply to a tower: upgrade tiers (tier 1 of every path, then tier 2, ... so
 * high-tier transformations win), hero track levels up to `level` plus her growth (HERO_GROWTH
 * per level above 1, plus Mastery past Lv 25), then the awaken passive.
 * @param {object} def UnitDef
 * @param {number[]} tiers [a, b, c]
 * @param {number} heroLevel 0 for towers
 * @param {boolean} awakenPassive
 * @param {number} heroMastery Mastery damage bonus (0 below Lv 25)
 */
export function collectModSets(def, tiers = [0, 0, 0], heroLevel = 0, awakenPassive = false, heroMastery = 0) {
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
    const g = def.hero.growth ?? HERO_GROWTH;
    if (heroLevel > 1 || heroMastery > 0) {
      const steps = Math.max(0, heroLevel - 1);
      sets.push({ damageMul: 1 + (g.damage || 0) * steps + (heroMastery || 0), rateMul: 1 + (g.rate || 0) * steps });
    }
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
    s.turret.leash *= u.rangeMul;
    if (s.turret.build > 0) s.turret.build /= u.rateMul;
  }
  return s;
}

/**
 * After her unit stats: Potential's whole-girl DoT multiplier on every burn / poison she applies (N1),
 * her aura's added reach after every max rule (N5), and one more brewed / linked girl (N12; brews
 * never above BREW_TARGETS_MAX, and nothing where she has no brew / link).
 */
function potentialTail(s, pot, acc) {
  if (pot.dotMul !== 1) {
    for (const list of [s.status, s.trap?.status, s.turret?.status]) {
      for (const st of list || []) {
        if (st.type !== 'burn' && st.type !== 'poison') continue;
        if (typeof st.dps === 'number') st.dps *= pot.dotMul;
        if (typeof st.pct === 'number') st.pct *= pot.dotMul;
      }
    }
  }
  if (acc.auraRangeAdd && s.aura) s.aura.range += acc.auraRangeAdd;
  if (acc.brewAdd && s.brew) s.brew.targets = Math.min(BREW_TARGETS_MAX, s.brew.targets + acc.brewAdd);
  if (acc.linkAdd && s.link) s.link.targets += acc.linkAdd;
}

/**
 * Full stat resolution for a tower/hero.
 * @param {object} def UnitDef
 * @param {{ tiers?: number[], heroLevel?: number, unitStats?: object }} opts unitStats.potential
 *   (1…6) adds her Potential steps
 */
export function resolveStats(def, { tiers = [0, 0, 0], heroLevel = 0, unitStats = null, heroMastery = 0 } = {}) {
  const s = normalizeBase(def.base, def);
  const acc = { damageAdd: 0, damageMul: 1 };
  const us = { ...DEFAULT_UNIT_STATS, ...(unitStats || {}) };
  for (const m of collectModSets(def, tiers, heroLevel, !!us.awakenPassive, heroMastery)) applyModSet(s, m, acc);
  // Potential (src/data/potential.js): its ModSets after the awaken passive (and after a hero's
  // track levels, growth and Mastery), its whole-girl multipliers folded into the unit stats like
  // level and gear. P1 changes nothing.
  const pot = potentialFold(def, us.potential);
  for (const m of pot.sets) applyModSet(s, m, acc);
  s.damage = (s.damage + acc.damageAdd) * acc.damageMul;
  applyUnitStats(s, pot.level > 1 ? { ...us, damageMul: us.damageMul * pot.damageMul, rateMul: us.rateMul * pot.rateMul, rangeMul: us.rangeMul * pot.rangeMul } : us);
  if (s.income && pot.incomeMul !== 1) s.income.perWave *= pot.incomeMul;
  if (pot.level > 1) potentialTail(s, pot, acc);
  s.projectiles = Math.max(1, Math.round(s.projectiles));
  s.pierce = Math.max(1, Math.round(s.pierce));
  s.chain = Math.max(0, Math.round(s.chain));
  s.maxTargets = Math.max(1, Math.round(s.maxTargets));
  if (s.trap) s.trap.max = Math.max(0, Math.round(s.trap.max));
  if (s.turret) s.turret.max = Math.max(0, Math.round(s.turret.max));
  return s;
}

/**
 * Crosspath rule: at most two paths may have tiers > 0 and only one path may go
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
