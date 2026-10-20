// Potential steps, v3 (owner: systems; docs/specs/POTENTIAL.md, v3 §3, §5, §7). Every
// duplicate of an owned girl raises her Potential by 1, from P1 (her first copy) to P6; each step
// P2…P6 is a stat buff (her rarity's stat track, spent on her own axis) and, from P3 (from P2 for
// SSRs and the three heroes), a kit buff that amplifies what she is good at. P1 is untouched: no key
// below is read until a step turns it on. In the co-op graph: src/sim/mods.js resolveStats folds the
// steps in, and src/online/coop/version.js hashes POTENTIAL_LADDERS, POTENTIAL_SIGNATURE_DEFAULT and
// POTENTIAL_GIRLS (the names stay: append-only hash list), so two builds with different steps cannot
// pair. Player text, node labels, Power and FX cues live in src/data/potentialText.js (UI only, not
// hashed); her level cap per step lives in src/systems/progression.js (not hashed either).
//
// Where a girl's Potential COMES from (duplicates today) is src/systems/potential.js potentialLevel,
// the one place a later source (ascension's Essence) swaps in; these ladders only say what each P does.
//
// A step is `{ name, kind, girl, mods }`:
//   kind  'stat' (stat only), 'kit' (stat + kit), 'cap' (stat + capstone) — POTENTIAL_LADDERS.kinds
//   girl  whole-girl multipliers (POTENTIAL_GIRL_KEYS). They multiply into her unit stats exactly like
//         her level and gear (mods.js applyUnitStats), so they reach her traps and drones and are the
//         same size at level 1 and level 85; incomeMul multiplies income.perWave after every upgrade;
//         dotMul multiplies her burn / poison (N1).
//   mods  a ModSet applied after the awaken passive, restricted to POTENTIAL_MOD_KEYS (the sim
//         mechanics N1–N17 are documented in src/sim/potential.js).
// Deterministic: products of constants and integer counters, no transcendental math, no new random draw.

export const POTENTIAL_VERSION = 3;
export const MAX_POTENTIAL = 6;
export const POTENTIAL_GIRL_KEYS = Object.freeze(['damageMul', 'rateMul', 'rangeMul', 'incomeMul', 'dotMul']);
/** ModSet keys a step may use (dotted for nested). Everything else is banned (tests/data/potential.test.js). */
export const POTENTIAL_MOD_KEYS = Object.freeze([
  // v2
  'pierce', 'chain', 'maxTargets', 'armorPen', 'canHitAir', 'silence', 'crit.chance', 'ramp.max',
  'trap.max', 'turret.max', 'turret.overclock', 'aura.range', 'aura.dmgMul', 'aura.rateMul', 'aura.rangeAdd',
  'aura.armorPen', 'aura.critChance', 'aura.foeVuln', 'brew.targetsAdd', 'link.targetsAdd',
  'statusAdd', 'proc', 'ult', 'bountyAura', 'harvest', 'dotSpread', 'keepRamp',
  // v3
  'projScale', 'tempo', 'classMul', 'bossMul', 'ramp.per', 'turret.range',
  // the new girls (UNIT_GAPS §5): Wakaba's drink
  'drink.shots', 'drink.splash', 'drink.dmg', 'drink.rate',
  // Ouka's office (radius and discount on top of her tiers)
  'hub.radiusAdd', 'hub.cutAdd',
  // Chigusa's vine and thorns
  'vine.hold', 'vine.bedDmg', 'vine.every',
  // Marumi's balls
  'ball.travel', 'ball.pinDmg', 'ball.speed',
  // Yuzuha's sentries
  'sentry.max', 'sentry.damage', 'sentry.ttl',
]);
/** Keys whose value is one whole object or list (never split into dotted keys). */
export const POTENTIAL_WHOLE_KEYS = Object.freeze(['statusAdd', 'proc', 'ult', 'harvest', 'dotSpread', 'tempo', 'classMul']);

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

/** One-girl keys (data test): projScale / tempo → kage, classMul → hotaru (spectral only), bossMul → kaede. */
export const POTENTIAL_GIRL_ONLY = deepFreeze({ projScale: ['kage'], tempo: ['kage'], classMul: ['hotaru'], bossMul: ['kaede'] });

export const POTENTIAL_LADDERS = deepFreeze({
  // kind per step P2..P6; 'kit' = stat + kit; 'cap' = stat + capstone. Heroes (Nami too) use SSR kinds.
  kinds: { R: ['stat', 'kit', 'kit', 'kit', 'cap'], SR: ['stat', 'kit', 'kit', 'kit', 'cap'], SSR: ['kit', 'kit', 'kit', 'kit', 'cap'] },
  statTrack: {
    // every track is non-decreasing (data test): the stat under a node never shrinks
    R: [1.04, 1.04, 1.04, 1.04, 1.05], SR: [1.04, 1.05, 1.05, 1.06, 1.07], SSR: [1.05, 1.07, 1.07, 1.08, 1.09],
    nami: [1.04, 1.05, 1.05, 1.06, 1.06], aura: [1.03, 1.03, 1.03, 1.03, 1.03], coins: [1.03, 1.03, 1.04, 1.04, 1.04],
  },
  // each step's total size (stat × kit) by rarity, on her scored measure (spec §3.1; gates B1, B8)
  stepSlot: { R: [1.04, 1.08, 1.09, 1.12, 1.16], SR: [1.04, 1.10, 1.11, 1.17, 1.23], SSR: [1.10, 1.12, 1.15, 1.22, 1.32] },
});

