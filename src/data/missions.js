// Sakura Sentinels — commissions, login calendar, achievements, codes and weekly events
// (owner: systems). See CONTRACTS.md §5 and docs/ECONOMY.md.
//
// Plain data. Progress for daily/weekly commissions comes from `track(profile, event, n)`
// events listed in `events`. Achievements are evaluated from the profile by `metric`
// (see src/systems/missions.js).

import { UNITS } from './units.js';

/** Events the game reports through track(). 'dailyDone' is internal (all dailies claimed). */
export const TRACK_EVENTS = ['battleWin', 'battleWinHard', 'pull', 'levelUp', 'gearReroll', 'sweep', 'kill', 'bossKill', 'login', 'spendCoins', 'dailyDone'];

/** Daily commissions: 120 gems per day in total. */
export const DAILY_MISSIONS = [
  { id: 'd_login', name: 'Morning Roll Call', desc: 'Open the game today.', events: ['login'], goal: 1, rewards: [{ id: 'gems', count: 20 }, { id: 'coins', count: 3000 }] },
  { id: 'd_win3', name: 'Patrol Duty', desc: 'Win 3 battles (sweeps count).', events: ['battleWin', 'sweep'], goal: 3, rewards: [{ id: 'gems', count: 30 }, { id: 'book_rare', count: 2 }] },
  { id: 'd_kill300', name: 'Pest Control', desc: 'Defeat 300 enemies.', events: ['kill'], goal: 300, rewards: [{ id: 'gems', count: 20 }, { id: 'coins', count: 5000 }] },
  { id: 'd_level', name: 'Study Session', desc: 'Level up any student once.', events: ['levelUp'], goal: 1, rewards: [{ id: 'gems', count: 15 }, { id: 'book_common', count: 5 }] },
  { id: 'd_spend', name: 'Shopping Trip', desc: 'Spend 10,000 coins.', events: ['spendCoins'], goal: 10000, rewards: [{ id: 'gems', count: 15 }, { id: 'token_bounty', count: 2 }] },
  { id: 'd_hard', name: 'Elite Training', desc: 'Win a battle on Hard or Nightmare, or sweep a stage.', events: ['battleWinHard', 'sweep'], goal: 1, rewards: [{ id: 'gems', count: 20 }, { id: 'dice_reroll', count: 1 }] },
];

/** Weekly commissions: 600 gems per week in total. */
export const WEEKLY_MISSIONS = [
  { id: 'w_win20', name: 'Weekly Patrols', desc: 'Win 20 battles (sweeps count).', events: ['battleWin', 'sweep'], goal: 20, rewards: [{ id: 'gems', count: 150 }, { id: 'book_superRare', count: 2 }] },
  { id: 'w_kill3000', name: 'Monster Census', desc: 'Defeat 3,000 enemies.', events: ['kill'], goal: 3000, rewards: [{ id: 'gems', count: 100 }, { id: 'coins', count: 30000 }] },
  { id: 'w_boss3', name: 'Crown Hunter', desc: 'Defeat 3 minibosses or bosses.', events: ['bossKill'], goal: 3, rewards: [{ id: 'gems', count: 150 }, { id: 'token_boss', count: 10 }] },
  { id: 'w_reroll3', name: 'Tinkerer', desc: 'Reroll gear 3 times.', events: ['gearReroll'], goal: 3, rewards: [{ id: 'gems', count: 50 }, { id: 'dice_reroll', count: 2 }] },
  { id: 'w_dailies5', name: 'Model Student', desc: 'Finish every daily commission on 5 days.', events: ['dailyDone'], goal: 5, rewards: [{ id: 'gems', count: 150 }, { id: 'ticket_recruit', count: 1 }] },
];

/** 7-day login calendar (repeats). Day 7 is the big one. */
export const LOGIN_REWARDS = [
  { day: 1, rewards: [{ id: 'gems', count: 50 }, { id: 'coins', count: 5000 }] },
  { day: 2, rewards: [{ id: 'book_rare', count: 3 }, { id: 'coins', count: 10000 }] },
  { day: 3, rewards: [{ id: 'ticket_recruit', count: 1 }] },
  { day: 4, rewards: [{ id: 'gems', count: 60 }, { id: 'dice_reroll', count: 2 }] },
  { day: 5, rewards: [{ id: 'book_superRare', count: 2 }, { id: 'token_bounty', count: 5 }] },
  { day: 6, rewards: [{ id: 'token_boss', count: 8 }, { id: 'star_fragment', count: 5 }] },
  { day: 7, rewards: [{ id: 'gems', count: 150 }, { id: 'ticket_recruit', count: 1 }] },
];

const A = (id, name, desc, metric, goal, rewards, param = undefined) => (param === undefined
  ? { id, name, desc, metric, goal, rewards }
  : { id, name, desc, metric, goal, rewards, param });
const gems = (n) => ({ id: 'gems', count: n });

/**
 * One-time achievements. metric:
 *  stagesCleared (campaign stages cleared), chapterClear (param chapter id, goal 5),
 *  medals (param medal difficulty, count of campaign stages with that medal),
 *  bestiaryPct (percent of enemies discovered), pulls, maxLevel, unitsOwned, kills, wins,
 *  gearRerolls (lifetime counter), maxAwaken, bossClears (Total Assault stages cleared).
 */
