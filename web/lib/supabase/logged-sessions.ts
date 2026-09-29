import type { Database } from '@pb/core';
import { createClient } from '@/lib/supabase/client';

/**
 * A game the signed-in player logged themselves, away from any table (0021). Only the owner
 * can read or write one: logged_sessions_own is keyed on user_id = auth.uid(), so this select
 * needs no user filter and cannot return anyone else's row.
 */
export type LoggedSessionRow = Database['public']['Tables']['logged_sessions']['Row'];

/**
 * Every session the caller logged, oldest first. As fetchMyPerformance does, a read the Data
 * API capped at `max_rows` fails loudly: a short history would draw a cumulative total that is
 * silently wrong.
 */
export async function fetchMyLoggedSessions(): Promise<LoggedSessionRow[]> {
  const { data, error, count } = await createClient()
    .from('logged_sessions')
    .select('*', { count: 'exact' })
    .order('played_on')
    .order('id');
  if (error) throw error;
  if (count !== null && data.length < count) {
    throw new Error(`logged_sessions returned ${data.length} of ${count} sessions`);
  }
  return data;
}
