-- Sakura Sentinels — online backend for Supabase (the free plan is enough).
--
-- This is a Supabase CLI migration. With Supabase's GitHub integration connected to the repo
-- it is applied automatically when it reaches main. Without the integration, paste the whole
-- file into Supabase → SQL Editor → Run once; every statement is idempotent, so running it
-- again is harmless. See docs/ONLINE.md for the 5-minute setup.
--
-- What it creates
--   tables     profiles, clans, clan_codes, clan_members, clan_requests, messages,
--              clan_boss, clan_boss_hits, clan_boss_claims, transfer_codes, rate_events
--   security   Row Level Security on every table. Players read what they may see and write
--              only their own profile and chat messages; every other change goes through the
--              SECURITY DEFINER functions below, which check the caller (auth.uid()) and role.
--   limits     enforce_rate(): server-side rate limits (same numbers as src/online/limits.js)
--                chat message        1 per 2 s, 20 per minute   (trigger on messages)
--                create clan         1 per 10 min, 3 per day
--                join/request/leave  10 per hour
--                clan boss attempt   3 per day (rolling 24 h)
--                transfer code       5 per hour
--   realtime   messages, clan_members and clan_boss are published for live updates.
--              Co-op rooms use Realtime broadcast + presence channels 'coop:<CODE>' (no table).
--   seed       the developer clan "Sakura Dev Lab" [DEV], join code Rosie777.
-- No profanity filter (not wanted for now). No keys or secrets live in this file: the game
-- only ever uses the project's public anon key, and these policies are what protect the data.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default 'Sensei' check (char_length(name) between 2 and 16 and name !~ '[<>]'),
  level int not null default 1 check (level between 1 and 999),
  avatar text not null default 'hikari' check (char_length(avatar) <= 32),
  last_active timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.clans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 20),
  tag text not null check (tag ~ '^[A-Z0-9]{2,4}$'),
  emblem text not null default 'assault' check (char_length(emblem) <= 24),
  join_mode text not null default 'open' check (join_mode in ('open', 'request', 'code')),
  description text not null default '' check (char_length(description) <= 140),
  leader_id uuid references public.profiles (id) on delete set null,
  xp bigint not null default 0,
  max_members int not null default 30,
  is_dev boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists clans_name_lower on public.clans (lower(name));

-- invite / developer codes live apart from clans so browsing never reveals them
create table if not exists public.clan_codes (
  clan_id uuid primary key references public.clans (id) on delete cascade,
  code text not null
);
create unique index if not exists clan_codes_code_lower on public.clan_codes (lower(code));

create table if not exists public.clan_members (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  clan_id uuid not null references public.clans (id) on delete cascade,
  role text not null default 'member' check (role in ('leader', 'officer', 'member')),
  joined_at timestamptz not null default now()
);
create index if not exists clan_members_clan on public.clan_members (clan_id);

