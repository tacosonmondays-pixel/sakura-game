// Freeplay balance bot that knows the one-final-tier-per-path rule (spec §6.3). Plays a campaign
// stage in Freeplay until it falls (or --maxWave) with a scripted build, spending deterministically
// every 0.5 s of game time, and prints one JSON line: the wave it fell on, the first leak, lives
// lost by enemy tier, final-tier and tier-4 counts, the girls, coins earned and left unspent.
//
//   node --import ./tools/simLoader.mjs tools/capBot.mjs --build A|A2|AE|B|C --stage 4-5 --tier blossom
//        [--seed 7] [--maxWave 260] [--coop 1|2] [--difficulty normal] [--log]
//        [--profile p1|f2p-steady|f2p-late|whale] [--potential p1|f2p-steady|whale|1…6]
//        [--level 60|75|85] [--gear maxed|late|urLate|full] [--lives N] [--shares]
//
// Profile (tools/potentialProfiles.mjs): default p1 = MAXED (tools/freeplayBot.mjs: ★5, legendary +10,
// average rolls) at level 60 and P1; the Potential v3 profiles change Potential, level and gear for
// every girl (both players in --coop 2). Hero Hikari (she levels in battle; the hero rework took her
// tiers away). tools/killcap.mjs runs the same bot and then measures the board's kill capacity.
// Builds (each copy of a girl type has its own plan; a refused tier 5 finishes her crosspath):
//   A  "smart mixed team", 32 girls: Shiro, Kage, Aoi, Akane, Sango (carries), Miko, Midori, Momo.
//      Order: Momo copy 1 to 3-0-0 → one of each → every copy 1 to main 3 + cross 2 → main tier 4
//      (carries first) → final tiers on the copy-1 main paths (carries, then supports) → copy 2 of
//      each type to its own final path → further copies at tier 4 up to the cap → any free final path.
//   A2 Build A with Chika (copy 1 0-5-2: tune-up / overclock; copy 2 5-2-0) instead of Momo.
//   AE Build A with Ena in Kage's place.
//   B  "Kage army", 28 Kages: 5-0-2 / 2-0-5 / 2-5-0, then 4-0-2. Order: 8 copies at 2-0-0 → all to
//      tier 3 → tier 4 → the three final tiers → more copies.
//   C  the research's std team (tools/freeplayBot.mjs, cheapest step first, cap-aware).
// Supports (Miko, Midori, Chika) stand where they reach the most placed carries; everyone else on the
// lattice spot that covers the most road for her range. No picks: brews and links pick themselves.
// --coop 1: the co-op stage (HP ×1.6), one bot, one wallet. --coop 2: a CoopSim with two players and
// two wallets (P0 Shiro, Kage, Aoi, Akane, Momo + Hikari; P1 Sango, Miko, Midori, Shiro, Kage), each
// running Build A's per-type plans for her own girls (her own final tiers: the cap is per player).
import { Sim } from '../src/sim/Sim.js';
import { samplePath } from '../src/sim/path.js';
import { soloFreeplayStage } from '../src/data/freeplaySolo.js';
import { coopStage, COOP } from '../src/data/coop.js';
import { createCoopSim, quantize } from '../src/online/coop/commands.js';
import { withDetMath } from '../src/core/detMath.js';
import { DEFAULT_UNIT_STATS } from '../src/sim/constants.js';
import { pathToFileURL } from 'node:url';
import { runBot } from './freeplayBot.mjs';
import { profileFromArgs, profileStats } from './potentialProfiles.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);
/** The stat profile every girl fights with (tools/potentialProfiles.mjs). */
export const PROFILE = profileFromArgs(opt);
const statsOf = (unitId) => profileStats(unitId, PROFILE);
const build = opt('build', 'A');
const stageId = opt('stage', '4-5');
const tier = opt('tier', 'blossom');
const seed = Number(opt('seed', 7));
const maxWave = Number(opt('maxWave', 260));
const coop = Number(opt('coop', 0));
const difficulty = opt('difficulty', 'normal');
const verbose = args.includes('--log');
/** --lives N: start with N lives (a Nightmare run with lives to spare shows where each kind of enemy first gets through). */
const livesOpt = Number(opt('lives', 0));

