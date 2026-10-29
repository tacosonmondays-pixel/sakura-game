// M5 (docs/specs/UI_V2_MENUS.md): hubs and hosts (V4). e2e/menus.mjs --milestone m5.
import { isScreen, clickOpen } from './_util.mjs';

export const milestone = 'm5';
export const shots = {
  'commissions-weekly': { hash: '#/commissions?tab=weekly', ready: isScreen('commissions'), kind: 'list', list: '.ma-mission-list' },
  'achievements-case': { hash: '#/commissions?tab=achievements', ready: isScreen('commissions'), kind: 'list', open: clickOpen('#app [data-testid="ach-case"]', '[data-testid="ach-case-view"]') },
  challenge: { hash: '#/challenge', ready: isScreen('challenge') },
  sandbox: { hash: '#/sandbox', ready: isScreen('sandbox') },
  'happening-soon': { hash: '#/rewards?tab=soon', ready: isScreen('rewards'), kind: 'list' },
};
// (missions, commissions-daily, -login, -codes, achievements, bounty, assault, titans, happening, recruit-free, mail,
// mail-history, multiplayer, multiplayer-pvp are ui-shots' own)
export const list = ['missions', 'commissions-daily', 'commissions-weekly', 'commissions-login', 'commissions-codes', 'achievements', 'achievements-case',
  'bounty', 'assault', 'titans', 'challenge', 'sandbox', 'happening', 'happening-soon', 'recruit-free', 'mail', 'mail-history',
  'multiplayer-empty', 'multiplayer', 'multiplayer-pvp'];
