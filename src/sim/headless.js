// Headless battles for tests and balance checks: runHeadless executes a scripted plan of
// placements/upgrades; autoPlan builds such a plan greedily (continuous spots covering the
// most path length within range, then upgrades along each unit's strongest path).

import { Sim } from './Sim.js';
import { createDataSource } from './data.js';
import { buildPaths, samplePath } from './path.js';
import { createPlacementRules, footprintRadius, PATH_HALF_WIDTH } from './placement.js';
import { resolveStats, crosspathBlock } from './mods.js';
import { DEFAULT_UNIT_STATS } from './constants.js';

/**
 * A plan action. Positions are continuous world coordinates `x`/`y` (free placement);
 * `tx`/`ty` (tile) are still accepted for old plans and resolve to the tile centre.
 * @typedef {{ at?: number, action: 'place'|'upgrade'|'sell', unitId?: string, x?: number, y?: number,
 *   tx?: number, ty?: number, uid?: number, path?: number }} PlanAction
 */

/** Position of a plan action as (x, y) arguments for the Sim (continuous wins over tile). */
function spot(a) {
  return a.x != null && a.y != null ? [a.x, a.y] : [a.tx, a.ty];
}

function executeAction(sim, a) {
  const [x, y] = spot(a);
  if (a.action === 'place') {
    const chk = sim.canPlace(a.unitId, x, y);
    if (chk.ok) return sim.placeTower(a.unitId, x, y) ? 'done' : 'fail';
    return chk.reason === 'cash' ? 'wait' : 'fail';
  }
  if (a.action === 'upgrade') {
    const t = a.uid != null ? sim.getTower(a.uid) : sim.towerAt(x, y);
    if (!t) return 'fail';
    const st = sim.upgradeStatus(t.uid, a.path ?? 0);
    if (!st.locked) return sim.upgradeTower(t.uid, a.path ?? 0) ? 'done' : 'fail';
    return st.reason === 'cash' ? 'wait' : 'fail';
  }
  if (a.action === 'sell') {
    const t = a.uid != null ? sim.getTower(a.uid) : sim.towerAt(x, y);
    if (!t) return 'fail';
    sim.sellTower(t.uid);
    return 'done';
  }
  return 'fail';
}

/**
 * Runs a whole battle without rendering. Plan actions execute in order once their wave is
 * reached (`at` = the wave they should be in place for) and as soon as they are affordable;
 * waves start automatically.
 * @param {{ stageId: string, difficulty?: string, plan?: PlanAction[], seed?: number, maxTime?: number,
 *   loadout?: {unitId, stats?}[], hero?: {unitId, stats?}|null, data?: object, options?: object }} cfg
 * @returns {{ won: boolean, lost: boolean, wave: number, wavesCleared: number, lives: number,
 *   maxLives: number, time: number, cash: number, failed: PlanAction[], pendingLeft: number,
 *   result: object, sim: Sim }}
 */
export function runHeadless({
  stageId, difficulty = 'normal', plan = [], seed = 1, maxTime = 3600, loadout = null, hero = undefined,
  data = undefined, options = {},
} = {}) {
  const ds = createDataSource(stageId ?? data?.stage?.id, data || {});
  let lo = loadout;
  let heroCfg = hero;
  if (!lo || heroCfg === undefined) {
    const ids = [...new Set(plan.filter((a) => a.action === 'place' && a.unitId).map((a) => a.unitId))];
    const defs = ids.map((id) => ds.unit(id)).filter(Boolean);
    if (!lo) lo = defs.filter((d) => d.kind !== 'hero').map((d) => ({ unitId: d.id, stats: { ...DEFAULT_UNIT_STATS } }));
    if (heroCfg === undefined) {
      const h = defs.find((d) => d.kind === 'hero');
      heroCfg = h ? { unitId: h.id, stats: { ...DEFAULT_UNIT_STATS } } : null;
    }
  }
  const sim = new Sim({ stageId: ds.stage.id, difficulty, loadout: lo, hero: heroCfg, seed, options: { autoStart: false, ...options }, data: { ...(data || {}), stage: ds.stage, map: ds.map } });
  const pending = plan.slice();
  const failed = [];
  const tryActions = () => {
    while (pending.length) {
      const a = pending[0];
      if ((a.at ?? 1) > sim.wave + 1) break;
      const r = executeAction(sim, a);
      if (r === 'wait') break;
      pending.shift();
      if (r === 'fail') failed.push(a);
    }
  };
  while (sim.time < maxTime && sim.state !== 'won' && sim.state !== 'lost') {
    tryActions();
    if (sim.state === 'prep' || sim.state === 'between') {
      if (!sim.startNextWave()) break;
    }
    sim.update(0.25);
    sim.drainEvents();
  }
  return {
    won: sim.state === 'won',
    lost: sim.state === 'lost',
    wave: sim.wave,
    wavesCleared: sim.wavesCleared,
    lives: sim.lives,
    maxLives: sim.maxLives,
    time: sim.time,
    cash: sim.cash,
    failed,
    pendingLeft: pending.length,
    result: sim.result(),
    sim,
  };
}

