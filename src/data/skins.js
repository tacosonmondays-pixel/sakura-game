// Outfits ("skins") for the roster girls (owner: units). See CONTRACTS.md §3a and
// docs/merge/ROSTER_SPEC.md §3.
//
// A skin changes only the girl's 3D chibi (battle, student showcase, lobby secretary): her drawn
// portraits always show her main design. Every unit has a generated default row
// ('<unitId>_default', asset '<unitId>', the model public/models/characters/<unitId>.glb).
// "Sentinel Style" rows keep the V2 looks the 15 girls wore before the roster merge: their GLBs
// are byte copies of those models (sentinel-<unitId>.glb) and their palette/look below are frozen
// from commit 05adb2a so the procedural placeholder (before the GLB arrives, node tests) and the
// skin card match. Sentinel Style is free with the girl (acquisition 'withUnit', decision D1):
// owning her owns the outfit, so no ownership is saved for it. profile.skins exists for later
// shop/event outfits.
//
// Plain data + tiny helpers, no side effects.

import { UNITS, UNIT_MAP } from './units.js';

/** Acquisition kinds a skin can have ('shop'/'event' are owned through profile.skins). */
export const SKIN_ACQUISITION = ['default', 'withUnit', 'shop', 'event'];

/** id of a unit's default skin row. */
export function defaultSkinId(unitId) {
  return `${unitId}_default`;
}

function defaultRow(u) {
  return {
    id: defaultSkinId(u.id),
    unitId: u.id,
    name: u.kind === 'hero' ? 'Guardian Attire' : 'Academy Uniform',
    desc: u.title,
    kind: 'default',
    asset: u.id,
    thumb: null, // the UI shows her drawn portrait thumb instead
    acquisition: { type: 'default' },
    order: 0,
  };
}

function sentinel(unitId, desc, palette, look) {
  return {
    id: `${unitId}_sentinel`,
    unitId,
    name: 'Sentinel Style',
    desc,
    kind: 'sentinel',
    asset: `sentinel-${unitId}`,
    palette,
    look,
    thumb: `skins/${unitId}_sentinel.webp`,
    acquisition: { type: 'withUnit', note: 'Free with her: the Sentinel Guard look she wore in the early days.' },
    order: 10,
  };
}

