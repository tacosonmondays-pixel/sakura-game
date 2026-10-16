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
import { BATTLE_MODES } from '../data/modes.js';

/** Record format this build writes (and the newest it can read). */
export const RECORD_V = 1;
/**
 * Snapshot format this build writes (and the newest it can read). 2: the hero rework (a hero has
 * no tiers; her bought levels and Move cooldown are kept). 3: Potential v3 (a saved girl at P2+
 * fights with the v3 steps and their rhythm / tempo / overclock state). A run whose team is all
 * P1 is still written as format 2 (SNAP_V_P1): format 3 only adds Potential's fields and P1 fights
 * bit-identically, so a build from before v3 continues it exactly; that build drops a format-3
 * record when it loads (cleanRecord below, its own copy), with the dropped-save notice, rather
 * than replay a P2+ girl with the old steps. Format-1 and format-2 snapshots are still restored
 * (src/ui/battle/snapshot.js restoreSim migrates a format-1 hero).
 */
export const SNAP_V = 3;
/** The format an all-P1 run is written in (the format before Potential v3). */
export const SNAP_V_P1 = 2;
/** Saved battles kept at once; starting another one asks which one to delete (stage prep). */
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
 * Never co-op, the clan boss (a server-timed attempt), the scripted tutorial, a practice run
 * (a deep link to a locked stage, which saves nothing by design) or a solo freeplay run
 * (`req.freeplay`: its clear is banked at the goal and its freeplay part is paid when it is left
 * or at the next app start, src/systems/freeplayRewards.js, so a continued copy would pay twice),
 * nor a Sandbox run (`req.sandbox`: nothing from it is ever saved, and it plays on a host stage
 * whose slot holds the real run of that stage).
 * @param {object} params route params
 * @param {{ practice?: boolean, error?: string|null, freeplay?: string|null, sandbox?: boolean }} req parsed battle request (setup.js)
 */
export const isSavableRun = (params = {}, req = {}) => !params.coop && !params.clanBoss && !params.tutorial && !params.sandbox && !req.sandbox && !req.practice && !req.error && !req.freeplay;

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
 * How much play a save holds, for choosing which one to give up: endless runs (the Colosseum,
 * endless on a map) rank above every finite stage by the waves they reached; a finite stage by
 * the share of its waves already cleared.
 */
function saveWorth(rec) {
  const s = saveSummary(rec);
  return s.endless ? 1 + s.next : s.of ? (s.next - 1) / s.of : 0;
}

/**
 * Every saved battle, the one with the least play first (a tie: the one played least recently
 * first): the order stage prep offers them in when the saves are full.
 */
export function savesByWorth(profile) {
  return listBattleSaves(profile).sort((a, b) => saveWorth(a) - saveWorth(b) || (a.updatedAt || 0) - (b.updatedAt || 0));
}

/**
 * The save a new one in `slot` would have to replace to stay within MAX_BATTLE_SAVES (the one
 * with the least play), or null when there is room (or the slot already holds a save it simply
 * overwrites). Nothing is ever replaced without asking: stage prep lets the player pick.
 */
export function saveToEvict(profile, slot) {
  const list = savesByWorth(profile);
  if (list.some((r) => r.slot === slot) || list.length < MAX_BATTLE_SAVES) return null;
  return list[0];
}

/**
 * Stores a record in its slot, replacing the saves with the least play past MAX_BATTLE_SAVES
 * (the battle saver never gets here when that would be needed: it asks first).
 * @returns {object[]} the records removed to make room
 */
