// The Potential Board's per-girl look (docs/specs/POTENTIAL_BOARD.md; UI_V2_MENUS.md section 6). UI-only: read by
// src/ui/potentialBoard/*, never by src/sim/** (outside the co-op graph and the data hash, like potentialText.js).
//
// Per girl:
//   family   her layout family (src/ui/potentialBoard/layout.js FAMILIES): spear, burst, ring, circuit or crest; the
//            default comes from her class (CLASS_FAMILY; every hero is crest), and a builder may move a girl by hand
//   variant  which of the family's layouts (0, 1 or 2) and
//   mirror   whether it is drawn left-right mirrored: both picked once by layout.js boardPick(id), a stable hash of her
//            id, and written in here so her Board never moves when a family gains a layout
//   hue      her colour: the dominant saturated hue of her card art (public/art/portraits/<id>-card.webp), sampled once
//            with Pillow (centre-weighted on her figure; skin, greys and dark browns left out), then lifted to a light
//            that reads on the night plate (--plate #0e1930) at 4.6:1 or more; her light paths and lit nodes
//   emblem   her role's line glyph (src/ui/lineGlyphs.js), drawn in the Board's centre socket
// A girl without a row (a new girl) gets her class defaults (boardRow), so no Board is ever blank.

/** The five layout families (src/ui/potentialBoard/layout.js draws each). */
export const BOARD_FAMILIES = Object.freeze(['spear', 'burst', 'ring', 'circuit', 'crest']);

/** Every hero's family (a symmetric crest with P6 at the top). */
export const HERO_FAMILY = 'crest';

/** A tower girl's default family by class (UI_V2_MENUS.md section 6, the family table; mortar and prism added). */
export const CLASS_FAMILY = Object.freeze({
  marksman: 'spear', sniper: 'spear', duelist: 'spear', skirmisher: 'spear', cleaver: 'spear', falconer: 'spear', prism: 'spear',
  bombardment: 'burst', artillery: 'burst', chain: 'burst', alchemist: 'burst', trapper: 'burst', spiker: 'burst', bowler: 'burst',
  mirror: 'burst', mortar: 'burst',
  support: 'ring', enchanter: 'ring', exorcist: 'ring', controller: 'ring', displacement: 'ring', purifier: 'ring', hexer: 'ring',
  ring: 'ring', council: 'ring',
  economy: 'circuit', engineer: 'circuit', manager: 'circuit', builder: 'circuit', summoner: 'circuit', botanist: 'circuit',
});

/** Each class's line glyph for the centre socket (names in src/ui/lineGlyphs.js LINE_GLYPHS). */
export const CLASS_EMBLEM = Object.freeze({
  // heroes
  vanguard: 'shield', mystic: 'moon', tideguard: 'waves', champion: 'trophy', puppeteer: 'users', stormrider: 'zap',
  // spear
  marksman: 'target', sniper: 'pierce', duelist: 'sword', skirmisher: 'gauge', cleaver: 'swords', falconer: 'feather', prism: 'search',
  // burst
  bombardment: 'sparkles', artillery: 'armorbreak', chain: 'zap', alchemist: 'cube', trapper: 'bell', spiker: 'hash', bowler: 'timer',
  mirror: 'image', mortar: 'castle',
  // ring
  support: 'heart', enchanter: 'sparkle', exorcist: 'lantern', controller: 'hourglass', displacement: 'refresh', purifier: 'sakura',
  hexer: 'book', ring: 'maximize', council: 'percent',
  // circuit
  economy: 'bag', engineer: 'settings', manager: 'clipboard', builder: 'box', summoner: 'paw', botanist: 'tree',
});

/** A new girl's colour until her card art is sampled: one per family, each 4.6:1 or more on the plate. */
export const FAMILY_HUE = Object.freeze({
  spear: '#7cb2ff',
  burst: '#ff9a62',
  ring: '#5fd3c0',
  circuit: '#e2c45c',
  crest: '#ff8fb1',
});

/** A girl whose class has no row above (a class added later): a calm ring with a sparkle until a builder picks. */
export const FALLBACK_BOARD = Object.freeze({ family: 'ring', emblem: 'sparkle' });

/**
 * Girls with an LR step (max her at UR, awaken her, then clear her Starfall Trial; UI_DIRECTION.md 5.6): their Board
 * gets the Nightglass twin-star crest point after the LV 85 ring. None yet; the first duo joins when it ships.
 */
export const LR_UNITS = Object.freeze([]);

const row = (family, variant, mirror, hue, emblem) => Object.freeze({ family, variant, mirror, hue, emblem });

