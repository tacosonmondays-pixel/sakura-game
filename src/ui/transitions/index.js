// Screen transitions (owner: "cleaner and animated menu transitions"). The router asks for one per
// screen change (src/ui/router.js); the kind comes from ./kind.js:
//   cut         a slanted black (or night-navy: Settings → Loading screen) panel sweeps in from the
//               right with a sakura + mint edge, the screens swap under it (the full loader shows
//               there once the cover lasts 150 ms),
//               then it sweeps out to the left while the new screen drifts in 14 px
//   slide       shared axis, out then in, all in place (no copy of the old screen): the old body
//               fades out as it starts to move (80 ms), the screens swap, the new body slides in
//               from the right (200 ms) while a short slanted ink wipe sweeps across behind the
//               screens (280 ms; UI v2 motion layer, owner Oct 27). The top bar stays put; only its
//               title crossfades. A screen that brings its own entrance (data-mo-own: the home)
//               only fades in (120 ms) and runs its pieces itself (src/ui/motion.js)
//   slide-back  mirrored and quicker: out 60, in 160, the wipe the other way (220 ms in all)
//   crossfade   opacity only, out then in (the same screen with new params)
//   boot        the boot loader of index.html holds until the first screen is really drawn
// Input: the outgoing screen goes inert on the tap that starts the change (no double taps), the
// new one takes taps from its first frame; the cut panel never catches taps, the loader only
// while the load is still running. Reduced motion (system or in-game setting): slides become a
// fade through (opacity only), the cut a fade through black; the 150 / 450 ms loader rule still
// applies. Without a DOM (node tests) every change is an instant swap (nullTx), as before.
import '../styles/transitions.css';
import { clear } from '../dom.js';
import { MOTION, readySignalFor, loaderInfoFor, BARLESS_SCREENS } from './kind.js';
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
/**
 * Resolves in a task of its own. An animation's `finished` resolves inside the frame that ends it;
 * rendering the next screen right there would put the render and that frame's style, layout and
 * paint into one long task, so the swap waits for the next task.
 */
export function nextTask() {
  if (typeof MessageChannel !== 'function') return new Promise((r) => setTimeout(r, 0));
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => {
      ch.port1.close();
      resolve();
    };
    ch.port2.postMessage(0);
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
        document.documentElement.removeAttribute('data-reveal');
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
 * Starts a screen change. The router then: `mod = await tx.load(loader())`, `await tx.covered`
 * (a cut: the screen is black; a slide: the old body has faded out in place), runs the old
 * screen's cleanup, `tx.swap(root, name)`, renders, `tx.enter(root)`.
 * @param {'boot'|'cut'|'slide'|'slide-back'|'crossfade'|'none'} kind
 * @param {HTMLElement} root
 * @param {{ from?: string|null, to?: string, params?: object }} [info]
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
  // a load that counts (the battle): its progress line from the loader's first frame
  const dest = loaderInfoFor(info?.to) || {};
  // ONE loader ticket per change, from the moment the screen is black (the boot: from the first
  // paint) until the reveal: a slow download, a long render and a held reveal all count towards the
  // same 150 ms, so the cover never sits there without Mochi, and Mochi never blinks
  let ticket = null;
  if (kind === 'boot') {
    const bootAt = bootLoaderStart();
    ticket = armLoader({ startAt: bootAt ?? undefined, info: dest });
    tx.coverOn = bootAt != null || loaderState() !== 'idle';
    tx.coverDone = Promise.resolve();
  } else {
    tx.coverOn = true;
    const p = cutPanel();
    if (prev?.coverOn && !prev.revealing && prev.coverDone) tx.coverDone = prev.coverDone;
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
      const done = (a ? finished([a], (R ? MOTION.reducedCutCover : MOTION.cutCover) * 2) : Promise.resolve()).then(() => {
        if (tx.superseded && active?.coverDone !== done) return;
        p.classList.add('covered');
        stopPanel();
      });
      tx.coverDone = done;
    }
  }
  tx.covered = tx.coverDone.then(() => {
    if (kind !== 'cut') return undefined;
    if (!tx.superseded) ticket = armLoader({ bare: true, info: dest });
    // one frame draws the armed loader before the swap: its CSS entrance (the 150 ms delay, run by
    // the compositor) starts with that frame, so a long render right after cannot hold it back and
    // the gate's clock is Mochi's own clock (no shorter showing than the 450 ms it counts)
    return frames(1).then(nextTask);
  });

  tx.load = (p) => p;

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
      ticket?.end();
      cleanupCover(r);
      tx.finish();
    });
  };

  async function run(r) {
    if (tx.superseded) return;
    for (let n = -1; n !== tx.holds.length;) {
      n = tx.holds.length;
      await Promise.all(tx.holds);
      if (tx.superseded) return;
    }
    tx.collecting = false;
    releaseLoaderInput();
    // a loader on show serves its minimum; then the new screen draws two frames still under the
    // loader (a slow first frame, e.g. a shader compile, shows Mochi, never a bare cover) …
    if (ticket) await ticket.served();
    if (tx.superseded) return;
    await frames(2);
    if (tx.superseded) return;
    if (ticket) await ticket.served(); // (one that turned visible meanwhile serves its minimum too)
    if (tx.superseded) return;
    // … and only then the loader leaves, in the same frame as the panel starts to move
    tx.revealing = true;
    // (the screen's own entrance, waiting at its first frame under the cover, plays from here: motion.css)
    document.documentElement.setAttribute('data-reveal', '');
    if (ticket?.visible) tx.rec.loader = true;
    const gone = ticket ? ticket.end() : Promise.resolve();
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
    } else await gone; // the boot: the loader's own fade is the reveal
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
/**
 * The top bar of a screen built with components.screen() (and its title text), and everything else
 * (the body): the few layers a slide moves. Nothing is copied or moved in the DOM.
 */
