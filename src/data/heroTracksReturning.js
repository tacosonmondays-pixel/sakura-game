// Level tracks of the three returning heroes (roster wave, track 5): Kanna, Yoriko and Seiran.
// Same rules and canonical order as src/data/heroTracks.js (HERO_REWORK.md §3; HERO_TRACKS joins
// these in): every level from 2 to 25 grants one item that was an upgrade tier of her roster-spec
// paths (ROSTER_SPEC §5.2) or an old level milestone. Rule 1 (one attack per hero), rule 2 (stacked
// projectiles / jumps trimmed: Yoriko's threads, Seiran's jumps, Kanna's splash), rule 5 (counters
// come early: a counter's capability part moves onto an earlier tier of the same path, `also`).
// The ult ranks at Lv 10 / 20 carry ABILITIES.md §5.2 (Seiran's sky dragon, Yoriko's hex).

const withChance = (spec, chance) => (chance != null && chance < 1 ? { ...spec, chance } : spec);
const S = {
  slow: (amount, duration, chance) => withChance({ type: 'slow', amount, duration }, chance),
  stun: (duration, chance) => withChance({ type: 'stun', duration }, chance),
  shred: (amount, duration, chance) => withChance({ type: 'shred', amount, duration }, chance),
  vulnerable: (bonus, duration, chance) => withChance({ type: 'vulnerable', bonus, duration }, chance),
  soak: (duration, chance) => withChance({ type: 'soak', duration }, chance),
  ground: (duration, chance) => withChance({ type: 'ground', duration }, chance),
  mark: (bonus, duration) => ({ type: 'mark', bonus, duration }),
  hex: (pct, duration) => ({ type: 'hex', pct, duration }),
};

const L = (level, from, desc, mods, also) => (also ? { level, from, also, desc, mods } : { level, from, desc, mods });

const KANNA = {
  pathKeys: ['rhythm', 'oni', 'dance'],
  levels: [
    L(1, 'base', 'Drum strikes that build rhythm and crack armor.', {}),
    L(2, 'L2', 'Warm-up: +1 damage.', { damage: 1 }),
    L(3, 'L3', 'Festival Drumfall unlocked; +5% attack speed.', { rateMul: 1.05 }),
    L(4, 'rhythm.1', 'Steady Beat: +1 damage; 15% of strikes stagger for 0.3s.', { damage: 1, status: [S.stun(0.3, 0.15)] }, ['rhythm.3']),
    L(5, 'oni.1', 'Horn Polish: ignores 1 armor.', { armorPen: 1 }),
    L(6, 'dance.1', 'Light Feet: +0.2 range, and her drumsticks reach flyers.', { range: 0.2, canHitAir: true }, ['dance.3']),
    L(7, 'L4', 'Rolling Rhythm: focus builds 2% faster.', { ramp: { per: 0.02, max: 0 } }),
    L(8, 'rhythm.2', 'Rolling Drums: focus builds faster and reaches +20% further.', { ramp: { per: 0.03, max: 0.2 } }),
    L(9, 'oni.2', 'Heavy Mallet: +2 damage; ×1.1 against barriers.', { damage: 2, barrierMul: 1.1 }, ['oni.3']),
    L(10, 'dance.2', 'Wide Swing: strikes splash 0.4 tiles and reveal veils for 1s. Festival Drumfall rank 2.', { splash: 0.4, reveal: 1 }, ['dance.4']),
    L(11, 'L5', 'Drum Solo: +2 damage, +5% crit chance.', { damage: 2, crit: { chance: 0.05, mul: 1.5 } }),
    L(12, 'rhythm.3', 'Thunder Drum: strikes stagger 25% of the time.', { status: [S.stun(0.3, 0.25)] }),
    L(13, 'L6', 'Armor Crack: strikes shred 2 armor for 4s.', { status: [S.shred(2, 4)] }),
    L(14, 'oni.3', 'Horn Breaker: shred lasts 5s; ×1.25 against barriers.', { status: [S.shred(2, 5)], barrierMul: 1.25 }),
    L(15, 'dance.3', 'Lion Dance: splash +0.3.', { splash: 0.3 }),
    L(16, 'L7', 'Encore: +10% damage.', { damageMul: 1.1 }),
    L(17, 'rhythm.4', 'Matsuri Crescendo: +8 damage, +15% attack speed, focus reaches +40% further.', { damage: 8, ramp: { per: 0.02, max: 0.4 }, rateMul: 1.15 }),
    L(18, 'L8', 'Double Time: +10% attack speed, splash +0.2.', { rateMul: 1.1, splash: 0.2 }),
    L(19, 'oni.4', 'Iron-Splitter: +8 damage, ignores 4 armor, +30% against elites.', { armorPen: 4, damage: 8, eliteMul: 1.3 }),
    L(20, 'dance.4', 'Parade of Lanterns: +6 damage, splash +0.2, reveal for 2s. Festival Drumfall rank 3.', { damage: 6, splash: 0.2, reveal: 2 }),
    L(21, 'L9', 'Main Event: +3 damage, ignores 1 armor.', { damage: 3, armorPen: 1 }),
    L(22, 'rhythm.5', 'Endless Festival: +20 damage, +30% attack speed, focus reaches +60% further.', { damage: 20, ramp: { per: 0, max: 0.6 }, rateMul: 1.3 }),
    L(23, 'oni.5', 'Demon Queen\'s Blow: +24 damage, +40% against bosses, shreds 3 armor for 6s.', { damage: 24, bossMul: 1.4, status: [S.shred(3, 6)] }),
    L(24, 'dance.5', 'Hundred Demons\' Parade: +16 damage, splash +0.3, +30% attack speed, 30% slows.', { damage: 16, splash: 0.3, rateMul: 1.3, status: [S.slow(0.3, 1.5)] }),
    L(25, 'L10', 'Festival Queen: +15% damage, +0.2 range.', { damageMul: 1.15, range: 0.2 }),
  ],
  ultRanks: [
    { level: 10, desc: 'Rank 2: 340 damage, splash 1.8 tiles, recharges 15% faster.', effect: { damage: 340, splash: 1.8 }, cooldownMul: 0.85 },
    { level: 20, desc: 'Rank 3: 440 damage, cracks 5 armor for 8s and staggers for 1.3s.', effect: { damage: 440, status: [S.shred(5, 8), S.stun(1.3)] }, cooldownMul: 0.85 },
  ],
};

