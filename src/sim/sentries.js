// The sentry builder (Yuzuha, Security Bureau Technician; docs/specs/UNIT_GAPS.md §5.2, primitives
// P-3 / deploy): she shoots taser darts herself, and while a wave runs she sets ground sentries at the
// road's edge inside her range. A sentry has a lifetime, fires from its own spot, can carry the type
// the threat needs (Specialist Kits) and bursts when it runs out (Burst Cells). Her Capture Net path
// lays nets on the road that catch weak ground enemies outright out of an HP budget per wave; her ⚡
// Emergency Deploy (src/sim/abilities.js, deploy 'sentries') drops extra sentries at once.
//
// State: t.sentries [{ uid, x, y, ttl, type, cooldown, extra }] (all end at the wave clear) and
// t.nets [{ x, y, left, wave }] (they stay; the budget refills when a new wave starts). Both are plain
// data; the battle save keeps the nets.
//
// Determinism: spots are path samples pushed off the centreline along the path normal (-dy, dx)/len
// with sqrt only, in a fixed order (nearest the exit first, ties by lane, distance and side); the
// deploy timer is the step number staggered by uid; the type rule reads counts in a fixed order
// (veiled, airborne, elite, else); no rng. Caps: her own sentry cap, SENTRIES_PER_PLAYER and
// SENTRIES_PER_SIM over every girl's, the oldest sentry (lowest uid) removed first.

import { isEligible } from './combat.js';
import { samplePath } from './path.js';
import { bestTarget, explode, spawnProjectile } from './towers.js';
import { roadSpots } from './strips.js';
import {
  STEP, TURRET_PROJECTILE_SPEED, SENTRY_SPOT_STEP, SENTRY_OFFSET, SENTRY_SPACING, SENTRIES_PER_PLAYER, SENTRIES_PER_SIM,
  NET_RADIUS, NET_SPACING, NET_COIN_BONUS,
} from './constants.js';

const stepNo = (sim) => Math.round(sim.time / STEP);

/**
 * Road-edge spots within `reach` of (x, y): every SENTRY_SPOT_STEP tiles of every path, pushed
 * SENTRY_OFFSET tiles to each side of the centreline; nearest the exit first.
 */
export function edgeSpots(sim, x, y, reach) {
  const out = [];
  const r2 = reach * reach;
  for (const path of sim.pathData) {
    const s = samplePath(path, SENTRY_SPOT_STEP);
    for (let i = 0; i < s.length; i++) {
      if (s[i].hidden) continue;
      const a = s[Math.max(0, i - 1)];
      const b = s[Math.min(s.length - 1, i + 1)];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      for (const side of [1, -1]) {
        const px = s[i].x + nx * SENTRY_OFFSET * side;
        const py = s[i].y + ny * SENTRY_OFFSET * side;
        const ex = px - x;
        const ey = py - y;
        if (ex * ex + ey * ey <= r2) out.push({ x: px, y: py, d: s[i].d, pathIndex: path.index, side, remaining: path.length - s[i].d });
      }
    }
  }
  out.sort((p, q) => p.remaining - q.remaining || p.pathIndex - q.pathIndex || p.d - q.d || q.side - p.side);
  return out;
}

/** Her edge spots at her current range, cached outside the sim state (a pure function of spot, range, paths). */
const SPOT_CACHE = new WeakMap();
function spotsOf(sim, t) {
  const range = t.eff.range;
  const c = SPOT_CACHE.get(t);
  if (c && c.range === range && c.paths === sim.pathData && c.x === t.x && c.y === t.y) return c.list;
  const list = edgeSpots(sim, t.x, t.y, range);
  SPOT_CACHE.set(t, { range, paths: sim.pathData, x: t.x, y: t.y, list });
  return list;
}

function spotFree(sim, x, y) {
  const s2 = SENTRY_SPACING * SENTRY_SPACING;
  for (const o of sim.towers) {
    if (!o.sentries) continue;
    for (const s of o.sentries) {
      const dx = s.x - x;
      const dy = s.y - y;
      if (dx * dx + dy * dy < s2) return false;
    }
  }
  return true;
}

