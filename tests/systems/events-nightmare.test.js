// Limited events: Nightmare on the Halloween stages (owner, Oct 20: "add nightmare modes for the event stages with
// the final one being really hard"; docs/specs/HALLOWEEN_2026.md "Nightmare"). NM-1 data, NM-2 the unlock gate,
// NM-3 a Nightmare win, NM-4 sweeps, NM-5 the one-time missions, NM-6 a stale v0.1.38 tab's round trip of the
// Nightmare marks, NM-7 a stale v0.1.38 tab that mails the end-of-event letter first. Fixed UTC instants, so any TZ works.
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import {
  readEpisode, eventState, peekState, eventDifficultyStatus, missionRows, claimEventMission, cleanEvents, settleEvents,
} from '../../src/systems/events.js';
import { claimMail } from '../../src/systems/mail.js';
import { applyBattleResult, sweep, canSweep, rollStageDrops, eventDifficultyOk } from '../../src/systems/rewards.js';
import { parseBattleParams } from '../../src/ui/battle/setup.js';
import { EVENT_MAP } from '../../src/data/events/index.js';
import { validateEvent } from '../../src/data/events/build.js';
import { eventBattleStage } from '../../src/data/events/wire.js';
import { STAGE_MAP } from '../../src/data/stages.js';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../../src/data/types.js';
import { createRng } from '../../src/core/rng.js';
import { itemCount } from '../../src/systems/inventory.js';

const EV = EVENT_MAP['halloween-2026'];
const CANDY = 'evt_halloween_candy';
const T = (iso) => Date.parse(iso);
const MID = T('2026-10-25T18:00:00Z'); // Sun Oct 25 13:00 CDT
const NEXT_DAY = MID + 24 * 3600 * 1000; // the next game day: 10 more event sweeps (EVENT_SWEEPS_PER_DAY)
const END = T('2026-11-02T01:00:00Z'); // Nov 1, 7 PM CST: the operations close
const XEND = T('2026-11-09T01:00:00Z'); // Nov 8, 7 PM CST: the exchange closes
const OPS = ['ev-halloween-1', 'ev-halloween-2', 'ev-halloween-3', 'ev-halloween-4'];
const NM_MISSIONS = ['hw_t_nm1', 'hw_t_nm2', 'hw_t_nm3', 'hw_t_nm4', 'hw_t_boss_nm', 'hw_t_nm_clear15'];

function joined() {
  const p = createProfile();
  for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5']) p.progress.stages[id] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
  return p;
}
const win = (stageId, difficulty = 'normal', kills = { slime_green: 40 }) => ({ stageId, difficulty, won: true, wave: 20, wavesCleared: 20, livesLeft: 1, encountered: Object.keys(kills), kills, stats: {} });
const play = (p, stageId, difficulty, at = MID) => applyBattleResult(p, win(stageId, difficulty), createRng(7), { now: new Date(at), startedAt: at });
/** Ops 1-4 cleared on Normal, Episodes 1-2 read: the boss is open (its Nightmare is not). */
function atTheBoss() {
  const p = joined();
  readEpisode(p, EV.id, 'ev.halloween.01', MID);
  play(p, 'ev-halloween-1', 'normal');
  play(p, 'ev-halloween-2', 'normal');
  readEpisode(p, EV.id, 'ev.halloween.02', MID);
  play(p, 'ev-halloween-3', 'normal');
  play(p, 'ev-halloween-4', 'normal');
  return p;
}
const candyOf = (r) => r.rewards.filter((x) => x.id === CANDY).reduce((a, x) => a + x.count, 0);
const progress = (p, id, at = MID) => missionRows(p, EV, at).total.find((m) => m.id === id);

