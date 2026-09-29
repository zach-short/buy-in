-- 0008 — claim an existing player row from the standing invite, with host approval and host
-- override (2026-09-29). UNAPPLIED: the owner applies it.
--
-- PASSOFF item 17. The owner's table was migrated from the Go/Mongo app as named `players`
-- rows with balances and history and no linked account (owner, 2026-09-29). The owner texts one
-- invite link; each person signs in, picks their own row, and the host approves the link-up.
-- Four owner answers, 2026-09-29, shape it:
--   1. A claim is PENDING until a host approves it. Until then the claimant sees nothing of the
--      row: no balance, no history, no contact details. Nothing here sets players.user_id
--      except a staff decision, and players_self_read (0001) is what would expose the row.
--   2. The picker shows NAMES of unclaimed players only, to a signed-in holder of a live invite
--      token. No balance, phone, venmo or cashapp.
--   3. All migrated rows are plain guests (user_id null) — the owner's statement, not verified.
--   4. The picker, the approval queue and the host override ship together.
--
-- What it deliberately does not do, whoever asks: make a claimant a bar_members row or widen
-- players_read (0001, "Known and currently unreachable"); touch claim_player or
-- player_claim_links (the per-person link the owner chose not to use); merge a duplicate that
-- has real activity; edit any balance, buy-in or cashout; change join_bar_as_player.
--
-- House rules as 0004 states them: money is integer cents (nothing here touches money);
-- search_path pinned on every function; SECURITY INVOKER wherever the caller's own RLS permits
-- the write — every host function below is invoker, because players_staff and the staff policy
-- on this table already admit a host's writes; SECURITY DEFINER only for the two claimant
-- functions, whose caller can see neither the invite nor the players; no anon policy (D8);
-- every function revoked from public, anon and authenticated by name, granted to
-- authenticated.
--
-- Lock order, everywhere below: players rows first (ascending id when there are two), then
-- player_claim_requests rows. A host approving a request while another swaps the same player
-- would otherwise each hold one lock and wait on the other.

-- ── player_claim_requests ────────────────────────────────────────────────────

