// Tower runtime: creation, stat resolution + aura buffs, targeting, the attack behaviors
// (projectile, pulse, duel, beam, chain, trap, turret, mortar), projectiles (travel, pierce,
// splash, swept collision), traps, turrets, mortar shells, aim points and relay origins
// (familiars / mirrors attack from a point near the lane: t.ox, t.oy).
//
// Uses these Sim members: time, state, rng, grid, enemies, towers, projectiles, traps, shells,
// pathData, map, globalRateMul, globalDmgMul, _scratch, _scratch2, _relaySamples, _nextUid(), _emit(),
// _hit(e, tower, spec, scale)

import { ATTACK_TYPES, ELEMENTS } from '../data/types.js';
import {
  TIER_RANK, CHAIN_JUMP_RANGE, BEAM_HALF_WIDTH, LINE_HALF_WIDTH, TURRET_PROJECTILE_SPEED, TURRET_RING,
  PROJECTILE_Z, STEP, DRONE_SLOTS, DRONE_STANDOFF, DRONE_RETHINK_STEPS, DRONE_IDLE_STEPS, DRONE_OPP_STEPS,
  DRONE_POOL_STEPS, FLIGHT_MODES, FLIGHT_SIGNAL_MUL, FLIGHT_POINT_ROAM_MUL, FLIGHT_PATROL_SPEED_MUL, FLIGHT_PURSUIT_RATE_MUL,
  MORTAR_DELAY, MORTAR_AIM_SLACK, MORTAR_SCATTER, FAMILIAR_STANDOFF, RELAY_SAMPLE_STEP,
  ROLE_TARGET_MODE,
} from './constants.js';
import { resolveStats, normalizeBase } from './mods.js';
import { isEligible } from './combat.js';
import { isCaster } from './enemies.js';
import { segDistSq, projectOnSegment, samplePath, pointAt } from './path.js';
import { applyBuffExtras, applyLimited, applyRallies, emptyBuffBy } from './buffs.js';
import { ruleRangeFor } from './rules.js';
import { buildProcSpecs, boostedAura } from './potential.js';
import { layStrip, stripStep, stripTick } from './strips.js';
import { attackRing, ringTick } from './rings.js';
import { attackWheel, attackSpin, wheelTick } from './wheels.js';
import { hitRadius } from './shapes.js';
import { throwDrink, drinkTick, useDrink } from './drinks.js';
import { sentryTick } from './sentries.js';
import { hubsOn, applyHubs } from './hubs.js';
import { vineTick } from './vines.js';
import { rollBall, ballTick } from './balls.js';
import { labMods } from './lab.js';
import { TRICK, THRUST_PEN, POP_COST, PULSE_MAX_EXTRA, trickClub, pierceCarry, pierceK, pierceMax, followThroughBlast } from './gearRules.js';

const WEAPON_KIND = {
  bow: 'arrow', rifle: 'bullet', cannon: 'shell', shuriken: 'shuriken', flask: 'flask', wrench: 'bolt',
  staff: 'orb', tome: 'orb', lantern: 'spark', bell: 'spark', gohei: 'spark', fan: 'needle', parasol: 'needle',
  trident: 'orb', rapier: 'needle', katana: 'shuriken', sword: 'shuriken', coinPurse: 'bullet',
  mic: 'spark', shield: 'spark', mirror: 'orb', spear: 'bolt', mallet: 'shuriken', puppet: 'needle', cards: 'shuriken',
  // the new girls (UNIT_GAPS §5)
  strip: 'arrow', needle: 'needle', tablet: 'bolt',
};
const TYPE_KIND = { blast: 'shell', pierce: 'arrow', slash: 'shuriken', mystic: 'orb', holy: 'spark' };
const ARC_KINDS = { shell: true, fireball: true, flask: true };

/** Visual projectile kind for a unit (from its weapon, element and attack type). */
export function projectileKind(def, stats) {
  let kind = WEAPON_KIND[def.look?.weapon] || TYPE_KIND[stats.attackType] || 'arrow';
  if ((kind === 'shell' || stats.attackType === 'blast') && stats.element === 'fire') kind = 'fireball';
  if (stats.element === 'lightning' && (kind === 'orb' || kind === 'bullet')) kind = 'bolt';
  return kind;
}

/** Enemy collision radius for projectiles/beams (src/sim/shapes.js). */
export { hitRadius };

function emptyBuff() {
  return { dmgMul: 1, rateMul: 1, rangeMul: 1, detection: false, costCut: 0, cleanse: false, armorPen: 0, critChance: 0, tea: 1 };
}

/**
 * Creates a TowerRT (contract fields + internals). Position is continuous world (x, y)
 * (free placement); `tx`/`ty` = the tile under the footprint centre (legacy consumers).
 * A caller that only passes `tx`/`ty` gets the tile centre.
 * @param {object} def UnitDef
 * @param {{ uid, x?, y?, tx?, ty?, radius?, isHero, unitStats, cost }} o
 */
export function createTower(def, o) {
  const x = o.x ?? (o.tx ?? 0) + 0.5;
  const y = o.y ?? (o.ty ?? 0) + 0.5;
  const t = {
    uid: o.uid,
    unitId: def.id,
    def,
    x,
    y,
    tx: Math.floor(x),
    ty: Math.floor(y),
    radius: o.radius ?? (o.isHero ? 0.5 : 0.42),
    isHero: !!o.isHero,
    owner: o.owner ?? 0, // player index (co-op: the 'place' command's slot, through placeTower's owner); 0 solo
    // buffs (src/sim/buffs.js): aura winner uid per key, the girl her brew / link should pick first (-1 auto),
    // what her own limited buff is doing, the brew / link she holds, her DPS over the last DPS_WINDOW s
    buffBy: emptyBuffBy(),
    buffPick: -1,
    lim: null,
    limIn: null,
    recentDps: 0,
    _dmgMark: 0,
    tiers: [0, 0, 0],
    targetMode: ROLE_TARGET_MODE[def.role] || 'first',
    targetUid: null,
    facing: 0,
    cooldown: 0,
    disabled: 0,
    buffed: false,
    level: o.isHero ? 1 : 0,
    xp: 0,
    kills: 0,
    damageDealt: 0,
    spent: o.cost || 0,
    turrets: [],
    // roaming drones: totals of every drone's hits (her own = damageDealt − droneDmg), the drone
    // numbering, and the wing's flight mode (null = Hover; setFlight / the co-op `fly` command)
    droneDmg: 0,
    droneKills: 0,
    droneShots: 0,
    droneSerial: 0,
    flight: null,
    // internals
    unitStats: o.unitStats,
    stats: null,
    eff: null,
    buff: emptyBuff(),
    trapSpec: null,
    turretSpec: null,
    trapCount: 0,
    trapSpots: null,
    trapSpotsRange: -1,
    rampTarget: null,
    rampStacks: 0,
    buildTimer: 0,
    // drone target pool (top candidates, reused for a few steps)
    _pool: null,
    _poolS: null,
    _poolLeft: 0,
    _poolMode: null,
    projKind: 'arrow',
    ultUnlocked: false,
    ultCooldown: 0,
    removed: false,
    // aim point (mortar / mirror / aimed hero ult) and relay origin (familiar / mirror)
    aim: null,
    origin: null,
    ox: x,
    oy: y,
  };
  return t;
}

/**
 * Her stats as her def, tiers, hero level / mastery, unitStats (her player's loadout entry) and a
 * running ability boost (`abilMods`, src/sim/abilities.js; null at every calm point) give them (pure;
 * no buffs). A restored co-op checkpoint is checked against it (lockstep.js).
 */
export function towerResolvedStats(t) {
  const o = { tiers: t.tiers, heroLevel: t.isHero ? t.level : 0, unitStats: t.unitStats, heroMastery: t.isHero ? t.mastery || 0 : 0, extra: t.abilMods || null };
  const s = resolveStats(t.def, o);
  // Tenka's lab team (src/sim/lab.js): her dps and support weapons from her lab record and her lab power,
  // after every tier and before a running boost (a girl without a lab resolves exactly as before)
  if (!t.lab || !s.lab) return s;
  const lm = labMods(t.lab, s.lab.power);
  if (!lm) return s;
  o.extra = t.abilMods ? [lm, t.abilMods] : lm;
  return resolveStats(t.def, o);
}

/** Re-resolves a tower's stats after an upgrade / hero level / placement. */
export function refreshTowerStats(t, globalRateMul = 1, globalDmgMul = 1) {
  t.stats = towerResolvedStats(t);
  t.projKind = projectileKind(t.def, t.stats);
  refreshEffective(t, globalRateMul, globalDmgMul);
}

function hitSpecFrom(s, extra) {
  return {
    damage: s.damage,
    attackType: s.attackType,
    element: s.element,
    critChance: s.crit.chance,
    critMul: s.crit.mul,
    armorPen: s.armorPen,
    eliteMul: s.eliteMul,
    bossMul: s.bossMul,
    barrierMul: s.barrierMul,
    detection: s.detection,
    canHitAir: s.canHitAir,
    status: s.status,
    mark: s.mark,
    silence: s.silence,
    reveal: s.reveal,
    knockback: s.knockback,
    // Potential N16 (Hotaru): × vs one armour class; only on a girl whose step sets it
    ...(s.classMul ? { classMul: s.classMul } : null),
    airMul: s.airMul,
    gather: s.gather,
    ...extra,
  };
}

/**
 * Builds tower.eff (stats × buffs × the global ult buffs) plus the trap and turret hit specs.
 * eff objects are never mutated after this: holding one is a snapshot (mortar shells do).
 */
