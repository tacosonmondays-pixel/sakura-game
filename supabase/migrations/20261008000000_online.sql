-- Sakura Sentinels — online backend for Supabase (the free plan is enough).
--
-- THIS FILE IS THE WHOLE DATABASE SCHEMA (the brief's "schema.sql"). It is a Supabase CLI
-- migration: with Supabase's GitHub integration connected to the repo it is applied
-- automatically when it reaches main. Without the integration, paste the whole file into
-- Supabase → SQL Editor → Run once. Every statement is idempotent, so running it again is
-- harmless, and running a newer version of this file over an older one upgrades it in place.
-- See docs/ONLINE.md for the 5-minute setup.
--
-- What it creates
--   tables     profiles, clans, clan_codes, clan_members, clan_requests, messages,
--              clan_boss, clan_boss_attempts, clan_boss_hits, clan_boss_claims, coop_rooms,
--              transfer_codes, rate_events
--   security   Row Level Security on every table. Players read what they may see and write
--              only their own profile and chat messages; every other change goes through the
--              SECURITY DEFINER functions below, which check the caller (auth.uid()) and role.
--   limits     enforce_rate(): server-side rate limits (same numbers as src/online/limits.js)
--                chat message        1 per 2 s, 20 per minute   (trigger on messages)
--                create clan         1 per 10 min, 3 per day
--                join/request/leave  10 per hour
--                invite-code tries   counted with joins (a wrong code too: no brute force)
--                clan boss attempt   3 per day (rolling 24 h); battles start 20 per hour
--                co-op room          1 per second, 20 per hour (open or join)
--                transfer code       5 per hour (create or redeem; a wrong code too)
--   realtime   messages, clan_members and clan_boss are published for live updates.
--              Co-op rooms use Realtime broadcast + presence channels 'coop:<CODE>:<secret>':
--              open_room() / join_room() hand the secret to the host and to ONE guest only, so
--              nobody else can listen to or write into a room (no realtime policies needed).
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

-- Display names (src/online/clanRules.js validateName): 2–16 characters, no < >, no invisible /
-- control characters (Unicode Cf + Cc: bidi overrides, zero-width joiners…), and none of the
-- reserved names that would pass for a system notice, the developer bot or staff.
create or replace function public.valid_display_name(p text) returns boolean
language sql immutable as $$
  select p is not null
    and char_length(p) between 2 and 16
    and p = btrim(p)
    and p !~ '[<>]'
    and p !~ '[\u0001-\u001f\u007f-\u009f\u00ad\u0600-\u0605\u061c\u06dd\u070f\u0890-\u0891\u08e2\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u206f\ufeff\ufff9-\ufffb\U000110bd\U000110cd\U00013430-\U0001343f\U0001bca0-\U0001bca3\U0001d173-\U0001d17a\U000e0001\U000e0020-\U000e007f]'
    and lower(regexp_replace(p, '[^[:alnum:]]', '', 'g')) not in
      ('system', 'supplybot', 'admin', 'administrator', 'moderator', 'mod', 'developer', 'dev', 'staff', 'official', 'gm', 'sakurasentinels', 'sakuradevlab')
$$;
alter table public.profiles drop constraint if exists profiles_name_valid;
alter table public.profiles add constraint profiles_name_valid check (public.valid_display_name(name)) not valid;

-- last_active and created_at are the server's: stamped on every write, never taken from a client
create or replace function public.profiles_before_write() returns trigger
language plpgsql as $$
begin
  new.last_active := now();
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists profiles_stamp on public.profiles;
create trigger profiles_stamp before insert or update on public.profiles
  for each row execute function public.profiles_before_write();

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

-- What a message may carry in `meta` (src/online/clanRules.js validMessageMeta): nothing on text,
-- and on a co-op invite exactly { room: 5 letters/digits, stage?: ≤ 16 characters }, ≤ 256 bytes.
-- Without this one player could post megabytes per message (20 a minute) into a column every
-- chat reader downloads and Realtime fans out to every subscriber.
create or replace function public.valid_message_meta(p_kind text, p_meta jsonb) returns boolean
language sql immutable as $$
  select case when p_kind = 'invite' then
      p_meta is not null
      and jsonb_typeof(p_meta) = 'object'
      and pg_column_size(p_meta) <= 256
      and (p_meta - 'room' - 'stage') = '{}'::jsonb
      and jsonb_typeof(p_meta -> 'room') = 'string'
      and (p_meta ->> 'room') ~ '^[A-Z0-9]{5}$'
      and (not (p_meta ? 'stage') or (jsonb_typeof(p_meta -> 'stage') = 'string' and char_length(p_meta ->> 'stage') <= 16))
    else p_meta is null end
$$;
alter table public.messages drop constraint if exists messages_meta_valid;
alter table public.messages add constraint messages_meta_valid check (public.valid_message_meta(kind, meta)) not valid;

create table if not exists public.clan_boss (
  clan_id uuid not null references public.clans (id) on delete cascade,
  week text not null,
  boss_id text not null,
  max_hp bigint not null,
  hp bigint not null,
  primary key (clan_id, week)
);

-- A clan boss battle in progress (start_boss_attempt → submit_boss_damage): the server times it,
-- so a submit needs a real started battle and its damage is capped by how long that battle ran.
create table if not exists public.clan_boss_attempts (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans (id) on delete cascade,
  week text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  boss_id text not null,
  started_at timestamptz not null default now()
);
create index if not exists clan_boss_attempts_user on public.clan_boss_attempts (user_id);

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

-- Co-op rooms: who may use a room code. The Realtime topic is 'coop:<code>:<secret>' and only
-- open_room() (the host) and join_room() (the first guest) ever return the secret.
create table if not exists public.coop_rooms (
  code text primary key check (code ~ '^[A-Z0-9]{5}$'),
  host_id uuid not null references public.profiles (id) on delete cascade,
  guest_id uuid references public.profiles (id) on delete set null,
  secret text not null,
  created_at timestamptz not null default now()
);
create index if not exists coop_rooms_host on public.coop_rooms (host_id);

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
alter table public.clan_boss_attempts enable row level security;
alter table public.clan_boss_hits enable row level security;
alter table public.clan_boss_claims enable row level security;
alter table public.coop_rooms enable row level security;
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
-- clan_boss_attempts, coop_rooms, transfer_codes and rate_events: no policies and no grants at
-- all (only the functions below touch them)

-- Table privileges for the Data API. The policies above decide WHICH rows a player sees or
-- writes; these decide which statements reach a table at all. Spelled out instead of relying on
-- the project's default grants (newer projects may not grant new tables to anon / authenticated,
-- and the old default included TRUNCATE, which Row Level Security does not cover). Players
-- (anonymous accounts are 'authenticated') may only read, create and edit their own profile, and
-- post chat messages; everything else goes through the functions further down.
revoke all on public.profiles, public.clans, public.clan_codes, public.clan_members, public.clan_requests,
  public.messages, public.clan_boss, public.clan_boss_attempts, public.clan_boss_hits, public.clan_boss_claims,
  public.coop_rooms, public.transfer_codes, public.rate_events from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.clans, public.clan_codes, public.clan_members, public.clan_requests,
  public.messages, public.clan_boss, public.clan_boss_hits, public.clan_boss_claims to authenticated;
