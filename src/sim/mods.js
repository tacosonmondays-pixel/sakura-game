// Tower stat resolution: BaseStats + ModSets (upgrade tiers, hero milestones, awaken
// passive, Potential steps) + profile battle stats. Implements the ModSet table in CONTRACTS.md §3 exactly:
// add keys are summed, mul keys multiplied, grants OR-ed, replace keys take the last
// value, status lists merge by type keeping the stronger numbers.
// Potential v3 keys (src/data/potential.js; mechanics in src/sim/potential.js) are understood here
// too and appear on the stats ONLY when a step sets them, so a girl at P1 resolves exactly as before:
// statusAdd (adds onto a status she has), proc (her rhythm), ult (a hero's ultimate), aura.rangeAdd /
// aura.foeVuln, turret.overclock, brew / link targetsAdd, bountyAura, harvest, dotSpread, keepRamp,
// projScale, tempo, classMul.

import { DEFAULT_UNIT_STATS } from './constants.js';
import { HERO_GROWTH } from '../data/heroTracks.js';
import { potentialFold } from '../data/potential.js';
import { BREW_TARGETS_MAX, SPIN_TURN, SPIN_LOCK, STREAM_HALF, STREAM_TURN, SWEEP_ARC, SWEEP_SWING, SWEEP_TURN } from './constants.js';
import { BLAST_PER_PIERCE, PIERCE_K_MAX } from './gearRules.js';
import { BARRICADES_PER_HERO } from './constants.js';

const ADD_KEYS = ['range', 'projectiles', 'pierce', 'chain', 'maxTargets', 'splash', 'armorPen', 'projectileSpeed', 'silence', 'reveal', 'knockback', 'gather'];
const MUL_KEYS = ['rateMul', 'eliteMul', 'bossMul', 'barrierMul', 'airMul'];
const REPLACE_KEYS = ['attackType', 'element', 'behavior'];

function normAura(a = {}) {
  return {
    range: a.range ?? 0,
    dmgMul: a.dmgMul ?? 1,
    rateMul: a.rateMul ?? 1,
    rangeMul: a.rangeMul ?? 1,
    detection: !!a.detection,
    costCut: a.costCut ?? 0,
    cleanse: !!a.cleanse,
    armorPen: a.armorPen ?? 0,
    critChance: a.critChance ?? 0,
  };
}

/** A limited buff (Midori's brew, Chika's tune-up link): `targets` girls, ×dmgMul ×rateMul, +armorPen +critChance. */
function normLimited(b = {}) {
  return {
    targets: b.targets ?? 0,
    dmgMul: b.dmgMul ?? 1,
    rateMul: b.rateMul ?? 1,
    armorPen: b.armorPen ?? 0,
    critChance: b.critChance ?? 0,
    overclock: b.overclock ? { every: b.overclock.every ?? 20, time: b.overclock.time ?? 6, rateMul: b.overclock.rateMul ?? 1 } : null,
  };
}

function normTrap(t = {}) {
  return {
    max: t.max ?? 0,
    damage: t.damage ?? 0,
    triggerRadius: t.triggerRadius ?? 0.6,
    armTime: t.armTime ?? 1.0,
    splash: t.splash ?? 0.8,
    status: (t.status || []).map((s) => ({ ...s })),
  };
}

/**
 * Spike strips (Azami, UNIT_GAPS §5.3; src/sim/strips.js): a trap girl whose traps are strips with a hit
 * budget and a lifetime. Only a girl whose base declares `strip` carries this block, so every other
 * girl resolves exactly as before it existed. Numbers add, flags OR (a ModSet's `strip`).
 *   hits     hits per strip (an enemy is hit once per strip)     ttl   seconds a strip lives
 *   forever  strips last until used up                          carry strips carry into the next wave
 *   boom     damage when a strip runs out or expires (radius boomR, stun boomStun s)
 *   air      share of the strip's damage on flyers (0 = ground only)
 *   aim      Checkpoint mode (strips near her aim point)         opening  s of ×4 laying at each wave start
 *   lanes    Spread mode covers every lane in range              pair  Spread lays 2 at a time
 *   rain     every `rain` s of wave time a small Spike Rain of rainCount strips lays itself
 */
function normStrip(t = {}) {
  return {
    hits: t.hits ?? 6,
    ttl: t.ttl ?? 30,
    forever: !!t.forever,
    carry: !!t.carry,
    boom: t.boom ?? 0,
    boomR: t.boomR ?? 1,
    boomStun: t.boomStun ?? 0,
    air: t.air ?? 0,
    aim: !!t.aim,
    opening: t.opening ?? 0,
    lanes: !!t.lanes,
    pair: !!t.pair,
    rain: t.rain ?? 0,
    rainCount: t.rainCount ?? 0,
  };
}

const STRIP_FLAGS = ['forever', 'carry', 'aim', 'lanes', 'pair'];

/**
 * The 360° ring (Kinu, UNIT_GAPS §5.4; src/sim/rings.js): her pins are her projectiles (count) and her
 * pierce; this block holds the rest. Only a girl whose base declares `ring` carries it.
 *   travel   tiles a pin flies          turn     each ring turns 1/16 (Twin Spools)
 *   heat     an expanding heat ring instead of pins (Iron Ring); double: two per attack
 *   sparks   enemies her heat ring finishes while burning throw 4 sparks (Molten Hem)
 *   scissors orbiting scissor pairs; scissorDmg each cut (× scissorMul)
 *   spiral   Blade Spiral spirals (her ⚡ boost sets it); spiralPierce the blades' pierce
 */
function normRing(t = {}) {
  return {
    travel: t.travel ?? 1.8,
    turn: !!t.turn,
    heat: !!t.heat,
    double: !!t.double,
    sparks: !!t.sparks,
    scissors: t.scissors ?? 0,
    scissorDmg: t.scissorDmg ?? 8,
    scissorMul: t.scissorMul ?? 1,
    spiral: t.spiral ?? 0,
    spiralPierce: t.spiralPierce ?? 0,
  };
}
const RING_FLAGS = ['turn', 'heat', 'double', 'sparks'];

/**
 * Attack shapes S1 (docs/specs/ATTACK_SHAPES.md §5; src/sim/wheels.js). Unlike the kits above these
 * blocks may first appear on a tier (a path that turns into a shape): the first mod that names one
 * creates it, later mods add the counts and replace `lead`, `mul`, `turn` and `lock` (each tier states
 * its own: the per-tier DPS parity numbers of the bench, docs/specs/ATTACK_SHAPES.md addendum).
 *   wheel  spokes (shots a Blossom Wheel), lead × the aimed spoke's hit, mul × every other spoke's
 *   spin   arms (Pinwheel Stream arms), mul × the spinning arms' parity damage, fold × the folded stream's
 *          (one enemy in range), turn / lock table steps a shot
 *   halo   pieces (Petal Halo pieces), reach tiles past HALO_REACH, mul × each cut (× her rate)
 * S2 "Held" (src/sim/held.js), every field stated per tier:
 *   stream kind (held.js STREAM_KINDS; only 'fire' in use), half (half-angle, table steps), turn (table steps a
 *          sim step), mul × each tick's parity share, cap (victims a tick at most, nearest first)
 *   sweep  arc (table steps either side of the centre), swing (table steps a sim step), turn (the centre's table
 *          steps a sim step), mul × each hit's parity share, cap (enemies a pass at most; 0: her maxTargets)
 * S3 "Ground" (src/sim/ground.js), every field stated per tier:
 *   spike  count (spikes a row), gap (tiles between two spikes along the road), r (a spike's radius, tiles), delay
 *          (steps between two spikes rising), mul × her hit on each enemy the row strikes
 *   quake  rings (rings a strike), gap (steps between two rings starting), speed (tiles a second), mul × her plain hit
 *          for the first ring, later × for the others, status (statuses the last ring adds to hers)
 * S4 "Links" (src/sim/links.js), every field stated per tier:
 *   ret    per (fans a throw: her projectiles × per), mul × her hit on the first enemy a leg cuts, cut × on the others,
 *          pierce (enemies a leg cuts), reach (× her range: how far a fan flies out)
 *   tether links (enemies tied to her target), reach (tiles from one tied enemy to the next), dur (s), share (each other
 *          member's share of a hit), pull (on expiry: the gap to the lead closed, 0 = none)
 */
