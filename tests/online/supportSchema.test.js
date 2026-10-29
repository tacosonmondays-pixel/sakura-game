// Friend Support (supabase/migrations/20261028000000_friend_support.sql, docs/specs/BANNERS.md §E.5) on a real
// Postgres (PGlite): every migration applied twice, with and without Supabase's default grants. Lint (RLS, no
// grants, the order guard, the client limiter's numbers, the lender row lock), the shared card-unit validator
// (old vs new answers on a fixed set of cards, an LR girl), and the flows: candidates, a paying borrow, a key
// replay, a second same-pair use recorded unpaid, the sixth borrow, the lender cap, stale_day, the next-day void,
// settle, collect with p_room, a collect replay and stale_key.
import { describe, it, expect, beforeAll } from 'vitest';
import { RULES } from '../../src/online/limits.js';
import { PGlite, createDb, refused, migrationText, migrationsBefore } from './pgHarness.js';

const FILE = '20261028000000_friend_support.sql';
const SQL = migrationText(FILE);
const ENTRY = ['claim_support_points', 'my_support', 'set_support', 'settle_support', 'support_candidates', 'support_state', 'support_summary', 'support_version', 'use_support'];
const HELPERS = ['valid_card_unit', 'valid_profile_card', 'support_now_ms', 'support_dev_lab', 'support_uncollected', 'support_housekeeping'];

describe('friend support migration (lint)', () => {
  it('RLS on, no player grants on its tables, an order guard and the quiet moment first, one transaction', () => {
    for (const t of ['support_cards', 'support_uses', 'support_claims']) {
      expect(SQL).toContain(`alter table public.${t} enable row level security;`);
      expect(SQL).toContain(`revoke all on public.${t} from anon, authenticated;`);
      expect(SQL).not.toMatch(new RegExp(`grant [^;]* on (table )?public\\.${t}\\b`, 'i'));
    }
    expect(SQL.indexOf('Run 20261020000000_profile_gear.sql and 20261021000000_titan_board.sql first')).toBeLessThan(SQL.indexOf('lock table'));
    expect(SQL.indexOf('lock table')).toBeLessThan(SQL.search(/\bcreate (table|or replace|index)/));
    expect(SQL).toMatch(/^begin;$/m);
    expect(SQL).toMatch(/^commit;$/m);
    // the pair rule: a partial unique index, so a second use is recorded unpaid instead of failing
    expect(SQL).toMatch(/create unique index if not exists support_uses_pair_day on public\.support_uses \(borrower_id, owner_id, game_day\) where paid;/);
    expect(SQL).toContain('unique (borrower_id, borrower_key)');
  });
  it('uses the client limiter\'s numbers', () => {
    for (const action of ['support_set', 'support_list', 'support_use']) {
      const m = SQL.match(new RegExp(`enforce_rate\\('${action}', (\\d+), (\\d+), interval '1 hour'\\)`));
      expect(m, action).toBeTruthy();
      expect(Number(m[1]), `${action} gap`).toBe(RULES[action].gapMs);
      expect(Number(m[2]), `${action} max`).toBe(RULES[action].max);
      expect(RULES[action].windowMs).toBe(3600e3);
    }
  });
  it('use_support serialises a lender: the borrower lock, then the lender\'s card row FOR UPDATE, before the counts', () => {
    const body = SQL.slice(SQL.indexOf('create or replace function public.use_support'), SQL.indexOf('create or replace function public.settle_support'));
    const lock = body.indexOf('select * into c from support_cards where user_id = p_owner for update;');
    expect(body.indexOf("pg_advisory_xact_lock(hashtext(v_me::text || ':support'))")).toBeGreaterThan(0);
    expect(lock).toBeGreaterThan(body.indexOf('pg_advisory_xact_lock'));
    expect(lock).toBeLessThan(body.indexOf("'lender_cap'"));
    expect(body).toContain("raise exception 'stale_day:%'");
    expect(body).toContain("'serverNow', support_now_ms()");
    // bounded housekeeping
    expect(SQL).toMatch(/limit 500\);\s+delete from support_claims/);
  });
});

