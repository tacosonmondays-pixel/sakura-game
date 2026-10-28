// The duo (Kohaku & Tsubaki, docs/specs/DUO_LR.md §1.2, §4 "P-18 twin weapons"): two weapons on one tower.
//
// Tsubaki's star shells are the main behaviour (the mortar, src/sim/towers.js attackMortar). Kohaku's prism
// beam is the PARTNER weapon: its own timer in whole ticks (t.duoCd), ticked after the main weapon in the
// same step (updateTower), with the partner spec (t.beamSpec, built from her stats.duo and her buffs in
// refreshEffective).
//
// Her beam is a constant beam: while she has a target in reach, every beam she fires (spec.projectiles) holds
// its own enemy (t.prismBeams: one { e, held } per beam; a beam keeps its enemy while it stays among her
// targets, a target no beam holds goes to the first free one) and pierces the line through it as before.
// Every PRISM_BEAM_TICK steps each held beam deals one damage tick: the share PRISM_BEAM_TICK / beamTicks(rate)
// of one old flash (t.beamTickSpec: damage, flat armour, the 1-damage floor, the crystal shell's cap and its
// hit count all × that share, src/sim/combat.js computeHit), so her DPS is the old flash beam's at every tier.
// Resonant Light ramps with the time a beam has held the same enemy, at the old rate (+per for every old flash
// interval, up to +max), and starts over when the beam switches. Grand Spectrum's silence lands when a beam
// locks on and again every PRISM_SILENCE_TICKS steps it holds, on everything on its line, not on every tick.
// A lock-on is the beam's `attack` event (Kohaku's clip and sound), sent again every PRISM_CLIP_TICKS ticks (1.5 s)
// while a beam stays on; the display draws the held beams from
// t.prismBeams (src/render/attackFx/styles/kohaku_tsubaki.js) and never writes to them.
//
// Refraction: t.prismN counts her shells since the last split (an integer, saved in the battle save as `du`).
// Every `every`th shell splits (base 4; Cut Facets 3, Refraction 2, Constellation Lattice 1): the shell lands
// as usual and `shards` shards of light land around it at the fixed table PRISM_SHARDS (no rng, no trig),
// each a share of the shell's hit (mystic, hits flyers, its own small splash and the shard statuses).
// Potential's capstone (fullEvery): every Nth volley (t.duoVolley counts them) splits every shell in it.
//
// Determinism (co-op lockstep): integer counters and tick timers, fixed tables, + − × ÷ and Math.round only.

import { STEP, MORTAR_DELAY, PRISM_SHARDS, PRISM_BEAM_TICK, PRISM_SILENCE_TICKS, PRISM_CLIP_TICKS, BEAM_HALF_WIDTH } from './constants.js';

/** Ticks of one old flash interval at `rate` attacks a second (at least 1): a damage tick's share is PRISM_BEAM_TICK / this. */
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
    t.beamTickSpec = null;
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
  // one damage tick of a held beam: the share of one old flash (src/sim/combat.js computeHit reads `share`);
  // her silence lands on lock-on and every PRISM_SILENCE_TICKS (prismBeam), never through a tick
  const share = PRISM_BEAM_TICK / beamTicks(t.beamSpec.rate);
  t.beamTickSpec = { ...t.beamSpec, damage: t.beamSpec.damage * share, share, ramp: null, silence: 0, tick: true };
  if (!t.prismBeams) t.prismBeams = []; // her beams' holds (prismBeam fills one per beam on her first target)
}

/**
 * One step of the partner weapon (after the main weapon; never while she is sabotaged or moving: updateTower
 * returns before both, and a sabotage lets go of her beams, partnerOff). Every PRISM_BEAM_TICK steps while
 * she has a target: one damage tick of her constant beam (prismBeam), with t.eff swapped to the partner spec.
 * A step with no target keeps the timer at 0 (her beam comes on the moment one comes into reach).
 * `h`: the targeting helpers of src/sim/towers.js ({ selectTargets, linePierce, face }).
 */
