// Activated abilities in battle: "ults for towers" (docs: ABILITIES_SPEC §3–§6, milestone A1).
//
// Every tower girl learns one ability at tier 3 of her ⚡ path (tier 5 upgrades it) and every hero a
// quick skill at Lv 7 (ranked up at Lv 17); the numbers are data (src/data/abilities.js, attached as
// paths[k].ability / hero.skill). This file is the only sim code that reads them.
//
// Rules (spec §3):
//   - Cooldowns charge only while a wave runs, in integer charge points (ABILITY_RULES.chargePerTick a
//     tick; Skill Haste speeds every kind but rally and debuff at half rate; Ouka's office, t.rules.cdCut,
//     multiplies it by 1 + cut, and a map-scope shared entry takes the largest cut among its player's
//     copies). A fresh ability starts with 1/3 of its cooldown left; an econ ability starts empty.
//   - Casting works only in a wave. A refusal never spends the cooldown; its reason, in order:
//     ended, locked, notYours, notWave, disabled, moving, active, cooldown, cap, noIncome, noTarget.
//   - Local abilities have one cooldown per girl; map-scope ones one per player for that ability too
//     (sim.abilGroups, key "<owner>|<id>"). A group cast fires the best ready copy of her player's,
//     even while the selected copy is still locked.
//   - Lasting effects (boosts, rallies, queued shells, the A4 deploys of src/sim/deploys.js: shadow doubles,
//     Bell Carpet traps, surge drones) end at the wave clear and when she is sold, so
//     a calm point between waves never holds one (battle saves and co-op checkpoints stay simple).
//   - Minibosses and bosses shrug off ability freezes and stuns for ccGuardTicks after one lands.
//   - Coins go to the caster's owner (sim._gainCashFor: owner-credited coins, GAPS P-16).
//   - An ability that acts on one girl (a rally with `target: 'girl'`) takes the cast's aim point: the
//     girl nearest it within ABILITY_RULES.girlAimRadius (any player's, never the caster; ties: the
//     lower uid), else its own pick rule (the girl in her range who dealt the most damage). Co-op's
//     `abil` command carries the aim quantized, so every client resolves the same girl (spec §7.2).
//   - Auto-cast (per girl; the setting is sim.abilityAutoDefault, default Off) runs inside the step.
//
// Determinism (co-op lockstep): integer ticks and charge points, no rng (ability hits never crit,
// their statuses never roll), stable target orders (grid cell order, stable sorts, uid tie breaks),
// only + − × ÷, floor / round / ceil / min / max and squared distances. Lifetimes are countdowns; the
// step number (auto-cast stagger, the CC guard) is round(sim.time / STEP), the drones' precedent.
// Nothing here reads the view getters sim.hero / sim.heroConfig: a girl's player is t.owner.
//
// State (all plain data, so the generic snapshot stores it):
//   t.abil      { id, kind, scope, cdMax, cd, rate, active, auto, t5, n }  — created when she unlocks
//   t.mirrors   Iroha's mirrors (derived from t.mirrorAim, her tiers and the road; src/sim/mirrors.js)
//   t.abilMods  a running boost's ModSet, or a strike's boost tail (`after`: Zero Point); null otherwise
//               (resolved last, src/sim/mods.js `extra`)
//   sim.abilGroups  Map "<owner>|<id>" → { cd, cdMax, rate }   (map scope; deleted once charged)
//   sim.abilUses    econ casts per player this wave
//   sim._rallies    [{ src, owner, r2, map, dmgMul, rateMul, rangeMul, detection, ward, left, to?, pierceAdd?, life? }]
//                   (to: the one girl a girl-target rally reaches; pierceAdd: Ouka's Assembly Bell;
//                   life { every, r2, max, kills, given }: Noa's First Aid Call, counted by abilityKill)
//   sim._abilQueue  [{ left, src, id, kind: 'hit'|'shell'|'horizon', … }]  delayed hits and shells, FIFO; a
//                   'horizon' (Critical Mass · Event Horizon, the LR form) pulls its area every tick it waits:
//                   { x, y, r, anchors: [{ pathIndex, dist }], pull, spec, hits, scale }
//   sim._abilOn     girls with an unlocked ability (the step skips all of this while 0)
//   e.abilCc        (bosses and minibosses only) the step until which ability CC is ignored

import { ABILITY_RULES, abilityAtTier, skillAtLevel, abilityRuns, abilityWithLr } from '../data/abilities.js';
import { abilityChargePerTick, firstBellCharge } from './gearRules.js';
import { STEP, ABILITY_SCATTER, DOT_PCT_BOSS_MUL, PRISM_SHARDS, KNOCKBACK_RESIST, PUSH_LOCK, WELL_PULL_REACH } from './constants.js';
import { selectTargets, topTargets, gatherTargets, targetScore, recomputeBuffs, chainJump, chainNext, hasRoamingDrones } from './towers.js';
import { isEligible } from './combat.js';
import { isCaster, syncStatusFlags, placeOnPath } from './enemies.js';
import { spikeRain } from './strips.js';
import { emergencyDeploy } from './sentries.js';
import { laserWeb } from './mirrors.js';
import { shadowDoubles, bellCarpet, droneSurge, tickDeploys, endDeployWave, clearDeploys } from './deploys.js';
import { startRunner } from './runners.js';
import { samplePath } from './path.js';
import { anchorsAt, pullAlong } from './zones.js';

const R = ABILITY_RULES;

/** Seconds → whole ticks. */
const ticks = (s) => Math.round((s || 0) * R.ticksPerSecond);
/** Seconds → charge points. */
const points = (s) => ticks(s) * R.chargePerTick;
/** The current step number (the auto-cast stagger and the CC guard). */
const stepNo = (sim) => Math.round(sim.time / STEP);
const isBig = (e) => e.tier === 'boss' || e.tier === 'miniboss';
const isEliteUp = (e) => e.tier === 'elite' || e.tier === 'miniboss' || e.tier === 'boss';
/** Most target uids an `ability` event lists. */
const MAX_LISTED = 12;
/** Refusals a plan action or a later tap can wait out (the rest are final). */
export const TRANSIENT_REFUSALS = Object.freeze(['notWave', 'disabled', 'moving', 'active', 'cooldown', 'cap', 'noTarget']);

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

const T5_CACHE = new WeakMap();
const RANK_CACHE = new WeakMap();

const LR_CACHE = new WeakMap();

/**
 * A ⚡ path entry at a tier, with its LR form (`entry.lr`) on top when `lr` (her battle stats carry `lr: true`:
 * DUO_LR §2.4 Twin Star). Frozen and cached, so a girl's def is the same object from step to step.
 */
function mergedTower(entry, tier, lr = false) {
  let m = entry;
  if (tier >= 5 && entry.t5) {
    m = T5_CACHE.get(entry);
    if (!m) T5_CACHE.set(entry, (m = Object.freeze(abilityAtTier(entry, 5))));
  }
  if (!lr || !entry.lr) return m;
  let c = LR_CACHE.get(m);
  if (!c) LR_CACHE.set(m, (c = Object.freeze(abilityWithLr(m, entry, true))));
  return c;
}

/** Does her loadout entry carry the LR flag (src/systems/progression.js unitBattleStats sets it, G6)? */
export const isLr = (t) => t?.unitStats?.lr === true;

function mergedSkill(skill, level) {
  let n = 0;
  for (const r of skill.ranks || []) if (level >= r.level) n++;
  if (!n) return skill;
  let arr = RANK_CACHE.get(skill);
  if (!arr) RANK_CACHE.set(skill, (arr = []));
  return arr[n] || (arr[n] = Object.freeze(skillAtLevel(skill, level)));
}

/**
 * Where a girl's ability comes from: her ⚡ path entry (the first path whose tier reached its unlock
 * tier, else the first ⚡ path: the teaser) or a hero's skill.
 * @returns {{ entry: object, path: number, tier: number, unlockAt: number, unlocked: boolean }|null}
 */
export function abilitySource(t) {
  if (!t?.def) return null;
  if (t.isHero) {
    const skill = t.def.hero?.skill;
    if (!skill) return null;
    const at = skill.unlockLevel ?? 7;
    return { entry: skill, path: -1, tier: t.level || 0, unlockAt: at, unlocked: (t.level || 0) >= at };
  }
  const paths = t.def.paths || [];
  let first = null;
  for (let p = 0; p < paths.length; p++) {
    const entry = paths[p]?.ability;
    if (!entry) continue;
    const tier = t.tiers?.[p] || 0;
    const at = entry.unlockTier ?? 3;
    if (tier >= at) return { entry, path: p, tier, unlockAt: at, unlocked: true };
    if (!first) first = { entry, path: p, tier, unlockAt: at, unlocked: false };
  }
  return first;
}

/** The first path of a unit definition that carries a ⚡ ability (-1: none; heroes have none). */
export function abilityPathOf(def) {
  return (def?.paths || []).findIndex((p) => !!p?.ability);
}

/** Her ability as she has it now (the tier-5 / rank upgrade merged in), or null while it is locked. */
export function abilityDef(t) {
  const src = abilitySource(t);
  if (!src || !src.unlocked) return null;
  return t.isHero ? mergedSkill(src.entry, t.level) : mergedTower(src.entry, src.tier, isLr(t));
}

/**
 * Charge points a tick: Skill Haste (gear ultHaste) at half rate, never for rallies and debuffs. One rule for the
 * whole game: src/sim/gearRules.js abilityChargePerTick (round(100 / (1 − 0.5 × min(0.5, h))), 100 without haste).
 */
export function chargeRate(t, kind) {
  return abilityChargePerTick(t?.unitStats, kind);
}

const groupKey = (t, id) => `${t.owner ?? 0}|${id}`;

function groupOf(sim, t) {
  const a = t.abil;
  return a && a.scope === 'map' ? sim.abilGroups.get(groupKey(t, a.id)) || null : null;
}

/**
 * Charge points a tick under Ouka's office (src/sim/hubs.js, t.rules.cdCut): round(rate × (1 + cut)) — 115 for an
 * unhasted girl at Club Mentors' 15 % — or the plain rate without one.
 */
const chargedRate = (rate, cut) => (cut > 0 ? Math.round(rate * (1 + cut)) : rate);

/**
 * The office cut a map-scope shared entry charges with: the largest cdCut among that player's living copies of the
 * ability (a max, so placement order never matters; t.rules is derived, so saves and checkpoints carry nothing new).
 */
function groupCut(sim, owner, id) {
  let cut = 0;
  for (const t of sim.towers) {
    const c = t.rules?.cdCut;
    if (!(c > cut) || t.removed || !t.abil || t.abil.id !== id || (t.owner ?? 0) !== owner) continue;
    cut = c;
  }
  return cut;
}

