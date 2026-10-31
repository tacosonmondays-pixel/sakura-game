// Sakura Sentinels — achievements: the shipped 30 and the expansion (owner: systems).
// Spec: docs/specs/ACHIEVEMENTS.md (§1 catalogue, §2 Honor Ribbons and titles, §3 save model). The catalogue
// source of truth is docs/specs/achievements/tools/catalog.mjs; tests/data/achievements.test.js holds the rules
// every row follows and tests/fixtures/achievements-ledger.json freezes the rewards of every shipped id.
//
// Rules that keep old saves and older cached builds safe (§1.1, §3.4):
//   - ids are permanent: never rename, reuse or delete one (retire it with `retired: true`)
//   - a shipped row's `rewards` never change; display text, `honor` and `title` may be added
//   - rewards are existing item ids only, never a ribbon or a title (cosmetics are derived from the claim)
//   - a metric may change only if it can only rise for every save
//
// Row: { id, name, desc, metric, param?, goal, rewards, cat, tier, series?, honor?, title?, hidden?, hint?,
//        since?, grind?, wave, with?, needs?, shipped?, retired? }
//   cat     ACHIEVEMENT_CATEGORIES id
//   tier    0 (no gems by rule) · 1 week 1 · 2 weeks 2–4 · 3 month 2 · 4 month 3+ · 5 capstone (null on the shipped 30)
//   series  rows with the same series show as one ladder row at their lowest unclaimed step
//   honor   the Honor Ribbon the claim grants: { no, name, cls: plain|shiny|special, fx, emblem } (art: src/art/honors.js)
//   title   the profile title the claim grants: { text, tier: std|gold|prism }; the title id IS the achievement id
//   hidden  a secret: "???" and `hint` until it is met
//   since   the release whose counter it reads ("Counts from v0.1.N")
//   wave    launch | social | codex | tryout | gear | later | act2: rows ship hidden until their feature does (ACHIEVEMENT_WAVES)
//   needs   stage ids that must all exist in this build (STAGE_MAP) before the row is live: the Gate Arc's Act II
//           rows (wave act2) light up chapter by chapter as their stages ship, never before (docs/CAMPAIGN.md "Act II")

import { STAGE_MAP, ACT2_PLAN } from './stages.js';

/** The expansion is on (M1). While false only the shipped 30 list and new ids refuse claims with 'notLive'. */
export const ACH_V2_LIVE = true;

/**
 * Feature waves whose rows are live in this build. Social, Codex and later rows light up with their feature; Act II
 * rows are on, but each one also waits for its stages (`needs`).
 */
// tryout: Tryout Day's 15 rows (docs/specs/TRYOUT_DAY.md §10.2 and §20.5; 480 gems, counted apart from the 28-day chart). Ids,
// rewards and goals freeze when the mode ships; their counters are 'ty:*' in missions.counters (src/systems/tryoutRewards.js).
// gear: the gear update's LR rows (GEAR_UPDATE.md §4.6), live with LR gear
export const ACHIEVEMENT_WAVES = Object.freeze({ launch: true, social: true, codex: true, tryout: true, gear: true, later: false, act2: true });

/** The release that starts the new counters (§1.7): new-counter rows read "Counts from v0.1.N". */
export const COUNTERS_SINCE = '0.1.30';

/** Tabs of the Achievements screen, in order (§5.1). `icon` is a uiIcon() name, `color` the tile colour. */
export const ACHIEVEMENT_CATEGORIES = Object.freeze([
  { id: 'campaign', label: 'Campaign', icon: 'map', color: '#2bb673' },
  { id: 'assault', label: 'Bounty & Assault', icon: 'assault', color: '#ff7a59' },
  { id: 'battle', label: 'Battles', icon: 'sword', color: '#ff5c8a' },
  { id: 'freeplay', label: 'Freeplay', icon: 'challenge', color: '#d6336c' },
  { id: 'together', label: 'Co-op & Clan', icon: 'heart', color: '#ff9f1c' },
  { id: 'students', label: 'Students', icon: 'students', color: '#4b9bff' },
  { id: 'gear', label: 'Gear', icon: 'upgrade', color: '#8b7bff' },
  { id: 'bestiary', label: 'Bestiary', icon: 'bestiary', color: '#d97706' },
  { id: 'academy', label: 'Academy Life', icon: 'calendar', color: '#2fb38c' },
  { id: 'secret', label: 'Secrets', icon: 'sparkle', color: '#8b7bff' },
  { id: 'codex', label: 'Codex', icon: 'wiki', color: '#5b47d6', wave: 'codex' },
  { id: 'tryout', label: 'Tryout Day', icon: 'calendar', color: '#e08a00', wave: 'tryout' },
]);

/** Every metric a row may use (src/systems/achievementMetrics.js computes each one; §1.6). */
export const ACHIEVEMENT_METRICS = Object.freeze([
  'stagesCleared', 'chapterClear', 'medals', 'medalsAll', 'chapterSets', 'stageMedals', 'kindClear', 'kindMedals',
  'bossClears', 'arenaRuns', 'challengeWave', 'bestiaryPct', 'pulls', 'maxLevel', 'maxAwaken', 'unitsOwned', 'gearRerolls',
  'killsAll', 'winsAll', 'counter', 'familiesFound', 'familyFound', 'familyKills', 'enemyKills', 'enemySetKilled',
  'formationSize', 'maxBreakthrough', 'unitsAtLevel', 'unitsAwakened', 'awakenStars', 'urOwned', 'fullSets',
  'gearReceived', 'gearEver', 'gearMaxEver', 'freeplayBest', 'freeplayExtra', 'fpTiers100', 'freeplayMark', 'lobbyBgs',
  'lessons', 'storyChapters', 'achievementsClaimed', 'ribbonsTotal', 'modeRibbons', 'perfectStages', 'ruleGold', 'bondMax',
  'chapterActClear',
]);

/** Ids that never give a ribbon, a title or a profile pin: recruit counts and luck (§1.1 rule 6). */
export const NO_COSMETIC = (id) => /^a_pulls_/.test(id) || id === 'a_units_all' || id === 'a_reroll_10';