function layersOf(container) {
  const scr = container.querySelector(':scope > .screen');
  const bar = scr?.querySelector(':scope > .topbar') || null;
  const title = bar?.querySelector(':scope > .topbar-title') || null;
  const body = [];
  for (const c of container.children) {
    if (c === scr && bar) for (const k of scr.children) { if (k !== bar) body.push(k); }
    else body.push(c);
  }
  return { bar, title, body };
}

/**
 * The screens' own entrance animations (panels rising, cards popping in turn) jump to their end
 * when a slide brings the screen in: the slide is the one motion, no second wave after it. Run at
 * the start of the frame that first draws the screen, so they never show a first step.
 */
const ENTRANCES = new Set(['panel-in', 'ma-rise', 'ma-pop', 'mb-pop', 'mb-fade-in', 'ma-from-left', 'ma-from-right', 'ma-from-top', 'ma-from-bottom', 'sa-card-in', 'ol-msg-in', 'fade-in']);
function quietEntrances(r) {
  let list = [];
  try {
    list = r.getAnimations({ subtree: true });
  } catch {
    return;
  }
  for (const a of list) {
    if (typeof CSSAnimation === 'undefined' || !(a instanceof CSSAnimation) || !ENTRANCES.has(a.animationName)) continue;
    try {
      a.finish();
    } catch {
      /* an infinite one: not an entrance */
    }
  }
}

/** Ends animations on a change that is handed on mid-way, keeping what is on screen (the next one starts from there). */
function settleAnims(list) {
  for (const a of list) {
    if (!a) continue;
    try {
      if (a.playState !== 'finished') a.commitStyles();
    } catch {
      /* the element left the page */
    }
    a.cancel();
  }
  list.length = 0;
}

