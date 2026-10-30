// Sakura Sentinels — commissions, login calendar, achievements, codes and weekly events
// (owner: systems). See CONTRACTS.md §5 and docs/ECONOMY.md.
//
// Plain data. Progress for daily/weekly commissions comes from `track(profile, event, n)`
// events listed in `events`. Achievements are evaluated from the profile by `metric`
// (see src/systems/achievementMetrics.js).

/** Events the game reports through track(). 'dailyDone' is internal (all dailies claimed). */
export const TRACK_EVENTS = ['battleWin', 'battleWinHard', 'pull', 'levelUp', 'gearReroll', 'sweep', 'kill', 'bossKill', 'login', 'spendCoins', 'dailyDone', 'assaultClear', 'gearAwaken', 'gearStitch', 'potentialUp', 'titanWin', 'titanMayhem', 'gearLimitBreak'];

/** Daily commissions: 120 gems per day in total. */
export const DAILY_MISSIONS = [
  { id: 'd_login', name: 'Morning Roll Call', desc: 'Open the game today.', events: ['login'], goal: 1, rewards: [{ id: 'gems', count: 20 }, { id: 'coins', count: 3000 }] },
  { id: 'd_win3', name: 'Patrol Duty', desc: 'Win 3 battles (sweeps and Titan Trials wins count).', events: ['battleWin', 'sweep'], goal: 3, rewards: [{ id: 'gems', count: 30 }, { id: 'book_rare', count: 2 }, { id: 'star_fragment', count: 2 }] },
  { id: 'd_kill300', name: 'Pest Control', desc: 'Defeat 300 enemies.', events: ['kill'], goal: 300, rewards: [{ id: 'gems', count: 20 }, { id: 'coins', count: 5000 }] },
  { id: 'd_level', name: 'Study Session', desc: 'Level up any student once.', events: ['levelUp'], goal: 1, rewards: [{ id: 'gems', count: 15 }, { id: 'book_common', count: 5 }] },
  { id: 'd_spend', name: 'Shopping Trip', desc: 'Spend 10,000 coins.', events: ['spendCoins'], goal: 10000, rewards: [{ id: 'gems', count: 15 }, { id: 'token_bounty', count: 2 }] },
  { id: 'd_hard', name: 'Elite Training', desc: 'Win a battle on Hard or Nightmare, or sweep a stage.', events: ['battleWinHard', 'sweep'], goal: 1, rewards: [{ id: 'gems', count: 20 }, { id: 'dice_reroll', count: 1 }] },
];

/**
 * Weekly commissions: 600 gems per week in total. `requires`: a stage id — the row is hidden (and does
 * not count toward "every weekly claimed") until that stage is cleared. The gear rows pay no gems.
 */
