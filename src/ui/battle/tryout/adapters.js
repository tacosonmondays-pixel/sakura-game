// Tryout Day's Extended Day and Random Class, as the UI reads them (docs/specs/TRYOUT_DAY.md §20.4, §20.7, §20.8). THE
// ONE PLACE the battle UI, Before Class and the co-op room learn about the two run options: every read of the Sim's
// new fields goes through a function here, so wiring a changed sim API is a few lines in this file. Pure reads, never
// a write; never the wall clock (the reveal runs on the Sim's own ticks).
//
// What the Sim side exposes (feature/tryout-random 01ca02ac and feature/tryout-endless, §20):
//   sim.tryout.random === true           a Random Class run (the field only exists in one)
//   sim.tryout.length === 'after'        an Extended Day run (P1-12 are the Full Day; then 4 waves a period, forever)
//   sim.tryoutAutoPick(slot)             Random Class's pending auto-pick for the reveal, or null:
//     { owner, pick, seq, rarity, kind, follow, index, path, card, ticksLeft, revealTicks }
//     index: the offer card the Sim will take (-1: none fits, it is handed in); ticksLeft: Sim steps until it lands
//   TRYOUT.random.revealTicks            120 (2 s at 1×; faster at 2× and 3×)
// Before those land (or if a name changes) the fallbacks below read what they can and never throw.
import { TRYOUT } from '../../../data/tryout.js';
import { lengthOf } from '../../../sim/tryout/plan.js';
// (a namespace import: the sim side may still move this helper; a missing one falls back to the plan's list)
import * as EXT from '../../../sim/tryout/extended.js';

/** The reveal's length in Sim steps when the data table has none yet (§20.4: 2 s at 1×). */
export const REVEAL_TICKS_DEFAULT = 120;
/** The Full Day's last wave: past it an Extended Day run counts waves, not periods (§20.1). */
export const FULL_WAVES = 48;
/** The Full Day's periods (the timetable an Extended Day draws, P1-12). */
export const FULL_PERIODS = 12;

const tyOf = (x) => (x && typeof x === 'object' && 'tryout' in x ? x.tryout : x) || null;

/** Is this (a Sim, its sim.tryout, a run record or a pending config) a Random Class run? */
export function isRandomRun(x) {
  return tyOf(x)?.random === true;
}

/** Is this (a Sim, its sim.tryout, a run record or a pending config) an Extended Day run? */
export function isExtendedRun(x) {
  return tyOf(x)?.length === 'after';
}

/**
 * The length table the UI draws for a run: an Extended Day draws the Full Day's (P1-12, finite loops), whatever shape
 * the Sim's own `after` table takes; Half and Full their own.
 */
export function viewLength(x) {
  const ty = tyOf(x);
  return isExtendedRun(ty) ? TRYOUT.lengths.full : lengthOf(ty?.length);
}

/** The reveal's length in Sim steps. */
export function revealTicks() {
  const n = TRYOUT.random?.revealTicks;
  return Number.isInteger(n) && n > 0 ? n : REVEAL_TICKS_DEFAULT;
}

/**
 * Random Class: player `slot`'s pick reveal, or null when no random pick is open.
 * `{ pick, seq, index, path, card, done, total, progress }`: index the card the Sim will take (null: not known yet, -1:
 * none, handed in), done / total the Sim steps since the offer opened and the reveal's length, progress done / total.
 * @param {object} sim
 * @param {number} slot
 */
export function revealOf(sim, slot = 0) {
  const ty = sim?.tryout;
  if (!isRandomRun(ty)) return null;
  const p = ty.players?.[slot];
  const o = p?.offer;
  if (!o || p.win !== 'pick') return null;
  let pend = null;
  try {
    pend = typeof sim.tryoutAutoPick === 'function' ? sim.tryoutAutoPick(slot) : null;
  } catch {
    pend = null;
  }
  const total = Number.isInteger(pend?.revealTicks) && pend.revealTicks > 0 ? pend.revealTicks : revealTicks();
  // (ticksLeft counts to the landing step; without it, the window's own clock p.winTicks)
  const done = Number.isFinite(pend?.ticksLeft) ? total - pend.ticksLeft : Number(p.winTicks) || 0;
  const d = Math.max(0, Math.min(total, done));
  const same = pend && pend.seq === o.seq;
  return {
    pick: o.pick, seq: o.seq,
    index: same && Number.isInteger(pend.index) ? pend.index : null,
    path: same && Number.isInteger(pend.path) ? pend.path : 0,
    card: same ? pend.card || null : null,
    done: d, total, progress: d / total,
  };
}