/** The stat track a girl spends (default: her rarity's): Nami's own, the two supports' aura track, Momo's coins. */
export const POTENTIAL_TRACK_OF = deepFreeze({ nami: 'nami', umeko: 'aura', miko: 'aura', momo: 'coins', noa: 'aura', ouka: 'coins' });

/** Rows for defs without one (fixtures, dev units only; a test requires every shipped girl's own row). */
const fixtureRow = (track, kinds) => ({
  p2: { name: 'Practice I', kind: kinds[0], girl: { damageMul: track[0] }, mods: null },
  p3: { name: 'Practice II', kind: kinds[1], girl: { damageMul: track[1] }, mods: null },
  p4: { name: 'Practice III', kind: kinds[2], girl: { damageMul: track[2] }, mods: null },
  p5: { name: 'Practice IV', kind: kinds[3], girl: { damageMul: track[3] }, mods: null },
  p6: { name: 'Full Bloom', kind: kinds[4], girl: { damageMul: track[4] }, mods: null },
});
export const POTENTIAL_SIGNATURE_DEFAULT = deepFreeze({
  R: fixtureRow(POTENTIAL_LADDERS.statTrack.R, POTENTIAL_LADDERS.kinds.R),
  SR: fixtureRow(POTENTIAL_LADDERS.statTrack.SR, POTENTIAL_LADDERS.kinds.SR),
  SSR: fixtureRow(POTENTIAL_LADDERS.statTrack.SSR, POTENTIAL_LADDERS.kinds.SSR),
});

// StatusSpec builders (the same shapes as src/data/units.js S.*)
const S = {
  slow: (amount, duration) => ({ type: 'slow', amount, duration }),
  freeze: (duration) => ({ type: 'freeze', duration }),
  stun: (duration) => ({ type: 'stun', duration }),
  shred: (amount, duration) => ({ type: 'shred', amount, duration }),
  vulnerable: (bonus, duration) => ({ type: 'vulnerable', bonus, duration }),
  soak: (duration) => ({ type: 'soak', duration }),
};
const step = (name, kind, girl = null, mods = null) => ({ name, kind, girl, mods });

/**
 * One row per girl, P2…P6, exactly the data of spec §5 (keys `id` or `id@kitStyle`). The step names
 * are checked against every other name in the game (tests/data/potential.test.js).
 */
