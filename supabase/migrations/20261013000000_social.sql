-- Sakura Sentinels — the SOCIAL UPDATE: private messages (DMs), friends + friend codes, blocks,
-- reports, co-op invites by DM, and clan material requests / donations with daily limits.
--
-- HOW TO RUN IT (owner): open this file on GitHub → Raw → select all → copy; Supabase → SQL Editor →
-- New query → paste → Run. It is idempotent: running it again is harmless. It needs the first
-- migration (20261008000000_online.sql) to have run before. Never paste a service-role key
-- anywhere — nothing here needs one. Check afterwards: `select public.social_version();` → 1.
-- IMPORTANT: if 20261008000000_online.sql is ever pasted again, paste THIS file again right after
-- it (the old file revokes every function grant and restores the old join_room()).
--
-- The game's frontend deploys BEFORE this runs: until then every new feature shows "Needs the
-- latest server update" and chat, clans, the clan boss and co-op keep working as before.
--
-- What it creates
--   tables     social_settings, friend_codes, friend_requests, friends, blocks, coop_partners,
--              dm_threads, direct_messages, dm_state, reports, social_mutes, donate_items,
--              donation_requests, donations, donation_keys, dev_lab_visits
--   security   Row Level Security on every table. Players get NO insert / update / delete grant
--              on any of them: every change is a SECURITY DEFINER entry point below that checks
--              auth.uid(). Internal helpers are SECURITY INVOKER (called by a player directly
--              they would run with the player's own rights and see nothing) and are revoked too.
--              Players may SELECT only three tables, for Realtime: their own DMs, friend requests
--              sent to them (pending ones only) and their clan's material requests.
--   privacy    "Who can message me": Friends & clan (default; clanmates after both spent 72 h in
--              the same non-developer clan) · Friends only · Nobody. Both sides' settings must
--              allow a DM. A missing settings row means the default, never "open". Blocking is
--              never shown to the blocked player: a block reads like a privacy refusal, a closed
--              request (donations) or a full room (co-op).
--   friends    requests need a shared context (same clan, a co-op game in the last 7 days, or the
--              friend code); they carry no text, only the sender's name stamped when sent; a
--              declined / blocked / Nobody request is silently swallowed for 30 days, a cancelled
--              one for a day (asking again does not notify again). A friend code is a way to ask,
--              not a secret identity: every profile row (id, name, level) is readable anyway.
--   limits     enforce_rate() (same numbers as src/online/limits.js):
--                DM                    1 per 2 s, 20 per minute, 300 per day; 10 new conversations a day
--                co-op invite by DM    1 per 5 s, 20 per hour (and 4 per hour to the same player)
--                friend request / code 10 per hour (a wrong code counts too)
--                block / unblock       30 per hour        report      1 per 10 s, 10 per day
--                privacy / new code    20 per hour        player card 120 per hour
--                name change           3 per day          donation    1 per 500 ms, 60 per hour
--                donation check        30 per hour (settle_donations; at most 100 voided keys / 2 days)
--              daily caps on the GAME DAY (7 PM America/Chicago, DST-aware; game_day_key()):
--                one material request per player per game day (across clans); 30 donation points
--                per donor per game day; super rare requests 3 / mythic 1 per rolling 7 days.
--   names      new and changed names only (a trigger, never a check constraint: an old name must
--              never lock its owner out of chat, clans or co-op): visible letters, no blank
--              fillers, no look-alike of a reserved name ("Ѕystem" with a Cyrillic Ѕ, "Ｓｙｓｔｅｍ").
--              An older name keeps working everywhere except DMs / friend requests / invites
--              ("change your online name first").
--   donations  the server never sees inventories (saves are local): donate(key) is idempotent by a
--              client key, settle_donations() voids keys it never applied (tombstones: voided 2
--              days, applied 90 days), claim_donations(key) replays the same set for 24 h. See
--              src/online/donateLedger.js.
--   reports    stored for the owner with the server's own copy of the evidence. Auto-mute: 3
--              reporters (accounts ≥ 7 days old) the target contacted by DM, co-op invite or
--              friend request in the last 7 days, within 24 h; a repeat report only counts again
--              after new contact.
--   realtime   direct_messages, friend_requests and donation_requests join the publication.
--   retention  DMs 14 days (every message of those 14 days is kept: report evidence), friend
--              requests 30 days, donations 7 days unclaimed / 30 days claimed, key tombstones as
--              above — deleted as new rows arrive (no cron).
-- No profanity filter (owner's decision); text rules: 1–200 characters, no invisible / bidi /
-- control characters, at least one visible character, no blank-looking names, text only (the game
-- shows it as plain text).

-- =============================================================================================
-- 0. The game clock (owner decision D3: every daily reset at 7 PM America/Chicago)
-- =============================================================================================

-- Chicago wall time + 5 h: 7 PM Central becomes midnight. Same body as the energy update's.
create or replace function public.game_clock() returns timestamp
language sql stable as $$ select (now() at time zone 'America/Chicago') + interval '5 hours' $$;

-- 'YYYY-MM-DD' of the game day containing p_at, named by the date it ENDS; equals
-- src/core/reset.js gameDay(p_at). (((p_at at time zone 'America/Chicago') - interval '19 hours')::date
-- flips at the same instant but is one day earlier: never store that one.)
create or replace function public.game_day_key(p_at timestamptz) returns text
language sql stable as $$ select to_char((p_at at time zone 'America/Chicago') + interval '5 hours', 'YYYY-MM-DD') $$;

-- The next 7 PM Central (19:00 is never inside a DST gap or overlap, so the cast is exact).
create or replace function public.next_game_reset() returns timestamptz
language sql stable as $$ select (date_trunc('day', public.game_clock()) + interval '19 hours') at time zone 'America/Chicago' $$;

create or replace function public.ms_to_game_reset() returns bigint
language sql stable as $$ select greatest(0, ceil(extract(epoch from (public.next_game_reset() - now())) * 1000))::bigint $$;

-- =============================================================================================
-- 1. Text rules (src/online/socialRules.js mirrors them)
-- =============================================================================================

-- DM / chat bodies: 1–200 characters, trimmed, no control / bidi / zero-width-space / tag
-- characters, no line separators, blank fillers or invisible marks (combining grapheme joiner,
-- Khmer inherent vowels, the null notehead), at most 4 stacked accents in a row, and at least one
-- VISIBLE character: one that is not a space of any kind (U+00A0, U+2000–U+200A, U+3000…), a
-- joiner, a variation selector or an accent. Spelled out as code points, never [[:space:]]: the
-- character classes follow the database locale. ZWJ / ZWNJ, variation selectors (emoji, Japanese
-- ideographic variants) and the ideographic space inside a sentence stay allowed.
-- src/online/textRules.js MESSAGE_INVISIBLE / VISIBLE_CHAR mirror both sets.
create or replace function public.valid_dm_body(p text) returns boolean
language sql immutable as $$
  select p is not null
    and p = btrim(p)
    and char_length(p) between 1 and 200
    and p !~ '[\u0001-\u001f\u007f-\u009f\u00ad\u034f\u0600-\u0605\u061c\u06dd\u070f\u0890-\u0891\u08e2\u115f\u1160\u17b4\u17b5\u180e\u200b\u200e\u200f\u2028-\u202e\u2060-\u2064\u2066-\u206f\u2800\u3164\ufeff\uffa0\ufff9-\ufffb\U000110bd\U000110cd\U00013430-\U0001343f\U0001bca0-\U0001bca3\U0001d159\U0001d173-\U0001d17a\U000e0000-\U000e007f]'
    and p ~ '[^\u0009-\u000d\u0020\u0085\u00a0\u0300-\u036f\u1680\u180b-\u180f\u1ab0-\u1aff\u1dc0-\u1dff\u2000-\u200f\u2028\u2029\u202f\u205f\u20d0-\u20ff\u3000\ufe00-\ufe0f\ufe20-\ufe2f\U000e0100-\U000e01ef]'
    and p !~ '[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]{5,}'
$$;

-- What a DM may carry: nothing on text; on a co-op invite exactly { room, stage, difficulty,
-- expires } with a campaign stage id, one of the four difficulties and the server's expiry (ms).
create or replace function public.valid_dm_meta(p_kind text, p_meta jsonb) returns boolean
language sql immutable as $$
  select case when p_kind = 'invite' then
      p_meta is not null
      and jsonb_typeof(p_meta) = 'object'
      and pg_column_size(p_meta) <= 256
      and (p_meta - 'room' - 'stage' - 'difficulty' - 'expires') = '{}'::jsonb
      and jsonb_typeof(p_meta -> 'room') = 'string' and (p_meta ->> 'room') ~ '^[A-Z0-9]{5}$'
      and jsonb_typeof(p_meta -> 'stage') = 'string' and (p_meta ->> 'stage') ~ '^[0-9]{1,2}-[0-9]{1,2}$'
      and jsonb_typeof(p_meta -> 'difficulty') = 'string' and (p_meta ->> 'difficulty') in ('easy', 'normal', 'hard', 'nightmare')
      and jsonb_typeof(p_meta -> 'expires') = 'number'
    else p_kind = 'text' and p_meta is null end
$$;

-- Display names must not look empty: no fillers / Braille blank / line separators / invisible
-- marks, no stacked accents, at least one visible character (the set of valid_dm_body), and no
-- space of any kind at either end (btrim() only trims ASCII spaces: "　　" passed the first
-- migration). On top of valid_display_name() of the first migration. src/online/clanRules.js
-- validateName() mirrors it.
create or replace function public.visible_name(p text) returns boolean
language sql immutable as $$
  select p is not null
    and p !~ '[\u034f\u115f\u1160\u17b4\u17b5\u2028\u2029\u2800\u3164\uffa0\U0001d159]'
    and p !~ '[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]{5,}'
    and p ~ '[^\u0009-\u000d\u0020\u0085\u00a0\u0300-\u036f\u1680\u180b-\u180f\u1ab0-\u1aff\u1dc0-\u1dff\u2000-\u200f\u2028\u2029\u202f\u205f\u20d0-\u20ff\u3000\ufe00-\ufe0f\ufe20-\ufe2f\U000e0100-\U000e01ef]'
    and p !~ '^[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]'
    and p !~ '[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]$'
$$;

-- What a name is compared by for the reserved list: compatibility-decomposed (fullwidth → ASCII,
-- accents split off), common Cyrillic / Greek / Latin look-alikes mapped to Latin (both cases
-- listed: lower() follows the database locale), then only a–z and 0–9 kept. 'Ѕystem' (Cyrillic
-- Ѕ), 'Ｓｙｓｔｅｍ', 'Sýstem', 'Supply Bоt' (Cyrillic о), 'Αdmin' (Greek Α) all give their plain
-- spelling. src/online/textRules.js nameKey() uses the same table (LOOKALIKE_FROM / _TO).
create or replace function public.name_key(p text) returns text
language sql immutable as $$
  select regexp_replace(lower(translate(normalize(coalesce(p, ''), NFKD),
    'АВСЕНІЈКМОРЅТХУҮҺԀԚԜӀѴавсеніјкморѕтхуүһԁԛԝӏѵΑΒΕΖΗΙΚΜΝΟΡΤΥΧαβεζηικμνορτυχϳıɑɡɩ',
    'abcehijkmopstxyyhdqwlvabcehijkmopstxyyhdqwlvabezhikmnoptyxabezhikmnoptyxjiagi')), '[^a-z0-9]', '', 'g')
$$;

-- Names nobody may take, look-alikes included (src/online/clanRules.js RESERVED_NAMES).
create or replace function public.reserved_name(p text) returns boolean
language sql immutable as $$
  select name_key(p) = any (array['system', 'supplybot', 'admin', 'administrator', 'moderator', 'mod', 'developer', 'dev', 'staff', 'official', 'gm', 'sakurasentinels', 'sakuradevlab'])
$$;

-- A name the social features accept from a sender (DMs, invites, friend requests). A name from
-- before this file that fails it keeps working in chat, clans and co-op.
create or replace function public.social_name_ok(p text) returns boolean
language sql immutable as $$
  select coalesce(valid_display_name(p) and visible_name(p) and not reserved_name(p), false)
$$;

-- (an earlier draft of this file checked names with a NOT VALID constraint: that still runs on
-- every UPDATE of an old row and locked such players out. The trigger in section 6 replaces it.)
alter table public.profiles drop constraint if exists profiles_name_visible;

-- =============================================================================================
-- 2. Tables
-- =============================================================================================

create table if not exists public.social_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  dm_privacy text not null default 'friends_clan' check (dm_privacy in ('friends_clan', 'friends', 'nobody')),
  updated_at timestamptz not null default now()
);

create table if not exists public.friend_codes (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists friend_codes_code on public.friend_codes (code);

-- status: pending (the recipient sees it) · declined (a 30-day tombstone: repeats are swallowed)
-- · shadow (swallowed at once: blocked pair or a "Nobody" recipient; the sender still sees
-- "Requested", so neither a block nor a setting can be told apart) · cancelled (the sender took
-- it back: asking again within a day is swallowed, so request → cancel → request cannot ping the
-- recipient over and over)
create table if not exists public.friend_requests (
  id bigint generated always as identity primary key,
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  from_name text not null default '',
  from_level int not null default 1,
  from_avatar text,
  via text not null default 'clan' check (via in ('clan', 'coop', 'code')),
  status text not null default 'pending',
  sender_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (from_id, to_id),
  check (from_id <> to_id)
);
create index if not exists friend_requests_to on public.friend_requests (to_id, status);
alter table public.friend_requests drop constraint if exists friend_requests_status_check;
alter table public.friend_requests add constraint friend_requests_status_check check (status in ('pending', 'declined', 'shadow', 'cancelled'));

-- two rows per friendship
create table if not exists public.friends (
  user_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  since timestamptz not null default now(),
  primary key (user_id, friend_id)
);
create index if not exists friends_friend on public.friends (friend_id);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
create index if not exists blocks_blocked on public.blocks (blocked_id);

-- who played co-op together lately (join_room records it; a friend request context)
create table if not exists public.coop_partners (
  user_id uuid not null references public.profiles (id) on delete cascade,
  partner_id uuid not null references public.profiles (id) on delete cascade,
  last_at timestamptz not null default now(),
  primary key (user_id, partner_id)
);

create table if not exists public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  user_lo uuid not null references public.profiles (id) on delete cascade,
  user_hi uuid not null references public.profiles (id) on delete cascade,
  last_message_id bigint not null default 0,
  last_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_lo, user_hi),
  check (user_lo < user_hi)
);
create index if not exists dm_threads_lo on public.dm_threads (user_lo, last_at desc);
create index if not exists dm_threads_hi on public.dm_threads (user_hi, last_at desc);

