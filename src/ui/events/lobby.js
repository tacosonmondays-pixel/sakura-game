// The lobby's limited-event pieces (EVENT_SPEC §3.12 Lobby): the bottom-left EVENT card for the
// featured event, and its painted backdrop behind her stand while it runs (eventLobbyBackdrop). The old overlay of a
// lantern string and two pumpkin stickers is gone (owner, Oct 24: "get rid of the pumpkins and lanterns ... theyre
// ugly"); the painted backdrop carries the theme.
import { h } from '../dom.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { UNIT_MAP } from '../../data/units.js';
import { lobbyArtUrl } from '../../data/lobbyArt.js';
import { portraitHTML } from '../../art/portraits.js';
import { featuredEvent, eventWindow, markEventLogin, settleEvents } from '../../systems/events.js';
import { countdownChip } from '../kit.js';
import { eventNow } from './clock.js';

/**
 * [ui-m5] An event's phase as the countdown chip (UI_DIRECTION §5.9): "Opens in 2d 4h", "Ends in 6d 4h",
 * "Exchange 3d 2h" (the time left to trade), or a plain "Ended". It counts on the event clock (clock.js). The end and
 * the exchange are deadlines (red in the last day); an opening loses nothing (never red). At zero it says "Open now",
 * "Ended" or "Closed" alone, and `onDone` lets the screen draw the next phase.
 * @param {{ testid?: string|null, cls?: string, onDone?: Function|null }} [o]
 */
export function eventPhaseChip(ev, phase, now = eventNow(), { testid = null, cls = '', onDone = null } = {}) {
  const w = eventWindow(ev);
  const at = phase === 'upcoming' ? w.startAt : phase === 'active' ? w.endAt : phase === 'exchange' ? w.exchangeEndAt : null;
  if (at == null) return h(`span.ev-phase.ph-${phase}`, { 'data-testid': testid }, 'Ended');
  const label = phase === 'upcoming' ? 'Opens in' : phase === 'active' ? 'Ends in' : 'Exchange';
  const doneText = phase === 'upcoming' ? 'Open now' : phase === 'active' ? 'Ended' : 'Closed';
  return countdownChip(at - now, { label, testid, cls, now: eventNow, urgent: phase !== 'upcoming', doneText, onDone });
}

/** The day's event visit from the lobby (a player who just cleared the unlock stage gets today's gift). */
export function lobbyEventVisit() {
  const a = settleEvents(store.profile, eventNow());
  const b = markEventLogin(store.profile, eventNow());
  if (a.letters.length || a.settled.length || b.letters.length) store.commit('event');
}

/**
 * The EVENT card for the featured limited event, or null (the weekly card shows instead).
 * @param {{ onPhaseEnd?: Function|null }} [o] onPhaseEnd: its chip reached zero (the lobby redraws the card)
 */
export function eventLobbyCard({ onPhaseEnd = null } = {}) {
  const f = featuredEvent(store.profile, eventNow());
  if (!f) return null;
  const { ev, phase } = f;
  const host = UNIT_MAP[(ev.theme.hosts || []).find((id) => UNIT_MAP[id])];
  return h('button.lb-eventcard.lb-ev-limited', {
    onclick: () => navigate('event', { id: ev.id }),
    'data-testid': 'event-card',
    title: `${ev.name} · ${ev.subtitle}`,
    style: { '--ev-color': ev.theme.color, '--ev-accent': ev.theme.accent },
  },
  h('div.lb-ev-clip',
    h('div.lb-ev-art', h('img', { src: lobbyArtUrl(`thumbs/${ev.theme.fallbackArt || 'academy.webp'}`), alt: '', loading: 'lazy', decoding: 'async', draggable: false })),
    host ? h('div.lb-ev-girl', { html: portraitHTML(host, 'cutS') }) : null,
    h('div.lb-ev-shade'),
  ),
  h('span.lb-ev-kicker', 'EVENT!'),
  h('div.lb-ev-text', h('b', ev.name), h('div.lb-ev-sub', eventPhaseChip(ev, phase, eventNow(), { cls: 's', testid: 'event-card-time', onDone: onPhaseEnd }))));
}

/**
 * The event's painted backdrop behind every girl's stand while it runs (its theme's lobbyBackdrop), or null. It has
 * its own lighting, so the stand's day / sunset / night tint is not laid over it.
 * @returns {{ file: string, thumb: string }|null} paths under public/art/lobby/
 */
export function eventLobbyBackdrop() {
  const f = featuredEvent(store.profile, eventNow());
  const file = f?.phase === 'active' ? f.ev.theme?.lobbyBackdrop : null;
  return file ? { file, thumb: `thumbs/${file}` } : null;
}
