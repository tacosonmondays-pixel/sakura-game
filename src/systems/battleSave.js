// Battle saves (owner: systems). "Save & quit" keeps an unfinished solo battle so stage prep can
// offer Continue · Wave N or New game. See docs/BATTLE_SAVE.md and CONTRACTS.md §5.
//
// A record is plain JSON in profile.battleSaves[slot]: the run's frozen setup (stage, difficulty,
// seed, the team's battle stats) plus a snapshot of the battle at its last calm point (the start
// of the wave in progress, or now when no wave is running). The snapshot itself is taken and
// restored by src/ui/battle/snapshot.js through the public Sim API.
//
// Pure: no DOM, no localStorage and no sim imports here (the store persists the profile).

import { STAGE_MAP } from '../data/stages.js';
import { DIFFICULTIES } from '../data/types.js';

/** Record format this build writes (and the newest it can read). */
export const RECORD_V = 1;
/** Snapshot format this build writes (and the newest it can read). */
export const SNAP_V = 1;
/** Saved battles kept at once; starting another one replaces the oldest. */
export const MAX_BATTLE_SAVES = 5;

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const isUint32 = (v) => Number.isInteger(v) && v >= 0 && v <= 0xffffffff;

/**
 * The save slot of a run: one per stage, plus one per endless run on a campaign map. The
 * Colosseum is endless by nature and keeps its plain stage id ('challenge').
 * @param {string} stageId
 * @param {boolean} [endless]
 * @returns {string}
 */
export function slotKey(stageId, endless = false) {
  return endless && STAGE_MAP[stageId]?.kind !== 'challenge' ? `${stageId}:endless` : String(stageId);
}

/**
 * Which battles save: campaign, Bounty, solo Total Assault, the Colosseum and endless runs.
 * Never co-op, the clan boss (a server-timed attempt), the scripted tutorial or a practice run
 * (a deep link to a locked stage, which saves nothing by design).
 * @param {object} params route params
 * @param {{ practice?: boolean, error?: string|null }} req parsed battle request (setup.js)
 */
export const isSavableRun = (params = {}, req = {}) => !params.coop && !params.clanBoss && !params.tutorial && !req.practice && !req.error;

/** @returns {object} profile.battleSaves (created on demand) */
function saves(profile) {
  if (!isObj(profile.battleSaves)) profile.battleSaves = {};
  return profile.battleSaves;
}

/** The record in a slot, or null. */
export function getBattleSave(profile, slot) {
  const rec = profile?.battleSaves?.[slot];
  return isObj(rec) ? rec : null;
}

