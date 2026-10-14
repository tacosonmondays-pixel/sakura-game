// Rewards for a co-op battle, applied by each player to their own save: the stage's normal
// drops on a win (and coins per wave on a loss), bestiary sightings and mission kill counts.
// No medals, first-clear gems or unlocks — those stay a solo achievement.
//
// Co-op freeplay (a room with Freeplay on, src/data/freeplay.js) pays in two parts:
//   1. the clear, banked the moment the goal wave is cleared (applyCoopClear): exactly the normal
//      co-op win, saved at once, so leaving or falling later never loses it;
//   2. the run, when it ends (defeat, the Finish vote, or leaving after the goal:
//      applyCoopFreeplayEnd): coins per freeplay wave × the tier's multiplier, a freeplay cache
//      every 25 freeplay waves, Assault Tokens for boss-rank kills (capped), the per-tier best
//      wave, one-time milestones, and only the kills / sightings made since the bank.
// About 30–60 % of normal co-op farming per minute (spec §11): freeplay is played for the record
// and the bosses, not the farm. Not part of the co-op compatibility id (tools/simId.mjs): these
// numbers can change in any deploy without splitting players.
import { rollStageDrops } from '../../systems/rewards.js';
import { addItems } from '../../systems/inventory.js';
import { track } from '../../systems/missions.js';
import { STAGE_MAP } from '../../data/stages.js';
import { ENEMY_MAP } from '../../data/enemies.js';
import { getItem } from '../../data/items.js';
import { freeplayTable } from '../../data/freeplay.js';

/** Freeplay payout tuning (outside the co-op id). */
export const FREEPLAY_REWARDS = Object.freeze({
  /** coins per freeplay wave cleared, × the tier's rewardMul (Blossom 1, Tempest 1.5, Crimson Moon 2) */
  coinsPerWave: 40,
  /** one freeplay cache (a stage drop roll without gear, crowns or tokens) per this many freeplay waves */
  cacheEvery: 25,
  /** Assault Tokens: one per boss-rank kill (bosses, titans, the Matriarch, the Wyrm), at most this many a run */
  tokenCap: 10,
  /** once per account and tier: [id, what unlocks it, gems, title?, frame?] */
  milestones: Object.freeze([
    Object.freeze({ id: 'w100', wave: 100, gems: 50, label: 'Reached wave 100' }),
    Object.freeze({ id: 'w150', wave: 150, gems: 100, label: 'Reached wave 150' }),
    Object.freeze({ id: 'matriarch', kill: 'dragon_ashwing', gems: 200, title: 'Ashwing Slayer', crimsonTitle: 'Crimson Slayer', label: 'Ashwing Matriarch defeated' }),
    Object.freeze({ id: 'wyrm', kill: 'fp_eclipse_wyrm', gems: 0, frame: 'eclipse', label: 'Eclipse Wyrm defeated' }),
  ]),
});

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const count = (v) => Math.max(0, Math.floor(Number(v) || 0));

function blankOut() {
  return { firstClear: false, newMedal: false, medal: null, rewards: [], gear: [], unlockedUnits: [], discovered: [], gemsEarned: 0, eventBonus: false, practice: false, coop: true };
}

/** Bestiary sightings + kill counts of `kills` (only ids the game knows); returns the total kills. */
function addSightings(profile, encountered, kills) {
  profile.bestiary ||= {};
  let total = 0;
  for (const id of new Set([...(encountered || []), ...Object.keys(kills || {})])) {
    if (!ENEMY_MAP[id]) continue;
    const b = (profile.bestiary[id] ||= { seen: false, discovered: false, kills: 0 });
    b.seen = true;
    const n = count(kills?.[id]);
    b.kills += n;
    total += n;
  }
  return total;
}

/**
 * @param {object} profile
 * @param {object} result Sim.result()
 * @param {{ next(): number }} rng
 * @returns {object} the same shape applyBattleResult returns, plus `coop: true`
 */
