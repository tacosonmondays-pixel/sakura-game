// Tryout Day headless bot (docs/specs/TRYOUT_DAY.md §15): plays runs with simple placement, upgrade, pick and Hall
// Pass policies, solo or as both players of a 2-player co-op run (real lockstep CoopSims fed the same commands).
// The tests drive it too (tests/sim/tryout.test.js, tests/online/tryoutCoop.test.js).
//
// usage: node --import ./tools/simLoader.mjs tools/tryoutBot.mjs [runs=40] [grade=1] [policy=random|first] [--coop]
//        [--strength new|mid|maxed|none] [--grade N] [--runs N] [--sweep] (see the CLI at the end)
import { Sim } from '../src/sim/Sim.js';
import { createRng } from '../src/core/rng.js';
import { buildTryoutPlan, buildTryoutStage, chooserOf } from '../src/sim/tryout/index.js';
import { createCoopSim } from '../src/online/coop/commands.js';
import { snapshotDigest } from '../src/sim/snapshot.js';
import { DEFAULT_UNIT_STATS } from '../src/sim/constants.js';
import { TRYOUT_STUDENTS } from '../src/data/tryout.js';
import { autoPlan } from '../src/sim/headless.js';
import { crosspathBlock } from '../src/sim/mods.js';
import { finalTierOf, findFinalHolder } from '../src/sim/finalTier.js';

const Q = 1024;
const SAMPLE = 0.5;

/** Legal-ish land spots by how much road lies within 3 tiles (best first), on a half-tile lattice (the tests' spots). */
export function spotsFor(sim) {
  const pts = [];
  for (const p of sim._pathsFwd) for (const pt of p.points) pts.push(pt);
  const out = [];
  for (let y = 0.25; y < sim.map.height; y += SAMPLE) {
    for (let x = 0.25; x < sim.map.width; x += SAMPLE) {
      if (sim.placementReason('aoi', x, y)) continue;
      let w = 0;
      for (const s of sim._pathsFwd) {
        for (let d = 0; d <= s.length; d += 0.5) {
          const q = pointAt(s.points, d);
          if ((q[0] - x) ** 2 + (q[1] - y) ** 2 <= 9) w++;
        }
      }
      out.push({ x, y, w });
    }
  }
  out.sort((a, b) => b.w - a.w || a.y - b.y || a.x - b.x);
  return out;
}

function pointAt(pts, d) {
  let rest = d;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    const L = Math.sqrt(dx * dx + dy * dy);
    if (rest <= L || i === pts.length - 1) {
      const k = L > 0 ? Math.min(1, rest / L) : 0;
      return [pts[i - 1][0] + dx * k, pts[i - 1][1] + dy * k];
    }
    rest -= L;
  }
  return pts[0];
}

/**
 * One player's calm-point decisions as commands ({ k, a }), against a Sim showing that player's view.
 * Picks: `random` (a seeded random legal choice) or `first`; places her squad and spends her coins (spend), moves
 * one girl onto a free seat at a break.
 */
