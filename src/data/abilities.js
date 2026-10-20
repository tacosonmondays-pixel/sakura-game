// Activated abilities — "ults for towers" (ABILITIES_SPEC §5, §6.1; owner decisions, Oct 14–20).
//
// Every tower girl learns one ability at tier 3 of her ⚡ path, and tier 5 of that path upgrades it
// (the crosspath rule lets only one path pass tier 2, so a girl never holds two). Every hero learns a
// quick skill at Lv 7 that ranks up at Lv 17, next to her ultimate. This file holds NUMBERS ONLY: the
// names, icons and descriptions are in src/data/abilityText.js, which the sim never imports, so a
// wording fix never changes the co-op id. This file is imported by units.js, so it is part of the
// co-op graph (tools/simId.mjs) and of the battle-data hash (src/online/coop/version.js).
//
// Units: cooldowns and durations are seconds of WAVE time (they charge only while a wave runs);
// the sim turns them into integer ticks and charge points (ABILITY_RULES), so every value here is a
// whole number of ticks (tests/data/abilities.test.js). Ability hits never crit and their statuses
// never roll: no StatusSpec here carries a `chance`.
//
// Entry (a tower's row is a list: one entry per ⚡ path; today every girl has exactly one):
//   { path, unlockTier: 3, id, kind, scope, cooldown, duration, effect, auto, t5: { cooldown?, duration?, effect? } }
// Hero row: { skill: { unlockLevel: 7, id, kind, scope, cooldown, duration, effect, auto,
//                      ranks: [{ level, cooldown?, duration?, effect? }] } }
// An upgrade (t5, a rank) merges by spread: its scalars replace, its `effect` fields replace the
// base's one by one (a nested list or object such as `status` or `mods` is replaced whole).
//
//   kind     boost · rally · strike · burst · debuff · econ (sim A1) · deploy (A4) · move, zone, runner (later)
//   scope    local  — one cooldown per girl
//            map    — one cooldown per player for that ability (copies add nothing)
//            player — per-player rules (econ: ABILITY_RULES.econCapPerWave casts per wave)
//   duration how long a lasting effect runs (boost, rally, deploy, a debuff's hold); 0 = instant.
//            Every lasting effect also ends at the wave clear.
//
// `effect` fields by kind (reach and radius in tiles unless named …Mul, which scale her range):
//   strike  pick ('mode' her target mode | 'strong' | 'priority' casters → bosses → elites → strongest |
//           'poisoned' every poisoned enemy), count (absent = every pick), reachMul | reach: 'map',
//           dmgMul (× her current hit), hits (strikes on each target), fullRamp (each hit at 1 + ramp.max),
//           keepRamp, delay (s, a telegraph), armorPen (99 = ignores armor), status,
//           poisonMul / splash / splashShare / spreadPoison (s) for detonating poison
//   burst   at ('self' | 'densest' crowd within reachMul × range), radius | radiusMul, shells, delay,
//           every (s between shells), reaim (each shell picks its point again), dmgMul, knockback,
//           hitsAir, status
//   boost   mods: a ModSet on the caster for `duration` (CONTRACTS §3; resolved after every other set)
//   rally   radius | inAura (her aura's reach), dmgMul, rateMul, rangeMul, detection, cleanse,
//           ward (blocks new sabotage while it lasts); both players' girls, strongest per key wins
//   debuff  pick ('all' | 'veiled' | 'strong'), count, status, casterStatus (casters only),
//           rally (a rally rider for `duration`)
//   econ    coins (× the difficulty's coin rate and the mode's income rate; owner-credited)
//   deploy  deploy ('double' | 'trap' | 'drone'), count, spacing, dmgMul, arm (s)
//
// `auto` (the per-girl Auto switch and the Auto-cast setting; both default Off):
//   { when: AUTO_WHEN, min?, orElite?, orCaster?, orVeiled?, orLeak? (a share of the path), reach? }
//   `min` counts enemies within the ability's reach (reachMul × her range, a rally's radius, the
//   whole map for map scope, `reach: 'leash'` = her drones' leash). Auto picks a decent moment,
//   not a perfect one.

