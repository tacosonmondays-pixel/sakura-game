// Screen transitions + the loading slime (owner: "cleaner and animated menu transitions, loading
// screens, like black with a cute something like slime in the corner and loading"). The pure parts
// run here: which transition a screen change gets, the loader's 150 ms / 450 ms rule, the router's
// hook into the transitions, the styles (transform / opacity only, 120–320 ms), the slime markup
// and the loading tips. The browser side is e2e/transitions.mjs.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { transitionFor, CUT_SCREENS, READY_SIGNALS, readySignalFor, MOTION } from '../../src/ui/transitions/kind.js';
import { createGate, clampProgress, SHOW_AFTER_MS, MIN_SHOWN_MS } from '../../src/ui/loading/gate.js';
import { SLIME_DEFS, SLIME_INNER, slimeMarkup, SLIME_SIZES } from '../../src/ui/loading/slime.js';
import { loaderMarkup } from '../../src/ui/loading/loader.js';
import { LOADING_TIPS, BOOT_TIP, pickTip } from '../../src/data/loadingTips.js';

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
    expect(INLINE_CSS).toMatch(/@keyframes sl-hop/);
    expect(Object.keys(all).length).toBeGreaterThanOrEqual(14);
  });

  it('every keyframe animates transform or opacity only (the compositor runs them)', () => {
    for (const [name, body] of Object.entries(all)) {
      const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]).filter((p) => p !== 'animation-timing-function');
      expect(props.length, name).toBeGreaterThan(0);
      for (const p of props) expect(['transform', 'opacity'], `@keyframes ${name}: ${p}`).toContain(p);
    }
  });

  it('every duration is 120–320 ms, except the slime\'s own loops (1.2 s hop, 2.4 s blink)', () => {
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

  it('reduced motion stills the slime and covers the chip, the inline slime and the band', () => {
    expect(INLINE_CSS).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.sl, \.sl \*, \.ld-dots i \{ animation: none !important; \} \}/);
    expect(INLINE_CSS).toMatch(/html\[data-reduce-motion\] \.sl, html\[data-reduce-motion\] \.sl \*/);
    for (const sel of ['.ld-chip.on', '.ld-inline', '.bt-result-overlay.bt-banded']) {
      expect(TX_CSS.split('@media (prefers-reduced-motion: reduce)')[1], sel).toContain(sel);
      expect(TX_CSS, sel).toContain(`html[data-reduce-motion] ${sel}`);
    }
  });

  it('the old screen-enter animation and the painted boot splash are gone', () => {
    const base = read('src/ui/styles/base.css');
    expect(base).not.toMatch(/screen-enter|\.boot\b/);
    expect(base).toMatch(/--t-screen: 280ms/);
    expect(read('src/ui/router.js')).not.toMatch(/screen-enter/);
    expect(INDEX).not.toMatch(/class="boot"/);
  });
});

// ---- the slime --------------------------------------------------------------------------------------
describe('the loading slime', () => {
  it('is plain inline SVG: no script, no external reference, one shared defs block', () => {
    const all = SLIME_DEFS + slimeMarkup();
    expect(all).not.toMatch(/<script|on\w+=|javascript:|https?:|xlink:href|<image|<foreignObject/i);
    for (const ref of all.matchAll(/(?:href|url\()\s*=?\s*"?#([\w-]+)/g)) expect(ref[1]).toMatch(/^ldsl-/);
    expect(SLIME_DEFS.match(/<defs>/g)).toHaveLength(1);
    expect(slimeMarkup()).not.toMatch(/<defs>/);
    for (const id of ['ldsl-g', 'ldsl-core', 'ldsl-iris', 'ldsl-petal', 'ldsl-eye']) expect(SLIME_DEFS).toContain(`id="${id}"`);
  });

  it('every moving part is its own HTML layer (the compositor animates it), never an SVG child', () => {
    for (const cls of ['sl-shadow', 'sl-hop', 'sl-squash', 'sl-body', 'sl-eyes', 'sl-mouth-s', 'sl-mouth-o', 'sl-petal']) {
      expect(SLIME_INNER, cls).toMatch(new RegExp(`<div class="(sl-layer )?${cls}"`));
    }
    expect(SLIME_INNER).not.toMatch(/<animate|<set /);
  });

  it('is our own mint slime with a sakura petal (not a blue drop with dot eyes)', () => {
    expect(SLIME_DEFS).toContain('#76da9c'); // mint jelly (the Green Slime's family colours)
    expect(SLIME_DEFS).toContain('#ff79a7'); // the petal
    expect(SLIME_INNER).toContain('sl-petal');
    expect(SLIME_INNER).toContain('#ff86ad'); // blush
    expect(SLIME_DEFS).toMatch(/<ellipse rx="8\.6" ry="10\.6"/); // big eyes with highlights, not dots
    expect(SLIME_DEFS.match(/<circle [^>]*fill="#fff"/g)).toHaveLength(2);
  });

  it('comes in the four sizes; its markup takes a size', () => {
    expect(SLIME_SIZES).toEqual({ phone: 64, desktop: 80, chip: 34, inline: 40 });
    for (const s of Object.values(SLIME_SIZES)) expect(slimeMarkup({ size: s })).toContain(`--s:${s}px`);
    expect(slimeMarkup({ cls: 'on-light' })).toMatch(/^<div class="sl on-light" aria-hidden="true">/);
  });

  it('index.html draws the same slime and loader before any script (the boot loader)', () => {
    expect(INDEX).toContain(SLIME_DEFS);
    expect(INDEX).toContain(loaderMarkup({ tip: BOOT_TIP, cls: 'ld on boot wait' }));
    // the boot loader comes before the game's root and its script
    expect(INDEX.indexOf('id="ld"')).toBeLessThan(INDEX.indexOf('id="app"'));
    expect(INDEX.indexOf('<style>')).toBeLessThan(INDEX.indexOf('</head>'));
    expect(loaderMarkup()).toMatch(/role="status" aria-live="polite"/);
  });
});

// ---- tips ---------------------------------------------------------------------------------------------
describe('loading tips', () => {
  const BANNED = /\b(date|dating|kiss|crush|flirt|romance|sexy|bikini|swimsuit|waifu|kill|blood|die|dead)\b/i;
  it('ten or more, one line each (≤ 80 characters), unique, wholesome', () => {
    expect(LOADING_TIPS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(LOADING_TIPS).size).toBe(LOADING_TIPS.length);
    for (const t of LOADING_TIPS) {
      expect(t.length, t).toBeLessThanOrEqual(80);
      expect(t, t).toMatch(/^[A-Z].*[.!]$/);
      expect(t.match(BANNED)?.[0] ?? null, t).toBeNull();
    }
  });

  it('the boot loader\'s tip is one of them; a seed always picks the same tip', () => {
    expect(LOADING_TIPS).toContain(BOOT_TIP);
    expect(INDEX).toContain(BOOT_TIP.replace(/'/g, "'"));
    expect(pickTip('1-1')).toBe(pickTip('1-1'));
    expect(LOADING_TIPS).toContain(pickTip(12345));
    const seen = new Set(Array.from({ length: 60 }, (_, i) => pickTip(`stage-${i}`)));
    expect(seen.size).toBeGreaterThan(5);
  });
});
