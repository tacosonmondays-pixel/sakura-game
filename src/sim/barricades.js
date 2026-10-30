// Norika's barricades (docs/specs/BANNERS.md §D.4; UNIT_GAPS §5.11, P-11 blockers, P-17 shared stretches).
//
//   - Her own barricades: `barricade.count` of them on the road inside her range, at the road points nearest
//     the exit (STRIP_SPOT_STEP samples, BARRICADE_SPACING apart; never inside a tunnel). A ground enemy that
//     reaches a standing one stops there (its path distance is clamped at the barricade) and drains its hold
//     budget every step by its tier (BARRICADE_DRAIN, a second's worth spread over the step's ticks). Flyers
//     pass over. A blinker's blink is a jump of its path distance before it moves, so it hops a barricade.
//     A broken barricade is rebuilt (full budget) `rebuild` s later. Her barricades re-site when she Moves
//     (resiteBarricades) and refill at every wave clear.
//   - Hold the Line (her ult, src/sim/hero.js): `count` temporary barricades at the aim's road point, LINE_GAP
//     apart toward the exit, for `duration` s; bosses walk through them, minibosses too before rank 3. They end
//     when broken, when their time runs out and at the wave clear.
//   - Shared stretches: a barricade stops enemies on every road whose centreline passes within BARRICADE_SHARED
//     of it in the same direction (a crossing road or an overpass is ignored), at the matching distance on each.
//   - Her track: held enemies take +held damage (combat.js damageTakenBonus), Bright Sash reveals them, Bounce
//     Back knocks an enemy that reaches a full barricade back once, Water-filled Barriers slow the walkers around
//     a breaking one, Long Way Round slows the ones it releases, Fortress Gate halves a miniboss's drain,
//     One-Way Street sends the first `oneWay` enemies a wave back ONE_WAY_PUSH tiles, Detour Sign (see detourOnHit).
//
// State (plain data; the battle save keeps t.bars, src/ui/battle/snapshot.js):
//   t.bars   [{ uid, x, y, hp, max, down }]   her own: budget left and full (in drain units: a budget point =
//            TICKS drain units, so every drain is a whole number), ticks until rebuilt (0 = standing)
//   t.lines  [{ uid, x, y, hp, left, held, mini }]   Hold the Line's: budget, ticks left, extra held damage, stops minibosses
//   t.oneWayN  One-Way Street's count this wave
// The stops (road, distance) of a barricade are a pure function of its spot and the roads in use, cached outside
// the state (a WeakMap, like the strip and sentry spot caches) so a route that turns (Rear Ambush) recomputes them.
//
// Determinism: integer ticks and integer drains, fixed sample orders (nearest the exit, ties by road and
// distance), squared distances and dot products (no trig), enemies drain in array order, no rng.
// Cost: O(enemies × barricades) per step, and only in a battle with a barricade hero (sim._blockOn).

import { STEP, KNOCKBACK_RESIST, STRIP_SPOT_STEP } from './constants.js';
import {
  BARRICADES_PER_HERO, LINE_BARRICADES_MAX, BARRICADE_DRAIN, BARRICADE_SPACING, LINE_GAP, LINE_LEAD, BARRICADE_SHARED,
  BARRICADE_SAME_DIR, BARRICADE_REBUILD_MIN, ONE_WAY_PUSH, BREAK_SLOW_RADIUS, BREAK_SLOW_TIME, RELEASE_SLOW_TIME,
  DETOUR_NO_FORK_MUL, HELD_REVEAL,
} from './constants.js';
import { roadSpots } from './strips.js';
import { pointAt, pathInTunnel } from './path.js';
import { applyStatus } from './status.js';
import { syncStatusFlags, placeOnPath } from './enemies.js';

/** Ticks a second (a budget point is TICKS drain units; timers count ticks). */
export const TICKS = Math.round(1 / STEP);
const ticks = (s) => Math.max(0, Math.round(s * TICKS));
const EPS = 1e-9;

// ---------------------------------------------------------------------------
// Geometry: stops and spots
// ---------------------------------------------------------------------------

const STOPS = new WeakMap();

/**
 * Where barricade `b` stands on each road: [{ p (path index), d (distance) }], its own road first. A road
 * counts when its centreline passes within BARRICADE_SHARED of the spot in the direction of the nearest
 * road (a shared stretch), never inside a tunnel. Cached per barricade and set of roads.
 */