describe('NM-1 the data', () => {
  it('operations: Normal / Nightmare, Nightmare after the Normal medal; the boss: Normal / Hard / Nightmare after Hard', () => {
    expect(validateEvent(EV)).toEqual([]);
    for (const id of OPS) {
      expect(STAGE_MAP[id].difficulties).toEqual(['normal', 'nightmare']);
      expect(STAGE_MAP[id].unlockAfter).toEqual({ nightmare: 'normal' });
      expect(eventBattleStage(id, 'nightmare')).toBe(null); // plain Nightmare on the op's own waves
    }
    const boss = STAGE_MAP['ev-halloween-boss'];
    expect(boss.difficulties).toEqual(['normal', 'hard', 'nightmare']);
    expect(boss.unlockAfter).toEqual({ nightmare: 'hard' });
    // Nightmare is the campaign's (no new difficulty rules)
    expect(DIFFICULTIES.nightmare).toMatchObject({ hpMul: 1.75, speedMul: 1.15, cashMul: 0.9, costMul: 1.2, lives: 1, medal: 'sakura', firstClearGems: 100, noIncome: true });
  });

  it('candy per win: an operation\'s Nightmare pays twice its Normal; the boss 150 / 220 / 500', () => {
    // (an entry with a difficulty rolls at that difficulty or harder, src/systems/rewards.js rollStageDrops)
    const at = (d) => DIFFICULTY_ORDER.indexOf(d);
    const per = (id, d) => STAGE_MAP[id].drops.filter((x) => x.item === CANDY && (!x.difficulty || at(x.difficulty) <= at(d))).reduce((a, x) => a + x.min, 0);
    expect(OPS.map((id) => [per(id, 'normal'), per(id, 'nightmare')])).toEqual([[60, 120], [70, 140], [80, 160], [90, 180]]);
    expect(['normal', 'hard', 'nightmare'].map((d) => per('ev-halloween-boss', d))).toEqual([150, 220, 500]);
    // and what the roll gives (candy rolls are certain)
    expect(rollStageDrops('ev-halloween-4', 'nightmare', createRng(1)).find((x) => x.id === CANDY).count).toBe(180);
    expect(rollStageDrops('ev-halloween-boss', 'nightmare', createRng(1)).find((x) => x.id === CANDY).count).toBe(500);
    expect(rollStageDrops('ev-halloween-boss', 'hard', createRng(1)).find((x) => x.id === CANDY).count).toBe(220);
  });

  it('the boss\'s Nightmare plays its own stage: "Lantern Night Never Ends", 20 waves, chapter-8 coins, HP ×12, two Golems', () => {
    const v = eventBattleStage('ev-halloween-boss', 'nightmare');
    const like = STAGE_MAP['8-5'];
    expect(v.id).toBe('ev-halloween-boss');
    expect(v.variant).toMatchObject({ difficulty: 'nightmare', name: 'Lantern Night Never Ends' });
    expect(v).toMatchObject({ waves: 20, hpScale: 12, cashScale: like.cashScale, startCash: like.startCash, kind: 'event', boss: true });
    expect(v.waveGen.fixed.find((f) => f.wave === 20)).toEqual({ wave: 20, enemy: 'construct_gourdlight', count: 2, spacing: 8, delay: 6 });
    expect(v.drops).toBe(STAGE_MAP['ev-halloween-boss'].drops); // rewards stay the stage's own
    expect(Object.isFrozen(v)).toBe(true);
    expect(eventBattleStage('ev-halloween-boss', 'nightmare')).toBe(v); // cached
    expect(eventBattleStage('ev-halloween-boss', 'hard')).toBe(null);
    expect(eventBattleStage('1-1', 'nightmare')).toBe(null);
    // the base stage (Normal / Hard) is untouched
    expect(STAGE_MAP['ev-halloween-boss'].waves).toBe(15);
  });
});

