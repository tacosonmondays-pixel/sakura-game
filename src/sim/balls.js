// The bowler (Marumi, Strike Bowler; docs/specs/UNIT_GAPS.md §5.9, P-5): she rolls bomb balls UP the
// road, against the flow of enemies, from the road point nearest her. A ball travels ball.speed tiles a
// second for up to ball.travel tiles toward the spawn and explodes on the first walker it touches: her
// hit as a blast (splash, knockback along the path with the push lock, her statuses). Flyers are never
// touched by a ball (Lob, Spin Shot tier 2, throws an arcing bomb at them instead).
//   - Wrecking Ball: the ball bowls through ball.through walkers (a hit each) before it explodes.
//   - Split Pins: a blast throws ball.pins pins along the road: each hits a walker on that road within
//     PIN_REACH tiles of the blast (nearest first, again round the list while pins are left; at most
//     ball.pinPierce pins on one walker) for ball.pinDmg.
//   - Hook Spin: a lane with no walker in her range sends the ball to the nearest lane that has one.
//     Split Lane: a second ball on the next lane with a walker.
//   - Sticky Ball: a ball that meets an elite, miniboss or boss sticks to it for ball.stickyTime s, then
//     explodes for × ball.sticky (at most ball.stickyStack balls on one enemy).
//
// State: t.balls [{ uid, pathIndex, dist, left, through, hit: [uids], stuck: { uid, left } | null }];
// they end at the wave clear (UNIT_GAPS §7.3). A ball on a stretch shared with another path (a fork's
// prefix or a join's suffix) only touches walkers on its own path (P-17 is not wired yet).
//
// Determinism: path distances and pointAt (no trig), squared distances, the fixed step, uid tie-breaks,
// no rng. Caps: BALLS_PER_GIRL, then BALLS_PER_SIM (her oldest ball goes first; a full sim rolls none).

import { pointAt, samplePath } from './path.js';
import { isEligible } from './combat.js';
import { gatherTargets, spawnProjectile } from './towers.js';
import { BALL_RADIUS, BALLS_PER_GIRL, BALLS_PER_SIM, PIN_REACH } from './constants.js';

const NEAR = [];
const PT = {};
const STICKY_TIERS = { elite: true, miniboss: true, boss: true };

/** The road point nearest (x, y) on each visible path, nearest first (ties: lower path index). */
function laneStarts(sim, t) {
  const out = [];
  for (const path of sim.pathData) {
    let best = null;
    for (const s of samplePath(path, 0.25)) {
      if (s.hidden) continue;
      const dx = s.x - t.x;
      const dy = s.y - t.y;
      const d2 = dx * dx + dy * dy;
      if (!best || d2 < best.d2) best = { pathIndex: path.index, dist: s.d, d2 };
    }
    if (best) out.push(best);
  }
  out.sort((a, b) => a.d2 - b.d2 || a.pathIndex - b.pathIndex);
  return out;
}

/** Her lane starts, cached per girl until her spot or the route changes (outside the sim state). */
const LANE_CACHE = new WeakMap();
function lanesOf(sim, t) {
  const c = LANE_CACHE.get(t);
  if (c && c.paths === sim.pathData && c.x === t.x && c.y === t.y) return c.list;
  const list = laneStarts(sim, t);
  LANE_CACHE.set(t, { paths: sim.pathData, x: t.x, y: t.y, list });
  return list;
}

/** One ball of hers on `lane` (her cap, then the sim's). */
export function addBall(sim, t, lane) {
  const b = t.stats.ball;
  const balls = t.balls || (t.balls = []);
  if (balls.length >= BALLS_PER_GIRL) balls.shift();
  let all = 0;
  for (const o of sim.towers) all += o.balls?.length || 0;
  if (all >= BALLS_PER_SIM) {
    if (!balls.length) return null;
    balls.shift();
  }
  const ball = { uid: sim._nextUid(), pathIndex: lane.pathIndex, dist: lane.dist, left: b.travel, through: b.through, hit: [], stuck: null };
  balls.push(ball);
  sim._emit('ball', { towerUid: t.uid, uid: ball.uid, pathIndex: ball.pathIndex, dist: ball.dist });
  return ball;
}

/**
 * The 'roll' behaviour: a ball on her lane when a walker is in her range there (Hook Spin: on the
 * nearest lane that has one; Split Lane: a second lane too); else a Lob at a flyer; else no attack.
 */
export function rollBall(sim, t) {
  if (sim.state !== 'wave') return false;
  const b = t.stats.ball;
  const walkers = gatherTargets(sim, t.x, t.y, t.eff.range, t.ballSpec, NEAR);
  const laneHas = new Set();
  for (let i = 0; i < walkers.length; i++) laneHas.add(walkers[i].pathIndex);
  NEAR.length = 0;
  // her own lane (the nearest) when a walker is on it; with Hook Spin every lane with one, nearest first
  const lanes = lanesOf(sim, t);
  let rolled = 0;
  let first = null;
  for (let i = 0; i < lanes.length && rolled < b.lanes; i++) {
    if (i > 0 && !b.hook) break;
    const lane = lanes[i];
    if (!laneHas.has(lane.pathIndex)) continue;
    if (addBall(sim, t, lane)) {
      rolled++;
      if (!first) first = lane;
    }
  }
  if (rolled) {
    const p = pointAt(sim.pathData[first.pathIndex], first.dist, PT);
    t.facing = Math.atan2(p.x - t.x, p.y - t.y);
    sim._emit('attack', { towerUid: t.uid, targetUid: null, kind: 'roll', n: rolled });
    return true;
  }
  // Lob (Spin Shot tier 2): only flyers in range, an arcing bomb at the lead one
  if (b.lob && t.lobSpec) {
    const air = gatherTargets(sim, t.x, t.y, t.eff.range, t.lobSpec, NEAR);
    let best = null;
    for (let i = 0; i < air.length; i++) if (!best || air[i].remaining < best.remaining || (air[i].remaining === best.remaining && air[i].uid < best.uid)) best = air[i];
    NEAR.length = 0;
    if (best) {
      t.facing = Math.atan2(best.x - t.x, best.y - t.y);
      spawnProjectile(sim, t, t.lobSpec, best, t.x, t.y, { kind: 'shell' });
      sim._emit('attack', { towerUid: t.uid, targetUid: best.uid, kind: 'lob' });
      return true;
    }
  }
  return false;
}

