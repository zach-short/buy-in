-- 0015 — delete_my_account() locks what its check reads (2026-09-29). UNAPPLIED: the owner applies it.
--
-- NUMBERING: written as 0011, renumbered the same day by the owner's call after
-- 0011_drinks_stock.sql took 0011 too; 0012–0014 were claimed by other sessions meanwhile.
-- 0013_player_merge_archive.sql and 0014_payment_reports.sql cite this function's locks as "0011".
--
-- 0009's delete_my_account() checked a snapshot and locked only the auth.users row. A write still
-- in flight when the check ran was invisible to it and landed afterwards. Three races, each
-- reproduced on a scratch cluster against 0009 (HANDOFF step 40, F1 and F2):
--   * A session being started in the caller's bar: the check saw no history, then
--     `delete from bars` waited for that transaction to commit and cascaded through its session
--     and buy-ins. The bar's RESTRICT keys do not stop this (step 40, F3).
--   * A host inserting a buy-in for the caller's row: the check saw no debt, the account went,
--     and the row was left owing with user_id null.
--   * A host deleting the payment that held the caller's row at zero: the same outcome.
--
-- Why each lock, taken before the check so the check reads a set that can no longer change:
--   * auth.users first: binding a player row or a bar to the account takes FOR KEY SHARE on it,
--     so the set of rows the account holds cannot grow after this.
--   * players: a ledger insert takes FOR KEY SHARE on its player through the composite key, as
--     leave_table does (0010), so no new buy-in, order, cashout or payment can land.
--   * orders, buy_ins, cashouts, payments: an in-flight delete or edit holds its own row, and only
--     locking that row makes the check wait for it. Without these the payment-delete race stays
--     open (step 40, a variant without them was run).
--   * bars: a session or payment insert takes FOR KEY SHARE on its bar, so no history can appear
--     in a bar about to be deleted.
-- `order by id` gives every caller the same lock order.
--
-- A deadlock with swap_player_accounts / reassign_player_account (0008) remains possible, as it
-- was in 0009 (step 40, F7): Postgres aborts one side and nothing is half-written.
--
-- get_account_deletion_check() is unchanged. The signature and grants are unchanged, so no type
-- regeneration is owed. The grant at the end also restores execute if the owner revoked it.

create or replace function delete_my_account() returns void
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_check jsonb;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;

  perform 1 from auth.users where id = v_uid for update;
  if not found then
    raise exception 'account not found' using errcode = 'no_data_found';
  end if;

  perform 1 from players  where user_id = v_uid order by id for update;
  perform 1 from orders   where player_id in (select id from players where user_id = v_uid) order by id for update;
  perform 1 from buy_ins  where player_id in (select id from players where user_id = v_uid) order by id for update;
  perform 1 from cashouts where player_id in (select id from players where user_id = v_uid) order by id for update;
  perform 1 from payments where player_id in (select id from players where user_id = v_uid) order by id for update;
  perform 1 from bars     where owner_id = v_uid order by id for update;

  v_check := get_account_deletion_check();
  if jsonb_array_length(v_check->'owes') > 0 then
    raise exception 'you still owe money' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(v_check->'bars_with_history') > 0 then
    raise exception 'you own a bar with game history' using errcode = 'check_violation';
  end if;

  delete from bars where owner_id = v_uid;
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function delete_my_account() from public, anon, authenticated;
grant execute on function delete_my_account() to authenticated;