/** Global rules (spec §3.2, §3.3; Skill Haste at half rate, GEAR_STATS §B.4, owner 2026-10-15). */
export const ABILITY_RULES = Object.freeze({
  ticksPerSecond: 60, chargePerTick: 100, // a 40 s cooldown = 240,000 charge points
  initialShare: 3, // on unlock: cd = round(cdMax / 3) left to charge; econ starts empty (cd = cdMax)
  ccGuardTicks: 240, // a miniboss or boss ignores ability stuns and freezes for 4 s after one lands
  autoEvery: 6, // auto-cast checks a girl every 6th step, staggered by uid
  econCapPerWave: 2, // econ casts per player per wave, across every copy
  densestCap: 60, // candidates the densest-crowd scan looks at
  hasteShare: 0.5, hasteCap: 0.5, // Skill Haste speeds abilities at half rate: 100 / (1 − 0.5 × min(0.5, h))
  unhastedKinds: Object.freeze(['rally', 'debuff']),
});

export const ABILITY_KINDS = Object.freeze(['boost', 'rally', 'strike', 'burst', 'debuff', 'econ', 'deploy', 'move', 'zone', 'runner']);
export const ABILITY_SCOPES = Object.freeze(['local', 'map', 'player']);
export const AUTO_WHEN = Object.freeze(['enemies', 'elite', 'leak', 'veiled', 'caster', 'poisoned', 'ready']);

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

// StatusSpec builders (the shapes of src/data/units.js S.*, always certain)
const S = {
  slow: (amount, duration) => ({ type: 'slow', amount, duration }),
  freeze: (duration) => ({ type: 'freeze', duration }),
  stun: (duration) => ({ type: 'stun', duration }),
  shock: (duration) => ({ type: 'shock', duration }),
  soak: (duration) => ({ type: 'soak', duration }),
  mark: (bonus, duration) => ({ type: 'mark', bonus, duration }),
  silence: (duration) => ({ type: 'silence', duration }),
  reveal: (duration) => ({ type: 'reveal', duration }),
};

/**
 * Every girl's ability (ABILITIES_SPEC §5.1 — the single source of truth for the numbers).
 * Keys are unit ids, or `id@kitStyle` for a kit variant.
 */
