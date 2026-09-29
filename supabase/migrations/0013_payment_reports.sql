-- 0013 — a player reports a payment they sent; the host confirms or dismisses it
-- (2026-09-29). Applied to production 2026-09-29.
--
-- The problem: a player who Venmos part of what they owe has no way to say so. The host has to
-- notice the Venmo and key the payment in by hand. This is the smallest loop that closes it:
--   1. From their portal link the player says "I sent $X" (report_payment). That writes a
--      PENDING row here and nothing else. No ledger row exists yet, so a false or mistaken report
--      moves no balance.
--   2. The host sees the pending rows (a table select, payment_reports_staff_read).
--   3. One tap confirms (confirm_payment_report). In one transaction it inserts the real
--      `payments` row, exactly as createPayment in web/lib/supabase/writes.ts does, and links it
--      here. Or the host dismisses the report (dismiss_payment_report).
-- my_payment_reports lets the portal show "waiting for your host" without changing
-- get_shared_tab's shape.
--
-- One table and five functions. No notifications and no realtime: the host sees reports the
-- next time the screen loads.
--
-- ── Which links may report: PORTAL scope only ────────────────────────────────
-- A session-scoped link is a receipt for one night, and D15 (0001) narrowed it so that a receipt
-- texted for one night reads nothing beyond that night. Letting it write widens it again, from a
-- read credential to a write credential. Hosts mint receipt links per night, so a player
-- collects many of them, and each would be another live way to post into the host's queue. A
-- portal link is one per player, and replacePortalToken (share-links.ts) revokes it. The payment
-- also settles the player's whole balance, not one night's: createPayment writes no
-- session_id, and neither does confirm below. The portal shows that whole balance. A receipt
-- shows a part of it. A session-scoped token gets its own sentence instead of 'invalid or expired
-- link'. That reveals nothing: reaching it takes a live token, the same argument 0004's
-- rsvp_scheduled_game makes for 'not an event invite'. To widen this later, drop the
-- session_id test in payment_report_player.
--
-- ── Abuse bounds, since report_payment is anonymous ──────────────────────────
-- * At most 3 PENDING reports per player. Only a host decision frees a slot, so one leaked
--   portal link can put at most 3 rows in the queue at a time. A player row lock (below)
--   serialises concurrent reports, so a burst cannot race past the count.
-- * amount_cents is 1..1,000,000 ($10,000). This is a poker night, and a typo such as 50000
--   for $50.00 is the likelier mistake than a real $10k Venmo. The host's override on confirm
--   is not capped: the host is the authority on the ledger and can already insert any payment.
-- * note is at most 140 characters, trimmed, and an empty note becomes null.
--
-- ── Who can write what ───────────────────────────────────────────────────────
-- Staff get a SELECT policy and nothing else. Every write goes through a function below, and
-- each function holds the state machine: pending → confirmed (with a payment) or pending →
-- dismissed, never back. The house pattern is a `for all` staff policy (0001, D16). That was
-- rejected here because it would let a host UPDATE a report to 'confirmed' with no payment
-- behind it. The queue would clear, the player's portal would say confirmed, and the balance
-- would not move. That is the one lie this table exists to prevent. So confirm and dismiss are
-- SECURITY DEFINER with an explicit is_bar_staff test on the report's own bar_id, as 0008's
-- host functions test it. A missing report and another bar's report share one message.
-- report_payment and my_payment_reports are SECURITY DEFINER because their caller is anonymous
-- (D8: no anon policy on any table). As get_shared_tab does, they trust the token and nothing
-- else.
--
-- House rules as 0001–0012 state them: money is integer cents; search_path pinned on every
-- function; composite (id, bar_id) foreign keys (G5); every function revoked from public, anon
-- and authenticated by name, then granted back.