/** Removes sentry `s` of girl `t` (expiry or eviction). A burst cell bursts when it runs out. */
function dropSentry(sim, t, s, burst) {
  const i = t.sentries.indexOf(s);
  if (i >= 0) t.sentries.splice(i, 1);
  if (burst && t.sentryBurstSpec) explode(sim, t, t.sentryBurstSpec, s.x, s.y, 1);
  sim._emit('deployEnd', { uid: s.uid, towerUid: t.uid, x: s.x, y: s.y, burst: !!burst });
}

/** Makes room for one more sentry of player `owner`: the oldest of that player's, then anyone's. */
function makeRoom(sim, owner) {
  let mine = 0;
  let all = 0;
  let oldMine = null;
  let oldAll = null;
  for (const o of sim.towers) {
    if (!o.sentries) continue;
    for (const s of o.sentries) {
      all++;
      if (!oldAll || s.uid < oldAll.s.uid) oldAll = { o, s };
      if ((o.owner ?? 0) === owner) {
        mine++;
        if (!oldMine || s.uid < oldMine.s.uid) oldMine = { o, s };
      }
    }
  }
  if (mine >= SENTRIES_PER_PLAYER) dropSentry(sim, oldMine.o, oldMine.s, false);
  else if (all >= SENTRIES_PER_SIM) dropSentry(sim, oldAll.o, oldAll.s, false);
}

/**
 * Specialist Kits: the type the threat in her range needs, read in a fixed order: veiled → Flash,
 * airborne → Flak, elite or stronger → Heavy, everything else → Net.
 */
export function sentryType(sim, t) {
  if (!t.stats.sentry.kits) return 'plain';
  let veiled = 0;
  let air = 0;
  let elite = 0;
  sim.grid.each(t.x, t.y, t.eff.range, (e) => {
    if (e.hidden) return false;
    if (e.veiled && !e.revealed) veiled++;
    else if (e.airborne && !e.grounded) air++;
    else if (e.tier === 'elite' || e.tier === 'miniboss' || e.tier === 'boss') elite++;
    return false;
  });
  if (veiled) return 'flash';
  if (air) return 'flak';
  if (elite) return 'heavy';
  return 'net';
}

/** Sets one sentry of hers at (x, y). `extra`: Emergency Deploy's (outside her cap, its own lifetime). */
export function addSentry(sim, t, x, y, { extra = false, ttl = t.stats.sentry.ttl } = {}) {
  makeRoom(sim, t.owner ?? 0);
  const s = { uid: sim._nextUid(), x, y, ttl, type: sentryType(sim, t), cooldown: 0.3, extra };
  t.sentries.push(s);
  sim._emit('deploy', { uid: s.uid, towerUid: t.uid, x, y, kind: 'sentry', type: s.type, extra });
  return s;
}

/** Up to `n` free edge spots: nearest (x, y) when given, else nearest the exit; in her range. */
export function sentrySpots(sim, t, n, near = null) {
  let list = spotsOf(sim, t);
  if (near) {
    list = [...list].sort((p, q) => {
      const a = (p.x - near.x) * (p.x - near.x) + (p.y - near.y) * (p.y - near.y);
      const b = (q.x - near.x) * (q.x - near.x) + (q.y - near.y) * (q.y - near.y);
      return a - b || p.remaining - q.remaining;
    });
  }
  const out = [];
  const s2 = SENTRY_SPACING * SENTRY_SPACING;
  for (const p of list) {
    if (out.length >= n) break;
    if (!spotFree(sim, p.x, p.y)) continue;
    if (out.some((o) => (o.x - p.x) * (o.x - p.x) + (o.y - p.y) * (o.y - p.y) < s2)) continue;
    out.push(p);
  }
  return out;
}

/** A Capture Net catches this enemy if its tier is allowed (normal; elites with Big Net; minibosses with the grid). */
function netCatches(st, e) {
  if (e.tier === 'boss') return false;
  if (e.tier === 'miniboss') return st.netBoss;
  if (e.tier === 'elite') return st.netElite;
  return true;
}

