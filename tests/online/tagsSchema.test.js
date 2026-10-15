// Player tags (supabase/migrations/20261017000000_player_tags.sql) on a real Postgres (PGlite): every
// migration applied twice, with and without Supabase's default grants. A new profile gets the phase's
// tester tag, 'none' gives nothing, the backfill only happens during the alpha, the developers are
// seeded once (the developer clan's members at the first paste, never again), and players may read
// the tags but never write them, nor touch server_settings or the trigger function. Also the table
// ACL allow-list of every migration (what anon / authenticated may do with each table).
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite, createDb, refused, migrationText, migrationsBefore, tableAcl, TEST_DEV_CODE } from './pgHarness.js';

const FILE = '20261017000000_player_tags.sql';
const TAGS_SQL = migrationText(FILE);

const U = (n) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const [A, B, C, D, E, F, G] = [1, 2, 3, 4, 5, 6, 7].map(U);

/**
 * Everything players may do with a table, across every migration (tableAcl in pgHarness.js). anon:
 * nothing at all. A table missing here has no player grant whatsoever (functions only).
 */
const PLAYER_ACL = {
  profiles: ['SELECT', 'insert(id,name,level,avatar)', 'update(name,level,avatar)'],
  clans: ['SELECT'],
  clan_codes: ['SELECT'],
  clan_members: ['SELECT'],
  clan_requests: ['SELECT'],
  messages: ['SELECT', 'insert(channel,user_id,body,kind,meta)'],
  clan_boss: ['SELECT'],
  clan_boss_hits: ['SELECT'],
  clan_boss_claims: ['SELECT'],
  direct_messages: ['SELECT'],
  friend_requests: ['SELECT'],
  donation_requests: ['SELECT'],
  player_tags: ['SELECT'],
};

