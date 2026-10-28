// Tryout Day's per-run rewards (docs/specs/TRYOUT_DAY.md §10.1, §11, §12.4): Marbles, the Lunchbox, coins, Grade
// first clears, the Weekly Timetable's chest, the achievement counters, the Yearbook and the records. Paid exactly
// once at the run's end (a win, an Early Dismissal, giving up, or an update closing the run): the battle's
// results.apply() calls applyTryoutResult and then saver.finish() deletes the run in the same synchronous write
// (src/ui/battle/results.js); the hub's Give up and a stale close pay from the record's last calm snapshot
// (applyTryoutRecord). Pure: no DOM, no storage.
//
// Everything that must survive an older cached build lives in missions.counters (numbers every build keeps):
//   ty:mb      Marbles held                    ty:wk      the game week the weekly counters below belong to
//   ty:mbw     Marbles earned this week (cap)  ty:lbw     Lunchbox sevenths opened this week (3 boxes = 21)
//   ty:cw      coin waves paid this week       ty:jw:<id> Marble Jar weekly stock bought (src/systems/tryoutJar.js)
//   ty:cpd     the start seed of the last co-op run paid (a resync remount never pays twice)
//   ty:wkc     the last game week whose Weekly Timetable first clear was paid
//   ty:half · ty:full · ty:spot · ty:tick · ty:dare · ty:seen · ty:lr · ty:win · ty:mv · ty:grade   achievement counters
// A practice run (§12.3, share codes) pays only the periods banked before it turned practice (rec.paidPeriods) and
// counts nothing else: no Grade clear, no achievements, no records, no Yearbook.
import { TRYOUT } from '../data/tryout.js';
import { TRYOUT_META } from '../data/tryoutMeta.js';
import { CHAPTERS, STAGE_MAP } from '../data/stages.js';
import { UNIT_MAP } from '../data/units.js';
import { FREEPLAY_TIERS } from '../data/freeplay.js';
import { gameWeekNumber, nextWeeklyReset } from '../core/reset.js';
import { createRng, hashString } from '../core/rng.js';
import { buildTryoutPlan } from '../sim/tryout/plan.js';
import { soloWaveCoins } from './freeplayRewards.js';
import { addItems } from './inventory.js';
import { track, recordMax } from './missions.js';
import { isStageCleared } from './unlocks.js';
import { recordGradeClear, snapField } from './tryoutRuns.js';
import { stampRun, yearbookTensDue, recordBest, bestKey, recordWeeklyBest } from './tryoutYearbook.js';

const M = TRYOUT_META;
const K = M.keys;
const whole = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
export { snapField, snapPeriods } from './tryoutRuns.js';
export const counters = (profile) => ((profile.missions ||= {}).counters ||= {});

// ---------------------------------------------------------------------------
// The week and the wallet
// ---------------------------------------------------------------------------

/**
 * Starts the weekly counters over on the first look of a new game week (idempotent; a clock moved backwards never
 * resets them). @returns {number} the game week the counters belong to
 */
export function syncWeek(profile, now = Date.now()) {
  const c = counters(profile);
  const week = gameWeekNumber(+now);
  if (!(K.week in c) || week > c[K.week]) {
    c[K.week] = week;
    delete c[K.weekMarbles];
    delete c[K.weekBox];
    delete c[K.weekWaves];
    for (const k of Object.keys(c)) if (k.startsWith(K.weekJar)) delete c[k];
  }
  return c[K.week];
}

/** Marbles held. */
export function marbles(profile) {
  return whole(profile?.missions?.counters?.[K.marbles]);
}

/**
 * Adds Marbles: `capped` ones count toward the week's cap (the rest are dropped), the others never do.
 * @returns {{ paid: number, over: number }}
 */
export function addMarbles(profile, n, { capped = true, now = Date.now() } = {}) {
  const want = whole(n);
  if (!want) return { paid: 0, over: 0 };
  const c = counters(profile);
  syncWeek(profile, now);
  let paid = want;
  if (capped) {
    paid = Math.max(0, Math.min(want, M.marbles.weeklyCap - whole(c[K.weekMarbles])));
    if (paid) c[K.weekMarbles] = whole(c[K.weekMarbles]) + paid;
  }
  if (paid) c[K.marbles] = marbles(profile) + paid;
  return { paid, over: want - paid };
}