// ---------------------------------------------------------------------------------------------
// the ink wipe: a short slanted ink band that sweeps across BEHIND the screens (z-index -1 under
// #app) during a slide, seen through the old screen as it fades and in the gap before the new one
// is in; it never covers a control and never takes a tap
// ---------------------------------------------------------------------------------------------
let wipe = null;
function wipeBand() {
  if (wipe?.isConnected) return wipe;
  wipe = document.createElement('div');
  wipe.className = 'tx-wipe';
  wipe.setAttribute('aria-hidden', 'true');
  document.body.append(wipe);
  return wipe;
}
/** Sweeps the band: forward from the right edge to past the left one, back the other way. */
function runWipe(dir, duration) {
  const w = wipeBand();
  w.getAnimations().forEach((a) => a.cancel());
  w.classList.add('on');
  const right = `translateX(110vw) ${SKEW}`;
  const left = `translateX(-75vw) ${SKEW}`;
  const a = anim(w, [{ transform: dir > 0 ? right : left }, { transform: dir > 0 ? left : right }], { duration, easing: 'cubic-bezier(0.45, 0, 0.25, 1)' });
  const off = () => {
    if (!w.getAnimations().some((x) => x.playState === 'running')) w.classList.remove('on');
  };
  if (a) a.finished.then(off, off);
  else off();
}
/**
 * Ends the band with its change: on a busy frame clock it can still be a few frames short of the
 * edge when the new screen is fully in, and by then it is behind that opaque screen, so it simply
 * stops there (nothing is left running once a change has settled).
 */
function endWipe() {
  if (!wipe) return;
  wipe.getAnimations().forEach((a) => a.cancel());
  wipe.classList.remove('on');
}