export const WEEKLY_MISSIONS = [
  { id: 'w_win20', name: 'Weekly Patrols', desc: 'Win 20 battles (sweeps count).', events: ['battleWin', 'sweep'], goal: 20, rewards: [{ id: 'gems', count: 150 }, { id: 'book_superRare', count: 2 }] },
  { id: 'w_kill3000', name: 'Monster Census', desc: 'Defeat 3,000 enemies.', events: ['kill'], goal: 3000, rewards: [{ id: 'gems', count: 100 }, { id: 'coins', count: 30000 }] },
  { id: 'w_boss3', name: 'Crown Hunter', desc: 'Defeat 3 minibosses, bosses or titans.', events: ['bossKill'], goal: 3, rewards: [{ id: 'gems', count: 150 }, { id: 'token_boss', count: 10 }, { id: 'star_fragment', count: 10 }] },
  { id: 'w_reroll3', name: 'Tinkerer', desc: 'Reroll gear 3 times.', events: ['gearReroll'], goal: 3, rewards: [{ id: 'gems', count: 50 }, { id: 'dice_reroll', count: 2 }] },
  { id: 'w_dailies5', name: 'Model Student', desc: 'Finish every daily commission on 5 days.', events: ['dailyDone'], goal: 5, rewards: [{ id: 'gems', count: 150 }, { id: 'ticket_recruit', count: 1 }] },
  // rainbow UR gear (docs/specs/GEAR_AWAKEN.md §6.1): the steady Seed, Total Assault opens after 5-5; Titan Trials
  // wins and sweeps count too (one weekly boss loop, ASCENSION.md build notes: 'titanWin')
  { id: 'w_rainbow', name: 'Rainbow Hunt', desc: 'Clear Total Assault or win a Titan Trial 3 times (sweeps count).', events: ['assaultClear', 'titanWin'], goal: 3, requires: '5-5', rewards: [{ id: 'seed_rainbow', count: 1 }, { id: 'needle_star', count: 1 }] },
  // Academy Clubs (docs/specs/GEAR_STATS.md §C.4): a weekly Club Armband once gear is open (2-5)
  // LR gear (docs/specs/GEAR_UPDATE.md §4.6): the weekly Nightglass Lens for Titan Trials at Mayhem
  { id: 'w_nightglass', name: 'Nightglass Hunt', desc: 'Win 3 Titan Trials victories at Mayhem this week (sweeps count).', events: ['titanMayhem'], goal: 3, requires: '8-5', rewards: [{ id: 'lens_nightglass', count: 1 }] },
  { id: 'w_club', name: 'Club Day', desc: 'Win 10 battles (sweeps count).', events: ['battleWin', 'sweep'], goal: 10, requires: '2-5', rewards: [{ id: 'club_band', count: 1 }, { id: 'coins', count: 10000 }] },
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

// Achievements live in ./achievements.js (the shipped 30 + the expansion; docs/specs/ACHIEVEMENTS.md). Re-exported
// here so every existing import keeps working.
export { ACHIEVEMENTS } from './achievements.js';

/**
 * Redemption codes (case-insensitive, spaces ignored). `action` codes do not grant items;
 * the UI performs the action after confirmation (e.g. resetting progress).
 * This file ships in the public bundle, so every code here is public. A code marked
 * `dev: true` only works in a local dev build (import.meta.env.DEV, see redeemCode); never put a
 * real developer cheat code here.
 */
export const REDEEM_CODES = {
  SAKURA2026: { rewards: [{ id: 'gems', count: 300 }, { id: 'ticket_recruit', count: 2 }], desc: 'Launch celebration!' },
  WELCOME: { rewards: [{ id: 'gems', count: 500 }, { id: 'coins', count: 20000 }, { id: 'book_rare', count: 10 }], desc: 'Welcome to Sakura Academy.' },
  TACOTUESDAY: { rewards: [{ id: 'gems', count: 240 }, { id: 'coins', count: 15000 }, { id: 'ticket_recruit', count: 1 }], desc: 'Tacos for everyone (every day of the week).' },
  // Player-facing: it only wipes the redeemer's own save (like Settings → reset), so it is not
  // dev-gated and keeps working on the live site.
  RESET67: { rewards: [], action: 'resetProgress', repeatable: true, desc: 'Resets ALL progress and returns to the title screen.' },
};

/** Weekly rotating events: double drops on one Bounty arena (chosen by weekKey). */
export const WEEKLY_EVENTS = [
  { arena: 'res-books', name: 'Exam Week', desc: 'Double drops in the Library Bounty — stock up on books!' },
  { arena: 'res-coins', name: 'Festival Stalls', desc: 'Double drops in the Coin Bounty — the stalls are overflowing.' },
  { arena: 'res-gear', name: 'Workshop Open House', desc: 'Double drops in the Gear Bounty — boxes, dice and pins.' },
  { arena: 'res-mats-a', name: 'Hunter\'s Moon', desc: 'Double drops in the feather / blade / ember / rime Bounty.' },
  { arena: 'res-mats-b', name: 'Shrine Blessing', desc: 'Double drops in the charm / rune / cog Bounty.' },
];
