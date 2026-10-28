// Tryout Day's meta numbers (docs/specs/TRYOUT_DAY.md §10): Marbles, the Lunchbox, coins, the Marble Jar, the Yearbook
// and the Weekly Timetable. Kept OUT of src/data/tryout.js on purpose: that table is inside the sim id and the co-op
// data hash, and none of these numbers touches a battle, so a price or a cap can change in any deploy without
// splitting players or closing open runs. Numbers and ids only; the words live in src/ui/text/tryout.js.

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

export const TRYOUT_META = deepFreeze({
  // ---- per run (§10.1) ------------------------------------------------------------------------------
  // (perPeriod × periods + perAssignment × assignments + clear) × (1 + perGrade × (Grade − 1)), rounded; at most
  // weeklyCap a game week. A Grade's first clear pays gradeFirstClear outside the cap (solo only, §11).
  marbles: { perPeriod: 2, perAssignment: 1, clear: 6, perGrade: 0.1, weeklyCap: 150, gradeFirstClear: 10 },
  // 3 boxes a week, counted in sevenths: each period cleared fills 1/7 of a box and a run opens at most one box.
  lunchbox: { perWeek: 3, sevenths: 7, minutes: 4 },
  // coins per wave cleared: share × soloWaveCoins of the furthest cleared campaign stage in the window
  // (src/systems/freeplayRewards.js, at Normal on the first freeplay tier); at most weeklyWaves waves a week.
  coins: { share: 0.6, weeklyWaves: 150, difficulty: 'normal' },

  // ---- a full Lunchbox per content window (§10.1): at most `minutes` of that window's Hard campaign pay ----
  // Derived from the stage drop tables (tests/systems/tryoutMeta.test.js re-derives the cap from src/data/stages.js
  // and holds every box under it): per kind, the box's book EXP, its family-material points (common 1, rare 3,
  // super rare 9) and its gear-box chance each stay at or under 4 minutes of the window's best Hard chapter.
  // `mat` entries are the squad's material family (the family most of the starting three share) at that rarity.
  boxes: {
    spring: { items: [{ id: 'book_common', count: 2 }], mats: [{ rarity: 'common', count: 3 }], gear: null },
    summer: { items: [{ id: 'book_common', count: 4 }], mats: [{ rarity: 'rare', count: 1 }, { rarity: 'common', count: 1 }], gear: { id: 'gearbox_rare', chance: 0.04 } },
    autumn: { items: [{ id: 'book_rare', count: 1 }], mats: [{ rarity: 'rare', count: 1 }, { rarity: 'common', count: 1 }], gear: { id: 'gearbox_superRare', chance: 0.04 } },
  },

  // ---- the Weekly Timetable (§10.4) -----------------------------------------------------------------
  // one shared seed a game week; Grade 5 rules, everyone at the floor, Desk Supplies off; opens after a Grade 4 clear.
  weekly: { grade: 5, length: 'half', unlockGrade: 4, chest: 30 },

  // ---- the Yearbook (§10.4): every `per` stamps pay `marbles` once (outside the cap) ----------------
  yearbook: { per: 10, marbles: 5 },

  // ---- the Marble Jar (§10.3) -----------------------------------------------------------------------
  // shelf: desk (once; a perk the run config carries, switchable) · cosmetic (once) · material (a weekly stock).
  // `bit`: the item's fixed place in the owned mask (missions.counters 'ty:jar'): never reuse or renumber one.
  // desk `perk`: the key in options.tryout.players[0].perks (src/sim/tryout, solo only, never in the Weekly).
  jar: [
    { id: 'eraser', shelf: 'desk', price: 90, bit: 0, perk: 'eraser' },
    { id: 'draft7', shelf: 'desk', price: 120, bit: 1, perk: 'draft7' },
    { id: 'coins', shelf: 'desk', price: 60, bit: 2, perk: 'coins' },
    { id: 'pocket', shelf: 'desk', price: 100, bit: 3, perk: 'pocket' },
    { id: 'chalk_pink', shelf: 'cosmetic', kind: 'chalk', price: 40, bit: 4 },
    { id: 'chalk_sky', shelf: 'cosmetic', kind: 'chalk', price: 40, bit: 5 },
    { id: 'chalk_mint', shelf: 'cosmetic', kind: 'chalk', price: 40, bit: 6 },
    { id: 'chalk_gold', shelf: 'cosmetic', kind: 'chalk', price: 40, bit: 7 },
    { id: 'bd_classroom', shelf: 'cosmetic', kind: 'backdrop', price: 75, bit: 8 },
    { id: 'bd_rooftop', shelf: 'cosmetic', kind: 'backdrop', price: 75, bit: 9 },
    { id: 'bd_gate', shelf: 'cosmetic', kind: 'backdrop', price: 75, bit: 10 },
    { id: 'bd_festival', shelf: 'cosmetic', kind: 'backdrop', price: 75, bit: 11 },
    { id: 'frame_bloom', shelf: 'cosmetic', kind: 'frame', price: 150, bit: 12 },
    { id: 'pennant', shelf: 'cosmetic', kind: 'pennant', price: 100, bit: 13 },
    // weekly stock; priced below the campaign's per-minute material rate at the fastest Marble pace (the test checks)
    { id: 'sg_bundle', shelf: 'material', price: 80, perWeek: 3, items: [{ id: 'book_rare', count: 3 }] },
    { id: 'fam_pack', shelf: 'material', price: 75, perWeek: 2, mats: [{ rarity: 'rare', count: 5 }], family: true },
  ],

  // ---- missions.counters keys (numbers every build keeps; see src/systems/tryoutRewards.js) ----------
  keys: {
    marbles: 'ty:mb', week: 'ty:wk', weekMarbles: 'ty:mbw', weekBox: 'ty:lbw', weekWaves: 'ty:cw', weekJar: 'ty:jw:',
    jar: 'ty:jar', ybPaid: 'ty:ybp', weeklyDone: 'ty:wkc', coopPaid: 'ty:cpd',
    // achievement counters (src/data/achievements.js, wave 'tryout')
    half: 'ty:half', full: 'ty:full', spotless: 'ty:spot', ticked: 'ty:tick', dare: 'ty:dare', seen: 'ty:seen', lr: 'ty:lr',
    window: 'ty:win', moves: 'ty:mv', grade: 'ty:grade',
  },
});

export const JAR_MAP = Object.freeze(Object.fromEntries(TRYOUT_META.jar.map((x) => [x.id, x])));
/** The Desk Supplies' sim perk keys. */
export const PERK_KEYS = Object.freeze(TRYOUT_META.jar.filter((x) => x.shelf === 'desk').map((x) => x.perk));