/** A shared entry's charge points a tick: its caster's rate under the best office among the copies. */
function groupRate(sim, key, g) {
  const bar = key.indexOf('|');
  return chargedRate(g.rate, groupCut(sim, Number(key.slice(0, bar)), key.slice(bar + 1)));
}

/**
 * Unlocks her ability (an `abilityUnlock` event; 1/3 of the cooldown left, econ empty) or keeps it up to
 * date after an upgrade or a hero level (tier 5 / rank: the cooldown left becomes min(left, new full)).
 * Kinds and types this build does not run yet (handlerOf: Ruri's 'carry' move, …) stay locked. Called on placement
 * and _refreshTower.
 */
export function syncAbility(sim, t) {
  const src = abilitySource(t);
  if (!src || !src.unlocked) return;
  const def = t.isHero ? mergedSkill(src.entry, t.level) : mergedTower(src.entry, src.tier, isLr(t));
  if (!handlerOf(def)) return;
  const cdMax = points(def.cooldown);
  const rate = chargeRate(t, def.kind);
  // (the tier-5 / rank upgrade; never the LR form, which is not an upgrade the panel marks)
  const up = t.isHero ? def !== src.entry : src.tier >= 5 && !!src.entry.t5;
  const a = t.abil;
  if (!a) {
    t.abil = {
      id: def.id, kind: def.kind, scope: def.scope, cdMax,
      cd: def.kind === 'econ' ? cdMax : Math.round(cdMax / R.initialShare),
      rate, active: 0, auto: !!sim.abilityAutoDefault?.[t.owner ?? 0], t5: up, n: 0,
    };
    t.abilMods = null;
    sim._abilOn++;
    sim._emit('abilityUnlock', { towerUid: t.uid, id: def.id, kind: def.kind, owner: t.owner ?? 0 });
    return;
  }
  a.rate = rate;
  if (a.cdMax !== cdMax) {
    a.cdMax = cdMax;
    if (a.cd > cdMax) a.cd = cdMax;
    const g = groupOf(sim, t);
    if (g && g.cd > cdMax) g.cd = cdMax;
  }
  if (up && !a.t5) {
    a.t5 = true;
    sim._emit('abilityUpgrade', { towerUid: t.uid, id: a.id });
  }
}

// ---------------------------------------------------------------------------
// Reach, targets and the hit spec
// ---------------------------------------------------------------------------

/** Radius of a rally (her aura's reach for `inAura`; her range for a rally on one girl she picks). */
function rallyRadius(t, e) {
  if (!e) return 0;
  if (e.target === 'girl') return t.eff.range;
  if (e.radius === 'map') return Infinity; // every girl on the map (Ouka's Assembly Bell)
  return e.inAura ? t.stats?.aura?.range || 0 : e.radius || 0;
}

/**
 * The girl a rally on one girl goes to (Wakaba's Time Out!; spec §7.2): the girl at the aim point
 * (aimedGirl: nearest it within ABILITY_RULES.girlAimRadius, any player's, never the caster; ties: the
 * lower uid), else her own pick (topDamageGirl: the girl in her range with the highest damageDealt; ties:
 * the lower uid). A malformed aim counts as none. Null: nobody.
 * @param {number[]|null} [aim] [x, y] in tiles
 */
export function rallyGirl(sim, t, aim = null) {
  return aimedGirl(sim, aimOf(aim), t.uid) || topDamageGirl(sim, t);
}

/** A burst's blast radius. */
function burstRadius(t, e) {
  return e.radiusMul ? e.radiusMul * t.eff.range : e.radius || 0;
}

/** How far an ability looks for enemies (Infinity = the whole map): auto-cast counts and group picks use it. */
export function abilityReach(t, def) {
  if (def.scope === 'map') return Infinity;
  const e = def.effect || {};
  switch (def.kind) {
    case 'strike': return e.reach === 'map' ? Infinity : (e.reachMul ?? 1) * t.eff.range + (e.reachAdd || 0);
    case 'burst': return e.at === 'self' ? burstRadius(t, e) : (e.reachMul ?? 1) * t.eff.range;
    case 'boost': return t.eff.range + (e.mods?.range || 0);
    case 'rally': return rallyRadius(t, e);
    case 'debuff': return (e.reachMul ?? 1) * t.eff.range + (e.reachAdd || 0);
    // (Laser Web: her mirror reach, where her mirrors stand; Drone Surge: her drones' reach)
    case 'deploy': return e.deploy === 'mirror' && t.stats?.relay ? t.stats.relay.reach : e.deploy === 'drone' ? droneReach(t) : (e.reachMul ?? 1) * t.eff.range;
    case 'move': return (e.reachMul ?? 1) * t.eff.range + (e.reachAdd || 0);
    default: return t.eff.range;
  }
}

/**
 * How far Drone Surge looks (Chika's drone reach; the auto rule's `reach: 'leash'`): her wing's leash plus the
 * drones' gun range around her, or the whole map while her wing flies Pursuit. The rule is one circle around
 * her in every other mode (Hold and Patrol points sit inside her signal range anyway): simple and stable.
 */
export function droneReach(t) {
  const ts = t.turretSpec;
  if (!ts || !(ts.leash > 0)) return t.eff.range;
  if (t.flight?.mode === 'pursuit') return Infinity;
  return ts.leash + ts.range;
}

/**
 * Where an ability looks and strikes from: her relay origin (t.ox / t.oy) for `fromOrigin` (Ruri's Kon: her range
 * ring is centred on him), else where she stands. Writes into `out` (no allocation).
 */
function castFrom(t, def, out) {
  const from = !!def.effect?.fromOrigin && t.ox != null;
  out.x = from ? t.ox : t.x;
  out.y = from ? t.oy : t.y;
  return out;
}
const FROM = { x: 0, y: 0 };

/**
 * Where her ability looks from, as a fresh { x, y } (castFrom, for the UI): the hold card's and the aim's reach ring
 * are centred where the sim really picks targets (Kon's spot for Moon Pounce, else where she stands).
 */
export function abilityOrigin(t, def) {
  return castFrom(t, def, { x: 0, y: 0 });
}

/**
 * Her ability's hit spec, modelled on the hero ult's: dmgMul × her current hit, no crit, her armor pen
 * plus the effect's (99 = ignores armor), her elite / boss / barrier multipliers, Veil Sight for map
 * scope or when she has it. Statuses are applied apart (certain, through the CC guard).
 */
export function abilitySpec(t, def) {
  const s = t.eff;
  const e = def.effect || {};
  return {
    damage: (e.dmgMul || 0) * s.damage,
    attackType: s.attackType,
    element: s.element || null,
    critChance: 0,
    critMul: 1,
    armorPen: (s.armorPen || 0) + (e.armorPen || 0),
    eliteMul: s.eliteMul ?? 1,
    bossMul: s.bossMul ?? 1,
    barrierMul: s.barrierMul ?? 1,
    detection: def.scope === 'map' || !!s.detection,
    canHitAir: e.hitsAir ?? s.canHitAir,
    status: [],
    mark: null,
    silence: 0,
    reveal: 0,
    knockback: e.knockback || 0,
  };
}

/** Every live enemy outside the tunnels (map-wide debuffs ignore veils, like the hero ult). */
function mapPool(sim) {
  const out = [];
  for (const e of sim.enemies) if (!e.dead && !e.hidden) out.push(e);
  return out;
}

/** Enemies within `reach` of (x, y): eligible for `spec`, or every one outside the tunnels without one. */
function poolIn(sim, x, y, reach, spec) {
  if (reach === Infinity && !spec) return mapPool(sim);
  if (spec) return gatherTargets(sim, x, y, reach, spec, []);
  const out = sim.grid.query(x, y, reach, []);
  let n = 0;
  for (let i = 0; i < out.length; i++) if (!out[i].dead && !out[i].hidden) out[n++] = out[i];
  out.length = n;
  return out;
}

/** The best `k` of `list` by a target mode (stable: an earlier enemy wins a tie). */
function topOf(list, mode, x, y, k) {
  const out = [];
  const sc = [];
  for (const e of list) {
    const s = targetScore(mode, x, y, e);
    let j = out.length;
    if (j < k) {
      out.push(e);
      sc.push(s);
    } else if (s > sc[k - 1]) j = k - 1;
    else continue;
    while (j > 0 && sc[j - 1] < s) {
      out[j] = out[j - 1];
      sc[j] = sc[j - 1];
      j--;
    }
    out[j] = e;
    sc[j] = s;
  }
  return out;
}

/**
 * The densest crowd within `reach` of (x, y): of the first densestCap eligible enemies (grid order),
 * the one with the most of the others within r of it (ties: the smaller `remaining`, then the lower uid).
 * @returns {{ x: number, y: number, n: number }|null}
 */
export function densestPoint(sim, x, y, reach, spec, r) {
  const cands = gatherTargets(sim, x, y, reach, spec, []);
  if (!cands.length) return null;
  const n = Math.min(cands.length, R.densestCap);
  const r2 = r * r;
  let best = null;
  let bestN = -1;
  for (let i = 0; i < n; i++) {
    const a = cands[i];
    let k = 0;
    for (let j = 0; j < n; j++) {
      const dx = cands[j].x - a.x;
      const dy = cands[j].y - a.y;
      if (dx * dx + dy * dy <= r2) k++;
    }
    if (k > bestN || (k === bestN && (a.remaining < best.remaining || (a.remaining === best.remaining && a.uid < best.uid)))) {
      best = a;
      bestN = k;
    }
  }
  return { x: best.x, y: best.y, n: bestN };
}

/** At most MAX_LISTED uids (the `ability` event). */
const listed = (list) => list.slice(0, MAX_LISTED).map((e) => e.uid);

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

/**
 * An ability's statuses on one enemy (certain: no StatusSpec of an ability has a chance). A miniboss or
 * boss whose CC guard runs skips freeze and stun; one that lands starts the guard.
 */
function applyStatuses(sim, e, t, list, spec, step) {
  if (!list || !list.length || e.dead) return;
  const ctx = sim._statusCtx;
  ctx.element = spec.element || null;
  ctx.attackType = spec.attackType;
  ctx.sourceUid = t.uid;
  // a curse bursts for burstMul × her current hit (Ena's Omen Card), as a first-generation curse; no other status
  // reads these two
  ctx.hitDamage = t.eff.damage || 0;
  ctx.curseDepth = 0;
  const big = isBig(e);
  const guarded = big && (e.abilCc ?? -1) > step;
  let landed = false;
  for (const s of list) {
    const cc = s.type === 'freeze' || s.type === 'stun' || s.type === 'hold';
    if (cc && guarded) continue;
    if (sim._applyStatusEvent(e, s, ctx) && cc) landed = true;
  }
  if (big && landed) e.abilCc = step + R.ccGuardTicks;
  syncStatusFlags(e);
}