export const POTENTIAL_GIRLS = deepFreeze({
  // §5.1 Kage, SR skirmisher: every shuriken pierces, very fast → attack speed (all five stat steps),
  // shuriken per throw (N13), tempo (N14), pierce, a storm of clone volleys (N3 echo). Re-priced on the
  // B1 bench (spec §9.4's knobs: the storm every 8th throw, projScale 0.08; one pierce step, at P5)
  kage: {
    p2: step('Night Drills', 'stat', { rateMul: 1.04 }),
    p3: step('Shadow Edge', 'kit', { rateMul: 1.05 }, { projScale: 0.08, armorPen: 1 }),
    p4: step('Shadow Tempo', 'kit', { rateMul: 1.05 }, { tempo: { per: 0.01, max: 0.06, idle: 1 } }),
    p5: step('Moonpiercer', 'kit', { rateMul: 1.06 }, { pierce: 1 }),
    p6: step('Shuriken Storm', 'cap', { rateMul: 1.07 }, { proc: { name: 'Shuriken Storm', every: 8, echo: true } }),
  },
  // §5.2 Aoi, R marksman
  aoi: {
    p2: step('Dawn Practice', 'stat', { damageMul: 1.04 }),
    p3: step('Through-Shot', 'kit', { rateMul: 1.04 }, { armorPen: 1, crit: { chance: 0.03 } }),
    p4: step('Keen Fletching', 'kit', { damageMul: 1.04 }, { crit: { chance: 0.06 } }),
    p5: step('Twin Fletch', 'kit', { rateMul: 1.04 }, { proc: { name: 'Twin Fletch', every: 12, echo: true } }),
    p6: step('Hawk Companion', 'cap', { damageMul: 1.05 }, { proc: { every: 10, nova: { radius: 0, share: 1, volley: true } } }),
  },
  // §5.3 Rei, R cleaver (the rhythm counts her sweeps, or her duel strikes in Duelist stance)
  rei: {
    p2: step('Morning Kata', 'stat', { damageMul: 1.04 }),
    p3: step('Third Step', 'kit', { rateMul: 1.04 }, { proc: { name: 'Third Step', every: 4, damageMul: 1.15, status: [S.stun(0.3)] } }),
    p4: step('Clean Cut', 'kit', { damageMul: 1.04 }, { crit: { chance: 0.05 } }),
    p5: step('Breaking Petal', 'kit', { rateMul: 1.04 }, { proc: { damageMul: 1.5, status: [S.shred(1, 3)] } }),
    p6: step('Twin Crescent', 'cap', { damageMul: 1.05 }, { proc: { echo: 0.3 } }),
  },
  // §5.4 Yuki, R controller
  yuki: {
    p2: step('Snow Day', 'stat', { rateMul: 1.04 }),
    p3: step('Powder Drift', 'kit', { damageMul: 1.04 }, { statusAdd: [{ type: 'slow', amount: 0.05, duration: 1 }] }),
    p4: step('Cold Snap', 'kit', { rateMul: 1.04 }, { statusAdd: [S.vulnerable(0.05, 2)] }),
    p5: step('Flurry', 'kit', { damageMul: 1.04 }, { proc: { name: 'Flurry', every: 5, damageMul: 1.3, splash: 0.3, status: [S.freeze(0.4)] } }),
    p6: step('Winter Glass', 'cap', { rateMul: 1.05 }, { proc: { every: 4, damageMul: 1.5, status: [S.vulnerable(0.1, 3)] } }),
  },
  // §5.5 Momo, R economy (the coins track; battle coins only)
  momo: {
    p2: step('Pocket Money', 'stat', { incomeMul: 1.03 }),
    p3: step('Lucky Pouch', 'kit', { incomeMul: 1.03 }, { bountyAura: 1.1 }),
    p4: step('Fortune Flick', 'kit', { incomeMul: 1.04, rateMul: 1.04 }, { proc: { name: 'Fortune Flick', every: 8, damageMul: 3 } }),
    p5: step('Golden Harvest', 'kit', { incomeMul: 1.04 }, { harvest: { every: 8, share: 1 } }),
    p6: step('Peach Festival', 'cap', { incomeMul: 1.04 }, { harvest: { every: 6 }, proc: { every: 6, damageMul: 4 } }),
  },
  // §5.6 Akane, SR bombardment
  akane: {
    p2: step('Hotter Powder', 'stat', { damageMul: 1.04, dotMul: 1.04 }),
    p3: step('Ember Leap', 'kit', { rateMul: 1.05 }, { dotSpread: { type: 'burn', radius: 1.2, depth: 2 }, statusAdd: [{ type: 'burn', duration: 1 }] }),
    p4: step('Starburst Skies', 'kit', { damageMul: 1.05, dotMul: 1.05 }, { canHitAir: true, proc: { name: 'Starburst', every: 8, damageMul: 1.5, splash: 0.4 } }),
    p5: step('Grand Starburst', 'kit', { rateMul: 1.06 }, { proc: { every: 6, damageMul: 2, splash: 0.6, dotMul: 1.5 } }),
    p6: step('Midsummer Bloom', 'cap', { damageMul: 1.07, dotMul: 1.07 }, { proc: { echo: 0.5 } }),
  },
  // §5.7 Sango, SR artillery
  sango: {
    p2: step('Deck Drill', 'stat', { damageMul: 1.04 }),
    p3: step('Coral Chisel', 'kit', { rateMul: 1.05 }, { statusAdd: [S.shred(1, 3)] }),
    p4: step('Coral Shell', 'kit', { damageMul: 1.05 }, { proc: { name: 'Coral Shell', every: 6, damageMul: 1.4, splash: 0.3 } }),
    p5: step('Coral Barrage', 'kit', { rateMul: 1.06 }, { proc: { every: 4, damageMul: 1.8, splash: 0.4, status: [S.soak(4)] } }),
    p6: step('Sea Dragon Shell', 'cap', { damageMul: 1.07 }, { proc: { every: 3, status: [S.vulnerable(0.1, 3)] } }),
  },
  // §5.8 Umeko, SR support (the aura track; P4 and P5 swapped from the lens so her partner steps climb)
  umeko: {
    p2: step('Spring Water', 'stat', null, { aura: { rateMul: 1.03 } }),
    p3: step('Tidewarmth', 'kit', null, { aura: { rateMul: 1.03, rangeAdd: 0.4 } }),
    p4: step('Lantern Ward', 'kit', null, { aura: { rateMul: 1.03, armorPen: 1, rangeAdd: 0.3 } }),
    p5: step('Petal Drizzle', 'kit', null, { aura: { rateMul: 1.03, critChance: 0.06 } }),
    p6: step('Blessing Wave', 'cap', null, { aura: { rateMul: 1.03 }, proc: { name: 'Blessing Wave', every: 3, auraBoost: { time: 3, rateMul: 1.15 } } }),
  },
  // §5.9 Shiro, SR sniper (the free-wall knob: held boss ≤ ×1.75). Her over-penetration rides on a
  // rhythm (every 5th, then every 4th shot), so a crowd does not multiply every shot (B1 bench)
  shiro: {
    p2: step('Range Day', 'stat', { damageMul: 1.04 }),
    p3: step('Keen Scope', 'kit', { damageMul: 1.05 }, { statusAdd: [{ type: 'mark', bonus: 0.06, duration: 3 }] }),
    p4: step('Steady Breath', 'kit', { rateMul: 1.05 }, { crit: { chance: 0.05 } }),
    p5: step('Silver Line', 'kit', { damageMul: 1.06 }, { armorPen: 2, proc: { name: 'Silver Line', every: 5, pierce: 2 } }),
    p6: step('White Heron', 'cap', { rateMul: 1.07 }, { proc: { every: 4, damageMul: 1.5 } }),
  },
  // §5.10 Midori, SR alchemist
  midori: {
    p2: step('Fresh Herbs', 'stat', { damageMul: 1.04, dotMul: 1.04 }),
    p3: step('Bitter Tonic', 'kit', { rateMul: 1.05 }, { statusAdd: [S.vulnerable(0.05, 3)] }),
    p4: step('Evergreen Venom', 'kit', { damageMul: 1.05, dotMul: 1.05 }, { statusAdd: [{ type: 'poison', pct: 0.0005, duration: 1 }] }),
    p5: step('Cauldron Bomb', 'kit', { rateMul: 1.06 }, { proc: { name: 'Cauldron Bomb', every: 6, damageMul: 1.5, splash: 0.4, dotMul: 1.5 } }),
    p6: step('Double Batch', 'cap', { damageMul: 1.07, dotMul: 1.07 }, { brew: { targetsAdd: 1 }, proc: { every: 5 } }),
  },
  // §5.11 Suzu, SR trapper (her rhythm counts trap explosions)
  suzu: {
    p2: step('Bell Practice', 'stat', { damageMul: 1.04 }),
    p3: step('Spare Seals', 'kit', { rateMul: 1.05 }, { trap: { max: 1 }, statusAdd: [S.slow(0.2, 1.5)] }),
    p4: step('Temple Bell', 'kit', { damageMul: 1.05 }, { proc: { name: 'Temple Bell', of: 'trap', every: 10, damageMul: 1.5, splash: 0.3 } }),
    p5: step('Bell Peal', 'kit', { rateMul: 1.06 }, { proc: { every: 5, damageMul: 1.6, splash: 0.4, silence: 1 } }),
    p6: step('Evening Bell', 'cap', { damageMul: 1.07 }, { trap: { max: 1 }, proc: { every: 4, damageMul: 1.8, status: [S.vulnerable(0.1, 3)] } }),
  },
  // §5.12 Raika, SR chain
  raika: {
    p2: step('Drum Practice', 'stat', { damageMul: 1.04 }),
    p3: step('Branching Bolt', 'kit', { rateMul: 1.05 }, { chain: 1, armorPen: 1 }),
    p4: step('Thunder Column', 'kit', { damageMul: 1.05 }, { proc: { name: 'Thunderhead', every: 6, nova: { radius: 0.9, share: 0.25 } } }),
    p5: step('Thunderhead', 'kit', { rateMul: 1.06 }, { proc: { every: 5, nova: { radius: 0.8, share: 0.4 }, status: [S.stun(0.3)] } }),
    p6: step('Monsoon Drum', 'cap', { damageMul: 1.07 }, { chain: 1, proc: { every: 4, status: [S.soak(3)] } }),
  },
  // §5.13 Miko, SR enchanter (the aura track on her aura; her own talismans take the SR track)
  miko: {
    p2: step('Morning Prayer', 'stat', { damageMul: 1.04 }, { aura: { dmgMul: 1.03 } }),
    p3: step('Bell Ward', 'kit', { rateMul: 1.05 }, { aura: { dmgMul: 1.03, armorPen: 1 } }),
    p4: step('Shrine Steps', 'kit', { damageMul: 1.05 }, { aura: { dmgMul: 1.03, rangeAdd: 0.4 } }),
    p5: step('Shimenawa Circle', 'kit', { rateMul: 1.06 }, { aura: { dmgMul: 1.03, foeVuln: 0.06 } }),
    p6: step('Festival Bells', 'cap', { damageMul: 1.07 }, { aura: { dmgMul: 1.03 }, proc: { name: 'Festival Bells', every: 4, auraBoost: { time: 3, dmgMul: 1.1 } } }),
  },
  // §5.14 Nami, SR hero (stat + kit from P2; her own track)
  nami: {
    p2: step('Morning Tide', 'kit', { damageMul: 1.04 }, { statusAdd: [{ type: 'slow', amount: 0.05 }] }),
    p3: step('Brine Soak', 'kit', { rateMul: 1.05 }, { statusAdd: [S.soak(2)] }),
    p4: step('Sea Legs', 'kit', { damageMul: 1.05 }, { ult: { haste: 0.15 } }),
    p5: step('High Water', 'kit', { rateMul: 1.06 }, { ult: { damageMul: 1.5, status: [S.soak(6)], statusAdd: [S.vulnerable(0.1, 4)] } }),
    p6: step('Tide Crown', 'cap', { damageMul: 1.06 }, { proc: { name: 'Tide Crown', every: 5, damageMul: 1.5, splash: 0.5, status: [S.freeze(0.4)] } }),
  },
  // §5.15 Hotaru, SSR exorcist (the whales' spectral-wall knob)
  hotaru: {
    p2: step('Firefly Lamps', 'kit', { damageMul: 1.05 }, { aura: { range: 2.6, dmgMul: 1.06 } }),
    p3: step('Firefly Parade', 'kit', { rateMul: 1.07 }, { maxTargets: 1, statusAdd: [{ type: 'mark', bonus: 0.05, duration: 3 }] }),
    p4: step('Lantern Rite', 'kit', { damageMul: 1.07 }, { classMul: { spectral: 1.2 }, statusAdd: [S.vulnerable(0.06, 3)] }),
    p5: step('Hundred Lanterns', 'kit', { rateMul: 1.08 }, { proc: { name: 'Hundred Lanterns', every: 4, range: 1, damageMul: 1.4, silence: 1 } }),
    p6: step('Midnight Lanterns', 'cap', { damageMul: 1.09 }, { aura: { dmgMul: 1.06 }, proc: { every: 3, damageMul: 1.8, status: [S.vulnerable(0.08, 3)] } }),
  },
  // §5.16 Kaede, SSR duelist (the AoE rework PR owns her P5 row; until then Maple Gale cuts only the
  // enemies right beside her target, at her plain hit: towers.js attackDuel)
  kaede: {
    p2: step('Leaf Memory', 'kit', { damageMul: 1.05 }, { keepRamp: 0.5 }),
    p3: step('Breeze Step', 'kit', { rateMul: 1.07 }, { ramp: { per: 0.02 } }),
    p4: step('Scarlet Focus', 'kit', { damageMul: 1.07 }, { ramp: { max: 0.3 }, crit: { chance: 0.05 } }),
    p5: step('Maple Gale', 'kit', { rateMul: 1.08 }, { proc: { name: 'Maple Gale', every: 4, splash: 0.1 } }),
    p6: step('One Blade, One Foe', 'cap', { damageMul: 1.09 }, { bossMul: 1.2, proc: { every: 3, damageMul: 1.5 } }),
  },
  // §5.17 Chika, SSR engineer (turret.overclock merges in step order: P6 keeps P4's 6 s)
  chika: {
    p2: step('Throttle Up', 'kit', { damageMul: 1.05 }, { turret: { overclock: { every: 30, time: 4, rateMul: 1.5 } } }),
    p3: step('Fine Tuning', 'kit', { rateMul: 1.07 }, { turret: { range: 0.3 }, armorPen: 1 }),
    p4: step('Overhaul', 'kit', { damageMul: 1.07 }, { turret: { overclock: { every: 25, time: 6, rateMul: 1.6 } } }),
    p5: step('Extra Wing', 'kit', { rateMul: 1.08 }, { turret: { max: 1 }, statusAdd: [S.shred(1, 3)] }),
    p6: step('Grand Uplink', 'cap', { damageMul: 1.09 }, { turret: { overclock: { every: 20, rateMul: 1.75 } }, link: { targetsAdd: 1 } }),
  },
  // §5.18 Hikari, SSR hero (P3 and P5 live in her ultimate)
  hikari: {
    p2: step('Sunrise Step', 'kit', { damageMul: 1.05 }, { proc: { name: 'Sunrise', every: 6, damageMul: 1.5 } }),
    p3: step('Dawn Training', 'kit', { damageMul: 1.07 }, { ult: { haste: 0.1 } }),
    p4: step('Sunrise Drill', 'kit', { rateMul: 1.07 }, { proc: { every: 5, damageMul: 1.75 } }),
    p5: step('High Sun Bloom', 'kit', { damageMul: 1.08 }, { ult: { radius: 1, damageMul: 1.75, statusAdd: [S.vulnerable(0.15, 6)] } }),
    p6: step('Second Sunrise', 'cap', { rateMul: 1.09 }, { ult: { haste: 0.1 }, proc: { every: 4, damageMul: 2, status: [S.stun(0.3)] } }),
  },
  // §5.19 Luna, SSR hero (Moonfall reaches every girl on the map, a partner's included)
  luna: {
    p2: step('Long Moonbeam', 'kit', { damageMul: 1.05 }, { pierce: 2 }),
    p3: step('Night Study', 'kit', { damageMul: 1.07 }, { ult: { haste: 0.1 } }),
    p4: step('Starlit Pace', 'kit', { rateMul: 1.07 }, { ult: { buffDuration: 3, rateBuff: 0.05 } }),
    p5: step('Tidelocked Moon', 'kit', { damageMul: 1.08 }, { ult: { haste: 0.1, duration: 2, status: [S.vulnerable(0.15, 8)] } }),
    p6: step('Eclipse Crown', 'cap', { rateMul: 1.09 }, { ult: { rateBuff: 0.05 }, aura: { range: 3, dmgMul: 1.08, rateMul: 1.08 } }),
  },
  // Roster wave (track 5): the nine returning girls. First-pass rows on safe kit keys (pierce, armor
  // pen, crit, a named rhythm, statusAdd onto a status she has, her ultimate), inside the §3.4 ceilings;
  // re-measured in the owner's balance pass with the B1 bench.
  // Fuu, R displacement
  fuu: {
    p2: step('Warm-up Spin', 'stat', { damageMul: 1.04 }),
    p3: step('Through Gust', 'kit', { rateMul: 1.04 }, { pierce: 1 }),
    p4: step('Turbine Kick', 'kit', { damageMul: 1.04 }, { proc: { name: 'Turbine Kick', every: 6, damageMul: 1.3, splash: 0.3 } }),
    p5: step('Clean Lines', 'kit', { rateMul: 1.04 }, { crit: { chance: 0.05 } }),
    p6: step('Gale Finale', 'cap', { damageMul: 1.05 }, { proc: { every: 4, damageMul: 1.5, status: [S.stun(0.3)] } }),
  },
  // Hana, R falconer
  hana: {
    p2: step('Field Practice', 'stat', { damageMul: 1.04 }),
    p3: step('Sight Tune', 'kit', { rateMul: 1.04 }, { armorPen: 1, crit: { chance: 0.03 } }),
    p4: step('Kaze Patrol', 'kit', { damageMul: 1.04 }, { proc: { name: 'Kaze Dive', every: 8, damageMul: 2 } }),
    p5: step('Steady Glove', 'kit', { rateMul: 1.04 }, { crit: { chance: 0.05 } }),
    p6: step('Falcon Sky', 'cap', { damageMul: 1.05 }, { proc: { every: 6, damageMul: 2.5 } }),
  },
  // Ruri, SR summoner (her bolts leave Kon, the holo familiar)
  ruri: {
    p2: step('Bookmark Charm', 'stat', { damageMul: 1.04 }),
    p3: step('Page Turn', 'kit', { rateMul: 1.05 }, { pierce: 1 }),
    p4: step('Kon\'s Pounce', 'kit', { damageMul: 1.05 }, { proc: { name: 'Kon Pounce', every: 6, damageMul: 1.6, splash: 0.3 } }),
    p5: step('Holo Sigil', 'kit', { rateMul: 1.06 }, { armorPen: 1 }),
    p6: step('Spirit Library', 'cap', { damageMul: 1.07 }, { proc: { every: 4, damageMul: 2 } }),
  },
  // Noa, SR purifier (the aura track, like Umeko)
  noa: {
    p2: step('Spring Check', 'stat', null, { aura: { rateMul: 1.03 } }),
    p3: step('Wide Field', 'kit', null, { aura: { rateMul: 1.03, rangeAdd: 0.4 } }),
    p4: step('Steady Hands', 'kit', null, { aura: { rateMul: 1.03, critChance: 0.04 } }),
    p5: step('Clear Mind', 'kit', null, { aura: { rateMul: 1.03, armorPen: 1 } }),
    p6: step('Sakura Shield', 'cap', null, { aura: { rateMul: 1.03 }, proc: { name: 'Sakura Pulse', every: 3, auraBoost: { time: 3, rateMul: 1.1 } } }),
  },
  // Iroha, SSR mirror (two firing points)
  iroha: {
    p2: step('Polished Pane', 'kit', { damageMul: 1.05 }, { pierce: 1 }),
    p3: step('Drone Easel', 'kit', { rateMul: 1.07 }, { armorPen: 1 }),
    p4: step('Twin Gleam', 'kit', { damageMul: 1.07 }, { proc: { name: 'Twin Gleam', every: 6, damageMul: 1.5 } }),
    p5: step('Silver Focus', 'kit', { rateMul: 1.08 }, { crit: { chance: 0.06 } }),
    p6: step('Hall of Light', 'cap', { damageMul: 1.09 }, { proc: { every: 4, damageMul: 2 } }),
  },
  // Ena, SSR hexer
  ena: {
    p2: step('Marked Deck', 'kit', { damageMul: 1.05 }, { statusAdd: [{ type: 'curse', duration: 1 }] }),
    p3: step('Quick Shuffle', 'kit', { rateMul: 1.07 }, { crit: { chance: 0.05 } }),
    p4: step('Bad Omen', 'kit', { damageMul: 1.07 }, { proc: { name: 'Bad Omen', every: 5, damageMul: 1.6 } }),
    p5: step('Thread Weave', 'kit', { rateMul: 1.08 }, { armorPen: 1 }),
    p6: step('Full House', 'cap', { damageMul: 1.09 }, { proc: { every: 4, damageMul: 2, status: [S.vulnerable(0.1, 3)] } }),
  },
  // Kanna, SSR hero (P3 and P5 live in her ultimate)
  kanna: {
    p2: step('Drum Warm-up', 'kit', { damageMul: 1.05 }, { proc: { name: 'Big Beat', every: 6, damageMul: 1.5 } }),
    p3: step('Festival Tempo', 'kit', { damageMul: 1.07 }, { ult: { haste: 0.1 } }),
    p4: step('Crowd Roar', 'kit', { rateMul: 1.07 }, { proc: { every: 5, damageMul: 1.75 } }),
    p5: step('Encore Drumfall', 'kit', { damageMul: 1.08 }, { ult: { damageMul: 1.5, statusAdd: [S.vulnerable(0.12, 6)] } }),
    p6: step('Grand Matsuri', 'cap', { rateMul: 1.09 }, { ult: { haste: 0.1 }, proc: { every: 4, damageMul: 2, status: [S.stun(0.3)] } }),
  },
  // Yoriko, SSR hero
  yoriko: {
    p2: step('Fine Strings', 'kit', { damageMul: 1.05 }, { statusAdd: [{ type: 'slow', amount: 0.05 }] }),
    p3: step('Stage Cue', 'kit', { rateMul: 1.07 }, { ult: { haste: 0.1 } }),
    p4: step('Dream Hex', 'kit', { damageMul: 1.07 }, { ult: { statusAdd: [{ type: 'hex', pct: 0.005 }] } }),
    p5: step('Curtain Rise', 'kit', { rateMul: 1.08 }, { proc: { name: 'Curtain Rise', every: 5, damageMul: 1.5, status: [S.stun(0.3)] } }),
    p6: step('Midnight Encore', 'cap', { damageMul: 1.09 }, { ult: { haste: 0.1 }, proc: { every: 4, damageMul: 1.8 } }),
  },
  // Seiran, SSR hero
  seiran: {
    p2: step('Spark Drill', 'kit', { damageMul: 1.05 }, { chain: 1 }),
    p3: step('Flight Plan', 'kit', { damageMul: 1.07 }, { ult: { haste: 0.1 } }),
    p4: step('Thunder Lance', 'kit', { rateMul: 1.07 }, { proc: { name: 'Thunder Lance', every: 6, nova: { radius: 0.8, share: 0.3 } } }),
    p5: step('Dragon Wake', 'kit', { damageMul: 1.08 }, { ult: { damageMul: 1.5, statusAdd: [{ type: 'mark', bonus: 0.05 }] } }),
    p6: step('Storm Crown', 'cap', { rateMul: 1.09 }, { chain: 1, ult: { haste: 0.1 } }),
  },
  // The new girls (UNIT_GAPS §5). First-pass rows on safe kit keys, inside the §3.4 ceilings.
  // Azami, R spike layer: more strips on the road, armor cracking and armor pen on every strip
  azami: {
    p2: step('Roll Call', 'stat', { damageMul: 1.04 }),
    p3: step('Spare Reel', 'kit', { damageMul: 1.04 }, { trap: { max: 1 } }),
    p4: step('Hall Patrol', 'kit', { damageMul: 1.04 }, { statusAdd: [S.shred(1, 2)] }),
    p5: step('Hardened Barbs', 'kit', { damageMul: 1.04 }, { armorPen: 1 }),
    p6: step('Zero Tolerance', 'cap', { damageMul: 1.05 }, { trap: { max: 2 }, statusAdd: [S.vulnerable(0.08, 2)] }),
  },
  // Kinu, R ring shooter: pierce, crits and armor pen on every pin
  kinu: {
    p2: step('Thread Count', 'stat', { damageMul: 1.04 }),
    p3: step('Sharp Points', 'kit', { rateMul: 1.04 }, { pierce: 1 }),
    p4: step('Even Hem', 'kit', { damageMul: 1.04 }, { crit: { chance: 0.05 } }),
    p5: step('Steel Thimble', 'kit', { rateMul: 1.04 }, { armorPen: 1 }),
    p6: step('Final Fitting', 'cap', { damageMul: 1.05 }, { pierce: 1, statusAdd: [S.vulnerable(0.06, 2)] }),
  },
  // Wakaba, R buff thrower (she deals no damage of her own: her stat steps are attack speed, so her
  // drinks fly sooner; her kit steps make the drink last longer, splash wider and hit harder)
  wakaba: {
    p2: step('Warm-up Laps', 'stat', { rateMul: 1.04 }),
    p3: step('Spare Bottles', 'kit', { rateMul: 1.04 }, { drink: { shots: 2 } }),
    p4: step('Wide Toss', 'kit', { rateMul: 1.04 }, { drink: { splash: 0.2 } }),
    p5: step('Honey Lemon', 'kit', { rateMul: 1.04 }, { drink: { dmg: 0.03 } }),
    p6: step('Team Captain', 'cap', { rateMul: 1.05 }, { drink: { rate: 0.05, shots: 2 } }),
  },
  // Yuzuha, SR sentry builder: longer-lived, harder-hitting sentries, armor pen on her darts, one more sentry
  yuzuha: {
    p2: step('Morning Checklist', 'stat', { damageMul: 1.04 }),
    p3: step('Spare Batteries', 'kit', { rateMul: 1.05 }, { sentry: { ttl: 4 } }),
    p4: step('Calibrated Barrels', 'kit', { damageMul: 1.05 }, { sentry: { damage: 1 } }),
    p5: step('Armor-Piercing Darts', 'kit', { rateMul: 1.06 }, { armorPen: 1 }),
    p6: step('Full Deployment', 'cap', { damageMul: 1.07 }, { sentry: { max: 1, damage: 2 } }),
  },
  // Marumi, SR bowler: heavier balls, longer lanes, bigger blasts
  marumi: {
    p2: step('Lane Warm-up', 'stat', { damageMul: 1.04 }),
    p3: step('Polished Ball', 'kit', { rateMul: 1.05 }, { ball: { travel: 1 } }),
    p4: step('Heavy Grip', 'kit', { damageMul: 1.05 }, { ball: { speed: 1 } }),
    p5: step('Spare Pins', 'kit', { rateMul: 1.06 }, { ball: { pinDmg: 2 } }),
    p6: step('Perfect Strike', 'cap', { damageMul: 1.07 }, { ball: { travel: 1, pinDmg: 2 } }),
  },
  // Chigusa, SR nature caster: her seeds, her vine and her thorns
  chigusa: {
    p2: step('Morning Watering', 'stat', { damageMul: 1.04 }),
    p3: step('Deep Roots', 'kit', { rateMul: 1.05 }, { vine: { hold: 0.2 } }),
    p4: step('Sharp Thorns', 'kit', { damageMul: 1.05 }, { vine: { bedDmg: 1 } }),
    p5: step('Quick Sprouts', 'kit', { rateMul: 1.06 }, { vine: { every: -0.5 } }),
    p6: step('Evergreen', 'cap', { damageMul: 1.07 }, { pierce: 1, vine: { hold: 0.3, every: -0.5 } }),
  },
  // Ouka, SR campus hub (the coins track, like Momo: she deals no damage, and her coins are the
  // discount; incomeMul deepens it. Her kit steps widen her office and add to the discount)
  ouka: {
    p2: step('Office Hours', 'stat', { incomeMul: 1.03 }),
    p3: step('Bulk Orders', 'kit', { incomeMul: 1.03 }, { hub: { cutAdd: 0.02 } }),
    p4: step('Open Plan', 'kit', { incomeMul: 1.04 }, { hub: { radiusAdd: 0.2 } }),
    p5: step('Corridor Notices', 'kit', { incomeMul: 1.04 }, { hub: { cutAdd: 0.02 } }),
    p6: step('Council Seal', 'cap', { incomeMul: 1.04 }, { hub: { radiusAdd: 0.3, cutAdd: 0.03 } }),
  },
});

