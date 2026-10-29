// Attack shapes, batch S3 "Ground" (docs/specs/ATTACK_SHAPES.md §5.7, §5.8, §7.2): the shapes that come up out of
// the ground. (Bramble Road, the third, is Chigusa's vine kit: src/sim/vines.js.)
//   - Rising Spikes (behaviour 'spikes'; Yuki's Icicle Lance path): each counted attack picks her enemy by her
//     target mode and raises a row of spike.count spikes along its road, the first under it and the others
//     spike.gap tiles apart upstream into the walkers behind it (the "along the road" form of §5.8, by path
//     distance with pointAt, like a runner). Spike i rises i × spike.delay steps after the attack and strikes every
//     eligible ground enemy within spike.r of it (its body: inDisc with hitRadius) that the row has not struck yet:
//     her enemy (row.lead) for her whole hit, every other walker for her hit × spike.mul (her statuses ride on every
//     strike, crits roll in sim._hit). A row strikes each enemy once, so a lone enemy takes one hit an attack, as
//     from her icicle. Spikes never reach flyers: when her enemy is a flyer
//     (not grounded) she throws her icicle at it as before (her projectile volley). Gear Pierce adds spikes (her
//     shot's carry: one more spike per 100 %).
//   - Ripple Quake (kit 'quake'; Kanna's Hundred Demons' Parade): each strike also sends quake.rings rings rolling
//     out from her along the ground, quake.gap steps apart (queued starts), each growing quake.speed tiles a second
//     to her range. A ring strikes each ground enemy it crosses once (inBand of the ring's last radius and this
//     step's: Kinu's heat ring rule), the first ring for her plain hit × quake.mul, the later ones × quake.later;
//     a ring's hit is clean (none of her statuses, marks or pushes), the last ring carries quake.status (a stagger)
//     alone. Flyers are never struck, nor the enemy her strike just hit
//     (the rings roll past it: a lone boss takes her strike as before).
//
// State: t.spikeRows [{ uid, pathIndex, dist, n, age, next, lead, pts: [x, y, …], hit: [uids], spec }] and t.quakes [{ uid, x, y, wait,
// g, r, max, i, skip, hit: [uids], spec }] (age, next, wait, g, i, n integers; a ring's radius r is g growth steps), road
// objects that tick before her sabotage check (they stand on while she is sabotaged; a sold girl's go with her) and
// end at the wave clear (endGroundWave), so calm-point saves and co-op checkpoints carry none.
//
// Determinism (§2.4): road points by path distance (pointAt), her facing from the shared table (nearestDir; no atan2),
// squared distances (inDisc, inBand),
// integer step timers, the grid's own order, no rng of our own (sim._hit still rolls crits). Caps: per girl, then
// per sim, her oldest object first; a full sim makes none.

import { isEligible } from './combat.js';
import { nearestDir, dirAngle } from './dirs.js';
import { inDisc, inBand, hitRadius } from './shapes.js';
import { pointAt } from './path.js';
import {
  STEP, SPIKE_ROWS_PER_GIRL, SPIKE_ROWS_PER_SIM, SPIKE_UP, QUAKES_PER_GIRL, QUAKES_PER_SIM,
} from './constants.js';

const NEAR = [];
const PT = {};

/** Room for one more object in t[key] (her cap, then the sim's; her oldest first). @returns {boolean} */
function room(sim, t, key, perGirl, perSim) {
  const list = t[key] || (t[key] = []);
  while (list.length >= perGirl) list.shift();
  let all = 0;
  for (const o of sim.towers) all += o[key]?.length || 0;
  if (all >= perSim) {
    if (!list.length) return false;
    list.shift();
  }
  return true;
}

/** Can a ground shape strike `e`? Eligible for her spec, and on the ground (or a grounded flyer). */
function onGround(e, spec) {
  return !e.dead && (!e.airborne || e.grounded) && isEligible(e, spec);
}

// ---------------------------------------------------------------------------
// Rising Spikes
// ---------------------------------------------------------------------------

/** Where spike i of a row stands. @returns {[number, number]} */
export function spikeAt(row, i) {
  return [row.pts[2 * i], row.pts[2 * i + 1]];
}

/** The step (of the row's age) spike i rises at. */
export function spikeRise(row, i, delay) {
  return 1 + i * delay;
}

/**
 * One counted attack of a spike girl: her enemy by target mode (h.bestTarget); a flyer gets her icicle (h.volley());
 * else a row along its road from it upstream, spike.count + h.extra() spikes (gear Pierce) spike.gap tiles apart.
 * @returns {object|boolean|null} her enemy (or the volley's result), or null (no attack)
 */
