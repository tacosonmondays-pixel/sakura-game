// Which transition a screen change gets (pure: tests/ui/transitions.test.js). The motion language:
//   boot       the first screen of the page: the boot loader is already up, it only holds and fades
//   cut        big moves (into or out of a battle or a story scene, out of the title): a slanted
//              black wipe covers, the screen swaps under it (the full loader shows there when the
//              load passes 150 ms), then it wipes away
//   slide      menu → submenu: shared-axis, out then in: the old body fades out in place (80 ms),
//              then the new one slides in from the right (200 ms) over a short ink wipe (280 ms in all,
//              UI v2, owner Oct 27: "add animated transitions"); the top bar stays, its title crossfades
//   slide-back the same, mirrored and quicker (60 + 160 = 220 ms): the back arrow, the back gesture,
//              Home, a parent screen
//   crossfade  the same screen with new params (the next girl, a co-op room of the hub, a tab)
// Reduced motion turns the slides into a fade through (opacity only) and the cut into a fade
// through black.
import { menuAncestors, sameScreen } from '../nav.js';

export const TRANSITION_KINDS = Object.freeze(['boot', 'cut', 'slide', 'slide-back', 'crossfade', 'none']);

/** Screens that always come and go behind the cut (heavy, full-screen, or the title). */
export const CUT_SCREENS = new Set(['battle', 'scene', 'title']);

/** Screens drawn without the common top bar: a slide into one fades the old bar out with the body. */
export const BARLESS_SCREENS = new Set(['lobby', ...CUT_SCREENS]);

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

/**
 * What the loading screen shows for a cut, from the route alone. It only ever says "Loading" (owner:
 * "it saying loading is enough": no destination, no tips); a screen that really counts its load
 * (the battle: its girls' and enemies' models) starts the progress line at 0 from the loader's
 * first frame, and the battle then moves it while it mounts.
 * @returns {{ progress: number }|null}
 */
export function loaderInfoFor(name) {
  return name === 'battle' ? { progress: 0 } : null;
}

/**
 * Motion timings (ms). Every screen-level animation is within 120–320 ms in all (CONTRACTS §12):
 * a slide forward is its 80 ms exit plus its 200 ms entrance (280 ms, the ink wipe's length), a slide
 * back 60 + 160 (220 ms), a crossfade 70 + 150 ms. Paths the player takes many times stay at or under
 * 280 ms forward and 220 ms back (UI v2 motion layer, Oct 27); the new screen takes taps from its
 * first frame.
 */
export const MOTION = Object.freeze({
  slide: 200,
  slideOut: 80,
  slideFadeIn: 150,
  slideBack: 160,
  slideBackOut: 60,
  slideBackFadeIn: 120,
  slideShift: 24,
  wipe: 280,
  wipeBack: 220,
  titleOut: 80,
  titleIn: 110,
  crossfadeOut: 70,
  cutCover: 200,
  cutReveal: 260,
  cutDrift: 14,
  crossfade: 150,
  reducedOut: 60,
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