describe('NM-2 the unlock gate', () => {
  it('an operation\'s Nightmare opens after its Normal medal; the boss\'s after its Hard medal, not its Normal one', () => {
    const p = joined();
    expect(eventDifficultyStatus(p, 'ev-halloween-1', 'nightmare')).toMatchObject({ ok: false, reason: 'medal', needs: 'normal', text: 'Clear Normal first' });
    expect(eventDifficultyStatus(p, 'ev-halloween-1', 'normal').ok).toBe(true);
    expect(eventDifficultyStatus(p, 'ev-halloween-1', 'hard')).toMatchObject({ ok: false, reason: 'difficulty' });
    const q = atTheBoss();
    expect(eventDifficultyStatus(q, 'ev-halloween-1', 'nightmare').ok).toBe(true);
    play(q, 'ev-halloween-boss', 'normal');
    expect(eventDifficultyStatus(q, 'ev-halloween-boss', 'nightmare')).toMatchObject({ ok: false, needs: 'hard', text: 'Clear Hard first' });
    play(q, 'ev-halloween-boss', 'hard');
    expect(eventDifficultyStatus(q, 'ev-halloween-boss', 'nightmare').ok).toBe(true);
    expect(eventDifficultyStatus(q, '1-1', 'nightmare').ok).toBe(true); // campaign stages: never gated here
  });

  it('a locked Nightmare reached by a link plays as practice: no medal, gems, candy, first clear or mission progress', () => {
    const p = atTheBoss();
    play(p, 'ev-halloween-boss', 'normal');
    expect(parseBattleParams({ stage: 'ev-halloween-boss', difficulty: 'nightmare' }, p)).toMatchObject({
      difficulty: 'nightmare', practice: true,
      practiceNote: 'Practice run: Nightmare opens after a Hard clear, so nothing from this battle is saved.', // the HUD line (the stage is open)
    });
    expect(parseBattleParams({ stage: 'ev-halloween-boss', difficulty: 'hard' }, p).practiceNote).toBeUndefined();
    const gems = p.currencies.gems;
    const candy = itemCount(p, CANDY);
    const before = JSON.stringify(eventState(p, EV.id).total.progress);
    const r = play(p, 'ev-halloween-boss', 'nightmare');
    expect(r.practice).toBe(true);
    expect(r.note).toMatch(/Nightmare opens here after a Hard clear/);
    expect(r.rewards).toEqual([]);
    expect(p.progress.stages['ev-halloween-boss'].nightmare).toBe(false);
    expect(p.currencies.gems).toBe(gems);
    expect(itemCount(p, CANDY)).toBe(candy);
    expect(JSON.stringify(eventState(p, EV.id).total.progress)).toBe(before);
    // an operation's Nightmare before its Normal clear: the same
    const q = joined();
    readEpisode(q, EV.id, 'ev.halloween.01', MID);
    expect(parseBattleParams({ stage: 'ev-halloween-1', difficulty: 'nightmare' }, q).practiceNote).toMatch(/^Practice run: Nightmare opens after a Normal clear/);
    expect(play(q, 'ev-halloween-1', 'nightmare').practice).toBe(true);
    expect(q.progress.stages['ev-halloween-1']).toBeUndefined();
    // a stage still locked on the map keeps the HUD's own line
    expect(parseBattleParams({ stage: 'ev-halloween-4', difficulty: 'nightmare' }, q)).toMatchObject({ practice: true });
    expect(parseBattleParams({ stage: 'ev-halloween-4', difficulty: 'nightmare' }, q).practiceNote).toBeUndefined();
  });
});

