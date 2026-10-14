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
// tests/online/localSocial.test.js runs the same scenarios against the local mirror.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MIGRATIONS_DIR, MIGRATION_FILES, PGlite, createDb, refused } from './pgHarness.js';
import { validMessageBody } from '../../src/online/socialRules.js';
import { validateName, RESERVED_NAMES } from '../../src/online/clanRules.js';
import { nameKey, LOOKALIKE_FROM, LOOKALIKE_TO, nameLooksBlank } from '../../src/online/textRules.js';
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

    it('#6 a block is never revealed: closed request, full room; the blocker no longer sees the blocked player\'s request', async () => {
      const [A, B, C] = [P(11), P(12), P(13)];
      const [clan] = await as(B, `select * from create_clan('Quiet Pond', 'QP', 'gems', 'open', '')`);
      for (const who of [A, C]) await as(who, 'select join_clan($1)', [clan.id]);
      await sup(`update clan_members set joined_at = now() - interval '100 hours' where clan_id = $1`, [clan.id]);
      for (const who of [A, B, C]) await age(who, 10);
      const r = await one(B, `select request_materials('mat_feather_rare') as r`);
      await as(B, 'select block_player($1)', [A]);
      expect((await one(A, 'select donation_state() as r')).requests.map((x) => [x.id, x.open])).toEqual([[r.id, false]]);
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
      expect(card).toMatchObject({ why: 'stranger', myPrivacy: 'friends_clan' });
      expect(card).not.toHaveProperty('privacy');
      await as(C, `select set_dm_privacy('nobody')`);
      expect((await one(A, 'select player_card($1) as r', [C])).myPrivacy).toBe('friends_clan');
    });
  });
});
