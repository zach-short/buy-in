# Logged sessions — a player records a game played away from any table, and it counts in their results — DESIGN

**Status: `IN FLIGHT` 2026-09-29 — phase 1 `BUILT` (`HANDOFF.md` step 56), phase 2 open (`PASSOFF.md` item 24). Ratified 2026-09-29.** Was `SCOPE.md` (committed `e014181`); renamed to `DESIGN.md` 2026-09-29 and
the gate answers (§7) written in as `D1`–`D8` below. **Frozen from here:** a decision changes only by a new dated
`D<n>` or an `As built:` note under the one it amends, never by editing it in place. The build order is `PLAN.md`.

§1–§6 further down are the scope as the owner answered it, kept as written (R5). Where they and a `D` differ, the
`D` wins.

## Decisions

**D1 — A logged session is its own row in a new `logged_sessions` table, owned by one account.** It carries
`user_id → auth.users on delete cascade`, `played_on timestamptz`, `venue text`, the stakes (D3), `buy_in_cents`,
`cash_out_cents` and the extras (D4). It creates no `bars`, `players`, `bar_members`, `sessions`, `buy_ins` or
`cashouts` row. *Defense:* every home-game money table requires a bar (§1 row 2), and a fake per-player bar would
make member-home's staff check hand a member the host shell, show in `get_my_tables`, trip `fetchBarId`'s
one-bar rule and be deleted by account deletion's `delete from bars` (§3 O1(b)). *Against, recorded:* two sources
now feed the P&L and must be merged (D2). Owner, 2026-09-29, §7 Q1.

**D2 — The P&L merges two reads in `@pb/core`; `get_my_performance` is not touched.** Results reads
`get_my_performance()` and the caller's `logged_sessions` rows, and a pure function maps both into one row shape,
won-positive, ordered by `played_on`. *Defense:* the game-stakes effort `drop`s and re-`create`s
`get_my_performance` (§1 row 8); not editing it means the two efforts never touch one `security definer`
signature, and the merge gets its own test file (conventions X1). *Against, recorded:* two round trips, and the
second read needs the same loud cap check as the first (§1 row 6). Owner, 2026-09-29, §7 Q2.

**D3 — Stakes are blinds in integer cents, in game-stakes' shape.** Columns `small_blind_cents`,
`big_blind_cents`, optional `straddle_cents`, and optional `game_format` text. "2/5" is `200`/`500`. *Defense:*
once game-stakes lands, a $2/$5 casino night and a $2/$5 home game fall in the same bucket of its stakes filter.
*Against, recorded:* this item builds a blinds input before game-stakes does, so whichever lands second reuses the
first one's field rather than building its own. Owner, 2026-09-29, §7 Q3.

**D4 — A logged session also records hours played and a note, both optional.** Hours are stored as
`minutes_played integer` (whole minutes, entered as hours such as `4.5`) and give **$/hour on logged rows only**.
The all-games summary does not show $/hour, because a home game has no hours to divide by. `note` is free text.
Owner, 2026-09-29, §7 Q4.

**D5 — Logged sessions are merged into Results → poker, tagged, and filterable.** There is one net, one
cumulative chart and one list. A logged row shows its venue where a home game shows the table name, plus a
"Logged" tag. A three-way filter, **All / Home games / Logged**, redraws the summary, the chart and the list.
Tapping a logged row opens it for edit or delete. Owner, 2026-09-29, §7 Q5–Q6.
*As built (phase 1, 2026-09-29, `HANDOFF.md` step 56):* the bar reads **All / Home games / Logged**, in the URL as
`?source=`. It is hidden under `?table=` and when there are no sessions at all. The tag reads "Logged", and the
Logged-filter empty state reads "No logged sessions — Games you play away from a table show up here once you log
them." **Both are provisional (R7)**; item 24 asks. A logged row is not yet tappable; the edit page is phase 2.

**D6 — The entry point is a "Log a session" button on the Results poker tab.** A button on member Home is a
follow-up, not this item. The label is owner-picked (plain register), 2026-09-29, §7 Q7.

