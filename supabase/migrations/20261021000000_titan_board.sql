-- Sakura Sentinels — the CLAN TITAN BOARD (Titan Trials, docs/specs/ASCENSION.md §C.11; owner answer 9:
-- "co-op weekly bosses, bonus chest for playing together, clan damage leaderboard").
--
-- HOW TO RUN IT (owner): AFTER 20261013000000_social.sql (it needs the game clock).
-- Open this file on GitHub → Raw → select all → copy; Supabase → SQL Editor → New query → paste → Run.
-- Safe to run more than once. Check afterwards: `select public.titan_board_version();` → 1.
-- It runs as ONE transaction: on any error nothing at all was changed — press Run again.
--
-- The game's frontend deploys BEFORE this runs: until then the Titan Trials "Board" tab says "Needs the
-- latest server update"; everything else keeps working.
--
-- What it creates
--   table      titan_bests: each player's best damage on the Titan of the Week, one row per player per
--              game week (the clan they were in when they last scored). RLS on, NO grants: only the
--              functions below read or write it.
--   week       the game week (Sunday 7 PM America/Chicago, src/core/reset.js gameWeekNumber):
--              titan_game_week(t) = floor((days since 1970-01-01 of game_day_key(t) + 3) / 7), and the
--              Titan of the Week rotates Foundry Titan → Gloom Regent → Hyakki Daimyo → Eclipse Wyrm
--              (src/data/titans.js TITAN_ROTATION).
--   submit     submit_titan_best(titan, step, damage, seconds, coop): only the Titan of the Week, only a
--              clan member, at least 10 seconds of battle; damage is clamped to that tier's pool HP
--              (×1.6 in co-op; src/data/titans.js titanPoolHp: steps 0–3 = Normal, Hard, Nightmare,
--              Mayhem, step 3 + n = Mayhem +n, ×1.3 per rank). Keeps the best. Rate limit: 1 per 2 s,
--              30 an hour (src/online/limits.js RULES.titan_best).
--   board      titan_board(week): your clan's rows for that week (your clan now), the clan total and
--              your rank. The rewards come from the game's own table after it reads your rank
--              (src/online/titanBoardRules.js): #1 30 Assault Tokens, #2 20, #3 10, everyone with a
--              Bronze 5 — like the clan boss.
--   retention  rows older than 8 game weeks are deleted as new rows arrive (no cron).

begin;

-- =============================================================================================
-- 0. Order guard: the first migration (profiles, clans, rate limits) and the social file (game clock)
-- =============================================================================================
do $$
begin
  if to_regclass('public.clan_members') is null or to_regprocedure('public.enforce_rate(text,integer,integer,interval)') is null
     or to_regprocedure('public.game_day_key(timestamptz)') is null then
    raise exception 'Run 20261013000000_social.sql first: this file needs its game clock and the first migration''s clans';
  end if;
end $$;

-- the new table points at clans and profiles: take both at once (a busy game waits; 30 s at most)
do $$
begin
  for i in 1..600 loop
    begin
      lock table public.clans, public.profiles in access exclusive mode nowait;
      return;
    exception when lock_not_available then
      perform pg_sleep(0.05);
    end;
  end loop;
  raise exception 'The game is busy right now, so nothing was changed. Press Run again in a minute.';
end $$;

-- =============================================================================================
-- 1. Table
-- =============================================================================================

create table if not exists public.titan_bests (
  user_id uuid not null references public.profiles (id) on delete cascade,
  week int not null,
  clan_id uuid not null references public.clans (id) on delete cascade,
  titan text not null check (titan in ('foundry', 'regent', 'daimyo', 'wyrm')),
  step int not null check (step between 0 and 33),
  damage bigint not null check (damage >= 0),
  bronze boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, week)
);
create index if not exists titan_bests_clan_week on public.titan_bests (clan_id, week, damage desc);

alter table public.titan_bests enable row level security;
revoke all on public.titan_bests from anon, authenticated;

