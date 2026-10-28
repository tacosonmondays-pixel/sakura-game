// Tryout Day, the roguelike run mode (docs/specs/TRYOUT_DAY.md): the run table. Numbers and game ids
// only; every name and description lives in src/ui/text/tryout.js, so a wording fix never changes the
// sim id. The run code (src/sim/tryout/*) reads only this table, so the table is inside the sim id and
// in coopVersion()'s data hash; a change to it is a change to the battle.
//
// Rarity index everywhere: 0 R · 1 SR · 2 SSR · 3 UR · 4 LR.
// Card values are the R value; a scaling card's value at rarity r is value × SCALE[r].
//
// Two kinds of `mods` (M0 review): the scaling cards (Everyone, Group, Personal, Placement, build and capstone
// cards) carry RUN KEYS, plain "+fraction" or "+points" numbers that src/sim/tryout/pep.js sums per girl, caps
// (§4.4) and only then turns into one ModSet: damageMul / rateMul / airMul / eliteMul / bossMul / barrierMul and
// classMul {class} become ×(1 + Σ); range, pierce, splash and reveal add; critChance and critMul become
// crit { chance, mulAdd }; costCut, dotMul, auraRange and auraPoints are run-only keys pep.js applies itself.
// RUN_KEYS lists them (tests/sim/tryoutData.test.js holds every card to it). Hidden Talents carry RAW ModSets,
// applied exactly as written (mods.js semantics: damageMul 0.55 is ×0.55, aura.rateMul 1.08 is ×1.08); a talent
// marked `draft` still names keys mods.js does not have and is checked before it ships.
// `ship`: in the first public ship (53 cards); `m1`: in the first fun slice (20 cards). A card or an
// assignment without `ship` stays in the table for later content updates and is never offered.

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

/** The table's schema version; the run records tryoutTableVersion() (a hash of every number) instead (§12.5). */
export const TRYOUT_TABLE_VERSION = 1;

export const RARITIES = Object.freeze(['R', 'SR', 'SSR', 'UR', 'LR']);
/** A scaling card's value × this at R, SR, SSR, UR, LR (§4.2). */
export const SCALE = Object.freeze([1, 1.5, 2, 2.5, 3]);

/** The 29 students who can try out (Tenka, the ultimate tower, is not a student; heroes never try out). */
export const TRYOUT_STUDENTS = Object.freeze([
  'aoi', 'rei', 'yuki', 'momo', 'akane', 'sango', 'kage', 'umeko', 'shiro', 'midori', 'suzu', 'raika', 'miko',
  'hotaru', 'kaede', 'chika', 'fuu', 'hana', 'ruri', 'noa', 'iroha', 'ena', 'azami', 'kinu', 'wakaba', 'yuzuha',
  'ouka', 'chigusa', 'marumi',
]);
/** Heroes everyone may take (owned or not, §2.2). */
export const FREE_HEROES = Object.freeze(['hikari', 'nami']);
/** The run keys a scaling card may carry (see the header). */
export const RUN_KEYS = Object.freeze(['damageMul', 'rateMul', 'range', 'critChance', 'critMul', 'airMul', 'eliteMul', 'bossMul', 'barrierMul',
  'classMul', 'pierce', 'splash', 'reveal', 'costCut', 'dotMul', 'auraRange', 'auraPoints']);
/** Girls whose reach is map-wide: never offered a reach card (§4.5 filter 5). */
export const MAP_WIDE = Object.freeze(['shiro']);

