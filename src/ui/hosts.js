// Who hosts which hub and list screen (docs/specs/UI_DIRECTION.md §5.10 E1; owner decisions #69, #108; the
// defaults of notes Q1/Q2/Q4). Pure: no DOM, no store.
//
// Hosts are students in uniform with finished art: never an adult hero, never a girl whose art is still a
// placeholder. The one exception is Missions, which keeps whichever secretary the player picked. A host the rules
// turn away falls back to the secretary when she may host, else to FALLBACK_HOST (the default secretary of a new
// save is Hikari, an adult hero). She hosts her room whether or not the player owns her (Q2).
import { UNIT_MAP } from '../data/units.js';
import { secretaryOf } from './lobby/secretaryOf.js';

/** Screen → host: a unit id, 'secretary' (the lobby secretary) or 'guest' (this week's double-drop guest). */
export const HOSTS = Object.freeze({
  missions: 'secretary',
  commissions: 'miko',
  login: 'miko', // the Commissions Login tab (Attendance)
  bounty: 'guest',
  assault: 'rei',
  titans: 'kaede',
  mall: 'midori',
  mail: 'hotaru', // the Mailroom
  happening: 'suzu', // Happening Now (#/rewards)
  multiplayer: 'momo', // owner #108
  tryout: 'wakaba', // Tryout Day (#/tryout): the track team manager runs the tryouts (TRYOUT_DAY.md §13.2)
});

/**
 * Girls whose art is still coming-soon art (src/art/portraits.js): never hosts until it is drawn. Empty today: since
 * v0.1.47 the seven academy girls (Azami, Kinu, Wakaba, Yuzuha, Ouka, Chigusa, Marumi) have their real portraits and
 * their clean full-body stands, so they host like everyone else. A future girl who ships before her art goes here.
 */
export const PLACEHOLDER_ART = Object.freeze(new Set([]));

/** A student in uniform with finished art. */
export function canHost(unitOrId) {
  const u = typeof unitOrId === 'string' ? UNIT_MAP[unitOrId] : unitOrId;
  return !!u && !u.adult && u.kind !== 'hero' && !PLACEHOLDER_ART.has(u.id);
}

/** The student who hosts when the screen's host and the secretary are both turned away (Commissions' Miko). */
export const FALLBACK_HOST = 'miko';

/**
 * The host of `screen` (a unit id). Missions: the secretary, whoever she is. Unknown screens and turned-away hosts
 * get the secretary if she may host (canHost), else FALLBACK_HOST: never an adult hero.
 * @param {string} screen a HOSTS key
 * @param {object} profile the save (for the secretary)
 * @param {{ guest?: string|null }} [ctx] guest: this week's double-drop guest (lobby/notice.js ARENA_GUEST[arena])
 */
export function hostFor(screen, profile, ctx = {}) {
  const secretary = secretaryOf(profile);
  const who = HOSTS[screen];
  if (who === 'secretary') return secretary;
  const id = who === 'guest' ? ctx?.guest : who;
  if (id && canHost(id)) return id;
  return canHost(secretary) ? secretary : FALLBACK_HOST;
}
