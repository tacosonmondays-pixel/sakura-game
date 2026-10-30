// Iroha's mirror network (docs/specs/IROHA_MIRRORS.md; the rework of ABILITIES_SPEC §5.2's Mirror Shift).
//
//   - Mirrors (§1): she owns relay.mirrors of them (2 at base, up to MIRROR_MAX). Slot k is placed by her player
//     (t.mirrorAim[k] { x, y }, Sim.setAim with a slot: quantised, clamped into the map and her mirror reach) or Auto
//     (null): the road samples in her reach, evenly spread (autoSpots). t.mirrors (derived, one { x, y } per slot) is
//     rebuilt by syncMirrors on placement, upgrades, setAim / clearAim and a relocation (towers.js updateRelayOrigin);
//     mirror 0 is her relay origin (t.ox, t.oy), so every reader of "her panel" points at a real mirror.
//   - Reflected Bolt (§2): her volley leaves where she stands; bolt i enters her chain at mirror i mod m and visits
//     relay.bounces mirrors in chain order (wrapping; never the same one twice in a row), capped at BOUNCE_CAP, then
//     takes the best enemy by her target mode within her range of the last mirror (else of her; else it ends there).
//     On a leg it flies straight; its swept segment hits enemies like any bolt, each once a leg, up to its pierce, and
//     every bounce starts a new leg (pierce refilled; an emptied leg stops hitting, the bolt flies on). It stops ON a mirror
//     (the rest of that step's distance is dropped, the same on every client) and bounces there: the damage scale
//     1 + bounceMul × bounces, a bounce splash, shards (a plain bolt at another enemy; SHARD_BUDGET a step), and a
//     'mirrorBounce' event (the display's reflected beam). Her bolts are born `split`: no mirror ever splits them.
//   - Allies' shots (§3): while her ⚡ runs, and for good at Mirror Hall tier 5 (permanentReflect), every mirror of hers
//     reflects: an ally's projectile (both players' girls in co-op, drones' and sentries'; never hers) whose step segment
//     passes within MIRROR_RADIUS of one splits once: the original flies on and a copy leaves the crossing point for her
//     next mirror (relay.allyBounces mirrors in chain order, capped at ALLY_BOUNCE_CAP), then the best enemy by the
//     shooter's target mode within the shot's range that is neither the original's target nor already hit by it (else
//     that target; else the copy ends). Both are marked `split` and never split again (no loops, two networks included).
//     A copy is the same shot (spec, kind, speed, pierce, splash, credit, the original's hits). A guided or returning
//     shot splits the old way (its copy fanned from the crossing point, no route). A shot that ends its step dead does
//     not split that step.
//   - ⚡ Laser Web (§5; deploy type 'mirror', src/sim/abilities.js DEPLOYS.mirror): while it runs (her t.abil.active,
//     integer steps) every WEB_TICK steps each pair of her mirrors (i < j) is a beam that hits every eligible enemy
//     within WEB_HALF (plus its hit radius) of it once, at her damage × dmgMul; WEB_HITS_PER_STEP for the whole board.
//
// Determinism: towers in placement order, mirrors by slot, bolts in volley order, beams by pair; + − × ÷, Math.sqrt,
// Math.floor and squared distances only (no rng, no trig; a fanned copy's turn is spawnProjectile's, as every shot).
// State: t.mirrorAim (saved), t.mirrors (derived), the routed bolts' fields in sim.projectiles (calm: the wave clear
// ends them); the budgets are per-step scratch reset at the top of every step (updateProjectiles).

import { spawnProjectile, selectTargets, selectTargetsInto } from './towers.js';
import { abilityDef } from './abilities.js';
import { isEligible } from './combat.js';
import { segDistSq, projectOnSegment } from './path.js';
import { hitRadius } from './shapes.js';
import { MIRROR_RADIUS, SPLIT_FAN, AIM_QUANT } from './constants.js';