describe('NM-3 a Nightmare win', () => {
  it('an operation: the Sakura medal and its 100 gems once, twice the candy, "Night Shift" done; no second first clear', () => {
    const p = atTheBoss();
    const gems = p.currencies.gems;
    const r = play(p, 'ev-halloween-4', 'nightmare');
    expect(r).toMatchObject({ practice: false, firstClear: false, newMedal: true, medal: 'sakura' });
    expect(p.currencies.gems - gems).toBe(100);
    expect(candyOf(r)).toBe(180);
    expect(progress(p, 'hw_t_nm4')).toMatchObject({ progress: 1, done: true });
    expect(progress(p, 'hw_t_nm1').progress).toBe(0);
    expect(progress(p, 'hw_t_nm_clear15').progress).toBe(1);
    // again: no medal gems, the same candy, the mission stays at its goal
    const again = play(p, 'ev-halloween-4', 'nightmare');
    expect(again.newMedal).toBe(false);
    expect(again.rewards.some((x) => x.id === 'gems')).toBe(false);
    expect(candyOf(again)).toBe(180);
    expect(progress(p, 'hw_t_nm4').progress).toBe(1);
    expect(progress(p, 'hw_t_nm_clear15').progress).toBe(2);
    // a Normal win never counts for the Nightmare missions
    play(p, 'ev-halloween-4', 'normal');
    expect(progress(p, 'hw_t_nm_clear15').progress).toBe(2);
  });

  it('the boss: 500 candy, the Sakura medal, "Lights Out (Nightmare)" — the Hard mission is a different one', () => {
    const p = atTheBoss();
    play(p, 'ev-halloween-boss', 'normal');
    play(p, 'ev-halloween-boss', 'hard');
    expect(progress(p, 'hw_t_boss_nm').progress).toBe(0);
    const r = play(p, 'ev-halloween-boss', 'nightmare');
    expect(r).toMatchObject({ practice: false, newMedal: true, medal: 'sakura' });
    expect(candyOf(r)).toBe(500);
    expect(progress(p, 'hw_t_boss_nm')).toMatchObject({ done: true, claimable: true });
    const c = itemCount(p, CANDY);
    const got = claimEventMission(p, EV.id, 'hw_t_boss_nm', MID);
    expect(got.ok).toBe(true);
    expect(itemCount(p, CANDY) - c).toBe(1000);
    expect(itemCount(p, 'gearbox_mythic')).toBe(1);
    expect(claimEventMission(p, EV.id, 'hw_t_boss_nm', MID).error).toBe('claimed');
  });
});

describe('NM-4 sweeps', () => {
  it('Nightmare sweeps open after that operation\'s Nightmare medal; 10 a tap at twice the candy; the boss never', () => {
    const p = atTheBoss();
    const at = new Date(MID);
    expect(canSweep(p, 'ev-halloween-4', MID)).toBe(true);
    expect(sweep(p, 'ev-halloween-4', 'nightmare', 10, createRng(3), { now: at }).error).toBe('difficulty');
    const normal = sweep(p, 'ev-halloween-4', 'normal', 10, createRng(3), { now: at });
    expect(normal.ok).toBe(true);
    expect(normal.rewards.find((x) => x.id === CANDY).count).toBe(900);
    expect(progress(p, 'hw_t_nm_clear15').progress).toBe(0); // Normal sweeps are not Nightmare clears
    play(p, 'ev-halloween-4', 'nightmare');
    const nm = sweep(p, 'ev-halloween-4', 'nightmare', 10, createRng(3), { now: new Date(NEXT_DAY) }); // today's 10 are spent
    expect(nm.ok).toBe(true);
    expect(nm.runs).toHaveLength(10);
    expect(nm.rewards.find((x) => x.id === CANDY).count).toBe(1800);
    expect(progress(p, 'hw_t_nm_clear15').progress).toBe(11); // the win + 10 sweeps
    expect(p.progress.stages['ev-halloween-4']).toMatchObject({ normal: true, nightmare: true }); // sweeps add no medal
    // another operation's Nightmare medal opens only its own Nightmare sweeps
    expect(sweep(p, 'ev-halloween-3', 'nightmare', 1, createRng(3), { now: at }).error).toBe('difficulty');
    // the boss never sweeps, on any difficulty
    play(p, 'ev-halloween-boss', 'normal');
    play(p, 'ev-halloween-boss', 'hard');
    play(p, 'ev-halloween-boss', 'nightmare');
    expect(canSweep(p, 'ev-halloween-boss', MID)).toBe(false);
    for (const d of ['normal', 'hard', 'nightmare']) expect(sweep(p, 'ev-halloween-boss', d, 1, createRng(3), { now: at }).ok).toBe(false);
    // and nothing sweeps once the operations are over
    expect(sweep(p, 'ev-halloween-4', 'nightmare', 1, createRng(3), { now: new Date(END + 1) }).error).toBe('event');
  });
});

