// Lobby backgrounds (owner: "make it so you can select which backgrounds you want, eventually
// when you date a girl and gift her stuff in the city like in blue archive you'll get a more
// intimate background"). Blue Archive "memorial lobby" model: every background belongs to one
// girl, choosing it makes her the secretary. Kinds:
//   scene  a full landscape illustration with her in it (public/art/lobby/<id>.webp)
//   stand  her drawn cut-out (public/art/portraits/<id>-cut.webp) over the painted academy,
//          in a time-of-day tint (day / sunset / night)
//   bond   a warm, wholesome date memory (café, festival night, sunset walk, study session…)
//          unlocked by her bond level — the future City dating / gift system raises
//          profile.bond[id]. Their art is not painted yet: the picker shows a soft silhouette,
//          a lock and the requirement.
// Content rule: the academy girls are students — bond scenes are cosy date moments, never
// suggestive.
//
// Plain data + pure helpers (no DOM). Profile fields: profile.lobbyBg { [girlId]: bgId } and
// profile.bond { [girlId]: 0..BOND_MAX } (src/systems/save.js).

import { UNITS, UNIT_MAP } from './units.js';

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

/** Highest bond (affection) level. */
export const BOND_MAX = 10;

/** The painted academy behind every stand; tints are CSS overlays (src/ui/lobby/artStage.js). */
export const BACKDROP = { file: 'academy.webp', thumb: 'thumbs/academy.webp' };
export const TINTS = {
  day: { name: 'Academy Courtyard', desc: 'Sunny morning at the academy gates.' },
  sunset: { name: 'Courtyard at Sunset', desc: 'Golden hour after classes.' },
  night: { name: 'Courtyard by Night', desc: 'Lanterns and stars over the academy.' },
};

/** Girls with a full landscape illustration. face = [x%, y%] of her face (bubble + head pats). */
const SCENES = {
  hikari: { id: 'hikari-rampart', name: 'Rampart at Dawn', file: 'hikari.webp', thumb: 'thumbs/hikari.webp', face: [62, 26], desc: 'Her sword raised over the academy walls.' },
  aoi: { id: 'aoi-archery', name: 'Archery Range', file: 'aoi.webp', thumb: 'thumbs/aoi.webp', face: [66, 30], desc: 'Morning practice among the training targets.' },
  sango: { id: 'sango-harbour', name: 'Harbour Festival', file: 'sango.webp', thumb: 'thumbs/sango.webp', face: [57, 30], desc: 'Waving from the pier as the ships come in.' },
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
};
export const BOND_LEVELS = [5, 10];

function buildBackgrounds() {
  const out = [];
  for (const u of UNITS) {
    const scene = SCENES[u.id];
    if (scene) out.push({ ...scene, girl: u.id, kind: 'scene', unlock: { type: 'owned' } });
    for (const [tint, t] of Object.entries(TINTS)) {
      out.push({ id: `${u.id}-${tint}`, girl: u.id, kind: 'stand', tint, name: t.name, desc: t.desc, file: BACKDROP.file, thumb: BACKDROP.thumb, unlock: { type: 'owned' } });
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

/** @returns {object[]} the backgrounds of one girl (scene first, stands, then bond memories) */
export function lobbyBackgrounds(girlId) {
  return LOBBY_BACKGROUNDS.filter((b) => b.girl === girlId);
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

/** Her default background: her landscape scene when she has one, else her stand in the courtyard. */
export function defaultBackgroundFor(girlId) {
  return SCENES[girlId]?.id || `${girlId}-day`;
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
