// Back navigation (owner: after a clan boss fight, "Back to the clan" and then the top-left back
// arrow went back INTO the battle; the same after regular battles). parentRoute is the arrow's
// target table; the router tests run against a small fake of the browser's session history
// (hash entries, history.state, async go/back/forward, popstate + hashchange like Chromium).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parentRoute, mapRouteFor, isTransient, sameScreen, menuAncestors, LIST_HUBS, RETURN_HUBS } from '../../src/ui/nav.js';
import { mapRouteFor as battleMapRoute } from '../../src/ui/battle/setup.js';
import { STAGE_MAP, STAGES } from '../../src/data/stages.js';

const r = (name, params = {}) => ({ name, params });

describe('parentRoute: the back arrow target', () => {
  it('menu screens go to their fixed parent, wherever they were opened from', () => {
    for (const prev of [null, r('chat'), r('battle', { stage: 'boss-lych', clanBoss: 'a1' }), r('student', { id: 'aoi' }), r('clan')]) {
      expect(parentRoute('clan', { tab: 'boss' }, prev)).toEqual(r('lobby'));
      expect(parentRoute('missions', {}, prev)).toEqual(r('lobby'));
      for (const name of ['campaign', 'bounty', 'assault', 'challenge', 'sandbox']) expect(parentRoute(name, {}, prev)).toEqual(r('missions'));
      expect(parentRoute('coop', {}, prev)).toEqual(r('multiplayer')); // UI M5d: the co-op screen → the Multiplayer hub
      expect(parentRoute('commissions', {}, prev)).toEqual(r('lobby')); // a lobby screen (Tasks / dock)
      expect(parentRoute('sandbox', { id: 'team' }, prev)).toEqual(r('sandbox')); // the squad step → the map step
      expect(parentRoute('coop', { id: 'ABCDE', host: '1' }, prev)).toEqual(r('coop'));
    }
  });

  it('… except straight from higher up the menus: back there (the lobby shortcuts skip Missions)', () => {
    // Lobby → Commissions dock / Tasks, event strip → Bounty, Total Assault, Menu → Co-op
    for (const name of ['campaign', 'bounty', 'assault', 'challenge', 'commissions', 'coop', 'missions', 'clan']) {
      expect(parentRoute(name, { tab: 'login' }, r('lobby'))).toEqual(r('lobby'));
    }
    // from the parent itself: that screen as it was left (its tab / chapter kept)
    const hub = r('missions', { tab: 'x' });
    expect(parentRoute('challenge', {}, hub)).toBe(hub);
    expect(parentRoute('coop', { id: 'ABCDE' }, r('coop'))).toEqual(r('coop'));
    expect(parentRoute('coop', { id: 'ABCDE' }, r('multiplayer'))).toEqual(r('multiplayer')); // a room from the hub's Create room / Join
    expect(parentRoute('coop', { id: 'ABCDE' }, r('missions'))).toEqual(r('coop')); // (Missions is no longer above the co-op screen)
    expect(parentRoute('coop', { id: 'ABCDE' }, r('coop', { id: 'FGHIJ' }))).toEqual(r('coop')); // another room: the co-op screen
    expect(menuAncestors('coop', { id: 'ABCDE' })).toEqual(['coop', 'multiplayer', 'lobby']);
    expect(menuAncestors('bounty')).toEqual(['missions', 'lobby']);
    expect(menuAncestors('lobby')).toEqual(['lobby']);
  });

  it('… and from a list hub (Happening Now, the Mall, the Mailroom): back to the list as it was left (UI M5c)', () => {
    // Happening Now's Go on the double drops (Bounty), Total Assault, the clan boss week; the Mall's token wallet chip
    const hubs = [r('rewards', { tab: 'now' }), r('rewards', { tab: 'soon' }), r('mall', { tab: 'boss' }), r('mail', { tab: 'history' })];
    for (const from of hubs) {
      for (const name of ['bounty', 'assault', 'clan', 'missions', 'commissions', 'campaign', 'challenge', 'coop', 'messages']) {
        expect(parentRoute(name, { tab: 'boss', arena: 'res-coins' }, from), `${name} from ${from.name}`).toBe(from);
      }
      expect(parentRoute('profile', {}, from)).toBe(from);
    }
    expect([...LIST_HUBS].sort()).toEqual(['mail', 'mall', 'rewards']);
    // not a list hub: the fixed parent, as before
    for (const from of [r('event', { id: 'halloween-2026' }), r('titans'), r('recruit'), r('settings')]) {
      expect(parentRoute('bounty', {}, from)).toEqual(r('missions'));
      expect(parentRoute('clan', { tab: 'boss' }, from)).toEqual(r('lobby'));
    }
    // a screen with no fixed parent already went back where it was opened from (Titan Trials, the event page)
    expect(parentRoute('titans', {}, hubs[0])).toBe(hubs[0]);
    expect(parentRoute('event', { id: 'halloween-2026' }, hubs[0])).toBe(hubs[0]);
  });

  it('stage prep goes back where it was opened from, else to its own map', () => {
    const s12 = STAGE_MAP['1-2'];
    expect(parentRoute('stage', { id: '1-2' }, r('campaign', { chapter: '1' }))).toEqual(r('campaign', { chapter: '1' }));
    expect(parentRoute('stage', { id: '1-2' }, r('missions'))).toEqual(r('missions')); // Quick start
    expect(parentRoute('stage', { id: '1-2' }, r('backpack', { tab: 'enhancement' }))).toEqual(r('backpack', { tab: 'enhancement' })); // Teleport
    // after Next Stage (the entry below is another stage), from a battle, or with no history: the map
    for (const prev of [r('stage', { id: '1-1' }), r('battle', { stage: '1-1' }), null]) {
      expect(parentRoute('stage', { id: '1-2' }, prev)).toEqual(r('campaign', { chapter: String(s12.chapter) }));
    }
    const resource = STAGES.find((s) => s.kind === 'resource');
    const boss = STAGES.find((s) => s.kind === 'boss');
    expect(parentRoute('stage', { id: resource.id }, null)).toEqual(r('bounty'));
    expect(parentRoute('stage', { id: boss.id }, null)).toEqual(r('assault'));
    expect(parentRoute('stage', { id: '1-2', endless: '1' }, null)).toEqual(r('challenge'));
    expect(parentRoute('stage', { id: 'no-such-stage' }, null).name).toBe('campaign');
  });

  it('the Mailroom (#/mail, UI M5c) has no fixed parent: back to where it was opened, else the lobby', () => {
    for (const prev of [r('lobby'), r('journal'), r('event', { id: 'halloween-2026', tab: 'gifts' }), r('missions')]) {
      expect(parentRoute('mail', { tab: 'history' }, prev)).toBe(prev);
    }
    expect(parentRoute('mail', {}, null)).toEqual(r('lobby'));
    expect(parentRoute('mail', {}, r('battle', { stage: '1-1' }))).toEqual(r('lobby'));
    expect(menuAncestors('mail')).toEqual(['lobby']);
  });

  it('the Multiplayer hub (#/multiplayer, UI M5d) has no fixed parent; the co-op screen and its rooms climb to it', () => {
    for (const prev of [r('lobby'), r('missions'), r('messages', { tab: 'friends' }), r('clan', { tab: 'boss' })]) {
      expect(parentRoute('multiplayer', {}, prev)).toBe(prev);
    }
    expect(parentRoute('multiplayer', {}, null)).toEqual(r('lobby'));
    expect(parentRoute('multiplayer', {}, r('battle', { coop: 'ABCDE' }))).toEqual(r('lobby'));
    expect(menuAncestors('multiplayer')).toEqual(['lobby']);
    expect(parentRoute('coop', {}, r('multiplayer'))).toEqual(r('multiplayer'));
    expect(parentRoute('coop', {}, null)).toEqual(r('multiplayer'));
    expect(parentRoute('coop', { id: 'ABCDE', host: '1' }, null)).toEqual(r('coop'));
  });

  it('… and its Friends and Clan Boss tiles arrow back to it, not to the lobby (UI M5d review)', () => {
    const mp = r('multiplayer');
    expect(parentRoute('messages', { tab: 'friends' }, mp)).toBe(mp); // the Friends tile
    expect(parentRoute('clan', { tab: 'boss' }, mp)).toBe(mp); // Clan Boss, in a clan
    expect(parentRoute('clan', {}, mp)).toBe(mp); // Clan Boss with no clan: the clan search
    expect(RETURN_HUBS.has('multiplayer')).toBe(true);
    expect([...RETURN_HUBS].sort()).toEqual(['mail', 'mall', 'multiplayer', 'rewards']);
    // opened from anywhere else, those screens keep their fixed parent
    for (const from of [r('chat'), r('student', { id: 'aoi' }), r('settings'), null]) {
      expect(parentRoute('messages', { tab: 'friends' }, from)).toEqual(r('lobby'));
      expect(parentRoute('clan', { tab: 'boss' }, from)).toEqual(r('lobby'));
    }
    // a conversation still climbs to the Messages list first
    expect(parentRoute('messages', { id: 't1' }, mp)).toBe(mp);
    expect(parentRoute('messages', { id: 't1' }, r('messages', { tab: 'friends' }))).toEqual(r('messages', { tab: 'friends' }));
  });

  it('other screens go back to the previous screen, never to a battle', () => {
    expect(parentRoute('settings', {}, r('student', { id: 'aoi' }))).toEqual(r('student', { id: 'aoi' }));
    expect(parentRoute('settings', {}, r('battle', { stage: '1-1' }))).toEqual(r('lobby'));
    expect(parentRoute('settings', {}, null)).toEqual(r('lobby'));
    expect(parentRoute('student', { id: 'aoi' }, null)).toEqual(r('students'));
    expect(parentRoute('soundtest', {}, null)).toEqual(r('settings'));
    const names = ['lobby', 'missions', 'campaign', 'stage', 'students', 'student', 'formation', 'recruit', 'backpack', 'bounty', 'assault', 'challenge', 'mall',
      'commissions', 'rewards', 'bestiary', 'wiki', 'settings', 'chat', 'clan', 'coop', 'title', 'soundtest'];
    for (const name of names) expect(isTransient(parentRoute(name, { id: '1-1' }, r('battle', { stage: '1-1' })).name)).toBe(false);
  });

  it('shares the map route with the battle results; an endless run maps to Tactical Challenge', () => {
    expect(battleMapRoute).toBe(mapRouteFor);
    expect(mapRouteFor(STAGE_MAP['1-1'])).toEqual(r('campaign', { chapter: String(STAGE_MAP['1-1'].chapter) }));
    expect(mapRouteFor(STAGE_MAP['1-1'], { endless: true })).toEqual(r('challenge'));
    expect(parentRoute('stage', { id: '1-1', endless: 1 }, r('stage', { id: '1-1' }))).toEqual(r('challenge'));
    expect(sameScreen(r('clan'), r('clan', { tab: 'boss' }))).toBe(true);
    expect(sameScreen(r('coop'), r('coop', { id: 'ABCDE' }))).toBe(false);
  });
});

