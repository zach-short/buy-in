-- 0005 — a link-preview lookup for invite links (2026-09-29). UNAPPLIED: the owner applies it.
--
-- Supersedes the "no RPC reveals a bar by its token" stance in web/app/join/[token]/page.tsx.
-- The owner chose on 2026-09-29 to name the table and the game night in the card an invite
-- link unfurls as, for /join/<token> and /rsvp/<token> only. Receipts and portals stay
-- generic (HANDOFF G4) — this function reads bar_invite_links and nothing from a player's tab.
--
-- Accepted cost, stated so the next reader does not have to rediscover it: link-preview bots
-- cache what this returns, so a revoked or expired invite keeps showing the table's name in
-- any chat that already unfurled it. The function itself answers null for a revoked, expired
-- or unknown token — one shape for all three, as get_shared_tab does — so only a cached card
-- outlives the link.
--
-- Anonymous on purpose: the caller is a bot with no session. The token is 24 random bytes
-- (0004), which is the credential; the function returns a name and a date, never an id, a
-- host, a phone number or a headcount.

create function get_invite_preview(p_token text) returns jsonb
  language sql security definer stable set search_path = public, pg_temp
as $$
  select jsonb_build_object(
           'bar_name', b.name,
           'game_name', g.name,
           'scheduled_at', g.scheduled_at,
           'cancelled', g.cancelled_at is not null
         )
    from bar_invite_links l
    join bars b on b.id = l.bar_id
    left join scheduled_games g on g.id = l.scheduled_game_id
   where l.token = p_token
     and l.revoked_at is null
     and l.expires_at > now();
$$;

revoke all on function get_invite_preview(text) from public, anon, authenticated;
grant execute on function get_invite_preview(text) to anon, authenticated;
