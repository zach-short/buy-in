-- 0007 — does this email already have an account (2026-09-29). UNAPPLIED: the owner applies it.
--
-- Backs the one-field login: the visitor types an email, and this answers whether to ask for a
-- password (an account exists) or to open the onboarding form (none does). Supabase Auth has no
-- client call for this — signInWithPassword answers "Invalid login credentials" for a missing
-- user and a wrong password alike.
--
-- Accepted cost, stated so the next reader does not have to rediscover it: an anonymous caller
-- can learn whether a given address is registered. That is what the one-field flow is, and the
-- owner asked for it on 2026-09-29. It returns a boolean and nothing else — no id, no provider,
-- no name. Google-only accounts answer true too; they have no password, so their sign-in
-- attempt fails and the page points them at Google.

create function email_has_account(p_email text) returns boolean
  language sql security definer stable set search_path = public, pg_temp
as $$
  select exists (select 1 from auth.users where lower(email) = lower(trim(p_email)));
$$;

revoke all on function email_has_account(text) from public, anon, authenticated;
grant execute on function email_has_account(text) to anon, authenticated;
