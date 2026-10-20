// Ability data (src/data/abilities.js numbers, src/data/abilityText.js words; ABILITIES_SPEC §5.1, §6,
// §13): one ⚡ path per tower that unlocks at tier 3 and upgrades at tier 5, one Lv 7 skill per hero
// that ranks up at Lv 17, the shared vocabulary, cooldowns and durations in whole ticks, a text row
// for every ability whose templates fill completely, names that clash with nothing, our own words
// only, a ⚡ tip per girl, and the attach hook. A0 ships data only: nothing in src/sim reads it yet.
import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  ABILITY_RULES, ABILITY_KINDS, ABILITY_SCOPES, AUTO_WHEN, ABILITIES,
  abilityRow, attachAbilities, mergeAbility, abilityAtTier, skillAtLevel,
} from '../../src/data/abilities.js';
import {
  ABILITY_TEXT, ABILITY_COPY, abilityText, abilityValues, fillAbilityText, abilityUnlockLine, abilityUpgradeLine,
} from '../../src/data/abilityText.js';
import { UNITS, UNIT_MAP, towers, heroes } from '../../src/data/units.js';
import { POTENTIAL_GIRLS } from '../../src/data/potential.js';
import { ENEMIES } from '../../src/data/enemies.js';
import { STAGES } from '../../src/data/stages.js';
import { BATTLE_MODES } from '../../src/data/modes.js';
import { STATUSES } from '../../src/data/types.js';
import { GLYPHS } from '../../src/art/icons/glyphs.js';
import { resolveStats } from '../../src/sim/mods.js';

const ROOT = join(import.meta.dirname, '../..');

// ABILITIES_SPEC §5.1: the ⚡ path of each live tower and her tier-3 coins (placement + tiers 1–3)
const LIGHTNING = {
  aoi: ['volley', 1140], rei: ['whirlwind', 1400], yuki: ['deepfreeze', 1250], momo: ['orchard', 1900],
  akane: ['bigbang', 1940], sango: ['frag', 2000], kage: ['steel', 1860], umeko: ['lighthouse', 1750],
  shiro: ['execution', 2290], midori: ['toxicology', 1800], suzu: ['mines', 1800], raika: ['rhythm', 1780],
  miko: ['blessing', 2010], hotaru: ['prayer', 2240], kaede: ['flowing', 2170], chika: ['sentry', 2390],
};
// §5.1 "Mix of kinds across the 16"
const KIND_OF = {
  aoi: 'strike', shiro: 'strike', midori: 'strike', kaede: 'strike',
  yuki: 'burst', akane: 'burst', sango: 'burst',
  kage: 'deploy', suzu: 'deploy', chika: 'deploy',
  rei: 'boost', raika: 'boost',
  umeko: 'debuff', hotaru: 'debuff',
  miko: 'rally',
  momo: 'econ',
};
const HERO_SKILL = { hikari: ['Morning Rally', 'rally'], luna: ['Moonbrand', 'debuff'], nami: ['Frost Net', 'burst'] };
// a girl whose data may put her ability on several paths (the crosspath rule still lets only one unlock)
const MULTI_PATH = {};

// The effect fields each kind may use (a typo in the data fails here, not silently in the sim).
const STATUS_LIST = ['status'];
const EFFECT_KEYS = {
  strike: ['pick', 'count', 'reachMul', 'reach', 'dmgMul', 'hits', 'fullRamp', 'keepRamp', 'delay', 'armorPen', 'poisonMul', 'splash', 'splashShare', 'spreadPoison', ...STATUS_LIST],
  burst: ['at', 'reachMul', 'radius', 'radiusMul', 'shells', 'delay', 'every', 'reaim', 'dmgMul', 'knockback', 'hitsAir', ...STATUS_LIST],
  boost: ['mods'],
  rally: ['radius', 'inAura', 'dmgMul', 'rateMul', 'rangeMul', 'detection', 'cleanse', 'ward'],
  debuff: ['pick', 'count', 'casterStatus', 'rally', ...STATUS_LIST],
  econ: ['coins'],
  deploy: ['deploy', 'count', 'spacing', 'dmgMul', 'arm'],
};
const PICKS = { strike: ['mode', 'strong', 'priority', 'poisoned'], debuff: ['all', 'veiled', 'strong'] };
const AUTO_KEYS = ['when', 'min', 'orElite', 'orCaster', 'orVeiled', 'orLeak', 'reach'];
// the ModSet keys a boost may change (src/sim/mods.js applyModSet; CONTRACTS §3)
const BOOST_MOD_KEYS = ['damage', 'damageMul', 'rateMul', 'range', 'projectiles', 'pierce', 'chain', 'maxTargets', 'splash', 'armorPen', 'status', 'crit'];
// seconds-valued fields: each must be a whole number of ticks
const TIME_KEYS = ['duration', 'delay', 'every', 'arm', 'spreadPoison'];
const TICKS = ABILITY_RULES.ticksPerSecond;

