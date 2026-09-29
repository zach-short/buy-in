# Logged sessions — PLAN

**Status: `PLANNED` 2026-09-29 — GATE 2 answered the same day (§7), every recommendation taken; the plan is approved.** Builds `DESIGN.md` `D1`–`D8`. The design says what and
why; this says in what order, by whom, and what "done" means. Process: `docs/AGENT-PRACTICES.md` Parts 5–7; code:
`docs/conventions-typescript.md`, read in full before any edit.

## 0. Facts verified 2026-09-29 (these override the design where the two differ)

| # | Fact | Citation |
|---|---|---|
| 1 | member-home (board item 19) is merged, so `DESIGN.md` §5 H1 is closed. `my-poker.tsx`, `nav-items.ts`, `table-record.ts` are committed; `git status --short` shows only `web/AGENTS.md` and `web/CLAUDE.md` untracked, and neither is this item's | `259e121`; `git status` 2026-09-29 |
| 2 | Host setup phase 2 is merged | `fc2e7f6` |
| 3 | Migrations end at `0020_host_setup.sql`, which is applied (its header says so). The next free number is **`0021` as of 2026-09-29**, but **board item 21 (`OPEN`) also adds a migration** — read the directory at build time and take whatever is next | `ls supabase/migrations`; `0020_host_setup.sql:1-2`; `PASSOFF.md` row 21 |
| 4 | **Board item 21 owns `packages/core/src/database.types.ts` and `web/lib/config.ts`**, and so does phase 1 here. The two must not run at once | `PASSOFF.md` row 21 "Files it owns" |
| 5 | game-stakes has a `SCOPE.md` only: no plan, no board row. When it builds, it takes `get_my_performance`, `my-poker.tsx` and `database.types.ts` | `ls docs/incomplete/game-stakes`; its §7 |
| 6 | The poker tab is `MyPoker` (`web/components/results/my-poker.tsx:195-209`), 209 lines, one SWR key `'get_my_performance'`, with `?table=` read at `:197` | `wc -l`; the file |
| 7 | `PerformanceRow` is the generated RPC row type: `bar_id, bar_name, net_cents, played_on, session_id, session_name, stakes_cents` | `packages/core/src/database.types.ts:997-1008` |
| 8 | Precedent for a form page is a route, not a sheet: `/session/new`, `/schedule/new` | `ls web/app/session/new web/app/schedule` |
| 9 | Precedent for a single-row owner write that must prove it landed: `.select('id')` plus `requireRow`, because a refused update matches nothing and returns no error | `web/lib/supabase/session-edits.ts:9-28` |
| 10 | Precedent for hand-editing `database.types.ts` to the generator's shape for an unapplied migration, until the owner regenerates it | `HANDOFF.md` Code map (step 52, host-setup BD-3) |
| 11 | `/results` sits behind the login gate, and both navs own it (`NAV_ITEMS` under Account, `MEMBER_NAV_ITEMS` as a tab), so `/results/log` is reachable by every account and lights the right tab without a nav edit | `web/proxy.ts:15`; `web/components/shared/layout/nav-items.ts` |
| 12 | Local Supabase stack and the PG17 harness both exist and have been used for browser passes on write flows | `HANDOFF.md` steps 38, 51; Environment "SQL harness" |
| 13 | `EmptyResults({title, detail, href, action})` is the poker tab's empty-state component | `web/components/results/results-tabs.tsx:36` |

## 1. Decisions taken since ratification

Build-level calls that implement a `D`, each with how to reverse it.

- **BD-1 — The form is a route: `/results/log` (new) and `/results/log/[id]` (edit), not a dialog.** This follows
  the `/session/new` precedent (§0 row 8), keeps Back working, and needs no nav change (§0 row 11). *Reverse:* move
  the form component into a Radix dialog opened from the tab.
- **BD-2 — Blinds are required; straddle and game format are optional.** A casino cash game always has posted
  blinds. The table checks `small_blind_cents > 0` and `big_blind_cents >= small_blind_cents`. *Reverse:* make both
  nullable and label the row "Stakes not recorded", game-stakes' copy.
- **BD-3 — `game_format` is free text, suggested from the player's own past entries plus `NLH` and `PLO`.**
  game-stakes' preset list is for home formats (7-2 game, nit game) and is not built. *Reverse:* swap the
  suggestion source for game-stakes' preset list once it exists.
