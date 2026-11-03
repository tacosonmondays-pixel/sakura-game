// Journal unlock toast (owner: story; STORY_SPEC §3.5): a tappable pill with Hikari's face, "Hikari has a new
// lesson ♡ — <title>" (or "2 new lessons"), shown for 4 s; a tap opens the journal on that lesson. Its own host,
// so components.toast stays untouched. While a modal, sheet or any other layer is over the page the pill is held
// (pillHold.js: hidden, no taps, its clock stopped), so it never sits on that layer's top row and takes its taps.
import '../styles/journal.css';
import { h } from '../components.js';
import { navigate, currentRoute } from '../router.js';
import { PILL_HOLD_SELECTOR, pillClock } from './pillHold.js';
import { portraitHTML } from '../../art/portraits.js';
import { UNIT_MAP } from '../../data/units.js';
import { LESSON_MAP, JOURNAL_TEXT } from '../../data/story/lessons.js';
import { resolveText } from '../../data/story/tokens.js';

export const TOAST_MS = 4000;

/** The pill's line for a batch of newly unlocked lessons. */
export function journalToastText(ids) {
  if (ids.length === 1) return resolveText(JOURNAL_TEXT.toastOne(resolveText(LESSON_MAP[ids[0]]?.title || '')));
  return resolveText(JOURNAL_TEXT.toastMany(ids.length));
}

/** Screens the pill is dropped on instead of following the player there (the lesson stays unlocked, its Journal dot
 * stays): a held pill that would come back there, and a showing pill whose player moves there. */
const DROP_ON = new Set(['battle', 'title', 'scene', 'journal']);

/** How long the last layer must stay closed before a held pill comes back, so a modal that closes and the next one
 * that opens a moment later (close, an await, then the rewards modal) never flashes the pill between them. About a
 * modal's own 160 ms fade-out, so the pill still comes back as the modal leaves. */
export const RELEASE_GRACE_MS = 200;

/**
 * Show the pill. `ids` = newly unlocked lesson ids (the first one opens on tap); `text` overrides the line.
 * Held while anything layers over the page (PILL_HOLD_SELECTOR); it shows the rest of its time once that closes.
 * @returns {HTMLElement}
 */
export function showJournalToast({ ids = [], text = null, ms = TOAST_MS } = {}) {
  document.querySelector('.jn-toast')?.remove();
  const line = text || journalToastText(ids);
  const hikari = UNIT_MAP.hikari;
  const clock = pillClock(ms, Date.now());
  let timer = null;
  let releaseTimer = null;
  let watch = null;
  const stop = () => {
    clearTimeout(timer);
    clearTimeout(releaseTimer);
    releaseTimer = null;
    watch?.disconnect();
    watch = null;
  };
  const pill = h('button.jn-toast', {
    type: 'button', 'data-testid': 'journal-toast', 'data-lessons': ids.join(','), 'aria-live': 'polite',
    onclick: () => {
      stop();
      pill.remove();
      navigate('journal', ids[0] ? { id: ids[0] } : {});
    },
  },
  h('span.jn-toast-face', { html: portraitHTML(hikari, 'thumb', { alt: '', eager: true }) }),
  h('span.jn-toast-text', line));
  const fadeOut = () => {
    stop();
    pill.classList.add('out');
    setTimeout(() => pill.remove(), 320);
  };
  // hold or let go as layers open and close (a modal, a sheet's .closing, the rotate reminder's [hidden])
  const gone = () => !pill.isConnected || pill.classList.contains('out');
  const drop = () => {
    stop();
    pill.remove();
  };
  // the last layer stayed closed for RELEASE_GRACE_MS: show the rest of the pill's time (or drop it, see DROP_ON)
  const release = () => {
    releaseTimer = null;
    if (gone()) return stop();
    if (document.querySelector(PILL_HOLD_SELECTOR)) return; // the next layer opened in the grace: stay held
    if (DROP_ON.has(currentRoute().name)) return drop();
    pill.classList.remove('held');
    pill.style.animation = 'none'; // back with its way in, not just switched on
    void pill.offsetWidth;
    pill.style.animation = '';
    timer = setTimeout(fadeOut, clock.release(Date.now()));
  };
  const sync = () => {
    if (gone()) return stop();
    if (DROP_ON.has(currentRoute().name)) return drop(); // never follows the player into a battle or the title
    if (document.querySelector(PILL_HOLD_SELECTOR)) {
      clearTimeout(releaseTimer);
      releaseTimer = null;
      if (pill.classList.contains('held')) return;
      clearTimeout(timer);
      clock.hold(Date.now());
      pill.classList.add('held');
      return;
    }
    if (pill.classList.contains('held') && !releaseTimer) releaseTimer = setTimeout(release, RELEASE_GRACE_MS);
  };
  if (document.querySelector(PILL_HOLD_SELECTOR)) {
    clock.hold(Date.now());
    pill.classList.add('held');
  } else timer = setTimeout(fadeOut, ms);
  document.body.appendChild(pill);
  if (typeof MutationObserver === 'function') {
    // (the layers are children of <body>; their .closing / [hidden] flips are attribute changes)
    watch = new MutationObserver(sync);
    watch.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  }
  return pill;
}
