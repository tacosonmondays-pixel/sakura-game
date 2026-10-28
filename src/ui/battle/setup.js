// Builds the Sim configuration from the player's profile (formation + unitBattleStats).
import { Sim } from '../../sim/Sim.js';
import { UNIT_MAP } from '../../data/units.js';
import { STAGE_MAP, nextInAct } from '../../data/stages.js';
import { DIFFICULTIES, BATTLE } from '../../data/types.js';
import { unitBattleStats } from '../../systems/progression.js';
import { isOwned, isPracticeRun, canPlayEndless, modesUnlocked } from '../../systems/unlocks.js';
import { modeId } from '../../data/modes.js';
import { restoreSim } from './snapshot.js';
import { freeplayTier } from '../../data/freeplay.js';
import { hasSoloFreeplay, soloFreeplayStage } from '../../data/freeplaySolo.js';
import { isSandboxUnlocked, sandboxFormation, sandboxUnitStats, parseTeam, SANDBOX_COINS, SANDBOX_UNLOCK_CLEARS } from '../../systems/sandbox.js';
import { TITAN_MAP, tierIndex, titanBattle, MAX_RANK } from '../../data/titans.js';
import { tierOpen, refreshKeys } from '../../systems/titans.js';
import { eventBattleStage } from '../../data/events/wire.js';
import { eventDifficultyStatus } from '../../systems/events.js';

/**
 * A Titan Trials battle (`titan=<id>&tier=<tier>[&rank=n][&practice=1]`, docs/specs/ASCENSION.md §C):
 * its stage and enemy overrides come from src/data/titans.js titanBattle and reach the Sim through
 * its data hook. A tier that is not open, no Trial Key left, or `practice=1` plays as practice (no
 * key, no rewards). Never saved, never freeplay, never a battle mode.
 */
