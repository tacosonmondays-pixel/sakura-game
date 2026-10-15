-- Sakura Sentinels — SENSEI PROFILES: the bio, "Who can see my profile", and the published
-- profile card (favorite girl, banner, frame, title, top-8 showcase with builds, medal / ribbon
-- tally, 4 pinned trophies, freeplay records, collection stats). DESIGN SKETCH (scratchpad) —
-- card format v1 as judged in SPEC.md §6; proven on PGlite by probe.mjs + parity.mjs.
--
-- HOW TO RUN IT (owner): AFTER 20261013000000_social.sql. Open this file on GitHub → Raw → select
-- all → copy; Supabase → SQL Editor → New query → paste → Run. Idempotent: running it again is
-- harmless. Check afterwards: `select public.profile_version();` → 1.
-- ORDER: online (first migration) → social → THIS file. If the first migration is ever pasted
-- again, paste the social file and then THIS file again right after it (the first file revokes
-- every function grant). Pasting the social file again does not touch this one.
--
-- The game's frontend deploys BEFORE this runs: until then the profile shows "Needs the latest
-- server update" and everything else (chat, clans, co-op, DMs, friends) keeps working.
--
-- What it creates
--   table      profile_cards: one row per player — bio, visibility, the card (jsonb), its hash,
--              and the moderation state of the bio. RLS on, NO grants: only the functions below.
--   trust      the card is SELF-REPORTED display data. The server checks its shape, ranges and
--              size only; nothing in the game (rewards, ranks, co-op) may ever read it. The viewer's
--              client drops unknown ids and clamps numbers to the game's real limits.
--   privacy    visibility 'everyone' (default: every signed-in player) · 'friends_clan' (friends,
--              and clanmates after both spent 72 h in the same non-developer clan — the same people
--              "Friends & clan" means for DMs) · 'nobody' (only me). A player who blocked the viewer
--              gets the 'private' answer, exactly like 'nobody': a block is never shown. Nothing
--              about WHEN a card changed is shown to others (that would be presence).
--   bio        0–80 characters, the DM text rules (valid_dm_body) plus no links, e-mails, @names,
--              Discord tags, phone numbers / long digit runs or other apps' names
--              (profile_contact_free; src/online/profileRules.js mirrors it). Re-checked when read,
--              so a later, stricter rule hides old bios at once. Edits refused while muted; an owner
--              mute also hides the bio from others.
--   reports    report_player(…, 'profile', …) as before; a trigger adds the target's bio and card
--              ids to the evidence (earlier bios kept on a repeat report). 3 reporters (accounts ≥ 1
--              day old) after the bio's last change hide it; a second hide within 30 days locks
--              bio edits for 7 days. A new bio shows again; the same bio stays hidden.
--   limits     enforce_rate (same numbers as src/online/limits.js):
--                profile card update   1 per second, 60 per hour
--                bio change            10 per day          visibility   'settings' (20 per hour)
--                viewing a profile     'card' (120 per hour, through player_card)

do $$
begin
  if to_regprocedure('public.social_version()') is null or to_regclass('public.reports') is null then
    raise exception 'Run 20261013000000_social.sql first: this file needs its blocks, reports and text rules';
  end if;
end $$;

-- =============================================================================================
-- 1. Text rules for the bio (src/online/profileRules.js mirrors them, string for string)
-- =============================================================================================

-- What the contact rules look at: compatibility-decomposed (fullwidth → ASCII, circled / math
-- digits → 0–9, the ideographic and no-break spaces → ' ', '＠' → '@'), marks, variation selectors,
-- keycaps and joiners dropped, the look-alike table of name_key() applied, odd dots → '.',
-- lower case.
create or replace function public.profile_flat(p text) returns text
language sql immutable as $$
  select lower(translate(
    regexp_replace(normalize(coalesce(p, ''), NFKD),
      '[\u0300-\u036f\u0483-\u0489\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06dc\u06df-\u06e4\u06e7\u06e8\u06ea-\u06ed\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0eb1\u0eb4-\u0ebc\u0ec8-\u0ece\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f\ufe00-\ufe0f\u200c\u200d]', '', 'g'),
    'АВСЕНІЈКМОРЅТХУҮҺԀԚԜӀѴавсеніјкморѕтхуүһԁԛԝӏѵΑΒΕΖΗΙΚΜΝΟΡΤΥΧαβεζηικμνορτυχϳıɑɡɩ。․‧·',
    'abcehijkmopstxyyhdqwlvabcehijkmopstxyyhdqwlvabezhikmnoptyxabezhikmnoptyxjiagi....'))
