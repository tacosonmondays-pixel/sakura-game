// M7a (docs/specs/UI_V2_MENUS.md): Profile, Story, Journal and the event page. e2e/menus.mjs --milestone m7a.
// Every surface here is rebuilt in v2 (the radius check, S5, applies).
import { isScreen, clickOpen, clicks } from './_util.mjs';
import { seedOnlineInvite, INVITE_FRIEND } from '../uiSeed.mjs';

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
/** The story rows of the save in the page (the archive's own list). */
const storyRows = async () => {
  const [{ SCENE_LIST }, { episodeList }, { hasUnit }] = await Promise.all([
    import('/src/data/story/index.js'), import('/src/systems/storyTriggers.js'), import('/src/ui/story/play.js')]);
  return episodeList(window.__sakura.store.profile, SCENE_LIST, hasUnit);
};
/** The first chapter with two open episodes and a locked one (else the first with two open), for the mixed-cards shot. */
const mixedChapter = (page) => page.evaluate(async (src) => {
  const rows = await (0, eval)(src)();
  const chs = [...new Set(rows.map((r) => r.chapter))];
  const of = (c) => rows.filter((r) => r.chapter === c);
  const open = (c) => of(c).filter((r) => r.unlocked).length >= 2;
  return chs.find((c) => open(c) && of(c).some((r) => !r.unlocked)) ?? chs.find(open) ?? null;
}, `(${storyRows})`);
/** Marks that chapter's first open episode read (the ink save has read none), and undoes it after the shot. */
const readFirst = async (page) => {
  const ch = await mixedChapter(page);
  await page.evaluate(async ([src, c]) => {
    const row = (await (0, eval)(src)()).find((r) => r.chapter === c && r.unlocked && !r.seen);
    if (!row) return;
    const { storyOf } = await import('/src/systems/story.js');
    const { store } = window.__sakura;
    storyOf(store.profile).seen.push(row.id);
    window.__m7aRead = row.id;
    store.commit('e2e');
  }, [`(${storyRows})`, ch]);
};
const unreadFirst = (page) => page.evaluate(async () => {
  const id = window.__m7aRead;
  if (!id) return;
  const { storyOf } = await import('/src/systems/story.js');
  const { store } = window.__sakura;
  const seen = storyOf(store.profile).seen;
  if (seen.includes(id)) seen.splice(seen.indexOf(id), 1);
  window.__m7aRead = null;
  store.commit('e2e');
});
/** The game again with (`online`) or without ?online=local: a visit needs the local test server (e2e/profile.mjs too). */
const reopen = async (page, online) => {
  const u = new URL(page.url());
  await page.goto(`${u.origin}${u.pathname}?${online ? 'online=local&' : ''}onboarding=0#/lobby`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 60000 });
};
/** A visit: online on the local test server with Bea as a friend (uiSeed.mjs), and back to the plain game after. */
const visitPrep = async (page) => {
  await reopen(page, true);
  await seedOnlineInvite(page);
};
const visitAfter = async (page) => {
  await closeSheets(page);
  await reopen(page, false);
};
const profileSheet = (sel, waitFor) => ({ hash: '#/profile', ready: isScreen('profile'), kind: 'detail', rebuilt: true, open: clickOpen(sel, waitFor), after: closeSheets });
/**
 * An LR girl in the auto showcase: Tenka at LV 60, gate 5, ★5 after her Limit Break (the banners' Nightglass frame on
 * the showcase card, which came into profile/parts.js with v0.1.59, after M7a's review round 1). The save is put back
 * after the shot.
 */
const lrPrep = (page) => page.evaluate(async () => {
  const { store } = window.__sakura;
  const p = store.profile;
  const counters = (p.missions.counters ||= {});
  window.__m7aLr = { unit: p.units.tenka ? JSON.parse(JSON.stringify(p.units.tenka)) : null, lr: counters['lr:tenka'] };
  if (!p.units.tenka) (await import('/src/systems/unlocks.js')).grantUnit(p, 'tenka', 1760000000000);
  Object.assign(p.units.tenka, { level: 60, breakthrough: 5, awaken: 5 });
  counters['lr:tenka'] = 1;
  store.commit('e2e');
});
const lrAfter = (page) => page.evaluate(() => {
  const s = window.__m7aLr;
  if (!s) return;
  const { store } = window.__sakura;
  const p = store.profile;
  if (s.unit) p.units.tenka = s.unit;
  else delete p.units.tenka;
  if (s.lr == null) delete p.missions.counters['lr:tenka'];
  else p.missions.counters['lr:tenka'] = s.lr;
  window.__m7aLr = null;
  store.commit('e2e');
});
export const shots = {
  'profile-edit': profileSheet('#app [data-testid="profile-edit"]', '[data-testid="edit-profile"]'),
  // the profile's other sheets: Edit Showcase, the pin picker, the Preview (the visitor layout)
  'profile-showcase': profileSheet('#app [data-testid="profile-showcase-edit"]', '[data-testid="showcase-editor"]'),
  'profile-pins': profileSheet('#app [data-testid="profile-pin"]', '[data-testid="pin-picker"]'),
  'profile-preview': profileSheet('#app [data-testid="profile-preview"]', '[data-testid="profile-preview-overlay"]'),
  // a visit: a friend's basic profile on the local test server (uiSeed.mjs seedOnlineInvite), then its More sheet
  'profile-visit': { hash: `#/profile/${INVITE_FRIEND.id}`, prepare: visitPrep, after: visitAfter, settleMs: 1800, ready: isScreen('profile'), kind: 'detail', rebuilt: true },
  'profile-visit-more': { hash: `#/profile/${INVITE_FRIEND.id}`, prepare: visitPrep, after: visitAfter, settleMs: 1800, ready: isScreen('profile'), kind: 'detail', rebuilt: true,
    open: clickOpen('#app [data-testid="profile-more"]', '[data-testid="profile-more-sheet"]') },
  story: { hash: '#/story', ready: isScreen('story'), rebuilt: true },
  // a chapter with read, NEW and locked episode cards (its first open episode marked read for the shot)
  'story-mixed': { hash: '#/story?ch=2', resolve: async (page) => { const c = await mixedChapter(page); return c == null ? null : `#/story?ch=${c}`; }, prepare: readFirst, after: unreadFirst, ready: isScreen('story'), rebuilt: true },
  journal: { hash: '#/journal', ready: isScreen('journal'), rebuilt: true },
  // another lesson open (the second row)
  'journal-entry': { hash: '#/journal', ready: isScreen('journal'), rebuilt: true, open: clicks('#app .jn-card:nth-child(2)') },
  'event-story': ev('story'),
  'event-operations': ev('stages'),
  'event-missions': ev('missions'),
  'event-exchange': ev('exchange'),
  'event-gifts': ev('gifts'),
  // (last: the save changes for it) an LR girl's showcase card
  'profile-lr': { hash: '#/profile', prepare: lrPrep, after: lrAfter, ready: isScreen('profile'), kind: 'detail', rebuilt: true },
};
/** Gate options for ui-shots' own `profile` shot. */
export const gate = { profile: { rebuilt: true } };
export const list = ['profile', ...Object.keys(shots)];
