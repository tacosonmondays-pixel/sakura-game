// Zones (GAPS P-4) and the near-exit hook (GAPS P-14): road patches with a radius, a lifetime and an
// effect every step, opened by a girl's kit. Tenka's Singularity path is the first user (BUILD_PLAN 6.4):
//
//   - Gravity Well ('well'): every `every` s of wave time she opens one for `time` s on the road in her
//     range, at the trap spot (src/sim/towers.js trapSpots) with the most enemies within its radius;
//     ties go to the spot nearest the exit. It pulls the enemies inside toward its centre by path
//     distance: `pull` tiles a second × KNOCKBACK_RESIST of the enemy's tier (bosses stand firm,
//     minibosses move at half), never past the centre; a pull back toward the start spends the freeplay
//     knockback budget (e.kbLeft) like any push. It also keeps a short slow and, from Deep Well, a
//     Brittle (vulnerable) status on everything inside.
//   - Last Line ('lastLine'): the enemy step reports the first time an enemy comes within NEAR_EXIT tiles
//     (path distance) of its exit, but only while sim._nearExitOn counts a placed girl with Last Line.
//     A normal or elite enemy that is not already inside an open Last Line sets it off: the lowest-uid
//     girl whose Last Line is ready (and who is not sabotaged) opens a zone at that exit and rests
//     `cooldown` s of wave time. The zone swallows the lowest-uid normal or elite enemy inside it every
//     LAST_LINE_EVERY ticks (the first at once), up to `max`, for `time` s. A swallow is her kill
//     (Sim._killEnemy): the bounty is paid and no life is lost.
//
// Rules:
//   - A zone touches every live enemy outside tunnels; gravity needs no sight, so veiled and flying
//     enemies are inside too.
//   - Caps (GAPS 7.2): ZONE_CAP_PLAYER open zones per player and ZONE_CAP_SIM per sim; a new zone first
//     closes the oldest (lowest uid) of its player's, then the oldest of all.
//   - Every zone ends at the wave clear and when its girl is sold, so a calm point holds none (battle
//     saves keep nothing; co-op checkpoints carry an empty list).
//   - Lazy: sim.zones and sim._nearExitOn exist only once a girl with a well or Last Line was placed or
//     upgraded, so every other battle runs exactly as before and its enemies never check the exit.
//
// Determinism (co-op lockstep): integer tick countdowns, no rng, only + − × ÷, min / max and squared
// distances; zones run in opening order (= uid order), swallows take the lowest uid.
//
// State (plain data; the generic snapshot stores it as is):
//   sim.zones        [{ uid, src, owner, kind, x, y, r, r2, left, anchors: [{ pathIndex, dist }], pull, slow,
//                      vuln, max, eaten, next }]   left: ticks; next: ticks to the next swallow (Last Line) or
//                      status refresh (well)
//   sim._nearExitOn  placed girls with Last Line (0 / absent: the enemy step never checks the exit)
//   t.wellCd         ticks of wave time until her next well (absent / 0: she opens one once a spot has an enemy)
//   t.lastLineCd     ticks of wave time until her Last Line is ready again
//   e.nearExit       the enemy has reported its exit (once per enemy)
//   sim.stats.wells, .lastLines, .swallowed   created by the first one (other battles' results are unchanged)
// Events: zoneOpen { uid, kind, towerUid, owner, x, y, radius, time }, zoneEnd { uid, kind, towerUid, reason:
// 'time'|'full'|'cap'|'wave'|'sold' }, swallow { zoneUid, towerUid, uid, id, x, y } (then the usual death).

import {
  STEP, KNOCKBACK_RESIST, ZONE_CAP_PLAYER, ZONE_CAP_SIM, ZONE_STATUS_TICKS, ZONE_STATUS_TIME, WELL_RETRY_TICKS,
  WELL_PULL_REACH, ZONE_ANCHOR_STEP, LAST_LINE_EVERY,
} from './constants.js';
import { pointAt } from './path.js';
import { placeOnPath } from './enemies.js';
import { trapSpots } from './towers.js';