function normWheel() {
  return { spokes: 0, lead: 1, mul: 1 };
}
function normSpin() {
  return { arms: 0, mul: 1, fold: 1, turn: SPIN_TURN, lock: SPIN_LOCK };
}
function normHalo() {
  return { pieces: 0, reach: 0, mul: 1 };
}
function normStream() {
  return { kind: 'fire', half: STREAM_HALF, turn: STREAM_TURN, mul: 1, cap: 6 };
}
function normSweep() {
  return { arc: SWEEP_ARC, swing: SWEEP_SWING, turn: SWEEP_TURN, mul: 1, cap: 0 };
}
function normSpike() {
  return { count: 4, gap: 0.5, r: 0.3, delay: 3, mul: 1 };
}
function normQuake() {
  return { rings: 2, gap: 12, speed: 6, mul: 1, later: 0.6, status: [] };
}
function normRet() {
  return { per: 0.5, mul: 1, cut: 0, pierce: 1, reach: 1 };
}
function normTether() {
  return { links: 2, reach: 1.5, dur: 3, share: 0.2, pull: 0 };
}
const SHAPE_NORM = { wheel: normWheel, spin: normSpin, halo: normHalo, stream: normStream, sweep: normSweep, spike: normSpike, quake: normQuake, ret: normRet, tether: normTether };
const SHAPE_ADDS = { wheel: ['spokes'], spin: ['arms'], halo: ['pieces', 'reach'], stream: [], sweep: [], spike: [], quake: [], ret: [], tether: [] };
const SHAPE_SETS = {
  wheel: ['lead', 'mul'], spin: ['mul', 'fold', 'turn', 'lock'], halo: ['mul'],
  stream: ['kind', 'half', 'turn', 'mul', 'cap'], sweep: ['arc', 'swing', 'turn', 'mul', 'cap'],
  spike: ['count', 'gap', 'r', 'delay', 'mul'], quake: ['rings', 'gap', 'speed', 'mul', 'later', 'status'],
  ret: ['per', 'mul', 'cut', 'pierce', 'reach'], tether: ['links', 'reach', 'dur', 'share', 'pull'],
};

/**
 * The buff thrower (Wakaba, UNIT_GAPS §5.6; src/sim/drinks.js): what her sports drink does. Bonuses
 * add (dmg 0.2 = +20% damage); only a girl whose base declares `drink` carries it.
 *   splash  tiles around the target girl     shots  attacks a drink lasts
 *   dmg / rate / range  Hydrated bonuses      pierce  extra pierce while Hydrated
 *   detection (Coach's Eye) · cleanse (Ice Pack) · permanent (Secret Formula)
 *   season  every girl within this many tiles carries it at all times (Championship Season)
 *   towel / towelDmg  Towel Snap flicks       life  a life back after a clean wave (Recovery Plan)
 */
function normDrink(t = {}) {
  return {
    splash: t.splash ?? 0.8,
    shots: t.shots ?? 8,
    dmg: t.dmg ?? 0,
    rate: t.rate ?? 0.15,
    range: t.range ?? 0.1,
    pierce: t.pierce ?? 0,
    detection: !!t.detection,
    cleanse: !!t.cleanse,
    permanent: !!t.permanent,
    season: t.season ?? 0,
    towel: !!t.towel,
    towelDmg: t.towelDmg ?? 2,
    life: !!t.life,
  };
}
const DRINK_FLAGS = ['detection', 'cleanse', 'permanent', 'towel', 'life'];

/**
 * The sentry builder (Yuzuha, UNIT_GAPS §5.2; src/sim/sentries.js): her lane sentries and nets. Only a
 * girl whose base declares `sentry` carries it. Numbers add (rate multiplies), flags OR.
 *   max · every (s per sentry) · speed (deploys faster: every / (1 + speed)) · ttl (s)
 *   damage · rate (shots/s, ×) · range · burst (damage when one runs out) · kits (Specialist Kits)
 *   nets · netBudget (HP a wave) · netElite · netBoss (what a net may catch)
 */
function normSentry(t = {}) {
  return {
    max: t.max ?? 2,
    every: t.every ?? 6,
    speed: t.speed ?? 0,
    ttl: t.ttl ?? 20,
    damage: t.damage ?? 3,
    rate: t.rate ?? 1.2,
    range: t.range ?? 2,
    burst: t.burst ?? 0,
    kits: !!t.kits,
    nets: t.nets ?? 0,
    netBudget: t.netBudget ?? 0,
    netElite: !!t.netElite,
    netBoss: !!t.netBoss,
  };
}
const SENTRY_FLAGS = ['kits', 'netElite', 'netBoss'];

/**
 * The campus hub (Ouka, UNIT_GAPS §5.5; src/sim/hubs.js): the rules inside her office radius and her
 * banners. Only a girl whose base declares `hub` carries it. A tier states the new value of a rule
 * (strongest wins: radius 3.2, costCut 0.14, …), flags OR; radiusAdd / cutAdd add on top afterwards
 * (awaken passive, Potential).
 *   radius (tiles) · costCut (upgrades in her radius) · sellMul (their sell value) · freeTiers (free
 *   first tiers per path) · killBounty (coins a kill inside her radius) · cdCut (faster ability charge)
 *   rateMul / rangeMul / dmgMul · detection · airGrant (they can hit flyers) · cleanse (and no sabotage)
 *   typeFloor (type chart floor) · banners (how many) · bannerRange · bannerReach (how far she plants one)
 */
function normHub(t = {}) {
  return {
    radius: t.radius ?? 2.6,
    costCut: t.costCut ?? 0,
    sellMul: t.sellMul ?? 0,
    freeTiers: t.freeTiers ?? 0,
    killBounty: t.killBounty ?? 0,
    cdCut: t.cdCut ?? 0,
    rateMul: t.rateMul ?? 1,
    rangeMul: t.rangeMul ?? 1,
    dmgMul: t.dmgMul ?? 1,
    detection: !!t.detection,
    airGrant: !!t.airGrant,
    cleanse: !!t.cleanse,
    typeFloor: t.typeFloor ?? 0,
    banners: t.banners ?? 0,
    bannerRange: t.bannerRange ?? 1.6,
    bannerReach: t.bannerReach ?? 5,
    radiusAdd: t.radiusAdd ?? 0,
    cutAdd: t.cutAdd ?? 0,
  };
}
const HUB_MAX = ['radius', 'costCut', 'sellMul', 'freeTiers', 'killBounty', 'cdCut', 'rateMul', 'rangeMul', 'dmgMul', 'typeFloor', 'banners', 'bannerRange', 'bannerReach'];
const HUB_FLAGS = ['detection', 'airGrant', 'cleanse'];
const HUB_ADDS = ['radiusAdd', 'cutAdd'];

