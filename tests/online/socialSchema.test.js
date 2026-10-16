// The social migration (supabase/migrations/20261013000000_social.sql) on a real Postgres
// (PGlite), applied twice after the first migration, with and without Supabase's default grants,
// exercised as several signed-in players: function ACLs (an allow-list), RLS on every new table,
// the privacy matrix (no settings row, no clan), blocks, friends, DMs, co-op invites by DM,
// reports + auto-mute, the material request / donation caps on the 7 PM Central game day, key
// idempotency (replay, void tombstones, claim replay) and clan leave / kick / disband.
import { describe, it, expect, beforeAll } from 'vitest';
import { RULES } from '../../src/online/limits.js';
import { gameDay, nextDailyReset } from '../../src/core/reset.js';
import { donatableItems, requestRule, DONOR_DAILY_POINTS, DONOR_COINS_PER_POINT } from '../../src/online/donateRules.js';
import { FRIEND_MAX, INVITE_TTL_MS } from '../../src/online/socialRules.js';
import { MIGRATION_SQL as sql, PGlite, createDb, refused, TEST_DEV_CODE } from './pgHarness.js';

const SOCIAL_TABLES = ['social_settings', 'friend_codes', 'friend_requests', 'friends', 'blocks', 'coop_partners', 'dm_threads', 'direct_messages',
  'dm_state', 'reports', 'social_mutes', 'donate_items', 'donation_requests', 'donations', 'donation_keys', 'dev_lab_visits', 'clan_bans'];

// every function a signed-in player may execute (the first migration's entry points + the social ones)
const ALLOWED = new Set([
  'create_clan', 'join_clan', 'join_clan_by_code', 'request_join', 'answer_request', 'leave_clan', 'set_role', 'kick', 'touch_active', 'boss_state',
  'start_boss_attempt', 'submit_boss_damage', 'claim_boss_reward', 'create_transfer', 'redeem_transfer', 'open_room', 'join_room', 'leave_room',
  'my_clan', 'my_role', 'clan_level', 'current_week', 'boss_hit_cap', 'valid_display_name', 'valid_message_meta',
  'social_version', 'social_summary', 'player_card', 'set_dm_privacy', 'my_friend_code', 'reset_friend_code', 'send_friend_request',
  'add_friend_by_code', 'answer_friend_request', 'cancel_friend_request', 'remove_friend', 'list_friends', 'list_friend_requests', 'invite_candidates', 'block_player',
  'unblock_player', 'list_blocked', 'send_dm', 'send_coop_invite', 'dm_inbox', 'dm_history', 'dm_mark_read', 'dm_clear', 'invite_state',
  'expire_coop_invites', 'report_player', 'donation_state', 'request_materials', 'cancel_material_request', 'donate', 'settle_donations', 'claim_donations',
  // [profile] supabase/migrations/20261016000000_profile.sql
  'profile_version', 'profile_view', 'my_profile_card', 'set_profile_card', 'set_profile_bio', 'set_profile_visibility',
  // 20261018000000_clan_invites.sql
  'clan_invites_version', 'send_clan_invite', 'list_clan_invites', 'answer_clan_invite', 'recruit_state', 'post_clan_recruit',
]);

