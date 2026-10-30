// Attack shapes, batch S5a (docs/specs/ATTACK_SHAPES_S5.md §3.3, §3.5, §3.6). Every girl keeps her live attack and
// the shape goes on top of it (rule 1); a shape hit is clean, unshared and rolls no crit (shapeSpec, rules 2 and 3); it
// rolls past what her attack just struck (rule 4); and it never takes room from a live object (rule 5).
//   - Charm Wheel (kit 'charms'; Miko's Purification T4-5): after each counted attack a wheel of charms.n + 1 spokes,
//     fixed to the world and turned charms.turn table steps a throw (t.wheelK), leaves her as straight charms; the
//     spoke nearest her target's line is left out, so no charm flies down it. A charm cuts the first enemy it meets
//     that her throw did not aim at (p.skip), × charms.mul.
//   - Crescent Return (kit 'cres'; Rei's Whirlwind T4-5): after each counted sweep one crescent flies from her toward
//     her lead target out to her range + cres.out, turns (an exact reversal) and comes back to where it was thrown. Each
//     leg cuts up to cres.cuts enemies her sweep did not strike (p.skip) × cres.mul; a leg whose cuts run out turns at
//     once (out) or ends (home). Its own cut branch never touches p.pierce (src/sim/towers.js projectileStep).
//   - Bell Toll (kit 'toll'; Suzu's Explosive Mines T4-5): every armed bell rings on its first armed step of a wave and
//     then every toll.every steps, sending one ring along the ground to toll.r tiles that strikes each walker it
//     crosses once × toll.mul of her trap hit. Its own list t.tolls and caps (never Kanna's quake rings); a full cap
//     defers a toll a step.
//
// Determinism (§2.4): directions from the shared table (nearestDir, wrapDir; no atan2); squared distances; integer
// step timers (a ring's radius is its step count × the growth); no rng of our own (shapeSpec rolls none); victims in
// the grid's order. State: t.wheelK (an integer), shape shots (straight projectile records with p.shape, p.skip and
// p.cres), t.tolls rings and each bell's tr.tollCd; all of it but tollCd ends at the wave clear (endS5Wave), which sets
// every surviving bell's tollCd to 1 (a restored trap without one reads 1), so calm saves carry a constant.

import { isEligible } from './combat.js';
import { nearestDir, wrapDir, dirAngle } from './dirs.js';
import { shapeSpec, inBand } from './shapes.js';
import { shapeRoom, spawnStraight } from './rings.js';
import {
  STEP, RING_DIRS, CHARMS_PER_GIRL, CHARM_SPEED, CRESCENTS_PER_GIRL, CRESCENT_SPEED, CRESCENT_HALF_WIDTH,
  TOLLS_PER_GIRL, TOLLS_PER_SIM, TOLL_SPEED,
} from './constants.js';

/** Does a girl's kit have an S5a shape that reads her attack's victims (t._struck)? */
export function hasStruckShape(s) {
  return !!(s && (s.charms || s.cres));
}

/** The circular distance between two table directions (0 … RING_DIRS / 2). */
function dirGap(a, b) {
  const d = wrapDir(a - b);
  return d > RING_DIRS / 2 ? RING_DIRS - d : d;
}

/**
 * The charm directions of one throw: m = n + 1 spokes at wheelK + floor(j × 240 / m), less the one nearest k0 (ties: the
 * lower j). Written into `out` in j order. @returns {number[]} out
 */
export function charmDirs(wheelK, n, k0, out = []) {
  out.length = 0;
  const m = n + 1;
  let drop = 0;
  let best = Infinity;
  for (let j = 0; j < m; j++) {
    const g = dirGap(wheelK + Math.floor((j * RING_DIRS) / m), k0);
    if (g < best) {
      best = g;
      drop = j;
    }
  }
  for (let j = 0; j < m; j++) if (j !== drop) out.push(wrapDir(wheelK + Math.floor((j * RING_DIRS) / m)));
  return out;
}

const DIRS = [];

/** After a counted attack (src/sim/towers.js updateTower): her S5a shot shapes, read from t._struck / t._lead. */
export function s5AfterAttack(sim, t) {
  const lead = t._lead;
  if (!lead) return;
  const s = t.stats;
  const k0 = nearestDir(lead.x - t.ox, lead.y - t.oy);
  if (s.charms) throwCharms(sim, t, s.charms, k0);
  if (s.cres) throwCrescent(sim, t, s.cres, k0);
}

function throwCharms(sim, t, c, k0) {
  const n = Math.max(0, Math.round(c.n));
  const wk = t.wheelK || 0;
  t.wheelK = wrapDir(wk + Math.round(c.turn));
  if (n <= 0) return;
  charmDirs(wk, n, k0, DIRS);
  const fit = shapeRoom(sim, t, n, CHARMS_PER_GIRL);
  if (fit <= 0) return;
  const spec = shapeSpec(t.eff, c.mul);
  const skip = t._struck.slice(); // one copy a throw, read-only (her next attack or an echo overwrites t._struck)
  for (let i = 0; i < fit; i++) {
    const p = spawnStraight(sim, t, spec, t.ox, t.oy, DIRS[i], t.eff.range, { pierce: 1, kind: 'charm', speed: CHARM_SPEED });
    p.shape = true;
    p.split = true; // mirrors never reflect a shape shot (src/sim/towers.js updateProjectiles)
    p.skip = skip;
  }
  sim._emit('s5', { towerUid: t.uid, kind: 'charms', k: k0, wheelK: wk, n: fit });
}