/** A blast of hers at (x, y): her hit (× scale) on every eligible enemy within her splash, then the pins. */
function blast(sim, t, x, y, scale, pathIndex) {
  const spec = t.blastSpec;
  const r = Math.max(0.3, t.eff.splash);
  NEAR.length = 0;
  sim.grid.query(x, y, r, NEAR);
  const victims = NEAR.slice();
  NEAR.length = 0;
  for (const e of victims) if (!e.dead && isEligible(e, spec)) sim._hit(e, t, spec, scale);
  sim._emit('explode', { x, y, radius: r, element: spec.element || null, attackType: spec.attackType, towerUid: t.uid });
  const b = t.stats.ball;
  if (b.pins > 0) pins(sim, t, x, y, pathIndex, b);
}

function pins(sim, t, x, y, pathIndex, b) {
  const spec = t.pinSpec;
  sim.grid.query(x, y, PIN_REACH, NEAR);
  const list = [];
  for (let i = 0; i < NEAR.length; i++) {
    const e = NEAR[i];
    if (e.dead || e.pathIndex !== pathIndex || !isEligible(e, spec)) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    list.push({ e, d2: dx * dx + dy * dy });
  }
  NEAR.length = 0;
  if (!list.length) return;
  list.sort((a, c) => a.d2 - c.d2 || a.e.uid - c.e.uid);
  let left = b.pins;
  for (let round = 0; round < b.pinPierce && left > 0; round++) {
    for (let i = 0; i < list.length && left > 0; i++) {
      if (list[i].e.dead) continue;
      sim._hit(list[i].e, t, spec, 1);
      left--;
    }
  }
  sim._emit('pins', { towerUid: t.uid, x, y, n: b.pins - left });
}

/** One step of her balls (updateTower): roll, touch, bowl through, stick, explode. */
export function ballTick(sim, t, dt) {
  const list = t.balls;
  if (!list?.length) return;
  const b = t.stats.ball;
  const r2 = BALL_RADIUS * BALL_RADIUS;
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    const ball = list[i];
    if (stepBall(sim, t, b, ball, dt, r2)) list[n++] = ball;
  }
  list.length = n;
}

/** @returns {boolean} the ball is still around */
function stepBall(sim, t, b, ball, dt, r2) {
  const path = sim.pathData[ball.pathIndex];
  if (!path) return false;
  if (ball.stuck) {
    const s = ball.stuck;
    const e = sim.enemies.find((o) => o.uid === s.uid);
    s.left -= dt;
    if (e && !e.dead) {
      s.x = e.x;
      s.y = e.y;
      if (s.left > 1e-9) return true;
    }
    const x = e ? e.x : s.x;
    const y = e ? e.y : s.y;
    blast(sim, t, x, y, b.sticky, ball.pathIndex);
    return false;
  }
  const step = b.speed * dt;
  ball.dist -= step;
  ball.left -= step;
  if (ball.dist <= 0 || ball.left <= 0) {
    sim._emit('ballEnd', { towerUid: t.uid, uid: ball.uid });
    return false;
  }
  const p = pointAt(path, ball.dist, PT);
  sim.grid.query(p.x, p.y, BALL_RADIUS + 0.5, NEAR);
  let hit = null;
  let hitD = Infinity;
  for (let i = 0; i < NEAR.length; i++) {
    const e = NEAR[i];
    if (e.dead || e.pathIndex !== ball.pathIndex || ball.hit.includes(e.uid) || !isEligible(e, t.ballSpec)) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    if (d2 < hitD || (d2 === hitD && e.uid < hit.uid)) {
      hit = e;
      hitD = d2;
    }
  }
  NEAR.length = 0;
  if (!hit) return true;
  if (ball.through > 0) {
    // Wrecking Ball: a hit as it bowls through
    ball.through--;
    ball.hit.push(hit.uid);
    sim._hit(hit, t, t.blastSpec, 1);
    return true;
  }
  if (b.sticky > 0 && STICKY_TIERS[hit.tier]) {
    let on = 0;
    for (const o of t.balls) if (o.stuck && o.stuck.uid === hit.uid) on++;
    if (on < b.stickyStack) {
      ball.stuck = { uid: hit.uid, left: b.stickyTime, x: hit.x, y: hit.y };
      sim._emit('ballStick', { towerUid: t.uid, uid: ball.uid, targetUid: hit.uid });
      return true;
    }
  }
  blast(sim, t, hit.x, hit.y, 1, ball.pathIndex);
  return false;
}

/** Wave clear (Sim._checkWaveEnd): every ball ends. */
export function endBallWave(sim) {
  for (const t of sim.towers) if (t.balls) delete t.balls;
}