-- ── payments: (id, bar_id) as a key ──────────────────────────────────────────
-- G5. payment_reports.payment_id has to be pinned to the report's own bar, as every other
-- foreign key in this schema is pinned. payments has no (id, bar_id) unique yet; every other
-- ledger parent got one in 0001. id is the primary key, so every existing row already satisfies
-- this. Adding it only builds an index. It changes no read path and no write path.
alter table payments add constraint payments_id_bar_id_key unique (id, bar_id);

-- ── payment_reports ──────────────────────────────────────────────────────────

create table payment_reports (
  id           uuid primary key default gen_random_uuid(),
  bar_id       uuid not null references bars(id) on delete cascade,
  player_id    uuid not null,
  -- Mirrored by PAYMENT_REPORT_MAX_CENTS in web/lib/supabase/payment-reports.ts.
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 1000000),
  -- Mirrored by PAYMENT_REPORT_NOTE_MAX_LENGTH in web/lib/supabase/payment-reports.ts.
  note         text check (char_length(note) <= 140),
  status       text not null default 'pending'
                 check (status in ('pending', 'confirmed', 'dismissed')),
  payment_id   uuid,
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  check ((status = 'pending') = (decided_at is null)),
  -- One-directional on purpose. A confirmed report whose payment_id is null means a host later
  -- deleted that payment: the FK below nulls the column rather than blocking the delete. The
  -- report stays as the record that the player said they paid. Nothing else may carry a payment.
  check (payment_id is null or status = 'confirmed'),
  -- Cascade, as player_claim_requests (0008) does: a report about a row that no longer exists
  -- means nothing, and the ledger's RESTRICT keys already stop a player with history from being
  -- deleted.
  foreign key (player_id, bar_id) references players(id, bar_id) on delete cascade,
  -- PG15 column-list SET NULL, as 0001 uses for counterparty_player_id: deleting the payment
  -- nulls payment_id only and leaves bar_id intact.
  foreign key (payment_id, bar_id)
    references payments(id, bar_id) on delete set null (payment_id)
);
-- One report per payment. confirm always inserts a fresh payment, so this can only fire if
-- that ever changes. It is cheap enough to state rather than assume.
create unique index payment_reports_payment_uniq on payment_reports (payment_id)
  where payment_id is not null;
create index payment_reports_bar_status_idx on payment_reports (bar_id, status, created_at);
create index payment_reports_player_idx on payment_reports (player_id, created_at desc);

alter table payment_reports enable row level security;

-- Read only, and staff only. No member read and no anon policy (D8). Writes: see the header.
create policy payment_reports_staff_read on payment_reports for select
  using (is_bar_staff(bar_id));

-- ── payment_report_player (internal) ─────────────────────────────────────────
-- The token check both anonymous functions share. It is get_shared_tab's check word for word,
-- plus the portal-only rule from the header. Missing, revoked and expired return one message
-- and one errcode, as in 0001.

create function payment_report_player(p_token text) returns players
  language plpgsql security definer stable set search_path = public, pg_temp
as $$
declare
  v_link   player_share_links%rowtype;
  v_player players%rowtype;
begin
  select * into v_link from player_share_links where token = p_token;
  if not found or v_link.revoked_at is not null
     or (v_link.expires_at is not null and v_link.expires_at < now()) then
    raise exception 'invalid or expired link' using errcode = 'insufficient_privilege';
  end if;

  if v_link.session_id is not null then
    raise exception 'payments can only be reported from your portal link'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_player from players where id = v_link.player_id;
  -- Defence in depth, as in get_shared_tab: the composite key already makes this impossible.
  if not found or v_player.bar_id <> v_link.bar_id then
    raise exception 'invalid or expired link' using errcode = 'insufficient_privilege';
  end if;

  return v_player;
end;
$$;