- **BD-4 — A picked date is stored as local noon of that day.** A `YYYY-MM-DD` value becomes `played_on` at 12:00
  local time with its offset. This keeps the date the same day in any US time zone, which is the BD-2 hazard
  (`DESIGN.md` §5 H8). A pure helper in `@pb/core` does the conversion and is tested. *Reverse:* store the exact
  time, by adding a time field.
- **BD-5 — The source filter lives in the URL as `?source=home|logged` (absent = All).** It works like `?table=`,
  so a link reproduces a view. When `?table=` is set, the source filter is hidden and treated as `home`.
  *Reverse:* hold it in component state.
- **BD-6 — `database.types.ts` gets the new table hand-written in the generator's shape**, per the step-52
  precedent (§0 row 10), until the owner regenerates it after applying the migration. *Reverse:* regenerate.
- **BD-8 — Phase 1 does not touch `web/lib/config.ts`; its one dial moves to phase 2.** Added 2026-09-29, the owner's
  call at build time. Item 22 had uncommitted edits in that file, and phase 1 needs no dial:
  `hoursToMinutes` takes the cap as an argument, and only the form (phase 2) supplies it. *Reverse:* none needed.
- **BD-7 — Hours are entered as a decimal (`4.5`) and stored as whole minutes (`270`).** Parsing is a pure
  `@pb/core` helper that rejects negatives and anything above the dial. *Reverse:* store hours as numeric. That
  is a float, so it is not recommended.

## 2. Phases

| # | Phase | Driver | Subagents | Est. context | Why that shape |
|---|---|---|---|---|---|
| 1 | Table, types, merge and reads: logged rows appear in the P&L | Opus 5 | none | comfortable | data layer + reads, the first seam; provable with a seeded row before any form exists |
| 2 | Writes and the form: log, edit and delete | Opus 5 | none | comfortable | writes + web surface; depends on phase 1's table and types |

Two phases rather than one keeps each under ~10 files and makes phase 1 a clean stopping point: a merged P&L that
is right, with rows inserted by hand on the local stack.

### Phase 1 — Table, types, merge and reads

**Status: `BUILT` 2026-09-29, uncommitted at hand-off (the owner commits) — `HANDOFF.md` step 56.**
`0021` is proven on the local stack and **unapplied to production**. The owner applies it before the commit
ships, because the poker tab reads the table. Deviations: scope step 9 moved to phase 2 (BD-8). Step 3's types were
generated from the local stack rather than hand-written (BD-6 met the easier way). Step 1 revokes `all` before
granting, because the local default privileges gave `authenticated` TRUNCATE, which ignores RLS.

**Scope:**
1. **Migration** `supabase/migrations/<next free>_logged_sessions.sql`: read the directory first (§0 row 3). The
   header states D1, D3, D4 and D8 in the house style (see `0020_host_setup.sql:1-30`).
   - `create table logged_sessions`: `id uuid pk default gen_random_uuid()`; `user_id uuid not null default
     auth.uid() references auth.users(id) on delete cascade`; `played_on timestamptz not null`; `venue text not
     null check (length(btrim(venue)) between 1 and 100)`; `small_blind_cents integer not null check (> 0)`;
     `big_blind_cents integer not null check (>= small_blind_cents)`; `straddle_cents integer check (> 0)`;
     `game_format text check (length <= 40)`; `buy_in_cents integer not null check (> 0)`; `cash_out_cents
     integer not null check (>= 0)`; `minutes_played integer check (> 0)`; `note text check (length <= 500)`;
     `created_at timestamptz not null default now()`.
   - An index on `(user_id, played_on)`.
   - `enable row level security`, and one policy, `logged_sessions_own for all to authenticated using
     (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))`.
   - `grant select, insert, update, delete on logged_sessions to authenticated`. No grant to `anon`.
2. **Harness proof** on the PG17 harness or the local stack (§0 row 12), in a scratch cluster, never production.
   With two users A and B:
   - A inserts and reads their own row.
   - A cannot select, update or delete B's row (0 rows).
   - A inserting with `user_id = B` is refused by `with check`.
   - anon selects nothing (permission denied).
   - Deleting A from `auth.users` removes A's rows.

   Record the transcript in the ledger step.
