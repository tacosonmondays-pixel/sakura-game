// Screen transitions (owner: "cleaner and animated menu transitions"). The router asks for one per
// screen change (src/ui/router.js); the kind comes from ./kind.js:
//   cut         a slanted black panel sweeps in from the right with a sakura + mint edge, the
//               screens swap under it (the full loader shows there once the load passes 150 ms),
//               then it sweeps out to the left while the new screen drifts in 14 px
//   slide       shared-axis slide: the old body fades out fast (100 ms) as it starts to move,
//               the new body moves the whole 280 ms and fades in from 90 ms, the top bar stays
//   slide-back  mirrored
//   crossfade   opacity only (the same screen with new params)
//   boot        the boot loader of index.html holds until the first screen is really drawn
// Input: the outgoing screen goes inert on the tap that starts the change (no double taps), the
// new one takes taps from its first frame; the cut panel never catches taps, the loader only
// while the load is still running. Reduced motion (system or in-game setting): slides become a
// 120 ms crossfade, the cut a fade through black; the 150 / 450 ms loader rule still applies.
// Without a DOM (node tests) every change is an instant swap (nullTx), as before.
import '../styles/transitions.css';
import { clear } from '../dom.js';
import { MOTION, readySignalFor } from './kind.js';
import {
  armLoader, armChip, releaseLoaderInput, setLoaderInfo, setLoaderProgress, loaderState, bootLoaderStart,
} from '../loading/loader.js';

export { setLoaderProgress };

const domOk = () => typeof document !== 'undefined' && typeof Element !== 'undefined'
  && typeof Element.prototype.animate === 'function' && !!document.body;

