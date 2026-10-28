// Ownership, stage unlocks, medals and counter recommendations (owner: systems).
// See CONTRACTS.md §5.

import { UNIT_MAP, UNITS, hasCapability } from '../data/units.js';
import { STAGE_MAP, CAMPAIGN_IDS, requirementsMet, actStages } from '../data/stages.js';
import { DIFFICULTY_ORDER } from '../data/types.js';
import { RIBBON_MODES, MODE_ORDER } from '../data/modes.js';
import { newUnitState } from './save.js';
import { shadowPotential } from './potential.js';
import { receiveDuplicate } from './essence.js';
import { mirrorUnit } from './ascensionSave.js';
import { writeRosterMark } from './rosterSave.js';

/** @returns {string[]} owned unit ids in roster order */
export function ownedUnits(profile) {
  return UNITS.filter((u) => profile.units?.[u.id]).map((u) => u.id);
}

/** @returns {boolean} */
export function isOwned(profile, unitId) {
  return !!profile.units?.[unitId];
}

/**
 * Give a unit. A duplicate adds 1 to her `dupes` (the Essence history) and gives her 1 Essence, or,
 * past her hold cap (6 − P), converts as a spare into Mementos, Moonpearls and recruit points
 * (src/systems/essence.js, docs/specs/ASCENSION.md §A). Duplicates no longer pay Star Fragments or
 * Tomes, and Potential is never raised here (Raise Potential is a button). Every grant rewrites her
 * shadow copy.
 * @returns {{ isNew: boolean, essence: 0|1, spare: null|{ mementos: number, moonpearls: number, points: number, fifths: number },
 *   potential: number, essenceHeld: number, readyStep: number|null, potentialUp: false }}
 */
export function grantUnit(profile, unitId, now = Date.now()) {
  const def = UNIT_MAP[unitId];
  if (!def) throw new Error(`Unknown unit: ${unitId}`);
  if (!profile.units[unitId]) {
    profile.units[unitId] = newUnitState(now);
    // bond (affection) starts at 0; the future City dating / gift system raises it
    profile.bond ||= {};
    profile.bond[unitId] ??= 0;
    shadowPotential(profile, unitId, now);
    mirrorUnit(profile, unitId);
    writeRosterMark(profile, unitId); // her 'own:' mark: an older build that drops her gives her back
    return { isNew: true, essence: 0, spare: null, potential: 1, essenceHeld: 0, readyStep: null, potentialUp: false };
  }
  const st = profile.units[unitId];
  st.dupes = Math.max(0, Math.floor(Number(st.dupes) || 0)) + 1;
  shadowPotential(profile, unitId, now);
  return { isNew: false, ...receiveDuplicate(profile, unitId), potentialUp: false };
}

/** @returns {{ easy: boolean, normal: boolean, hard: boolean, nightmare: boolean }} */
export function stageMedals(profile, stageId) {
  const e = profile.progress?.stages?.[stageId] || {};
  return Object.fromEntries(DIFFICULTY_ORDER.map((d) => [d, !!e[d]]));
}

/** Cleared on any difficulty. */
export function isStageCleared(profile, stageId) {
  const m = stageMedals(profile, stageId);
  return DIFFICULTY_ORDER.some((d) => m[d]);
}

/** Highest difficulty the stage was cleared on (or null). */
export function bestDifficulty(profile, stageId) {
  const m = stageMedals(profile, stageId);
  return [...DIFFICULTY_ORDER].reverse().find((d) => m[d]) || null;
}

// ---------------------------------------------------------------------------
// Battle modes (docs/specs/CODEX_MODES.md §7.1): ribbons per difficulty × mode
// ---------------------------------------------------------------------------

/** Battle modes unlock on a campaign stage after its first clear (any difficulty). */
export function modesUnlocked(profile, stageId) {
  return STAGE_MAP[stageId]?.kind === 'campaign' && isStageCleared(profile, stageId);
}

/**
 * The 20 ribbons of a stage: { 'easy:reverse': bool, … }. Nightmare × Last Petal is the same battle
 * as Nightmare Standard, so the Nightmare medal earns it too.
 * @returns {Object<string, boolean>}
 */
export function modeRibbons(profile, stageId) {
  const e = profile.progress?.stages?.[stageId] || {};
  const got = e.modes || {};
  const out = {};
  for (const d of DIFFICULTY_ORDER) for (const m of RIBBON_MODES) out[`${d}:${m}`] = !!got[`${d}:${m}`];
  out['nightmare:laststand'] = !!(e.nightmare || got['nightmare:laststand']);
  return out;
}

/** @returns {{ have: number, total: number }} */
export function ribbonCount(profile, stageId) {
  const r = modeRibbons(profile, stageId);
  const keys = Object.keys(r);
  return { have: keys.filter((k) => r[k]).length, total: keys.length };
}

/**
 * @param {object} profile
 * @param {number|string} chapterId
 * @param {number} [act] 1 (the chapter's Act I, the default) or 2 (its Act II)
 * @returns {{ have: number, total: number }} over the act's stages
 */
export function chapterRibbons(profile, chapterId, act = 1) {
  let have = 0;
  let total = 0;
  for (const id of actStages(chapterId, act)) {
    const c = ribbonCount(profile, id);
    have += c.have;
    total += c.total;
  }
  return { have, total };
}