-- ── report_payment ───────────────────────────────────────────────────────────
-- Anonymous. It inserts one pending row for the token's player and never touches the ledger.
--
-- FOR NO KEY UPDATE on the player row serialises two reports for the same player, so the
-- pending count cannot be raced past 3. That lock mode is chosen deliberately. It conflicts with
-- itself, and with the FOR UPDATE that leave_table and delete_my_account take (0010, 0015). It
-- does NOT conflict with the FOR KEY SHARE that a host's ledger insert takes through the player
-- foreign key. So a report never makes a host's buy-in or order wait.

create function report_payment(p_token text, p_amount_cents integer, p_note text default null)
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

-- ── my_payment_reports ───────────────────────────────────────────────────────
-- Anonymous. It returns the token's player's own reports so the portal can show which are
-- waiting and which were decided. It returns named columns only, as D15 requires of
-- get_shared_tab. payment_id is left out: the portal already lists payments through
-- get_shared_tab, and nothing needs the link. Capped at the newest 20. The pending ones are
-- always among them, because no more than 3 can be pending at once.

create function my_payment_reports(p_token text) returns jsonb
  language plpgsql security definer stable set search_path = public, pg_temp
as $$
declare
  v_player players%rowtype;
begin
  v_player := payment_report_player(p_token);
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', r.id, 'amount_cents', r.amount_cents, 'note', r.note,
             'status', r.status, 'created_at', r.created_at, 'decided_at', r.decided_at
           ) order by r.created_at desc), '[]'::jsonb)
      from (select * from payment_reports
             where player_id = v_player.id
             order by created_at desc
             limit 20) r
  );
end;
$$;

-- ── confirm_payment_report ───────────────────────────────────────────────────
-- Staff only. In one transaction it creates the real payment and links it. The payment is what
-- createPayment (web/lib/supabase/writes.ts) writes when a host records one by hand:
-- direction 'received' (the house received it, which lowers the player's balance in
-- computeBalanceCents), no session_id, no counterparty, and the player's note or ''.
-- p_amount_cents overrides the reported amount when the Venmo differs from the report. The
-- report keeps what the player said, and the payment carries what the host confirmed.
--
-- A double confirm is refused, not repeated. The report row is locked before it is re-read. A
-- second call waits on that lock, then sees 'confirmed' and raises. Only one payment is ever
-- written.

create function confirm_payment_report(p_id uuid, p_amount_cents integer default null)
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

-- ── dismiss_payment_report ───────────────────────────────────────────────────
-- Staff only: pending → dismissed. It writes no ledger row. A second dismiss is refused like a
-- second confirm, so the caller learns the report was already decided, possibly confirmed by
-- another host.

create function dismiss_payment_report(p_id uuid) returns void
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_report payment_reports%rowtype;
begin
  select * into v_report from payment_reports where id = p_id for update;
  if not found or not is_bar_staff(v_report.bar_id) then
    raise exception 'report not found' using errcode = 'no_data_found';
  end if;

  if v_report.status <> 'pending' then
    raise exception 'this report was already decided' using errcode = 'check_violation';
  end if;

  update payment_reports set status = 'dismissed', decided_at = now() where id = v_report.id;
end;
$$;

-- ── function privileges ──────────────────────────────────────────────────────
-- As 0001: revoke from public, anon and authenticated by name, then grant back. The two token
-- functions are anonymous entry points, the way get_shared_tab is: the portal is opened
-- signed-out. The internal helper is callable by nobody. The definer functions that use it run
-- as its owner.

revoke all on function payment_report_player(text) from public, anon, authenticated;
revoke all on function report_payment(text, integer, text) from public, anon, authenticated;
revoke all on function my_payment_reports(text) from public, anon, authenticated;
revoke all on function confirm_payment_report(uuid, integer) from public, anon, authenticated;
revoke all on function dismiss_payment_report(uuid) from public, anon, authenticated;
grant execute on function report_payment(text, integer, text) to anon, authenticated;
grant execute on function my_payment_reports(text) to anon, authenticated;
grant execute on function confirm_payment_report(uuid, integer) to authenticated;
grant execute on function dismiss_payment_report(uuid) to authenticated;
