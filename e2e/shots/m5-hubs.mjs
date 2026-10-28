// M5 (docs/specs/UI_V2_MENUS.md): hubs and hosts (V4). e2e/menus.mjs --milestone m5.
// Every surface here is rebuilt in v2 (the radius check, S5, applies).
import { isScreen, clickOpen, clicks, scrollBody } from './_util.mjs';

export const milestone = 'm5';
/** Closes the open sheets (the next shot may open the same route, which keeps them). */
const closeSheets = async (page) => {
  await page.evaluate(() => document.querySelectorAll('.ui-layer .ui-close').forEach((b) => b.click()));
  await page.waitForTimeout(400);
};
const ach = { hash: '#/commissions?tab=achievements', ready: isScreen('commissions'), kind: 'list', rebuilt: true, after: closeSheets };
export const shots = {
  'commissions-weekly': { hash: '#/commissions?tab=weekly', ready: isScreen('commissions'), kind: 'list', list: '.ma-mission-list', rebuilt: true },
  'achievements-case': { ...ach, open: clickOpen('#app [data-testid="ach-case"]', '[data-testid="ach-case-view"]') },
  // the category sheet, a row's ladder sheet (the first row: its tiers and rewards)
  'achievements-cats': { ...ach, open: clickOpen('#app [data-testid="ach-category"]', '[data-testid="ach-cat-sheet"]') },
  'achievements-ladder': { ...ach, open: clickOpen('#app .ach-list .ach-row .ach-title', '[data-testid="ach-ladder-sheet"]') },
  // Claim all: the claim moment (the fanfare first when a special ribbon comes with it, else the claim modal)
  'achievements-claim': { ...ach, open: clickOpen('#app [data-testid="ach-claim-all"]', '[data-testid="ach-fanfare-skip"], [data-testid="ach-claimall-modal"]'), settleMs: 600 },
  // the Bounty arena list scrolled to the open arena's tiers (the locked tier row)
  'bounty-tiers': { hash: '#/bounty', ready: isScreen('bounty'), seed: 'm5', rebuilt: true, open: scrollBody(160, '#app .ma-loc-list') },
  // Titan Trials' MORE sheet (a Details sheet: P3's budgets do not apply inside it, its weaknesses and odds are its job)
  'titans-more': { hash: '#/titans', ready: isScreen('titans'), seed: 'm5', rebuilt: true, limit: 16, open: clickOpen('#app [data-testid="titan-more"]'), after: closeSheets },
  challenge: { hash: '#/challenge', ready: isScreen('challenge'), rebuilt: true },
  sandbox: { hash: '#/sandbox', ready: isScreen('sandbox'), rebuilt: true },
  'happening-soon': { hash: '#/rewards?tab=soon', ready: isScreen('rewards'), kind: 'list', rebuilt: true },
  // a letter read in place (its whole text)
  'mail-letter': { hash: '#/mail', ready: isScreen('mail'), kind: 'list', list: '.mbx-list', seed: 'm5', rebuilt: true, open: clicks('#app .mbx-read') },
};
/** Gate options for ui-shots' own shots on this list. */
export const gate = Object.fromEntries(['missions', 'commissions-daily', 'commissions-login', 'commissions-codes', 'achievements', 'bounty', 'assault', 'titans',
  'happening', 'happening-empty', 'recruit-free', 'mail', 'mail-history', 'multiplayer-empty', 'multiplayer', 'multiplayer-pvp'].map((n) => [n, { rebuilt: true }]));
// (missions, commissions-daily, -login, -codes, achievements, bounty, assault, titans, happening, happening-empty, recruit-free, mail,
// mail-history, multiplayer, multiplayer-pvp are ui-shots' own)
export const list = ['missions', 'commissions-daily', 'commissions-weekly', 'commissions-login', 'commissions-codes', 'achievements', 'achievements-case',
  'achievements-cats', 'achievements-ladder', 'bounty', 'bounty-tiers', 'assault', 'titans', 'titans-more', 'challenge', 'sandbox', 'happening',
  'happening-soon', 'happening-empty', 'recruit-free', 'mail', 'mail-letter', 'mail-history', 'multiplayer-empty', 'multiplayer', 'multiplayer-pvp',
  'achievements-claim'];
