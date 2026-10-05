import { describe, it, expect } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import {
  onAppStart, track, missionList, claimMission, claimAllMissions, loginCalendar, claimLogin, achievementList, claimAchievement,
  redeemCode, currentEvent, f2pIncomeSummary, bestiaryPercent, discoverableEnemies,
} from '../../src/systems/missions.js';
import { shopTabs, buyOffer } from '../../src/systems/shop.js';
import { DAILY_MISSIONS, WEEKLY_MISSIONS, LOGIN_REWARDS } from '../../src/data/missions.js';
import { SHOP_OFFERS } from '../../src/data/shop.js';
import { bountyArenas } from '../../src/data/stages.js';
import { weekKey } from '../../src/core/util.js';

const MON = new Date(2026, 9, 5, 10); // Monday 5 Oct 2026
const day = (n, h = 10) => new Date(2026, 9, 5 + n, h);
const gemsOf = (list) => list.reduce((a, m) => a + m.rewards.filter((r) => r.id === 'gems').reduce((x, r) => x + r.count, 0), 0);

describe('commissions', () => {
  it('daily = 120 gems, weekly = 600 gems', () => {
    expect(gemsOf(DAILY_MISSIONS)).toBe(120);
    expect(gemsOf(WEEKLY_MISSIONS)).toBe(600);
    expect(DAILY_MISSIONS.length).toBeGreaterThanOrEqual(5);
    expect(DAILY_MISSIONS.length).toBeLessThanOrEqual(6);
  });

  it('onAppStart is idempotent and counts the daily login once', () => {
    const p = createProfile();
    expect(onAppStart(p, MON)).toEqual({ dailyReset: true, weeklyReset: true });
    expect(onAppStart(p, day(0, 18))).toEqual({ dailyReset: false, weeklyReset: false });
    const login = missionList(p).daily.find((m) => m.id === 'd_login');
    expect(login).toMatchObject({ progress: 1, goal: 1, claimable: true, claimed: false });
    expect(p.missions.counters.login).toBe(1);
  });

  it('track progresses, claim pays once, daily resets next day, weekly resets next week', () => {
    const p = createProfile();
    onAppStart(p, MON);
    track(p, 'kill', 120);
    track(p, 'kill', 500);
    const killD = () => missionList(p).daily.find((m) => m.id === 'd_kill300');
    expect(killD().progress).toBe(300);
    expect(killD().claimable).toBe(true);
    expect(claimMission(p, 'daily', 'd_win3')).toMatchObject({ ok: false, error: 'incomplete' });
    const gems = p.currencies.gems;
    const r = claimMission(p, 'daily', 'd_kill300');
    expect(r.ok).toBe(true);
    expect(p.currencies.gems).toBe(gems + 20);
    expect(claimMission(p, 'daily', 'd_kill300')).toMatchObject({ ok: false, error: 'claimed' });
    expect(missionList(p).weekly.find((m) => m.id === 'w_kill3000').progress).toBe(620);

    onAppStart(p, day(1)); // Tuesday: daily reset, weekly kept
    expect(killD()).toMatchObject({ progress: 0, claimed: false });
    expect(missionList(p).weekly.find((m) => m.id === 'w_kill3000').progress).toBe(620);
    onAppStart(p, day(7)); // next Monday: weekly reset
    expect(missionList(p).weekly.find((m) => m.id === 'w_kill3000').progress).toBe(0);
  });

  it('finishing all dailies counts toward the weekly "Model Student"', () => {
    const p = createProfile();
    for (let d = 0; d < 5; d++) {
      onAppStart(p, day(d));
      track(p, 'battleWin', 3);
      track(p, 'kill', 300);
      track(p, 'levelUp', 1);
      track(p, 'spendCoins', 10000);
      track(p, 'battleWinHard', 1);
      const r = claimAllMissions(p, 'daily');
      expect(r.claimed).toHaveLength(DAILY_MISSIONS.length);
    }
    const w = missionList(p).weekly.find((m) => m.id === 'w_dailies5');
    expect(w).toMatchObject({ progress: 5, claimable: true });
    expect(claimMission(p, 'weekly', 'w_dailies5').rewards).toEqual(expect.arrayContaining([{ id: 'ticket_recruit', count: 1 }]));
  });
});