/** Other games' names never appear in our data or text (kept in sync with the content rule). */
const FOREIGN = /\b(bloons?|btd\d*|monkeys?|genshin|zenless|zzz|blue archive|kivotos|schale|arknights|azur lane|honkai|nikke|kancolle|kantai|hoyoverse|ba-style)\b/i;

const pathIndex = (u, id) => u.paths.findIndex((p) => p.id === id);
const tiersAt = (u, pathId, tier) => { const t = [0, 0, 0]; t[pathIndex(u, pathId)] = tier; return t; };
const isWholeTicks = (s) => typeof s === 'number' && s >= 0 && Math.abs(s * TICKS - Math.round(s * TICKS)) < 1e-9;

/** Every [label, merged definition, stats] state of an ability: tier 3 and tier 5 / Lv 7 and each rank. */
function states(u) {
  if (u.kind === 'hero') {
    const s = u.hero.skill;
    return [[`${u.id} Lv ${s.unlockLevel}`, skillAtLevel(s, s.unlockLevel), resolveStats(u, { heroLevel: s.unlockLevel })],
      ...s.ranks.map((r) => [`${u.id} Lv ${r.level}`, skillAtLevel(s, r.level), resolveStats(u, { heroLevel: r.level })])];
  }
  const a = u.paths.find((p) => p.ability).ability;
  return [[`${u.id} T3`, abilityAtTier(a, 3), resolveStats(u, { tiers: tiersAt(u, a.path, 3) })],
    [`${u.id} T5`, abilityAtTier(a, 5), resolveStats(u, { tiers: tiersAt(u, a.path, 5) })]];
}

function statusErrors(list, where) {
  const errs = [];
  if (!Array.isArray(list)) return [`${where} must be an array`];
  for (const s of list) {
    if (!s || !STATUSES[s.type]) { errs.push(`${where}: unknown status ${JSON.stringify(s)}`); continue; }
    if ('chance' in s) errs.push(`${where}: ability statuses are certain (no chance)`);
    if (!(s.duration > 0)) errs.push(`${where}: ${s.type} needs a duration`);
    if (s.type === 'slow' && !(s.amount > 0 && s.amount < 1)) errs.push(`${where}: slow amount in (0, 1)`);
    if ((s.type === 'mark' || s.type === 'vulnerable') && !(s.bonus > 0 && s.bonus < 1)) errs.push(`${where}: ${s.type} bonus in (0, 1)`);
  }
  return errs;
}

