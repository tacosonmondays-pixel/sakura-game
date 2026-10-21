-- Sakura Sentinels — PROFILE CARD GEAR v2: rainbow UR gear's ✦ marks and the Academy Club on a public card
-- (docs/specs/GEAR_AWAKEN.md §9.2, GEAR_STATS.md §E.3).
--
-- HOW TO RUN IT (owner): AFTER 20261016000000_profile.sql. Open this file on GitHub → Raw → select all →
-- copy; Supabase → SQL Editor → New query → paste → Run. Safe to run more than once. It runs as ONE
-- transaction: on any error nothing at all was changed — press Run again.
--
-- What it changes: a gear substat on a card may carry a 4th number (its ✦ marks, 0–3), and a gear piece
-- may carry `c` (its club, 0–15). Nothing else. A UR piece already fits today's rules (`r: 'ur'`, `l` ≤ 99).
-- The game writes the new fields only after this has run (CARD_GEAR_MARKS in src/online/profileCard.js);
-- until then cards leave them out and are accepted exactly as today.

begin;

-- ["statId", value ≥ 0] (a main stat), or with p_ups: ["statId", value ≥ 0, upgrades 0–9] allowed too
-- (the design sketch had a one-argument version: drop it so a call is never ambiguous)
create or replace function public.profile_stat_ok(p jsonb, p_ups boolean default false) returns boolean
language plpgsql immutable as $$
begin
  if p is null or jsonb_typeof(p) <> 'array' then return false; end if;
  if not (jsonb_array_length(p) = 2 or (p_ups and jsonb_array_length(p) between 3 and 4)) then return false; end if;
  if jsonb_array_length(p) >= 3 and not profile_num(p -> 2, 0, 9, true) then return false; end if;
  -- ✦ stitches (rainbow UR gear): 0–3, 1 = gold, 2 = rainbow
  if jsonb_array_length(p) = 4 and not profile_num(p -> 3, 0, 3, true) then return false; end if;
  return jsonb_typeof(p -> 0) = 'string' and (p ->> 0) ~ '^[a-zA-Z]{1,16}$' and profile_num(p -> 1, 0, 100000, false);
end $$;

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

commit;
