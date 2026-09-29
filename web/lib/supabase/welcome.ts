import { fetchClaimState } from '@/lib/supabase/claims';
import { createClient } from '@/lib/supabase/client';
import { joinBarAsPlayer } from '@/lib/supabase/join';
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

const INVITE_PATH = /^\/join\/([^/?#]+)$/;

/**
 * Where an invited member goes once their profile is saved. The name and Venmo they just gave are
 * the whole ask, so an invite that needs nothing else seats them now and sends them home. A table
 * with names to claim, a waiting request or a name clash still needs a choice, so those go on to
 * the invite page. Not an invite path: `next` unchanged.
 */
export async function acceptInvite(next: string, name: string): Promise<string> {
  const encoded = INVITE_PATH.exec(next)?.[1];
  if (!encoded) return next;
  const token = decodeURIComponent(encoded);
  const state = await fetchClaimState(token);
  if (state.kind === 'at-table') return '/';
  if (state.kind !== 'open' || state.players.length > 0 || state.myRequest) return next;
  const joined = await joinBarAsPlayer(token, name.trim());
  return joined.ok ? '/' : next;
}
