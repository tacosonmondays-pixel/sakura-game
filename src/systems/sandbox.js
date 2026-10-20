// Sandbox mode rules (owner: systems). A solo test range: any map, any girl (owned or not, at max
// level and awakening), 999,999 battle coins, spawn controls, and nothing is ever saved from it —
// no clears, medals, drops, bestiary, mission or achievement progress (rewards.js skips a result
// that carries `sandbox: true`, and the battle never calls applyBattleResult for one).
// Route: #/sandbox (map), #/sandbox/team (squad), then #/battle?stage=<host stage>&difficulty=…&sandbox=1&team=a.b&hero=x

import { UNIT_MAP, UNITS } from '../data/units.js';
import { STAGES, CAMPAIGN_IDS } from '../data/stages.js';
import { MAPS } from '../data/maps.js';
import { BATTLE } from '../data/types.js';
import { unitBattleStats, BREAKTHROUGH_LEVEL_CAP, MAX_AWAKEN, MAX_BREAKTHROUGH } from './progression.js';
import { isStageCleared } from './unlocks.js';

/** Campaign stages cleared (any difficulty) before Sandbox opens. */
export const SANDBOX_UNLOCK_CLEARS = 7;
/** Battle coins a sandbox battle starts with. */
export const SANDBOX_COINS = 999999;
/** What the "+ coins" button adds, and the most a sandbox purse holds. */
export const SANDBOX_COIN_STEP = 100000;
export const SANDBOX_COIN_CAP = 9999999;

/** @returns {number} campaign stages cleared on any difficulty */
export function campaignClears(profile) {
  return CAMPAIGN_IDS.filter((id) => isStageCleared(profile, id)).length;
}

/** @returns {boolean} */
export function isSandboxUnlocked(profile) {
  return campaignClears(profile) >= SANDBOX_UNLOCK_CLEARS;
}

/** The locked tile's line. */
export function sandboxLockText(profile) {
  const left = Math.max(0, SANDBOX_UNLOCK_CLEARS - campaignClears(profile));
  return `Clear ${SANDBOX_UNLOCK_CLEARS} stages to unlock (${left} to go)`;
}

/**
 * Every map with the stage that hosts it in a sandbox battle (the first stage drawn on it; its
 * waves are what "Send next wave" sends).
 * @returns {{ map: object, stage: object }[]}
 */
export function sandboxMaps() {
  const out = [];
  for (const map of MAPS) {
    const stage = STAGES.find((s) => s.mapId === map.id);
    if (stage) out.push({ map, stage });
  }
  return out;
}

/** @returns {string|null} the host stage id of a map */
export function sandboxStageFor(mapId) {
  return STAGES.find((s) => s.mapId === mapId)?.id || null;
}

/**
 * A girl at her best at P1: her P1 level cap (60), every breakthrough gate, full awakening (no
 * gear, no Potential: the levels above 60 come with Potential).
 */
export function sandboxUnitStats(unitId) {
  const profile = { units: { [unitId]: { level: BREAKTHROUGH_LEVEL_CAP, awaken: MAX_AWAKEN, breakthrough: MAX_BREAKTHROUGH, gear: {} } }, gear: {} };
  return unitBattleStats(profile, unitId);
}

/**
 * Any girl in the roster may join, owned or not. Unknown ids, duplicates, a hero in a tower slot
 * (or the other way round) are dropped; at most BATTLE.maxTowers students.
 * @param {string[]} team
 * @param {string|null} hero
 * @returns {{ towers: string[], hero: string|null }}
 */
export function sandboxFormation(team = [], hero = null) {
  const towers = [...new Set((team || []).filter((id) => UNIT_MAP[id]?.kind === 'tower'))].slice(0, BATTLE.maxTowers);
  return { towers, hero: hero && UNIT_MAP[hero]?.kind === 'hero' ? hero : null };
}

/** Every girl the sandbox offers, students first, then heroes. */
export function sandboxRoster(kind = null) {
  return UNITS.filter((u) => (kind ? u.kind === kind : true));
}

/** Route params → team list ('a.b.c' or 'a,b,c'). */
export function parseTeam(s) {
  return String(s || '').split(/[.,]/).map((x) => x.trim()).filter(Boolean);
}

/** The battle route params of a sandbox run. */
export function sandboxBattleParams({ mapId, difficulty = 'normal', towers = [], hero = null }) {
  const stage = sandboxStageFor(mapId);
  return { stage, difficulty, sandbox: 1, team: towers.join('.'), hero: hero || undefined };
}

/** What a sandbox battle hands the results sheet: nothing earned, nothing saved. */
export function sandboxOutcome() {
  return { sandbox: true, firstClear: false, newMedal: false, medal: null, rewards: [], gear: [], unlockedUnits: [], discovered: [], gemsEarned: 0, eventBonus: false, practice: false };
}
