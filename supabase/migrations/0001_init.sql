-- Buy-In — initial schema
-- Ports the MongoDB collections in backend/models/barModels.go to Postgres with
-- multi-tenancy, RLS, and atomic order handling.
--
-- Money is stored as integer cents everywhere. The Go models used float64, which
-- for a ledger that settles real debts produces balances that never reconcile.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- AMENDED IN PLACE 2026-09-16, before this file had ever been applied anywhere.
--
-- docs/incomplete/supabase-migration/DESIGN.md D4 permits editing this file in
-- place for exactly as long as it remains unapplied, and ends that permission at
-- the ledger step that first applies it — that step names the project ref and this
-- file's hash. After it, every change is a new numbered migration. If you are
-- reading this and the schema exists in some project, the window is closed: write
-- 0002.
--
-- What this amendment added, each citing the decision that required it:
--   D6   bars.venmo_handle / cashapp_handle — the receipt needs a host to pay
--   D10  unique (bar_id, name) on players; unique (session_id, player_id) on cashouts
--   D14  get_menu() — /menu is public, has no player and no token
--   D15  share links scoped to a session; get_shared_tab returns named columns only
--   D16  is_bar_staff() — membership is not authority
--   BD-1 create_bar() — sign-up created a user and nothing else
--   BD-2 sessions.played_on is timestamptz, not date
--   BD-3 get_menu returns a computed availability flag, never stock levels
--   BD-4 claim_player() as an RPC rather than an Edge Function
--   BD-8 claiming links a player row to a user WITHOUT granting bar membership
--   G5   composite foreign keys, so a row's bar_id cannot disagree with its parents
--   gap d create_order validates session membership and session status
-- ─────────────────────────────────────────────────────────────────────────────
--
-- AMENDED IN PLACE 2026-09-25, still before this file had ever been applied
-- anywhere: `supabase db push` against the real dev project (rxvznjtpskendwhwwgin)
-- failed at the `player_share_links`/`player_claim_links` token defaults —
-- `function gen_random_bytes(integer) does not exist`. Supabase pre-installs
-- pgcrypto into an `extensions` schema, not `public` (confirmed via
-- `list_extensions` against the live project), and the connecting role's
-- search_path does not include it — so the unqualified call resolved to nothing.
-- The local validation harness never caught this because a vanilla `create
-- extension pgcrypto` there installs into `public`, which IS on the default
-- search_path. `gen_random_uuid()` is unaffected: it has been a PostgreSQL core
-- function (not pgcrypto's) since PG13, and core functions live in pg_catalog,
-- which is always searched. Fixed by schema-qualifying both call sites and the
-- CREATE EXTENSION itself, rather than changing search_path — the qualified form
-- is correct regardless of which role or search_path is in effect. The push
-- rolled back cleanly (transactional), so `public` was empty afterward and D4's
-- window was never closed by that attempt.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto with schema extensions;

-- ── tenancy ──────────────────────────────────────────────────────────────────

create table bars (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  -- restrict, not cascade: deleting the owner's auth user must fail loudly rather
  -- than take the bar and every debt in it with them.
  owner_id   uuid not null references auth.users(id) on delete restrict,
  -- D6: the settle-up recipient is a property of the bar, not of the host's player
  -- row — a host who stops playing still gets paid. Pre-migration this was the
  -- NEXT_PUBLIC_VENMO_HANDLE env var, read by two receipt screens.
  venmo_handle   text,
  cashapp_handle text,
  created_at timestamptz not null default now()
);

create table bar_members (
  bar_id     uuid not null references bars(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  -- D16 made this column load-bearing. It was previously constrained and read by
  -- nothing, which meant a claimed player added here would have had full write
  -- access to the whole bar.
  role       text not null check (role in ('owner', 'host', 'player')),
  created_at timestamptz not null default now(),
  primary key (bar_id, user_id)
);
create index bar_members_user_idx on bar_members (user_id);

-- Guest rows the host creates mid-game. user_id stays NULL until the player
-- claims the row with a real account (claim_player below).
create table players (
  id         uuid primary key default gen_random_uuid(),
  bar_id     uuid not null references bars(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  name       text not null,
  phone      text,
  venmo      text,
  cashapp    text,
  created_at timestamptz not null default now(),
  -- G5: lets children reference (player_id, bar_id) as a pair.
  unique (id, bar_id)
);
create index players_bar_idx on players (bar_id);
create unique index players_bar_user_uniq on players (bar_id, user_id) where user_id is not null;
-- D10: the Go handler enforced this with a lookup before insert
-- (backend/handlers/players.go:56-61), which is not a constraint.
create unique index players_bar_name_uniq on players (bar_id, name);

-- ── bar catalogue ────────────────────────────────────────────────────────────

create table inventory_items (
  id                uuid primary key default gen_random_uuid(),
  bar_id            uuid not null references bars(id) on delete cascade,
  name              text not null,
  category          text not null check (category in ('Spirit', 'Mixer', 'Garnish', 'Syrup', 'Equipment')),
  unit              text not null,
  qty_on_hand       numeric(12,3) not null default 0 check (qty_on_hand >= 0),
  reorder_threshold numeric(12,3) not null default 0,
  cost_per_unit_cents integer not null default 0 check (cost_per_unit_cents >= 0),
  created_at        timestamptz not null default now(),
  unique (id, bar_id)
);
create index inventory_items_bar_idx on inventory_items (bar_id);

create table drinks (
  id                  uuid primary key default gen_random_uuid(),
  bar_id              uuid not null references bars(id) on delete cascade,
  name                text not null,
  price_cents         integer not null default 0 check (price_cents >= 0),
  cost_estimate_cents integer not null default 0 check (cost_estimate_cents >= 0),
  created_at          timestamptz not null default now(),
  unique (id, bar_id)
);
create index drinks_bar_idx on drinks (bar_id);

-- Was DrinkRecipe.ingredients[] embedded in Mongo.
create table drink_ingredients (
  -- G5: carries bar_id so both parents are pinned to the same bar, and so the
  -- policy can test tenancy without a subquery through drinks.
  bar_id   uuid not null references bars(id) on delete cascade,
  drink_id uuid not null,
  item_id  uuid not null,
  qty_used numeric(12,3) not null check (qty_used > 0),
  primary key (drink_id, item_id),
  foreign key (drink_id, bar_id) references drinks(id, bar_id) on delete cascade,
  foreign key (item_id, bar_id)  references inventory_items(id, bar_id) on delete restrict
);
create index drink_ingredients_bar_idx on drink_ingredients (bar_id);

-- ── sessions ─────────────────────────────────────────────────────────────────

create table sessions (
  id         uuid primary key default gen_random_uuid(),
  bar_id     uuid not null references bars(id) on delete cascade,
  name       text not null,
  -- BD-2: timestamptz, not date. A date column serializes as a bare YYYY-MM-DD,
  -- which new Date() parses as UTC midnight and toLocaleDateString renders as the
  -- PREVIOUS DAY west of UTC — pinned as a test in
  -- packages/core/tests/format.test.ts. Mongo's Session.Date was a time.Time
  -- (backend/models/barModels.go:43), so a date column here would have introduced a
  -- one-day-early render at five call sites that is correct today.
  played_on  timestamptz not null default now(),
  status     text not null default 'active' check (status in ('active', 'closed')),
  -- banked: host fronts everything, players settle with the host.
  -- peer:   no central banker, players settle directly with each other.
  -- D2 ships the column and the pure optimizer; no UI reads it yet.
  settle_mode text not null default 'banked' check (settle_mode in ('banked', 'peer')),
  created_at timestamptz not null default now(),
  unique (id, bar_id)
);
create index sessions_bar_idx on sessions (bar_id, created_at desc);

-- Was Session.playerIds[] embedded in Mongo.
create table session_players (
  bar_id     uuid not null references bars(id) on delete cascade,
  session_id uuid not null,
  player_id  uuid not null,
  primary key (session_id, player_id),
  foreign key (session_id, bar_id) references sessions(id, bar_id) on delete cascade,
  foreign key (player_id, bar_id)  references players(id, bar_id)  on delete cascade
);
create index session_players_player_idx on session_players (player_id);
create index session_players_bar_idx on session_players (bar_id);

-- ── ledger ───────────────────────────────────────────────────────────────────
--
-- G5, and the rule applied consistently below: where a child column is NOT NULL
-- and cascades, it is pinned to its parent AND to bar_id by a composite foreign
-- key, so a writer cannot tag a row with one bar while pointing it at another
-- bar's session or player — the column every RLS policy filters on would otherwise
-- be one the writer chooses freely.
--
-- EVERY foreign key here is composite, including the nullable ones, using PG15's
-- `ON DELETE SET NULL (column_list)` — which nulls only the listed column and leaves
-- bar_id alone. The PG15 manual's own example of that syntax is a tenant-scoped
-- diamond identical in shape to this schema. **This file therefore requires
-- PostgreSQL 15 or later and is a hard syntax error on 14.** Supabase runs 15+; the
-- local validation harness was moved to PostgreSQL 17 on 2026-09-16 for the same
-- reason, because a schema that cannot be exercised locally before it freezes is
-- worse than almost anything it might contain.
--
-- ── ON DELETE, decided by the owner 2026-09-16 (GATE 2 follow-up) ────────────────
-- The ledger tables RESTRICT rather than cascade. Deleting a session used to remove
-- its orders, buy-ins and cashouts while the payments for that night survived with a
-- null session_id — measured, not theorised: 2 of 3 orders gone, the payment kept,
-- and that player's balance flipped from "owes the house" to "is owed by the house".
-- The Go API behaves the same way, so this is not a regression; it is a behaviour
-- nobody would choose on purpose for a record of real debts between friends.
--
-- What RESTRICT buys: the ordinary case still works, because a session created by
-- mistake is empty and deletes fine. The dangerous case — deleting a night that has
-- money in it — now fails until those rows are removed deliberately. Soft-delete was
-- considered and rejected: it would put a `deleted_at` filter on every read path,
-- every policy and every RPC, which is an enormous change to a port whose whole
-- premise is that it changes nothing else.
--
-- A consequence worth knowing: because the ledger restricts, **a bar can only be
-- deleted once it is empty**, and deleting the owner's auth.users row fails instead
-- of silently destroying the ledger. Both are deliberate.

create table orders (
  id                  uuid primary key default gen_random_uuid(),
  bar_id              uuid not null references bars(id) on delete cascade,
  session_id          uuid not null,
  player_id           uuid not null,
  drink_id            uuid,
  drink_name          text not null,
  price_cents         integer not null check (price_cents >= 0),
  cost_estimate_cents integer not null default 0 check (cost_estimate_cents >= 0),
  -- Snapshot of [{item_id, qty_used}] as of pour time. The Go DeleteOrder
  -- handler restored stock from the drink's *current* recipe, so editing a
  -- recipe silently corrupted restoration for every historical order.
  ingredients         jsonb not null default '[]'::jsonb
                        check (jsonb_typeof(ingredients) = 'array'),
  paid                boolean not null default false,
  created_at          timestamptz not null default now(),
  foreign key (session_id, bar_id) references sessions(id, bar_id) on delete restrict,
  foreign key (player_id, bar_id)  references players(id, bar_id)  on delete restrict,
  -- PG15: nulls drink_id only, leaving bar_id intact, so deleting a drink keeps the
  -- order and its recorded drink_name and price.
  foreign key (drink_id, bar_id)   references drinks(id, bar_id)   on delete set null (drink_id)
);
create index orders_session_idx on orders (session_id, created_at desc);
create index orders_player_idx on orders (player_id);
create index orders_bar_idx on orders (bar_id);

create table buy_ins (
  id           uuid primary key default gen_random_uuid(),
  bar_id       uuid not null references bars(id) on delete cascade,
  session_id   uuid not null,
  player_id    uuid not null,
  amount_cents integer not null check (amount_cents > 0),
  created_at   timestamptz not null default now(),
  foreign key (session_id, bar_id) references sessions(id, bar_id) on delete restrict,
  foreign key (player_id, bar_id)  references players(id, bar_id)  on delete restrict
);
create index buy_ins_session_idx on buy_ins (session_id, created_at);
create index buy_ins_bar_idx on buy_ins (bar_id);

create table cashouts (
  id           uuid primary key default gen_random_uuid(),
  bar_id       uuid not null references bars(id) on delete cascade,
  session_id   uuid not null,
  player_id    uuid not null,
  amount_cents integer not null check (amount_cents >= 0),
  created_at   timestamptz not null default now(),
  foreign key (session_id, bar_id) references sessions(id, bar_id) on delete restrict,
  foreign key (player_id, bar_id)  references players(id, bar_id)  on delete restrict
);
create index cashouts_session_idx on cashouts (session_id, created_at);
create index cashouts_bar_idx on cashouts (bar_id);
-- D10: every screen assumes one cashout per player per session — cashouts.find(),
-- and a .some() guard before creating one — and nothing enforced it.
create unique index cashouts_session_player_uniq on cashouts (session_id, player_id);

create table payments (
  id           uuid primary key default gen_random_uuid(),
  bar_id       uuid not null references bars(id) on delete cascade,
  session_id   uuid,
  player_id    uuid not null,
  -- peer settlement: who this payment went to. NULL means the house/host.
  counterparty_player_id uuid,
  amount_cents integer not null check (amount_cents > 0),
  note         text not null default '',
  direction    text not null check (direction in ('received', 'sent')),
  created_at   timestamptz not null default now(),
  foreign key (player_id, bar_id) references players(id, bar_id) on delete restrict,
  -- restrict, not set null: a session holding only payments used to delete and leave
  -- them orphaned, which is half of how a balance flipped.
  foreign key (session_id, bar_id) references sessions(id, bar_id) on delete restrict,
  -- PG15 column-list SET NULL: losing a counterparty must not block the delete, and
  -- must not null bar_id.
  foreign key (counterparty_player_id, bar_id)
    references players(id, bar_id) on delete set null (counterparty_player_id)
);
create index payments_player_idx on payments (player_id, created_at desc);
create index payments_bar_idx on payments (bar_id);

-- ── share links ──────────────────────────────────────────────────────────────
-- Replaces handlers/portal.go, which returned HMAC(PORTAL_SECRET, player_id).
-- That token was deterministic and permanent: it could never be revoked or
-- expired, rotating the secret invalidated every outstanding link at once, and
-- PORTAL_SECRET was unset in the configured environment so it fell back to the
-- literal 'dev-portal-secret' — every player's token was computable from their id.

create table player_share_links (
  token      text primary key default encode(extensions.gen_random_bytes(24), 'hex'),
  bar_id     uuid not null references bars(id) on delete cascade,
  player_id  uuid not null,
  -- D15: NULL scopes the link to the player's whole history (the portal). A
  -- session id scopes it to one night (a receipt). Without this column a receipt
  -- texted for one night was a master key to every night the player ever played.
  session_id uuid,
  -- Dial (DESIGN.md §4): 30 days. NULL is allowed for a link the host deliberately
  -- makes permanent; the default is not permanent, because these are texted.
  expires_at timestamptz default now() + interval '30 days',
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (player_id, bar_id)  references players(id, bar_id)  on delete cascade,
  foreign key (session_id, bar_id) references sessions(id, bar_id) on delete cascade,
  -- A session-scoped link must name a night this player actually attended.
  -- MATCH SIMPLE skips the check when session_id is null, so portal links are
  -- unaffected. Without it, get_shared_tab could return a `sessions` array that
  -- disagreed with its own `orders` — the page groups by session and would silently
  -- drop rows the balance still counted.
  foreign key (session_id, player_id)
    references session_players (session_id, player_id) on delete cascade
);
create index player_share_links_player_idx on player_share_links (player_id);

-- ── claim links ──────────────────────────────────────────────────────────────
-- BD-4: the guest-to-account flow is an RPC taking a token, not an Edge Function.
-- That avoids standing up a Deno toolchain for one call, and sidesteps the open
-- question of whether `supabase functions deploy` needs Docker on the owner's
-- machine, which has none.

create table player_claim_links (
  token      text primary key default encode(extensions.gen_random_bytes(24), 'hex'),
  bar_id     uuid not null references bars(id) on delete cascade,
  player_id  uuid not null,
  -- Dial (DESIGN.md §4): 7 days, shorter than a share link because this one grants
  -- a real account a claim on a row rather than read access to it.
  expires_at timestamptz not null default now() + interval '7 days',
  claimed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (player_id, bar_id) references players(id, bar_id) on delete cascade
);
create index player_claim_links_player_idx on player_claim_links (player_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- security definer so policies on bar_members can query bar_members without
-- recursing. search_path is pinned to defeat search_path hijacking: Postgres
-- resolves unqualified names through the caller's search_path, and pg_temp is
-- searched first unless listed explicitly, so an unpinned definer function can be
-- made to run the caller's objects with the owner's privileges.

create function is_bar_member(b uuid) returns boolean
  language sql security definer stable set search_path = public, pg_temp
as $$
  select exists (
    select 1 from bar_members where bar_id = b and user_id = (select auth.uid())
  );
$$;

-- D16: membership is not authority. `role` was check-constrained and read by
-- nothing, while every bar-scoped table was `for all using (is_bar_member(...))`.
-- Since the settled architecture has players claiming accounts, that combination
-- would have handed an ordinary player every other player's phone number, write
-- access to every order, and the ability to mint and revoke share links for the
-- whole bar.
create function is_bar_staff(b uuid) returns boolean
  language sql security definer stable set search_path = public, pg_temp
as $$
  select exists (
    select 1 from bar_members
     where bar_id = b
       and user_id = (select auth.uid())
       and role in ('owner', 'host')
  );
$$;

alter table bars               enable row level security;
alter table bar_members        enable row level security;
alter table players            enable row level security;
alter table inventory_items    enable row level security;
alter table drinks             enable row level security;
alter table drink_ingredients  enable row level security;
alter table sessions           enable row level security;
alter table session_players    enable row level security;
alter table orders             enable row level security;
alter table buy_ins            enable row level security;
alter table cashouts           enable row level security;
alter table payments           enable row level security;
alter table player_share_links enable row level security;
alter table player_claim_links enable row level security;

create policy bars_member on bars for select using (is_bar_member(id));
create policy bars_owner_write on bars for all
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy bar_members_member on bar_members for select using (is_bar_member(bar_id));
create policy bar_members_owner_write on bar_members for all
  using (exists (select 1 from bars where bars.id = bar_members.bar_id and bars.owner_id = (select auth.uid())))
  with check (exists (select 1 from bars where bars.id = bar_members.bar_id and bars.owner_id = (select auth.uid())));

-- D16, and how the pair below works: permissive policies are OR'd. The `_staff`
-- policy is `for all`, so it is the only one that can authorize INSERT, UPDATE and
-- DELETE. The `_read` policy adds SELECT for any member. A staff user therefore
-- reads via either and writes via the first; a member with role 'player' reads and
-- cannot write. Do not collapse these back into one `for all` policy.
create policy players_staff          on players          for all    using (is_bar_staff(bar_id))  with check (is_bar_staff(bar_id));
create policy players_read           on players          for select using (is_bar_member(bar_id));
create policy inventory_items_staff  on inventory_items  for all    using (is_bar_staff(bar_id))  with check (is_bar_staff(bar_id));
create policy inventory_items_read   on inventory_items  for select using (is_bar_member(bar_id));
create policy drinks_staff           on drinks           for all    using (is_bar_staff(bar_id))  with check (is_bar_staff(bar_id));
create policy drinks_read            on drinks           for select using (is_bar_member(bar_id));
create policy sessions_staff         on sessions         for all    using (is_bar_staff(bar_id))  with check (is_bar_staff(bar_id));
create policy sessions_read          on sessions         for select using (is_bar_member(bar_id));
create policy orders_staff           on orders           for all    using (is_bar_staff(bar_id))  with check (is_bar_staff(bar_id));
create policy orders_read            on orders           for select using (is_bar_member(bar_id));
create policy buy_ins_staff          on buy_ins          for all    using (is_bar_staff(bar_id))  with check (is_bar_staff(bar_id));
create policy buy_ins_read           on buy_ins          for select using (is_bar_member(bar_id));
create policy cashouts_staff         on cashouts         for all    using (is_bar_staff(bar_id))  with check (is_bar_staff(bar_id));
create policy cashouts_read          on cashouts         for select using (is_bar_member(bar_id));
create policy payments_staff         on payments         for all    using (is_bar_staff(bar_id))  with check (is_bar_staff(bar_id));
create policy payments_read          on payments         for select using (is_bar_member(bar_id));
create policy drink_ingredients_staff on drink_ingredients for all    using (is_bar_staff(bar_id))  with check (is_bar_staff(bar_id));
create policy drink_ingredients_read  on drink_ingredients for select using (is_bar_member(bar_id));
create policy session_players_staff   on session_players   for all    using (is_bar_staff(bar_id))  with check (is_bar_staff(bar_id));
create policy session_players_read    on session_players   for select using (is_bar_member(bar_id));

-- Share and claim links are STAFF ONLY, with no member read policy at all. A token
-- is a credential: being able to read the row is being able to use it, and being
-- able to insert one is being able to mint a link to any player's ledger.
create policy share_links_staff on player_share_links for all using (is_bar_staff(bar_id)) with check (is_bar_staff(bar_id));
create policy claim_links_staff on player_claim_links for all using (is_bar_staff(bar_id)) with check (is_bar_staff(bar_id));

-- BD-8: a claimed player can always read their own row, which is the whole benefit
-- claiming confers under BD-8 — it does NOT make them a bar member.
create policy players_self_read on players for select using (user_id = (select auth.uid()));

-- Known and currently unreachable: players_read lets ANY member read every player's
-- phone, venmo and cashapp, and the same pattern lets a member read inventory costs
-- and drinks.cost_estimate_cents. D16 closed the write half of that problem; the
-- read half is closed only by the fact that nothing creates a non-staff member —
-- claim_player deliberately does not (BD-8), and only the bar owner can insert into
-- bar_members. So role 'player' is reserved, not live. The day a host is given a way
-- to admit a player as a member, this needs a narrower read policy or a view; do not
-- add that path without adding the scoping with it.

-- ── create_bar ───────────────────────────────────────────────────────────────
-- BD-1. Sign-up previously created an auth user and nothing else: every RLS policy
-- reads bar_members, so a host who signed up saw an empty app with no way in, and
-- nothing in this schema created the bar-and-membership pair. A trigger on
-- auth.users would fire for every signup, including a future claiming player, and
-- silently give each of them their own bar — so this is an explicit call.
--
-- security invoker: the caller's own policies already permit both inserts
-- (bars_owner_write, then bar_members_owner_write), so no elevation is needed. The
-- function exists for atomicity and for having exactly one way a bar is born,
-- which the import reuses.

-- The membership is created by a trigger on `bars`, not by this function, so that
-- the invariant holds for EVERY path that inserts a bar. bars_owner_write is a
-- `for all` policy, so an authenticated user can insert into bars directly; without
-- the trigger that produced a bar with no bar_members row — the exact "signs up and
-- sees an empty app with no way in" failure BD-1 exists to prevent.
create function bars_add_owner_membership() returns trigger
  language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into bar_members (bar_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (bar_id, user_id) do nothing;
  return new;
end;
$$;

create trigger bars_owner_membership after insert on bars
  for each row execute function bars_add_owner_membership();

create function create_bar(p_name text, p_venmo_handle text default null,
                           p_cashapp_handle text default null)
  returns uuid
  language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_bar_id uuid;
begin
  if v_uid is null then
    raise exception 'create_bar requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  insert into bars (name, owner_id, venmo_handle, cashapp_handle)
  values (p_name, v_uid, p_venmo_handle, p_cashapp_handle)
  returning id into v_bar_id;

  return v_bar_id;
end;
$$;

-- ── claim_player ─────────────────────────────────────────────────────────────
-- BD-4 and BD-8. Claiming links a guest row to a real account. It deliberately
-- does NOT insert a bar_members row: membership is what D16 gates writes on, and
-- a claimed player has no business writing to the bar's ledger. What claiming
-- buys is players_self_read — the player can see their own row — and a stable
-- identity for a future player-facing surface to build on.

create function claim_player(p_token text) returns uuid
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_link   player_claim_links%rowtype;
  v_uid    uuid := (select auth.uid());
  v_player players%rowtype;
begin
  if v_uid is null then
    raise exception 'claiming requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_link from player_claim_links where token = p_token;
  if not found or v_link.revoked_at is not null or v_link.claimed_at is not null
     or v_link.expires_at < now() then
    raise exception 'invalid or expired link' using errcode = 'insufficient_privilege';
  end if;

  select * into v_player from players where id = v_link.player_id;
  if v_player.user_id is not null then
    raise exception 'player already claimed' using errcode = 'insufficient_privilege';
  end if;

  -- Both updates are guarded and checked. Without the `user_id is null` predicate
  -- this was last-writer-wins: two claims for the same player both passed the check
  -- above, the second blocked on the row lock, then re-evaluated `id = ...` — still
  -- true — and overwrote the first claimer, who lost the row silently.
  update players set user_id = v_uid
   where id = v_link.player_id and user_id is null;
  if not found then
    raise exception 'player already claimed' using errcode = 'insufficient_privilege';
  end if;

  update player_claim_links set claimed_at = now()
   where token = p_token and claimed_at is null;
  if not found then
    raise exception 'invalid or expired link' using errcode = 'insufficient_privilege';
  end if;

  return v_link.player_id;
exception
  -- players_bar_user_uniq: this account already claimed a different player in this
  -- bar. Caught so the caller sees a sentence rather than a constraint name and a
  -- pair of uuids.
  when unique_violation then
    raise exception 'this account already has a player in this bar'
      using errcode = 'insufficient_privilege';
end;
$$;

-- ── create_order ─────────────────────────────────────────────────────────────
-- Replaces handlers/orders.go CreateOrder. That version looped over ingredients
-- decrementing stock with no transaction: a failure partway through left earlier
-- ingredients permanently decremented with no order created.
--
-- security invoker so the caller's RLS still applies — which after D16 means a
-- member with role 'player' cannot pour, because the insert is gated by
-- orders_staff.

create function create_order(p_session_id uuid, p_player_id uuid, p_drink_id uuid)
  returns jsonb
  language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_session    sessions%rowtype;
  v_bar_id     uuid;
  v_drink      drinks%rowtype;
  v_order      orders%rowtype;
  v_ing        record;
  v_new_qty    numeric(12,3);
  v_warnings   text[] := '{}';
  v_snapshot   jsonb := '[]'::jsonb;
begin
  select * into v_session from sessions where id = p_session_id;
  if not found then
    raise exception 'session not found' using errcode = 'no_data_found';
  end if;
  v_bar_id := v_session.bar_id;

  -- gap (d), first half: a closed session is a closed book. Nothing checked this,
  -- so an order could be poured into a session that had already been settled.
  if v_session.status <> 'active' then
    raise exception 'session is closed' using errcode = 'check_violation';
  end if;

  -- gap (d), second half: the player must actually be in this session. The
  -- composite foreign keys stop a cross-BAR order; only this stops an order
  -- against a player of the same bar who is not at the table.
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

  -- Lock every ingredient row up front so two concurrent pours cannot both pass
  -- the stock check and oversell.
  for v_ing in
    select di.item_id, di.qty_used, ii.name, ii.unit, ii.qty_on_hand, ii.reorder_threshold
    from drink_ingredients di
    join inventory_items ii on ii.id = di.item_id
    where di.drink_id = p_drink_id
    order by di.item_id
    for update of ii
  loop
    if v_ing.qty_on_hand < v_ing.qty_used then
      raise exception 'insufficient stock for % (have % %, need %)',
        v_ing.name, v_ing.qty_on_hand, v_ing.unit, v_ing.qty_used
        using errcode = 'check_violation';
    end if;

    update inventory_items
       set qty_on_hand = qty_on_hand - v_ing.qty_used
     where id = v_ing.item_id
    returning qty_on_hand into v_new_qty;

    if v_new_qty <= v_ing.reorder_threshold then
      v_warnings := array_append(v_warnings, v_ing.name);
    end if;

    -- The snapshot is built HERE, from the rows this loop actually decremented,
    -- not re-queried afterwards. A second query would run under a fresh READ
    -- COMMITTED snapshot, so a recipe edit committed between the loop and it would
    -- produce an order whose ingredients differ from what was subtracted — and
    -- delete_order would then restore the wrong amounts, which is precisely the bug
    -- the snapshot column exists to prevent.
    v_snapshot := v_snapshot || jsonb_build_object('item_id', v_ing.item_id, 'qty_used', v_ing.qty_used);
  end loop;

  insert into orders (bar_id, session_id, player_id, drink_id, drink_name,
                      price_cents, cost_estimate_cents, ingredients)
  values (v_bar_id, p_session_id, p_player_id, p_drink_id, v_drink.name,
          v_drink.price_cents, v_drink.cost_estimate_cents, v_snapshot)
  returning * into v_order;

  return jsonb_build_object('order', to_jsonb(v_order), 'low_stock_warnings', to_jsonb(v_warnings));
end;
$$;

-- ── delete_order ─────────────────────────────────────────────────────────────
-- Restores from the order's own snapshot, not the drink's current recipe.

create function delete_order(p_order_id uuid) returns void
  language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_order orders%rowtype;
begin
  -- Delete FIRST and restore from what the delete returned. Selecting, restoring
  -- and then deleting let two concurrent calls both read the order and both restore
  -- its stock, so a double-tap credited the inventory twice. It also made this
  -- function return success for a caller whose RLS filtered the delete to zero rows
  -- — a member with role 'player' got a silent no-op that looked like it worked.
  delete from orders where id = p_order_id returning * into v_order;
  if not found then
    raise exception 'order not found' using errcode = 'no_data_found';
  end if;

  update inventory_items ii
     set qty_on_hand = ii.qty_on_hand + (snap->>'qty_used')::numeric
    from jsonb_array_elements(v_order.ingredients) as snap
   where ii.id = (snap->>'item_id')::uuid;
end;
$$;

-- ── get_shared_tab ───────────────────────────────────────────────────────────
-- Anonymous read for a single player via an unguessable, revocable token.
-- security definer so no table needs to be publicly readable.
--
-- D15 rewrote this function's scope and its projection. Before: every sub-select
-- filtered on player_id alone, so a receipt link texted for one night returned the
-- player's entire history; and each row went out as to_jsonb(row), which handed an
-- anonymous caller the bar's per-drink margin (cost_estimate_cents), its recipes
-- (ingredients), another player's uuid (counterparty_player_id) and the player's
-- own venmo handle — none of which any screen renders.

create function get_shared_tab(p_token text) returns jsonb
  language plpgsql security definer stable set search_path = public, pg_temp
as $$
declare
  v_link   player_share_links%rowtype;
  v_player players%rowtype;
  v_bar    bars%rowtype;
begin
  select * into v_link from player_share_links where token = p_token;
  if not found or v_link.revoked_at is not null
     or (v_link.expires_at is not null and v_link.expires_at < now()) then
    -- One message and one errcode for missing, revoked and expired alike: three
    -- distinguishable errors would be an oracle for which tokens ever existed.
    raise exception 'invalid or expired link' using errcode = 'insufficient_privilege';
  end if;

  select * into v_player from players where id = v_link.player_id;
  -- Defence in depth. The composite foreign key on (player_id, bar_id) already
  -- makes this impossible; if it ever becomes possible, fail rather than serve a
  -- player from another bar.
  if not found or v_player.bar_id <> v_link.bar_id then
    raise exception 'invalid or expired link' using errcode = 'insufficient_privilege';
  end if;

  select * into v_bar from bars where id = v_link.bar_id;

  return jsonb_build_object(
    'scope', case when v_link.session_id is null then 'portal' else 'session' end,
    -- venmo_handle is the HOST's, and is the one payment detail these pages exist
    -- to show (D6). The player's own venmo is deliberately not returned.
    'bar', jsonb_build_object('id', v_bar.id, 'name', v_bar.name,
                              'venmo_handle', v_bar.venmo_handle,
                              'cashapp_handle', v_bar.cashapp_handle),
    'player', jsonb_build_object('id', v_player.id, 'name', v_player.name),
    'sessions', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', s.id, 'name', s.name, 'played_on', s.played_on,
               'status', s.status, 'settle_mode', s.settle_mode
             ) order by s.played_on desc), '[]'::jsonb)
        from sessions s
       where s.bar_id = v_link.bar_id
         and (v_link.session_id is null or s.id = v_link.session_id)
         and exists (select 1 from session_players sp
                      where sp.session_id = s.id and sp.player_id = v_player.id)
    ),
    'orders', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', o.id, 'session_id', o.session_id, 'drink_name', o.drink_name,
               'price_cents', o.price_cents, 'paid', o.paid, 'created_at', o.created_at
             ) order by o.created_at desc), '[]'::jsonb)
        from orders o
       where o.player_id = v_player.id
         and (v_link.session_id is null or o.session_id = v_link.session_id)
    ),
    'buy_ins', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', b.id, 'session_id', b.session_id,
               'amount_cents', b.amount_cents, 'created_at', b.created_at
             ) order by b.created_at), '[]'::jsonb)
        from buy_ins b
       where b.player_id = v_player.id
         and (v_link.session_id is null or b.session_id = v_link.session_id)
    ),
    'cashouts', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', c.id, 'session_id', c.session_id,
               'amount_cents', c.amount_cents, 'created_at', c.created_at
             ) order by c.created_at), '[]'::jsonb)
        from cashouts c
       where c.player_id = v_player.id
         and (v_link.session_id is null or c.session_id = v_link.session_id)
    ),
    'payments', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', p.id, 'session_id', p.session_id, 'amount_cents', p.amount_cents,
               'direction', p.direction, 'created_at', p.created_at
             ) order by p.created_at desc), '[]'::jsonb)
        from payments p
       where p.player_id = v_player.id
         and (v_link.session_id is null or p.session_id = v_link.session_id)
    )
  );