export function decide(sim, slot, bot) {
  const ty = sim.tryout;
  const p = ty.players[slot];
  const cmds = [];
  // between periods (first, while a pick still holds the wave): the chooser picks the coming Subject, and everyone
  // takes the Double Dare every third period (both players tap it, so co-op runs the Dare too); once per period
  const next = ty.period + (ty.started >= ty.period ? 1 : 0);
  if (!ty.base && !ty.done && ty.subjects?.[next] && bot.classFor !== next) {
    bot.classFor = next;
    if (chooserOf(ty, next) === slot) cmds.push({ k: 'tr', a: ['subject', Math.floor(next / 2) % 2] });
    if (next % 3 === 0) cmds.push({ k: 'tr', a: ['dare', 1] });
  }
  if (p.win === 'pick' && p.offer) {
    const o = p.offer;
    if (bot.policy === 'hand' || (bot.policy === 'random' && bot.rng.next() < 0.1)) cmds.push({ k: 'tr', a: ['hand', o.seq] });
    else {
      const i = bot.policy === 'first' ? 0 : Math.floor(bot.rng.next() * o.cards.length);
      // a girl's arrival path varies with the pick (no rng draw: the random policy's stream stays as it was)
      cmds.push({ k: 'tr', a: ['take', o.seq, i, (o.seq + slot) % 3] });
    }
    return cmds;
  }
  if (p.win === 'break') {
    // a Hall Pass: the newest girl of hers onto a free seat of the coming block
    const next = ty.seats.blocks[Math.min(ty.seats.blocks.length - 1, ty.seats.block + 1)] || [];
    const mine = sim.towers.filter((t) => !t.isHero && (t.owner ?? 0) === slot);
    const girl = mine[mine.length - 1];
    if (girl && p.passes > 0 && !bot.moved) {
      for (const seat of next) {
        if (sim.towers.some((t) => (t.x - seat.x) ** 2 + (t.y - seat.y) ** 2 <= seat.r * seat.r)) continue;
        if (sim.placement.check(girl.def, seat.x, seat.y, sim.towers.filter((t) => t !== girl))) continue;
        cmds.push({ k: 'mv', a: [girl.uid, Math.round(seat.x * Q), Math.round(seat.y * Q)] });
        bot.moved = true;
        return cmds;
      }
    }
    bot.moved = false;
    cmds.push({ k: 'tr', a: ['snack'] }, { k: 'tr', a: ['ready'] });
    return cmds;
  }
  // place and upgrade (see spend below), then start the next wave
  // income: her coins now minus what she kept at the last calm point
  const income = Math.max(0, sim.cash - (bot.kept ?? sim.cash));
  const bought = spend(sim, slot, bot, income);
  for (const c of bought) cmds.push(c);
  bot.kept = bot.left;
  cmds.push({ k: 'wave', a: [] });
  return cmds;
}

// ---------------------------------------------------------------------------
// Battle play: where and what to buy
// ---------------------------------------------------------------------------

/** Share of coins a reasonable player puts into tiers rather than more girls (upgrade coins : placement coins). */
const UPGRADE_RATIO = 2;
/** The tier order of each girl: her main path to 3, her side path to 2, then her main path on to 5. */
const STEPS = [['main', 3], ['sub', 2], ['main', 5]];

/**
 * A girl's play plan on this run's stage, from headless.autoPlan (it reads the stage's flyers and veiled foes):
 * `main` and `sub` are her first two upgrade paths; `copy` whether the plan ever places a second one (support
 * girls such as aura, drink and hub girls are placed once).
 */
function playPlan(sim, bot, id) {
  const cache = bot.plans || (bot.plans = new Map());
  if (!cache.has(id)) {
    let plan = [];
    try {
      plan = autoPlan(sim.stage.id, [id], { data: { stage: sim.stage } });
    } catch {
      plan = [];
    }
    const paths = [];
    for (const a of plan) if (a.action === 'upgrade' && !paths.includes(a.path)) paths.push(a.path);
    const main = paths[0] ?? 0;
    const sub = paths[1] ?? [0, 1, 2].find((p) => p !== main);
    cache.set(id, { main, sub, copy: plan.filter((a) => a.action === 'place').length > 1 });
  }
  return cache.get(id);
}

/**
 * Candidate spots for a girl of range `r` (land and water alike, best road coverage within her range first), on a
 * half-tile lattice; computed once per run for a few range buckets.
 */
function rangeSpots(sim, bot, r) {
  const R = Math.max(2, Math.min(5, Math.round(r || 3)));
  const cache = bot.rspots || (bot.rspots = new Map());
  if (!cache.has(R)) {
    const road = [];
    for (const s of sim._pathsFwd) for (let d = 0; d <= s.length; d += 0.5) road.push(pointAt(s.points, d));
    const out = [];
    for (let y = 0.25; y < sim.map.height; y += SAMPLE) {
      for (let x = 0.25; x < sim.map.width; x += SAMPLE) {
        let w = 0;
        for (const q of road) if ((q[0] - x) ** 2 + (q[1] - y) ** 2 <= R * R) w++;
        if (w > 0) out.push({ x, y, w });
      }
    }
    out.sort((a, b) => b.w - a.w || a.y - b.y || a.x - b.x);
    cache.set(R, out);
  }
  return cache.get(R);
}

