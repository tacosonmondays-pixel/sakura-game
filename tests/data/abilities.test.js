// Ability data (src/data/abilities.js numbers, src/data/abilityText.js words; ABILITIES_SPEC §5.1, §6,
// §13): one ⚡ path per tower that unlocks at tier 3 and upgrades at tier 5, one Lv 7 skill per hero
// that ranks up at Lv 17, the shared vocabulary, cooldowns and durations in whole ticks, a text row
// for every ability whose templates fill completely, names that clash with nothing, our own words
// only, a ⚡ tip per girl, and the attach hook. The sim reads it in one place, src/sim/abilities.js (A1).
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

// ABILITIES_SPEC §5.1, copied row by row: each tower's tier-3 entry with its tier-5 override, and each
// hero's Lv 7 skill with its Lv 17 rank, exactly as the data must hold them. A1 builds on these numbers,
// so any drift from the spec fails here. Statuses are written out, not taken from the data's builders.
// Values marked "(not in the spec)" are A0's own choices for what the spec leaves open (NOTES.md, A0).
const stun = (duration) => ({ type: 'stun', duration });
const freeze = (duration) => ({ type: 'freeze', duration });
const slow = (amount, duration) => ({ type: 'slow', amount, duration });
const shock = (duration) => ({ type: 'shock', duration });
const soak = (duration) => ({ type: 'soak', duration });
const mark = (bonus, duration) => ({ type: 'mark', bonus, duration });
const silence = (duration) => ({ type: 'silence', duration });
const reveal = (duration) => ({ type: 'reveal', duration });
const SPEC_TOWERS = {
  aoi: {
    path: 'volley', id: 'aoi.skyfall', kind: 'strike', scope: 'local', cooldown: 35, duration: 0,
    effect: { pick: 'mode', count: 6, reachMul: 1.5, dmgMul: 6, status: [stun(0.5)] },
    auto: { when: 'enemies', min: 4, orElite: true },
    t5: { cooldown: 28, effect: { count: 12, dmgMul: 8 } },
  },
  rei: {
    path: 'whirlwind', id: 'rei.hurricane', kind: 'boost', scope: 'local', cooldown: 30, duration: 4,
    effect: { mods: { rateMul: 2.5, range: 0.6, maxTargets: 99 } },
    auto: { when: 'enemies', min: 4 },
    t5: { cooldown: 25, duration: 6, effect: { mods: { rateMul: 3, range: 1, maxTargets: 99 } } },
  },
  yuki: {
    path: 'deepfreeze', id: 'yuki.whiteout', kind: 'burst', scope: 'local', cooldown: 40, duration: 0,
    effect: { at: 'self', radiusMul: 1.5, status: [freeze(2), slow(0.4, 5)] },
    auto: { when: 'enemies', min: 6, orLeak: 0.7 },
    t5: { cooldown: 30, effect: { radiusMul: 2, status: [freeze(3), slow(0.5, 6)] } },
  },
  momo: {
    path: 'orchard', id: 'momo.marketDay', kind: 'econ', scope: 'player', cooldown: 45, duration: 0,
    effect: { coins: 100 },
    auto: { when: 'ready' },
    t5: { cooldown: 40, effect: { coins: 400 } },
  },
  akane: {
    path: 'bigbang', id: 'akane.starmine', kind: 'burst', scope: 'local', cooldown: 40, duration: 2,
    effect: { at: 'densest', reachMul: 1.5, shells: 6, delay: 0.5, every: 0.25, radius: 1.2, dmgMul: 3, knockback: 0.3 },
    auto: { when: 'enemies', min: 6 },
    // duration 3.5 (not in the spec): the tier-3 rule, until 0.25 s after the last of 12 shells
    t5: { cooldown: 32, duration: 3.5, effect: { shells: 12, dmgMul: 4, hitsAir: true } },
  },
  sango: {
    path: 'frag', id: 'sango.tidebreaker', kind: 'burst', scope: 'local', cooldown: 40, duration: 0,
    effect: { at: 'densest', reachMul: 2, shells: 1, radius: 1.5, dmgMul: 4, knockback: 1.2, status: [stun(0.6)] },
    auto: { when: 'enemies', min: 5 },
    // duration 1.25 (not in the spec): until 0.25 s after the last of 3 shells 0.5 s apart
    t5: { cooldown: 35, duration: 1.25, effect: { shells: 3, every: 0.5, reaim: true } },
  },
  kage: {
    path: 'steel', id: 'kage.doubles', kind: 'deploy', scope: 'local', cooldown: 40, duration: 8,
    effect: { deploy: 'double', count: 2, spacing: 1.5, dmgMul: 0.6 },
    auto: { when: 'enemies', min: 4 },
    t5: { cooldown: 35, duration: 10, effect: { count: 3, dmgMul: 0.75 } },
  },
  umeko: {
    path: 'lighthouse', id: 'umeko.flare', kind: 'debuff', scope: 'map', cooldown: 40, duration: 8,
    effect: { pick: 'veiled', status: [reveal(8)], rally: { inAura: true, detection: true, rangeMul: 1.15 } },
    auto: { when: 'veiled' },
    // the spec raises only the reveal to 12 s; the rally rider keeps the 8 s duration (not in the spec)
    t5: { cooldown: 32, effect: { status: [reveal(12)], rally: { inAura: true, detection: true, rangeMul: 1.25, dmgMul: 1.1 } } },
  },
  shiro: {
    // duration 1 (not in the spec as a duration): the 1 s reticle telegraph before the shots land
    path: 'execution', id: 'shiro.verdict', kind: 'strike', scope: 'map', cooldown: 45, duration: 1,
    effect: { pick: 'priority', count: 2, reach: 'map', delay: 1, dmgMul: 5, armorPen: 99 },
    auto: { when: 'elite', orCaster: true },
    t5: { cooldown: 35, effect: { count: 4, dmgMul: 6 } },
  },
  midori: {
    path: 'toxicology', id: 'midori.catalyst', kind: 'strike', scope: 'local', cooldown: 30, duration: 0,
    effect: { pick: 'poisoned', reachMul: 1.5, poisonMul: 2, splash: 0.8, splashShare: 0.5 },
    auto: { when: 'poisoned', min: 4 },
    t5: { cooldown: 25, effect: { poisonMul: 2.5, spreadPoison: 3 } },
  },
  suzu: {
    path: 'mines', id: 'suzu.bellCarpet', kind: 'deploy', scope: 'local', cooldown: 45, duration: 15,
    effect: { deploy: 'trap', count: 6, arm: 0.3 },
    auto: { when: 'enemies', min: 6 },
    t5: { cooldown: 35, duration: 20, effect: { count: 12 } },
  },
  raika: {
    path: 'rhythm', id: 'raika.drumstorm', kind: 'boost', scope: 'local', cooldown: 35, duration: 5,
    effect: { mods: { rateMul: 1.6, chain: 2, status: [shock(0.25)] } },
    auto: { when: 'enemies', min: 4 },
    t5: { cooldown: 30, duration: 7, effect: { mods: { rateMul: 2, chain: 4, status: [shock(0.25)] } } },
  },
  miko: {
    path: 'blessing', id: 'miko.chorus', kind: 'rally', scope: 'local', cooldown: 45, duration: 8,
    effect: { radius: 4, dmgMul: 1.25, rateMul: 1.15 },
    auto: { when: 'enemies', min: 6 },
    t5: { cooldown: 40, duration: 10, effect: { radius: 5, dmgMul: 1.35, rateMul: 1.25 } },
  },
  hotaru: {
    path: 'prayer', id: 'hotaru.hush', kind: 'debuff', scope: 'map', cooldown: 45, duration: 3,
    effect: { pick: 'all', status: [silence(3), reveal(6)], casterStatus: [stun(1)] },
    auto: { when: 'caster', orVeiled: true },
    t5: { cooldown: 40, duration: 5, effect: { status: [silence(5), reveal(6), slow(0.4, 3)] } },
  },
  kaede: {
    path: 'flowing', id: 'kaede.flashLunge', kind: 'strike', scope: 'local', cooldown: 25, duration: 0,
    effect: { pick: 'mode', count: 1, reachMul: 2.5, hits: 5, dmgMul: 1, fullRamp: true, keepRamp: true },
    auto: { when: 'enemies', min: 3, orElite: true },
    t5: { cooldown: 20, effect: { hits: 8 } },
  },
  chika: {
    path: 'sentry', id: 'chika.droneSurge', kind: 'deploy', scope: 'local', cooldown: 45, duration: 12,
    effect: { deploy: 'drone', count: 4 },
    auto: { when: 'enemies', min: 5, reach: 'leash' },
    t5: { cooldown: 40, duration: 15, effect: { count: 8 } },
  },
};
const SPEC_HEROES = {
  hikari: {
    id: 'hikari.rally', kind: 'rally', scope: 'local', cooldown: 35, duration: 6,
    effect: { radius: 3, rateMul: 1.2, cleanse: true, ward: true },
    auto: { when: 'enemies', min: 4 }, // from the build plan, not the spec table
    ranks: [{ level: 17, cooldown: 30, duration: 8, effect: { radius: 4, rateMul: 1.3 } }],
  },
  luna: {
    // duration 8 (not in the spec as a duration): how long the marks last
    id: 'luna.moonbrand', kind: 'debuff', scope: 'map', cooldown: 30, duration: 8,
    effect: { pick: 'strong', count: 5, status: [mark(0.2, 8)] },
    auto: { when: 'enemies', min: 5, orElite: true }, // not in the spec
    ranks: [{ level: 17, cooldown: 25, effect: { count: 8, status: [mark(0.25, 8)] } }],
  },
  nami: {
    id: 'nami.frostNet', kind: 'burst', scope: 'local', cooldown: 25, duration: 0,
    effect: { at: 'densest', reachMul: 1, radius: 1.6, status: [freeze(1.2), soak(5)] },
    auto: { when: 'enemies', min: 5 }, // not in the spec
    ranks: [{ level: 17, cooldown: 21, effect: { radius: 2, status: [freeze(1.6), soak(5)] } }],
  },
};

