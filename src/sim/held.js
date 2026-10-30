// Attack shapes, batch S2 "Held" (docs/specs/ATTACK_SHAPES.md §4.3, §5.3, §5.9, §7.2), on the held channel
// (src/sim/channel.js, t.ch):
//   - Hearth Stream (behaviour 'stream'): a held cone of fire from her along her aim k (half-angle stream.half
//     table steps, length her range). Every CH_TICK steps every eligible enemy in the cone, at most stream.cap,
//     nearest first, takes one tick: damage × rate × CH_TICK × STEP × stream.mul (the §4.3 parity share), × 1 at
//     her down to × STREAM_TIP at the tip (linear in d²). Her own statuses ride on every tick (her burn: no
//     chance, no extra rng draw). Her aim turns stream.turn table steps a sim step toward her enemy, so a fast
//     enemy can outrun the mouth of the cone.
//   - Searchlight Sweep (behaviour 'sweep'): a held beam of her range that swings sweep.swing table steps a sim
//     step between centre − arc and centre + arc; the centre turns sweep.turn steps a sim step toward her enemy.
//     Every SWEEP_TICK steps the enemies within SWEEP_HALF_WIDTH of the beam take one hit each, nearest first; the
//     re-hit gap is one pass (one swing from end to end of the arc, sweepPass steps: the channel's own [uid, pass]
//     memory, so a big body under the beam for several tests is struck once), and a pass strikes at most sweep.cap
//     (else her maxTargets) enemies. A hit is damage × rate × pass × STEP × sweep.mul: every enemy inside the arc
//     is crossed once a pass, so one enemy takes her old DPS and a dense crowd her old maxTargets' worth. Her reveal
//     and silence ride on the hits, so the beam reveals the veiled enemies it crosses.
//
// The channel and her attacks: her attack loop still runs at her rate (src/sim/towers.js updateTower), and each
// counted attack (attackHeld) re-picks her enemy by her target mode and sets what the channel carries until her
// next one: a rhythm attack (Potential) makes it carry t.effProc, a gear trick its harder copy. So her rhythm,
// gear tricks and drinks count attacks as before, and a rhythm's share of her damage is the share of the time
// the channel carries it. A rhythm's echo is one flare: the shape's test once, at the echo's whole hit.
// Between counted attacks the channel ticks on its own clock (heldTick, every step after her attack loop).
//
// Determinism (§2.4): directions from the shared table (src/sim/dirs.js: nearestDir, turnToward; no atan2),
// squared distances (inCone, nearSegment), integer step timers, no rng of our own (sim._hit still rolls crits),
// victims in the grid's order or by (d², uid) when a cap cuts the list. State: t.ch (integers), ended at the wave
// clear (endHeldWave).

import { isEligible } from './combat.js';
import { wrapDir, nearestDir, turnToward, DIR_X, DIR_Y } from './dirs.js';
import { inCone, nearSegment, hitRadius } from './shapes.js';
import { chOpen, chShare, chRamp, chEnemy, chKeeps, chLock, chRecent, chRemember } from './channel.js';
import { RING_DIRS, CH_TICK, STREAM_TIP, SWEEP_TICK, SWEEP_HALF_WIDTH } from './constants.js';

const TAU = 2 * Math.PI;

/**
 * Hearth Stream's element kinds. Only `fire` is in use (Akane's Wildfire); frost, poison and water are data for a
 * later batch (§5.3 variants: frost slows then freezes on a long lock, poison mist is wider and shorter, a water
 * jet is narrow and pushes by path distance under the push lock). Nothing in the sim reads them yet beyond `kind`.
 */
export const STREAM_KINDS = Object.freeze({
  fire: Object.freeze({ status: 'burn', color: '#ff9a3c', core: '#fff1c8' }),
  frost: Object.freeze({ status: 'slow', freezeLock: 120, color: '#9fe3ff', core: '#ffffff' }),
  poison: Object.freeze({ status: 'poison', halfMul: 1.5, lengthMul: 0.75, color: '#a8e05f', core: '#f0ffd0' }),
  water: Object.freeze({ status: 'soak', halfMul: 0.5, push: 0.15, color: '#6fd0ff', core: '#ffffff' }),
});