create table if not exists public.direct_messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references public.dm_threads (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  name text not null default '',
  level int not null default 1,
  avatar text,
  body text not null check (char_length(body) between 1 and 200),
  kind text not null default 'text' check (kind in ('text', 'invite')),
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists direct_messages_thread on public.direct_messages (thread_id, id desc);
create index if not exists direct_messages_recipient on public.direct_messages (recipient_id, id desc);
create index if not exists direct_messages_sender on public.direct_messages (sender_id, created_at desc);
create index if not exists direct_messages_time on public.direct_messages (created_at);
alter table public.direct_messages drop constraint if exists direct_messages_body_valid;
alter table public.direct_messages add constraint direct_messages_body_valid check (public.valid_dm_body(body)) not valid;
alter table public.direct_messages drop constraint if exists direct_messages_meta_valid;
alter table public.direct_messages add constraint direct_messages_meta_valid check (public.valid_dm_meta(kind, meta)) not valid;

create table if not exists public.dm_state (
  thread_id uuid not null references public.dm_threads (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_id bigint not null default 0,
  cleared_before_id bigint not null default 0,
  primary key (thread_id, user_id)
);

-- Reports for the owner (Table Editor → reports). Plain uuids, no foreign keys: a report outlives
-- deleted accounts. The evidence is built by the server (never the client's words), ≤ 8 KB.
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid,
  target_id uuid not null,
  reporter_name text not null default '',
  target_name text not null default '',
  reason text not null check (reason in ('bullying', 'inappropriate', 'spam', 'personal_info', 'other')),
  note text not null default '' check (char_length(note) <= 200),
  context text not null default 'profile' check (context in ('dm', 'global', 'clan', 'profile', 'coop')),
  message_id bigint,
  evidence jsonb,
  -- backed by contact: the target DMed / invited / friend-requested the reporter in the last 7
  -- days (recomputed on every repeat). qualified_at: when a report last counted toward an
  -- auto-mute (a repeat counts again only after NEW contact).
  qualified boolean not null default false,
  qualified_at timestamptz,
  status text not null default 'open' check (status in ('open', 'reviewed', 'actioned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- one open report per reporter and target (a repeat updates it)
create unique index if not exists reports_open_pair on public.reports (reporter_id, target_id) where status = 'open';
create index if not exists reports_target on public.reports (target_id, created_at desc);
alter table public.reports add column if not exists qualified_at timestamptz;

-- created_by 'owner' (SQL editor; also mutes chat) or 'auto' (3 qualified reporters; DMs,
-- invites and friend requests only)
create table if not exists public.social_mutes (
  user_id uuid primary key,
  until timestamptz not null,
  reason text not null default '',
  created_by text not null default 'owner' check (created_by in ('owner', 'auto')),
  created_at timestamptz not null default now()
);

-- What a clan may ask for (src/online/donateRules.js DONATE_RULES; seeded below)
create table if not exists public.donate_items (
  item text primary key,
  family text not null,
  rarity text not null,
  name text not null,
  request_size int not null,
  per_donor int not null,
  points int not null,
  weekly_max int not null default 0,
  established boolean not null default false
);

create table if not exists public.donation_requests (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid references public.clans (id) on delete set null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  user_name text not null default '',
  user_avatar text,
  item text not null references public.donate_items (item),
  wanted int not null check (wanted > 0),
  received int not null default 0 check (received >= 0),
  game_day text not null,
  status text not null default 'open' check (status in ('open', 'filled', 'cancelled')),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (user_id, game_day),
  check (received <= wanted)
);
create index if not exists donation_requests_clan on public.donation_requests (clan_id, game_day);

create table if not exists public.donations (
  id bigint generated always as identity primary key,
  request_id uuid references public.donation_requests (id) on delete set null,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  donor_id uuid references public.profiles (id) on delete set null,
  donor_name text not null default '',
  clan_id uuid references public.clans (id) on delete set null,
  item text not null,
  count int not null check (count > 0),
  points int not null check (points > 0),
  coins int not null default 0,
  game_day text not null,
  donor_key uuid not null,
  claim_key uuid,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists donations_donor_key on public.donations (donor_id, donor_key);
create index if not exists donations_unclaimed on public.donations (requester_id) where claim_key is null;
create index if not exists donations_claim on public.donations (requester_id, claim_key);
create index if not exists donations_donor_day on public.donations (donor_id, game_day);
create index if not exists donations_request on public.donations (request_id);

-- Slim key tombstones: 'applied' (what donate() did, for replays) or 'voided' (settle_donations()
-- saw the key unapplied, so a late donate() with it does nothing). Kept 90 days.
create table if not exists public.donation_keys (
  donor_id uuid not null references public.profiles (id) on delete cascade,
  key uuid not null,
  state text not null check (state in ('applied', 'voided')),
  item text,
  count int not null default 0,
  coins int not null default 0,
  created_at timestamptz not null default now(),
  primary key (donor_id, key)
);

-- When a player last left the developer clan (its Supply Bot grants any item): no donations for 7 days.
create table if not exists public.dev_lab_visits (
  user_id uuid primary key,
  left_at timestamptz not null default now()
);

-- =============================================================================================
-- 3. Row Level Security + table privileges
-- =============================================================================================

alter table public.social_settings enable row level security;
alter table public.friend_codes enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friends enable row level security;
alter table public.blocks enable row level security;
alter table public.coop_partners enable row level security;
alter table public.dm_threads enable row level security;
alter table public.direct_messages enable row level security;
alter table public.dm_state enable row level security;
alter table public.reports enable row level security;
alter table public.social_mutes enable row level security;
alter table public.donate_items enable row level security;
alter table public.donation_requests enable row level security;
alter table public.donations enable row level security;
alter table public.donation_keys enable row level security;
alter table public.dev_lab_visits enable row level security;

-- Realtime needs SELECT (+ a policy) on what it delivers; nothing else is readable directly.
drop policy if exists direct_messages_read on public.direct_messages;
create policy direct_messages_read on public.direct_messages for select to authenticated
  using (recipient_id = auth.uid() or sender_id = auth.uid());
-- only pending requests TO me: the sender never learns the recipient's id from this table, and
-- swallowed (shadow) requests are never delivered
drop policy if exists friend_requests_read on public.friend_requests;
create policy friend_requests_read on public.friend_requests for select to authenticated
  using (to_id = auth.uid() and status = 'pending');
drop policy if exists donation_requests_read on public.donation_requests;
create policy donation_requests_read on public.donation_requests for select to authenticated
  using (user_id = auth.uid() or clan_id = public.my_clan());
-- every other new table: no policies at all (functions only)

revoke all on public.social_settings, public.friend_codes, public.friend_requests, public.friends, public.blocks,
  public.coop_partners, public.dm_threads, public.direct_messages, public.dm_state, public.reports, public.social_mutes,
  public.donate_items, public.donation_requests, public.donations, public.donation_keys, public.dev_lab_visits
  from anon, authenticated;
grant select on public.direct_messages, public.friend_requests, public.donation_requests to authenticated;
-- (no insert / update / delete grant on any of them: every write is a function below)
do $$
declare
  t text;
  s text;
begin
  foreach t in array array['friend_requests', 'direct_messages', 'reports', 'donations'] loop
    s := pg_get_serial_sequence('public.' || t, 'id');
    if s is not null then execute format('revoke all on sequence %s from anon, authenticated', s); end if;
  end loop;
end $$;

-- =============================================================================================
-- 4. Internal helpers — SECURITY INVOKER: called from the entry points below they run with the
--    table owner's rights; called by a player directly they would see nothing. Revoked too.
--    Every boolean is coalesced, so a missing row can never make a check fail open.
-- =============================================================================================

create or replace function public.social_me() returns uuid
language plpgsql stable security invoker set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'forbidden: sign in first'; end if;
  return auth.uid();
end $$;

create or replace function public.social_is_blocked(a uuid, b uuid) returns boolean
language sql stable security invoker set search_path = public, pg_temp as $$
  select exists (select 1 from blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))
$$;

create or replace function public.social_are_friends(a uuid, b uuid) returns boolean
language sql stable security invoker set search_path = public, pg_temp as $$
  select exists (select 1 from friends where user_id = a and friend_id = b)
$$;

-- same non-developer clan, both members for at least p_hours
create or replace function public.social_clanmates(a uuid, b uuid, p_hours int) returns boolean
language sql stable security invoker set search_path = public, pg_temp as $$
  select coalesce(a <> b, false) and exists (
    select 1 from clan_members ma
    join clan_members mb on mb.clan_id = ma.clan_id
    join clans c on c.id = ma.clan_id
    where ma.user_id = a and mb.user_id = b and not c.is_dev
      and ma.joined_at <= now() - make_interval(hours => p_hours)
      and mb.joined_at <= now() - make_interval(hours => p_hours))
$$;

-- no settings row = the default (never "open")
create or replace function public.social_privacy(u uuid) returns text
language sql stable security invoker set search_path = public, pg_temp as $$
  select coalesce((select dm_privacy from social_settings where user_id = u), 'friends_clan')
$$;

-- does p_owner's setting let p_other contact them?
create or replace function public.social_dm_allows(p_owner uuid, p_other uuid) returns boolean
language sql stable security invoker set search_path = public, pg_temp as $$
  select coalesce(case social_privacy(p_owner)
    when 'nobody' then false
    when 'friends' then social_are_friends(p_owner, p_other)
    else social_are_friends(p_owner, p_other) or social_clanmates(p_owner, p_other, 72) end, false)
$$;

create or replace function public.social_muted(u uuid) returns boolean
language sql stable security invoker set search_path = public, pg_temp as $$
  select exists (select 1 from social_mutes where user_id = u and until > now())
$$;

-- Why p_a cannot message p_b, or null. My own side is decided first; their setting and their
-- block are deliberately the same answer ('not_allowed'). 'stranger': neither friends nor in the
-- same clan — no setting allows that, whatever either side chose (and it says nothing about the
-- other side either).
create or replace function public.social_dm_why(p_a uuid, p_b uuid) returns text
language sql stable security invoker set search_path = public, pg_temp as $$
  select case
    when p_a is null or p_b is null then 'not_allowed'
    when p_a = p_b then 'self'
    when exists (select 1 from blocks where blocker_id = p_a and blocked_id = p_b) then 'blocked_by_me'
    when social_muted(p_a) then 'muted'
    when not social_are_friends(p_a, p_b) and not social_clanmates(p_a, p_b, 0) then 'stranger'
    -- clanmates who have not both been in the clan for 3 days yet (both can see the join dates)
    when not social_dm_allows(p_a, p_b) and social_privacy(p_a) = 'friends_clan' and social_clanmates(p_a, p_b, 0) then 'clan_new'
    when not social_dm_allows(p_a, p_b) then 'my_setting'
    when exists (select 1 from blocks where blocker_id = p_b and blocked_id = p_a) or not social_dm_allows(p_b, p_a) then 'not_allowed'
    else null end
$$;

create or replace function public.social_why_text(p_why text) returns text
language sql immutable security invoker set search_path = public, pg_temp as $$
  select case p_why
    when 'self' then 'that is you'
    when 'blocked_by_me' then 'you blocked them'
    when 'muted' then 'you can''t send messages right now'
    when 'my_setting' then 'your "Who can message me" setting doesn''t include them'
    when 'stranger' then 'only friends and clanmates can message each other — add them as a friend first'
    when 'clan_new' then 'clanmates can message each other after 3 days together in the clan'
    else 'they can''t get messages from you yet' end
$$;

create or replace function public.social_friend_count(u uuid) returns int
language sql stable security invoker set search_path = public, pg_temp as $$
  select count(*)::int from friends where user_id = u
$$;

create or replace function public.social_friend_state(p_me uuid, p_other uuid) returns text
language sql stable security invoker set search_path = public, pg_temp as $$
  select case
    when social_are_friends(p_me, p_other) then 'friends'
    when exists (select 1 from friend_requests where from_id = p_other and to_id = p_me and status = 'pending') then 'incoming'
    when exists (select 1 from friend_requests where from_id = p_me and to_id = p_other and not sender_hidden) then 'requested'
    else 'none' end
$$;

-- A shared context that allows a friend request: 'clan' (same non-developer clan), 'coop' (a
-- co-op game in the last 7 days), or null (strangers need the friend code).
create or replace function public.social_friend_context(p_me uuid, p_other uuid) returns text
language sql stable security invoker set search_path = public, pg_temp as $$
  select case
    when social_clanmates(p_me, p_other, 0) then 'clan'
    when exists (select 1 from coop_partners where user_id = p_me and partner_id = p_other and last_at > now() - interval '7 days') then 'coop'
    else null end
$$;

create or replace function public.social_befriend(a uuid, b uuid) returns void
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  -- both friend lists, locked in a fixed order (no deadlock): ten accepts at once still stop at 50
  perform pg_advisory_xact_lock(hashtext('friends:' || least(a, b)::text));
  perform pg_advisory_xact_lock(hashtext('friends:' || greatest(a, b)::text));
  if social_friend_count(a) >= 50 or social_friend_count(b) >= 50 then
    raise exception 'invalid: one of you already has 50 friends';
  end if;
  insert into friends (user_id, friend_id) values (a, b), (b, a) on conflict do nothing;
  delete from friend_requests where (from_id = a and to_id = b) or (from_id = b and to_id = a);
end $$;

-- The core of a friend request (send_friend_request / add_friend_by_code). Returns the state the
-- sender sees: 'friends' or 'requested' (also when the request was swallowed).
create or replace function public.social_request_friend(p_me uuid, p_to uuid, p_via text) returns text
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_me profiles%rowtype;
  fr friend_requests%rowtype;
  v_shadow boolean;
  v_weight int;
begin
  -- one request at a time per player (both, in a fixed order: no deadlock), so the recipient's
  -- daily cap and pending queue hold when many players ask at the same moment
  perform pg_advisory_xact_lock(hashtext('friendreq:' || least(p_me, p_to)::text));
  perform pg_advisory_xact_lock(hashtext('friendreq:' || greatest(p_me, p_to)::text));
  select * into v_me from profiles where id = p_me;
  if social_are_friends(p_me, p_to) then return 'friends'; end if;
  -- they asked me already: both become friends at once
  select * into fr from friend_requests where from_id = p_to and to_id = p_me and status = 'pending' for update;
  if found then
    perform social_befriend(p_me, p_to);
    return 'friends';
  end if;
  -- asked before (pending, swallowed, declined, or cancelled less than a day ago): nothing new,
  -- never a second notification. A request cancelled a day ago or more may go out again.
  select * into fr from friend_requests where from_id = p_me and to_id = p_to for update;
  if found and fr.status = 'cancelled' and fr.created_at <= now() - interval '1 day' then
    delete from friend_requests where id = fr.id;
  elsif found then
    update friend_requests set sender_hidden = false where id = fr.id;
    return 'requested';
  end if;
  if social_friend_count(p_me) >= 50 then raise exception 'invalid: you have 50 friends — remove one first'; end if;
  -- swallowed without a trace: they blocked me, or their setting is Nobody (the code still works)
  v_shadow := social_is_blocked(p_me, p_to) or (p_via <> 'code' and social_privacy(p_to) = 'nobody');
  if not v_shadow then
    if social_friend_count(p_to) >= 50 then raise exception 'invalid: they can''t take more friends right now'; end if;
    -- at most 10 a day per recipient; a request from an account younger than a day counts twice
    select coalesce(sum(case when p.created_at > now() - interval '24 hours' then 2 else 1 end), 0) into v_weight
      from friend_requests r join profiles p on p.id = r.from_id
      where r.to_id = p_to and r.status <> 'shadow' and r.created_at > now() - interval '1 day';
    if v_weight + (case when v_me.created_at > now() - interval '24 hours' then 2 else 1 end) > 10 then
      raise exception 'invalid: they got a lot of friend requests today — try again tomorrow';
    end if;
    -- a full queue drops its oldest pending request instead of refusing new ones
    delete from friend_requests where id in (
      select id from friend_requests where to_id = p_to and status = 'pending' order by created_at desc, id desc offset 29);
  end if;
  insert into friend_requests (from_id, to_id, from_name, from_level, from_avatar, via, status)
    values (p_me, p_to, v_me.name, v_me.level, v_me.avatar, p_via, case when v_shadow then 'shadow' else 'pending' end);
  return 'requested';
end $$;

-- Find or create the conversation of two players. A new one counts against 'dm_new'.
create or replace function public.social_thread_for(a uuid, b uuid) returns uuid
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_lo uuid := least(a, b);
  v_hi uuid := greatest(a, b);
  v_id uuid;
begin
  select id into v_id from dm_threads where user_lo = v_lo and user_hi = v_hi;
  if found then return v_id; end if;
  perform enforce_rate('dm_new', 0, 10, interval '1 day');
  -- two first messages at the same moment: one insert wins, both use its thread
  insert into dm_threads (user_lo, user_hi) values (v_lo, v_hi) on conflict (user_lo, user_hi) do nothing returning id into v_id;
  if v_id is null then select id into v_id from dm_threads where user_lo = v_lo and user_hi = v_hi; end if;
  return v_id;
end $$;

-- 'open' | 'full' | 'closed' | 'expired' for a co-op invite DM, as seen by p_viewer. The room
-- must still belong to the sender (a reused code of another host reads 'closed'); its secret is
-- never exposed.
create or replace function public.social_invite_state(m public.direct_messages, p_viewer uuid) returns text
language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare
  r coop_rooms%rowtype;
  v_exp bigint;
begin
  if m.kind <> 'invite' then return null; end if;
  v_exp := (m.meta ->> 'expires')::bigint;
  if v_exp is null or (extract(epoch from now()) * 1000)::bigint > v_exp then return 'expired'; end if;
  select * into r from coop_rooms where code = m.meta ->> 'room' and host_id = m.sender_id and created_at > now() - interval '1 day';
  if not found then return 'closed'; end if;
  if r.guest_id is not null and r.guest_id is distinct from p_viewer then return 'full'; end if;
  return 'open';
end $$;

create or replace function public.social_dm_json(m public.direct_messages, p_viewer uuid) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', m.id, 'threadId', m.thread_id, 'senderId', m.sender_id, 'recipientId', m.recipient_id,
    'name', m.name, 'level', m.level, 'avatar', m.avatar, 'body', m.body, 'kind', m.kind, 'meta', m.meta,
    'createdAt', m.created_at, 'mine', coalesce(m.sender_id = p_viewer, false),
    'inviteState', social_invite_state(m, p_viewer))
$$;

create or replace function public.social_housekeeping() returns void
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  delete from direct_messages where created_at < now() - interval '14 days';
  delete from dm_threads t where t.last_at < now() - interval '14 days'
    and not exists (select 1 from direct_messages m where m.thread_id = t.id);
  delete from friend_requests where created_at < now() - interval '30 days';
  delete from coop_partners where last_at < now() - interval '7 days';
  delete from donations where (claim_key is null and created_at < now() - interval '7 days') or claimed_at < now() - interval '30 days';
  delete from donation_requests where created_at < now() - interval '14 days';
  -- a voided key only has to outlive a late donate() of the same game day; applied ones answer
  -- replays and settle_donations() for as long as a client may still ask (ESCROW_GIVE_UP_DAYS)
  delete from donation_keys where (state = 'voided' and created_at < now() - interval '2 days') or created_at < now() - interval '90 days';
  delete from social_mutes where created_by = 'auto' and until < now() - interval '30 days';
  delete from dev_lab_visits where left_at < now() - interval '7 days';
end $$;

-- After a DM / invite: the conversation's last message, my read marker, my last_active, and
-- sometimes housekeeping. No per-conversation trim: flooding a conversation must never push an
-- abusive message out of what a report can show (14 days × 300 DMs a day bound the storage).
create or replace function public.social_after_dm(m public.direct_messages) returns void
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  update dm_threads set last_message_id = m.id, last_at = m.created_at where id = m.thread_id;
  insert into dm_state (thread_id, user_id, last_read_id) values (m.thread_id, m.sender_id, m.id)
    on conflict (thread_id, user_id) do update set last_read_id = greatest(dm_state.last_read_id, excluded.last_read_id);
  update profiles set last_active = now() where id = m.sender_id;
  if random() < 0.01 then perform social_housekeeping(); end if;
end $$;

-- What the server stores as evidence: the reported message (only one the reporter could see),
-- the last DMs between the two (whatever the reporter cleared), the target's name and level.
-- At most 8 KB. Never the client's text.
create or replace function public.social_report_evidence(p_reporter uuid, p_target uuid, p_context text, p_message bigint) returns jsonb
language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare
  p profiles%rowtype;
  v_msg jsonb;
  v_dms jsonb;
  v_n int := 20;
  v jsonb;
begin
  select * into p from profiles where id = p_target;
  if p_message is not null and p_context = 'dm' then
    select jsonb_build_object('kind', 'dm', 'id', m.id, 'name', m.name, 'body', m.body, 'meta', m.meta, 'at', m.created_at) into v_msg
      from direct_messages m where m.id = p_message and m.sender_id = p_target and m.recipient_id = p_reporter;
  elsif p_message is not null and p_context in ('global', 'clan') then
    select jsonb_build_object('kind', 'chat', 'id', m.id, 'channel', m.channel, 'name', m.name, 'body', m.body, 'at', m.created_at) into v_msg
      from messages m where m.id = p_message and m.user_id = p_target
        and (m.channel = 'global' or m.channel = 'clan:' || coalesce((select clan_id::text from clan_members where user_id = p_reporter), '-'));
  end if;
  loop
    select coalesce(jsonb_agg(x order by (x ->> 'id')::bigint), '[]'::jsonb) into v_dms from (
      select jsonb_build_object('id', m.id, 'from', case when m.sender_id = p_target then 'target' else 'reporter' end,
        'name', m.name, 'body', m.body, 'kind', m.kind, 'at', m.created_at) as x
      from direct_messages m join dm_threads t on t.id = m.thread_id
      where t.user_lo = least(p_reporter, p_target) and t.user_hi = greatest(p_reporter, p_target)
      order by m.id desc limit v_n) s;
    v := jsonb_build_object('target', jsonb_build_object('id', p_target, 'name', p.name, 'level', p.level, 'createdAt', p.created_at),
      'message', v_msg, 'dms', v_dms);
    exit when pg_column_size(v) <= 8192 or v_n = 0;
    v_n := v_n / 2;
  end loop;
  return v;
end $$;

-- A report is backed by contact when the reporter's account is ≥ 7 days old and the target
-- reached them through what an auto-mute silences — a DM, a co-op invite or a friend request —
-- in the last 7 days and after p_since (the reporter's previous counted report: a repeat needs
-- new contact). Chat is no path: one public chat line is not contact, and only the owner mutes
-- chat. (A shadow request never reached the reporter; declined / cancelled ones did.)
drop function if exists public.social_qualified_reporter(uuid, uuid, text, bigint);
create or replace function public.social_qualified_reporter(p_reporter uuid, p_target uuid, p_since timestamptz) returns boolean
language sql stable security invoker set search_path = public, pg_temp as $$
  select coalesce((select created_at <= now() - interval '7 days' from profiles where id = p_reporter), false)
    and (
      exists (select 1 from direct_messages where sender_id = p_target and recipient_id = p_reporter
        and created_at > greatest(now() - interval '7 days', coalesce(p_since, '-infinity'::timestamptz)))
      or exists (select 1 from friend_requests where from_id = p_target and to_id = p_reporter and status in ('pending', 'declined', 'cancelled')
        and created_at > greatest(now() - interval '7 days', coalesce(p_since, '-infinity'::timestamptz))))
$$;

-- 3 different reporters whose report counted (qualified_at) within 24 h → no DMs, DM invites or
-- friend requests for 24 h. An owner mute is never touched.
create or replace function public.social_maybe_auto_mute(p_target uuid) returns void
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_n int;
  mu social_mutes%rowtype;
begin
  select count(distinct reporter_id) into v_n from reports
    where target_id = p_target and status = 'open' and qualified_at > now() - interval '24 hours';
  if v_n < 3 then return; end if;
  select * into mu from social_mutes where user_id = p_target;
  if found and mu.until > now() and (mu.created_by = 'owner' or mu.until >= now() + interval '23 hours') then return; end if;
  insert into social_mutes (user_id, until, reason, created_by) values (p_target, now() + interval '24 hours', 'auto: ' || v_n || ' reports', 'auto')
    on conflict (user_id) do update set until = excluded.until, reason = excluded.reason, created_by = 'auto', created_at = now();
end $$;

create or replace function public.social_clan_established(p_clan uuid) returns boolean
language sql stable security invoker set search_path = public, pg_temp as $$
  select coalesce((select c.created_at <= now() - interval '14 days' from clans c where c.id = p_clan), false)
    and (select count(*) from clan_members where clan_id = p_clan and joined_at <= now() - interval '72 hours') >= 5
$$;

create or replace function public.social_request_json(r public.donation_requests, p_viewer uuid) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', r.id, 'clanId', r.clan_id, 'userId', r.user_id, 'name', r.user_name, 'avatar', r.user_avatar,
    'item', r.item, 'wanted', r.wanted, 'received', r.received, 'status', r.status, 'gameDay', r.game_day,
    'createdAt', r.created_at,
    -- a requester who blocked the viewer: closed for them (donate() says the same)
    'open', r.status = 'open' and r.game_day = game_day_key(now())
      and not exists (select 1 from blocks b where b.blocker_id = r.user_id and b.blocked_id = p_viewer),
    'perDonor', d.per_donor, 'points', d.points,
    'myGiven', coalesce((select sum(count) from donations x where x.request_id = r.id and x.donor_id = p_viewer), 0),
    'donors', coalesce((select jsonb_agg(n order by first_id) from (
      select min(x.id) as first_id, x.donor_name as n from donations x where x.request_id = r.id group by x.donor_id, x.donor_name) s), '[]'::jsonb))
  from donate_items d where d.item = r.item
$$;

-- =============================================================================================
-- 5. Entry points (SECURITY DEFINER, explicit auth.uid() checks, granted to signed-in players)
-- =============================================================================================

-- The frontend's deploy probe: "needs the latest server update" until this exists.
create or replace function public.social_version() returns int
language sql immutable as $$ select 1 $$;

-- Badge counts for the lobby, the Menu and the clan tile.
create or replace function public.social_summary() returns json
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
begin
  return json_build_object(
    'unreadDms', (select count(*) from direct_messages m
        left join dm_state s on s.thread_id = m.thread_id and s.user_id = v_me
        where m.recipient_id = v_me and m.id > greatest(coalesce(s.last_read_id, 0), coalesce(s.cleared_before_id, 0))
          and not exists (select 1 from blocks b where b.blocker_id = v_me and b.blocked_id = m.sender_id)),
    'friendRequests', (select count(*) from friend_requests where to_id = v_me and status = 'pending'),
    'donationsReady', (select coalesce(sum(count), 0) from donations where requester_id = v_me and claim_key is null and created_at > now() - interval '7 days'),
    'privacy', social_privacy(v_me));
end $$;

-- The card behind a tapped name. Nothing about the other player's settings or blocks leaks:
-- `why` is one of self / blocked_by_me / muted / my_setting / clan_new / name / not_allowed.
create or replace function public.player_card(p_user uuid) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  p profiles%rowtype;
  c clans%rowtype;
  v_mate boolean;
  v_why text;
  v_fwhy text;
  v_state text;
  v_ctx text;
begin
  select * into p from profiles where id = p_user;
  if not found then raise exception 'not_found: that player is gone'; end if;
  perform enforce_rate('card', 0, 120, interval '1 hour');
  -- the developer clan stays hidden unless the viewer is in it (like clans_read)
  select c2.* into c from clan_members m join clans c2 on c2.id = m.clan_id
    where m.user_id = p_user and (not c2.is_dev or c2.id = public.my_clan());
  v_mate := social_clanmates(v_me, p_user, 0);
  v_why := social_dm_why(v_me, p_user);
  if v_why is null and not (select social_name_ok(name) from profiles where id = v_me) then v_why := 'name'; end if;
  v_state := social_friend_state(v_me, p_user);
  v_ctx := social_friend_context(v_me, p_user);
  v_fwhy := case
    when p_user = v_me then 'self'
    when exists (select 1 from blocks where blocker_id = v_me and blocked_id = p_user) then 'blocked_by_me'
    when social_muted(v_me) then 'muted'
    when v_state <> 'none' then null
    when not (select social_name_ok(name) from profiles where id = v_me) then 'name'
    when v_ctx is null then 'context'
    when social_friend_count(v_me) >= 50 then 'full'
    else null end;
  return json_build_object(
    'userId', p.id, 'name', p.name, 'level', p.level, 'avatar', p.avatar,
    'clan', case when c.id is null then null else json_build_object('id', c.id, 'name', c.name, 'tag', c.tag) end,
    'clanmate', v_mate,
    -- presence only for friends and clanmates (cosmetic: profiles.last_active is readable anyway)
    'lastActive', case when p_user = v_me or v_mate or social_are_friends(v_me, p_user) then p.last_active end,
    'isSelf', p_user = v_me,
    'friend', v_state,
    'requestId', case v_state
      when 'incoming' then (select id from friend_requests where from_id = p_user and to_id = v_me and status = 'pending')
      when 'requested' then (select id from friend_requests where from_id = v_me and to_id = p_user) end,
    'blockedByMe', exists (select 1 from blocks where blocker_id = v_me and blocked_id = p_user),
    'canMessage', v_why is null, 'why', v_why,
    -- my own setting (the card explains 'my_setting' with it); never the other player's
    'myPrivacy', social_privacy(v_me),
    'canFriend', v_state = 'none' and v_fwhy is null, 'friendWhy', v_fwhy,
    'threadId', (select id from dm_threads where user_lo = least(v_me, p_user) and user_hi = greatest(v_me, p_user)));
end $$;

create or replace function public.set_dm_privacy(p_value text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
begin
  if p_value is null or p_value not in ('friends_clan', 'friends', 'nobody') then raise exception 'invalid: unknown setting'; end if;
  perform enforce_rate('settings', 0, 20, interval '1 hour');
  insert into social_settings (user_id, dm_privacy, updated_at) values (v_me, p_value, now())
    on conflict (user_id) do update set dm_privacy = excluded.dm_privacy, updated_at = now();
  -- requests swallowed only because of "Nobody" may be sent again
  if p_value <> 'nobody' then
    delete from friend_requests r where r.to_id = v_me and r.status = 'shadow' and not social_is_blocked(r.from_id, v_me);
  end if;
end $$;

-- My own friend code (8 characters of the 32-letter alphabet, 40 bits), created on first use.
create or replace function public.my_friend_code() returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  v_code text;
begin
  select code into v_code from friend_codes where user_id = v_me;
  if not found then
    loop
      v_code := random_code(8);
      exit when not exists (select 1 from friend_codes where code = v_code);
    end loop;
    insert into friend_codes (user_id, code) values (v_me, v_code) on conflict (user_id) do nothing;
    select code into v_code from friend_codes where user_id = v_me;
  end if;
  return json_build_object('code', v_code);
end $$;

create or replace function public.reset_friend_code() returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
begin
  perform enforce_rate('settings', 0, 20, interval '1 hour');
  delete from friend_codes where user_id = v_me;
  return my_friend_code();
end $$;

create or replace function public.send_friend_request(p_user uuid) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  v_ctx text;
begin
  if p_user is null or p_user = v_me then raise exception 'invalid: that is you'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'not_found: that player is gone'; end if;
  if social_muted(v_me) then raise exception 'forbidden: you can''t send friend requests right now'; end if;
  if not (select social_name_ok(name) from profiles where id = v_me) then raise exception 'invalid: change your online name first'; end if;
  if exists (select 1 from blocks where blocker_id = v_me and blocked_id = p_user) then raise exception 'invalid: unblock them first'; end if;
  perform enforce_rate('friend', 0, 10, interval '1 hour');
  if social_are_friends(v_me, p_user) then return json_build_object('state', 'friends'); end if;
  v_ctx := social_friend_context(v_me, p_user);
  if v_ctx is null and not exists (select 1 from friend_requests where from_id = p_user and to_id = v_me and status = 'pending') then
    raise exception 'forbidden: ask for their friend code';
  end if;
  return json_build_object('state', social_request_friend(v_me, p_user, coalesce(v_ctx, 'clan')));
end $$;

-- Returns {name, level, avatar, state} or {error}. (No account id in the answer — though a code
-- is no secret identity: profiles rows are readable, so name + level + avatar can point to the
-- account. The code only decides who may ASK.) Every try counts BEFORE the lookup and a miss is
-- returned (not raised), so the counted try commits.
create or replace function public.add_friend_by_code(p_code text) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_to uuid;
  p profiles%rowtype;
  v_state text;
begin
  if social_muted(v_me) then raise exception 'forbidden: you can''t send friend requests right now'; end if;
  if not (select social_name_ok(name) from profiles where id = v_me) then raise exception 'invalid: change your online name first'; end if;
  perform enforce_rate('friend', 0, 10, interval '1 hour');
  select user_id into v_to from friend_codes where code = v_code;
  if not found then return json_build_object('error', 'not_found'); end if;
  if v_to = v_me then return json_build_object('error', 'self'); end if;
  if exists (select 1 from blocks where blocker_id = v_me and blocked_id = v_to) then return json_build_object('error', 'blocked_by_me'); end if;
  v_state := social_request_friend(v_me, v_to, 'code');
  select * into p from profiles where id = v_to;
  return json_build_object('name', p.name, 'level', p.level, 'avatar', p.avatar, 'state', v_state);
end $$;

create or replace function public.answer_friend_request(p_id bigint, p_accept boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  fr friend_requests%rowtype;
begin
  select * into fr from friend_requests where id = p_id and to_id = v_me and status = 'pending' for update;
  if not found then raise exception 'not_found: that request is gone'; end if;
  if p_accept then
    perform social_befriend(v_me, fr.from_id);
  else
    -- the tombstone: repeats from this sender are swallowed for 30 days
    update friend_requests set status = 'declined', created_at = now() where id = fr.id;
  end if;
end $$;

create or replace function public.cancel_friend_request(p_id bigint) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  fr friend_requests%rowtype;
begin
  select * into fr from friend_requests where id = p_id and from_id = v_me for update;
  if not found then raise exception 'not_found: that request is gone'; end if;
  -- the row stays as a tombstone (the recipient no longer sees it): asking again within a day is
  -- swallowed, so request → cancel → request cannot notify them again and again
  if fr.status = 'pending' then
    update friend_requests set status = 'cancelled', sender_hidden = true, created_at = now() where id = fr.id;
  else
    update friend_requests set sender_hidden = true where id = fr.id; -- declined / swallowed / cancelled stay as they are
  end if;
end $$;

create or replace function public.remove_friend(p_user uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
begin
  delete from friends where (user_id = v_me and friend_id = p_user) or (user_id = p_user and friend_id = v_me);
end $$;

create or replace function public.list_friends() returns json
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
begin
  return (select coalesce(json_agg(x order by x.online desc, lower(x.name)), '[]'::json) from (
    select p.id as "userId", p.name, p.level, p.avatar, p.last_active as "lastActive",
      p.last_active > now() - interval '5 minutes' as online, f.since, social_dm_why(v_me, p.id) is null as "canMessage"
    from friends f join profiles p on p.id = f.friend_id where f.user_id = v_me) x);
end $$;

-- The co-op room lobby's "Invite a friend" list: my friends and my clanmates (never the
-- developer clan's), online first, each with whether a DM invite can reach them. Nobody I blocked.
create or replace function public.invite_candidates() returns json
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
begin
  return (select coalesce(json_agg(x order by x.online desc, x.friend desc, lower(x.name)), '[]'::json) from (
    select p.id as "userId", p.name, p.level, p.avatar, p.last_active as "lastActive",
      coalesce(p.last_active > now() - interval '5 minutes', false) as online,
      social_are_friends(v_me, p.id) as friend, social_dm_why(v_me, p.id) is null as "canMessage"
    from profiles p
    where p.id <> v_me
      and (exists (select 1 from friends f where f.user_id = v_me and f.friend_id = p.id)
        or exists (select 1 from clan_members ma join clan_members mb on mb.clan_id = ma.clan_id join clans c on c.id = ma.clan_id
          where ma.user_id = v_me and mb.user_id = p.id and not c.is_dev))
      and not exists (select 1 from blocks b where b.blocker_id = v_me and b.blocked_id = p.id)
    order by p.last_active desc nulls last
    limit 80) x);
end $$;

-- incoming: who asked me (with the name stamped when they asked); outgoing: without the
-- recipients' account ids (swallowed and declined ones look like pending ones)
create or replace function public.list_friend_requests() returns json
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
begin
  return json_build_object(
    'incoming', (select coalesce(json_agg(x order by x.at desc), '[]'::json) from (
      select r.id, r.from_id as "userId", r.from_name as name, r.from_level as level, r.from_avatar as avatar, r.via, r.created_at as at
      from friend_requests r where r.to_id = v_me and r.status = 'pending') x),
    'outgoing', (select coalesce(json_agg(x order by x.at desc), '[]'::json) from (
      select r.id, p.name, p.level, p.avatar, r.created_at as at
      from friend_requests r join profiles p on p.id = r.to_id where r.from_id = v_me and not r.sender_hidden) x));
end $$;

create or replace function public.block_player(p_user uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
begin
  if p_user is null or p_user = v_me then raise exception 'invalid: that is you'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'not_found: that player is gone'; end if;
  perform enforce_rate('block', 0, 30, interval '1 hour');
  if not exists (select 1 from blocks where blocker_id = v_me and blocked_id = p_user)
     and (select count(*) from blocks where blocker_id = v_me) >= 200 then
    raise exception 'invalid: you blocked 200 players — unblock someone first';
  end if;
  insert into blocks (blocker_id, blocked_id) values (v_me, p_user) on conflict do nothing;
  delete from friends where (user_id = v_me and friend_id = p_user) or (user_id = p_user and friend_id = v_me);
  -- their requests to me go; my pending request to them is withdrawn as a tombstone. Every
  -- tombstone stays (declined / cancelled / swallowed): a block + unblock must never reset the
  -- other player's "30 days quiet" after they declined me
  delete from friend_requests where from_id = p_user and to_id = v_me and status in ('pending', 'shadow');
  update friend_requests set status = 'cancelled', sender_hidden = true, created_at = now()
    where from_id = v_me and to_id = p_user and status = 'pending';
end $$;

create or replace function public.unblock_player(p_user uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
begin
  perform enforce_rate('block', 0, 30, interval '1 hour');
  delete from blocks where blocker_id = v_me and blocked_id = p_user;
  delete from friend_requests where from_id = p_user and to_id = v_me and status = 'shadow';
end $$;

create or replace function public.list_blocked() returns json
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
begin
  return (select coalesce(json_agg(x order by x.at desc), '[]'::json) from (
    select p.id as "userId", p.name, p.level, p.avatar, b.created_at as at
    from blocks b join profiles p on p.id = b.blocked_id where b.blocker_id = v_me) x);
end $$;

create or replace function public.send_dm(p_to uuid, p_body text) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  me profiles%rowtype;
  v_body text := btrim(coalesce(p_body, ''));
  v_why text;
  m direct_messages%rowtype;
begin
  select * into me from profiles where id = v_me;
  if not found then raise exception 'forbidden: create a profile first'; end if;
  if not exists (select 1 from profiles where id = p_to) then raise exception 'not_found: that player is gone'; end if;
  if char_length(v_body) not between 1 and 200 then raise exception 'invalid: messages are 1–200 characters'; end if;
  if not valid_dm_body(v_body) then raise exception 'invalid: messages can''t contain invisible characters'; end if;
  v_why := social_dm_why(v_me, p_to);
  if v_why is not null then raise exception 'forbidden: %', social_why_text(v_why); end if;
  if not social_name_ok(me.name) then raise exception 'invalid: change your online name first'; end if;
  perform enforce_rate('dm', 2000, 20, interval '1 minute');
  perform enforce_rate('dm_day', 0, 300, interval '1 day');
  insert into direct_messages (thread_id, sender_id, recipient_id, name, level, avatar, body, kind)
    values (social_thread_for(v_me, p_to), v_me, p_to, me.name, me.level, me.avatar, v_body, 'text')
    returning * into m;
  perform social_after_dm(m);
  return social_dm_json(m, v_me);
end $$;

-- A co-op invite by DM: only the host of an open room with a free seat; the server writes the
-- text and the expiry (now + 15 min); one live invite per pair (a new one expires the last).
create or replace function public.send_coop_invite(p_to uuid, p_room text, p_stage text, p_difficulty text) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  me profiles%rowtype;
  r coop_rooms%rowtype;
  v_why text;
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
  v_oldest timestamptz;
  m direct_messages%rowtype;
begin
  select * into me from profiles where id = v_me;
  if not found then raise exception 'forbidden: create a profile first'; end if;
  if not exists (select 1 from profiles where id = p_to) then raise exception 'not_found: that player is gone'; end if;
  v_why := social_dm_why(v_me, p_to);
  if v_why is not null then raise exception 'forbidden: %', social_why_text(v_why); end if;
  if not social_name_ok(me.name) then raise exception 'invalid: change your online name first'; end if;
  if coalesce(p_stage, '') !~ '^[0-9]{1,2}-[0-9]{1,2}$' then raise exception 'invalid: pick a campaign stage'; end if;
  if coalesce(p_difficulty, '') not in ('easy', 'normal', 'hard', 'nightmare') then raise exception 'invalid: unknown difficulty'; end if;
  select * into r from coop_rooms where code = upper(trim(coalesce(p_room, ''))) and host_id = v_me and created_at > now() - interval '1 day';
  if not found then raise exception 'invalid: open your co-op room first'; end if;
  if r.guest_id is not null then raise exception 'invalid: your room already has two players'; end if;
  -- at most 4 invites an hour to the same player
  select min(created_at) into v_oldest from (
    select created_at from direct_messages where sender_id = v_me and recipient_id = p_to and kind = 'invite'
      and created_at > now() - interval '1 hour' order by created_at desc limit 4) x having count(*) >= 4;
  if v_oldest is not null then
    raise exception 'rate_limited:%', greatest(1000, ceil(extract(epoch from (v_oldest + interval '1 hour' - now())) * 1000))::bigint;
  end if;
  perform enforce_rate('invite', 5000, 20, interval '1 hour');
  perform enforce_rate('dm_day', 0, 300, interval '1 day');
  update direct_messages set meta = jsonb_set(meta, '{expires}', to_jsonb(v_now - 1))
    where sender_id = v_me and recipient_id = p_to and kind = 'invite' and (meta ->> 'expires')::bigint > v_now;
  insert into direct_messages (thread_id, sender_id, recipient_id, name, level, avatar, body, kind, meta)
    values (social_thread_for(v_me, p_to), v_me, p_to, me.name, me.level, me.avatar,
      'Co-op invite: stage ' || p_stage || ' (' || initcap(p_difficulty) || ')', 'invite',
      jsonb_build_object('room', r.code, 'stage', p_stage, 'difficulty', p_difficulty, 'expires', v_now + 900000))
    returning * into m;
  perform social_after_dm(m);
  return social_dm_json(m, v_me);
end $$;

-- My conversations, newest first: peer, last message, unread count, whether I may write.
-- Conversations I cleared (no newer message) and peers I blocked are hidden.
create or replace function public.dm_inbox(p_limit int) returns json
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  v_threads json;
begin
  with t as (
    select th.id, th.last_message_id, th.last_at,
      case when th.user_lo = v_me then th.user_hi else th.user_lo end as peer_id,
      coalesce(s.last_read_id, 0) as read_id, coalesce(s.cleared_before_id, 0) as cleared
    from dm_threads th left join dm_state s on s.thread_id = th.id and s.user_id = v_me
    where th.user_lo = v_me or th.user_hi = v_me
  ), v as (
    select t.* from t
    where t.last_message_id > t.cleared
      and not exists (select 1 from blocks b where b.blocker_id = v_me and b.blocked_id = t.peer_id)
    order by t.last_at desc limit least(greatest(coalesce(p_limit, 50), 1), 50)
  )
  select coalesce(json_agg(json_build_object(
      'id', v.id,
      'peer', json_build_object('userId', p.id, 'name', p.name, 'level', p.level, 'avatar', p.avatar),
      'last', (select social_dm_json(m, v_me) from direct_messages m where m.thread_id = v.id and m.id > v.cleared order by m.id desc limit 1),
      'unread', (select count(*) from direct_messages m where m.thread_id = v.id and m.recipient_id = v_me and m.id > greatest(v.read_id, v.cleared)),
      'canMessage', social_dm_why(v_me, v.peer_id) is null,
      'lastAt', v.last_at) order by v.last_at desc), '[]'::json)
    into v_threads
    from v join profiles p on p.id = v.peer_id;
  return json_build_object('threads', v_threads,
    'unread', (select coalesce(sum((x ->> 'unread')::int), 0) from json_array_elements(v_threads) x));
end $$;

-- One page of a conversation, newest first (p_before = the oldest id already shown).
create or replace function public.dm_history(p_thread uuid, p_before bigint, p_limit int) returns json
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  th dm_threads%rowtype;
  v_peer uuid;
  v_cleared bigint;
  v_lim int := least(greatest(coalesce(p_limit, 30), 1), 50);
  v_list json;
  v_min bigint;
  p profiles%rowtype;
  v_why text;
begin
  select * into th from dm_threads where id = p_thread and (user_lo = v_me or user_hi = v_me);
  if not found then raise exception 'not_found: that conversation is gone'; end if;
  v_peer := case when th.user_lo = v_me then th.user_hi else th.user_lo end;
  select coalesce((select cleared_before_id from dm_state where thread_id = th.id and user_id = v_me), 0) into v_cleared;
  select coalesce(json_agg(social_dm_json(m, v_me) order by m.id desc), '[]'::json), min(m.id) into v_list, v_min
    from direct_messages m where m.id in (
      select id from direct_messages where thread_id = th.id and id > v_cleared and (p_before is null or id < p_before)
      order by id desc limit v_lim);
  select * into p from profiles where id = v_peer;
  v_why := social_dm_why(v_me, v_peer);
  if v_why is null and not (select social_name_ok(name) from profiles where id = v_me) then v_why := 'name'; end if;
  return json_build_object('threadId', th.id,
    'peer', json_build_object('userId', p.id, 'name', p.name, 'level', p.level, 'avatar', p.avatar),
    'canMessage', v_why is null, 'why', v_why, 'myPrivacy', social_privacy(v_me), 'friend', social_are_friends(v_me, v_peer), 'messages', v_list,
    'hasMore', v_min is not null and exists (select 1 from direct_messages where thread_id = th.id and id > v_cleared and id < v_min));
end $$;

create or replace function public.dm_mark_read(p_thread uuid, p_last bigint) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  th dm_threads%rowtype;
begin
  select * into th from dm_threads where id = p_thread and (user_lo = v_me or user_hi = v_me);
  if not found then raise exception 'not_found: that conversation is gone'; end if;
  insert into dm_state (thread_id, user_id, last_read_id) values (th.id, v_me, greatest(0, least(coalesce(p_last, 0), th.last_message_id)))
    on conflict (thread_id, user_id) do update set last_read_id = greatest(dm_state.last_read_id, excluded.last_read_id);
end $$;

-- "Clear chat": hides the history for me only; the other side keeps theirs (reports still see it).
create or replace function public.dm_clear(p_thread uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  th dm_threads%rowtype;
begin
  select * into th from dm_threads where id = p_thread and (user_lo = v_me or user_hi = v_me);
  if not found then raise exception 'not_found: that conversation is gone'; end if;
  insert into dm_state (thread_id, user_id, last_read_id, cleared_before_id) values (th.id, v_me, th.last_message_id, th.last_message_id)
    on conflict (thread_id, user_id) do update set cleared_before_id = greatest(dm_state.cleared_before_id, excluded.cleared_before_id),
      last_read_id = greatest(dm_state.last_read_id, excluded.last_read_id);
end $$;

create or replace function public.invite_state(p_message bigint) returns text
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  m direct_messages%rowtype;
begin
  select * into m from direct_messages where id = p_message and (sender_id = v_me or recipient_id = v_me);
  if not found then raise exception 'not_found: that invite is gone'; end if;
  return coalesce(social_invite_state(m, v_me), 'closed');
end $$;

-- The host left the room lobby: their DM invites into that room expire now, so the invited player
-- sees "Expired" instead of joining an empty room and waiting. Returns how many expired.
create or replace function public.expire_coop_invites(p_room text) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
  v_n int;
begin
  update direct_messages set meta = jsonb_set(meta, '{expires}', to_jsonb(v_now - 1))
    where sender_id = v_me and kind = 'invite' and created_at > now() - interval '20 minutes'
      and meta ->> 'room' = upper(trim(coalesce(p_room, ''))) and (meta ->> 'expires')::bigint > v_now;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.report_player(p_target uuid, p_reason text, p_note text, p_context text, p_message bigint) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  p profiles%rowtype;
  v_note text := btrim(coalesce(p_note, ''));
  v_ctx text := coalesce(p_context, 'profile');
  v_prev timestamptz;
  v_recent boolean;
  v_new boolean;
begin
  if p_target is null or p_target = v_me then raise exception 'invalid: you can''t report yourself'; end if;
  select * into p from profiles where id = p_target;
  if not found then raise exception 'not_found: that player is gone'; end if;
  if p_reason is null or p_reason not in ('bullying', 'inappropriate', 'spam', 'personal_info', 'other') then raise exception 'invalid: pick a reason'; end if;
  if v_ctx not in ('dm', 'global', 'clan', 'profile', 'coop') then raise exception 'invalid: unknown place'; end if;
  if char_length(v_note) > 200 or (v_note <> '' and not valid_dm_body(v_note)) then raise exception 'invalid: notes are up to 200 visible characters'; end if;
  perform enforce_rate('report', 10000, 10, interval '1 day');
  -- backed by contact in the last 7 days (recomputed every time) · counts toward an auto-mute
  -- again only with contact after my previous counted report
  select qualified_at into v_prev from reports where reporter_id = v_me and target_id = p_target and status = 'open';
  v_recent := social_qualified_reporter(v_me, p_target, null);
  v_new := v_recent and (v_prev is null or social_qualified_reporter(v_me, p_target, v_prev));
  insert into reports (reporter_id, target_id, reporter_name, target_name, reason, note, context, message_id, evidence, qualified, qualified_at)
    values (v_me, p_target, coalesce((select name from profiles where id = v_me), ''), p.name, p_reason, v_note, v_ctx, p_message,
      social_report_evidence(v_me, p_target, v_ctx, p_message), v_recent, case when v_new then now() else v_prev end)
    on conflict (reporter_id, target_id) where status = 'open' do update set
      reason = excluded.reason, note = excluded.note, context = excluded.context, message_id = excluded.message_id,
      evidence = excluded.evidence, target_name = excluded.target_name, qualified = excluded.qualified,
      qualified_at = excluded.qualified_at, updated_at = now();
  perform social_maybe_auto_mute(p_target);
end $$;

-- ---- clan material requests + donations ------------------------------------------------------

-- Everything the Clan → Requests tab shows, on the server's clock (today, next reset, now).
create or replace function public.donation_state() returns json
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  v_day text := game_day_key(now());
  m clan_members%rowtype;
  c clans%rowtype;
  me profiles%rowtype;
  v_req_why text;
  v_don_why text;
  v_in boolean;
begin
  select * into me from profiles where id = v_me;
  select * into m from clan_members where user_id = v_me;
  v_in := found;
  if v_in then select * into c from clans where id = m.clan_id; end if;
  v_req_why := case
    when not v_in then 'no_clan'
    when c.is_dev then 'dev'
    when exists (select 1 from donation_requests where user_id = v_me and game_day = v_day) then 'used'
    when m.joined_at > now() - interval '24 hours' then 'tenure'
    else null end;
  v_don_why := case
    when not v_in then 'no_clan'
    when c.is_dev then 'dev'
    when m.joined_at > now() - interval '72 hours' then 'tenure'
    when coalesce(me.created_at > now() - interval '7 days', true) then 'account'
    when exists (select 1 from dev_lab_visits where user_id = v_me and left_at > now() - interval '7 days') then 'dev_lab'
    else null end;
  return json_build_object(
    'today', v_day,
    'nextReset', (extract(epoch from next_game_reset()) * 1000)::bigint,
    'serverNow', (extract(epoch from now()) * 1000)::bigint,
    'cap', 30,
    'donatedToday', (select coalesce(sum(points), 0) from donations where donor_id = v_me and game_day = v_day),
    'clanId', case when v_in and not c.is_dev then c.id end,
    'clanLevel', case when v_in then clan_level(c.xp) end,
    'canRequest', v_req_why is null, 'requestWhy', v_req_why,
    'canDonate', v_don_why is null, 'donateWhy', v_don_why,
    'tenureReadyAt', case when v_in then m.joined_at + interval '72 hours' end,
    'requestReadyAt', case when v_in then m.joined_at + interval '24 hours' end,
    'mythicOpen', v_in and not c.is_dev and social_clan_established(c.id),
    'weekly', json_build_object(
      'superRare', (select count(*) from donation_requests r join donate_items d on d.item = r.item where r.user_id = v_me and d.rarity = 'superRare' and r.created_at > now() - interval '7 days'),
      'mythic', (select count(*) from donation_requests r join donate_items d on d.item = r.item where r.user_id = v_me and d.rarity = 'mythic' and r.created_at > now() - interval '7 days')),
    'myRequest', (select social_request_json(r, v_me) from donation_requests r where r.user_id = v_me and r.game_day = v_day),
    'requests', case when v_in and not c.is_dev then (
      select coalesce(jsonb_agg(social_request_json(r, v_me) order by r.created_at), '[]'::jsonb) from donation_requests r
      where r.clan_id = c.id and r.game_day = v_day and r.status = 'open' and r.user_id <> v_me
        and exists (select 1 from clan_members cm where cm.user_id = r.user_id and cm.clan_id = c.id)
        -- only players I blocked are hidden (one who blocked me shows, closed: hiding it would
        -- tell them, since clanmates see it and the clan chat announced it)
        and not exists (select 1 from blocks b where b.blocker_id = v_me and b.blocked_id = r.user_id)) else '[]'::jsonb end,
    'collectable', (select coalesce(json_agg(json_build_object('item', x.item, 'count', x.n) order by x.item), '[]'::json) from (
      select item, sum(count)::int as n from donations where requester_id = v_me and claim_key is null and created_at > now() - interval '7 days' group by item) x));
end $$;

-- Ask my clan for one material, once per game day (across clans; cancelling does not give the
-- slot back). Errors: daily_limit:<ms to 7 PM Central> when today's request is used.
create or replace function public.request_materials(p_item text) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  v_day text := game_day_key(now());
  m clan_members%rowtype;
  c clans%rowtype;
  di donate_items%rowtype;
  me profiles%rowtype;
  r donation_requests%rowtype;
begin
  select * into m from clan_members where user_id = v_me;
  if not found then raise exception 'not_member: join a clan first'; end if;
  select * into c from clans where id = m.clan_id;
  if c.is_dev then raise exception 'forbidden: material requests are not part of the developer clan'; end if;
  if m.joined_at > now() - interval '24 hours' then raise exception 'forbidden: you can ask after a day in the clan'; end if;
  select * into di from donate_items where item = p_item;
  if not found then raise exception 'invalid: that item can''t be requested'; end if;
  if exists (select 1 from donation_requests where user_id = v_me and game_day = v_day) then
    raise exception 'daily_limit:%', ms_to_game_reset();
  end if;
  if di.weekly_max > 0 and (select count(*) from donation_requests x join donate_items d on d.item = x.item
      where x.user_id = v_me and d.rarity = di.rarity and x.created_at > now() - interval '7 days') >= di.weekly_max then
    raise exception 'invalid: you can ask for % materials % time(s) a week', case di.rarity when 'superRare' then 'super rare' else di.rarity end, di.weekly_max;
  end if;
  if di.established and not social_clan_established(c.id) then
    raise exception 'invalid: mythic requests open when your clan is 14 days old with 5 members of 3+ days';
  end if;
  select * into me from profiles where id = v_me;
  begin
    insert into donation_requests (clan_id, user_id, user_name, user_avatar, item, wanted, game_day)
      values (c.id, v_me, me.name, me.avatar, di.item, di.request_size, v_day) returning * into r;
  exception when unique_violation then
    raise exception 'daily_limit:%', ms_to_game_reset();
  end;
  perform system_message('clan:' || c.id::text, me.name || ' asks for ' || di.request_size || ' × ' || di.name || '. Clan → Requests to help!');
  return social_request_json(r, v_me);
end $$;

create or replace function public.cancel_material_request() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
begin
  update donation_requests set status = 'cancelled', closed_at = now()
    where user_id = v_me and game_day = game_day_key(now()) and status = 'open';
  if not found then raise exception 'not_found: no open request today'; end if;
end $$;

-- Donate p_count pieces to a clanmate's request. Idempotent by p_key: the per-player lock is
-- taken FIRST, then the key's tombstone decides (applied → the same answer again, voided →
-- nothing). Every refusal is a 'code: detail' (definitive: the client refunds at once).
create or replace function public.donate(p_request uuid, p_count int, p_key uuid) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  v_day text := game_day_key(now());
  dk donation_keys%rowtype;
  r donation_requests%rowtype;
  di donate_items%rowtype;
  m clan_members%rowtype;
  me profiles%rowtype;
  d donations%rowtype;
  v_given int;
  v_today int;
  v_points int;
  v_names text[];
begin
  if p_key is null then raise exception 'invalid: missing donation key'; end if;
  perform pg_advisory_xact_lock(hashtext(v_me::text || ':donate'));
  select * into dk from donation_keys where donor_id = v_me and key = p_key;
  if found then
    if dk.state = 'voided' then return json_build_object('key', p_key, 'voided', true); end if;
    select * into r from donation_requests where id = (select request_id from donations where donor_id = v_me and donor_key = p_key);
    return json_build_object('key', p_key, 'item', dk.item, 'count', dk.count,
      'points', dk.count * coalesce((select points from donate_items where item = dk.item), 0),
      'reward', json_build_object('coins', dk.coins), 'replayed', true,
      'request', case when r.id is null then null else social_request_json(r, v_me) end,
      'donatedToday', (select coalesce(sum(points), 0) from donations where donor_id = v_me and game_day = v_day), 'cap', 30);
  end if;
  if p_count is null or p_count < 1 or p_count > 100 then raise exception 'invalid: pick how many to give'; end if;
  select * into r from donation_requests where id = p_request for update;
  if not found then raise exception 'not_found: that request is gone'; end if;
  if r.user_id = v_me then raise exception 'invalid: you can''t donate to your own request'; end if;
  select * into m from clan_members where user_id = v_me;
  if not found or r.clan_id is null or m.clan_id <> r.clan_id then raise exception 'not_member: that request is from another clan'; end if;
  if r.status = 'filled' then raise exception 'invalid: that request is already filled'; end if;
  -- a block (either way) reads exactly like a closed request: the blocked player is never told
  if r.status <> 'open' or r.game_day <> v_day
     or not exists (select 1 from clan_members where user_id = r.user_id and clan_id = r.clan_id)
     or social_is_blocked(v_me, r.user_id) then
    raise exception 'invalid: that request is closed';
  end if;
  select * into me from profiles where id = v_me;
  if m.joined_at > now() - interval '72 hours' then raise exception 'forbidden: you can donate after 3 days in the clan'; end if;
  if coalesce(me.created_at > now() - interval '7 days', true) then raise exception 'forbidden: new online accounts can donate after 7 days'; end if;
  if exists (select 1 from dev_lab_visits where user_id = v_me and left_at > now() - interval '7 days') then
    raise exception 'forbidden: no donations for a week after leaving the developer clan';
  end if;
  select * into di from donate_items where item = r.item;
  if p_count > r.wanted - r.received then raise exception 'invalid: that request needs only % more', r.wanted - r.received; end if;
  select coalesce(sum(count), 0) into v_given from donations where request_id = r.id and donor_id = v_me;
  if v_given + p_count > di.per_donor then raise exception 'invalid: you can give at most % to one request', di.per_donor; end if;
  v_points := p_count * di.points;
  select coalesce(sum(points), 0) into v_today from donations where donor_id = v_me and game_day = v_day;
  if v_today + v_points > 30 then raise exception 'daily_limit:%', ms_to_game_reset(); end if;
  perform enforce_rate('donate', 500, 60, interval '1 hour');
  insert into donations (request_id, requester_id, donor_id, donor_name, clan_id, item, count, points, coins, game_day, donor_key)
    values (r.id, r.user_id, v_me, me.name, r.clan_id, r.item, p_count, v_points, v_points * 50, v_day, p_key)
    on conflict (donor_id, donor_key) do nothing
    returning * into d;
  if d.id is null then
    -- (the key check above runs under the lock, so this cannot happen; if it ever does, answer
    -- with the donation that exists: a refusal here would make the client refund applied items)
    select * into d from donations where donor_id = v_me and donor_key = p_key;
    return json_build_object('key', p_key, 'item', d.item, 'count', d.count, 'points', d.points,
      'reward', json_build_object('coins', d.coins), 'replayed', true, 'request', social_request_json(r, v_me),
      'donatedToday', v_today, 'cap', 30);
  end if;
  insert into donation_keys (donor_id, key, state, item, count, coins) values (v_me, p_key, 'applied', r.item, p_count, v_points * 50)
    on conflict (donor_id, key) do nothing;
  update donation_requests set received = received + p_count,
      status = case when received + p_count >= wanted then 'filled' else status end,
      closed_at = case when received + p_count >= wanted then now() else closed_at end
    where id = r.id returning * into r;
  update clans set xp = xp + v_points where id = r.clan_id;
  if r.status = 'filled' then
    select array_agg(n order by first_id) into v_names from (
      select min(id) as first_id, donor_name as n from donations where request_id = r.id group by donor_id, donor_name) s;
    perform system_message('clan:' || r.clan_id::text, r.user_name || '''s request is filled — thanks '
      || array_to_string(v_names[1:2], ', ')
      || case when cardinality(v_names) > 2 then ' +' || (cardinality(v_names) - 2) else '' end || '!');
  end if;
  update profiles set last_active = now() where id = v_me;
  if random() < 0.01 then perform social_housekeeping(); end if;
  return json_build_object('key', p_key, 'item', r.item, 'count', p_count, 'points', v_points,
    'reward', json_build_object('coins', v_points * 50), 'replayed', false,
    'request', social_request_json(r, v_me), 'donatedToday', v_today + v_points, 'cap', 30);
end $$;

-- Recovery for donations whose answer was lost: for each key, 'applied' (with what it did) or
-- 'voided'. A key the server never applied is voided HERE, under the same lock as donate(), so
-- a late donate() with it can never land afterwards: the client refunds only after this answer.
-- Bounded (nobody can fill the database with tombstones): 30 calls an hour, my voided keys older
-- than 2 days go first, and at most 100 voided keys at a time — an honest client only ever
-- settles its own few lost answers.
create or replace function public.settle_donations(p_keys uuid[]) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  k uuid;
  dk donation_keys%rowtype;
  v_out jsonb := '[]'::jsonb;
  v_oldest timestamptz;
begin
  if p_keys is null or cardinality(p_keys) > 20 then raise exception 'invalid: at most 20 keys'; end if;
  perform pg_advisory_xact_lock(hashtext(v_me::text || ':donate'));
  perform enforce_rate('settle', 0, 30, interval '1 hour');
  delete from donation_keys where donor_id = v_me and state = 'voided' and created_at < now() - interval '2 days';
  if (select count(*) from donation_keys where donor_id = v_me and state = 'voided')
     + (select count(distinct x) from unnest(p_keys) x where not exists (select 1 from donation_keys d where d.donor_id = v_me and d.key = x)) > 100 then
    select min(created_at) into v_oldest from donation_keys where donor_id = v_me and state = 'voided';
    raise exception 'rate_limited:%', greatest(1000, ceil(extract(epoch from (coalesce(v_oldest, now()) + interval '2 days' - now())) * 1000))::bigint;
  end if;
  foreach k in array p_keys loop
    select * into dk from donation_keys where donor_id = v_me and key = k;
    if not found then
      insert into donation_keys (donor_id, key, state) values (v_me, k, 'voided') on conflict (donor_id, key) do nothing;
      select * into dk from donation_keys where donor_id = v_me and key = k;
    end if;
    v_out := v_out || jsonb_build_object('key', k, 'state', dk.state, 'item', dk.item, 'count', dk.count, 'coins', dk.coins);
  end loop;
  return v_out;
end $$;

-- Collect: stamps all my unclaimed donations (≤ 7 days old) with p_key and returns them. The same
-- key returns the same set again for 24 h (crash recovery); a new key finds nothing left.
-- Scoped to the caller: a donor cannot replay the requester's key.
create or replace function public.claim_donations(p_key uuid) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  v_first timestamptz;
  v_replayed boolean := false;
begin
  if p_key is null then raise exception 'invalid: missing collect key'; end if;
  select min(claimed_at) into v_first from donations where requester_id = v_me and claim_key = p_key;
  if v_first is not null then
    if v_first < now() - interval '24 hours' then
      return json_build_object('key', p_key, 'items', '[]'::json, 'replayed', true, 'expired', true);
    end if;
    v_replayed := true;
  else
    update donations set claim_key = p_key, claimed_at = now()
      where requester_id = v_me and claim_key is null and created_at > now() - interval '7 days';
  end if;
  return json_build_object('key', p_key, 'replayed', v_replayed, 'items', (
    select coalesce(json_agg(json_build_object('item', x.item, 'count', x.n, 'from', x.names) order by x.item), '[]'::json) from (
      select item, sum(count)::int as n, array_agg(distinct donor_name) as names
      from donations where requester_id = v_me and claim_key = p_key group by item) x));
end $$;

-- =============================================================================================
-- 6. Triggers and the one re-created function of the first migration
-- =============================================================================================

-- Chat guard (a SEPARATE trigger, so a re-run of the first migration cannot undo it; it fires
-- after messages_rate_limit): owner mutes also silence chat, chat bodies follow the DM text rule,
-- and a clan co-op invite names a campaign stage. System notices pass.
create or replace function public.messages_social_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if coalesce(current_setting('ss.system', true), '') = '1' then return new; end if;
  if exists (select 1 from social_mutes where user_id = auth.uid() and created_by = 'owner' and until > now()) then
    raise exception 'forbidden: you can''t send messages right now';
  end if;
  if char_length(new.body) between 1 and 200 and not valid_dm_body(new.body) then
    raise exception 'invalid: Messages can''t contain invisible characters';
  end if;
  if new.kind = 'invite' and valid_message_meta(new.kind, new.meta) and new.meta ? 'stage'
     and (new.meta ->> 'stage') !~ '^[0-9]{1,2}-[0-9]{1,2}$' then
    raise exception 'invalid: That invite is not for a campaign stage';
  end if;
  return new;
end $$;
drop trigger if exists messages_social_guard on public.messages;
create trigger messages_social_guard before insert on public.messages
  for each row execute function public.messages_social_guard();

-- Names: the rules of section 1 for NEW and CHANGED names only. A trigger, never a check
-- constraint: a NOT VALID check still runs on every UPDATE of an old row, so a name accepted
-- before this file (two Hangul fillers, a look-alike) would make that player's level sync,
-- chat (it stamps last_active) and touch_active() fail. Such a player keeps the old name until
-- they change it (DMs, invites and friend requests ask them to: social_name_ok()).
create or replace function public.profiles_name_rules() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' and new.name is not distinct from old.name then return new; end if;
  -- (what the first migration's profiles_name_valid check refuses, it answers itself)
  if not valid_display_name(new.name) then return new; end if;
  if not visible_name(new.name) then raise exception 'invalid: names need visible letters'; end if;
  if reserved_name(new.name) then raise exception 'invalid: that name is reserved'; end if;
  return new;
end $$;
drop trigger if exists profiles_name_rules on public.profiles;
create trigger profiles_name_rules before insert or update of name on public.profiles
  for each row execute function public.profiles_name_rules();

-- Name changes: 3 a day (a name shown in a friend request cannot be swapped every minute).
-- The server's own updates and the owner's SQL editor are not counted.
create or replace function public.profiles_rename_limit() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or auth.uid() <> new.id then return new; end if;
  perform enforce_rate('rename', 0, 3, interval '1 day');
  return new;
end $$;
drop trigger if exists profiles_rename_limit on public.profiles;
create trigger profiles_rename_limit before update of name on public.profiles
  for each row when (old.name is distinct from new.name) execute function public.profiles_rename_limit();

-- Leaving the developer clan is remembered for a week (no donations meanwhile).
create or replace function public.clan_members_dev_lab() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.clan_id = '00000000-0000-4000-8000-000000000777' then
    insert into dev_lab_visits (user_id, left_at) values (old.user_id, now())
      on conflict (user_id) do update set left_at = now();
  end if;
  return old;
end $$;
drop trigger if exists clan_members_dev_lab on public.clan_members;
create trigger clan_members_dev_lab after delete on public.clan_members
  for each row execute function public.clan_members_dev_lab();

-- join_room() from 20261008000000_online.sql, unchanged except two [social] additions: a host who
-- blocked the guest has no free seat for them (the answer of a full room: the code came from
-- clan chat or a friend, so "no such room" while others join would reveal the block), and both
-- players are remembered as co-op partners for a week (a friend request context). Keeps its grant.
create or replace function public.join_room(p_code text) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  r coop_rooms%rowtype;
begin
  if auth.uid() is null then raise exception 'forbidden: sign in first'; end if;
  perform enforce_rate('room', 1000, 20, interval '1 hour');
  select * into r from coop_rooms where code = v_code and created_at > now() - interval '1 day' for update;
  if not found then return json_build_object('error', 'not_found'); end if;
  if r.host_id = auth.uid() then return json_build_object('code', r.code, 'secret', r.secret, 'host', true); end if;
  -- [social] blocked by the host: never a free seat for them
  if exists (select 1 from blocks where blocker_id = r.host_id and blocked_id = auth.uid()) then return json_build_object('error', 'full'); end if;
  if r.guest_id is not null and r.guest_id <> auth.uid() then return json_build_object('error', 'full'); end if;
  update coop_rooms set guest_id = auth.uid() where code = r.code;
  -- [social] co-op partners for a week
  insert into coop_partners (user_id, partner_id, last_at) values (auth.uid(), r.host_id, now()), (r.host_id, auth.uid(), now())
    on conflict (user_id, partner_id) do update set last_at = now();
  return json_build_object('code', r.code, 'secret', r.secret, 'host', false);
end $$;

-- =============================================================================================
-- 7. Seed: requestable materials (src/online/donateRules.js; re-running re-applies the tuning)
-- =============================================================================================

insert into public.donate_items (item, family, rarity, name, request_size, per_donor, points, weekly_max, established) values
  ('mat_feather_common', 'feather', 'common', 'Sparrow Feather', 10, 5, 1, 0, false),
  ('mat_feather_rare', 'feather', 'rare', 'Swallow Plume', 6, 3, 2, 0, false),
  ('mat_feather_superRare', 'feather', 'superRare', 'Hawk Quill', 3, 2, 5, 3, false),
  ('mat_feather_mythic', 'feather', 'mythic', 'Phoenix Plume', 1, 1, 10, 1, true),
  ('mat_blade_common', 'blade', 'common', 'Chipped Edge Shard', 10, 5, 1, 0, false),
  ('mat_blade_rare', 'blade', 'rare', 'Tempered Shard', 6, 3, 2, 0, false),
  ('mat_blade_superRare', 'blade', 'superRare', 'Moonsteel Fragment', 3, 2, 5, 3, false),
  ('mat_blade_mythic', 'blade', 'mythic', 'Crimson Katana Shard', 1, 1, 10, 1, true),
  ('mat_ember_common', 'ember', 'common', 'Warm Cinder', 10, 5, 1, 0, false),
  ('mat_ember_rare', 'ember', 'rare', 'Glowing Ember', 6, 3, 2, 0, false),
  ('mat_ember_superRare', 'ember', 'superRare', 'Blazing Coal', 3, 2, 5, 3, false),
  ('mat_ember_mythic', 'ember', 'mythic', 'Phoenix Ember', 1, 1, 10, 1, true),
  ('mat_rime_common', 'rime', 'common', 'Frost Pebble', 10, 5, 1, 0, false),
  ('mat_rime_rare', 'rime', 'rare', 'Rime Shard', 6, 3, 2, 0, false),
  ('mat_rime_superRare', 'rime', 'superRare', 'Glacier Prism', 3, 2, 5, 3, false),
  ('mat_rime_mythic', 'rime', 'mythic', 'Aurora Crystal', 1, 1, 10, 1, true),
  ('mat_charm_common', 'charm', 'common', 'Paper Omamori', 10, 5, 1, 0, false),
  ('mat_charm_rare', 'charm', 'rare', 'Silk Omamori', 6, 3, 2, 0, false),
  ('mat_charm_superRare', 'charm', 'superRare', 'Blessed Bell Charm', 3, 2, 5, 3, false),
  ('mat_charm_mythic', 'charm', 'mythic', 'Shrine Guardian Talisman', 1, 1, 10, 1, true),
  ('mat_rune_common', 'rune', 'common', 'Chalk Rune', 10, 5, 1, 0, false),
  ('mat_rune_rare', 'rune', 'rare', 'Inked Rune', 6, 3, 2, 0, false),
  ('mat_rune_superRare', 'rune', 'superRare', 'Carved Runestone', 3, 2, 5, 3, false),
  ('mat_rune_mythic', 'rune', 'mythic', 'Astral Glyph', 1, 1, 10, 1, true),
  ('mat_cog_common', 'cog', 'common', 'Brass Cog', 10, 5, 1, 0, false),
  ('mat_cog_rare', 'cog', 'rare', 'Steel Gear', 6, 3, 2, 0, false),
  ('mat_cog_superRare', 'cog', 'superRare', 'Clockwork Spring', 3, 2, 5, 3, false),
  ('mat_cog_mythic', 'cog', 'mythic', 'Aether Mainspring', 1, 1, 10, 1, true)
on conflict (item) do update set family = excluded.family, rarity = excluded.rarity, name = excluded.name,
  request_size = excluded.request_size, per_donor = excluded.per_donor, points = excluded.points,
  weekly_max = excluded.weekly_max, established = excluded.established;

-- =============================================================================================
-- 8. Realtime: DM delivery, friend requests, clan material requests
-- =============================================================================================

do $$
declare
  t text;
begin
  foreach t in array array['direct_messages', 'friend_requests', 'donation_requests'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- =============================================================================================
-- 9. Function privileges: Supabase grants EXECUTE on every new function to anon and
--    authenticated by default. Revoke every function this file creates (all overloads, by name),
--    then grant only the entry points. tests/online/socialSchema.test.js fails on any function a
--    player can execute that is not on its allow-list.
-- =============================================================================================

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (array[
      'game_clock', 'game_day_key', 'next_game_reset', 'ms_to_game_reset', 'valid_dm_body', 'valid_dm_meta', 'visible_name',
      'name_key', 'reserved_name', 'social_name_ok', 'profiles_name_rules', 'expire_coop_invites',
      'social_me', 'social_is_blocked', 'social_are_friends', 'social_clanmates', 'social_privacy', 'social_dm_allows', 'social_muted',
      'social_dm_why', 'social_why_text', 'social_friend_count', 'social_friend_state', 'social_friend_context', 'social_befriend',
      'social_request_friend', 'social_thread_for', 'social_invite_state', 'social_dm_json', 'social_housekeeping', 'social_after_dm',
      'social_report_evidence', 'social_qualified_reporter', 'social_maybe_auto_mute', 'social_clan_established', 'social_request_json',
      'social_version', 'social_summary', 'player_card', 'set_dm_privacy', 'my_friend_code', 'reset_friend_code', 'send_friend_request',
      'add_friend_by_code', 'answer_friend_request', 'cancel_friend_request', 'remove_friend', 'list_friends', 'list_friend_requests',
      'invite_candidates', 'block_player', 'unblock_player', 'list_blocked', 'send_dm', 'send_coop_invite', 'dm_inbox', 'dm_history', 'dm_mark_read',
      'dm_clear', 'invite_state', 'report_player', 'donation_state', 'request_materials', 'cancel_material_request', 'donate',
      'settle_donations', 'claim_donations', 'messages_social_guard', 'profiles_rename_limit', 'clan_members_dev_lab'])
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

grant execute on function
  public.social_version(), public.social_summary(), public.player_card(uuid), public.set_dm_privacy(text),
  public.my_friend_code(), public.reset_friend_code(), public.send_friend_request(uuid), public.add_friend_by_code(text),
  public.answer_friend_request(bigint, boolean), public.cancel_friend_request(bigint), public.remove_friend(uuid),
  public.list_friends(), public.list_friend_requests(), public.invite_candidates(), public.block_player(uuid), public.unblock_player(uuid),
  public.list_blocked(), public.send_dm(uuid, text), public.send_coop_invite(uuid, text, text, text), public.dm_inbox(int),
  public.dm_history(uuid, bigint, int), public.dm_mark_read(uuid, bigint), public.dm_clear(uuid), public.invite_state(bigint),
  public.expire_coop_invites(text),
  public.report_player(uuid, text, text, text, bigint), public.donation_state(), public.request_materials(text),
  public.cancel_material_request(), public.donate(uuid, int, uuid), public.settle_donations(uuid[]), public.claim_donations(uuid)
  to authenticated;
-- (every social_* helper, the name rules, the clock, valid_dm_* and the triggers stay internal:
--  the name trigger is SECURITY DEFINER, so it needs no player grant)

-- PostgREST picks up the new functions at once
notify pgrst, 'reload schema';
