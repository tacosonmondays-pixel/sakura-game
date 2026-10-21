// Catch-up joins (owner: systems): free girls who join on a stage win, for a save that already
// cleared that stage before she existed. Noa joins on a 6-2 win and Hana on a 7-5 win since v0.1.39;
// a player who cleared those stages earlier would otherwise have to win them again to meet her.
//
// At app start (main.js, next to the other one-time letters) and on the lobby (after a reset or an
// import), each girl listed here who is not owned while her stage has a clear medal (any difficulty)
// joins through the same grantUnit as a stage win (her 'own:' marks, Potential and Ascension mirrors;
// achievements read the roster) and a letter says so, as the results sheet's "New student" card does
// after a win. Once settled (she joined here, or was already owned) the girl's 'join:<id>' mark in
// missions.counters stays at 1: every build keeps counters word for word (numbers only), so a reload,
// an older v0.1.38 / v0.1.39 tab that loads and saves the save, or a later loss of the girl never
// brings a second grant or a second letter. A girl never joins twice: an owned girl is never granted
// (no duplicate, no Essence), and a save that has not cleared her stage keeps no mark, so the stage win
// grants her as usual. Pure functions on the profile; nothing here touches the sim or is co-op hashed.

import { UNIT_MAP } from '../data/units.js';
import { STAGES } from '../data/stages.js';
import { grantUnit, isOwned, isStageCleared } from './unlocks.js';
import { deliverMail } from './mail.js';

/** missions.counters mark: 'join:<id>' = 1 once that girl's catch-up is settled. */
export const JOIN_PREFIX = 'join:';
/** Free girls added after their stage could already be cleared (v0.1.39). */
export const CATCH_UP_UNITS = Object.freeze(['noa', 'hana']);

/** The stage whose win grants her (its `unlocks.units` lists her), or null. */
export function joinStageOf(unitId) {
  return STAGES.find((s) => (s.unlocks?.units || []).includes(unitId)) || null;
}

/** Her letter's id (the Mailbox never delivers an id twice). */
export const joinLetterId = (unitId) => `joined-${unitId}-1`;

/** The letter that tells her arrival ("Noa joined your academy!"). No rewards: she is the reward. */
export function joinLetter(unitId) {
  const def = UNIT_MAP[unitId];
  const stage = joinStageOf(unitId);
  if (!def || !stage) return null;
  return {
    id: joinLetterId(unitId),
    from: 'Sakura Academy Staff',
    title: `${def.name} joined your academy!`,
    body: `${def.name}, ${def.title}, joins after stage ${stage.id}${stage.name ? ` (${stage.name})` : ''}. `
      + `You had already cleared it, so she didn't wait for another win: she is in your Students now, `
      + 'ready for your formation.',
    rewards: [],
    expiresAt: null,
  };
}

/**
 * Settle every catch-up girl once (call on app start and on the lobby). Idempotent: a girl whose
 * 'join:' mark is set is never looked at again.
 * @param {object} profile
 * @param {number} [now]
 * @returns {string[]} the girls who joined on this call (in CATCH_UP_UNITS order)
 */
export function ensureCatchUpJoins(profile, now = Date.now()) {
  const joined = [];
  if (!profile?.units) return joined;
  const counters = ((profile.missions ||= {}).counters ||= {});
  for (const id of CATCH_UP_UNITS) {
    const key = JOIN_PREFIX + id;
    if (counters[key] > 0 || !UNIT_MAP[id]) continue;
    if (isOwned(profile, id)) {
      counters[key] = 1; // joined the usual way (a stage win, a recruit): nothing to catch up
      continue;
    }
    const stage = joinStageOf(id);
    if (!stage || !isStageCleared(profile, stage.id)) continue; // her stage win will grant her
    grantUnit(profile, id, now);
    counters[key] = 1;
    const letter = joinLetter(id);
    if (letter) deliverMail(profile, letter, now);
    joined.push(id);
  }
  return joined;
}
