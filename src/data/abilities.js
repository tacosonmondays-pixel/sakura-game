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
// Entry (a tower's row is a list: one entry per ⚡ path; every girl has one but Ruri, who has one per familiar
// path; the crosspath rule lets only one of them pass tier 2):
//   { path, unlockTier: 3, id, kind, scope, cooldown, duration, effect, auto, t5: { cooldown?, duration?, effect? } }
// Hero row: { skill: { unlockLevel: 7, id, kind, scope, cooldown, duration, effect, auto,
//                      ranks: [{ level, cooldown?, duration?, effect? }] } }
// An upgrade (t5, a rank) merges by spread: its scalars replace, its `effect` fields replace the
// base's one by one (a nested list or object such as `status` or `mods` is replaced whole).
//
//   kind     boost · rally · strike · burst · debuff · econ (sim A1) · deploy (by type: 'strips' and 'sentries'
//            run; 'double', 'trap', 'drone' wait for A4, 'mirror' for A6) · runner (by type: 'giantBall' runs;
//            'river' waits for A6) · move, zone (later)
//            (which entries run: abilityRuns below, the one rule)
//   scope    local  — one cooldown per girl
//            map    — one cooldown per player for that ability (copies add nothing)
//            player — per-player rules (econ: ABILITY_RULES.econCapPerWave casts per wave)
//   duration how long a lasting effect runs (boost, rally, deploy, a debuff's hold); 0 = instant.
//            Every lasting effect also ends at the wave clear.
//
// `effect` fields by kind (reach and radius in tiles unless named …Mul, which scale her range):
//   strike  pick ('mode' her target mode | 'strong' | 'priority' casters → bosses → elites → strongest |
//           'poisoned' every poisoned enemy | 'air' flyers still in the sky, in Priority order, with
//           `fallback: { pick, count, ground }` when none is up (ground: walkers and grounded flyers only) |
//           'chain' the first enemy by her target mode in reach, then each next the nearest un-hit eligible
//           enemy within her chain jump (src/sim/towers.js chainNext; ties: the lower uid)),
//           count (absent = every pick), reachMul | reach: 'map', reachAdd (tiles on top of her range),
//           fromOrigin (looks and strikes from her relay origin: Ruri's Kon), dmgMul (× her current hit),
//           hits (strikes on each target), fullRamp (each hit at 1 + ramp.max),
//           keepRamp, delay (s, a telegraph), armorPen (99 = ignores armor), status, noBossStatus (bosses
//           take the hits but none of the statuses),
//           poisonMul / splash / splashShare / spreadPoison (s) for detonating poison;
//           on any other pick, splash (tiles) makes each strike a blast: every enemy within splash
//           of the struck one takes the same hit × splashShare (default 1, the full hit);
//           after: { mods, duration } a boost tail: the ModSet on the caster for `duration` s after
//           each cast (Tenka's Zero Point)
//   burst   at ('self' | 'densest' crowd within reachMul × range), radius | radiusMul, shells, delay,
//           every (s between shells), reaim (each shell picks its point again), dmgMul, knockback,
//           hitsAir, status
//   boost   mods: a ModSet on the caster for `duration` (CONTRACTS §3; resolved after every other set)
//   rally   radius | inAura (her aura's reach), dmgMul, rateMul, rangeMul, detection, cleanse,
//           ward (blocks new sabotage while it lasts); both players' girls, strongest per key wins;
//           target: 'girl' = a rally on ONE girl (no radius): the girl nearest the cast's aim point
//           within ABILITY_RULES.girlAimRadius (any player's, never the caster; ties: the lower uid),
//           else the girl in the caster's range who dealt the most damage (ties: the lower uid);
//           radius: 'map' = every girl (map scope); pierceAdd (whole pierce added while it lasts);
//           stunImmune (its ward also blocks the volatile slimes' tower stun: a ward does, through the cleanse);
//           lifeEvery / lifeRadius / lifeMax: while it runs, every lifeEvery kills within lifeRadius of her
//           restore a life, at most lifeMax a cast (never where hearts cannot come back, on one life or
//           without income; Noa's First Aid Call)
//   debuff  pick ('all' | 'veiled' | 'strong' | 'ground': walkers that are not bosses, the lead ones first),
//           count, reachMul, reachAdd, status (a curse bursts for burstMul × her current hit),
//           casterStatus (casters only), dmgMul (a hit on each, × her hit), rally (a rally rider for `duration`)
//   move    (A5, not run yet) reachMul, push / pushMiniboss, pick, count, carry / carryMiniboss, status
//   econ    coins (× the difficulty's coin rate and the mode's income rate; owner-credited)
//   deploy  deploy ('strips' Azami, 'sentries' Yuzuha; 'double' | 'trap' | 'drone' with A4; 'mirror' with A6),
//           count, spacing, dmgMul, arm (s), hits, reachMul, reflect / permanentReflect (Iroha's mirror)
//   runner  runner ('giantBall' Marumi; 'river' with A6), length, speed (tiles), segments, gap, dmgMul, knockback,
//           allPaths, toSpawn, push, status
//   boost   (a status-only splash rider, A5: Kanna) splashArmor { radius, shred }, status
//
// `auto` (the per-girl Auto switch and the Auto-cast setting; both default Off):
//   { when: AUTO_WHEN, min?, orElite?, orCaster?, orVeiled?, orLeak? (a share of the path), reach? }
//   `min` counts enemies within the ability's reach (reachMul × her range, a rally's radius, the
//   whole map for map scope, `reach: 'leash'` = her drones' leash). Auto picks a decent moment,
//   not a perfect one. 'flyers': a flyer in the sky (map scope: anywhere), or ≥ min enemies;
//   'sabotage': a girl inside her rally's radius is sabotaged, or ≥ min enemies within it.