/** Most mirrors a girl owns. */
export const MIRROR_MAX = 5;
/** Most mirrors one of her bolts visits. */
export const BOUNCE_CAP = 6;
/** Most mirrors an ally's reflected copy visits. */
export const ALLY_BOUNCE_CAP = 2;
/** Shards thrown a step, the whole board. */
export const SHARD_BUDGET = 64;
/** Steps between two laser web hits (0.2 s at 60 steps a second). */
export const WEB_TICK = 12;
/** A web beam's half width (tiles; plus the enemy's hit radius). */
export const WEB_HALF = 0.35;
/** Web beam hits a step, the whole board. */
export const WEB_HITS_PER_STEP = 600;
/** Most reflecting mirrors a projectile is tested against (the first in tower order). */
export const MIRROR_GATHER = 24;

const R2 = MIRROR_RADIUS * MIRROR_RADIUS;
/** The reflecting mirrors this step: flat [x, y, towerUid, slot] quads (module scratch, refilled every step). */
const MIR = [];
const MIR_T = [];
/** Per-step budgets (reset by stepStart). */
let shardsLeft = SHARD_BUDGET;
let webLeft = WEB_HITS_PER_STEP;
const NEAR = [];
const CONTACT = [];
const PICK = [];
const SPL = [];

/** Is this girl a mirror girl (her relay is a mirror)? */
export const isMirrorGirl = (t) => t?.stats?.relay?.kind === 'mirror';

/** How many mirrors she owns now (1..MIRROR_MAX). */
export function mirrorCount(t) {
  const n = t?.stats?.relay?.mirrors | 0;
  return n < 1 ? 1 : n > MIRROR_MAX ? MIRROR_MAX : n;
}

/** Is this girl's ability the mirror deploy (her merged def)? */
function mirrorDef(t) {
  if (!t.abil || t.removed || !isMirrorGirl(t)) return null;
  const def = abilityDef(t);
  return def && def.kind === 'deploy' && def.effect?.deploy === 'mirror' ? def : null;
}

/** Do her mirrors reflect allies' shots now (her ⚡ running, or Infinite Reflection for good)? */
export function mirrorsReflect(t) {
  const def = mirrorDef(t);
  return !!def && !!t.mirrors && (t.abil.active > 0 || !!def.effect.permanentReflect);
}

// ---------------------------------------------------------------------------
// Mirrors: slots, Auto spots, the derived list
// ---------------------------------------------------------------------------

/** A mirror point for her: quantised to the co-op grid, clamped into the map and to her mirror reach (Sim.setAim's clamp). */
export function mirrorPoint(sim, t, x, y) {
  let ax = Math.round(x * AIM_QUANT) / AIM_QUANT;
  let ay = Math.round(y * AIM_QUANT) / AIM_QUANT;
  ax = Math.min(sim.map.width || 0, Math.max(0, ax));
  ay = Math.min(sim.map.height || 0, Math.max(0, ay));
  const reach = t.stats.relay.reach;
  const dx = ax - t.x;
  const dy = ay - t.y;
  const d2 = dx * dx + dy * dy;
  if (d2 > reach * reach) {
    const k = reach / Math.sqrt(d2);
    ax = t.x + dx * k;
    ay = t.y + dy * k;
  }
  return { x: ax, y: ay };
}

/**
 * Auto spots for `m` mirrors (pure but for the samples): the visible road samples within her reach, in their order
 * (path, then distance), slot k at index floor((k + 0.5) × n / m); with none, where she stands.
 * @returns {{ x: number, y: number }[]}
 */
export function autoSpots(samples, x, y, reach, m) {
  const r2 = reach * reach;
  const idx = [];
  for (let i = 0; i < (samples ? samples.length : 0); i++) {
    const dx = samples[i].x - x;
    const dy = samples[i].y - y;
    if (dx * dx + dy * dy <= r2) idx.push(i);
  }
  const out = [];
  for (let k = 0; k < m; k++) {
    if (!idx.length) out.push({ x, y });
    else {
      const s = samples[idx[Math.floor(((k + 0.5) * idx.length) / m)]];
      out.push({ x: Math.round(s.x * AIM_QUANT) / AIM_QUANT, y: Math.round(s.y * AIM_QUANT) / AIM_QUANT });
    }
  }
  return out;
}