/** The share of the reveal spent hopping across the cards; the rest of it the drawn card sits marked (it lands). */
export const REVEAL_HOP_SHARE = 0.7;

/**
 * Where the reveal's highlight is (pure): two laps across the n cards, then on to the drawn one, evenly over the first
 * REVEAL_HOP_SHARE of the reveal; then it stays there, landed. Reduce Motion: no hopping, the drawn card marked at once.
 * @param {{ progress: number, index: number|null }} r revealOf
 * @param {number} n the offer's card count
 * @returns {{ at: number, landed: boolean }} at -1: no card marked (the draw is not known yet, or nothing fits)
 */
export function revealStep(r, n, { reduced = false } = {}) {
  if (!r || n <= 0 || !Number.isInteger(r.index) || r.index < 0 || r.index >= n) return { at: -1, landed: false };
  if (reduced || r.progress >= REVEAL_HOP_SHARE) return { at: r.index, landed: true };
  const hops = 2 * n + r.index + 1;
  const k = Math.min(hops - 1, Math.floor((Math.max(0, r.progress) / REVEAL_HOP_SHARE) * hops));
  return { at: k % n, landed: false };
}

/**
 * Extended Day's wave line (the tracker head, the HUD counter, the wave banner): past the Full Day's 48 waves the run
 * counts waves. null: not an Extended Day run, or still inside the Full Day.
 * @returns {{ wave: number }|null}
 */
export function extendedPast(sim, wave = sim?.wave) {
  if (!isExtendedRun(sim)) return null;
  const w = Math.floor(Number(wave) || 0);
  return w > FULL_WAVES ? { wave: w } : null;
}

/**
 * The run options a Before Class or a co-op room setting carries (§20.7): { length, random }. Unknown lengths read as
 * Half Day; Random Class only when it is exactly true (as the room's clampTryout keeps it).
 */
export function runOptions(x) {
  const length = x?.length === 'full' || x?.length === 'after' ? x.length : 'half';
  return { length, random: x?.random === true };
}

/**
 * One period row's assignment marks for player `slot`, as [id, st] pairs (st 1 stamped, -1 missed, 0 open). A full row
 * has `team` and `own`; past the last 12 periods an Extended Day shrinks old rows to `{ period, score, cleared }`
 * (cleared: per player, team marks included, §20.6), drawn here as that many stamps then strikes (id null). Never throws.
 * @param {object|null} rec a sim.tryout.periods row
 * @param {number} slot
 * @param {number} [per] marks a period has (the Tryout assignments: 3)
 * @returns {Array<[string|null, number]>}
 */
export function periodMarks(rec, slot = 0, per = 3) {
  if (!rec || typeof rec !== 'object') return [];
  if (Array.isArray(rec.team) || Array.isArray(rec.own)) {
    const mine = Array.isArray(rec.own) ? rec.own[slot] : null;
    return [...(Array.isArray(rec.team) ? rec.team : []), ...(Array.isArray(mine) ? mine : [])].filter((x) => Array.isArray(x));
  }
  const raw = Array.isArray(rec.cleared) ? rec.cleared[slot] : rec.cleared;
  const n = Math.max(0, Math.min(per, Math.floor(Number(raw) || 0)));
  return Array.from({ length: per }, (_, i) => [null, i < n ? 1 : -1]);
}

/** Period p's Grade 8+ twist (a TRYOUT.dares id) or null: the plan's list, and past it (Extended Day) the same draw. */
export function affixOf(ty, p) {
  if (!ty) return null;
  try {
    return (typeof EXT.affixIdOf === 'function' ? EXT.affixIdOf(ty, p) : ty.affixes?.[p]) || null;
  } catch {
    return ty.affixes?.[p] || null;
  }
}