const g = (n) => ({ id: 'gems', count: n });
const it = (id, n = 1) => ({ id, count: n });
const S = (n = 1) => it('gearbox_rare', n); // Sturdy (tier 1 only)
const O = (n = 1) => it('gearbox_superRare', n); // Ornate
const R = (n = 1) => it('gearbox_mythic', n); // Radiant
const C = (n = 1) => it('gearbox_legendary', n); // Celestial (capstones only)
const TK = it('ticket_recruit');
const hr = (no, name, cls, emblem, fx = null) => ({ no, name, cls, fx, emblem });
const tt = (text, tier = 'std') => ({ text, tier });

/** A shipped row: id, name, desc, metric, goal, rewards and param exactly as they shipped. */
const A = (cat, id, name, desc, metric, goal, rewards, param, extra = {}) => ({
  id, name, desc, metric, ...(param === undefined ? {} : { param }), goal, rewards, cat, tier: null, wave: 'launch', shipped: true, ...extra,
});
/** Chapters 1–8, for the Act II rows. */
const ACT2_CHAPTERS = [1, 2, 3, 4, 5, 6, 7, 8];
/** The planned Act II stage ids of one chapter (or of all eight): what an Act II row `needs`. */
const act2Ids = (c = null) => Object.freeze(ACT2_PLAN.filter((r) => c == null || r.chapter === c).map((r) => r.id));
/** A new row (§1.2). */
const N = (cat, id, name, desc, metric, param, goal, tier, rewards, wave, extra = {}) => ({
  id, name, desc, metric, ...(param === null ? {} : { param }), goal, rewards, cat, tier, wave, ...extra,
});

/**
 * Every achievement, shipped and new. Order is display order inside a category (series rows sort by goal).
 * src/data/missions.js re-exports this as ACHIEVEMENTS.
 */