/**
 * Global rules (spec §3.2, §3.3). Skill Haste on abilities (half rate, never rallies or debuffs; GEAR_STATS §B.4,
 * owner 2026-10-15, #34) has ONE rule: src/sim/gearRules.js abilityChargePerTick, which the sim's chargeRate calls.
 */
export const ABILITY_RULES = Object.freeze({
  ticksPerSecond: 60, chargePerTick: 100, // a 40 s cooldown = 240,000 charge points
  initialShare: 3, // on unlock: cd = round(cdMax / 3) left to charge; econ starts empty (cd = cdMax)
  ccGuardTicks: 240, // a miniboss or boss ignores ability stuns and freezes for 4 s after one lands
  autoEvery: 6, // auto-cast checks a girl every 6th step, staggered by uid
  econCapPerWave: 2, // econ casts per player per wave, across every copy
  densestCap: 60, // candidates the densest-crowd scan looks at
  girlAimRadius: 0.6, // a girl-target ability picks the girl nearest its aim point within 0.6 tiles (spec §7.2)
});

export const ABILITY_KINDS = Object.freeze(['boost', 'rally', 'strike', 'burst', 'debuff', 'econ', 'deploy', 'move', 'zone', 'runner']);
export const ABILITY_SCOPES = Object.freeze(['local', 'map', 'player']);
export const AUTO_WHEN = Object.freeze(['enemies', 'elite', 'leak', 'veiled', 'caster', 'poisoned', 'ready', 'flyers', 'sabotage']);

/** Kinds this build runs (src/sim/abilities.js KINDS; tests/sim/abilities.test.js keeps the two equal). */
export const ABILITY_KINDS_RUN = Object.freeze(['strike', 'burst', 'boost', 'rally', 'debuff', 'econ']);
/** Deploy object types this build runs (src/sim/abilities.js DEPLOYS): Azami's strips, Yuzuha's sentries. */
export const ABILITY_DEPLOYS_RUN = Object.freeze(['sentries', 'strips']);
/** Runner types this build runs (src/sim/abilities.js RUNNERS): Marumi's giant ball. */
export const ABILITY_RUNNERS_RUN = Object.freeze(['giantBall']);