export function barricadeStops(sim, b) {
  const c = STOPS.get(b);
  if (c && c.paths === sim.pathData) return c.list;
  const near = [];
  for (const path of sim.pathData) {
    const n = nearestOnPath(path, b.x, b.y);
    if (n && n.d2 <= BARRICADE_SHARED * BARRICADE_SHARED && !pathInTunnel(path, n.d)) near.push(n);
  }
  near.sort((a, q) => a.d2 - q.d2 || a.p - q.p);
  const list = [];
  if (near.length) {
    const own = near[0];
    for (const n of near) if (n.dx * own.dx + n.dy * own.dy >= BARRICADE_SAME_DIR) list.push({ p: n.p, d: n.d });
  }
  STOPS.set(b, { paths: sim.pathData, list });
  return list;
}

/** The point of `path` nearest (x, y): { p, d, d2, dx, dy } (segment direction), or null. */
function nearestOnPath(path, x, y) {
  const pts = path.points;
  let best = null;
  for (let i = 0; i + 1 < pts.length; i++) {
    const ax = pts[i][0];
    const ay = pts[i][1];
    const sx = pts[i + 1][0] - ax;
    const sy = pts[i + 1][1] - ay;
    const len2 = sx * sx + sy * sy;
    let t = len2 > 0 ? ((x - ax) * sx + (y - ay) * sy) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = ax + sx * t - x;
    const cy = ay + sy * t - y;
    const d2 = cx * cx + cy * cy;
    if (!best || d2 < best.d2) {
      const dir = path.dirs[i];
      best = { p: path.index, d: path.cum[i] + (path.cum[i + 1] - path.cum[i]) * t, d2, dx: dir[0], dy: dir[1] };
    }
  }
  return best;
}

const SPOTS = new WeakMap();
/** Her road spots in range, nearest the exit first (cached outside the state, like the strip spots). */
function spotsOf(sim, t) {
  const range = t.eff.range;
  const c = SPOTS.get(t);
  if (c && c.range === range && c.paths === sim.pathData && c.x === t.x && c.y === t.y) return c.list;
  const list = roadSpots(sim, t.x, t.y, range);
  SPOTS.set(t, { range, paths: sim.pathData, x: t.x, y: t.y, list });
  return list;
}

