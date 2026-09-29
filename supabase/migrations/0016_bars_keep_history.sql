-- 0016 — a bar with game history cannot be deleted (2026-09-29). UNAPPLIED: the owner applies it.
--
-- 0001_init.sql:209-211 says "a bar can only be deleted once it is empty" because the ledger
-- RESTRICTs its session and player. That was never true. 0001 is applied and cannot carry the
-- disproof, so it is recorded here and in HANDOFF steps 40 and 44. Every ledger table also
-- references bars(id) ON DELETE CASCADE (0001_init.sql:215, :241, :254, :270). One
-- `delete from bars` fires those cascades, and they all run before the RESTRICT checks they
-- queue, so by the time a RESTRICT looks, the rows it protects are gone. Reproduced on a scratch
-- PostgreSQL 17.11 cluster with 0001-0010 (2026-09-29): as the owner under RLS, deleting the
-- session and a player each failed on orders_*_bar_id_fkey, then `delete from bars` succeeded
-- and left no sessions, players, orders, buy-ins, cashouts or payments. bars_owner_write is
-- `for all` (0001_init.sql:391-392), so any owner could do that through PostgREST.
--
-- The rule (owner, 2026-09-29, the one 0009 applies to account deletion): a bar with any session
-- or any payment keeps its ledger; a bar with neither may go. Those two tests are enough.
-- Orders, buy-ins and cashouts cannot exist without a session (session_id not null,
-- 0001_init.sql:216, :242, :255); a payment can (0001_init.sql:271), so it is tested alone.
--
-- A trigger rather than a narrower bars policy (owner's choice, 2026-09-29): it fires on every
-- path, including PostgREST, delete_my_account(), service_role, the dashboard and any function
-- written later, where a policy binds only callers under RLS.
--
-- security definer, like bars_add_owner_membership (0001), so the check sees every session and
-- payment in the bar whoever is deleting it. RLS cannot hide a row from it. A trigger function
-- cannot be called on its own, so this exposes nothing through the API.
--
-- The message is 0009's refusal word for word, so the settings screen's mapping
-- (web/lib/supabase/account-deletion.ts) shows its settled copy if this fires inside
-- delete_my_account(). It can fire there: a session being written in the bar while the account
-- is deleted is invisible to 0009's check. `delete from bars` then waits for that writer and
-- runs this trigger, which sees the committed session (HANDOFF step 40, F1).
--
-- Not stopped, by design: removing a ledger row by row and then the bar, which is the
-- deliberate path 0001 describes. TRUNCATE fires no row trigger; PostgREST cannot issue one.
--
-- Kill switch: `drop trigger bars_refuse_delete_with_history on bars;` restores 0001's behaviour.

create function bars_refuse_delete_with_history() returns trigger
  language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from sessions where bar_id = old.id)
     or exists (select 1 from payments where bar_id = old.id) then
    raise exception 'you own a bar with game history'
      using errcode = 'restrict_violation',
            detail = format('bar %s has sessions or payments, so its ledger is kept', old.id);
  end if;
  return old;
end;
$$;

create trigger bars_refuse_delete_with_history before delete on bars
  for each row execute function bars_refuse_delete_with_history();