/** Problems with one (merged) ability definition. */
function defErrors(d, where) {
  const errs = [];
  if (!ABILITY_KINDS.includes(d.kind)) errs.push(`${where}: kind ${d.kind}`);
  if (!ABILITY_SCOPES.includes(d.scope)) errs.push(`${where}: scope ${d.scope}`);
  const allowed = EFFECT_KEYS[d.kind];
  if (!allowed) return [...errs, `${where}: no effect vocabulary for ${d.kind}`];
  for (const k of Object.keys(d.effect)) if (!allowed.includes(k)) errs.push(`${where}: effect key ${k} is not a ${d.kind} field`);
  const e = d.effect;
  if (PICKS[d.kind] && e.pick != null && !PICKS[d.kind].includes(e.pick)) errs.push(`${where}: pick ${e.pick}`);
  for (const k of ['count', 'shells', 'hits']) if (k in e && !(Number.isInteger(e[k]) && e[k] > 0)) errs.push(`${where}: ${k} must be a whole number > 0`);
  for (const k of ['reachMul', 'radius', 'radiusMul', 'dmgMul', 'poisonMul', 'splash', 'spacing', 'coins']) if (k in e && !(e[k] > 0)) errs.push(`${where}: ${k} must be > 0`);
  if ('reach' in e && e.reach !== 'map') errs.push(`${where}: reach is 'map' or a reachMul`);
  if (e.status) errs.push(...statusErrors(e.status, `${where}.status`));
  if (e.casterStatus) errs.push(...statusErrors(e.casterStatus, `${where}.casterStatus`));
  if (d.kind === 'boost') {
    for (const k of Object.keys(e.mods || {})) if (!BOOST_MOD_KEYS.includes(k)) errs.push(`${where}: boost mod ${k}`);
    if (e.mods?.status) errs.push(...statusErrors(e.mods.status, `${where}.mods.status`));
    if (!(d.duration > 0)) errs.push(`${where}: a boost lasts > 0 s`);
  }
  if (d.kind === 'rally') {
    if (!(e.radius > 0) && e.inAura !== true) errs.push(`${where}: a rally needs a radius`);
    if (!(d.duration > 0)) errs.push(`${where}: a rally lasts > 0 s`);
  }
  if (e.rally) {
    for (const k of Object.keys(e.rally)) if (!EFFECT_KEYS.rally.includes(k)) errs.push(`${where}: rally rider key ${k}`);
    if (!(d.duration > 0)) errs.push(`${where}: a rally rider lasts > 0 s`);
  }
  for (const k of ['dmgMul', 'rateMul', 'rangeMul']) {
    for (const src of [d.kind === 'rally' ? e : null, e.rally].filter(Boolean)) if (k in src && !(src[k] > 1)) errs.push(`${where}: rally ${k} > 1`);
  }
  if (d.kind === 'burst' && !e.at) errs.push(`${where}: a burst needs a point (at)`);
  if (d.kind === 'burst' && !(e.radius > 0) && !(e.radiusMul > 0)) errs.push(`${where}: a burst needs a radius`);
  // a multi-shell burst lasts until its last shell lands
  if ((e.shells ?? 1) > 1) {
    if (!(e.every > 0)) errs.push(`${where}: shells need an interval`);
    if (d.duration < (e.delay ?? 0) + (e.shells - 1) * e.every - 1e-9) errs.push(`${where}: duration ${d.duration}s ends before the last shell`);
  }
  if (d.kind === 'econ' && d.scope !== 'player') errs.push(`${where}: econ abilities are per player`);
  if (d.kind === 'deploy' && !['double', 'trap', 'drone'].includes(e.deploy)) errs.push(`${where}: deploy ${e.deploy}`);
  // time fields in whole ticks; the cooldown in whole charge points
  for (const k of TIME_KEYS) {
    if (k in d && !isWholeTicks(d[k])) errs.push(`${where}: ${k} ${d[k]} is not a whole number of ticks`);
    if (k in e && !isWholeTicks(e[k])) errs.push(`${where}: effect.${k} ${e[k]} is not a whole number of ticks`);
  }
  for (const s of [...(e.status || []), ...(e.casterStatus || []), ...(e.mods?.status || [])]) {
    if (!isWholeTicks(s.duration)) errs.push(`${where}: ${s.type} ${s.duration}s is not a whole number of ticks`);
  }
  const points = d.cooldown * TICKS * ABILITY_RULES.chargePerTick;
  if (!Number.isInteger(points)) errs.push(`${where}: cooldown ${d.cooldown}s is not whole charge points`);
  return errs;
}

function isDeepFrozen(o) {
  if (!o || typeof o !== 'object') return true;
  return Object.isFrozen(o) && Object.values(o).every(isDeepFrozen);
}

