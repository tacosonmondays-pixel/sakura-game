// Builds the Sim configuration from the player's profile (formation + unitBattleStats).
import { Sim } from '../../sim/Sim.js';
import { UNIT_MAP } from '../../data/units.js';
import { STAGE_MAP, CAMPAIGN_IDS } from '../../data/stages.js';
import { DIFFICULTIES, BATTLE } from '../../data/types.js';
import { unitBattleStats } from '../../systems/progression.js';
import { isOwned, isPracticeRun, canPlayEndless, modesUnlocked } from '../../systems/unlocks.js';
import { modeId } from '../../data/modes.js';
import { freeplayTier } from '../../data/freeplay.js';
import { hasSoloFreeplay, soloFreeplayStage } from '../../data/freeplaySolo.js';

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
 * Parses route params into a validated battle request. With a profile, `endless=1` / `freeplay=<tier>`
 * are only honoured where stage prep offers them (systems `canPlayEndless`: a cleared map, an
 * unlocked colosseum); without one the params are taken as they are.
 * Solo freeplay (`freeplay=blossom|tempest|crimson`) runs on campaign stages: the stage plays as
 * usual up to its last wave, then the run goes on (16/15 …). The old endless runs on campaign maps
 * (`endless=1`, Tactical Challenge) are freeplay now: they open as freeplay on the given tier, or
 * Blossom. The colosseum (kind 'challenge') stays endless.
 * `mode` (a battle mode, docs/specs/CODEX_MODES.md) is honoured only on a campaign stage whose modes
 * are unlocked (cleared once), never in endless, freeplay or practice runs; Nightmare × Last Petal is
 * the same battle as Nightmare Standard. Anything else plays Standard. A mode run is never offered
 * "Keep going" (freeplay runs in Standard in v1).
 * @returns {{ stageId: string|null, difficulty: string, mode: string, endless: boolean, freeplay: string|null,
 *   keepGoing: boolean, practice: boolean, error: string|null }}
 *   keepGoing: a normal run that may continue into freeplay from its victory sheet ("Keep going")
 */
export function parseBattleParams(params = {}, profile = null) {
  const stageId = params.stage || params.id || null;
  const stage = stageId ? STAGE_MAP[stageId] : null;
  if (!stage) return { stageId, difficulty: 'normal', mode: 'standard', endless: false, freeplay: null, keepGoing: false, practice: false, error: `Unknown stage "${stageId ?? ''}".` };
  const difficulty = DIFFICULTIES[params.difficulty] ? params.difficulty : 'normal';
  const wantsEndless = params.endless === '1' || params.endless === 1 || params.endless === 'true';
  const allowed = !profile || canPlayEndless(profile, stageId);
  // Locked stages are gated by the stage-prep screen; a direct link still plays as practice
  // (marked in the HUD, and applyBattleResult saves nothing for it) so deep links keep working.
  const practice = !!profile && isPracticeRun(profile, stageId);
  const fpStage = hasSoloFreeplay(stageId) && !practice;
  let freeplay = fpStage && allowed ? freeplayTier(params.freeplay) : null;
  if (fpStage && allowed && wantsEndless && !freeplay) freeplay = 'blossom';
  const endless = stage.kind === 'challenge' || (wantsEndless && allowed && !hasSoloFreeplay(stageId));
  let mode = modeId(params.mode);
  if (stage.kind !== 'campaign' || endless || freeplay || practice || (profile && !modesUnlocked(profile, stageId))) mode = 'standard';
  if (mode === 'laststand' && difficulty === 'nightmare') mode = 'standard';
  return { stageId, difficulty, mode, endless, freeplay, keepGoing: fpStage && !freeplay && !endless && mode === 'standard', practice, error: null };
}

/**
 * Creates the Sim for a battle.
 * @param {object} profile
 * @param {{ stageId: string, difficulty: string, mode?: string, endless?: boolean, freeplay?: string|null, seed?: number }} req
 */
export function createBattleSim(profile, req) {
  const { towers, hero } = resolveFormation(profile);
  const seed = req.seed ?? ((Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0);
  // solo freeplay: the campaign stage with the tier's table (src/data/freeplaySolo.js)
  const fpStage = req.freeplay ? soloFreeplayStage(req.stageId, req.freeplay) : null;
  const sim = new Sim({
    stageId: req.stageId,
    difficulty: req.difficulty,
    loadout: towers.map((unitId) => ({ unitId, stats: unitBattleStats(profile, unitId) })),
    hero: hero ? { unitId: hero, stats: unitBattleStats(profile, hero) } : null,
    seed,
    options: { endless: !!req.endless, autoStart: !!profile.settings?.autoStart, mode: fpStage ? 'standard' : modeId(req.mode), ...(fpStage ? { freeplay: true } : {}) },
    ...(fpStage ? { data: { stage: fpStage } } : {}),
  });
  return { sim, towers, hero, seed };
}

/** The campaign stage after `stageId` (null for the last stage / non-campaign stages). */
export function followingStage(stageId) {
  const i = CAMPAIGN_IDS.indexOf(stageId);
  return i >= 0 && i < CAMPAIGN_IDS.length - 1 ? CAMPAIGN_IDS[i + 1] : null;
}

/** Route that "Back to map" leads to for a stage kind (shared with the back arrow: src/ui/nav.js). */
export { mapRouteFor } from '../nav.js';
