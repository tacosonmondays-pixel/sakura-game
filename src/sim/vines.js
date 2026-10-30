// The nature caster (Chigusa, Greenhouse Gardener; docs/specs/UNIT_GAPS.md §5.7, P-10, P-3): she throws
// a fan of thorn seeds (the projectile behaviour), and on top of that:
//   - Bramble Road (attack shapes S3, docs/specs/ATTACK_SHAPES.md §5.4, A2 #8): every vine.every s of wave
//     time a vine roots on the road and GROWS ALONG IT upstream toward the walkers, vine.grow tiles a second
//     up to vine.len tiles, and stands vine.life s. It roots on the road spot in her range nearest the exit
//     that has a walker within vine.len tiles upstream and is not already under a vine of hers (ties: lane,
//     distance; like Azami's strips). While it stands, every walker on its grown stretch is slowed (vine.slow,
//     refreshed every VINE_STEP steps), the first walker it reaches (the lead one on it) is HELD for vine.hold
//     s (the `hold` status: minibosses resist like any crowd control, bosses and flyers are immune), and with
//     Strangler Vine and up it lashes every vine.lash s: each walker on it (lead first, at most vine.cap) takes
//     vine.dps × vine.lash. Vines never touch bosses or flyers (no slow, no hold, no lash), as her hold never
//     did. At most vine.max vines of hers stand at once (the oldest withers first).
//   - Thorn Beds: her kills of ground enemies leave a thorn bed on the spot: vine.beds hits of
//     vine.bedDmg, each enemy at most once, for vine.bedTtl s of wave time.
//   - Bloom Rush: her attack speed rises by vine.bloomPer for each second she keeps attacking, up to
//     +vine.bloom; vine.bloomIdle s without an attack resets it (src/sim/towers.js updateTower).
//   - Harvest lives: vine.lives back at each wave clear, her copies' harvests together, at most
//     vine.livesCap at one wave clear (HARVEST_LIVES_PER_WAVE) and no cap for the whole battle (never above
//     the starting lives, never where hearts cannot come back or with no income).
//
// State: t.vineCd (integer steps to the next vine), t.vines [{ uid, pathIndex, root, len, age, life, held }]
// (a road object: its stretch is [root − grown, root] on road pathIndex, grown = min(len, vine.grow × age
// steps); age and life integer steps; held 1 once it reached its first walker), t.beds [{ uid, x, y, hits, ttl,
// hitUids }], t.bloomT / t.bloomIdle (Bloom Rush). All of it resets at the wave clear, so a calm point
// carries none of it (UNIT_GAPS §7.3). A sabotaged (or moving) girl's vines stand on and keep working (road
// objects), but she roots no new one; a sold girl's vines go with her.
//
// Determinism: membership by path distance (onRoad, src/sim/shapes.js; no geometry beyond the shared-stretch
// test), the grid's own order, lead first by (remaining, uid) when a cap cuts the list, integer step
// timers, squared distances, no rng. Caps: vine.max, VINES_PER_GIRL, then VINES_PER_SIM (her oldest first;
// a full sim roots none); BEDS_PER_GIRL, then BEDS_PER_SIM for the beds.

import { gatherTargets } from './towers.js';
import { isEligible } from './combat.js';
import { syncStatusFlags } from './enemies.js';
import { onRoad } from './shapes.js';
import { pointAt } from './path.js';
import { roadSpots } from './strips.js';
import { nearestDir, dirAngle } from './dirs.js';
import {
  STEP, BED_RADIUS, BEDS_PER_GIRL, BEDS_PER_SIM, VINE_STEP, VINE_SLOW_T, VINES_PER_GIRL, VINES_PER_SIM,
} from './constants.js';

const NEAR = [];
const HITS = [];
const ON = [];
const PT = {};

/** A vine's period in steps: whole VINE_STEPs (its lash lands on a test). */
function steps(s, min = 1) {
  return Math.max(min, Math.round(s / STEP));
}
function lashSteps(v) {
  return Math.max(VINE_STEP, Math.round(v.lash / STEP / VINE_STEP) * VINE_STEP);
}

