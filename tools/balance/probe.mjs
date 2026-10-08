// Balance probe core: runs one headless battle (src/sim/headless.js runHeadless + autoPlan, the
// same executor the campaign balance test uses) and measures it — result, cash flow per wave,
// what the bot bought and when, and how long every enemy lived and how far it walked.
//
// Measurement is observation only: Sim prototype methods are wrapped for the duration of one
// run and restored afterwards, so the battle itself is exactly the one the balance test plays
// (same plan, seed and data; the wrappers consume no RNG). The only behaviour change is the
// optional `ult` flag of the human-like planner, which fires the hero ult when it is ready.
//
// IMPORTANT: load this module only after tools/balance/register.mjs (src/sim/data.js uses Vite's
// import.meta.glob); tools/balance/measure.mjs does that for you.

import { Sim, roundCost } from '../../src/sim/Sim.js';
import { defaultData } from '../../src/sim/data.js';
import { runHeadless, autoPlan } from '../../src/sim/headless.js';
import { baseCost } from '../../src/sim/towers.js';
import { generateWave } from '../../src/sim/waves.js';
import { buildPaths } from '../../src/sim/path.js';
import { DIFFICULTIES } from '../../src/data/types.js';
import { f2pSetup, statsAtLevel } from './f2p.mjs';

const DATA = defaultData();

// ---------------------------------------------------------------------------
// small stats helpers
// ---------------------------------------------------------------------------

