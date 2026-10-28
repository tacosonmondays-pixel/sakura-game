// M7a (docs/specs/UI_V2_MENUS.md): Profile, Story, Journal and the event page. e2e/menus.mjs --milestone m7a.
import { isScreen, clickOpen } from './_util.mjs';

export const milestone = 'm7a';
/** The Halloween event's route, from the event data (its id is not spelled here). */
const eventTab = (tab) => async (page) => page.evaluate(async (t) => {
  const { EVENTS } = await import('/src/data/events/index.js');
  const ev = EVENTS.find((e) => e.key === 'halloween') || EVENTS[0];
  return ev ? `#/event/${ev.id}?tab=${t}` : null;
}, tab);
const ev = (tab) => ({ hash: '#/lobby', resolve: eventTab(tab), ready: isScreen('event') });
export const shots = {
  'profile-edit': { hash: '#/profile', ready: isScreen('profile'), kind: 'detail', open: clickOpen('#app [data-testid="profile-edit"]') },
  story: { hash: '#/story', ready: isScreen('story') },
  journal: { hash: '#/journal', ready: isScreen('journal') },
  'event-story': ev('story'),
  'event-operations': ev('operations'),
  'event-missions': ev('missions'),
  'event-exchange': ev('exchange'),
  'event-gifts': ev('gifts'),
};
export const list = ['profile', ...Object.keys(shots)];
