// Limited events: lifecycle, gates, battles, missions, exchange, episodes, login gifts, save
// (EVENT_SPEC §7 ES-1…ES-11). Fixed UTC instants, so any TZ works.
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile, serializeProfile, deserializeProfile, SAVE_VERSION } from '../../src/systems/save.js';
import {
  eventWindow, eventPhase, featuredEvent, eventStageStatus, eventState, trackEvent, missionRows, claimEventMission,
  claimAllEventMissions, buyEventOffer, shopRows, episodeRows, readEpisode, markEventLogin, cleanEvents, eventCosmetics,
  loginRows,
} from '../../src/systems/events.js';
import { applyBattleResult, sweep, canSweep } from '../../src/systems/rewards.js';
import { EVENT_MAP } from '../../src/data/events/index.js';
import { createRng } from '../../src/core/rng.js';
import { itemCount } from '../../src/systems/inventory.js';

const EV = EVENT_MAP['halloween-2026'];
const CANDY = 'evt_halloween_candy';
const T = (iso) => Date.parse(iso);
const OPEN = T('2026-10-24T00:00:00Z');
const END = T('2026-11-02T01:00:00Z');
const XEND = T('2026-11-09T01:00:00Z');
const MID = T('2026-10-25T18:00:00Z'); // Sun Oct 25 13:00 CDT

/** A save that has cleared 1-5 (the event's unlock). */
function joined() {
  const p = createProfile();
  for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5']) p.progress.stages[id] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
  return p;
}
const win = (stageId, difficulty = 'normal', kills = { slime_green: 40 }) => ({ stageId, difficulty, won: true, wave: 15, livesLeft: 100, encountered: Object.keys(kills), kills, stats: {} });
const play = (p, stageId, at, opts = {}) => applyBattleResult(p, win(stageId, opts.difficulty, opts.kills), createRng(7), { now: new Date(at), startedAt: opts.startedAt ?? at });

describe('window and phases (ES-1, ES-2)', () => {
  it('the window instants on the 7 PM Central clock', () => {
    const w = eventWindow(EV);
    expect(new Date(w.startAt).toISOString()).toBe('2026-10-24T00:00:00.000Z');
    expect(new Date(w.endAt).toISOString()).toBe('2026-11-02T01:00:00.000Z');
    expect(new Date(w.exchangeEndAt).toISOString()).toBe('2026-11-09T01:00:00.000Z');
    expect(new Date(w.teaseAt).toISOString()).toBe('2026-10-21T00:00:00.000Z');
  });

  it('phases at every boundary ±1 ms', () => {
    const w = eventWindow(EV);
    expect(eventPhase(EV, w.teaseAt - 1)).toBe('hidden');
    expect(eventPhase(EV, w.teaseAt)).toBe('upcoming');
    expect(eventPhase(EV, w.startAt - 1)).toBe('upcoming');
    expect(eventPhase(EV, w.startAt)).toBe('active');
    expect(eventPhase(EV, w.endAt - 1)).toBe('active');
    expect(eventPhase(EV, w.endAt)).toBe('exchange');
    expect(eventPhase(EV, w.exchangeEndAt - 1)).toBe('exchange');
    expect(eventPhase(EV, w.exchangeEndAt)).toBe('ended');
    expect(eventPhase({ ...EV, draft: true }, MID)).toBe('hidden');
    expect(eventPhase({ ...EV, draft: true }, MID, null, { drafts: true })).toBe('active');
  });

  it('featuredEvent picks the active event', () => {
    expect(featuredEvent(createProfile(), MID)?.ev.id).toBe('halloween-2026');
    expect(featuredEvent(createProfile(), T('2026-10-20T00:00:00Z'))).toBe(null);
  });
});