/** Her facing from a table index (the renderer's facing angle; k × 2π / 240, no trig). */
function faceDir(t, k) {
  const a = (TAU * wrapDir(k)) / RING_DIRS;
  t.facing = a > Math.PI ? a - TAU : a;
}

/** The shape block of a held girl ('stream' or 'sweep'), or null. */
function shapeOf(t) {
  const b = t.eff?.behavior;
  return b === 'stream' ? t.stats.stream : b === 'sweep' ? t.stats.sweep : null;
}

/** Swing offset at phase ph of a sweep with this arc: a triangle wave −arc … +arc … −arc over 4 × arc. */
export function swingOffset(ph, arc) {
  if (!(arc > 0)) return 0;
  const p = ph % (4 * arc);
  return p < 2 * arc ? p - arc : 3 * arc - p;
}

function emitChannel(sim, t, e) {
  sim._emit('channel', { towerUid: t.uid, targetUid: e ? e.uid : null, k: t.ch ? t.ch.k : null, shape: t.eff?.behavior ?? null });
}

/**
 * One counted attack of a held girl (her attack loop, at her rate): picks her enemy by target mode (h.bestTarget),
 * opens the channel or switches it, and sets what it carries until her next attack (o.src: 1 for a rhythm attack,
 * o.trick: her gear trick code, o.set: her gear set passives (channel.js `set`), o.extra(): her gear Pierce's extra victims, asked once she has an enemy). An echo (o.echo) is one flare with `spec` (the echo's hit) instead.
 * @returns {object|null} her enemy (null: none in reach, not a counted attack)
 */
export function attackHeld(sim, t, spec, h, o) {
  const w = shapeOf(t);
  if (!w) return null;
  const e = h.bestTarget(sim, t.ox, t.oy, spec.range, spec, t.targetMode);
  if (!e) return null;
  if (o.echo) {
    flare(sim, t, spec, w);
    return e;
  }
  let ch = t.ch;
  if (!ch) {
    ch = chOpen(t, e.uid, nearestDir(e.x - t.ox, e.y - t.oy));
    emitChannel(sim, t, e);
  } else if (ch.uid !== e.uid) {
    ch.uid = e.uid;
    ch.lock = 0;
    ch.grace = 0;
    emitChannel(sim, t, e);
  }
  ch.src = o.src;
  ch.trick = o.trick;
  ch.set = o.set | 0;
  ch.px = o.extra ? o.extra() : 0;
  t.targetUid = e.uid;
  sim._emit('attack', { towerUid: t.uid, targetUid: e.uid, kind: t.eff.behavior });
  return e;
}

/** The tick spec: `base` at `share` of one hit (× mul), a damage tick (the display sums them). */
function tickSpec(base, share, mul) {
  return { ...base, damage: base.damage * share * mul, share, tick: true };
}

const NEAR = [];
const VICT = [];
const VD2 = [];
const ORDER = [];

/** Victims VICT (d² in VD2) cut to the `cap` nearest by (d², uid) when there are more; ORDER holds their indices. */
function nearestFirst(cap) {
  ORDER.length = 0;
  for (let i = 0; i < VICT.length; i++) ORDER.push(i);
  if (cap > 0 && ORDER.length > cap) {
    ORDER.sort((a, b) => VD2[a] - VD2[b] || VICT[a].uid - VICT[b].uid);
    ORDER.length = cap;
  }
}

function clearScratch() {
  NEAR.length = 0;
  VICT.length = 0;
  VD2.length = 0;
  ORDER.length = 0;
}