export function refreshEffective(t, globalRateMul = 1, globalDmgMul = 1) {
  const s = t.stats;
  const b = t.buff;
  const detection = s.detection || b.detection;
  // map rule range (blizzard, heat haze, crystal pad): set by recomputeBuffs, absent without a rule
  const envMul = t.envRangeMul ?? 1;
  const envAdd = t.envRangeAdd ?? 0;
  const env = envMul !== 1 || envAdd !== 0;
  const dmgMul = b.dmgMul * globalDmgMul;
  t.eff = {
    ...s,
    damage: s.damage * dmgMul,
    rate: s.rate * b.rateMul * (b.tea || 1) * globalRateMul,
    range: env ? Math.max(1, (s.range + envAdd) * envMul) * b.rangeMul : s.range * b.rangeMul,
    detection,
    critChance: s.crit.chance,
    critMul: s.crit.mul,
  };
  // a rally's extra pierce (Ouka's Assembly Bell; absent otherwise)
  if (b.pierceAdd > 0) t.eff.pierce += b.pierceAdd;
  // Ouka's rules (src/sim/hubs.js): anti-air and a type-chart floor for the girls she covers
  const ru = t.rules;
  if (ru) {
    if (ru.airGrant) t.eff.canHitAir = true;
    if (ru.typeFloor > 0) t.eff.typeFloor = ru.typeFloor;
  }
  // Wakaba's drink (src/sim/drinks.js): on top of auras and rallies, while it lasts
  const hy = t.hydrated;
  if (hy) {
    t.eff.damage *= hy.dmgMul;
    t.eff.rate *= hy.rateMul;
    t.eff.range *= hy.rangeMul;
    t.eff.pierce += hy.pierce;
    if (hy.detection) t.eff.detection = true;
  }
  const trapStatus = s.trap ? mergeLists(s.trap.status, s.status) : null;
  t.trapSpec = s.trap ? hitSpecFrom(s, {
    damage: s.trap.damage * dmgMul,
    // spirit-revealing seals can trigger on veiled enemies
    detection: detection || s.reveal > 0 || trapStatus.some((x) => x.type === 'reveal'),
    canHitAir: false,
    critChance: 0,
    knockback: 0,
    gather: 0,
    status: trapStatus,
    triggerRadius: s.trap.triggerRadius,
    splash: s.trap.splash,
    armTime: s.trap.armTime,
  }) : null;
  if (s.strip) {
    // spike strips (src/sim/strips.js): Tall Barbs' flyer spec (the share is the hit's scale) and the
    // Charged Strips blast (its stun on top of the strip statuses)
    t.stripAirSpec = s.strip.air > 0 ? { ...t.trapSpec, canHitAir: true } : null;
    t.stripBoomSpec = s.strip.boom > 0 ? {
      ...t.trapSpec,
      damage: s.strip.boom * dmgMul,
      status: s.strip.boomStun > 0 ? mergeLists([{ type: 'stun', duration: s.strip.boomStun }], trapStatus) : trapStatus,
    } : null;
  }
  t.turretSpec = s.turret ? hitSpecFrom(s, {
    damage: s.turret.damage * dmgMul,
    rate: s.turret.rate * b.rateMul * (b.tea || 1) * globalRateMul,
    // map rules (landing plan S4): a roaming wing (leash > 0) takes the rule's additive range once, on
    // its roam radius, and its guns only the multiplier; anchored turrets use the girl's range formula
    range: s.turret.leash > 0
      ? (env ? s.turret.range * envMul * b.rangeMul : s.turret.range * b.rangeMul)
      : env ? Math.max(1, (s.turret.range + envAdd) * envMul) * b.rangeMul : s.turret.range * b.rangeMul,
    // roaming drones: roam radius, flight speed and seconds per drone, after buffs (build speed
    // follows attack-speed buffs, as it did when it rode on her attack rate)
    leash: s.turret.leash > 0 ? Math.max(1, env ? (s.turret.leash + envAdd) * envMul : s.turret.leash) * b.rangeMul : 0,
    speed: s.turret.speed,
    build: s.turret.build > 0 ? s.turret.build / Math.max(0.05, b.rateMul * globalRateMul) : 0,
    attackType: s.turret.attackType || s.attackType,
    detection,
    canHitAir: true,
    knockback: 0,
    gather: 0,
    status: mergeLists(s.turret.status, s.status),
    pierce: 1,
    splash: 0,
  }) : null;
  // Marumi's balls (src/sim/balls.js): they touch walkers only; the blast pushes with the push lock; pins
  // are plain light hits; her lob throws a lighter blast (× ball.lobMul) at flyers
  if (s.ball) {
    t.ballSpec = { ...t.eff, canHitAir: false };
    t.blastSpec = { ...t.eff, canHitAir: false, splash: 0, pierce: 1, pushLock: true, ...(s.ball.pushBig ? { pushBig: true } : null) };
    t.pinSpec = { ...t.eff, damage: s.ball.pinDmg * dmgMul, canHitAir: false, splash: 0, pierce: 1, knockback: 0, status: [], critChance: 0, mark: null };
    t.lobSpec = s.ball.lob ? { ...t.eff, damage: t.eff.damage * s.ball.lobMul, canHitAir: true, pierce: 1, knockback: 0 } : null;
  }
  // Chigusa's vine and thorn beds (src/sim/vines.js): ground-only hits from her stats, no crits or statuses
  if (s.vine) {
    const plain = { critChance: 0, canHitAir: false, status: [], splash: 0, knockback: 0, gather: 0, pierce: 1, mark: null, silence: 0, reveal: 0 };
    t.vineSpec = { ...t.eff, ...plain, damage: s.vine.dps * dmgMul };
    t.bedSpec = { ...t.eff, ...plain, damage: s.vine.bedDmg * dmgMul };
  }
  // Towel Snap (src/sim/drinks.js): a light flick that slows (her own hit is no drink at all)
  if (s.drink) t.towelSpec = s.drink.towel ? { ...t.eff, damage: s.drink.towelDmg * dmgMul, critChance: 0, status: [{ type: 'slow', amount: 0.3, duration: 1.5 }] } : null;
  // Yuzuha's sentries (src/sim/sentries.js): their guns follow her buffs; one spec per Specialist Kit
  if (s.sentry) {
    if (!t.sentries) {
      t.sentries = [];
      t.nets = [];
    }
    const se = s.sentry;
    const plain = {
      ...t.eff, damage: se.damage * dmgMul, rate: se.rate * b.rateMul * globalRateMul, range: se.range * b.rangeMul,
      pierce: 1, splash: 0, chain: 0, canHitAir: false, critChance: 0, knockback: 0, gather: 0, status: [], mark: null,
    };
    t.sentrySpecs = {
      plain,
      net: { ...plain, status: [{ type: 'slow', amount: 0.35, duration: 1 }] },
      flash: { ...plain, detection: true, reveal: 2, silence: 0.5 },
      heavy: { ...plain, damage: plain.damage * 3, rate: plain.rate * 0.5, eliteMul: plain.eliteMul * 1.3 },
      flak: { ...plain, canHitAir: true },
    };
    t.sentryBurstSpec = se.burst > 0 ? { ...plain, damage: se.burst * dmgMul } : null;
    t.netSpec = se.nets > 0 ? { ...t.eff, canHitAir: false, detection: false } : null;
  }
  // Orbit Scissors (src/sim/rings.js): their cuts follow her buffs like her pins
  if (s.ring && !t.rings) {
    t.rings = []; // her heat rings in flight (src/sim/rings.js)
    t.ringTurn = 0; // Twin Spools: sixteenths turned
  }
  if (s.ring) t.scissorSpec = s.ring.scissors > 0 ? { ...t.eff, damage: s.ring.scissorDmg * s.ring.scissorMul * dmgMul, canHitAir: true, critChance: 0 } : null;
  // Petal Halo (src/sim/wheels.js): the pieces only cut (her own attack keeps its statuses, marks, pushes and
  // crits), so a ring of fast cuts never stun-locks a crowd
  if (s.halo) t.haloSpec = { ...t.eff, status: [], procStatus: null, mark: null, silence: 0, reveal: 0, knockback: 0, gather: 0, critChance: 0 };
  applyBuffExtras(t, b);
  if (s.strip || s.sentry) deployCrits(t);
  // Potential's rhythm (src/sim/potential.js N3): its specs follow her effective stats and buffs
  if (s.proc) buildProcSpecs(t);
}

/**
 * Azami's strips (each strip hit, Tall Barbs' flyer hit, the Charged Strips blast) and Yuzuha's sentries (every
 * Specialist Kit and the Burst Cells burst) crit like her own hits: her effective crit chance (gear, Potential and
 * aura crit, after applyBuffExtras) and crit multiplier. Suzu's traps keep never critting (no `strip` block). The
 * roll is Sim._hit's: one sim.rng draw per hit with a crit chance, in the hit order the strips and sentries already
 * use, so every engine and every peer draws the same numbers; with no crit chance nothing is drawn (as before).
 * The specs were built just above in refreshEffective and nobody holds them yet.
 */
function deployCrits(t) {
  const chance = t.eff.critChance || 0;
  const mul = t.eff.critMul || 1;
  const set = (spec) => {
    if (!spec) return;
    spec.critChance = chance;
    spec.critMul = mul;
  };
  if (t.stats.strip) {
    set(t.trapSpec);
    set(t.stripAirSpec);
    set(t.stripBoomSpec);
  }
  if (t.stats.sentry && t.sentrySpecs) {
    for (const k of Object.keys(t.sentrySpecs)) set(t.sentrySpecs[k]);
    set(t.sentryBurstSpec);
  }
}

function mergeLists(a, b) {
  if (!b || !b.length) return a;
  if (!a || !a.length) return b;
  const types = new Set(a.map((s) => s.type));
  return [...a, ...b.filter((s) => !types.has(s.type))];
}

/**
 * Recomputes aura buffs (strongest source per key, no self-buff) and the global ult
 * rate buff. Disabled towers project no aura. Cleanse auras clear disables.
 * @returns {boolean} whether any tower's buff changed
 */
export function recomputeBuffs(sim) {
  const towers = sim.towers;
  let changed = false;
  // Ouka's campus hubs (src/sim/hubs.js): none in a battle without her, so nothing below changes then
  const hubs = hubsOn(sim);
  // (a flag for Sim._killEnemy; set only while a hub pays coins per kill)
  let bounty = false;
  for (let i = 0; i < hubs.length; i++) if (hubs[i].stats.hub.killBounty > 0) bounty = true;
  if (bounty) sim._hubBounty = true;
  else if (sim._hubBounty) delete sim._hubBounty;
  const tea = secondCupTargets(towers);
  for (const t of towers) {
    const nb = emptyBuff();
    if (tea && tea.has(t)) nb.tea = TRICK.secondCup.rateMul;
    // who won each key (the buff icons): a strictly stronger aura replaces the winner, so ties go to the
    // girl placed first
    const by = t.buffBy || (t.buffBy = emptyBuffBy());
    by.dmg = by.rate = by.range = by.pen = by.crit = by.det = by.cost = by.cleanse = by.rally = -1;
    for (const a of towers) {
      if (a === t || !a.stats?.aura || a.disabled > 0) continue;
      // (a Potential rhythm's aura boost runs: her aura numbers × the boost, src/sim/potential.js)
      const au = a.auraBoostLeft > 0 ? boostedAura(a) : a.stats.aura;
      const dx = a.x - t.x;
      const dy = a.y - t.y;
      if (dx * dx + dy * dy > au.range * au.range) continue;
      if (au.dmgMul > nb.dmgMul) { nb.dmgMul = au.dmgMul; by.dmg = a.uid; }
      if (au.rateMul > nb.rateMul) { nb.rateMul = au.rateMul; by.rate = a.uid; }
      if (au.rangeMul > nb.rangeMul) { nb.rangeMul = au.rangeMul; by.range = a.uid; }
      if (au.detection && !nb.detection) { nb.detection = true; by.det = a.uid; }
      if (au.costCut > nb.costCut) { nb.costCut = au.costCut; by.cost = a.uid; }
      if (au.cleanse && !nb.cleanse) { nb.cleanse = true; by.cleanse = a.uid; }
      if (au.armorPen > nb.armorPen) { nb.armorPen = au.armorPen; by.pen = a.uid; }
      if (au.critChance > nb.critChance) { nb.critChance = au.critChance; by.crit = a.uid; }
    }
    const rulesChanged = hubs.length || t.rules ? applyHubs(t, nb, by, hubs) : false;
    // limited buffs (Midori's brew, Chika's link) multiply on top of the auras, then ability rallies
    // (strongest per key; both players' girls), so a rally's ward clears sabotage below
    applyLimited(sim, t, nb);
    if (sim._rallies?.length) applyRallies(sim, t, nb, by);
    if (nb.cleanse && t.disabled > 0) t.disabled = 0;
    const ob = t.buff;
    let differs = ob.dmgMul !== nb.dmgMul || ob.rateMul !== nb.rateMul || ob.rangeMul !== nb.rangeMul
      || ob.detection !== nb.detection || ob.costCut !== nb.costCut || ob.cleanse !== nb.cleanse
      || ob.armorPen !== nb.armorPen || ob.critChance !== nb.critChance || (ob.tea || 1) !== nb.tea || rulesChanged || ob.pierceAdd !== nb.pierceAdd;
    if (sim.rule) {
      // map rule range inputs (src/sim/rules.js): only ruled battles ever carry these fields
      const env = ruleRangeFor(sim, t);
      const mul = env ? env.mul : 1;
      const add = env ? env.add : 0;
      if (mul !== (t.envRangeMul ?? 1) || add !== (t.envRangeAdd ?? 0)) {
        t.envRangeMul = mul;
        t.envRangeAdd = add;
        differs = true;
      }
    }
    const gDmg = sim.globalDmgMul ?? 1;
    if (differs || t._globalRate !== sim.globalRateMul || t._globalDmg !== gDmg) {
      t.buff = nb;
      t._globalRate = sim.globalRateMul;
      t._globalDmg = gDmg;
      refreshEffective(t, sim.globalRateMul, gDmg);
      changed = true;
    }
    t.buffed = nb.dmgMul > 1 || nb.rateMul > 1 || nb.rangeMul > 1 || nb.detection || nb.costCut > 0 || nb.cleanse
      || nb.armorPen > 0 || nb.critChance > 0 || nb.tea > 1 || sim.globalRateMul > 1 || gDmg > 1 || (t.limIn != null && (t.limIn.brew >= 0 || t.limIn.link >= 0))
      || !!t.hydrated || !!t.rules || nb.pierceAdd > 0;
  }
  return changed;
}

/**
 * Tea Club's Second Cup (gear-stats §C.3): girls in a Tea girl's aura attack 2 % faster (every Tea girl
 * gives the same, so it never stacks); a Tea girl with no aura serves the 2 nearest girls within 2 tiles
 * (ties: the lower uid). @returns {Set<object>|null} the girls served
 */
function secondCupTargets(towers) {
  let out = null;
  for (const a of towers) {
    if (a.disabled > 0 || trickClub(a.unitStats) !== TRICK.secondCup.club) continue;
    out ||= new Set();
    const au = a.stats?.aura;
    if (au && au.range > 0) {
      const r2 = au.range * au.range;
      for (const t of towers) if (t !== a && (t.x - a.x) ** 2 + (t.y - a.y) ** 2 <= r2) out.add(t);
      continue;
    }
    const near = TRICK.secondCup.near * TRICK.secondCup.near;
    const cands = towers.filter((t) => t !== a && (t.x - a.x) ** 2 + (t.y - a.y) ** 2 <= near);
    cands.sort((p, q) => ((p.x - a.x) ** 2 + (p.y - a.y) ** 2) - ((q.x - a.x) ** 2 + (q.y - a.y) ** 2) || p.uid - q.uid);
    for (const t of cands.slice(0, TRICK.secondCup.nearest)) out.add(t);
  }
  return out;
}

