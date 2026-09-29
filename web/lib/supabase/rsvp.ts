import type { PostgrestError } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/client';

// The guest's side of a game night: read what the invite is for (0012, get_rsvp_game) and answer
// it (0004, rsvp_scheduled_game). Both take the invite token, never a game id — 0004 keeps game
// ids away from non-staff accounts, and nothing here should need one.

export type RsvpStatus = 'yes' | 'no' | 'maybe';

export interface RsvpGame {
  name: string;
  scheduledAt: string;
  barName: string;
  hostName: string | null;
  cancelled: boolean;
  started: boolean;
  myStatus: RsvpStatus | null;
}

// A dead link fails identically on every click, so it replaces the buttons; any other failure
// may be a dropped connection, so the buttons stay for another try.
export interface RsvpError {
  fatal: boolean;
  message: string;
}

/**
 * `unknown` is the old, detail-free page: 0012 is not applied where this build runs, or the read
 * failed for a reason a click might not. The page then behaves exactly as it did before 0012.
 */
export type RsvpGameResult =
  | { kind: 'game'; game: RsvpGame }
  | { kind: 'invalid'; error: RsvpError }
  | { kind: 'unknown' };

// PostgREST's "function not in the schema cache", checked before the loose match below so a
// missing function can never read as a dead link.
const FUNCTION_MISSING = 'PGRST202';

// The match is loose because the raise wording belongs to the schema: 0004 and 0012 both say
// 'invalid or expired link', and a standing-table invite opened here says 'not an event invite'.
// Member Home's by-id path (0022, rsvp_my_game) raises in the same style and maps through here too.
export function rsvpError(error: PostgrestError): RsvpError {
  const message = error.message.toLowerCase();
  // 0022 only: the link path takes a late answer on purpose (0012), the card's path does not.
  if (message.includes('game has already started')) {
    return { fatal: true, message: 'This game has already started.' };
  }
  // 0012: a cancelled game refuses answers. Fatal — no retry will change it — and checked first
  // so the loose dead-link match below can never swallow it.
  if (message.includes('game was cancelled')) {
    return { fatal: true, message: 'This game was cancelled, so it is no longer taking answers.' };
  }
  if (message.includes('not an event invite')) {
    return { fatal: true, message: "This link invites you to join a table, not to a game night. Ask the host for the game night's link." };
  }
  if (/invalid|expired|revoked|not found/.test(message)) {
    return { fatal: true, message: 'This invite link is invalid or has expired. Ask the host for a new one.' };
  }
  return { fatal: false, message: "Couldn't save your answer. Try again in a moment." };
}

function isStatus(value: string | null): value is RsvpStatus {
  return value === 'yes' || value === 'no' || value === 'maybe';
}

/** What the invite is for, and this account's current answer to it. */
export async function fetchRsvpGame(token: string): Promise<RsvpGameResult> {
  const { data, error } = await createClient().rpc('get_rsvp_game', { p_token: token });
  if (error?.code === FUNCTION_MISSING) return { kind: 'unknown' };
  if (error) {
    const mapped = rsvpError(error);
    return mapped.fatal ? { kind: 'invalid', error: mapped } : { kind: 'unknown' };
  }
  const row = data[0];
  if (!row) return { kind: 'unknown' };
  return {
    kind: 'game',
    game: {
      name: row.game_name,
      scheduledAt: row.scheduled_at,
      barName: row.bar_name,
      hostName: row.host_name,
      cancelled: row.cancelled,
      started: row.started,
      myStatus: isStatus(row.my_status) ? row.my_status : null,
    },
  };
}

// rsvp_scheduled_game upserts, so changing an answer is the same call with another status.
export async function submitRsvp(token: string, status: RsvpStatus): Promise<RsvpError | null> {
  const { error } = await createClient().rpc('rsvp_scheduled_game', { p_token: token, p_status: status });
  return error ? rsvpError(error) : null;
}
