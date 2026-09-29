# Game stakes — blinds per table and per game, shown in Performance — SCOPE

**Status: `SCOPED` 2026-09-29 — gate answered (§7); owner widened the scope and departed from four recommendations, each recorded there.** §1–§6 are the pre-gate proposal and are kept as written (R5); where §7 differs, §7 wins. Opened by `/scope` on Sonnet 5.5.
Owner's ask, 2026-09-29: "track the blinds at a table and the blinds per game so users can see what
stakes they're playing at in their performance." Read as: a **table** is a bar (the sign-up form says
"Name your table", `web/hooks/use-sign-up.ts:51`) and a **game** is a session. Q1 checks that reading.

## 1. What exists, verified 2026-09-29

| # | Claim | Verified state | Citation |
|---|---|---|---|
| 1 | **Nothing records blinds or stakes.** `grep -rniE "blind\|stakes"` over `web/app components lib hooks`, `packages/core/src`, `supabase/migrations`, `docs/incomplete` finds only the one label below and the `0004` comment | | grep 2026-09-29 |
| 2 | `sessions` has no game-parameter column: id, bar_id, name, played_on, status, settle_mode, created_at | | `0001_init.sql` `create table sessions` |
| 3 | **Performance already prints a "stakes" — and it is wrong for this purpose.** Each row reads `$<stakes_cents> game`, where `stakes_cents` is the bar's *current* `default_buy_in_cents`, not that night's stakes. `0004` says so itself | | `web/app/performance/page.tsx:158`; `0004_onboarding.sql:349-350` |
| 4 | So a $20 default buy-in shows as "$20 game" on every historic row, and changing the default rewrites the label on every past session | consequence of #3 | same |
| 5 | `get_my_performance()` is `security definer`, scoped to `players.user_id = auth.uid()`, returns `(bar_id, bar_name, session_id, session_name, played_on, stakes_cents, net_cents)`; a return-type change cannot use `create or replace` — it needs `drop function` then `create` and the grants restated | | `0004:356-392`; `database.types.ts:822-833` |
| 6 | Performance is the player's own win/loss: a cumulative line chart, a Net/Sessions summary, a newest-first list. No filter, no grouping | | `web/app/performance/page.tsx:30-160` |
| 7 | A session is created in two places, both inserting only `(bar_id, name)`: `start_session(p_bar_id, p_name, p_players jsonb)` and `start_scheduled_game` | | `0002_write_rpcs.sql:65-87`; `0004:325` |
| 8 | Adding a parameter to `start_session` or `create_scheduled_game` creates a **second overload**, not a replacement — Postgres keys functions by argument types. The old one must be dropped or PostgREST sees two | Postgres semantics; the `0002`/`0004` `revoke`/`grant` lines name the argument list | `0002:88`, `0004:387-394` |
| 9 | A host edits `bars` under `bars_owner_write`; staff write `sessions` under `sessions_staff` (`for all`) — so a plain `update` of a session row needs no new RPC | | `0001_init.sql` policies (`bars_owner_write`; `*_staff`, D16) |
| 10 | The house shape for a bar-wide default that pre-fills the new-session form is `default_buy_in_cents`: a column, an update fn treating zero rows as "owner only", an SWR hook, a Settings card; `session/new` reads it and never saves back | | `0004:29`; `web/lib/supabase/bar-settings.ts:56-63`; `web/hooks/use-default-buy-in.ts`; `web/app/session/new/page.tsx:34-39` |
| 11 | `session/new` has a name field, a player picker with per-player buy-ins, and no game-parameter field | | `web/app/session/new/page.tsx:91-140` |
| 12 | Scheduled games (`scheduled_games`: name, scheduled_at, session_id) turn into sessions on `start_scheduled_game`, which copies only the name | | `0004:73-88, 300-330` |
| 13 | Money is integer cents everywhere and `formatCents` prints it; a $0.25/$0.50 game is `25`/`50` | | `0001_init.sql:5-6`; `CLAUDE.md` invariant |
| 14 | **Another effort is about to edit the same files.** `docs/incomplete/host-setup/PLAN.md` phase 1 adds four columns to `bars` (migration `0008`, applied by the owner), hand-edits `database.types.ts`, extends `BarSettings`/`bar-settings.ts` and adds a card on `/account/settings`; phase 3 edits Home. Nothing is in flight yet; no `PASSOFF.md` row exists | | `PLAN.md` §2; `PASSOFF.md` board |
| 15 | Migrations on disk end at `0007`; `0008` is claimed by the host-setup plan (unwritten). Next free for this work is read from the directory at build time — **`0009` if host-setup lands first** ~~`0009`~~ **Corrected 2026-09-29 (R5):** `0008` is taken by `PASSOFF.md` item 17, so host-setup is `0009` and this is **`0010`**, all read from the directory at build time | | `ls supabase/migrations`; `PLAN.md:P1.1` |
| 16 | `prod` is the only project, holds real balances, and the owner applies every migration | | `CLAUDE.md` "Never do this" |
| 17 | Every existing session has no blinds and there is nothing to backfill them from | consequence of #1–#2 | — |