/**
 * The medal and ribbon showcase of one stage: one grid of mode × difficulty. The Standard row is the
 * difficulty medals; every other row is that mode's ribbons. Nightmare × Last Petal is earned with
 * the Nightmare medal (the same battle), so it is marked `merged`.
 * @returns {{ stageId: string, chapter: number|null, cleared: boolean, modesUnlocked: boolean,
 *   grid: { [mode: string]: { [difficulty: string]: { earned: boolean, kind: 'medal'|'ribbon', merged?: true } } },
 *   medals: { have: number, total: 4 }, ribbons: { have: number, total: 20 } }}
 */
export function stageShowcase(profile, stageId) {
  const medals = stageMedals(profile, stageId);
  const ribbons = modeRibbons(profile, stageId);
  const grid = {};
  for (const m of MODE_ORDER) {
    grid[m] = {};
    for (const d of DIFFICULTY_ORDER) {
      if (m === 'standard') grid[m][d] = { earned: medals[d], kind: 'medal' };
      else {
        const cell = { earned: !!ribbons[`${d}:${m}`], kind: 'ribbon' };
        if (m === 'laststand' && d === 'nightmare') cell.merged = true;
        grid[m][d] = cell;
      }
    }
  }
  const r = ribbonCount(profile, stageId);
  return {
    stageId,
    chapter: STAGE_MAP[stageId]?.chapter ?? null,
    cleared: isStageCleared(profile, stageId),
    modesUnlocked: modesUnlocked(profile, stageId),
    grid,
    medals: { have: DIFFICULTY_ORDER.filter((d) => medals[d]).length, total: DIFFICULTY_ORDER.length },
    ribbons: r,
  };
}

/** The whole campaign's showcase (stageShowcase for every campaign stage, in campaign order) and its totals. */
export function campaignShowcase(profile) {
  const stages = CAMPAIGN_IDS.map((id) => stageShowcase(profile, id));
  const sum = (k) => stages.reduce((a, s) => ({ have: a.have + s[k].have, total: a.total + s[k].total }), { have: 0, total: 0 });
  return { stages, medals: sum('medals'), ribbons: sum('ribbons') };
}

/** @returns {boolean} every stage in the stage's `requires` is cleared (or it has none; stages.js requirementsMet) */
export function isStageUnlocked(profile, stageId) {
  const stage = STAGE_MAP[stageId];
  if (!stage) return false;
  return requirementsMet(stage, (id) => isStageCleared(profile, id));
}

/**
 * A battle on a stage that is still locked on the map (reached through a deep link) is a
 * practice run: it plays, but `applyBattleResult` records nothing for it.
 * @returns {boolean}
 */
export function isPracticeRun(profile, stageId) {
  return !isStageUnlocked(profile, stageId);
}

/**
 * Endless runs exist where the Tactical Challenge screen offers them: the challenge stage
 * once it is unlocked, and campaign maps already cleared on any difficulty.
 * @returns {boolean}
 */
export function canPlayEndless(profile, stageId) {
  const stage = STAGE_MAP[stageId];
  if (!stage) return false;
  if (stage.kind === 'challenge') return isStageUnlocked(profile, stageId);
  return stage.kind === 'campaign' && isStageCleared(profile, stageId);
}

/**
 * @param {object} profile
 * @param {number|string} chapterId
 * @param {number} [act] 1 (the chapter's Act I, the default) or 2 (its Act II)
 * @returns {{ cleared: number, total: number, medals: { easy: number, normal: number, hard: number, nightmare: number } }}
 */
export function chapterProgress(profile, chapterId, act = 1) {
  const ids = actStages(chapterId, act);
  const medals = Object.fromEntries(DIFFICULTY_ORDER.map((d) => [d, 0]));
  let clearedCount = 0;
  for (const id of ids) {
    const m = stageMedals(profile, id);
    if (DIFFICULTY_ORDER.some((d) => m[d])) clearedCount++;
    for (const d of DIFFICULTY_ORDER) if (m[d]) medals[d]++;
  }
  return { cleared: clearedCount, total: ids.length, medals };
}

/**
 * @returns {string|null} the first uncleared campaign stage in CAMPAIGN_IDS (null when the campaign is done): Act I
 * first, so a veteran is never pulled back to 1-6; Act II is found through the campaign screen's act rows
 */
export function nextStage(profile) {
  return CAMPAIGN_IDS.find((id) => !isStageCleared(profile, id)) || null;
}

/**
 * Counter check for stage prep / formation.
 * @returns {{ needs: string[], ownedCounters: Object<string, string[]>, missing: string[] }}
 */
export function recommendedFor(profile, stageId) {
  const stage = STAGE_MAP[stageId];
  const needs = stage ? [...new Set(stage.recommended || [])] : [];
  const owned = ownedUnits(profile).map((id) => UNIT_MAP[id]);
  const ownedCounters = {};
  const missing = [];
  for (const cap of needs) {
    const base = owned.filter((u) => hasCapability(u, cap, { includePaths: false }));
    const viaPaths = owned.filter((u) => !base.includes(u) && hasCapability(u, cap, { includePaths: true }));
    ownedCounters[cap] = [...base, ...viaPaths].map((u) => u.id);
    if (!ownedCounters[cap].length) missing.push(cap);
  }
  return { needs, ownedCounters, missing };
}
