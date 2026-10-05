// Headless battles for tests and balance checks: runHeadless executes a scripted plan of
// placements/upgrades; autoPlan builds such a plan greedily (tiles covering the most path
// length within range, then upgrades along each unit's strongest path).

import { Sim } from './Sim.js';
import { createDataSource } from './data.js';
import { buildPaths, pathTileSet, samplePath } from './path.js';
import { resolveStats, crosspathBlock } from './mods.js';
import { DEFAULT_UNIT_STATS } from './constants.js';

/**
 * @typedef {{ at?: number, action: 'place'|'upgrade', unitId?: string, tx?: number, ty?: number,
 *   uid?: number, path?: number }} PlanAction
 */

function executeAction(sim, a) {
  if (a.action === 'place') {
    const chk = sim.canPlace(a.unitId, a.tx, a.ty);
    if (chk.ok) return sim.placeTower(a.unitId, a.tx, a.ty) ? 'done' : 'fail';
    return chk.reason === 'cash' ? 'wait' : 'fail';
  }
  if (a.action === 'upgrade') {
    const t = a.uid != null ? sim.getTower(a.uid) : sim.towerAt(a.tx, a.ty);
    if (!t) return 'fail';
    const st = sim.upgradeStatus(t.uid, a.path ?? 0);
    if (!st.locked) return sim.upgradeTower(t.uid, a.path ?? 0) ? 'done' : 'fail';
    return st.reason === 'cash' ? 'wait' : 'fail';
  }
  if (a.action === 'sell') {
    const t = a.uid != null ? sim.getTower(a.uid) : sim.towerAt(a.tx, a.ty);
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

/**
 * Greedy plan: best-covered tiles first, then upgrades on each unit's strongest path
 * (BTD6 crosspath respected). Used to sanity-check that stages are beatable.
 * @param {string} stageId
 * @param {string[]} unitIds towers and optionally one hero
 * @param {{ data?: object, maxCopies?: number, focus?: boolean }} opts  focus = push the best
 *   carry to tier 4 right after the tier-2 round (default) instead of spreading upgrades evenly.
 * @returns {PlanAction[]}
 */
export function autoPlan(stageId, unitIds, { data = undefined, maxCopies = 3, focus = true } = {}) {
  const ds = createDataSource(stageId ?? data?.stage?.id, data || {});
  const { stage, map } = ds;
  const tilesOnPath = pathTileSet(map);
  const samples = buildPaths(map).flatMap((p) => samplePath(p, 0.25));
  const needs = stageNeeds(stage, ds.enemy);

  const cells = [];
  for (let ty = 0; ty < map.height; ty++) {
    const row = map.rows?.[ty] || '';
    for (let tx = 0; tx < map.width; tx++) {
      if (tilesOnPath.has(`${tx},${ty}`)) continue;
      const ch = row[tx];
      const water = ch === '~';
      const land = ch === '.' || ch === ',';
      if (water || land) cells.push({ tx, ty, water, land });
    }
  }
  const covCache = new Map();
  const coverage = (c, range) => {
    const key = `${c.tx},${c.ty},${range.toFixed(2)}`;
    let v = covCache.get(key);
    if (v === undefined) {
      const x = c.tx + 0.5;
      const y = c.ty + 0.5;
      const r2 = range * range;
      v = 0;
      for (const s of samples) if ((s.x - x) ** 2 + (s.y - y) ** 2 <= r2) v += 0.25;
      covCache.set(key, v);
    }
    return v;
  };

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

  const used = new Set();
  const placed = [];
  const plan = [];
  const placement = (def) => def.placement || 'land';
  const fits = (def, c) => (placement(def) === 'water' ? c.water : placement(def) === 'land' ? c.land : true);

  const bestTile = (info) => {
    let best = null;
    let bestS = -Infinity;
    for (const c of cells) {
      if (used.has(`${c.tx},${c.ty}`) || !fits(info.def, c)) continue;
      let s;
      if (info.role === 'econ') s = -coverage(c, 2.5);
      else if (info.role === 'support') {
        const r = info.stats.aura?.range || 2;
        s = placed.filter((p) => p.role === 'dps' && Math.hypot(p.tx - c.tx, p.ty - c.ty) <= r).length * 100 + coverage(c, info.stats.range);
      } else s = coverage(c, info.stats.range);
      if (s > bestS) {
        bestS = s;
        best = c;
      }
    }
    return best;
  };

  const place = (info) => {
    const c = bestTile(info);
    if (!c) return null;
    used.add(`${c.tx},${c.ty}`);
    plan.push({ at: 1, action: 'place', unitId: info.def.id, tx: c.tx, ty: c.ty });
    const rec = { info, def: info.def, role: info.role, tx: c.tx, ty: c.ty, tiers: [0, 0, 0], main: info.main, sub: info.sub };
    placed.push(rec);
    return rec;
  };
  const upgrade = (rec, path, uptoTier) => {
    const tiers = rec.def.paths?.[path]?.tiers || [];
    while (rec.tiers[path] < Math.min(uptoTier, tiers.length)) {
      if (crosspathBlock(rec.tiers, path, tiers.length)) return;
      rec.tiers[path]++;
      plan.push({ at: 1, action: 'upgrade', unitId: rec.def.id, tx: rec.tx, ty: rec.ty, path });
    }
  };
  const copies = (info) => placed.filter((p) => p.info === info).length;

  if (dps.length) place(dps[0]);
  if (heroDef) {
    const hInfo = { def: heroDef, stats: resolveStats(heroDef, { heroLevel: 1 }), role: 'dps' };
    const c = bestTile(hInfo);
    if (c) {
      used.add(`${c.tx},${c.ty}`);
      plan.push({ at: 1, action: 'place', unitId: heroDef.id, tx: c.tx, ty: c.ty });
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