/** Strongest cost cut from auras covering tile centre (x, y). */
export function costCutAt(sim, x, y) {
  let cut = 0;
  for (const a of sim.towers) {
    const au = a.stats?.aura;
    if (!au || !au.costCut || a.disabled > 0) continue;
    if (Math.hypot(a.x - x, a.y - y) <= au.range) cut = Math.max(cut, au.costCut);
  }
  return Math.min(0.5, cut);
}

// ---------------------------------------------------------------------------
// Targeting
// ---------------------------------------------------------------------------

function priorityClass(e) {
  if (isCaster(e)) return 4;
  if (e.tier === 'boss' || e.tier === 'miniboss') return 3;
  if (e.tier === 'elite') return 2;
  return 0;
}

/** Higher = preferred. */
export function targetScore(mode, x, y, e) {
  switch (mode) {
    case 'last':
      return e.remaining;
    case 'strong':
      return (TIER_RANK[e.tier] || 0) * 1e8 + Math.min(e.maxHp, 9.99e6) * 10 - e.remaining * 1e-3;
    case 'close': {
      const dx = e.x - x;
      const dy = e.y - y;
      return -(dx * dx + dy * dy);
    }
    case 'elite':
      return priorityClass(e) * 1e6 - e.remaining;
    case 'air': // flyers still in the sky first, then the leader
      return (e.airborne && !e.grounded ? 1e6 : 0) - e.remaining;
    default:
      return -e.remaining;
  }
}

/** Eligible enemies within `range` of (x, y) for `spec`, written into `out`. */
export function gatherTargets(sim, x, y, range, spec, out) {
  out.length = 0;
  sim.grid.query(x, y, range, out);
  let n = 0;
  for (let i = 0; i < out.length; i++) if (isEligible(out[i], spec)) out[n++] = out[i];
  out.length = n;
  return out;
}

/** Best single target or null. */
export function bestTarget(sim, x, y, range, spec, mode) {
  const c = gatherTargets(sim, x, y, range, spec, sim._scratch);
  let best = null;
  let bestS = -Infinity;
  for (let i = 0; i < c.length; i++) {
    const s = targetScore(mode, x, y, c[i]);
    if (s > bestS) {
      bestS = s;
      best = c[i];
    }
  }
  return best;
}

/** Up to `n` distinct targets sorted by preference (new array). */
export function selectTargets(sim, x, y, range, spec, mode, n) {
  if (n <= 1) {
    const b = bestTarget(sim, x, y, range, spec, mode);
    return b ? [b] : [];
  }
  const c = gatherTargets(sim, x, y, range, spec, sim._scratch);
  const arr = c.slice();
  arr.sort((a, b) => targetScore(mode, x, y, b) - targetScore(mode, x, y, a));
  if (arr.length > n) arr.length = n;
  return arr;
}

/**
 * The best `k` eligible enemies within `reach` of (x, y) (Infinity = the whole map), best first,
 * written into `out` with their scores in `outS`: exactly what a stable sort + truncate of
 * gatherTargets gives (selectTargets), in O(N·k) and without allocating.
 */
export function topTargets(sim, x, y, reach, spec, mode, k, out, outS) {
  out.length = 0;
  outS.length = 0;
  const c = gatherTargets(sim, x, y, reach, spec, sim._scratch);
  for (let i = 0; i < c.length; i++) {
    const e = c[i];
    const sc = targetScore(mode, x, y, e);
    let j = out.length;
    if (j < k) {
      out.push(e);
      outS.push(sc);
    } else if (sc > outS[k - 1]) j = k - 1;
    else continue;
    // shift down past every entry scoring < sc (stable: an earlier candidate wins a tie)
    while (j > 0 && outS[j - 1] < sc) {
      out[j] = out[j - 1];
      outS[j] = outS[j - 1];
      j--;
    }
    out[j] = e;
    outS[j] = sc;
  }
  c.length = 0;
  return out;
}

// The first target of the attack running now (a rhythm's nova reads it right after the call), and
// whether that call is a rhythm's echo (its projectiles fan out as a second volley). Module state on
// purpose: set and read inside one synchronous attack, never across steps, so nothing to save.
let lastFaced = null;
let echoing = false;
// The girl's own effective spec while one of her rhythm attacks runs with t.effProc (null otherwise):
// a duel's splash victims take her plain hit, not the rhythm's harder one (attackDuel).
let procBase = null;
// Gear on the attack running now (set by updateTower around one counted attack, gear-stats §A.3 / §C.3):
// her Pierce in hundredths for this attack (Follow-Through included) and the trick spec it hits with.
// Module state like `echoing`: set and cleared inside one synchronous attack. An echo takes neither.
let gearK = 0;
let gearTrick = null;
// Whether this attack is a Follow-Through (Archery's 5th): a blast takes the trick's +100 % Pierce as a
// wider radius (blastRadius), the way her shots take it as gearK.
let gearFt = false;
/** Fan offset (rad) of an echo's projectiles, alternating sides. */
const ECHO_FAN = 0.18;

/** The spec her hits use this attack: a Finishing Thrust or a Big Beat makes a harder copy. */
function gearSpec(spec) {
  if (!gearTrick || echoing) return spec;
  return { ...spec, damage: spec.damage * gearTrick.mul, ...(gearTrick.pen ? { armorPen: (spec.armorPen || 0) + gearTrick.pen } : null) };
}

/** Her blast radius this attack: a Follow-Through widens it (none on an echo), else her usual splash. */
function blastRadius(t, splash) {
  return gearFt && !echoing ? splash * followThroughBlast(t.unitStats) : splash;
}

/** Extra targets from gear Pierce for one shot / beam / chain of this attack (none on an echo). */
function shotPierce(t) {
  return gearK > 0 && !echoing ? pierceCarry(t, 'pierceCarry', gearK, pierceMax(t)) : 0;
}

/**
 * Before one of her counted attacks: which trick fires on it (her 3-piece club; the Nth attack) and her
 * Pierce for it. @returns {number} the attack's number in her trick count (0 = no trick club)
 */
function beginGear(t) {
  gearTrick = null;
  gearK = 0;
  gearFt = false;
  // a trap girl's tricks run when her traps go off (updateTraps); a duel takes no Pierce on her strike
  if (t.eff.behavior === 'trap') return 0;
  const club = trickClub(t.unitStats);
  let n = 0;
  let ft = false;
  if (club === TRICK.followThrough.club || club === TRICK.thrust.club || club === TRICK.bigBeat.club) {
    n = (t.trickN || 0) + 1;
    if (club === TRICK.followThrough.club) ft = n % TRICK.followThrough.every === 0;
    else if (club === TRICK.thrust.club && n % TRICK.thrust.every === 0) gearTrick = { mul: TRICK.thrust.mul, pen: THRUST_PEN, kind: 'thrust' };
    else if (club === TRICK.bigBeat.club && n % TRICK.bigBeat.every === 0) gearTrick = { mul: TRICK.bigBeat.mul, pen: 0, kind: 'bigBeat' };
  }
  // (Kaede's blade arts take it: towers.js bladeArts)
  gearK = t.eff.behavior === 'duel' && !t.eff.blade ? 0 : pierceK(t, ft);
  gearFt = ft && t.eff.behavior !== 'duel';
  return n;
}

/** After the attack: a counted one (it found a target) advances her trick count. */
function endGear(sim, t, n, ok) {
  if (ok && n > 0) {
    const every = { archery: TRICK.followThrough.every, fencing: TRICK.thrust.every, taiko: TRICK.bigBeat.every }[t.unitStats.club];
    t.trickN = n % every;
    if (gearTrick || (t.unitStats.club === 'archery' && n % every === 0)) sim._emit('clubTrick', { towerUid: t.uid, kind: gearTrick ? gearTrick.kind : 'followThrough' });
  }
  gearK = 0;
  gearTrick = null;
  gearFt = false;
}

/** The girl turns toward her target (from where she stands, even when a familiar/mirror attacks). */
function face(t, e) {
  t.facing = Math.atan2(e.x - t.x, e.y - t.y);
  t.targetUid = e.uid;
  lastFaced = e;
}

function attackColor(spec) {
  return (spec.element && ELEMENTS[spec.element]?.color) || ATTACK_TYPES[spec.attackType]?.color || '#ffffff';
}

// ---------------------------------------------------------------------------
// Behaviors
// ---------------------------------------------------------------------------

/** Area hit centred on (x, y); emits 'explode'. */
export function explode(sim, tower, spec, x, y, radius) {
  const victims = sim.grid.query(x, y, radius, []);
  for (const e of victims) if (!e.dead) sim._hit(e, tower, spec, 1);
  sim._emit('explode', { x, y, radius, element: spec.element || null, attackType: spec.attackType });
}

export function spawnProjectile(sim, t, spec, target, fromX, fromY, opts = {}) {
  const speed = opts.speed ?? spec.projectileSpeed;
  let dx = target.x - fromX;
  let dy = target.y - fromY;
  const d = Math.hypot(dx, dy) || 1e-6;
  dx /= d;
  dy /= d;
  if (opts.spread) {
    const c = Math.cos(opts.spread);
    const s = Math.sin(opts.spread);
    const nx = dx * c - dy * s;
    dy = dx * s + dy * c;
    dx = nx;
  }
  const kind = opts.kind || t.projKind;
  const range = opts.range ?? spec.range;
  const p = {
    uid: sim._nextUid(),
    kind,
    x: fromX,
    y: fromY,
    z: PROJECTILE_Z,
    vx: dx * speed,
    vy: dy * speed,
    ownerUid: t.uid,
    element: spec.element || null,
    attackType: spec.attackType,
    turretUid: opts.turretUid ?? null,
    // internals
    owner: t,
    drone: opts.drone ?? null, // the roaming drone that fired it (per-drone credit)
    guided: !!opts.guided, // hits only its own target; fizzles when that target is gone
    spec,
    target,
    tx: target.x,
    ty: target.y,
    speed,
    pierce: opts.pierce ?? spec.pierce,
    splash: opts.splash ?? spec.splash,
    hits: [],
    travel: 0,
    maxTravel: range * 1.4 + 2,
    est: d,
    arc: ARC_KINDS[kind] ? Math.min(2.4, 0.6 + d * 0.22) : 0,
    targetAlt: target.alt || 0,
    dead: false,
  };
  sim.projectiles.push(p);
  return p;
}

function linePierce(sim, t, spec, target, length, halfWidth, pierce) {
  const sx = t.ox;
  const sy = t.oy;
  const dx = target.x - sx;
  const dy = target.y - sy;
  const d = Math.hypot(dx, dy) || 1e-6;
  const ex = sx + (dx / d) * length;
  const ey = sy + (dy / d) * length;
  const near = sim.grid.query((sx + ex) / 2, (sy + ey) / 2, length / 2 + 1, []);
  const hits = [];
  for (const e of near) {
    if (!isEligible(e, spec)) continue;
    const hr = halfWidth + hitRadius(e);
    if (segDistSq(e.x, e.y, sx, sy, ex, ey) <= hr * hr) hits.push(e);
  }
  hits.sort((a, b) => projectOnSegment(a.x, a.y, sx, sy, ex, ey) - projectOnSegment(b.x, b.y, sx, sy, ex, ey));
  if (!hits.includes(target)) hits.unshift(target);
  if (hits.length > pierce) hits.length = pierce;
  return { hits, ex, ey };
}

/**
 * Potential N13 (Kage): projectiles × (1 + f) through an integer carry: k = round(f × 100) hundredths
 * per projectile accumulate in t.projCarry and every full 100 is one more (so every client throws the
 * same extra shuriken on the same throws). @returns {number} extra projectiles this attack
 */
function projExtra(t, n, f) {
  const k = Math.round(f * 100);
  t.projCarry = (t.projCarry || 0) + n * k;
  const extra = Math.floor(t.projCarry / 100);
  t.projCarry -= extra * 100;
  return extra;
}

function attackProjectile(sim, t) {
  const first = volleyFrom(sim, t, t.ox, t.oy);
  // a mirror girl with two firing points (Iroha, UNIT_GAPS §4.1): she also fires from where she stands
  const second = t.stats.relay?.both && t.origin && (t.ox !== t.x || t.oy !== t.y) ? volleyFrom(sim, t, t.x, t.y) : null;
  const lead = first || second;
  if (!lead) return false;
  sim._emit('attack', { towerUid: t.uid, targetUid: lead.uid, kind: t.projKind });
  return true;
}