/** A placement command's quantised coordinates (never exactly on a tile corner: those are tile calls). */
function placeCmd(id, s) {
  const x = Math.round(s.x * Q);
  const y = Math.round(s.y * Q);
  return { k: 'place', a: [id, x + (x % Q === 0 && y % Q === 0 ? 1 : 0), y] };
}

/**
 * One calm point's buying for a player: the hero, then every squad girl once (saving up for the next one), then
 * whichever side of the upgrade : placement split (UPGRADE_RATIO) is behind. Upgrades follow STEPS on each girl's
 * plan, the most invested girl first (a carry pushed deep), skipping tiers beyond her coins plus a wave of income;
 * new girls are copies of the squad's damage dealers, fewest copies first, each on the free spot that sees the most
 * road within her range. Saves when the chosen buy is out of reach. Reads the Sim and returns commands; `bot` keeps
 * only caches and what she kept last time (her income).
 */
function spend(sim, slot, bot, income) {
  const cmds = [];
  let cash = sim.cash;
  const done = () => {
    bot.left = cash;
    return cmds;
  };
  const pending = []; // spots claimed this calm point
  const p = sim.tryout.players[slot];
  const mine = sim.towers.filter((t) => !t.isHero && !t.removed && (t.owner ?? 0) === slot);
  const spotFor = (id) => {
    const def = sim.data.unit(id);
    const r = def?.base?.range || 3;
    return rangeSpots(sim, bot, r).find((o) => !sim.placementReason(id, o.x, o.y)
      && pending.every((q) => (q.x - o.x) ** 2 + (q.y - o.y) ** 2 >= 1.0));
  };
  const place = (id) => {
    // one of each girl per calm point (a voucher prices only her first copy free)
    if (pending.some((q) => q.id === id)) return 'spot';
    const cost = sim.placeCost(id);
    if (cost > cash) return 'cash';
    const s = spotFor(id);
    if (!s) return 'spot';
    pending.push({ ...s, id });
    cmds.push(placeCmd(id, s));
    cash -= cost;
    return 'ok';
  };

  // the hero, then every squad girl once
  const hc = sim.heroConfigs[slot];
  if (hc && !sim.heroes[slot]) place(hc.unitId);
  const have = new Set(mine.map((t) => t.unitId));
  for (const id of p.squad) {
    if (have.has(id)) continue;
    if (place(id) === 'cash') return done(); // save up for her
  }

  // the split: virtual tiers so several tiers of one girl can be bought at one calm point
  const tiers = new Map(mine.map((t) => [t.uid, t.tiers.slice()]));
  const bought = new Map(); // uid -> coins put into her this calm point
  const finals = new Set(); // `${unitId}:${path}` finals bought this calm point
  let upg = 0;
  let plc = 0;
  for (const t of mine) {
    const base = sim.placeCost(t.unitId);
    plc += base;
    upg += Math.max(0, t.spent - base);
  }
  const nextTier = (t) => {
    const plan = playPlan(sim, bot, t.unitId);
    const vt = tiers.get(t.uid);
    for (const [which, cap] of STEPS) {
      const path = plan[which];
      const defs = t.def.paths?.[path]?.tiers || [];
      const top = Math.min(cap, 5, defs.length);
      if (vt[path] >= top) continue;
      if (crosspathBlock(vt, path, Math.min(5, defs.length))) continue;
      const tier = vt[path];
      if (tier + 1 >= finalTierOf(t.def, path)) {
        if (finals.has(`${t.unitId}:${path}`) || findFinalHolder(sim.towers, t.unitId, t.owner ?? 0, path, t.uid)) continue;
      }
      return { t, path, cost: sim._upgradeCost(t, defs[tier], tier) };
    }
    return null;
  };
  const copyOf = () => {
    let best = null;
    let bestN = Infinity;
    for (const id of p.squad) {
      if (!playPlan(sim, bot, id).copy || pending.some((q) => q.id === id)) continue;
      const n = mine.filter((t) => t.unitId === id).length;
      if (n < bestN) {
        bestN = n;
        best = id;
      }
    }
    return best;
  };
  // what she saves toward: a tier within her coins plus about one wave of income
  const horizon = cash + income;
  for (let guard = 0; guard < 200; guard++) {
    // the most invested girl's next tier within reach (push a carry deep, as a player does)
    let up = null;
    for (const t of mine) {
      const n = nextTier(t);
      if (!n || n.cost > horizon) continue;
      const spent = t.spent + (bought.get(t.uid) || 0);
      if (!up || spent > up.spent) up = { ...n, spent };
    }
    const copy = copyOf();
    if (up && (!copy || upg < UPGRADE_RATIO * plc)) {
      if (up.cost > cash) break; // save up for it
      cmds.push({ k: 'upg', a: [up.t.uid, up.path] });
      tiers.get(up.t.uid)[up.path]++;
      if (tiers.get(up.t.uid)[up.path] >= finalTierOf(up.t.def, up.path)) finals.add(`${up.t.unitId}:${up.path}`);
      bought.set(up.t.uid, (bought.get(up.t.uid) || 0) + up.cost);
      cash -= up.cost;
      upg += up.cost;
    } else if (copy) {
      const cost = sim.placeCost(copy);
      if (place(copy) !== 'ok') break;
      plc += cost;
    } else break;
  }
  return done();
}