/** A strike's statuses on enemy `v`: none on a boss with `noBossStatus` (Moon Pounce's hold), else the effect's. */
const statusFor = (e, v) => (e.noBossStatus && v.tier === 'boss' ? null : e.status);

/** `hits` strikes on one enemy (each at `scale`), then the statuses if it still stands. */
function strikeOne(sim, t, e, spec, hits, scale, status, step) {
  for (let k = 0; k < hits && !e.dead; k++) sim._hit(e, t, spec, scale);
  if (!e.dead) applyStatuses(sim, e, t, status, spec, step);
}

/**
 * One struck enemy (strikeOne). With `splash` (any pick but 'poisoned', which detonates instead) the
 * strike is a blast: every other eligible enemy within `splash` of where the struck one stood takes the
 * same strikes × splashShare (default 1, the full hit) and the statuses, in grid order. Without it this
 * is exactly strikeOne.
 */
function strikeAt(sim, t, v, spec, hits, scale, e, step) {
  const r = e.pick !== 'poisoned' && e.splash > 0 ? e.splash : 0;
  const x = v.x;
  const y = v.y;
  strikeOne(sim, t, v, spec, hits, scale, statusFor(e, v), step);
  if (!(r > 0)) return;
  const share = scale * (e.splashShare ?? 1);
  for (const o of sim.grid.query(x, y, r, [])) {
    if (o === v || o.dead || !isEligible(o, spec)) continue;
    strikeOne(sim, t, o, spec, hits, share, statusFor(e, o), step);
  }
  sim._emit('explode', { x, y, radius: r, element: spec.element || null, attackType: spec.attackType });
  if (e.horizon) startHorizon(sim, t, e.horizon, x, y, r, spec, hits, scale, step);
}

// ---------------------------------------------------------------------------
// Critical Mass · Event Horizon (Tenka's LR form, BANNERS §C.2): the blast collapses into a gravity pull on its
// area, then detonates again. Integer tick countdown in the ability queue (so the snapshot, the co-op hash, the
// wave clear and a sale all treat it like a queued shell); the pull is the well's rule (src/sim/zones.js pullAlong):
// by path distance toward the centre, never past it, × KNOCKBACK_RESIST of the tier (bosses stand firm,
// minibosses move at half), spending the freeplay knockback budget; hidden enemies (tunnels) are not pulled.
// ---------------------------------------------------------------------------

/**
 * Queues the pull at (x, y) radius r for horizon.time s; the detonation then hits everything eligible there for
 * horizon.share × the struck enemy's hit (the same strikes, no statuses). `abilityHorizon` tells the FX.
 */
function startHorizon(sim, t, h, x, y, r, spec, hits, scale, step) {
  const it = {
    left: ticks(h.time), src: t.uid, id: t.abil?.id || null, kind: 'horizon', x, y, r,
    anchors: anchorsAt(sim, x, y, r * r, []), pull: h.pull || 0, spec, hits, scale: scale * (h.share ?? 0.5),
  };
  sim._emit('abilityHorizon', { towerUid: t.uid, id: it.id, x, y, radius: r, time: h.time || 0 });
  if (it.left > 0) sim._abilQueue.push(it);
  else horizonBlast(sim, t, it, step);
}

/** The anchor distance on one path (-1: the area is not over that path). */
function anchorOn(anchors, pathIndex) {
  for (let i = 0; i < anchors.length; i++) if (anchors[i].pathIndex === pathIndex) return anchors[i].dist;
  return -1;
}

/** tickAbilities' enemies inside a pull (module level: emptied after each use). */
const PULLED = [];

/** One tick of a waiting horizon's pull on every enemy inside its radius, in grid order. */
function horizonPull(sim, it) {
  const amt = it.pull * STEP;
  if (!(amt > 0)) return;
  const reach = WELL_PULL_REACH * it.r;
  PULLED.length = 0;
  sim.grid.query(it.x, it.y, it.r, PULLED);
  for (let i = 0; i < PULLED.length; i++) {
    const e = PULLED[i];
    if (e.dead || e.hidden) continue;
    const k = KNOCKBACK_RESIST[e.tier] ?? 1;
    if (!(k > 0)) continue;
    const at = anchorOn(it.anchors, e.pathIndex);
    if (at >= 0) pullAlong(sim, e, at, amt * k, reach);
  }
  PULLED.length = 0;
}

/** The second detonation: every eligible enemy within r of the centre takes `hits` strikes at the queued scale. */
function horizonBlast(sim, t, it, step) {
  const spec = it.spec;
  let n = 0;
  for (const v of sim.grid.query(it.x, it.y, it.r, [])) {
    if (v.dead || !isEligible(v, spec)) continue;
    n++;
    strikeOne(sim, t, v, spec, it.hits, it.scale, null, step);
  }
  sim._emit('abilityShell', { towerUid: t.uid, id: it.id, x: it.x, y: it.y, radius: it.r, hits: n, horizon: true });
  sim._emit('explode', { x: it.x, y: it.y, radius: it.r, element: spec.element || null, attackType: spec.attackType });
}

/** A strike's boost tail (`after`: Zero Point): its ModSet on her for after.duration s (the cast sets `active`). */
function boostTail(sim, t, e, fx) {
  if (e.after?.mods) {
    t.abilMods = e.after.mods;
    sim._refreshTower(t);
  }
  return fx;
}

/** Ticks a cast stays active: its duration, or a strike's boost tail when that is longer. */
const activeTicks = (def) => Math.max(ticks(def.duration), ticks(def.effect?.after?.duration));

/** One area hit (a burst's shell): damage and knockback through _hit, then the statuses. */
function shellAt(sim, t, def, spec, x, y, r, step, finale = false, shard = false) {
  const victims = sim.grid.query(x, y, r, []);
  const dmg = spec.damage > 0;
  const status = def.effect.status;
  let n = 0;
  for (const v of victims) {
    if (v.dead || !isEligible(v, spec)) continue;
    n++;
    if (dmg) sim._hit(v, t, spec, 1);
    applyStatuses(sim, v, t, status, spec, step);
  }
  sim._emit('abilityShell', { towerUid: t.uid, id: def.id, x, y, radius: r, hits: n, ...(finale ? { finale: true } : null), ...(shard ? { shard: true } : null) });
  if (dmg) sim._emit('explode', { x, y, radius: r, element: spec.element || null, attackType: spec.attackType });
  return n;
}

/** Prismfall's shard spec: x her current hit, mystic, hits flyers (a burst's own hit spec otherwise). */
function prismSpec(spec, t, mul) {
  return { ...spec, damage: mul * t.eff.damage, attackType: 'mystic', element: null, canHitAir: true };
}

/**
 * One burst shell lands at (x, y) (shellAt), then its shards (Prismfall) at the fixed PRISM_SHARDS table, each a
 * small area hit with the ability's statuses; a finale shell says so on its event (the LR Twin Star).
 */
function landShell(sim, t, def, it, x, y, step) {
  shellAt(sim, t, def, it.spec, x, y, it.r, step, it.finale);
  const sh = it.shards;
  if (!sh) return;
  for (let k = 0; k < sh.n; k++) {
    const off = PRISM_SHARDS[k % PRISM_SHARDS.length];
    shellAt(sim, t, def, sh.spec, x + off[0], y + off[1], sh.r, step, false, true);
  }
}

/** Midori's Catalyst Burst: every poisoned target takes its remaining poison at once (× poisonMul) and the poison ends. */
function catalyst(sim, t, def, spec, targets, step) {
  const e = def.effect;
  const mul = e.poisonMul ?? 1;
  const share = e.splashShare ?? 0.5;
  const r = e.splash || 0;
  const credit = { attackType: spec.attackType, sourceUid: t.uid };
  let spread = null;
  if (e.spreadPoison > 0) {
    const own = (t.eff.status || []).find((s) => s.type === 'poison');
    if (own) spread = [{ type: 'poison', dps: own.dps || 0, ...(own.pct > 0 ? { pct: own.pct } : null), duration: e.spreadPoison }];
  }
  for (const v of targets) {
    const p = v.statuses.poison;
    if (v.dead || !p) continue;
    const per = (p.dps || 0) + (p.pct || 0) * v.maxHp * (isBig(v) ? DOT_PCT_BOSS_MUL : 1);
    const amount = per * Math.max(0, p.left) * mul;
    const x = v.x;
    const y = v.y;
    delete v.statuses.poison; // the poison ends (and cannot leap on from this kill)
    sim._dot(v, 'poison', amount, credit);
    if (!(r > 0)) continue;
    for (const o of sim.grid.query(x, y, r, [])) {
      if (o === v || o.dead || !isEligible(o, spec)) continue;
      sim._dot(o, 'poison', amount * share, credit);
      if (spread && !o.dead) applyStatuses(sim, o, t, spread, spec, step);
    }
  }
}

/**
 * A rally record (both players' girls in its radius, or every girl for a map rally; strongest per key wins,
 * src/sim/buffs.js). `to`: the uid of the one girl a girl-target rally reaches (radius 0; the record has no
 * `to` otherwise). `pierceAdd` only when the rally adds pierce (Ouka's Assembly Bell).
 */
function addRally(sim, t, e, radius, left, to = null) {
  const map = e.radius === 'map';
  sim._rallies.push({
    src: t.uid, owner: t.owner ?? 0, r2: map ? 0 : radius * radius, map,
    dmgMul: e.dmgMul ?? 1, rateMul: e.rateMul ?? 1, rangeMul: e.rangeMul ?? 1,
    // a ward blocks sabotage and the volatile slimes' tower stun (both read the cleanse, Sim._isCleansed);
    // stunImmune says the stun half of it (Noa's First Aid Call)
    detection: !!e.detection, ward: !!e.ward || !!e.stunImmune, left,
    ...(to != null ? { to } : null),
    ...(e.pierceAdd > 0 ? { pierceAdd: e.pierceAdd } : null),
    // lives while it runs (Noa's First Aid Call; abilityKill): her kill counter lives on the record, so it ends with
    // the rally (a calm point never holds one)
    ...(e.lifeEvery > 0 ? { life: { every: e.lifeEvery, r2: (e.lifeRadius || 0) * (e.lifeRadius || 0), max: e.lifeMax || 0, kills: 0, given: 0 } } : null),
  });
}

