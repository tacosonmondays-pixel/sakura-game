// Limited events: the end (EVENT_SPEC §7 ST-1…ST-4).
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import { settleEvents, markEventLogin, trackEvent, eventPhase, buyEventOffer, readEpisode, eventState } from '../../src/systems/events.js';
import { applyBattleResult } from '../../src/systems/rewards.js';
import { EVENT_MAP } from '../../src/data/events/index.js';
import { mailList, claimMail } from '../../src/systems/mail.js';
import { itemCount } from '../../src/systems/inventory.js';
import { createRng } from '../../src/core/rng.js';

const EV = EVENT_MAP['halloween-2026'];
const CANDY = 'evt_halloween_candy';
const T = (iso) => Date.parse(iso);
const MID = T('2026-10-25T18:00:00Z');
const END = T('2026-11-16T01:00:00Z'); // Sun Nov 15, 7 PM CST (extended two weeks, owner Oct 30)
const XEND = T('2026-11-23T01:00:00Z'); // Sun Nov 22, 7 PM CST

function joined() {
  const p = createProfile();
  for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5']) p.progress.stages[id] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
  return p;
}

describe('settle', () => {
  it('ST-1 at the end: one letter with exactly the finished unclaimed rewards; twice delivers nothing new', () => {
    const p = joined();
    trackEvent(p, EV.id, 'eventKill', 3000, { now: MID }); // hw_t_kill (200); that day's hw_d_kill lapsed at its reset
    markEventLogin(p, END - 3600000); // the last day: hw_d_login done (30 candy), not claimed
    trackEvent(p, EV.id, 'eventKill', 250, { now: END - 3600000 }); // hw_d_kill (30)
    expect(settleEvents(p, END - 1).letters).toEqual([]);
    const { letters } = settleEvents(p, END);
    const unclaimed = letters.filter((l) => l.id === 'ev:halloween-2026:1:unclaimed');
    expect(unclaimed.length).toBe(1);
    expect(unclaimed[0].rewards).toEqual([{ id: CANDY, count: 260 }]);
    expect(unclaimed[0].expiresAt).toBe(XEND);
    expect(settleEvents(p, END + 5).letters).toEqual([]);
  });

  it('ST-2 at the exchange end: candy removed, 50 coins each by mail, settled and pruned; 0 candy → no letter', () => {
    const p = joined();
    p.items[CANDY] = 37;
    const coins0 = p.currencies.coins;
    const { letters, settled } = settleEvents(p, XEND);
    expect(settled).toEqual(['halloween-2026']);
    expect(itemCount(p, CANDY)).toBe(0);
    const l = letters.find((x) => x.id === 'ev:halloween-2026:1:leftover');
    expect(l.rewards).toEqual([{ id: 'coins', count: 1850 }]);
    expect(l.body).toContain('37 leftover Pumpkin Candy became 1,850 coins');
    claimMail(p, l.id, XEND);
    expect(p.currencies.coins - coins0).toBe(1850);
    const st = eventState(p, EV.id);
    expect(st.settled).toEqual({ at: XEND, currency: 37, coins: 1850 });
    expect(st.bought).toEqual({});
    const q = joined();
    eventState(q, EV.id);
    expect(settleEvents(q, XEND).letters).toEqual([]);
    expect(eventState(q, EV.id).settled).toBeTruthy();
  });

  it('ST-3 settled is final: a clock set back shows ended, pays no battle and sells nothing', () => {
    const p = joined();
    p.items[CANDY] = 500;
    readEpisode(p, EV.id, 'ev.halloween.01', MID);
    settleEvents(p, XEND);
    expect(eventPhase(EV, MID, p)).toBe('ended');
    expect(buyEventOffer(p, EV.id, 'hw_notes', 1, MID).error).toBe('closed');
    const r = applyBattleResult(p, { stageId: 'ev-halloween-1', difficulty: 'normal', won: true, wave: 14, livesLeft: 100, encountered: [], kills: {}, stats: {} }, createRng(1), { now: new Date(MID), startedAt: MID });
    expect(r.practice).toBe(true);
    // and it survives an older build dropping the block (the counters' shadow)
    const raw = JSON.parse(JSON.stringify(p));
    delete raw.events;
    expect(eventPhase(EV, MID, migrateProfile(raw))).toBe('ended');
  });

  it('ST-4 an offline player first back after the exchange end settles in one pass; mailed candy expired', () => {
    const p = joined();
    markEventLogin(p, MID); // login gift letter: 100 candy + 50 gems, unclaimed
    trackEvent(p, EV.id, 'eventKill', 3000, { now: MID }); // hw_t_kill done, unclaimed (200 candy, nothing else)
    p.items[CANDY] = 12;
    const { letters } = settleEvents(p, XEND + 86400000);
    // the unclaimed mission held only candy: no letter, its 200 candy joins the 12 leftover (HW-3)
    expect(letters.map((l) => l.id)).toEqual(['ev:halloween-2026:1:leftover']);
    expect(letters[0].rewards).toEqual([{ id: 'coins', count: (12 + 200) * 50 }]);
    expect(eventState(p, EV.id).settled.currency).toBe(212);
    const gift = mailList(p, XEND + 86400000).find((l) => l.id === 'ev:halloween-2026:1:login:1');
    expect(gift.expired).toBe(true);
  });
});
