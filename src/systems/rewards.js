// Battle rewards: stage drops, medals, first clears, unlocks, bestiary and sweeps
// (owner: systems). See CONTRACTS.md §5.

import { creditLimitBreak, LB_REWARD } from './limitBreak.js';
import { supportAllowed } from './friendSupport.js';
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
import { hashString, createRng } from '../core/rng.js';
import { campaignClears, SANDBOX_UNLOCK_CLEARS, sandboxOutcome } from './sandbox.js';
import { LEGACY_JOIN_STAGES, JOIN_PREFIX } from './catchUpJoins.js';
import { eventRunGate, eventAfterBattle, eventStageStatus, eventDifficultyStatus, trackEvent, eventSweepsLeft, useEventSweeps } from './events.js';

/** Coin drops scale with difficulty (harder = richer). */
export const DIFFICULTY_COIN_MUL = { easy: 0.8, normal: 1, hard: 1.25, nightmare: 1.5 };
/** Max sweeps per call. */
export const MAX_SWEEPS = 10;

/** Gems per mode ribbon by difficulty (owner question Q1: 0 in v1; switching on needs a SAVE_VERSION bump). */
export const MODE_RIBBON_GEMS = Object.freeze({ easy: 0, normal: 0, hard: 0, nightmare: 0 });

const diffIndex = (d) => Math.max(0, DIFFICULTY_ORDER.indexOf(d));

/**
 * The gems a stage's first medal on a difficulty pays: DIFFICULTIES[d].firstClearGems (20 / 40 / 60 / 100) × the
 * stage's `medalGemMul` (Act II: 0.5 → 10 / 20 / 30 / 50), rounded. Stage prep shows the same number.
 * @param {object} stage StageDef
 * @param {string} difficulty
 * @returns {number}
 */
export function medalGems(stage, difficulty) {
  const base = DIFFICULTIES[difficulty]?.firstClearGems || 0;
  const mul = Number.isFinite(stage?.medalGemMul) && stage.medalGemMul >= 0 ? stage.medalGemMul : 1;
  return Math.round(base * mul);
}

/** [events] An event stage pays only on its own `difficulties`; every other stage on all four (a locked one: eventDifficultyStatus). */
export function eventDifficultyOk(stage, difficulty) {
  return stage?.kind !== 'event' || !Array.isArray(stage.difficulties) || stage.difficulties.includes(difficulty);
}

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

/**
 * Celestial bad-luck counter (gear-awaken R15, §6.4): each solo Total Assault run on Hard or Nightmare and
 * each Workshop Yard III run on Nightmare (sweeps too) that drops no Legendary piece adds 1 to `pity:cel`;
 * once it reached 40, the next such run adds a Celestial (Legendary) piece and the count starts over. Any
 * Legendary piece resets it. Its own rng (`cel|<createdAt>|<n>`), so no reward draw shifts.
 */