## 2. What this is / what this is not

**This is:** (A) a blinds value recorded on each **game** (session); (B) a **table** default that pre-fills it
(as the default buy-in does); (C) Performance showing the real stakes of each game and what the player's
results look like by stakes.

**Widened by the owner at the gate (§7, 2026-09-29):** each game also carries an optional **straddle** and an optional **game format** (7-2 game, nit game, button game, or the host's own text); and the new-session form **suggests blinds from the buy-in** (§7 R). Where those contradict the lines below, §7 wins.

**This is not, whoever asks:**
- Not a tournament structure — no blind levels, rising blinds, timers or clocks. One value per game.
- Not antes or a big-blind ante. ~~Not game type or straddles~~ — straddle and a free-form game format came in at the gate.
- Not a backfill of history: unrecorded games stay unrecorded. The app cannot know them.
- Not a change to any balance, buy-in, cash-out or settlement.
- Not the host-setup effort (feature toggles, first-run guide) and not sequenced inside it.
- Not stakes on the public receipt / portal pages (`get_shared_tab`) unless Q5 says otherwise.

## 3. Options

### K1 — How stakes are represented

- **(a) Two integers: `small_blind_cents`, `big_blind_cents`, both nullable.** Defense: sortable, groupable
  ("all your $1/$2 games"), formats as `$1/$2`, obeys the cents invariant. Against: a home game with an odd
  format (a $5 ante game, a "bring-in") does not fit; the host must translate it.
- **(b) One free-text `stakes` label.** Defense: fits anything ("1/2 NLHE, $5 straddle"). Against: no
  grouping — "$1/$2", "1/2" and "1-2" become three buckets, which defeats "see what stakes they're playing
  at"; the by-stakes view is the point.
- **(c) Structured blinds plus an optional free-text note.** Defense: groups by the numbers, keeps the odd
  detail. Against: a second field to design, show and explain for a note nothing reads.

*Recommend (a).* Grouping is the whole point of the ask; (c) is the upgrade if odd formats turn out to matter.

### K2 — How a game gets its blinds

- **(a) Extend the RPCs.** Add defaulted blind parameters to `start_session`, `create_scheduled_game`,
  `start_scheduled_game`'s copy; `drop` the old signatures. Defense: one atomic call, the blinds are set the
  instant the session exists. Against: fact 8 — three function signatures on the only database, each a chance
  to leave a stale overload behind; and it still needs an edit path anyway.
- **(b) Columns plus a plain `update`.** `session/new` calls `start_session` as today, then updates the
  session's blinds; the live table and the session page edit the same way. Defense: `sessions_staff` already
  allows it (fact 9), no function is replaced, and one code path serves "set at start" and "fix later" — which
  hosts will need, because blinds get forgotten or changed. Against: two calls at start, so a failure between
  them leaves a game with no blinds (recoverable — it is editable, and blinds carry no money).
- **(c) Only scheduled games and the edit path** — no field on `session/new`. Against: the common case is a
  game started on the spot.

*Recommend (b).*

### K3 — The table default

- **(a) `bars.default_small_blind_cents` / `default_big_blind_cents`,** edited in Settings, pre-filling each
  new session, editable per session. Defense: exactly the default-buy-in shape (fact 10) — a host who always
  plays $1/$2 never types it. Against: two more columns on `bars` beside host-setup's four.
- **(b) No table default; blinds entered per game.** Defense: fewer columns. Against: it re-asks the same
  numbers every week, and "the blinds at a table" was half the ask.
- **(c) Default = the blinds of the host's last game.** Defense: nothing to configure. Against: implicit, and a
  one-off $5/$10 night silently becomes next week's pre-fill.

*Recommend (a).*

### K4 — Scheduled games

- **(a) Scheduled games carry blinds and `start_scheduled_game` copies them.** Defense: an RSVP page can say
  what the night is. Against: `create_scheduled_game`'s signature changes (fact 8), `start_scheduled_game`
  is replaced, and the invite/RSVP cards do not show blinds today, so no reader wants it yet.
- **(b) Not in this scope.** A session started from a schedule gets its blinds from the table default and the
  edit path. *Recommend (b)* — it is the largest source of migration risk for the least visible gain.

### K5 — What Performance shows

- **(a) Replace the row label only.** `$1/$2 · Friday night` where `$20 game · Friday night` is today; games
  with no blinds show `Stakes not recorded`.
- **(b) (a) plus a "By stakes" summary** — one line per stakes: games, net, and the average per game — so the
  ask ("see what stakes they're playing at") is answered at a glance, not by scanning rows.
- **(c) (b) plus a stakes filter** that also re-draws the cumulative chart for one stakes. Defense: the
  natural next question. Against: chart state and a filter UI for a first version; and one player's history is
  often a handful of games.

*Recommend (b).* (c) is a clean follow-up on top of it. All three need `get_my_performance` to return the blinds:
`drop function` + `create` with the new columns and the `revoke`/`grant` restated (fact 5).

### K6 — History with no blinds

- **(a) Leave null and label it.** Honest. *Recommend.*
- **(b) Backfill from the table default.** Defense: no gaps. Against: it invents data — a 2025 game marked
  `$1/$2` because that is the default today is the exact bug fact 4 describes.
- **(c) Let the host tag past games in bulk.** Defense: real data, one time. Against: a bulk-edit screen for
  a one-off; the per-session edit path (K2) already lets them fix any game by hand.

## 4. Dials

| Dial | Recommended | Lives in |
|---|---|---|
| Constraint | `small_blind_cents > 0`, `big_blind_cents >= small_blind_cents`, both null or both set | check on `sessions` and `bars` |
| Upper bound | none beyond `integer` | — |
| Quick-pick chips on the form | `$0.25/$0.50`, `$0.50/$1`, `$1/$2`, `$2/$5`, then custom | `web/lib/config.ts` |
| "By stakes" grouping key | `(small_blind_cents, big_blind_cents)`; null pair = "Not recorded" | a pure helper in `packages/core` |
| Default for new bars | null (no default until the host sets one); the owner's own bar is set to 10/20 by the migration | column default + migration |
| Buy-in → suggested blinds (upper-inclusive) | ≤$5 → .01/.02; ≤$10 → .05/.10; ≤$20 → .10/.20; ≤$50 → .25/.50; **proposed continuation:** ≤$100 → .50/1; ≤$200 → 1/2; ≤$500 → 2/5; above → none. Below $1 → none | `packages/core` constant table |
| Game format presets | 7-2 game, Nit game, Button straddle, Bomb pot, Run it twice — proposed; owner edits the list | `web/lib/config.ts` |
| Format free text | ≤ 40 characters | check on the column |

## 5. Hazards this work walks into

1. **The definer function on the only database.** `get_my_performance` reads across every bar a user plays
   at (`0004:356-392`). Rewriting it must keep the `mine` CTE and its `auth.uid()` scope byte for byte; a
   slip there returns another user's games, compiles, passes every gate, and is wrong in production — the one
   silent failure in this work.
2. **Overloads.** Any signature change (K2a, K4a) leaves the old function callable unless dropped
   (fact 8); PostgREST then errors on ambiguity, or worse, the old one keeps working without the new columns.
3. **Migration collisions.** `0008` is host-setup's; both efforts add `bars` columns and edit
   `bar-settings.ts`, `database.types.ts` and `/account/settings`. Sequence this after host-setup phase 1 lands
   (Q9), and take the migration number from the directory, not from this file.
4. **The misleading label.** Until the row label is replaced, `$<default buy-in> game` stays on screen and is
   wrong; do not ship the columns without replacing it (K5 is not optional).
5. **Realtime and caches.** `session` is an SWR key the realtime hook refetches (`HANDOFF.md` step 34); an
   edited blind must go through the same key or the session screen shows the old value.
6. **Backfill temptation** (K6b). It is the easy way to make the chart look complete.

## 6. Open questions — the gate batch

Recommendations are marked in §3.

1. **Reading of the ask.** "table" = the bar (a default), "game" = the session (a value). Right?
2. **K1** representation — two integers, free text, or both? *Recommend two integers.*
3. **K2** how a game gets blinds — extend the RPCs, or columns plus a plain update? *Recommend the update.*
4. **K3** the table default — bar columns, none, or last game's? *Recommend bar columns.*
5. **K4** scheduled games carry blinds? *Recommend no, not in this scope.*
6. **K5** Performance — row label, plus by-stakes summary, plus filter? *Recommend row label plus by-stakes.*
7. **K6** old games — leave unrecorded, backfill, or bulk-tag? *Recommend leave unrecorded.*
8. **Copy** (R7), not settled anywhere. The label for a game with no blinds:
   - *plain* — "Stakes not recorded"
   - *warm* — "No stakes noted"
   - *terse* — "—"

   And the field on the new-session form:
   - *plain* — "Blinds"
   - *warm* — "What are you playing?"
   - *terse* — "Stakes"
9. **Sequencing against host-setup.** After its phase 1 (`0008` applied) — recommended — or independently?
10. **Model.** Opus 5 builds; one narrow Fable 5.1 review of the rewritten `get_my_performance`'s scoping
    (hazard 1 — the only silent path). Confirm, or assign otherwise.

## 7. Answers

Answered 2026-09-29, in chat. Two answers were typed, not picked; the rest took a marked option or departed from it as noted.

| Q | Answer | vs recommendation |
|---|---|---|
| 1 | Reading confirmed by not being contested: table = bar, game = session | — |
| 2 K1 | **Blinds as numbers, plus an optional straddle, plus a game format.** Owner asked for "a float for numbers like .25/.50". **Stored as integer cents (`25`/`50`), not floats** — exact, and `0001_init.sql:5-6` bans floats; `formatCents` prints `.25`. The aim (quarter/half blinds) is met. Straddle is an optional integer-cents amount. | **Departs** (widened) |
| 3 K2 | **Extend `start_session` and friends** — blinds, straddle and format as defaulted parameters; old signatures `drop`ped | **Departs** — takes hazard 2 (overloads) knowingly |
| 4 K3 | Yes: bar default columns + a Settings card. The default **also becomes $0.10/$0.20 for the owner's bar** ("prefill my game to .10/.20") | — |
| 5 K4 | **Scheduled games carry blinds, copied at start** — `create_scheduled_game` and `start_scheduled_game` change too | **Departs** — three functions on prod |
| 6 Format entry | A **preset list of common games to select, plus a free-text box** for the host's own | — |
| 7 K5 | **Row label + by-stakes summary + stakes filter** (the filter redraws the cumulative chart) | **Departs** — takes the largest option |
| 8 K6 | **Backfill every existing session to $0.10/$0.20 (`10`/`20` cents).** Owner's statement: "all games in the existing db are .10/.20". This is owner-supplied fact, not inference — the case `K6(b)` warned about was inventing history from *today's default*; here the owner is the source. Applied once in the migration, to sessions that exist at apply time | **Departs** — was "leave unrecorded" |
| 9 | Sequenced **after host-setup phase 1** (`0008` applied) | — |
| 10 Copy | Plain: field **"Blinds"** with **"Straddle"** and **"Game"** beneath; no-blinds label **"Stakes not recorded"** | — |
| 11 Model | Opus 5 builds; one narrow Fable 5.1 review of `get_my_performance`'s scoping **and** the replaced signatures | — |
| **R** | **The form suggests blinds from the buy-in** (owner, verbatim ranges): $1–5 → .01/.02; $5–10 → .05/.10; $10–20 → .10/.20; $20–50 → .25/.50; "and so on" | **New requirement** |

**R — read as, pending confirmation at the plan gate (`PLAN.md` §7):** the range edges as written overlap
($5, $10, $20 each appear twice), and the owner's own default buy-in is $20 and their game is $0.10/$0.20, so the
edges must be **upper-inclusive** — $10–20 includes $20 — or their own default would suggest .25/.50. The
"and so on" is proposed in §4 and needs a yes. The suggestion reads the form's single default buy-in field, not
each player's row; it **never overwrites blinds the host has typed**; and it applies on `session/new` only.

**Consequences recorded for the plan:**
- The pure mapping `suggestBlinds(buyInCents)` lives in `packages/core` with its own test file (X1).
- Migration is two-part on `prod`: the columns + backfill (data) and the function replacements (behaviour) —
  hazards 1 and 2 stand and the Deep review covers both. Number read from the directory at build time (`0009`
  if host-setup's `0008` lands first).
- Columns: `sessions` and `scheduled_games` each get `small_blind_cents`, `big_blind_cents`, `straddle_cents`,
  `game_format`; `bars` gets the same four as `default_*` columns. Format is text; its preset list is a dial (§4).

Next: `PLAN.md` for this folder — after host-setup phase 1, per Q9.
