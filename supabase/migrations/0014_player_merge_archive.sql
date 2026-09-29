-- 0014 — merge two player rows, and archive a player (2026-09-29). Applied to production 2026-09-29.
--
-- The problem: a table grows duplicates ("Mike" and "Mike S.") that can never be combined —
-- reassign_player_account (0008) refuses any row with history, and every ledger key to players
-- is RESTRICT (0001) — and nothing hides a player who has stopped coming, so the list only grows.
--
-- Requires 0001–0008 (merge_players reads and writes player_claim_requests and calls
-- close_stale_claim_requests, both 0008) and 0013 (payment_reports). Independent of 0009–0012.
--
-- ── players.archived_at ──────────────────────────────────────────────────────
-- Null means active. DISPLAY ONLY: an archived player still counts in every balance, every
-- receipt, get_my_performance (0004), get_my_tables and leave_table (0010), and the account
-- deletion check (0009). Nothing in the database reads this column; the host's player list does.
-- Hosts write it under players_staff (0001) — no new policy, no function. It stays subject to
-- players_bar_name_uniq, so an archived "Mike" still holds the name "Mike" at that table.

alter table players add column archived_at timestamptz;

-- ── merge_players ────────────────────────────────────────────────────────────
-- Folds p_from into p_into and deletes p_from. Same bar required; the caller must be staff of
-- it. Missing, another bar's, and not-yours share 'player not found', as 0008's host functions do.
--
-- SECURITY DEFINER, unlike 0008's invoker host functions, and on purpose: under RLS a refused
-- UPDATE is a silent zero-row success (0002's header), so an invoker merge could move some of a
-- player's rows and not others. Here every row moves or the whole call fails, and the authority
-- is the explicit is_bar_staff test on the players' own bar, run before any lock is taken so a
-- non-staff caller cannot hold another bar's rows.
--
-- Refused, each with its own sentence, rather than guessed at:
--   * both rows are linked to accounts. Within one bar they are necessarily different accounts
--     (players_bar_user_uniq), and which person the merged row belongs to is the host's call
--     through unlink_player (0008) first, not this function's.
--   * both rows have a cash-out in the same session. cashouts_session_player_uniq (0001) allows
--     one per player per night, and adding two cash-outs into one is a judgement about what
--     happened at the table. The host deletes or corrects one first.
--   * a payment runs between the two rows (one is the other's counterparty). Merged, it would
--     be a payment from a person to themselves; the host deletes it first.
--
-- What moves, from p_from to p_into, in one transaction:
--   orders, buy_ins, cashouts, payments (player_id)   — every row, amounts untouched
--   payments.counterparty_player_id                   — else the delete would null it (0001)
--   session_players                                   — a night both sat at keeps p_into's seat
--                                                       and drops p_from's; the rest move
--   player_claim_requests (every status)              — the claimant asked for this person; then
--                                                       close_stale_claim_requests (0008) closes
--                                                       any pending one the merge made stale
--   payment_reports (0013)                            — a player's own "I sent $X", pending or
--                                                       decided, follows the payments it names
--   players.user_id                                   — carried over when only p_from has one
-- And one refusal that is structural, not about the two rows: if any table not named above has
-- a foreign key to players, the merge refuses outright (the catalogue check in the body) until
-- this function is taught about that table.
-- What does not:
--   player_share_links of p_from — DELETED before the seats move, which is stronger than setting
--     revoked_at and is also required: each session-scoped link has a foreign key to its
--     (session_id, player_id) seat (0001) with no ON UPDATE action, so the seat update would fail
--     while one existed. get_shared_tab answers a deleted token exactly as a revoked one. The
--     cascade from players would have deleted them at the end regardless.
--   player_claim_links of p_from — deleted by their cascade (0001) when p_from goes.
--   p_into's name, contact details and archived_at are kept as they are; p_from's are dropped.
--
-- The balance invariant: balance(p_into after) = balance(p_from before) + balance(p_into before).
-- A balance (@pb/core computeBalanceCents; 0010's player_balance_cents) is a sum over ledger
-- rows selected by player_id alone: orders + buy-ins - cashouts - received + sent. This function
-- rewrites player_id on every ledger row of p_from and changes nothing else on them — no amount,
-- no direction, no bar_id (both players share one) — and deletes no ledger row. So each row that
-- counted toward p_from now counts toward p_into, once, and nothing else changes. Rows it does
-- delete (seats, links, requests by cascade) hold no money. It is also checked, not only argued:
-- the sum is read before and after inside the transaction, and a mismatch raises and rolls back.
-- The sum is inlined here rather than calling 0010's player_balance_cents, so this migration does
-- not depend on 0010 being applied; the arithmetic is that function's, line for line.
--
-- Concurrency. Lock order is 0008's and 0015's: players rows first (ascending id), then ledger
-- rows (ascending id per table), then claim requests (through their updates). While both players
-- rows are held FOR UPDATE, no ledger row, seat, link or request can be inserted for either — a
-- composite foreign-key check takes FOR KEY SHARE on the parent row, which conflicts — so the set
-- being moved is closed. The ledger row locks make an in-flight edit or delete of an existing row
-- finish first, so the before-sum and the after-sum read the same rows. A second merge of the
-- same pair waits, then finds p_from gone and raises 'player not found'. A deadlock with
-- delete_my_account (0015, which locks auth.users first) is possible when p_from carries an
-- account; Postgres aborts one side and nothing is half-written.

create function merge_players(p_from uuid, p_into uuid) returns void
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_bar_id uuid;
  v_from   players%rowtype;
  v_into   players%rowtype;
  v_ids    uuid[];
  v_before bigint;
  v_after  bigint;
begin
  if p_from = p_into then
    raise exception 'pick two different players' using errcode = 'check_violation';
  end if;

  -- Authority before any lock. A null argument matches no row and lands here too.
  select bar_id into v_bar_id from players where id = p_from;
  if not found or not is_bar_staff(v_bar_id) then
    raise exception 'player not found' using errcode = 'no_data_found';
  end if;

  perform 1 from players where id in (p_from, p_into) order by id for update;
  -- Re-read under the lock: a concurrent merge may have deleted either row meanwhile.
  select * into v_from from players where id = p_from;
  if not found or not is_bar_staff(v_from.bar_id) then
    raise exception 'player not found' using errcode = 'no_data_found';
  end if;
  select * into v_into from players where id = p_into;
  if not found or v_into.bar_id <> v_from.bar_id then
    raise exception 'player not found' using errcode = 'no_data_found';
  end if;

  perform 1 from orders   where player_id in (p_from, p_into) order by id for update;
  perform 1 from buy_ins  where player_id in (p_from, p_into) order by id for update;
  perform 1 from cashouts where player_id in (p_from, p_into) order by id for update;
  perform 1 from payments
   where player_id in (p_from, p_into) or counterparty_player_id in (p_from, p_into)
   order by id for update;

  -- Every table with a foreign key to players must be one this function moves or deliberately
  -- lets cascade. A table added later that it does not know would otherwise lose p_from's rows
  -- to a cascade, or be nulled, without anyone deciding that — so the merge refuses until this
  -- function is taught about it.
  if exists (select 1 from pg_constraint c
              where c.contype = 'f' and c.confrelid = 'public.players'::regclass
                and c.conrelid::regclass::text not in (
                      'session_players', 'orders', 'buy_ins', 'cashouts', 'payments',
                      'player_share_links', 'player_claim_links', 'player_claim_requests',
                      'payment_reports')) then
    raise exception 'merging is not available: a table this merge does not handle refers to players'
      using errcode = 'feature_not_supported';
  end if;

  if v_from.user_id is not null and v_into.user_id is not null then
    raise exception 'both players are linked to accounts' using errcode = 'check_violation';
  end if;

  if exists (select 1 from cashouts a
               join cashouts b on b.session_id = a.session_id
              where a.player_id = p_from and b.player_id = p_into) then
    raise exception 'both players cashed out of the same game' using errcode = 'check_violation';
  end if;

  if exists (select 1 from payments
              where (player_id = p_from and counterparty_player_id = p_into)
                 or (player_id = p_into and counterparty_player_id = p_from)) then
    raise exception 'there is a payment between these two players' using errcode = 'check_violation';
  end if;

  v_ids := array[p_from, p_into];
  select coalesce((select sum(o.price_cents)  from orders   o where o.player_id = any(v_ids)), 0)
       + coalesce((select sum(bi.amount_cents) from buy_ins  bi where bi.player_id = any(v_ids)), 0)
       - coalesce((select sum(c.amount_cents)  from cashouts c  where c.player_id = any(v_ids)), 0)
       - coalesce((select sum(y.amount_cents)  from payments y  where y.player_id = any(v_ids) and y.direction = 'received'), 0)
       + coalesce((select sum(y.amount_cents)  from payments y  where y.player_id = any(v_ids) and y.direction = 'sent'), 0)
    into v_before;

  -- Links first: their seat foreign key would refuse the seat update below (header).
  delete from player_share_links where player_id = p_from;

  delete from session_players sp
   where sp.player_id = p_from
     and exists (select 1 from session_players x
                  where x.session_id = sp.session_id and x.player_id = p_into);
  update session_players set player_id = p_into where player_id = p_from;

  update orders   set player_id = p_into where player_id = p_from;
  update buy_ins  set player_id = p_into where player_id = p_from;
  update cashouts set player_id = p_into where player_id = p_from;
  update payments set player_id = p_into where player_id = p_from;
  update payments set counterparty_player_id = p_into where counterparty_player_id = p_from;

  update player_claim_requests set player_id = p_into where player_id = p_from;

  -- payment_reports (0013) keys to players with a cascade, so without this a player's pending
  -- "I sent $X" would vanish with p_from. It moves with the payments a confirmed report names.
  update payment_reports set player_id = p_into where player_id = p_from;

  v_ids := array[p_into];
  select coalesce((select sum(o.price_cents)  from orders   o where o.player_id = any(v_ids)), 0)
       + coalesce((select sum(bi.amount_cents) from buy_ins  bi where bi.player_id = any(v_ids)), 0)
       - coalesce((select sum(c.amount_cents)  from cashouts c  where c.player_id = any(v_ids)), 0)
       - coalesce((select sum(y.amount_cents)  from payments y  where y.player_id = any(v_ids) and y.direction = 'received'), 0)
       + coalesce((select sum(y.amount_cents)  from payments y  where y.player_id = any(v_ids) and y.direction = 'sent'), 0)
    into v_after;

  if v_after is distinct from v_before then
    raise exception 'merge would change the combined balance (% before, % after)', v_before, v_after
      using errcode = 'internal_error';
  end if;

  -- The RESTRICT keys refuse this delete if any orders, buy_ins, cashouts or payments row still
  -- names p_from; counterparty_player_id would instead be nulled silently, so it is tested here.
  if exists (select 1 from payments where counterparty_player_id = p_from) then
    raise exception 'a payment still names the merged player' using errcode = 'internal_error';
  end if;

  delete from players where id = p_from;
  if not found then
    raise exception 'player row changed under lock' using errcode = 'internal_error';
  end if;

  -- After the delete, so players_bar_user_uniq never sees the account on two rows at once.
  if v_from.user_id is not null then
    update players set user_id = v_from.user_id where id = p_into and user_id is null;
    if not found then
      raise exception 'player row changed under lock' using errcode = 'internal_error';
    end if;
  end if;

  perform close_stale_claim_requests(v_from.bar_id);
end;
$$;

-- ── function privileges ──────────────────────────────────────────────────────
-- As 0001–0013: revoke from public, anon and authenticated by name, then grant back to
-- authenticated only. The function checks is_bar_staff itself.

revoke all on function merge_players(uuid, uuid) from public, anon, authenticated;
grant execute on function merge_players(uuid, uuid) to authenticated;
