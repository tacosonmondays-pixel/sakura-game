// Tryout Day (docs/specs/TRYOUT_DAY.md §5, §8.1, §10.4, §12): New Run (the seed, Before Class's draft, the frozen
// account stats, the Desk Supplies), the run's own save slot (profile.tryoutRun, outside the battle saves' 5-save
// cap), the Weekly Timetable's seed and share codes. Pure: no DOM, no storage (the store persists the profile).
import { TRYOUT, TRYOUT_STUDENTS, FREE_HEROES, tryoutTableVersion } from '../data/tryout.js';
import { TRYOUT_META, PERK_KEYS } from '../data/tryoutMeta.js';
import { UNIT_MAP } from '../data/units.js';
import { hashString } from '../core/rng.js';
import { gameWeekNumber, nextWeeklyReset } from '../core/reset.js';
import { isOwned, isStageCleared } from './unlocks.js';
import { unitBattleStats } from './progression.js';
import { recordMax } from './missions.js';
import { mapChoices, TRYOUT_GRADES } from '../sim/tryout/plan.js';
import { draftOf, BIGGER_DRAFT } from '../sim/tryout/draft.js';
import { randomPlayers } from '../sim/tryout/random.js';

const GRADE_KEY = TRYOUT_META.keys.grade;
const whole = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

/** The campaign stage that opens the mode (Spring Term). */
export const TRYOUT_UNLOCK = TRYOUT.windows.spring.unlock;

export function tryoutUnlocked(profile) {
  return isStageCleared(profile, TRYOUT_UNLOCK);
}

export { TRYOUT_GRADES };

/** Has this player cleared a Half Day (the Full Day opens then, §2.2)? */
export function halfCleared(profile) {
  return (Number(profile?.missions?.counters?.[TRYOUT_META.keys.half]) || 0) > 0;
}

