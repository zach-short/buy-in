-- 0030 — a host chooses how long an invite's link and code work (2026-09-29). UNAPPLIED.
--
-- docs/incomplete/invite-codes/SCOPE.md §10 holds the owner's answer (A11) and the build
-- decisions (BD-5–BD-8); §11 the answers this also implements (A13–A16). In short:
--   * A standing invite stores the lifetime its link and its code were made with, one of
--     '1h', '24h', '7d', '30d' or 'never' (BD-8: a checked text key, not an interval, because
--     the type generator reads interval as unknown). Rows before this migration get '30d' and
--     '24h', which is what 0004 and 0028 hard-coded.
--   * 'never' is 'infinity'::timestamptz in expires_at / code_expires_at (BD-5), so every
--     existing `expires_at > now()` test keeps working unchanged.
--   * "New code", a rename and a kick's replacement reuse the stored lifetimes (BD-6), where
--     0028/0029 hard-coded 24 hours and 0004's 30-day default.
--   * A 'both' invite's code never outlives its link: its code_expires_at is capped at the link's
--     expires_at, so the date the host sees is the date the code stops working (BD-9).
--   * N3 (A16): kick_player refuses while the player sits in an active session without a cashout.
--
-- The guard trigger (0029, B2) is extended to the two new columns: a client may insert only the
-- defaults and may never change them, or a host could write a 'never' lifetime and let a kick's
-- rotation mint a never-expiring invite from it.

-- ── bar_invite_links: stored lifetimes ───────────────────────────────────────

alter table bar_invite_links
  add column link_lifetime text not null default '30d',
  add column code_lifetime text not null default '24h',
  add constraint bar_invite_links_link_lifetime_check
    check (link_lifetime in ('1h', '24h', '7d', '30d', 'never')),
  add constraint bar_invite_links_code_lifetime_check
    check (code_lifetime in ('1h', '24h', '7d', '30d', 'never'));

-- ── internal helpers ─────────────────────────────────────────────────────────

-- When something made now with this lifetime stops working. An unknown key raises rather than
-- falling through to a null expiry, which not-null would reject with a far worse message.
create function invite_expiry(p_lifetime text) returns timestamptz
  language plpgsql stable set search_path = public, pg_temp
as $$
begin
  case p_lifetime
    when '1h'    then return now() + interval '1 hour';
    when '24h'   then return now() + interval '24 hours';
    when '7d'    then return now() + interval '7 days';
    when '30d'   then return now() + interval '30 days';
    when 'never' then return 'infinity'::timestamptz;
    else raise exception 'unknown invite lifetime' using errcode = 'check_violation';
  end case;
end;
$$;

-- Writes one code onto one invite with its stored code lifetime. A 'code' invite's expiry
-- follows its code (A8); a 'both' invite's code stops with its link (BD-9). A unique violation
-- propagates, so each caller decides what a taken code means.
create function store_invite_code(p_token text, p_code text) returns void
  language sql set search_path = public, pg_temp
as $$
  update bar_invite_links
     set code = p_code,
         code_expires_at = case when kind = 'both'
                                then least(invite_expiry(code_lifetime), expires_at)
                                else invite_expiry(code_lifetime) end,
         expires_at = case when kind = 'code' then invite_expiry(code_lifetime) else expires_at end
   where token = p_token;
$$;

-- 0029's, with the write moved to store_invite_code.
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
      perform store_invite_code(p_token, v_code);
      return v_code;
    exception when unique_violation then
      null;
    end;
  end loop;
  raise exception 'no free % digit code right now — try a longer one', v_length
    using errcode = 'check_violation';
end;
$$;

-- 0028's, now carrying each old invite's lifetimes to its replacement (BD-6). The replacement's
-- clock starts at the kick. N1 (A14): a full 4-digit space still fails the kick loudly.
create or replace function rotate_table_invites(p_bar_id uuid) returns void
  language plpgsql set search_path = public, pg_temp
as $$
declare
  v_old   record;
  v_token text;
begin
  for v_old in
    select token, kind, code_length, link_lifetime, code_lifetime from bar_invite_links
     where bar_id = p_bar_id and scheduled_game_id is null
       and revoked_at is null and expires_at > now()
     order by created_at
       for update
  loop
    update bar_invite_links set revoked_at = now(), code = null where token = v_old.token;
    insert into bar_invite_links
      (bar_id, created_by, kind, code_length, link_lifetime, code_lifetime, expires_at)
    values (p_bar_id, (select auth.uid()), v_old.kind, v_old.code_length,
            v_old.link_lifetime, v_old.code_lifetime, invite_expiry(v_old.link_lifetime))
    returning token into v_token;
    if v_old.kind <> 'link' then
      perform assign_invite_code(v_token);
    end if;
  end loop;