/** Is any enemy (outside the tunnels) within `r` of her? */
function enemyNear(sim, t, r) {
  AUTO_NEAR.length = 0;
  const near = sim.grid.query(t.x, t.y, r, AUTO_NEAR);
  let any = false;
  for (let i = 0; i < near.length && !any; i++) if (!near[i].dead && !near[i].hidden) any = true;
  AUTO_NEAR.length = 0;
  return any;
}

/**
 * The running life rally a kill (or a spot) at (x, y) belongs to: the first in sim._rallies order (the oldest cast)
 * whose caster is still on the board and whose lifeRadius holds the spot, either player's; `exceptSrc`: never that
 * girl's own. Null: none. Squared distances.
 */
function lifeRallyAt(sim, x, y, exceptSrc = -1) {
  for (const r of sim._rallies) {
    const L = r.life;
    if (!L || r.src === exceptSrc) continue;
    const c = sim.getTower(r.src);
    if (!c || c.removed) continue;
    const dx = x - c.x;
    const dy = y - c.y;
    if (dx * dx + dy * dy <= L.r2) return r;
  }
  return null;
}

/**
 * Sim._killEnemy, only while a rally runs (Noa's First Aid Call): a kill inside a life rally's lifeRadius of its
 * caster counts (either player's, any source); every `every` counted kills a life comes back — at most `max` a
 * cast, never above the starting lives, never where hearts cannot come back (sim.canHeal()), on a one-life mode or
 * without income (vines.js endVineWave's guard), only in a wave. A kill counts toward ONE life rally only: the oldest
 * running one that holds it (lifeRallyAt), even once that one has given its `max` — two calls on one spot (copies, or
 * both players' Noas) never count the same kills twice (spec §3.3: rallies never add up, the strongest wins).
 */
export function abilityKill(sim, e) {
  const r = lifeRallyAt(sim, e.x, e.y);
  if (!r) return;
  const L = r.life;
  if (L.given >= L.max) return;
  L.kills++;
  if (L.kills % L.every !== 0) return;
  if (sim.state !== 'wave' || !sim.canHeal() || sim.mode?.oneLife || sim.diff.noIncome || sim.lives >= sim.maxLives) return;
  const c = sim.getTower(r.src);
  sim.lives++;
  L.given++;
  sim._emit('lifeRestored', { towerUid: c.uid, lives: sim.lives, n: 1, id: abilityDef(c)?.id ?? null, owner: c.owner ?? 0 });
}

/**
 * The girl-target rule (spec §7.2): the girl nearest the aim point (x, y) within
 * ABILITY_RULES.girlAimRadius, any player's, never `exceptUid` (the caster); ties go to the lower uid.
 * No aim, or nobody there: null. Squared distances only.
 * @param {number[]|null} aim [x, y] in tiles
 */
export function aimedGirl(sim, aim, exceptUid = -1) {
  if (!aim) return null;
  const r2 = R.girlAimRadius * R.girlAimRadius;
  let best = null;
  let bestD = Infinity;
  for (const o of sim.towers) {
    if (o.removed || o.uid === exceptUid) continue;
    const dx = o.x - aim[0];
    const dy = o.y - aim[1];
    const d = dx * dx + dy * dy;
    if (d > r2) continue;
    if (d < bestD || (d === bestD && o.uid < best.uid)) {
      best = o;
      bestD = d;
    }
  }
  return best;
}

/** A girl-target ability's own pick: the other girl within her range who dealt the most damage (ties: the lower uid). */
function topDamageGirl(sim, t) {
  const r2 = t.eff.range * t.eff.range;
  let best = null;
  for (const o of sim.towers) {
    if (o === t || o.removed) continue;
    const dx = o.x - t.x;
    const dy = o.y - t.y;
    if (dx * dx + dy * dy > r2) continue;
    if (!best || o.damageDealt > best.damageDealt || (o.damageDealt === best.damageDealt && o.uid < best.uid)) best = o;
  }
  return best;
}

/** A cast's aim point: [x, y] with both finite, else null (no aim). */
function aimOf(aim) {
  return Array.isArray(aim) && aim.length >= 2 && Number.isFinite(aim[0]) && Number.isFinite(aim[1]) ? aim : null;
}

/** The other girls within `radius` of her (placement order). */
function alliesIn(sim, t, radius) {
  const r2 = radius * radius;
  const out = [];
  for (const o of sim.towers) {
    if (o === t || o.removed) continue;
    const dx = o.x - t.x;
    const dy = o.y - t.y;
    if (dx * dx + dy * dy <= r2) out.push(o);
  }
  return out;
}

/** A flyer still in the sky (not grounded). */
const inSky = (v) => !!v.airborne && !v.grounded;

/**
 * Kaze's Swoop (`pick: 'air'`): the flyers still in the sky among the eligible enemies in reach (map scope: the whole
 * map), in Priority order (casters, bosses, elites, then the lead; ties: grid order), at most `count`; with none up,
 * the `fallback` pick (`ground`: walkers and grounded flyers only), at most its own count.
 */
function airTargets(sim, x, y, reach, spec, e, count) {
  const pool = gatherTargets(sim, x, y, reach, spec, []);
  const fly = pool.filter(inSky);
  if (fly.length) return topOf(fly, 'elite', x, y, count);
  const fb = e.fallback;
  if (!fb) return [];
  const rest = fb.ground ? pool.filter((v) => !inSky(v)) : pool;
  const mode = fb.pick === 'strong' ? 'strong' : fb.pick === 'priority' ? 'elite' : 'first';
  return topOf(rest, mode, x, y, fb.count ?? count);
}

/**
 * Storm Lance (`pick: 'chain'`): the first enemy by her target mode within reach (ties: the lower uid), then each next
 * the nearest un-hit eligible enemy within her chain jump of the last one (src/sim/towers.js chainNext, the walk her
 * chain lightning takes; ties: the lower uid), `count` in all. Nothing is hit while the chain is drawn.
 */
function chainTargets(sim, t, x, y, reach, spec, count) {
  const pool = gatherTargets(sim, x, y, reach, spec, []);
  let first = null;
  let best = -Infinity;
  for (const v of pool) {
    const s = targetScore(t.targetMode, x, y, v);
    if (s > best || (s === best && v.uid < first.uid)) {
      best = s;
      first = v;
    }
  }
  if (!first) return [];
  const out = [first];
  const hit = new Set([first.uid]);
  const jump = chainJump(t.eff);
  for (let cur = first; out.length < count;) {
    cur = chainNext(sim, cur.x, cur.y, jump, spec, hit, true);
    if (!cur) break;
    hit.add(cur.uid);
    out.push(cur);
  }
  return out;
}

function strikeTargets(sim, t, def, spec) {
  const e = def.effect;
  const reach = abilityReach(t, def);
  // (a hero's Potential may add targets to her skill: Norika's Loud Whistle; absent on everyone else)
  const count = (e.count ?? Infinity) + (t.isHero && t.stats.skillCount > 0 ? t.stats.skillCount : 0);
  const { x, y } = castFrom(t, def, FROM);
  if (e.pick === 'poisoned') {
    const all = gatherTargets(sim, x, y, reach, spec, []);
    let n = 0;
    for (let i = 0; i < all.length; i++) if (all[i].statuses.poison) all[n++] = all[i];
    all.length = Math.min(n, count);
    return all;
  }
  if (e.pick === 'air') return airTargets(sim, x, y, reach, spec, e, Number.isFinite(count) ? count : 9999);
  if (e.pick === 'chain') return chainTargets(sim, t, x, y, reach, spec, Number.isFinite(count) ? count : 9999);
  const mode = e.pick === 'strong' ? 'strong' : e.pick === 'priority' ? 'elite' : t.targetMode;
  if (reach === Infinity) return topTargets(sim, x, y, Infinity, spec, mode, Number.isFinite(count) ? count : 9999, [], []);
  return selectTargets(sim, x, y, reach, spec, mode, Number.isFinite(count) ? count : 9999);
}

/**
 * The kinds A1 runs: cast(sim, t, def, step, aim) does the effect and returns what the `ability` event
 * shows ({ x, y, radius, targets }), or null when there is nothing to act on (refused `noTarget`, no
 * side effect); end(sim, t) undoes a lasting one. `aim` ([x, y] or null, malformed aims already dropped)
 * matters to an ability on one girl (the girl-target rule) and to Yuzuha's sentries (the edge spots nearest
 * it); A6 adds aimed points. The deploy and runner kinds go through DEPLOYS / RUNNERS (handlerOf); the move kind
 * runs its type from MOVES.
 */
