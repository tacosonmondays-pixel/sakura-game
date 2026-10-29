// The A4 deploys (ABILITIES_SPEC §4 deploy, §5.1): the temporary objects three ⚡ abilities put on the map,
// beyond their girl's own limit. src/sim/abilities.js DEPLOYS calls the casts; this file owns the objects.
//
//   Kage's Shadow Doubles ('double'): sim.deployables [{ uid, kind: 'double', ownerUid, x, y, left, dmgMul,
//     cooldown, facing }] (created on the first cast). Each double stands on a road spot (path samples every
//     STRIP_SPOT_STEP tiles in her range, nearest the exit first, at least `spacing` apart among the doubles of
//     one cast) and throws her CURRENT volley from there (her projectiles with Potential N13's extra shuriken and her
//     gear Pierce, range, rate, target mode and hit, read from her each throw) × dmgMul, never critting (no rng); a
//     double holds while she is sabotaged. Its shots are hers: spawnProjectile with
//     her as the owner, so damage, kills and hero XP credit Kage through Sim._hit.
//   Suzu's Bell Carpet ('trap'): extra traps in sim.traps { …her trap record, extra: true, ttl } spread
//     evenly (by road order, lane by lane: index floor((i + 0.5) × n / k), the Spike Rain rule, no rng) over
//     the road samples in her range (carpetSpots: every CARPET_STEP tiles, finer than the strips' 0.5 so a short
//     stretch in a small range still holds Grand Bell Detonation's 12); armed after `arm` s; each fires once with her trap spec; updateTraps
//     (src/sim/towers.js) ages `ttl` and fizzles the rest (`trapExpired`). They never count in trapCount.
//   Chika's Drone Surge ('drone'): extra roaming drones in t.turrets (makeDrone + temp: true, surge: k,
//     left), so they fly, hunt and shoot with her wing (her flight mode) and their damage counts in her
//     droneDmg / droneKills. They take no serial number (n 0, droneSerial unchanged) and never count against
//     her drone limit (ownDrones); when `left` runs out they dock and vanish (`deployEnd`).
//
// Lifetimes: doubles and surge drones count down in integer ticks (`left`, tickDeploys inside
// tickAbilities, so only while a wave runs); Bell Carpet traps count seconds of steps (`ttl`, like strips).
// Everything ends at the wave clear (endDeployWave) and when its girl is sold (clearDeploys; the sale
// already drops her traps and drones). Caps: DOUBLES_PER_SIM, BELL_TRAPS_PER_SIM, SURGE_DRONES_PER_SIM —
// a cast places only what the cap leaves, and nothing already placed is evicted.
//
// Determinism: no rng, spots in a fixed order (roadSpots: remaining, lane, distance), squared distances,
// list order = cast order, `atan2` only for the doubles' facing (swapped in co-op, like every facing).
// State is plain data (the generic snapshot stores it; the battle save never sees it: a calm point has none).

import { STEP, DOUBLES_PER_SIM, BELL_TRAPS_PER_SIM, SURGE_DRONES_PER_SIM } from './constants.js';
import { roadSpots } from './strips.js';
import { samplePath } from './path.js';
import { selectTargets, spawnProjectile, makeDrone, hasRoamingDrones } from './towers.js';
import { pierceCarry, pierceK, pierceMax } from './gearRules.js';

export { ownDrones } from './towers.js';

const ticks = (s) => Math.round((s || 0) * 60);

// ---------------------------------------------------------------------------
// Kage: Shadow Doubles
// ---------------------------------------------------------------------------

/** How many shadow doubles stand on the map now. */
function doubleCount(sim) {
  let n = 0;
  for (const d of sim.deployables || []) if (d.kind === 'double') n++;
  return n;
}

/**
 * The road spots her doubles take: nearest the exit first among the road samples in her range, each at
 * least `spacing` tiles from the ones already taken in this cast; up to `count`. @returns {{ x, y }[]}
 */
export function doubleSpots(sim, t, count, spacing) {
  const spots = roadSpots(sim, t.x, t.y, t.eff.range);
  const s2 = spacing * spacing;
  const out = [];
  for (const s of spots) {
    if (out.length >= count) break;
    let ok = true;
    for (const o of out) {
      const dx = o.x - s.x;
      const dy = o.y - s.y;
      if (dx * dx + dy * dy < s2) {
        ok = false;
        break;
      }
    }
    if (ok) out.push({ x: s.x, y: s.y });
  }
  return out;
}

/**
 * Shadow Doubles: `count` doubles on her road spots (doubleSpots) for `duration` s, throwing her volley at
 * `dmgMul` of her damage. @returns {object[]} the doubles placed (empty: no road in range or the cap is full)
 */