/** How far a vine has grown (tiles) after `age` steps. */
export function vineGrown(vine, v) {
  const g = v.grow * vine.age * STEP;
  return g < vine.len ? g : vine.len;
}

/**
 * Her vine spots at her current range, nearest the exit first (Azami's spots, src/sim/strips.js roadSpots), cached per
 * girl until her range, her spot or the route changes: a pure function of them, so it lives outside the sim state.
 */
const SPOT_CACHE = new WeakMap();
function spotsOf(sim, t) {
  const range = t.eff.range;
  const c = SPOT_CACHE.get(t);
  if (c && c.range === range && c.paths === sim.pathData && c.x === t.x && c.y === t.y) return c.list;
  const list = roadSpots(sim, t.x, t.y, range);
  SPOT_CACHE.set(t, { range, paths: sim.pathData, x: t.x, y: t.y, list });
  return list;
}

/** Can a vine touch `e`? A walker she can see: never a flyer (grounded or not: the hold cannot take it), never a boss. */
function vineable(e, spec) {
  return !e.dead && !e.airborne && e.tier !== 'boss' && isEligible(e, spec);
}

/** Is road spot `s` (path, distance) under the full length of a standing vine of hers? */
function underVine(t, s) {
  const vs = t.vines;
  if (!vs) return false;
  for (let i = 0; i < vs.length; i++) {
    const o = vs[i];
    if (o.pathIndex === s.pathIndex && s.d <= o.root && s.d >= o.root - o.len) return true;
  }
  return false;
}

/**
 * Where her next vine roots: the first spot (nearest the exit) with a walker on its len tiles upstream, not under
 * one of her vines. @returns {object|null} the spot ({ x, y, d, pathIndex })
 */
export function vineSpot(sim, t) {
  const v = t.stats.vine;
  const c = gatherTargets(sim, t.x, t.y, t.eff.range + v.len, t.vineSpec, NEAR);
  let n = 0;
  for (let i = 0; i < c.length; i++) if (vineable(c[i], t.vineSpec)) c[n++] = c[i];
  c.length = n;
  let found = null;
  if (n) {
    const spots = spotsOf(sim, t);
    for (let i = 0; i < spots.length && !found; i++) {
      const s = spots[i];
      if (underVine(t, s)) continue;
      for (let j = 0; j < n; j++) {
        if (onRoad(sim, c[j], s.pathIndex, s.d - v.len, s.d)) {
          found = s;
          break;
        }
      }
    }
  }
  NEAR.length = 0;
  return found;
}

/** Roots a vine of hers at road spot `s` (her vine.max, her cap, then the sim's; her oldest goes first). */
export function rootVine(sim, t, s) {
  const v = t.stats.vine;
  const vs = t.vines || (t.vines = []);
  const mine = Math.min(VINES_PER_GIRL, Math.max(1, v.max));
  while (vs.length >= mine) vs.shift();
  let all = 0;
  for (const o of sim.towers) all += o.vines?.length || 0;
  if (all >= VINES_PER_SIM) {
    if (!vs.length) return null;
    vs.shift();
  }
  const vine = { uid: sim._nextUid(), pathIndex: s.pathIndex, root: s.d, len: v.len, age: 0, life: steps(v.life), held: 0 };
  vs.push(vine);
  const dx = s.x - t.x;
  const dy = s.y - t.y;
  if (dx * dx + dy * dy > 1e-12) t.facing = dirAngle(nearestDir(dx, dy));
  sim._emit('bramble', { towerUid: t.uid, uid: vine.uid, pathIndex: vine.pathIndex, root: vine.root, len: vine.len });
  return vine;
}

