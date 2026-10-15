// Shared PGlite harness for the migration tests: a real Postgres (compiled to WASM) with a small
// stub of Supabase's auth schema, roles and realtime publication; the migrations are applied
// TWICE (they must be idempotent). `as(uid, sql, params)` runs one statement as a signed-in
// player in its own transaction, like one PostgREST request.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';

export const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');
export const MIGRATION_FILES = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
export const MIGRATION_SQL = MIGRATION_FILES.map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8')).join('\n');

let PGliteCtor = null;
try {
  ({ PGlite: PGliteCtor } = await import('@electric-sql/pglite'));
} catch {
  PGliteCtor = null; // optional dev dependency missing: the lint tests still run
}
export const PGlite = PGliteCtor;

/** The developer clan's id in the migration (its row is seeded; its join code is not). */
export const DEV_CLAN_UUID = '00000000-0000-4000-8000-000000000777';
/**
 * A TEST-ONLY join code for the developer clan. The migration seeds no code (the owner sets the
 * real one in the live database and never commits it), so each test database gets this one.
 */
export const TEST_DEV_CODE = 'TEST-DEV-LAB';

/**
 * Sets the developer clan's join code as the superuser, the way the owner does in the SQL editor
 * (docs/ONLINE.md, "Rotate the developer clan code"). Inserts the row when there is none yet.
 */
export async function setDevCode(db, code = TEST_DEV_CODE) {
  await db.query(`insert into public.clan_codes (clan_id, code) values ($1, $2)
    on conflict (clan_id) do update set code = excluded.code`, [DEV_CLAN_UUID, code]);
}

/**
 * @param {{ defaultGrants: boolean, users?: [string, string][], devCode?: string|null }} opts
 *   users: [uuid, name]; devCode: the developer clan's test join code (null: none, like a fresh
 *   project before the owner sets one)
 */
export async function createDb({ defaultGrants, users = [], sql = MIGRATION_SQL, runs = 2, devCode = TEST_DEV_CODE }) {
  const db = new PGliteCtor();
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
  for (let i = 0; i < runs; i++) await db.exec(sql);
  if (devCode) await setDevCode(db, devCode);

  // PGlite has ONE connection: calls fired together (Promise.all, the race tests) run one whole
  // transaction after another in the order they arrive, like requests queued on a row lock /
  // advisory lock of a real server
  let queue = Promise.resolve();
  function as(uid, text, params = []) {
    const run = queue.then(() => asNow(uid, text, params));
    queue = run.catch(() => {});
    return run;
  }
  async function asNow(uid, text, params) {
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
  /** One value: `select fn(...) as r` → r. */
  const one = async (uid, text, params = []) => (await as(uid, text, params))[0]?.r;

  if (users.length) {
    await db.exec(`insert into auth.users values ${users.map(([id]) => `('${id}')`).join(', ')}`);
    for (const [id, name] of users) await as(id, 'insert into profiles (id, name) values ($1, $2)', [id, name]);
  }
  return { db, as, one };
}

export async function refused(p, re) {
  let err = null;
  try {
    await p;
  } catch (e) {
    err = e;
  }
  expect(err, `expected a refusal matching ${re}`).toBeTruthy();
  expect(err.message).toMatch(re);
  return err;
}
