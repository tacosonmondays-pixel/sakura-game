// In-sim crowd / single-target bench (docs/specs/HERO_REWORK.md §5.3): heroes and towers measured
// the same way. Stage 4-5's map; a stationary column of `count` ground enemies along 2 tiles of road
// (1e9 HP, no armor); the unit on the nearest valid spot to that column; `seconds` of sim; damage
// dealt ÷ seconds. Default stats, no gear. Towers at their best main / cross split (tier m on one
// path, 2 on another). Engine-free: pass the tree's Sim, data source and xpToReach.

/** A plain ground enemy: normal tier, no traits, no armor, not airborne. */
function plainEnemy(enemies) {
  return Object.values(enemies).find((e) => e.tier === 'normal' && !(e.armor > 0) && !Object.keys(e.traits || {}).some((k) => e.traits[k]) && !e.phases?.length);
}

/**
 * @param {{ Sim: Function, xpToReach: Function, enemies: object }} deps (enemies: ENEMY_MAP)
 * @param {{ unitId: string, heroLevel?: number, tiers?: number[], count?: number, seconds?: number, stageId?: string }} o
 * @returns {number} DPS
 */
export function benchDps({ Sim, xpToReach, enemies }, { unitId, heroLevel = 0, tiers = [0, 0, 0], count = 10, seconds = 20, stageId = '4-5' }) {
  const isHero = heroLevel > 0;
  const sim = new Sim({ stageId, loadout: isHero ? [] : [{ unitId }], hero: isHero ? { unitId } : null, seed: 1, options: { autoStart: false } });
  const enemy = plainEnemy(enemies);
  const enemyId = enemy?.id;
  sim.cash = 1e9;
  const path = sim.pathData[0];
  const mid = Math.min(path.length * 0.5, 12);
  // the column: `count` enemies along 2 tiles of road around `mid`
  const pts = [];
  for (let i = 0; i < count; i++) pts.push(mid - 1 + (count > 1 ? (2 * i) / (count - 1) : 1));
  // the spot nearest to the column's middle
  const probe = sim.spawnEnemy(enemyId, { dist: mid, hpMul: 1 });
  const cx = probe.x;
  const cy = probe.y;
  probe.dead = true;
  sim._removeDead();
  let best = null;
  for (let y = 0.25; y < sim.map.height; y += 0.25) {
    for (let x = 0.25; x < sim.map.width; x += 0.25) {
      if (!sim.canPlace(unitId, x, y).ok) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (!best || d < best.d) best = { x, y, d };
    }
  }
  if (!best) return 0;
  const t = sim.placeTower(unitId, best.x, best.y);
  if (isHero) {
    const need = xpToReach(t.def.hero, heroLevel) - t.xp;
    if (need > 0) sim._credit(t, need / 0.4 + 1e-6);
    // the bench runs one level exactly: a damage-XP gain during the run must not level her further
    t.level = heroLevel;
    sim._refreshTower(t);
  } else {
    for (let p = 0; p < 3; p++) for (let k = 0; k < (tiers[p] || 0); k++) sim.upgradeTower(t.uid, p);
  }
  sim.state = 'wave';
  sim.wave = 1;
  sim._spawnQueue = [];
  sim._spawnIndex = 0;
  for (const d of pts) {
    const e = sim.spawnEnemy(enemyId, { dist: d, hpMul: 1e9 / (enemy.hp || 1) });
    e.baseSpeed = 0;
  }
  const steps = Math.round(seconds * 60);
  const lvl = t.level;
  const dealt0 = t.damageDealt;
  for (let i = 0; i < steps; i++) {
    sim.update(1 / 60);
    if (isHero && t.level !== lvl) {
      t.level = lvl;
      sim._refreshTower(t);
    }
  }
  return (t.damageDealt - dealt0) / seconds;
}

/** Best DPS of a tower at main tier `main` with a tier-`cross` second path (any pair of paths). */
export function towerBest(deps, unitId, main, cross, o = {}) {
  let best = 0;
  for (let p = 0; p < 3; p++) {
    for (let q = 0; q < 3; q++) {
      if (q === p && cross > 0) continue;
      const tiers = [0, 0, 0];
      tiers[p] = main;
      if (cross > 0) tiers[q] = cross;
      best = Math.max(best, benchDps(deps, { unitId, tiers, ...o }));
      if (cross === 0) break;
    }
  }
  return best;
}

export const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};
