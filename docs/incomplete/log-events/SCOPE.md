# Log an event — one P&L for poker, blackjack, sports betting and the rest — SCOPE

**Status: `SCOPED` 2026-09-29 — gate answered (§7).** §1–§6 are the pre-gate proposal, kept as written; where §7 differs, §7 wins. Opened by `/scope` on Sonnet 5.5.
Owner's asks, 2026-09-29, in order:
1. "start with a way to record profits and losses in whatever format is needed and integrate it with the poker p&l" (first read: sports bets).
2. Widened: "log an event should probably allow for a bunch of different events like Poker, Black Jack, Sports Betting etc. and then the form changes based on the option chosen from a drop down/search".
3. Defaults the owner accepted for the first read: manual entry only; resolved-only (stake and payout entered together, no open bets); poker and the rest shown apart with a combined total and a filter.

Vocabulary is the repo's: a **table** is a bar, a **game** is a session, a **logged session** is a poker game the player typed in (`docs/incomplete/logged-sessions/DESIGN.md`). This doc calls the new thing an **event**: one logged result of any kind.

## 1. What exists, verified 2026-09-29

| # | Claim | Verified state | Citation |
|---|---|---|---|
| 1 | **A player-owned P&L record already exists, for poker only.** `logged_sessions`: venue, blinds (required), straddle, game format, `buy_in_cents`, `cash_out_cents`, `minutes_played`, `note`, `user_id`. Applied to production 2026-09-29 | | `0021_logged_sessions.sql:1-2, 40-55` |
| 2 | One RLS policy for all four verbs, `user_id = (select auth.uid())` in `using` and `with check`; no `security definer`; the table states its own grant after `revoke all`; account deletion cascades from `auth.users` | the shape a sibling table copies | `0021:57-72`; `0015_delete_my_account_locks.sql:46,66-67` |
| 3 | `logged_sessions` cannot hold a bet or a blackjack session as it stands: `small_blind_cents > 0`, `big_blind_cents >= small_blind_cents` and `buy_in_cents > 0` are `not null` checks | | `0021:41-47` |
| 4 | **The merge is pure and in `@pb/core`.** `PokerResult` is `HomeResult \| LoggedResult`, discriminated by `source: 'home' \| 'logged'`; `mergeResults`, `filterResults`, `centsPerHour`, `hoursToMinutes`, `playedOnFromLocalDate`. Net is **won-positive**: logged net = `cash_out_cents − buy_in_cents` | | `packages/core/src/logged-session.ts:12-115`; test file `packages/core/tests/logged-session.test.ts` |
| 5 | One hook merges the two reads: SWR keys `'get_my_performance'` (shared with member Home) and `'logged_sessions'`; `error` is set if either fails | | `web/hooks/use-poker-results.ts:20-36` |
| 6 | `fetchMyLoggedSessions` fails loudly if the Data API capped the read, because a short history draws a wrong cumulative total | | `web/lib/supabase/logged-sessions.ts:22-35` |
| 7 | **Results is a poker page.** Tab `poker`, labelled "My poker"; the whole tab is `MyPoker` (Net / Sessions summary, cumulative chart, list, an All / Home games / Logged source filter, `?table=`) | | `web/components/results/results-tabs.tsx:7-10`; `my-poker.tsx:147-170` |
| 8 | **The tab strip is hidden from members.** It renders only for `isStaff && visible.stats`; a member sees `MyPoker` with no strip | so a new tab is invisible to the players this is for | `web/app/results/page.tsx:29` |
| 9 | Entry points: a full-width "Log a session" on the poker tab (hidden under `?table=`) and on member Home, both to `/results/log`; edit is `/results/log/[id]` | | `my-poker.tsx:82-90,156`; `web/components/member/member-home.tsx:81`; `web/app/results/log/[id]/page.tsx` |
| 10 | The log form is a route, not a dialog (BD-1), driven by one hook that holds every field as typed, blank money is `null` never `0`, and shows the net before saving | | `web/components/results/log-session-form.tsx:1-183`; `web/hooks/use-log-session-form.ts:1-40` |
| 11 | **There is no searchable dropdown in the UI kit.** `web/components/ui` has `popover.tsx` and no command, select or combobox; the log form's "Where" and "Game" suggestions use a native `<datalist>` | absence, grepped 2026-09-29 | `ls web/components/ui \| grep -iE "command\|select\|combobox\|popover"`; `log-session-form.tsx:99-115` |
| 12 | Dials for this feature live in `web/lib/config.ts`: `LOGGED_SESSION_MAX_HOURS = 48`, `LOGGED_SESSION_SUGGESTIONS = 5`, `LOGGED_SESSION_STAKES_PRESETS` | | `web/lib/config.ts:58-71` |
| 13 | **Nothing handles any other kind of event.** grep for `blackjack\|sportsbook\|sports bet\|parlay\|wager\|slots\|roulette` over `web/app components lib hooks`, `packages/core/src`, `supabase/migrations`, `docs/migration-plan.md`, terms and privacy finds nothing | absence, grepped 2026-09-29 | grep 2026-09-29 (the only "casino" hits are the poker log's copy and comments) |
| 14 | **The product is stated as a poker-night ledger that does not move money.** Terms: "a record-keeping tool for private home games… does not hold, move or process money". Store plan: guideline 5.3.4 (real-money gaming needs licensing) "avoided by design — ledger only, no funds movement", positioning "expense/ledger tracker for home games", age rating "alcohol + simulated gambling" 17+ | a logging feature stays inside the ledger line; the *copy* around it does not | `web/app/terms/page.tsx:16-21`; `docs/migration-plan.md:230-236`; privacy page "What we collect" `web/app/privacy/page.tsx:17` |
| 15 | `native/` does not exist; only the web app ships, so no store review is live | | `CLAUDE.md` "Architecture" |
| 16 | **`game-stakes` is `SCOPED`, unbuilt, and will `drop` and re-`create` `get_my_performance`** and edit `my-poker.tsx` and `database.types.ts`. It has no board row | | `docs/incomplete/game-stakes/SCOPE.md` §7; `PASSOFF.md` board (no open row as of 2026-09-29) |
| 17 | Migrations on disk end at `0026_claim_by_name.sql`, **untracked, another session's**. Next free here is read from the directory at build time: `0027` or later | | `ls supabase/migrations`; `git status --short` 2026-09-29 |
| 18 | Money is integer cents; floats banned. `MoneyInput`/`parseMoneyInput`: blank is `null`, not `0`. `played_on` is `timestamptz`, stored as local noon for a picked day (BD-4) | | `0001_init.sql:5-6`; `web/components/ui/money-input.tsx:19`; `logged-session.ts:105-115` |
| 19 | No agent applies a migration; the owner does, and production is the only project | | `CLAUDE.md` "Never do this" |
| 20 | `web/AGENTS.md` says this Next.js has breaking changes: read `node_modules/next/dist/docs/` before writing route code. The file is untracked in the checkout | | `web/AGENTS.md:3-5` |

**What the audit changes about the ask.** Row 1 means two-thirds of the machinery exists: an owner-only record, a pure merge, a loud-cap read, a form hook, and a cumulative chart. Row 3 means the poker table cannot simply be widened. Row 7–8 mean the *place* events show is the real design question, and it collides with a strip members cannot see. Row 11 means "a drop down/search" is a component to build, not one to pick up.

## 2. What this is / what this is not

**This is:**
- (A) A player logs a result of any registered **event type**: pick a type from a searchable list, and the form shows that type's fields.
- (B) Every event has the same money shape, **in** and **out**; net is out − in, won-positive, as poker's already is.
- (C) Events count in a combined P&L: a combined net, a combined cumulative chart, a per-type breakdown, and a filter by type. Poker's two existing sources (home games and logged sessions) are two of the contributors, unchanged.
- (D) The player can edit and delete an event.

**This is not, whoever asks:**
- **Not a sportsbook, and not money movement.** Buy-In records; it never holds, moves or settles money, sets or quotes odds, takes a cut, or connects to a book. This is the line Terms and the store plan rest on (§1 row 14).
- **No open bets.** No pending status, no "resolve later". A row is logged once it has a result. (Owner default, 2026-09-29.)
- **No parlay legs, no odds maths, no live scores or odds feed, no settlement from a feed.** Odds, where a type has them, are a note the player types, never a calculation input.
- **No bankroll ledger.** No deposits, withdrawals, bonuses, promos as separate lines, travel or tax rows. A free bet is a stake of $0 (Dial 6), not a new concept.
- **No import** from a sportsbook's CSV or a casino's player card. Parked: it is the obvious next ask.
- **No tax export** (no W-2G, no annual statement).
- **Not visible to anyone else.** No host, staff, table-mate or public read exists, exactly as poker's logged sessions (`0021` D7/D8).
- **Not part of any table's money.** Nothing here touches `sessions`, `buy_ins`, `cashouts`, a balance, a settle-up, a receipt or `get_my_tables`.
- **Not a rewrite of poker.** Poker home games and poker logged sessions keep their tables, their form, their `/results/log/[id]` edit route and their stakes fields (§3 K1).

## 3. Options

### K1 — How events are stored

- **(a) One generic table, `logged_events`, poker stays where it is.** Common columns are real (`event_type`, `played_on`, `place`, `title`, `stake_cents`, `payout_cents`, `minutes_played`, `note`, `user_id`); per-type extras (sport, bet type, American odds, table minimum) live in one `details jsonb`, validated by a zod schema per type in `@pb/core`. A `check (event_type <> 'poker')` keeps poker in one home. Poker still appears in the dropdown and routes to its existing form.
  *Defense:* a new event type is a registry entry plus a form field list, no migration, no new RLS policy, no new grant and no regenerated types. "A bunch of different events" is exactly where table-per-type would hurt. Nothing applied to production is edited, and game-stakes' groupable blinds columns stay real columns on poker's table.
  *Against, strongest:* the database cannot enforce a `details` shape, so a bug in the client can write a row the schema calls valid and the screen renders wrongly; a `details` field cannot be indexed or grouped without a later migration (say, "your average odds"). It also leaves **two tables for one concept**, and every future reader asks why poker is different.
- **(b) One table per event type** (`logged_bets`, `logged_blackjack`, …). *Defense:* every type gets real constraints and groupable columns, and a wrong write fails loudly. *Against:* each type is a migration, a policy, a grant, a types regeneration and another merge branch, and the owner applies each by hand on the only database. Nine types is nine of those. It optimises for the case (deep per-type analytics) the ask does not mention.
- **(c) One table for everything, poker migrated into it.** *Defense:* one concept, one table, one form path, no split edit routes. *Against:* it rewrites applied production data and a shipped form to gain tidiness, it makes blinds a `details` field just as game-stakes wants them groupable, and it edits `0021`'s design after it was frozen. Highest risk for the least new capability.

*Recommend (a).* It is the cheapest thing that lets the type list grow, and the cost it carries (unenforced `details`) is a validation problem a zod schema and a write-time test cover.

### K2 — Where events show on Results

- **(a) A new tab, "Everything" (name is copy, Q4), and "My poker" stays exactly as built.** The new tab has the combined net, cumulative chart, per-type breakdown and a type filter. Poker rows from both existing sources contribute to it. *Defense:* poker's win rate, its $/hr, its `?table=` and source filter are untouched and un-muddied by a bad Sunday of betting; `get_my_performance` and `my-poker.tsx` (which game-stakes is about to edit) are not opened by this build; the combined view is opt-in. *Against, strongest:* two places to look, two charts that overlap on the poker rows, and it forces the members-can't-see-the-tab-strip fix (§5 H2), which changes a screen every account uses.
- **(b) Fold events into the existing poker tab and rename it.** One net, one chart, the type filter beside the existing source filter. *Defense:* one place, no new tab, no strip change. *Against:* a page called "My poker" becomes something else, the URL `?tab=poker` and the metadata description ("Your poker results…") lie or move, two filter bars (type and source) stack on one screen, and it rewrites `MyPoker` at the moment game-stakes rewrites it.
- **(c) A separate "Other" tab, events only, no combined view.** *Defense:* least coupling. *Against:* it drops the owner's stated goal, "integrate it with the poker p&l", which is a combined number.

*Recommend (a).*

### K3 — The searchable dropdown

- **(a) A combobox built from the existing `popover.tsx` plus an input, for the type picker only.** *Defense:* real search, phone-friendly, matches the "drop down/search" ask, and it stays a single small component. *Against:* it is new UI with its own keyboard and touch behaviour to get right, and the kit has no precedent to copy (§1 row 11).
- **(b) Native `<datalist>` on an input,** as the form's "Where" already does. *Defense:* zero new components; the browser handles search and the phone keyboard. *Against:* a `datalist` is a suggestion, not a constraint: a player can type "blakjack" and the form has no type to show. iOS renders it poorly, and it cannot show a description or an icon.
- **(c) A plain list of buttons or chips, no search.** *Defense:* trivially reliable at nine types. *Against:* not what was asked, and it stops scaling past about a dozen.

*Recommend (a), with "Other" as a real entry that asks for a name,* so search never dead-ends.

### K4 — Which types ship first

A type is a registry entry: slug, label, the extra fields it shows. Most types need none.

- **(a) Poker, Blackjack, Sports betting, Slots, Roulette, Craps, Baccarat, Lottery, Other.** Bespoke extras only on Sports betting (sport, bet type, American odds, book) and Blackjack (table minimum); the other casino types share the base fields (where, when, in, out, hours, note). *Defense:* it shows the search is worth having and costs almost nothing per extra type. *Against:* nine labels is nine things to get right in copy and icons, and slots or lottery have no "stake per session" that maps cleanly (a player will type "in for $40, out for $12").
- **(b) Poker, Blackjack, Sports betting, Other only.** Smallest first cut. *Defense:* three real forms plus a catch-all. *Against:* the dropdown barely earns a search box, and "Other" becomes a junk drawer that cannot be broken down later.
- **(c) Add DFS/fantasy, horse racing, esports and poker tournaments.** *Against:* tournaments are already excluded from poker's design (`logged-sessions` DESIGN.md §2), and each addition invites its own fields.

*Recommend (a).* The registry makes (b) to (a) a config edit either way.

## 4. Dials

Every number is proposed with a default, and belongs in `web/lib/config.ts` (row 12), not hardcoded.

| # | Dial | Recommended | Why |
|---|---|---|---|
| 1 | Max hours per event | reuse `LOGGED_SESSION_MAX_HOURS = 48` | one cap catches "300" typed for "3.00" |
| 2 | Past-place suggestions | reuse `LOGGED_SESSION_SUGGESTIONS = 5` | same behaviour as the poker form |
| 3 | Max `note` length | 500 | poker's `note` check |
| 4 | Max custom type name ("Other") | 40 | poker's `game_format` check |
| 5 | Max `details` size | 2 KB (`pg_column_size(details) <= 2048`) | a jsonb column with no cap is a place to park anything |
| 6 | Minimum stake | **$0 allowed** (free bets, promo credits); `stake_cents + payout_cents > 0` | a $0 stake with a $25 return is a real result; poker's `buy_in_cents > 0` does not carry over |
| 7 | Odds range | American odds as an integer, `abs(odds) >= 100`, optional | integer, so no float; decimal odds are banned as a float |
| 8 | Type filter chips shown | only types the player has logged | nine empty chips on a new account is noise |
| 9 | Event type slug format | `^[a-z][a-z0-9_]{0,39}$` in the DB, the registry decides the rest | new types need no migration (K1a) |

## 5. Hazards this work walks into

- **H1 — The sign, again, and a worse version of it.** Net is out − in, won-positive, and getting it backwards is wrong by exactly twice the amount and passes every gate (poker's D §5 H4). For bets it is easier to get wrong at entry: a book's "payout" usually **includes the stake**; a player who types their profit as "payout" logs a win as a push. The labels must say "including your stake" (Q3), and the form must show the computed net before saving, as poker's does.
- **H2 — Members cannot see the tab strip.** `web/app/results/page.tsx:29` renders the strip only for staff with stats on. K2(a) needs it for everyone, and the stats-off case still has to make sense for a host. This changes a screen every account sees.
- **H3 — Poker must have exactly one home.** If an event of type `poker` can be written to `logged_events`, a game appears in two lists or is counted twice. The DB check `event_type <> 'poker'` and the registry both refuse it.
- **H4 — `details` is unenforced by the database.** Every write goes through a zod schema for its type; reading a row whose `details` fails the schema renders the base fields and hides the extras rather than throwing.
- **H5 — A type slug the registry no longer knows.** If a slug is renamed or removed, old rows must still render, under the stored slug's label or "Other", never disappear from the total.
- **H6 — The gambling frame around a ledger.** The logging is a ledger line and moves no money, so it stays on the right side of the store plan's 5.3.4. The *words* around it do not: Terms say "private home games", the privacy page's "What we collect" does not name betting activity, and the store plan says "avoid 'win'/'cash out' as headline verbs" and rates 17+. A build that adds sports betting without touching those three leaves the product describing itself falsely. The store review is not live (no `native/`), so this is a copy-truth problem today and a review problem later. Not legal advice; the scope stays on the never-moves-money side of the line on purpose.
- **H7 — Sensitive data.** A gambling record is personal financial data. Owner-only RLS is the whole wall (as `0021` D8), and it is proven on the PG17 harness with two users before it ships, with the refusals in the ledger step.
- **H8 — Two efforts on one file set.** `database.types.ts`, `config.ts` and `my-poker.tsx` are game-stakes' too (§1 row 16). This build must not run in parallel with it, and the board row must list them under "Files it owns".
- **H9 — SWR key sharing.** `'get_my_performance'` is member Home's cache too (`use-poker-results.ts:14-16`). The new read gets its own key, and the existing keys and fetchers stay as they are.
- **H10 — The loud-cap read.** A capped events read draws a wrong cumulative total silently. The new fetcher copies `fetchMyLoggedSessions`'s count check, and does not relax it.
- **H11 — Field creep.** Every bespoke type invites "just one more field" (parlay legs, book, tax lot). §2's not-list is the answer; a field not in it needs a new dated decision.
- **H12 — The picker is new UI on a phone.** A combobox that mis-handles the on-screen keyboard or focus is a broken form, not a cosmetic bug; it needs a walk on a real phone (recorded in the "Owed by the owner" list, as steps 56 and 58 did).
- **H13 — Migration numbering.** `0026` is another session's untracked file. Read the directory at build time; the owner applies it; nothing is written to production by an agent.

## 6. Open questions — the batch for the gate

Recommendation first in every question. Copy variants are in Q3 and Q4 (R7).

- **Q1 — Storage (K1).** (a) one generic table, `details jsonb`, poker stays put **[recommended]**; (b) a table per type; (c) one table, poker migrated in.
- **Q2 — Where events show (K2).** (a) a new combined tab, "My poker" untouched **[recommended]**; (b) fold into the poker tab and rename it; (c) a separate events-only tab, no combined view.
- **Q3 — Money labels for non-poker types (H1).** Poker keeps "In for" and "Out for". Offered, three registers: **plain** "Put in" / "Got back (with your stake)" **[recommended]**; **warm** "You wagered" / "You walked away with"; **terse** "Stake" / "Return".
- **Q4 — Entry button and the new tab's name.** Today: "Log a session" on the poker tab and on member Home. Offered: **plain** button "Log an event", tab "Everything" **[recommended]**; **warm** "Add a result", tab "All my results"; **terse** "Log", tab "All".
- **Recorded as recommended defaults, not asked** (say so in chat to change any): the initial type list is K4(a); the picker is K3(a), a combobox built from `popover.tsx`; stake may be $0 (Dial 6); Terms, Privacy and the store-plan wording are updated in the same build for your review (H6); `/results/log` becomes the type picker and defaults to Poker, so today's flow is unchanged.

## 7. Answers

Answered by the owner in chat, 2026-09-29, one batch. Recommendation taken every time.

| Q | Answer |
|---|---|
| Q1 Storage | **K1(a)** — one generic `logged_events` table with `details jsonb`; poker stays in `logged_sessions`; `check (event_type <> 'poker')` |
| Q2 Placement | **K2(a)** — a new combined tab; "My poker" untouched; the tab strip must become visible to every account (H2) |
| Q3 Money labels | **Plain** — "Put in" / "Got back (with your stake)" on non-poker events; poker keeps "In for" / "Out for" |
| Q4 Button and tab | **Plain** — button "Log an event", tab "Everything" |

**Taken as recommended, unasked (§6):** initial types K4(a); picker K3(a); stake may be $0 (Dial 6); Terms, Privacy and store-plan wording updated in the same build for the owner's review (H6); `/results/log` becomes the type picker, defaulting to Poker.

**Status: `SCOPED` — gate answered 2026-09-29.** The next step is a plan (`PLAN.md`), then a board row that lists `database.types.ts`, `web/lib/config.ts` and `web/app/results/page.tsx` under "Files it owns" and waits on game-stakes (H8).
