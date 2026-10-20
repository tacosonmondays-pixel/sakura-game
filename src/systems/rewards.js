// Battle rewards: stage drops, medals, first clears, unlocks, bestiary and sweeps
// (owner: systems). See CONTRACTS.md §5.

import { STAGE_MAP, getStage } from '../data/stages.js';
import { ENEMY_MAP } from '../data/enemies.js';
import { getItem } from '../data/items.js';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../data/types.js';
import { addItems, normalizeList } from './inventory.js';
import { rollGear, addGear } from './gear.js';
import { grantUnit, isOwned, stageMedals, isPracticeRun, bestDifficulty, modesUnlocked } from './unlocks.js';
import { modeId } from '../data/modes.js';
import { track, currentEvent } from './missions.js';
import { countSoloBattle } from './achievementCounters.js';
import { hashString } from '../core/rng.js';
import { campaignClears, SANDBOX_UNLOCK_CLEARS, sandboxOutcome } from './sandbox.js';

/** Coin drops scale with difficulty (harder = richer). */
export const DIFFICULTY_COIN_MUL = { easy: 0.8, normal: 1, hard: 1.25, nightmare: 1.5 };
/** Max sweeps per call. */
export const MAX_SWEEPS = 10;

/** Gems per mode ribbon by difficulty (owner question Q1: 0 in v1; switching on needs a SAVE_VERSION bump). */
export const MODE_RIBBON_GEMS = Object.freeze({ easy: 0, normal: 0, hard: 0, nightmare: 0 });

const diffIndex = (d) => Math.max(0, DIFFICULTY_ORDER.indexOf(d));

/**
 * The difficulty a win pays at: Standard pays the selected one; a battle mode pays at most your
 * best Standard medal on that stage (docs/specs/CODEX_MODES.md §7.1), so no mode is a cheaper road
 * to drops than Standard.
 */
export function rewardDifficulty(profile, stageId, difficulty, mode) {
  if (modeId(mode) === 'standard') return difficulty;
  const best = bestDifficulty(profile, stageId) ?? 'easy';
  return diffIndex(best) < diffIndex(difficulty) ? best : difficulty;
}

/** The mode a battle result counts as (Standard when modes are not unlocked there, or Nightmare × Last Petal). */
export function resultMode(profile, stageId, difficulty, mode) {
  const m = modeId(mode);
  if (m === 'standard' || !modesUnlocked(profile, stageId)) return 'standard';
  if (m === 'laststand' && difficulty === 'nightmare') return 'standard';
  return m;
}

/**
 * Roll a stage's drop table. Entries with a `difficulty` only roll at that difficulty or
 * harder; every entry rolls independently. Gear boxes are opened immediately: such entries
 * come back as `{ id: 'gearbox_<rarity>', count: 1, gear: GearInstance }` (one per box).
 * @param {string} stageId
 * @param {'easy'|'normal'|'hard'|'nightmare'} difficulty
 * @param {object} rng
 * @param {{ dropMul?: number }} [opts] event multiplier on counts
 * @returns {{ id: string, count: number, gear?: object }[]}
 */
export function rollStageDrops(stageId, difficulty, rng, { dropMul = 1 } = {}) {
  const stage = getStage(stageId);
  const di = diffIndex(difficulty);
  const items = [];
  const gear = [];
  for (const d of stage.drops || []) {
    if (d.difficulty && diffIndex(d.difficulty) > di) continue;
    if (!(rng.next() < d.chance)) continue;
    let count = rng.int(d.min, d.max);
    if (d.item === 'coins') count = Math.round(count * (DIFFICULTY_COIN_MUL[difficulty] ?? 1));
    count = Math.max(1, Math.round(count * dropMul));
    const item = getItem(d.item);
    if (item?.category === 'gearbox') {
      for (let i = 0; i < count; i++) gear.push({ id: d.item, count: 1, gear: rollGear(rng, { rarity: item.rarity }) });
    } else {
      items.push({ id: d.item, count });
    }
  }
  return [...normalizeList(items), ...gear];
}

