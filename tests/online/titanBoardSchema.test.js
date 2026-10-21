// The clan titan board (supabase/migrations/20261021000000_titan_board.sql, docs/specs/ASCENSION.md §C.11) on
// a real Postgres (PGlite): every migration applied twice, with and without Supabase's default grants. Lint
// (RLS, no grants, the order guard, the client limiter's numbers), the JS mirror ≡ SQL (game week, Titan of
// the Week, pool HP), and the flows: clan members only, the Titan of the Week only, ≥ 10 s, damage clamped to
// the tier's pool (×1.6 co-op), the best kept, ranks inside the clan, Bronze.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';
import { RULES } from '../../src/online/limits.js';
import { gameWeekNumber } from '../../src/core/reset.js';
import { TITAN_ROTATION, titanPoolHp, stepTier } from '../../src/data/titans.js';
import { titanOfWeek } from '../../src/systems/titans.js';
import { MIGRATIONS_DIR, PGlite, createDb, refused } from './pgHarness.js';

const FILE = '20261021000000_titan_board.sql';
const SQL = readFileSync(join(MIGRATIONS_DIR, FILE), 'utf8');

describe('titan board migration (lint)', () => {
  it('RLS on, no player grants on its table, an order guard first, one transaction', () => {
    expect(SQL).toContain('alter table public.titan_bests enable row level security;');
    expect(SQL).toContain('revoke all on public.titan_bests from anon, authenticated;');
    expect(SQL).not.toMatch(/grant [^;]* on (table )?public\.titan_bests/i);
    expect(SQL.indexOf('Run 20261013000000_social.sql first')).toBeLessThan(SQL.indexOf('create '));
    expect(SQL).toMatch(/^begin;$/m);
    expect(SQL).toMatch(/^commit;$/m);
  });
  it('uses the client limiter\'s numbers', () => {
    const m = SQL.match(/enforce_rate\('titan_best', (\d+), (\d+), interval '1 hour'\)/);
    expect(m).toBeTruthy();
    expect(Number(m[1])).toBe(RULES.titan_best.gapMs);
    expect(Number(m[2])).toBe(RULES.titan_best.max);
    expect(RULES.titan_best.windowMs).toBe(3600e3);
  });
  it('the rotation and the pools are the game\'s', () => {
    expect(SQL).toContain(`array[${TITAN_ROTATION.map((t) => `'${t}'`).join(', ')}]`);
  });
});

const U = (n) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const [A, B, C, D] = [1, 2, 3, 4].map(U);

for (const defaultGrants of [true, false])
describe.skipIf(!PGlite)(`titan board migration (run on Postgres, ${defaultGrants ? 'with' : 'without'} default grants)`, () => {
  let db; let as; let one;
  let week; let titan;
  const sup = (text, params) => db.query(text, params);
  beforeAll(async () => {
    ({ db, as, one } = await createDb({ defaultGrants, users: [[A, 'Aiko'], [B, 'Bea'], [C, 'Cleo'], [D, 'Dara']] }));
    // one clan with A, B, C; D is in no clan
    const clan = (await sup(`insert into clans (name, tag) values ('Petal Squad', 'PS') returning id`)).rows[0].id;
    for (const u of [A, B, C]) await sup('insert into clan_members (user_id, clan_id) values ($1, $2)', [u, clan]);
    week = (await sup('select public.titan_game_week(now()) as w')).rows[0].w;
    titan = (await sup('select public.titan_of_week($1) as t', [week])).rows[0].t;
  }, 120000);

  it('the game week, the Titan of the Week and the pools match the game', async () => {
    expect(week).toBe(gameWeekNumber(Date.now()));
    expect(titan).toBe(titanOfWeek(Date.now()));
    for (const t of TITAN_ROTATION) for (const step of [0, 1, 2, 3, 5]) {
      const { tier, rank } = stepTier(step);
      const sql = Number((await sup('select public.titan_pool($1, $2) as p', [t, step])).rows[0].p);
      expect(Math.abs(sql - titanPoolHp(t, tier, rank)), `${t} step ${step}`).toBeLessThanOrEqual(1);
    }
    expect(await one(A, 'select public.titan_board_version() as r')).toBe(1);
  });

  it('refuses players outside a clan, other titans, short battles and bad steps', async () => {
    const other = TITAN_ROTATION.find((t) => t !== titan);
    await refused(as(D, 'select public.submit_titan_best($1, 0, 1000, 60)', [titan]), /no_clan/);
    await sup(`delete from rate_events where action = 'titan_best'`);
    await refused(as(A, 'select public.submit_titan_best($1, 0, 1000, 60)', [other]), /not_titan_of_week/);
    await sup(`delete from rate_events where action = 'titan_best'`);
    await refused(as(A, 'select public.submit_titan_best($1, 0, 1000, 9)', [titan]), /too_fast/);
    await sup(`delete from rate_events where action = 'titan_best'`);
    await refused(as(A, 'select public.submit_titan_best($1, 40, 1000, 60)', [titan]), /bad_step/);
    await sup(`delete from rate_events where action = 'titan_best'`);
    await refused(as(A, 'select public.submit_titan_best($1, 0, 1000, 60)', [titan]).then(() => as(A, 'select public.submit_titan_best($1, 0, 1000, 60)', [titan])), /rate_limited/);
  });

  it('clamps to the pool (×1.6 in co-op), keeps the best, ranks inside the clan, marks Bronze', async () => {
    await sup('delete from titan_bests');
    const pool = Number((await sup('select public.titan_pool($1, 2) as p', [titan])).rows[0].p);
    const submit = async (u, dmg, coop = false) => {
      await sup(`delete from rate_events where action = 'titan_best'`);
      return one(u, 'select public.submit_titan_best($1, 2, $2, 60, $3) as r', [titan, dmg, coop]);
    };
    const a = await submit(A, pool * 10);
    expect(a.damage).toBe(pool);
    expect(a.bronze).toBe(true);
    await submit(B, Math.round(pool * 0.2));
    const c = await submit(C, Math.round(pool * 3), true);
    expect(c.damage).toBe(Math.round(pool * 1.6));
    expect(c.rank).toBe(1);
    const b = await submit(B, 5); // lower: the best stays
    expect(b.damage).toBe(Math.round(pool * 0.2));
    expect(b.bronze).toBe(false);
    expect(b.rank).toBe(3);
    expect(b.rows.map((r) => r.name)).toEqual(['Cleo', 'Aiko', 'Bea']);
    expect(Number(b.clan.total)).toBe(Math.round(pool * 1.6) + pool + Math.round(pool * 0.2));
    // nobody reads the table directly
    await refused(as(A, 'select * from titan_bests'), /permission denied/);
    // last week: empty, but answers
    const last = await one(A, 'select public.titan_board($1) as r', [week - 1]);
    expect(last.rows).toEqual([]);
  });
});