export const ABILITIES = deepFreeze({
  // ----- heroes: a Lv 7 skill, rank 2 at Lv 17 -----
  hikari: {
    skill: {
      unlockLevel: 7, id: 'hikari.rally', kind: 'rally', scope: 'local', cooldown: 35, duration: 6,
      effect: { radius: 3, rateMul: 1.2, cleanse: true, ward: true },
      auto: { when: 'enemies', min: 4 },
      ranks: [{ level: 17, cooldown: 30, duration: 8, effect: { radius: 4, rateMul: 1.3 } }],
    },
  },
  luna: {
    skill: {
      unlockLevel: 7, id: 'luna.moonbrand', kind: 'debuff', scope: 'map', cooldown: 30, duration: 8,
      effect: { pick: 'strong', count: 5, status: [S.mark(0.2, 8)] },
      auto: { when: 'enemies', min: 5, orElite: true },
      ranks: [{ level: 17, cooldown: 25, effect: { count: 8, status: [S.mark(0.25, 8)] } }],
    },
  },
  nami: {
    skill: {
      unlockLevel: 7, id: 'nami.frostNet', kind: 'burst', scope: 'local', cooldown: 25, duration: 0,
      effect: { at: 'densest', reachMul: 1, radius: 1.6, status: [S.freeze(1.2), S.soak(5)] },
      auto: { when: 'enemies', min: 5 },
      ranks: [{ level: 17, cooldown: 21, effect: { radius: 2, status: [S.freeze(1.6), S.soak(5)] } }],
    },
  },

  // ----- towers: tier 3 of the ⚡ path, upgraded at tier 5 -----
  aoi: [{
    path: 'volley', unlockTier: 3, id: 'aoi.skyfall', kind: 'strike', scope: 'local', cooldown: 35, duration: 0,
    effect: { pick: 'mode', count: 6, reachMul: 1.5, dmgMul: 6, status: [S.stun(0.5)] },
    auto: { when: 'enemies', min: 4, orElite: true },
    t5: { cooldown: 28, effect: { count: 12, dmgMul: 8 } },
  }],
  rei: [{
    path: 'whirlwind', unlockTier: 3, id: 'rei.hurricane', kind: 'boost', scope: 'local', cooldown: 30, duration: 4,
    effect: { mods: { rateMul: 2.5, range: 0.6, maxTargets: 99 } },
    auto: { when: 'enemies', min: 4 },
    t5: { cooldown: 25, duration: 6, effect: { mods: { rateMul: 3, range: 1, maxTargets: 99 } } },
  }],
  yuki: [{
    path: 'deepfreeze', unlockTier: 3, id: 'yuki.whiteout', kind: 'burst', scope: 'local', cooldown: 40, duration: 0,
    effect: { at: 'self', radiusMul: 1.5, status: [S.freeze(2), S.slow(0.4, 5)] },
    auto: { when: 'enemies', min: 6, orLeak: 0.7 },
    t5: { cooldown: 30, effect: { radiusMul: 2, status: [S.freeze(3), S.slow(0.5, 6)] } },
  }],
  momo: [{
    path: 'orchard', unlockTier: 3, id: 'momo.marketDay', kind: 'econ', scope: 'player', cooldown: 45, duration: 0,
    effect: { coins: 100 },
    auto: { when: 'ready' },
    t5: { cooldown: 40, effect: { coins: 400 } },
  }],
  akane: [{
    // warning rings, then a shell every 0.25 s from 0.5 s after the cast; it lasts until 0.25 s after the last
    path: 'bigbang', unlockTier: 3, id: 'akane.starmine', kind: 'burst', scope: 'local', cooldown: 40, duration: 2,
    effect: { at: 'densest', reachMul: 1.5, shells: 6, delay: 0.5, every: 0.25, radius: 1.2, dmgMul: 3, knockback: 0.3 },
    auto: { when: 'enemies', min: 6 },
    t5: { cooldown: 32, duration: 3.5, effect: { shells: 12, dmgMul: 4, hitsAir: true } },
  }],
  sango: [{
    path: 'frag', unlockTier: 3, id: 'sango.tidebreaker', kind: 'burst', scope: 'local', cooldown: 40, duration: 0,
    effect: { at: 'densest', reachMul: 2, shells: 1, radius: 1.5, dmgMul: 4, knockback: 1.2, status: [S.stun(0.6)] },
    auto: { when: 'enemies', min: 5 },
    t5: { cooldown: 35, duration: 1.25, effect: { shells: 3, every: 0.5, reaim: true } },
  }],
  kage: [{
    // two doubles on the road spots nearest the exit in her range, at least 1.5 tiles apart
    path: 'steel', unlockTier: 3, id: 'kage.doubles', kind: 'deploy', scope: 'local', cooldown: 40, duration: 8,
    effect: { deploy: 'double', count: 2, spacing: 1.5, dmgMul: 0.6 },
    auto: { when: 'enemies', min: 4 },
    t5: { cooldown: 35, duration: 10, effect: { count: 3, dmgMul: 0.75 } },
  }],
  umeko: [{
    // the rally rider lasts `duration` (8 s); the reveal is its own status
    path: 'lighthouse', unlockTier: 3, id: 'umeko.flare', kind: 'debuff', scope: 'map', cooldown: 40, duration: 8,
    effect: { pick: 'veiled', status: [S.reveal(8)], rally: { inAura: true, detection: true, rangeMul: 1.15 } },
    auto: { when: 'veiled' },
    t5: { cooldown: 32, effect: { status: [S.reveal(12)], rally: { inAura: true, detection: true, rangeMul: 1.25, dmgMul: 1.1 } } },
  }],
  shiro: [{
    // a reticle marks the targets; the shots land 1 s later (×1.5 vs elites comes from her own Elite Hunter)
    path: 'execution', unlockTier: 3, id: 'shiro.verdict', kind: 'strike', scope: 'map', cooldown: 45, duration: 1,
    effect: { pick: 'priority', count: 2, reach: 'map', delay: 1, dmgMul: 5, armorPen: 99 },
    auto: { when: 'elite', orCaster: true },
    t5: { cooldown: 35, effect: { count: 4, dmgMul: 6 } },
  }],
  midori: [{
    // every poisoned enemy takes its remaining poison at once (× poisonMul) and the poison ends;
    // enemies within `splash` of each burst take `splashShare` of it
    path: 'toxicology', unlockTier: 3, id: 'midori.catalyst', kind: 'strike', scope: 'local', cooldown: 30, duration: 0,
    effect: { pick: 'poisoned', reachMul: 1.5, poisonMul: 2, splash: 0.8, splashShare: 0.5 },
    auto: { when: 'poisoned', min: 4 },
    t5: { cooldown: 25, effect: { poisonMul: 2.5, spreadPoison: 3 } },
  }],
  suzu: [{
    // extra traps spread evenly along the road in her range (no rng), beyond her trap limit
    path: 'mines', unlockTier: 3, id: 'suzu.bellCarpet', kind: 'deploy', scope: 'local', cooldown: 45, duration: 15,
    effect: { deploy: 'trap', count: 6, arm: 0.3 },
    auto: { when: 'enemies', min: 6 },
    t5: { cooldown: 35, duration: 20, effect: { count: 12 } },
  }],
  raika: [{
    path: 'rhythm', unlockTier: 3, id: 'raika.drumstorm', kind: 'boost', scope: 'local', cooldown: 35, duration: 5,
    effect: { mods: { rateMul: 1.6, chain: 2, status: [S.shock(0.25)] } },
    auto: { when: 'enemies', min: 4 },
    t5: { cooldown: 30, duration: 7, effect: { mods: { rateMul: 2, chain: 4, status: [S.shock(0.25)] } } },
  }],
  miko: [{
    path: 'blessing', unlockTier: 3, id: 'miko.chorus', kind: 'rally', scope: 'local', cooldown: 45, duration: 8,
    effect: { radius: 4, dmgMul: 1.25, rateMul: 1.15 },
    auto: { when: 'enemies', min: 6 },
    t5: { cooldown: 40, duration: 10, effect: { radius: 5, dmgMul: 1.35, rateMul: 1.25 } },
  }],
  hotaru: [{
    // every enemy on the map that is not in a tunnel; casters are also stunned
    path: 'prayer', unlockTier: 3, id: 'hotaru.hush', kind: 'debuff', scope: 'map', cooldown: 45, duration: 3,
    effect: { pick: 'all', status: [S.silence(3), S.reveal(6)], casterStatus: [S.stun(1)] },
    auto: { when: 'caster', orVeiled: true },
    t5: { cooldown: 40, duration: 5, effect: { status: [S.silence(5), S.reveal(6), S.slow(0.4, 3)] } },
  }],
  kaede: [{
    // the dash is drawn only: her sim position never changes
    path: 'flowing', unlockTier: 3, id: 'kaede.flashLunge', kind: 'strike', scope: 'local', cooldown: 25, duration: 0,
    effect: { pick: 'mode', count: 1, reachMul: 2.5, hits: 5, dmgMul: 1, fullRamp: true, keepRamp: true },
    auto: { when: 'enemies', min: 3, orElite: true },
    t5: { cooldown: 20, effect: { hits: 8 } },
  }],
  chika: [{
    // extra drones beyond her limit; they follow her flight mode, then dock and vanish
    path: 'sentry', unlockTier: 3, id: 'chika.droneSurge', kind: 'deploy', scope: 'local', cooldown: 45, duration: 12,
    effect: { deploy: 'drone', count: 4 },
    auto: { when: 'enemies', min: 5, reach: 'leash' },
    t5: { cooldown: 40, duration: 15, effect: { count: 8 } },
  }],

  // ----- the new girls (ABILITIES_SPEC §5.3; UNIT_GAPS §5) -----
  azami: [{
    // extra strips spread evenly along the road in her reach, beyond her strip cap (src/sim/strips.js)
    path: 'checkpoint', unlockTier: 3, id: 'azami.spikeRain', kind: 'deploy', scope: 'local', cooldown: 45, duration: 10,
    effect: { deploy: 'strips', count: 12, hits: 8, arm: 0.3, reachMul: 1 },
    auto: { when: 'enemies', min: 6 },
    t5: { cooldown: 35, duration: 15, effect: { count: 24, reachMul: 2 } },
  }],
  kinu: [{
    // two blades every 0.1 s along a turning spiral, out to twice her range (src/sim/rings.js)
    path: 'bobbin', unlockTier: 3, id: 'kinu.bladeSpiral', kind: 'boost', scope: 'local', cooldown: 25, duration: 4,
    effect: { mods: { ring: { spiral: 1, spiralPierce: 3 } } },
    auto: { when: 'enemies', min: 4 },
    t5: { cooldown: 20, duration: 6, effect: { mods: { ring: { spiral: 2, spiralPierce: 8 } } } },
  }],
  wakaba: [{
    // a rally on one girl: the one nearest the aim point (0.6 tiles), else her top damage dealer in range
    path: 'plan', unlockTier: 3, id: 'wakaba.timeOut', kind: 'rally', scope: 'local', cooldown: 45, duration: 12,
    effect: { target: 'girl', rateMul: 1.8, rangeMul: 1.2 },
    auto: { when: 'enemies', min: 6 },
    t5: { cooldown: 35, duration: 15, effect: { dmgMul: 1.4 } },
  }],
});

