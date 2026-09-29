import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { afterSignIn } from '@/lib/supabase/new-account';
import { completePendingBar } from '@/lib/supabase/pending-bar';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { PENDING_NEXT_COOKIE } from '@/lib/supabase/pending-next';

// The confirm-email link is opened in a different browser or in an in-app mail viewer often
// enough that the PKCE verifier cookie is missing and the exchange fails. Supabase has already
// confirmed the address by the time it redirects here, so a sign-up link that fails to exchange
// sends the visitor to sign in with their password rather than to a generic error.
function failureRedirect(origin: string, flow: string | null, next: string): string {
  if (flow !== 'signup') return `${origin}/login?error=oauth`;
  return `${origin}/login?${new URLSearchParams({ confirmed: '1', redirect: next })}`;
}

function consumed(response: NextResponse): NextResponse {
  response.cookies.delete(PENDING_NEXT_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  // The query's `next` is lost when Supabase falls back to the Site URL; the cookie is not.
  const remembered = request.cookies.get(PENDING_NEXT_COOKIE)?.value;
  const next = safeRedirectPath(searchParams.get('next') ?? (remembered && decodeURIComponent(remembered)), '/');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Best effort: a failure leaves the fields in metadata for the next sign-in to retry.
      await completePendingBar(supabase).catch(() => undefined);
      // A new account, from Google or a confirm link, goes through /welcome first and carries
      // `next` (an invite, an event link) along; everyone else goes straight to `next`.
      const destination = next.startsWith('/welcome') ? next : await afterSignIn(supabase, next);
      return consumed(NextResponse.redirect(`${origin}${destination}`));
    }
  }
  return consumed(NextResponse.redirect(failureRedirect(origin, searchParams.get('flow'), next)));
}