describe('ability rules and vocabulary', () => {
  test('rules (spec §3.2, §6.1; Skill Haste at half rate, GEAR_STATS §B.4)', () => {
    expect(ABILITY_RULES).toEqual({
      ticksPerSecond: 60, chargePerTick: 100, initialShare: 3, ccGuardTicks: 240, autoEvery: 6, econCapPerWave: 2,
      densestCap: 60, hasteShare: 0.5, hasteCap: 0.5, unhastedKinds: ['rally', 'debuff'],
    });
    // a 40 s cooldown is 240,000 charge points; the CC guard is 4 s
    expect(40 * ABILITY_RULES.ticksPerSecond * ABILITY_RULES.chargePerTick).toBe(240000);
    expect(ABILITY_RULES.ccGuardTicks / ABILITY_RULES.ticksPerSecond).toBe(4);
    // the fastest Skill Haste rate stays an integer ≤ 133 points per tick
    expect(Math.round(100 / (1 - ABILITY_RULES.hasteShare * ABILITY_RULES.hasteCap))).toBe(133);
    for (const k of ABILITY_RULES.unhastedKinds) expect(ABILITY_KINDS).toContain(k);
  });

  test('kinds, scopes and auto-cast rules', () => {
    expect(ABILITY_KINDS).toEqual(['boost', 'rally', 'strike', 'burst', 'debuff', 'econ', 'deploy', 'move', 'zone', 'runner']);
    expect(ABILITY_SCOPES).toEqual(['local', 'map', 'player']);
    expect(AUTO_WHEN).toEqual(['enemies', 'elite', 'leak', 'veiled', 'caster', 'poisoned', 'ready']);
  });

  test('every table is deep-frozen', () => {
    for (const o of [ABILITY_RULES, ABILITY_KINDS, ABILITY_SCOPES, AUTO_WHEN, ABILITIES, ABILITY_TEXT, ABILITY_COPY]) expect(isDeepFrozen(o)).toBe(true);
  });
});

describe('every tower has one ⚡ path (spec §3.1, §5.1)', () => {
  test('rows exist only for real girls (a kit variant is id@kitStyle)', () => {
    for (const id of Object.keys(ABILITIES)) expect(UNIT_MAP[id.split('@')[0]], id).toBeTruthy();
    for (const u of UNITS) expect(abilityRow(u), u.id).toBe(ABILITIES[u.id]);
    expect(Object.keys(ABILITIES).length).toBe(19);
  });

  test.each(towers().map((u) => [u.id, u]))('%s: exactly one ⚡ path, the one the spec names, unlocking at tier 3', (id, u) => {
    const row = ABILITIES[id];
    expect(Array.isArray(row)).toBe(true);
    const marked = u.paths.filter((p) => p.ability);
    expect(marked.length).toBeGreaterThanOrEqual(1);
    expect(marked.length).toBeLessThanOrEqual(MULTI_PATH[id] || 1);
    expect(row.length).toBe(marked.length);
    const [pathId, coins] = LIGHTNING[id];
    const p = u.paths.find((x) => x.id === pathId);
    expect(p.ability).toBe(row[0]);
    expect(p.ability.path).toBe(pathId);
    expect(p.ability.unlockTier).toBe(3);
    expect(Object.isFrozen(p.ability)).toBe(true);
    expect(u.base.cost + p.tiers.slice(0, 3).reduce((n, t) => n + t.cost, 0)).toBe(coins);
    expect(p.ability.kind).toBe(KIND_OF[id]);
    expect(p.ability.id.startsWith(`${id}.`)).toBe(true);
    // the other paths carry no ability
    for (const q of u.paths) if (q !== p) expect(q.ability, `${id}.${q.id}`).toBeUndefined();
    expect(u.hero).toBeUndefined();
  });

  test('the kind mix matches the spec: strike 4, burst 3, deploy 3, boost 2, debuff 2, rally 1, econ 1', () => {
    const count = {};
    for (const u of towers()) { const k = u.paths.find((p) => p.ability).ability.kind; count[k] = (count[k] || 0) + 1; }
    expect(count).toEqual({ strike: 4, burst: 3, deploy: 3, boost: 2, debuff: 2, rally: 1, econ: 1 });
  });

  test('Momo has exactly one ability, Market Day (spec §16 Q6 default)', () => {
    expect(ABILITIES.momo).toHaveLength(1);
    expect(ABILITIES.momo[0].kind).toBe('econ');
    expect(abilityText(ABILITIES.momo[0].id).name).toBe('Market Day');
  });

  test('kit variants (Fantasy ⇄ School toggle) keep one ⚡ path too', () => {
    for (const [key, row] of Object.entries(ABILITIES)) {
      if (!key.includes('@')) continue;
      const base = UNIT_MAP[key.split('@')[0]];
      if (base.kind === 'tower') expect(row.length, key).toBeLessThanOrEqual(MULTI_PATH[base.id] || 1);
    }
    for (const u of UNITS.filter((x) => x.kitStyle && x.kind === 'tower')) expect(u.paths.filter((p) => p.ability).length, u.id).toBe(1);
  });
});

