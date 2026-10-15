// The verifier findings of the social update (supabase/migrations/20261013000000_social.sql), each
// reproduced on Postgres (PGlite) and shown fixed:
//   #1 deploy order: a name the first migration accepted never locks its player out of chat,
//      clans or co-op once the social SQL runs (a trigger on new / changed names, no CHECK)
//   #2 auto-mute: a public chat line is no contact; a repeat report counts again only after new
//      contact (qualified is recomputed; qualified_at gates the mute)
//   #3 settle_donations(): rate-limited, capped, voided tombstones gone after 2 days
//   #4 no per-conversation trim: a flood cannot erase an abusive DM from a report's evidence
//   #5 request → cancel → request and block → unblock cannot ping a player again and again
//   #6 a block reads like a closed request / a full room
//   #7 blank-looking bodies and names, look-alikes of reserved names (and JS ↔ SQL parity)
//   #8 the friend caps take advisory locks (real concurrency: the verifier's p11 on Postgres 16)
//   UX expire_coop_invites(); 'stranger' + myPrivacy on the card
// and the judge's re-verification (REVERIFY.md), each failing on the file before the fix:
//   H1/F1 the evidence counts the whole DM conversation (dmsTotal / dmsFromTarget), which is kept
//         while the report is open (≤ 90 days); a repeat report adds to the evidence, never replaces it
//   M1/F2 a block frees the co-op seat both ways and changes the room secret; join_room 'full' either way
//   M2/F3 clan text rules (invisible tricks, staff / developer look, look-alike of an existing clan);
//         live clans from before the paste survive, and the re-paste order keeps triggers and grants
//   M3/F4 a kick bans a self-join for 7 days (open and code), an officer's accept lifts it
//   M4    Friends only by default · L1 (#6) a blocker's request is gone · L2 a block swallows the
//         blocked player's request · L3 marks of every script · L4 staff words inside names
// and the final verification (the last round before the owner pastes the file):
//   R1 a repeat report keeps the child's reason ("Asked for personal info") and note, and every
//      earlier reason / note / place (evidence.earlierReports); message_id is the checked message
//   R2 look-alike letters of other alphabets (Cherokee, Lisu, small capitals, Armenian…), letters
//      spelled one by one ('D.E.V.'), camel case ('GMRosie') and invisible characters inside a word
//      no longer get past the staff / developer name rules; 'さくら Clan' and 'ひまわり Clan' coexist
//   R3 blocking a player who sat in my room earlier changes its secret too
//   R4 clan system notices carry who they are about (messages.about), so the chat hides them by
//      account, whatever the blocked player's name is now
//   R5 the paste waits for one quiet moment and takes its locks at once (no "deadlock detected")
// tests/online/localSocial.test.js runs the same scenarios against the local mirror.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MIGRATIONS_DIR, MIGRATION_FILES, PGlite, createDb, refused } from './pgHarness.js';
import { validMessageBody } from '../../src/online/socialRules.js';
import { validateName, validateClan, reservedName, reservedClanName, reservedClanTag, RESERVED_NAMES } from '../../src/online/clanRules.js';
import { nameKey, nameWords, nameCamel, mixesLookalikes, clanNameKey, LOOKALIKE_FROM, LOOKALIKE_TO, nameLooksBlank } from '../../src/online/textRules.js';
import { VOID_KEY_KEEP_DAYS, VOID_KEY_MAX } from '../../src/online/donateRules.js';