describe('NM-5 the one-time Nightmare missions', () => {
  it('five clears, the boss and Sleepless Patrol: 2,300 candy, one mythic gear box, one mythic book, no gems', () => {
    const nm = EV.missions.total.filter((m) => NM_MISSIONS.includes(m.id));
    expect(nm.map((m) => m.id)).toEqual(NM_MISSIONS);
    expect(nm.every((m) => m.kind === 'total')).toBe(true);
    expect(EV.missions.daily.map((m) => m.id)).toEqual(['hw_d_login', 'hw_d_clear3', 'hw_d_kill']); // no new dailies
    const sum = (id) => nm.flatMap((m) => m.rewards).filter((r) => r.id === id).reduce((a, r) => a + r.count, 0);
    expect(sum(CANDY)).toBe(2300);
    expect(sum('gems')).toBe(0);
    expect(sum('gearbox_mythic')).toBe(1);
    expect(sum('book_mythic')).toBe(1);
    expect(nm.slice(0, 4).map((m) => [m.stage, m.difficulty, m.rewards[0].count])).toEqual(OPS.map((id, i) => [id, 'nightmare', [150, 200, 250, 300][i]]));
  });

  it('Sleepless Patrol counts Nightmare wins and sweeps up to 15, then claims once', () => {
    const p = atTheBoss();
    play(p, 'ev-halloween-1', 'nightmare');
    sweep(p, 'ev-halloween-1', 'nightmare', 10, createRng(5), { now: new Date(MID) });
    sweep(p, 'ev-halloween-1', 'nightmare', 10, createRng(5), { now: new Date(NEXT_DAY) });
    expect(progress(p, 'hw_t_nm_clear15')).toMatchObject({ progress: 15, done: true });
    const c = itemCount(p, CANDY);
    expect(claimEventMission(p, EV.id, 'hw_t_nm_clear15', MID).ok).toBe(true);
    expect(itemCount(p, CANDY) - c).toBe(400);
    expect(itemCount(p, 'book_mythic')).toBe(1);
  });
});

// v0.1.38, the live build: these are the parts of it a stale tab runs on a save the new build wrote (copied from
// 26c0de1, src/data/events/halloween.js + src/systems/events.js cleanEvents + src/systems/rewards.js).
const V0138 = {
  difficulties: { 'ev-halloween-1': ['normal'], 'ev-halloween-2': ['normal'], 'ev-halloween-3': ['normal'], 'ev-halloween-4': ['normal'], 'ev-halloween-boss': ['normal', 'hard'] },
  totalMissions: ['hw_t_op1', 'hw_t_op2', 'hw_t_op3', 'hw_t_op4', 'hw_t_boss_n', 'hw_t_boss_h', 'hw_t_clear20', 'hw_t_read', 'hw_t_kill'],
  /** Its cleanEvents keeps only the mission ids it knows (progress and claims); counters and progress.stages stay word for word. */
  save(p) {
    const raw = JSON.parse(JSON.stringify(p));
    const st = raw.events.byId[EV.id];
    st.total.progress = Object.fromEntries(Object.entries(st.total.progress).filter(([k]) => this.totalMissions.includes(k)));
    st.total.claimed = st.total.claimed.filter((k) => this.totalMissions.includes(k));
    return raw;
  },
  /** Its eventDifficultyOk: a Nightmare battle or sweep there is practice / refused. */
  pays: (stageId, d) => eventDifficultyOk({ kind: 'event', difficulties: V0138.difficulties[stageId] }, d),
};