/** Copy plans per type: copies 1, 2, 3, then every further copy (null: no such copy). */
const PLANS = {
  shiro: ['5-0-2', '2-0-5', null, '4-0-2'],
  kage: ['5-0-2', '0-2-5', '2-5-0', '4-0-2'],
  aoi: ['0-2-5', '5-0-2', null, '0-2-4'],
  akane: ['5-0-2', '2-0-5', null, '4-0-2'],
  sango: ['5-0-2', '0-2-5', null, '0-4-2'],
  miko: ['5-2-0', '0-5-2', null, null],
  midori: ['5-0-2', '2-0-5', null, null],
  momo: ['5-0-2', '0-5-2', null, null],
  chika: ['0-5-2', '5-2-0', null, null],
  ena: ['5-0-2', '2-0-5', null, '4-0-2'],
};
const KAGE_ARMY = ['5-0-2', '2-0-5', '2-5-0', '4-0-2'];
const CARRIES = ['shiro', 'kage', 'aoi', 'akane', 'sango', 'ena'];
const SUPPORTS = new Set(['miko', 'midori', 'chika']);
const HERO = 'hikari';
const HERO_PLAN = '5-0-2';

const parse = (s) => s.split('-').map(Number);
function planOf(p) {
  const t = parse(p);
  const main = t.indexOf(Math.max(...t));
  const cross = [0, 1, 2].find((i) => i !== main && t[i] > 0) ?? -1;
  return { t, main, cross };
}

/**
 * One player's spending brain over a Sim view. `act` executes ('place' | 'upg') and returns
 * truthy on success; `cash()` this player's coins; `mine(t)` whether a tower is hers.
 */