function stepNets(sim, t) {
  const st = t.stats.sentry;
  if (!(st.nets > 0)) return;
  // lay any missing net on the free road spot nearest the exit (Capture Net tier 3, the grid's second)
  while (t.nets.length < st.nets) {
    const spots = roadSpots(sim, t.x, t.y, t.eff.range);
    const free = spots.find((p) => t.nets.every((n) => (n.x - p.x) * (n.x - p.x) + (n.y - p.y) * (n.y - p.y) >= NET_SPACING * NET_SPACING));
    if (!free) break;
    t.nets.push({ x: free.x, y: free.y, left: st.netBudget, wave: sim.wave });
    sim._emit('deploy', { uid: -1, towerUid: t.uid, x: free.x, y: free.y, kind: 'net' });
  }
  for (const n of t.nets) {
    if (n.wave !== sim.wave) {
      n.wave = sim.wave; // a new wave: the budget refills
      n.left = st.netBudget;
    }
    if (n.left <= 0) continue;
    const spec = t.netSpec;
    const near = sim.grid.query(n.x, n.y, NET_RADIUS, []);
    for (const e of near) {
      if (e.dead || n.left < e.hp || !isEligible(e, spec) || !netCatches(st, e)) continue;
      n.left -= e.hp;
      sim._emit('netCatch', { towerUid: t.uid, uid: e.uid, x: e.x, y: e.y, left: n.left });
      const bounty = e.bounty;
      sim._killEnemy(e, t);
      const bonus = sim._gainCash(bounty * NET_COIN_BONUS);
      if (bonus > 0) sim._emit('cash', { amount: bonus, reason: 'net', towerUid: t.uid });
      if (n.left <= 0) break;
    }
  }
}

/** Every step of a sentry girl (src/sim/towers.js updateTower): deploy, sentries fire and age, nets. */
export function sentryTick(sim, t, dt) {
  const st = t.stats.sentry;
  if (sim.state !== 'wave') return;
  // a new sentry every st.every s (faster with Quick Deploy), staggered by uid, up to her cap
  const every = Math.max(1, Math.round(st.every / (1 + st.speed) / STEP));
  if ((stepNo(sim) + t.uid) % every === 0 && t.sentries.filter((s) => !s.extra).length < st.max) {
    const [p] = sentrySpots(sim, t, 1);
    if (p) addSentry(sim, t, p.x, p.y);
  }
  const specs = t.sentrySpecs;
  for (let i = 0; i < t.sentries.length; i++) {
    const s = t.sentries[i];
    s.ttl -= dt;
    if (s.ttl <= 0) {
      dropSentry(sim, t, s, st.burst > 0);
      i--;
      continue;
    }
    if (s.cooldown > 0) s.cooldown -= dt;
    if (s.cooldown > 0) continue;
    const spec = specs[s.type] || specs.plain;
    const e = bestTarget(sim, s.x, s.y, spec.range, spec, t.targetMode);
    if (!e) {
      s.cooldown = 0;
      continue;
    }
    spawnProjectile(sim, t, spec, e, s.x, s.y, { kind: 'bullet', speed: TURRET_PROJECTILE_SPEED, pierce: 1, splash: 0, range: spec.range, turretUid: s.uid });
    s.cooldown += 1 / Math.max(0.05, spec.rate);
    sim._emit('attack', { towerUid: t.uid, targetUid: e.uid, kind: 'bullet', turretUid: s.uid });
  }
  stepNets(sim, t);
}

/**
 * Emergency Deploy: `count` extra sentries (her current sentry stats) at the edge spots nearest her
 * aim point, or nearest the lead enemy in her range. @returns {object[]} the sentries (empty: none)
 */
export function emergencyDeploy(sim, t, { count, ttl }, aim, lead) {
  const near = aim ? { x: aim[0] ?? aim.x, y: aim[1] ?? aim.y } : lead ? { x: lead.x, y: lead.y } : null;
  return sentrySpots(sim, t, count, near).map((p) => addSentry(sim, t, p.x, p.y, { extra: true, ttl }));
}

/** Wave clear (Sim._checkWaveEnd): every sentry ends (no burst); nets stay. */
export function endSentryWave(sim) {
  for (const t of sim.towers) if (t.sentries?.length) t.sentries.length = 0;
}