export function partnerTick(sim, t, h) {
  const spec = t.beamSpec;
  if (!spec) return;
  if (t.duoCd > 0) t.duoCd--;
  if (t.duoCd > 0) return;
  const main = t.eff;
  t.eff = spec;
  let ok = false;
  try {
    ok = prismBeam(sim, t, spec, h);
  } finally {
    if (t.eff === spec) t.eff = main;
  }
  t.duoCd = ok ? PRISM_BEAM_TICK : 0;
}

/** Her beams let go (no target, or she is sabotaged): every beam free, its hold back to 0. */
export function partnerOff(t) {
  const L = t.prismBeams;
  if (!L) return;
  for (let i = 0; i < L.length; i++) {
    L[i].e = null;
    L[i].held = 0;
  }
}

/**
 * Her Resonant Light on a beam that has held its enemy for `held` damage ticks: 1 + per for every old flash
 * interval held (per × held × share), up to 1 + max.
 */
export function prismRamp(spec, tick, held) {
  const ramp = spec.ramp;
  return ramp ? 1 + Math.min(ramp.per * held * tick.share, ramp.max) : 1;
}

/** One damage tick of her constant beam. @returns {boolean} whether she had a target */
function prismBeam(sim, t, spec, h) {
  const n = spec.projectiles;
  const targets = h.selectTargets(sim, t.ox, t.oy, spec.range, spec, t.targetMode, n);
  if (!targets.length) {
    partnerOff(t);
    return false;
  }
  let L = t.prismBeams;
  if (!L) L = t.prismBeams = [];
  while (L.length < n) L.push({ e: null, held: 0 });
  // a beam keeps its enemy while it stays among her targets; the others let go
  for (let i = 0; i < L.length; i++) {
    const b = L[i];
    if (b.e && (i >= n || !targets.includes(b.e))) {
      b.e = null;
      b.held = 0;
    }
  }
  // a target no beam holds goes to the first free beam (a new lock)
  let locked = null;
  for (let k = 0; k < targets.length; k++) {
    const e = targets[k];
    let free = -1;
    let held = false;
    for (let i = 0; i < n; i++) {
      if (L[i].e === e) {
        held = true;
        break;
      }
      if (free < 0 && !L[i].e) free = i;
    }
    if (held || free < 0) continue;
    L[free].e = e;
    L[free].held = 0;
    if (!locked) locked = e;
    if (k === 0) h.face(t, e);
  }
  const tick = t.beamTickSpec;
  const sil = spec.silence > 0 ? spec.silence : 0;
  for (let i = 0; i < n; i++) {
    const b = L[i];
    const e = b.e;
    if (!e || e.dead) continue; // (an earlier beam's tick finished it: the next tick lets go)
    const scale = prismRamp(spec, tick, b.held);
    const silence = sil > 0 && (b.held * PRISM_BEAM_TICK) % PRISM_SILENCE_TICKS === 0;
    const { hits } = h.linePierce(sim, t, tick, e, spec.range, BEAM_HALF_WIDTH, spec.pierce);
    for (let j = 0; j < hits.length; j++) {
      const v = hits[j];
      if (v.dead) continue;
      sim._hit(v, t, tick, scale);
      if (silence && !v.dead) silenceOn(sim, t, v, sil);
    }
    b.held++;
  }
  // Kohaku's clip and sound: on a lock-on, and every PRISM_CLIP_TICKS ticks her first held beam stays on (from its
  // own hold count: no extra state)
  if (!locked) {
    for (let i = 0; i < n; i++) {
      const b = L[i];
      if (!b.e || b.e.dead) continue;
      if (b.held % PRISM_CLIP_TICKS === 0) locked = b.e;
      break;
    }
  }
  if (locked) sim._emit('attack', { towerUid: t.uid, targetUid: locked.uid, kind: 'beam' });
  return true;
}

/** Grand Spectrum's silence on one enemy on a beam's line (the on-hit status path, src/sim/Sim.js _onHitEffects). */
function silenceOn(sim, t, e, duration) {
  const ctx = sim._statusCtx;
  ctx.element = null;
  ctx.attackType = 'mystic';
  ctx.sourceUid = t.uid;
  ctx.hitDamage = 0;
  ctx.curseDepth = 0;
  sim._applyStatusEvent(e, { type: 'silence', duration }, ctx);
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
