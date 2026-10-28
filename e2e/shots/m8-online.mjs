// M8 (docs/specs/UI_V2_MENUS.md): the online screens and Settings. e2e/menus.mjs --milestone m8.
import { isScreen, clickOpen } from './_util.mjs';
import { seedOnlineInvite } from '../uiSeed.mjs';

export const milestone = 'm8';
const set = (id) => ({
  hash: `#/settings?section=${id}`, ready: isScreen('settings'), kind: 'list',
  open: async (page) => { const t = await page.$(`#app [data-testid="tab-${id}"]`); if (t) await t.click(); },
});
export const shots = {
  messages: { hash: '#/messages', ready: isScreen('messages'), prepare: seedOnlineInvite, settleMs: 1800 },
  'messages-friends': { hash: '#/messages?tab=friends', ready: isScreen('messages'), prepare: seedOnlineInvite, settleMs: 1800 },
  chat: { hash: '#/chat', ready: isScreen('chat'), settleMs: 1800 },
  clan: { hash: '#/clan', ready: isScreen('clan'), settleMs: 1800 },
  'settings-battle': set('battle'),
  'settings-account': set('account'),
  'settings-about': set('about'),
};
export const list = ['coop', ...Object.keys(shots).slice(0, 4), 'settings', 'settings-display', 'settings-audio', 'settings-battle', 'settings-account', 'settings-about'];
