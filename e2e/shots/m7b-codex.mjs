// M7b (docs/specs/UI_V2_MENUS.md): the Notice, Bestiary and Wiki. e2e/menus.mjs --milestone m7b.
import { isScreen, clickOpen } from './_util.mjs';

export const milestone = 'm7b';
export const shots = {
  notice: {
    hash: '#/lobby', ready: isScreen('lobby'), prepareAt: ['#/missions', isScreen('missions')], prepare: async () => {},
    open: async (page) => {
      await page.click('[data-testid="top-menu"]');
      await clickOpen('[data-testid="shortcut-notice"]', '[data-testid="notice-close"]')(page);
    },
  },
  bestiary: { hash: '#/bestiary', ready: isScreen('bestiary') },
  wiki: { hash: '#/wiki', ready: isScreen('wiki') },
};
export const list = Object.keys(shots);
/** The plan's own budget (section 5 M7b): the Notice 12 outside its version rows. */
export const gate = { notice: { limit: 12 } };