grant insert (id, name, level, avatar) on public.profiles to authenticated;
grant update (name, level, avatar) on public.profiles to authenticated;
grant insert (channel, user_id, body, kind, meta) on public.messages to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Rate limiting
-- ---------------------------------------------------------------------------------------------

-- How long (ms) until the caller may do p_action again; 0 = now. Takes the per-player lock.
create or replace function public.rate_retry_ms(p_action text, p_gap_ms int, p_max int, p_window interval)
returns bigint language plpgsql security definer set search_path = public as $$
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
  return ceil(greatest(v_retry, 0))::bigint;
end $$;

-- Raises 'rate_limited:<retry ms>' (the client shows "Slow down, 1.4 s") or records the hit.
-- A recorded hit only sticks if the calling statement commits: functions that must count a
-- failed try (a wrong invite / transfer code) therefore RETURN the miss instead of raising it.
create or replace function public.enforce_rate(p_action text, p_gap_ms int, p_max int, p_window interval)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_retry bigint := rate_retry_ms(p_action, p_gap_ms, p_max, p_window);
begin
  if v_retry > 0 then raise exception 'rate_limited:%', v_retry; end if;
  insert into rate_events (user_id, action) values (auth.uid(), p_action);
  if random() < 0.01 then delete from rate_events where at < now() - interval '25 hours'; end if;
