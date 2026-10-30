// Attack shapes, batch S4 "Links" (docs/specs/ATTACK_SHAPES.md §5.6, §5.10, §7.2):
//   - Homecoming Throw (behaviour 'return'; Fuu's Returning Gale): each counted attack throws round(projectiles ×
//     ret.per) fans, one at each of her targets in turn by target mode (a lone enemy takes them all). A fan is her
//     gust that comes back: its out leg flies at its target like a gust (the projectile's own homing) and on through
//     it to spec.range × ret.reach tiles from her; there it turns (the leg flip: a fresh hit list, a fresh count of
//     cuts) and its way home passes through its target again, if that one still stands, then on to her hand. Each leg
//     cuts each enemy at most once: as many as her shot pierces (her pierce + gear Pierce, as her gusts did) ×
//     ret.mul, then up to ret.pierce more × ret.cut (a cut is a share of her hit: spec.share). The way out is her gust
//     in full (her pushes, slows, statuses, crits); the way home is a clean cut (her damage and crits only, Kanna's
//     quake rings' rule), so her crowd control lands what and when her gusts landed it. A rhythm with a blast (her
//     Turbine Kick) is still her gust volley. She keeps her own attack rate: a throw never waits for the fans in the
//     air (A3 #2: her Potential, gear tricks and drinks count attacks).
//   - Spirit Tether (kit `tether`; Ena's Shared Fate): each counted attack ties her lead target to up to
//     tether.links enemies, each the nearest untied one within tether.reach of the last (squared distances, ties by
//     uid), for tether.dur s. A hit from any girl on a tied enemy is shared through the threads (the hook in
//     Sim._hit, only while a group lives: sim._tetherOn): each other member the share reaches takes tether.share of
//     the hit (a clean copy: the hitter's type chart, tier and air multipliers, critical when the hit was, no roll,
//     statuses, marks or pushes; flat armour and the floor × share), credited to the girl who hit. A shared hit never
//     shares again (sim._sharing). Her own hits are split, not added: the enemy she hits keeps 1 − n × share of it
//     (n: the other members the share reaches), so the threads spread her damage and add only other girls' (her own
//     DPS holds on a crowd and a lone boss). At most TETHER_SHARES_PER_STEP shared hits a step; the rest are dropped.
//     On expiry, with tether.pull, the members ahead of her lead target on its road are pulled back toward it (the
//     gather rule: push lock, never a miniboss or a boss).
//
// State: a fan is a projectile record (src/sim/towers.js spawnProjectile) marked `straight` (her straight-shot caps,
// and it ends at the wave clear: src/sim/rings.js endRingWave) with p.ret { leg, n, full, pierce, mul, cut, aim, home,
// back, reach } (leg, n, full and pierce integers; aim her enemy, home her hand, back the way home's spec, reach a
// shot's own reach); sim.tethers [{ uid, owner, m: [enemies], left, share, pull }] (left an integer of steps) and
// e.tie (the group an enemy is tied in) end at the wave clear (endLinkWave), so calm-point saves and co-op checkpoints
// carry none. sim._tetherOn is the number of living groups.
//
// Determinism (§2.4): a fan flies with the projectile's own homing step (src/sim/towers.js projectileStep, like every
// targeted shot; co-op runs it inside withDetMath), her facing from the shared table (nearestDir; no atan2), squared
// distances, integer step timers, groups in creation order and members in tie order (arrays, never a Map or Set),
// no rng of our own (a share rolls nothing; sim._hit still rolls the hit's own crit).

import { isEligible, computeHit, applyHitResult } from './combat.js';
import { checkPhases, placeOnPath } from './enemies.js';
import { nearestDir, dirAngle } from './dirs.js';
import { straightRoom } from './rings.js';
import {
  STEP, TETHERS_PER_GIRL, TETHERS_PER_SIM, TETHER_SHARES_PER_STEP, PUSH_LOCK, GATHER_MAX, RET_HOME,
} from './constants.js';

// ---------------------------------------------------------------------------
// Homecoming Throw
// ---------------------------------------------------------------------------

/** How many fans one of her throws carries (her projectiles × ret.per, at least one). */
export function fanCount(spec, ret) {
  return Math.max(1, Math.round(spec.projectiles * ret.per));
}

/**
 * The 'return' behaviour (Homecoming Throw). `spec` is her attack spec for this attack (gear tricks applied),
 * `targets` her targets by target mode, best first, `extraPierce` her gear Pierce (more full cuts a leg), `spawn` the
 * targeted shot (src/sim/towers.js spawnProjectile). @returns {boolean} whether she threw
 */
