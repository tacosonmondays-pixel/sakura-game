// Screen transitions + Mochi, the loading slime (owner: "cleaner and animated menu transitions, loading
// screens, like black with a cute something like slime in the corner and loading"; then "just black or
// colored ... it saying loading is enough" and "try both!! We'll pick the loading screen after"). The pure
// parts run here: which transition a screen change gets, the loader's 150 ms / 450 ms rule, the router's
// hook into the transitions, the styles (transform / opacity only, 120–320 ms), Mochi's markup and its two
// looks, the two backgrounds, the setting that picks them and index.html's inline script that reads it
// before the first paint. The browser side is e2e/transitions.mjs.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { transitionFor, CUT_SCREENS, READY_SIGNALS, readySignalFor, MOTION, loaderInfoFor, BARLESS_SCREENS } from '../../src/ui/transitions/kind.js';
import { createGate, clampProgress, SHOW_AFTER_MS, MIN_SHOWN_MS } from '../../src/ui/loading/gate.js';
import {
  MOCHI_DEFS, MOCHI_INNER, mochiMarkup, MOCHI_SIZES, MOCHI_LOOKS, LOADER_BGS, LOADING_LOOK_DEFAULT, LOOK_SETTINGS, loadingLookOf, applyLoadingLook,
} from '../../src/ui/loading/mochi.js';
import { loaderMarkup } from '../../src/ui/loading/loader.js';
import { DEFAULT_SETTINGS, SAVE_KEY, SAVE_VERSION, createProfile, migrateProfile } from '../../src/systems/save.js';
import { saveText } from '../../src/core/store.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const r = (name, params = {}) => ({ name, params });

describe('transitionFor: which transition a screen change gets', () => {
  it('the first screen of the page holds the boot loader', () => {
    expect(transitionFor(null, r('lobby'))).toBe('boot');
    expect(transitionFor(r('lobby'), r('missions'), { first: true })).toBe('boot');
  });

  it('every change into or out of a battle, a story scene or the title is a cut', () => {
    for (const big of CUT_SCREENS) {
      for (const other of ['lobby', 'stage', 'missions', 'coop', 'clan', 'campaign', 'settings']) {
        expect(transitionFor(r(other), r(big, { id: 'x' })), `${other} → ${big}`).toBe('cut');
        expect(transitionFor(r(big, { id: 'x' }), r(other)), `${big} → ${other}`).toBe('cut');
        expect(transitionFor(r(big), r(other), { dir: -1 }), `${big} → ${other} (back)`).toBe('cut');
      }
    }
    expect(transitionFor(r('battle', { stage: '1-1' }), r('battle', { stage: '1-2' }))).toBe('cut');
    expect(transitionFor(r('title'), r('scene', { id: 'opening' }))).toBe('cut');
  });

  it('menu → submenu slides forward; a history step back or a parent slides back', () => {
    expect(transitionFor(r('lobby'), r('missions'))).toBe('slide');
    expect(transitionFor(r('missions'), r('campaign'))).toBe('slide');
    expect(transitionFor(r('campaign'), r('stage', { id: '1-1' }))).toBe('slide');
    expect(transitionFor(r('students'), r('student', { id: 'aoi' }))).toBe('slide');
    // by the menus: Home, a fixed parent
    expect(transitionFor(r('campaign'), r('missions'))).toBe('slide-back');
    expect(transitionFor(r('bounty'), r('lobby'))).toBe('slide-back');
    expect(transitionFor(r('settings'), r('lobby'))).toBe('slide-back');
    // by the history: the arrow / the back gesture
    expect(transitionFor(r('student', { id: 'aoi' }), r('students'), { dir: -1 })).toBe('slide-back');
    expect(transitionFor(r('stage', { id: '1-1' }), r('campaign'), { dir: -1 })).toBe('slide-back');
    // forward through the history is forward
    expect(transitionFor(r('lobby'), r('missions'), { dir: 1 })).toBe('slide');
  });

  it('the same screen with new params crossfades (the next girl, a room of the hub, a tab)', () => {
    expect(transitionFor(r('student', { id: 'aoi' }), r('student', { id: 'hikari' }))).toBe('crossfade');
    expect(transitionFor(r('coop'), r('coop', { id: 'ABCDE' }))).toBe('crossfade');
    expect(transitionFor(r('clan'), r('clan', { tab: 'boss' }))).toBe('crossfade');
    expect(transitionFor(r('backpack', { tab: 'a' }), r('backpack', { tab: 'b' }), { dir: -1 })).toBe('crossfade');
  });

  it('a screen holds its reveal on its own ready event, capped', () => {
    expect(readySignalFor('lobby')).toEqual({ event: 'lobby-stage-ready', cap: 2500 });
    expect(readySignalFor('scene')).toEqual({ event: 'story-stage-ready', cap: 2500 });
    expect(readySignalFor('students')).toBeNull();
    for (const sig of Object.values(READY_SIGNALS)) expect(sig.cap).toBeLessThanOrEqual(3000);
  });

  it('motion timings: every screen-level animation is 120–320 ms, nothing longer', () => {
    for (const k of ['slide', 'cutCover', 'cutReveal', 'crossfade', 'reducedFade', 'reducedCutCover', 'reducedCutReveal', 'loaderIn', 'loaderOut', 'bootOut', 'chipIn', 'chipOut', 'modalIn', 'modalOut', 'band']) {
      expect(MOTION[k], k).toBeGreaterThanOrEqual(120);
      expect(MOTION[k], k).toBeLessThanOrEqual(320);
    }
    for (const [k, v] of Object.entries(MOTION)) expect(v, k).toBeLessThanOrEqual(320);
    // out then in, in place: the whole change stays within 180–320 ms
    for (const [out, inn] of [['slideOut', 'slide'], ['crossfadeOut', 'crossfade'], ['reducedOut', 'reducedFade']]) {
      expect(MOTION[out] + MOTION[inn], `${out} + ${inn}`).toBeGreaterThanOrEqual(180);
      expect(MOTION[out] + MOTION[inn], `${out} + ${inn}`).toBeLessThanOrEqual(320);
    }
    // the title text crossfades without both being up at once for long: old out first, new in after
    expect(MOTION.titleOut).toBeLessThanOrEqual(MOTION.slideOut);
    expect(MOTION.titleIn).toBeLessThanOrEqual(160);
  });

  it('the loading screen only says "Loading": no destination, no tips; a battle starts its progress line at 0', () => {
    expect(loaderInfoFor('battle', { stage: '1-1', difficulty: 'easy' })).toEqual({ progress: 0 });
    expect(loaderInfoFor('battle', { stage: '1-1', resume: 'r123' })).toEqual({ progress: 0 });
    expect(loaderInfoFor('battle', { coop: 'ABCD' })).toEqual({ progress: 0 });
    expect(loaderInfoFor('stage', { id: '1-1' })).toBeNull();
    expect(loaderInfoFor('lobby')).toBeNull();
    // the tips and the destination line are gone everywhere
    expect(existsSync(join(ROOT, 'src/data/loadingTips.js'))).toBe(false);
    for (const f of ['src/ui/loading/loader.js', 'src/ui/transitions/index.js', 'src/ui/transitions/kind.js', 'src/ui/battle/controller.js', 'src/ui/screens/title.js']) {
      const src = read(f);
      expect(src, f).not.toMatch(/loadingTips|pickTip|BOOT_TIP|battleLoaderTitle|ld-tip|ld-ctx|kicker/);
    }
    expect(read('src/ui/battle/controller.js')).toMatch(/holdLoader\(shown, \{ progress: 0, immediate: true \}\)/);
    // the loader's markup: "Loading" + Mochi + the progress line, no other text
    const text = loaderMarkup().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    expect(text).toBe('Loading');
    expect(loaderMarkup()).not.toMatch(/ld-left|ld-tip|ld-ctx|TIP/);
  });

  it('screens without the top bar (a slide into them takes the old bar along)', () => {
    expect(BARLESS_SCREENS.has('lobby')).toBe(true);
    for (const n of CUT_SCREENS) expect(BARLESS_SCREENS.has(n)).toBe(true);
    expect(BARLESS_SCREENS.has('students')).toBe(false);
  });
});