/** The enemies in her cone along k for `hit` into VICT / VD2 (grid order). */
function coneVictims(sim, t, hit, k, half) {
  const L = hit.range;
  sim.grid.query(t.ox, t.oy, L + 0.6, NEAR);
  for (let i = 0; i < NEAR.length; i++) {
    const e = NEAR[i];
    if (e.dead || !isEligible(e, hit)) continue;
    const ex = e.x - t.ox;
    const ey = e.y - t.oy;
    if (!inCone(ex, ey, k, half, L, hitRadius(e))) continue;
    VICT.push(e);
    VD2.push(ex * ex + ey * ey);
  }
}

/** The enemies on her beam along k for `hit` into VICT / VD2 (grid order); `skip(e)` leaves one out. */
function beamVictims(sim, t, hit, k, skip) {
  const L = hit.range;
  const bx = t.ox + DIR_X[k] * L;
  const by = t.oy + DIR_Y[k] * L;
  sim.grid.query((t.ox + bx) / 2, (t.oy + by) / 2, L / 2 + 1, NEAR);
  for (let i = 0; i < NEAR.length; i++) {
    const e = NEAR[i];
    if (e.dead || !isEligible(e, hit) || (skip && skip(e))) continue;
    if (!nearSegment(e.x, e.y, t.ox, t.oy, bx, by, SWEEP_HALF_WIDTH, hitRadius(e))) continue;
    const ex = e.x - t.ox;
    const ey = e.y - t.oy;
    VICT.push(e);
    VD2.push(ex * ex + ey * ey);
  }
}

/** Hearth Stream's falloff at d² for length L: × 1 at her, × STREAM_TIP at the tip, linear in d². */
export function streamFalloff(d2, L) {
  const f = L > 0 ? d2 / (L * L) : 0;
  return 1 - (1 - STREAM_TIP) * (f < 1 ? f : 1);
}

/** One damage tick of a stream along ch.k (`ramp`: × the channel's time on target). */
function streamTick(sim, t, base, w, ramp) {
  const hit = tickSpec(base, chShare(base.rate, CH_TICK), w.mul);
  coneVictims(sim, t, hit, t.ch.k, w.half);
  nearestFirst(w.cap + t.ch.px);
  for (let j = 0; j < ORDER.length; j++) {
    const i = ORDER[j];
    const e = VICT[i];
    if (!e.dead) sim._hit(e, t, hit, ramp * streamFalloff(VD2[i], hit.range));
  }
  clearScratch();
}

/** One beam test of a sweep along ch.k: each enemy on it at most once a pass (the channel's memory), at most cap a pass. */
function sweepTick(sim, t, base, w, ramp) {
  const ch = t.ch;
  const room = (w.cap > 0 ? w.cap : base.maxTargets) + ch.px - ch.n;
  if (room <= 0) return;
  const hit = tickSpec(base, chShare(base.rate, sweepPass(w)), w.mul);
  const list = ch.hits;
  const pass = ch.pass;
  beamVictims(sim, t, hit, ch.k, (e) => chRecent(list, e.uid, pass, 1));
  nearestFirst(room);
  for (let j = 0; j < ORDER.length; j++) {
    const e = VICT[ORDER[j]];
    if (e.dead) continue;
    chRemember(list, e.uid, pass);
    ch.n++;
    sim._hit(e, t, hit, ramp);
  }
  clearScratch();
}

/** Sim steps of one pass of a sweep (centre − arc to centre + arc): 2 × arc ÷ swing, at least 1. */
export function sweepPass(w) {
  return Math.max(1, Math.round((2 * Math.max(1, w.arc)) / Math.max(1, w.swing)));
}

