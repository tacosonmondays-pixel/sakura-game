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
import { DEV_CODE, BOSS_HIT_CAP, BOSS_BASE_HP, BOSS_HITS_PER_DAY, CLAN_MAX_MEMBERS, CLAN_BOSSES, xpForLevel, CLAN_XP } from '../../src/online/clanRules.js';

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
    for (const action of ['chat', 'clan_create', 'clan_join', 'boss_hit', 'transfer']) {
      const m = call(action);
      expect(m, action).toBeTruthy();
      expect(Number(m[1]), `${action} gap`).toBe(RULES[action].gapMs);
      expect(Number(m[2]), `${action} max`).toBe(RULES[action].max);
      expect(toMs(m[3]), `${action} window`).toBe(RULES[action].windowMs);
    }
    expect(RULES.boss_hit.max).toBe(BOSS_HITS_PER_DAY);
  });

  it('mirror the clan rules (boss pool, cap, rotation, XP curve, member cap)', () => {
    expect(sql).toContain(`round(${BOSS_BASE_HP} * (1 + 0.2 * (clan_level(xp) - 1)))`);
    expect(sql).toContain(`, 0), ${BOSS_HIT_CAP});`);
    expect(sql).toContain(`array[${CLAN_BOSSES.map((b) => `'${b.id}'`).join(', ')}]`);
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

let PGlite = null;
try {
  ({ PGlite } = await import('@electric-sql/pglite'));
} catch {
  PGlite = null; // optional dev dependency missing: the lint above still runs
}

describe.skipIf(!PGlite)('supabase migrations (run on Postgres)', () => {
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
      grant usage on schema public to anon, authenticated;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
      alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
      create publication supabase_realtime;
    `);
    await db.exec(sql);
    await db.exec(sql); // must be idempotent (pasting it again in the SQL editor is harmless)
    await db.exec(`insert into auth.users values ('${A}'), ('${B}'), ('${C}'), ('${D}')`);
    for (const [id, name] of [[A, 'Aiko'], [B, 'Bea'], [C, 'Cleo'], [D, 'Dara']]) await as(id, 'insert into profiles (id, name) values ($1, $2)', [id, name]);
  }, 60000);

  it('profiles: readable by players, writable only by their owner', async () => {
    await refused(as(A, `insert into profiles (id, name) values ('55555555-5555-4555-8555-555555555555', 'Evil')`), /row-level security|foreign key/);
    await as(A, `update profiles set name = 'Hacked' where id = $1`, [B]);
    expect((await as(C, 'select name from profiles where id = $1', [B]))[0].name).toBe('Bea');
    // the adapter's first sign-in (upsert, ignore duplicates): a second tab racing it is a no-op
    await as(A, `insert into profiles (id, name) values ($1, 'Twice') on conflict (id) do nothing`, [A]);
    expect((await as(B, 'select name from profiles where id = $1', [A]))[0].name).toBe('Aiko');
  });

  it('chat: post only as yourself, 1 message per 2 s (server side), clan chat for members only', async () => {
    const [m] = await as(A, `insert into messages (channel, user_id, body, name) values ('global', $1, 'hello', 'Spoofed') returning name, level`, [A]);
    expect(m.name).toBe('Aiko'); // the trigger stamps the real profile
    await refused(as(A, `insert into messages (channel, user_id, body) values ('global', $1, 'again')`, [A]), /^rate_limited:\d+$/);
    await refused(as(B, `insert into messages (channel, user_id, body) values ('global', $1, 'fake')`, [A]), /forbidden|row-level security/);
    await refused(as(B, `insert into messages (channel, user_id, body, kind) values ('global', $1, 'x', 'system')`, [B]), /row-level security/);
    await refused(as(B, `insert into messages (channel, user_id, body) values ('global', $1, '')`, [B]), /check constraint/);
    await as(A, `update messages set body = 'edited'`); // no update policy: silently nothing
    expect((await as(B, `select body from messages where channel = 'global'`)).map((r) => r.body)).toEqual(['hello']);
  });

  let clanId;
  it('clans: create, join, roles, clan chat privacy, no direct writes', async () => {
    const [clan] = await as(A, `select * from create_clan('Petal Squad', 'ps', 'gems', 'open', 'hi')`);
    clanId = clan.id;
    expect(clan.tag).toBe('PS');
    await refused(as(A, `select * from create_clan('Other', 'OT', 'gems', 'open', '')`), /already_member/);
    await refused(as(B, `insert into clans (name, tag) values ('Sneaky', 'SN')`), /row-level security/);
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
    await refused(as(C, `select * from join_clan_by_code('nope')`), /not_found/);
    const [dev] = await as(C, `select * from join_clan_by_code('rosie777')`);
    expect(dev.is_dev).toBe(true);
    expect(dev.name).toBe('Sakura Dev Lab');
    expect((await as(A, 'select count(*)::int as n from clans where is_dev'))[0].n).toBe(0);
    expect((await as(C, 'select count(*)::int as n from clan_codes'))[0].n).toBe(0); // the code itself is never readable
  });

  it('clan boss: capped hits, 3 attempts per 24 h, shared HP pool, one claim per tier', async () => {
    const [{ s }] = await as(A, 'select boss_state($1) as s', [clanId]);
    expect(s.hp).toBe(BOSS_BASE_HP);
    await as(A, 'select submit_boss_damage(50000)');
    await as(A, 'select submit_boss_damage(999999999)');
    await as(A, 'select submit_boss_damage(10)');
    await refused(as(A, 'select submit_boss_damage(10)'), /^rate_limited:\d+$/);
    const [{ s: s2 }] = await as(B, 'select boss_state($1) as s', [clanId]);
    expect(s2.hp).toBe(BOSS_BASE_HP - 50000 - BOSS_HIT_CAP - 10);
    expect(s2.board[0]).toMatchObject({ userId: A, name: 'Aiko', hits: 3 });
    await refused(as(B, 'select claim_boss_reward($1)', [s2.week]), /forbidden/);
    await as(B, `select submit_boss_damage(${BOSS_HIT_CAP})`);
    const [{ s: s3 }] = await as(B, 'select boss_state($1) as s', [clanId]);
    expect(s3.defeated).toBe(true);
    expect(s3.myHitsToday).toBe(1);
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
    await refused(as(A, `select * from create_clan('Too Soon', 'TS', 'wiki', 'open', '')`), /^rate_limited:\d+$/);
    const [rq] = await as(D, `select * from create_clan('Quiet Garden', 'QG', 'wiki', 'request', '')`);
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

  it('transfer codes: one use, hidden table, case-insensitive code', async () => {
    const [{ r }] = await as(A, `select create_transfer('SAVE-DATA') as r`);
    expect(r.code).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect((await as(B, 'select redeem_transfer($1) as r', [r.code.toLowerCase()]))[0].r).toBe('SAVE-DATA');
    await refused(as(C, 'select redeem_transfer($1)', [r.code]), /expired/);
    expect(await as(C, 'select * from transfer_codes')).toEqual([]);
    expect(await as(C, 'select * from rate_events')).toEqual([]);
  });

  it('internal helpers cannot be called by players; realtime publishes the live tables', async () => {
    await refused(as(A, `select add_member($1, '00000000-0000-4000-8000-000000000777', 'leader')`, [A]), /permission denied/);
    await refused(as(A, `select enforce_rate('chat', 0, 1000, interval '1 minute')`), /permission denied/);
    await refused(as(A, `select system_message('global', 'fake news')`), /permission denied/);
    const pub = await db.query(`select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1`);
    expect(pub.rows.map((r) => r.tablename)).toEqual(['clan_boss', 'clan_members', 'messages']);
  });
});
