-- 0020 — host setup: the drinks and inventory switches (2026-09-29). UNAPPLIED: the owner
-- applies it.
--
-- docs/incomplete/host-setup/, phase 1 (PASSOFF.md item 18). Some hosts run a home game with
-- no bar. These columns let a host turn the drinks side of the app off and back on; the
-- screens that honour them are phase 2. The owner's answers (SCOPE.md §7, PLAN.md §7, both
-- 2026-09-29) fix the shape:
--   1. Two switches — "I serve drinks" and "Track inventory", the second only meaningful while
--      the first is on. The dependency lives in @pb/core's featureVisibility, not here, so the
--      columns are independent and a host who turns drinks back on gets their inventory
--      setting back as they left it.
--   2. Columns on `bars`, as venmo_note_template (0003) and default_buy_in_cents (0004) are.
--      Hosts edit them under bars_owner_write (0001); no new policy, no new grant — the table
--      grants already cover new columns. The exception is drinks_allowed (5), which no host
--      may write.
--   3. Turning drinks off never touches an order. Hiding is a view: every drink already on a
--      tab still counts toward what people owe.
--   4. The public menu renders empty when drinks are off (get_menu below).
--   5. Drinks are owner-gated (BD-7, the owner, 2026-09-29, later the same day): charging per
--      drink can be an unlicensed alcohol sale under Virginia law, so drink tracking is not
--      offered to strangers. drinks_allowed is the owner's gate, set only in the dashboard;
--      serves_drinks is the host's own switch and only counts while drinks_allowed is true.
--
-- Re-running this file fails at the `alter table` (the columns already exist) before the
-- backfill can run again. That is deliberate: a second backfill would mark every bar created
-- since the first apply as already set up.

-- ── the five columns ─────────────────────────────────────────────────────────
-- One statement, so the five land together or not at all.
--   drinks_allowed — default false, so a table created after this file starts with no drinks
--     side at all (BD-7). Existing bars are backfilled true below. Guarded by the trigger at
--     the end of this file.
--   serves_drinks, tracks_inventory — default true, so nothing hides until a host asks.
--   setup_dismissed_at — null until the host finishes or dismisses the first-run guide
--     (phase 3, BD-5).
--   default_buy_in_set_at — null until the host saves a default buy-in (BD-6, the owner's
--     answer at GATE 2). It backs the guide's "Set a default buy-in" item; the web writes it
--     in the same update as default_buy_in_cents, so the two never disagree. Not backfilled:
--     existing bars never see the guide (below), so their item's state does not show.

alter table bars
  add column drinks_allowed        boolean not null default false,
  add column serves_drinks         boolean not null default true,
  add column tracks_inventory      boolean not null default true,
  add column setup_dismissed_at    timestamptz,
  add column default_buy_in_set_at timestamptz;

-- ── backfill, once ───────────────────────────────────────────────────────────
-- Every bar that exists when this is applied counts as already set up, so the owner's live
-- bar is never greeted by a first-run guide (SCOPE.md §7 Q2/Q6), and keeps its drinks, so
-- nothing about it changes (BD-7). Bars created afterwards keep the columns' defaults: null
-- and false. This runs before the guard trigger exists, and as the migration's own role.

update bars set setup_dismissed_at = now(), drinks_allowed = true;

-- ── get_menu ─────────────────────────────────────────────────────────────────
-- 0011's function (it hides archived drinks; 0001's body would bring them back) with one
-- added predicate: a bar whose drinks are not allowed, or switched off, has an empty menu. D8 forbids any anon
-- read of a bar's flags, and this security definer function is already the only anonymous
-- door to a bar's drinks, so the check goes here rather than in a new anon path. An empty
-- array is also what an unknown bar_id returns (0001), so a switched-off bar is not
-- distinguishable from a missing one. Same signature, so `create or replace` replaces it in
-- place.

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
     and d.archived_at is null
     and exists (select 1 from bars b where b.id = p_bar_id and b.drinks_allowed and b.serves_drinks);
$$;

-- ── function privileges ──────────────────────────────────────────────────────
-- Re-stated exactly as 0011 does: `create or replace` keeps the ACL, and re-stating it
-- restores execute if it was ever revoked. Named roles as well as public, for 0001's reason:
-- the platform's default privileges grant anon and authenticated explicitly.

revoke all on function get_menu(uuid) from public, anon, authenticated;
grant execute on function get_menu(uuid) to anon, authenticated;

-- ── the owner's gate: drinks_allowed ─────────────────────────────────────────
-- Hosts must not be able to give themselves drinks through the API (BD-7). The owner sets
-- drinks_allowed in the Supabase dashboard, which runs as postgres; nothing in the app writes it.
--
-- A trigger, not column grants. bars carries table-level INSERT and UPDATE for authenticated
-- from the platform's default privileges (0001 grants no table privileges itself). Column
-- grants would mean revoking those on production and granting every other column back one by
-- one, and every future column would then need its own grant — 0019 is what a missed grant
-- costs. The trigger is additive, and dropping it is the kill switch:
--   drop trigger bars_guard_drinks_allowed on bars;
--
-- It keys on current_user, so it must NOT be security definer: a definer function runs as its
-- owner and would see postgres for every caller. A definer function that writes bars (none
-- writes this column) also runs as its owner and passes, as the dashboard and service_role do.
--   insert as anon/authenticated — forced to false, so create_bar (0001, security invoker)
--     keeps working and a caller who names the column cannot start a bar with drinks.
--   update as anon/authenticated that changes the value — refused. An update that leaves it
--     alone (every write the web makes) passes.

create function bars_guard_drinks_allowed() returns trigger
  language plpgsql set search_path = public, pg_temp
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.drinks_allowed := false;
  elsif new.drinks_allowed is distinct from old.drinks_allowed then
    raise exception 'drink tracking is set by Buy-In, not by the table'
      using errcode = 'insufficient_privilege',
            detail = format('bar %s: drinks_allowed can only be changed by the app owner', new.id);
  end if;
  return new;
end;
$$;

create trigger bars_guard_drinks_allowed before insert or update on bars
  for each row execute function bars_guard_drinks_allowed();
