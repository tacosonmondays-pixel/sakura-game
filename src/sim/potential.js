// Potential's battle mechanics (docs/specs/POTENTIAL.md, v3 §6: the v2 mechanics N1–N12 plus N13–N17). The
// steps themselves are data (src/data/potential.js); src/sim/mods.js folds them into a girl's stats
// and every key below is ABSENT at P1, so a girl without a duplicate runs the exact code path she
// always did. Deterministic: integer counters, timers on the fixed step, ascending uid for neighbour
// picks, squared distances, no new random draw (crits on extra hits and chance statuses already in
// her kit roll through sim.rng, as every hit does).
//
//   N1  girl.dotMul          her burn / poison numbers × m (mods.js potentialTail)
//   N2  statusAdd            adds onto a status she has, else appends (mods.js addStatuses)
//   N3  proc                 the rhythm: every Nth successful attack uses t.effProc (towers.js
//                            attackWithProc; traps: updateTraps), plus its extras: procStatus (sure
//                            statuses after her own, Sim._onHitEffects), echo, nova, auraBoost
//   N4  ult                  a hero's ultimate after her ranks (ultEffect / ultCooldown, hero.js)
//   N5  aura.rangeAdd        her aura's reach after every max rule (mods.js)
//   N6  aura.foeVuln         enemies inside her aura are Brittle, never refreshing a stronger one (applyFoeVuln)
//   N7  bountyAura           kills inside her range pay more (bountyMulAt)
//   N8  harvest              every Nth wave clear pays her wave income again (Sim._checkWaveEnd)
//   N9  dotSpread            her burn leaps from a fallen enemy to the nearest one (spreadDot)
//   N10 keepRamp             a duelist keeps part of her focus when her target falls, not when it leaks (towers.js attackDuel)
//   N11 turret.overclock     her own drones fire faster for a while, on a fixed timer (towers.js)
//   N12 brew / link targetsAdd one more girl (mods.js; brews never above BREW_TARGETS_MAX)
//   N13 projScale            more projectiles per attack through an integer carry (towers.js)
//   N14 tempo                faster the longer she keeps attacking (towers.js)
//   N15 echo share           an echo at a share of the rhythm's damage (t.effEcho; duel: one follow-up strike)
//   N16 classMul             × vs one armour class (combat.js computeHit)
//   N17 bossMul              the live key, one girl only (data test)
import { isEligible } from './combat.js';
import { syncStatusFlags } from './enemies.js';

const isDot = (type) => type === 'burn' || type === 'poison';

/**
 * The rhythm's spec over a base hit spec: damage × damageMul; splash, pierce, maxTargets, range and
 * silence add; DoT numbers in a COPIED status list × dotMul; the rhythm's extra statuses ride as
 * `procStatus` (applied after her own list, so a rhythm freeze is sure while her own chance freeze
 * still rolls).
 */
export function procSpec(base, p) {
  const o = { ...base };
  if (typeof p.damageMul === 'number') o.damage = base.damage * p.damageMul;
  if (p.splash) o.splash = (base.splash || 0) + p.splash;
  if (p.pierce) o.pierce = (base.pierce || 0) + p.pierce;
  if (p.maxTargets) o.maxTargets = (base.maxTargets || 0) + p.maxTargets;
  // (more projectiles on the rhythm's volley: Kogane's Spare Rivets; absent on every other rhythm)
  if (p.projectiles) o.projectiles = (base.projectiles || 1) + p.projectiles;
  if (p.range) o.range = (base.range || 0) + p.range;
  if (p.silence) o.silence = (base.silence || 0) + p.silence;
  if (typeof p.dotMul === 'number' && p.dotMul !== 1 && base.status) {
    o.status = base.status.map((s) => {
      if (!isDot(s.type)) return s;
      const c = { ...s };
      if (typeof c.dps === 'number') c.dps *= p.dotMul;
      if (typeof c.pct === 'number') c.pct *= p.dotMul;
      return c;
    });
  }
  if (p.status && p.status.length) o.procStatus = p.status;
  return o;
}

/**
 * End of refreshEffective (after the buff extras): her rhythm's specs, rebuilt whenever her stats
 * or buffs change. t.effProc (her attack's), t.effEcho (an echo at a share, N15), t.trapSpecProc
 * (a trap rhythm's explosion).
 */
export function buildProcSpecs(t) {
  const p = t.stats.proc;
  if (!p) return;
  if (p.of === 'trap') {
    t.trapSpecProc = t.trapSpec ? procSpec(t.trapSpec, p) : null;
    return;
  }
  t.effProc = procSpec(t.eff, p);
  if (typeof p.echo === 'number' && p.echo > 0 && p.echo < 1) t.effEcho = { ...t.effProc, damage: t.effProc.damage * p.echo };
  else if (t.effEcho) t.effEcho = null;
}

/** Her aura numbers while a rhythm's aura boost runs (recomputeBuffs), else her aura. */
export function boostedAura(a) {
  const au = a.stats.aura;
  const b = a.stats.proc?.auraBoost;
  if (!b || !(a.auraBoostLeft > 0)) return au;
  return { ...au, dmgMul: au.dmgMul * (b.dmgMul ?? 1), rateMul: au.rateMul * (b.rateMul ?? 1) };
}

