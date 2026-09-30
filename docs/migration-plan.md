# Buy-In — Mongo → Supabase + Monorepo + App Store Plan

**Decisions locked in:**
- Payments: settlement optimizer + deep-link handoff. No funds touch the platform.
- Backend: delete `backend/` (Go). Direct-to-Supabase + Postgres functions + Edge Functions for secrets.
- Accounts: hosts sign up; players are guest rows that can later claim an account.

---

## 1. Target architecture

```
web/ (Next 16) ─┐
                ├─→ supabase-js ─→ Supabase Postgres
native/ (Expo) ─┘                  ├─ RLS (tenancy enforced once, in the DB)
                                   ├─ create_order() / delete_order() RPCs
                                   ├─ Realtime (WAL → clients)
                                   └─ Edge Functions (account deletion, push)
```

`backend/` is deleted. Its two pieces of real logic move into the database:

| Go handler | Becomes |
|---|---|
| `handlers/orders.go` `CreateOrder` | `create_order()` Postgres function (single transaction) |
| `handlers/orders.go` `DeleteOrder` | `delete_order()` Postgres function |
| `handlers/portal.go` | `player_share_links` table + `get_shared_tab(token)` RPC |
| everything else (~18 routes) | PostgREST `select`/`insert`/`update` with RLS |

### Two bugs this fixes for free

1. **`handlers/orders.go:120-137`** — inventory is decremented in a loop with no transaction. If ingredient 3 of 4 fails, ingredients 1 and 2 stay decremented with no order created. Inventory is permanently wrong. A Postgres function is atomic by default.
2. **`handlers/orders.go:216-227`** — `DeleteOrder` restores stock from the drink's *current* recipe. Edit a recipe and every historical order restores the wrong quantities. Fix: snapshot ingredients onto the order row at creation time (the order already snapshots `drinkName`/`price`/`costEstimate` — extend the same idea).

---

## 2. Repo layout

Mirrors ezhomesteading (`web/` + `native/` + `packages/*` at root, bun workspaces — not `apps/`).

```
buy-in/
├── package.json          # workspaces: ["web", "native", "packages/*"]
├── web/                  # existing frontend/, moved
├── native/               # new Expo app
├── packages/
│   └── core/             # @pb/core
└── supabase/
    ├── migrations/       # numbered SQL, like ezh backend/migrations
    └── functions/        # Deno Edge Functions
```

### What goes in `packages/core`

Everything currently duplicated-or-about-to-be between web and native:

| Module | Contents | Source today |
|---|---|---|
| `models.ts` | Row types, generated via `supabase gen types` | `lib/bar-api.ts:16-96` |
| `enums.ts` | Categories, session status, payment direction | scattered string unions |
| `ledger.ts` | `computeBalance`, net positions per player | `lib/bar-api.ts:127` |
| `settlement.ts` | Greedy debt simplification (new) | — |
| `drinks.ts` | `canMake`, cost math | `lib/bar-api.ts:112` |
| `payments.ts` | `venmoUrl()`, `cashAppUrl()`, `paypalUrl()` — **pure string builders** | `lib/bar-api.ts:118` |
| `queries/` | Supabase query builders taking a `SupabaseClient` | `lib/bar-api.ts` fetchers |
| `format.ts` | `formatDate`, `formatTime` | `lib/bar-api.ts:104-110` |

**The DI pattern**, copied from ezhomesteading's `ApiClientConfig`: `core` never constructs a Supabase client. Every query takes one:

```ts
// packages/core/src/queries/orders.ts
export const listOrders = (sb: SupabaseClient, sessionId: string) =>
  sb.from('orders').select('*').eq('session_id', sessionId).order('created_at');
```

Web builds its client with `@supabase/ssr` (cookies), native with `supabase-js` + the `LargeSecureStore` pattern from `ezhomesteading/native/utils/shared/auth/supabase.ts`. Core stays platform-agnostic.

**Concrete example of the split** — `openVenmo()` at `lib/bar-api.ts:118` currently calls `window.location.href`, which does not exist on native. It becomes:

```ts
// packages/core — pure, testable, shared
export const venmoUrl = (handle: string, cents: number, note: string) => ({
  deep: `venmo://paycharge?txn=pay&recipients=${handle.replace(/^@/, '')}&amount=${(cents/100).toFixed(2)}&note=${encodeURIComponent(note)}`,
  web:  `https://account.venmo.com/pay?recipients=...`,
});

