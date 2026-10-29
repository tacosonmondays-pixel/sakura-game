// Tryout Day (docs/specs/TRYOUT_DAY.md §3): assignments and the score. Every assignment is a pure integer
// test inside the Sim at the period's last wave clear, read from differences against a baseline stored at the
// period's first wave start; per-player ones read the per-owner counters (`ctr[owner]`), so co-op judges each
// player's slot 3 on its own. assignProgress() is the HUD's pure read (no sim work).
import { TRYOUT } from '../../data/tryout.js';
import { stream, lengthOf, periodWaves, setPieceAt } from './plan.js';
import { CONTENT } from './offers.js';
import { enemyTraitKeys } from '../enemies.js';

const A = TRYOUT.assignments;

/**
 * The Grade's targets for the three timed or scored assignments (§3.1): Ace the Test's bar in % (Grade 7+: aceBar),
 * Speed Round's and Quick Answer's seconds. Grade 8+ (`strict`) makes all three that many % stricter: the bar
 * × (100 + strict) / 100, rounded (75 → 86), the seconds × (100 − strict) / 100 (8 → 6.8, 12 → 10.2).
 * @returns {{ ace: number, speed: number, quick: number }}
 */
export function targetsOf(grade) {
  const g = TRYOUT.grades[grade] || TRYOUT.grades[1];
  const s = g.strict || 0;
  const bar = g.aceBar ?? A.a_ace.bar;
  return {
    ace: s ? Math.min(100, Math.round((bar * (100 + s)) / 100)) : bar,
    speed: s ? (A.a_speed.secs * (100 - s)) / 100 : A.a_speed.secs,
    quick: s ? (A.a_quick.secs * (100 - s)) / 100 : A.a_quick.secs,
  };
}

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

/** Does period p hold a miniboss or the boss (Extended Day: the period grid's set pieces, §20.1)? */
export function periodHasBoss(len, p) {
  return setPieceAt(len, p) !== null;
}

/** Does period p's spawn lists hold a flyer (an `airborne` trait, phases included, as waves.js summarizes)? */
export function periodHasFlyers(sim, period) {
  const [a, b] = periodWaves(lengthOf(sim.tryout.length), period);
  const seen = new Set();
  for (let w = a; w <= b; w++) {
    for (const s of sim._getWave(w).spawns) {
      if (seen.has(s.enemyId)) continue;
      seen.add(s.enemyId);
      if (enemyTraitKeys(sim.data.enemy(s.enemyId)).includes('airborne')) return true;
    }
  }
  return false;
}

/** A player's girls on the field (not the hero). */
const girlsOf = (sim, owner) => sim.towers.filter((t) => !t.isHero && (t.owner ?? 0) === owner);

/** Star Pupil's candidates for a player: girls placed now who dealt damage last period, by id. */
export function starCandidates(sim, owner) {
  const last = sim.tryout.lastDmg?.units?.[owner];
  if (!last) return [];
  const placed = new Set(girlsOf(sim, owner).map((t) => t.unitId));
  return Object.keys(last).filter((id) => last[id] > 0 && placed.has(id)).sort();
}

/** A player's newest girl: the latest pick that brought a girl who is in their squad (null: none). */
export function newestGirl(sim, owner) {
  const p = sim.tryout.players[owner];
  if (!p) return null;
  for (let i = p.picks.length - 1; i >= 0; i--) {
    const g = p.picks[i].girl;
    if (g && p.squad.includes(g)) return g;
  }
  return null;
}

/**
 * Show Her Around has a girl to show: the open pick offers a girl (she is fixed at the period's start), or the
 * player's last resolved pick brought one.
 */
function showable(sim, owner) {
  const p = sim.tryout.players[owner];
  if (!p) return false;
  if (p.offer?.cards?.some((c) => c.girl)) return true;
  const last = p.picks[p.picks.length - 1];
  return !!(last?.girl && p.squad.includes(last.girl));
}

/** Is a Window Seat held by one of the player's girls? */
function seatHeld(sim, owner) {
  return sim.tryout.seats.holder.some((uid) => {
    const t = uid != null ? sim.getTower(uid) : null;
    return !!t && (t.owner ?? 0) === owner;
  });
}

