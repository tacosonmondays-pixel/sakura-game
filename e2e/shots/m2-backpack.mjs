// M2 (docs/specs/UI_V2_MENUS.md): the Backpack and the gear grid. e2e/menus.mjs --milestone m2.
import { isScreen, clickOpen, clicks, scrollBody } from './_util.mjs';
import { seedGearMany } from '../uiSeed.mjs';

export const milestone = 'm2';
const bp = (tab, extra = {}) => ({ hash: `#/backpack?tab=${tab}`, ready: isScreen('backpack'), kind: 'list', rebuilt: true, ...extra });

/** Sets the save's count of items (a prepare step: it runs on another screen before the Backpack is drawn). It sets,
 * never adds, so a shot taken at three sizes in one save shows the same counts at each. */
const giveItems = (items) => (page) => page.evaluate(async (list) => {
  const { store } = window.__sakura;
  const p = store.profile;
  p.items ||= {};
  for (const { id, count } of list) p.items[id] = count;
  store.commit('e2e');
  store.saveNow?.();
}, items);

/** The 30-piece save, plus boxes and tools for the Supplies dot. */
const gear30 = async (page) => {
  await seedGearMany(page);
  await giveItems([{ id: 'gearbox_rare', count: 3 }, { id: 'gearbox_mythic', count: 12 }, { id: 'dice_reroll', count: 4 }, { id: 'lock_pin', count: 2 }])(page);
};

/** Salvage mode on a 30-piece save, three spare pieces picked (the first ones that are not protected). */
const salvagePicks = async (page) => {
  await page.click('#app [data-testid="salvage-mode"]');
  await page.waitForSelector('#app .bp-ggrid.picking', { timeout: 10000 });
  const uids = await page.evaluate(() => [...document.querySelectorAll('#app .bp-ggrid.picking .ui-gtile[data-gear]:not(.blocked)')].slice(2, 5).map((t) => t.dataset.gear));
  for (const u of uids) await page.click(`#app .ui-gtile[data-gear="${u}"]`);
};

export const shots = {
  'backpack-all': bp('all'),
  'backpack-enhancement': bp('enhancement'),
  'backpack-awakening': bp('awakening'),
  'backpack-tickets': bp('tickets'),
  'backpack-tokens': bp('tokens'),
  'backpack-equipment-end': bp('equipment', { open: scrollBody('end') }),
  'backpack-item-sheet': bp('all', { open: clickOpen('#app .item-tile', '.ui-sheet') }),
  // a 30-piece bag (seedGearMany): the first screen shows 14 tiles, the whole tab ≤ 32 numbers and ≤ 2.5 screens
  'backpack-gear30': bp('equipment', { prepare: gear30 }),
  'backpack-gear30-end': bp('equipment', { prepare: gear30, open: scrollBody('end') }),
  'backpack-supplies': bp('equipment', { prepare: gear30, open: clickOpen('#app [data-testid="supplies-open"]', '[data-testid="supplies-sheet"]') }),
  'backpack-filter': bp('equipment', { prepare: gear30, open: clickOpen('#app [data-testid="bp-filter"]', '[data-testid="gear-filter-sheet"]') }),
  'backpack-sort': bp('equipment', { prepare: gear30, open: clickOpen('#app [data-testid="bp-sort"]', '[data-testid="sort-sheet"]') }),
  'backpack-salvage-picks': bp('equipment', { prepare: gear30, open: salvagePicks }),
  // the SSR Select Ticket (its picker over the Tickets tab) and the Craft Room (from a family material's item sheet)
  'backpack-sst': bp('tickets', { prepare: giveItems([{ id: 'ticket_ssr_select', count: 1 }]), open: clickOpen('#app [data-testid="use-ticket_ssr_select"]', '.sst-modal') }),
  'backpack-craft': bp('enhancement', {
    prepare: giveItems([{ id: 'mat_feather_legendary', count: 6 }]),
    open: async (page) => {
      await clicks('#app [data-item="mat_feather_legendary"]', '[data-testid="item-craft"]')(page);
      await page.waitForSelector('[data-testid="craft-room"]', { timeout: 10000 });
    },
  }),
};
// (backpack-equipment and backpack-salvage are ui-shots' own shots; salvage: salvage mode with a piece picked beside a
// Mythic one)
export const gate = { 'backpack-equipment': { rebuilt: true }, 'backpack-salvage': { rebuilt: true } };
export const list = ['backpack-all', 'backpack-enhancement', 'backpack-awakening', 'backpack-tickets', 'backpack-tokens', 'backpack-equipment',
  'backpack-equipment-end', 'backpack-item-sheet', 'backpack-salvage', 'backpack-gear30', 'backpack-gear30-end', 'backpack-supplies', 'backpack-filter',
  'backpack-sort', 'backpack-salvage-picks', 'backpack-sst', 'backpack-craft'];
