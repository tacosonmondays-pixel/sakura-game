// M3 (docs/specs/UI_V2_MENUS.md): the roster and the girl page (V3). e2e/menus.mjs --milestone m3.
import { isScreen, clickOpen, clicks, scrollBody, holdOn } from './_util.mjs';

export const milestone = 'm3';
// (every M3 screen is rebuilt in the kit: the radius check, S5, applies to all of them)
const girl = (id, tab, extra = {}) => ({ hash: `#/student/${id}?tab=${tab}`, ready: isScreen('student'), kind: 'detail', rebuilt: true, ...extra });

/** Settings → Display → Girl page (profile.settings.girlPage): the open page follows at once. */
const look = (mode) => (page) => page.evaluate((m) => {
  const { store } = window.__sakura;
  store.profile.settings.girlPage = m;
  store.commit('settings');
}, mode);
/** An `open` step: the Detailed look, then `then` (a sheet, a tap), on the page already drawn. */
const detailed = (then = null) => async (page) => {
  await look('detailed')(page);
  await page.waitForTimeout(700);
  if (then) await then(page);
};

/** The Backpack's gear grid: a tap on the first piece nobody wears opens the piece sheet in its spare mode. */
const spareSheet = async (page) => {
  const uid = await page.evaluate(() => {
    const p = window.__sakura.store.profile;
    return [...document.querySelectorAll('#app .bp-ggrid .ui-gtile[data-gear]')].map((t) => t.dataset.gear).find((u) => p.gear[u] && !p.gear[u].equippedBy) || null;
  });
  if (!uid) throw new Error('no spare piece in the Backpack');
  await page.click(`#app .bp-ggrid .ui-gtile[data-gear="${uid}"]`);
  await page.waitForSelector('[data-testid="gear-piece-sheet"]', { timeout: 10000, state: 'visible' });
};

