// Tryout Day headless bot (docs/specs/TRYOUT_DAY.md §15): plays runs with simple placement, upgrade, pick and Hall
// Pass policies, solo or as both players of a 2-player co-op run (real lockstep CoopSims fed the same commands).
// The tests drive it too (tests/sim/tryout.test.js, tests/online/tryoutCoop.test.js).
//
// usage: node --import ./tools/simLoader.mjs tools/tryoutBot.mjs [runs=40] [grade=1] [policy=random|first] [--coop]
import { Sim } from '../src/sim/Sim.js';
import { createRng } from '../src/core/rng.js';
import { buildTryoutPlan, buildTryoutStage } from '../src/sim/tryout/index.js';
import { createCoopSim } from '../src/online/coop/commands.js';
import { snapshotDigest } from '../src/sim/snapshot.js';

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
// CLI: a sweep
// ---------------------------------------------------------------------------
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const args = process.argv.slice(2).filter((x) => !x.startsWith('--'));
  const coop = process.argv.includes('--coop');
  const runs = +(args[0] || 40);
  const grade = +(args[1] || 1);
  const policy = args[2] || 'random';
  let wins = 0;
  let cleared = 0;
  let periods = 0;
  const rar = [0, 0, 0, 0, 0];
  let waves = 0;
  for (let s = 1; s <= runs; s++) {
    const seed = (s * 2654435761) >>> 0;
    const sim = coop ? runCoop({ start: coopStart({ seed, grade }), policy }).views[0].sim : runSolo({ seed, grade, policy }).sim;
    const r = sim.result();
    if (r.won) wins++;
    waves += r.wavesCleared;
    cleared += r.tryout.cleared[0];
    periods += r.tryout.periods.length;
    for (const p of r.tryout.players[0].picks) rar[p.rarity]++;
  }
  const picks = rar.reduce((a, b) => a + b, 0) || 1;
  console.log(`${coop ? 'co-op' : 'solo'} Grade ${grade}, ${runs} runs, policy ${policy}`);
  console.log(`wins ${Math.round((100 * wins) / runs)} %, mean waves cleared ${(waves / runs).toFixed(1)}`);
  console.log(`assignments cleared ${Math.round((100 * cleared) / Math.max(1, periods * 3))} % of ${periods * 3}`);
  console.log(`pick rarity R / SR / SSR / UR / LR: ${rar.map((n) => Math.round((100 * n) / picks)).join(' / ')} %`);
}