const U = (n) => `${String(n).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const A = U(1);
const OWNERS = [2, 3, 4, 5, 6, 7, 8].map(U); // lenders of A
const BORROWERS = Array.from({ length: 11 }, (_, i) => U(20 + i)); // borrowers of OWNERS[0]
const [B, C, D, E, F, G, H] = OWNERS;
const STRANGER = U(40);
const NEWBIE = U(41);
const USERS = [[A, 'Aiko'], ...OWNERS.map((u, i) => [u, `Lender${i + 1}`]), ...BORROWERS.map((u, i) => [u, `Pal${i + 1}`]), [STRANGER, 'Stranger'], [NEWBIE, 'Newbie']];

// ---- the fixed card set: UR gear, club c, ✦ marks, 8 units, an LR girl, and the reject cases --------------
const gear = (s, main, extra = {}) => ({ s, r: 'legendary', l: 10, m: [main, 0.1234], x: [['critChance', 0.0512, 2], ['rangePct', 0.0421, 1], ['armorPen', 12.4], ['ratePct', 0.0333]], ...extra });
const urGear = (s, main) => ({ s, r: 'ur', l: 12, m: [main, 0.2], x: [['critChance', 0.07, 3, 1], ['rangePct', 0.05, 2, 2], ['armorPen', 14]], c: 7 });
const unit = (id, extra = {}) => ({ id, lv: 60, bt: 5, aw: 5, p: 6, g: [gear('charm', 'atkPct'), urGear('ribbon', 'critChance'), gear('shoes', 'ratePct', { c: 3 })], ...extra });
const LR_UNIT = { id: 'kohaku', lv: 60, bt: 5, aw: 6, p: 6, g: [urGear('charm', 'atkPct')] };
const EIGHT = ['hikari', 'luna', 'nami', 'aoi', 'rei', 'yuki', 'momo', 'akane'].map((id) => unit(id));
const CARDS = {
  good: [
    { v: 1 },
    { v: 1, units: EIGHT, med: { a: [59, 59, 59, 59], pins: ['8-5:nightmare'] }, st: { u: 19, k: 1234 } },
    { v: 1, units: [LR_UNIT, unit('hikari')] },
    { v: 1, units: [{ id: 'aoi', lv: 1, bt: 0, aw: 0 }] },
    { v: 1, units: [unit('rei', { sk: 'rei_sentinel_school' })] },
  ],
  bad: [
    { v: 1, units: [...EIGHT, unit('kage')] }, // nine
    { v: 1, units: [unit('hikari'), unit('hikari')] }, // the same girl twice
    { v: 1, units: [{ ...unit('hikari'), uid: 'g1' }] }, // an extra key
    { v: 1, units: [{ ...unit('hikari'), aw: 10 }] },
    { v: 1, units: [{ ...unit('hikari'), lv: 0 }] },
    { v: 1, units: [{ ...unit('hikari'), lv: '60' }] },
    { v: 1, units: [{ ...unit('hikari'), g: [{ ...gear('charm', 'atkPct'), c: 16 }] }] },
    { v: 1, units: [{ ...unit('hikari'), g: [gear('charm', 'atkPct'), gear('charm', 'atkPct')] }] },
    { v: 1, units: [{ ...unit('hikari'), g: [{ ...gear('charm', 'atkPct'), x: [['atkPct', 0.01, 3, 4]] }] }] },
    { v: 1, units: [{ ...unit('hikari'), g: [{ ...gear('charm', 'atkPct'), name: 'x' }] }] },
    { v: 1, units: [{ id: 'Hikari!', lv: 1, bt: 0, aw: 0 }] },
    { v: 1, gems: 1 },
    { v: 2 },
  ],
};

async function cardAnswers(db) {
  const out = [];
  for (const c of [...CARDS.good, ...CARDS.bad]) out.push((await db.query('select coalesce(public.valid_profile_card($1::jsonb), false) as r', [JSON.stringify(c)])).rows[0].r);
  return out;
}

describe.skipIf(!PGlite)('friend support migration: order guard and the shared validator', () => {
  it('refuses to run before the profile gear and titan board files, and creates nothing', async () => {
    const { db } = await createDb({ defaultGrants: true, sql: migrationsBefore('20261020000000_profile_gear.sql'), runs: 1 });
    await refused(db.exec(SQL), /Run 20261020000000_profile_gear\.sql and 20261021000000_titan_board\.sql first/);
    await db.exec('rollback');
    expect((await db.query(`select to_regclass('public.support_cards') as t`)).rows[0].t).toBeNull();
  }, 60000);

  it('refuses when the first profile file was pasted again after the gear file (its card rules have no club)', async () => {
    const { db } = await createDb({ defaultGrants: true, sql: `${migrationsBefore(FILE)}\n${migrationText('20261016000000_profile.sql')}`, runs: 1 });
    await refused(db.exec(SQL), /Run 20261020000000_profile_gear\.sql first/);
    await db.exec('rollback');
  }, 60000);

  it('valid_profile_card answers exactly as the profile_gear version; valid_card_unit takes an LR girl (aw 6)', async () => {
    const old = await createDb({ defaultGrants: true, sql: migrationsBefore(FILE), runs: 1 });
    const now = await createDb({ defaultGrants: true, runs: 1 });
    const before = await cardAnswers(old.db);
    const after = await cardAnswers(now.db);
    expect(after).toEqual(before);
    expect(after).toEqual([...CARDS.good.map(() => true), ...CARDS.bad.map(() => false)]);
    const unitOk = async (u) => (await now.db.query('select coalesce(public.valid_card_unit($1::jsonb), false) as r', [JSON.stringify(u)])).rows[0].r;
    expect(await unitOk(LR_UNIT)).toBe(true);
    expect(await unitOk({ ...LR_UNIT, aw: 10 })).toBe(false);
    expect(await unitOk({ ...LR_UNIT, extra: 1 })).toBe(false);
    expect(await unitOk(unit('hikari'))).toBe(true);
  }, 120000);
});

for (const defaultGrants of [true, false])
describe.skipIf(!PGlite)(`friend support migration (run on Postgres, ${defaultGrants ? 'with' : 'without'} default grants)`, () => {
  let db; let as; let one;
  const sup = (text, params) => db.query(text, params);
  let day;
  const key = (n) => `${String(n).padStart(8, '0')}-1111-4111-8111-${String(n).padStart(12, '0')}`;
  let k = 0;
  const nextKey = () => key(++k);
  const lend = async (u, card, lendTo = 'friends') => {
    await sup('delete from rate_events');
    return one(u, 'select set_support($1::jsonb, $2, $3) as r', [card == null ? null : JSON.stringify(card), 'h1', lendTo]);
  };
  const use = async (who, owner, unitId, k1 = nextKey(), d = day) => {
    await sup('delete from rate_events');
    return one(who, 'select use_support($1, $2, $3, $4) as r', [owner, unitId, k1, d]);
  };
  const settle = (who, k1) => one(who, 'select settle_support($1) as r', [k1]);
  const befriend = async (a, b, hoursAgo = 48) => {
    for (const [x, y] of [[a, b], [b, a]]) {
      await sup(`insert into friends (user_id, friend_id, since) values ($1, $2, now() - make_interval(hours => $3)) on conflict (user_id, friend_id) do update set since = excluded.since`, [x, y, hoursAgo]);
    }
  };

  beforeAll(async () => {
    ({ db, as, one } = await createDb({ defaultGrants, users: USERS }));
    // everyone is an established account, except the newbie
    // (the profiles trigger keeps created_at: aged the way the owner would, with triggers off)
    await db.exec(`set session_replication_role = replica;
      update profiles set created_at = now() - interval '30 days' where id <> '${NEWBIE}';
      set session_replication_role = default;`);
    for (const o of OWNERS) await befriend(A, o);
    for (const b of BORROWERS) await befriend(b, B);
    await befriend(A, NEWBIE);
    day = (await sup('select public.game_day_key(now()) as d')).rows[0].d;
    await lend(B, unit('hikari'));
    await lend(C, unit('luna'), 'nobody');
    await lend(D, unit('nami'));
    await sup('insert into blocks (blocker_id, blocked_id) values ($1, $2)', [D, A]);
    for (const [o, id] of [[E, 'aoi'], [F, 'rei'], [G, 'yuki'], [H, 'momo']]) await lend(o, unit(id));
    await lend(NEWBIE, LR_UNIT);
    await lend(STRANGER, unit('akane'));
  }, 180000);

  it('players execute only the entry points; anon none; no direct table access', async () => {
    const rows = (await sup(`select p.proname, has_function_privilege('authenticated', p.oid, 'execute') as a, has_function_privilege('anon', p.oid, 'execute') as an
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1)`, [[...ENTRY, ...HELPERS]])).rows;
    expect([...new Set(rows.filter((r) => r.a).map((r) => r.proname))].sort()).toEqual(ENTRY);
    expect(rows.filter((r) => r.an)).toEqual([]);
    for (const t of ['support_cards', 'support_uses', 'support_claims']) await refused(as(A, `select * from ${t}`), /permission denied/);
    await refused(as(A, 'select valid_card_unit($1::jsonb)', ['{}']), /permission denied/);
    expect(await one(A, 'select support_version() as r')).toBe(1);
  });

  it('set_support checks the card unit (an LR girl is fine), the hash and the setting; my_support reads it back', async () => {
    const mine = await one(NEWBIE, 'select my_support() as r');
    expect(mine).toMatchObject({ exists: true, hash: 'h1', lend: 'friends' });
    expect(mine.unit).toEqual(LR_UNIT);
    await refused(lend(A, { ...LR_UNIT, aw: 10 }), /not valid/);
    await refused(lend(A, { ...LR_UNIT, gems: 1 }), /not valid/);
    await sup('delete from rate_events');
    await refused(as(A, `select set_support($1::jsonb, 'BAD HASH', 'friends')`, [JSON.stringify(LR_UNIT)]), /bad support hash/);
    await sup('delete from rate_events');
    await refused(as(A, `select set_support(null, 'h1', 'everyone')`), /unknown setting/);
    expect(await lend(A, null, 'nobody')).toMatchObject({ lend: 'nobody' });
  });

  it('candidates: friends who lend, never "Nobody", a block either way or a stranger', async () => {
    await sup('delete from rate_events');
    const list = await one(A, 'select support_candidates() as r');
    const ids = list.map((x) => x.userId);
    expect(ids).toEqual(expect.arrayContaining([B, E, F, G, H, NEWBIE]));
    expect(ids).not.toContain(C); // lends to nobody
    expect(ids).not.toContain(D); // blocked A
    expect(ids).not.toContain(STRANGER);
    const b = list.find((x) => x.userId === B);
    expect(b.unit.id).toBe('hikari');
    expect(b.paidToday).toBe(false);
  });

  it('a paying borrow, its key replay, a second same-pair use recorded unpaid, refusals', async () => {
    const k1 = nextKey();
    const r = await use(A, B, 'hikari', k1);
    expect(r).toMatchObject({ paid: true, why: null, day, replayed: false, unitId: 'hikari' });
    expect(Number(r.serverNow)).toBeGreaterThan(Date.now() - 600000);
    const again = await use(A, B, 'hikari', k1);
    expect(again).toMatchObject({ paid: true, replayed: true, key: k1 });
    const second = await use(A, B, 'hikari');
    expect(second).toMatchObject({ paid: false, why: 'pair' });
    expect(Number((await sup('select count(*) as n from support_uses where borrower_id = $1 and owner_id = $2', [A, B])).rows[0].n)).toBe(2);
    await sup('delete from rate_events');
    const list = await one(A, 'select support_candidates() as r');
    expect(list.find((x) => x.userId === B).paidToday).toBe(true);
    // refusals (each a definitive 'code: detail'; the client then plays without FP)
    await refused(use(A, B, 'hikari', nextKey(), '2000-01-01'), /stale_day:\d+/);
    await refused(use(A, C, 'luna'), /unavailable/);
    await refused(use(A, D, 'nami'), /unavailable/); // a block reads the same
    await refused(use(A, STRANGER, 'akane'), /unavailable/);
    await refused(use(A, B, 'luna'), /stale_card/);
    await refused(use(A, A, 'hikari'), /invalid/);
  });

  it('young accounts and young friendships borrow but pay nothing', async () => {
    expect(await use(A, NEWBIE, 'kohaku')).toMatchObject({ paid: false, why: 'new_account' });
    await befriend(A, H, 2);
    expect(await use(A, H, 'momo')).toMatchObject({ paid: false, why: 'new_friend' });
    await befriend(A, H, 48);
  });

  it('the sixth paying borrow of a day pays nothing', async () => {
    await sup('delete from support_uses where borrower_id = $1', [A]);
    const out = [];
    for (const [o, id] of [[B, 'hikari'], [E, 'aoi'], [F, 'rei'], [G, 'yuki'], [H, 'momo']]) out.push(await use(A, o, id));
    expect(out.map((x) => x.paid)).toEqual([true, true, true, true, true]);
    // a sixth friend
    await lend(C, unit('luna'), 'friends');
    expect(await use(A, C, 'luna')).toMatchObject({ paid: false, why: 'borrower_cap' });
    await sup('delete from rate_events');
    expect(await one(A, 'select support_state() as r')).toMatchObject({ day, borrowsPaid: 5, borrowCap: 5, lendCap: 100 });
  });

  it('a lender earns from at most 10 paying borrows (100 FP) a day', async () => {
    const before = Number((await sup('select count(*) as n from support_uses where owner_id = $1 and game_day = $2 and paid', [B, day])).rows[0].n);
    const answers = [];
    for (const b of BORROWERS) answers.push(await use(b, B, 'hikari'));
    const paid = answers.filter((x) => x.paid).length;
    expect(before + paid).toBe(10);
    expect(answers.filter((x) => !x.paid).every((x) => x.why === 'lender_cap')).toBe(true);
  });

  it('settle pays 10 + 10 once (a replay answers the same); an earlier day\'s reservation is void', async () => {
    await sup('delete from support_uses');
    const k1 = nextKey();
    await use(A, B, 'hikari', k1);
    const s = await settle(A, k1);
    expect(s).toMatchObject({ paid: true, points: 10, replayed: false });
    expect(await settle(A, k1)).toMatchObject({ paid: true, points: 10, replayed: true });
    expect(await one(B, 'select support_summary() as r')).toEqual({ uncollected: 10 });
    // the unpaid second use settles to 0
    const k2 = nextKey();
    await use(A, B, 'hikari', k2);
    expect(await settle(A, k2)).toMatchObject({ paid: false, points: 0 });
    // a reservation from yesterday: void
    const k3 = nextKey();
    await use(A, E, 'aoi', k3);
    await sup(`update support_uses set game_day = '2000-01-01' where borrower_key = $1`, [k3]);
    expect(await settle(A, k3)).toMatchObject({ paid: false, points: 0 });
    expect(await one(E, 'select support_summary() as r')).toEqual({ uncollected: 0 });
    await refused(settle(A, nextKey()), /not_found/);
    // a lender cannot settle the borrower's key
    await refused(settle(B, k1), /not_found/);
  });

  it('collect: only what fits p_room, a replay returns the stored total, an old key is stale_key', async () => {
    await sup('delete from support_uses');
    for (const b of BORROWERS.slice(0, 3)) {
      const k1 = nextKey();
      await use(b, B, 'hikari', k1);
      await settle(b, k1);
    }
    expect(await one(B, 'select support_summary() as r')).toEqual({ uncollected: 30 });
    const ck = nextKey();
    const c = await one(B, 'select claim_support_points($1, $2) as r', [ck, 25]);
    expect(c).toMatchObject({ total: 20, replayed: false, left: 10 });
    // the same key: the same total, nothing new stamped (even with more room now)
    expect(await one(B, 'select claim_support_points($1, $2) as r', [ck, 5000])).toMatchObject({ total: 20, replayed: true, left: 10 });
    // no room: nothing taken, nothing stored
    const ck0 = nextKey();
    expect(await one(B, 'select claim_support_points($1, 0) as r', [ck0])).toMatchObject({ total: 0, left: 10 });
    expect(Number((await sup('select count(*) as n from support_claims where key = $1', [ck0])).rows[0].n)).toBe(0);
    const ck2 = nextKey();
    expect(await one(B, 'select claim_support_points($1, 5000) as r', [ck2])).toMatchObject({ total: 10, left: 0 });
    // a borrower's key is not a lender collect: nothing of B's for A
    expect(await one(A, 'select claim_support_points($1, 5000) as r', [nextKey()])).toMatchObject({ total: 0 });
    await sup(`update support_claims set at = now() - interval '25 hours' where key = $1`, [ck]);
    await refused(one(B, 'select claim_support_points($1, 5000) as r', [ck]), /stale_key/);
    expect(await one(B, 'select support_state() as r')).toMatchObject({ uncollected: 0, lentToday: 30 });
  });

  it('housekeeping deletes old rows in bounded batches', async () => {
    await sup(`insert into support_uses (borrower_id, owner_id, unit, game_day, borrower_key, created_at)
      select $1, $2, 'hikari', '2000-01-01', gen_random_uuid(), now() - interval '8 days' from generate_series(1, 600)`, [A, B]);
    await use(A, F, 'rei'); // runs one batch
    const left = Number((await sup(`select count(*) as n from support_uses where game_day = '2000-01-01'`)).rows[0].n);
    expect(left).toBe(100);
  });
});