export function attackSpikes(sim, t, spec, h) {
  const e = h.bestTarget(sim, t.ox, t.oy, spec.range, spec, t.targetMode);
  if (!e) return null;
  if (e.airborne && !e.grounded) return h.volley();
  const sp = t.stats.spike;
  const want = Math.max(1, Math.round(sp.count)) + (h.extra ? h.extra() : 0);
  const k = nearestDir(e.x - t.ox, e.y - t.oy);
  t.facing = dirAngle(k);
  t.targetUid = e.uid;
  const path = sim.pathData[e.pathIndex];
  if (path && room(sim, t, 'spikeRows', SPIKE_ROWS_PER_GIRL, SPIKE_ROWS_PER_SIM)) {
    // spike 0 under her enemy, the others upstream along its road (by path distance: pointAt, no trig)
    const pts = [];
    for (let i = 0; i < want; i++) {
      const d = e.dist - i * sp.gap;
      if (d < 0) break;
      const p = pointAt(path, d, PT, e.seg ?? 0);
      pts.push(p.x, p.y);
    }
    const row = { uid: sim._nextUid(), pathIndex: e.pathIndex, dist: e.dist, n: pts.length / 2, age: 0, next: 0, lead: e.uid, pts, hit: [], spec };
    t.spikeRows.push(row);
    sim._emit('spikes', { towerUid: t.uid, uid: row.uid, pathIndex: row.pathIndex, dist: row.dist, n: row.n, gap: sp.gap });
  }
  sim._emit('attack', { towerUid: t.uid, targetUid: e.uid, kind: 'spikes' });
  return e;
}

/** One step of her spike rows: each ages, its spikes rise on their steps and strike once. */
function spikeStep(sim, t) {
  const rows = t.spikeRows;
  const sp = t.stats.spike;
  const delay = Math.max(0, Math.round(sp.delay));
  const r = sp.r;
  let n = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    row.age++;
    while (row.next < row.n && spikeRise(row, row.next, delay) <= row.age) {
      const [px, py] = spikeAt(row, row.next);
      row.next++;
      NEAR.length = 0;
      sim.grid.query(px, py, r + 0.7, NEAR);
      for (let j = 0; j < NEAR.length; j++) {
        const e = NEAR[j];
        if (!onGround(e, row.spec) || row.hit.includes(e.uid) || !inDisc(px, py, r, e.x, e.y, hitRadius(e))) continue;
        row.hit.push(e.uid);
        sim._hit(e, t, row.spec, e.uid === row.lead ? 1 : sp.mul);
      }
      NEAR.length = 0;
    }
    if (row.age <= spikeRise(row, row.n - 1, delay) + SPIKE_UP) rows[n++] = row;
  }
  rows.length = n;
}

// ---------------------------------------------------------------------------
// Ripple Quake
// ---------------------------------------------------------------------------

/**
 * Her strike's quake (called after a counted strike lands): quake.rings rings from (x, y), quake.gap steps apart,
 * each a clean copy of her plain spec (`spec`; the last ring with quake.status), rolling past enemy `skip` (the one she
 * struck: her focused strike is its own hit, so a lone enemy takes what it took before).
 */
export function sendQuake(sim, t, spec, x, y, skip = -1) {
  const q = t.stats.quake;
  const rings = Math.max(1, Math.round(q.rings));
  const gap = Math.max(0, Math.round(q.gap));
  // a ring is a clean hit (Kaede's blade shapes' rule, src/sim/towers.js bladeSpec): no statuses, marks, pushes or splash of
  // hers, so rolling through every walker in her reach does not lay her crowd control on all of them; the last ring
  // carries quake.status (its stagger) alone
  const clean = { ...spec, status: [], procStatus: null, mark: null, silence: 0, reveal: 0, knockback: 0, gather: 0, splash: 0 };
  const last = q.status?.length ? { ...clean, status: q.status } : clean;
  for (let i = 0; i < rings; i++) {
    if (!room(sim, t, 'quakes', QUAKES_PER_GIRL, QUAKES_PER_SIM)) break;
    t.quakes.push({ uid: sim._nextUid(), x, y, g: 0, r: 0, max: spec.range, wait: i * gap, i, skip, hit: [], spec: i === rings - 1 ? last : clean });
  }
  sim._emit('quake', { towerUid: t.uid, x, y, rings, gap, max: spec.range });
}

/** One step of her quake rings: queued ones wait, the others grow and strike what they cross, once. */
function quakeStep(sim, t) {
  const list = t.quakes;
  const q = t.stats.quake;
  const grow = q.speed * STEP;
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    const ring = list[i];
    if (ring.wait > 0) {
      ring.wait--;
      list[n++] = ring;
      continue;
    }
    const prev = ring.r;
    ring.g++;
    const r = ring.g * grow;
    ring.r = r < ring.max ? r : ring.max;
    const mul = ring.i === 0 ? q.mul : q.later;
    NEAR.length = 0;
    sim.grid.query(ring.x, ring.y, ring.r, NEAR);
    for (let j = 0; j < NEAR.length; j++) {
      const e = NEAR[j];
      if (e.uid === ring.skip || !onGround(e, ring.spec) || ring.hit.includes(e.uid)) continue;
      const dx = e.x - ring.x;
      const dy = e.y - ring.y;
      if (!inBand(dx * dx + dy * dy, prev, ring.r)) continue;
      ring.hit.push(e.uid);
      sim._hit(e, t, ring.spec, mul);
    }
    NEAR.length = 0;
    if (ring.r < ring.max) list[n++] = ring;
  }
  list.length = n;
}

/** Every step of a girl with ground objects (src/sim/towers.js updateTower, before her sabotage check). */
export function groundTick(sim, t) {
  if (t.spikeRows?.length) spikeStep(sim, t);
  if (t.quakes?.length) quakeStep(sim, t);
}

/** Wave clear (Sim._checkWaveEnd): every spike row and quake ring ends. */
export function endGroundWave(sim) {
  for (const t of sim.towers) {
    if (t.spikeRows) delete t.spikeRows;
    if (t.quakes) delete t.quakes;
  }
}
