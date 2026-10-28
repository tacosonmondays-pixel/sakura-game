// Map rules and battle-mode helpers for the Sim (docs/specs/CODEX_MODES.md §6.1). Pure helpers: the
// rule runtime lives on the Sim (`sim.rule`) and is driven from Sim.js.
//
// Determinism: integer step clocks, products of data constants, squared distances; no
// transcendental math and no rng draws (reversePath reuses pathFromTrack, whose Math.hypot the
// co-op build swaps for its deterministic version).
//
// Calm point: ruleWaveEnd() puts the runtime back into the state a freshly built Sim has between
// waves (clock 0, resting, vents cold, no affinity, tables rebuilt). The only rule state a
// between-waves snapshot needs beyond that is the route orientation (sim.routeReversed).

import { pathFromTrack } from './path.js';
import { placeOnPath } from './enemies.js';
import { STEP } from './constants.js';

export { modeArmor } from '../data/modes.js';

const STEPS_PER_S = Math.round(1 / STEP);
const ATTACK_TYPE_IDS = new Set(['pierce', 'slash', 'blast', 'mystic', 'holy']);

/**
 * Runtime of a map rule, or null.
 * @param {object|null} def MAP_RULES entry merged with the stage's zones and pads (stageRule)
 */
export function createRuleRuntime(def) {
  if (!def) return null;
  const period = def.cycle ? Math.round(def.cycle[0] * STEPS_PER_S) : 0;
  const activeSteps = def.cycle ? Math.round(def.cycle[1] * STEPS_PER_S) : 0;
  const always = def.always || {};
  const act = def.active || {};
  return {
    id: def.id,
    def,
    period,
    activeSteps,
    active: !period,
    zones: def.zones || [],
    pads: def.pads || [],
    reverseEvenWaves: !!(always.reverseEvenWaves || act.reverseEvenWaves),
    zoneDps: 0,
    affinity: null,
  };
}

/** Absolute route orientation of wave n: Reverse Route XOR (Rear Ambush and n even). */
export function routeReversedFor(sim, n) {
  return !!sim.mode?.reverse !== !!(sim.rule?.reverseEvenWaves && n % 2 === 0);
}

/** Is wave n flipped relative to this battle's usual direction? (Rear Ambush's even waves, in any mode.) */
export function routeFlippedFor(sim, n) {
  return routeReversedFor(sim, n) !== !!sim.mode?.reverse;
}

/** The same road walked the other way: points, elevation, tunnels and decks mirrored. */
export function reversePath(p) {
  const L = p.length;
  const flip = (ranges) => (ranges || []).map(([a, b]) => [L - b, L - a]).reverse();
  return pathFromTrack({
    points: p.points.slice().reverse(),
    elev: p.elev ? p.elev.slice().reverse() : null,
    tunnels: flip(p.tunnels),
    under: flip(p.under),
  }, p.index);
}

/** Past the goal: a rule with pastGoal 'off' is neutral; economy (€) effects stop for every rule. */
function pastGoal(sim, wave = sim.wave) {
  return wave > sim._ruleGoal;
}

function ruleNeutral(sim) {
  return sim.rule.def.pastGoal === 'off' && pastGoal(sim);
}

function foldMap(into, src) {
  if (!src) return;
  for (const k of Object.keys(src)) into[k] = (into[k] ?? 1) * src[k];
}

/**
 * Folds the rule's always effects (+ its active effects while ACTIVE) and this wave's affinity into
 * the hot-path tables: sim._ruleMul {all, type, el, pad}, sim._ruleMove {all, family, cls},
 * sim._ruleRange {mul, add, pad}, sim._rulePortal. Neutral tables are null, so hot paths skip them.
 */