/** Up to `n` spots for her barricades, BARRICADE_SPACING apart and away from `taken` ([{ x, y }]). */
function pickSpots(sim, t, n, taken) {
  const out = [];
  const s2 = BARRICADE_SPACING * BARRICADE_SPACING;
  const far = (p, list) => list.every((o) => (o.x - p.x) * (o.x - p.x) + (o.y - p.y) * (o.y - p.y) >= s2 - EPS);
  for (const p of spotsOf(sim, t)) {
    if (out.length >= n) break;
    if (far(p, out) && far(p, taken)) out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Her numbers
// ---------------------------------------------------------------------------

const FORKS = new WeakMap();
/** Two roads start at the same point (a fork after a shared start): the roads in use have a fork. */
export function hasFork(sim) {
  const c = FORKS.get(sim.pathData);
  if (c != null) return c;
  let fork = false;
  const P = sim.pathData;
  for (let i = 0; i < P.length && !fork; i++) {
    for (let j = i + 1; j < P.length && !fork; j++) {
      const a = P[i].points[0];
      const b = P[j].points[0];
      if ((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]) <= BARRICADE_SHARED * BARRICADE_SHARED) fork = true;
    }
  }
  FORKS.set(sim.pathData, fork);
  return fork;
}

/** A full budget of hers, in drain units (Detour Sign's +50% on a map without forks). */
export function barricadeMax(sim, br) {
  const mul = br.budgetMul * (br.detour && !hasFork(sim) ? DETOUR_NO_FORK_MUL : 1);
  return Math.max(1, Math.round(br.budget * mul * TICKS));
}

/** Ticks to rebuild a broken barricade of hers. */
export function rebuildTicks(br) {
  return ticks(Math.max(BARRICADE_REBUILD_MIN, br.rebuild - br.rebuildCut));
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/** Placement / Sim._refreshTower: a barricade hero gets her lists, and the sim its blocker count (and Kogane her Overdrive timer). */
export function syncBarricades(sim, t) {
  // (Kogane's Overdrive timer, src/sim/hero.js: present from placement on a hero whose stats carry it, so a
  // restored hero carries exactly the fields the saved one did)
  if (t?.stats?.overdrive && t.overdriveLeft == null) t.overdriveLeft = 0;
  if (!t || !t.stats?.barricade || t.bars) return;
  t.bars = [];
  t.lines = [];
  t.oneWayN = 0;
  sim._blockOn = (sim._blockOn || 0) + 1;
}

/** Sets missing barricades of hers (budgets follow her stats). */
function fillBars(sim, t) {
  const br = t.stats.barricade;
  const max = barricadeMax(sim, br);
  for (const b of t.bars) {
    if (b.max !== max) {
      // a level or an awakening changed her budget: the standing ones gain (or lose) the difference
      if (b.down === 0) b.hp = Math.max(1, Math.min(max, b.hp + max - b.max));
      b.max = max;
    }
  }
  const want = Math.min(BARRICADES_PER_HERO, br.count);
  while (t.bars.length > want) t.bars.pop();
  if (t.bars.length >= want) return;
  for (const p of pickSpots(sim, t, want - t.bars.length, t.bars)) {
    const b = { uid: sim._nextUid(), x: p.x, y: p.y, hp: max, max, down: 0 };
    t.bars.push(b);
    sim._emit('barricade', { towerUid: t.uid, uid: b.uid, x: b.x, y: b.y, kind: 'own' });
  }
}

/** A Move (hero.js moveHero): her barricades move to the spots of her new range, keeping budgets and timers. */
export function resiteBarricades(sim, t) {
  if (!t.bars) return;
  const old = t.bars;
  t.bars = [];
  const spots = pickSpots(sim, t, Math.min(BARRICADES_PER_HERO, t.stats.barricade.count), []);
  for (let i = 0; i < spots.length && i < old.length; i++) {
    const b = { ...old[i], x: spots[i].x, y: spots[i].y };
    t.bars.push(b);
    sim._emit('barricade', { towerUid: t.uid, uid: b.uid, x: b.x, y: b.y, kind: 'own' });
  }
  for (let i = spots.length; i < old.length; i++) sim._emit('barricadeEnd', { towerUid: t.uid, uid: old[i].uid, reason: 'moved' });
  fillBars(sim, t);
}

/** Every step (Sim._step1, before the enemies move), for every barricade hero: spots, budgets, rebuilds, Hold the Line timers. */
export function updateBarricades(sim) {
  const wave = sim.state === 'wave';
  for (const t of sim.heroes) {
    if (!t || t.removed || !t.bars) continue;
    fillBars(sim, t);
    for (const b of t.bars) {
      if (b.down > 0 && --b.down === 0) {
        b.hp = b.max;
        sim._emit('barricadeUp', { towerUid: t.uid, uid: b.uid, x: b.x, y: b.y });
      }
    }
    if (!wave || !t.lines.length) continue;
    let n = 0;
    for (const l of t.lines) {
      if (--l.left > 0 && l.hp > 0) t.lines[n++] = l;
      else sim._emit('barricadeEnd', { towerUid: t.uid, uid: l.uid, reason: l.hp > 0 ? 'time' : 'broken' });
    }
    t.lines.length = n;
  }
}

/** Wave clear (Sim._checkWaveEnd): Hold the Line ends, her own barricades stand again at full budget, One-Way Street resets. */
export function endBarricadeWave(sim) {
  for (const t of sim.heroes) {
    if (!t || !t.bars) continue;
    for (const l of t.lines) sim._emit('barricadeEnd', { towerUid: t.uid, uid: l.uid, reason: 'wave' });
    t.lines.length = 0;
    t.oneWayN = 0;
    for (const b of t.bars) {
      b.down = 0;
      b.hp = b.max;
    }
  }
}

/**
 * Hold the Line (hero.js activateUlt): `effect.count` (+ her lineAdd) temporary barricades at the road point
 * nearest her aim (else LINE_LEAD tiles ahead of the lead walker in her range), LINE_GAP apart toward the exit.
 * @returns {{ x: number, y: number }|null} the first one's spot, or null (nowhere to put one: the ult waits)
 */
export function holdTheLine(sim, t, effect, aim, lead) {
  const entry = lineEntry(sim, t, aim, lead);
  if (!entry) return null;
  const path = sim.pathData[entry.p];
  const br = t.stats.barricade;
  const count = Math.max(1, Math.round((effect.count || 1) + (br?.lineAdd || 0)));
  const hp = Math.max(1, Math.round((effect.budget || 0) * TICKS));
  const left = Math.max(1, ticks(effect.duration || 0));
  const out = [];
  const pt = {};
  for (let k = 0; k < count; k++) {
    const d = entry.d + k * LINE_GAP;
    if (d > path.length - 0.25) break;
    if (pathInTunnel(path, d)) continue;
    pointAt(path, d, pt);
    out.push({ uid: sim._nextUid(), x: pt.x, y: pt.y, hp, left, held: effect.held || 0, mini: !!effect.mini });
  }
  if (!out.length) return null;
  // the per-player cap: the oldest Hold the Line barricades of hers (then her partner hero's in co-op? never:
  // each hero is one player, so her own) go first
  for (const l of out) {
    t.lines.push(l);
    sim._emit('barricade', { towerUid: t.uid, uid: l.uid, x: l.x, y: l.y, kind: 'line', time: effect.duration });
  }
  while (t.lines.length > LINE_BARRICADES_MAX) {
    const old = t.lines.shift();
    sim._emit('barricadeEnd', { towerUid: t.uid, uid: old.uid, reason: 'cap' });
  }
  return { x: out[0].x, y: out[0].y };
}

/** The road point for Hold the Line: { p, d }, or null. */
function lineEntry(sim, t, aim, lead) {
  if (aim) {
    let best = null;
    for (const path of sim.pathData) {
      const n = nearestOnPath(path, aim.x, aim.y);
      if (n && !pathInTunnel(path, n.d) && (!best || n.d2 < best.d2)) best = n;
    }
    return best ? { p: best.p, d: best.d } : null;
  }
  if (!lead) return null;
  const path = sim.pathData[lead.pathIndex];
  return { p: lead.pathIndex, d: Math.min(path.length - 0.25, lead.dist + LINE_LEAD) };
}

// ---------------------------------------------------------------------------
// The enemy step (src/sim/enemies.js updateEnemy, right after the move)
// ---------------------------------------------------------------------------

/**
 * A walker that moved from `prev` to e.dist this step: the first standing barricade it reached on its road
 * (the smallest stop distance in (prev, e.dist]) holds it there. Flyers pass over. Bosses walk through Hold
 * the Line, minibosses too unless it is rank 3.
 */
export function blockStep(sim, e, prev) {
  if (e.heldBy) {
    e.heldBy = 0;
    e.heldBonus = 0;
  }
  if (e.airborne) return;
  let best = null;
  let bestD = Infinity;
  let owner = null;
  let line = false;
  for (const t of sim.heroes) {
    if (!t || t.removed || !t.bars) continue;
    for (const b of t.bars) {
      if (b.down > 0) continue;
      const d = stopOn(sim, b, e, prev, bestD);
      if (d < bestD) {
        bestD = d;
        best = b;
        owner = t;
        line = false;
      }
    }
    if (e.tier === 'boss') continue;
    for (const l of t.lines) {
      if (l.hp <= 0 || (e.tier === 'miniboss' && !l.mini)) continue;
      const d = stopOn(sim, l, e, prev, bestD);
      if (d < bestD) {
        bestD = d;
        best = l;
        owner = t;
        line = true;
      }
    }
  }
  if (!best) return;
  // (only a walker that tried to go on pushes on it: a stunned one keeps its place and drains nothing)
  const pushing = e.dist > bestD + EPS;
  e.dist = bestD;
  const br = owner.stats.barricade;
  // One-Way Street: the first enemies of the wave to reach her barricades are sent back (bosses stay)
  if (pushing && !line && br.oneWay > 0 && !e.oneWayed && owner.oneWayN < br.oneWay) {
    e.oneWayed = true;
    owner.oneWayN++;
    if (push(e, ONE_WAY_PUSH[e.tier] ?? ONE_WAY_PUSH.normal)) {
      sim._emit('oneWay', { towerUid: owner.uid, uid: e.uid, x: e.x, y: e.y });
      return;
    }
  }
  // Bounce Back: an enemy that reaches one of her full barricades is knocked back once
  if (pushing && !line && br.bounce > 0 && !e.bounced && best.hp >= best.max) {
    e.bounced = true;
    if (push(e, br.bounce * (KNOCKBACK_RESIST[e.tier] ?? 1))) return;
  }
  e.heldBy = best.uid;
  e.heldBonus = br.held + (line ? best.held : 0);
  if (br.reveal) {
    const ctx = sim._statusCtx;
    ctx.element = null;
    ctx.attackType = null;
    ctx.sourceUid = owner.uid;
    applyStatus(e, { type: 'reveal', duration: HELD_REVEAL }, ctx);
    syncStatusFlags(e);
  }
  if (!pushing) return;
  let drain = BARRICADE_DRAIN[e.tier] ?? BARRICADE_DRAIN.normal;
  if (e.tier === 'miniboss' && br.miniHalf) drain = Math.ceil(drain / 2);
  best.hp -= drain;
  if (best.hp <= 0) breakBarricade(sim, owner, best, line);
}

/** The stop distance of barricade `b` on e's road reached this step (and nearer than `limit`), else Infinity. */
function stopOn(sim, b, e, prev, limit) {
  const stops = barricadeStops(sim, b);
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    if (s.p !== e.pathIndex) continue;
    // reached it this step, or still standing at it (a stunned or held walker keeps its place and its bonus)
    if (s.d < limit && prev <= s.d + EPS && e.dist >= s.d - EPS) return s.d;
  }
  return Infinity;
}

/** Pushes `e` back `tiles` along its road (the freeplay push budget applies). @returns {boolean} it moved */
function push(e, tiles) {
  let amt = tiles;
  if (e.kbLeft != null) {
    amt = Math.min(amt, e.kbLeft);
    e.kbLeft -= amt;
  }
  if (!(amt > 0)) return false;
  e.dist = Math.max(0, e.dist - amt);
  return true;
}

/** A barricade's budget ran out: hers is rebuilt later, Hold the Line's is gone; the slows of her track. */
function breakBarricade(sim, t, b, line) {
  const br = t.stats.barricade;
  b.hp = 0;
  if (!line) b.down = Math.max(1, rebuildTicks(br));
  sim._emit('barricadeBreak', { towerUid: t.uid, uid: b.uid, x: b.x, y: b.y, kind: line ? 'line' : 'own' });
  if (!(br.breakSlow > 0) && !(br.releaseSlow > 0)) return;
  const ctx = sim._statusCtx;
  ctx.element = null;
  ctx.attackType = t.eff.attackType;
  ctx.sourceUid = t.uid;
  const r2 = BREAK_SLOW_RADIUS * BREAK_SLOW_RADIUS;
  for (const q of sim.enemies) {
    if (q.dead || q.hidden || q.airborne) continue;
    if (br.breakSlow > 0) {
      const dx = q.x - b.x;
      const dy = q.y - b.y;
      if (dx * dx + dy * dy <= r2) applyStatus(q, { type: 'slow', amount: br.breakSlow, duration: BREAK_SLOW_TIME }, ctx);
    }
    if (br.releaseSlow > 0 && q.heldBy === b.uid) applyStatus(q, { type: 'slow', amount: br.releaseSlow, duration: RELEASE_SLOW_TIME }, ctx);
  }
}

// ---------------------------------------------------------------------------
// Detour Sign (her waves at forks)
// ---------------------------------------------------------------------------

/**
 * Sim._onHitEffects, on a hit of hers with Detour Sign: an enemy still on a stretch its road shares with a
 * LONGER road that starts at the same point takes the longest such road (once per enemy). Same prefix: the
 * longer road's point at the enemy's distance is where the enemy stands (BARRICADE_SHARED), and both roads
 * start at the same point, so its distance means the same on both and it keeps it.
 */
export function detourOnHit(sim, e) {
  if (e.dead || e.detoured || e.airborne || e.hidden) return;
  const P = sim.pathData;
  if (P.length < 2 || !hasFork(sim)) return;
  const cur = P[e.pathIndex];
  if (!cur) return;
  const a = cur.points[0];
  let best = null;
  const pt = {};
  for (const path of P) {
    if (path === cur || path.length <= (best ? best.length : cur.length)) continue;
    const b = path.points[0];
    if ((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]) > BARRICADE_SHARED * BARRICADE_SHARED) continue;
    pointAt(path, e.dist, pt);
    if ((pt.x - e.x) * (pt.x - e.x) + (pt.y - e.y) * (pt.y - e.y) > BARRICADE_SHARED * BARRICADE_SHARED) continue;
    best = path;
  }
  e.detoured = true;
  if (!best) return;
  e.pathIndex = best.index;
  e.seg = 0;
  placeOnPath(e, best);
  sim._emit('detour', { uid: e.uid, pathIndex: best.index });
}
