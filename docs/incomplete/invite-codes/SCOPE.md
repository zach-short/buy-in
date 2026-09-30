# Invite codes, and kicking a player — SCOPE

**Status: `IN FLIGHT` 2026-09-29 — `0028` on production (HANDOFF step 73); `0029` (review fixes) written and harness-proved, unapplied (step 74); `0030` (chosen lifetimes), `/join` codes and the kick button are `PASSOFF.md` item 31; web side unshipped.** Opened by an Opus 5.5 session (Default tier; no model was named for the ask). §6 holds what the owner has answered so far; §7 is what is still open.

Owner's asks, 2026-09-29, in order:
1. "make the invite link also generate an invite code. 4 digits that does the same thing and if possible a code that the user can change."
2. At the first question batch: guessing is stopped by **both** a wrong-try limit and 24-hour codes, and "allow a table host to kick a user and when they do rotate the code/link. But dont let the table host kick someone until their balance is even".
3. "the user should have the choice when creating the link between just a code. a link, and if the code is 4-6 digits".

Vocabulary is the repo's: a **table** is a bar, a **standing invite** is a `bar_invite_links` row with `scheduled_game_id` null. A **code** is the new short alias for one invite's token.

## 1. What exists, verified 2026-09-29

| # | Claim | Verified state | Citation |
|---|---|---|---|
| 1 | An invite is a `bar_invite_links` row whose `token` (24 random bytes, hex) is the credential; 30-day expiry; staff-only RLS | | `0004_onboarding.sql:65-81,107` |
| 2 | Every invite consumer takes the token: `join_bar_as_player`, `rsvp_scheduled_game`, `list_claimable_players`, `request_player_claim`, `get_rsvp_game`, `get_invite_preview` (anon) | | `0004:190-270`; `0005`; `0008:103,147`; `0012:30,73`; `0026:41` |
| 3 | **`/join` already has a "typed code" box — but the "code" is the whole 48-char token.** Signed-out visitors round-trip `/login` with `?code=` | | `web/app/join/page.tsx:14-62` |
| 4 | The owner rule "a member reaches a table only through an invite link or code — a bar's name is never discoverable" | a 4-digit space (10,000, shared by every bar) is guessable, which is why §6 A1 exists | `web/lib/supabase/join.ts:5-8`; `0004:6` |
| 5 | **Nothing limits guessing today.** No attempts table, no rate limit | absence | `grep -n -i "brute\|guess\|rate.limit" HANDOFF.md` and `grep -rn "attempt" supabase/migrations` → nothing relevant, 2026-09-29 |
| 6 | `/invites` lists standing invites with Share and Revoke; Share sends the bare link through `shareOrCopy` | | `web/app/invites/page.tsx:47-83`; `web/lib/supabase/standing-invites.ts:78` |
| 7 | **A host can already unlink an account from a player with no balance check** — that is the tool for fixing a wrong claim, so it must stay ungated | kick is a new action, not a gate on this one | `0008:325-340`; `web/hooks/use-player-account.ts:41` |
| 8 | The balance exists in SQL: `player_balance_cents`, positive = player owes the house; `leave_table` gates on it under `FOR UPDATE` on the players row so a concurrent order cannot slip past | kick copies that shape | `0010_leave_table.sql:1-45` |
| 9 | Migrations `0001`–`0027` are on production; next free number is read from the directory at build time (`0028` as of 2026-09-29) | | `ls supabase/migrations`; `HANDOFF.md` step 71 |

## 2. What this is / what this is not

**This is:** a short code on standing invites, typed on `/join`; a host choosing link-or-code-only and 4–6 digits at creation; a host changing a code; a wrong-try limit and 24-hour codes; a host kicking a player whose balance is exactly $0.00, which also rotates the table's live invites.

**This is not:** codes on game-night invites (§6 A3); a ban list (a kicked account can rejoin if handed a new code); changing `unlink_player` (row 7); a public directory; codes in link previews (`get_invite_preview` stays token-only).

## 5. Hazards

- **H1 — the kick gate is a money path.** A wrong gate compiles, passes every gate and strands a debt on a row nobody holds. It gets a narrow Deep (Fable) review of the migration before the owner applies it.
- **H2 — a "that code is taken" answer on the host's rename is an oracle** for live codes that bypasses the join limit. It counts against the same wrong-try limit.
- **H3 — uniqueness cannot use `now()` in an index predicate.** Expired codes are cleared (set null) before a new code is generated or set, so a unique index on the live ones holds.

## 6. Answered, 2026-09-29

- **A1 — guessing:** both — 5 wrong codes per account per 15 minutes, and a code stops working 24 hours after it is made or changed.
- **A2 — custom code:** 4–8 letters or digits, case-insensitive. (Generated codes are digits only, 4–6 long — A5.)
- **A3 — scope:** table (standing) invites only.
- **A4 — Share copy (R7, "Plain"):** "Join my poker table on Buy-In: <link> — or enter code <code> at <site>/join".
- **A5 — creation:** the host picks link or code only, and a code length of 4–6 digits.
- **A6 — kick:** a host can kick a player only when their balance is even; kicking rotates the table's invite codes and links.

