// Dev-only gallery for src/art (not part of the game build).
// Sections: ?s=cards | portraits | icons | maps | backdrops | all (default)
import { UNITS } from '../src/data/units.js';
import { ITEMS } from '../src/data/items.js';
import { MAPS } from '../src/data/maps.js';
import { TRAITS, ROLES, ATTACK_TYPES, ARMOR_CLASSES, CAPABILITIES, ELEMENTS, STATUSES, DIFFICULTIES, GEAR_SLOTS, ITEM_RARITY_ORDER } from '../src/data/types.js';
import { cardArtSVG } from '../src/art/cardArt.js';
import * as I from '../src/art/icons.js';
import { stageThumbSVG } from '../src/art/stageThumb.js';
import { lobbyBackdropSVG, themeBackdropSVG } from '../src/art/backdrops.js';

const SECTIONS = ['all', 'cards', 'portraits', 'icons', 'maps', 'backdrops'];
const params = new URLSearchParams(location.search);
const sec = SECTIONS.includes(params.get('s')) ? params.get('s') : 'all';
const only = params.get('u') ? params.get('u').split(',') : null;
const awaken = Number(params.get('aw') || 2);
document.getElementById('nav').innerHTML = SECTIONS.map((s) => `<a href="?s=${s}" class="${s === sec ? 'on' : ''}">${s}</a>`).join('');

const show = (s) => sec === 'all' || sec === s;
const units = only ? UNITS.filter((u) => only.includes(u.id)) : UNITS;
const icon = (svg, label, cls = '') => `<div class="ic ${cls}"><div>${svg}</div>${label}</div>`;
let html = '';

if (show('cards')) {
  html += `<h2>Cards — full (awaken ${awaken})</h2><div class="row">${units.map((u) => `<div class="full">${cardArtSVG(u, { variant: 'full', awaken })}</div>`).join('')}</div>`;
}
if (show('portraits')) {
  html += `<h2>Cards — portrait</h2><div class="row">${units.map((u) => `<div class="portrait">${cardArtSVG(u, { variant: 'portrait' })}</div>`).join('')}</div>`;
  html += `<h2>Cards — thumb</h2><div class="row">${units.map((u) => `<div class="thumb">${cardArtSVG(u, { variant: 'thumb' })}</div>`).join('')}</div>`;
}
if (show('icons')) {
  html += `<h2>Items (${Object.keys(ITEMS).length})</h2><div class="row">${Object.keys(ITEMS).map((id) => icon(I.itemIcon(id), id)).join('')}</div>`;
  const gear = [];
  for (const slot of Object.keys(GEAR_SLOTS)) for (const r of ITEM_RARITY_ORDER) gear.push(icon(I.gearIcon(slot, r), `${slot} ${r}`));
  html += `<h2>Gear</h2><div class="row">${gear.join('')}</div>`;
  html += `<h2>Currencies</h2><div class="row">${['coins', 'gems', 'recruitPoints', 'token_boss', 'token_bounty'].map((k) => icon(I.currencyIcon(k), k)).join('')}</div>`;
  const group = (title, keys, fn) => `<h2>${title}</h2><div class="row">${keys.map((k) => icon(fn(k), k, 'sm')).join('')}</div>`;
  html += group('Traits', Object.keys(TRAITS), I.traitIcon);
  html += group('Roles', Object.keys(ROLES), I.roleIcon);
  html += group('Attack types', Object.keys(ATTACK_TYPES), I.attackTypeIcon);
  html += group('Armour classes', Object.keys(ARMOR_CLASSES), I.armorClassIcon);
  html += group('Capabilities', Object.keys(CAPABILITIES), I.capabilityIcon);
  html += group('Elements', Object.keys(ELEMENTS), I.elementIcon);
  html += group('Statuses', Object.keys(STATUSES), I.statusIcon);
  html += `<h2>Medals</h2><div class="row">${Object.keys(DIFFICULTIES).map((d) => icon(I.medalIcon(d), d, 'sm') + icon(I.medalIcon(d, { earned: false }), `${d} (locked)`, 'sm')).join('')}</div>`;
  html += `<h2>UI icons (currentColor)</h2><div class="row">${I.UI_ICON_NAMES.map((k) => icon(I.uiIcon(k), k, 'ui')).join('')}</div>`;
}
if (show('maps')) {
  const maps = sec === 'maps' ? MAPS : MAPS.filter((m, i) => i % 5 === 0);
  html += `<h2>Stage thumbs (${maps.length})</h2><div class="row">${maps.map((m) => `<div class="map"><div>${stageThumbSVG(m)}</div><div class="cap">${m.name} · ${m.theme}</div></div>`).join('')}</div>`;
}
if (show('backdrops')) {
  html += `<h2>Lobby backdrop</h2><div class="row"><div class="bd lobby">${lobbyBackdropSVG()}</div></div>`;
  const themes = ['sakura', 'lake', 'shrine', 'mountain', 'marsh', 'foundry', 'festival', 'volcano', 'snow', 'night', 'arena'];
  html += `<h2>Theme banners</h2><div class="row">${themes.map((t) => `<div class="bd">${themeBackdropSVG(t)}</div>`).join('')}</div>`;
}
document.getElementById('out').innerHTML = html;
