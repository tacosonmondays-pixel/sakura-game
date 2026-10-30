// Ability data (src/data/abilities.js numbers, src/data/abilityText.js words; ABILITIES_SPEC §5.1, §6,
// §13): one ⚡ path per tower that unlocks at tier 3 and upgrades at tier 5, one Lv 7 skill per hero
// that ranks up at Lv 17, the shared vocabulary, cooldowns and durations in whole ticks, a text row
// for every ability whose templates fill completely, names that clash with nothing, our own words
// only, a ⚡ tip per girl, and the attach hook. The sim reads it in one place, src/sim/abilities.js (A1).
import { POWER } from '../../src/data/balance.js';
import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  ABILITY_RULES, ABILITY_KINDS, ABILITY_SCOPES, AUTO_WHEN, ABILITIES, ABILITY_KINDS_RUN, ABILITY_DEPLOYS_RUN, ABILITY_MOVES_RUN,
  abilityRow, attachAbilities, mergeAbility, abilityAtTier, skillAtLevel, abilityRuns, abilityWithLr,
} from '../../src/data/abilities.js';
import { ABILITY_CHARGE_BASE, abilityChargePerTick, NOT_HASTED_KINDS } from '../../src/sim/gearRules.js';
import {
  ABILITY_TEXT, ABILITY_COPY, ABILITY_AIMS, abilityText, abilityValues, fillAbilityText, abilityUnlockLine, abilityUpgradeLine,
} from '../../src/data/abilityText.js';
import { UNITS as ALL_UNITS, UNIT_MAP, towers as allTowers, heroes as allHeroes } from '../../src/data/units.js';
import { POTENTIAL_GIRLS } from '../../src/data/potential.js';
import { ENEMIES } from '../../src/data/enemies.js';
import { STAGES } from '../../src/data/stages.js';
import { BATTLE_MODES } from '../../src/data/modes.js';
import { STATUSES } from '../../src/data/types.js';
import { NEW_GIRL_IDS } from '../../src/data/unitsNewGirls.js';
import * as EXPANSION from '../../src/data/unitsExpansion.js';
import { GLYPHS } from '../../src/art/icons/glyphs.js';
import { resolveStats } from '../../src/sim/mods.js';

const { EXPANSION_IDS } = EXPANSION;
// The girls this table covers: every girl with a row in ABILITIES — every girl in the game since the returning girls'
// rows moved in from the old RETURNING_ABILITIES table (A3 M3).
const UNITS = ALL_UNITS.filter((u) => !!abilityRow(u));
const towers = () => allTowers().filter((u) => !!abilityRow(u));
const heroes = () => allHeroes().filter((u) => !!abilityRow(u));
/** Every ⚡ entry of a tower, in path order (Ruri has one per familiar path). */
const entriesOf = (u) => (u.kind === 'hero' ? [u.hero.skill] : u.paths.filter((p) => p.ability).map((p) => p.ability));

const ROOT = join(import.meta.dirname, '../..');