const KINDS = {
  strike: {
    cast(sim, t, def, step) {
      const e = def.effect;
      const spec = abilitySpec(t, def);
      const targets = strikeTargets(sim, t, def, spec);
      if (!targets.length) return null;
      // (the event's point is where the strike comes from: Kon's spot for Moon Pounce; the targets in strike order)
      const from = castFrom(t, def, FROM);
      const fx = { x: from.x, y: from.y, radius: abilityReach(t, def), targets: listed(targets) };
      if (e.pick === 'poisoned') {
        catalyst(sim, t, def, spec, targets, step);
        return boostTail(sim, t, e, fx);
      }
      const ramp = t.eff.ramp;
      const scale = e.fullRamp && ramp ? 1 + ramp.max : 1;
      const hits = Math.max(1, e.hits || 1);
      const delay = ticks(e.delay);
      if (delay > 0) {
        // a telegraph: the reticles now, the shots `delay` later (on the same enemies, if they still stand)
        for (const v of targets) sim._abilQueue.push({ left: delay, src: t.uid, id: def.id, kind: 'hit', target: v, spec, hits, scale });
        sim._emit('abilityWarn', { towerUid: t.uid, id: def.id, x: targets[0].x, y: targets[0].y, radius: 0, delay: e.delay, targets: listed(targets) });
        return boostTail(sim, t, e, fx);
      }
      for (const v of targets) strikeAt(sim, t, v, spec, hits, scale, e, step);
      if (e.keepRamp && ramp && ramp.per > 0) {
        // her focus stays on the enemy she struck, at full ramp (src/sim/towers.js attackDuel)
        const v = targets[0];
        if (!v.dead) {
          const full = Math.ceil(ramp.max / ramp.per - 1e-9);
          t.rampStacks = t.rampTarget === v ? Math.max(t.rampStacks, full) : full;
          t.rampTarget = v;
        }
      }
      return boostTail(sim, t, e, fx);
    },
    end(sim, t) {
      // the boost tail ends (a strike without one has nothing to undo)
      if (t.abilMods) {
        t.abilMods = null;
        sim._refreshTower(t);
      }
    },
  },

  burst: {
    cast(sim, t, def, step, aim) {
      const e = def.effect;
      const spec = abilitySpec(t, def);
      const r = burstRadius(t, e);
      let p;
      if (e.at === 'self') {
        if (!gatherTargets(sim, t.x, t.y, r, spec, []).length) return null;
        p = { x: t.x, y: t.y };
      } else if (e.at === 'aim' && aim) {
        // the cast's aim point (Prismfall): refused with nothing there to hit (nothing spent)
        if (!gatherTargets(sim, aim[0], aim[1], r, spec, []).length) return null;
        p = { x: aim[0], y: aim[1] };
      } else if (e.at === 'aim' && t.aim && gatherTargets(sim, t.aim.x, t.aim.y, r, spec, []).length) {
        p = { x: t.aim.x, y: t.aim.y }; // her mortar's aim point, while something stands there
      } else {
        p = densestPoint(sim, t.x, t.y, abilityReach(t, def), spec, r);
        if (!p) return null;
      }
      const fx = { x: p.x, y: p.y, radius: r, targets: listed(gatherTargets(sim, p.x, p.y, r, spec, [])) };
      const shells = Math.max(1, e.shells || 1);
      const delay = ticks(e.delay);
      const every = ticks(e.every);
      const scatter = shells > 1 && !e.reaim;
      // Prismfall's prism: each shell splits into shards of light (mystic, they hit flyers), and the LR finale
      const shards = e.shards > 0 ? { n: Math.round(e.shards), r: e.shardRadius || 0.6, spec: prismSpec(spec, t, e.shardMul ?? 1) } : null;
      if (delay > 0 || shells > 1) sim._emit('abilityWarn', { towerUid: t.uid, id: def.id, x: p.x, y: p.y, radius: r, delay: e.delay || 0, shells });
      for (let i = 0; i < shells; i++) {
        const off = scatter ? ABILITY_SCATTER[i % ABILITY_SCATTER.length] : ABILITY_SCATTER[0];
        const it = { left: delay + i * every, src: t.uid, id: def.id, kind: 'shell', x: p.x + off[0], y: p.y + off[1], r, spec, reaim: !!e.reaim && i > 0, shards };
        if (it.left > 0) sim._abilQueue.push(it);
        else landShell(sim, t, def, it, it.x, it.y, step);
      }
      if (e.finale) {
        // the LR Twin Star: one more shell on the spot itself, `every` after the last
        const f = e.finale;
        const it = { left: delay + shells * every, src: t.uid, id: def.id, kind: 'shell', x: p.x, y: p.y, r: f.radius || r, spec: { ...spec, damage: (f.dmgMul || 0) * t.eff.damage }, reaim: false, shards: null, finale: true };
        if (it.left > 0) sim._abilQueue.push(it);
        else landShell(sim, t, def, it, it.x, it.y, step);
      }
      return fx;
    },
  },

  boost: {
    cast(sim, t, def) {
      const mods = def.effect.mods;
      const reach = abilityReach(t, def);
      if (!mods || !gatherTargets(sim, t.x, t.y, reach, t.eff, []).length) return null;
      t.abilMods = mods;
      sim._refreshTower(t);
      return { x: t.x, y: t.y, radius: t.eff.range, targets: [] };
    },
    end(sim, t) {
      t.abilMods = null;
      sim._refreshTower(t);
    },
  },

  rally: {
    cast(sim, t, def, step, aim) {
      const e = def.effect;
      if (e.target === 'girl') {
        // one girl (Wakaba's Time Out!): the aimed one (spec §7.2), else her own pick; she follows that girl,
        // not a radius (the event's radius is 0: no ring, its one target is listed)
        const g = rallyGirl(sim, t, aim);
        if (!g) return null;
        if (e.cleanse && g.disabled > 0) g.disabled = 0;
        addRally(sim, t, e, 0, ticks(def.duration), g.uid);
        recomputeBuffs(sim);
        return { x: g.x, y: g.y, radius: 0, targets: [g.uid] };
      }
      const r = rallyRadius(t, e);
      const allies = alliesIn(sim, t, r);
      // (a rally that brings lives back is worth casting alone while an enemy is close enough to count)
      if (!allies.length && !(e.lifeEvery > 0 && enemyNear(sim, t, e.lifeRadius || 0))) return null;
      // a cleanse clears sabotage now; a ward (in the rally) blocks new sabotage while it lasts
      if (e.cleanse) for (const o of allies) if (o.disabled > 0) o.disabled = 0;
      addRally(sim, t, e, r, ticks(def.duration));
      recomputeBuffs(sim);
      return { x: t.x, y: t.y, radius: r === Infinity ? 0 : r, targets: allies.slice(0, MAX_LISTED).map((o) => o.uid) };
    },
  },

  debuff: {
    cast(sim, t, def, step) {
      const e = def.effect;
      const spec = abilitySpec(t, def);
      const map = def.scope === 'map';
      let pool = map ? mapPool(sim) : poolIn(sim, t.x, t.y, abilityReach(t, def), null);
      if (e.pick === 'veiled') pool = pool.filter((v) => v.veiled);
      else if (e.pick === 'ground') {
        // (Chigusa's Overgrowth: walkers that are not bosses, her lead ones first)
        pool = pool.filter((v) => !v.airborne && v.tier !== 'boss');
        if (e.count != null && pool.length > e.count) pool = topOf(pool, 'first', t.x, t.y, e.count);
      }
      else if (e.pick === 'strong') pool = topOf(pool, 'strong', t.x, t.y, e.count ?? 9999);
      else if (e.count != null && pool.length > e.count) pool = topOf(pool, t.targetMode, t.x, t.y, e.count);
      if (!pool.length) return null;
      for (const v of pool) {
        applyStatuses(sim, v, t, e.status, spec, step);
        if (e.casterStatus && isCaster(v)) applyStatuses(sim, v, t, e.casterStatus, spec, step);
        if (e.dmgMul > 0 && !v.dead) sim._hit(v, t, spec, 1); // (Overgrowth: the vines squeeze)
      }
      if (e.rally) {
        addRally(sim, t, e.rally, rallyRadius(t, e.rally), ticks(def.duration));
        recomputeBuffs(sim);
      }
      return { x: t.x, y: t.y, radius: map ? 0 : abilityReach(t, def), targets: listed(pool) };
    },
  },

  move: {
    // one move type at a time (MOVES, by `effect.move`; handlerOf never hands a type that is not there to this)
    cast(sim, t, def, step, aim) {
      return MOVES[def.effect.move].cast(sim, t, def, step, aim);
    },
  },

  econ: {
    cast(sim, t, def) {
      const coins = (def.effect.coins || 0) * (sim.diff.cashMul ?? 1) * (sim.incomeMul ?? 1);
      const amount = sim._gainCashFor(t.owner ?? 0, coins);
      sim._emit('cash', { amount, reason: 'ability', towerUid: t.uid, owner: t.owner ?? 0 });
      return { x: t.x, y: t.y, radius: 0, targets: [], coins: amount };
    },
  },
};

/** The kinds this build runs (the others stay locked: their ⚡ teaser says they come later). */
export const ABILITY_KINDS_LIVE = Object.freeze(Object.keys(KINDS));

/** Is an enemy `spec` can hit within `reach` of her (Infinity: anywhere outside the tunnels)? */
function anyIn(sim, t, reach, spec) {
  if (!spec) return false;
  if (reach === Infinity) {
    for (const e of sim.enemies) if (!e.dead && !e.hidden && isEligible(e, spec)) return true;
    return false;
  }
  return gatherTargets(sim, t.x, t.y, reach, spec, []).length > 0;
}

/**
 * The deploy kind (ABILITIES_SPEC §4, A4) one object type at a time, by `effect.deploy`. A type that
 * is not here stays locked (every type in the data runs today: the A4 three, Azami's strips, Yuzuha's sentries and
 * Iroha's mirror). Each A4 cast is refused (`noTarget`, nothing spent) when no enemy its objects could hit is in
 * reach, or when nothing could be placed (no road in her range, the sim-wide cap full: src/sim/deploys.js); Laser
 * Web's rule is src/sim/mirrors.js laserWeb.
 */
const DEPLOYS = {
  // Kage's Shadow Doubles (src/sim/deploys.js): doubles on the road spots nearest the exit in her range
  // (at least `spacing` apart), throwing her current volley × dmgMul for the ability's duration
  double: {
    cast(sim, t, def) {
      const e = def.effect;
      const reach = abilityReach(t, def);
      if (!anyIn(sim, t, reach, abilitySpec(t, def))) return null;
      const placed = shadowDoubles(sim, t, { count: e.count, spacing: e.spacing ?? 1.5, dmgMul: e.dmgMul ?? 1, duration: def.duration });
      if (!placed.length) return null;
      return { x: t.x, y: t.y, radius: reach, targets: [], placed: placed.length };
    },
  },
  // Suzu's Bell Carpet (src/sim/deploys.js): extra traps spread evenly along the road in her range, beyond her
  // trap limit, armed after `arm` s; the ones still standing fizzle after the ability's duration
  trap: {
    cast(sim, t, def) {
      const e = def.effect;
      const reach = abilityReach(t, def);
      if (!anyIn(sim, t, reach, t.trapSpec)) return null;
      const placed = bellCarpet(sim, t, { count: e.count, arm: e.arm, duration: def.duration });
      if (!placed.length) return null;
      return { x: t.x, y: t.y, radius: reach, targets: [], placed: placed.length };
    },
  },
  // Chika's Drone Surge (src/sim/deploys.js): extra roaming drones beyond her limit for the ability's duration,
  // flying her current flight mode; refused with no enemy her drones can hit in her drone reach (droneReach)
  drone: {
    cast(sim, t, def) {
      if (!hasRoamingDrones(t)) return null;
      const reach = droneReach(t);
      if (!anyIn(sim, t, reach, t.turretSpec)) return null;
      const placed = droneSurge(sim, t, { count: def.effect.count, duration: def.duration });
      if (!placed.length) return null;
      return { x: t.x, y: t.y, radius: reach, targets: [], placed: placed.length };
    },
  },
  // Yuzuha's Emergency Deploy (src/sim/sentries.js): extra sentries at the edge spots nearest her aim
  // point, or nearest the lead enemy in her range; they live the ability's duration beyond her cap
  sentries: {
    cast(sim, t, def, step, aim) {
      const reach = abilityReach(t, def);
      const lead = topTargets(sim, t.x, t.y, reach, abilitySpec(t, def), 'first', 1, [], [])[0] || null;
      if (!lead) return null;
      const placed = emergencyDeploy(sim, t, { count: def.effect.count, ttl: def.duration }, aim, lead);
      if (!placed.length) return null;
      return { x: placed[0].x, y: placed[0].y, radius: reach, targets: [], placed: placed.length };
    },
  },
  // Iroha's Laser Web (src/sim/mirrors.js; the id is Mirror Shift's): beams join every pair of her mirrors for the
  // window (her t.abil.active; mirrors.js updateWebs hits) and her mirrors reflect allies' shots; tier 5 (Infinite
  // Reflection) reflects for good. Her mirrors stay put: an aim is ignored
  mirror: {
    cast(sim, t) {
      return laserWeb(sim, t);
    },
  },
  // Azami's Spike Rain (src/sim/strips.js): extra strips spread evenly along the road in her reach,
  // living the ability's duration; refused (nothing spent) with no ground enemy in reach
  strips: {
    cast(sim, t, def) {
      const e = def.effect;
      const reach = abilityReach(t, def);
      if (!gatherTargets(sim, t.x, t.y, reach, abilitySpec(t, def), []).length) return null;
      const pts = spikeRain(sim, t, { count: e.count, reach, hits: e.hits, ttl: def.duration, arm: e.arm });
      if (!pts.length) return null;
      return { x: t.x, y: t.y, radius: reach, targets: [], placed: pts.length };
    },
  },
};

