-- 0004 — self-service onboarding: default buy-in, scheduled games, invites, RSVPs,
-- and a player's own win/loss history (2026-09-28).
--
-- New scope beyond the 11-phase migration plan; neither DESIGN.md nor PLAN.md covers it.
-- Four owner decisions shape it:
--   1. A member joins by invite link or code only — there is no public directory.
--   2. A joined member is a claimed `players` row, NOT a `bar_members` row. This keeps
--      D16's flagged gap closed: 0001's players_read lets any member read every player's
--      phone, venmo and cashapp, and it is unreachable only because nothing creates a
--      non-staff member (0001, "Known and currently unreachable"). Nothing here does.
--   3. A scheduled game is its own concept, separate from `sessions`, which stays
--      "tonight's live game". Starting one creates a session the same way start_session
--      (0002) does.
--   4. The default buy-in is one bar-wide setting, not per player.
--
-- House rules carried over from 0001–0003, not restated at each site: money is integer
-- cents; every function pins `search_path = public, pg_temp`; SECURITY INVOKER wherever
-- the caller's own RLS already permits the write; SECURITY DEFINER only where a caller
-- must act on a row RLS would hide from them, and then scoped to auth.uid(); no anon
-- policy on any table (D8); every function revoked from public, anon and authenticated
-- by name and granted back to authenticated only.

-- ── bars.default_buy_in_cents ────────────────────────────────────────────────
-- Decision 4. The web's only default buy-in today is session/new/page.tsx's hard-coded
-- `useState('20')`; the 2000 default preserves that value for every existing bar. Nothing
-- reads this column yet. Hosts edit it under the existing bars_owner_write policy (0001),
-- as with venmo_note_template in 0003 — no new policy.

alter table bars add column default_buy_in_cents integer not null default 2000;

-- Every other money column in 0001 carries a sign check. Zero is allowed: start_session
-- (0002) already treats a zero buy-in as "write no buy_ins row".
alter table bars add constraint bars_default_buy_in_cents_nonneg
  check (default_buy_in_cents >= 0);

-- ── scheduled_games ──────────────────────────────────────────────────────────
-- Decision 3. A future game night. session_id stays null until the host starts it.

create table scheduled_games (
  id           uuid primary key default gen_random_uuid(),
  bar_id       uuid not null references bars(id) on delete cascade,
  host_user_id uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  scheduled_at timestamptz not null,
  session_id   uuid,
  cancelled_at timestamptz,
  created_at   timestamptz not null default now(),
  -- G5: lets bar_invite_links reference (scheduled_game_id, bar_id) as a pair.
  unique (id, bar_id),
  -- G5, as 0001 applies it to every foreign key including the nullable ones: a staff
  -- writer cannot point their bar's game at another bar's session. PG15 column-list
  -- SET NULL: deleting the session nulls session_id only and leaves bar_id intact.
  foreign key (session_id, bar_id)
    references sessions(id, bar_id) on delete set null (session_id)
);
create index scheduled_games_bar_idx on scheduled_games (bar_id, scheduled_at);

-- ── bar_invite_links ─────────────────────────────────────────────────────────
-- Decision 1. One primitive for both invites: scheduled_game_id null is the standing
-- "join my table" link; set, it is one game night's link, which also lets its holder
-- RSVP. Same token shape and 30-day dial as player_share_links (0001), because these
-- are texted too. A token is a credential, so the table is staff-only, as 0001's share
-- and claim links are.

create table bar_invite_links (
  token             text primary key default encode(extensions.gen_random_bytes(24), 'hex'),
  bar_id            uuid not null references bars(id) on delete cascade,
  created_by        uuid not null references auth.users(id) on delete cascade,
  scheduled_game_id uuid,
  expires_at        timestamptz not null default now() + interval '30 days',
  revoked_at        timestamptz,
  created_at        timestamptz not null default now(),
  -- G5, and load-bearing here: the staff policy below tests bar_id alone. Without the
  -- pair, a host of bar A could mint an A-tagged link naming bar B's game, and its
  -- holder would RSVP into B's headcount. MATCH SIMPLE skips the check for a standing
  -- invite, whose scheduled_game_id is null.
  foreign key (scheduled_game_id, bar_id)
    references scheduled_games(id, bar_id) on delete cascade
);
create index bar_invite_links_bar_idx on bar_invite_links (bar_id);
create index bar_invite_links_scheduled_game_idx on bar_invite_links (scheduled_game_id);

