// The duo (Kohaku & Tsubaki, docs/specs/DUO_LR.md §1.2, §4 "P-18 twin weapons"): two weapons on one tower.
//
// Tsubaki's star shells are the main behaviour (the mortar, src/sim/towers.js attackMortar). Kohaku's prism
// beam is the PARTNER weapon: its own timer in whole ticks (t.duoCd), ticked after the main weapon in the
// same step (updateTower), firing the beam behaviour with the partner spec (t.beamSpec, built from her
// stats.duo and her buffs in refreshEffective). Generic on purpose: any unit whose stats carry a partner
// spec gets the same timer (Tenka's planned extra attack, GAPS P-13, can share it).
//
// Refraction: t.prismN counts her shells since the last split (an integer, saved in the battle save as `du`).
// Every `every`th shell splits (base 4; Cut Facets 3, Refraction 2, Constellation Lattice 1): the shell lands
// as usual and `shards` shards of light land around it at the fixed table PRISM_SHARDS (no rng, no trig),
// each a share of the shell's hit (mystic, hits flyers, its own small splash and the shard statuses).
// Potential's capstone (fullEvery): every Nth volley (t.duoVolley counts them) splits every shell in it.
//
// Determinism (co-op lockstep): integer counters and tick timers, fixed tables, + − × ÷ and Math.round only.

import { STEP, MORTAR_DELAY, PRISM_SHARDS } from './constants.js';

/** Ticks from one beam to the next at `rate` attacks a second (at least 1). */
export function beamTicks(rate) {
  return Math.max(1, Math.round(1 / (Math.max(0.05, rate) * STEP)));
}

/**
 * Kohaku's beam spec from her stats and the tower's effective spec (refreshEffective calls it after every
 * buff): her damage and speed follow every buff her shells get (as ratios of the effective to the resolved
 * value), her range follows the range buffs and the map rule, and her pierce takes a rally's extra pierce.
 */
export function buildPartnerSpec(t) {
  const s = t.stats;
  const d = s.duo;
  const e = t.eff;
  if (!d) {
    t.beamSpec = null;
    return;
  }
  const dmgK = s.damage > 0 ? e.damage / s.damage : 1;
  const rateK = s.rate > 0 ? e.rate / s.rate : 1;
  const b = t.buff;
  const envMul = t.envRangeMul ?? 1;
  const envAdd = t.envRangeAdd ?? 0;
  const env = envMul !== 1 || envAdd !== 0;
  const range = (env ? Math.max(1, (d.beamRange + envAdd) * envMul) : d.beamRange) * (b?.rangeMul ?? 1) * (t.hydrated?.rangeMul ?? 1);
  t.beamSpec = {
    ...e,
    behavior: 'beam',
    attackType: 'mystic',
    element: null,
    damage: d.beamDmg * d.beamMul * dmgK,
    rate: d.beamRate * rateK,
    range,
    projectiles: d.beams,
    pierce: d.beamPierce + Math.max(0, e.pierce - s.pierce),
    splash: 0,
    chain: 0,
    canHitAir: true,
    armorPen: e.armorPen + d.beamPen,
    airMul: (s.airMul ?? 1) * d.beamAir,
    eliteMul: 1,
    bossMul: 1,
    barrierMul: 1,
    ramp: d.rampMax > 0 ? { per: d.rampPer, max: d.rampMax } : null,
    silence: d.beamSilence,
    status: [],
    knockback: 0,
    gather: 0,
  };
}

/**
 * One step of the partner weapon (after the main weapon; never while she is sabotaged or moving: updateTower
 * returns before both). `fire(sim, t)` is the beam behaviour, called with t.eff swapped to the partner spec.
 * A step with no target keeps the timer at 0 (she fires the moment one comes into reach).
 */
export function partnerTick(sim, t, fire) {
  const spec = t.beamSpec;
  if (!spec) return;
  if (t.duoCd > 0) t.duoCd--;
  if (t.duoCd > 0) return;
  const main = t.eff;
  t.eff = spec;
  let ok = false;
  try {
    ok = fire(sim, t);
  } finally {
    if (t.eff === spec) t.eff = main;
  }
  t.duoCd = ok ? beamTicks(spec.rate) : 0;
}

/** The shard hit spec of one volley: a share of the shell's hit (snap), mystic, hits flyers, the shard statuses. */
function shardSpec(t, snap) {
  const d = t.stats.duo;
  const k = t.stats.damage > 0 ? snap.damage / t.stats.damage : 1;
  const status = [];
  if (d.shardSlow > 0) status.push({ type: 'slow', amount: d.shardSlow, duration: d.slowTime || 1 });
  if (d.shardShred > 0) status.push({ type: 'shred', amount: d.shardShred, duration: 4 });
  if (d.shardVuln > 0) status.push({ type: 'vulnerable', bonus: d.shardVuln, duration: d.vulnTime || 3 });
  return {
    ...snap,
    attackType: 'mystic',
    element: null,
    damage: snap.damage * d.shardShare + d.shardDmg * k,
    canHitAir: true,
    splash: d.shardSplash,
    status,
    knockback: 0,
    gather: 0,
  };
}

/**
 * Before a volley (attackMortar): advances the volley count and says whether this whole volley splits
 * (Potential's capstone). Returns a per-volley context for refract, or null for a unit without a prism.
 */
export function beginVolley(t) {
  const d = t.stats?.duo;
  if (!d || !(d.shards > 0)) return null;
  let full = false;
  if (d.fullEvery > 0) {
    const v = (t.duoVolley || 0) + 1;
    full = v >= d.fullEvery;
    t.duoVolley = full ? 0 : v;
  }
  return { full, spec: null };
}

/**
 * One shell of a volley through the prism: counts it, and when it splits pushes its shards (landing with it,
 * MORTAR_DELAY later) around (x, y). @returns {number} shards pushed
 */
export function refract(sim, t, ctx, snap, x, y) {
  if (!ctx) return 0;
  const d = t.stats.duo;
  let split = ctx.full;
  if (d.every > 0) {
    const n = (t.prismN || 0) + 1;
    if (n >= d.every) {
      split = true;
      t.prismN = 0;
    } else t.prismN = n;
  }
  if (!split) return 0;
  if (!ctx.spec) ctx.spec = shardSpec(t, snap);
  const spec = ctx.spec;
  const r = spec.splash;
  for (let k = 0; k < d.shards; k++) {
    const off = PRISM_SHARDS[k % PRISM_SHARDS.length];
    const sh = {
      uid: sim._nextUid(),
      x: x + off[0],
      y: y + off[1],
      radius: r,
      left: MORTAR_DELAY,
      delay: MORTAR_DELAY,
      ownerUid: t.uid,
      fromX: t.ox,
      fromY: t.oy,
      element: null,
      attackType: 'mystic',
      shard: true,
      owner: t,
      spec,
      fresh: true,
      dead: false,
    };
    sim.shells.push(sh);
    sim._emit('mortarWarn', { uid: sh.uid, x: sh.x, y: sh.y, radius: r, delay: MORTAR_DELAY, towerUid: t.uid, shard: true });
  }
  sim._emit('refract', { towerUid: t.uid, x, y, shards: d.shards });
  return d.shards;
}
