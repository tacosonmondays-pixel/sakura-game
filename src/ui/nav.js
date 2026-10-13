// Where the top-left back arrow leads (owner: "the back arrow where it says Clan takes you back to
// the battle … shouldn't it take you back home?"). Pure data + helpers: src/ui/router.js applies
// them to its mirror of the browser history.
import { STAGE_MAP } from '../data/stages.js';

/**
 * Routes that are never gone back to: a battle that was left (finished, quit, or backed out of)
 * is over. Leaving one replaces its history entry (router.navigate).
 */
export const TRANSIENT_ROUTES = new Set(['battle']);

/** @param {string} name */
export function isTransient(name) {
  return TRANSIENT_ROUTES.has(name);
}

/**
 * Screens with a fixed place in the menus: the arrow always goes to this parent, wherever the
 * screen was opened from. A route name, or (params) => route name.
 */
const PARENTS = {
  missions: 'lobby',
  clan: 'lobby',
  campaign: 'missions',
  bounty: 'missions',
  assault: 'missions',
  challenge: 'missions',
  commissions: 'missions',
  coop: (p) => (p.id ? 'coop' : 'missions'), // a room → the co-op hub → Missions
};

/** Every other screen goes back to the screen it was opened from, or (unknown) to this one. */
const FALLBACK = { student: 'students', soundtest: 'settings' };

/** The screen a stage's "Map" button and back arrow lead to (campaign chapter / Bounty / …). */
export function mapRouteFor(stage) {
  switch (stage?.kind) {
    case 'resource': return { name: 'bounty', params: {} };
    case 'boss': return { name: 'assault', params: {} };
    case 'challenge': return { name: 'challenge', params: {} };
    default: return { name: 'campaign', params: stage?.chapter != null ? { chapter: String(stage.chapter) } : {} };
  }
}

const route = (name) => ({ name, params: {} });

/**
 * The screen the top-left back arrow opens. Never a battle.
 * @param {string} name   the screen the arrow is on
 * @param {object} params its route params
 * @param {{name: string, params: object}|null} prev  the screen below it in the history (the
 *   router passes the nearest one that is not a battle), or null when unknown
 * @returns {{name: string, params: object}}
 */
export function parentRoute(name, params = {}, prev = null) {
  const from = prev && !isTransient(prev.name) ? prev : null;
  if (name === 'stage') {
    // stage prep: back where it was opened from (the map, a Bounty arena, Missions' quick start,
    // a Teleport) … unless that was another stage (Next Stage) or nothing: then the stage's map
    if (from && from.name !== 'stage') return from;
    if (params.endless === '1' || params.endless === 1 || params.endless === true) return route('challenge');
    return mapRouteFor(STAGE_MAP[params.id]);
  }
  const fixed = PARENTS[name];
  if (fixed) return route(typeof fixed === 'function' ? fixed(params) : fixed);
  return from || route(FALLBACK[name] || 'lobby');
}

/** Same screen (route name + id), whatever its other params (tab, chapter, …). */
export function sameScreen(a, b) {
  return !!a && !!b && a.name === b.name && String(a.params?.id ?? '') === String(b.params?.id ?? '');
}