end $$;

-- Unguessable codes: n characters of a 32-letter alphabet (5 random bits each, no 0/O, 1/I)
-- from gen_random_uuid(), which draws on the server's cryptographic random source.
create or replace function public.random_code(p_len int) returns text
language plpgsql volatile as $$
declare
  v_alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_out text := '';
  v_bytes bytea;
  i int;
begin
  while char_length(v_out) < p_len loop
    v_bytes := uuid_send(gen_random_uuid());
    for i in 0..15 loop
      -- byte 6 holds the uuid version in its high nibble: its low 5 bits are not all random
      continue when i = 6;
      exit when char_length(v_out) >= p_len;
      v_out := v_out || substr(v_alpha, get_byte(v_bytes, i) % 32 + 1, 1);
    end loop;
  end loop;
  return v_out;
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
    insert into clan_codes (clan_id, code) values (c.id, random_code(8));
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

-- Returns {"id": clan id} or {"error": "not_found"}. Every try counts against the join limit
-- BEFORE the lookup, and a wrong code is returned (not raised) so that count is committed.
drop function if exists public.join_clan_by_code(text);
create or replace function public.join_clan_by_code(p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare
  c clans%rowtype;
begin
  if auth.uid() is null then raise exception 'forbidden: sign in first'; end if;
  if exists (select 1 from clan_members where user_id = auth.uid()) then raise exception 'already_member'; end if;
  perform enforce_rate('clan_join', 0, 10, interval '1 hour');
  select clans.* into c from clan_codes join clans on clans.id = clan_codes.clan_id where lower(clan_codes.code) = lower(trim(p_code));
  if not found then return json_build_object('error', 'not_found'); end if;
  perform add_member(auth.uid(), c.id, 'member');
  return json_build_object('id', c.id);
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

-- The most damage one attempt on a boss can count (src/online/clanRules.js CLAN_BOSSES hitCap):
-- a full clear of that Total Assault arena by a maxed team, plus ~15%.
create or replace function public.boss_hit_cap(p_boss text) returns bigint
language sql immutable as $$
  select (case p_boss when 'lych' then 175000 when 'colossus' then 230000 when 'ashwing' then 195000 else 0 end)::bigint
$$;

create or replace function public.ensure_boss(p_clan uuid, p_week text) returns public.clan_boss
language plpgsql security definer set search_path = public as $$
declare
  b clan_boss%rowtype;
  v_boss text := (array['lych', 'colossus', 'ashwing'])[(split_part(p_week, '-W', 2)::int % 3) + 1];
  v_members int := (select count(*) from clan_members where clan_id = p_clan);
  v_hp bigint;
begin
  select * into b from clan_boss where clan_id = p_clan and week = p_week;
  if found then return b; end if;
  -- src/online/clanRules.js bossMaxHp: hit cap × 3 attempts × max(2, members) × +20% per clan level
  select round(boss_hit_cap(v_boss) * 3 * greatest(2, v_members) * (1 + 0.2 * (clan_level(xp) - 1))) into v_hp from clans where id = p_clan;
  insert into clan_boss (clan_id, week, boss_id, max_hp, hp) values (p_clan, p_week, v_boss, v_hp, v_hp)
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

-- Starts a clan boss battle: {"attemptId", "bossId", "cap"}. Uses no attempt (a scored submit
-- does), but refuses up front when the 3 attempts of the last 24 h are spent. One open battle per
-- player: starting again forgets the previous one.
create or replace function public.start_boss_attempt() returns json
language plpgsql security definer set search_path = public as $$
declare
  v_clan uuid := public.my_clan();
  b clan_boss%rowtype;
  v_retry bigint;
  a clan_boss_attempts%rowtype;
begin
  if v_clan is null then raise exception 'not_member'; end if;
  b := ensure_boss(v_clan, current_week());
  if b.hp <= 0 then raise exception 'invalid: this week''s boss has already fallen'; end if;
  v_retry := rate_retry_ms('boss_hit', 0, 3, interval '1 day');
  if v_retry > 0 then raise exception 'rate_limited:%', v_retry; end if;
  perform enforce_rate('boss_start', 0, 20, interval '1 hour');
  delete from clan_boss_attempts where user_id = auth.uid();
  insert into clan_boss_attempts (clan_id, week, user_id, boss_id) values (v_clan, b.week, auth.uid(), b.boss_id) returning * into a;
  return json_build_object('attemptId', a.id, 'bossId', a.boss_id, 'cap', boss_hit_cap(a.boss_id));
end $$;

-- Scores a started battle. The damage is the client's number, so the server only counts what that
-- battle could have dealt: nothing in its first 10 s, then at most the boss's hit cap, and only a
-- 1/50 share of it per second the battle ran (src/online/clanRules.js bossAllowance; the fastest
-- real clear takes ~60 s at 3×). Nothing to score (0 damage, a submit right after the start)
-- uses no attempt.
drop function if exists public.submit_boss_damage(bigint);
create or replace function public.submit_boss_damage(p_attempt uuid, p_damage bigint) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_clan uuid := public.my_clan();
  a clan_boss_attempts%rowtype;
  b clan_boss%rowtype;
  v_secs numeric;
  v_dmg bigint;
begin
  if v_clan is null then raise exception 'not_member'; end if;
  delete from clan_boss_attempts where id = p_attempt and user_id = auth.uid() returning * into a;
  if not found then raise exception 'invalid: that boss battle is over or was never started'; end if;
  if a.clan_id <> v_clan or a.week <> current_week() then raise exception 'invalid: the clan boss changed during your battle'; end if;
  if a.started_at < now() - interval '2 hours' then raise exception 'invalid: that boss battle ran too long to count'; end if;
  v_secs := extract(epoch from (now() - a.started_at));
  v_dmg := least(greatest(coalesce(p_damage, 0), 0),
                 case when v_secs < 10 then 0 else floor(boss_hit_cap(a.boss_id) * least(1.0, v_secs / 50.0))::bigint end);
  if v_dmg <= 0 then return boss_state(v_clan); end if;
  select * into b from clan_boss where clan_id = v_clan and week = a.week for update;
  if b.hp <= 0 then raise exception 'invalid: this week''s boss has already fallen'; end if;
  perform enforce_rate('boss_hit', 0, 3, interval '1 day');
  update clan_boss set hp = greatest(0, hp - v_dmg) where clan_id = v_clan and week = a.week;
  insert into clan_boss_hits (clan_id, week, user_id, damage) values (v_clan, a.week, auth.uid(), v_dmg);
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

-- Codes are 12 characters (60 random bits), shown as XXXX-XXXX-XXXX; one live code per player.
create or replace function public.create_transfer(p_payload text) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_exp timestamptz := now() + interval '24 hours';
begin
  if auth.uid() is null then raise exception 'forbidden: sign in first'; end if;
  if p_payload is null or char_length(p_payload) = 0 or char_length(p_payload) > 307200 then raise exception 'invalid: that save is too large'; end if;
  perform enforce_rate('transfer', 0, 5, interval '1 hour');
  delete from transfer_codes where created_by = auth.uid() and used_at is null;
  loop
    v_code := random_code(12);
    exit when not exists (select 1 from transfer_codes where code = v_code);
  end loop;
  insert into transfer_codes (code, payload, created_by, expires_at) values (v_code, p_payload, auth.uid(), v_exp);
  delete from transfer_codes where expires_at < now() - interval '1 day';
  return json_build_object('code', substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4) || '-' || substr(v_code, 9, 4), 'expiresAt', v_exp);
