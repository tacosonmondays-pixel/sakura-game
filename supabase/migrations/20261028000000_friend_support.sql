-- Sakura Sentinels — FRIEND SUPPORT and FRIEND POINTS (docs/specs/BANNERS.md §E): each Sensei lends one
-- Support Student to their friends; a friend who brings her into a solo battle earns Friend Points (FP), and
-- so does the lender. FP buy Friendship pulls (standard girls only, no pity, no points).
--
-- HOW TO RUN IT (owner): AFTER 20261020000000_profile_gear.sql and 20261021000000_titan_board.sql.
-- Open this file on GitHub → Raw → select all → copy; Supabase → SQL Editor → New query → paste → Run.
-- Safe to run more than once. Check afterwards: `select public.support_version();` → 1.
-- It runs as ONE transaction: on any error (or "The game is busy right now") nothing at all was
-- changed — press Run again.
--
-- The game's frontend deploys BEFORE this runs: until then stage prep shows no Support slot and the
-- Friendship tab stays hidden; everything else keeps working.
--
-- What it creates
--   tables     support_cards: one row per player — the lent girl (a profile-card unit, jsonb), its hash and
--              "Lend my Support Student to" ('friends' | 'nobody').
--              support_uses: one row per borrow (borrower, lender, girl, game day, the borrower's key) and
--              what it paid. support_claims: the lender's collect keys (a replay returns the same total).
--              RLS on, NO grants: only the functions below read or write them.
--   trust      the lent girl is SELF-REPORTED battle input, like the profile card: the server checks its
--              shape and ranges only (valid_card_unit, the same rules as a profile card's showcase entry,
--              LR = `aw: 6`); the BORROWER's game clamps her to its own range before she fights. The
--              profile card's "nothing may read the card" promise stays true: support reads its own table.
--   points     use_support reserves a paying use at battle start: +10 FP for each side when the run
--              reaches wave 3 (settle_support). One paying use per (borrower, lender) pair per game day,
--              5 paying borrows a day per borrower, 10 paying lends (100 FP) a day per lender. A use past
--              a cap (or a friendship younger than 24 h, an account younger than 7 days, the developer
--              clan or a week after leaving it) is still allowed and pays 0. A reservation left unsettled
--              is void the next game day. The borrower's FP come back in settle_support's answer; the
--              lender collects theirs with claim_support_points (only what fits their wallet, 5,000 FP).
--              The FP wallet itself stays in the player's save (like gems, until the server keeps saves).
--   limits     enforce_rate (the same numbers as src/online/limits.js):
--                set_support          'support_set'   1 per second, 60 per hour
--                support_candidates   'support_list'  60 per hour
--                use_support          'support_use'   1 per 2 seconds, 60 per hour
--   retention  bounded deletes (500 rows at a time) as players use it: uncollected rows after 7 days,
--              collected rows and collect keys after 30 days (no cron).

begin;

-- =============================================================================================
-- 0. Order guard: the profile card's gear rules (club `c`) and the titan board must be in place
-- =============================================================================================
do $$
begin
  if to_regprocedure('public.valid_profile_card(jsonb)') is null or to_regprocedure('public.titan_board_version()') is null
     or to_regprocedure('public.social_version()') is null then
    raise exception 'Run 20261020000000_profile_gear.sql and 20261021000000_titan_board.sql first: this file builds on both';
  end if;
  -- the gear version of the card rules accepts a gear club (`c`); the first profile file's does not
  if not public.valid_profile_card('{"v": 1, "units": [{"id": "aoi", "lv": 1, "bt": 0, "aw": 0, "g": [{"s": "charm", "r": "ur", "l": 1, "m": ["atk", 1], "c": 1}]}]}'::jsonb) then
    raise exception 'Run 20261020000000_profile_gear.sql first: this file builds on its card rules';
  end if;
end $$;

-- One quiet moment for the live table the new tables point at (a busy game waits; 30 s at most)
do $$
begin
  for i in 1..600 loop
    begin
      lock table public.profiles in access exclusive mode nowait;
      return;
    exception when lock_not_available then
      perform pg_sleep(0.05);
    end;
  end loop;
  raise exception 'The game is busy right now, so nothing was changed. Press Run again in a minute.';
end $$;

-- =============================================================================================
-- 1. Tables, RLS, privileges
-- =============================================================================================

create table if not exists public.support_cards (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  unit jsonb,
  unit_hash text not null default '',
  lend text not null default 'friends' check (lend in ('friends', 'nobody')),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_uses (
  id bigint generated always as identity primary key,
  borrower_id uuid not null references public.profiles (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  unit text not null,
  game_day text not null,
  borrower_key uuid not null,
  paid boolean not null default false,
  why text,
  settled_at timestamptz,
  owner_points int not null default 0,
  borrower_points int not null default 0,
  claim_key uuid,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  -- idempotency: the same key is the same borrow
  unique (borrower_id, borrower_key)
);
-- the pair rule: one PAYING use per (borrower, lender) a game day; a second use is recorded unpaid instead
create unique index if not exists support_uses_pair_day on public.support_uses (borrower_id, owner_id, game_day) where paid;
create index if not exists support_uses_created on public.support_uses (created_at);
create index if not exists support_uses_owner_claim on public.support_uses (owner_id, claimed_at);
create index if not exists support_uses_borrower_day on public.support_uses (borrower_id, game_day);
create index if not exists support_uses_owner_day on public.support_uses (owner_id, game_day);

create table if not exists public.support_claims (
  user_id uuid not null references public.profiles (id) on delete cascade,
  key uuid not null,
  total int not null default 0,
  at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.support_cards enable row level security;
alter table public.support_uses enable row level security;
alter table public.support_claims enable row level security;
-- no policies: functions only
revoke all on public.support_cards from anon, authenticated;
revoke all on public.support_uses from anon, authenticated;
revoke all on public.support_claims from anon, authenticated;

-- =============================================================================================
-- 2. The shared card-unit validator (profile card showcase entries and the Support Student)
-- =============================================================================================

-- One showcase entry { id, lv, bt, aw, p?, sk?, g? }: the per-unit rules of the profile_gear version of
-- valid_profile_card, word for word (gear club `c` 0–15, ✦ marks, UR gear `r: 'ur'`). `aw` 0–9 (an LR
-- girl after Limit Break is `aw: 6`: no new key). The duplicate-id rule stays in valid_profile_card.
create or replace function public.valid_card_unit(u jsonb) returns boolean
language plpgsql immutable set search_path = public, pg_temp as $$
declare
  c_id constant text := '^[a-z][a-z0-9_]{0,23}$';
  g jsonb;
  x jsonb;
  v_slots text[] := '{}';
begin
  if u is null or jsonb_typeof(u) <> 'object' or (u - array['id', 'lv', 'bt', 'aw', 'p', 'sk', 'g']) <> '{}'::jsonb then return false; end if;
  if jsonb_typeof(u -> 'id') <> 'string' or (u ->> 'id') !~ c_id then return false; end if;
  if not (profile_num(u -> 'lv', 1, 999, true) and profile_num(u -> 'bt', 0, 9, true) and profile_num(u -> 'aw', 0, 9, true)) then return false; end if;
  if u ? 'p' and not profile_num(u -> 'p', 1, 9, true) then return false; end if;
  if not profile_opt_id(u -> 'sk', '^[a-z][a-z0-9_]{0,31}$') then return false; end if;
  if u ? 'g' then
    if jsonb_typeof(u -> 'g') <> 'array' or jsonb_array_length(u -> 'g') > 4 then return false; end if;
    for g in select e from jsonb_array_elements(u -> 'g') e loop
      if jsonb_typeof(g) <> 'object' or (g - array['s', 'r', 'l', 'm', 'x', 'c']) <> '{}'::jsonb then return false; end if;
      if jsonb_typeof(g -> 's') <> 'string' or (g ->> 's') !~ '^[a-z]{1,12}$' or (g ->> 's') = any (v_slots) then return false; end if;
      v_slots := v_slots || (g ->> 's');
      if jsonb_typeof(g -> 'r') <> 'string' or (g ->> 'r') !~ '^[a-zA-Z]{1,12}$' then return false; end if;
      if not (profile_num(g -> 'l', 0, 99, true) and profile_stat_ok(g -> 'm')) then return false; end if;
      -- Academy Club (gear-stats §E.3): the club's index, 0–15
      if g ? 'c' and not profile_num(g -> 'c', 0, 15, true) then return false; end if;
      if g ? 'x' then
        if jsonb_typeof(g -> 'x') <> 'array' or jsonb_array_length(g -> 'x') > 6 then return false; end if;
        for x in select e from jsonb_array_elements(g -> 'x') e loop
          if not profile_stat_ok(x, true) then return false; end if;
        end loop;
      end if;
    end loop;
  end if;
  return true;
end $$;

-- The profile card, now built on valid_card_unit (the same answers as the profile_gear version:
-- tests/online/supportSchema.test.js runs a fixed set of cards through both).
create or replace function public.valid_profile_card(p jsonb) returns boolean
language plpgsql immutable set search_path = public, pg_temp as $$
declare
  c_id constant text := '^[a-z][a-z0-9_]{0,23}$';
  u jsonb;
  x jsonb;
  m jsonb;
  v_ids text[] := '{}';
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
      if not valid_card_unit(u) or (u ->> 'id') = any (v_ids) then return false; end if;
      v_ids := v_ids || (u ->> 'id');
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
  -- collection stats: u students owned, s stages cleared, b bestiary %, k enemies defeated,
  -- h Honor Ribbons (docs/specs/ACHIEVEMENTS.md §6.3)
  if p ? 'st' then
    if jsonb_typeof(p -> 'st') <> 'object' or ((p -> 'st') - array['u', 's', 'b', 'k', 'h']) <> '{}'::jsonb then return false; end if;
    if (p -> 'st') ? 'u' and not profile_num(p #> '{st,u}', 0, 999, true) then return false; end if;
    if (p -> 'st') ? 's' and not profile_num(p #> '{st,s}', 0, 999, true) then return false; end if;
    if (p -> 'st') ? 'b' and not profile_num(p #> '{st,b}', 0, 100, true) then return false; end if;
    if (p -> 'st') ? 'k' and not profile_num(p #> '{st,k}', 0, 2000000000, true) then return false; end if;
    if (p -> 'st') ? 'h' and not profile_num(p #> '{st,h}', 0, 999, true) then return false; end if;
  end if;
  return true;
end $$;

-- =============================================================================================
-- 3. Internal helpers (SECURITY INVOKER, revoked: see section 5)
-- =============================================================================================

create or replace function public.support_now_ms() returns bigint
language sql stable as $$ select (extract(epoch from now()) * 1000)::bigint $$;

-- in the developer clan now, or left it within 7 days (its Supply Bot grants anything): no FP
create or replace function public.support_dev_lab(u uuid) returns boolean
language sql stable security invoker set search_path = public, pg_temp as $$
  select exists (select 1 from clan_members m join clans c on c.id = m.clan_id where m.user_id = u and c.is_dev)
      or exists (select 1 from dev_lab_visits where user_id = u and left_at > now() - interval '7 days')
$$;

-- what my lender rows hold that I can still collect (settled, paid, uncollected, ≤ 7 days old)
create or replace function public.support_uncollected(u uuid) returns int
language sql stable security invoker set search_path = public, pg_temp as $$
  select coalesce(sum(owner_points), 0)::int from support_uses
   where owner_id = u and claim_key is null and owner_points > 0 and settled_at is not null and created_at > now() - interval '7 days'
$$;

-- bounded housekeeping: uncollected rows after 7 days, collected rows and collect keys after 30
create or replace function public.support_housekeeping() returns void
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  delete from support_uses where id in (
    select id from support_uses
     where (claim_key is null and created_at < now() - interval '7 days') or claimed_at < now() - interval '30 days'
     limit 500);
  delete from support_claims where (user_id, key) in (
    select user_id, key from support_claims where at < now() - interval '30 days' limit 500);
end $$;

-- =============================================================================================
-- 4. Entry points (SECURITY DEFINER, auth.uid() via social_me(), granted to signed-in players)
-- =============================================================================================

-- The frontend's deploy probe: no Support slot until this exists.
create or replace function public.support_version() returns int
language sql immutable as $$ select 1 $$;

-- Publish my Support Student (a card unit; null = none) and who may borrow her. The game sends it only
-- when its hash changed.
create or replace function public.set_support(p_unit jsonb, p_hash text, p_lend text default 'friends') returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
begin
  if p_lend is null or p_lend not in ('friends', 'nobody') then raise exception 'invalid: unknown setting'; end if;
  if p_hash is null or p_hash !~ '^[0-9a-z]{1,16}$' then raise exception 'invalid: bad support hash'; end if;
  if p_unit is not null and jsonb_typeof(p_unit) = 'null' then p_unit := null; end if;
  if p_unit is not null and (octet_length(p_unit::text) > 2048 or not valid_card_unit(p_unit)) then
    raise exception 'invalid: that Support Student is not valid';
  end if;
  perform enforce_rate('support_set', 1000, 60, interval '1 hour');
  insert into support_cards (user_id, unit, unit_hash, lend, updated_at) values (v_me, p_unit, p_hash, p_lend, now())
    on conflict (user_id) do update set unit = excluded.unit, unit_hash = excluded.unit_hash, lend = excluded.lend, updated_at = now();
  return json_build_object('hash', p_hash, 'lend', p_lend);
end $$;

-- My published Support Student (what the sync compares its hash with).
create or replace function public.my_support() returns json
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  c support_cards%rowtype;
begin
  select * into c from support_cards where user_id = v_me;
  return json_build_object('exists', c.user_id is not null, 'unit', c.unit, 'hash', coalesce(c.unit_hash, ''),
    'lend', coalesce(c.lend, 'friends'), 'updatedAt', c.updated_at);
end $$;

-- My friends' Support Students (online first), with whether a borrow of theirs already paid today. A friend
-- who lends to nobody, has no girl, or stands behind a block either way is not listed.
create or replace function public.support_candidates() returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  v_day text := game_day_key(now());
begin
  perform enforce_rate('support_list', 0, 60, interval '1 hour');
  return (select coalesce(json_agg(x order by x.online desc, x."paidToday", lower(x.name)), '[]'::json) from (
    select p.id as "userId", coalesce(p.name, 'Sensei') as name, p.level, p.avatar, p.last_active as "lastActive",
      coalesce(p.last_active > now() - interval '5 minutes', false) as online, f.since, c.unit, c.unit_hash as hash,
      exists (select 1 from support_uses u where u.borrower_id = v_me and u.owner_id = p.id and u.game_day = v_day and u.paid) as "paidToday"
    from friends f
    join profiles p on p.id = f.friend_id
    join support_cards c on c.user_id = f.friend_id
    where f.user_id = v_me and c.lend = 'friends' and c.unit is not null and not social_is_blocked(v_me, p.id)
    limit 60) x);
end $$;

-- Borrow p_owner's Support Student p_unit for one battle (at battle start). Idempotent by p_key. The borrower
-- lock is taken first, then the LENDER's card row (for update): two friends borrowing at once from one lender
-- are serialised, so the lender's daily cap holds. Refusals: 'stale_day' (p_day is not today's game day: the
-- client retries a key only while its game day is unchanged), 'unavailable' (not a friend, a block either way,
-- lends to nobody, no girl), 'stale_card' (she is not the lent girl any more). A use the caps or the rules do
-- not pay is still recorded, unpaid, with `why`.
create or replace function public.use_support(p_owner uuid, p_unit text, p_key uuid, p_day text) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  v_day text := game_day_key(now());
  c support_cards%rowtype;
  u support_uses%rowtype;
  me profiles%rowtype;
  them profiles%rowtype;
  v_since timestamptz;
  v_why text;
begin
  if p_key is null then raise exception 'invalid: missing support key'; end if;
  perform pg_advisory_xact_lock(hashtext(v_me::text || ':support'));
  select * into u from support_uses where borrower_id = v_me and borrower_key = p_key;
  if found then
    select * into c from support_cards where user_id = u.owner_id;
    return json_build_object('key', p_key, 'owner', u.owner_id, 'unitId', u.unit, 'unit', case when c.unit ->> 'id' = u.unit then c.unit end,
      'paid', u.paid, 'why', u.why, 'day', u.game_day, 'replayed', true, 'serverNow', support_now_ms());
  end if;
  if p_day is distinct from v_day then raise exception 'stale_day:%', ms_to_game_reset(); end if;
  if p_owner is null or p_owner = v_me or p_unit is null then raise exception 'invalid: pick a friend''s Support Student'; end if;
  perform enforce_rate('support_use', 2000, 60, interval '1 hour');
  -- the lender lock: every borrow from this lender waits here, so the count below is exact
  select * into c from support_cards where user_id = p_owner for update;
  select since into v_since from friends where user_id = v_me and friend_id = p_owner;
  -- not a friend, a block (either way), lends to nobody, no girl: one answer for all (a block is never shown)
  if not found or c.user_id is null or c.lend <> 'friends' or c.unit is null or social_is_blocked(v_me, p_owner) then
    raise exception 'unavailable: That Support Student isn''t available';
  end if;
  if (c.unit ->> 'id') is distinct from p_unit then raise exception 'stale_card: That Support Student changed. Pick again.'; end if;
  select * into me from profiles where id = v_me;
  select * into them from profiles where id = p_owner;
  v_why := case
    when exists (select 1 from support_uses where borrower_id = v_me and owner_id = p_owner and game_day = v_day and paid) then 'pair'
    when (select count(*) from support_uses where borrower_id = v_me and game_day = v_day and paid) >= 5 then 'borrower_cap'
    when (select count(*) from support_uses where owner_id = p_owner and game_day = v_day and paid) >= 10 then 'lender_cap'
    when v_since > now() - interval '24 hours' then 'new_friend'
    when coalesce(me.created_at > now() - interval '7 days', true) or coalesce(them.created_at > now() - interval '7 days', true) then 'new_account'
    when support_dev_lab(v_me) or support_dev_lab(p_owner) then 'dev_lab'
  end;
  insert into support_uses (borrower_id, owner_id, unit, game_day, borrower_key, paid, why)
    values (v_me, p_owner, p_unit, v_day, p_key, v_why is null, v_why)
    returning * into u;
  update profiles set last_active = now() where id = v_me;
  perform support_housekeeping();
  return json_build_object('key', p_key, 'owner', p_owner, 'unitId', p_unit, 'unit', c.unit, 'paid', u.paid, 'why', u.why,
    'day', v_day, 'replayed', false, 'serverNow', support_now_ms());
end $$;

-- The run reached wave 3 (or won a shorter stage): pays a paying reservation 10 FP to each side, once. The
-- same key answers the same again (the borrower's FP are in the answer). A reservation from an earlier game
-- day is void (paid = false, 0 FP).
create or replace function public.settle_support(p_key uuid) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  u support_uses%rowtype;
begin
  if p_key is null then raise exception 'invalid: missing support key'; end if;
  perform pg_advisory_xact_lock(hashtext(v_me::text || ':support'));
  select * into u from support_uses where borrower_id = v_me and borrower_key = p_key for update;
  if not found then raise exception 'not_found: that borrow is gone'; end if;
  if u.settled_at is null then
    if u.game_day <> game_day_key(now()) then
      update support_uses set paid = false, why = coalesce(why, 'void'), settled_at = now() where id = u.id returning * into u;
    else
      update support_uses set settled_at = now(),
          owner_points = case when paid then 10 else 0 end, borrower_points = case when paid then 10 else 0 end
        where id = u.id returning * into u;
    end if;
    return json_build_object('key', p_key, 'paid', u.paid, 'why', u.why, 'points', u.borrower_points, 'replayed', false, 'serverNow', support_now_ms());
  end if;
  return json_build_object('key', p_key, 'paid', u.paid, 'why', u.why, 'points', u.borrower_points, 'replayed', true, 'serverNow', support_now_ms());
end $$;

-- What Friend Support says today: my lent girl, today's paying borrows, FP lent today, FP to collect.
create or replace function public.support_state() returns json
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  v_day text := game_day_key(now());
  c support_cards%rowtype;
begin
  select * into c from support_cards where user_id = v_me;
  return json_build_object(
    'day', v_day, 'serverNow', support_now_ms(), 'nextReset', (extract(epoch from next_game_reset()) * 1000)::bigint,
    'card', json_build_object('exists', c.user_id is not null, 'unit', c.unit, 'hash', coalesce(c.unit_hash, ''), 'lend', coalesce(c.lend, 'friends')),
    'borrowsPaid', (select count(*) from support_uses where borrower_id = v_me and game_day = v_day and paid),
    'borrowCap', 5,
    'lentToday', (select coalesce(sum(case when paid then 10 else 0 end), 0) from support_uses where owner_id = v_me and game_day = v_day),
    'lendCap', 100,
    'uncollected', support_uncollected(v_me));
end $$;

-- Collect my lender FP. Stamps (with p_key) only the rows that fit p_room = 5,000 − my wallet, oldest
-- first. The same key returns the same total again (support_claims) for 24 h; an older key is refused
-- 'stale_key'. Nothing to collect: total 0 and nothing is stored.
create or replace function public.claim_support_points(p_key uuid, p_room int) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
  k support_claims%rowtype;
  v_room int := least(5000, greatest(0, coalesce(p_room, 0)));
  v_total int := 0;
  r record;
begin
  if p_key is null then raise exception 'invalid: missing collect key'; end if;
  perform pg_advisory_xact_lock(hashtext(v_me::text || ':support'));
  select * into k from support_claims where user_id = v_me and key = p_key;
  if found then
    if k.at < now() - interval '24 hours' then raise exception 'stale_key: that collect is too old'; end if;
    return json_build_object('key', p_key, 'total', k.total, 'replayed', true, 'left', support_uncollected(v_me), 'serverNow', support_now_ms());
  end if;
  for r in
    select id, owner_points from support_uses
     where owner_id = v_me and claim_key is null and owner_points > 0 and settled_at is not null and created_at > now() - interval '7 days'
     order by settled_at, id
     for update
  loop
    exit when v_total + r.owner_points > v_room;
    update support_uses set claim_key = p_key, claimed_at = now() where id = r.id;
    v_total := v_total + r.owner_points;
  end loop;
  if v_total > 0 then insert into support_claims (user_id, key, total) values (v_me, p_key, v_total); end if;
  perform support_housekeeping();
  return json_build_object('key', p_key, 'total', v_total, 'replayed', false, 'left', support_uncollected(v_me), 'serverNow', support_now_ms());
end $$;

-- The hub badge: FP waiting to be collected.
create or replace function public.support_summary() returns json
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := social_me();
begin
  return json_build_object('uncollected', support_uncollected(v_me));
end $$;

-- =============================================================================================
-- 5. Function privileges: revoke everything this file creates (all overloads, by name), then
--    grant only the entry points. tests/online/supportSchema.test.js checks the allow-list.
-- =============================================================================================

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (array[
      'valid_card_unit', 'valid_profile_card', 'support_now_ms', 'support_dev_lab', 'support_uncollected', 'support_housekeeping',
      'support_version', 'set_support', 'my_support', 'support_candidates', 'use_support', 'settle_support', 'support_state',
      'claim_support_points', 'support_summary'])
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

grant execute on function
  public.support_version(), public.set_support(jsonb, text, text), public.my_support(), public.support_candidates(),
  public.use_support(uuid, text, uuid, text), public.settle_support(uuid), public.support_state(),
  public.claim_support_points(uuid, int), public.support_summary()
  to authenticated;

commit;

-- PostgREST picks up the new functions at once
notify pgrst, 'reload schema';
