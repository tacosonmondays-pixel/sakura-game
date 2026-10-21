// Future units (owner: units). See CONTRACTS.md §3a and docs/merge/ROSTER_SPEC.md §3.8.
//
// Four V2 designs whose girls took back their original look in the roster merge (V2 Rei, Nami,
// Luna and Kaede) become new characters for a later update. They are NOT UnitDefs: they are not
// in UNITS, cannot be owned, recruited or deployed, and never reach the sim, saves or balance.
// They only appear in the wiki's "Coming Soon" article with a 3D render (public/art/future/<id>.webp)
// of their model (public/models/characters/future-<id>.glb, a byte copy of the V2 file; the GLB's
// extras.unit stays the source id). palette/look are frozen from commit 05adb2a.
//
// Plain data, no side effects.

/**
 * @typedef {object} FutureUnitDef
 * @property {string} id
 * @property {string} name
 * @property {string} title
 * @property {'tower'|'hero'} kind
 * @property {boolean} adult true exactly for heroes (adult guardians)
 * @property {string} plannedRole ROLES key she is planned to have
 * @property {string} from the V2 unit id her design comes from
 * @property {string} asset key in public/models/characters/manifest.json
 * @property {object} palette 9 colours (frozen V2 palette)
 * @property {object} look 8 enums (frozen V2 look)
 * @property {string} bio
 * @property {string} teaser
 */

/** @type {FutureUnitDef[]} */
export const FUTURE_UNITS = [
  {
    id: 'tomoe',
    name: 'Tomoe',
    title: 'Crescent Cleaver',
    kind: 'tower',
    adult: false,
    plannedRole: 'cleaver',
    from: 'rei',
    asset: 'future-tomoe',
    palette: {
      hair: '#2b2f45', hairShade: '#171a29', eyes: '#e63946', skin: '#ffe2d2',
      outfit: '#3c4a6b', outfitShade: '#26304a', accent: '#e63946', halo: '#ff8fa3', weapon: '#dfe6f0',
    },
    look: {
      hairStyle: 'short', bangs: 'messy', accessory: 'headband', outfit: 'blazer', weapon: 'katana',
      halo: 'star', eyeStyle: 'sharp', expression: 'determined',
    },
    bio: 'Vice-captain of a northern kendo school, who swings an oversized steel nodachi as if it weighed nothing. Short ink-navy hair, a red hachimaki headband and a blazer with the sleeves rolled up. She loves corners — the tighter the crowd, the wider her grin.',
    teaser: 'A transfer student with a blade as tall as she is. Arriving in a future update.',
  },
  {
    id: 'mizuha',
    name: 'Mizuha',
    title: 'Tideguard Commodore',
    kind: 'hero',
    adult: true,
    plannedRole: 'tideguard',
    from: 'nami',
    asset: 'future-mizuha',
    palette: {
      hair: '#2ec4b6', hairShade: '#16897f', eyes: '#4cc9f0', skin: '#f2d2bd',
      outfit: '#1d3557', outfitShade: '#122440', accent: '#e9c46a', halo: '#9be7ff', weapon: '#d4af37',
    },
    look: {
      hairStyle: 'wavy', bangs: 'split', accessory: 'flower', outfit: 'coat', weapon: 'trident',
      halo: 'wave', eyeStyle: 'sharp', expression: 'calm',
    },
    bio: 'A retired naval commodore who now guards the far harbour. Tall and calm, she wears a fitted navy greatcoat with gold epaulettes and a sea-blossom pinned in her long teal waves, and stands knee-deep in the shallows with a gilded trident. Her strikes freeze the tide around her foes.',
    teaser: "The fleet's old commodore is sailing home. Arriving in a future update.",
  },
  {
    id: 'sayo',
    name: 'Sayo',
    title: 'Moonlit Archmage',
    kind: 'hero',
    adult: true,
    plannedRole: 'mystic',
    from: 'luna',
    asset: 'future-sayo',
    palette: {
      hair: '#cdbbff', hairShade: '#8b74d9', eyes: '#a26bff', skin: '#f8e4e0',
      outfit: '#2a2350', outfitShade: '#17122e', accent: '#c9a8ff', halo: '#e6dcff', weapon: '#7a5cff',
    },
    look: {
      hairStyle: 'hime', bangs: 'hime', accessory: 'witchHat', outfit: 'robe', weapon: 'tome',
      halo: 'moon', eyeStyle: 'sleepy', expression: 'smug',
    },
    bio: "Archmage of the Night Courses and the academy's most glamorous visiting teacher. She drifts through battle in a midnight gown-robe embroidered with constellations and a wide star-stitched witch hat over lavender hime-cut hair, her grimoire floating open at her side.",
    teaser: 'A new teacher for the night courses. Arriving in a future update.',
  },
  {
    id: 'hiiro',
    name: 'Hiiro',
    title: 'Crimson Maple Duelist',
    kind: 'tower',
    adult: false,
    plannedRole: 'duelist',
    from: 'kaede',
    asset: 'future-hiiro',
    palette: {
      hair: '#7a1f2b', hairShade: '#4a0f18', eyes: '#f4a261', skin: '#fde7da',
      outfit: '#1f1b24', outfitShade: '#0f0d12', accent: '#e85d04', halo: '#ff9e57', weapon: '#e5e5e5',
    },
    look: {
      hairStyle: 'ponytail', bangs: 'split', accessory: 'ribbon', outfit: 'coat', weapon: 'rapier',
      halo: 'leaf', eyeStyle: 'sharp', expression: 'determined',
    },
    bio: "Heir to an old fencing school. A high burgundy ponytail tied with a maple-orange ribbon, a long black duelist's coat with crimson lining, and a rapier that is never sheathed during a wave. She picks the strongest monster on the field and does not let go until it falls.",
    teaser: 'A rival fencer has challenged Kaede. Arriving in a future update.',
  },
];

/** id -> FutureUnitDef */
export const FUTURE_MAP = Object.fromEntries(FUTURE_UNITS.map((u) => [u.id, u]));

/** @returns {string} base-relative path (under public/art/) of a future unit's 3D render. */
export function futureThumb(id) {
  return `future/${id}.webp`;
}
