# Host setup — feature toggles and first-run guide — SCOPE

**Status: `SCOPED` 2026-09-29 — gate answered in full (§7), every recommendation taken.** Proposes and decides nothing until §7. Opened by `/scope` on Sonnet 5.5.
Nothing in `DESIGN.md` is reopened. The working name is **host setup**, not "onboarding" —
`0004_onboarding.sql` and the proxy comments already use "onboarding" for the *player* join-by-invite
flow, and two meanings for one word is how a later session builds the wrong thing.

## 1. What exists, verified 2026-09-29

| # | Claim | Verified state | Citation |
|---|---|---|---|
| 1 | No feature toggle, hide flag or module switch exists anywhere in `web/` or `supabase/` | grep for `onboard\|hide\|hidden\|feature.?flag\|toggle` over `web/app components lib hooks context` hit only unrelated files; `bars` has no such column | `0001_init.sql` `create table bars` (id, name, owner_id, venmo_handle, cashapp_handle, created_at) |
| 2 | Bar settings are columns on `bars`, edited under `bars_owner_write`; there is **no** `bar_settings` table (that name is only an SWR key) | `venmo_note_template` (0003), `default_buy_in_cents` (0004); one `fetchBarSettings` reads both | `0003:22`, `0004:29`, `web/lib/supabase/bar-settings.ts:24-41` |
| 3 | Adding a setting is a proven, small shape: a column, an update function that treats zero rows as "owner only", an SWR hook, a card on `/account/settings` | `useDefaultBuyIn`, `DefaultBuyInSetting`, `updateDefaultBuyInCents` | `web/hooks/use-default-buy-in.ts`, `web/components/shared/default-buy-in-setting.tsx`, `bar-settings.ts:56-63` |
| 4 | Five bottom-nav tabs; Stats, Performance, Inventory, Drinks, Menu, Invites, Settings live as links on `/account` and are "owned" by the Account tab | `MORE_LINKS`; `owns:` list | `web/app/account/page.tsx:9-17`, `web/components/shared/layout/nav-items.ts:21` |
| 5 | **Stats is drinks-only data.** Revenue, cost, profit and margin are sums over `orders` | `fetchOrders`, `sumCents(orders, …)` | `web/app/stats/page.tsx:64,74`; `web/app/session/[id]/summary/page.tsx:48` |
| 6 | **Home's "Last Session" card is drinks-only too** — Revenue / Cost / Profit from that session's orders. A host who serves nothing sees $0 / $0 / $0 | | `web/app/page.tsx:44-95` |
| 7 | **Performance is not a host feature.** It is the signed-in *player's* win/loss, from `get_my_performance` | | `0004:get_my_performance`, `web/app/performance/page.tsx:13` |
| 8 | Drinks reach the live table through `DrinkPickerModal`, `pourDrink`, `undoOrder`, a per-player "Drinks $" line and a paid toggle on the session screen | | `web/app/session/[id]/page.tsx:19,56,233-261,303-311` |
| 9 | **Drinks are part of the money.** A player's balance is orders + buy-ins − cashouts (− payments); the player page, portal, receipts and shared tab all read orders | `playerBalanceCents(id, orders, buyIns, cashouts, payments)`; `get_shared_tab` returns `orders` | `web/app/players/[id]/page.tsx:105-113`, `0003:get_shared_tab` |
| 10 | `/menu/[barId]` is public (guests reach it by a shared link) | `pathname.startsWith('/menu')` | `web/proxy.ts:28` |
| 11 | Sign-up already asks a host three things — table name (required), Venmo, Cash App — then `create_bar`. With Confirm email on, they ride in auth user metadata and the first session-holding page creates the bar | | `web/hooks/use-sign-up.ts:34,51,92`, `web/lib/supabase/pending-bar.ts:3-46`, `0001_init.sql:475` |
| 12 | Default buy-in and the Venmo note exist only under `/account/settings`; a fresh host is never pointed at them | Home has no empty state and no checklist | `web/app/account/settings/page.tsx`, `web/app/page.tsx` |
| 13 | A host and a joined player are different accounts: a player is a claimed `players` row, never staff, has no bar of their own | | `0004:join_bar_as_player` header, decision 2 |
| 14 | Migration state: `0001`–`0007` on disk; `0004` applied to `prod` 2026-09-29; `0005` written unapplied; `0006` written unapplied; **`0007` has no ledger step** (`grep -n 0007 HANDOFF.md` → nothing). Next free number is read from the directory at build time — **`0008` today** ~~`0008`~~ **Corrected 2026-09-29 (R5):** `0008_player_claim_requests.sql` (`PASSOFF.md` item 17) now exists; the next free number is `0009` | | `ls supabase/migrations`; `SCOPE-phase-11.md:29`; `HANDOFF.md` step 34 |
| 15 | `prod` is the only project and holds real balances; agents never write to it; the owner applies migrations in the dashboard | | `CLAUDE.md` "Never do this" |
| 16 | Nothing is in flight: `PASSOFF.md` has no `OPEN` row; `git status` shows only `.claude/` untracked | | `PASSOFF.md` board; `git status --short` |