end;
$$;

-- ── create_table_invite ──────────────────────────────────────────────────────
-- 0028's, plus the two lifetimes. Dropped and re-created rather than overloaded, because
-- PostgREST cannot choose between two functions that differ only in trailing defaults. The
-- defaults are 0028's fixed lifetimes, so a three-argument caller behaves as before.

drop function create_table_invite(uuid, text, integer);

create function create_table_invite(
  p_bar_id uuid, p_kind text, p_code_length integer default null,
  p_link_lifetime text default '30d', p_code_lifetime text default '24h'
) returns text
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
  -- Both keys up front, so a bad code lifetime reads as this and not as a constraint name.
  if coalesce(p_link_lifetime, '') not in ('1h', '24h', '7d', '30d', 'never')
     or coalesce(p_code_lifetime, '') not in ('1h', '24h', '7d', '30d', 'never') then
    raise exception 'unknown invite lifetime' using errcode = 'check_violation';
  end if;

  insert into bar_invite_links
    (bar_id, created_by, kind, code_length, link_lifetime, code_lifetime, expires_at)
  values (p_bar_id, (select auth.uid()), p_kind,
          case when p_kind = 'link' then null else p_code_length end,
          p_link_lifetime, p_code_lifetime, invite_expiry(p_link_lifetime))
  returning token into v_token;

  if p_kind <> 'link' then
    perform assign_invite_code(v_token);
  end if;
  return v_token;
end;
$$;

-- ── set_invite_code ──────────────────────────────────────────────────────────
-- 0029's, with the write moved to store_invite_code: a rename restarts the code's own lifetime.

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
    perform store_invite_code(p_token, v_code);
    return v_code;
  exception when unique_violation then
    insert into invite_code_attempts (user_id) values (v_uid);
    return null;
  end;
end;
$$;

-- ── bar_invite_links_guard_codes ─────────────────────────────────────────────
-- 0029's, covering link_lifetime and code_lifetime too (SCOPE §9: the guard must cover every
-- new column). Kill switch unchanged: drop trigger bar_invite_links_guard_codes on bar_invite_links;

create or replace function bar_invite_links_guard_codes() returns trigger
  language plpgsql set search_path = public, pg_temp
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.kind <> 'link' or new.code is not null or new.code_length is not null
       or new.code_expires_at is not null
       or new.link_lifetime <> '30d' or new.code_lifetime <> '24h' then
      raise exception 'invite codes are made through create_table_invite'
        using errcode = 'insufficient_privilege';
    end if;
  elsif new.kind is distinct from old.kind
     or new.code_length is distinct from old.code_length
     or new.code_expires_at is distinct from old.code_expires_at
     or new.link_lifetime is distinct from old.link_lifetime
     or new.code_lifetime is distinct from old.code_lifetime
     or (new.code is distinct from old.code and new.code is not null) then
    raise exception 'invite codes are changed through set_invite_code'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

-- ── kick_player ──────────────────────────────────────────────────────────────
-- 0029's, plus N3 (A16): refused while the player sits in an active session with no cashout,
-- so a kick never leaves a seat nobody can see. The seat test runs after the locks: seating
-- them (a session_players insert) takes FOR KEY SHARE on the players row and waits, and undoing
-- a cashout is a delete of a row already locked above.

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
  -- 0015's order (0029, B1).
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
  if exists (select 1 from session_players sp
               join sessions s on s.id = sp.session_id
              where sp.player_id = v_player.id and s.status = 'active'
                and not exists (select 1 from cashouts c
                                 where c.session_id = sp.session_id and c.player_id = v_player.id)) then
    raise exception 'cash % out of tonight''s game first', v_player.name
      using errcode = 'check_violation';
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

revoke all on function invite_expiry(text) from public, anon, authenticated;
revoke all on function store_invite_code(text, text) from public, anon, authenticated;
revoke all on function assign_invite_code(text) from public, anon, authenticated;
revoke all on function rotate_table_invites(uuid) from public, anon, authenticated;
revoke all on function bar_invite_links_guard_codes() from public, anon, authenticated;

revoke all on function create_table_invite(uuid, text, integer, text, text) from public, anon, authenticated;
revoke all on function set_invite_code(text, text) from public, anon, authenticated;
revoke all on function kick_player(uuid) from public, anon, authenticated;
grant execute on function create_table_invite(uuid, text, integer, text, text) to authenticated;
grant execute on function set_invite_code(text, text) to authenticated;
grant execute on function kick_player(uuid) to authenticated;