/** The rarity whose kinds and step slots a def uses: heroes (Nami too) are 'SSR'. */
export function potentialRarity(def) {
  if (def?.kind === 'hero') return 'SSR';
  return POTENTIAL_LADDERS.kinds[def?.rarity] ? def.rarity : 'R';
}

/** The stat track a def spends (POTENTIAL_TRACK_OF, else her rarity's; Hikari and Luna: SSR). */
export function potentialTrack(def) {
  const own = def?.id ? POTENTIAL_TRACK_OF[def.id] : null;
  if (own) return own;
  return POTENTIAL_LADDERS.statTrack[def?.rarity] ? def.rarity : 'R';
}

/** @returns {object|null} the def's own row (kit variant first), or null */
export function potentialRow(def) {
  if (!def) return null;
  if (def.kitStyle && POTENTIAL_GIRLS[`${def.id}@${def.kitStyle}`]) return POTENTIAL_GIRLS[`${def.id}@${def.kitStyle}`];
  return POTENTIAL_GIRLS[def.id] || null;
}

/**
 * The five steps of a def, P2…P6. `def.potential` (fixtures) wins over the tables; a row's missing
 * step is empty; a def without any row uses its rarity's fixture row.
 * @returns {{ step: number, name: string|null, kind: string, girl: object|null, mods: object|null }[]}
 */
