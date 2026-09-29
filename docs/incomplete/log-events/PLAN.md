# Log an event — PLAN

**Status: `PLANNED` 2026-09-29 — GATE 2 answered the same day (§7), every recommendation taken; the plan is approved.** Builds `SCOPE.md` §7 (K1(a), K2(a), plain copy). SCOPE says what
and why; this says in what order, by whom, and what "done" means. Process: `docs/AGENT-PRACTICES.md` Parts 4–7; code:
`docs/conventions-typescript.md`, read in full before any edit. Opened by `/scope` follow-up on Sonnet 5.5; the build
sessions are the drivers in §2.

## 0. Facts verified 2026-09-29 (these override SCOPE where the two differ)

| # | Fact | Citation |
|---|---|---|
| 1 | The pure merge lives in `@pb/core`; `PokerResult` is `HomeResult \| LoggedResult`. Nothing there knows an event type, so this build adds a **sibling module**, not edits | `packages/core/src/logged-session.ts:12-115`; `index.ts:44-53` |
| 2 | `@pb/core` already depends on `zod ^3.25.64` and one module uses it, so per-type `details` schemas need no new dependency | `packages/core/package.json:12`; `packages/core/src/shared-tab.ts:1` |
| 3 | The poker chart, row and summary are typed to `PokerResult`: `ChartPoint.row: PokerResult`, `resultDetail(row)` reads `row.source` | `web/components/results/my-poker.tsx:26-31`; `poker-chart.tsx:9-21`; `poker-result-row.tsx:26-31` |
| 4 | **Game-stakes will edit `my-poker.tsx`, `poker-result-row.tsx`, `database.types.ts` and `get_my_performance`.** So this build writes sibling components for the Everything tab and *imports* `resultDetail`, `signedAmount` and `toneClass` from `poker-result-row.tsx` without editing it. The one unavoidable edit to a game-stakes file is the entry button's label in `my-poker.tsx:82-90` (one line) | `docs/incomplete/game-stakes/SCOPE.md` §7; §1 row 16 of SCOPE |
| 5 | The dials this feature needs already exist: `LOGGED_SESSION_MAX_HOURS = 48`, `LOGGED_SESSION_SUGGESTIONS = 5`. The other limits (note 500, details 2 KB, slug format) are **database checks**; name 40 and the odds range are not (corrected in §3), and the form mirrors them. So `web/lib/config.ts` is **not edited** by this build | `web/lib/config.ts:58-61`; SCOPE §4 |
| 6 | The Results tab type is `'poker' \| 'bar'`, the strip is `TABS` (two entries), and the page parses `?tab=` with `tab === 'bar' && isStaff !== false ? 'bar' : 'poker'` | `results-tabs.tsx:5-10`; `web/app/results/page.tsx:24` |
| 7 | The strip renders only for `isStaff && visible.stats`. A host with stats off sees no strip and a `?tab=bar` link still shows the turned-off page | `web/app/results/page.tsx:29`; the comment at `:15-19` |
| 8 | `/results/log` renders `LogSessionForm` and `/results/log/[id]` is the poker edit page; a non-uuid id reads as "not found" | `web/app/results/log/page.tsx`; `log/[id]/page.tsx`; `logged-sessions.ts:38-47` |
| 9 | Both entry buttons read "Log a session": `LogSessionButton` in `my-poker.tsx:82-90` and member Home's `web/components/member/member-home.tsx:81` region. The host `Dashboard` has none | `grep -rn "Log a session" web` 2026-09-29 |
| 10 | The UI kit has `popover`, `dropdown-menu`, `input`, `button`, `money-input`, `confirm-dialog`, `card`, `label`, `avatar`; no combobox | `ls web/components/ui` |
| 11 | `DataState` takes `rows`, `error`, `onRetry`, a required `empty`, and a render prop; every list screen uses it (conventions D2) | `web/components/shared/data-state.tsx:5-31` |
| 12 | Migrations end at `0026_claim_by_name.sql`, **untracked, another session's**. `git status --short` shows exactly that, plus `web/AGENTS.md` and `web/CLAUDE.md` untracked | `ls supabase/migrations`; `git status` 2026-09-29 |
| 13 | `integer + integer` in a Postgres check **raises "integer out of range"** near 2³¹; SCOPE's `stake_cents + payout_cents > 0` would be wrong at the extremes. The check is written `(stake_cents > 0 or payout_cents > 0)` | Postgres semantics; corrects SCOPE §4 Dial 6 |
| 14 | Local Supabase stack, the PG17 harness and browser passes on write flows all exist and have been used | `HANDOFF.md` Environment "SQL harness"; steps 38, 51, 56, 58 |
| 15 | `web/AGENTS.md` (untracked) says this Next.js differs from training data: read `node_modules/next/dist/docs/` before writing route code. This build adds two routes | `web/AGENTS.md:3-5` |
| 16 | `bun run build` rewrites `web/next-env.d.ts` and type-checks `.next/dev/types`; copy aside first and restore with `cp` | `HANDOFF.md` Environment "Build" |

