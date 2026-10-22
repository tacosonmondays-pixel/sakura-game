// The loaders (owner: "loading screens, like black with a cute something like slime in the corner
// and loading"; then "just black or colored ... it saying loading is enough"). Three of them, all
// behind the same gate (./gate.js: visible only after 150 ms, then at least 450 ms):
//   · the full loader #ld: black (or the night-navy "colour" background, Settings → Loading
//     screen), "Loading" + Mochi bottom-right and nothing else, plus a thin progress line along the
//     bottom only while a load really counts something (the battle's models, the title's preload).
//     index.html draws it from the first byte (the boot loader); this module adopts that element
//     and reuses it for every later load.
//   · the corner chip: a small dark slanted pill with a mini Mochi, while a menu screen's code is
//     still downloading (the old screen stays on show). It sits in the bottom-LEFT corner (on the
//     lobby above the EVENT card), so it never covers a primary button or the lobby's bottom-right
//     Campaign cluster (UI_DIRECTION §5.10 E7; styles/transitions.css; e2e/transitions.mjs).
//   · the inline Mochi: inside a panel that is fetching (chat, clan, profile, co-op).
// Showing is done by CSS: arming a loader sets an animation-delay of 150 ms on its opacity, which
// the compositor runs even while the main thread is busy, so it appears on time during a long
// model parse and keeps hopping through it.
import { createGate, clampProgress, SHOW_AFTER_MS, MIN_SHOWN_MS } from './gate.js';
import { mochiMarkup, ensureMochiDefs, LABEL_HTML } from './mochi.js';

const hasDom = () => typeof document !== 'undefined' && !!document.body;
const now = () => performance.now();
const onDone = (el, ms, fn) => {
  // the exit animation's end, or its duration plus a little (a hidden tab never fires it)
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    el.removeEventListener('animationend', end);
    fn();
  };
  const end = (e) => {
    if (e.target === el) go();
  };
  el.addEventListener('animationend', end);
  setTimeout(go, ms + 80);
};

// ---------------------------------------------------------------------------------------------
// The full loader
// ---------------------------------------------------------------------------------------------
let ld = null;
let style = { bare: false, boot: false };
let exitDone = null;

/** The loader element (index.html's boot loader, or a fresh one). */
function loaderEl() {
  if (ld?.isConnected) return ld;
  ld = document.getElementById('ld');
  if (!ld) {
    ensureMochiDefs();
    const t = document.createElement('template');
    t.innerHTML = loaderMarkup();
    ld = t.content.firstElementChild;
    document.body.append(ld);
  }
  return ld;
}

/** The loader's markup (index.html carries the same, with the boot classes): "Loading" + Mochi, the progress line. */
export function loaderMarkup({ cls = 'ld' } = {}) {
  return `<div id="ld" class="${cls}" role="status" aria-live="polite" aria-label="Loading">`
    + `<div class="ld-corner">${LABEL_HTML('Loading')}${mochiMarkup({ cls: 'pop' })}</div>`
    + '<div class="ld-bar"><i></i></div></div>';
}

const fullGate = createGate({
  onArm: () => {},
  onCancel: () => dropLoader(style.boot ? 'fade' : 'now'),
  onHide: () => dropLoader('fade'),
});

/** Hides the full loader: 'now' (it was never visible) or with its exit fade. */
function dropLoader(how) {
  const el = ld;
  if (!el) return Promise.resolve();
  el.classList.remove('wait');
  const finish = () => {
    el.classList.remove('on', 'out', 'boot', 'bare', 'stay');
    el.style.removeProperty('--ld-delay');
    setProgressOn(el, null);
    exitDone = null;
  };
  if (how === 'now' || !el.classList.contains('on')) {
    finish();
    return Promise.resolve();
  }
  el.classList.remove('stay');
  el.classList.add('out');
  return (exitDone = new Promise((resolve) => onDone(el, style.boot ? 240 : 140, () => {
    // (armed again while fading out: armLoader() took it over)
    if (el.classList.contains('out')) finish();
    resolve();
  })));
}