/**
 * The nature caster (Chigusa, UNIT_GAPS §5.7; src/sim/vines.js): her Bramble Road vines (attack shapes S3), thorn
 * beds, Bloom Rush and harvest lives. Only a girl whose base declares `vine` carries it. Every number adds.
 *   every (s per vine) · hold (s her vine holds the first walker it reaches) · dps (a lash's damage a second, on
 *   each walker on the vine; 0 = no lash) · lash (s between lashes) · cap (walkers a lash hits, lead first; 0 = all)
 *   len (tiles a vine grows) · grow (tiles a second) · life (s a vine stands) · slow (on the walkers on it) · max
 *   (her vines standing at once)
 *   beds (hits per thorn bed; 0 = none) · bedDmg · bedTtl (s)
 *   bloom (Bloom Rush cap, 0.6 = +60% attack speed) · bloomPer (a second of attacking) · bloomIdle (s)
 *   lives (a wave cleared) · livesCap (a battle)
 */
function normVine(t = {}) {
  return {
    every: t.every ?? 6,
    hold: t.hold ?? 1,
    dps: t.dps ?? 0,
    lash: t.lash ?? 1,
    cap: t.cap ?? 0,
    len: t.len ?? 2,
    grow: t.grow ?? 4,
    life: t.life ?? 3,
    slow: t.slow ?? 0.2,
    max: t.max ?? 1,
    beds: t.beds ?? 0,
    bedDmg: t.bedDmg ?? 2,
    bedTtl: t.bedTtl ?? 8,
    bloom: t.bloom ?? 0,
    bloomPer: t.bloomPer ?? 0.05,
    bloomIdle: t.bloomIdle ?? 2,
    lives: t.lives ?? 0,
    livesCap: t.livesCap ?? 30,
  };
}
/**
 * The bowler (Marumi, UNIT_GAPS §5.9; src/sim/balls.js): her rolling bomb balls. Only a girl whose base
 * declares `ball` carries it. Numbers add, flags OR.
 *   travel (tiles) · speed (tiles/s) · through (walkers bowled through first) · share (× of a blast on
 *   the others in it; the walker the ball meets takes it all) · lob (her lob at flyers, base kit) ·
 *   lobMul (× of her blast a lob carries)
 *   pins · pinDmg · pinPierce (pins on one walker at most) · hook (Hook Spin)
 *   pushBig (Bowling Thunder: minibosses take her whole push)
 *   bounce (ricochets after a blast; 0 = none) · reach (tiles to the next walker) · finish (× of the
 *   Glow Bowl finale after the last bounce; 0 = none)
 */
function normBall(t = {}) {
  return {
    travel: t.travel ?? 4,
    speed: t.speed ?? 4,
    through: t.through ?? 0,
    share: t.share ?? 0.5,
    lobMul: t.lobMul ?? 0.5,
    pins: t.pins ?? 0,
    pinDmg: t.pinDmg ?? 4,
    pinPierce: t.pinPierce ?? 2,
    hook: !!t.hook,
    lob: !!t.lob,
    pushBig: !!t.pushBig,
    bounce: t.bounce ?? 0,
    reach: t.reach ?? 2,
    finish: t.finish ?? 0,
  };
}
/**
 * The duo (Kohaku & Tsubaki, docs/specs/DUO_LR.md §1; src/sim/duo.js): Kohaku's prism beam (the partner weapon)
 * and Refraction (Tsubaki's shells that split into shards). Only a unit whose base declares `duo` carries it.
 *   beamDmg · beamRate (attacks a second, ×) · beamRange · beamPierce · beams (beams per attack) · beamPen
 *   (armour ignored) · beamAir (× vs flyers) · beamMul (× beam damage) · rampPer / rampMax (Resonant Light) ·
 *   beamSilence (s)
 *   every (every Nth shell splits; the smallest wins, 0 never) · shards (per split shell; the largest wins) ·
 *   shardAdd (more shards on top) · shardShare (× of the shell hit) · shardDmg (flat on top) · shardSplash ·
 *   shardSlow / slowTime · shardShred · shardVuln (Brittle for vulnTime s) · fullEvery (every Nth volley
 *   splits completely; 0 never; the smallest wins: Potential P6)
 */
function normDuo(t = {}) {
  return {
    beamDmg: t.beamDmg ?? 0,
    beamRate: t.beamRate ?? 1,
    beamRange: t.beamRange ?? 3,
    beamPierce: t.beamPierce ?? 1,
    beams: t.beams ?? 1,
    beamPen: t.beamPen ?? 0,
    beamAir: t.beamAir ?? 1,
    beamMul: t.beamMul ?? 1,
    rampPer: t.rampPer ?? 0,
    rampMax: t.rampMax ?? 0,
    beamSilence: t.beamSilence ?? 0,
    every: t.every ?? 0,
    shards: t.shards ?? 0,
    shardAdd: t.shardAdd ?? 0,
    shardShare: t.shardShare ?? 0.4,
    shardDmg: t.shardDmg ?? 0,
    shardSplash: t.shardSplash ?? 0.6,
    shardSlow: t.shardSlow ?? 0,
    slowTime: t.slowTime ?? 0,
    shardShred: t.shardShred ?? 0,
    shardVuln: t.shardVuln ?? 0,
    vulnTime: t.vulnTime ?? 3,
    fullEvery: t.fullEvery ?? 0,
    // the long beam (Grand Spectrum): 1 = her beams run on to the map edge (src/sim/duo.js)
    edge: t.edge ?? 0,
  };
}
/**
 * Norika's barricades (BANNERS §D.4; src/sim/barricades.js): only a hero whose base declares `barricade`
 * carries this block, so every other girl resolves exactly as before it existed. Numbers add (budgetMul
 * multiplies; rebuild: the shortest wins), flags OR.
 *   count     her own barricades on the road (at most BARRICADES_PER_HERO)
 *   budget    hold budget of each (× budgetMul)                rebuild / rebuildCut  seconds to rebuild a broken one
 *   held      held enemies take +held damage (also Hold the Line's on top)   reveal  held enemies are revealed
 *   bounce    tiles an enemy reaching a full barricade is knocked back, once   breakSlow  a breaking barricade's slow
 *   releaseSlow  enemies a breaking barricade releases are slowed    miniHalf  minibosses drain at half rate
 *   detour    Detour Sign (forks: her waves send enemies down the longer branch; no forks: +50% budget)
 *   oneWay    once per wave, the first N enemies to reach her barricades are sent back      lineAdd  Hold the Line +N
 */
function normBarricade(t = {}) {
  return {
    count: t.count ?? 1,
    budget: t.budget ?? 120,
    budgetMul: t.budgetMul ?? 1,
    rebuild: t.rebuild ?? 3,
    rebuildCut: t.rebuildCut ?? 0,
    held: t.held ?? 0,
    reveal: !!t.reveal,
    bounce: t.bounce ?? 0,
    breakSlow: t.breakSlow ?? 0,
    releaseSlow: t.releaseSlow ?? 0,
    miniHalf: !!t.miniHalf,
    detour: !!t.detour,
    oneWay: t.oneWay ?? 0,
    lineAdd: t.lineAdd ?? 0,
  };
}
const BARRICADE_ADDS = ['count', 'budget', 'rebuildCut', 'held', 'bounce', 'breakSlow', 'releaseSlow', 'oneWay', 'lineAdd'];
const BARRICADE_FLAGS = ['reveal', 'miniHalf', 'detour'];
const DUO_ADDS = ['beamDmg', 'beamRange', 'beamPierce', 'beams', 'beamPen', 'rampPer', 'rampMax', 'shardAdd', 'shardShare', 'shardDmg', 'shardSplash', 'shardShred', 'shardVuln'];
const DUO_MULS = ['beamRate', 'beamAir', 'beamMul'];
const DUO_MAX = ['shards', 'beamSilence', 'shardSlow', 'slowTime', 'vulnTime', 'edge'];
const DUO_MIN = ['every', 'fullEvery'];
const BALL_ADDS = ['travel', 'speed', 'through', 'share', 'lobMul', 'pins', 'pinDmg', 'pinPierce', 'bounce', 'reach', 'finish'];
const BALL_FLAGS = ['hook', 'lob', 'pushBig'];
const VINE_ADDS = ['every', 'hold', 'dps', 'beds', 'bedDmg', 'bedTtl', 'bloom', 'bloomPer', 'bloomIdle', 'lives', 'livesCap', 'len', 'grow', 'life', 'slow', 'lash', 'cap', 'max'];

