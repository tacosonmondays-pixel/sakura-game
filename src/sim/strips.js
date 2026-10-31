// Spike strips (Azami, Checkpoint Prefect; docs/specs/UNIT_GAPS.md §5.3, primitive P-3): road objects
// with a hit budget and a lifetime. A strip is a trap record in sim.traps with `strip: true`:
//   - each strip hits every eligible ground enemy that crosses it once (hitUids), until its hits run
//     out; flyers only with Tall Barbs (strip.air, a share of the damage);
//   - it lives strip.ttl s of wave time (-1: until used up); a spent or expired strip explodes when
//     she has Charged Strips (strip.boom);
//   - strips end at the wave clear, except Sticky Tar strips (strip.carry), which carry into the next
//     wave (UNIT_GAPS §7.3; the battle save stores them);
//   - Spike Rain (her ⚡ ability, src/sim/abilities.js) lays extra strips evenly along the road in her
//     reach; they ignore her own cap and end with their lifetime or the wave.
// Placement (her panel chips): Near exit (target mode 'first', the default) lays on the free spot
// nearest the exit; Spread ('last') walks a cursor along the road (one lane, every lane with Patrol
// Route); Checkpoint (her aim point, from Checkpoint tier 3) lays within STRIP_AIM_RADIUS of it.
//
// Determinism: no rng (spots are path samples in a fixed order, ties by lane and distance), squared
// distances only, battle time from fixed steps. Caps (UNIT_GAPS §7.2): her own cap (trap.max), then
// ROAD_OBJECTS_PER_PLAYER and ROAD_OBJECTS_PER_SIM, the oldest strip (lowest uid) evicted first, so
// the work per step stays bounded however many Azamis a player places.

import { isEligible } from './combat.js';
import { samplePath } from './path.js';
import {
  ROAD_OBJECTS_PER_PLAYER, ROAD_OBJECTS_PER_SIM, STRIP_SPOT_STEP, STRIP_SPACING, STRIP_AIM_RADIUS, STRIP_OPENING_MUL,
  STRIP_BOSS_EVERY, BOSS_TRAPS,
} from './constants.js';

/** A boss or miniboss? */
export function isBossTier(e) {
  return e.tier === 'boss' || e.tier === 'miniboss';
}

/**
 * The boss or miniboss within her range that her road objects can reach (`spec`: her trap spec), the one nearest the
 * exit (ties: lower uid); null with none. Placements only: a scan of the enemies.
 */
export function bossInReach(sim, t, spec) {
  const r2 = t.eff.range * t.eff.range;
  let best = null;
  let rem = Infinity;
  for (const e of sim.enemies) {
    if (e.dead || !isBossTier(e) || !isEligible(e, spec)) continue;
    const dx = e.x - t.x;
    const dy = e.y - t.y;
    if (dx * dx + dy * dy > r2) continue;
    const path = sim.pathData[e.pathIndex];
    const left = path ? path.length - e.dist : 0;
    if (left < rem || (left === rem && best && e.uid < best.uid)) {
      best = e;
      rem = left;
    }
  }
  return best;
}

/**
 * Of road `spots` ({ x, y, pathIndex, remaining }), the one nearest boss `e` on its road at or ahead of it (a spot it
 * still walks onto) for which `free(s)` holds; null with none.
 */
export function spotForBoss(sim, spots, e, free) {
  const path = sim.pathData[e.pathIndex];
  const left = path ? path.length - e.dist : 0;
  let best = null;
  let bd = Infinity;
  for (const s of spots) {
    if (s.pathIndex !== e.pathIndex || s.remaining > left + STRIP_SPOT_STEP / 2) continue;
    const dx = s.x - e.x;
    const dy = s.y - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bd && free(s)) {
      best = s;
      bd = d2;
    }
  }
  return best;
}

/** Visible road samples within `reach` of (x, y) (every path), nearest the exit first (ties: lane, then distance). */
export function roadSpots(sim, x, y, reach) {
  const out = [];
  const r2 = reach * reach;
  for (const path of sim.pathData) {
    for (const s of samplePath(path, STRIP_SPOT_STEP)) {
      if (s.hidden) continue; // nothing on the road inside a tunnel
      const dx = s.x - x;
      const dy = s.y - y;
      if (dx * dx + dy * dy <= r2) out.push({ x: s.x, y: s.y, d: s.d, pathIndex: path.index, remaining: path.length - s.d });
    }
  }
  out.sort((a, b) => a.remaining - b.remaining || a.pathIndex - b.pathIndex || a.d - b.d);
  return out;
}