function makeBrain({ sim, types, first, cap, copiesOf, carries, hero, act, cash, mine, prep = () => {} }) {
  const meta = new Map(); // uid → { type, idx, plan, refused: Set<path> }
  const order = []; // uids in placement order
  let heroUid = null;
  let rr = 0; // round robin over types for further copies
  let noRoom = new Set();

  const samples = sim.pathData.flatMap((p) => samplePath(p, 0.5)).filter((s) => !s.hidden);
  const lattice = [];
  for (let y = 0.3; y < sim.map.height; y += 0.25) for (let x = 0.3; x < sim.map.width; x += 0.25) lattice.push({ x: x + 0.013, y: y + 0.007 });
  const covCache = new Map();
  const byCoverage = (range) => {
    const key = range.toFixed(2);
    if (!covCache.has(key)) {
      const r2 = range * range;
      covCache.set(key, lattice.map((c) => ({ ...c, cov: samples.reduce((a, s) => a + ((s.x - c.x) ** 2 + (s.y - c.y) ** 2 <= r2 ? 1 : 0), 0) }))
        .filter((c) => c.cov > 0).sort((a, b) => b.cov - a.cov));
    }
    return covCache.get(key);
  };
  const canStand = (u, c) => {
    const keep = sim.cash;
    sim.cash = 1e15;
    try {
      return sim.canPlace(u, c.x, c.y).ok;
    } finally {
      sim.cash = keep;
    }
  };
  function spotFor(u) {
    const def = sim.data.unit(u);
    const range = Math.min(6, def.base.range || 3);
    if (SUPPORTS.has(u)) {
      // where she reaches the most placed carries (ties: road coverage)
      const reach = def.base.aura?.range || range;
      const cs = sim.towers.filter((t) => carries.includes(t.unitId));
      let best = null;
      for (const c of byCoverage(range)) {
        const n = cs.reduce((a, t) => a + ((t.x - c.x) ** 2 + (t.y - c.y) ** 2 <= reach * reach ? 1 : 0), 0);
        if ((!best || n > best.n) && canStand(u, c)) best = { ...c, n };
      }
      return best;
    }
    return byCoverage(range).find((c) => canStand(u, c)) || null;
  }

  const copies = (ty) => order.map((uid) => sim.getTower(uid)).filter((t) => t && meta.get(t.uid)?.type === ty);
  const copyOf = (ty, idx) => order.map((uid) => sim.getTower(uid)).find((t) => t && meta.get(t.uid)?.type === ty && meta.get(t.uid).idx === idx) || null;
  const planFor = (ty, idx) => {
    const c = copiesOf(ty);
    if (idx < 3 && c[idx]) return c[idx];
    if (idx >= 2) return c[3] || null;
    return null;
  };
  const girls = () => order.filter((uid) => sim.getTower(uid)).length;

  function place(ty, idx) {
    return { kind: 'place', ty, idx };
  }
  /** The next step taking tower `t` up to `n` on `path` (null when she is there or cannot go). */
  function upTo(t, path, n) {
    if (!t || path < 0) return null;
    const m = meta.get(t.uid);
    const lim = m?.refused?.has(path) ? Math.min(n, 4) : n;
    if (t.tiers[path] >= lim) return null;
    return { kind: 'upg', uid: t.uid, path };
  }
  function fullPlan(t) {
    const m = meta.get(t.uid);
    if (!m) return null;
    const { t: tt, main, cross } = m.plan;
    return upTo(t, main, Math.min(3, tt[main])) || (cross >= 0 ? upTo(t, cross, tt[cross]) : null) || upTo(t, main, tt[main]);
  }
  function heroStep(n) {
    const h = heroUid != null ? sim.getTower(heroUid) : null;
    // the hero rework: a hero has no tiers (she levels in battle), so never ask for one (a refused
    // hero step is not recorded anywhere, so asking stalled the whole build at "one of each")
    if (!h || !h.def.paths?.some((p) => p?.tiers?.length)) return null;
    const p = planOf(HERO_PLAN);
    return n === 'base' ? upTo(h, p.main, 3) || upTo(h, p.cross, p.t[p.cross]) : upTo(h, p.main, n);
  }

  function next() {
    // 1. the economy girl first, to tier 3
    if (first) {
      const c = copyOf(first, 0);
      if (!c && !noRoom.has(first)) return place(first, 0);
      const s = c && upTo(c, meta.get(c.uid).plan.main, 3);
      if (s) return s;
    }
    if (hero && heroUid == null && !noRoom.has(HERO)) return { kind: 'hero' };
    // 2. one of each
    for (const ty of types) if (!copyOf(ty, 0) && !noRoom.has(ty)) return place(ty, 0);
    const ones = types.map((ty) => copyOf(ty, 0)).filter(Boolean);
    // 3. every copy 1 to main 3 + cross
    for (const t of ones) {
      const m = meta.get(t.uid);
      const s = upTo(t, m.plan.main, 3) || (m.plan.cross >= 0 ? upTo(t, m.plan.cross, m.plan.t[m.plan.cross]) : null);
      if (s) return s;
    }
    const hb = heroStep('base');
    if (hb) return hb;
    // 4. main tier 4, carries first; 5. final tiers on the copy-1 main paths, carries first
    const carriesFirst = [...ones.filter((t) => carries.includes(meta.get(t.uid).type)), ...ones.filter((t) => !carries.includes(meta.get(t.uid).type))];
    for (const t of carriesFirst) {
      const m = meta.get(t.uid);
      const s = upTo(t, m.plan.main, Math.min(4, m.plan.t[m.plan.main]));
      if (s) return s;
    }
    for (const t of carriesFirst) {
      const m = meta.get(t.uid);
      const s = upTo(t, m.plan.main, m.plan.t[m.plan.main]);
      if (s) return s;
    }
    const h5 = heroStep(5);
    if (h5) return h5;
    // 6. copy 2 of each type, all the way
    for (const ty of types) {
      if (!planFor(ty, 1)) continue;
      const c = copyOf(ty, 1);
      if (!c) {
        if (girls() < cap && !noRoom.has(ty)) return place(ty, 1);
        continue;
      }
      const s = fullPlan(c);
      if (s) return s;
    }
    // 7. further copies (each finished before the next) up to the cap
    for (const uid of order) {
      const t = sim.getTower(uid);
      const m = t && meta.get(uid);
      if (!m || m.idx < 2) continue;
      const s = fullPlan(t);
      if (s) return s;
    }
    if (girls() < cap) {
      const able = types.filter((ty) => !noRoom.has(ty) && planFor(ty, copies(ty).length));
      if (able.length) {
        const ty = able[rr % able.length];
        return { ...place(ty, copies(ty).length), rr: true };
      }
    }
    // 8. any final path still free: a tier-4 copy whose main path's tier 5 nobody holds
    for (const uid of order) {
      const t = sim.getTower(uid);
      const m = t && meta.get(uid);
      if (!m || m.refused.has(m.plan.main)) continue;
      if (t.tiers[m.plan.main] === 4 && !sim.finalTierHolder(uid, m.plan.main)) return { kind: 'upg', uid, path: m.plan.main };
    }
    return null;
  }

  /** Spends while it can: one step at a time in order; waits (returns) when the next step costs too much. */
  function spend() {
    for (let guard = 0; guard < 80; guard++) {
      prep(); // co-op: this player's view (wallet, loadout) before every read
      const s = next();
      if (!s) return;
      if (s.kind === 'hero') {
        const c = spotFor(hero);
        if (!c) {
          noRoom.add(HERO);
          continue;
        }
        const cost = sim.canPlace(hero, c.x, c.y).cost ?? 0;
        if (cash() < cost) return;
        const t = act('place', hero, c);
        if (!t) {
          noRoom.add(HERO);
          continue;
        }
        heroUid = t.uid;
        continue;
      }
      if (s.kind === 'place') {
        const c = spotFor(s.ty);
        if (!c) {
          noRoom.add(s.ty);
          continue;
        }
        const chk = sim.canPlace(s.ty, c.x, c.y);
        if (!chk.ok && chk.reason === 'cash') return;
        if (cash() < (chk.cost ?? 0)) return;
        const t = act('place', s.ty, c);
        if (!t) {
          noRoom.add(s.ty);
          continue;
        }
        meta.set(t.uid, { type: s.ty, idx: s.idx, plan: planOf(planFor(s.ty, s.idx)), refused: new Set() });
        order.push(t.uid);
        if (s.ty === 'shiro') act('tgt', t.uid, 'strong');
        if (s.rr) rr++;
        continue;
      }
      const t = sim.getTower(s.uid);
      if (!t) continue;
      const st = sim.upgradeStatus(s.uid, s.path);
      if (st.reason === 'cash' || cash() < (st.cost ?? Infinity)) return;
      if (st.reason === 'onePerPath') {
        // a refused tier 5 finishes her crosspath instead
        meta.get(s.uid)?.refused.add(s.path);
        continue;
      }
      if (st.locked) {
        meta.get(s.uid)?.refused.add(s.path); // crosspath / max: never ask again
        continue;
      }
      if (!act('upg', s.uid, s.path)) return;
    }
  }
  return { spend, meta, order, mine };
}