/**
 * Kaede's blade arts (her AoE rework; src/sim/towers.js bladeArt): only a girl whose base declares
 * `blade` carries this block, so every other girl resolves exactly as before it existed. Numbers add,
 * shareMul multiplies. Every share is of her plain (unfocused) hit, except the maple splash's, which is
 * of her focused strike. Targets are the most enemies each shape cuts (gear Pierce adds to each).
 *   every            a blade art every Nth strike (her Maple Cleave)
 *   radius · share · targets            the cleave around her target
 *   crescents · cLen · cWidth · cShare · cTargets   wind crescents through her target (Flowing Blade)
 *   storm · sShare · sTargets           the maple blade storm around her (Flowing Blade tier 5)
 *   wave · wWidth · wShare · wTargets   the ground shockwave through her target (Guard Breaker 4-5)
 *   maple · mShare · mTargets           the maple splash of a full-focus strike (Unbroken Rhythm)
 *   shareMul         every share above × this (Potential)
 *   capMax           her focus cap before Potential (resolveStats sets it; the maple splash keys on it)
 */
function normBlade(t = {}) {
  const o = {};
  for (const k of BLADE_ADDS) o[k] = t[k] ?? 0;
  o.shareMul = t.shareMul ?? 1;
  o.capMax = 0;
  return o;
}
const BLADE_ADDS = ['every', 'radius', 'share', 'targets', 'crescents', 'cLen', 'cWidth', 'cShare', 'cTargets', 'storm', 'sShare', 'sTargets', 'wave', 'wWidth', 'wShare', 'wTargets', 'maple', 'mShare', 'mTargets'];

const SENTRY_ADDS = ['max', 'every', 'speed', 'ttl', 'damage', 'range', 'burst', 'nets', 'netBudget'];
const DRINK_ADDS = ['splash', 'shots', 'dmg', 'rate', 'range', 'pierce', 'season', 'towelDmg'];
const RING_ADDS = ['travel', 'scissors', 'scissorDmg', 'spiral', 'spiralPierce'];
const STRIP_ADDS = ['hits', 'ttl', 'boom', 'boomR', 'boomStun', 'air', 'opening', 'rain', 'rainCount'];

function normTurret(t = {}) {
  return {
    max: t.max ?? 0,
    damage: t.damage ?? 0,
    rate: t.rate ?? 1,
    range: t.range ?? 3,
    // roaming drones: roam radius (0 = anchored), flight speed (tiles/s), seconds per drone (0 = 1 / base rate)
    leash: t.leash ?? 0,
    speed: t.speed ?? 3,
    build: t.build ?? 0,
    attackType: t.attackType ?? null,
    status: (t.status || []).map((s) => ({ ...s })),
  };
}

// Tenka's paths (BUILD_PLAN 6.1; GAPS 5.10). Gravity Well and Last Line play in src/sim/zones.js (T1);
// Joint Research's lab team in src/sim/lab.js (T2). Like the Potential keys they
// appear on the stats ONLY when a tier sets them: every other girl resolves exactly as before.
/** Joint Research (P-13): how many times she absorbs (on purchase) and the weapons' strength multiplier. */
function normLab(l = {}) {
  return { rounds: l.rounds ?? 0, power: l.power ?? 1 };
}

/** Gravity Well (P-4): every s of wave time a well opens for `time` s, radius r; pull (tiles/s by path), slow, vuln. */
function normWell(w = {}) {
  return { every: w.every ?? 0, time: w.time ?? 0, radius: w.radius ?? 0, pull: w.pull ?? 0, slow: w.slow ?? 0, vuln: w.vuln ?? 0 };
}

/** Last Line (P-14): a well at the exit that swallows up to `max` enemies over `time` s, then rests `cooldown` s. */
function normLastLine(l = {}) {
  return { radius: l.radius ?? 0, max: l.max ?? 0, time: l.time ?? 0, cooldown: l.cooldown ?? 0 };
}

/**
 * Merges StatusSpecs into a list: a new type is appended, an existing type keeps the
 * stronger value of every numeric field (amount, dps, bonus, duration, chance).
 * @param {object[]} list mutated
 * @param {object[]} specs
 */
export function mergeStatusList(list, specs) {
  for (const spec of specs || []) {
    if (!spec || !spec.type) continue;
    const cur = list.find((s) => s.type === spec.type);
    if (!cur) {
      list.push({ ...spec });
      continue;
    }
    for (const k of Object.keys(spec)) {
      if (k === 'type' || k === 'chance') continue;
      if (typeof spec[k] === 'number') cur[k] = typeof cur[k] === 'number' ? Math.max(cur[k], spec[k]) : spec[k];
      else if (cur[k] === undefined) cur[k] = spec[k];
    }
    // A missing chance means "always" (1), which is the strongest possible value.
    if (cur.chance === undefined || spec.chance === undefined) delete cur.chance;
    else cur.chance = Math.max(cur.chance, spec.chance);
  }
  return list;
}

/**
 * Fills BaseStats defaults so later code never checks for undefined.
 * @param {object} base UnitDef.base
 * @param {object} unitDef for attackType/element defaults
 */
export function normalizeBase(base = {}, unitDef = {}) {
  const b = base || {};
  return {
    cost: b.cost ?? 0,
    behavior: b.behavior ?? 'projectile',
    attackType: b.attackType ?? unitDef.attackType ?? 'pierce',
    element: b.element !== undefined ? b.element : (unitDef.element ?? null),
    damage: b.damage ?? 0,
    rate: b.rate ?? 1,
    range: b.range ?? 3,
    projectiles: b.projectiles ?? 1,
    pierce: b.pierce ?? 1,
    splash: b.splash ?? 0,
    chain: b.chain ?? 0,
    maxTargets: b.maxTargets ?? 99,
    projectileSpeed: b.projectileSpeed ?? 14,
    armorPen: b.armorPen ?? 0,
    canHitAir: b.canHitAir ?? true,
    detection: !!b.detection,
    status: (b.status || []).map((s) => ({ ...s })),
    crit: { chance: b.crit?.chance ?? 0, mul: b.crit?.mul ?? 1.5 },
    eliteMul: b.eliteMul ?? 1,
    bossMul: b.bossMul ?? 1,
    barrierMul: b.barrierMul ?? 1,
    aura: b.aura ? normAura(b.aura) : null,
    income: b.income ? { perWave: b.income.perWave ?? 0, interest: b.income.interest ?? 0 } : null,
    trap: b.trap ? normTrap(b.trap) : null,
    turret: b.turret ? normTurret(b.turret) : null,
    ramp: b.ramp ? { per: b.ramp.per ?? 0, max: b.ramp.max ?? 0 } : null,
    mark: b.mark ? { bonus: b.mark.bonus ?? 0, duration: b.mark.duration ?? 0 } : null,
    brew: b.brew ? normLimited(b.brew) : null,
    link: b.link ? normLimited(b.link) : null,
    hpPct: b.hpPct ? { pct: b.hpPct.pct ?? 0, boss: b.hpPct.boss ?? 0, cap: b.hpPct.cap ?? 0 } : null,
    silence: b.silence ?? 0,
    reveal: b.reveal ?? 0,
    knockback: b.knockback ?? 0,
    // roster merge (ROSTER_SPEC §6.2): flyer damage multiplier, gather pull, relay origin
    airMul: b.airMul ?? 1,
    gather: b.gather ?? 0,
    // both: she also fires from her own spot (Iroha's two firing points)
    relay: b.relay ? { kind: b.relay.kind, reach: b.relay.reach ?? 3, ...(b.relay.both ? { both: true } : {}) } : null,
    // new girls (UNIT_GAPS §5): present only on a girl whose base declares the block
    ...(b.strip ? { strip: normStrip(b.strip) } : null),
    ...(b.ring ? { ring: normRing(b.ring) } : null),
    ...(b.drink ? { drink: normDrink(b.drink) } : null),
    ...(b.sentry ? { sentry: normSentry(b.sentry) } : null),
    ...(b.hub ? { hub: normHub(b.hub) } : null),
    ...(b.vine ? { vine: normVine(b.vine) } : null),
    ...(b.ball ? { ball: normBall(b.ball) } : null),
    ...(b.blade ? { blade: normBlade(b.blade) } : null),
    ...(b.duo ? { duo: normDuo(b.duo) } : null),
    // Norika's barricades (only a hero whose base declares them)
    ...(b.barricade ? { barricade: normBarricade(b.barricade) } : null),
    // Tenka's keys only when the base has them (no girl does today: no null defaults, see normLab)
    ...(b.lab ? { lab: normLab(b.lab) } : null),
    ...(b.well ? { well: normWell(b.well) } : null),
    ...(b.lastLine ? { lastLine: normLastLine(b.lastLine) } : null),
  };
}