describe('gates and battles (ES-3…ES-7)', () => {
  it('locked before 1-5; then the chain: episode, previous operation', () => {
    const fresh = createProfile();
    expect(eventStageStatus(fresh, 'ev-halloween-1', MID).reason).toBe('locked');
    const p = joined();
    expect(eventStageStatus(p, 'ev-halloween-1', MID).reason).toBe('episode');
    readEpisode(p, EV.id, 'ev.halloween.01', MID);
    expect(eventStageStatus(p, 'ev-halloween-1', MID).ok).toBe(true);
    expect(eventStageStatus(p, 'ev-halloween-2', MID).reason).toBe('previous');
    expect(eventStageStatus(p, 'ev-halloween-1', END).reason).toBe('closed');
  });

  it('a win pays candy, first clear once, medal gems and counts the missions; Episode 2 unlocks after Op 2', () => {
    const p = joined();
    readEpisode(p, EV.id, 'ev.halloween.01', MID);
    const before = itemCount(p, CANDY);
    const r1 = play(p, 'ev-halloween-1', MID);
    expect(r1.practice).toBe(false);
    expect(r1.firstClear).toBe(true);
    expect(r1.rewards.find((x) => x.id === CANDY).count).toBe(60 + 100);
    expect(r1.rewards.find((x) => x.id === 'gems').count).toBe(40);
    const r2 = play(p, 'ev-halloween-1', MID + 1000);
    expect(r2.firstClear).toBe(false);
    expect(r2.rewards.find((x) => x.id === CANDY).count).toBe(60);
    expect(itemCount(p, CANDY) - before).toBe(220);
    const rows = missionRows(p, EV, MID);
    expect(rows.daily.find((m) => m.id === 'hw_d_clear3').progress).toBe(2);
    expect(rows.daily.find((m) => m.id === 'hw_d_kill').progress).toBe(80);
    expect(rows.total.find((m) => m.id === 'hw_t_op1').done).toBe(true);
    const r3 = play(p, 'ev-halloween-2', MID + 2000);
    expect(r3.event.newEpisodes).toEqual(['ev.halloween.02']);
  });

  it('a loss gives the loss coins and no event progress', () => {
    const p = joined();
    readEpisode(p, EV.id, 'ev.halloween.01', MID);
    const r = applyBattleResult(p, { ...win('ev-halloween-1'), won: false, wave: 5 }, createRng(1), { now: new Date(MID), startedAt: MID });
    expect(r.rewards).toEqual([{ id: 'coins', count: 160 }]);
    expect(missionRows(p, EV, MID).daily.find((m) => m.id === 'hw_d_clear3').progress).toBe(0);
  });

  it('ES-5 the gate uses the start time: started 1 ms before the end pays, after it pays nothing', () => {
    const p = joined();
    readEpisode(p, EV.id, 'ev.halloween.01', MID);
    const ok = applyBattleResult(p, win('ev-halloween-1'), createRng(1), { now: new Date(END + 60000), startedAt: END - 1 });
    expect(ok.practice).toBe(false);
    expect(ok.rewards.some((x) => x.id === CANDY)).toBe(true);
    const late = applyBattleResult(p, win('ev-halloween-1'), createRng(1), { now: new Date(END + 60000), startedAt: END });
    expect(late.practice).toBe(true);
    expect(late.note).toMatch(/closed before this battle started/);
    // the episode gate: a deep link to Op 1 before reading Episode 1 records nothing
    const q = joined();
    const r = play(q, 'ev-halloween-1', MID);
    expect(r.practice).toBe(true);
    expect(q.progress.stages['ev-halloween-1']).toBeUndefined();
  });

  it('the boss: Normal and Hard pay their candy and count eventBoss per difficulty; boss first clear pays a ticket', () => {
    const p = joined();
    for (const e of ['ev.halloween.01']) readEpisode(p, EV.id, e, MID);
    play(p, 'ev-halloween-1', MID);
    play(p, 'ev-halloween-2', MID);
    readEpisode(p, EV.id, 'ev.halloween.02', MID);
    play(p, 'ev-halloween-3', MID);
    play(p, 'ev-halloween-4', MID);
    const n = play(p, 'ev-halloween-boss', MID, { kills: { construct_gourdlight: 1 } });
    expect(n.rewards.find((x) => x.id === CANDY).count).toBe(150 + 400);
    expect(n.rewards.find((x) => x.id === 'ticket_recruit').count).toBe(1);
    expect(n.event.newEpisodes).toEqual(['ev.halloween.03']);
    const h = play(p, 'ev-halloween-boss', MID, { difficulty: 'hard', kills: { construct_gourdlight: 1 } });
    expect(h.rewards.find((x) => x.id === CANDY).count).toBe(220);
    const rows = missionRows(p, EV, MID);
    expect(rows.total.find((m) => m.id === 'hw_t_boss_n').done).toBe(true);
    expect(rows.total.find((m) => m.id === 'hw_t_boss_h').done).toBe(true);
  });

  it('ES-7 operations sweep once cleared (boss never); after the end → error event; sweeps count', () => {
    const p = joined();
    readEpisode(p, EV.id, 'ev.halloween.01', MID);
    expect(canSweep(p, 'ev-halloween-1', MID)).toBe(false);
    play(p, 'ev-halloween-1', MID);
    expect(canSweep(p, 'ev-halloween-1', MID)).toBe(true);
    const s = sweep(p, 'ev-halloween-1', 'normal', 3, createRng(2), { now: new Date(MID) });
    expect(s.ok).toBe(true);
    expect(missionRows(p, EV, MID).daily.find((m) => m.id === 'hw_d_clear3').progress).toBe(3);
    expect(sweep(p, 'ev-halloween-1', 'normal', 1, createRng(2), { now: new Date(END) }).error).toBe('event');
    expect(canSweep(p, 'ev-halloween-boss', MID)).toBe(false);
  });
});