export function shadowDoubles(sim, t, { count, spacing, dmgMul, duration }) {
  const room = Math.max(0, DOUBLES_PER_SIM - doubleCount(sim));
  const spots = doubleSpots(sim, t, Math.min(count, room), spacing);
  if (!spots.length) return spots;
  const list = sim.deployables || (sim.deployables = []);
  const left = ticks(duration);
  const out = [];
  for (const p of spots) {
    const d = { uid: sim._nextUid(), kind: 'double', ownerUid: t.uid, x: p.x, y: p.y, left, dmgMul, cooldown: 0, facing: t.facing || 0 };
    list.push(d);
    out.push(d);
    sim._emit('deploy', { uid: d.uid, towerUid: t.uid, x: d.x, y: d.y, kind: 'double', extra: true });
  }
  return out;
}

/**
 * One volley of a double: her FULL volley from its spot (targets by her mode in her range), × dmgMul, no crit. As her
 * own attack counts it (src/sim/towers.js volleyFrom): her projectiles, the extra shuriken of Potential N13
 * (projScale, through an integer carry) and her gear Pierce on each shot (pierceK through pierceCarry, none on a
 * splash shot); the carries are the double's own (d.projCarry, d.pierceCarry), so her own throws keep their count.
 */
function doubleVolley(sim, t, d) {
  const base = t.eff;
  let n = Math.max(1, base.projectiles || 1);
  // (a fresh spec per volley: her hit as it stands now; never a crit, so no rng is drawn)
  const spec = { ...base, damage: base.damage * d.dmgMul, critChance: 0 };
  const targets = selectTargets(sim, d.x, d.y, base.range, spec, t.targetMode, n);
  if (!targets.length) return null;
  if (base.projScale > 0) {
    const k = Math.round(base.projScale * 100);
    d.projCarry = (d.projCarry || 0) + n * k;
    const extra = Math.floor(d.projCarry / 100);
    d.projCarry -= extra * 100;
    n += extra;
  }
  const gk = spec.splash > 0 ? 0 : pierceK(t);
  for (let i = 0; i < n; i++) {
    const tgt = targets[i % targets.length];
    const dup = Math.floor(i / targets.length);
    if (!(spec.projectileSpeed > 0)) {
      if (!tgt.dead) sim._hit(tgt, t, spec, 1);
      continue;
    }
    // a second shot at the same enemy fans out like her own volley's duplicates
    const spread = dup === 0 ? 0 : (dup % 2 ? 1 : -1) * 0.12 * Math.ceil(dup / 2);
    const extra = gk > 0 ? pierceCarry(d, 'pierceCarry', gk, pierceMax(t)) : 0;
    spawnProjectile(sim, t, spec, tgt, d.x, d.y, extra ? { spread, pierce: spec.pierce + extra } : spread ? { spread } : {});
  }
  d.facing = Math.atan2(targets[0].x - d.x, targets[0].y - d.y);
  return targets[0];
}

// ---------------------------------------------------------------------------
// Suzu: Bell Carpet
// ---------------------------------------------------------------------------

/** How many Bell Carpet traps lie on the road now. */
function bellCount(sim) {
  let n = 0;
  for (const tr of sim.traps) if (tr.extra && !tr.strip && !tr.dead) n++;
  return n;
}

/** Bell Carpet's road samples: this many tiles apart. */
export const CARPET_STEP = 0.25;

/** Two carpet samples closer than this (squared, tiles) are one spot: lanes that share a road stretch share its spots. */
const CARPET_SAME2 = (CARPET_STEP / 2) * (CARPET_STEP / 2);

/**
 * The road samples Bell Carpet spreads over: every CARPET_STEP tiles of every path, outside the tunnels, within
 * her range; in road order (lane by lane, along each lane). A sample within CARPET_STEP / 2 of one already taken (a
 * stretch two lanes share, at a fork or a join) is dropped, so the carpet never stacks two traps on one spot; the
 * earlier lane keeps it (path order: deterministic).
 */
export function carpetSpots(sim, t) {
  const out = [];
  const r2 = t.eff.range * t.eff.range;
  for (const path of sim.pathData) {
    for (const s of samplePath(path, CARPET_STEP)) {
      if (s.hidden) continue;
      const dx = s.x - t.x;
      const dy = s.y - t.y;
      if (dx * dx + dy * dy > r2) continue;
      let dup = false;
      for (let i = 0; i < out.length; i++) {
        const ex = out[i].x - s.x;
        const ey = out[i].y - s.y;
        if (ex * ex + ey * ey < CARPET_SAME2) {
          dup = true;
          break;
        }
      }
      if (!dup) out.push(s);
    }
  }
  return out;
}

/**
 * Bell Carpet: `count` extra traps spread evenly over her carpet spots (lane by lane, along each lane; index
 * floor((i + 0.5) × n / k)), armed after `arm` s, fizzling after `duration` s.
 * @returns {object[]} the traps laid (empty: no road in range, no trap of hers or the cap is full)
 */