/** One volley of her projectiles from (sx, sy) at the targets in range of it; the first target or null. */
function volleyFrom(sim, t, sx, sy) {
  const spec = gearSpec(t.eff);
  let n = spec.projectiles;
  const targets = selectTargets(sim, sx, sy, spec.range, spec, t.targetMode, n);
  if (!targets.length) return null;
  if (spec.projScale > 0) n += projExtra(t, n, spec.projScale);
  face(t, targets[0]);
  for (let i = 0; i < n; i++) {
    const tgt = targets[i % targets.length];
    const dup = Math.floor(i / targets.length);
    if (spec.projectileSpeed <= 0) {
      if (tgt.dead) continue;
      const pierce = spec.splash > 0 ? spec.pierce : spec.pierce + shotPierce(t);
      if (spec.splash > 0) explode(sim, t, spec, tgt.x, tgt.y, blastRadius(t, spec.splash));
      else if (pierce > 1) {
        const { hits } = linePierce(sim, t, spec, tgt, spec.range + 1, LINE_HALF_WIDTH, pierce);
        for (const e of hits) if (!e.dead) sim._hit(e, t, spec, 1);
      } else sim._hit(tgt, t, spec, 1);
    } else {
      let spread = dup === 0 ? 0 : (dup % 2 ? 1 : -1) * 0.12 * Math.ceil(dup / 2);
      if (echoing) spread += i % 2 ? -ECHO_FAN : ECHO_FAN;
      const extra = spec.splash > 0 ? 0 : shotPierce(t);
      const blast = spec.splash > 0 ? blastRadius(t, spec.splash) : 0;
      const opts = extra ? { spread, pierce: spec.pierce + extra } : blast !== spec.splash ? { spread, splash: blast } : { spread };
      spawnProjectile(sim, t, spec, tgt, sx, sy, opts);
    }
  }
  return targets[0];
}

function attackPulse(sim, t) {
  const spec = gearSpec(t.eff);
  const c = gatherTargets(sim, t.ox, t.oy, spec.range, spec, sim._scratch);
  if (!c.length) return false;
  let victims = c.slice();
  // gear Pierce: 2 more targets per 100 % (a carry on 2k)
  const maxTargets = spec.maxTargets + (gearK > 0 && !echoing ? pierceCarry(t, 'pierceCarry', 2 * gearK, PULSE_MAX_EXTRA) : 0);
  if (victims.length > maxTargets) {
    victims.sort((a, b) => targetScore(t.targetMode, t.ox, t.oy, b) - targetScore(t.targetMode, t.ox, t.oy, a));
    victims.length = maxTargets;
  }
  face(t, victims[0]);
  for (const e of victims) if (!e.dead) sim._hit(e, t, spec, 1);
  sim._emit('pulse', { x: t.ox, y: t.oy, radius: spec.range, element: spec.element || null, attackType: spec.attackType, towerUid: t.uid });
  sim._emit('attack', { towerUid: t.uid, targetUid: victims[0].uid, kind: 'pulse' });
  return true;
}

function attackDuel(sim, t) {
  const spec = gearSpec(t.eff);
  let tgt = t.rampTarget;
  if (!tgt || tgt.dead || !isEligible(tgt, spec) || Math.hypot(tgt.x - t.ox, tgt.y - t.oy) > spec.range) {
    // Potential N10 (Kaede): a target that FELL leaves part of her focus for the next one; one that
    // leaked, walked off or turned ineligible alive clears it (a gap with no enemy in reach keeps it)
    if (tgt && spec.keepRamp > 0) t.rampKeep = tgt.dead && !tgt.leaked ? Math.floor(t.rampStacks * spec.keepRamp) : 0;
    tgt = bestTarget(sim, t.ox, t.oy, spec.range, spec, t.targetMode);
  }
  if (!tgt) {
    t.rampTarget = null;
    t.rampStacks = 0;
    return false;
  }
  if (tgt !== t.rampTarget) {
    t.rampTarget = tgt;
    t.rampStacks = 0;
    if (t.rampKeep > 0) {
      t.rampStacks = t.rampKeep;
      t.rampKeep = 0;
    }
  }
  face(t, tgt);
  const ramp = spec.ramp;
  const scale = 1 + (ramp ? Math.min(ramp.per * t.rampStacks, ramp.max) : 0);
  const tx = tgt.x;
  const ty = tgt.y;
  sim._hit(tgt, t, spec, scale);
  t.rampStacks++;
  if (spec.splash > 0) {
    // the cut around her target is an unfocused hit at her plain damage: a rhythm (Kaede's Maple
    // Gale) widens it, its harder strike stays on her target (Potential N3; P1 has no rhythm)
    const cut = procBase && t.eff === t.effProc ? procBase : spec;
    const near = sim.grid.query(tx, ty, spec.splash, []);
    for (const e of near) if (e !== tgt && !e.dead && isEligible(e, cut)) sim._hit(e, t, cut, 1);
  }
  sim._emit('attack', { towerUid: t.uid, targetUid: tgt.uid, kind: 'slash', ramp: t.rampStacks });
  if (spec.blade) bladeArts(sim, t, spec, tgt, tx, ty, scale);
  return true;
}

// ---------------------------------------------------------------------------
// Kaede's blade arts (her AoE rework, docs/BALANCE.md "Kaede"). Every `blade.every`-th strike is a Maple
// Cleave around her target, plus her path's shapes: wind crescents through her target (Flowing Blade 3+),
// the maple blade storm around her (Flowing Blade 5) and the ground shockwave (Guard Breaker 4-5). A
// strike at full focus (her cap before Potential; Unbroken Rhythm 3+) also bursts maple leaves around
// her target. Each shape hits at a share of her plain hit (the maple splash: of her focused strike)
// through sim._hit with her own spec, so her gear (ATK, speed, crit, armor pierce, club tricks) counts
// as on her strike; gear Pierce adds targets to every shape of the attack (the sweep rule: +2 per
// 100 %, carried, at most +4). Victims: eligible for her (never in a tunnel, never a flyer unless she
// reaches flyers), never her target, nearest first (uid on a tie), at most the shape's `targets`.
// Only the shockwave carries a status (her armor shred); the other shapes are clean cuts.
// ---------------------------------------------------------------------------

/** Fan step of her wind crescents (0.32 rad), as literals: no trig in the battle. */
const FAN_COS = 0.9492354180824408;
const FAN_SIN = 0.31456656061611776;
const bladeHits = [];
const bladeD = [];

/** Her hit spec for one shape: `share` of `base`, clean (or with `status`). */
function bladeSpec(base, share, status) {
  return { ...base, damage: base.damage * share, splash: 0, status: status || [], procStatus: null, mark: null, silence: 0, reveal: 0, knockback: 0 };
}

/** Cuts the nearest `cap` of bladeHits (bladeD their sort keys) with `hit` at `scale`. @returns {number} */
function bladeCut(sim, t, hit, scale, cap) {
  const n = bladeHits.length;
  const idx = [];
  for (let i = 0; i < n; i++) idx.push(i);
  idx.sort((a, b) => bladeD[a] - bladeD[b] || bladeHits[a].uid - bladeHits[b].uid);
  let k = 0;
  for (let j = 0; j < n && k < cap; j++) {
    const e = bladeHits[idx[j]];
    if (e.dead) continue;
    sim._hit(e, t, hit, scale);
    k++;
  }
  bladeHits.length = 0;
  bladeD.length = 0;
  return k;
}

/** Candidates within `r` of (x, y), keyed by squared distance. */
function bladeRound(sim, x, y, r, hit, tgt) {
  for (const e of sim.grid.query(x, y, r, [])) {
    if (e === tgt || e.dead || !isEligible(e, hit)) continue;
    bladeHits.push(e);
    bladeD.push((e.x - x) * (e.x - x) + (e.y - y) * (e.y - y));
  }
}

/** Candidates on the segment from (sx, sy) along unit (ux, uy) for `len`, half-width `hw`, keyed by how far along. */
function bladeLine(sim, sx, sy, ux, uy, len, hw, hit, tgt) {
  const ex = sx + ux * len;
  const ey = sy + uy * len;
  for (const e of sim.grid.query((sx + ex) / 2, (sy + ey) / 2, len / 2 + hw + 1, [])) {
    if (e === tgt || e.dead || !isEligible(e, hit)) continue;
    const hr = hw + hitRadius(e);
    if (segDistSq(e.x, e.y, sx, sy, ex, ey) > hr * hr) continue;
    bladeHits.push(e);
    bladeD.push((e.x - sx) * ux + (e.y - sy) * uy);
  }
}

function bladeArts(sim, t, spec, tgt, tx, ty, scale) {
  const b = spec.blade;
  // a rhythm strike's harder spec stays on her target: her shapes cut with her own (attackWithProc)
  const base = procBase && t.eff === t.effProc ? procBase : spec;
  const mul = b.shareMul;
  let extra = -1;
  const more = () => (extra < 0 ? (extra = gearK > 0 && !echoing ? pierceCarry(t, 'pierceCarry', 2 * gearK, PULSE_MAX_EXTRA) : 0) : extra);
  // maple splash: a strike at full focus (her cap before Potential) bursts leaves around her target
  const ramp = spec.ramp;
  if (b.maple > 0 && b.mShare > 0 && ramp && ramp.per > 0 && b.capMax > 0 && ramp.per * (t.rampStacks - 1) >= b.capMax - 1e-9) {
    const hit = bladeSpec(base, b.mShare * mul);
    bladeRound(sim, tx, ty, b.maple, hit, tgt);
    const n = bladeCut(sim, t, hit, scale, Math.round(b.mTargets) + more());
    sim._emit('bladeArt', { towerUid: t.uid, kind: 'maple', x: tx, y: ty, radius: b.maple, hits: n });
  }
  // the count of her strikes: every `every`-th is a blade art
  const every = Math.max(1, Math.round(b.every));
  const n = (t.bladeN || 0) + 1;
  t.bladeN = n % every;
  if (n < every) return;
  let dx = tx - t.ox;
  let dy = ty - t.oy;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 1e-6) {
    dx /= d;
    dy /= d;
  } else {
    dx = 0;
    dy = 1;
  }
  let hits = 0;
  if (b.radius > 0 && b.share > 0) {
    const hit = bladeSpec(base, b.share * mul);
    bladeRound(sim, tx, ty, b.radius, hit, tgt);
    hits += bladeCut(sim, t, hit, 1, Math.round(b.targets) + more());
  }
  const nc = Math.round(b.crescents);
  if (nc > 0 && b.cLen > 0 && b.cShare > 0) {
    // a fan: straight through her target, then pairs 0.32 rad either side
    const hit = bladeSpec(base, b.cShare * mul);
    let lx = dx;
    let ly = dy;
    let rx = dx;
    let ry = dy;
    for (let i = 0; i < nc; i++) {
      let ux = dx;
      let uy = dy;
      if (i % 2 === 1) {
        const x = lx * FAN_COS - ly * FAN_SIN;
        ly = lx * FAN_SIN + ly * FAN_COS;
        lx = x;
        ux = lx;
        uy = ly;
      } else if (i > 0) {
        const x = rx * FAN_COS + ry * FAN_SIN;
        ry = -rx * FAN_SIN + ry * FAN_COS;
        rx = x;
        ux = rx;
        uy = ry;
      }
      bladeLine(sim, t.ox, t.oy, ux, uy, b.cLen, b.cWidth, hit, tgt);
      hits += bladeCut(sim, t, hit, 1, Math.round(b.cTargets) + more());
    }
  }
  if (b.storm > 0 && b.sShare > 0) {
    const hit = bladeSpec(base, b.sShare * mul);
    bladeRound(sim, t.ox, t.oy, b.storm, hit, tgt);
    hits += bladeCut(sim, t, hit, 1, Math.round(b.sTargets) + more());
  }
  if (b.wave > 0 && b.wShare > 0) {
    // the shockwave cracks armor: her shred rides on it
    const shred = (base.status || []).filter((x) => x.type === 'shred');
    const hit = bladeSpec(base, b.wShare * mul, shred);
    bladeLine(sim, t.ox, t.oy, dx, dy, b.wave, b.wWidth, hit, tgt);
    hits += bladeCut(sim, t, hit, 1, Math.round(b.wTargets) + more());
  }
  sim._emit('bladeArt', {
    towerUid: t.uid, kind: 'cleave', x: tx, y: ty, dx, dy, radius: b.radius, crescents: nc, cLen: b.cLen, storm: b.storm, wave: b.wave, hits,
  });
}