function throwCrescent(sim, t, c, k0) {
  if (shapeRoom(sim, t, 1, CRESCENTS_PER_GIRL) <= 0) return;
  const spec = shapeSpec(t.eff, c.mul);
  const p = spawnStraight(sim, t, spec, t.ox, t.oy, k0, t.eff.range + c.out, { pierce: 1, kind: 'crescent', speed: CRESCENT_SPEED });
  p.shape = true;
  p.split = true;
  p.skip = t._struck.slice();
  p.half = CRESCENT_HALF_WIDTH;
  p.cres = { leg: 0, n: 0, cuts: Math.max(1, Math.round(c.cuts)) };
  t.facing = dirAngle(k0);
  sim._emit('s5', { towerUid: t.uid, kind: 'cres', k: k0 });
}

/**
 * A crescent meets `e` (projectileStep's contact loop): it cuts; when this leg's cuts run out the out leg turns at once
 * and the way home ends. @returns {boolean} true: stop this step's contacts (it turned or ended)
 */
export function crescentCut(sim, p, e) {
  const c = p.cres;
  p.hits.push(e.uid);
  sim._hit(e, p.owner, p.spec, 1);
  c.n++;
  if (c.n < c.cuts) return false;
  if (!crescentFlip(p)) p.dead = true;
  return true;
}

/**
 * A crescent's turn (at maxTravel, or early when its out leg's cuts run out): an exact reversal, a fresh hit list and
 * count (its skip list stays), home along the way it flew out. @returns {boolean} false on the way home (it ends)
 */
export function crescentFlip(p) {
  const c = p.cres;
  if (c.leg !== 0) return false;
  c.leg = 1;
  c.n = 0;
  p.vx = -p.vx;
  p.vy = -p.vy;
  p.maxTravel = p.travel;
  p.travel = 0;
  p.hits.length = 0;
  return true;
}

// ---------------------------------------------------------------------------
// Bell Toll
// ---------------------------------------------------------------------------

/** An armed bell's step while a wave runs (src/sim/towers.js updateTraps, before its trigger check). */
export function tollBell(sim, tr, toll) {
  const cd = (tr.tollCd ?? 1) - 1;
  if (cd > 0) {
    tr.tollCd = cd;
    return;
  }
  // a full cap defers the toll a step (tollCd 1: it tries again next step)
  tr.tollCd = sendToll(sim, tr.owner, tr, toll) ? Math.max(1, Math.round(toll.every)) : 1;
}

function sendToll(sim, t, tr, toll) {
  if (!t || t.removed || !t.trapSpec) return false;
  const mine = t.tolls ? t.tolls.length : 0;
  if (mine >= TOLLS_PER_GIRL) return false;
  let all = 0;
  for (const o of sim.towers) if (o.tolls) all += o.tolls.length;
  if (all >= TOLLS_PER_SIM) return false;
  if (!t.tolls) t.tolls = [];
  t.tolls.push({ uid: sim._nextUid(), x: tr.x, y: tr.y, g: 0, r: 0, max: toll.r, hit: [], spec: shapeSpec(t.trapSpec, toll.mul) });
  sim._emit('toll', { towerUid: t.uid, uid: tr.uid, x: tr.x, y: tr.y, r: toll.r });
  return true;
}

const NEAR = [];

/** Every step of a girl with toll rings (src/sim/towers.js updateTower, before her sabotage check): they grow and strike. */
export function tollTick(sim, t) {
  const list = t.tolls;
  const grow = TOLL_SPEED * STEP;
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    const ring = list[i];
    const prev = ring.r;
    ring.g++;
    const r = ring.g * grow;
    ring.r = r < ring.max ? r : ring.max;
    NEAR.length = 0;
    sim.grid.query(ring.x, ring.y, ring.r, NEAR);
    for (let j = 0; j < NEAR.length; j++) {
      const e = NEAR[j];
      if (e.dead || (e.airborne && !e.grounded) || ring.hit.includes(e.uid) || !isEligible(e, ring.spec)) continue;
      const dx = e.x - ring.x;
      const dy = e.y - ring.y;
      if (!inBand(dx * dx + dy * dy, prev, ring.r)) continue;
      ring.hit.push(e.uid);
      sim._hit(e, t, ring.spec, 1);
    }
    NEAR.length = 0;
    if (ring.r < ring.max) list[n++] = ring;
  }
  list.length = n;
}

/** The wave clear: toll rings and the wheel turn end; every surviving bell rings on the next wave's first armed step. */
export function endS5Wave(sim) {
  for (const t of sim.towers) {
    if (t.tolls) t.tolls.length = 0;
    if (t.wheelK != null) t.wheelK = 0;
  }
  for (const tr of sim.traps) if (tr.tollCd != null) tr.tollCd = 1;
}