3. **Types:** add `logged_sessions` to `packages/core/src/database.types.ts` in the generator's shape (BD-6).
4. **`packages/core/src/logged-session.ts`**, pure, with no platform imports (`packages/core/src/index.ts:1-4`):
   - A `PokerResult` row shape: `source: 'table' | 'logged'`, `id`, `place`, `detail`, `playedOn`, `netCents`,
     `minutes | null`, `barId | null`, plus the stakes fields.
   - `resultsFromPerformance(rows)` and `resultsFromLogged(rows)`, where logged net = `cash_out_cents −
     buy_in_cents`.
   - `mergeResults(a, b)`, ordered by `playedOn` and then `id`.
   - `filterResults(rows, { source, table })`.
   - `centsPerHour(netCents, minutes)`.
   - `hoursToMinutes(text, maxHours)` (BD-7) and `playedOnFromLocalDate(yyyyMmDd)` (BD-4).

   Export them from `index.ts`.
5. **`packages/core/tests/logged-session.test.ts`**, a new file (X1). It pins:
   - the sign: in $300, out $500 → `+20000`; in $300, out $0 → `−30000`;
   - merge order with same-day ties;
   - every filter combination, including `table` forcing home-only;
   - `$/hr` rounding;
   - the hours parser's edges (`0`, `-1`, `4.5`, `48.01`, `''`);
   - that a picked date stays the same calendar day in `America/New_York` and `America/Los_Angeles`.
6. **`web/lib/supabase/logged-sessions.ts`**: `fetchMyLoggedSessions()`, ordered by `played_on`, with
   `count: 'exact'` and the same loud cap check as `fetchMyPerformance` (`performance.ts:12-24`).
7. **`web/hooks/use-poker-results.ts`**: both SWR keys (`'get_my_performance'` kept as is, so member Home's cache
   is shared, plus `'logged_sessions'`), merged with `mergeResults`. `error` is set if either read fails;
   `mutate` revalidates both.
8. **`web/components/results/my-poker.tsx`**:
   - Render `PokerResult[]` in place of `PerformanceRow[]` in the summary, chart, tooltip and list.
   - A logged row shows its venue, its `$2/$5` blinds and a tag. A home row keeps today's label untouched
     (game-stakes owns it).
   - Show `$/hr` beside a logged row's net when it has minutes.
   - Split into `source-filter.tsx` (All / Home games / Logged, BD-5) and a `poker-result-row.tsx`, so the file
     stays reviewable (L1).
9. ~~**`web/lib/config.ts`**: `LOGGED_SESSION_MAX_HOURS = 48` (the hours dial), with its comment.~~ **Moved to phase 2,
   2026-09-29 (BD-8).**

**Done when:**
- `cd web && npx tsc --noEmit`, `cd packages/core && npx tsc --noEmit`, `bun run test`, `cd web && bun run lint`
  (no new errors) and `bun run build` are all green.
- **The step-2 harness transcript shows every refusal.**
- **On the local stack,** with one home game (net −$50) and one hand-inserted logged row (Rivers Casino, $2/$5,
  in $300, out $500, 4h), Results → poker shows Net **+$150** and Sessions **2**. The chart ends at +$150, and the
  logged row reads `+$200` and `$50/hr`. Home games shows −$50 and 1 session; Logged shows +$200 and 1 session.
  `?table=<that bar>` hides the filter and shows −$50.

**Watch for:** the sign (`DESIGN.md` §5 H4) — it compiles, passes the gates and is wrong by exactly twice the
amount. Also: SWR key reuse. Changing `'get_my_performance'`'s key or its fetcher splits member Home's cache from
Results.

### Phase 2 — Writes and the form

**Status:** `PLANNED`. Waits on phase 1's migration being applied locally (the owner applies it to production).

**Scope:**
1. **`web/lib/supabase/logged-sessions.ts`**: add `createLoggedSession`, `updateLoggedSession` and
   `deleteLoggedSession`. Each does `.select('id')` plus `requireRow` (§0 row 9) and maps errors through
   `writeErrorMessage`.
2. **`web/components/results/log-session-form.tsx`**, with its state in **`web/hooks/use-log-session-form.ts`**
   (L2). Fields:
   - Where: required, with a `<datalist>` of the player's own past venues, newest first, up to the dial.
   - When: a date input, defaulting to today, with future dates refused.
   - Blinds: `MoneyInput` small/big, with preset chips 1/2, 1/3, 2/5, 5/10.
   - Straddle: optional.
   - Game: optional, suggestions per BD-3.
   - In for and Out for: `MoneyInput`, where blank is null, not 0 (`HANDOFF.md` Code map).
   - Hours: optional.
   - Note: optional.

   Show a live "Net +$200" line as the numbers are typed, so the sign is visible before saving.
