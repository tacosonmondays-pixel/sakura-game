// The bowler (Marumi, Strike Bowler; docs/specs/UNIT_GAPS.md §5.9, P-5): she rolls bomb balls UP the
// road, against the flow of enemies, from the road point nearest her. A ball travels ball.speed tiles a
// second for up to ball.travel tiles toward the spawn and explodes on the first walker it touches: her
// hit as a blast (splash, knockback along the path with the push lock, her statuses). The walker the
// ball meets takes the full blast, the others in it ball.share of it. Flyers are never touched by a
// ball: when only flyers are in her range she lobs an arcing bomb at the lead one for ball.lobMul of
// her blast (her base kit, every path).
//   - Wrecking Ball: the ball bowls through ball.through walkers (a hit each) before it explodes.
//   - Split Pins: a blast throws ball.pins pins along the road: each hits a walker on that road within
//     PIN_REACH tiles of the blast (nearest first, again round the list while pins are left; at most
//     ball.pinPierce pins on one walker) for ball.pinDmg.
//   - Hook Spin: a lane with no walker in her range sends the ball to the nearest lane that has one.
//   - Ricochet (Spin Shot): after a blast the ball bounces ball.bounce times: it flies BOUNCE_SPEED
//     tiles a second straight at the nearest OTHER walker within ball.reach tiles of the blast (squared
//     distance, uid tie-break; never a flyer, a walker in a tunnel or a veiled one she cannot see, never
//     one this ball already hit) and explodes on it. A target that falls or slips out of reach on the
//     way is swapped for the nearest one from where the ball is; none, or a leg longer than
//     BOUNCE_MAX_T, and the ball is gone. Glow Bowl: the blast after the last bounce of a full run is a
//     finale, × ball.finish and FINALE_RADIUS × the radius.
//
// State: t.balls [{ uid, pathIndex, dist, left, through, bounce, hit: [uids], fly: { uid, x, y, t } | null }]
// (fly: a bouncing ball off the road, its target, where it is and how long this leg has flown);
// they end at the wave clear (UNIT_GAPS §7.3), so a battle save (always at a calm point) holds none.
//
// Shared stretches (P-17): a ball rolls on one pathIndex, but where that road is shared with another
// path (a fork's prefix, a join's suffix) it touches the walkers of both: a walker on another path
// counts when it is within the ball's reach AND its road runs the same way there (unit direction dot
// > SHARED_DOT). A crossing or an overpass meets at an angle, so the other road's walkers are ignored.
// Her own lane is every path whose nearest road point is her lane's (a shared stretch at her spot):
// a walker on any of them lets her roll, on the path that walker is on.
//
// Determinism: path distances and pointAt (no trig), squared distances and Math.sqrt, the fixed step,
// uid tie-breaks, no rng. Caps: BALLS_PER_GIRL, then BALLS_PER_SIM (her oldest ball goes first; a full
// sim rolls none).

import { pointAt, samplePath } from './path.js';
import { isEligible } from './combat.js';
import { gatherTargets, spawnProjectile } from './towers.js';
import { BALL_RADIUS, BALLS_PER_GIRL, BALLS_PER_SIM, PIN_REACH, BOUNCE_SPEED, BOUNCE_MAX_T, FINALE_RADIUS } from './constants.js';

const NEAR = [];
const PT = {};
const SHARED_DOT = 0.95;
/** Two lanes start on the same road when their nearest points are this close (squared tiles). */
const SAME_SPOT2 = 0.3 * 0.3;

/** Is walker `e` on the same physical road as a ball on `path` at segment `seg` (P-17)? */
function sameRoad(sim, e, pathIndex, path, seg) {
  if (e.pathIndex === pathIndex) return true;
  const other = sim.pathData[e.pathIndex];
  if (!other || e.seg == null) return false;
  const a = path.dirs[seg];
  const b = other.dirs[e.seg];
  return !!a && !!b && a[0] * b[0] + a[1] * b[1] > SHARED_DOT;
}

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
      if (!best || d2 < best.d2) best = { pathIndex: path.index, dist: s.d, d2, x: s.x, y: s.y };
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

function sameSpot(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy <= SAME_SPOT2;
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
  const ball = { uid: sim._nextUid(), pathIndex: lane.pathIndex, dist: lane.dist, left: b.travel, through: b.through, bounce: b.bounce, hit: [], fly: null };
  balls.push(ball);
  sim._emit('ball', { towerUid: t.uid, uid: ball.uid, pathIndex: ball.pathIndex, dist: ball.dist });
  return ball;
}

/**
 * The 'roll' behaviour: a ball on her lane when a walker is in her range there (Hook Spin: on the
 * nearest lane that has one); else a lob at the lead flyer; else no attack.
 */
