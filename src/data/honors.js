// Honor Ribbons and titles as tables (owner: systems; docs/specs/ACHIEVEMENTS.md §2). Derived from the achievement
// rows, so the two can never disagree. Stable interface for the Sensei Profile (docs/specs/PROFILE.md):
//
//   HONOR_RIBBONS  [{ id, no, name, class: 'plain'|'shiny'|'special', effect, effectName, emblem, wave }]
//                  id = the achievement id that grants it (a profile pin is `ach:<id>`); ordered by case number
//   TITLES         [{ id, name, plate: 'standard'|'gold'|'prism', source, wave, tag?, how? }]
//                  id = the achievement id (or fp_ashwing / fp_crimson for the two freeplay titles, or
//                  tag_dev / tag_alpha / tag_beta for the three player-tag titles, src/data/playerTags.js:
//                  owned from the save's 'tag:' marks, listed only when owned, never in an "out of N")
//
// Ownership is never stored: src/systems/honors.js derives it from the claims (missions.achievements).
// Colours and emblem paths are client art (src/art/honors.js), never in the save or on the public card.

import { ACHIEVEMENTS, FREEPLAY_TITLES, NO_COSMETIC } from './achievements.js';
import { TAG_TITLE_ROWS } from './playerTags.js';

/** Display names of the 9 special effects (kid copy for the detail view in EFFECT_LINES). */
export const HONOR_EFFECTS = Object.freeze({
  prism: 'Prism',
  sakura: 'Sakura Drift',
  sunrise: 'Sunrise',
  storm: 'Thunderclap',
  ember: 'Ember Glow',
  starfield: 'Starfield',
  aurora: 'Aurora',
  holo: 'Holo Foil',
  chalk: 'Chalk Dust',
});

/** One line per effect for the ribbon detail and the fanfare (§2.3). */
export const EFFECT_LINES = Object.freeze({
  prism: 'a rainbow swirls around the ribbon',
  sakura: 'petals drift across the ribbon',
  sunrise: 'golden rays turn and a light sweeps by',
  storm: 'little bolts crackle, then calm',
  ember: 'a warm glow pulses and embers rise',
  starfield: 'a night sky drifts behind the moon',
  aurora: 'soft northern lights float across',
  holo: 'shiny foil shifts like a tilted card',
  chalk: 'chalk dust twinkles like a clapped eraser',
});

/** Class labels (every screen also writes the class as a text pill, not only the shape). */
export const HONOR_CLASSES = Object.freeze({ plain: 'Ribbon', shiny: 'Shiny', special: 'Special' });

/** Title plates: the def's tier → the plate name. */
const PLATE = { std: 'standard', gold: 'gold', prism: 'prism' };
export const TITLE_PLATES = Object.freeze(['prism', 'gold', 'standard']);

export const HONOR_RIBBONS = Object.freeze(ACHIEVEMENTS
  .filter((a) => a.honor && !NO_COSMETIC(a.id))
  .map((a) => Object.freeze({
    id: a.id,
    no: a.honor.no,
    name: a.honor.name,
    class: a.honor.cls,
    effect: a.honor.fx || null,
    effectName: a.honor.fx ? HONOR_EFFECTS[a.honor.fx] : null,
    emblem: a.honor.emblem,
    source: a.name,
    wave: a.wave,
  }))
  .sort((x, y) => x.no - y.no));

export const HONOR_MAP = Object.freeze(Object.fromEntries(HONOR_RIBBONS.map((h) => [h.id, h])));

const PLATE_ORDER = { prism: 0, gold: 1, standard: 2 };
export const TITLES = Object.freeze([
  ...ACHIEVEMENTS.filter((a) => a.title && !NO_COSMETIC(a.id)).map((a) => ({ id: a.id, name: a.title.text, plate: PLATE[a.title.tier], source: a.name, wave: a.wave })),
  ...Object.entries(FREEPLAY_TITLES).map(([id, t]) => ({ id, name: t.text, plate: PLATE[t.tier], source: id === 'fp_crimson' ? 'Freeplay: Ashwing Matriarch on Crimson Moon' : 'Freeplay: Ashwing Matriarch', wave: 'launch' })),
  // the player-tag titles (owner request, 2026-10-15): the server says who has the tag
  ...TAG_TITLE_ROWS.map((t) => ({ id: t.id, name: t.name, plate: t.plate, source: t.how, how: t.how, tag: t.tag, wave: 'launch' })),
].map(Object.freeze).sort((x, y) => PLATE_ORDER[x.plate] - PLATE_ORDER[y.plate]));

/** Is this a player-tag title (Developer, Alpha Tester, Beta Tester)? */
export const isTagTitleRow = (t) => !!t?.tag;

export const TITLE_MAP = Object.freeze(Object.fromEntries(TITLES.map((t) => [t.id, t])));