/** Spends Marbles. @returns {boolean} */
export function spendMarbles(profile, n) {
  const cost = whole(n);
  if (marbles(profile) < cost) return false;
  counters(profile)[K.marbles] = marbles(profile) - cost;
  return true;
}

/** The hub's wallet line: Marbles, this week's cap, Lunchboxes and coin waves left, the reset. */
export function weekState(profile, now = Date.now()) {
  const c = counters(profile);
  syncWeek(profile, now);
  const sev = M.lunchbox.sevenths;
  return {
    marbles: marbles(profile),
    week: whole(c[K.weekMarbles]),
    cap: M.marbles.weeklyCap,
    boxSevenths: Math.max(0, M.lunchbox.perWeek * sev - whole(c[K.weekBox])),
    boxesLeft: Math.max(0, M.lunchbox.perWeek * sev - whole(c[K.weekBox])) / sev,
    coinWavesLeft: Math.max(0, M.coins.weeklyWaves - whole(c[K.weekWaves])),
    resetsAt: nextWeeklyReset(+now),
  };
}

// ---------------------------------------------------------------------------
// The pay rules
// ---------------------------------------------------------------------------

/** Marbles for a run (before the cap): (2 × periods + assignments + 6 on a full clear) × the Grade factor, rounded. */
export function marblesFor({ periods = 0, assignments = 0, full = false, grade = 1 }) {
  const m = M.marbles;
  const base = m.perPeriod * whole(periods) + m.perAssignment * whole(assignments) + (full ? m.clear : 0);
  return Math.round(base * (1 + m.perGrade * (Math.max(1, Math.min(12, grade | 0)) - 1)));
}

/** The furthest cleared campaign stage in a content window (null when none). */
export function furthestStage(profile, window) {
  const win = TRYOUT.windows[window];
  if (!win) return null;
  let last = null;
  for (const ch of CHAPTERS) {
    if (!win.chapters.includes(ch.id)) continue;
    for (const id of ch.stages) if (STAGE_MAP[id]?.kind === 'campaign' && isStageCleared(profile, id)) last = id;
  }
  return last;
}

/** Coins per wave cleared in a window: 60 % of soloWaveCoins of the furthest cleared stage there. */
export function waveCoinRate(profile, window) {
  const id = furthestStage(profile, window);
  return id ? Math.floor(soloWaveCoins(id, M.coins.difficulty, FREEPLAY_TIERS[0]) * M.coins.share) : 0;
}

/** The squad's material family: the one most of the starting three share (ties: the first girl's). */
export function squadFamily(squad = []) {
  const n = {};
  let best = null;
  for (const id of squad.slice(0, TRYOUT.squad.start)) {
    const f = UNIT_MAP[id]?.materialFamily;
    if (!f) continue;
    n[f] = (n[f] || 0) + 1;
    if (!best || n[f] > n[best]) best = f;
  }
  return best || 'charm';
}

/**
 * A Lunchbox filled `fill` sevenths (1 per period cleared) for a content window: every count × fill/7, the fraction
 * rolled (so a part-filled box pays its share on average); the gear box's chance × fill/7.
 * @returns {{ id: string, count: number }[]}
 */
export function lunchboxItems(window, fill, family, rng) {
  const box = M.boxes[window] || M.boxes.spring;
  const f = Math.max(0, Math.min(M.lunchbox.sevenths, fill | 0)) / M.lunchbox.sevenths;
  if (!f) return [];
  const share = (count) => {
    const x = count * f;
    return Math.floor(x) + (rng.next() < x - Math.floor(x) ? 1 : 0);
  };
  const out = [];
  for (const it of box.items) out.push({ id: it.id, count: share(it.count) });
  for (const mt of box.mats) out.push({ id: `mat_${family}_${mt.rarity}`, count: share(mt.count) });
  if (box.gear && rng.next() < box.gear.chance * f) out.push({ id: box.gear.id, count: 1 });
  return out.filter((x) => x.count > 0);
}

/** Assignments locked in for player `slot` in a list of banked periods (a resumed period's are void, §12.3). */
export function assignmentsIn(periods, slot = 0) {
  let n = 0;
  for (const p of periods) {
    if (p.resumed) continue;
    for (const [, st] of [...(p.team || []), ...((p.own || [])[slot] || [])]) if (st === 1) n++;
  }
  return n;
}

/** Periods where player `slot` locked in every one of their 3 assignments. */
export function fullPeriods(periods, slot = 0) {
  return periods.filter((p) => {
    const all = [...(p.team || []), ...((p.own || [])[slot] || [])];
    return !p.resumed && all.length >= 3 && all.every(([, st]) => st === 1);
  }).length;
}