export function putBattleSave(profile, rec) {
  const all = saves(profile);
  all[rec.slot] = rec;
  const evicted = [];
  const list = savesByWorth(profile).filter((r) => r !== rec);
  while (list.length + 1 > MAX_BATTLE_SAVES) {
    const old = list.shift();
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

const KIND_NAME = { campaign: 'Mission', resource: 'Bounty', boss: 'Total Assault', challenge: 'Tactical Challenge' };

/**
 * Name of a saved battle's stage: "Mission 1-3", "Endless 2-4", "Library Courtyard II", "Grave
 * Lych", "Tactical Challenge". `mode` is the kind of battle, for a second, smaller line: "Bounty",
 * "Total Assault", "Endless", or null where the name already says it (a mission, endless on a map).
 * @returns {{ name: string, mode: string|null }}
 */
export function saveTitle(rec) {
  const stage = STAGE_MAP[rec?.stageId];
  if (!stage) return { name: String(rec?.stageId || ''), mode: null };
  if (rec.endless && stage.kind !== 'challenge') return { name: `Endless ${stage.id}`, mode: null };
  if (stage.kind === 'campaign') return { name: `${KIND_NAME.campaign} ${stage.id}`, mode: null };
  if (stage.kind === 'challenge') return { name: stage.name, mode: 'Endless' };
  // "Total Assault: Grave Lych" → the boss, with the mode on its own line
  const mode = KIND_NAME[stage.kind] || null;
  const name = mode ? stage.name.replace(new RegExp(`^${mode}:\\s*`), '') : stage.name;
  return { name: name || stage.name, mode };
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
  // an endless run on a campaign map (a build before Freeplay): that mode is Freeplay now, which
  // never saves, so nothing can continue it (dropped with the notice)
  if (r.endless && stage.kind !== 'challenge') return null;
  if (!DIFFICULTIES[r.difficulty] || !isUint32(r.seed)) return null;
  // a battle mode this build does not know cannot be played as saved (absent = Standard)
  if (r.mode != null && !(typeof r.mode === 'string' && Object.hasOwn(BATTLE_MODES, r.mode))) return null;
  if (!finite(r.v) || r.v > RECORD_V) return null;
  const s = r.snap;
  if (!isObj(s) || !finite(s.v) || s.v > SNAP_V) return null;
  if (s.state !== 'prep' && s.state !== 'between') return null;
  if (![s.cash, s.lives, s.wave, s.time].every(finite)) return null;
  // a finite stage made shorter by an update: nothing left to continue (dropped with the notice)
  const endlessRun = !!r.endless || stage.kind === 'challenge' || !Number.isFinite(stage.waves);
  if (!endlessRun && s.wave >= stage.waves) return null;
  if (!Array.isArray(s.towers) || !s.towers.every(isObj)) return null;
  const uids = s.towers.map((t) => t.uid);
  if (!uids.every((u) => Number.isInteger(u) && u > 0) || new Set(uids).size !== uids.length) return null;
  const loadout = (Array.isArray(r.loadout) ? r.loadout : []).map(cleanEntry).filter(Boolean);
  const hero = cleanEntry(r.hero);
  if (!loadout.length && !hero) return null;
  const updatedAt = finite(r.updatedAt) && r.updatedAt > 0 ? r.updatedAt : 0;
  const { mode, ...rest } = r;
  return {
    ...rest,
    ...(mode && mode !== 'standard' ? { mode } : {}),
    loadout,
    hero,
    endless: !!r.endless,
    // the event bonus is judged by createdAt: a record without one counts from its last play
    createdAt: finite(r.createdAt) && r.createdAt > 0 ? r.createdAt : updatedAt || Date.now(),
    updatedAt,
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

/** What the one-time notice names: "Mission 1-3 (wave 5)" for each dropped saved battle it can name. */
export function droppedBattleSaveNames(raw) {
  if (!isObj(raw) || !isObj(raw.battleSaves)) return [];
  const kept = cleanBattleSaves(raw.battleSaves);
  const names = [];
  for (const [slot, r] of Object.entries(raw.battleSaves)) {
    if (!isObj(r) || (kept[slot] && kept[slot].id === r.id) || !STAGE_MAP[r.stageId]) continue;
    names.push(finite(r.snap?.wave) ? `${saveTitle(r).name} (wave ${r.snap.wave + 1})` : saveTitle(r).name);
  }
  return names.slice(0, droppedBattleSaves(raw));
}
