-- 0029 — fixes to 0028 from its Fable review (2026-09-29). Applied to production 2026-09-29 (HANDOFF step 75).
--
-- docs/incomplete/invite-codes/SCOPE.md §9 holds the review; each finding was re-verified on a
-- scratch PG 17 cluster before this was written.
--
--   B1  kick_player's balance gate did not wait for an in-flight edit or delete of an existing
--       ledger row: only an insert takes FOR KEY SHARE on players, so an amount UPDATE or a
--       DELETE running as the kick read the balance could leave an unlinked, archived row owing
--       money. Fixed as 0015 fixed delete_my_account: lock the player's ledger rows too, in
--       0015's order (orders, buy_ins, cashouts, payments, each by id), so the kick waits for
--       any open edit and the balance statement then reads it committed.
--       leave_table (0010) has the same race and is NOT changed here (owner, 2026-09-29).
--   B2  a host could skip every code rule by writing bar_invite_links directly: learn which
--       codes are live from unique violations without spending a try, or set a code that never
--       expires. Fixed with a guard trigger in 0020's shape (current_user, not definer).
--   S1  the try limit was check-then-insert, so parallel calls by one account exceeded 5.
--       An advisory lock per account now serializes them.
--   S2  the table-wide lazy clear could deadlock two hosts. Only the row already holding the
--       code about to be written is cleared now, and only if that code has lapsed.
--   S3  set_invite_code and refresh_invite_code locked the row before the staff test. The
--       test comes first now, as kick_player's does.
--
-- Signatures and grants are unchanged, so database.types.ts needs no regeneration for this file.

-- ── B2: bar_invite_links_guard_codes ─────────────────────────────────────────
-- A client (anon or authenticated) may insert only a plain link, as create_bar_invite (0004)
-- does, and may change no code column except to clear the code, as revoke_bar_invite (0028)
-- does. Every legitimate code write runs inside a SECURITY DEFINER function, as its owner, and
-- passes. Kill switch: drop trigger bar_invite_links_guard_codes on bar_invite_links;

create function bar_invite_links_guard_codes() returns trigger
  language plpgsql set search_path = public, pg_temp
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.kind <> 'link' or new.code is not null or new.code_length is not null
       or new.code_expires_at is not null then
      raise exception 'invite codes are made through create_table_invite'
        using errcode = 'insufficient_privilege';
    end if;
  elsif new.kind is distinct from old.kind
     or new.code_length is distinct from old.code_length
     or new.code_expires_at is distinct from old.code_expires_at
     or (new.code is distinct from old.code and new.code is not null) then
    raise exception 'invite codes are changed through set_invite_code'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger bar_invite_links_guard_codes before insert or update on bar_invite_links
  for each row execute function bar_invite_links_guard_codes();

-- ── S1: one account's tries in single file ───────────────────────────────────

create or replace function check_invite_code_limit(p_uid uuid) returns void
  language plpgsql set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(hashtext('invite_code_tries'), hashtext(p_uid::text));
  delete from invite_code_attempts
   where user_id = p_uid and attempted_at < now() - interval '1 day';
  if (select count(*) from invite_code_attempts
       where user_id = p_uid and attempted_at > now() - interval '15 minutes') >= 5 then
    raise exception 'too many tries — wait a few minutes and try again' using errcode = 'PT429';
  end if;
end;
$$;

-- ── S2: clear one lapsed code, not the table ─────────────────────────────────

create function clear_lapsed_invite_code(p_code text) returns void
  language sql set search_path = public, pg_temp
as $$
  update bar_invite_links set code = null
   where code = p_code
     and (code_expires_at <= now() or revoked_at is not null or expires_at <= now());
$$;

create or replace function assign_invite_code(p_token text) returns text
  language plpgsql set search_path = public, pg_temp
as $$
declare
  v_length smallint;
  v_code   text;
begin
  select code_length into v_length from bar_invite_links where token = p_token;
  for i in 1..20 loop
    v_code := random_invite_code(v_length);
    perform clear_lapsed_invite_code(v_code);
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

-- ── S3 (and S2): set_invite_code, refresh_invite_code ────────────────────────

create or replace function set_invite_code(p_token text, p_code text) returns text
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_bar_id uuid;
  v_link   bar_invite_links%rowtype;
  v_uid    uuid := (select auth.uid());
  v_code   text := upper(btrim(coalesce(p_code, '')));
begin
  select bar_id into v_bar_id from bar_invite_links where token = p_token;
  if not found or not is_bar_staff(v_bar_id) then
    raise exception 'invite not found' using errcode = 'no_data_found';
  end if;
  select * into v_link from bar_invite_links where token = p_token for update;
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
  perform clear_lapsed_invite_code(v_code);
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

create or replace function refresh_invite_code(p_token text) returns text
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_bar_id uuid;
  v_link   bar_invite_links%rowtype;
begin
  select bar_id into v_bar_id from bar_invite_links where token = p_token;
  if not found or not is_bar_staff(v_bar_id) then
    raise exception 'invite not found' using errcode = 'no_data_found';
  end if;
  select * into v_link from bar_invite_links where token = p_token for update;
  if v_link.revoked_at is not null or v_link.expires_at <= now() then
    raise exception 'this invite has expired' using errcode = 'check_violation';
  end if;
  if v_link.kind = 'link' then
    raise exception 'this invite has no code' using errcode = 'check_violation';
  end if;
  return assign_invite_code(p_token);
end;
$$;

-- ── B1: kick_player waits for open ledger edits ──────────────────────────────

create or replace function kick_player(p_player_id uuid) returns void
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
  -- 0015's order. The players lock holds back new rows; these hold back edits and deletes of
  -- existing ones, and wait for any already open. The balance below is a new statement, so
  -- under READ COMMITTED it reads whatever those committed.
  perform 1 from orders   where player_id = v_player.id order by id for update;
  perform 1 from buy_ins  where player_id = v_player.id order by id for update;
  perform 1 from cashouts where player_id = v_player.id order by id for update;
  perform 1 from payments where player_id = v_player.id order by id for update;

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

-- ── cleanup and privileges ───────────────────────────────────────────────────
-- 0028's table-wide clear has no caller left.

drop function clear_lapsed_invite_codes();

revoke all on function bar_invite_links_guard_codes() from public, anon, authenticated;
revoke all on function clear_lapsed_invite_code(text) from public, anon, authenticated;
revoke all on function check_invite_code_limit(uuid) from public, anon, authenticated;
revoke all on function assign_invite_code(text) from public, anon, authenticated;
revoke all on function set_invite_code(text, text) from public, anon, authenticated;
revoke all on function refresh_invite_code(text) from public, anon, authenticated;
revoke all on function kick_player(uuid) from public, anon, authenticated;
grant execute on function set_invite_code(text, text) to authenticated;
grant execute on function refresh_invite_code(text) to authenticated;
grant execute on function kick_player(uuid) to authenticated;
