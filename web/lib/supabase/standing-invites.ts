import type { PostgrestError } from '@supabase/supabase-js';

import { writeErrorMessage, type Tables } from '@pb/core';
import { createClient } from '@/lib/supabase/client';
import type { PlayerRow } from '@/lib/supabase/queries';

// The host's standing table invites: links anyone can open to join the bar as a member
// (owner decision: invite link or code only, no public directory). A row whose
// scheduled_game_id is set belongs to one game night and is the /schedule pages' concern,
// so every read here filters to null. Kept out of queries.ts and writes.ts, as
// bar-settings.ts and share-links.ts are, so this feature does not collide with the
// phases that own those files.

export type InviteStatus = 'live' | 'expired' | 'revoked';

export type StandingInvite = Tables<'bar_invite_links'> & { status: InviteStatus };

export type RecentJoin = Pick<PlayerRow, 'id' | 'name' | 'created_at'>;

function fail(error: PostgrestError): never {
  throw new Error(writeErrorMessage(error));
}

// Status is fixed when the list is fetched, not per render, so the screen stays pure;
// SWR refetches on focus, which is when a stale "live" would matter.
function statusOf(invite: Tables<'bar_invite_links'>, now: Date): InviteStatus {
  if (invite.revoked_at) return 'revoked';
  return new Date(invite.expires_at) <= now ? 'expired' : 'live';
}

/** Every standing invite this bar has minted, newest first. */
export async function fetchStandingInvites(barId: string): Promise<StandingInvite[]> {
  const { data, error } = await createClient().from('bar_invite_links').select('*')
    .eq('bar_id', barId).is('scheduled_game_id', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const now = new Date();
  return data.map((invite) => ({ ...invite, status: statusOf(invite, now) }));
}

/** Mints a standing invite (no scheduled game) and returns its token. */
export async function createStandingInvite(barId: string): Promise<string> {
  const { data, error } = await createClient().rpc('create_bar_invite', { p_bar_id: barId });
  if (error) fail(error);
  return data;
}

export async function revokeInvite(token: string): Promise<void> {
  const { error } = await createClient().rpc('revoke_bar_invite', { p_token: token });
  if (error) fail(error);
}

/**
 * The bar's ten newest players who are linked to an account. `created_at` is when the
 * player row was made — the join date for someone who joined by link, but for a player the
 * host added first and who later claimed the row, it is when the host added them.
 */
export async function fetchRecentJoins(barId: string): Promise<RecentJoin[]> {
  const { data, error } = await createClient().from('players').select('id, name, created_at')
    .eq('bar_id', barId).not('user_id', 'is', null)
    .order('created_at', { ascending: false }).limit(10);
  if (error) throw error;
  return data;
}

export function joinUrl(token: string): string {
  return `${window.location.origin}/join/${token}`;
}