end;
$$;

-- ── get_menu ─────────────────────────────────────────────────────────────────
-- D14 and BD-3. /menu is public (web/proxy.ts), has no player and no token, so
-- D8's token-RPC rule has no home for it and following D8 literally would leave a
-- public route with no read path at all. This keeps D8's actual rule — no anon
-- SELECT policy on any table — and returns only what the menu renders.
--
-- The availability flag is computed here rather than shipping stock levels: today
-- the page fetches every drink AND every inventory row and filters client-side
-- with canMake(), which hands any browser the bar's stock and costs. `not exists`
-- matches canMake's semantics including the empty-recipe case, where `every` on an
-- empty array is true and this subquery finds no failing ingredient.
--
-- An unknown bar_id returns an empty array, indistinguishable from a bar with no
-- drinks, so this is not an existence oracle either.

create function get_menu(p_bar_id uuid) returns jsonb
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
   where d.bar_id = p_bar_id;
$$;

-- ── function privileges ──────────────────────────────────────────────────────
-- §9.1 #4. Only get_shared_tab had an explicit grant; everything else inherited a
-- platform default, which means this schema behaved differently depending on when
-- the project was created. Pin every one of them.
--
-- is_bar_member and is_bar_staff MUST stay executable by authenticated: RLS policy
-- expressions are evaluated with the querying user's privileges, so revoking
-- execute on a function used inside a policy breaks every query against that
-- table. They are not granted to anon, which has no policy that admits it anyway.
--
-- One consequence of that, deliberate and verified 2026-09-16: an anonymous client
-- that queries one of these tables DIRECTLY gets `permission denied for function
-- is_bar_staff`, not an empty result. That is the louder failure and the one we
-- want — under D8 no anonymous path touches these tables at all, so a query that
-- does is a bug in the caller, and an error names it where an empty array would be
-- mistaken for "no data yet". get_shared_tab and get_menu are unaffected: they are
-- security definer and run as the owner.

