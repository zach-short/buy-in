import type { PostgrestError } from '@supabase/supabase-js';

import { writeErrorMessage, type Tables } from '@pb/core';
import { createClient } from '@/lib/supabase/client';
import { fetchBarId } from '@/lib/supabase/queries';

// A scheduled game is a future game night: a name, a time and an invite link guests RSVP
// through. It is deliberately lighter than a session — no players, no buy-ins — and becomes
// a real `sessions` row only when the host starts it (start_scheduled_game), at which point
// it leaves the upcoming list. Kept out of queries.ts and writes.ts, as bar-settings.ts is,
// so this feature does not collide with the phases that own those files; the error handling
// is theirs.

export type ScheduledGameRow = Tables<'scheduled_games'>;
/** What minting an invite needs: the game, and the bar the invite admits guests to. */
export type GameRef = Pick<ScheduledGameRow, 'id' | 'bar_id'>;

function fail(error: PostgrestError): never {
  throw new Error(writeErrorMessage(error));
}

/**
 * The host's games not yet started or cancelled, soonest first. No time filter on purpose:
 * a night whose start time has passed is exactly the one the host is about to start.
 *
 * Filtered on bar_id, unlike queries.ts, which leaves scoping to RLS: scheduled_games' policy
 * is written in a migration this file was built without, and this list must hold only games
 * this host can start. Not paged — it is a display list of unstarted nights, not a sum, so the
 * Data API's row cap (queries.ts, PAGE_SIZE) cannot skew a total here.
 */
export async function fetchUpcomingGames(): Promise<ScheduledGameRow[]> {
  const { data, error } = await createClient().from('scheduled_games').select('*')
    .eq('bar_id', await fetchBarId()).is('cancelled_at', null).is('session_id', null)
    .order('scheduled_at').order('id');
  if (error) throw error;
  return data;
}

/** Guests who answered yes. A head count, not rows, so no row cap can under-count it. */
export async function fetchYesCount(gameId: string): Promise<number> {
  const { count, error } = await createClient().from('game_rsvps')
    .select('id', { count: 'exact', head: true })
    .eq('scheduled_game_id', gameId).eq('status', 'yes');
  if (error) throw error;
  if (count === null) throw new Error('fetchYesCount needs { count: "exact" } on its select');
  return count;
}

/**
 * The game's live invite token, newest first — the one scheduling minted, re-read rather than
 * stored on the game — or null when there is none (the mint failed, or it was revoked).
 */
export async function fetchGameInviteToken(gameId: string): Promise<string | null> {
  const { data, error } = await createClient().from('bar_invite_links').select('token')
    .eq('scheduled_game_id', gameId).is('revoked_at', null)
    .order('created_at', { ascending: false }).limit(1);
  if (error) throw error;
  return data[0]?.token ?? null;
}

/** create_scheduled_game. `scheduledAt` is an ISO timestamp; the game's id and bar come back. */
export async function createScheduledGame(name: string, scheduledAt: string): Promise<GameRef> {
  const bar_id = await fetchBarId();
  const { data, error } = await createClient().rpc('create_scheduled_game', {
    p_bar_id: bar_id, p_name: name, p_scheduled_at: scheduledAt,
  });
  if (error) fail(error);
  return { id: data, bar_id };
}

/** create_bar_invite scoped to one game — an event invite, not the standing-table one. */
export async function mintGameInvite(game: GameRef): Promise<string> {
  const { data, error } = await createClient().rpc('create_bar_invite', {
    p_bar_id: game.bar_id, p_scheduled_game_id: game.id,
  });
  if (error) fail(error);
  return data;
}

/** start_scheduled_game: creates the real session this game pointed to and returns its id. */
export async function startScheduledGame(gameId: string): Promise<string> {
  const { data, error } = await createClient().rpc('start_scheduled_game', { p_scheduled_game_id: gameId });
  if (error) fail(error);
  return data;
}

export function rsvpUrl(token: string): string {
  return `${window.location.origin}/rsvp/${token}`;
}