// web:    window.location.href = venmoUrl(...).deep
// native: Linking.openURL(venmoUrl(...).deep)
```

### Styling note

`web/` is on Tailwind v4 (`@tailwindcss/postcss ^4.2.2`). NativeWind v4 requires Tailwind 3; **NativeWind v5** is the one that supports Tailwind 4. Either put native on NativeWind 5, or accept that the two apps don't share a Tailwind config. Recommend the former — one token file, two consumers.

---

## 3. Schema

Full DDL lands in `supabase/migrations/0001_init.sql`. Shape:

```sql
-- ── tenancy ──────────────────────────────────────────────
create table bars (
  id       uuid primary key default gen_random_uuid(),
  name     text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table bar_members (
  bar_id  uuid not null references bars(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role    text not null check (role in ('owner','host','player')),
  primary key (bar_id, user_id)
);

create table players (
  id      uuid primary key default gen_random_uuid(),
  bar_id  uuid not null references bars(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,  -- NULL = unclaimed guest
  name    text not null,
  phone   text,
  venmo   text,
  cashapp text,
  created_at timestamptz not null default now()
);
create unique index players_bar_user_uniq on players(bar_id, user_id) where user_id is not null;
```

Then `inventory_items`, `drinks`, `sessions`, `orders`, `buy_ins`, `cashouts`, `payments` — each carrying `bar_id` (denormalized deliberately, so every RLS policy is a single indexed predicate with no joins).

Two Mongo shapes get normalized:
- `DrinkRecipe.ingredients[]` → `drink_ingredients(drink_id, item_id, qty_used)`
- `Session.playerIds[]` → `session_players(session_id, player_id)`

### Money becomes integer cents

Every amount is `float64` today (`models/barModels.go`). For a ledger app that settles real debts, binary floating point is the wrong representation — `0.1 + 0.2` problems show up as off-by-a-penny balances that never reconcile. All money columns become `integer` cents (`price_cents`, `amount_cents`, `cost_estimate_cents`). Quantities stay `numeric(10,3)`.

### RLS

One helper, `security definer` to avoid infinite recursion when policies on `bar_members` query `bar_members`:

```sql
create function is_bar_member(b uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from bar_members where bar_id = b and user_id = auth.uid())
$$;

alter table orders enable row level security;
create policy orders_member on orders for all
  using (is_bar_member(bar_id)) with check (is_bar_member(bar_id));
```

Repeated per table. This is the entire multi-tenancy story — versus adding an owner check to ~20 Go handlers and never once forgetting.

### Share links replace the HMAC portal token

`handlers/portal.go:21` computes `HMAC(PORTAL_SECRET, playerID)`. It is deterministic and permanent: it cannot be revoked, never expires, and rotating the secret invalidates every link at once. Replace with:

```sql
create table player_share_links (
  token      text primary key default encode(gen_random_bytes(24), 'base64url'),
  player_id  uuid not null references players(id) on delete cascade,
  expires_at timestamptz,
  revoked_at timestamptz
);
```

Read via a `security definer` RPC that takes the token and returns only that player's tab — so an anonymous caller gets their data without any table being publicly readable.

---

## 4. Realtime

Supabase Realtime, not a hand-rolled WebSocket. The deciding factor: with no backend service there's nothing to host a socket on, and Realtime authorizes subscriptions through the same RLS policies as reads — one auth model instead of two.

```sql
alter publication supabase_realtime add table orders, buy_ins, cashouts, payments, sessions;
```

Surfaces that go live:
- **Host session view** (`app/session/[id]/page.tsx`, 669 lines, the biggest file) — orders and buy-ins appear as co-hosts add them
- **Player tab** — updates the instant the host pours a drink
- **Low stock** — inventory crossing `reorder_threshold` pushes to the host

This replaces ~40 `useSWR` call sites (see `app/players/[id]/page.tsx`, which fires five separate list fetches and filters client-side).

---

## 5. Settlement optimizer

Net every player to a single position, then greedily match the largest creditor against the largest debtor until everyone is at zero. Bounded at `n-1` transfers.

**Honest scoping:** the current `computeBalance` (`lib/bar-api.ts:127`) models player-vs-*house* — Zach is the bank. In that mode everyone already settles with one person, so the optimizer saves little. The win is real in **peer mode**, where there's no central banker and 7 players produce up to 21 pairwise debts. Build the ledger to support both and let the host pick per session; peer mode is the differentiator worth marketing.

Settlement output feeds the deep links from `packages/core/payments.ts`, then a mark-paid confirmation writes a `payments` row. Optional push reminder for unsettled debts after N days (Edge Function + `pg_cron`).

---

## 6. Auth

Supabase Auth replaces the hardcoded `zach`/`7459` credentials provider at `lib/auth.ts:14`. NextAuth is removed entirely.

- Email/password + Google + **Sign in with Apple** (mandatory — see §8)
- Web: `@supabase/ssr`, cookie sessions, middleware refresh
- Native: `supabase-js` + `LargeSecureStore` (AES + `expo-secure-store`), PKCE flow, `AppState` auto-refresh — lift `ezhomesteading/native/utils/shared/auth/supabase.ts` nearly verbatim
- **Claim flow:** host generates a claim link for a guest player row → invitee signs up → Edge Function sets `players.user_id = auth.uid()` after verifying the token

---

## 7. Migration path

Single-tenant data, 31 commits of history, one real bar. Low risk.

1. Create the Supabase project, apply `0001_init.sql`
2. One-off script: read Mongo → write Postgres, holding a `Map<ObjectId, uuid>` to rewrite foreign keys
3. Create one `bars` row, stamp `bar_id` on every migrated row, make the existing account its owner
4. Convert float dollars → integer cents (`Math.round(x * 100)`)
5. Verify: row counts per collection, and every player's `computeBalance` matches pre- and post-migration

Keep Mongo readable until the web app is fully cut over.

---

## 8. App Store requirements

| Guideline | Requirement | Action |
|---|---|---|
| **5.3.4** | Real-money gaming needs licensing + geo-restriction | **Avoided by design** — ledger only, no funds movement. Logged bets and casino results are records the player types in after the fact; Buy-In takes no bets, sets or quotes no odds, and connects to no book. Deep links hand off to installed apps, same as Splitwise. |
| **4.8** | Third-party login obliges an equivalent private option | Add Sign in with Apple (Google is already advertised in the README) |
| **5.1.1(v)** | In-app account deletion | Edge Function calling `auth.admin.deleteUser` |
| Age rating | Alcohol, simulated gambling references, and a private log of real-money gambling results | Rate 17+ |
| Privacy | Nutrition labels + privacy manifest | Declare email, name, and any push tokens |

**Positioning matters for review.** Store copy should read as an expense/ledger tracker for home games, with a private results log. Avoid "play poker," "bet," "win," "cash out" as headline verbs. *(Reworded 2026-09-29, log-events item 30: logging sports bets and casino results added the private log, the "bet" verb and the no-odds clause above; the owner picked the plain wording.)* Precedent: [PokerPot](https://apps.apple.com/us/app/-/id6758568455), [ChipUp](https://apps.apple.com/il/app/chipup/id6747723921), and [Poker Ledger Pro](https://apps.apple.com/us/app/poker-ledger-pro/id6753264258) all ship this exact shape — and none of them move money.

---

## 9. Sequencing

| Phase | Work | Rough size |
|---|---|---|
| 0 | Monorepo scaffold, bun workspaces, Supabase project | S |
| 1 | Schema + RLS + `create_order`/`delete_order` RPCs + share links | M |
| 2 | Mongo → Postgres migration script + verification | S |
| 3 | Extract `packages/core` from `lib/bar-api.ts` | M |
| 4 | Web port: Supabase Auth, swap SWR fetchers for queries, wire Realtime, delete `backend/` | L |
| 5 | Native app: Expo Router, NativeWind, host screens + player tab | L |
| 6 | Settlement optimizer, peer mode, deep links, mark-paid, push | M |
| 7 | Sign in with Apple, account deletion, EAS build/submit, store assets | M |

Phases 0–4 leave a fully working web app on Supabase with the Go service gone — a good checkpoint to ship before native starts. Phase 5 is where reusing `packages/core` pays off: the ledger math, settlement, and query layer are already written and tested.

## 10. Open risks

- **Guideline 5.3 is a judgment call by a reviewer.** Mitigated by shipping zero payment processing, but budget for one rejection and an appeal explaining the ledger-only model.
- **NativeWind 5 / Tailwind 4** pairing is newer than the v4/Tailwind-3 combo running in ezhomesteading. Validate early in phase 5 or accept separate style configs.
- **Peer mode is a real product change**, not a refactor. It alters what a "session" means and needs its own UX pass.
