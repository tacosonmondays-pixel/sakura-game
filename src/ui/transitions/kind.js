// Which transition a screen change gets (pure: tests/ui/transitions.test.js). The motion language:
//   boot       the first screen of the page: the boot loader is already up, it only holds and fades
//   cut        big moves (into or out of a battle or a story scene, out of the title): a slanted
//              black wipe covers, the screen swaps under it (the full loader shows there when the
//              load passes 150 ms), then it wipes away
//   slide      menu → submenu: shared-axis slide, the top bar stays put
//   slide-back the same, mirrored: the back arrow, the back gesture, Home, a parent screen
//   crossfade  the same screen with new params (the next girl, a co-op room of the hub, a tab)
// Reduced motion turns the slides into crossfades and the cut into a fade through black.
import { menuAncestors, sameScreen } from '../nav.js';

export const TRANSITION_KINDS = Object.freeze(['boot', 'cut', 'slide', 'slide-back', 'crossfade', 'none']);

/** Screens that always come and go behind the cut (heavy, full-screen, or the title). */
export const CUT_SCREENS = new Set(['battle', 'scene', 'title']);

/**
 * @param {{name: string, params?: object}|null} from  the screen on show now (null: nothing yet)
 * @param {{name: string, params?: object}|null} to    the screen being opened
 * @param {{ dir?: number, first?: boolean }} [o] dir < 0: a step back through the history (or the
 *   back arrow); first: the first screen of the page
 * @returns {'boot'|'cut'|'slide'|'slide-back'|'crossfade'|'none'}
 */
export function transitionFor(from, to, { dir = 0, first = false } = {}) {
  if (first || !from?.name) return 'boot';
  if (!to?.name) return 'none';
  if (CUT_SCREENS.has(from.name) || CUT_SCREENS.has(to.name)) return 'cut';
  if (from.name === to.name || sameScreen(from, to)) return 'crossfade';
  if (dir < 0) return 'slide-back';
  if (menuAncestors(from.name, from.params || {}).includes(to.name)) return 'slide-back';
  return 'slide';
}

/**
 * What holds a screen's reveal behind the cut / boot loader until it is really drawn: an event the
 * screen fires once its art is up, with a cap so a slow network never keeps the loader forever.
 * (The battle holds it itself through holdLoader(), the title with its preload.)
 */
export const READY_SIGNALS = Object.freeze({
  lobby: Object.freeze({ event: 'lobby-stage-ready', cap: 2500 }),
  scene: Object.freeze({ event: 'story-stage-ready', cap: 2500 }),
});

/** @returns {{ event: string, cap: number }|null} */
export function readySignalFor(name) {
  return READY_SIGNALS[name] || null;
}

/** Motion timings (ms). Every animated duration is within 120–320 ms (CONTRACTS §12). */
export const MOTION = Object.freeze({
  slide: 280,
  slideFadeOut: 100,
  slideFadeInDelay: 90,
  slideFadeIn: 190,
  barFade: 140,
  slideShift: 24,
  cutCover: 200,
  cutReveal: 260,
  cutDrift: 14,
  crossfade: 160,
  reducedFade: 120,
  reducedCutCover: 140,
  reducedCutReveal: 160,
  loaderIn: 160,
  loaderOut: 140,
  bootOut: 240,
  chipIn: 160,
  chipOut: 120,
  modalIn: 220,
  modalOut: 160,
  band: 260,
});