/**
 * Can assignment `id` be drawn into `slot` for period p? `owner`: the player whose slot 3 it is (null: a team slot).
 * `content`: the content flag (offers.js CONTENT; tests pass 'ship').
 */
export function drawableFor(sim, id, slot, period, owner = null, content = CONTENT) {
  const a = A[id];
  const ty = sim.tryout;
  if (!a || a.slot !== slot || !a[content]) return false;
  if (a.from && period < a.from) return false;
  if (a.needs === 'boss' && !periodHasBoss(lengthOf(ty.length), period)) return false;
  if (a.needs === 'abilities') return false;
  if (a.needs === 'flyers' && !periodHasFlyers(sim, period)) return false;
  if (a.solo && ty.coop) return false;
  if (owner != null && ty.coop && !a.coop) return false;
  const o = owner ?? 0;
  switch (id) {
    case 'a_guest': {
      // the team's heroes dealt ≥ lastShare % of last period's damage
      const L = ty.lastDmg;
      return !!L && L.total > 0 && L.heroes.reduce((x, y) => x + y, 0) * 100 >= a.lastShare * L.total;
    }
    case 'a_star':
      return starCandidates(sim, o).length > 0;
    case 'a_show':
      return showable(sim, o);
    case 'a_window':
      return seatHeld(sim, o);
    case 'a_team':
      return new Set(girlsOf(sim, o).map((t) => t.unitId)).size >= a.types;
    default:
      return true;
  }
}

function pick(rng, ids, avoid) {
  const fresh = ids.filter((x) => !avoid.includes(x));
  const list = fresh.length ? fresh : ids;
  return list[Math.floor(rng.next() * list.length)];
}

/** A drawn slot-3 entry; Star Pupil names her girl from the same stream, Show Her Around the newest girl. */
function entryFor(sim, id, owner, rng) {
  if (id === 'a_star') {
    const c = starCandidates(sim, owner);
    return { id, st: 0, unit: c[Math.floor(rng.next() * c.length)] };
  }
  if (id === 'a_show') return { id, st: 0, unit: newestGirl(sim, owner) };
  return { id, st: 0 };
}

/**
 * Draws period p's assignments (team slots 1-2, slot 3 per player) for a Subject option. `prev`: the period
 * before's assignments (the same one never comes twice in a row); `set`: store it as the run's (else only return
 * it, for a Subject option shown at the period end and chosen at the period start).
 * @returns {{ period: number, subject: string, team: object[], own: object[][], resumed: boolean }}
 */
export function drawAssignments(sim, period, subject = 'none', { prev = sim.tryout.assign, set = true } = {}) {
  const ty = sim.tryout;
  const avoid = prev ? [...prev.team.map((x) => x.id), ...prev.own.flat().map((x) => x.id)] : [];
  const rng = stream(ty.seed, `assign:${period}:${subject}`);
  const ids2 = Object.keys(A).filter((id) => drawableFor(sim, id, 2, period, null));
  const team = [{ id: 'a_hearts', st: 0 }, { id: pick(rng, ids2, avoid), st: 0 }];
  const own = ty.players.map((_, i) => {
    const r = stream(ty.seed, `assign:${period}:${subject}:${i}`);
    const ids3 = Object.keys(A).filter((id) => drawableFor(sim, id, 3, period, i));
    return [entryFor(sim, pick(r, ids3, avoid), i, r)];
  });
  const out = { period, subject, team, own, resumed: false };
  if (set) ty.assign = out;
  return out;
}

/**
 * The period starts: Show Her Around names the player's newest girl (the one who joined at the pick just made);
 * a player with no girl to show gets another slot-3 assignment from its own stream instead. Runs from
 * storeBaseline on the run's ty.assign when it is already this period's; whoever sets ty.assign later at the period
 * start (a chosen Subject option) calls it again. Idempotent: an already named girl is re-read the same way.
 */