export function bellCarpet(sim, t, { count, arm, duration }) {
  if (!t.trapSpec) return [];
  const spots = carpetSpots(sim, t);
  const n = spots.length;
  const k = Math.min(count, n, Math.max(0, BELL_TRAPS_PER_SIM - bellCount(sim)));
  const out = [];
  for (let i = 0; i < k; i++) {
    const s = spots[Math.floor(((i + 0.5) * n) / k)];
    const tr = { uid: sim._nextUid(), x: s.x, y: s.y, ownerUid: t.uid, armed: false, armLeft: arm ?? 0.3, owner: t, extra: true, ttl: duration };
    sim.traps.push(tr);
    out.push(tr);
    sim._emit('trapPlaced', { uid: tr.uid, x: tr.x, y: tr.y, ownerUid: t.uid, extra: true });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Chika: Drone Surge
// ---------------------------------------------------------------------------

/** Her surge drones flying now. */
export function surgeDrones(t) {
  let n = 0;
  for (const d of t.turrets) if (d.temp) n++;
  return n;
}

function surgeCount(sim) {
  let n = 0;
  for (const t of sim.towers) if (t.turrets.length) n += surgeDrones(t);
  return n;
}

/**
 * Drone Surge: `count` extra roaming drones for `duration` s, launched from her home ring (formation slots
 * after her own), numbered Surge 1…k. @returns {object[]} the drones (empty: no roaming wing or the cap is full)
 */
export function droneSurge(sim, t, { count, duration }) {
  if (!hasRoamingDrones(t)) return [];
  const k = Math.min(count, Math.max(0, SURGE_DRONES_PER_SIM - surgeCount(sim)));
  const base = t.turrets.length;
  const left = ticks(duration);
  const out = [];
  for (let i = 0; i < k; i++) {
    const d = makeDrone(t, sim._nextUid(), 0, base + i, sim.wave);
    d.temp = true;
    d.surge = i + 1;
    d.left = left;
    t.turrets.push(d);
    out.push(d);
    sim._emit('deploy', { uid: d.uid, towerUid: t.uid, x: d.x, y: d.y, kind: 'drone', extra: true });
  }
  return out;
}

/** Her surge drones dock and vanish (all of them, or only the ones whose time ran out). */
function dockSurge(sim, t, all) {
  let n = 0;
  const list = t.turrets;
  for (let i = 0; i < list.length; i++) {
    const d = list[i];
    if (d.temp && (all || d.left <= 0)) {
      sim._emit('deployEnd', { uid: d.uid, towerUid: t.uid, x: d.x, y: d.y, kind: 'drone' });
      continue;
    }
    list[n++] = d;
  }
  list.length = n;
}

// ---------------------------------------------------------------------------
// The step, the wave clear and selling
// ---------------------------------------------------------------------------

/**
 * One step (tickAbilities, in a wave): surge drones and doubles age (integer ticks) and the spent ones go;
 * then every double still standing throws, in list order (cast order).
 */
export function tickDeploys(sim) {
  for (const t of sim.towers) {
    if (!t.turrets.length) continue;
    let gone = false;
    for (const d of t.turrets) if (d.temp && --d.left <= 0) gone = true;
    if (gone) dockSurge(sim, t, false);
  }
  const list = sim.deployables;
  if (!list || !list.length) return;
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    const d = list[i];
    if (--d.left <= 0) {
      sim._emit('deployEnd', { uid: d.uid, towerUid: d.ownerUid, x: d.x, y: d.y, kind: d.kind });
      continue;
    }
    list[n++] = d;
  }
  list.length = n;
  for (let i = 0; i < list.length; i++) {
    const d = list[i];
    const t = sim.getTower(d.ownerUid);
    // (a sabotaged Kage's doubles hold too, like her own attack, sentries and drones; their clocks wait with her)
    if (!t || t.removed || t.disabled > 0) continue;
    if (d.cooldown > 0) d.cooldown -= STEP;
    if (d.cooldown > 0) continue;
    const first = doubleVolley(sim, t, d);
    if (!first) {
      d.cooldown = 0;
      continue;
    }
    d.cooldown += 1 / Math.max(0.05, t.eff.rate);
    sim._emit('doubleAttack', { uid: d.uid, towerUid: t.uid, targetUid: first.uid, x: d.x, y: d.y });
  }
}

/** Wave clear (endAbilityWave): every double, Bell Carpet trap and surge drone ends. */
export function endDeployWave(sim) {
  if (sim.deployables?.length) sim.deployables.length = 0;
  let traps = false;
  for (const tr of sim.traps) if (tr.extra && !tr.strip) traps = true;
  if (traps) sim.traps = sim.traps.filter((tr) => !(tr.extra && !tr.strip));
  for (const t of sim.towers) if (t.turrets.length && surgeDrones(t)) dockSurge(sim, t, true);
}

/** A girl leaves (sold): her doubles go with her (Sim.sellTower drops her traps and drones itself). */
export function clearDeploys(sim, t) {
  if (sim.deployables?.length) sim.deployables = sim.deployables.filter((d) => d.ownerUid !== t.uid);
}