/** The walkers on a vine's grown stretch now, in the grid's order (into ON). */
function onVine(sim, t, vine, grown) {
  ON.length = 0;
  if (!(grown > 0)) return ON;
  const path = sim.pathData[vine.pathIndex];
  if (!path) return ON;
  const d0 = vine.root - grown;
  // every point of the stretch lies within grown / 2 of its middle along the road, so within that of it in space
  const p = pointAt(path, vine.root - grown / 2, PT);
  NEAR.length = 0;
  sim.grid.query(p.x, p.y, grown / 2 + 1, NEAR);
  const spec = t.vineSpec;
  for (let i = 0; i < NEAR.length; i++) {
    const e = NEAR[i];
    if (vineable(e, spec) && onRoad(sim, e, vine.pathIndex, d0, vine.root)) ON.push(e);
  }
  NEAR.length = 0;
  return ON;
}

const byLead = (a, b) => a.remaining - b.remaining || a.uid - b.uid;

/** The hold on the first walker a vine reaches that is not held already (the lead one of those on it). */
function holdLead(sim, t, vine, list) {
  // the lead walker on it that is not held already (an Overgrowth hold, another vine's): none, and the hold waits
  let lead = null;
  for (let i = 0; i < list.length; i++) if (!list[i].statuses.hold && (!lead || byLead(list[i], lead) < 0)) lead = list[i];
  if (!lead) return;
  vine.held = 1;
  const ctx = sim._statusCtx;
  ctx.element = null;
  ctx.attackType = t.eff.attackType;
  ctx.sourceUid = t.uid;
  if (!sim._applyStatusEvent(lead, { type: 'hold', duration: t.stats.vine.hold }, ctx)) return;
  syncStatusFlags(lead);
  sim._emit('vine', { towerUid: t.uid, targetUid: lead.uid, x: lead.x, y: lead.y, hold: lead.statuses.hold?.left ?? t.stats.vine.hold });
}

/**
 * One step of her standing vines (src/sim/towers.js updateTower, before her sabotage check: road objects): each ages,
 * and every VINE_STEP steps its walkers are slowed, its first walker held, and on a lash step lashed.
 */
export function vineObjects(sim, t) {
  const vs = t.vines;
  if (!vs?.length) return;
  const v = t.stats.vine;
  const lash = lashSteps(v);
  const ctx = sim._statusCtx;
  let n = 0;
  for (let i = 0; i < vs.length; i++) {
    const vine = vs[i];
    vine.age++;
    if (vine.age > vine.life) continue;
    if (vine.age % VINE_STEP === 0) {
      const list = onVine(sim, t, vine, vineGrown(vine, v));
      if (list.length) {
        if (v.slow > 0) {
          ctx.element = null;
          ctx.attackType = t.eff.attackType;
          ctx.sourceUid = t.uid;
          const slow = { type: 'slow', amount: v.slow, duration: VINE_SLOW_T };
          for (let j = 0; j < list.length; j++) sim._applyStatusEvent(list[j], slow, ctx);
        }
        if (!vine.held) holdLead(sim, t, vine, list);
        if (v.dps > 0 && vine.age % lash === 0) {
          if (v.cap > 0 && list.length > v.cap) {
            list.sort(byLead);
            list.length = v.cap;
          }
          // one lash is vine.lash seconds of vine.dps, shared among the walkers it strikes: a share of one hit each
          // (computeHit's `share`: flat armour and the 1-damage floor × the share), so a lone walker takes it all
          HITS.length = 0;
          for (let j = 0; j < list.length; j++) HITS.push(list[j]);
          const sh = v.lash / HITS.length;
          const spec = { ...t.vineSpec, damage: t.vineSpec.damage * sh, share: sh };
          for (let j = 0; j < HITS.length; j++) if (!HITS[j].dead) sim._hit(HITS[j], t, spec, 1);
          HITS.length = 0;
          sim._emit('lash', { towerUid: t.uid, uid: vine.uid });
        }
      }
      ON.length = 0;
    }
    vs[n++] = vine;
  }
  vs.length = n;
}