/**
 * Rebuilds t.mirrors from her placed slots and the Auto rule (towers.js updateRelayOrigin, for a mirror girl); emits
 * 'mirrors' when the list changed. @returns {{ x, y }} mirror 0 (her relay origin)
 */
export function syncMirrors(sim, t) {
  const m = mirrorCount(t);
  const relay = t.stats.relay;
  const aims = t.mirrorAim;
  if (aims && aims.length > m) aims.length = m;
  let auto = null;
  const list = [];
  for (let k = 0; k < m; k++) {
    const a = aims ? aims[k] : null;
    if (a) list.push(mirrorPoint(sim, t, a.x, a.y));
    else {
      if (!auto) auto = autoSpots(sim._relaySamples, t.x, t.y, relay.reach, m);
      list.push(auto[k]);
    }
  }
  const old = t.mirrors;
  let same = !!old && old.length === list.length;
  for (let k = 0; same && k < list.length; k++) same = old[k].x === list[k].x && old[k].y === list[k].y;
  if (!same) {
    t.mirrors = list;
    sim._emit('mirrors', { towerUid: t.uid, list: list.map((p) => [p.x, p.y]), placed: list.map((_, k) => (aims && aims[k] ? 1 : 0)) });
  }
  return t.mirrors[0];
}

/**
 * Places or moves mirror `slot` (Sim.setAim for a mirror girl; the point is already quantised and clamped). Without a
 * slot (null / undefined) the mirror nearest the point moves (ties: the lower slot). @returns {number} the slot, -1 refused
 */
export function placeMirror(t, x, y, slot) {
  const m = mirrorCount(t);
  let k = slot;
  if (k == null) {
    k = 0;
    let best = Infinity;
    const list = t.mirrors || [];
    for (let i = 0; i < list.length && i < m; i++) {
      const dx = list[i].x - x;
      const dy = list[i].y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) {
        best = d2;
        k = i;
      }
    }
  }
  if (!Number.isInteger(k) || k < 0 || k >= m) return -1;
  const aims = t.mirrorAim || (t.mirrorAim = []);
  while (aims.length < m) aims.push(null);
  aims[k] = { x, y };
  return k;
}

// ---------------------------------------------------------------------------
// Reflected Bolt: her routed bolts
// ---------------------------------------------------------------------------

/** Resets the per-step budgets (updateProjectiles, first thing every step). */
export function stepStart() {
  shardsLeft = SHARD_BUDGET;
  webLeft = WEB_HITS_PER_STEP;
}

/**
 * Gives bolt `p` (bolt number `i` of her volley, just spawned at her) its route through her mirrors (§2).
 * Her final-leg splash waits on p.fsplash; legs never burst.
 */
export function routeBolt(t, p, i) {
  const ms = t.mirrors;
  const m = ms.length;
  const relay = t.stats.relay;
  let b = relay.bounces | 0;
  if (b > BOUNCE_CAP) b = BOUNCE_CAP;
  if (m === 1 && b > 1) b = 1;
  if (b < 1) b = 1;
  const route = [];
  for (let j = 0; j < b; j++) {
    const s = ms[(i + j) % m];
    route.push(s.x, s.y);
  }
  setRoute(p, route, true);
  p.mirrorOf = t.uid;
  p.firstSlot = i % m;
}

function setRoute(p, route, own) {
  p.route = route;
  p.ri = 0;
  p.bounce = 0;
  p.split = true;
  p.refill = own ? p.pierce : 0;
  p.fsplash = p.splash;
  if (own) p.splash = 0;
  p.travel = 0;
  // where the leg it flies began (the display's reflected beam runs from here to the mirror)
  p.lx = p.x;
  p.ly = p.y;
  aimAt(p, route[0], route[1]);
}