export const CELESTIAL_PITY = 40;
export const CELESTIAL_MARK = 'pity:cel';
export function celestialRun(profile, stageId, difficulty, gear) {
  const stage = STAGE_MAP[stageId];
  const d = diffIndex(difficulty);
  const counts = (stage?.kind === 'boss' && d >= diffIndex('hard')) || (stageId === 'res-gear-3' && difficulty === 'nightmare');
  if (!counts) return null;
  const c = ((profile.missions ||= {}).counters ||= {});
  if (gear.some((g) => g.rarity === 'legendary')) {
    c[CELESTIAL_MARK] = 0;
    return null;
  }
  const n = Math.max(0, Math.floor(c[CELESTIAL_MARK] || 0));
  if (n < CELESTIAL_PITY) {
    c[CELESTIAL_MARK] = n + 1;
    return null;
  }
  c[CELESTIAL_MARK] = 0;
  const seq = ((profile.seq ||= { gear: 0 }).gear || 0) + 1;
  const g = rollGear(createRng(`cel|${profile.createdAt || 0}|${seq}`), { rarity: 'legendary' });
  return profile.gear[addGear(profile, g, { club: 'random' })];
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
 * - win: medal for the difficulty, first-clear gems per difficulty (medalGems: DIFFICULTIES.firstClearGems × the
 *   stage's medalGemMul),
 *   stage.firstClear on the very first clear, free unit unlocks, drop rolls
 * - loss: a small coin consolation (40 per wave cleared)
 * - stats, kills and mission tracking (battleWin/battleWinHard/kill/bossKill) are handled here
 * - practice run (the stage is still locked on the map, see isPracticeRun): the profile is not
 *   touched at all and the result comes back with `practice: true`
 * - sandbox run (`result.sandbox`): the profile is not touched at all (`sandbox: true` comes back)
 * - `sandboxUnlocked` is true on the one result whose clear opened Sandbox (the 7th campaign clear)
 * - Friend Support run (`result.support`, BANNERS §E.1): drops, sightings, mission ticks and a first clear on
 *   Easy or Normal (its medal opens the next stage) pay as usual; a Hard / Nightmare medal (sweeps), mode ribbons,
 *   clears, bestiary discoveries and kills, wins, the achievement counters and Limit Break credit never do. On a
 *   battle that takes no Support Student (Titan Trials, Total Assault, events …) it is practice
 * @param {object} profile
 * @param {{ stageId, difficulty, won, wave, wavesCleared?, livesLeft, encountered, kills, stats }} result
 * @param {object} rng
 * @param {{ now?: Date, eventAt?: Date, startedAt?: number }} [opts] `eventAt`: when the run started (a saved run
 *   finished later gets the event bonus of the week it began in, and only that one, while it
 *   finishes within EVENT_GRACE_MS of that week's end: battleEventMul). `startedAt` (ms): when a
 *   limited-event battle started; its reward gate uses that, not the finish time (EVENT_SPEC §3.2)
 * @returns {{ firstClear: boolean, newMedal: boolean, medal: string|null, rewards: object[], gear: object[], unlockedUnits: string[], discovered: string[], gemsEarned: number, eventBonus: boolean, practice: boolean }}
 */
export function applyBattleResult(profile, result, rng, { now = new Date(), eventAt = null, startedAt = null } = {}) {
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
  // [events] a limited-event stage pays only when it was open (and its episode read) at the battle's start
  const gate = eventRunGate(profile, stage, startedAt ?? eventAt?.getTime?.() ?? now.getTime());
  if (!gate.ok) return { ...out, practice: true, note: gate.text };
  const difficulty = DIFFICULTIES[result.difficulty] ? result.difficulty : 'normal';
  // [events] and only on its own difficulties (an operation Normal / Nightmare, the boss Normal / Hard /
  // Nightmare): a hand-edited battle link on any other one is practice, never a medal or a first clear
  if (!eventDifficultyOk(stage, difficulty)) return { ...out, practice: true, note: `${DIFFICULTIES[difficulty].name} isn't offered on this event stage — this run was practice, no rewards.` };
  // [events] and a difficulty still locked there (Nightmare before its Normal / Hard medal) is practice too
  const locked = eventDifficultyStatus(profile, stage.id, difficulty);
  if (!locked.ok) return { ...out, practice: true, note: `${DIFFICULTIES[difficulty].name} opens here after a ${DIFFICULTIES[locked.needs].name} clear — this run was practice, no rewards.` };
  // [friend support] a borrowed girl only where stage prep offers her (campaign, Bounty, solo Freeplay)
  const support = !!result.support;
  if (support && !supportAllowed(profile, stage, { difficulty })) return { ...out, practice: true, support: true, note: 'A Support Student can\'t join this battle — this run was practice, no rewards.' };
  out.support = support;
  const tick = (event, n = 1) => track(profile, event, n, { lifetime: !support });
  const won = !!result.won;
  const encountered = [...new Set([...(result.encountered || []), ...Object.keys(result.kills || {})])];
  const kills = result.kills || {};

  // Bestiary.
  profile.bestiary ||= {};
  for (const id of encountered) {
    const b = (profile.bestiary[id] ||= { seen: false, discovered: false, kills: 0 });
    b.seen = true;
    if (won && !b.discovered && !support) {
      b.discovered = true;
      out.discovered.push(id);
    }
  }
  let totalKills = 0;
  let bossKills = 0;
  for (const [id, nRaw] of Object.entries(kills)) {
    const n = Math.max(0, Math.floor(Number(nRaw) || 0));
    if (!n) continue;
    if (!support) profile.bestiary[id].kills += n;
    totalKills += n;
    const tier = ENEMY_MAP[id]?.tier;
    if (tier === 'boss' || tier === 'miniboss') bossKills += n;
  }

  // Stats.
  profile.stats.battles += 1;
  if (!support) profile.stats.kills += totalKills;
  if (won && !support) profile.stats.wins += 1;

  const entry = stageEntry(profile, stage.id);
  const wavesCleared = Number.isFinite(result.wavesCleared) ? result.wavesCleared : Math.max(0, (result.wave || 0) - (won ? 0 : 1));
  if (!support && (stage.kind === 'challenge' || result.wavesCleared != null)) entry.bestWave = Math.max(entry.bestWave || 0, wavesCleared);

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
    out.newRibbon = !support && !entry.modes[key];
    out.ribbon = support ? null : key;
    if (!support) {
      entry.modes[key] = true;
      entry.clears += 1;
    }
    if (out.newRibbon && MODE_RIBBON_GEMS[difficulty] > 0) rewards.push({ id: 'gems', count: MODE_RIBBON_GEMS[difficulty] });
    // a saved mode run keeps its start week's event (battle save), like a Standard win below
    const mul = battleEventMul(stage.id, now, eventAt);
    out.eventBonus = mul > 1;
    const split = splitDrops(profile, rollStageDrops(stage.id, payAt, rng, { dropMul: mul }));
    rewards.push(...split.items);
    const pity = celestialRun(profile, stage.id, payAt, split.gear);
    out.gear = pity ? [...split.gear, pity] : split.gear;
    tick('battleWin', 1);
    if (diffIndex(payAt) >= diffIndex('hard')) tick('battleWinHard', 1);
    if (stage.kind === 'boss') tick('assaultClear', 1);
  } else if (won) {
    out.rewardDifficulty = difficulty;
    // [friend support] a support win earns the medal (and first clear) on Easy or Normal only
    const medalOk = !support || difficulty === 'easy' || difficulty === 'normal';
    const wasCleared = DIFFICULTY_ORDER.some((d) => entry[d]);
    out.firstClear = medalOk && !wasCleared;
    out.newMedal = medalOk && !entry[difficulty];
    out.medal = medalOk ? DIFFICULTIES[difficulty].medal : null;
    if (medalOk) entry[difficulty] = true;
    else out.note = `Friend Support run: ${DIFFICULTIES[difficulty].name} medals need your own team. Drops and missions still count.`;
    if (!support) entry.clears += 1;
    // Nightmare already has one heart: its Last Petal ribbon is the same battle, earned with the medal
    if (difficulty === 'nightmare' && stage.kind === 'campaign' && !support) {
      entry.modes ||= {};
      if (!entry.modes['nightmare:laststand']) out.newRibbon = true;
      entry.modes['nightmare:laststand'] = true;
    }
    if (out.newMedal && stage.kind !== 'challenge') rewards.push({ id: 'gems', count: medalGems(stage, difficulty) });
    if (out.firstClear) rewards.push(...(stage.firstClear || []));
    for (const unitId of medalOk ? stage.unlocks?.units || [] : []) {
      if (!isOwned(profile, unitId)) {
        grantUnit(profile, unitId);
        out.unlockedUnits.push(unitId);
      }
    }
    // [banners G6] Limit Break: a won trial (or its stand-in) makes an LR unit LR, once, with 300 gems + 1 ticket
    out.limitBreak = creditLimitBreak(profile, result, difficulty);
    for (let i = 0; i < out.limitBreak.length; i++) rewards.push(...LB_REWARD);
    // a girl whose join moved (Gate Arc: Yuzuha 4-2 → 1-7) still joins on a win of her old stage when she has not
    // met the squad yet: the same grant and results card; her 'join:' mark settles the lobby catch-up
    const counters = ((profile.missions ||= {}).counters ||= {});
    for (const [unitId, ids] of Object.entries(medalOk ? LEGACY_JOIN_STAGES : {})) { // (a support win on Hard+ joins no one)
      if (!ids.includes(stage.id) || isOwned(profile, unitId) || counters[JOIN_PREFIX + unitId] > 0) continue;
      grantUnit(profile, unitId);
      counters[JOIN_PREFIX + unitId] = 1;
      out.unlockedUnits.push(unitId);
    }
    const mul = battleEventMul(stage.id, now, eventAt);
    out.eventBonus = mul > 1;
    const drops = rollStageDrops(stage.id, difficulty, rng, { dropMul: mul });
    const split = splitDrops(profile, drops);
    rewards.push(...split.items);
    const pity = celestialRun(profile, stage.id, difficulty, split.gear);
    out.gear = pity ? [...split.gear, pity] : split.gear;
    tick('battleWin', 1);
    if (diffIndex(difficulty) >= diffIndex('hard')) tick('battleWinHard', 1);
    if (stage.kind === 'boss') tick('assaultClear', 1); // Rainbow Hunt (gear-awaken §6.1)
  } else if (wavesCleared > 0) {
    rewards.push({ id: 'coins', count: 40 * wavesCleared });
  }
  if (totalKills) tick('kill', totalKills);
  if (bossKills) tick('bossKill', bossKills);
  if (!support) countSoloBattle(profile, result, { won, difficulty, eventBonus: out.eventBonus });

  out.sandboxUnlocked = clearsBefore < SANDBOX_UNLOCK_CLEARS && campaignClears(profile) >= SANDBOX_UNLOCK_CLEARS;
  if (stage.kind === 'event') Object.assign(out, eventAfterBattle(profile, stage, { won, firstClear: out.firstClear, newMedal: out.newMedal, difficulty, totalKills, now: now.getTime() }));
  out.rewards = addItems(profile, rewards);
  out.gemsEarned = out.rewards.reduce((a, r) => a + (r.id === 'gems' ? r.count : 0), 0);
  return out;
}

/**
 * Sweeping is unlocked once a stage is cleared on Hard or Nightmare (not for the endless challenge).
 * An event operation sweeps once cleared (on any difficulty up to its best medal: Nightmare after its
 * Nightmare medal), while the event is open; an event boss never.
 * @returns {boolean}
 */
export function canSweep(profile, stageId, now = Date.now()) {
  const stage = STAGE_MAP[stageId];
  if (!stage || stage.kind === 'challenge') return false;
  const m = stageMedals(profile, stageId);
  // [events] an event operation (never its boss) sweeps once cleared, while the event is open
  if (stage.kind === 'event') return !stage.boss && m.normal && eventStageStatus(profile, stageId, now).ok;
  return m.hard || m.nightmare;
}

/**
 * Instantly collect drops `times` times (max 10 per call) on a difficulty already cleared
 * (or easier). No medals, first clears or bestiary changes. [events] An event stage also spends the
 * event's daily sweeps (events.js eventSweepsLeft): a tap with fewer left sweeps only those, none left →
 * error 'limit'; `sweepsLeft` is what is left after it.
 * @returns {{ ok: boolean, error?: string, runs: object[][], rewards: object[], gear: object[], sweepsLeft?: number }}
 */
export function sweep(profile, stageId, difficulty, times, rng, { now = new Date() } = {}) {
  const evStage = STAGE_MAP[stageId]?.kind === 'event';
  const evId = evStage ? STAGE_MAP[stageId].event : null;
  if (evStage && !canSweep(profile, stageId, now.getTime())) return { ok: false, error: 'event', runs: [], rewards: [], gear: [] };
  if (!canSweep(profile, stageId, now.getTime())) return { ok: false, error: 'locked', runs: [], rewards: [], gear: [] };
  const d = DIFFICULTIES[difficulty] ? difficulty : 'hard';
  if (!eventDifficultyOk(STAGE_MAP[stageId], d) || !eventDifficultyStatus(profile, stageId, d).ok) return { ok: false, error: 'difficulty', runs: [], rewards: [], gear: [] };
  const m = stageMedals(profile, stageId);
  const best = Math.max(...DIFFICULTY_ORDER.map((x, i) => (m[x] ? i : -1)));
  if (diffIndex(d) > best) return { ok: false, error: 'difficulty', runs: [], rewards: [], gear: [] };
  let n = Math.max(1, Math.min(MAX_SWEEPS, Math.floor(times) || 1));
  if (evStage) {
    const { left } = eventSweepsLeft(profile, evId, now.getTime());
    if (left <= 0) return { ok: false, error: 'limit', runs: [], rewards: [], gear: [], sweepsLeft: 0 };
    n = Math.min(n, left);
  }
  const mul = eventMul(stageId, now);
  const runs = [];
  const allItems = [];
  const allGear = [];
  for (let i = 0; i < n; i++) {
    const split = splitDrops(profile, rollStageDrops(stageId, d, rng, { dropMul: mul }));
    const pity = celestialRun(profile, stageId, d, split.gear);
    if (pity) split.gear.push(pity);
    runs.push([...split.items, ...split.gear.map((g) => ({ id: `gearbox_${g.rarity}`, count: 1, gearUid: g.uid }))]);
    allItems.push(...split.items);
    allGear.push(...split.gear);
  }
  const rewards = addItems(profile, allItems);
  const entry = stageEntry(profile, stageId);
  entry.clears += n;
  track(profile, 'sweep', n);
  if (STAGE_MAP[stageId].kind === 'boss') track(profile, 'assaultClear', n);
  if (!evStage) return { ok: true, runs, rewards, gear: allGear };
  const { left } = useEventSweeps(profile, evId, n, now.getTime());
  trackEvent(profile, evId, 'eventClear', n, { now: now.getTime(), difficulty: d });
  return { ok: true, runs, rewards, gear: allGear, sweepsLeft: left };
}