/**
 * N6, on every buff refresh: each girl with aura.foeVuln > 0 (not sabotaged) makes the eligible
 * enemies inside her aura Brittle { bonus, 0.4 s }, but only an enemy whose current Brittle is
 * missing or no stronger: applyStatus keeps the stronger bonus AND the longer time, so a blind
 * re-apply would keep a stronger Brittle someone else applied alive for ever.
 */
export function applyFoeVuln(sim) {
  for (const t of sim.towers) {
    const au = t.stats?.aura;
    const bonus = au?.foeVuln;
    if (!(bonus > 0) || t.disabled > 0) continue;
    const near = sim.grid.query(t.x, t.y, au.range, []);
    const ctx = sim._statusCtx;
    ctx.element = t.eff?.element || null;
    ctx.attackType = t.eff?.attackType;
    ctx.sourceUid = t.uid;
    const spec = { type: 'vulnerable', bonus, duration: 0.4 };
    for (const e of near) {
      if (e.dead || !isEligible(e, t.eff)) continue;
      const cur = e.statuses.vulnerable;
      if (cur && cur.bonus > bonus) continue;
      sim._applyStatusEvent(e, spec, ctx);
      syncStatusFlags(e);
    }
  }
}

/** N7: the bounty multiplier where an enemy fell: the largest bountyAura covering the spot (1 = none). */
export function bountyMulAt(sim, x, y) {
  let m = 1;
  for (const t of sim.towers) {
    const b = t.stats?.bountyAura;
    if (!(b > m) || t.disabled > 0 || t.removed) continue;
    const r = t.eff?.range ?? t.stats.range;
    const dx = t.x - x;
    const dy = t.y - y;
    if (dx * dx + dy * dy <= r * r) m = b;
  }
  return m;
}

/**
 * N9, as an enemy falls: a burn (or poison) of a girl with dotSpread leaps to the nearest eligible
 * living enemy within `radius` (ties: lower uid) with the same numbers and time left, `depth` leaps
 * at most per chain (the count rides on the status as `spread`). Through applyStatus, so a stronger
 * one already there is kept.
 */
export function spreadDot(sim, e) {
  for (const type of ['burn', 'poison']) {
    const st = e.statuses[type];
    if (!st || st.sourceUid == null) continue;
    const src = sim._towerByUid.get(st.sourceUid);
    const ds = src?.stats?.dotSpread;
    if (!ds || ds.type !== type || src.removed) continue;
    const left = typeof st.spread === 'number' ? st.spread : ds.depth;
    if (!(left > 0) || !(st.left > 0)) continue;
    const r2 = ds.radius * ds.radius;
    let best = null;
    let bestD = Infinity;
    for (const o of sim.grid.query(e.x, e.y, ds.radius, [])) {
      if (o === e || o.dead || !isEligible(o, src.eff)) continue;
      const dx = o.x - e.x;
      const dy = o.y - e.y;
      const d = dx * dx + dy * dy;
      if (d > r2) continue;
      if (d < bestD || (d === bestD && o.uid < best.uid)) {
        best = o;
        bestD = d;
      }
    }
    if (!best) continue;
    const spec = { type, dps: st.dps || 0, duration: st.left };
    if (st.pct > 0) spec.pct = st.pct;
    const ctx = sim._statusCtx;
    ctx.element = type === 'burn' ? 'fire' : null;
    ctx.attackType = st.attackType || src.eff?.attackType;
    ctx.sourceUid = src.uid;
    const r = sim._applyStatusEvent(best, spec, ctx);
    if (r === 'new') best.statuses[type].spread = left - 1;
    if (r) sim._emit('dotSpread', { from: e.uid, to: best.uid, towerUid: src.uid, type });
  }
}

/**
 * N4: a hero's ultimate after her ranks with her Potential `ult` folded in: radius, durations add;
 * Moonfall's haste bonus adds (1.3 → 1.35); damage × damageMul; statuses append; statusAdd adds onto
 * a status the ultimate already has (rank 3's Brittle +15 % → +25 %), else appends.
 */
export function ultWithPotential(effect, u) {
  if (!u) return effect;
  const e = { ...effect };
  if (u.radius) e.radius = (e.radius || 0) + u.radius;
  if (u.length && typeof e.length === 'number') e.length += u.length;
  if (u.duration) e.duration = (e.duration ?? 0) + u.duration;
  if (u.buffDuration) e.buffDuration = (e.buffDuration ?? e.duration ?? 0) + u.buffDuration;
  if (u.rateBuff) {
    const rb = e.rateBuff ?? 0.25;
    e.rateBuff = 1 + (rb > 1 ? rb - 1 : rb) + u.rateBuff;
  }
  if (u.damageMul !== 1 && typeof e.damage === 'number') e.damage *= u.damageMul;
  if (u.status.length || u.statusAdd.length) {
    const list = (e.status || []).map((s) => ({ ...s }));
    for (const s of u.status) list.push({ ...s });
    for (const add of u.statusAdd) {
      const cur = list.find((s) => s.type === add.type);
      if (!cur) {
        list.push({ ...add });
        continue;
      }
      for (const k of ['amount', 'dps', 'pct', 'bonus', 'duration']) if (typeof add[k] === 'number') cur[k] = (cur[k] ?? 0) + add[k];
    }
    e.status = list;
  }
  return e;
}
