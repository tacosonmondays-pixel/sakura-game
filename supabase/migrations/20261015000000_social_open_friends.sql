-- Sakura Sentinels — open friend requests (owner request, 2026-10-15): "You should be able to add
-- them no matter what, even from global chat".
--
-- Before: a friend request needed a link between the two players (same clan, a co-op game in the
-- last 7 days, or the friend code). Now anyone can ask from a player card anywhere, global chat
-- included. Nothing else changes:
--   * the other player still has to Accept;
--   * private messages still follow "Who can message me" (Friends only by default), so a request
--     is the only thing a stranger can send;
--   * the existing guards still hold: 10 requests an hour per sender, 10 a day per recipient (a
--     day-old account counts twice), a pending queue of 30, 50 friends, and a request to someone
--     who blocked you (or whose setting is Nobody) is swallowed without a trace.
--
-- Paste AFTER 20261013000000_social.sql (and again right after it if that file is ever pasted
-- again). Safe to run more than once. The game needs no update: the player card asks the server
-- whether Add friend is allowed.

begin;

-- a request with no clan / co-op link is stored as via = 'any' (shown as "wants to be friends")
alter table public.friend_requests drop constraint if exists friend_requests_via_check;
alter table public.friend_requests add constraint friend_requests_via_check
  check (via in ('clan', 'coop', 'code', 'any'));

-- the link a request comes through; never null any more, so player_card offers Add friend and
-- send_friend_request accepts it for anyone
create or replace function public.social_friend_context(p_me uuid, p_other uuid) returns text
language sql stable security invoker set search_path = public, pg_temp as $$
  select case
    when social_clanmates(p_me, p_other, 0) then 'clan'
    when exists (select 1 from coop_partners where user_id = p_me and partner_id = p_other and last_at > now() - interval '7 days') then 'coop'
    else 'any' end
$$;
revoke all on function public.social_friend_context(uuid, uuid) from public, anon, authenticated;

commit;
