// Tryout Day's Extended Day (docs/specs/TRYOUT_DAY.md §20.1, §20.6): the day past the Full Day's 12 periods. P1-P12 are
// the Full Day exactly; from the end of P12 on, each period end draws what the coming periods need (their Subject pairs
// and seat blocks, each from its own stream, so drawing them later or earlier gives the same run) and trims the run
// state that would otherwise grow with every period, so a snapshot stays small deep into the run. Everything here is
// a pure function of run state at a period end: every client and every Continue does the same.
import { TRYOUT } from '../../data/tryout.js';
import { lengthOf, blockOf, subjectPairAt, affixAt } from './plan.js';
import { drawSeats } from './breaks.js';

/** The Grade affix id of period p: the plan's list, else (Extended Day past it) the same pure draw. */
export function affixIdOf(ty, p) {
  if (!ty.affixes || p < ty.affixes.length) return ty.affixes?.[p] ?? null;
  return affixAt(ty.seed, ty.grade, p);
}

/**
 * The end of period p (≥ the Full Day's last) in an Extended Day run: the next two periods' Subject pairs, the seat
 * blocks up to one past the coming period's, then the trims (§20.6).
 */
export function extendDay(sim, p) {
  const ty = sim.tryout;
  const len = lengthOf(ty.length);
  const X = TRYOUT.afterSchool;
  // Subjects: the next 2 periods' pairs (each avoids the pair before it); older entries are dropped (each period's row
  // keeps its Subject)
  for (let q = len.periods + 1; q <= p + 2; q++) if (!ty.subjects[q]) ty.subjects[q] = subjectPairAt(ty.seed, q, ty.subjects[q - 1]);
  for (let q = 0; q <= p && q < ty.subjects.length; q++) ty.subjects[q] = null;
  // seats: drawn one block ahead of the coming period's (a break shows the next block's); blocks before the current one
  // are dropped
  const seats = ty.seats;
  const want = blockOf(len, p + 1) + 2;
  if (seats.blocks.length < want) seats.blocks.push(...drawSeats(sim, ty.seed, want, seats.blocks.length));
  for (let b = 0; b < seats.block && b < seats.blocks.length; b++) seats.blocks[b] = null;
  // period rows: the last keepPeriods in full, older ones as { period, score, cleared } (cleared per player)
  const old = ty.periods.length - X.keepPeriods;
  for (let i = 0; i < old; i++) {
    const r = ty.periods[i];
    if (!r.team) continue;
    const team = r.team.filter((x) => x[1] === 1).length;
    ty.periods[i] = { period: r.period, score: r.score, cleared: r.own.map((l) => team + l.filter((x) => x[1] === 1).length) };
  }
  // pick rows: past the first keepPicks, a row that brought no girl and is not among the newest keepPicksNew is
  // folded into the per-rarity counts (newestGirl and Show Her Around read only girl rows and the newest one)
  for (const pl of ty.players) {
    const cut = pl.picks.length - X.keepPicksNew;
    if (cut <= X.keepPicks) continue;
    const keep = [];
    pl.picks.forEach((r, i) => {
      if (i < X.keepPicks || i >= cut || r.girl) keep.push(r);
      else (pl.pickCounts || (pl.pickCounts = [0, 0, 0, 0, 0]))[r.rarity] += 1;
    });
    pl.picks = keep;
  }
}