/** The highest Grade cleared (0: none): profile.tryoutGrade, or its mirror 'ty:grade' an older build cannot drop. */
export function gradeCleared(profile) {
  return Math.min(12, Math.max(whole(profile?.tryoutGrade), whole(profile?.missions?.counters?.[GRADE_KEY])));
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

/**
 * May a shared code of Grade g open practice (§10.4)? Practice records nothing, so the ladder does not gate it; the
 * Grade's content window (its campaign stage) still does, checked here directly: gradeOpen answers 'ladder' before it
 * looks at the window (R2 review).
 */
export function practiceOpen(profile, g) {
  if (!TRYOUT.grades[g] || g > TRYOUT_GRADES) return false;
  return isStageCleared(profile, TRYOUT.windows[TRYOUT.grades[g].window].unlock);
}

/**
 * A won run (not practice) clears its Grade, when it was this player's own next step: a co-op win at the host's
 * Grade never skips rungs of the guest's ladder (M2 review). @returns {boolean} a new Grade opened
 */
export function recordGradeClear(profile, grade) {
  if (!Number.isInteger(grade) || grade <= gradeCleared(profile) || grade > gradeCleared(profile) + 1) return false;
  profile.tryoutGrade = Math.min(12, grade);
  recordMax(profile, GRADE_KEY, profile.tryoutGrade);
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

/**
 * Before Class's choices for a seed: the two maps and the draft (7 girls with Bigger Draft; a floor run drafts as if
 * the player owned no one, so everyone gets the same six).
 * @param {{ floor?: boolean, perks?: object }} [o]
 */
export function beforeClass(profile, seed, grade = 1, redraw = 0, { floor = false, perks = null } = {}) {
  const owned = floor ? () => false : (id) => isOwned(profile, id);
  const size = perks?.draft7 ? BIGGER_DRAFT : TRYOUT.squad.draft;
  return { seed, grade, maps: mapChoices(seed, grade), draft: draftOf(owned, seed, 0, redraw, size).slice(0, size), heroes: heroChoices(profile) };
}

// ---------------------------------------------------------------------------
// Desk Supplies (the Marble Jar's perks, §10.3): solo only, never in the Weekly
// ---------------------------------------------------------------------------

/** Owned once-only Jar items: the bit mask in missions.counters 'ty:jar' (every build keeps it). */
export function jarOwned(profile, id) {
  const it = TRYOUT_META.jar.find((x) => x.id === id);
  if (!it || !Number.isInteger(it.bit)) return false;
  return Math.floor(whole(profile?.missions?.counters?.[TRYOUT_META.keys.jar]) / 2 ** it.bit) % 2 === 1;
}

/** Is a Desk Supply switched on (owned and not switched off)? */
export function perkOn(profile, perk) {
  const it = TRYOUT_META.jar.find((x) => x.perk === perk);
  const off = profile?.tryoutMeta?.jar?.off;
  return !!it && jarOwned(profile, it.id) && !(Array.isArray(off) && off.includes(perk));
}

/** The perks a new solo run carries ({} in the Weekly). */
export function activePerks(profile, { weekly = false } = {}) {
  const out = {};
  if (weekly) return out;
  for (const k of PERK_KEYS) if (perkOn(profile, k)) out[k] = true;
  return out;
}

// ---------------------------------------------------------------------------
// The run's save slot (§12)
// ---------------------------------------------------------------------------

/**
 * A New Run's record: the run config, the frozen pool, the squad, the guards; the battle snapshot comes later
 * (src/ui/battle/tryoutSaver.js). `random`: Random Class (§20.4, never in the Weekly): the squad is the Sim's draw from
 * the player's six (`squad` is ignored), and the record keeps `random: true` for the run's Sim config.
 */
export function newRunRecord(profile, { seed, grade = 1, length = 'half', mapId, hero, squad, now = Date.now(), simId = null, weekly = null, practice = false, shared = false, perks = null, random = false }) {
  // the Weekly Timetable plays everyone at the floor: no frozen pool, the hero's own stats left out, no Desk Supplies
  const floor = Number.isInteger(weekly);
  const h = heroEntry(profile, hero);
  const rnd = random === true && !floor;
  const pool = floor ? {} : frozenPool(profile);
  return {
    v: 1,
    id: `ty-${Math.floor(now).toString(36)}-${(seed >>> 0).toString(36)}`,
    seed: seed >>> 0,
    grade,
    length,
    mapId,
    tableVersion: tryoutTableVersion(),
    simId,
    hero: floor && h ? { unitId: h.unitId, stats: {} } : h,
    pool,
    squad: rnd ? randomPlayers({ random: true, seed, pools: [pool] }, [{}])[0].squad : squad.slice(0, TRYOUT.squad.start),
    ...(rnd ? { random: true } : null),
    perks: floor ? {} : { ...(perks || activePerks(profile)) },
    ...(floor ? { weekly } : null),
    ...(shared ? { shared: true } : null),
    paidPeriods: 0,
    period: 1,
    snap: null,
    wave: 0,
    waveOpen: null,
    resumes: 0,
    makeUpUsed: false,
    practice: !!practice,
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
    // the periods banked by the last calm point stay paid (§12.4); nothing after them counts
    if (!rec.practice) rec.paidPeriods = snapPeriods(rec);
    rec.practice = true;
    rec.voidPeriod = true;
  }
  return kind;
}

/**
 * Reads one field of a generic Sim snapshot (src/sim/snapshot.js format: { v, root, o }) as plain data: objects,
 * arrays and primitives; game-data paths, rngs, Maps and Sets read as null. Never throws.
 */
export function snapField(snap, key) {
  if (!isObj(snap) || !isObj(snap.root) || !Array.isArray(snap.o)) return undefined;
  const memo = new Map();
  const val = (v, depth) => {
    if (!Array.isArray(v)) return v;
    if (typeof v[0] === 'number') return obj(v[0], depth);
    if (v[0] === 'n') return v[1] === 'inf' ? Infinity : v[1] === '-inf' ? -Infinity : v[1] === '-0' ? -0 : NaN;
    return undefined;
  };
  const obj = (i, depth) => {
    if (memo.has(i)) return memo.get(i);
    const e = snap.o[i];
    if (!Array.isArray(e) || depth > 40) return null;
    if (e[0] === 'o' && isObj(e[1])) {
      const o = {};
      memo.set(i, o);
      for (const [k, v] of Object.entries(e[1])) if (k !== '__proto__') o[k] = val(v, depth + 1);
      return o;
    }
    if (e[0] === 'a' && Array.isArray(e[1])) {
      const a = [];
      memo.set(i, a);
      for (const v of e[1]) a.push(val(v, depth + 1));
      return a;
    }
    return null;
  };
  try {
    return val(snap.root[key], 0);
  } catch {
    return undefined;
  }
}

/** The periods banked in a record's last calm snapshot (0 without one). */
export function snapPeriods(rec) {
  const ty = snapField(rec?.snap, 'tryout');
  return Array.isArray(ty?.periods) ? ty.periods.length : 0;
}

// ---------------------------------------------------------------------------
// The Weekly Timetable (§10.4): one shared seed a game week, Grade 5 rules, everyone at the floor
// ---------------------------------------------------------------------------

/** The week's shared seed: a pure function of the game week number, the same on every device. */
export function weeklySeed(week) {
  return hashString(`tryout|weekly|${week | 0}`) >>> 0 || 1;
}

/** Opens after a Grade 4 clear (and needs the Weekly Grade's content window). */
export function weeklyOpen(profile) {
  const W = TRYOUT_META.weekly;
  return gradeCleared(profile) >= W.unlockGrade && isStageCleared(profile, TRYOUT.windows[TRYOUT.grades[W.grade].window].unlock);
}

/** The hub tile: week, seed, map, open, done this week, the reset. */
export function weeklyState(profile, now = Date.now()) {
  const W = TRYOUT_META.weekly;
  const week = gameWeekNumber(+now);
  const seed = weeklySeed(week);
  const done = whole(profile?.missions?.counters?.[TRYOUT_META.keys.weeklyDone]) === week;
  const w = profile?.tryoutMeta?.weekly;
  return {
    week, seed, grade: W.grade, length: W.length, mapId: mapChoices(seed, W.grade)[0], open: weeklyOpen(profile), done,
    best: isObj(w) && w.week === week ? whole(w.best) : 0, resetsAt: nextWeeklyReset(+now),
  };
}

// ---------------------------------------------------------------------------
// Share codes (§10.4): seed + Grade + length + map, 10 characters with 12 check bits
// ---------------------------------------------------------------------------

const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base 32 (no I, L, O, U)
const CODE_LEN = 10;
const checkOf = (seed, grade, full, mapBit) => hashString(`tryout|share|${seed >>> 0}|${grade}|${full}|${mapBit}`) & 0xfff;

/**
 * A run's share code ("7K2QX-M9RTA"): 32 seed bits, the Grade (1-12), Half/Full and which of the seed's two maps,
 * plus 12 check bits. @returns {string|null} null for a map the seed does not offer
 */
export function encodeShareCode({ seed, grade = 1, length = 'half', mapId }) {
  const g = grade | 0;
  if (!TRYOUT.grades[g]) return null;
  const mapBit = mapChoices(seed >>> 0, g).indexOf(mapId);
  if (mapBit < 0) return null;
  const full = length === 'full' ? 1 : 0;
  // value = seed · grade-1 (4 bits) · full (1) · map (1) · check (12): 50 bits, safe in a double
  let v = (seed >>> 0) * 2 ** 18 + (g - 1) * 2 ** 14 + full * 2 ** 13 + mapBit * 2 ** 12 + checkOf(seed, g, full, mapBit);
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) {
    s = ALPHA[v % 32] + s;
    v = Math.floor(v / 32);
  }
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}

/** Parses a share code (spaces, dashes, case and the look-alikes I/L/O are forgiven). @returns {object|null} */
export function parseShareCode(text) {
  const s = String(text || '').toUpperCase().replace(/[\s-]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
  if (s.length !== CODE_LEN) return null;
  let v = 0;
  for (const ch of s) {
    const d = ALPHA.indexOf(ch);
    if (d < 0) return null;
    v = v * 32 + d;
  }
  const check = v % 2 ** 12;
  v = Math.floor(v / 2 ** 12);
  const mapBit = v % 2;
  v = Math.floor(v / 2);
  const full = v % 2;
  v = Math.floor(v / 2);
  const g = (v % 16) + 1;
  const seed = Math.floor(v / 16);
  if (seed > 0xffffffff || !TRYOUT.grades[g] || check !== checkOf(seed, g, full, mapBit)) return null;
  return { seed: seed >>> 0, grade: g, length: full ? 'full' : 'half', mapId: mapChoices(seed >>> 0, g)[mapBit] };
}

// ---------------------------------------------------------------------------
// Run lengths (§2.2, §20.1): Half Day, Full Day, Extended Day (internal id 'after')
// ---------------------------------------------------------------------------

/** The run lengths Before Class and the co-op room offer, in order. */
export const RUN_LENGTHS = Object.freeze(['half', 'full', 'after']);

/** Has this player cleared a Full Day (Extended Day opens then, §20.8)? 'ty:full', a counter every build keeps. */
export function fullCleared(profile) {
  return (Number(profile?.missions?.counters?.[TRYOUT_META.keys.full]) || 0) > 0;
}

/**
 * Is a run length open for this player (in co-op: the host's ladder, §20.7)?
 * @returns {{ open: boolean, why: null|'half'|'full'|'unknown' }} why: the clear it waits for
 */
export function lengthOpen(profile, length) {
  if (length === 'half') return { open: true, why: null };
  if (length === 'full') return halfCleared(profile) ? { open: true, why: null } : { open: false, why: 'half' };
  if (length === 'after') return fullCleared(profile) ? { open: true, why: null } : { open: false, why: 'full' };
  return { open: false, why: 'unknown' };
}
