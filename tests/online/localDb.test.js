import { describe, it, expect, beforeEach } from 'vitest';
import { createLocalDb } from '../../src/online/adapters/localDb.js';
import { OnlineError } from '../../src/online/errors.js';
import { weekKey, bossHitCap, bossMaxHp, BOSS_FULL_RUN_SECONDS, BOSS_MIN_SECONDS } from '../../src/online/clanRules.js';

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

  it('message meta: nothing on text, a tiny { room, stage } on invites (SQL: valid_message_meta)', async () => {
    const bad = [
      ['invite', { room: 'ABCDE', stage: '1-1', pad: 'x'.repeat(2_000_000) }],
      ['invite', { room: 'ABCDE', stage: 'x'.repeat(17) }],
      ['invite', { room: 'abcde' }],
      ['invite', ['ABCDE']],
      ['invite', null],
      ['text', { room: 'ABCDE' }],
    ];
    for (const [kind, meta] of bad) expect((await code(() => db.send('A', 'global', 'x', { kind, meta }))).code).toBe('invalid');
    const m = db.send('A', 'global', 'join me', { kind: 'invite', meta: { room: 'K7Q2Z', stage: '1-1' } });
    expect(m.meta).toEqual({ room: 'K7Q2Z', stage: '1-1' });
  });

  it('new accounts get a digits-only automatic name', () => {
    db.signIn('local-9f3ce79a', {});
    expect(db.me('local-9f3ce79a').name).toMatch(/^Sensei\d{4}$/);
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

  it('invite codes cannot be brute-forced: wrong guesses count (and are saved)', async () => {
    for (let i = 0; i < 10; i++) expect((await code(() => db.joinByCode('B', `GUESS${i}`))).code).toBe('not_found');
    const e = await code(() => db.joinByCode('B', 'Rosie777')); // the 11th try, even the right code
    expect(e.code).toBe('rate_limited');
    clock.t += 3600 * 1000 + 1;
    expect(db.joinByCode('B', 'Rosie777').isDev).toBe(true);
  });

  /** Starts a clan boss battle, lets `secs` of it run, submits `dmg`. */
  function fight(who, dmg, secs = 120) {
    const a = db.startBossAttempt(who);
    clock.t += secs * 1000;
    return db.submitBossDamage(who, a.attemptId, dmg);
  }

  it('clan boss: started + timed battles, capped hits, member-sized pool, 3 a day, one claim', async () => {
    const c = db.createClan('A', { name: 'Boss Hunters', tag: 'BH' });
    db.joinClan('B', c.id);
    const s0 = db.bossState('A', c.id);
    const cap = bossHitCap(s0.bossId);
    expect(s0.week).toBe(weekKey(clock.t));
    expect(s0.maxHp).toBe(bossMaxHp(1, 2, s0.bossId));
    expect(s0.hp).toBe(s0.maxHp);
    // no started battle → nothing to submit
    expect((await code(() => db.submitBossDamage('A', 'a-made-up', 5000))).code).toBe('invalid');
    // too short to count: no damage and no attempt used
    let s = fight('A', 50000, BOSS_MIN_SECONDS - 1);
    expect(s).toMatchObject({ hp: s0.maxHp, myHitsToday: 0 });
    s = fight('A', 50000);
    expect(s.hp).toBe(s0.maxHp - 50000);
    s = fight('B', 1e12, BOSS_FULL_RUN_SECONDS / 2); // forged: clamped to half the cap (half the full-run time)
    expect(s.board[0]).toMatchObject({ userId: 'B', damage: Math.floor(cap / 2) });
    expect((await code(() => db.claimBossReward('A', s.week))).code).toBe('forbidden'); // still alive this week
    fight('A', 10);
    fight('A', 10);
    expect((await code(() => db.startBossAttempt('A'))).code).toBe('rate_limited'); // refused before the battle
    // the pool needs about 3 capped hits per member: two forged maximum hits never end a week
    expect(s0.maxHp).toBeGreaterThan(2 * cap);
    clock.t += 86400000;
    // (the rest of the week, condensed)
    const st = JSON.parse(JSON.stringify(db.bossState('A', c.id)));
    for (let i = 0; i < 6 && !s.defeated; i++) {
      s = fight(i % 2 ? 'B' : 'A', 1e12);
      if (i % 2) clock.t += 86400000;
    }
    expect(st.hp).toBeGreaterThan(0);
    expect(s.defeated).toBe(true);
    expect(s.hp).toBe(0);
    expect((await code(() => db.startBossAttempt('A'))).message).toMatch(/fallen/);
    const r = db.claimBossReward('A', s.week);
    expect(r.tier).toMatch(/^[SA]$/);
    expect(r.rewards.length).toBeGreaterThan(0);
    expect((await code(() => db.claimBossReward('A', s.week))).code).toBe('forbidden');
    expect(db.getClan('A', c.id).xp).toBeGreaterThan(0);
  });

  it('transfer codes are one-time, one live per player, 12 characters, and expire', async () => {
    const t0 = db.createTransfer('A', 'old');
    const t = db.createTransfer('A', '{"save":1}');
    expect(t.code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect((await code(() => db.redeemTransfer('B', t0.code))).code).toBe('not_found'); // replaced
    expect(db.redeemTransfer('B', t.code.toLowerCase().replace(/-/g, ' '))).toBe('{"save":1}');
    expect((await code(() => db.redeemTransfer('B', t.code))).code).toBe('expired');
    const t2 = db.createTransfer('A', 'x');
    clock.t += 25 * 3600 * 1000;
    expect((await code(() => db.redeemTransfer('B', t2.code))).code).toBe('expired');
  });

  it('transfer codes cannot be brute-forced: the 6th try in an hour is refused, misses included', async () => {
    const t = db.createTransfer('A', 'mine');
    for (let i = 0; i < 5; i++) expect((await code(() => db.redeemTransfer('B', `WRNG-WRNG-WRN${i}`))).code).toBe('not_found');
    expect((await code(() => db.redeemTransfer('B', t.code))).code).toBe('rate_limited');
  });

  it('co-op rooms: the secret goes to the host and one guest; wrong codes count', async () => {
    db.signIn('C', { name: 'Chi' });
    const host = db.openRoom('A', 'k7q2z');
    expect(host).toMatchObject({ code: 'K7Q2Z', host: true });
    expect(host.secret).toMatch(/^[A-HJ-NP-Z2-9]{16}$/);
    expect(db.openRoom('A', 'K7Q2Z').secret).toBe(host.secret);
    expect(db.joinRoom('B', 'K7Q2Z')).toEqual({ code: 'K7Q2Z', secret: host.secret, host: false });
    expect(db.roomMembers('K7Q2Z')).toEqual(['A', 'B']);
    expect((await code(() => db.joinRoom('C', 'K7Q2Z'))).code).toBe('full');
    clock.t += 1100;
    expect((await code(() => db.openRoom('C', 'K7Q2Z'))).code).toBe('name_taken');
    expect((await code(() => db.joinRoom('C', 'K7Q2Z'))).code).toBe('rate_limited'); // 1 per second
    db.leaveRoom('B', 'K7Q2Z');
    clock.t += 1100;
    expect(db.joinRoom('C', 'K7Q2Z').secret).toBe(host.secret);
    db.leaveRoom('A', 'K7Q2Z');
    clock.t += 1100;
    expect((await code(() => db.joinRoom('B', 'K7Q2Z'))).code).toBe('not_found');
  });

  it('attempts recharge over a rolling 24 h; last week\'s survivor still pays tier C next week', async () => {
    const c = db.createClan('A', { name: 'Slow Burners', tag: 'SB' });
    fight('A', 1000);
    clock.t += 12 * 3600 * 1000;
    fight('A', 1000);
    fight('A', 1000);
    expect(db.bossState('A', c.id).myHitsToday).toBe(3);
    expect((await code(() => db.startBossAttempt('A'))).code).toBe('rate_limited');
    clock.t += 12 * 3600 * 1000 - 120 * 1000 + 1000; // the first attempt is now older than 24 h
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
    expect(c.joinCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    db.joinByCode('B', c.joinCode);
    expect(db.getClan('B', c.id).joinCode).toBe(null);
    db.setRole('A', 'B', 'officer');
    expect(db.getClan('B', c.id).joinCode).toBe(c.joinCode);
  });
});
