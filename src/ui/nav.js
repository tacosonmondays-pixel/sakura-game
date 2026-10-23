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
 * Screens with a fixed place in the menus: the arrow goes to this parent, wherever the screen was
 * opened from (a chat link, a battle, the clan …) — except straight from higher up the same menus
 * (a lobby shortcut) or from a list hub (LIST_HUBS): then back there, since the player never saw
 * the screens in between. A route name, or (params) => route name.
 */
const PARENTS = {
  missions: 'lobby',
  clan: 'lobby',
  profile: (p) => (p.id ? null : 'lobby'), // [profile] yours → the lobby; someone else's → back to where it was opened
  campaign: 'missions',
  bounty: 'missions',
  assault: 'missions',
  challenge: 'missions',
  sandbox: (p) => (p.id ? 'sandbox' : 'missions'), // the squad step (#/sandbox/team) → the map step → Missions
  commissions: 'lobby', // the lobby's Tasks shortcut / dock button (not on the Missions hub)
  coop: (p) => (p.id ? 'coop' : 'missions'), // a room → the co-op hub → Missions
  // [social] a conversation (#/messages/<threadId> or /new) → the Messages list → the lobby
  messages: (p) => (p.id ? 'messages' : 'lobby'),
  // [ui-m5] the Mailroom (#/mail) has no fixed parent on purpose: it opens from the lobby, the Menu, the Notice, the
  // Journal and event pages, and its arrow goes back there (the lobby when nothing is below it)
};

/**
 * [ui-m5] List hubs: Happening Now (#/rewards), the Mall and the Mailroom. Their whole job is "Go" (a row's Go, the
 * Mall's wallet chip), so a fixed-parent screen opened from one (Bounty on the double drops, Total Assault from the
 * token wallet, the clan boss week …) comes back to it, the list as it was left (its tab), not to its menu parent.
 */
export const LIST_HUBS = new Set(['rewards', 'mall', 'mail']);

const fixedParent = (name, params = {}) => {
  const p = PARENTS[name];
  return typeof p === 'function' ? p(params) : p || null;
};

/** The screens above `name` in the menus, nearest first; the lobby is always the last. */
export function menuAncestors(name, params = {}) {
  const out = [];
  for (let n = fixedParent(name, params); n && !out.includes(n); n = fixedParent(n)) out.push(n);
  if (!out.includes('lobby')) out.push('lobby');
  return out;
}

/** Every other screen goes back to the screen it was opened from, or (unknown) to this one. */
const FALLBACK = { student: 'students', soundtest: 'settings' };

/**
 * The screen a stage's "Map" button and back arrow lead to (campaign chapter / Bounty / …). An
 * endless run on a campaign map belongs to Tactical Challenge, where endless runs are picked.
 */
export function mapRouteFor(stage, { endless = false } = {}) {
  if (endless) return { name: 'challenge', params: {} };
  switch (stage?.kind) {
    case 'resource': return { name: 'bounty', params: {} };
    case 'boss': return { name: 'assault', params: {} };
    case 'challenge': return { name: 'challenge', params: {} };
    case 'event': return { name: 'event', params: { id: stage.event, tab: 'stages' } }; // [events] back to its event page
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
    return mapRouteFor(STAGE_MAP[params.id], { endless: isEndless(params) });
  }
  const fixed = fixedParent(name, params);
  if (fixed) {
    // opened from its parent, or straight from higher up the menus (the lobby's Tasks / Bounty /
    // Total Assault shortcuts, Menu → Co-op), or from a list hub's Go: back there, the way the back gesture goes
    if (from && (sameScreen(from, route(fixed)) || (!from.params?.id && menuAncestors(fixed).includes(from.name)) || LIST_HUBS.has(from.name))) return from;
    return route(fixed);
  }
  return from || route(FALLBACK[name] || 'lobby');
}

/** Route params of an endless run (stage prep / battle: endless=1). */
export function isEndless(params = {}) {
  return params.endless === '1' || params.endless === 1 || params.endless === true || params.endless === 'true';
}

/** Same screen (route name + id), whatever its other params (tab, chapter, …). */
export function sameScreen(a, b) {
  return !!a && !!b && a.name === b.name && String(a.params?.id ?? '') === String(b.params?.id ?? '');
}