export const TRYOUT = deepFreeze({
  // ---- run lengths (§2.2) ------------------------------------------------------------------------
  // picks[i] = the period after which pick i+1 opens; tryoutPicks = 1-based picks that are Tryout picks;
  // breaks: period → break id (after that period's pick); blocks: first period of each seat / family block.
  lengths: {
    half: {
      periods: 7, wavesPerPeriod: 4, picks: [1, 2, 3, 4, 5, 6], tryoutPicks: [1], examPrep: 6,
      breaks: { 3: 'recess', 6: 'cleaning' }, blocks: [1, 4, 7], minibossWaves: [12, 24], bossWave: 28,
      bands: ['early', 'early', 'mid', 'mid', 'late', 'late'], lrCap: 1,
    },
    full: {
      periods: 12, wavesPerPeriod: 4, picks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], tryoutPicks: [1, 5], examPrep: 11,
      breaks: { 3: 'recess', 7: 'lunch', 11: 'cleaning' }, blocks: [1, 4, 8, 12], minibossWaves: [12, 28, 44], bossWave: 48,
      bands: ['early', 'early', 'early', 'early', 'mid', 'mid', 'mid', 'mid', 'late', 'late', 'late'], lrCap: 2,
    },
  },

  // ---- Grades and content windows (§7) -------------------------------------------------------------
  // hpMul: on top of the window's hpScale; seats / passes / erasers: the Grade's counts.
  grades: [
    null,
    { n: 1, window: 'spring', hpMul: 1, hearts: 60, seats: 3, passes: 3, erasers: 2, bossLeak: 40 },
    { n: 2, window: 'spring', hpMul: 1.2, hearts: 60, seats: 3, passes: 3, erasers: 2, bossLeak: 40 },
    { n: 3, window: 'summer', hpMul: 1.1, hearts: 60, seats: 3, passes: 3, erasers: 2, bossLeak: 40 },
    { n: 4, window: 'summer', hpMul: 1.25, hearts: 60, seats: 2, passes: 3, erasers: 2, bossLeak: 40 },
    { n: 5, window: 'summer', hpMul: 1.4, hearts: 60, seats: 2, passes: 3, erasers: 1, bossLeak: 40 },
    { n: 6, window: 'autumn', hpMul: 1.4, hearts: 60, seats: 2, passes: 3, erasers: 1, bossLeak: 60 },
    { n: 7, window: 'autumn', hpMul: 1.4, hearts: 60, seats: 2, passes: 2, erasers: 1, bossLeak: 60, aceBar: 75 },
    { n: 8, window: 'autumn', hpMul: 1.5, hearts: 60, seats: 2, passes: 2, erasers: 1, bossLeak: 60, aceBar: 75, affixFrom: 3, strict: 15 },
    { n: 9, window: 'autumn', hpMul: 1.5, hearts: 60, seats: 2, passes: 2, erasers: 1, bossLeak: 60, aceBar: 75, affixFrom: 3, strict: 15, snackHalf: true },
    { n: 10, window: 'autumn', hpMul: 1.5, hearts: 55, seats: 2, passes: 2, erasers: 1, bossLeak: 60, aceBar: 75, affixFrom: 3, strict: 15, snackHalf: true, arrivalDown: 1 },
    { n: 11, window: 'autumn', hpMul: 1.5, hearts: 50, seats: 2, passes: 2, erasers: 1, bossLeak: 60, aceBar: 75, affixFrom: 3, strict: 15, snackHalf: true, arrivalDown: 1, escort: true },
    { n: 12, window: 'autumn', hpMul: 1.52, hearts: 20, seats: 2, passes: 2, erasers: 1, bossLeak: 60, aceBar: 75, affixFrom: 3, strict: 15, snackHalf: true, arrivalDown: 1, escort: true, noHeal: true },
  ],
  /** Campaign clears that open a window (§7): Spring after 2-5, Summer after 4-5, Autumn after 8-5. */
  windows: {
    spring: {
      chapters: [1, 2, 3], unlock: '2-5', hpScale: 3.3, cashScale: 1.4, budget: { start: 8, growth: 1.12 },
      families: ['slime', 'goblin', 'orc', 'beast', 'lizard', 'ghost'],
      minibosses: ['slime_prince', 'goblin_machine'], bosses: ['grave_lych', 'iron_colossus'],
      maps: ['sakura_terrace', 'sakura_loop', 'lake_shore', 'shrine_steps'],
    },
    summer: {
      chapters: [1, 2, 3, 4, 5, 6], unlock: '4-5', hpScale: 7.0, cashScale: 2.0, budget: { start: 9, growth: 1.12 },
      families: ['slime', 'goblin', 'orc', 'beast', 'lizard', 'ghost', 'ghoul', 'plant', 'construct'],
      minibosses: ['slime_prince', 'goblin_machine', 'orc_general', 'oni_champion'], bosses: ['grave_lych', 'iron_colossus', 'dragon_ashwing'],
      maps: ['sakura_terrace', 'sakura_loop', 'lake_shore', 'shrine_steps', 'mountain_pass', 'marsh_boardwalk', 'foundry_belt'],
    },
    autumn: {
      chapters: [1, 2, 3, 4, 5, 6, 7, 8], unlock: '8-5', hpScale: 6.5, cashScale: 2.6, budget: { start: 10, growth: 1.12 },
      families: ['slime', 'goblin', 'orc', 'beast', 'lizard', 'ghost', 'ghoul', 'plant', 'construct', 'oni', 'fae', 'dragon'],
      minibosses: ['slime_prince', 'goblin_machine', 'orc_general', 'oni_champion'],
      bosses: ['grave_lych', 'iron_colossus', 'dragon_ashwing', 'fp_foundry_titan', 'fp_gloom_regent', 'fp_hyakki_daimyo', 'fp_eclipse_wyrm'],
      maps: ['sakura_terrace', 'sakura_loop', 'lake_shore', 'shrine_steps', 'mountain_pass', 'marsh_boardwalk', 'foundry_belt', 'festival_square', 'peaks_ascent'],
    },
  },
  /** The generated stage (§2.3): start coins, the period-end bonus, elites from this wave of a block on. */
  stage: { startCash: 700, periodBonus: { base: 100, perPeriod: 50 }, eliteFrom: 3, spacing: 0.8, groups: 3, coopHpMul: 1.6 },

  // ---- squad, Tryouts and Loaners (§5) ------------------------------------------------------------
  squad: { start: 3, draft: 6, draftOwned: 4, redraws: 1, soloMax: 8, coopMax: 5, girlChance: 30, forceAfter: 3, owned: 1.5, notOwned: 1, varsityWeight: 0.5 },
  // the draft's six always hold 2 strikers, 1 girl who hits flyers at tier 0 and 1 Control or Support girl
  draftNeeds: { strikers: 2, antiAir: 1, controlSupport: 1 },

  // ---- the band (§9.2): Run Level floor and the cap on account stats ------------------------------
  runLevel: { first: 50, last: 74 },
  perLevel: { damage: 0.018, rate: 0.004 },
  // cap: the most an account stat counts for inside a run (≈ a Lv 60, gate 5, 2-star girl with +40 % gear). Every
  // key is clamped between the floor (damage and speed; 1 or 0 for the rest) and its cap, except costMul, where
  // lower is better: it is clamped to [costMul, 1], so the band never gives a cut a girl does not have.
  bandCap: { damageMul: 3.0, rateMul: 1.5, rangeMul: 1.1, critChance: 0.15, critMul: 1.5, armorPen: 3, costMul: 0.9, auraPct: 0.1, pierceK: 20, dotMul: 1.2, auraRangeMul: 1.1, ultHaste: 0.1, potential: 3 },

  // ---- rarity (§3.4) ------------------------------------------------------------------------------
  // odds[band][credits] = [R, SR, SSR, UR, LR] in percent (rows sum to 100)
  odds: {
    early: [[60, 32, 8, 0, 0], [40, 45, 14, 1, 0], [0, 72, 24, 4, 0], [0, 0, 85, 13, 2], [0, 0, 70, 24, 6]],
    mid: [[45, 38, 15, 2, 0], [28, 47, 21, 4, 0], [0, 62, 31, 6, 1], [0, 0, 78, 18, 4], [0, 0, 60, 30, 10]],
    late: [[30, 42, 22, 5, 1], [15, 45, 30, 8, 2], [0, 50, 36, 11, 3], [0, 0, 68, 24, 8], [0, 0, 50, 35, 15]],
  },
  creditsMax: 4,
  // Teacher's Note: after rStreak R picks in a row the next is ≥ SR; after noSsr picks without SSR+ the next is ≥ SSR
  teacher: { rStreak: 2, noSsr: 4, examPrep: 1 },
  erasers: { perfectBonus: 1, max: 3 },
  handIn: { base: 150, perPeriod: 50 },

  // ---- assignments (§3.1); Grade 1 numbers ---------------------------------------------------------
  // slot 1 is always Full Hearts; slots 2 and 3 are drawn. `coop`: slot 3 drawable per player in co-op.
  assignments: {
    a_hearts: { slot: 1, ship: true, m1: true },
    a_ace: { slot: 2, ship: true, m1: true, bar: 65 },
    a_speed: { slot: 2, ship: true, m1: true, secs: 8 },
    a_quick: { slot: 2, ship: true, m1: true, secs: 12, needs: 'boss' },
    a_sky: { slot: 2, ship: true, half: 512, needs: 'flyers' },
    a_guest: { slot: 2, ship: true, share: 20, lastShare: 12 },
    a_budget: { slot: 3, ship: true, m1: true, coop: true, share: 40, min: 600, from: 2 },
    a_save: { slot: 3, ship: true, share: 60, from: 2, solo: true },
    a_star: { slot: 3, ship: true, coop: true, share: 35 },
    a_show: { slot: 3, ship: true, coop: true, kills: [0, 0, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72] },
    a_noreturn: { slot: 3, ship: true, m1: true, coop: true },
    a_small: { slot: 3, ship: true, m1: true, coop: true, max: 1 },
    a_window: { slot: 3, ship: true, coop: true, share: 35 },
    a_team: { slot: 3, ship: true, coop: true, types: 4, share: 8 },
    a_learner: { slot: 3, ship: true, m1: true, coop: true, tiers: 4 },
    a_finish: { slot: 3, ship: true, coop: true, ults: 2 },
    a_tell: { slot: 3, needs: 'abilities', uses: 5 },
  },

  // ---- score (§3.3) -------------------------------------------------------------------------------
  score: { points: { normal: 10, elite: 40, miniboss: 150, boss: 600 }, leakMul: 2, dareMul: [11, 10], perAssignment: 300, perHeart: 20 },

  // ---- Pep Talk caps per girl type (§4.4); fractions, points and tiles ------------------------------
  caps: {
    damageMul: 1.0, rateMul: 0.5, range: 0.5, critChance: 0.1, critMul: 0.25, pierce: 1, projectiles: 1, chain: 2, splash: 0.25,
    vs: 0.3, costCut: 0.3, runDamage: 2.5, reveal: 3, auraPoints: 0.1,
  },

  // ---- Window Seats and Hall Passes (§6) -----------------------------------------------------------
  seats: { solo: 3, coop: 4, radius: 0.9, dmg: 0.25, reach: 0.7, dmgCap: 0.5, reachCap: 0.7, minDist: 1.2, maxDist: 2.6, spacing: 3 },
  passes: { max: 5 },
  snack: { heal: 15, fullMax: 5, coopHeal: 8 },
  heartsMaxRise: 50,

  // ---- co-op windows (§11) -------------------------------------------------------------------------
  // an open pick or break resolves itself after this many lockstep ticks (90 s at 1×; 45 s of real time at 2×)
  coopTimeoutTicks: 5400,

  // ---- Double Dare (§8.3): the curse is one of these spawn mods (the freeplay affixes) ------------
  dares: [
    { id: 'swift', speed: 1.2 },
    { id: 'regen', traits: { regen: { pct: 0.02, delay: 2 } } },
    { id: 'armored', armor: 3 },
    { id: 'shielded', barrierPct: 0.3 },
  ],

  // ---- Subjects (§2.4) ----------------------------------------------------------------------------
  subjects: {
    subj_science: { rule: 'alchemists_mist' },
    subj_pe: { rule: 'tailwind' },
    subj_music: { rule: 'firefly_chorus' },
    subj_festival: { rule: 'festival_encore' },
    subj_shop: { rule: 'supply_ship' },
    subj_homeec: { rule: 'petal_sanctuary' },
    subj_night: { rule: 'lunar_eclipse' },
    subj_lit: { rule: 'moonlit_blessing' },
    subj_geo: { rule: 'changing_tides' },
    subj_winter: { rule: 'snowbell_blizzard' },
    subj_history: { rule: 'rear_ambush', backGate: true },
    subj_art: { rule: null, seatAdd: 1 },
  },

  // ---- arrival packages by pick rarity (§5): tiers on a path she picks, Varsity, her Hidden Talent --
  arrival: [{ tier: 0 }, { tier: 2 }, { tier: 3 }, { tier: 3, varsity: true }, { tier: 4, varsity: true, talent: true }],
  varsity: { damageMul: 0.15, rateMul: 0.1, costCut: 0.1 },

  // ---- rewards (§10) ------------------------------------------------------------------------------
  marbles: { perPeriod: 2, perAssignment: 1, clear: 6, perGrade: 0.1, weeklyCap: 150, gradeFirstClear: 10 },
  lunchbox: { perWeek: 3 },
  coins: { share: 0.6, weeklyWaves: 150 },
});

