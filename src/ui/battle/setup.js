// Builds the Sim configuration from the player's profile (formation + unitBattleStats).
import { Sim } from '../../sim/Sim.js';
import { UNIT_MAP } from '../../data/units.js';
import { STAGE_MAP, CAMPAIGN_IDS } from '../../data/stages.js';
import { DIFFICULTIES, BATTLE } from '../../data/types.js';
import { unitBattleStats } from '../../systems/progression.js';
import { isOwned, isPracticeRun, canPlayEndless } from '../../systems/unlocks.js';
import { restoreSim } from './snapshot.js';
import { freeplayTier } from '../../data/freeplay.js';
import { hasSoloFreeplay, soloFreeplayStage } from '../../data/freeplaySolo.js';
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
 * Parses route params into a validated battle request. With a profile, `endless=1` / `freeplay=<tier>`
 * are only honoured where stage prep offers them (systems `canPlayEndless`: a cleared map, an
 * unlocked colosseum); without one the params are taken as they are.
 * Solo freeplay (`freeplay=blossom|tempest|crimson`) runs on campaign stages: the stage plays as
 * usual up to its last wave, then the run goes on (16/15 …). The old endless runs on campaign maps
 * (`endless=1`, Tactical Challenge) are freeplay now: they open as freeplay on the given tier, or
 * Blossom. The colosseum (kind 'challenge') stays endless.
 * `resume` is a battle save's run id (Continue; src/systems/battleSave.js), or null. A Continue
 * plays the saved run as it was saved, and freeplay runs are never saved (isSavableRun), so next
 * to `resume` a `freeplay` / `endless=1` param never turns freeplay on.
 * The coached first battle (`tutorial=1`, STORY_SPEC §2.3) is a plain run: no freeplay and no
 * "Keep going" on its victory sheet (a brand-new player's first win ends there).
 * `sandbox=1` (with `team=a.b.c` and `hero=x`) is a Sandbox run on the stage's map: any girl, endless
 * waves, nothing saved (never a battle save, never freeplay, `resume` ignored). With a profile it
 * needs Sandbox unlocked (systems/sandbox.js).
 * @returns {{ stageId: string|null, difficulty: string, endless: boolean, freeplay: string|null,
 *   keepGoing: boolean, practice: boolean, sandbox: boolean, team?: string[], hero?: string|null,
 *   error: string|null, resume: string|null }}
 *   keepGoing: a normal run that may continue into freeplay from its victory sheet ("Keep going")
 */
export function parseBattleParams(params = {}, profile = null) {
  const stageId = params.stage || params.id || null;
  const stage = stageId ? STAGE_MAP[stageId] : null;
  if (!stage) return { stageId, difficulty: 'normal', endless: false, freeplay: null, keepGoing: false, practice: false, sandbox: false, error: `Unknown stage "${stageId ?? ''}".`, resume: null };
  const difficulty = DIFFICULTIES[params.difficulty] ? params.difficulty : 'normal';
  if (params.sandbox === '1' || params.sandbox === 1 || params.sandbox === 'true') {
    if (profile && !isSandboxUnlocked(profile)) return { stageId, difficulty, endless: true, freeplay: null, keepGoing: false, practice: false, sandbox: true, error: `Sandbox unlocks after ${SANDBOX_UNLOCK_CLEARS} stage clears.`, resume: null };
    const { towers, hero } = sandboxFormation(parseTeam(params.team), params.hero || null);
    return { stageId, difficulty, endless: true, freeplay: null, keepGoing: false, practice: false, sandbox: true, team: towers, hero, error: null, resume: null };
  }
  const wantsEndless = params.endless === '1' || params.endless === 1 || params.endless === 'true';
  const allowed = !profile || canPlayEndless(profile, stageId);
  // Locked stages are gated by the stage-prep screen; a direct link still plays as practice
  // (marked in the HUD, and applyBattleResult saves nothing for it) so deep links keep working.
  const practice = !!profile && isPracticeRun(profile, stageId);
  const resume = typeof params.resume === 'string' && params.resume ? params.resume : null;
  const tutorial = String(params.tutorial ?? '') === '1';
  const fpStage = hasSoloFreeplay(stageId) && !practice && !tutorial;
  let freeplay = fpStage && allowed && !resume ? freeplayTier(params.freeplay) : null;
  if (fpStage && allowed && !resume && wantsEndless && !freeplay) freeplay = 'blossom';
  const endless = stage.kind === 'challenge' || (wantsEndless && allowed && !hasSoloFreeplay(stageId));
  return { stageId, difficulty, endless, freeplay, keepGoing: fpStage && !freeplay && !endless, practice, sandbox: false, error: null, resume };
}

/**
 * Creates the Sim for a battle. `cfg` is what a battle save freezes at New game: the run seed
 * and the team's battle stats as they are now (Continue never reads the live profile again).
 * @param {object} profile
 * @param {{ stageId: string, difficulty: string, endless?: boolean, freeplay?: string|null, seed?: number }} req
 */
export function createBattleSim(profile, req) {
  const seed = (req.seed ?? (Date.now() ^ Math.floor(performance.now() * 1000))) >>> 0;
  if (req.sandbox) return createSandboxSim(req, seed);
  const { towers, hero } = resolveFormation(profile);
  const loadout = towers.map((unitId) => ({ unitId, stats: unitBattleStats(profile, unitId) }));
  const heroEntry = hero ? { unitId: hero, stats: unitBattleStats(profile, hero) } : null;
  // solo freeplay: the campaign stage with the tier's table (src/data/freeplaySolo.js)
  const fpStage = req.freeplay ? soloFreeplayStage(req.stageId, req.freeplay) : null;
  const sim = new Sim({
    stageId: req.stageId,
    difficulty: req.difficulty,
    loadout,
    hero: heroEntry,
    seed,
    options: { endless: !!req.endless, autoStart: !!profile.settings?.autoStart, ...(fpStage ? { freeplay: true } : {}) },
    ...(fpStage ? { data: { stage: fpStage } } : {}),
  });
  return { sim, towers, hero, seed, cfg: { seed, loadout, hero: heroEntry } };
}

/**
 * Rebuilds the Sim of a saved battle (Continue) with the team frozen in its record.
 * `heroRefunds`: a hero from a save made before the hero rework (her level, and her placement and
 * upgrades as coins; already inside `refunded`).
 * @returns {{ sim: Sim, towers: string[], hero: string|null, refunded: number, dropped: string[],
 *   heroRefunds: { unitId: string, level: number, refunded: number }[] }}
 * @throws {import('./snapshot.js').StaleSaveError} the save cannot be restored by this build
 */
export function resumeBattleSim(profile, rec) {
  const { sim, refunded, dropped, heroes: heroRefunds = [] } = restoreSim(rec, profile);
  const towers = [...new Set((rec.loadout || []).map((e) => e.unitId).filter((id) => UNIT_MAP[id]))];
  const hero = rec.hero?.unitId && UNIT_MAP[rec.hero.unitId] ? rec.hero.unitId : null;
  return { sim, towers, hero, refunded, dropped, heroRefunds };
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
  // (cfg is what a battle save would freeze; a sandbox run is never saved, isSavableRun)
  return { sim, towers, hero, seed, cfg: null };
}

/** The campaign stage after `stageId` (null for the last stage / non-campaign stages). */
export function followingStage(stageId) {
  const i = CAMPAIGN_IDS.indexOf(stageId);
  return i >= 0 && i < CAMPAIGN_IDS.length - 1 ? CAMPAIGN_IDS[i + 1] : null;
}

/** Route that "Back to map" leads to for a stage kind (shared with the back arrow: src/ui/nav.js). */
export { mapRouteFor } from '../nav.js';