function stageEntry(profile, stageId) {
  const stages = (profile.progress ||= { stages: {} }).stages ||= {};
  return (stages[stageId] ||= { easy: false, normal: false, hard: false, nightmare: false, clears: 0 });
}

function splitDrops(profile, drops) {
  const items = drops.filter((d) => !d.gear);
  const gear = drops.filter((d) => d.gear).map((d) => {
    const uid = addGear(profile, d.gear, { club: 'random' }); // a Mythic+ drop joins a random Academy Club
    return profile.gear[uid];
  });
  return { items, gear };
}

/** Drop multiplier of this week's event for a stage at time `now`. */
export function eventMul(stageId, now) {
  const ev = currentEvent(now);
  return ev.stageIds.includes(stageId) ? ev.dropMul : 1;
}

/** How long after its start week ends a saved run still gets that week's event bonus. */
export const EVENT_GRACE_MS = 48 * 3600 * 1000;

/**
 * Drop multiplier of a finished battle. A saved run (`eventAt` = when it started) gets the event
 * of the week it started in, if it finishes in that week or within EVENT_GRACE_MS after it;
 * later, no bonus. So a run begun just before an event is never paid as an event run, and a
 * run begun during one cannot be kept for weeks and still be paid double.
 * @param {string} stageId
 * @param {Date} now finish time
 * @param {Date|null} [eventAt] start of a saved run
 */
export function battleEventMul(stageId, now, eventAt = null) {
  if (!eventAt || !Number.isFinite(eventAt.getTime())) return eventMul(stageId, now);
  const week = currentEvent(eventAt).week;
  const inTime = currentEvent(now).week === week || currentEvent(new Date(now.getTime() - EVENT_GRACE_MS)).week === week;
  return inTime ? eventMul(stageId, eventAt) : 1;
}

/**
 * Seed of the drop roll of a saved run (src/systems/battleSave.js): fixed by the run, so
 * finishing the same run again (an older copy of the profile, another tab) rolls the same drops.
 * @returns {number} uint32
 */
export function battleDropSeed(stageId, difficulty, seed) {
  return hashString(`drops:${stageId}:${difficulty}:${seed >>> 0}`);
}

/**
 * Apply a finished battle (sim.result()) to the profile.
 * - bestiary: every encountered enemy becomes `seen`; on a WIN it also becomes `discovered`
 * - win: medal for the difficulty, first-clear gems per difficulty (DIFFICULTIES.firstClearGems),
 *   stage.firstClear on the very first clear, free unit unlocks, drop rolls
 * - loss: a small coin consolation (40 per wave cleared)
 * - stats, kills and mission tracking (battleWin/battleWinHard/kill/bossKill) are handled here
 * - practice run (the stage is still locked on the map, see isPracticeRun): the profile is not
 *   touched at all and the result comes back with `practice: true`
 * - sandbox run (`result.sandbox`): the profile is not touched at all (`sandbox: true` comes back)
 * - `sandboxUnlocked` is true on the one result whose clear opened Sandbox (the 7th campaign clear)
 * @param {object} profile
 * @param {{ stageId, difficulty, won, wave, wavesCleared?, livesLeft, encountered, kills, stats }} result
 * @param {object} rng
 * @param {{ now?: Date, eventAt?: Date }} [opts] `eventAt`: when the run started (a saved run
 *   finished later gets the event bonus of the week it began in, and only that one, while it
 *   finishes within EVENT_GRACE_MS of that week's end: battleEventMul)
 * @returns {{ firstClear: boolean, newMedal: boolean, medal: string|null, rewards: object[], gear: object[], unlockedUnits: string[], discovered: string[], gemsEarned: number, eventBonus: boolean, practice: boolean }}
 */