// ---- a fake browser: session history of hash entries ---------------------------------------------
function fakeBrowser(startHash) {
  const win = new EventTarget();
  const b = { entries: [{ url: startHash, state: null }], i: 0 };
  const cur = () => b.entries[b.i];
  const fire = (type, props = {}) => win.dispatchEvent(Object.assign(new Event(type), props));
  const hashchange = (oldUrl) => setTimeout(() => fire('hashchange', { oldURL: `http://game.test/${oldUrl}`, newURL: `http://game.test/${cur().url}` }), 0);
  // a fragment navigation: popstate at once (Chromium does), hashchange as a task
  const fragmentNav = (oldUrl) => {
    fire('popstate');
    if (cur().url !== oldUrl) hashchange(oldUrl);
  };
  b.location = {
    get hash() {
      return cur().url;
    },
    set hash(v) {
      if (v === cur().url) return;
      const old = cur().url;
      b.entries.length = b.i + 1;
      b.entries.push({ url: v, state: null });
      b.i++;
      fragmentNav(old);
    },
    replace(v) {
      const old = cur().url;
      b.entries[b.i] = { url: v, state: null };
      fragmentNav(old);
    },
  };
  b.history = {
    get state() {
      return cur().state;
    },
    get length() {
      return b.entries.length;
    },
    replaceState(state, _title, url) {
      cur().state = state == null ? null : structuredClone(state);
      if (url != null) cur().url = url;
    },
    go(n) {
      setTimeout(() => {
        const to = b.i + n;
        if (!n || to < 0 || to >= b.entries.length) return;
        const old = cur().url;
        b.i = to;
        fire('popstate');
        if (cur().url !== old) hashchange(old);
      }, 0);
    },
    back() {
      this.go(-1);
    },
    forward() {
      this.go(1);
    },
  };
  b.window = win;
  b.urls = () => b.entries.map((e) => e.url);
  return b;
}