function buildConfig(name) {
  if (name === 'B') return { types: ['kage'], first: null, cap: 28, copiesOf: () => KAGE_ARMY, carries: ['kage'] };
  // AE: Build A with Ena in Kage's place (her spreading hex in a team where the others take the kills)
  const types = name === 'A2' ? ['shiro', 'kage', 'aoi', 'akane', 'sango', 'miko', 'midori', 'chika']
    : name === 'AE' ? ['shiro', 'ena', 'aoi', 'akane', 'sango', 'miko', 'midori', 'momo'] : ['shiro', 'kage', 'aoi', 'akane', 'sango', 'miko', 'midori', 'momo'];
  return { types, first: name === 'A2' ? null : 'momo', cap: 32, copiesOf: (ty) => PLANS[ty], carries: CARRIES };
}

// ---- runs ------------------------------------------------------------------------------------
function summarize(sim, extra) {
  const lostBy = { boss: 0, miniboss: 0, elite: 0, normal: 0 };
  const firstBy = {};
  let firstLeak = null;
  for (const l of sim.stats.leakLog || []) {
    if (l.wave <= sim.totalWaves) continue;
    const tierE = sim.data.enemy(l.enemyId)?.tier || 'normal';
    if (verbose) process.stderr.write(`leak w${l.wave} ${l.enemyId} (${tierE}) -${l.lives}\n`);
    lostBy[tierE] = (lostBy[tierE] || 0) + l.lives;
    if (firstBy[tierE] == null) firstBy[tierE] = l.wave;
    if (firstLeak == null) firstLeak = l.wave;
  }
  const towers = sim.towers.filter((t) => !t.isHero);
  const finals = towers.flatMap((t) => t.tiers.map((n, p) => (n === 5 ? `${t.unitId}:${p}` : null)).filter(Boolean));
  const t4 = towers.reduce((a, t) => a + t.tiers.filter((n) => n === 4).length, 0);
  const girls = {};
  for (const t of towers) girls[t.unitId] = (girls[t.unitId] || 0) + 1;
  return {
    build, stage: stageId, tier, seed, coop, fell: sim.state === 'lost' ? sim.wave : null, reached: sim.wave, goal: sim.totalWaves,
    firstLeak, firstBy, lostBy, finals: finals.length, finalPaths: finals.sort().join(' '), t4, girls, towers: towers.length,
    coinsEarned: Math.round(sim.stats.cashEarned || 0), ...extra,
  };
}

