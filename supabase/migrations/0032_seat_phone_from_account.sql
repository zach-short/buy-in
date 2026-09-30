-- 0032 — a member's own phone, given at sign-up, fills their seat when they take one
-- (2026-09-29, owner's ask: an optional phone beside Venmo on onboarding). UNAPPLIED: the owner
-- applies it.
--
-- The same shape as 0023, which does this for Venmo: /welcome saves the phone in auth user
-- metadata (`phone`, web/lib/supabase/welcome.ts) and the players_fill_venmo trigger copies it
-- onto the seat when a user_id is linked, by join, approved claim or swap. This replaces that
-- trigger's function so one trigger fills both; the trigger itself is untouched.
--
-- Fill-only: a seat whose phone the host already typed keeps it. Metadata is client-writable, so
-- the value is dropped unless it is exactly the "(555) 123-4567" the app writes (formatPhone in
-- @pb/core). Only the host of that table reads players.phone (players_read, 0001); this puts
-- nothing in front of another player. It touches no balance.

create or replace function fill_seat_venmo_from_account() returns trigger
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_meta jsonb;
  v_handle text;
  v_phone text;
begin
  if new.user_id is null then
    return new;
  end if;
  select u.raw_user_meta_data into v_meta from auth.users u where u.id = new.user_id;

  v_handle := btrim(v_meta ->> 'venmo');
  if nullif(btrim(new.venmo), '') is null and v_handle ~ '^[A-Za-z0-9_-]{5,30}$' then
    new.venmo := v_handle;
  end if;

  v_phone := btrim(v_meta ->> 'phone');
  if nullif(btrim(new.phone), '') is null and v_phone ~ '^\(\d{3}\) \d{3}-\d{4}$' then
    new.phone := v_phone;
  end if;
  return new;
end;
$$;

revoke all on function fill_seat_venmo_from_account() from public, anon, authenticated;