export function attackReturn(sim, t, spec, targets, extraPierce, spawn) {
  const r = t.stats.ret;
  if (!r || !targets.length) return false;
  const n = fanCount(spec, r);
  const travel = spec.range * r.reach;
  // a leg's cuts: her shot's own pierce (and gear Pierce) at × mul, then ret.pierce more at × cut
  const full = Math.max(1, spec.pierce) + extraPierce;
  const pierce = full + Math.max(0, Math.round(r.pierce));
  const k0 = nearestDir(targets[0].x - t.ox, targets[0].y - t.oy);
  t.facing = dirAngle(k0);
  t.targetUid = targets[0].uid;
  straightRoom(sim, t, n);
  const home = { uid: -1, x: t.ox, y: t.oy, alt: 0, dead: false };
  // a cut is a share of her hit (× mul: flat armour, the floor and a shell's count scale with it, as a held tick's do);
  // the way home is a clean cut (two specs a throw): her damage and crits, none of her statuses, marks or pushes (the
  // way out carries them, as her gust did), so her crowd control lands as often as before
  const out = r.mul < 1 ? { ...spec, share: r.mul } : spec;
  const back = { ...out, status: [], procStatus: null, mark: null, silence: 0, reveal: 0, knockback: 0, gather: 0, splash: 0 };
  for (let j = 0; j < n; j++) {
    const e = targets[j % targets.length];
    const p = spawn(sim, t, out, e, t.ox, t.oy, { kind: t.projKind, pierce, splash: 0 });
    p.straight = true;
    // (it turns at `travel`, or later while it still chases an uncut target: up to a gust's own reach, p.maxTravel)
    const reach = p.maxTravel;
    p.maxTravel = travel < reach ? travel : reach;
    p.ret = { leg: 0, n: 0, full, pierce, mul: r.mul, cut: r.cut, aim: e, home, back, reach };
  }
  sim._emit('attack', { towerUid: t.uid, targetUid: targets[0].uid, kind: 'return', k: k0, fans: n });
  return true;
}

/**
 * Before a fan's step (projectileStep): on its way home it flies through its target while that one stands and this leg
 * can still cut, then to her hand; within one step of her hand it is caught (ends). @returns {boolean} true: caught
 */
export function retSteer(sim, p, stepLen) {
  const r = p.ret;
  if (r.leg !== 1) return false;
  if (p.target !== r.home) {
    const a = p.target;
    if (!a || a.dead || r.n >= r.pierce || p.hits.includes(a.uid) || !isEligible(a, p.spec)) p.target = r.home;
  }
  if (p.target === r.home) {
    const dx = r.home.x - p.x;
    const dy = r.home.y - p.y;
    if (dx * dx + dy * dy <= stepLen * stepLen) {
      p.dead = true;
      sim._emit('retCatch', { towerUid: p.ownerUid, uid: p.uid, x: r.home.x, y: r.home.y });
      return true;
    }
  }
  return false;
}

/**
 * A fan meets `e` (projectileStep's contact loop): it cuts while this leg has cuts left, the first `full` enemies of
 * the leg × mul (her shot's pierce), the others × cut. @returns {boolean} whether it cut
 */
export function retCut(sim, p, e) {
  const r = p.ret;
  if (r.n >= r.pierce) return false;
  p.hits.push(e.uid);
  sim._hit(e, p.owner, r.leg === 0 ? p.spec : r.back, r.n < r.full ? r.mul : r.cut);
  r.n++;
  // an out leg with no cuts left flies straight on to its turn
  if (r.leg === 0 && r.n >= r.pierce) p.target = null;
  return true;
}

/**
 * The end of a leg (projectileStep, travel ≥ maxTravel): the out leg turns (a fresh hit list and count, back through
 * its target while that one stands, else straight home; the way home may be up to RET_HOME × as long), unless it still
 * chases its uncut target (then it flies on, up to a gust's reach); a way home that never reached her hand ends.
 * @returns {boolean} true when the fan flies on
 */
export function retFlip(sim, p) {
  const r = p.ret;
  if (r.leg !== 0) return false;
  const a = r.aim;
  const live = a && !a.dead && isEligible(a, p.spec);
  // an out leg still chasing its uncut target flies on, up to a gust's reach
  if (live && p.target === a && r.n < r.pierce && p.travel < r.reach) {
    p.maxTravel = r.reach;
    return true;
  }
  r.leg = 1;
  r.n = 0;
  p.hits.length = 0;
  p.maxTravel = p.travel * RET_HOME + 1;
  p.travel = 0;
  p.target = live ? a : r.home;
  return true;
}

// ---------------------------------------------------------------------------
// Spirit Tether
// ---------------------------------------------------------------------------

const NEAR = [];

