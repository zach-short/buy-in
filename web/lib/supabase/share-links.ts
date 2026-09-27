import type { PostgrestError } from '@supabase/supabase-js';

import { writeErrorMessage } from '@pb/core';
import { createClient } from '@/lib/supabase/client';
import type { PlayerRow } from '@/lib/supabase/queries';

// Phase 7, scope item 5: the host mints the links players open, replacing the Go API's
// GET /api/players/:id/portal-token (portal.go), whose HMAC token was permanent and, with
// its 'dev-portal-secret' fallback, computable from a player's id (D8). A link here is a row
// in player_share_links; RLS lets only staff read or write one (0001, share_links_staff).
//
// A session id scopes a link to one night's receipt; null scopes it to the player's whole
// history, which both /portal and /player-receipt render (D15).
//
// Sending reuses the player's live link for the same scope, so texting a receipt twice
// sends one link, not two. Replacing a portal link is the explicit action that revokes —
// both asked of the owner and answered 2026-09-27.

type LinkPlayer = Pick<PlayerRow, 'id' | 'bar_id'>;

function fail(error: PostgrestError): never {
  throw new Error(writeErrorMessage(error));
}

// A value carrying `.` or `:` must be double-quoted inside a PostgREST `or` filter
// (docs.postgrest.org v14, URL grammar, "Reserved characters") — the same rule queries.ts
// follows for its keyset cursor.
function unexpired(): string {
  return `expires_at.is.null,expires_at.gt."${new Date().toISOString()}"`;
}

async function liveToken(player: LinkPlayer, sessionId: string | null): Promise<string | null> {
  const query = createClient().from('player_share_links').select('token')
    .eq('player_id', player.id).is('revoked_at', null).or(unexpired())
    .order('created_at', { ascending: false }).limit(1);
  const scoped = sessionId ? query.eq('session_id', sessionId) : query.is('session_id', null);
  const { data, error } = await scoped;
  if (error) fail(error);
  return data[0]?.token ?? null;
}

async function mintToken(player: LinkPlayer, sessionId: string | null): Promise<string> {
  const { data, error } = await createClient().from('player_share_links')
    .insert({ bar_id: player.bar_id, player_id: player.id, session_id: sessionId })
    .select('token').single();
  if (error) fail(error);
  return data.token;
}

/** The player's live link for this scope, minted if there is none. */
export async function shareToken(player: LinkPlayer, sessionId: string | null): Promise<string> {
  return (await liveToken(player, sessionId)) ?? mintToken(player, sessionId);
}

/**
 * Revokes every live portal link the player has, then mints a fresh one. Two requests, not
 * one transaction: if the mint fails the player briefly has no portal link, and the host's
 * retry mints one — nothing is left half-shared.
 */
export async function replacePortalToken(player: LinkPlayer): Promise<string> {
  const { error } = await createClient().from('player_share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('player_id', player.id).is('session_id', null).is('revoked_at', null);
  if (error) fail(error);
  return mintToken(player, null);
}

export function receiptUrl(token: string): string {
  return `${window.location.origin}/receipt/${token}`;
}

export function portalUrl(token: string): string {
  return `${window.location.origin}/portal/${token}`;
}

export function playerReceiptUrl(token: string): string {
  return `${window.location.origin}/player-receipt/${token}`;
}
