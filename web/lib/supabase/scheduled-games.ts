import type { PostgrestError } from '@supabase/supabase-js';

import { writeErrorMessage, type Tables } from '@pb/core';
import { shareOrCopy, type ShareResult } from '@/lib/share';
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

export type RsvpStatus = 'yes' | 'maybe' | 'no';

export interface GameRsvp {
  userId: string;
  /** The guest's name at this table, or null when they answered without joining it. */
  name: string | null;
  status: RsvpStatus;
}

// The column is plain text with a check constraint, so the generated type is `string`.
function toRsvpStatus(status: string): RsvpStatus {
  return status === 'yes' || status === 'maybe' ? status : 'no';
}

/**
 * Every answer to one game, oldest first, with the guest's name where one is readable.
 *
 * An RSVP is keyed to the auth user, not a players row (0004), and the only name a host can
 * read is the claimed player that join_bar_as_player made for that account in this bar. A
 * guest who answered without joining the table has none — their sign-up name lives in
 * auth.users, which no staff policy reaches — so their name comes back null.
 */
export async function fetchGameRsvps(game: GameRef): Promise<GameRsvp[]> {
  const { data, error } = await createClient().from('game_rsvps').select('user_id, status')
    .eq('scheduled_game_id', game.id).order('created_at').order('id');
  if (error) throw error;
  const names = await fetchPlayerNames(game.bar_id, data.map((r) => r.user_id));
  return data.map((r) => ({ userId: r.user_id, name: names.get(r.user_id) ?? null, status: toRsvpStatus(r.status) }));
}

async function fetchPlayerNames(barId: string, userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await createClient().from('players').select('user_id, name')
    .eq('bar_id', barId).in('user_id', userIds);
  if (error) throw error;
  return new Map(data.flatMap((p) => (p.user_id ? [[p.user_id, p.name] as const] : [])));
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

// An update RLS refuses, or one whose filter matches nothing, is not an error to PostgREST —
// it just returns no rows. Selecting the id back is how a no-op becomes a sentence.
async function updateUnstartedGame(gameId: string, patch: Partial<ScheduledGameRow>): Promise<void> {
  const { data, error } = await createClient().from('scheduled_games').update(patch)
    .eq('id', gameId).is('cancelled_at', null).is('session_id', null).select('id');
  if (error) fail(error);
  if (data.length === 0) throw new Error('This game has already started or been cancelled');
}

/**
 * Sets cancelled_at, which drops the game from the upcoming list. The invite is left live on
 * purpose: a guest who opens it then sees the night is cancelled (0012, get_rsvp_game) rather
 * than a dead link.
 */
export async function cancelScheduledGame(gameId: string): Promise<void> {
  await updateUnstartedGame(gameId, { cancelled_at: new Date().toISOString() });
}

/** Renames or reschedules a game not yet started. `scheduledAt` is an ISO timestamp. */
export async function updateScheduledGame(gameId: string, name: string, scheduledAt: string): Promise<void> {
  await updateUnstartedGame(gameId, { name, scheduled_at: scheduledAt });
}

export function rsvpUrl(token: string): string {
  return `${window.location.origin}/rsvp/${token}`;
}

/** Shares the invite link alone — the share sheet where there is one, the clipboard otherwise. */
export async function shareGameInvite(token: string): Promise<ShareResult> {
  return shareOrCopy(rsvpUrl(token));
}
