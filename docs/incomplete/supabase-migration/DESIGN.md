# Supabase migration — DESIGN

**Status: `RATIFIED` 2026-09-16.**

**The decisions are §7 (`D1`–`D14`), amended by §10 (`D15`–`D18`). Everything before §7 is
the evidence they were made on** —
§1 what was verified, §2 the boundary, §3 the options with their counter-arguments, §4 the
dials, §5 the hazards, §6 the questions and the owner's answers. Read §7 and §8 before any
build phase; read §1–§6 when a decision looks wrong, because the argument against it is already
written there.

**From here this design is frozen.** It changes by amendment only — a new dated `D<n>`, or an
`As built:` note under the decision that moved — never by editing a decision in place. A later
phase that finds a decision inconvenient does not get to reinterpret it; it either cites the
decision or supersedes it in writing.

*History of this file.* Opened 2026-09-16 as `PASSOFF.md` item 6, out of GATE 0's third answer
(`HANDOFF.md`, Settled, 2026-09-16), as `SCOPE.md` — Stage 2, driver Fable 5.1, proposing and
deciding nothing. GATE 1 was answered by the owner on 2026-09-16 and it was renamed to this
file the same day (`PASSOFF.md` item 7, driver Opus 5), which is why §1–§6 read as a document
that has not decided anything yet: they had not. They are kept unedited except where a row was
re-verified, so that the decisions in §7 can be read against exactly what was known when they
were taken.

**The effort in one line.** Move Buy-In off the Go/Gin + MongoDB API onto Supabase
Postgres, called directly from `web/` under RLS and Postgres functions, filling
`packages/core` with the shared logic on the way and deleting `backend/` at the end.

**Fixed before this document existed** — carried in as scope, not as options (`HANDOFF.md`,
Settled, "The target architecture is decided, not built", 2026-09-16): payments are a
settlement optimizer plus a deep-link handoff with **no funds touching the platform**;
`backend/` is deleted in favour of Postgres functions and Edge Functions; hosts sign up while
players are guest rows that can claim an account later.

**Read with.** `HANDOFF.md` (what is true) → `docs/migration-plan.md` (the plan this scopes —
a good plan and the wrong shape: it mixes locked decisions with a schema, a target layout and
two bug fixes, and nothing in it is staged, gated or ratified) → `docs/AGENT-PRACTICES.md`
§2.2 (the contract this folder follows).

---

## 1. What exists, verified 2026-09-16

Every row was checked in this checkout on 2026-09-16, branch `supabase-monorepo` at
`d814583`. Where the plan or the ledger said something different, the difference is in the
row. Environment values were never read — only variable *names* (`cut -d= -f1`).

### 1.1 Tree and toolchain

| Claim | Verified state | Citation |
|---|---|---|
| Branch state | `supabase-monorepo` at `d814583`, 36 commits; `main` at `4d368c0`, 31 commits, last touched 2026-04-26. Remote `git@github.com:zach-short/poker-bar.git`. The plan's "31 commits of history" was `main`'s count. | `git rev-list --count HEAD` → 36; `git rev-list --count main` → 31; `git log -1 --format=%ci main`; `git remote -v` |
| Workspaces | `web` and `packages/*` only. **No `native/`.** The plan's layout (§2) lists `["web", "native", "packages/*"]`. | `package.json:5-8`; `ls` at the root |
| `packages/core` | `src/index.ts:6` is `export {}`; imported by nothing. Deps: `zod ^3.25.64`; peer `@supabase/supabase-js ^2.110.5`, resolved to 2.112.0 and installed at the root. Its `tsconfig.json:6` sets `lib: ["ESNext", "DOM"]`, so `window`/`document` **type-check inside core** — the platform-free header (`src/index.ts:1-4`) is enforced by review only. | `grep -rn "@pb/core" web packages -l` → only `packages/core/src/index.ts`, `packages/core/package.json`; `packages/core/package.json:12-16`; `bun.lock:514`; `ls node_modules/@supabase` |
| `supabase/` | `migrations/0001_init.sql`, 360 lines, tracked, **applied nowhere**. `functions/` empty. **No `config.toml`**, so `supabase init` has never run here. | `git ls-files supabase` → the one file; `find supabase -maxdepth 3`; `ls supabase/config.toml` → No such file |
| Supabase MCP | None configured. | `.mcp.json` lists `next-devtools`, `context7`, `playwright`; `grep -n supabase .mcp.json` → nothing; `.claude/settings.local.json` `enabledMcpjsonServers: []` |
| Tooling on this machine | Supabase CLI 2.115.0 (2.117.0 available). **Docker absent**, so `supabase start` (the local stack) cannot run here. `psql` present. bun 1.2.9, node v26.7.0, Go at `/usr/local/go/bin/go`. | `supabase --version`; `which docker` → not found; `which psql` → `/opt/homebrew/bin/psql` |
| Env names | `web/.env`: `NEXT_PUBLIC_API_URL` (→ `http://localhost…`), `AUTH_SECRET`, `NEXT_PUBLIC_VENMO_HANDLE`; no `SUPABASE_*`. `backend/.env`: `DATABASE_URL`, `DATABASE_NAME`, `JWT_SECRET`, `PORT`, `GIN_MODE`; **no `PORTAL_SECRET`**. | `cut -d= -f1 web/.env`; `grep -q 'NEXT_PUBLIC_API_URL=http://localhost' web/.env` → true; `cut -d= -f1 backend/.env`; `grep -c PORTAL_SECRET` → 0 |
| Gates | `cd web && npx tsc --noEmit` exit 0; `cd packages/core && npx tsc --noEmit` exit 0; `cd backend && go build ./... && go vet ./...` exit 0 — all run in this session. `bun run build` exit 0 per `HANDOFF.md` step 4 (same day; not re-run, docs-only item). Lint exit 1, 105 problems (step 5). `bun run test` exit 1: no test files, no vitest config. | runs 2026-09-16; `HANDOFF.md` Environment |
| Docs | `docs/` holds `AGENT-PRACTICES.md`, `conventions-typescript.md`, `migration-plan.md`; **no `docs/README.md` index** (standard §8.2). Only `migration-plan.md` is tracked; the other two are excluded. `docs/incomplete/` is **not** excluded, so this folder is committable. | `ls docs`; `git ls-files docs` → `docs/migration-plan.md`; `.git/info/exclude:11-17` |

### 1.2 The Go API (`backend/`)

