# Phase 11 — Realtime — SCOPE

**Status: `SCOPED` 2026-09-29 — Q1–Q4 answered (§7); Q5–Q6 open.** Proposes and decides nothing. Opened
by `/scope` on Sonnet 5.5; the build is Opus 5 per `PLAN.md` §2 (Default tier: a wrong answer here
is loud — a screen that does not update — not silent).

Read with `DESIGN.md` `D7`, `H11`, `PLAN.md` phase 11 and §4. This file narrows phase 11; it
reopens no `D<n>`.

## 1. What exists, verified 2026-09-29

| # | Claim | Verified state | Citation |
|---|---|---|---|
| 1 | Phase 9 (cutover) is done, so phase 11's only wait is satisfied | `BUILT` 2026-09-27, `main` at `f956408` | `PLAN.md:604`, `HANDOFF.md` step 28 |
| 2 | The only live behaviour is a 15 s poll of **one** key: `['orders', id]` on the session screen | `refreshInterval: SESSION_POLL_INTERVAL_MS`. `buy_ins`, `cashouts`, `session`, `players`, `inventory` on the same screen are **not** polled | `web/app/session/[id]/page.tsx:41-51`; `web/lib/config.ts:8` |
| 3 | So today a second device sees a new **order** within 15 s but never sees a rebuy, an early cash-out, a closed session or an added player until reload (an order's paid toggle rides the polled `orders` key, so it does arrive) | consequence of #2 | same lines |
| 4 | The publication adds six tables: `orders, buy_ins, cashouts, payments, sessions, inventory_items` | `0001_init.sql:869` (`PLAN.md` says `:360` — stale line number, same content). Nothing in `0002`/`0003` touches the publication | `grep -n publication supabase/migrations/*.sql` |
| 5 | **`session_players` and `players` are not published.** A player added mid-night (`add_session_player` RPC) changes `session_players`, which `fetchSession` joins into `player_ids` | not in the publication list; `SESSION_COLUMNS = '*, session_players(player_id, players(name))'` | `0001_init.sql:869`; `web/lib/supabase/queries.ts:31,113` |
| 6 | `drinks` (menu), `drink_ingredients`, `bar_settings` are not published either | same | `0001_init.sql:869` |
| 7 | Read policies are `is_bar_member(bar_id)` — a `security definer` lookup on `bar_members` per event per subscriber | `orders_read`, `buy_ins_read`, … `sessions_read` | `0001_init.sql:350-356, 411-419` |
| 8 | `anon` has no select policy on any table, so anon receives nothing over Postgres Changes. The share pages read through `get_shared_tab` (security-definer RPC) | comment at the publication line | `0001_init.sql:862-864`; `web/app/portal/[token]/page.tsx:17`, `web/app/receipt/[token]/receipt-ui.tsx:20`, `web/app/player-receipt/[token]/page.tsx:48` — none poll today |
| 9 | Replica identity is default everywhere; the migration says why (a `full` identity would put the whole deleted row into the unfiltered DELETE event) | comment + no `replica identity` statement anywhere | `0001_init.sql:865-867`; grep 2026-09-29 |
| 10 | No Realtime code exists in `web/`: no `.channel(`, no `postgres_changes`, no subscription hook | grep over `web packages scripts` excl. `node_modules`, 2026-09-29 → only `web/lib/config.ts` comment and the SQL line | grep |
| 11 | Writes are RPCs that touch several rows in one transaction (`create_order`, `add_session_player`, `start_session`, `delete_session`, `delete_order`, `set_tab_paid`) — one user action → several change events | `web/lib/supabase/writes.ts:106-195` | file |
| 12 | The app is a **single-bar tool used by one owner and a few hosts** on one night at a time (6 seated players on the last real night) | `HANDOFF.md` step 28 | `HANDOFF.md:1620-1624` |
| 13 | Docs say: RLS is **not** applied to DELETE events; DELETE filtering needs `replica identity full`; Postgres Changes runs one authorization check per subscriber per change, single-threaded; the docs steer new work toward Broadcast for scale. Client reconnects on its own; `CHANNEL_ERROR`/`TIMED_OUT` come through the subscribe callback; call `removeChannel` in effect cleanup | Supabase guides via Context7, 2026-09-29 | `/websites/supabase_guides` (Postgres Changes, Realtime getting started) |
| 14 | `@supabase/supabase-js` is pinned at 2.117.2 | `web/package.json:21` | file |
| **15** | **`prod` verified 2026-09-29 by the owner's dashboard query (screenshot in chat):** `pg_publication_tables` for `supabase_realtime` returns exactly `inventory_items, sessions, orders, buy_ins, cashouts, payments` — the six, and no `session_players`. **`dev` still unverified** | — | owner's query on project `rxvznjtpskendwhwwgin`; `dev` not read |
| 16 | **Migration numbering: `0004` and `0005` already exist** (`0004_onboarding.sql` applied by the owner 2026-09-29; `0005_invite_preview.sql` written and unapplied). Phase 11's publication migration is the next free number — `0006` as of 2026-09-29 — read the directory at build time | `ls supabase/migrations` | earlier drafts of this doc said `0004`; corrected the same day |

**The request is not quite the shape the plan assumed.** `PLAN.md` frames phase 11 as "replace
the poll with subscriptions." Row 2–3 says the poll only ever covered orders, and row 5 says the
publication as written cannot deliver roster changes. Phase 11 is therefore partly a *feature*
(devices agreeing on buy-ins, cash-outs, roster, session close) and not only a transport swap.

## 2. What this is / what this is not

**Is.** A second device on the session screen updates without a refresh for the events the
plan's done-when names (an order poured) and for whatever §3 Option scope-B or -C adds.
Signed-in staff only. A hook in `web/` that subscribes and invalidates SWR keys.

**Is not — parked, not to be relitigated mid-build:**
- **The anonymous share pages.** They cannot subscribe under RLS (`D7`, `H11`, row 8). They stay
  on their current behaviour (SWR, no poll). Whether they gain a poll is Q3, a separate decision.
- **Presence, typing indicators, cursors, "who is looking".** Not asked for.
- **Native (`native/` does not exist).** No mobile subscription work.
- **Any change to an applied migration.** A publication change is a new migration (`<next>`), never
  an edit to `0001`.
- **`replica identity full`.** Standing rule (`0001_init.sql:865-867`, `PLAN.md:695-696`).
- **Optimistic-update rewrites.** The `handleMarkPaid` pattern (optimistic `mutateOrders`) stays.
- **Realtime for lists off the live night** (`/players`, `/stats`, `/sessions`, `/inventory` as
  standalone screens) unless Q1 picks the wide scope.
- **Cutting phase 11 entirely** is allowed by `D7` at zero cost — this scope is the case for not
  cutting it, not an obligation.

## 3. Options

### O1 — How the client learns of changes

- **(a) Postgres Changes on the published tables, invalidating SWR keys on any event —
  Recommended.** It is what `0001` was built for, RLS already authorizes it, no new SQL beyond a
  publication top-up, and the client change is one hook. At this app's scale (row 12) the
  per-subscriber authorization cost the docs warn about is a rounding error.
  *Strongest argument against:* the docs steer new work to Broadcast, Postgres Changes is
  single-threaded, and every event triggers an `is_bar_member` lookup per subscriber; if the bar
  ever became several bars with many devices this is the model that gets rewritten. And DELETE
  events leak the deleted row's primary key to every subscriber (by design, row 9) — harmless
  here (a UUID on a member-only channel) but a real property.
- **(b) Broadcast from database triggers (private channel, `realtime.broadcast_changes`).** Scales,
  authorizes per channel through `realtime.messages` RLS, can be filtered to one session.
  *Against:* a new trigger + policy surface written and proved by hand on production data, a second
  auth model beside the table RLS, and more code than the whole feature justifies for ~6 players.
- **(c) Keep polling, but poll everything and shorten it.** Zero new infrastructure; the tightest
  rollback story. *Against:* it is the status quo's flaw made louder — more reads for the same
  latency, and it does not deliver "appears without a refresh."

### O2 — Scope of what becomes live

- **(A) Orders only — the plan's literal done-when.** Replace the orders poll; nothing else changes.
  *Against:* leaves rows 3 and 5 in place — a rebuy or a closed session still needs a reload, so
  the feature would feel half-built on a second device.
- **(B) The live session screen, whole — Recommended.** `orders`, `buy_ins`, `cashouts`,
  `sessions` (close/status), `inventory_items` (low-stock, which `drinks` reads), plus the roster
  via a `<next>` that publishes `session_players`. One screen, one hook, six keys.
  *Against:* touches the schema (a new migration on production) and widens the surface the runtime
  proof must cover; the roster case (row 5) is a real behaviour change with no precedent to
  compare against.
- **(C) B plus the list screens** (`/players`, `/sessions`, `/stats`, `/inventory`). *Against:*
  those are read between nights; a stale list costs a tap to refresh, and every extra
  subscription is a channel to leak (§5 H-a).

### O3 — Poll after the change

- **(a) Remove the poll where a subscription replaces it, keep it as the fallback while the
  channel is not `SUBSCRIBED` — Recommended.** Matches `PLAN.md:710` ("Realtime sets it to 0")
  without leaving a blind spot on a dropped socket: the poll interval becomes a function of
  channel status, not a constant of 0.
  *Against:* one more state (`connected` / `degraded`) to test.
- **(b) Set the poll to 0 outright.** The plan's literal wording. *Against:* a phone that
  backgrounds the PWA drops its socket, and until the client reconnects the screen is silently
  stale — worse than today, which at least polls.
- **(c) Keep the 15 s poll as well.** *Against:* two live models on one screen, which is what
  `D7` set out not to ship.

## 4. Dials

| Dial | Recommended default | Lives in | Note |
|---|---|---|---|
| Fallback poll interval while the channel is not `SUBSCRIBED` | 15 s (today's value) | `web/lib/config.ts` (`SESSION_POLL_INTERVAL_MS`, renamed or kept) | matches `PLAN.md:710` |
| Poll interval while `SUBSCRIBED` | 0 (off) | same | O3a |
| Published tables | the six at `0001_init.sql:869` **plus `session_players`** (O2 B) | migration `<next>` | never `drinks`/`drink_ingredients` unless Q1 says so |
| Refetch debounce after an event burst | 250 ms | `web/lib/config.ts` | one RPC writes several rows (row 11); without it one pour refetches each key several times |
| Channel filter | `bar_id=eq.<bar>` on each table (RLS already restricts, the filter cuts traffic and cost) | the hook | `session_id=eq.<id>` where the column exists |
| Reconnect backoff | supabase-js default | none | do not hand-roll (row 13) |

## 5. Hazards this work walks into

- **H-a — Channel leaks.** A subscription created in a component without `removeChannel` in the
  effect cleanup accumulates on every navigation (Supabase's "too many channels" troubleshooting
  page names this). One hook, cleanup in it, and the runtime proof navigates away and back.
- **H-b — The channel dies silently on a backgrounded PWA.** Row 13 / O3a. This is the one
  hazard that makes "set the poll to 0" a regression, and no gate sees it. Needs a device.
- **H-c — RLS on Realtime is the same RLS as reads, and `is_bar_member` is the policy.**
  A signed-in user who is *not* a member of the bar receives nothing — confirm that against
  the local PG17 harness with a second, non-member user (there is no separate `dev` — see §7 correction), not by reading the policy (`H11`).
- **H-d — DELETE events skip RLS and carry the key.** `undoOrder` and `deleteSession` produce
  them. The hook must tolerate a DELETE for a row the client never loaded, and must not read
  anything from the event but the key. Row 9 says `replica identity` stays default; the plan's
  own line calls the "subscribers see deleted-row keys" reading *unverified* (`PLAN.md:695`) — the
  build checks it in the local harness before relying on either reading.
- **H-e — A `<next>` on production.** `prod` is live with real balances (`CLAUDE.md`). Publication
  membership is metadata, not data, and `alter publication … add table` is idempotent-hostile
  (it errors if already added), so the migration must be written to be re-runnable in the local PG17 harness first
  and applied to `prod` by the owner or under an explicit go, never by an agent write tool.
- **H-f — Optimistic mutations racing an event.** `handleMarkPaid` writes optimistically then
  `mutateOrders()`. An event arriving between them refetches over the optimistic state. Debounce
  (dial) and last-write-wins are fine; a flicker is the failure to look for, not a data loss.
- **H-g — PWA cache.** `HANDOFF.md` step 28's finding: the service worker must update on a device
  before a new hook runs there. A gate cannot see it.
- **H-h — The proof needs two real devices.** Done-when is "poured on one device appears on a
  second without a refresh." Two browser tabs signed in as different users approximate it; they
  are not the device pass, and the build must say which it ran (R10).

## 6. Open questions — the batch for the gate

**Q1 — Scope (O2).** A: orders only · **B: the whole live session screen, with a `<next>` adding
`session_players` — recommended** · C: B plus the list screens.

**Q2 — Transport (O1).** **a: Postgres Changes — recommended** · b: Broadcast triggers ·
c: stay on polling and cut phase 11.

**Q3 — Do the anonymous share pages (`/portal`, `/player-receipt`, `/receipt`) get a poll?** They
have none today (row 8). **No — recommended:** a customer looking at their own tab can pull to
refresh, and `H11`/`D7` only require the phase to *state* which surfaces poll. · Yes, at the same
15 s dial.

**Q4 — Poll behaviour after subscribing (O3).** **a: off while `SUBSCRIBED`, on as fallback —
recommended** · b: off outright · c: keep both.

**Q5 — Who applies `<next>` to `prod`?** **The owner, after the builder proves it in the local PG17 harness —
recommended** (`CLAUDE.md`: no agent writes to `rxvznjtpskendwhwwgin`) · a session with an explicit
per-run go from the owner.

**Q6 — Publication check.** Row 15 is unverified. Will the owner run
`select tablename from pg_publication_tables where pubname = 'supabase_realtime'` on
`prod` and paste the result, before build? **Yes — recommended** (it decides whether `<next>` also
has to repair the six tables, not just add `session_players`).

No user-facing copy in this phase; nothing to word.

## 7. Answers

**2026-09-29, the owner, in chat — all four took the recommendation:**

- **Q1 — B.** The whole live session screen: `orders`, `buy_ins`, `cashouts`, `sessions`,
  `inventory_items`, plus the roster through a new `<next>` publishing `session_players`.
- **Q2 — (a) Postgres Changes.**
- **Q3 — (a)** Poll off while the channel is `SUBSCRIBED`, 15 s fallback poll while it is not.
- **Q4 — No.** The anonymous share pages get no poll; the phase states that they do not subscribe
  and do not poll (`H11`).

**Q6 answered 2026-09-29 for `prod`:** the owner ran the query — six tables, no `session_players`, so the migration only adds `session_players` and repairs nothing. (The owner's "applied 004" refers to `0004_onboarding.sql`, not to this phase's migration.) `dev` not yet read. **Still open:** Q5 (owner applies the new migration to
`prod` after the builder proves it on `dev`), and the `dev` half of Q6. Both are recommended-yes; neither changes the shape
of the phase, only its first step.

**Correction, 2026-09-29 (R5) — this doc wrongly said "`dev`" throughout.** There is no separate
`dev` project: `rxvznjtpskendwhwwgin` *is* production (`PLAN.md:611-612`, `DESIGN.md` `D3`
superseded 2026-09-27, `CLAUDE.md`). So: the `dev` half of Q6 does not exist (the owner's `prod`
read is the whole answer), and "proved on `dev`" in Q5 means proved in the local PG17 harness
(`HANDOFF.md` steps 12–13). Every runtime proof therefore runs against the live project — a
consequence the build's runtime pass must respect (no test rows left behind; see the item 16
prompt).
