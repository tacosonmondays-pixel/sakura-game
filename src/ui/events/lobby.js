// The lobby's limited-event pieces (EVENT_SPEC §3.12 Lobby): the bottom-left EVENT card for the
// featured event, and a light decor overlay (a string of lanterns, two pumpkins) while it runs.
import { h } from '../dom.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { UNIT_MAP } from '../../data/units.js';
import { lobbyArtUrl } from '../../data/lobbyArt.js';
import { portraitHTML } from '../../art/portraits.js';
import { featuredEvent, phaseLabel, markEventLogin, settleEvents } from '../../systems/events.js';
import { eventNow } from './clock.js';
import { lanternString } from './art.js';

/** The day's event visit from the lobby (a player who just cleared the unlock stage gets today's gift). */
export function lobbyEventVisit() {
  const a = settleEvents(store.profile, eventNow());
  const b = markEventLogin(store.profile, eventNow());
  if (a.letters.length || a.settled.length || b.letters.length) store.commit('event');
}

/** The EVENT card for the featured limited event, or null (the weekly card shows instead). */
export function eventLobbyCard() {
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
  h('div.lb-ev-text', h('b', ev.name), h('small', phaseLabel(ev, phase, eventNow()))));
}

/** Lanterns across the top and two pumpkins at the bottom corners, while an event with decor runs. */
export function eventLobbyDecor() {
  const f = featuredEvent(store.profile, eventNow());
  if (!f || f.phase !== 'active' || f.ev.key !== 'halloween') return null;
  return h('div.lb-ev-decor', { 'aria-hidden': 'true', 'data-testid': 'event-decor' },
    h('div.lb-ev-lanterns', { html: lanternString(9, 900) }),
    h('div.lb-ev-pumpkin.l', { html: PUMPKIN_SVG }),
    h('div.lb-ev-pumpkin.r', { html: PUMPKIN_SVG }));
}

const PUMPKIN_SVG = '<svg viewBox="0 0 80 64" xmlns="http://www.w3.org/2000/svg">'
  + '<ellipse cx="40" cy="60" rx="30" ry="4" fill="#000" opacity="0.18"/>'
  + '<ellipse cx="26" cy="38" rx="16" ry="20" fill="#e5761c"/><ellipse cx="54" cy="38" rx="16" ry="20" fill="#e5761c"/>'
  + '<ellipse cx="40" cy="37" rx="18" ry="22" fill="#f28c28" stroke="#8a3b0c" stroke-width="1.5"/>'
  + '<path d="M40 15c0-6 3-9 8-10" stroke="#2d6a4f" stroke-width="4" fill="none" stroke-linecap="round"/>'
  + '<path d="M28 32l5-7 5 7zM42 32l5-7 5 7z" fill="#ffe7a0"/><path d="M27 42q13 12 26 0l-4 2-3-3-3 4-3-4-3 3-4-2z" fill="#ffe7a0"/>'
  + '</svg>';