describe('NM-6 a stale v0.1.38 tab and the Nightmare marks', () => {
  it('v0.1.38 drops the new missions from the block; the next load here brings progress and claims back from the evp / evm marks', () => {
    const p = atTheBoss();
    play(p, 'ev-halloween-1', 'nightmare');
    play(p, 'ev-halloween-2', 'nightmare');
    expect(claimEventMission(p, EV.id, 'hw_t_nm1', MID).ok).toBe(true);
    const old = V0138.save(p);
    expect(old.events.byId[EV.id].total.progress.hw_t_nm1).toBeUndefined();
    expect(old.events.byId[EV.id].total.claimed).not.toContain('hw_t_nm1');
    // the marks it keeps (missions.counters is kept word for word by every build)
    expect(old.missions.counters['evp:halloween-2026:1:hw_t_nm2']).toBe(1);
    expect(old.missions.counters['evm:halloween-2026:1:hw_t_nm1']).toBe(1);
    // and every build's migrate keeps all four medal flags of any stage id
    expect(old.progress.stages['ev-halloween-1'].nightmare).toBe(true);
    const back = migrateProfile(old);
    expect(back.progress.stages['ev-halloween-1']).toMatchObject({ normal: true, nightmare: true });
    const st = peekState(back, EV.id);
    expect(st.total.claimed).toContain('hw_t_nm1');
    expect(st.total.progress).toMatchObject({ hw_t_nm1: 1, hw_t_nm2: 1, hw_t_nm_clear15: 2 });
    // nothing pays twice: the claimed one stays claimed, the open one claims once
    const c = itemCount(back, CANDY);
    expect(claimEventMission(back, EV.id, 'hw_t_nm1', MID).error).toBe('claimed');
    expect(claimEventMission(back, EV.id, 'hw_t_nm2', MID).ok).toBe(true);
    expect(claimEventMission(back, EV.id, 'hw_t_nm2', MID).error).toBe('claimed');
    expect(itemCount(back, CANDY) - c).toBe(200);
    // the Nightmare sweeps it earned stay open here
    expect(sweep(back, 'ev-halloween-1', 'nightmare', 1, createRng(9), { now: new Date(MID) }).ok).toBe(true);
  });

  it('a v0.1.38 tab can neither earn nor erase a Nightmare medal: its Nightmare runs and sweeps pay nothing', () => {
    for (const id of [...OPS, 'ev-halloween-boss']) expect(V0138.pays(id, 'nightmare')).toBe(false);
    expect(V0138.pays('ev-halloween-boss', 'hard')).toBe(true);
    // the medal map it writes back is the one it loaded
    const p = atTheBoss();
    play(p, 'ev-halloween-3', 'nightmare');
    const old = V0138.save(p);
    expect(migrateProfile(old).progress.stages['ev-halloween-3'].nightmare).toBe(true);
  });

  it('a block from before Nightmare (v0.1.38) loads unchanged: the new missions start at 0, nothing is claimed', () => {
    const p = atTheBoss();
    const raw = V0138.save(p);
    const st = cleanEvents(raw.events, raw.missions.counters, raw.mail).byId[EV.id];
    for (const id of NM_MISSIONS) {
      expect(st.total.progress[id]).toBeUndefined();
      expect(st.total.claimed).not.toContain(id);
    }
    expect(st.total.progress).toEqual(eventState(p, EV.id).total.progress);
  });
});

/**
 * v0.1.38 loading a save fresh and running its end-of-event settle. Its cleanEvents, and its settleEvents up to
 * the follow-up letter (which it doesn't have: it skips the event once its letter id is delivered), are this
 * build's code with its nine one-time missions, so this runs them with that list (26c0de1).
 */
function v0138Settle(save, at) {
  const all = EV.missions.total;
  EV.missions.total = all.filter((m) => V0138.totalMissions.includes(m.id));
  try {
    const p = migrateProfile(V0138.save(save));
    const out = settleEvents(p, at);
    return { save: JSON.parse(JSON.stringify(p)), letters: out.letters, settled: out.settled };
  } finally {
    EV.missions.total = all;
  }
}
/** Ops 1-4 cleared on Normal (their missions unclaimed), Op 1's Nightmare won and swept 14 times: Night Shift and
 * Sleepless Patrol done, nothing claimed. */
function nightmareUnclaimed() {
  const p = atTheBoss();
  play(p, 'ev-halloween-1', 'nightmare');
  sweep(p, 'ev-halloween-1', 'nightmare', 10, createRng(5), { now: new Date(MID) });
  sweep(p, 'ev-halloween-1', 'nightmare', 4, createRng(5), { now: new Date(NEXT_DAY) });
  const open = missionRows(p, EV, MID).total.filter((m) => m.done && !m.claimed).map((m) => m.id);
  expect(open).toEqual(['hw_t_op1', 'hw_t_op2', 'hw_t_op3', 'hw_t_op4', 'hw_t_nm1', 'hw_t_nm_clear15']);
  return p;
}
const FIRST = 'ev:halloween-2026:1:unclaimed';
const FOLLOW = 'ev:halloween-2026:1:unclaimed:2';
const load = (save) => migrateProfile(JSON.parse(JSON.stringify(save)));

