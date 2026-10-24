// Lobby backgrounds (owner: "make it so you can select which backgrounds you want, eventually
// when you date a girl and gift her stuff in the city like in [a reference game] you'll get a more
// intimate background"). The "memorial lobby" model: every background belongs to one
// girl, choosing it makes her the secretary. Two categories (owner, Oct 23: "There are two categories, like the
// character with the castle backdrop as a default and everyone will have a full illustration alt"):
//   backdrop  kind stand: her drawn cut-out (public/art/portraits/<id>-cut.webp) over the painted academy,
//             in a time-of-day tint (day / sunset / night), with her speech bubble. Every girl has the three, and
//             her day stand is her default.
//   full      kind full: a full illustration (src/data/lobbyIllustrations.js, the one table) that IS the whole
//             lobby: no stand, no speech bubble ("you dont need the speech bubbles for these full illustration
//             ones"), no academy behind it.
//             kind bond: a warm, wholesome date memory (café, festival night, sunset walk, study session…)
//             unlocked by her bond level — the future City dating / gift system raises
//             profile.bond[id]. Their art is not painted yet: the picker shows a soft silhouette,
//             a lock and the requirement. Painted, they are full illustrations too.
// Content rule: the academy girls are students — bond scenes are cosy date moments, never
// suggestive.
//
// Plain data + pure helpers (no DOM). Profile fields: profile.lobbyBg { [girlId]: bgId } and
// profile.bond { [girlId]: 0..BOND_MAX } (src/systems/save.js).

import { UNITS, UNIT_MAP } from './units.js';
import { fullIllustrationsOf, fullArt, illustrationUrl, FULL_ILLUSTRATION_MAP } from './lobbyIllustrations.js';
import { portraitUrl } from '../art/portraits.js';

function baseUrl() {
  let base = './';
  try {
    base = import.meta.env?.BASE_URL ?? './';
  } catch {
    base = './';
  }
  return String(base).replace(/\/?$/, '/');
}

/** Folder of the lobby art (with the deploy base). */
export const LOBBY_ART_BASE = `${baseUrl()}art/lobby/`;
/** @returns {string} URL of a file in public/art/lobby/ */
export function lobbyArtUrl(file) {
  return `${LOBBY_ART_BASE}${file}`;
}

/**
 * URL of one of a background's pictures: a full illustration's own file (lobbyIllustrations.js), else the academy
 * backdrop in public/art/lobby/.
 * @param {object} bg background def
 * @param {'file'|'thumb'} [key] 'thumb' falls back to the file
 */
export function bgArtUrl(bg, key = 'file') {
  const row = bg?.kind === 'full' ? FULL_ILLUSTRATION_MAP[bg.id] : null;
  if (row) return illustrationUrl(row, key);
  return lobbyArtUrl((key === 'thumb' && bg?.thumb) || bg?.file || BACKDROP.file);
}

/** The picker's two groups, in order (bgPicker.js). */
export const BG_CATEGORIES = Object.freeze([
  Object.freeze({ id: 'backdrop', name: 'Backdrops' }),
  Object.freeze({ id: 'full', name: 'Full illustrations' }),
]);

/** @returns {'backdrop'|'full'} a background's picker group (bond memories are future full illustrations) */
export function categoryOf(bg) {
  return bg?.kind === 'stand' ? 'backdrop' : 'full';
}

/** @returns {'full'|'stand'|'bond'} how the lobby stage draws a background (a bond memory is never selectable yet) */
export function stageModeOf(bg) {
  if (bg?.kind === 'full' && FULL_ILLUSTRATION_MAP[bg.id]) return 'full';
  return bg?.kind === 'bond' ? 'bond' : 'stand';
}

/** @returns {boolean} the lobby shows her speech bubble over this background (only her stand on a backdrop) */
export function showsBubble(bg) {
  return stageModeOf(bg) !== 'full';
}

/**
 * The pictures the lobby stage loads for a background (the title preloads them): a full illustration's one picture
 * (her 3:4 full art on a portrait screen when the row says so), or the academy backdrop + her stand.
 * @param {object} bg background def
 * @param {{ portrait?: boolean }} [opts]
 * @returns {string[]}
 */
export function stageArtUrls(bg, { portrait = false } = {}) {
  if (stageModeOf(bg) === 'full') {
    const art = fullArt(bg.id, { portrait });
    if (art) return [art.src];
  }
  return [lobbyArtUrl(bg?.file || BACKDROP.file), portraitUrl(bg?.girl, 'cut')].filter(Boolean);
}