// ---- the loader gate, on a hand-driven clock ------------------------------------------------------
function clock() {
  let t = 0;
  let timers = [];
  let seq = 0;
  return {
    now: () => t,
    setTimer: (fn, ms) => {
      const id = ++seq;
      timers.push({ id, at: t + ms, fn });
      return id;
    },
    clearTimer: (id) => {
      timers = timers.filter((x) => x.id !== id);
    },
    /** Advances to `to` ms, firing due timers in order. */
    async to(to) {
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        const next = timers[0];
        if (!next || next.at > to) break;
        timers.shift();
        t = next.at;
        next.fn();
        await Promise.resolve();
      }
      t = to;
      for (let i = 0; i < 5; i++) await Promise.resolve();
    },
  };
}

function gateWith(c) {
  const ev = [];
  const g = createGate({
    now: c.now,
    setTimer: c.setTimer,
    clearTimer: c.clearTimer,
    onArm: () => ev.push(['arm', c.now()]),
    onShow: () => ev.push(['show', c.now()]),
    onCancel: () => ev.push(['cancel', c.now()]),
    onHide: () => ev.push(['hide', c.now()]),
  });
  return { g, ev, kinds: () => ev.map((e) => e[0]) };
}

describe('the loader gate: visible only after 150 ms, then at least 450 ms', () => {
  it('uses 150 ms / 450 ms', () => {
    expect(SHOW_AFTER_MS).toBe(150);
    expect(MIN_SHOWN_MS).toBe(450);
  });

  it('a 149 ms load never shows anything', async () => {
    const c = clock();
    const { g, ev, kinds } = gateWith(c);
    const t = g.begin();
    expect(g.state).toBe('armed');
    await c.to(149);
    const res = await t.end();
    expect(res).toEqual({ shown: false });
    expect(kinds()).toEqual(['arm', 'cancel']);
    expect(ev.find((e) => e[0] === 'hide')).toBeUndefined();
    expect(g.state).toBe('idle');
  });

  it('a 151 ms load shows at 150 ms and stays its 450 ms (hidden at 600 ms, not before)', async () => {
    const c = clock();
    const { g, ev, kinds } = gateWith(c);
    const t = g.begin();
    await c.to(151);
    expect(kinds()).toEqual(['arm', 'show']);
    expect(ev[1][1]).toBe(150);
    let done = null;
    t.end().then((x) => {
      done = x;
    });
    await c.to(599);
    expect(done).toBeNull();
    expect(kinds()).not.toContain('hide');
    await c.to(601);
    expect(done).toEqual({ shown: true });
    const hideAt = ev.find((e) => e[0] === 'hide')[1];
    expect(hideAt).toBe(600);
    expect(hideAt - 150).toBeGreaterThanOrEqual(MIN_SHOWN_MS);
  });

  it('a load that ends during the minimum waits it out; a long one hides at once', async () => {
    let c = clock();
    let gw = gateWith(c);
    let t = gw.g.begin();
    await c.to(300);
    let p = t.end();
    await c.to(600);
    expect(await p).toEqual({ shown: true });
    expect(gw.ev.find((e) => e[0] === 'hide')[1]).toBe(600);

    c = clock();
    gw = gateWith(c);
    t = gw.g.begin();
    await c.to(2000);
    p = t.end();
    expect(gw.ev.find((e) => e[0] === 'hide')[1]).toBe(2000);
    expect(await p).toEqual({ shown: true });
  });

  it('a superseded load hands the loader on: no flicker, one hide', async () => {
    // superseded before it showed: the next load keeps the same clock (no new 150 ms wait)
    let c = clock();
    let gw = gateWith(c);
    const a = gw.g.begin();
    await c.to(100);
    const b = gw.g.begin();
    expect(a.superseded).toBe(true);
    expect(await a.end()).toEqual({ shown: false, superseded: true });
    await c.to(120);
    expect(await b.end()).toEqual({ shown: false });
    expect(gw.kinds()).toEqual(['arm', 'cancel']);

    // superseded while waiting out its minimum: it stays up for the next one, then hides once
    c = clock();
    gw = gateWith(c);
    const x = gw.g.begin();
    await c.to(300);
    const px = x.end();
    await c.to(400);
    const y = gw.g.begin();
    expect(await px).toEqual({ shown: true, superseded: true });
    expect(gw.kinds()).toEqual(['arm', 'show']); // not hidden in between
    await c.to(500);
    const py = y.end();
    await c.to(600);
    expect(await py).toEqual({ shown: true });
    expect(gw.kinds().filter((k) => k === 'hide')).toHaveLength(1);
    expect(gw.kinds().filter((k) => k === 'arm')).toHaveLength(1);
  });

  it('a loader armed earlier (the boot loader since the first paint) counts from then', async () => {
    const c = clock();
    await c.to(1000);
    const { g, ev, kinds } = gateWith(c);
    const t = g.begin({ startAt: 0 });
    expect(kinds()).toEqual(['arm', 'show']);
    expect(g.visibleAt).toBe(150);
    expect(await t.end()).toEqual({ shown: true });
    expect(ev.find((e) => e[0] === 'hide')[1]).toBe(1000); // its 450 ms are long over
  });

  it('end() twice is the same answer; a reset gate is idle', async () => {
    const c = clock();
    const { g } = gateWith(c);
    const t = g.begin();
    await c.to(10);
    const p1 = t.end();
    expect(t.end()).toBe(p1);
    g.begin();
    g.reset();
    expect(g.state).toBe('idle');
    expect(g.visibleAt).toBeNull();
  });

  it('served(): at once while not visible, else once its minimum is served (then end() hides at once)', async () => {
    let c = clock();
    let gw = gateWith(c);
    let t = gw.g.begin();
    await c.to(100);
    expect(t.visible).toBe(false);
    let served = false;
    t.served().then(() => {
      served = true;
    });
    await c.to(101);
    expect(served).toBe(true); // ending now just cancels it: no wait
    expect(await t.end()).toEqual({ shown: false });

    c = clock();
    gw = gateWith(c);
    t = gw.g.begin();
    await c.to(200);
    expect(t.visible).toBe(true);
    served = false;
    t.served().then(() => {
      served = true;
    });
    await c.to(599);
    expect(served).toBe(false);
    await c.to(600);
    expect(served).toBe(true);
    expect(gw.kinds()).not.toContain('hide'); // served() never hides by itself
    const p = t.end();
    expect(gw.ev.find((e) => e[0] === 'hide')[1]).toBe(600); // hidden in the same moment
    expect(await p).toEqual({ shown: true });
    expect(t.visible).toBe(false);
    expect(await t.served()).toBeUndefined(); // ended: nothing to wait for

    // handed on: the old ticket's wait ends at once, the new one carries the clock
    c = clock();
    gw = gateWith(c);
    const a = gw.g.begin();
    await c.to(300);
    const b = gw.g.begin();
    expect(a.visible).toBe(false);
    expect(b.visible).toBe(true);
    await a.served();
    served = false;
    b.served().then(() => {
      served = true;
    });
    await c.to(599);
    expect(served).toBe(false);
    await c.to(600);
    expect(served).toBe(true);
  });

  it('progress clamps to 0..1; unknown progress hides the line (null), never a fake bar', () => {
    expect(clampProgress(-0.5)).toBe(0);
    expect(clampProgress(0.42)).toBe(0.42);
    expect(clampProgress(3)).toBe(1);
    expect(clampProgress('0.5')).toBe(0.5);
    for (const v of [null, undefined, NaN, 'soon', true, Infinity]) expect(clampProgress(v), String(v)).toBeNull();
  });
});

