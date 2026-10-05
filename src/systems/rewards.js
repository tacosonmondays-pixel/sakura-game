// Battle rewards: stage drops, medals, first clears, unlocks, bestiary and sweeps
// (owner: systems). See CONTRACTS.md §5.

import { STAGE_MAP, getStage } from '../data/stages.js';
import { ENEMY_MAP } from '../data/enemies.js';
import { getItem } from '../data/items.js';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../data/types.js';
import { addItems, normalizeList } from './inventory.js';
import { rollGear, addGear } from './gear.js';
import { grantUnit, isOwned, stageMedals } from './unlocks.js';
import { track, currentEvent } from './missions.js';

/** Coin drops scale with difficulty (harder = richer). */
export const DIFFICULTY_COIN_MUL = { easy: 0.8, normal: 1, hard: 1.25, nightmare: 1.5 };
/** Max sweeps per call. */
export const MAX_SWEEPS = 10;

const diffIndex = (d) => Math.max(0, DIFFICULTY_ORDER.indexOf(d));

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
    const uid = addGear(profile, d.gear);
    return profile.gear[uid];
  });
  return { items, gear };
}

function eventMul(stageId, now) {
  const ev = currentEvent(now);
  return ev.stageIds.includes(stageId) ? ev.dropMul : 1;
}

/**
 * Apply a finished battle (sim.result()) to the profile.
 * - bestiary: every encountered enemy becomes `seen`; on a WIN it also becomes `discovered`
 * - win: medal for the difficulty, first-clear gems per difficulty (DIFFICULTIES.firstClearGems),
 *   stage.firstClear on the very first clear, free unit unlocks, drop rolls
 * - loss: a small coin consolation (40 per wave cleared)
 * - stats, kills and mission tracking (battleWin/battleWinHard/kill/bossKill) are handled here
 * @param {object} profile
 * @param {{ stageId, difficulty, won, wave, wavesCleared?, livesLeft, encountered, kills, stats }} result
 * @param {object} rng
 * @param {{ now?: Date }} [opts]
 * @returns {{ firstClear: boolean, newMedal: boolean, medal: string|null, rewards: object[], gear: object[], unlockedUnits: string[], discovered: string[], gemsEarned: number, eventBonus: boolean }}
 */
export function applyBattleResult(profile, result, rng, { now = new Date() } = {}) {
  const stage = STAGE_MAP[result?.stageId];
  const out = { firstClear: false, newMedal: false, medal: null, rewards: [], gear: [], unlockedUnits: [], discovered: [], gemsEarned: 0, eventBonus: false };
  if (!stage) return out;
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
  if (won) {
    const wasCleared = DIFFICULTY_ORDER.some((d) => entry[d]);
    out.firstClear = !wasCleared;
    out.newMedal = !entry[difficulty];
    out.medal = DIFFICULTIES[difficulty].medal;
    entry[difficulty] = true;
    entry.clears += 1;
    if (out.newMedal && stage.kind !== 'challenge') rewards.push({ id: 'gems', count: DIFFICULTIES[difficulty].firstClearGems });
    if (out.firstClear) rewards.push(...(stage.firstClear || []));
    for (const unitId of stage.unlocks?.units || []) {
      if (!isOwned(profile, unitId)) {
        grantUnit(profile, unitId);
        out.unlockedUnits.push(unitId);
      }
    }
    const mul = eventMul(stage.id, now);
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