function blankOut() {
  return { firstClear: false, newMedal: false, medal: null, rewards: [], gear: [], unlockedUnits: [], discovered: [], gemsEarned: 0, tryout: true, gradeUp: false, run: null };
}

/**
 * Pays a finished run for one player (solo slot 0, or a co-op player's own slot), once.
 * @param {object} profile
 * @param {object} result Sim.result() (or applyTryoutRecord's stand-in): won, wavesCleared, kills, tryout
 * @param {{ rec?: object, slot?: number, coop?: boolean, coopKey?: number, rng?: object, now?: number }} [o]
 *   rec: the solo run record (practice, paidPeriods, makeUpUsed, weekly); coopKey: the co-op start seed
 * @returns {object} the results-sheet shape plus `run` (what the Class Photo shows)
 */
export function applyTryoutResult(profile, result, { rec = null, slot = 0, coop = false, coopKey = null, rng = null, now = Date.now() } = {}) {
  const out = blankOut();
  const ty = result?.tryout;
  if (!ty || !Array.isArray(ty.periods)) return out;
  const c = counters(profile);
  if (coop && coopKey != null) {
    if (c[K.coopPaid] === (coopKey >>> 0)) return { ...out, run: { already: true } };
    c[K.coopPaid] = coopKey >>> 0;
  }
  rng ||= createRng(hashString(`tryout-pay|${ty.seed}|${rec?.id || ''}|${slot}`));
  const week = syncWeek(profile, now);
  const practice = !coop && !!rec?.practice;
  const weekly = !coop && Number.isInteger(rec?.weekly) ? rec.weekly : null;
  const len = TRYOUT.lengths[ty.length] || TRYOUT.lengths.half;
  const grade = Math.max(1, ty.grade | 0);
  const window = TRYOUT.grades[grade]?.window || 'spring';
  const won = !!result.won;
  const banked = practice ? ty.periods.slice(0, whole(rec?.paidPeriods)) : ty.periods;
  const periods = banked.length;
  const assignments = assignmentsIn(banked, slot);
  const full = won && !practice && periods >= len.periods;
  const pl = ty.players?.[slot] || { squad: [], cards: [], picks: [] };
  const run = { practice, weekly, won, periods, assignments, full, grade, length: ty.length, marbles: null, box: null, coins: null, stamps: [], best: null, gradeUp: false };

  // ---- Marbles (inside the week's cap) and the Weekly's chest
  const earned = marblesFor({ periods, assignments, full, grade });
  const m = addMarbles(profile, earned, { capped: true, now });
  run.marbles = { earned, paid: m.paid, over: m.over, grade: 0, yearbook: 0, chest: 0 };
  if (weekly != null && won && !practice && whole(c[K.weeklyDone]) !== weekly) {
    c[K.weeklyDone] = weekly;
    run.marbles.chest = addMarbles(profile, M.weekly.chest, { capped: true, now }).paid;
    run.weeklyFirst = true;
  }

  // ---- the Lunchbox (1/7 a period, at most one box a run, 3 a week)
  const fill = Math.min(M.lunchbox.sevenths, periods, Math.max(0, M.lunchbox.perWeek * M.lunchbox.sevenths - whole(c[K.weekBox])));
  const rewards = [];
  if (fill > 0) {
    c[K.weekBox] = whole(c[K.weekBox]) + fill;
    const items = lunchboxItems(window, fill, squadFamily(pl.squad), rng);
    rewards.push(...items);
    run.box = { fill, items };
  } else run.box = { fill: 0, items: [], weekFull: periods > 0 };

  // ---- coins per wave (60 % of the furthest cleared stage's freeplay wave pay; 150 waves a week)
  const waves = Math.min(whole(result.wavesCleared), practice ? periods * len.wavesPerPeriod : Infinity);
  const rate = waveCoinRate(profile, window);
  const paidWaves = Math.min(waves, Math.max(0, M.coins.weeklyWaves - whole(c[K.weekWaves])));
  if (paidWaves > 0) c[K.weekWaves] = whole(c[K.weekWaves]) + paidWaves;
  const coins = paidWaves * rate;
  if (coins > 0) rewards.push({ id: 'coins', count: coins });
  run.coins = { waves, paidWaves, rate, coins };
  out.rewards = addItems(profile, rewards);

  if (!practice) {
    // ---- the Grade ladder (a co-op win only when it is this player's own next Grade, M2) and its first-clear Marbles
    if (won && weekly == null) {
      run.gradeUp = out.gradeUp = recordGradeClear(profile, grade);
      if (run.gradeUp && !coop) run.marbles.grade = addMarbles(profile, M.marbles.gradeFirstClear, { capped: false, now }).paid;
    }
    // ---- achievement counters (§10.2)
    if (won) track(profile, ty.length === 'full' ? K.full : K.half, 1);
    const hearts = ty.periods.every((p) => !p.resumed && (p.team || []).some(([id, st]) => id === 'a_hearts' && st === 1));
    if (won && !rec?.makeUpUsed && hearts) track(profile, K.spotless, 1);
    if (fullPeriods(ty.periods, slot) >= 5) track(profile, K.ticked, 1);
    track(profile, K.dare, ty.periods.filter((p) => p.dare).length);
    track(profile, K.lr, (pl.picks || []).filter((p) => p.rarity === 4 && p.card).length);
    track(profile, K.window, ty.periods.filter((p) => !p.resumed && [...(p.team || []), ...((p.own || [])[slot] || [])].some(([id, st]) => id === 'a_window' && st === 1)).length);
    // Hall Pass moves: the player's own (the Sim's players[i].moves); solo falls back to the run's total
    const moves = Number.isInteger(pl.moves) ? pl.moves : !coop ? whole(ty.moves) : 0;
    track(profile, K.moves, moves);
    // ---- the Yearbook and the records
    let bosses = [];
    try {
      const plan = buildTryoutPlan({ seed: ty.seed, grade, length: ty.length, mapId: ty.mapId });
      bosses = [...plan.minibosses, plan.boss].filter((id) => whole(result.kills?.[id]) > 0);
    } catch { /* (a plan that no longer builds stamps no bosses) */ }
    run.stamps = stampRun(profile, {
      squad: pl.squad || [], cards: (pl.picks || []).filter((p) => p.card).map((p) => p.card), seen: pl.seen || [], bosses,
      week: run.weeklyFirst ? weekly : null,
    });
    run.marbles.yearbook = addMarbles(profile, yearbookTensDue(profile), { capped: false, now }).paid;
    const score = Array.isArray(ty.runScore) ? ty.runScore[slot] : null;
    if (Number.isFinite(score)) {
      run.best = weekly != null ? recordWeeklyBest(profile, weekly, score) : recordBest(profile, bestKey(ty.length, grade, ty.mapId), score);
      run.score = score;
    }
  }
  run.held = marbles(profile);
  run.week = whole(c[K.weekMarbles]);
  run.cap = M.marbles.weeklyCap;
  run.weekNo = week;
  out.run = run;
  return out;
}