## 2. What this is / what this is not

**This is:** (A) a per-bar setting that hides the drinks-side features a home host does not use, and
brings them back; (B) a first-run guide that walks a new host through the few settings that make the
app fit their game.

**This is not, whoever asks:**
- Not deleting or migrating any data. Hiding is a view; orders, drinks and inventory rows stay.
- Not changing how a balance is computed. A hidden feature never removes money from a total.
- Not a per-user preference and not per-device — the setting belongs to the bar (§3 T2).
- Not player-side onboarding (that is `0004`, done). Joined players get no toggles and no guide.
- Not roles or staff permissions, and not a multi-bar switcher (`fetchBarSettings` enforces one bar).
- Not a redesign of Settings, Home or the nav. Cards and one Home block are added; the five tabs stay.
- Not the other ideas floated 2026-09-29 (payment reminders, recurring games, install nudge, back-button
  cleanup, empty states) — separate items if wanted.

## 3. Options

### T1 — How many switches?

- **(a) One switch: "I serve drinks."** Off hides Drinks, Menu, Inventory, Stats, the pour UI, drink
  lines on the tab, and Home's Revenue/Cost/Profit card. Defense: it is exactly the sentence a home host
  would say, and rows 5–6 show Stats and Home profit have no meaning without drinks. Against: a host who
  serves drinks but does not track stock cannot hide Inventory.
- **(b) Two switches: "I serve drinks" (parent) and "Track inventory" (child, only offered when drinks
  are on).** Defense: covers the drinks-but-no-stock host at the cost of one row. Against: a dependency
  between switches to explain and test; inventory was the smaller half of the ask.
- **(c) One switch per More link** (Stats, Inventory, Drinks, Menu each). Defense: maximal control.
  Against: rows 5 and 8 make most combinations nonsensical (Stats on, Drinks off) and each one is a state
  to test and a dead link to guard; it is a settings page pretending to be a permissions system.

*Recommend (b).*

### T2 — Where the setting is stored

- **(a) Columns on `bars`** — `serves_drinks boolean not null default true`, `tracks_inventory boolean not
  null default true`. Defense: the house pattern (row 2–3), RLS already covers it, follows the owner across
  devices, and public/RPC code can read it. Against: another `alter table bars` on a table with a security
  definer function (`get_shared_tab`) that lists columns explicitly — nothing there needs the flag.
- **(b) One `features jsonb` column.** Defense: a later toggle needs no migration. Against: no type check, a
  typo silently reads as "off", and the generated `Database` type stops describing it.
- **(c) Browser storage only.** Defense: no migration. Against: per-device, so the host's phone and laptop
  disagree, and it cannot gate the public `/menu` page.

*Recommend (a).*

### T3 — What "hidden" reaches

