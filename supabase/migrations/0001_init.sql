-- Poker Bar — initial schema
-- Ports the MongoDB collections in backend/models/barModels.go to Postgres with
-- multi-tenancy, RLS, and atomic order handling.
--
-- Money is stored as integer cents everywhere. The Go models used float64, which
-- for a ledger that settles real debts produces balances that never reconcile.

create extension if not exists pgcrypto;

-- ── tenancy ──────────────────────────────────────────────────────────────────

create table bars (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table bar_members (
  bar_id     uuid not null references bars(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('owner', 'host', 'player')),
  created_at timestamptz not null default now(),
  primary key (bar_id, user_id)
);
create index bar_members_user_idx on bar_members (user_id);

-- Guest rows the host creates mid-game. user_id stays NULL until the player
-- claims the row with a real account.
create table players (
  id         uuid primary key default gen_random_uuid(),
  bar_id     uuid not null references bars(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  name       text not null,
  phone      text,
  venmo      text,
  cashapp    text,
  created_at timestamptz not null default now()
);
create index players_bar_idx on players (bar_id);
create unique index players_bar_user_uniq on players (bar_id, user_id) where user_id is not null;

-- ── bar catalogue ────────────────────────────────────────────────────────────

create table inventory_items (
  id                uuid primary key default gen_random_uuid(),
  bar_id            uuid not null references bars(id) on delete cascade,
  name              text not null,
  category          text not null check (category in ('Spirit', 'Mixer', 'Garnish', 'Syrup', 'Equipment')),
  unit              text not null,
  qty_on_hand       numeric(12,3) not null default 0 check (qty_on_hand >= 0),
  reorder_threshold numeric(12,3) not null default 0,
  cost_per_unit_cents integer not null default 0,
  created_at        timestamptz not null default now()
);
create index inventory_items_bar_idx on inventory_items (bar_id);

create table drinks (
  id                  uuid primary key default gen_random_uuid(),
  bar_id              uuid not null references bars(id) on delete cascade,
  name                text not null,
  price_cents         integer not null default 0,
  cost_estimate_cents integer not null default 0,
  created_at          timestamptz not null default now()
);
create index drinks_bar_idx on drinks (bar_id);

-- Was DrinkRecipe.ingredients[] embedded in Mongo.
create table drink_ingredients (
  drink_id uuid not null references drinks(id) on delete cascade,
  item_id  uuid not null references inventory_items(id) on delete restrict,
  qty_used numeric(12,3) not null check (qty_used > 0),
  primary key (drink_id, item_id)
);

-- ── sessions ─────────────────────────────────────────────────────────────────

create table sessions (
  id         uuid primary key default gen_random_uuid(),
  bar_id     uuid not null references bars(id) on delete cascade,
  name       text not null,
  played_on  date not null default current_date,
  status     text not null default 'active' check (status in ('active', 'closed')),
  -- banked: host fronts everything, players settle with the host.
  -- peer:   no central banker, players settle directly with each other.
  settle_mode text not null default 'banked' check (settle_mode in ('banked', 'peer')),
  created_at timestamptz not null default now()
);
create index sessions_bar_idx on sessions (bar_id, created_at desc);

-- Was Session.playerIds[] embedded in Mongo.
create table session_players (
  session_id uuid not null references sessions(id) on delete cascade,
  player_id  uuid not null references players(id) on delete cascade,
  primary key (session_id, player_id)
);
create index session_players_player_idx on session_players (player_id);

-- ── ledger ───────────────────────────────────────────────────────────────────

create table orders (
  id                  uuid primary key default gen_random_uuid(),
  bar_id              uuid not null references bars(id) on delete cascade,
  session_id          uuid not null references sessions(id) on delete cascade,
  player_id           uuid not null references players(id) on delete cascade,
  drink_id            uuid references drinks(id) on delete set null,
  drink_name          text not null,
  price_cents         integer not null,
  cost_estimate_cents integer not null default 0,
  -- Snapshot of [{item_id, qty_used}] as of pour time. The Go DeleteOrder
  -- handler restored stock from the drink's *current* recipe, so editing a
  -- recipe silently corrupted restoration for every historical order.
  ingredients         jsonb not null default '[]'::jsonb,
  paid                boolean not null default false,
  created_at          timestamptz not null default now()
);
create index orders_session_idx on orders (session_id, created_at desc);
create index orders_player_idx on orders (player_id);
create index orders_bar_idx on orders (bar_id);

create table buy_ins (
  id           uuid primary key default gen_random_uuid(),
  bar_id       uuid not null references bars(id) on delete cascade,
  session_id   uuid not null references sessions(id) on delete cascade,
  player_id    uuid not null references players(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  created_at   timestamptz not null default now()
);
create index buy_ins_session_idx on buy_ins (session_id, created_at);
create index buy_ins_bar_idx on buy_ins (bar_id);

create table cashouts (
  id           uuid primary key default gen_random_uuid(),
  bar_id       uuid not null references bars(id) on delete cascade,
  session_id   uuid not null references sessions(id) on delete cascade,
  player_id    uuid not null references players(id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 0),
  created_at   timestamptz not null default now()
);
create index cashouts_session_idx on cashouts (session_id, created_at);
create index cashouts_bar_idx on cashouts (bar_id);

create table payments (
  id           uuid primary key default gen_random_uuid(),
  bar_id       uuid not null references bars(id) on delete cascade,
  session_id   uuid references sessions(id) on delete set null,
  player_id    uuid not null references players(id) on delete cascade,
  -- peer settlement: who this payment went to. NULL means the house/host.
  counterparty_player_id uuid references players(id) on delete set null,
  amount_cents integer not null check (amount_cents > 0),
  note         text not null default '',
  direction    text not null check (direction in ('received', 'sent')),
  created_at   timestamptz not null default now()
);
create index payments_player_idx on payments (player_id, created_at desc);
create index payments_bar_idx on payments (bar_id);

-- ── share links ──────────────────────────────────────────────────────────────
-- Replaces handlers/portal.go, which returned HMAC(PORTAL_SECRET, player_id).
-- That token was deterministic and permanent: it could never be revoked or
-- expired, and rotating the secret invalidated every outstanding link at once.

create table player_share_links (
  token      text primary key default encode(gen_random_bytes(24), 'hex'),
  bar_id     uuid not null references bars(id) on delete cascade,
  player_id  uuid not null references players(id) on delete cascade,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index player_share_links_player_idx on player_share_links (player_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- security definer so policies on bar_members can query bar_members without
-- recursing. search_path is pinned to defeat search_path hijacking.

create function is_bar_member(b uuid) returns boolean
  language sql security definer stable set search_path = public, pg_temp
as $$
  select exists (
    select 1 from bar_members where bar_id = b and user_id = (select auth.uid())
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

create policy bars_member on bars for select using (is_bar_member(id));
create policy bars_owner_write on bars for all
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy bar_members_member on bar_members for select using (is_bar_member(bar_id));
create policy bar_members_owner_write on bar_members for all
  using (exists (select 1 from bars where bars.id = bar_members.bar_id and bars.owner_id = (select auth.uid())))
  with check (exists (select 1 from bars where bars.id = bar_members.bar_id and bars.owner_id = (select auth.uid())));

-- Every bar-scoped table gets the same single indexed predicate.
create policy players_member          on players          for all using (is_bar_member(bar_id)) with check (is_bar_member(bar_id));
create policy inventory_items_member  on inventory_items  for all using (is_bar_member(bar_id)) with check (is_bar_member(bar_id));
create policy drinks_member          on drinks           for all using (is_bar_member(bar_id)) with check (is_bar_member(bar_id));
create policy sessions_member        on sessions         for all using (is_bar_member(bar_id)) with check (is_bar_member(bar_id));
create policy orders_member          on orders           for all using (is_bar_member(bar_id)) with check (is_bar_member(bar_id));
create policy buy_ins_member         on buy_ins          for all using (is_bar_member(bar_id)) with check (is_bar_member(bar_id));
create policy cashouts_member        on cashouts         for all using (is_bar_member(bar_id)) with check (is_bar_member(bar_id));
create policy payments_member        on payments         for all using (is_bar_member(bar_id)) with check (is_bar_member(bar_id));
create policy share_links_member     on player_share_links for all using (is_bar_member(bar_id)) with check (is_bar_member(bar_id));

-- Join tables inherit tenancy through their parent.
create policy drink_ingredients_member on drink_ingredients for all
  using (exists (select 1 from drinks d where d.id = drink_id and is_bar_member(d.bar_id)))
  with check (exists (select 1 from drinks d where d.id = drink_id and is_bar_member(d.bar_id)));

create policy session_players_member on session_players for all
  using (exists (select 1 from sessions s where s.id = session_id and is_bar_member(s.bar_id)))
  with check (exists (select 1 from sessions s where s.id = session_id and is_bar_member(s.bar_id)));

-- ── create_order ─────────────────────────────────────────────────────────────
-- Replaces handlers/orders.go CreateOrder. That version looped over ingredients
-- decrementing stock with no transaction: a failure partway through left earlier
-- ingredients permanently decremented with no order created.
--
-- security invoker so the caller's RLS still applies.

create function create_order(p_session_id uuid, p_player_id uuid, p_drink_id uuid)
  returns jsonb
  language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_bar_id     uuid;
  v_drink      drinks%rowtype;
  v_order      orders%rowtype;
  v_ing        record;
  v_new_qty    numeric(12,3);
  v_warnings   text[] := '{}';
  v_snapshot   jsonb;
begin
  select bar_id into v_bar_id from sessions where id = p_session_id;
  if v_bar_id is null then
    raise exception 'session not found' using errcode = 'no_data_found';
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
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('item_id', item_id, 'qty_used', qty_used)), '[]'::jsonb)
    into v_snapshot
    from drink_ingredients where drink_id = p_drink_id;

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
  select * into v_order from orders where id = p_order_id;
  if not found then
    raise exception 'order not found' using errcode = 'no_data_found';
  end if;

  update inventory_items ii
     set qty_on_hand = ii.qty_on_hand + (snap->>'qty_used')::numeric
    from jsonb_array_elements(v_order.ingredients) as snap
   where ii.id = (snap->>'item_id')::uuid;

  delete from orders where id = p_order_id;
end;
$$;

-- ── get_shared_tab ───────────────────────────────────────────────────────────
-- Anonymous read for a single player via an unguessable, revocable token.
-- security definer so no table needs to be publicly readable.

create function get_shared_tab(p_token text) returns jsonb
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

  select * into v_player from players where id = v_link.player_id;

  return jsonb_build_object(
    'player', jsonb_build_object('id', v_player.id, 'name', v_player.name, 'venmo', v_player.venmo),
    'orders', (select coalesce(jsonb_agg(to_jsonb(o) order by o.created_at desc), '[]'::jsonb)
                 from orders o where o.player_id = v_player.id),
    'buy_ins', (select coalesce(jsonb_agg(to_jsonb(b) order by b.created_at), '[]'::jsonb)
                 from buy_ins b where b.player_id = v_player.id),
    'cashouts', (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at), '[]'::jsonb)
                 from cashouts c where c.player_id = v_player.id),
    'payments', (select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc), '[]'::jsonb)
                 from payments p where p.player_id = v_player.id)
  );
end;
$$;

revoke all on function get_shared_tab(text) from public;
grant execute on function get_shared_tab(text) to anon, authenticated;

-- ── realtime ─────────────────────────────────────────────────────────────────
-- Subscriptions are authorized by the same RLS policies as reads.

alter publication supabase_realtime add table orders, buy_ins, cashouts, payments, sessions, inventory_items;
