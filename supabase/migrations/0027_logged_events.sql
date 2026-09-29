-- 0027 — logged events: a player's own record of any result that is not poker — blackjack, a
-- sports bet, a night on the slots (2026-09-29). Written 2026-09-29, UNAPPLIED: the owner
-- applies it.
--
-- docs/incomplete/log-events/, phase 1 (PASSOFF.md item 27). "log an event should probably
-- allow for a bunch of different events like Poker, Black Jack, Sports Betting etc." (the owner,
-- 2026-09-29). The owner's answers (SCOPE.md §7, 2026-09-29) fix the shape:
--   1. One generic table (SCOPE K1(a)). The money columns are real and every type shares them;
--      the extras one type has and another does not (a sport, a bet type, American odds, a table
--      minimum) live in `details`, checked by a zod schema per type in @pb/core
--      (packages/core/src/event-types.ts). A new type is a registry entry there, never a
--      migration, so the database checks only the slug's format.
--   2. Poker stays in logged_sessions (0021), untouched. `event_type <> 'poker'` is a check here
--      so a game can never have two homes and count twice on the Everything tab (SCOPE H3).
--   3. Net is payout minus stake, won-positive, the same way round as 0021's cash-out minus
--      buy-in. Nothing here computes it; the web does (event-result.ts, eventNetCents).
--   4. A $0 stake is a real result — a free bet or promo credit that paid $25 (SCOPE Dial 6) —
--      so the rule is that something moved: `stake_cents > 0 or payout_cents > 0`. Not
--      `stake_cents + payout_cents > 0`: integer addition raises "integer out of range" near
--      2^31, so a legal pair of amounts would be refused with an overflow error (PLAN §0 row 13).
--   5. `details` is always a json object, capped at 2 KB (SCOPE Dial 5): a jsonb column with no
--      cap is a place to park anything.
--
-- Buy-In records; it never holds, moves or settles money, quotes odds or talks to a book
-- (SCOPE §2). No bars, players, sessions, buy_ins or cashouts row is written here, so no
-- balance, settle-up, receipt or host screen can ever see one.
--
-- ── Who can read and write: the owner of the row, and nobody else (SCOPE H7) ─
-- 0021's wall, copied. One policy for all four verbs, keyed on user_id = auth.uid() in both
-- USING and WITH CHECK; WITH CHECK is what stops a player writing a row onto someone else's
-- account. No security definer function: the policy is the whole boundary, and a mistake in it
-- fails loudly. No host, staff or anon read exists. A gambling record is personal financial
-- data.
--
-- The table states its own grant after revoking everything (0021): a stack's default
-- privileges can hand authenticated TRUNCATE, which ignores RLS. anon gets nothing.
--
-- Account deletion needs no change: delete_my_account (0015) ends with `delete from
-- auth.users`, and user_id cascades.
--
-- Kill switch (reads and writes stop, rows are kept; the Everything tab then errors loudly):
--   revoke select, insert, update, delete on table logged_events from authenticated;
-- Full rollback, which destroys every logged event: drop table logged_events;

create table logged_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- The registry decides which slugs exist; the table only refuses a malformed one, and poker.
  event_type     text not null check (event_type ~ '^[a-z][a-z0-9_]{0,39}$' and event_type <> 'poker'),
  -- BD-2 (0001): timestamptz, not date. The form stores a picked day as local noon, as 0021's
  -- does, so it renders as the same day in every US time zone.
  played_on      timestamptz not null,
  -- The casino or the book. Optional: a lottery ticket or an online bet may have none.
  place          text check (place is null or char_length(btrim(place)) between 1 and 100),
  -- What the player called it. Required for "Other" by the registry, not by the table.
  title          text check (title is null or char_length(btrim(title)) between 1 and 100),
  -- "Put in" and "Got back (with your stake)" (SCOPE Q3). Zero back is a real result: a loss.
  stake_cents    integer not null check (stake_cents >= 0),
  payout_cents   integer not null check (payout_cents >= 0),
  minutes_played integer check (minutes_played > 0),
  note           text check (char_length(note) <= 500),
  details        jsonb not null default '{}'
                 check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 2048),
  created_at     timestamptz not null default now(),
  constraint logged_events_amount_check check (stake_cents > 0 or payout_cents > 0)
);
create index logged_events_user_played_idx on logged_events (user_id, played_on);

alter table logged_events enable row level security;

create policy logged_events_own on logged_events for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on table logged_events from public, anon, authenticated;
grant select, insert, update, delete on table logged_events to authenticated;
