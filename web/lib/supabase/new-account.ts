import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@pb/core';

/**
 * True for a signed-in account that runs no table and plays at none: a first Google sign-in,
 * which — unlike the email form — never asked whether they host or play. Any query failure
 * reads as false, so an outage sends nobody to the role choice by mistake.
 */
export async function hasNoTableOrSeat(supabase: SupabaseClient<Database>): Promise<boolean> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return false;
  const [bars, seats] = await Promise.all([
    supabase.from('bars').select('id', { count: 'exact', head: true }),
    supabase.from('players').select('id', { count: 'exact', head: true }).eq('user_id', data.user.id),
  ]);
  if (bars.error || seats.error) return false;
  return bars.count === 0 && seats.count === 0;
}
