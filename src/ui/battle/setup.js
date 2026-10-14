// Builds the Sim configuration from the player's profile (formation + unitBattleStats).
import { Sim } from '../../sim/Sim.js';
import { UNIT_MAP } from '../../data/units.js';
import { STAGE_MAP, CAMPAIGN_IDS } from '../../data/stages.js';
import { DIFFICULTIES, BATTLE } from '../../data/types.js';
import { unitBattleStats } from '../../systems/progression.js';
import { isOwned, isPracticeRun, canPlayEndless } from '../../systems/unlocks.js';
import { isSandboxUnlocked, sandboxFormation, sandboxUnitStats, parseTeam, SANDBOX_COINS, SANDBOX_UNLOCK_CLEARS } from '../../systems/sandbox.js';

/**
 * Resolves the battle loadout from the profile formation. Falls back to every owned tower
 * (up to 8) when the formation is empty so a battle is always playable.
 * @returns {{ towers: string[], hero: string|null }}
 */
export function resolveFormation(profile) {
  const f = profile.formation || {};
  const owned = (id) => UNIT_MAP[id] && isOwned(profile, id);
  let towers = (f.towers || []).filter((id) => owned(id) && UNIT_MAP[id].kind === 'tower');
  towers = [...new Set(towers)].slice(0, BATTLE.maxTowers);
  if (!towers.length) {
    towers = Object.keys(profile.units || {}).filter((id) => owned(id) && UNIT_MAP[id].kind === 'tower').slice(0, BATTLE.maxTowers);
  }
  let hero = f.hero && owned(f.hero) && UNIT_MAP[f.hero].kind === 'hero' ? f.hero : null;
  if (!hero && f.hero === undefined) hero = Object.keys(profile.units || {}).find((id) => owned(id) && UNIT_MAP[id].kind === 'hero') || null;
  return { towers, hero };
}

/**
 * Parses route params into a validated battle request. With a profile, `endless=1` is only
 * honoured where the Tactical Challenge screen offers it (systems `canPlayEndless`); without
 * one the params are taken as they are.
 * `sandbox=1` (with `team=a.b.c` and `hero=x`) is a Sandbox run on the stage's map: any girl, endless
 * waves, nothing saved. With a profile it needs Sandbox unlocked (systems/sandbox.js).
 * @returns {{ stageId: string|null, difficulty: string, endless: boolean, practice: boolean, sandbox: boolean, team?: string[], hero?: string|null, error: string|null }}
 */
export function parseBattleParams(params = {}, profile = null) {
  const stageId = params.stage || params.id || null;
  const stage = stageId ? STAGE_MAP[stageId] : null;
  if (!stage) return { stageId, difficulty: 'normal', endless: false, practice: false, sandbox: false, error: `Unknown stage "${stageId ?? ''}".` };
  const difficulty = DIFFICULTIES[params.difficulty] ? params.difficulty : 'normal';
  if (params.sandbox === '1' || params.sandbox === 1 || params.sandbox === 'true') {
    if (profile && !isSandboxUnlocked(profile)) return { stageId, difficulty, endless: true, practice: false, sandbox: true, error: `Sandbox unlocks after ${SANDBOX_UNLOCK_CLEARS} stage clears.` };
    const { towers, hero } = sandboxFormation(parseTeam(params.team), params.hero || null);
    return { stageId, difficulty, endless: true, practice: false, sandbox: true, team: towers, hero, error: null };
  }
  const wantsEndless = params.endless === '1' || params.endless === 1 || params.endless === 'true';
  const endless = stage.kind === 'challenge' || (wantsEndless && (!profile || canPlayEndless(profile, stageId)));
  // Locked stages are gated by the stage-prep screen; a direct link still plays as practice
  // (marked in the HUD, and applyBattleResult saves nothing for it) so deep links keep working.
  const practice = !!profile && isPracticeRun(profile, stageId);
  return { stageId, difficulty, endless, practice, sandbox: false, error: null };
}

/**
 * Creates the Sim for a battle.
 * @param {object} profile
 * @param {{ stageId: string, difficulty: string, endless?: boolean, seed?: number }} req
 */
export function createBattleSim(profile, req) {
  const seed = req.seed ?? ((Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0);
  if (req.sandbox) return createSandboxSim(req, seed);
  const { towers, hero } = resolveFormation(profile);
  const sim = new Sim({
    stageId: req.stageId,
    difficulty: req.difficulty,
    loadout: towers.map((unitId) => ({ unitId, stats: unitBattleStats(profile, unitId) })),
    hero: hero ? { unitId: hero, stats: unitBattleStats(profile, hero) } : null,
    seed,
    options: { endless: !!req.endless, autoStart: !!profile.settings?.autoStart },
  });
  return { sim, towers, hero, seed };
}

/**
 * Sandbox: the chosen girls at their best (owned or not), endless waves that only start when asked,
 * and a 999,999-coin purse.
 */
function createSandboxSim(req, seed) {
  const { towers, hero } = sandboxFormation(req.team, req.hero);
  const sim = new Sim({
    stageId: req.stageId,
    difficulty: req.difficulty,
    loadout: towers.map((unitId) => ({ unitId, stats: sandboxUnitStats(unitId) })),
    hero: hero ? { unitId: hero, stats: sandboxUnitStats(hero) } : null,
    seed,
    options: { endless: true, autoStart: false },
  });
  sim.cash = SANDBOX_COINS;
  return { sim, towers, hero, seed };
}

/** The campaign stage after `stageId` (null for the last stage / non-campaign stages). */
export function followingStage(stageId) {
  const i = CAMPAIGN_IDS.indexOf(stageId);
  return i >= 0 && i < CAMPAIGN_IDS.length - 1 ? CAMPAIGN_IDS[i + 1] : null;
}

/** Route that "Back to map" leads to for a stage kind (shared with the back arrow: src/ui/nav.js). */
export { mapRouteFor } from '../nav.js';