/** Highest bond (affection) level. */
export const BOND_MAX = 10;

/** The painted academy behind every stand; tints are CSS overlays (src/ui/lobby/artStage.js). */
export const BACKDROP = { file: 'academy.webp', thumb: 'thumbs/academy.webp' };
export const TINTS = {
  day: { name: 'Academy Courtyard', desc: 'Sunny morning at the academy gates.' },
  sunset: { name: 'Courtyard at Sunset', desc: 'Golden hour after classes.' },
  night: { name: 'Courtyard by Night', desc: 'Lanterns and stars over the academy.' },
};

/** Bond memories: wholesome date moments only. */
export const BOND_THEMES = {
  cafe: { name: 'Café Date', desc: 'Sharing a strawberry parfait at the Sakura Street café.' },
  festival: { name: 'Festival Night', desc: 'Yukata, lanterns and goldfish scooping at the summer festival.' },
  sunset: { name: 'Sunset Walk', desc: 'A slow walk home along the harbour at sunset.' },
  study: { name: 'Study Session', desc: 'Late-afternoon homework in the library, side by side.' },
  picnic: { name: 'Sakura Picnic', desc: 'Bento under the cherry blossoms in the academy park.' },
  stargazing: { name: 'Stargazing', desc: 'Counting stars on the observatory roof with hot cocoa.' },
  aquarium: { name: 'Aquarium Visit', desc: 'Watching the jellyfish glow at the city aquarium.' },
};

/** Two bond memories per girl: [bond 5, bond 10]. */
const BOND_PAIRS = {
  hikari: ['sunset', 'festival'],
  luna: ['stargazing', 'cafe'],
  nami: ['aquarium', 'sunset'],
  aoi: ['picnic', 'festival'],
  rei: ['study', 'cafe'],
  yuki: ['cafe', 'stargazing'],
  momo: ['cafe', 'festival'],
  akane: ['festival', 'sunset'],
  sango: ['aquarium', 'sunset'],
  kage: ['stargazing', 'festival'],
  umeko: ['picnic', 'aquarium'],
  shiro: ['study', 'stargazing'],
  midori: ['study', 'picnic'],
  suzu: ['festival', 'cafe'],
  raika: ['stargazing', 'festival'],
  miko: ['festival', 'picnic'],
  hotaru: ['festival', 'stargazing'],
  kaede: ['sunset', 'cafe'],
  chika: ['study', 'festival'],
  // the returning girls (roster wave): stands over the academy like everyone else, no new scenes
  kanna: ['festival', 'sunset'],
  yoriko: ['cafe', 'stargazing'],
  seiran: ['stargazing', 'sunset'],
  fuu: ['picnic', 'festival'],
  hana: ['picnic', 'sunset'],
  ruri: ['study', 'stargazing'],
  noa: ['cafe', 'picnic'],
  iroha: ['aquarium', 'study'],
  ena: ['stargazing', 'cafe'],
};
export const BOND_LEVELS = [5, 10];

function buildBackgrounds() {
  const out = [];
  for (const u of UNITS) {
    // Backdrops: her stand over the academy, three tints (the day one is her default)
    for (const [tint, t] of Object.entries(TINTS)) {
      out.push({ id: `${u.id}-${tint}`, girl: u.id, kind: 'stand', tint, name: t.name, desc: t.desc, file: BACKDROP.file, thumb: BACKDROP.thumb, unlock: { type: 'owned' } });
    }
    // Full illustrations: her painted ones (the table), then her bond memories (not painted yet)
    for (const row of fullIllustrationsOf(u.id)) {
      out.push({ id: row.id, girl: u.id, kind: 'full', name: `${u.name}: ${row.title}`, title: row.title, desc: row.desc, file: row.file, thumb: row.thumb, unlock: { type: 'owned' } });
    }
    const pair = BOND_PAIRS[u.id] || ['cafe', 'festival'];
    pair.forEach((theme, i) => {
      out.push({ id: `${u.id}-bond-${theme}`, girl: u.id, kind: 'bond', theme, name: BOND_THEMES[theme].name, desc: BOND_THEMES[theme].desc, unlock: { type: 'bond', level: BOND_LEVELS[i] } });
    });
  }
  return out;
}

