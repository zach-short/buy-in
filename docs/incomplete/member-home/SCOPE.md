# Member home — a shell for players who are not hosts, and a view of the tables they play at — SCOPE

**Status: `BUILT` 2026-09-29, commit `259e121` — `HANDOFF.md` step 54.** Follow-up O3(c) is `PASSOFF.md` item 21. Gate answered in full (§7), every recommendation taken; build-time answers and the stale-row disproof are in §7. Opened by `/scope` on Sonnet 5.5.
Owner's ask, 2026-09-29: is there a difference between a member and a host, is there a view of the tables you
play at, and "if someone doesn't own a table they probably should not see the same thing as a table host."
Vocabulary is the repo's own: a **table** is a bar (`web/hooks/use-sign-up.ts:51`, "Name your table"), a **game**
is a session (`docs/incomplete/game-stakes/SCOPE.md` header), a **member** is an account that joined by invite and
holds a claimed `players` row and no bar (`0004_onboarding.sql:6-9`). The word "member" is not used for
`bar_members` rows in the UI; keep it that way (`0001_init.sql:439-441` reserves role `'player'`).

## 1. What exists, verified 2026-09-29

| # | Claim | Verified state | Citation |
|---|---|---|---|
| 1 | The database already separates staff from a member: `is_bar_staff` passes only role `owner`/`host`; every bar-scoped table has a `_staff` write policy and a `_read` policy on `is_bar_member` | staff = a `bar_members` row | `0001_init.sql:364-374, 404-423` |
| 2 | A joined player gets **no** `bar_members` row — a `players` row only. RLS then lets them read exactly: their own `players` row, their own `game_rsvps`, and `get_my_performance()` | `players_self_read`, `game_rsvps_self_read`, the RPC | `0001_init.sql:433`, `0004:111`, `0004:355-378`; `join_bar_as_player` inserts into `players` only (`0004:189-236`) |
| 3 | Owner and host are **identical to RLS**; the only difference is that only the owner writes `bars` and `bar_members`, and nothing in `web/` adds a host | `bars_owner_write`, `bar_members_owner_write` | `0001_init.sql:391-397`; grep `bar_members` over `web/` → only two comments |
| 4 | **The UI does not know who you are.** grep for `bar_members\|is_bar_staff\|isStaff\|isHost\|userRole\|useRole\|useMembership` over `web/app components hooks lib context` and `packages/core/src` finds only two comments | absence, grepped 2026-09-29 | `writes.ts:9`, `join.ts:7` |
| 5 | Sign-up already asks a role ("I'm joining a game" vs host), but only to decide whether to create a bar; the answer is not kept as a fact the app reads. An invite link skips the picker and forces `member` | `NEXT_PATH: {host:'/', member:'/join'}` | `web/hooks/use-sign-up.ts:33-36, 82-89, 106-111`; `web/app/signup/page.tsx:114-118` |
| 6 | After a successful join the app sends the player to `/` | `router.replace('/')` | `web/hooks/use-join-flow.ts:55` |
| 7 | `/` renders the **host dashboard for any signed-in account** — including a button that says "Start New Session" and, when no session is readable, nothing else | `status==='authenticated' ? <Dashboard/>` | `web/app/page.tsx:69, 98-101` |
| 8 | The bottom nav is one constant list of five tabs (Home, Sessions, Schedule, Players, Account), the same for every account | `NAV_ITEMS` | `web/components/shared/layout/nav-items.ts:12-21`; `app-shell.tsx:57-58` (`grid-cols-5`) |
| 9 | Every host screen reads host tables, so for a member they return empty (RLS) — and any screen that calls `fetchBarId` or `fetchBarSettings` **throws** "Expected one bar for this account, found 0" | callers: `/menu`, `/invites`, `scheduled-games.ts`, both settings hooks | `web/lib/supabase/queries.ts:231-236`, `bar-settings.ts:33-41`, `web/app/invites/page.tsx:91`, `web/app/menu/page.tsx:19` |
| 10 | The proxy gates only *signed in vs signed out*; it has no notion of role. `/invites`, `/schedule`, `/performance` are "host- or member-account-scoped" by comment only | `isPublicPath` | `web/proxy.ts:12-19, 24-43` |
| 11 | The one member-shaped page is `/performance` (own win/loss, from `get_my_performance`), reached today as a link under Account | `MORE_LINKS` | `web/app/performance/page.tsx:13`, `web/app/account/page.tsx:9-17` |
| 12 | **A member has no read path to the name of a table they joined**, unless they have already had a buy-in or cash-out there: `bars_member` is `is_bar_member`, and `get_my_performance` returns `bar_name` only from movements | so a fresh joiner sees nothing | `0001_init.sql:390`, `0004:355-378`; a `get_my_tables`-shaped function does not exist (grep `get_my_tables\|my.?tables\|MemberHome\|member-home` over `web packages supabase docs PASSOFF.md HANDOFF.md` → nothing) |
| 13 | **A member has no read path to a table's upcoming games.** `scheduled_games` is staff-only with "no member read policy"; a player answers an RSVP only through the link token | `scheduled_games_staff`, `rsvp_scheduled_game` | `0004_onboarding.sql:103-107, 242-273`; `web/lib/supabase/scheduled-games.ts:32` |
| 14 | A person can be at several tables: `players` is unique per `(bar_id, user_id)`, not per user. A host can also be a player at someone else's table | `players_bar_user_uniq` | `0004_onboarding.sql:229-233` (the conflict target), `0001_init.sql` `players_bar_user_uniq` |
| 15 | The member's read of money is **partial by design**: `get_my_performance` sums buy-ins and cash-outs only, never drinks or payments, so it is a poker record, not what the player owes | | `0004:355-378` (CTE `movements`: `buy_ins`, `cashouts`) vs `web/app/players/[id]/page.tsx:105-113` (balance = orders + buy-ins − cashouts − payments) |
| 16 | Adjacent open work: item 17 (claim an existing row, owns `web/components/join/*`, `web/app/join/[token]/page.tsx`, `web/app/invites/page.tsx`, `web/app/players/**`); `game-stakes` is `SCOPING` and would add stakes to `/performance`; `host-setup` is `SCOPED` and adds toggles to `/account/settings` and Home. `host-setup` explicitly excludes "player-side onboarding" and "roles or staff permissions … and a multi-bar switcher" | | `PASSOFF.md` board row 17; `docs/incomplete/game-stakes/SCOPE.md`; `docs/incomplete/host-setup/SCOPE.md` §2 |
| 17 | Migrations `0001`–`0007` are on disk; the next free number is `0008` by `ls supabase/migrations`, read again at build time. Which are applied to prod is **not re-verified here** — `host-setup/SCOPE.md` row 14 says `0005`–`0007` are unapplied; treat as a lead (R3). Agents never write to prod | | `ls supabase/migrations` 2026-09-29; `CLAUDE.md` "Never do this" |

