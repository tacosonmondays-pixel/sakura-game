// Attack shapes, batch S5a (docs/specs/ATTACK_SHAPES_S5.md §3.3, §3.5, §3.6). Every girl keeps her live attack and
// the shape goes on top of it (rule 1); a shape hit is clean, unshared and rolls no crit (shapeSpec, rules 2 and 3); it
// rolls past what her attack just struck (rule 4); and it never takes room from a live object (rule 5).
//   - Charm Wheel (kit 'charms'; Miko's Purification T4-5): after each counted attack a wheel of charms.n + 1 spokes,
//     fixed to the world and turned charms.turn table steps a throw (t.wheelK), leaves her as straight charms; the
//     spoke nearest her target's line is left out, so no charm flies down it. A charm cuts the first enemy it meets
//     that her throw did not aim at (p.skip), × charms.mul.
//   - Crescent Return (kit 'cres'; Rei's Whirlwind T4-5): after each counted sweep one crescent flies from her along the
//     densest line of walkers her sweep did not strike (crescentAim; none: toward her lead) out to her range + cres.out, turns (an exact reversal) and comes back to where it was thrown. Each
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
import { nearestDir, wrapDir, dirAngle, turnToward, DIR_X, DIR_Y } from './dirs.js';
import { shapeSpec, inBand, hitRadius, inCone, nearSegment } from './shapes.js';
import { streamFalloff } from './held.js';
import { segDistSq } from './path.js';
import { shapeRoom, spawnStraight } from './rings.js';
import {
  STEP, RING_DIRS, CHARMS_PER_GIRL, CHARM_SPEED, CRESCENTS_PER_GIRL, CRESCENT_SPEED, CRESCENT_HALF_WIDTH, CRESCENT_AIMS,
  TOLLS_PER_GIRL, TOLLS_PER_SIM, TOLL_SPEED, MIST_TICK, MIST_TURN, MIST_GRACE, MOON_PASS, MOON_TICK, MOON_HALF_WIDTH,
  STATIC_MEMBERS, STATIC_PER_GIRL, STATIC_PER_SIM, STATIC_ZAPS_PER_STEP, STATIC_REACH, CHAIN_JUMP_RANGE,
} from './constants.js';