describe('every hero has a Lv 7 skill (spec §5.1 heroes)', () => {
  test.each(heroes().map((u) => [u.id, u]))('%s: skill at Lv 7, ranks in (7, 25]', (id, u) => {
    const s = u.hero.skill;
    expect(s).toBe(ABILITIES[id].skill);
    expect(Object.keys(ABILITIES[id])).toEqual(['skill']);
    expect(Object.isFrozen(s)).toBe(true);
    expect(s.unlockLevel).toBe(7);
    expect(s.kind).toBe(HERO_SKILL[id][1]);
    expect(abilityText(s.id).name).toBe(HERO_SKILL[id][0]);
    expect(s.id.startsWith(`${id}.`)).toBe(true);
    expect(s.ranks.length).toBeGreaterThan(0);
    let last = s.unlockLevel;
    for (const r of s.ranks) {
      expect(r.level > last && r.level <= 25, `${id} rank Lv ${r.level}`).toBe(true);
      last = r.level;
    }
    expect(s.ranks.map((r) => r.level)).toEqual([17]);
    // heroes have no paths: nothing on a path, and the ult is untouched
    expect(u.paths).toEqual([]);
    expect(u.hero.ult.unlockLevel).toBe(3);
  });
});

describe('numbers', () => {
  const all = UNITS.map((u) => [u.id, u]);

  test.each(all)('%s: valid vocabulary, effect fields, statuses and auto-cast rule at every state', (id, u) => {
    for (const [where, d] of states(u)) expect(defErrors(d, where)).toEqual([]);
    const base = u.kind === 'hero' ? u.hero.skill : u.paths.find((p) => p.ability).ability;
    expect(Object.keys(base.auto).every((k) => AUTO_KEYS.includes(k)), `${id} auto keys`).toBe(true);
    expect(AUTO_WHEN).toContain(base.auto.when);
    if (['enemies', 'poisoned'].includes(base.auto.when)) expect(Number.isInteger(base.auto.min) && base.auto.min > 0).toBe(true);
    if ('orLeak' in base.auto) expect(base.auto.orLeak > 0 && base.auto.orLeak < 1).toBe(true);
    // an upgrade changes only what the base defines (and never the kind, scope or id)
    const over = u.kind === 'hero' ? base.ranks : [base.t5];
    for (const o of over) {
      expect(o, `${id} upgrade`).toBeTruthy();
      for (const k of Object.keys(o)) expect(['level', 'cooldown', 'duration', 'effect'], `${id} upgrade key ${k}`).toContain(k);
    }
  });

  test.each(all)('%s: cooldowns in the window, upgrades never slower', (id, u) => {
    const [lo, hi] = u.kind === 'hero' ? [20, 45] : [20, 60];
    const st = states(u);
    for (const [where, d] of st) {
      expect(d.cooldown, where).toBeGreaterThanOrEqual(lo);
      expect(d.cooldown, where).toBeLessThanOrEqual(hi);
    }
    for (let i = 1; i < st.length; i++) expect(st[i][1].cooldown, st[i][0]).toBeLessThanOrEqual(st[i - 1][1].cooldown);
  });

  test('the spec numbers (§5.1), spot checks', () => {
    const a = (id) => ABILITIES[id][0];
    expect(a('aoi')).toMatchObject({ cooldown: 35, duration: 0, effect: { pick: 'mode', count: 6, reachMul: 1.5, dmgMul: 6, status: [{ type: 'stun', duration: 0.5 }] }, auto: { when: 'enemies', min: 4, orElite: true } });
    expect(abilityAtTier(a('aoi'), 5)).toMatchObject({ cooldown: 28, effect: { count: 12, dmgMul: 8, reachMul: 1.5 } });
    expect(a('rei')).toMatchObject({ cooldown: 30, duration: 4, effect: { mods: { rateMul: 2.5, range: 0.6, maxTargets: 99 } } });
    expect(a('momo')).toMatchObject({ scope: 'player', cooldown: 45, effect: { coins: 100 }, auto: { when: 'ready' } });
    expect(abilityAtTier(a('momo'), 5)).toMatchObject({ cooldown: 40, effect: { coins: 400 } });
    expect(a('shiro')).toMatchObject({ scope: 'map', cooldown: 45, effect: { pick: 'priority', count: 2, reach: 'map', delay: 1, dmgMul: 5, armorPen: 99 } });
    expect(a('hotaru')).toMatchObject({ scope: 'map', cooldown: 45, duration: 3 });
    expect(a('umeko')).toMatchObject({ scope: 'map', cooldown: 40, duration: 8 });
    expect(a('miko')).toMatchObject({ cooldown: 45, duration: 8, effect: { radius: 4, dmgMul: 1.25, rateMul: 1.15 } });
    expect(abilityAtTier(a('akane'), 5).effect).toMatchObject({ shells: 12, dmgMul: 4, hitsAir: true, every: 0.25 });
    expect(skillAtLevel(ABILITIES.hikari.skill, 17)).toMatchObject({ cooldown: 30, duration: 8, effect: { radius: 4, rateMul: 1.3, cleanse: true, ward: true } });
    expect(skillAtLevel(ABILITIES.luna.skill, 7).effect).toMatchObject({ pick: 'strong', count: 5, status: [{ type: 'mark', bonus: 0.2, duration: 8 }] });
    expect(skillAtLevel(ABILITIES.nami.skill, 17)).toMatchObject({ cooldown: 21, effect: { radius: 2, status: [{ type: 'freeze', duration: 1.6 }, { type: 'soak', duration: 5 }] } });
    // map-scope abilities: Umeko, Shiro, Hotaru (one cooldown per player) and Luna's skill
    const map = UNITS.flatMap((u) => (u.kind === 'hero' ? [u.hero.skill] : u.paths.filter((p) => p.ability).map((p) => p.ability))).filter((d) => d.scope === 'map').map((d) => d.id.split('.')[0]);
    expect(map.sort()).toEqual(['hotaru', 'luna', 'shiro', 'umeko']);
  });

  test('ability hits scale with her hit at the ⚡ tier-3 build (spec §5.1 examples)', () => {
    const at3 = (id) => { const u = UNIT_MAP[id]; const [, d, s] = states(u)[0]; return abilityValues(d, s); };
    expect(at3('aoi').dmg).toBe(24); // 6 × 4 at 0-3-0
    expect(at3('shiro').dmg).toBe(295); // 5 × 59 at 3-0-0
    expect(at3('aoi').reach).toBe(5.4); // 1.5 × 3.6 tiles
  });

  test('ids are unique and say whose they are', () => {
    const ids = UNITS.map((u) => (u.kind === 'hero' ? u.hero.skill.id : u.paths.find((p) => p.ability).ability.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z]+\.[a-zA-Z]+$/);
  });
});