/** The 35 girls (card colour = the raw sample before the lift, kept for the record). */
export const POTENTIAL_BOARDS = Object.freeze({
  hikari: row('crest', 1, false, '#d85a7f', 'shield'), // vanguard · card #a6526b
  luna: row('crest', 0, false, '#6e7bdd', 'moon'), // mystic · card #3d4374
  nami: row('crest', 2, true, '#51a4d6', 'waves'), // tideguard · card #53809c
  aoi: row('spear', 0, true, '#a0d651', 'target'), // marksman · card #7b9753
  rei: row('spear', 0, true, '#8177df', 'swords'), // cleaver · card #413d67
  yuki: row('ring', 0, false, '#518dd6', 'hourglass'), // controller · card #6589b3
  momo: row('circuit', 2, false, '#d75696', 'bag'), // economy · card #b1447b
  akane: row('burst', 2, false, '#d75f56', 'sparkles'), // bombardment · card #9c3931
  sango: row('burst', 0, true, '#d66a51', 'armorbreak'), // artillery · card #9c594a
  kage: row('spear', 2, false, '#aa66db', 'gauge'), // skirmisher · card #66487c
  umeko: row('ring', 1, true, '#518ed6', 'heart'), // support · card #3b4b5e
  shiro: row('spear', 0, true, '#5a84d8', 'pierce'), // sniper · card #3b4f78
  midori: row('burst', 1, false, '#cbd651', 'cube'), // alchemist · card #b2bb5b
  suzu: row('burst', 2, false, '#51d6cd', 'bell'), // trapper · card #397672
  raika: row('burst', 0, true, '#8977df', 'zap'), // chain · card #6f64a4
  miko: row('ring', 2, false, '#d85e5a', 'sparkle'), // enchanter · card #9e2d29
  hotaru: row('ring', 1, false, '#d68251', 'lantern'), // exorcist · card #ca7747
  kaede: row('spear', 2, false, '#d66251', 'sword'), // duelist · card #98382b
  chika: row('circuit', 2, true, '#d68351', 'settings'), // engineer · card #b96d40
  kanna: row('crest', 0, true, '#d85b5a', 'trophy'), // champion · card #8e2827
  yoriko: row('crest', 1, true, '#986edd', 'users'), // puppeteer · card #654a91
  seiran: row('crest', 0, true, '#5199d6', 'zap'), // stormrider · card #6290b6
  fuu: row('ring', 2, true, '#51d699', 'refresh'), // displacement · card #5f937b
  hana: row('spear', 1, true, '#65beec', 'feather'), // falconer · card #88cdf0
  ruri: row('circuit', 1, true, '#5e83d9', 'paw'), // summoner · card #4361a5
  noa: row('ring', 1, false, '#d67351', 'sakura'), // purifier · card #9b5c47
  iroha: row('burst', 2, true, '#d651b5', 'image'), // mirror · card #864876
  ena: row('ring', 2, true, '#d85a7d', 'book'), // hexer · card #803147
  azami: row('burst', 1, true, '#d85a69', 'hash'), // spiker · card #933f49
  kinu: row('ring', 2, false, '#d66c51', 'maximize'), // ring · card #9d5a4a
  wakaba: row('circuit', 0, false, '#5b98d9', 'clipboard'), // manager · card #7999bb
  yuzuha: row('circuit', 2, true, '#ea924e', 'box'), // builder · card #ea924e
  ouka: row('ring', 1, false, '#d85a6b', 'percent'), // council · card #884a52
  chigusa: row('circuit', 1, false, '#d6d551', 'tree'), // botanist · card #9e9e65
  marumi: row('burst', 1, false, '#d65e51', 'timer'), // bowler · card #b95045
});

/** Her class's family: heroes are crest; an unknown class gets FALLBACK_BOARD's. */
export function classFamily(def) {
  if (def?.kind === 'hero') return HERO_FAMILY;
  return CLASS_FAMILY[def?.role] || FALLBACK_BOARD.family;
}

/**
 * Her Board's look: her row, else her class defaults (variant and mirror null: layout.js picks them by hash).
 * Accepts a unit def (or anything with `id`, `role`, `kind`); never null.
 * @param {{ id?: string, role?: string, kind?: string }|null|undefined} def
 * @returns {{ id: string, family: string, variant: number|null, mirror: boolean|null, hue: string, emblem: string, source: 'row'|'class' }}
 */
export function boardRow(def) {
  const id = String(def?.id ?? '');
  const own = Object.prototype.hasOwnProperty.call(POTENTIAL_BOARDS, id) ? POTENTIAL_BOARDS[id] : null;
  if (own) return { id, ...own, source: 'row' };
  const family = classFamily(def);
  return {
    id,
    family,
    variant: null,
    mirror: null,
    hue: FAMILY_HUE[family],
    emblem: CLASS_EMBLEM[def?.role] || FALLBACK_BOARD.emblem,
    source: 'class',
  };
}

/** Does her Board end in the LR crest point? (a def whose rarity is LR, or a girl in LR_UNITS) */
export function hasLrStep(def) {
  return !!def && (def.rarity === 'LR' || LR_UNITS.includes(def.id));
}
