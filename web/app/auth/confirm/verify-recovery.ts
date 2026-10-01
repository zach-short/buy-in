'use server';

import { redirect, RedirectType } from 'next/navigation';

import { safeRedirectPath } from '@/lib/safe-redirect';
import { EXPIRED_RESET_LOGIN_PATH, RESET_PASSWORD_PATH } from '@/lib/supabase/password-reset';
import { createClient } from '@/lib/supabase/server';

// The confirm page's button posts here, and nothing else spends the token (owner, 2026-09-30):
// mail scanners such as Outlook Safe Links open every link with a GET, so verifying on GET used
// the token up before the person tapped it. A server action rather than a POST route handler,
// because Next checks Origin against Host on every action (Next.js 16 data-security guide,
// "Allowed origins"), so another site cannot post a token of its own and sign this browser in as
// that account; and the action posts to /auth/confirm itself, which proxy.ts already lets through.
//
// verifyOtp checks the token hash on the server and sets a signed-in session with no PKCE
// verifier, so the link works from Mail into Safari even when the reset was asked for in the
// installed web app. Recovery only, whatever the form says: sign-up confirmation and Google keep
// /auth/callback.
export async function verifyRecovery(form: FormData): Promise<never> {
  const tokenHash = form.get('token_hash');
  const next = form.get('next');
  if (typeof tokenHash === 'string' && tokenHash && (await signedIn(tokenHash))) {
    // replace, so Back from the set-password page cannot return to a button that would now fail.
    redirect(safeRedirectPath(typeof next === 'string' ? next : null, RESET_PASSWORD_PATH), RedirectType.replace);
  }
  // A token works once and expires (auth.email.otp_expiry), and GoTrue does not say which of the
  // two failed, so the login page offers a new email for both.
  redirect(EXPIRED_RESET_LOGIN_PATH, RedirectType.replace);
}

async function signedIn(tokenHash: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
  return !error;
}
