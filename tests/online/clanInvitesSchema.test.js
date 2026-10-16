// Clan invites and the daily recruiting post (supabase/migrations/20261018000000_clan_invites.sql) on a real
// Postgres (PGlite): every migration applied twice, with and without Supabase's default grants. Lint (RLS, no
// grants, the client's rate numbers and rules in the SQL), the order guard, the ACL allow-list, the JS mirror ≡
// SQL (recruiting card, recruiting text), who may invite / be invited, blocks and "Nobody" swallowed, decline
// tombstones, expiry, member caps, kick bans, an inviter who left, the daily and pending caps, rate limits,
// the once-a-day recruiting post on the game day, older-client inserts refused, and a re-paste of the first file.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';
import { RULES } from '../../src/online/limits.js';
import { validMessageMeta } from '../../src/online/clanRules.js';
import { CLAN_INVITE_DAYS, CLAN_INVITE_DAILY, CLAN_INVITE_PENDING_MAX, CLAN_INVITE_KEEP_DAYS, recruitBody } from '../../src/online/clanInviteRules.js';
import { MIGRATIONS_DIR, PGlite, createDb, refused, TEST_DEV_CODE } from './pgHarness.js';

const read = (f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
const FILE = '20261018000000_clan_invites.sql';
const SQL = read(FILE);
const ONLINE_SQL = read('20261008000000_online.sql');
const SOCIAL_SQLS = ['20261013000000_social.sql', '20261015000000_social_open_friends.sql'].map(read).join('\n');
const ENTRY = ['answer_clan_invite', 'clan_invites_version', 'list_clan_invites', 'post_clan_recruit', 'recruit_state', 'send_clan_invite'];
const HELPERS = ['clan_invite_clan', 'clan_recruit_body', 'clan_invites_housekeeping'];

const CARD = { clan: '11111111-1111-4111-8111-111111111111', tag: 'PS', name: 'Petal Squad', emblem: 'gems', members: 3, max: 30, mode: 'open', level: 1 };
const METAS = {
  good: [CARD, { ...CARD, mode: 'request' }, { ...CARD, mode: 'code', tag: 'ABCD', members: 0, max: 1000, level: 20 }],
  bad: [null, {}, { ...CARD, extra: 1 }, { ...CARD, tag: 'ps' }, { ...CARD, tag: 'TOOLONG' }, { ...CARD, name: '' }, { ...CARD, name: 'x'.repeat(21) },
    { ...CARD, members: '3' }, { ...CARD, members: -1 }, { ...CARD, max: 0 }, { ...CARD, level: 21 }, { ...CARD, mode: 'everyone' }, { ...CARD, emblem: 'x'.repeat(25) },
    { ...CARD, clan: 'not a uuid!' }, (({ level, ...rest }) => rest)(CARD), { room: 'ABCDE' }],
};

describe('clan invites migration (lint)', () => {
  it('RLS on, no player grants on its tables, and an order guard before anything is created', () => {
    for (const t of ['clan_invites', 'clan_recruit_posts']) {
      expect(SQL).toContain(`alter table public.${t} enable row level security;`);
      expect(SQL).not.toMatch(new RegExp(`grant [^;]* on (table )?public\\.${t}`, 'i'));
    }
    expect(SQL).toContain('revoke all on public.clan_invites, public.clan_recruit_posts from anon, authenticated;');
    expect(SQL.indexOf('Run 20261013000000_social.sql first')).toBeLessThan(SQL.indexOf('create '));
    expect(SQL).toMatch(/^begin;$/m);
    expect(SQL).toMatch(/^commit;$/m);
  });
  it('uses the client limiter\'s numbers and the shared rules', () => {
    for (const action of ['clan_invite', 'recruit']) {
      const m = SQL.match(new RegExp(`enforce_rate\\('${action}', (\\d+), (\\d+), interval '1 (hour|day)'\\)`));
      expect(m, action).toBeTruthy();
      expect(Number(m[1]), `${action} gap`).toBe(RULES[action].gapMs);
      expect(Number(m[2]), `${action} max`).toBe(RULES[action].max);
      expect(m[3] === 'hour' ? 3600e3 : 86400e3, `${action} window`).toBe(RULES[action].windowMs);
    }
    expect(SQL).toContain(`interval '${CLAN_INVITE_DAYS} days'`);
    expect(SQL).toContain(`v_today >= ${CLAN_INVITE_DAILY}`);
    expect(SQL).toContain(`offset ${CLAN_INVITE_PENDING_MAX - 1}`);
    expect(SQL).toContain(`interval '${CLAN_INVITE_KEEP_DAYS} days'`);
    expect(SQL).toContain(`enforce_rate('clan_join', ${RULES.clan_join.gapMs}, ${RULES.clan_join.max}, interval '1 hour')`);
  });
  it('sits after the social migrations', () => {
    expect(FILE > '20261015000000_social_open_friends.sql').toBe(true);
  });
});

const U = (n) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const [A, B, C, D, E, F, G, H, K] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(U);
const NAMES = [[A, 'Aiko'], [B, 'Bea'], [C, 'Cleo'], [D, 'Dara'], [E, 'Emi'], [F, 'Fumi'], [G, 'Gin'], [H, 'Hana'], [K, 'Kumi']];

describe.skipIf(!PGlite)('clan invites migration: order guard', () => {
  it('refuses to run before the social file, and creates nothing', async () => {
    const { db } = await createDb({ defaultGrants: true, sql: ONLINE_SQL, runs: 1 });
    await refused(db.exec(SQL), /Run 20261013000000_social\.sql first/);
    await db.exec('rollback'); // the file is one transaction: the refused paste is still open
    expect((await db.query(`select to_regclass('public.clan_invites') as t`)).rows[0].t).toBeNull();
  }, 60000);
});

for (const defaultGrants of [true, false])
describe.skipIf(!PGlite)(`clan invites migration (run on Postgres, ${defaultGrants ? 'with' : 'without'} default grants)`, () => {
  let db; let as; let one;
  let ps; let oc; // Petal Squad (A leader, D member; join by request) · Open Court (F leader, G member; open)
  const sup = (text, params) => db.query(text, params);
  const clearRate = (action) => sup('delete from rate_events where action = $1', [action]);
  const invite = async (from, to) => {
    await clearRate('clan_invite');
    return one(from, 'select send_clan_invite($1) as r', [to]);
  };
  const list = (who) => one(who, 'select list_clan_invites() as r');
  const answer = async (who, id, yes) => {
    await clearRate('clan_join');
    return one(who, 'select answer_clan_invite($1, $2) as r', [id, yes]);
  };
  const clanOf = async (uid) => (await sup('select clan_id from clan_members where user_id = $1', [uid])).rows[0]?.clan_id || null;
  const leave = async (uid) => {
    await clearRate('clan_join');
    await as(uid, 'select leave_clan()');
  };
  const ageInvites = (to, days) => sup(`update clan_invites set created_at = now() - make_interval(days => $2) where to_id = $1`, [to, days]);

  beforeAll(async () => {
    ({ db, as, one } = await createDb({ defaultGrants, users: NAMES }));
    [ps] = await as(A, `select * from create_clan('Petal Squad', 'PS', 'gems', 'request', '')`);
    [oc] = await as(F, `select * from create_clan('Open Court', 'OC', 'gems', 'open', '')`);
    await sup(`insert into clan_members (user_id, clan_id, role) values ($1, $2, 'member'), ($3, $4, 'member')`, [D, ps.id, G, oc.id]);
  }, 120000);

  it('players execute only the 6 entry points; anon none; no direct table access', async () => {
    const rows = (await sup(`select p.proname, has_function_privilege('authenticated', p.oid, 'execute') as a, has_function_privilege('anon', p.oid, 'execute') as an
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1)`, [[...ENTRY, ...HELPERS]])).rows;
    expect([...new Set(rows.filter((r) => r.a).map((r) => r.proname))].sort()).toEqual(ENTRY);
    expect(rows.filter((r) => r.an)).toEqual([]);
    await refused(as(A, 'select * from clan_invites'), /permission denied/);
    await refused(as(A, 'select * from clan_recruit_posts'), /permission denied/);
    await refused(as(A, `insert into clan_invites (clan_id, to_id) values ($1, $2)`, [ps.id, B]), /permission denied/);
    await refused(as(A, 'select clan_invite_clan($1)', [A]), /permission denied/);
    expect(await one(A, 'select clan_invites_version() as r')).toBe(1);
  });

  it('the recruiting card and text: the JS mirror says what the SQL says', async () => {
    for (const m of METAS.good) expect((await sup(`select valid_message_meta('recruit', $1::jsonb) as r`, [JSON.stringify(m)])).rows[0].r, JSON.stringify(m)).toBe(true);
    for (const m of METAS.good) expect(validMessageMeta('recruit', m), JSON.stringify(m)).toBe(true);
    for (const m of METAS.bad) {
      const sqlOk = (await sup(`select coalesce(valid_message_meta('recruit', $1::jsonb), false) as r`, [m == null ? null : JSON.stringify(m)])).rows[0].r;
      expect(sqlOk, JSON.stringify(m)).toBe(false);
      expect(validMessageMeta('recruit', m), JSON.stringify(m)).toBe(false);
    }
    // the first migration's rules are unchanged
    expect((await sup(`select valid_message_meta('invite', '{"room":"ABCDE","stage":"1-1"}') as r`)).rows[0].r).toBe(true);
    expect((await sup(`select valid_message_meta('text', null) as r`)).rows[0].r).toBe(true);
    expect((await sup(`select valid_message_meta('text', '{"clan":"x"}') as r`)).rows[0].r).toBe(false);
    for (const mode of ['open', 'request', 'code']) {
      const body = (await sup(`select clan_recruit_body('PS', 'Petal Squad', 12, 30, $1) as r`, [mode])).rows[0].r;
      expect(body).toBe(recruitBody({ tag: 'PS', name: 'Petal Squad', members: 12, max: 30, mode }));
    }
  });

  it('who may invite: the leader and officers; every member only in an open clan; nobody outside a clan', async () => {
    await refused(invite(B, C), /not_member/);
    await refused(invite(D, C), /forbidden: only the leader and officers/);
    expect(await invite(G, C)).toEqual({ state: 'invited' }); // a member of the open clan
    await refused(invite(A, A), /that is you/);
    await refused(invite(A, D), /already in your clan/);
    await refused(invite(A, G), /already in a clan/);
    await as(A, 'select set_role($1, $2)', [D, 'officer']);
    expect(await invite(D, H)).toEqual({ state: 'invited' });
    await as(A, 'select set_role($1, $2)', [D, 'member']);
  });

  it('an invite card with the clan; a repeat sends nothing new; Join works in a request clan', async () => {
    expect(await invite(A, B)).toEqual({ state: 'invited' });
    expect(await invite(A, B)).toEqual({ state: 'invited' });
    const l = await list(B);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ fromId: A, fromName: 'Aiko', clan: { id: ps.id, tag: 'PS', name: 'Petal Squad', joinMode: 'request', memberCount: 2, maxMembers: 30, level: 1 } });
    expect(new Date(l[0].expiresAt) - new Date(l[0].at)).toBe(CLAN_INVITE_DAYS * 86400e3);
    await refused(answer(C, l[0].id, true), /that invite is gone/); // not mine
    expect(await answer(B, l[0].id, true)).toEqual({ id: ps.id });
    expect(await clanOf(B)).toBe(ps.id);
    expect(await list(B)).toEqual([]); // in a clan: no invites
    expect((await sup('select count(*)::int as n from clan_invites where to_id = $1 and status = $2', [B, 'pending'])).rows[0].n).toBe(0);
    await leave(B);
  });

  it('blocks and "Nobody" swallow an invite without a trace; my own block refuses it', async () => {
    await as(C, 'select block_player($1)', [A]);
    expect(await invite(A, C)).toEqual({ state: 'invited' });
    expect((await list(C)).map((i) => i.clan.tag)).toEqual(['OC']); // the earlier invite from the open clan only
    await as(A, 'select block_player($1)', [K]);
    await refused(invite(A, K), /unblock them first/);
    await as(A, 'select unblock_player($1)', [K]);
    await as(C, 'select unblock_player($1)', [A]);
    // no longer blocked: the swallowed invite may go out for real
    expect(await invite(A, C)).toEqual({ state: 'invited' });
    expect((await list(C)).map((i) => i.clan.tag).sort()).toEqual(['OC', 'PS']);
    await as(E, `select set_dm_privacy('nobody')`);
    expect(await invite(A, E)).toEqual({ state: 'invited' });
    expect(await list(E)).toEqual([]);
    await as(E, `select set_dm_privacy('friends')`);
    // a sender I blocked after the invite: hidden from my list
    await as(C, 'select block_player($1)', [G]);
    expect((await list(C)).map((i) => i.clan.tag)).toEqual(['PS']);
    await as(C, 'select unblock_player($1)', [G]);
  });

  it('decline: a 7-day tombstone; after it ends a new invite shows again', async () => {
    const [inv] = (await list(C)).filter((i) => i.clan.tag === 'PS');
    expect(await answer(C, inv.id, false)).toEqual({ state: 'declined' });
    expect((await list(C)).map((i) => i.clan.tag)).toEqual(['OC']);
    expect(await invite(A, C)).toEqual({ state: 'invited' });
    expect((await list(C)).map((i) => i.clan.tag)).toEqual(['OC']); // swallowed
    await sup(`update clan_invites set created_at = now() - interval '8 days' where to_id = $1 and clan_id = $2`, [C, ps.id]);
    expect(await invite(A, C)).toEqual({ state: 'invited' });
    expect((await list(C)).map((i) => i.clan.tag).sort()).toEqual(['OC', 'PS']);
  });

  it('expiry: a 7-day-old invite is gone from the list and can\'t be used', async () => {
    const [inv] = (await list(C)).filter((i) => i.clan.tag === 'OC');
    await sup(`update clan_invites set created_at = now() - interval '7 days 1 minute' where id = $1`, [inv.id]);
    expect((await list(C)).map((i) => i.clan.tag)).toEqual(['PS']);
    await refused(answer(C, inv.id, true), /that invite is gone/);
  });

  it('the member cap holds (the invite stays); an inviter who left makes the invite gone', async () => {
    await sup('update clans set max_members = 2 where id = $1', [ps.id]);
    const [inv] = await list(C);
    await refused(answer(C, inv.id, true), /full/);
    expect((await list(C)).map((i) => i.id)).toEqual([inv.id]);
    await sup('update clans set max_members = 30 where id = $1', [ps.id]);
    // G (open clan member) invites H; G leaves; H's invite is gone
    expect(await invite(G, K)).toEqual({ state: 'invited' });
    const [ik] = await list(K);
    await leave(G);
    expect(await answer(K, ik.id, true)).toEqual({ error: 'gone' });
    expect(await list(K)).toEqual([]);
    expect(await clanOf(K)).toBeNull();
    await clearRate('clan_join');
    await as(G, 'select join_clan($1)', [oc.id]);
  });

  it('a kick ban: lifted by the leader\'s invite, not by a plain member\'s', async () => {
    await sup(`insert into clan_members (user_id, clan_id, role) values ($1, $2, 'member')`, [K, oc.id]);
    await as(F, 'select kick($1)', [K]);
    expect(await invite(G, K)).toEqual({ state: 'invited' });
    const [byMember] = await list(K);
    await refused(answer(K, byMember.id, true), /can't join this clan right now/);
    await sup('delete from clan_invites where to_id = $1', [K]);
    expect(await invite(F, K)).toEqual({ state: 'invited' });
    const [byLeader] = await list(K);
    expect(await answer(K, byLeader.id, true)).toEqual({ id: oc.id });
    expect((await sup('select count(*)::int as n from clan_bans where user_id = $1', [K])).rows[0].n).toBe(0);
    await leave(K);
  });

  it('the developer clan: its members are never invited (swallowed), and it invites nobody', async () => {
    await clearRate('clan_join');
    await as(H, `select join_clan_by_code('${TEST_DEV_CODE}')`);
    expect(await invite(A, H)).toEqual({ state: 'invited' });
    await leave(H);
    expect((await list(H)).map((i) => i.clan.tag)).toEqual(['PS']); // the officer's earlier invite; not a new one
    await sup('delete from clan_invites where to_id = $1', [H]);
    await clearRate('clan_join');
    await as(H, `select join_clan_by_code('${TEST_DEV_CODE}')`);
    await refused(invite(H, E), /not_member/);
    await leave(H);
  });

  it('caps: 10 invites a day per player; 20 pending (the oldest drops); 1 invite per 2 s per sender', async () => {
    const clans = (await sup(`insert into clans (name, tag, emblem, join_mode) select 'Cap Clan ' || n, 'Q' || n, 'gems', 'open' from generate_series(1, 24) n returning id`)).rows.map((r) => r.id);
    await sup(`insert into clan_invites (clan_id, to_id, status, created_at) select c, $1, 'pending', now() - interval '2 hours' from unnest($2::uuid[]) c`, [E, clans.slice(0, 10)]);
    await refused(invite(A, E), /a lot of clan invites today/);
    await ageInvites(E, 2); // two days old: the daily cap is free again, the list is still full of 10 + 10
    await sup(`insert into clan_invites (clan_id, to_id, status, created_at) select c, $1, 'pending', now() - interval '3 days' from unnest($2::uuid[]) c`, [E, clans.slice(10, 20)]);
    expect(await invite(A, E)).toEqual({ state: 'invited' });
    const pending = (await sup(`select clan_id from clan_invites where to_id = $1 and status = 'pending'`, [E])).rows.map((r) => r.clan_id);
    expect(pending).toHaveLength(CLAN_INVITE_PENDING_MAX);
    expect(pending).toContain(ps.id);
    await sup('delete from clan_invites where to_id = $1', [E]);
    await sup('delete from clans where id = any($1::uuid[])', [clans]);
    await clearRate('clan_invite');
    await one(A, 'select send_clan_invite($1) as r', [E]);
    await refused(one(A, 'select send_clan_invite($1) as r', [K]), /rate_limited/);
  });

  it('the recruiting post: leader or officer, once per clan per game day, a card older games read as text', async () => {
    expect(await one(D, 'select recruit_state() as r')).toEqual({ can: false, why: 'role', nextAt: null });
    await refused(as(D, 'select post_clan_recruit()'), /only the leader and officers/);
    await refused(as(B, 'select post_clan_recruit()'), /not_member/);
    expect(await one(A, 'select recruit_state() as r')).toMatchObject({ can: true, why: null });
    await clearRate('chat');
    const m = await one(A, 'select post_clan_recruit() as r');
    expect(m).toMatchObject({ channel: 'global', user_id: A, name: 'Aiko', kind: 'recruit' });
    expect(m.meta).toEqual({ clan: ps.id, tag: 'PS', name: 'Petal Squad', emblem: 'gems', members: 2, max: 30, mode: 'request', level: 1 });
    expect(validMessageMeta('recruit', m.meta)).toBe(true);
    expect(m.body).toBe(recruitBody(m.meta));
    // everyone reads it in global chat like any line
    expect((await as(K, `select kind, body from messages where id = $1`, [m.id]))[0]).toEqual({ kind: 'recruit', body: m.body });
    await clearRate('chat');
    await refused(as(A, 'select post_clan_recruit()'), /daily_limit:\d+/);
    const st = await one(A, 'select recruit_state() as r');
    expect(st).toMatchObject({ can: false, why: 'posted' });
    expect(new Date(st.nextAt) > new Date()).toBe(true);
    await clearRate('chat');
    expect((await one(F, 'select post_clan_recruit() as r')).meta.tag).toBe('OC'); // another clan's own day
    // the next game day opens it again
    await sup(`update clan_recruit_posts set game_day = '2000-01-01' where clan_id = $1`, [ps.id]);
    await clearRate('chat');
    expect((await one(A, 'select post_clan_recruit() as r')).kind).toBe('recruit');
    // an older (or forged) client can't post the kind itself, nor a card on a text line
    await clearRate('chat');
    await refused(as(A, `insert into messages (channel, user_id, body, kind, meta) values ('global', $1, 'x', 'recruit', $2)`, [A, JSON.stringify(m.meta)]), /row-level security/);
    await refused(as(A, `insert into messages (channel, user_id, body, kind, meta) values ('global', $1, 'x', 'text', $2)`, [A, JSON.stringify(m.meta)]), /messages_meta_valid|check constraint/);
    // the developer clan does not recruit
    await clearRate('clan_join');
    await as(H, `select join_clan_by_code('${TEST_DEV_CODE}')`);
    expect(await one(H, 'select recruit_state() as r')).toMatchObject({ can: false, why: 'dev' });
    await refused(as(H, 'select post_clan_recruit()'), /forbidden/);
    await leave(H);
    await clearRate('recruit');
  });

  it('a re-paste of the first migration, then the social files and this one: everything works again', async () => {
    await db.exec(ONLINE_SQL);
    await db.exec(SOCIAL_SQLS);
    await db.exec(SQL);
    const rows = (await sup(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = any($1) and has_function_privilege('authenticated', p.oid, 'execute')`, [[...ENTRY, ...HELPERS]])).rows;
    expect([...new Set(rows.map((r) => r.proname))].sort()).toEqual(ENTRY);
    await sup('delete from clan_recruit_posts');
    await clearRate('chat');
    await clearRate('recruit');
    expect((await one(A, 'select post_clan_recruit() as r')).kind).toBe('recruit');
  });
});