-- EVERY revoke below names anon and authenticated explicitly as well as public.
-- Revoking from PUBLIC removes only the implicit grant: Supabase's platform sets
-- `alter default privileges for role postgres in schema public grant all on
-- functions to anon, authenticated, service_role`, so each function here is created
-- with an EXPLICIT grant to those roles that `revoke ... from public` leaves intact.
-- Supabase's own documentation takes the same two-step shape
-- (guides/database/functions: "revoke execute on all functions in schema public
-- from public;" followed by "... from anon, authenticated;"). Verified 2026-09-16.
-- A scratch Postgres has no such default, so this is invisible to local testing —
-- which is exactly why it is spelled out rather than assumed.

revoke all on function is_bar_member(uuid) from public, anon, authenticated;
revoke all on function is_bar_staff(uuid) from public, anon, authenticated;
grant execute on function is_bar_member(uuid) to authenticated;
grant execute on function is_bar_staff(uuid) to authenticated;

revoke all on function create_order(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function delete_order(uuid) from public, anon, authenticated;
revoke all on function create_bar(text, text, text) from public, anon, authenticated;
revoke all on function claim_player(text) from public, anon, authenticated;
grant execute on function create_order(uuid, uuid, uuid) to authenticated;
grant execute on function delete_order(uuid) to authenticated;
grant execute on function create_bar(text, text, text) to authenticated;
grant execute on function claim_player(text) to authenticated;

-- The two anonymous entry points, and the only two.
revoke all on function get_shared_tab(text) from public, anon, authenticated;
revoke all on function get_menu(uuid) from public, anon, authenticated;
grant execute on function get_shared_tab(text) to anon, authenticated;
grant execute on function get_menu(uuid) to anon, authenticated;

-- Nothing added later is callable until it says so. Two statements for the same
-- reason as above: the platform's default entry is bound to role postgres, which is
-- also what the CLI runs as, so this overrides it for future functions.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- ── realtime ─────────────────────────────────────────────────────────────────
-- Subscriptions are authorized by the same RLS policies as reads, so anon — which
-- has no select policy anywhere — receives nothing on INSERT or UPDATE.
--
-- With one exception worth knowing before anyone relies on it: RLS is not applied
-- to DELETE events, so every subscriber receives the deleted row's primary key.
-- That is why REPLICA IDENTITY is left at its default: setting it to FULL on these
-- tables would put the entire deleted row into that unfiltered event.

alter publication supabase_realtime add table orders, buy_ins, cashouts, payments, sessions, inventory_items;