/** A thorn bed of hers at (x, y) (her cap, then the sim's; the oldest of hers goes first). */
export function addBed(sim, t, x, y) {
  const v = t.stats.vine;
  const beds = t.beds || (t.beds = []);
  if (beds.length >= BEDS_PER_GIRL) beds.shift();
  let all = 0;
  for (const o of sim.towers) all += o.beds?.length || 0;
  if (all >= BEDS_PER_SIM) {
    if (!beds.length) return null;
    beds.shift();
  }
  const b = { uid: sim._nextUid(), x, y, hits: v.beds, ttl: v.bedTtl, hitUids: [] };
  beds.push(b);
  sim._emit('thornBed', { towerUid: t.uid, uid: b.uid, x, y });
  return b;
}

/** Sim._killEnemy: her kill of a ground enemy leaves a thorn bed (Thorn Beds and up). */
export function onVineKill(sim, t, e) {
  if (e.airborne || !(t.stats.vine.beds > 0) || sim.state !== 'wave') return;
  addBed(sim, t, e.x, e.y);
}

/** One step of her vine timer, Bloom Rush and her thorn beds (updateTower, while not sabotaged). */
export function vineTick(sim, t, dt) {
  const v = t.stats.vine;
  if (sim.state !== 'wave') return;
  // Bloom Rush's idle clock (an attack sets bloomIdle back to 0 in updateTower)
  if (v.bloom > 0) {
    t.bloomIdle = (t.bloomIdle || 0) + dt;
    if (t.bloomIdle >= v.bloomIdle) t.bloomT = 0;
    else t.bloomT = (t.bloomT || 0) + dt;
  }
  t.vineCd = (t.vineCd ?? steps(v.every)) - 1;
  if (t.vineCd <= 0) {
    // no walker near her road: try again next step (the vine waits, it is not wasted)
    const s = vineSpot(sim, t);
    if (s && rootVine(sim, t, s)) t.vineCd = steps(v.every);
    else t.vineCd = 0;
  }
  if (t.beds?.length) bedsStep(sim, t, dt);
}

function bedsStep(sim, t, dt) {
  const spec = t.bedSpec;
  const r = BED_RADIUS;
  let n = 0;
  const list = t.beds;
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    b.ttl -= dt;
    if (b.ttl > 0 && b.hits > 0) {
      HITS.length = 0;
      sim.grid.each(b.x, b.y, r, (e) => {
        if (e.dead || b.hitUids.includes(e.uid) || !isEligible(e, spec)) return false;
        HITS.push(e);
        return HITS.length >= b.hits;
      });
      for (let k = 0; k < HITS.length; k++) {
        b.hitUids.push(HITS[k].uid);
        b.hits--;
        sim._hit(HITS[k], t, spec, 1);
      }
      HITS.length = 0;
    }
    if (b.ttl > 0 && b.hits > 0) list[n++] = b;
  }
  list.length = n;
}

/**
 * Wave clear (Sim._checkWaveEnd): vines, beds and Bloom Rush end, the vine timer starts over; Herb Garden and up
 * give lives back (her copies' harvests add up, at most livesCap at this clear).
 */
export function endVineWave(sim) {
  let lives = 0;
  let cap = 0;
  let best = 0;
  let src = null;
  for (const t of sim.towers) {
    const v = t.stats?.vine;
    if (!v) continue;
    if (t.beds) delete t.beds;
    if (t.vines) delete t.vines;
    t.vineCd = steps(v.every);
    if (v.bloom > 0) {
      t.bloomT = 0;
      t.bloomIdle = 0;
    }
    if (!t.removed && v.lives > 0) {
      lives += Math.floor(v.lives);
      cap = Math.max(cap, v.livesCap);
      if (v.lives > best) {
        best = v.lives;
        src = t;
      }
    }
  }
  if (!src || !sim.canHeal() || sim.mode?.oneLife || sim.diff.noIncome) return;
  const given = sim.stats.harvestLives || 0;
  const n = Math.min(lives, cap, sim.maxLives - sim.lives);
  if (n <= 0) return;
  sim.lives += n;
  sim.stats.harvestLives = given + n;
  sim._emit('lifeRestored', { towerUid: src.uid, lives: sim.lives, n });
}