/** Runs one solo command against a Sim (the same shapes as co-op's). */
function soloApply(sim, c) {
  const a = c.a;
  switch (c.k) {
    case 'tr': return sim.tryoutCommand(0, a[0], a.slice(1));
    case 'mv': return sim.tryoutMove(0, a[0], a[1] / Q, a[2] / Q);
    case 'place': return { ok: !!sim.placeTower(a[0], a[1] / Q, a[2] / Q) };
    case 'upg': return { ok: sim.upgradeTower(a[0], a[1]) };
    case 'wave': return { ok: sim.startNextWave() };
    default: return { ok: false };
  }
}

/**
 * One solo run. `pool`: owned girls' account stats (default: none owned, every girl a Loaner).
 * @returns {{ sim: Sim, result: object, digests: string[] }}
 */
export function runSolo({ seed = 1, grade = 1, length = 'half', squad = ['aoi', 'kage', 'yuki'], hero = 'hikari', pool = {}, policy = 'random', maxWaves = Infinity, onCalm = null } = {}) {
  const plan = buildTryoutPlan({ seed, grade, length });
  const stage = buildTryoutStage(plan);
  const sim = new Sim({
    stageId: stage.id, hero: hero ? { unitId: hero, stats: {} } : null, seed: seed ^ 0x5eed, data: { stage },
    options: { tryout: { seed, grade, length, mapId: plan.mapId, players: [{ squad }], pools: [pool] } },
  });
  const bot = { policy, rng: createRng(seed ^ 0xb07) };
  const digests = [];
  let guard = 0;
  while (sim.state !== 'won' && sim.state !== 'lost' && sim.wave < maxWaves && guard++ < 400000) {
    if (sim.state === 'prep' || sim.state === 'between') {
      if (onCalm) onCalm(sim, digests);
      for (const c of decide(sim, 0, bot)) soloApply(sim, c);
      if (sim.state === 'between' || sim.state === 'prep') if (!sim.tryoutWindowOpen() && sim.state !== 'wave') sim.startNextWave();
    }
    for (let i = 0; i < 30 && sim.state === 'wave'; i++) sim.update(1 / 60);
  }
  return { sim, result: sim.result(), digests };
}

/** A co-op start message for a run. */
export function coopStart({ seed = 1, grade = 1, length = 'half', drafts = [['aoi', 'kage', 'yuki'], ['rei', 'raika', 'hana']], heroes = ['hikari', 'nami'], pools = [{}, {}] } = {}) {
  return {
    seed: seed ^ 0x5eed, stageId: 'tryout', difficulty: 'normal',
    tryout: { seed, grade, length, mapId: buildTryoutPlan({ seed, grade, length }).mapId },
    players: drafts.map((draft, i) => ({ slot: i, uid: `p${i}`, name: `P${i + 1}`, loadout: [], hero: heroes[i] ? { unitId: heroes[i], stats: {} } : null, draft, pool: pools[i] })),
  };
}

/**
 * A 2-player co-op run on two lockstep views (each client its own CoopSim, mySlot 0 and 1). Each player's
 * bot decides from its own view; the commands land on both at the same tick, in (tick, slot, seq) order.
 * `goneAt`: a wave after which player 1 drops out (a `gone` marker). `checkpointAt`: a wave end where a
 * third client rejoins from client 0's checkpoint and plays on.
 * @returns {{ views: object[], digests: string[][], hashes: number[][] }}
 */