function aimAt(p, x, y) {
  const dx = x - p.x;
  const dy = y - p.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 1e-6) {
    p.vx = (dx / d) * p.speed;
    p.vy = (dy / d) * p.speed;
  }
  p.est = d;
}

/**
 * One step of a routed projectile (towers.js projectileStep, while p.route is set): fly at the next mirror, hit what the
 * leg crosses, bounce on arriving; the last bounce hands it back to the plain step (a homing bolt).
 */
export function routeStep(sim, p, dt) {
  const r = p.route;
  const wx = r[p.ri * 2];
  const wy = r[p.ri * 2 + 1];
  const ax = p.x;
  const ay = p.y;
  const dx = wx - ax;
  const dy = wy - ay;
  const d2 = dx * dx + dy * dy;
  const stepLen = p.speed * dt;
  const arrive = d2 <= stepLen * stepLen;
  if (arrive) {
    p.x = wx;
    p.y = wy;
    p.travel += Math.sqrt(d2);
  } else {
    const d = Math.sqrt(d2);
    p.vx = (dx / d) * p.speed;
    p.vy = (dy / d) * p.speed;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.travel += stepLen;
  }
  legHits(sim, p, ax, ay);
  if (p.dead || !arrive) return;
  bounce(sim, p, wx, wy);
}

/** The enemies the step's segment (ax, ay) → (p.x, p.y) crosses, in line order, each once per bolt, up to its pierce. */
function legHits(sim, p, ax, ay) {
  if (p.pierce <= 0) return;
  const sx = (ax + p.x) / 2;
  const sy = (ay + p.y) / 2;
  const hx = p.x - ax;
  const hy = p.y - ay;
  const half = Math.sqrt(hx * hx + hy * hy) / 2;
  NEAR.length = 0;
  const near = sim.grid.query(sx, sy, half + 0.9, NEAR);
  CONTACT.length = 0;
  for (let i = 0; i < near.length; i++) {
    const e = near[i];
    if (e.dead || p.hits.includes(e.uid)) continue;
    const hr = hitRadius(e);
    if (segDistSq(e.x, e.y, ax, ay, p.x, p.y) > hr * hr) continue;
    if (!isEligible(e, p.spec)) continue;
    CONTACT.push(e);
  }
  NEAR.length = 0;
  if (!CONTACT.length) return;
  if (CONTACT.length > 1) {
    const bx = p.x;
    const by = p.y;
    CONTACT.sort((a, b) => projectOnSegment(a.x, a.y, ax, ay, bx, by) - projectOnSegment(b.x, b.y, ax, ay, bx, by));
  }
  for (let i = 0; i < CONTACT.length; i++) {
    const e = CONTACT[i];
    if (e.dead) continue;
    if (p.splash > 0) {
      // (an ally's splash copy bursts at its first contact, as it always does)
      p.hits.push(e.uid);
      splashAt(sim, p, e.x, e.y, p.splash, 1);
      p.dead = true;
      break;
    }
    p.hits.push(e.uid);
    sim._hit(e, p.owner, p.spec, p.scale ?? 1);
    p.pierce--;
    if (p.pierce <= 0) {
      // her bolt flies on to its mirror (the bounce refills it); an ally's copy is spent like any shot
      if (!p.refill) p.dead = true;
      break;
    }
  }
  CONTACT.length = 0;
}

/** Every eligible enemy within `radius` of (x, y), at the bolt's spec × scale; emits 'explode'. */
function splashAt(sim, p, x, y, radius, scale) {
  SPL.length = 0;
  const victims = sim.grid.query(x, y, radius, SPL);
  for (let i = 0; i < victims.length; i++) {
    const e = victims[i];
    if (!e.dead && isEligible(e, p.spec)) sim._hit(e, p.owner, p.spec, scale);
  }
  SPL.length = 0;
  sim._emit('explode', { x, y, radius, element: p.spec.element || null, attackType: p.spec.attackType });
}