/**
 * THE live-ability rule: does this build run an ability entry (a button in battle), or is it a "Comes in a later
 * update" teaser? A kind in ABILITY_KINDS_RUN (a boost also needs its `effect.mods`: a boost with nothing to raise
 * has nothing to run), a deploy of a type in ABILITY_DEPLOYS_RUN or a runner of a type in ABILITY_RUNNERS_RUN. The
 * sim's handlerOf refuses exactly what this refuses (a test runs both over every row, tier 5 and rank); the ability
 * bar, the panel row, the girl page, the ⚡ tips (src/data/unitTips.js) and the gear fit table (GEAR_FIT in
 * src/data/gearStats.js) all read it. Works on a base entry and on a merged one (tier 5, a hero rank).
 * @param {object|null} entry an ability entry, a hero skill, or a merged definition
 */
export function abilityRuns(entry) {
  if (!entry || typeof entry !== 'object') return false;
  switch (entry.kind) {
    case 'deploy': return ABILITY_DEPLOYS_RUN.includes(entry.effect?.deploy);
    case 'runner': return ABILITY_RUNNERS_RUN.includes(entry.effect?.runner);
    case 'boost': return !!entry.effect?.mods;
    default: return ABILITY_KINDS_RUN.includes(entry.kind);
  }
}

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
  hold: (duration) => ({ type: 'hold', duration }),
  ground: (duration) => ({ type: 'ground', duration }),
  curse: (burstMul, radius, duration) => ({ type: 'curse', burstMul, radius, duration }),
  hex: (pct, duration) => ({ type: 'hex', pct, duration }),
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
  // the returning heroes (ABILITIES_SPEC §5.2; src/data/unitsExpansion.js)
  kanna: {
    skill: {
      // a boost on her strikes that needs a status-only splash rider (A5): no `mods`, so it stays the teaser
      unlockLevel: 7, id: 'kanna.heavyBeat', kind: 'boost', scope: 'local', cooldown: 30, duration: 6,
      effect: { splashArmor: { radius: 1.5, shred: 2 }, status: [S.stun(0.3)] },
      auto: { when: 'enemies', min: 4 },
      ranks: [{ level: 17, cooldown: 25, duration: 8, effect: { splashArmor: { radius: 1.5, shred: 3 } } }],
    },
  },
  yoriko: {
    skill: {
      // the strongest enemy within her range + 1 is hexed (1.5 % of its max HP a second; minibosses 1 %, bosses 0.5 %;
      // one hex takes at most 10 % of a miniboss's or boss's HP; src/sim/status.js) and slowed. A3 M3 balance (§11
      // bench at the stage's own HP): the spec's first pass (3 % for 8 s; Lv 17 10 s) added ×1.95 to her damage on
      // a boss at Lv 7; 1.5 % for 5 s (Lv 17: 2 targets for 6 s) keeps it under the ×1.35 gate
      unlockLevel: 7, id: 'yoriko.puppetHex', kind: 'debuff', scope: 'local', cooldown: 30, duration: 5,
      effect: { pick: 'strong', count: 1, reachAdd: 1, status: [S.hex(0.015, 5), S.slow(0.3, 5)] },
      auto: { when: 'enemies', min: 5, orElite: true },
      ranks: [{ level: 17, cooldown: 25, duration: 6, effect: { count: 2, status: [S.hex(0.015, 6), S.slow(0.3, 6)] } }],
    },
  },
  seiran: {
    skill: {
      // a thrown lance: the first enemy by her target mode in her range, then the nearest un-hit one within her
      // chain jump, `count` in all (ties: the lower uid); flyers it hits are grounded
      unlockLevel: 7, id: 'seiran.stormLance', kind: 'strike', scope: 'local', cooldown: 30, duration: 0,
      effect: { pick: 'chain', count: 8, dmgMul: 3, status: [S.ground(3)] },
      auto: { when: 'enemies', min: 4 },
      ranks: [{ level: 17, cooldown: 25, effect: { count: 12, dmgMul: 4 } }],
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
    // the dash is drawn only: her sim position never changes. On her crowd path (the AoE rework) she
    // flashes through several enemies; her focus stays on the first
    path: 'flowing', unlockTier: 3, id: 'kaede.flashLunge', kind: 'strike', scope: 'local', cooldown: 25, duration: 0,
    effect: { pick: 'mode', count: 3, reachMul: 2.5, hits: 2, dmgMul: 1, fullRamp: true, keepRamp: true },
    auto: { when: 'enemies', min: 3, orElite: true },
    t5: { cooldown: 20, effect: { count: 5, hits: 3 } },
  }],
  tenka: [{
    // a plasma blast on the strongest enemy in her range (every enemy within `splash` of it takes it too);
    // Zero Point: a far bigger blast, a faster recharge and her bolts ×2 as fast for 6 s after each cast
    path: 'rails', unlockTier: 3, id: 'tenka.criticalMass', kind: 'strike', scope: 'local', cooldown: 45, duration: 0,
    effect: { pick: 'strong', count: 1, reachMul: 1, dmgMul: 40, splash: 2, armorPen: 99 },
    auto: { when: 'elite' },
    t5: { cooldown: 30, effect: { dmgMul: 120, splash: 3, after: { mods: { rateMul: 2 }, duration: 6 } } },
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
  yuzuha: [{
    // extra sentries with her current sentry stats at the edge spots nearest her aim point or the lead
    // enemy in her range; they live `duration` beyond her cap (src/sim/sentries.js)
    path: 'ops', unlockTier: 3, id: 'yuzuha.emergencyDeploy', kind: 'deploy', scope: 'local', cooldown: 40, duration: 20,
    effect: { deploy: 'sentries', count: 3 },
    auto: { when: 'enemies', min: 5 },
    t5: { cooldown: 30, duration: 25, effect: { count: 6 } },
  }],
  ouka: [{
    // a map rally: every girl on the map, both players' (never Ouka herself); +pierce rides on t.buff
    path: 'assembly', unlockTier: 3, id: 'ouka.assemblyBell', kind: 'rally', scope: 'map', cooldown: 45, duration: 10,
    effect: { radius: 'map', rateMul: 1.3, pierceAdd: 1 },
    auto: { when: 'enemies', min: 10 },
    t5: { cooldown: 40, duration: 15, effect: { rateMul: 1.5, pierceAdd: 2 } },
  }],
  chigusa: [{
    // vines hold her lead walkers (never a boss or a flyer) and squeeze each once (src/sim/vines.js `hold`)
    path: 'greenhouse', unlockTier: 3, id: 'chigusa.overgrowth', kind: 'debuff', scope: 'local', cooldown: 35, duration: 3,
    effect: { pick: 'ground', count: 8, dmgMul: 5, status: [S.hold(3)] },
    auto: { when: 'enemies', min: 6 },
    t5: { cooldown: 30, duration: 4, effect: { count: 16, reachMul: 2, dmgMul: 8, status: [S.hold(4)] } },
  }],
  marumi: [{
    // a giant ball rolls back up her nearest lane from the road point nearest the exit in her range,
    // hitting every walker once (a runner, src/sim/runners.js); Turkey Strike: every lane, to the spawn
    path: 'lane', unlockTier: 3, id: 'marumi.giantStrike', kind: 'runner', scope: 'local', cooldown: 40, duration: 2,
    effect: { runner: 'giantBall', length: 12, speed: 6, segments: 3, gap: 0.5, dmgMul: 8, knockback: 0.6 },
    auto: { when: 'enemies', min: 6 },
    t5: { cooldown: 30, effect: { allPaths: true, toSpawn: true, dmgMul: 12 } },
  }],

  // ----- the returning girls (ABILITIES_SPEC §5.2; src/data/unitsExpansion.js) -----
  fuu: [{
    // (the move kind, A5) every non-boss enemy within 1.5× her range is blown back (minibosses half as far; the
    // push lock applies) and flyers are grounded
    path: 'gale', unlockTier: 3, id: 'fuu.backdraft', kind: 'move', scope: 'local', cooldown: 40, duration: 0,
    effect: { reachMul: 1.5, push: 2, pushMiniboss: 1, status: [S.ground(2)] },
    auto: { when: 'enemies', min: 5 },
    t5: { cooldown: 32, effect: { push: 3, status: [S.ground(3)] } },
  }],
  hana: [{
    // Kaze dives on the flyers still in the sky anywhere on the map, in Priority order; with none up, on the
    // strongest walkers instead (`fallback`); the flyers he hits are grounded
    path: 'falconry', unlockTier: 3, id: 'hana.swoop', kind: 'strike', scope: 'map', cooldown: 30, duration: 0,
    effect: { pick: 'air', count: 4, reach: 'map', dmgMul: 6, status: [S.ground(4)], fallback: { pick: 'strong', count: 2, ground: true } },
    auto: { when: 'flyers', min: 6 },
    t5: { cooldown: 25, effect: { count: 8, dmgMul: 8 } },
  }],
  // Ruri: one ability per familiar path (only one path can pass tier 2, so she learns the one she raises)
  ruri: [
    {
      // Kon leaps from his spot (her relay origin) at the strongest enemy within her range + 2: `hits` bites, then
      // holds it (walkers only; never a boss)
      path: 'hound', unlockTier: 3, id: 'ruri.moonPounce', kind: 'strike', scope: 'local', cooldown: 30, duration: 0,
      effect: { pick: 'strong', count: 1, reachAdd: 2, fromOrigin: true, hits: 3, dmgMul: 8, status: [S.hold(1.5)], noBossStatus: true },
      auto: { when: 'enemies', min: 4, orElite: true },
      t5: { cooldown: 25, effect: { hits: 5, status: [S.hold(2)] } },
    },
    {
      // (the move kind, A5) Kon carries the leading non-boss enemy back up the road
      path: 'falcon', unlockTier: 3, id: 'ruri.starSnatch', kind: 'move', scope: 'local', cooldown: 35, duration: 0,
      effect: { pick: 'first', count: 1, carry: 3, carryMiniboss: 1.5 },
      auto: { when: 'leak', min: 0.7 },
      t5: { cooldown: 30, effect: { count: 2, carry: 5 } },
    },
    {
      // (a runner, A6) a wave rolls back along her lane, pushing and soaking
      path: 'otter', unlockTier: 3, id: 'ruri.riverRush', kind: 'runner', scope: 'local', cooldown: 40, duration: 0,
      effect: { runner: 'river', length: 4, push: 1, status: [S.soak(4)] },
      auto: { when: 'enemies', min: 5 },
      t5: { cooldown: 32, effect: { length: 8, push: 1.5 } },
    },
  ],
  noa: [{
    // girls within 4 tiles are cleansed and warded (no sabotage, no volatile stun) while it lasts; meanwhile every
    // 10 kills within 3 tiles of her restore a life, at most 3 a cast (src/sim/abilities.js abilityKill)
    path: 'sanctuary', unlockTier: 3, id: 'noa.firstAid', kind: 'rally', scope: 'local', cooldown: 50, duration: 10,
    effect: { radius: 4, cleanse: true, ward: true, stunImmune: true, lifeEvery: 10, lifeRadius: 3, lifeMax: 3 },
    auto: { when: 'sabotage', min: 6 },
    t5: { cooldown: 42, duration: 14, effect: { lifeMax: 5 } },
  }],
  iroha: [{
    // (an aimed deploy and the mirror redirect, A6) her mirror panel jumps to the aim point (or the road spot nearest
    // the leader in her reach) and splits every ally projectile that crosses it, once each, while it lasts
    path: 'hall', unlockTier: 3, id: 'iroha.mirrorShift', kind: 'deploy', scope: 'local', cooldown: 30, duration: 8,
    effect: { deploy: 'mirror', count: 1, reflect: true },
    auto: { when: 'enemies', min: 5 },
    t5: { cooldown: 25, duration: 10, effect: { count: 2, permanentReflect: true } },
  }],
  ena: [{
    // every enemy within 1.5× her range is cursed: it bursts for 3× her current hit when it falls (the curse queue
    // and its per-step burst budget, src/sim/Sim.js _flushCurses), so a dense wave chain-reacts
    path: 'bloom', unlockTier: 3, id: 'ena.omenCard', kind: 'debuff', scope: 'local', cooldown: 40, duration: 0,
    effect: { reachMul: 1.5, status: [S.curse(3, 1.6, 6)] },
    auto: { when: 'enemies', min: 6 },
    t5: { cooldown: 32, effect: { reachMul: 2, status: [S.curse(4, 1.6, 6)] } },
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
