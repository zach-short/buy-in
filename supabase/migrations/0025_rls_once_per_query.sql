-- 0025: row-level security is worked out once per query, not once per row (2026-09-29).
-- Written and proven on a scratch PostgreSQL 17.11 cluster only. No agent applied it anywhere
-- else: the owner applies it. Running it a second time stops at guard 1 and changes nothing.
--
-- PRODUCTION WARNING. This project (rxvznjtpskendwhwwgin) is production. Each `alter policy`
-- takes an ACCESS EXCLUSIVE lock on its table until the file commits, so for that moment every
-- read and write on 19 tables waits. The file is catalog changes only and should take well under
-- a second, but apply it at a quiet time, not during a game night. `lock_timeout` below makes it
-- give up after 5 seconds, changing nothing, rather than queue behind a long query while it
-- holds the tables it already locked. Paste the WHOLE file and run it once.
--
-- ── Why ──────────────────────────────────────────────────────────────────────
-- Every bar-scoped policy was `using (is_bar_member(bar_id))` or `is_bar_staff(bar_id)`
-- (0001:390-429, 0004:106-118, 0008:84-87, 0013:104-105). Both are SECURITY DEFINER and take
-- the ROW's bar_id, so Postgres cannot inline them, cannot work them out once, and cannot use
-- them to seek an index: it calls them for every row it looks at, and each call is its own
-- lookup in bar_members. Measured on the scratch cluster, 100,006 orders in 203 bars, read by a
-- host of two of them: `select count(*) from orders` made 199,510 helper calls and took 2002 ms
-- before this file, and 2 calls and 0.2 ms after it.
--
-- ── What changes ─────────────────────────────────────────────────────────────
-- Two new functions return the caller's own bar ids. The 30 policies that called a helper now
-- compare the row to that list: `bar_id = any (array(select my_staff_bar_ids()))`. The
-- sub-select does not mention the row, so Postgres runs it once per query (an InitPlan) and can
-- seek the bar_id indexes (0001:95-289, 0024:20-26) with the result.
--
-- What does NOT change, and must not:
--   * is_bar_member and is_bar_staff stay exactly as 0001:350-373 and 0001:834-837 left them.
--     Eleven functions still call is_bar_staff: 0004:140,168,282,313; 0008:278,334,359,399;
--     0013:286; 0014:100,107; 0017:102. None is touched.
--   * The six policies that never called a helper: bars_owner_write and bar_members_owner_write
--     (0001:391-397, they test ownership, not membership), players_self_read (0001:433),
--     game_rsvps_self_read (0004:111), claim_requests_self_read (0008:88-89),
--     logged_sessions_own (0021:58-60).
--   * Every policy's command, roles and permissive-or-restrictive. No policy is added or
--     dropped, so D16's pairs (0001:399-403) and the staff-only tables stay as they were.
--   * No table, grant, trigger or other function. get_shared_tab, get_menu and every other
--     SECURITY DEFINER function run as the tables' owner, which these policies never applied to.
--
-- ── Build-level calls, each with how to reverse it ───────────────────────────
-- BD-1. `= any (array(select f()))`, not the audit's `in (select f())`. Both run once per
--   query, but `in (select ...)` becomes a hashed SubPlan that can only FILTER: on the same
--   100,006 rows it still read every row and threw 99,504 away. The array form is an index
--   condition. To reverse: swap the expression in every `alter policy` below.
-- BD-2. Two functions with no parameter, not one `my_bar_ids(p_staff boolean)`. With a flag, a
--   staff policy written with `false` hands every member the bar's writes and looks almost
--   identical on the page. A name cannot be mistyped that way, and guard 2 checks it. To
--   reverse: one function with the flag, and `and (not p_staff or role in ('owner','host'))`.
-- BD-3. `alter policy`, not drop and recreate. It can change only the expressions, so the
--   command and roles cannot drift, and no table is without its policy at any point. To
--   reverse: `drop policy` then `create policy` with the same text, in one transaction.
-- BD-4. Two read-only guards. 0011 and 0013 were edited after they were applied (HANDOFF step
--   44), so the files are not proof of what production holds. Guard 1 stops the file unless the
--   30 policies are exactly what the migrations say. Guard 2 stops it unless staff stayed staff.
--   To reverse: delete the two `do` blocks; the temp table can go with them.
-- BD-5. All 30, including the staff-only tables and game_rsvps_staff_read, so that after this
--   file no policy calls a per-row helper and guard 2 can say so. To reverse for one policy:
--   delete its `alter policy` and its row in the list, and relax guard 2's last check.
-- BD-6. The helpers live in `public` with execute for `authenticated`, as is_bar_member does
--   (0001:810-837). They are therefore callable as RPCs and will appear in
--   packages/core/src/database.types.ts when it is next regenerated.
--
-- ── The one behaviour that differs ───────────────────────────────────────────
-- For `authenticated`, nothing: every read and write in the proof below gave byte-identical
-- results before and after. For `anon`, which has execute on neither the old helpers nor the
-- new ones, two things:
--   1. The error names a different function: `permission denied for function my_staff_bar_ids`
--      where it said `is_bar_staff`. `grep -rn "permission denied for function" web packages`
--      finds no code that reads that message (2026-09-29).
--   2. A direct `delete from payment_reports` or `delete from player_claim_requests` raised
--      nothing and deleted nothing; it now raises that error, and still deletes nothing.
--      Neither table has a delete policy, so the planner used to discard the scan, and the
--      helper call with it, before checking who may call it. An InitPlan is checked at start-up.
--      This is the loud failure 0001:815-821 chose on purpose, reached in two more places.
--
-- ── Proven on the scratch cluster, 2026-09-29 ────────────────────────────────
-- 0001-0024 replayed as role `postgres` (not superuser) with Supabase's roles, auth.uid() and
-- default privileges mirrored; this file applied to a copy; the same scripts run against both.
--   * Eleven callers: an owner, a host, a plain member (role 'player'), an owner of one bar who
--     is a plain member of another, a host of two bars, a claimed player who is no member, an
--     owner who is no longer a member of their own bar, a signed-in stranger, a token with no
--     subject, anon, and service_role. Twenty tables. Select, insert (with and without
--     returning), update in place, update that moves a row to another bar (WITH CHECK on the new
--     bar_id), delete, ten write RPCs, and thirteen SECURITY DEFINER functions, get_shared_tab
--     and get_menu among them. 320 statements for each caller, 3,520 in all. Differences: the
--     two above, and nothing else.
--   * Membership gained, lost and demoted in the middle of a transaction, and between two runs
--     of one prepared statement, takes effect on the next statement, as it did before.
--   * For nine signed-in callers and each of 203 bars, is_bar_member and is_bar_staff agree
--     with membership in the new lists.
--   * No recursion: a member reads bar_members through a policy that calls a function that
--     reads bar_members, also with BYPASSRLS taken off the owning role.
--   * Both guards fire: six kinds of hand-edited policy stop the file at guard 1, four kinds of
--     mistake in the file stop it at guard 2, and each time the catalog is left untouched.
--   * Every other function in public (46), every grant, trigger, index and column is identical
--     before and after.
--   * The rollback below, run after this file, leaves pg_policies and pg_proc identical to
--     before it.
-- NOT proven: anything on the hosted project; Realtime (the live session screen subscribes
-- under these policies, 0001:860-869 and 0006); PostgREST over HTTP.
--
-- ── Rollback ─────────────────────────────────────────────────────────────────
-- Restores every policy to its 0001-0024 text and removes the two functions. Run all of it.
-- ROLLBACK-BEGIN
--   begin;
--   set local lock_timeout = '5s';
--   set local search_path = public, pg_temp;
--   alter policy bars_member        on bars        using (is_bar_member(id));
--   alter policy bar_members_member on bar_members using (is_bar_member(bar_id));
--   alter policy players_staff           on players           using (is_bar_staff(bar_id))  with check (is_bar_staff(bar_id));
--   alter policy players_read            on players           using (is_bar_member(bar_id));
--   alter policy inventory_items_staff   on inventory_items   using (is_bar_staff(bar_id))  with check (is_bar_staff(bar_id));
--   alter policy inventory_items_read    on inventory_items   using (is_bar_member(bar_id));
--   alter policy drinks_staff            on drinks            using (is_bar_staff(bar_id))  with check (is_bar_staff(bar_id));
--   alter policy drinks_read             on drinks            using (is_bar_member(bar_id));
--   alter policy sessions_staff          on sessions          using (is_bar_staff(bar_id))  with check (is_bar_staff(bar_id));
--   alter policy sessions_read           on sessions          using (is_bar_member(bar_id));
--   alter policy orders_staff            on orders            using (is_bar_staff(bar_id))  with check (is_bar_staff(bar_id));
--   alter policy orders_read             on orders            using (is_bar_member(bar_id));
--   alter policy buy_ins_staff           on buy_ins           using (is_bar_staff(bar_id))  with check (is_bar_staff(bar_id));
--   alter policy buy_ins_read            on buy_ins           using (is_bar_member(bar_id));
--   alter policy cashouts_staff          on cashouts          using (is_bar_staff(bar_id))  with check (is_bar_staff(bar_id));
--   alter policy cashouts_read           on cashouts          using (is_bar_member(bar_id));
--   alter policy payments_staff          on payments          using (is_bar_staff(bar_id))  with check (is_bar_staff(bar_id));
--   alter policy payments_read           on payments          using (is_bar_member(bar_id));
--   alter policy drink_ingredients_staff on drink_ingredients using (is_bar_staff(bar_id))  with check (is_bar_staff(bar_id));
--   alter policy drink_ingredients_read  on drink_ingredients using (is_bar_member(bar_id));
--   alter policy session_players_staff   on session_players   using (is_bar_staff(bar_id))  with check (is_bar_staff(bar_id));
--   alter policy session_players_read    on session_players   using (is_bar_member(bar_id));
--   alter policy share_links_staff       on player_share_links using (is_bar_staff(bar_id)) with check (is_bar_staff(bar_id));
--   alter policy claim_links_staff       on player_claim_links using (is_bar_staff(bar_id)) with check (is_bar_staff(bar_id));
--   alter policy scheduled_games_staff   on scheduled_games    using (is_bar_staff(bar_id)) with check (is_bar_staff(bar_id));
--   alter policy invite_links_staff      on bar_invite_links   using (is_bar_staff(bar_id)) with check (is_bar_staff(bar_id));
--   alter policy game_rsvps_staff_read   on game_rsvps using (
--     exists (select 1 from scheduled_games g
--              where g.id = game_rsvps.scheduled_game_id and is_bar_staff(g.bar_id)));
--   alter policy claim_requests_staff_read   on player_claim_requests using (is_bar_staff(bar_id));
--   alter policy claim_requests_staff_update on player_claim_requests using (is_bar_staff(bar_id)) with check (is_bar_staff(bar_id));
--   alter policy payment_reports_staff_read  on payment_reports using (is_bar_staff(bar_id));
--   drop function my_bar_ids();
--   drop function my_staff_bar_ids();
--   commit;
-- ROLLBACK-END