/** The bolt stands on its mirror (wx, wy): bounce (§2) and, after the last, find its enemy. */
function bounce(sim, p, wx, wy) {
  const fx = p.lx;
  const fy = p.ly;
  p.lx = wx;
  p.ly = wy;
  p.bounce++;
  p.ri++;
  const own = p.refill > 0;
  const mt = own ? p.owner : sim.getTower(p.mirrorOf);
  const relay = mt?.stats?.relay;
  if (own) {
    // a new leg: her bolt may strike again what it struck on the last one (each enemy once a leg)
    p.hits.length = 0;
    p.pierce = p.refill;
    const mul = relay ? relay.bounceMul : 0;
    if (mul > 0) p.scale = 1 + mul * p.bounce;
  }
  const slot = p.firstSlot != null && mt?.mirrors ? (p.firstSlot + p.bounce - 1) % mt.mirrors.length : -1;
  sim._emit('mirrorBounce', { uid: p.uid, towerUid: p.mirrorOf, ownerUid: p.ownerUid, mirror: slot, n: p.bounce, x: wx, y: wy, fx, fy });
  if (own && relay) {
    if (relay.bounceSplash > 0) splashAt(sim, p, wx, wy, relay.bounceSplash, p.scale ?? 1);
    if (relay.shards > 0) throwShards(sim, p, wx, wy, relay.shards);
  }
  if (p.ri * 2 < p.route.length) {
    aimAt(p, p.route[p.ri * 2], p.route[p.ri * 2 + 1]);
    return;
  }
  finish(sim, p, wx, wy);
}

/** Its route done: the bolt takes its enemy near the last mirror (else near her), or ends there. */
function finish(sim, p, x, y) {
  p.route = null;
  p.splash = p.fsplash;
  const spec = p.spec;
  const reach = spec.range > 0 ? spec.range : SEEK;
  const mode = p.owner.targetMode || 'first';
  let tgt = pick(sim, p, x, y, reach, mode);
  if (!tgt && p.refill > 0) tgt = pick(sim, p, p.owner.x, p.owner.y, reach, mode);
  if (!tgt && p.avoid && !p.avoid.dead && isEligible(p.avoid, spec) && !p.hits.includes(p.avoid.uid)) tgt = p.avoid;
  if (!tgt) {
    p.dead = true;
    return;
  }
  p.target = tgt;
  p.tx = tgt.x;
  p.ty = tgt.y;
  p.targetAlt = tgt.alt || 0;
  p.travel = 0;
  p.maxTravel = reach * 1.4 + 2;
  aimAt(p, tgt.x, tgt.y);
}

/** The best enemy within `reach` of (x, y) by `mode` that the bolt has not hit (and not its avoided one). */
function pick(sim, p, x, y, reach, mode) {
  const cand = selectTargetsInto(sim, x, y, reach, p.spec, mode, 3, PICK);
  let out = null;
  for (let i = 0; i < cand.length; i++) {
    const e = cand[i];
    if (e !== p.avoid && !p.hits.includes(e.uid)) {
      out = e;
      break;
    }
  }
  PICK.length = 0;
  return out;
}

/** Kaleidoscope (§4): `n` shards from the mirror at other enemies in her range of it (SHARD_BUDGET a step). */
function throwShards(sim, p, x, y, n) {
  if (shardsLeft <= 0) return;
  const t = p.owner;
  const spec = p.spec;
  const cand = selectTargets(sim, x, y, spec.range, spec, t.targetMode || 'first', n + 2);
  let thrown = 0;
  for (let i = 0; i < cand.length && thrown < n && shardsLeft > 0; i++) {
    const e = cand[i];
    if (p.hits.includes(e.uid)) continue;
    const c = spawnProjectile(sim, t, spec, e, x, y, { pierce: 1, splash: 0 });
    c.split = true;
    c.shard = true;
    if (p.scale) c.scale = p.scale;
    thrown++;
    shardsLeft--;
  }
}

// ---------------------------------------------------------------------------
// Allies' shots
// ---------------------------------------------------------------------------