/**
 * Potential N15 on a duel (Rei's Twin Crescent): one follow-up strike on her current target at the
 * echo spec's damage and her current focus, adding no focus stack and never changing her target.
 */
function duelEcho(sim, t) {
  const spec = t.eff;
  const tgt = t.rampTarget;
  if (!tgt || tgt.dead || !isEligible(tgt, spec) || Math.hypot(tgt.x - t.x, tgt.y - t.y) > spec.range) return false;
  const ramp = spec.ramp;
  const scale = 1 + (ramp ? Math.min(ramp.per * t.rampStacks, ramp.max) : 0);
  sim._hit(tgt, t, spec, scale);
  sim._emit('attack', { towerUid: t.uid, targetUid: tgt.uid, kind: 'slash', ramp: t.rampStacks, echo: true });
  return true;
}

function attackBeam(sim, t) {
  const spec = gearSpec(t.eff);
  const targets = selectTargets(sim, t.ox, t.oy, spec.range, spec, t.targetMode, spec.projectiles);
  if (!targets.length) {
    t.rampTarget = null;
    t.rampStacks = 0;
    return false;
  }
  face(t, targets[0]);
  // Resonant focus (ramp): builds while the lead target stays the same, resets on a switch
  const ramp = spec.ramp;
  let scale = 1;
  if (ramp) {
    if (targets[0] !== t.rampTarget) {
      t.rampTarget = targets[0];
      t.rampStacks = 0;
    }
    scale = 1 + Math.min(ramp.per * t.rampStacks, ramp.max);
  }
  const color = attackColor(spec);
  const width = 0.12 + 0.04 * Math.min(6, spec.pierce);
  for (const tgt of targets) {
    if (tgt.dead) continue;
    const { hits, ex, ey } = linePierce(sim, t, spec, tgt, spec.range, BEAM_HALF_WIDTH, spec.pierce + shotPierce(t));
    for (const e of hits) if (!e.dead) sim._hit(e, t, spec, scale);
    sim._emit('beam', { from: [t.ox, t.oy], to: [ex, ey], width, color, towerUid: t.uid, ramp: ramp ? t.rampStacks : 0 });
  }
  if (ramp) t.rampStacks++;
  sim._emit('attack', { towerUid: t.uid, targetUid: targets[0].uid, kind: 'beam' });
  return true;
}

/** How far her chain lightning jumps from one enemy to the next (her base attack and Seiran's Storm Lance). */
export function chainJump(spec) {
  return CHAIN_JUMP_RANGE + spec.splash;
}

/**
 * The next link of a chain from (cx, cy): the nearest enemy within `jump` that is eligible for `spec` and not in
 * `hitSet` (uids), or null. Ties: the first in grid order, or with `uidTies` the lower uid (Storm Lance). Her base
 * chain attack and the ability share this walk.
 */
export function chainNext(sim, cx, cy, jump, spec, hitSet, uidTies = false) {
  const near = sim.grid.query(cx, cy, jump, sim._scratch2);
  let next = null;
  let bestD = Infinity;
  for (const e of near) {
    if (hitSet.has(e.uid) || !isEligible(e, spec)) continue;
    const d = (e.x - cx) ** 2 + (e.y - cy) ** 2;
    if (d < bestD || (uidTies && d === bestD && e.uid < next.uid)) {
      bestD = d;
      next = e;
    }
  }
  sim._scratch2.length = 0;
  return next;
}

function attackChain(sim, t) {
  const spec = gearSpec(t.eff);
  const targets = selectTargets(sim, t.ox, t.oy, spec.range, spec, t.targetMode, spec.projectiles);
  if (!targets.length) return false;
  face(t, targets[0]);
  const jump = chainJump(spec);
  for (const start of targets) {
    if (start.dead) continue;
    const points = [[t.ox, t.oy]];
    const hitSet = new Set();
    let cur = start;
    const chain = spec.chain + shotPierce(t);
    for (let j = 0; j <= chain && cur; j++) {
      hitSet.add(cur.uid);
      points.push([cur.x, cur.y]);
      const cx = cur.x;
      const cy = cur.y;
      sim._hit(cur, t, spec, 1);
      if (j === chain) break;
      cur = chainNext(sim, cx, cy, jump, spec, hitSet);
    }
    sim._emit('chain', { points, element: spec.element || null, towerUid: t.uid });
  }
  sim._emit('attack', { towerUid: t.uid, targetUid: targets[0].uid, kind: 'chain' });
  return true;
}

/** Path sample points within range, nearest-to-exit first (trap candidate spots; Gravity Well spots, src/sim/zones.js). */
export function trapSpots(sim, t) {
  const range = t.eff.range;
  if (t.trapSpots && t.trapSpotsRange === range) return t.trapSpots;
  const spots = [];
  for (const path of sim.pathData) {
    for (const s of samplePath(path, 0.5)) {
      if (s.hidden) continue; // no traps inside tunnels
      if (Math.hypot(s.x - t.x, s.y - t.y) <= range) spots.push({ x: s.x, y: s.y, remaining: path.length - s.d });
    }
  }
  spots.sort((a, b) => a.remaining - b.remaining);
  t.trapSpots = spots;
  t.trapSpotsRange = range;
  return spots;
}

function placeTrap(sim, t) {
  const trap = t.stats.trap;
  if (!trap || sim.state !== 'wave' || t.trapCount >= trap.max) return false;
  const spots = trapSpots(sim, t);
  const free = [];
  for (const s of spots) {
    let ok = true;
    for (const tr of sim.traps) {
      if ((tr.x - s.x) ** 2 + (tr.y - s.y) ** 2 < 0.45 * 0.45) {
        ok = false;
        break;
      }
    }
    if (ok) free.push(s);
    if (free.length >= 4) break;
  }
  if (!free.length) return false;
  const s = free[Math.floor(sim.rng.next() * free.length)];
  const jx = (sim.rng.next() - 0.5) * 0.3;
  const jy = (sim.rng.next() - 0.5) * 0.3;
  const tr = { uid: sim._nextUid(), x: s.x + jx, y: s.y + jy, ownerUid: t.uid, armed: false, armLeft: trap.armTime, owner: t };
  sim.traps.push(tr);
  t.trapCount++;
  t.facing = Math.atan2(tr.x - t.x, tr.y - t.y);
  sim._emit('trapPlaced', { uid: tr.uid, x: tr.x, y: tr.y, ownerUid: t.uid });
  sim._emit('attack', { towerUid: t.uid, targetUid: null, kind: 'trap' });
  return true;
}

// ---------------------------------------------------------------------------
// Drones. Anchored turrets (turret.leash 0: the test engineer) sit on a ring around their girl
// and shoot from there. Roaming drones (leash > 0: Chika) fly in the sim: each one hunts its own
// quarry inside the wing's roam area, follows it and shoots it with guided bullets. Where the
// wing roams is the girl's flight mode (setFlight, the co-op `fly` command):
//   hover   (default) within `leash` of her
//   hold    within leash × FLIGHT_POINT_ROAM_MUL of a point inside her signal range
//   patrol  the same, around a position travelling between two points
//   pursuit anywhere on the map, chasing her target mode's best enemies
// No rng, no per-drone timers (schedules come from the step number), only + − × ÷ and sqrt in
// the flight maths, so every JS engine flies them the same (atan2 only sets the facing).
// docs/specs/CHIKA_REWORK.md §3 and §16 (flight modes).
// ---------------------------------------------------------------------------

/** One factory for roaming drones: building, battle-save restore and tests use it. */
export function makeDrone(t, uid, n, slot, born = 0) {
  const s = DRONE_SLOTS[slot % DRONE_SLOTS.length];
  const ring = TURRET_RING * (1 + 0.5 * Math.floor(slot / DRONE_SLOTS.length));
  const hx = s[0] * ring;
  const hy = s[1] * ring;
  const x = t.x + hx;
  const y = t.y + hy;
  return {
    uid, n, slot, x, y, px: x, py: y, hx, hy, facing: 0, cooldown: 0.3,
    jam: 0, // seconds left jammed by a sapper
    tgt: null, targetUid: null, moving: false,
    dmg: 0, kills: 0, shots: 0, born, // per-drone stats (born = the wave it was built in)
  };
}

/**
 * A drone from a battle-save row [uid, x, y, facing, cooldown, n?, slot?, dmg?, kills?, shots?,
 * born?, jam?] (old 5-field rows: counters 0, numbered by position).
 */
export function restoreDrone(t, row, i) {
  const [uid, x, y, facing, cooldown, n, slot, dmg, kills, shots, born, jam] = row;
  const d = makeDrone(t, uid, n ?? i + 1, slot ?? i, born ?? 0);
  d.x = d.px = x;
  d.y = d.py = y;
  d.facing = facing ?? 0;
  d.cooldown = cooldown ?? 0;
  d.dmg = dmg ?? 0;
  d.kills = kills ?? 0;
  d.shots = shots ?? 0;
  d.jam = jam ?? 0;
  return d;
}

/** Does this girl fly roaming drones (Chika)? */
export function hasRoamingDrones(t) {
  return !!t.turretSpec && t.turretSpec.leash > 0;
}

function spawnTurret(sim, t) {
  const n = t.turrets.length;
  let tu;
  if (hasRoamingDrones(t)) {
    t.droneSerial++;
    tu = makeDrone(t, sim._nextUid(), t.droneSerial, n, sim.wave);
  } else {
    const ang = n * 2.39996 + 0.6;
    tu = { uid: sim._nextUid(), x: t.x + Math.sin(ang) * TURRET_RING, y: t.y + Math.cos(ang) * TURRET_RING, facing: ang, cooldown: 0.3 };
  }
  t.turrets.push(tu);
  sim._emit('attack', { towerUid: t.uid, targetUid: null, kind: 'build', turretUid: tu.uid });
  return true;
}

function attackTurret(sim, t) {
  const tur = t.stats.turret;
  if (tur && sim.state === 'wave' && t.turrets.length < tur.max) return spawnTurret(sim, t);
  if (t.eff.damage > 0) return attackProjectile(sim, t);
  return false;
}

// ---------------------------------------------------------------------------
// Mortar: aimed, delayed shells (ROSTER_SPEC §6.4)
// ---------------------------------------------------------------------------

/**
 * Fires a volley of shells. With an aim point she waits until an eligible enemy is near it
 * (no wasted shells); without one she leads her best target by MORTAR_DELAY seconds of travel.
 * Shells land MORTAR_DELAY later at centre + MORTAR_SCATTER[i] × splash.
 */
function attackMortar(sim, t) {
  const spec = t.eff;
  let cx;
  let cy;
  let targetUid = null;
  if (t.aim) {
    const near = gatherTargets(sim, t.aim.x, t.aim.y, spec.splash + MORTAR_AIM_SLACK, spec, sim._scratch);
    if (!near.length) return false;
    cx = t.aim.x;
    cy = t.aim.y;
    t.facing = Math.atan2(cx - t.x, cy - t.y);
  } else {
    const tgt = bestTarget(sim, t.ox, t.oy, spec.range, spec, t.targetMode);
    if (!tgt) return false;
    const path = sim.pathData[tgt.pathIndex];
    const p = pointAt(path, Math.min(path.length, tgt.dist + tgt.speed * MORTAR_DELAY), sim._leadPt || (sim._leadPt = {}), tgt.seg);
    cx = p.x;
    cy = p.y;
    face(t, tgt);
    targetUid = tgt.uid;
  }
  const snap = { ...spec }; // later upgrades / buffs do not change shells in flight
  const n = Math.max(1, spec.projectiles);
  const radius = spec.splash;
  for (let i = 0; i < n; i++) {
    const off = MORTAR_SCATTER[i % MORTAR_SCATTER.length];
    const sh = {
      uid: sim._nextUid(),
      x: cx + off[0] * radius,
      y: cy + off[1] * radius,
      radius,
      left: MORTAR_DELAY,
      delay: MORTAR_DELAY,
      ownerUid: t.uid,
      fromX: t.ox,
      fromY: t.oy,
      element: spec.element || null,
      attackType: spec.attackType,
      // internals
      owner: t,
      spec: snap,
      fresh: true, // skips the countdown of the step it was fired in: lands exactly MORTAR_DELAY later
      dead: false,
    };
    sim.shells.push(sh);
    sim._emit('mortarWarn', { uid: sh.uid, x: sh.x, y: sh.y, radius, delay: MORTAR_DELAY, towerUid: t.uid });
  }
  sim._emit('attack', { towerUid: t.uid, targetUid, kind: 'mortar' });
  return true;
}