/** A rhythm echo on a held shape: the shape's test once, each victim taking the echo's whole hit (× mul). */
function flare(sim, t, spec, w) {
  const ch = t.ch;
  const k = ch ? ch.k : 0;
  if (!ch) return;
  const hit = { ...spec, damage: spec.damage * w.mul };
  if (spec.behavior === 'sweep') {
    beamVictims(sim, t, hit, k, null);
    nearestFirst((w.cap > 0 ? w.cap : spec.maxTargets) + ch.px);
    for (let j = 0; j < ORDER.length; j++) if (!VICT[ORDER[j]].dead) sim._hit(VICT[ORDER[j]], t, hit, 1);
  } else {
    coneVictims(sim, t, hit, k, w.half);
    nearestFirst(w.cap + ch.px);
    for (let j = 0; j < ORDER.length; j++) {
      const i = ORDER[j];
      if (!VICT[i].dead) sim._hit(VICT[i], t, hit, streamFalloff(VD2[i], hit.range));
    }
  }
  clearScratch();
}

/**
 * Every step of a held girl (src/sim/towers.js updateTower, after her attack loop): the lock (her enemy kept while
 * in reach, else the next by her target mode, else the grace and the release), the aim, and the damage tick when
 * it is due. `h`: { bestTarget, base(t) } (base: the spec the channel carries now, see attackHeld).
 */
export function heldTick(sim, t, h) {
  const ch = t.ch;
  if (!ch) return;
  const w = shapeOf(t);
  if (!w) {
    t.ch = null;
    return;
  }
  const spec = t.eff;
  const cur = chEnemy(sim, ch.uid);
  const e = chLock(t, cur, chKeeps(cur, t.ox, t.oy, spec), () => h.bestTarget(sim, t.ox, t.oy, spec.range, spec, t.targetMode), (n) => emitChannel(sim, t, n));
  if (!t.ch) return; // let go after the grace
  if (e) {
    const kt = nearestDir(e.x - t.ox, e.y - t.oy);
    if (spec.behavior === 'sweep') ch.c = turnToward(ch.c, kt, w.turn);
    else ch.k = turnToward(ch.k, kt, w.turn);
    t.targetUid = e.uid;
  }
  if (spec.behavior === 'sweep') {
    const arc = Math.max(1, w.arc);
    ch.ph = (ch.ph + w.swing) % (4 * arc);
    ch.k = wrapDir(ch.c + swingOffset(ch.ph, arc));
    // a new pass (the beam turned at an end of its arc): it may strike each enemy, and its cap, again
    if ((ch.ph < 2 * arc ? 0 : 1) !== (ch.pass & 1)) {
      ch.pass++;
      ch.n = 0;
    }
  }
  faceDir(t, ch.k);
  if (ch.tick > 0) ch.tick--;
  if (ch.tick === 0) {
    const base = h.base(t);
    const ramp = chRamp(base.ramp, base.rate, ch.lock);
    if (spec.behavior === 'sweep') {
      sweepTick(sim, t, base, w, ramp);
      if (t.ch) t.ch.tick = SWEEP_TICK;
    } else {
      streamTick(sim, t, base, w, ramp);
      if (t.ch) t.ch.tick = CH_TICK;
    }
  }
  if (e && t.ch) t.ch.lock++;
}

/** She lets go (sabotaged, repositioning, or sold): the channel ends. */
export function heldOff(sim, t) {
  if (!t.ch) return;
  t.ch = null;
  emitChannel(sim, t, null);
}

/**
 * Her paper DPS on one target with a held shape, from `perTarget` (damage × rate): a stream's × mul at its mouth;
 * a sweep's × mul (one hit a pass, each a pass's share). Unchanged otherwise.
 */
export function heldDps(t, e, perTarget) {
  if (e.behavior === 'stream' && t.stats.stream) return e.damage * e.rate * t.stats.stream.mul;
  if (e.behavior === 'sweep' && t.stats.sweep) {
    return e.damage * e.rate * t.stats.sweep.mul;
  }
  return perTarget;
}

/** Wave clear: every channel ends (calm-point saves and co-op checkpoints carry none). */
export function endHeldWave(sim) {
  // (deleted, not nulled: `ch` is a calm key a battle save leaves out, so a restored run has it absent)
  for (const t of sim.towers) if (t.ch) delete t.ch;
}