/**
 * How far a move pushes enemy `v` (tiles): `push`; a miniboss `pushMiniboss` (default: push × KNOCKBACK_RESIST,
 * half); a boss never moves.
 */
function pushTiles(e, v) {
  if (v.tier === 'boss') return 0;
  if (v.tier === 'miniboss') return e.pushMiniboss ?? (e.push || 0) * (KNOCKBACK_RESIST.miniboss ?? 1);
  return e.push || 0;
}

/**
 * A move's push on one enemy: `tiles` back along its own path by path distance, clamped at the path start, through
 * the push lock (an enemy moved inside its PUSH_LOCK window stays put — unless the lock is the caster's own: one her
 * own gusts or gather set, e.pushLockBy === her uid; owner decision Oct 29, "no weak ults" — another girl's lock or an
 * ability's still holds; one this moves takes the lock, as an ability's: pushLockBy −1) and the freeplay push budget
 * (e.kbLeft, which pays only for the tiles it really moves). Returns the tiles moved (0: none).
 * Only − and min: no trig (placeOnPath reads the path's precomputed facing).
 */
function movePush(sim, v, tiles, ownUid) {
  if (!(tiles > 0) || v.dead || (v.pushLock > 0 && v.pushLockBy !== ownUid)) return 0;
  let amt = Math.min(tiles, v.dist);
  if (v.kbLeft != null) {
    amt = Math.min(amt, v.kbLeft);
    v.kbLeft -= amt;
  }
  if (!(amt > 0)) return 0;
  v.dist -= amt; // (amt = dist leaves exactly 0: the path start)
  placeOnPath(v, sim.pathData[v.pathIndex]);
  v.pushLock = PUSH_LOCK[v.tier] ?? PUSH_LOCK.normal;
  v.pushLockBy = -1;
  return amt;
}

/**
 * The move kind (ABILITIES_SPEC §4, A5) one move type at a time, by `effect.move`; a type that is not here stays
 * locked (Ruri's Star Snatch, 'carry', waits). A new type adds its entry here and to ABILITY_MOVES_RUN.
 */
const MOVES = {
  // Fuu's Backdraft Fan: every enemy her ability can reach but a boss (eligible for her hit spec: never in a tunnel,
  // a veiled one only with Veil Sight, flyers when she hits air) is blown back (pushTiles, movePush) and takes the
  // statuses (her flyers are grounded); one push-locked by another girl or an ability is not moved but still takes
  // them (her own gusts' locks never stop it: movePush). In uid order.
  // Refused (nothing spent) with no such enemy in reach.
  push: {
    cast(sim, t, def, step) {
      const e = def.effect;
      const spec = abilitySpec(t, def);
      const reach = abilityReach(t, def);
      const { x, y } = castFrom(t, def, FROM);
      let pool = gatherTargets(sim, x, y, reach, spec, []).filter((v) => v.tier !== 'boss');
      if (!pool.length) return null;
      if (e.count != null && pool.length > e.count) pool = topOf(pool, e.pick === 'first' ? 'first' : t.targetMode, x, y, e.count);
      pool.sort((a, b) => a.uid - b.uid);
      let moved = 0;
      for (const v of pool) {
        if (movePush(sim, v, pushTiles(e, v), t.uid) > 0) moved++;
        applyStatuses(sim, v, t, e.status, spec, step);
      }
      return { x, y, radius: reach, targets: listed(pool), moved };
    },
  },
};

/** Move types this build runs. */
export const ABILITY_MOVES_LIVE = Object.freeze(Object.keys(MOVES));

/**
 * The runner kind (ABILITIES_SPEC §4, A6) one runner type at a time, by `effect.runner`; a type that is
 * not here stays locked. Marumi's Giant Strike: a giant ball rolls from the road point nearest the exit
 * inside her range back toward the spawn on her nearest lane (Turkey Strike: every lane in her range,
 * all the way to the spawn), hitting every walker once (src/sim/runners.js).
 */
const RUNNERS = {
  giantBall: {
    cast(sim, t, def) {
      const e = def.effect;
      const reach = t.eff.range;
      const spec = { ...abilitySpec(t, def), canHitAir: false, pushLock: true };
      if (!gatherTargets(sim, t.x, t.y, reach, spec, []).length) return null;
      // per lane: the visible road point inside her reach nearest the exit, and the lane's nearest point to her
      const lanes = [];
      const r2 = reach * reach;
      for (const path of sim.pathData) {
        let entry = null;
        let near = Infinity;
        for (const s of samplePath(path, 0.25)) {
          if (s.hidden) continue;
          const dx = s.x - t.x;
          const dy = s.y - t.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < near) near = d2;
          if (d2 <= r2 && (!entry || s.d > entry.dist)) entry = { pathIndex: path.index, dist: s.d };
        }
        if (entry) lanes.push({ entry, near });
      }
      if (!lanes.length) return null;
      lanes.sort((a, b) => a.near - b.near || a.entry.pathIndex - b.entry.pathIndex);
      const use = e.allPaths ? lanes : lanes.slice(0, 1);
      for (const l of use) {
        const length = e.toSpawn ? l.entry.dist : Math.min(e.length, l.entry.dist);
        startRunner(sim, t, { length, time: Math.max(0.1, length / e.speed), segments: e.segments, gap: e.gap, runner: 'giantBall' }, spec, null, l.entry);
      }
      return { x: t.x, y: t.y, radius: reach, targets: [], placed: use.length };
    },
  },
};

/**
 * The code that runs an ability (null: this build does not run it yet). It refuses exactly what the data rule
 * abilityRuns refuses (src/data/abilities.js; a boost without `mods` too), so the UI, the tips and the gear table
 * never disagree with the sim (tests/sim/abilities.test.js runs both over every row, tier 5 and rank).
 */
export function handlerOf(def) {
  if (!abilityRuns(def)) return null;
  if (def.kind === 'deploy') return DEPLOYS[def.effect.deploy] || null;
  if (def.kind === 'runner') return RUNNERS[def.effect.runner] || null;
  if (def.kind === 'move') return MOVES[def.effect.move] ? KINDS.move : null;
  return KINDS[def.kind] || null;
}

/** Deploy object types this build runs. */
export const ABILITY_DEPLOYS_LIVE = Object.freeze(Object.keys(DEPLOYS));

// ---------------------------------------------------------------------------
// Casting
// ---------------------------------------------------------------------------

/** Why she cannot cast now (null = ready). The cast-time `noTarget` is the kind's to say. */
function refusal(sim, t) {
  if (sim.state === 'won' || sim.state === 'lost') return 'ended';
  const a = t?.abil;
  if (!a || t.removed) return 'locked';
  if (sim.state !== 'wave') return 'notWave';
  if (t.disabled > 0) return 'disabled';
  if (t.moveLock > 0) return 'moving';
  if (a.active > 0) return 'active';
  if (a.cd > 0 || (groupOf(sim, t)?.cd || 0) > 0) return 'cooldown';
  if (a.kind === 'econ') {
    if ((sim.abilUses[t.owner ?? 0] || 0) >= R.econCapPerWave) return 'cap';
    if (sim.diff.noIncome) return 'noIncome';
  }
  return null;
}

/** Enemies her ability would find now (the group pick's measure). */
function enemiesInReach(sim, t, def) {
  const reach = abilityReach(t, def);
  if (reach === Infinity) return mapPool(sim).length;
  const { x, y } = castFrom(t, def, FROM);
  return poolIn(sim, x, y, reach, def.kind === 'rally' ? null : abilitySpec(t, def)).length;
}

/**
 * A group cast (one button for every copy): the selected copy when she is ready, else her player's
 * ready copy of the same girl with the most enemies in reach (ties: the lower uid). With no copy ready:
 * the selected copy (her refusal), or, while she is still locked, her player's first copy (placement
 * order) that has the ability; the selected copy (`locked`) only when no copy has it (spec §3.3).
 */
function pickCaster(sim, t) {
  if (!refusal(sim, t)) return t;
  const owner = t.owner ?? 0;
  let best = null;
  let bestN = -1;
  let held = t.abil ? t : null;
  for (const o of sim.towers) {
    if (o === t || o.removed || !o.abil || o.unitId !== t.unitId || (o.owner ?? 0) !== owner) continue;
    if (refusal(sim, o)) {
      if (!held) held = o;
      continue;
    }
    const n = enemiesInReach(sim, o, abilityDef(o));
    if (n > bestN || (n === bestN && o.uid < best.uid)) {
      best = o;
      bestN = n;
    }
  }
  return best || held || t;
}

const no = (reason, casterUid = null) => ({ ok: false, reason, casterUid });

/**
 * Fires her ability. `group`: the best ready copy of her player's (see pickCaster); `owner`: the
 * commanding player (co-op; a girl of another player is refused `notYours`); `auto`: an auto-cast;
 * `aim`: a point [x, y] (an ability on one girl takes the girl there: rallyGirl; Yuzuha's sentries land
 * nearest it). A refusal spends nothing.
 * @param {import('./Sim.js').Sim} sim
 * @param {object|null} t0 TowerRT
 * @param {{ group?: boolean, owner?: number|null, auto?: boolean, aim?: number[]|null }} [opts]
 * @returns {{ ok: boolean, reason: string|null, casterUid: number|null }}
 */