/** Numeric StatusSpec fields statusAdd adds (N2). */
const ADD_FIELDS = ['amount', 'dps', 'pct', 'bonus', 'duration'];

function addStatusFields(cur, spec) {
  for (const k of ADD_FIELDS) if (typeof spec[k] === 'number') cur[k] = (typeof cur[k] === 'number' ? cur[k] : 0) + spec[k];
  // a missing chance means "always" and stays so; a chance adds, capped at 1
  if (typeof spec.chance === 'number' && typeof cur.chance === 'number') cur.chance = Math.min(1, cur.chance + spec.chance);
}

/**
 * N2 statusAdd: wherever she already has the status type (her own list, her traps', her drones'),
 * ADD its numbers; if she has it nowhere, append a copy to her own list (traps and drones copy it).
 * `mark` adds to her mark (creating it). Never the keep-stronger merge, which would hide a weaker step.
 */
export function addStatuses(s, specs) {
  for (const spec of specs || []) {
    if (!spec || !spec.type) continue;
    if (spec.type === 'mark') {
      if (!s.mark) s.mark = { bonus: 0, duration: 0 };
      s.mark.bonus += spec.bonus || 0;
      s.mark.duration += spec.duration || 0;
      continue;
    }
    let found = false;
    for (const list of [s.status, s.trap?.status, s.turret?.status]) {
      const cur = list?.find((x) => x.type === spec.type);
      if (cur) {
        addStatusFields(cur, spec);
        found = true;
      }
    }
    if (!found) s.status.push({ ...spec });
  }
}

/** N3: two rhythm ModSets merge in step order: later fields replace, status lists merge by type. */
function mergeProc(cur, v) {
  const out = cur ? { ...cur, status: cur.status.map((x) => ({ ...x })) } : { name: null, every: 0, of: 'attack', status: [] };
  for (const k of Object.keys(v)) {
    if (k === 'status') mergeStatusList(out.status, v.status);
    else if (v[k] && typeof v[k] === 'object') out[k] = { ...v[k] };
    else out[k] = v[k];
  }
  return out;
}

/** N4: a hero's ultimate (src/sim/hero.js ultEffect): numbers add, damageMul multiplies, lists append. */
function mergeUlt(cur, v) {
  const u = cur || { haste: 0, radius: 0, duration: 0, buffDuration: 0, rateBuff: 0, damageMul: 1, status: [], statusAdd: [] };
  for (const k of ['haste', 'radius', 'duration', 'buffDuration', 'rateBuff']) if (typeof v[k] === 'number') u[k] += v[k];
  // (a runner ult's length: Kogane's Wide Blade; absent on every other step)
  if (typeof v.length === 'number') u.length = (u.length || 0) + v.length;
  if (typeof v.damageMul === 'number') u.damageMul *= v.damageMul;
  for (const x of v.status || []) u.status.push({ ...x });
  for (const x of v.statusAdd || []) u.statusAdd.push({ ...x });
  return u;
}

/** Potential v3 keys (absent at P1: nothing here runs for a girl without the step). */
const POTENTIAL_KEYS = {
  statusAdd: (s, v) => addStatuses(s, Array.isArray(v) ? v : [v]),
  proc: (s, v) => { s.proc = mergeProc(s.proc, v); },
  ult: (s, v) => { s.ult = mergeUlt(s.ult, v); },
  bountyAura: (s, v) => { s.bountyAura = Math.max(s.bountyAura || 1, v); },
  harvest: (s, v) => { s.harvest = { share: 1, ...(s.harvest || {}), ...v }; },
  dotSpread: (s, v) => { s.dotSpread = { ...v }; },
  keepRamp: (s, v) => { s.keepRamp = Math.max(s.keepRamp || 0, v); },
  projScale: (s, v) => { s.projScale = (s.projScale || 0) + v; },
  tempo: (s, v) => { s.tempo = { ...(s.tempo || {}), ...v }; },
  classMul: (s, v) => {
    const m = { ...(s.classMul || {}) };
    for (const [k, x] of Object.entries(v)) m[k] = (m[k] ?? 1) * x;
    s.classMul = m;
  },
};

/**
 * Applies one ModSet to normalized stats in place. Damage add/mul are accumulated in
 * `acc` and resolved by resolveStats as (base + Σadd) × Πmul.
 */
