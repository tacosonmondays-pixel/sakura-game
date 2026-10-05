// Ownership, stage unlocks, medals and counter recommendations (owner: systems).
// See CONTRACTS.md §5.

import { UNIT_MAP, UNITS, hasCapability } from '../data/units.js';
import { STAGE_MAP, CAMPAIGN_IDS, CHAPTERS } from '../data/stages.js';
import { DIFFICULTY_ORDER, UNIT_RARITIES } from '../data/types.js';
import { newUnitState } from './save.js';
import { addItems } from './inventory.js';

/** @returns {string[]} owned unit ids in roster order */
export function ownedUnits(profile) {
  return UNITS.filter((u) => profile.units?.[u.id]).map((u) => u.id);
}

/** @returns {boolean} */
export function isOwned(profile, unitId) {
  return !!profile.units?.[unitId];
}

/**
 * Give a unit. Duplicates convert into Star Fragments (UNIT_RARITIES.fragmentsOnDupe).
 * @returns {{ isNew: boolean, fragments: number }}
 */
export function grantUnit(profile, unitId, now = Date.now()) {
  const def = UNIT_MAP[unitId];
  if (!def) throw new Error(`Unknown unit: ${unitId}`);
  if (!profile.units[unitId]) {
    profile.units[unitId] = newUnitState(now);
    return { isNew: true, fragments: 0 };
  }
  const fragments = UNIT_RARITIES[def.rarity].fragmentsOnDupe;
  addItems(profile, [{ id: 'star_fragment', count: fragments }]);
  return { isNew: false, fragments };
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

/** @returns {boolean} the stage's `requires` is cleared (or it has none) */
export function isStageUnlocked(profile, stageId) {
  const stage = STAGE_MAP[stageId];
  if (!stage) return false;
  return !stage.requires || isStageCleared(profile, stage.requires);
}

/**
 * @returns {{ cleared: number, total: number, medals: { easy: number, normal: number, hard: number, nightmare: number } }}
 */
export function chapterProgress(profile, chapterId) {
  const chapter = CHAPTERS.find((c) => c.id === Number(chapterId));
  const ids = chapter ? chapter.stages : [];
  const medals = Object.fromEntries(DIFFICULTY_ORDER.map((d) => [d, 0]));
  let clearedCount = 0;
  for (const id of ids) {
    const m = stageMedals(profile, id);
    if (DIFFICULTY_ORDER.some((d) => m[d])) clearedCount++;
    for (const d of DIFFICULTY_ORDER) if (m[d]) medals[d]++;
  }
  return { cleared: clearedCount, total: ids.length, medals };
}

/** @returns {string|null} first uncleared campaign stage (null when the campaign is done) */
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