export function castAbility(sim, t0, { group = false, owner = null, auto = false, aim = null } = {}) {
  if (sim.state === 'won' || sim.state === 'lost') return no('ended');
  if (!t0 || t0.removed) return no('locked');
  // a group cast looks for a ready copy before it calls the selected one locked (pickCaster: no side effect)
  const t = group ? pickCaster(sim, t0) : t0;
  if (!t.abil) return no('locked');
  if (owner != null && (t0.owner ?? 0) !== owner) return no('notYours');
  const why = refusal(sim, t);
  if (why) return no(why, t.uid);
  const def = abilityDef(t);
  const step = stepNo(sim);
  const fx = handlerOf(def).cast(sim, t, def, step, aimOf(aim));
  if (!fx) return no('noTarget', t.uid);
  const a = t.abil;
  a.cd = a.cdMax;
  if (def.scope === 'map') sim.abilGroups.set(groupKey(t, a.id), { cd: a.cdMax, cdMax: a.cdMax, rate: a.rate });
  a.n++;
  const dur = activeTicks(def);
  if (dur > 0) a.active = dur;
  if (def.kind === 'econ') sim.abilUses[t.owner ?? 0] = (sim.abilUses[t.owner ?? 0] || 0) + 1;
  // results (created on the first cast, so a battle without one keeps its result() exactly)
  sim.stats.abilitiesUsed = (sim.stats.abilitiesUsed || 0) + 1;
  const by = sim.stats.abilityByTower || (sim.stats.abilityByTower = {});
  by[t.uid] = (by[t.uid] || 0) + 1;
  sim._emit('ability', {
    towerUid: t.uid, id: def.id, kind: def.kind, scope: def.scope, owner: t.owner ?? 0, auto: !!auto,
    // a map-wide reach is Infinity: the event says 0 (no ring), so JSON and the FX never see Infinity / NaN
    x: fx.x, y: fx.y, radius: Number.isFinite(fx.radius) ? fx.radius : 0, targets: fx.targets,
    ...(fx.coins != null ? { coins: fx.coins } : null),
    ...(fx.placed != null ? { placed: fx.placed } : null),
    ...(fx.moved != null ? { moved: fx.moved } : null),
    // (Laser Web: 'web', with its beam count)
    ...(fx.mirror != null ? { mirror: fx.mirror } : null),
  });
  return { ok: true, reason: null, casterUid: t.uid };
}

// ---------------------------------------------------------------------------
// Auto-cast
// ---------------------------------------------------------------------------

const progress = (sim, e) => {
  const len = sim.pathData[e.pathIndex]?.length || 1;
  return e.dist / len;
};

/** autoWants' grid scratch (module level: emptied before and after each use, never held between calls). */
const AUTO_NEAR = [];
/** The fields isEligible reads of her ability's hit spec (abilitySpec), refilled per call: no spec is built. */
const AUTO_ELIG = { attackType: null, detection: false, canHitAir: true };

/**
 * Is now a decent moment (the ability's `auto` rule)? Decent, not perfect: manual timing is better.
 * The pool (map reach: every enemy outside the tunnels; else the enemies within reach her ability can hit,
 * a rally's any outside the tunnels) is counted in place: this runs every 6th step for each auto girl
 * that is ready, so it allocates nothing.
 */
export function autoWants(sim, t, def) {
  const au = def.auto;
  if (!au) return false;
  const when = au.when;
  if (when === 'ready') return true;
  if (def.effect?.target === 'girl') {
    // a rally on one girl: enemies she can hit within the reach of the girl it would go to
    const g = rallyGirl(sim, t);
    if (!g) return false;
    AUTO_NEAR.length = 0;
    const near = sim.grid.query(g.x, g.y, g.eff.range, AUTO_NEAR);
    let n = 0;
    for (let i = 0; i < near.length; i++) if (!near[i].dead && isEligible(near[i], g.eff)) n++;
    AUTO_NEAR.length = 0;
    return n >= (au.min ?? 1);
  }
  const reach = abilityReach(t, def);
  if (when === 'cluster') return autoCluster(sim, t, def, au, reach);
  // 'sabotage' (Noa's First Aid Call): a girl inside her radius is sabotaged, whatever the enemies are doing
  if (when === 'sabotage' && sabotagedIn(sim, t, reach)) return true;
  // a life rally (First Aid Call) standing inside another girl's running one (a copy, or the partner's Noa): the kills
  // there are that call's (abilityKill), so hers would add nothing — Auto waits for it to end (a tap still casts)
  if (def.effect?.lifeEvery > 0 && lifeRallyAt(sim, t.x, t.y, t.uid)) return false;
  let list = sim.enemies;
  let elig = null;
  if (reach !== Infinity) {
    AUTO_NEAR.length = 0;
    const from = castFrom(t, def, FROM);
    list = sim.grid.query(from.x, from.y, reach, AUTO_NEAR);
  }
  // (Drone Surge in Pursuit looks over the whole map, yet still counts only what her drones can hit)
  if (reach !== Infinity || def.effect?.deploy === 'drone') {
    if (def.kind !== 'rally') {
      // abilitySpec's eligibility fields (a finite reach is never map scope: no free Veil Sight); Drone Surge
      // counts what her drones can hit, Bell Carpet what her traps can
      const src = def.effect?.deploy === 'drone' ? t.turretSpec || t.eff : def.effect?.deploy === 'trap' ? t.trapSpec || t.eff : t.eff;
      AUTO_ELIG.attackType = src.attackType;
      AUTO_ELIG.detection = !!src.detection;
      AUTO_ELIG.canHitAir = def.effect?.hitsAir ?? src.canHitAir;
      elig = AUTO_ELIG;
    }
  }
  const leakAt = when === 'leak' ? au.min ?? 0.7 : au.orLeak ?? null;
  let n = 0;
  let poisoned = 0;
  let elite = false;
  let caster = false;
  let veiled = false;
  let leak = false;
  let flyer = false;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.dead || e.hidden || (elig && !isEligible(e, elig))) continue;
    n++;
    if (!flyer && inSky(e)) flyer = true;
    if (!elite && isEliteUp(e)) elite = true;
    if (!caster && isCaster(e)) caster = true;
    if (!veiled && e.veiled && !e.revealed) veiled = true;
    if (e.statuses.poison) poisoned++;
    if (!leak && leakAt != null && progress(sim, e) >= leakAt) leak = true;
  }
  AUTO_NEAR.length = 0;
  if (!n) return false;
  switch (when) {
    case 'enemies':
      return n >= (au.min ?? 1) || (!!au.orElite && elite) || (au.orLeak != null && leak)
        || (!!au.orCaster && caster) || (!!au.orVeiled && veiled);
    case 'elite': return elite || (!!au.orCaster && caster) || (!!au.orVeiled && veiled);
    case 'caster': return caster || (!!au.orVeiled && veiled) || (!!au.orElite && elite);
    case 'veiled': return veiled;
    case 'poisoned': return poisoned >= (au.min ?? 1);
    case 'leak': return leak;
    case 'flyers': return flyer || n >= (au.min ?? Infinity) || (!!au.orElite && elite);
    case 'sabotage': return n >= (au.min ?? Infinity) || (!!au.orElite && elite);
    default: return false;
  }
}

/**
 * Auto 'cluster' (Prismfall): `min` enemies her ability can hit stand within `radius` of one of them
 * (densestPoint, map reach for a map-scope ability), or (`orBoss`) a boss is on the road outside the tunnels.
 */
function autoCluster(sim, t, def, au, reach) {
  if (au.orBoss) for (const e of sim.enemies) if (!e.dead && !e.hidden && e.tier === 'boss') return true;
  const p = densestPoint(sim, t.x, t.y, reach, abilitySpec(t, def), au.radius ?? 1.5);
  return !!p && p.n >= (au.min ?? 1);
}

