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
//     A copy is the same shot (spec, kind, speed, pierce, splash, its damage share `scale`, credit, the original's hits). A guided or returning
//     shot splits the old way (its copy fanned from the crossing point, no route). A shot that ends its step dead does
//     not split that step.
//   - ⚡ Laser Web (§5; deploy type 'mirror', src/sim/abilities.js DEPLOYS.mirror): while it runs (her t.abil.active,
//     integer steps) every WEB_TICK steps each pair of her mirrors (i < j) is a beam; an eligible enemy within WEB_HALF
//     (plus its hit radius) of any of her beams takes one web hit that tick (her damage × dmgMul, however many of her
//     beams cross it: on a straight road every beam lies on one line); WEB_HITS_PER_STEP for the whole board.
//
// Determinism: towers in placement order, mirrors by slot, bolts in volley order, beams by pair; + − × ÷, Math.sqrt,
// Math.floor and squared distances only (no rng, no trig; a fanned copy's turn is spawnProjectile's, as every shot).
// State: t.mirrorAim (saved), t.mirrors (derived), the routed bolts' fields in sim.projectiles (calm: the wave clear
// ends them); the budgets are per-step scratch reset at the top of every step (updateProjectiles).

import { spawnProjectile, selectTargets, selectTargetsInto, bestTarget, relayOrigin } from './towers.js';
import { abilityDef } from './abilities.js';
import { isEligible } from './combat.js';
import { segDistSq, projectOnSegment } from './path.js';
import { hitRadius } from './shapes.js';
import { MIRROR_RADIUS, SPLIT_FAN, AIM_QUANT } from './constants.js';

/** A routed bolt's speed (tiles/s) when her spec has none (an instant-hit mirror girl). */
export const MIRROR_BOLT_SPEED = 18;
/**
 * A real bounce glints: the best enemy (her target mode) within her range of that mirror takes this share of the bolt's
 * hit, so every mirror near an enemy strikes it whether or not a leg crosses it (review r3 HIGH-1: a lone boss off the
 * legs got one hit a bolt, half of her old two volleys).
 */
export const GLINT_MUL = 0.8;
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
export const MIRROR_GATHER = 32;
/**
 * A leg shorter than this (tiles) is no real reflection: the bolt passes on (no new leg for its hits, no Polish step, no
 * bounce splash or shards), so mirrors stacked on one spot never multiply a bolt. Her placed mirrors keep this far apart.
 */
export const MIN_LEG = 1;
/**
 * Where Auto puts slot k for her main path (her highest tier; a tie takes the lower path), as a fraction along the road
 * samples in her reach; slot 0 is always the road sample nearest her, where her one panel stood (review r3 HIGH-1), and
 * UP the first sample within her range of her (else the first in reach): the road where the crowd reaches her, so a
 * crowd her ally slows or stuns above her range stays in her coverage and one she slows there stays in her ally's
 * reach (the v0.1.66 audit). Slots 1 and 2 are a quarter and three quarters of the road on every path but
 * Kaleidoscope, whose slot 2 is UP (slot 3 keeps the three quarters); slot 3 is UP elsewhere. A slot never moves when
 * her count grows (a path overtaking another can move them).
 */
export const AUTO_UP = -1;
export const AUTO_FRACS = Object.freeze([
  Object.freeze([null, 0.25, 0.75, AUTO_UP, 0.875]),
  Object.freeze([null, 0.25, 0.75, AUTO_UP, 0.875]),
  Object.freeze([null, 0.25, AUTO_UP, 0.75, 1]),
]);

/** Her main path for Auto: her highest tier, a tie the lower path (0 with none). */
export function autoPath(tiers) {
  let best = 0;
  for (let p = 1; tiers && p < 3; p++) if ((tiers[p] | 0) > (tiers[best] | 0)) best = p;
  return best;
}

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
/** The enemies one Iroha's web has hit this tick (one web hit an enemy a tick, however many beams cross it). */
const WEB_SEEN = new Set();

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

/**
 * A mirror point for her (Sim.setAim for a mirror girl, a placed slot every sync, the 1-tile push): clamped into the map
 * and her mirror reach, then quantised to the co-op grid (1/1024), a grid step toward her at a time while rounding left
 * it outside her reach. So a placed spot is always on the grid and inside her reach, and doing it again changes nothing
 * (review r3 MEDIUM-1: quantising before the clamp left clamped spots off the grid).
 */