/**
 * Gathers the mirrors that reflect this step (updateProjectiles, once a step, while some girl has an ability).
 * @returns {number} how many (0: no projectile is tested)
 */
export function collectMirrors(sim) {
  MIR.length = 0;
  MIR_T.length = 0;
  const list = sim.towers;
  for (let i = 0; i < list.length && MIR.length < MIRROR_GATHER * 4; i++) {
    const t = list[i];
    if (!mirrorsReflect(t)) continue;
    const ms = t.mirrors;
    for (let k = 0; k < ms.length && MIR.length < MIRROR_GATHER * 4; k++) {
      MIR.push(ms[k].x, ms[k].y, t.uid, k);
      MIR_T.push(t);
    }
  }
  return MIR.length / 4;
}

/**
 * After a projectile's step from (ax, ay) to (p.x, p.y): the first gathered mirror its segment passes within
 * MIRROR_RADIUS of splits it (see the header). `n` is collectMirrors' count.
 */
export function reflectStep(sim, p, ax, ay, n) {
  const dx = p.x - ax;
  const dy = p.y - ay;
  const len2 = dx * dx + dy * dy;
  const lox = (ax < p.x ? ax : p.x) - MIRROR_RADIUS;
  const hix = (ax < p.x ? p.x : ax) + MIRROR_RADIUS;
  const loy = (ay < p.y ? ay : p.y) - MIRROR_RADIUS;
  const hiy = (ay < p.y ? p.y : ay) + MIRROR_RADIUS;
  for (let i = 0; i < n; i++) {
    const mx = MIR[i * 4];
    const my = MIR[i * 4 + 1];
    if (mx < lox || mx > hix || my < loy || my > hiy) continue;
    let f = len2 > 0 ? ((mx - ax) * dx + (my - ay) * dy) / len2 : 0;
    f = f < 0 ? 0 : f > 1 ? 1 : f;
    const cx = ax + dx * f;
    const cy = ay + dy * f;
    const ex = cx - mx;
    const ey = cy - my;
    // (a mirror reflects allies' shots, never its owner's: hers are born split anyway)
    if (ex * ex + ey * ey > R2 || p.ownerUid === MIR[i * 4 + 2]) continue;
    splitShot(sim, p, cx, cy, MIR_T[i], MIR[i * 4 + 3]);
    return;
  }
}

/** The fallback search radius for a copy's next target when the shot's spec carries no range. */
const SEEK = 3;

/** Splits `p` at (cx, cy) on mirror `slot` of `mt` (the header's rule). @returns the copy or null */
function splitShot(sim, p, cx, cy, mt, slot) {
  p.split = true;
  const spec = p.spec;
  const reach = spec.range > 0 ? spec.range : SEEK;
  const ms = mt.mirrors;
  let b = mt.stats.relay.allyBounces | 0;
  if (b > ALLY_BOUNCE_CAP) b = ALLY_BOUNCE_CAP;
  if (b > ms.length - 1) b = ms.length - 1;
  const routed = b > 0 && !p.guided && !p.ret;
  const o = p.target && !p.target.dead ? p.target : null;
  let tgt = null;
  let spread = 0;
  if (!routed) {
    // today's rule: a copy straight from the crossing point at the next target, else the same one fanned
    const mode = p.owner.targetMode || 'first';
    const cand = selectTargets(sim, cx, cy, reach, spec, mode, 2);
    for (let i = 0; i < cand.length; i++) {
      const e = cand[i];
      if (e !== p.target && !p.hits.includes(e.uid)) {
        tgt = e;
        break;
      }
    }
    if (!tgt) {
      if (!o) return null;
      tgt = o;
      spread = p.uid & 1 ? -SPLIT_FAN : SPLIT_FAN;
    }
  } else {
    // (its first aim is the next mirror; spawnProjectile wants an enemy-like point)
    tgt = o || { x: ms[(slot + 1) % ms.length].x, y: ms[(slot + 1) % ms.length].y, alt: 0 };
  }
  const c = spawnProjectile(sim, p.owner, spec, tgt, cx, cy, {
    kind: p.kind, speed: p.speed, pierce: p.pierce, splash: p.splash, range: reach, spread,
    guided: p.guided, drone: p.drone, turretUid: p.turretUid,
  });
  c.split = true;
  for (let i = 0; i < p.hits.length; i++) c.hits.push(p.hits[i]);
  if (routed) {
    const route = [];
    for (let j = 1; j <= b; j++) {
      const s = ms[(slot + j) % ms.length];
      route.push(s.x, s.y);
    }
    c.target = null;
    c.avoid = o;
    c.mirrorOf = mt.uid;
    c.firstSlot = (slot + 1) % ms.length;
    setRoute(c, route, false);
  }
  sim._emit('mirrorSplit', { uid: p.uid, copyUid: c.uid, ownerUid: p.ownerUid, mirrorUid: mt.uid, mirror: slot, x: cx, y: cy, targetUid: routed ? null : tgt.uid });
  return c;
}

