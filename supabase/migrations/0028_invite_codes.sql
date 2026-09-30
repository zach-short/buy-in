-- 0028 — invite codes, and a host kicking a player (2026-09-29). Applied to production 2026-09-29 (HANDOFF step 73).
--
-- docs/incomplete/invite-codes/SCOPE.md §6 holds the owner's answers this implements (A1–A10)
-- and §8 the build decisions (BD-1–BD-4). In short:
--   * A standing (table) invite is one of three kinds: 'link' (every row before this migration),
--     'code' (a code and no shown link) or 'both'. A code-bearing invite is created with a random
--     4–6 digit code; a host may change it to 4–8 letters or digits.
--   * A code works for 24 hours from when it was made or last changed. A 'both' invite's link
--     outlives its code and can be given a new one; a 'code' invite expires with its code.
--   * Guessing is capped: 5 wrong code lookups per account per 15 minutes. A host's rename that
--     collides with a live code counts as a wrong try too, or it would be an unlimited oracle
--     for which codes are live (SCOPE H2).
--   * kick_player unlinks and archives a player whose balance is exactly zero, then revokes and
--     replaces every live table invite of the bar.
--
-- A code is only an alias. resolve_invite_code hands a signed-in caller the token, and every
-- existing invite RPC (0004, 0008, 0012, 0026) keeps taking tokens unchanged (BD-2). A 'code'
-- invite still has a token; the web never shows it (BD-1).
--
-- House rules as 0004 states them: search_path pinned; SECURITY DEFINER only with an explicit
-- authority test; every client function revoked from public, anon and authenticated by name and
-- granted back to authenticated only; internal helpers revoked outright and reachable only from
-- the definer functions below, which run as their owner (0010's player_balance_cents pattern).
--
-- Not covered, on purpose: game-night invites (scheduled_game_id set) get no code (A3), and
-- kick_player does not revoke them — replacing them would break RSVP links already sent to the
-- rest of the table. join_bar_as_player (0004) still accepts an event token, so a kicked account
-- holding one can rejoin through it. Raised with the owner 2026-09-29; open.

-- ── bar_invite_links: kind and code ──────────────────────────────────────────
-- Codes are stored upper-cased so the unique index is case-insensitive without an expression.
-- The index covers every non-null code; a lapsed or revoked code is set to null by
-- clear_lapsed_invite_codes before any code is written, because an index predicate cannot
-- read now() (SCOPE H3).

alter table bar_invite_links
  add column kind            text not null default 'link',
  add column code            text,
  add column code_length     smallint,
  add column code_expires_at timestamptz,
  add constraint bar_invite_links_kind_check check (kind in ('link', 'code', 'both')),
  add constraint bar_invite_links_code_shape check (code is null or code ~ '^[A-Z0-9]{4,8}$'),
  add constraint bar_invite_links_code_length_check check (
    (kind = 'link' and code_length is null) or (kind <> 'link' and code_length between 4 and 6)
  ),
  add constraint bar_invite_links_code_kind_check check (code is null or kind <> 'link'),
  -- A3: codes are for table invites only.
  add constraint bar_invite_links_code_standing check (kind = 'link' or scheduled_game_id is null);

create unique index bar_invite_links_code_uniq on bar_invite_links (code) where code is not null;

-- ── invite_code_attempts ─────────────────────────────────────────────────────
-- One row per wrong try. RLS on and no policy: only the definer functions below touch it. Rows
-- older than a day are pruned per account on each check; they can never count again.

create table invite_code_attempts (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index invite_code_attempts_user_idx on invite_code_attempts (user_id, attempted_at);
alter table invite_code_attempts enable row level security;
revoke all on table invite_code_attempts from public, anon, authenticated;

-- ── internal helpers ─────────────────────────────────────────────────────────

-- Uniform over 0..10^n-1 up to a bias of 10^6 / 2^32 at worst, from the same CSPRNG the tokens
-- use (0004). Zero-padded, so 0042 is a four-digit code.
create function random_invite_code(p_length integer) returns text
  language sql volatile set search_path = public, pg_temp
as $$
  select lpad(
    ((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint)
      % power(10, p_length)::bigint)::text,
    p_length, '0');
$$;

create function clear_lapsed_invite_codes() returns void
  language sql set search_path = public, pg_temp
as $$
  update bar_invite_links set code = null
   where code is not null
     and (code_expires_at <= now() or revoked_at is not null or expires_at <= now());
$$;

-- PT429 is PostgREST's "set the HTTP status" SQLSTATE: the client sees 429 and code 'PT429'.
-- Raising discards the prune, which is harmless; the next call prunes again.
create function check_invite_code_limit(p_uid uuid) returns void
  language plpgsql set search_path = public, pg_temp
as $$
begin
  delete from invite_code_attempts
   where user_id = p_uid and attempted_at < now() - interval '1 day';
  if (select count(*) from invite_code_attempts
       where user_id = p_uid and attempted_at > now() - interval '15 minutes') >= 5 then
    raise exception 'too many tries — wait a few minutes and try again' using errcode = 'PT429';
  end if;
end;
$$;

-- Gives the invite a fresh random code of its own length, live for 24 hours. A 'code' invite's
-- expiry follows its code (A8). A draw that collides with another live code is drawn again;
-- 20 collisions in a row means the length is nearly full, and the host is told to go longer.
create function assign_invite_code(p_token text) returns text
  language plpgsql set search_path = public, pg_temp
as $$
declare
  v_length smallint;
  v_code   text;
begin
  perform clear_lapsed_invite_codes();
  select code_length into v_length from bar_invite_links where token = p_token;
  for i in 1..20 loop
    v_code := random_invite_code(v_length);
    begin
      update bar_invite_links
         set code = v_code,
             code_expires_at = now() + interval '24 hours',
             expires_at = case when kind = 'code' then now() + interval '24 hours' else expires_at end
       where token = p_token;
      return v_code;
    exception when unique_violation then
      null;
    end;
  end loop;
  raise exception 'no free % digit code right now — try a longer one', v_length
    using errcode = 'check_violation';
end;
$$;

-- A9: every live table invite is revoked and replaced by one of the same kind and length. The
-- replacement is created by the kicking host. A custom code is not carried over.
create function rotate_table_invites(p_bar_id uuid) returns void
  language plpgsql set search_path = public, pg_temp
as $$
declare
  v_old   record;
  v_token text;
begin
  for v_old in
    select token, kind, code_length from bar_invite_links
     where bar_id = p_bar_id and scheduled_game_id is null
       and revoked_at is null and expires_at > now()
     order by created_at
       for update
  loop
    update bar_invite_links set revoked_at = now(), code = null where token = v_old.token;
    insert into bar_invite_links (bar_id, created_by, kind, code_length)
    values (p_bar_id, (select auth.uid()), v_old.kind, v_old.code_length)
    returning token into v_token;
    if v_old.kind <> 'link' then
      perform assign_invite_code(v_token);
    end if;
  end loop;
end;
$$;

-- ── create_table_invite ──────────────────────────────────────────────────────
-- SECURITY DEFINER because assign_invite_code must clear other bars' lapsed codes, which the
-- caller's RLS hides. Authority is the explicit is_bar_staff test. create_bar_invite (0004) is
-- untouched and still mints game-night invites and plain links.

create function create_table_invite(p_bar_id uuid, p_kind text, p_code_length integer default null)
  returns text
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_token text;
begin
  if not is_bar_staff(p_bar_id) then
    raise exception 'only a host can create an invite' using errcode = 'insufficient_privilege';
  end if;
  if p_kind is null or p_kind not in ('link', 'code', 'both') then
    raise exception 'unknown invite kind' using errcode = 'check_violation';
  end if;
  if p_kind <> 'link' and (p_code_length is null or p_code_length not between 4 and 6) then
    raise exception 'a code is 4 to 6 digits' using errcode = 'check_violation';
  end if;

  insert into bar_invite_links (bar_id, created_by, kind, code_length)
  values (p_bar_id, (select auth.uid()), p_kind,
          case when p_kind = 'link' then null else p_code_length end)
  returning token into v_token;

  if p_kind <> 'link' then
    perform assign_invite_code(v_token);
  end if;
  return v_token;
end;
$$;

-- ── set_invite_code / refresh_invite_code ────────────────────────────────────
-- Missing and another bar's share 'invite not found', as revoke_bar_invite does. set returns
-- the stored code, or null when another live invite holds it: returning rather than raising is
-- what lets the wrong-try row commit.

create function set_invite_code(p_token text, p_code text) returns text
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_link bar_invite_links%rowtype;
  v_uid  uuid := (select auth.uid());
  v_code text := upper(btrim(coalesce(p_code, '')));
begin
  select * into v_link from bar_invite_links where token = p_token for update;
  if not found or not is_bar_staff(v_link.bar_id) then
    raise exception 'invite not found' using errcode = 'no_data_found';
  end if;
  if v_link.revoked_at is not null or v_link.expires_at <= now() then
    raise exception 'this invite has expired' using errcode = 'check_violation';
  end if;
  if v_link.kind = 'link' then
    raise exception 'this invite has no code' using errcode = 'check_violation';
  end if;
  if v_code !~ '^[A-Z0-9]{4,8}$' then
    raise exception 'a code is 4 to 8 letters or digits' using errcode = 'check_violation';
  end if;

  perform check_invite_code_limit(v_uid);
  perform clear_lapsed_invite_codes();
  begin
    update bar_invite_links
       set code = v_code,
           code_expires_at = now() + interval '24 hours',
           expires_at = case when kind = 'code' then now() + interval '24 hours' else expires_at end
     where token = p_token;
    return v_code;
  exception when unique_violation then
    insert into invite_code_attempts (user_id) values (v_uid);
    return null;
  end;
end;
$$;

-- A8's "New code". A 'code' invite whose code lapsed is expired and refused here, because its
-- expires_at followed the code.
create function refresh_invite_code(p_token text) returns text
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_link bar_invite_links%rowtype;
begin
  select * into v_link from bar_invite_links where token = p_token for update;
  if not found or not is_bar_staff(v_link.bar_id) then
    raise exception 'invite not found' using errcode = 'no_data_found';
  end if;
  if v_link.revoked_at is not null or v_link.expires_at <= now() then
    raise exception 'this invite has expired' using errcode = 'check_violation';
  end if;
  if v_link.kind = 'link' then
    raise exception 'this invite has no code' using errcode = 'check_violation';
  end if;
  return assign_invite_code(p_token);
end;
$$;

-- ── revoke_bar_invite ────────────────────────────────────────────────────────
-- 0004's, plus freeing the code at once rather than at the next lazy clear.

create or replace function revoke_bar_invite(p_token text) returns void
  language plpgsql security invoker set search_path = public, pg_temp
as $$
begin
  update bar_invite_links set revoked_at = coalesce(revoked_at, now()), code = null
   where token = p_token and is_bar_staff(bar_id);
  if not found then
    raise exception 'invite not found' using errcode = 'no_data_found';
  end if;
end;
$$;

-- ── resolve_invite_code ──────────────────────────────────────────────────────
-- Signed-in only, so every try is charged to an account. A wrong, lapsed, revoked or malformed
-- code is one answer — null — and one wrong try. The join itself then runs on the returned
-- token through join_bar_as_player, unchanged.

create function resolve_invite_code(p_code text) returns text
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_token text;
begin
  if v_uid is null then
    raise exception 'sign in to use an invite code' using errcode = 'insufficient_privilege';
  end if;
  perform check_invite_code_limit(v_uid);

  select token into v_token from bar_invite_links
   where code = upper(btrim(coalesce(p_code, '')))
     and scheduled_game_id is null
     and revoked_at is null and expires_at > now() and code_expires_at > now();

  if v_token is null then
    insert into invite_code_attempts (user_id) values (v_uid);
  end if;
  return v_token;
end;
$$;

-- ── kick_player ──────────────────────────────────────────────────────────────
-- A6 and A10. SECURITY DEFINER for merge_players' reason (0014): under RLS a refused update is a
-- silent zero-row success, and this must unlink, archive and rotate together or not at all.
-- Authority (is_bar_staff on the player's own bar) is tested before any lock is taken, so a
-- non-staff caller cannot hold another bar's row.
--
-- The balance gate is leave_table's (0010), stricter: exactly zero, in either direction. The
-- FOR UPDATE on the players row conflicts with the FOR KEY SHARE every ledger insert takes on
-- it, so an order entered for this player mid-kick either lands before the balance is read or
-- waits until the kick commits (0010's concurrency note).
--
-- The account's pending claim requests at this table are rejected, or a host approving one
-- later would quietly seat the kicked account again. A host (bar_members row) cannot be kicked.

create function kick_player(p_player_id uuid) returns void
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_bar_id uuid;
  v_player players%rowtype;
begin
  select bar_id into v_bar_id from players where id = p_player_id;
  if not found or not is_bar_staff(v_bar_id) then
    raise exception 'player not found' using errcode = 'no_data_found';
  end if;

  select * into v_player from players where id = p_player_id for update;
  if not found then
    raise exception 'player not found' using errcode = 'no_data_found';
  end if;
  if v_player.user_id is null then
    raise exception 'that player is not linked to an account' using errcode = 'check_violation';
  end if;
  if exists (select 1 from bar_members m
              where m.bar_id = v_player.bar_id and m.user_id = v_player.user_id) then
    raise exception 'a host cannot be kicked' using errcode = 'check_violation';
  end if;
  if player_balance_cents(v_player.id) <> 0 then
    raise exception 'settle % to $0.00 before kicking them', v_player.name
      using errcode = 'check_violation';
  end if;

  update players set user_id = null, archived_at = coalesce(archived_at, now())
   where id = v_player.id;

  update player_claim_requests set status = 'rejected', decided_at = now()
   where bar_id = v_player.bar_id and user_id = v_player.user_id and status = 'pending';

  perform rotate_table_invites(v_player.bar_id);
end;
$$;

-- ── function privileges ──────────────────────────────────────────────────────

revoke all on function random_invite_code(integer) from public, anon, authenticated;
revoke all on function clear_lapsed_invite_codes() from public, anon, authenticated;
revoke all on function check_invite_code_limit(uuid) from public, anon, authenticated;
revoke all on function assign_invite_code(text) from public, anon, authenticated;
revoke all on function rotate_table_invites(uuid) from public, anon, authenticated;

revoke all on function create_table_invite(uuid, text, integer) from public, anon, authenticated;
revoke all on function set_invite_code(text, text) from public, anon, authenticated;
revoke all on function refresh_invite_code(text) from public, anon, authenticated;
revoke all on function resolve_invite_code(text) from public, anon, authenticated;
revoke all on function kick_player(uuid) from public, anon, authenticated;
revoke all on function revoke_bar_invite(text) from public, anon, authenticated;

grant execute on function create_table_invite(uuid, text, integer) to authenticated;
grant execute on function set_invite_code(text, text) to authenticated;
grant execute on function refresh_invite_code(text) to authenticated;
grant execute on function resolve_invite_code(text) to authenticated;
grant execute on function kick_player(uuid) to authenticated;
grant execute on function revoke_bar_invite(text) to authenticated;