describe('social migration (lint)', () => {
  it('enables row level security on every new table and grants no player writes', () => {
    for (const t of SOCIAL_TABLES) {
      expect(sql, t).toContain(`create table if not exists public.${t} (`);
      expect(sql, t).toContain(`alter table public.${t} enable row level security;`);
    }
    const social = sql.slice(sql.indexOf('-- Sakura Sentinels — the SOCIAL UPDATE'));
    expect(social).not.toMatch(/grant (insert|update|delete|all)\b[^;]*to (anon|authenticated)/i);
  });

  it('uses the client limiter\'s numbers for every social rate limit', () => {
    const toMs = (txt) => {
      const [n, unit] = txt.split(' ');
      return Number(n) * { minute: 60e3, hour: 3600e3, day: 86400e3 }[unit.replace(/s$/, '')];
    };
    for (const action of ['dm', 'dm_day', 'dm_new', 'invite', 'friend', 'block', 'report', 'settings', 'card', 'rename', 'donate', 'settle']) {
      const m = sql.match(new RegExp(`enforce_rate\\('${action}', (\\d+), (\\d+), interval '([^']+)'\\)`));
      expect(m, action).toBeTruthy();
      expect(Number(m[1]), `${action} gap`).toBe(RULES[action].gapMs);
      expect(Number(m[2]), `${action} max`).toBe(RULES[action].max);
      expect(toMs(m[3]), `${action} window`).toBe(RULES[action].windowMs);
    }
  });

  it('seeds exactly the requestable materials of src/online/donateRules.js', () => {
    const rows = [...sql.matchAll(/\('(mat_\w+)', '(\w+)', '(\w+)', '([^']+)', (\d+), (\d+), (\d+), (\d+), (true|false)\)/g)];
    const items = donatableItems();
    expect(rows.length).toBe(28);
    expect(rows.map((r) => r[1]).sort()).toEqual(items.map((i) => i.id).sort());
    for (const r of rows) {
      const rule = requestRule(r[1]);
      expect([r[2], r[3], r[4], Number(r[5]), Number(r[6]), Number(r[7]), Number(r[8]), r[9] === 'true'], r[1])
        .toEqual([rule.family, rule.rarity, rule.name, rule.size, rule.perDonor, rule.points, rule.weeklyMax, rule.established]);
    }
    expect(sql).toContain(`v_today + v_points > ${DONOR_DAILY_POINTS}`);
    expect(sql).toContain(`v_points * ${DONOR_COINS_PER_POINT}`);
    expect(sql).toContain(`>= ${FRIEND_MAX}`);
    // no per-conversation trim: flooding must never push a reported message out (SECURITY #4)
    expect(sql.slice(sql.indexOf('function public.social_after_dm'), sql.indexOf('function public.social_report_evidence'))).not.toMatch(/delete from direct_messages/);
    expect(sql).toContain(`v_now + ${INVITE_TTL_MS}`);
  });
});

const U = (n) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const [A, B, C, D, E, F, G, H, I, J, K, L] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'a', 'b', 'c'].map(U);
const NAMES = [[A, 'Aiko'], [B, 'Bea'], [C, 'Cleo'], [D, 'Dara'], [E, 'Emi'], [F, 'Fumi'], [G, 'Gin'], [H, 'Hana'], [I, 'Iris'], [J, 'Juno'], [K, 'Kiri'], [L, 'Lena']];
const KEY = (n) => `${String(n).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;

for (const defaultGrants of [true, false])
describe.skipIf(!PGlite)(`social migration (run on Postgres, ${defaultGrants ? 'with' : 'without'} default grants)`, () => {
  let db; let as; let one;
  const sup = (text, params) => db.query(text, params);
  // (profiles_stamp keeps created_at on updates: skip triggers to backdate an account)
  const age = async (uid, days) => db.exec(`set session_replication_role = replica;
    update profiles set created_at = now() - interval '${Number(days)} days' where id = '${uid}';
    set session_replication_role = default;`);
  const tenure = async (uid, hours) => sup(`update clan_members set joined_at = now() - make_interval(hours => $2) where user_id = $1`, [uid, hours]);
  const clearRate = async (uid, action) => sup('delete from rate_events where user_id = $1 and action = $2', [uid, action]);
  const dm = (from, to, body) => one(from, 'select send_dm($1, $2) as r', [to, body]);
  const card = (who, of) => one(who, 'select player_card($1) as r', [of]);

  beforeAll(async () => {
    ({ db, as, one } = await createDb({ defaultGrants, users: NAMES }));
  }, 90000);

  it('players can execute only the allow-listed entry points (no anon access at all)', async () => {
    const rows = (await sup(`select p.proname, has_function_privilege('authenticated', p.oid, 'execute') as a, has_function_privilege('anon', p.oid, 'execute') as an
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`)).rows;
    const exec = rows.filter((r) => r.a).map((r) => r.proname);
    expect(exec.filter((f) => !ALLOWED.has(f))).toEqual([]);
    expect(rows.filter((r) => r.an).map((r) => r.proname)).toEqual([]);
    for (const f of ['social_report_evidence', 'social_thread_for', 'social_maybe_auto_mute', 'social_dm_why', 'social_housekeeping']) {
      await refused(as(A, `select ${f}(${f === 'social_housekeeping' ? '' : f === 'social_maybe_auto_mute' ? `'${B}'` : f === 'social_report_evidence' ? `'${A}', '${B}', 'dm', null` : `'${A}', '${B}'`})`), /permission denied/);
    }
    // the re-created join_room keeps the block check, either way (a re-run of the first migration would lose it)
    const def = (await sup(`select pg_get_functiondef('public.join_room(text)'::regprocedure) as d`)).rows[0].d;
    expect(def).toMatch(/social_is_blocked\(r\.host_id, auth\.uid\(\)\)/);
    expect(def).toMatch(/coop_partners/);
    const pub = (await sup(`select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1`)).rows.map((r) => r.tablename);
    expect(pub).toEqual(['clan_boss', 'clan_members', 'direct_messages', 'donation_requests', 'friend_requests', 'messages']);
    expect(await one(A, 'select social_version() as r')).toBe(1);
  });

  it('no direct reads or writes on the new tables (except the three realtime reads)', async () => {
    for (const t of SOCIAL_TABLES) {
      await refused(as(A, `delete from ${t}`), /permission denied/);
      await refused(as(A, `truncate ${t}`), /permission denied/);
      if (!['direct_messages', 'friend_requests', 'donation_requests'].includes(t)) await refused(as(A, `select * from ${t}`), /permission denied/);
    }
    await refused(as(A, `insert into blocks (blocker_id, blocked_id) values ($1, $2)`, [B, A]), /permission denied/);
    await refused(as(A, `insert into direct_messages (thread_id, recipient_id, body) values (gen_random_uuid(), $1, 'x')`, [B]), /permission denied/);
    await refused(as(A, `update donation_requests set received = 0`), /permission denied/);
    await refused(as(A, `insert into social_mutes (user_id, until) values ($1, now())`, [B]), /permission denied/);
  });

  it('game day: 7 PM Central, DST-aware, the same key as src/core/reset.js gameDay()', async () => {
    const instants = ['2026-10-13T23:59:59.999Z', '2026-10-14T00:00:00Z', '2026-10-19T00:00:00Z', '2026-11-01T00:00:00Z', '2026-11-01T07:30:00Z',
      '2026-11-02T00:59:59Z', '2026-11-02T01:00:00Z', '2027-03-14T01:00:00Z', '2027-03-14T09:00:00Z', '2027-03-14T23:59:59Z', '2027-03-15T00:00:00Z',
      '2026-03-08T01:00:00Z', '2027-01-03T12:00:00Z', '2027-01-04T01:00:00Z'];
    for (const t of instants) {
      const [row] = await as(A, `select game_day_key($1::timestamptz) as k,
        to_char((($1::timestamptz at time zone 'America/Chicago') - interval '19 hours')::date + 1, 'YYYY-MM-DD') as orch,
        to_char((date_trunc('day', ($1::timestamptz at time zone 'America/Chicago') + interval '5 hours') + interval '19 hours') at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI:SS') as next`, [t]).catch(async () => {
        // game_day_key is internal: ask as the table owner
        return (await sup(`select game_day_key($1::timestamptz) as k,
          to_char((($1::timestamptz at time zone 'America/Chicago') - interval '19 hours')::date + 1, 'YYYY-MM-DD') as orch,
          to_char(((date_trunc('day', ($1::timestamptz at time zone 'America/Chicago') + interval '5 hours') + interval '19 hours') at time zone 'America/Chicago') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS') as next`, [t])).rows;
      });
      const ms = Date.parse(t);
      expect(row.k, t).toBe(gameDay(ms));
      // the orchestrator's expression flips at the same instant, one day earlier in name
      expect(row.orch, t).toBe(row.k);
      expect(`${row.next}.000Z`, t).toBe(new Date(nextDailyReset(ms)).toISOString());
    }
    const [{ k, n }] = (await sup(`select game_day_key(now()) as k, (extract(epoch from next_game_reset()) * 1000)::float8 as n`)).rows;
    expect(k).toBe(gameDay(Date.now()));
    expect(Math.abs(n - nextDailyReset(Date.now()))).toBeLessThan(5000);
  });

  it('privacy: strangers cannot DM each other (but may ask to be friends); no settings row and no clan never fail open', async () => {
    expect((await sup('select count(*)::int as n from social_settings')).rows[0].n).toBe(0);
    // strangers: the same answer whatever either side chose (no setting allows strangers)
    await refused(dm(A, B, 'hi stranger'), /forbidden: only friends and clanmates can message each other/);
    const c = await card(A, B);
    // (no settings row: the default, Friends only)
    // open friend requests (20261015000000_social_open_friends.sql): a stranger may ask, nothing more
    expect(c).toMatchObject({ userId: B, name: 'Bea', canMessage: false, why: 'stranger', myPrivacy: 'friends', friend: 'none', canFriend: true, friendWhy: null, isSelf: false, lastActive: null });
    expect(c).not.toHaveProperty('privacy');
    await refused(as(A, 'select player_card($1)', ['deadbeef-0000-4000-8000-000000000000']), /not_found/);
  });

  it('friend codes: add by code (no id until accepted), accept, then DMs work both ways', async () => {
    const { code } = await one(A, 'select my_friend_code() as r');
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect((await one(A, 'select my_friend_code() as r')).code).toBe(code); // stable
    const r = await one(B, 'select add_friend_by_code($1) as r', [`${code.slice(0, 4).toLowerCase()}-${code.slice(4)}`]);
    expect(r).toEqual({ name: 'Aiko', level: 1, avatar: 'hikari', state: 'requested' });
    // the sender cannot read the request row (it would reveal the code owner's id)
    expect(await as(B, 'select * from friend_requests')).toEqual([]);
    const { incoming, outgoing } = await one(A, 'select list_friend_requests() as r');
    expect(incoming).toHaveLength(1);
    expect(incoming[0]).toMatchObject({ userId: B, name: 'Bea', via: 'code' });
    expect(outgoing).toEqual([]);
    const bOut = (await one(B, 'select list_friend_requests() as r')).outgoing;
    expect(bOut).toHaveLength(1);
    expect(bOut[0]).not.toHaveProperty('userId');
    expect((await as(A, 'select id, from_id from friend_requests')).map((x) => x.from_id)).toEqual([B]); // realtime row for the recipient
    await as(A, 'select answer_friend_request($1, true)', [incoming[0].id]);
    expect((await one(B, 'select list_friends() as r')).map((f) => f.userId)).toEqual([A]);
    const m1 = await dm(A, B, 'Hi Bea! 🌸');
    expect(m1).toMatchObject({ body: 'Hi Bea! 🌸', name: 'Aiko', kind: 'text', mine: true });
    await new Promise((res) => setTimeout(res, 10));
    await dm(B, A, 'Hi Aiko 👩\u200d👩\u200d👧'); // emoji ZWJ sequences are fine
    const inbox = await one(A, 'select dm_inbox(50) as r');
    expect(inbox.threads).toHaveLength(1);
    expect(inbox.threads[0]).toMatchObject({ peer: { userId: B, name: 'Bea' }, unread: 1, canMessage: true });
    expect((await one(A, 'select social_summary() as r'))).toMatchObject({ unreadDms: 1, friendRequests: 0, privacy: 'friends' });
    await as(A, 'select dm_mark_read($1, $2)', [inbox.threads[0].id, 9e15]); // clamped to the last message
    expect((await one(A, 'select social_summary() as r')).unreadDms).toBe(0);
    const hist = await one(B, 'select dm_history($1, null, 30) as r', [inbox.threads[0].id]);
    expect(hist.messages.map((m) => m.body)).toEqual(['Hi Aiko 👩\u200d👩\u200d👧', 'Hi Bea! 🌸']);
    // a third player sees nothing of it
    expect(await as(C, 'select * from direct_messages')).toEqual([]);
    await refused(as(C, 'select dm_history($1, null, 30)', [inbox.threads[0].id]), /not_found/);
    await refused(as(C, 'select dm_mark_read($1, 1)', [inbox.threads[0].id]), /not_found/);
    // a new code makes the old one stop working (and a miss is returned, so the counted try commits)
    await one(A, 'select reset_friend_code() as r');
    expect(await one(C, 'select add_friend_by_code($1) as r', [code])).toEqual({ error: 'not_found' });
  });

  it('message text rules: length, invisible / bidi / blank characters, stacked accents', async () => {
    await clearRate(A, 'dm');
    for (const bad of ['x'.repeat(201), 'hi\u202eevil', 'a\u200bb', '\u2028fake system line', '\u3164', '   ', 'z\u0301\u0302\u0303\u0304\u0305', 'tab\there']) {
      await refused(dm(A, B, bad), /invalid/);
    }
    await refused(as(C, `insert into messages (channel, user_id, body) values ('global', $1, $2)`, [C, 'sneaky\u202etxt']), /invalid: Messages can't contain invisible characters/);
    const ok = await dm(A, B, `${'é'.repeat(200)}`);
    expect(ok.body).toHaveLength(200);
  });

  it('rate limits: 1 DM per 2 s, new conversations per day, 300 a day, friend-code tries commit', async () => {
    await clearRate(A, 'dm');
    await dm(A, B, 'one');
    await refused(dm(A, B, 'two'), /^rate_limited:\d+$/);
    // 300 a day (counted with invites)
    await clearRate(A, 'dm');
    await sup(`insert into rate_events (user_id, action) select $1, 'dm_day' from generate_series(1, 300)`, [A]);
    await refused(dm(A, B, 'too many today'), /^rate_limited:\d+$/);
    await clearRate(A, 'dm_day');
    // 10 new conversations a day
    await sup(`insert into rate_events (user_id, action) select $1, 'dm_new' from generate_series(1, 10)`, [B]);
    await sup(`insert into friends values ($1, $2, now()), ($2, $1, now())`, [B, H]);
    await refused(dm(B, H, 'hello new friend'), /^rate_limited:\d+$/);
    await clearRate(B, 'dm_new');
    // friend-code guessing: every miss counts and commits, then even a right code is refused
    let limited = null;
    let misses = 0;
    for (let i = 0; i < 12 && !limited; i++) {
      try {
        expect(await one(E, 'select add_friend_by_code($1) as r', [`ZZZZ-ZZZ${i}`])).toEqual({ error: 'not_found' });
        misses++;
      } catch (e) {
        limited = e;
      }
    }
    expect(misses).toBe(10);
    expect(limited?.message).toMatch(/^rate_limited:\d+$/);
  });

  it('settings: Friends only / Nobody, both sides must allow; clanmates after 72 h; the dev clan never counts', async () => {
    const [clan] = await as(C, `select * from create_clan('Moon Garden', 'MG', 'gems', 'open', '')`);
    await as(D, 'select join_clan($1)', [clan.id]);
    await refused(dm(C, D, 'hi clanmate'), /forbidden/); // both joined just now
    // the default is Friends only: clanmates of 3+ days still need to be friends (M4)
    await tenure(C, 80);
    await tenure(D, 80);
    await refused(dm(C, D, 'default'), /forbidden: your "Who can message me" setting doesn't include them/);
    expect(await card(C, D)).toMatchObject({ why: 'my_setting', myPrivacy: 'friends', canMessage: false });
    // both choose Friends & clan: clanmates after 72 h each
    await as(C, `select set_dm_privacy('friends_clan')`);
    await as(D, `select set_dm_privacy('friends_clan')`);
    await tenure(D, 0);
    await clearRate(C, 'dm');
    await refused(dm(C, D, 'still too new'), /forbidden: clanmates can message each other after 3 days/); // D: 0 h
    expect((await card(C, D)).why).toBe('clan_new');
    await tenure(D, 73);
    await dm(C, D, 'hi clanmate');
    // symmetric: D switches to Friends only → neither side can write (D's reason is her own setting)
    await as(D, `select set_dm_privacy('friends')`);
    await clearRate(C, 'dm');
    await refused(dm(C, D, 'again'), /forbidden: they can't get messages from you yet/);
    expect((await card(D, C)).why).toBe('my_setting');
    await refused(as(D, `select set_dm_privacy('everyone')`), /invalid/);
    await as(D, `select set_dm_privacy('friends_clan')`);
    // Nobody: friends neither
    await as(B, `select set_dm_privacy('nobody')`);
    await clearRate(A, 'dm');
    await refused(dm(A, B, 'hello?'), /forbidden: they can't get messages from you yet/);
    expect((await card(B, A)).why).toBe('my_setting');
    await as(B, `select set_dm_privacy('friends_clan')`);
    await dm(A, B, 'back again');
    // the developer clan is not a clan for DMs (and stays hidden on cards)
    await as(F, `select join_clan_by_code('${TEST_DEV_CODE}')`);
    await clearRate(E, 'clan_join');
    await as(E, `select join_clan_by_code('${TEST_DEV_CODE}')`);
    await tenure(E, 100);
    await tenure(F, 100);
    await refused(dm(E, F, 'dev hi'), /forbidden/);
    expect((await card(A, E)).clan).toBeNull();
    expect((await card(F, E)).clan).toMatchObject({ tag: 'DEV' });
  });

  it('blocks: refused with the same words as privacy, friendship gone, requests swallowed, chat-room join refused', async () => {
    await as(A, 'select block_player($1)', [B]);
    expect((await one(A, 'select list_blocked() as r')).map((x) => x.userId)).toEqual([B]);
    expect(await one(A, 'select list_friends() as r')).toEqual([]);
    await clearRate(B, 'dm');
    await refused(dm(B, A, 'why?'), /forbidden/);
    expect((await card(A, B))).toMatchObject({ blockedByMe: true, why: 'blocked_by_me', canMessage: false });
    // a block reads exactly like a privacy refusal: C and D are clanmates of 3+ days
    await clearRate(C, 'dm');
    await dm(C, D, 'before');
    await as(D, 'select block_player($1)', [C]);
    await clearRate(C, 'dm');
    const blocked = await refused(dm(C, D, 'after'), /forbidden/);
    const blockedWhy = (await card(C, D)).why;
    await as(D, 'select unblock_player($1)', [C]);
    await as(D, `select set_dm_privacy('friends')`);
    await clearRate(C, 'dm');
    const setting = await refused(dm(C, D, 'after'), /forbidden/);
    expect(blocked.message).toBe(setting.message);
    expect(blocked.message).toBe('forbidden: they can\'t get messages from you yet');
    expect(blockedWhy).toBe((await card(C, D)).why);
    await as(D, `select set_dm_privacy('friends_clan')`);
    // B's friend request is swallowed: B sees "requested", A sees nothing
    const { code } = await one(A, 'select my_friend_code() as r');
    expect((await one(B, 'select add_friend_by_code($1) as r', [code])).state).toBe('requested');
    expect((await one(A, 'select list_friend_requests() as r')).incoming).toEqual([]);
    expect(await as(A, 'select * from friend_requests')).toEqual([]);
    expect((await one(A, 'select social_summary() as r')).friendRequests).toBe(0);
    // a blocked guest cannot take the host's co-op seat (it reads like a full room: SECURITY #6)
    await as(A, `select open_room('BLKD1')`);
    expect(await one(B, `select join_room('BLKD1') as r`)).toEqual({ error: 'full' });
    await as(A, `select leave_room('BLKD1')`);
    // the inbox hides the conversation; unblocking brings it back
    expect((await one(A, 'select dm_inbox(50) as r')).threads).toEqual([]);
    await clearRate(A, 'block');
    await as(A, 'select unblock_player($1)', [B]);
    expect((await one(A, 'select dm_inbox(50) as r')).threads).toHaveLength(1);
  });

  it('friend requests: decline tombstone swallows repeats, a full queue drops its oldest, co-op partners may ask', async () => {
    // G and H play co-op: that is a context for a friend request
    await as(G, `select open_room('COOP7')`);
    expect((await one(H, `select join_room('COOP7') as r`)).host).toBe(false);
    expect(await one(H, 'select send_friend_request($1) as r', [G])).toEqual({ state: 'requested' });
    const [{ r: list }] = await as(G, 'select list_friend_requests() as r');
    expect(list.incoming[0]).toMatchObject({ userId: H, name: 'Hana', via: 'coop' });
    // the stamped name stays even if H renames
    await as(H, `update profiles set name = 'Hanako' where id = $1`, [H]);
    expect((await one(G, 'select list_friend_requests() as r')).incoming[0].name).toBe('Hana');
    await as(G, 'select answer_friend_request($1, false)', [list.incoming[0].id]);
    await clearRate(H, 'friend');
    expect(await one(H, 'select send_friend_request($1) as r', [G])).toEqual({ state: 'requested' }); // swallowed
    expect((await one(G, 'select list_friend_requests() as r')).incoming).toEqual([]);
    expect((await card(H, G)).friend).toBe('requested');
    // asking back turns a pending request into a friendship at once
    await as(G, `select leave_room('COOP7')`);
    await as(I, `select open_room('COOP8')`);
    await as(J, `select join_room('COOP8')`);
    await one(I, 'select send_friend_request($1) as r', [J]);
    expect(await one(J, 'select send_friend_request($1) as r', [I])).toEqual({ state: 'friends' });
    expect((await one(I, 'select list_friends() as r')).map((f) => f.userId)).toEqual([J]);
  });

  it('names: 3 changes a day; blank-looking names refused', async () => {
    await clearRate(F, 'rename');
    for (const n of ['Fumi 2', 'Fumi 3', 'Fumi 4']) await as(F, 'update profiles set name = $1 where id = $2', [n, F]);
    await refused(as(F, `update profiles set name = 'Fumi 5' where id = $1`, [F]), /^rate_limited:\d+$/);
    await as(F, 'update profiles set level = 9 where id = $1', [F]); // level changes are not renames
    await clearRate(F, 'rename');
    for (const bad of ['Fu\u3164mi', '\u2800\u2800', 'Fu\u2028mi', 'Z\u0300\u0301\u0302\u0303\u0304ed', '\u034f\u034f', '\u3000\u3000', '\u17b4\u17b4', 'Fumi\u3000']) {
      await refused(as(F, 'update profiles set name = $1 where id = $2', [bad, F]), /invalid: names need visible letters/);
    }
    for (const bad of ['\u0405ystem', 'Supply B\u043et', '\uff33\uff59\uff53\uff54\uff45\uff4d', '\u0391dmin', 'S\u00fdstem', 'M\u039fD']) {
      await refused(as(F, 'update profiles set name = $1 where id = $2', [bad, F]), /invalid: that name is reserved/);
    }
    await clearRate(F, 'rename');
    await as(F, `update profiles set name = 'Fumi' where id = $1`, [F]);
  });

  let roomCode;
  it('co-op invites by DM: only the host of a free room, server text + expiry, one live invite per pair, 4 an hour', async () => {
    // A and B are friends again
    await sup(`insert into friends values ($1, $2, now()), ($2, $1, now()) on conflict do nothing`, [A, B]);
    await clearRate(A, 'dm');
    await refused(as(A, `select send_coop_invite($1, 'ROOM1', '1-3', 'hard')`, [B]), /invalid: open your co-op room first/);
    roomCode = 'ROOM1';
    await clearRate(A, 'room');
    await as(A, `select open_room($1)`, [roomCode]);
    await refused(as(A, `select send_coop_invite($1, $2, 'boss-lych', 'hard')`, [B, roomCode]), /invalid: pick a campaign stage/);
    await refused(as(A, `select send_coop_invite($1, $2, '1-3', 'insane')`, [B, roomCode]), /invalid/);
    const t0 = Date.now();
    const inv = await one(A, `select send_coop_invite($1, $2, '1-3', 'hard') as r`, [B, roomCode]);
    expect(inv).toMatchObject({ kind: 'invite', body: 'Co-op invite: stage 1-3 (Hard)', inviteState: 'open' });
    expect(Object.keys(inv.meta).sort()).toEqual(['difficulty', 'expires', 'room', 'stage']);
    expect(inv.meta.expires - t0).toBeGreaterThan(INVITE_TTL_MS - 60000);
    expect(inv.meta.expires - t0).toBeLessThan(INVITE_TTL_MS + 60000);
    expect(await one(B, 'select invite_state($1) as r', [inv.id])).toBe('open');
    await refused(as(C, 'select invite_state($1)', [inv.id]), /not_found/);
    // a new invite expires the previous one
    await new Promise((r) => setTimeout(r, 5100));
    const inv2 = await one(A, `select send_coop_invite($1, $2, '1-4', 'normal') as r`, [B, roomCode]);
    expect(await one(B, 'select invite_state($1) as r', [inv.id])).toBe('expired');
    expect(await one(B, 'select invite_state($1) as r', [inv2.id])).toBe('open');
    // the room lobby's "Invite a friend" list: friends + clanmates, never someone I blocked
    const cands = await one(A, 'select invite_candidates() as r');
    expect(cands.find((x) => x.userId === B)).toMatchObject({ friend: true, name: 'Bea' });
    expect(cands.every((x) => x.userId !== A)).toBe(true);
    // B takes the seat: open for B, full for everyone else
    await clearRate(B, 'room');
    await as(B, `select join_room($1)`, [roomCode]);
    expect(await one(B, 'select invite_state($1) as r', [inv2.id])).toBe('open');
    expect(await one(A, 'select invite_state($1) as r', [inv2.id])).toBe('full');
    await refused(as(A, `select send_coop_invite($1, $2, '1-4', 'normal')`, [B, roomCode]), /invalid: your room already has two players/);
    // the room closes → 'closed'
    await as(A, 'select leave_room($1)', [roomCode]);
    expect(await one(B, 'select invite_state($1) as r', [inv2.id])).toBe('closed');
    // at most 4 invites an hour to the same player
    await clearRate(A, 'room');
    await as(A, `select open_room('ROOM2')`);
    await sup(`update direct_messages set created_at = created_at - interval '1 minute' where kind = 'invite'`);
    await sup(`insert into direct_messages (thread_id, sender_id, recipient_id, name, body, kind, meta)
      select thread_id, sender_id, recipient_id, name, body, kind, meta from direct_messages where kind = 'invite' limit 2`);
    await clearRate(A, 'invite');
    await refused(as(A, `select send_coop_invite($1, 'ROOM2', '1-1', 'easy')`, [B]), /^rate_limited:\d+$/);
    await as(A, `select leave_room('ROOM2')`);
  }, 30000);

  it('reports: server-made evidence, one open report per pair, 3 fresh alts cannot mute, 3 qualified reporters can', async () => {
    // B reports A's DM: the evidence is the server's copy (not the client's words)
    const [{ id: msgId }] = (await sup(`select id from direct_messages where sender_id = $1 and recipient_id = $2 and kind = 'text' order by id desc limit 1`, [A, B])).rows;
    await as(B, `select report_player($1, 'bullying', 'she was mean', 'dm', $2)`, [A, msgId]);
    await clearRate(B, 'report');
    await as(B, `select report_player($1, 'spam', 'and spammy', 'dm', $2)`, [A, msgId]);
    const reps = (await sup('select * from reports where target_id = $1', [A])).rows;
    expect(reps).toHaveLength(1); // the repeat updated the open report
    expect(reps[0]).toMatchObject({ reason: 'spam', note: 'and spammy', target_name: 'Aiko', context: 'dm', qualified: false });
    expect(reps[0].evidence.message).toMatchObject({ kind: 'dm', id: Number(msgId) });
    expect(reps[0].evidence.dms.length).toBeGreaterThan(0);
    expect(JSON.stringify(reps[0].evidence).length).toBeLessThan(8192 * 2);
    await refused(as(C, `select report_player($1, 'other', '', 'profile', null)`, [C]), /invalid/);
    await refused(as(C, `select report_player('deadbeef-0000-4000-8000-000000000000', 'other', '', 'profile', null)`), /not_found/);
    await refused(as(C, `select report_player($1, 'other', $2, 'profile', null)`, [D, 'x'.repeat(201)]), /invalid/);
    // three brand-new accounts report D: no mute
    for (const who of [E, F, G]) await as(who, `select report_player($1, 'bullying', '', 'profile', null)`, [D]);
    expect((await sup('select count(*)::int as n from social_mutes')).rows[0].n).toBe(0);
    // three 8-day-old accounts that D messaged recently: D is muted from DMs for 24 h (not from chat)
    for (const who of [C, I, J]) {
      await age(who, 8);
      await sup(`insert into friends values ($1, $2, now()), ($2, $1, now()) on conflict do nothing`, [D, who]);
      await clearRate(D, 'dm');
      await dm(D, who, 'you are bad at this');
    }
    for (const who of [C, I, J]) {
      await clearRate(who, 'report');
      await as(who, `select report_player($1, 'bullying', '', 'dm', null)`, [D]);
    }
    const [mute] = (await sup('select * from social_mutes where user_id = $1', [D])).rows;
    expect(mute).toMatchObject({ created_by: 'auto' });
    await clearRate(D, 'dm');
    await refused(dm(D, C, 'hey'), /forbidden: you can't send messages right now/);
    expect((await card(D, C)).why).toBe('muted');
    await as(D, `insert into messages (channel, user_id, body) values ('global', $1, 'chat still works')`, [D]);
    // an owner mute also covers chat
    await sup(`update social_mutes set created_by = 'owner' where user_id = $1`, [D]);
    await clearRate(D, 'chat');
    await refused(as(D, `insert into messages (channel, user_id, body) values ('global', $1, 'nope')`, [D]), /forbidden: you can't send messages right now/);
    await sup('delete from social_mutes');
  });

  // ---- donations ----------------------------------------------------------------------------
  let clanId;
  let reqId;
  it('material requests: allow-list, tenure, one per game day across clans, mythic needs an established clan', async () => {
    await sup('delete from clan_members where user_id = any($1)', [[C, D, E, F]]);
    await sup(`delete from clans where name = 'Moon Garden'`);
    const [clan] = await as(E, `select * from create_clan('Donor Den', 'DD', 'gems', 'open', '')`);
    clanId = clan.id;
    for (const who of [F, G, H]) {
      await clearRate(who, 'clan_join');
      await as(who, 'select join_clan($1)', [clanId]);
    }
    await refused(as(E, `select request_materials('mat_feather_rare')`), /forbidden: you can ask after a day/);
    await tenure(E, 25);
    for (const bad of ['gems', 'book_rare', 'mat_feather_legendary', 'star_fragment', 'coins']) {
      await refused(as(E, 'select request_materials($1)', [bad]), /invalid: that item can't be requested/);
    }
    await refused(as(E, `select request_materials('mat_feather_mythic')`), /invalid: mythic requests open/);
    const r = await one(E, `select request_materials('mat_feather_rare') as r`);
    reqId = r.id;
    expect(r).toMatchObject({ item: 'mat_feather_rare', wanted: 6, received: 0, status: 'open', open: true, perDonor: 3, points: 2, name: 'Emi' });
    expect(r.gameDay).toBe(gameDay(Date.now()));
    const notice = (await sup(`select body from messages where channel = $1 and kind = 'system' order by id desc limit 1`, [`clan:${clanId}`])).rows[0].body;
    expect(notice).toBe('Emi asks for 6 × Swallow Plume. Clan → Requests to help!');
    const e1 = await refused(as(E, `select request_materials('mat_blade_common')`), /^daily_limit:\d+$/);
    const ms = Number(e1.message.split(':')[1]);
    expect(Math.abs(Date.now() + ms - nextDailyReset(Date.now()))).toBeLessThan(5000);
    // the realtime table: clanmates and the requester read it, nobody else
    expect((await as(F, 'select id from donation_requests')).map((x) => x.id)).toEqual([reqId]);
    expect(await as(A, 'select id from donation_requests')).toEqual([]);
  });

  it('donations: donor rules, per-donor and per-request caps, 30 points a day, clan XP, filled notice', async () => {
    const give = (who, n, key, req = reqId) => one(who, 'select donate($1, $2, $3) as r', [req, n, key]);
    await refused(give(E, 1, KEY(1)), /invalid: you can't donate to your own request/);
    await refused(give(F, 1, KEY(2)), /forbidden: you can donate after 3 days/);
    await tenure(F, 73);
    await refused(give(F, 1, KEY(3)), /forbidden: new online accounts can donate after 7 days/);
    for (const who of [F, G, H]) await age(who, 8);
    for (const who of [G, H]) await tenure(who, 73);
    await sup(`insert into dev_lab_visits values ($1, now() - interval '1 day')`, [H]);
    await refused(give(H, 1, KEY(4)), /forbidden: no donations for a week after leaving the developer clan/);
    await sup('delete from dev_lab_visits');
    await refused(give(F, 4, KEY(5)), /invalid: you can give at most 3/);
    const xp0 = Number((await sup('select xp from clans where id = $1', [clanId])).rows[0].xp);
    const d1 = await give(F, 3, KEY(6));
    expect(d1).toMatchObject({ item: 'mat_feather_rare', count: 3, points: 6, reward: { coins: 300 }, replayed: false, donatedToday: 6, cap: 30 });
    expect(d1.request).toMatchObject({ received: 3, myGiven: 3, donors: ['Fumi'] });
    expect(Number((await sup('select xp from clans where id = $1', [clanId])).rows[0].xp)).toBe(xp0 + 6);
    await clearRate(F, 'donate');
    await refused(give(F, 1, KEY(7)), /invalid: you can give at most 3/);
    // the same key again: the same answer, no second effect
    const again = await give(F, 3, KEY(6));
    expect(again).toMatchObject({ key: KEY(6), count: 3, points: 6, replayed: true, reward: { coins: 300 } });
    expect((await sup('select received from donation_requests where id = $1', [reqId])).rows[0].received).toBe(3);
    await refused(give(G, 4, KEY(8)), /invalid: that request needs only 3 more/);
    const d2 = await give(G, 3, KEY(9));
    expect(d2.request).toMatchObject({ received: 6, status: 'filled', donors: ['Fumi', 'Gin'] });
    const notice = (await sup(`select body from messages where channel = $1 and kind = 'system' order by id desc limit 1`, [`clan:${clanId}`])).rows[0].body;
    expect(notice).toBe('Emi\'s request is filled — thanks Fumi, Gin!');
    await refused(give(H, 1, KEY(10)), /invalid: that request is already filled/);
    // 30 points a day across requests: F has 6; requests from H (rare, 2 points) and G... fill up
    await tenure(H, 25);
    await tenure(F, 100);
    const rH = await one(H, `select request_materials('mat_rune_superRare') as r`); // 3 × 5 points, 2 per donor
    await clearRate(F, 'donate');
    expect((await give(F, 2, KEY(11), rH.id)).donatedToday).toBe(16);
    await sup(`update donations set points = 20 where donor_key = $1`, [KEY(11)]); // as if F had given more elsewhere today
    await clearRate(G, 'donate');
    await clearRate(F, 'donate');
    await sup(`update donation_requests set received = 0, status = 'open' where id = $1`, [rH.id]);
    await sup(`delete from donations where donor_key = $1`, [KEY(11)]);
    await sup(`insert into donations (request_id, requester_id, donor_id, donor_name, clan_id, item, count, points, game_day, donor_key)
      values ($1, $2, $3, 'Fumi', $4, 'mat_rune_superRare', 1, 20, $5, $6)`, [rH.id, H, F, clanId, gameDay(Date.now()), KEY(12)]);
    const lim = await refused(give(F, 1, KEY(13), rH.id), /^daily_limit:\d+$/); // 26 + 5 > 30
    expect(Number(lim.message.split(':')[1])).toBeGreaterThan(0);
    expect((await give(G, 2, KEY(14), rH.id)).donatedToday).toBe(16); // G: 6 + 10
  });

  it('a lost answer: settle voids unknown keys (a late donate then does nothing), reports applied ones with their reward', async () => {
    const st = await one(F, 'select settle_donations($1::uuid[]) as r', [[KEY(6), KEY(20)]]);
    expect(st).toEqual([
      { key: KEY(6), state: 'applied', item: 'mat_feather_rare', count: 3, coins: 300 },
      { key: KEY(20), state: 'voided', item: null, count: 0, coins: 0 },
    ]);
    const rG = await one(G, `select donation_state() as r`);
    expect(rG.donatedToday).toBe(16);
    const reqs = (await one(F, 'select donation_state() as r')).requests;
    const open = reqs.find((x) => x.status === 'open');
    expect(open).toBeTruthy();
    await clearRate(F, 'donate');
    expect(await one(F, 'select donate($1, 1, $2) as r', [open.id, KEY(20)])).toEqual({ key: KEY(20), voided: true });
    expect((await sup('select count(*)::int as n from donations where donor_key = $1', [KEY(20)])).rows[0].n).toBe(0);
    await refused(as(F, 'select settle_donations($1::uuid[])', [Array.from({ length: 21 }, (_, i) => KEY(100 + i))]), /invalid/);
  });

  it('collect: one key stamps everything, the same key replays (24 h), a donor cannot replay it, a new key finds nothing', async () => {
    const st = await one(E, 'select donation_state() as r');
    expect(st.collectable).toEqual([{ item: 'mat_feather_rare', count: 6 }]);
    expect((await one(E, 'select social_summary() as r')).donationsReady).toBe(6);
    const c1 = await one(E, 'select claim_donations($1) as r', [KEY(30)]);
    expect(c1).toMatchObject({ key: KEY(30), replayed: false, items: [{ item: 'mat_feather_rare', count: 6 }] });
    expect(c1.items[0].from.sort()).toEqual(['Fumi', 'Gin']);
    expect(await one(E, 'select claim_donations($1) as r', [KEY(30)])).toMatchObject({ replayed: true, items: [{ item: 'mat_feather_rare', count: 6 }] });
    expect((await one(F, 'select claim_donations($1) as r', [KEY(30)])).items).toEqual([]); // the donor
    expect((await one(E, 'select claim_donations($1) as r', [KEY(31)])).items).toEqual([]);
    expect((await one(E, 'select donation_state() as r')).collectable).toEqual([]);
    await sup(`update donations set claimed_at = now() - interval '25 hours' where claim_key = $1`, [KEY(30)]);
    expect(await one(E, 'select claim_donations($1) as r', [KEY(30)])).toMatchObject({ expired: true, items: [] });
  });

  it('7 PM Central: yesterday\'s request takes no donations and frees today\'s slot', async () => {
    const rH = (await sup(`select * from donation_requests where user_id = $1`, [H])).rows[0];
    await sup(`update donation_requests set game_day = to_char(now() - interval '2 days', 'YYYY-MM-DD') where id = $1`, [rH.id]);
    await clearRate(G, 'donate');
    await refused(as(G, 'select donate($1, 1, $2)', [rH.id, KEY(40)]), /invalid: that request is closed/);
    const r = await one(H, `select request_materials('mat_cog_common') as r`);
    expect(r).toMatchObject({ wanted: 10, open: true });
    expect((await one(H, 'select donation_state() as r')).myRequest.id).toBe(r.id);
  });

  it('leave / kick / disband: a gone requester\'s request closes, what arrived stays collectable', async () => {
    const r = (await one(H, 'select donation_state() as r')).myRequest;
    await clearRate(G, 'donate');
    await one(G, 'select donate($1, 2, $2) as r', [r.id, KEY(50)]);
    await as(E, 'select kick($1)', [H]); // E leads the clan
    await clearRate(G, 'donate');
    await refused(as(G, 'select donate($1, 1, $2)', [r.id, KEY(51)]), /not_member|invalid: that request is closed/);
    const st = await one(H, 'select donation_state() as r');
    expect(st).toMatchObject({ clanId: null, canRequest: false, requestWhy: 'no_clan' });
    expect(st.collectable).toEqual(expect.arrayContaining([{ item: 'mat_cog_common', count: 2 }]));
    // the clan disbands: requests and donations keep their rows (clan_id set null)
    for (const who of [F, G, E]) {
      await clearRate(who, 'clan_join');
      await as(who, 'select leave_clan()');
    }
    expect((await sup('select count(*)::int as n from clans where id = $1', [clanId])).rows[0].n).toBe(0);
    expect((await sup('select count(*)::int as n from donation_requests where clan_id is null')).rows[0].n).toBeGreaterThan(0);
    const c = await one(H, 'select claim_donations($1) as r', [KEY(52)]);
    expect(c.items).toEqual(expect.arrayContaining([{ item: 'mat_cog_common', count: 2, from: ['Gin'] }]));
    // leaving the developer clan is remembered
    await clearRate(F, 'clan_join');
    await as(F, `select join_clan_by_code('${TEST_DEV_CODE}')`);
    await clearRate(F, 'clan_join');
    await as(F, 'select leave_clan()');
    expect((await sup('select count(*)::int as n from dev_lab_visits where user_id = $1', [F])).rows[0].n).toBe(1);
  });

  it('a blocked pair cannot donate; housekeeping trims old rows but keeps key tombstones', async () => {
    const [clan] = await as(G, `select * from create_clan('Block Bay', 'BB', 'gems', 'open', '')`);
    await clearRate(E, 'clan_join');
    await as(E, 'select join_clan($1)', [clan.id]);
    await tenure(G, 100);
    await tenure(E, 100);
    await age(E, 30);
    await sup(`delete from donation_requests where user_id = $1`, [G]);
    const r = await one(G, `select request_materials('mat_ember_common') as r`);
    await clearRate(G, 'block');
    await as(G, 'select block_player($1)', [E]);
    await clearRate(E, 'donate');
    // the blocked donor is never told: the request is simply gone (like a filled one; L1), and donate() says "closed"
    await refused(as(E, 'select donate($1, 1, $2)', [r.id, KEY(60)]), /^invalid: that request is closed$/);
    expect((await one(E, 'select donation_state() as r')).requests.map((x) => x.id)).not.toContain(r.id);
    // housekeeping: DMs go after 14 days, except the conversations of pairs with an OPEN report
    // (the owner reads them; up to 90 days)
    await sup(`update direct_messages set created_at = now() - interval '15 days'`);
    await sup(`update donation_keys set created_at = now() - interval '30 days'`);
    await sup('select social_housekeeping()');
    const left = (await sup(`select count(*)::int as n, count(*) filter (where not exists (select 1 from reports r where r.status = 'open'
      and ((r.reporter_id = m.sender_id and r.target_id = m.recipient_id) or (r.reporter_id = m.recipient_id and r.target_id = m.sender_id))))::int as loose
      from direct_messages m`)).rows[0];
    expect(left.n).toBeGreaterThan(0);
    expect(left.loose).toBe(0);
    await sup(`update direct_messages set created_at = now() - interval '91 days'`);
    await sup('select social_housekeeping()');
    expect((await sup('select count(*)::int as n from direct_messages')).rows[0].n).toBe(0);
    expect((await sup('select count(*)::int as n from donation_keys')).rows[0].n).toBeGreaterThan(0);
  });

  it('races: same-key retries, two donors for the last pieces, the 30-point cap and settle vs a late donate stay exact', async () => {
    const give = (who, req, n, key) => one(who, 'select donate($1, $2, $3) as r', [req, n, key]);
    const outcome = (p) => p.then((r) => ({ ok: r }), (e) => ({ err: e.message }));
    const received = async (id) => (await sup('select received from donation_requests where id = $1', [id])).rows[0].received;
    const rowsFor = async (key) => (await sup('select count(*)::int as n from donations where donor_key = $1', [key])).rows[0].n;
    // the lock comes FIRST: two calls with one key can never both miss the replay check
    const def = (await sup(`select pg_get_functiondef('public.donate(uuid,int,uuid)'::regprocedure) as d`)).rows[0].d;
    const lockAt = def.indexOf('pg_advisory_xact_lock');
    expect(lockAt).toBeGreaterThan(0);
    expect(lockAt).toBeLessThan(def.indexOf('from donation_keys'));
    expect(def.indexOf('from donation_keys')).toBeLessThan(def.indexOf('for update'));
    const settleDef = (await sup(`select pg_get_functiondef('public.settle_donations(uuid[])'::regprocedure) as d`)).rows[0].d;
    expect(settleDef).toContain(`pg_advisory_xact_lock(hashtext(v_me::text || ':donate'))`);
    expect(def).toContain(`pg_advisory_xact_lock(hashtext(v_me::text || ':donate'))`);

    await sup('delete from clan_members where user_id = any($1)', [[I, J, C, D]]);
    const [clan] = await as(I, `select * from create_clan('Race Track', 'RT', 'gems', 'open', '')`);
    for (const who of [J, C, D]) {
      await clearRate(who, 'clan_join');
      await as(who, 'select join_clan($1)', [clan.id]);
    }
    for (const who of [I, J, C, D]) {
      await tenure(who, 100);
      await age(who, 30);
      await clearRate(who, 'donate');
    }
    await sup('delete from donation_requests where user_id = any($1)', [[I, C]]);
    const rI = await one(I, `select request_materials('mat_blade_rare') as r`); // 6 wanted, 3 per donor, 2 points each
    const rC = await one(C, `select request_materials('mat_ember_rare') as r`);

    // 1. a retry with the same key while the first call is still running: one effect, both answers equal
    const [a, b] = await Promise.all([give(J, rI.id, 3, KEY(70)), give(J, rI.id, 3, KEY(70))]);
    expect([a.replayed, b.replayed].sort()).toEqual([false, true]);
    expect([a.count, b.count, a.reward.coins, b.reward.coins]).toEqual([3, 3, 300, 300]);
    expect(await received(rI.id)).toBe(3);
    expect(await rowsFor(KEY(70))).toBe(1);

    // 2. two donors race for the last 3 pieces (2 + 2): one lands, the other is refused, never overfilled
    const two = await Promise.all([outcome(give(C, rI.id, 2, KEY(71))), outcome(give(D, rI.id, 2, KEY(72)))]);
    expect(two.filter((x) => x.ok)).toHaveLength(1);
    expect(two.find((x) => x.err).err).toMatch(/^invalid: that request needs only 1 more/);
    expect(await received(rI.id)).toBe(5);

    // 3. the 30-point cap with two requests at once: D at 28 points today → only one 2-point gift fits
    const dToday = Number((await sup('select coalesce(sum(points), 0)::int as n from donations where donor_id = $1 and game_day = $2', [D, gameDay(Date.now())])).rows[0].n);
    await sup(`insert into donations (request_id, requester_id, donor_id, donor_name, clan_id, item, count, points, game_day, donor_key)
      values (null, $1, $2, 'Dara', $3, 'mat_cog_common', 1, $4, $5, $6)`, [C, D, clan.id, 28 - dToday, gameDay(Date.now()), KEY(73)]);
    await clearRate(D, 'donate');
    const cap = await Promise.all([outcome(give(D, rI.id, 1, KEY(74))), outcome(give(D, rC.id, 1, KEY(75)))]);
    expect(cap.filter((x) => x.ok)).toHaveLength(1);
    expect(cap.find((x) => x.err).err).toMatch(/^daily_limit:\d+$/);
    expect(Number((await sup('select sum(points)::int as n from donations where donor_id = $1 and game_day = $2', [D, gameDay(Date.now())])).rows[0].n)).toBe(30);
    expect(await received(rI.id)).toBeLessThanOrEqual(6);

    // 4. settle_donations and a late donate() with the same key at once, in both orders: a key is
    //    either applied (with its row) or voided (with none), never refunded AND applied
    await clearRate(J, 'donate');
    const first = await Promise.all([outcome(give(J, rC.id, 1, KEY(76))), one(J, 'select settle_donations($1::uuid[]) as r', [[KEY(76)]])]);
    expect(first[0].ok).toMatchObject({ replayed: false, count: 1 });
    expect(first[1]).toEqual([{ key: KEY(76), state: 'applied', item: 'mat_ember_rare', count: 1, coins: 100 }]);
    expect(await rowsFor(KEY(76))).toBe(1);
    await clearRate(J, 'donate');
    const second = await Promise.all([one(J, 'select settle_donations($1::uuid[]) as r', [[KEY(77)]]), outcome(give(J, rC.id, 1, KEY(77)))]);
    expect(second[0]).toEqual([{ key: KEY(77), state: 'voided', item: null, count: 0, coins: 0 }]);
    expect(second[1].ok).toEqual({ key: KEY(77), voided: true });
    expect(await rowsFor(KEY(77))).toBe(0);

    // 5. two collects at once with two keys: the items go to exactly one of them
    const [c1, c2] = await Promise.all([one(I, 'select claim_donations($1) as r', [KEY(78)]), one(I, 'select claim_donations($1) as r', [KEY(79)])]);
    const got = (c) => c.items.reduce((n, x) => n + x.count, 0);
    expect(got(c1) + got(c2)).toBe(await received(rI.id));
    expect(Math.min(got(c1), got(c2))).toBe(0);
  });
  it('open friend requests (20261015000000_social_open_friends.sql): a stranger may ask, stored as via any; still no DM until accepted', async () => {
    expect(await card(K, L)).toMatchObject({ friend: 'none', canFriend: true, friendWhy: null, canMessage: false, why: 'stranger' });
    expect(await one(K, 'select send_friend_request($1) as r', [L])).toEqual({ state: 'requested' });
    const inc = (await one(L, 'select list_friend_requests() as r')).incoming;
    expect(inc).toHaveLength(1);
    expect(inc[0]).toMatchObject({ userId: K, name: 'Kiri', via: 'any' });
    await refused(dm(K, L, 'hi'), /forbidden/);
    await as(L, 'select answer_friend_request($1, true)', [inc[0].id]);
    expect((await card(K, L)).friend).toBe('friends');
    expect((await card(K, L)).canMessage).toBe(true);
  });
});
