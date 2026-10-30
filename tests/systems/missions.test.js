import { describe, it, expect } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import {
  onAppStart, track, missionList, claimMission, claimAllMissions, loginCalendar, claimLogin, achievementList, claimAchievement,
  redeemCode, currentEvent, f2pIncomeSummary, bestiaryPercent, discoverableEnemies,
  claimAllAchievements, claimAllCount, achievementsReady, achievementNotice, readyAchievementIds, recordMax, achievementGate,
} from '../../src/systems/missions.js';
import { ACHIEVEMENTS, ACHIEVEMENT_MAP, achievementLive } from '../../src/data/achievements.js';
import { CAMPAIGN_IDS } from '../../src/data/stages.js';
import { skipOnboarding, checkLessons, featureOpen } from '../../src/systems/story.js';
import { shopTabs, buyOffer, refreshShop } from '../../src/systems/shop.js';
import { DAILY_MISSIONS, WEEKLY_MISSIONS, LOGIN_REWARDS, REDEEM_CODES } from '../../src/data/missions.js';
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

describe('achievements: the expansion (docs/specs/ACHIEVEMENTS.md §3, §5)', () => {
  /** A veteran (legacy) save: every feature open, as on update day. */
  const veteran = () => {
    const p = createProfile();
    p.story.legacy = true;
    return p;
  };
  const clearStages = (p, ids, d = 'normal') => { for (const id of ids) p.progress.stages[id] = { easy: false, normal: false, hard: false, nightmare: false, clears: 1, ...p.progress.stages[id], [d]: true }; };

  it('claim cycle per metric kind: incomplete → claimable → ok → claimed; marker and payout in one call', () => {
    const cases = [
      ['a_clear_10', (p) => clearStages(p, CAMPAIGN_IDS.slice(0, 10))],
      ['a_login_7', (p) => { p.missions.counters.login = 7; }],
      ['a_fp_wyrm', (p) => { p.missions.counters['fpm:blossom:wyrm'] = 1; }],
      ['a_ur_1', (p) => { p.units.hikari.awaken = 5; }],
      ['a_kills_5k', (p) => { p.missions.counters.kill = 5000; }],
    ];
    for (const [id, meet] of cases) {
      const p = veteran();
      const row = () => achievementList(p).find((x) => x.id === id);
      expect(row(), id).toMatchObject({ claimable: false, claimed: false, met: false });
      expect(claimAchievement(p, id).error, id).toBe('incomplete');
      meet(p);
      expect(row(), id).toMatchObject({ claimable: true, met: true, locked: null });
      const gems = p.currencies.gems;
      const r = claimAchievement(p, id);
      expect(r.ok, id).toBe(true);
      expect(p.missions.achievements[id]).toBe(true);
      expect(p.currencies.gems - gems).toBe(ACHIEVEMENT_MAP[id].rewards.filter((x) => x.id === 'gems').reduce((n, x) => n + x.count, 0));
      expect(claimAchievement(p, id).error, id).toBe('claimed');
    }
  });

  it('the list carries the display fields', () => {
    const a = achievementList(createProfile()).find((x) => x.id === 'a_sakura_40');
    expect(a).toMatchObject({ cat: 'campaign', tier: 5, series: 'sakura', hidden: false, since: null, locked: null, live: true });
    // (a_sakura_80 is the Act II step, listed in the series but hidden until its stages exist: the ladder shows live rows only)
    expect(a.seriesIds).toEqual(['a_sakura_1', 'a_sakura_10', 'a_sakura_20', 'a_sakura_40', 'a_sakura_80']);
    expect(achievementList(createProfile()).some((x) => x.id === 'a_sakura_80')).toBe(false);
    expect(a.honor).toMatchObject({ no: 28, cls: 'special', fx: 'sakura' });
    expect(a.title).toEqual({ text: 'Thousand-Petal Sentinel', tier: 'prism' });
    const secret = achievementList(createProfile()).find((x) => x.id === 'a_close_call');
    expect(secret).toMatchObject({ hidden: true, since: '0.1.30' });
    expect(secret.hint).toMatch(/close/);
    expect(achievementList(createProfile()).find((x) => x.id === 'a_reroll_10')).toMatchObject({ honor: null, title: null, name: 'Keen Tinkerer' });
  });

  it('gate: a box row on a new save before 2-1 is locked; open after the gear lesson; always open on a legacy save', () => {
    const p = createProfile();
    skipOnboarding(p);
    p.missions.counters.kill = 5000; // a_kills_5k: 20 gems + a Sturdy box
    expect(featureOpen(p, 'gear')).toBe(false);
    expect(achievementList(p).find((x) => x.id === 'a_kills_5k')).toMatchObject({ met: true, claimable: false, locked: 'gear' });
    expect(claimAchievement(p, 'a_kills_5k')).toMatchObject({ ok: false, error: 'locked', feature: 'gear' });
    expect(p.missions.achievements.a_kills_5k).toBeUndefined();
    expect(readyAchievementIds(p)).not.toContain('a_kills_5k');
    expect(claimAllAchievements(p).skipped).toContain('a_kills_5k');
    clearStages(p, ['1-1', '1-2', '1-3', '1-4', '1-5', '2-1']);
    checkLessons(p);
    expect(featureOpen(p, 'gear')).toBe(true);
    expect(claimAchievement(p, 'a_kills_5k').ok).toBe(true);
    const legacy = veteran();
    legacy.missions.counters.kill = 5000;
    expect(claimAchievement(legacy, 'a_kills_5k').ok).toBe(true);
  });

  it('crowns wait for Awakening (3-2) the same way', () => {
    const p = createProfile();
    skipOnboarding(p);
    for (const id of ['boss-lych', 'boss-colossus', 'boss-ashwing']) p.progress.stages[id] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
    expect(achievementGate(p, ACHIEVEMENT_MAP.a_boss_3)).toBe('awaken');
    expect(claimAchievement(p, 'a_boss_3')).toMatchObject({ ok: false, error: 'locked', feature: 'awaken' });
    p.items.crown_dragon = 1; // evidence of use opens it
    expect(claimAchievement(p, 'a_boss_3').ok).toBe(true);
  });

  it('rows whose feature has not shipped are hidden and refuse claims with notLive; M0 mode lists only the shipped 30', () => {
    const p = veteran();
    expect(achievementList(p).some((x) => x.id === 'a_hero_25')).toBe(false);
    expect(achievementList(p, { includeHidden: true }).find((x) => x.id === 'a_hero_25')).toMatchObject({ live: false, claimable: false });
    p.missions.counters.heroMax = 25;
    expect(claimAchievement(p, 'a_hero_25').error).toBe('notLive');
    // the Codex rows shipped with v0.1.45: listed, and refused only while unmet
    expect(achievementList(p).find((x) => x.id === 'a_mr_800')).toMatchObject({ live: true, claimable: false });
    expect(claimAchievement(p, 'a_rules_15').error).toBe('incomplete');
    expect(achievementList(p, { v2: false })).toHaveLength(30);
    p.missions.counters.login = 7;
    expect(claimAchievement(p, 'a_login_7', { v2: false }).error).toBe('notLive');
    expect(claimAchievement(p, 'a_login_7').ok).toBe(true);
    expect(claimAchievement(p, 'a_nope').error).toBe('unknown');
  });

  it('retired rows refuse claims and leave the list', () => {
    const a = ACHIEVEMENT_MAP.a_login_7;
    a.retired = true;
    try {
      const p = veteran();
      p.missions.counters.login = 9;
      expect(claimAchievement(p, 'a_login_7').error).toBe('retired');
      expect(achievementList(p).some((x) => x.id === 'a_login_7')).toBe(false);
    } finally {
      delete a.retired;
    }
  });

  it('Claim all = the sum of single claims, in category order; a second Claim all pays 0', () => {
    const setup = () => {
      const p = veteran();
      clearStages(p, CAMPAIGN_IDS.slice(0, 26));
      p.missions.counters = { ...p.missions.counters, login: 31, kill: 6000, dailyDone: 11 };
      p.gacha.totalPulls = 15;
      return p;
    };
    const a = setup();
    const ids = readyAchievementIds(a);
    let gems = 0;
    for (const id of ids) gems += claimAchievement(a, id).rewards.filter((r) => r.id === 'gems').reduce((n, r) => n + r.count, 0);
    const b = setup();
    const all = claimAllAchievements(b);
    expect(new Set(all.ids)).toEqual(new Set(ids));
    expect(all.rewards.find((r) => r.id === 'gems').count).toBe(gems);
    expect(all.honors).toContain('a_chapter_1');
    expect(all.titles).toContain('a_first_win');
    expect(all.ids.indexOf('a_first_win')).toBeLessThan(all.ids.indexOf('a_kills_5k')); // Campaign before Battles
    expect(claimAllAchievements(b)).toMatchObject({ ok: false, ids: [], rewards: [] });
  });

  it('Claim all repeats until nothing is left, so Achiever counts the claims of the same tap', () => {
    const p = veteran();
    clearStages(p, CAMPAIGN_IDS);
    clearStages(p, CAMPAIGN_IDS, 'hard');
    p.missions.counters = { login: 120, kill: 30000, dailyDone: 55, battleWin: 120 };
    p.gacha.totalPulls = 120;
    const r = claimAllAchievements(p);
    expect(r.ids.length).toBeGreaterThanOrEqual(25);
    expect(r.ids).toContain('a_ach_25');
  });

  it('claimAllCount = what Claim all will claim (Achiever included), and leaves the save untouched', () => {
    const p = veteran();
    clearStages(p, CAMPAIGN_IDS);
    clearStages(p, CAMPAIGN_IDS, 'hard');
    p.missions.counters = { login: 120, kill: 30000, dailyDone: 55, battleWin: 120 };
    p.gacha.totalPulls = 120;
    const before = JSON.stringify(p);
    const n = claimAllCount(p);
    expect(JSON.stringify(p)).toBe(before);
    expect(n).toBeGreaterThan(readyAchievementIds(p).length); // a_ach_25 is not ready until the others are claimed
    expect(claimAllAchievements(p).ids.length).toBe(n);
    expect(claimAllCount(p)).toBe(0);
  });

  it('shipped fixes: a_units_all needs 19; a_kills_* count co-op kills', () => {
    expect(ACHIEVEMENT_MAP.a_units_all.goal).toBe(19);
    const p = veteran();
    p.missions.counters.kill = 1000; // co-op kills land only in the counter
    expect(achievementList(p).find((x) => x.id === 'a_kills_1000').claimable).toBe(true);
  });

  it('achievementsReady: the toast diff', () => {
    expect(achievementsReady(['a', 'b'], ['b', 'c', 'd'])).toEqual(['c', 'd']);
    expect(achievementsReady(null, ['x'])).toEqual(['x']);
    expect(achievementsReady(['x'], [])).toEqual([]);
  });

  it('achievementNotice is cached and follows the save', () => {
    const p = veteran();
    expect(achievementNotice(p)).toEqual({ ready: 0, dot: false });
    expect(achievementNotice(p)).toBe(achievementNotice(p));
    p.missions.counters.login = 7;
    expect(achievementNotice(p)).toEqual({ ready: 1, dot: true });
    claimAchievement(p, 'a_login_7');
    expect(achievementNotice(p)).toEqual({ ready: 0, dot: false });
  });

  it('recordMax keeps the highest value', () => {
    const p = createProfile();
    expect(recordMax(p, 'heroMax', 12)).toBe(true);
    expect(recordMax(p, 'heroMax', 9)).toBe(false);
    expect(recordMax(p, 'heroMax', 'x')).toBe(false);
    expect(p.missions.counters.heroMax).toBe(12);
  });

  it('the F2P one-time Achievements row equals the sum of the live defs (135 with social, Codex and a_ch1_act2 … a_ch6_act2)', () => {
    const row = f2pIncomeSummary().oneTime.find((r) => r.source === 'Achievements');
    // (Tryout Day's 15 rows are their own one-time row below: TRYOUT_DAY.md §10.2, §20.5)
    const live = ACHIEVEMENTS.filter((a) => achievementLive(a) && a.wave !== 'tryout');
    const sum = (id) => live.reduce((n, a) => n + a.rewards.filter((r) => r.id === id).reduce((m, r) => m + r.count, 0), 0);
    expect(live).toHaveLength(135);
    expect(row.gems).toBe(sum('gems'));
    expect(row.gems).toBe(14231); // + 670 from the Codex rows, + 62 / 75 / 87 / 100 / 112 / 125 from Chapters 1-6 · Act II (Gate Arc)
    expect(row.tickets).toBe(sum('ticket_recruit') + 10 * sum('ticket_recruit10'));
    expect(row.tickets).toBe(24); // + Every Ribbon, Every Stage's ticket
    expect(row.note).toBe('135 achievements');
  });

  it('Tryout Day\'s 480 gems are a one-time source of their own; the 28-day chart does not move', () => {
    const s = f2pIncomeSummary();
    const row = s.oneTime.find((r) => r.source === 'Tryout Day achievements');
    expect(row).toMatchObject({ gems: 480, tickets: 0, pulls: 4, note: '15 achievements, once', kind: 'oneTime' });
    expect(s.rows.some((r) => /tryout/i.test(r.source))).toBe(false);
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
    // the reset is player-facing (it only wipes the redeemer's own save): it works in production too
    expect(redeemCode(createProfile(), 'reset 67', { allowDev: false })).toMatchObject({ ok: true, action: 'resetProgress' });
  });

  it('ships no developer currency code, and a dev code only works in a dev build', () => {
    // the code table is in the public bundle: nothing in it may be a dev cheat
    expect(Object.values(REDEEM_CODES).filter((c) => c.dev)).toEqual([]);
    for (const c of Object.values(REDEEM_CODES)) expect(c.rewards.every((r) => r.id !== 'gems' || r.count <= 1000)).toBe(true);
    // defence in depth: a def marked dev answers 'invalid' in a production build
    REDEEM_CODES.TESTDEVONLY = { rewards: [{ id: 'gems', count: 5 }], desc: 'test', dev: true };
    try {
      const p = createProfile();
      const gems = p.currencies.gems;
      expect(redeemCode(p, 'testdevonly', { allowDev: false })).toMatchObject({ ok: false, error: 'invalid', rewards: [] });
      expect(p.currencies.gems).toBe(gems);
      expect(p.redeemed || []).toEqual([]);
      expect(redeemCode(p, 'testdevonly', { allowDev: true })).toMatchObject({ ok: true });
      expect(p.currencies.gems).toBe(gems + 5);
      // vitest runs as a dev build, so the default follows import.meta.env.DEV
      expect(import.meta.env.DEV).toBe(true);
      expect(redeemCode(createProfile(), 'testdevonly').ok).toBe(true);
    } finally {
      delete REDEEM_CODES.TESTDEVONLY;
    }
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
    expect(tabs.map((t) => t.id)).toEqual(['general', 'gems', 'recruit', 'boss', 'bounty', 'memento']);
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
    refreshShop(p, MON); // (stamps the day, the week and the game-week marker 'shopwk:asc' first)
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
    // Gate Arc Step 6: the side stage pays its medals at the Act II rate (10 / 20 / 30 / 50) and no first-clear gems or
    // ticket; it is no campaign stage, so the campaign rows leave it out
    expect(s.oneTime.find((r) => r.source === 'Side stages')).toMatchObject({ gems: 110, tickets: 0 });
  });
});