// ---- the router's hook: one transition per change, the right kind, no double mounts ---------------
function fakeBrowser(startHash) {
  const win = new EventTarget();
  const b = { entries: [{ url: startHash, state: null }], i: 0 };
  const cur = () => b.entries[b.i];
  const fire = (type, props = {}) => win.dispatchEvent(Object.assign(new Event(type), props));
  const hashchange = (oldUrl) => setTimeout(() => fire('hashchange', { oldURL: `http://game.test/${oldUrl}`, newURL: `http://game.test/${cur().url}` }), 0);
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
    replaceState(state, _t, url) {
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
  return b;
}

const settle = async () => {
  for (let k = 0; k < 14; k++) await new Promise((res) => setTimeout(res, 0));
};

describe('router → transitions: the hook', () => {
  const saved = {};
  let browser;
  let router;
  let calls;
  let log;
  let gates;

  async function boot(startHash, { slow = {} } = {}) {
    browser = fakeBrowser(startHash);
    Object.defineProperty(globalThis, 'window', { value: browser.window, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'location', { value: browser.location, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'history', { value: browser.history, configurable: true, writable: true });
    vi.resetModules();
    calls = [];
    log = [];
    gates = {};
    vi.doMock('../../src/ui/transitions/index.js', () => ({
      beginScreenChange: (kind, root, info) => {
        const tx = {
          kind,
          info,
          load: (p) => p,
          covered: Promise.resolve(),
          swap: (r) => {
            log.push(`swap ${info.to}`);
            r.firstChild = null;
          },
          enter: () => log.push(`enter ${info.to}`),
        };
        calls.push({ kind, ...info });
        return tx;
      },
    }));
    router = await import('../../src/ui/router.js');
    for (const name of ['lobby', 'missions', 'campaign', 'stage', 'battle', 'students', 'student', 'settings', 'coop']) {
      router.registerRoute(name, () => {
        const mod = { render: (_root, params) => { log.push(`render ${router.buildHash(name, params)}`); return () => log.push(`cleanup ${name}`); } };
        if (!slow[name]) return Promise.resolve(mod);
        return new Promise((res) => {
          gates[name] = () => res(mod);
        });
      });
    }
    router.startRouter({ firstChild: null, dataset: {}, classList: { add() {}, remove() {} }, textContent: '' });
    await settle();
  }
  const go = async (name, params, opts) => {
    router.navigate(name, params, opts);
    await settle();
  };

  beforeEach(() => {
    for (const k of ['window', 'location', 'history']) saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.doUnmock('../../src/ui/transitions/index.js');
    for (const k of ['window', 'location', 'history']) {
      if (saved[k]) Object.defineProperty(globalThis, k, saved[k]);
      else delete globalThis[k];
    }
    vi.restoreAllMocks();
  });

  it('boot, slides, the back arrow, the cut into and out of a battle, a crossfade', async () => {
    await boot('#/lobby');
    await go('missions');
    await go('campaign', { chapter: '1' });
    await go('stage', { id: '1-1' });
    await go('battle', { stage: '1-1', difficulty: 'easy' });
    await go('stage', { id: '1-1' }); // Quit: steps back onto the prep entry
    router.back(); // the arrow: back onto the campaign entry below
    await settle();
    await go('students');
    await go('student', { id: 'aoi' });
    await go('student', { id: 'hikari' }, { replace: true }); // the arrow cycling girls
    await go('lobby'); // Home
    expect(calls.map((c) => `${c.from || '-'}→${c.to} ${c.kind}`)).toEqual([
      '-→lobby boot',
      'lobby→missions slide',
      'missions→campaign slide',
      'campaign→stage slide',
      'stage→battle cut',
      'battle→stage cut',
      'stage→campaign slide-back',
      'campaign→students slide',
      'students→student slide',
      'student→student crossfade',
      'student→lobby slide-back',
    ]);
  });

  it('the old screen is cleaned up once, only when the new one takes its place', async () => {
    await boot('#/lobby');
    log.length = 0;
    await go('missions');
    expect(log).toEqual(['cleanup lobby', 'swap missions', 'render #/missions', 'enter missions']);
  });

  it('a change superseded while its screen downloads never mounts; the old screen stays until the last one', async () => {
    await boot('#/lobby', { slow: { students: true } });
    log.length = 0;
    router.navigate('students');
    await settle();
    expect(log).toEqual([]); // still downloading: the lobby is up, not cleaned up yet
    router.navigate('settings'); // the player tapped something else meanwhile
    await settle();
    gates.students(); // the first download finishes late
    await settle();
    expect(log).toEqual(['cleanup lobby', 'swap settings', 'render #/settings', 'enter settings']);
    expect(router.currentRoute().name).toBe('settings');
    expect(log.filter((l) => l.startsWith('render'))).toHaveLength(1);
  });

  it('a leaving screen stops at once (cleanup.stop) and is cleaned up only when the next one takes its place', async () => {
    await boot('#/lobby', { slow: { students: true } });
    // the lobby's render returned a cleanup with a stop(): swap in one that records both
    log.length = 0;
    router.registerRoute('missions', () => Promise.resolve({
      render: () => Object.assign(() => log.push('cleanup missions'), { stop: () => log.push('stop missions') }),
    }));
    await go('missions');
    log.length = 0;
    router.navigate('students');
    await settle();
    expect(log).toEqual(['stop missions']); // timers / listeners off on the tap; its DOM still up
    gates.students();
    await settle();
    expect(log).toEqual(['stop missions', 'cleanup missions', 'swap students', 'render #/students', 'enter students']);
    // a stop runs once, even when the change is handed on
    router.navigate('settings');
    await settle();
    expect(log.filter((l) => l.startsWith('stop'))).toHaveLength(1);
  });

  it('the browser back gesture slides back too', async () => {
    await boot('#/lobby');
    await go('missions');
    await go('campaign', { chapter: '1' });
    browser.history.back();
    await settle();
    expect(calls.at(-1)).toMatchObject({ from: 'campaign', to: 'missions', kind: 'slide-back' });
    browser.history.forward();
    await settle();
    expect(calls.at(-1)).toMatchObject({ from: 'missions', to: 'campaign', kind: 'slide' });
  });
});

// ---- styles: transform / opacity only, short, with reduced-motion versions ---------------------------
const INDEX = read('index.html');
const INLINE_CSS = (INDEX.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
const TX_CSS = read('src/ui/styles/transitions.css');

/** @keyframes name → body */
function keyframes(css) {
  const out = {};
  const re = /@keyframes\s+([\w-]+)\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    let depth = 1;
    let i = re.lastIndex;
    while (depth && i < css.length) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      i++;
    }
    out[m[1]] = css.slice(re.lastIndex, i - 1);
  }
  return out;
}
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('the transition and loader styles', () => {
  const all = { ...keyframes(stripComments(INLINE_CSS)), ...keyframes(stripComments(TX_CSS)) };

  it('index.html carries the loader styles inline (they exist before any script)', () => {
    expect(INLINE_CSS).toMatch(/\.ld\s*\{/);
    expect(INLINE_CSS).toMatch(/@keyframes mochi-hop/);
    expect(Object.keys(all).length).toBeGreaterThanOrEqual(14);
  });

  it('every keyframe animates transform or opacity only (the compositor runs them)', () => {
    for (const [name, body] of Object.entries(all)) {
      const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]).filter((p) => p !== 'animation-timing-function');
      expect(props.length, name).toBeGreaterThan(0);
      for (const p of props) expect(['transform', 'opacity'], `@keyframes ${name}: ${p}`).toContain(p);
    }
  });

  it('every duration is 120–320 ms, except Mochi\'s own loops (1.2 s hop, 2.4 s blink)', () => {
    const LOOPS = new Set(['1.2s', '2.4s']);
    for (const [file, css] of [['index.html', stripComments(INLINE_CSS)], ['transitions.css', stripComments(TX_CSS)]]) {
      for (const m of css.matchAll(/(?:animation|transition)(?:-duration)?\s*:\s*([^;}]+)/g)) {
        const decl = m[1];
        if (/^\s*none\b/.test(decl)) continue;
        // the first time in a shorthand is the duration
        const first = decl.match(/(\d*\.?\d+)(ms|s)\b/);
        if (!first) continue;
        if (LOOPS.has(`${first[1]}${first[2]}`)) {
          expect(decl, `${file}: ${decl}`).toMatch(/infinite/);
          continue;
        }
        const ms = first[2] === 's' ? Number(first[1]) * 1000 : Number(first[1]);
        if (ms <= 1) continue; // the reduced-motion "snap" (1 ms)
        expect(ms, `${file}: ${decl.trim()}`).toBeGreaterThanOrEqual(120);
        expect(ms, `${file}: ${decl.trim()}`).toBeLessThanOrEqual(320);
      }
    }
  });

  it('reduced motion stills Mochi and covers the chip, the inline Mochi and the band', () => {
    expect(INLINE_CSS).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.mochi, \.mochi \*, \.ld-dots i \{ animation: none !important; \} \}/);
    expect(INLINE_CSS).toMatch(/html\[data-reduce-motion\] \.mochi, html\[data-reduce-motion\] \.mochi \*/);
    for (const sel of ['.ld-chip.on', '.ld-inline', '.bt-result-overlay.bt-banded']) {
      expect(TX_CSS.split('@media (prefers-reduced-motion: reduce)')[1], sel).toContain(sel);
      expect(TX_CSS, sel).toContain(`html[data-reduce-motion] ${sel}`);
    }
  });

  it('a slide never copies or restyles the whole old screen (no ghost, no universal rule over a screen)', () => {
    const css = stripComments(TX_CSS);
    expect(css).not.toMatch(/tx-ghost/);
    // a universal selector only inside the loaders' own small elements or the results sheet, never over a screen
    for (const m of css.matchAll(/([^{}]*\*[^{}]*)\{/g)) {
      for (const sel of m[1].split(',')) if (sel.includes('*')) expect(sel.trim(), sel).toMatch(/^(html\[data-reduce-motion\] )?(\.ld-[\w-]+(:not\(\.on\))?( >)? |\.bt-result-overlay\.bt-banded > \.bt-(sheet|win-girl) )/);
    }
    const driver = read('src/ui/transitions/index.js');
    expect(driver).not.toMatch(/makeGhost|removeAttribute\('data-testid'\)|removeAttribute\('id'\)/);
    // the exit animates the old layers where they are; the new screen's entrances are finished in its first frame
    expect(driver).toMatch(/requestAnimationFrame\(\(\) => quietEntrances\(r\)\)/);
    // a closing modal is inert and keeps its test ids (no per-element loop)
    const comp = read('src/ui/components.js');
    expect(comp).not.toMatch(/removeAttribute\('data-testid'\)/);
    expect(comp).toMatch(/overlay\.inert = true/);
  });

  it('the old screen-enter animation and the painted boot splash are gone', () => {
    const base = read('src/ui/styles/base.css');
    expect(base).not.toMatch(/screen-enter|\.boot\b/);
    expect(base).toMatch(/--t-screen: 280ms/);
    expect(read('src/ui/router.js')).not.toMatch(/screen-enter/);
    expect(INDEX).not.toMatch(/class="boot"/);
  });
});


