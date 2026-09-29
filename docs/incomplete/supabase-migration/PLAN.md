# Supabase migration — PLAN

**Status: `PLANNED` 2026-09-16 — approved at GATE 2 the same day.** Driver: Opus 5,
`PASSOFF.md` item 8. The plan authorizes the whole run; phases do not each come back for
approval. Phase 2 is already `BUILT`.

`DESIGN.md` is *what and why*, and it is frozen. This is *in what order, by whom, done when*.
Every phase cites the decision it implements; no phase reopens one. Where a phase would have to
contradict a `D<n>` to proceed, it stops and asks (R12) — the answer is a dated supersession in
`DESIGN.md`, not a reinterpretation here.

**Read before executing any phase:** `HANDOFF.md` → `CLAUDE.md` → `docs/conventions-typescript.md`
→ `DESIGN.md` §7–§10 → this file's §0 and the one phase you are running. §6 is the session
protocol.

---

## 0. Facts verified 2026-09-16 — **this table supersedes `DESIGN.md` §1 where they differ**

Re-run at Stage 4 as the standard requires, because days pass between ratification and build and
another effort may have moved something. Every command below was run in this checkout on
2026-09-16, branch `supabase-monorepo` at `299302b`.

| Claim | Verified state | Source |
|---|---|---|
| Branch / commit | `supabase-monorepo` at `299302b` ("ratify the supabase migration design at gate 1"). `DESIGN.md` is committed and in HEAD. | `git log --oneline -1`; `git ls-tree -r HEAD --name-only` |
| Migration count | **One** — `supabase/migrations/0001_init.sql`, still the only file, still tracked. Read the directory, never this number. | `ls supabase/migrations/`; `git ls-files supabase` |
| `0001` applied anywhere? | **No** — no Supabase project is configured and none exists. `D4`'s in-place amendment window is therefore **open**, and closes the moment a phase applies it. | `grep -n supabase .mcp.json .claude/settings.local.json` → nothing |
| Build | `bun run build` — **exit 0**, 20 routes | run 2026-09-16 |
| Typecheck (web) | `cd web && npx tsc --noEmit` — **exit 0** | run 2026-09-16 |
| Typecheck (core) | `cd packages/core && npx tsc --noEmit` — **exit 0** | run 2026-09-16 |
| Go | `cd backend && go build ./... && go vet ./...` — **exit 0** | run 2026-09-16 |
| Lint | `cd web && bun run lint` — **exit 1, 105 problems (13 errors, 92 warnings)**. Unchanged since HANDOFF step 5. Not this effort's to fix (`DESIGN.md` §8.2). | run 2026-09-16 |
| Test | `bun run test` — **exit 1**, no test files, no vitest config. **Phase 2 is what makes this a gate.** | run 2026-09-16 |
| Does a gate dirty the tree? | **No.** `git status --short` was empty immediately after a full `bun run build`. | run 2026-09-16 |
| PWA workers | `web/public/sw.js` and `swe-worker-*.js` still carry **2026-04-12** mtimes after that build — next-pwa does not run under turbopack. `H7` stands: the cutover phase must regenerate and verify on a device. | `ls -l web/public/sw.js` 2026-09-16 |
| **`D13` — is Render down?** | ~~No. `https://poker-bar.onrender.com/health` → 200 as of 2026-09-16. The owner has not suspended it yet; `PASSOFF.md` item 9 is still `OPEN`, and `DESIGN.md` §1.5's open-API row is still **current fact, not history**.~~ **Corrected 2026-09-24: yes.** The owner suspended it; `curl` against `/health` now returns `404` with `x-render-routing: no-server`. `PASSOFF.md` item 9 is `DONE — HANDOFF 14`. `DESIGN.md` §1.5's open-API exposure is history, not current fact, as of this date. | `curl` 2026-09-16; `curl` 2026-09-24 (`HANDOFF.md` 14) |
| Vercel | `https://poker-bar.vercel.app` → 200. Whether a push to `main` redeploys it is **still unanswered**; `D11` binds — treat it as automatic. | `curl` 2026-09-16 |
| Fixed reading overhead | **~53k tokens** for the mandatory set: `AGENT-PRACTICES` ~14k, `DESIGN.md` ~21k, `HANDOFF.md` ~10k, `0001_init.sql` ~5k, `CLAUDE.md` ~2k, `conventions-typescript.md` ~2k. Measured, not guessed. | `wc -c … \| awk '{print $1/4000}'` 2026-09-16 |

**What that overhead means for every band below.** A Default-tier phase has a ~400k ceiling and
starts landing at ~300k (Part 5). Subtract ~53k of mandatory reading and a phase has roughly
**250k of working room**, less whatever its gate output costs — and a red `bun run build` or a
failing test loop is where budgets actually die, so each band below already assumes three or four
red runs.

**One correction to the standard itself, made this session (R5).** `docs/AGENT-PRACTICES.md`
Part 6's fresh-checkout recipe claimed `web/.env.example` names `AUTH_GOOGLE_*`/`AUTH_GITHUB_*`
and omits `NEXT_PUBLIC_VENMO_HANDLE`. It hasn't since HANDOFF step 6 — both files now name the
same three variables. The advice (copy the real file) is unchanged and still right, because the
example carries placeholder values only.

---

## 1. Decisions taken since ratification — `BD-1`…`BD-8`

Build-level calls. Each implements a ratified decision rather than making a new one, and each
carries its reversal. **Two of them exist because `SCOPE.md` §3 carried an option that never
became a GATE 1 question** — flagged as such, so the owner can turn either into a real decision
at GATE 2.

**BD-1 — The bar-and-membership primitive is a `create_bar()` RPC, not a trigger on
`auth.users`.** (`DESIGN.md` §9 gap b, `H4`.) ~~A `security definer` function that inserts the
`bars` row and the owner's `bar_members` row in one transaction, called by the client after
sign-up and by the import with the owner's id.~~ *Why not the trigger:* `D16` and the settled
architecture both expect players to claim accounts later, and a trigger on `auth.users` fires for
**every** signup — so each claiming player would silently get their own bar. *Reversal:* add the
trigger and have it call the same function; the RPC stays either way, because the import needs it.

> **Corrected 2026-09-25 (phase 8, measured against `dev`), three clauses of the struck
> sentence are not what was built.** `create_bar()` is `security invoker`, not definer
> (`supabase/migrations/0001_init.sql:475-495`). The owner's `bar_members` row comes from the
> `bars_owner_membership` trigger on `bars` (`:456-473`, added in phase 1), not from the function,
> so the invariant holds for **any** insert into `bars`. And the function takes no owner id: it
> authorizes by `auth.uid()`, so a service-role caller, which is what `D9`'s import is, is
> refused. `rpc('create_bar')` with the service-role key returned `403` / `42501` "create_bar
> requires an authenticated user" and wrote no row (2026-09-25). The import therefore inserts the
> `bars` row with the service role and asserts that the trigger created the `owner` membership
> (`scripts/import-mongo/bar.ts`). What `BD-1` protects, no bar without its owner's membership,
> holds either way. *Reversal for the import:* sign in as the owner and call `create_bar` there.