export function parseTitanParams(params = {}, profile = null) {
  const titanId = String(params.titan || '');
  const tier = tierIndex(params.tier) >= 0 ? params.tier : 'normal';
  const rank = tier === 'mayhem' ? Math.max(0, Math.min(MAX_RANK, Math.floor(Number(params.rank) || 0))) : 0;
  const base = { difficulty: 'normal', mode: 'standard', endless: false, freeplay: null, keepGoing: false, sandbox: false, resume: null };
  if (!TITAN_MAP[titanId]) return { ...base, stageId: null, practice: false, error: 'Unknown titan.' };
  const battle = titanBattle(titanId, tier, rank);
  const wantsPractice = String(params.practice ?? '') === '1';
  const practice = wantsPractice || (profile ? !tierOpen(profile, titanId, tier, rank) || refreshKeys(profile) < 1 : false);
  return { ...base, stageId: battle.stage.id, stageDef: battle.stage, titan: { id: titanId, tier, rank, battle }, practice, error: null };
}

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
 * to `resume` a `freeplay` / `endless=1` param never turns freeplay on; its battle mode is the
 * record's too (the controller takes it from the restored Sim, whatever `mode` the link carries).
 * The coached first battle (`tutorial=1`, STORY_SPEC §2.3) is a plain run: no freeplay and no
 * "Keep going" on its victory sheet (a brand-new player's first win ends there).
 * `sandbox=1` (with `team=a.b.c` and `hero=x`) is a Sandbox run on the stage's map: any girl, endless
 * waves, nothing saved (never a battle save, never freeplay, `resume` ignored). With a profile it
 * needs Sandbox unlocked (systems/sandbox.js).
 * `mode` (a battle mode, docs/specs/CODEX_MODES.md) is honoured only on a campaign stage whose modes
 * are unlocked (cleared once), never in endless, freeplay, practice, tutorial or Sandbox runs;
 * Nightmare × Last Petal is the same battle as Nightmare Standard. Anything else plays Standard. A
 * mode run is never offered "Keep going" (freeplay runs in Standard in v1).
 * @returns {{ stageId: string|null, difficulty: string, mode: string, endless: boolean, freeplay: string|null,
 *   keepGoing: boolean, practice: boolean, practiceNote?: string, sandbox: boolean, team?: string[], hero?: string|null,
 *   error: string|null, resume: string|null }}
 *   practiceNote: the HUD line when the run is practice because an event difficulty is still locked
 *   keepGoing: a normal run that may continue into freeplay from its victory sheet ("Keep going")
 */
export function parseBattleParams(params = {}, profile = null) {
  const stageId = params.stage || params.id || null;
  const stage = stageId ? STAGE_MAP[stageId] : null;
  if (!stage) return { stageId, difficulty: 'normal', mode: 'standard', endless: false, freeplay: null, keepGoing: false, practice: false, sandbox: false, error: `Unknown stage "${stageId ?? ''}".`, resume: null };
  let difficulty = DIFFICULTIES[params.difficulty] ? params.difficulty : 'normal';
  // [events] an event stage plays only its own difficulties (stage prep offers no others; a link
  // with another one plays the stage's first, and applyBattleResult would pay nothing for it anyway)
  if (stage.kind === 'event' && Array.isArray(stage.difficulties) && stage.difficulties.length && !stage.difficulties.includes(difficulty)) difficulty = stage.difficulties[0];
  if (params.sandbox === '1' || params.sandbox === 1 || params.sandbox === 'true') {
    if (profile && !isSandboxUnlocked(profile)) return { stageId, difficulty, mode: 'standard', endless: true, freeplay: null, keepGoing: false, practice: false, sandbox: true, error: `Sandbox unlocks after ${SANDBOX_UNLOCK_CLEARS} stage clears.`, resume: null };
    const { towers, hero } = sandboxFormation(parseTeam(params.team), params.hero || null);
    return { stageId, difficulty, mode: 'standard', endless: true, freeplay: null, keepGoing: false, practice: false, sandbox: true, team: towers, hero, error: null, resume: null };
  }
  const wantsEndless = params.endless === '1' || params.endless === 1 || params.endless === 'true';
  const allowed = !profile || canPlayEndless(profile, stageId);
  // Locked stages are gated by the stage-prep screen; a direct link still plays as practice
  // (marked in the HUD, and applyBattleResult saves nothing for it) so deep links keep working.
  // [events] so does a difficulty still locked on an event stage (Nightmare before its medal gate); the HUD
  // then says why (`practiceNote`: the stage itself is open)
  const stageLocked = !!profile && isPracticeRun(profile, stageId);
  const evGate = profile && !stageLocked ? eventDifficultyStatus(profile, stageId, difficulty) : null;
  const practice = stageLocked || (!!evGate && !evGate.ok);
  const practiceNote = evGate && !evGate.ok ? eventPracticeNote(evGate, difficulty) : null;
  const resume = typeof params.resume === 'string' && params.resume ? params.resume : null;
  const tutorial = String(params.tutorial ?? '') === '1';
  const fpStage = hasSoloFreeplay(stageId) && !practice && !tutorial;
  let freeplay = fpStage && allowed && !resume ? freeplayTier(params.freeplay) : null;
  if (fpStage && allowed && !resume && wantsEndless && !freeplay) freeplay = 'blossom';
  const endless = stage.kind === 'challenge' || (wantsEndless && allowed && !hasSoloFreeplay(stageId));
  let mode = modeId(params.mode);
  if (stage.kind !== 'campaign' || endless || freeplay || practice || tutorial || (profile && !modesUnlocked(profile, stageId))) mode = 'standard';
  if (mode === 'laststand' && difficulty === 'nightmare') mode = 'standard';
  return { stageId, difficulty, mode, endless, freeplay, keepGoing: fpStage && !freeplay && !endless && mode === 'standard', practice, ...(practiceNote ? { practiceNote } : {}), sandbox: false, error: null, resume };
}

/** The HUD line of a practice run on an open event stage whose difficulty is still locked (eventDifficultyStatus). */
function eventPracticeNote(gate, difficulty) {
  const name = DIFFICULTIES[difficulty]?.name || difficulty;
  const why = gate.reason === 'medal' && gate.needs ? `${name} opens after a ${DIFFICULTIES[gate.needs]?.name || gate.needs} clear` : `${name} isn't offered on this event stage`;
  return `Practice run: ${why}, so nothing from this battle is saved.`;
}

/**
 * Settings → Battle → Auto-cast abilities (Off by default) as the Sim's option: only when on, so a battle with the
 * setting off builds exactly the Sim it always did (the battle save's restore reads the same setting: snapshot.js).
 */
export const autoAbilities = (profile) => (profile?.settings?.autoCastAbilities ? { autoAbilities: true } : {});

/**
 * Creates the Sim for a battle. `cfg` is what a battle save freezes at New game: the run seed
 * and the team's battle stats as they are now (Continue never reads the live profile again).
 * [friend support] `support` (BANNERS §E.1): a friend's girl, already clamped to this save's range — `entry` her
 * loadout entry, `mark` the record's `{ unitId, owner, key, card }`. She joins as an extra card beside the 8
 * (supportSlotMode: 'extra'), never in Titan Trials or Sandbox, never a girl the formation already brings.
 * @param {object} profile
 * @param {{ stageId: string, difficulty: string, mode?: string, endless?: boolean, freeplay?: string|null, seed?: number }} req
 * @param {{ support?: { entry: { unitId: string, stats: object }, mark: object }|null }} [opts]
 */
export function createBattleSim(profile, req, { support = null } = {}) {
  const seed = (req.seed ?? (Date.now() ^ Math.floor(performance.now() * 1000))) >>> 0;
  if (req.sandbox) return createSandboxSim(req, seed, profile);
  const { towers: own, hero } = resolveFormation(profile);
  const loadout = own.map((unitId) => ({ unitId, stats: unitBattleStats(profile, unitId) }));
  const sup = support && !req.titan ? withSupport(own, loadout, support) : null;
  const towers = sup ? sup.towers : own;
  if (sup) loadout.splice(0, loadout.length, ...sup.loadout);
  const heroEntry = hero ? { unitId: hero, stats: unitBattleStats(profile, hero) } : null;
  if (req.titan) {
    // Titan Trials: the titan's stage and enemy overrides through the Sim's data hook (no hashed file)
    const { stage, enemies } = req.titan.battle;
    const sim = new Sim({ stageId: stage.id, difficulty: 'normal', loadout, hero: heroEntry, seed, options: { autoStart: !!profile.settings?.autoStart, ...autoAbilities(profile) }, data: { stage, enemies } });
    return { sim, towers, hero, seed, cfg: null };
  }
  // solo freeplay: the campaign stage with the tier's table (src/data/freeplaySolo.js); [events] a
  // difficulty with its own waves (the Golem's Nightmare): that stage (src/data/events/wire.js)
  const fpStage = req.freeplay ? soloFreeplayStage(req.stageId, req.freeplay) : null;
  const evStage = fpStage ? null : eventBattleStage(req.stageId, req.difficulty);
  const sim = new Sim({
    stageId: req.stageId,
    difficulty: req.difficulty,
    loadout,
    hero: heroEntry,
    seed,
    options: { endless: !!req.endless, autoStart: !!profile.settings?.autoStart, mode: fpStage ? 'standard' : modeId(req.mode), ...(fpStage ? { freeplay: true } : {}), ...autoAbilities(profile) },
    ...(fpStage || evStage ? { data: { stage: fpStage || evStage } } : {}),
  });
  return { sim, towers, hero, seed, cfg: { seed, loadout, hero: heroEntry, ...(sup ? { support: support.mark } : {}) } };
}

/**
 * Where a borrowed girl goes: 'extra' (a 9th card; the tower bar holds hero + 8 + her at 844×390, checked at build:
 * docs/specs/BANNERS.md §E.1) or 'replace' (she takes the last of the 8).
 */
export const SUPPORT_SLOT_MODE = 'extra';

/** The formation with a borrowed girl added (null when she is already in it). */
export function withSupport(towers, loadout, support, mode = SUPPORT_SLOT_MODE) {
  const id = support?.entry?.unitId;
  if (!id || towers.includes(id)) return null;
  if (mode === 'replace' && towers.length >= BATTLE.maxTowers) {
    return { towers: [...towers.slice(0, BATTLE.maxTowers - 1), id], loadout: [...loadout.slice(0, BATTLE.maxTowers - 1), support.entry] };
  }
  return { towers: [...towers, id], loadout: [...loadout, support.entry] };
}

/**
 * Rebuilds the Sim of a saved battle (Continue) with the team frozen in its record.
 * `heroRefunds`: a hero from a save made before the hero rework (her level, and her placement and
 * upgrades as coins; already inside `refunded`).
 * `potentialNew`: a save from before Potential v3 with a girl at P2+ (her steps are the new ones now).
 * @returns {{ sim: Sim, towers: string[], hero: string|null, refunded: number, dropped: string[],
 *   heroRefunds: { unitId: string, level: number, refunded: number }[], potentialNew: boolean }}
 * @throws {import('./snapshot.js').StaleSaveError} the save cannot be restored by this build
 */
export function resumeBattleSim(profile, rec) {
  const { sim, refunded, dropped, heroes: heroRefunds = [], potentialNew = false } = restoreSim(rec, profile);
  const towers = [...new Set((rec.loadout || []).map((e) => e.unitId).filter((id) => UNIT_MAP[id]))];
  const hero = rec.hero?.unitId && UNIT_MAP[rec.hero.unitId] ? rec.hero.unitId : null;
  return { sim, towers, hero, refunded, dropped, heroRefunds, potentialNew };
}

/**
 * Sandbox: the chosen girls at their best (owned or not), endless waves that only start when asked,
 * and a 999,999-coin purse.
 */
function createSandboxSim(req, seed, profile = null) {
  const { towers, hero } = sandboxFormation(req.team, req.hero);
  const sim = new Sim({
    stageId: req.stageId,
    difficulty: req.difficulty,
    loadout: towers.map((unitId) => ({ unitId, stats: sandboxUnitStats(unitId) })),
    hero: hero ? { unitId: hero, stats: sandboxUnitStats(hero) } : null,
    seed,
    options: { endless: true, autoStart: false, ...autoAbilities(profile) },
  });
  sim.cash = SANDBOX_COINS;
  // (cfg is what a battle save would freeze; a sandbox run is never saved, isSavableRun)
  return { sim, towers, hero, seed, cfg: null };
}

/**
 * The campaign stage after `stageId` in the same act, for the results screen's Next button (stages.js nextInAct):
 * Act I 1-5 → 2-1 and 8-5 → null (never 1-6); Act II x-10 → (c+1)-6 when it exists. Null for non-campaign stages.
 */
export function followingStage(stageId) {
  return nextInAct(stageId);
}

/** Route that "Back to map" leads to for a stage kind (shared with the back arrow: src/ui/nav.js). */
export { mapRouteFor } from '../nav.js';