const YORIKO = {
  pathKeys: ['threads', 'theatre', 'nightmare'],
  levels: [
    L(1, 'base', 'Two marionette threads that slow.', {}),
    L(2, 'L2', 'Rehearsal: +1 damage.', { damage: 1 }),
    L(3, 'L3', 'Dream Detour unlocked; +0.2 range.', { range: 0.2 }),
    L(4, 'threads.1', 'Tight Strings: 35% slow for 1.2s; 15% of threads stun for 0.5s.', { status: [S.slow(0.35, 1.2), S.stun(0.5, 0.15)] }, ['threads.3']),
    L(5, 'theatre.1', 'Opening Bell: girls within 2.8 tiles gain +5% range.', { aura: { range: 2.8, rangeMul: 1.05 } }),
    L(6, 'nightmare.1', 'Sharp Needles: +1 damage; ignores 1 armor.', { damage: 1, armorPen: 1 }, ['nightmare.3']),
    L(7, 'L4', 'Third Thread: one more thread.', { projectiles: 1 }),
    L(8, 'threads.2', 'Long Strings: +0.3 range.', { range: 0.3 }),
    L(9, 'theatre.2', 'Applause: aura +5% attack speed; threads silence for 0.4s.', { aura: { rateMul: 1.05 }, silence: 0.4 }, ['theatre.3']),
    L(10, 'nightmare.2', 'Quick Hands: +15% attack speed. Dream Detour rank 2.', { rateMul: 1.15 }),
    L(11, 'L5', 'Second Act: +1 damage, +8% attack speed.', { damage: 1, rateMul: 1.08 }),
    L(12, 'threads.3', 'Tangled Strings: 40% slow; stun chance 20%.', { status: [S.stun(0.5, 0.2), S.slow(0.4, 1.2)] }),
    L(13, 'L6', 'Heavy Curtains: +1 damage; slows last 1.4s.', { damage: 1, status: [S.slow(0.35, 1.4)] }),
    L(14, 'theatre.3', 'Lullaby: aura shares Veil Sight; threads silence for 0.6s.', { aura: { detection: true }, silence: 0.6 }),
    L(15, 'nightmare.3', 'Nightmare Thread: ignores 1 more armor; Brittle +10% for 2s.', { armorPen: 1, status: [S.vulnerable(0.1, 2)] }),
    L(16, 'L7', 'Standing Ovation: +2 damage.', { damage: 2 }),
    L(17, 'threads.4', 'Dancing Dolls: one more thread, +3 damage.', { projectiles: 1, damage: 3 }),
    L(18, 'L8', 'Encore: +10% attack speed.', { rateMul: 1.1 }),
    L(19, 'theatre.4', 'Curtain Call: aura +12% damage and reaches 3.4 tiles.', { aura: { dmgMul: 1.12, range: 3.4 } }),
    L(20, 'nightmare.4', 'Phantom Strings: threads pierce 2 more, +6 damage. Dream Detour rank 3.', { pierce: 2, damage: 6 }),
    L(21, 'L9', 'Grand Rehearsal: +2 damage.', { damage: 2 }),
    L(22, 'threads.5', 'Grand Marionette: one more thread, +8 damage, 50% slows and 25% stuns.', { projectiles: 1, damage: 8, status: [S.slow(0.5, 2), S.stun(0.6, 0.25)] }),
    L(23, 'theatre.5', 'Midnight Masquerade: aura +18% damage and +10% speed; +8 damage.', { aura: { dmgMul: 1.18, rateMul: 1.1 }, damage: 8 }),
    L(24, 'nightmare.5', 'Theatre of Dreams: +18 damage, pierce +2, +30% attack speed.', { damage: 18, pierce: 2, rateMul: 1.3 }),
    L(25, 'L10', 'Prima Donna: +15% damage.', { damageMul: 1.15 }),
  ],
  ultRanks: [
    { level: 10, desc: 'Rank 2: pushes 6 tiles, recharges 15% faster.', effect: { pushback: 6 }, cooldownMul: 0.85 },
    { level: 20, desc: 'Rank 3: pushes 7 tiles and the hex lasts 8s.', effect: { pushback: 7, status: [S.hex(0.01, 8)] }, cooldownMul: 0.85 },
  ],
};

