-- 0024: missing indexes on foreign-key and lookup columns. Additive only — no table, policy or
-- function changes.
--
-- PRODUCTION WARNING. This project (rxvznjtpskendwhwwgin) is production. A plain
-- `create index` takes a SHARE lock on its table for the length of the build: reads carry on,
-- but every insert, update and delete on that table waits until the index is built. The tables
-- here are small today, so each build should take well under a second, but apply this at a
-- quiet time — not during a game night, when orders and buy-ins are being written.
-- `create index concurrently` would avoid the write lock but cannot run inside the transaction
-- a migration runs in, so it is not used.
--
-- `if not exists` makes each statement a no-op where an index of that name is already present.
--
-- ── keyset pages of the bar-filtered ledger reads ──────────────────────────────
-- Each matches its fetcher's `.eq('bar_id', …)` plus ORDER BY exactly, `id` ascending last as
-- every query in web/lib/supabase/queries.ts orders it, so one forward index scan serves both
-- the filter and the keyset cursor. The existing single-column (bar_id) indexes
-- (0001_init.sql:237, 250, 263, 289) can filter but not order.
-- fetchBarOrders (queries.ts:190-193): bar_id = ?, created_at desc, id.
create index if not exists orders_bar_created_idx   on orders   (bar_id, created_at desc, id);
-- fetchBarBuyIns (queries.ts:222-225): bar_id = ?, created_at, id.
create index if not exists buy_ins_bar_created_idx  on buy_ins  (bar_id, created_at, id);
-- fetchBarCashouts (queries.ts:254-257): bar_id = ?, created_at, id.
create index if not exists cashouts_bar_created_idx on cashouts (bar_id, created_at, id);
-- fetchBarPayments (queries.ts:286-289): bar_id = ?, created_at desc, id.
create index if not exists payments_bar_created_idx on payments (bar_id, created_at desc, id);

-- ── player_id lookups on the ledger tables ─────────────────────────────────────
-- Neither table has an index led by player_id: buy_ins has (session_id, created_at) and
-- (bar_id) (0001_init.sql:249-250); cashouts has (session_id, created_at), (bar_id) and the
-- unique (session_id, player_id) (0001_init.sql:262-266). Keyed (player_id, created_at, id)
-- to match fetchPlayerBuyIns and fetchPlayerCashouts (queries.ts:230-233, 262-265); the
-- player_id prefix also serves player_balance_cents (0010_leave_table.sql:38-39),
-- get_my_performance (0004_onboarding.sql:364-367), merge_players
-- (0014_player_merge_archive.sql:116-117, 154-155, 170-171), the delete_my_account locks
-- (0015_delete_my_account_locks.sql:53-54), and the ON DELETE RESTRICT check when a player row
-- is deleted (0001_init.sql:247, 260).
create index if not exists buy_ins_player_idx  on buy_ins  (player_id, created_at, id);
create index if not exists cashouts_player_idx on cashouts (player_id, created_at, id);

-- ── players.user_id ────────────────────────────────────────────────────────────
-- The only index on user_id is the unique (bar_id, user_id) (0001_init.sql:96), led by bar_id.
-- `user_id = auth.uid()` with no bar_id is the players_self_read policy (0001_init.sql:433),
-- get_my_performance (0004_onboarding.sql:361), 0010_leave_table.sql:54,
-- 0015_delete_my_account_locks.sql:53-54 and 0022_member_upcoming_games.sql:53; auth.users
-- deletes also SET NULL through it (0001_init.sql:86).
create index if not exists players_user_idx on players (user_id) where user_id is not null;

-- ── session_id foreign keys (checked on every session delete) ──────────────────
-- payments.session_id is nullable and ON DELETE RESTRICT (0001_init.sql:271, 282); payments
-- has only (player_id, created_at desc) and (bar_id) (0001_init.sql:288-289). Also serves
-- fetchSessionPayments (queries.ts:294-297): `session_id = ?` implies the partial predicate,
-- and one night's payments are few enough to sort after the lookup.
create index if not exists payments_session_idx on payments (session_id) where session_id is not null;

-- scheduled_games.session_id is nullable, ON DELETE SET NULL (0004_onboarding.sql:46, 53-54);
-- the only index is (bar_id, scheduled_at) (0004_onboarding.sql:56).
create index if not exists scheduled_games_session_idx on scheduled_games (session_id) where session_id is not null;

-- player_share_links.session_id is nullable (0001_init.sql:305) and cascades from both
-- sessions (session_id, bar_id) and session_players (session_id, player_id)
-- (0001_init.sql:312, 318-319); the only index is (player_id) (0001_init.sql:321). Led by
-- session_id, this one serves both cascade lookups.
create index if not exists player_share_links_session_player_idx
  on player_share_links (session_id, player_id) where session_id is not null;

-- ── payments.counterparty_player_id ────────────────────────────────────────────
-- Nullable, ON DELETE SET NULL from players (0001_init.sql:274, 285-286), unindexed. Read by
-- merge_players (0014_player_merge_archive.sql:147-148, 173, 196) and
-- 0008_player_claim_requests.sql:417.
create index if not exists payments_counterparty_idx
  on payments (counterparty_player_id) where counterparty_player_id is not null;

-- ── remaining unindexed foreign keys ───────────────────────────────────────────
-- orders.drink_id: nullable, ON DELETE SET NULL from drinks (0001_init.sql:218, 233); orders
-- indexes are (session_id, created_at desc), (player_id), (bar_id) (0001_init.sql:235-237).
create index if not exists orders_drink_idx on orders (drink_id) where drink_id is not null;

-- drink_ingredients.item_id: ON DELETE RESTRICT from inventory_items (0001_init.sql:138); the
-- primary key is (drink_id, item_id) (0001_init.sql:136), led by drink_id.
create index if not exists drink_ingredients_item_idx on drink_ingredients (item_id);

-- scheduled_games.host_user_id: ON DELETE CASCADE from auth.users (0004_onboarding.sql:42).
create index if not exists scheduled_games_host_user_idx on scheduled_games (host_user_id);

-- bar_invite_links.created_by: ON DELETE CASCADE from auth.users (0004_onboarding.sql:68);
-- indexes are (bar_id) and (scheduled_game_id) only (0004_onboarding.sql:80-81).
create index if not exists bar_invite_links_created_by_idx on bar_invite_links (created_by);

-- player_claim_requests.user_id: ON DELETE CASCADE from auth.users
-- (0008_player_claim_requests.sql:39) and the requester's own read policy
-- (0008_player_claim_requests.sql:89). The partial unique (bar_id, user_id) where pending
-- (0008_player_claim_requests.sql:59-60) is led by bar_id and covers pending rows only.
create index if not exists player_claim_requests_user_idx on player_claim_requests (user_id);

-- bars.owner_id: ON DELETE RESTRICT from auth.users (0001_init.sql:60) and the bars_owner_write
-- policy's `owner_id = auth.uid()` (0001_init.sql:391-392); bars has only its primary key.
create index if not exists bars_owner_idx on bars (owner_id);
