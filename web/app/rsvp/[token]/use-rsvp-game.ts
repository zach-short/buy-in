import useSWR from 'swr';

import { fetchRsvpGame, type RsvpGameResult } from '@/lib/supabase/rsvp';

/**
 * The game an RSVP link is for, or undefined while it loads. fetchRsvpGame folds every failure
 * into a result, so an SWR error can only be a throw it did not expect — read as `unknown`,
 * which is the page as it was before 0012, rather than a broken screen.
 */
export function useRsvpGame(token: string): RsvpGameResult | undefined {
  const { data, error } = useSWR<RsvpGameResult, Error>(['rsvp_game', token], () => fetchRsvpGame(token), {
    // The guest's own answer is held locally once they tap; a refetch on focus adds nothing.
    revalidateOnFocus: false,
  });
  return error ? { kind: 'unknown' } : data;
}
