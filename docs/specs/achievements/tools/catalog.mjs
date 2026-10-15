// FINAL achievement catalogue (judge's spec, Oct 15 2026). Design data, not game code.
// `final/check.mjs` validates it against the LIVE game (read-only) and prints totals, pacing and the
// update-day payout that SPEC.md quotes. The build ports these rows into src/data/missions.js.
//
// Row: { id, name, desc, cat, metric, param?, goal, tier, rewards, avail, series?, honor?, title?, hidden?, hint?, grind? }
//   tier   1..4 economy tier, 5 = capstone (Celestial and/or Recruit Ticket), 0 = no gems by rule
//   avail  LIVE  = counts past play (data every save already holds)
//          NEW   = live feature, new missions.counters key: counts from the release that adds it
//          TA    = train A data (v0.1.28 story / journal)           SO = social release
//          CX    = Codex modes release                               LATER = roster / hero rework / City
//   honor  { no, name, cls: plain|shiny|special, fx: null|prism|sakura|sunrise|starfield|ember|storm|aurora|holo, emblem }
//   title  { text, tier: std|gold|prism }   (the title id IS the achievement id)
//   grind  true when free unlimited taps (sweeps, salvage, coin spending) raise the metric: 0 gems by rule

const g = (n) => ({ id: 'gems', count: n });
const it = (id, n = 1) => ({ id, count: n });
const S = (n = 1) => it('gearbox_rare', n);       // Sturdy  (T1 only)
const O = (n = 1) => it('gearbox_superRare', n);  // Ornate
const R = (n = 1) => it('gearbox_mythic', n);     // Radiant
const C = (n = 1) => it('gearbox_legendary', n);  // Celestial (capstones only)
const TK = it('ticket_recruit');
const hr = (no, name, cls, emblem, fx = null) => ({ no, name, cls, fx, emblem });
const tt = (text, tier = 'std') => ({ text, tier });
const A = (cat, id, name, desc, metric, param, goal, tier, rewards, avail = 'LIVE', extra = {}) => ({ cat, id, name, desc, metric, param, goal, tier, rewards, avail, ...extra });

/** Cosmetics + display/metric fixes on the SHIPPED 30 (ids, goals*, item rewards unchanged). */
export const EXISTING = {
  a_first_win: { title: tt('Rookie Sentinel') },
  a_chapter_1: { honor: hr(1, 'Sakura Gardens Ribbon', 'plain', 'blossom'), series: 'chapter' },
  a_chapter_2: { honor: hr(2, 'Moonlit Lakeshore Ribbon', 'plain', 'wave'), series: 'chapter' },
  a_chapter_3: { honor: hr(3, 'Moonveil Shrine Ribbon', 'plain', 'torii'), series: 'chapter' },
  a_chapter_4: { honor: hr(5, 'Ironhold Pass Ribbon', 'plain', 'peak'), series: 'chapter' },
  a_chapter_5: { honor: hr(8, 'Gloomfen Marsh Ribbon', 'plain', 'lily'), series: 'chapter' },
  a_chapter_6: { honor: hr(12, 'Clockwork Foundry Ribbon', 'plain', 'cog'), series: 'chapter' },
  a_chapter_7: { honor: hr(14, 'Oni Festival Ribbon', 'plain', 'lantern'), series: 'chapter' },
  a_chapter_8: { honor: hr(19, 'Ashwing Peaks Ribbon', 'shiny', 'wing'), title: tt('Summit Sentinel', 'gold'), series: 'chapter' },
  a_gold_10: { series: 'gold' },
  a_gold_40: { honor: hr(20, 'Valedictorian Laurel', 'shiny', 'laurel'), title: tt('Valedictorian', 'gold'), series: 'gold' },
  a_sakura_1: { series: 'sakura' },
  a_sakura_10: { honor: hr(13, 'Sakura Watch Ribbon', 'plain', 'nightbloom'), title: tt('Sakura Sentinel', 'gold'), series: 'sakura' },
  a_bestiary_25: { series: 'bestiary' },
  a_bestiary_50: { title: tt('Monster Scholar'), series: 'bestiary' },
  a_bestiary_100: { honor: hr(21, 'Encyclopedia Ribbon', 'shiny', 'bookstar'), title: tt('Walking Encyclopedia', 'gold'), series: 'bestiary' },
  a_level_20: { series: 'level' }, a_level_40: { series: 'level' },
  a_level_60: { title: tt('Perfect Score', 'gold'), series: 'level' },
  a_awaken_1: { series: 'awaken' },
  a_awaken_5: { title: tt('Radiant Halo', 'gold'), series: 'awaken' },
  a_units_10: { series: 'units' },
  a_units_all: { series: 'units', goalFix: 19, descFix: 'Own 19 students and heroes.' },
  a_kills_1000: { series: 'kills', metricFix: 'killsAll' },
  a_kills_25000: { title: tt('Legend of the Academy'), series: 'kills', metricFix: 'killsAll' },
  a_reroll_10: { rename: 'Keen Tinkerer', noPin: true },
  a_boss_3: { honor: hr(15, 'Assault Crown Ribbon', 'plain', 'crown'), series: 'boss' },
  // a_pulls_10/100/300: nothing (spending signal: no ribbon, title or pin)
};