/**
 * One solo run (or --coop 1: the co-op stage with one bot and one wallet). `data` adds sim data (the
 * kill-capacity dummies); `after(sim)` runs on the board as the run ends and its result rides as `kc`.
 */
export function runSolo({ data = {}, after = null, maxWave: lastWave = maxWave } = {}) {
  const cfg = buildConfig(build);
  const stage = coop === 1 ? coopStage(stageId, { freeplay: tier }) : soloFreeplayStage(stageId, tier);
  const loadout = cfg.types.map((unitId) => ({ unitId, stats: statsOf(unitId) }));
  const sim = withDetMath(() => new Sim({ stageId, difficulty, seed, loadout, hero: { unitId: HERO, stats: statsOf(HERO) }, options: { freeplay: true, autoStart: false }, data: { ...data, stage } }));
  if (coop === 1) sim.cash = Math.round(sim.cash * COOP.cashShare * 2);
  if (livesOpt > 0) sim.lives = sim.maxLives = livesOpt;
  const act = (k, a, b) => {
    if (k === 'place') return sim.placeTower(a, b.x, b.y);
    if (k === 'upg') return sim.upgradeTower(a, b);
    if (k === 'tgt') return sim.setTargetMode(a, b);
    return null;
  };
  const brain = makeBrain({ sim, ...cfg, hero: HERO, act, cash: () => sim.cash, mine: () => true });
  const spend = build === 'B' ? kageArmySpend(sim, brain, act) : brain.spend;
  const t0 = Date.now();
  withDetMath(() => {
    while (sim.state !== 'lost' && sim.state !== 'won' && sim.wave <= lastWave) {
      spend();
      if (sim.state === 'prep' || sim.state === 'between') {
        if (sim.wavesCleared >= lastWave) break;
        sim.startNextWave();
      }
      sim.update(0.5);
      sim.drainEvents();
      if (verbose && sim.state === 'between') process.stderr.write(`w${sim.wave} lives ${sim.lives} girls ${sim.towers.length} cash ${Math.round(sim.cash)}\n`);
    }
  });
  const sum = summarize(sim, { unspent: Math.round(sim.cash), wallSec: Math.round((Date.now() - t0) / 1000), ...(args.includes('--shares') ? { shares: shares(sim) } : {}) });
  return after ? { ...sum, kc: withDetMath(() => after(sim)) } : sum;
}

/** --shares: each girl type's share of the run's damage (%), largest first. */
function shares(sim) {
  const by = {};
  let all = 0;
  for (const t of sim.towers) {
    by[t.unitId] = (by[t.unitId] || 0) + (t.damageDealt || 0);
    all += t.damageDealt || 0;
  }
  return Object.fromEntries(Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(100 * v / (all || 1)).toFixed(1)]));
}