export const shots = {
  'students-hold': { hash: '#/students', ready: isScreen('students'), kind: 'list', rebuilt: true, open: holdOn('#app .unit-card[data-unit="aoi"]', '[data-testid="unit-sheet"]') },
  // the hold sheet of a girl who wears her three pieces (Ruri), on its Build tab
  'students-hold-build': {
    hash: '#/students', ready: isScreen('students'), kind: 'list', rebuilt: true,
    open: async (page) => {
      await holdOn('#app .unit-card[data-unit="ruri"]', '[data-testid="unit-sheet"]')(page);
      await clicks('[data-testid="unit-sheet-tab-build"]')(page);
    },
  },
  'students-filter': { hash: '#/students', ready: isScreen('students'), kind: 'list', rebuilt: true, open: clickOpen('#app [data-testid="students-filter"]', '[data-testid="students-filter-sheet"]') },
  'girl-aoi-info': girl('aoi', 'info'),
  'girl-info-scroll': girl('ruri', 'info', { open: scrollBody('end', '#app .gp-host') }),
  'girl-level': girl('ruri', 'level'),
  'girl-level-manual': girl('ruri', 'level', { open: clicks('#app [data-testid="level-manual"]') }),
  'girl-awaken': girl('ruri', 'awaken'),
  'girl-gear-sheet': girl('ruri', 'gear', { open: clickOpen('#app [data-testid="slot-charm"]', '[data-testid="gear-sheet"]') }),
  'girl-gear-totals': girl('ruri', 'gear', { open: clickOpen('#app [data-testid="gear-more"]', '[data-testid="gear-totals-sheet"]', { force: true }) }),
  // the other Details sheets of her page: Base stats (the Info strip's Details ›) and her Profile (Open ▸)
  'girl-base-stats': girl('ruri', 'info', { open: clickOpen('#app [data-testid="info-more"]', '[data-testid="stats-sheet"]') }),
  'girl-profile': girl('ruri', 'info', { open: clickOpen('#app [data-testid="info-profile"]', '[data-testid="profile-sheet"]') }),
  'girl-tree': girl('ruri', 'tree'),
  'girl-tree-hero': girl('hikari', 'tree'),
  'girl-outfit': girl('ruri', 'info', { open: clickOpen('#app [data-testid="outfit-open"]') }),
  // the piece sheet in its spare mode, from the Backpack's gear grid
  'gear-piece-spare': { hash: '#/backpack?tab=equipment', ready: isScreen('backpack'), kind: 'list', rebuilt: true, open: spareSheet },
  // the Detailed look (Settings → Display → Girl page) on every tab: the Details on the page itself, so no number budget
  // (UI_DIRECTION.md P1); every other check holds. Last in the list: each sets the look back after its shot.
  'girl-info-detailed': girl('ruri', 'info', { open: detailed(), after: look('compact') }),
  'girl-level-detailed': girl('ruri', 'level', { open: detailed(), after: look('compact') }),
  'girl-awaken-detailed': girl('ruri', 'awaken', { open: detailed(), after: look('compact') }),
  'girl-gear-detailed': girl('ruri', 'gear', { open: detailed(), after: look('compact') }),
  'girl-tree-detailed': girl('ruri', 'tree', { open: detailed(), after: look('compact') }),
};
// (students, roster-end, girl-info, girl-info-ruri, girl-gear, girl-gear-empty, girl-gear-picker, formation and roster-pick
// are ui-shots' own shots)
export const list = ['students', 'roster-end', 'students-hold', 'students-hold-build', 'students-filter', 'girl-info', 'girl-info-ruri', 'girl-aoi-info',
  'girl-info-scroll', 'girl-level', 'girl-level-manual', 'girl-awaken', 'girl-gear', 'girl-gear-empty', 'girl-gear-sheet', 'girl-gear-picker',
  'girl-gear-totals', 'girl-base-stats', 'girl-profile', 'girl-tree', 'girl-tree-hero', 'girl-outfit', 'formation', 'roster-pick', 'gear-piece-spare',
  'girl-info-detailed', 'girl-level-detailed', 'girl-awaken-detailed', 'girl-gear-detailed', 'girl-tree-detailed'];
/** The plan's own budgets (section 5 M3 done-when): Info 10 (the default), Gear, Level and Awaken 12, Tree 6. Set here,
 * not in the plan: Level with the Manual steppers open 22 (the plan budgets Level with Manual closed; open, every book
 * shows its EXP and the count picked: 18 at 844x390 where all five now fit, 22 at 1280x720 with the gate card in view,
 * before 17 and 23), the gear sheet and its picker 12 (section 3: "≤ 12 numbers"), the Details sheets (gear totals,
 * base stats, profile), the Build tab and the Detailed look none (Details: "no number budget", P1). Every M3 shot is
 * rebuilt (the radius check). */
const REBUILT = { rebuilt: true };
export const gate = {
  students: REBUILT, 'roster-end': REBUILT, 'girl-info': REBUILT, 'girl-info-ruri': REBUILT, formation: REBUILT, 'roster-pick': REBUILT,
  'girl-gear': { limit: 12, rebuilt: true }, 'girl-gear-empty': { limit: 12, rebuilt: true }, 'girl-gear-picker': { limit: 12, rebuilt: true },
  'girl-level': { limit: 12 }, 'girl-level-manual': { limit: 22 }, 'girl-awaken': { limit: 12 }, 'girl-tree': { limit: 6 },
  'girl-gear-sheet': { limit: 12 }, 'girl-gear-totals': { limit: 99 }, 'girl-base-stats': { limit: 99 }, 'girl-profile': { limit: 99 },
  'students-hold-build': { limit: 99 },
  'girl-info-detailed': { limit: 99 }, 'girl-level-detailed': { limit: 99 }, 'girl-awaken-detailed': { limit: 99 }, 'girl-gear-detailed': { limit: 99 },
  'girl-tree-detailed': { limit: 99 },
};
