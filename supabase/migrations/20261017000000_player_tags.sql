-- Sakura Sentinels — player tags (owner request, 2026-10-15): a DEV chip next to the names of the
-- game's team, an ALPHA chip (and the "Alpha Tester" title) for everyone who played during the
-- alpha, and later a BETA chip for the beta.
--
-- What it does
--   * public.player_tags (user_id, staff, tester): one row per tagged player. Every signed-in
--     player may READ it (tags are public, like names); no player can write it, ever.
--       staff  = 'dev'              set by the owner only, in the SQL editor (docs/ONLINE.md,
--                                   "Player tags"); never by the game
--       tester = 'alpha' | 'beta'   stamped when a profile is created
--   * public.server_settings: a tiny private key / value table (no player can read or write it).
--     tester_phase = 'alpha' (now) | 'beta' | 'none' decides what a NEW profile gets.
--   * a trigger on new profiles: tester = the phase ('alpha' now, 'beta' later, nothing for 'none').
--   * backfill: while the phase is still 'alpha', every existing profile gets tester = 'alpha' (a
--     tag a player already has is kept). Pasted again during the beta it adds nobody.
--   * developers, ONCE: the first time this file runs, every member of the developer clan gets
--     staff = 'dev'. Running it again never adds anyone: the developer list is the owner's to edit
--     (docs/ONLINE.md), never "whoever is in the developer clan today".
--
-- Paste AFTER 20261008000000_online.sql (it needs the profiles and clans tables); the social files
-- are not needed for it. Safe to run more than once. It runs as ONE transaction: on any error (or "The
-- game is busy right now") nothing at all was changed — press Run again. The game needs no update: until this runs
-- nobody has a chip, and afterwards the chips appear the next time a screen shows names.

begin;

-- One quiet moment for every live table this file touches, all locked at once (the new table points at
-- profiles and a trigger goes on it; the first run reads the developer clan): players' requests wait the
-- second this file needs, and no chat line or clan join can hold one of them while waiting for another
-- ("deadlock detected"). If the game stays busy for 30 seconds it stops and nothing was changed — press
-- Run again.
do $$
begin
  for i in 1..600 loop
    begin
      lock table public.profiles, public.clans, public.clan_members in access exclusive mode nowait;
      return;
    exception when lock_not_available then
      perform pg_sleep(0.05);
    end;
  end loop;
  raise exception 'The game is busy right now, so nothing was changed. Press Run again in a minute.';
end $$;

-- ---- private server settings (no policies, no grants: only this file and the owner read it) ----
create table if not exists public.server_settings (
  key text primary key,
  value text not null
);
alter table public.server_settings enable row level security;
revoke all on public.server_settings from public, anon, authenticated;
insert into public.server_settings (key, value) values ('tester_phase', 'alpha') on conflict (key) do nothing;

-- ---- the tags (public to read, like names; nobody writes them from the game) --------------------
create table if not exists public.player_tags (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  staff text check (staff in ('dev')),             -- set by the owner only, in the SQL editor
  tester text check (tester in ('alpha', 'beta')),  -- stamped when the profile is created
  updated_at timestamptz not null default now()
);
alter table public.player_tags enable row level security;
drop policy if exists player_tags_read on public.player_tags;
create policy player_tags_read on public.player_tags for select to authenticated using (true);
-- spelled out (newer projects may not grant new tables by default; the old default granted
-- everything, TRUNCATE included): players may only read
revoke all on public.player_tags from public, anon, authenticated;
grant select on public.player_tags to authenticated;

-- ---- a new profile gets the phase's tester tag ---------------------------------------------------
create or replace function public.player_tags_stamp() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_phase text := (select value from public.server_settings where key = 'tester_phase');
begin
  if v_phase in ('alpha', 'beta') then
    insert into public.player_tags (user_id, tester) values (new.id, v_phase) on conflict (user_id) do nothing;
  end if;
  return null;
end $$;
revoke all on function public.player_tags_stamp() from public, anon, authenticated;
drop trigger if exists profiles_player_tags on public.profiles;
create trigger profiles_player_tags after insert on public.profiles
  for each row execute function public.player_tags_stamp();

-- ---- backfill: everyone who made a profile so far played during the alpha -----------------------
-- (only while the phase is still 'alpha': pasting this again during the beta makes nobody an alpha
-- tester; a tag a player already has is kept)
insert into public.player_tags (user_id, tester)
select p.id, 'alpha' from public.profiles p
where exists (select 1 from public.server_settings s where s.key = 'tester_phase' and s.value = 'alpha')
on conflict (user_id) do update set tester = 'alpha', updated_at = now()
  where public.player_tags.tester is null;

-- ---- developers: the developer clan's members, on the FIRST paste only -------------------------
-- The marker row makes this run once. Later, the owner adds or removes a developer by name
-- (docs/ONLINE.md, "Player tags"); joining the developer clan never makes anyone a developer.
do $$
declare
  n int;
begin
  insert into public.server_settings (key, value) values ('dev_tags_seeded', to_char(now(), 'YYYY-MM-DD'))
  on conflict (key) do nothing;
  get diagnostics n = row_count;
  if n = 1 then
    insert into public.player_tags (user_id, staff)
    select m.user_id, 'dev' from public.clan_members m join public.clans c on c.id = m.clan_id
    where c.is_dev
    on conflict (user_id) do update set staff = 'dev', updated_at = now();
  end if;
end $$;

-- PostgREST picks up the new table at once
notify pgrst, 'reload schema';

commit;