export function runCoop({ start = coopStart(), policy = 'random', maxWaves = Infinity, goneAt = 0, checkpointAt = 0 } = {}) {
  const views = [createCoopSim(start, { mySlot: 0 }), createCoopSim(start, { mySlot: 1 })];
  const bots = [0, 1].map((i) => ({ policy, rng: createRng((start.tryout.seed ^ 0xb07) + i) }));
  const digests = views.map(() => []);
  const hashes = views.map(() => []);
  const seq = [0, 0];
  let gone = false;
  let rejoined = false;
  let guard = 0;
  const sim0 = views[0].sim;
  const applyAll = (cmds) => {
    cmds.sort((x, y) => x.p - y.p || x.s - y.s);
    for (const v of views) for (const c of cmds) v.apply(c);
  };
  while (sim0.state !== 'won' && sim0.state !== 'lost' && sim0.wave < maxWaves && guard++ < 400000) {
    const t = views[0].tick;
    if (sim0.state === 'prep' || sim0.state === 'between') {
      if (goneAt && !gone && sim0.wave >= goneAt) {
        gone = true;
        applyAll([{ t, p: 1, s: seq[1]++, k: 'gone', a: [] }]);
      }
      if (checkpointAt && !rejoined && sim0.wave >= checkpointAt) {
        rejoined = true;
        const snap = JSON.parse(JSON.stringify(views[0].snapshot()));
        const fresh = createCoopSim(start, { mySlot: 1 });
        fresh.restore(snap);
        views[1] = fresh;
      }
      const cmds = [];
      for (const slot of [0, 1]) {
        if (gone && slot === 1) continue;
        for (const c of decide(views[slot].sim, slot, bots[slot])) cmds.push({ t, p: slot, s: seq[slot]++, k: c.k, a: c.a });
      }
      applyAll(cmds);
      views.forEach((v, i) => digests[i].push(`${v.sim.wave}:${snapshotDigest(v.snapshot())}`));
    }
    for (let i = 0; i < 30; i++) {
      for (const v of views) v.step();
      if (sim0.state === 'won' || sim0.state === 'lost') break;
    }
    views.forEach((v, i) => hashes[i].push(v.hash()));
  }
  return { views, digests, hashes };
}

// ---------------------------------------------------------------------------
// Roster strengths (§9.2): the account stats every student brings into the run (the band clamps them anyway)
// ---------------------------------------------------------------------------
const acctStats = ({ L, gates, stars, atk, rate, extra = {} }) => ({
  ...DEFAULT_UNIT_STATS,
  damageMul: +((1 + 0.018 * (L - 1) + 0.02 * gates + 0.05 * stars) * (1 + atk)).toFixed(4),
  rateMul: +((1 + 0.004 * (L - 1)) * (1 + rate)).toFixed(4),
  level: L, awaken: stars, breakthrough: gates, awakenPassive: stars >= 3,
  ...extra,
});
/**
 * The three §9.2 accounts (tools/tryoutPower.mjs numbers). new: 2-5 cleared, Lv 30, gate 2, +10 % gear; mid: 6-5,
 * Lv 60, gate 5, 2 stars, +40 % gear, its secondary gear at the band cap's values (the cap is defined as this girl);
 * maxed: damage ×7.57, speed ×3.10, every other key above the band cap, ★3 and Potential 6.
 */
export const STRENGTHS = Object.freeze({
  new: acctStats({ L: 30, gates: 2, stars: 0, atk: 0.10, rate: 0.03 }),
  mid: acctStats({ L: 60, gates: 5, stars: 2, atk: 0.40, rate: 0.15, extra: { rangeMul: 1.1, critChance: 0.15, critMul: 1.5, armorPen: 3, costMul: 0.9, potential: 2 } }),
  maxed: {
    ...DEFAULT_UNIT_STATS, damageMul: 7.57, rateMul: 3.10, rangeMul: 1.3, critChance: 0.5, critMul: 2.5, armorPen: 10, costMul: 0.75, ultHaste: 0.3,
    pierceK: 100, auraPct: 0.15, auraRangeMul: 1.2, dotMul: 1.5, awakenPassive: true, level: 85, awaken: 3, breakthrough: 6, potential: 6,
  },
});

