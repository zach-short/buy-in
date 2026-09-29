-- 0012 — what an RSVP link is for, and no answers to a cancelled game (2026-09-29).
-- Applied to production 2026-09-29.
--
-- /rsvp/<token> told a guest only "you've been invited to a poker game night": no name, no
-- time, no host, and no sign of an answer they had already given. get_rsvp_game is the read
-- that page was missing. web/app/rsvp/[token]/page.tsx falls back to its old, detail-free
-- screen while this is unapplied (PGRST202), so shipping the page first is safe.
--
-- start_scheduled_game (0004) was checked for a double start — two taps, two tabs — and needs
-- no change here: it locks the game row `for update` before reading session_id, so a second
-- call waits for the first to commit, then sees its session_id and returns that same id. The
-- one way to start a game twice is deliberate: deleting its session nulls session_id (0004's
-- `on delete set null (session_id)`), and the game can then be started again.

-- ── get_rsvp_game ────────────────────────────────────────────────────────────
-- security definer for rsvp_scheduled_game's reason: the token, not the caller's RLS, is what
-- authorizes the read — scheduled_games and bar_invite_links are staff-only. The token checks
-- and their raise texts are rsvp_scheduled_game's exactly, so the page maps both calls' errors
-- with one function, and a guesser learns nothing a failed RSVP would not already tell them.
--
-- Returns what the page shows and nothing more. In particular NO game id: 0004's note on
-- game_rsvps' self-write policies holds only while no member-facing read returns one. No
-- other guest's answer and no head count either — a guest sees their own RSVP, not the list.
--
-- host_name is the host's self-chosen sign-up name (raw_user_meta_data.full_name, the same
-- self-asserted field 0008 shows a host for a claimant), never their email; null when unset.
-- my_status is the caller's own answer, null when they have none. A signed-out caller never
-- gets that far: the grant below and the auth check, as rsvp_scheduled_game's, both refuse it.

create function get_rsvp_game(p_token text)
  returns table (game_name text, scheduled_at timestamptz, bar_name text, host_name text,
                 cancelled boolean, started boolean, my_status text)
  language plpgsql security definer stable set search_path = public, pg_temp
as $$
declare
  v_link bar_invite_links%rowtype;
  v_uid  uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'reading an invite requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_link from bar_invite_links where token = p_token;
  if not found or v_link.revoked_at is not null or v_link.expires_at <= now() then
    raise exception 'invalid or expired link' using errcode = 'insufficient_privilege';
  end if;

  if v_link.scheduled_game_id is null then
    raise exception 'not an event invite' using errcode = 'check_violation';
  end if;

  return query
    select g.name, g.scheduled_at, b.name,
           nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
           g.cancelled_at is not null, g.session_id is not null,
           r.status
      from scheduled_games g
      join bars b on b.id = g.bar_id
      left join auth.users u on u.id = g.host_user_id
      left join game_rsvps r on r.scheduled_game_id = g.id and r.user_id = v_uid
     where g.id = v_link.scheduled_game_id;
end;
$$;

-- ── rsvp_scheduled_game, recreated ───────────────────────────────────────────
-- 0004's body, plus one refusal: a cancelled game takes no answers. Its guests would otherwise
-- keep saying "I'm in" to a night that is not happening, and the host's head count would count
-- them. A game already started still takes answers on purpose — a late "I'm in" or "can't make
-- it" is harmless and is exactly what a guest running late would send. Same signature, security,
-- search_path and grants as 0004; `create or replace` keeps the grants, restated below anyway.

create or replace function rsvp_scheduled_game(p_token text, p_status text) returns void
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_link bar_invite_links%rowtype;
  v_uid  uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'responding requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_link from bar_invite_links where token = p_token;
  if not found or v_link.revoked_at is not null or v_link.expires_at <= now() then
    raise exception 'invalid or expired link' using errcode = 'insufficient_privilege';
  end if;

  -- Distinguishable from the error above on purpose: reaching it already required a
  -- live token, so it reveals nothing to a guesser.
  if v_link.scheduled_game_id is null then
    raise exception 'not an event invite' using errcode = 'check_violation';
  end if;

  -- Same reasoning: only a live event token reaches this, and get_rsvp_game tells the same
  -- holder the same fact.
  if exists (select 1 from scheduled_games
              where id = v_link.scheduled_game_id and cancelled_at is not null) then
    raise exception 'game was cancelled' using errcode = 'check_violation';
  end if;

  insert into game_rsvps (scheduled_game_id, user_id, status)
  values (v_link.scheduled_game_id, v_uid, p_status)
  on conflict (scheduled_game_id, user_id) do update set status = excluded.status;
end;
$$;

-- ── function privileges ──────────────────────────────────────────────────────
-- As 0004's rsvp_scheduled_game: authenticated only. The signed-out page keeps its generic prompt;
-- a link-preview bot already has get_invite_preview (0005), which omits the host on purpose.

revoke all on function get_rsvp_game(text) from public, anon, authenticated;
grant execute on function get_rsvp_game(text) to authenticated;
revoke all on function rsvp_scheduled_game(text, text) from public, anon, authenticated;
grant execute on function rsvp_scheduled_game(text, text) to authenticated;