export function applyModSet(s, mods, acc) {
  if (!mods) return s;
  for (const key of Object.keys(mods)) {
    const v = mods[key];
    if (v === undefined || v === null) continue;
    if (key === 'damage') acc.damageAdd += v;
    else if (key === 'damageMul') acc.damageMul *= v;
    else if (ADD_KEYS.includes(key)) s[key] += v;
    else if (MUL_KEYS.includes(key)) {
      if (key === 'rateMul') s.rate *= v;
      else s[key] *= v;
    } else if (key === 'canHitAir' || key === 'detection') {
      if (v) s[key] = true;
    } else if (REPLACE_KEYS.includes(key)) s[key] = v;
    else if (key === 'status') mergeStatusList(s.status, Array.isArray(v) ? v : [v]);
    else if (key === 'crit') {
      if (v.chance) s.crit.chance += v.chance;
      if (v.mul) s.crit.mul = Math.max(s.crit.mul, v.mul);
      // an additive crit damage (Tryout Day's Hot Streak, src/sim/tryout/pep.js); absent everywhere else
      if (v.mulAdd) s.crit.mul += v.mulAdd;
    } else if (key === 'aura') {
      if (!s.aura) s.aura = normAura();
      if (v.range != null) s.aura.range = Math.max(s.aura.range, v.range);
      if (v.dmgMul != null) s.aura.dmgMul *= v.dmgMul;
      if (v.rateMul != null) s.aura.rateMul *= v.rateMul;
      if (v.rangeMul != null) s.aura.rangeMul *= v.rangeMul;
      if (v.detection) s.aura.detection = true;
      if (v.costCut != null) s.aura.costCut += v.costCut;
      if (v.cleanse) s.aura.cleanse = true;
      if (v.armorPen != null) s.aura.armorPen += v.armorPen;
      if (v.critChance != null) s.aura.critChance += v.critChance;
      // Potential: reach added after every max rule (resolveStats), enemy Brittle inside her aura (N5, N6)
      if (v.rangeAdd != null && acc) acc.auraRangeAdd = (acc.auraRangeAdd || 0) + v.rangeAdd;
      if (v.foeVuln != null) s.aura.foeVuln = (s.aura.foeVuln || 0) + v.foeVuln;
    } else if (key === 'income') {
      if (!s.income) s.income = { perWave: 0, interest: 0 };
      s.income.perWave += v.perWave ?? 0;
      s.income.interest += v.interest ?? 0;
    } else if (key === 'trap') {
      if (!s.trap) s.trap = normTrap();
      s.trap.max += v.max ?? 0;
      s.trap.damage += v.damage ?? 0;
      s.trap.splash += v.splash ?? 0;
      if (v.triggerRadius != null) s.trap.triggerRadius += v.triggerRadius;
      if (v.status) mergeStatusList(s.trap.status, v.status);
    } else if (key === 'strip') {
      // only a strip girl's strips change (src/sim/strips.js)
      if (!s.strip) continue;
      for (const k of STRIP_ADDS) if (v[k] != null) s.strip[k] += v[k];
      for (const k of STRIP_FLAGS) if (v[k]) s.strip[k] = true;
    } else if (key === 'ring') {
      // only a ring girl's ring changes (src/sim/rings.js)
      if (!s.ring) continue;
      for (const k of RING_ADDS) if (v[k] != null) s.ring[k] += v[k];
      for (const k of RING_FLAGS) if (v[k]) s.ring[k] = true;
      if (v.scissorMul != null) s.ring.scissorMul *= v.scissorMul;
    } else if (SHAPE_NORM[key]) {
      // an attack shape block: created by the first mod that names it (src/sim/wheels.js)
      if (!s[key]) s[key] = SHAPE_NORM[key]();
      const o = s[key];
      for (const k of SHAPE_ADDS[key]) if (v[k] != null) o[k] += v[k];
      for (const k of SHAPE_SETS[key]) if (v[k] != null) o[k] = v[k];
    } else if (key === 'drink') {
      // only a drink girl's drink changes (src/sim/drinks.js)
      if (!s.drink) continue;
      for (const k of DRINK_ADDS) if (v[k] != null) s.drink[k] += v[k];
      for (const k of DRINK_FLAGS) if (v[k]) s.drink[k] = true;
    } else if (key === 'sentry') {
      // only a sentry girl's sentries change (src/sim/sentries.js)
      if (!s.sentry) continue;
      for (const k of SENTRY_ADDS) if (v[k] != null) s.sentry[k] += v[k];
      for (const k of SENTRY_FLAGS) if (v[k]) s.sentry[k] = true;
      if (v.rate != null) s.sentry.rate *= v.rate;
    } else if (key === 'ball') {
      // only a bowler's balls change (src/sim/balls.js)
      if (!s.ball) continue;
      for (const k of BALL_ADDS) if (v[k] != null) s.ball[k] += v[k];
      for (const k of BALL_FLAGS) if (v[k]) s.ball[k] = true;
    } else if (key === 'duo') {
      // only the duo's beam and prism change (src/sim/duo.js)
      if (!s.duo) continue;
      const d = s.duo;
      for (const k of DUO_ADDS) if (v[k] != null) d[k] += v[k];
      for (const k of DUO_MULS) if (v[k] != null) d[k] *= v[k];
      for (const k of DUO_MAX) if (v[k] != null) d[k] = Math.max(d[k], v[k]);
      for (const k of DUO_MIN) if (v[k] > 0) d[k] = d[k] > 0 ? Math.min(d[k], v[k]) : v[k];
    } else if (key === 'barricade') {
      // only Norika's barricades change (src/sim/barricades.js)
      if (!s.barricade) continue;
      const br = s.barricade;
      for (const k of BARRICADE_ADDS) if (v[k] != null) br[k] += v[k];
      for (const k of BARRICADE_FLAGS) if (v[k]) br[k] = true;
      if (v.budgetMul != null) br.budgetMul *= v.budgetMul;
      if (v.rebuild != null) br.rebuild = Math.min(br.rebuild, v.rebuild);
    } else if (key === 'moveCd' || key === 'moveDowntime' || key === 'skillCount') {
      // a hero's Move: seconds off its recharge / its mid-wave downtime (src/sim/hero.js); a hero's skill: more
      // targets (src/sim/abilities.js strikeTargets). Absent unless a level, awakening or Potential step sets it.
      s[key] = (s[key] || 0) + v;
    } else if (key === 'overdrive') {
      // Kogane's Potential capstone: after each Move during a wave, × rateMul attack speed for `time` s (hero.js)
      s.overdrive = { rateMul: v.rateMul ?? 1, time: v.time ?? 0 };
    } else if (key === 'vine') {
      // only a vine girl's vines change (src/sim/vines.js)
      if (!s.vine) continue;
      for (const k of VINE_ADDS) if (v[k] != null) s.vine[k] += v[k];
    } else if (key === 'hub') {
      // only a hub girl's rules change (src/sim/hubs.js)
      if (!s.hub) continue;
      for (const k of HUB_MAX) if (v[k] != null) s.hub[k] = Math.max(s.hub[k], v[k]);
      for (const k of HUB_ADDS) if (v[k] != null) s.hub[k] += v[k];
      for (const k of HUB_FLAGS) if (v[k]) s.hub[k] = true;
    } else if (key === 'blade') {
      // only Kaede's blade arts change (src/sim/towers.js bladeArt)
      if (!s.blade) continue;
      for (const k of BLADE_ADDS) if (v[k] != null) s.blade[k] += v[k];
      if (v.shareMul != null) s.blade.shareMul *= v.shareMul;
    } else if (key === 'turret') {
      if (!s.turret) s.turret = normTurret();
      s.turret.max += v.max ?? 0;
      s.turret.damage += v.damage ?? 0;
      s.turret.range += v.range ?? 0;
      s.turret.leash += v.leash ?? 0;
      s.turret.speed += v.speed ?? 0;
      if (v.rate != null) s.turret.rate *= v.rate;
      if (v.attackType) s.turret.attackType = v.attackType;
      if (v.status) mergeStatusList(s.turret.status, v.status);
      // Potential (N11): her drones' own overclock timer; a later step's fields replace earlier ones
      if (v.overclock) s.turret.overclock = { ...(s.turret.overclock || {}), ...v.overclock };
    } else if (key === 'ramp') {
      if (!s.ramp) s.ramp = { per: 0, max: 0 };
      s.ramp.per += v.per ?? 0;
      s.ramp.max += v.max ?? 0;
    } else if (key === 'mark') {
      if (!s.mark) s.mark = { bonus: 0, duration: 0 };
      s.mark.bonus = Math.max(s.mark.bonus, v.bonus ?? 0);
      s.mark.duration = Math.max(s.mark.duration, v.duration ?? 0);
    } else if (key === 'brew' || key === 'link') {
      // Potential (N12): one more girl, added after the max rule (resolveStats); never creates a brew / link
      if (v.targetsAdd != null && acc) acc[`${key}Add`] = (acc[`${key}Add`] || 0) + v.targetsAdd;
      if (!Object.keys(v).some((k) => k !== 'targetsAdd')) continue;
      // limited buffs (src/sim/buffs.js): targets = max, multipliers multiply, pen and crit add, overclock replaces
      if (!s[key]) s[key] = normLimited();
      const l = s[key];
      l.targets = Math.max(l.targets, v.targets ?? 0);
      if (v.dmgMul != null) l.dmgMul *= v.dmgMul;
      if (v.rateMul != null) l.rateMul *= v.rateMul;
      if (v.armorPen != null) l.armorPen += v.armorPen;
      if (v.critChance != null) l.critChance += v.critChance;
      if (v.overclock) l.overclock = { every: v.overclock.every ?? 20, time: v.overclock.time ?? 6, rateMul: v.overclock.rateMul ?? 1 };
    } else if (key === 'hpPct') {
      // execution shot (src/sim/combat.js): + pct of the target's current HP (boss on minibosses / bosses),
      // at most cap × the hit; the strongest numbers win
      if (!s.hpPct) s.hpPct = { pct: 0, boss: 0, cap: 0 };
      s.hpPct.pct = Math.max(s.hpPct.pct, v.pct ?? 0);
      s.hpPct.boss = Math.max(s.hpPct.boss, v.boss ?? 0);
      s.hpPct.cap = Math.max(s.hpPct.cap, v.cap ?? 0);
    } else if (key === 'lab') {
      // Joint Research: rounds and power, the strongest wins (Unified Theory: 2 rounds, ×3)
      const l = s.lab || (s.lab = normLab());
      l.rounds = Math.max(l.rounds, v.rounds ?? 0);
      l.power = Math.max(l.power, v.power ?? 1);
    } else if (key === 'well') {
      // Gravity Well: every field keeps the strongest value (Deep Well: 6 s, radius 2, +20% damage taken).
      // `every` is a period, so the strongest is the shortest (0 = not set yet: the first one sets it);
      // the other fields keep the max
      const w = s.well || (s.well = normWell());
      if (v.every > 0) w.every = w.every > 0 ? Math.min(w.every, v.every) : v.every;
      for (const f of ['time', 'radius', 'pull', 'slow', 'vuln']) if (v[f] != null) w[f] = Math.max(w[f], v[f]);
    } else if (key === 'lastLine') {
      s.lastLine = normLastLine(v); // replace: one Last Line
    } else if (key === 'relay') {
      // only a girl who already has a familiar / mirror can extend its reach
      if (s.relay) s.relay.reach += v.reach ?? 0;
    } else if (key === 'dotMul') {
      // Tryout Day's Weather Report (src/sim/tryout/pep.js): her burns and poisons × v (absent everywhere else)
      for (const list of [s.status, s.trap?.status, s.turret?.status]) {
        for (const st of list || []) {
          if (st.type !== 'burn' && st.type !== 'poison') continue;
          if (typeof st.dps === 'number') st.dps *= v;
          if (typeof st.pct === 'number') st.pct *= v;
        }
      }
    } else if (key === 'auraBoost') {
      // Tryout Day's Backstage Crew: her aura reaches further and each bonus it gives grows by `points`
      if (s.aura) {
        const a = { ...s.aura };
        a.range += v.range || 0;
        if (v.points) for (const k of ['dmgMul', 'rateMul']) if (a[k] > 1) a[k] += v.points;
        s.aura = a;
      }
    } else if (Object.hasOwn(POTENTIAL_KEYS, key)) POTENTIAL_KEYS[key](s, v);
    // Unknown keys are ignored on purpose (only the contract keys are understood).
  }
  return s;
}