const FIRST = readFileSync(join(MIGRATIONS_DIR, MIGRATION_FILES[0]), 'utf8');
const SOCIAL = readFileSync(join(MIGRATIONS_DIR, MIGRATION_FILES.find((f) => f.includes('_social'))), 'utf8');
const cp = (...c) => String.fromCodePoint(...c);
const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const KEY = (n) => `${String(n).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('social migration fixes (lint)', () => {
  it('names: the trigger replaces the check constraint; look-alike tables and reserved names match the client', () => {
    expect(SOCIAL).not.toMatch(/add constraint profiles_name_visible/);
    expect(SOCIAL).toContain('alter table public.profiles drop constraint if exists profiles_name_visible;');
    expect(SOCIAL).toMatch(/create trigger profiles_name_rules before insert or update of name on public\.profiles/);
    expect(SOCIAL).toContain(`'${LOOKALIKE_FROM}',\n    '${LOOKALIKE_TO}'`);
    expect([...LOOKALIKE_FROM].length).toBe(LOOKALIKE_TO.length);
    expect(new Set(LOOKALIKE_FROM).size).toBe([...LOOKALIKE_FROM].length); // translate() takes the first of a repeat, the JS map the last
    // R5: before anything else, one quiet moment (all locks at once, NOWAIT, retried; never a deadlock)
    const firstStatement = SOCIAL.slice(SOCIAL.indexOf('\ndo $$'));
    expect(SOCIAL.indexOf('\ndo $$')).toBeLessThan(SOCIAL.indexOf('create or replace function'));
    expect(firstStatement).toMatch(/^\ndo \$\$[\s\S]*?in access exclusive mode nowait[\s\S]*?exception when lock_not_available then[\s\S]*?end \$\$;/);
    expect(SOCIAL).toContain(`array[${RESERVED_NAMES.map((n) => `'${n}'`).join(', ')}]`);
    expect(SOCIAL).toContain(`interval '${VOID_KEY_KEEP_DAYS} days'`);
    expect(SOCIAL).toContain(`> ${VOID_KEY_MAX} then`);
  });
});

describe.skipIf(!PGlite)('social migration fixes (run on Postgres)', () => {
  it('#1 deploy order: players with names the first migration accepted keep chat, level sync and co-op', async () => {
    const L = U(1);
    const Z = U(2);
    const Y = U(3);
    const W = U(4);
    const { db, as, one } = await createDb({ defaultGrants: true, sql: FIRST, runs: 1 });
    await db.exec(`insert into auth.users values ('${L}'), ('${Z}'), ('${Y}'), ('${W}')`);
    const old = [[L, cp(0x3164, 0x3164)], [Z, `Za${cp(0x301, 0x302, 0x303, 0x304, 0x305)}lgo`], [Y, `${cp(0x405)}ystem`], [W, cp(0x3000, 0x3000)]];
    for (const [id, name] of old) await as(id, 'insert into profiles (id, name) values ($1, $2)', [id, name]);
    // the owner runs the social SQL (twice: it is idempotent)
    await db.exec(SOCIAL);
    await db.exec(SOCIAL);
    for (const [id] of old) {
      await db.query('delete from rate_events');
      await as(id, 'update profiles set level = 5 where id = $1', [id]); // the adapter's signIn()
      await as(id, `insert into messages (channel, user_id, body) values ('global', $1, 'hi')`, [id]); // stamps last_active
      await as(id, 'select touch_active()');
      await as(id, 'select open_room($1)', [`OLD${old.findIndex((o) => o[0] === id)}A`]);
    }
    // social features ask for a new name; a bad new name is refused with a readable reason
    await db.query(`insert into friends values ($1, $2, now()), ($2, $1, now())`, [L, Z]);
    await refused(as(L, 'select send_dm($1, $2)', [Z, 'hi']), /invalid: change your online name first/);
    expect((await one(L, 'select player_card($1) as r', [Z])).why).toBe('name');
    await refused(as(L, 'update profiles set name = $2 where id = $1', [L, cp(0xff33, 0xff59, 0xff53, 0xff54, 0xff45, 0xff4d)]), /invalid: that name is reserved/);
    await refused(as(L, 'update profiles set name = $2 where id = $1', [L, cp(0x3164, 0x3164, 0x3164)]), /invalid: names need visible letters/);
    await as(L, `update profiles set name = 'Lumi' where id = $1`, [L]);
    expect((await one(L, 'select send_dm($1, $2) as r', [Z, 'hi'])).body).toBe('hi');
    // a NEW account with such a name is refused at once
    await db.exec(`insert into auth.users values ('${U(9)}')`);
    await refused(as(U(9), 'insert into profiles (id, name) values ($1, $2)', [U(9), `Supply B${cp(0x43e)}t`]), /invalid: that name is reserved/);
  }, 60000);

  it('F3/F4 the paste: live clans from before the social SQL (a look-alike pair, a wiki emblem) keep working; online → social → online → social keeps every trigger and grant', async () => {
    const [G, L] = [U(11), U(12)];
    const { db, as } = await createDb({ defaultGrants: true, sql: FIRST, runs: 1 });
    await db.exec(`insert into auth.users values ('${G}'), ('${L}')`);
    for (const [id, name] of [[G, 'Gary'], [L, 'Lena']]) await as(id, 'insert into profiles (id, name) values ($1, $2)', [id, name]);
    const [moon] = await as(G, `select * from create_clan('Moon Clan', 'MOON', 'wiki', 'open', 'old')`);
    await as(L, `select * from create_clan('MoonClan', 'MNC', 'assault', 'open', '')`);
    await db.exec(SOCIAL);
    await db.exec(SOCIAL);
    await as(G, `insert into messages (channel, user_id, body) values ($1, $2, 'old clan still chats')`, [`clan:${moon.id}`, G]);
    expect((await db.query('select emblem, xp > 0 as xp from clans where id = $1', [moon.id])).rows[0]).toEqual({ emblem: 'wiki', xp: true });
    const acl = async () => (await db.query(`select count(*)::int as n, string_agg(p.oid::regprocedure::text, ',' order by p.oid::regprocedure::text) as s
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')`)).rows[0];
    const before = await acl();
    expect(before.n).toBe(57);
    await db.exec(FIRST);
    await db.exec(SOCIAL);
    expect(await acl()).toEqual(before);
    const trig = (await db.query(`select string_agg(tgname, ',' order by tgname) as t from pg_trigger
      where tgname in ('clans_text_rules', 'clan_members_kick_ban', 'clan_members_ban_check', 'clan_members_dev_lab')`)).rows[0].t;
    expect(trig).toBe('clan_members_ban_check,clan_members_dev_lab,clan_members_kick_ban,clans_text_rules');
    expect((await db.query(`select pg_get_functiondef('public.join_room(text)'::regprocedure) as d`)).rows[0].d).toContain('social_is_blocked(r.host_id, auth.uid())');
    expect((await db.query(`select count(*)::int as n from clans where name in ('Moon Clan', 'MoonClan')`)).rows[0].n).toBe(2);
  }, 60000);

  describe('one database', () => {
    let db; let as; let one;
    const sup = (text, params) => db.query(text, params);
    const clearRate = (uid, action) => sup(`delete from rate_events where user_id = $1${action ? ' and action = $2' : ''}`, action ? [uid, action] : [uid]);
    const age = (uid, days) => db.exec(`set session_replication_role = replica;
      update profiles set created_at = now() - interval '${Number(days)} days' where id = '${uid}';
      set session_replication_role = default;`);
    const befriend = (a, b) => sup('insert into friends values ($1, $2, now()), ($2, $1, now()) on conflict do nothing', [a, b]);
    const dm = async (from, to, body) => {
      await clearRate(from, 'dm');
      return one(from, 'select send_dm($1, $2) as r', [to, body]);
    };
    const report = async (who, target, reason, ctx = 'profile', msg = null) => {
      await clearRate(who, 'report');
      return as(who, 'select report_player($1, $2, $3, $4, $5)', [target, reason, '', ctx, msg]);
    };
    const muted = async (uid) => (await sup(`select count(*)::int as n from social_mutes where user_id = $1 and until > now()`, [uid])).rows[0].n === 1;
    const names = Array.from({ length: 40 }, (_, i) => [U(100 + i), `P${100 + i}`]);
    const P = (i) => U(100 + i);

    beforeAll(async () => {
      ({ db, as, one } = await createDb({ defaultGrants: false, users: names }));
    }, 90000);

    it('#2 auto-mute: a public chat line is no contact; a repeat report needs NEW contact; qualified is recomputed', async () => {
      const [V, R1, R2, R3] = [P(0), P(1), P(2), P(3)];
      for (const r of [R1, R2, R3]) await age(r, 8);
      const [line] = await as(V, `insert into messages (channel, user_id, body) values ('global', $1, 'hello everyone') returning id`, [V]);
      for (const r of [R1, R2, R3]) await report(r, V, 'spam', 'global', line.id);
      expect((await sup('select qualified, qualified_at from reports where target_id = $1', [V])).rows.every((x) => !x.qualified && !x.qualified_at)).toBe(true);
      expect(await muted(V)).toBe(false);
      // real contact: V DMs each of them → three reports mute V's DMs for a day
      for (const r of [R1, R2, R3]) {
        await befriend(V, r);
        await dm(V, r, 'hi');
      }
      for (const r of [R1, R2, R3]) await report(r, V, 'bullying', 'dm');
      expect(await muted(V)).toBe(true);
      await refused(dm(V, R1, 'muted?'), /forbidden: you can't send messages right now/);
      // two days later (the mute is over), no new contact: the same three report again → no new mute
      await sup(`update social_mutes set until = now() - interval '1 day', created_at = created_at - interval '2 days' where user_id = $1`, [V]);
      await sup(`update reports set qualified_at = qualified_at - interval '2 days', updated_at = updated_at - interval '2 days' where target_id = $1`, [V]);
      await sup(`update direct_messages set created_at = created_at - interval '2 days' where sender_id = $1`, [V]);
      for (const r of [R1, R2, R3]) await report(r, V, 'other');
      expect(await muted(V)).toBe(false);
      const rows = (await sup('select qualified, qualified_at < now() - interval \'1 day\' as old from reports where target_id = $1', [V])).rows;
      expect(rows.map((x) => [x.qualified, x.old])).toEqual([[true, true], [true, true], [true, true]]);
      expect((await dm(V, R1, 'sorry')).body).toBe('sorry');
      // the contact is 8 days old: a repeat is no longer backed by contact (recomputed, not sticky)
      await sup(`update direct_messages set created_at = now() - interval '8 days' where sender_id = $1`, [V]);
      await report(R2, V, 'other');
      expect((await sup('select qualified from reports where target_id = $1 and reporter_id = $2', [V, R2])).rows[0].qualified).toBe(false);
    });

    it('#3 settle_donations(): 30 calls an hour, at most 100 voided keys, voided tombstones go after 2 days', async () => {
      const A = P(4);
      for (let i = 0; i < 30; i++) expect((await one(A, 'select settle_donations($1::uuid[]) as r', [[KEY(i)]]))[0].state).toBe('voided');
      await refused(as(A, 'select settle_donations($1::uuid[])', [[KEY(99)]]), /^rate_limited:\d+$/);
      await clearRate(A, 'settle');
      const batch = (n) => Array.from({ length: 20 }, (_, i) => KEY(1000 + n * 20 + i));
      for (let n = 0; n < 3; n++) await as(A, 'select settle_donations($1::uuid[])', [batch(n)]); // 30 + 60 = 90
      await refused(as(A, 'select settle_donations($1::uuid[])', [batch(3)]), /^rate_limited:\d+$/); // 110 > 100
      expect(await one(A, 'select settle_donations($1::uuid[]) as r', [[KEY(5)]])).toEqual([{ key: KEY(5), state: 'voided', item: null, count: 0, coins: 0 }]);
      // three days later the old tombstones are gone (the next call clears them, and housekeeping too)
      await sup(`update donation_keys set created_at = now() - interval '3 days' where donor_id = $1`, [A]);
      await sup(`insert into donation_keys (donor_id, key, state, item, count, coins, created_at) values ($1, $2, 'applied', 'mat_feather_rare', 1, 100, now() - interval '3 days')`, [A, KEY(5000)]);
      await clearRate(A, 'settle');
      expect(await one(A, 'select settle_donations($1::uuid[]) as r', [batch(3)])).toHaveLength(20);
      expect((await sup(`select state, count(*)::int as n from donation_keys where donor_id = $1 group by state order by state`, [A])).rows).toEqual([{ state: 'applied', n: 1 }, { state: 'voided', n: 20 }]);
      await sup(`update donation_keys set created_at = now() - interval '3 days' where donor_id = $1`, [A]);
      await sup('select social_housekeeping()');
      expect((await sup(`select state from donation_keys where donor_id = $1`, [A])).rows).toEqual([{ state: 'applied' }]);
    });

    it('#4 a flood cannot erase an abusive DM: no per-conversation trim, the report finds it', async () => {
      const [X, K] = [P(5), P(6)];
      await befriend(X, K);
      const bad = await dm(X, K, 'tell me your address and school');
      for (let i = 0; i < 205; i++) await dm(X, K, `hi ${i}`);
      expect((await sup('select count(*)::int as n from direct_messages where sender_id = $1', [X])).rows[0].n).toBe(206);
      await report(K, X, 'personal_info', 'dm', bad.id);
      const ev = (await sup('select evidence from reports where reporter_id = $1', [K])).rows[0].evidence;
      expect(ev.message).toMatchObject({ kind: 'dm', id: Number(bad.id), body: 'tell me your address and school' });
    }, 60000);

    it('#5 request → cancel → request and block → unblock cannot ping a player again and again', async () => {
      const [A, B, C, D] = [P(7), P(8), P(9), P(10)];
      const { code } = await one(B, 'select my_friend_code() as r');
      const incoming = async (who) => (await one(who, 'select list_friend_requests() as r')).incoming;
      const realtimeRows = async (who) => as(who, 'select id from friend_requests'); // what Realtime may deliver
      expect((await one(A, 'select add_friend_by_code($1) as r', [code])).state).toBe('requested');
      const first = (await incoming(B))[0];
      await as(A, 'select cancel_friend_request($1)', [first.id]);
      expect(await incoming(B)).toEqual([]);
      expect((await one(A, 'select player_card($1) as r', [B])).friend).toBe('none');
      for (let i = 0; i < 3; i++) {
        expect((await one(A, 'select add_friend_by_code($1) as r', [code])).state).toBe('requested');
        expect(await realtimeRows(B)).toEqual([]);
        await as(A, 'select cancel_friend_request($1)', [(await one(A, 'select player_card($1) as r', [B])).requestId]);
      }
      expect((await sup('select count(*)::int as n, min(status) as s from friend_requests where from_id = $1 and to_id = $2', [A, B])).rows[0]).toEqual({ n: 1, s: 'cancelled' });
      // a day after the cancel it may go out again: a NEW pending row (one new pop-up)
      await sup(`update friend_requests set created_at = now() - interval '25 hours' where from_id = $1`, [A]);
      expect((await one(A, 'select add_friend_by_code($1) as r', [code])).state).toBe('requested');
      const again = await incoming(B);
      expect(again).toHaveLength(1);
      expect(again[0].id).not.toBe(first.id);
      // B declines; A blocks and unblocks B: the 30-day tombstone survives
      await as(B, 'select answer_friend_request($1, false)', [again[0].id]);
      await as(A, 'select block_player($1)', [B]);
      await as(A, 'select unblock_player($1)', [B]);
      expect((await one(A, 'select add_friend_by_code($1) as r', [code])).state).toBe('requested');
      expect(await incoming(B)).toEqual([]);
      expect((await sup('select status from friend_requests where from_id = $1 and to_id = $2', [A, B])).rows[0].status).toBe('declined');
      // the blocker's own pending request is withdrawn as a tombstone (block → unblock → ask: swallowed)
      const { code: codeC } = await one(C, 'select my_friend_code() as r');
      await one(D, 'select add_friend_by_code($1) as r', [codeC]);
      expect(await incoming(C)).toHaveLength(1);
      await as(D, 'select block_player($1)', [C]);
      await as(D, 'select unblock_player($1)', [C]);
      await one(D, 'select add_friend_by_code($1) as r', [codeC]);
      expect(await incoming(C)).toEqual([]);
    });

    it('#6 a block is never revealed: the request is gone (L1), full room; the blocker no longer sees the blocked player\'s request', async () => {
      const [A, B, C] = [P(11), P(12), P(13)];
      const [clan] = await as(B, `select * from create_clan('Quiet Pond', 'QP', 'gems', 'open', '')`);
      for (const who of [A, C]) await as(who, 'select join_clan($1)', [clan.id]);
      await sup(`update clan_members set joined_at = now() - interval '100 hours' where clan_id = $1`, [clan.id]);
      for (const who of [A, B, C]) await age(who, 10);
      const r = await one(B, `select request_materials('mat_feather_rare') as r`);
      await as(B, 'select block_player($1)', [A]);
      // (L1) gone like a filled one — never "closed" while the others see it open
      expect((await one(A, 'select donation_state() as r')).requests).toEqual([]);
      expect((await one(C, 'select donation_state() as r')).requests.map((x) => [x.id, x.open])).toEqual([[r.id, true]]);
      await refused(as(A, 'select donate($1, 1, $2)', [r.id, KEY(7000)]), /^invalid: that request is closed$/);
      const ra = await one(A, `select request_materials('mat_blade_rare') as r`);
      expect((await one(B, 'select donation_state() as r')).requests.map((x) => x.id)).not.toContain(ra.id);
      await as(B, `select open_room('QPRM1')`);
      expect(await one(A, `select join_room('QPRM1') as r`)).toEqual({ error: 'full' });
      expect((await one(C, `select join_room('QPRM1') as r`)).host).toBe(false);
    });

    it('#7 text rules: blank-looking bodies refused, Japanese spacing / variants / emoji kept; JS and SQL agree', async () => {
      const bodies = [cp(0xa0, 0xa0), cp(0x34f), cp(0x17b4, 0x17b5), cp(0x180b), cp(0xe0100), cp(0x1d159), cp(0x3000, 0x3000), cp(0x2003, 0x2003),
        `こんにちは${cp(0x3000)}みんな`, `葛${cp(0xe0100)}城`, '👩‍👩‍👧', 'hi', `a${cp(0x34f)}b`, `x${cp(0x301)}`, cp(0x301), 'é', cp(0x200d)];
      const sqlOk = (await sup('select x, public.valid_dm_body(x) as ok from unnest($1::text[]) x', [bodies])).rows;
      for (const { x, ok } of sqlOk) expect([JSON.stringify(x), ok]).toEqual([JSON.stringify(x), validMessageBody(x)]);
      expect(sqlOk.filter((r) => r.ok).map((r) => r.x)).toEqual([`こんにちは${cp(0x3000)}みんな`, `葛${cp(0xe0100)}城`, '👩‍👩‍👧', 'hi', `x${cp(0x301)}`, 'é']);
      // names: visible letters, no edge spaces, no reserved look-alikes — same answers as validateName()
      const nameList = ['Aiko', '桜ミカ', 'Mika-chan 2', cp(0x34f, 0x34f), cp(0x3000, 0x3000), cp(0x17b4, 0x17b4), `${cp(0x405)}ystem`, `Supply B${cp(0x43e)}t`,
        cp(0xff33, 0xff59, 0xff53, 0xff54, 0xff45, 0xff4d), `${cp(0x391)}dmin`, `S${cp(0xfd)}stem`, 'Gmさくら', 'Dev', 'Modé', `Za${cp(0x301, 0x302, 0x303, 0x304, 0x305)}lgo`, cp(0x3164, 0x3164), `Fumi${cp(0x3000)}`];
      const nameRows = (await sup('select x, public.social_name_ok(x) as ok, public.name_key(x) as k from unnest($1::text[]) x', [nameList])).rows;
      for (const { x, ok, k } of nameRows) {
        expect([JSON.stringify(x), k]).toEqual([JSON.stringify(x), nameKey(x)]);
        // (the client trims first: a trailing space is cut, never sent)
        const client = x === x.trim() ? !validateName(x) : !nameLooksBlank(x);
        expect([JSON.stringify(x), ok]).toEqual([JSON.stringify(x), client]);
      }
      expect(nameRows.filter((r) => r.ok).map((r) => r.x)).toEqual(['Aiko', '桜ミカ', 'Mika-chan 2', 'Modé']);
    });

    it('#8 the friend caps lock both players (real concurrency: the verifier probe p11 on Postgres 16)', async () => {
      const def = async (sig) => (await sup(`select pg_get_functiondef('${sig}'::regprocedure) as d`)).rows[0].d;
      const req = await def('public.social_request_friend(uuid,uuid,text)');
      const bef = await def('public.social_befriend(uuid,uuid)');
      for (const [d, key] of [[req, 'friendreq:'], [bef, 'friends:']]) {
        expect(d).toContain(`pg_advisory_xact_lock(hashtext('${key}' || least(`);
        expect(d).toContain(`pg_advisory_xact_lock(hashtext('${key}' || greatest(`);
      }
      // the lock comes before every count
      expect(req.indexOf('pg_advisory_xact_lock')).toBeLessThan(req.indexOf('social_friend_count'));
      expect(bef.indexOf('pg_advisory_xact_lock')).toBeLessThan(bef.indexOf('social_friend_count'));
      // sequentially the caps hold too: 49 friends + two accepts → the second is refused
      const V = P(14);
      for (let i = 0; i < 49; i++) await sup(`insert into friends values ($1, $2, now()), ($2, $1, now())`, [V, U(500 + i)]).catch(async () => {
        await db.exec(`insert into auth.users values ('${U(500 + i)}') on conflict do nothing`);
        await sup('insert into profiles (id, name) values ($1, $2)', [U(500 + i), `F${i}`]);
        await sup(`insert into friends values ($1, $2, now()), ($2, $1, now())`, [V, U(500 + i)]);
      });
      const { code } = await one(V, 'select my_friend_code() as r');
      for (const who of [P(15), P(16)]) await one(who, 'select add_friend_by_code($1) as r', [code]);
      const inc = (await one(V, 'select list_friend_requests() as r')).incoming;
      expect(inc).toHaveLength(2);
      await as(V, 'select answer_friend_request($1, true)', [inc[0].id]);
      await refused(as(V, 'select answer_friend_request($1, true)', [inc[1].id]), /invalid: one of you already has 50 friends/);
    }, 60000);

    it('UX: expire_coop_invites() when the host leaves; the card says "stranger" and carries only my own setting', async () => {
      const [A, B, C] = [P(17), P(18), P(19)];
      await befriend(A, B);
      await as(A, `select open_room('EXPR1')`);
      const inv = await one(A, `select send_coop_invite($1, 'EXPR1', '1-1', 'normal') as r`, [B]);
      expect(await one(B, 'select invite_state($1) as r', [inv.id])).toBe('open');
      expect(await one(A, `select expire_coop_invites('expr1') as r`)).toBe(1);
      expect(await one(B, 'select invite_state($1) as r', [inv.id])).toBe('expired');
      expect(await one(C, `select expire_coop_invites('EXPR1') as r`)).toBe(0); // only my own invites
      const card = await one(A, 'select player_card($1) as r', [C]);
      expect(card).toMatchObject({ why: 'stranger', myPrivacy: 'friends' });
      expect(card).not.toHaveProperty('privacy');
      await as(C, `select set_dm_privacy('nobody')`);
      expect((await one(A, 'select player_card($1) as r', [C])).myPrivacy).toBe('friends');
    });

    // ---- the judge's re-verification (REVERIFY: H1 / M1–M5 / L1–L4), each shown fixed ------------
    const evidenceOf = async (reporter, target) => (await sup('select evidence, message_id from reports where reporter_id = $1 and target_id = $2 and status = $3', [reporter, target, 'open'])).rows[0];
    const newestFrom = async (who) => (await sup('select max(id)::int as id from direct_messages where sender_id = $1', [who])).rows[0].id;
    const dmCount = async (users, like = '%') => (await sup('select count(*)::int as n from direct_messages where (sender_id = any($1) or recipient_id = any($1)) and body like $2', [users, like])).rows[0].n;

    it('H1/F1 a report from the DM screen: the evidence counts the whole conversation, which is kept while the report is open (≤ 90 days)', async () => {
      const [K, X, O] = [P(20), P(21), P(22)];
      for (const u of [K, X, O]) await age(u, 30);
      await befriend(K, X);
      await befriend(K, O);
      await dm(X, K, 'ABUSIVE: send me a photo, dont tell your parents');
      for (let i = 1; i <= 10; i++) {
        await dm(K, X, `ok ${i}`);
        await dm(X, K, `cool ${i}`);
      }
      await dm(O, K, 'an unrelated old line');
      // what the DM screen used to send: the peer's newest message
      await report(K, X, 'inappropriate', 'dm', await newestFrom(X));
      const { evidence } = await evidenceOf(K, X);
      expect(evidence.dms).toHaveLength(20);
      expect(JSON.stringify(evidence.dms)).not.toContain('ABUSIVE'); // the snapshot is the newest part…
      expect(evidence).toMatchObject({ dmsTotal: 21, dmsFromTarget: 11 }); // …and says so
      // day 15: the 1% housekeeping keeps the reported pair's conversation (the other pair's goes)
      await sup(`update direct_messages set created_at = created_at - interval '15 days' where sender_id = any($1) or recipient_id = any($1)`, [[K, X, O]]);
      await sup('select social_housekeeping()');
      expect(await dmCount([K, X], 'ABUSIVE%')).toBe(1);
      expect(await dmCount([O])).toBe(0);
      // the owner's runbook query (docs/ONLINE.md) shows the whole conversation behind the report
      const thread = (await sup(`select case when m.sender_id = r.target_id then 'TARGET' else 'reporter' end as who, m.body
        from reports r join direct_messages m
          on (m.sender_id = r.target_id and m.recipient_id = r.reporter_id) or (m.sender_id = r.reporter_id and m.recipient_id = r.target_id)
        where r.reporter_id = $1 and r.target_id = $2 order by m.id`, [K, X])).rows;
      expect(thread).toHaveLength(21);
      expect(thread[0]).toEqual({ who: 'TARGET', body: 'ABUSIVE: send me a photo, dont tell your parents' });
      // reviewed: the next housekeeping lets the old lines go
      await sup(`update reports set status = 'reviewed' where reporter_id = $1 and target_id = $2`, [K, X]);
      await sup('select social_housekeeping()');
      expect(await dmCount([K, X])).toBe(0);
      // an open report keeps a conversation at most 90 days
      await dm(X, K, 'ABUSIVE again');
      await report(K, X, 'bullying', 'dm', await newestFrom(X));
      await sup(`update direct_messages set created_at = now() - interval '91 days' where sender_id = $1`, [X]);
      await sup('select social_housekeeping()');
      expect(await dmCount([K, X])).toBe(0);
    });

    it('H1/F1 a repeat report adds to the evidence: the message reported first and its lines are never replaced', async () => {
      const [K, X] = [P(23), P(24)];
      await age(K, 30);
      await befriend(K, X);
      const bad = await dm(X, K, 'ABUSIVE: whats your address');
      await report(K, X, 'personal_info', 'dm', bad.id);
      for (let i = 0; i < 25; i++) await dm(X, K, `spam ${i}`);
      const newest = await newestFrom(X);
      await report(K, X, 'spam', 'dm', newest);
      let { evidence, message_id: mid } = await evidenceOf(K, X);
      expect(evidence.message.body).toBe('spam 24');
      expect(evidence.earlier.map((m) => m.body)).toEqual(['ABUSIVE: whats your address']);
      expect(evidence.dms.some((d) => d.body.startsWith('ABUSIVE'))).toBe(true); // the first snapshot's line stays
      expect(evidence.dms.at(-1).body).toBe('spam 24'); // and the newest lines join it
      expect(evidence.dms.map((d) => d.id)).toEqual([...evidence.dms.map((d) => d.id)].sort((a, b) => a - b));
      expect(evidence.dmsTotal).toBe(26);
      expect(Number(mid)).toBe(newest);
      // a third report from the profile (no message): the reported messages stay
      await report(K, X, 'other', 'profile', null);
      ({ evidence, message_id: mid } = await evidenceOf(K, X));
      expect(evidence.message.body).toBe('spam 24');
      expect(evidence.earlier.map((m) => m.body)).toEqual(['ABUSIVE: whats your address']);
      expect(Number(mid)).toBe(newest);
      expect((await sup('select count(*)::int as n from reports where reporter_id = $1 and target_id = $2', [K, X])).rows[0].n).toBe(1);
    });

    it('M1/F2 blocking a co-op partner frees the seat both ways and changes the room secret; a block either way reads "full"', async () => {
      const [K, Q, O] = [P(25), P(26), P(27)];
      const s1 = (await one(K, `select open_room('KRM01') as r`)).secret;
      expect((await one(Q, `select join_room('KRM01') as r`)).host).toBe(false);
      await as(K, 'select block_player($1)', [Q]);
      const row = (await sup(`select guest_id, secret from coop_rooms where code = 'KRM01'`)).rows[0];
      expect(row.guest_id).toBeNull();
      expect(row.secret).not.toBe(s1); // the channel the blocked player knows is dead
      await clearRate(K, 'room');
      expect((await one(K, `select open_room('KRM01') as r`)).secret).toBe(row.secret); // the host's reopen gets the new one
      await clearRate(Q, 'room');
      expect(await one(Q, `select join_room('KRM01') as r`)).toEqual({ error: 'full' });
      await clearRate(O, 'room');
      expect((await one(O, `select join_room('KRM01') as r`)).host).toBe(false); // anyone else may take the seat
      // the kid is the guest and blocks the host: the kid's seat is freed, a rejoin reads full
      await clearRate(O, 'room');
      await as(O, `select leave_room('KRM01')`);
      await one(O, `select open_room('ORM01') as r`);
      await clearRate(K, 'room');
      expect((await one(K, `select join_room('ORM01') as r`)).host).toBe(false);
      await as(K, 'select block_player($1)', [O]);
      expect((await sup(`select guest_id from coop_rooms where code = 'ORM01'`)).rows[0].guest_id).toBeNull();
      await clearRate(K, 'room');
      expect(await one(K, `select join_room('ORM01') as r`)).toEqual({ error: 'full' });
    });

    it('L2 a block swallows the blocked player\'s pending friend request: they still see "Requested", as after a decline', async () => {
      const [K, Q] = [P(28), P(29)];
      const { code } = await one(K, 'select my_friend_code() as r');
      expect((await one(Q, 'select add_friend_by_code($1) as r', [code])).state).toBe('requested');
      await as(K, 'select block_player($1)', [Q]);
      expect((await one(Q, 'select player_card($1) as r', [K])).friend).toBe('requested');
      expect((await one(Q, 'select list_friend_requests() as r')).outgoing).toHaveLength(1);
      expect((await one(K, 'select list_friend_requests() as r')).incoming).toEqual([]);
      expect(await as(K, 'select id from friend_requests')).toEqual([]); // nothing for Realtime
      // unblocking drops the swallowed request: they may ask again
      await as(K, 'select unblock_player($1)', [Q]);
      expect((await one(Q, 'select player_card($1) as r', [K])).friend).toBe('none');
    });

    it('M2/F3 new clans follow the text rules: no invisible tricks, no staff or developer look, no look-alike of an existing clan', async () => {
      const [G, G2] = [P(30), P(31)];
      const make = async (who, name, tag, emblem = 'assault', desc = '') => {
        await sup('delete from rate_events where user_id = $1', [who]);
        await sup('delete from clans where leader_id = $1', [who]);
        return as(who, 'select name from create_clan($1, $2, $3, $4, $5)', [name, tag, emblem, 'open', desc]);
      };
      const refusedClans = [
        ['Sakura Dev Lab​', 'XX', 'assault', '', /invalid: clan names need visible letters/],
        ['Admin‮ nalc', 'XX', 'assault', '', /invalid: clan names need visible letters/],
        ['Sakura Dev Labs', 'XX', 'assault', '', /invalid: that clan name is reserved/],
        ['Sakura Devs', 'XX', 'assault', '', /invalid: that clan name is reserved/],
        ['GM Rosie Club', 'RC', 'assault', '', /invalid: that clan name is reserved/],
        ['Staff Room', 'SR', 'assault', '', /invalid: that clan name is reserved/],
        ['Fun Clan', 'DEV', 'assault', '', /invalid: that clan tag is reserved/],
        ['Fun Clan', 'D3V', 'assault', '', /invalid: that clan tag is reserved/],
        ['Fun Clan', 'FUN', 'wiki', '', /invalid: that emblem is reserved/],
        ['Fun Clan', 'FUN', 'assault', '​​', /invalid: clan descriptions can't contain invisible characters/],
      ];
      for (const [name, tag, emblem, desc, re] of refusedClans) {
        await refused(make(G, name, tag, emblem, desc), re);
        expect(validateClan({ name, tag, emblem, description: desc }), name).toBeTruthy(); // the client says so first
      }
      // look-alikes of an existing clan's name (no unique index: old pairs keep working)
      expect((await make(G, 'Moon Clan', 'MOON'))[0].name).toBe('Moon Clan');
      for (const n of ['MOON-CLAN', 'Moon Clan', 'Ｍｏｏｎ Ｃｌａｎ', 'Mооn Clan']) await refused(make(G2, n, 'MC'), /name_taken: a clan with that name already exists/);
      // fine: names without Latin letters (only compared exactly), plain new names, a description
      for (const [n, t] of [['さくら組', 'JP'], ['ひまわり組', 'JP2'], ['Fun Clan', 'FUN']]) {
        expect((await make(G2, n, t, 'assault', '  Be kind!  '))[0].name).toBe(n);
        expect(validateClan({ name: n, tag: t })).toBeNull();
      }
      expect((await sup(`select description from clans where name = 'Fun Clan'`)).rows[0].description).toBe('Be kind!');
      // the developer clan itself is exempt and untouched
      expect((await sup(`select name, tag, emblem from clans where is_dev`)).rows).toEqual([{ name: 'Sakura Dev Lab', tag: 'DEV', emblem: 'wiki' }]);
    });

    it('M3/F4 a kick keeps the player out for 7 days (open and code joins), leaving bans nobody, an officer\'s accept lets them back', async () => {
      const [K, Q, S] = [P(32), P(33), P(34)];
      const [c] = await as(K, `select * from create_clan('Kids Club', 'KID', 'assault', 'open', '')`);
      await as(Q, 'select join_clan($1)', [c.id]);
      await as(K, 'select kick($1)', [Q]);
      await clearRate(Q, 'clan_join');
      await refused(as(Q, 'select join_clan($1)', [c.id]), /forbidden: you can't join this clan right now/);
      await sup(`update clans set join_mode = 'code' where id = $1`, [c.id]);
      await sup(`insert into clan_codes (clan_id, code) values ($1, 'KIDS1234') on conflict (clan_id) do update set code = excluded.code`, [c.id]);
      await clearRate(Q, 'clan_join');
      await refused(as(Q, `select join_clan_by_code('KIDS1234')`), /forbidden: you can't join this clan right now/);
      // the clan chat got one notice for the kick, no join / leave loop
      const notices = (await sup(`select body from messages where channel = $1 and user_id is null and body like 'P133%' order by id`, [`clan:${c.id}`])).rows.map((r) => r.body);
      expect(notices).toEqual(['P133 joined the clan.', 'P133 was removed from the clan.']);
      // someone else joins; leaving by yourself is no ban
      await sup(`update clans set join_mode = 'open' where id = $1`, [c.id]);
      await as(S, 'select join_clan($1)', [c.id]);
      await clearRate(S, 'clan_join');
      await as(S, 'select leave_clan()');
      await clearRate(S, 'clan_join');
      expect((await one(S, 'select (join_clan($1)).tag as r', [c.id]))).toBe('KID');
      // a leader / officer accepting their request lets them back in (and ends the ban)
      await sup(`update clans set join_mode = 'request' where id = $1`, [c.id]);
      await clearRate(Q, 'clan_join');
      await as(Q, 'select request_join($1)', [c.id]);
      await as(K, 'select answer_request($1, $2, true)', [c.id, Q]);
      expect((await sup('select count(*)::int as n from clan_bans where user_id = $1', [Q])).rows[0].n).toBe(0);
      // kicked again: the ban ends after 7 days (and housekeeping clears it)
      await as(K, 'select kick($1)', [Q]);
      await sup(`update clans set join_mode = 'open' where id = $1`, [c.id]);
      await sup(`update clan_bans set until = now() - interval '1 minute' where user_id = $1`, [Q]);
      await clearRate(Q, 'clan_join');
      expect(await one(Q, 'select (join_clan($1)).tag as r', [c.id])).toBe('KID');
      await sup('select social_housekeeping()');
      expect((await sup('select count(*)::int as n from clan_bans where user_id = $1', [Q])).rows[0].n).toBe(0);
      await refused(as(Q, 'select * from clan_bans'), /permission denied/);
    });

    it('M4 the default is Friends only: a stranger who joins a kid\'s open clan cannot DM after 72 h; the kid may opt in', async () => {
      const [K, S] = [P(35), P(36)];
      for (const u of [K, S]) await age(u, 30);
      expect((await sup(`select column_default from information_schema.columns where table_name = 'social_settings' and column_name = 'dm_privacy'`)).rows[0].column_default).toMatch(/^'friends'/);
      const [c] = await as(K, `select * from create_clan('Kids Den', 'KDN', 'assault', 'open', '')`);
      await as(S, 'select join_clan($1)', [c.id]);
      await sup(`update clan_members set joined_at = now() - interval '80 hours' where clan_id = $1`, [c.id]);
      await as(S, `select set_dm_privacy('friends_clan')`); // the stranger allows it on their side…
      await refused(dm(S, K, 'hello'), /forbidden: they can't get messages from you yet/); // …the kid's default does not
      expect(await one(K, 'select social_summary() as r')).toMatchObject({ privacy: 'friends' });
      expect(await one(K, 'select player_card($1) as r', [S])).toMatchObject({ why: 'my_setting', myPrivacy: 'friends' });
      await as(K, `select set_dm_privacy('friends_clan')`);
      expect((await dm(S, K, 'hello')).body).toBe('hello');
    });

    it('L3 stacked marks of every script are capped and never count as visible (JS and SQL agree)', async () => {
      const cases = [`ส${cp(0xe49).repeat(150)}`, `a${cp(0x301).repeat(5)}`, cp(0x5b0, 0x5b0), `Ж${cp(0x483).repeat(5)}`, cp(0x64b, 0x64b, 0x64b),
        'นี้คือภาษาไทย', 'שָׁלוֹם', 'مَرْحَبًا', 'ສະບາຍດີ', `a${cp(0x301).repeat(4)}`];
      const rows = (await sup('select x, public.valid_dm_body(x) as b, public.visible_name(x) as v from unnest($1::text[]) x', [cases])).rows;
      for (const { x, b, v } of rows) {
        expect([JSON.stringify(x), b]).toEqual([JSON.stringify(x), validMessageBody(x)]);
        expect([JSON.stringify(x), v]).toEqual([JSON.stringify(x), !nameLooksBlank(x)]);
      }
      expect(rows.map((r) => r.b)).toEqual([false, false, false, false, false, true, true, true, true, true]);
      expect(rows[2].v).toBe(false); // Hebrew vowel marks alone: a blank name
    });

    it('L4 staff words inside names and gm / dev / mod as words are reserved, digits read as letters (JS and SQL agree)', async () => {
      const names = ['GM Rosie', 'Staff Hana', 'SupplyB0t', 'Adm1n', 'Dev Rosie', 'System', 'Systemic', 'Sakura Sentine1s', 'M0D Kai', 'Ｄｅｖ　Ｒｏｓｉｅ', 'Unofficial',
        'DevTester', 'Aiko', 'Modé', 'Devi', 'Devon', 'Badminton Kid', 'Mika-chan 2', '桜ミカ', 'Sensei7051', 'Rosie2026'];
      const rows = (await sup('select x, public.reserved_name(x) as r, public.name_words(x) as w, public.social_name_ok(x) as ok, public.reserved_clan_name(x) as c from unnest($1::text[]) x', [names])).rows;
      for (const { x, r, w, ok, c } of rows) {
        expect([x, w]).toEqual([x, nameWords(x)]);
        expect([x, r]).toEqual([x, reservedName(x)]);
        expect([x, ok]).toEqual([x, !validateName(x)]);
        expect([x, c]).toEqual([x, reservedClanName(x)]);
      }
      expect(rows.filter((x) => x.r).map((x) => x.x)).toEqual(names.slice(0, 12));
      const tags = ['DEV', 'D3V', 'M0D', 'GM', 'B0T', 'PS', 'KID', 'MOON', 'GMR'];
      const tagRows = (await sup('select x, public.reserved_clan_tag(x) as r from unnest($1::text[]) x', [tags])).rows;
      for (const { x, r } of tagRows) expect([x, r]).toEqual([x, reservedClanTag(x)]);
      expect(tagRows.filter((x) => x.r).map((x) => x.x)).toEqual(['DEV', 'D3V', 'M0D', 'GM', 'B0T']);
      // the profile trigger refuses them as new names
      await refused(as(P(37), 'update profiles set name = $2 where id = $1', [P(37), 'Staff Hana']), /invalid: that name is reserved/);
    });
  });

  describe('final verification (R1–R5)', () => {
    let db; let as; let one;
    const sup = (text, params) => db.query(text, params);
    const clearRate = (uid) => sup('delete from rate_events where user_id = $1', [uid]);
    const age = (uid, days) => db.exec(`set session_replication_role = replica;
      update profiles set created_at = now() - interval '${Number(days)} days' where id = '${uid}';
      set session_replication_role = default;`);
    const Q = (i) => U(800 + i);
    const users = Array.from({ length: 16 }, (_, i) => [Q(i), `Q${800 + i}`]);

    beforeAll(async () => {
      ({ db, as, one } = await createDb({ defaultGrants: false, users }));
    }, 90000);

    it('R1 a repeat report keeps the child\'s reason and note; every earlier reason / note / place stays; message_id is the checked message', async () => {
      const [K, X] = [Q(0), Q(1)];
      await age(K, 30);
      await sup('insert into friends values ($1, $2, now()), ($2, $1, now())', [K, X]);
      const [bad] = await as(X, 'select (send_dm($1, $2) ->> \'id\')::bigint as id', [K, 'what school do you go to? whats your address']);
      const report = async (reason, note, ctx, msg) => {
        await clearRate(K);
        await as(K, 'select report_player($1, $2, $3, $4, $5)', [X, reason, note, ctx, msg]);
        return (await sup('select reason, note, context, message_id, evidence from reports where reporter_id = $1', [K])).rows[0];
      };
      let r = await report('personal_info', 'he asked for my school and my address', 'dm', bad.id);
      expect(Number(r.message_id)).toBe(Number(bad.id));
      r = await report('spam', '', 'profile', null);
      expect(r).toMatchObject({ reason: 'personal_info', note: 'he asked for my school and my address', context: 'profile' });
      expect(Number(r.message_id)).toBe(Number(bad.id));
      expect(r.evidence.earlierReports).toEqual([expect.objectContaining({ reason: 'personal_info', note: 'he asked for my school and my address', context: 'dm' })]);
      r = await report('bullying', 'now he is mean', 'dm', 999999); // a message id that is not theirs: not stored
      expect(r).toMatchObject({ reason: 'personal_info', note: 'now he is mean', context: 'dm' });
      expect(Number(r.message_id)).toBe(Number(bad.id));
      expect(r.evidence.earlierReports.map((e) => [e.reason, e.note, e.context])).toEqual([
        ['personal_info', 'he asked for my school and my address', 'dm'], ['personal_info', 'he asked for my school and my address', 'profile']]);
      expect(r.evidence.message.body).toBe('what school do you go to? whats your address');
      // a report of my own DM's id: the evidence has no message, and neither has message_id
      const [K2] = [Q(2)];
      await sup('insert into friends values ($1, $2, now()), ($2, $1, now())', [K2, X]);
      const [mine] = await as(K2, 'select (send_dm($1, $2) ->> \'id\')::bigint as id', [X, 'hi']);
      await as(K2, 'select report_player($1, $2, $3, $4, $5)', [X, 'other', '', 'dm', mine.id]);
      expect((await sup('select message_id, evidence -> \'message\' as m from reports where reporter_id = $1', [K2])).rows[0]).toEqual({ message_id: null, m: null });
      // ten more repeats: earlierReports keeps the newest 10
      for (let i = 0; i < 10; i++) r = await report('other', `note ${i}`, 'profile', null);
      expect(r.evidence.earlierReports).toHaveLength(10);
      expect(r.evidence.earlierReports.at(-1).note).toBe('note 8');
      expect(r.reason).toBe('personal_info');
    });

    it('R2 look-alike letters, letters one by one, camel case and invisible characters never pass for staff or the developer clan (JS and SQL agree)', async () => {
      const names = [
        `${cp(0x13a0)}EV Rosie`, `${cp(0x13a0)}ev Rosie`, `${cp(0x1d05, 0x1d07, 0x1d20)} Rosie`, `${cp(0xa4e2)}taff Hana`, `${cp(0x13aa)}dmin`, `${cp(0x13da)}upply Bot`,
        'GMRosie', 'DevRosie', 'G.M. Rosie', 'D.E.V. Team', 'DevTeam', `D${cp(0xfe0f)}ev Rosie`, `G${cp(0xfe0f)}M Rosie`, `M${cp(0xfe0f)}od Rosie`, `D${cp(0xe0100)}ev Rosie`,
        `D${cp(0x180b)}ev Rosie`, `${cp(0x15ea, 0x15f4, 0x142f)}`, `${cp(0x1f173, 0x1f174, 0x1f185)} Rosie`, `${cp(0x110)}ev Rosie`, `${cp(0x54f)}ystem`];
      const fine = ['Devon', 'Devi', 'Modé', 'Mia Rose', 'Bjørn', 'さくら', 'Sensei7051', 'Rosie2026', 'Aiko-chan', 'McKenzie'];
      const rows = (await sup(`select x, public.reserved_name(x) as r, public.lookalike_mix(x) as m, public.name_words(x) as w, public.name_camel(x) as c,
        public.name_key(x) as k, public.clan_name_key(x) as ck from unnest($1::text[]) x`, [[...names, ...fine]])).rows;
      for (const { x, r, m, w, c, k, ck } of rows) {
        expect([x, w, c, k, ck, m, r]).toEqual([x, nameWords(x), nameCamel(x), nameKey(x), clanNameKey(x), mixesLookalikes(x), reservedName(x)]);
        expect([x, r || m]).toEqual([x, names.includes(x)]);
      }
      // new names: the profile trigger refuses every one of them, and so does the client
      for (const [i, x] of names.entries()) {
        await clearRate(Q(3));
        await refused(as(Q(3), 'update profiles set name = $2 where id = $1', [Q(3), x]), /invalid: (that name is reserved|names can't mix in look-alike letters)/);
        expect(validateName(x), `${i} ${x}`).toBeTruthy();
      }
      await as(Q(3), 'update profiles set name = $2 where id = $1', [Q(3), 'Bjørn']);
      // clans: the verifier's fake developer clans and staff clans are refused
      const make = async (who, name, tag) => {
        await clearRate(who);
        await sup('delete from clans where leader_id = $1', [who]);
        return as(who, 'select name from create_clan($1, $2, $3, $4, $5)', [name, tag, 'assault', 'open', '']);
      };
      for (const n of [`Sakura ${cp(0x13a0)}EV Lab`, `Sakura ${cp(0x13a0)}ev Lab`, `Sakura ${cp(0x1d05, 0x1d07, 0x1d20)} Lab`, `${cp(0x13aa)}dmin Clan`, `${cp(0xa4e2)}taff Team`,
        `${cp(0x13be)}fficial Clan`, `${cp(0x54f)}ystem Clan`, 'D.E.V. Team', 'DevTeam', `G${cp(0x200d)}M Clan`, `M${cp(0x200d)}od Clan`, `D${cp(0x200d)}ev Clan`]) {
        await refused(make(Q(4), n, 'LAB'), /invalid: (that clan name is reserved|clan names can't mix in look-alike letters)/);
        expect(validateClan({ name: n, tag: 'LAB' }), n).toBeTruthy();
      }
      // the same clan name with an invisible joiner is the same name; two Japanese clans with a Latin word are not
      expect((await make(Q(4), 'さくら組', 'JP'))[0].name).toBe('さくら組');
      for (const n of [`さくら${cp(0x200d)}組`, `さくら${cp(0xfe0f)}組`, 'さくら 組', 'さくら・組']) await refused(make(Q(5), n, 'JP2'), /name_taken/);
      expect((await make(Q(5), 'さくら Clan', 'SC'))[0].name).toBe('さくら Clan');
      expect((await make(Q(6), 'ひまわり Clan', 'HC'))[0].name).toBe('ひまわり Clan');
    });

    it('R3 blocking a player who sat in my room earlier changes its secret too (not when someone else has the seat now)', async () => {
      const [K, P, O] = [Q(8), Q(9), Q(10)];
      const s1 = (await one(K, `select open_room('KXR01') as r`)).secret;
      expect((await one(P, `select join_room('KXR01') as r`)).secret).toBe(s1);
      await as(P, `select leave_room('KXR01')`);
      await as(K, 'select block_player($1)', [P]);
      const s2 = (await sup(`select secret from coop_rooms where code = 'KXR01'`)).rows[0].secret;
      expect(s2).not.toBe(s1); // the ex-guest knew s1
      await clearRate(K);
      expect((await one(K, `select open_room('KXR01') as r`)).secret).toBe(s2);
      // someone else holds the seat now: their connection stays (no new secret)
      await clearRate(O);
      expect((await one(O, `select join_room('KXR01') as r`)).secret).toBe(s2);
      await clearRate(K);
      await as(K, 'select unblock_player($1)', [P]);
      await clearRate(K);
      await as(K, 'select block_player($1)', [P]);
      expect((await sup(`select secret, guest_id from coop_rooms where code = 'KXR01'`)).rows[0]).toEqual({ secret: s2, guest_id: O });
      // a player who never sat in my room: nothing changes
      await clearRate(K);
      await as(K, 'select block_player($1)', [Q(11)]);
      expect((await sup(`select secret from coop_rooms where code = 'KXR01'`)).rows[0].secret).toBe(s2);
    });

    it('R4 clan notices say who they are about (join, leave, kick, roles, a new leader, requests, a filled request); players cannot set it', async () => {
      const [K, P, L, D1] = [Q(12), Q(13), Q(14), Q(15)];
      const [c] = await as(K, `select * from create_clan('Notice Club', 'NC', 'assault', 'open', '')`);
      for (const u of [P, L, D1]) {
        await clearRate(u);
        await as(u, 'select join_clan($1)', [c.id]);
      }
      await as(K, 'select set_role($1, $2)', [L, 'officer']);
      await as(P, 'update profiles set name = $2 where id = $1', [P, 'Q813 Renamed']);
      await clearRate(P);
      await as(P, 'select leave_clan()');
      await clearRate(P);
      await as(P, 'select join_clan($1)', [c.id]);
      await as(L, 'select kick($1)', [P]);
      // a material request (a day in the clan first)
      await sup(`update clan_members set joined_at = now() - interval '100 hours' where clan_id = $1`, [c.id]);
      await one(K, `select request_materials('mat_feather_superRare') as r`);
      await clearRate(K);
      await as(K, 'select leave_clan()'); // the leader leaves: L (officer) is the new leader
      const rows = (await sup(`select body, about from messages where channel = $1 and kind = 'system' order by id`, [`clan:${c.id}`])).rows;
      const who = { [K]: 'K', [P]: 'P', [L]: 'L', [D1]: 'D1' };
      const got = rows.map((r) => [r.body.replace(/^Q8\d\d( Renamed)?/, 'X'), (r.about || []).map((u) => who[u]).join('+')]);
      expect(got).toEqual([
        ['X joined the clan.', 'K'], ['X joined the clan.', 'P'], ['X joined the clan.', 'L'], ['X joined the clan.', 'D1'], ['X is now officer.', 'L'],
        ['X left the clan.', 'P'], ['X joined the clan.', 'P'], ['X was removed from the clan.', 'P'],
        ['X asks for 3 × Hawk Quill. Clan → Requests to help!', 'K'], ['X is the new leader.', 'L'], ['X left the clan.', 'K'],
      ]);
      // a player's own line never carries one, and players cannot write the column
      await clearRate(D1);
      const [line] = await as(D1, `insert into messages (channel, user_id, body) values ($1, $2, 'hi') returning about`, [`clan:${c.id}`, D1]);
      expect(line.about).toBeNull();
      await refused(as(D1, `insert into messages (channel, user_id, body, about) values ($1, $2, 'x', array[$3::uuid])`, [`clan:${c.id}`, D1, K]), /permission denied/);
    });

    it('R4 a filled request names the requester and the donors it thanks', async () => {
      const [R, A, B] = [Q(0), Q(1), Q(2)];
      for (const u of [R, A, B]) {
        await clearRate(u);
        await sup('delete from clan_members where user_id = $1', [u]);
      }
      const [c] = await as(R, `select * from create_clan('Filled Club', 'FC', 'assault', 'open', '')`);
      for (const u of [A, B]) {
        await clearRate(u);
        await as(u, 'select join_clan($1)', [c.id]);
      }
      await sup(`update clan_members set joined_at = now() - interval '100 hours' where clan_id = $1`, [c.id]);
      for (const u of [R, A, B]) await age(u, 10);
      const req = await one(R, `select request_materials('mat_feather_rare') as r`);
      await as(A, 'select donate($1, 3, $2)', [req.id, KEY(8901)]);
      await as(B, 'select donate($1, 3, $2)', [req.id, KEY(8902)]);
      const filled = (await sup(`select body, about from messages where channel = $1 and body like '%filled%'`, [`clan:${c.id}`])).rows[0];
      expect(filled.body).toBe('Q800\'s request is filled — thanks Q801, Q802!');
      expect(filled.about).toEqual([R, A, B]);
    });
  });
});
