-- 0022 — a member sees the next game at each table they sit at, and answers it in the app
-- (2026-09-29, PASSOFF.md item 21, member-home SCOPE.md §3 O3(c)). Applied to production
-- 2026-09-29 by the owner, after commit 59f0027.
--
-- Three parts in one file, because the read is only safe with the policy change beside it:
--   1. get_my_upcoming_games() — per table the caller holds a claimed players row at, the
--      soonest game not cancelled, not started and inside the window. This is the first
--      member-facing read that returns scheduled game ids.
--   2. rsvp_my_game() — answers one of those games by id, behind the same membership test.
--   3. game_rsvps_self_insert and game_rsvps_self_update are dropped. 0004 kept them only while
--      "nothing below returns a game id" (0004_onboarding.sql:120-126); part 1 ends that, so
--      without this any signed-in account holding a game id could insert an RSVP to any bar's
--      game straight through PostgREST.
--
-- ── game_rsvps: who writes ───────────────────────────────────────────────────
-- Supersedes 0004's note on the self-write policies. Every RSVP write now goes through one of
-- two security definer functions, which RLS does not gate and each of which carries its own
-- test: rsvp_scheduled_game (0004, recreated in 0012) requires a live event invite token, and
-- rsvp_my_game (below) requires a claimed players row at the game's bar. No client has insert,
-- update or delete through RLS. What stays: game_rsvps_self_read (an account reads its own
-- answers) and game_rsvps_staff_read (the host's headcount). grep over web/lib, web/hooks,
-- web/components and web/app on 2026-09-29 found only reads of game_rsvps, so no client write
-- breaks.

drop policy game_rsvps_self_insert on game_rsvps;
drop policy game_rsvps_self_update on game_rsvps;

-- ── get_my_upcoming_games ────────────────────────────────────────────────────
-- security definer for get_my_performance's reason (0004): scheduled_games is staff-only and
-- the caller is staff at none of these bars. Scoped by the mine CTE to players.user_id =
-- auth.uid() — the boundary get_my_performance and get_my_tables (0010) use — so a null uid
-- matches no row, and leaving a table (0010, user_id to null) drops its game with it.
--
-- Returns the caller's own status and nothing else about the game's answers: no other
-- player's RSVP, no head count, no host.
--
-- "Upcoming" is the host's rule (fetchUpcomingGames, web/lib/supabase/scheduled-games.ts):
-- cancelled_at null and session_id null. Two dials narrow it for a member, both from
-- web/lib/config.ts rather than literals here (owner, 2026-09-29, SCOPE §7): only games up to
-- p_window_days ahead, and a game still unstarted more than p_stale_hours after its time is
-- hidden. Both are clamped at zero, so the lower bound is never later than now(): a caller
-- cannot skip the soonest future game to reach the next one, and one game per table stays one.
-- The dials are the caller's, not a server rule (Fable 5.1 review, 2026-09-29): a caller who
-- passes a huge p_stale_hours gets an older game still unstarted at their OWN table instead of
-- the soonest. That is their own table's data, one row per table, and rsvp_my_game would admit
-- the answer anyway; a huge p_window_days raises "timestamp out of range" rather than reading.

create function get_my_upcoming_games(p_window_days integer, p_stale_hours integer)
  returns table (bar_id uuid, game_id uuid, name text, scheduled_at timestamptz, my_status text)
  language sql security definer stable set search_path = public, pg_temp
as $$
  with mine as (
    select distinct p.bar_id from players p where p.user_id = (select auth.uid())
  )
  select distinct on (g.bar_id) g.bar_id, g.id, g.name, g.scheduled_at, r.status
    from scheduled_games g
    join mine on mine.bar_id = g.bar_id
    left join game_rsvps r on r.scheduled_game_id = g.id and r.user_id = (select auth.uid())
   where g.cancelled_at is null
     and g.session_id is null
     and g.scheduled_at >= now() - make_interval(hours => greatest(coalesce(p_stale_hours, 0), 0))
     and g.scheduled_at <= now() + make_interval(days => greatest(coalesce(p_window_days, 0), 0))
   order by g.bar_id, g.scheduled_at, g.id;
$$;

-- ── rsvp_my_game ─────────────────────────────────────────────────────────────
-- The in-app answer, by game id instead of token. The membership test stands in for the token:
-- the game's bar must be one where the caller holds a claimed players row. A missing game and
-- a game at someone else's table raise the same error, so an id guesser learns nothing.
--
-- Raise style is rsvp_scheduled_game's (0012): insufficient_privilege for who you are,
-- check_violation for the game's state, and 'game was cancelled' word for word, so
-- web/lib/supabase/rsvp.ts maps both paths with one function. One deliberate difference: a
-- started game is refused here. 0012 lets a late answer through the link on purpose, but the
-- card never shows a started game, so an answer to one can only be a stale tab.
--
-- The game row is locked `for share`, so a cancel or start committing at the same moment
-- either lands first and is refused here, or waits until this answer commits.

create function rsvp_my_game(p_game_id uuid, p_status text) returns void
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_game scheduled_games%rowtype;
begin
  if v_uid is null then
    raise exception 'responding requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  select g.* into v_game
    from scheduled_games g
   where g.id = p_game_id
     and exists (select 1 from players p where p.bar_id = g.bar_id and p.user_id = v_uid)
     for share of g;
  if not found then
    raise exception 'not at this table' using errcode = 'insufficient_privilege';
  end if;

  -- After the membership test, so a caller at no table gets the one refusal whatever they send.
  if p_status is null or p_status not in ('yes', 'no', 'maybe') then
    raise exception 'status must be yes, no or maybe' using errcode = 'check_violation';
  end if;

  if v_game.cancelled_at is not null then
    raise exception 'game was cancelled' using errcode = 'check_violation';
  end if;

  if v_game.session_id is not null then
    raise exception 'game has already started' using errcode = 'check_violation';
  end if;

  insert into game_rsvps (scheduled_game_id, user_id, status)
  values (v_game.id, v_uid, p_status)
  on conflict (scheduled_game_id, user_id) do update set status = excluded.status;
end;
$$;

-- ── function privileges ──────────────────────────────────────────────────────
-- As 0004: revoke from public, anon and authenticated by name, then grant back to
-- authenticated only. Both check auth.uid() themselves as well.

revoke all on function get_my_upcoming_games(integer, integer) from public, anon, authenticated;
revoke all on function rsvp_my_game(uuid, text) from public, anon, authenticated;
grant execute on function get_my_upcoming_games(integer, integer) to authenticated;
grant execute on function rsvp_my_game(uuid, text) to authenticated;
