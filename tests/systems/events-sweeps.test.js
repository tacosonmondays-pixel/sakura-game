// Limited events: the daily sweep limit (owner, Oct 20: "Sweep limit for now"; EVENT_SPEC §3.6 "Daily sweep limit",
// docs/specs/HALLOWEEN_2026.md "Sweeps"). SW-1 the count, SW-2 a partial tap, SW-3 the 7 PM Central rollover,
// SW-4 a clock set back, SW-5 event stages only, SW-6 a stale tab's round trip, SW-7 the settle, SW-8 the economy.
// Fixed UTC instants, so any TZ works.
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import {
  readEpisode, eventSweepsLeft, useEventSweeps, settleEvents, missionRows, EVENT_SWEEPS_PER_DAY, SWEEP_MARK, SWEEP_DAY_MARK,
} from '../../src/systems/events.js';
import { applyBattleResult, sweep, rollStageDrops, MAX_SWEEPS } from '../../src/systems/rewards.js';
import { EVENT_MAP } from '../../src/data/events/index.js';
import { STAGE_MAP } from '../../src/data/stages.js';
import { gameDay, gameDayEnd, gameDayNumber, gameDayStart } from '../../src/core/reset.js';
import { createRng } from '../../src/core/rng.js';
import { itemCount } from '../../src/systems/inventory.js';

const EV = EVENT_MAP['halloween-2026'];
const CANDY = 'evt_halloween_candy';
const T = (iso) => Date.parse(iso);
const DAY = 24 * 3600 * 1000;
const MID = T('2026-10-25T18:00:00Z'); // Sun Oct 25 13:00 CDT (game day 2026-10-25)
const RESET = gameDayEnd(gameDay(MID)); // Sun Oct 25 7 PM CDT
const XEND = T('2026-11-09T01:00:00Z');
const COUNT = `${SWEEP_MARK}${EV.id}`;
const DAYKEY = `${SWEEP_DAY_MARK}${EV.id}`;

function joined() {
  const p = createProfile();
  for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5']) p.progress.stages[id] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
  return p;
}
const win = (stageId, difficulty = 'normal', kills = { slime_green: 40 }) => ({ stageId, difficulty, won: true, wave: 16, wavesCleared: 16, livesLeft: 1, encountered: Object.keys(kills), kills, stats: {} });
const play = (p, stageId, difficulty = 'normal', at = MID) => applyBattleResult(p, win(stageId, difficulty), createRng(7), { now: new Date(at), startedAt: at });
/** Ops 1-4 cleared on Normal, Episodes 1-2 read. */
function farmer() {
  const p = joined();
  readEpisode(p, EV.id, 'ev.halloween.01', MID);
  play(p, 'ev-halloween-1');
  play(p, 'ev-halloween-2');
  readEpisode(p, EV.id, 'ev.halloween.02', MID);
  play(p, 'ev-halloween-3');
  play(p, 'ev-halloween-4');
  return p;
}
const go = (p, stageId, times, at = MID, d = 'normal') => sweep(p, stageId, d, times, createRng(3), { now: new Date(at) });
const left = (p, at = MID) => eventSweepsLeft(p, EV.id, at).left;
const candyOf = (r) => r.rewards.filter((x) => x.id === CANDY).reduce((a, x) => a + x.count, 0);
const clears = (p, at = MID) => missionRows(p, EV, at).total.find((m) => m.id === 'hw_t_clear20').progress;

describe('SW-1 the count', () => {
  it('10 sweeps a game day, all the event\'s stages together, in the counters (count + gameDayNumber)', () => {
    expect(EVENT_SWEEPS_PER_DAY).toBe(10);
    expect(MAX_SWEEPS).toBe(10); // one Sweep ×10 tap's worth
    const p = farmer();
    expect(eventSweepsLeft(p, EV.id, MID)).toMatchObject({ limit: 10, used: 0, left: 10, refillsAt: RESET });
    expect(go(p, 'ev-halloween-1', 3)).toMatchObject({ ok: true, sweepsLeft: 7 });
    expect(go(p, 'ev-halloween-4', 1)).toMatchObject({ ok: true, sweepsLeft: 6 });
    expect(eventSweepsLeft(p, EV.id, MID)).toMatchObject({ used: 4, left: 6 });
    expect(p.missions.counters[COUNT]).toBe(4);
    expect(p.missions.counters[DAYKEY]).toBe(gameDayNumber(MID));
    expect(p.events.byId[EV.id]).not.toHaveProperty('sweeps'); // never in the block an older build rewrites
  });
});