-- =============================================================================================
-- 2. Helpers (the game's own numbers; src/online/titanBoardRules.js mirrors them)
-- =============================================================================================

create or replace function public.titan_board_version() returns int language sql immutable as $$ select 1 $$;

create or replace function public.titan_game_week(p_at timestamptz) returns int
language sql stable as $$ select floor(((public.game_day_key(p_at)::date - date '1970-01-01') + 3) / 7.0)::int $$;

create or replace function public.titan_of_week(p_week int) returns text
language sql immutable as $$ select (array['foundry', 'regent', 'daimyo', 'wyrm'])[(((p_week % 4) + 4) % 4) + 1] $$;

-- solo pool HP of a titan at a ladder step (0 Normal · 1 Hard · 2 Nightmare · 3 Mayhem · 3 + n Mayhem +n)
create or replace function public.titan_pool(p_titan text, p_step int) returns bigint
language sql immutable as $$
  select round(base * power(1.3, greatest(0, p_step - 3)))::bigint from (
    select case p_titan
      when 'foundry' then (array[800000, 18000000, 48000000, 100000000])[least(p_step, 3) + 1]
      when 'regent' then (array[600000, 14000000, 38000000, 82000000])[least(p_step, 3) + 1]
      when 'daimyo' then (array[900000, 20000000, 54000000, 115000000])[least(p_step, 3) + 1]
      when 'wyrm' then (array[1200000, 25000000, 66000000, 135000000])[least(p_step, 3) + 1]
    end::numeric as base
  ) b
$$;

-- =============================================================================================
-- 3. Entry points
-- =============================================================================================

create or replace function public.titan_board(p_week int default null) returns json
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := auth.uid();
  v_week int := coalesce(p_week, public.titan_game_week(now()));
  v_clan uuid;
  v_rows json;
  v_total bigint;
  v_rank int;
  v_mine public.titan_bests%rowtype;
begin
  if v_me is null then raise exception 'not_signed_in'; end if;
  select clan_id into v_clan from clan_members where user_id = v_me;
  select * into v_mine from titan_bests where user_id = v_me and week = v_week;
  -- a past week ranks you inside the clan you scored with; this week inside your clan now
  if p_week is not null and v_mine.user_id is not null then v_clan := v_mine.clan_id; end if;
  if v_clan is null then
    return json_build_object('week', v_week, 'titan', public.titan_of_week(v_week), 'clan', null, 'rows', '[]'::json, 'rank', null, 'damage', 0, 'bronze', false);
  end if;
  select coalesce(json_agg(json_build_object('name', coalesce(p.name, '?'), 'damage', t.damage, 'step', t.step, 'me', t.user_id = v_me) order by t.damage desc, t.updated_at), '[]'::json),
         coalesce(sum(t.damage), 0)
    into v_rows, v_total
    from titan_bests t left join profiles p on p.id = t.user_id
   where t.clan_id = v_clan and t.week = v_week;
  if v_mine.user_id is not null and v_mine.clan_id = v_clan then
    select 1 + count(*) into v_rank from titan_bests t
     where t.clan_id = v_clan and t.week = v_week and (t.damage > v_mine.damage or (t.damage = v_mine.damage and t.updated_at < v_mine.updated_at));
  end if;
  return json_build_object('week', v_week, 'titan', public.titan_of_week(v_week), 'clan', json_build_object('id', v_clan, 'total', v_total),
    'rows', v_rows, 'rank', v_rank, 'damage', coalesce(v_mine.damage, 0), 'bronze', coalesce(v_mine.bronze, false));
end $$;

create or replace function public.submit_titan_best(p_titan text, p_step int, p_damage bigint, p_seconds int, p_coop boolean default false) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := auth.uid();
  v_week int := public.titan_game_week(now());
  v_clan uuid;
  v_pool bigint;
  v_dmg bigint;
begin
  if v_me is null then raise exception 'not_signed_in'; end if;
  perform enforce_rate('titan_best', 2000, 30, interval '1 hour');
  if p_titan is distinct from public.titan_of_week(v_week) then raise exception 'not_titan_of_week'; end if;
  if p_step is null or p_step < 0 or p_step > 33 then raise exception 'bad_step'; end if;
  if p_seconds is null or p_seconds < 10 then raise exception 'too_fast'; end if;
  select clan_id into v_clan from clan_members where user_id = v_me;
  if v_clan is null then raise exception 'no_clan'; end if;
  v_pool := public.titan_pool(p_titan, p_step);
  if coalesce(p_coop, false) then v_pool := round(v_pool * 1.6); end if;
  v_dmg := least(greatest(coalesce(p_damage, 0), 0), v_pool);
  insert into titan_bests (user_id, week, clan_id, titan, step, damage, bronze, updated_at)
  values (v_me, v_week, v_clan, p_titan, p_step, v_dmg, v_dmg * 4 >= v_pool, now())
  -- the best score stays (and follows the player to the clan they are in now: one row a week)
  on conflict (user_id, week) do update
    set damage = greatest(titan_bests.damage, excluded.damage),
        step = case when excluded.damage > titan_bests.damage then excluded.step else titan_bests.step end,
        clan_id = excluded.clan_id, bronze = titan_bests.bronze or excluded.bronze,
        updated_at = case when excluded.damage > titan_bests.damage then now() else titan_bests.updated_at end;
  delete from titan_bests where week < v_week - 8;
  return public.titan_board(null);
end $$;

-- =============================================================================================
-- 4. Function privileges: revoke everything this file creates, then grant only the entry points
-- =============================================================================================

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (array['titan_board_version', 'titan_game_week', 'titan_of_week', 'titan_pool', 'titan_board', 'submit_titan_best'])
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

grant execute on function
  public.titan_board_version(), public.titan_board(int), public.submit_titan_best(text, int, bigint, int, boolean)
  to authenticated;

commit;

-- PostgREST picks up the new functions at once
notify pgrst, 'reload schema';