/**
 * ModSets that apply to a tower: upgrade tiers (tier 1 of every path, then tier 2, ... so
 * high-tier transformations win), hero track levels up to `level` plus her growth (HERO_GROWTH
 * per level above 1, plus Mastery past Lv 25), then the awaken passive.
 * @param {object} def UnitDef
 * @param {number[]} tiers [a, b, c]
 * @param {number} heroLevel 0 for towers
 * @param {boolean} awakenPassive
 * @param {number} heroMastery Mastery damage bonus (0 below Lv 25)
 */
export function collectModSets(def, tiers = [0, 0, 0], heroLevel = 0, awakenPassive = false, heroMastery = 0) {
  const sets = [];
  for (let t = 1; t <= 5; t++) {
    for (let p = 0; p < 3; p++) {
      if ((tiers[p] || 0) >= t) {
        const tier = def.paths?.[p]?.tiers?.[t - 1];
        if (tier?.mods) sets.push(tier.mods);
      }
    }
  }
  if (heroLevel > 0 && def.hero?.levels) {
    const lv = [...def.hero.levels].sort((a, b) => a.level - b.level);
    for (const m of lv) if (m.level <= heroLevel && m.mods) sets.push(m.mods);
    const g = def.hero.growth ?? HERO_GROWTH;
    if (heroLevel > 1 || heroMastery > 0) {
      const steps = Math.max(0, heroLevel - 1);
      sets.push({ damageMul: 1 + (g.damage || 0) * steps + (heroMastery || 0), rateMul: 1 + (g.rate || 0) * steps });
    }
  }
  if (awakenPassive && def.awakenPassive?.mods) sets.push(def.awakenPassive.mods);
  return sets;
}

/**
 * Applies profile battle stats (unitBattleStats) on top of resolved stats.
 * critMul multiplies the crit damage multiplier; critChance/armorPen add.
 */
export function applyUnitStats(s, us = DEFAULT_UNIT_STATS) {
  const u = { ...DEFAULT_UNIT_STATS, ...(us || {}) };
  s.damage *= u.damageMul;
  s.rate *= u.rateMul;
  s.range *= u.rangeMul;
  s.crit.chance = Math.min(1, s.crit.chance + (u.critChance || 0));
  s.crit.mul *= u.critMul || 1;
  s.armorPen += u.armorPen || 0;
  if (s.trap) s.trap.damage *= u.damageMul;
  // Azami's Charged Strips / Detonation Line blasts follow her level, stars, gear ATK and Potential's whole-girl
  // damage step like her strips do (copy-on-write: a strip block is never shared after this)
  if (s.strip && s.strip.boom > 0) s.strip = { ...s.strip, boom: s.strip.boom * u.damageMul };
  if (s.ring) s.ring.scissorDmg *= u.damageMul;
  if (s.drink) s.drink.towelDmg *= u.damageMul;
  if (s.ball) s.ball.pinDmg *= u.damageMul;
  // the duo: Kohaku's beam follows her level, gear and Potential like the shells (her shards are a share of a shell)
  if (s.duo) s.duo = { ...s.duo, beamDmg: s.duo.beamDmg * u.damageMul, shardDmg: s.duo.shardDmg * u.damageMul, beamRate: s.duo.beamRate * u.rateMul, beamRange: s.duo.beamRange * u.rangeMul };
  if (s.vine) {
    s.vine.dps *= u.damageMul;
    s.vine.bedDmg *= u.damageMul;
  }
  if (s.sentry) {
    s.sentry.damage *= u.damageMul;
    s.sentry.burst *= u.damageMul;
    s.sentry.rate *= u.rateMul;
  }
  applyGearReach(s, u);
  if (s.turret) {
    s.turret.damage *= u.damageMul;
    s.turret.rate *= u.rateMul;
    s.turret.range *= u.rangeMul;
    s.turret.leash *= u.rangeMul;
    if (s.turret.build > 0) s.turret.build /= u.rateMul;
  }
  return s;
}

/**
 * Gear's reach past hits (docs/specs/GEAR_STATS.md §A.3, §A.4, §B.3): Pierce widens blasts and traps
 * (×(1 + 0.2 × Pierce)); Aura Power grows her aura's bonus parts (never its cost cut); gear Range and the
 * aura girls' fill-in widen her aura; half of gear ATK reaches her burns and poisons (dotMul, never the
 * %-of-max-HP part). Shots, beams, sweeps, chains and drones take Pierce per attack (towers.js).
 */
