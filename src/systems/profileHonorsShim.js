// TEMPORARY stand-in for the achievements expansion's honors modules (docs/specs/ACHIEVEMENTS.md §2,
// §6; owned by feature/achievements: src/data/honors.js + src/systems/honors.js). It carries only the
// titles and Honor Ribbons that sit on achievements this build already ships, with simple placeholder
// ribbon art, so the profile's title and pin plumbing works today. src/systems/profileHonors.js is the
// only importer: when the real modules land, that adapter switches over and this file is deleted.
import { ACHIEVEMENTS } from '../data/missions.js';

/** Achievements that never give a cosmetic (no title, no ribbon, never pinned): recruiting and luck. */
export const NO_COSMETIC = (id) => /^a_pulls_/.test(id) || id === 'a_units_all' || id === 'a_reroll_10';

/** Title plates: 'std' (violet → pink), 'gold', 'prism' (ACHIEVEMENTS.md §2.5). */
const TITLE_ROWS = [
  ['fp_crimson', 'Crimson Slayer', 'prism', 'Defeat the Ashwing Matriarch in Crimson Moon Freeplay.'],
  ['fp_ashwing', 'Ashwing Slayer', 'gold', 'Defeat the Ashwing Matriarch in Blossom or Tempest Freeplay.'],
  ['a_chapter_8', 'Summit Sentinel', 'gold'],
  ['a_gold_40', 'Valedictorian', 'gold'],
  ['a_sakura_10', 'Sakura Sentinel', 'gold'],
  ['a_bestiary_100', 'Walking Encyclopedia', 'gold'],
  ['a_level_60', 'Perfect Score', 'gold'],
  ['a_awaken_5', 'Radiant Halo', 'gold'],
  ['a_first_win', 'Rookie Sentinel', 'std'],
  ['a_bestiary_50', 'Monster Scholar', 'std'],
  ['a_kills_25000', 'Legend of the Academy', 'std'],
];

const ACH = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

/** { [titleId]: { text, tier, how } }: ids are achievement ids or the freeplay `fp_*` ids. */
export const TITLE_TABLE = Object.freeze(Object.fromEntries(TITLE_ROWS
  .filter(([id]) => id.startsWith('fp_') || ACH[id])
  .map(([id, text, tier, how]) => [id, Object.freeze({ text, tier, how: how || ACH[id]?.desc || '' })])));

/** Honor Ribbons on shipped achievements: achievement id → { name, cls, hue }. */
const RIBBON_ROWS = [
  ['a_chapter_1', 'Sakura Gardens Ribbon', 'plain', '#ff7aa8'],
  ['a_chapter_2', 'Moonlit Lakeshore Ribbon', 'plain', '#4c8dff'],
  ['a_chapter_3', 'Moonveil Shrine Ribbon', 'plain', '#e5484d'],
  ['a_chapter_4', 'Ironhold Pass Ribbon', 'plain', '#6c7a96'],
  ['a_chapter_5', 'Gloomfen Marsh Ribbon', 'plain', '#2bb673'],
  ['a_chapter_6', 'Clockwork Foundry Ribbon', 'plain', '#c27c2c'],
  ['a_sakura_10', 'Sakura Watch Ribbon', 'plain', '#b06bff'],
  ['a_chapter_7', 'Oni Festival Ribbon', 'plain', '#ff8a3d'],
  ['a_boss_3', 'Assault Crown Ribbon', 'plain', '#1f9fc4'],
  ['a_chapter_8', 'Ashwing Peaks Ribbon', 'shiny', '#e0533d'],
  ['a_gold_40', 'Valedictorian Laurel', 'shiny', '#2bb6a8'],
  ['a_bestiary_100', 'Encyclopedia Ribbon', 'shiny', '#4c6fff'],
];
const RIBBONS = Object.freeze(Object.fromEntries(RIBBON_ROWS
  .filter(([id]) => ACH[id])
  .map(([id, name, cls, hue]) => [id, Object.freeze({ name, cls, hue })])));

/** Honor Ribbons this build contains (the "n / total" on screens). */
export const HONOR_TOTAL = Object.keys(RIBBONS).length;

/** @returns {{ name, cls: 'plain'|'shiny'|'special', hue }|null} */
export function honorOf(achId) {
  return RIBBONS[achId] || null;
}

const claimed = (p, id) => p?.missions?.achievements?.[id] === true;

/** Claimed achievement ids that carry a title (never NO_COSMETIC). */
export function earnedAchievementTitles(p) {
  return Object.keys(TITLE_TABLE).filter((id) => !id.startsWith('fp_') && claimed(p, id) && !NO_COSMETIC(id));
}

/** Claimed achievement ids that carry an Honor Ribbon, in table order. */
export function earnedHonors(p) {
  return Object.keys(RIBBONS).filter((id) => claimed(p, id));
}

export function honorCount(p) {
  return earnedHonors(p).length;
}

/** Total enemies defeated (the real module's killsAll also counts co-op kills). */
export function killsAll(p) {
  return Math.max(0, Math.floor(Number(p?.stats?.kills) || 0));
}

let seq = 0;
/**
 * Placeholder Honor Ribbon art (a pleated rosette with tails, by class), rendered natively at `px`.
 * @returns {string} SVG markup
 */
export function honorSVG(achId, px = 40) {
  const r = RIBBONS[achId];
  if (!r) return '';
  const id = `hrs${++seq}`;
  const shiny = r.cls !== 'plain';
  const pleats = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return `<circle cx="${(32 + Math.cos(a) * 17).toFixed(1)}" cy="${(27 + Math.sin(a) * 17).toFixed(1)}" r="6.4"/>`;
  }).join('');
  return `<svg viewBox="0 0 64 64" width="${px}" height="${px}" aria-hidden="true"><defs>`
    + `<radialGradient id="${id}d" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="${shiny ? '#fff6c9' : '#ffffff'}"/><stop offset="1" stop-color="${shiny ? '#e9b730' : r.hue}"/></radialGradient></defs>`
    + `<path d="M24 38l-7 22 8-4 5 6 4-20z" fill="${r.hue}" stroke="#fff" stroke-width="1.4"/><path d="M40 38l7 22-8-4-5 6-4-20z" fill="${r.hue}" stroke="#fff" stroke-width="1.4"/>`
    + `<g fill="${r.hue}" stroke="#fff" stroke-width="1.2">${pleats}</g>`
    + (shiny ? `<circle cx="32" cy="27" r="15" fill="none" stroke="#f2c94c" stroke-width="2.4"/>` : '')
    + `<circle cx="32" cy="27" r="12" fill="url(#${id}d)" stroke="#fff" stroke-width="2"/>`
    + `<path d="M32 19.5l2.3 5 5.4.5-4.1 3.6 1.2 5.3L32 31.2l-4.8 2.7 1.2-5.3-4.1-3.6 5.4-.5z" fill="#fff" opacity="0.92"/></svg>`;
}
