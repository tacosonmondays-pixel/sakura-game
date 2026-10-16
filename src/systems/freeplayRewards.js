// Solo freeplay rewards (owner: systems). A solo freeplay run pays in the same two parts as co-op
// freeplay (src/online/coop/rewards.js), so freeplay never out-earns normal play per minute:
//   1. the clear, banked the moment the goal wave is cleared: exactly a normal solo win
//      (applyBattleResult: medal, first-clear gems, unlocks, drops, missions), saved at once;
//   2. the run, when it ends (defeat, Finish, or quitting after the goal): the co-op freeplay
//      payout — 40 coins × freeplay waves × the tier's rewardMul, a freeplay cache every 25 freeplay
//      waves (no gear, crowns or tokens; its Akashic Tome shares co-op's 2-a-week cap), ≤ 10
//      Assault Tokens for boss-rank kills, the one-time
//      milestones — plus the solo best wave per stage and tier (`progress.stages[id].freeplayBest`)
//      and only the kills / sightings made since the bank.
// Coins per freeplay wave are capped at the stage's own normal coins per wave (its drop table's
// expected coins ÷ its waves, × the difficulty's coin factor): a freeplay wave lasts longer than an
// average stage wave (calibration, docs/FREEPLAY.md: 45–60 s against 22–30 s), so solo freeplay
// pays well under normal play per minute on every stage and tier, and a cache comes every 25
// freeplay waves where normal play rolls the drop table every run.
import { applyBattleResult, DIFFICULTY_COIN_MUL } from './rewards.js';
import { STAGE_MAP } from '../data/stages.js';
import { applyCoopFreeplayEnd, killsSince, FREEPLAY_REWARDS, dropPendingFreeplay } from '../online/coop/rewards.js';
import { ENEMY_MAP } from '../data/enemies.js';
import { track } from './missions.js';
import { normalizeList } from './inventory.js';
import { freeplayTable, FREEPLAY_TIERS } from '../data/freeplay.js';

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

/** Best solo freeplay wave on a stage per tier: { blossom?, tempest?, crimson? } (absolute waves). */
export function soloBestWaves(profile, stageId) {
  const e = profile?.progress?.stages?.[stageId];
  return isObj(e?.freeplayBest) ? e.freeplayBest : {};
}

/** "Best: wave 87 (Tempest)" lines for a stage, hardest tier first ([] when none). */
export function soloBestLines(profile, stageId) {
  const best = soloBestWaves(profile, stageId);
  return FREEPLAY_TIERS.slice().reverse()
    .filter((id) => best[id] > 0)
    .map((id) => ({ tier: id, wave: best[id], text: `Best: wave ${best[id]} (${freeplayTable(id).name})` }));
}

/** Expected coins of one normal win on a stage (its drop table at that difficulty). */
export function expectedWinCoins(stageId, difficulty = 'normal') {
  const s = STAGE_MAP[stageId];
  if (!s) return 0;
  const order = ['easy', 'normal', 'hard', 'nightmare'];
  const di = Math.max(0, order.indexOf(difficulty));
  let c = 0;
  for (const d of s.drops || []) {
    if (d.item !== 'coins' || (d.difficulty && order.indexOf(d.difficulty) > di)) continue;
    c += d.chance * ((d.min + d.max) / 2);
  }
  return c * (DIFFICULTY_COIN_MUL[difficulty] ?? 1);
}

/** Coins per solo freeplay wave: the tier's co-op rate, capped at the stage's normal coins per wave. */
export function soloWaveCoins(stageId, difficulty, tierId) {
  const s = STAGE_MAP[stageId];
  const table = freeplayTable(tierId);
  if (!s || !table || !Number.isFinite(s.waves) || s.waves <= 0) return 0;
  const tierRate = FREEPLAY_REWARDS.coinsPerWave * (table.rewardMul ?? 1);
  return Math.max(0, Math.min(tierRate, Math.floor(expectedWinCoins(stageId, difficulty) / s.waves)));
}