export function rollBall(sim, t) {
  if (sim.state !== 'wave') return false;
  const b = t.stats.ball;
  const walkers = gatherTargets(sim, t.x, t.y, t.eff.range, t.ballSpec, NEAR);
  const laneHas = new Set();
  for (let i = 0; i < walkers.length; i++) laneHas.add(walkers[i].pathIndex);
  NEAR.length = 0;
  // her own lane (the nearest, with any path sharing its road there) when a walker is on it; with
  // Hook Spin the nearest lane that has one
  const lanes = lanesOf(sim, t);
  let rolled = null;
  for (let i = 0; i < lanes.length && !rolled; i++) {
    const lane = lanes[i];
    if (i > 0 && !b.hook && !sameSpot(lane, lanes[0])) continue;
    if (!laneHas.has(lane.pathIndex)) continue;
    if (addBall(sim, t, lane)) rolled = lane;
  }
  if (rolled) {
    const p = pointAt(sim.pathData[rolled.pathIndex], rolled.dist, PT);
    t.facing = Math.atan2(p.x - t.x, p.y - t.y);
    sim._emit('attack', { towerUid: t.uid, targetUid: null, kind: 'roll', n: 1 });
    return true;
  }
  // the lob (her base kit): only flyers in range, an arcing bomb at the lead one
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

/**
 * A blast of hers on walker `e` (× scale, radius × rMul): the full hit on `e`, ball.share of it on
 * every other eligible enemy within her splash, then the pins.
 */
function blast(sim, t, e, scale, rMul) {
  const spec = t.blastSpec;
  const b = t.stats.ball;
  const x = e.x;
  const y = e.y;
  const r = Math.max(0.3, t.eff.splash) * rMul;
  NEAR.length = 0;
  sim.grid.query(x, y, r, NEAR);
  const victims = NEAR.slice();
  NEAR.length = 0;
  if (!e.dead && isEligible(e, spec)) sim._hit(e, t, spec, scale);
  for (const o of victims) if (o !== e && !o.dead && isEligible(o, spec)) sim._hit(o, t, spec, scale * b.share);
  sim._emit('explode', { x, y, radius: r, element: spec.element || null, attackType: spec.attackType, towerUid: t.uid });
  if (b.pins > 0) pins(sim, t, x, y, e.pathIndex, e.seg ?? 0, b);
}

function pins(sim, t, x, y, pathIndex, seg, b) {
  const path = sim.pathData[pathIndex];
  if (!path) return;
  const spec = t.pinSpec;
  sim.grid.query(x, y, PIN_REACH, NEAR);
  const list = [];
  for (let i = 0; i < NEAR.length; i++) {
    const e = NEAR[i];
    if (e.dead || !isEligible(e, spec) || !sameRoad(sim, e, pathIndex, path, seg)) continue;
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

/**
 * The walker a bouncing ball goes for from (x, y): the nearest eligible walker within `reach` that
 * the ball has not hit yet (squared distance, then the lower uid), or null.
 */
export function nextWalker(sim, t, x, y, reach, hit) {
  sim.grid.query(x, y, reach, NEAR);
  const r2 = reach * reach;
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < NEAR.length; i++) {
    const e = NEAR[i];
    if (e.dead || hit.includes(e.uid) || !isEligible(e, t.ballSpec)) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    if (d2 < bestD || (d2 === bestD && e.uid < best.uid)) {
      best = e;
      bestD = d2;
    }
  }
  NEAR.length = 0;
  return best;
}

/**
 * The ball meets walker `e`: it explodes (a Glow Bowl finale after the last bounce of a full run),
 * then bounces on to the next walker while it has bounces left.
 * @returns {boolean} the ball is still around
 */
function strike(sim, t, b, ball, e) {
  ball.hit.push(e.uid);
  const fin = !!ball.fly && ball.bounce <= 0 && b.finish > 0;
  const n = ball.hit.length;
  blast(sim, t, e, fin ? b.finish : 1, fin ? FINALE_RADIUS : 1);
  const x = e.x;
  const y = e.y;
  const next = ball.bounce > 0 ? nextWalker(sim, t, x, y, b.reach, ball.hit) : null;
  sim._emit('ballPop', { towerUid: t.uid, uid: ball.uid, x, y, n, fin, tx: next ? next.x : null, ty: next ? next.y : null });
  if (!next) return false;
  ball.bounce--;
  if (ball.fly) {
    ball.fly.uid = next.uid;
    ball.fly.x = x;
    ball.fly.y = y;
    ball.fly.t = 0;
  } else {
    ball.fly = { uid: next.uid, x, y, t: 0 };
  }
  return true;
}

/** One step of her balls (updateTower): roll, touch, bowl through, explode, bounce. */
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
  if (ball.fly) return flyBall(sim, t, b, ball, dt);
  const path = sim.pathData[ball.pathIndex];
  if (!path) return false;
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
    if (e.dead || ball.hit.includes(e.uid) || !isEligible(e, t.ballSpec) || !sameRoad(sim, e, ball.pathIndex, path, p.seg)) continue;
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
  return strike(sim, t, b, ball, hit);
}

/** A bouncing ball off the road: straight at its walker, BOUNCE_SPEED tiles a second. */
function flyBall(sim, t, b, ball, dt) {
  const f = ball.fly;
  f.t += dt;
  let e = null;
  for (const o of sim.enemies) {
    if (o.uid === f.uid) {
      e = o;
      break;
    }
  }
  if (!e || e.dead || !isEligible(e, t.ballSpec)) {
    e = nextWalker(sim, t, f.x, f.y, b.reach, ball.hit);
    if (e) f.uid = e.uid;
  }
  if (!e || f.t > BOUNCE_MAX_T) {
    sim._emit('ballEnd', { towerUid: t.uid, uid: ball.uid });
    return false;
  }
  const dx = e.x - f.x;
  const dy = e.y - f.y;
  const d2 = dx * dx + dy * dy;
  const step = BOUNCE_SPEED * dt;
  const reach = step + BALL_RADIUS;
  if (d2 <= reach * reach) {
    f.x = e.x;
    f.y = e.y;
    return strike(sim, t, b, ball, e);
  }
  const d = Math.sqrt(d2);
  f.x += (dx / d) * step;
  f.y += (dy / d) * step;
  return true;
}

/** Wave clear (Sim._checkWaveEnd): every ball ends. */
export function endBallWave(sim) {
  for (const t of sim.towers) if (t.balls) delete t.balls;
}