begin;

set local lock_timeout = '5s';
-- Names below resolve to public, and pg_get_expr prints them unqualified for guard 1, whatever
-- search_path the session arrived with.
set local search_path = public, pg_temp;

-- ── the list ─────────────────────────────────────────────────────────────────
-- Every policy this file changes, as it must look BEFORE the change. cmd is pg_policy.polcmd:
-- '*' is `for all`, 'r' select, 'w' update. helper is the function 0001-0024 had it call.
-- nested marks the one policy that reaches bar_id through scheduled_games.
create temp table rls_0025_policies (
  tbl text not null, pol text not null, cmd "char" not null, helper text not null,
  nested boolean not null default false, primary key (tbl, pol)
) on commit drop;

insert into rls_0025_policies (tbl, pol, cmd, helper) values
  ('bars',                  'bars_member',                 'r', 'is_bar_member'),  -- 0001:390
  ('bar_members',           'bar_members_member',          'r', 'is_bar_member'),  -- 0001:394
  ('players',               'players_staff',               '*', 'is_bar_staff'),   -- 0001:404
  ('players',               'players_read',                'r', 'is_bar_member'),  -- 0001:405
  ('inventory_items',       'inventory_items_staff',       '*', 'is_bar_staff'),   -- 0001:406
  ('inventory_items',       'inventory_items_read',        'r', 'is_bar_member'),  -- 0001:407
  ('drinks',                'drinks_staff',                '*', 'is_bar_staff'),   -- 0001:408
  ('drinks',                'drinks_read',                 'r', 'is_bar_member'),  -- 0001:409
  ('sessions',              'sessions_staff',              '*', 'is_bar_staff'),   -- 0001:410
  ('sessions',              'sessions_read',               'r', 'is_bar_member'),  -- 0001:411
  ('orders',                'orders_staff',                '*', 'is_bar_staff'),   -- 0001:412
  ('orders',                'orders_read',                 'r', 'is_bar_member'),  -- 0001:413
  ('buy_ins',               'buy_ins_staff',               '*', 'is_bar_staff'),   -- 0001:414
  ('buy_ins',               'buy_ins_read',                'r', 'is_bar_member'),  -- 0001:415
  ('cashouts',              'cashouts_staff',              '*', 'is_bar_staff'),   -- 0001:416
  ('cashouts',              'cashouts_read',               'r', 'is_bar_member'),  -- 0001:417
  ('payments',              'payments_staff',              '*', 'is_bar_staff'),   -- 0001:418
  ('payments',              'payments_read',               'r', 'is_bar_member'),  -- 0001:419
  ('drink_ingredients',     'drink_ingredients_staff',     '*', 'is_bar_staff'),   -- 0001:420
  ('drink_ingredients',     'drink_ingredients_read',      'r', 'is_bar_member'),  -- 0001:421
  ('session_players',       'session_players_staff',       '*', 'is_bar_staff'),   -- 0001:422
  ('session_players',       'session_players_read',        'r', 'is_bar_member'),  -- 0001:423
  ('player_share_links',    'share_links_staff',           '*', 'is_bar_staff'),   -- 0001:428
  ('player_claim_links',    'claim_links_staff',           '*', 'is_bar_staff'),   -- 0001:429
  ('scheduled_games',       'scheduled_games_staff',       '*', 'is_bar_staff'),   -- 0004:106
  ('bar_invite_links',      'invite_links_staff',          '*', 'is_bar_staff'),   -- 0004:107
  ('player_claim_requests', 'claim_requests_staff_read',   'r', 'is_bar_staff'),   -- 0008:84
  ('player_claim_requests', 'claim_requests_staff_update', 'w', 'is_bar_staff'),   -- 0008:86
  ('payment_reports',       'payment_reports_staff_read',  'r', 'is_bar_staff');   -- 0013:104
