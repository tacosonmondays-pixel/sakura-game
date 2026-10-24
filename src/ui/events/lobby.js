// The lobby's limited-event pieces (EVENT_SPEC §3.12 Lobby): the bottom-left EVENT card for the
// featured event, and a light decor overlay (a string of lanterns, two pumpkins) while it runs. Over a full
// illustration or her stand the lantern string gives way to her head (hangLobbyLanterns).
import { h } from '../dom.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { UNIT_MAP } from '../../data/units.js';
import { lobbyArtUrl } from '../../data/lobbyArt.js';
import { portraitHTML } from '../../art/portraits.js';
import { featuredEvent, phaseLabel, markEventLogin, settleEvents } from '../../systems/events.js';
import { eventNow } from './clock.js';
import { lanternString } from './art.js';
import { hangString } from '../lobby/sceneLayout.js';

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

/** The full lantern string: 9 lanterns on a 900-unit-wide drawing. */
const LANTERNS = 9;
const LANTERN_W = 900;

/** Lanterns across the top and two pumpkins at the bottom corners, while an event with decor runs. */
export function eventLobbyDecor() {
  const f = featuredEvent(store.profile, eventNow());
  if (!f || f.phase !== 'active' || f.ev.key !== 'halloween') return null;
  return h('div.lb-ev-decor', { 'aria-hidden': 'true', 'data-testid': 'event-decor' },
    h('div.lb-ev-lanterns', { html: lanternString(LANTERNS, LANTERN_W), dataset: { hang: 'full' } }),
    h('div.lb-ev-pumpkin.l', { html: PUMPKIN_SVG }),
    h('div.lb-ev-pumpkin.r', { html: PUMPKIN_SVG }));
}

/**
 * Hangs the lantern string clear of her head, hair and halo, in a full illustration or on her stand
 * (sceneLayout.hangString): cut back to the open side of her head (same lantern size and spacing, a shallower dip),
 * or hidden when neither side has room for two lanterns. at = { face, r } from the art stage, in host px (the decor
 * overlay covers the same box); null = no head known, the full string. The string's own box never changes (only its drawing does), so the stage's
 * menu boxes, and with them her crop, do not depend on it.
 * @param {HTMLElement|null} decor the eventLobbyDecor() node
 * @param {{ face: {x:number,y:number}, r: number }|null} at
 */
export function hangLobbyLanterns(decor, at) {
  const node = decor?.querySelector('.lb-ev-lanterns');
  if (!node) return;
  const box = { l: node.offsetLeft, t: node.offsetTop, r: node.offsetLeft + node.offsetWidth, b: node.offsetTop + node.offsetHeight };
  const natW = box.r - box.l;
  const step = natW / (LANTERNS + 1);
  const span = at && natW > 0 ? hangString(box, at.face, at.r, { minW: 2.5 * step }) : { ...box, full: true };
  const key = !span ? 'none' : span.full ? 'full' : `${Math.round(span.l - box.l)}:${Math.round(span.r - span.l)}/${natW}`;
  node.style.visibility = span ? '' : 'hidden';
  if (node.dataset.hang === key) return;
  node.dataset.hang = key;
  if (!span) return;
  if (span.full) {
    node.innerHTML = lanternString(LANTERNS, LANTERN_W);
    return;
  }
  const w = span.r - span.l;
  // the drawing keeps the full string's scale (units per px), so the lanterns are the same size and spacing
  node.innerHTML = lanternString(Math.max(2, Math.round(w / step) - 1), Math.round((LANTERN_W * w) / natW), Math.max(0.4, w / natW));
  Object.assign(node.firstElementChild.style, { position: 'absolute', top: '0', left: `${Math.round(span.l - box.l)}px`, width: `${Math.round(w)}px` });
}

const PUMPKIN_SVG = '<svg viewBox="0 0 80 64" xmlns="http://www.w3.org/2000/svg">'
  + '<ellipse cx="40" cy="60" rx="30" ry="4" fill="#000" opacity="0.18"/>'
  + '<ellipse cx="26" cy="38" rx="16" ry="20" fill="#e5761c"/><ellipse cx="54" cy="38" rx="16" ry="20" fill="#e5761c"/>'
  + '<ellipse cx="40" cy="37" rx="18" ry="22" fill="#f28c28" stroke="#8a3b0c" stroke-width="1.5"/>'
  + '<path d="M40 15c0-6 3-9 8-10" stroke="#2d6a4f" stroke-width="4" fill="none" stroke-linecap="round"/>'
  + '<path d="M28 32l5-7 5 7zM42 32l5-7 5 7z" fill="#ffe7a0"/><path d="M27 42q13 12 26 0l-4 2-3-3-3 4-3-4-3 3-4-2z" fill="#ffe7a0"/>'
  + '</svg>';
