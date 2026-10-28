// M1 (docs/specs/UI_V2_MENUS.md): Campaign and Stage prep. Owned by the M1 builder; e2e/menus.mjs --milestone m1.
// The ink save: chapters 1-3 and 4-1..4-3 cleared on Easy and Normal, so 4-4 is the next stage (new) and 2-3 a cleared
// one (Sweep still locked: no Hard medal). The sheets are Details layers over prep (P1: no number budget inside them;
// their limit counts the screen behind the scrim too). The event and saved-battle shots change the save, so they run
// last and put it back.
import { isScreen, clickOpen } from './_util.mjs';

export const milestone = 'm1';

/** A saved battle on 4-3 (Save & quit at wave 12 of 25, two hours ago), as src/systems/battleSave.js stores one. */
const seedSave = (page) => page.evaluate(() => {
  const { store } = window.__sakura;
  const p = store.profile;
  const at = Date.now() - 2 * 3600e3;
  p.battleSaves ||= {};
  p.battleSaves['4-3'] = {
    id: 'bs-shot-43', slot: '4-3', stageId: '4-3', difficulty: 'normal', seed: 4242, v: 1, endless: false, createdAt: at, updatedAt: at, resumes: 0,
    snap: { v: 3, state: 'between', cash: 820, lives: 63, wave: 11, time: 480, towers: [] },
    hero: { unitId: 'hikari', stats: {} },
    loadout: ['ruri', 'aoi', 'rei', 'yuki', 'momo'].map((unitId) => ({ unitId, stats: {} })),
  };
  store.commit('e2e');
});
const dropSave = (page) => page.evaluate(() => {
  const { store } = window.__sakura;
  delete store.profile.battleSaves?.['4-3'];
  store.commit('e2e');
});
/** The Halloween operations: the first one's story episode read, so its stage opens (src/systems/events.js). */
const readEventEpisode = (page) => page.evaluate(async () => {
  const { store } = window.__sakura;
  const ev = await import('/src/systems/events.js');
  const { STAGE_MAP } = await import('/src/data/stages.js');
  const ep = STAGE_MAP['ev-halloween-1']?.gate?.episode;
  const st = ev.eventState(store.profile, 'halloween-2026');
  if (ep && !st.read.includes(ep)) st.read.push(ep);
  store.commit('e2e');
});
const sheet = (testid, id) => clickOpen(`#app [data-testid="${testid}"]`, `[data-testid="${id}"]`);
/** Closes the sheet through its own X (ui-shots clears modals only; the next shot may open prep on the same route). */
const closeSheet = async (page) => {
  await page.evaluate(() => document.querySelectorAll('.ui-layer .ui-close').forEach((b) => b.click()));
  await page.waitForTimeout(300);
};

const prep = (hash, extra = {}) => ({ hash, ready: isScreen('stage'), kind: 'detail', limit: 11, rebuilt: true, ...extra });
export const shots = {
  'campaign-ch4': { hash: '#/campaign?chapter=4', ready: isScreen('campaign'), rebuilt: true },
  'campaign-ch1': { hash: '#/campaign?chapter=1', ready: isScreen('campaign'), rebuilt: true },
  // 4-4 not cleared (the ink save's next stage) and 2-3 cleared (Sweep: clear on Hard)
  'stage-prep-new': prep('#/stage/4-4'),
  'stage-prep-cleared': prep('#/stage/2-3'),
  // UI_DIRECTION §6.3's second count: 2-3, cleared, Nightmare selected
  'stage-prep-nightmare': prep('#/stage/2-3?difficulty=nightmare'),
  // the four sheets (Details layers: the screen behind counts too)
  'stage-prep-counters': prep('#/stage/4-4', { open: sheet('prep-counters', 'counters-sheet'), after: closeSheet, limit: 20 }),
  // (the drop grid scrolls in the sheet: a tile its bottom edge cuts measures only its visible part, so it is judged as dense)
  'stage-prep-drops': prep('#/stage/4-4', { open: sheet('prep-drops', 'drops-sheet'), after: closeSheet, limit: 20, dense: ['.stp-sheet .ma-drop'] }),
  'stage-prep-mode': prep('#/stage/2-3', { open: sheet('prep-mode', 'mode-sheet'), after: closeSheet, limit: 20 }),
  'stage-prep-info': prep('#/stage/4-4', { open: sheet('prep-info', 'info-sheet'), after: closeSheet, limit: 20 }),
  // a Freeplay tier picked in the Mode sheet: the chip and Start name it
  'stage-prep-freeplay': prep('#/stage/2-3?freeplay=blossom'),
  // the Halloween event's first operation (its events line) and a saved battle's Continue
  'stage-prep-event': prep('#/stage/ev-halloween-1', { prepare: readEventEpisode }),
  'stage-prep-continue': prep('#/stage/4-3', { prepare: seedSave, after: dropSave }),
};
export const list = Object.keys(shots);