// ---------------------------------------------------------------------------
// autoPlan
// ---------------------------------------------------------------------------

function stageNeeds(stage, lookupEnemy) {
  const ids = new Set();
  for (const p of stage.waveGen?.pool || []) ids.add(p.enemy);
  for (const f of stage.waveGen?.fixed || []) ids.add(f.enemy);
  const needs = { veiled: false, airborne: false, veiledWave: Infinity };
  const visit = (id, depth, fromWave) => {
    const def = lookupEnemy(id);
    if (!def || depth > 3) return;
    const traitSets = [def.traits || {}, ...(def.phases || []).map((ph) => ph.set?.traits || {})];
    for (const t of traitSets) {
      if (t.veiled) {
        needs.veiled = true;
        needs.veiledWave = Math.min(needs.veiledWave, fromWave);
      }
      if (t.airborne) needs.airborne = true;
      for (const k of ['brood', 'splitter', 'summoner', 'decoy']) if (t[k]?.spawn) visit(t[k].spawn, depth + 1, fromWave);
    }
  };
  for (const p of stage.waveGen?.pool || []) visit(p.enemy, 0, p.from ?? 1);
  for (const f of stage.waveGen?.fixed || []) visit(f.enemy, 0, f.wave ?? 1);
  return needs;
}

function pathScore(def, p, needs, tiersToCount = 5) {
  const base = def.base || {};
  const baseDmg = Math.max(1, base.damage || 1);
  let s = 0;
  const tiers = def.paths?.[p]?.tiers || [];
  for (let i = 0; i < Math.min(tiersToCount, tiers.length); i++) {
    const m = tiers[i].mods || {};
    if (m.damageMul) s += (m.damageMul - 1) * 10;
    if (m.damage) s += (m.damage / baseDmg) * 6;
    if (m.rateMul) s += (m.rateMul - 1) * 10;
    s += (m.pierce || 0) * 0.8 + (m.projectiles || 0) * 2.5 + (m.splash || 0) * 3 + (m.chain || 0) * 1.5;
    s += (m.armorPen || 0) * 0.6 + (m.range || 0) * 0.8 + (m.maxTargets || 0) * 0.1;
    if (m.detection && needs.veiled) s += 6;
    if (m.canHitAir && needs.airborne) s += 6;
    if (m.crit?.chance) s += m.crit.chance * 8;
    if (m.aura) s += 2;
    if (m.income) s += (m.income.perWave || 0) / 40 + (m.income.interest || 0) * 20;
    if (m.trap) s += (m.trap.max || 0) * 0.5 + ((m.trap.damage || 0) / Math.max(1, base.trap?.damage || baseDmg)) * 4;
    if (m.turret) s += (m.turret.max || 0) * 1.5 + (m.turret.damage || 0) * 0.3;
    if (m.status) s += 1;
    if (m.eliteMul) s += (m.eliteMul - 1) * 3;
    if (m.bossMul) s += (m.bossMul - 1) * 2;
    if (m.ramp) s += (m.ramp.max || 0) * 4;
  }
  return s;
}

/** Lowest (path, tier) granting detection, or null. tier 0 = innate. */
function detectionRoute(def) {
  if (def.base?.detection || def.base?.aura?.detection) return { path: -1, tier: 0 };
  let best = null;
  (def.paths || []).forEach((p, pi) => {
    (p.tiers || []).forEach((t, ti) => {
      const m = t.mods || {};
      if ((m.detection || m.aura?.detection) && (!best || ti + 1 < best.tier)) best = { path: pi, tier: ti + 1 };
    });
  });
  return best;
}

function unitRole(stats) {
  if (stats.income && (stats.behavior === 'none' || stats.damage <= 0)) return 'econ';
  if (stats.behavior === 'none') return stats.aura ? 'support' : 'econ';
  return 'dps';
}

/** Candidate lattice step (tiles) and the deterministic jitter so spots never align with tile centres. */
const LATTICE_STEP = 0.25;
const LATTICE_JITTER = 0.04;

