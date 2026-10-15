// The live-effect governor (src/ui/honorFx.js liveHonors; docs/specs/ACHIEVEMENTS.md §2.4): never more than `budget`
// specials live, the highest priority first, none under either Reduce Motion source, none while a modal is open,
// and an off-screen ribbon loses `.live`. The repo has no DOM library, so this runs on a small fake DOM with a stubbed
// IntersectionObserver.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { liveHonors, reducedMotion } from '../../src/ui/honorFx.js';

class FakeClassList {
  constructor() { this.set = new Set(); }
  add(c) { this.set.add(c); }
  remove(c) { this.set.delete(c); }
  contains(c) { return this.set.has(c); }
  toggle(c, on) { if (on) this.set.add(c); else this.set.delete(c); return on; }
}
const ribbon = (prio = 0) => ({ classList: new FakeClassList(), dataset: prio ? { prio: String(prio) } : {}, isConnected: true });

let ios;
let attrs;
let overlays;
let listeners;
const saved = {};
beforeEach(() => {
  ios = [];
  attrs = new Set();
  overlays = [];
  listeners = {};
  for (const k of ['document', 'IntersectionObserver', 'MutationObserver', 'matchMedia']) saved[k] = globalThis[k];
  globalThis.document = {
    hidden: false,
    body: {},
    documentElement: { hasAttribute: (n) => attrs.has(n) },
    querySelectorAll: () => overlays,
    addEventListener: (t, f) => { listeners[t] = f; },
    removeEventListener: (t) => { delete listeners[t]; },
  };
  globalThis.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; this.els = new Set(); ios.push(this); }
    observe(e) { this.els.add(e); }
    unobserve(e) { this.els.delete(e); }
    disconnect() { this.els.clear(); }
    show(els, on = true) { this.cb(els.map((target) => ({ target, isIntersecting: on }))); }
  };
  globalThis.MutationObserver = class { observe() {} disconnect() {} };
  globalThis.matchMedia = () => ({ matches: false });
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) globalThis[k] = v;
});

const rootWith = (els) => ({ querySelectorAll: () => els, contains: () => false });
const live = (els) => els.filter((e) => e.classList.contains('live'));

describe('liveHonors', () => {
  it('never more than the budget, highest priority first', () => {
    const els = [ribbon(1), ribbon(5), ribbon(3), ribbon(0), ribbon(4)];
    const stop = liveHonors(rootWith(els), { budget: 3 });
    ios[0].show(els);
    expect(live(els)).toHaveLength(3);
    expect(live(els).map((e) => +e.dataset.prio).sort()).toEqual([3, 4, 5]);
    stop();
    expect(live(els)).toHaveLength(0);
  });

  it('only visible ribbons; off-screen ones lose .live and the next one takes the slot', () => {
    const els = [ribbon(9), ribbon(2), ribbon(1)];
    liveHonors(rootWith(els), { budget: 2 });
    ios[0].show(els);
    expect(live(els)).toEqual([els[0], els[1]]);
    ios[0].show([els[0]], false);
    expect(live(els)).toEqual([els[1], els[2]]);
  });

  it('none under the in-game Reduce Motion setting or the system preference', () => {
    const els = [ribbon(), ribbon()];
    attrs.add('data-reduce-motion');
    liveHonors(rootWith(els), { budget: 3 });
    ios[0].show(els);
    expect(live(els)).toHaveLength(0);
    attrs.clear();
    globalThis.matchMedia = () => ({ matches: true });
    expect(reducedMotion()).toBe(true);
    ios[0].show(els);
    expect(live(els)).toHaveLength(0);
  });

  it('none while a modal or overlay outside the root is open, none while the page is hidden', () => {
    const els = [ribbon(), ribbon()];
    liveHonors(rootWith(els), { budget: 4 });
    ios[0].show(els);
    expect(live(els)).toHaveLength(2);
    overlays = [{ contains: () => false }];
    ios[0].show(els);
    expect(live(els)).toHaveLength(0);
    overlays = [];
    document.hidden = true;
    listeners.visibilitychange();
    expect(live(els)).toHaveLength(0);
    document.hidden = false;
    listeners.visibilitychange();
    expect(live(els)).toHaveLength(2);
  });

  it('the overlay that holds the root itself (a fanfare or detail) does not stop it', () => {
    const els = [ribbon()];
    const root = rootWith(els);
    overlays = [{ contains: (x) => x === root }];
    liveHonors(root, { budget: 1 });
    ios[0].show(els);
    expect(live(els)).toHaveLength(1);
  });
});
