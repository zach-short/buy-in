-- 0010 — a player leaves a table (2026-09-29). UNAPPLIED: the owner applies it.
--
-- Two client functions and one internal helper.
--   get_my_tables()  — the tables this account is seated at, each with its balance, for the
--                      Account screen's list.
--   leave_table()    — unlinks the caller's player row at one bar. It does what unlink_player
--                      (0008) does — players.user_id goes to null — but the player asks for it,
--                      not the host. The row keeps its name, contact details and every ledger
--                      row, so the host's books still balance; the account just stops seeing it.
--
-- Rules (owner, 2026-09-29, the same pair 0009 uses for deleting an account):
--   * BLOCKED if the player owes the house at that table. Leaving would strand a debt on a row
--     nobody is linked to.
--   * NOT blocked when the house owes the player, but leave_table refuses unless the caller
--     passes p_accept_credit = true, so the screen's warning is one the server also insists on.
--   * A member of the bar (its owner or a host) cannot leave it here: their players row, if they
--     have one, is not what makes them staff.
--
-- The balance is @pb/core computeBalanceCents in SQL: drinks + buy-ins - cashouts - received +
-- sent, POSITIVE MEANS THE PLAYER OWES THE HOUSE. It is the same arithmetic as 0009's
-- get_account_deletion_check, which inlines it; this migration names it once as
-- player_balance_cents so leave_table and get_my_tables cannot drift from each other.
-- Scalar subqueries, not joins: joining orders to buy_ins would multiply each side by the
-- other's row count. counterparty_player_id is ignored, as it is in computeBalanceCents.
--
-- Concurrency: leave_table takes FOR UPDATE on the players row. Every ledger table's foreign key
-- to players takes FOR KEY SHARE on it when a row is inserted, and the two conflict, so an order
-- the host is entering as the player leaves either lands before the balance is read or waits
-- until the unlink commits. A row that lands after is on the host's books, as any late order is.

-- security invoker, and revoked from every client below: callable directly it would read any
-- player's balance. The two definer functions that use it run as their owner and can still
-- execute it.
create function player_balance_cents(p_player_id uuid) returns bigint
  language sql stable set search_path = public, pg_temp
as $$
  select coalesce((select sum(o.price_cents)  from orders   o where o.player_id = p_player_id), 0)
       + coalesce((select sum(bi.amount_cents) from buy_ins  bi where bi.player_id = p_player_id), 0)
       - coalesce((select sum(c.amount_cents)  from cashouts c  where c.player_id = p_player_id), 0)
       - coalesce((select sum(y.amount_cents)  from payments y  where y.player_id = p_player_id and y.direction = 'received'), 0)
       + coalesce((select sum(y.amount_cents)  from payments y  where y.player_id = p_player_id and y.direction = 'sent'), 0);
$$;

-- Scoped to players.user_id = auth.uid() and nothing wider, the boundary get_my_performance
-- (0004) set; a null uid matches no row. Bars the caller is a member of are left out, for the
-- same reason leave_table refuses them.
create function get_my_tables()
  returns table (bar_id uuid, bar_name text, balance_cents bigint)
  language sql security definer stable set search_path = public, pg_temp
as $$
  select b.id, b.name, player_balance_cents(p.id)
    from players p
    join bars b on b.id = p.bar_id
   where p.user_id = (select auth.uid())
     and not exists (select 1 from bar_members m
                      where m.bar_id = p.bar_id and m.user_id = (select auth.uid()))
   order by b.name, b.id;
$$;

create function leave_table(p_bar_id uuid, p_accept_credit boolean default false) returns void
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_player  players%rowtype;
  v_balance bigint;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;

  select * into v_player from players where bar_id = p_bar_id and user_id = v_uid for update;
  if not found then
    raise exception 'you are not at this table' using errcode = 'no_data_found';
  end if;

  if exists (select 1 from bar_members m where m.bar_id = p_bar_id and m.user_id = v_uid) then
    raise exception 'hosts cannot leave their own table' using errcode = 'check_violation';
  end if;

  v_balance := player_balance_cents(v_player.id);
  if v_balance > 0 then
    raise exception 'you still owe money at this table' using errcode = 'check_violation';
  end if;
  if v_balance < 0 and not p_accept_credit then
    raise exception 'you are owed money at this table' using errcode = 'check_violation';
  end if;

  update players set user_id = null where id = v_player.id;
end;
$$;

revoke all on function player_balance_cents(uuid) from public, anon, authenticated;
revoke all on function get_my_tables() from public, anon, authenticated;
grant execute on function get_my_tables() to authenticated;
revoke all on function leave_table(uuid, boolean) from public, anon, authenticated;
grant execute on function leave_table(uuid, boolean) to authenticated;