/** The V2 designs of 15 girls, kept as outfits (palette/look frozen from commit 05adb2a). */
const SENTINEL_SKINS = [
  sentinel('hikari', 'Sunlit Captain: golden hair, a crown, white armour and a yellow skirt.',
    {
      hair: '#ffe08a', hairShade: '#e0a93b', eyes: '#ffb347', skin: '#ffe6d6',
      outfit: '#ffffff', outfitShade: '#d9dfee', accent: '#f2c14e', halo: '#fff1a8', weapon: '#e8ecf5',
    },
    {
      hairStyle: 'long', bangs: 'swept', accessory: 'crown', outfit: 'armor', weapon: 'sword',
      halo: 'crown', eyeStyle: 'sharp', expression: 'smile',
    }),
  sentinel('aoi', 'Light-blue ponytail and a white sailor uniform with a pink scarf.',
    {
      hair: '#6cc4ff', hairShade: '#2f86d6', eyes: '#2563c9', skin: '#ffe5d6',
      outfit: '#ffffff', outfitShade: '#cfe2f5', accent: '#ff6f91', halo: '#a6e1ff', weapon: '#f4d27a',
    },
    {
      hairStyle: 'ponytail', bangs: 'swept', accessory: 'hairpin', outfit: 'sailor', weapon: 'bow',
      halo: 'ring', eyeStyle: 'round', expression: 'cheerful',
    }),
  sentinel('yuki', 'Pale-blue bob under a snowy hood and a blue dress.',
    {
      hair: '#cdeeff', hairShade: '#8cc8ee', eyes: '#5fc8f5', skin: '#fff0ea',
      outfit: '#bfe6ff', outfitShade: '#8ec5ea', accent: '#ffffff', halo: '#d6f3ff', weapon: '#9fd8ff',
    },
    {
      hairStyle: 'bob', bangs: 'straight', accessory: 'hood', outfit: 'dress', weapon: 'staff',
      halo: 'snow', eyeStyle: 'sleepy', expression: 'shy',
    }),
  sentinel('momo', 'Peach buns, bunny ears and a merchant\'s apron with a coin purse.',
    {
      hair: '#ffb4a2', hairShade: '#f08a7a', eyes: '#ff7a8a', skin: '#ffe7da',
      outfit: '#fff3c4', outfitShade: '#f5d98b', accent: '#ff8fab', halo: '#ffd166', weapon: '#e6b422',
    },
    {
      hairStyle: 'buns', bangs: 'straight', accessory: 'bunnyEars', outfit: 'apron', weapon: 'coinPurse',
      halo: 'star', eyeStyle: 'sparkle', expression: 'cheerful',
    }),
  sentinel('akane', 'Red twin-tails, little horns, an orange jumpsuit and a war fan.',
    {
      hair: '#ff3b3b', hairShade: '#b51f2a', eyes: '#ffb703', skin: '#ffe3d1',
      outfit: '#ff8c42', outfitShade: '#d2601a', accent: '#ffd23f', halo: '#ff9f1c', weapon: '#c1121f',
    },
    {
      hairStyle: 'twintails', bangs: 'swept', accessory: 'horns', outfit: 'jumpsuit', weapon: 'fan',
      halo: 'flame', eyeStyle: 'sharp', expression: 'smug',
    }),
  sentinel('sango', 'Coral side-tail, goggles and a white sailor uniform.',
    {
      hair: '#ff7f6e', hairShade: '#d94f45', eyes: '#1d7fa8', skin: '#ffe4d6',
      outfit: '#ffffff', outfitShade: '#cfe0ee', accent: '#1d4e89', halo: '#7fd6ff', weapon: '#5c6b7a',
    },
    {
      hairStyle: 'side', bangs: 'swept', accessory: 'goggles', outfit: 'sailor', weapon: 'cannon',
      halo: 'wave', eyeStyle: 'round', expression: 'determined',
    }),
  sentinel('kage', 'Cat-ear hood and a black courier hoodie.',
    {
      hair: '#3d3552', hairShade: '#221d30', eyes: '#b8a1ff', skin: '#f5ddd2',
      outfit: '#2b2a3d', outfitShade: '#191826', accent: '#8a5cf6', halo: '#c4b5fd', weapon: '#c0c7d6',
    },
    {
      hairStyle: 'short', bangs: 'messy', accessory: 'catEars', outfit: 'hoodie', weapon: 'shuriken',
      halo: 'moon', eyeStyle: 'sharp', expression: 'smug',
    }),
  sentinel('umeko', 'Magenta side-tail, a sea-flower and a white dress with a parasol.',
    {
      hair: '#b5598e', hairShade: '#7f3a63', eyes: '#ff9ec7', skin: '#ffe6dc',
      outfit: '#e8f6ff', outfitShade: '#b6dbef', accent: '#ff7eb6', halo: '#ffc2dd', weapon: '#ff9cc8',
    },
    {
      hairStyle: 'side', bangs: 'hime', accessory: 'flower', outfit: 'dress', weapon: 'parasol',
      halo: 'petal', eyeStyle: 'sleepy', expression: 'smile',
    }),
  sentinel('shiro', 'Long white hair, a beret and a navy blazer.',
    {
      hair: '#f2f2f7', hairShade: '#c2c4d6', eyes: '#4fd1c5', skin: '#fbe8de',
      outfit: '#33415c', outfitShade: '#1f2a40', accent: '#e2c275', halo: '#b8f2e6', weapon: '#2d3142',
    },
    {
      hairStyle: 'long', bangs: 'straight', accessory: 'beret', outfit: 'blazer', weapon: 'rifle',
      halo: 'eye', eyeStyle: 'sleepy', expression: 'calm',
    }),
  sentinel('midori', 'Green braid, goggles and an apothecary apron.',
    {
      hair: '#7bd389', hairShade: '#3fa35b', eyes: '#2e8b57', skin: '#ffe6d5',
      outfit: '#f4f1de', outfitShade: '#d6d1b1', accent: '#9b5de5', halo: '#b9fbc0', weapon: '#80ed99',
    },
    {
      hairStyle: 'braid', bangs: 'split', accessory: 'goggles', outfit: 'apron', weapon: 'flask',
      halo: 'leaf', eyeStyle: 'round', expression: 'smug',
    }),
  sentinel('suzu', 'Orange fox ears and a white kimono with a shrine bell.',
    {
      hair: '#f4a261', hairShade: '#c9752f', eyes: '#e76f51', skin: '#ffe8da',
      outfit: '#fff6f0', outfitShade: '#f0d3c4', accent: '#d62828', halo: '#ffd166', weapon: '#e9c46a',
    },
    {
      hairStyle: 'twintails', bangs: 'straight', accessory: 'foxEars', outfit: 'kimono', weapon: 'bell',
      halo: 'ring', eyeStyle: 'sparkle', expression: 'cheerful',
    }),
  sentinel('raika', 'Yellow buns and a black hoodie with a storm staff.',
    {
      hair: '#ffd60a', hairShade: '#c9a000', eyes: '#4cc9f0', skin: '#ffe6d8',
      outfit: '#22223b', outfitShade: '#13132a', accent: '#ffd60a', halo: '#fff3a3', weapon: '#9ad1ff',
    },
    {
      hairStyle: 'buns', bangs: 'messy', accessory: 'hairpin', outfit: 'hoodie', weapon: 'staff',
      halo: 'bolt', eyeStyle: 'sparkle', expression: 'cheerful',
    }),
  sentinel('miko', 'The first shrine-maiden look with a petal halo.',
    {
      hair: '#1b1b2f', hairShade: '#0b0b18', eyes: '#c1121f', skin: '#fff0e8',
      outfit: '#ffffff', outfitShade: '#e6e6ef', accent: '#d90429', halo: '#ffd6e7', weapon: '#f5f0e1',
    },
    {
      hairStyle: 'hime', bangs: 'hime', accessory: 'ribbon', outfit: 'miko', weapon: 'gohei',
      halo: 'petal', eyeStyle: 'closed', expression: 'calm',
    }),
  sentinel('hotaru', 'Navy waves under a hood, a white robe and a lantern.',
    {
      hair: '#2d3e75', hairShade: '#1a2550', eyes: '#ffe66d', skin: '#fdeee6',
      outfit: '#f1ecff', outfitShade: '#cbbff0', accent: '#ffe66d', halo: '#fff59d', weapon: '#ffd93d',
    },
    {
      hairStyle: 'wavy', bangs: 'split', accessory: 'hood', outfit: 'robe', weapon: 'lantern',
      halo: 'ring', eyeStyle: 'round', expression: 'calm',
    }),
  sentinel('chika', 'Brown bob, goggles and a yellow jumpsuit.',
    {
      hair: '#8d6e63', hairShade: '#5d4037', eyes: '#ffb300', skin: '#ffe5d4',
      outfit: '#ffb703', outfitShade: '#e09400', accent: '#264653', halo: '#ffd166', weapon: '#adb5bd',
    },
    {
      hairStyle: 'bob', bangs: 'messy', accessory: 'goggles', outfit: 'jumpsuit', weapon: 'wrench',
      halo: 'gear', eyeStyle: 'sparkle', expression: 'smile',
    }),
];