export const ACHIEVEMENTS = [
  A('a_first_win', 'First Patrol', 'Clear stage 1-1.', 'stagesCleared', 1, [gems(50), { id: 'book_rare', count: 3 }]),
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((c) => A(`a_chapter_${c}`, `Chapter ${c} Complete`, `Clear every stage of chapter ${c}.`, 'chapterClear', 5, [gems(100 + 25 * c), ...(c % 2 === 0 ? [{ id: 'ticket_recruit', count: 1 }] : [])], c)),
  A('a_gold_10', 'Golden Student', 'Earn Gold medals (Hard) on 10 campaign stages.', 'medals', 10, [gems(200), { id: 'lock_pin', count: 1 }], 'hard'),
  A('a_gold_40', 'Valedictorian', 'Earn Gold medals on all 40 campaign stages.', 'medals', 40, [gems(600), { id: 'ticket_recruit', count: 2 }], 'hard'),
  A('a_sakura_1', 'Nightmare Survivor', 'Earn a Sakura medal (Nightmare) on any campaign stage.', 'medals', 1, [gems(150)], 'nightmare'),
  A('a_sakura_10', 'Sakura Sentinel', 'Earn Sakura medals on 10 campaign stages.', 'medals', 10, [gems(400), { id: 'crown_oni', count: 1 }], 'nightmare'),
  A('a_bestiary_25', 'Field Notes', 'Discover 25% of the bestiary.', 'bestiaryPct', 25, [gems(100)]),
  A('a_bestiary_50', 'Monster Scholar', 'Discover 50% of the bestiary.', 'bestiaryPct', 50, [gems(200)]),
  A('a_bestiary_100', 'Encyclopedia Sakura', 'Discover every enemy in the bestiary.', 'bestiaryPct', 100, [gems(500), { id: 'ticket_recruit', count: 2 }]),
  A('a_pulls_10', 'Welcome Committee', 'Recruit 10 times.', 'pulls', 10, [gems(50)]),
  A('a_pulls_100', 'Club President', 'Recruit 100 times.', 'pulls', 100, [gems(200)]),
  A('a_pulls_300', 'Student Council', 'Recruit 300 times.', 'pulls', 300, [gems(300), { id: 'star_fragment', count: 40 }]),
  A('a_level_20', 'Diligent', 'Raise any student to level 20.', 'maxLevel', 20, [gems(80), { id: 'book_superRare', count: 2 }]),
  A('a_level_40', 'Honor Roll', 'Raise any student to level 40.', 'maxLevel', 40, [gems(150), { id: 'book_mythic', count: 1 }]),
  A('a_level_60', 'Perfect Score', 'Raise any student to level 60.', 'maxLevel', 60, [gems(300), { id: 'book_legendary', count: 1 }]),
  A('a_awaken_1', 'Awakened', 'Awaken any student to ★1.', 'maxAwaken', 1, [gems(80)]),
  A('a_awaken_5', 'Radiant Halo', 'Awaken any student to ★5.', 'maxAwaken', 5, [gems(500)]),
  A('a_units_10', 'Growing Club', 'Own 10 students or heroes.', 'unitsOwned', 10, [gems(150)]),
  A('a_units_all', 'Full Roster', 'Own every student and hero.', 'unitsOwned', UNITS.length, [gems(500), { id: 'ticket_recruit10', count: 1 }]),
  A('a_kills_1000', 'Guardian', 'Defeat 1,000 enemies.', 'kills', 1000, [gems(80)]),
  A('a_kills_25000', 'Legend of the Academy', 'Defeat 25,000 enemies.', 'kills', 25000, [gems(300)]),
  A('a_reroll_10', 'Gambler\'s Eye', 'Reroll gear 10 times.', 'gearRerolls', 10, [gems(80), { id: 'lock_pin', count: 1 }]),
  A('a_boss_3', 'Total Assault', 'Clear all three Total Assault bosses.', 'bossClears', 3, [gems(400), { id: 'crown_dragon', count: 1 }]),
];

/**
 * Redemption codes (case-insensitive, spaces ignored). `action` codes do not grant items;
 * the UI performs the action after confirmation (e.g. resetting progress).
 */
export const REDEEM_CODES = {
  SAKURA2026: { rewards: [{ id: 'gems', count: 300 }, { id: 'ticket_recruit', count: 2 }], desc: 'Launch celebration!' },
  WELCOME: { rewards: [{ id: 'gems', count: 500 }, { id: 'coins', count: 20000 }, { id: 'book_rare', count: 10 }], desc: 'Welcome to Sakura Academy.' },
  TACOTUESDAY: { rewards: [{ id: 'gems', count: 240 }, { id: 'coins', count: 15000 }, { id: 'ticket_recruit', count: 1 }], desc: 'Tacos for everyone (every day of the week).' },
  VERITY777: { rewards: [{ id: 'gems', count: 999999 }], desc: 'Owner\'s developer code: a mountain of gems.', dev: true },
  RESET67: { rewards: [], action: 'resetProgress', repeatable: true, desc: 'Resets ALL progress and returns to the title screen.', dev: true },
};

/** Weekly rotating events: double drops on one Bounty arena (chosen by weekKey). */
export const WEEKLY_EVENTS = [
  { arena: 'res-books', name: 'Exam Week', desc: 'Double drops in the Library Bounty — stock up on books!' },
  { arena: 'res-coins', name: 'Festival Stalls', desc: 'Double drops in the Coin Bounty — the stalls are overflowing.' },
  { arena: 'res-gear', name: 'Workshop Open House', desc: 'Double drops in the Gear Bounty — boxes, dice and pins.' },
  { arena: 'res-mats-a', name: 'Hunter\'s Moon', desc: 'Double drops in the feather / blade / ember / rime Bounty.' },
  { arena: 'res-mats-b', name: 'Shrine Blessing', desc: 'Double drops in the charm / rune / cog Bounty.' },
];
