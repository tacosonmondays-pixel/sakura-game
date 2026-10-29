// Iroha's mirror reflection (ABILITIES_SPEC §5.2 Mirror Shift and Infinite Reflection; UNIT_GAPS §4.1, D7): her
// ⚡ Mirror Hall ability, deploy type 'mirror' (src/sim/abilities.js DEPLOYS.mirror), and the reflection it opens.
//
//   - The cast: her mirror panel (her relay origin t.ox / t.oy, which she also fires from: base kit) jumps at once to
//     the cast's aim point; with none (an un-aimed tap, an auto-cast) it stays on the spot her player placed it (t.aim),
//     and only with neither does it jump to the road spot nearest the leader within her mirror's reach. The point is
//     quantised and clamped exactly as Sim.setAim clamps a mirror aim, and it becomes her aim (t.aim), so the panel
//     stays there after the window. For `duration` (8 s, her t.abil.active) the panel reflects.
//   - Tier 5 (Infinite Reflection, `permanentReflect`): the panel reflects for good (no window needed; derived from her
//     tier, so nothing is stored), and the cast (`count` 2) leaves the panel where it stands and adds a second mirror
//     (t.mirror2 { x, y }) at the cast's aim, else the leader's road spot, for its duration (10 s). The second mirror
//     reflects; she does not fire from it.
//   - Reflection: an ally's projectile (both players' girls in co-op: every projectile in sim.projectiles is a girl's, a
//     drone's or a sentry's; never the mirror owner's own, and never a shot fired FROM a mirror panel: a panel volley is
//     born `split` (src/sim/towers.js attackProjectile), so two panels on one spot cannot double each other; a shot from
//     where a girl stands, another Iroha's included, still splits at another owner's mirror) whose step segment passes
//     within MIRROR_RADIUS of a reflecting mirror
//     splits in two, once: the original flies on unchanged and a copy leaves the crossing point (the segment's point
//     nearest the mirror) at the next target, the best enemy within the shot's range of that point by the shooter's
//     target mode that is neither the original's target nor already hit by it; with none, at the original's target
//     fanned SPLIT_FAN to one side (the side by uid parity). With no live target at all nothing is copied. A split
//     projectile and every copy carry `split: true`, so neither ever splits again (two mirrors included). A copy is
//     the same shot: the shooter's spec, kind, speed, remaining pierce, splash, guided / drone / sentry credit and the
//     enemies the original already hit, so its damage credits the original's owner (and drone).
//   - A projectile that ends its step dead (it hit, burst or ran out) does not split that step.
//
// Determinism: towers in placement order, a mirror girl's panel before her second mirror, the first mirror crossed in
// that order wins; squared distances, + − × ÷ and Math.sqrt only (the copy's heading is spawnProjectile's, the same
// math every shot uses). Cost: the reflecting mirrors are gathered once a step into a module scratch (only while some
// girl has an ability: sim._abilOn); a projectile that already split, or a step with no reflecting mirror, costs one
// check. Nothing here is state: t.mirror2 and the projectiles' `split` marks live in the sim (snapshots store them).

import { spawnProjectile, selectTargets, topTargets, updateRelayOrigin } from './towers.js';
import { abilityDef, abilitySpec } from './abilities.js';
import { MIRROR_RADIUS, SPLIT_FAN, AIM_QUANT } from './constants.js';

const R2 = MIRROR_RADIUS * MIRROR_RADIUS;
/** The reflecting mirrors this step: flat [x, y, towerUid] triples (module scratch, refilled every step). */
const MIR = [];

/** Is this girl's ability Iroha's mirror deploy (her merged def), and her panel kind a mirror? */
function mirrorDef(t) {
  if (!t.abil || t.removed || t.stats?.relay?.kind !== 'mirror') return null;
  const def = abilityDef(t);
  return def && def.kind === 'deploy' && def.effect?.deploy === 'mirror' ? def : null;
}

/** Does her panel reflect now (the window her cast opened, or Infinite Reflection for good)? */
export function panelReflects(t) {
  const def = mirrorDef(t);
  return !!def && !!t.origin && (t.abil.active > 0 || !!def.effect.permanentReflect);
}

/**
 * Gathers the mirrors that reflect this step (updateProjectiles, once a step).
 * @returns {number} how many (0: no projectile is tested)
 */
export function collectMirrors(sim) {
  MIR.length = 0;
  const list = sim.towers;
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    const def = mirrorDef(t);
    if (!def) continue;
    const open = t.abil.active > 0;
    if (t.origin && (open || def.effect.permanentReflect)) MIR.push(t.ox, t.oy, t.uid);
    if (open && t.mirror2) MIR.push(t.mirror2.x, t.mirror2.y, t.uid);
  }
  return MIR.length / 3;
}

/**
 * After a projectile's step from (ax, ay) to (p.x, p.y): the first gathered mirror its segment passes within
 * MIRROR_RADIUS of splits it (see the header). `n` is collectMirrors' count.
 */