export const CATALOG = [
  // ------------------------------------------------------------------ Campaign
  A('campaign', 'a_clear_10', 'Off to Class', 'Clear 10 campaign stages.', 'stagesCleared', null, 10, 1, [g(20), S()], 'LIVE', { series: 'clear' }),
  A('campaign', 'a_clear_25', 'Halfway Up the Hill', 'Clear 25 campaign stages.', 'stagesCleared', null, 25, 2, [g(50), O()], 'LIVE', { series: 'clear' }),
  A('campaign', 'a_gold_1', 'Going for Gold', 'Earn your first Gold medal (Hard) on a campaign stage.', 'medals', 'hard', 1, 1, [g(30), it('book_rare', 3)], 'LIVE', { series: 'gold' }),
  A('campaign', 'a_gold_20', 'Gold Star Student', 'Earn Gold medals on 20 campaign stages.', 'medals', 'hard', 20, 3, [g(100), O(2)], 'LIVE', { series: 'gold' }),
  A('campaign', 'a_sakura_20', 'Sakura in Full Bloom', 'Earn Sakura medals (Nightmare) on 20 campaign stages.', 'medals', 'nightmare', 20, 4, [g(200), R()], 'LIVE', { series: 'sakura' }),
  A('campaign', 'a_sakura_40', 'Thousand-Petal Sentinel', 'Earn Sakura medals on all 40 campaign stages.', 'medals', 'nightmare', 40, 5, [g(300), C(), TK], 'LIVE', { series: 'sakura', honor: hr(28, 'Thousand Petals Ribbon', 'special', 'double', 'sakura'), title: tt('Thousand-Petal Sentinel', 'prism') }),
  A('campaign', 'a_quad_1', 'Four-Medal Report Card', 'Earn all four medals on one campaign stage.', 'medalsAll', null, 1, 2, [g(50), O()], 'LIVE', { series: 'quad', honor: hr(6, 'Report Card Ribbon', 'plain', 'quad') }),
  A('campaign', 'a_quad_10', 'Straight-A Semester', 'Earn all four medals on 10 campaign stages.', 'medalsAll', null, 10, 3, [g(100), R()], 'LIVE', { series: 'quad', title: tt('Straight-A Sensei') }),
  A('campaign', 'a_quad_40', 'Academy Laureate', 'Earn all four medals on all 40 campaign stages.', 'medalsAll', null, 40, 5, [g(300), C(), TK], 'LIVE', { series: 'quad', honor: hr(29, "Laureate's Sunrise Ribbon", 'special', 'sunrise', 'sunrise'), title: tt('Academy Laureate', 'prism') }),
  A('campaign', 'a_goldchap_1', 'Golden Chapter', 'Earn Gold medals on every stage of one chapter.', 'chapterSets', 'hard', 1, 2, [g(50), O()], 'LIVE'),
  A('campaign', 'a_sakurachap_1', 'Blossoming Chapter', 'Earn Sakura medals on every stage of one chapter.', 'chapterSets', 'nightmare', 1, 3, [g(100), R()], 'LIVE'),

  // ------------------------------------------------------------------ Bounty, Total Assault, Tactical Challenge
  A('assault', 'a_bounty_1', 'Supply Run', 'Clear any Bounty stage.', 'kindClear', 'resource', 1, 1, [g(20), it('token_bounty', 5)], 'LIVE', { series: 'bounty' }),
  A('assault', 'a_bounty_5', 'Errand Expert', 'Clear 5 different Bounty stages.', 'kindClear', 'resource', 5, 1, [g(30), S()], 'LIVE', { series: 'bounty' }),
  A('assault', 'a_bounty_15', 'Supply Captain', 'Clear all 15 Bounty stages.', 'kindClear', 'resource', 15, 3, [g(50), O(2)], 'LIVE', { series: 'bounty' }),
  A('assault', 'a_bountyg_15', 'Expedition Gold', 'Earn Gold medals on all 15 Bounty stages.', 'kindMedals', 'resource:hard', 15, 3, [g(100), O(2)], 'LIVE', { title: tt('Expedition Leader') }),
  A('assault', 'a_lib_100', 'Bookworm', 'Run the Library Courtyard 100 times (sweeps count).', 'arenaRuns', 'res-books', 100, 0, [it('book_mythic'), it('book_superRare', 5)], 'LIVE', { grind: true }),
  A('assault', 'a_yard_100', 'Workshop Regular', 'Run the Workshop Yard 100 times (sweeps count).', 'arenaRuns', 'res-gear', 100, 0, [it('lock_pin'), it('dice_prism')], 'LIVE', { grind: true }),
  A('assault', 'a_event_10', 'Festival Helper', 'Win 10 Bounty battles during the weekly double-drop event.', 'counter', 'eventWin', 10, 0, [O(), it('token_bounty', 10)], 'NEW'),
  A('assault', 'a_boss_1', 'Assault Debut', 'Clear any Total Assault boss.', 'bossClears', null, 1, 2, [g(50), O()], 'LIVE', { series: 'boss' }),
  A('assault', 'a_boss_gold_3', 'Assault Squad Leader', 'Earn Gold medals on all three Total Assault bosses.', 'kindMedals', 'boss:hard', 3, 4, [g(200), R(), it('dice_prism', 2)], 'LIVE', { title: tt('Assault Squad Leader', 'gold') }),
  A('assault', 'a_boss_sak_3', 'Dawn After the Storm', 'Earn Sakura medals on all three Total Assault bosses.', 'kindMedals', 'boss:nightmare', 3, 5, [g(300), C(), TK], 'LIVE', { honor: hr(30, 'Stormproof Ribbon', 'special', 'bolt', 'storm'), title: tt('Stormproof Sentinel', 'prism') }),
  A('assault', 'a_bosskill_100', 'Boss Patrol', 'Defeat 100 minibosses or bosses.', 'counter', 'bossKill', 100, 3, [g(50), O(2), it('token_boss', 20)], 'LIVE'),
  A('assault', 'a_tc_10', 'Colosseum Debut', 'Reach wave 10 in the Tactical Challenge.', 'challengeWave', null, 10, 1, [g(30), S()], 'LIVE', { series: 'tc' }),
  A('assault', 'a_tc_40', 'Crowd Favorite', 'Reach wave 40 in the Tactical Challenge.', 'challengeWave', null, 40, 3, [g(50), O(2)], 'LIVE', { series: 'tc' }),
  A('assault', 'a_tc_70', 'Colosseum Legend', 'Reach wave 70 in the Tactical Challenge (the Ashwing wave).', 'challengeWave', null, 70, 4, [g(200), R()], 'LIVE', { series: 'tc', title: tt('Colosseum Legend', 'gold') }),

  // ------------------------------------------------------------------ Battles
  A('battle', 'a_kills_5k', 'Neighborhood Watch', 'Defeat 5,000 enemies (co-op and freeplay count).', 'killsAll', null, 5000, 1, [g(20), S()], 'LIVE', { series: 'kills' }),
  A('battle', 'a_kills_100k', 'Petal Storm', 'Defeat 100,000 enemies (co-op and freeplay count).', 'killsAll', null, 100000, 4, [g(150), R()], 'LIVE', { series: 'kills', title: tt('Petal Storm', 'gold') }),
  A('battle', 'a_wins_100', 'Patrol Veteran', 'Win 100 battles (co-op counts).', 'winsAll', null, 100, 2, [g(50), O()], 'LIVE', { series: 'wins' }),
  A('battle', 'a_wins_500', 'Seasoned Sentinel', 'Win 500 battles (co-op counts).', 'winsAll', null, 500, 3, [g(100), O(2)], 'LIVE', { series: 'wins', title: tt('Seasoned Sentinel') }),
  A('battle', 'a_flawless_10', 'Not a Petal Lost', 'Win 10 battles on Normal or Hard without losing a single life.', 'counter', 'ach:flawless', 10, 2, [g(50), O()], 'NEW', { honor: hr(9, 'Petal Shield Ribbon', 'plain', 'shield'), title: tt('Flawless Guardian') }),
  A('battle', 'a_squad3', 'Small but Mighty', 'Win a chapter 5+ stage on Hard or Nightmare with 3 or fewer different students on the field.', 'counter', 'ach:squad3', 1, 3, [g(50), O(2)], 'NEW', { title: tt('Small but Mighty') }),
  A('battle', 'a_ults_100', 'Signature Move', "Use your hero's ultimate skill 100 times.", 'counter', 'ults', 100, 1, [g(20), S()], 'NEW'),

  // ------------------------------------------------------------------ Freeplay (wave-100/150 milestones already pay gems)
  A('freeplay', 'a_fp_extra_10', 'Encore!', 'In freeplay, clear 10 waves past a stage\'s last wave.', 'freeplayExtra', null, 10, 1, [g(20), it('book_superRare', 2)], 'LIVE'),
  A('freeplay', 'a_fp_50', 'After-Hours Patrol', 'Reach wave 50 in any freeplay.', 'freeplayBest', 'any', 50, 2, [g(50), O()], 'LIVE'),
  A('freeplay', 'a_fp_seasons', 'Three Seasons', 'Reach wave 100 on Blossom, Tempest and Crimson Moon.', 'fpTiers100', null, 3, 0, [R()], 'LIVE', { honor: hr(25, 'Three Seasons Ribbon', 'shiny', 'seasons') }),
  A('freeplay', 'a_fp_200', 'Two Hundred Strong', 'Reach wave 200 in any freeplay.', 'freeplayBest', 'any', 200, 4, [g(100), R()], 'LIVE', { title: tt('Tireless Guardian', 'gold') }),
  A('freeplay', 'a_fp_wyrm', 'Eclipse Watcher', 'Defeat the Eclipse Wyrm in freeplay.', 'freeplayMark', 'wyrm', 1, 4, [g(100), R()], 'LIVE', { title: tt('Eclipse Watcher', 'gold') }),
  A('freeplay', 'a_fp_crimson', 'Under the Crimson Moon', 'Defeat the Ashwing Matriarch in Crimson Moon freeplay.', 'freeplayMark', 'crimson:matriarch', 1, 0, [R()], 'LIVE', { honor: hr(31, 'Crimson Ember Ribbon', 'special', 'moon', 'ember') }),
  A('freeplay', 'a_fp_bosses_4', 'Starlight Vigil', 'Defeat all four freeplay bosses: Foundry Titan, Gloom Regent, Hyakki Daimyo and Eclipse Wyrm.', 'enemySetKilled', 'fp_foundry_titan,fp_gloom_regent,fp_hyakki_daimyo,fp_eclipse_wyrm', 4, 5, [g(300), C(), TK], 'LIVE', { honor: hr(32, 'Starlight Vigil Ribbon', 'special', 'eclipse', 'starfield'), title: tt('Starlight Guardian', 'prism') }),

  // ------------------------------------------------------------------ Co-op & Clan (nothing about friends, messages or invites)
  A('together', 'a_coop_1', 'Study Buddies', 'Win a co-op battle.', 'counter', 'coopWin', 1, 1, [g(20), it('book_rare', 3)], 'NEW', { series: 'coop' }),
  A('together', 'a_coop_10', 'Team Spirit', 'Win 10 co-op battles.', 'counter', 'coopWin', 10, 2, [g(50), O()], 'NEW', { series: 'coop' }),
  A('together', 'a_coop_50', 'Better Together', 'Win 50 co-op battles.', 'counter', 'coopWin', 50, 3, [g(100), O(2)], 'NEW', { series: 'coop', honor: hr(16, 'Friendship Knot Ribbon', 'plain', 'knot'), title: tt('Team Player') }),
  A('together', 'a_clanboss_10', 'Clan Boss Challenger', "Battle your clan's boss 10 times.", 'counter', 'clanBossHit', 10, 0, [O(2)], 'NEW'),
  A('together', 'a_donate_1', 'Lending a Hand', 'Send a clanmate a piece of gear they asked for.', 'counter', 'donate', 1, 0, [O()], 'SO', { series: 'donate' }),
  A('together', 'a_donate_10', 'Generous Heart', 'Help clanmates with 10 gear donations.', 'counter', 'donate', 10, 0, [O(2)], 'SO', { series: 'donate', honor: hr(18, 'Kind Heart Ribbon', 'plain', 'heartplus'), title: tt('Helping Hands') }),

  // ------------------------------------------------------------------ Students (nothing recruit-, dupe- or Potential-driven)
  A('students', 'a_formation_8', 'Full Formation', 'Fill all 8 student slots in your formation.', 'formationSize', null, 8, 1, [g(20), it('book_rare', 3)], 'LIVE'),
  A('students', 'a_break_1', 'Breaking Through', "Open a student's first breakthrough gate.", 'maxBreakthrough', null, 1, 1, [g(20), it('book_rare', 3)], 'LIVE'),
  A('students', 'a_lv20_10', 'Study Group', 'Raise 10 students to level 20.', 'unitsAtLevel', 20, 10, 2, [g(50), O()], 'LIVE', { series: 'class' }),
  A('students', 'a_lv40_10', 'Honor Society', 'Raise 10 students to level 40.', 'unitsAtLevel', 40, 10, 3, [g(100), O(2), it('book_mythic')], 'LIVE', { series: 'class' }),
  A('students', 'a_lv60_5', 'Top of the Class', 'Raise 5 students to level 60.', 'unitsAtLevel', 60, 5, 4, [g(200), R(), it('book_legendary')], 'LIVE', { series: 'class', title: tt('Head of the Class', 'gold') }),
  A('students', 'a_units_15', 'Lively Club Room', 'Have 15 students and heroes at the academy.', 'unitsOwned', null, 15, 2, [g(50), O()], 'LIVE', { series: 'units' }),
  A('students', 'a_awake_3', 'Rising Stars', 'Awaken 3 different students.', 'unitsAwakened', null, 3, 2, [g(50), O(), it('star_fragment', 10)], 'LIVE', { series: 'stars' }),
  A('students', 'a_stars_25', 'Constellation', 'Earn 25 awakening stars across your students.', 'awakenStars', null, 25, 3, [g(100), O(2), it('star_fragment', 20)], 'LIVE', { series: 'stars' }),
  A('students', 'a_stars_50', 'Starry Sky', 'Earn 50 awakening stars across your students.', 'awakenStars', null, 50, 4, [g(200), R(), it('crown_dragon')], 'LIVE', { series: 'stars', honor: hr(23, 'Constellation Ribbon', 'shiny', 'constellation'), title: tt('Stargazer Sensei', 'gold') }),
  A('students', 'a_ur_1', 'Rainbow Bright', 'Awaken an SSR girl all the way to ★5 (UR). Hikari counts.', 'urOwned', null, 1, 0, [R()], 'LIVE', { honor: hr(27, 'Rainbow Bright Ribbon', 'special', 'gem', 'prism') }),

  // ------------------------------------------------------------------ Gear
  A('gear', 'a_fullset_1', 'Fully Equipped', 'Fill all three gear slots (charm, ribbon, shoes) on one student.', 'fullSets', null, 1, 1, [g(20), it('dice_reroll', 2)], 'LIVE'),
  A('gear', 'a_gear_100', 'Gear Collector', 'Collect 100 pieces of gear (salvaged ones count).', 'gearReceived', null, 100, 0, [it('dice_reroll', 3)], 'LIVE', { grind: true }),
  A('gear', 'a_gear_myth', 'Crimson Moon Keepsake', 'Get a Mythic (Radiant) piece of gear.', 'gearEver', 'mythic', 1, 3, [g(50), O(2), it('lock_pin')], 'LIVE', { series: 'gearRarity' }),
  A('gear', 'a_gear_leg', 'Eternal Sakura Keepsake', 'Get a Legendary (Celestial) piece of gear.', 'gearEver', 'legendary', 1, 4, [g(100), R(), it('lock_pin')], 'LIVE', { series: 'gearRarity' }),
  A('gear', 'a_plus10_1', 'Polished to a Shine', 'Enhance a piece of gear to +10.', 'gearMaxEver', 'any', 1, 2, [g(50), O(), it('dice_reroll', 2)], 'LIVE', { series: 'plus10' }),
  A('gear', 'a_plus10_10', 'Master Polisher', 'Enhance 10 pieces of gear to +10.', 'gearMaxEver', 'any', 10, 3, [g(100), O(2)], 'LIVE', { series: 'plus10' }),
  A('gear', 'a_leg_plus10', 'Celestial Craftwork', 'Enhance a Legendary piece of gear to +10.', 'gearMaxEver', 'legendary', 1, 4, [g(200), R(), it('dice_prism')], 'LIVE', { honor: hr(24, 'Master Crafter Ribbon', 'shiny', 'wrench'), title: tt('Master Crafter', 'gold') }),
  A('gear', 'a_salvage_100', 'Tidy Workshop', 'Salvage 100 pieces of gear.', 'counter', 'salvage', 100, 0, [it('lock_pin'), it('dice_reroll', 3)], 'NEW', { grind: true }),

  // ------------------------------------------------------------------ Bestiary
  A('bestiary', 'a_family_1', 'Family Portrait', 'Discover every member of one enemy family.', 'familiesFound', null, 1, 1, [g(20), S()], 'LIVE', { series: 'family' }),
  A('bestiary', 'a_family_6', 'Family Reunion', 'Discover every member of 6 enemy families.', 'familiesFound', null, 6, 3, [g(100), O(2)], 'LIVE', { series: 'family' }),
  A('bestiary', 'a_slime_15', 'Slime Specialist', 'Discover all 15 kinds of slime.', 'familyFound', 'slime', 15, 2, [g(50), O()], 'LIVE', { honor: hr(7, 'Jelly Jar Ribbon', 'plain', 'slime'), title: tt('Slime Specialist') }),
  A('bestiary', 'a_slime_1000', 'Bubble Patrol', 'Defeat 1,000 slimes.', 'familyKills', 'slime', 1000, 1, [g(20), S()], 'LIVE'),
  A('bestiary', 'a_ghost_500', 'Night Light', 'Defeat 500 ghosts.', 'familyKills', 'ghost', 500, 2, [g(50), O()], 'LIVE'),
  A('bestiary', 'a_oni_500', 'Festival Peacekeeper', 'Defeat 500 oni.', 'familyKills', 'oni', 500, 3, [g(50), O(2)], 'LIVE'),
  A('bestiary', 'a_dragon_4', 'Dragon Spotter', 'Discover all 4 kinds of dragon.', 'familyFound', 'dragon', 4, 3, [g(100), O(2)], 'LIVE', { title: tt('Dragon Spotter') }),

  // ------------------------------------------------------------------ Academy life (days visited, never streaks)
  A('academy', 'a_login_7', 'Settling In', 'Visit the academy on 7 different days.', 'counter', 'login', 7, 1, [g(20), it('book_rare', 3)], 'LIVE', { series: 'login', honor: hr(4, 'Homeroom Ribbon', 'plain', 'school') }),
  A('academy', 'a_login_30', 'Regular Attendance', 'Visit the academy on 30 different days.', 'counter', 'login', 30, 2, [g(50), O()], 'LIVE', { series: 'login' }),
  A('academy', 'a_login_100', 'Academy Regular', 'Visit the academy on 100 different days.', 'counter', 'login', 100, 3, [g(100), R()], 'LIVE', { series: 'login', honor: hr(22, 'Hundred Days Ribbon', 'shiny', 'calendar'), title: tt('Academy Regular') }),
  A('academy', 'a_login_365', 'Academy Anniversary', 'Visit the academy on 365 different days.', 'counter', 'login', 365, 5, [g(200), R(), O(2), TK], 'LIVE', { series: 'login', honor: hr(33, 'Aurora Year Ribbon', 'special', 'tree', 'aurora'), title: tt('Sensei of the Year', 'prism') }),
  A('academy', 'a_daily_10', 'Homework Hero', 'Finish every daily commission on 10 days.', 'counter', 'dailyDone', 10, 1, [g(20), S()], 'LIVE', { series: 'daily' }),
  A('academy', 'a_daily_50', 'Class Representative', 'Finish every daily commission on 50 days.', 'counter', 'dailyDone', 50, 3, [g(100), O(2)], 'LIVE', { series: 'daily', title: tt('Class Representative') }),
  A('academy', 'a_weekly_4', 'Weekly Wonder', 'Finish every weekly commission in 4 different weeks.', 'counter', 'weeklyDone', 4, 2, [g(50), O()], 'NEW'),
  A('academy', 'a_story_1', 'Story Time', 'See every story scene of one chapter.', 'storyChapters', null, 1, 0, [it('book_rare', 3)], 'TA', { series: 'story' }),
  A('academy', 'a_story_8', 'Storyteller', 'See every story scene of all 8 chapters.', 'storyChapters', null, 8, 0, [O(2)], 'TA', { series: 'story', honor: hr(17, 'Storybook Ribbon', 'plain', 'storybook') }),
  // 11, not 12: train A has 12 lessons, but 'recruit' is mail-only (its 10× ticket comes by Mail) and never sets an
  // 'sl:' mark (TA:src/data/story/lessons.js:58-68, TA:src/systems/story.js:403), so 11 is every claimable lesson.
  A('academy', 'a_journal_11', "Captain's Logbook", "Claim 11 lesson rewards in the Captain's Journal.", 'lessons', null, 11, 0, [O(2)], 'TA', { honor: hr(10, 'Logbook Ribbon', 'plain', 'book'), title: tt('Attentive Sensei') }),
  A('academy', 'a_ach_25', 'Achiever', 'Claim 25 achievements.', 'achievementsClaimed', null, 25, 2, [g(30), O()], 'LIVE', { series: 'ach' }),
  A('academy', 'a_ach_75', 'Hall of Fame', 'Claim 75 achievements.', 'achievementsClaimed', null, 75, 4, [g(100), R()], 'LIVE', { series: 'ach', honor: hr(26, 'Hall of Fame Ribbon', 'shiny', 'trophy'), title: tt('Hall of Famer', 'gold') }),

  // ------------------------------------------------------------------ Secrets (??? + hint until met; never a special ribbon)
  A('secret', 'a_first_petals', 'Where It All Began', 'Earn all four medals on stage 1-1.', 'stageMedals', '1-1', 4, 0, [it('book_superRare', 2)], 'LIVE', { hidden: true, hint: 'Go back to the very first stage…', honor: hr(11, 'First Petal Ribbon', 'plain', 'bud') }),
  A('secret', 'a_close_call', 'By a Petal', 'Win a battle with exactly 1 life left (one-life battles don\'t count).', 'counter', 'ach:closeCall', 1, 0, [O()], 'NEW', { hidden: true, hint: 'Cutting it close is fine… once.', title: tt('Cool Under Pressure') }),
  A('secret', 'a_room_view', 'Room with a View', 'Pick a lobby background for one of your girls.', 'lobbyBgs', null, 1, 0, [it('coins', 5000)], 'LIVE', { hidden: true, hint: 'The lobby could use a new look…' }),
  A('secret', 'a_gold_rush', 'Gold Rush', 'Defeat 500 Gold Slimes.', 'enemyKills', 'slime_gold', 500, 0, [it('coins', 50000)], 'LIVE', { hidden: true, hint: 'Some slimes sparkle more than others.' }),
  A('secret', 'a_not_fooled', 'Not Fooled!', 'Defeat 100 Mimic Slimes.', 'enemyKills', 'slime_mimic', 100, 0, [O()], 'LIVE', { hidden: true, hint: 'That slime looks a little too familiar…' }),
  A('secret', 'a_mirror_mirror', 'Mirror, Mirror', 'Defeat the Mirror Queen 25 times.', 'enemyKills', 'fae_queen', 25, 0, [O(), it('dice_prism')], 'LIVE', { hidden: true, hint: 'Who is the bravest of them all?' }),

  // ------------------------------------------------------------------ Codex modes (rows ship WITH the Codex release)
  A('codex', 'a_mr_1', 'Trying Something New', 'Earn your first mode ribbon.', 'ribbonsTotal', null, 1, 1, [g(20), it('dice_reroll')], 'CX', { series: 'mr' }),
  A('codex', 'a_mr_100', 'Mode Explorer', 'Earn 100 mode ribbons.', 'ribbonsTotal', null, 100, 3, [g(100), R()], 'CX', { series: 'mr' }),
  A('codex', 'a_mr_400', 'Versatile Strategist', 'Earn 400 mode ribbons.', 'ribbonsTotal', null, 400, 4, [g(200), R(), O(2)], 'CX', { series: 'mr', title: tt('Versatile Strategist', 'gold') }),
  A('codex', 'a_mr_800', 'Every Ribbon, Every Stage', 'Earn all 800 campaign mode ribbons.', 'ribbonsTotal', null, 800, 5, [g(300), C(), TK], 'CX', { series: 'mr', honor: hr(34, 'Holo Codex Ribbon', 'special', 'codex', 'holo'), title: tt('All-Round Sensei', 'prism') }),
  A('codex', 'a_perfect_1', 'Rosette Stage', 'Earn all 20 mode ribbons on one stage.', 'perfectStages', null, 1, 2, [g(50), O(2)], 'CX'),
  A('codex', 'a_rev_80', 'Reverse Route Expert', 'Earn 80 Reverse Route ribbons.', 'modeRibbons', 'reverse', 80, 0, [O(2)], 'CX', { title: tt('Wrong-Way Warden') }),
  A('codex', 'a_rush_80', 'Goblin Rush Expert', 'Earn 80 Goblin Rush ribbons.', 'modeRibbons', 'rush', 80, 0, [O(2)], 'CX', { title: tt('Rush Hour Hero') }),
  A('codex', 'a_iron_80', 'Ironclad Expert', 'Earn 80 Ironclad ribbons.', 'modeRibbons', 'ironclad', 80, 0, [O(2)], 'CX', { title: tt('Armor Breaker') }),
  A('codex', 'a_frugal_80', 'Half Income Expert', 'Earn 80 Half Income ribbons.', 'modeRibbons', 'frugal', 80, 0, [O(2)], 'CX', { title: tt('Thrifty Tactician') }),
  A('codex', 'a_petal_80', 'Last Petal Expert', 'Earn 80 Last Petal ribbons.', 'modeRibbons', 'laststand', 80, 0, [O(2)], 'CX', { title: tt('Last Petal Keeper') }),
  A('codex', 'a_rules_15', 'Rulebook Scholar', 'Earn a Gold medal on a stage of each of the 15 map rules.', 'ruleGold', null, 15, 0, [O(2)], 'CX'),

  // ------------------------------------------------------------------ Later (each row ships with its feature)
  A('students', 'a_units_30', 'Whole School', 'Have 30 students and heroes at the academy.', 'unitsOwned', null, 30, 3, [g(100), O(2)], 'LATER', { series: 'units', with: 'roster merge' }),
  A('battle', 'a_hero_25', "Commander's Rise", 'Your hero reaches Lv 25 during a battle.', 'counter', 'heroMax', 25, 2, [g(30), O()], 'LATER', { with: 'hero rework' }),
  A('students', 'a_bond_10', 'Best Friends', 'Reach bond level 10 with any student.', 'bondMax', null, 10, 2, [g(50), O()], 'LATER', { with: 'the City' }),
];

/** Freeplay titles that already exist (profile SPEC §3.1); kept as is (owner-approved). */
export const FREEPLAY_TITLES = { fp_ashwing: tt('Ashwing Slayer', 'gold'), fp_crimson: tt('Crimson Slayer', 'prism') };

/** Achievement ids that never give a title, ribbon or pin (spending / luck signals). */
export const NO_COSMETIC = (id) => /^a_pulls_/.test(id) || id === 'a_units_all' || id === 'a_reroll_10';