// ABILITIES_SPEC §5.1: the ⚡ path of each live tower and her tier-3 coins (placement + tiers 1–3)
const LIGHTNING = {
  aoi: ['volley', 1140], rei: ['whirlwind', 1400], yuki: ['deepfreeze', 1250], momo: ['orchard', 1900],
  akane: ['bigbang', 1940], sango: ['frag', 2000], kage: ['steel', 1860], umeko: ['lighthouse', 1750],
  shiro: ['execution', 2290], midori: ['toxicology', 1800], suzu: ['mines', 1800], raika: ['rhythm', 1780],
  miko: ['blessing', 2010], hotaru: ['prayer', 2240], kaede: ['flowing', 2170], chika: ['sentry', 2390],
  // §5.3 the new girls: Tenka's Rail Arms, T3 Plasma Rails (5,150)
  tenka: ['rails', 5150],
  // §5.3 the new girls (UNIT_GAPS §5)
  azami: ['checkpoint', 1430], kinu: ['bobbin', 1520], wakaba: ['plan', 1550], yuzuha: ['ops', 1790], ouka: ['assembly', 2090], chigusa: ['greenhouse', 1970], marumi: ['lane', 1910],
  // §5.2 the returning girls (Ruri: her first ⚡ path; Star Falcon 1,700 and Tide Otter 1,860 below)
  fuu: ['gale', 1290], hana: ['falconry', 1280], ruri: ['hound', 1780], noa: ['sanctuary', 1730], iroha: ['hall', 2320], ena: ['bloom', 2170],
  // the duo (DUO_LR §1.4: 850 + 160 + 400 + 1,350)
  kohaku_tsubaki: ['refraction', 2760],
};
// Ruri's three familiar paths, each with its own ability (§3.1: data may declare one on several paths)
const RURI_PATHS = { hound: ['ruri.moonPounce', 1780], falcon: ['ruri.starSnatch', 1700], otter: ['ruri.riverRush', 1860] };
// §5.1 "Mix of kinds across the 16"
const KIND_OF = {
  aoi: 'strike', shiro: 'strike', midori: 'strike', kaede: 'strike',
  yuki: 'burst', akane: 'burst', sango: 'burst',
  kage: 'deploy', suzu: 'deploy', chika: 'deploy',
  rei: 'boost', raika: 'boost',
  umeko: 'debuff', hotaru: 'debuff',
  miko: 'rally',
  momo: 'econ',
  tenka: 'strike', // §5.3
  azami: 'deploy', kinu: 'boost', wakaba: 'rally', yuzuha: 'deploy', ouka: 'rally', chigusa: 'debuff', marumi: 'runner',
  // §5.2 the returning girls (each one's first ⚡ entry; Ruri's is Moon Pounce)
  fuu: 'move', hana: 'strike', ruri: 'strike', noa: 'rally', iroha: 'deploy', ena: 'debuff',
  kohaku_tsubaki: 'burst', // DUO_LR §1.4
};
// the girls of §5.3 and §5.2 (not part of §5.1's live mix)
const NEW_GIRLS = ['tenka', ...NEW_GIRL_IDS, ...EXPANSION_IDS, 'kohaku_tsubaki'];
const HERO_SKILL = {
  hikari: ['Morning Rally', 'rally'], luna: ['Moonbrand', 'debuff'], nami: ['Frost Net', 'burst'],
  // §5.2 the returning heroes
  kanna: ['Heavy Beat', 'boost'], yoriko: ['Puppet Hex', 'debuff'], seiran: ['Storm Lance', 'strike'],
  // BANNERS §D the staff heroes
  kogane: ['Pod Salvo', 'strike'], norika: ['Whistle Stop', 'strike'],
};
// a girl whose data may put her ability on several paths (the crosspath rule still lets only one unlock)
const MULTI_PATH = { ruri: 3 };

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
const ground = (duration) => ({ type: 'ground', duration });
const hold = (duration) => ({ type: 'hold', duration });
const curse = (burstMul, radius, duration, rot) => ({ type: 'curse', burstMul, radius, duration, rot });
const hex = (pct, duration) => ({ type: 'hex', pct, duration });
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
    effect: { pick: 'mode', count: 3, reachMul: 2.5, hits: 2, dmgMul: 1, fullRamp: true, keepRamp: true },
    auto: { when: 'enemies', min: 3, orElite: true },
    t5: { cooldown: 20, effect: { count: 5, hits: 3 } },
  },
  chika: {
    path: 'sentry', id: 'chika.droneSurge', kind: 'deploy', scope: 'local', cooldown: 45, duration: 12,
    effect: { deploy: 'drone', count: 4 },
    auto: { when: 'enemies', min: 5, reach: 'leash' },
    t5: { cooldown: 40, duration: 15, effect: { count: 8 } },
  },
  // §5.3 + BUILD_PLAN 6.1: a strike with a boost tail at tier 5 (Zero Point); the LR form Event Horizon (BANNERS §C.2):
  // a 1.5 s pull (1.6 tiles a second) on the blast's area, then a second detonation for 50% of the first
  tenka: {
    path: 'rails', id: 'tenka.criticalMass', kind: 'strike', scope: 'local', cooldown: 45, duration: 0,
    effect: { pick: 'strong', count: 1, reachMul: 1, dmgMul: 40, splash: 2, armorPen: 99 },
    auto: { when: 'elite' },
    t5: { cooldown: 30, effect: { dmgMul: 120, splash: 3, after: { mods: { rateMul: 2 }, duration: 6 } } },
    lr: { effect: { horizon: { time: 1.5, pull: 1.6, share: 0.5 } } },
  },
  // §5.3 the new girls
  azami: {
    path: 'checkpoint', id: 'azami.spikeRain', kind: 'deploy', scope: 'local', cooldown: 45, duration: 10,
    effect: { deploy: 'strips', count: 12, hits: 8, arm: 0.3, reachMul: 1 },
    auto: { when: 'enemies', min: 6 },
    t5: { cooldown: 35, duration: 15, effect: { count: 24, reachMul: 2 } },
  },
  kinu: {
    path: 'bobbin', id: 'kinu.bladeSpiral', kind: 'boost', scope: 'local', cooldown: 25, duration: 4,
    effect: { mods: { ring: { spiral: 1, spiralPierce: 3 } } },
    auto: { when: 'enemies', min: 4 },
    t5: { cooldown: 20, duration: 6, effect: { mods: { ring: { spiral: 2, spiralPierce: 8 } } } },
  },
  wakaba: {
    path: 'plan', id: 'wakaba.timeOut', kind: 'rally', scope: 'local', cooldown: 45, duration: 12,
    effect: { target: 'girl', rateMul: 1.8, rangeMul: 1.2 },
    auto: { when: 'enemies', min: 6 },
    t5: { cooldown: 35, duration: 15, effect: { dmgMul: 1.4 } },
  },
  yuzuha: {
    path: 'ops', id: 'yuzuha.emergencyDeploy', kind: 'deploy', scope: 'local', cooldown: 40, duration: 20,
    effect: { deploy: 'sentries', count: 3 },
    auto: { when: 'enemies', min: 5 },
    t5: { cooldown: 30, duration: 25, effect: { count: 6 } },
  },
  ouka: {
    path: 'assembly', id: 'ouka.assemblyBell', kind: 'rally', scope: 'map', cooldown: 45, duration: 10,
    effect: { radius: 'map', rateMul: 1.3, pierceAdd: 1 },
    auto: { when: 'enemies', min: 10 },
    t5: { cooldown: 40, duration: 15, effect: { rateMul: 1.5, pierceAdd: 2 } },
  },
  chigusa: {
    path: 'greenhouse', id: 'chigusa.overgrowth', kind: 'debuff', scope: 'local', cooldown: 35, duration: 3,
    effect: { pick: 'ground', count: 8, dmgMul: 5, status: [{ type: 'hold', duration: 3 }] },
    auto: { when: 'enemies', min: 6 },
    t5: { cooldown: 30, duration: 4, effect: { count: 16, reachMul: 2, dmgMul: 8, status: [{ type: 'hold', duration: 4 }] } },
  },
  marumi: {
    path: 'lane', id: 'marumi.giantStrike', kind: 'runner', scope: 'local', cooldown: 40, duration: 2,
    effect: { runner: 'giantBall', length: 12, speed: 6, segments: 3, gap: 0.5, dmgMul: 8, knockback: 0.6 },
    auto: { when: 'enemies', min: 6 },
    t5: { cooldown: 30, effect: { allPaths: true, toSpawn: true, dmgMul: 12 } },
  },
  // §5.2 the returning girls (A3 M3: moved here from RETURNING_ABILITIES; numbers only). Auto rules marked
  // "(not in the spec)" are M3's: the spec gives none, or one this vocabulary lacks.
  fuu: {
    // (a move of type 'push': it runs)
    path: 'gale', id: 'fuu.backdraft', kind: 'move', scope: 'local', cooldown: 40, duration: 0,
    effect: { move: 'push', reachMul: 1.5, push: 2, pushMiniboss: 1, status: [ground(2)] },
    auto: { when: 'enemies', min: 5 },
    t5: { cooldown: 32, effect: { push: 3, status: [ground(3)] } },
  },
  hana: {
    path: 'falconry', id: 'hana.swoop', kind: 'strike', scope: 'map', cooldown: 30, duration: 0,
    effect: { pick: 'air', count: 4, reach: 'map', dmgMul: 6, status: [ground(4)], fallback: { pick: 'strong', count: 2, ground: true } },
    auto: { when: 'flyers', min: 6 }, // (min 6 not in the spec: "a flyer on the map, or ≥ min enemies")
    t5: { cooldown: 25, effect: { count: 8, dmgMul: 8 } },
  },
  ruri: [
    {
      path: 'hound', id: 'ruri.moonPounce', kind: 'strike', scope: 'local', cooldown: 30, duration: 0,
      effect: { pick: 'strong', count: 1, reachAdd: 2, fromOrigin: true, hits: 3, dmgMul: 8, status: [hold(1.5)], noBossStatus: true },
      auto: { when: 'enemies', min: 4, orElite: true }, // (not in the spec)
      t5: { cooldown: 25, effect: { hits: 5, status: [hold(2)] } },
    },
    {
      // (a move of type 'carry': it waits)
      path: 'falcon', id: 'ruri.starSnatch', kind: 'move', scope: 'local', cooldown: 35, duration: 0,
      effect: { move: 'carry', pick: 'first', count: 1, carry: 3, carryMiniboss: 1.5 },
      auto: { when: 'leak', min: 0.7 }, // (not in the spec: past 70% of the path)
      t5: { cooldown: 30, effect: { count: 2, carry: 5 } },
    },
    {
      // (a runner of type 'river': A6)
      path: 'otter', id: 'ruri.riverRush', kind: 'runner', scope: 'local', cooldown: 40, duration: 0,
      effect: { runner: 'river', length: 4, push: 1, status: [soak(4)] },
      auto: { when: 'enemies', min: 5 },
      t5: { cooldown: 32, effect: { length: 8, push: 1.5 } },
    },
  ],
  noa: {
    path: 'sanctuary', id: 'noa.firstAid', kind: 'rally', scope: 'local', cooldown: 50, duration: 10,
    effect: { radius: 4, cleanse: true, ward: true, stunImmune: true, lifeEvery: 10, lifeRadius: 3, lifeMax: 3 },
    auto: { when: 'sabotage', min: 6 }, // (min 6 not in the spec)
    t5: { cooldown: 42, duration: 14, effect: { lifeMax: 5 } },
  },
  iroha: {
    // (an aimed deploy with the mirror redirect: A6)
    path: 'hall', id: 'iroha.mirrorShift', kind: 'deploy', scope: 'local', cooldown: 30, duration: 8,
    effect: { deploy: 'mirror', count: 1, reflect: true },
    auto: { when: 'enemies', min: 5 },
    t5: { cooldown: 25, duration: 10, effect: { count: 2, permanentReflect: true } },
  },
  ena: {
    path: 'bloom', id: 'ena.omenCard', kind: 'debuff', scope: 'local', cooldown: 40, duration: 0,
    effect: { reachMul: 1.5, status: [curse(3, 1.6, 6, 0.6)] },
    auto: { when: 'enemies', min: 6 },
    t5: { cooldown: 32, effect: { reachMul: 2, status: [curse(4, 1.6, 6, 0.8)] } },
  },
  // the duo (DUO_LR §1.4): 8 shells over 2 s (12 at tier 5), 3× (4×) her shell hit, splash 1.15, 2 (3) shards of 1×
  // at splash 0.6, Brittle +10% (+15%) for 4 s, 45 s (38 s); the LR form adds a 6× Twin Star, splash 1.6
  kohaku_tsubaki: {
    path: 'refraction', id: 'kohaku_tsubaki.prismfall', kind: 'burst', scope: 'map', cooldown: 45, duration: 2.25,
    effect: {
      at: 'aim', radius: 1.15, shells: 8, delay: 0.25, every: 0.25, dmgMul: 3, hitsAir: false,
      shards: 2, shardMul: 1, shardRadius: 0.6, status: [{ type: 'vulnerable', bonus: 0.1, duration: 4 }],
    },
    auto: { when: 'cluster', min: 6, radius: 1.5, orBoss: true },
    t5: { cooldown: 38, duration: 3.25, effect: { shells: 12, dmgMul: 4, shards: 3, status: [{ type: 'vulnerable', bonus: 0.15, duration: 4 }] } },
    lr: { effect: { finale: { dmgMul: 6, radius: 1.6 } } },
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
  // §5.2 the returning heroes: the old ranks' cooldownMul / durationAdd written as absolute values
  kanna: {
    // (a status-only splash rider: A5, so no button yet; auto not in the spec)
    id: 'kanna.heavyBeat', kind: 'boost', scope: 'local', cooldown: 30, duration: 6,
    effect: { splashArmor: { radius: 1.5, shred: 2 }, status: [stun(0.3)] },
    auto: { when: 'enemies', min: 4 },
    ranks: [{ level: 17, cooldown: 25, duration: 8, effect: { splashArmor: { radius: 1.5, shred: 3 } } }],
  },
  yoriko: {
    // A3 M3 balance (the §11 bench at the stage's own HP; M3.md): the spec's 3 %/s for 8 s (Lv 17: 10 s) became
    // 1.5 %/s for 5 s (Lv 17: 6 s), under the ×1.35 gate on a boss
    id: 'yoriko.puppetHex', kind: 'debuff', scope: 'local', cooldown: 30, duration: 5,
    effect: { pick: 'strong', count: 1, reachAdd: 1, status: [hex(0.015, 5), slow(0.3, 5)] },
    auto: { when: 'enemies', min: 5, orElite: true }, // (not in the spec)
    ranks: [{ level: 17, cooldown: 25, duration: 6, effect: { count: 2, status: [hex(0.015, 6), slow(0.3, 6)] } }],
  },
  seiran: {
    id: 'seiran.stormLance', kind: 'strike', scope: 'local', cooldown: 30, duration: 0,
    effect: { pick: 'chain', count: 8, dmgMul: 3, status: [ground(3)] },
    auto: { when: 'enemies', min: 4 }, // (not in the spec)
    ranks: [{ level: 17, cooldown: 25, effect: { count: 12, dmgMul: 4 } }],
  },
  // BANNERS §D.3, §D.4: the staff heroes (auto rules: ours, not the spec's)
  kogane: {
    id: 'kogane.podSalvo', kind: 'strike', scope: 'local', cooldown: 28, duration: 0,
    effect: { pick: 'strong', count: 4, reachMul: 1.3, dmgMul: 4, splash: 0.4, armorPen: 3 },
    auto: { when: 'enemies', min: 4, orElite: true },
    ranks: [{ level: 17, cooldown: 24, effect: { count: 6, dmgMul: 5 } }],
  },
  norika: {
    // (ground only: hitsAir false; minibosses hold half as long and bosses not at all, the `hold` status's own rule)
    id: 'norika.whistleStop', kind: 'strike', scope: 'local', cooldown: 26, duration: 0,
    effect: { pick: 'mode', count: 5, reachMul: 1.3, dmgMul: 3, hitsAir: false, status: [{ type: 'hold', duration: 1.2 }] },
    auto: { when: 'enemies', min: 5, orElite: true },
    ranks: [{ level: 17, cooldown: 22, effect: { count: 8, dmgMul: 4, status: [{ type: 'hold', duration: 1.6 }] } }],
  },
};