/**
 * One upgrade merged onto a definition: scalars replace, `effect` fields replace one by one.
 * @param {object} def an ability entry or hero skill (or an already merged one)
 * @param {object|null} over a `t5` or a rank ({ level?, cooldown?, duration?, effect? })
 * @returns {object} `def` itself when there is nothing to merge, else a new object
 */
export function mergeAbility(def, over) {
  if (!over) return def;
  const { effect, level, ...rest } = over; // a rank's `level` says when, it is not part of the definition
  return { ...def, ...rest, effect: effect ? { ...def.effect, ...effect } : def.effect };
}

/** A ⚡ path ability at a path tier: the base from its unlock tier, the tier-5 upgrade at tier 5. */
export function abilityAtTier(entry, tier) {
  return tier >= 5 && entry.t5 ? mergeAbility(entry, entry.t5) : entry;
}

/** A hero skill at a hero level: every rank whose level is reached, in order. */
export function skillAtLevel(skill, level) {
  let d = skill;
  for (const r of skill.ranks || []) if (level >= r.level) d = mergeAbility(d, r);
  return d;
}

/** A def's ability row: its kit variant's (`id@kitStyle`) first, else the girl's, else null. */
export function abilityRow(def, table = ABILITIES) {
  if (!def) return null;
  if (def.kitStyle && table[`${def.id}@${def.kitStyle}`]) return table[`${def.id}@${def.kitStyle}`];
  return table[def.id] || null;
}