describe('SW-2 a partial tap', () => {
  it('Sweep ×10 with 4 left sweeps 4 and pays 4; at 0 → error limit, nothing paid or counted', () => {
    const p = farmer();
    go(p, 'ev-halloween-2', 6);
    const c = itemCount(p, CANDY);
    const r = go(p, 'ev-halloween-1', 10);
    expect(r).toMatchObject({ ok: true, sweepsLeft: 0 });
    expect(r.runs).toHaveLength(4);
    expect(candyOf(r)).toBe(4 * 60);
    expect(itemCount(p, CANDY) - c).toBe(240);
    const before = JSON.stringify(p);
    for (const [id, n] of [['ev-halloween-1', 10], ['ev-halloween-4', 1]]) {
      expect(go(p, id, n)).toMatchObject({ ok: false, error: 'limit', runs: [], rewards: [], gear: [], sweepsLeft: 0 });
    }
    expect(JSON.stringify(p)).toBe(before); // no candy, clears, mission progress or count
    expect(p.progress.stages['ev-halloween-1'].clears).toBe(1 + 4);
    expect(clears(p)).toBe(4 + 10);
  });

  it('the older refusals still come first: closed operations, a locked difficulty', () => {
    const p = farmer();
    go(p, 'ev-halloween-1', 10);
    expect(go(p, 'ev-halloween-1', 1, MID, 'nightmare').error).toBe('difficulty');
    expect(go(p, 'ev-halloween-1', 1, T('2026-11-02T01:00:00Z')).error).toBe('event');
  });
});

describe('SW-3 the 7 PM Central rollover', () => {
  it('refills at the reset, not a millisecond before, and a fresh day counts from 0', () => {
    const p = farmer();
    go(p, 'ev-halloween-4', 10);
    expect(left(p, RESET - 1)).toBe(0);
    expect(go(p, 'ev-halloween-4', 1, RESET - 1).error).toBe('limit');
    expect(left(p, RESET)).toBe(10);
    expect(go(p, 'ev-halloween-4', 2, RESET)).toMatchObject({ ok: true, sweepsLeft: 8 });
    expect(p.missions.counters[DAYKEY]).toBe(gameDayNumber(MID) + 1);
    // the fall-back Sunday (Nov 1, a 25-hour game day) still flips at 7 PM CST
    const nov1 = gameDayStart('2026-11-01');
    go(p, 'ev-halloween-4', 10, nov1);
    expect(left(p, gameDayEnd('2026-11-01') - 1)).toBe(0);
  });
});

describe('SW-4 a clock set back', () => {
  it('never refills: the later day\'s count holds until the clock passes it again', () => {
    const p = farmer();
    go(p, 'ev-halloween-4', 10, MID + DAY); // tomorrow's 10
    expect(left(p, MID)).toBe(0); // back to today: still spent
    expect(left(p, MID - 3 * DAY)).toBe(0);
    expect(go(p, 'ev-halloween-4', 10, MID).error).toBe('limit');
    expect(left(p, MID + DAY)).toBe(0);
    expect(left(p, MID + 2 * DAY)).toBe(10);
  });

  it('sweeps on an earlier day count toward the later stored day (no reset backwards)', () => {
    const p = farmer();
    go(p, 'ev-halloween-1', 3, MID + DAY);
    expect(go(p, 'ev-halloween-1', 10, MID)).toMatchObject({ ok: true, sweepsLeft: 0 });
    expect(p.missions.counters[DAYKEY]).toBe(gameDayNumber(MID + DAY));
    expect(p.missions.counters[COUNT]).toBe(10);
    // useEventSweeps on its own: the same forward-only rule
    const q = joined();
    useEventSweeps(q, EV.id, 2, MID + DAY);
    expect(useEventSweeps(q, EV.id, 1, MID)).toMatchObject({ used: 3, left: 7 });
  });
});