**D7 — Nothing about a table's money changes.** A logged session never appears in any balance, settle-up,
receipt, portal, host Results, `get_my_tables` card or member-Home table card. No host can read one: the only
policy is the owner's own row (D8).

**D8 — The row's owner is the only wall.** One RLS policy, `for all to authenticated`, both `using` and
`with check` set to `user_id = (select auth.uid())`. `user_id` defaults to `auth.uid()`. The table states its own
`grant select, insert, update, delete … to authenticated` (HANDOFF invariant). There is no `security definer`
function. *Defense:* this is the simplest policy shape in the schema, and a mistake in it fails loudly
(permission denied, or another user's rows showing up) under the harness proof that `PLAN.md` requires. A wrong
definer function, by contrast, can leak rows silently. This item's build call on the model follows from that.
*Recorded as build-level, not asked:* it implements D1 and §5 H5.

## Rules that survive unchanged

- `get_my_performance()` — signature, scoping, sign, and its wrong `stakes_cents` label (§1 row 7) are
  game-stakes' to fix, not this item's.
- `net_cents` on this screen is **won-positive**, the opposite of `computeBalanceCents`
  (`web/lib/supabase/performance.ts:5-9`). A logged row's net is `cash_out_cents − buy_in_cents`.
- Money is integer cents (`0001_init.sql:5-6`); `played_on` is `timestamptz` (BD-2, `0001_init.sql:148-154`).
- member-home's shell rule: staff at any table = host shell (member-home §7 O1). Unaffected by D1.
- `?table=<bar id>` on the poker tab (member-home O3(b)) keeps working. With a table chosen, only that table's
  home games are shown, so the source filter is hidden.
- `fetchMyPerformance`'s loud failure on a capped read (`performance.ts:12-24`) stays, and is copied, not relaxed.
- No agent applies a migration; the owner does (`CLAUDE.md` "Never do this").

## Still owed at build (R7)

The form's title, the empty state when the Logged filter has no rows, and the tag's wording. The build session
offers 2–3 variants of each, in different registers, and asks before shipping.

Owner's ask, 2026-09-29: "as a user add the ability to log a session outside of a table so this app can also be
used to track general performance integrated with the homegames. for example if i played 2/5 at Rivers Casino in
Norfolk and was in for 300 and out for 500 that adds to my P&L."

Vocabulary is the repo's own (`docs/incomplete/member-home/SCOPE.md` header): a **table** is a bar, a **game** is a
session. This doc calls the new thing a **logged session** — a game the player types in themselves, with no table
and no host behind it. The P&L the ask names is the poker tab of Results (`web/components/results/my-poker.tsx`),
the old `/performance`.

## 1. What exists, verified 2026-09-29

| # | Claim | Verified state | Citation |
|---|---|---|---|
| 1 | **Nothing records a game outside a table.** grep for `casino\|venue\|off.?table\|personal session\|manual session\|self.?report\|log a session` over `web/app components lib hooks`, `packages/core/src`, `supabase/migrations`, `docs`, `PASSOFF.md`, `HANDOFF.md` finds only receipt CSS classes named `*-venue` and drink revenue | absence, grepped 2026-09-29 | `web/app/receipt/[token]/receipt-ui.tsx:76` (a class name, not data) |
| 2 | Every home-game money row is owned by a table: `sessions.bar_id`, `buy_ins.bar_id`, `cashouts.bar_id` are all `not null`, with composite FKs `(session_id, bar_id)` and `(player_id, bar_id)` | a game cannot exist without a bar | `0001_init.sql:144-162, 239-266` |
| 3 | A `players` row is also table-owned (`bar_id not null`); an account reaches its own rows only through `players.user_id` | | `0001_init.sql:83-99` |
| 4 | **The P&L is one RPC.** `get_my_performance()` returns one row per session the caller bought into — `bar_id, bar_name, session_id, session_name, played_on, stakes_cents, net_cents` — `security definer`, scoped to `players.user_id = auth.uid()`; `net_cents` is cash-outs minus buy-ins, **positive = won** | not redefined after `0004` (0008, 0010, 0014 only mention it in comments) | `0004_onboarding.sql:334-376`; `grep -n get_my_performance supabase/migrations/*.sql` |
| 5 | The poker tab draws a Net/Sessions summary, a cumulative line chart and a newest-first list from that one read; it already filters by `?table=<bar id>` (member-home's O3(b), **uncommitted, another session's work**) | | `web/components/results/my-poker.tsx:167-209`; `git status` 2026-09-29 (` M web/components/results/my-poker.tsx`) |
| 6 | `fetchMyPerformance` fails loudly if the Data API caps the rows, because a capped history draws a wrong cumulative total | | `web/lib/supabase/performance.ts:12-24` |
| 7 | `stakes_cents` in that row is the bar's **current default buy-in**, not the game's stakes; the list prints it as `$20 game` | a known wrong label | `0004:349-350`; `my-poker.tsx:147` |
| 8 | **`game-stakes` (`SCOPED`, gate answered 2026-09-29) will `drop` and re-`create` `get_my_performance`** to return real blinds, straddle and game format, and adds a stakes filter + by-stakes summary to the same poker tab. Stakes there are integer cents (`small_blind_cents`, `big_blind_cents`, `straddle_cents`) plus a `game_format` text from a preset list | | `docs/incomplete/game-stakes/SCOPE.md` §7 Q2, Q3, Q6, Q7 |
| 9 | Results is reachable by every account: hosts under Account, members as their own tab (member-home, uncommitted) | `MEMBER_NAV_ITEMS` | `web/components/shared/layout/nav-items.ts:29-33`; `web/app/results/page.tsx:20-32` |
| 10 | Member Home builds one card per table from `get_my_tables()` + `get_my_performance()`; the seats decide which cards exist, so a row with no table adds no card | `tableRecords` | `packages/core/src/table-record.ts:44-51` (untracked, member-home) |
| 11 | Account deletion ends with `delete from auth.users where id = v_uid` after locking that row, so a table whose `user_id` references `auth.users on delete cascade` goes with the account | | `0015_delete_my_account_locks.sql:46, 66-67` |
| 12 | Money is integer cents; floats are banned, with the reason | | `0001_init.sql:5-6`; `HANDOFF.md` Invariants |
| 13 | `played_on` is `timestamptz`, not `date`, because a bare date renders a day early west of UTC | BD-2 | `0001_init.sql:148-154` |
| 14 | A new table must state its own `GRANT`; an RLS policy without one reads as "permission denied" | invariant | `HANDOFF.md` Invariants (step 51, `0019`) |
| 15 | Migrations on disk end at `0020_host_setup.sql` (unapplied). Next free is read from the directory at build time — `0021` as of 2026-09-29 | | `ls supabase/migrations` 2026-09-29 |
| 16 | Money inputs have a house component: `MoneyInput` / `parseMoneyInput`, blank is null, never 0 | | `HANDOFF.md` Code map (`web/components/ui/money-input.tsx`) |

**What the audit changes about the ask.** Row 2 is the whole design constraint: a casino game has no table, and
every existing money table requires one. Fitting it in by inventing a table (§3 O1(b)) would put the game into the
host-side money paths and — worse — give the player a `bars` row, which member-home reads as "this account hosts"
and would flip them to the host shell. So this is **a new, player-owned record beside the home-game ledger, merged
only at the P&L**. Row 8 means the P&L read is about to change shape under another effort, so the merge should not
depend on editing `get_my_performance`.

## 2. What this is / what this is not

**This is:** (A) a player can log a game they played anywhere — where, when, stakes, in for, out for; (B) it counts
in their Results P&L (net, sessions count, cumulative chart, list) beside their home games; (C) they can edit and
delete what they logged.

**This is not, whoever asks:**
- **Not part of any table's money.** A logged session never touches `sessions`, `buy_ins`, `cashouts`, `payments`,
  a balance, a settle-up, a receipt or a host's Results. No host ever sees one.
- **Not a table.** It creates no `bars`, `players` or `bar_members` row, so it cannot change which shell an account
  gets (member-home O1).
- **Not tournaments.** Buy-in / cash-out cash games only. No entries, places, re-entries, bounties.
- **Not a bankroll ledger** — no deposits, withdrawals, expenses, rake, tips or travel.
- **Not itemized rebuys.** "In for" is the total brought to the table that session.
- **Not sharing or social.** No friends, no leaderboards, no public stats page.
- **Not an import** from a CSV or another tracker (Poker Bankroll Tracker, etc.). A separate item if wanted.
- **Not a venue directory.** Where you played is your own text, not a shared list of casinos.
- **Not other currencies.** USD cents, as everywhere else.
- **Not the game-stakes work** — but it borrows its stakes shape (§3 O3) so the two land as one P&L.

## 3. Options

### O1 — Where a logged session is stored

- **(a) A new table, `logged_sessions`, owned by the account:** `user_id → auth.users on delete cascade`,
  `played_on timestamptz`, `venue text`, stakes columns (O3), `buy_in_cents integer > 0`,
  `cash_out_cents integer >= 0`, optional fields (O4), `created_at`. RLS: one policy, `user_id = auth.uid()`, for
  all four verbs; `GRANT select, insert, update, delete` to `authenticated` (row 14). Defense: no `security definer`
  anywhere — the plain policy is the whole boundary, and it is the simplest policy in the schema to get right; it
  cannot touch host money by construction (row 2); account deletion takes it along (row 11). Against: the P&L now
  has two sources that must be merged and kept in step (O2).
- **(b) A hidden personal "table" per account** — a `bars` row owned by the player, a `players` row for them, and
  the casino game as an ordinary `sessions` + `buy_ins` + `cashouts`. Defense: `get_my_performance` picks it up with
  zero changes. **Against, and it is decisive:** the account now owns a bar, so member-home's staff check turns every
  member who logs one game into a host with a Sessions/Players/Schedule nav; the fake bar shows in `get_my_tables`,
  host screens, `fetchBarId` ("expected one bar") and account deletion's `delete from bars`; and every host-side
  total must learn to skip it. It is O1(a) with a disguise that everything else has to see through.
- **(c) Browser storage only.** Defense: no migration. Against: lost with the browser, invisible on a second
  device, and not a P&L anyone would trust.

*Recommend (a).*

### O2 — How the P&L merges the two

- **(a) Two reads, merged in `@pb/core`.** Results reads `get_my_performance` and the account's `logged_sessions`,
  and a pure function maps both into one row shape — `{ source: 'table' | 'logged', id, where, played_on, stakes,
  net_cents }`, won-positive — sorted by `played_on`. Defense: `get_my_performance` is untouched, so this cannot
  collide with game-stakes' `drop`/`create` of it (row 8) or widen a definer function; the merge is pure and gets
  its own test file (conventions X1). Against: two round trips, and the loud-cap check (row 6) must be applied to
  the second read too.
- **(b) Extend `get_my_performance` to `union all` the logged rows.** Defense: one read; every consumer (member Home
  cards, Results) gets it free. Against: it is the function game-stakes is about to replace, so the two efforts
  would be editing one `security definer` signature in sequence on the only database; and member Home's cards would
  have to learn to drop rows with no `bar_id`.
- **(c) A new `get_my_results()` RPC over both.** Defense: one read, old function untouched. Against: a second
  definer function for data the caller can already read directly under O1(a)'s policy.

*Recommend (a).*

### O3 — How stakes are recorded on a logged session

- **(a) The game-stakes shape: `small_blind_cents`, `big_blind_cents`, optional `straddle_cents`, optional
  `game_format` text** (game-stakes' preset list plus free text, row 8). "2/5" is `200`/`500`. Defense: once
  game-stakes lands, a "$2/$5" casino night and a "$2/$5" home game fall in the same bucket of its stakes filter
  and by-stakes summary — one P&L, not two. Against: a casino's odd structure ("1/3 with a $3 bring-in") has to be
  translated, and this item builds a blinds input before game-stakes does — so whichever lands first builds the
  shared field.
- **(b) One free-text `stakes` label.** Defense: types what the player sees on the placard. Against: "2/5", "$2/$5"
  and "2-5" are three buckets; it cannot join game-stakes' filter.
- **(c) Both: numbers for grouping, a free-text note for the odd case.** Against: two fields for one fact.

*Recommend (a).*

### O4 — What else a logged session carries

Always: **where** (free text, required), **when** (date, defaults to today), **stakes** (O3), **in for**, **out
for**. The optional extras:

- **(a) None.** Defense: fastest entry at the rail. Against: no hourly rate, the number casino players track most.
- **(b) + hours played + a note.** Hours (a decimal-free minutes integer, entered as hours) enables $/hour on the
  logged rows; the note is the player's own ("table was soft"). Defense: covers what a live-poker tracker is
  usually opened for. Against: $/hour cannot be computed for home games — the app does not record when a player sat
  down or stood up — so the summary shows it for logged sessions only, or not at all.
- **(c) + game type (NLH / PLO / mixed).** Covered by O3(a)'s `game_format` already.

*Recommend (b), with $/hour shown only on the logged-session rows and not in the all-games summary.*

### O5 — Where a player logs one

- **(a) A "Log a session" button on the Results poker tab**, opening a form (a sheet on mobile). Defense: it sits
  on the screen whose number it changes, and Results is reachable by hosts and members alike (row 9). Against: one
  tap deeper than Home for a member.
- **(b) (a) + a button on member Home.** Defense: a member opens the app to Home. Against: `web/app/page.tsx` and
  `web/components/member/**` are member-home's in-flight files (§5 H1); a second entry point is also a second place
  to keep in step.
- **(c) A new bottom-nav tab.** Against: the member nav was just set at three tabs (member-home §7 O2).

*Recommend (a), with (b) as a follow-up once member-home merges.*

### O6 — How logged sessions look in the P&L

- **(a) Merged, marked, filterable.** One chart, one list, one net. A logged row shows the venue where a home game
  shows the table name, with a small "Logged" tag; a segmented filter **All / Home games / Logged** redraws the
  summary and chart. Tapping a logged row opens it for edit/delete. Defense: "adds to my P&L" is literal, and the
  filter answers "how do I do at the casino vs at home". Against: game-stakes also adds a stakes filter to this tab,
  so two filters must compose (§5 H3).
- **(b) Merged, marked, no filter.** Defense: least UI. Against: no way to see the split the ask implies.
- **(c) A separate "Logged" list, not in the net.** Against: contradicts "that adds to my P&L".

*Recommend (a).*

## 4. Dials

Each a named constant in `web/lib/config.ts`, beside the member-home dials already there.

| Dial | Recommended | Why |
|---|---|---|
| Date a new log defaults to | today, local | most logs are entered the night of or the day after |
| Oldest date accepted | none | a player back-filling last year's casino trips is the point |
| Future dates accepted | no | a logged session has already happened |
| Venue suggestions | the player's own past venues, most recent first, up to 5 | "Rivers Casino" typed once, tapped after |
| Stakes presets on the form | 1/2, 1/3, 2/5, 5/10, plus custom | the common casino cash games |
| Max hours accepted | 48 | catches a typo (`300` hours for `3.00`) without refusing a marathon |
| Logged rows read per request | same cap check as `fetchMyPerformance` | a capped read draws a wrong total (row 6) |

## 5. Hazards this work walks into

1. **H1 — member-home is uncommitted in the same files.** `my-poker.tsx`, `nav-items.ts`, `app-shell.tsx`,
   `web/app/page.tsx`, `web/app/results/page.tsx` are modified and `web/components/member/**`,
   `packages/core/src/table-record.ts` are untracked (`git status` 2026-09-29), all board item 19's. This item edits
   `my-poker.tsx` at least. **Sequence after item 19 merges**, and re-read that file then.
2. **H2 — game-stakes replaces `get_my_performance`** (row 8). Under O2(a) this item never edits it, but the merge
   function's input type is that RPC's row type, which game-stakes changes. Whichever lands second adapts the
   merge; the test file pins the shape.
3. **H3 — two filters on one tab.** game-stakes adds a stakes filter; this adds All / Home / Logged. They must
   compose (stakes *and* source), and `?table=` from member-home is a third. One filter state, not three.
4. **H4 — the sign.** `net_cents` everywhere on this screen is won-positive, the **opposite** of
   `computeBalanceCents` (`performance.ts:5-9`). A logged row's net is `cash_out_cents - buy_in_cents`, never the
   reverse. A flipped sign compiles, passes, and shows a $200 win as a $200 loss — test it by value.
5. **H5 — the RLS policy is the only wall.** With no definer function, a policy missing `with check` lets a player
   insert a row with someone else's `user_id`; a missing `GRANT` reads as permission denied (row 14). Needs the
   local-stack harness proof: user A cannot select, update or delete user B's row, and cannot insert as B.
6. **H6 — "Sessions" count.** The summary's Sessions tile would mix home games and casino sessions. Fine under
   O6(a)'s filter; state it in copy.
7. **H7 — Migration state.** `0020` is written and unapplied; this item's migration is the next number read from
   the directory at build time and is applied by the owner, never by an agent (`CLAUDE.md` "Never do this").
8. **H8 — Dates.** `played_on` is `timestamptz` (row 13). A date picker that sends `YYYY-MM-DD` must be sent as
   local noon or local midnight with offset, or it lands a day early west of UTC — the bug BD-2 exists for.

## 6. Open questions

The gate batch, asked in chat 2026-09-29; answers go in §7.

1. **O1 storage** — own `logged_sessions` table (recommended) vs a hidden personal table.
2. **O2 merge** — two reads merged in `@pb/core` (recommended) vs extending `get_my_performance`.
3. **O3 stakes** — blinds as numbers, the game-stakes shape (recommended) vs a text label.
4. **O4 extras** — hours + note (recommended), none, or more.
5. **O5 entry point** — Results button now, Home later (recommended).
6. **O6 presentation** — merged, tagged, All / Home / Logged filter (recommended).
7. **Copy (R7)** — the button label.
8. **Sequencing / model** — after member-home (item 19); Opus 5 builds; whether the RLS policy gets a narrow Fable 5.1
   review or the local-stack harness proof alone (H5). Recommend harness proof alone: a single `user_id = auth.uid()`
   policy with no definer function is a loud-failure shape, unlike game-stakes' definer replacement.

## 7. Answers

Asked in chat 2026-09-29 as one batch; every recommendation taken. Recorded the same turn.

| Q | Answer (2026-09-29) | Consequence |
|---|---|---|
| 1–3 O1/O2/O3 | **Own `logged_sessions` table; two reads merged in `@pb/core`; stakes as blinds in integer cents** (game-stakes' shape) | one migration, one own-row RLS policy, no definer function; `get_my_performance` untouched |
| 4 O4 | **Hours + note** | `minutes_played` (nullable integer, entered as hours) and `note` (nullable text); $/hour on logged rows only |
| 5–6 O5/O6 | **Merged, tagged "Logged", All / Home games / Logged filter; button on the Results poker tab.** Home button is a follow-up after member-home merges | edits `my-poker.tsx`; not `web/app/page.tsx` or `web/components/member/**` |
| 7 Copy | **"Log a session"** (plain) | the button label; form title and empty-state copy still owed (R7) at build |
| 8 Sequencing / model | **Not asked in the batch — open.** Recommendation stands for the plan gate: after item 19 (H1); Opus 5 builds; local-stack harness proof of the RLS policy, no Fable review | goes to `PLAN.md` §7 |

**Still open for the build session (R7):** the form's title, the empty-state line when the Logged filter has no
rows, and the "Logged" tag's wording — 2–3 variants each, asked before shipping.

Next: `DESIGN.md` from this file, then `PLAN.md` — after board item 19 (member-home) merges. **Done
2026-09-29:** item 19 merged as `259e121` (HANDOFF 54); this file became `DESIGN.md` and `PLAN.md` was written the
same day. §5 H1 is closed by that merge. Q8 is carried to `PLAN.md` §7.