/** The nearest untied eligible enemy within `reach` of (cx, cy), not in `m` (d², then uid). */
function nextLink(sim, cx, cy, reach, spec, m) {
  NEAR.length = 0;
  sim.grid.query(cx, cy, reach, NEAR);
  let best = null;
  let bestD = Infinity;
  const r2 = reach * reach;
  for (let i = 0; i < NEAR.length; i++) {
    const e = NEAR[i];
    if (e.tie || !isEligible(e, spec) || m.includes(e)) continue;
    const dx = e.x - cx;
    const dy = e.y - cy;
    const d = dx * dx + dy * dy;
    if (d > r2) continue;
    if (d < bestD || (d === bestD && e.uid < best.uid)) {
      bestD = d;
      best = e;
    }
  }
  NEAR.length = 0;
  return best;
}

/** Ends group g: its members are untied. */
function untie(g) {
  for (let i = 0; i < g.m.length; i++) if (g.m[i].tie === g) g.m[i].tie = null;
  g.left = 0;
}

/**
 * Her counted attack ties `e` (her lead target): a tied enemy of hers is held again for the full time; an untied one
 * starts a group with up to tether.links links (none found: no group). Her oldest group goes first at her cap, the
 * sim's cap ties no new one.
 */
export function tieTether(sim, t, e) {
  const tc = t.stats.tether;
  if (!tc || !e || e.dead) return;
  const dur = Math.max(1, Math.round(tc.dur / STEP));
  if (e.tie) {
    if (e.tie.owner === t) e.tie.left = dur;
    return;
  }
  const spec = t.eff;
  const m = [e];
  let cur = e;
  for (let i = 0; i < tc.links; i++) {
    const nx = nextLink(sim, cur.x, cur.y, tc.reach, spec, m);
    if (!nx) break;
    m.push(nx);
    cur = nx;
  }
  if (m.length < 2) return;
  const list = sim.tethers;
  let mine = 0;
  for (let i = 0; i < list.length; i++) if (list[i].owner === t) mine++;
  if (mine >= TETHERS_PER_GIRL) {
    for (let i = 0; i < list.length; i++) {
      if (list[i].owner === t) {
        untie(list[i]);
        list.splice(i, 1);
        break;
      }
    }
  }
  if (list.length >= TETHERS_PER_SIM) {
    sim._tetherOn = list.length;
    return;
  }
  const g = { uid: sim._nextUid(), owner: t, m, left: dur, share: tc.share, pull: tc.pull };
  // the first group after none: a full budget (tetherStep refills it only while a group lives)
  if (!list.length) sim._shareBudget = TETHER_SHARES_PER_STEP;
  for (let i = 0; i < m.length; i++) m[i].tie = g;
  list.push(g);
  sim._tetherOn = list.length;
  const uids = [];
  for (let i = 0; i < m.length; i++) uids.push(m[i].uid);
  sim._emit('tether', { towerUid: t.uid, uid: g.uid, members: uids, left: dur });
}

/** Can a share of an `attackType` hit reach q? (isEligible for a spec that reaches flyers and veils.) */
function shareable(q, attackType) {
  return !q.dead && !q.hidden && !(q.phasing && attackType !== 'holy' && attackType !== 'mystic');
}

/** Members of g other than e that a share of an `attackType` hit reaches. */
function others(g, e, attackType) {
  let n = 0;
  for (let i = 0; i < g.m.length; i++) if (g.m[i] !== e && shareable(g.m[i], attackType)) n++;
  return n;
}

/**
 * Sim._hit's scale for a tether girl's own hit on a tied enemy (any tether girl's, in any girl's group: a second Ena's
 * hits on the first one's threads are split too, never added): it keeps 1 − n × share, the rest goes down the threads
 * (n: the other members the share reaches, at most the shares this step's budget still runs, so a dropped share is
 * never cut from her hit). 1 for a girl without a tether.
 */
export function ownShare(sim, g, e, tower, spec) {
  if (g.owner !== tower && !tower?.stats?.tether) return 1;
  let n = others(g, e, spec.attackType);
  if (n > sim._shareBudget) n = sim._shareBudget > 0 ? sim._shareBudget : 0;
  const k = 1 - n * g.share;
  return k > 0 ? k : 0;
}

// a share's spec: a clean copy of the hit's damage fields, filled before each shared hit (no allocation)
const SHARE = {
  damage: 0, attackType: null, element: null, typeFloor: 0, classMul: null, eliteMul: 1, bossMul: 1, airMul: 1, barrierMul: 1,
  armorPen: 0, critChance: 0, critMul: 1, share: 1, hpPct: null, canHitAir: true, detection: true,
};
const NO_ROLL = 0;
const SHARE_OUT = {};

/**
 * The share of one hit (Sim._hit, after it landed on `e`, tied in g): each other living member, in tie order, takes
 * a clean copy of it at `scale` × share (the hit's scale before her own split; a critical hit's shares are critical
 * too, with no roll of their own), credited to `tower`. Never shares again (sim._sharing). At most sim._shareBudget
 * shared hits this step.
 */