function applyGearReach(s, u) {
  const pk = Math.min(PIERCE_K_MAX, Math.max(0, Math.floor(u.pierceK || 0)));
  if (pk > 0) {
    const blast = 1 + BLAST_PER_PIERCE * (pk / 100);
    if (s.splash > 0 && (s.behavior === 'projectile' || s.behavior === 'turret')) s.splash *= blast;
    if (s.trap && s.trap.splash > 0) s.trap = { ...s.trap, splash: s.trap.splash * blast };
  }
  if (s.aura) {
    const a = { ...s.aura };
    const ap = Math.max(0, u.auraPct || 0);
    if (ap > 0) {
      for (const k of ['dmgMul', 'rateMul', 'rangeMul']) if (typeof a[k] === 'number' && a[k] > 1) a[k] = 1 + (a[k] - 1) * (1 + ap);
      for (const k of ['armorPen', 'critChance']) if (typeof a[k] === 'number' && a[k] > 0) a[k] *= 1 + ap;
    }
    if (typeof a.range === 'number') a.range *= (u.rangeMul || 1) * Math.max(1, u.auraRangeMul || 1);
    s.aura = a;
  }
  const dm = Math.max(1, u.dotMul || 1);
  if (dm > 1) {
    const grow = (list) => (list || []).map((st) => ((st.type === 'burn' || st.type === 'poison') && typeof st.dps === 'number' ? { ...st, dps: st.dps * dm } : st));
    if (s.status) s.status = grow(s.status);
    if (s.trap?.status) s.trap = { ...s.trap, status: grow(s.trap.status) };
    if (s.turret?.status) s.turret = { ...s.turret, status: grow(s.turret.status) };
  }
}

/**
 * After her unit stats: Potential's whole-girl DoT multiplier on every burn / poison she applies (N1),
 * her aura's added reach after every max rule (N5), and one more brewed / linked girl (N12; brews
 * never above BREW_TARGETS_MAX, and nothing where she has no brew / link).
 */
function potentialTail(s, pot, acc) {
  if (pot.dotMul !== 1) {
    for (const list of [s.status, s.trap?.status, s.turret?.status]) {
      for (const st of list || []) {
        if (st.type !== 'burn' && st.type !== 'poison') continue;
        if (typeof st.dps === 'number') st.dps *= pot.dotMul;
        if (typeof st.pct === 'number') st.pct *= pot.dotMul;
      }
    }
  }
  if (acc.auraRangeAdd && s.aura) s.aura.range += acc.auraRangeAdd;
  if (acc.brewAdd && s.brew) s.brew.targets = Math.min(BREW_TARGETS_MAX, s.brew.targets + acc.brewAdd);
  if (acc.linkAdd && s.link) s.link.targets += acc.linkAdd;
}

/**
 * Full stat resolution for a tower/hero.
 * @param {object} def UnitDef
 * @param {{ tiers?: number[], heroLevel?: number, unitStats?: object, heroMastery?: number,
 *   extra?: object|object[]|null }} opts unitStats.potential (1…6) adds her Potential steps; `extra`
 *   (a ModSet or a list of them: a running ability boost, src/sim/abilities.js) applies after every
 *   other set and before the damage is resolved. No `extra`: bit-identical to before it existed.
 */
export function resolveStats(def, { tiers = [0, 0, 0], heroLevel = 0, unitStats = null, heroMastery = 0, extra = null } = {}) {
  const s = normalizeBase(def.base, def);
  const acc = { damageAdd: 0, damageMul: 1 };
  const us = { ...DEFAULT_UNIT_STATS, ...(unitStats || {}) };
  for (const m of collectModSets(def, tiers, heroLevel, !!us.awakenPassive, heroMastery)) applyModSet(s, m, acc);
  // Kaede's maple splash keys on her focus cap before Potential (a Potential cap raise never delays it)
  if (s.blade) s.blade.capMax = s.ramp ? s.ramp.max : 0;
  // Potential (src/data/potential.js): its ModSets after the awaken passive (and after a hero's
  // track levels, growth and Mastery), its whole-girl multipliers folded into the unit stats like
  // level and gear. P1 changes nothing.
  const pot = potentialFold(def, us.potential);
  for (const m of pot.sets) applyModSet(s, m, acc);
  if (extra) for (const m of Array.isArray(extra) ? extra : [extra]) applyModSet(s, m, acc);
  s.damage = (s.damage + acc.damageAdd) * acc.damageMul;
  applyUnitStats(s, pot.level > 1 ? { ...us, damageMul: us.damageMul * pot.damageMul, rateMul: us.rateMul * pot.rateMul, rangeMul: us.rangeMul * pot.rangeMul } : us);
  if (s.income && pot.incomeMul !== 1) s.income.perWave *= pot.incomeMul;
  if (s.hub && pot.incomeMul !== 1) s.hub.costCut *= pot.incomeMul; // (Ouka's coins track: her discount)
  if (pot.level > 1) potentialTail(s, pot, acc);
  s.projectiles = Math.max(1, Math.round(s.projectiles));
  s.pierce = Math.max(1, Math.round(s.pierce));
  s.chain = Math.max(0, Math.round(s.chain));
  s.maxTargets = Math.max(1, Math.round(s.maxTargets));
  if (s.trap) s.trap.max = Math.max(0, Math.round(s.trap.max));
  if (s.sentry) s.sentry.max = Math.max(0, Math.round(s.sentry.max));
  if (s.ball) {
    s.ball.through = Math.max(0, Math.round(s.ball.through));
    s.ball.pins = Math.max(0, Math.round(s.ball.pins));
    s.ball.bounce = Math.max(0, Math.round(s.ball.bounce));
    s.ball.reach = Math.max(0, s.ball.reach);
    s.ball.share = Math.min(1, Math.max(0, s.ball.share));
  }
  if (s.duo) {
    const d = s.duo;
    d.beamPierce = Math.max(1, Math.round(d.beamPierce));
    d.beams = Math.max(1, Math.round(d.beams));
    d.every = Math.max(0, Math.round(d.every));
    d.fullEvery = Math.max(0, Math.round(d.fullEvery));
    d.shards = Math.max(0, Math.round(d.shards + d.shardAdd));
    d.shardAdd = 0;
  }
  if (s.vine) {
    s.vine.every = Math.max(1, s.vine.every);
    s.vine.beds = Math.max(0, Math.round(s.vine.beds));
    s.vine.max = Math.max(1, Math.round(s.vine.max));
    s.vine.cap = Math.max(0, Math.round(s.vine.cap));
    s.vine.lash = Math.max(0.1, s.vine.lash);
  }
  if (s.hub) {
    // her office: the strongest radius plus its adds; her range is the radius (the ring the board draws)
    const h = s.hub;
    h.radius += h.radiusAdd;
    h.costCut = Math.min(0.5, h.costCut + h.cutAdd);
    h.radiusAdd = 0;
    h.cutAdd = 0;
    h.freeTiers = Math.round(h.freeTiers);
    h.banners = Math.round(h.banners);
    s.range = h.radius;
  }
  if (s.turret) s.turret.max = Math.max(0, Math.round(s.turret.max));
  if (s.barricade) {
    const br = s.barricade;
    br.count = Math.max(0, Math.min(BARRICADES_PER_HERO, Math.round(br.count)));
    br.oneWay = Math.max(0, Math.round(br.oneWay));
    br.lineAdd = Math.max(0, Math.round(br.lineAdd));
  }
  return s;
}

/**
 * Crosspath rule: at most two paths may have tiers > 0 and only one path may go
 * above tier 2; tier N requires tier N-1 (implicit: tiers only ever increase by one).
 * @returns {null|'max'|'crosspath'} reason the next tier of `path` is unavailable
 */
export function crosspathBlock(tiers, path, maxTier = 5) {
  const cur = tiers[path] || 0;
  if (cur >= maxTier) return 'max';
  const next = cur + 1;
  const others = [0, 1, 2].filter((p) => p !== path);
  if (cur === 0 && others.filter((p) => (tiers[p] || 0) > 0).length >= 2) return 'crosspath';
  if (next > 2 && others.some((p) => (tiers[p] || 0) > 2)) return 'crosspath';
  return null;
}
