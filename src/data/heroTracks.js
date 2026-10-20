// Hero level tracks (docs/specs/HERO_REWORK.md §3). Heroes deploy for free and level from 1 to 25
// inside each battle; every level from 2 to 25 grants exactly one item that used to be an upgrade
// tier (3 paths × 5 tiers) or an old level milestone (Lv 2–10), plus the shared growth of
// HERO_GROWTH. Pure data: the sim reads `levels[].mods` (via units.js `hero.levels`) and
// `ultRanks`; `from` / `also` / `pathKeys` are documentation the data tests and the attack looks
// read, never the sim.
//
// `from`: where a level came from — '<pathKey>.<tier>' (an old tier), 'L<n>' (an old level
// milestone) or 'base'. `also`: a later tier whose capability part was moved onto this level.
//
// Curation rules (each one is checked or measured, see the spec):
//  1. One attack per hero: a tier that replaced her attack keeps its numbers, not the behaviour
//     change (Hikari's old "Halo Lances" is "Halo Reach": +4 damage, +1 range, 2 more targets).
//  2. Stacked beams are trimmed: Luna's Lances T5 gives 1 beam, +10 damage, +20% speed.
//  3. Stacked push-back is trimmed: Nami's Undertow tiers push 0.15 / 0.1 / 0.1 / 0.15 tiles and
//     the old Lv 10 milestone lost its push (0.5 per hit at Lv 25), with the hero push lock.
//  4. Redundant milestones get a top-up instead of vanishing (Nami Lv 11 "Cold Front" +1 damage).
//  5. Counters come early: for each capability in the hero's pathCapabilities, the first level
//     that grants it is Lv ≤ 10, or costs ≤ 1.5× the old cheapest path price to buy from Lv 1
//     (tier-5-only capabilities stay on their tier-5 level). A counter moves by swapping two tiers
//     of the same path, or by moving only its capability part onto an earlier tier (`also`).
//
// Canonical order (paths A/B/C, milestones M2..M10): 2 M2 · 3 M3 (ult) · 4 A1 · 5 B1 · 6 C1 ·
// 7 M4 · 8 A2 · 9 B2 · 10 C2 (+ult rank 2) · 11 M5 · 12 A3 · 13 M6 · 14 B3 · 15 C3 · 16 M7 ·
// 17 A4 · 18 M8 · 19 B4 · 20 C4 (+ult rank 3) · 21 M9 · 22 A5 · 23 B5 · 24 C5 · 25 M10; then
// rule 5 moves counters forward. `node tools/heroTrack.mjs <heroId>` prints the rule-5 report.

import { RETURNING_HERO_TRACKS } from './heroTracksReturning.js';

const withChance = (spec, chance) => (chance != null && chance < 1 ? { ...spec, chance } : spec);
const S = {
  slow: (amount, duration, chance) => withChance({ type: 'slow', amount, duration }, chance),
  freeze: (duration, chance) => withChance({ type: 'freeze', duration }, chance),
  stun: (duration, chance) => withChance({ type: 'stun', duration }, chance),
  vulnerable: (bonus, duration, chance) => withChance({ type: 'vulnerable', bonus, duration }, chance),
};

/** XP needed for each level-up, Lv 2..25 (24 entries; Lv 25 = 24,280 in all). */
export const HERO_XP_STEPS = Object.freeze([
  200, 260, 320, 400, 480, 560, 640, 720, 800,
  860, 900, 940, 980, 1020, 1060, 1100, 1140, 1180, 1220,
  1500, 1700, 1900, 2100, 2300,
]);

/** Battle coins to buy each level from an empty bar, Lv 2..25 (40,285 from Lv 1 to 25). */
export const HERO_LEVEL_PRICES = Object.freeze([
  150, 195, 240, 300, 360, 420, 480, 540, 600,
  860, 900, 940, 980, 1020, 1590, 1650, 1710, 1770, 1830,
  3750, 4250, 4750, 5250, 5750,
]);

/**
 * XP sources. Time and wave XP are scaled by the stage pace k = clamp(refWaves / totalWaves, 1,
 * paceMax); damage XP is measured in the enemy's base HP (dealt ÷ hpMul), so stage HP, difficulty,
 * co-op and freeplay HP never change the pace. Past Lv 25 every masteryXp adds masteryStep damage
 * (Mastery), up to masteryMax (0 turns it off).
 */
export const HERO_XP = Object.freeze({
  perSecond: 4, waveBase: 60, wavePer: 18, perBaseHp: 0.4,
  refWaves: 22, paceMax: 2,
  masteryXp: 2000, masteryStep: 0.01, masteryMax: 0.25,
});

/** Growth per level above 1, additive: Lv 25 = +72% damage. */
export const HERO_GROWTH = Object.freeze({ damage: 0.03, rate: 0 });