export function shareTether(sim, g, e, tower, spec, scale, crit, drone) {
  if (g.left <= 0 || g.m.length < 2) return;
  sim._sharing = true;
  const S = SHARE;
  S.damage = spec.damage || 0;
  S.attackType = spec.attackType;
  S.element = spec.element || null;
  S.typeFloor = spec.typeFloor || 0;
  S.classMul = spec.classMul || null;
  S.eliteMul = spec.eliteMul ?? 1;
  S.bossMul = spec.bossMul ?? 1;
  S.airMul = spec.airMul ?? 1;
  S.barrierMul = spec.barrierMul ?? 1;
  S.armorPen = spec.armorPen || 0;
  S.critChance = crit ? 1 : 0;
  S.critMul = spec.critMul || 1.5;
  // a share of a fractional hit (a fan's cut, a held tick, a lash) is that fraction of the thread's share: flat armour,
  // the floor and a crystal shell's cap and count scale with both
  S.share = (spec.share > 0 ? spec.share : 1) * g.share;
  const sc = scale * g.share;
  let n = 0;
  for (let i = 0; i < g.m.length; i++) {
    const q = g.m[i];
    if (q === e || !shareable(q, S.attackType)) continue;
    if (sim._shareBudget <= 0) break;
    sim._shareBudget--;
    const res = computeHit(q, S, NO_ROLL, sc, SHARE_OUT);
    if (!res) continue;
    const hpBefore = q.hp;
    applyHitResult(q, res, S.share);
    const dealt = Math.min(res.toHp, Math.max(0, hpBefore)) + res.toBarrier;
    q.flash = 1;
    q.lastDamageAt = sim.time;
    sim._emit('hit', { type: 'hit', uid: q.uid, x: q.x, y: q.y, amount: res.toHp + res.toBarrier, crit: res.crit, attackType: S.attackType, effective: res.effective, tick: true });
    sim._credit(tower, dealt, q, drone);
    sim.stats.damageByType[S.attackType] = (sim.stats.damageByType[S.attackType] || 0) + dealt;
    n++;
    if (q.hp <= 0) sim._killEnemy(q, tower, drone);
    else checkPhases(sim, q);
  }
  if (n) sim._emit('tetherShare', { uid: g.uid, from: e.uid, n });
  sim._sharing = false;
}

/** Group g ends: with pull, the living walkers ahead of its lead on the lead's road are pulled back toward it. */
function endGroup(sim, g) {
  const lead = g.m[0];
  if (g.pull > 0 && !lead.dead) {
    const f = g.pull < GATHER_MAX ? g.pull : GATHER_MAX;
    const path = sim.pathData[lead.pathIndex];
    let moved = 0;
    for (let i = 1; i < g.m.length; i++) {
      const q = g.m[i];
      if (q.dead || q.hidden || q.pathIndex !== lead.pathIndex || q.tier === 'miniboss' || q.tier === 'boss') continue;
      if (q.dist <= lead.dist || q.pushLock > 0) continue;
      q.dist -= (q.dist - lead.dist) * f;
      placeOnPath(q, path);
      q.pushLock = PUSH_LOCK[q.tier] ?? PUSH_LOCK.normal;
      moved++;
    }
    if (moved) sim._emit('tetherPull', { uid: g.uid, towerUid: g.owner.uid, n: moved });
  }
  untie(g);
}

/**
 * Every sim step while a group lives (Sim._step1): the share budget refills, each group ages a step; a group whose
 * time is up ends (its pull), a sold girl's at once.
 */
export function tetherStep(sim) {
  sim._shareBudget = TETHER_SHARES_PER_STEP;
  const list = sim.tethers;
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    const g = list[i];
    if (g.owner.removed) {
      untie(g);
      continue;
    }
    g.left--;
    if (g.left <= 0) {
      endGroup(sim, g);
      continue;
    }
    list[n++] = g;
  }
  list.length = n;
  sim._tetherOn = n;
}

/** Wave clear (Sim._checkWaveEnd): every group ends (no pull); straight shots end in endRingWave. */
export function endLinkWave(sim) {
  const list = sim.tethers;
  if (!list || !list.length) return;
  for (let i = 0; i < list.length; i++) untie(list[i]);
  list.length = 0;
  sim._tetherOn = 0;
}

/**
 * Her paper DPS on one target with a Homecoming Throw, from `perTarget` (damage × rate × projectiles): her fans, each
 * cutting a lone enemy once each way × ret.mul. Unchanged otherwise.
 */
export function linkDps(t, e, perTarget) {
  const r = t.stats.ret;
  if (e.behavior !== 'return' || !r) return perTarget;
  return e.damage * e.rate * fanCount(e, r) * 2 * r.mul;
}