**BD-2 — `sessions.played_on` becomes `timestamptz`.** (Gap f, `H6`.) *Why not a second column:*
two columns for "when" is two sources of truth, and the sort order the app relies on would depend
on which one a future query picked. *Reversal:* keep `date` and add `started_at timestamptz`;
the import writes both.

> **Evidence, added 2026-09-16 from phase 2's characterization tests — this BD is load-bearing,
> not tidiness.** `formatDate` parses a bare `YYYY-MM-DD` as **UTC midnight** and renders it in
> the viewer's zone, so west of UTC it shows the **previous day**:
> `formatDate('2026-01-02')` → `"January 1, 2026"` under `TZ=America/New_York`, pinned as a test
> in `packages/core/tests/format.test.ts`. It does **not** bite as of 2026-09-16, because
> `Session.Date` is a Go `time.Time` (`backend/models/barModels.go:43`) and serializes with a
> time and a zone. A `date` column does not: PostgREST serializes it bare. So leaving
> `played_on` as `date` would **introduce** a one-day-early render at all five session-date call
> sites — `sessions/page.tsx:105`, `players/[id]/page.tsx:407`,
> `receipt-ui.tsx:238`, `session/[id]/player/[playerId]/page.tsx:258`,
> `player-receipt/…/page.tsx:274`. A migration that silently moves every session back a day is
> exactly the failure `H5`/`H6` describe.

