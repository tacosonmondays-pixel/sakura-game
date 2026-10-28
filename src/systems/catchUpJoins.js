// Catch-up joins (owner: systems): free girls who join on a stage win, for a save that already
// cleared that stage before she existed. Since v0.1.39 Noa joins on a 6-2 win and Hana on a 7-5 win;
// since v0.1.40 Azami joins on a 2-2 win, Yuzuha on a 4-2 win and Wakaba on a 6-5 win (the three new
// academy girls with a stage unlock, src/data/stages.js; the other four of the seven are Recruit only).
// A player who cleared those stages earlier would otherwise have to win them again to meet her.
// Gate Arc: Yuzuha now joins on a 1-7 win (chapter 1's Act II, where the story meets her); 4-2 stays
// her legacy stage (LEGACY_JOIN_STAGES), so a save that cleared 4-2 but never met her still gets her
// once, with the letter naming the stage it cleared. Her 'join:' mark is the same one as before.
//
// At app start (main.js, next to the other one-time letters) and on the lobby (after a reset or an
// import), each girl listed here who is not owned while her stage has a clear medal (any difficulty)
// joins through the same grantUnit as a stage win (her 'own:' marks, Potential and Ascension mirrors;
// achievements read the roster) and a letter says so, as the results sheet's "New student" card does
// after a win. Several girls at once get a letter each, and main.js names them all in one lobby toast.
// Once settled (she joined here, or was already owned) the girl's 'join:<id>' mark in
// missions.counters stays at 1: every build keeps counters word for word (numbers only), so a reload,
// an older v0.1.38 / v0.1.39 tab that loads and saves the save, or a later loss of the girl never
// brings a second grant or a second letter. An older tab that does not know her (v0.1.38 for Noa and
// Hana, v0.1.39 for the v0.1.40 girls) drops her from units but keeps both marks: her 'own:' marks
// bring her back on the next load here and her 'join:' mark keeps the catch-up from granting her again.
// A girl never joins twice: an owned girl is never granted (no duplicate, no Essence), and a save that
// has not cleared her stage keeps no mark, so the stage win grants her as usual. Pure functions on the
// profile; nothing here touches the sim or is co-op hashed.

import { UNIT_MAP } from '../data/units.js';
import { STAGES } from '../data/stages.js';
import { grantUnit, isOwned, isStageCleared } from './unlocks.js';
import { deliverMail } from './mail.js';

/** missions.counters mark: 'join:<id>' = 1 once that girl's catch-up is settled. */
export const JOIN_PREFIX = 'join:';
/**
 * Free girls added after their stage could already be cleared: Noa and Hana (v0.1.39), Azami, Yuzuha
 * and Wakaba (v0.1.40). In play order of their stage (1-7, 2-2, 6-2, 6-5, 7-5: chapter, act, stage), so
 * the letters and the lobby toast name them in the order a player meets them.
 */
export const CATCH_UP_UNITS = Object.freeze(['yuzuha', 'azami', 'noa', 'wakaba', 'hana']);

/**
 * Stages that granted a girl in an earlier version, before her join moved (Gate Arc: Yuzuha joined on a
 * 4-2 win from v0.1.40; she now joins on 1-7). A clear of one of them settles her catch-up too.
 */
export const LEGACY_JOIN_STAGES = Object.freeze({ yuzuha: Object.freeze(['4-2']) });

/** The stage whose win grants her (its `unlocks.units` lists her), or null. */
export function joinStageOf(unitId) {
  return STAGES.find((s) => (s.unlocks?.units || []).includes(unitId)) || null;
}

/** The cleared stage that settles her catch-up: her join stage, else a legacy one; null when none is cleared. */
export function clearedJoinStageOf(profile, unitId) {
  const ids = [joinStageOf(unitId)?.id, ...(LEGACY_JOIN_STAGES[unitId] || [])].filter(Boolean);
  const id = ids.find((sid) => isStageCleared(profile, sid));
  return id ? STAGES.find((s) => s.id === id) || null : null;
}

/** Her letter's id (the Mailbox never delivers an id twice). */
export const joinLetterId = (unitId) => `joined-${unitId}-1`;

/**
 * The letter that tells her arrival ("Noa joined your academy!"). No rewards: she is the reward.
 * @param {string} unitId
 * @param {object} [stage] the stage the save cleared (default: her join stage)
 */
export function joinLetter(unitId, stage = joinStageOf(unitId)) {
  const def = UNIT_MAP[unitId];
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
 * The one lobby toast for the girls who just joined: every name in it, in the order given
 * ("Azami joined …", "Noa and Hana joined …", "Azami, Yuzuha and Wakaba joined …").
 * @param {string[]} unitIds
 * @returns {string} '' for an empty list
 */
export function joinToastText(unitIds) {
  const names = (unitIds || []).map((id) => UNIT_MAP[id]?.name || id);
  if (!names.length) return '';
  const who = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  return `${who} joined your academy! Details in your Mailbox.`;
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
  const via = new Map();
  if (!profile?.units) return joined;
  const counters = ((profile.missions ||= {}).counters ||= {});
  for (const id of CATCH_UP_UNITS) {
    const key = JOIN_PREFIX + id;
    if (counters[key] > 0 || !UNIT_MAP[id]) continue;
    if (isOwned(profile, id)) {
      counters[key] = 1; // joined the usual way (a stage win, a recruit): nothing to catch up
      continue;
    }
    const stage = clearedJoinStageOf(profile, id);
    if (!stage) continue; // her stage win will grant her
    grantUnit(profile, id, now);
    counters[key] = 1;
    joined.push(id);
    via.set(id, stage);
  }
  // a letter each; the Mailbox lists the newest first, so the last girl goes in first and the
  // Mailbox reads top to bottom in play order (Yuzuha, Azami, Noa, …)
  for (const id of [...joined].reverse()) {
    const letter = joinLetter(id, via.get(id));
    if (letter) deliverMail(profile, letter, now);
  }
  return joined;
}