## 1. Decisions taken since ratification

Build-level calls that implement SCOPE, each with how to reverse it.

- **BD-1 — Sibling modules and components; game-stakes' files are read, not edited.** `@pb/core` gets `event-types.ts` and
  `event-result.ts`; web gets `everything-*` components that import poker's helpers. *Reverse:* extract a shared plot
  and row once game-stakes lands.
- **BD-2 — A flat `EverythingRow` is the one shape the Everything tab draws.** `{ key, type, place, playedOn, netCents,
  detail, href \| null, minutes \| null }`, built from `PokerResult[]` (in web, using `resultDetail`) and from
  `logged_events` rows (in core, using `eventDetail`). *Defense:* the chart, list, breakdown and filter know one shape,
  not three. *Reverse:* a discriminated union.
- **BD-3 — `/results/log` becomes the type picker; the type is `?type=<slug>`, absent means poker.** Poker renders the
  existing `LogSessionForm` unchanged, every other type renders the new event form. Switching type swaps the form and
  drops what was typed. *Reverse:* keep `/results/log` poker-only and add `/results/log/events`.
- **BD-4 — Event edit is `/results/event/[id]`, not under `/results/log/`.** A `log/event/[id]` nested under `log/[id]`
  reads ambiguously next to a uuid segment; a top-level sibling cannot collide. *Reverse:* move it.
- **BD-5 — Where an event save returns:** to `/results?tab=everything`. Poker keeps returning to `?tab=poker`.
- **BD-6 — The Everything tab's type filter is `?type=<slug>`, chips only for types the player has logged**
  (SCOPE Dial 8), plus "All". It is a link bar like `SourceFilterBar`, not state. Poker as a chip covers both poker
  sources. The poker source filter (All / Home games / Logged) is *not* on this tab.
- **BD-7 — The type registry is the one place a type exists.** A registry entry: `slug`, `label`, `search` aliases, the
  extras it shows, whether it asks for hours, whether `place` is required, and its in/out labels. Unknown stored slugs
  render under a humanised slug and still count (SCOPE H5).
- **BD-8 — American odds are stored as an integer in `details`, `abs(odds) >= 100`.** `parseAmericanOdds` in core turns
  `+150`, `-110`, `150` into the integer and refuses `99`, `0`, `1.5`, `-99`. It is a note, never an input to maths
  (SCOPE §2).
- **BD-9 — `db` constraints mirror the form, and the zod schema mirrors both.** Three places state one rule; a test in
  `event-types.test.ts` pins that the registry's slugs match the DB's slug regex and that `poker` is absent.
- **BD-10 — The plan does not wait on game-stakes; it runs serially with it.** SCOPE §7's status line says "waits on
  game-stakes". The audit (row 4, 5) shows the shared files shrank to `database.types.ts` and one label line, so a hard
  dependency is not needed, only "never at once". *Reverse:* add "Waits on: game-stakes" to the board rows.

## 2. Phases

| # | Phase | Driver | Subagents | Est. context | Why that shape |
|---|---|---|---|---|---|
| 1 | Table, types, registry, merge and reads | Opus 5 | none | comfortable | data layer + reads, the first seam; provable by harness and tests with no UI |
| 2 | Writes and the log-an-event form, with the picker | Opus 5 | none | comfortable | writes + the one new UI component; depends on phase 1's table, registry and types |
| 3 | The Everything tab | Opus 5 | none | comfortable | the web surface; depends on 1 and 2, and changes a screen every account sees |
| 4 | Words: Terms, Privacy, store-plan wording, close-out | Opus 5 | none | small | copy that says what the product is; judgment, not silent-failure work |

Four phases, each under about 10 files. Phase 1 is a clean stopping point (a correct merge and a proven table, rows
inserted by hand); phase 2 is another (events can be logged and edited, the P&L tab not yet showing them); phase 3
is the visible result. **Driver rationale (Part 4):** every failure here is loud — a red gate, a refused write, a wrong
screen — and the one silent one, the sign of net, is pinned by tests written first, as in logged-sessions. No Deep
phase. No subagent.