describe('missions, login gifts, exchange, episodes (ES-8, ES-9)', () => {
  it('dailies reset at 7 PM Central, never on a clock rolled back; login counts once a day', () => {
    const p = joined();
    markEventLogin(p, MID);
    markEventLogin(p, MID + 3600000);
    expect(missionRows(p, EV, MID).daily.find((m) => m.id === 'hw_d_login').progress).toBe(1);
    trackEvent(p, EV.id, 'eventKill', 10, { now: MID });
    const beforeReset = T('2026-10-25T23:59:59.999Z'); // 18:59:59 CDT
    expect(missionRows(p, EV, beforeReset).daily.find((m) => m.id === 'hw_d_kill').progress).toBe(10);
    const afterReset = T('2026-10-26T00:00:00Z');
    expect(missionRows(p, EV, afterReset).daily.find((m) => m.id === 'hw_d_kill').progress).toBe(0);
    trackEvent(p, EV.id, 'eventKill', 5, { now: afterReset });
    expect(eventState(p, EV.id).daily.day).toBe('2026-10-26');
    trackEvent(p, EV.id, 'eventKill', 5, { now: MID }); // device clock rolled back a day: no reset
    expect(eventState(p, EV.id).daily.day).toBe('2026-10-26');
    expect(eventState(p, EV.id).daily.progress.hw_d_kill).toBe(10);
  });

  it('claim and claim all; nothing claims after the end', () => {
    const p = joined();
    markEventLogin(p, MID);
    const c0 = itemCount(p, CANDY);
    expect(claimEventMission(p, EV.id, 'hw_d_clear3', MID).error).toBe('notDone');
    const all = claimAllEventMissions(p, EV.id, MID);
    expect(all.count).toBe(1);
    expect(itemCount(p, CANDY) - c0).toBe(30);
    expect(claimEventMission(p, EV.id, 'hw_d_login', MID).error).toBe('claimed');
    expect(claimEventMission(p, EV.id, 'hw_d_login', END).error).toBe('closed');
  });

  it('a login gift arrives in the Mailbox once per visited game day, in order, nine at most', () => {
    const p = joined();
    expect(markEventLogin(createProfile(), MID).letters).toEqual([]); // not unlocked: nothing
    expect(markEventLogin(p, OPEN).letters.map((l) => l.id)).toEqual(['ev:halloween-2026:1:login:1']);
    expect(markEventLogin(p, OPEN + 1000).letters).toEqual([]);
    const l2 = markEventLogin(p, MID + 7 * 24 * 3600000).letters[0]; // a week later: the next gift, not day 8's
    expect(l2.id).toBe('ev:halloween-2026:1:login:2');
    expect(l2.expiresAt).toBe(XEND);
    expect(loginRows(p, EV).filter((r) => r.got).length).toBe(2);
  });

  it('ES-9 the exchange: stock, funds checked first, cosmetics once, closed after the exchange', () => {
    const p = joined();
    p.items[CANDY] = 1000;
    expect(buyEventOffer(p, EV.id, 'hw_book_r', 2, MID).ok).toBe(true);
    expect(itemCount(p, CANDY)).toBe(920);
    expect(itemCount(p, 'book_rare')).toBe(5 + 10);
    expect(shopRows(p, EV, MID).find((o) => o.id === 'hw_book_r').left).toBe(8);
    expect(buyEventOffer(p, EV.id, 'hw_book_r', 9, MID).error).toBe('soldOut');
    expect(buyEventOffer(p, EV.id, 'hw_box_my', 1, MID).ok).toBe(true);
    expect(buyEventOffer(p, EV.id, 'hw_frame', 1, MID).error).toBe('funds');
    expect(itemCount(p, CANDY)).toBe(470);
    expect(buyEventOffer(p, EV.id, 'hw_title', 1, END + 1).ok).toBe(true); // exchange phase still sells
    expect(buyEventOffer(p, EV.id, 'hw_title', 1, END + 2).error).toBe('soldOut');
    expect(eventCosmetics(p).titles).toEqual(['ev_halloween_2026']);
    expect(buyEventOffer(p, EV.id, 'hw_notes', 1, XEND).error).toBe('closed');
  });

  it('episodes: first read pays once (skips count), replays nothing, locks in chain order', () => {
    const p = joined();
    expect(episodeRows(p, EV, MID).map((r) => r.state)).toEqual(['new', 'locked', 'locked']);
    const r = readEpisode(p, EV.id, 'ev.halloween.01', MID);
    expect(r.first).toBe(true);
    expect(r.rewards).toEqual([{ id: CANDY, count: 50 }]);
    expect(readEpisode(p, EV.id, 'ev.halloween.01', MID).rewards).toEqual([]);
    expect(readEpisode(p, EV.id, 'ev.halloween.02', MID).error).toBe('locked');
    expect(missionRows(p, EV, MID).total.find((m) => m.id === 'hw_t_read').progress).toBe(1);
  });
});

