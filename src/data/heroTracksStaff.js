// Level tracks of the two academy-staff heroes of the banners wave (docs/specs/BANNERS.md §D.3, §D.4):
// Kogane (Facilities Crew Chief, SSR) and Norika (Traffic Safety Officer, SR). Same rules and canonical
// order as src/data/heroTracks.js (HERO_REWORK.md §3; HERO_TRACKS joins these in): every level from 2 to 25
// grants one item that was a tier of her old tower paths (UNIT_GAPS §5.11, §5.12) or an old level milestone.
//
// Rule 5 (counters come early) moved three capability parts onto earlier tiers of the same path (`also`),
// the only differences from the spec tables:
//   Kogane Lv 4 (drill.1) carries a light armour crack (1 for 3 s) ahead of Rock Breaker (drill.4, Lv 17);
//   Kogane Lv 9 (dozer.2) carries ×1.1 against barriers ahead of Reinforced Frame (dozer.4, Lv 19);
//   Norika Lv 9 (guard.2) carries a 15% slow ahead of Speed Bumps (guard.3, Lv 14).
// Ult ranks at Lv 10 / 20 carry §D.3 Clear the Road and §D.4 Hold the Line.
//
// New ModSet keys (src/sim/mods.js): `moveCd` (seconds off her Move recharge), `barricade` (Norika's
// barricades, src/sim/barricades.js).

const withChance = (spec, chance) => (chance != null && chance < 1 ? { ...spec, chance } : spec);
const S = {
  slow: (amount, duration, chance) => withChance({ type: 'slow', amount, duration }, chance),
  stun: (duration, chance) => withChance({ type: 'stun', duration }, chance),
  shred: (amount, duration, chance) => withChance({ type: 'shred', amount, duration }, chance),
};

const L = (level, from, desc, mods, also) => (also ? { level, from, also, desc, mods } : { level, from, desc, mods });

const KOGANE = {
  pathKeys: ['drill', 'dozer', 'pods'],
  levels: [
    L(1, 'base', 'Rivets from Big Yellow\'s arm gun; ignore 1 armor.', {}),
    L(2, 'L2', 'Warm Engine: +1 damage.', { damage: 1 }),
    L(3, 'L3', 'Clear the Road unlocked; +5% attack speed.', { rateMul: 1.05 }),
    L(4, 'drill.1', 'Hardened Bit: +2 damage; rivets crack 1 armor for 3s.', { damage: 2, status: [S.shred(1, 3)] }, ['drill.4']),
    L(5, 'dozer.1', 'Treads: Move recharges 4s faster.', { moveCd: 4 }),
    L(6, 'pods.1', 'Pod Mount: +1 damage; rivets reach flyers.', { damage: 1, canHitAir: true }),
    L(7, 'L4', 'Site Survey: Veil Sight.', { detection: true }),
    L(8, 'drill.2', 'Long Drill: +0.3 range; ignores 1 more armor.', { range: 0.3, armorPen: 1 }),
    L(9, 'dozer.2', 'Big Blade: hits push back 0.15 tiles (not bosses); ×1.1 against barriers.', { knockback: 0.15, barrierMul: 1.1 }, ['dozer.4']),
    L(10, 'pods.2', 'Twin Pods: +1 rivet per shot. Clear the Road rank 2.', { projectiles: 1 }),
    L(11, 'L5', 'Steady Grip: +2 damage, +5% crit chance.', { damage: 2, crit: { chance: 0.05, mul: 1.5 } }),
    L(12, 'drill.3', 'Core Drill: ignores 2 more armor; ×1.2 against elites.', { armorPen: 2, eliteMul: 1.2 }),
    L(13, 'L6', 'Extra Lap: +0.2 range, +1 damage.', { range: 0.2, damage: 1 }),
    L(14, 'dozer.3', 'Bulldozer Blade: push +0.15; 20% of hits stagger for 0.3s.', { knockback: 0.15, status: [S.stun(0.3, 0.2)] }),
    L(15, 'pods.3', 'Swarm Pods: rivets splash 0.4 tiles.', { splash: 0.4 }),
    L(16, 'L7', 'Crew Pride: +10% damage.', { damageMul: 1.1 }),
    L(17, 'drill.4', 'Rock Breaker: +10 damage; hits crack 2 armor for 4s. Pod Salvo rank 2.', { damage: 10, status: [S.shred(2, 4)] }),
    L(18, 'L8', 'Second Wind: +10% attack speed.', { rateMul: 1.1 }),
    L(19, 'dozer.4', 'Reinforced Frame: +6 damage; ×1.25 against barriers.', { damage: 6, barrierMul: 1.25 }),
    L(20, 'pods.4', 'Heavy Ordnance: +8 damage; splash +0.4. Clear the Road rank 3.', { damage: 8, splash: 0.4 }),
    L(21, 'L9', 'Fine-Tuned: +3 damage.', { damage: 3 }),
    L(22, 'drill.5', 'Mountain Mover: +22 damage; ×1.4 against bosses; 25% of hits stun for 0.4s.', { damage: 22, bossMul: 1.4, status: [S.stun(0.4, 0.25)] }),
    L(23, 'dozer.5', 'Demolition Day: +14 damage; push +0.2; +25% attack speed.', { damage: 14, knockback: 0.2, rateMul: 1.25 }),
    L(24, 'pods.5', 'Full Payload: +1 rivet, +12 damage, splash +0.2; 15% of hits stun for 0.3s.', { projectiles: 1, damage: 12, splash: 0.2, status: [S.stun(0.3, 0.15)] }),
    L(25, 'L10', 'Leave It to Big Yellow!: +15% damage.', { damageMul: 1.15 }),
  ],
  ultRanks: [
    { level: 10, desc: 'Rank 2: plows 10 tiles for 180 damage, pushes 2.5 tiles, recharges 15% faster.', effect: { length: 10, damage: 180, push: 2.5 }, cooldownMul: 0.85 },
    { level: 20, desc: 'Rank 3: plows 12 tiles for 260 damage, pushes 3 tiles (minibosses 1.5) and stuns for 1s.', effect: { length: 12, damage: 260, push: 3, pushMini: 1.5, status: [S.stun(1)] }, cooldownMul: 0.85 },
  ],
};

