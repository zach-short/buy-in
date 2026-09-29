import type { NextGameLike, RsvpAnswer } from '@pb/core';
import { MEMBER_GAME_STALE_HOURS, MEMBER_GAME_WINDOW_DAYS } from '@/lib/config';
import { createClient } from '@/lib/supabase/client';
import { rsvpError, type RsvpError } from '@/lib/supabase/rsvp';

// A member's side of a table's next game, by game id rather than invite token. 0022 made that
// safe: get_my_upcoming_games returns only games at tables the account sits at, and
// rsvp_my_game applies the same membership test before it writes.

// PostgREST's "function not in the schema cache", as rsvp.ts checks it.
const FUNCTION_MISSING = 'PGRST202';

/**
 * The soonest game at each table the account sits at, inside member Home's window. Where 0022
 * is not applied yet, no games rather than an error, so Home still lists the tables.
 */
export async function fetchMyUpcomingGames(): Promise<NextGameLike[]> {
  const { data, error } = await createClient().rpc('get_my_upcoming_games', {
    p_window_days: MEMBER_GAME_WINDOW_DAYS,
    p_stale_hours: MEMBER_GAME_STALE_HOURS,
  });
  if (error?.code === FUNCTION_MISSING) return [];
  if (error) throw error;
  return data;
}

// rsvp_my_game upserts, as rsvp_scheduled_game does, so changing an answer is the same call.
export async function rsvpMyGame(gameId: string, status: RsvpAnswer): Promise<RsvpError | null> {
  const { error } = await createClient().rpc('rsvp_my_game', { p_game_id: gameId, p_status: status });
  return error ? rsvpError(error) : null;
}