const TICKS_PER_SECOND = Math.round(1 / STEP);
/** Seconds → whole ticks. */
const ticks = (s) => Math.round((s || 0) * TICKS_PER_SECOND);
const swallowable = (e) => !e.hidden && (e.tier === 'normal' || e.tier === 'elite');

/** Her Gravity Well, when it can open one. */
function wellOf(t) {
  const w = t.stats?.well;
  return w && w.every > 0 && w.time > 0 && w.radius > 0 ? w : null;
}

/** Her Last Line, when it can open one. */
function lastLineOf(t) {
  const l = t.stats?.lastLine;
  return l && l.max > 0 && l.time > 0 && l.radius > 0 ? l : null;
}

/**
 * After a placement, an upgrade or a sale (Sim.placeTower / _refreshTower / sellTower): creates sim.zones
 * the first time a girl has a well or Last Line, and recounts sim._nearExitOn. A battle without either
 * returns at once.
 */
export function syncZones(sim, t) {
  if (!sim.zones) {
    if (!t || !t.stats || !(t.stats.well || t.stats.lastLine)) return;
    sim.zones = [];
  }
  let n = 0;
  for (const o of sim.towers) if (!o.removed && lastLineOf(o)) n++;
  if (n || sim._nearExitOn) sim._nearExitOn = n;
}

// ---------------------------------------------------------------------------
// Opening and closing
// ---------------------------------------------------------------------------

function endZone(sim, z, reason) {
  z.left = 0;
  sim._emit('zoneEnd', { uid: z.uid, kind: z.kind, towerUid: z.src, reason });
}

function bump(sim, key) {
  sim.stats[key] = (sim.stats[key] || 0) + 1;
}

/** Adds a zone under the caps: the oldest of its player's, then the oldest of all, close first. */
function addZone(sim, z) {
  const zs = sim.zones;
  let mine = 0;
  for (let i = 0; i < zs.length; i++) if (zs[i].owner === z.owner) mine++;
  for (let i = 0; mine >= ZONE_CAP_PLAYER && i < zs.length;) {
    if (zs[i].owner === z.owner) {
      endZone(sim, zs[i], 'cap');
      zs.splice(i, 1);
      mine--;
    } else i++;
  }
  while (zs.length >= ZONE_CAP_SIM) endZone(sim, zs.shift(), 'cap');
  zs.push(z);
  sim._emit('zoneOpen', { uid: z.uid, kind: z.kind, towerUid: z.src, owner: z.owner, x: z.x, y: z.y, radius: z.r, time: z.left / TICKS_PER_SECOND });
}

function makeZone(sim, t, kind, x, y, r, time) {
  return {
    uid: sim._nextUid(), src: t.uid, owner: t.owner ?? 0, kind, x, y, r, r2: r * r, left: ticks(time), anchors: [],
    pull: 0, slow: 0, vuln: 0, max: 0, eaten: 0, next: 0,
  };
}

const COUNT = { n: 0 };
function countIn(e) {
  if (!e.hidden) COUNT.n++;
  return false;
}

const PT = { x: 0, y: 0, facing: 0, seg: 0 };

/** Per path, the sample distance nearest (x, y) within r (none: that path is not under the zone). */
function anchorsAt(sim, x, y, r2, out) {
  for (let i = 0; i < sim.pathData.length; i++) {
    const path = sim.pathData[i];
    let best = -1;
    let bestD2 = Infinity;
    let seg = 0;
    for (let d = 0; d <= path.length; d += ZONE_ANCHOR_STEP) {
      pointAt(path, d, PT, seg);
      seg = PT.seg;
      const dx = PT.x - x;
      const dy = PT.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= r2 && d2 < bestD2) {
        bestD2 = d2;
        best = d;
      }
    }
    if (best >= 0) out.push({ pathIndex: i, dist: best });
  }
  return out;
}

