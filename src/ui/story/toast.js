// Journal unlock toast (owner: story; STORY_SPEC §3.5): a tappable pill with Hikari's face, "Hikari has a new
// lesson ♡ — <title>" (or "2 new lessons"), shown for 4 s; a tap opens the journal on that lesson. Its own host,
// so components.toast stays untouched.
import '../styles/journal.css';
import { h } from '../components.js';
import { navigate } from '../router.js';
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

/**
 * Show the pill. `ids` = newly unlocked lesson ids (the first one opens on tap); `text` overrides the line.
 * @returns {HTMLElement}
 */
export function showJournalToast({ ids = [], text = null, ms = TOAST_MS } = {}) {
  document.querySelector('.jn-toast')?.remove();
  const line = text || journalToastText(ids);
  const hikari = UNIT_MAP.hikari;
  let timer = null;
  const pill = h('button.jn-toast', {
    type: 'button', 'data-testid': 'journal-toast', 'aria-live': 'polite',
    onclick: () => {
      clearTimeout(timer);
      pill.remove();
      navigate('journal', ids[0] ? { id: ids[0] } : {});
    },
  },
  h('span.jn-toast-face', { html: portraitHTML(hikari, 'thumb', { alt: '', eager: true }) }),
  h('span.jn-toast-text', line));
  document.body.appendChild(pill);
  timer = setTimeout(() => {
    pill.classList.add('out');
    setTimeout(() => pill.remove(), 320);
  }, ms);
  return pill;
}