/**
 * Her strip spots at her current range, cached per girl until her range or the route changes. The
 * cache is a pure function of her spot, her range and the paths, so it lives outside the sim state
 * (no battle save or co-op checkpoint holds it; a restored girl simply rebuilds it).
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

/** No live trap or strip closer than STRIP_SPACING to (x, y) (a bell riding on a boss is not on the road). */
function spotFree(sim, x, y) {
  const s2 = STRIP_SPACING * STRIP_SPACING;
  for (const tr of sim.traps) {
    if (tr.dead || tr.boss) continue;
    const dx = tr.x - x;
    const dy = tr.y - y;
    if (dx * dx + dy * dy < s2) return false;
  }
  return true;
}

function removeTrapAt(sim, i) {
  const tr = sim.traps[i];
  tr.dead = true;
  if (!tr.extra && !tr.under && tr.owner) tr.owner.trapCount = Math.max(0, tr.owner.trapCount - 1);
  sim.traps.splice(i, 1);
  sim._emit('trapExpired', { uid: tr.uid, x: tr.x, y: tr.y, ownerUid: tr.ownerUid, evicted: true });
}

/** Makes room for one more strip of player `owner`: the oldest strip of that player, then of anyone. */
function makeRoom(sim, owner) {
  let mine = 0;
  let all = 0;
  let firstMine = -1;
  let first = -1;
  for (let i = 0; i < sim.traps.length; i++) {
    const tr = sim.traps[i];
    if (!tr.strip) continue;
    all++;
    if (first < 0) first = i;
    if ((tr.owner.owner ?? 0) === owner) {
      mine++;
      if (firstMine < 0) firstMine = i;
    }
  }
  if (mine >= ROAD_OBJECTS_PER_PLAYER) {
    removeTrapAt(sim, firstMine);
    all--;
    first = sim.traps.findIndex((tr) => tr.strip);
  }
  if (all >= ROAD_OBJECTS_PER_SIM && first >= 0) removeTrapAt(sim, first);
}

/**
 * Lays one strip of hers at (x, y). `o.extra`: a Spike Rain strip (outside her cap, its own hits,
 * lifetime and arming time). `o.under`: a strip laid for a boss (outside her cap; layStrip).
 */
export function addStrip(sim, t, x, y, o = {}) {
  const st = t.stats.strip;
  makeRoom(sim, t.owner ?? 0);
  const tr = {
    uid: sim._nextUid(), x, y, ownerUid: t.uid, owner: t, strip: true, extra: !!o.extra, under: !!o.under,
    armed: false, armLeft: o.arm ?? t.stats.trap.armTime,
    hits: o.hits ?? st.hits,
    ttl: o.ttl ?? (st.forever ? -1 : st.ttl),
    hitUids: [],
  };
  sim.traps.push(tr);
  if (!tr.extra && !tr.under) t.trapCount++;
  sim._emit('trapPlaced', { uid: tr.uid, x, y, ownerUid: t.uid, strip: true, extra: tr.extra });
  return tr;
}

/** The free spot nearest the exit, among `spots` (null: none). */
function firstFree(sim, spots, filter = null) {
  for (const s of spots) if ((!filter || filter(s)) && spotFree(sim, s.x, s.y)) return s;
  return null;
}

/** Spread mode: the next free spot after her cursor (one lane, or every lane with Patrol Route). */
function nextSpread(sim, t, spots) {
  const lane = t.stats.strip.lanes ? -1 : spots[0].pathIndex;
  const n = spots.length;
  const from = (t.stripCursor || 0) % n;
  for (let k = 0; k < n; k++) {
    const i = (from + k) % n;
    const s = spots[i];
    if (lane >= 0 && s.pathIndex !== lane) continue;
    if (!spotFree(sim, s.x, s.y)) continue;
    t.stripCursor = i + 1;
    return s;
  }
  return null;
}

/** Her spot for the next strip by placement mode (null: nowhere free). */
function nextSpot(sim, t, spots) {
  const st = t.stats.strip;
  if (st.aim && t.aim) {
    const a = t.aim;
    const r2 = STRIP_AIM_RADIUS * STRIP_AIM_RADIUS;
    const s = firstFree(sim, spots, (p) => (p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y) <= r2);
    if (s) return s;
  }
  if (t.targetMode === 'last') return nextSpread(sim, t, spots);
  return firstFree(sim, spots);
}