export function applyBattleResult(profile, result, rng, { now = new Date(), eventAt = null } = {}) {
  const stage = STAGE_MAP[result?.stageId];
  // Sandbox: no clears, medals, gems, unlocks, drops, bestiary, missions or achievements.
  if (result?.sandbox) return sandboxOutcome();
  const out = { firstClear: false, newMedal: false, medal: null, rewards: [], gear: [], unlockedUnits: [], discovered: [], gemsEarned: 0, eventBonus: false, practice: false, sandboxUnlocked: false, mode: 'standard', newRibbon: false, ribbon: null, rewardDifficulty: null };
  if (!stage) return out;
  // Deep link to a locked stage: no clears, medals, gems, unlocks, drops, bestiary or missions.
  if (isPracticeRun(profile, stage.id)) {
    out.practice = true;
    return out;
  }
  const difficulty = DIFFICULTIES[result.difficulty] ? result.difficulty : 'normal';
  const won = !!result.won;
  const encountered = [...new Set([...(result.encountered || []), ...Object.keys(result.kills || {})])];
  const kills = result.kills || {};

  // Bestiary.
  profile.bestiary ||= {};
  for (const id of encountered) {
    const b = (profile.bestiary[id] ||= { seen: false, discovered: false, kills: 0 });
    b.seen = true;
    if (won && !b.discovered) {
      b.discovered = true;
      out.discovered.push(id);
    }
  }
  let totalKills = 0;
  let bossKills = 0;
  for (const [id, nRaw] of Object.entries(kills)) {
    const n = Math.max(0, Math.floor(Number(nRaw) || 0));
    if (!n) continue;
    profile.bestiary[id].kills += n;
    totalKills += n;
    const tier = ENEMY_MAP[id]?.tier;
    if (tier === 'boss' || tier === 'miniboss') bossKills += n;
  }

  // Stats.
  profile.stats.battles += 1;
  profile.stats.kills += totalKills;
  if (won) profile.stats.wins += 1;

  const entry = stageEntry(profile, stage.id);
  const wavesCleared = Number.isFinite(result.wavesCleared) ? result.wavesCleared : Math.max(0, (result.wave || 0) - (won ? 0 : 1));
  if (stage.kind === 'challenge' || result.wavesCleared != null) entry.bestWave = Math.max(entry.bestWave || 0, wavesCleared);

  const rewards = [];
  const clearsBefore = campaignClears(profile);
  // battle modes: decided before the win changes the medals (a mode only pays up to the best medal held)
  const mode = resultMode(profile, stage.id, difficulty, result.mode);
  out.mode = mode;
  if (won && mode !== 'standard') {
    const payAt = rewardDifficulty(profile, stage.id, difficulty, mode);
    out.rewardDifficulty = payAt;
    const key = `${difficulty}:${mode}`;
    entry.modes ||= {};
    out.newRibbon = !entry.modes[key];
    out.ribbon = key;
    entry.modes[key] = true;
    entry.clears += 1;
    if (out.newRibbon && MODE_RIBBON_GEMS[difficulty] > 0) rewards.push({ id: 'gems', count: MODE_RIBBON_GEMS[difficulty] });
    // a saved mode run keeps its start week's event (battle save), like a Standard win below
    const mul = battleEventMul(stage.id, now, eventAt);
    out.eventBonus = mul > 1;
    const split = splitDrops(profile, rollStageDrops(stage.id, payAt, rng, { dropMul: mul }));
    rewards.push(...split.items);
    out.gear = split.gear;
    track(profile, 'battleWin', 1);
    if (diffIndex(payAt) >= diffIndex('hard')) track(profile, 'battleWinHard', 1);
  } else if (won) {
    out.rewardDifficulty = difficulty;
    const wasCleared = DIFFICULTY_ORDER.some((d) => entry[d]);
    out.firstClear = !wasCleared;
    out.newMedal = !entry[difficulty];
    out.medal = DIFFICULTIES[difficulty].medal;
    entry[difficulty] = true;
    entry.clears += 1;
    // Nightmare already has one heart: its Last Petal ribbon is the same battle, earned with the medal
    if (difficulty === 'nightmare' && stage.kind === 'campaign') {
      entry.modes ||= {};
      if (!entry.modes['nightmare:laststand']) out.newRibbon = true;
      entry.modes['nightmare:laststand'] = true;
    }
    if (out.newMedal && stage.kind !== 'challenge') rewards.push({ id: 'gems', count: DIFFICULTIES[difficulty].firstClearGems });
    if (out.firstClear) rewards.push(...(stage.firstClear || []));
    for (const unitId of stage.unlocks?.units || []) {
      if (!isOwned(profile, unitId)) {
        grantUnit(profile, unitId);
        out.unlockedUnits.push(unitId);
      }
    }
    const mul = battleEventMul(stage.id, now, eventAt);
    out.eventBonus = mul > 1;
    const drops = rollStageDrops(stage.id, difficulty, rng, { dropMul: mul });
    const split = splitDrops(profile, drops);
    rewards.push(...split.items);
    out.gear = split.gear;
    track(profile, 'battleWin', 1);
    if (diffIndex(difficulty) >= diffIndex('hard')) track(profile, 'battleWinHard', 1);
  } else if (wavesCleared > 0) {
    rewards.push({ id: 'coins', count: 40 * wavesCleared });
  }
  if (totalKills) track(profile, 'kill', totalKills);
  if (bossKills) track(profile, 'bossKill', bossKills);
  countSoloBattle(profile, result, { won, difficulty, eventBonus: out.eventBonus });

  out.sandboxUnlocked = clearsBefore < SANDBOX_UNLOCK_CLEARS && campaignClears(profile) >= SANDBOX_UNLOCK_CLEARS;
  out.rewards = addItems(profile, rewards);
  out.gemsEarned = out.rewards.reduce((a, r) => a + (r.id === 'gems' ? r.count : 0), 0);
  return out;
}

