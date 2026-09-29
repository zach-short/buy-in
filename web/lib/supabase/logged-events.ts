import type { Database } from '@pb/core';
import { createClient } from '@/lib/supabase/client';

/**
 * A result the signed-in player logged themselves that is not poker — a sports bet, a night at
 * blackjack (0027). Only the owner can read or write one: logged_events_own is keyed on
 * user_id = auth.uid(), so this select needs no user filter and cannot return anyone else's row.
 * Its net is payout minus stake, won-positive (`eventNetCents` in @pb/core); never flip it.
 */
export type LoggedEventRow = Database['public']['Tables']['logged_events']['Row'];

/**
 * Every event the caller logged, oldest first. As fetchMyLoggedSessions does, a read the Data
 * API capped at `max_rows` fails loudly: a short history would draw a cumulative total that is
 * silently wrong (log-events SCOPE H10).
 */
export async function fetchMyLoggedEvents(): Promise<LoggedEventRow[]> {
  const { data, error, count } = await createClient()
    .from('logged_events')
    .select('*', { count: 'exact' })
    .order('played_on')
    .order('id');
  if (error) throw error;
  if (count !== null && data.length < count) {
    throw new Error(`logged_events returned ${data.length} of ${count} events`);
  }
  return data;
}
