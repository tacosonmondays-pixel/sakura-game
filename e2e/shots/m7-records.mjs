// M7a (docs/specs/UI_V2_MENUS.md): Profile, Story, Journal and the event page. e2e/menus.mjs --milestone m7a.
// Every surface here is rebuilt in v2 (the radius check, S5, applies).
import { isScreen, clickOpen, clicks } from './_util.mjs';

export const milestone = 'm7a';
/** The Halloween event's route, from the event data (its id is not spelled here). */
const eventTab = (tab) => async (page) => page.evaluate(async (t) => {
  const { EVENTS } = await import('/src/data/events/index.js');
  const ev = EVENTS.find((e) => e.key === 'halloween') || EVENTS[0];
  return ev ? `#/event/${ev.id}?tab=${t}` : null;
}, tab);
// (the Operations tab's id is `stages`: tab ids never change when labels do)
const ev = (tab) => ({ hash: '#/lobby', resolve: eventTab(tab), ready: isScreen('event'), rebuilt: true });
/** Closes the profile's sheets and its Preview (the next shot opens the same route, so nothing else would). */
const closeSheets = async (page) => {
  await page.evaluate(() => {
    document.querySelectorAll('.ui-layer .ui-close').forEach((b) => b.click());
    document.querySelector('[data-testid="profile-preview-close"]')?.click();
  });
  await page.waitForTimeout(400);
};
const profileSheet = (sel, waitFor) => ({ hash: '#/profile', ready: isScreen('profile'), kind: 'detail', rebuilt: true, open: clickOpen(sel, waitFor), after: closeSheets });
export const shots = {
  'profile-edit': profileSheet('#app [data-testid="profile-edit"]', '[data-testid="edit-profile"]'),
  // the profile's other sheets: Edit Showcase, the pin picker, the Preview (the visitor layout)
  'profile-showcase': profileSheet('#app [data-testid="profile-showcase-edit"]', '[data-testid="showcase-editor"]'),
  'profile-pins': profileSheet('#app [data-testid="profile-pin"]', '[data-testid="pin-picker"]'),
  'profile-preview': profileSheet('#app [data-testid="profile-preview"]', '[data-testid="profile-preview-overlay"]'),
  story: { hash: '#/story', ready: isScreen('story'), rebuilt: true },
  // a chapter with read, NEW and locked episode cards
  'story-ch2': { hash: '#/story?ch=2', ready: isScreen('story'), rebuilt: true },
  journal: { hash: '#/journal', ready: isScreen('journal'), rebuilt: true },
  // another lesson open (the second row)
  'journal-entry': { hash: '#/journal', ready: isScreen('journal'), rebuilt: true, open: clicks('#app .jn-card:nth-child(2)') },
  'event-story': ev('story'),
  'event-operations': ev('stages'),
  'event-missions': ev('missions'),
  'event-exchange': ev('exchange'),
  'event-gifts': ev('gifts'),
};
/** Gate options for ui-shots' own `profile` shot. */
export const gate = { profile: { rebuilt: true } };
export const list = ['profile', ...Object.keys(shots)];
