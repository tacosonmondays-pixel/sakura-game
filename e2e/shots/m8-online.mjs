// M8 (docs/specs/UI_V2_MENUS.md): the online screens and Settings. e2e/menus.mjs --milestone m8.
import { isScreen, clickOpen } from './_util.mjs';
import { seedOnlineInvite, INVITE_FRIEND } from '../uiSeed.mjs';

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
  // a friend's player card (the local test server's Bea, from the Multiplayer shots' seed)
  'player-card': {
    hash: '#/messages', ready: isScreen('messages'), prepare: seedOnlineInvite, settleMs: 1800,
    open: async (page) => {
      await page.evaluate(async (f) => (await import('/src/ui/online/playerCard.js')).openPlayerCard(f.id, { name: f.name }), INVITE_FRIEND);
      await page.waitForSelector('[data-testid="player-card"]', { timeout: 10000 });
    },
  },
  'settings-battle': set('battle'),
  'settings-account': set('account'),
  'settings-about': set('about'),
};
export const list = ['coop', ...Object.keys(shots).slice(0, 5), 'settings', 'settings-display', 'settings-audio', 'settings-battle', 'settings-account', 'settings-about'];