insert into rls_0025_policies (tbl, pol, cmd, helper, nested) values
  ('game_rsvps',            'game_rsvps_staff_read',       'r', 'is_bar_staff', true);  -- 0004:115

-- ── guard 1: the database is what the migrations say it is ───────────────────
-- Reads the catalog and writes nothing. It raises, which rolls the whole file back, unless
-- every listed policy exists with the command, the roles and the expression 0001-0024 gave it,
-- and no policy outside the list calls either helper. Whitespace is squeezed before comparing,
-- because pg_get_expr lays a sub-select out over several lines.
do $$
declare
  v_bad text;
begin
  select string_agg(format('%s.%s', e.tbl, e.pol), ', ' order by e.tbl, e.pol) into v_bad
    from rls_0025_policies e
    left join pg_policy p
      on p.polrelid = format('public.%I', e.tbl)::regclass and p.polname = e.pol
   where p.oid is null
      or p.polcmd <> e.cmd
      or not p.polpermissive
      or p.polroles <> '{0}'::oid[]
      or regexp_replace(pg_get_expr(p.polqual, p.polrelid), '\s+', ' ', 'g') is distinct from
           case when e.nested then
             '(EXISTS ( SELECT 1 FROM scheduled_games g WHERE ((g.id = game_rsvps.scheduled_game_id) AND is_bar_staff(g.bar_id))))'
           when e.tbl = 'bars' then e.helper || '(id)'
           else e.helper || '(bar_id)' end
      or (e.cmd = 'r') <> (p.polwithcheck is null)
      or (p.polwithcheck is not null
          and pg_get_expr(p.polwithcheck, p.polrelid) <> pg_get_expr(p.polqual, p.polrelid));
  if v_bad is not null then
    raise exception '0025 stopped, nothing changed: these policies are not as 0001-0024 left them: %', v_bad;
  end if;

  select string_agg(format('%s.%s', c.relname, p.polname), ', ' order by c.relname, p.polname) into v_bad
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_depend d on d.classid = 'pg_policy'::regclass and d.objid = p.oid
                    and d.refclassid = 'pg_proc'::regclass
                    and d.refobjid in ('public.is_bar_member(uuid)'::regprocedure,
                                       'public.is_bar_staff(uuid)'::regprocedure)
   where not exists (select 1 from rls_0025_policies e
                      where format('public.%I', e.tbl)::regclass = p.polrelid and e.pol = p.polname);
  if v_bad is not null then
    raise exception '0025 stopped, nothing changed: policies this file does not know call the helpers: %', v_bad;
  end if;