/** Her strips laid for `boss` still waiting at or under it (within a tile of it, hits left). */
function underCount(sim, t, boss) {
  let n = 0;
  for (const tr of sim.traps) {
    if (tr.dead || !tr.under || tr.owner !== t || tr.hits <= 0) continue;
    const dx = tr.x - boss.x;
    const dy = tr.y - boss.y;
    if (dx * dx + dy * dy <= 1) n++;
  }
  return n;
}

/** The 'strip' behaviour: lays a strip (two in Spread with Double Shift) while a wave runs. */
export function layStrip(sim, t) {
  const st = t.stats.strip;
  const trap = t.stats.trap;
  if (!st || !trap || sim.state !== 'wave') return false;
  const spots = spotsOf(sim, t);
  if (!spots.length) return false;
  // a boss in her range: she also lays one under it (the free spot nearest it, at or ahead of it), outside her cap,
  // while fewer than BOSS_TRAPS of hers wait there; her road strips as ever
  let laid = 0;
  const boss = t.trapSpec ? bossInReach(sim, t, t.trapSpec) : null;
  if (boss && underCount(sim, t, boss) < BOSS_TRAPS) {
    const s = spotForBoss(sim, spots, boss, (p) => spotFree(sim, p.x, p.y));
    if (s) {
      const tr = addStrip(sim, t, s.x, s.y, { under: true });
      t.facing = Math.atan2(tr.x - t.x, tr.y - t.y);
      laid++;
    }
  }
  const n = st.pair && t.targetMode === 'last' && !(st.aim && t.aim) ? 2 : 1;
  for (let k = 0; k < n && t.trapCount < trap.max; k++) {
    const s = nextSpot(sim, t, spots);
    if (!s) break;
    const tr = addStrip(sim, t, s.x, s.y);
    if (!laid) t.facing = Math.atan2(tr.x - t.x, tr.y - t.y);
    laid++;
  }
  if (!laid) return false;
  // the opening burst: ×STRIP_OPENING_MUL laying speed in the first strip.opening s of each wave
  // (updateTower adds a full 1 / rate after this; take back all but 1 / STRIP_OPENING_MUL of it)
  if (st.opening > 0 && sim._waveTime < st.opening) t.cooldown -= (1 - 1 / STRIP_OPENING_MUL) / Math.max(0.05, t.eff.rate);
  sim._emit('attack', { towerUid: t.uid, targetUid: null, kind: 'strip' });
  return true;
}

/**
 * Spike Rain: `count` extra strips spread evenly (by the order of the road samples, lane by lane) over
 * the road within `reach` of her, each with `hits` hits, armed after `arm` s, living `ttl` s.
 * @returns {{ x: number, y: number }[]} where they landed (empty: no road in reach)
 */
export function spikeRain(sim, t, { count, reach, hits, ttl, arm }) {
  const spots = roadSpots(sim, t.x, t.y, reach);
  // even spacing goes along each lane in order, so sort by lane, then distance along it
  spots.sort((a, b) => a.pathIndex - b.pathIndex || a.d - b.d);
  const n = spots.length;
  const out = [];
  if (!n) return out;
  const k = Math.min(count, n);
  for (let i = 0; i < k; i++) {
    const s = spots[Math.floor(((i + 0.5) * n) / k)];
    addStrip(sim, t, s.x, s.y, { extra: true, hits, ttl, arm });
    out.push({ x: s.x, y: s.y });
  }
  return out;
}

/** Total Lockdown (Checkpoint tier 5): every strip.rain s of wave time, a small Spike Rain lays itself. */
export function stripTick(sim, t, dt) {
  const st = t.stats.strip;
  if (!(st.rain > 0) || sim.state !== 'wave') return;
  const now = sim._waveTime;
  if (Math.floor(now / st.rain) <= Math.floor((now - dt) / st.rain) || now < st.rain) return;
  const placed = spikeRain(sim, t, { count: st.rainCount, reach: t.eff.range, hits: st.hits, ttl: 10, arm: 0.3 });
  if (placed.length) sim._emit('spikeRain', { towerUid: t.uid, auto: true, n: placed.length });
}

