// Tryout Day headless bot (docs/specs/TRYOUT_DAY.md §15): plays runs with simple placement, upgrade, pick and Hall
// Pass policies, solo or as both players of a 2-player co-op run (real lockstep CoopSims fed the same commands).
// The tests drive it too (tests/sim/tryout.test.js, tests/online/tryoutCoop.test.js).
//
// usage: node --import ./tools/simLoader.mjs tools/tryoutBot.mjs [runs=40] [grade=1] [policy=random|first] [--coop]
//        [--strength new|mid|maxed|none] [--grade N] [--runs N] [--sweep] (see the CLI at the end)
import { Sim } from '../src/sim/Sim.js';
import { createRng } from '../src/core/rng.js';
import { buildTryoutPlan, buildTryoutStage } from '../src/sim/tryout/index.js';
import { createCoopSim } from '../src/online/coop/commands.js';
import { snapshotDigest } from '../src/sim/snapshot.js';
import { DEFAULT_UNIT_STATS } from '../src/sim/constants.js';
import { TRYOUT_STUDENTS } from '../src/data/tryout.js';

const Q = 1024;
const SAMPLE = 0.5;

/** Legal-ish spots by how much road lies within 3 tiles (best first), on a half-tile lattice. */
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
 * Picks: `random` (a seeded random legal choice) or `first`; places her squad, upgrades, moves one girl onto
 * a free seat at a break.
 */
export function decide(sim, slot, bot) {
  const ty = sim.tryout;
  const p = ty.players[slot];
  const cmds = [];
  if (p.win === 'pick' && p.offer) {
    const o = p.offer;
    if (bot.policy === 'hand' || (bot.policy === 'random' && bot.rng.next() < 0.1)) cmds.push({ k: 'tr', a: ['hand', o.seq] });
    else {
      const i = bot.policy === 'first' ? 0 : Math.floor(bot.rng.next() * o.cards.length);
      cmds.push({ k: 'tr', a: ['take', o.seq, i] });
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
  // place: the hero first, then each squad girl once, then more copies of the first two
  const spots = bot.spots || (bot.spots = spotsFor(sim));
  const want = [];
  const hc = sim.heroConfigs[slot];
  if (hc && !sim.heroes[slot]) want.push(hc.unitId);
  const have = new Set(sim.towers.filter((t) => (t.owner ?? 0) === slot).map((t) => t.unitId));
  for (const id of p.squad) if (!have.has(id)) want.push(id);
  if (sim.wave > 6) for (const id of p.squad.slice(0, 2)) want.push(id);
  let cash = sim.cash;
  for (const id of want) {
    const cost = sim.placeCost(id);
    if (cost > cash) continue;
    const s = spots.find((o) => !sim.placementReason(id, o.x, o.y) && !bot.taken?.has(`${o.x},${o.y}`));
    if (!s) continue;
    (bot.taken || (bot.taken = new Set())).add(`${s.x},${s.y}`);
    cmds.push({ k: 'place', a: [id, Math.round(s.x * Q) + ((Math.round(s.x * Q) % Q === 0 && Math.round(s.y * Q) % Q === 0) ? 1 : 0), Math.round(s.y * Q)] });
    cash -= cost;
  }
  for (const t of sim.towers) {
    if (t.isHero || (t.owner ?? 0) !== slot) continue;
    for (const path of [0, 2, 1]) {
      const st = sim.upgradeStatus(t.uid, path);
      if (!st.locked && st.cost <= cash) {
        cmds.push({ k: 'upg', a: [t.uid, path] });
        cash -= st.cost;
        break;
      }
    }
  }
  cmds.push({ k: 'wave', a: [] });
  return cmds;
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
