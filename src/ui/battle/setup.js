// Builds the Sim configuration from the player's profile (formation + unitBattleStats).
import { Sim } from '../../sim/Sim.js';
import { UNIT_MAP } from '../../data/units.js';
import { STAGE_MAP, CAMPAIGN_IDS } from '../../data/stages.js';
import { DIFFICULTIES, BATTLE } from '../../data/types.js';
import { unitBattleStats } from '../../systems/progression.js';
import { isOwned, isPracticeRun, canPlayEndless } from '../../systems/unlocks.js';

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
 * @returns {{ stageId: string|null, difficulty: string, endless: boolean, practice: boolean, error: string|null }}
 */
export function parseBattleParams(params = {}, profile = null) {
  const stageId = params.stage || params.id || null;
  const stage = stageId ? STAGE_MAP[stageId] : null;
  if (!stage) return { stageId, difficulty: 'normal', endless: false, practice: false, error: `Unknown stage "${stageId ?? ''}".` };
  const difficulty = DIFFICULTIES[params.difficulty] ? params.difficulty : 'normal';
  const wantsEndless = params.endless === '1' || params.endless === 1 || params.endless === 'true';
  const endless = stage.kind === 'challenge' || (wantsEndless && (!profile || canPlayEndless(profile, stageId)));
  // Locked stages are gated by the stage-prep screen; a direct link still plays as practice
  // (marked in the HUD, and applyBattleResult saves nothing for it) so deep links keep working.
  const practice = !!profile && isPracticeRun(profile, stageId);
  return { stageId, difficulty, endless, practice, error: null };
}

/**
 * Creates the Sim for a battle.
 * @param {object} profile
 * @param {{ stageId: string, difficulty: string, endless?: boolean, seed?: number }} req
 */
export function createBattleSim(profile, req) {
  const { towers, hero } = resolveFormation(profile);
  const seed = req.seed ?? ((Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0);
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

/** The campaign stage after `stageId` (null for the last stage / non-campaign stages). */
export function followingStage(stageId) {
  const i = CAMPAIGN_IDS.indexOf(stageId);
  return i >= 0 && i < CAMPAIGN_IDS.length - 1 ? CAMPAIGN_IDS[i + 1] : null;
}

/** Route that "Back to map" leads to for a stage kind. */
export function mapRouteFor(stage) {
  switch (stage?.kind) {
    case 'resource': return { name: 'bounty', params: {} };
    case 'boss': return { name: 'assault', params: {} };
    case 'challenge': return { name: 'challenge', params: {} };
    default: return { name: 'campaign', params: stage?.chapter != null ? { chapter: String(stage.chapter) } : {} };
  }
}
