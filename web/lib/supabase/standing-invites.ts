import type { PostgrestError } from '@supabase/supabase-js';

import {
  codeStatus, hasLapsed, inviteShareText, type CodeStatus, type GeneratedCodeLength, type InviteKind,
  type InviteLifetime, writeErrorMessage, type Tables,
} from '@pb/core';
import { createClient } from '@/lib/supabase/client';
import type { PlayerRow } from '@/lib/supabase/queries';

// The host's standing table invites: links anyone can open to join the bar as a member
// (owner decision: invite link or code only, no public directory). A row whose
// scheduled_game_id is set belongs to one game night and is the /schedule pages' concern,
// so every read here filters to null. Kept out of queries.ts and writes.ts, as
// bar-settings.ts and share-links.ts are, so this feature does not collide with the
// phases that own those files.

export type InviteStatus = 'live' | 'expired' | 'revoked';

export type StandingInvite = Omit<Tables<'bar_invite_links'>, 'kind'> & {
  kind: InviteKind;
  status: InviteStatus;
  codeStatus: CodeStatus;
};

/** What create_table_invite (0030) is sent for one new invite. */
export interface NewInvite {
  kind: InviteKind;
  codeLength: GeneratedCodeLength;
  linkLifetime: InviteLifetime;
  codeLifetime: InviteLifetime;
}

export type RecentJoin = Pick<PlayerRow, 'id' | 'name' | 'created_at'>;

function fail(error: PostgrestError): never {
  throw new Error(writeErrorMessage(error));
}

// 0028's bar_invite_links_kind_check allows these three and nothing else; the generated type
// only says string, so this narrows it rather than trusting it (T1).
function kindOf(kind: string): InviteKind {
  if (kind === 'link' || kind === 'code' || kind === 'both') return kind;
  throw new Error(`Unknown invite kind: ${kind}`);
}

// Status is fixed when the list is fetched, not per render, so the screen stays pure;
// SWR refetches on focus, which is when a stale "live" would matter.
function statusOf(invite: Tables<'bar_invite_links'>, now: Date): InviteStatus {
  if (invite.revoked_at) return 'revoked';
  return hasLapsed(invite.expires_at, now) ? 'expired' : 'live';
}

/** Every standing invite this bar has minted, newest first. */
export async function fetchStandingInvites(barId: string): Promise<StandingInvite[]> {
  const { data, error } = await createClient().from('bar_invite_links').select('*')
    .eq('bar_id', barId).is('scheduled_game_id', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const now = new Date();
  return data.map((invite) => {
    const kind = kindOf(invite.kind);
    return { ...invite, kind, status: statusOf(invite, now), codeStatus: codeStatus({ ...invite, kind }, now) };
  });
}

/** Mints a standing invite of the host's chosen kind and lifetimes and returns its token. A link-only invite takes no length. */
export async function createStandingInvite(barId: string, invite: NewInvite): Promise<string> {
  const { data, error } = await createClient().rpc('create_table_invite', {
    p_bar_id: barId,
    p_kind: invite.kind,
    p_link_lifetime: invite.linkLifetime,
    p_code_lifetime: invite.codeLifetime,
    ...(invite.kind === 'link' ? {} : { p_code_length: invite.codeLength }),
  });
  if (error) fail(error);
  return data;
}

/** The host's own code for an invite. Null means another live invite holds it (0028 counts that as a wrong try). */
export async function setInviteCode(token: string, code: string): Promise<string | null> {
  const { data, error } = await createClient().rpc('set_invite_code', { p_token: token, p_code: code });
  if (error) fail(error);
  // The generated type says string; 0028 returns null for a taken code.
  return data ?? null;
}

/** A fresh random code of the invite's own length, good for the code lifetime the invite was made with (0030). */
export async function refreshInviteCode(token: string): Promise<string> {
  const { data, error } = await createClient().rpc('refresh_invite_code', { p_token: token });
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

/** What Share sends for this invite: the link, the code, or both (SCOPE A4). */
export function shareTextFor(invite: StandingInvite): string {
  const code = invite.codeStatus === 'live' ? invite.code : null;
  return inviteShareText({ kind: invite.kind, link: joinUrl(invite.token), code, joinPage: `${window.location.origin}/join` });
}
