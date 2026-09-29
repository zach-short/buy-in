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

// Server-rendered, so a signed-out visitor gets Landing in the first response instead of a blank
// page until the JS, the auth listener and the staff read had all run. proxy.ts has already
// refreshed the session with getClaims on this request, and set the result on its cookies.
export default async function HomePage() {
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