**BD-3 — `get_menu()` returns a computed `available` boolean, never raw inventory rows.**
(Gap h, `D14`, and the §10 review's recommendation.) *Reversal:* add an `authenticated`-only
variant returning the raw rows; the public one does not change.

**BD-4 — The claim flow is a `security definer` RPC taking a token, not an Edge Function.**
(Gap e, `H10`.) *Why:* it avoids standing up a Deno toolchain and settles the open question of
whether `supabase functions deploy` needs Docker on a machine that has none (§0). *Reversal:*
move to an Edge Function if claiming ever needs to send mail itself.

**BD-5 — One typed Supabase client module; env read exactly once.** `web/lib/supabase/client.ts`
(browser), `server.ts` (server, over `next/headers` cookies), `middleware.ts` — the shape already
proven in `~/Projects/ezhomesteading` (`DESIGN.md` §1.6). This closes the pre-existing D1
violation where `NEXT_PUBLIC_API_URL` is read inline in four places (`DESIGN.md` §1.3).
*Reversal:* inline creation per call site — but then the four-places problem returns under a new
name.

**BD-6 — Row types are generated (`supabase gen types typescript`) and committed into
`packages/core`**, regenerated as part of every schema phase's done-when. *Flagged:* `SCOPE.md`
§3 O9 recommended this and **no GATE 1 question ever asked it**, so it is a build call by
default, not a ratified decision. *Reversal:* hand-written zod schemas per table — at the cost of
two sources of truth for one schema.

**BD-7 — Pure logic moves into `packages/core` first, with characterization tests, before any
Supabase code.** *Flagged:* `SCOPE.md` §3 O6 recommended this and **no GATE 1 question asked it
either**; it entered as scope (`DESIGN.md` §2, "This is"). It is what makes the float→cents
conversion provable (`H5`) and the test gate real (`H8`). *Reversal:* port `web/` straight to
supabase-js and extract later — but then the ledger math moves untested inside a data-layer
rewrite, which is the one silent-failure surface this folder exists to protect.

**BD-8 — Claiming a player row links it to an auth user but does NOT create bar
membership.** Taken during phase 1, 2026-09-16. `claim_player(token)` sets `players.user_id` and
marks the claim link used; it inserts no `bar_members` row. A new `players_self_read` policy lets
the claimed user read their own row, which is the whole privilege claiming confers. *Why:* `D16`
gates writes on membership, and the review that produced `D16` was worried about exactly this
path — if claiming made someone a member, a claimed player would immediately be able to read
every other player's phone number and Venmo handle through `players_read`. Claiming without
membership resolves that completely instead of narrowing it, and leaves `bar_members.role =
'player'` meaning what it says: someone the host has deliberately let in. *Reversal:* have
`claim_player` also insert a `bar_members` row with role `'player'` — one statement — if the
owner ever wants claimed players to see the bar.

**BD-9 — Multi-table writes are `security invoker` RPCs in `0002`, not browser sequences.**
Taken 2026-09-26 at phase 6, asked of the owner and answered the same turn. Saving a drink
(`drinks` + `drink_ingredients`), starting a session (`sessions` + `session_players` +
`buy_ins`) and adding a player mid-session (`session_players` + a buy-in) were each one Mongo
document write; from the browser they would be two or three requests, and a drop between them
leaves, for instance, a drink with no recipe — which `canMake` treats as always makeable, so
every later pour skips its stock decrement with no error. `save_drink`, `start_session`,
`add_session_player` and `D19`'s `delete_session` each run in one transaction, invoker so RLS
still decides. Single-row writes (players, inventory, buy-ins, cashouts, payments, mark-paid)
stay plain table writes under RLS, as phase 6's scope said. *Reversal:* drop the functions in a
later migration and sequence the writes client-side, accepting the partial-write window.

---

## 2. Phases

| # | Phase | Driver | Subagents | Est. context | Why that shape |
|---|---|---|---|---|---|
| 1 | Amend `0001_init.sql` to the ratified design | Opus 5 | one Fable 5.1 review of the final SQL, own worktree | **full** | One file, but it carries ten obligations and the whole RLS surface. `D4`'s edit window closes at first apply, so everything schema-shaped must land here or become a `0002` forever. |
| 2 | Fill `packages/core`; make the test gate real | Opus 5 | none | comfortable | Pure functions and their tests. No Supabase, no project ref — **runs in parallel with phase 1** (Lane B), which is the only real parallelism in this plan and matters because phase 3 is blocked on the owner anyway. |
| 3 | Create the projects; apply `0001` to `dev`; freeze it | Opus 5 | none | comfortable | Mostly the owner's work. The agent's part is applying, re-adding the MCP server read-only, and writing the ledger step that **names the ref and the hash** — the step that ends `D4`. |
| 4 | Swap NextAuth for Supabase Auth; delete the dead auth path | Opus 5 | none | full | One subsystem, clean boundary. `D8` is only coherent once this lands — before it, `auth.uid()` is null and a logged-in host reads nothing. |
| 5 | Port the data layer and every read | Opus 5 | none | **tight** | 15 files, 59 `useSWR` call sites (`DESIGN.md` §1.3). The standard's seam is data-layer-and-reads before writes, and this is already at the 15–20 file signal. **If it runs long it delegates** the mechanical `useSWR` key rewrites to a Sonnet 5 subagent per screen and keeps `bar-api.ts` itself. |
| 6 | Port every write to the RPCs | Opus 5 | none | full | Orders, buy-ins, cashouts, payments, mark-paid. Separate from reads because a wrong write corrupts a ledger and a wrong read only renders wrong. |
| 7 | Port the public surfaces to token RPCs | Opus 5 | none | full | `D8`, `D14`, `D15` plus the route cleanup. Held together because they share one primitive; split from phases 5–6 because these pages are anonymous and their failure mode is a leak, not a blank screen. |
| 8 | Write and rehearse the import on `dev` | Opus 5 | none | full | `D9`. Rehearsed until a per-player balance matches to the cent; not run against `prod` here. |
| 9 | Cutover | Opus 5 | none | full | `D11`. Create `prod`, apply, import for real, deploy, and walk the device pass no gate can see. |
| 10 | Delete `backend/` | Sonnet 5 | none | comfortable | A deletion with citations, in the commit *after* cutover (`D11`). Mechanical by then: nothing imports it. |
| 11 | Realtime | Opus 5 | none | comfortable | `D7`. After cutover, deliberately, so the cutover changed one variable and this changes the second. |

Nothing is planned above `tight`. Phase 5 is the only `tight` one and names its delegation.

**Lanes.** Lane A is the spine: 1 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11. Lane B is phase 2
alone, parallel to phase 1, in its own worktree. They share no file — phase 1 owns
`supabase/migrations/`, phase 2 owns `packages/core/` and the root test config — but **phase 5
imports what phase 2 produces**, so Lane B must be merged before phase 5 starts.

**Why this order, stated so a later session does not "optimise" it:**
1. **`0001` must be completely amended before it is applied anywhere** — `D4` grants in-place
   edits only while it is unapplied, and phase 3 ends that.
2. **Nothing can be imported before the bar-and-membership primitive exists** (`BD-1`, gap b):
   every RLS policy reads `bar_members`, and the import has no owner row to hang a bar on.
3. **Every public page is dark from the moment RLS is on until its RPC exists** (`D8`, `D14`,
   `D15`) — so those RPCs ship in phase 1, and phase 7 only rewires the pages to them.

---

### Phase 1 — Amend `0001_init.sql` to the ratified design

**Status:** `BUILT` 2026-09-16 (HANDOFF steps 12 and 13). 360 → ~840 lines. Applies cleanly to
**PostgreSQL 17.11** — the target major version, since Supabase runs 15+ — and every done-when
proof passes there; see the steps for the numbers. The required Fable 5.1 review found six
must-fix defects; four were fixed and re-proved in step 12, and **both of the two that were
carried are now closed** (step 13):

1. **`on delete` is decided and implemented** — `restrict` on the four ledger tables and on
   `bars.owner_id`, ratified as `DESIGN.md` `D18` after the owner chose it. Proved on PG17: a
   session holding orders refuses to delete, an empty session still deletes cleanly, a player who
   owes money cannot be erased, and deleting the owner's auth user fails instead of taking the
   ledger with it.
2. **The harness moved to the target version.** `postgresql@17` was installed at the owner's
   direction, and all three nullable foreign keys now use PG15's
   `on delete set null (column_list)` — so **every** foreign key in the file is composite and G5
   is complete. Proved: deleting a drink leaves the order standing with `drink_id` null,
   `bar_id` intact and `drink_name` preserved. The file is consequently a **hard syntax error on
   PostgreSQL 14**, which was verified rather than assumed.

Lane A. Files: `supabase/migrations/0001_init.sql` only.

**Scope.**
1. `bars` gains `venmo_handle`, with room for `cashapp_handle` (`D6`).
2. Unique indexes on `players (bar_id, name)` and `cashouts (session_id, player_id)` (`D10`).
3. `player_share_links` gains nullable `session_id`; `get_shared_tab` filters every sub-select by
   it and returns **named columns only** — no `cost_estimate_cents`, no `ingredients`, no
   `counterparty_player_id`, no `note`, no internal FKs, **not the player's own `venmo`** — plus
   the `sessions` array and `bar {id,name}` the pages need (`D15`). Assert
   `v_player.bar_id = v_link.bar_id`.
4. Split every bar-scoped `for all` policy into `for select` on `is_bar_member(bar_id)` and
   write predicates on a new `is_bar_staff(bar_id)` checking `role in ('owner','host')` (`D16`).
5. `create_bar()` per `BD-1`.
6. `get_menu(p_bar_id uuid)` per `BD-3` / `D14`.
7. The claim RPC per `BD-4`, with the 7-day expiry dial (§3).
8. `create_order` gains its missing checks: player in `session_players`, session `status =
   'active'` (§9.1 #6, gap d).
9. `played_on` → `timestamptz` (`BD-2`, gap f).
10. Explicit `revoke`/`grant` on **every** function, plus a default-privilege revoke in `public`
    (§9.1 #4) — and a default `expires_at` on share links, POST-only RPC usage, no
    `replica identity full` (§9.1 #8).
11. Composite FKs `(id, bar_id)` on parents and `(fk, bar_id)` on children (§9.1 #5).
    **Confirmed at GATE 2 (G5): do them now**, while the migration is unapplied and they are
    free, rather than accepting the gap for a single bar.

**Subagents.** One **Fable 5.1** review of the finished SQL, in its own worktree, before the
phase is called done — same trigger as the review that produced `D15`/`D16`: this is the surface
where a mistake compiles, passes every gate, and is wrong in production. Check its diffstat when
it returns; it reviews, it does not edit.

**Done when.** `bun run build`, both `npx tsc --noEmit` runs and `go build ./... && go vet ./...`
still exit 0 — **which prove nothing about this phase**, because no gate in this repo reads SQL.
The real done-when: the amended file **applies cleanly to a scratch Postgres** (`psql` is present,
§0) and, against a hand-seeded bar with two players and one session, a hand-run query proves
(a) a share link scoped to one session returns that session's rows and **zero** rows from a
second session, (b) `get_shared_tab`'s payload contains no `cost_estimate_cents`, `ingredients`,
`note` or `venmo` key, and (c) a `bar_members` row with `role = 'player'` can `select` a drink
and **cannot** insert one.

**Watch for.** The file is unapplied, which is the only reason any of this is legal — re-check
`ls supabase/migrations/` and the MCP config at the start of the phase, and if a project has
appeared and `0001` has run against it, **stop**: everything above becomes `0002` and the phase
is re-planned. Also: never call a Supabase write tool from this repo (`CLAUDE.md`).

---

### Phase 2 — Fill `packages/core`; make the test gate real

**Status:** `BUILT` 2026-09-16 (HANDOFF step 10; hash is the commit the hand-back printed).
Gates: `bun run test` **exit 0, 47 tests in 6 files** — the first tests this repo has had —
`cd packages/core && npx tsc --noEmit` exit 0, `cd web && npx tsc --noEmit` exit 0,
`bun run build` exit 0 (20 routes), `go build ./... && go vet ./...` exit 0, lint unchanged at
105 problems. Lane B, own worktree. Files: `packages/core/**`, root
`vitest.config.ts`, root `package.json`.

**Scope.**
1. A root vitest config that actually finds tests — `bun run test` exits 1 with no
   files and no config as of 2026-09-16 (§0), so until this lands the gate is red-by-default for every later phase
   (`H8`).
2. `computeBalance` in **integer cents**, preserving the convention exactly: drinks + buy-ins −
   cashouts − received + sent, positive means the player owes the house; "settled" becomes
   `=== 0` (`DESIGN.md` §8.2).
3. The settlement optimizer, pure (`D2`).
4. `venmoUrl()` — one builder, one note constant, `Buy-In — <session name>` (`D12`) —
   replacing the three divergent call sites.
5. `formatDate`, `formatTime`, `canMake`.
6. Characterization tests **written before the move** (`conventions-typescript.md` X1).

**Subagents.** None. It is small and the whole point is the reasoning about cents.

**Done when.** `bun run test` **exits 0 having actually run tests** (a count > 0 in the output —
a passing run with zero tests is the failure mode this phase exists to end), and
`cd packages/core && npx tsc --noEmit` exits 0. The proof no gate supplies: a characterization
test that feeds the **float** implementation's own outputs for a fixed table of realistic
amounts into the cents implementation and asserts agreement to the cent, including at least one
value that came from a computation rather than a typed-in price (`H5`).

**Watch for.** `packages/core/tsconfig.json:6` puts `DOM` in `lib`, so `window` type-checks
inside core and the platform-free rule is review-only (`H9`). `openVenmo` moves here as a **pure
URL builder** — the `window.location` half stays in `web/`. Dropping `DOM` from `lib` would turn
the rule into a gate; do it if it costs nothing, and say so if it doesn't.

---

### Phase 3 — Create the projects; apply `0001` to `dev`; freeze it

**Status:** `BUILT` — `HANDOFF.md` step 15, 2026-09-25. Project ref `rxvznjtpskendwhwwgin`,
migration `0001` / `init`, file hash
`a9ef1f921fe44f295a31422c09beafb8f19c3a27bad7ca7d610302ff7ac4a63a`. `D4`'s in-place amendment
window is now closed.

**Scope.**
1. The owner creates **`dev` only** — confirmed at GATE 2 (G2); `prod` is created in phase 9, so
   it does not sit idle and paused for weeks. Two Free projects is the Free-organization
   allowance either way (`D3`, verified 2026-09-16).
2. Re-add the Supabase MCP server **read-only**, pointed at `dev` — confirming the ref is
   Buy-In's by listing its tables and expecting an empty schema, never a farm one
   (`HANDOFF.md`, Known facts; `PASSOFF.md` item 1's procedure).
3. Apply `0001` to `dev`.
4. `supabase gen types typescript` → `packages/core` (`BD-6`).
5. **The ledger step for this phase names the project ref and the file's hash** — that step is
   what ends `D4`'s amendment window. After it, the next number is the only way to change the
   schema.

**Subagents.** None.

**Done when.** The tables exist in `dev` and RLS is on for all thirteen. ~~Corrected 2026-09-25
(HANDOFF step 15): fourteen, not thirteen — this count predates phase 1 adding
`player_claim_links` (`BD-4`).~~ `cd packages/core && npx tsc --noEmit` exits 0 with the
generated types in place. The proof no gate supplies: an anonymous client (anon key) reads
**zero rows** from `players`, and the owner's authenticated client reads their own bar after
`create_bar()` — the `H4` trap, checked rather than assumed.

**Executed 2026-09-25 (`HANDOFF.md` step 15).** All fourteen tables confirmed live with RLS
enabled, via `list_tables` against the real project. `packages/core` typechecks with
`database.types.ts` in place. The anon-reads-zero-rows proof ran as a real anonymous REST call
(not the anon-key row-count phrasing above, which undersold it) and additionally proved the
sharper claim the file's own comments make: a direct anonymous read gets a permission error, not
an empty result. **The authenticated-owner-reads-own-bar half of the `H4` check is not done** —
blocked on email confirmation for a real test sign-up; not worth escalating to the `service_role`
key for, given `create_bar`'s atomicity is already proved twice elsewhere (step 12; this phase's
own local harness). Full account in `HANDOFF.md` step 15, including the `pgcrypto`/`extensions`-
schema defect the real apply caught that local testing could not.

**Watch for.** `.mcp.json` once pointed at another project's production database; the whole
point of GATE 0 was that an unread ref costs a database. Confirm before writing. Free projects
pause after 7 days of low activity (`D3`) — a paused `dev` between sessions is expected, not a
failure.

**Both things phase 1 carried into this phase are now closed** (`D18`, and the PG17 harness) —
this phase waits only on the owner's `dev` project ref. What it must still do before the apply:
re-run the validation suite against the amended file, because the apply is what freezes it
(`D4`).

**The local harness exists and is on the target version.** PostgreSQL 17.11 at
`/opt/homebrew/opt/postgresql@17/bin`, a cluster in the session scratchpad, plus a prelude
stubbing `auth.users`, `auth.uid()` and the realtime publication, a seed, and proof scripts.
**It needs `LC_ALL` set** — PG17 on macOS refuses to start without it, with a misleading
"postmaster became multithreaded during startup".

---

### Phase 4 — Swap NextAuth for Supabase Auth; delete the dead auth path

**Status:** `BUILT` 2026-09-25 — `HANDOFF.md` step 16; commit `6753037` on
`worktree-agent-a3743da35265970c3` (off `05b4718`), not yet merged into `supabase-monorepo`.
**The signed-in half of the runtime walk is owed to the owner** — see
"Executed" below. Lane A. Waited on phase 3. Files: `web/lib/auth.ts`, `web/proxy.ts`, the
login page, the session provider, plus deletions.

**Scope.**
1. Supabase Auth, email and password only (`D5`). No OAuth provider, for the reason in `D5`.
2. `BD-5`'s client modules; `NEXT_PUBLIC_API_URL`'s four inline reads start disappearing here.
3. Delete the dead path outright: `web/lib/api.ts`, `web/components/auth/unified-auth.tsx`,
   `web/types/auth.ts`, `web/models/user.ts` (`DESIGN.md` §1.2 — `UnifiedAuth` is imported by
   nothing).
4. `web/proxy.ts` keeps **exactly** the same public route list (`DESIGN.md` §8.2).

**Subagents.** None.

**Done when.** All four gates green as of 2026-09-16 (§0) still exit 0. The proof no gate supplies: signing
in as a real Supabase user reaches the session list, ~~signing out returns to `/login`~~ signing
out returns to the logged-out landing at `/` *(corrected 2026-09-25, phase 4 build: `/login` was
never where sign-out went — both NextAuth sign-outs landed on `/`, `web/app/page.tsx:56`
`signOut({ callbackUrl: '/' })` and `web/components/shared/button/signout.tsx:7`
`window.location.href = '/'`, both at `05b4718`; `DESIGN.md` §8.2 keeps screen behaviour, so the
port keeps `/`. Reversal: one string in `web/lib/supabase/sign-out.ts`)*, and a
logged-out visit to `/sessions` still redirects — walked in a browser, not inferred.

**Watch for.** The hardcoded `zach`/`7459` (`web/lib/auth.ts:13`) was the only login that existed
as of 2026-09-16; the phase is not done while a code path still accepts it. The 10-year JWT is replaced by
Supabase defaults (§3 dials) — a session that never expires was a convenience for one user.

**Executed 2026-09-25 (`HANDOFF.md` step 16).** Scope items 1–4 built in order. (1) Sign-in is
`signInWithPassword` on the login page, sign-out is `signOut({ scope: 'local' })` then a full
navigation to `/` (`web/lib/supabase/sign-out.ts`), and `SessionProvider`/`useSession` are
replaced by `web/hooks/use-auth-user.ts` (`onAuthStateChange`). (2) `BD-5`'s modules exist —
`web/lib/supabase/{client,server,middleware}.ts`, typed with `@pb/core`'s generated `Database`,
env read once in `web/lib/env/client.ts`; `NEXT_PUBLIC_API_URL`'s inline reads are down from four
to three, the three `DESIGN.md` §1.3 assigns to phases 5 and 7. (3) Deleted: `web/lib/api.ts`,
`web/components/auth/unified-auth.tsx`, `web/types/auth.ts`, `web/models/user.ts`, plus NextAuth
itself — `web/lib/auth.ts` and `web/app/api/auth/[...nextauth]/route.ts` — and the `next-auth`
and `axios` dependencies. (4) `web/proxy.ts`'s six public predicates are unchanged text; the
matcher lost only its `api/auth` exclusion, which existed for NextAuth's handler. Gates: web
`tsc` 0, core `tsc` 0, `bun run build` 0 (19 routes — the 20th was NextAuth's handler), Go build
and vet 0. **Walked in a browser against `dev`:** logged-out `/sessions` → `/login`; `/login` shows
Email/Password; `/` renders the logged-out landing with a clean console. **By `curl`, not a
browser:** all six public prefixes 200 logged-out; eleven protected paths, plus the deleted
`/api/auth/session`, 307 → `/login`; a forged
`sb-rxvznjtpskendwhwwgin-auth-token` cookie still 307s (`getClaims` verifies, it does not trust
presence). **Not walked — owed to the owner:** signing in as a real user, reaching `/sessions`,
signing out. The building agent may not create accounts or type passwords, and `dev` has no
confirmed user (`HANDOFF.md` step 15). Build-level calls are recorded under `DESIGN.md` `D5`,
"As built".

---

### Phase 5 — Port the data layer and every read

**Status:** `BUILT` 2026-09-25 (`HANDOFF.md` steps 18 and 20; `PASSOFF.md` item 14). Built via
`/delegate` — builder subagent, independent Opus 5 audit (NON-BLOCKING FINDINGS, all applied),
merged into the main checkout by the orchestrating session. **Committed `7d2196c`** on
`supabase-monorepo`, 2026-09-26 (bundled with phase 8 — see that phase's status). Lane A. Phase 4
and Lane B (phase 2) satisfied.

**Scope.**
1. Replace `apiFetch` with the typed client (`BD-5`); `bar-api.ts` keeps its row types until they
   come from `BD-6`'s generated file.
2. Rewire all 59 `useSWR` call sites across 15 files to Supabase queries (`DESIGN.md` §1.3).
3. Every screen renders exactly as it does now (`DESIGN.md` §8.2) — including
   `Session.playerIds[]` membership and default-player semantics, and the display order coming
   from the name-sorted player list.
4. The session screen keeps its 15 s poll, now a config constant (`D7`, §3).

**Subagents.** **If the phase runs long** (Part 5's landing rule), delegate the per-screen
`useSWR` key rewrites to **Sonnet 5**, one screen per subagent, own worktree, and keep
`bar-api.ts` and the balance math in the driver. Decide that at the point of overrun, not now.

**Done when.** Four gates exit 0. The proof no gate supplies: with `dev` seeded, the session
screen, the player screen, the summary and `/stats` render the same values they render against
the Go API as of 2026-09-16 — compared side by side for one session, not eyeballed for plausibility.

**Watch for.** This is where money silently changes shape. Every amount arriving from Postgres is
**integer cents** and every existing component expects dollars (`DESIGN.md` §8.2) — `menu/page.tsx:106`
renders `{drink.price}` raw, and it is not the only one. A missed `/100` renders a $12 drink as
$1200 and a missed conversion in the other direction reconciles to nothing. **And dates change
shape in the same way:** if any date reaches `formatDate` as a bare `YYYY-MM-DD` it renders one
day early west of UTC (`BD-2`'s evidence block, pinned in
`packages/core/tests/format.test.ts`). `BD-2` removes the known source; this phase must not
introduce a new one by formatting a date column client-side.

---

### Phase 6 — Port every write to the RPCs

**Status:** `BUILT` 2026-09-27 (`HANDOFF.md` step 24). Code committed `e134e07`; `0002` applied
to `dev` and recorded as version `0002`; types regenerated. Bug 1 proved on `dev`; bug 2's
snapshot-vs-recipe half proved on the PG17 harness only (step 23), accepted by the owner.
~~`IN FLIGHT` 2026-09-26, on Opus 5.5 (the phase's stated Opus 5 — same Default
tier). Lane A. Phase 5 satisfied (`BUILT`, committed `7d2196c`). Adds `0002` (`BD-9`, `D19`).~~

> **Status note, 2026-09-26 (`HANDOFF.md` step 23) — code done, `dev` owed.** Every write is
> ported (19 call sites in 7 files, `web/lib/supabase/writes.ts`); `0002_write_rpcs.sql` is
> written and proved on the PG17 harness (14/14, including both done-when properties below);
> N1 is fixed (keyset pagination in `queries.ts`); all gates green. **Not `BUILT`**, because
> (1) `0002` is not applied to `dev` — the Supabase MCP returned `Unauthorized` (its
> `BUY_IN_SUPABASE_ACCESS_TOKEN` is not in the app's environment); (2) the four `0002` entries
> in `packages/core/src/database.types.ts` were added by hand in the generator's shape and must
> be replaced by a real `supabase gen types` after the apply (BD-6); (3) the done-when's `dev`
> pour-and-undo walk. The two pages' writes are unusable against `dev` until (1).

**Scope.** Orders through `create_order` and `delete_order`; buy-ins, cashouts and payments
through their tables under RLS; mark-tab-paid. `orders.paid` stays a **display flag** and
`computeBalance` keeps ignoring it — the two settlement mechanisms are not unified here
(`DESIGN.md` §8.2).

**Subagents.** None.

**Done when.** Four gates exit 0. The proof no gate supplies: on `dev`, pouring a drink whose
recipe exceeds stock fails **atomically** — no order row, no decremented inventory — which is
the bug the Go API carries at `orders.go:100-138` (`DESIGN.md` §1.2, bug 1); and deleting that order restores stock
from the **snapshot**, not the current recipe (bug 2). Both checked by querying before and after.

**Watch for.** `create_order` is `security invoker`, so a caller without a `bar_members` row
gets "session not found" rather than a permission error — a confusing failure that looks like
missing data. And after `D16`, a `role = 'player'` member cannot write at all; test with a staff
user. **Added by the phase 5 audit (`HANDOFF.md` step 20), N1:** `web/lib/supabase/queries.ts`'s
`selectAll` pages a list by offset, and on the newest-first lists (orders, buy-ins, cashouts,
payments) a write landing between two pages of one fetch can double-count a row or drop one, with
no error — reproduced in simulation (150100 read against a true 150700). This cannot happen
before this phase, since nothing writes to Supabase until now; it becomes live the moment phase 6
ships. Real volumes (35 orders, 120 buy-ins, 74 payments) are far under the 1000-row page size, so
it is unlikely to bite by accident, but it is a real race, not a theoretical one, and belongs on
this phase's list: switch to keyset pagination on `(created_at, id)` — paging oldest-first alone
does not fix the insert case.

---

### Phase 7 — Port the public surfaces to token RPCs

**Status:** `BUILT` 2026-09-27, commit `08e6b24` (`HANDOFF.md` steps 25–26). Gates green; `0003`
applied to `dev` and types regenerated with no drift. **The token proofs were not walked.** The
owner deferred runtime testing to the end on 2026-09-27; they are runtime-pass entries now (step
25's Block B), not seen. Phase 9's phone-receipt proof covers the same ground. As of that date `dev`
holds one portal link, unrevoked and unexpired, and no receipt link.
~~`IN FLIGHT` 2026-09-27, on Opus 5.5 (the phase's stated Opus 5, same Default tier).
Phase 6 satisfied (`BUILT`, `1ed5595`). `HANDOFF.md` step 25. Code committed `08e6b24`.~~

> **Status note, 2026-09-27 — code done, `dev` proof half owed.** All six scope items are built
> and every gate is green. What is proved on `dev` is listed in `HANDOFF.md` step 25: `/menu/<bar>`
> rendering with no session, an anonymous `inventory_items` select refused, and an unknown token
> rendering each page's error state. **Not `BUILT`**, because (1) `0003_venmo_note_template.sql`
> (added this phase, below) is not applied to `dev`, and its types are hand-added; and (2) the
> valid, revoked and expired token proofs need links that only a signed-in host can mint.
>
> **Changed by owner answers, 2026-09-27, asked in one batch before any code (R6):**
> - Item 2 is built **per-bar**: `/menu/[barId]`, not `NEXT_PUBLIC_BAR_ID`. §3's dial is dead.
>   A bare `/menu` sends a signed-in host to their own bar and shows the empty board to anyone
>   else. The logged-out landing's Menu button is gone, because it had no bar to point at.
> - Item 5 is **reuse plus replace**. Sending reuses the player's live link for that scope, and
>   the player page gains **New link**, which revokes every live portal link and mints a fresh one.
> - The receipt's `<title>`/`og:title` is a static `Receipt`, the same reasoning as G4.
> - The Venmo note is host-editable (`DESIGN.md` `D20`, partially superseding `D12`). This added
>   migration `0003`, built by an Opus subagent in its own worktree and merged here.
>
> **`BD-10` — the public routes carry the token and nothing else.** `/receipt/[token]`,
> `/portal/[token]`, `/player-receipt/[token]`. Item 4 named only the last two, but the receipt
> had no token at all, and adding one beside `[sessionId]/[playerId]` would recreate the
> trust-the-URL problem item 4 removes. A page shown a link of the other scope renders its
> error state (`requireScope`, `packages/core/src/shared-tab.ts`). *Reversal:* none sensible.
> The old routes are dead under `D8` regardless.

**Scope.**
1. `/receipt/[sessionId]/[playerId]`, `/portal/*`, `/player-receipt/*` read through
   `get_shared_tab` with a session-scoped or portal-scoped token (`D8`, `D15`).
2. `/menu` reads `get_menu` (`D14`, `BD-3`); `NEXT_PUBLIC_BAR_ID` in env (§3).
3. Delete the unauthenticated portal-token mint at `receipt-ui.tsx:14-17`.
4. Drop the `[playerId]` segment from `/portal` and `/player-receipt` — under `D8` the token
   determines the player, and a route segment the page still trusts invites it to believe the
   URL over the RPC (§9.1 #7).
5. The host gets a way to mint and re-send links, since every link already sent dies (`D8`).
6. **Delete `receipt/…/opengraph-image.tsx`** — confirmed at GATE 2 (G4). It renders a player's
   name, drinks and total into an image that link-preview bots fetch and cache, so a revoked
   link stays previewable; it is the one surface where `D8`'s revocability cannot be made real.
   Texted links lose their rich preview, which is the accepted cost.

**Subagents.** None.

**Done when.** Four gates exit 0. The proof no gate supplies, all against `dev`: a valid
session-scoped token renders that night's receipt and **no other session's rows**; a revoked
token renders the error state; an expired token renders the same error with no distinguishing
detail; and `/menu` renders with **no session at all** while a raw anonymous `select` on
`inventory_items` still returns zero rows.

**Watch for.** These pages are the leak surface: they are the only ones an anonymous caller can
reach, and a mistake here is a disclosure rather than a blank screen. Nothing in this phase adds
an `anon` policy — if one seems necessary, that contradicts `D8` and goes to the owner (R12).

---

### Phase 8 — Write and rehearse the import on `dev`

**Status:** `IN FLIGHT` 2026-09-25 (`PASSOFF.md` item 15, run via `/delegate`, ahead of phases
5–7 at the owner's explicit request — the option this status line always named). Lane A. Phase 3
(schema on `dev`) is satisfied (`DONE — HANDOFF 15`); running in parallel with phase 5, which is
also `IN FLIGHT` — no file overlap (phase 5 owns `web/`, this owns `scripts/` and a new Supabase
auth user).

**Status:** `BUILT` 2026-09-25 (`HANDOFF.md` steps 19, 21). Built via `/delegate` across four
rounds — initial build and rehearsal, an audit that found the re-run safety claim false, a fix,
an audit that found the fix's own recovery path unsafe (`B1`), a second fix, and a final audit
that closed clean. Rehearsed twice against real `dev` data; a third, independent audit
reproduced the fix's safety property on its own harness. **Committed `7d2196c`** on
`supabase-monorepo`, 2026-09-26 (bundled with phase 5, since both amended `DESIGN.md`/`PLAN.md`
in the same working tree — see `HANDOFF.md` step 22).

**Scope, corrected 2026-09-25 against what was actually built (R5 — this paragraph described the
plan, not the code, as of the last audit):** the `scripts/import-mongo/` bun script, taking the
owner's `auth.users` id as an argument, reading Mongo **directly via `DATABASE_URL`** — not
through the Go API, which `D13` takes down — and writing Postgres through the service role.
`create_bar()` is **not** called (see `BD-1`'s 2026-09-25 correction above): the script inserts
`bars` directly and asserts the `bars_owner_membership` trigger created the owner's membership,
because `create_bar()` refuses a service-role caller. Dollar amounts a person typed use `toCents`
(`@pb/core`); computed values (`cost_estimate`, `$inc`'d quantities) use a separate rounding path
per `H5` — never `Math.round(x * 100)` uniformly across both. Mongo timestamps written
**explicitly** into every `created_at` (`H6`, gap g). Never committed with credentials.
Idempotency is `D9`'s 2026-09-25 amendment, not a literal truncate-and-reload — see there for the
three-path mechanism (`load`/`keep`/`replace`) a re-run actually takes.

**Subagents.** None in the original build; the two safety-fix rounds and every audit ran as
separate `/delegate` rounds, each its own subagent in its own worktree, not a subagent of this
phase's own build step.

**Done when.** The script runs twice in a row on `dev` with identical results (that is what
idempotent means here) — proved twice: the original rehearsal (byte-identical snapshots, sha256
matched) and again after the safety fix, on an independent harness. The proof no gate supplies:
**every player's balance matches to the cent** before and after — tolerance 0, per the dial —
computed from Mongo on one side and from `get_shared_tab` on the other (20/20 players matched);
plus the first and last order of a sampled session keep their order, proving the timestamps were
written rather than defaulted; plus both `D10` unique indexes hold on real data (they did — 0
real rows rejected, so there was nothing for the owner to decide). **A fourth proof was added
after the fact, not in the original done-when:** a re-run against the wrong owner, or against a
bar the app has since written to, must refuse without `--force` and touch nothing — closed in
round 3, reproduced independently in round 4.

**Watch for.** `toCents` is right for values a human typed as dollars and cents and
wrong for any value that was computed — `cost_estimate` and `$inc`'d quantities especially
(`H5`). Check those separately rather than trusting one rounding rule across every column.

---

### Phase 9 — Cutover

**Status:** `PLANNED`. Lane A. Waits on phases 7 and 8, and on the owner (`prod`, and the backup
question in §7).

**Status:** `BUILT` 2026-09-27, `main` at `f956408` (`HANDOFF.md` step 28). Deployed on
Vercel from `main`. The balance match was run read-only: 16/20 exact, 4/20 differ only by
2026-09-26 rows, 0 unexplained. The live worker precaches Vercel's own build, and every file it
names returns 200. The owner walked it on a phone: the PWA updated, a texted receipt showed only
that night and player, **New link** killed the old portal link, and the receipt loaded logged
out. Not seen: an expired link.

**Status note 2026-09-27 (`HANDOFF.md` step 28):** `IN FLIGHT`. No new project: the owner made
`dev` (`rxvznjtpskendwhwwgin`) production (`DESIGN.md` `D3`, superseded 2026-09-27).

**Corrected 2026-09-27 (R5, `HANDOFF.md` step 28) — the scope below is stale in four places:**
1. ~~"Create `prod`"~~ — none is created; `rxvznjtpskendwhwwgin` is production.
2. ~~"apply the frozen `0001`"~~ — it already carries `0001`, `0002`, `0003`, recorded in
   `supabase_migrations.schema_migrations` (`HANDOFF.md` steps 15, 24, 26).
3. ~~"run the import **once**"~~ — it does not run: the phase 8 rehearsal's rows are the
   production rows, and the balance match this phase owes was run read-only on 2026-09-27
   against them — 16/20 exact, 4/20 differ only by rows since 2026-09-26, 0 unexplained
   (`DESIGN.md` `D9`, amended 2026-09-27). The `mongodump` is still taken before Atlas is
   decommissioned (`D17`, amended).
4. ~~"Regenerate the PWA workers"~~ cannot mean committing regenerated files: the worker
   precaches build-ID paths (`/_next/static/<BUILD_ID>/_buildManifest.js`, read from a local
   `next build --webpack`, 2026-09-27), so a locally built `sw.js` names a build Vercel never
   produces and would never install. Next 16's `next build` is turbopack and next-pwa does not
   run under it (`H7`), so the owner chose `web/package.json` `build` = `next build --webpack`,
   making Vercel's own build write the worker.

**Scope.** Create `prod` (`D3`, G2); apply the frozen `0001`; **take the `mongodump` first** —
immediately after the last session played on Mongo and **before** the import, so the archive is
provably what was imported (`D17`); run the import **once**; point the deployed web at `prod`.
Regenerate the PWA workers and verify the update on a real device (`H7`).

**Rollback, as amended by `D17`:** restore the dump to a reachable MongoDB, re-point the env,
redeploy the previous commit. Mongo is **not** left running after cutover — so the dump is the
only fallback that exists, and a phase that skips it has removed the rollback rather than
postponed it.

**Subagents.** None.

**Done when.** Four gates exit 0 on the merge commit. The proofs no gate supplies: the per-player
balance match from phase 8, re-run against `prod`; a receipt link opened **on a phone, from a
text message**, rendering the right night; and the installed PWA picking up the new service
worker rather than serving cached Go-API responses — which needs a device, not a build.

**Watch for.** `D11` binds the whole phase: until the owner verifies otherwise, **a push to
`main` is a deploy**, so nothing half-ported reaches `main` before this phase. The import runs
after the last session played on Mongo — anything poured between import and cutover has to be
re-entered by hand.

---

### Phase 10 — Delete `backend/`

**Status:** `BUILT` 2026-09-28 (`HANDOFF.md` step 29). Lane A.

**Scope.** Delete `backend/`, its env, the Go module, the CORS origins, the README sections, and
the last `NEXT_PUBLIC_API_URL` reads. The owner decommissions the Render service and the Mongo
Atlas cluster — recorded, not done by an agent, and **only once phase 9's dump exists** (`D17`).

**As built:** the Render service was already gone (`HANDOFF.md` step 17, 2026-09-25). "Decommission
the Mongo Atlas cluster" turned out to be the wrong shape for this cluster — it is shared with a
second, unrelated live project (`D17`, amended 2026-09-28) — so what happened instead was
`mongodump` (all 8 collections, real counts) kept off-repo, then
`db.getSiblingDB('poker-bar').dropDatabase()` run scoped to `poker-bar` only. The cluster itself
stays up. The `mongorestore --dryRun` proof this phase's done-when named did not run cleanly —
see `DESIGN.md` `D17`'s 2026-09-28 amendment for what was verified instead.

**Subagents.** None. Driver is **Sonnet 5**: by this point it is a deletion with citations.

**Done when.** `bun run build` and both typechecks exit 0; `go build` is gone along with the
directory. The proof no gate supplies: `grep -rn "NEXT_PUBLIC_API_URL\|onrender" web/` returns
nothing, and the deployed app still works with the Go host already down.

**Watch for.** Do not delete `backend/` before cutover is verified — it is the only rollback
target that still has the data in the shape the old app expects.

---

### Phase 11 — Realtime

**Status:** `BUILT` 2026-09-29, commit `a6de0c7` — runtime pass owed (`HANDOFF.md` step 34). `0006` written, unapplied; the owner applies it.

**Scope.** Subscribe the session screen (and whatever else earns it) to the six published tables;
set the poll dial to 0 where a subscription replaces it. State explicitly which surfaces
subscribe and which keep polling.

**Subagents.** None.

**Done when.** Four gates exit 0. The proof no gate supplies: an order poured on one device
appears on a second device without a refresh, and the **anonymous** share pages still work —
they cannot subscribe under RLS at all (`H11`, `D7`), so they keep polling by design.

**Watch for.** RLS is not applied to Realtime DELETE events, so subscribers see deleted-row keys
(§9.1 #8, *unverified* — check it before relying on either reading). Never set
`replica identity full` on the published tables.

---

## 3. Dials

`DESIGN.md` §4's seven carry forward unchanged. Plan-level additions:

| Dial | Default | Why |
|---|---|---|
| Share-link expiry | 30 days; `NULL` for a deliberate permanent link | `DESIGN.md` §4 |
| Claim-link expiry | 7 days | grants write access to a row |
| Share-link token length | 24 random bytes | already in the schema |
| Session refresh interval | 15 s, one constant in core | matches current behaviour; Realtime sets it to 0 |
| Realtime tables | the six at `0001_init.sql:360` | `D7` |
| Auth session lifetime | Supabase defaults | replaces a 10-year JWT |
| Import tolerance | **0 cents** | a ledger off by a cent is wrong |
| ~~`NEXT_PUBLIC_BAR_ID`~~ | ~~the single bar's uuid, in env~~ **Dead 2026-09-27 (phase 7, owner):** the bar is in the URL, `/menu/[barId]`, so no single-bar assumption ships | `D14`/`BD-3` |
| Vitest include | `packages/core/**/*.test.ts` | phase 2; the gate must find files or it proves nothing |

---

## 4. Seams reserved, deliberately not built

So the next effort need not guess whether an omission was considered.

- **Peer-mode UI** — columns and the pure optimizer ship (`D2`); no settle-mode picker, no peer
  settlement screen. Every session is `banked`.
- **Multi-bar UI** — `bar_members` models co-hosts and `D16` makes `role` real, but nothing
  switches bars or invites anyone. One bar is created.
- **A second payment handle** — `bars` gets room for `cashapp_handle` (`D6`); only Venmo is wired.
- **`native/`** — not created as a side effect, not planned here (`D1`).
- **Third-party sign-in** — deliberately absent so no Apple obligation is incurred before native
  exists (`D5`).
- **Account deletion, push, `pg_cron` reminders** — travel with native.
- **The 105 lint findings** — not this effort's (`DESIGN.md` §8.2).
- **A `docs/README.md` index** — owed by the repo, still not this effort's.

---

## 5. Repo hazards, with live numbers (2026-09-16)

- **`bun run test` exits 1 on a clean tree** and will until phase 2. Until then a green test run
  is not evidence of anything.
- **`cd web && bun run lint` exits 1 with 105 problems (13 errors, 92 warnings).** A phase that
  leaves it at 105 has changed nothing; a phase that *raises* it has. Nobody fixes them here.
- **`bun run build` does not lint** — Next.js 16 removed build-time linting outright.
- **The PWA workers are stale and tracked** (2026-04-12 mtimes, unchanged by a build run
  2026-09-16). Never commit a regenerated `sw.js` alongside real work; phase 9 owns them.
- **`.claude/worktrees/` is not gitignored** (`git check-ignore` exits 1). A subagent worktree
  appears as untracked repo state, so `git add -A` would commit a nested checkout. Name every
  path — which is the rule anyway, for three separate reasons now.
- **`HANDOFF.md`, `PASSOFF.md`, `CLAUDE.md`, `docs/AGENT-PRACTICES.md` and
  `docs/conventions-typescript.md` are excluded from git.** Never name one in a commit block.
  `docs/incomplete/` **is** committable.
- **The Go API is still live and open** as of 2026-09-16 (§0). Until item 9 is done, assume
  anything in Mongo is public.
- **No Supabase write tool from this repo** until a Buy-In ref exists, and read-only when it
  returns (`CLAUDE.md`).

---

## 6. Session protocol

- One phase per session. Read `docs/AGENT-PRACTICES.md` — Part 5 for the budget rule, Part 6 for
  the fresh-checkout recipe and the shared-index rules, Part 7 for closing out.
- **Fresh worktree or clone:** `bun install` at the root, copy `web/.env` and `backend/.env` from
  the primary checkout (both gitignored; the examples carry placeholders only), `cd backend &&
  go mod download`. Do not believe a gate before this.
- **The gate set, run from the root unless stated:** `bun run build`; `cd web && npx tsc
  --noEmit`; `cd packages/core && npx tsc --noEmit`; `cd backend && go build ./... && go vet
  ./...`; `cd web && bun run lint` (expect 105 until someone decides otherwise); `bun run test`
  (expect exit 1 until phase 2).
- **Budget:** ~53k of mandatory reading before any work (§0). Measure with the Part 5 script,
  setting its `SENTINEL` to a phrase from your own prompt — several sessions run in this one
  checkout and newest-mtime picks the wrong transcript.
- **Migration numbers come from `ls supabase/migrations/`**, never from a number written here.
- **Never run `git commit`, `git push`, `git add -A` or `git add .`** — print the two blocks and
  name every path. Never `git checkout --` or `git stash`; copy the file aside and restore with
  `cp`.
- **Every phase ends with a ledger step** at the next free number, read from `HANDOFF.md`
  immediately before appending, and updates this file's phase status to `BUILT` with the commit
  hash.

---

## 7. GATE 2 — the batch

Asked in chat, in one message, the turn this document was finished (2026-09-16). Answers are
recorded here with their date. **Once the plan is approved it authorizes the whole run; phases do
not each come back for approval.**

| # | Question | Recommendation | What it changes |
|---|---|---|---|
| G1 | The phases, their order and the two lanes as §2 has them — approved? | **Approve.** The order is forced in three places (§2) and the only parallelism is phase 2 beside phase 1, which is free because phase 3 is blocked on you anyway. | Everything. |
| G2 | Create `dev` and `prod` now, or `dev` now and `prod` at phase 9? | **`dev` now, `prod` at phase 9.** A `prod` project sitting empty for weeks earns nothing and pauses after 7 days of low activity; creating it at cutover is one step in a phase that is already careful. | Phase 3's scope; whether phase 9 starts with a creation step. |
| G3 | `prod` on the Free plan has **no downloadable backups**, and it will hold real debts. Paid plan, or free with the Mongo cluster kept as the fallback? | **Free at cutover, with Mongo kept readable until you have played a few nights on Supabase** — then decide. `D11` already keeps Mongo readable, so the fallback exists without paying for it on day one. | Phase 9; when Atlas can be decommissioned. |
| G4 | `receipt/…/opengraph-image.tsx` — delete it, or port it to take the token? | **Delete it.** It renders the player's name, drinks and total into an image that link-preview bots fetch and cache, so a revoked link can still be previewed. It is the one surface where `D8`'s revocability cannot be made real. | Phase 7 scope; whether texted links still show a rich preview. |
| G5 | Composite foreign keys (§9.1 #5) — do them now, or accept the gap for one bar with your signature? | **Do them now.** The file calls itself multi-tenant, they are free in an unapplied migration, and they are an ALTER-plus-backfill once rows exist. | Phase 1 scope. |
| G6 | `BD-6` (generated row types) and `BD-7` (core-first extraction) are build calls on options that **never became GATE 1 questions**. Leave them as build calls, or ratify either as a `D<n>`? | **Leave as build calls.** Both follow from scope already ratified; making them decisions adds ceremony without changing what gets built. | Whether a later session may reverse them without asking. |

**Answers — 2026-09-16**, given by the owner the turn they were asked, recorded the same turn.

| # | Answer |
|---|---|
| G1 | **Approve as written.** The plan authorizes the whole run. |
| G2 | **`dev` now, `prod` at phase 9.** Phase 3's scope narrowed to `dev`. |
| G3 | **Free `prod`, and Mongo decommissioned at cutover** — *departing from the recommendation*, which was to keep Atlas running as the fallback. Because that answer deleted `D11`'s rollback target, a follow-up was asked in the same turn rather than the conflict being resolved here: the owner chose **`mongodump` before decommissioning**. Both halves are recorded as `DESIGN.md` `D17`, which partially supersedes `D11`. |
| G4 | **Delete the OG image.** Phase 7 item 6. |
| G5 | **Composite foreign keys now.** Phase 1 item 11, conditional removed. |
| G6 | **`BD-6` and `BD-7` stay build calls**, not promoted to `D<n>`. A later session may reverse either on its stated reversal without coming back to the owner. |

One answer departed from a recommendation (G3) and it is the only one carrying an owner's reason
rather than this document's; `D17` records the reasoning on both sides.