create table player_claim_requests (
  id          uuid primary key default gen_random_uuid(),
  bar_id      uuid not null references bars(id) on delete cascade,
  player_id   uuid not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- Who asked, copied from auth.users when the request is made, because the host approving it
  -- cannot read auth.users and would otherwise be approving an anonymous uuid. A copy, not a
  -- live value: the email the account had when it asked is what the host judged.
  requester_email text,
  -- Self-asserted: the claimant's own profile full_name, which they can set to anything
  -- (another player's name included). Hosts should judge a request by requester_email.
  requester_name  text,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  check ((status = 'pending') = (decided_at is null)),
  -- G5, as 0001 applies it everywhere: a request cannot be tagged with one bar while naming
  -- another bar's player, and the staff policy below tests bar_id alone. Cascade: a request for
  -- a row that no longer exists means nothing (reassign_player_account deletes duplicates).
  foreign key (player_id, bar_id) references players(id, bar_id) on delete cascade
);
-- One request in flight per account per table. Decided rows do not count, so a rejected
-- account can ask again (an open question to the owner, PASSOFF item 17 — drop the retry by
-- making this index cover every status, or by refusing in request_player_claim).
create unique index player_claim_requests_one_pending
  on player_claim_requests (bar_id, user_id) where status = 'pending';
create index player_claim_requests_player_idx on player_claim_requests (player_id);
create index player_claim_requests_bar_status_idx on player_claim_requests (bar_id, status, created_at);

alter table player_claim_requests enable row level security;

-- Staff read and decide their bar's requests. The claimant reads their own rows, which is
-- enough to show "waiting for your host" across a reload and nothing else: a player_id opens
-- no players row until user_id is set (players_self_read).
--
-- Exactly what a claimant learns before approval, through claim_requests_self_read: the row's
-- player_id, bar_id, status, created_at and decided_at, and their own copied requester_email
-- and requester_name. Through bar_id, the bar's menu via get_menu (0001), which anyone holding
-- a bar_id can already call. No balance, no history, no contact details of the player row.
--
-- No INSERT or DELETE policy for anyone. Requests are inserted only by request_player_claim
-- (security definer, checks the token), and deleted only by the foreign-key cascades on bars,
-- players and auth.users, which run as the table owner and bypass RLS. Every invoker function
-- below (decide_player_claim, close_stale_claim_requests, and through it swap_player_accounts
-- and reassign_player_account) only UPDATEs this table; unlink_player does not touch it.
--
-- Staff can still UPDATE status directly, without going through decide_player_claim, so a
-- request with status = 'approved' is NOT proof that the account was ever linked to the row.
-- players.user_id is the only fact about who holds a row.
create policy claim_requests_staff_read   on player_claim_requests for select
  using (is_bar_staff(bar_id));
create policy claim_requests_staff_update on player_claim_requests for update
  using (is_bar_staff(bar_id)) with check (is_bar_staff(bar_id));
create policy claim_requests_self_read    on player_claim_requests for select
  using (user_id = (select auth.uid()));

-- ── list_claimable_players ───────────────────────────────────────────────────
-- Decision 2. security definer: the caller holds a token and nothing else in the bar. The
-- token check is join_bar_as_player's (0004), word for word, so missing, revoked and expired
-- share one message. Either kind of invite works, as it does for joining.
--
-- An account that already has a row at this table is refused with its own sentence rather
-- than shown the list: it has nothing to claim, and the page sends it home. Distinguishable
-- on purpose — reaching it already took a live token (0004, rsvp_scheduled_game).
--
-- Returns id and name only. has_pending_request marks a name someone has already asked for,
-- so the picker can say so; it does not say who.

create function list_claimable_players(p_token text)
  returns table (id uuid, name text, has_pending_request boolean)
  language plpgsql security definer stable set search_path = public, pg_temp
as $$
declare
  v_link bar_invite_links%rowtype;
  v_uid  uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'claiming requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_link from bar_invite_links l where l.token = p_token;
  if not found or v_link.revoked_at is not null or v_link.expires_at <= now() then
    raise exception 'invalid or expired link' using errcode = 'insufficient_privilege';
  end if;

  if exists (select 1 from players p where p.bar_id = v_link.bar_id and p.user_id = v_uid) then
    raise exception 'this account is already at this table' using errcode = 'check_violation';
  end if;

  return query
    select p.id, p.name,
           exists (select 1 from player_claim_requests r
                    where r.player_id = p.id and r.status = 'pending')
      from players p
     where p.bar_id = v_link.bar_id and p.user_id is null
     order by p.name, p.id;
end;
$$;

-- ── request_player_claim ─────────────────────────────────────────────────────
-- Decision 1. Records a pending request; links nothing. security definer for the same reason
-- as list_claimable_players, and it reads auth.users for the requester's email and name.
--
-- Idempotent for the same (account, table, player): a double-tap or a reload returns the
-- request already waiting. A different name while one is waiting is refused — the host
-- decides the first before the account can ask again.
--
-- A name someone else has already asked for is NOT refused: two people may pick the same
-- name, and the host decides between them (decide_player_claim approves one and closes the
-- other).

create function request_player_claim(p_token text, p_player_id uuid) returns uuid
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_link     bar_invite_links%rowtype;
  v_uid      uuid := (select auth.uid());
  v_pending  player_claim_requests%rowtype;
  v_email    text;
  v_name     text;
  v_id       uuid;
begin
  if v_uid is null then
    raise exception 'claiming requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_link from bar_invite_links where token = p_token;
  if not found or v_link.revoked_at is not null or v_link.expires_at <= now() then
    raise exception 'invalid or expired link' using errcode = 'insufficient_privilege';
  end if;

  if exists (select 1 from players where bar_id = v_link.bar_id and user_id = v_uid) then
    raise exception 'this account is already at this table' using errcode = 'check_violation';
  end if;

  -- Missing, another bar's, and already claimed share one message: from a token holder's
  -- side they are the same fact, and a distinct "not at this table" would let a holder test
  -- player ids from other bars.
  if not exists (select 1 from players
                  where id = p_player_id and bar_id = v_link.bar_id and user_id is null) then
    raise exception 'that name is no longer available' using errcode = 'check_violation';
  end if;

  select * into v_pending from player_claim_requests
   where bar_id = v_link.bar_id and user_id = v_uid and status = 'pending';
  if found then
    if v_pending.player_id = p_player_id then
      return v_pending.id;
    end if;
    raise exception 'this account already has a request waiting at this table'
      using errcode = 'check_violation';
  end if;

  select u.email, nullif(btrim(u.raw_user_meta_data ->> 'full_name'), '')
    into v_email, v_name
    from auth.users u where u.id = v_uid;

  -- The inner block catches only the insert's own unique_violation: a concurrent call by the
  -- same account landing between the select above and here. It then answers as that select
  -- would have.
  begin
    insert into player_claim_requests (bar_id, player_id, user_id, requester_email, requester_name)
    values (v_link.bar_id, p_player_id, v_uid, v_email, v_name)
    returning id into v_id;
  exception when unique_violation then
    select * into v_pending from player_claim_requests
     where bar_id = v_link.bar_id and user_id = v_uid and status = 'pending';
    if found and v_pending.player_id = p_player_id then
      return v_pending.id;
    end if;
    raise exception 'this account already has a request waiting at this table'
      using errcode = 'check_violation';
  end;

  return v_id;
end;
$$;

-- ── close_stale_claim_requests (internal) ────────────────────────────────────
-- After any write that links an account to a row, every pending request in that bar that can
-- no longer be approved as asked is closed: approved if its account now holds the very row it
-- asked for, rejected if the row went to someone else or the account now holds another row.
-- Without it, a request for a row that a swap filled would sit in the host's queue and fail
-- on approve.
--
-- security invoker, and it cannot be revoked from authenticated: an invoker function calls it
-- with the caller's privileges. It is harmless called directly — it writes only through
-- claim_requests_staff_update, so a non-host updates nothing, and a host can only close requests
-- that are already stale.

create function close_stale_claim_requests(p_bar_id uuid) returns void
  language sql security invoker set search_path = public, pg_temp
as $$
  update player_claim_requests r
     set status = case when exists (select 1 from players p
                                     where p.id = r.player_id and p.user_id = r.user_id)
                       then 'approved' else 'rejected' end,
         decided_at = now()
   where r.bar_id = p_bar_id
     and r.status = 'pending'
     and (exists (select 1 from players p where p.id = r.player_id and p.user_id is not null)
          or exists (select 1 from players p where p.bar_id = r.bar_id and p.user_id = r.user_id));
$$;

-- ── decide_player_claim ──────────────────────────────────────────────────────
-- Decision 1: the host's approve or reject. security invoker — players_staff admits the
-- user_id write and claim_requests_staff_update the status write. The explicit staff test is on the
-- request's own bar_id; a request the caller cannot see and one of another bar share one
-- message (0004, revoke_bar_invite).
--
-- Returns what happened, because an approve can end in a refusal that is not an error:
--   'approved'      the row is now the claimant's; any other pending request for it is closed
--   'rejected'      the host said no
--   'player-taken'  the row was linked to another account first (a second request for the
--                   same name, a swap, a per-person claim link); this request is closed as
--                   rejected, never overwritten
--   'account-taken' the claimant already holds another row at this table (they joined as new
--                   meanwhile); closed as rejected — reassign_player_account is the fix
--
-- Race, as claim_player (0001) closes it: the player row is locked before the request is
-- re-read, and the user_id write carries `user_id is null`, so two approvals for one name
-- serialize and the second sees the first's link. A double-tap on one request re-reads it
-- under the lock and finds it no longer pending.

create function decide_player_claim(p_request_id uuid, p_approve boolean) returns text
  language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_player_id uuid;
  v_bar_id    uuid;
  v_player    players%rowtype;
  v_req       player_claim_requests%rowtype;
begin
  -- `not p_approve` below is null for a null argument, and plpgsql takes a null condition as
  -- false, so a null would fall through to the approve path.
  if p_approve is null then
    raise exception 'p_approve is required' using errcode = 'null_value_not_allowed';
  end if;

  select r.player_id, r.bar_id into v_player_id, v_bar_id
    from player_claim_requests r where r.id = p_request_id;
  if not found or not is_bar_staff(v_bar_id) then
    raise exception 'request not found' using errcode = 'no_data_found';
  end if;

  select * into v_player from players where id = v_player_id for update;
  select * into v_req from player_claim_requests where id = p_request_id for update;
  if not found or v_req.status <> 'pending' then
    raise exception 'this request was already decided' using errcode = 'check_violation';
  end if;

  if not p_approve then
    update player_claim_requests set status = 'rejected', decided_at = now() where id = v_req.id;
    return 'rejected';
  end if;

  if v_player.user_id is not null then
    update player_claim_requests set status = 'rejected', decided_at = now() where id = v_req.id;
    return 'player-taken';
  end if;

  begin
    update players set user_id = v_req.user_id
     where id = v_req.player_id and bar_id = v_req.bar_id and user_id is null;
    if not found then
      raise exception 'player row changed under lock' using errcode = 'internal_error';
    end if;
  exception when unique_violation then
    -- players_bar_user_uniq: the claimant holds another row here. The failed update is rolled
    -- back to this block's savepoint; the request is closed instead.
    update player_claim_requests set status = 'rejected', decided_at = now() where id = v_req.id;
    return 'account-taken';
  end;

  update player_claim_requests set status = 'approved', decided_at = now() where id = v_req.id;
  perform close_stale_claim_requests(v_req.bar_id);
  return 'approved';
end;
$$;

-- ── host override ────────────────────────────────────────────────────────────
-- Decision 4. The host can undo or swap any link, because a friend will pick the wrong name
-- (owner, 2026-09-29). All three are security invoker under players_staff, and each checks
-- is_bar_staff on the target rows' own bar_id; missing and not-yours share 'player not found'.
-- None touches a ledger row: a balance belongs to the player row, and these move only
-- players.user_id — which account reads that row through players_self_read and
-- get_my_performance (0004).

-- unlink_player: the row goes back to unclaimed and the account loses sight of it. Idempotent
-- on a row that is already unlinked. The account's approved request stays as history.
create function unlink_player(p_player_id uuid) returns void
  language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_player players%rowtype;
begin
  select * into v_player from players where id = p_player_id for update;
  if not found or not is_bar_staff(v_player.bar_id) then
    raise exception 'player not found' using errcode = 'no_data_found';
  end if;

  update players set user_id = null where id = p_player_id;
end;
$$;

-- swap_player_accounts: each row takes the other's account. One side may be unlinked, which
-- moves an account onto a row that had none. players_bar_user_uniq is not deferrable, so the
-- two user_ids are cleared first and then set; at no statement do two rows of the bar hold one
-- account.
create function swap_player_accounts(p_a uuid, p_b uuid) returns void
  language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_a players%rowtype;
  v_b players%rowtype;
begin
  if p_a = p_b then
    raise exception 'pick two different players' using errcode = 'check_violation';
  end if;

  perform 1 from players where id in (p_a, p_b) order by id for update;
  select * into v_a from players where id = p_a;
  if not found or not is_bar_staff(v_a.bar_id) then
    raise exception 'player not found' using errcode = 'no_data_found';
  end if;
  select * into v_b from players where id = p_b;
  if not found or v_b.bar_id <> v_a.bar_id then
    raise exception 'player not found' using errcode = 'no_data_found';
  end if;

  if v_a.user_id is null and v_b.user_id is null then
    raise exception 'neither player is linked to an account' using errcode = 'check_violation';
  end if;

  update players set user_id = null where id in (p_a, p_b);
  update players set user_id = v_b.user_id where id = p_a;
  update players set user_id = v_a.user_id where id = p_b;

  perform close_stale_claim_requests(v_a.bar_id);
end;
$$;

-- reassign_player_account: for an account that joined as a new player (join_bar_as_player)
-- instead of claiming its real row. Moves the account from p_from to p_to and deletes p_from —
-- only when p_from has no ledger or seat of any kind. Anything else is a merge, which is out of
-- scope and left to the owner by hand. The p_from lock blocks a concurrent insert that would
-- reference it (a foreign-key check takes KEY SHARE on the parent row), so the emptiness test
-- holds until the delete; the ledger's RESTRICT keys (0001) would refuse the delete anyway, and
-- session_players, which cascades, is what the test is really for.
create function reassign_player_account(p_from uuid, p_to uuid) returns void
  language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_from players%rowtype;
  v_to   players%rowtype;
begin
  if p_from = p_to then
    raise exception 'pick two different players' using errcode = 'check_violation';
  end if;

  perform 1 from players where id in (p_from, p_to) order by id for update;
  select * into v_from from players where id = p_from;
  if not found or not is_bar_staff(v_from.bar_id) then
    raise exception 'player not found' using errcode = 'no_data_found';
  end if;
  select * into v_to from players where id = p_to;
  if not found or v_to.bar_id <> v_from.bar_id then
    raise exception 'player not found' using errcode = 'no_data_found';
  end if;

  if v_from.user_id is null then
    raise exception 'that player is not linked to an account' using errcode = 'check_violation';
  end if;
  if v_to.user_id is not null then
    raise exception 'that player is already linked to an account' using errcode = 'check_violation';
  end if;

  if exists (select 1 from buy_ins         where player_id = p_from)
     or exists (select 1 from cashouts     where player_id = p_from)
     or exists (select 1 from orders       where player_id = p_from)
     or exists (select 1 from payments     where player_id = p_from or counterparty_player_id = p_from)
     or exists (select 1 from session_players where player_id = p_from) then
    raise exception 'that player has history at this table and cannot be removed'
      using errcode = 'restrict_violation';
  end if;

  delete from players where id = p_from;
  if not found then
    raise exception 'player not found' using errcode = 'no_data_found';
  end if;

  update players set user_id = v_from.user_id where id = p_to and user_id is null;
  if not found then
    raise exception 'that player is already linked to an account' using errcode = 'check_violation';
  end if;

  perform close_stale_claim_requests(v_from.bar_id);
end;
$$;

-- ── function privileges ──────────────────────────────────────────────────────
-- As 0001–0004: revoke from public, anon and authenticated by name, then grant back to
-- authenticated only. None is callable anonymously; each claimant function checks
-- auth.uid() itself and each host function checks is_bar_staff.

revoke all on function list_claimable_players(text) from public, anon, authenticated;
revoke all on function request_player_claim(text, uuid) from public, anon, authenticated;
revoke all on function close_stale_claim_requests(uuid) from public, anon, authenticated;
revoke all on function decide_player_claim(uuid, boolean) from public, anon, authenticated;
revoke all on function unlink_player(uuid) from public, anon, authenticated;
revoke all on function swap_player_accounts(uuid, uuid) from public, anon, authenticated;
revoke all on function reassign_player_account(uuid, uuid) from public, anon, authenticated;
grant execute on function list_claimable_players(text) to authenticated;
grant execute on function request_player_claim(text, uuid) to authenticated;
grant execute on function close_stale_claim_requests(uuid) to authenticated;
grant execute on function decide_player_claim(uuid, boolean) to authenticated;
grant execute on function unlink_player(uuid) to authenticated;
grant execute on function swap_player_accounts(uuid, uuid) to authenticated;
grant execute on function reassign_player_account(uuid, uuid) to authenticated;