/** Moving a hero during a wave: seconds she stops attacking, seconds before she can move again. */
export const HERO_MOVE = Object.freeze({ downtime: 3, cooldown: 15 });

const L = (level, from, desc, mods, also) => (also ? { level, from, also, desc, mods } : { level, from, desc, mods });

const HIKARI = {
  pathKeys: ['radiant', 'sanctuary', 'lightbringer'],
  levels: [
    L(1, 'base', 'Holy cleaves with Veil Sight.', {}),
    L(2, 'L2', 'Steady Guard: +1 damage.', { damage: 1 }),
    L(3, 'L3', 'Celestial Bloom unlocked; +5% attack speed.', { rateMul: 1.05 }),
    L(4, 'radiant.1', 'Honed Light: +2 damage.', { damage: 2 }),
    L(5, 'sanctuary.1', 'Guiding Light: girls within 2.6 tiles gain +6% range.', { aura: { range: 2.6, rangeMul: 1.06 } }),
    L(6, 'lightbringer.1', 'Bright Step: +0.3 range.', { range: 0.3 }),
    L(7, 'L4', 'Wider Sweep: +1 target per sweep, +0.2 range.', { maxTargets: 1, range: 0.2 }),
    L(8, 'radiant.2', 'Wide Arc: 2 more targets per sweep, +0.2 range; ignores 2 armor.', { maxTargets: 2, range: 0.2, armorPen: 2 }, ['radiant.3']),
    L(9, 'sanctuary.2', 'Shared Light: aura +5% attack speed and cleanses sabotage and stuns.', { aura: { rateMul: 1.05, cleanse: true } }, ['sanctuary.4']),
    L(10, 'lightbringer.3', 'Skyward Radiance: her sweeps reach flying enemies; +0.6 range. Celestial Bloom rank 2.', { canHitAir: true, range: 0.6 }),
    L(11, 'L5', 'Radiant Focus: +2 damage, +5% crit chance.', { damage: 2, crit: { chance: 0.05, mul: 1.5 } }),
    L(12, 'radiant.3', 'Sunsteel Edge: ignores 1 more armor (3 in all), +4 damage.', { armorPen: 1, damage: 4 }),
    L(13, 'L6', 'Searing Dawn: hits reveal veiled enemies for 1.5s.', { reveal: 1.5 }),
    L(14, 'sanctuary.3', 'Blessed Ground: aura shares Veil Sight and +10% damage; hits silence for 0.6s.', { aura: { detection: true, dmgMul: 1.1 }, silence: 0.6 }),
    L(15, 'lightbringer.2', 'Morning Tempo: +15% attack speed.', { rateMul: 1.15 }),
    L(16, 'L7', 'Captain\'s Resolve: +10% damage.', { damageMul: 1.1 }),
    L(17, 'radiant.4', 'Judgement Arc: +10 damage, 3 more targets, 15% crits for ×2.', { damage: 10, maxTargets: 3, crit: { chance: 0.15, mul: 2 } }),
    L(18, 'L8', 'Unwavering: +10% attack speed, +1 target.', { rateMul: 1.1, maxTargets: 1 }),
    L(19, 'sanctuary.4', 'Sanctified Banner: aura +15% attack speed and reaches 3.2 tiles; hits reveal veiled foes for 2s.', { aura: { rateMul: 1.15, range: 3.2 }, reveal: 2 }),
    L(20, 'lightbringer.4', 'Halo Reach: +4 damage, +1 range, 2 more targets. Celestial Bloom rank 3.', { damage: 4, range: 1, maxTargets: 2 }),
    L(21, 'L9', 'Sunforged: +3 damage, ignores 1 armor.', { damage: 3, armorPen: 1 }),
    L(22, 'radiant.5', 'Noon Absolute: +24 damage, +40% attack speed, 4 more targets, +0.5 range.', { damage: 24, rateMul: 1.4, maxTargets: 4, range: 0.5 }),
    L(23, 'sanctuary.5', 'Dawn Sanctuary: aura +20% damage and reaches 4 tiles; silence +0.8s.', { aura: { dmgMul: 1.2, range: 4 }, silence: 0.8 }),
    L(24, 'lightbringer.5', 'Celestial Choir: +20 damage; hits may stun (25%, 0.4s) and reveal for 3s.', { damage: 20, status: [S.stun(0.4, 0.25)], reveal: 3 }),
    L(25, 'L10', 'Dawnblade Ascendant: +15% damage, +0.3 range.', { damageMul: 1.15, range: 0.3 }),
  ],
  ultRanks: [
    { level: 10, desc: 'Rank 2: 5.5-tile bloom, stun 1.6s, recharges 15% faster.', effect: { radius: 5.5, status: [S.stun(1.6)] }, cooldownMul: 0.85 },
    { level: 20, desc: 'Rank 3: the bloom covers 7 tiles, stuns for 2s and leaves foes Brittle (+15% damage taken, 6s).', effect: { radius: 7, status: [S.stun(2), S.vulnerable(0.15, 6)] }, cooldownMul: 0.85 },
  ],
};