/** Opens her Gravity Well on the busiest spot in her range. @returns {boolean} false: no spot has an enemy */
function openWell(sim, t, w) {
  const spots = trapSpots(sim, t);
  let best = null;
  let bestN = 0;
  for (let i = 0; i < spots.length; i++) {
    const s = spots[i];
    COUNT.n = 0;
    sim.grid.each(s.x, s.y, w.radius, countIn);
    if (COUNT.n > bestN) {
      bestN = COUNT.n;
      best = s;
    }
  }
  if (!best) return false;
  const z = makeZone(sim, t, 'well', best.x, best.y, w.radius, w.time);
  anchorsAt(sim, z.x, z.y, z.r2, z.anchors);
  z.pull = w.pull;
  z.slow = w.slow;
  z.vuln = w.vuln;
  addZone(sim, z);
  bump(sim, 'wells');
  return true;
}

/**
 * The near-exit hook (Sim._nearExit, from the enemy step): the first ready Last Line opens at that exit.
 * @param {object} sim
 * @param {object} e EnemyRT that just came within NEAR_EXIT tiles of its exit
 */
export function nearExit(sim, e) {
  const zs = sim.zones;
  if (!zs || !swallowable(e)) return;
  for (let i = 0; i < zs.length; i++) {
    const z = zs[i];
    if (z.kind !== 'lastLine') continue;
    const dx = e.x - z.x;
    const dy = e.y - z.y;
    if (dx * dx + dy * dy <= z.r2) return; // already inside an open Last Line
  }
  let holder = null;
  let l = null;
  for (const t of sim.towers) {
    if (t.removed || t.lastLineCd > 0 || t.disabled > 0) continue;
    l = lastLineOf(t);
    if (l) {
      holder = t;
      break;
    }
  }
  if (!holder) return;
  const path = sim.pathData[e.pathIndex];
  pointAt(path, path.length, PT);
  const z = makeZone(sim, holder, 'lastLine', PT.x, PT.y, l.radius, l.time);
  z.anchors.push({ pathIndex: e.pathIndex, dist: path.length });
  z.max = l.max;
  holder.lastLineCd = ticks(l.cooldown);
  addZone(sim, z);
  bump(sim, 'lastLines');
}

// ---------------------------------------------------------------------------
// The step
// ---------------------------------------------------------------------------

/** Wave time for every girl with a well or Last Line: cooldowns run, a ready well opens. */
function tickGirls(sim) {
  for (const t of sim.towers) {
    const s = t.stats;
    if (s.lastLine && t.lastLineCd > 0) t.lastLineCd--;
    if (!s.well) continue;
    if (t.wellCd > 0) t.wellCd--;
    if (t.wellCd > 0 || t.disabled > 0) continue;
    const w = wellOf(t);
    if (w) t.wellCd = openWell(sim, t, w) ? ticks(w.every) : WELL_RETRY_TICKS;
  }
}

// one well's pass over the enemies inside it (module scratch: grid.each takes no closure)
const W = { sim: null, z: null, amt: 0, status: false, path: null };
const SLOW = { type: 'slow', amount: 0, duration: ZONE_STATUS_TIME };
const VULN = { type: 'vulnerable', bonus: 0, duration: ZONE_STATUS_TIME };

function anchorOn(z, pathIndex) {
  const a = z.anchors;
  for (let i = 0; i < a.length; i++) if (a[i].pathIndex === pathIndex) return a[i].dist;
  return -1;
}

