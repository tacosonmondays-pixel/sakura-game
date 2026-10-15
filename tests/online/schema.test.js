// The Supabase migration (supabase/migrations/*.sql), checked two ways:
//  1. lint: every table has Row Level Security, the chat trigger and the rate limits use the
//     same numbers as src/online/limits.js, the dev clan is seeded, no secrets in the repo;
//  2. run: the migration is applied (twice — it must be idempotent) to a real Postgres engine
//     (PGlite, Postgres compiled to WASM) next to a small stub of Supabase's auth schema, roles
//     and realtime publication, then exercised as several signed-in players: RLS, the clan
//     functions, the clan boss, transfer codes and the server-side rate limits.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { RULES } from '../../src/online/limits.js';
import {
  DEV_CODE, BOSS_HITS_PER_DAY, CLAN_MAX_MEMBERS, CLAN_BOSSES, xpForLevel, CLAN_XP, bossHitCap, bossMaxHp, BOSS_POOL_ATTEMPTS,
  BOSS_MIN_MEMBERS, BOSS_FULL_RUN_SECONDS, BOSS_MIN_SECONDS, RESERVED_NAMES, INVITE_META_MAX,
} from '../../src/online/clanRules.js';

const DIR = join(process.cwd(), 'supabase', 'migrations');
const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
const sql = files.map((f) => readFileSync(join(DIR, f), 'utf8')).join('\n');

describe('supabase migrations (lint)', () => {
  it('use the Supabase CLI layout <14-digit timestamp>_<name>.sql', () => {
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(f).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
    // one source of truth: no stray copy of the schema elsewhere
    expect(existsSync(join(process.cwd(), 'supabase', 'schema.sql'))).toBe(false);
  });

  it('enable row level security on every table', () => {
    const tables = [...sql.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1]);
    expect(tables).toEqual(expect.arrayContaining(['profiles', 'clans', 'clan_members', 'clan_requests', 'messages', 'clan_boss', 'clan_boss_hits', 'clan_boss_claims', 'transfer_codes', 'rate_events']));
    for (const t of tables) expect(sql, t).toContain(`alter table public.${t} enable row level security;`);
  });

  it('rate-limit chat with a trigger and use the client limiter\'s numbers', () => {
    expect(sql).toMatch(/create trigger messages_rate_limit before insert on public\.messages/);
    const call = (action) => sql.match(new RegExp(`enforce_rate\\('${action}', (\\d+), (\\d+), interval '([^']+)'\\)`));
    const toMs = (txt) => {
      const [n, unit] = txt.split(' ');
      return Number(n) * { minute: 60e3, hour: 3600e3, day: 86400e3 }[unit.replace(/s$/, '')];
    };
    for (const action of ['chat', 'clan_create', 'clan_join', 'boss_hit', 'boss_start', 'transfer', 'room']) {
      const m = call(action);
      expect(m, action).toBeTruthy();
      expect(Number(m[1]), `${action} gap`).toBe(RULES[action].gapMs);
      expect(Number(m[2]), `${action} max`).toBe(RULES[action].max);
      expect(toMs(m[3]), `${action} window`).toBe(RULES[action].windowMs);
    }
    expect(RULES.boss_hit.max).toBe(BOSS_HITS_PER_DAY);
  });

  it('mirror the clan rules (boss pool, caps, timing, rotation, XP curve, member cap, names, invites)', () => {
    for (const b of CLAN_BOSSES) expect(sql).toContain(`when '${b.id}' then ${b.hitCap}`);
    expect(sql).toContain(`boss_hit_cap(v_boss) * ${BOSS_POOL_ATTEMPTS} * greatest(${BOSS_MIN_MEMBERS}, v_members) * (1 + 0.2 * (clan_level(xp) - 1))`);
    expect(sql).toContain(`/ ${BOSS_FULL_RUN_SECONDS}.0))::bigint`);
    expect(sql).toContain(`< ${BOSS_MIN_SECONDS} then 0`);
    expect(sql).toContain(`array[${CLAN_BOSSES.map((b) => `'${b.id}'`).join(', ')}]`);
    expect(sql).toContain(`(${RESERVED_NAMES.map((n) => `'${n}'`).join(', ')})`);
    expect(sql).toContain(`pg_column_size(p_meta) <= ${INVITE_META_MAX}`);
    expect(sql).toContain('max_members int not null default ' + CLAN_MAX_MEMBERS);
    expect(xpForLevel(3)).toBe(1500);
    expect(sql).toContain('500 * v_level');
    expect(sql).toContain(`xp = xp + ${CLAN_XP.chat}`);
    expect(sql).toContain(`least(${CLAN_XP.bossHitMax}, ${CLAN_XP.bossHitBase} + v_dmg / ${1 / CLAN_XP.bossPerDamage})`);
  });

  it('seed the developer clan with the owner\'s code, hidden from browsing', () => {
    expect(sql).toContain(`'${DEV_CODE}'`);
    expect(sql).toMatch(/is_dev boolean not null default false/);
    expect(sql).toMatch(/create policy clans_read on public\.clans for select to authenticated using \(not is_dev or id = public\.my_clan\(\)\)/);
  });

  it('keep secrets out of the repo', () => {
    const files2 = [sql, readFileSync(join(process.cwd(), 'supabase', 'config.toml'), 'utf8'), readFileSync(join(process.cwd(), '.github', 'workflows', 'deploy.yml'), 'utf8')];
    for (const text of files2) {
      expect(text).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/); // JWTs (anon / service keys)
      expect(text).not.toMatch(/sb_(secret|publishable)_[A-Za-z0-9_-]{10,}/);
      expect(text).not.toMatch(/https:\/\/[a-z0-9]{20}\.supabase\.co/);
      expect(text.toLowerCase()).not.toContain('service_role_key');
    }
    const deploy = files2[2];
    expect(deploy).toContain('VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}');
    expect(deploy).toContain('VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}');
  });
});