describe('player tags migration (lint)', () => {
  it('is one idempotent transaction in the house style, with no names, ids or codes', () => {
    expect(TAGS_SQL.trim().startsWith('-- Sakura Sentinels — player tags')).toBe(true);
    expect(TAGS_SQL).toMatch(/\nbegin;\n/);
    expect(TAGS_SQL.trim().endsWith('commit;')).toBe(true);
    expect(TAGS_SQL).toMatch(/Safe to run more than once/);
    expect(TAGS_SQL).toMatch(/Paste AFTER 20261008000000_online\.sql/);
    expect(TAGS_SQL).toMatch(/The game needs no update/);
    for (const t of ['player_tags', 'server_settings']) {
      expect(TAGS_SQL).toContain(`create table if not exists public.${t} (`);
      expect(TAGS_SQL).toContain(`alter table public.${t} enable row level security;`);
      expect(TAGS_SQL).toMatch(new RegExp(`revoke all on public\\.${t} from public, anon, authenticated;`));
    }
    // no account id, no join code, no developer named in the repo: the list is the owner's
    expect(TAGS_SQL).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(TAGS_SQL).not.toMatch(/clan_codes/);
    expect(TAGS_SQL).not.toMatch(/insert into public\.player_tags[^;]*values \('(?!alpha|beta)/i);
    expect(TAGS_SQL).not.toMatch(/grant (insert|update|delete|all)\b/i);
  });
});

for (const defaultGrants of [true, false])
describe.skipIf(!PGlite)(`player tags migration (run on Postgres, ${defaultGrants ? 'with' : 'without'} default grants)`, () => {
  let db; let as;
  const sup = (text, params) => db.query(text, params);
  const tagsOf = async (uid) => (await sup('select staff, tester from player_tags where user_id = $1', [uid])).rows[0] || null;
  const setPhase = (v) => sup(`update server_settings set value = $1 where key = 'tester_phase'`, [v]);
  const addUser = async (id, name) => {
    await sup(`insert into auth.users values ($1)`, [id]);
    await as(id, 'insert into profiles (id, name) values ($1, $2)', [id, name]);
  };

  beforeAll(async () => {
    ({ db, as } = await createDb({ defaultGrants, users: [[A, 'Aiko'], [B, 'Bea']] }));
  }, 90000);

  it('a new profile during the alpha gets the ALPHA tag (and nothing else)', async () => {
    expect(await tagsOf(A)).toEqual({ staff: null, tester: 'alpha' });
    expect(await tagsOf(B)).toEqual({ staff: null, tester: 'alpha' });
    expect((await sup(`select value from server_settings where key = 'tester_phase'`)).rows).toEqual([{ value: 'alpha' }]);
  });

  it('players read every tag (public, like names) and can write none', async () => {
    const rows = await as(B, 'select user_id, staff, tester from player_tags where user_id = any($1::uuid[]) order by user_id', [[A, B]]);
    expect(rows).toEqual([{ user_id: A, staff: null, tester: 'alpha' }, { user_id: B, staff: null, tester: 'alpha' }]);
    await refused(as(A, `insert into player_tags (user_id, staff) values ($1, 'dev')`, [B]), /permission denied/);
    await refused(as(A, `update player_tags set staff = 'dev' where user_id = $1`, [A]), /permission denied/);
    await refused(as(A, `update player_tags set tester = 'beta'`), /permission denied/);
    await refused(as(A, 'delete from player_tags where user_id = $1', [A]), /permission denied/);
    await refused(as(A, 'truncate player_tags'), /permission denied/);
    expect(await tagsOf(A)).toEqual({ staff: null, tester: 'alpha' });
  });

  it('server_settings and the trigger function are out of every client role\'s reach', async () => {
    await refused(as(A, 'select * from server_settings'), /permission denied/);
    await refused(as(A, `update server_settings set value = 'beta'`), /permission denied/);
    await refused(as(A, `insert into server_settings (key, value) values ('dev_tags_seeded', 'x')`), /permission denied/);
    await refused(as(A, 'delete from server_settings'), /permission denied/);
    await refused(as(A, 'select public.player_tags_stamp()'), /permission denied|trigger functions can only be called as triggers/);
    const [fn] = (await sup(`select has_function_privilege('authenticated', 'public.player_tags_stamp()', 'execute') as a,
      has_function_privilege('anon', 'public.player_tags_stamp()', 'execute') as an, p.prosecdef as definer, p.proconfig as cfg
      from pg_proc p where p.oid = 'public.player_tags_stamp()'::regprocedure`)).rows;
    expect(fn).toMatchObject({ a: false, an: false, definer: true });
    expect(fn.cfg.join(' ')).toMatch(/search_path=public, pg_temp/);
  });

  it('the table ACL allow-list: players read the tags; anon nothing; no table-level writes anywhere', async () => {
    const acl = await tableAcl(db);
    expect(acl.anon).toEqual({});
    expect(acl.authenticated).toEqual(PLAYER_ACL);
  });

  it('phases: beta stamps BETA, none stamps nothing, and a re-paste during the beta backfills nobody', async () => {
    await setPhase('beta');
    await addUser(C, 'Cleo');
    expect(await tagsOf(C)).toEqual({ staff: null, tester: 'beta' });
    await setPhase('none');
    await addUser(D, 'Dara');
    expect(await tagsOf(D)).toBeNull();
    // pasted again during the beta: Dara (no tag) stays untagged, Cleo stays a beta tester
    await setPhase('beta');
    await db.exec(TAGS_SQL);
    expect(await tagsOf(D)).toBeNull();
    expect(await tagsOf(C)).toEqual({ staff: null, tester: 'beta' });
    // the seed rows are never reset by a re-paste
    expect((await sup(`select value from server_settings where key = 'tester_phase'`)).rows).toEqual([{ value: 'beta' }]);
    // back in the alpha (the owner's choice): the backfill tags Dara, and keeps Cleo's beta tag
    await setPhase('alpha');
    await db.exec(TAGS_SQL);
    expect(await tagsOf(D)).toEqual({ staff: null, tester: 'alpha' });
    expect(await tagsOf(C)).toEqual({ staff: null, tester: 'beta' });
  });

  it('the developer seed already ran on this project (no dev clan members then): nobody is a developer', async () => {
    expect((await sup(`select count(*)::int as n from player_tags where staff is not null`)).rows[0].n).toBe(0);
    expect((await sup(`select count(*)::int as n from server_settings where key = 'dev_tags_seeded'`)).rows[0].n).toBe(1);
  });

  it('a deleted profile takes its tags with it', async () => {
    await sup('delete from profiles where id = $1', [D]);
    expect(await tagsOf(D)).toBeNull();
  });
});

for (const defaultGrants of [true, false])
describe.skipIf(!PGlite)(`player tags: the developers are seeded once (${defaultGrants ? 'with' : 'without'} default grants)`, () => {
  let db; let as;
  const sup = (text, params) => db.query(text, params);
  const tagsOf = async (uid) => (await sup('select staff, tester from player_tags where user_id = $1', [uid])).rows[0] || null;

  beforeAll(async () => {
    // a live project before this file: players, two of them in the developer clan
    ({ db, as } = await createDb({ defaultGrants, sql: migrationsBefore(FILE), users: [[A, 'Aiko'], [B, 'Bea'], [C, 'Cleo'], [E, 'Emi']] }));
    for (const uid of [A, B]) {
      const [{ r }] = await as(uid, 'select join_clan_by_code($1) as r', [TEST_DEV_CODE]);
      expect(r.error).toBeUndefined();
    }
  }, 90000);

  it('the first paste: everyone is an alpha tester, the developer clan\'s members are developers', async () => {
    expect((await sup(`select to_regclass('public.player_tags') as t`)).rows[0].t).toBeNull();
    await db.exec(TAGS_SQL);
    expect(await tagsOf(A)).toEqual({ staff: 'dev', tester: 'alpha' });
    expect(await tagsOf(B)).toEqual({ staff: 'dev', tester: 'alpha' });
    expect(await tagsOf(C)).toEqual({ staff: null, tester: 'alpha' });
    expect(await tagsOf(E)).toEqual({ staff: null, tester: 'alpha' });
    expect((await as(C, 'select count(*)::int as n from player_tags where staff = $1', ['dev']))[0].n).toBe(2);
  });

  it('later pastes add no developer: a new dev clan member stays a player, a removed developer stays removed', async () => {
    const [{ r }] = await as(C, 'select join_clan_by_code($1) as r', [TEST_DEV_CODE]);
    expect(r.error).toBeUndefined();
    // the owner removes a developer (docs/ONLINE.md one-liner)
    await sup(`update player_tags set staff = null, updated_at = now() where user_id = $1`, [B]);
    await db.exec(TAGS_SQL);
    await db.exec(TAGS_SQL);
    expect(await tagsOf(C)).toEqual({ staff: null, tester: 'alpha' });
    expect(await tagsOf(B)).toEqual({ staff: null, tester: 'alpha' });
    expect(await tagsOf(A)).toEqual({ staff: 'dev', tester: 'alpha' });
    // ... and a player who is new after the first paste is an alpha tester (the trigger)
    await sup(`insert into auth.users values ($1)`, [F]);
    await as(F, 'insert into profiles (id, name) values ($1, $2)', [F, 'Fumi']);
    expect(await tagsOf(F)).toEqual({ staff: null, tester: 'alpha' });
  });

  it('the owner adds a developer by name (docs/ONLINE.md one-liner), even one with no tag row', async () => {
    await sup(`insert into auth.users values ($1)`, [G]);
    await sup(`update server_settings set value = 'none' where key = 'tester_phase'`);
    await as(G, 'insert into profiles (id, name) values ($1, $2)', [G, 'Gin']);
    expect(await tagsOf(G)).toBeNull();
    await sup(`insert into public.player_tags (user_id, staff)
      select id, 'dev' from public.profiles where name = 'Gin'
      on conflict (user_id) do update set staff = 'dev', updated_at = now();`);
    expect(await tagsOf(G)).toEqual({ staff: 'dev', tester: null });
    await refused(sup(`update player_tags set staff = 'admin' where user_id = $1`, [G]), /check constraint/);
    await refused(sup(`update player_tags set tester = 'gamma' where user_id = $1`, [G]), /check constraint/);
  });
});