## 7. Open — the second batch

Asked in chat 2026-09-29; answered the same day. Nothing is open.

- **A7 — creation choices:** three — link only, code only, or both. (Supersedes the reading of A5 that a link always carries a code.)
- **A8 — after 24h:** the link keeps working; a code-bearing invite offers "New code" for another 24h. A code-only invite whose code has lapsed is expired. Changing a code by hand restarts its 24h.
- **A9 — rotation on kick:** every live table invite is revoked and replaced by a fresh one of the same kind and length, with a new random code (a custom code is not carried over).
- **A10 — the kicked row:** unlinked (`user_id` null) and archived (`archived_at`, `0014`); history kept.

**GATE 2:** the answers above fix every behaviour, so the build started the same turn without a separate plan-approval round. This was the agent's call, not the owner's; it is recorded here so the owner can object.

## 8. Build decisions

- **BD-1** A code-only invite is a normal row whose link the UI never shows. The token still exists, because every downstream RPC takes a token (§1 row 2). Reverse: add a `kind` check that refuses the token path.
- **BD-2** A code resolves to its token through `resolve_invite_code`, which requires sign-in. The existing join flow then runs unchanged. Reverse: teach each RPC a code parameter.
- **BD-3** Codes are stored upper-cased. The unique index covers live codes only. A lapsed or revoked code is nulled lazily before any code is written (H3).
- **BD-4** The limit counts wrong code lookups *and* host code-rename collisions in one table (H2). The table is pruned after a day.

## 9. The Fable review of `0028`, 2026-09-29 — verdict DO NOT SHIP, arrived after the owner applied it

Read-only Fable 5.1 subagent in its own worktree; nothing edited. Findings, each re-verified by this session before acting:

- **B1 (blocker) — kick's balance gate does not wait for an in-flight edit or delete of an existing ledger row.** Only an *insert* takes FOR KEY SHARE on `players`; an amount UPDATE or a DELETE takes no lock there, and the web does both (`web/lib/supabase/session-edits.ts:25-44`, `payment-edits.ts:18`). `0015` fixed this class for `delete_my_account` by locking the ledger rows (`0015:51-55`); `0028` copied `leave_table`'s weaker shape. Fix in `0029`. **`leave_table` (`0010:72-89`) has the same race, and is left alone by owner choice (Q, 2026-09-29): open, a separate item.**
- **B2 (blocker) — direct table writes bypass every code rule.** Verified on the harness 2026-09-29: as a host, `update bar_invite_links set code = '<another bar's live code>'` answered with a unique violation and no try charged (an unlimited oracle), and `set code = 'IMMORTAL', code_expires_at = '2099-01-01'` succeeded. Fix in `0029`: a guard trigger in `0020`'s `current_user` shape. **Production exposure on 2026-09-29: none known**, because no web build that makes codes is deployed, so production holds no codes. `0029` must be applied before the web ships.
- **S1** the try limit is check-then-insert; parallel calls exceed 5 → advisory lock per account. **S2** the table-wide lazy clear can deadlock two hosts → clear only the row holding the code being written. **S3** set/refresh lock the row before the staff test → test first. All three fixed in `0029`.
- **N1** a kick can fail on "no free 4 digit code" when the space is crowded; left as a loud failure. **N2** a kicked account rejoining under the same name hits `players_bar_name_uniq` (the archived row keeps the name). **N3** a kick does not unseat tonight's `session_players` row. N1–N3 are open for the owner.

## 10. Answered, 2026-09-29 (second change of scope)

- **A11 — chosen lifetimes (supersedes A1's fixed 24-hour code; the try limit stays):** a host picks a link lifetime and a code lifetime from 1 hour, 24 hours, 7 days, 30 days, or never. A "same for both" toggle starts on, so one pick sets both.
- **A12 — ship order:** `0029` = the review's fixes, now; `0030` = chosen lifetimes.
- **BD-5** "Never" is `'infinity'::timestamptz` in `expires_at` / `code_expires_at`, so no not-null or comparison changes; the web reads `infinity` as never. Reverse: a nullable column plus a flag.
- **BD-6** Each invite stores the lifetimes it was made with (`link_lifetime`, `code_lifetime`, null = never), so "New code", a rename and a kick's replacement reuse them. Reverse: always fall back to the defaults.
- **BD-7** The starting pick with the toggle on is a dial in `web/lib/config.ts`, `INVITE_DEFAULT_LIFETIME`, set to 7 days: between the old 24-hour code and 30-day link. The owner did not name one. Reverse: change the dial.