/** A pool (girl id → account stats) giving every Tryout student the strength's account; 'none' = all Loaners. */
export function poolFor(strength) {
  if (!strength || strength === 'none') return {};
  const st = STRENGTHS[strength];
  if (!st) throw new Error(`unknown strength ${strength} (new | mid | maxed | none)`);
  return Object.fromEntries(TRYOUT_STUDENTS.map((id) => [id, { ...st }]));
}

/** Runs `runs` seeds at one Grade and strength; the summary the CLI prints. */
export function sweep({ runs = 20, grade = 1, strength = 'none', policy = 'random', coop = false, length = 'half', seed0 = 1 } = {}) {
  const t0 = Date.now();
  let wins = 0;
  let cleared = 0;
  let periods = 0;
  let waves = 0;
  const rar = [0, 0, 0, 0, 0];
  const pool = poolFor(strength);
  for (let s = seed0; s < seed0 + runs; s++) {
    const seed = (s * 2654435761) >>> 0;
    const sim = coop
      ? runCoop({ start: coopStart({ seed, grade, length, pools: [pool, pool] }), policy }).views[0].sim
      : runSolo({ seed, grade, length, policy, pool }).sim;
    const r = sim.result();
    if (r.won) wins++;
    waves += r.wavesCleared;
    cleared += r.tryout.cleared[0];
    periods += r.tryout.periods.length;
    for (const p of r.tryout.players[0].picks) rar[p.rarity]++;
  }
  const picks = rar.reduce((a, b) => a + b, 0);
  return {
    strength, grade, runs, coop, policy, length,
    winRate: wins / runs, meanWaves: waves / runs, assignments: periods * 3, clearRate: cleared / Math.max(1, periods * 3),
    rarity: rar.map((n) => n / Math.max(1, picks)), picks, seconds: (Date.now() - t0) / 1000,
  };
}

const pct = (x) => `${Math.round(100 * x)} %`;
function printSweep(r) {
  console.log(`${r.coop ? 'co-op' : 'solo'} ${r.length} Grade ${r.grade}, strength ${r.strength}, ${r.runs} runs, policy ${r.policy} (${r.seconds.toFixed(1)} s, ${(r.seconds / r.runs).toFixed(2)} s/run)`);
  console.log(`  wins ${pct(r.winRate)}, mean waves cleared ${r.meanWaves.toFixed(1)}`);
  console.log(`  assignments cleared ${pct(r.clearRate)} of ${r.assignments}`);
  console.log(`  pick rarity R / SR / SSR / UR / LR: ${r.rarity.map((x) => Math.round(100 * x)).join(' / ')} % (${r.picks} picks)`);
}

// ---------------------------------------------------------------------------
// CLI
//   node --import ./tools/simLoader.mjs tools/tryoutBot.mjs [runs=40] [grade=1] [policy=random|first|hand] [--coop]
//        [--runs N] [--grade N] [--policy p] [--strength new|mid|maxed|none] [--length half|full] [--seed0 N] [--json]
//   … --sweep [--runs N] [--grade N]: N seeds for each of the three strengths (new, mid, maxed) at that Grade
// ---------------------------------------------------------------------------
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const argv = process.argv.slice(2);
  const VALUED = ['--runs', '--grade', '--policy', '--strength', '--length', '--seed0'];
  const opt = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
  const pos = argv.filter((a, i) => !a.startsWith('--') && !VALUED.includes(argv[i - 1]));
  const base = {
    runs: +opt('runs', pos[0] || (argv.includes('--sweep') ? 20 : 40)),
    grade: +opt('grade', pos[1] || 1),
    policy: opt('policy', pos[2] || 'random'),
    coop: argv.includes('--coop'),
    length: opt('length', 'half'),
    seed0: +opt('seed0', 1),
  };
  const strengths = argv.includes('--sweep') ? ['new', 'mid', 'maxed'] : [opt('strength', 'none')];
  for (const strength of strengths) {
    const r = sweep({ ...base, strength });
    if (argv.includes('--json')) console.log(JSON.stringify(r));
    else printSweep(r);
  }
}
