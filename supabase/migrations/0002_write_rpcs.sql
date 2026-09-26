-- 0002 — the multi-table writes, each one transaction (phase 6, 2026-09-26).
--
-- BD-9 (PLAN.md §1): every write that was a single Mongo document but is several rows
-- here runs as one function, so a dropped request cannot leave half of it behind. The
-- case that forced it: a drink saved without its recipe is one canMake treats as always
-- makeable, and create_order then pours it without decrementing anything — no error.
-- D19 (DESIGN.md §10): deleting a session takes its buy-ins and cashouts with it and
-- refuses while any order remains.
--
-- Every function is SECURITY INVOKER, like create_order and delete_order in 0001, so the
-- caller's RLS decides who may write: after D16 a member whose role is 'player' is
-- refused by the *_staff policies, not by anything here. Each one confirms its write
-- touched a row, because under RLS a refused UPDATE or DELETE is a silent zero-row
-- success — the lesson 0001's delete_order already records.

-- ── save_drink ───────────────────────────────────────────────────────────────
-- Replaces drinks.go CreateDrink/UpdateDrink. p_drink_id null creates; otherwise the
-- recipe is replaced whole, as the Go PUT did. p_drink_id comes last with a default so
-- the generated type makes it optional rather than a string the caller must fake. p_ingredients is [{item_id, qty_used}];
-- a repeated item_id is summed, because drink_ingredients is keyed (drink_id, item_id)
-- and Mongo stored the repeat as two entries that together used the sum.

create function save_drink(p_bar_id uuid, p_name text, p_price_cents integer,
                           p_cost_estimate_cents integer, p_ingredients jsonb,
                           p_drink_id uuid default null)
  returns uuid
  language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if jsonb_typeof(p_ingredients) <> 'array' then
    raise exception 'ingredients must be an array' using errcode = 'check_violation';
  end if;

  if p_drink_id is null then
    insert into drinks (bar_id, name, price_cents, cost_estimate_cents)
    values (p_bar_id, p_name, p_price_cents, p_cost_estimate_cents)
    returning id into v_id;
  else
    update drinks
       set name = p_name, price_cents = p_price_cents, cost_estimate_cents = p_cost_estimate_cents
     where id = p_drink_id and bar_id = p_bar_id
    returning id into v_id;
    if not found then
      raise exception 'drink not found' using errcode = 'no_data_found';
    end if;
    delete from drink_ingredients where drink_id = v_id;
  end if;

  insert into drink_ingredients (bar_id, drink_id, item_id, qty_used)
  select p_bar_id, v_id, (e->>'item_id')::uuid, sum((e->>'qty_used')::numeric)
    from jsonb_array_elements(p_ingredients) as e
   group by (e->>'item_id')::uuid;

  return v_id;
end;
$$;

-- ── start_session ────────────────────────────────────────────────────────────
-- Replaces sessions.go CreateSession plus the buy-ins session/new/page.tsx posted after
-- it. p_players is [{player_id, buy_in_cents}]; a buy-in of 0 writes no buy_ins row,
-- matching the page's `parseFloat(s.buyIn) > 0` filter.

create function start_session(p_bar_id uuid, p_name text, p_players jsonb)
  returns uuid
  language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if jsonb_typeof(p_players) <> 'array' then
    raise exception 'players must be an array' using errcode = 'check_violation';
  end if;

  insert into sessions (bar_id, name) values (p_bar_id, p_name) returning id into v_id;

  insert into session_players (bar_id, session_id, player_id)
  select p_bar_id, v_id, (e->>'player_id')::uuid
    from jsonb_array_elements(p_players) as e;

  insert into buy_ins (bar_id, session_id, player_id, amount_cents)
  select p_bar_id, v_id, (e->>'player_id')::uuid, (e->>'buy_in_cents')::integer
    from jsonb_array_elements(p_players) as e
   where (e->>'buy_in_cents')::integer > 0;

  return v_id;
end;
$$;

-- ── add_session_player ───────────────────────────────────────────────────────
-- Replaces the session screen's PATCH of Session.playerIds plus its follow-up buy-in.
-- No status check: the Go PATCH made none, and D19/§8.2 keep behaviour as it was.

create function add_session_player(p_session_id uuid, p_player_id uuid, p_buy_in_cents integer)
  returns void
  language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_bar_id uuid;
begin
  select bar_id into v_bar_id from sessions where id = p_session_id;
  if not found then
    raise exception 'session not found' using errcode = 'no_data_found';
  end if;

  insert into session_players (bar_id, session_id, player_id)
  values (v_bar_id, p_session_id, p_player_id);

  if p_buy_in_cents > 0 then
    insert into buy_ins (bar_id, session_id, player_id, amount_cents)
    values (v_bar_id, p_session_id, p_player_id, p_buy_in_cents);
  end if;
end;
$$;

-- ── delete_session ───────────────────────────────────────────────────────────
-- D19. Replaces sessions.go DeleteSession, which deleted the session and then its
-- orders, buy-ins and cashouts with every error ignored — dropping orders without
-- putting their stock back. Orders therefore still block: undoing each one through
-- delete_order is what restores stock from its snapshot. Payments still restrict (the
-- foreign key from 0001 stands); no screen writes a session-scoped payment.

create function delete_session(p_session_id uuid) returns void
  language plpgsql security invoker set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from orders where session_id = p_session_id) then
    raise exception 'session has orders' using errcode = 'restrict_violation';
  end if;

  delete from buy_ins  where session_id = p_session_id;
  delete from cashouts where session_id = p_session_id;
  -- session_players and share links cascade (0001). A caller RLS refuses deletes zero
  -- rows here, and raising rolls back the two deletes above with it.
  delete from sessions where id = p_session_id;
  if not found then
    raise exception 'session not found' using errcode = 'no_data_found';
  end if;
end;
$$;

-- ── function privileges ──────────────────────────────────────────────────────
-- As 0001: revoke from public, anon and authenticated by name, then grant back to
-- authenticated only. None of these is callable anonymously.

revoke all on function save_drink(uuid, text, integer, integer, jsonb, uuid) from public, anon, authenticated;
revoke all on function start_session(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function add_session_player(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function delete_session(uuid) from public, anon, authenticated;
grant execute on function save_drink(uuid, text, integer, integer, jsonb, uuid) to authenticated;
grant execute on function start_session(uuid, text, jsonb) to authenticated;
grant execute on function add_session_player(uuid, uuid, integer) to authenticated;
grant execute on function delete_session(uuid) to authenticated;