/**
 * Sweeping is unlocked once a stage is cleared on Hard or Nightmare (not for the endless challenge).
 * @returns {boolean}
 */
export function canSweep(profile, stageId) {
  const stage = STAGE_MAP[stageId];
  if (!stage || stage.kind === 'challenge') return false;
  const m = stageMedals(profile, stageId);
  return m.hard || m.nightmare;
}

/**
 * Instantly collect drops `times` times (max 10 per call) on a difficulty already cleared
 * (or easier). No medals, first clears or bestiary changes.
 * @returns {{ ok: boolean, error?: string, runs: object[][], rewards: object[], gear: object[] }}
 */
export function sweep(profile, stageId, difficulty, times, rng, { now = new Date() } = {}) {
  if (!canSweep(profile, stageId)) return { ok: false, error: 'locked', runs: [], rewards: [], gear: [] };
  const d = DIFFICULTIES[difficulty] ? difficulty : 'hard';
  const m = stageMedals(profile, stageId);
  const best = Math.max(...DIFFICULTY_ORDER.map((x, i) => (m[x] ? i : -1)));
  if (diffIndex(d) > best) return { ok: false, error: 'difficulty', runs: [], rewards: [], gear: [] };
  const n = Math.max(1, Math.min(MAX_SWEEPS, Math.floor(times) || 1));
  const mul = eventMul(stageId, now);
  const runs = [];
  const allItems = [];
  const allGear = [];
  for (let i = 0; i < n; i++) {
    const split = splitDrops(profile, rollStageDrops(stageId, d, rng, { dropMul: mul }));
    runs.push([...split.items, ...split.gear.map((g) => ({ id: `gearbox_${g.rarity}`, count: 1, gearUid: g.uid }))]);
    allItems.push(...split.items);
    allGear.push(...split.gear);
  }
  const rewards = addItems(profile, allItems);
  const entry = stageEntry(profile, stageId);
  entry.clears += n;
  track(profile, 'sweep', n);
  return { ok: true, runs, rewards, gear: allGear };
}