/** The spec's upgrade column applied to its base row: named values replace, the rest carry over. */
function specUpgraded(base, { level, effect = {}, ...scalars }) {
  return { ...base, ...scalars, effect: { ...base.effect, ...effect } };
}

// The effect fields each kind may use (a typo in the data fails here, not silently in the sim).
const STATUS_LIST = ['status'];
const EFFECT_KEYS = {
  strike: ['pick', 'count', 'reachMul', 'reach', 'dmgMul', 'hits', 'fullRamp', 'keepRamp', 'delay', 'armorPen', 'poisonMul', 'splash', 'splashShare', 'spreadPoison', 'after',
    // (A3 M3: Kaze's Swoop's fallback pick, Moon Pounce's reach on top of her range from Kon's spot and its hold bosses shrug off)
    'fallback', 'reachAdd', 'fromOrigin', 'noBossStatus',
    // (Whistle Stop: ground only; Critical Mass · Event Horizon, the LR form)
    'hitsAir', 'horizon', ...STATUS_LIST],
  burst: ['at', 'reachMul', 'radius', 'radiusMul', 'shells', 'delay', 'every', 'reaim', 'dmgMul', 'knockback', 'hitsAir', ...STATUS_LIST,
    // (Prismfall: its shards and the LR Twin Star)
    'shards', 'shardMul', 'shardRadius', 'finale'],
  // (Kanna's Heavy Beat, a teaser until A5: a status-only splash rider instead of a ModSet)
  boost: ['mods', 'splashArmor', ...STATUS_LIST],
  // (Noa's First Aid Call: the stun half of the ward, and lives from kills near her)
  rally: ['radius', 'inAura', 'dmgMul', 'rateMul', 'rangeMul', 'detection', 'cleanse', 'ward', 'target', 'pierceAdd', 'stunImmune', 'lifeEvery', 'lifeRadius', 'lifeMax'],
  debuff: ['pick', 'count', 'casterStatus', 'rally', 'dmgMul', 'reachMul', 'reachAdd', ...STATUS_LIST],
  econ: ['coins'],
  deploy: ['deploy', 'count', 'spacing', 'dmgMul', 'arm', 'hits', 'reachMul', 'reflect', 'permanentReflect'],
  // (Marumi's Giant Strike: a runner type, its length and speed in tiles, body segments, push; Ruri's River Rush)
  runner: ['runner', 'length', 'speed', 'segments', 'gap', 'dmgMul', 'knockback', 'allPaths', 'toSpawn', 'push', ...STATUS_LIST],
  // (A5: Fuu's Backdraft Fan, Ruri's Star Snatch)
  move: ['move', 'reachMul', 'reachAdd', 'push', 'pushMiniboss', 'pick', 'count', 'carry', 'carryMiniboss', ...STATUS_LIST],
};
const PICKS = { strike: ['mode', 'strong', 'priority', 'poisoned', 'air', 'chain'], debuff: ['all', 'veiled', 'strong', 'ground'], move: ['first'] };
const AUTO_KEYS = ['when', 'min', 'orElite', 'orCaster', 'orVeiled', 'orLeak', 'reach',
  // ('cluster': Prismfall's spot radius and its boss rider)
  'radius', 'orBoss'];