/**
 * Pep Talk cards (§4.3). Keys:
 *   group   everyone | group | personal | board | placement | talent | build | capstone
 *   mods    the ModSet a card adds per rarity step (R value; × SCALE[r] for scaling cards)
 *   rar     the rarities it can come at (scaling cards: every one; a fixed card: one)
 *   set     a Group card's set: { attackType } | { element: [..] } | { category }
 *   unit    a Hidden Talent's girl
 *   one     one of a kind (team: one per team in co-op; a second taker on the same tick gets Big Breakfast)
 *   econ  an economy card (never in the last 2 picks)    solo  reads a wallet
 *   next    changes the next pick (never at the last pick)    pair  needs both halves in the squad
 *   draw    its drawback, as data the run code applies (UR and LR cards)
 */
const ALL = [0, 1, 2, 3, 4];
export const PEP_CARDS = deepFreeze({
  // Everyone (8)
  E01: { group: 'everyone', rar: ALL, mods: { damageMul: 0.08 }, ship: true, m1: true },
  E02: { group: 'everyone', rar: ALL, mods: { rateMul: 0.05 }, ship: true, m1: true },
  E03: { group: 'everyone', rar: ALL, mods: { range: 0.15 }, ship: true, m1: true },
  E04: { group: 'everyone', rar: ALL, mods: { airMul: 0.12 }, ship: true, m1: true },
  E05: { group: 'everyone', rar: ALL, mods: { classMul: { heavy: 0.12, scaled: 0.12 } }, ship: true, m1: true },
  E06: { group: 'everyone', rar: ALL, mods: { eliteMul: 0.12, bossMul: 0.12 }, ship: true, m1: true },
  E07: { group: 'everyone', rar: ALL, mods: { barrierMul: 0.2 }, ship: true, m1: true },
  // Team Huddle: SR+ only, its own steps (SR +6 / +3, SSR +8 / +4, UR +10 / +5, LR +12 / +6)
  E08: { group: 'everyone', rar: [1, 2, 3, 4], steps: [null, { damageMul: 0.06, rateMul: 0.03 }, { damageMul: 0.08, rateMul: 0.04 }, { damageMul: 0.1, rateMul: 0.05 }, { damageMul: 0.12, rateMul: 0.06 }], ship: true, m1: true },
  // Group (8): offered with 2 squad girls in the set (1 at SSR and above)
  G01: { group: 'group', set: { attackType: 'pierce' }, rar: ALL, mods: { damageMul: 0.12 }, ssrPlus: { pierce: 1 }, ship: true },
  G02: { group: 'group', set: { attackType: 'blast' }, rar: ALL, mods: { damageMul: 0.12, splash: 0.1 }, ship: true },
  G03: { group: 'group', set: { attackType: 'slash' }, rar: ALL, mods: { damageMul: 0.14, critChance: 0.02 }, ship: true },
  G04: { group: 'group', set: { attackType: 'mystic' }, rar: ALL, mods: { damageMul: 0.12, classMul: { warded: 0.08 } }, ship: true },
  G05: { group: 'group', set: { attackType: 'holy' }, rar: ALL, mods: { damageMul: 0.12, reveal: 1 }, revealStep: 0.5, ship: true },
  G06: { group: 'group', set: { element: ['fire', 'frost', 'lightning', 'poison', 'water'] }, rar: ALL, mods: { damageMul: 0.1, dotMul: 0.15 }, ship: true },
  G07: { group: 'group', set: { category: 'control' }, rar: ALL, mods: { rateMul: 0.08, range: 0.15 }, ship: true },
  G08: { group: 'group', set: { category: 'support' }, rar: ALL, mods: { auraRange: 0.2, auraPoints: 0.02 }, ship: true },
  // Personal (6 templates × any squad girl)
  P01: { group: 'personal', rar: ALL, mods: { damageMul: 0.16 }, ship: true, m1: true },
  P02: { group: 'personal', rar: ALL, mods: { rateMul: 0.1 }, ship: true, m1: true },
  P03: { group: 'personal', rar: ALL, mods: { range: 0.3 }, reach: true, ship: true, m1: true },
  P04: { group: 'personal', rar: ALL, mods: { costCut: 0.08 }, ship: true, m1: true },
  P05: { group: 'personal', rar: ALL, mods: { critChance: 0.04, critMul: 0.1 }, ship: true, m1: true },
  P06: { group: 'personal', rar: ALL, refills: [1, 1, 2, 2, 3], maxTier: 3, ship: true, m1: true },
  // Board (8)
  B01: { group: 'board', rar: [0, 1], now: [200, 350], perWave: [30, 50], waves: 8, econ: true, ship: true, m1: true },
  B02: { group: 'board', rar: [0, 1], bounty: [1, 2], econ: true, ship: true, m1: true },
  B03: { group: 'board', rar: [0, 1, 2], heal: [15, 25, 40], maxHearts: [5, 8, 12], heals: true, ship: true, m1: true },
  B04: { group: 'board', rar: [1, 2], seatDmg: [null, 0.35, 0.4], seatAdd: [0, 0, 1], one: true, team: true, ship: true, m1: true }, // (no reach steps: the seat reach cap is the base +0.7, M2)
  B05: { group: 'board', rar: [1], passes: 1, one: true, team: true, ship: true, m1: true },
  B06: { group: 'board', rar: [1], share: 10, max: 300, one: true, solo: true, ship: true, m1: true },
  B07: { group: 'board', rar: [3], cards: 1, erasers: 1, one: true, next: true, draw: { handInCoins: 0 }, ship: true },
  B08: { group: 'board', rar: [3], squad: 1, tryoutNext: true, one: true, next: true, draw: { maxHearts: -10 }, ship: true },
  // Placement (2), folded in recomputeBuffs only when buffs are dirty
  L01: { group: 'placement', rar: ALL, mods: { rateMul: 0.05 }, near: 1.25, ship: true },
  L02: { group: 'placement', rar: ALL, mods: { damageMul: 0.08 }, alone: 1.75, ship: true },
  // Hidden Talents (SSR, one per girl; `ship` = the first 12): RAW ModSets (see the header)
  T_aoi: { group: 'talent', unit: 'aoi', rar: [2, 3], mods: { attackType: 'holy', detection: true }, ship: true },
  T_rei: { group: 'talent', unit: 'rei', rar: [2, 3], mods: { canHitAir: true, range: 0.5 }, ship: true },
  T_yuki: { group: 'talent', unit: 'yuki', rar: [2, 3], mods: { status: [{ type: 'freeze', chance: 0.25, duration: 0.5 }], splash: 0.3 }, ship: true },
  T_momo: { group: 'talent', unit: 'momo', rar: [2, 3], mods: { income: { perWave: 25, interest: 0.01 } } },
  T_akane: { group: 'talent', unit: 'akane', rar: [2, 3], mods: { projectiles: 2, damageMul: 0.55 }, ship: true }, // 3 at 55 % each
  T_sango: { group: 'talent', unit: 'sango', rar: [2, 3], mods: { knockback: 0.3, canHitAir: true } },
  T_kage: { group: 'talent', unit: 'kage', rar: [2, 3], mods: { projectiles: 2, pierce: 1 }, ship: true },
  T_umeko: { group: 'talent', unit: 'umeko', rar: [2, 3], mods: { aura: { rangeAdd: 1.5, rateMul: 1.08, detection: true } } },
  T_shiro: { group: 'talent', unit: 'shiro', rar: [2, 3], mods: { pierce: 1 }, ship: true }, // (her shots never chain: M2 bench)
  T_midori: { group: 'talent', unit: 'midori', rar: [2, 3], mods: { splash: 0.4, status: [{ type: 'shred', amount: 1, duration: 3 }] } },
  T_suzu: { group: 'talent', unit: 'suzu', rar: [2, 3], mods: { trap: { max: 3 }, trapMul: 0.3 }, draft: true },
  T_raika: { group: 'talent', unit: 'raika', rar: [2, 3], mods: { chain: 3, status: [{ type: 'stun', duration: 0.3 }] }, ship: true },
  T_miko: { group: 'talent', unit: 'miko', rar: [2, 3], mods: { aura: { rangeAdd: 1.0, rateMul: 1.08 } } },
  T_hotaru: { group: 'talent', unit: 'hotaru', rar: [2, 3], mods: { maxTargets: 4, range: 0.5 }, ship: true },
  T_kaede: { group: 'talent', unit: 'kaede', rar: [2, 3], mods: { keepRamp: 0.6, canHitAir: true }, ship: true },
  T_chika: { group: 'talent', unit: 'chika', rar: [2, 3], mods: { turret: { max: 2 } }, ship: true },
  T_fuu: { group: 'talent', unit: 'fuu', rar: [2, 3], mods: { gather: 0.4 }, ship: true },
  T_hana: { group: 'talent', unit: 'hana', rar: [2, 3], mods: { mark: { bonus: 0.1, duration: 3 }, range: 0.6 } },
  T_ruri: { group: 'talent', unit: 'ruri', rar: [2, 3], mods: { relay: { reach: 1.0 }, damageMul: 1.3 } },
  T_noa: { group: 'talent', unit: 'noa', rar: [2, 3], mods: { silence: 1, reveal: 1, aura: { rangeAdd: 0.8 } } },
  T_iroha: { group: 'talent', unit: 'iroha', rar: [2, 3], mods: { relay: { reach: 1.2 }, damageMul: 1.2 } },
  T_ena: { group: 'talent', unit: 'ena', rar: [2, 3], mods: { curseMul: 0.4, curseRadius: 0.4 }, draft: true },
  T_azami: { group: 'talent', unit: 'azami', rar: [2, 3], mods: { strip: { hits: 4 } } },
  T_kinu: { group: 'talent', unit: 'kinu', rar: [2, 3], mods: { ring: { scissors: 1, travel: 0.5 } } },
  T_wakaba: { group: 'talent', unit: 'wakaba', rar: [2, 3], mods: { drink: { splash: 0.6, shots: 2 } } },
  T_yuzuha: { group: 'talent', unit: 'yuzuha', rar: [2, 3], mods: { sentry: { max: 1, netElite: true } } },
  T_ouka: { group: 'talent', unit: 'ouka', rar: [2, 3], mods: { hub: { radiusAdd: 1.0, cutAdd: 0.05 } }, draft: true },
  T_chigusa: { group: 'talent', unit: 'chigusa', rar: [2, 3], mods: { vine: { beds: 1, hold: 0.5 } }, draft: true },
  T_marumi: { group: 'talent', unit: 'marumi', rar: [2, 3], mods: { ball: { bounce: 2 } }, ship: true },
  // UR build cards (5): every one but the pairs carries its drawback
  U01: { group: 'build', rar: [3], mods: { damageMul: 0.2, rateMul: 0.1, range: 0.3 }, one: true, draw: { passes: -1 }, ship: true },
  U02: { group: 'build', rar: [3], pair: ['fire', 'frost'], one: true, draw: { othersDamage: -0.1 }, ship: true },
  U03: { group: 'build', rar: [3], pair: ['water', 'lightning'], one: true, draw: { othersDamage: -0.1 }, ship: true },
  U04: { group: 'build', rar: [3], pair: ['holy', 'pierce'], one: true, draw: { othersDamage: -0.1 }, ship: true },
  U05: { group: 'build', rar: [3], varsity: true, next: true, draw: { nextCards: 2 }, ship: true },
  // LR capstones (4): at most 1 per Half Day, 2 per Full Day
  X01: { group: 'capstone', rar: [4], mods: { damageMul: 0.35, rateMul: 0.2 }, one: true, draw: { foeHp: 0.1 }, ship: true },
  X02: { group: 'capstone', rar: [4], girls: 2, of: 4, arrival: 2, squad: 1, one: true, next: true, draw: { skipNext: true }, ship: true },
  X03: { group: 'capstone', rar: [4], seatAdd: 1, seatMax: true, one: true, team: true, draw: { passes: -1 }, ship: true },
  X04: { group: 'capstone', rar: [4], lastWave: { rateMul: 0.4, damageMul: 0.2 }, firstWave: { damageMul: -0.1 }, one: true, ship: true },
});

/** A hash of the whole run table (TRYOUT and PEP_CARDS), 8 hex digits: a save or room with another closes the run (§12.5). */
export function tryoutTableVersion() {
  const text = JSON.stringify([TRYOUT_TABLE_VERSION, TRYOUT, PEP_CARDS, TRYOUT_STUDENTS]);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