export function fixShow(sim) {
  const ty = sim.tryout;
  const a = ty.assign;
  if (!a || a.period !== ty.period) return;
  a.own.forEach((list, i) => {
    list.forEach((x, j) => {
      if (x.id !== 'a_show') return;
      x.unit = newestGirl(sim, i);
      if (x.unit) return;
      const last = ty.periods[ty.periods.length - 1];
      const avoid = last ? [...last.team.map((y) => y[0]), ...last.own.flat().map((y) => y[0])] : [];
      const ids = Object.keys(A).filter((id) => id !== 'a_show' && drawableFor(sim, id, 3, ty.period, i));
      const r = stream(ty.seed, `assign:${ty.period}:${a.subject ?? 'none'}:${i}:swap`);
      if (ids.length) list[j] = entryFor(sim, pick(r, ids, avoid), i, r);
    });
  });
}

// ---------------------------------------------------------------------------
// Baseline, live counters, evaluation
// ---------------------------------------------------------------------------

/**
 * The baseline at the period's first wave start. Damage shares difference `stats.damageByTower` (`dmg`); `owners`
 * remembers each girl's player so a girl sold mid-period still counts for them (kept up to date by foeEvent);
 * `kills`: each girl's `t.kills` (Show Her Around); `sky`: flyers that got past halfway (Sky Guard).
 */
export function storeBaseline(sim) {
  const ty = sim.tryout;
  const owners = {};
  const kills = {};
  for (const t of sim.towers) {
    owners[t.uid] = t.owner ?? 0;
    kills[t.uid] = t.kills || 0;
  }
  ty.base = {
    leaks: sim.stats.leaks,
    earned: sim.stats.cashEarned,
    ctr: ty.ctr.map((c) => ({ ...c })),
    slow: false,
    bossSeen: 0,
    bossFail: false,
    dmg: { ...sim.stats.damageByTower },
    owners,
    seen: sim.stats.towersPlaced,
    kills,
    sky: 0,
  };
  ty.periodScore = 0;
  ty.best = bestPossible(sim, ty.period);
  fixShow(sim);
}

/** New girls since the last look go into the baseline's owner map (cheap: only when one was placed). */
function syncOwners(sim) {
  const b = sim.tryout.base;
  if (!b?.owners || b.seen === sim.stats.towersPlaced) return;
  b.seen = sim.stats.towersPlaced;
  for (const t of sim.towers) if (b.owners[t.uid] == null) b.owners[t.uid] = t.owner ?? 0;
}

/** Is a foe a flyer (Sky Guard)? Children never count (they enter the road part-way). */
const isFlyer = (e) => e.parentUid == null && (!!e.airborne || !!e.traits?.airborne);

/**
 * A foe event (tryoutSpawn / tryoutKill / tryoutLeak; kind 0 spawn, 1 kill, 2 leak): the owner map, Sky Guard
 * (a flyer that falls or leaks at or past halfway, in 1/1024ths of its road like killPoints), and Show Her
 * Around locking in once her copies reach the bar (selling a copy later cannot undo it).
 */
export function foeEvent(sim, e, kind) {
  const ty = sim.tryout;
  const b = ty.base;
  if (!b?.owners) return;
  syncOwners(sim);
  if (kind === 0) return;
  if (isFlyer(e)) {
    const len = sim.pathData[e.pathIndex]?.length || 1;
    const q = Math.floor((1024 * e.dist) / len);
    if (kind === 2 || q >= A.a_sky.half) b.sky++;
  }
  if (kind === 1 && ty.assign?.period === ty.period) {
    ty.assign.own.forEach((list, o) => {
      for (const x of list) {
        if (x.id !== 'a_show' || x.lock || x.st !== 0 || !x.unit) continue;
        if (showKills(sim, o, x.unit) >= showGoal(ty.period)) x.lock = 1;
      }
    });
  }
}

/**
 * The period's damage so far, one row per girl (float sums in uid order, deterministic):
 * { uid, d, owner (-1: unknown, co-op only), unit, isHero }.
 */
function periodDamage(sim) {
  const b = sim.tryout.base;
  const all = sim.stats.damageByTower;
  const rows = [];
  for (const k of Object.keys(all)) {
    const d = all[k] - (b.dmg?.[k] || 0);
    if (!(d > 0)) continue;
    const t = sim.getTower(+k);
    const owner = t ? t.owner ?? 0 : b.owners?.[k] ?? (sim.tryout.coop ? -1 : 0);
    rows.push({ uid: +k, d, owner, unit: t ? t.unitId : sim.stats.towerUnits[k], isHero: !!t?.isHero });
  }
  return rows;
}