end $$;

-- ── the helpers ──────────────────────────────────────────────────────────────
-- The caller's own bars and nothing about anyone else. No parameter names a user or a bar, so
-- neither function can look up another account's memberships, and what they return the caller
-- can already read through bar_members_member.
--
-- security definer for is_bar_member's reason (0001:344-348): bar_members_member below calls
-- my_bar_ids(), which reads bar_members, and only the table's owner reads it without going
-- back through that same policy. search_path is pinned as 0001 pins it.
create function my_bar_ids() returns setof uuid
  language sql security definer stable set search_path = public, pg_temp
as $$
  select bar_id from bar_members where user_id = (select auth.uid());
$$;

-- D16 (0001:358-373): membership is not authority. The role test is is_bar_staff's, word for
-- word.
create function my_staff_bar_ids() returns setof uuid
  language sql security definer stable set search_path = public, pg_temp
as $$
  select bar_id from bar_members
   where user_id = (select auth.uid())
     and role in ('owner', 'host');
$$;

-- As 0001:834-837 grants is_bar_member and is_bar_staff, for 0001:810-832's reasons: a policy
-- expression runs with the querying user's privileges, so authenticated must keep execute, and
-- the revoke names anon and authenticated because revoking from public alone leaves the
-- platform's explicit grants in place. anon gets nothing, so an anonymous read of these tables
-- stays a loud `permission denied for function`, not an empty list.
revoke all on function my_bar_ids() from public, anon, authenticated;
revoke all on function my_staff_bar_ids() from public, anon, authenticated;
grant execute on function my_bar_ids() to authenticated;
grant execute on function my_staff_bar_ids() to authenticated;