$$;

-- No way to reach a player outside the game: links (scheme, www., a name followed by a known
-- top-level domain, "dot com" spelled out, a /path), e-mails and @names (no '@' at all), Discord
-- tags (#1234), phone numbers and other long digit runs (7 digits with up to 2 separators between
-- them: "555-1234", "(555) 123 4567", a birth date "2014/03/09"), and other apps by name (letters
-- only, digits read as letters: "d1sc0rd", "Snap Chat"; the short ones only as words).
create or replace function public.profile_contact_free(p text) returns boolean
language sql immutable as $$
  select not (
       t ~ '(https?|ftp) *:|://|(^|[^a-z0-9])w ?w ?w ?\.[a-z0-9]'
    or t ~ '[a-z0-9]\.(com|net|org|gg|io|me|tv|ly|co|uk|us|ca|au|xyz|app|dev|link|live|to|be|gl|info|biz|site|online|club|ru|de|fr|jp|cn|kr|tk|ml|ga|cf|gq|page|top|store|shop|fun|chat|social|games)([^a-z0-9]|$)'
    or t ~ '[a-z0-9] *(\( *dot *\)|\[ *dot *\]|\{ *dot *\}| dot ) *(com|net|org|gg|io|me|tv|ly|co|uk|us|xyz|app)([^a-z0-9]|$)'
    or t ~ '\.[a-z]{2,}/'
    or t ~ '@'
    or t ~ '# *[0-9]{4}'
    or t ~ '[0-9]([^0-9a-z]{0,2}[0-9]){6,}'
    or translate(regexp_replace(t, '[^a-z0-9]', '', 'g'), '013457', 'oieast') ~ '(discord|snapchat|instagram|tiktok|whatsapp|telegram|facebook|twitter|youtube|gmail|hotmail|icloud|venmo|cashapp|paypal|skype|reddit|onlyfans)'
    or translate(regexp_replace(t, '[^a-z0-9]+', ' ', 'g'), '013457', 'oieast') ~ '(^| )(kik|insta|snap|yt|fb|dc|ig|twitch)( |$)')
  from (select profile_flat(p) as t) f
$$;

-- '' (no bio) or 1–80 characters that pass the DM text rules and the contact rules.
create or replace function public.profile_bio_ok(p text) returns boolean
language sql immutable as $$
  select p is not null and (p = '' or (char_length(p) <= 80 and valid_dm_body(p) and profile_contact_free(p)))
$$;

-- =============================================================================================
-- 2. The card's shape (src/online/profileRules.js validCard() mirrors it). Ceilings sit a little
--    above today's game (lv ≤ 999, ≤ 4 gear pieces, ≤ 6 substats, ids by pattern, not by list) so
--    new girls, outfits, titles, banners, modes and stages need no new paste. ≤ 8 KB as jsonb text.
-- =============================================================================================

create or replace function public.profile_num(p jsonb, p_lo numeric, p_hi numeric, p_whole boolean) returns boolean
language plpgsql immutable as $$
declare
  v numeric;
