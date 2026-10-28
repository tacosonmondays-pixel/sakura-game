// Tryout Day (docs/specs/TRYOUT_DAY.md §5, §8.1, §12): New Run (the seed, Before Class's draft, the frozen
// account stats) and the run's own save slot (profile.tryoutRun, outside the battle saves' 5-save cap).
// Pure: no DOM, no storage (the store persists the profile).
import { TRYOUT, TRYOUT_STUDENTS, FREE_HEROES, tryoutTableVersion } from '../data/tryout.js';
import { UNIT_MAP } from '../data/units.js';
import { isOwned, isStageCleared } from './unlocks.js';
import { unitBattleStats } from './progression.js';
import { mapChoices, TRYOUT_GRADES } from '../sim/tryout/plan.js';
import { draftOf } from '../sim/tryout/draft.js';

/** The campaign stage that opens the mode (Spring Term). */
export const TRYOUT_UNLOCK = TRYOUT.windows.spring.unlock;

export function tryoutUnlocked(profile) {
  return isStageCleared(profile, TRYOUT_UNLOCK);
}

export { TRYOUT_GRADES };

/** The highest Grade cleared (0: none). */
export function gradeCleared(profile) {
  return profile?.tryoutGrade || 0;
}

/**
 * Is Grade g open (§7): the ladder (Grade g - 1 cleared) and its content window's campaign stage.
 * @returns {{ open: boolean, why: string|null }} why: 'ladder' | 'window' | 'build'
 */
export function gradeOpen(profile, g) {
  if (!TRYOUT.grades[g] || g > TRYOUT_GRADES) return { open: false, why: 'build' };
  if (g > 1 && gradeCleared(profile) < g - 1) return { open: false, why: 'ladder' };
  if (!isStageCleared(profile, TRYOUT.windows[TRYOUT.grades[g].window].unlock)) return { open: false, why: 'window' };
  return { open: true, why: null };
}

/** A won run (not practice) clears its Grade. @returns {boolean} a new Grade opened */
export function recordGradeClear(profile, grade) {
  if (!Number.isInteger(grade) || grade <= gradeCleared(profile)) return false;
  profile.tryoutGrade = Math.min(12, grade);
  return true;
}

/** A fresh run seed (the UI may use the clock here, never inside the Sim). */
export function newRunSeed(now = Date.now(), rand = Math.random) {
  return ((Math.floor(now) ^ Math.floor(rand() * 0x7fffffff)) >>> 0) || 1;
}

export { draftOf };

/** The frozen account stats of every student the player owns (taken at New Run, §12.1). */
export function frozenPool(profile) {
  const pool = {};
  for (const id of TRYOUT_STUDENTS) if (UNIT_MAP[id] && isOwned(profile, id)) pool[id] = unitBattleStats(profile, id);
  return pool;
}

/** Heroes the player may bring: their own, and Hikari and Nami for everyone. */
export function heroChoices(profile) {
  return Object.values(UNIT_MAP).filter((u) => u.kind === 'hero' && (isOwned(profile, u.id) || FREE_HEROES.includes(u.id))).map((u) => u.id);
}

/** A hero's frozen stats: her account stats when owned; an unowned free hero plays at the floor. */
export function heroEntry(profile, id) {
  if (!id || !UNIT_MAP[id]) return null;
  return { unitId: id, stats: isOwned(profile, id) ? unitBattleStats(profile, id) : {} };
}

/** Before Class's choices for a seed: the two maps and the draft. */
export function beforeClass(profile, seed, grade = 1, redraw = 0) {
  return { seed, grade, maps: mapChoices(seed, grade), draft: draftOf((id) => isOwned(profile, id), seed, 0, redraw), heroes: heroChoices(profile) };
}

// ---------------------------------------------------------------------------
// The run's save slot (§12)
// ---------------------------------------------------------------------------

/**
 * A New Run's record: the run config, the frozen pool, the squad, the guards; the battle snapshot comes later
 * (src/ui/battle/tryoutSaver.js).
 */
export function newRunRecord(profile, { seed, grade = 1, length = 'half', mapId, hero, squad, now = Date.now(), simId = null }) {
  return {
    v: 1,
    id: `ty-${Math.floor(now).toString(36)}-${(seed >>> 0).toString(36)}`,
    seed: seed >>> 0,
    grade,
    length,
    mapId,
    tableVersion: tryoutTableVersion(),
    simId,
    hero: heroEntry(profile, hero),
    pool: frozenPool(profile),
    squad: squad.slice(0, TRYOUT.squad.start),
    period: 1,
    snap: null,
    wave: 0,
    waveOpen: null,
    resumes: 0,
    makeUpUsed: false,
    practice: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function getTryoutRun(profile) {
  const r = profile?.tryoutRun;
  return r && typeof r === 'object' && typeof r.id === 'string' ? r : null;
}

export function putTryoutRun(profile, rec) {
  profile.tryoutRun = rec;
}

export function clearTryoutRun(profile, id = null) {
  const r = getTryoutRun(profile);
  if (!r || (id != null && r.id !== id)) return false;
  delete profile.tryoutRun;
  return true;
}

/**
 * Continue's verdict on a record (§12.3, §12.5): `stale` (another table or sim: closed), or the resume kind:
 * `calm` (free), `makeup` (the first mid-wave Continue spends the Make-up Test) or `practice` (a later one).
 */
export function continueKind(rec, simId = null) {
  if (!rec) return null;
  if (rec.tableVersion !== tryoutTableVersion() || (simId && rec.simId && rec.simId !== simId)) return 'stale';
  if (rec.waveOpen == null) return 'calm';
  return rec.makeUpUsed ? 'practice' : 'makeup';
}

/** Applies a mid-wave Continue to the record before the battle restarts (§12.3): written first, so a second quit cannot reset it. */
export function markResume(rec) {
  const kind = continueKind(rec);
  if (kind === 'makeup') {
    rec.makeUpUsed = true;
    rec.resumes++;
    rec.voidPeriod = true;
  } else if (kind === 'practice') {
    rec.resumes++;
    rec.practice = true;
    rec.voidPeriod = true;
  }
  return kind;
}
