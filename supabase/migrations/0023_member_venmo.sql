-- 0023 — a member's own Venmo, given at sign-up, fills their seat when they take one
-- (2026-09-29, owner's answer: "save it, fill seats on join"). Applied to production 2026-09-29 by
-- the owner.
--
-- /welcome asks every new account for a name and an optional Venmo before they have a seat
-- anywhere, so the handle rides in auth user metadata (`venmo`, set by
-- web/lib/supabase/welcome.ts) until a players row is linked to the account. A seat gains a
-- user_id three ways — join_bar_as_player (0004), an approved claim (decide_player_claim, 0008),
-- and the swap/reassign tools (0008) — so one trigger on players covers all of them rather than
-- three function rewrites.
--
-- Fill-only: a seat whose venmo is already set keeps it, so a handle the host typed is never
-- overwritten by the member's. Metadata is self-asserted and client-writable, so the value is
-- checked against the same shape the app enforces (VENMO_PATTERN,
-- web/lib/supabase/payment-handles.ts) and dropped if it does not match. This touches no
-- balance: players.venmo only builds pay links.
--
-- security definer to read auth.users, which no client role can; search_path pinned as every
-- definer function here is.

create function fill_seat_venmo_from_account() returns trigger
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_handle text;
begin
  if new.user_id is null or nullif(btrim(new.venmo), '') is not null then
    return new;
  end if;
  select btrim(u.raw_user_meta_data ->> 'venmo') into v_handle
    from auth.users u where u.id = new.user_id;
  if v_handle ~ '^[A-Za-z0-9_-]{5,30}$' then
    new.venmo := v_handle;
  end if;
  return new;
end;
$$;

revoke all on function fill_seat_venmo_from_account() from public, anon, authenticated;

create trigger players_fill_venmo
  before insert or update of user_id on players
  for each row execute function fill_seat_venmo_from_account();
