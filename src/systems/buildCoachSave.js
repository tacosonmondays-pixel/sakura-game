// The Build Coach's save block (docs/specs/BUILD_COACH.md §1): profile.buildCoach = { main: unitId | null, seen: {} },
// additive (no SAVE_VERSION bump), mirrored as 'cm:<unitId>' = 1 in missions.counters so an older build that drops
// the block gives it back on the next load. Kept apart from src/systems/buildCoach.js so the save reader imports
// nothing heavy. Pure; not hashed.

export const MAIN_MARK = 'cm:';
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** The coach block of a loaded save, or null (migrateProfile): a main girl she owns; the 'cm:' mark brings it back. */
export function cleanBuildCoach(raw, p) {
  const c = p?.missions?.counters || {};
  let main = isObj(raw) && typeof raw.main === 'string' && p.units[raw.main] ? raw.main : null;
  if (!isObj(raw)) {
    const marked = Object.keys(c).find((k) => k.startsWith(MAIN_MARK) && c[k] === 1 && p.units[k.slice(MAIN_MARK.length)]);
    if (marked) main = marked.slice(MAIN_MARK.length);
    else return null;
  }
  const seen = {};
  if (isObj(raw?.seen)) for (const [k, v] of Object.entries(raw.seen).slice(0, 50)) if (/^[a-z0-9_:]{1,40}$/.test(k) && v) seen[k] = 1;
  return { main, seen };
}

/** Rewrite the 'cm:' mirror (store.js saveText, migrateProfile). */
export function writeBuildCoachMark(p) {
  const c = ((p.missions ||= {}).counters ||= {});
  for (const k of Object.keys(c)) if (k.startsWith(MAIN_MARK)) delete c[k];
  const main = p.buildCoach?.main;
  if (main && p.units?.[main]) c[MAIN_MARK + main] = 1;
}

/** The main girl's id (null: none set, or she is no longer owned). */
export const mainGirl = (p) => (p?.buildCoach?.main && p.units?.[p.buildCoach.main] ? p.buildCoach.main : null);

/** Set as Main: one girl at a time (a second tap on another girl moves the title). */
export function setMain(p, unitId) {
  if (!p.units[unitId]) return false;
  p.buildCoach = { seen: {}, ...(p.buildCoach || {}), main: unitId };
  writeBuildCoachMark(p);
  return true;
}

/** Clear Main. */
export function clearMain(p) {
  if (!p.buildCoach) return false;
  p.buildCoach.main = null;
  writeBuildCoachMark(p);
  return true;
}

