-- 0031 — a seated member reads the host's pay handles for their own tables (2026-09-29).
-- UNAPPLIED: the owner applies it.
--
-- Member Home now shows what the member owes at each table and a Pay button. The button needs
-- the host's Venmo and Cash App handles and the host's Venmo note template, which live on
-- `bars`. `bars_member` only lets bar members read that row, and a seated player is not one, so
-- the portal link has been the only way a player ever got them (get_shared_tab, 0001/0003).
--
-- This hands out exactly what a portal link already hands out — venmo_handle, cashapp_handle,
-- venmo_note_template — and nothing else: no phone, no email, no other player. Scoped to
-- players.user_id = auth.uid(), the boundary get_my_tables (0010) uses, so a null uid matches no
-- row and an account only ever reads the tables it sits at. Bars the caller is a member of are
-- left out, as get_my_tables leaves them out: a host does not pay themselves.
--
-- Reads only. It touches no balance and writes nothing.

create function get_my_table_pay_info()
  returns table (bar_id uuid, venmo_handle text, cashapp_handle text, venmo_note_template text)
  language sql security definer stable set search_path = public, pg_temp
as $$
  select b.id, b.venmo_handle, b.cashapp_handle, b.venmo_note_template
    from players p
    join bars b on b.id = p.bar_id
   where p.user_id = (select auth.uid())
     and not exists (select 1 from bar_members m
                      where m.bar_id = p.bar_id and m.user_id = (select auth.uid()))
   order by b.id;
$$;

revoke all on function get_my_table_pay_info() from public, anon, authenticated;
grant execute on function get_my_table_pay_info() to authenticated;