-- ── the policies ─────────────────────────────────────────────────────────────

alter policy bars_member        on bars        using (id     = any (array(select my_bar_ids())));
alter policy bar_members_member on bar_members using (bar_id = any (array(select my_bar_ids())));

-- D16's pairs (0001:399-403): `_staff` is `for all` and is the only one that can authorize a
-- write; `_read` adds select for any member.
alter policy players_staff on players
  using      (bar_id = any (array(select my_staff_bar_ids())))
  with check (bar_id = any (array(select my_staff_bar_ids())));
alter policy players_read on players
  using      (bar_id = any (array(select my_bar_ids())));

alter policy inventory_items_staff on inventory_items
  using      (bar_id = any (array(select my_staff_bar_ids())))
  with check (bar_id = any (array(select my_staff_bar_ids())));
alter policy inventory_items_read on inventory_items
  using      (bar_id = any (array(select my_bar_ids())));

alter policy drinks_staff on drinks
  using      (bar_id = any (array(select my_staff_bar_ids())))
  with check (bar_id = any (array(select my_staff_bar_ids())));
alter policy drinks_read on drinks
  using      (bar_id = any (array(select my_bar_ids())));

alter policy sessions_staff on sessions
  using      (bar_id = any (array(select my_staff_bar_ids())))
  with check (bar_id = any (array(select my_staff_bar_ids())));
alter policy sessions_read on sessions
  using      (bar_id = any (array(select my_bar_ids())));

alter policy orders_staff on orders
  using      (bar_id = any (array(select my_staff_bar_ids())))
  with check (bar_id = any (array(select my_staff_bar_ids())));
alter policy orders_read on orders
  using      (bar_id = any (array(select my_bar_ids())));

alter policy buy_ins_staff on buy_ins
  using      (bar_id = any (array(select my_staff_bar_ids())))
  with check (bar_id = any (array(select my_staff_bar_ids())));
alter policy buy_ins_read on buy_ins
  using      (bar_id = any (array(select my_bar_ids())));

alter policy cashouts_staff on cashouts
  using      (bar_id = any (array(select my_staff_bar_ids())))
  with check (bar_id = any (array(select my_staff_bar_ids())));
alter policy cashouts_read on cashouts
  using      (bar_id = any (array(select my_bar_ids())));

alter policy payments_staff on payments
  using      (bar_id = any (array(select my_staff_bar_ids())))
  with check (bar_id = any (array(select my_staff_bar_ids())));
alter policy payments_read on payments
  using      (bar_id = any (array(select my_bar_ids())));

alter policy drink_ingredients_staff on drink_ingredients
  using      (bar_id = any (array(select my_staff_bar_ids())))
  with check (bar_id = any (array(select my_staff_bar_ids())));
alter policy drink_ingredients_read on drink_ingredients
  using      (bar_id = any (array(select my_bar_ids())));

alter policy session_players_staff on session_players
  using      (bar_id = any (array(select my_staff_bar_ids())))
  with check (bar_id = any (array(select my_staff_bar_ids())));
alter policy session_players_read on session_players
  using      (bar_id = any (array(select my_bar_ids())));