/** Counts every pending shell down; landed shells explode (eligibility as usual: no flyers for ground-only). */
export function updateShells(sim, dt) {
  const list = sim.shells;
  if (!list.length) return;
  for (let i = 0; i < list.length; i++) {
    const sh = list[i];
    if (sh.dead) continue;
    if (sh.owner.removed) {
      sh.dead = true; // sold: the shell never lands
      continue;
    }
    if (sh.fresh) {
      sh.fresh = false;
      continue;
    }
    sh.left -= dt;
    if (sh.left > 1e-9) continue;
    sh.dead = true;
    explode(sim, sh.owner, sh.spec, sh.x, sh.y, sh.radius);
    sim._emit('shellLand', { uid: sh.uid, x: sh.x, y: sh.y, towerUid: sh.ownerUid });
  }
  let n = 0;
  for (let i = 0; i < list.length; i++) if (!list[i].dead) list[n++] = list[i];
  list.length = n;
}

// ---------------------------------------------------------------------------
// Aim points and relay origins (ROSTER_SPEC §6.3, §6.5)
// ---------------------------------------------------------------------------

/** What a tower's aim point is for: 'mortar' | 'mirror' | 'ult' (aimed hero ult) | null. */
export function aimMode(t) {
  if (!t) return null;
  if (t.eff?.behavior === 'mortar') return 'mortar';
  if (t.stats?.relay?.kind === 'mirror') return 'mirror';
  if (t.stats?.strip?.aim) return 'checkpoint'; // Azami's Checkpoint mode (src/sim/strips.js)
  if (t.stats?.hub?.banners > 0) return 'banner'; // Ouka's Rally Banner (src/sim/hubs.js)
  // an aimed hero ult: a nova centred on her aim, or a runner that enters at it
  const ue = t.isHero ? t.def?.hero?.ult?.effect : null;
  if (ue && (ue.center === 'aim' || ue.type === 'runner')) return 'ult';
  return null;
}

/**
 * Visible lane samples for relay origins: every RELAY_SAMPLE_STEP tiles of every path, tunnel
 * samples skipped, in path order then distance order (that order breaks ties).
 * @param {object[]} pathData
 * @returns {{ x: number, y: number, d: number, pathIndex: number }[]}
 */
export function relaySamples(pathData) {
  const out = [];
  for (const path of pathData || []) {
    for (const s of samplePath(path, RELAY_SAMPLE_STEP)) if (!s.hidden) out.push({ x: s.x, y: s.y, d: s.d, pathIndex: s.pathIndex });
  }
  return out;
}

/**
 * Where a familiar / mirror stands for a girl at (x, y). Pure (the placement ghost uses it too).
 * Mirror with an aim → the aim (already clamped). Otherwise the nearest visible lane sample:
 * within FAMILIAR_STANDOFF of it → the girl herself; else the point min(d − standoff, reach)
 * tiles from her toward it.
 * @param {object[]} samples from relaySamples()
 * @param {number} x @param {number} y girl position
 * @param {{ kind: string, reach: number }|null} relay
 * @param {{ x: number, y: number }|null} [aim]
 * @returns {{ x: number, y: number }|null} null for girls without a relay
 */
export function relayOrigin(samples, x, y, relay, aim = null) {
  if (!relay) return null;
  if (relay.kind === 'mirror' && aim) return { x: aim.x, y: aim.y };
  let best = null;
  let bestD2 = Infinity;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const dx = s.x - x;
    const dy = s.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = s;
    }
  }
  if (!best) return { x, y };
  const d = Math.sqrt(bestD2);
  if (d <= FAMILIAR_STANDOFF) return { x, y };
  const k = Math.max(0, Math.min(d - FAMILIAR_STANDOFF, relay.reach)) / d;
  return { x: x + (best.x - x) * k, y: y + (best.y - y) * k };
}

/** Recomputes a tower's relay origin (placement, upgrades, aim); emits 'relay' when it moved. */
export function updateRelayOrigin(sim, t) {
  const relay = t.stats?.relay || null;
  let o = null;
  if (relay) {
    // geometry caches come from the forward paths (CODEX_MODES §6.3): a familiar's spot never depends
    // on which route orientation was live when the first relay girl was placed
    if (!sim._relaySamples) sim._relaySamples = relaySamples(sim._pathsFwd ?? sim.pathData);
    o = relayOrigin(sim._relaySamples, t.x, t.y, relay, t.aim);
  }
  const ox = o ? o.x : t.x;
  const oy = o ? o.y : t.y;
  const moved = (o === null) !== (t.origin === null) || ox !== t.ox || oy !== t.oy;
  t.origin = o;
  t.ox = ox;
  t.oy = oy;
  if (moved && relay) sim._emit('relay', { towerUid: t.uid, x: ox, y: oy, kind: relay.kind });
  return moved;
}

const BEHAVIORS = {
  projectile: attackProjectile,
  pulse: attackPulse,
  duel: attackDuel,
  beam: attackBeam,
  chain: attackChain,
  trap: placeTrap,
  turret: attackTurret,
  mortar: attackMortar,
  strip: layStrip,
  ring: attackRing,
  // attack shapes S1 (src/sim/wheels.js): Blossom Wheel aims its lead spoke at her target; Pinwheel Stream
  // turns its arms one shot per attack
  wheel: (sim, t) => {
    const spec = gearSpec(t.eff);
    const target = selectTargets(sim, t.ox, t.oy, spec.range, spec, t.targetMode, 1)[0];
    return attackWheel(sim, t, spec, target, target ? shotPierce(t) : 0);
  },
  spin: (sim, t) => attackSpin(sim, t, gearSpec(t.eff), shotPierce(t)),
  drink: throwDrink,
  roll: rollBall,
};

/**
 * One drone / turret shot's gear (gear-stats §A.3, §C.3): its Pierce (a carry on the owner, drones do not
 * take Follow-Through) and Taiko's Big Beat on every 10th drone shot. @returns {{ spec, pierce }}
 */
function droneShot(t, spec) {
  const pierce = 1 + pierceCarry(t, 'droneCarry', pierceK(t), pierceMax(t));
  if (trickClub(t.unitStats) !== TRICK.bigBeat.club) return { spec, pierce };
  t.droneBeatN = ((t.droneBeatN || 0) + 1) % TRICK.bigBeat.every;
  return { spec: t.droneBeatN === 0 ? { ...spec, damage: spec.damage * TRICK.bigBeat.mul } : spec, pierce };
}

function updateTurrets(sim, t, dt) {
  const spec = t.turretSpec;
  if (!spec || !t.turrets.length) return;
  // Potential N11 (Chika): her own drones fire × rateMul while her overclock runs (1 otherwise)
  const ocMul = t.potOc && t.potOc.left > 0 ? t.stats.turret.overclock.rateMul : 1;
  if (spec.leash > 0) {
    updateRoamingDrones(sim, t, spec, dt, ocMul);
    return;
  }
  for (const tu of t.turrets) {
    if (tu.cooldown > 0) tu.cooldown -= dt;
    if (tu.cooldown > 0) continue;
    const tgt = bestTarget(sim, tu.x, tu.y, spec.range, spec, t.targetMode);
    if (!tgt) {
      tu.cooldown = 0;
      continue;
    }
    tu.facing = Math.atan2(tgt.x - tu.x, tgt.y - tu.y);
    const shot = droneShot(t, spec);
    spawnProjectile(sim, t, shot.spec, tgt, tu.x, tu.y, {
      kind: 'bullet', speed: TURRET_PROJECTILE_SPEED, pierce: shot.pierce, splash: 0, range: spec.range, turretUid: tu.uid,
    });
    tu.cooldown += 1 / Math.max(0.05, spec.rate * ocMul);
    sim._emit('attack', { towerUid: t.uid, targetUid: tgt.uid, kind: 'bullet', turretUid: tu.uid });
  }
}

// --- flight modes ----------------------------------------------------------

/** A girl's flight mode ('hover' when none was set). */
export function flightMode(t) {
  return t.flight ? t.flight.mode : 'hover';
}

/** How far from her Hold / Patrol points may be (her signal range, tiles). */
export function signalRange(t) {
  return hasRoamingDrones(t) ? t.turretSpec.leash * FLIGHT_SIGNAL_MUL : 0;
}

/** (x, y) pulled inside her signal range and the map, into out[0..1]. */
function clampPoint(sim, t, x, y, out) {
  const sig = signalRange(t);
  let dx = x - t.x;
  let dy = y - t.y;
  const d2 = dx * dx + dy * dy;
  if (d2 > sig * sig) {
    const k = sig / Math.sqrt(d2);
    dx *= k;
    dy *= k;
  }
  const w = sim.map.width || 20;
  const h = sim.map.height || 12;
  out[0] = Math.min(w, Math.max(0, t.x + dx));
  out[1] = Math.min(h, Math.max(0, t.y + dy));
  return out;
}

/**
 * Sets a girl's flight mode. Hold uses (ax, ay); Patrol flies between (ax, ay) and (bx, by);
 * points are pulled inside her signal range. Hover and Pursuit keep the points last set (so
 * switching back to Hold returns to the same spot). @returns {boolean}
 */
export function setFlight(sim, t, mode, ax, ay, bx, by) {
  if (!t || !hasRoamingDrones(t) || !FLIGHT_MODES.includes(mode)) return false;
  const pts = mode === 'hold' || mode === 'patrol';
  if (pts && !(Number.isFinite(ax) && Number.isFinite(ay))) return false;
  if (mode === 'patrol' && !(Number.isFinite(bx) && Number.isFinite(by))) return false;
  const fl = t.flight || (t.flight = { mode: 'hover', ax: t.x, ay: t.y, bx: t.x, by: t.y, cx: t.x, cy: t.y, leg: 1 });
  const p = [0, 0];
  if (pts) {
    clampPoint(sim, t, ax, ay, p);
    fl.ax = p[0];
    fl.ay = p[1];
    if (mode === 'patrol') {
      clampPoint(sim, t, bx, by, p);
      fl.bx = p[0];
      fl.by = p[1];
    } else {
      fl.bx = fl.ax;
      fl.by = fl.ay;
    }
    // the wing's centre jumps to the (first) point; the drones themselves fly there at their speed
    fl.cx = fl.ax;
    fl.cy = fl.ay;
    fl.leg = 1;
  }
  fl.mode = mode;
  t._poolLeft = 0;
  for (const d of t.turrets) {
    d.tgt = null;
    d.targetUid = null;
  }
  return true;
}

// Per step: where the wing is (centre), how far drones may roam from it (L) and how far they
// look for quarries (reach), for one girl. Reused scratch (the sim is single-threaded).
const FRAME = { cx: 0, cy: 0, L: 0, reach: 0, hx: 0, hy: 0 };
const PT = [0, 0];

function wingFrame(sim, t, spec, dt) {
  const f = FRAME;
  const fl = t.flight;
  const mode = fl ? fl.mode : 'hover';
  if (mode === 'hold' || mode === 'patrol') {
    if (mode === 'patrol') {
      // the patrol position travels A → B → A …, kept inside the (possibly shrunk) signal range
      const a = clampPoint(sim, t, fl.ax, fl.ay, PT);
      const ax = a[0];
      const ay = a[1];
      const b = clampPoint(sim, t, fl.bx, fl.by, PT);
      const tx = fl.leg ? b[0] : ax;
      const ty = fl.leg ? b[1] : ay;
      const dx = tx - fl.cx;
      const dy = ty - fl.cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      const stepLen = spec.speed * FLIGHT_PATROL_SPEED_MUL * dt;
      if (d <= stepLen) {
        fl.cx = tx;
        fl.cy = ty;
        fl.leg = fl.leg ? 0 : 1;
      } else {
        fl.cx += (dx / d) * stepLen;
        fl.cy += (dy / d) * stepLen;
      }
      f.cx = fl.cx;
      f.cy = fl.cy;
    } else {
      clampPoint(sim, t, fl.ax, fl.ay, PT);
      f.cx = PT[0];
      f.cy = PT[1];
    }
    f.L = spec.leash * FLIGHT_POINT_ROAM_MUL;
    f.reach = f.L + spec.range;
  } else if (mode === 'pursuit') {
    f.cx = t.x;
    f.cy = t.y;
    f.L = Infinity;
    f.reach = Infinity;
  } else {
    f.cx = t.x;
    f.cy = t.y;
    f.L = spec.leash;
    f.reach = f.L + spec.range;
  }
  return f;
}