describe('NM-7 a stale v0.1.38 tab mails the end-of-event letter first', () => {
  it('its letter has only the missions it knows; the next load here mails the Nightmare ones once, in a follow-up', () => {
    const p = nightmareUnclaimed();
    const old = v0138Settle(p, T('2026-11-02T03:00:00Z'));
    expect(old.letters.map((l) => [l.id, l.rewards])).toEqual([[FIRST, [{ id: CANDY, count: 200 }]]]);
    expect(old.save.mail.delivered).toContain(FIRST);
    const back = load(old.save);
    expect(missionRows(back, EV, END - 1).total.filter((m) => m.done && !m.claimed).map((m) => m.id)).toEqual(['hw_t_nm1', 'hw_t_nm_clear15']);
    const { letters } = settleEvents(back, T('2026-11-02T05:00:00Z'));
    expect(letters.map((l) => l.id)).toEqual([FOLLOW]);
    expect(letters[0].rewards).toEqual([{ id: CANDY, count: 550 }, { id: 'book_mythic', count: 1 }]);
    expect(letters[0].expiresAt).toBe(XEND); // it holds candy: it expires with the exchange, like the first one
    expect(missionRows(back, EV, END - 1).total.every((m) => !m.done || m.claimed)).toBe(true);
    expect(back.missions.counters['evm:halloween-2026:1:hw_t_nm_clear15']).toBe(1);
    // once: again here, through v0.1.38 again (it drops the claims from the block, the evm marks bring them back), here again
    expect(settleEvents(back, T('2026-11-02T06:00:00Z')).letters).toEqual([]);
    const again = v0138Settle(back, T('2026-11-03T03:00:00Z'));
    expect(again.letters).toEqual([]);
    expect(settleEvents(load(again.save), T('2026-11-03T05:00:00Z')).letters).toEqual([]);
    // the follow-up claims once
    const c = itemCount(back, CANDY);
    expect(claimMail(back, FOLLOW, T('2026-11-02T07:00:00Z')).ok).toBe(true);
    expect(itemCount(back, CANDY) - c).toBe(550);
    expect(itemCount(back, 'book_mythic')).toBe(1);
    expect(claimMail(back, FOLLOW, T('2026-11-02T07:00:00Z')).error).toBe('claimed');
    expect(itemCount(back, CANDY) - c).toBe(550);
  });

  it('first back here after the exchange closed: the follow-up has no candy and no expiry; its candy joins the leftover coins', () => {
    const p = nightmareUnclaimed();
    const held = itemCount(p, CANDY);
    const old = v0138Settle(p, T('2026-11-02T03:00:00Z')); // v0.1.38's letter (200 candy) is never opened
    const back = load(old.save);
    const { letters, settled } = settleEvents(back, XEND + 3600000);
    expect(settled).toEqual([EV.id]);
    const follow = letters.find((l) => l.id === FOLLOW);
    expect(follow.rewards).toEqual([{ id: 'book_mythic', count: 1 }]);
    expect(follow.expiresAt).toBe(null);
    const leftover = letters.find((l) => l.id === 'ev:halloween-2026:1:leftover');
    expect(leftover.rewards).toEqual([{ id: 'coins', count: (held + 550) * 50 }]);
    expect(settleEvents(back, XEND + 7200000).letters).toEqual([]);
    expect(settleEvents(load(v0138Settle(back, XEND + 9000000).save), XEND + 10000000).letters).toEqual([]);
  });

  it('this build first: one letter with everything; v0.1.38 and this build after it mail nothing more', () => {
    const p = nightmareUnclaimed();
    const { letters } = settleEvents(p, T('2026-11-02T03:00:00Z'));
    expect(letters.map((l) => [l.id, l.rewards])).toEqual([[FIRST, [{ id: CANDY, count: 750 }, { id: 'book_mythic', count: 1 }]]]);
    const old = v0138Settle(p, T('2026-11-02T05:00:00Z'));
    expect(old.letters).toEqual([]);
    expect(settleEvents(load(old.save), T('2026-11-02T06:00:00Z')).letters).toEqual([]);
  });
});