// ---- Mochi, the loading slime -------------------------------------------------------------------------
/** The custom properties a CSS block (by its selector) sets: name → value. */
function cssVars(css, selector) {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) return {};
  const body = css.slice(at + selector.length + 2, css.indexOf('}', at));
  return Object.fromEntries([...stripComments(body).matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}
const hex = (c) => {
  const m = /^#([0-9a-f]{6})$/i.exec(c);
  return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null;
};
/** Hue in degrees (0–360) and saturation (0–1) of a #rrggbb colour. */
function hueSat(c) {
  const [r, g, b] = hex(c).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (!d) return { h: 0, s: 0 };
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s: d / (1 - Math.abs(max + min - 1)) };
}
const lum = (c) => {
  const [r, g, b] = hex(c).map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

describe('Mochi, the loading slime', () => {
  it('is plain inline SVG: no script, no external reference, one shared defs block', () => {
    const all = MOCHI_DEFS + mochiMarkup();
    expect(all).not.toMatch(/<script|on\w+=|javascript:|https?:|xlink:href|<image|<foreignObject/i);
    for (const ref of all.matchAll(/(?:href|url\()\s*=?\s*"?#([\w-]+)/g)) expect(ref[1]).toMatch(/^mochi-/);
    expect(MOCHI_DEFS.match(/<defs>/g)).toHaveLength(1);
    expect(mochiMarkup()).not.toMatch(/<defs>/);
    for (const id of ['mochi-defs', 'mochi-jelly', 'mochi-core', 'mochi-iris', 'mochi-sprig-g', 'mochi-eye']) expect(MOCHI_DEFS).toContain(`id="${id}"`);
  });

  it('every moving part is its own HTML layer (the compositor animates it), never an SVG child', () => {
    for (const cls of ['mochi-shadow', 'mochi-hop', 'mochi-squash', 'mochi-body', 'mochi-eyes', 'mochi-mouth-s', 'mochi-mouth-o', 'mochi-sprig']) {
      expect(MOCHI_INNER, cls).toMatch(new RegExp(`<div class="(mochi-layer )?${cls}"`));
    }
    expect(MOCHI_INNER).not.toMatch(/<animate|<set /);
    // the code and the CSS name it Mochi; nothing of the old names is left
    expect(MOCHI_DEFS + MOCHI_INNER + INLINE_CSS + TX_CSS).not.toMatch(/ldsl-|\bsl-|class="sl\b|\.sl\b/);
  });

  it('is our own design: a mint jelly with a sakura petal, big eyes with highlights and blush (not a blue drop with dot eyes)', () => {
    const mint = cssVars(INLINE_CSS, ':root');
    expect(mint['mochi-jelly-3']).toBe('#76da9c'); // mint jelly (the Green Slime's family colours)
    expect(mint['mochi-sprig-3']).toBe('#ff79a7'); // the sakura petal
    expect(mint['mochi-blush']).toBe('#ff86ad');
    expect(MOCHI_INNER).toContain('class="mochi-petal"');
    expect(MOCHI_DEFS).toMatch(/<ellipse rx="8\.6" ry="10\.6"/); // big eyes with highlights, not dots
    expect(MOCHI_DEFS.match(/<circle [^>]*fill="#fff"/g)).toHaveLength(2);
    // a rounded mochi body (wider than tall, flat bottom), never a pointed drop
    expect(MOCHI_INNER).toContain('M22 94C10 94 5 86 7 74C10 50 30 22 60 22C90 22 110 50 113 74C115 86 110 94 98 94Z');
    // no look of it is blue
    for (const look of [mint, cssVars(INLINE_CSS, 'html[data-mochi="sakura"]')]) {
      for (const k of ['mochi-jelly-2', 'mochi-jelly-3', 'mochi-jelly-4']) {
        const { h } = hueSat(look[k]);
        expect(h >= 180 && h <= 260, `${k} ${look[k]} hue ${Math.round(h)}`).toBe(false);
      }
    }
  });

  it('comes in the four sizes; its markup takes a size', () => {
    expect(MOCHI_SIZES).toEqual({ phone: 64, desktop: 80, chip: 34, inline: 40 });
    for (const s of Object.values(MOCHI_SIZES)) expect(mochiMarkup({ size: s })).toContain(`--s:${s}px`);
    expect(mochiMarkup({ cls: 'on-light' })).toMatch(/^<div class="mochi on-light" aria-hidden="true">/);
  });

  it('index.html draws the same Mochi and loader before any script (the boot loader)', () => {
    expect(INDEX).toContain(MOCHI_DEFS);
    expect(INDEX).toContain(loaderMarkup({ cls: 'ld on boot wait' }));
    // the boot loader comes before the game's root and its script
    expect(INDEX.indexOf('id="ld"')).toBeLessThan(INDEX.indexOf('id="app"'));
    expect(INDEX.indexOf('<style>')).toBeLessThan(INDEX.indexOf('</head>'));
    expect(loaderMarkup()).toMatch(/role="status" aria-live="polite"/);
    // the boot loader says "Loading" and nothing else
    const boot = INDEX.slice(INDEX.indexOf('<div id="ld"'), INDEX.indexOf('<div id="app"'));
    expect(boot.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).toBe('Loading');
  });
});

// ---- the two looks and the two backgrounds ---------------------------------------------------------------
describe('the loading screen looks: Mochi mint / sakura, the background black / colour', () => {
  const mint = cssVars(INLINE_CSS, ':root');
  const sakura = cssVars(INLINE_CSS, 'html[data-mochi="sakura"]');
  const mochiKeys = (o) => Object.keys(o).filter((k) => k.startsWith('mochi-')).sort();

  it('two looks, two backgrounds, mint on black by default', () => {
    expect(MOCHI_LOOKS).toEqual(['mint', 'sakura']);
    expect(LOADER_BGS).toEqual(['black', 'colour']);
    expect(LOADING_LOOK_DEFAULT).toEqual({ mochi: 'mint', bg: 'black' });
    expect(mint['ld-bg']).toBe('#050608');
  });

  it('the sakura look recolours every part the mint look colours (same shape, same hop: only colours)', () => {
    expect(mochiKeys(mint).length).toBeGreaterThanOrEqual(12);
    expect(mochiKeys(sakura)).toEqual(mochiKeys(mint));
    for (const k of mochiKeys(mint)) expect(sakura[k], k).not.toBe(mint[k]);
    // pink jelly, mint leaf
    for (const k of ['mochi-jelly-2', 'mochi-jelly-3', 'mochi-jelly-4']) {
      const { h, s } = hueSat(sakura[k]);
      expect(h >= 320 || h <= 15, `${k} ${sakura[k]} is pink (hue ${Math.round(h)})`).toBe(true);
      expect(s).toBeGreaterThan(0.4);
      expect(hueSat(mint[k]).h, `${k} mint`).toBeGreaterThan(100);
      expect(hueSat(mint[k]).h, `${k} mint`).toBeLessThan(170);
    }
    for (const k of ['mochi-sprig-2', 'mochi-sprig-3']) {
      const { h } = hueSat(sakura[k]);
      expect(h > 100 && h < 170, `${k} ${sakura[k]} is mint (hue ${Math.round(h)})`).toBe(true);
    }
    // the petal becomes a leaf: both grow from the same point, one shows per look
    expect(MOCHI_INNER).toContain('class="mochi-petal"');
    expect(MOCHI_INNER).toContain('class="mochi-leaf"');
    expect(MOCHI_INNER.indexOf('mochi-petal')).toBeGreaterThan(MOCHI_INNER.indexOf('<g transform="translate(76 25) scale(1.15)">'));
    expect(stripComments(INLINE_CSS)).toMatch(/\.mochi-leaf \{ display: none; \}/);
    expect(stripComments(INLINE_CSS)).toMatch(/html\[data-mochi="sakura"\] \.mochi-petal \{ display: none; \}/);
    expect(stripComments(INLINE_CSS)).toMatch(/html\[data-mochi="sakura"\] \.mochi-leaf \{ display: inline; \}/);
    // the hop, squash, blink and petal keyframes are the same for both looks (no look-specific animation)
    expect(stripComments(INLINE_CSS)).not.toMatch(/data-mochi[^{]*\{[^}]*animation/);
  });

  it('every look colour in the markup is a --mochi-* property whose fallback is the mint look', () => {
    const all = MOCHI_DEFS + MOCHI_INNER;
    const used = [...all.matchAll(/var\(--(mochi-[\w-]+),(#[0-9a-f]{6})\)/gi)];
    expect(used.length).toBeGreaterThanOrEqual(12);
    for (const [, name, fallback] of used) {
      expect(mint[name], name).toBeDefined();
      expect(fallback.toLowerCase(), name).toBe(mint[name].toLowerCase());
    }
    expect(new Set(used.map((u) => u[1])).size).toBe(mochiKeys(mint).filter((k) => k !== 'mochi-glow').length);
  });

  it('the colour background is the game\'s night navy with a very soft glow; Mochi and the text stay readable', () => {
    const colour = cssVars(INLINE_CSS, 'html[data-loader-bg="colour"]')['ld-bg'];
    expect(colour).toMatch(/#0b1630$/); // the navy (src/art: the card scenes' shade)
    for (const a of colour.matchAll(/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/g)) expect(Number(a[1]), 'a soft glow').toBeLessThanOrEqual(0.16);
    expect(stripComments(INLINE_CSS)).toMatch(/\.ld \{[^}]*background: var\(--ld-bg\)/);
    // the cut's panel and the corner chip follow the same background
    expect(stripComments(TX_CSS)).toMatch(/html\[data-loader-bg="colour"\] \.tx-cut \{[^}]*#0b1630/);
    expect(stripComments(TX_CSS)).toMatch(/html\[data-loader-bg="colour"\] \.ld-chip \{/);
    // "Loading" (#f3f6ff) and both jellies read on both backgrounds
    for (const bg of ['#050608', '#0b1630']) {
      expect(contrast('#f3f6ff', bg), `text on ${bg}`).toBeGreaterThanOrEqual(12);
      for (const look of [mint, sakura]) expect(contrast(look['mochi-jelly-3'], bg), `${look['mochi-jelly-3']} on ${bg}`).toBeGreaterThanOrEqual(5);
    }
  });

  it('the setting: Settings storage (profile.settings), mint + black by default, older saves get the defaults, nothing else changes', () => {
    expect(LOOK_SETTINGS).toEqual({ mochi: 'loadingMochi', bg: 'loadingBg' });
    expect(DEFAULT_SETTINGS.loadingMochi).toBe('mint');
    expect(DEFAULT_SETTINGS.loadingBg).toBe('black');
    expect(SAVE_VERSION).toBe(2); // additive: no save version bump
    const p = createProfile();
    expect(loadingLookOf(p.settings)).toEqual({ mochi: 'mint', bg: 'black' });
    const old = JSON.parse(JSON.stringify(p));
    delete old.settings.loadingMochi;
    delete old.settings.loadingBg;
    expect(migrateProfile(old).settings).toMatchObject({ loadingMochi: 'mint', loadingBg: 'black' });
    const picked = migrateProfile({ ...old, settings: { ...old.settings, loadingMochi: 'sakura', loadingBg: 'colour' } });
    expect(picked.settings).toMatchObject({ loadingMochi: 'sakura', loadingBg: 'colour' });
    expect(migrateProfile({ ...old, settings: { ...old.settings, loadingMochi: 'blue', loadingBg: 'white' } }).settings).toMatchObject({ loadingMochi: 'mint', loadingBg: 'black' });
    expect(loadingLookOf(picked.settings)).toEqual({ mochi: 'sakura', bg: 'colour' });
    for (const bad of [null, undefined, 'x', 7, { loadingMochi: 'pink', loadingBg: 'colour' }]) {
      const look = loadingLookOf(bad);
      expect(MOCHI_LOOKS).toContain(look.mochi);
      expect(LOADER_BGS).toContain(look.bg);
    }
    expect(loadingLookOf({ loadingMochi: 'pink', loadingBg: 'colour' })).toEqual({ mochi: 'mint', bg: 'colour' });
    // the Settings screen offers it in the Graphics section, in its own row style
    const set = read('src/ui/screens/settings.js');
    expect(set).toMatch(/row\('Loading screen'/);
    expect(set).toMatch(/segmented\(\['mint', 'sakura'\], look\.mochi, pick\('loadingMochi'\), \{ mint: 'Mint', sakura: 'Pink' \}, 'loadingMochi'\)/);
    expect(set).toMatch(/segmented\(\['black', 'colour'\], look\.bg, pick\('loadingBg'\), \{ black: 'Black', colour: 'Colour' \}, 'loadingBg'\)/);
    const graphics = set.slice(set.indexOf("'data-section': 'graphics'"), set.indexOf("h3.panel-title', 'Lighting'"));
    expect(graphics).toContain('loadingLookRow(s, redraw)');
    // the game never shows the name: "Mochi" lives in code and docs only (e2e/transitions.mjs reads the screens' text)
    const desc = /row\('Loading screen', '([^']*)'/.exec(set)[1];
    const named = [...set.matchAll(/named\(segmented\([^\n]*\), '([^']*)'\)/g)].map((m) => m[1]);
    expect(named).toEqual(['Slime colour', 'Background']);
    for (const t of [desc, ...named]) expect(t).not.toMatch(/mochi/i);
  });

  it('applyLoadingLook puts the look on <html> (data-mochi, data-loader-bg); no DOM, no harm', () => {
    const attrs = {};
    const doc = { documentElement: { getAttribute: (k) => attrs[k] ?? null, setAttribute: (k, v) => { attrs[k] = String(v); } } };
    expect(applyLoadingLook({ loadingMochi: 'sakura', loadingBg: 'colour' }, doc)).toEqual({ mochi: 'sakura', bg: 'colour' });
    expect(attrs).toEqual({ 'data-mochi': 'sakura', 'data-loader-bg': 'colour' });
    applyLoadingLook({}, doc);
    expect(attrs).toEqual({ 'data-mochi': 'mint', 'data-loader-bg': 'black' });
    expect(() => applyLoadingLook({ loadingMochi: 'sakura' }, null)).not.toThrow();
    expect(() => applyLoadingLook({ loadingMochi: 'sakura' }, { documentElement: { getAttribute() { throw new Error('x'); } } })).not.toThrow();
    // main.js keeps it in step with the save (a migration, an import, another tab's save)
    expect(read('src/main.js')).toMatch(/store\.on\('change', \(\) => applyLoadingLook\(store\.profile\.settings\)\)/);
  });
});

// ---- index.html's inline script: the saved look on <html> before the first paint --------------------------
describe('the boot loader reads the saved look before any module script', () => {
  const scripts = [...INDEX.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const code = scripts.find((c) => c.includes('data-mochi')) || '';
  /** Runs the inline script against a fake <html> and storage; returns the attributes it set. */
  const runBoot = (storage) => {
    const attrs = {};
    const documentElement = { setAttribute: (k, v) => { attrs[k] = v; } };
    new Function('localStorage', 'document', code)(storage, { documentElement });
    return attrs;
  };
  const stored = (settings) => {
    const p = createProfile();
    Object.assign(p.settings, settings);
    return saveText(p, 3, 'tab1');
  };
  const storageWith = (text) => ({ getItem: (k) => (k === SAVE_KEY ? text : null) });

  it('is tiny, comes before every module script and the boot loader, and reads the save key', () => {
    expect(code.length).toBeGreaterThan(0);
    expect(code.length).toBeLessThan(1400);
    const at = INDEX.indexOf(code);
    expect(at).toBeLessThan(INDEX.indexOf('<script type="module"'));
    expect(at).toBeLessThan(INDEX.indexOf('<style>'));
    expect(at).toBeLessThan(INDEX.indexOf('id="ld"'));
    expect(code).toContain(`'${SAVE_KEY}'`);
    expect(code).toContain(`"${LOOK_SETTINGS.mochi}"`);
    expect(code).toContain(`"${LOOK_SETTINGS.bg}"`);
    expect(code).toMatch(/try \{[\s\S]*localStorage\.getItem[\s\S]*\} catch/);
  });

  it('defaults: mint on black (nothing saved, an old save without the setting)', () => {
    expect(runBoot(storageWith(null))).toEqual({ 'data-mochi': 'mint', 'data-loader-bg': 'black' });
    const old = createProfile();
    delete old.settings.loadingMochi;
    delete old.settings.loadingBg;
    expect(runBoot(storageWith(saveText(old, 1)))).toEqual({ 'data-mochi': 'mint', 'data-loader-bg': 'black' });
    expect(runBoot(storageWith(stored({})))).toEqual({ 'data-mochi': 'mint', 'data-loader-bg': 'black' });
  });

  it('the saved choice, in every combination, from a real stored save', () => {
    for (const mochi of MOCHI_LOOKS) {
      for (const bg of LOADER_BGS) {
        expect(runBoot(storageWith(stored({ loadingMochi: mochi, loadingBg: bg }))), `${mochi} + ${bg}`).toEqual({ 'data-mochi': mochi, 'data-loader-bg': bg });
      }
    }
  });

  it('storage that fails or holds junk gives the defaults, never an error', () => {
    const throwing = { getItem() { throw new Error('SecurityError: storage blocked'); } };
    expect(runBoot(throwing)).toEqual({ 'data-mochi': 'mint', 'data-loader-bg': 'black' });
    expect(runBoot(undefined)).toEqual({ 'data-mochi': 'mint', 'data-loader-bg': 'black' }); // no localStorage at all
    expect(runBoot(storageWith('not json {"loadingMochi":"blue","loadingBg":"<b>"}'))).toEqual({ 'data-mochi': 'mint', 'data-loader-bg': 'black' });
    expect(runBoot(storageWith(12345))).toEqual({ 'data-mochi': 'mint', 'data-loader-bg': 'black' });
    // no <html> to write on: the CSS defaults (mint on black) stand
    expect(() => new Function('localStorage', 'document', code)(storageWith(stored({ loadingMochi: 'sakura' })), {})).not.toThrow();
  });
});

// ---- covers over toasts ---------------------------------------------------------------------------------
describe('a screen change\'s cover sits above every toast', () => {
  const z = (css, sel) => Number((stripComments(css).match(new RegExp(`${sel.replace(/[.[\]"=]/g, '\\$&')}\\s*\\{[^}]*?z-index:\\s*(\\d+)`)) || [])[1]);
  it('the cut, the chip and the loader are above the journal toast, toasts, social pop-ups and the update pill', () => {
    const cut = z(TX_CSS, '.tx-cut');
    const chip = z(TX_CSS, '.ld-chip');
    const loader = z(INLINE_CSS, '.ld');
    expect(cut).toBe(360);
    expect(chip).toBeGreaterThan(cut);
    expect(loader).toBeGreaterThan(chip);
    const toasts = [
      ['src/ui/styles/journal.css', '.jn-toast'], // the journal pill (was 9000: drawn on the black loader)
      ['src/ui/styles/base.css', '.toast-host'], // toasts + the achievement unlock toasts
      ['src/ui/styles/social.css', '.sc-toast-host'], // DM / friend / invite pop-ups
      ['src/ui/styles/update.css', '.upd-bar'], // "New version ready"
    ];
    for (const [file, sel] of toasts) {
      const v = z(read(file), sel);
      expect(Number.isFinite(v), `${sel} has a z-index (${file})`).toBe(true);
      expect(v, `${sel} (${file})`).toBeLessThan(cut);
    }
    // and while a cut or the boot is under way it lets taps through (the cut panel never catches them)
    expect(stripComments(read('src/ui/styles/journal.css'))).toMatch(/html\[data-tx="cut"\] \.jn-toast, html\[data-tx="boot"\] \.jn-toast \{ pointer-events: none; \}/);
  });
});