describe('merging upgrades (tier 5, ranks)', () => {
  test('mergeAbility spreads scalars and the effect, nothing else', () => {
    const base = { id: 'x.y', cooldown: 40, duration: 2, effect: { count: 6, dmgMul: 3 } };
    expect(mergeAbility(base, null)).toBe(base);
    expect(mergeAbility(base, { cooldown: 30, effect: { count: 12 } })).toEqual({ id: 'x.y', cooldown: 30, duration: 2, effect: { count: 12, dmgMul: 3 } });
    expect(mergeAbility(base, { level: 17, duration: 4 })).toEqual({ id: 'x.y', cooldown: 40, duration: 4, effect: { count: 6, dmgMul: 3 } });
    expect(base.effect).toEqual({ count: 6, dmgMul: 3 });
  });

  test('tier 3–4 is the base, tier 5 the upgrade; ranks apply from their level', () => {
    const a = ABILITIES.aoi[0];
    expect(abilityAtTier(a, 3)).toBe(a);
    expect(abilityAtTier(a, 4)).toBe(a);
    expect(abilityAtTier(a, 5).cooldown).toBe(28);
    const s = ABILITIES.luna.skill;
    expect(skillAtLevel(s, 7)).toBe(s);
    expect(skillAtLevel(s, 16)).toBe(s);
    expect(skillAtLevel(s, 17).effect.count).toBe(8);
    expect(skillAtLevel(s, 25).cooldown).toBe(25);
  });
});