3. **`web/app/results/log/page.tsx`** (new) and **`web/app/results/log/[id]/page.tsx`** (edit + delete through
   `useConfirm`). After a save or delete, revalidate `'logged_sessions'` and return to `/results?tab=poker`.
4. **"Log a session"** button on the poker tab (D6). The all-games empty state gains it as a second action beside
   "Join a table". The Logged-filter empty state uses the copy the owner picks (R7).
5. **Tapping a logged row** in the list opens `/results/log/<id>`. Home rows stay inert, as they are today.
6. **`web/lib/config.ts`**: add `LOGGED_SESSION_MAX_HOURS = 48` (moved from phase 1, BD-8), the venue-suggestion
   count and the stakes presets as dials (`DESIGN.md` §4).
7. **Copy (R7):** before shipping, ask for the form title, the Logged empty state and the tag, with 2–3 variants
   each.

**Done when:**
- The same gate commands as phase 1 are green.
- **A browser pass on the local stack:** log "Rivers Casino", 2/5, in 300, out 500, 4h → it appears at +$200 and
  $50/hr, and the net moves by +$200.
- Edit out to 100 → the row reads −$200 and the net moves by −$400.
- Delete → the row is gone and the net is back.
- A date picked as yesterday shows as yesterday.
- A second account on the same stack does not see the row.

**Watch for:** `MoneyInput` blank vs 0. "Out for" blank must be refused, not saved as a bust (0 is a real
bust, typed on purpose). Also: the edit page for another user's id must render "not found", not an error.

## 3. Dials

From `DESIGN.md` §4, each a named constant in `web/lib/config.ts`: default date today; no oldest date; no future
dates; venue suggestions **5**; stakes presets **1/2, 1/3, 2/5, 5/10**; max hours **48**.

## 4. Seams reserved, deliberately not built

- A "Log a session" button on member Home (`DESIGN.md` D6, follow-up).
- The stakes filter and by-stakes summary — game-stakes'. Its filter composes with `filterResults`'s options;
  whichever lands second adds the key.
- $/hour in the all-games summary (D4: home games have no hours).
- Tournaments, import, bankroll, sharing (`DESIGN.md` §2).

## 5. Repo hazards, with live numbers

- The migration number is contested with board item 21 (§0 row 3). Read `ls supabase/migrations` immediately
  before creating the file.
- `database.types.ts` and `web/lib/config.ts` are also owned by item 21 (§0 row 4), so do not run both at once.
- Production is `rxvznjtpskendwhwwgin`, and every row there is real. No agent calls a Supabase write tool; the
  owner applies the migration (`CLAUDE.md`).
- `bun run build` rewrites `web/next-env.d.ts`. Copy it aside and restore with `cp` (`HANDOFF.md` Environment).

## 6. Session protocol

`docs/AGENT-PRACTICES.md` Parts 5–7. Each phase closes with a ledger step, this file's phase header set to
`BUILT <date>, commit <hash>`, `As built:` notes under any `D` it deviated from, and the two commit blocks (never
`git commit` by an agent).

## 7. GATE 2 — questions

1. **Approve the two phases as written?** *Recommend yes.*
2. **Review of the migration (`DESIGN.md` §7 Q8):** harness proof alone, or harness proof plus one narrow Fable 5.1
   review of the policy? *Recommend harness alone.* It is one own-row policy with no definer function, so a
   mistake fails loudly.
3. **Order against board item 21** (it shares `database.types.ts`, `config.ts` and the next migration number):
   this before 21, or after? *Recommend before:* this item's phase 1 is smaller and does not wait on anything.
4. **Board rows:** add phases 1 and 2 to `PASSOFF.md` as two items in one lane? *Recommend yes*, so the collision
   check in the "Files it owns" column covers them.

**Answered 2026-09-29, in chat, one batch; every recommendation taken.**

| Q | Answer | Consequence |
|---|---|---|
| 1 | **Approve both phases** | the plan authorizes the whole run; phases do not return for approval |
| 2 | **Harness proof only** | no Fable review; phase 1 step 2 is the proof, recorded in the ledger step |
| 3 | **This before board item 21** | phase 1 takes the next migration number; item 21 waits until phase 1 is committed (shared `database.types.ts`, `config.ts`) |
| 4 | **Add board rows** | `PASSOFF.md` items for phase 1 and phase 2, one lane, serial |