/** Build B's order on top of the generic placement / upgrade steps. */
function kageArmySpend(sim, brain, act) {
  // the generic brain already walks: copy 1 → main 3 / cross → main 4 → main 5 → copy 2 → ...;
  // the army wants 8 copies at 2-0-0 first, then all to tier 3, tier 4, the three finals, more copies
  const meta = brain.meta;
  const spotKage = () => {
    const keep = sim.cash;
    sim.cash = 1e15;
    try {
      const range = sim.data.unit('kage').base.range || 3;
      const samples = sim.pathData.flatMap((p) => samplePath(p, 0.5)).filter((s) => !s.hidden);
      let best = null;
      for (let y = 0.3; y < sim.map.height; y += 0.25) {
        for (let x = 0.3; x < sim.map.width; x += 0.25) {
          if (!sim.canPlace('kage', x, y).ok) continue;
          const cov = samples.reduce((a, s) => a + ((s.x - x) ** 2 + (s.y - y) ** 2 <= range * range ? 1 : 0), 0);
          if (!best || cov > best.cov) best = { x, y, cov };
        }
      }
      return best;
    } finally {
      sim.cash = keep;
    }
  };
  let heroDone = false;
  let full = false;
  const kages = () => brain.order.map((u) => sim.getTower(u)).filter(Boolean);
  const placeKage = () => {
    const c = spotKage();
    if (!c) {
      full = true;
      return false;
    }
    const chk = sim.canPlace('kage', c.x, c.y);
    if (!chk.ok) return false;
    const t = act('place', 'kage', c);
    if (!t) return false;
    const idx = kages().length;
    meta.set(t.uid, { type: 'kage', idx, plan: planOf(idx < 3 ? KAGE_ARMY[idx] : KAGE_ARMY[3]), refused: new Set() });
    brain.order.push(t.uid);
    return true;
  };
  const up = (t, path, n) => {
    const m = meta.get(t.uid);
    const lim = m.refused.has(path) ? Math.min(n, 4) : n;
    if (t.tiers[path] >= lim) return 'done';
    const st = sim.upgradeStatus(t.uid, path);
    if (st.reason === 'onePerPath' || (st.locked && st.reason !== 'cash')) {
      m.refused.add(path);
      return 'done';
    }
    if (st.reason === 'cash') return 'wait';
    return act('upg', t.uid, path) ? 'again' : 'wait';
  };
  return function spend() {
    for (let guard = 0; guard < 80; guard++) {
      if (!heroDone) {
        heroDone = true;
        const keep = sim.cash;
        sim.cash = 1e15;
        let spot = null;
        for (let y = 0.3; y < sim.map.height && !spot; y += 0.25) for (let x = 0.3; x < sim.map.width && !spot; x += 0.25) if (sim.canPlace(HERO, x, y).ok && sim.placement.pathDistance(x, y) < 1.5) spot = { x, y };
        sim.cash = keep;
        if (spot && sim.canPlace(HERO, spot.x, spot.y).ok) act('place', HERO, spot);
        else heroDone = false;
        if (!heroDone) return;
      }
      const ks = kages();
      if (ks.length < 8 && !full) {
        if (!placeKage()) return;
        continue;
      }
      let r = null;
      // 2-0-0 on the first 8 (path 0 to 2)
      for (const t of ks.slice(0, 8)) if ((r = up(t, 0, 2)) !== 'done') break;
      if (r === 'wait') return;
      if (r === 'again') continue;
      // all to tier 3 (main) + their crosspath
      for (const t of ks.slice(0, 8)) {
        const p = meta.get(t.uid).plan;
        if ((r = up(t, p.main, 3)) !== 'done') break;
        if (p.cross >= 0 && (r = up(t, p.cross, p.t[p.cross])) !== 'done') break;
      }
      if (r === 'wait') return;
      if (r === 'again') continue;
      for (const t of ks.slice(0, 8)) if ((r = up(t, meta.get(t.uid).plan.main, 4)) !== 'done') break;
      if (r === 'wait') return;
      if (r === 'again') continue;
      for (const t of ks.slice(0, 3)) if ((r = up(t, meta.get(t.uid).plan.main, 5)) !== 'done') break;
      if (r === 'wait') return;
      if (r === 'again') continue;
      // more copies, each to 4-0-2
      for (const t of ks.slice(8)) {
        const p = meta.get(t.uid).plan;
        if ((r = up(t, p.main, 3)) !== 'done') break;
        if ((r = up(t, p.cross, p.t[p.cross])) !== 'done') break;
        if ((r = up(t, p.main, 4)) !== 'done') break;
      }
      if (r === 'wait') return;
      if (r === 'again') continue;
      if (ks.length < 28 && !full) {
        const cost = sim.canPlace('kage', -99, -99).cost ?? sim.data.unit('kage').base.cost;
        if (sim.cash < cost) return;
        if (!placeKage()) return;
        continue;
      }
      return;
    }
  };
}