Common to every option: the Account links, and the Home profit card. The contested part is the rest.

- **(a) Navigation only.** Links disappear; the URLs still work. Defense: smallest. Against: the pour
  button on the live table is the surface a no-drinks host meets most, and a bookmark to `/stats` still
  shows $0.
- **(b) Navigation + the live table + direct URLs.** No pour UI and no "Drinks $" line while off; `/drinks`,
  `/inventory`, `/stats`, `/menu` show a short "turned off — turn it back on in Settings" page instead of a
  404. Defense: the page a host lands on tells them where the switch is. Against: every drink-touching
  screen needs the guard, and a missed one is a bug the gates cannot see.
- **(c) (b) + hide old orders everywhere** (player page, portal, receipts). Defense: total consistency.
  **Against, and it is decisive:** row 9 — those screens show what a player owes. Hiding a drink line that
  is still in the balance makes the receipt disagree with the total. Not recommended.

*Recommend (b), with orders that already exist still shown wherever a balance is shown.*

### T4 — Turning drinks off when orders exist

- **(a) Allow it silently.** Against: the host cannot tell why their tab shows a line they cannot edit.
- **(b) Allow it, and say so at the switch:** "N drinks are already on tabs and will still count." Defense:
  no lost money, no blocked host. *Recommend.*
- **(c) Block it while any session is open.** Against: a host who mis-set it on night one is stuck until
  cash-out.

### G1 — Shape of the first-run guide

- **(a) Full-screen wizard** on first login, blocking the app until finished. Defense: nobody skips it.
  Against: a host arriving from an invite to a game tonight is held hostage; sign-up already felt long
  (row 11).
- **(b) A dismissible checklist card at the top of Home.** Items are derived from data, so nothing per-item
  is stored: *Do you serve drinks?* (sets T1), *Set a default buy-in*, *Add your players*, *Send an invite*,
  *Start a session*. Defense: never in the way, always shows what is left, and needs no route. Against: a
  host can ignore it, so a home host who never answers the drinks question keeps seeing drinks.
- **(c) One question at sign-up, checklist afterward.** Ask "Do you serve drinks?" on the host sign-up
  form (a fourth field) and let the checklist carry the rest. Defense: the drinks answer — the one that
  reshapes the app — is captured before the host sees any drinks UI. Against: `create_bar` and the
  pending-bar metadata both change (row 11), and sign-up is already the longest form in the app.
- **(d) Wizard only for the drinks question, then (b).** A single screen the first time a host lands on
  Home, one question, skippable, then the card. Defense: gets (c)'s benefit without touching sign-up.

*Recommend (d).* The question is one tap, sits on the page they land on, and leaves `create_bar` alone.

### G2 — How "finished" is remembered

- **(a) `bars.setup_dismissed_at timestamptz` (null until dismissed or completed).** Defense: follows the
  bar across devices; one column beside T2's. Against: a second dismissal state alongside the derived items.
- **(b) Auth user metadata.** Defense: no migration (sign-up already uses it, row 11). Against: it is the
  user's, not the bar's, and a user can write it freely.
- **(c) Browser storage.** Against: the card reappears on every new device.

*Recommend (a), with a backfill so every bar that exists at apply time counts as dismissed* — the
owner's own live bar (row 15) must not be greeted as new.

## 4. Dials

| Dial | Recommended | Lives in |
|---|---|---|
| Default for `serves_drinks` on new and existing bars | `true` (nothing hides until asked) | column default |
| Default for `tracks_inventory` | `true` | column default |
| Backfill of `setup_dismissed_at` | `now()` for every existing bar | the migration |
| Checklist items | 5, in the order above | `web/lib/config.ts` |
| Checklist auto-hides when all items done | yes | client |
| Show the drinks question again if skipped | no — it lives in Settings and as checklist item 1 | — |

## 5. Hazards this work walks into

1. **A hide that changes what a player owes.** T3(c) would. Every screen showing a balance must keep
   showing drinks that exist (`players/[id]/page.tsx:105-113`, portal, receipts).
