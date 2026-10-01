import { isAuthSessionMissingError } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/client';

// Forgot password (PASSOFF item 34, owner 2026-09-30: "email a reset link"). The link in the
// email is the token-hash kind, built by supabase/templates/recovery.html (production: the
// dashboard's Reset Password template): the button on /auth/confirm verifies it server-side, so it
// works in a browser other than the one that asked. A PKCE link would not: an installed iPhone web
// app and Safari do not share the verifier cookie.

export const RESET_PASSWORD_PATH = '/reset-password';

// Where /auth/confirm sends a link that failed; the login page opens on a new-email step there.
export const EXPIRED_RESET_LOGIN_PATH = '/login?reset=expired';

export function cameFromExpiredLink(searchParams: { get(name: string): string | null }): boolean {
  return searchParams.get('reset') === 'expired';
}

// Only the default template follows redirectTo; the token-hash template ignores it. Pointing it
// at the callback means that, until the owner replaces production's template, a link opened in
// the same browser still reaches the set-password page instead of ending signed in at home.
function resetRedirectUrl(): string {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(RESET_PASSWORD_PATH)}`;
}

// GoTrue answers an address with no account exactly as it answers one with an account, so the
// caller cannot tell them apart and neither can anyone typing addresses into the form. A rate
// limit (429: GoTrue's per-address interval, the project's hourly email cap) resolves as a send
// too (owner, 2026-09-30): GoTrue limits only real sends, so its own message on a second try
// showed that the address has an account.
export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: resetRedirectUrl(),
  });
  if (error && error.status !== 429) throw new Error(error.message);
}

/**
 * `saved-sign-out-failed`: the password changed, but the call that signs out other devices failed.
 * `signed-out`: the session from the link is gone, so only a new link can set the password.
 */
export type SaveResult = 'saved' | 'saved-sign-out-failed' | 'signed-out';

type Client = ReturnType<typeof createClient>;

// Runs on the session /auth/confirm set from the link. The proxy stops a signed-out visitor
// before the page loads; `signed-out` covers a session that ends while the page is open.
export async function saveNewPassword(password: string): Promise<SaveResult> {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (!error) return (await signOutOtherDevices(supabase)) ? 'saved' : 'saved-sign-out-failed';
  if (isAuthSessionMissingError(error) || error.code === 'session_not_found') return 'signed-out';
  if (error.code === 'same_password') throw new Error('That is your current password. Choose a new one.');
  throw new Error(error.message);
}

// Owner, 2026-09-30: a reset made because a phone was stolen must lock that phone out. `others`
// revokes every other session's refresh token and keeps this one, so the person stays signed in
// here. An access token already issued elsewhere still works until it expires (supabase-js
// signOut docs); GoTrue cannot revoke one. The password is saved whatever this returns.
// The local stack's GoTrue (v2.195.0, 2026-09-30) already revokes the other sessions' refresh
// tokens when the password changes, with no call from here; this call makes the guarantee ours,
// not a property of whichever GoTrue version production runs, which no session can check.
async function signOutOtherDevices(supabase: Client): Promise<boolean> {
  try {
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    return !error;
  } catch {
    return false;
  }
}
