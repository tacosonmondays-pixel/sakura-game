// Limited events: the v0.1.38 review fixes (HW-1…HW-4). Fixed UTC instants, so any TZ works.
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import {
  readEpisode, eventState, peekState, markEventLogin, claimEventMission, buyEventOffer, trackEvent, settleEvents, loginRows,
} from '../../src/systems/events.js';
import { mailList } from '../../src/systems/mail.js';
import { applyBattleResult, sweep } from '../../src/systems/rewards.js';
import { parseBattleParams } from '../../src/ui/battle/setup.js';
import { EVENT_MAP } from '../../src/data/events/index.js';
import { STAGE_MAP } from '../../src/data/stages.js';
import { createRng } from '../../src/core/rng.js';

const EV = EVENT_MAP['halloween-2026'];
const CANDY = 'evt_halloween_candy';
const T = (iso) => Date.parse(iso);
const DAY = 24 * 3600 * 1000;
const MID = T('2026-10-25T18:00:00Z'); // Sun Oct 25 13:00 CDT
const XEND = T('2026-11-09T01:00:00Z');

/** A save that has cleared 1-5 (the event's unlock). */
function joined() {
  const p = createProfile();
  for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5']) p.progress.stages[id] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
  return p;
}
const win = (stageId, difficulty = 'normal', kills = { slime_green: 40 }) => ({ stageId, difficulty, won: true, wave: 15, wavesCleared: 15, livesLeft: 100, encountered: Object.keys(kills), kills, stats: {} });
const play = (p, stageId, difficulty, at = MID) => applyBattleResult(p, win(stageId, difficulty), createRng(7), { now: new Date(at), startedAt: at });

/** Ops 1-4 cleared on Normal, Episodes 1-2 read: the boss is open. */
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