export function reflectStep(sim, p, ax, ay, n) {
  const dx = p.x - ax;
  const dy = p.y - ay;
  const len2 = dx * dx + dy * dy;
  for (let i = 0; i < n; i++) {
    const mx = MIR[i * 3];
    const my = MIR[i * 3 + 1];
    let f = len2 > 0 ? ((mx - ax) * dx + (my - ay) * dy) / len2 : 0;
    f = f < 0 ? 0 : f > 1 ? 1 : f;
    const cx = ax + dx * f;
    const cy = ay + dy * f;
    const ex = cx - mx;
    const ey = cy - my;
    // (a mirror reflects allies' shots, never its owner's: her own stay unmarked, free to split at another's mirror)
    if (ex * ex + ey * ey > R2 || p.ownerUid === MIR[i * 3 + 2]) continue;
    splitShot(sim, p, cx, cy, MIR[i * 3 + 2]);
    return;
  }
}

/** The fallback search radius for a copy's next target when the shot's spec carries no range. */
const SEEK = 3;

/** Splits `p` at (cx, cy): marks it and sends the copy (the header's rule). @returns the copy or null */
function splitShot(sim, p, cx, cy, mirrorUid) {
  p.split = true;
  const spec = p.spec;
  const reach = spec.range > 0 ? spec.range : SEEK;
  const mode = p.owner.targetMode || 'first';
  const cand = selectTargets(sim, cx, cy, reach, spec, mode, 2);
  let tgt = null;
  for (let i = 0; i < cand.length; i++) {
    const e = cand[i];
    if (e !== p.target && !p.hits.includes(e.uid)) {
      tgt = e;
      break;
    }
  }
  let spread = 0;
  if (!tgt) {
    const o = p.target;
    if (!o || o.dead) return null;
    tgt = o;
    spread = p.uid & 1 ? -SPLIT_FAN : SPLIT_FAN;
  }
  const c = spawnProjectile(sim, p.owner, spec, tgt, cx, cy, {
    kind: p.kind, speed: p.speed, pierce: p.pierce, splash: p.splash, range: reach, spread,
    guided: p.guided, drone: p.drone, turretUid: p.turretUid,
  });
  c.split = true;
  for (let i = 0; i < p.hits.length; i++) c.hits.push(p.hits[i]);
  sim._emit('mirrorSplit', { uid: p.uid, copyUid: c.uid, ownerUid: p.ownerUid, mirrorUid, x: cx, y: cy, targetUid: tgt.uid });
  return c;
}

// ---------------------------------------------------------------------------
// The cast (src/sim/abilities.js DEPLOYS.mirror)
// ---------------------------------------------------------------------------

/** A mirror point for her: quantised to the co-op grid, clamped into the map and to her mirror's reach (Sim.setAim's clamp). */
function mirrorPoint(sim, t, x, y) {
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

/** The visible road sample nearest (x, y) (her relay samples; ties: the earlier sample), or null. */
function roadNear(sim, x, y) {
  const s = sim._relaySamples;
  let best = null;
  let bestD2 = Infinity;
  for (let i = 0; i < (s ? s.length : 0); i++) {
    const dx = s[i].x - x;
    const dy = s[i].y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = s[i];
    }
  }
  return best;
}

/**
 * Mirror Shift: where the mirror goes (the cast's aim; else, for the panel, the spot her player placed it, t.aim; else
 * the road spot nearest the leader within her mirror's reach; refused with none), then the panel jumps there (base) or
 * a second mirror stands there (tier 5, count ≥ 2).
 * The window is her t.abil.active (castAbility sets it from the duration).
 * @returns {{ x, y, radius, targets: [], placed: 1, mirror: 'panel'|'second' }|null}
 */
export function mirrorShift(sim, t, def, aim) {
  const relay = t.stats?.relay;
  if (!relay || relay.kind !== 'mirror') return null;
  const second = (def.effect.count || 1) >= 2;
  let want = aim ? { x: aim[0], y: aim[1] } : null;
  // an un-aimed cast (an auto-cast) never moves a panel her player placed: it opens the window where it stands
  if (!want && !second && t.aim) return { x: t.aim.x, y: t.aim.y, radius: relay.reach, targets: [], placed: 1, mirror: 'panel' };
  if (!want) {
    const lead = topTargets(sim, t.x, t.y, relay.reach, abilitySpec(t, def), 'first', 1, [], [])[0] || null;
    if (!lead) return null;
    const road = roadNear(sim, lead.x, lead.y);
    want = road ? { x: road.x, y: road.y } : { x: lead.x, y: lead.y };
  }
  const p = mirrorPoint(sim, t, want.x, want.y);
  if (second) t.mirror2 = p;
  else {
    t.aim = p;
    // (it emits 'relay', which the panel's jump draws)
    updateRelayOrigin(sim, t);
    sim._emit('aim', { towerUid: t.uid, x: p.x, y: p.y });
  }
  return { x: p.x, y: p.y, radius: relay.reach, targets: [], placed: 1, mirror: second ? 'second' : 'panel' };
}

/** The window ends (its duration, the wave clear): the second mirror goes. */
export function mirrorShiftEnd(sim, t) {
  if (t.mirror2) t.mirror2 = null;
}
