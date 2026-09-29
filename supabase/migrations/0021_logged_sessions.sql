-- 0021 — logged sessions: a player's own record of a game played away from any table
-- (2026-09-29). Applied to production 2026-09-29 by the owner.
--
-- docs/incomplete/logged-sessions/, phase 1 (PASSOFF.md item 23). A player who also plays at a
-- casino wants one P&L: "if i played 2/5 at Rivers Casino in Norfolk and was in for 300 and out
-- for 500 that adds to my P&L" (the owner, 2026-09-29). The owner's answers (DESIGN.md D1–D8,
-- 2026-09-29) fix the shape:
--   1. Its own table, owned by one account (D1). Not a hidden per-player bar: every home-game
--      money row needs a bar (0001), and a bar the player owns would make member-home read them
--      as a host, list the fake table in get_my_tables, and be deleted with every real one by
--      delete_my_account. No bars, players, sessions, buy_ins or cashouts row is written here,
--      so no balance, settle-up, receipt or host screen can ever see one (D7).
--   2. get_my_performance (0004) is not touched (D2). The web merges the two reads; the
--      game-stakes effort is about to drop and re-create that function, and the two efforts
--      should never edit one security definer signature.
--   3. Stakes are blinds in integer cents, the shape game-stakes will give sessions (D3):
--      "2/5" is 200/500. Straddle and game format are optional.
--   4. Hours and a note, both optional (D4). Hours are whole minutes; nothing here is a float
--      (0001's rule for money, kept for time too).
--
-- ── Who can read and write: the owner of the row, and nobody else (D8) ───────
-- One policy, for all four verbs, keyed on user_id = auth.uid() in both USING and WITH CHECK.
-- WITH CHECK is what stops a player inserting or updating a row onto someone else's account;
-- USING alone would admit it. There is no security definer function: the policy is the whole
-- boundary, and a mistake in it fails loudly (permission denied, or rows missing) rather than
-- leaking. No host, staff or anon read exists — a casino game belongs to no table.
--
-- The table states its own grant (HANDOFF.md invariant, 0019): a policy with no grant reads as
-- permission denied. anon gets nothing.
--
-- Account deletion needs no change: delete_my_account (0015) ends with `delete from auth.users`,
-- and user_id cascades.

create table logged_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- BD-2 (0001): timestamptz, not date. The form stores a picked day as local noon
  -- (logged-sessions PLAN.md BD-4) so it renders as the same day in every US time zone.
  played_on         timestamptz not null,
  venue             text not null check (char_length(btrim(venue)) between 1 and 100),
  -- Blinds are required: a casino cash game always has them (PLAN.md BD-2).
  small_blind_cents integer not null check (small_blind_cents > 0),
  big_blind_cents   integer not null check (big_blind_cents >= small_blind_cents),
  straddle_cents    integer check (straddle_cents > 0),
  game_format       text check (char_length(game_format) <= 40),
  -- In for is the whole amount brought to the table that session; rebuys are not itemized.
  buy_in_cents      integer not null check (buy_in_cents > 0),
  -- Zero is a real result: the player busted.
  cash_out_cents    integer not null check (cash_out_cents >= 0),
  minutes_played    integer check (minutes_played > 0),
  note              text check (char_length(note) <= 500),
  created_at        timestamptz not null default now()
);
create index logged_sessions_user_played_idx on logged_sessions (user_id, played_on);

alter table logged_sessions enable row level security;

create policy logged_sessions_own on logged_sessions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Revoke everything first, then grant exactly the four verbs. Default privileges differ between
-- stacks: on the local stack (2026-09-29) a new table arrived with TRUNCATE, REFERENCES and
-- TRIGGER for authenticated as well, and TRUNCATE ignores RLS.
revoke all on table logged_sessions from public, anon, authenticated;
grant select, insert, update, delete on table logged_sessions to authenticated;