describe('text (src/data/abilityText.js, UI only)', () => {
  test('a text row for every ability and none for an ability that does not exist', () => {
    const ids = UNITS.map((u) => (u.kind === 'hero' ? u.hero.skill.id : u.paths.find((p) => p.ability).ability.id));
    expect(Object.keys(ABILITY_TEXT).sort()).toEqual([...ids].sort());
    for (const id of ids) {
      const t = abilityText(id);
      expect(Object.keys(t).sort(), id).toEqual(['desc', 'icon', 'name', 'short', 'up']);
      expect(t.name.length).toBeGreaterThan(3);
      expect(t.short.length).toBeGreaterThan(10);
      expect(/[{}]/.test(t.short), `${id} short is plain text`).toBe(false);
      expect(GLYPHS[t.icon], `${id} icon ${t.icon}`).toBeTruthy();
    }
    expect(abilityText('nobody.nothing')).toBeNull();
  });

  test.each(UNITS.map((u) => [u.id, u]))('%s: every template fills completely at every state', (id, u) => {
    const [first, ...ups] = states(u);
    const t = abilityText(first[1].id);
    const check = (template, [where, d, s]) => {
      const out = fillAbilityText(template, abilityValues(d, s));
      expect(out, `${where}: ${out}`).not.toMatch(/[{}]|NaN|undefined|Infinity/);
      expect(out.length).toBeGreaterThan(20);
      return out;
    };
    check(t.desc, first);
    for (const st of ups) {
      check(t.desc, st);
      check(t.up, st);
    }
  });

  test('Aoi at 0-3-0 reads like the spec example (24 damage, 5.4 tiles)', () => {
    const [, d, s] = states(UNIT_MAP.aoi)[0];
    expect(fillAbilityText(abilityText(d.id).desc, abilityValues(d, s))).toBe(
      'Rains arrows on up to 6 enemies within 5.4 tiles, picked by her target mode: 24 damage each and a 0.5s pin.',
    );
  });

  test('the ⚡ tier-3 / Lv 7 line and the tier-5 / Lv 17 line', () => {
    expect(abilityUnlockLine('aoi.skyfall')).toBe('Unlocks ⚡ Skyfall Volley: an arrow rain that pins the front of a wave.');
    const [, d5, s5] = states(UNIT_MAP.aoi)[1];
    expect(abilityUpgradeLine('aoi.skyfall', abilityValues(d5, s5))).toBe('⚡+ Skyfall Volley grows to 12 arrows at 8× her hit and recharges in 28s.');
    const [, h17, hs17] = states(UNIT_MAP.hikari)[1];
    expect(abilityUpgradeLine('hikari.rally', abilityValues(h17, hs17))).toBe('⚡+ Morning Rally reaches 4 tiles with +30% speed for 8s and recharges in 30s.');
    expect(abilityUnlockLine('nobody.nothing')).toBe('');
  });

  test('values: a key never comes from two places', () => {
    expect(() => abilityValues({ id: 'x.y', cooldown: 30, duration: 0, effect: { dmgMul: 2, rally: { dmgMul: 1.1 } } })).toThrow(/dmgMul/);
  });

  test('the auto-cast copy (spec §8.6)', () => {
    expect(ABILITY_COPY.autoSetting).toBe('Auto-cast abilities');
    expect(ABILITY_COPY.autoHelp).toMatch(/hold/i);
  });
});

describe('names', () => {
  test('ability names are unique and clash with no other name in the game', () => {
    const names = Object.values(ABILITY_TEXT).map((t) => t.name);
    expect(names.length).toBe(19);
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(names.length);
    const taken = new Set();
    const add = (n) => { if (typeof n === 'string' && n) taken.add(n.toLowerCase()); };
    for (const u of UNITS) {
      add(u.name);
      add(u.title);
      add(u.awakenPassive?.name);
      for (const p of u.paths) {
        add(p.name);
        for (const t of p.tiers) add(t.name);
      }
      if (u.hero) {
        add(u.hero.ult.name);
        for (const l of u.hero.levels) add(/^([^:]+):/.exec(l.desc || '')?.[1]);
      }
    }
    for (const row of Object.values(POTENTIAL_GIRLS)) for (const s of Object.values(row)) add(s.name);
    for (const e of ENEMIES) add(e.name);
    for (const s of STAGES) add(s.name);
    for (const m of Object.values(BATTLE_MODES)) add(m.name);
    for (const n of names) expect(taken.has(n.toLowerCase()), `${n} is taken`).toBe(false);
  });

  test('our own words only: abilities.js, abilityText.js and every tip', () => {
    for (const f of ['src/data/abilities.js', 'src/data/abilityText.js']) {
      const src = readFileSync(join(ROOT, f), 'utf8');
      const hit = src.split('\n').find((l) => FOREIGN.test(l));
      expect(hit, `${f}: ${hit}`).toBeUndefined();
    }
    for (const u of UNITS) for (const tip of u.tips) expect(FOREIGN.test(tip), `${u.id}: ${tip}`).toBe(false);
    expect(FOREIGN.test('Monkey')).toBe(true); // the list itself works
  });
});