/**
 * The clear of a solo freeplay run (at the goal): a normal solo win. Returns applyBattleResult's
 * outcome plus `clear: true` and `banked` (what was counted) for applySoloFreeplayEnd.
 */
export function applySoloClear(profile, result, rng, opts = {}) {
  const goal = Math.max(0, Math.floor(Number(result?.goal ?? result?.wavesCleared) || 0));
  const out = applyBattleResult(profile, { ...result, won: true, wavesCleared: goal, livesLeft: result.livesLeft }, rng, opts);
  out.clear = true;
  out.banked = { goal, kills: { ...(result?.kills || {}) }, encountered: [...(result?.encountered || [])] };
  return out;
}

/**
 * The end of a solo freeplay run past its goal: the freeplay payout only (the clear was banked).
 * Enemies first killed here are added to the bestiary as discovered, like a solo win would.
 * @returns {object} applyCoopFreeplayEnd's shape with `coop: false`
 */
export function applySoloFreeplayEnd(profile, result, rng, { banked = null, now = new Date() } = {}) {
  const out = applyCoopFreeplayEnd(profile, result, rng, { banked, bestKey: 'freeplayBest', waveCoins: soloWaveCoins(result?.stageId, result?.difficulty, result?.freeplay), now });
  if (out.freeplay) out.freeplay.waveCoins = soloWaveCoins(result?.stageId, result?.difficulty, result?.freeplay);
  out.coop = false;
  const kills = killsSince(result?.kills, banked);
  let total = 0;
  let bosses = 0;
  for (const [id, n] of Object.entries(kills)) {
    if (!ENEMY_MAP[id]) continue;
    total += n;
    if (ENEMY_MAP[id].tier === 'boss' || ENEMY_MAP[id].tier === 'miniboss') bosses += n;
    const b = profile.bestiary?.[id];
    if (b && !b.discovered) {
      b.discovered = true;
      out.discovered.push(id);
    }
  }
  if (profile.stats) profile.stats.kills = (profile.stats.kills || 0) + total;
  if (bosses) track(profile, 'bossKill', bosses);
  return out;
}

/** The ledger of one solo freeplay battle (banked clear, paid end, one-shot effects). */
const SOLO_RUNS = {};
export function soloFreeplayLedger(seed) {
  // seed + payout: the run is kept in the save after every freeplay wave (rememberFreeplayRun) and a
  // run the page never got to pay is paid at the next app start with the solo best and coin cap
  return (SOLO_RUNS[seed] ||= { seed, fx: new Set(), bank: null, end: null, payout: { bestKey: 'freeplayBest', waveCoins: null } });
}

/** Banks the clear once per ledger. */
export function bankSoloClear(ledger, profile, result, rng) {
  if (!ledger.bank) ledger.bank = applySoloClear(profile, result, rng);
  return ledger.bank;
}

/**
 * Pays a solo freeplay battle once it is over (or left): the clear (if not banked yet) and, past the
 * goal, the freeplay part. Returns the combined outcome the results sheets read: the bank's medal /
 * first clear / gear, `bank`, `freeplay`, `freeplayRewards` and every reward in `rewards`.
 */
export function paySoloFreeplay(ledger, profile, result, rng) {
  const bank = bankSoloClear(ledger, profile, result, rng);
  if (!ledger.end && result.wavesCleared > (result.goal ?? Infinity)) {
    ledger.end = applySoloFreeplayEnd(profile, result, rng, { banked: bank.banked });
    dropPendingFreeplay(profile, ledger.seed);
  }
  const end = ledger.end;
  if (!end) return { ...bank, bank, freeplayRewards: [] };
  const rewards = normalizeList([...bank.rewards, ...end.rewards]);
  return {
    ...bank,
    bank,
    freeplay: end.freeplay,
    freeplayRewards: end.rewards,
    rewards,
    discovered: [...bank.discovered, ...end.discovered],
    gemsEarned: rewards.reduce((a, r) => a + (r.id === 'gems' ? r.count : 0), 0),
  };
}