function validQuarry(e, spec, f) {
  if (e.dead || !isEligible(e, spec)) return false;
  if (f.reach === Infinity) return true;
  const dx = e.x - f.cx;
  const dy = e.y - f.cy;
  return dx * dx + dy * dy <= f.reach * f.reach;
}

/** The girl's target pool for this step: computed at most once per step, reused up to DRONE_POOL_STEPS. */
function dronePool(sim, t, spec, f, st) {
  if (st.fresh) return t._pool;
  const pool = t._pool;
  if (t._poolLeft > 0 && t._poolMode === t.targetMode) {
    for (let i = 0; i < pool.length; i++) if (validQuarry(pool[i], spec, f)) return pool;
  }
  topTargets(sim, f.cx, f.cy, f.reach, spec, t.targetMode, t.turrets.length + 2, pool, t._poolS);
  t._poolLeft = DRONE_POOL_STEPS;
  t._poolMode = t.targetMode;
  st.fresh = true;
  return pool;
}

const POOL_STATE = { fresh: false };

function pickQuarry(sim, t, d, spec, f, focus) {
  const pool = dronePool(sim, t, spec, f, POOL_STATE);
  if (focus) {
    // the wing focuses: everyone on the pool's best valid enemy
    for (let i = 0; i < pool.length; i++) if (validQuarry(pool[i], spec, f)) return pool[i];
    return null;
  }
  // the wing spreads: keep a quarry still among the first max(2, n) valid entries, else take the
  // valid entry with the fewest siblings on it (ties: nearest to this drone for First / Close,
  // better rank otherwise)
  const keepN = Math.max(2, t.turrets.length);
  let seen = 0;
  for (let i = 0; i < pool.length && seen < keepN; i++) {
    if (!validQuarry(pool[i], spec, f)) continue;
    if (pool[i] === d.tgt) return d.tgt;
    seen++;
  }
  const near = t.targetMode === 'first' || t.targetMode === 'close';
  let best = null;
  let bestN = Infinity;
  let bestD = Infinity;
  for (let i = 0; i < pool.length; i++) {
    const e = pool[i];
    if (!validQuarry(e, spec, f)) continue;
    let n = 0;
    for (const o of t.turrets) if (o !== d && o.tgt === e) n++;
    let dd = 0;
    if (near) {
      const dx = e.x - d.x;
      const dy = e.y - d.y;
      dd = dx * dx + dy * dy;
    }
    if (n < bestN || (n === bestN && near && dd < bestD)) {
      best = e;
      bestN = n;
      bestD = dd;
    }
  }
  return best;
}

/** Closest eligible enemy within the gun's range of a drone (a target of opportunity). */
function opportunity(sim, d, spec) {
  const c = gatherTargets(sim, d.x, d.y, spec.range, spec, sim._scratch);
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < c.length; i++) {
    const dx = c[i].x - d.x;
    const dy = c[i].y - d.y;
    const dd = dx * dx + dy * dy;
    if (dd < bestD) {
      bestD = dd;
      best = c[i];
    }
  }
  c.length = 0;
  return best;
}

function updateRoamingDrones(sim, t, spec, dt, ocMul = 1) {
  if (!t._pool) {
    t._pool = [];
    t._poolS = [];
  }
  if (t._poolLeft > 0) t._poolLeft--;
  POOL_STATE.fresh = false;
  const f = wingFrame(sim, t, spec, dt);
  const tick = Math.round(sim.time / STEP);
  const focus = t.targetMode === 'strong' || t.targetMode === 'elite';
  const R = spec.range;
  const L = f.L;
  const standoff = R * DRONE_STANDOFF;
  const moveLen = spec.speed * dt;
  const anyEnemy = sim.enemies.length > 0;
  const reload = 1 / Math.max(0.05, spec.rate * ocMul * (f.L === Infinity ? FLIGHT_PURSUIT_RATE_MUL : 1));
  for (const d of t.turrets) {
    d.px = d.x;
    d.py = d.y;
    if (d.cooldown > 0) d.cooldown -= dt;
    if (d.jam > 0) {
      d.jam = Math.max(0, d.jam - dt);
      d.tgt = null;
      d.targetUid = null;
      d.moving = false;
      continue;
    }
    // 1. drop a quarry that died, turned ineligible or left the wing's reach
    let q = d.tgt;
    if (q && (!anyEnemy || !validQuarry(q, spec, f))) q = null;
    const lost = !q && !!d.tgt;
    // 2. look for a quarry on this drone's own schedule
    if (!lost && anyEnemy) {
      const look = q
        ? (tick + 7 * d.slot) % DRONE_RETHINK_STEPS === 0
        : (tick + d.slot) % DRONE_IDLE_STEPS === 0;
      if (look) q = pickQuarry(sim, t, d, spec, f, focus);
    }
    d.tgt = q;
    d.targetUid = q ? q.uid : null;
    // 3. where to be
    let gx;
    let gy;
    let ox = d.x - f.cx;
    let oy = d.y - f.cy;
    const od2 = ox * ox + oy * oy;
    if (od2 > L * L + 1e-9) {
      // outside the roam area (it moved or shrank): straight back to its edge first
      const k = L / Math.sqrt(od2);
      gx = f.cx + ox * k;
      gy = f.cy + oy * k;
    } else if (q) {
      const dx = d.x - q.x;
      const dy = d.y - q.y;
      const dq = Math.sqrt(dx * dx + dy * dy);
      if (dq > standoff) {
        gx = q.x + (dx / dq) * standoff;
        gy = q.y + (dy / dq) * standoff;
        ox = gx - f.cx;
        oy = gy - f.cy;
        const g2 = ox * ox + oy * oy;
        if (g2 > L * L) {
          const k = L / Math.sqrt(g2);
          gx = f.cx + ox * k;
          gy = f.cy + oy * k;
        }
      } else {
        gx = d.x;
        gy = d.y;
      }
    } else {
      gx = f.cx + d.hx;
      gy = f.cy + d.hy;
    }
    // 4. fly there (straight line, constant speed, exact arrival)
    const mx = gx - d.x;
    const my = gy - d.y;
    const md = Math.sqrt(mx * mx + my * my);
    if (md <= moveLen) {
      d.x = gx;
      d.y = gy;
    } else {
      d.x += (mx / md) * moveLen;
      d.y += (my / md) * moveLen;
    }
    d.moving = md > 1e-9;
    // 5. fire: at the quarry in gun range, else now and then at the closest enemy on the way
    // (never while the wing flies to a focus target)
    if (d.cooldown > 0) continue;
    let shot = null;
    if (q) {
      const dx = q.x - d.x;
      const dy = q.y - d.y;
      if (dx * dx + dy * dy <= R * R) shot = q;
    }
    if (!shot && !(focus && q) && anyEnemy && (tick + d.slot) % DRONE_OPP_STEPS === 0) shot = opportunity(sim, d, spec);
    if (!shot) {
      d.cooldown = 0;
      continue;
    }
    d.facing = Math.atan2(shot.x - d.x, shot.y - d.y);
    const gs = droneShot(t, spec);
    spawnProjectile(sim, t, gs.spec, shot, d.x, d.y, {
      kind: 'bullet', speed: TURRET_PROJECTILE_SPEED, pierce: gs.pierce, splash: 0, range: R + 1, turretUid: d.uid, drone: d, guided: true,
    });
    d.shots++;
    t.droneShots++;
    d.cooldown += reload;
    sim._emit('attack', { towerUid: t.uid, targetUid: shot.uid, kind: 'bullet', turretUid: d.uid });
  }
}

/**
 * Girls with drones whose attack is another behavior (Chika's bolt, her Tesla coil) build them on
 * their own timer: turret.build seconds (after buffs), else 1 / base rate. Only during waves.
 */
function buildDrones(sim, t, dt) {
  const tur = t.stats.turret;
  if (!tur || t.eff.behavior === 'turret' || sim.state !== 'wave' || t.turrets.length >= tur.max) return;
  t.buildTimer -= dt;
  if (t.buildTimer > 0) return;
  spawnTurret(sim, t);
  t.buildTimer = t.turretSpec.build > 0 ? t.turretSpec.build : 1 / Math.max(0.05, t.def.base?.rate || 0.25);
}

// ---------------------------------------------------------------------------
// Potential (src/sim/potential.js): the rhythm (N3, N15), tempo (N14) and her drones' overclock (N11).
// Every field here is created on a girl only once her step uses it, so a P1 girl never carries one.
// ---------------------------------------------------------------------------

/**
 * One attack call of a girl with a rhythm: every Nth successful call (t.potCount counts them; a call
 * with no target does not count) runs with t.effProc, then its extras. A hero who levels up inside
 * the call keeps the fresh stats it built (her eff is only put back when it is still the swapped one).
 */
function attackWithProc(sim, t, fn, p) {
  const n = (t.potCount || 0) + 1;
  const due = p.every > 0 && n % p.every === 0 && !!t.effProc;
  const saved = t.eff;
  if (due) {
    t.eff = t.effProc;
    lastFaced = null;
    procBase = saved;
  }
  const used = t.eff;
  let ok;
  try {
    ok = fn(sim, t);
  } finally {
    procBase = null;
  }
  if (t.eff === used) t.eff = saved;
  if (!ok) return false;
  t.potCount = n;
  if (due) procExtras(sim, t, fn, p, lastFaced);
  return true;
}

/** A rhythm's extras after its attack: the event, the echo volley, the nova, the aura boost. */
function procExtras(sim, t, fn, p, first) {
  sim._emit('proc', { towerUid: t.uid, name: p.name || null, of: 'attack', n: t.potCount });
  if (p.echo) {
    // N3 / N15: the behaviour once more (not counted, no tempo stack), the full rhythm or a share of it
    const spec = p.echo === true ? t.effProc : t.effEcho;
    if (spec) {
      const normal = t.eff;
      t.eff = spec;
      echoing = true;
      try {
        if (spec.behavior === 'duel') duelEcho(sim, t);
        else fn(sim, t);
      } finally {
        echoing = false;
      }
      if (t.eff === spec) t.eff = normal;
    }
  }
  if (p.nova && first && t.effProc) {
    // N3 nova: share × her rhythm hit (× her projectiles for a volley) on everything within `radius`
    // of her first target, ascending uid (radius 0: the target only); can crit, carries procStatus
    const nv = p.nova;
    const base = t.effProc;
    const hit = { ...base, damage: base.damage * (nv.share ?? 1) * (nv.volley ? base.projectiles : 1), splash: 0 };
    const victims = nv.radius > 0 ? sim.grid.query(first.x, first.y, nv.radius, []).sort((a, b) => a.uid - b.uid) : [first];
    for (const e of victims) if (!e.dead && isEligible(e, hit)) sim._hit(e, t, hit, 1);
    sim._emit('nova', { towerUid: t.uid, x: first.x, y: first.y, radius: nv.radius || 0 });
  }
  if (p.auraBoost) {
    // N3 auraBoost: her aura × the boost for `time` s (recomputeBuffs reads it; updateTower counts down)
    t.auraBoostLeft = p.auraBoost.time;
    sim._buffsDirty = true;
  }
}

/** N14: a step without a successful attack; `idle` s of them and her tempo stacks return to 0. */
function tempoIdle(sim, t, tempo) {
  const limit = Math.round(tempo.idle / STEP);
  if ((t.tempoIdle || 0) < limit) t.tempoIdle = (t.tempoIdle || 0) + 1;
  if (t.tempoStacks > 0 && t.tempoIdle >= limit) {
    t.tempoStacks = 0;
    sim._emit('tempo', { towerUid: t.uid, stacks: 0 });
  }
}

/** N14: a successful attack (never an echo) adds a stack up to round(max / per) and resets the idle count. */
function tempoStack(sim, t, tempo) {
  t.tempoIdle = 0;
  const stacks = t.tempoStacks || 0;
  if (stacks < Math.round(tempo.max / tempo.per)) {
    t.tempoStacks = stacks + 1;
    sim._emit('tempo', { towerUid: t.uid, stacks: t.tempoStacks });
  } else if (t.tempoStacks == null) t.tempoStacks = stacks;
}

/**
 * N11: her drones' overclock. The timer starts when she is placed: the first one comes after
 * every − time s, then one every `every` s, each lasting `time` s.
 */
function tickOverclock(sim, t, oc, dt) {
  const o = t.potOc || (t.potOc = { cd: oc.every - (oc.time ?? 0), left: 0 });
  if (o.left > 0) o.left = Math.max(0, o.left - dt);
  o.cd -= dt;
  if (o.cd <= 0) {
    o.cd += oc.every;
    o.left = oc.time ?? 0;
    sim._emit('proc', { towerUid: t.uid, name: null, of: 'overclock', time: o.left });
  }
}