/** updateTraps' scratch: the enemies a strip hits this step (emptied before and after each use). */
const STRIP_HITS = [];
const STRIP_SCALE = [];

function stripBoom(sim, tr) {
  const owner = tr.owner;
  const spec = owner.stripBoomSpec;
  if (!spec) return;
  const r = owner.stats.strip.boomR;
  const victims = sim.grid.query(tr.x, tr.y, r, []);
  for (const e of victims) if (!e.dead && isEligible(e, spec)) sim._hit(e, owner, spec, 1);
  sim._emit('explode', { x: tr.x, y: tr.y, radius: r, element: spec.element || null, attackType: spec.attackType });
}

/**
 * One step of a strip (updateTraps): ages it, arms it, hits each eligible enemy on it once while its
 * hits last. @returns {boolean} true when the strip is gone
 */
export function stripStep(sim, tr, dt) {
  const owner = tr.owner;
  // lifetimes are wave time (a carried strip waits out the break, like an ability's cooldown)
  if (tr.ttl >= 0 && sim.state === 'wave') {
    tr.ttl -= dt;
    if (tr.ttl <= 0) {
      if (owner.stats.strip.boom > 0) stripBoom(sim, tr);
      sim._emit('trapExpired', { uid: tr.uid, x: tr.x, y: tr.y, ownerUid: tr.ownerUid });
      return true;
    }
  }
  if (!tr.armed) {
    tr.armLeft -= dt;
    if (tr.armLeft <= 0) tr.armed = true;
    return false;
  }
  const spec = owner.trapSpec;
  if (!spec) return false;
  const air = owner.stripAirSpec;
  const share = owner.stats.strip.air;
  STRIP_HITS.length = 0;
  STRIP_SCALE.length = 0;
  const budget = tr.hits;
  // a strip laid for a boss strikes it again every STRIP_BOSS_EVERY steps while it stands on it
  const rehit = tr.bossCd > 0 ? --tr.bossCd > 0 : false;
  sim.grid.each(tr.x, tr.y, spec.triggerRadius, (e) => {
    if (tr.hitUids.includes(e.uid) && (rehit || !tr.under || !isBossTier(e))) return false;
    let scale = 0;
    if (isEligible(e, spec)) scale = 1;
    else if (air && isEligible(e, air)) scale = share;
    if (!scale) return false;
    STRIP_HITS.push(e);
    STRIP_SCALE.push(scale);
    return STRIP_HITS.length >= budget;
  });
  const n = STRIP_HITS.length;
  for (let i = 0; i < n; i++) {
    const e = STRIP_HITS[i];
    if (!tr.hitUids.includes(e.uid)) tr.hitUids.push(e.uid);
    if (tr.under && isBossTier(e)) tr.bossCd = STRIP_BOSS_EVERY;
    tr.hits--;
    if (!e.dead) sim._hit(e, owner, STRIP_SCALE[i] === 1 ? spec : air, STRIP_SCALE[i]);
  }
  STRIP_HITS.length = 0;
  STRIP_SCALE.length = 0;
  if (n) sim._emit('trapTriggered', { uid: tr.uid, x: tr.x, y: tr.y, ownerUid: tr.ownerUid, strip: true, left: tr.hits });
  if (tr.hits > 0) return false;
  if (owner.stats.strip.boom > 0) stripBoom(sim, tr);
  return true;
}

/**
 * Wave clear (Sim._checkWaveEnd): Spike Rain strips, the bells and strips set for a boss and every strip without
 * Sticky Tar end; a carried strip forgets who it hit. Suzu's road bells are untouched. @returns {boolean} whether anything changed
 */
export function endStripWave(sim) {
  let any = false;
  let n = 0;
  const list = sim.traps;
  for (let i = 0; i < list.length; i++) {
    const tr = list[i];
    // a bell or strip set for a boss (layStrip, towers.js bossTrap) ends with the wave, riding or not
    if (tr.under) {
      tr.dead = true;
      any = true;
      continue;
    }
    if (!tr.strip) {
      list[n++] = tr;
      continue;
    }
    any = true;
    if (!tr.extra && !tr.under && tr.owner.stats.strip?.carry) {
      tr.hitUids.length = 0;
      list[n++] = tr;
      continue;
    }
    tr.dead = true;
    if (!tr.extra && !tr.under) tr.owner.trapCount = Math.max(0, tr.owner.trapCount - 1);
  }
  list.length = n;
  return any;
}