function slideTx(kind, root, info) {
  const tx = baseTx(kind, info);
  root.inert = true;
  const R = reducedMotion();
  const dir = kind === 'slide-back' ? -1 : 1;
  const shift = kind === 'crossfade' || R ? 0 : MOTION.slideShift * dir;
  const back = kind === 'slide-back';
  const anims = [];
  const add = (el, kf, o) => {
    if (el) anims.push(anim(el, kf, o));
  };
  let hadBar = false;
  let loaded = () => {};
  const loadedP = new Promise((r) => {
    loaded = r;
  });

  // the code download: the corner chip after 150 ms. The screen goes on the moment its code is
  // here; the chip (fixed, never catching taps) serves its own 450 ms over the new screen
  tx.load = (p) => {
    const t = armChip();
    const done = () => {
      if (t.visible) tx.rec.chip = true;
      t.end();
      loaded();
    };
    return Promise.resolve(p).then((m) => {
      done();
      return m;
    }, (e) => {
      done();
      throw e;
    });
  };

  // out: the old body fades out where it is (no copy, no move in the DOM: only its few layers'
  // opacity / transform animate, on the compositor); its cleanup runs once it is invisible
  tx.covered = loadedP.then(async () => {
    if (tx.superseded) return;
    // the wipe starts with the out phase (once the screen's code is here): as long as the change itself
    if (!R && kind !== 'crossfade') runWipe(dir, back ? MOTION.wipeBack : MOTION.wipe);
    const L = layersOf(root);
    hadBar = !!L.bar;
    // into a screen without the top bar (the lobby): the bar leaves with the body
    const dropBar = !!L.bar && BARLESS_SCREENS.has(info?.to);
    const T = R ? MOTION.reducedOut : kind === 'crossfade' ? MOTION.crossfadeOut : back ? MOTION.slideBackOut : MOTION.slideOut;
    // (to-only keyframes: each layer fades from what it shows now, e.g. after a change handed on)
    const out = shift ? { opacity: 0, transform: `translateX(${Math.round(-shift * 0.6)}px)` } : { opacity: 0 };
    for (const el of dropBar ? [L.bar, ...L.body] : L.body) add(el, [out], { duration: T, easing: EASE_IN, fill: 'forwards' });
    if (L.title && !dropBar) add(L.title, [{ opacity: 0 }], { duration: Math.min(T, MOTION.titleOut), easing: EASE_IN, fill: 'forwards' });
    await finished(anims, T * 3 + 120);
    await nextTask();
  });

  tx.swap = (r) => {
    // (the old layers and their animations go with the old DOM)
    anims.length = 0;
    clear(r);
    r.inert = false;
  };

  // a newer change takes over mid-way: what is on screen stays as it is, and it goes on from there
  tx.stop = () => settleAnims(anims);

  // in: the new body slides in from the side (fading in fast), the bar stays and its title fades in
  tx.enter = (r) => {
    if (tx.superseded) return;
    // (in the frame that draws the new screen, where its styles are worked out anyway: asking for
    // its animations in the render's own task would force that work early and make one long task)
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => quietEntrances(r));
    const L = layersOf(r);
    const T = R ? MOTION.reducedFade : kind === 'crossfade' ? MOTION.crossfade : back ? MOTION.slideBack : MOTION.slide;
    const fadeIn = R || kind === 'crossfade' ? T : back ? MOTION.slideBackFadeIn : MOTION.slideFadeIn;
    for (const el of L.body) {
      // a screen with its own entrance (the home: its wallpaper, girl and pieces come in by themselves) only fades in
      if (el.dataset?.moOwn != null) {
        add(el, [{ opacity: 0, offset: 0 }], { duration: Math.min(fadeIn, MOTION.reducedFade), easing: 'ease-out' });
        continue;
      }
      if (shift) add(el, [{ transform: `translateX(${shift}px)` }, { transform: 'none' }], { duration: T, easing: EASE_OUT });
      add(el, [{ opacity: 0, offset: 0 }], { duration: fadeIn, easing: 'ease-out' });
    }
    if (L.bar && !hadBar) add(L.bar, [{ opacity: 0, offset: 0 }], { duration: fadeIn, easing: 'ease-out' }); // a bar that was not there before
    else if (L.title) add(L.title, [{ opacity: 0, offset: 0 }], { duration: R ? T : MOTION.titleIn, easing: 'ease-out' });
    finished(anims, T + 400).then(() => {
      if (tx.superseded) return;
      for (const a of anims) a?.cancel();
      anims.length = 0;
      endWipe();
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
 * loader its progress line, when the load counts something). Called any other time it puts the loader over
 * whatever is on screen (visible after 150 ms, or at once with `immediate`: a known long build
 * follows), always with the 450 ms minimum.
 * @param {Promise<any>} promise
 * @param {{ progress?: number|null, cap?: number, immediate?: boolean }} [o] progress: 0..1 when the
 *   load counts something real (the line stays hidden otherwise: never a fake bar)
 * @returns {{ revealed: Promise<void>, painted: Promise<void>, release: () => void, attached: boolean }}
 *   revealed: the screen is uncovered (the loader gone); painted: the loader has had a frame to
 *   draw itself (await it before a long synchronous build); release(): stop holding (destroyed)
 */
export function holdLoader(promise, { progress, cap = 30000, immediate = false } = {}) {
  if (!domOk()) return { revealed: Promise.resolve(), painted: Promise.resolve(), release() {}, attached: false };
  let release = () => {};
  const released = new Promise((r) => {
    release = r;
  });
  const info = progress !== undefined ? { progress } : {};
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
 * The band starts once the results' own synchronous work (the sheet's build and first layout) has
 * had its frames, so it never stalls behind them; the sheet rises when the band's exit has ended.
 * @param {HTMLElement} host the results overlay (the band sits over its sheet, never catching taps)
 * @param {string} text  'VICTORY' | 'DEFEAT' | …
 * @param {{ tone?: 'win'|'lose' }} [o]
 * @returns {Promise<void>|null} resolves once the band has passed (null: no band, reduced motion)
 */
export function resultBand(host, text, { tone = 'win' } = {}) {
  if (!domOk() || !host || reducedMotion()) return null;
  host.querySelector(':scope > .tx-band-clip')?.remove();
  const IN = MOTION.band;
  const HOLD = 380;
  const total = IN * 2 + HOLD;
  return frames(2).then(() => {
    if (!host.isConnected || host.hidden) return undefined;
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
    anim(band, [{ transform: `translateX(110%) ${SKEW}` }, { transform: `translateX(0) ${SKEW}` }], { duration: IN, easing: EASE_OUT, fill: 'backwards' });
    anim(word, [{ transform: 'translateX(60px) skewX(12deg)', opacity: 0 }, { transform: 'skewX(12deg)', opacity: 1 }], { duration: IN, delay: 60, easing: EASE_OUT, fill: 'backwards' });
    const out = anim(band, [{ transform: `translateX(0) ${SKEW}` }, { transform: `translateX(-110%) ${SKEW}` }], { duration: IN, delay: IN + HOLD, easing: EASE_IN, fill: 'forwards' });
    return (out ? finished([out], total + 600) : sleep(total)).then(() => clip.remove());
  });
}
