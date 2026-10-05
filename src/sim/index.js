// Public API of the battle simulation.

export { Sim, roundCost } from './Sim.js';
export { runHeadless, autoPlan } from './headless.js';
export { generateWave, summarizeWave, waveHpRamp } from './waves.js';
export {
  computeHit, computeDot, applyHitResult, isEligible, effectiveArmor, shredAmount, damageTakenBonus,
} from './combat.js';
export { applyStatus, statusElement, isImmobile, slowAmount } from './status.js';
export { resolveStats, normalizeBase, applyModSet, collectModSets, mergeStatusList, crosspathBlock } from './mods.js';
export { buildPath, buildPaths, pointAt, pathTileSet, samplePath } from './path.js';
export { enemyTraitKeys, createEnemy, leakAmount } from './enemies.js';
export { projectileKind, targetScore } from './towers.js';
export { xpToReach, levelForXp, ultCooldown } from './hero.js';
export { buildWaveWarnings, buildDebrief, fieldCapabilities } from './report.js';
export { defaultData, hasRealData, createDataSource } from './data.js';
export { STEP, DEFAULT_UNIT_STATS } from './constants.js';