export function rebuildRuleTables(sim) {
  const r = sim.rule;
  sim._ruleMul = null;
  sim._ruleMove = null;
  sim._ruleRange = null;
  sim._rulePortal = null;
  if (!r || ruleNeutral(sim)) return;
  const sets = r.active ? [r.def.always, r.def.active] : [r.def.always];
  let all = 1;
  const type = {};
  const el = {};
  let moveAll = 1;
  const family = {};
  const cls = {};
  let rMul = 1;
  let rAdd = 0;
  let padDmg = 0;
  for (const s of sets) {
    if (!s) continue;
    if (s.dmgMul) all *= s.dmgMul;
    foldMap(type, s.typeMul);
    foldMap(el, s.elementMul);
    if (s.enemySpeed) moveAll *= s.enemySpeed;
    foldMap(family, s.familySpeed);
    foldMap(cls, s.classSpeed);
    if (s.rangeMul) rMul *= s.rangeMul;
    if (s.rangeAdd) rAdd += s.rangeAdd;
    if (s.padDmgMul) padDmg = s.padDmgMul;
    if (s.portals) sim._rulePortal = s.portals;
  }
  if (r.affinity) {
    const mul = r.def.always.affinityMul ?? r.def.active.affinityMul ?? 1;
    if (ATTACK_TYPE_IDS.has(r.affinity)) type[r.affinity] = (type[r.affinity] ?? 1) * mul;
    else el[r.affinity] = (el[r.affinity] ?? 1) * mul;
  }
  const hasPads = r.pads.length > 0 && padDmg > 0;
  if (all !== 1 || Object.keys(type).length || Object.keys(el).length || hasPads) sim._ruleMul = { all, type, el, pad: hasPads };
  if (moveAll !== 1 || Object.keys(family).length || Object.keys(cls).length) sim._ruleMove = { all: moveAll, family, cls };
  if (rMul !== 1 || rAdd !== 0 || (r.pads.length > 0 && padRangeAdd(r) > 0)) sim._ruleRange = { mul: rMul, add: rAdd, pad: r.pads.length > 0 };
}

function padRangeAdd(r) {
  return r.def.always.padRangeAdd ?? r.def.active.padRangeAdd ?? 0;
}

function padDmgMul(r) {
  return r.def.always.padDmgMul ?? r.def.active.padDmgMul ?? 1;
}

/** Hit scale from the rule tables (a girl's direct hit, trap or drone shot). */
export function ruleHitScale(m, tower, type, el) {
  let s = m.all;
  const t = m.type[type];
  if (t) s *= t;
  if (el) {
    const e = m.el[el];
    if (e) s *= e;
  }
  if (m.pad && tower && tower.padMul) s *= tower.padMul;
  return s;
}

/** DoT scale (element only: burn = fire, poison = poison). */
export function ruleDotScale(m, tower, kind) {
  let s = m.all;
  const e = m.el[kind === 'burn' ? 'fire' : 'poison'];
  if (e) s *= e;
  if (m.pad && tower && tower.padMul) s *= tower.padMul;
  return s;
}

/** Walk-speed multiplier for an enemy. */
export function ruleMoveMul(m, e) {
  let s = m.all;
  const f = e.family && m.family[e.family];
  if (f) s *= f;
  const c = m.cls[e.armorClass];
  if (c) s *= c;
  return s;
}

/** A girl's range inputs from the rule (and her pad): { mul, add }. */
export function ruleRangeFor(sim, t) {
  const rr = sim._ruleRange;
  if (!rr) return null;
  return { mul: rr.mul, add: rr.add + (rr.pad && t.padRangeAdd ? t.padRangeAdd : 0) };
}

/** One fixed step, right after grid.rebuild (vents see this step's spawns). */
export function ruleStep(sim, dt) {
  const r = sim.rule;
  if (sim.state !== 'wave') return;
  if (r.period) {
    const phase = sim._waveTick % r.period;
    const on = phase >= r.period - r.activeSteps;
    if (on !== r.active) {
      r.active = on;
      rebuildRuleTables(sim);
      sim._buffsDirty = true;
      sim._emit('ruleState', { id: r.id, active: on });
    }
  }
  sim._waveTick++;
  if (r.active && r.zoneDps > 0 && r.zones.length && !ruleNeutral(sim)) burnZones(sim, r, dt);
}