/** Is a girl (any player's, not her) within `r` of her sabotaged now? (auto 'sabotage'; no allocation) */
function sabotagedIn(sim, t, r) {
  const r2 = r * r;
  for (const o of sim.towers) {
    if (o === t || o.removed || !(o.disabled > 0)) continue;
    const dx = o.x - t.x;
    const dy = o.y - t.y;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// The step, wave start / end, selling
// ---------------------------------------------------------------------------

/** An effect with no fields (a queued hit whose ability is gone). */
const NO_EFFECT = Object.freeze({});

function fireQueued(sim, it, step) {
  const t = sim.getTower(it.src);
  if (!t || t.removed) return;
  if (it.kind === 'horizon') {
    horizonBlast(sim, t, it, step);
    return;
  }
  if (it.kind === 'hit') {
    const v = it.target;
    if (!v || v.dead || !isEligible(v, it.spec)) {
      sim._emit('abilityFizzle', { towerUid: t.uid, id: it.id, uid: v ? v.uid : -1 });
      return;
    }
    const def = abilityDef(t);
    strikeAt(sim, t, v, it.spec, it.hits, it.scale, def?.effect || NO_EFFECT, step);
    return;
  }
  // a shell: on its spot, or re-aimed at the densest crowd now (Sango's Carpet Bombardment)
  const def = abilityDef(t);
  if (!def) return;
  let x = it.x;
  let y = it.y;
  if (it.reaim) {
    const p = densestPoint(sim, t.x, t.y, abilityReach(t, def), it.spec, it.r);
    if (!p) {
      sim._emit('abilityFizzle', { towerUid: t.uid, id: it.id, uid: -1 });
      return;
    }
    x = p.x;
    y = p.y;
  }
  landShell(sim, t, def, it, x, y, step);
}

/** tickAbilities' due hits and shells (module level: emptied before and after each use, never held between steps). */
const DUE = [];

/**
 * One step of abilities (Sim._step1, right after the buffs and before the girls attack; only in a
 * wave): 1. charge, 2. expire lasting effects, 3. run due queued hits and shells, 4. the deploys age and the
 * shadow doubles throw (src/sim/deploys.js), 5. auto-cast.
 */
export function tickAbilities(sim) {
  if (sim.state !== 'wave') return;
  const step = stepNo(sim);
  let mapCut = false;
  for (const t of sim.towers) {
    const a = t.abil;
    if (!a) continue;
    // Ouka's Club Mentors (src/sim/hubs.js): girls she covers charge faster (115 points a tick at 15%)
    const cut = t.rules?.cdCut > 0 ? t.rules.cdCut : 0;
    if (cut > 0 && a.scope === 'map') mapCut = true;
    if (!(a.cd > 0)) continue;
    a.cd = Math.max(0, a.cd - chargedRate(a.rate, cut));
    if (a.cd === 0 && !((groupOf(sim, t)?.cd || 0) > 0)) sim._emit('abilityReady', { towerUid: t.uid, id: a.id });
  }
  if (sim.abilGroups.size) {
    for (const [k, g] of sim.abilGroups) {
      // the shared entry (what blocks a map cast) gets the office too: the best cut among the player's copies
      g.cd = Math.max(0, g.cd - (mapCut ? groupRate(sim, k, g) : g.rate));
      if (g.cd === 0) {
        sim.abilGroups.delete(k);
        sim._emit('abilityReady', { group: k, id: k.slice(k.indexOf('|') + 1), owner: Number(k.slice(0, k.indexOf('|'))) });
      }
    }
  }
  for (const t of sim.towers) {
    const a = t.abil;
    if (!a || !(a.active > 0)) continue;
    a.active--;
    if (a.active === 0) {
      handlerOf(abilityDef(t))?.end?.(sim, t);
      sim._emit('abilityEnd', { towerUid: t.uid, id: a.id });
    }
  }
  if (sim._rallies.length) {
    let gone = false;
    for (const r of sim._rallies) if (--r.left <= 0) gone = true;
    if (gone) {
      sim._rallies = sim._rallies.filter((r) => r.left > 0);
      recomputeBuffs(sim);
    }
  }
  if (sim._abilQueue.length) {
    // every countdown, the queue closes up in place (FIFO kept), then the due ones fire in queue order
    const q = sim._abilQueue;
    DUE.length = 0;
    let n = 0;
    for (let i = 0; i < q.length; i++) {
      const it = q[i];
      // a waiting Event Horizon pulls on every tick it waits, its last one too (then it detonates)
      if (it.kind === 'horizon') horizonPull(sim, it);
      if (--it.left <= 0) DUE.push(it);
      else q[n++] = it;
    }
    q.length = n;
    for (let i = 0; i < DUE.length; i++) fireQueued(sim, DUE[i], step);
    DUE.length = 0;
  }
  // the A4 deploys: surge drones and shadow doubles age, then the doubles throw (src/sim/deploys.js)
  tickDeploys(sim);
  for (const t of sim.towers) {
    const a = t.abil;
    if (!a || !a.auto || (step + t.uid) % R.autoEvery !== 0 || refusal(sim, t)) continue;
    const def = abilityDef(t);
    if (def && autoWants(sim, t, def)) castAbility(sim, t, { auto: true });
  }
}

/**
 * First Bell (Bell Club's 3-piece trick, GEAR_STATS §C): the charge points her ability gains when a wave starts,
 * floor(10% of its full charge) — none for rallies and debuffs (src/sim/gearRules.js firstBellCharge). 0 for a girl
 * without the 3-piece set or without an unlocked ability.
 */
export function waveStartCharge(sim, t) { // eslint-disable-line no-unused-vars
  const a = t?.abil;
  return a ? firstBellCharge(t.unitStats, a.cdMax, a.kind) : 0;
}

/**
 * Wave start (Sim.startNextWave): every player's econ casts back to 0, then First Bell: each girl's own cooldown
 * gains her bell (towers in placement order); a map-scope ability's shared entry (one per player and ability)
 * gains the largest bell among that player's copies of it, once (a max: no order dependence). Integers only.
 */
export function startAbilityWave(sim) {
  for (let i = 0; i < sim.abilUses.length; i++) sim.abilUses[i] = 0;
  if (!sim._abilOn) return;
  for (const t of sim.towers) {
    const a = t.abil;
    if (!a || !(a.cd > 0) || t.removed) continue;
    const pts = waveStartCharge(sim, t);
    if (!(pts > 0)) continue;
    a.cd = Math.max(0, a.cd - pts);
    // (charged by the bell: the ready event the step would have sent; a shared entry still charging sends its own)
    if (a.cd === 0 && !((groupOf(sim, t)?.cd || 0) > 0)) sim._emit('abilityReady', { towerUid: t.uid, id: a.id });
  }
  if (!sim.abilGroups.size) return;
  for (const [k, g] of sim.abilGroups) {
    if (!(g.cd > 0)) continue;
    const bar = k.indexOf('|');
    const owner = Number(k.slice(0, bar));
    const id = k.slice(bar + 1);
    let best = 0;
    for (const t of sim.towers) {
      const a = t.abil;
      if (!a || t.removed || a.id !== id || (t.owner ?? 0) !== owner) continue;
      const pts = firstBellCharge(t.unitStats, g.cdMax, a.kind);
      if (pts > best) best = pts;
    }
    if (best > 0) g.cd = Math.max(0, g.cd - best);
  }
}

/**
 * Wave clear (Sim._checkWaveEnd, before 'between' / 'won'): every lasting effect ends (boosts give her
 * stats back, rallies and queued shells are dropped) and the buffs are rebuilt at once, so the calm
 * point holds none of it (battle saves, co-op checkpoints and their rederiveStats check).
 */
export function endAbilityWave(sim) {
  let touched = false;
  for (const t of sim.towers) {
    const a = t.abil;
    if (a && a.active > 0) {
      a.active = 0;
      handlerOf(abilityDef(t))?.end?.(sim, t);
      sim._emit('abilityEnd', { towerUid: t.uid, id: a.id, wave: true });
      touched = true;
    }
    if (t.abilMods) {
      t.abilMods = null;
      sim._refreshTower(t);
      touched = true;
    }
  }
  if (sim._rallies.length) {
    sim._rallies = [];
    touched = true;
  }
  if (sim._abilQueue.length) sim._abilQueue = [];
  // shadow doubles, Bell Carpet traps and surge drones (src/sim/deploys.js)
  endDeployWave(sim);
  if (touched) recomputeBuffs(sim);
}

/**
 * A girl leaves (sold): her rallies, queued shots and shadow doubles end with her (sellTower drops her traps and
 * drones itself, the Bell Carpet's and the surge's with them). sellTower rebuilds the buffs after.
 */
export function clearAbilityEffects(sim, t) {
  clearDeploys(sim, t);
  if (sim._rallies.length) sim._rallies = sim._rallies.filter((r) => r.src !== t.uid);
  if (sim._abilQueue.length) sim._abilQueue = sim._abilQueue.filter((it) => it.src !== t.uid);
  if (t.abilMods) t.abilMods = null;
  if (t.abil) {
    t.abil.active = 0;
    sim._abilOn = Math.max(0, sim._abilOn - 1);
  }
}

// ---------------------------------------------------------------------------
// Auto switches and the UI's read-only view
// ---------------------------------------------------------------------------

/** Her Auto switch. @returns {{ ok: boolean, reason: null|'locked' }} */
export function setAbilityAuto(sim, t, on) {
  if (!t?.abil || t.removed) return { ok: false, reason: 'locked' };
  t.abil.auto = !!on;
  return { ok: true, reason: null };
}

/**
 * A player's Auto-cast setting: every girl of hers with an ability (uids ascending) and the default
 * for the ones that unlock later. @returns {{ ok: true, reason: null, n: number }}
 */
export function setAbilityAutoAll(sim, owner, on) {
  const slot = owner ?? 0;
  sim.abilityAutoDefault[slot] = !!on;
  let n = 0;
  for (const t of [...sim.towers].sort((p, q) => p.uid - q.uid)) {
    if (!t.abil || (t.owner ?? 0) !== slot) continue;
    t.abil.auto = !!on;
    n++;
  }
  return { ok: true, reason: null, n };
}

const secs = (pts, rate) => (pts > 0 ? pts / (Math.max(1, rate) * R.ticksPerSecond) : 0);

/**
 * Her ability for the UI (read-only; allocates): null when she has none. A locked one is the teaser
 * (`unlocked: false`, the tier or level it needs; `later` for a kind this build does not run yet).
 */
export function abilityStatus(sim, t) {
  const src = abilitySource(t);
  if (!src) return null;
  const a = t.abil;
  if (!a) {
    const def = src.unlocked ? (t.isHero ? mergedSkill(src.entry, t.level) : mergedTower(src.entry, src.tier, isLr(t))) : src.entry;
    return {
      id: def.id, kind: def.kind, scope: def.scope, unlocked: false, ready: false, reason: 'locked', later: !handlerOf(def),
      path: src.path, unlockTier: t.isHero ? null : src.unlockAt, unlockLevel: t.isHero ? src.unlockAt : null,
      cooldown: def.cooldown, cooldownLeft: def.cooldown, duration: def.duration || 0, activeLeft: 0, auto: false, t5: false, uses: 0,
    };
  }
  const def = abilityDef(t);
  const g = groupOf(sim, t);
  const reason = refusal(sim, t);
  // real wave seconds: the points a tick the step charges (Ouka's office included; the shared entry's own rate)
  const rate = chargedRate(a.rate, t.rules?.cdCut > 0 ? t.rules.cdCut : 0);
  return {
    id: a.id, kind: a.kind, scope: a.scope, unlocked: true, ready: !reason, reason, later: false,
    path: src.path, unlockTier: t.isHero ? null : src.unlockAt, unlockLevel: t.isHero ? src.unlockAt : null,
    cooldown: secs(a.cdMax, rate), cooldownLeft: Math.max(secs(a.cd, rate), g ? secs(g.cd, groupRate(sim, groupKey(t, a.id), g)) : 0),
    duration: def ? activeTicks(def) / R.ticksPerSecond : 0, activeLeft: a.active / R.ticksPerSecond, auto: a.auto, t5: a.t5, uses: a.n,
    group: a.scope === 'map', charge: a.cdMax > 0 ? 1 - Math.max(a.cd, g?.cd || 0) / a.cdMax : 1,
  };
}

/**
 * The ability bar of a player (UI only; allocates): one slot per ability id, her tower girls only (a
 * hero's skill lives in the hero widget), in loadout order then placement order, copies grouped.
 * @returns {{ id: string, unitId: string, kind: string, scope: string, casters: number[], ready: number, best: object }[]}
 */
export function abilitySlots(sim, owner = 0) {
  const order = [...(sim.loadout?.keys?.() || [])];
  const slots = new Map();
  for (const t of sim.towers) {
    if (t.isHero || (t.owner ?? 0) !== owner || !t.abil) continue;
    let s = slots.get(t.abil.id);
    if (!s) slots.set(t.abil.id, (s = { id: t.abil.id, unitId: t.unitId, kind: t.abil.kind, scope: t.abil.scope, casters: [], ready: 0, best: null, firstUid: t.uid }));
    s.casters.push(t.uid);
    const st = abilityStatus(sim, t);
    if (st.ready) s.ready++;
    if (!s.best || (st.ready && !s.best.ready) || (!st.ready && !s.best.ready && st.cooldownLeft < s.best.cooldownLeft)) s.best = { ...st, towerUid: t.uid };
  }
  const idx = (u) => {
    const i = order.indexOf(u);
    return i < 0 ? order.length : i;
  };
  return [...slots.values()].sort((p, q) => idx(p.unitId) - idx(q.unitId) || p.firstUid - q.firstUid).map(({ firstUid, ...s }) => s);
}