/** One fixed step of a tower: disable timer, turrets, cooldown and attacks. */
export function updateTower(sim, t, dt) {
  const s = t.stats;
  // Potential timers that run even while she is sabotaged: her tempo's idle count, an aura boost
  if (s.tempo) tempoIdle(sim, t, s.tempo);
  if (t.auraBoostLeft > 0) {
    t.auraBoostLeft -= dt;
    if (t.auraBoostLeft <= 0) {
      t.auraBoostLeft = 0;
      sim._buffsDirty = true;
    }
  }
  if (t.disabled > 0) {
    t.disabled = Math.max(0, t.disabled - dt);
    return;
  }
  if (t.moveLock > 0) return; // a hero repositioning mid-wave (hero.js moveHero)
  if (s.turret?.overclock) tickOverclock(sim, t, s.turret.overclock, dt);
  if (s.strip) stripTick(sim, t, dt);
  if (s.ring) ringTick(sim, t, dt);
  if (s.halo) wheelTick(sim, t);
  if (s.drink) drinkTick(sim, t);
  if (s.sentry) sentryTick(sim, t, dt);
  if (s.vine) vineTick(sim, t, dt);
  if (s.ball) ballTick(sim, t, dt);
  buildDrones(sim, t, dt);
  updateTurrets(sim, t, dt);
  const fn = BEHAVIORS[t.eff.behavior];
  if (!fn) return;
  if (t.cooldown > 0) t.cooldown -= dt;
  const proc = s.proc && s.proc.of !== 'trap' ? s.proc : null;
  const tempo = s.tempo || null;
  let guard = 0;
  while (t.cooldown <= 0 && guard++ < 4) {
    const gn = beginGear(t);
    const ok = proc ? attackWithProc(sim, t, fn, proc) : fn(sim, t);
    endGear(sim, t, gn, ok);
    if (!ok) {
      t.cooldown = 0;
      break;
    }
    if (tempo) tempoStack(sim, t, tempo);
    if (t.hydrated) useDrink(sim, t); // Wakaba's drink: a charge per successful attack (src/sim/drinks.js)
    // Chigusa's Bloom Rush (src/sim/vines.js): faster for every second she keeps attacking
    const bloom = s.vine?.bloom > 0 ? 1 + Math.min(s.vine.bloom, s.vine.bloomPer * (t.bloomT || 0)) : 1;
    if (s.vine?.bloom > 0) t.bloomIdle = 0;
    t.cooldown += 1 / Math.max(0.05, (tempo ? t.eff.rate * (1 + tempo.per * t.tempoStacks) : t.eff.rate) * bloom);
  }
}

// ---------------------------------------------------------------------------
// Projectiles and traps
// ---------------------------------------------------------------------------

/** A guided drone bullet: flies at its own target, can hit only it, fizzles once it is gone. */
function guidedStep(sim, p, dt) {
  const tgt = p.target;
  if (!tgt || tgt.dead || !isEligible(tgt, p.spec)) {
    p.dead = true;
    sim._emit('fizzle', { uid: p.uid, x: p.x, y: p.y, turretUid: p.turretUid });
    return;
  }
  const ax = p.x;
  const ay = p.y;
  const dx = tgt.x - ax;
  const dy = tgt.y - ay;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 1e-5) {
    p.vx = (dx / d) * p.speed;
    p.vy = (dy / d) * p.speed;
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.travel += p.speed * dt;
  p.targetAlt = tgt.alt || 0;
  const hr = hitRadius(tgt);
  if (segDistSq(tgt.x, tgt.y, ax, ay, p.x, p.y) <= hr * hr) {
    p.dead = true;
    p.hits.push(tgt.uid);
    const hx = tgt.x;
    const hy = tgt.y;
    sim._hit(tgt, p.owner, p.spec, 1, p.drone);
    // gear Pierce on a drone bullet: it goes on through the nearest enemies just behind its target
    if (p.pierce > 1) guidedPierce(sim, p, hx, hy, tgt);
    return;
  }
  if (p.travel >= p.maxTravel) {
    p.dead = true;
    return;
  }
  const f = Math.min(1, p.travel / Math.max(0.5, p.est));
  p.z = PROJECTILE_Z + p.targetAlt * f;
}

/** Radius (tiles) a piercing drone bullet carries on through after its target. */
const DRONE_PIERCE_REACH = 0.6;
function guidedPierce(sim, p, x, y, first) {
  const near = sim.grid.query(x, y, DRONE_PIERCE_REACH, []);
  const c = near.filter((e) => e !== first && !e.dead && isEligible(e, p.spec));
  c.sort((a, b) => ((a.x - x) ** 2 + (a.y - y) ** 2) - ((b.x - x) ** 2 + (b.y - y) ** 2) || a.uid - b.uid);
  for (const e of c.slice(0, p.pierce - 1)) {
    p.hits.push(e.uid);
    sim._hit(e, p.owner, p.spec, 1, p.drone);
  }
}

function projectileStep(sim, p, dt) {
  if (p.guided) {
    guidedStep(sim, p, dt);
    return;
  }
  const tgt = p.target;
  if (tgt) {
    // Stop homing on targets that died, were already hit, or turned intangible/hidden mid-flight.
    if (tgt.dead || p.hits.includes(tgt.uid) || !isEligible(tgt, p.spec)) p.target = null;
    else {
      p.tx = tgt.x;
      p.ty = tgt.y;
      p.targetAlt = tgt.alt || 0;
    }
  }
  const homing = !!p.target || (p.splash > 0 && p.hits.length === 0);
  if (homing) {
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 1e-5) {
      p.vx = (dx / d) * p.speed;
      p.vy = (dy / d) * p.speed;
    }
  }
  const ax = p.x;
  const ay = p.y;
  const stepLen = p.speed * dt;
  // A splash shell whose target vanished lands on the last known spot.
  if (!p.target && p.splash > 0) {
    const dl = Math.hypot(p.tx - ax, p.ty - ay);
    if (dl <= stepLen) {
      p.x = p.tx;
      p.y = p.ty;
      explode(sim, p.owner, p.spec, p.x, p.y, p.splash);
      p.dead = true;
      return;
    }
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.travel += stepLen;

  // Swept collision along the segment travelled this step (no tunnelling at any speed).
  const near = sim.grid.query((ax + p.x) / 2, (ay + p.y) / 2, stepLen / 2 + 0.9, sim._scratch2);
  let contacts = null;
  for (let i = 0; i < near.length; i++) {
    const e = near[i];
    if (p.hits.includes(e.uid)) continue;
    const hr = hitRadius(e);
    if (segDistSq(e.x, e.y, ax, ay, p.x, p.y) > hr * hr) continue;
    if (!isEligible(e, p.spec)) continue;
    (contacts || (contacts = [])).push(e);
  }
  sim._scratch2.length = 0;
  if (contacts) {
    if (contacts.length > 1) {
      contacts.sort((a, b) => projectOnSegment(a.x, a.y, ax, ay, p.x, p.y) - projectOnSegment(b.x, b.y, ax, ay, p.x, p.y));
    }
    for (const e of contacts) {
      if (e.dead) continue;
      if (p.splash > 0) {
        p.hits.push(e.uid);
        explode(sim, p.owner, p.spec, e.x, e.y, p.splash);
        p.dead = true;
        return;
      }
      p.hits.push(e.uid);
      sim._hit(e, p.owner, p.spec, p.scale ?? 1);
      p.pierce--;
      if (p.pierce <= 0) {
        p.dead = true;
        return;
      }
    }
  }
  if (p.travel >= p.maxTravel) {
    p.dead = true;
    return;
  }
  const f = Math.min(1, p.travel / Math.max(0.5, p.est));
  p.z = p.arc > 0 ? PROJECTILE_Z + p.arc * 4 * f * (1 - f) : PROJECTILE_Z + p.targetAlt * f;
}

/** Moves every projectile, resolves contacts, removes spent ones. */
export function updateProjectiles(sim, dt) {
  const list = sim.projectiles;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (p.owner.removed && !p.dead) p.dead = true;
    if (!p.dead) projectileStep(sim, p, dt);
  }
  let n = 0;
  for (let i = 0; i < list.length; i++) if (!list[i].dead) list[n++] = list[i];
  list.length = n;
}

/** Arms traps and triggers armed traps on the first eligible ground enemy in reach. */
export function updateTraps(sim, dt) {
  const list = sim.traps;
  let removedAny = false;
  for (let i = 0; i < list.length; i++) {
    const tr = list[i];
    if (tr.strip) {
      if (stripStep(sim, tr, dt)) {
        tr.dead = true;
        removedAny = true;
        if (!tr.extra) tr.owner.trapCount = Math.max(0, tr.owner.trapCount - 1);
      }
      continue;
    }
    if (!tr.armed) {
      tr.armLeft -= dt;
      if (tr.armLeft <= 0) tr.armed = true;
      continue;
    }
    const spec = tr.owner.trapSpec;
    if (!spec) continue;
    let trigger = null;
    sim.grid.each(tr.x, tr.y, spec.triggerRadius, (e) => {
      if (isEligible(e, spec)) {
        trigger = e;
        return true;
      }
      return false;
    });
    if (!trigger) continue;
    tr.dead = true;
    removedAny = true;
    const owner = tr.owner;
    owner.trapCount = Math.max(0, owner.trapCount - 1);
    sim._emit('trapTriggered', { uid: tr.uid, x: tr.x, y: tr.y, ownerUid: tr.ownerUid });
    // Potential N3 on traps (Suzu): every Nth of her traps that goes off is the rhythm's
    const p = owner.stats?.proc;
    let boom = spec;
    if (p && p.of === 'trap') {
      owner.potCount = (owner.potCount || 0) + 1;
      if (p.every > 0 && owner.potCount % p.every === 0 && owner.trapSpecProc) {
        boom = owner.trapSpecProc;
        sim._emit('proc', { towerUid: owner.uid, name: p.name || null, of: 'trap', n: owner.potCount, x: tr.x, y: tr.y });
      }
    }
    // Taiko's Big Beat on traps: every 10th of her traps that goes off hits 50 % harder
    if (trickClub(owner.unitStats) === TRICK.bigBeat.club) {
      owner.trapBeatN = ((owner.trapBeatN || 0) + 1) % TRICK.bigBeat.every;
      if (owner.trapBeatN === 0) {
        boom = { ...boom, damage: boom.damage * TRICK.bigBeat.mul };
        sim._emit('clubTrick', { towerUid: owner.uid, kind: 'bigBeat' });
      }
    }
    // Archery's Follow-Through on traps: every 5th of her traps that goes off blasts as with +100 % Pierce
    let splash = boom.splash;
    if (trickClub(owner.unitStats) === TRICK.followThrough.club) {
      owner.trapFtN = ((owner.trapFtN || 0) + 1) % TRICK.followThrough.every;
      if (owner.trapFtN === 0) {
        splash *= followThroughBlast(owner.unitStats);
        sim._emit('clubTrick', { towerUid: owner.uid, kind: 'followThrough' });
      }
    }
    explode(sim, owner, boom, tr.x, tr.y, Math.max(splash, boom.triggerRadius));
  }
  if (removedAny) {
    let n = 0;
    for (let i = 0; i < list.length; i++) if (!list[i].dead) list[n++] = list[i];
    list.length = n;
  }
}

let popping = false;
/**
 * Pyrotechnics' Finale Pop (gear-stats §C.3): an enemy she defeats bursts for 25 % of her hit within
 * 0.9 tiles. Pops never pop, never crit and carry no status; one budget for the whole battle
 * (sim.popBudget, half-pops) keeps a crowd of pyro girls inside the frame budget.
 */
export function finalePop(sim, tower, e) {
  if (popping || !tower || tower.removed || trickClub(tower.unitStats) !== TRICK.finalePop.club) return;
  if (!(sim.popBudget >= POP_COST) || !tower.eff) return;
  sim.popBudget -= POP_COST;
  const spec = {
    ...tower.eff, damage: tower.eff.damage * TRICK.finalePop.share, critChance: 0, status: [], mark: null, silence: 0, reveal: 0,
    knockback: 0, hpPct: null,
  };
  popping = true;
  try {
    explode(sim, tower, spec, e.x, e.y, TRICK.finalePop.radius);
  } finally {
    popping = false;
  }
  sim._emit('clubTrick', { towerUid: tower.uid, kind: 'finalePop' });
}

/** Base cost of a unit before difficulty/profile multipliers. */
export function baseCost(def) {
  return normalizeBase(def.base, def).cost;
}
