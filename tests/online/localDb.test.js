import { describe, it, expect, beforeEach } from 'vitest';
import { createLocalDb } from '../../src/online/adapters/localDb.js';
import { OnlineError } from '../../src/online/errors.js';
import { BOSS_HIT_CAP, weekKey } from '../../src/online/clanRules.js';

function setup() {
  let stored = null;
  const clock = { t: Date.parse('2026-10-07T12:00:00Z') };
  const topics = [];
  let n = 0;
  const db = createLocalDb({
    read: () => (stored ? JSON.parse(stored) : null),
    write: (s) => { stored = JSON.stringify(s); },
    now: () => clock.t,
    rand: () => ((n = (n * 9301 + 49297) % 233280) / 233280),
    emit: (t) => topics.push(t),
  });
  db.signIn('A', { name: 'Aiko', level: 12, avatar: 'aoi' });
  db.signIn('B', { name: 'Bea', level: 3, avatar: 'rei' });
  return { db, clock, topics };
}

async function code(fn) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(OnlineError);
    return e;
  }
  throw new Error('expected an OnlineError');
}

describe('local adapter db', () => {
  let db; let clock; let topics;
  beforeEach(() => ({ db, clock, topics } = setup()));

  it('delivers chat in order, keeps the last 50 in history and rate limits', async () => {
    const m = db.send('A', 'global', 'hello');
    expect(m.name).toBe('Aiko');
    expect(topics).toContain('chat:global');
    const e = await code(() => db.send('A', 'global', 'again'));
    expect(e.code).toBe('rate_limited');
    expect(e.retryMs).toBe(2000);
    clock.t += 2000;
    db.send('B', 'global', 'hi Aiko');
    const h = db.history('B', 'global', 50);
    expect(h.map((x) => x.body)).toEqual(['hello', 'hi Aiko']);
    for (let i = 0; i < 60; i++) {
      clock.t += 3100;
      db.send(i % 2 ? 'A' : 'B', 'global', `m${i}`);
    }
    const last = db.history('A', 'global', 50);
    expect(last).toHaveLength(50);
    expect(last.at(-1).body).toBe('m59');
    expect((await code(() => db.send('A', 'global', ''))).code).toBe('invalid');
    expect((await code(() => db.send('A', 'global', 'x'.repeat(201)))).code).toBe('invalid');
  });

  it('20 messages per minute even with 2 s gaps', async () => {
    for (let i = 0; i < 20; i++) {
      db.send('A', 'global', `x${i}`);
      clock.t += 2000;
    }
    expect((await code(() => db.send('A', 'global', 'too many'))).code).toBe('rate_limited');
  });

  it('creates, finds, joins, roles, kicks and leaves clans', async () => {
    const c = db.createClan('A', { name: 'Petal Guard', tag: 'ptl', emblem: 'mall', joinMode: 'open' });
    expect(c.tag).toBe('PTL');
    expect(db.myClan('A').role).toBe('leader');
    expect((await code(() => db.createClan('B', { name: 'petal guard', tag: 'PG' }))).code).toBe('name_taken');
    expect(db.listClans('B', { query: 'petal' }).map((x) => x.id)).toEqual([c.id]);
    db.joinClan('B', c.id);
    expect(db.members('A', c.id)).toHaveLength(2);
    expect(db.getClan('B', c.id).memberCount).toBe(2);
    clock.t += 3000;
    db.send('B', `clan:${c.id}`, 'clan hi');
    expect(db.history('A', `clan:${c.id}`).at(-1).body).toBe('clan hi');
    db.signIn('C', { name: 'Chi' });
    expect((await code(() => db.history('C', `clan:${c.id}`))).code).toBe('not_member');
    expect((await code(() => db.send('C', `clan:${c.id}`, 'sneak'))).code).toBe('not_member');
    expect((await code(() => db.kick('B', 'A'))).code).toBe('forbidden');
    db.setRole('A', 'B', 'officer');
    expect(db.members('A', c.id).find((m) => m.userId === 'B').role).toBe('officer');
    // leader leaves: the officer takes over
    db.leaveClan('A');
    expect(db.myClan('B').role).toBe('leader');
    expect(db.getClan('B', c.id).leaderId).toBe('B');
    db.joinClan('A', c.id);
    db.kick('B', 'A');
    expect(db.myClan('A')).toBe(null);
    // last member leaves: the clan is gone
    db.leaveClan('B');
    expect(db.listClans('A')).toHaveLength(0);
  });

  it('request-only clans: request, list, accept', async () => {
    const c = db.createClan('A', { name: 'Quiet Garden', tag: 'QG', joinMode: 'request' });
    expect((await code(() => db.joinClan('B', c.id))).code).toBe('forbidden');
    db.requestJoin('B', c.id);
    expect(db.listRequests('A', c.id).map((r) => r.name)).toEqual(['Bea']);
    db.answerRequest('A', c.id, 'B', true);
    expect(db.myClan('B').clan.id).toBe(c.id);
    expect(db.listRequests('A', c.id)).toHaveLength(0);
  });

  it('limits clan creation and joins', async () => {
    db.createClan('A', { name: 'First One', tag: 'ONE' });
    db.leaveClan('A');
    const e = await code(() => db.createClan('A', { name: 'Second One', tag: 'TWO' }));
    expect(e.code).toBe('rate_limited');
    expect(e.retryMs).toBeGreaterThan(9 * 60000);
  });

  it('Rosie777 joins the hidden developer clan', async () => {
    expect(db.listClans('A').some((c) => c.isDev)).toBe(false);
    const c = db.joinByCode('A', 'rosie777');
    expect(c.isDev).toBe(true);
    expect(c.name).toBe('Sakura Dev Lab');
    expect(db.myClan('A').clan.isDev).toBe(true);
    expect((await code(() => db.joinByCode('B', 'nope'))).code).toBe('not_found');
  });

  it('clan boss: shared HP, 3 attempts a day, capped hits, one claim', async () => {
    const c = db.createClan('A', { name: 'Boss Hunters', tag: 'BH' });
    db.joinClan('B', c.id);
    const s0 = db.bossState('A', c.id);
    expect(s0.week).toBe(weekKey(clock.t));
    expect(s0.hp).toBe(s0.maxHp);
    let s = db.submitBossDamage('A', 50000);
    expect(s.hp).toBe(s0.maxHp - 50000);
    s = db.submitBossDamage('B', 1e12);
    expect(s.board[0]).toMatchObject({ userId: 'B', damage: BOSS_HIT_CAP });
    expect((await code(() => db.claimBossReward('A', s.week))).code).toBe('forbidden'); // still alive this week
    db.submitBossDamage('A', 10);
    db.submitBossDamage('A', 10);
    expect((await code(() => db.submitBossDamage('A', 10))).code).toBe('rate_limited');
    clock.t += 86400000;
    s = db.submitBossDamage('A', BOSS_HIT_CAP);
    expect(s.defeated).toBe(true);
    expect(s.hp).toBe(0);
    const r = db.claimBossReward('A', s.week);
    expect(r.tier).toBe('S');
    expect(r.rewards.length).toBeGreaterThan(0);
    expect((await code(() => db.claimBossReward('A', s.week))).code).toBe('forbidden');
    expect(db.getClan('A', c.id).xp).toBeGreaterThan(0);
  });

  it('transfer codes are one-time and expire', async () => {
    const t = db.createTransfer('A', '{"save":1}');
    expect(t.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(db.redeemTransfer('B', t.code.toLowerCase())).toBe('{"save":1}');
    expect((await code(() => db.redeemTransfer('B', t.code))).code).toBe('expired');
    const t2 = db.createTransfer('A', 'x');
    clock.t += 25 * 3600 * 1000;
    expect((await code(() => db.redeemTransfer('B', t2.code))).code).toBe('expired');
  });

  it('attempts recharge over a rolling 24 h; last week\'s survivor still pays tier C next week', async () => {
    const c = db.createClan('A', { name: 'Slow Burners', tag: 'SB' });
    db.submitBossDamage('A', 1000);
    clock.t += 12 * 3600 * 1000;
    db.submitBossDamage('A', 1000);
    db.submitBossDamage('A', 1000);
    expect(db.bossState('A', c.id).myHitsToday).toBe(3);
    expect((await code(() => db.submitBossDamage('A', 1))).code).toBe('rate_limited');
    clock.t += 12 * 3600 * 1000 + 1000; // the first attempt is now older than 24 h
    expect(db.bossState('A', c.id).myHitsToday).toBe(2);
    const week = db.bossState('A', c.id).week;
    clock.t += 7 * 86400000; // next week: a fresh boss, last week's (alive) boss pays C
    const s = db.bossState('A', c.id);
    expect(s.week).not.toBe(week);
    expect(s.hp).toBe(s.maxHp);
    expect(s.prev).toMatchObject({ week, tier: 'C', claimed: false, defeated: false, rank: 1 });
    expect(db.claimBossReward('A', week).tier).toBe('C');
    expect(db.bossState('A', c.id).prev.claimed).toBe(true);
  });

  it('invite codes are shown to leaders and officers only', () => {
    const c = db.createClan('A', { name: 'Code Club', tag: 'CC', joinMode: 'code' });
    expect(c.joinCode).toMatch(/^[A-Z0-9]{6}$/);
    db.joinByCode('B', c.joinCode);
    expect(db.getClan('B', c.id).joinCode).toBe(null);
    db.setRole('A', 'B', 'officer');
    expect(db.getClan('B', c.id).joinCode).toBe(c.joinCode);
  });
});
