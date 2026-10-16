-- Sakura Sentinels — CLAN INVITES and the daily clan RECRUITING POST (owner request: "also can we invite
-- people to clan? like invite to global chat once a day too? and to dms").
--
-- HOW TO RUN IT (owner): AFTER 20261013000000_social.sql and 20261015000000_social_open_friends.sql.
-- Open this file on GitHub → Raw → select all → copy; Supabase → SQL Editor → New query → paste → Run.
-- Safe to run more than once. Check afterwards: `select public.clan_invites_version();` → 1.
-- ORDER: online (first migration) → social → open friends → (profile, player tags) → THIS file. It needs
-- only the social files; the profile and tags files may come before or after it. If the first migration
-- is ever pasted again, paste the social files and then THIS file again right after them (the first file
-- restores the old message rules, and new recruiting posts would be refused until this file runs again).
-- It runs as ONE transaction: on any error nothing at all was changed — press Run again.
--
-- The game's frontend deploys BEFORE this runs: until then "Invite to clan" and the recruiting post
-- say "Needs the latest server update"; chat, clans, messages and friends keep working.
--
-- What it creates
--   tables     clan_invites (one row per clan → player: pending · declined · shadow), clan_recruit_posts
--              (one row per clan per game day). RLS on, NO grants: only the functions below.
--   invites    who may invite: a member of a non-developer clan who is its leader or an officer, or any
--              member of an 'open' clan (anyone could join it anyway). Who can be invited: a player in no
--              clan. A player who blocked the inviter, or whose "Who can message me" is Nobody, or who is
--              in the developer clan, gets nothing and the inviter still sees "Invited" (like a friend
--              request: a block or a setting is never shown). The inviter must have unblocked them first.
--              The invite card (Messages → Requests) has Join / Decline. Join works whatever the clan's
--              join mode (that one invite opens a 'request' or 'code' clan) and still respects the member
--              cap; an invite from the leader or an officer also lifts a kick ban (like accepting a join
--              request), a plain member's does not. Invites end after 7 days; a declined one swallows
--              repeats from that clan for 7 days. An invite counts only while its sender could send it
--              today: still in the clan, still allowed to invite to it (an officer made a plain member
--              of a 'request' or 'code' clan can't), and no block between the two players either way;
--              otherwise it leaves the list and Join answers "that invite is gone".
--   limits     enforce_rate() (same numbers as src/online/limits.js RULES): clan invite 1 per 2 s, 20 per
--              hour per sender; at most 10 invites a day per invited player (more are refused: "they got a
--              lot of clan invites today"), at most 20 pending per player (a full list drops its oldest).
--              Joining counts as a clan join (10 per hour, like the other ways in).
--   recruiting once per clan per GAME DAY (7 PM America/Chicago, game_day_key()), by the leader or an
--              officer: a global chat line of the new kind 'recruit' with a small clan card in `meta` — id,
--              tag, name, emblem, members, max, join mode and level, all written by the server from the
--              clan row (a player can never post kind 'recruit' directly: the insert policy allows only
--              'text' and 'invite'). Its text says the same in words, so an older game shows a readable
--              chat line: "[TAG] Name is recruiting! 12/30 members · open to all. Find them in Clan →
--              Find a clan." It counts as a chat message too (chat rate limit, chat guard) and 5 per day per
--              player (recruit).
--   messages   messages.kind gains 'recruit'; valid_message_meta() gains its card (everything else is
--              unchanged: text carries no meta, a co-op invite exactly { room, stage? }).
--   retention  invites 30 days, recruiting rows 30 days — deleted as new rows arrive (no cron).

begin;

-- =============================================================================================
-- 0. Order guard: the social files first (blocks, privacy, mutes, names, the game clock)
-- =============================================================================================
do $$
begin
  if to_regclass('public.blocks') is null or to_regprocedure('public.social_privacy(uuid)') is null
     or to_regprocedure('public.game_day_key(timestamptz)') is null then
    raise exception 'Run 20261013000000_social.sql first: this file needs its blocks, privacy settings and game clock';
  end if;
end $$;

-- One quiet moment for every live table this file touches, all locked at once (chat's kind check changes;
-- the new tables point at clans and profiles): players' requests wait the second this file needs, and no
-- clan join or chat line can hold one of them while waiting for another ("deadlock detected"). If the game
-- stays busy for 30 seconds it stops and nothing was changed — press Run again.
do $$
begin
  for i in 1..600 loop
    begin
      lock table public.messages, public.clans, public.profiles in access exclusive mode nowait;
      return;
    exception when lock_not_available then
      perform pg_sleep(0.05);
    end;
  end loop;
  raise exception 'The game is busy right now, so nothing was changed. Press Run again in a minute.';
end $$;

-- =============================================================================================
-- 1. Tables
-- =============================================================================================

-- status: pending (the player sees it) · declined (a 7-day tombstone: repeats from that clan are
-- swallowed) · shadow (swallowed at once: a block, "Nobody", the developer clan; the inviter still
-- sees "Invited")
create table if not exists public.clan_invites (
  id bigint generated always as identity primary key,
  clan_id uuid not null references public.clans (id) on delete cascade,
  from_id uuid references public.profiles (id) on delete set null,
  to_id uuid not null references public.profiles (id) on delete cascade,
  from_name text not null default '',
  status text not null default 'pending' check (status in ('pending', 'declined', 'shadow')),
  created_at timestamptz not null default now(),
  unique (clan_id, to_id)
);
create index if not exists clan_invites_to on public.clan_invites (to_id, status, created_at desc);

create table if not exists public.clan_recruit_posts (
  clan_id uuid not null references public.clans (id) on delete cascade,
  game_day text not null,
  user_id uuid references public.profiles (id) on delete set null,
  message_id bigint,
  created_at timestamptz not null default now(),
  primary key (clan_id, game_day)
);

alter table public.clan_invites enable row level security;
alter table public.clan_recruit_posts enable row level security;
revoke all on public.clan_invites, public.clan_recruit_posts from anon, authenticated;
do $$
declare
  s text := pg_get_serial_sequence('public.clan_invites', 'id');
begin
  if s is not null then execute format('revoke all on sequence %s from anon, authenticated', s); end if;
end $$;

-- =============================================================================================
-- 2. Chat: the 'recruit' kind and its card (src/online/clanRules.js validMessageMeta mirrors it)
-- =============================================================================================

alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check check (kind in ('text', 'invite', 'system', 'recruit')) not valid;

-- The first migration's rule, plus 'recruit': exactly { clan, tag, name, emblem, members, max, mode,
-- level }, ≤ 512 bytes. Keeps its grant.
create or replace function public.valid_message_meta(p_kind text, p_meta jsonb) returns boolean
language sql immutable as $$
  select case
    when p_kind = 'invite' then
      p_meta is not null
      and jsonb_typeof(p_meta) = 'object'
      and pg_column_size(p_meta) <= 256
      and (p_meta - 'room' - 'stage') = '{}'::jsonb
      and jsonb_typeof(p_meta -> 'room') = 'string'
      and (p_meta ->> 'room') ~ '^[A-Z0-9]{5}$'
      and (not (p_meta ? 'stage') or (jsonb_typeof(p_meta -> 'stage') = 'string' and char_length(p_meta ->> 'stage') <= 16))
    when p_kind = 'recruit' then
      p_meta is not null
      and jsonb_typeof(p_meta) = 'object'
      and pg_column_size(p_meta) <= 512
      and (p_meta - array['clan', 'tag', 'name', 'emblem', 'members', 'max', 'mode', 'level']) = '{}'::jsonb
      and jsonb_typeof(p_meta -> 'clan') = 'string' and (p_meta ->> 'clan') ~ '^[0-9a-f-]{36}$'
      and jsonb_typeof(p_meta -> 'tag') = 'string' and (p_meta ->> 'tag') ~ '^[A-Z0-9]{2,4}$'
      and jsonb_typeof(p_meta -> 'name') = 'string' and char_length(p_meta ->> 'name') between 1 and 20
      and jsonb_typeof(p_meta -> 'emblem') = 'string' and char_length(p_meta ->> 'emblem') <= 24
      and jsonb_typeof(p_meta -> 'members') = 'number' and (p_meta ->> 'members')::numeric between 0 and 1000
      and jsonb_typeof(p_meta -> 'max') = 'number' and (p_meta ->> 'max')::numeric between 1 and 1000
      and jsonb_typeof(p_meta -> 'level') = 'number' and (p_meta ->> 'level')::numeric between 1 and 20
      and (p_meta ->> 'mode') in ('open', 'request', 'code')
    else p_meta is null end
$$;

-- =============================================================================================
-- 3. Internal helpers (SECURITY INVOKER, revoked: they see nothing when a player calls them)
-- =============================================================================================

-- The clan p_me may invite to (a non-developer clan where p_me is leader / officer, or any member of
-- an open clan), or null.
create or replace function public.clan_invite_clan(p_me uuid) returns uuid
language sql stable security invoker set search_path = public, pg_temp as $$
  select c.id from clan_members m join clans c on c.id = m.clan_id
  where m.user_id = p_me and not c.is_dev and (m.role in ('leader', 'officer') or c.join_mode = 'open')
$$;

-- "[PS] Petal Squad is recruiting! 12/30 members · open to all. Find them in Clan → Find a clan."
-- (src/online/clanInviteRules.js recruitBody() says the same)
create or replace function public.clan_recruit_body(p_tag text, p_name text, p_members int, p_max int, p_mode text) returns text
language sql immutable security invoker set search_path = public, pg_temp as $$
  select format('[%s] %s is recruiting! %s/%s members · %s. Find them in Clan → Find a clan.', p_tag, p_name, p_members, p_max,
    case p_mode when 'open' then 'open to all' when 'request' then 'ask to join' else 'invite code' end)
$$;

create or replace function public.clan_invites_housekeeping() returns void
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if random() < 0.05 then
    delete from clan_invites where created_at < now() - interval '30 days';
    delete from clan_recruit_posts where created_at < now() - interval '30 days';
  end if;
end $$;

-- =============================================================================================
-- 4. Entry points (SECURITY DEFINER, explicit auth.uid() checks)
-- =============================================================================================

-- The frontend's deploy probe: "needs the latest server update" until this exists.
create or replace function public.clan_invites_version() returns int
language sql immutable as $$ select 1 $$;

-- Invite a player to my clan. Returns {state: 'invited'} — also when it was swallowed.
create or replace function public.send_clan_invite(p_user uuid) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  v_clan uuid;
  v_their clans%rowtype;
  inv clan_invites%rowtype;
  v_shadow boolean;
  v_today int;
begin
  if p_user is null or p_user = v_me then raise exception 'invalid: that is you'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'not_found: that player is gone'; end if;
  if social_muted(v_me) then raise exception 'forbidden: you can''t send invites right now'; end if;
  if not (select social_name_ok(name) from profiles where id = v_me) then raise exception 'invalid: change your online name first'; end if;
  v_clan := clan_invite_clan(v_me);
  if v_clan is null then
    if exists (select 1 from clan_members m join clans c on c.id = m.clan_id where m.user_id = v_me and not c.is_dev) then
      raise exception 'forbidden: only the leader and officers can invite to this clan';
    end if;
    raise exception 'not_member: join a clan first';
  end if;
  if exists (select 1 from blocks where blocker_id = v_me and blocked_id = p_user) then raise exception 'invalid: unblock them first'; end if;
  perform enforce_rate('clan_invite', 2000, 20, interval '1 hour');
  -- one invite at a time per invited player: the daily cap and the pending list hold under a burst
  perform pg_advisory_xact_lock(hashtext('claninvite:' || p_user::text));
  select c.* into v_their from clan_members m join clans c on c.id = m.clan_id where m.user_id = p_user;
  if v_their.id = v_clan then raise exception 'invalid: they are already in your clan'; end if;
  if v_their.id is not null and not v_their.is_dev then raise exception 'invalid: they are already in a clan'; end if;
  -- swallowed without a trace: they blocked me, their setting is Nobody, or they are in the developer clan
  v_shadow := social_is_blocked(v_me, p_user) or social_privacy(p_user) = 'nobody' or v_their.id is not null;
  select * into inv from clan_invites where clan_id = v_clan and to_id = p_user for update;
  if found then
    if inv.status = 'pending' and inv.created_at > now() - interval '7 days' then return json_build_object('state', 'invited'); end if;
    if inv.status = 'declined' and inv.created_at > now() - interval '7 days' then return json_build_object('state', 'invited'); end if;
    if inv.status = 'shadow' and v_shadow then return json_build_object('state', 'invited'); end if;
    delete from clan_invites where id = inv.id; -- ended, or no longer swallowed: a fresh invite
  end if;
  if not v_shadow then
    select count(*) into v_today from clan_invites where to_id = p_user and status <> 'shadow' and created_at > now() - interval '1 day';
    if v_today >= 10 then raise exception 'invalid: they got a lot of clan invites today — try again tomorrow'; end if;
    -- a full list drops its oldest pending invite instead of refusing new ones
    delete from clan_invites where id in (
      select id from clan_invites where to_id = p_user and status = 'pending' order by created_at desc, id desc offset 19);
  end if;
  insert into clan_invites (clan_id, from_id, to_id, from_name, status)
    values (v_clan, v_me, p_user, (select name from profiles where id = v_me), case when v_shadow then 'shadow' else 'pending' end);
  perform clan_invites_housekeeping();
  return json_build_object('state', 'invited');
end $$;

-- My open invites (none while I am in a clan): newest first, with the clan's card.
create or replace function public.list_clan_invites() returns json
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
begin
  if exists (select 1 from clan_members where user_id = v_me) then return '[]'::json; end if;
  return (select coalesce(json_agg(x order by x.at desc), '[]'::json) from (
    select i.id, i.from_id as "fromId", i.from_name as "fromName", i.created_at as at, i.created_at + interval '7 days' as "expiresAt",
      json_build_object('id', c.id, 'name', c.name, 'tag', c.tag, 'emblem', c.emblem, 'joinMode', c.join_mode, 'level', clan_level(c.xp),
        'memberCount', (select count(*) from clan_members m where m.clan_id = c.id), 'maxMembers', c.max_members) as clan
    from clan_invites i join clans c on c.id = i.clan_id
    where i.to_id = v_me and i.status = 'pending' and i.created_at > now() - interval '7 days' and not c.is_dev
      -- only while its sender could send it today (in the clan, allowed to invite) and no block stands between us
      and clan_invite_clan(i.from_id) = i.clan_id and not social_is_blocked(v_me, i.from_id)
    order by i.created_at desc limit 20) x);
end $$;

-- Join or decline. Join: whatever the clan's join mode, within its member cap; returns {id: clan id}.
create or replace function public.answer_clan_invite(p_id bigint, p_accept boolean) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  inv clan_invites%rowtype;
  c clans%rowtype;
  v_role text;
begin
  select * into inv from clan_invites where id = p_id and to_id = v_me and status = 'pending' and created_at > now() - interval '7 days' for update;
  if not found then raise exception 'not_found: that invite is gone'; end if;
  if not coalesce(p_accept, false) then
    update clan_invites set status = 'declined', created_at = now() where id = inv.id;
    return json_build_object('state', 'declined');
  end if;
  if exists (select 1 from clan_members where user_id = v_me) then raise exception 'already_member'; end if;
  select * into c from clans where id = inv.clan_id and not is_dev;
  if not found then raise exception 'not_found: that clan is gone'; end if;
  -- the invite counts only while its sender could send it today: still in the clan and still allowed to
  -- invite to it (an officer made a plain member of a 'request' or 'code' clan can't), and no block
  -- between us either way. Otherwise it is gone (returned, not raised, so the removal sticks).
  if inv.from_id is null or clan_invite_clan(inv.from_id) is distinct from c.id or social_is_blocked(v_me, inv.from_id) then
    delete from clan_invites where id = inv.id;
    return json_build_object('error', 'gone');
  end if;
  select role into v_role from clan_members where user_id = inv.from_id and clan_id = c.id;
  perform enforce_rate('clan_join', 0, 10, interval '1 hour');
  -- the leader's or an officer's invite lets a kicked player back in, like accepting their request
  if v_role in ('leader', 'officer') then delete from clan_bans where clan_id = c.id and user_id = v_me; end if;
  perform add_member(v_me, c.id, 'member');
  delete from clan_invites where to_id = v_me and status = 'pending';
  return json_build_object('id', c.id);
end $$;

-- Can my clan post its recruiting line now? {can, why, nextAt}: why = not_member · dev · role · posted.
create or replace function public.recruit_state() returns json
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  m clan_members%rowtype;
  c clans%rowtype;
  v_why text;
begin
  select * into m from clan_members where user_id = v_me;
  if found then select * into c from clans where id = m.clan_id; end if;
  v_why := case
    when m.user_id is null then 'not_member'
    when c.is_dev then 'dev'
    when m.role not in ('leader', 'officer') then 'role'
    when exists (select 1 from clan_recruit_posts where clan_id = c.id and game_day = game_day_key(now())) then 'posted'
    else null end;
  return json_build_object('can', v_why is null, 'why', v_why, 'nextAt', case when v_why = 'posted' then next_game_reset() end);
end $$;

-- Post my clan's recruiting line to global chat (once per clan per game day). Returns the message.
create or replace function public.post_clan_recruit() returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  m clan_members%rowtype;
  c clans%rowtype;
  v_count int;
  v_meta jsonb;
  r messages%rowtype;
begin
  select * into m from clan_members where user_id = v_me;
  if not found then raise exception 'not_member: join a clan first'; end if;
  select * into c from clans where id = m.clan_id for update;
  if c.is_dev then raise exception 'forbidden: the developer clan does not recruit in chat'; end if;
  if m.role not in ('leader', 'officer') then raise exception 'forbidden: only the leader and officers can post for the clan'; end if;
  if social_muted(v_me) then raise exception 'forbidden: you can''t send messages right now'; end if;
  insert into clan_recruit_posts (clan_id, game_day, user_id) values (c.id, game_day_key(now()), v_me) on conflict do nothing;
  if not found then raise exception 'daily_limit:%', ms_to_game_reset(); end if;
  perform enforce_rate('recruit', 0, 5, interval '1 day');
  select count(*) into v_count from clan_members where clan_id = c.id;
  v_meta := jsonb_build_object('clan', c.id, 'tag', c.tag, 'name', c.name, 'emblem', c.emblem, 'members', v_count,
    'max', c.max_members, 'mode', c.join_mode, 'level', clan_level(c.xp));
  -- the chat triggers stamp the name / level / avatar, apply the chat rate limit and the chat guard
  insert into messages (channel, user_id, body, kind, meta)
    values ('global', v_me, clan_recruit_body(c.tag, c.name, v_count, c.max_members, c.join_mode), 'recruit', v_meta)
    returning * into r;
  update clan_recruit_posts set message_id = r.id where clan_id = c.id and game_day = game_day_key(now());
  perform clan_invites_housekeeping();
  return json_build_object('id', r.id, 'channel', r.channel, 'user_id', r.user_id, 'name', r.name, 'level', r.level, 'avatar', r.avatar,
    'body', r.body, 'kind', r.kind, 'meta', r.meta, 'created_at', r.created_at);
end $$;

-- =============================================================================================
-- 5. Function privileges: revoke everything this file creates (by name, all overloads), then grant
--    only the entry points. valid_message_meta keeps the first migration's grant (players may run it).
-- =============================================================================================

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (array[
      'clan_invite_clan', 'clan_recruit_body', 'clan_invites_housekeeping',
      'clan_invites_version', 'send_clan_invite', 'list_clan_invites', 'answer_clan_invite', 'recruit_state', 'post_clan_recruit'])
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

grant execute on function
  public.clan_invites_version(), public.send_clan_invite(uuid), public.list_clan_invites(), public.answer_clan_invite(bigint, boolean),
  public.recruit_state(), public.post_clan_recruit()
  to authenticated;

commit;

-- PostgREST picks up the new functions at once
notify pgrst, 'reload schema';