describe('SW-5 event stages only', () => {
  it('campaign and Bounty sweeps are unchanged and leave the event count alone', () => {
    const p = farmer();
    go(p, 'ev-halloween-4', 10);
    for (const id of ['1-1', 'res-books-1']) {
      p.progress.stages[id] = { easy: true, normal: true, hard: true, nightmare: false, clears: 1 };
      for (let i = 0; i < 3; i++) {
        const r = go(p, id, 10, MID, 'hard');
        expect(r.ok).toBe(true);
        expect(r.runs).toHaveLength(10);
        expect(r).not.toHaveProperty('sweepsLeft');
      }
    }
    expect(p.missions.counters[COUNT]).toBe(10);
  });

  it('battles played are never limited: they pay and count with no sweeps left', () => {
    const p = farmer();
    go(p, 'ev-halloween-4', 10);
    const c = itemCount(p, CANDY);
    for (let i = 0; i < 3; i++) play(p, 'ev-halloween-4');
    expect(itemCount(p, CANDY) - c).toBe(3 * 90);
    expect(clears(p)).toBe(4 + 10 + 3);
    expect(left(p)).toBe(0);
  });
});

describe('SW-6 a stale tab', () => {
  it('the count lives in missions.counters: a reload, or an older build that drops the event block, keeps it', () => {
    const p = farmer();
    go(p, 'ev-halloween-3', 7);
    const reload = migrateProfile(JSON.parse(JSON.stringify(p)));
    expect(left(reload)).toBe(3);
    const raw = JSON.parse(JSON.stringify(p));
    delete raw.events; // an older build's cleanEvents rebuilds or drops the block; counters stay word for word
    const dropped = migrateProfile(raw);
    expect(left(dropped)).toBe(3);
    expect(go(dropped, 'ev-halloween-3', 10)).toMatchObject({ ok: true, sweepsLeft: 0 });
    expect(go(dropped, 'ev-halloween-3', 10).error).toBe('limit');
  });

  it('garbage in the counters reads as a fresh day or a clamped count, never as more than 10 left', () => {
    const p = farmer();
    p.missions.counters[DAYKEY] = gameDayNumber(MID);
    p.missions.counters[COUNT] = 99;
    expect(eventSweepsLeft(p, EV.id, MID)).toMatchObject({ used: 10, left: 0 });
    p.missions.counters[COUNT] = -5;
    expect(left(p)).toBe(10);
    p.missions.counters[DAYKEY] = -1;
    p.missions.counters[COUNT] = 10;
    expect(left(p)).toBe(10); // an impossible day is older than today
  });
});

describe('SW-7 the settle', () => {
  it('drops the sweep marks with the run\'s other shadows; a settled event never sweeps', () => {
    const p = farmer();
    go(p, 'ev-halloween-4', 5);
    settleEvents(p, XEND);
    expect(p.missions.counters).not.toHaveProperty(COUNT);
    expect(p.missions.counters).not.toHaveProperty(DAYKEY);
    expect(go(p, 'ev-halloween-4', 1).error).toBe('event');
  });
});