describe('login calendar', () => {
  it('claims once per day and cycles through 7 days', () => {
    const p = createProfile();
    expect(loginCalendar(p, MON).days.find((d) => d.today).day).toBe(1);
    const r1 = claimLogin(p, MON);
    expect(r1).toMatchObject({ ok: true, day: 1 });
    expect(claimLogin(p, day(0, 23))).toMatchObject({ ok: false, error: 'claimed' });
    const cal = loginCalendar(p, day(0, 23));
    expect(cal.claimable).toBe(false);
    expect(cal.days[0]).toMatchObject({ claimed: true, today: true });
    // skipping a day does not reset the cycle
    expect(claimLogin(p, day(3)).day).toBe(2);
    for (let d = 3; d <= 7; d++) expect(claimLogin(p, day(d + 1)).day).toBe(d);
    expect(loginCalendar(p, day(8, 22)).days.every((d) => d.claimed)).toBe(true);
    // next day: new cycle
    const next = loginCalendar(p, day(9));
    expect(next.days.find((d) => d.today).day).toBe(1);
    expect(next.days.some((d) => d.claimed)).toBe(false);
    expect(claimLogin(p, day(9)).day).toBe(1);
    expect(p.missions.login.streak).toBe(8);
    expect(LOGIN_REWARDS).toHaveLength(7);
  });
});

describe('achievements', () => {
  it('claims once when the metric is reached', () => {
    const p = createProfile();
    const a = () => achievementList(p).find((x) => x.id === 'a_pulls_10');
    expect(a()).toMatchObject({ progress: 0, claimable: false });
    expect(claimAchievement(p, 'a_pulls_10').error).toBe('incomplete');
    p.gacha.totalPulls = 12;
    expect(a()).toMatchObject({ progress: 10, claimable: true });
    expect(claimAchievement(p, 'a_pulls_10').ok).toBe(true);
    expect(claimAchievement(p, 'a_pulls_10').error).toBe('claimed');
    expect(a().claimed).toBe(true);
  });

  it('bestiary percentage', () => {
    const p = createProfile();
    expect(bestiaryPercent(p)).toBe(0);
    const all = discoverableEnemies();
    for (const id of all.slice(0, Math.ceil(all.length / 2))) p.bestiary[id] = { seen: true, discovered: true, kills: 1 };
    expect(bestiaryPercent(p)).toBeGreaterThanOrEqual(50);
    expect(achievementList(p).find((x) => x.id === 'a_bestiary_50').claimable).toBe(true);
  });
});

describe('codes', () => {
  it('redeem once, case-insensitive', () => {
    const p = createProfile();
    const gems = p.currencies.gems;
    for (const code of ['SAKURA2026', 'welcome', ' TacoTuesday ']) expect(redeemCode(p, code).ok).toBe(true);
    expect(p.currencies.gems).toBeGreaterThan(gems);
    expect(redeemCode(p, 'sakura2026')).toMatchObject({ ok: false, error: 'redeemed' });
    expect(redeemCode(p, 'NOPE')).toMatchObject({ ok: false, error: 'invalid' });
    expect(p.redeemed).toEqual(['SAKURA2026', 'WELCOME', 'TACOTUESDAY']);
  });

  it('action codes return the action without granting', () => {
    const p = createProfile();
    const r = redeemCode(p, 'reset 67');
    expect(r).toMatchObject({ ok: true, action: 'resetProgress', rewards: [] });
  });
});

describe('weekly event', () => {
  it('picks one bounty arena per week, deterministically', () => {
    const ids = new Set(bountyArenas().map((a) => a.id));
    const seen = new Set();
    for (let w = 0; w < 30; w++) {
      const ev = currentEvent(day(w * 7));
      expect(ids.has(ev.arena)).toBe(true);
      expect(ev.stageIds).toHaveLength(3);
      expect(ev.dropMul).toBe(2);
      expect(ev.week).toBe(weekKey(day(w * 7)));
      seen.add(ev.arena);
    }
    expect(seen.size).toBeGreaterThan(2);
    // same week → same event
    expect(currentEvent(MON).id).toBe(currentEvent(day(6)).id);
  });
});