describe('tips (spec §10)', () => {
  test.each(towers().map((u) => [u.id, u]))('%s: one ⚡ tip naming her ⚡ path and her ability; still 2–4 tips', (id, u) => {
    const p = u.paths.find((x) => x.ability);
    const name = abilityText(p.ability.id).name;
    const bolt = u.tips.filter((t) => t.startsWith('⚡'));
    expect(bolt.length).toBe(1);
    expect(bolt[0]).toContain(`${p.name} tier 3`);
    expect(bolt[0]).toContain(name);
    expect(u.tips.length).toBeGreaterThanOrEqual(2);
    expect(u.tips.length).toBeLessThanOrEqual(4);
  });

  test('heroes keep their tips (their Lv 7 line comes from the text file)', () => {
    for (const u of heroes()) expect(u.tips.some((t) => t.startsWith('⚡')), u.id).toBe(false);
  });
});

describe('attachAbilities', () => {
  const fixture = () => [
    { id: 'aoi', kind: 'tower', paths: [{ id: 'piercing' }, { id: 'volley' }, { id: 'hunter' }] },
    { id: 'hikari', kind: 'hero', paths: [], hero: { ult: {} } },
  ];

  test('puts the frozen row on the matching path and the skill on the hero', () => {
    const units = fixture();
    attachAbilities(units, { aoi: ABILITIES.aoi, hikari: ABILITIES.hikari });
    expect(units[0].paths[1].ability).toBe(ABILITIES.aoi[0]);
    expect(units[0].paths[0].ability).toBeUndefined();
    expect(units[1].hero.skill).toBe(ABILITIES.hikari.skill);
  });

  test('throws on a path id the girl does not have (catches roster renames)', () => {
    const units = fixture();
    units[0].paths[1].id = 'renamed';
    expect(() => attachAbilities(units, { aoi: ABILITIES.aoi })).toThrow(/aoi.*volley/);
  });

  test('throws on a row for a girl who does not exist, or of the wrong shape', () => {
    expect(() => attachAbilities(fixture(), { nobody: ABILITIES.aoi })).toThrow(/nobody/);
    expect(() => attachAbilities(fixture(), { hikari: ABILITIES.aoi })).toThrow(/hikari/);
    expect(() => attachAbilities(fixture(), { aoi: ABILITIES.hikari })).toThrow(/aoi/);
  });

  test('a kit variant takes its own row first (id@kitStyle), else the girl\'s', () => {
    const variant = { id: 'aoi', kitStyle: 'fantasy', kind: 'tower', paths: [{ id: 'volley' }] };
    expect(abilityRow(variant)).toBe(ABILITIES.aoi);
    const own = [{ ...ABILITIES.aoi[0] }];
    expect(abilityRow(variant, { 'aoi@fantasy': own, aoi: ABILITIES.aoi })).toBe(own);
  });

  test('a unit without a row is left alone', () => {
    const units = [{ id: 'aoi', kind: 'tower', paths: [{ id: 'volley' }] }];
    attachAbilities(units, {});
    expect(units[0].paths[0].ability).toBeUndefined();
  });
});

describe('A0 changes no behaviour', () => {
  test('nothing in the sim reads ability or skill data yet', () => {
    const files = readdirSync(join(ROOT, 'src/sim')).filter((f) => f.endsWith('.js'));
    for (const f of files) {
      const src = readFileSync(join(ROOT, 'src/sim', f), 'utf8');
      expect(/\.ability\b|\.skill\b|abilities\.js/.test(src), f).toBe(false);
    }
  });

  test('the text file stays outside the co-op graph (a wording fix never changes the co-op id)', async () => {
    const { simId } = await import('../../tools/simId.mjs');
    const { files } = simId(ROOT);
    expect(files).toContain('src/data/abilities.js');
    expect(files).not.toContain('src/data/abilityText.js');
  });
});
