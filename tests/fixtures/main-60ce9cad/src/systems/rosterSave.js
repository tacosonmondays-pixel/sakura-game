// VENDORED from origin/main 60ce9cad:src/systems/rosterSave.js for the gear update's old-build round trips (GEAR_UPDATE.md §13).
// Imports of files that are not vendored point at the live tree. Do not edit: regenerate with git show.
// Roster safety: the mirror that brings back a girl an older build does not know (owner: systems).
//
// An older build's migrateProfile keeps only the unit ids it knows. When it loads and saves a save that
// holds a girl added after it (the nine returning girls of v0.1.40 for a v0.1.38 or v0.1.39 tab, a
// cached build, any later wave), it leaves her out (the load is flagged 'lossy'), unequips the gear she
// wore and drops her bond entry. Every build keeps `missions.counters` word for word (numbers only),
// so each owned girl has a copy there:
//   own:<id>         level × 1000 + gates × 10 + awaken stars (67072 = level 67, gates 7, ★2); an
//                    owned girl's mark is always ≥ 1000
//   own:<id>:<slot>  n of the piece she wears in that slot (gear uid 'g<n>'); absent when the slot is empty
// Written at every grant, level-up, gate, star and equip (writeRosterMark), and for every girl at every
// load and every write (writeRosterMarks: migrateProfile, store.js saveText), as the gear marks are.
// migrateProfile recreates a known girl who has an 'own:' mark but is missing from the save (rosterMark,
// before gear consistency and creditPotential), and the mirrors already there bring back the rest:
// 'pot:' her duplicates (and so her Essence), 'pl:' her bought Potential, 'bt:' gates above 5,
// 'lv:' / 'lvA:' a level above 60, the gear marks her UR pieces; the pieces she wore go back on when they
// are still in the bag and nobody else wears them. Not kept: the EXP inside her level (as the level
// shadows), her favourite flag and her place in the formation or as secretary. A girl still in the save
// is never touched by her mark (an older build cannot change a girl it does not know).
//
// Pure functions on the profile; nothing here is co-op hashed.

import { GEAR_SLOTS } from '../../../../../src/data/types.js';

export const OWN_PREFIX = 'own:';
const SLOTS = Object.keys(GEAR_SLOTS);
/** The lowest mark of an owned girl (level 1, no gates, no stars). */
export const OWNED_MIN = 1000;

const whole = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const counters = (profile) => ((profile.missions ||= {}).counters ||= {});
const slotKey = (unitId, slot) => `${OWN_PREFIX}${unitId}:${slot}`;

/** The number in a gear uid 'g<n>' (0 for any other uid or none). */
function gearNumber(uid) {
  const m = typeof uid === 'string' ? /^g([1-9]\d{0,14})$/.exec(uid) : null;
  return m ? Number(m[1]) : 0;
}

/** @returns {number} her 'own:' value: level × 1000 + gates × 10 + stars */
export function rosterMarkValue(unitState) {
  const level = Math.min(999, Math.max(1, whole(unitState?.level)));
  const gates = Math.min(99, whole(unitState?.breakthrough));
  const stars = Math.min(9, whole(unitState?.awaken));
  return level * 1000 + gates * 10 + stars;
}

/** Write one girl's marks (her state and the pieces she wears). Nothing for a girl not owned. */
export function writeRosterMark(profile, unitId) {
  const u = profile?.units?.[unitId];
  if (!u) return;
  const c = counters(profile);
  const v = rosterMarkValue(u);
  if (c[OWN_PREFIX + unitId] !== v) c[OWN_PREFIX + unitId] = v;
  for (const s of SLOTS) {
    const n = gearNumber(u.gear?.[s]);
    if (n) c[slotKey(unitId, s)] = n;
    else delete c[slotKey(unitId, s)];
  }
}

/** Write every owned girl's marks (every load and every write). A girl not owned keeps hers. */
export function writeRosterMarks(profile) {
  for (const id of Object.keys(profile?.units || {})) writeRosterMark(profile, id);
}

/**
 * What her mark holds, as a raw unit for save.js cleanUnit (which clamps every field): level, gates,
 * stars and the pieces she wore. No `dupes` and no `pl`: creditPotential and restoreAscension fill them
 * from 'pot:' and 'pl:'. A hostile mark gives nothing a hostile unit entry could not.
 * @param {object} counters missions.counters of the stored save
 * @param {string} unitId
 * @returns {null|{ level: number, breakthrough: number, awaken: number, gear: Object<string, string|null> }}
 */
export function rosterMark(counters, unitId) {
  const v = whole(counters?.[OWN_PREFIX + unitId]);
  if (v < OWNED_MIN) return null;
  const rest = v % 1000;
  const gear = {};
  for (const s of SLOTS) {
    const n = whole(counters[slotKey(unitId, s)]);
    gear[s] = n ? `g${n}` : null;
  }
  return { level: Math.floor(v / 1000), breakthrough: Math.floor(rest / 10), awaken: rest % 10, gear };
}