/** --coop 2: two bots on a CoopSim, two wallets, per-player caps, income split; `after(sim)` as in runSolo. */
export function runCoop2({ data = {}, after = null, maxWave: lastWave = maxWave } = {}) {
  const P0 = ['shiro', 'kage', 'aoi', 'akane', 'momo'];
  const P1 = ['sango', 'miko', 'midori', 'shiro', 'kage'];
  const start = {
    seed, stageId, difficulty, freeplay: tier,
    players: [
      { slot: 0, uid: 'a', name: 'A', loadout: P0.map((unitId) => ({ unitId, stats: statsOf(unitId) })), hero: { unitId: HERO, stats: statsOf(HERO) } },
      { slot: 1, uid: 'b', name: 'B', loadout: P1.map((unitId) => ({ unitId, stats: statsOf(unitId) })), hero: null },
    ],
  };
  const C = createCoopSim(start, { mySlot: 0 });
  const sim = C.sim;
  if (data.enemies) {
    // extra enemy defs (the kill-capacity dummies) beside the stage's own
    const own = sim.data.enemy.bind(sim.data);
    sim.data.enemy = (id) => data.enemies[id] || own(id);
  }
  let seq = 0;
  const mkAct = (slot) => (k, a, b) => {
    const cmd = (kind, args) => C.apply({ t: C.tick, p: slot, s: seq++, k: kind, a: args });
    if (k === 'place') {
      const r = cmd('place', [a, ...quantize(b.x, b.y)]);
      return r.ok ? r.tower : null;
    }
    if (k === 'upg') return cmd('upg', [a, b]).ok;
    if (k === 'tgt') return cmd('tgt', [a, b]).ok;
    return null;
  };
  // each brain reads the Sim through her own view (wallet, loadout, hero): CoopSim.apply() switches
  // the view for a command and back to slot 0 after it, so the brain sets hers before every read
  const heroCfg = sim.heroConfig;
  const loadouts = [P0, P1].map((ids) => new Map(ids.map((u) => [u, { ...DEFAULT_UNIT_STATS, ...statsOf(u) }])));
  const brains = [0, 1].map((slot) => {
    const types = slot === 0 ? P0 : P1;
    return makeBrain({
      sim, types, first: slot === 0 ? 'momo' : null, cap: 16, copiesOf: (ty) => PLANS[ty], carries: CARRIES,
      hero: slot === 0 ? HERO : null, act: mkAct(slot), cash: () => C.wallets[slot], mine: (t) => C.ownerOf(t.uid) === slot,
      prep: () => {
        sim.cash = C.wallets[slot];
        sim.loadout = loadouts[slot];
        sim.heroConfig = slot === 0 ? heroCfg : null;
      },
    });
  });
  const view0 = { loadout: sim.loadout };
  const think = (slot) => {
    try {
      brains[slot].spend();
    } finally {
      sim.cash = C.wallets[0];
      sim.loadout = view0.loadout;
      sim.heroConfig = heroCfg;
    }
  };
  const t0 = Date.now();
  while (sim.state !== 'lost' && sim.state !== 'won' && sim.wave <= lastWave) {
    think(0);
    think(1);
    if (sim.state === 'prep' || sim.state === 'between') {
      if (sim.wavesCleared >= lastWave) break;
      C.apply({ t: C.tick, p: 0, s: seq++, k: 'wave', a: [] });
    }
    for (let i = 0; i < 30; i++) C.step();
    sim.drainEvents();
  }
  const sum = summarize(sim, { wallets: C.wallets, wallSec: Math.round((Date.now() - t0) / 1000) });
  return after ? { ...sum, kc: withDetMath(() => after(sim)) } : sum;
}

/** The run the command line asks for (Build C: tools/freeplayBot.mjs's own bot, P1 MAXED only). */
export function runCapBot(hooks = {}) {
  if (build === 'C') {
    if (PROFILE.potential !== 'p1' || PROFILE.level !== 60 || PROFILE.gear !== 'maxed' || hooks.after) throw new Error('Build C runs tools/freeplayBot.mjs at P1 MAXED only');
    const r = runBot({ stageId, tier, build: 'team', difficulty, maxWave, seed, towers: 60, coop: coop === 1 });
    const { waves, ...rest } = r;
    return { build: 'C', stage: stageId, tier, seed, coop, ...rest };
  }
  const out = coop === 2 ? runCoop2(hooks) : runSolo(hooks);
  return { profile: PROFILE, ...out };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(runCapBot()));