-- Staff only, with no member read: a token is a credential (0001:425-429, 0004:103-107).
alter policy share_links_staff on player_share_links
  using      (bar_id = any (array(select my_staff_bar_ids())))
  with check (bar_id = any (array(select my_staff_bar_ids())));
alter policy claim_links_staff on player_claim_links
  using      (bar_id = any (array(select my_staff_bar_ids())))
  with check (bar_id = any (array(select my_staff_bar_ids())));
alter policy scheduled_games_staff on scheduled_games
  using      (bar_id = any (array(select my_staff_bar_ids())))
  with check (bar_id = any (array(select my_staff_bar_ids())));
alter policy invite_links_staff on bar_invite_links
  using      (bar_id = any (array(select my_staff_bar_ids())))
  with check (bar_id = any (array(select my_staff_bar_ids())));

-- game_rsvps carries no bar_id (0004:84-85), so the test still goes through the game. The
-- shape is 0004:115-118's; only the staff test inside it changed.
alter policy game_rsvps_staff_read on game_rsvps
  using (exists (select 1 from scheduled_games g
                  where g.id = game_rsvps.scheduled_game_id
                    and g.bar_id = any (array(select my_staff_bar_ids()))));

-- Still no insert or delete policy for anyone (0008:75-79).
alter policy claim_requests_staff_read on player_claim_requests
  using      (bar_id = any (array(select my_staff_bar_ids())));
alter policy claim_requests_staff_update on player_claim_requests
  using      (bar_id = any (array(select my_staff_bar_ids())))
  with check (bar_id = any (array(select my_staff_bar_ids())));

-- Read only and staff only; every write stays in 0013's and 0017's functions (0013:42-52).
alter policy payment_reports_staff_read on payment_reports
  using      (bar_id = any (array(select my_staff_bar_ids())));

-- ── guard 2: staff stayed staff, member stayed member ────────────────────────
-- Reads the catalog and writes nothing. It asks pg_depend, the catalog's own record of which
-- functions a policy calls, rather than trusting the text above: a policy that called
-- is_bar_staff must now call my_staff_bar_ids and none of the other three, and one that called
-- is_bar_member must call my_bar_ids. The member helper on a staff policy would hand every
-- member the bar's writes and pass every other gate in this repo; here it raises, and the file
-- rolls back.
do $$
declare
  v_bad text;
begin
  select string_agg(format('%s.%s', e.tbl, e.pol), ', ' order by e.tbl, e.pol) into v_bad
    from rls_0025_policies e
    join pg_policy p
      on p.polrelid = format('public.%I', e.tbl)::regclass and p.polname = e.pol
   where p.polcmd <> e.cmd
      or not p.polpermissive
      or p.polroles <> '{0}'::oid[]
      or (e.cmd = 'r') <> (p.polwithcheck is null)
      or (p.polwithcheck is not null
          and pg_get_expr(p.polwithcheck, p.polrelid) <> pg_get_expr(p.polqual, p.polrelid))
      -- distinct: pg_depend holds one row per expression, so a policy with both USING and
      -- WITH CHECK lists its function twice.
      or (select array_agg(distinct d.refobjid::regprocedure::text)
            from pg_depend d
           where d.classid = 'pg_policy'::regclass and d.objid = p.oid
             and d.refclassid = 'pg_proc'::regclass
             and d.refobjid in ('public.is_bar_member(uuid)'::regprocedure,
                                'public.is_bar_staff(uuid)'::regprocedure,
                                'public.my_bar_ids()'::regprocedure,
                                'public.my_staff_bar_ids()'::regprocedure))
         is distinct from
         array[case e.helper when 'is_bar_staff' then 'my_staff_bar_ids()' else 'my_bar_ids()' end];
  if v_bad is not null then
    raise exception '0025 stopped, nothing changed: these policies did not come out as intended: %', v_bad;
  end if;

  if (select count(*) from rls_0025_policies) <> 30 then
    raise exception '0025 stopped, nothing changed: the list holds % policies, not 30',
      (select count(*) from rls_0025_policies);
  end if;

  select string_agg(format('%s.%s', c.relname, p.polname), ', ' order by c.relname, p.polname) into v_bad
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_depend d on d.classid = 'pg_policy'::regclass and d.objid = p.oid
                    and d.refclassid = 'pg_proc'::regclass
                    and d.refobjid in ('public.is_bar_member(uuid)'::regprocedure,
                                       'public.is_bar_staff(uuid)'::regprocedure);
  if v_bad is not null then
    raise exception '0025 stopped, nothing changed: still calling a per-row helper: %', v_bad;
  end if;
end $$;

commit;