const LUNA = {
  pathKeys: ['lances', 'gravity', 'court'],
  levels: [
    L(1, 'base', 'Three piercing moon beams.', {}),
    L(2, 'L2', 'Arcane Focus: +1 damage.', { damage: 1 }),
    L(3, 'L3', 'Moonfall unlocked; +0.2 range.', { range: 0.2 }),
    L(4, 'lances.1', 'Focused Moonlight: +1 beam damage.', { damage: 1 }),
    L(5, 'gravity.1', 'Dusk Veil: beams slow by 15% for 1s.', { status: [S.slow(0.15, 1)] }),
    L(6, 'court.1', 'Starlit Study: girls within 3 tiles gain +5% range.', { aura: { range: 3, rangeMul: 1.05 } }),
    L(7, 'L4', 'Threaded Light: +1 pierce.', { pierce: 1 }),
    L(8, 'lances.2', 'Silver Thread: each beam pierces 2 more enemies and ignores 2 armor.', { pierce: 2, armorPen: 2 }, ['lances.3']),
    L(9, 'gravity.2', 'Heavy Night: +0.4 range.', { range: 0.4 }),
    L(10, 'court.3', 'Celestial Court: aura shares Veil Sight and +10% damage. Moonfall rank 2.', { aura: { detection: true, dmgMul: 1.1 } }),
    L(11, 'L5', 'Night Tempo: +1 damage, +8% attack speed.', { damage: 1, rateMul: 1.08 }),
    L(12, 'lances.3', 'Eclipse Prism: beams ignore 1 more armor (3 in all) and deal +3 damage.', { armorPen: 1, damage: 3 }),
    L(13, 'L6', 'Silver Edge: ignores 1 armor.', { armorPen: 1 }),
    L(14, 'gravity.3', 'Lunar Gravity: slow 30%, struck foes turn Brittle (+10% damage from everyone); 15% chance to stun for 0.5s.', { status: [S.slow(0.3, 1.5), S.vulnerable(0.1, 2), S.stun(0.5, 0.15)] }, ['gravity.4']),
    L(15, 'court.2', 'Night Lessons: aura +5% attack speed.', { aura: { rateMul: 1.05 } }),
    L(16, 'L7', 'Fourth Phase: a fourth beam.', { projectiles: 1 }),
    L(17, 'lances.4', 'Full Moon Lance: +8 damage, +4 pierce, +25% against elites.', { damage: 8, pierce: 4, eliteMul: 1.25 }),
    L(18, 'L8', 'Tidal Moon: +2 damage.', { damage: 2 }),
    L(19, 'gravity.4', 'Starfall Bind: +20% damage.', { damageMul: 1.2 }),
    L(20, 'court.4', 'Moon Court Regalia: aura +12% attack speed and reaches 3.6 tiles; +4 damage. Moonfall rank 3.', { aura: { rateMul: 1.12, range: 3.6 }, damage: 4 }),
    L(21, 'L9', 'Midnight Cadence: +10% attack speed.', { rateMul: 1.1 }),
    L(22, 'lances.5', 'Lunatic Lance: one more beam, +8 damage, +20% attack speed.', { projectiles: 1, damage: 8, rateMul: 1.2 }),
    L(23, 'gravity.5', 'Event Horizon: freeze chance, 50% slows, Brittle +20%, +20% attack speed.', { status: [S.freeze(1.2, 0.2), S.slow(0.5, 2.5), S.vulnerable(0.2, 3)], rateMul: 1.2 }),
    L(24, 'court.5', 'Queen of the Night Sky: aura +20% damage, +10% range and speed; another beam.', { aura: { dmgMul: 1.2, rangeMul: 1.1, rateMul: 1.1 }, projectiles: 1 }),
    L(25, 'L10', 'Lunar Sovereign: +15% damage, +2 pierce.', { damageMul: 1.15, pierce: 2 }),
  ],
  ultRanks: [
    { level: 10, desc: 'Rank 2: slow lasts 6s, the haste lasts 10s, recharges 15% faster.', effect: { duration: 6, buffDuration: 10 }, cooldownMul: 0.85 },
    { level: 20, desc: 'Rank 3: 60% slow and every girl attacks 40% faster.', effect: { slow: 0.6, rateBuff: 1.4 }, cooldownMul: 0.85 },
  ],
};

