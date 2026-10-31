// Sensei Profile unlock tables (docs/specs/PROFILE.md §3): titles, picture frames, banners and the bio
// Quick lines. Every id matches the server's patterns; a viewer draws text and art only from these
// tables, never from a string it got from the network (except the name and the bio).
import { CHAPTERS } from './stages.js';
import { TINTS } from './lobbyArt.js';
import { TITLE_TABLE } from '../systems/profileHonors.js';
import { ALL_EVENTS } from './events/index.js';

/** Titles and frames sold in limited-event exchanges (EVENT_SPEC §3.8): owned forever once bought. */
const EVENT_COSMETICS = ALL_EVENTS.flatMap((ev) => (ev.shop || []).filter((o) => o.cosmetic)
  .map((o) => ({ ...o.cosmetic, how: `${ev.name} event exchange (${ev.window.opens.slice(0, 4)}).` })));

/** id → { text, tier: 'std'|'gold'|'prism', how } (freeplay titles + achievements that declare one). */
export const TITLES = Object.freeze({
  ...TITLE_TABLE,
  // event titles: listed and counted only for their owners (like the tag titles)
  ...Object.fromEntries(EVENT_COSMETICS.filter((c) => c.kind === 'title').map((c) => [c.id, Object.freeze({ text: c.name, tier: 'gold', how: c.how, event: true })])),
});

/** Title ids from freeplay: the milestone mark ('fpm:<tier>:matriarch') and the legacy title string. */
export const FREEPLAY_TITLES = Object.freeze({
  fp_ashwing: { tiers: ['blossom', 'tempest'], legacy: 'Ashwing Slayer' },
  fp_crimson: { tiers: ['crimson'], legacy: 'Crimson Slayer' },
});

/**
 * Picture frames. null = Default (always). `ships: false` frames have no art yet: they are never earned in this
 * build, so nothing can equip them. Ownership is never stored: src/systems/profileTrophies.js earnedFrames derives it
 * from what the save already keeps (claims, medals, counters, units), so every frame is granted retroactively and
 * an older build that never heard of a frame keeps what it is earned from.
 *   group   the picker's group: academy | freeplay | legend | secret | event
 *   ach     the achievement whose claim grants it (secret frames: a secret achievement's reward)
 *   secret  shows "???" and the hint until owned
 *   event   a limited-event frame (an exchange frame: listed only for its owners; `stage` frames: listed while the
 *           event runs, then only for their owners)
 */
export const FRAMES = Object.freeze({
  ur: { name: 'UR Rainbow', how: 'Fully awaken an SSR student (UR).', ships: true, group: 'academy' },
  eclipse: { name: 'Eclipse', how: 'Defeat the Eclipse Wyrm in Freeplay.', ships: true, group: 'freeplay' },
  // Cosmetics 2 (Oct 30): achievement, Freeplay, LR, secret and event frames
  sakura: { name: 'Sakura', how: 'Earn Sakura medals on 10 campaign stages.', ships: true, group: 'academy' },
  laurel: { name: 'Laurel', how: 'Earn Gold medals on 40 campaign stages.', ships: true, group: 'academy' },
  rosette: { name: 'Rosette', how: 'Earn all 20 mode ribbons on one campaign stage.', ships: true, group: 'academy' },
  knot: { name: 'Friendship Knot', how: 'Win 50 co-op battles.', ships: true, group: 'academy' },
  chalkboard: { name: 'Chalkboard', how: 'Clear Grade 12 in Tryout Day.', ships: true, group: 'academy' },
  tide: { name: 'Hundred Waves', how: 'Reach wave 100 in any Freeplay.', ships: true, group: 'freeplay' },
  endless: { name: 'Endless Tide', how: 'Reach wave 300 in any Freeplay.', ships: true, group: 'freeplay' },
  limit: { name: 'Limit Break', how: 'Limit Break an LR girl (clear her trial).', ships: true, group: 'legend' },
  twin_legends: { name: 'Twin Legends', how: 'Limit Break two LR girls.', ships: true, group: 'legend' },
  first_petal: { name: 'First Petal', how: 'Secret: Where It All Began.', hint: 'Go back to the very first stage…', ships: true, group: 'secret', ach: 'a_first_petals', secret: true },
  window_seat: { name: 'Window Seat', how: 'Secret: Room with a View.', hint: 'The lobby could use a new look…', ships: true, group: 'secret', ach: 'a_room_view', secret: true },
  lantern_night: { name: 'Lantern Night', how: 'Calm the Gourdlight Golem on Nightmare (Halloween 2026 event).', ships: true, group: 'event', event: true, stage: { id: 'ev-halloween-boss', difficulty: 'nightmare', eventId: 'halloween-2026' } },
  ...Object.fromEntries(EVENT_COSMETICS.filter((c) => c.kind === 'frame').map((c) => [c.id, { name: c.name, how: c.how, ships: true, event: true, group: 'event' }])),
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