const VENT_STATUS = { attackType: 'blast', sourceUid: null };

function burnZones(sim, r, dt) {
  const amount = r.zoneDps * dt;
  const list = sim.enemies;
  const n = list.length;
  for (let i = 0; i < n; i++) {
    const e = list[i];
    if (e.dead || e.hidden || (e.airborne && !e.grounded) || e.elev > 0 || e.underDeck) continue;
    for (const z of r.zones) {
      const dx = e.x - z.x;
      const dy = e.y - z.y;
      if (dx * dx + dy * dy <= z.r * z.r) {
        sim._dot(e, 'burn', amount, VENT_STATUS);
        break;
      }
    }
  }
}

/** Wave start: resting, this wave's affinity, vent strength from the wave's enemy HP. */
export function ruleWaveStart(sim) {
  const r = sim.rule;
  const was = r.active;
  r.active = !r.period;
  const aff = r.def.always.affinity || r.def.active.affinity;
  r.affinity = aff && aff.length ? aff[(sim.wave - 1) % aff.length] : null;
  const dps = r.def.active.zoneDps || r.def.always.zoneDps || 0;
  r.zoneDps = dps * sim.enemyHpBase() * sim._waveHpMul;
  rebuildRuleTables(sim);
  sim._buffsDirty = true;
  if (was !== r.active) sim._emit('ruleState', { id: r.id, active: r.active });
}

/** Wave end: the calm point (clock 0, resting, vents cold, no affinity, tables rebuilt). */
export function ruleWaveEnd(sim) {
  const r = sim.rule;
  sim._waveTick = 0;
  const was = r.active;
  r.active = !r.period;
  r.zoneDps = 0;
  r.affinity = null;
  rebuildRuleTables(sim);
  sim._buffsDirty = true;
  if (was !== r.active) sim._emit('ruleState', { id: r.id, active: r.active });
}

/**
 * Economy effects (€) at a wave clear, before the calm point: bonusEvery coins and ult, and
 * livesPerWave. Only while wave ≤ the stage's goal.
 */
export function ruleWaveClear(sim) {
  const r = sim.rule;
  if (pastGoal(sim)) return;
  const sets = [r.def.always, r.def.active];
  for (const s of sets) {
    const b = s.bonusEvery;
    // (offset: Tryout Day counts a Subject's every-Nth clear from its period's start; absent everywhere else)
    if (b && b.n > 0 && (sim.wave - (b.offset || 0)) % b.n === 0) {
      if (b.coins) {
        const amount = sim._gainCash(b.coins * (sim.diff.cashMul ?? 1) * sim.cashScale * sim.incomeMul);
        if (amount > 0) sim._emit('cash', { amount, reason: 'rule', rule: r.id });
      }
      if (b.ult) {
        // every placed hero (both players' in co-op), never the view-dependent sim.hero: this runs
        // inside the step, where each client's sim.hero is its own player's (landing plan S6)
        for (const h of sim.heroes) {
          if (h && !h.removed && h.ultUnlocked && h.ultCooldown > 0) {
            h.ultCooldown = 0;
            sim._emit('ruleBonus', { id: r.id, kind: 'ult', towerUid: h.uid });
          }
        }
      }
    }
    if (s.livesPerWave && sim.canHeal() && sim.lives < sim.maxLives && sim.state === 'wave') {
      const before = sim.lives;
      sim.lives = Math.min(sim.maxLives, sim.lives + s.livesPerWave);
      sim._emit('ruleBonus', { id: r.id, kind: 'lives', amount: sim.lives - before });
    }
  }
}