**What the audit changes about the ask.** The ask reads as "add a member view". Rows 6–9 make it a *bug* before it
is a feature: a member who just joined lands on the host's dashboard with a Start New Session button and four tabs
that show empty lists, and two screens error. Rows 12–13 make the "tables you play at" view need **new server
functions**, because RLS deliberately gives a member nothing to read. Row 3/4 mean there is no role concept in the
UI to build on.

## 2. What this is / what this is not

**This is:** (A) the app knowing whether the signed-in account is staff at any table; (B) a member shell — nav, Home,
and a view of the tables they play at — instead of the host shell; (C) staff-only routes turning a member away
politely instead of erroring.

**This is not, whoever asks:**
- **Not authorization.** A hidden tab or a redirect is display. RLS (`is_bar_staff`) stays the only authority, and
  is not loosened by this work.
- **Not making a member a `bar_members` row, and not widening `players_read`.** That would hand every member every
  player's phone, Venmo and Cash App (`0001_init.sql:435-441`; `PASSOFF.md` item 17's "Not in scope").
- **Not the claim flow** — a migrated player taking over an existing row is item 17.
- **Not staff roles or a co-host invite UI** (nothing adds a host today, row 3). A separate item if wanted.
- **Not a table switcher for hosts.** One bar per staff account stays (`fetchBarId`'s rule, row 9).
- **Not changing how a balance is computed**, and not showing the member a balance that disagrees with their receipt (§5 H4).
- **Not the stakes work** (`game-stakes`) or the host-setup toggles; those touch `/performance` and `/account/settings`
  and are sequenced, not merged (§5 H6).
- **Not a public directory of tables.** A member finds a table only through an invite (`0004:6` decision 1).

## 3. Options

### O1 — How the app knows it is a member

- **(a) Derive it from data: staff-anywhere = the account has at least one `bar_members` row with role `owner`/`host`;
  otherwise member.** One small read, cached with SWR like every other key. Defense: it is the same fact RLS uses, so
  the UI and the database cannot disagree; it survives a host being promoted, demoted, or also playing elsewhere
  (row 14). Against: one round trip before the right nav can render, so the shell must show a neutral state for a
  moment, and a slow read must not flash the host shell at a member.
- **(b) Store the sign-up role in auth user metadata and read it from the session.** Defense: available with no query,
  instantly. Against: `user_metadata` is writable by the user, so it is a hint and never a fact; it goes stale when
  a member later starts a table or a host is only ever a player; and it duplicates a fact the database already holds.
- **(c) A `profiles` table with a `role` column.** Defense: explicit. Against: a third source of truth beside
  `bar_members` and `players`, and a migration for something derivable.

*Recommend (a).*

### O2 — What the member shell is

- **(a) Same five tabs, staff-only ones removed → three tabs: Home, Performance, Account.** `/` renders a member Home
  instead of the host dashboard; `/performance` moves from a link under Account to a tab; Account keeps sign-out and
  install. Defense: smallest nav a member can use, every tab has data, reuses the existing frame and `NAV_ITEMS`
  shape (`grid-cols-5` becomes `grid-cols-N`). Against: two nav lists to keep in step, and a host who is also a
  player elsewhere needs a rule (Q2).
- **(b) Same five tabs for everyone; each tab renders a member version.** Defense: no nav switch. Against: Sessions,
  Schedule and Players have nothing a member may read (rows 2, 13) so they would be five empty screens — the
  problem being fixed, moved down a level.
- **(c) A separate route group (`/t/...`) for members.** Defense: total separation. Against: duplicates the frame,
  breaks bookmarks and share links that already point at `/performance`, and is the largest change for the least
  gain.

*Recommend (a).*

### O3 — How much the "tables you play at" view shows

Common to all: one card per table (a bar where the account has a `players` row), newest activity first, empty state
that points to `/join`.

- **(a) Names only.** Table name, when you joined. Defense: needs the smallest new function and cannot leak anything.
  Against: a fresh joiner sees a card that does nothing.
- **(b) Names + your record there.** Adds games played and net won/lost per table, from data `get_my_performance`
  already returns (`bar_id`, `bar_name`, `net_cents`), and links each card to `/performance` filtered to that table.
  Defense: the answer to "how am I doing at Colin's table" and no new money exposure — it is the same numbers the
  member already sees. Against: `/performance` needs a table filter, which touches the file `game-stakes` also wants.
- **(c) (b) + the next scheduled game per table, with RSVP in place.** Adds a member-scoped read of `scheduled_games`
  (row 13) and a "Going / Can't" control. Defense: it is the reason a member opens the app between games. Against:
  a second new function and a second surface for the bug in §5 H5; RSVP already works from the link, so this is
  convenience, not capability.
- **(d) (c) + what you owe right now.** Defense: the number a player most wants. **Against, and it is decisive:**
  row 15 — a member read of orders and payments is a new money surface, and a partial figure that omits drinks
  disagrees with the host's receipt. Not recommended without its own scope.

*Recommend (b), (c) as the first follow-up.*

### O4 — What a member sees on a staff-only URL

- **(a) Redirect to `/`.** Defense: no dead end, one line per guard. Against: silent — a bookmarked `/players` just
  lands on Home and the member wonders why.
- **(b) A short "This page is for the table host" screen with a link Home.** Defense: says why; mirrors the
  `host-setup` T3(b) "turned off" page, so one component serves both. Against: one more screen to build.
- **(c) Nothing — leave the empty lists and errors.** Defense: zero work. Against: it is today's bug (§1 rows 7, 9).

*Recommend (b). The guard is display only; the data is already empty for a member by RLS.*

### O5 — New server surface

The member's table list (row 12) and, under O3(c), their upcoming games (row 13) cannot be read with a policy
change (§2). Two ways to serve them:

- **(a) Two `security definer` functions scoped to `auth.uid()`** — `get_my_tables()` and, if O3(c),
  `get_my_upcoming_games()` — in one new migration, with the `0004` privilege pattern (revoke public/anon/authenticated
  by name, grant `authenticated`). Defense: exactly the house pattern for `get_my_performance`; exposes only the
  caller's own rows and never a phone or handle. Against: a migration the owner must apply by hand, and each function
  is a place a scoping mistake leaks another player's data — hence the review in Q-hand-back.
- **(b) Widen `bars`/`scheduled_games` read policies to "has a `players` row".** Defense: no function to write.
  Against: `players_read` and friends are keyed on `is_bar_member` for a reason (`0001_init.sql:435-441`); a wider
  policy on `bars` also exposes `venmo_handle`/`cashapp_handle` to every member (`0001_init.sql:62-64`).

*Recommend (a).*

## 4. Dials

Each is a named constant in `web/lib/config.ts` (where `SESSION_POLL_INTERVAL_MS` already lives, `config.ts:8`).

| Dial | Recommended | Why |
|---|---|---|
| Member bottom-nav tabs | 3 (Home, Performance, Account) | O2(a); every tab has data |
| Tables listed on member Home before "show all" | 5 | a member is at a handful of tables; no pagination now |
| Games counted per table card | all | `get_my_performance` already returns them; the card sums, does not page |
| Upcoming-game window (O3(c) only) | next 14 days, one game per table | a poker night is weekly or monthly |
| Staff-role read cache | SWR default, revalidate on focus | it changes only when a host is added, which nothing does today |
| Neutral state while the role loads | show nothing, not the host shell | a member must never flash the host shell |

## 5. Hazards this work walks into

1. **H1 — Flashing the wrong shell.** Until the role read returns, the shell must render neither nav (O1's cost).
   A host briefly seeing a member nav is also wrong. Gates cannot see this; it needs a slow-network walk.
2. **H2 — A guard is not security.** Every redirect added here is cosmetic; the RLS in `0001` is the wall. No
   migration in this item may loosen it.
3. **H3 — `fetchBarId` throws for a member** (row 9). The guard must sit *above* every screen that calls it, or the
   member sees an error toast before the redirect.
4. **H4 — A partial balance.** Anything that shows a member "what I owe" without orders and payments disagrees with the
   receipt (row 15). O3(d) is excluded for this reason.
5. **H5 — Scoping mistakes in a definer function.** `get_my_tables` and `get_my_upcoming_games` run as the owner of
   the function, so a missing `where … user_id = auth.uid()` leaks every table. Needs the harness proof and one
   narrow review, as item 17 asks of its migration (`PASSOFF.md` row 17: Fable 5.1).
6. **H6 — Parallel work on the same files.** Item 17 owns `web/components/join/*`, `web/app/join/[token]/page.tsx`,
   `web/app/invites/page.tsx`, `web/app/players/**` — this item touches none of them if the guard is a layout-level
   component and `/invites` and `/players` are guarded from `web/app/invites/layout.tsx` and
   `web/app/players/layout.tsx`. **`web/app/players/layout.tsx` is inside item 17's `web/app/players/**`**, so either
   sequence after item 17 or guard from the shell. `game-stakes` would add a table filter/stakes to
   `web/app/performance/page.tsx`; O3(b)'s filter touches the same file. Check the board before starting.
7. **H7 — Migration state.** Which of `0005`–`0007` are on prod is a lead, not a fact (row 17); the build session
   re-verifies with the owner, takes the next number from `ls supabase/migrations`, and never applies anything.
8. **H8 — `/` is also the landing for a member after join** (`use-join-flow.ts:55`). Whatever renders at `/` for a
   member is the first thing a new player sees, so it needs the empty, error and loading states
   (`docs/conventions-typescript.md` D2), not just the happy path.

## 6. Open questions

The gate batch is §7.

## 7. Gate — answered 2026-09-29

Asked in chat 2026-09-29 as one batch; every recommendation was taken. Recorded the same turn.

| Q | Answer (2026-09-29) | Consequence |
|---|---|---|
| O3 — view depth | **Table + your record** (games played, net won/lost per table). Next-game + RSVP is a follow-up, not this item | one new function, `get_my_tables()`; no `scheduled_games` read path; O3(c)/(d) not built |
| O2 — member shell | **3 tabs: Home, Performance, Account.** Home renders the tables view for a member | `NAV_ITEMS` gets a member list; `/performance` becomes a tab; Sessions/Schedule/Players absent for members |
| O4 — host-only URL | **"This page is for the table host" screen with a link Home** | one shared component; display only, RLS unchanged (§5 H2) |
| O1 — who is staff | **Staff at any table = host shell**, derived from `bar_members`; render neither nav until resolved | no metadata role, no `profiles` table; a host who also plays elsewhere gets a "Tables I play at" link under Account |
| O5 — server surface | Not asked; follows from O3: **`security definer` functions scoped to `auth.uid()`**, not wider read policies (§3 O5(b) rejected by `0001_init.sql:62-64, 435-441`) | one migration, `get_my_tables()` only; harness proof + one narrow review (§5 H5) |

**Still open — copy (R7), for the design stage, not silently picked.** Not yet asked:
the member Home empty state, the host-only screen sentence, and the Account link's label. The build session
must offer 2–3 variants in different registers (plain, warm, terse) and ask before shipping any.

**Build-time answers — asked 2026-09-29 by the item-19 build session, in one batch.**

| Q | Answer (2026-09-29) | Consequence |
|---|---|---|
| Member Home empty copy (R7) | **Plain:** "You're not at any tables yet. Ask a host for an invite link." | `web/components/member/member-home.tsx` |
| Host-only screen copy (R7) | **Plain:** "This page is for the table host." with a Home link | `web/components/shared/host-only.tsx` |
| Host cards on `/account/settings` for a member | **Hide them** — a member sees What's new and Delete account only | `web/app/account/settings/page.tsx` added to this item's files (not on the board row) |
| O3(b)'s per-table filter | **Build it now** | the poker tab reads `?table=<bar id>` itself (`web/components/results/my-poker.tsx`), so `web/app/results/page.tsx` — host-setup P2's in-flight file — is not touched |

**Superseded 2026-09-29 by the build session's re-verification (R3, R5):** §1 row 12 ("a `get_my_tables`-shaped
function does not exist") was stale — `0010_leave_table.sql:47` added `get_my_tables()` (bar id, name, balance,
scoped to `players.user_id = auth.uid()`), and `get_my_performance()` (`0004_onboarding.sql:355`) already returns
`bar_id` and `net_cents` per session. The per-table record is a client-side sum of the two, so **item 19 adds no
migration** and O5 / §5 H5's Fable review has nothing to review. §1 row 11 is stale too: `/performance` is a
redirect to `/results?tab=poker` (B11, `web/app/performance/page.tsx`), so O2's "Performance" tab is **Results**.

**Nothing in `DESIGN.md` (`supabase-migration`) is reopened.** `D16` (membership is not authority) and BD-8
(a claimant is not a member) are relied on, not changed.