/**
 * Arms the full loader for a load that is starting.
 * @param {{ bare?: boolean, immediate?: boolean, startAt?: number, info?: object }} [o]
 *   bare: no black of its own (it sits over the cut panel); immediate: visible at once (a known
 *   long build follows: a battle rebuilding in place); startAt: when it was armed (the boot loader)
 * @returns the gate ticket (end() when the load is done)
 */
export function armLoader({ bare = false, immediate = false, startAt, info = null } = {}) {
  const el = loaderEl();
  const t = now();
  const fading = el.classList.contains('out');
  const busy = fullGate.state !== 'idle';
  if (fading) {
    // caught on its way out: it stays as it is (visible), no fade back in, no pop
    el.classList.remove('out');
    el.classList.add('stay');
    if (info) setInfo(el, info);
  } else if (!busy) {
    style = { bare, boot: el.classList.contains('boot') && startAt != null };
    if (!style.boot) {
      el.style.setProperty('--ld-delay', immediate ? '0ms' : `${SHOW_AFTER_MS}ms`);
      // restart the entrance + loops from rest (a reflow only when it is still on: a hidden loader's
      // animations start fresh on their own, and a forced layout of the page would cost a frame)
      const was = el.classList.contains('on');
      el.classList.remove('on', 'boot', 'stay');
      el.classList.toggle('bare', bare);
      if (was) void el.offsetWidth;
      el.classList.add('on');
      setInfo(el, { progress: null, ...(info || {}) });
    } else if (info) setInfo(el, info);
  } else if (info) setInfo(el, info);
  el.classList.add('wait');
  const at = fading ? t - SHOW_AFTER_MS : immediate && !busy ? t - SHOW_AFTER_MS : startAt;
  return fullGate.begin(at != null ? { startAt: at } : {});
}

/** The load is done: taps go through to the screen at once, even while the loader waits out its minimum. */
export function releaseLoaderInput() {
  ld?.classList.remove('wait');
}

/** 'idle' | 'armed' | 'shown' */
export function loaderState() {
  return fullGate.state;
}

/** What the loader shows besides "Loading" + Mochi: only the progress line ({ progress: 0..1 | null }). */
export function setLoaderInfo(info = {}) {
  if (!hasDom()) return;
  setInfo(loaderEl(), info);
}

/** The progress line: 0..1, or null to hide it (unknown progress never shows a fake bar). */
export function setLoaderProgress(p) {
  if (!hasDom() || !ld) return;
  setProgressOn(ld, p);
}

function setProgressOn(el, p) {
  const bar = el.querySelector('.ld-bar');
  if (!bar) return;
  const v = clampProgress(p);
  bar.classList.toggle('known', v != null);
  if (v != null) {
    // never backwards within one load
    const cur = Number(bar.style.getPropertyValue('--p')) || 0;
    bar.style.setProperty('--p', String(bar.classList.contains('known') && v < cur ? cur : v));
  } else bar.style.setProperty('--p', '0');
}

function setInfo(el, { progress } = {}) {
  if (progress !== undefined) setProgressOn(el, progress);
}

/**
 * The boot loader of index.html: since when it has been armed (its CSS entrance started with the
 * first style pass), so the gate counts its 150 ms / 450 ms from there.
 * @returns {number|null} null when there is no boot loader up
 */
export function bootLoaderStart() {
  if (!hasDom()) return null;
  const el = document.getElementById('ld');
  if (!el || !el.classList.contains('boot') || !el.classList.contains('on')) return null;
  ld = el;
  try {
    const a = el.querySelector('.ld-corner')?.getAnimations?.()[0];
    if (a && typeof a.startTime === 'number') return a.startTime;
  } catch {
    /* no Web Animations */
  }
  return 0;
}

