import { createClient } from '@/lib/supabase/client';

// Lands on `/`, the logged-out landing page, because that is where both NextAuth sign-outs went
// (`signOut({ callbackUrl: '/' })` on the dashboard, `window.location.href = '/'` in the menu) and
// DESIGN.md §8.2 keeps screen behaviour as it was. `scope: 'local'` for the same reason: NextAuth
// only ever cleared this browser's cookie, where Supabase's default would also end the session on
// every other device the host is signed in on. A full navigation, not router.push, so nothing the
// signed-in session cached (SWR, the router cache) survives into the logged-out page.
export async function signOutToLanding(): Promise<void> {
  await createClient().auth.signOut({ scope: 'local' });
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- the full reload is the point: router.push would keep the signed-in session's SWR and router caches alive.
  window.location.href = '/';
}