/** Every lobby background, grouped by girl in roster order. */
export const LOBBY_BACKGROUNDS = buildBackgrounds();
export const LOBBY_BG_MAP = Object.fromEntries(LOBBY_BACKGROUNDS.map((b) => [b.id, b]));

/** @returns {object[]} the backgrounds of one girl (her 3 stands, her full illustrations, then bond memories) */
export function lobbyBackgrounds(girlId) {
  return LOBBY_BACKGROUNDS.filter((b) => b.girl === girlId);
}

/**
 * One girl's backgrounds in the picker's groups (BG_CATEGORIES order).
 * @returns {{ id: 'backdrop'|'full', name: string, items: object[] }[]}
 */
export function lobbyBackgroundGroups(girlId) {
  const list = lobbyBackgrounds(girlId);
  return BG_CATEGORIES.map((c) => ({ ...c, items: list.filter((b) => categoryOf(b) === c.id) }));
}

/** @returns {number} bond level 0..BOND_MAX (0 until the City dating system exists) */
export function bondLevel(profile, girlId) {
  const n = Math.floor(Number(profile?.bond?.[girlId]) || 0);
  return Math.max(0, Math.min(BOND_MAX, n));
}

/** @returns {boolean} the profile may use this background */
export function isBackgroundUnlocked(profile, bgOrId) {
  const bg = typeof bgOrId === 'string' ? LOBBY_BG_MAP[bgOrId] : bgOrId;
  if (!bg) return false;
  const owned = !!profile?.units?.[bg.girl];
  if (bg.unlock.type === 'default') return true;
  if (bg.unlock.type === 'owned') return owned;
  if (bg.unlock.type === 'bond') return owned && bondLevel(profile, bg.girl) >= bg.unlock.level;
  return false;
}

/** @returns {boolean} its illustration exists (bond memories are not painted yet) */
export function hasArt(bgOrId) {
  const bg = typeof bgOrId === 'string' ? LOBBY_BG_MAP[bgOrId] : bgOrId;
  return !!bg?.file;
}

/** @returns {boolean} unlocked and painted: the lobby can show it */
export function isBackgroundSelectable(profile, bgOrId) {
  return hasArt(bgOrId) && isBackgroundUnlocked(profile, bgOrId);
}

/** Player-facing requirement for a locked background. */
export function unlockText(bgOrId, profile = null) {
  const bg = typeof bgOrId === 'string' ? LOBBY_BG_MAP[bgOrId] : bgOrId;
  if (!bg) return '';
  const name = UNIT_MAP[bg.girl]?.name || bg.girl;
  if (bg.unlock.type === 'owned') return `Recruit ${name} to unlock`;
  if (bg.unlock.type === 'bond') {
    const have = profile ? bondLevel(profile, bg.girl) : 0;
    return `Bond Lv ${bg.unlock.level} with ${name} (now ${have}) — date her and give gifts in the City to unlock`;
  }
  return '';
}

/** Her default background, the same for every girl: her stand in the academy courtyard by day (with her bubble). */
export function defaultBackgroundFor(girlId) {
  return `${girlId}-day`;
}

/**
 * The background the lobby shows for a girl: her saved choice when it is still hers and
 * unlocked, else her default.
 * @returns {object} background def
 */
export function lobbyBackgroundFor(profile, girlId) {
  const chosen = LOBBY_BG_MAP[profile?.lobbyBg?.[girlId]];
  if (chosen && chosen.girl === girlId && isBackgroundSelectable(profile, chosen)) return chosen;
  return LOBBY_BG_MAP[defaultBackgroundFor(girlId)] || LOBBY_BACKGROUNDS[0];
}

/**
 * Pick a background: she becomes the secretary and the choice is remembered for her.
 * @returns {{ ok: boolean, error?: 'unknown'|'locked'|'noArt' }}
 */
export function chooseBackground(profile, bgId) {
  const bg = LOBBY_BG_MAP[bgId];
  if (!bg) return { ok: false, error: 'unknown' };
  if (!isBackgroundUnlocked(profile, bg)) return { ok: false, error: 'locked' };
  if (!hasArt(bg)) return { ok: false, error: 'noArt' };
  profile.lobbyBg ||= {};
  profile.lobbyBg[bg.girl] = bg.id;
  profile.secretary = bg.girl;
  return { ok: true };
}
