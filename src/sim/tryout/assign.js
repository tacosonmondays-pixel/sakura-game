// Tryout Day (docs/specs/TRYOUT_DAY.md §3): assignments and the score. Every assignment is a pure integer
// test inside the Sim at the period's last wave clear, read from differences against a baseline stored at the
// period's first wave start; per-player ones read the per-owner counters (`ctr[owner]`), so co-op judges each
// player's slot 3 on its own. assignProgress() is the HUD's pure read (no sim work).
import { TRYOUT } from '../../data/tryout.js';
import { stream, lengthOf, periodWaves } from './plan.js';
import { CONTENT } from './offers.js';

const A = TRYOUT.assignments;

// ---------------------------------------------------------------------------
// Score (§3.3)
// ---------------------------------------------------------------------------

/** A foe's points by tier; split and summoned children score 0. */
export function pointsOf(e) {
  if (e.parentUid != null) return 0;
  return TRYOUT.score.points[e.tier] ?? TRYOUT.score.points.normal;
}

/** A kill: 2× at the gate down to 1× at the exit, in integers. */
export function killPoints(sim, e) {
  const pts = pointsOf(e);
  if (!pts) return 0;
  const len = sim.pathData[e.pathIndex]?.length || 1;
  const q = Math.min(1024, Math.max(0, Math.floor((1024 * e.dist) / len)));
  return Math.floor((pts * (2048 - q)) / 1024);
}

/** The period's best possible score: 2 × the points of its spawn lists (children are never in them). */
export function bestPossible(sim, period) {
  const len = lengthOf(sim.tryout.length);
  const [a, b] = periodWaves(len, period);
  let sum = 0;
  for (let w = a; w <= b; w++) {
    for (const s of sim._getWave(w).spawns) {
      const def = sim.data.enemy(s.enemyId);
      sum += TRYOUT.score.points[def?.tier || 'normal'] ?? TRYOUT.score.points.normal;
    }
  }
  return 2 * sum;
}

// ---------------------------------------------------------------------------
// Drawing (§3.1)
// ---------------------------------------------------------------------------

/** Does period p hold a miniboss or the boss? */
export function periodHasBoss(len, p) {
  const [a, b] = periodWaves(len, p);
  return len.minibossWaves.some((w) => w >= a && w <= b) || (len.bossWave >= a && len.bossWave <= b);
}

function drawable(id, slot, sim, period, ownSlot) {
  const a = A[id];
  if (!a || a.slot !== slot || !a[CONTENT]) return false;
  if (a.from && period < a.from) return false;
  if (a.needs === 'boss' && !periodHasBoss(lengthOf(sim.tryout.length), period)) return false;
  if (a.needs === 'abilities' || a.needs === 'flyers') return false;
  if (a.solo && sim.tryout.coop) return false;
  if (ownSlot && sim.tryout.coop && !a.coop) return false;
  return true;
}

function pick(rng, ids, avoid) {
  const fresh = ids.filter((x) => !avoid.includes(x));
  const list = fresh.length ? fresh : ids;
  return list[Math.floor(rng.next() * list.length)];
}

/** Draws period p's assignments (team slots 1-2, slot 3 per player) into run state. */
export function drawAssignments(sim, period) {
  const ty = sim.tryout;
  const prev = ty.assign;
  const avoid = prev ? [...prev.team.map((x) => x.id), ...prev.own.flat().map((x) => x.id)] : [];
  const rng = stream(ty.seed, `assign:${period}:none`);
  const ids2 = Object.keys(A).filter((id) => drawable(id, 2, sim, period, false));
  const ids3 = Object.keys(A).filter((id) => drawable(id, 3, sim, period, true));
  const team = [{ id: 'a_hearts', st: 0 }, { id: pick(rng, ids2, avoid), st: 0 }];
  const own = ty.players.map((_, i) => {
    const r = stream(ty.seed, `assign:${period}:none:${i}`);
    return [{ id: pick(r, ids3, avoid), st: 0 }];
  });
  ty.assign = { period, team, own, resumed: false };
}

// ---------------------------------------------------------------------------
// Baseline, live counters, evaluation
// ---------------------------------------------------------------------------

/** The baseline at the period's first wave start. */
export function storeBaseline(sim) {
  const ty = sim.tryout;
  ty.base = {
    leaks: sim.stats.leaks,
    earned: sim.stats.cashEarned,
    ctr: ty.ctr.map((c) => ({ ...c })),
    slow: false,
    bossSeen: 0,
    bossFail: false,
  };
  ty.periodScore = 0;
  ty.best = bestPossible(sim, ty.period);
}

/** Wave end inside a period: Speed Round's clock. */
export function waveEndCheck(sim) {
  const ty = sim.tryout;
  const q = sim._spawnQueue;
  const last = q.length ? q[q.length - 1].t : 0;
  if (sim._waveTime - last > A.a_speed.secs + 1e-9) ty.base.slow = true;
}