describe('shop', () => {
  it('lists tabs with offers', () => {
    const p = createProfile();
    const tabs = shopTabs(p, MON);
    expect(tabs.map((t) => t.id)).toEqual(['general', 'gems', 'recruit', 'boss', 'bounty']);
    for (const t of tabs) expect(t.offers.length).toBeGreaterThan(0);
    expect(tabs.find((t) => t.id === 'recruit').offers.some((o) => o.unitId)).toBe(true);
  });

  it('enforces daily stock and resets the next day', () => {
    const p = createProfile();
    p.currencies.coins = 1_000_000;
    const offer = SHOP_OFFERS.find((o) => o.id === 'gen_book_common');
    expect(buyOffer(p, 'gen_book_common', offer.stock + 1, MON).error).toBe('soldOut');
    const r = buyOffer(p, 'gen_book_common', offer.stock, MON);
    expect(r.ok).toBe(true);
    expect(r.rewards).toEqual([{ id: 'book_common', count: offer.count * offer.stock }]);
    expect(p.currencies.coins).toBe(1_000_000 - offer.price * offer.stock);
    expect(buyOffer(p, 'gen_book_common', 1, day(0, 20)).error).toBe('soldOut');
    expect(shopTabs(p, day(0, 20)).find((t) => t.id === 'general').offers.find((o) => o.id === 'gen_book_common')).toMatchObject({ soldOut: true, remaining: 0 });
    expect(buyOffer(p, 'gen_book_common', 1, day(1)).ok).toBe(true);
    expect(p.missions.counters.spendCoins).toBe(offer.price * (offer.stock + 1));
  });

  it('enforces weekly stock across days', () => {
    const p = createProfile();
    p.items.token_boss = 1000;
    expect(buyOffer(p, 'boss_ticket', 1, MON).ok).toBe(true);
    expect(buyOffer(p, 'boss_ticket', 1, day(3)).error).toBe('soldOut');
    expect(buyOffer(p, 'boss_ticket', 1, day(7)).ok).toBe(true);
    expect(p.items.ticket_recruit).toBe(2);
  });

  it('refuses without funds and changes nothing', () => {
    const p = createProfile();
    const before = JSON.stringify(p);
    expect(buyOffer(p, 'boss_crown_dragon', 1, MON).error).toBe('funds');
    p.shop = JSON.parse(before).shop; // refreshShop stamps day/week; compare the rest
    expect(JSON.stringify({ ...p, shop: null })).toBe(JSON.stringify({ ...JSON.parse(before), shop: null }));
    expect(buyOffer(p, 'nope', 1, MON).error).toBe('unknown');
  });

  it('spark offers trade recruit points for an SSR', () => {
    const p = createProfile();
    expect(buyOffer(p, 'spark_kaede', 1, MON).error).toBe('funds');
    p.gacha.recruitPoints = 200;
    const r = buyOffer(p, 'spark_kaede', 1, MON);
    expect(r.ok).toBe(true);
    expect(p.units.kaede).toBeTruthy();
    expect(p.gacha.recruitPoints).toBe(0);
  });
});

describe('F2P income', () => {
  it('lands at 70-80 pulls per 28 days for an active free player', () => {
    const s = f2pIncomeSummary();
    expect(s.periodDays).toBe(28);
    expect(s.totals.pulls).toBeGreaterThanOrEqual(70);
    expect(s.totals.pulls).toBeLessThanOrEqual(80);
    for (const r of s.rows) {
      expect(typeof r.source).toBe('string');
      expect(r.gems).toBeGreaterThanOrEqual(0);
      expect(r.tickets).toBeGreaterThanOrEqual(0);
      expect(typeof r.note).toBe('string');
    }
    expect(s.rows.reduce((a, r) => a + r.gems, 0)).toBe(s.totals.gems);
    expect(s.oneTime.length).toBeGreaterThan(3);
    expect(s.oneTimeTotals.pulls).toBeGreaterThan(0);
  });
});