// The owner's check: a grinder still affords the whole limited stock before the operations close (Nov 1, 7 PM
// Central) with 10 sweeps a day plus played battles. Counted from the data, from the first full game day this build
// can have (Oct 21; a later ship leaves fewer limited days but unlimited ones before). Played battles: one win per
// medal and one Op 4 win a day (what the 250-kill daily needs; dailies assume it).
describe('SW-8 the economy', () => {
  const candy = (list) => (list || []).filter((r) => r.id === CANDY).reduce((a, r) => a + r.count, 0);
  const perWin = (stageId, d) => candy(rollStageDrops(stageId, d, createRng(1)));
  const days = gameDayNumber(gameDayStart(EV.window.lastDay)) - gameDayNumber(gameDayStart('2026-10-21')) + 1;
  const stock = EV.shop.filter((o) => o.limit != null).reduce((a, o) => a + o.price * o.limit, 0);
  const daily = EV.missions.daily.reduce((a, m) => a + candy(m.rewards), 0);
  const once = (ids) => EV.missions.total.filter((m) => ids.includes(m.id)).reduce((a, m) => a + candy(m.rewards), 0);
  const base = EV.episodes.reduce((a, e) => a + candy(e.rewards), 0)
    + EV.stages.reduce((a, s) => a + candy(s.firstClear), 0)
    + EV.login.reduce((a, g) => a + candy(g), 0);
  const OPS = ['ev-halloween-1', 'ev-halloween-2', 'ev-halloween-3', 'ev-halloween-4'];
  const NORMAL_MISSIONS = ['hw_t_op1', 'hw_t_op2', 'hw_t_op3', 'hw_t_op4', 'hw_t_boss_n', 'hw_t_boss_h', 'hw_t_clear20', 'hw_t_read', 'hw_t_kill'];
  /** Candy by Nov 1 and the smallest daily limit that still reaches the stock. */
  function plan({ nightmareOps, bossNightmare, missions, farm }) {
    const medals = OPS.reduce((a, id) => a + perWin(id, 'normal') + (nightmareOps.includes(id) ? perWin(id, 'nightmare') : 0), 0)
      + perWin('ev-halloween-boss', 'normal') + perWin('ev-halloween-boss', 'hard') + (bossNightmare ? perWin('ev-halloween-boss', 'nightmare') : 0);
    const sweepCandy = perWin('ev-halloween-4', farm);
    const without = base + once(missions) + daily * days + medals + perWin('ev-halloween-4', farm) * days;
    const total = without + EVENT_SWEEPS_PER_DAY * sweepCandy * days;
    return { total, sweepCandy, smallest: Math.max(0, Math.ceil((stock - without) / (sweepCandy * days))) };
  }

  it('the stock, the days and the candy per sweep', () => {
    expect(stock).toBe(15800);
    expect(days).toBe(12); // Oct 21 – Nov 1
    expect(daily).toBe(120);
    expect(base).toBe(150 + 1040 + 550);
    expect(OPS.map((id) => [perWin(id, 'normal'), perWin(id, 'nightmare')])).toEqual([[60, 120], [70, 140], [80, 160], [90, 180]]);
    expect(STAGE_MAP['ev-halloween-boss'].boss).toBe(true); // never swept: its candy comes from battles only
  });

  it('a Nightmare grinder (every Nightmare, the Golem\'s too) affords it all with room to spare', () => {
    const r = plan({ nightmareOps: OPS, bossNightmare: true, missions: EV.missions.total.map((m) => m.id), farm: 'nightmare' });
    expect(r.sweepCandy).toBe(180);
    expect(r.total).toBeGreaterThanOrEqual(stock);
    expect(r.total).toBe(32260);
    expect(r.smallest).toBe(3);
  });

  it('a mid grinder (Op 4 Nightmare only, the Golem on Normal and Hard) too', () => {
    const r = plan({ nightmareOps: ['ev-halloween-4'], bossNightmare: false, missions: [...NORMAL_MISSIONS, 'hw_t_nm4', 'hw_t_nm_clear15'], farm: 'nightmare' });
    expect(r.total).toBe(29740);
    expect(r.smallest).toBe(4);
  });

  it('even without any Nightmare, 10 a day on Op 4 Normal reaches the stock', () => {
    const r = plan({ nightmareOps: [], bossNightmare: false, missions: NORMAL_MISSIONS, farm: 'normal' });
    expect(r.sweepCandy).toBe(90);
    expect(r.total).toBe(16980);
    expect(r.smallest).toBe(9);
    expect(r.smallest).toBeLessThanOrEqual(EVENT_SWEEPS_PER_DAY);
  });
});
