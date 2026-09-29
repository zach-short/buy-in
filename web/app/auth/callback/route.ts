import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { completePendingBar } from '@/lib/supabase/pending-bar';
import { safeRedirectPath } from '@/lib/safe-redirect';

// The confirm-email link is opened in a different browser or in an in-app mail viewer often
// enough that the PKCE verifier cookie is missing and the exchange fails. Supabase has already
// confirmed the address by the time it redirects here, so a sign-up link that fails to exchange
// sends the visitor to sign in with their password rather than to a generic error.
function failureRedirect(origin: string, flow: string | null, next: string): string {
  if (flow !== 'signup') return `${origin}/login?error=oauth`;
  return `${origin}/login?${new URLSearchParams({ confirmed: '1', redirect: next })}`;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = safeRedirectPath(searchParams.get('next'), '/');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Best effort: a failure leaves the fields in metadata for the next sign-in to retry.
      await completePendingBar(supabase).catch(() => undefined);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(failureRedirect(origin, searchParams.get('flow'), next));
}