// ---------------------------------------------------------------------------
// ⚡ Laser Web (src/sim/abilities.js DEPLOYS.mirror)
// ---------------------------------------------------------------------------

/** Is an eligible enemy within her range of one of her mirrors (or of her)? */
function anyNearMirror(sim, t) {
  const spec = t.eff;
  const ms = t.mirrors || [];
  if (selectTargets(sim, t.x, t.y, spec.range, spec, 'first', 1).length) return true;
  for (let k = 0; k < ms.length; k++) if (selectTargets(sim, ms[k].x, ms[k].y, spec.range, spec, 'first', 1).length) return true;
  return false;
}

/**
 * Laser Web's cast: refused (null) with no mirror of hers or no enemy in her range of one; her mirrors stay put
 * (an aim is ignored). The window is her t.abil.active (castAbility sets it from the duration).
 * @returns {{ x, y, radius, targets: [], placed: number, mirror: 'web' }|null}
 */
export function laserWeb(sim, t) {
  if (!isMirrorGirl(t) || !t.mirrors?.length || !anyNearMirror(sim, t)) return null;
  const ms = t.mirrors;
  return { x: t.x, y: t.y, radius: t.stats.relay.reach, targets: [], placed: ms.length, mirror: 'web', beams: (ms.length * (ms.length - 1)) / 2 };
}

/**
 * The webs this step (updateProjectiles, while some girl has an ability): every WEB_TICK steps of her window, each
 * beam hits what crosses it (the header's rule).
 */
export function updateWebs(sim) {
  const list = sim.towers;
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    if (!t.abil || !(t.abil.active > 0) || t.abil.active % WEB_TICK !== 0) continue;
    const def = mirrorDef(t);
    if (!def || !def.effect.web || !t.mirrors) continue;
    webHits(sim, t, def.effect.dmgMul ?? 1);
  }
}

function webHits(sim, t, mul) {
  const ms = t.mirrors;
  const spec = t.eff;
  for (let a = 0; a < ms.length; a++) {
    for (let b = a + 1; b < ms.length; b++) {
      if (webLeft <= 0) return;
      const ax = ms[a].x;
      const ay = ms[a].y;
      const bx = ms[b].x;
      const by = ms[b].y;
      const hx = bx - ax;
      const hy = by - ay;
      const half = Math.sqrt(hx * hx + hy * hy) / 2;
      NEAR.length = 0;
      const near = sim.grid.query((ax + bx) / 2, (ay + by) / 2, half + WEB_HALF + 0.9, NEAR);
      for (let i = 0; i < near.length && webLeft > 0; i++) {
        const e = near[i];
        if (e.dead || !isEligible(e, spec)) continue;
        const r = WEB_HALF + hitRadius(e);
        if (segDistSq(e.x, e.y, ax, ay, bx, by) > r * r) continue;
        sim._hit(e, t, spec, mul);
        webLeft--;
      }
      NEAR.length = 0;
    }
  }
}