const sumD = (rows) => rows.reduce((x, r) => x + r.d, 0);

/** Last period's damage, kept at its end for the next draw: team total, and per player total / hero / by girl. */
function lastDamage(sim) {
  const rows = periodDamage(sim);
  const n = sim.tryout.players.length;
  const out = { total: sumD(rows), own: [], heroes: [], units: [] };
  for (let o = 0; o < n; o++) {
    const mine = rows.filter((r) => r.owner === o);
    out.own.push(sumD(mine));
    out.heroes.push(sumD(mine.filter((r) => r.isHero)));
    const units = {};
    for (const r of mine) if (!r.isHero && r.unit) units[r.unit] = (units[r.unit] || 0) + r.d;
    out.units.push(units);
  }
  return out;
}

/** Share test without division: part ≥ share % of total (and something was dealt). */
const shareOk = (part, total, share) => total > 0 && part * 100 >= share * total;
/** A share in whole percent for the HUD. */
const pctOf = (part, total) => (total > 0 ? Math.floor((part * 100) / total) : 0);

/** Show Her Around's bar for period p. */
function showGoal(p) {
  const k = A.a_show.kills;
  return k[Math.min(p, k.length - 1)] ?? 0;
}

/** This period's foes defeated by the player's copies of `unit` (on the field). */
function showKills(sim, owner, unit) {
  const b = sim.tryout.base;
  let n = 0;
  for (const t of sim.towers) {
    if (t.isHero || (t.owner ?? 0) !== owner || t.unitId !== unit) continue;
    n += (t.kills || 0) - (b.kills?.[t.uid] || 0);
  }
  return n;
}

/** Wave end inside a period: Speed Round's clock. */
export function waveEndCheck(sim) {
  const ty = sim.tryout;
  const q = sim._spawnQueue;
  const last = q.length ? q[q.length - 1].t : 0;
  if (sim._waveTime - last > targetsOf(ty.grade).speed + 1e-9) ty.base.slow = true;
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
  if (leaked || sim.time - e.tyAt > targetsOf(sim.tryout.grade).quick + 1e-9) sim.tryout.base.bossFail = true;
}

/** Tight Budget's bar for a player: 40 % of last period's income (a co-op player's share), at least 600. */
export function budgetOf(sim) {
  const ty = sim.tryout;
  const last = ty.lastIncome || 0;
  return Math.max(A.a_budget.min, Math.floor((last * A.a_budget.share) / 100 / ty.players.length));
}