/** Every saved battle, most recently played first. */
export function listBattleSaves(profile) {
  return Object.values(profile?.battleSaves || {}).filter(isObj).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/**
 * The record a new save in `slot` would replace to stay within MAX_BATTLE_SAVES (the oldest
 * one), or null when there is room (or the slot already holds a save it simply overwrites).
 */
export function oldestToEvict(profile, slot) {
  const list = listBattleSaves(profile);
  if (list.some((r) => r.slot === slot) || list.length < MAX_BATTLE_SAVES) return null;
  return list[list.length - 1];
}

/**
 * Stores a record in its slot, replacing the oldest other saves past MAX_BATTLE_SAVES.
 * @returns {object[]} the records removed to make room
 */
export function putBattleSave(profile, rec) {
  const all = saves(profile);
  all[rec.slot] = rec;
  const evicted = [];
  const list = listBattleSaves(profile).filter((r) => r !== rec);
  while (list.length + 1 > MAX_BATTLE_SAVES) {
    const old = list.pop();
    delete all[old.slot];
    evicted.push(old);
  }
  return evicted;
}

/**
 * Deletes the save in `slot`. With `runId`, only when the slot still holds that run (a payout,
 * a Restart or another tab's New game never deletes a different run's save).
 * @returns {boolean} a record was deleted
 */
export function clearBattleSave(profile, slot, runId = null) {
  const rec = getBattleSave(profile, slot);
  if (!rec || (runId != null && rec.id !== runId)) return false;
  delete profile.battleSaves[slot];
  return true;
}

/** "just now", "12 min ago", "2 h ago", "3 d ago" */
export function agoText(ms, now = Date.now()) {
  const s = Math.max(0, Math.floor((now - (ms || 0)) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

/**
 * What prep, the map badges and the lobby show for a save. `next` is always the wave the player
 * fights next; `of` is null for endless runs.
 * @returns {{ next: number, of: number|null, lives: number, difficulty: string, endless: boolean, ago: string }}
 */
export function saveSummary(rec, now = Date.now()) {
  const stage = STAGE_MAP[rec?.stageId];
  const endless = !!rec?.endless || stage?.kind === 'challenge' || !Number.isFinite(stage?.waves);
  const wave = finite(rec?.snap?.wave) ? rec.snap.wave : 0;
  return {
    next: wave + 1,
    of: endless ? null : stage?.waves ?? null,
    lives: finite(rec?.snap?.lives) ? rec.snap.lives : 0,
    difficulty: DIFFICULTIES[rec?.difficulty] ? rec.difficulty : 'normal',
    endless,
    ago: agoText(rec?.updatedAt, now),
  };
}

/** A fresh run id ("bs-<time>-<random>"): it goes in the battle URL as &resume=<id>. */
export function newRunId(now = Date.now(), rand = Math.random) {
  return `bs-${Math.floor(now).toString(36)}-${Math.floor(rand() * 0x100000).toString(16).padStart(5, '0')}`;
}

/** One team entry: { unitId, stats } with a plain stats object. */
function cleanEntry(e) {
  if (!isObj(e) || typeof e.unitId !== 'string' || !e.unitId) return null;
  return { unitId: e.unitId, stats: isObj(e.stats) ? e.stats : {} };
}

/** A record this build can keep (else null). Towers of units it does not know stay: Continue refunds them. */
function cleanRecord(slot, r) {
  if (!isObj(r) || typeof r.id !== 'string' || !r.id) return null;
  const stage = STAGE_MAP[r.stageId];
  if (!stage || slotKey(r.stageId, !!r.endless) !== slot || r.slot !== slot) return null;
  if (!DIFFICULTIES[r.difficulty] || !isUint32(r.seed)) return null;
  if (!finite(r.v) || r.v > RECORD_V) return null;
  const s = r.snap;
  if (!isObj(s) || !finite(s.v) || s.v > SNAP_V) return null;
  if (s.state !== 'prep' && s.state !== 'between') return null;
  if (![s.cash, s.lives, s.wave, s.time].every(finite)) return null;
  if (!Array.isArray(s.towers) || !s.towers.every(isObj)) return null;
  const uids = s.towers.map((t) => t.uid);
  if (!uids.every((u) => Number.isInteger(u) && u > 0) || new Set(uids).size !== uids.length) return null;
  const loadout = (Array.isArray(r.loadout) ? r.loadout : []).map(cleanEntry).filter(Boolean);
  const hero = cleanEntry(r.hero);
  if (!loadout.length && !hero) return null;
  return {
    ...r,
    loadout,
    hero,
    endless: !!r.endless,
    createdAt: finite(r.createdAt) ? r.createdAt : 0,
    updatedAt: finite(r.updatedAt) ? r.updatedAt : 0,
    resumes: Number.isInteger(r.resumes) && r.resumes > 0 ? r.resumes : 0,
  };
}

/**
 * Sanitises profile.battleSaves from a stored or imported save (migrateProfile): drops records
 * this build cannot restore and keeps the newest MAX_BATTLE_SAVES.
 * @param {any} raw
 * @returns {Record<string, object>}
 */
export function cleanBattleSaves(raw) {
  if (!isObj(raw)) return {};
  const kept = [];
  for (const [slot, r] of Object.entries(raw)) {
    const rec = cleanRecord(slot, r);
    if (rec) kept.push(rec);
  }
  kept.sort((a, b) => b.updatedAt - a.updatedAt);
  return Object.fromEntries(kept.slice(0, MAX_BATTLE_SAVES).map((r) => [r.slot, r]));
}

/** How many saved battles in a raw profile this build cannot keep (for a one-time notice). */
export function droppedBattleSaves(raw) {
  if (!isObj(raw) || !isObj(raw.battleSaves)) return 0;
  const n = Object.values(raw.battleSaves).length;
  return Math.max(0, Math.min(n, MAX_BATTLE_SAVES) - Object.keys(cleanBattleSaves(raw.battleSaves)).length);
}
