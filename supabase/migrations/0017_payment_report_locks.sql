-- 0017 — payment reports take the player lock first (2026-09-29). Applied to production 2026-09-29.
--
-- Why this exists: 0013_payment_reports.sql was applied to production before its review fixes
-- landed. The owner's screenshot showing `payment_reports` exists is 10:52:27; the file's two
-- lock fixes were written at 10:54:32 (HANDOFF, correction to steps 43 and 44, R9). So the
-- committed 0013 describes functions production does not run. An applied migration is never
-- edited, so this file carries the fixed bodies forward.
--
-- It is idempotent. Both functions are `create or replace` with the exact bodies 0013 now holds.
-- If production already runs them, applying this changes nothing. If it runs the pre-fix text,
-- this replaces it.
--
-- The two fixes, both from the Fable review of 0013 and 0014 (2026-09-29):
--
-- 1. confirm_payment_report locked the report row, then inserted a payment, which takes FOR KEY
--    SHARE on the player. merge_players (0014) locks players FOR UPDATE, then updates
--    payment_reports. A host confirming a player's report while another host merges that player
--    could deadlock. Postgres detects that and aborts one side, so nothing was ever half-written,
--    but the host saw a raw error. Now confirm takes players first, then the report, the same
--    order as merge_players. It reads player_id unlocked, locks the player, then locks and
--    re-reads the report. If a merge moved the report in between, it raises
--    'this report changed, try again' rather than paying the wrong player.
--
-- 2. report_payment did not check `found` after locking the player row. If merge_players
--    deleted that player between the token check and the lock, the count read 0 and the insert
--    failed on a raw foreign-key error. Now it raises 'invalid or expired link', the same answer
--    as any other link that no longer works.
--
-- Signatures, return types, security definer, search_path and grants are unchanged from 0013.
-- `create or replace` keeps a function's grants; they are restated below anyway, as every
-- migration here does, so this file alone shows who may call them.

-- ── report_payment ───────────────────────────────────────────────────────────
-- Anonymous. It inserts one pending row for the token's player and never touches the ledger.
-- FOR NO KEY UPDATE on the player row serialises two reports for the same player, so the pending
-- count cannot be raced past 3, and it does not conflict with the FOR KEY SHARE a host's ledger
-- insert takes, so a report never makes a buy-in or order wait.

create or replace function report_payment(p_token text, p_amount_cents integer, p_note text default null)
  returns uuid
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_player players%rowtype;
  v_note   text := nullif(btrim(p_note), '');
  v_id     uuid;
begin
  v_player := payment_report_player(p_token);

  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 1000000 then
    raise exception 'amount must be between $0.01 and $10,000' using errcode = 'check_violation';
  end if;

  if char_length(v_note) > 140 then
    raise exception 'note is too long' using errcode = 'check_violation';
  end if;

  perform 1 from players where id = v_player.id for no key update;
  -- The player row can go between the token check and this lock, when merge_players (0014)
  -- folds it into another row. That is the same as a link that no longer works.
  if not found then
    raise exception 'invalid or expired link' using errcode = 'insufficient_privilege';
  end if;

  if (select count(*) from payment_reports
       where player_id = v_player.id and status = 'pending') >= 3 then
    raise exception 'too many reports waiting for your host' using errcode = 'check_violation';
  end if;

  insert into payment_reports (bar_id, player_id, amount_cents, note)
  values (v_player.bar_id, v_player.id, p_amount_cents, v_note)
  returning id into v_id;

  return v_id;
end;
$$;

-- ── confirm_payment_report ───────────────────────────────────────────────────
-- Staff only. In one transaction it creates the real payment and links it, exactly as 0013
-- describes: direction 'received', no session_id, no counterparty, the player's note or ''.
-- A double confirm is refused, not repeated: the second call waits on the report lock, then
-- sees 'confirmed' and raises.

create or replace function confirm_payment_report(p_id uuid, p_amount_cents integer default null)
  returns uuid
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_report     payment_reports%rowtype;
  v_amount     integer;
  v_payment_id uuid;
  v_player_id  uuid;
begin
  -- Lock order is players, then the report, as merge_players (0014) takes them. Taking the
  -- report first would let a confirm and a merge of the same player deadlock. So player_id is
  -- read unlocked, the player is locked, and then the report is locked and re-read. If a merge
  -- moved the report to another player in between, the re-read shows it and the caller retries.
  select player_id into v_player_id from payment_reports where id = p_id;
  perform 1 from players where id = v_player_id for no key update;

  select * into v_report from payment_reports where id = p_id for update;
  if not found or not is_bar_staff(v_report.bar_id) then
    raise exception 'report not found' using errcode = 'no_data_found';
  end if;

  if v_report.player_id is distinct from v_player_id then
    raise exception 'this report changed, try again' using errcode = 'serialization_failure';
  end if;

  if v_report.status <> 'pending' then
    raise exception 'this report was already decided' using errcode = 'check_violation';
  end if;

  v_amount := coalesce(p_amount_cents, v_report.amount_cents);
  if v_amount <= 0 then
    raise exception 'amount must be more than zero' using errcode = 'check_violation';
  end if;

  insert into payments (bar_id, player_id, amount_cents, note, direction)
  values (v_report.bar_id, v_report.player_id, v_amount, coalesce(v_report.note, ''), 'received')
  returning id into v_payment_id;

  update payment_reports
     set status = 'confirmed', payment_id = v_payment_id, decided_at = now()
   where id = v_report.id;

  return v_payment_id;
end;
$$;

-- ── function privileges ──────────────────────────────────────────────────────
-- As 0013: revoke from public, anon and authenticated by name, then grant back.

revoke all on function report_payment(text, integer, text) from public, anon, authenticated;
revoke all on function confirm_payment_report(uuid, integer) from public, anon, authenticated;
grant execute on function report_payment(text, integer, text) to anon, authenticated;
grant execute on function confirm_payment_report(uuid, integer) to authenticated;
