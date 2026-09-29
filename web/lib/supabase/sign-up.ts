import { createClient } from '@/lib/supabase/client';

// DESIGN.md D5's named reversal: self-service sign-up. Only the email and password are asked
// here; the name, Venmo and host-or-member choice come after, on /welcome, for email and
// Google accounts alike. Hosting runs create_bar there, whose owner membership comes from
// 0001's bars_owner_membership trigger.

/** `signed-in` when the project auto-confirms email; `confirm-email` when it does not. */
export type AccountResult = 'signed-in' | 'confirm-email';

// The confirm link lands on the same callback Google uses. `flow=signup` tells it that a failed
// code exchange (link opened in a different browser, so no PKCE verifier) still means the
// address is confirmed: Supabase confirms it before redirecting, and only the sign-in is lost.
export function confirmRedirectUrl(next: string): string {
  return `${window.location.origin}/auth/callback?flow=signup&next=${encodeURIComponent(next)}`;
}

export async function createAccount(email: string, password: string, next: string): Promise<AccountResult> {
  const { data, error } = await createClient().auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: confirmRedirectUrl(next) },
  });
  if (error) throw new Error(error.message);
  // With Confirm email on, Supabase returns a user and no session, and for an address that
  // is already registered, a decoy user with no error. Either way nobody is signed in, so
  // nothing after this would run signed in. Off (mailer_autoconfirm, live 2026-09-28) a session comes back.
  return data.session ? 'signed-in' : 'confirm-email';
}