export function applyCoopResult(profile, result, rng) {
  const out = blankOut();
  const stage = STAGE_MAP[result?.stageId];
  if (!stage) return out;
  const kills = addSightings(profile, result.encountered, result.kills);
  const rewards = [];
  if (result.won) {
    const drops = rollStageDrops(stage.id, result.difficulty, rng);
    for (const d of drops) if (d && d.id && !d.gear) rewards.push({ id: d.id, count: d.count });
    rewards.push({ id: 'coins', count: 300 + 40 * (result.wavesCleared || 0) });
  } else if (result.wavesCleared > 0) {
    rewards.push({ id: 'coins', count: 40 * result.wavesCleared });
  }
  if (kills) track(profile, 'kill', kills);
  out.rewards = addItems(profile, rewards);
  return out;
}

/**
 * Freeplay: the stage clear, banked the moment the goal wave is cleared — the normal co-op win
 * (stage drops without gear, 300 + 40 × goal coins, sightings and kills so far, kill missions).
 * The caller saves at once and keeps `out.banked` (what was counted) for applyCoopFreeplayEnd,
 * and must call this once per battle (the battle UI keys it by the start seed).
 * @param {object} profile
 * @param {object} result Sim.result() at (or after) the goal
 * @param {{ next(): number }} rng
 * @returns {object} applyCoopResult's shape + `clear: true`, `banked: { goal, kills, encountered }`
 */
export function applyCoopClear(profile, result, rng) {
  const goal = count(result?.goal ?? result?.wavesCleared);
  const out = applyCoopResult(profile, { ...result, won: true, wavesCleared: goal }, rng);
  out.clear = true;
  out.banked = { goal, kills: { ...(result?.kills || {}) }, encountered: [...(result?.encountered || [])] };
  return out;
}

/**
 * The payout ledger of one freeplay battle, kept on an object that outlives the battle screen (the
 * co-op session): a resync remounts the battle and replays its events, and neither may pay twice.
 * fx: one-shot effects already shown (banners, toasts); bank / end: the outcomes once paid.
 * @param {object} holder e.g. the co-op session
 * @param {number|string} seed the battle's start seed
 * @returns {{ fx: Set<string>, bank: object|null, end: object|null }}
 */
export function freeplayLedger(holder, seed) {
  const all = (holder.freeplayRuns ||= {});
  return (all[seed] ||= { fx: new Set(), bank: null, end: null });
}

/** Banks the clear once per ledger (later calls return the same outcome and pay nothing). */
export function bankFreeplayClear(ledger, profile, result, rng) {
  if (!ledger.bank) ledger.bank = applyCoopClear(profile, result, rng);
  return ledger.bank;
}

/** Pays the end of the run once per ledger (banking the clear first if that never happened). */
export function payFreeplayEnd(ledger, profile, result, rng) {
  bankFreeplayClear(ledger, profile, result, rng);
  if (!ledger.end) ledger.end = applyCoopFreeplayEnd(profile, result, rng, { banked: ledger.bank.banked });
  return ledger.end;
}

/** Kills since the bank: result.kills − banked.kills, per id (never negative). */
export function killsSince(kills, banked) {
  const out = {};
  for (const [id, n] of Object.entries(kills || {})) {
    const d = count(n) - count(banked?.kills?.[id]);
    if (d > 0) out[id] = d;
  }
  return out;
}

/** A stage drop roll for a freeplay cache: no gear boxes, crowns or tokens (freeplay is not a crown farm). */
export function rollFreeplayCache(stageId, difficulty, rng) {
  return rollStageDrops(stageId, difficulty, rng).filter((d) => {
    if (!d || !d.id || d.gear) return false;
    const cat = getItem(d.id)?.category;
    return cat !== 'gearbox' && cat !== 'crown' && cat !== 'token';
  });
}

/** This account's freeplay records: { done: ['blossom:w100', …], titles: [...], frames: [...] }. */
export function freeplayRecords(profile) {
  const p = (profile.progress ||= { stages: {} });
  const r = (p.freeplay = isObj(p.freeplay) ? p.freeplay : {});
  for (const k of ['done', 'titles', 'frames']) if (!Array.isArray(r[k])) r[k] = [];
  return r;
}