begin
  if p is null or jsonb_typeof(p) <> 'number' then return false; end if;
  v := (p #>> '{}')::numeric;
  return v between p_lo and p_hi and (not p_whole or v = trunc(v));
end $$;

-- absent, JSON null, or a string matching p_re
create or replace function public.profile_opt_id(p jsonb, p_re text) returns boolean
language sql immutable as $$
  select p is null or jsonb_typeof(p) = 'null' or (jsonb_typeof(p) = 'string' and (p #>> '{}') ~ p_re)
$$;

-- ["statId", value ≥ 0] (a main stat), or with p_ups: ["statId", value ≥ 0, upgrades 0–9] allowed too
-- (the design sketch had a one-argument version: drop it so a call is never ambiguous)
drop function if exists public.profile_stat_ok(jsonb);
create or replace function public.profile_stat_ok(p jsonb, p_ups boolean default false) returns boolean
language plpgsql immutable as $$
begin
  if p is null or jsonb_typeof(p) <> 'array' then return false; end if;
  if not (jsonb_array_length(p) = 2 or (p_ups and jsonb_array_length(p) = 3)) then return false; end if;
  if jsonb_array_length(p) = 3 and not profile_num(p -> 2, 0, 9, true) then return false; end if;
  return jsonb_typeof(p -> 0) = 'string' and (p ->> 0) ~ '^[a-zA-Z]{1,16}$' and profile_num(p -> 1, 0, 100000, false);
end $$;

-- an array of p_min..p_max whole numbers in 0..p_hi
create or replace function public.profile_counts_ok(p jsonb, p_min int, p_max int, p_hi numeric) returns boolean
language sql immutable as $$
  select p is not null and jsonb_typeof(p) = 'array' and jsonb_array_length(p) between p_min and p_max
    and not exists (select 1 from jsonb_array_elements(p) e where not profile_num(e, 0, p_hi, true))
$$;

create or replace function public.valid_profile_card(p jsonb) returns boolean
language plpgsql immutable set search_path = public, pg_temp as $$
declare
  c_id constant text := '^[a-z][a-z0-9_]{0,23}$';
  u jsonb;
  g jsonb;
  x jsonb;
  m jsonb;
  v_ids text[] := '{}';
  v_slots text[];
  v_seen text[];
  v_key text;
begin
  if p is null or jsonb_typeof(p) <> 'object' or octet_length(p::text) > 8192 then return false; end if;
  if (p - array['v', 'fav', 'ban', 'frm', 'ttl', 'units', 'med', 'fp', 'st']) <> '{}'::jsonb then return false; end if;
  if (p -> 'v') is distinct from '1'::jsonb then return false; end if;
  if not (profile_opt_id(p -> 'fav', c_id) and profile_opt_id(p -> 'frm', c_id) and profile_opt_id(p -> 'ttl', c_id)
      and profile_opt_id(p -> 'ban', '^[a-z]{1,12}:[a-z0-9_-]{1,24}$')) then return false; end if;
  -- the showcase: at most 8 girls, each once, in the owner's order
  if p ? 'units' then
    if jsonb_typeof(p -> 'units') <> 'array' or jsonb_array_length(p -> 'units') > 8 then return false; end if;
    for u in select e from jsonb_array_elements(p -> 'units') e loop
      if jsonb_typeof(u) <> 'object' or (u - array['id', 'lv', 'bt', 'aw', 'p', 'sk', 'g']) <> '{}'::jsonb then return false; end if;
      if jsonb_typeof(u -> 'id') <> 'string' or (u ->> 'id') !~ c_id or (u ->> 'id') = any (v_ids) then return false; end if;
      v_ids := v_ids || (u ->> 'id');
      if not (profile_num(u -> 'lv', 1, 999, true) and profile_num(u -> 'bt', 0, 9, true) and profile_num(u -> 'aw', 0, 9, true)) then return false; end if;
      if u ? 'p' and not profile_num(u -> 'p', 1, 9, true) then return false; end if;
      if not profile_opt_id(u -> 'sk', '^[a-z][a-z0-9_]{0,31}$') then return false; end if;
      if u ? 'g' then
        if jsonb_typeof(u -> 'g') <> 'array' or jsonb_array_length(u -> 'g') > 4 then return false; end if;
        v_slots := '{}';
        for g in select e from jsonb_array_elements(u -> 'g') e loop
          if jsonb_typeof(g) <> 'object' or (g - array['s', 'r', 'l', 'm', 'x']) <> '{}'::jsonb then return false; end if;
          if jsonb_typeof(g -> 's') <> 'string' or (g ->> 's') !~ '^[a-z]{1,12}$' or (g ->> 's') = any (v_slots) then return false; end if;
          v_slots := v_slots || (g ->> 's');
          if jsonb_typeof(g -> 'r') <> 'string' or (g ->> 'r') !~ '^[a-zA-Z]{1,12}$' then return false; end if;
          if not (profile_num(g -> 'l', 0, 99, true) and profile_stat_ok(g -> 'm')) then return false; end if;
          if g ? 'x' then
            if jsonb_typeof(g -> 'x') <> 'array' or jsonb_array_length(g -> 'x') > 6 then return false; end if;
            for x in select e from jsonb_array_elements(g -> 'x') e loop
              if not profile_stat_ok(x, true) then return false; end if;
            end loop;
          end if;
        end loop;
      end if;
    end loop;
  end if;
  -- medal / ribbon showcase: a = medals per difficulty over every stage (easy, normal, hard,
  -- nightmare), r = ribbons per mode (codex modes; 1–8 modes so a new mode needs no paste),
  -- pins = ≤ 4 trophies: 'stage:difficulty' (medal), 'stage:difficulty:mode' (ribbon),
  -- 'stage:perfect' (all ribbons of a stage), 'ach:<achievement id>'
  if p ? 'med' then
    m := p -> 'med';
    if jsonb_typeof(m) <> 'object' or (m - array['a', 'r', 'pins']) <> '{}'::jsonb then return false; end if;
    if m ? 'a' and not profile_counts_ok(m -> 'a', 4, 4, 9999) then return false; end if;
    if m ? 'r' and not profile_counts_ok(m -> 'r', 1, 8, 9999) then return false; end if;
    if m ? 'pins' then
      if jsonb_typeof(m -> 'pins') <> 'array' or jsonb_array_length(m -> 'pins') > 4 then return false; end if;
      v_seen := '{}';
      for x in select e from jsonb_array_elements(m -> 'pins') e loop
        if jsonb_typeof(x) <> 'string'
           or (x #>> '{}') !~ '^([a-z0-9-]{1,24}:((easy|normal|hard|nightmare)(:[a-z]{1,16})?|perfect)|ach:[a-z][a-z0-9_]{0,31})$'
           or (x #>> '{}') = any (v_seen) then return false; end if;
        v_seen := v_seen || (x #>> '{}');
      end loop;
    end if;
  end if;
  -- freeplay records: per tier (≤ 4) { w: best wave, s: its stage, c: 1 when set in co-op }
  if p ? 'fp' and jsonb_typeof(p -> 'fp') <> 'null' then
    if jsonb_typeof(p -> 'fp') <> 'object' or (select count(*) from jsonb_object_keys(p -> 'fp')) > 4 then return false; end if;
    for v_key, x in select key, value from jsonb_each(p -> 'fp') loop
      if v_key !~ '^[a-z]{1,16}$' or jsonb_typeof(x) <> 'object' or (x - array['w', 's', 'c']) <> '{}'::jsonb
         or not profile_num(x -> 'w', 0, 999999, true)
         or jsonb_typeof(x -> 's') <> 'string' or (x ->> 's') !~ '^[a-z0-9-]{1,24}$'
         or (x ? 'c' and not profile_num(x -> 'c', 0, 1, true)) then return false; end if;
    end loop;
  end if;
  -- collection stats: u students owned, s stages cleared, b bestiary %, k enemies defeated
  if p ? 'st' then
    if jsonb_typeof(p -> 'st') <> 'object' or ((p -> 'st') - array['u', 's', 'b', 'k']) <> '{}'::jsonb then return false; end if;
    if (p -> 'st') ? 'u' and not profile_num(p #> '{st,u}', 0, 999, true) then return false; end if;
    if (p -> 'st') ? 's' and not profile_num(p #> '{st,s}', 0, 999, true) then return false; end if;
    if (p -> 'st') ? 'b' and not profile_num(p #> '{st,b}', 0, 100, true) then return false; end if;
    if (p -> 'st') ? 'k' and not profile_num(p #> '{st,k}', 0, 2000000000, true) then return false; end if;
  end if;
  return true;
end $$;

-- =============================================================================================
-- 3. Table, RLS, privileges
-- =============================================================================================

create table if not exists public.profile_cards (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  bio text not null default '',
  visibility text not null default 'everyone' check (visibility in ('everyone', 'friends_clan', 'nobody')),
  card jsonb not null default '{"v": 1}'::jsonb,
  card_hash text not null default '',
  bio_changed_at timestamptz,
  bio_hidden boolean not null default false,
  bio_strikes int not null default 0,
  bio_strike_at timestamptz,
  bio_locked_until timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
-- (no check constraint on bio or card: a NOT VALID check still runs on every UPDATE of an old row,
--  so a stricter rule later would lock players out of publishing — the social file's lesson. The
--  functions check what CHANGES, and profile_view re-checks the bio when it is read.)

alter table public.profile_cards enable row level security;
-- no policies: functions only
revoke all on public.profile_cards from anon, authenticated;

-- =============================================================================================
-- 4. Internal helpers (SECURITY INVOKER, revoked: see section 7)
-- =============================================================================================

create or replace function public.profile_can_see(p_owner uuid, p_viewer uuid, p_visibility text) returns boolean
language sql stable security invoker set search_path = public, pg_temp as $$
  select coalesce(p_owner = p_viewer or (not social_is_blocked(p_owner, p_viewer) and case p_visibility
    when 'everyone' then true
    when 'friends_clan' then social_are_friends(p_owner, p_viewer) or social_clanmates(p_owner, p_viewer, 72)
    else false end), false)
$$;

-- an owner mute (SQL editor) also takes the bio down for everyone else
create or replace function public.profile_owner_muted(u uuid) returns boolean
language sql stable security invoker set search_path = public, pg_temp as $$
  select exists (select 1 from social_mutes where user_id = u and created_by = 'owner' and until > now())
$$;

-- what the owner of a card sees about it (never shown to anyone else)
create or replace function public.profile_own_json(p_me uuid) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'exists', c.user_id is not null,
    'bio', coalesce(c.bio, ''), 'visibility', coalesce(c.visibility, 'everyone'),
    'card', c.card, 'hash', coalesce(c.card_hash, ''),
    'bioHidden', coalesce(c.bio_hidden, false) or profile_owner_muted(p_me) or not profile_bio_ok(coalesce(c.bio, '')),
    'bioLockedUntil', case when c.bio_locked_until > now() then c.bio_locked_until end,
    'muted', social_muted(p_me), 'updatedAt', c.updated_at)
  from (select p_me as id) me left join profile_cards c on c.user_id = me.id
$$;

-- the target's profile as report evidence: the bio (even a hidden one) and the card's ids only
create or replace function public.profile_evidence(p_target uuid) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
  select jsonb_build_object('bio', c.bio, 'bioChangedAt', c.bio_changed_at, 'bioHidden', c.bio_hidden, 'visibility', c.visibility,
    'fav', c.card -> 'fav', 'ban', c.card -> 'ban', 'frm', c.card -> 'frm', 'ttl', c.card -> 'ttl',
    'units', (select coalesce(jsonb_agg(u -> 'id'), '[]'::jsonb)
              from jsonb_array_elements(case when jsonb_typeof(c.card -> 'units') = 'array' then c.card -> 'units' else '[]'::jsonb end) u),
    'pins', c.card #> '{med,pins}')
  from profile_cards c where c.user_id = p_target
$$;

-- 3 reporters (accounts ≥ 1 day old) with an open 'profile' report filed or repeated after the
-- bio's last change → the bio is hidden; a second hide within 30 days locks bio edits 7 days.
create or replace function public.profile_maybe_hide(p_target uuid) returns void
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  c profile_cards%rowtype;
  v_n int;
  v_strikes int;
begin
  select * into c from profile_cards where user_id = p_target for update;
  if not found or c.bio = '' or c.bio_hidden then return; end if;
  select count(distinct r.reporter_id) into v_n from reports r join profiles p on p.id = r.reporter_id
    where r.target_id = p_target and r.status = 'open' and r.context = 'profile'
      and r.updated_at >= coalesce(c.bio_changed_at, '-infinity'::timestamptz)
      and p.created_at <= now() - interval '24 hours';
  if v_n < 3 then return; end if;
  v_strikes := case when c.bio_strike_at > now() - interval '30 days' then c.bio_strikes + 1 else 1 end;
  update profile_cards set bio_hidden = true, bio_strikes = v_strikes, bio_strike_at = now(),
    bio_locked_until = case when v_strikes >= 2 then now() + interval '7 days' else bio_locked_until end
    where user_id = p_target;
end $$;

-- =============================================================================================
-- 5. Report triggers (reports belongs to the social file; these only ADD to it, so pasting the
--    social file again keeps them, and report_player() needs no change)
-- =============================================================================================

-- Evidence: evidence.profile = the target's profile now, plus the bios reported before it
-- ('earlier', newest 3, once each) — a bio edited after a report never erases what was reported.
create or replace function public.reports_profile_evidence() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_now jsonb := profile_evidence(new.target_id);
  v_old jsonb;
  v_earlier jsonb;
begin
  if tg_op = 'UPDATE' and jsonb_typeof(old.evidence -> 'profile') = 'object' then v_old := old.evidence -> 'profile'; end if;
  if v_now is null and v_old is null then return new; end if;
  select coalesce(jsonb_agg(e order by e ->> 'at'), '[]'::jsonb) into v_earlier from (
    select e from (
      select distinct on (e ->> 'bio') e from (
        select e from jsonb_array_elements(case when jsonb_typeof(v_old -> 'earlier') = 'array' then v_old -> 'earlier' else '[]'::jsonb end) e
        union all
        select jsonb_build_object('bio', v_old ->> 'bio', 'at', v_old ->> 'bioChangedAt') where coalesce(v_old ->> 'bio', '') <> ''
      ) a
      where jsonb_typeof(e) = 'object' and coalesce(e ->> 'bio', '') <> '' and (e ->> 'bio') is distinct from (v_now ->> 'bio')
      order by e ->> 'bio', e ->> 'at' desc nulls last) d
    order by e ->> 'at' desc nulls last limit 3) n;
  new.evidence := coalesce(new.evidence, '{}'::jsonb) || jsonb_build_object('profile', coalesce(v_now, v_old) || jsonb_build_object('earlier', v_earlier));
  return new;
end $$;
drop trigger if exists reports_profile_evidence on public.reports;
create trigger reports_profile_evidence before insert or update of evidence on public.reports
  for each row execute function public.reports_profile_evidence();

create or replace function public.reports_profile_hide() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.context = 'profile' and new.status = 'open' then perform profile_maybe_hide(new.target_id); end if;
  return null;
end $$;
drop trigger if exists reports_profile_hide on public.reports;
create trigger reports_profile_hide after insert or update of context, updated_at on public.reports
  for each row execute function public.reports_profile_hide();

-- =============================================================================================
-- 6. Entry points (SECURITY DEFINER, auth.uid() via social_me(), granted to signed-in players)
-- =============================================================================================

-- The frontend's deploy probe: "needs the latest server update" until this exists.
create or replace function public.profile_version() returns int
language sql immutable as $$ select 1 $$;

-- A player's profile: the player card (name, level, avatar, clan, friend / message / block state —
-- player_card() itself, so its rules and its 'card' rate limit apply) plus
--   profileWhy  null (shown) · 'none' (no profile yet) · 'private' (their setting, or they blocked
--               me: the same answer) · 'blocked_by_me'
--   profile     { bio, card } when shown (the bio is '' while hidden, muted by the owner, or failing
--               today's rules); never when it changed (that would be presence)
--   since       the account's creation MONTH, 'YYYY-MM' ("Sensei since Oct 2026"; never the day)
--   own         my own card's state, on my own profile only
create or replace function public.profile_view(p_user uuid) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  v_card jsonb;
  c profile_cards%rowtype;
  v_found boolean;
  v_why text;
begin
  v_card := player_card(p_user)::jsonb;
  select * into c from profile_cards where user_id = p_user;
  v_found := found;
  v_why := case
    when p_user = v_me then case when v_found then null else 'none' end
    when exists (select 1 from blocks where blocker_id = v_me and blocked_id = p_user) then 'blocked_by_me'
    when not v_found then 'none'
    when not profile_can_see(p_user, v_me, c.visibility) then 'private'
    else null end;
  return (v_card || jsonb_build_object(
    'since', (select to_char(created_at, 'YYYY-MM') from profiles where id = p_user),
    'profileWhy', v_why,
    'profile', case when v_why is null then jsonb_build_object(
      'bio', case when p_user = v_me or (not c.bio_hidden and not profile_owner_muted(p_user) and profile_bio_ok(c.bio)) then c.bio else '' end,
      'card', c.card) end,
    'own', case when p_user = v_me then profile_own_json(v_me) end))::json;
end $$;

-- My own card's state (the sync reads it: the server's bio is the one that counts).
create or replace function public.my_profile_card() returns json
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return profile_own_json(social_me())::json;
end $$;

-- Publish my card (the game builds it from the save). p_hash: the client's hash of what it sent,
-- returned by my_profile_card(), so an unchanged card is never sent again.
create or replace function public.set_profile_card(p_card jsonb, p_hash text) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  v_hash text := coalesce(p_hash, '');
begin
  if v_hash !~ '^[0-9a-z]{1,16}$' then raise exception 'invalid: bad card hash'; end if;
  if not valid_profile_card(p_card) then raise exception 'invalid: that profile card is not valid'; end if;
  perform enforce_rate('profile', 1000, 60, interval '1 hour');
  insert into profile_cards (user_id, card, card_hash, updated_at) values (v_me, p_card, v_hash, now())
    on conflict (user_id) do update set card = excluded.card, card_hash = excluded.card_hash, updated_at = now();
  return json_build_object('hash', v_hash);
end $$;

-- Change my bio. '' clears it (always allowed, even muted or locked). The same text again is no
-- change (a hidden bio stays hidden); a new one is shown again.
create or replace function public.set_profile_bio(p_bio text) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  v_bio text := btrim(coalesce(p_bio, ''));
  c profile_cards%rowtype;
begin
  select * into c from profile_cards where user_id = v_me for update;
  if found and c.bio = v_bio then return profile_own_json(v_me)::json; end if;
  if v_bio <> '' then
    if char_length(v_bio) > 80 then raise exception 'invalid: Bios are up to 80 characters.'; end if;
    if not valid_dm_body(v_bio) then raise exception 'invalid: Bios can''t contain invisible characters.'; end if;
    if not profile_contact_free(v_bio) then raise exception 'invalid: Keep links, e-mails, @names, phone numbers and other apps out of your bio.'; end if;
    if social_muted(v_me) or (found and c.bio_locked_until > now()) then raise exception 'forbidden: you can''t change your bio right now'; end if;
  end if;
  perform enforce_rate('bio', 0, 10, interval '1 day');
  insert into profile_cards (user_id, bio, bio_changed_at) values (v_me, v_bio, now())
    on conflict (user_id) do update set bio = excluded.bio, bio_changed_at = now(), bio_hidden = false, updated_at = now();
  return profile_own_json(v_me)::json;
end $$;

create or replace function public.set_profile_visibility(p_value text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
begin
  if p_value is null or p_value not in ('everyone', 'friends_clan', 'nobody') then raise exception 'invalid: unknown setting'; end if;
  perform enforce_rate('settings', 0, 20, interval '1 hour');
  insert into profile_cards (user_id, visibility) values (v_me, p_value)
    on conflict (user_id) do update set visibility = excluded.visibility, updated_at = now();
end $$;

-- =============================================================================================
-- 7. Function privileges: revoke everything this file creates (all overloads, by name), then
--    grant only the entry points. tests/online/profileSchema.test.js checks the allow-list.
-- =============================================================================================

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (array[
      'profile_flat', 'profile_contact_free', 'profile_bio_ok', 'profile_num', 'profile_opt_id', 'profile_stat_ok', 'profile_counts_ok', 'valid_profile_card',
      'profile_can_see', 'profile_owner_muted', 'profile_own_json', 'profile_evidence', 'profile_maybe_hide',
      'reports_profile_evidence', 'reports_profile_hide',
      'profile_version', 'profile_view', 'my_profile_card', 'set_profile_card', 'set_profile_bio', 'set_profile_visibility'])
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

grant execute on function
  public.profile_version(), public.profile_view(uuid), public.my_profile_card(), public.set_profile_card(jsonb, text),
  public.set_profile_bio(text), public.set_profile_visibility(text)
  to authenticated;

notify pgrst, 'reload schema';