/**
 * Puts each row on its unit: a tower's entries on the paths they name (`paths[k].ability`), a hero's
 * skill on `hero.skill`. Called once by units.js. Throws on a row for a girl who does not exist, a
 * path id the girl does not have (a roster rename) or a row of the wrong shape, so data drift fails
 * at load, not in battle.
 * @param {object[]} units UnitDefs (mutated: the frozen rows are attached, not copied)
 * @param {object} [table] ABILITIES
 */
export function attachAbilities(units, table = ABILITIES) {
  const ids = new Set(units.map((u) => u.id));
  for (const key of Object.keys(table)) {
    if (!ids.has(key.split('@')[0])) throw new Error(`attachAbilities: no unit "${key}"`);
  }
  for (const u of units) {
    const row = abilityRow(u, table);
    if (!row) continue;
    if (u.kind === 'hero') {
      if (!u.hero || Array.isArray(row) || !row.skill) throw new Error(`attachAbilities: ${u.id} is a hero; her row must be { skill }`);
      u.hero.skill = row.skill;
      continue;
    }
    if (!Array.isArray(row)) throw new Error(`attachAbilities: ${u.id} is a tower; her row must be a list of ⚡ paths`);
    for (const entry of row) {
      const p = u.paths.find((x) => x.id === entry.path);
      if (!p) throw new Error(`attachAbilities: ${u.id} has no path "${entry.path}"`);
      p.ability = entry;
    }
  }
}
