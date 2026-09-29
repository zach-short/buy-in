import { redirect } from 'next/navigation';

import { HomeSignedIn } from '@/components/home/home-signed-in';
import { HomeSignedOut } from '@/components/home/home-signed-out';
import { fetchHomeSessions, fetchIsBarStaff, type HomeSessions } from '@/lib/supabase/home-queries';
import { needsWelcome, WELCOMED_KEY } from '@/lib/supabase/new-account';
import { createClient } from '@/lib/supabase/server';

// Per-user output: never prerendered or cached. cookies() (server.ts) opts in already; this
// says so where a reader looks, and keeps it true if the read ever moves.
export const dynamic = 'force-dynamic';

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// A failed read falls back to the dashboard fetching for itself, as it always did, rather than
// failing the whole page into error.tsx.
async function readHomeSessions(supabase: ServerClient): Promise<HomeSessions | null> {
  try {
    return await fetchHomeSessions(supabase);
  } catch {
    return null;
  }
}

// Supabase sends a sign-in back to the Site URL, this page, with a ?code= whenever the redirectTo
// it was given is not in the project's redirect allow-list. Rendering here would paint Landing
// for the moment before the browser client exchanges the code and useRefreshOnAuthChange swaps
// in Home — the flash after logging in or signing up. The callback route exchanges it on the
// server and redirects straight to the right screen. No `flow` is passed: the fallback cannot say
// whether this was Google or a confirm link, so a failed exchange gets the generic /login error.
function callbackForCode(code: string): string {
  return `/auth/callback?${new URLSearchParams({ code })}`;
}

// Server-rendered, so a signed-out visitor gets Landing in the first response instead of a blank
// page until the JS, the auth listener and the staff read had all run. proxy.ts has already
// refreshed the session with getClaims on this request, and set the result on its cookies.
export default async function HomePage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  if (code) redirect(callbackForCode(code));

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return <HomeSignedOut />;

  const isStaff = await fetchIsBarStaff(supabase, userId);
  // Safety net for a sign-in that skipped /auth/callback: Supabase falls back to the Site URL
  // (this page, with a ?code=) when redirectTo is not in its redirect allow-list, and the
  // browser client then exchanges the code itself. A staff account has a table, so only the
  // rest pay for the check; claims already say whether /welcome was finished.
  if (!isStaff && data?.claims?.user_metadata?.[WELCOMED_KEY] !== true && (await needsWelcome(supabase))) {
    redirect('/welcome');
  }
  const sessions = isStaff ? await readHomeSessions(supabase) : null;
  return <HomeSignedIn isStaff={isStaff} sessions={sessions} />;
}