### Phase 1 — Table, types, registry, merge and reads

**Status: `BUILT` 2026-09-29 — `HANDOFF.md` step 66; `0027` is proven on a scratch cluster and unapplied to production; types hand-written, regenerate after the apply; not seen in a browser (no UI).** Deviations: the database checks neither the 40-character name nor the odds range (§3 corrected below), so the form and zod carry them; `rowsFromPoker` lives in core with `resultDetail` passed in.

**Scope:**
1. **Migration** `supabase/migrations/<next free>_logged_events.sql`: `ls supabase/migrations` first (§0 row 12; `0026` is
   another session's, so `0027` or later). Header states SCOPE K1, the owner-only wall and the kill switch in the
   house style (`0021`, `0026`). Columns:
   - `id uuid pk default gen_random_uuid()`; `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade`;
   - `event_type text not null check (event_type ~ '^[a-z][a-z0-9_]{0,39}$' and event_type <> 'poker')`;
   - `played_on timestamptz not null`;
   - `place text check (place is null or char_length(btrim(place)) between 1 and 100)`;
   - `title text check (title is null or char_length(btrim(title)) between 1 and 100)`;
   - `stake_cents integer not null check (stake_cents >= 0)`; `payout_cents integer not null check (payout_cents >= 0)`;
   - `check (stake_cents > 0 or payout_cents > 0)` (§0 row 13);
   - `minutes_played integer check (minutes_played > 0)`; `note text check (char_length(note) <= 500)`;
   - `details jsonb not null default '{}' check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 2048)`;
   - `created_at timestamptz not null default now()`.
   - Index `(user_id, played_on)`; `enable row level security`; one policy `logged_events_own for all to authenticated`,
     `using` and `with check` both `user_id = (select auth.uid())`; `revoke all … from public, anon, authenticated`, then
     `grant select, insert, update, delete … to authenticated` (0021's reason: default privileges can hand out
     TRUNCATE, which ignores RLS).
2. **Harness proof** on the PG17 harness or the local stack, in a scratch cluster, never production. Users A and B:
   - A inserts and reads a row; A cannot select, update or delete B's row (0 rows); A inserting `user_id = B` is
     refused by `with check`; anon reads nothing (permission denied); deleting A from `auth.users` removes A's rows.
   - Refused: `event_type = 'poker'`, `'BAD SLUG'`, a 41-character slug; `stake = 0 and payout = 0`; a negative
     amount; `details = '[]'`; a `details` over 2 KB.
   - **Accepted:** `stake = 2147483647, payout = 2147483647` (§0 row 13: no overflow); `stake = 0, payout = 2500`
     (a free bet).
   - Record the transcript in the ledger step.
3. **Types:** add `logged_events` to `packages/core/src/database.types.ts`, generated from the local stack as phase 1 of
   logged-sessions did (or hand-written in the generator's shape if the stack lacks the table).
4. **`packages/core/src/event-types.ts`**, pure, no platform imports: the registry (BD-7) for the SCOPE K4(a) list —
   Blackjack (extra `tableMinCents`), Sports betting (extras `sport`, `betType`, `americanOdds`; `place` is the book,
   optional; no hours), Slots, Roulette, Craps, Baccarat, Lottery (place optional, no hours), Other (`title` required) —
   plus `POKER_TYPE = 'poker'` as a constant that is **not** a registry entry, one zod schema per type's `details`,
   `parseAmericanOdds` (BD-8), `searchEventTypes(query)`, and `typeLabel(slug)` with the unknown-slug fallback.
5. **`packages/core/src/event-result.ts`**, pure:
   - `EventLike` (a `logged_events` row by shape); `EverythingRow` (BD-2);
   - `eventNetCents(stake, payout)` — **payout − stake, won-positive**;
   - `rowsFromEvents(rows)`, `mergeEverything(poker, events)`, ordered by `playedOn` then `key`;
   - `eventDetail(row)` — `NFL · spread · -110`, `$25 min`, or `''`; a `details` that fails its schema yields `''`, never a throw (SCOPE H4);
   - `filterByType(rows, slug | 'all')`, `typeChips(rows)`, `breakdownByType(rows)` (each type's net, summing to the total).
   Export from `index.ts`.
6. **Tests first (X1), in new files** `packages/core/tests/event-result.test.ts` and `event-types.test.ts`. They pin:
   - the sign: put in 10, got back 20 → `+1000`; put in 25, got back 0 → `−2500`; put in 10, got back 10 → `0`; free bet, in 0, back 25 → `+2500`;
   - merge order with same-instant ties, poker and events interleaved;
   - `breakdownByType` sums to the merged total; `typeChips` lists only present types, poker included when poker rows exist;
   - an unknown slug still counts, under a humanised label; a malformed `details` renders the base row;
   - `parseAmericanOdds`: `''`, `+150`, `-110`, `110`, `100`, `99`, `0`, `-99`, `1.5`, `abc`;
   - registry integrity: no duplicate slug, every slug matches the DB regex, `poker` absent.
7. **`web/lib/supabase/logged-events.ts`**: `fetchMyLoggedEvents()` ordered by `played_on` then `id`, `count: 'exact'`, the same loud cap
   check as `fetchMyLoggedSessions` (SCOPE H10). Reads only in this phase.
8. **`web/hooks/use-everything-results.ts`**: `usePokerResults()` (its keys untouched, SCOPE H9) plus SWR key `'logged_events'`,
   mapped and merged with `mergeEverything`. Poker rows become `EverythingRow` here, using `resultDetail` (BD-1).
   `error` is set if any read fails; `retry` revalidates all.

**Done when:**
- `cd web && npx tsc --noEmit`, `cd packages/core && npx tsc --noEmit`, `bun run test`, `cd web && bun run lint` (no new
  errors) and `bun run build` are green.
- The step-2 transcript shows every refusal and both acceptances.
- **Not seen in a browser:** this phase has no UI. Its proof is the harness and the tests, and the ledger step says
  so plainly (Part 7 R10).

**Watch for:** the sign (SCOPE H1) — wrong by exactly twice the amount and green on every gate, hence tests first.
`integer` overflow in any check (§0 row 13). A migration number read from a doc rather than the directory.

### Phase 2 — Writes and the log-an-event form

**Status: `BUILT` 2026-09-29 — `HANDOFF.md` step 68; walked on the local stack at phone width with two accounts, not on a real phone; copy answered plain.** Deviations: Put in / Got back stack one per row (the long label wraps at 375 px); Delete sits outside the `<form>` because `ConfirmDialog`'s submit bubbles through the portal and saved first; Other's "Name" and the picker's "What" labels are provisional.

**Scope:**
1. **`web/lib/supabase/logged-events.ts`**: `createLoggedEvent`, `updateLoggedEvent`, `deleteLoggedEvent`, each `.select('id')` plus
   `requireRow`, errors through `writeErrorMessage` (the `logged-sessions.ts` precedent), and `fetchLoggedEvent(id)` with
   the uuid guard.
2. **`web/components/results/event-type-picker.tsx`** (BD-3, SCOPE K3(a)): a combobox from `popover` plus an input.
   Typing filters `searchEventTypes`; arrow keys, Enter and Escape work; on a phone the list scrolls inside the popover
   without the keyboard covering the selected row; **no match shows "Other"** rather than an empty list. Poker is in
   the list. **This component is built first and walked on a phone before the form is wired to it** (SCOPE H12).
3. **`web/components/results/log-event-form.tsx`**, state in **`web/hooks/use-log-event-form.ts`** (L2). Base fields: Where (label
   and requiredness from the registry, suggestions from the player's own past places for that type, capped by
   `LOGGED_SESSION_SUGGESTIONS`), When (a date, default today, no future), Put in and Got back (with your stake)
   (`MoneyInput`, blank is null, both may be $0 but not both — the form refuses what the table would), Hours where the
   registry asks (`hoursToMinutes`, `LOGGED_SESSION_MAX_HOURS`), Note. Per-type extras render from the registry's spec.
   A live **Net line** (SCOPE H1) shows the sign before saving.
4. **`web/app/results/log/page.tsx`** (edit): the picker at the top, `?type=` (BD-3), poker → `LogSessionForm`, else the new form. After a
   save, revalidate `'logged_events'` and go to `/results?tab=everything` (BD-5). **`web/app/results/event/[id]/page.tsx`** (new,
   BD-4): edit and delete through `useConfirm`; another account's id reads "not found".
5. **The entry buttons** read "Log an event": `LogSessionButton` in `my-poker.tsx` (one line, §0 row 4) and member Home
   (SCOPE Q4, plain). Read `node_modules/next/dist/docs/` for the route conventions first (§0 row 15).
6. **Copy (R7), asked before shipping, 2–3 variants each, plain taken as the default recommendation:** the picker's
   placeholder, its "no match" line, the form titles ("Log an event" / "Edit event").

**Done when:**
- The phase 1 gate commands are green.
- **A browser pass on the local stack**, as a phone-width window, two accounts:
  - Sports betting: put in $110, got back $210, NFL, spread, `-110` → the form shows Net **+$100**, saves, and lands on `?tab=everything` (which does not show it yet until phase 3, so verify it in the table).
  - Type "black" → Blackjack; type "blakjack" → "Other"; "Other" demands a name.
  - Poker chosen in the picker saves through `LogSessionForm` exactly as today and returns to `?tab=poker`.
  - Edit got-back to $0 → −$110; delete → gone; a second account never sees the row and its edit URL says "not found".
  - A free bet ($0 in, $25 back) saves; $0 in and $0 back does not.

**Watch for:** `MoneyInput` blank vs 0 — blank "Got back" must be refused, not saved as a loss (a typed 0 is a real loss). Switching type mid-form
drops input silently; that is the design (BD-3) and the pass confirms it does not corrupt the next form.

### Phase 3 — The Everything tab

**Status: `BUILT` 2026-09-29 — `HANDOFF.md` step 70; walked on the local stack at phone width (member, host stats off and on), not on a real phone.** Deviations: no web test file (vitest runs core only; the maths is pinned in `event-result.test.ts`); "By type" shows only under All; chips wrap as pills rather than a segmented bar; the empty state is draft copy for item 30 to ask. **It mounts the `logged_events` read, so `0027` must be on production before this ships.**

**Scope:**
1. **`web/components/results/results-tabs.tsx`** (edit): `ResultsTab` gains `'everything'`; the strip lists "My poker",
   "Everything", and "The bar" only when the viewer is staff with stats on.
2. **`web/app/results/page.tsx`** (edit): parse `?tab=` to the three; **render the strip for every account** (SCOPE H2, §0 row
   7), keeping the turned-off-page behaviour for `?tab=bar`; a host with stats off now sees a two-tab strip.
   `layout.tsx` metadata description no longer says "poker".
3. **`web/components/results/everything-results.tsx`** with `everything-summary.tsx`, `everything-row.tsx`, `everything-chart.tsx` and
   `type-filter.tsx` (BD-1, BD-6): Net and Entries; a per-type breakdown that sums to the Net; the type chips; a
   cumulative chart (a sibling of `CumulativeNetPlot`, loaded with `next/dynamic` like it); a newest-first list. A poker
   home row is inert, a poker logged row links to `/results/log/<id>`, an event row to `/results/event/<id>`.
   Empty state through `DataState` (D2), pointing at "Log an event".
4. **Tests (X1):** any new pure helper in web gets a new test file; the core merge is already covered by phase 1.

**Done when:**
- Gates green.
- **A browser pass on the local stack:**
  - One home game (−$50), one logged poker session (+$200), one sports bet (+$100), one blackjack session (−$40) → Everything reads Net **+$210**, Entries **4**; the breakdown reads Poker +$150, Sports betting +$100, Blackjack −$40 and sums to +$210; the chart ends at +$210.
  - Chip "Sports betting" → Net +$100, Entries 1; "Poker" → +$150, Entries 2, both poker sources.
  - "My poker" still reads +$150 with its own filters, unchanged.
  - **As a member (non-staff) the strip is visible with two tabs; as a host with stats off it shows two tabs and `?tab=bar` still shows the turned-off page.**
  - Tapping each row kind goes to the right place, and home rows do nothing.

**Watch for:** the chart's dollar axis (`cumulative` is dollars only for recharts; the running sum is taken in cents and converted once, `my-poker.tsx:19-25`).
The strip change reaches every account, so re-walk the host view.

### Phase 4 — Words and close-out

**Scope:**
1. **Copy (R7), asked first, 2–3 variants each:** the Terms sentence and section ("What Buy-In is"), the privacy page's
   "What we collect" line naming logged events, the Everything empty state. Terms currently says "private home
   games" and "does not hold, move or process money"; the new sentence keeps the second and widens the first
   (SCOPE H6). Update the `updated=` date.
2. **`docs/migration-plan.md` §8**: age-rating and positioning rows say what the product now is, keeping "ledger only, no funds movement".
3. **Close-out (Part 7):** ledger step, `DESIGN`-style `As built:` notes under SCOPE where the build deviated, the
   runtime entries into `PASSOFF.md`'s "Owed by the owner" list, the two commit blocks, `Next session:` line. Archive
   nothing yet: it moves when the owner's runtime pass is done.

**Done when:** gates green; `grep -rn "private home games" web` and the migration-plan rows agree with the new wording; the
owner picked every copy variant in chat.

## 3. Dials

From SCOPE §4, with where each lives after the audit (§0 row 5): max hours **48** and suggestions **5** reuse the existing
`LOGGED_SESSION_*` constants; note **500**, details **2 KB**, slug regex and $0 stake are
**database checks** mirrored by the form and by zod (BD-9). **Corrected 2026-09-29 (item 27, `HANDOFF.md` step 66):** the name cap **40** and odds `abs >= 100` are *not* database checks (`title` is 1–100, odds live in `details`); zod enforces odds and the form must cap Other's name at 40. Type chips "only present types" is logic, not a number.
No new entry in `config.ts`.

## 4. Seams reserved, deliberately not built

- **Open bets.** A `status` column is additive, and `EverythingRow` would gain a pending state that the totals ignore.
- **Import** from a sportsbook's CSV; **parlay legs**; **tax export**.
- **$/hr on the Everything summary** (types have no hours; only rows that do would show it).
- **Events on member Home.** The card summary stays poker's.
- **Extracting a shared plot and row** from `poker-chart.tsx` and `poker-result-row.tsx` once game-stakes lands (BD-1).
- A `details`-derived stat ("your average odds") — the reason to reopen K1(b) or add a generated column.

## 5. Repo hazards, with live numbers

- The migration number: `0026` is another session's untracked file (§0 row 12). Read `ls supabase/migrations`
  immediately before creating the file; the owner applies it; no agent calls a Supabase write tool (`CLAUDE.md`).
- **The board is empty of open rows on 2026-09-29**, so no "Files it owns" collision exists yet. When rows are added
  they list `database.types.ts` (phase 1, and game-stakes), `my-poker.tsx` (phase 2's one line, and game-stakes) and
  `web/app/results/page.tsx` (phase 3). Nothing in phases 1–4 lists `config.ts`.
- Production is `rxvznjtpskendwhwwgin` and every row is real. Nothing in this plan writes to it.
- `bun run build` rewrites `web/next-env.d.ts`: copy it aside and restore it with `cp`; never `git checkout --` or `git stash`.
- `web/AGENTS.md` and `web/CLAUDE.md` are untracked and not this build's; name every path in the commit blocks, never `-A`.

## 6. Session protocol

`docs/AGENT-PRACTICES.md` Parts 5–7. Each phase closes with a ledger step, its header set to `BUILT <date>, commit <hash>`,
`As built:` notes under any decision it deviated from, the runtime entries (Block B), and the two commit blocks. No agent
runs `git commit` or `git push`; the blocks name exact paths and `git add -N` any new file first.

## 7. GATE 2 — questions

1. **Approve the four phases as written?** *Recommend yes.*
2. **Review of the migration and the sign:** harness proof plus tests only, or also one narrow Fable 5.1 review of
   `eventNetCents` and `mergeEverything`? *Recommend tests and harness only.* The sign is pinned by tests written
   first and every other failure is loud; the strongest argument for a review is that a wrong sign is exactly the
   failure the gates cannot see, which is what logged-sessions also weighed and declined.
3. **Order against game-stakes** (SCOPE said "waits on"; the audit says "serial with", BD-10): this before it, after it, or
   whichever starts first? *Recommend this first.* It has a plan and game-stakes has only a scope, no board row.
4. **Board rows:** add phases 1–4 to `PASSOFF.md` as items 27–30 in one lane, serial, each with its "Files it owns"?
   *Recommend yes,* so the collision check covers them.

**Answered 2026-09-29, in chat, one batch; every recommendation taken.**

| Q | Answer | Consequence |
|---|---|---|
| 1 | **Approve the four phases** | the plan authorizes the whole run; phases do not return for approval |
| 2 | **Harness and tests only** | no Fable review; phase 1 steps 2 and 6 are the proof, recorded in the ledger step |
| 3 | **This before game-stakes** | phase 1 takes the next migration number and the shared `database.types.ts`; game-stakes waits until phase 2's label edit is committed |
| 4 | **Add board rows** | `PASSOFF.md` items 27–30, one lane, serial, each with its "Files it owns" |