export const ACHIEVEMENTS = [
  // ---- the shipped 30 (ids, goals and item rewards unchanged; §1.5)
  A('campaign', 'a_first_win', 'First Patrol', 'Clear stage 1-1.', 'stagesCleared', 1, [g(50), it('book_rare', 3)], undefined, { title: tt('Rookie Sentinel') }),
  ...[
    hr(1, 'Sakura Gardens Ribbon', 'plain', 'blossom'), hr(2, 'Moonlit Lakeshore Ribbon', 'plain', 'wave'),
    hr(3, 'Moonveil Shrine Ribbon', 'plain', 'torii'), hr(5, 'Ironhold Pass Ribbon', 'plain', 'peak'),
    hr(8, 'Gloomfen Marsh Ribbon', 'plain', 'lily'), hr(12, 'Clockwork Foundry Ribbon', 'plain', 'cog'),
    hr(14, 'Oni Festival Ribbon', 'plain', 'lantern'), hr(19, 'Ashwing Peaks Ribbon', 'shiny', 'wing'),
  ].map((honor, i) => {
    const c = i + 1;
    return A('campaign', `a_chapter_${c}`, `Chapter ${c} Complete`, `Clear every stage of chapter ${c}.`, 'chapterClear', 5,
      [g(100 + 25 * c), ...(c % 2 === 0 ? [it('ticket_recruit')] : [])], c,
      { series: 'chapter', honor, ...(c === 8 ? { title: tt('Summit Sentinel', 'gold') } : {}) });
  }),
  A('campaign', 'a_gold_10', 'Golden Student', 'Earn Gold medals (Hard) on 10 campaign stages.', 'medals', 10, [g(200), it('lock_pin')], 'hard', { series: 'gold' }),
  A('campaign', 'a_gold_40', 'Valedictorian', 'Earn Gold medals on 40 campaign stages.', 'medals', 40, [g(600), it('ticket_recruit', 2)], 'hard', { series: 'gold', honor: hr(20, 'Valedictorian Laurel', 'shiny', 'laurel'), title: tt('Valedictorian', 'gold') }),
  A('campaign', 'a_sakura_1', 'Nightmare Survivor', 'Earn a Sakura medal (Nightmare) on any campaign stage.', 'medals', 1, [g(150)], 'nightmare', { series: 'sakura' }),
  A('campaign', 'a_sakura_10', 'Sakura Sentinel', 'Earn Sakura medals on 10 campaign stages.', 'medals', 10, [g(400), it('crown_oni')], 'nightmare', { series: 'sakura', honor: hr(13, 'Sakura Watch Ribbon', 'plain', 'nightbloom'), title: tt('Sakura Sentinel', 'gold') }),
  A('bestiary', 'a_bestiary_25', 'Field Notes', 'Discover 25% of the bestiary.', 'bestiaryPct', 25, [g(100)], undefined, { series: 'bestiary' }),
  A('bestiary', 'a_bestiary_50', 'Monster Scholar', 'Discover 50% of the bestiary.', 'bestiaryPct', 50, [g(200)], undefined, { series: 'bestiary', title: tt('Monster Scholar') }),
  A('bestiary', 'a_bestiary_100', 'Encyclopedia Sakura', 'Discover every enemy in the bestiary.', 'bestiaryPct', 100, [g(500), it('ticket_recruit', 2)], undefined, { series: 'bestiary', honor: hr(21, 'Encyclopedia Ribbon', 'shiny', 'bookstar'), title: tt('Walking Encyclopedia', 'gold') }),
  A('students', 'a_pulls_10', 'Welcome Committee', 'Recruit 10 times.', 'pulls', 10, [g(50)]),
  A('students', 'a_pulls_100', 'Club President', 'Recruit 100 times.', 'pulls', 100, [g(200)]),
  A('students', 'a_pulls_300', 'Student Council', 'Recruit 300 times.', 'pulls', 300, [g(300), it('star_fragment', 40)]),
  A('students', 'a_level_20', 'Diligent', 'Raise any student to level 20.', 'maxLevel', 20, [g(80), it('book_superRare', 2)], undefined, { series: 'level' }),
  A('students', 'a_level_40', 'Honor Roll', 'Raise any student to level 40.', 'maxLevel', 40, [g(150), it('book_mythic')], undefined, { series: 'level' }),
  A('students', 'a_level_60', 'Perfect Score', 'Raise any student to level 60.', 'maxLevel', 60, [g(300), it('book_legendary')], undefined, { series: 'level', title: tt('Perfect Score', 'gold') }),
  A('students', 'a_awaken_1', 'Awakened', 'Awaken any student to ★1.', 'maxAwaken', 1, [g(80)], undefined, { series: 'awaken' }),
  A('students', 'a_awaken_5', 'Radiant Halo', 'Awaken any student to ★5.', 'maxAwaken', 5, [g(500)], undefined, { series: 'awaken', title: tt('Radiant Halo', 'gold') }),
  A('students', 'a_units_10', 'Growing Club', 'Own 10 students or heroes.', 'unitsOwned', 10, [g(150)], undefined, { series: 'units' }),
  // goal was UNITS.length (19 today); fixed so the roster merge never turns a met 19/19 into 19/30 (R22)
  A('students', 'a_units_all', 'Full Roster', 'Own 19 students and heroes.', 'unitsOwned', 19, [g(500), it('ticket_recruit10')], undefined, { series: 'units' }),
  // metric was 'kills' (solo only); killsAll adds co-op and freeplay kills and can only rise (R21)
  A('battle', 'a_kills_1000', 'Guardian', 'Defeat 1,000 enemies.', 'killsAll', 1000, [g(80)], undefined, { series: 'kills' }),
  A('battle', 'a_kills_25000', 'Legend of the Academy', 'Defeat 25,000 enemies.', 'killsAll', 25000, [g(300)], undefined, { series: 'kills', title: tt('Legend of the Academy') }),
  // shown as "Keen Tinkerer" (R11); the id stays, so it can never pay twice
  A('gear', 'a_reroll_10', 'Keen Tinkerer', 'Reroll gear 10 times.', 'gearRerolls', 10, [g(80), it('lock_pin')]),
  A('assault', 'a_boss_3', 'Total Assault', 'Clear all three Total Assault bosses.', 'bossClears', 3, [g(400), it('crown_dragon')], undefined, { series: 'boss', honor: hr(15, 'Assault Crown Ribbon', 'plain', 'crown') }),

  // ---- the expansion (102 rows; docs/specs/achievements/tools/catalog.mjs)
  // Campaign
  N('campaign', 'a_clear_10', 'Off to Class', 'Clear 10 campaign stages.', 'stagesCleared', null, 10, 1, [g(20), S()], 'launch', { series: 'clear' }),
  N('campaign', 'a_clear_25', 'Halfway Up the Hill', 'Clear 25 campaign stages.', 'stagesCleared', null, 25, 2, [g(50), O()], 'launch', { series: 'clear' }),
  N('campaign', 'a_gold_1', 'Going for Gold', 'Earn your first Gold medal (Hard) on a campaign stage.', 'medals', 'hard', 1, 1, [g(30), it('book_rare', 3)], 'launch', { series: 'gold' }),
  N('campaign', 'a_gold_20', 'Gold Star Student', 'Earn Gold medals on 20 campaign stages.', 'medals', 'hard', 20, 3, [g(100), O(2)], 'launch', { series: 'gold' }),
  N('campaign', 'a_sakura_20', 'Sakura in Full Bloom', 'Earn Sakura medals (Nightmare) on 20 campaign stages.', 'medals', 'nightmare', 20, 4, [g(200), R()], 'launch', { series: 'sakura' }),
  N('campaign', 'a_sakura_40', 'Thousand-Petal Sentinel', 'Earn Sakura medals on 40 campaign stages.', 'medals', 'nightmare', 40, 5, [g(300), C(), TK], 'launch', { series: 'sakura', honor: hr(28, 'Thousand Petals Ribbon', 'special', 'double', 'sakura'), title: tt('Thousand-Petal Sentinel', 'prism') }),
  N('campaign', 'a_quad_1', 'Four-Medal Report Card', 'Earn all four medals on one campaign stage.', 'medalsAll', null, 1, 2, [g(50), O()], 'launch', { series: 'quad', honor: hr(6, 'Report Card Ribbon', 'plain', 'quad') }),
  N('campaign', 'a_quad_10', 'Straight-A Semester', 'Earn all four medals on 10 campaign stages.', 'medalsAll', null, 10, 3, [g(100), R()], 'launch', { series: 'quad', title: tt('Straight-A Sensei') }),
  N('campaign', 'a_quad_40', 'Academy Laureate', 'Earn all four medals on 40 campaign stages.', 'medalsAll', null, 40, 5, [g(300), C(), TK], 'launch', { series: 'quad', honor: hr(29, "Laureate's Sunrise Ribbon", 'special', 'sunrise', 'sunrise'), title: tt('Academy Laureate', 'prism') }),
  N('campaign', 'a_goldchap_1', 'Golden Chapter', 'Earn Gold medals on every stage of one chapter.', 'chapterSets', 'hard', 1, 2, [g(50), O()], 'launch'),
  N('campaign', 'a_sakurachap_1', 'Blossoming Chapter', 'Earn Sakura medals on every stage of one chapter.', 'chapterSets', 'nightmare', 1, 3, [g(100), R()], 'launch'),
  // Act II (the Gate Arc, docs/specs/GATE_ARC.md §19 Rewards): each chapter's Act II at half the chapter row's gems
  // (848 in all) and the 80-stage goals (items and titles, no gems). Hidden until every stage they need exists.
  ...ACT2_CHAPTERS.map((c) => N('campaign', `a_ch${c}_act2`, `Chapter ${c} · Act II Complete`, `Clear every Act II stage of chapter ${c}.`,
    'chapterActClear', `${c}:2`, 5, c <= 4 ? 3 : 4, [g(Math.floor((100 + 25 * c) / 2))], 'act2', { series: 'act2', needs: act2Ids(c) })),
  N('campaign', 'a_clear_80', 'Noon Bell', 'Clear 80 campaign stages.', 'stagesCleared', null, 80, 0, [O(2)], 'act2', { series: 'clear', title: tt('Noon Bell Sentinel'), needs: act2Ids() }),
  N('campaign', 'a_gold_80', 'Gold Around the Clock', 'Earn Gold medals (Hard) on 80 campaign stages.', 'medals', 'hard', 80, 0, [R(), O()], 'act2', { series: 'gold', title: tt('Double Valedictorian'), needs: act2Ids() }),
  N('campaign', 'a_sakura_80', 'Eighty Petals', 'Earn Sakura medals (Nightmare) on 80 campaign stages.', 'medals', 'nightmare', 80, 0, [R(2)], 'act2', { series: 'sakura', title: tt('Eighty-Petal Sentinel'), needs: act2Ids() }),
  N('campaign', 'a_quad_80', 'Encore Laureate', 'Earn all four medals on 80 campaign stages.', 'medalsAll', null, 80, 0, [R(2), O()], 'act2', { series: 'quad', title: tt('Encore Laureate'), needs: act2Ids() }),
  // Bounty, Total Assault, Tactical Challenge
  N('assault', 'a_bounty_1', 'Supply Run', 'Clear any Bounty stage.', 'kindClear', 'resource', 1, 1, [g(20), it('token_bounty', 5)], 'launch', { series: 'bounty' }),
  N('assault', 'a_bounty_5', 'Errand Expert', 'Clear 5 different Bounty stages.', 'kindClear', 'resource', 5, 1, [g(30), S()], 'launch', { series: 'bounty' }),
  N('assault', 'a_bounty_15', 'Supply Captain', 'Clear all 15 Bounty stages.', 'kindClear', 'resource', 15, 3, [g(50), O(2)], 'launch', { series: 'bounty' }),
  N('assault', 'a_bountyg_15', 'Expedition Gold', 'Earn Gold medals on all 15 Bounty stages.', 'kindMedals', 'resource:hard', 15, 3, [g(100), O(2)], 'launch', { title: tt('Expedition Leader') }),
  N('assault', 'a_lib_100', 'Bookworm', 'Run the Library Courtyard 100 times (sweeps count).', 'arenaRuns', 'res-books', 100, 0, [it('book_mythic'), it('book_superRare', 5)], 'launch', { grind: true }),
  N('assault', 'a_yard_100', 'Workshop Regular', 'Run the Workshop Yard 100 times (sweeps count).', 'arenaRuns', 'res-gear', 100, 0, [it('lock_pin'), it('dice_prism')], 'launch', { grind: true }),
  N('assault', 'a_event_10', 'Festival Helper', 'Win 10 Bounty battles during the weekly double-drop event.', 'counter', 'eventWin', 10, 0, [O(), it('token_bounty', 10)], 'launch', { since: COUNTERS_SINCE }),
  N('assault', 'a_boss_1', 'Assault Debut', 'Clear any Total Assault boss.', 'bossClears', null, 1, 2, [g(50), O()], 'launch', { series: 'boss' }),
  N('assault', 'a_boss_gold_3', 'Assault Squad Leader', 'Earn Gold medals on all three Total Assault bosses.', 'kindMedals', 'boss:hard', 3, 4, [g(200), R(), it('dice_prism', 2)], 'launch', { title: tt('Assault Squad Leader', 'gold') }),
  N('assault', 'a_boss_sak_3', 'Dawn After the Storm', 'Earn Sakura medals on all three Total Assault bosses.', 'kindMedals', 'boss:nightmare', 3, 5, [g(300), C(), TK], 'launch', { honor: hr(30, 'Stormproof Ribbon', 'special', 'bolt', 'storm'), title: tt('Stormproof Sentinel', 'prism') }),
  N('assault', 'a_bosskill_100', 'Boss Patrol', 'Defeat 100 minibosses or bosses.', 'counter', 'bossKill', 100, 3, [g(50), O(2), it('token_boss', 20)], 'launch'),
  N('assault', 'a_tc_10', 'Colosseum Debut', 'Reach wave 10 in the Tactical Challenge.', 'challengeWave', null, 10, 1, [g(30), S()], 'launch', { series: 'tc' }),
  N('assault', 'a_tc_40', 'Crowd Favorite', 'Reach wave 40 in the Tactical Challenge.', 'challengeWave', null, 40, 3, [g(50), O(2)], 'launch', { series: 'tc' }),
  N('assault', 'a_tc_70', 'Colosseum Legend', 'Reach wave 70 in the Tactical Challenge (the Ashwing wave).', 'challengeWave', null, 70, 4, [g(200), R()], 'launch', { series: 'tc', title: tt('Colosseum Legend', 'gold') }),
  // Battles
  N('battle', 'a_kills_5k', 'Neighborhood Watch', 'Defeat 5,000 enemies (co-op and freeplay count).', 'killsAll', null, 5000, 1, [g(20), S()], 'launch', { series: 'kills' }),
  N('battle', 'a_kills_100k', 'Petal Storm', 'Defeat 100,000 enemies (co-op and freeplay count).', 'killsAll', null, 100000, 4, [g(150), R()], 'launch', { series: 'kills', title: tt('Petal Storm', 'gold') }),
  N('battle', 'a_wins_100', 'Patrol Veteran', 'Win 100 battles (co-op counts).', 'winsAll', null, 100, 2, [g(50), O()], 'launch', { series: 'wins' }),
  N('battle', 'a_wins_500', 'Seasoned Sentinel', 'Win 500 battles (co-op counts).', 'winsAll', null, 500, 3, [g(100), O(2)], 'launch', { series: 'wins', title: tt('Seasoned Sentinel') }),
  N('battle', 'a_flawless_10', 'Not a Petal Lost', 'Win 10 battles on Normal or Hard without losing a single life.', 'counter', 'ach:flawless', 10, 2, [g(50), O()], 'launch', { honor: hr(9, 'Petal Shield Ribbon', 'plain', 'shield'), title: tt('Flawless Guardian'), since: COUNTERS_SINCE }),
  N('battle', 'a_squad3', 'Small but Mighty', 'Win a chapter 5+ stage on Hard or Nightmare with 3 or fewer different students on the field.', 'counter', 'ach:squad3', 1, 3, [g(50), O(2)], 'launch', { title: tt('Small but Mighty'), since: COUNTERS_SINCE }),
  N('battle', 'a_ults_100', 'Signature Move', "Use your hero's ultimate skill 100 times.", 'counter', 'ults', 100, 1, [g(20), S()], 'launch', { since: COUNTERS_SINCE }),
  // Freeplay (the wave-100/150 milestones already pay gems)
  N('freeplay', 'a_fp_extra_10', 'Encore!', "In freeplay, clear 10 waves past a stage's last wave.", 'freeplayExtra', null, 10, 1, [g(20), it('book_superRare', 2)], 'launch'),
  N('freeplay', 'a_fp_50', 'After-Hours Patrol', 'Reach wave 50 in any freeplay.', 'freeplayBest', 'any', 50, 2, [g(50), O()], 'launch'),
  N('freeplay', 'a_fp_seasons', 'Three Seasons', 'Reach wave 100 on Blossom, Tempest and Crimson Moon.', 'fpTiers100', null, 3, 0, [R()], 'launch', { honor: hr(25, 'Three Seasons Ribbon', 'shiny', 'seasons') }),
  N('freeplay', 'a_fp_200', 'Two Hundred Strong', 'Reach wave 200 in any freeplay.', 'freeplayBest', 'any', 200, 4, [g(100), R()], 'launch', { title: tt('Tireless Guardian', 'gold') }),
  N('freeplay', 'a_fp_wyrm', 'Eclipse Watcher', 'Defeat the Eclipse Wyrm in freeplay.', 'freeplayMark', 'wyrm', 1, 4, [g(100), R()], 'launch', { title: tt('Eclipse Watcher', 'gold') }),
  N('freeplay', 'a_fp_crimson', 'Under the Crimson Moon', 'Defeat the Ashwing Matriarch in Crimson Moon freeplay.', 'freeplayMark', 'crimson:matriarch', 1, 0, [R()], 'launch', { honor: hr(31, 'Crimson Ember Ribbon', 'special', 'moon', 'ember') }),
  N('freeplay', 'a_fp_bosses_4', 'Starlight Vigil', 'Defeat all four freeplay bosses: Foundry Titan, Gloom Regent, Hyakki Daimyo and Eclipse Wyrm.', 'enemySetKilled', 'fp_foundry_titan,fp_gloom_regent,fp_hyakki_daimyo,fp_eclipse_wyrm', 4, 5, [g(300), C(), TK], 'launch', { honor: hr(32, 'Starlight Vigil Ribbon', 'special', 'eclipse', 'starfield'), title: tt('Starlight Guardian', 'prism') }),
  // Co-op & Clan (nothing about friends, messages or invites)
  N('together', 'a_coop_1', 'Study Buddies', 'Win a co-op battle.', 'counter', 'coopWin', 1, 1, [g(20), it('book_rare', 3)], 'launch', { series: 'coop', since: COUNTERS_SINCE }),
  N('together', 'a_coop_10', 'Team Spirit', 'Win 10 co-op battles.', 'counter', 'coopWin', 10, 2, [g(50), O()], 'launch', { series: 'coop', since: COUNTERS_SINCE }),
  N('together', 'a_coop_50', 'Better Together', 'Win 50 co-op battles.', 'counter', 'coopWin', 50, 3, [g(100), O(2)], 'launch', { series: 'coop', honor: hr(16, 'Friendship Knot Ribbon', 'plain', 'knot'), title: tt('Team Player'), since: COUNTERS_SINCE }),
  N('together', 'a_clanboss_10', 'Clan Boss Challenger', "Battle your clan's boss 10 times.", 'counter', 'clanBossHit', 10, 0, [O(2)], 'launch', { since: COUNTERS_SINCE }),
  N('together', 'a_donate_1', 'Lending a Hand', 'Send a clanmate materials they asked for in Clan Requests.', 'counter', 'donate', 1, 0, [O()], 'social', { series: 'donate' }),
  N('together', 'a_donate_10', 'Generous Heart', 'Help clanmates with 10 donations in Clan Requests.', 'counter', 'donate', 10, 0, [O(2)], 'social', { series: 'donate', honor: hr(18, 'Kind Heart Ribbon', 'plain', 'heartplus'), title: tt('Helping Hands') }),
  // Students (nothing recruit-, duplicate- or Potential-driven)
  N('students', 'a_formation_8', 'Full Formation', 'Fill all 8 student slots in your formation.', 'formationSize', null, 8, 1, [g(20), it('book_rare', 3)], 'launch'),
  N('students', 'a_break_1', 'Breaking Through', "Open a student's first breakthrough gate.", 'maxBreakthrough', null, 1, 1, [g(20), it('book_rare', 3)], 'launch'),
  N('students', 'a_lv20_10', 'Study Group', 'Raise 10 students to level 20.', 'unitsAtLevel', 20, 10, 2, [g(50), O()], 'launch', { series: 'class' }),
  N('students', 'a_lv40_10', 'Honor Society', 'Raise 10 students to level 40.', 'unitsAtLevel', 40, 10, 3, [g(100), O(2), it('book_mythic')], 'launch', { series: 'class' }),
  N('students', 'a_lv60_5', 'Top of the Class', 'Raise 5 students to level 60.', 'unitsAtLevel', 60, 5, 4, [g(200), R(), it('book_legendary')], 'launch', { series: 'class', title: tt('Head of the Class', 'gold') }),
  N('students', 'a_units_15', 'Lively Club Room', 'Have 15 students and heroes at the academy.', 'unitsOwned', null, 15, 2, [g(50), O()], 'launch', { series: 'units' }),
  N('students', 'a_awake_3', 'Rising Stars', 'Awaken 3 different students.', 'unitsAwakened', null, 3, 2, [g(50), O(), it('star_fragment', 10)], 'launch', { series: 'stars' }),
  N('students', 'a_stars_25', 'Constellation', 'Earn 25 awakening stars across your students.', 'awakenStars', null, 25, 3, [g(100), O(2), it('star_fragment', 20)], 'launch', { series: 'stars' }),
  N('students', 'a_stars_50', 'Starry Sky', 'Earn 50 awakening stars across your students.', 'awakenStars', null, 50, 4, [g(200), R(), it('crown_dragon')], 'launch', { series: 'stars', honor: hr(23, 'Constellation Ribbon', 'shiny', 'constellation'), title: tt('Stargazer Sensei', 'gold') }),
  N('students', 'a_ur_1', 'Rainbow Bright', 'Awaken an SSR girl all the way to ★5 (UR). Hikari counts.', 'urOwned', null, 1, 0, [R()], 'launch', { honor: hr(27, 'Rainbow Bright Ribbon', 'special', 'gem', 'prism') }),
  // Gear
  N('gear', 'a_fullset_1', 'Fully Equipped', 'Fill all three gear slots (charm, ribbon, shoes) on one student.', 'fullSets', null, 1, 1, [g(20), it('dice_reroll', 2)], 'launch'),
  N('gear', 'a_gear_100', 'Gear Collector', 'Collect 100 pieces of gear (salvaged ones count).', 'gearReceived', null, 100, 0, [it('dice_reroll', 3)], 'launch', { grind: true }),
  N('gear', 'a_gear_myth', 'Crimson Moon Keepsake', 'Get a Mythic (Radiant) piece of gear.', 'gearEver', 'mythic', 1, 3, [g(50), O(2), it('lock_pin')], 'launch', { series: 'gearRarity' }),
  N('gear', 'a_gear_leg', 'Eternal Sakura Keepsake', 'Get a Legendary (Celestial) piece of gear.', 'gearEver', 'legendary', 1, 4, [g(100), R(), it('lock_pin')], 'launch', { series: 'gearRarity' }),
  N('gear', 'a_plus10_1', 'Polished to a Shine', 'Enhance a piece of gear to +10.', 'gearMaxEver', 'any', 1, 2, [g(50), O(), it('dice_reroll', 2)], 'launch', { series: 'plus10' }),
  N('gear', 'a_plus10_10', 'Master Polisher', 'Enhance 10 pieces of gear to +10.', 'gearMaxEver', 'any', 10, 3, [g(100), O(2)], 'launch', { series: 'plus10' }),
  N('gear', 'a_leg_plus10', 'Celestial Craftwork', 'Enhance a Legendary piece of gear to +10.', 'gearMaxEver', 'legendary', 1, 4, [g(200), R(), it('dice_prism')], 'launch', { honor: hr(24, 'Master Crafter Ribbon', 'shiny', 'wrench'), title: tt('Master Crafter', 'gold') }),
  // LR gear (GEAR_UPDATE.md §4.6, wave `gear`): one Nightglass Lens each, once, no gems (tier 0); counters from
  // src/systems/gear.js (MARK.lrEver / lrForm)
  N('gear', 'a_lr_first', 'First Nightglass', 'Awaken a rainbow UR piece into Nightglass LR gear.', 'counter', 'ach:lrEver', 1, 0, [it('lens_nightglass')], 'gear'),
  N('gear', 'a_lr_form', 'Nightglass Form', 'Wake an LR Set Form: five LR pieces of one set on one student.', 'counter', 'ach:lrForm', 1, 0, [it('lens_nightglass')], 'gear'),
  N('gear', 'a_salvage_100', 'Tidy Workshop', 'Salvage 100 pieces of gear.', 'counter', 'salvage', 100, 0, [it('lock_pin'), it('dice_reroll', 3)], 'launch', { grind: true, since: COUNTERS_SINCE }),
  // Bestiary
  N('bestiary', 'a_family_1', 'Family Portrait', 'Discover every member of one enemy family.', 'familiesFound', null, 1, 1, [g(20), S()], 'launch', { series: 'family' }),
  N('bestiary', 'a_family_6', 'Family Reunion', 'Discover every member of 6 enemy families.', 'familiesFound', null, 6, 3, [g(100), O(2)], 'launch', { series: 'family' }),
  N('bestiary', 'a_slime_15', 'Slime Specialist', 'Discover 15 kinds of slime.', 'familyFound', 'slime', 15, 2, [g(50), O()], 'launch', { honor: hr(7, 'Jelly Jar Ribbon', 'plain', 'slime'), title: tt('Slime Specialist') }),
  N('bestiary', 'a_slime_1000', 'Bubble Patrol', 'Defeat 1,000 slimes.', 'familyKills', 'slime', 1000, 1, [g(20), S()], 'launch'),
  N('bestiary', 'a_ghost_500', 'Night Light', 'Defeat 500 ghosts.', 'familyKills', 'ghost', 500, 2, [g(50), O()], 'launch'),
  N('bestiary', 'a_oni_500', 'Festival Peacekeeper', 'Defeat 500 oni.', 'familyKills', 'oni', 500, 3, [g(50), O(2)], 'launch'),
  N('bestiary', 'a_dragon_4', 'Dragon Spotter', 'Discover all 4 kinds of dragon.', 'familyFound', 'dragon', 4, 3, [g(100), O(2)], 'launch', { title: tt('Dragon Spotter') }),
  // Academy Life (days visited, never streaks)
  N('academy', 'a_login_7', 'Settling In', 'Visit the academy on 7 different days.', 'counter', 'login', 7, 1, [g(20), it('book_rare', 3)], 'launch', { series: 'login', honor: hr(4, 'Homeroom Ribbon', 'plain', 'school') }),
  N('academy', 'a_login_30', 'Regular Attendance', 'Visit the academy on 30 different days.', 'counter', 'login', 30, 2, [g(50), O()], 'launch', { series: 'login' }),
  N('academy', 'a_login_100', 'Academy Regular', 'Visit the academy on 100 different days.', 'counter', 'login', 100, 3, [g(100), R()], 'launch', { series: 'login', honor: hr(22, 'Hundred Days Ribbon', 'shiny', 'calendar'), title: tt('Academy Regular') }),
  N('academy', 'a_login_365', 'Academy Anniversary', 'Visit the academy on 365 different days.', 'counter', 'login', 365, 5, [g(200), R(), O(2), TK], 'launch', { series: 'login', honor: hr(33, 'Aurora Year Ribbon', 'special', 'tree', 'aurora'), title: tt('Sensei of the Year', 'prism') }),
  N('academy', 'a_daily_10', 'Homework Hero', 'Finish every daily commission on 10 days.', 'counter', 'dailyDone', 10, 1, [g(20), S()], 'launch', { series: 'daily' }),
  N('academy', 'a_daily_50', 'Class Representative', 'Finish every daily commission on 50 days.', 'counter', 'dailyDone', 50, 3, [g(100), O(2)], 'launch', { series: 'daily', title: tt('Class Representative') }),
  N('academy', 'a_weekly_4', 'Weekly Wonder', 'Finish every weekly commission in 4 different weeks.', 'counter', 'weeklyDone', 4, 2, [g(50), O()], 'launch', { since: COUNTERS_SINCE }),
  N('academy', 'a_story_1', 'Story Time', 'See every story scene of one chapter.', 'storyChapters', null, 1, 0, [it('book_rare', 3)], 'launch', { series: 'story' }),
  N('academy', 'a_story_8', 'Storyteller', 'See every story scene of all 8 chapters.', 'storyChapters', null, 8, 0, [O(2)], 'launch', { series: 'story', honor: hr(17, 'Storybook Ribbon', 'plain', 'storybook') }),
  N('academy', 'a_journal_11', "Captain's Logbook", "Claim 11 lesson rewards in the Captain's Journal.", 'lessons', null, 11, 0, [O(2)], 'launch', { honor: hr(10, 'Logbook Ribbon', 'plain', 'book'), title: tt('Attentive Sensei') }),
  N('academy', 'a_ach_25', 'Achiever', 'Claim 25 achievements.', 'achievementsClaimed', null, 25, 2, [g(30), O()], 'launch', { series: 'ach' }),
  N('academy', 'a_ach_75', 'Hall of Fame', 'Claim 75 achievements.', 'achievementsClaimed', null, 75, 4, [g(100), R()], 'launch', { series: 'ach', honor: hr(26, 'Hall of Fame Ribbon', 'shiny', 'trophy'), title: tt('Hall of Famer', 'gold') }),
  // Secrets (hint until met; never a special ribbon)
  N('secret', 'a_first_petals', 'Where It All Began', 'Earn all four medals on stage 1-1.', 'stageMedals', '1-1', 4, 0, [it('book_superRare', 2)], 'launch', { honor: hr(11, 'First Petal Ribbon', 'plain', 'bud'), hidden: true, hint: 'Go back to the very first stage…' }),
  N('secret', 'a_close_call', 'By a Petal', "Win a battle with exactly 1 life left (one-life battles don't count).", 'counter', 'ach:closeCall', 1, 0, [O()], 'launch', { title: tt('Cool Under Pressure'), hidden: true, hint: 'Cutting it close is fine… once.', since: COUNTERS_SINCE }),
  N('secret', 'a_room_view', 'Room with a View', 'Pick a lobby background for one of your girls.', 'lobbyBgs', null, 1, 0, [it('coins', 5000)], 'launch', { hidden: true, hint: 'The lobby could use a new look…' }),
  N('secret', 'a_gold_rush', 'Gold Rush', 'Defeat 500 Gold Slimes.', 'enemyKills', 'slime_gold', 500, 0, [it('coins', 50000)], 'launch', { hidden: true, hint: 'Some slimes sparkle more than others.' }),
  N('secret', 'a_not_fooled', 'Not Fooled!', 'Defeat 100 Mimic Slimes.', 'enemyKills', 'slime_mimic', 100, 0, [O()], 'launch', { hidden: true, hint: 'That slime looks a little too familiar…' }),
  N('secret', 'a_mirror_mirror', 'Mirror, Mirror', 'Defeat the Mirror Queen 25 times.', 'enemyKills', 'fae_queen', 25, 0, [O(), it('dice_prism')], 'launch', { hidden: true, hint: 'Who is the bravest of them all?' }),
  // Codex (ship with the Codex modes)
  N('codex', 'a_mr_1', 'Trying Something New', 'Earn your first mode ribbon.', 'ribbonsTotal', null, 1, 1, [g(20), it('dice_reroll')], 'codex', { series: 'mr' }),
  N('codex', 'a_mr_100', 'Mode Explorer', 'Earn 100 mode ribbons.', 'ribbonsTotal', null, 100, 3, [g(100), R()], 'codex', { series: 'mr' }),
  N('codex', 'a_mr_400', 'Versatile Strategist', 'Earn 400 mode ribbons.', 'ribbonsTotal', null, 400, 4, [g(200), R(), O(2)], 'codex', { series: 'mr', title: tt('Versatile Strategist', 'gold') }),
  N('codex', 'a_mr_800', 'Every Ribbon, Every Stage', 'Earn 800 campaign mode ribbons.', 'ribbonsTotal', null, 800, 5, [g(300), C(), TK], 'codex', { series: 'mr', honor: hr(34, 'Holo Codex Ribbon', 'special', 'codex', 'holo'), title: tt('All-Round Sensei', 'prism') }),
  N('codex', 'a_perfect_1', 'Rosette Stage', 'Earn all 20 mode ribbons on one stage.', 'perfectStages', null, 1, 2, [g(50), O(2)], 'codex'),
  N('codex', 'a_rev_80', 'Reverse Route Expert', 'Earn 80 Reverse Route ribbons.', 'modeRibbons', 'reverse', 80, 0, [O(2)], 'codex', { title: tt('Wrong-Way Warden') }),
  N('codex', 'a_rush_80', 'Goblin Rush Expert', 'Earn 80 Goblin Rush ribbons.', 'modeRibbons', 'rush', 80, 0, [O(2)], 'codex', { title: tt('Rush Hour Hero') }),
  N('codex', 'a_iron_80', 'Ironclad Expert', 'Earn 80 Ironclad ribbons.', 'modeRibbons', 'ironclad', 80, 0, [O(2)], 'codex', { title: tt('Armor Breaker') }),
  N('codex', 'a_frugal_80', 'Half Income Expert', 'Earn 80 Half Income ribbons.', 'modeRibbons', 'frugal', 80, 0, [O(2)], 'codex', { title: tt('Thrifty Tactician') }),
  N('codex', 'a_petal_80', 'Last Petal Expert', 'Earn 80 Last Petal ribbons.', 'modeRibbons', 'laststand', 80, 0, [O(2)], 'codex', { title: tt('Last Petal Keeper') }),
  N('codex', 'a_rules_15', 'Rulebook Scholar', 'Earn a Gold medal on a stage of each of the 15 map rules.', 'ruleGold', null, 15, 0, [O(2)], 'codex'),
  // Tryout Day (docs/specs/TRYOUT_DAY.md §10.2, §20.5): 15 rows, 480 gems once; practice runs count for none of them
  N('tryout', 'a_try_half', "School's Out", 'Clear a Half Day in Tryout Day.', 'counter', 'ty:half', 1, 1, [g(20)], 'tryout'),
  N('tryout', 'a_try_full', "Full Day's Work", 'Clear a Full Day in Tryout Day.', 'counter', 'ty:full', 1, 1, [g(30)], 'tryout'),
  N('tryout', 'a_try_spotless', 'Spotless Day', 'Win a Tryout Day run without losing a heart or using the Make-up Test.', 'counter', 'ty:spot', 1, 2, [g(40)], 'tryout'),
  N('tryout', 'a_try_ticked', 'Every Box Ticked', 'Finish all 3 assignments in 5 periods of one Tryout Day run.', 'counter', 'ty:tick', 1, 2, [g(30)], 'tryout'),
  N('tryout', 'a_try_dare', 'Daredevil', 'Finish 10 Double Dare periods in Tryout Day.', 'counter', 'ty:dare', 10, 1, [g(20)], 'tryout'),
  N('tryout', 'a_try_seen', 'Open Tryouts', 'See all 29 students try out in Tryout Day runs.', 'counter', 'ty:seen', 29, 2, [g(40)], 'tryout', { title: tt('Head Scout') }),
  N('tryout', 'a_try_lr', 'Top Marks', 'Take an LR Pep Talk in Tryout Day.', 'counter', 'ty:lr', 1, 1, [g(20)], 'tryout'),
  N('tryout', 'a_try_window', 'Window Watcher', 'Finish the By the Window assignment 20 times.', 'counter', 'ty:win', 20, 1, [g(20)], 'tryout'),
  N('tryout', 'a_try_moves', 'Hall Pass Pro', 'Make 50 Hall Pass moves in Tryout Day.', 'counter', 'ty:mv', 50, 1, [g(20)], 'tryout'),
  N('tryout', 'a_try_g4', 'Grade 4', 'Clear Grade 4 in Tryout Day.', 'counter', 'ty:grade', 4, 2, [g(30)], 'tryout', { series: 'tryGrade', honor: hr(35, 'Grade 4 Ribbon', 'plain', 'board') }),
  N('tryout', 'a_try_g8', 'Grade 8', 'Clear Grade 8 in Tryout Day.', 'counter', 'ty:grade', 8, 2, [g(40)], 'tryout', { series: 'tryGrade', honor: hr(36, 'Grade 8 Ribbon', 'shiny', 'board') }),
  N('tryout', 'a_try_g12', 'Grade 12', 'Clear Grade 12 in Tryout Day.', 'counter', 'ty:grade', 12, 3, [g(50)], 'tryout', { series: 'tryGrade', honor: hr(37, 'Grade 12 Ribbon', 'special', 'board', 'chalk'), title: tt('Grade 12 Sensei', 'prism') }),
  // Extended Day's milestones (TRYOUT_DAY.md §20.5): waves survived in one Extended Day run ('ty:aw': the best over every
  // Grade), 120 gems once; a practice run counts for none of them, co-op counts as for the rows above
  N('tryout', 'a_try_aw50', 'Stayed After', 'Survive 50 waves in one Extended Day run in Tryout Day.', 'counter', 'ty:aw', 50, 2, [g(30)], 'tryout', { series: 'tryWave' }),
  N('tryout', 'a_try_aw75', 'Late Bus', 'Survive 75 waves in one Extended Day run in Tryout Day.', 'counter', 'ty:aw', 75, 2, [g(30)], 'tryout', { series: 'tryWave' }),
  N('tryout', 'a_try_aw100', 'Last One Out', 'Survive 100 waves in one Extended Day run in Tryout Day.', 'counter', 'ty:aw', 100, 3, [g(60)], 'tryout', { series: 'tryWave' }),
  // Later (each row ships with its feature: roster merge, hero rework, the City)
  N('students', 'a_units_30', 'Whole School', 'Have 30 students and heroes at the academy.', 'unitsOwned', null, 30, 3, [g(100), O(2)], 'later', { series: 'units', with: 'roster merge' }),
  N('battle', 'a_hero_25', "Commander's Rise", 'Your hero reaches Lv 25 during a battle.', 'counter', 'heroMax', 25, 2, [g(30), O()], 'later', { with: 'hero rework' }),
  N('students', 'a_bond_10', 'Best Friends', 'Reach bond level 10 with any student.', 'bondMax', null, 10, 2, [g(50), O()], 'later', { with: 'the City' }),
];

/** Freeplay titles that already exist (earned through freeplay milestones, not achievements; §2.5). */
export const FREEPLAY_TITLES = Object.freeze({
  fp_ashwing: { text: 'Ashwing Slayer', tier: 'gold' },
  fp_crimson: { text: 'Crimson Slayer', tier: 'prism' },
});

export const ACHIEVEMENT_MAP = Object.freeze(Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a])));

/** Every stage the row `needs` exists in this build (true for a row that needs none). */
export function achievementStagesExist(a) {
  return !a?.needs || a.needs.every((id) => !!STAGE_MAP[id]);
}

/** The row is in this build's list (its wave shipped, the expansion is on, its stages exist, not retired). */
export function achievementLive(a, v2 = ACH_V2_LIVE) {
  if (!a || a.retired) return false;
  if (a.shipped) return true;
  return v2 && !!ACHIEVEMENT_WAVES[a.wave] && achievementStagesExist(a);
}