describe('HW-1 an event stage plays and pays only on its own difficulties', () => {
  it('the stage data: operations Normal only, the boss Normal / Hard', () => {
    expect(STAGE_MAP['ev-halloween-1'].difficulties).toEqual(['normal']);
    expect(STAGE_MAP['ev-halloween-boss'].difficulties).toEqual(['normal', 'hard']);
  });

  it('parseBattleParams turns any other difficulty in a battle link into the stage\'s first', () => {
    const p = atTheBoss();
    expect(parseBattleParams({ stage: 'ev-halloween-boss', difficulty: 'easy' }, p).difficulty).toBe('normal');
    expect(parseBattleParams({ stage: 'ev-halloween-boss', difficulty: 'nightmare' }, p).difficulty).toBe('normal');
    expect(parseBattleParams({ stage: 'ev-halloween-boss', difficulty: 'hard' }, p).difficulty).toBe('hard');
    expect(parseBattleParams({ stage: 'ev-halloween-1', difficulty: 'nightmare' }, p).difficulty).toBe('normal');
    expect(parseBattleParams({ stage: 'ev-halloween-1', difficulty: 'easy' }, p).difficulty).toBe('normal');
    // campaign stages keep all four
    expect(parseBattleParams({ stage: '1-1', difficulty: 'easy' }, p).difficulty).toBe('easy');
  });

  it('a boss win on Easy is practice: no first clear, medal, gems, candy or Episode 3', () => {
    const p = atTheBoss();
    const gems = p.currencies.gems;
    const r = play(p, 'ev-halloween-boss', 'easy');
    expect(r.practice).toBe(true);
    expect(r.note).toMatch(/Easy isn't offered on this event stage/);
    expect(r.firstClear).toBe(false);
    expect(r.medal).toBe(null);
    expect(r.rewards).toEqual([]);
    expect(p.currencies.gems).toBe(gems);
    expect(p.progress.stages['ev-halloween-boss']).toBeUndefined();
    expect(r.event).toBeUndefined();
    // the real fight still pays as before
    const n = play(p, 'ev-halloween-boss', 'normal');
    expect(n.practice).toBe(false);
    expect(n.firstClear).toBe(true);
    expect(n.event.newEpisodes).toEqual(['ev.halloween.03']);
  });

  it('Easy / Hard / Nightmare on a Normal-only operation pay no medal gems', () => {
    const p = atTheBoss();
    const gems = p.currencies.gems;
    const progress = { ...eventState(p, EV.id).total.progress };
    for (const d of ['easy', 'hard', 'nightmare']) {
      const r = play(p, 'ev-halloween-1', d);
      expect(r.practice).toBe(true);
      expect(r.newMedal).toBe(false);
    }
    expect(p.currencies.gems).toBe(gems);
    expect(p.progress.stages['ev-halloween-1']).toMatchObject({ easy: false, normal: true, hard: false, nightmare: false });
    expect(eventState(p, EV.id).total.progress).toEqual(progress);
  });

  it('sweep refuses a difficulty the event stage does not offer', () => {
    const p = atTheBoss();
    expect(sweep(p, 'ev-halloween-1', 'easy', 2, createRng(2), { now: new Date(MID) }).error).toBe('difficulty');
    expect(sweep(p, 'ev-halloween-1', 'normal', 2, createRng(2), { now: new Date(MID) }).ok).toBe(true);
  });
});

/** What an older build (live v0.1.37) leaves of a v0.1.38 save: no profile.events, counters and mail kept. */
const dropBlock = (p) => {
  const raw = JSON.parse(JSON.stringify(p));
  delete raw.events;
  return migrateProfile(raw);
};

describe('HW-2 a dropped events block keeps stock limits, one-time claims, progress and login gifts', () => {
  function midEvent() {
    const p = atTheBoss();
    const D0 = T('2026-10-24T18:00:00Z');
    for (let d = 0; d < 4; d++) markEventLogin(p, D0 + d * DAY);
    const at = D0 + 3 * DAY;
    play(p, 'ev-halloween-boss', 'normal', at);
    play(p, 'ev-halloween-boss', 'hard', at);
    expect(claimEventMission(p, EV.id, 'hw_t_boss_h', at).ok).toBe(true);
    trackEvent(p, EV.id, 'eventKill', 1234, { now: at });
    p.items[CANDY] = 5000;
    expect(buyEventOffer(p, EV.id, 'hw_gems', 2, at).ok).toBe(true);
    expect(buyEventOffer(p, EV.id, 'hw_ticket', 2, at).ok).toBe(true);
    expect(buyEventOffer(p, EV.id, 'hw_title', 1, at).ok).toBe(true);
    expect(buyEventOffer(p, EV.id, 'hw_book_r', 3, at).ok).toBe(true);
    return { p, D0, at };
  }

  it('the block comes back from the shadows: bought, claimed, progress, login days', () => {
    const { p } = midEvent();
    const before = eventState(p, EV.id);
    const st = peekState(dropBlock(p), EV.id);
    expect(st.bought).toEqual(before.bought);
    expect(st.bought).toMatchObject({ hw_gems: 2, hw_ticket: 2, hw_title: 1, hw_book_r: 3 });
    expect(st.total.claimed).toEqual(['hw_t_boss_h']);
    expect(st.total.progress.hw_t_kill).toBe(before.total.progress.hw_t_kill);
    expect(st.total.progress).toEqual(before.total.progress);
    expect(st.login.days).toBe(4);
    expect(st.login.last).toBe(before.login.last);
    expect(st.owned).toEqual(['title:ev_halloween_2026']);
  });

  it('after the drop nothing pays twice: the Hard boss claim, sold-out offers', () => {
    const { p, at } = midEvent();
    const back = dropBlock(p);
    play(back, 'ev-halloween-boss', 'hard', at + 1000);
    const gems = back.currencies.gems;
    expect(claimEventMission(back, EV.id, 'hw_t_boss_h', at + 1000).error).toBe('claimed');
    back.items[CANDY] = 5000;
    expect(buyEventOffer(back, EV.id, 'hw_gems', 1, at + 1000).error).toBe('soldOut');
    expect(buyEventOffer(back, EV.id, 'hw_ticket', 1, at + 1000).error).toBe('soldOut');
    expect(buyEventOffer(back, EV.id, 'hw_book_r', 8, at + 1000).error).toBe('soldOut');
    expect(buyEventOffer(back, EV.id, 'hw_book_r', 7, at + 1000).ok).toBe(true);
    expect(back.currencies.gems).toBe(gems);
  });

  it('the login gifts carry on from the last one sent: day 5 sends gift 5, all nine arrive', () => {
    const { p, D0 } = midEvent();
    const back = dropBlock(p);
    expect(markEventLogin(back, D0 + 3 * DAY + 3600000).letters).toEqual([]); // the same game day: nothing new
    const ids = [];
    for (let d = 4; d < 9; d++) ids.push(...markEventLogin(back, D0 + d * DAY).letters.map((l) => l.id));
    expect(ids).toEqual([5, 6, 7, 8, 9].map((n) => `ev:halloween-2026:1:login:${n}`));
    expect(loginRows(back, EV).every((r) => r.got)).toBe(true);
    const inBox = mailList(back, D0 + 9 * DAY).map((l) => l.id).filter((id) => id.includes(':login:'));
    expect(inBox.length).toBe(9);
  });

  it('a block dropped in the same session (no reload) still sends the next gift, not an old id', () => {
    const { p, D0 } = midEvent();
    delete p.events;
    expect(markEventLogin(p, D0 + 4 * DAY).letters.map((l) => l.id)).toEqual(['ev:halloween-2026:1:login:5']);
  });

  it('settling removes the run\'s evb / evm / evp shadows and keeps the evs mark', () => {
    const { p } = midEvent();
    const keys = () => Object.keys(p.missions.counters).filter((k) => /^ev[bmp]:halloween-2026:1:/.test(k));
    expect(keys().length).toBeGreaterThan(0);
    settleEvents(p, XEND);
    expect(keys()).toEqual([]);
    expect(p.missions.counters['evs:halloween-2026:1']).toBe(1);
    expect(peekState(dropBlock(p), EV.id).settled).toBeTruthy();
  });
});