/** Every skin: one generated default row per unit (roster order), then the extra outfits. */
export const SKINS = [...UNITS.map(defaultRow), ...SENTINEL_SKINS];

/** id -> SkinDef */
export const SKIN_MAP = Object.fromEntries(SKINS.map((s) => [s.id, s]));

const BY_UNIT = {};
for (const s of SKINS) (BY_UNIT[s.unitId] ||= []).push(s);
for (const list of Object.values(BY_UNIT)) list.sort((a, b) => a.order - b.order);

/**
 * Skins of one unit, default first, then by order.
 * @param {string} unitId
 * @returns {object[]} SkinDef list (empty for an unknown unit)
 */
export function skinsForUnit(unitId) {
  return BY_UNIT[unitId] ? [...BY_UNIT[unitId]] : [];
}

/**
 * Look up a skin.
 * @param {string} id e.g. 'aoi_sentinel'
 * @returns {object} SkinDef
 * @throws {Error} when the id is unknown
 */
export function getSkin(id) {
  const s = SKIN_MAP[id];
  if (!s) throw new Error(`Unknown skin: ${id}`);
  return s;
}

/**
 * The skin to show for a unit: a SkinDef, a skin id or null/undefined (default). Unknown ids and
 * skins of another unit fall back to the unit's default row; an unknown unit gets a synthetic
 * default row (asset = the unit id) so callers never have to special-case it.
 * @param {string} unitId
 * @param {object|string|null} [skin]
 * @returns {object} SkinDef
 */
export function resolveSkin(unitId, skin = null) {
  const s = typeof skin === 'string' ? SKIN_MAP[skin] : skin && typeof skin === 'object' ? SKIN_MAP[skin.id] : null;
  if (s && s.unitId === unitId) return s;
  if (UNIT_MAP[unitId]) return SKIN_MAP[defaultSkinId(unitId)];
  return { id: defaultSkinId(unitId), unitId, name: 'Default', desc: '', kind: 'default', asset: unitId, thumb: null, acquisition: { type: 'default' }, order: 0 };
}
