// Drawn backdrop + secretary stand for the Blue Archive "menu with a girl" screens (missions
// hub, Bounty location select). Owner: "missions need to get updated! it's still using old ugly
// assets, especially the character art in the bottom left" — the painted academy (dimmed,
// blurred) replaces the procedural room, her drawn cut-out replaces the SVG card.
import { h } from './dom.js';
import { portraitHTML } from '../art/portraits.js';
import { lobbyArtUrl } from '../data/lobbyArt.js';
import { UNIT_MAP } from '../data/units.js';
import { secretaryOf } from './lobby/secretaryOf.js';

/** Full-screen painted academy behind the panels. */
export function hubBackdrop() {
  return h('div.hub-bg', { 'aria-hidden': 'true' },
    h('img.hub-bg-img', { src: lobbyArtUrl('academy.webp'), alt: '', decoding: 'async', draggable: false }),
    h('i.hub-bg-shade'));
}

/** The lobby secretary's unit def. */
export function hubSecretary(profile) {
  return UNIT_MAP[secretaryOf(profile)] || UNIT_MAP.hikari;
}

/** Her drawn stand, bottom-left and bleeding off the edge, with a slanted nameplate. */
export function hubStand(u, { cls = '' } = {}) {
  return h(`div.hub-stand${cls ? `.${cls}` : ''}`, { 'aria-hidden': 'true', 'data-testid': 'hub-stand' },
    h('div.hub-stand-art', { html: portraitHTML(u, 'cut', { eager: true }) }),
    h('div.hub-stand-name', h('b', u.name), h('span', u.title)));
}