export function mirrorPoint(sim, t, x, y) {
  let ax = Math.min(sim.map.width || 0, Math.max(0, x));
  let ay = Math.min(sim.map.height || 0, Math.max(0, y));
  const reach = t.stats.relay.reach;
  const r2 = reach * reach;
  let dx = ax - t.x;
  let dy = ay - t.y;
  const d2 = dx * dx + dy * dy;
  if (d2 > r2) {
    const k = reach / Math.sqrt(d2);
    ax = t.x + dx * k;
    ay = t.y + dy * k;
  }
  ax = Math.round(ax * AIM_QUANT) / AIM_QUANT;
  ay = Math.round(ay * AIM_QUANT) / AIM_QUANT;
  for (let i = 0; i < 4; i++) {
    dx = ax - t.x;
    dy = ay - t.y;
    if (dx * dx + dy * dy <= r2) break;
    if (dx > 0) ax -= 1 / AIM_QUANT;
    else if (dx < 0) ax += 1 / AIM_QUANT;
    if (dy > 0) ay -= 1 / AIM_QUANT;
    else if (dy < 0) ay += 1 / AIM_QUANT;
  }
  return { x: ax, y: ay };
}

/**
 * Restores her placed slots exactly as saved (the battle save's `mr`): each spot only clamped (mirrorPoint, which leaves
 * a saved spot as it is), never pushed apart again, so a layout placed in any order comes back the same.
 */
export function restoreMirrors(sim, t, spots) {
  const m = mirrorCount(t);
  const aims = [];
  for (let k = 0; k < m; k++) {
    const a = spots[k];
    aims.push(Array.isArray(a) && Number.isFinite(a[0]) && Number.isFinite(a[1]) ? mirrorPoint(sim, t, a[0], a[1]) : null);
  }
  t.mirrorAim = aims.some(Boolean) ? aims : null;
}

/**
 * Auto spots for `m` mirrors (pure but for the samples): the visible road samples within her reach, in their order
 * (path, then distance). Slot 0 takes her old panel's spot (towers.js relayOrigin: toward the road sample nearest her,
 * FAMILIAR_STANDOFF short of it, within her reach), where she fights most; slot k ≥ 1 by `fracs` (her main path's
 * AUTO_FRACS row): AUTO_UP the first sample within her own `range` of her, else the first in reach; a fraction f the one
 * at index floor(f × n). Slot k's spot is the same whatever her count, so an upgrade that adds a mirror never moves the
 * others (a range tier can move an UP slot). With none, where she stands.
 * @returns {{ x: number, y: number }[]}
 */
