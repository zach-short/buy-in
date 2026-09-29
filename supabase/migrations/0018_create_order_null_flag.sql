-- 0018 — create_order refuses a short pour when p_allow_short is null (2026-09-29). Applied to
-- production 2026-09-29.
--
-- Why this exists: 0011_drinks_stock.sql was edited after it was applied (HANDOFF, correction to
-- steps 43 and 44, R9: file mtime 10:51:57, after the apply). The edit was the Fable review's one
-- fix to 0011. The committed 0011 therefore describes a create_order that production may not
-- run. An applied migration is never edited, so this file carries the fixed body forward, as
-- 0017 did for 0013.
--
-- It is idempotent. create_order is `create or replace` with the exact signature and body 0011
-- now holds. If production already runs it, applying this changes nothing. If it runs the
-- pre-fix text, this replaces it. Same signature, so no overload is added: exactly one
-- create_order exists before and after.
--
-- The fix: the stock check read `if not p_allow_short then raise ...`. With p_allow_short NULL,
-- `not null` is null, plpgsql treats that as false, the raise is skipped, and the pour clamps
-- stock to zero exactly as if the host had chosen "Pour anyway". No web caller sends null today
-- (pourDrink omits the arg, createOrderAllowShort sends true), but any client posting
-- `{"p_allow_short": null}` would pour past a refusal with no error. `is not true` makes null
-- refuse like false.
--
-- Everything else is 0011's body unchanged: the archived-drink refusal, the clamped snapshot
-- delete_order restores from, and the live recipe cost. Still security invoker, so orders_staff
-- decides who may pour. `create or replace` keeps the function's grants; they are restated
-- below anyway, so this file alone shows who may call it.

-- ── create_order ─────────────────────────────────────────────────────────────

create or replace function create_order(p_session_id uuid, p_player_id uuid, p_drink_id uuid,
                             p_allow_short boolean default false)
  returns jsonb
  language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_session    sessions%rowtype;
  v_bar_id     uuid;
  v_drink      drinks%rowtype;
  v_order      orders%rowtype;
  v_ing        record;
  v_taken      numeric(12,3);
  v_new_qty    numeric(12,3);
  v_warnings   text[] := '{}';
  v_snapshot   jsonb := '[]'::jsonb;
  v_has_recipe boolean := false;
  v_cost       numeric := 0;
begin
  select * into v_session from sessions where id = p_session_id;
  if not found then
    raise exception 'session not found' using errcode = 'no_data_found';
  end if;
  v_bar_id := v_session.bar_id;

  if v_session.status <> 'active' then
    raise exception 'session is closed' using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from session_players
     where session_id = p_session_id and player_id = p_player_id
  ) then
    raise exception 'player is not in this session' using errcode = 'check_violation';
  end if;

  select * into v_drink from drinks where id = p_drink_id and bar_id = v_bar_id;
  if not found then
    raise exception 'drink not found' using errcode = 'no_data_found';
  end if;

  -- Change 1. After the lookup so an unknown drink still reads 'drink not found'.
  if v_drink.archived_at is not null then
    raise exception 'drink is archived' using errcode = 'check_violation';
  end if;

  -- Lock every ingredient row up front so two concurrent pours cannot both pass
  -- the stock check and oversell (0001). cost_per_unit_cents is read from the same
  -- locked row, so the cost and the decrement describe one state of the inventory.
  for v_ing in
    select di.item_id, di.qty_used, ii.name, ii.unit, ii.qty_on_hand, ii.reorder_threshold,
           ii.cost_per_unit_cents
    from drink_ingredients di
    join inventory_items ii on ii.id = di.item_id
    where di.drink_id = p_drink_id
    order by di.item_id
    for update of ii
  loop
    v_has_recipe := true;

    if v_ing.qty_on_hand < v_ing.qty_used then
      -- `is not true`, not `not`: a null flag must refuse like false, never pour short.
      if p_allow_short is not true then
        raise exception 'insufficient stock for % (have % %, need %)',
          v_ing.name, v_ing.qty_on_hand, v_ing.unit, v_ing.qty_used
          using errcode = 'check_violation';
      end if;
      -- Change 2: take what is there, so qty_on_hand lands on greatest(0, on_hand - used).
      v_taken := v_ing.qty_on_hand;
    else
      v_taken := v_ing.qty_used;
    end if;

    update inventory_items
       set qty_on_hand = qty_on_hand - v_taken
     where id = v_ing.item_id
    returning qty_on_hand into v_new_qty;

    if v_new_qty <= v_ing.reorder_threshold then
      v_warnings := array_append(v_warnings, v_ing.name);
    end if;

    -- Built from this loop, never re-queried (0001: a second query could see a newer recipe),
    -- and from v_taken, so delete_order restores exactly what this pour subtracted (change 2).
    if v_taken > 0 then
      v_snapshot := v_snapshot || jsonb_build_object('item_id', v_ing.item_id, 'qty_used', v_taken);
    end if;

    -- Change 3: the recipe amount, not v_taken — the drink was poured in full.
    v_cost := v_cost + v_ing.qty_used * v_ing.cost_per_unit_cents;
  end loop;

  insert into orders (bar_id, session_id, player_id, drink_id, drink_name,
                      price_cents, cost_estimate_cents, ingredients)
  values (v_bar_id, p_session_id, p_player_id, p_drink_id, v_drink.name,
          v_drink.price_cents,
          case when v_has_recipe then round(v_cost)::integer else v_drink.cost_estimate_cents end,
          v_snapshot)
  returning * into v_order;

  return jsonb_build_object('order', to_jsonb(v_order), 'low_stock_warnings', to_jsonb(v_warnings));
end;
$$;

-- ── function privileges ──────────────────────────────────────────────────────
-- As 0011: revoke from public, anon and authenticated by name, then grant back.

revoke all on function create_order(uuid, uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function create_order(uuid, uuid, uuid, boolean) to authenticated;