const NORIKA = {
  pathKeys: ['barrier', 'guard', 'detour'],
  levels: [
    L(1, 'base', 'STOP waves; one barricade on the road in range.', {}),
    L(2, 'L2', 'Morning Patrol: +1 damage.', { damage: 1 }),
    L(3, 'L3', 'Hold the Line unlocked; +5% attack speed.', { rateMul: 1.05 }),
    L(4, 'barrier.1', 'Sandbags: barricade budget +80.', { barricade: { budget: 80 } }),
    L(5, 'guard.1', 'Whistle: +0.4 range.', { range: 0.4 }),
    L(6, 'detour.1', 'Reflective Paint: +1 damage; waves reach flyers.', { damage: 1, canHitAir: true }),
    L(7, 'L4', 'Bright Sash: Veil Sight; held enemies are revealed.', { detection: true, barricade: { reveal: true } }),
    L(8, 'barrier.2', 'Double Barrier: +1 barricade.', { barricade: { count: 1 } }),
    L(9, 'guard.2', 'Crosswalk Drill: +10% attack speed; waves slow 15% for 1s.', { rateMul: 1.1, status: [S.slow(0.15, 1)] }, ['guard.3']),
    L(10, 'detour.2', 'Bounce Back: an enemy that reaches a full barricade is knocked back 0.4 tiles once. Hold the Line rank 2.', { barricade: { bounce: 0.4 } }),
    L(11, 'L5', 'Clipboard: +2 damage, +5% crit chance.', { damage: 2, crit: { chance: 0.05, mul: 1.5 } }),
    L(12, 'barrier.3', 'Steel Barriers: budget +300; held enemies take +15% damage.', { barricade: { budget: 300, held: 0.15 } }),
    L(13, 'L6', 'Extra Patrol: +0.3 range.', { range: 0.3 }),
    L(14, 'guard.3', 'Speed Bumps: waves slow 25% for 1.5s.', { status: [S.slow(0.25, 1.5)] }),
    L(15, 'detour.3', 'Detour Sign: at forks, enemies her waves hit before the fork take the longer branch; on maps without forks, barricades +50% budget.', { barricade: { detour: true } }),
    L(16, 'L7', 'Patrol Captain: +10% damage.', { damageMul: 1.1 }),
    L(17, 'barrier.4', 'Water-filled Barriers: budget +1,000; a barricade that breaks splashes a 50% slow for 2s. Whistle Stop rank 2.', { barricade: { budget: 1000, breakSlow: 0.5 } }),
    L(18, 'L8', 'Second Whistle: +10% attack speed.', { rateMul: 1.1 }),
    L(19, 'guard.4', 'School Zone: +1 barricade; slows 35%.', { barricade: { count: 1 }, status: [S.slow(0.35, 1.5)] }),
    L(20, 'detour.4', 'Long Way Round: enemies a barricade releases are slowed 20% for 3s; knockback +0.15. Hold the Line rank 3.', { barricade: { releaseSlow: 0.2 }, knockback: 0.15 }),
    L(21, 'L9', 'Steady Steps: +3 damage.', { damage: 3 }),
    L(22, 'barrier.5', 'Fortress Gate: budget +3,000; minibosses push at half rate; rebuilt in 1s.', { barricade: { budget: 3000, miniHalf: true, rebuild: 1 } }),
    L(23, 'guard.5', 'Road Closed: +8 damage; +25% attack speed; Hold the Line +1 barricade.', { damage: 8, rateMul: 1.25, barricade: { lineAdd: 1 } }),
    L(24, 'detour.5', 'One-Way Street: once per wave, the first 20 enemies to reach her barricades are sent back 6 tiles (minibosses 2, bosses 0).', { barricade: { oneWay: 20 } }),
    L(25, 'L10', 'Officer of the Year: +15% damage.', { damageMul: 1.15 }),
  ],
  ultRanks: [
    { level: 10, desc: 'Rank 2: budget 700 each for 15s, held enemies take +15%, recharges 10% faster.', effect: { budget: 700, duration: 15, held: 0.15 }, cooldownMul: 0.9 },
    { level: 20, desc: 'Rank 3: 3 barricades of 1,200 for 18s that also stop minibosses; held enemies take +20%.', effect: { count: 3, budget: 1200, duration: 18, mini: true, held: 0.2 }, cooldownMul: 1 },
  ],
};

/** The staff heroes' tracks (HERO_TRACKS joins them; the same shape as the others). */
export const STAFF_HERO_TRACKS = { kogane: KOGANE, norika: NORIKA };
