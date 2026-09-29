import { createClient } from '@/lib/supabase/client';
import { WELCOMED_KEY } from '@/lib/supabase/new-account';
import { createBarWith } from '@/lib/supabase/pending-bar';

export interface Profile {
  name: string;
  /** Normalized (normalizeVenmo) and validated already; blank means none. */
  venmo: string;
}

// full_name is what 0008 and 0012 show a host and what the join form starts from; venmo is
// what 0023's trigger copies onto a seat when this account takes one.
export async function saveProfile(profile: Profile): Promise<void> {
  const { error } = await createClient().auth.updateUser({
    data: { full_name: profile.name.trim(), venmo: profile.venmo || null, [WELCOMED_KEY]: true },
  });
  if (error) throw new Error(error.message);
}

// The table goes first: a failed create_bar leaves the account unwelcomed, so the next sign-in
// brings the host back here instead of to a home with no table.
export async function createHostTable(profile: Profile, tableName: string): Promise<void> {
  await createBarWith(createClient(), { barName: tableName, venmo: profile.venmo, cashapp: '' });
  await saveProfile(profile);
}