function inWell(e) {
  if (e.hidden) return false;
  const { sim, z } = W;
  const k = KNOCKBACK_RESIST[e.tier] ?? 1;
  const at = k > 0 && W.amt > 0 ? anchorOn(z, e.pathIndex) : -1;
  if (at >= 0) {
    // by path distance, toward the centre and never past it; a far stretch of the same road that bends
    // back near the centre (a hairpin) is not pulled
    const gap = e.dist - at;
    const reach = WELL_PULL_REACH * z.r;
    let amt = W.amt * k;
    if (gap > 0 && gap <= reach) {
      amt = Math.min(amt, gap);
      if (e.kbLeft != null) {
        amt = Math.min(amt, e.kbLeft);
        e.kbLeft -= amt;
      }
      if (amt > 0) {
        e.dist -= amt;
        placeOnPath(e, sim.pathData[e.pathIndex]);
      }
    } else if (gap < 0 && -gap <= reach) {
      e.dist += Math.min(amt, -gap);
      placeOnPath(e, sim.pathData[e.pathIndex]);
    }
  }
  if (W.status) {
    const ctx = sim._statusCtx;
    if (z.slow > 0) {
      SLOW.amount = z.slow;
      sim._applyStatusEvent(e, SLOW, ctx);
    }
    if (z.vuln > 0) {
      VULN.bonus = z.vuln;
      sim._applyStatusEvent(e, VULN, ctx);
    }
  }
  return false;
}

function stepWell(sim, z, dt) {
  W.sim = sim;
  W.z = z;
  W.amt = z.pull * dt;
  W.status = z.next <= 0 && (z.slow > 0 || z.vuln > 0);
  if (W.status) {
    z.next = ZONE_STATUS_TICKS - 1;
    const ctx = sim._statusCtx;
    ctx.element = null;
    ctx.attackType = 'mystic';
    ctx.sourceUid = z.src;
  } else if (z.next > 0) z.next--;
  if (W.amt > 0 || W.status) sim.grid.each(z.x, z.y, z.r, inWell);
  W.sim = null;
  W.z = null;
}

const LL = { best: null, uid: Infinity };
function lowestSwallowable(e) {
  if (e.uid < LL.uid && swallowable(e)) {
    LL.uid = e.uid;
    LL.best = e;
  }
  return false;
}

function stepLastLine(sim, z) {
  if (z.next > 0) {
    z.next--;
    return;
  }
  LL.best = null;
  LL.uid = Infinity;
  sim.grid.each(z.x, z.y, z.r, lowestSwallowable);
  const e = LL.best;
  LL.best = null;
  if (!e) return;
  z.eaten++;
  z.next = LAST_LINE_EVERY - 1;
  bump(sim, 'swallowed');
  sim._emit('swallow', { zoneUid: z.uid, towerUid: z.src, uid: e.uid, id: e.id, x: e.x, y: e.y });
  sim._killEnemy(e, sim._towerByUid.get(z.src) || null);
  if (z.eaten >= z.max) endZone(sim, z, 'full');
}

/** One fixed step (Sim._step1, right after updateTraps): girls' timers in a wave, then every open zone. */
export function updateZones(sim, dt) {
  if (sim.state === 'wave') tickGirls(sim);
  const zs = sim.zones;
  if (!zs.length) return;
  let ended = false;
  for (let i = 0; i < zs.length; i++) {
    const z = zs[i];
    if (z.left <= 0) {
      ended = true;
      continue;
    }
    if (z.kind === 'well') stepWell(sim, z, dt);
    else stepLastLine(sim, z);
    if (z.left <= 0) ended = true; // full
    else if (--z.left <= 0) {
      endZone(sim, z, 'time');
      ended = true;
    }
  }
  if (ended) {
    let n = 0;
    for (let i = 0; i < zs.length; i++) if (zs[i].left > 0) zs[n++] = zs[i];
    zs.length = n;
  }
}

/** The wave clear (Sim._checkWaveEnd): every zone ends. */
export function endZoneWave(sim) {
  const zs = sim.zones;
  if (!zs || !zs.length) return;
  for (const z of zs) endZone(sim, z, 'wave');
  zs.length = 0;
}

/** A girl leaves (sold; Sim.sellTower, after she is off the list): her zones close, the hook recounts. */
export function clearZones(sim, t) {
  const zs = sim.zones;
  if (!zs) return;
  let n = 0;
  for (let i = 0; i < zs.length; i++) {
    if (zs[i].src === t.uid) endZone(sim, zs[i], 'sold');
    else zs[n++] = zs[i];
  }
  zs.length = n;
  syncZones(sim, t);
}