// ---------------------------------------------------------------------------------------------
// Real Postgres
// ---------------------------------------------------------------------------------------------

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const D = '44444444-4444-4444-8444-444444444444';
const E = '55555555-5555-4555-8555-555555555555';
const F = '66666666-6666-4666-8666-666666666666';

let PGlite = null;
try {
  ({ PGlite } = await import('@electric-sql/pglite'));
} catch {
  PGlite = null; // optional dev dependency missing: the lint above still runs
}

// Run twice: once with Supabase's classic default grants (every new table granted to anon /
// authenticated, TRUNCATE included) and once with none at all, since newer projects may not grant
// new tables by default: the migration's own grants must give the same result either way.
for (const defaultGrants of [true, false])
describe.skipIf(!PGlite)(`supabase migrations (run on Postgres, ${defaultGrants ? 'with' : 'without'} default grants)`, () => {
  let db;

  /** Runs one statement as a signed-in player (own transaction, like one PostgREST request). */
  async function as(uid, text, params = []) {
    await db.exec('begin');
    try {
      await db.exec(`set local role authenticated; select set_config('request.jwt.claim.sub', '${uid}', true);`);
      const r = await db.query(text, params);
      await db.exec('commit');
      return r.rows;
    } catch (e) {
      await db.exec('rollback');
      throw e;
    }
  }
  const refused = async (p, re) => {
    let err = null;
    try {
      await p;
    } catch (e) {
      err = e;
    }
    expect(err, `expected a refusal matching ${re}`).toBeTruthy();
    expect(err.message).toMatch(re);
  };

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon nologin; create role authenticated nologin; create role service_role nologin;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      ${defaultGrants ? `grant usage on schema public to anon, authenticated;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
      alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;` : ''}
      create publication supabase_realtime;
    `);
    await db.exec(sql);
    await db.exec(sql); // must be idempotent (pasting it again in the SQL editor is harmless)
    await db.exec(`insert into auth.users values ('${A}'), ('${B}'), ('${C}'), ('${D}'), ('${E}'), ('${F}')`);
    for (const [id, name] of [[A, 'Aiko'], [B, 'Bea'], [C, 'Cleo'], [D, 'Dara'], [E, 'Emi'], [F, 'Fumi']]) await as(id, 'insert into profiles (id, name) values ($1, $2)', [id, name]);
  }, 60000);

  it('profiles: readable by players, writable only by their owner', async () => {
    await refused(as(A, `insert into profiles (id, name) values ('77777777-7777-4777-8777-777777777777', 'Evil')`), /row-level security|foreign key/);
    await as(A, `update profiles set name = 'Hacked' where id = $1`, [B]);
    expect((await as(C, 'select name from profiles where id = $1', [B]))[0].name).toBe('Bea');
    // only name / level / avatar / last_active are editable, and nothing is deletable
    await refused(as(A, `update profiles set created_at = now() - interval '9 years' where id = $1`, [A]), /permission denied/);
    await refused(as(A, 'delete from profiles where id = $1', [A]), /permission denied/);
    await as(A, `update profiles set level = 7 where id = $1`, [A]);
    expect((await as(B, 'select level from profiles where id = $1', [A]))[0].level).toBe(7);
    // last_active is the server's: stamped on every write, not writable (a fake "online now")
    await refused(as(A, `update profiles set last_active = now() + interval '9 years' where id = $1`, [A]), /permission denied/);
    await db.query(`update profiles set last_active = now() - interval '3 days' where id = $1`, [A]);
    await as(A, `update profiles set level = 8 where id = $1`, [A]);
    expect((await as(B, `select extract(epoch from (now() - last_active))::float8 as s from profiles where id = $1`, [A]))[0].s).toBeLessThan(60);
    // the adapter's first sign-in (upsert, ignore duplicates): a second tab racing it is a no-op
    await as(A, `insert into profiles (id, name) values ($1, 'Twice') on conflict (id) do nothing`, [A]);
    expect((await as(B, 'select name from profiles where id = $1', [A]))[0].name).toBe('Aiko');
  });

  it('profiles: no impersonation names (reserved words, invisible / bidi / control characters)', async () => {
    for (const bad of ['System', 'Supply Bot', 'supply-bot', 'ADMIN', 'Dev', 'Sakura Dev Lab', 'Aiko\u202Eevil', 'Ai\u200Bko', 'Ai\u00ADko', 'Aik\u0007o', ' Aiko']) {
      await refused(as(B, 'update profiles set name = $1 where id = $2', [bad, B]), /check constraint/);
    }
    expect((await as(C, 'select name from profiles where id = $1', [B]))[0].name).toBe('Bea');
    // every Unicode format (Cf) and control (Cc) character, BMP and astral, is refused
    const chars = [];
    for (let c = 1; c <= 0x10ffff; c++) {
      if (c >= 0xd800 && c <= 0xdfff) continue;
      const ch = String.fromCodePoint(c);
      if (/[\p{Cf}\p{Cc}]/u.test(ch)) chars.push(`Ai${ch}ko`);
    }
    expect(chars.length).toBeGreaterThan(150);
    const [{ n }] = await as(C, 'select count(*)::int as n from unnest($1::text[]) x where public.valid_display_name(x)', [chars]);
    expect(n).toBe(0);
    const [{ ok }] = await as(C, `select public.valid_display_name('Mika-chan 2') and public.valid_display_name('桜ミカ') as ok`);
    expect(ok).toBe(true);
  });

  it('chat: post only as yourself, 1 message per 2 s (server side), clan chat for members only', async () => {
    // the author's name / level / avatar / time are not the client's to write …
    await refused(as(A, `insert into messages (channel, user_id, body, name) values ('global', $1, 'spoof', 'Spoofed')`, [A]), /permission denied/);
    const [m] = await as(A, `insert into messages (channel, user_id, body) values ('global', $1, 'hello') returning name, level`, [A]);
    expect(m.name).toBe('Aiko'); // … the trigger stamps the real profile
    await refused(as(A, `insert into messages (channel, user_id, body) values ('global', $1, 'again')`, [A]), /^rate_limited:\d+$/);
    await refused(as(B, `insert into messages (channel, user_id, body) values ('global', $1, 'fake')`, [A]), /forbidden|row-level security/);
    await refused(as(B, `insert into messages (channel, user_id, body, kind) values ('global', $1, 'x', 'system')`, [B]), /row-level security/);
    await refused(as(B, `insert into messages (channel, user_id, body) values ('global', $1, '')`, [B]), /check constraint/);
    // chat history is append-only: no update, delete or truncate (RLS does not cover TRUNCATE)
    await refused(as(A, `update messages set body = 'edited'`), /permission denied/);
    await refused(as(A, 'delete from messages'), /permission denied/);
    await refused(as(A, 'truncate messages'), /permission denied/);
    expect((await as(B, `select body from messages where channel = 'global'`)).map((r) => r.body)).toEqual(['hello']);
  });

  it('chat: meta is bounded (nothing on text, a tiny room/stage object on invites)', async () => {
    const send = (kind, meta) => as(D, `insert into messages (channel, user_id, body, kind, meta) values ('global', $1, 'x', $2, $3::jsonb)`, [D, kind, meta == null ? null : JSON.stringify(meta)]);
    const big = { room: 'ABCDE', stage: '1-1', pad: 'x'.repeat(2_000_000) };
    await refused(send('invite', big), /check constraint/);
    await refused(send('invite', { room: 'ABCDE', stage: 'x'.repeat(17) }), /check constraint/);
    await refused(send('invite', { room: 'abcde' }), /check constraint/);
    await refused(send('invite', { room: 'ABCDE', extra: 1 }), /check constraint/);
    await refused(send('invite', ['ABCDE']), /check constraint/);
    await refused(send('invite', null), /check constraint/);
    await refused(send('text', { room: 'ABCDE' }), /check constraint/);
    const [m] = await send('invite', { room: 'K7Q2Z', stage: '1-1' });
    expect(m).toBeUndefined(); // no returning clause: the insert went through
    const [row] = await as(A, `select kind, meta from messages where user_id = $1`, [D]);
    expect(row).toEqual({ kind: 'invite', meta: { room: 'K7Q2Z', stage: '1-1' } });
    expect((await db.query(`select count(*)::int as n from messages where pg_column_size(meta) > 256`)).rows[0].n).toBe(0);
  });

  let clanId;
  it('clans: create, join, roles, clan chat privacy, no direct writes', async () => {
    const [clan] = await as(A, `select * from create_clan('Petal Squad', 'ps', 'gems', 'open', 'hi')`);
    clanId = clan.id;
    expect(clan.tag).toBe('PS');
    await refused(as(A, `select * from create_clan('Other', 'OT', 'gems', 'open', '')`), /already_member/);
    await refused(as(B, `insert into clans (name, tag) values ('Sneaky', 'SN')`), /permission denied|row-level security/);
    await refused(as(B, `update clans set xp = 999999 where id = $1`, [clanId]), /permission denied/);
    await refused(as(B, `insert into clan_members (user_id, clan_id, role) values ($1, $2, 'leader')`, [B, clanId]), /permission denied|row-level security/);
    await as(B, 'select * from join_clan($1)', [clanId]);
    await as(B, `insert into messages (channel, user_id, body) values ($1, $2, 'clan hi')`, [`clan:${clanId}`, B]);
    expect(await as(C, 'select body from messages where channel = $1', [`clan:${clanId}`])).toEqual([]);
    await refused(as(C, `insert into messages (channel, user_id, body) values ($1, $2, 'let me in')`, [`clan:${clanId}`, C]), /row-level security/);
    const log = await as(A, 'select kind, body from messages where channel = $1 order by id', [`clan:${clanId}`]);
    expect(log.map((r) => r.body)).toEqual(['Aiko joined the clan.', 'Bea joined the clan.', 'clan hi']);
    await refused(as(B, 'select kick($1)', [A]), /forbidden/);
    await as(A, `select set_role($1, 'officer')`, [B]);
    expect((await as(A, 'select role from clan_members where user_id = $1', [B]))[0].role).toBe('officer');
  });

  it('the developer clan: join with Rosie777 (any case), invisible to everyone else', async () => {
    expect((await as(C, `select join_clan_by_code('nope') as r`))[0].r).toEqual({ error: 'not_found' });
    const [{ r }] = await as(C, `select join_clan_by_code('rosie777') as r`);
    const [dev] = await as(C, 'select * from clans where id = $1', [r.id]);
    expect(dev.is_dev).toBe(true);
    expect(dev.name).toBe('Sakura Dev Lab');
    expect((await as(A, 'select count(*)::int as n from clans where is_dev'))[0].n).toBe(0);
    expect((await as(C, 'select count(*)::int as n from clan_codes'))[0].n).toBe(0); // the code itself is never readable
  });

  it('invite codes cannot be brute-forced: every wrong guess counts and commits', async () => {
    let limited = null;
    let misses = 0;
    for (let i = 0; i < 12 && !limited; i++) {
      try {
        const [{ r }] = await as(E, 'select join_clan_by_code($1) as r', [`GUESS${i}`]);
        expect(r).toEqual({ error: 'not_found' });
        misses++;
      } catch (e) {
        limited = e;
      }
    }
    expect(misses).toBe(10);
    expect(limited?.message).toMatch(/^rate_limited:\d+$/);
    // even the right code is refused now: the limit is per player, not per wrong code
    await refused(as(E, `select join_clan_by_code('Rosie777')`), /^rate_limited:\d+$/);
    expect((await db.query(`select count(*)::int as n from rate_events where user_id = $1 and action = 'clan_join'`, [E])).rows[0].n).toBe(10);
    // codes for 'code' clans are 8 characters of a 32-letter alphabet (40 random bits)
    const [cc] = await as(F, `select * from create_clan('Code Club', 'CC', 'gems', 'code', '')`);
    const [{ code }] = await as(F, 'select code from clan_codes where clan_id = $1', [cc.id]);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    await as(F, 'select leave_clan()');
  });

  it('clan boss: a started, timed battle per hit, capped per boss, pool sized by members, 3 per 24 h', async () => {
    const [{ s }] = await as(A, 'select boss_state($1) as s', [clanId]);
    const cap = bossHitCap(s.bossId);
    expect(cap).toBeGreaterThan(0);
    expect(s.maxHp).toBe(bossMaxHp(1, 2, s.bossId)); // two members (Aiko, Bea), clan level 1
    expect(s.hp).toBe(s.maxHp);
    // a submit needs a battle this player started
    await refused(as(A, `select submit_boss_damage('99999999-9999-4999-8999-999999999999', 5000)`), /invalid/);
    const start = async (who, ageSec) => {
      const [{ a }] = await as(who, 'select start_boss_attempt() as a');
      expect(a).toMatchObject({ bossId: s.bossId, cap });
      await db.query(`update clan_boss_attempts set started_at = now() - make_interval(secs => $2) where id = $1`, [a.attemptId, ageSec]);
      return a.attemptId;
    };
    const hit = async (who, id, dmg) => (await as(who, 'select submit_boss_damage($1, $2) as s', [id, dmg]))[0].s;
    // right after the start nothing can count yet: no damage, no attempt used
    let id = await start(A, BOSS_MIN_SECONDS - 2);
    let st = await hit(A, id, 50000);
    expect(st).toMatchObject({ hp: s.maxHp, myHitsToday: 0 });
    await refused(as(A, 'select submit_boss_damage($1, 5)', [id]), /invalid/); // one submit per battle
    // half the full-run time → at most half the cap; a full run → the cap; forged numbers are clamped
    id = await start(A, BOSS_FULL_RUN_SECONDS / 2);
    st = await hit(A, id, 999999999);
    const first = s.maxHp - st.hp;
    expect(first).toBeGreaterThanOrEqual(Math.floor(cap / 2));
    expect(first).toBeLessThan(cap * 0.55);
    expect(st.myHitsToday).toBe(1);
    id = await start(A, 120);
    st = await hit(A, id, -5); // nothing to score: no attempt used
    expect(st.myHitsToday).toBe(1);
    id = await start(A, 120);
    st = await hit(A, id, 999999999);
    id = await start(A, 120);
    st = await hit(A, id, 10);
    expect(st.myHitsToday).toBe(3);
    expect(s.maxHp - st.hp).toBe(first + cap + 10);
    // the fourth battle of the day is refused before it starts
    await refused(as(A, 'select start_boss_attempt()'), /^rate_limited:\d+$/);
    const [{ s: s2 }] = await as(B, 'select boss_state($1) as s', [clanId]);
    expect(s2.board[0]).toMatchObject({ userId: A, name: 'Aiko', hits: 3 });
    await refused(as(B, 'select claim_boss_reward($1)', [s2.week]), /forbidden/);
    // two forged maximum hits no longer end the week: the pool is 3 capped hits per member
    expect(s2.hp).toBeGreaterThan(2 * cap);
    // (the rest of the week's fighting, condensed)
    await db.query('update clan_boss set hp = 1000 where clan_id = $1', [clanId]);
    id = await start(B, 120);
    await hit(B, id, cap);
    const [{ s: s3 }] = await as(B, 'select boss_state($1) as s', [clanId]);
    expect(s3.defeated).toBe(true);
    expect(s3.myHitsToday).toBe(1);
    await refused(as(B, 'select start_boss_attempt()'), /fallen/);
    expect((await as(A, 'select claim_boss_reward($1) as r', [s3.week]))[0].r).toEqual({ tier: 'S' });
    await refused(as(A, 'select claim_boss_reward($1)', [s3.week]), /already claimed/);
    expect((await as(B, 'select claim_boss_reward($1) as r', [s3.week]))[0].r).toEqual({ tier: 'A' });
  });

  it('leaving: the leader hands over, an empty clan is deleted', async () => {
    await as(A, 'select leave_clan()');
    expect((await as(B, 'select role from clan_members where user_id = $1', [B]))[0].role).toBe('leader');
    await as(B, 'select leave_clan()');
    expect((await as(A, 'select count(*)::int as n from clans where id = $1', [clanId]))[0].n).toBe(0);
  });

  it('clan creation is limited to 1 per 10 minutes; requests need an officer; joins 10 per hour', async () => {
    await refused(as(A, `select * from create_clan('Too Soon', 'TS', 'gems', 'open', '')`), /^rate_limited:\d+$/);
    const [rq] = await as(D, `select * from create_clan('Quiet Garden', 'QG', 'gems', 'request', '')`);
    await refused(as(B, 'select join_clan($1)', [rq.id]), /forbidden/);
    await as(B, 'select request_join($1)', [rq.id]);
    expect((await as(D, 'select count(*)::int as n from clan_requests where clan_id = $1', [rq.id]))[0].n).toBe(1);
    await refused(as(B, 'select answer_request($1, $2, true)', [rq.id, B]), /forbidden/);
    await as(D, 'select answer_request($1, $2, true)', [rq.id, B]);
    let err = null;
    try {
      for (let i = 0; i < 12; i++) {
        await as(B, 'select leave_clan()');
        await as(B, 'select request_join($1)', [rq.id]);
        await as(D, 'select answer_request($1, $2, true)', [rq.id, B]);
      }
    } catch (e) {
      err = e;
    }
    expect(err?.message).toMatch(/^rate_limited:\d+$/);
  });

  it('transfer codes: one use, one live code per player, 60-bit codes, hidden table, any case', async () => {
    const [{ r: old }] = await as(A, `select create_transfer('OLD-SAVE') as r`);
    const [{ r }] = await as(A, `select create_transfer('SAVE-DATA') as r`);
    expect(r.code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect((await as(B, 'select redeem_transfer($1) as r', [old.code]))[0].r).toEqual({ error: 'not_found' }); // replaced
    expect((await as(B, 'select redeem_transfer($1) as r', [r.code.toLowerCase().replace(/-/g, ' ')]))[0].r).toEqual({ payload: 'SAVE-DATA' });
    expect((await as(C, 'select redeem_transfer($1) as r', [r.code]))[0].r).toEqual({ error: 'expired' });
    await refused(as(C, 'select * from transfer_codes'), /permission denied/);
    await refused(as(C, 'select * from rate_events'), /permission denied/);
    await refused(as(C, 'delete from rate_events'), /permission denied/);
  });

  it('transfer codes cannot be brute-forced: the 6th try in an hour is refused, misses included', async () => {
    const [{ r }] = await as(F, `select create_transfer('F-SAVE') as r`); // F: 1 of 5
    for (let i = 0; i < 4; i++) {
      expect((await as(E, 'select redeem_transfer($1) as r', [`WRNG-WRNG-WR${i}A`]))[0].r).toEqual({ error: 'not_found' });
    }
    expect((await as(E, 'select redeem_transfer($1) as r', ['ZZZZ-ZZZZ-ZZZZ']))[0].r).toEqual({ error: 'not_found' });
    await refused(as(E, 'select redeem_transfer($1)', [r.code]), /^rate_limited:\d+$/); // 6th, even with the right code
    expect((await db.query(`select count(*)::int as n from rate_events where user_id = $1 and action = 'transfer'`, [E])).rows[0].n).toBe(5);
    expect((await as(B, 'select redeem_transfer($1) as r', [r.code]))[0].r).toEqual({ payload: 'F-SAVE' });
  });

  it('co-op rooms: the secret goes to the host and ONE guest; wrong codes count', async () => {
    const [{ r: host }] = await as(A, `select open_room('k7q2z') as r`);
    expect(host).toMatchObject({ code: 'K7Q2Z', host: true });
    expect(host.secret).toMatch(/^[A-HJ-NP-Z2-9]{16}$/);
    expect((await as(A, `select open_room('K7Q2Z') as r`))[0].r.secret).toBe(host.secret); // a reload
    const [{ r: guest }] = await as(B, `select join_room('K7Q2Z') as r`);
    expect(guest).toEqual({ code: 'K7Q2Z', secret: host.secret, host: false });
    expect((await as(C, `select join_room('K7Q2Z') as r`))[0].r).toEqual({ error: 'full' });
    await new Promise((res) => setTimeout(res, 1050)); // 1 room call per second
    expect((await as(C, `select open_room('K7Q2Z') as r`))[0].r).toEqual({ error: 'name_taken' });
    await refused(as(C, `select join_room('K7Q2Z')`), /^rate_limited:\d+$/); // < 1 s later
    await refused(as(C, 'select * from coop_rooms'), /permission denied/);
    await as(B, `select leave_room('K7Q2Z')`); // the seat frees up
    await new Promise((res) => setTimeout(res, 1050));
    expect((await as(C, `select join_room('K7Q2Z') as r`))[0].r.secret).toBe(host.secret);
    await as(A, `select leave_room('K7Q2Z')`); // the host closes the room
    await new Promise((res) => setTimeout(res, 1050));
    expect((await as(D, `select join_room('K7Q2Z') as r`))[0].r).toEqual({ error: 'not_found' });
    expect((await db.query(`select count(*)::int as n from rate_events where user_id = $1 and action = 'room'`, [D])).rows[0].n).toBe(1);
    await refused(as(A, `select open_room('bad!')`), /invalid/);
  });

  it('internal helpers cannot be called by players; realtime publishes the live tables', async () => {
    await refused(as(A, `select add_member($1, '00000000-0000-4000-8000-000000000777', 'leader')`, [A]), /permission denied/);
    await refused(as(A, `select enforce_rate('chat', 0, 1000, interval '1 minute')`), /permission denied/);
    await refused(as(A, `select system_message('global', 'fake news')`), /permission denied/);
    await refused(as(A, 'select random_code(8)'), /permission denied/);
    await refused(as(A, `select rate_retry_ms('chat', 0, 1, interval '1 minute')`), /permission denied/);
    await refused(as(A, 'select * from clan_boss_attempts'), /permission denied/);
    const pub = await db.query(`select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1`);
    // (+ the social update's DM delivery, friend requests and clan material requests: socialSchema.test.js)
    expect(pub.rows.map((r) => r.tablename)).toEqual(['clan_boss', 'clan_members', 'direct_messages', 'donation_requests', 'friend_requests', 'messages']);
  });
});