2. **Silent guard gaps.** A missed screen leaves a pour button on a no-drinks table. Nothing in the gates
   sees it; it needs a hand-walk (R10), one per screen in row 8.
3. **Migration on `prod`.** Two-to-three `alter table bars` columns and a backfill, on the only database,
   applied by the owner. It is additive and defaulted, but the backfill is the line to read twice.
4. **Migration numbering.** `0007` has no ledger step; take the next number from the directory at build
   time, not from this document.
5. **The public menu.** `/menu/[barId]` is anonymous (row 10). Honouring the switch there means an anon-
   readable flag or an RPC, which `D8` ("no `anon` policy anywhere") forbids the easy way. The likely
   answer is that the menu simply renders empty when the bar has no drinks — to be decided at the gate.
6. **Naming.** "Onboarding" already means the player join flow (`0004`, `proxy.ts:12-19`); use "host
   setup" in code, comments and the ledger.
7. **Realtime.** The session screen's subscription includes `inventory_items` on `bar_id`
   (`use-session-realtime.ts`); it can stay as is — a hidden feature still exists in the data.

## 6. Open questions — the gate batch

Asked in chat the turn this is finished. Recommendations are marked in §3.

1. **T1** — one switch, two (parent + inventory), or per-link? *Recommend two.*
2. **T2** — columns on `bars`, jsonb, or browser storage? *Recommend columns.*
3. **T3** — navigation only, nav + table + direct URLs, or hide old orders too? *Recommend nav + table +
   direct URLs; old orders stay wherever a balance shows.*
4. **T4** — silent, warn, or block when orders exist? *Recommend warn.*
5. **G1** — wizard, checklist card, sign-up question, or one-question screen then card? *Recommend the last.*
6. **G2** — bar column, user metadata, or browser storage? *Recommend a bar column, backfilled dismissed.*
7. **Public menu** with drinks off — render empty, or leave it reachable? *Recommend render empty.*
8. **Copy** (R7). Not yet settled anywhere. The drinks question:
   - *plain* — "Do you serve drinks at your games?"
   - *warm* — "Will there be drinks on the tab?"
   - *terse* — "Serving drinks?"

   And the turned-off page:
   - *plain* — "Drinks are turned off for your table. Turn them on in Settings."
   - *warm* — "You've got drinks switched off. You can bring them back any time in Settings."
   - *terse* — "Drinks are off. Settings → Drinks."

   Which register for each?
9. **Model.** Build on Opus 5 (a missed guard is loud on the screen, not silent), with one narrow Deep
   review of the "a hide never changes a balance" path — the only place a mistake compiles, passes every
   gate and is wrong in production (`AGENT-PRACTICES.md` Part 4). Confirm, or assign otherwise.

## 7. Answers

Answered 2026-09-29, in chat, every recommendation taken:

| Q | Answer |
|---|---|
| 1 T1 | Two switches: "I serve drinks" (hides Drinks, Menu, Stats, pour UI, Home profit card) and "Track inventory" (child, offered only when drinks are on) |
| 2 T2 + 6 G2 | Columns on `bars`: `serves_drinks`, `tracks_inventory`, `setup_dismissed_at`; existing bars backfilled dismissed. Migration is the next free number (`0008` on 2026-09-29), applied by the owner |
| 3 T3 | Nav + live table + direct URLs ("turned off" page); existing orders still shown wherever a balance shows |
| 4 T4 | Allow turning drinks off, with a warning that existing drinks still count |
| 5 G1 | One skippable drinks question on first landing on Home, then a dismissible checklist card |
| 7 | Public `/menu` renders empty when drinks are off |
| 8 | Warm register for both the drinks question and the turned-off page |
| 9 | Opus 5 builds; one narrow Fable 5.1 review of "a hide never changes a balance" |

Next: a `PLAN.md` for this folder (phases, done-whens, hand-walk list per row 8), then a `PASSOFF.md` item.
