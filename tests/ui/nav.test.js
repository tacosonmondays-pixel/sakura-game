// Back navigation (owner: after a clan boss fight, "Back to the clan" and then the top-left back
// arrow went back INTO the battle; the same after regular battles). parentRoute is the arrow's
// target table; the router tests run against a small fake of the browser's session history
// (hash entries, history.state, async go/back/forward, popstate + hashchange like Chromium).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parentRoute, mapRouteFor, isTransient, sameScreen } from '../../src/ui/nav.js';
import { mapRouteFor as battleMapRoute } from '../../src/ui/battle/setup.js';
import { STAGE_MAP, STAGES } from '../../src/data/stages.js';

const r = (name, params = {}) => ({ name, params });

describe('parentRoute: the back arrow target', () => {
  it('menu screens go to their fixed parent, wherever they were opened from', () => {
    for (const prev of [null, r('chat'), r('battle', { stage: 'boss-lych', clanBoss: 'a1' }), r('lobby')]) {
      expect(parentRoute('clan', { tab: 'boss' }, prev)).toEqual(r('lobby'));
      expect(parentRoute('missions', {}, prev)).toEqual(r('lobby'));
      for (const name of ['campaign', 'bounty', 'assault', 'challenge', 'commissions', 'coop']) expect(parentRoute(name, {}, prev)).toEqual(r('missions'));
      expect(parentRoute('coop', { id: 'ABCDE', host: '1' }, prev)).toEqual(r('coop'));
    }
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

  it('shares the map route with the battle results', () => {
    expect(battleMapRoute).toBe(mapRouteFor);
    expect(sameScreen(r('clan'), r('clan', { tab: 'boss' }))).toBe(true);
    expect(sameScreen(r('coop'), r('coop', { id: 'ABCDE' }))).toBe(false);
  });
});

// ---- a fake browser: session history of hash entries ---------------------------------------------
function fakeBrowser(startHash) {
  const win = new EventTarget();
  const b = { entries: [{ url: startHash, state: null }], i: 0 };
  const cur = () => b.entries[b.i];
  const fire = (type) => win.dispatchEvent(new Event(type));
  // a fragment navigation: popstate at once (Chromium does), hashchange as a task
  const fragmentNav = (oldUrl) => {
    fire('popstate');
    if (cur().url !== oldUrl) setTimeout(() => fire('hashchange'), 0);
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
        if (cur().url !== old) setTimeout(() => fire('hashchange'), 0);
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
    const names = ['lobby', 'missions', 'campaign', 'stage', 'battle', 'clan', 'coop', 'settings', 'backpack', 'student', 'students'];
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

  it('with no history below (a link or a reload), the arrow opens the parent as a new entry', async () => {
    await boot('#/clan?tab=boss');
    await arrow();
    expect(screen()).toBe('#/lobby');
    expect(browser.urls()).toEqual(['#/clan?tab=boss', '#/lobby']);
    // a fresh tab opened on a stage: stage prep still goes back where it was then opened from
    await boot('#/stage/1-3');
    await go('backpack');
    await go('stage', { id: '1-3' }); // Teleport
    await arrow();
    expect(screen()).toBe('#/backpack'); // stage prep goes back where it was opened from
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
});