// ---------------------------------------------------------------------------------------------
// The corner chip (a menu screen's code still downloading)
// ---------------------------------------------------------------------------------------------
let chip = null;
function chipEl() {
  if (chip?.isConnected) return chip;
  ensureMochiDefs();
  const t = document.createElement('template');
  t.innerHTML = `<div class="ld-chip" role="status" aria-live="polite" data-testid="loading-chip">${LABEL_HTML('Loading')}${mochiMarkup()}</div>`;
  chip = t.content.firstElementChild;
  document.body.append(chip);
  return chip;
}
const chipGate = createGate({
  onArm: () => {
    const el = chipEl();
    // (a reflow to restart it only when it is still on: never a forced layout on a plain tap)
    if (el.classList.contains('on')) {
      el.classList.remove('on', 'out');
      void el.offsetWidth;
    }
    el.classList.add('on');
  },
  onCancel: () => chip?.classList.remove('on', 'out'),
  onHide: () => new Promise((resolve) => {
    const el = chip;
    if (!el) return resolve();
    el.classList.add('out');
    onDone(el, 120, () => {
      if (el.classList.contains('out')) el.classList.remove('on', 'out');
      resolve();
    });
  }),
});

/** Arms the corner chip for a load (gate ticket: end() it when the load is done). */
export function armChip() {
  return chipGate.begin();
}

// ---------------------------------------------------------------------------------------------
// The inline Mochi (inside a panel that is fetching)
// ---------------------------------------------------------------------------------------------
/**
 * A small Mochi + "Loading" for a panel. It turns visible only after 150 ms (CSS), so a fast fetch
 * never shows it.
 * @param {string} [label] e.g. 'Connecting', 'Loading the boss'
 * @param {{ dark?: boolean, testid?: string }} [o] dark: on a dark background
 * @returns {HTMLElement}
 */
export function inlineLoader(label = 'Loading', { dark = false, testid = null } = {}) {
  ensureMochiDefs();
  const t = document.createElement('template');
  t.innerHTML = `<div class="ld-inline${dark ? ' dark' : ''}" role="status" aria-live="polite">${LABEL_HTML(label)}${mochiMarkup({ cls: dark ? '' : 'on-light' })}</div>`;
  const el = t.content.firstElementChild;
  if (testid) el.dataset.testid = testid;
  el.dataset.since = String(now());
  return el;
}

/** A mini Mochi alone (a waiting card: "Waiting for your ally…"), always hopping. */
export function miniMochi({ dark = false, size = 40 } = {}) {
  ensureMochiDefs();
  const t = document.createElement('template');
  t.innerHTML = `<div class="ld-mini${dark ? ' dark' : ''}" aria-hidden="true">${mochiMarkup({ cls: dark ? '' : 'on-light', size })}</div>`;
  return t.content.firstElementChild;
}

/**
 * Keeps an inline Mochi on screen for its minimum time when the content that replaces it arrives
 * early: `node` (the placeholder holding `loader`, an inlineLoader()) sits in `host`; when the
 * screen's code swaps it out while Mochi has been visible for less than 450 ms, the placeholder is
 * put back on top (the new content waits invisible underneath) until the time is up, then the
 * content fades in. Returns a stop() (nothing to undo once the placeholder is gone).
 */
export function holdInline(host, node, loader = node) {
  if (!hasDom() || typeof MutationObserver === 'undefined' || !host) return () => {};
  const since = Number(loader.dataset?.since) || now();
  let stopped = false;
  const mo = new MutationObserver(() => {
    if (stopped || node.parentNode === host) return;
    mo.disconnect();
    stopped = true;
    const t = now();
    const visibleAt = since + SHOW_AFTER_MS;
    if (t < visibleAt || t >= visibleAt + MIN_SHOWN_MS || !host.isConnected) return;
    // it was on show: hold it a little longer over the (hidden) new content
    const pos = getComputedStyle(host).position === 'static';
    if (pos) host.style.position = 'relative';
    host.classList.add('ld-holding');
    node.classList.add('ld-held');
    host.append(node);
    setTimeout(() => {
      node.remove();
      host.classList.remove('ld-holding');
      if (pos) host.style.removeProperty('position');
      for (const c of host.children) {
        try {
          c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
        } catch {
          /* no Web Animations: it just appears */
        }
      }
    }, visibleAt + MIN_SHOWN_MS - t);
  });
  mo.observe(host, { childList: true });
  return () => {
    stopped = true;
    mo.disconnect();
  };
}

/** Test / teardown hook: forget the loader elements and gates. */
export function _resetLoaders() {
  fullGate.reset();
  chipGate.reset();
  ld = null;
  chip = null;
  exitDone = null;
}

export { SHOW_AFTER_MS, MIN_SHOWN_MS };
