// The local adapter's friend support "server" (adapters/localSupport.js, mixed into localDb) runs the scenarios of the
// PGlite run of supabase/migrations/20261028000000_friend_support.sql (supportSchema.test.js): publishing, candidates,
// a paying borrow, a key replay, the pair rule, the sixth borrow, the lender cap, young accounts / friendships,
// stale_day, unavailable / stale_card, settle and its next-day void, collect with p_room, a replay, stale_key, and
// the "server not updated yet" switch.
import { describe, it, expect } from 'vitest';
import { createLocalDb } from '../../src/online/adapters/localDb.js';
import { gameDay } from '../../src/core/reset.js';

const H = 3600000;
const DAY = 24 * H;
const K = (n) => `${String(n).padStart(8, '0')}-1111-4111-8111-${String(n).padStart(12, '0')}`;
const unit = (id, extra = {}) => ({ id, lv: 60, bt: 5, aw: 5, p: 6, ...extra });

function setup({ support = true } = {}) {
  let stored = null;
  const clock = { t: Date.parse('2026-10-28T18:00:00Z') };
  const db = createLocalDb({
    read: () => (stored ? JSON.parse(stored) : null),
    write: (s) => { stored = JSON.stringify(s); },
    now: () => clock.t,
    rand: () => 0.42,
    features: { social: true, profile: true, support },
  });
  const edit = (fn) => {
    const s = JSON.parse(stored);
    fn(s);
    stored = JSON.stringify(s);
  };
  const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'N', 'S', ...Array.from({ length: 11 }, (_, i) => `P${i}`)];
  for (const id of ids) db.signIn(id, { name: `Sensei${id}`, level: 5, avatar: 'aoi' });
  edit((s) => {
    for (const id of ids) s.users[id].createdAt = id === 'N' ? clock.t : clock.t - 30 * DAY;
    s.social ||= {};
    s.social.friends ||= {};
  });
  const befriend = (a, b, hoursAgo = 48) => edit((s) => {
    (s.social.friends[a] ||= {})[b] = clock.t - hoursAgo * H;
    (s.social.friends[b] ||= {})[a] = clock.t - hoursAgo * H;
  });
  let k = 0;
  const key = () => K(++k);
  const tick = (ms = 2100) => { clock.t += ms; };
  const lend = (u, card, to = 'friends') => {
    tick();
    return db.setSupport(u, card, 'h1', to);
  };
  const use = (who, owner, unitId, k1 = key(), d = gameDay(clock.t)) => {
    tick();
    return db.useSupport(who, owner, unitId, k1, d);
  };
  return { db, clock, edit, befriend, key, tick, lend, use };
}

const err = (fn) => {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return null;
};