/** A miniboss or boss arrived (not a child): Quick Answer's clock starts. */
export function bossSpawned(sim, e) {
  if (e.parentUid != null || (e.tier !== 'boss' && e.tier !== 'miniboss')) return;
  e.tyAt = sim.time;
  sim.tryout.base.bossSeen++;
}

/** A miniboss or boss fell or leaked. */
export function bossGone(sim, e, leaked) {
  if (e.tyAt == null || !sim.tryout.base) return;
  if (leaked || sim.time - e.tyAt > A.a_quick.secs + 1e-9) sim.tryout.base.bossFail = true;
}

/** Tight Budget's bar for a player: 40 % of last period's income (a co-op player's share), at least 600. */
export function budgetOf(sim) {
  const ty = sim.tryout;
  const last = ty.lastIncome || 0;
  return Math.max(A.a_budget.min, Math.floor((last * A.a_budget.share) / 100 / ty.players.length));
}

const delta = (sim, o, k) => (sim.tryout.ctr[o]?.[k] || 0) - (sim.tryout.base?.ctr[o]?.[k] || 0);

/**
 * One assignment's live state for a player: { st: 0 open | 1 locked in | -1 failed, cur, goal }.
 * `final`: the period's last wave has cleared (open ones are judged).
 */
export function judge(sim, id, owner, final = false) {
  const ty = sim.tryout;
  const b = ty.base;
  // before the period starts (the tracker shows the coming period's assignments): nothing yet, the bars as they will be
  if (!b) {
    const goal = { a_speed: A.a_speed.secs, a_quick: A.a_quick.secs, a_small: A.a_small.max, a_learner: A.a_learner.tiers, a_budget: budgetOf(sim) }[id] ?? 0;
    return { st: 0, cur: 0, goal };
  }
  const done = (ok) => (ok ? 1 : final ? -1 : 0);
  switch (id) {
    case 'a_hearts': {
      const lost = sim.stats.leaks - b.leaks;
      return { st: lost > 0 ? -1 : final ? 1 : 0, cur: lost, goal: 0 };
    }
    case 'a_ace': {
      const bar = TRYOUT.grades[ty.grade]?.aceBar ?? A.a_ace.bar;
      const goal = Math.ceil((ty.best * bar) / 100);
      return { st: done(ty.periodScore >= goal), cur: ty.periodScore, goal };
    }
    case 'a_speed':
      return { st: b.slow ? -1 : final ? 1 : 0, cur: 0, goal: A.a_speed.secs };
    case 'a_quick':
      return { st: b.bossFail ? -1 : final ? (b.bossSeen > 0 ? 1 : -1) : 0, cur: 0, goal: A.a_quick.secs };
    case 'a_budget': {
      const spent = delta(sim, owner, 'spent');
      const goal = budgetOf(sim);
      return { st: spent > goal ? -1 : final ? 1 : 0, cur: spent, goal };
    }
    case 'a_noreturn': {
      const n = delta(sim, owner, 'sells');
      return { st: n > 0 ? -1 : final ? 1 : 0, cur: n, goal: 0 };
    }
    case 'a_small': {
      const n = delta(sim, owner, 'placed');
      return { st: n > A.a_small.max ? -1 : final ? 1 : 0, cur: n, goal: A.a_small.max };
    }
    case 'a_learner': {
      const n = delta(sim, owner, 'upgrades');
      return { st: n >= A.a_learner.tiers ? 1 : final ? -1 : 0, cur: n, goal: A.a_learner.tiers };
    }
    default:
      return { st: final ? -1 : 0, cur: 0, goal: 0 };
  }
}

/** The HUD's read for a player: the period's three assignments with live progress (pure). */
export function assignProgress(sim, owner = 0) {
  const ty = sim.tryout;
  if (!ty?.assign) return [];
  const list = [...ty.assign.team, ...(ty.assign.own[owner] || [])];
  return list.map((a) => {
    if (ty.assign.resumed) return { id: a.id, st: 0, cur: 0, goal: 0, resumed: true };
    if (a.st !== 0) return { id: a.id, st: a.st, cur: 0, goal: 0 };
    return { id: a.id, ...judge(sim, a.id, owner, false) };
  });
}

/**
 * The period's last wave cleared: judges every assignment, returns each player's cleared count.
 * A resumed period's assignments are void (§3.1).
 * @returns {number[]} cleared assignments per player
 */
export function evaluatePeriod(sim) {
  const ty = sim.tryout;
  const a = ty.assign;
  const team = a.team.map((x) => (a.resumed ? -1 : judge(sim, x.id, 0, true).st));
  a.team.forEach((x, i) => { x.st = team[i]; });
  return ty.players.map((_, o) => {
    let n = team.filter((s) => s === 1).length;
    for (const x of a.own[o] || []) {
      x.st = a.resumed ? -1 : judge(sim, x.id, o, true).st;
      if (x.st === 1) n++;
    }
    return n;
  });
}
