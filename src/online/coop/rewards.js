// Rewards for a co-op battle, applied by each player to their own save: the stage's normal
// drops on a win (and coins per wave on a loss), bestiary sightings and mission kill counts.
// No medals, first-clear gems or unlocks — those stay a solo achievement.
//
// Co-op freeplay (a room with Freeplay on, src/data/freeplay.js) pays in two parts:
//   1. the clear, banked the moment the goal wave is cleared (applyCoopClear): exactly the normal
//      co-op win, saved at once, so leaving or falling later never loses it;
//   2. the run, when it ends (defeat, the Finish vote, or leaving after the goal:
//      applyCoopFreeplayEnd): coins per freeplay wave × the tier's multiplier, a freeplay cache
//      every 25 freeplay waves (plus one Akashic Tome per cache, at most 2 a week per account, solo
//      and co-op together), Assault Tokens for boss-rank kills (capped), the per-tier best wave,
//      one-time milestones, and only the kills / sightings made since the bank.
// Freeplay is played for the record and the bosses, not the farm. Measured (bot runs at 3×, coins
// per real minute): the waves pay 125–210 (Blossom), 185–300 (Tempest), 230–370 (Crimson Moon); a
// cache every 25 waves adds about 170–450 more (it carries the stage's own coin drop) — together
// up to ~80 % of farming normal co-op clears of the same stage (660–1,050 a minute), never more, and
// no path pays a wave twice (the bank and the end each pay once per battle). Not part of the co-op
// compatibility id (tools/simId.mjs): these numbers can change in any deploy without splitting players.
import { rollStageDrops, rewardDifficulty } from '../../systems/rewards.js';
import { addItems } from '../../systems/inventory.js';
import { track } from '../../systems/missions.js';
import { STAGE_MAP } from '../../data/stages.js';
import { ENEMY_MAP } from '../../data/enemies.js';
import { getItem } from '../../data/items.js';
import { freeplayTable } from '../../data/freeplay.js';
import { weekKey } from '../../core/util.js';
import { MILESTONE_ITEMS, MILESTONE_ITEMS_MARK } from '../../data/gearAwaken.js';