-- ── game_rsvps ───────────────────────────────────────────────────────────────
-- Keyed to the auth user, not to a players row: an RSVP is an account's answer, and
-- carries no bar_id, so G5 has no pair to pin here.

create table game_rsvps (
  id                uuid primary key default gen_random_uuid(),
  scheduled_game_id uuid not null references scheduled_games(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  status            text not null check (status in ('yes', 'no', 'maybe')),
  created_at        timestamptz not null default now(),
  unique (scheduled_game_id, user_id)
);
create index game_rsvps_user_idx on game_rsvps (user_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table scheduled_games  enable row level security;
alter table bar_invite_links enable row level security;
alter table game_rsvps       enable row level security;

-- Staff only, with no member read policy, as 0001 does for share and claim links.
-- bar_id alone is sound on bar_invite_links because the composite key above pins it
-- to the scheduled game's own bar.
create policy scheduled_games_staff on scheduled_games  for all using (is_bar_staff(bar_id)) with check (is_bar_staff(bar_id));
create policy invite_links_staff    on bar_invite_links for all using (is_bar_staff(bar_id)) with check (is_bar_staff(bar_id));

-- An account reads and writes its own answer; staff read every answer to their bar's
-- games, which is the headcount. Permissive policies are OR'd (0001, D16).
create policy game_rsvps_self_read   on game_rsvps for select using (user_id = (select auth.uid()));
create policy game_rsvps_self_insert on game_rsvps for insert with check (user_id = (select auth.uid()));
create policy game_rsvps_self_update on game_rsvps for update
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy game_rsvps_staff_read  on game_rsvps for select using (
  exists (select 1 from scheduled_games g
           where g.id = game_rsvps.scheduled_game_id and is_bar_staff(g.bar_id))
);

-- Known and currently unreachable, in the manner of 0001's players_read note: the two
-- self-write policies check only user_id, so a direct insert or update skips the token
-- that rsvp_scheduled_game requires. What keeps that closed is that a scheduled game's
-- id reaches no non-staff account except through that account's own RSVP rows —
-- scheduled_games and bar_invite_links are staff-only, and nothing below returns a game
-- id. The day a member-facing read returns scheduled game ids, these two policies need
-- the same token or membership test the RPC applies; do not add that read without it.

-- ── create_bar_invite ────────────────────────────────────────────────────────
-- security invoker: invite_links_staff already admits the insert for staff. The explicit
-- check is for a sentence rather than an RLS error, and the game lookup mirrors
-- create_order's drink lookup — under the caller's RLS, another bar's game is not found.

create function create_bar_invite(p_bar_id uuid, p_scheduled_game_id uuid default null)
  returns text
  language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_token text;
begin
  if not is_bar_staff(p_bar_id) then
    raise exception 'only a host can create an invite' using errcode = 'insufficient_privilege';
  end if;

  if p_scheduled_game_id is not null and not exists (
    select 1 from scheduled_games where id = p_scheduled_game_id and bar_id = p_bar_id
  ) then
    raise exception 'scheduled game not found' using errcode = 'no_data_found';
  end if;

  insert into bar_invite_links (bar_id, created_by, scheduled_game_id)
  values (p_bar_id, (select auth.uid()), p_scheduled_game_id)
  returning token into v_token;

  return v_token;
end;
$$;

-- ── revoke_bar_invite ────────────────────────────────────────────────────────
-- Staff-checked through the link's own bar_id. Missing and not-yours share one message,
-- as get_shared_tab's do: distinguishable errors would be an oracle for which tokens
-- exist. A second revoke keeps the first timestamp but still succeeds.

create function revoke_bar_invite(p_token text) returns void
  language plpgsql security invoker set search_path = public, pg_temp
as $$
begin
  update bar_invite_links set revoked_at = coalesce(revoked_at, now())
   where token = p_token and is_bar_staff(bar_id);
  if not found then
    raise exception 'invite not found' using errcode = 'no_data_found';
  end if;
end;
$$;

-- ── join_bar_as_player ───────────────────────────────────────────────────────
-- Decisions 1 and 2. security definer because the joiner is not yet anything in the
-- bar: no policy lets them see the invite or insert a player. Either kind of invite
-- joins — an event invite's holder is joining the table as well as the night.
--
-- Like claim_player (0001, BD-8) this deliberately does NOT insert a bar_members row.
-- The joined member is a claimed player, the same trust level as claim_player's target
-- and never staff: players_self_read lets them see their own row and nothing else, and
-- D16's *_staff policies refuse them every write. Admitting them as a 'player' member
-- instead would hand them every other player's phone and venmo through players_read.
--
-- Idempotent on (bar_id, user_id), the players_bar_user_uniq pair: reusing the link, or
-- a double-tap, returns the row this account already has instead of an error.

create function join_bar_as_player(p_token text, p_name text) returns uuid
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_link      bar_invite_links%rowtype;
  v_uid       uuid := (select auth.uid());
  v_name      text := nullif(btrim(p_name), '');
  v_player_id uuid;
begin
  if v_uid is null then
    raise exception 'joining requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_link from bar_invite_links where token = p_token;
  if not found or v_link.revoked_at is not null or v_link.expires_at <= now() then
    raise exception 'invalid or expired link' using errcode = 'insufficient_privilege';
  end if;

  select id into v_player_id from players where bar_id = v_link.bar_id and user_id = v_uid;
  if found then
    return v_player_id;
  end if;

  if v_name is null then
    raise exception 'a name is required to join' using errcode = 'check_violation';
  end if;

  -- The conflict target covers a concurrent call by the same account landing between
  -- the select above and this insert; it then re-reads the row that call created.
  insert into players (bar_id, user_id, name) values (v_link.bar_id, v_uid, v_name)
  on conflict (bar_id, user_id) where user_id is not null do nothing
  returning id into v_player_id;
  if v_player_id is null then
    select id into v_player_id from players where bar_id = v_link.bar_id and user_id = v_uid;
  end if;

  return v_player_id;
exception
  -- players_bar_name_uniq (D10): the host already has a guest by this name. Caught for
  -- a sentence, as claim_player catches players_bar_user_uniq. The guest row may be this
  -- very person, which is claim_player's job, not this function's.
  when unique_violation then
    raise exception 'a player named % is already at this table', v_name
      using errcode = 'unique_violation';
end;
$$;

-- ── rsvp_scheduled_game ──────────────────────────────────────────────────────
-- security definer for the same reason as join_bar_as_player: the token, not the
-- caller's RLS, is what authorizes the answer. Upserts, so changing an answer is the
-- same call.

create function rsvp_scheduled_game(p_token text, p_status text) returns void
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

  insert into game_rsvps (scheduled_game_id, user_id, status)
  values (v_link.scheduled_game_id, v_uid, p_status)
  on conflict (scheduled_game_id, user_id) do update set status = excluded.status;
end;
$$;

-- ── create_scheduled_game ────────────────────────────────────────────────────
-- security invoker: scheduled_games_staff admits the insert. The explicit check is for
-- a sentence rather than an RLS error.

create function create_scheduled_game(p_bar_id uuid, p_name text, p_scheduled_at timestamptz)
  returns uuid
  language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not is_bar_staff(p_bar_id) then
    raise exception 'only a host can schedule a game' using errcode = 'insufficient_privilege';
  end if;

  insert into scheduled_games (bar_id, host_user_id, name, scheduled_at)
  values (p_bar_id, (select auth.uid()), p_name, p_scheduled_at)
  returning id into v_id;

  return v_id;
end;
$$;

-- ── start_scheduled_game ─────────────────────────────────────────────────────
-- Decision 3. The session insert is start_session's (0002) exactly — `(bar_id, name)`,
-- nothing else — so a session born from a schedule is indistinguishable from one born
-- on /session/new: played_on is when the game actually started, not when it was
-- planned. It seats nobody: the host adds players afterwards through add_session_player
-- (0002), and an RSVP is not a seat.
--
-- The row lock makes a double-tap return the first call's session instead of creating
-- two; a game already started returns its session rather than raising, for the same
-- reason join_bar_as_player is idempotent.

create function start_scheduled_game(p_scheduled_game_id uuid) returns uuid
  language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_game       scheduled_games%rowtype;
  v_session_id uuid;
begin
  select * into v_game from scheduled_games where id = p_scheduled_game_id for update;
  if not found or not is_bar_staff(v_game.bar_id) then
    raise exception 'scheduled game not found' using errcode = 'no_data_found';
  end if;

  if v_game.cancelled_at is not null then
    raise exception 'scheduled game is cancelled' using errcode = 'check_violation';
  end if;

  if v_game.session_id is not null then
    return v_game.session_id;
  end if;

  insert into sessions (bar_id, name) values (v_game.bar_id, v_game.name)
  returning id into v_session_id;

  update scheduled_games set session_id = v_session_id where id = p_scheduled_game_id;

  return v_session_id;
end;
$$;

-- ── get_my_performance ───────────────────────────────────────────────────────
-- The player-facing win/loss page. security definer because it reads across every bar
-- the caller holds a claimed player in, and the caller is a member of none of them.
-- Scoped to `players.user_id = auth.uid()` and nothing wider. That is the precedent
-- claim_player set (0001, BD-4/BD-8): claiming binds a row to an account, and what it
-- buys is players_self_read — the account reads the rows bound to it and nothing else.
-- This extends that same boundary to those rows' buy-ins and cashouts, not past it. A
-- null auth.uid() matches no row.
--
-- net_cents is cashouts minus buy-ins, per session. Its sign is deliberately the
-- OPPOSITE of computeBalanceCents (@pb/core), where positive means the player owes the
-- house: this is the player's own view, so positive means they won. Orders and payments
-- are not poker results and are left out. A session still in play shows its buy-ins
-- as a loss until the cashout is recorded.
--
-- stakes_cents is the bar's CURRENT default_buy_in_cents, not a record of that night's
-- stakes — nothing stores those per session.
--
-- The union keeps one row per money movement before grouping; joining buy_ins to
-- cashouts directly would multiply each side by the other's row count.

create function get_my_performance()
  returns table (bar_id uuid, bar_name text, session_id uuid, session_name text,
                 played_on timestamptz, stakes_cents integer, net_cents integer)
  language sql security definer stable set search_path = public, pg_temp
as $$
  with mine as (
    select p.id from players p where p.user_id = (select auth.uid())
  ), movements as (
    select b.session_id, -b.amount_cents as delta_cents
      from buy_ins b join mine on mine.id = b.player_id
    union all
    select c.session_id, c.amount_cents
      from cashouts c join mine on mine.id = c.player_id
  )
  select s.bar_id, br.name, s.id, s.name, s.played_on, br.default_buy_in_cents,
         sum(m.delta_cents)::integer
    from movements m
    join sessions s on s.id = m.session_id
    join bars br on br.id = s.bar_id
   group by s.bar_id, br.name, s.id, s.name, s.played_on, br.default_buy_in_cents
   order by s.played_on, s.id;
$$;

-- ── function privileges ──────────────────────────────────────────────────────
-- As 0001 and 0002: revoke from public, anon and authenticated by name, then grant back
-- to authenticated only. None of these is callable anonymously — joining and answering
-- both require an account, and each checks auth.uid() itself.

revoke all on function create_bar_invite(uuid, uuid) from public, anon, authenticated;
revoke all on function revoke_bar_invite(text) from public, anon, authenticated;
revoke all on function join_bar_as_player(text, text) from public, anon, authenticated;
revoke all on function rsvp_scheduled_game(text, text) from public, anon, authenticated;
revoke all on function create_scheduled_game(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function start_scheduled_game(uuid) from public, anon, authenticated;
revoke all on function get_my_performance() from public, anon, authenticated;
grant execute on function create_bar_invite(uuid, uuid) to authenticated;
grant execute on function revoke_bar_invite(text) to authenticated;
grant execute on function join_bar_as_player(text, text) to authenticated;
grant execute on function rsvp_scheduled_game(text, text) to authenticated;
grant execute on function create_scheduled_game(uuid, text, timestamptz) to authenticated;
grant execute on function start_scheduled_game(uuid) to authenticated;
grant execute on function get_my_performance() to authenticated;
