// Drawn backdrop + secretary stand for the "menu with a girl" screens (missions
// hub, Bounty location select). Owner: "missions need to get updated! it's still using old ugly
// assets, especially the character art in the bottom left" — the painted academy (dimmed,
// blurred) replaces the procedural room, her drawn cut-out replaces the SVG card.
// UI M5: a location per hub (HUB_LOCATIONS); the host girl with her bubble is ./host.js.
import { h } from './dom.js';
import { portraitHTML } from '../art/portraits.js';
import { lobbyArtUrl } from '../data/lobbyArt.js';
import { UNIT_MAP } from '../data/units.js';
import { secretaryOf } from './lobby/secretaryOf.js';

/**
 * A painted location per hub (docs/specs/UI_DIRECTION.md §5.10 E6): blurred and dimmed behind the glass panels,
 * text never on it. Until the owner approves painting the rooms (notes Q5), every hub reuses the painted academy
 * with its own tint; a painting dropped into public/art/lobby/ only needs its file name here.
 */
export const HUB_LOCATIONS = Object.freeze({
  academy: { art: 'academy.webp', tint: null }, // Missions, Bounty: as they were
  commissions: { art: 'academy.webp', tint: 'rgba(255, 196, 140, 0.22)' }, // the staff room
  mall: { art: 'academy.webp', tint: 'rgba(255, 150, 200, 0.2)' }, // the shop counter
  mail: { art: 'academy.webp', tint: 'rgba(150, 200, 255, 0.24)' }, // the post room
  recruit: { art: 'academy.webp', tint: 'rgba(255, 222, 120, 0.2)' }, // the admissions hall
  happening: { art: 'academy.webp', tint: 'rgba(255, 170, 150, 0.2)' },
  multiplayer: { art: 'academy.webp', tint: 'rgba(176, 160, 255, 0.22)' },
  workbench: { art: 'academy.webp', tint: 'rgba(140, 230, 200, 0.2)' }, // the club lab
});

/** Full-screen painted location behind the panels (`location`: a HUB_LOCATIONS key; the academy by default). */
export function hubBackdrop(location = 'academy') {
  const loc = HUB_LOCATIONS[location] || HUB_LOCATIONS.academy;
  return h('div.hub-bg', { 'aria-hidden': 'true', 'data-loc': location !== 'academy' && HUB_LOCATIONS[location] ? location : null },
    h('img.hub-bg-img', { src: lobbyArtUrl(loc.art), alt: '', decoding: 'async', draggable: false }),
    h('i.hub-bg-shade'),
    loc.tint ? h('i.hub-bg-tint', { style: { background: loc.tint } }) : null);
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