/** Best freeplay wave on a stage per tier: { blossom?, tempest?, crimson? } (absolute waves). */
export function coopBestWaves(profile, stageId) {
  const e = profile?.progress?.stages?.[stageId];
  return isObj(e?.coopBestWave) ? e.coopBestWave : {};
}

/**
 * Freeplay: the end of a run (defeat, the Finish vote, or leaving once the goal was cleared). Pays
 * only the freeplay part — the clear was banked at the goal — and never runs the win branch even
 * though a Finish ends 'won'. Kills and sightings count only the delta since the bank.
 * @param {object} profile
 * @param {object} result Sim.result() (result.freeplay = tier id, result.goal, result.wavesCleared)
 * @param {{ next(): number }} rng
 * @param {{ banked?: { goal: number, kills: object, encountered: string[] }|null }} [opts]
 * @returns {object} applyCoopResult's shape + `freeplay: { tier, waves, coins, caches, tokens,
 *   best, prevBest, newBest, milestones: [{ id, label, gems, title?, frame? }] }`
 */
export function applyCoopFreeplayEnd(profile, result, rng, { banked = null } = {}) {
  const out = blankOut();
  const stage = STAGE_MAP[result?.stageId];
  const table = freeplayTable(result?.freeplay);
  if (!stage || !table) return out;
  const goal = count(result.goal ?? stage.waves);
  const cleared = count(result.wavesCleared);
  const waves = Math.max(0, cleared - goal);
  const R = FREEPLAY_REWARDS;
  const rewards = [];

  // only what happened since the bank (the clear already counted the rest)
  const kills = killsSince(result.kills, banked);
  const seenBefore = new Set(banked?.encountered || []);
  const newlySeen = (result.encountered || []).filter((id) => !seenBefore.has(id));
  const killed = addSightings(profile, newlySeen, kills);
  if (killed) track(profile, 'kill', killed);

  const coins = Math.round(R.coinsPerWave * waves * (table.rewardMul ?? 1));
  if (coins > 0) rewards.push({ id: 'coins', count: coins });
  const caches = Math.floor(waves / R.cacheEvery);
  for (let i = 0; i < caches; i++) rewards.push(...rollFreeplayCache(stage.id, result.difficulty, rng));
  let bossKills = 0;
  for (const [id, n] of Object.entries(kills)) if (ENEMY_MAP[id]?.tier === 'boss') bossKills += n;
  const tokens = Math.min(R.tokenCap, bossKills);
  if (tokens > 0) rewards.push({ id: 'token_boss', count: tokens });

  // the per-tier best (absolute waves cleared: "147/15")
  const entry = ((profile.progress ||= { stages: {} }).stages ||= {})[stage.id] ||= { easy: false, normal: false, hard: false, nightmare: false, clears: 0 };
  const bests = (entry.coopBestWave = isObj(entry.coopBestWave) ? entry.coopBestWave : {});
  const prevBest = count(bests[table.id]);
  const newBest = cleared > prevBest;
  if (newBest) bests[table.id] = cleared;

  // one-time milestones, per account and tier
  const rec = freeplayRecords(profile);
  const milestones = [];
  for (const m of R.milestones) {
    const key = `${table.id}:${m.id}`;
    if (rec.done.includes(key)) continue;
    const hit = m.wave != null ? cleared >= m.wave : count(kills[m.kill]) > 0;
    if (!hit) continue;
    rec.done.push(key);
    const title = table.id === 'crimson' && m.crimsonTitle ? m.crimsonTitle : m.title || null;
    if (title && !rec.titles.includes(title)) rec.titles.push(title);
    if (m.frame && !rec.frames.includes(m.frame)) rec.frames.push(m.frame);
    if (m.gems > 0) rewards.push({ id: 'gems', count: m.gems });
    milestones.push({ id: m.id, label: m.label, gems: m.gems, title, frame: m.frame || null });
  }

  out.rewards = addItems(profile, rewards);
  out.gemsEarned = out.rewards.reduce((a, r) => a + (r.id === 'gems' ? r.count : 0), 0);
  out.freeplay = { tier: table.id, tierName: table.name, goal, cleared, waves, coins, caches, tokens, best: Math.max(prevBest, cleared), prevBest, newBest, milestones };
  return out;
}
