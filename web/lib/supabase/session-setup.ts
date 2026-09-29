import { createClient } from '@/lib/supabase/client';
import { fetchUpcomingGames, type ScheduledGameRow } from '@/lib/supabase/scheduled-games';

// Reads for /session/new's one-tap rosters. Kept out of queries.ts, as scheduled-games.ts
// is, so this screen does not collide with the phases that own that file. Read-only.

/** The player ids seated at the most recently played session, or [] when there is none. */
export async function fetchLastRoster(): Promise<string[]> {
  const { data, error } = await createClient().from('sessions').select('id, session_players(player_id)')
    .order('played_on', { ascending: false }).order('created_at', { ascending: false }).limit(1);
  if (error) throw error;
  return data[0]?.session_players.map((sp) => sp.player_id) ?? [];
}

/** A scheduled game on today's date, and the accounts that answered yes to it. */
export interface TonightRsvps {
  game: Pick<ScheduledGameRow, 'id' | 'name'>;
  /** Auth user ids — match them to `players.user_id`; a guest who never joined has no player. */
  userIds: string[];
}

function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

/**
 * Tonight's game, by the browser's calendar day, or null when none is scheduled for today.
 * The first of the day wins, matching fetchUpcomingGames' soonest-first order.
 */
export async function fetchTonightRsvps(): Promise<TonightRsvps | null> {
  const game = (await fetchUpcomingGames()).find((g) => isToday(g.scheduled_at));
  if (!game) return null;
  const { data, error } = await createClient().from('game_rsvps').select('user_id')
    .eq('scheduled_game_id', game.id).eq('status', 'yes');
  if (error) throw error;
  return { game: { id: game.id, name: game.name }, userIds: data.map((r) => r.user_id) };
}
