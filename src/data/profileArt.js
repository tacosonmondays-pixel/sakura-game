// Sensei Profile unlock tables (docs/specs/PROFILE.md §3): titles, picture frames, banners and the bio
// Quick lines. Every id matches the server's patterns; a viewer draws text and art only from these
// tables, never from a string it got from the network (except the name and the bio).
import { CHAPTERS } from './stages.js';
import { TINTS } from './lobbyArt.js';
import { TITLE_TABLE } from '../systems/profileHonors.js';

/** id → { text, tier: 'std'|'gold'|'prism', how } (freeplay titles + achievements that declare one). */
export const TITLES = TITLE_TABLE;

/** Title ids from freeplay: the milestone mark ('fpm:<tier>:matriarch') and the legacy title string. */
export const FREEPLAY_TITLES = Object.freeze({
  fp_ashwing: { tiers: ['blossom', 'tempest'], legacy: 'Ashwing Slayer' },
  fp_crimson: { tiers: ['crimson'], legacy: 'Crimson Slayer' },
});

/**
 * Picture frames. null = Default (always). `ships: false` frames have no art yet (M3 / Codex modes):
 * they are never earned in this build, so nothing can equip them.
 */
export const FRAMES = Object.freeze({
  ur: { name: 'UR Rainbow', how: 'Fully awaken an SSR student (UR).', ships: true },
  eclipse: { name: 'Eclipse', how: 'Defeat the Eclipse Wyrm in Freeplay.', ships: true },
  sakura: { name: 'Sakura', how: 'Earn Sakura medals on 10 campaign stages.', ships: false },
  laurel: { name: 'Laurel', how: 'Earn Gold medals on all 40 campaign stages.', ships: false },
  rosette: { name: 'Rosette', how: 'Earn all 20 ribbons on one stage.', ships: false },
});
export const FRAME_IDS = Object.freeze(Object.keys(FRAMES).filter((id) => FRAMES[id].ships));

/** Girls with a landscape lobby scene (public/art/lobby/<id>.webp). */
const SCENE_GIRLS = { hikari: 'Rampart at Dawn', aoi: 'Archery Range', sango: 'Harbour Festival' };

function buildBanners() {
  const out = [];
  for (const [tint, t] of Object.entries(TINTS)) {
    out.push({ id: `academy:${tint}`, kind: 'academy', tint, name: t.name, file: 'academy.webp', thumb: 'thumbs/academy.webp' });
  }
  for (const c of CHAPTERS) out.push({ id: `theme:${c.theme}`, kind: 'theme', theme: c.theme, chapter: c.id, name: c.name });
  for (const [girl, name] of Object.entries(SCENE_GIRLS)) out.push({ id: `scene:${girl}`, kind: 'scene', girl, name, file: `${girl}.webp`, thumb: `thumbs/${girl}.webp` });
  return out.map((b) => Object.freeze(b));
}

/** Banner ids: 'academy:<tint>' (free), 'theme:<chapter theme>' (clear that chapter), 'scene:<girl>' (own her). */
export const BANNERS = Object.freeze(buildBanners());
export const BANNER_MAP = Object.freeze(Object.fromEntries(BANNERS.map((b) => [b.id, b])));
export const DEFAULT_BANNER = 'academy:day';

/** Why a banner is locked (the picker shows it on the tile). */
export function bannerLockText(id) {
  const b = BANNER_MAP[id];
  if (!b) return '';
  if (b.kind === 'theme') return `Clear Chapter ${b.chapter}`;
  if (b.kind === 'scene') return 'Recruit her';
  return '';
}

/** One-tap bios (each passes bioError; tests/online/profileRules.test.js keeps it so). */
export const QUICK_LINES = Object.freeze([
  'Looking for co-op buddies!',
  'Collecting every ribbon ✦',
  'Say hi in clan chat!',
  'Nightmare grinder',
  'New Sensei, be nice ♥',
  'Freeplay forever',
]);
