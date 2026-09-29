import { createClient } from '@/lib/supabase/client';

// PKCE: the provider sends the browser to /auth/callback with a ?code=, which the route
// handler exchanges for a session cookie. `next` rides along as a query param and is
// re-validated with safeRedirectPath on the way back in.
export async function signInWithGoogle(next: string): Promise<void> {
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const { error } = await createClient().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  if (error) throw new Error(error.message);
}
