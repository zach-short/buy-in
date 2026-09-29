import { createClient } from '@/lib/supabase/client';

// Lands on `/`, the logged-out landing page, because that is where both NextAuth sign-outs went
// (`signOut({ callbackUrl: '/' })` on the dashboard, `window.location.href = '/'` in the menu) and
// DESIGN.md §8.2 keeps screen behaviour as it was. `scope: 'local'` for the same reason: NextAuth
// only ever cleared this browser's cookie, where Supabase's default would also end the session on
// every other device the host is signed in on. A full navigation, not router.push, so nothing the
// signed-in session cached (SWR, the router cache) survives into the logged-out page.
export async function signOutToLanding(): Promise<void> {
  await createClient().auth.signOut({ scope: 'local' });
  await clearCacheStorage();
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- the full reload is the point: router.push would keep the signed-in session's SWR and router caches alive.
  window.location.href = '/';
}

// The service worker's caches hold pages this user saw, and on a shared device the next person
// would be served them. `caches` is absent on insecure origins and some private modes, and a
// failed delete must never stop the sign-out, so both cases are swallowed.
async function clearCacheStorage(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
  } catch {
    // Deliberately ignored: see above.
  }
}