const SEIRAN = {
  pathKeys: ['tempest', 'skyguard', 'rain'],
  levels: [
    L(1, 'base', 'Chain lightning that prefers flyers.', {}),
    L(2, 'L2', 'Static Charge: +1 damage.', { damage: 1 }),
    L(3, 'L3', 'Dragonflight unlocked; +5% attack speed.', { rateMul: 1.05 }),
    L(4, 'tempest.1', 'Static Spark: one more jump; 10% of bolts stun for 0.3s.', { chain: 1, status: [S.stun(0.3, 0.1)] }, ['tempest.3']),
    L(5, 'skyguard.1', 'Sky Watch: ×1.2 against flyers; bolts ground flyers for 1s.', { airMul: 1.2, status: [S.ground(1)] }, ['skyguard.3']),
    L(6, 'rain.1', 'Light Rain: bolts soak for 2s; girls within 2.6 tiles attack 3% faster.', { status: [S.soak(2)], aura: { range: 2.6, rateMul: 1.03 } }, ['rain.2']),
    L(7, 'L4', 'Forked Path: one more jump.', { chain: 1 }),
    L(8, 'tempest.2', 'Charged Spear: +1 damage.', { damage: 1 }),
    L(9, 'skyguard.2', 'High Altitude: +0.4 range.', { range: 0.4 }),
    L(10, 'rain.2', 'Rain Banner: aura +5% attack speed; bolts slow 15% for 1s. Dragonflight rank 2.', { aura: { rateMul: 1.05 }, status: [S.slow(0.15, 1)] }, ['rain.3']),
    L(11, 'L5', 'Thunder Rolls: +2 damage.', { damage: 2 }),
    L(12, 'tempest.3', 'Storm Web: one more jump, splash 0.3.', { chain: 1, splash: 0.3 }),
    L(13, 'L6', 'Open Sky: +0.3 range.', { range: 0.3 }),
    L(14, 'skyguard.3', 'Skyguard: grounds flyers for 1.5s; ×1.2 against flyers.', { status: [S.ground(1.5)], airMul: 1.2 }),
    L(15, 'rain.3', 'Monsoon: aura +5% range; 25% slows.', { aura: { rangeMul: 1.05 }, status: [S.slow(0.25, 1.5)] }),
    L(16, 'L7', 'Rider\'s Focus: +10% damage.', { damageMul: 1.1 }),
    L(17, 'tempest.4', 'Storm Front: a second bolt, +5 damage.', { projectiles: 1, damage: 5 }),
    L(18, 'L8', 'Tailwind: +10% attack speed.', { rateMul: 1.1 }),
    L(19, 'skyguard.4', 'Wyvern Dive: +6 damage, ×1.3 against flyers, +25% against elites.', { damage: 6, airMul: 1.3, eliteMul: 1.25 }),
    L(20, 'rain.4', 'Typhoon Banner: aura +10% damage; +4 damage. Dragonflight rank 3.', { aura: { dmgMul: 1.1 }, damage: 4 }),
    L(21, 'L9', 'Lightning Rod: +3 damage.', { damage: 3 }),
    L(22, 'tempest.5', 'Dragon\'s Tempest: two more jumps, +14 damage, +30% attack speed.', { chain: 2, damage: 14, rateMul: 1.3 }),
    L(23, 'skyguard.5', 'Heaven Dragon Rider: +16 damage, ×1.3 against flyers, ignores 3 armor.', { damage: 16, airMul: 1.3, armorPen: 3 }),
    L(24, 'rain.5', 'Storm Sovereign: aura +12% attack speed; +12 damage and one more jump.', { aura: { rateMul: 1.12 }, damage: 12, chain: 1 }),
    L(25, 'L10', 'Eye of the Storm: +15% damage.', { damageMul: 1.15 }),
  ],
  ultRanks: [
    { level: 10, desc: 'Rank 2: the dragon flies the whole road in up to 4.5s with 8 segments; 200 damage, mark +22%.', effect: { time: 4.5, minSpeed: 4, segments: 8, damage: 200, status: [S.ground(5), S.mark(0.22, 5)] }, cooldownMul: 0.85 },
    { level: 20, desc: 'Rank 3: the whole road in up to 4s with 10 segments; 280 damage, mark +25%.', effect: { time: 4, minSpeed: 4.5, segments: 10, damage: 280, status: [S.ground(5), S.mark(0.25, 5)] }, cooldownMul: 0.85 },
  ],
};

/** The returning heroes' tracks (HERO_TRACKS joins them; the same shape as the three there). */
export const RETURNING_HERO_TRACKS = { kanna: KANNA, yoriko: YORIKO, seiran: SEIRAN };