create table if not exists public.clan_requests (
  clan_id uuid not null references public.clans (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (clan_id, user_id)
);

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  channel text not null check (channel = 'global' or channel ~ '^clan:[0-9a-f-]{36}$'),
  user_id uuid references public.profiles (id) on delete set null,
  name text not null default '',
  level int not null default 1,
  avatar text,
  body text not null check (char_length(body) between 1 and 200),
  kind text not null default 'text' check (kind in ('text', 'invite', 'system')),
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists messages_channel_time on public.messages (channel, created_at desc);

create table if not exists public.clan_boss (
  clan_id uuid not null references public.clans (id) on delete cascade,
  week text not null,
  boss_id text not null,
  max_hp bigint not null,
  hp bigint not null,
  primary key (clan_id, week)
);

create table if not exists public.clan_boss_hits (
  id bigint generated always as identity primary key,
  clan_id uuid not null references public.clans (id) on delete cascade,
  week text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  damage bigint not null check (damage >= 0),
  created_at timestamptz not null default now()
);
create index if not exists clan_boss_hits_week on public.clan_boss_hits (clan_id, week);

create table if not exists public.clan_boss_claims (
  clan_id uuid not null references public.clans (id) on delete cascade,
  week text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  tier text not null,
  created_at timestamptz not null default now(),
  primary key (clan_id, week, user_id)
);

create table if not exists public.transfer_codes (
  code text primary key,
  payload text not null check (char_length(payload) <= 307200),
  created_by uuid references public.profiles (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid
);

create table if not exists public.rate_events (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  action text not null,
  at timestamptz not null default now()
);
create index if not exists rate_events_lookup on public.rate_events (user_id, action, at desc);

-- ---------------------------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.clans enable row level security;
alter table public.clan_codes enable row level security;
alter table public.clan_members enable row level security;
alter table public.clan_requests enable row level security;
alter table public.messages enable row level security;
alter table public.clan_boss enable row level security;
alter table public.clan_boss_hits enable row level security;
alter table public.clan_boss_claims enable row level security;
alter table public.transfer_codes enable row level security;
alter table public.rate_events enable row level security;

create or replace function public.my_clan() returns uuid
language sql stable security definer set search_path = public as $$
  select clan_id from clan_members where user_id = auth.uid()
$$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from clan_members where user_id = auth.uid()
$$;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- the developer clan is invisible to browsing; its members see it
drop policy if exists clans_read on public.clans;
create policy clans_read on public.clans for select to authenticated using (not is_dev or id = public.my_clan());

-- codes: only leaders/officers of that clan (normal clans; the dev code is never readable)
drop policy if exists clan_codes_read on public.clan_codes;
create policy clan_codes_read on public.clan_codes for select to authenticated
  using (clan_id = public.my_clan() and public.my_role() in ('leader', 'officer'));

drop policy if exists clan_members_read on public.clan_members;
create policy clan_members_read on public.clan_members for select to authenticated using (true);

drop policy if exists clan_requests_read on public.clan_requests;
create policy clan_requests_read on public.clan_requests for select to authenticated
  using (user_id = auth.uid() or (clan_id = public.my_clan() and public.my_role() in ('leader', 'officer')));

drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select to authenticated
  using (channel = 'global' or channel = 'clan:' || public.my_clan()::text);
drop policy if exists messages_insert_own on public.messages;
create policy messages_insert_own on public.messages for insert to authenticated
  with check (
    user_id = auth.uid()
    and kind in ('text', 'invite')
    and (channel = 'global' or channel = 'clan:' || public.my_clan()::text)
  );
-- no update / delete policies: chat history is append-only

drop policy if exists clan_boss_read on public.clan_boss;
create policy clan_boss_read on public.clan_boss for select to authenticated using (clan_id = public.my_clan());
drop policy if exists clan_boss_hits_read on public.clan_boss_hits;
create policy clan_boss_hits_read on public.clan_boss_hits for select to authenticated using (clan_id = public.my_clan());
drop policy if exists clan_boss_claims_read on public.clan_boss_claims;
create policy clan_boss_claims_read on public.clan_boss_claims for select to authenticated using (user_id = auth.uid());
-- transfer_codes and rate_events: no policies at all (only the functions below touch them)

-- ---------------------------------------------------------------------------------------------
-- Rate limiting
-- ---------------------------------------------------------------------------------------------

-- Raises 'rate_limited:<retry ms>' (the client shows "Slow down, 1.4 s") or records the hit.
create or replace function public.enforce_rate(p_action text, p_gap_ms int, p_max int, p_window interval)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_last timestamptz;
  v_nth timestamptz;
  v_retry numeric := 0;
begin
  if v_uid is null then raise exception 'forbidden: sign in first'; end if;
  perform pg_advisory_xact_lock(hashtext(v_uid::text || ':' || p_action));
  select max(at) into v_last from rate_events where user_id = v_uid and action = p_action;
  if v_last is not null and p_gap_ms > 0 and now() - v_last < make_interval(secs => p_gap_ms / 1000.0) then
    v_retry := greatest(v_retry, p_gap_ms - extract(epoch from (now() - v_last)) * 1000);
  end if;
  select at into v_nth from rate_events
    where user_id = v_uid and action = p_action and at > now() - p_window
    order by at desc offset p_max - 1 limit 1;
  if v_nth is not null then
    v_retry := greatest(v_retry, extract(epoch from (v_nth + p_window - now())) * 1000);
  end if;
  if v_retry > 0 then raise exception 'rate_limited:%', ceil(v_retry)::bigint; end if;
  insert into rate_events (user_id, action) values (v_uid, p_action);
  if random() < 0.01 then delete from rate_events where at < now() - interval '25 hours'; end if;
end $$;

-- Chat: rate limit, stamp the author's current name/level/avatar, clan XP, history trim.
create or replace function public.messages_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p profiles%rowtype;
begin
  if coalesce(current_setting('ss.system', true), '') = '1' then
    return new; -- system notices written by the functions below
  end if;
  if new.user_id is distinct from auth.uid() then raise exception 'forbidden: post as yourself'; end if;
  perform enforce_rate('chat', 2000, 20, interval '1 minute');
  select * into p from profiles where id = auth.uid();
  if not found then raise exception 'forbidden: create a profile first'; end if;
  new.name := p.name;
  new.level := p.level;
  new.avatar := p.avatar;
  new.created_at := now();
  update profiles set last_active = now() where id = auth.uid();
  if new.channel like 'clan:%' then
    update clans set xp = xp + 2 where id = substring(new.channel from 6)::uuid;
  end if;
  if random() < 0.01 then delete from messages where created_at < now() - interval '14 days'; end if;
  return new;
end $$;

drop trigger if exists messages_rate_limit on public.messages;
create trigger messages_rate_limit before insert on public.messages
  for each row execute function public.messages_before_insert();

create or replace function public.system_message(p_channel text, p_body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('ss.system', '1', true);
  insert into messages (channel, user_id, name, level, body, kind) values (p_channel, null, 'System', 0, left(p_body, 200), 'system');
  perform set_config('ss.system', '', true);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Clans
-- ---------------------------------------------------------------------------------------------

create or replace function public.clan_level(p_xp bigint) returns int
language plpgsql immutable as $$
declare
  v_level int := 1;
  v_rest bigint := greatest(p_xp, 0);
begin
  while v_level < 20 and v_rest >= 500 * v_level loop
    v_rest := v_rest - 500 * v_level;
    v_level := v_level + 1;
  end loop;
  return v_level;
end $$;

create or replace function public.add_member(p_user uuid, p_clan uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare
  c clans%rowtype;
  v_count int;
begin
  select * into c from clans where id = p_clan for update;
  if not found then raise exception 'not_found: that clan does not exist'; end if;
  select count(*) into v_count from clan_members where clan_id = p_clan;
  if v_count >= c.max_members then raise exception 'full'; end if;
  insert into clan_members (user_id, clan_id, role) values (p_user, p_clan, p_role);
  delete from clan_requests where user_id = p_user;
  update clans set xp = xp + 20, leader_id = coalesce(leader_id, case when is_dev then null else p_user end) where id = p_clan;
  perform system_message('clan:' || p_clan::text, coalesce((select name from profiles where id = p_user), 'A sensei') || ' joined the clan.');
end $$;

create or replace function public.create_clan(p_name text, p_tag text, p_emblem text, p_join_mode text, p_description text)
returns public.clans language plpgsql security definer set search_path = public as $$
declare
  c clans%rowtype;
begin
  if auth.uid() is null then raise exception 'forbidden: sign in first'; end if;
  if exists (select 1 from clan_members where user_id = auth.uid()) then raise exception 'already_member'; end if;
  perform enforce_rate('clan_create', 600000, 3, interval '1 day');
  insert into clans (name, tag, emblem, join_mode, description, leader_id)
    values (trim(p_name), upper(trim(p_tag)), coalesce(p_emblem, 'assault'),
            case when p_join_mode in ('open', 'request', 'code') then p_join_mode else 'open' end,
            left(coalesce(p_description, ''), 140), auth.uid())
    returning * into c;
  if c.join_mode = 'code' then
    insert into clan_codes (clan_id, code) values (c.id, upper(substr(md5(random()::text || c.id::text), 1, 6)));
  end if;
  perform add_member(auth.uid(), c.id, 'leader');
  select * into c from clans where id = c.id;
  return c;
end $$;

create or replace function public.join_clan(p_clan uuid) returns public.clans
language plpgsql security definer set search_path = public as $$
declare
  c clans%rowtype;
begin
  if auth.uid() is null then raise exception 'forbidden: sign in first'; end if;
  if exists (select 1 from clan_members where user_id = auth.uid()) then raise exception 'already_member'; end if;
  select * into c from clans where id = p_clan and not is_dev;
  if not found then raise exception 'not_found: that clan does not exist'; end if;
  if c.join_mode <> 'open' then raise exception 'forbidden: this clan takes requests or codes'; end if;
  perform enforce_rate('clan_join', 0, 10, interval '1 hour');
  perform add_member(auth.uid(), c.id, 'member');
  select * into c from clans where id = p_clan;
  return c;
end $$;

create or replace function public.join_clan_by_code(p_code text) returns public.clans
language plpgsql security definer set search_path = public as $$
declare
  c clans%rowtype;
begin
  if auth.uid() is null then raise exception 'forbidden: sign in first'; end if;
  if exists (select 1 from clan_members where user_id = auth.uid()) then raise exception 'already_member'; end if;
  select clans.* into c from clan_codes join clans on clans.id = clan_codes.clan_id where lower(clan_codes.code) = lower(trim(p_code));
  if not found then raise exception 'not_found: no clan uses that code'; end if;
  perform enforce_rate('clan_join', 0, 10, interval '1 hour');
  perform add_member(auth.uid(), c.id, 'member');
  select * into c from clans where id = c.id;
  return c;
end $$;

create or replace function public.request_join(p_clan uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  c clans%rowtype;
begin
  if auth.uid() is null then raise exception 'forbidden: sign in first'; end if;
  if exists (select 1 from clan_members where user_id = auth.uid()) then raise exception 'already_member'; end if;
  select * into c from clans where id = p_clan and not is_dev;
  if not found then raise exception 'not_found: that clan does not exist'; end if;
  if c.join_mode = 'open' then raise exception 'invalid: this clan is open, just join'; end if;
  perform enforce_rate('clan_join', 0, 10, interval '1 hour');
  insert into clan_requests (clan_id, user_id) values (p_clan, auth.uid()) on conflict do nothing;
end $$;

create or replace function public.answer_request(p_clan uuid, p_user uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_clan() is distinct from p_clan or public.my_role() not in ('leader', 'officer') then raise exception 'forbidden'; end if;
  delete from clan_requests where clan_id = p_clan and user_id = p_user;
  if not found then raise exception 'not_found: that request is gone'; end if;
  if p_accept then
    if exists (select 1 from clan_members where user_id = p_user) then raise exception 'already_member: they joined another clan'; end if;
    perform add_member(p_user, p_clan, 'member');
  end if;
end $$;

create or replace function public.leave_clan() returns void
language plpgsql security definer set search_path = public as $$
declare
  m clan_members%rowtype;
  c clans%rowtype;
  v_next clan_members%rowtype;
  v_name text := coalesce((select name from profiles where id = auth.uid()), 'A sensei');
begin
  select * into m from clan_members where user_id = auth.uid();
  if not found then raise exception 'not_member'; end if;
  perform enforce_rate('clan_join', 0, 10, interval '1 hour');
  select * into c from clans where id = m.clan_id for update;
  delete from clan_members where user_id = auth.uid();
  if c.is_dev then
    return;
  end if;
  select * into v_next from clan_members where clan_id = c.id
    order by case role when 'leader' then 0 when 'officer' then 1 else 2 end, joined_at limit 1;
  if not found then
    delete from clans where id = c.id;
    return;
  end if;
  if c.leader_id = auth.uid() then
    update clan_members set role = 'leader' where user_id = v_next.user_id;
    update clans set leader_id = v_next.user_id where id = c.id;
    perform system_message('clan:' || c.id::text, coalesce((select name from profiles where id = v_next.user_id), 'A member') || ' is the new leader.');
  end if;
  perform system_message('clan:' || c.id::text, v_name || ' left the clan.');
end $$;

create or replace function public.set_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_clan uuid := public.my_clan();
begin
  if public.my_role() is distinct from 'leader' or p_user = auth.uid() or p_role not in ('leader', 'officer', 'member') then raise exception 'forbidden'; end if;
  if not exists (select 1 from clan_members where user_id = p_user and clan_id = v_clan) then raise exception 'not_member: they are not in your clan'; end if;
  if p_role = 'leader' then
    update clan_members set role = 'officer' where user_id = auth.uid();
    update clans set leader_id = p_user where id = v_clan;
  end if;
  update clan_members set role = p_role where user_id = p_user;
  perform system_message('clan:' || v_clan::text, coalesce((select name from profiles where id = p_user), 'A member') || ' is now ' || p_role || '.');
end $$;

create or replace function public.kick(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_clan uuid := public.my_clan();
  v_me text := public.my_role();
  v_target text;
begin
  select role into v_target from clan_members where user_id = p_user and clan_id = v_clan;
  if not found then raise exception 'not_member: they are not in your clan'; end if;
  if p_user = auth.uid()
     or not ((v_me = 'leader' and v_target <> 'leader') or (v_me = 'officer' and v_target = 'member')) then
    raise exception 'forbidden';
  end if;
  delete from clan_members where user_id = p_user;
  perform system_message('clan:' || v_clan::text, coalesce((select name from profiles where id = p_user), 'A member') || ' was removed from the clan.');
end $$;

create or replace function public.touch_active() returns void
language sql security definer set search_path = public as $$
  update profiles set last_active = now() where id = auth.uid()
$$;

-- ---------------------------------------------------------------------------------------------
-- Weekly clan boss (async co-op: every member's battle damage drains one shared HP pool)
-- ---------------------------------------------------------------------------------------------

create or replace function public.current_week() returns text
language sql stable as $$ select to_char(now() at time zone 'utc', 'IYYY-"W"IW') $$;

create or replace function public.ensure_boss(p_clan uuid, p_week text) returns public.clan_boss
language plpgsql security definer set search_path = public as $$
declare
  b clan_boss%rowtype;
  v_hp bigint;
begin
  select * into b from clan_boss where clan_id = p_clan and week = p_week;
  if found then return b; end if;
  -- 300000 HP for a level-1 clan, +20% per clan level (src/online/clanRules.js bossMaxHp)
  select round(300000 * (1 + 0.2 * (clan_level(xp) - 1))) into v_hp from clans where id = p_clan;
  insert into clan_boss (clan_id, week, boss_id, max_hp, hp)
    values (p_clan, p_week, (array['lych', 'colossus', 'ashwing'])[(split_part(p_week, '-W', 2)::int % 3) + 1], v_hp, v_hp)
    on conflict do nothing;
  select * into b from clan_boss where clan_id = p_clan and week = p_week;
  return b;
end $$;

-- My rank and damage on one week's boss (null when I did not hit it).
create or replace function public.boss_standing(p_clan uuid, p_week text)
returns table (rank bigint, damage numeric) language sql stable security definer set search_path = public as $$
  select r.rank, r.damage from (
    select user_id, sum(damage) as damage, rank() over (order by sum(damage) desc, user_id) as rank
    from clan_boss_hits where clan_id = p_clan and week = p_week group by user_id
  ) r where r.user_id = auth.uid()
$$;

create or replace function public.boss_state(p_clan uuid) returns json
language plpgsql security definer set search_path = public as $$
declare
  b clan_boss%rowtype;
  pb clan_boss%rowtype;
  v_week text := current_week();
  v_prev text := to_char((now() - interval '7 days') at time zone 'utc', 'IYYY-"W"IW');
  v_rank bigint;
  v_damage numeric;
begin
  if public.my_clan() is distinct from p_clan then raise exception 'not_member'; end if;
  b := ensure_boss(p_clan, v_week);
  select * into pb from clan_boss where clan_id = p_clan and week = v_prev;
  select s.rank, s.damage into v_rank, v_damage from boss_standing(p_clan, v_prev) s;
  return json_build_object(
    'clanId', b.clan_id, 'week', b.week, 'bossId', b.boss_id, 'maxHp', b.max_hp, 'hp', b.hp, 'defeated', b.hp <= 0,
    'board', coalesce((
      select json_agg(r order by r.damage desc, r."userId") from (
        select h.user_id as "userId", p.name, sum(h.damage) as damage, count(*) as hits
        from clan_boss_hits h join profiles p on p.id = h.user_id
        where h.clan_id = p_clan and h.week = v_week group by h.user_id, p.name
      ) r), '[]'::json),
    -- attempts count over a rolling 24 h, exactly like the boss_hit rate limit
    'myHitsToday', (select count(*) from clan_boss_hits where clan_id = p_clan and user_id = auth.uid()
                     and created_at > now() - interval '1 day'),
    'claimed', exists (select 1 from clan_boss_claims where clan_id = p_clan and week = v_week and user_id = auth.uid()),
    -- last week's standing: its reward stays claimable during the following week
    'prev', case when pb.clan_id is null or v_damage is null then null else json_build_object(
      'week', v_prev, 'defeated', pb.hp <= 0, 'damage', v_damage, 'rank', v_rank,
      'claimed', exists (select 1 from clan_boss_claims where clan_id = p_clan and week = v_prev and user_id = auth.uid())) end
  );
end $$;

create or replace function public.submit_boss_damage(p_damage bigint) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_clan uuid := public.my_clan();
  v_week text := current_week();
  v_dmg bigint := least(greatest(coalesce(p_damage, 0), 0), 200000); -- cap per attempt (BOSS_HIT_CAP)
  b clan_boss%rowtype;
begin
  if v_clan is null then raise exception 'not_member'; end if;
  b := ensure_boss(v_clan, v_week);
  if b.hp <= 0 then raise exception 'invalid: this week''s boss has already fallen'; end if;
  perform enforce_rate('boss_hit', 0, 3, interval '1 day');
  update clan_boss set hp = greatest(0, hp - v_dmg) where clan_id = v_clan and week = v_week;
  insert into clan_boss_hits (clan_id, week, user_id, damage) values (v_clan, v_week, auth.uid(), v_dmg);
  update clans set xp = xp + least(500, 50 + v_dmg / 2000) where id = v_clan;
  return boss_state(v_clan);
end $$;

create or replace function public.claim_boss_reward(p_week text) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_clan uuid := public.my_clan();
  b clan_boss%rowtype;
  v_rank bigint;
  v_damage numeric;
  v_tier text;
begin
  if v_clan is null then raise exception 'not_member'; end if;
  select * into b from clan_boss where clan_id = v_clan and week = p_week;
  if not found then raise exception 'not_found: no boss that week'; end if;
  if b.hp > 0 and p_week = current_week() then raise exception 'forbidden: rewards open when the boss falls or the week ends'; end if;
  select s.rank, s.damage into v_rank, v_damage from boss_standing(v_clan, p_week) s;
  if v_damage is null or v_damage <= 0 then raise exception 'forbidden: hit the boss first to earn a reward'; end if;
  -- same tiers as src/online/clanRules.js rewardTier()
  v_tier := case when b.hp > 0 then 'C' when v_rank = 1 then 'S' when v_rank <= 3 then 'A' else 'B' end;
  insert into clan_boss_claims (clan_id, week, user_id, tier) values (v_clan, p_week, auth.uid(), v_tier)
    on conflict do nothing;
  if not found then raise exception 'forbidden: already claimed'; end if;
  return json_build_object('tier', v_tier);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Transfer codes (one-time, 24 h): move a save between devices
-- ---------------------------------------------------------------------------------------------

create or replace function public.create_transfer(p_payload text) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_exp timestamptz := now() + interval '24 hours';
begin
  if auth.uid() is null then raise exception 'forbidden: sign in first'; end if;
  if p_payload is null or char_length(p_payload) = 0 or char_length(p_payload) > 307200 then raise exception 'invalid: that save is too large'; end if;
  perform enforce_rate('transfer', 0, 5, interval '1 hour');
  loop
    v_code := upper(substr(md5(random()::text), 1, 4) || '-' || substr(md5(random()::text), 1, 4));
    exit when not exists (select 1 from transfer_codes where code = v_code);
  end loop;
  insert into transfer_codes (code, payload, created_by, expires_at) values (v_code, p_payload, auth.uid(), v_exp);
  delete from transfer_codes where expires_at < now() - interval '1 day';
  return json_build_object('code', v_code, 'expiresAt', v_exp);
end $$;

create or replace function public.redeem_transfer(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare
  t transfer_codes%rowtype;
begin
  if auth.uid() is null then raise exception 'forbidden: sign in first'; end if;
  perform enforce_rate('transfer', 0, 5, interval '1 hour');
  select * into t from transfer_codes where code = upper(trim(p_code)) for update;
  if not found then raise exception 'not_found: unknown transfer code'; end if;
  if t.used_at is not null or t.expires_at < now() then raise exception 'expired'; end if;
  update transfer_codes set used_at = now(), used_by = auth.uid() where code = t.code;
  return t.payload;
end $$;

-- Only signed-in players (anonymous accounts included) may call the game's functions, and only
-- the entry points below: helpers such as add_member / enforce_rate / system_message stay internal.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.create_clan(text, text, text, text, text), public.join_clan(uuid), public.join_clan_by_code(text),
  public.request_join(uuid), public.answer_request(uuid, uuid, boolean), public.leave_clan(),
  public.set_role(uuid, text), public.kick(uuid), public.touch_active(), public.boss_state(uuid),
  public.submit_boss_damage(bigint), public.claim_boss_reward(text), public.create_transfer(text),
  public.redeem_transfer(text), public.my_clan(), public.my_role(), public.clan_level(bigint), public.current_week()
  to authenticated;
-- (boss_standing, ensure_boss, add_member, enforce_rate, system_message stay internal)

-- ---------------------------------------------------------------------------------------------
-- Realtime + seed
-- ---------------------------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['messages', 'clan_members', 'clan_boss'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Developer clan (owner request): join with code Rosie777 → the Supply Bot sandbox in the game.
insert into public.clans (id, name, tag, emblem, join_mode, description, max_members, is_dev)
values ('00000000-0000-4000-8000-000000000777', 'Sakura Dev Lab', 'DEV', 'wiki', 'code',
        'Developer sandbox. The Supply Bot here grants any item — for testing only.', 500, true)
on conflict (id) do nothing;
insert into public.clan_codes (clan_id, code) values ('00000000-0000-4000-8000-000000000777', 'Rosie777')
on conflict (clan_id) do nothing;