/** A player's drawn entry for `id` (the period's slot 3 list; team entries for a team id). */
function entryOf(ty, id, owner) {
  const a = ty.assign;
  if (!a) return null;
  return (a.own[owner] || []).find((x) => x.id === id) || a.team.find((x) => x.id === id) || null;
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
    const tg = targetsOf(ty.grade);
    const ace = () => Math.ceil((bestPossible(sim, ty.assign?.period ?? ty.period + 1) * tg.ace) / 100);
    const p = ty.assign?.period ?? ty.period + 1;
    const goal = id === 'a_ace' ? ace() : {
      a_speed: tg.speed, a_quick: tg.quick, a_small: A.a_small.max, a_learner: A.a_learner.tiers, a_budget: budgetOf(sim),
      a_guest: A.a_guest.share, a_save: A.a_save.share, a_star: A.a_star.share, a_show: showGoal(p), a_window: A.a_window.share,
      a_team: A.a_team.types, a_finish: A.a_finish.ults,
    }[id] ?? 0;
    const unit = id === 'a_star' || id === 'a_show' ? { unit: entryOf(ty, id, owner)?.unit ?? null } : null;
    return { st: 0, cur: 0, goal, ...unit };
  }
  const done = (ok) => (ok ? 1 : final ? -1 : 0);
  // a share moves both ways while the period runs: judged only at its end (open until then)
  const fin = (ok) => (final ? (ok ? 1 : -1) : 0);
  switch (id) {
    case 'a_hearts': {
      const lost = sim.stats.leaks - b.leaks;
      return { st: lost > 0 ? -1 : final ? 1 : 0, cur: lost, goal: 0 };
    }
    case 'a_ace': {
      const goal = Math.ceil((ty.best * targetsOf(ty.grade).ace) / 100);
      return { st: done(ty.periodScore >= goal), cur: ty.periodScore, goal };
    }
    case 'a_speed':
      return { st: b.slow ? -1 : final ? 1 : 0, cur: 0, goal: targetsOf(ty.grade).speed };
    case 'a_quick':
      return { st: b.bossFail ? -1 : final ? (b.bossSeen > 0 ? 1 : -1) : 0, cur: 0, goal: targetsOf(ty.grade).quick };
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
    case 'a_sky':
      // cur: flyers that got past halfway (each fails it)
      return { st: b.sky > 0 ? -1 : final ? 1 : 0, cur: b.sky || 0, goal: 0 };
    case 'a_guest': {
      // a team assignment: every player's hero against the team's damage (solo: hers against all)
      const rows = periodDamage(sim);
      const hero = sumD(rows.filter((r) => r.isHero));
      const total = sumD(rows);
      return { st: fin(shareOk(hero, total, A.a_guest.share)), cur: pctOf(hero, total), goal: A.a_guest.share };
    }
    case 'a_save': {
      // coins in hand ≥ share % of the period's income (cashEarned since the period started)
      const income = sim.stats.cashEarned - b.earned;
      const goal = Math.ceil((A.a_save.share * income) / 100);
      const cash = Math.floor(sim.cash);
      return { st: final ? (cash * 100 >= A.a_save.share * income ? 1 : -1) : 0, cur: cash, goal };
    }
    case 'a_star': {
      const unit = entryOf(ty, id, owner)?.unit ?? null;
      const mine = periodDamage(sim).filter((r) => r.owner === owner);
      const her = sumD(mine.filter((r) => !r.isHero && r.unit === unit));
      const total = sumD(mine);
      return { st: fin(!!unit && shareOk(her, total, A.a_star.share)), cur: pctOf(her, total), goal: A.a_star.share, unit };
    }
    case 'a_show': {
      const x = entryOf(ty, id, owner);
      const unit = x?.unit ?? null;
      const goal = showGoal(ty.period);
      const n = unit ? showKills(sim, owner, unit) : 0;
      return { st: x?.lock || (unit && n >= goal) ? 1 : final ? -1 : 0, cur: x?.lock ? Math.max(n, goal) : n, goal, unit };
    }
    case 'a_window': {
      // the player's girls holding a Window Seat now, their damage this period against the player's
      const held = new Set(ty.seats.holder.filter((u) => u != null));
      const mine = periodDamage(sim).filter((r) => r.owner === owner);
      const seat = sumD(mine.filter((r) => held.has(r.uid)));
      const total = sumD(mine);
      return { st: fin(shareOk(seat, total, A.a_window.share)), cur: pctOf(seat, total), goal: A.a_window.share };
    }
    case 'a_team': {
      // girl types (all copies) each dealing ≥ share % of the player's damage (the hero counts in the total only)
      const mine = periodDamage(sim).filter((r) => r.owner === owner);
      const total = sumD(mine);
      const by = {};
      for (const r of mine) if (!r.isHero && r.unit) by[r.unit] = (by[r.unit] || 0) + r.d;
      const n = Object.keys(by).filter((u) => shareOk(by[u], total, A.a_team.share)).length;
      return { st: fin(n >= A.a_team.types), cur: n, goal: A.a_team.types };
    }
    case 'a_finish': {
      const n = delta(sim, owner, 'ults');
      return { st: n >= A.a_finish.ults ? 1 : final ? -1 : 0, cur: n, goal: A.a_finish.ults };
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
    if (a.st !== 0) return { id: a.id, st: a.st, cur: 0, goal: 0, ...(a.unit ? { unit: a.unit } : null) };
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
  ty.lastDmg = lastDamage(sim);
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