describe('save (ES-11)', () => {
  it('cleanEvents drops unknown events / missions / offers, clamps numbers, keeps settled; no SAVE_VERSION bump', () => {
    expect(SAVE_VERSION).toBe(2);
    const raw = { v: 1, byId: {
      nope: { run: 1 },
      'halloween-2026': { run: 1, read: ['ev.halloween.01', 'x'], bought: { hw_book_r: 3, zz: 4, hw_frag: -2 }, daily: { day: '2026-10-25', progress: { hw_d_kill: 12.7, bad: 3 }, claimed: ['hw_d_login', 'q'] }, total: { progress: { hw_t_kill: '40' }, claimed: [] }, owned: ['title:ev_halloween_2026', 'frame:nope'], login: { days: 99, last: '2026-10-25' }, settled: null },
    } };
    const out = cleanEvents(raw);
    expect(Object.keys(out.byId)).toEqual(['halloween-2026']);
    const st = out.byId['halloween-2026'];
    expect(st.read).toEqual(['ev.halloween.01']);
    expect(st.bought).toEqual({ hw_book_r: 3 });
    expect(st.daily).toEqual({ day: '2026-10-25', progress: { hw_d_kill: 12 }, claimed: ['hw_d_login'] });
    expect(st.total.progress).toEqual({ hw_t_kill: 40 });
    expect(st.owned).toEqual(['title:ev_halloween_2026']);
    expect(st.login.days).toBe(9);
  });

  it('an old save without events loads; the block round-trips; shadows restore a dropped block', () => {
    const p = joined();
    const raw = JSON.parse(JSON.stringify(p));
    delete raw.events;
    expect(migrateProfile(raw).events).toEqual({ v: 1, byId: {} });
    p.items[CANDY] = 400;
    buyEventOffer(p, EV.id, 'hw_title', 1, MID);
    readEpisode(p, EV.id, 'ev.halloween.01', MID);
    const back = deserializeProfile(serializeProfile(p));
    expect(back.events.byId['halloween-2026'].owned).toEqual(['title:ev_halloween_2026']);
    const dropped = JSON.parse(JSON.stringify(p));
    delete dropped.events; // an older build dropped the block: the counters' shadows bring the parts that matter back
    const restored = migrateProfile(dropped).events.byId['halloween-2026'];
    expect(restored.owned).toEqual(['title:ev_halloween_2026']);
    expect(restored.read).toEqual(['ev.halloween.01']);
  });
});