end $$;

-- Returns {"payload"} or {"error": "not_found" | "expired"}. Every try counts against the
-- transfer limit, and a miss is returned (not raised) so that count is committed: guessing codes
-- stops after 5 tries an hour.
drop function if exists public.redeem_transfer(text);
create or replace function public.redeem_transfer(p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare
  t transfer_codes%rowtype;
begin
  if auth.uid() is null then raise exception 'forbidden: sign in first'; end if;
  perform enforce_rate('transfer', 0, 5, interval '1 hour');
  select * into t from transfer_codes where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) for update;
  if not found then return json_build_object('error', 'not_found'); end if;
  if t.used_at is not null or t.expires_at < now() then return json_build_object('error', 'expired'); end if;
  update transfer_codes set used_at = now(), used_by = auth.uid() where code = t.code;
  return json_build_object('payload', t.payload);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Co-op rooms: the host registers a code, ONE guest joins it; both get the room secret that
-- names the Realtime channel. A wrong code counts against the room limit (returned, not raised).
-- ---------------------------------------------------------------------------------------------

-- Returns {"code", "secret", "host"} or {"error": "name_taken"} (another host's live room).
create or replace function public.open_room(p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  r coop_rooms%rowtype;
begin
  if auth.uid() is null then raise exception 'forbidden: sign in first'; end if;
  if v_code !~ '^[A-Z0-9]{5}$' then raise exception 'invalid: room codes are 5 letters or digits'; end if;
  select * into r from coop_rooms where code = v_code for update;
  if found and r.host_id = auth.uid() then
    return json_build_object('code', r.code, 'secret', r.secret, 'host', true); -- my room (a reload)
  end if;
  -- counted before anything about other rooms is revealed (and the miss returned, so it commits)
  perform enforce_rate('room', 1000, 20, interval '1 hour');
  if found and r.created_at > now() - interval '6 hours' then return json_build_object('error', 'name_taken'); end if;
  delete from coop_rooms where host_id = auth.uid() or code = v_code or created_at < now() - interval '1 day';
  insert into coop_rooms (code, host_id, secret) values (v_code, auth.uid(), random_code(16)) returning * into r;
  return json_build_object('code', r.code, 'secret', r.secret, 'host', true);
end $$;

-- Returns {"code", "secret", "host"} or {"error": "not_found" | "full"}.
create or replace function public.join_room(p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  r coop_rooms%rowtype;
begin
  if auth.uid() is null then raise exception 'forbidden: sign in first'; end if;
  perform enforce_rate('room', 1000, 20, interval '1 hour');
  select * into r from coop_rooms where code = v_code and created_at > now() - interval '1 day' for update;
  if not found then return json_build_object('error', 'not_found'); end if;
  if r.host_id = auth.uid() then return json_build_object('code', r.code, 'secret', r.secret, 'host', true); end if;
  if r.guest_id is not null and r.guest_id <> auth.uid() then return json_build_object('error', 'full'); end if;
  update coop_rooms set guest_id = auth.uid() where code = r.code;
  return json_build_object('code', r.code, 'secret', r.secret, 'host', false);
end $$;

-- The host closes the room; a guest frees its seat for someone else.
create or replace function public.leave_room(p_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from coop_rooms where code = upper(trim(coalesce(p_code, ''))) and host_id = auth.uid();
  update coop_rooms set guest_id = null where code = upper(trim(coalesce(p_code, ''))) and guest_id = auth.uid();
end $$;

-- Only signed-in players (anonymous accounts included) may call the game's functions, and only
-- the entry points below: helpers such as add_member / enforce_rate / system_message stay internal.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.create_clan(text, text, text, text, text), public.join_clan(uuid), public.join_clan_by_code(text),
  public.request_join(uuid), public.answer_request(uuid, uuid, boolean), public.leave_clan(),
  public.set_role(uuid, text), public.kick(uuid), public.touch_active(), public.boss_state(uuid),
  public.start_boss_attempt(), public.submit_boss_damage(uuid, bigint), public.claim_boss_reward(text),
  public.create_transfer(text), public.redeem_transfer(text), public.open_room(text), public.join_room(text),
  public.leave_room(text), public.my_clan(), public.my_role(), public.clan_level(bigint), public.current_week(),
  public.boss_hit_cap(text), public.valid_display_name(text), public.valid_message_meta(text, jsonb)
  to authenticated;
-- (boss_standing, ensure_boss, add_member, rate_retry_ms, enforce_rate, random_code and
--  system_message stay internal; the two valid_* checks run inside the table constraints, which
--  execute with the writing player's rights)

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