export function quantile(values, q) {
  if (!values.length) return null;
  const a = [...values].sort((x, y) => x - y);
  const pos = (a.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
}
const r1 = (v) => (v == null || !Number.isFinite(v) ? v : Math.round(v * 10) / 10);
const r2 = (v) => (v == null || !Number.isFinite(v) ? v : Math.round(v * 100) / 100);

// ---------------------------------------------------------------------------
// Planners
// ---------------------------------------------------------------------------

const posKey = (a) => `${a.x ?? a.tx},${a.y ?? a.ty}`;

/**
 * "Human-like" re-ordering of an autoPlan plan: same girls on the same spots, but only a few
 * of them early, then coins are poured into upgrades (carry to tier 3 + sub-path 2, a second
 * girl, carry tier 4, second girl tier 3, carry tier 5) before the rest of the bot's plan.
 * Opening: the first girl, then the hero if the start cash covers both (otherwise a second girl
 * first, so wave 1 is never defended by one girl while saving for the hero), then the detector
 * and its Veil-Sight upgrades exactly as the bot does.
 * @param {object[]} plan autoPlan output
 * @param {{ core?: number, carry?: string, startCash?: number, placeCost?: (unitId: string) => number }} opts
 *   core = non-hero girls placed before the upgrade burst (default 2); carry = unit id to focus
 *   (default: the girl autoPlan pushes to tier 4 first); startCash/placeCost = for the hero check
 * @returns {object[]} plan
 */
export function humanizePlan(plan, { core = 2, carry: carryId = null, startCash = Infinity, placeCost = () => 0 } = {}) {
  const units = (id) => DATA.units[id];
  const isHero = (a) => units(a.unitId)?.kind === 'hero';
  // What the bot eventually wants on every spot.
  const spots = new Map();
  let upIdx = 0;
  for (const a of plan) {
    const k = posKey(a);
    if (a.action === 'place') spots.set(k, { place: a, want: [0, 0, 0], firstT4: Infinity, order: spots.size });
    else if (a.action === 'upgrade') {
      const s = spots.get(k);
      if (!s) continue;
      s.want[a.path ?? 0]++;
      if (s.want[a.path ?? 0] === 4 && s.firstT4 === Infinity) s.firstT4 = upIdx;
      upIdx++;
    }
  }
  for (const s of spots.values()) {
    const order = [0, 1, 2].sort((p, q) => s.want[q] - s.want[p] || p - q);
    s.main = order[0];
    s.sub = s.want[order[1]] > 0 ? order[1] : null;
  }
  const towers = [...spots.values()].filter((s) => !isHero(s.place));
  const carry = (carryId && towers.find((t) => t.place.unitId === carryId))
    || [...towers].sort((a, b) => a.firstT4 - b.firstT4 || a.order - b.order)[0] || null;

  // Opening prefix of the bot plan: first girl, hero, detector (+ its upgrades).
  let i = 0;
  const first = plan[i]?.action === 'place' ? plan[i++] : null;
  const hero = plan[i]?.action === 'place' && isHero(plan[i]) ? plan[i++] : null;
  const detector = [];
  if (plan[i]?.action === 'upgrade') while (plan[i]?.action === 'upgrade') detector.push(plan[i++]);
  else if (plan[i]?.action === 'place' && plan[i + 1]?.action === 'upgrade' && posKey(plan[i + 1]) === posKey(plan[i])) {
    detector.push(plan[i++]);
    while (plan[i]?.action === 'upgrade') detector.push(plan[i++]);
  }
  const firstSpot = first ? spots.get(posKey(first)) : null;
  const coreTowers = [];
  for (const s of [carry, firstSpot, ...towers]) {
    if (coreTowers.length >= core) break;
    if (s && !isHero(s.place) && !coreTowers.includes(s)) coreTowers.push(s);
  }
  const second = coreTowers.find((s) => s !== carry) || null;

  const out = [];
  const placed = new Set();
  const tiers = new Map();
  const tierOf = (s) => tiers.get(posKey(s.place)) || [0, 0, 0];
  const emitPlace = (s) => {
    const k = posKey(s.place);
    if (placed.has(k)) return;
    placed.add(k);
    out.push({ ...s.place });
  };
  const emitUp = (s, path, upto) => {
    if (path == null) return;
    const k = posKey(s.place);
    const t = tierOf(s).slice();
    const max = units(s.place.unitId)?.paths?.[path]?.tiers?.length || 0;
    while (t[path] < Math.min(upto, max)) {
      // BTD6 crosspath: two paths at most, only one above tier 2.
      const others = t.filter((v, p) => p !== path && v > 0);
      if (others.length >= 2 && t[path] === 0) return;
      if (t[path] >= 2 && t.some((v, p) => p !== path && v > 2)) return;
      t[path]++;
      out.push({ at: 1, action: 'upgrade', unitId: s.place.unitId, x: s.place.x, y: s.place.y, tx: s.place.tx, ty: s.place.ty, path });
    }
    tiers.set(k, t);
  };
  if (firstSpot) emitPlace(firstSpot);
  if (hero) {
    // Hero second only if the start cash covers it; else the cheapest other girl first (a core one
    // when it fits), so wave 1 never faces a single girl while the bot saves for the hero.
    const cash = startCash - (first ? placeCost(first.unitId) : 0);
    if (cash < placeCost(hero.unitId)) {
      const cost = (x) => placeCost(x.place.unitId);
      const others = [...new Set([...coreTowers, ...towers])].filter((x) => x !== firstSpot);
      const pick = others.filter((x) => coreTowers.includes(x) && cost(x) <= cash)[0]
        || others.filter((x) => cost(x) <= cash).sort((a, b) => cost(a) - cost(b))[0]
        || null;
      if (pick) emitPlace(pick);
    }
    emitPlace(spots.get(posKey(hero)));
  }
  for (const a of detector) {
    const s = spots.get(posKey(a));
    if (a.action === 'place') emitPlace(s);
    else emitUp(s, a.path ?? 0, tierOf(s)[a.path ?? 0] + 1);
  }
  if (carry) {
    emitPlace(carry);
    emitUp(carry, carry.main, 3);
    emitUp(carry, carry.sub, 2);
  }
  if (second) {
    emitPlace(second);
    emitUp(second, second.main, 2);
  }
  if (carry) emitUp(carry, carry.main, 4);
  if (second) {
    emitUp(second, second.main, 3);
    emitUp(second, second.sub, 2);
  }
  if (carry) emitUp(carry, carry.main, 5);
  for (const s of coreTowers.slice(2)) {
    emitPlace(s);
    emitUp(s, s.main, 3);
  }
  if (second) emitUp(second, second.main, 4);
  // Then the rest of the bot's plan, skipping what is already done.
  const seen = new Map();
  for (const a of plan) {
    const s = spots.get(posKey(a));
    if (!s) continue;
    if (a.action === 'place') emitPlace(s);
    else if (a.action === 'upgrade') {
      const key = `${posKey(a)}|${a.path ?? 0}`;
      const n = (seen.get(key) || 0) + 1;
      seen.set(key, n);
      if (tierOf(s)[a.path ?? 0] < n) emitUp(s, a.path ?? 0, n);
    }
  }
  return out;
}

const planCache = new Map();

/**
 * Plan for a stage + roster ('bot' = autoPlan as in the balance test, 'human' = humanizePlan).
 * Bot plans do not depend on difficulty or enemy HP, so they are cached per stage; the human
 * opening checks the start cash against that difficulty's placement prices.
 */
export function planFor(stageId, setup, planner = 'bot', { carry = null, difficulty = 'normal' } = {}) {
  const key = `${stageId}|${planner}|${carry}|${planner === 'human' ? difficulty : ''}|${setup.towers.join(',')}|${setup.hero}`;
  if (!planCache.has(key)) {
    const base = planner === 'human' ? planFor(stageId, setup, 'bot') : autoPlan(stageId, [...setup.towers, ...(setup.hero ? [setup.hero] : [])]);
    if (planner !== 'human') planCache.set(key, base);
    else {
      const costMul = DIFFICULTIES[difficulty]?.costMul ?? 1;
      const placeCost = (id) => roundCost(baseCost(DATA.units[id]) * costMul);
      planCache.set(key, humanizePlan(base, { carry, startCash: DATA.stages[stageId].startCash ?? 650, placeCost }));
    }
  }
  return planCache.get(key);
}

// ---------------------------------------------------------------------------
// Instrumentation
// ---------------------------------------------------------------------------

/** Wraps Sim prototype methods for one run. @returns {() => void} restore */
function instrument(rec) {
  const P = Sim.prototype;
  const orig = { spawnEnemy: P.spawnEnemy, _killEnemy: P._killEnemy, _leak: P._leak, _emit: P._emit, _spend: P._spend, update: P.update };
  if (rec.detail) {
    P.spawnEnemy = function spawnEnemy(enemyId, o = {}) {
      const e = orig.spawnEnemy.call(this, enemyId, o);
      if (e) rec.spawn(this, e, o);
      return e;
    };
    P._killEnemy = function _killEnemy(e, tower) {
      if (!e.dead) rec.end(this, e, 'killed');
      return orig._killEnemy.call(this, e, tower);
    };
    P._leak = function _leak(e) {
      if (!e.dead) rec.end(this, e, 'leaked');
      return orig._leak.call(this, e);
    };
    P._emit = function _emit(type, payload) {
      rec.event(this, type, payload);
      return orig._emit.call(this, type, payload);
    };
    P._spend = function _spend(amount) {
      rec.spend(this, amount);
      return orig._spend.call(this, amount);
    };
  }
  if (rec.ult) {
    // Human-like: fire the hero ult as soon as it is ready while a boss is up or a crowd is on the road.
    P.update = function update(dt) {
      if (this.state === 'wave' && this.hero && this.enemies.length) {
        const st = this.heroUltStatus();
        if (st.ready && (this.enemies.length >= 6 || this.enemies.some((e) => e.tier === 'boss' || e.tier === 'miniboss'))) this.activateUlt();
      }
      return orig.update.call(this, dt);
    };
  }
  return () => Object.assign(P, orig);
}

function makeRecorder({ detail, ult }) {
  const enemies = new Map();
  const waves = [];
  const towers = new Map();
  const phases = [];
  const wv = (sim) => {
    const w = sim.state === 'wave' ? sim.wave : sim.wave + 1; // what you buy between waves is for the next one
    waves[w] ||= { wave: w, bounty: 0, bonus: 0, income: 0, spent: 0, cashAtStart: null, start: null, end: null };
    return waves[w];
  };
  const curWave = (sim) => {
    const w = Math.max(1, sim.wave);
    waves[w] ||= { wave: w, bounty: 0, bonus: 0, income: 0, spent: 0, cashAtStart: null, start: null, end: null };
    return waves[w];
  };
  return {
    detail,
    ult,
    enemies,
    waves,
    towers,
    phases,
    spawn(sim, e, o) {
      enemies.set(e.uid, {
        uid: e.uid, id: e.id, tier: e.tier, wave: sim.wave, t0: sim.time, maxHp: e.maxHp,
        pathLen: sim.pathData[e.pathIndex]?.length || 1, child: !!o.parent, t1: null, dist: null, fate: null,
      });
    },
    end(sim, e, fate) {
      const r = enemies.get(e.uid);
      if (!r) return;
      r.t1 = sim.time;
      r.dist = fate === 'leaked' ? r.pathLen : e.dist;
      r.fate = fate;
    },
    spend(sim, amount) {
      wv(sim).spent += amount;
    },
    event(sim, type, p) {
      if (type === 'death') curWave(sim).bounty += p.bounty || 0;
      else if (type === 'cash') {
        if (p.reason === 'waveBonus') curWave(sim).bonus += p.amount || 0;
        else if (p.reason === 'income') curWave(sim).income += p.amount || 0;
      } else if (type === 'waveStart') {
        const w = curWave(sim);
        w.cashAtStart = sim.cash;
        w.start = sim.time;
      } else if (type === 'waveEnd') curWave(sim).end = sim.time;
      else if (type === 'place') {
        towers.set(p.towerUid, { unitId: p.unitId, placedWave: sim.state === 'wave' ? sim.wave : sim.wave + 1, tiers: [0, 0, 0], tierWave: [[], [], []] });
      } else if (type === 'upgrade') {
        const t = towers.get(p.towerUid);
        if (t) {
          t.tiers[p.path] = p.tier;
          t.tierWave[p.path][p.tier - 1] = sim.state === 'wave' ? sim.wave : sim.wave + 1;
        }
      } else if (type === 'bossPhase') phases.push({ uid: p.uid, t: sim.time, announce: p.announce });
    },
  };
}

// ---------------------------------------------------------------------------
// One run
// ---------------------------------------------------------------------------

/** Stage with its enemy HP scaled by `hpMul` (economy unchanged: cashScale is separate). */
function scaledStage(stageId, hpMul) {
  const stage = DATA.stages[stageId];
  if (hpMul === 1) return null;
  return { stage: { ...stage, hpScale: (stage.hpScale ?? 1) * hpMul } };
}

/** Short text for a pending plan action. */
function describeAction(sim, a, diff) {
  if (!a) return null;
  const def = DATA.units[a.unitId];
  if (a.action === 'place') return `place ${a.unitId} (${roundCost(baseCost(def) * (diff.costMul ?? 1))})`;
  if (a.action === 'upgrade') {
    const t = sim.towerAt(a.x ?? a.tx, a.y ?? a.ty);
    const tier = t ? t.tiers[a.path ?? 0] + 1 : '?';
    const td = def?.paths?.[a.path ?? 0]?.tiers?.[(t ? t.tiers[a.path ?? 0] : 0)];
    return `${a.unitId} path ${(a.path ?? 0) + 1} -> T${tier}${td ? ` ${td.name} (${roundCost(td.cost * (diff.costMul ?? 1))})` : ''}`;
  }
  return a.action;
}

/**
 * Runs one battle.
 * @param {{ stageId: string, difficulty?: string, seed?: number, hpMul?: number, planner?: 'bot'|'human',
 *   detail?: boolean, setup?: object, carry?: string }} o  detail=false skips per-enemy/per-wave recording
 *   (headroom search); carry = focus unit of the human-like planner
 */
export function runProbe({ stageId, difficulty = 'normal', seed = 1, hpMul = 1, planner = 'bot', detail = true, setup = null, carry = null } = {}) {
  const su = setup || f2pSetup(DATA, stageId);
  const plan = planFor(stageId, su, planner, { carry, difficulty });
  const rec = makeRecorder({ detail, ult: planner === 'human' });
  const restore = instrument(rec);
  let r;
  try {
    r = runHeadless({
      stageId, difficulty, plan, seed, maxTime: 7200, data: scaledStage(stageId, hpMul) || undefined,
      loadout: su.towers.map((id) => ({ unitId: id, stats: statsAtLevel(id, su.level) })),
      hero: su.hero ? { unitId: su.hero, stats: statsAtLevel(su.hero, su.level) } : null,
    });
  } finally {
    restore();
  }
  const sim = r.sim;
  const diff = DIFFICULTIES[sim.difficulty];
  const startCash = Math.round(sim.stage.startCash ?? 650);
  const out = {
    stageId, difficulty, seed, hpMul, planner, level: su.level, units: [...su.towers, ...(su.hero ? [su.hero] : [])],
    won: r.won, wave: r.wave, totalWaves: sim.totalWaves, lives: r.lives, maxLives: r.maxLives, time: r1(r.time),
    startCash, cashEnd: r.cash, earned: sim.stats.cashEarned, spent: sim.stats.cashSpent,
    unspentPct: r2(r.cash / Math.max(1, startCash + sim.stats.cashEarned)),
    pendingLeft: r.pendingLeft, failed: r.failed.length,
    // runHeadless runs the plan in order, so the first pending action is the one it was saving for
    waitingOn: r.pendingLeft ? describeAction(sim, plan[plan.length - r.pendingLeft], diff) : null,
    leaksByEnemy: sim.stats.leaksByEnemy,
  };
  if (!detail) return out;

  // Economy per wave (realised under this defense).
  const W = sim.totalWaves;
  const econ = [];
  let cum = startCash;
  for (let w = 1; w <= Math.min(W, r.wave); w++) {
    const x = rec.waves[w] || { bounty: 0, bonus: 0, income: 0, spent: 0, cashAtStart: null };
    const earned = x.bounty + x.bonus + x.income;
    const availAtStart = cum;
    cum += earned;
    econ.push({ wave: w, bounty: x.bounty, bonus: x.bonus, income: x.income, earned, availAtStart, cumulative: cum, spent: x.spent, cashAtStart: x.cashAtStart });
  }
  out.economy = econ;
  out.avgIdleCash = r1(quantile(econ.map((e) => e.cashAtStart).filter((v) => v != null), 0.5));

  // What the bot bought.
  out.towers = [...rec.towers.values()].map((t) => ({ unitId: t.unitId, placedWave: t.placedWave, tiers: t.tiers, tierWave: t.tierWave }));
  const firstTier = {};
  for (const t of rec.towers.values()) {
    t.tierWave.forEach((ws) => ws.forEach((w, i) => {
      if (w != null && (firstTier[i + 1] == null || w < firstTier[i + 1])) firstTier[i + 1] = w;
    }));
  }
  out.firstTierWave = firstTier; // {tier: wave first bought}
  out.maxTier = Math.max(0, ...out.towers.map((t) => Math.max(...t.tiers)));

  // Enemies: bosses/minibosses individually, elites and normals aggregated.
  const ended = (e) => (e.t1 != null ? e.t1 : sim.time);
  const life = (e) => ended(e) - e.t0;
  const pathPct = (e) => (e.dist != null ? e.dist / e.pathLen : null);
  const bosses = [];
  for (const e of rec.enemies.values()) {
    if (e.tier !== 'boss' && e.tier !== 'miniboss') continue;
    const def = DATA.enemies[e.id];
    bosses.push({
      id: e.id, tier: e.tier, wave: e.wave, maxHp: Math.round(e.maxHp), alive: r1(life(e)),
      leakCost: Number.isFinite(def?.leak) ? def.leak : 'all',
      pathPct: e.dist != null ? r2(pathPct(e)) : null, fate: e.fate || 'alive at end',
      phases: rec.phases.filter((p) => p.uid === e.uid).map((p) => ({ at: r1(p.t - e.t0), announce: p.announce })),
    });
  }
  out.bosses = bosses;
  const agg = (list) => {
    if (!list.length) return null;
    const lives = list.map(life);
    const paths = list.map(pathPct).filter((v) => v != null);
    return {
      n: list.length, leaked: list.filter((e) => e.fate === 'leaked').length,
      aliveMed: r1(quantile(lives, 0.5)), aliveP90: r1(quantile(lives, 0.9)), aliveMax: r1(Math.max(...lives)),
      pathMed: r2(quantile(paths, 0.5)), pathP90: r2(quantile(paths, 0.9)),
    };
  };
  const all = [...rec.enemies.values()];
  const normals = all.filter((e) => e.tier === 'normal' && !e.child);
  out.normals = agg(normals);
  out.normalsEarly = agg(normals.filter((e) => e.wave <= 3));
  const byId = {};
  for (const e of all.filter((x) => x.tier !== 'boss' && x.tier !== 'miniboss')) (byId[e.id] ||= []).push(e);
  out.byEnemy = Object.fromEntries(Object.entries(byId).map(([id, list]) => [id, { tier: list[0].tier, hp: Math.round(quantile(list.map((e) => e.maxHp), 0.5)), ...agg(list) }]));
  out.elites = agg(all.filter((e) => e.tier === 'elite'));
  // Who did the damage (share of all damage dealt, by unit).
  const dmg = {};
  let total = 0;
  for (const [uid, v] of Object.entries(sim.stats.damageByTower)) {
    const u = sim.stats.towerUnits[uid] || '?';
    dmg[u] = (dmg[u] || 0) + v;
    total += v;
  }
  out.damageShare = Object.fromEntries(Object.entries(dmg).sort((a, b) => b[1] - a[1]).map(([u, v]) => [u, r2(v / Math.max(1, total))]));
  return out;
}

// ---------------------------------------------------------------------------
// Headroom
// ---------------------------------------------------------------------------

/**
 * Largest enemy-HP multiplier at which the planner still wins (log-space bisection).
 * @returns {{ headroom: number|null, bound: '='|'>'|'<', runs: {hpMul, won}[] }}
 */
export function headroom({ stageId, difficulty, seed = 1, planner = 'bot', setup = null, carry = null, lo = 0.5, hi = 4, steps = 5, baseWon = null }) {
  const runs = [];
  const win = (m) => {
    const res = runProbe({ stageId, difficulty, seed, hpMul: m, planner, detail: false, setup, carry });
    runs.push({ hpMul: r2(m), won: res.won, wave: res.wave });
    return res.won;
  };
  const won1 = baseWon ?? win(1);
  let a;
  let b;
  if (won1) {
    if (win(hi)) return { headroom: hi, bound: '>', runs };
    a = 1;
    b = hi;
  } else {
    if (!win(lo)) return { headroom: lo, bound: '<', runs };
    a = lo;
    b = 1;
  }
  for (let i = 0; i < steps; i++) {
    const m = Math.sqrt(a * b);
    if (win(m)) a = m;
    else b = m;
  }
  return { headroom: r2(a), bound: '=', runs };
}

// ---------------------------------------------------------------------------
// Economy: when can a focused player afford a unit's tiers?
// ---------------------------------------------------------------------------

/** Cumulative coins to place `unitId` and buy tiers 1..k on `path` (difficulty + profile cost mods). */
export function tierCosts(unitId, path, difficulty, costMul = 1) {
  const def = DATA.units[unitId];
  const dm = DIFFICULTIES[difficulty]?.costMul ?? 1;
  const place = roundCost(baseCost(def) * dm * costMul);
  const out = [{ tier: 0, cost: place, cum: place }];
  let cum = place;
  (def.paths?.[path]?.tiers || []).forEach((t, i) => {
    const c = roundCost((t.cost || 0) * dm * costMul);
    cum += c;
    out.push({ tier: i + 1, name: t.name, cost: c, cum });
  });
  return out;
}

/**
 * For each tier: the first wave whose START a player could afford it if every coin so far went
 * into this one girl (start cash + all coins earned in earlier waves of the given economy).
 * @returns {{ path, name, tiers: {tier, name, cost, cum, wave: number|null, pctOfStage: number}[] }[]}
 */
export function affordTimeline(unitId, economy, difficulty, startCash) {
  const def = DATA.units[unitId];
  const total = economy.length ? economy[economy.length - 1].cumulative : startCash;
  return (def.paths || []).map((p, pi) => ({
    path: pi,
    name: p.name,
    tiers: tierCosts(unitId, pi, difficulty).map((t) => {
      let wave = null;
      if (t.cum <= startCash) wave = 1;
      else {
        const e = economy.find((x) => x.cumulative >= t.cum);
        if (e && e.wave < economy.length) wave = e.wave + 1;
      }
      return { ...t, wave, pctOfStage: r2(t.cum / Math.max(1, total)) };
    }),
  }));
}

/**
 * Stage totals straight from the wave generator (no battle): per wave the coins a player earns
 * if every enemy dies (kill bounties incl. split/brood children, wave-clear bonus; summons and
 * tower income excluded), enemy count and total enemy HP, and the scripted bosses.
 * @returns {{ waves: {wave, bounty, bonus, coins, cumulative, enemies, hp}[], startCash, totalCoins, totalHp, bosses: object[] }}
 */
export function stageEconomy(stageId, difficulty = 'normal') {
  const stage = DATA.stages[stageId];
  const map = DATA.maps[stage.mapId];
  const paths = buildPaths(map);
  const diff = DIFFICULTIES[difficulty];
  const cashMul = (diff.cashMul ?? 1) * (Number.isFinite(stage.cashScale) && stage.cashScale > 0 ? stage.cashScale : 1);
  const hpBase = (stage.hpScale ?? 1) * (diff.hpMul ?? 1);
  const enemy = (id) => DATA.enemies[id] || null;
  const value = (id, hpMul, depth = 0) => {
    const def = enemy(id);
    if (!def || depth > 4) return { coins: 0, hp: 0, n: 0 };
    const v = { coins: (def.bounty || 0) * cashMul, hp: (def.hp || 1) * hpMul, n: 1 };
    for (const k of ['brood', 'splitter']) {
      const b = def.traits?.[k];
      if (!b?.spawn) continue;
      const c = value(b.spawn, hpMul, depth + 1);
      const cnt = b.count ?? 2;
      v.coins += c.coins * cnt;
      v.hp += c.hp * cnt;
      v.n += c.n * cnt;
    }
    return v;
  };
  const W = Number.isFinite(stage.waves) ? stage.waves : 30;
  const startCash = Math.round(stage.startCash ?? 650);
  let cum = startCash;
  let totalHp = 0;
  const waves = [];
  const bosses = [];
  for (let w = 1; w <= W; w++) {
    const wd = generateWave(stage, w, enemy, { pathCount: paths.length, pathLengths: paths.map((p) => p.length) });
    let bounty = 0;
    let hp = 0;
    let n = 0;
    for (const s of wd.spawns) {
      const v = value(s.enemyId, hpBase * wd.hpMul);
      bounty += v.coins;
      hp += v.hp;
      n += v.n;
      const def = enemy(s.enemyId);
      if (def && (def.tier === 'boss' || def.tier === 'miniboss')) bosses.push({ id: def.id, tier: def.tier, wave: w, hp: Math.round(def.hp * hpBase * wd.hpMul), speed: def.speed, pathLen: r1(paths[s.pathIndex]?.length) });
    }
    const bonus = (80 + 6 * w) * cashMul;
    cum += bounty + bonus;
    totalHp += hp;
    waves.push({ wave: w, bounty: Math.round(bounty), bonus: Math.round(bonus), coins: Math.round(bounty + bonus), cumulative: Math.round(cum), enemies: n, hp: Math.round(hp) });
  }
  return {
    stageId, difficulty, startCash, waves, totalCoins: Math.round(cum), totalHp: Math.round(totalHp), bosses,
    hpScale: stage.hpScale, cashScale: stage.cashScale ?? 1, mapId: map.id, pathLengths: paths.map((p) => r1(p.length)),
  };
}

export { DATA, f2pSetup, DIFFICULTIES };