/** System "reduce motion" or the in-game setting (html[data-reduce-motion]). */
export function reducedMotion() {
  try {
    if (document.documentElement.hasAttribute('data-reduce-motion')) return true;
    return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const SKEW = 'skewX(-12deg)';
const EASE_CUT = 'cubic-bezier(0.55, 0, 0.25, 1)';
const EASE_OUT = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Resolves after `n` animation frames (or a timeout: a background tab gets no frames). */
export function frames(n = 2) {
  if (typeof requestAnimationFrame !== 'function') return Promise.resolve();
  return new Promise((resolve) => {
    let left = n;
    const t = setTimeout(resolve, 60 * n + 100);
    const step = () => {
      if (--left <= 0) {
        clearTimeout(t);
        resolve();
      } else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
const anim = (el, kf, o) => {
  try {
    return el.animate(kf, o);
  } catch {
    return null;
  }
};
const finished = (list, cap) => Promise.race([Promise.all(list.filter(Boolean).map((a) => a.finished.catch(() => {}))), sleep(cap)]);

/** The change in flight (until its reveal / slide-in is over). */
let active = null;
let seq = 0;
/** The last screen changes (e2e and debugging: window.__sakura.transitions.log). */
export const txLog = [];
function logTx(rec) {
  txLog.push(rec);
  if (txLog.length > 40) txLog.shift();
}

/** A no-DOM change: swap at once (keeps the router's node tests exactly as they were). */
function nullTx(kind) {
  return {
    kind,
    superseded: false,
    load: (p) => p,
    covered: Promise.resolve(),
    swap: (root) => clear(root),
    enter: () => {},
    supersede() {},
    done: Promise.resolve(),
  };
}

function baseTx(kind, info) {
  let resolveDone;
  const tx = {
    id: ++seq,
    kind,
    superseded: false,
    collecting: false,
    holds: [],
    info: {},
    rec: { id: seq, kind, from: info?.from || null, to: info?.to || null, t0: performance.now(), loader: false, chip: false, end: null },
    done: new Promise((r) => {
      resolveDone = r;
    }),
    finish() {
      if (tx.rec.end == null) tx.rec.end = performance.now();
      if (active === tx) {
        active = null;
        document.documentElement.removeAttribute('data-tx');
        // (a change that supersedes this one starts right after: only a real pause counts as settled)
        queueMicrotask(() => {
          if (!active) flushSettled();
        });
      }
      resolveDone();
    },
    supersede() {
      if (tx.superseded) return;
      tx.superseded = true;
      tx.rec.superseded = true;
      tx.stop?.();
      tx.finish();
    },
  };
  logTx(tx.rec);
  return tx;
}

/**
 * Starts a screen change. The router then: `mod = await tx.load(loader())`, `await tx.covered`,
 * runs the old screen's cleanup, `tx.swap(root, name)`, renders, `tx.enter(root)`.
 * @param {'boot'|'cut'|'slide'|'slide-back'|'crossfade'|'none'} kind
 * @param {HTMLElement} root
 * @param {{ from?: string|null, to?: string }} [info]
 */
export function beginScreenChange(kind, root, info = {}) {
  if (!domOk() || !root || typeof root.animate !== 'function') return nullTx(kind);
  const prev = active;
  // a change that still has the screen covered hands the cover on: this one is a cut (or the boot) too
  if (prev && prev.coverOn && !prev.revealing) kind = prev.kind === 'boot' ? 'boot' : 'cut';
  if (prev) prev.supersede();
  const tx = kind === 'cut' || kind === 'boot' ? coverTx(kind, root, prev, info) : slideTx(kind, root, info);
  active = tx;
  document.documentElement.dataset.tx = tx.kind;
  return tx;
}

// ---------------------------------------------------------------------------------------------
// cut / boot
// ---------------------------------------------------------------------------------------------
let panel = null;
function cutPanel() {
  if (panel?.isConnected) return panel;
  panel = document.createElement('div');
  panel.className = 'tx-cut';
  panel.setAttribute('aria-hidden', 'true');
  document.body.append(panel);
  return panel;
}
const stopPanel = () => panel?.getAnimations().forEach((a) => a.cancel());

function coverTx(kind, root, prev, info) {
  const tx = baseTx(kind, info);
  const R = reducedMotion();
  root.inert = true;
  // phase 1: the module download, in parallel with the cover
  const bootAt = kind === 'boot' ? bootLoaderStart() : null;
  const t1 = armLoader(kind === 'boot' ? { startAt: bootAt ?? undefined } : { bare: true });
  let t1End = null;
  tx.coverOn = kind === 'cut' || (kind === 'boot' && bootAt != null) || loaderState() !== 'idle';
  if (kind === 'cut') {
    const p = cutPanel();
    if (prev?.coverOn && !prev.revealing && prev.covered) tx.covered = prev.covered;
    else {
      stopPanel();
      p.classList.remove('covered');
      p.classList.add('on');
      const a = R
        ? anim(p, [{ opacity: 0, transform: `translateX(0) ${SKEW}` }, { opacity: 1, transform: `translateX(0) ${SKEW}` }], { duration: MOTION.reducedCutCover, easing: 'ease-out', fill: 'forwards' })
        : anim(p, [{ transform: `translateX(110%) ${SKEW}` }, { transform: `translateX(0) ${SKEW}` }], { duration: MOTION.cutCover, easing: EASE_CUT, fill: 'forwards' });
      // covered for sure from here on, even when the frames are slow and the cap (twice the
      // cover's length) ends the wait first (a busy phone, a background tab): the panel snaps to
      // covered, so the old screen never leaves before the black is up, and never lingers either
      tx.covered = (a ? finished([a], (R ? MOTION.reducedCutCover : MOTION.cutCover) * 2) : Promise.resolve()).then(() => {
        if (tx.superseded && active?.covered !== tx.covered) return;
        p.classList.add('covered');
        stopPanel();
      });
    }
  } else tx.covered = Promise.resolve();

  tx.load = (p) => Promise.resolve(p).then((mod) => {
    // a quick download never shows the loader during the cover (the hold after the swap
    // starts its own 150 ms); a slow one keeps it up straight through to the reveal
    if (kind !== 'boot' && !tx.superseded && loaderState() === 'armed') t1End = t1.end();
    return mod;
  });

  tx.swap = (r, name) => {
    clear(r);
    r.inert = false;
    tx.collecting = !tx.superseded;
    const sig = readySignal(name);
    if (sig) tx.holds.push(sig);
  };

  tx.enter = (r) => {
    // (a change superseded while its screen was rendering, e.g. by a navigate() from inside that
    // render, leaves the loader and the cover to the newer one: it must not arm anything itself)
    if (tx.superseded) return;
    run(r).catch((e) => {
      console.warn('[transitions] reveal failed', e);
      cleanupCover(r);
      tx.finish();
    });
  };

  async function run(r) {
    let ticket = t1End ? null : t1;
    if (tx.superseded) return;
    if (tx.holds.length) {
      ticket = armLoader(kind === 'cut' ? { bare: true, info: tx.info } : { info: tx.info });
      for (let n = -1; n !== tx.holds.length;) {
        n = tx.holds.length;
        await Promise.all(tx.holds);
        if (tx.superseded) return;
      }
    }
    tx.collecting = false;
    if (tx.superseded) return;
    releaseLoaderInput();
    const res = ticket ? await ticket.end() : await t1End;
    if (res?.shown) tx.rec.loader = true;
    if (tx.superseded) return;
    // the new screen has drawn a frame before anything uncovers it
    await frames(2);
    if (tx.superseded) return;
    tx.revealing = true;
    if (kind === 'cut' && panel) {
      const RR = reducedMotion();
      stopPanel();
      panel.classList.remove('covered');
      const a = RR
        ? anim(panel, [{ opacity: 1, transform: `translateX(0) ${SKEW}` }, { opacity: 0, transform: `translateX(0) ${SKEW}` }], { duration: MOTION.reducedCutReveal, easing: 'ease-in', fill: 'forwards' })
        : anim(panel, [{ transform: `translateX(0) ${SKEW}` }, { transform: `translateX(-110%) ${SKEW}` }], { duration: MOTION.cutReveal, easing: EASE_CUT, fill: 'forwards' });
      const drift = RR ? null : anim(r, [{ transform: `translateX(${MOTION.cutDrift}px)` }, { transform: 'none' }], { duration: MOTION.cutReveal + 40, easing: EASE_OUT });
      tx.stop = () => {
        a?.cancel();
        drift?.cancel();
        cleanupCover(r);
      };
      await finished([a, drift], 900);
      if (tx.superseded) return;
      drift?.cancel();
    }
    cleanupCover(r);
    tx.finish();
  }

  function cleanupCover() {
    tx.coverOn = false;
    if (active && active !== tx && active.coverOn) return; // the next change is using the panel
    stopPanel();
    panel?.classList.remove('on', 'covered');
  }
  return tx;
}

/** A screen's "I am drawn" event (lobby art decoded, the scene's first picture), with its cap. */
function readySignal(name) {
  const sig = name ? readySignalFor(name) : null;
  if (!sig) return null;
  return new Promise((resolve) => {
    const done = () => {
      window.removeEventListener(sig.event, done);
      clearTimeout(t);
      resolve();
    };
    window.addEventListener(sig.event, done);
    const t = setTimeout(done, sig.cap);
  });
}

// ---------------------------------------------------------------------------------------------
// slide / slide-back / crossfade
// ---------------------------------------------------------------------------------------------
/** The top bar of a screen built with components.screen(), and everything else (the body). */
function layersOf(container) {
  const scr = container.querySelector(':scope > .screen');
  const bar = scr?.querySelector(':scope > .topbar') || null;
  const body = [];
  for (const c of container.children) {
    if (c === scr && bar) for (const k of scr.children) { if (k !== bar) body.push(k); }
    else body.push(c);
  }
  return { bar, body };
}

/** The outgoing screen, moved out of #app for the length of its exit: no taps, no test ids, no canvases. */
function makeGhost(root) {
  const g = document.createElement('div');
  g.className = 'tx-ghost';
  g.setAttribute('aria-hidden', 'true');
  g.inert = true;
  while (root.firstChild) g.append(root.firstChild);
  for (const el of g.querySelectorAll('[data-testid]')) el.removeAttribute('data-testid');
  for (const el of g.querySelectorAll('[id]')) {
    // (ids of SVG paint servers stay: the ghost's own gradients would vanish without them)
    if (!el.closest('svg')) el.removeAttribute('id');
  }
  for (const c of g.querySelectorAll('canvas, video')) c.style.visibility = 'hidden';
  // after #app in the page (getElementById finds the new screen first), painted under it (z-index -1)
  root.after(g);
  return g;
}

function slideTx(kind, root, info) {
  const tx = baseTx(kind, info);
  root.inert = true;
  tx.covered = Promise.resolve();
  let ghost = null;
  const anims = [];

  tx.load = async (p) => {
    const t = armChip();
    try {
      return await p;
    } finally {
      const res = await t.end();
      if (res?.shown) tx.rec.chip = true;
    }
  };

  tx.swap = (r) => {
    ghost = makeGhost(r);
    r.inert = false;
  };

  tx.stop = () => {
    for (const a of anims) a?.cancel();
    ghost?.remove();
    ghost = null;
  };

  tx.enter = (r) => {
    if (tx.superseded) return tx.stop();
    const R = reducedMotion();
    const dir = kind === 'slide-back' ? -1 : 1;
    const shift = kind === 'crossfade' ? 0 : MOTION.slideShift * dir;
    const old = ghost ? layersOf(ghost) : { bar: null, body: [] };
    const neu = layersOf(r);
    const add = (el, kf, o) => {
      if (!el) return;
      anims.push(anim(el, kf, o));
    };
    if (R) {
      const T = MOTION.reducedFade;
      if (ghost) add(ghost, [{ opacity: 1 }, { opacity: 0 }], { duration: T, easing: 'ease-out', fill: 'forwards' });
      for (const el of [neu.bar, ...neu.body]) add(el, [{ opacity: 0 }, { opacity: 1 }], { duration: T, easing: 'ease-out', fill: 'backwards' });
    } else if (kind === 'crossfade') {
      const T = MOTION.crossfade;
      for (const el of old.body) add(el, [{ opacity: 1 }, { opacity: 0 }], { duration: T, easing: 'ease-out', fill: 'forwards' });
      if (old.bar) add(old.bar, [{ opacity: 1 }, { opacity: 0 }], neu.bar ? { duration: 60, delay: MOTION.barFade, fill: 'forwards' } : { duration: T, fill: 'forwards' });
      if (neu.bar) add(neu.bar, [{ opacity: 0 }, { opacity: 1 }], { duration: MOTION.barFade, easing: 'ease-out', fill: 'backwards' });
      for (const el of neu.body) add(el, [{ opacity: 0 }, { opacity: 1 }], { duration: T, easing: 'ease-out', fill: 'backwards' });
    } else {
      for (const el of old.body) {
        add(el, [{ opacity: 1 }, { opacity: 0 }], { duration: MOTION.slideFadeOut, easing: EASE_IN, fill: 'forwards' });
        add(el, [{ transform: 'none' }, { transform: `translateX(${-shift}px)` }], { duration: MOTION.slide, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' });
      }
      // the top bar never dips: the new one fades in over the old, which goes once it is covered
      if (old.bar) add(old.bar, [{ opacity: 1 }, { opacity: 0 }], neu.bar ? { duration: 80, delay: MOTION.barFade, fill: 'forwards' } : { duration: MOTION.slideFadeOut, easing: EASE_IN, fill: 'forwards' });
      if (neu.bar) add(neu.bar, [{ opacity: 0 }, { opacity: 1 }], { duration: MOTION.barFade, easing: 'ease-out', fill: 'backwards' });
      for (const el of neu.body) {
        add(el, [{ transform: `translateX(${shift}px)` }, { transform: 'none' }], { duration: MOTION.slide, easing: EASE_OUT, fill: 'backwards' });
        add(el, [{ opacity: 0 }, { opacity: 1 }], { duration: MOTION.slideFadeIn, delay: MOTION.slideFadeInDelay, easing: 'ease-out', fill: 'backwards' });
      }
    }
    finished(anims, 700).then(() => {
      if (tx.superseded) return;
      tx.stop();
      anims.length = 0;
      tx.finish();
    });
  };
  return tx;
}

// ---------------------------------------------------------------------------------------------
// holding the loader
// ---------------------------------------------------------------------------------------------
/**
 * Keeps the full loader up until `promise` settles: the battle until its first frame is drawn
 * (also on a restart or a co-op rebuild in place), the title until its preload is done.
 * Called while a cut or the boot is swapping screens, it holds that change's reveal (and gives the
 * loader its kicker / destination / progress). Called any other time it puts the black loader over
 * whatever is on screen (visible after 150 ms, or at once with `immediate`: a known long build
 * follows), always with the 450 ms minimum.
 * @param {Promise<any>} promise
 * @param {{ kicker?: string, title?: string, tip?: string, progress?: number|null, cap?: number, immediate?: boolean }} [o]
 * @returns {{ revealed: Promise<void>, painted: Promise<void>, release: () => void, attached: boolean }}
 *   revealed: the screen is uncovered (the loader gone); painted: the loader has had a frame to
 *   draw itself (await it before a long synchronous build); release(): stop holding (destroyed)
 */
export function holdLoader(promise, { kicker, title, tip, progress, cap = 30000, immediate = false } = {}) {
  if (!domOk()) return { revealed: Promise.resolve(), painted: Promise.resolve(), release() {}, attached: false };
  let release = () => {};
  const released = new Promise((r) => {
    release = r;
  });
  const info = Object.fromEntries(Object.entries({ kicker, title, tip, progress }).filter(([, v]) => v !== undefined));
  const p = Promise.race([Promise.resolve(promise).catch(() => {}), released, sleep(cap)]);
  const tx = active;
  if (tx && tx.collecting && !tx.superseded) {
    tx.holds.push(p);
    Object.assign(tx.info, info);
    if (loaderState() !== 'idle') setLoaderInfo(info);
    return { revealed: tx.done, painted: frames(2), release, attached: true };
  }
  const ticket = armLoader({ immediate, info });
  const revealed = p.then(() => {
    releaseLoaderInput();
    return ticket.end();
  }).then(() => {});
  return { revealed, painted: frames(2), release, attached: false };
}

/** Whether a screen change is still animating or holding (e2e, debugging). */
export function transitionBusy() {
  return !!active;
}

let settledWaiters = [];
function flushSettled() {
  const list = settledWaiters;
  settledWaiters = [];
  for (const fn of list) fn();
}
/** Resolves once no screen change is running (the first: the boot loader is gone). */
export function whenSettled() {
  if (!active) return Promise.resolve();
  return new Promise((r) => settledWaiters.push(r));
}

// ---------------------------------------------------------------------------------------------
// battle → results: a slanted band carrying VICTORY / DEFEAT sweeps across, then the sheet rises
// ---------------------------------------------------------------------------------------------
/**
 * @param {HTMLElement} host the results overlay (the band sits over its sheet, never catching taps)
 * @param {string} text  'VICTORY' | 'DEFEAT' | …
 * @param {{ tone?: 'win'|'lose' }} [o]
 * @returns {number} ms until the band is gone (0: none, reduced motion)
 */
export function resultBand(host, text, { tone = 'win' } = {}) {
  if (!domOk() || !host || reducedMotion()) return 0;
  host.querySelector(':scope > .tx-band-clip')?.remove();
  // (a clipping frame: the sweeping band never makes the scrollable overlay scroll)
  const clip = document.createElement('div');
  clip.className = 'tx-band-clip';
  clip.setAttribute('aria-hidden', 'true');
  const band = document.createElement('div');
  band.className = `tx-band ${tone}`;
  const word = document.createElement('b');
  word.textContent = text;
  band.append(word);
  clip.append(band);
  host.prepend(clip);
  const IN = MOTION.band;
  const HOLD = 380;
  anim(band, [{ transform: `translateX(110%) ${SKEW}` }, { transform: `translateX(0) ${SKEW}` }], { duration: IN, easing: EASE_OUT, fill: 'backwards' });
  anim(word, [{ transform: 'translateX(60px) skewX(12deg)', opacity: 0 }, { transform: 'skewX(12deg)', opacity: 1 }], { duration: IN, delay: 60, easing: EASE_OUT, fill: 'backwards' });
  const out = anim(band, [{ transform: `translateX(0) ${SKEW}` }, { transform: `translateX(-110%) ${SKEW}` }], { duration: IN, delay: IN + HOLD, easing: EASE_IN, fill: 'forwards' });
  const total = IN * 2 + HOLD;
  (out ? finished([out], total + 400) : sleep(total)).then(() => clip.remove());
  return total;
}