| Claim | Verified state | Citation |
|---|---|---|
| Identity | Module `github.com/zach-short/nextjs-boilerplate`, Go 1.24.1, gin 1.10.1, mongo-driver 1.17.4. | `backend/go.mod:1-11` |
| Route count | 1 health + 4 `/auth/*` + **26** `/api/*`. The plan's "everything else (~18 routes)" undercounts. | `backend/routes/routes.go:10-59` |
| **No authentication on any `/api` route** | The bar group carries no middleware — "no auth — single-user app". `AuthMiddleware` is referenced only to keep its import alive. CORS allows `localhost:3000` and `https://poker-buy-in.vercel.app`; CORS is a browser courtesy, not authentication. The NextAuth gate protects *pages*, not the API. | `routes.go:23`, `routes.go:61`; `main.go:20-29`; `web/proxy.ts:4-23` |
| Auth subsystem is dead code | `handlers/auth.go` (login/register/social/check-email over a `users` collection), `middleware/auth.go`, `utils/jwt.go` serve routes the app never calls: the web client for them, `web/lib/api.ts`, is imported by exactly one file, `web/components/auth/unified-auth.tsx`, and `UnifiedAuth` is imported by nothing. `web/types/auth.ts` and `web/models/user.ts` exist for that path only. The real login is a hardcoded name/password pair. | `grep -rn "lib/api'" web` → one hit; `grep -rn UnifiedAuth web` → only its own file; `web/lib/auth.ts:13` |
| Money is `float64` | Every amount, quantity, price and cost. | `backend/models/barModels.go:22-24,35-36,52,60,66,79-80` |
| Bug 1 (plan §1) — verified | `CreateOrder` checks stock in one loop, then decrements in a second loop with no transaction; a failure mid-loop leaves earlier decrements in place and no order. | `backend/handlers/orders.go:100-117`, `:119-138` |
| Bug 2 (plan §1) — verified | `DeleteOrder` restores stock from the drink's *current* recipe, and discards the update errors. | `orders.go:217-228` |
| Bug 3 — **not in the plan** | `DeleteSession` deletes the session, then `DeleteMany` on orders, buy-ins and cashouts with every error ignored. Payments are not session-scoped (`Payment` has no `SessionID`) and survive. | `backend/handlers/sessions.go:138-146`; `barModels.go:64-71` |
| Share/portal token | `HMAC-SHA256(PORTAL_SECRET, playerID)`, hex. Deterministic, no expiry, no revocation. **When `PORTAL_SECRET` is unset it falls back to the literal `dev-portal-secret`** — and `backend/.env` has no `PORTAL_SECRET`, so in the configured environment every player's token is computable from their id. | `backend/handlers/portal.go:19-27`; §1.1 env names |
| Two settlement mechanisms | `orders.paid` (set on all of a player's orders in a session by `MarkPlayerTabPaid`) and `payments` rows with `direction` received/sent. `computeBalance` reads payments and **ignores `paid`**; `paid` is a display flag. | `orders.go:163-195`; `backend/handlers/ledger.go:214-252`; `web/lib/bar-api.ts:127-140` |
| Player name uniqueness | Enforced by a lookup before insert, not an index. | `backend/handlers/players.go:56-61` |
| Seed | `seed/main.go` wipes and reseeds `inventory` and `drinks` only; `update_prices.go` is `//go:build ignore`. | `backend/seed/main.go:50-52`; `backend/seed/update_prices.go:1` |
| The Mongo data | **Unreachable from this checkout** (needs `DATABASE_URL`, not read). Row counts, session count and the plan's "one real bar" are unverified here. | — |

### 1.3 The web app (`web/`)

| Claim | Verified state | Citation |
|---|---|---|
| Stack | Next.js ^16.2.4, React 19.1.0, next-auth ^5.0.0-beta.30, swr ^2.4.1, axios ^1.15.0 (dead path only), `@ducanh2912/next-pwa` ^10.2.9, Tailwind v4. Package name `nextjs-boilerplate`. | `web/package.json:2,10-33` |
| Size | 20 routes. Largest files: `session/[id]/page.tsx` 669 lines, `players/[id]/page.tsx` 509, `session/[id]/player/[playerId]/page.tsx` 322, `receipt-ui.tsx` 318, `player-receipt/…/page.tsx` 316, `summary/page.tsx` 295. | `wc -l` 2026-09-16 |
| Data layer | One file, `web/lib/bar-api.ts`: raw `fetch` wrapper `apiFetch` (1-13), row types (17-96), `formatDate`/`formatTime` (98-104), `canMake` (106-109), `openVenmo` (111-118, touches `window.location` and `document.hidden`), `markPlayerTabPaid` (120-125), `computeBalance` (127-140). Imported by 16 files. The plan's line cites drift by ~5 lines (e.g. `canMake` cited as `:112`). | `cat -n web/lib/bar-api.ts`; `grep -rln "lib/bar-api" web` |
| `useSWR` sites | 74 grep hits in 15 files, 15 of them import lines → **59 hook call sites** (plan: "~40"). The only "live" behaviour is a 15 s poll of orders on the session screen. | `grep -rn useSWR web --include='*.tsx'`; `web/app/session/[id]/page.tsx:39` |
| `NEXT_PUBLIC_API_URL` read inline | Four places, not one — a pre-existing D1 violation. | `bar-api.ts:1`, `api.ts:38`, `receipt/[sessionId]/[playerId]/page.tsx:4`, `…/opengraph-image.tsx:6` |
| Venmo URL building | Duplicated three times with different semantics: `bar-api.ts:111-118` (recipient = the *player's* handle, note `'poker'`); `player-receipt` page `:85-102` (recipient = `NEXT_PUBLIC_VENMO_HANDLE`, pay or charge by sign of balance, note `'poker'`); `receipt-ui.tsx:54-72` (recipient = env handle, note = session name). | those lines |
| Balance convention | `computeBalance` = drinks + buy-ins − cashouts − received + sent; **positive means the player owes the house**. "Settled" is `Math.abs(balance) < 0.01` — a float epsilon that becomes `=== 0` in cents. | `bar-api.ts:134-139`; `portal/…/page.tsx:107`; `player-receipt/…/page.tsx:245` |
| Public surfaces | `/`, `/login`, `/menu`, `/receipt/*`, `/portal/*`, `/player-receipt/*` skip the login gate. **`/receipt/[sessionId]/[playerId]` needs no token at all**: it fetches *all* sessions and *all* players server-side for metadata, and its client mints the player's portal token unauthenticated. `/portal` and `/player-receipt` validate a token, then fetch the whole `orders`/`buyins`/`cashouts` collections and filter client-side. | `web/proxy.ts:8-14`; `receipt/…/page.tsx:13-18`; `receipt-ui.tsx:14-17`; `portal/…/page.tsx:24-29`; `player-receipt/…/page.tsx:34-38` |
| Session membership | `Session.playerIds[]` is used for `includes` and for the default selected player (`playerIds[0]`); display order comes from the players list, which the API sorts by name. Array order is not load-bearing beyond that default. | `session/[id]/page.tsx:80-85,166-173`; `players.go:21` |
| One cashout per player per session | Assumed by the UI everywhere (`cashouts.find`, a `some` guard before creating one); enforced nowhere in Go. | `session/[id]/page.tsx:106,218`; `summary/page.tsx:80`; `receipt-ui.tsx:47`; `player-receipt/…/page.tsx:75` |
| Tenancy and peer mode in app code | **None.** No `bar_id`/`barId` in web; no `peer`/`settle_mode` in web or Go (the one hit is a Tailwind `peer-disabled:` class). Both exist only in the schema and the plan. | `grep -rn "bar_id\|barId" web` → nothing; `grep -rni "peer\|settle_mode\|settleMode" web backend` → `web/components/ui/label.tsx:16` only |
| The owner is hardcoded as the counterparty | `NEXT_PUBLIC_VENMO_HANDLE` is the payee/payer on both receipt pages; the portal error copy says "Ask Zach for a new one"; the login is `zach`/`7459`. | `player-receipt/…/page.tsx:11,86`; `receipt-ui.tsx:55-57`; `portal/…/page.tsx:36`; `web/lib/auth.ts:13` |
| PWA | `cacheOnFrontEndNav` and `aggressiveFrontEndNavCaching` on; disabled in development. Generated workers in `web/public` are tracked and were not rewritten by the 2026-09-16 build. | `web/next.config.ts:4-13`; `HANDOFF.md` Known facts |

### 1.4 The unapplied schema (`supabase/migrations/0001_init.sql`)

| Claim | Verified state | Citation |
|---|---|---|
| Shape | 13 tables: `bars`, `bar_members`, `players`, `inventory_items`, `drinks`, `drink_ingredients`, `sessions`, `session_players`, `orders`, `buy_ins`, `cashouts`, `payments`, `player_share_links`. Money integer cents throughout; quantities `numeric(12,3)` (plan §3 said `numeric(10,3)`). | lines 12-171 |
| Peer-mode columns already present | `sessions.settle_mode` banked\|peer; `payments.counterparty_player_id`. | lines 84-86, 148-149 |
| The three fixes | `orders.ingredients jsonb` snapshot; `create_order()` locks ingredient rows `for update`, `security invoker` so RLS still applies; `delete_order()` restores from the snapshot; session deletion cascades by FK (`on delete cascade` on every child). | lines 110-113, 235-296, 301-319, 104,123,134 |
| Share links | `player_share_links.token` = 24 random bytes as **hex** (plan §3 said base64url), with `expires_at`/`revoked_at`. `get_shared_tab(token)` is `security definer`, granted to `anon` and `authenticated`, and returns the player's orders/buy-ins/cashouts/payments **across all sessions**. | lines 163-171, 325-355 |
| RLS | `is_bar_member()` security-definer helper; RLS enabled on all 13 tables; one predicate per bar-scoped table; join tables through their parent; `bars` readable by members, writable by owner. | lines 177-226 |
| Realtime | Publication adds **six** tables (plan §4 lists five; `inventory_items` was added). | line 360 |
| **Gaps found by reading the schema against the app** (for `DESIGN.md`; nothing decided here) | (a) **No host payment handle anywhere** — `bars` has `id`, `name`, `owner_id`, `created_at`, but the receipt pay button needs the host's Venmo handle, which is `NEXT_PUBLIC_VENMO_HANDLE` as of 2026-09-16. (b) **No way for a new user to create a bar and their own membership** — `bar_members_owner_write` needs the bar to exist first, and nothing creates the pair (no trigger on `auth.users`, no `create_bar()` RPC). (c) No uniqueness on `players (bar_id, name)` or `cashouts (session_id, player_id)`, both of which the app assumes (§1.2, §1.3). (d) `create_order` never checks that `p_player_id` is in `session_players` or in the session's bar. (e) No claim-flow function for `players.user_id`. (f) `sessions.played_on` is a `date`, while Mongo `Session.Date` is a timestamp used for sort order — same-day sessions lose their order. (g) `orders.created_at`/`buy_ins.created_at`/… default to `now()` — the import must write Mongo `timestamp` into them or every receipt reorders. | `0001_init.sql:12-17,204-206,235-296,78-88,101-116`; `sessions.go:21` |

### 1.5 Deployment and data

| Claim | Verified state | Citation |
|---|---|---|
| A Vercel deployment was intended | ~~A personal-scope project cannot be listed with the Vercel MCP, so **whether `poker-bar.vercel.app` is live is unverified**.~~ **Corrected 2026-09-16 (Stage 3 session): it is live.** `https://poker-bar.vercel.app` answers `HTTP/2 200`, `server: Vercel`, and sets `__Host-authjs.csrf-token` and `__Secure-authjs.callback-url` — so what is deployed is this NextAuth app. The MCP listing (one team `ezh`, hobby: `ezhomesteading`, `fantomworks`, `farm` — no `poker-bar`) was right and incomplete: personal-scope, invisible to that tool, not absent. CORS still allows the origin. No `vercel.json`/`.vercel` in the repo, so **whether a push to `main` auto-deploys through Vercel's git integration is still unverified** — asked at Q11. | `curl -sI https://poker-bar.vercel.app` 2026-09-16; `backend/main.go:23`; `list_teams`/`list_projects` 2026-09-16 |
| The Go API host | ~~Unknown from this checkout; `web/.env` points at localhost.~~ **Corrected 2026-09-16 (Stage 3 session): `https://poker-bar.onrender.com`** — Render. `NEXT_PUBLIC_API_URL` is inlined into the client bundle at build time, so the deployed origin is readable from the deployed app itself. `GET /health` → 200. `web/.env` still points at `http://localhost…` for local dev (§1.1), which is why the checkout alone could not show this. | `grep` over the chunks under `https://poker-bar.vercel.app/_next/static/chunks/` 2026-09-16 → `https://poker-bar.onrender.com`; `curl -o /dev/null -w '%{http_code}' https://poker-bar.onrender.com/health` → 200 |
| Shipping | Nothing in *this repo* ships anything — no CI, no deploy config (`ls .github` → nothing; no `vercel.json`/`.vercel`). **But two hosts are serving as of 2026-09-16** (rows above), so "merged is not shipped" (`HANDOFF.md`) is now only half the story: whether Vercel's git integration redeploys on a push to `main` is configured outside the repo and is unverified — Q11. | `ls .github` → nothing; the two rows above |
| **The live API is open to the internet** | An unauthenticated `curl` from outside every allowed origin returns real data: `GET /api/players` → 200, **20 rows carrying `name` and `phone`**; `GET /api/sessions` → 200, 18 rows; `GET /api/orders` → 200, 35 rows. CORS (`main.go:20-29`) is a browser policy and does not apply to a direct request. Writes are in the same unauthenticated group by construction (`routes.go:23-58`) — **not tested, and not to be tested.** Further collections (buy-ins, cashouts, payments, drinks, inventory) were **not** counted: this session's PII guard stopped the probe, correctly, and the attempt was not worked around. | `curl` 2026-09-16 against `https://poker-bar.onrender.com`; `backend/routes/routes.go:23`; `backend/main.go:20-29` |

### 1.6 House precedent (`~/Projects/ezhomesteading`), verified 2026-09-16

| Claim | Verified state | Citation |
|---|---|---|
| Native auth precedent | The plan cites `ezhomesteading/native/utils/shared/auth/supabase.ts` — **that path does not exist**. The file is `native/lib/shared/auth/supabase.ts` (`LargeSecureStore`, AES-CTR over `expo-secure-store`). Relevant only if native comes into scope. | `ls native/utils/shared/auth/supabase.ts` → No such file; `sed -n 1,40p native/lib/shared/auth/supabase.ts` |
| `ApiClientConfig` | `packages/api/src/api-client.ts:38-44` — an axios REST client config (`baseURL`, `getAccessToken`, `onAuthFailure`, `isPublicRoute`). It is the *idea* the plan wants (inject the platform's client), not a supabase-js query-builder pattern. | that file |
| Web Supabase clients | `web/lib/supabase/client.ts` (`createBrowserClient` from `@supabase/ssr`), `server.ts` (`createServerClient` over `next/headers` cookies), `middleware.ts`; env read once through `@/lib/env/client` — the D1 shape to copy. | those files, heads read |
| A Mongo → Postgres move was done there | Archive: `mongo-removal/` ✅ (2026-07-15), `backend-migration/` (2026-07-13). It went *through* a Go backend rather than direct-to-Supabase, so its id-map approach transfers and its architecture does not. | `~/Projects/archive/ezhomesteading/INDEX.md`, "Schema & backend migration" |

### 1.7 `personal-config` and this folder

| Claim | Verified state | Citation |
|---|---|---|
| "Creating `docs/incomplete/` makes discovery read this repo as Profile P" (`PASSOFF.md` item 6, Watch for) | **Only in a fresh clone.** `impliedProfile` returns `'ledger'` first when `HANDOFF.md` or `PASSOFF.md` is present on disk, and `'folders'` from the `docs/incomplete` marker only otherwise. In this checkout both files exist (excluded from git, present on disk), so discovery keeps saying `ledger`. In a fresh clone they are absent, `docs/incomplete/` is the only marker, and `setup` would write `folders`. Either way `setup` must not be re-run here (`HANDOFF.md`, Known facts). | `~/Projects/personal-config/src/lib/discover.ts:31,96-97`; `src/commands/setup.ts:173-178,191` |

---

## 2. What this is / what this is not

### This is

1. **A Supabase project**, created by the owner, with `0001_init.sql` applied — after it is amended for the gaps in §1.4 (it has never been applied, so it may still be edited; see O2).
2. **Supabase Auth for hosts**, replacing NextAuth (`web/lib/auth.ts`, `web/proxy.ts`, the login page, the `SessionProvider`), with the dead auth path (`web/lib/api.ts`, `unified-auth.tsx`, `types/auth.ts`, `models/user.ts`) deleted.
3. **`packages/core` filled**: generated row types; `computeBalance` in integer cents; the settlement optimizer as pure logic; `venmoUrl()`-style pure URL builders; `formatDate`/`formatTime`; `canMake`; query builders that take a `SupabaseClient` — with characterization tests written *before* the move (`docs/conventions-typescript.md` X1).
4. **The web port**: every `bar-api.ts` fetcher and `useSWR` key rewired to Supabase queries and RPCs; the public pages rewired to security-definer RPCs with revocable tokens; one typed client and env read once (D1).
5. **A one-shot data migration** of the existing Mongo data into one `bars` row owned by the owner's new account: id map, float → cents, timestamps preserved, verified by row counts and per-player balances before and after.
6. **Cutover and deletion**: `backend/` removed with its env, README sections, the Go module, the CORS origins and every `NEXT_PUBLIC_API_URL` read.
7. **The three atomicity bugs fixed as a consequence** — by the schema and its functions, never by editing Go.

### This is not (parked; each stays parked unless GATE 1 says otherwise)

- **`native/`** — Expo, NativeWind, EAS, App Store positioning (plan phases 5 and 7, §8). A second platform is its own effort (`docs/AGENT-PRACTICES.md` Part 5, "spans two platforms"). `native/` is not created as a side effect (`CLAUDE.md`, Architecture).
- **Sign in with Apple / Google, the account-deletion Edge Function, push, `pg_cron` reminders** — App Store prerequisites that travel with native.
- **Peer-mode UX** — the plan itself calls it "a real product change, not a refactor" (§10). The schema column and the pure optimizer are cheap and in; the session UI for choosing and settling peer mode is not.
- **Multi-bar UI** — switching bars, inviting co-hosts through `bar_members`. The schema supports it; the migration creates exactly one bar; no UI for a second.
- **Fixing the 105 lint findings, redesigning any screen, design tokens (S1)** — the port keeps every screen as it is; "no drive-by fixes" (`docs/AGENT-PRACTICES.md` Part 11).
- **Editing `backend/` for any reason** — it is deleted, not fixed (`CLAUDE.md`, Directory map).
- **Decommissioning the Mongo Atlas cluster and the Go host** — the owner's action after cutover; recorded, not done.
- **A `docs/README.md` index** (standard §8.2) — owed by the repo now that it has four docs; not this effort's.

---

## 3. Options

Each option carries the strongest argument *against* the recommendation, so that argument does not return in three weeks as a new objection. **Recommended** marks the one this document would pick; the owner picks at GATE 1.

### O1 — Supabase project topology

- **(a) One hosted project, used as dev now and promoted to prod at cutover.** One set of keys, one env file, the import rehearsed and then run for real on the same database. *Against:* the rehearsal data has to be wiped before the real import, and "wipe then reload" on the database that will be production is exactly the step that goes wrong once.
- **(b) Two hosted projects — `dev` now, `prod` created at cutover — Recommended.** The import script is rehearsed on `dev` as many times as needed and run once on `prod`; the migration files are the only thing that has to match. *Against:* two sets of keys and env files to manage, and free-tier projects that sit idle get paused by Supabase (verify the current policy on the pricing page before relying on `dev` staying up between sessions).
- **(c) Local stack via `supabase start`.** Free, disposable, fastest loop. *Against:* needs Docker, which this machine does not have (§1.1); installing it is the owner's call and a real cost.

### O2 — Amend `0001_init.sql` in place, or stack `0002`

- **(a) Amend `0001` in place until the first apply, then freeze — Recommended.** The invariant is "an *applied* migration is never edited" (`HANDOFF.md`, Invariants); `0001` has been applied nowhere (§1.1). One coherent initial schema is easier to read than `0001` plus a `0002` that immediately alters it. *Against:* the file has been committed on the branch, so a reader who trusts git history over the ledger may think it was applied; and the day it *is* applied somewhere without the ledger being updated, in-place edits become silent corruption. Mitigation: the ledger step that first applies it names the ref and the hash.
- **(b) Stack `0002_…` for the §1.4 gaps.** Never edit a committed migration, applied or not. *Against:* a `0002` that adds a column to `bars`, a unique index to `players`, a `create_bar()` function and a claim function before anything has run is ceremony, and the number rule ("read the directory") already protects the only real hazard.

### O3 — Auth providers at web launch

- **(a) Email + password only — Recommended.** Replaces `zach`/`7459` with the same one host; no OAuth app registrations, no Apple obligation (Apple's rule bites only when a third-party login is offered, and only in the App Store). *Against:* the plan promises Google and Apple, and adding a provider later touches the login screen twice.
- **(b) Email + password + Google.** *Against:* a third-party login on the web is what later obliges Sign in with Apple on iOS (plan §8, guideline 4.8) — a debt taken on before native exists.

### O4 — Live updates

- **(a) SWR against Supabase queries first, Realtime as its own phase after cutover — Recommended.** The cutover phase then changes one thing (the data source), not two (data source and push model). The session screen keeps its 15 s poll (`refreshInterval`) as a dial. *Against:* the same 15 files are touched twice, and "later" phases are the ones that get cut.
- **(b) Realtime in the port itself (plan §4).** One pass over the screens. *Against:* the anonymous share-link pages (`/portal`, `/player-receipt`) cannot subscribe through RLS at all — `anon` has no row access; `get_shared_tab` is a security-definer read — so they need polling or a broadcast channel regardless, which means two live models in one phase.

### O5 — Data migration mechanics

- **(a) A one-shot TypeScript script (bun) under `scripts/`, reading Mongo with the `mongodb` driver and writing Postgres through supabase-js with the service-role key — Recommended, with two conditions:** it is idempotent so it can be rehearsed on `dev` repeatedly (see `D9`'s 2026-09-25 amendment for what that means as built — not a literal truncate-and-reload on every run), and it takes the owner's `auth.users` id as an argument (the bar needs an owner before any row can be inserted — §1.4 gap b). Lives outside `backend/`, which is off-limits. *Against:* both databases' credentials on one machine, and a service-role key in a script's environment — acceptable once, on the owner's machine, never committed.
- **(b) `mongoexport` to JSON, transform, load with `psql \copy`.** No service-role key; the JSON dump is a durable snapshot for verification. *Against:* more manual steps; the dump contains phone numbers and Venmo handles and must stay out of git.
- **(c) A Go script inside `backend/` (it already has the Mongo driver).** *Against:* `backend/` takes no new work (`CLAUDE.md`).

### O6 — What goes into `packages/core`, and when

- **(a) Extract the pure logic first — `computeBalance` (in cents), settlement, URL builders, format, `canMake` — with characterization tests, before any Supabase code — Recommended.** It is the cheapest phase, it is where the float → cents change is proven, and it makes the test gate real (§5, H8). Queries follow in the port phase, taking a `SupabaseClient` as the plan describes. *Against:* the DI-by-parameter pattern the plan cites is an axios REST client in ezhomesteading (§1.6), not supabase-js; the query-builder shape is being invented here, and if `native/` never arrives, the extraction bought nothing but tests.
- **(b) Port `web/` straight to supabase-js in `web/lib` and extract core when native exists.** Less ceremony now. *Against:* the ledger math is the one piece of this app whose failure is silent (a wrong balance compiles and renders), and moving it without tests into a rewrite of the data layer is exactly the Deep-tier hazard this folder exists to avoid.

### O7 — Public receipt and portal access

- **(a) Every public read goes through a security-definer RPC that takes a `player_share_links` token, including `/receipt/[sessionId]/[playerId]` — Recommended.** Under `0001`'s RLS, `anon` can read nothing, so the receipt page as written (§1.3, "needs no token at all") breaks on day one; a per-session RPC (`get_receipt(token, session_id)`, or `get_shared_tab` with a session filter) is the smallest fix. *Against:* every link already sent by SMS dies at cutover — the URL shape changes and the old HMAC token is not a share-link row.
- **(b) Keep the receipt public by ids, with a permissive `anon` select policy on sessions/players/orders.** Old links survive. *Against:* it is a hole in the tenancy model the whole migration is built on, and it is the kind of "just add a policy" change that passes every gate and is wrong in production.
- **(c) Import the old HMAC tokens as `player_share_links` rows.** Old links survive under (a). *Against:* it means computing every player's token with the fallback secret during the import, then carrying a token derived from a public constant as a live credential.

### O8 — Cutover

- **(a) Big-bang: deploy the ported web pointed at `prod`, keep Mongo readable, delete `backend/` in the following commit — Recommended.** One bar, one host, owner-run: a quiet evening is enough. *Against:* rollback is "redeploy the previous commit and re-point the env", and any order poured between import and cutover has to be re-entered by hand — so the import runs after the last session on Mongo, not before.
- **(b) Dual-read / feature flag.** *Against:* two data sources behind one UI for a single-tenant hobby app is more machinery than the risk warrants.

### O9 — Row types

- **(a) `supabase gen types typescript` committed into `packages/core`, regenerated as part of every migration phase's done-when — Recommended.** *Against:* a large generated file in the diff of every schema change; no CI to regenerate it, so drift is caught only by the phase's done-when.
- **(b) Hand-written zod schemas for every table.** Runtime validation for free. *Against:* two sources of truth for one schema; zod belongs at the boundaries where user input is parsed, not as a mirror of DDL.

---

## 4. Dials

Every number the design leaves open, with a default, destined for one config constant in `packages/core` rather than a literal hardcoded twice.

| Dial | Recommended default | As of 2026-09-16 | Why this default |
|---|---|---|---|
| Share-link expiry | 30 days; `NULL` allowed for a permanent link the host makes on purpose | never (HMAC, `portal.go:19-27`) | Links are sent by SMS the night of a session; a month covers "I'll pay you next week". |
| Claim-link expiry (guest → account) | 7 days | n/a | Shorter than a share link because it grants write access to a row. |
| Share-link token length | 24 random bytes | `0001_init.sql:164` | Already in the schema; 192 bits is unguessable. |
| Session-screen refresh interval (while O4a holds) | 15 s | `session/[id]/page.tsx:39` | Matches current behaviour; a dial so Realtime can later set it to 0. |
| Realtime publication tables (when O4's second phase runs) | the six at `0001_init.sql:360` | none | What the plan listed plus inventory for low-stock. |
| Auth session lifetime | Supabase defaults | 10 years (`web/lib/auth.ts:25`) | The 10-year JWT was a convenience for one hardcoded user; defaults are the safer starting point. |
| Import verification tolerance | 0 cents, exact | n/a | A ledger that is off by a cent is wrong; the conversion is `Math.round(x * 100)` and sums must match to the cent per player. |

---

## 5. Hazards this work walks into

- **H1 — The Go API is open until cutover.** Every `/api` route is unauthenticated (§1.2) and the portal secret is a public constant in the configured environment. This migration is also the security fix; nothing in `backend/` will be patched in the meantime (out of scope), so cutover has a deadline it did not have before.
  **Upgraded 2026-09-16 (Stage 3 session): this is not latent, it is live.** The API is deployed at `https://poker-bar.onrender.com` and answered an unauthenticated read of 20 player rows *with phone numbers* from outside every allowed origin (§1.5). The `/api/players/:id/portal-token` route is in the same open group (`routes.go:29`), so any caller can mint any player's portal token from a public id — and that token is HMAC'd with the literal `dev-portal-secret` fallback in the configured environment (§1.2). Two independent breaks of the same surface. The deadline is therefore not "cutover, eventually" but a decision the owner makes now, which is why it entered GATE 1 as **Q13** rather than being taken here: every mitigation except "accept it" touches `backend/` or its host, both out of scope for this effort.
- **H2 — RLS locks out every public page.** Under `0001`, `anon` reads nothing; `/receipt`, `/portal` and `/player-receipt` all break unless they go through security-definer RPCs (O7). The tempting fix — a permissive `anon` policy — passes every gate and silently defeats tenancy. This is the one place a Deep review of the SQL is worth its cost.
- **H3 — The schema has no host to pay.** `bars` carries no payment handle (§1.4 gap a); the pay button's recipient is an environment variable as of 2026-09-16. Without a column, the first multi-host bar pays the wrong person. Decided at GATE 1 (Q6), amended per O2.
- **H4 — Sign-up creates a user and nothing else.** No trigger or RPC creates the `bars` row and the owner's `bar_members` row (§1.4 gap b), and every RLS policy depends on that membership. A host who signs up sees an empty app with no way in. The import needs the same primitive.
- **H5 — Float → cents on a live ledger.** Every amount is `float64` (§1.2). `Math.round(x * 100)` is right for values entered as dollars and cents; it is wrong for any value that was computed (a cost estimate, a `$inc`'d quantity). The done-when is a per-player balance match to the cent, before and after, not a row count.
- **H6 — Timestamps and order.** `orders.created_at` and friends default to `now()`; `sessions.played_on` is a `date` (§1.4 gaps f, g). An import that lets defaults fire reorders every receipt and every session list. The import writes Mongo timestamps explicitly, and `played_on` either becomes a `timestamptz` or a second column keeps the time.
- **H7 — The PWA caches the old world.** `cacheOnFrontEndNav` and aggressive caching are on (§1.3), the workers in `web/public` are stale and tracked, and an installed PWA on the owner's phone will serve cached API responses from the Go origin after cutover until the service worker updates. The cutover phase must regenerate the workers and verify the update on a device — which no gate can see.
- **H8 — The test gate is a placeholder.** `bun run test` exits 1 on a clean tree with no config and no files (§1.1). The core-extraction phase is the first to write tests, so it also has to make `vitest` find them (a root `vitest.config.ts` or an `include`), or the gate stays red-by-default and proves nothing.
- **H9 — `packages/core`'s platform-free rule is not enforced.** `lib: ["DOM"]` in its tsconfig (§1.1) means `window` type-checks inside core. `openVenmo` moves there as a pure URL builder only by discipline; a lint rule or dropping `DOM` from `lib` would make it a gate.
- **H10 — Edge Functions are a new toolchain.** `supabase/functions/` is empty, there is no `config.toml`, and the claim flow and (later) account deletion need Deno functions deployed with the CLI. Whether `supabase functions deploy` needs Docker on this machine must be verified before a phase depends on it; the claim flow can also be a security-definer RPC with a token, which needs no function at all.
- **H11 — Realtime authorization is not the same as read authorization for the public pages.** See O4b. Any phase that adds Realtime must state which surfaces subscribe and which poll.
- **H12 — Working in one checkout with parallel sessions.** This folder is committable; `HANDOFF.md`/`PASSOFF.md` are not. A commit block that names `docs/incomplete/…` is correct; one that names the ledger is not (`HANDOFF.md`, Known facts).

---

## 6. Open questions — the GATE 1 batch

Asked in chat, in one message, the turn this document was finished (2026-09-16). Answers are recorded here with their date, and each becomes a `D<n>` in `DESIGN.md`.

**Re-sent 2026-09-16, in the Stage 3 session** (`PASSOFF.md` item 7), unanswered at that point. Three changes, all from verification done before re-asking rather than from a change of mind: **Q9** no longer asks how many sessions and players there are — that is now measured (§1.5). **Q11** no longer asks whether the deployment is live or where the Go API runs — both are now measured (§1.5); what is left of it is the auto-deploy question and the decommission plan. **Q13 is new**, and it is the kind the standard says to add rather than decide: the verification turned H1 from a deadline into a live exposure, which the scope did not anticipate.

| # | Question | Recommendation | What the answer changes |
|---|---|---|---|
| Q1 | Is `native/` (and everything App Store) in this folder or its own, later? | **Own folder, later.** | Whether phases 5–7 of the plan are planned here or parked; whether Apple/Google sign-in enters O3. |
| Q2 | Peer mode: keep the schema columns and build the optimizer as pure, tested core logic, but leave the peer-mode session UI out? | **Yes, that split.** | Whether the port includes a settle-mode picker and a peer settlement screen. |
| Q3 | Project topology (O1): two hosted projects, `dev` now and `prod` at cutover? And the owner creates them and hands over the refs (the MCP server is re-added read-only once a ref exists, per GATE 0). | **O1b.** | Where the import is rehearsed; how many env files. |
| Q4 | Amend `0001_init.sql` in place while it is unapplied (O2a), or stack `0002`? | **O2a.** | Whether the §1.4 gaps land in one file or two. |
| Q5 | Auth providers at web launch (O3): email + password only? | **O3a.** | Provider setup work; the Apple obligation. |
| Q6 | Where does the host's payment handle live — a column on `bars` (one handle per bar), or on the host's `players` row (the host is also a player)? | **Column(s) on `bars`** — `venmo_handle` now, room for `cashapp_handle`. | Schema amendment; which row the receipt reads. |
| Q7 | Live updates (O4): SWR first, Realtime as a later phase? | **O4a.** | Phase count; whether the public pages need a polling story in the port. |
| Q8 | Public pages (O7): every public read through a token RPC, accepting that old SMS'd links die at cutover? | **O7a.** | Whether an `anon` policy exists anywhere; whether old tokens are imported. |
| Q9 | Migrate the Mongo data (O5a), or start clean and re-enter inventory/drinks from the seed? *(The size question is answered: **20 players, 18 sessions, 35 orders** as of 2026-09-16, §1.5. What is left is whether the `/player-receipt` history matters to you.)* | **Migrate** — the balances are real debts, and at this size the import is an afternoon, not a project. | Whether the import phase exists; verification effort. |
| Q10 | Constraints the app assumes but the schema lacks: unique player name per bar, and one cashout per player per session — enforce both? | **Both, as unique indexes.** | Two lines in the schema; the import must not violate them. |
| Q11 | Cutover (O8): big-bang after the last Mongo session, Mongo kept readable, `backend/` deleted in the next commit? *(Both factual halves are now measured: `poker-bar.vercel.app` is live and `https://poker-bar.onrender.com` is the Go API, §1.5.)* What remains: **does a push to `main` redeploy the Vercel project automatically** — it is configured outside this repo and cannot be read from the checkout — and at cutover, who takes down the Render service and the Mongo Atlas cluster? | **O8a**, and treat the deploy as automatic until you say otherwise, because assuming a push is inert is the assumption that ships a half-ported app. | The cutover phase's done-when; whether every phase before cutover must keep `main` deployable; what gets decommissioned. |
| Q12 | The Venmo note (user-facing copy, R7). As of 2026-09-16 it is `'poker'` on two pages and the session name on the third (§1.3); `venmoUrl()` forces one choice. Plain: `Buy-In — <session name>` · Terse: `<session name>` · Warm: `Thanks for the game — <session name>`. | **Plain.** | One constant in core. |
| **Q13** *(new 2026-09-16)* | **The live API is readable by anyone right now** — 20 players with phone numbers, no credential, from any IP (§1.5, H1). Cutover is weeks of phases away. Do you want it (a) left as it is until cutover, accepting the exposure knowingly; (b) the Render service suspended now, which takes `poker-buy-in.vercel.app` down with it, since the web app has no other data source; or (c) a shared-secret header added to `backend/` and to `web/`'s fetches as a stopgap? | **(b) if you are not mid-season, (a) if you are** — never (c). A stopgap in `backend/` contradicts "`backend/` takes no new work" (`CLAUDE.md`), costs a day, and protects a surface that is being deleted; suspending a hobby app you are about to replace costs nothing but the app being down. This is yours to weigh because only you know whether a poker night is scheduled before cutover. | Whether the migration has a hard deadline; whether `backend/` gets one exception; whether the import can be rehearsed against a live Mongo or a dump. |

**Answers — 2026-09-16**, given by the owner in chat the turn they were re-sent, recorded the
same turn. Verbatim: *"all recommended, Q13 is (b), no poker night scheduled"*.

Every recommendation above was accepted as written, and Q13 was answered (b) — suspend the
Render service now — with the owner's reason, quoted: **"no poker night scheduled"**. No answer
departed from a recommendation, so no `D<n>` below carries an owner's counter-reason; every
defense is the one this document argued for, with §3's counter-argument answered rather than
dropped.

Two things the answers did not settle, recorded here so they are not mistaken for decided:
**Q11's auto-deploy half** — whether a push to `main` redeploys the Vercel project — was not
answered, and the ratified position is therefore the pessimistic one the recommendation named
(treat it as automatic; see D11). And **`/menu`**, which Q8 did not cover and which D8's answer
cannot cover: it is public, has no player and no token (`web/proxy.ts:11`,
`web/app/menu/page.tsx:7-8`). That became **D14**, written 2026-09-16 and flagged as an extension
beyond what was asked rather than folded silently into a decision the owner approved.

They become `D1`–`D14` in §7.

---

## 7. Decisions — `D1`–`D14`

Ratified 2026-09-16 from the owner's answers in §6. Each decision states itself flatly, then
defends itself by answering the strongest argument *against* it — lifted from §3, not invented
here — so that the argument does not come back in three weeks as a new objection. Where a
decision kills something written elsewhere, the supersession says which half dies.

Every answer accepted this document's recommendation, so no defense below is "the owner
overruled the analysis". Q13 is the one the owner decided on facts only they held, and their
reason is quoted in `D13`.

### D1 — `native/` and everything App Store is its own effort, opened later

**Decision.** This effort is web-only. Expo, NativeWind, EAS, Sign in with Apple, push
notifications, the account-deletion Edge Function and `pg_cron` reminders are out. `native/`
is not created as a side effect of any phase here (`CLAUDE.md`, Architecture).

**Defense.** The argument for folding native in is that `packages/core` exists *for* a second
platform, and extracting shared logic with only one consumer is speculative — §3 O6a makes
that case against itself: "if `native/` never arrives, the extraction bought nothing but
tests." Answered: the extraction is justified without native at all, because the ledger math
is the one piece of this app whose failure is silent (§5 H5), and tests plus the float→cents
conversion are worth the move on their own. Meanwhile a second platform would double the
surface of every phase *while the first platform's entire data layer is being replaced under
it*. The cheap thing is to make core good with one consumer and add the second later.

**Supersedes.** `docs/migration-plan.md` phases 5 and 7 and its §8 — **partially**: their
content is not cancelled, it is unscheduled. The App Store material survives as input to the
native folder when it opens; only its placement inside this migration dies.

*2026-09-16.*

### D2 — Peer mode: schema columns and pure optimizer in, peer UI out

**Decision.** `sessions.settle_mode` (`banked`|`peer`) and `payments.counterparty_player_id`
stay in the schema (`0001_init.sql:84-86,148-149`). The settlement optimizer is built in
`packages/core` as pure, tested logic. No settle-mode picker and no peer settlement screen are
built. Every session is `banked` until a later effort changes that.

**Defense.** The plan itself calls peer-mode UX "a real product change, not a refactor" (§10).
The argument against keeping unused columns is that they invite half-implementations and read
as a feature that exists. Answered: each column is one line in a migration that has never been
applied, and removing them later costs exactly what adding them later would; the optimizer is
pure arithmetic whose tests are cheap now and whose logic would otherwise be re-derived from
scratch. The line being held is a UI line — no screen reads `settle_mode`, so no user can
reach a half-built mode.

**Supersedes.** Nothing. Ratifies the parking in §2.

*2026-09-16.*

### D3 — Two hosted Supabase projects: `dev` now, `prod` at cutover

**Decision.** §3 O1b. The owner creates both and hands over the refs; no agent creates a
project. The Supabase MCP server is re-added **read-only** once a Buy-In ref exists, per
GATE 0 (`HANDOFF.md`, Settled, 2026-09-16), and not before. The import is rehearsed on `dev`
as often as needed and run once on `prod`. The migration files are the only artefact required
to match across them.

**Defense.** Against O1b: two key sets and two env files to keep straight, and free-tier
projects that idle get paused by Supabase. ~~The current pause policy is unverified as of
2026-09-16.~~ **Verified 2026-09-16** against Supabase's own documentation (`guides/platform/
free-project-pausing`, `guides/platform/billing-on-supabase`, `guides/deployment/going-into-prod`,
read live): Free Plan projects are **paused after 7 days of low activity**; paid plans are
exempt; and a Free organization allows **two projects**, with paused ones not counting toward
that limit. So O1b fits the free tier exactly — two projects is the allowance, not a stretch —
and a `dev` project left alone between sessions will pause and need resuming, which costs a
click and no data. Answered: the env duplication is a one-time cost already paid for by the
`.env.example` discipline in place since `HANDOFF.md` step 6, and a paused project costs a
resume, not data. What O1a costs instead is rehearsing "wipe, then reload" against the
database that becomes production — §3 names it as "exactly the step that goes wrong once", and
it goes wrong with real balances in it. O1c (local stack) needs Docker, absent on this machine
(§1.1), and installing it is the owner's call and a real cost.

**Binds.** No phase requiring a project ref may start before the owner supplies one.

**Superseded 2026-09-27 (`HANDOFF.md` step 28) — one project, not two.** At phase 9 the owner
chose to use `dev` (`rxvznjtpskendwhwwgin`) as production rather than create a second project:
"just use the current db as prod no need for dev and prod db". O1b's premise — that the import
be rehearsed away from the database that becomes production — is moot because that rehearsal's
load *is* the production data now (proved under `D9`'s 2026-09-27 amendment). Costs the owner
takes with it, stated so nobody rediscovers them: the Free plan pauses a project after 7 days
of low activity, and that now takes the live app down until it is resumed; `bun run dev` locally
reads and writes the real ledger; and `.mcp.json`'s Supabase server has write access to it.

**Raised by the same verification, and NOT decided here:** the Free Plan has **no downloadable
backups** (`guides/deployment/going-into-prod`, 2026-09-16). `prod` will hold a ledger of real
debts between real people, imported once from a Mongo database that `D11` keeps readable and
that the owner intends to decommission. Whether `prod` goes on a paid plan for backups, or runs
free with the Mongo cluster kept as the only fallback, is the owner's call and is **open** — it
is the one GATE 1 question nobody thought to ask. It does not block `PLAN.md`; it blocks the
phase that creates `prod`, and the phase that decommissions Atlas.

**Supersedes.** Nothing; it answers the question GATE 0 deliberately left open.

*2026-09-16.*

### D4 — Amend `0001_init.sql` in place while it is unapplied; freeze it at first apply

**Decision.** §3 O2a. The §1.4 gaps are folded into `0001_init.sql` rather than stacked as
`0002`. The amendment is a `PLAN.md` phase, not this document's work. **The ledger step that
first applies `0001` anywhere names the project ref and the file's hash, and from that step
the file is frozen** — every later change is a new number, read from the directory.

**Defense.** The invariant is that an *applied* migration is never edited (`HANDOFF.md`,
Invariants); this one is applied nowhere — verified 2026-09-16, `git ls-files supabase` returns
the single file and no Supabase project is configured (§1.1). Against O2a: the file is
committed on the branch, so a reader who trusts git history over the ledger may assume it ran;
and the day it *is* applied without the ledger being updated, in-place edits stop being edits
and become silent corruption. Answered by making the mitigation binding rather than advisory —
the naming-the-ref-and-hash step above is part of this decision, not a note attached to it. The
alternative's own cost is real: a `0002` that adds a column, two unique indexes and two
functions to a schema that has never run is ceremony that makes the initial schema harder to
read for the life of the project.

**Supersedes.** Nothing. It narrows `HANDOFF.md`'s invariant to its own exact words for this
one file, for exactly as long as it stays unapplied.

*2026-09-16.*

### D5 — Email and password only at web launch

**Decision.** §3 O3a. Supabase Auth with email + password replaces NextAuth
(`web/lib/auth.ts`, `web/proxy.ts`, the login page, the `SessionProvider`). No Google, no
Apple, no other third-party provider ships with the web port. The dead auth path
(`web/lib/api.ts`, `web/components/auth/unified-auth.tsx`, `web/types/auth.ts`,
`web/models/user.ts`) is deleted rather than ported (§1.2).

**Defense.** Against O3a: the plan promises Google and Apple, and adding a provider later
touches the login screen a second time. Answered: touching one screen twice is a cheap cost,
paid later, by choice. Offering a third-party login on the web is what later obliges Sign in
with Apple on iOS (plan §8, guideline 4.8) — so O3b takes on an App Store obligation *before
`native/` exists at all* (D1). That is a debt with no asset against it, and it is incurred to
save one screen edit.

**Supersedes.** `docs/migration-plan.md`'s provider list — **partially**: Google and Apple die
for the web launch only. Both are live questions again when the native folder opens, which is
where Apple's rule actually applies.

*2026-09-16.*

**As built — 2026-09-25, `PLAN.md` phase 4 (`HANDOFF.md` step 16).** Implemented as decided; no
provider besides email and password exists — `grep -rn
"signInWithOAuth\|signInWithIdToken\|signInWithSSO\|signInWithOtp" web --include='*.ts' --include='*.tsx'
--exclude-dir=node_modules` → exit 1, and the one sign-in call is `signInWithPassword` at
`web/app/login/page.tsx:22`. The choices this decision left open, each with its reversal:
- **No sign-up screen.** `D5` names what dies and replaces it; NextAuth had no sign-up either, and
  §8.2 forbids new screens. A host's user is created in the Supabase dashboard with the email
  auto-confirmed (`dev` requires confirmation — `HANDOFF.md` step 15). *Reversal:* a sign-up page
  calling `signUp` then `create_bar()` (`BD-1`) — a new screen, so an owner decision.
- **Sign-out lands on `/` and ends only this device's session** (`scope: 'local'`), because both
  NextAuth sign-outs went to `/` and cleared only this browser's cookie (`web/app/page.tsx:56`,
  `web/components/shared/button/signout.tsx:7` at `05b4718`). *Reversal:* the path and the scope
  are two literals in `web/lib/supabase/sign-out.ts`.
- ~~**The login field reads "Email" where it read "Name" — the only copy change**, and the one
  this decision forces; the error copy "Invalid credentials." is unchanged, so an unconfirmed
  email also shows it.~~ **Corrected 2026-09-25 (audit of `HANDOFF.md` step 16): not the only
  one.** Supabase email/password users carry no display name or picture, unlike NextAuth's
  hardcoded `name: 'Zach'` (`web/lib/auth.ts:14` at `05b4718`), so the profile card in
  `web/components/shared/layout/menu-content.tsx:22-43` now shows the static label "User" and a
  "U" avatar fallback in place of "Zach"/"ZA", with the signed-in user's real email underneath as
  a subtitle (`{user?.email}`, `:37`). This is a consequence of `D5`, not a bug, but it is a
  user-facing copy choice R7 says not to pick silently — **decided by the owner, 2026-09-25: keep
  "User" + the real email as a subtitle**, as built; no code change needed. *Reversal:*
  `menu-content.tsx:36` is one string; the avatar fallback is one more.
- **`SessionProvider` is replaced by a hook, not a provider** — `web/hooks/use-auth-user.ts`,
  one `onAuthStateChange` listener; for what the UI shows only, since `web/proxy.ts` is the gate.
- **`@supabase/ssr` 0.12.7 and `@supabase/supabase-js` 2.117.2 are pinned exactly** in
  `web/package.json`, unlike the file's caret ranges — the Supabase skill's supply-chain rule for
  auth packages. *Reversal:* caret them; `bun.lock` pins either way.

### D6 — The host's payment handle is a column on `bars`

**Decision.** `bars` gains `venmo_handle`, with room for `cashapp_handle` alongside it.
Receipts read the bar's handle. `NEXT_PUBLIC_VENMO_HANDLE` is deleted at cutover.

**Defense.** The alternative was the host's own `players` row, since the host is also a player.
Against the `bars` column: it assumes one payee per bar, so two co-hosts collecting separately
would need a rethink. Answered: `bar_members` already models co-hosts, this migration creates
exactly one bar with one owner (§2), and multi-host UI is explicitly parked — so the rethink is
a feature's problem, not this schema's. The deciding argument is what the handle *is*: a
property of how the venue settles, not of a person's player identity. A host who stops playing
still gets paid, and on the `players` row their handle would vanish with their seat.

**Resolves** §1.4 gap (a). **Supersedes** the environment-variable recipient at
`player-receipt/…/page.tsx:11,86` and `receipt-ui.tsx:55-57` — those reads die at cutover.

*2026-09-16.*

### D7 — SWR against Supabase first; Realtime is its own phase, after cutover

**Decision.** §3 O4a. The port rewires `useSWR` keys to Supabase queries and RPCs and changes
nothing about the push model. The session screen keeps its 15 s poll as a config dial (§4).
Realtime is a separate phase, planned after cutover.

**Defense.** Against O4a: the same 15 files get touched twice, and "later" phases are the ones
that get cut. Answered on both halves. On the second touch — the cutover phase then changes one
variable, the data source, instead of two; when it goes wrong, which it can, there is one
suspect. On "later phases get cut" — if this one is cut, the app still behaves exactly as it
does on 2026-09-16 (`session/[id]/page.tsx:39`), so the cut costs nothing that shipped.
O4b's promise of a single pass is also not real: the anonymous share pages cannot subscribe
through RLS at all — `anon` has no row access and `get_shared_tab` is a security-definer read —
so they need polling or broadcast regardless, and O4b would ship two live models inside one
phase.

**Supersedes.** `docs/migration-plan.md` §4's placement of Realtime inside the port —
**partially**: the table list survives as the dial in §4; only the timing dies.

*2026-09-16.*

### D8 — Every player-scoped public read goes through a token RPC; old links die at cutover

**Decision.** §3 O7a. `/receipt/[sessionId]/[playerId]`, `/portal/*` and `/player-receipt/*`
read through `security definer` RPCs that take a `player_share_links` token. **No permissive
`anon` SELECT policy is added anywhere**, on any table. Share links already sent by SMS stop
working at cutover; the host re-sends them.

**Defense.** This is not a choice between working links and broken links — under `0001`'s RLS
`anon` reads nothing, so `/receipt/[sessionId]/[playerId]`, which needs no token at all as
written (`receipt/…/page.tsx:13-18`, `receipt-ui.tsx:14-17`), breaks on day one under every
option. Against O7a: every link already sent dies, and O7c would preserve them. Answered: O7b
buys link survival with a permissive `anon` policy, which defeats the tenancy model this whole
migration exists to build — and does it in the way that is hardest to catch, since it passes
every gate and looks like one line of SQL. O7c preserves links by computing every player's
old token with the `dev-portal-secret` fallback and carrying it in as a live credential: it
would import the exact break `D13` is being taken to end. The real cost of O7a is bounded and
known — 20 players and one host (§1.5), who re-sends links once.

**Binds.** Any later phase tempted to "just add an `anon` policy" is contradicting a ratified
decision and must come back to the owner (R12), not take the call.

**Does not cover `/menu`** — see `D14`. **Amended 2026-09-16 by `D15` and `D16`**, which do
not change this decision but make it implementable: as written, `0001`'s one token RPC returns
more than a share link should and grants more than a member should have.

**Supersedes.** The HMAC portal-token scheme at `backend/handlers/portal.go:19-27` entirely,
including its `dev-portal-secret` fallback.

*2026-09-16.*

### D9 — A one-shot, idempotent TypeScript import, run by the owner

**Decision.** §3 O5a. A bun script under `scripts/`, outside `backend/`, reading Mongo with the
`mongodb` driver and writing Postgres through supabase-js with the service-role key. Three
conditions are ratified with it: it is **idempotent** so it can be rehearsed on `dev` repeatedly;
it takes the owner's `auth.users` id as an **argument**, because the bar needs an owner before any
row can be inserted (§1.4 gap b); and verification is a **per-player balance match to the cent**
— tolerance 0 (§4) — not a row count (§5 H5).

**Amended 2026-09-25 (`HANDOFF.md` step 21): "truncate the bar's rows, reload" describes only
one of the mechanism's three paths, not idempotency itself.** A round-2 audit found the original
"always truncate and reload" implementation let a stray re-run silently revert app-made deletes,
edits and claims, wipe share/claim links unchecked, and overwrite the bar's name/Venmo handle —
none of that was a truncate-and-reload problem, it was that clearing ran unconditionally. The
built script now distinguishes three cases: an unmodified re-run **writes nothing at all**
("`load: skipped`"); a fresh/empty bar **loads with no prior clear**; and only an explicit
`--force` reaches a clear-and-reload, scoped to the bar's own rows. **The ratified property is
unchanged** — two runs give identical results — the mechanism that delivers it is not the
parenthetical's literal description anymore. `scripts/import-mongo/{drift,load}.ts`.

**Defense.** Against O5a: both databases' credentials on one machine, and a service-role key in
a script's environment. Answered: once, on the owner's own machine, never committed — and the
alternative is not safer. O5b's `mongoexport` dump contains phone numbers and Venmo handles and
has to be kept out of git by hand, which trades a short-lived key for a durable file of
personal data. O5c lives in `backend/`, which takes no new work (`CLAUDE.md`).

**Consequence of `D13`, recorded because it binds the import phase.** With the Render service
suspended, the import cannot read through the Go API — it reads Mongo Atlas directly with
`DATABASE_URL`. The row counts in §1.5 were taken through the API on 2026-09-16 and are the
last numbers observed before it goes down; the import verifies against Mongo itself, not
against them.

**Resolves** nothing in §1.4 by itself; it *depends on* gap (b) being resolved first.

*2026-09-16.*

**Amended 2026-09-27 (`HANDOFF.md` step 28): the import does not run again at cutover.** One
real night was recorded on `dev` after the phase 8 rehearsal (session `a52bc345-…`, `HANDOFF.md`
step 24), so it is in no Mongo. Asked at phase 9: (a) promote `dev`'s data, (b) import into a
fresh `prod` and re-enter the night, (c) import and script-copy the night. The owner first chose
(c), then the same day replaced the question with `D3`'s supersession — `dev` *is* `prod` —
which is (a) without a copy. So the rows the phase 8 rehearsal loaded are the production rows.
Proved the same day, read-only (service role on Supabase, a read of Mongo, no links minted):
of Mongo's 20 players, **16 balances equal Mongo's to the cent and 4 differ only by rows created
on or after 2026-09-26** — the night and the closed test session `8978ec24…`, which nets 0 per
player — with **0 unexplained**; the 21st Supabase player is the night's new player. Mongo has
taken no writes since Render went down (`D13`, `HANDOFF.md` step 14, 2026-09-24), before the
rehearsal. `scripts/import-mongo/` stays as the tool that produced these rows; nothing reruns it.

### D10 — Unique indexes on `players (bar_id, name)` and `cashouts (session_id, player_id)`

**Decision.** Both, as unique indexes in `0001_init.sql` (per D4, amended in place).

**Defense.** Both are already assumed by code that has no way to enforce them: player-name
uniqueness by a lookup-before-insert in Go (`players.go:56-61`), one-cashout-per-player by
`find` and `some` guards throughout the UI (`session/[id]/page.tsx:106,218`,
`summary/page.tsx:80`, `receipt-ui.tsx:47`). Against: the live data may already violate one,
and the import would then fail. Answered: that is the constraint doing its job. A duplicate
player name or a double cashout in the existing data is a finding the owner needs to see and
resolve, not something an import should silently carry into a schema whose UI assumes it cannot
happen. The import phase's done-when includes both indexes holding on real data.

**Resolves** §1.4 gap (c).

*2026-09-16.*

### D11 — Big-bang cutover; and until proven otherwise, a push to `main` deploys

**Decision.** §3 O8a. The import runs after the last Mongo session; the ported web is deployed
pointed at `prod`; Mongo is kept readable; `backend/` is deleted in the commit *after* cutover,
not before. Rollback is redeploying the previous commit and re-pointing the env.

**Until the owner verifies otherwise, assume a push to `main` redeploys
`poker-buy-in.vercel.app`.** Therefore `main` stays deployable through every phase, and unfinished
port work stays on `supabase-monorepo` and merges at cutover.

**Defense.** Against O8b (dual-read behind a flag): two data sources under one UI, for a
single-tenant app with one host and 20 players, is more machinery than the risk warrants, and
the machinery itself becomes the thing most likely to be wrong. The auto-deploy half is
deliberately pessimistic and deliberately unverified (§1.5): assuming a push is inert is the
assumption that ships a half-ported app to a live URL, and the cost of being wrong in the
pessimistic direction is only branch discipline.

**Supersedes.** `HANDOFF.md`'s "Merged is not shipped" — **partially**. It stays true of this
repo, which has no CI and no deploy config; it may already be false of `main`, because Vercel's
git integration is configured outside the repo and cannot be read from the checkout. Until the
owner answers, the pessimistic half binds.

**Owner's action at cutover**, recorded not done: suspend or delete the Render service and the
Mongo Atlas cluster.

**Amended 2026-09-16 by `D17`** — the "Mongo is kept readable" clause is superseded; the rest of
this decision stands.

*2026-09-16.*

**Answered 2026-09-27 (`HANDOFF.md` step 28): a push to `main` deploys.** The owner confirmed
that the Vercel project is git-linked with `main` as its production branch. The pessimistic half
is now simply the fact, and merging `supabase-monorepo` is the deploy. Not independently
verified: the Vercel connector in these sessions sees only the `ezh` team, which does not hold
this project. The URLs on 2026-09-27: `poker-buy-in.vercel.app` 200, `www.buy-in.win` 200,
and `buy-in.win` 308. The owner renamed the project, and the domain was added, in `HANDOFF.md`
step 15. `poker-bar.vercel.app`, the name the phase 9 pass-off used, returns 404, which is
expected after the rename.

### D12 — The Venmo note is `Buy-In — <session name>`

**Decision.** One constant in `packages/core`, used by the single `venmoUrl()` builder. Register:
plain (R7 variants offered, plain chosen).

**Defense.** Against: the note is `'poker'` on two of the three current call sites
(`bar-api.ts:111-118`, `player-receipt/…/page.tsx:85-102`) and someone may prefer it short.
Answered: this string's only reader is a human scrolling a Venmo history weeks later, where
`poker` is ambiguous across every poker night ever played and `Buy-In — Friday Night` is
not. Length costs nothing in a payment note.

**Supersedes.** All three current variants, including the third at `receipt-ui.tsx:54-72` which
uses the session name alone.

*2026-09-16.*

**Partially superseded 2026-09-27 by `D20`.** The fixed constant is dead: the host sets the note.
Two parts stand. With no template set, a night's receipt still reads `Buy-In — <session name>`,
and the single `venmoUrls()` builder in `packages/core` is unchanged.

### D13 — Suspend the Render service now

**Decision.** The owner suspends `https://poker-bar.onrender.com` now, before any migration
phase begins. `poker-buy-in.vercel.app` goes down with it — the web app has no other data source —
and that is accepted. **No stopgap is added to `backend/`.** The app returns at cutover, on
Supabase.

**Defense — the owner's reason, quoted: "no poker night scheduled."** That is the whole case
for (b) over (a): the only cost of suspending is the app being unavailable, and nobody needs it
before cutover. Against (a), leaving it: it exposes 20 players' names and phone numbers to any
IP on the internet, unauthenticated, for the multi-week duration of this migration (§1.5), and
the same open group lets any caller mint any player's portal token (`routes.go:29`) against a
secret that falls back to the literal `dev-portal-secret` (§1.2) — two independent breaks of
one surface. Against (c), a shared-secret stopgap: it costs a day, it hardens a surface that is
being deleted, and it requires new work in `backend/`, which `CLAUDE.md` forbids — the rule
exists precisely so that a doomed subsystem does not quietly acquire a maintainer.

**Binds.** `D9` — the import reads Atlas directly, since the API is down. `H1` — cutover is no
longer racing an open door, so phase order may be chosen for correctness rather than speed.

**Owner's action, which no agent can take** — suspending a Render service is outside this repo.
Until it is done, §1.5's "the live API is open to the internet" row is current, not historical;
the ledger step recording the suspension is what makes it historical.

*2026-09-16.*

### D14 — The public menu gets a bar-scoped definer RPC, not an `anon` policy

**Decision.** `/menu` is public (`web/proxy.ts:11`), has no player and no token, and as of
2026-09-16 fetches every drink and every inventory row to filter client-side with `canMake`
(`web/app/menu/page.tsx:7-8`). It reads through a `security definer` RPC taking a `bar_id`,
returning only what the menu renders. `D8`'s rule holds — **no `anon` SELECT policy is added.**

**Defense.** `D8` as the owner ratified it covers player-scoped surfaces, because that is what
Q8 asked about; a menu has no player and no share link, so following `D8` literally would leave
`/menu` with no read path at all and following its *spirit* is the only way to cover it. The
argument against a definer RPC here is that a `bar_id` is guessable, so this is public data with
extra steps. Answered: that is exactly why the RPC must return the menu and nothing else — a
drinks list with a server-computed availability flag rather than raw `inventory_items` rows, so
that guessing a `bar_id` yields a menu, which is a thing bars put on the wall, and never stock
levels, which are a business's internal numbers.

**Flagged, because it goes beyond what was asked.** Q8 did not cover `/menu` and the owner has
not ruled on it. It is written as a decision rather than an open question because leaving it
open would leave a public route with no design at all, and the shape follows directly from
`D8`. **Whether the RPC returns an `available` boolean or the raw inventory rows is the one
piece still open**, deferred to `PLAN.md` as a build-level call (§9, gap h).

*2026-09-16.*

---

## 8. Rules that survive unchanged

This section exists so that a build phase does not helpfully improve something the port was
meant to leave alone. Nothing here is a new decision; each line is an existing rule or an
existing behaviour, with the citation for what it is as of 2026-09-16. **A phase that wants to change one
of these is contradicting this document and goes back to the owner (R12), not to its own
judgment.**

### 8.1 Repo invariants (`HANDOFF.md`, Invariants — unchanged by GATE 1)

1. **`packages/core` stays platform-free.** No `next`, no `react-native`, no `window`, no
   `document` (`packages/core/src/index.ts:1-4`). A `SupabaseClient` is passed in, never
   imported. Note the enforcement gap this document found and did not close: `lib: ["DOM"]` in
   `packages/core/tsconfig.json:6` means `window` type-checks inside core, so the rule is
   review-enforced, not gate-enforced (§5 H9). Closing it is a `PLAN.md` item; weakening the
   rule because it is unenforced is not.
2. **Money is integer cents, everywhere.** `0001_init.sql:5-6` states it and states why: the Go
   models used `float64` (`backend/models/barModels.go:22-24,35-36,52,60,66,79-80`), which for
   a ledger settling real debts produces balances that never reconcile. No float is
   reintroduced, in core, in the schema, or in a component.
3. **Migration numbers are taken by reading `supabase/migrations/`**, never from a number
   written in any document, including this one.
4. **An applied migration is never edited** — the next number is. `D4` narrows this for
   `0001_init.sql` *only while it remains unapplied*, and ends that narrowing at the ledger
   step that first applies it.

### 8.2 Screen behaviour the port keeps exactly as it is

Every item below is behaviour verified 2026-09-16 in §1. The port changes where the
data comes from; it does not change what the user sees or how the app behaves.

- **No screen is redesigned.** No new layout, no copy rewrite, no design tokens, no component
  library change (§2, "This is not"). The one copy change in this whole effort is the Venmo
  note (`D12`), which was asked and answered at GATE 1.
- **The 105 lint findings are not fixed here** (`HANDOFF.md` step 5). They are the owner's call,
  separately.
- **The balance convention is preserved exactly**: drinks + buy-ins − cashouts − received +
  sent, where **positive means the player owes the house** (`bar-api.ts:134-139`). Ported into
  integer cents, "settled" stops being the float epsilon `Math.abs(balance) < 0.01` and becomes
  `=== 0` — the same rule stated exactly, not a new one.
- **The two settlement mechanisms stay distinct.** `orders.paid` is a display flag;
  `computeBalance` reads `payments` and ignores it (`orders.go:163-195`,
  `ledger.go:214-252`, `bar-api.ts:127-140`). The port does not unify, reconcile or "fix" them.
- **Session membership semantics stay**: `Session.playerIds[]` drives `includes` and the default
  selected player (`playerIds[0]`), while display order comes from the players list sorted by
  name (`session/[id]/page.tsx:80-85,166-173`, `players.go:21`).
  **Amended 2026-09-25 (phase 5, `HANDOFF.md` step 18): neither half survives as stated, and
  the change is larger than first recorded here (corrected by the phase 5 audit, R5).**
  `session_players` (`0001_init.sql:166-173`) has no column that can encode insertion order —
  `bar_id`, `session_id`, `player_id` only, primary key `(session_id, player_id)` — and Postgres
  does not guarantee row order absent one. **The display-order half is also affected, not just
  the default-player half**: the `/sessions` card list (`sessions/page.tsx`, pre-port) listed
  session names in `Session.playerIds[]`'s tap order too, via `sessions.go:21` returning it
  as-is — this file's line 707 was wrong to call it "already name-sorted" everywhere; that was
  true of the session screen's own player list (`session/[id]/page.tsx:80-85`), not of
  `/sessions`' cards. Asked of the owner and answered 2026-09-25 — the same question named both
  surfaces explicitly: the default selected player, and the name order on session cards, both
  become name-order[0]/name-sorted, replacing tap order everywhere it was load-bearing. The
  alternative (a `0002` migration adding a position column, to reproduce tap order exactly) was
  offered and declined. This also settles the same question for drink-recipe ingredient order
  (`phase 5's builder report`) and for phase 8's import, which faces an identical loss of Mongo
  array order.
- **The session screen keeps a 15 s refresh** (`session/[id]/page.tsx:39`), as a dial (`D7`).
- **The same routes stay public**: `/`, `/login`, `/menu`, `/receipt/*`, `/portal/*`,
  `/player-receipt/*` (`web/proxy.ts:8-14`). `D8` and `D14` change *how* they read, never *which*
  are reachable without a login.
  **Amended 2026-09-27 (phase 7; owner answers, `HANDOFF.md` step 25).** The prefixes stay
  public, but the paths inside them change. `/menu/[barId]` is per-bar, and the three token
  routes carry only the token (`PLAN.md` `BD-10`). The logged-out landing loses its Menu button,
  because it had no bar to point at. Two further behaviour changes are recorded here. The
  receipt's Venmo button shows only when the player owes; the Go-era button sent a negative
  amount to Venmo's pay screen. Menu prices render as `formatCents`, `1.00` where the Go page
  printed the bare float `1`.
- **The UI's one-cashout and unique-name guards stay** where they are; `D10` adds enforcement
  underneath them rather than removing them.
- **PWA configuration stays as it is** — `cacheOnFrontEndNav` and `aggressiveFrontEndNavCaching`
  on, disabled in development (`web/next.config.ts:4-13`). §5 H7 makes the cutover phase
  regenerate the workers and verify the update on a device; it does not license changing the
  caching policy.

### 8.3 Process rules this effort runs under

- **`backend/` is never edited** — it is deleted, not fixed (`CLAUDE.md`, Directory map). `D13`
  turned down a stopgap for exactly this reason.
- **No Supabase write tool is called from this repo** until the owner names a Buy-In ref, and
  the server returns **read-only** when it returns (`HANDOFF.md`, Settled, GATE 0; `CLAUDE.md`,
  Never do this).
- **`docs/incomplete/` is committable; `HANDOFF.md` and `PASSOFF.md` are not.** No commit block
  from this effort ever names either (§5 H12; `HANDOFF.md`, Known facts).
- **`native/` is not created as a side effect** of any phase (`D1`; `CLAUDE.md`, Architecture).

---

## 9. The §1.4 schema gaps, each accounted for

None is left implicit. (a), (c) and the share-link half of (e)'s context are decided above; the
rest are named here as build-level calls for `PLAN.md`, each with what constrains them, so that
a plan phase decides them deliberately rather than a build phase discovering them.

| Gap (§1.4) | Status |
|---|---|
| **(a)** No host payment handle on `bars` | **Resolved by `D6`** — `bars.venmo_handle`, room for `cashapp_handle`. |
| **(b)** No path for a new user to create a bar and their own membership | **For `PLAN.md`** — and it is the most load-bearing of these, because every RLS policy depends on the membership row and a host who signs up without one sees an empty app with no way in (§5 H4). Constraint: **the sign-up path and the import (`D9`) must use the same primitive**, so there is one way a bar comes into existence. The choice is a trigger on `auth.users` versus a `create_bar()` RPC called by the client; decide it as a `BD-n` with a stated reversal. |
| **(c)** No uniqueness on `players (bar_id, name)` or `cashouts (session_id, player_id)` | **Resolved by `D10`** — both, as unique indexes. |
| **(d)** `create_order` never checks `p_player_id` is in the session | **For `PLAN.md`.** Note what it is and is not: `create_order()` is `security invoker` (`0001_init.sql:235-296`), so RLS already stops a member of one bar reaching another bar's session — this is a data-integrity gap, not a tenancy hole. It lets a host record an order against a player who is not in that session. Add the check inside the function under `D4`. |
| **(e)** No claim function for `players.user_id` (guest → account) | **For `PLAN.md`.** Constraints: claim-link expiry is 7 days (§4), and §5 H10 applies — this can be a `security definer` RPC taking a token, which needs no Edge Function and therefore no new toolchain. Whether `supabase functions deploy` needs Docker on this machine (absent, §1.1) must be verified *before* any phase depends on a function. |
| **(f)** `sessions.played_on` is a `date`; Mongo `Session.Date` is a timestamp used for sort order | **For `PLAN.md`** (§5 H6). Constraint: same-day sessions must keep their order after import. Either `played_on` becomes `timestamptz` or a second column carries the time; decide under `D4`, in the amendment. |
| **(g)** `created_at` defaults would rewrite the order of every imported row | **For `PLAN.md`** (§5 H6). Constraint: the import writes Mongo timestamps explicitly into `orders`, `buy_ins`, `cashouts` and `payments`; letting a default fire is a silent reordering of every receipt. `D9`'s verification covers balances to the cent — this needs its own check, that the first and last order of a sampled session keep their order. |
| **(h)** *(new, 2026-09-16)* The public menu RPC's return shape | **For `PLAN.md`**, out of `D14`. Recommended: drinks plus a server-computed `available` boolean, never raw `inventory_items` rows. Decide as a `BD-n`. |

### 9.1 Further obligations, from the 2026-09-16 RLS review (§10)

Everything here is an edit to `0001_init.sql` **before its first apply**, under `D4` — not a
`0002`. Ranked. Items 1–2 are `D15` and `D16` and are decided; the rest are `PLAN.md` work with
the constraint stated. *(unverified)* marks a claim carried from the review that this session
did not re-check — verify it before building on it (R3).

| # | Obligation | Constraint |
|---|---|---|
| 1 | Rewrite `get_shared_tab`'s scope and projection | **`D15`.** Also assert `v_player.bar_id = v_link.bar_id` after the player lookup (`0001_init.sql:338`), so a mis-scoped link cannot read across bars. |
| 2 | Split the write policies behind `is_bar_staff` | **`D16`.** |
| 3 | Add `get_menu(p_bar_id uuid)` | `D14` + gap (h). Returns `[{id, name, price_cents, available}]`, `available` computed as `not exists (… ii.qty_on_hand < di.qty_used)`, which matches `canMake`'s semantics including the empty-recipe case (`web/lib/bar-api.ts:106-109`). An unknown `bar_id` returns `[]`, so there is no existence oracle. The portal's menu block calls the same RPC. |
| 4 | Explicit `revoke`/`grant` on every function | Only `get_shared_tab` has them (`:354-355`, verified). The other three inherit a platform default that Supabase is reportedly changing *(unverified)* — under the new default `authenticated` could not call `create_order` at all and the host's app would break, and under the old one `anon` can call all three. Pin them explicitly and revoke default execute in `public`, so nothing added later is public by accident. |
| 5 | Composite foreign keys | `orders` carries `bar_id`, `session_id`, `player_id` as three independent FKs (`:101-105`, verified), so the column every policy filters on is one the writer chooses. Add `unique (id, bar_id)` on the parents and composite `(fk, bar_id)` FKs on the children. For one bar this is theoretical; the file calls itself multi-tenant at `:3`, and it is an ALTER-plus-backfill once rows exist. |
| 6 | `create_order` gains its missing checks | Gap (d), plus: reject a session whose `status <> 'active'` (`:83`, never checked) and a player absent from `session_players` (`:92-96`, never consulted). |
| 7 | Route and page cleanup in `web/` | Drop the `[playerId]` segment from `/portal` and `/player-receipt` — under `D8` the token determines the player, and a URL segment the page still trusts is an invitation to trust it over the RPC *(unverified: the review cites `portal/…/page.tsx:51` and `player-receipt/…/page.tsx:60` passing the URL param into `computeBalance`)*. Delete the unauthenticated mint call at `receipt-ui.tsx:14-17` (verified). Decide whether `receipt/…/opengraph-image.tsx` survives: it takes the same params, so under `D8` it needs the token server-side — and link-preview bots cache the rendered image, so **revoking a link does not un-cache a receipt already previewed** *(unverified)*. |
| 8 | Housekeeping | A default `expires_at` on share links, since `:167` is nullable and the dial says 30 days (§4). Call RPCs by POST, not `{ get: true }`, so tokens stay out of query strings and logs. Never set `replica identity full` on the published tables — RLS reportedly does not apply to Realtime DELETE events *(unverified)*, so subscribers can see deleted-row keys. Any future `security definer` function that mints a token must schema-qualify `extensions.gen_random_bytes` *(unverified: depends where `create extension pgcrypto` lands, `:8`)*. |

**One onboarding trap this review surfaced, folded into gap (b) rather than given its own row:**
`bars_owner_write` (`:200-201`) lets an authenticated user create a bar owning it, but
`is_bar_member` reads only `bar_members` (`:181`) — so an owner without their own `bar_members`
row reads nothing in the bar they just created, and nothing in `0001` creates that row. Whatever
primitive gap (b) settles on must create the pair atomically. Note also that
`bar_members.role = 'owner'` and `bars.owner_id` are two different notions of owner; `D16` makes
the first one load-bearing, so the plan should say which governs.


---

## 10. Amendments — 2026-09-16, from the D8 RLS review and GATE 2

`PASSOFF.md` item 7 required a narrow Fable 5.1 review in its own worktree of any ratified
answer touching RLS. `D8` does, so one ran on 2026-09-16 against `0001_init.sql` at `d814583`.
It changed nothing on disk (its worktree auto-cleaned as unmodified). **It overturned none of
`D1`–`D14`** — the shape it was asked about, no `anon` policies and every public read behind a
token RPC, it confirmed as right. What it found is that the *schema* does not yet implement that
shape, and two of the gaps are design decisions rather than build details. Those are `D15` and
`D16`. The rest are build obligations, added to §9.

**What was verified in this session, by reading `0001_init.sql` directly, rather than taken on
the reviewer's word:** `get_shared_tab`'s body and its lack of any session filter (`:337-351`);
that it returns whole rows via `to_jsonb` and the player's own `venmo` (`:341-349`); that only
`get_shared_tab` carries a `revoke`/`grant` pair (`:354-355`, and `grep -n "grant\|revoke"`
returns no other executable line); that every bar-scoped policy is `for all using
(is_bar_member(bar_id))` (`:209-217`); that `role` appears exactly once in the file, its own
check constraint (`:22`), and is read by nothing; that `orders` carries `bar_id`, `session_id`
and `player_id` as three independent foreign keys (`:101-105`); and that
`receipt-ui.tsx:14-17` mints a portal token unauthenticated. Claims **not** re-verified here and
carried as the reviewer's, to be checked at `PLAN.md` time, are marked *(unverified)* in §9.

### D15 — A share link is scoped to what it was sent for, and returns only what the page renders

**Decision.** Before `0001` is applied anywhere, `player_share_links` gains a nullable
`session_id` — null meaning portal scope (the player's whole history), non-null meaning one
night's receipt — and `get_shared_tab` filters every ledger sub-select by it.
The function stops returning rows and starts returning named columns: no `cost_estimate_cents`,
no `ingredients`, no `counterparty_player_id`, no `note`, no internal foreign keys, **and not
the player's own `venmo`**. It gains what the pages actually need and `0001` does not return:
a `sessions` array and the bar's `{id, name}`.

**Defense.** `D8` is the decision that no anonymous caller reads anything except through a
token; `D15` is what makes that true rather than nominal. As written, one texted receipt link is
a master key: every sub-select filters on `player_id` alone (`0001_init.sql:343-349`), so the
link sent for one night returns every order, buy-in, cashout and payment the player has ever
had — and the receipt is the artifact designed to be forwarded. The column breadth is the same
error in miniature: `to_jsonb(o)` hands an anonymous reader the bar's per-drink margin
(`cost_estimate_cents`, `:109`) and its recipes (`ingredients`, `:113`), neither of which any
page renders. The argument against scoping is that it means two link kinds and a host UI that
mints the right one — answered: that is one nullable column and a `case` in a `where` clause,
and the alternative is a design where revoking a receipt cannot be done without revoking the
player's portal. The missing `sessions` array is not a refinement but a bug: `/player-receipt`
groups its display by session, so under `0001` as written every player sees "No history yet".

**Supersedes.** `0001_init.sql:163-171` and `:325-355` — amended in place under `D4`, which is
still available because the file remains applied nowhere.

*2026-09-16.*

### D16 — Membership is not authority: write policies check a staff role

**Decision.** Before `0001` is applied anywhere, each bar-scoped `for all` policy splits into a
`for select` predicate — `is_bar_member(bar_id)`, unchanged — and separate
`insert`/`update`/`delete` predicates gated on a new `is_bar_staff(bar_id)` definer function
checking `bar_members.role in ('owner','host')`. `bar_members.role` becomes a column the
database reads.

**Defense.** `role` is check-constrained to `owner|host|player` (`0001_init.sql:22`) and read by
nothing — verified this session, one occurrence in the file. Meanwhile every bar-scoped table is
`for all using (is_bar_member(bar_id))` (`:209-217`), including `player_share_links` (`:217`).
Put those together with the architecture that was settled before this document existed — players
are guest rows that later claim an account (`HANDOFF.md`, Settled, 2026-09-16; `players.user_id`
and its comment at `0001_init.sql:28-33`) — and the claim flow, when it is built, hands an
ordinary player every other player's phone number and Venmo handle (`:35-37`), write access to
every order and inventory row, and the ability to **mint and revoke share links for every player
in the bar** — which, with `get_shared_tab`, is every player's whole ledger.

The reviewer offered a second way out: delete `role` and `players.user_id` and declare that
players never become members. **That option is not available to this document.** It contradicts
a decision settled before GATE 1 and carried into §2 as scope, and a settled decision changes
only by a dated supersession the owner makes (R8) — not by a schema convenience. So the
direction here is forced, and writing it down is implementing the settled decision, not taking a
new one. What remains genuinely open is only the shape of the split, which is a `PLAN.md`
`BD-n`.

**The owner should still push back if this is wrong**, because it is the one amendment that
adds a concept — a staff role the database enforces — rather than closing a hole in one that
already exists.

**Supersedes.** `0001_init.sql:209-217`, amended in place under `D4`.

*2026-09-16.*

### D17 — `prod` runs free; Mongo is dumped, then decommissioned at cutover

**Decision.** Taken at GATE 2, 2026-09-16. `prod` runs on the Supabase Free plan, which has **no
downloadable backups**, and the Mongo Atlas cluster is **decommissioned at cutover** rather than
kept running. Before it is, the owner takes a `mongodump` and keeps it off-repo — and takes it
**immediately after the last session played on Mongo and before the import runs**, so the
archived copy is provably the exact state that was imported.

**Amended 2026-09-27 (`HANDOFF.md` step 28):** with no import at cutover (`D9`, `D3`
superseded), "before the import runs" no longer has an event to precede. The dump is still
taken, before Atlas is decommissioned; it is the only copy of the pre-migration ledger.

`D11`'s rollback therefore changes shape rather than disappearing: it becomes **restore the dump
to a reachable MongoDB, re-point the env, redeploy the previous commit.** Slower, and it still
exists.

**Defense.** The owner chose free-plus-decommission over paying for Pro and over leaving Atlas
running (G3). The objection this document raised was not about cost but about `D11`: its rollback
is "redeploy the previous commit and re-point the env", which needs Mongo to still be there — so
decommissioning at cutover would have deleted the rollback target and left a ledger of real debts
with no second copy from the day it became authoritative. The owner's answer to that was the
dump, which is the cheap half of what keeping the cluster bought: one command, no running
service, a cold copy of every balance.

Against the dump: it is a file containing phone numbers and Venmo handles, and `SCOPE.md` §3 O5b
named exactly that hazard when it argued against a `mongoexport`-based import. Answered — the
hazard is real and the mitigation is the same one: it never enters git, never goes on a shared
drive, and lives on the owner's machine. The difference from O5b is that this file is not a
working input to a script that could be re-run; it is an archive that exists to be restored once,
if ever.

**Binds.** Phase 9's scope gains the dump, in that order. Phase 10's owner action becomes
"decommission Atlas" rather than "keep it readable". No phase may plan around a live Mongo after
cutover.

**Supersedes.** `D11` — **partially**. Dead: "Mongo is kept readable" and the rollback as
originally worded. Alive and unchanged: the big-bang shape, the import running after the last
Mongo session, `backend/` deleted in the commit after cutover, and the pessimistic auto-deploy
assumption.

**Amended 2026-09-28 (`HANDOFF.md` step 29, phase 10) — "decommission the Mongo Atlas cluster"
was wrong for this cluster.** The owner discovered mid-phase-10 that `backend/.env`'s
`DATABASE_URL` credentials reach a cluster shared with a second, unrelated, still-live project —
a `dump --uri` with no `--db` scoping pulled down both `poker-bar` (Buy-In's 8 collections) and
a `live` database (`messages`, `users`, `friendships`) that belongs to that other project. "The
Mongo Atlas cluster is decommissioned" therefore cannot mean the whole cluster or Atlas project —
that would take the other project down too. What actually happened: the `mongodump` was taken
(all 8 `poker-bar` collections, with real per-collection document counts — 120/70/37/74/35/20/
19/15 — confirmed from the dump's own output), kept off-repo at
`~/buy-in-mongo-backup-2026-09-28`, and then `db.getSiblingDB('poker-bar').dropDatabase()` was
run against that URI, scoped explicitly to `poker-bar` so `live` is untouched. The cluster itself
stays up — it is not this project's to decommission. This is the actual, narrower shape "Atlas
decommission" takes here; a future session should not attempt to delete the cluster or Atlas
project.

The `mongorestore --dryRun` verification named as this decision's proof did not run cleanly: `-v
--nsInclude="poker-bar.*" --dir=<dump>/poker-bar` found and listed all 8 `.bson`/`.metadata.json`
pairs but reported "don't know what to do with" each one and skipped it — a tooling
incompatibility (likely a `mongodump`/`mongorestore` version mismatch around the newer
`prelude.json` manifest) that was not root-caused. The owner chose to proceed on the strength of
`mongodump`'s own per-collection counts rather than resolve it. Recorded per R10: the dump's
contents are verified by `mongodump`'s own output, not by a successful dry-run restore.

*2026-09-16.*

### D18 — The ledger restricts deletion; only empty things can be deleted

**Decision.** Taken 2026-09-16, after phase 1 measured the alternative. `orders`, `buy_ins`,
`cashouts` and `payments` reference their session and their player with **`on delete restrict`**,
and `bars.owner_id` references `auth.users` with `restrict` too. A session, a player or a bar can
be deleted only once nothing in the ledger points at it. Pure children — `session_players`,
`drink_ingredients`, `player_share_links`, `player_claim_links` — still cascade, because they
carry no money.

**Defense.** The behaviour this replaces was measured, not theorised: deleting one session
removed 2 of its 3 orders and **kept the payment**, orphaned with a null `session_id`, so that
player's charges vanished while their credit survived and their balance flipped from "owes the
house" to "is owed by the house". The Go API does the same thing
(`backend/handlers/sessions.go:138-146` deletes children with every error ignored, and Mongo
payments carry no session id), so this is not a regression — it is a behaviour nobody would
choose on purpose for a record of real debts between friends, inherited rather than decided.

Against `restrict`: it makes deletion harder, and a host who wants a night gone now has to remove
its rows first. Answered: the ordinary case is unaffected, because the session a host actually
wants to delete is one created by mistake, which is empty and still deletes cleanly — verified on
PostgreSQL 17, 2026-09-16. The case that now fails is deleting a night that has money in it,
which is precisely the case that should require a second thought.

Soft-delete was the third option and was rejected on cost: a `deleted_at` column means a filter
on every read path, every RLS policy and every RPC, which is an enormous change to a port whose
premise is that it changes nothing else (§8.2).

**Consequences, recorded because they are surprising.** A **bar** can only be deleted once it is
empty, since its sessions and players are themselves protected. And deleting the owner's
`auth.users` row now **fails** rather than silently taking the bar and every debt in it — which
matters whenever account deletion is built, and is why that is not a quiet default.

**Supersedes.** §1.4's third "fix" — "session deletion cascades by FK (`on delete cascade` on
every child)" — **partially**. The cascade dies for the four ledger tables and survives for the
pure children. The Go bug it was fixing (a partial, error-swallowing cascade) is still fixed, by
a stronger means: the delete does not half-happen because it does not happen at all.

*2026-09-16.*

### D19 — A session deletes with its buy-ins and cashouts, and refuses while drinks remain

**Decision.** Taken 2026-09-26 at phase 6, asked under R12 because it contradicts `D18`'s
defense. A `delete_session(p_session_id)` RPC in `0002` deletes the session's `buy_ins` and
`cashouts` together with the session, in one transaction, and **refuses while any `orders` row
remains** — the host undoes each drink first, which is the only path that restores stock from
the order's snapshot (`delete_order`). The refusal reads *"Undo this session's drinks before
deleting it."* (plain register, chosen from three at R7). `payments` still restrict: no screen
writes a session-scoped payment (`players/[id]/page.tsx`'s payment form sends none, and Go's
`Payment` had no session id), so one blocking a delete means something outside the app wrote it.

**Defense.** `D18` rested on "the session a host actually wants to delete is one created by
mistake, which is empty". In this app it is not: `/session/new` writes a buy-in for every
player the moment the session starts, $20 by default (`web/app/session/new/page.tsx`,
`startSession`), and no screen can delete a buy-in (`grep -rn "buyins/\${" web/app` → nothing,
2026-09-26). Under `D18` as written, a session started by mistake could never be deleted and
would leave every player in it owing their buy-in forever — the same silent balance corruption
`D18` exists to prevent, arrived at from the other side. Drinks still block, because deleting an
order without restoring its stock is the Go bug (`orders.go:217-228`) this effort fixed.

Against: a night with real buy-ins and cashouts now deletes behind the passcode gate alone.
Answered — buy-ins and cashouts net out of nobody's balance but that night's players', and the
passcode gate (`web/app/sessions/page.tsx`, `confirmDelete`) is the "second thought" `D18` wanted.
The alternative offered — cascade everything, restoring stock from each snapshot — was declined.

**Supersedes.** `D18`, **partially**: dead for sessions — "a session … can be deleted only once
nothing in the ledger points at it" and the "created by mistake is empty" defense. Alive: the
`restrict` foreign keys themselves (`delete_session` removes the rows explicitly, so the schema
still refuses any other path), and everything `D18` says about players, bars and `auth.users`.

*2026-09-26.*

### D20 — The host sets the Venmo note; the amount appears only if they ask for it

**Decision.** Taken 2026-09-27 at phase 7. It was asked because `D12` had no answer for a payment
covering a whole balance rather than one night. The owner's words: *"Just Buy In but a user
should be able to adjust what the default note says including a {{amount}} tag if that makes
sense. But I don't want to show the balance by default in a venmo note."*

- `bars.venmo_note_template` is added by migration `0003`, capped at 120 characters.
- `renderVenmoNote` in `packages/core/src/venmo-note.ts` fills `{{amount}}` and `{{session}}`
  into the template.
- With no template set, a balance-wide payment (portal, player receipt, the host paying a player
  out) reads `Buy-In`. A night's receipt keeps `D12`'s `Buy-In — <session name>`.
- The amount never appears unless the host's template has `{{amount}}`.
- The host edits the template on `/players`.
- `get_shared_tab` returns the template in `bar`, because the anonymous pages can read nothing
  else (`D8`).

**Defense.** A Venmo note is visible to the payer's contacts on the feed by default, so an
amount in it is a disclosure the host should opt into, not a default. Against: this adds a
column and a settings field to a port whose premise is to change nothing else (§8.2).
Answered: the owner asked for it, and the column sits on `bars` for the same reason `D6` put
`venmo_handle` there — it is how the venue asks to be paid.

**Not decided here.** The help text on the field was written in the plainest register, and
two alternatives went to the owner (R7). Only the owner can edit the note; a co-host with the
`host` role cannot, because `bars_owner_write` checks `owner_id` and `D16`'s `is_bar_staff`
does not cover `bars`.

**Supersedes.** `D12`, **partially**. Dead: the fixed constant. Alive: the receipt's default
wording and the single URL builder.

*2026-09-27.*
