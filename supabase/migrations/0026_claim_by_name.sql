-- 0026: the name picker on an invite link is opt-in per table, and only the app owner opts in.
--
-- Until now list_claimable_players (0008) returned every unclaimed name at any table whose
-- token the caller held. A new member at an ordinary table should join as themselves and never
-- see who else plays there; only a table the owner marks gets the picker (owner, 2026-09-29).
--
-- claim_by_name is guarded exactly as drinks_allowed is (0020): a trigger refuses anon and
-- authenticated a change, the owner sets it in the Supabase dashboard, which runs as postgres.
-- Kill switch: drop trigger bars_guard_claim_by_name on bars;
--
-- The web treats an empty list as "no names to claim" and shows the ordinary name form
-- (use-claim-flow.ts, viewOf), so a table with the flag off behaves as if it had no unclaimed
-- players. Nothing else about 0008 changes: the body below is 0008's, plus the flag check.
--
-- To turn it on for one table, as postgres:
--   update bars set claim_by_name = true where id = '<bar id>';

alter table bars add column claim_by_name boolean not null default false;

create function bars_guard_claim_by_name() returns trigger
  language plpgsql set search_path = public, pg_temp
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.claim_by_name := false;
  elsif new.claim_by_name is distinct from old.claim_by_name then
    raise exception 'the name picker is set by Buy-In, not by the table'
      using errcode = 'insufficient_privilege',
            detail = format('bar %s: claim_by_name can only be changed by the app owner', new.id);
  end if;
  return new;
end;
$$;

create trigger bars_guard_claim_by_name before insert or update on bars
  for each row execute function bars_guard_claim_by_name();

create or replace function list_claimable_players(p_token text)
  returns table (id uuid, name text, has_pending_request boolean)
  language plpgsql security definer stable set search_path = public, pg_temp
as $$
declare
  v_link bar_invite_links%rowtype;
  v_uid  uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'claiming requires an authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_link from bar_invite_links l where l.token = p_token;
  if not found or v_link.revoked_at is not null or v_link.expires_at <= now() then
    raise exception 'invalid or expired link' using errcode = 'insufficient_privilege';
  end if;

  if exists (select 1 from players p where p.bar_id = v_link.bar_id and p.user_id = v_uid) then
    raise exception 'this account is already at this table' using errcode = 'check_violation';
  end if;

  return query
    select p.id, p.name,
           exists (select 1 from player_claim_requests r
                    where r.player_id = p.id and r.status = 'pending')
      from players p
      join bars b on b.id = p.bar_id
     where p.bar_id = v_link.bar_id and p.user_id is null and b.claim_by_name
     order by p.name, p.id;
end;
$$;