export function potentialSteps(def) {
  const rarity = potentialRarity(def);
  const kinds = POTENTIAL_LADDERS.kinds[rarity];
  const row = def?.potential || potentialRow(def) || POTENTIAL_SIGNATURE_DEFAULT[rarity];
  const out = [];
  for (let step = 2; step <= MAX_POTENTIAL; step++) {
    const s = row[`p${step}`] || null;
    out.push({ step, name: s?.name || null, kind: s?.kind || kinds[step - 2], girl: s?.girl || null, mods: s?.mods || null });
  }
  return out;
}

/** Potential from a battle-stats value: whole 1…6; anything not a finite number counts as P1. */
export function potentialClamp(p) {
  if (typeof p !== 'number' || !Number.isFinite(p)) return 1;
  return Math.min(MAX_POTENTIAL, Math.max(1, Math.floor(p)));
}

const NEUTRAL = Object.freeze({ level: 1, damageMul: 1, rateMul: 1, rangeMul: 1, incomeMul: 1, dotMul: 1, sets: Object.freeze([]) });
const memo = new WeakMap();

/**
 * Everything P2…P(p) adds, folded: the whole-girl multipliers multiplied together (in step order)
 * and the ModSets in step order. P1 and anything that is not a number → neutral.
 * @returns {{ level: number, damageMul: number, rateMul: number, rangeMul: number, incomeMul: number, dotMul: number, sets: object[] }}
 */
export function potentialFold(def, p) {
  const level = potentialClamp(p);
  if (level < 2 || !def || typeof def !== 'object') return NEUTRAL;
  let slots = memo.get(def);
  if (!slots) memo.set(def, (slots = new Array(MAX_POTENTIAL + 1).fill(null)));
  if (slots[level]) return slots[level];
  const f = { level, damageMul: 1, rateMul: 1, rangeMul: 1, incomeMul: 1, dotMul: 1, sets: [] };
  for (const s of potentialSteps(def)) {
    if (s.step > level) break;
    if (s.girl) for (const k of POTENTIAL_GIRL_KEYS) if (typeof s.girl[k] === 'number') f[k] *= s.girl[k];
    if (s.mods) f.sets.push(s.mods);
  }
  Object.freeze(f.sets);
  return (slots[level] = Object.freeze(f));
}
