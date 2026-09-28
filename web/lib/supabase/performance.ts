import type { Database } from '@pb/core';
import { createClient } from '@/lib/supabase/client';

/**
 * One session the signed-in user played, at any host's table. `net_cents` is the player's
 * result — positive is a win — which is the OPPOSITE sign of computeBalanceCents, where
 * positive means the player owes the house. Read it as-is; never flip it.
 */
export type PerformanceRow = Database['public']['Functions']['get_my_performance']['Returns'][number];

/**
 * Every session the caller has bought into, oldest first (the RPC's own order). The Data API
 * caps a set-returning function at `max_rows` like any select, and a capped history would
 * draw a cumulative total that is silently wrong — so a short page fails loudly instead.
 */
export async function fetchMyPerformance(): Promise<PerformanceRow[]> {
  const { data, error, count } = await createClient().rpc('get_my_performance', undefined, { count: 'exact' });
  if (error) throw error;
  if (count !== null && data.length < count) {
    throw new Error(`get_my_performance returned ${data.length} of ${count} sessions`);
  }
  return data;
}