/** Does a girl's kit have an S5 shape that reads her attack's victims (t._struck)? */
export function hasStruckShape(s) {
  return !!(s && (s.charms || s.cres || s.mist || s.moon || s.web));
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
const NEAR = [];

/** After a counted attack (src/sim/towers.js updateTower): her S5a shot shapes, read from t._struck / t._lead. */
export function s5AfterAttack(sim, t) {
  const lead = t._lead;
  if (!lead) return;
  const s = t.stats;
  const k0 = nearestDir(lead.x - t.ox, lead.y - t.oy);
  if (s.charms) throwCharms(sim, t, s.charms, k0);
  if (s.cres) throwCrescent(sim, t, s.cres, k0);
  if (s.mist) mistAim(sim, t, lead, k0);
  if (s.moon) moonPass(sim, t, s.moon, k0);
  if (s.web) tieWeb(sim, t, s.web);
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

const AIM = [];
const AIM_D2 = [];
const AIM_ORDER = [];

/**
 * The crescent's line (the coordinator's call, Oct 30): the densest stretch within its reach. The candidates are her lead's
 * line k0 and the lines toward the CRESCENT_AIMS nearest eligible walkers her sweep did not strike (d², uid); each scores
 * the walkers within reach of the segment out to `len` that a leg could cut (her sweep's victims never count). The best
 * score wins; ties go to the line nearest k0, then the lower table index. Nobody out there: k0 (a lone held boss reads live).
 */
export function crescentAim(sim, t, k0, len, skip, spec) {
  AIM.length = 0;
  AIM_D2.length = 0;
  NEAR.length = 0;
  const near = sim.grid.query(t.ox, t.oy, len + 1, NEAR);
  for (let i = 0; i < near.length; i++) {
    const e = near[i];
    if (e.dead || (e.airborne && !e.grounded) || skip.includes(e.uid) || !isEligible(e, spec)) continue;
    const dx = e.x - t.ox;
    const dy = e.y - t.oy;
    const d2 = dx * dx + dy * dy;
    if (d2 > len * len) continue;
    AIM.push(e);
    AIM_D2.push(d2);
  }
  NEAR.length = 0;
  if (!AIM.length) return k0;
  AIM_ORDER.length = 0;
  for (let i = 0; i < AIM.length; i++) AIM_ORDER.push(i);
  AIM_ORDER.sort((a, b) => AIM_D2[a] - AIM_D2[b] || AIM[a].uid - AIM[b].uid);
  const n = Math.min(AIM_ORDER.length, CRESCENT_AIMS);
  let best = k0;
  let bestScore = aimScore(t, k0, len);
  let bestGap = 0;
  for (let j = 0; j < n; j++) {
    const e = AIM[AIM_ORDER[j]];
    const k = nearestDir(e.x - t.ox, e.y - t.oy);
    const sc = aimScore(t, k, len);
    const gap = dirGap(k, k0);
    if (sc > bestScore || (sc === bestScore && (gap < bestGap || (gap === bestGap && k < best)))) {
      best = k;
      bestScore = sc;
      bestGap = gap;
    }
  }
  return best;
}

/** How many of AIM a crescent along table direction k, `len` tiles long, would cross. */
function aimScore(t, k, len) {
  const bx = t.ox + DIR_X[k] * len;
  const by = t.oy + DIR_Y[k] * len;
  let n = 0;
  for (let i = 0; i < AIM.length; i++) {
    const e = AIM[i];
    const r = hitRadius(e) + CRESCENT_HALF_WIDTH;
    if (segDistSq(e.x, e.y, t.ox, t.oy, bx, by) <= r * r) n++;
  }
  return n;
}

function throwCrescent(sim, t, c, k0) {
  if (shapeRoom(sim, t, 1, CRESCENTS_PER_GIRL) <= 0) return;
  const spec = shapeSpec(t.eff, c.mul);
  const len = t.eff.range + c.out;
  const k = crescentAim(sim, t, k0, len, t._struck, spec);
  const p = spawnStraight(sim, t, spec, t.ox, t.oy, k, len, { pierce: 1, kind: 'crescent', speed: CRESCENT_SPEED });
  p.shape = true;
  p.split = true;
  p.skip = t._struck.slice();
  p.half = CRESCENT_HALF_WIDTH;
  p.cres = { leg: 0, n: 0, cuts: Math.max(1, Math.round(c.cuts)) };
  t.facing = dirAngle(k);
  sim._emit('s5', { towerUid: t.uid, kind: 'cres', k });
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

// ---------------------------------------------------------------------------
// S5b: Spore Mist (Midori), Moonbeam Sweep (Luna), Static Web (Raika)
// ---------------------------------------------------------------------------

/** The live enemy with this uid, or null (a scan: uids are unique). */
function byUid(sim, uid) {
  if (uid < 0) return null;
  const L = sim.enemies;
  for (let i = 0; i < L.length; i++) if (L[i].uid === uid) return L[i].dead ? null : L[i];
  return null;
}

/**
 * Spore Mist (kit 'mist'; Midori's Field Kit T4-5), beside her flasks: her counted attack aims the mist at her lead
 * (t.mist { uid, k, tick, grace }, integers). Every MIST_TICK steps (mistTick) the eligible enemies in a cone along k
 * (half-angle mist.half table steps, mist.len × her range long), at most mist.cap by (d², uid), take a clean tick of
 * mist.mul × rate × MIST_TICK × STEP of her hit (× the stream's tip falloff) carrying `spore`: her strongest poison's dps
 * and pct × mist.dot, for its duration. `spore` is its own status key (src/sim/status.js, enemies.js), so no other girl's
 * system (Catalyst, its Auto, spreadDot, siphons, regen, the poison merge) sees it.
 */
function mistAim(sim, t, lead, k0) {
  // the densest direction within the mist's reach (the coordinator's crescent rule, Oct 30): her lead often stands past
  // the mist's shorter reach (mist.len × her range), so the cone follows the walker whose line holds the most of them
  const w = t.stats.mist;
  const e = mistTarget(sim, t, lead, k0, t.eff.range * w.len, Math.max(1, Math.round(w.half)));
  const m = t.mist;
  if (!m) {
    t.mist = { uid: e.uid, k: nearestDir(e.x - t.ox, e.y - t.oy), tick: 0, grace: 0 };
    sim._emit('mist', { towerUid: t.uid, targetUid: e.uid, k: t.mist.k });
  } else {
    m.uid = e.uid;
    m.grace = 0;
  }
}

/**
 * The enemy the mist follows: among her lead and the CRESCENT_AIMS nearest eligible enemies within the mist's reach L
 * (d², uid), the one whose direction's cone (half-angle `half`) holds the most of them; ties to the direction nearest k0,
 * then the lower table index. None within reach: her lead.
 */
function mistTarget(sim, t, lead, k0, L, half) {
  const spec = t.eff;
  AIM.length = 0;
  AIM_D2.length = 0;
  NEAR.length = 0;
  sim.grid.query(t.ox, t.oy, L + 0.6, NEAR);
  for (let i = 0; i < NEAR.length; i++) {
    const q = NEAR[i];
    if (q.dead || !isEligible(q, spec)) continue;
    const ex = q.x - t.ox;
    const ey = q.y - t.oy;
    const d2 = ex * ex + ey * ey;
    if (d2 > (L + hitRadius(q)) * (L + hitRadius(q))) continue;
    AIM.push(q);
    AIM_D2.push(d2);
  }
  NEAR.length = 0;
  if (!AIM.length) return lead;
  AIM_ORDER.length = 0;
  for (let i = 0; i < AIM.length; i++) AIM_ORDER.push(i);
  AIM_ORDER.sort((a, c) => AIM_D2[a] - AIM_D2[c] || AIM[a].uid - AIM[c].uid);
  const coneScore = (k) => {
    let n = 0;
    for (let i = 0; i < AIM.length; i++) if (inCone(AIM[i].x - t.ox, AIM[i].y - t.oy, k, half, L, hitRadius(AIM[i]))) n++;
    return n;
  };
  let best = lead;
  let bestK = k0;
  let bestScore = coneScore(k0);
  let bestGap = 0;
  const n = Math.min(AIM_ORDER.length, CRESCENT_AIMS);
  for (let j = 0; j < n; j++) {
    const q = AIM[AIM_ORDER[j]];
    const k = nearestDir(q.x - t.ox, q.y - t.oy);
    const sc = coneScore(k);
    const gap = dirGap(k, k0);
    if (sc > bestScore || (sc === bestScore && (gap < bestGap || (gap === bestGap && k < bestK)))) {
      best = q;
      bestK = k;
      bestScore = sc;
      bestGap = gap;
    }
  }
  return best;
}

/** Her spore status: her strongest poison (dps, pct, duration) × mist.dot, or null without one. */
function sporeOf(spec, dot) {
  let dps = 0;
  let pct = 0;
  let dur = 0;
  const list = spec.status || [];
  for (let i = 0; i < list.length; i++) {
    const st = list[i];
    if (st.type !== 'poison') continue;
    if ((st.dps || 0) > dps) dps = st.dps || 0;
    if ((st.pct || 0) > pct) pct = st.pct || 0;
    if ((st.duration || 0) > dur) dur = st.duration || 0;
  }
  if (!(dot > 0) || !(dur > 0) || !(dps > 0 || pct > 0)) return null;
  return pct > 0 ? { type: 'spore', dps: dps * dot, pct: pct * dot, duration: dur } : { type: 'spore', dps: dps * dot, duration: dur };
}

const CONE = [];
const CONE_D2 = [];
const CONE_ORDER = [];

/** Every step of a girl with an open mist (src/sim/towers.js updateTower, after her attack loop). */
export function mistTick(sim, t) {
  const m = t.mist;
  const w = t.stats.mist;
  if (!w) {
    delete t.mist;
    return;
  }
  const spec = t.eff;
  const e = byUid(sim, m.uid);
  const keep = e && isEligible(e, spec) && (e.x - t.ox) * (e.x - t.ox) + (e.y - t.oy) * (e.y - t.oy) <= spec.range * spec.range;
  if (keep) {
    m.k = turnToward(m.k, nearestDir(e.x - t.ox, e.y - t.oy), MIST_TURN);
    m.grace = 0;
  } else {
    m.uid = -1;
    if (++m.grace >= MIST_GRACE) {
      delete t.mist;
      sim._emit('mist', { towerUid: t.uid, targetUid: null, k: null });
      return;
    }
  }
  if (m.tick > 0) m.tick--;
  if (m.tick > 0) return;
  m.tick = MIST_TICK;
  const L = spec.range * w.len;
  const half = Math.max(1, Math.round(w.half));
  CONE.length = 0;
  CONE_D2.length = 0;
  NEAR.length = 0;
  sim.grid.query(t.ox, t.oy, L + 0.6, NEAR);
  for (let i = 0; i < NEAR.length; i++) {
    const q = NEAR[i];
    if (q.dead || !isEligible(q, spec)) continue;
    const ex = q.x - t.ox;
    const ey = q.y - t.oy;
    if (!inCone(ex, ey, m.k, half, L, hitRadius(q))) continue;
    CONE.push(q);
    CONE_D2.push(ex * ex + ey * ey);
  }
  NEAR.length = 0;
  if (!CONE.length) return;
  CONE_ORDER.length = 0;
  for (let i = 0; i < CONE.length; i++) CONE_ORDER.push(i);
  const cap = Math.max(1, Math.round(w.cap));
  if (CONE_ORDER.length > cap) {
    CONE_ORDER.sort((a, b) => CONE_D2[a] - CONE_D2[b] || CONE[a].uid - CONE[b].uid);
    CONE_ORDER.length = cap;
  }
  const spore = sporeOf(spec, w.dot);
  const tick = shapeSpec(spec, w.mul * (spec.rate > 0 ? spec.rate : 0) * MIST_TICK * STEP);
  if (spore) tick.status = [spore];
  tick.tick = true;
  for (let j = 0; j < CONE_ORDER.length; j++) {
    const i = CONE_ORDER[j];
    if (!CONE[i].dead) sim._hit(CONE[i], t, tick, streamFalloff(CONE_D2[i], L));
  }
  CONE.length = 0;
  CONE_D2.length = 0;
}

/**
 * Moonbeam Sweep (kit 'moon'; Luna, Lv 22 and Lv 25), beside her beams: each counted volley starts a pass (t.moon): her
 * moonbeam(s) swing from one side of her lead's line to the other (the side the last pass ended on first), 2 × arc table
 * steps over P = min(MOON_PASS, her attack interval) steps, the offset an integer step of i (no fractional angle); a second
 * beam mirrors the first about that line. Every MOON_TICK steps each beam strikes the eligible enemies within
 * MOON_HALF_WIDTH of it that it has not struck this pass, at most her pierce a pass, nearest first by (d², uid); her
 * volley's victims are in every beam's list from the start (rule 4: a lone boss reads live).
 */
function moonPass(sim, t, w, k0) {
  const prev = t.moon;
  const side = prev ? -prev.side : 1;
  const beams = Math.max(1, Math.round(w.beams));
  const rate = t.eff.rate > 0 ? t.eff.rate : 1;
  const P = Math.max(2, Math.min(MOON_PASS, Math.round(1 / (rate * STEP))));
  const hits = [];
  const n = [];
  for (let b = 0; b < beams; b++) {
    hits.push(t._struck.slice());
    n.push(0);
  }
  t.moon = { c: k0, side, arc: Math.max(1, Math.round(w.arc)), i: 0, P, hits, n };
  sim._emit('moon', { towerUid: t.uid, k: k0, side, beams, P });
}

/** Beam b's table direction at step i of the pass. */
export function moonDir(m, b) {
  const off = -m.side * m.arc + Math.floor((2 * m.side * m.arc * Math.min(m.i, m.P)) / m.P);
  return wrapDir(b === 0 ? m.c + off : m.c - off);
}

/** Every step of a girl with a moonbeam pass (src/sim/towers.js updateTower, after her attack loop). */
export function moonTick(sim, t) {
  const m = t.moon;
  const w = t.stats.moon;
  if (!w) {
    delete t.moon;
    return;
  }
  if (m.i >= m.P) {
    if (m.i < m.P + 1000) m.i++; // idle: the renderer lets it fade (MOON_LINGER)
    return;
  }
  m.i++;
  if (m.i % MOON_TICK !== 0 && m.i !== m.P) return;
  const spec = t.eff;
  const L = spec.range;
  const cap = Math.max(1, spec.pierce || 1);
  let hit = null;
  for (let b = 0; b < m.hits.length; b++) {
    if (m.n[b] >= cap) continue;
    const k = moonDir(m, b);
    const bx = t.ox + DIR_X[k] * L;
    const by = t.oy + DIR_Y[k] * L;
    CONE.length = 0;
    CONE_D2.length = 0;
    NEAR.length = 0;
    sim.grid.query((t.ox + bx) / 2, (t.oy + by) / 2, L / 2 + 1, NEAR);
    const list = m.hits[b];
    for (let i = 0; i < NEAR.length; i++) {
      const q = NEAR[i];
      if (q.dead || list.includes(q.uid) || !isEligible(q, spec)) continue;
      if (!nearSegment(q.x, q.y, t.ox, t.oy, bx, by, MOON_HALF_WIDTH, hitRadius(q))) continue;
      CONE.push(q);
      CONE_D2.push((q.x - t.ox) * (q.x - t.ox) + (q.y - t.oy) * (q.y - t.oy));
    }
    NEAR.length = 0;
    if (!CONE.length) continue;
    CONE_ORDER.length = 0;
    for (let i = 0; i < CONE.length; i++) CONE_ORDER.push(i);
    CONE_ORDER.sort((a, c) => CONE_D2[a] - CONE_D2[c] || CONE[a].uid - CONE[c].uid);
    if (!hit) hit = shapeSpec(spec, w.mul);
    for (let j = 0; j < CONE_ORDER.length && m.n[b] < cap; j++) {
      const q = CONE[CONE_ORDER[j]];
      list.push(q.uid);
      m.n[b]++;
      sim._hit(q, t, hit, 1);
    }
  }
  CONE.length = 0;
  CONE_D2.length = 0;
}

/**
 * Static Web (kit 'web'; Raika's Storm Rhythm T4-5): the enemies her first bolt chained (t._chain, in its walk order) stay
 * linked for web.dur s: sim.statics [{ uid, owner, m: [enemies], left, zapCd, every, share }]. A web is refreshed when her
 * lead is already in one of hers; a new one takes the chain's members not in any web (any girl's), at most STATIC_MEMBERS,
 * and needs two (a lone enemy gets none: rule 4). Caps: STATIC_PER_GIRL (her oldest first), STATIC_PER_SIM (no new web).
 */
function tieWeb(sim, t, w) {
  const chain = t._chain;
  if (!chain || chain.length < 2) return;
  if (!sim.statics) sim.statics = [];
  const L = sim.statics;
  const dur = Math.max(1, Math.round(w.dur / STEP));
  const lead = chain[0];
  for (let i = 0; i < L.length; i++) {
    if (L[i].owner === t && L[i].m.includes(lead)) {
      L[i].left = dur;
      return;
    }
  }
  const m = [];
  for (let i = 0; i < chain.length && m.length < STATIC_MEMBERS; i++) {
    const e = chain[i];
    if (e.dead || m.includes(e)) continue;
    let taken = false;
    for (let j = 0; j < L.length && !taken; j++) if (L[j].m.includes(e)) taken = true;
    if (!taken) m.push(e);
  }
  if (m.length < 2) return;
  let mine = 0;
  for (let i = 0; i < L.length; i++) if (L[i].owner === t) mine++;
  if (mine >= STATIC_PER_GIRL) {
    for (let i = 0; i < L.length; i++) {
      if (L[i].owner === t) {
        L.splice(i, 1);
        break;
      }
    }
  }
  if (L.length >= STATIC_PER_SIM) return;
  const every = Math.max(1, Math.round(w.every));
  const g = { uid: sim._nextUid(), owner: t, m, left: dur, zapCd: every, every, share: w.share };
  L.push(g);
  const uids = [];
  for (let i = 0; i < m.length; i++) uids.push(m[i].uid);
  sim._emit('web', { towerUid: t.uid, uid: g.uid, members: uids, left: dur });
}

/** Every sim step while a web lives (src/sim/Sim.js, beside tetherStep): webs age, prune and zap, in creation order. */
export function webStep(sim) {
  const L = sim.statics;
  let budget = STATIC_ZAPS_PER_STEP;
  let n = 0;
  for (let i = 0; i < L.length; i++) {
    const g = L[i];
    const t = g.owner;
    if (t.removed || --g.left <= 0) continue;
    if (g.zapCd > 0) g.zapCd--;
    if (g.zapCd > 0) {
      L[n++] = g;
      continue;
    }
    // members that died, went into a tunnel or drifted past her chain's reach from the one before drop out
    const spec = t.eff;
    const reach = (CHAIN_JUMP_RANGE + (spec.splash || 0)) * STATIC_REACH;
    let k = 0;
    for (let j = 0; j < g.m.length; j++) {
      const e = g.m[j];
      if (e.dead || e.hidden) continue;
      if (k > 0) {
        const p = g.m[k - 1];
        if ((e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y) > reach * reach) continue;
      }
      g.m[k++] = e;
    }
    g.m.length = k;
    if (k < 2) continue;
    if (budget < k) {
      L[n++] = g; // waits a step (a deferral: zaps are her own damage)
      continue;
    }
    const hit = shapeSpec(spec, g.share * (spec.rate > 0 ? spec.rate : 0) * g.every * STEP);
    hit.tick = true;
    for (let j = 0; j < k; j++) {
      const e = g.m[j];
      if (!e.dead && isEligible(e, spec)) sim._hit(e, t, hit, 1);
    }
    budget -= k;
    g.zapCd = g.every;
    sim._emit('zap', { towerUid: t.uid, uid: g.uid, n: k });
    L[n++] = g;
  }
  L.length = n;
}

/** The wave clear: toll rings, the wheel turn, mists, moonbeam passes and webs end; every surviving bell rings on the
 * next wave's first armed step. */
export function endS5Wave(sim) {
  for (const t of sim.towers) {
    if (t.tolls) t.tolls.length = 0;
    if (t.wheelK != null) t.wheelK = 0;
    if (t.mist) delete t.mist;
    if (t.moon) delete t.moon;
  }
  for (const tr of sim.traps) if (tr.tollCd != null) tr.tollCd = 1;
  if (sim.statics) sim.statics.length = 0;
}