// the ModSet keys a boost may change (src/sim/mods.js applyModSet; CONTRACTS §3)
const BOOST_MOD_KEYS = ['damage', 'damageMul', 'rateMul', 'range', 'projectiles', 'pierce', 'chain', 'maxTargets', 'splash', 'armorPen', 'status', 'crit',
  // the new girls: Kinu's Blade Spiral rides on her ring (src/sim/rings.js)
  'ring'];
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
  // every ⚡ entry (Ruri: one per familiar path), each at tier 3 and tier 5 of its own path
  return entriesOf(u).flatMap((a) => [[`${u.id} ${a.path} T3`, abilityAtTier(a, 3), resolveStats(u, { tiers: tiersAt(u, a.path, 3) })],
    [`${u.id} ${a.path} T5`, abilityAtTier(a, 5), resolveStats(u, { tiers: tiersAt(u, a.path, 5) })]]);
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
  // (a move names its type: 'push' runs, 'carry' waits; src/sim/abilities.js MOVES)
  if (d.kind === 'move' && !['push', 'carry'].includes(e.move)) errs.push(`${where}: move type ${e.move}`);
  for (const k of ['count', 'shells', 'hits']) if (k in e && !(Number.isInteger(e[k]) && e[k] > 0)) errs.push(`${where}: ${k} must be a whole number > 0`);
  // (a rally's radius may be 'map': every girl on the map, Ouka's Assembly Bell)
  for (const k of ['reachMul', 'reachAdd', ...(e.radius === 'map' ? [] : ['radius']), 'radiusMul', 'dmgMul', 'poisonMul', 'splash', 'spacing', 'coins', 'lifeRadius', 'push', 'pushMiniboss', 'carry', 'carryMiniboss', 'length']) if (k in e && !(e[k] > 0)) errs.push(`${where}: ${k} must be > 0`);
  for (const k of ['lifeEvery', 'lifeMax']) if (k in e && !(Number.isInteger(e[k]) && e[k] > 0)) errs.push(`${where}: ${k} must be a whole number > 0`);
  if ('lifeEvery' in e && !(e.lifeRadius > 0 && 'lifeMax' in e)) errs.push(`${where}: lives need a radius and a cap`);
  if ('reach' in e && e.reach !== 'map') errs.push(`${where}: reach is 'map' or a reachMul`);
  if ('reachMul' in e && 'reachAdd' in e) errs.push(`${where}: a reachMul or a reachAdd, not both`);
  for (const k of ['fromOrigin', 'noBossStatus', 'stunImmune', 'reflect', 'permanentReflect']) if (k in e && e[k] !== true) errs.push(`${where}: ${k} is true or absent`);
  if (e.fallback) {
    // Kaze's Swoop with no flyer up: another strike pick, a whole count, ground-only or not
    const f = e.fallback;
    for (const k of Object.keys(f)) if (!['pick', 'count', 'ground'].includes(k)) errs.push(`${where}: fallback key ${k}`);
    if (!PICKS.strike.includes(f.pick) || f.pick === 'air' || f.pick === 'chain') errs.push(`${where}: fallback pick ${f.pick}`);
    if (!(Number.isInteger(f.count) && f.count > 0)) errs.push(`${where}: fallback count must be a whole number > 0`);
    if ('ground' in f && typeof f.ground !== 'boolean') errs.push(`${where}: fallback ground is a boolean`);
    if (e.pick !== 'air') errs.push(`${where}: only an air pick falls back`);
  }
  if (e.splashArmor) {
    for (const k of Object.keys(e.splashArmor)) if (!['radius', 'shred'].includes(k) || !(e.splashArmor[k] > 0)) errs.push(`${where}: splashArmor ${k}`);
  }
  if (e.status) errs.push(...statusErrors(e.status, `${where}.status`));
  if (e.casterStatus) errs.push(...statusErrors(e.casterStatus, `${where}.casterStatus`));
  if (d.kind === 'boost') {
    for (const k of Object.keys(e.mods || {})) if (!BOOST_MOD_KEYS.includes(k)) errs.push(`${where}: boost mod ${k}`);
    if (e.mods?.status) errs.push(...statusErrors(e.mods.status, `${where}.mods.status`));
    if (!(d.duration > 0)) errs.push(`${where}: a boost lasts > 0 s`);
  }
  if (d.kind === 'rally') {
    // a rally on one girl (target 'girl': the girl-target rule, spec §7.2) has no radius; a map rally reaches every girl
    if (!(e.radius > 0) && e.radius !== 'map' && e.inAura !== true && e.target !== 'girl') errs.push(`${where}: a rally needs a radius`);
    if (e.radius === 'map' && d.scope !== 'map') errs.push(`${where}: a map rally is map scope`);
    if ('pierceAdd' in e && !(Number.isInteger(e.pierceAdd) && e.pierceAdd > 0)) errs.push(`${where}: pierceAdd must be a whole number > 0`);
    if (e.target != null && e.target !== 'girl') errs.push(`${where}: rally target ${e.target}`);
    if (!(d.duration > 0)) errs.push(`${where}: a rally lasts > 0 s`);
  }
  if (e.rally) {
    for (const k of Object.keys(e.rally)) if (!EFFECT_KEYS.rally.includes(k) || k === 'target') errs.push(`${where}: rally rider key ${k}`);
    if (!(d.duration > 0)) errs.push(`${where}: a rally rider lasts > 0 s`);
  }
  for (const k of ['dmgMul', 'rateMul', 'rangeMul']) {
    for (const src of [d.kind === 'rally' ? e : null, e.rally].filter(Boolean)) if (k in src && !(src[k] > 1)) errs.push(`${where}: rally ${k} > 1`);
  }
  if (e.after) {
    // a strike's boost tail: a boost ModSet for `duration` s after each cast, shorter than the recharge
    for (const k of Object.keys(e.after)) if (!['mods', 'duration'].includes(k)) errs.push(`${where}: after key ${k}`);
    for (const k of Object.keys(e.after.mods || {})) if (!BOOST_MOD_KEYS.includes(k)) errs.push(`${where}: after mod ${k}`);
    if (!e.after.mods || !Object.keys(e.after.mods).length) errs.push(`${where}: after needs mods`);
    if (e.after.mods?.status) errs.push(...statusErrors(e.after.mods.status, `${where}.after.mods.status`));
    if (!(e.after.duration > 0) || !isWholeTicks(e.after.duration)) errs.push(`${where}: after.duration must be > 0 whole ticks`);
    if (!(e.after.duration < d.cooldown)) errs.push(`${where}: after.duration must be shorter than the cooldown`);
  }
  if ('splashShare' in e && !(e.splashShare > 0 && e.splashShare <= 1)) errs.push(`${where}: splashShare in (0, 1]`);
  if (d.kind === 'burst' && !e.at) errs.push(`${where}: a burst needs a point (at)`);
  if ('shards' in e && !(Number.isInteger(e.shards) && e.shards > 0 && e.shardMul > 0 && e.shardRadius > 0)) errs.push(`${where}: shards need a whole count, a share and a radius`);
  if (e.finale) {
    for (const k of Object.keys(e.finale)) if (!['dmgMul', 'radius'].includes(k) || !(e.finale[k] > 0)) errs.push(`${where}: finale ${k}`);
    if (d.duration < (e.delay ?? 0) + (e.shells ?? 1) * (e.every ?? 0) - 1e-9) errs.push(`${where}: duration ${d.duration}s ends before the finale`);
  }
  if (e.horizon) {
    // (the LR Event Horizon: a pull of whole ticks on a blast's area, then a share of its hit again)
    for (const k of Object.keys(e.horizon)) if (!['time', 'pull', 'share'].includes(k)) errs.push(`${where}: horizon ${k}`);
    if (!(e.horizon.time > 0) || !isWholeTicks(e.horizon.time)) errs.push(`${where}: horizon.time must be > 0 whole ticks`);
    if (!(e.horizon.pull >= 0) || !(e.horizon.share > 0 && e.horizon.share <= 1)) errs.push(`${where}: horizon pull >= 0, share in (0, 1]`);
    if (!(e.splash > 0)) errs.push(`${where}: a horizon needs a blast (splash)`);
  }
  if (d.kind === 'burst' && !(e.radius > 0) && !(e.radiusMul > 0)) errs.push(`${where}: a burst needs a radius`);
  // a multi-shell burst lasts until its last shell lands
  if ((e.shells ?? 1) > 1) {
    if (!(e.every > 0)) errs.push(`${where}: shells need an interval`);
    if (d.duration < (e.delay ?? 0) + (e.shells - 1) * e.every - 1e-9) errs.push(`${where}: duration ${d.duration}s ends before the last shell`);
  }
  if (d.kind === 'econ' && d.scope !== 'player') errs.push(`${where}: econ abilities are per player`);
  if (d.kind === 'deploy' && !['double', 'trap', 'drone', 'strips', 'sentries', 'mirror'].includes(e.deploy)) errs.push(`${where}: deploy ${e.deploy}`);
  if (d.kind === 'runner' && !['giantBall', 'river'].includes(e.runner)) errs.push(`${where}: runner ${e.runner}`);
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
  test('rules (spec §3.2, §6.1; Skill Haste at half rate has one rule, src/sim/gearRules.js, GEAR_STATS §B.4)', () => {
    expect(ABILITY_RULES).toEqual({
      ticksPerSecond: 60, chargePerTick: 100, initialShare: 3, ccGuardTicks: 240, autoEvery: 6, econCapPerWave: 2,
      densestCap: 60, girlAimRadius: 0.6,
    });
    // a 40 s cooldown is 240,000 charge points; the CC guard is 4 s
    expect(40 * ABILITY_RULES.ticksPerSecond * ABILITY_RULES.chargePerTick).toBe(240000);
    expect(ABILITY_RULES.ccGuardTicks / ABILITY_RULES.ticksPerSecond).toBe(4);
    // the fastest Skill Haste rate stays an integer ≤ 133 points per tick (the one rule's base is the sim's charge)
    expect(ABILITY_CHARGE_BASE).toBe(ABILITY_RULES.chargePerTick);
    expect(abilityChargePerTick({ ultHaste: 1 }, 'strike')).toBe(133);
    for (const k of NOT_HASTED_KINDS) expect(ABILITY_KINDS).toContain(k);
  });

  test('abilityRuns: the one live rule (kinds, a boost\'s mods, deploy and runner types)', () => {
    const runs = ABILITY_KINDS.filter((kind) => abilityRuns({ kind, effect: { mods: {}, move: 'push' } }));
    expect(runs).toEqual(['boost', 'rally', 'strike', 'burst', 'debuff', 'econ', 'move']);
    expect([...ABILITY_KINDS_RUN].sort()).toEqual([...runs].sort());
    // a move runs by its type: 'push' (Fuu's Backdraft Fan); 'carry' (Ruri's Star Snatch) and none wait
    expect(ABILITY_MOVES_RUN).toEqual(['push']);
    for (const move of ['carry', 'pull', undefined]) expect(abilityRuns({ kind: 'move', effect: { move } })).toBe(false);
    expect(abilityRuns({ kind: 'boost', effect: {} })).toBe(false);
    expect(ABILITY_DEPLOYS_RUN.map((deploy) => abilityRuns({ kind: 'deploy', effect: { deploy } }))).toEqual([true, true, true, true, true, true]);
    for (const deploy of ['double', 'trap', 'drone', 'mirror']) expect(ABILITY_DEPLOYS_RUN).toContain(deploy); // A4, A6
    expect(abilityRuns({ kind: 'deploy', effect: { deploy: undefined } })).toBe(false);
    expect(abilityRuns({ kind: 'runner', effect: { runner: 'giantBall' } })).toBe(true);
    expect(abilityRuns({ kind: 'runner', effect: { runner: 'river' } })).toBe(false);
    for (const x of [null, undefined, 0, 'strike', {}]) expect(abilityRuns(x)).toBe(false);
    // the table: every tower's first ⚡ entry runs (the A4 deploys, Fuu's move since A5, Iroha's mirror since A6);
    // every hero skill but Kanna's (a boost without a ModSet); Ruri's Star Snatch / River Rush wait; tier 5 never flips it
    for (const u of towers()) expect(abilityRuns(abilityRow(u)[0]), u.id).toBe(true);
    for (const h of heroes()) expect(abilityRuns(abilityRow(h).skill), h.id).toBe(h.id !== 'kanna');
    expect(ABILITIES.ruri.map(abilityRuns)).toEqual([true, false, false]);
  });

  test('kinds, scopes and auto-cast rules', () => {
    expect(ABILITY_KINDS).toEqual(['boost', 'rally', 'strike', 'burst', 'debuff', 'econ', 'deploy', 'move', 'zone', 'runner']);
    expect(ABILITY_SCOPES).toEqual(['local', 'map', 'player']);
    // (A3 M3: 'flyers' for Kaze's Swoop, 'sabotage' for First Aid Call)
    // ('cluster' for Prismfall: enemies around one spot, or a boss)
    expect(AUTO_WHEN).toEqual(['enemies', 'elite', 'leak', 'veiled', 'caster', 'poisoned', 'ready', 'flyers', 'sabotage', 'cluster']);
    // every rule a row uses is one the sim knows
    for (const u of UNITS) for (const e of entriesOf(u)) expect(AUTO_WHEN, `${e.id} auto ${e.auto.when}`).toContain(e.auto.when);
    expect(entriesOf(UNIT_MAP.hana)[0].auto.when).toBe('flyers');
    expect(entriesOf(UNIT_MAP.noa)[0].auto.when).toBe('sabotage');
  });

  test('a rally on one girl (target: girl, the girl-target rule of spec §7.2) needs no radius; nothing else does', () => {
    const rally = (effect) => ({ id: 'x.y', kind: 'rally', scope: 'local', cooldown: 45, duration: 12, effect });
    expect(defErrors(rally({ target: 'girl', rateMul: 1.8, rangeMul: 1.2 }), 'one girl')).toEqual([]);
    expect(defErrors(rally({ rateMul: 1.8 }), 'no radius')).toEqual(['no radius: a rally needs a radius']);
    expect(defErrors(rally({ target: 'lane', rateMul: 1.8 }), 'bad target')).toEqual(['bad target: a rally needs a radius', 'bad target: rally target lane']);
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
    // one row per girl, every girl: the returning girls' moved in from RETURNING_ABILITIES (A3 M3), which is gone
    for (const u of ALL_UNITS) expect(!!abilityRow(u), u.id).toBe(true);
    expect(Object.keys(ABILITIES).length).toBe(ALL_UNITS.length);
    for (const id of EXPANSION_IDS) expect(ABILITIES[id], id).toBeTruthy();
    expect('RETURNING_ABILITIES' in EXPANSION).toBe(false);
  });

  test('Ruri: one ability per familiar path, each on its own path, unlocking at tier 3', () => {
    const u = UNIT_MAP.ruri;
    expect(ABILITIES.ruri).toHaveLength(3);
    for (const [pathId, [id, coins]] of Object.entries(RURI_PATHS)) {
      const p = u.paths.find((x) => x.id === pathId);
      expect(p.ability.id).toBe(id);
      expect(p.ability.unlockTier).toBe(3);
      expect(u.base.cost + p.tiers.slice(0, 3).reduce((n, t) => n + t.cost, 0)).toBe(coins);
    }
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
    // the other paths carry no ability (a MULTI_PATH girl's carry their own, checked above and below)
    if (!MULTI_PATH[id]) for (const q of u.paths) if (q !== p) expect(q.ability, `${id}.${q.id}`).toBeUndefined();
    for (const [i, e] of row.entries()) {
      expect(u.paths.find((q) => q.id === e.path).ability, `${id} entry ${i}`).toBe(e);
      expect(e.unlockTier).toBe(3);
      expect(e.id.startsWith(`${id}.`)).toBe(true);
    }
    expect(u.hero).toBeUndefined();
  });

  test('the kind mix matches the spec: §5.1\'s 16 are strike 4, burst 3, deploy 3, boost 2, debuff 2, rally 1, econ 1; the new and returning girls add theirs', () => {
    const count = {};
    for (const u of towers()) { const k = u.paths.find((p) => p.ability).ability.kind; count[k] = (count[k] || 0) + 1; }
    const want = {};
    for (const k of Object.values(KIND_OF)) want[k] = (want[k] || 0) + 1;
    expect(count).toEqual(want);
    const live = {};
    for (const [id, k] of Object.entries(KIND_OF)) if (!NEW_GIRLS.includes(id)) live[k] = (live[k] || 0) + 1;
    expect(live).toEqual({ strike: 4, burst: 3, deploy: 3, boost: 2, debuff: 2, rally: 1, econ: 1 });
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
    // an LR form (src/data/abilities.js `lr`: Prismfall · Twin Star) is a valid definition at tier 3 and tier 5 too
    for (const a of entriesOf(u)) if (a.lr) for (const tier of [3, 5]) expect(defErrors(abilityWithLr(abilityAtTier(a, tier), a, true), `${id} LR T${tier}`)).toEqual([]);
    for (const base of entriesOf(u)) {
      expect(Object.keys(base.auto).every((k) => AUTO_KEYS.includes(k)), `${id} auto keys`).toBe(true);
      expect(AUTO_WHEN).toContain(base.auto.when);
      // (A3 M3: 'flyers' and 'sabotage' also take a whole count of enemies; 'leak' a share of the path)
      if (['enemies', 'poisoned', 'flyers', 'sabotage', 'cluster'].includes(base.auto.when)) expect(Number.isInteger(base.auto.min) && base.auto.min > 0, `${base.id} min`).toBe(true);
      if (base.auto.when === 'leak' && 'min' in base.auto) expect(base.auto.min > 0 && base.auto.min < 1).toBe(true);
      if ('orLeak' in base.auto) expect(base.auto.orLeak > 0 && base.auto.orLeak < 1).toBe(true);
      // an upgrade changes only what the base defines (and never the kind, scope or id); no cooldownMul /
      // durationAdd any more: every upgrade says its own numbers
      const over = u.kind === 'hero' ? base.ranks : [base.t5, ...(base.lr ? [base.lr] : [])];
      for (const o of over) {
        expect(o, `${id} upgrade`).toBeTruthy();
        for (const k of Object.keys(o)) expect(['level', 'cooldown', 'duration', 'effect'], `${id} upgrade key ${k}`).toContain(k);
      }
    }
  });

  test.each(all)('%s: cooldowns in the window, upgrades never slower', (id, u) => {
    const [lo, hi] = u.kind === 'hero' ? [20, 45] : [20, 60];
    const st = states(u);
    for (const [where, d] of st) {
      expect(d.cooldown, where).toBeGreaterThanOrEqual(lo);
      expect(d.cooldown, where).toBeLessThanOrEqual(hi);
    }
    // (each entry's own states in order: a hero's Lv 7 then her ranks; a tower entry's tier 3 then tier 5)
    for (let i = 1; i < st.length; i++) if (st[i][1].id === st[i - 1][1].id) expect(st[i][1].cooldown, st[i][0]).toBeLessThanOrEqual(st[i - 1][1].cooldown);
  });

  test('the spec table covers every girl with an ability, and nobody else', () => {
    expect(Object.keys(SPEC_TOWERS).sort()).toEqual(towers().map((u) => u.id).sort());
    expect(Object.keys(SPEC_HEROES).sort()).toEqual(heroes().map((u) => u.id).sort());
    expect(Object.keys(ABILITIES).sort()).toEqual([...Object.keys(SPEC_TOWERS), ...Object.keys(SPEC_HEROES)].sort());
  });

  test.each(Object.keys(SPEC_TOWERS))('%s: the spec numbers (§5.1–5.3) at tier 3 and tier 5', (id) => {
    const rows = (Array.isArray(SPEC_TOWERS[id]) ? SPEC_TOWERS[id] : [SPEC_TOWERS[id]]).map((r) => ({ unlockTier: 3, ...r }));
    expect(ABILITIES[id]).toEqual(rows);
    rows.forEach((base, i) => {
      expect(abilityAtTier(ABILITIES[id][i], 3)).toEqual(base);
      expect(abilityAtTier(ABILITIES[id][i], 5)).toEqual(specUpgraded(base, base.t5));
    });
  });

  test.each(Object.keys(SPEC_HEROES))('%s: the spec numbers (§5.1 heroes) at Lv 7 and Lv 17', (id) => {
    const base = { unlockLevel: 7, ...SPEC_HEROES[id] };
    expect(ABILITIES[id]).toEqual({ skill: base });
    expect(skillAtLevel(ABILITIES[id].skill, 7)).toEqual(base);
    expect(skillAtLevel(ABILITIES[id].skill, 17)).toEqual(specUpgraded(base, base.ranks[0]));
    expect(skillAtLevel(ABILITIES[id].skill, 25)).toEqual(specUpgraded(base, base.ranks[0]));
  });

  test('map-scope abilities: Umeko, Shiro, Hotaru, Ouka, Hana (one cooldown per player) and Luna\'s skill', () => {
    const map = UNITS.flatMap(entriesOf).filter((d) => d.scope === 'map').map((d) => d.id.split('.')[0]);
    expect(map.sort()).toEqual(['hana', 'hotaru', 'kohaku_tsubaki', 'luna', 'ouka', 'shiro', 'umeko']);
  });

  test('ability hits scale with her hit at the ⚡ tier-3 build (spec §5.1 examples)', () => {
    const at3 = (id) => { const u = UNIT_MAP[id]; const [, d, s] = states(u)[0]; return abilityValues(d, s); };
    // (× her balance round 5 row, src/data/balance.js: Aoi's damage row; Shiro and Tenka have none)
    expect(at3('aoi').dmg).toBe(Math.round(24 * POWER.aoi.dmg)); // 6 × 4 at 0-3-0 (24 before the round)
    expect(at3('shiro').dmg).toBe(295); // 5 × 59 at 3-0-0
    expect(at3('aoi').reach).toBe(5.4); // 1.5 × 3.6 tiles
    expect(at3('tenka').dmg).toBe(320); // 40 × (3 + 5) at 0-3-0
    expect(at3('tenka').reach).toBe(3.4);
    const [, d5, s5] = states(UNIT_MAP.tenka)[1];
    expect(abilityValues(d5, s5).dmg).toBe(7560); // 120 × (3 + 5 + 15 + 40) at 0-5-0
  });

  test('ids are unique and say whose they are', () => {
    const ids = UNITS.flatMap(entriesOf).map((e) => e.id);
    expect(ids.length).toBe(UNITS.length + 2); // Ruri's three familiar forms
    expect(new Set(ids).size).toBe(ids.length);
    // (a duo's id joins its members: kohaku_tsubaki)
    for (const id of ids) expect(id).toMatch(/^[a-z]+(_[a-z]+)?\.[a-zA-Z]+$/);
  });

  test('the returning girls at their unlock builds (§5.2 examples, base stats)', () => {
    const v = (id, i = 0) => { const [, d, s] = states(UNIT_MAP[id])[i]; return abilityValues(d, s); };
    expect(v('hana').dmg).toBe(Math.round(30 * POWER.hana.dmg)); // 6 × her hit at 3-0-0 (4 + 1) × her round 5 row (30 before)
    expect(v('ruri').reach).toBe(4.4); // her range + 2 tiles, from Kon
    expect(v('ruri').hits).toBe(3);
    expect(v('ena').curseBurst).toBe(Math.round(36 * POWER.ena.dmg)); // 3 × her hit at 3-0-0 (12) × her round 5 row (36 before)
    expect(v('yoriko').reach).toBe(Math.round((resolveStats(UNIT_MAP.yoriko, { heroLevel: 7 }).range + 1) * 10) / 10);
    expect(v('seiran', 1)).toMatchObject({ count: 12, dmgMul: 4, cd: 25 }); // Lv 17
    expect(v('noa', 1)).toMatchObject({ lifeMax: 5, dur: 14, cd: 42 }); // tier 5
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
    const ids = UNITS.flatMap(entriesOf).map((e) => e.id);
    expect(Object.keys(ABILITY_TEXT).sort()).toEqual([...ids].sort());
    for (const id of ids) {
      const t = abilityText(id);
      // `aim` (UI only: how a tap aims it) is optional and names a known kind
      expect(Object.keys(t).filter((k) => k !== 'aim').sort(), id).toEqual(['desc', 'icon', 'name', 'short', 'up']);
      if ('aim' in t) expect(ABILITY_AIMS, `${id} aim`).toContain(t.aim);
      expect(t.name.length).toBeGreaterThan(3);
      expect(t.short.length).toBeGreaterThan(10);
      expect(/[{}]/.test(t.short), `${id} short is plain text`).toBe(false);
      expect(GLYPHS[t.icon], `${id} icon ${t.icon}`).toBeTruthy();
    }
    expect(abilityText('nobody.nothing')).toBeNull();
  });

  test.each(UNITS.map((u) => [u.id, u]))('%s: every template fills completely at every state', (id, u) => {
    const check = (template, [where, d, s]) => {
      const out = fillAbilityText(template, abilityValues(d, s));
      expect(out, `${where}: ${out}`).not.toMatch(/[{}]|NaN|undefined|Infinity/);
      expect(out.length).toBeGreaterThan(20);
      return out;
    };
    // each entry's own states (Ruri: three entries)
    const all = states(u);
    for (const e of entriesOf(u)) {
      const [first, ...ups] = all.filter(([, d]) => d.id === e.id);
      const t = abilityText(e.id);
      check(t.desc, first);
      for (const st of ups) {
        check(t.desc, st);
        check(t.up, st);
      }
    }
  });

  test('the returning girls read right at their unlock builds', () => {
    const fill = (id, i = 0) => { const [, d, s] = states(UNIT_MAP[id])[i]; return fillAbilityText(abilityText(d.id).desc, abilityValues(d, s)); };
    // (M3 review round 2: he dives only within her reach; the rest take a strike from the sky — the card says so)
    expect(fill('hana')).toBe(`Kaze strikes up to 4 flyers still in the sky anywhere on the map (casters, bosses and elites first): he dives on the ones near Hana and strikes the rest from the sky. ${Math.round(30 * POWER.hana.dmg)} damage each, and they are grounded for 4s. With no flyer up, he takes the 2 strongest walkers instead.`);
    expect(fill('ena')).toBe(`Every enemy within 4.8 tiles draws a cursed card: its Omen Rot eats 60% of her hit a second and the curse spreads to its neighbours while it lives, and when it falls it bursts for ${Math.round(36 * POWER.ena.dmg)} damage (3× her hit) within 1.6 tiles, so a dense wave chain-reacts.`);
    expect(fill('noa')).toMatch(/^Girls within 4 tiles of her, your ally's too, are cleansed and can't be sabotaged or stunned for 10s\. Meanwhile every 10 enemies that fall within 3 tiles of her bring back a life \(at most 3;/);
    expect(fill('ruri')).toMatch(/^Kon leaps from his spot at the strongest enemy within 4\.4 tiles of him: 3 bites of \d+ damage, then he holds it for 1\.5s/);
  });

  test('Aoi at 0-3-0 reads like the spec example (24 damage × her round 5 row, 5.4 tiles)', () => {
    const [, d, s] = states(UNIT_MAP.aoi)[0];
    expect(fillAbilityText(abilityText(d.id).desc, abilityValues(d, s))).toBe(
      `Rains arrows on up to 6 enemies within 5.4 tiles, picked by her target mode: ${Math.round(24 * POWER.aoi.dmg)} damage each and a 0.5s pin.`,
    );
  });

  test('Tenka at 0-3-0 and 0-5-0: Critical Mass, then Zero Point\'s boost tail', () => {
    const [[, d3, s3], [, d5, s5]] = states(UNIT_MAP.tenka);
    expect(fillAbilityText(abilityText(d3.id).desc, abilityValues(d3, s3))).toBe(
      'A plasma blast on the strongest enemy within 3.4 tiles: 320 damage that ignores armor, and every enemy within 2 tiles of it takes the blast too.',
    );
    expect(abilityUnlockLine('tenka.criticalMass')).toBe('Unlocks ⚡ Critical Mass: a plasma blast on the strongest enemy in her range.');
    expect(abilityUpgradeLine('tenka.criticalMass', abilityValues(d5, s5))).toBe(
      '⚡+ Critical Mass hits for 120× her hit in a 3-tile blast and recharges in 30s; after each cast her bolts fire 2× as fast for 6s.',
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
    expect(names.length).toBe(UNITS.length + 2); // one ability per girl, three for Ruri (one per familiar path)
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
