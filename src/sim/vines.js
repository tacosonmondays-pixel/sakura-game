// The nature caster (Chigusa, Greenhouse Gardener; docs/specs/UNIT_GAPS.md §5.7, P-10, P-3): she throws
// a fan of thorn seeds (the projectile behaviour), and on top of that:
//   - Creeping Vine: every vine.every s of wave time a vine HOLDS the lead non-boss ground enemy in her
//     range for vine.hold s (the `hold` status: cannot move; minibosses resist like any crowd control,
//     bosses and flyers are immune). With Strangler Vine it also deals vine.dps a second while it holds
//     (a hit at the grab and one every VINE_TICK s after).
//   - Thorn Beds: her kills of ground enemies leave a thorn bed on the spot: vine.beds hits of
//     vine.bedDmg, each enemy at most once, for vine.bedTtl s of wave time.
//   - Bloom Rush: her attack speed rises by vine.bloomPer for each second she keeps attacking, up to
//     +vine.bloom; vine.bloomIdle s without an attack resets it (src/sim/towers.js updateTower).
//   - Harvest lives: vine.lives back at each wave clear, her copies' harvests together, at most
//     vine.livesCap at one wave clear (HARVEST_LIVES_PER_WAVE) and no cap for the whole battle (never above
//     the starting lives, never where hearts cannot come back or with no income).
//
// State: t.vineCd (s to the next vine), t.vineHold { uid, left, tick } (the enemy her vine holds),
// t.beds [{ uid, x, y, hits, ttl, hitUids }], t.bloomT / t.bloomIdle (Bloom Rush). All of it resets at
// the wave clear, so a calm point carries none of it (UNIT_GAPS §7.3).
//
// Determinism: targets by the targeting score (ties: grid order), squared distances, countdowns of
// fixed steps, no rng. Caps: BEDS_PER_GIRL, then BEDS_PER_SIM (the oldest bed of hers evicted first;
// a full sim lays none).

import { gatherTargets, targetScore } from './towers.js';
import { isEligible } from './combat.js';
import { syncStatusFlags } from './enemies.js';
import { BED_RADIUS, BEDS_PER_GIRL, BEDS_PER_SIM, VINE_TICK } from './constants.js';

const NEAR = [];
const HITS = [];

/** The enemy her vine goes for: the lead (by her First score) eligible, non-boss, ground, not yet held. */
export function vineTarget(sim, t) {
  const c = gatherTargets(sim, t.x, t.y, t.eff.range, t.vineSpec, NEAR);
  let best = null;
  let bestS = -Infinity;
  for (let i = 0; i < c.length; i++) {
    const e = c[i];
    if (e.tier === 'boss' || e.airborne || e.statuses.hold) continue;
    const s = targetScore('first', t.x, t.y, e);
    if (s > bestS) {
      bestS = s;
      best = e;
    }
  }
  NEAR.length = 0;
  return best;
}

/** A vine at `e` (or her lead enemy): the hold, and the first hit when the vine has damage. */
export function castVine(sim, t, e = vineTarget(sim, t)) {
  const v = t.stats.vine;
  if (!e) return null;
  const ctx = sim._statusCtx;
  ctx.element = null;
  ctx.attackType = t.eff.attackType;
  ctx.sourceUid = t.uid;
  if (!sim._applyStatusEvent(e, { type: 'hold', duration: v.hold }, ctx)) return null;
  syncStatusFlags(e);
  const left = e.statuses.hold?.left ?? v.hold;
  t.vineHold = { uid: e.uid, left, tick: 0 };
  t.facing = Math.atan2(e.x - t.x, e.y - t.y);
  sim._emit('vine', { towerUid: t.uid, targetUid: e.uid, x: e.x, y: e.y, hold: left });
  if (v.dps > 0) sim._hit(e, t, t.vineSpec, 1);
  return e;
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

/** One step of her vine, her held enemy's damage and her thorn beds (updateTower, while not sabotaged). */
export function vineTick(sim, t, dt) {
  const v = t.stats.vine;
  if (sim.state !== 'wave') return;
  // Bloom Rush's idle clock (an attack sets bloomIdle back to 0 in updateTower)
  if (v.bloom > 0) {
    t.bloomIdle = (t.bloomIdle || 0) + dt;
    if (t.bloomIdle >= v.bloomIdle) t.bloomT = 0;
    else t.bloomT = (t.bloomT || 0) + dt;
  }
  const h = t.vineHold;
  if (h) {
    h.left -= dt;
    h.tick += dt;
    const e = sim.enemies.find((o) => o.uid === h.uid);
    if (!e || e.dead || h.left <= 1e-9) t.vineHold = null;
    else if (v.dps > 0 && h.tick >= VINE_TICK - 1e-9) {
      h.tick -= VINE_TICK;
      sim._hit(e, t, t.vineSpec, 1);
    }
  }
  t.vineCd = (t.vineCd ?? v.every) - dt;
  if (t.vineCd <= 0) {
    // no lead enemy: try again next step (the vine waits, it is not wasted)
    if (castVine(sim, t)) t.vineCd += v.every;
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
 * Wave clear (Sim._checkWaveEnd): beds, holds and Bloom Rush end, the vine timer starts over; Herb
 * Garden and up give lives back (her copies' harvests add up, at most livesCap at this clear).
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
    t.vineHold = null;
    t.vineCd = v.every;
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