/** The spec's upgrade column applied to its base row: named values replace, the rest carry over. */
function specUpgraded(base, { level, effect = {}, ...scalars }) {
  return { ...base, ...scalars, effect: { ...base.effect, ...effect } };
}

// The effect fields each kind may use (a typo in the data fails here, not silently in the sim).
const STATUS_LIST = ['status'];
const EFFECT_KEYS = {
  strike: ['pick', 'count', 'reachMul', 'reach', 'dmgMul', 'hits', 'fullRamp', 'keepRamp', 'delay', 'armorPen', 'poisonMul', 'splash', 'splashShare', 'spreadPoison', ...STATUS_LIST],
  burst: ['at', 'reachMul', 'radius', 'radiusMul', 'shells', 'delay', 'every', 'reaim', 'dmgMul', 'knockback', 'hitsAir', ...STATUS_LIST],
  boost: ['mods'],
  rally: ['radius', 'inAura', 'target', 'dmgMul', 'rateMul', 'rangeMul', 'detection', 'cleanse', 'ward'],
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

/**
 * Other games' names never appear in our data or text (kept in sync with the content rule). The list is
 * stored base64-encoded so this file never spells them out itself: decoded, it is the `|`-separated
 * alternatives of one case-insensitive whole-word RegExp.
 */
const FOREIGN_WORDS = atob(
  'Ymxvb25zP3xidGRcZCp8bW9ua2V5cz98Z2Vuc2hpbnx6ZW5sZXNzfHp6enxibHVlIGFyY2hpdmV8a2l2b3Rvc3xzY2hhbGV8'
  + 'YXJrbmlnaHRzfGF6dXIgbGFuZXxob25rYWl8bmlra2V8a2FuY29sbGV8a2FudGFpfGhveW92ZXJzZXxiYS1zdHlsZQ==',
).split('|');
const FOREIGN = new RegExp(`\\b(${FOREIGN_WORDS.join('|')})\\b`, 'i');

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
    // a rally on one girl (target 'girl': the girl-target rule, spec §7.2) has no radius
    if ('target' in e && e.target !== 'girl') errs.push(`${where}: target is 'girl'`);
    if (!(e.radius > 0) && e.inAura !== true && e.target !== 'girl') errs.push(`${where}: a rally needs a radius`);
    if (!(d.duration > 0)) errs.push(`${where}: a rally lasts > 0 s`);
  }
  if (e.rally) {
    for (const k of Object.keys(e.rally)) if (!EFFECT_KEYS.rally.includes(k) || k === 'target') errs.push(`${where}: rally rider key ${k}`);
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
      densestCap: 60, hasteShare: 0.5, hasteCap: 0.5, unhastedKinds: ['rally', 'debuff'], girlAimRadius: 0.6,
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

  test('a rally on one girl (target: girl, the girl-target rule of spec §7.2) needs no radius; nothing else does', () => {
    const rally = (effect) => ({ id: 'x.y', kind: 'rally', scope: 'local', cooldown: 45, duration: 12, effect });
    expect(defErrors(rally({ target: 'girl', rateMul: 1.8, rangeMul: 1.2 }), 'one girl')).toEqual([]);
    expect(defErrors(rally({ rateMul: 1.8 }), 'no radius')).toEqual(['no radius: a rally needs a radius']);
    expect(defErrors(rally({ target: 'lane', rateMul: 1.8 }), 'bad target')).toEqual(["bad target: target is 'girl'", 'bad target: a rally needs a radius']);
    const rider = { id: 'x.z', kind: 'debuff', scope: 'map', cooldown: 40, duration: 8, effect: { pick: 'all', status: [{ type: 'reveal', duration: 8 }], rally: { target: 'girl', rateMul: 1.2 } } };
    expect(defErrors(rider, 'rider')).toEqual(['rider: rally rider key target']);
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

  test('the spec table covers every girl with an ability, and nobody else', () => {
    expect(Object.keys(SPEC_TOWERS).sort()).toEqual(towers().map((u) => u.id).sort());
    expect(Object.keys(SPEC_HEROES).sort()).toEqual(heroes().map((u) => u.id).sort());
    expect(Object.keys(ABILITIES).sort()).toEqual([...Object.keys(SPEC_TOWERS), ...Object.keys(SPEC_HEROES)].sort());
  });

  test.each(Object.keys(SPEC_TOWERS))('%s: the spec numbers (§5.1) at tier 3 and tier 5', (id) => {
    const base = { unlockTier: 3, ...SPEC_TOWERS[id] };
    expect(ABILITIES[id]).toEqual([base]);
    expect(abilityAtTier(ABILITIES[id][0], 3)).toEqual(base);
    expect(abilityAtTier(ABILITIES[id][0], 5)).toEqual(specUpgraded(base, base.t5));
  });

  test.each(Object.keys(SPEC_HEROES))('%s: the spec numbers (§5.1 heroes) at Lv 7 and Lv 17', (id) => {
    const base = { unlockLevel: 7, ...SPEC_HEROES[id] };
    expect(ABILITIES[id]).toEqual({ skill: base });
    expect(skillAtLevel(ABILITIES[id].skill, 7)).toEqual(base);
    expect(skillAtLevel(ABILITIES[id].skill, 17)).toEqual(specUpgraded(base, base.ranks[0]));
    expect(skillAtLevel(ABILITIES[id].skill, 25)).toEqual(specUpgraded(base, base.ranks[0]));
  });

  test('map-scope abilities: Umeko, Shiro, Hotaru (one cooldown per player) and Luna\'s skill', () => {
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

  test('path and tier names are unique across girls (spec §13, r2)', () => {
    // a name may repeat within one girl (a path named after its own tier); never across two girls
    const owner = new Map();
    const clashes = [];
    let count = 0;
    for (const u of UNITS) {
      for (const p of u.paths) {
        for (const n of [p.name, ...p.tiers.map((t) => t.name)]) {
          count++;
          const key = n.trim().toLowerCase();
          const was = owner.get(key);
          if (was && was !== u.id) clashes.push(`"${n}": ${was} and ${u.id}`);
          else owner.set(key, u.id);
        }
      }
    }
    expect(count).toBeGreaterThan(250); // every tower's 3 paths × (1 + 5 tiers)
    expect(clashes).toEqual([]);
  });

  test('our own words only: abilities.js, abilityText.js and every tip', () => {
    for (const f of ['src/data/abilities.js', 'src/data/abilityText.js']) {
      const src = readFileSync(join(ROOT, f), 'utf8');
      const hit = src.split('\n').find((l) => FOREIGN.test(l));
      expect(hit, `${f}: ${hit}`).toBeUndefined();
    }
    for (const u of UNITS) for (const tip of u.tips) expect(FOREIGN.test(tip), `${u.id}: ${tip}`).toBe(false);
  });

  test('the encoded word list decodes and matches each of its own entries', () => {
    expect(FOREIGN_WORDS.length).toBe(17);
    // an entry's plain form (its optional plural `?` and digits `\d*` dropped) is caught, in any case
    for (const w of FOREIGN_WORDS) {
      const plain = w.replace(/\\d\*|\?/g, '');
      expect(FOREIGN.test(plain), plain).toBe(true);
      expect(FOREIGN.test(`A ${plain.toUpperCase()} tip.`), plain).toBe(true);
    }
    // whole words only, and our own names pass
    expect(FOREIGN.test(`${FOREIGN_WORDS[3]}x`)).toBe(false);
    expect(FOREIGN.test('Skyfall Volley, Drone Surge and Market Day')).toBe(false);
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

describe('the sim reads ability data in one place', () => {
  test('only src/sim/abilities.js reads paths[k].ability / hero.skill and imports the data file', () => {
    const files = readdirSync(join(ROOT, 'src/sim')).filter((f) => f.endsWith('.js'));
    expect(files).toContain('abilities.js');
    for (const f of files) {
      if (f === 'abilities.js') continue;
      const src = readFileSync(join(ROOT, 'src/sim', f), 'utf8');
      expect(/\.ability\b|\.skill\b|data\/abilities\.js/.test(src), f).toBe(false);
    }
    const ab = readFileSync(join(ROOT, 'src/sim/abilities.js'), 'utf8');
    expect(ab).toContain("from '../data/abilities.js'");
    expect(ab).not.toMatch(/abilityText/);
  });

  test('the text file stays outside the co-op graph (a wording fix never changes the co-op id)', async () => {
    const { simId } = await import('../../tools/simId.mjs');
    const { files } = simId(ROOT);
    expect(files).toContain('src/data/abilities.js');
    expect(files).not.toContain('src/data/abilityText.js');
  });
});