const NAMI = {
  pathKeys: ['frostbrand', 'undertow', 'harbor'],
  levels: [
    L(1, 'base', 'Frost strikes from the water that slow.', {}),
    L(2, 'L2', 'Salt Spray: +1 damage.', { damage: 1 }),
    L(3, 'L3', 'Tidal Wave unlocked; +0.2 range.', { range: 0.2 }),
    L(4, 'frostbrand.1', 'Cold Current: +1 damage.', { damage: 1 }),
    L(5, 'undertow.1', 'Riptide: +0.3 range.', { range: 0.3 }),
    L(6, 'harbor.1', 'Sea Breeze: girls within 2.8 tiles attack 5% faster.', { aura: { range: 2.8, rateMul: 1.05 } }),
    L(7, 'L4', 'Rolling Surf: +0.2 splash.', { splash: 0.2 }),
    L(8, 'frostbrand.2', 'Biting Spray: slow strengthened to 25% for 1.5s; ignores 1 armor.', { status: [S.slow(0.25, 1.5)], armorPen: 1 }, ['frostbrand.3']),
    L(9, 'undertow.2', 'Undertow: hits push enemies back 0.15 tiles (not bosses).', { knockback: 0.15 }),
    L(10, 'harbor.2', 'Lighthouse: +0.5 range. Tidal Wave rank 2.', { range: 0.5 }),
    L(11, 'L5', 'Cold Front: slow strengthened to 25% for 1.4s; +1 damage.', { status: [S.slow(0.25, 1.4)], damage: 1 }),
    L(12, 'frostbrand.3', 'Rime Spear: Brittle +12%, wider splash.', { status: [S.vulnerable(0.12, 2.5)], splash: 0.3 }),
    L(13, 'L6', 'Deep Current: +2 damage.', { damage: 2 }),
    L(14, 'undertow.3', 'Whirlpool: bigger splash, push-back +0.1 and a 35% slow.', { splash: 0.5, knockback: 0.1, status: [S.slow(0.35, 1.5)] }),
    L(15, 'harbor.3', 'Captain\'s Orders: aura +10% attack speed and +5% range.', { aura: { rateMul: 1.1, rangeMul: 1.05 } }),
    L(16, 'L7', 'Steady Helm: +10% attack speed.', { rateMul: 1.1 }),
    L(17, 'frostbrand.4', 'Glacier Breaker: +6 damage; 20% chance to freeze for 0.8s.', { damage: 6, status: [S.freeze(0.8, 0.2)] }),
    L(18, 'L8', 'Rimebite: struck foes turn Brittle (+8% damage taken) for 2s.', { status: [S.vulnerable(0.08, 2)] }),
    L(19, 'undertow.4', 'Maelstrom: +4 damage, push-back +0.1, 20% chance to stun for 0.4s.', { damage: 4, knockback: 0.1, status: [S.stun(0.4, 0.2)] }),
    L(20, 'harbor.4', 'Fleet Formation: aura +12% damage and reaches 3.4 tiles. Tidal Wave rank 3.', { aura: { dmgMul: 1.12, range: 3.4 } }),
    L(21, 'L9', 'High Tide: +2 damage.', { damage: 2 }),
    L(22, 'frostbrand.5', 'Absolute Zero Tide: +18 damage, 30% freeze for 1.5s, huge splash, +25% attack speed.', { damage: 18, status: [S.freeze(1.5, 0.3)], splash: 0.6, rateMul: 1.25 }),
    L(23, 'undertow.5', 'Leviathan\'s Wake: +14 damage, massive splash, push-back +0.15, +20% speed.', { damage: 14, splash: 0.8, knockback: 0.15, rateMul: 1.2 }),
    L(24, 'harbor.5', 'Admiral of the Tides: aura +15% damage, +10% speed, 10% cheaper upgrades; +10 damage.', { aura: { dmgMul: 1.15, rateMul: 1.1, costCut: 0.1 }, damage: 10 }),
    L(25, 'L10', 'Tidecaller: +15% damage.', { damageMul: 1.15 }),
  ],
  ultRanks: [
    { level: 10, desc: 'Rank 2: the wave pushes 6 tiles and slows by 50%, recharges 15% faster.', effect: { pushback: 6, slow: 0.5 }, cooldownMul: 0.85 },
    { level: 20, desc: 'Rank 3: the wave pushes 7 tiles, freezes for 1s and leaves foes Brittle (+15%, 6s).', effect: { pushback: 7, status: [S.freeze(1), S.vulnerable(0.15, 6)] }, cooldownMul: 0.85 },
  ],
};

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

/** HERO_TRACKS[heroId] = { pathKeys, levels[25], ultRanks[] } (the returning heroes: heroTracksReturning.js). */
export const HERO_TRACKS = deepFreeze({ hikari: HIKARI, luna: LUNA, nami: NAMI, ...RETURNING_HERO_TRACKS });