/** Small deterministic hash → [-1, 1] (no Math.random in sim code). */
function jitter(i, j, salt) {
  let h = (i * 73856093) ^ (j * 19349663) ^ (salt * 83492791);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  h ^= h >>> 15;
  return ((h >>> 0) % 2001) / 1000 - 1;
}

/**
 * Greedy plan on a continuous candidate lattice (0.25-tile grid + jitter): best path
 * coverage first, footprints never overlap, then upgrades on each unit's strongest path
 * (BTD6 crosspath respected). Used to sanity-check that stages are beatable.
 * @param {string} stageId
 * @param {string[]} unitIds towers and optionally one hero
 * @param {{ data?: object, maxCopies?: number, focus?: boolean }} opts  focus = push the best
 *   carry to tier 4 right after the tier-2 round (default) instead of spreading upgrades evenly.
 * @returns {PlanAction[]} place actions carry continuous `x`/`y` plus the tile `tx`/`ty` under them
 */
export function autoPlan(stageId, unitIds, { data = undefined, maxCopies = 3, focus = true } = {}) {
  const ds = createDataSource(stageId ?? data?.stage?.id, data || {});
  const { stage, map } = ds;
  const paths = buildPaths(map);
  const rules = createPlacementRules(map, paths);
  // tunnel sections are invisible to towers: they add no coverage
  const samples = paths.flatMap((p) => samplePath(p, 0.25)).filter((s) => !s.hidden);
  const needs = stageNeeds(stage, ds.enemy);

  // Candidate spots: lattice points on buildable terrain with their clearance from the path
  // band and obstacles (checked against each unit's radius when choosing).
  const cands = [];
  const nx = Math.ceil(map.width / LATTICE_STEP);
  const ny = Math.ceil(map.height / LATTICE_STEP);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x = (i + 0.5) * LATTICE_STEP + jitter(i, j, 1) * LATTICE_JITTER;
      const y = (j + 0.5) * LATTICE_STEP + jitter(i, j, 2) * LATTICE_JITTER;
      if (!rules.inBounds(x, y)) continue;
      const ch = rules.terrainAt(x, y);
      const water = ch === '~' || ch === 'B';
      const land = ch === '.' || ch === ',';
      if (!water && !land) continue;
      const pathClear = rules.pathDistance(x, y) - PATH_HALF_WIDTH;
      const obstacleClear = rules.obstacleDistance(x, y);
      if (Math.min(pathClear, obstacleClear) < 0.42 - 1e-9) continue; // useless for any girl
      cands.push({ x, y, water, land, clear: Math.min(pathClear, obstacleClear), tx: Math.floor(x), ty: Math.floor(y) });
    }
  }
  const covCache = new Map();
  const coverage = (c, range) => {
    const key = range.toFixed(2);
    let arr = covCache.get(key);
    if (!arr) {
      arr = new Float32Array(cands.length);
      const r2 = range * range;
      for (let k = 0; k < cands.length; k++) {
        const x = cands[k].x;
        const y = cands[k].y;
        let v = 0;
        for (const s of samples) if ((s.x - x) ** 2 + (s.y - y) ** 2 <= r2) v += 0.25;
        arr[k] = v;
      }
      covCache.set(key, arr);
    }
    return arr[c.index];
  };
  cands.forEach((c, k) => {
    c.index = k;
  });

  const defs = [...new Set(unitIds)].map((id) => ds.unit(id)).filter(Boolean);
  const heroDef = defs.find((d) => d.kind === 'hero') || null;
  const infos = defs.filter((d) => d.kind !== 'hero').map((def) => {
    const stats = resolveStats(def);
    const scores = [0, 1, 2].map((p) => pathScore(def, p, needs));
    const main = scores.indexOf(Math.max(...scores));
    const subScores = [0, 1, 2].map((p) => (p === main ? -Infinity : pathScore(def, p, needs, 2)));
    const sub = subScores.indexOf(Math.max(...subScores));
    return { def, stats, role: unitRole(stats), main, sub, detect: detectionRoute(def), cost: stats.cost };
  });
  const dps = infos.filter((i) => i.role === 'dps').sort((a, b) => a.cost - b.cost);
  const support = infos.filter((i) => i.role === 'support');
  const econ = infos.filter((i) => i.role === 'econ');

  const placed = [];
  const plan = [];
  const placement = (def) => def.placement || 'land';
  const fits = (def, c) => (placement(def) === 'water' ? c.water : placement(def) === 'land' ? c.land : true);
  const free = (c, r) => {
    if (c.clear < r - 1e-9) return false;
    for (const p of placed) {
      const rr = r + p.radius;
      if ((p.x - c.x) ** 2 + (p.y - c.y) ** 2 < rr * rr) return false;
    }
    return true;
  };

  const bestSpot = (info) => {
    const r = footprintRadius(info.def);
    let best = null;
    let bestS = -Infinity;
    for (const c of cands) {
      if (!fits(info.def, c) || !free(c, r)) continue;
      let s;
      if (info.role === 'econ') s = -coverage(c, 2.5);
      else if (info.role === 'support') {
        const ar = info.stats.aura?.range || 2;
        s = placed.filter((p) => p.role === 'dps' && Math.hypot(p.x - c.x, p.y - c.y) <= ar).length * 100 + coverage(c, info.stats.range);
      } else s = coverage(c, info.stats.range);
      if (s > bestS) {
        bestS = s;
        best = c;
      }
    }
    return best;
  };

  const place = (info) => {
    const c = bestSpot(info);
    if (!c) return null;
    plan.push({ at: 1, action: 'place', unitId: info.def.id, x: c.x, y: c.y, tx: c.tx, ty: c.ty });
    const rec = {
      info, def: info.def, role: info.role, x: c.x, y: c.y, tx: c.tx, ty: c.ty, radius: footprintRadius(info.def),
      tiers: [0, 0, 0], main: info.main, sub: info.sub,
    };
    placed.push(rec);
    return rec;
  };
  const upgrade = (rec, path, uptoTier) => {
    const tiers = rec.def.paths?.[path]?.tiers || [];
    while (rec.tiers[path] < Math.min(uptoTier, tiers.length)) {
      if (crosspathBlock(rec.tiers, path, tiers.length)) return;
      rec.tiers[path]++;
      plan.push({ at: 1, action: 'upgrade', unitId: rec.def.id, x: rec.x, y: rec.y, tx: rec.tx, ty: rec.ty, path });
    }
  };
  const copies = (info) => placed.filter((p) => p.info === info).length;

  if (dps.length) place(dps[0]);
  if (heroDef) {
    const hInfo = { def: heroDef, stats: resolveStats(heroDef, { heroLevel: 1 }), role: 'dps' };
    const c = bestSpot(hInfo);
    if (c) {
      plan.push({ at: 1, action: 'place', unitId: heroDef.id, x: c.x, y: c.y, tx: c.tx, ty: c.ty });
      placed.push({ info: hInfo, def: heroDef, role: 'hero', x: c.x, y: c.y, tx: c.tx, ty: c.ty, radius: footprintRadius(heroDef), tiers: [0, 0, 0], main: 0, sub: 1 });
    }
  }
  if (needs.veiled) {
    const detector = infos.filter((i) => i.detect).sort((a, b) => a.detect.tier - b.detect.tier || a.cost - b.cost)[0];
    if (detector) {
      const rec = placed.find((p) => p.info === detector) || place(detector);
      if (rec && detector.detect.path >= 0) {
        if (detector.detect.tier > 2) rec.main = detector.detect.path;
        upgrade(rec, detector.detect.path, detector.detect.tier);
      }
    }
  }
  for (const info of [...dps, ...support, ...econ]) if (!copies(info)) place(info);

  const dpsRecs = () => placed.filter((p) => p.role === 'dps');
  for (const rec of dpsRecs()) upgrade(rec, rec.main, 2);
  // Focus: like a real player, push one carry deep (tier 4) early instead of spreading every
  // coin over tier-2 girls — boss and miniboss stages are unwinnable without a real damage dealer.
  const carryScore = (rec) => pathScore(rec.def, rec.main, needs) * (1 + 0.3 * (rec.def.base?.bossMul || 1)) * (rec.def.base?.canHitAir === false && needs.airborne ? 0.3 : 1);
  const carry = focus ? dpsRecs().sort((a, b) => carryScore(b) - carryScore(a))[0] : null;
  if (carry) upgrade(carry, carry.main, 4);
  for (const info of dps.slice(0, 2)) if (copies(info) < maxCopies) place(info);
  for (const rec of placed) {
    upgrade(rec, rec.main, 2);
    if (rec.role !== 'econ') upgrade(rec, rec.sub, 2);
  }
  for (const rec of dpsRecs()) upgrade(rec, rec.main, 3);
  for (const info of dps.slice(0, 2)) {
    if (copies(info) < maxCopies) {
      const rec = place(info);
      if (rec) upgrade(rec, rec.main, 3);
    }
  }
  if (carry) upgrade(carry, carry.main, 5);
  for (const rec of dpsRecs()) upgrade(rec, rec.main, 4);
  for (const rec of dpsRecs().slice(0, 2)) upgrade(rec, rec.main, 5);
  for (const rec of dpsRecs()) upgrade(rec, rec.main, 5);
  return plan;
}
