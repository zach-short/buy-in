-- 0009 — self-service account deletion (2026-09-29). UNAPPLIED: the owner applies it.
--
-- Two functions. get_account_deletion_check() is what the settings screen reads to decide what
-- to show; delete_my_account() re-runs the same check inside the transaction that deletes, so a
-- balance that changes between the screen and the button cannot slip a debtor through.
--
-- Rules (owner, 2026-09-29):
--   * BLOCKED if any player row bound to this account has a balance where they owe the house.
--   * BLOCKED if they own a bar that has game history (any session or payment). The bars.owner_id
--     restrict (0001) was built to fail here rather than take a ledger with it.
--   * NOT blocked when they are owed money — the screen warns a second time and lets them go.
--   * A bar they own with NO history is deleted with them, so a host who has only just signed up
--     can leave.
--   * Rows they leave in other people's bars keep their name, contact details and history:
--     players.user_id is on delete set null (0001), so the host's books still balance.
--
-- The balance is @pb/core computeBalanceCents in SQL: drinks + buy-ins - cashouts - received +
-- sent, POSITIVE MEANS THE PLAYER OWES THE HOUSE. Scalar subqueries, not joins: joining orders to
-- buy_ins would multiply each side by the other's row count. counterparty_player_id is ignored,
-- as it is in computeBalanceCents.
--
-- security definer because a player reads no ledger table beyond their own bars' RLS, and the
-- delete has to reach auth.users. Everything is scoped to auth.uid(); a null uid raises.

create function get_account_deletion_check() returns jsonb
  language plpgsql security definer stable set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;

  return (
    with balances as (
      select b.id as bar_id, b.name as bar_name,
             coalesce((select sum(o.price_cents)  from orders   o where o.player_id = p.id and o.bar_id = p.bar_id), 0)
           + coalesce((select sum(bi.amount_cents) from buy_ins  bi where bi.player_id = p.id and bi.bar_id = p.bar_id), 0)
           - coalesce((select sum(c.amount_cents)  from cashouts c  where c.player_id = p.id and c.bar_id = p.bar_id), 0)
           - coalesce((select sum(y.amount_cents)  from payments y  where y.player_id = p.id and y.bar_id = p.bar_id and y.direction = 'received'), 0)
           + coalesce((select sum(y.amount_cents)  from payments y  where y.player_id = p.id and y.bar_id = p.bar_id and y.direction = 'sent'), 0)
             as balance_cents
        from players p join bars b on b.id = p.bar_id
       where p.user_id = v_uid
    )
    select jsonb_build_object(
      'owes', coalesce((select jsonb_agg(jsonb_build_object('bar_name', bar_name, 'cents', balance_cents) order by bar_name)
                          from balances where balance_cents > 0), '[]'::jsonb),
      'owed', coalesce((select jsonb_agg(jsonb_build_object('bar_name', bar_name, 'cents', -balance_cents) order by bar_name)
                          from balances where balance_cents < 0), '[]'::jsonb),
      'bars_with_history', coalesce((
        select jsonb_agg(jsonb_build_object('bar_name', b.name) order by b.name)
          from bars b
         where b.owner_id = v_uid
           and (exists (select 1 from sessions s where s.bar_id = b.id)
                or exists (select 1 from payments y where y.bar_id = b.id))), '[]'::jsonb)
    )
  );
end;
$$;

create function delete_my_account() returns void
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_check jsonb;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;

  -- Serialises two concurrent deletes for the same account; a lock on the user row, not a table.
  perform 1 from auth.users where id = v_uid for update;
  if not found then
    raise exception 'account not found' using errcode = 'no_data_found';
  end if;

  v_check := get_account_deletion_check();
  if jsonb_array_length(v_check->'owes') > 0 then
    raise exception 'you still owe money' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(v_check->'bars_with_history') > 0 then
    raise exception 'you own a bar with game history' using errcode = 'check_violation';
  end if;

  -- Every bar left is one they own with no history, so the delete cannot take a ledger.
  delete from bars where owner_id = v_uid;
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function get_account_deletion_check() from public, anon, authenticated;
grant execute on function get_account_deletion_check() to authenticated;
revoke all on function delete_my_account() from public, anon, authenticated;
grant execute on function delete_my_account() to authenticated;