export function autoSpots(samples, x, y, reach, m, range = 0, fracs = AUTO_FRACS[0]) {
  const r2 = reach * reach;
  const g2 = range * range;
  const idx = [];
  let up = -1;
  for (let i = 0; i < (samples ? samples.length : 0); i++) {
    const dx = samples[i].x - x;
    const dy = samples[i].y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    idx.push(i);
    if (up < 0 && d2 <= g2) up = i;
  }
  const out = [];
  for (let k = 0; k < m; k++) {
    if (!idx.length) out.push({ x, y });
    else {
      const f = fracs[k];
      const s = k === 0 ? relayOrigin(samples, x, y, { kind: 'auto', reach })
        : samples[f === AUTO_UP ? (up >= 0 ? up : idx[0]) : idx[Math.min(idx.length - 1, Math.floor(f * idx.length))]];
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
      if (!auto) auto = autoSpots(sim._relaySamples, t.x, t.y, relay.reach, m, t.stats.range, AUTO_FRACS[autoPath(t.tiers)]);
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
 * slot (null / undefined) the mirror nearest the point moves (ties: the lower slot). A point closer than MIN_LEG to
 * another mirror her player placed is pushed out to MIN_LEG from it (along the line from that mirror; from her, if they
 * coincide), then quantised and clamped again (at most three passes). @returns {number} the slot, -1 refused
 */
export function placeMirror(sim, t, x, y, slot) {
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
  let px = x;
  let py = y;
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (let j = 0; j < m; j++) {
      const a = aims[j];
      if (j === k || !a) continue;
      let dx = px - a.x;
      let dy = py - a.y;
      let d2 = dx * dx + dy * dy;
      if (d2 >= MIN_LEG * MIN_LEG) continue;
      if (d2 < 1e-12) {
        dx = px - t.x;
        dy = py - t.y;
        d2 = dx * dx + dy * dy;
        if (d2 < 1e-12) {
          dx = 1;
          dy = 0;
          d2 = 1;
        }
      }
      const d = Math.sqrt(d2);
      const q = mirrorPoint(sim, t, a.x + (dx / d) * MIN_LEG, a.y + (dy / d) * MIN_LEG);
      px = q.x;
      py = q.y;
      moved = true;
    }
    if (!moved) break;
  }
  aims[k] = { x: px, y: py };
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
  p.steps = 0;
  // the enemies its bounce splashes have hit (each one splash a bolt: review r3 HIGH-2)
  p.splashed = [];
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

/**
 * Every eligible enemy within `radius` of (x, y), at the bolt's spec × scale; emits 'explode'. `once` (a bolt's bounce
 * splashes): the uids already splashed by this bolt, skipped and then added (each enemy one bounce splash a bolt, so
 * overlapping splashes along a road of close mirrors never stack).
 */
function splashAt(sim, p, x, y, radius, scale, once = null) {
  SPL.length = 0;
  const victims = sim.grid.query(x, y, radius, SPL);
  for (let i = 0; i < victims.length; i++) {
    const e = victims[i];
    if (e.dead || !isEligible(e, p.spec)) continue;
    if (once) {
      if (once.includes(e.uid)) continue;
      once.push(e.uid);
    }
    sim._hit(e, p.owner, p.spec, scale);
  }
  SPL.length = 0;
  sim._emit('explode', { x, y, radius, element: p.spec.element || null, attackType: p.spec.attackType });
}

/**
 * How far a mirror of hers sees an enemy (her volley's lead, the glint): her range, plus her bounce splash on
 * Kaleidoscope (the glass shatters past the frame: a crowd piled just above her range by an ally's slows is still hers).
 */
export function mirrorReach(t, spec) {
  return spec.range + (t.stats.relay?.bounceSplash || 0);
}

/** A glint's spec by the bolt's spec (one each, made once: nothing is allocated per hit). */
const GLINT_SPECS = new WeakMap();

/**
 * The spec a glint strikes with: the bolt's own without its stun (the slow stays). The glint picks the crowd's head at
 * every mirror, so a stun there held the head at the road's first mirror, out of a downstream ally's reach (the v0.1.66
 * audit: beside a Marumi the crowd stood a tile past her range and her balls had nothing to roll at half the time); her
 * stuns land where her bolts and their splashes strike.
 */
function glintSpec(spec) {
  const st = spec.status;
  if (!st || !st.some((s) => s.type === 'stun')) return spec;
  let c = GLINT_SPECS.get(spec);
  if (!c) {
    c = { ...spec, status: st.filter((s) => s.type !== 'stun') };
    GLINT_SPECS.set(spec, c);
  }
  return c;
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
  // a leg shorter than MIN_LEG (mirrors stacked on one spot) is no reflection: the bolt only passes on
  const lx = wx - fx;
  const ly = wy - fy;
  const full = lx * lx + ly * ly >= MIN_LEG * MIN_LEG;
  // a new leg: the bolt (hers, or an ally's copy) may strike again what it struck on the last one (each enemy once a leg)
  if (full) p.hits.length = 0;
  if (own && full) {
    p.pierce = p.refill;
    p.steps++;
    const mul = relay ? relay.bounceMul : 0;
    if (mul > 0) p.scale = 1 + mul * p.steps;
  }
  const slot = p.firstSlot != null && mt?.mirrors ? (p.firstSlot + p.bounce - 1) % mt.mirrors.length : -1;
  sim._emit('mirrorBounce', { uid: p.uid, towerUid: p.mirrorOf, ownerUid: p.ownerUid, mirror: slot, n: p.bounce, x: wx, y: wy, fx, fy });
  if (own && relay && full) {
    const g = glint(sim, p, wx, wy);
    // (Kaleidoscope's bounce splash shatters round the enemy the glint struck, where the enemies are, not round the
    // empty mirror: a crowd clumped away from her mirrors still takes it. Each enemy one bounce splash a bolt)
    if (relay.bounceSplash > 0) splashAt(sim, p, g ? g.x : wx, g ? g.y : wy, relay.bounceSplash, p.scale ?? 1, p.splashed || (p.splashed = []));
    if (relay.shards > 0) throwShards(sim, p, wx, wy, relay.shards);
  }
  if (p.ri * 2 < p.route.length) {
    aimAt(p, p.route[p.ri * 2], p.route[p.ri * 2 + 1]);
    return;
  }
  finish(sim, p, wx, wy);
}

/**
 * Its route done: the bolt takes its enemy near the last mirror, else (hers) near her, then near each of her mirrors
 * (struck or not), else (an ally's copy) near the point where it crossed her mirror, then the original's target, either
 * of them even if already struck; or it ends.
 */
function finish(sim, p, x, y) {
  p.route = null;
  p.splash = p.fsplash;
  const spec = p.spec;
  const reach = spec.range > 0 ? spec.range : SEEK;
  const mode = p.owner.targetMode || 'first';
  let tgt = pick(sim, p, x, y, reach, mode, true);
  if (!tgt && p.refill > 0) tgt = pick(sim, p, p.owner.x, p.owner.y, reach, mode, true);
  // (hers: an enemy near any of her mirrors, slot order, struck or not: wherever she fights, every bolt lands)
  const ms = p.refill > 0 ? p.owner.mirrors : null;
  for (let k = 0; !tgt && ms && k < ms.length; k++) tgt = pick(sim, p, ms[k].x, ms[k].y, reach, mode, false);
  if (!tgt && p.cx != null) tgt = pick(sim, p, p.cx, p.cy, reach, mode, false);
  if (!tgt && p.avoid && !p.avoid.dead && isEligible(p.avoid, spec)) tgt = p.avoid;
  if (!tgt) {
    p.dead = true;
    return;
  }
  // (struck already on its last leg: it may strike it once more on the final one)
  const i = p.hits.indexOf(tgt.uid);
  if (i >= 0) p.hits.splice(i, 1);
  p.target = tgt;
  p.tx = tgt.x;
  p.ty = tgt.y;
  p.targetAlt = tgt.alt || 0;
  p.travel = 0;
  aimAt(p, tgt.x, tgt.y);
  p.maxTravel = Math.max(reach * 1.4 + 2, p.est + 2);
}

/**
 * The best enemy within `reach` of (x, y) by `mode`; `fresh`: one the bolt has not hit on this leg and not its avoided
 * one (else any).
 */
function pick(sim, p, x, y, reach, mode, fresh) {
  const cand = selectTargetsInto(sim, x, y, reach, p.spec, mode, 3, PICK);
  let out = null;
  for (let i = 0; i < cand.length; i++) {
    const e = cand[i];
    if (!fresh || (e !== p.avoid && !p.hits.includes(e.uid))) {
      out = e;
      break;
    }
  }
  PICK.length = 0;
  return out;
}

/**
 * A real bounce's glint (GLINT_MUL): the best enemy within her range of the mirror takes that share of the bolt's hit.
 * @returns the enemy it struck (the bounce splash's centre) or null
 */
function glint(sim, p, x, y) {
  const spec = p.spec;
  const e = bestTarget(sim, x, y, mirrorReach(p.owner, spec), spec, p.owner.targetMode || 'first');
  if (!e) return null;
  sim._hit(e, p.owner, glintSpec(spec), (p.scale ?? 1) * GLINT_MUL);
  sim._emit('mirrorGlint', { uid: p.uid, towerUid: p.mirrorOf, ownerUid: p.ownerUid, x, y, tx: e.x, ty: e.y, targetUid: e.uid });
  return e;
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

/** A copy's spec by its shot's spec (one each, made once: nothing is allocated per split). */
const COPY_SPECS = new WeakMap();

/**
 * The spec a reflected copy strikes with: the shot's own, without its push (knockback, gather). A copy is the same
 * damage, never a second shove: doubled knockback pinned a crowd at the spawn, out of every girl's reach, beside a Sango
 * whose shells crossed her mirrors (the v0.1.66 audit's ally pairs).
 */
function copySpec(spec) {
  if (!(spec.knockback > 0) && !(spec.gather > 0)) return spec;
  let c = COPY_SPECS.get(spec);
  if (!c) {
    c = { ...spec, knockback: 0, gather: 0 };
    COPY_SPECS.set(spec, c);
  }
  return c;
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
  const c = spawnProjectile(sim, p.owner, copySpec(spec), tgt, cx, cy, {
    kind: p.kind, speed: p.speed, pierce: p.pierce, splash: p.splash, range: reach, spread,
    guided: p.guided, drone: p.drone, turretUid: p.turretUid,
  });
  c.split = true;
  // (a shot that carries a share of a volley, a Blade Cyclone arm or her folded stream, src/sim/wheels.js: the copy
  // carries the same share, so it is the same shot)
  if (p.scale != null) c.scale = p.scale;
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
    // (where it crossed: its last fallback looks for an enemy there)
    c.cx = cx;
    c.cy = cy;
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
    // (offset by her uid: Irohas that cast on one step tick on different steps)
    if (!t.abil || !(t.abil.active > 0) || (t.abil.active + t.uid) % WEB_TICK !== 0) continue;
    const def = mirrorDef(t);
    if (!def || !def.effect.web || !t.mirrors) continue;
    webHits(sim, t, def.effect.dmgMul ?? 1);
  }
}

function webHits(sim, t, mul) {
  const ms = t.mirrors;
  const spec = t.eff;
  WEB_SEEN.clear();
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
        if (e.dead || WEB_SEEN.has(e.uid) || !isEligible(e, spec)) continue;
        const r = WEB_HALF + hitRadius(e);
        if (segDistSq(e.x, e.y, ax, ay, bx, by) > r * r) continue;
        WEB_SEEN.add(e.uid);
        sim._hit(e, t, spec, mul);
        webLeft--;
      }
      NEAR.length = 0;
    }
  }
}