/** Per-kill coin bonus (Heat Mirage), already × cash scale, difficulty and income. */
export function ruleBountyAdd(def, sim) {
  const add = def ? (def.always.bountyAdd || 0) + (def.active.bountyAdd || 0) : 0;
  return add ? add * (sim.diff.cashMul ?? 1) * sim.cashScale * sim.incomeMul : 0;
}

/**
 * Crystal pad owners: for each pad in order, the lowest-uid girl whose centre is inside it and who
 * owns no earlier pad. Sets padIndex / onPad / padMul / padRangeAdd; a change sets _buffsDirty.
 */
export function assignPads(sim) {
  // Tryout Day keeps stored seat holders (src/sim/tryout/breaks.js assignSeats)
  if (sim.tryout) return sim.tryoutSeats();
  const r = sim.rule;
  if (!r || !r.pads.length) return;
  const owner = new Map();
  r.pads.forEach((p, i) => {
    let best = null;
    const r2 = p.r * p.r;
    for (const t of sim.towers) {
      if (owner.has(t)) continue;
      const dx = t.x - p.x;
      const dy = t.y - p.y;
      if (dx * dx + dy * dy > r2) continue;
      if (!best || t.uid < best.uid) best = t;
    }
    if (best) owner.set(best, i);
  });
  const dmg = padDmgMul(r);
  const add = padRangeAdd(r);
  for (const t of sim.towers) {
    const i = owner.has(t) ? owner.get(t) : -1;
    if ((t.padIndex ?? -1) === i) continue;
    t.padIndex = i;
    t.onPad = i >= 0;
    t.padMul = i >= 0 ? dmg : 1;
    t.padRangeAdd = i >= 0 ? add : 0;
    sim._buffsDirty = true;
  }
}

/** Star rift: an ordinary wave spawn jumps ahead once, at `at` of its path. */
export function ruleRift(sim, e, path) {
  const p = sim._rulePortal;
  if (e.rifted || e.parentUid != null || (e.tier !== 'normal' && e.tier !== 'elite')) return;
  if (e.dist < p.at * path.length) return;
  e.rifted = true;
  const x = e.x;
  const y = e.y;
  e.dist = Math.min(path.length - 0.05, e.dist + p.jump * path.length);
  placeOnPath(e, path);
  sim._emit('rift', { uid: e.uid, x, y, x2: e.x, y2: e.y });
}

/** HUD data: numbers and ids only. */
export function ruleInfo(sim) {
  const r = sim.rule;
  if (!r) return null;
  const inWave = sim.state === 'wave';
  let secondsToFlip = 0;
  if (r.period) {
    if (inWave) {
      const phase = sim._waveTick % r.period;
      const rest = r.period - r.activeSteps;
      secondsToFlip = (phase >= rest ? r.period - phase : rest - phase) / STEPS_PER_S;
    } else secondsToFlip = (r.period - r.activeSteps) / STEPS_PER_S;
  }
  const owners = new Map();
  for (const t of sim.towers) if (t.onPad) owners.set(t.padIndex, t.uid);
  return {
    id: r.id,
    cycle: r.def.cycle,
    period: r.period / STEPS_PER_S,
    active: r.active,
    inWave,
    secondsToFlip,
    affinity: r.affinity,
    zones: r.zones.map((z) => ({ x: z.x, y: z.y, r: z.r })),
    pads: r.pads.map((p, i) => ({ x: p.x, y: p.y, r: p.r, ownerUid: owners.get(i) ?? null })),
    portals: r.def.always.portals || null,
    pastGoal: pastGoal(sim, sim.wave + (inWave ? 0 : 1)),
    neutral: ruleNeutral(sim),
  };
}

/** Affinity of wave n (Shifting Stars), for the scout and popover. */
export function ruleAffinityFor(sim, n) {
  const r = sim.rule;
  const aff = r && (r.def.always.affinity || r.def.active.affinity);
  return aff && aff.length && n >= 1 ? aff[(n - 1) % aff.length] : null;
}