describe('local friend support server', () => {
  it('needs_update before the friend support SQL', () => {
    const { db } = setup({ support: false });
    expect(db.supportProbe()).toBe('needs_update');
    expect(err(() => db.supportState('A'))?.code).toBe('needs_update');
    expect(setup().db.supportProbe()).toBe('ready');
  });

  it('publishes a valid Support Student (an LR girl too), refuses a bad one', () => {
    const { db, lend } = setup();
    expect(lend('A', unit('kohaku', { aw: 6 }))).toEqual({ hash: 'h1', lend: 'friends' });
    expect(db.mySupport('A')).toMatchObject({ exists: true, hash: 'h1', lend: 'friends', unit: { id: 'kohaku', aw: 6 } });
    expect(err(() => lend('A', unit('hikari', { aw: 10 })))?.message).toMatch(/not valid/);
    expect(err(() => lend('A', unit('hikari'), 'everyone'))?.message).toMatch(/unknown setting/);
  });

  it('candidates, a paying borrow, its replay, the pair rule and the refusals', () => {
    const { db, befriend, lend, use, key, edit, tick } = setup();
    for (const o of ['B', 'C', 'D']) befriend('A', o);
    lend('B', unit('hikari'));
    lend('C', unit('luna'), 'nobody');
    lend('D', unit('nami'));
    lend('S', unit('akane'));
    edit((s) => { ((s.social.blocks ||= {}).D ||= {}).A = Date.now(); });
    tick();
    expect(db.supportCandidates('A').map((c) => c.userId)).toEqual(['B']);
    const k1 = key();
    expect(use('A', 'B', 'hikari', k1)).toMatchObject({ paid: true, why: null, replayed: false });
    expect(use('A', 'B', 'hikari', k1)).toMatchObject({ paid: true, replayed: true });
    expect(use('A', 'B', 'hikari')).toMatchObject({ paid: false, why: 'pair' });
    tick();
    expect(db.supportCandidates('A')[0].paidToday).toBe(true);
    expect(err(() => use('A', 'B', 'hikari', key(), '2000-01-01'))?.code).toBe('stale_day');
    for (const [o, id] of [['C', 'luna'], ['D', 'nami'], ['S', 'akane']]) expect(err(() => use('A', o, id))?.code).toBe('unavailable');
    expect(err(() => use('A', 'B', 'luna'))?.code).toBe('stale_card');
  });

  it('young accounts and friendships pay nothing; the sixth borrow and the eleventh lend pay nothing', () => {
    const { lend, use, befriend } = setup();
    befriend('A', 'N');
    lend('N', unit('aoi'));
    expect(use('A', 'N', 'aoi')).toMatchObject({ paid: false, why: 'new_account' });
    befriend('A', 'H', 2);
    lend('H', unit('momo'));
    expect(use('A', 'H', 'momo')).toMatchObject({ paid: false, why: 'new_friend' });
    const owners = [['B', 'hikari'], ['C', 'luna'], ['D', 'nami'], ['E', 'rei'], ['F', 'yuki'], ['G', 'kage']];
    for (const [o, id] of owners) {
      befriend('A', o);
      lend(o, unit(id));
    }
    const paid = owners.map(([o, id]) => use('A', o, id));
    expect(paid.map((x) => x.paid)).toEqual([true, true, true, true, true, false]);
    expect(paid[5].why).toBe('borrower_cap');
    const lends = Array.from({ length: 11 }, (_, i) => {
      befriend(`P${i}`, 'B');
      return use(`P${i}`, 'B', 'hikari');
    });
    // B already paid A once today
    expect(lends.filter((x) => x.paid)).toHaveLength(9);
    expect(lends.filter((x) => !x.paid).every((x) => x.why === 'lender_cap')).toBe(true);
  });

  it('settle pays once; a past day is void; collect with p_room, a replay, stale_key', () => {
    const { db, clock, lend, use, befriend, key, edit } = setup();
    lend('B', unit('hikari'));
    for (let i = 0; i < 3; i++) befriend(`P${i}`, 'B');
    const keys = [0, 1, 2].map((i) => {
      const k1 = key();
      use(`P${i}`, 'B', 'hikari', k1);
      return k1;
    });
    expect(db.settleSupport('P0', keys[0])).toMatchObject({ paid: true, points: 10, replayed: false });
    expect(db.settleSupport('P0', keys[0])).toMatchObject({ paid: true, points: 10, replayed: true });
    expect(db.settleSupport('P1', keys[1])).toMatchObject({ points: 10 });
    // P2's reservation is from yesterday: void
    edit((s) => { s.support.uses.find((r) => r.key === keys[2]).gameDay = '2000-01-01'; });
    expect(db.settleSupport('P2', keys[2])).toMatchObject({ paid: false, points: 0 });
    expect(err(() => db.settleSupport('B', keys[0]))?.code).toBe('not_found');
    expect(db.supportSummary('B')).toEqual({ uncollected: 20 });
    const ck = key();
    expect(db.claimSupportPoints('B', ck, 15)).toMatchObject({ total: 10, left: 10 });
    expect(db.claimSupportPoints('B', ck, 5000)).toMatchObject({ total: 10, replayed: true, left: 10 });
    expect(db.claimSupportPoints('B', key(), 5000)).toMatchObject({ total: 10, left: 0 });
    clock.t += 25 * H;
    expect(err(() => db.claimSupportPoints('B', ck, 5000))?.code).toBe('stale_key');
  });
});
