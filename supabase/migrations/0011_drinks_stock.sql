-- 0011 — drinks: archive, pour anyway, live cost (2026-09-29). Applied to production 2026-09-29.
--
-- Three changes, all to the pour path. Nothing here touches the ledger arithmetic.
--
-- 1. drinks.archived_at (null = active). A host retires a drink without deleting it. Deleting
--    already works (orders keep drink_name and price through `on delete set null (drink_id)`,
--    0001) but loses the recipe, so a seasonal drink cannot come back. Archived drinks:
--      * leave get_menu, the one anonymous read of drinks, so /menu stops offering them;
--      * are refused by create_order, so a stale picker cannot pour one.
--    Staff set the column with a plain UPDATE; drinks_staff (0001) already admits it and
--    drinks_read already exposes it to members, as it does every other drinks column. No new
--    policy. save_drink (0002) does not name the column, so editing an archived drink leaves it
--    archived.
--
-- 2. create_order gains `p_allow_short boolean default false`, LAST, so every existing caller
--    (web/lib/supabase/writes.ts pourDrink passes the three named args) resolves unchanged.
--    Default false keeps 0001's refusal, word for word: 'insufficient stock for …'. True means
--    the host has said "I really poured it; the count is wrong". The pour then goes through and
--    each short ingredient is taken down to zero — greatest(0, qty_on_hand - qty_used) — never
--    below, so inventory_items' `check (qty_on_hand >= 0)` still holds.
--
--    The ingredients SNAPSHOT records what was actually subtracted (v_taken), not the recipe
--    amount. 0001 made the snapshot "the rows this loop actually decremented" so delete_order
--    restores exactly what the pour took; on a clamped pour the recipe amount is more than was
--    taken, and undoing would then inflate stock above where it stood before the pour. An
--    ingredient that was already at zero contributes nothing and is left out of the snapshot,
--    which keeps every entry `qty_used > 0` like drink_ingredients. delete_order is unchanged.
--
--    Overloads: Postgres identifies a function by its argument types, so `create or replace`
--    with a fourth argument would ADD create_order(uuid,uuid,uuid,boolean) beside 0001's
--    three-arg one, and a three-arg call would then be ambiguous between them. The three-arg
--    function is dropped first, in this same transaction, so exactly one create_order exists
--    afterwards. Nothing in the schema depends on it (no view, trigger or other function calls
--    it), so the drop needs no cascade. Grants are re-stated for the new signature below; a
--    drop discards the old ACL.
--
-- 3. The order's cost_estimate_cents is priced at pour time from the LIVE recipe and the live
--    cost_per_unit_cents of the rows this loop locks, instead of copying drinks.cost_estimate_cents.
--    That stored figure is written only when the drink is saved (web/app/drinks/page.tsx
--    buildDrink), so a later change to an ingredient's price left every subsequent order costed
--    at the old one.
--      * Arithmetic matches the web's: recipeCostCents (web/lib/recipes.ts) is
--        sum(qty_used * cost_per_unit_cents), fractional, and buildDrink rounds it once with
--        Math.round. Here the sum is exact numeric (numeric(12,3) * integer) and round(numeric)
--        rounds half away from zero, which is Math.round for a non-negative cost. The JS side
--        sums binary floats, so the two can differ by a cent only where the float sum lands on
--        the wrong side of an exact .5; the SQL figure is the exact one.
--      * The cost is of the RECIPE, qty_used, even on a clamped pour: the drink was poured in
--        full, only the count was wrong.
--      * A drink with no recipe has nothing to price, so it falls back to the stored
--        drinks.cost_estimate_cents, which is what 0001 always used.
--
-- Unchanged, and why: delete_order (restores from the snapshot, which change 2 keeps honest);
-- get_shared_tab (reads orders, never drinks, and never returns cost_estimate_cents);
-- create_order stays security invoker, so orders_staff still decides who may pour.
--
-- Types: create_order's Args gain `p_allow_short?: boolean` and drinks gains `archived_at`, so
-- `database.types.ts` is regenerated after this is applied. Until then the web reaches both
-- through web/lib/supabase/drink-stock-schema.ts.

alter table drinks add column archived_at timestamptz;

-- ── create_order ─────────────────────────────────────────────────────────────
-- 0001's body with the three changes above. Every other check, its order, its message and its
-- errcode are 0001's.

drop function create_order(uuid, uuid, uuid);

create function create_order(p_session_id uuid, p_player_id uuid, p_drink_id uuid,
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

-- ── get_menu ─────────────────────────────────────────────────────────────────
-- 0001's function with one added predicate: an archived drink is not on the menu. Same
-- signature, so `create or replace` replaces it in place; still security definer, still
-- returns the availability flag and never stock levels (BD-3).

create or replace function get_menu(p_bar_id uuid) returns jsonb
  language sql security definer stable set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id,
           'name', d.name,
           'price_cents', d.price_cents,
           'available', not exists (
             select 1
               from drink_ingredients di
               join inventory_items ii on ii.id = di.item_id
              where di.drink_id = d.id
                and ii.qty_on_hand < di.qty_used
           )
         ) order by d.name), '[]'::jsonb)
    from drinks d
   where d.bar_id = p_bar_id
     and d.archived_at is null;
$$;

-- ── function privileges ──────────────────────────────────────────────────────
-- 0001's grants, re-stated for the new create_order signature (the drop discarded the old
-- ACL) and for get_menu (create or replace keeps its ACL; re-stating it restores execute if
-- it was ever revoked). Named roles as well as public, for 0001's reason: the platform's
-- default privileges grant anon and authenticated explicitly.

revoke all on function create_order(uuid, uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function create_order(uuid, uuid, uuid, boolean) to authenticated;

revoke all on function get_menu(uuid) from public, anon, authenticated;
grant execute on function get_menu(uuid) to anon, authenticated;