const settle = async () => {
  for (let k = 0; k < 12; k++) await new Promise((res) => setTimeout(res, 0));
};

describe('router: back arrow and battle history entries', () => {
  let browser;
  let router;
  let renders;
  const saved = {};

  async function boot(startHash) {
    browser = fakeBrowser(startHash);
    Object.defineProperty(globalThis, 'window', { value: browser.window, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'location', { value: browser.location, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'history', { value: browser.history, configurable: true, writable: true });
    vi.resetModules();
    router = await import('../../src/ui/router.js');
    renders = [];
    const names = ['lobby', 'missions', 'campaign', 'stage', 'battle', 'clan', 'coop', 'multiplayer', 'messages', 'settings', 'backpack', 'student', 'students'];
    for (const name of names) {
      router.registerRoute(name, async () => ({ render: (_root, params) => { renders.push(router.buildHash(name, params)); } }));
    }
    const root = { firstChild: null, dataset: {}, classList: { add() {}, remove() {} }, offsetWidth: 0, textContent: '' };
    router.startRouter(root);
    await settle();
  }
  const go = async (name, params, opts) => {
    router.navigate(name, params, opts);
    await settle();
  };
  const arrow = async () => {
    router.back();
    await settle();
  };
  const screen = () => router.buildHash(router.currentRoute().name, router.currentRoute().params);
  /** What a screen does when a tab / chapter / arena / difficulty is picked (stage.js rememberParams). */
  const remember = (patch) => {
    const route = router.currentRoute();
    Object.assign(route.params, patch);
    browser.history.replaceState(browser.history.state, '', router.buildHash(route.name, route.params));
  };
  const noBattle = () => expect(browser.urls().filter((u) => u.startsWith('#/battle'))).toEqual([]);

  beforeEach(() => {
    for (const k of ['window', 'location', 'history']) saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    for (const k of ['window', 'location', 'history']) {
      if (saved[k]) Object.defineProperty(globalThis, k, saved[k]);
      else delete globalThis[k];
    }
    vi.restoreAllMocks();
  });

  it('clan boss: "Back to the clan" leaves no battle entry, the arrow then goes to the lobby', async () => {
    await boot('#/lobby');
    await go('clan');
    await go('clan', { tab: 'boss' }, { replace: true }); // tab switch
    await go('battle', { stage: 'boss-lych', difficulty: 'normal', clanBoss: 'a1' });
    expect(screen()).toMatch(/^#\/battle/);
    await go('clan', { tab: 'boss' }); // results: "Back to the clan"
    expect(screen()).toBe('#/clan?tab=boss');
    expect(browser.i).toBe(1); // stepped back onto the clan entry: no duplicate
    noBattle();
    await arrow();
    expect(screen()).toBe('#/lobby');
    expect(browser.i).toBe(0); // the arrow stepped back too: the phone back gesture agrees
    expect(browser.urls()).toEqual(['#/lobby', '#/clan?tab=boss', '#/clan?tab=boss']);
    // forward through everything: never the battle again
    browser.history.go(2);
    await settle();
    expect(screen()).toBe('#/clan?tab=boss');
    expect(renders.filter((h) => h.startsWith('#/battle'))).toHaveLength(1);
  });

  it('campaign: Next Stage replaces the battle; arrows climb map → Missions → lobby', async () => {
    await boot('#/lobby');
    await go('missions');
    await go('campaign', { chapter: '1' });
    await go('stage', { id: '1-1' });
    await go('battle', { stage: '1-1', difficulty: 'easy' });
    await go('stage', { id: '1-2' }); // Next Stage
    expect(browser.urls()).toEqual(['#/lobby', '#/missions', '#/campaign?chapter=1', '#/stage/1-1', '#/stage/1-2']);
    expect(browser.i).toBe(4);
    await arrow();
    expect(screen()).toBe('#/campaign?chapter=1');
    expect(browser.i).toBe(2);
    await arrow();
    expect(screen()).toBe('#/missions');
    await arrow();
    expect(screen()).toBe('#/lobby');
    expect(browser.i).toBe(0);
    expect(browser.history.length).toBe(5); // no entry was added on the way back
  });

  it('Quit returns onto the stage prep entry, Map and Home onto theirs', async () => {
    await boot('#/lobby');
    await go('missions');
    await go('campaign', { chapter: '1' });
    await go('stage', { id: '1-1' });
    await go('battle', { stage: '1-1', difficulty: 'normal' });
    await go('stage', { id: '1-1' }); // Pause → Quit
    expect(screen()).toBe('#/stage/1-1');
    expect(browser.i).toBe(3);
    noBattle();
    await arrow();
    expect(screen()).toBe('#/campaign?chapter=1');
    await go('stage', { id: '1-1' });
    await go('battle', { stage: '1-1', difficulty: 'normal' });
    await go('campaign', { chapter: '1' }); // results: Map
    expect(screen()).toBe('#/campaign?chapter=1');
    expect(browser.i).toBe(2);
    await go('stage', { id: '1-1' });
    await go('battle', { stage: '1-1', difficulty: 'normal' });
    await go('lobby'); // results: Home
    expect(screen()).toBe('#/lobby');
    expect(browser.i).toBe(0);
    noBattle();
  });

  it('leaving a battle for a screen not in the history replaces the battle entry', async () => {
    await boot('#/lobby');
    await go('stage', { id: '1-1' });
    await go('battle', { stage: '1-1' });
    await go('settings'); // e.g. "Graphics unavailable" → Settings
    expect(browser.urls()).toEqual(['#/lobby', '#/stage/1-1', '#/settings']);
    expect(browser.i).toBe(2);
    await arrow(); // back to where Settings was opened from (the battle is gone): stage prep
    expect(screen()).toBe('#/stage/1-1');
    expect(browser.i).toBe(1);
  });

  it('a battle left with the back gesture is skipped when going forward again', async () => {
    await boot('#/lobby');
    await go('stage', { id: '1-1' });
    await go('battle', { stage: '1-1' });
    browser.history.back(); // phone back mid-battle
    await settle();
    expect(screen()).toBe('#/stage/1-1');
    browser.history.forward(); // the old battle entry: not started again
    await settle();
    expect(screen()).toBe('#/stage/1-1');
    expect(browser.i).toBe(1);
    expect(renders.filter((h) => h.startsWith('#/battle'))).toHaveLength(1);
  });

  it('with no history below (a link or a reload), the arrow opens the parent in place', async () => {
    await boot('#/clan?tab=boss');
    await arrow();
    expect(screen()).toBe('#/lobby');
    expect(browser.urls()).toEqual(['#/lobby']); // the arrow never adds an entry
    // a fresh tab opened on a stage: stage prep still goes back where it was then opened from
    await boot('#/stage/1-3');
    await go('backpack');
    await go('stage', { id: '1-3' }); // Teleport
    await arrow();
    expect(screen()).toBe('#/backpack'); // stage prep goes back where it was opened from
    expect(browser.i).toBe(1);
  });

  it('the arrow climbs to the top from a deep link instead of bouncing between two screens', async () => {
    await boot('#/student/aoi?tab=level');
    await arrow();
    expect(screen()).toBe('#/students');
    await arrow(); // not back to the student it was opened in place of
    expect(screen()).toBe('#/lobby');
    expect(browser.urls()).toEqual(['#/lobby']);
    await boot('#/stage/1-3');
    await arrow();
    expect(screen()).toBe(`#/campaign?chapter=${STAGE_MAP['1-3'].chapter}`);
    await arrow();
    expect(screen()).toBe('#/missions');
    await arrow();
    expect(screen()).toBe('#/lobby');
    expect(browser.urls()).toEqual(['#/lobby']);
  });

  it('a step back out of a battle lands with the params it was asked for', async () => {
    await boot('#/lobby');
    await go('clan'); // the clan opened on its default tab, Fight reached without a tab switch
    await go('battle', { stage: 'boss-lych', difficulty: 'normal', clanBoss: 'a1' });
    await go('clan', { tab: 'boss' }); // "Back to the clan"
    expect(screen()).toBe('#/clan?tab=boss');
    expect(browser.i).toBe(1);
    expect(browser.urls()).toEqual(['#/lobby', '#/clan?tab=boss', '#/clan?tab=boss']);
    expect(router.historyMirror()).toEqual({ idx: 1, entries: ['#/lobby', '#/clan?tab=boss', '#/clan?tab=boss'] });
    // Quit: stage prep keeps the difficulty it was left on
    await boot('#/campaign?chapter=1');
    await go('stage', { id: '1-1', difficulty: 'hard' });
    await go('battle', { stage: '1-1', difficulty: 'hard' });
    await go('stage', { id: '1-1' }); // Pause → Quit
    expect(screen()).toBe('#/stage/1-1?difficulty=hard');
    expect(browser.i).toBe(1);
    noBattle();
    await arrow();
    expect(screen()).toBe('#/campaign?chapter=1');
    expect(browser.i).toBe(0);
  });

  it('keeps its place in the history when a screen rewrites the URL in place', async () => {
    await boot('#/lobby');
    await go('backpack');
    browser.history.replaceState(browser.history.state, '', '#/backpack?tab=gear'); // tab switch
    await go('student', { id: 'aoi' });
    browser.history.replaceState(null, '', '#/student/aoi?tab=gear'); // a careless screen
    await go('settings');
    await arrow();
    expect(screen()).toBe('#/student/aoi?tab=gear');
    expect(browser.i).toBe(2);
    await arrow();
    expect(screen()).toMatch(/^#\/backpack/);
    expect(browser.i).toBe(1);
  });

  it('navigate(…, { replace: true }) swaps the entry in place; a plain navigate adds one', async () => {
    await boot('#/title');
    await go('lobby', {}, { replace: true }); // title → TAP TO START
    expect(browser.urls()).toEqual(['#/lobby']);
    await go('clan');
    await go('clan', { tab: 'boss' }, { replace: true }); // tab switch
    expect(browser.urls()).toEqual(['#/lobby', '#/clan?tab=boss']);
    expect(browser.i).toBe(1);
    expect(router.historyMirror()).toEqual({ idx: 1, entries: ['#/lobby', '#/clan?tab=boss'] });
    expect(screen()).toBe('#/clan?tab=boss');
  });

  it('two navigations before the first hashchange keep the history mirror in step', async () => {
    await boot('#/lobby');
    router.navigate('missions');
    router.navigate('campaign', { chapter: '1' }); // a second tap in the same task
    await settle();
    expect(screen()).toBe('#/campaign?chapter=1');
    expect(router.historyMirror()).toEqual({ idx: 2, entries: ['#/lobby', '#/missions', '#/campaign?chapter=1'] });
    expect(browser.entries.map((e) => e.state?.navIdx)).toEqual([0, 1, 2]);
    await go('stage', { id: '1-1' });
    await go('battle', { stage: '1-1' }); // drawn, not mistaken for an old battle entry
    expect(screen()).toMatch(/^#\/battle/);
    await arrow(); // (no arrow in battle; back() from a battle still never stays in one)
    expect(screen()).toBe('#/stage/1-1');
    noBattle();
    await arrow();
    expect(screen()).toBe('#/campaign?chapter=1');
    expect(browser.i).toBe(2);
  });

  it('a step that never lands gives up and opens the screen directly', async () => {
    await boot('#/lobby');
    await go('missions');
    await go('campaign');
    const realGo = browser.history.go;
    browser.history.go = () => {}; // e.g. the entries below were dropped behind the router's back
    await arrow();
    expect(screen()).toBe('#/campaign'); // waiting for the step …
    await new Promise((res) => setTimeout(res, 1700));
    await settle();
    expect(screen()).toBe('#/missions'); // … then the parent opened as a new entry
    browser.history.go = realGo;
    await arrow();
    expect(screen()).toBe('#/lobby');
  });

  it('a double tap on a way out steps back only once', async () => {
    await boot('#/lobby');
    await go('missions');
    await go('stage', { id: '1-1' });
    await go('battle', { stage: '1-1' });
    router.navigate('lobby');
    router.navigate('lobby');
    await settle();
    expect(browser.i).toBe(0);
    expect(screen()).toBe('#/lobby');
    router.navigate('missions');
    await settle();
    expect(screen()).toBe('#/missions');
    router.back();
    router.back();
    await settle();
    expect(screen()).toBe('#/lobby');
    expect(browser.i).toBe(0);
  });
  it('the arrow lands on the screen below as the player left it (URL rewritten in place)', async () => {
    // campaign: opened on chapter 2, Chapter 1 tab picked, 1-3 prep → arrow: Chapter 1
    await boot('#/lobby');
    await go('missions');
    await go('campaign', { chapter: '2' });
    remember({ chapter: '1' });
    await go('stage', { id: '1-3' });
    await arrow();
    expect(screen()).toBe('#/campaign?chapter=1');
    expect(browser.i).toBe(2);
    // the back gesture agrees
    await go('stage', { id: '1-3' });
    browser.history.back();
    await settle();
    expect(screen()).toBe('#/campaign?chapter=1');
    // bounty: opened from the event strip on one arena, another arena picked → its prep → arrow
    await boot('#/lobby');
    await go('bounty', { arena: 'res-coins' });
    remember({ arena: 'res-books', tier: '3' });
    await go('stage', { id: 'res-books-3' });
    await arrow();
    expect(screen()).toBe('#/bounty?arena=res-books&tier=3');
    // mall: opened on Gems, General picked, a girl opened → arrow
    await boot('#/lobby');
    await go('mall', { tab: 'gems' });
    remember({ tab: 'general' });
    await go('student', { id: 'aoi' });
    await arrow();
    expect(screen()).toBe('#/mall?tab=general');
    expect(browser.i).toBe(1);
  });

  it('… also after the back and forward gestures, and a hash set from outside', async () => {
    await boot('#/lobby');
    await go('missions');
    await go('campaign', { chapter: '2' });
    await go('stage', { id: '1-3' });
    browser.history.back(); // gesture back onto the map …
    await settle();
    remember({ chapter: '1' }); // … another chapter there …
    browser.history.forward(); // … and forward to 1-3 prep again
    await settle();
    expect(screen()).toBe('#/stage/1-3');
    await arrow();
    expect(screen()).toBe('#/campaign?chapter=1');
    expect(browser.i).toBe(2);
    // a hash set from outside the router (a link, a typed URL): the entry left keeps its URL
    remember({ chapter: '3' });
    browser.location.hash = '#/settings';
    await settle();
    expect(screen()).toBe('#/settings');
    expect(router.historyMirror().entries[2]).toBe('#/campaign?chapter=3');
    await arrow();
    expect(screen()).toBe('#/campaign?chapter=3');
  });

  it('a menu screen opened straight from the lobby arrows back to the lobby, from Missions to Missions', async () => {
    await boot('#/lobby');
    await go('commissions'); // the dock button / Tasks shortcut
    await arrow();
    expect(screen()).toBe('#/lobby');
    expect(browser.i).toBe(0);
    for (const [name, params] of [['bounty', { arena: 'res-coins' }], ['assault', {}], ['coop', {}], ['commissions', { tab: 'login' }]]) {
      await go(name, params);
      await arrow();
      expect(screen()).toBe('#/lobby');
      expect(browser.i).toBe(0);
    }
    await go('missions');
    await go('challenge');
    await arrow();
    expect(screen()).toBe('#/missions');
    expect(browser.i).toBe(1);
    // a deep link (nothing below): Missions, as before
    await boot('#/bounty');
    await arrow();
    expect(screen()).toBe('#/missions');
  });

  it('Multiplayer (UI M5d): its rooms and the co-op screen arrow back to it, and it arrows back where it was opened', async () => {
    await boot('#/lobby');
    await go('multiplayer'); // the lobby's Multiplayer button / Menu
    await go('coop', { id: 'ABCDE', host: '1', stage: '1-1', difficulty: 'normal' }); // Create room
    await arrow();
    expect(screen()).toBe('#/multiplayer');
    expect(browser.i).toBe(1); // stepped back: the back gesture agrees
    await go('coop'); // the stage chip
    await arrow();
    expect(screen()).toBe('#/multiplayer');
    await arrow();
    expect(screen()).toBe('#/lobby');
    expect(browser.i).toBe(0);
    // from Missions' tile: back to Missions
    await go('missions');
    await go('multiplayer');
    await arrow();
    expect(screen()).toBe('#/missions');
    // a co-op link (nothing below): the co-op screen → Multiplayer → the lobby
    await boot('#/coop');
    await arrow();
    expect(screen()).toBe('#/multiplayer');
    await arrow();
    expect(screen()).toBe('#/lobby');
  });

  it('Multiplayer\'s Friends and Clan Boss tiles: the arrow comes back to the hub, then where the hub was opened (UI M5d review)', async () => {
    await boot('#/lobby');
    await go('missions');
    await go('multiplayer'); // Missions' tile
    await go('messages', { tab: 'friends' }); // the Friends tile
    await arrow();
    expect(screen()).toBe('#/multiplayer');
    expect(browser.i).toBe(2); // stepped back: the back gesture agrees
    await go('clan', { tab: 'boss' }); // Clan Boss
    await go('battle', { stage: 'boss-lych', difficulty: 'normal', clanBoss: 'a1' });
    await go('clan', { tab: 'boss' }); // "Back to the clan"
    await arrow();
    expect(screen()).toBe('#/multiplayer');
    noBattle();
    await arrow();
    expect(screen()).toBe('#/missions'); // the hub still goes back where it was opened
    // from the lobby's Multiplayer button: Clan Boss with no clan (the clan search) → Multiplayer → the lobby
    await boot('#/lobby');
    await go('multiplayer');
    await go('clan');
    await arrow();
    expect(screen()).toBe('#/multiplayer');
    await arrow();
    expect(screen()).toBe('#/lobby');
    expect(browser.i).toBe(0);
    // the clan opened straight from the lobby still arrows to the lobby
    await go('clan', { tab: 'boss' });
    await arrow();
    expect(screen()).toBe('#/lobby');
  });

  it('a Go on Happening Now, or the Mall\'s wallet chip, arrows back to that list on the tab it was left on', async () => {
    await boot('#/lobby');
    await go('rewards');
    remember({ tab: 'now' });
    await go('bounty', { arena: 'res-coins' }); // the double drops' Go
    await arrow();
    expect(screen()).toBe('#/rewards?tab=now');
    expect(browser.i).toBe(1); // stepped back: the phone's back gesture agrees
    await go('clan', { tab: 'boss' }); // the clan boss week's Go
    await arrow();
    expect(screen()).toBe('#/rewards?tab=now');
    await arrow();
    expect(screen()).toBe('#/lobby');
    // the Mall: the Boss Exchange's token wallet → Total Assault → arrow → the Boss Exchange
    await go('mall', { tab: 'general' });
    remember({ tab: 'boss' });
    await go('assault');
    await arrow();
    expect(screen()).toBe('#/mall?tab=boss');
    expect(browser.i).toBe(1);
    // deeper: Bounty → a stage → its battle → Map: Bounty's arrow still comes back to the list
    await boot('#/lobby');
    await go('rewards', { tab: 'now' });
    await go('bounty', { arena: 'res-coins' });
    await go('stage', { id: 'res-coins-1' });
    await go('battle', { stage: 'res-coins-1' });
    await go('bounty', { arena: 'res-coins' }); // results: Map
    expect(screen()).toBe('#/bounty?arena=res-coins');
    await arrow();
    expect(screen()).toBe('#/rewards?tab=now');
    noBattle();
  });

  it('stage prep keeps the difficulty picked there after a battle (Quit, the back gesture, Retry → Quit)', async () => {
    await boot('#/campaign?chapter=1');
    await go('stage', { id: '1-2' }); // defaults to Hard on this save
    remember({ difficulty: 'easy' }); // the picker
    await go('battle', { stage: '1-2', difficulty: 'easy' });
    await go('stage', { id: '1-2' }); // Pause → Quit
    expect(screen()).toBe('#/stage/1-2?difficulty=easy');
    expect(browser.i).toBe(1);
    // the battle's entry became that prep, as drawn: forward onto it shows Easy too
    expect(browser.urls()).toEqual(['#/campaign?chapter=1', '#/stage/1-2?difficulty=easy', '#/stage/1-2?difficulty=easy']);
    browser.history.forward();
    await settle();
    expect(screen()).toBe('#/stage/1-2?difficulty=easy');
    browser.history.back();
    await settle();
    await go('battle', { stage: '1-2', difficulty: 'easy' });
    browser.history.back(); // the back gesture mid-battle
    await settle();
    expect(screen()).toBe('#/stage/1-2?difficulty=easy');
    // a defeat → Retry (the battle remounts in place) → Quit
    browser.history.forward(); // (the old battle entry is skipped: back on prep)
    await settle();
    await go('battle', { stage: '1-2', difficulty: 'easy' });
    await go('stage', { id: '1-2' });
    expect(screen()).toBe('#/stage/1-2?difficulty=easy');
    expect(browser.i).toBe(1);
    noBattle();
  });

  it('an endless run: Map and the prep arrow both go to Tactical Challenge', async () => {
    await boot('#/lobby');
    await go('missions');
    await go('challenge');
    await go('stage', { id: '1-1', endless: 1 });
    await go('battle', { stage: '1-1', difficulty: 'normal', endless: 1 });
    const r = mapRouteFor(STAGE_MAP['1-1'], { endless: true }); // results: Map
    await go(r.name, r.params);
    expect(screen()).toBe('#/challenge');
    expect(browser.i).toBe(2);
    await go('stage', { id: '1-1', endless: 1 });
    await go('battle', { stage: '1-1', difficulty: 'normal', endless: 1 });
    await go('stage', { id: '1-1', endless: 1 }); // Pause → Quit
    expect(screen()).toBe('#/stage/1-1?endless=1');
    await arrow();
    expect(screen()).toBe('#/challenge');
    noBattle();
  });
});