// ---------------------------------------------------------------------------
// A run closed outside the battle (Give up, an update): paid from the record's last calm snapshot
// ---------------------------------------------------------------------------

/** A Sim.result() stand-in from a record's snapshot (a loss: what was banked by its last calm point). */
export function resultFromRecord(rec) {
  const ty = snapField(rec?.snap, 'tryout');
  if (!isObj(ty) || !Array.isArray(ty.periods)) return null;
  const kills = snapField(rec.snap, 'kills');
  return {
    won: false,
    wavesCleared: whole(snapField(rec.snap, 'wavesCleared')),
    kills: isObj(kills) ? kills : {},
    tryout: {
      seed: ty.seed >>> 0, grade: ty.grade, length: ty.length, mapId: ty.mapId, periods: ty.periods.filter(isObj), moves: whole(ty.moves),
      players: (Array.isArray(ty.players) ? ty.players : []).map((p) => ({
        squad: Array.isArray(p?.squad) ? p.squad.filter((x) => typeof x === 'string') : [],
        picks: Array.isArray(p?.picks) ? p.picks.filter(isObj) : [],
        ...(Number.isInteger(p?.moves) ? { moves: p.moves } : null),
      })),
    },
  };
}

/**
 * Pays an open run that ends outside a battle (the hub's Give up, a run an update closed): the periods banked by its
 * last calm point, as an Early Dismissal. The caller deletes the record in the same write.
 */
export function applyTryoutRecord(profile, rec, { now = Date.now() } = {}) {
  const result = resultFromRecord(rec);
  if (!result) return blankOut();
  return applyTryoutResult(profile, result, { rec, now });
}