/** Freeplay payout tuning (outside the co-op id). */
export const FREEPLAY_REWARDS = Object.freeze({
  /** coins per freeplay wave cleared, × the tier's rewardMul (Blossom 1, Tempest 1.5, Crimson Moon 2) */
  coinsPerWave: 40,
  /** one freeplay cache (a stage drop roll without gear, crowns or tokens) per this many freeplay waves */
  cacheEvery: 25,
  /**
   * Each cache also holds `perCache` Akashic Tomes (one level above 60 each, Potential v3 §4.4), at
   * most `weeklyCap` a week per account, solo and co-op together (counter `fpTome:<week>` in
   * missions.counters, the shop's week). Uncapped, Freeplay would be the best EXP farm in the game.
   */
  cacheTome: Object.freeze({ item: 'book_legendary', perCache: 1, weeklyCap: 2 }),
  /** The first freeplay cache of the game week (solo or co-op) also holds a Starlight Needle (gear-awaken §6.2). */
  weeklyNeedle: Object.freeze({ item: 'needle_star', count: 1, key: 'cap:fpNeedle' }),
  /** Assault Tokens: one per boss-rank kill (bosses, titans, the Matriarch, the Wyrm), at most this many a run */
  tokenCap: 10,
  /** once per account and tier: [id, what unlocks it, gems, title?, frame?] */
  milestones: Object.freeze([
    Object.freeze({ id: 'w100', wave: 100, gems: 50, label: 'Reached wave 100' }),
    Object.freeze({ id: 'w150', wave: 150, gems: 100, items: MILESTONE_ITEMS.w150, label: 'Reached wave 150' }),
    Object.freeze({ id: 'matriarch', kill: 'dragon_ashwing', gems: 200, items: MILESTONE_ITEMS.matriarch, title: 'Ashwing Slayer', crimsonTitle: 'Crimson Slayer', label: 'Ashwing Matriarch defeated' }),
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
  // event stages never run in co-op (EVENT_SPEC E11): a hand-edited room link pays nothing
  if (!stage || stage.kind === 'event') return out;
  const kills = addSightings(profile, result.encountered, result.kills);
  const rewards = [];
  if (result.won) {
    // a battle-mode win pays each player at most their own best Standard medal there (CODEX_MODES §7.1)
    const payAt = rewardDifficulty(profile, stage.id, result.difficulty, result.mode);
    out.rewardDifficulty = payAt;
    out.mode = result.mode || 'standard';
    const drops = rollStageDrops(stage.id, payAt, rng);
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
  return (all[seed] ||= { seed, fx: new Set(), bank: null, end: null });
}

/** Banks the clear once per ledger (later calls return the same outcome and pay nothing). */
export function bankFreeplayClear(ledger, profile, result, rng) {
  if (!ledger.bank) ledger.bank = applyCoopClear(profile, result, rng);
  return ledger.bank;
}

/** Pays the end of the run once per ledger (banking the clear first if that never happened). */
export function payFreeplayEnd(ledger, profile, result, rng) {
  bankFreeplayClear(ledger, profile, result, rng);
  if (!ledger.end) {
    ledger.end = applyCoopFreeplayEnd(profile, result, rng, { banked: ledger.bank.banked });
    dropPendingFreeplay(profile, ledger.seed);
  }
  return ledger.end;
}

// ---- a run the page never got to pay (reloaded, closed, or discarded by the phone) -------------
// The ledger lives in memory; on an iPhone the most common end of an hour-long run is a reload or
// a background tab the browser threw away. So after every freeplay wave the battle keeps what the
// end payout needs in the save (progress.freeplayPending[seed]); payFreeplayEnd removes it, and
// the next app start pays whatever is still there (payPendingFreeplayRuns).

/** The most runs kept waiting (the oldest goes first). */
const PENDING_MAX = 3;

/** Saves (in the profile) what the end payout of this run needs, as of now. Call after each freeplay wave. */
export function rememberFreeplayRun(profile, ledger, result) {
  if (!ledger?.bank || ledger.end || ledger.seed == null || !result?.freeplay) return false;
  if (count(result.wavesCleared) <= count(ledger.bank.banked?.goal)) return false;
  const progress = (profile.progress ||= { stages: {} });
  const all = (progress.freeplayPending = isObj(progress.freeplayPending) ? progress.freeplayPending : {});
  const key = String(ledger.seed);
  delete all[key]; // (re-added last: the newest run is the last key)
  all[key] = {
    stageId: result.stageId, difficulty: result.difficulty, freeplay: result.freeplay, goal: count(result.goal),
    wavesCleared: count(result.wavesCleared), kills: { ...(result.kills || {}) }, encountered: [...(result.encountered || [])],
    banked: { goal: count(ledger.bank.banked?.goal), kills: { ...(ledger.bank.banked?.kills || {}) }, encountered: [...(ledger.bank.banked?.encountered || [])] },
    // solo freeplay (src/systems/freeplayRewards.js): its best field and its capped coins per wave
    ...(ledger.payout?.bestKey ? { bestKey: ledger.payout.bestKey } : {}),
    ...(ledger.payout?.waveCoins != null ? { waveCoins: count(ledger.payout.waveCoins) } : {}),
  };
  const keys = Object.keys(all);
  for (const k of keys.slice(0, Math.max(0, keys.length - PENDING_MAX))) delete all[k];
  return true;
}

/** Forgets a pending run (it was paid). */
export function dropPendingFreeplay(profile, seed) {
  const all = profile?.progress?.freeplayPending;
  if (!isObj(all) || seed == null) return;
  delete all[String(seed)];
  if (!Object.keys(all).length) delete profile.progress.freeplayPending;
}

/**
 * App start: pays every freeplay run the last session could not (its freeplay part, from the
 * last wave it saved) and forgets them. @param {(seed: string) => { next(): number }} rngFor
 * @returns {object[]} applyCoopFreeplayEnd's outcomes, + stageId
 */
export function payPendingFreeplayRuns(profile, rngFor) {
  const all = profile?.progress?.freeplayPending;
  if (!isObj(all)) return [];
  const out = [];
  for (const [seed, rec] of Object.entries(all)) {
    delete all[seed]; // first: a run that fails to pay is never paid twice
    if (!isObj(rec)) continue;
    try {
      const res = applyCoopFreeplayEnd(profile, { ...rec, won: false, finished: false }, rngFor(seed), {
        banked: rec.banked,
        ...(rec.bestKey === 'freeplayBest' ? { bestKey: 'freeplayBest' } : {}),
        ...(rec.waveCoins != null ? { waveCoins: count(rec.waveCoins) } : {}),
      });
      if (res.freeplay) out.push({ ...res, stageId: rec.stageId });
    } catch (e) {
      console.warn('[coop] a pending freeplay run could not be paid', e);
    }
  }
  delete profile.progress.freeplayPending;
  return out;
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

/** missions.counters key prefix of the Akashic Tomes freeplay caches paid this week ('fpTome:' + weekKey). */
export const FP_TOME_PREFIX = 'fpTome:';

/**
 * Akashic Tomes `caches` freeplay caches add for this account now: `perCache` each until the week's
 * `weeklyCap` (solo and co-op share the counter). Counts them in `fpTome:<week>`; writing a week's
 * key deletes older weeks' keys, so a new week starts again at 0.
 * @returns {number} Tomes to add
 */
export function freeplayCacheTomes(profile, caches, now = new Date()) {
  const T = FREEPLAY_REWARDS.cacheTome;
  const want = count(caches) * T.perCache;
  if (!want) return 0;
  const counters = ((profile.missions ||= {}).counters ||= {});
  const key = FP_TOME_PREFIX + weekKey(now);
  for (const k of Object.keys(counters)) if (k.startsWith(FP_TOME_PREFIX) && k !== key) delete counters[k];
  const got = count(counters[key]);
  const n = Math.max(0, Math.min(want, T.weeklyCap - got));
  if (n > 0) counters[key] = got + n;
  return n;
}

/**
 * The freeplay results line for the caches' Akashic Tomes (read after the run was applied): "+1
 * Akashic Tome (2 of 2 this week)" when the caches paid some, "Akashic Tomes: weekly limit reached (2
 * a week, back next week)" when caches came but the week's Tomes were already paid, null without
 * a cache. `fp` is applyCoopFreeplayEnd's `freeplay` ({ caches, tomes }).
 * @returns {string|null}
 */
export function freeplayTomeLine(profile, fp, now = new Date()) {
  const T = FREEPLAY_REWARDS.cacheTome;
  if (!count(fp?.caches)) return null;
  const tomes = count(fp?.tomes);
  if (!tomes) return `Akashic Tomes: weekly limit reached (${T.weeklyCap} a week, back next week)`;
  const used = Math.min(T.weeklyCap, Math.max(tomes, count(profile?.missions?.counters?.[FP_TOME_PREFIX + weekKey(now)])));
  return `+${tomes} Akashic Tome${tomes === 1 ? '' : 's'} (${used} of ${T.weeklyCap} this week)`;
}

/** This account's freeplay records: { done: ['blossom:w100', …], titles: [...], frames: [...] }. */
export function freeplayRecords(profile) {
  const p = (profile.progress ||= { stages: {} });
  const r = (p.freeplay = isObj(p.freeplay) ? p.freeplay : {});
  for (const k of ['done', 'titles', 'frames']) if (!Array.isArray(r[k])) r[k] = [];
  // the once-per-account milestones are mirrored into missions.counters, which every older build
  // keeps when it saves: an old cached tab that drops progress.freeplay can't make them pay twice
  const counters = profile.missions?.counters;
  if (isObj(counters)) {
    for (const [k, v] of Object.entries(counters)) {
      if (k.startsWith(MILESTONE_MARK) && v > 0 && !r.done.includes(k.slice(MILESTONE_MARK.length))) r.done.push(k.slice(MILESTONE_MARK.length));
    }
  }
  return r;
}

/** missions.counters key prefix of a milestone's items paid ('fpu:' + 'tier:id'): the load's retro grant pays once (src/systems/gearMarks.js). */
export { MILESTONE_ITEMS_MARK };

/**
 * The week's first freeplay cache Needle: 1 the first time this game week (missions.weekly, wiped by the
 * weekly reset), else 0. @returns {number}
 */
export function freeplayWeekNeedle(profile) {
  const m = (profile.missions ||= {});
  const w = (m.weekly ||= {});
  const key = FREEPLAY_REWARDS.weeklyNeedle.key;
  if (w[key]) return 0;
  w[key] = 1;
  return FREEPLAY_REWARDS.weeklyNeedle.count;
}

/** missions.counters key prefix of a paid freeplay milestone ('fpm:' + 'tier:id'). */
export const MILESTONE_MARK = 'fpm:';

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
 * @param {{ banked?: { goal: number, kills: object, encountered: string[] }|null, bestKey?: string }} [opts]
 *   bestKey: the stage-entry field holding the per-tier best (co-op `coopBestWave`; solo freeplay,
 *   src/systems/freeplayRewards.js, uses `freeplayBest` with these same payouts); waveCoins: coins per
 *   freeplay wave after the tier (default coinsPerWave × rewardMul; solo caps it per stage)
 * @returns {object} applyCoopResult's shape + `freeplay: { tier, waves, coins, caches, tomes, tokens,
 *   best, prevBest, newBest, milestones: [{ id, label, gems, title?, frame? }] }`
 */
export function applyCoopFreeplayEnd(profile, result, rng, { banked = null, bestKey = 'coopBestWave', waveCoins = null, now = new Date() } = {}) {
  const out = blankOut();
  const stage = STAGE_MAP[result?.stageId];
  const table = freeplayTable(result?.freeplay);
  if (!stage || stage.kind === 'event' || !table) return out;
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

  const coins = Math.round((waveCoins ?? R.coinsPerWave * (table.rewardMul ?? 1)) * waves);
  if (coins > 0) rewards.push({ id: 'coins', count: coins });
  const caches = Math.floor(waves / R.cacheEvery);
  for (let i = 0; i < caches; i++) rewards.push(...rollFreeplayCache(stage.id, result.difficulty, rng));
  // after the cache rolls, so the rng stream (and every drop) is what it was before the Tomes
  const tomes = freeplayCacheTomes(profile, caches, now);
  if (tomes > 0) rewards.push({ id: R.cacheTome.item, count: tomes });
  const needle = caches > 0 ? freeplayWeekNeedle(profile) : 0;
  if (needle > 0) rewards.push({ id: R.weeklyNeedle.item, count: needle });
  let bossKills = 0;
  for (const [id, n] of Object.entries(kills)) if (ENEMY_MAP[id]?.tier === 'boss') bossKills += n;
  const tokens = Math.min(R.tokenCap, bossKills);
  if (tokens > 0) rewards.push({ id: 'token_boss', count: tokens });

  // the per-tier best (absolute waves cleared: "147/15")
  const entry = ((profile.progress ||= { stages: {} }).stages ||= {})[stage.id] ||= { easy: false, normal: false, hard: false, nightmare: false, clears: 0 };
  const bests = (entry[bestKey] = isObj(entry[bestKey]) ? entry[bestKey] : {});
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
    ((profile.missions ||= {}).counters ||= {})[MILESTONE_MARK + key] = 1;
    const title = table.id === 'crimson' && m.crimsonTitle ? m.crimsonTitle : m.title || null;
    if (title && !rec.titles.includes(title)) rec.titles.push(title);
    if (m.frame && !rec.frames.includes(m.frame)) rec.frames.push(m.frame);
    if (m.gems > 0) rewards.push({ id: 'gems', count: m.gems });
    if (m.items) {
      rewards.push(...m.items);
      profile.missions.counters[MILESTONE_ITEMS_MARK + key] = 1;
    }
    milestones.push({ id: m.id, label: m.label, gems: m.gems, title, frame: m.frame || null, items: m.items ? m.items.map((r) => ({ ...r })) : [] });
  }

  out.rewards = addItems(profile, rewards);
  out.gemsEarned = out.rewards.reduce((a, r) => a + (r.id === 'gems' ? r.count : 0), 0);
  out.freeplay = { tier: table.id, tierName: table.name, goal, cleared, waves, coins, caches, tomes, needle, tokens, best: Math.max(prevBest, cleared), prevBest, newBest, milestones };
  return out;
}
