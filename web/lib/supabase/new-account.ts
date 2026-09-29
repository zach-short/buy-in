import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@pb/core';

// Set in auth metadata when /welcome is finished, so a member who saved a profile but has not
// joined a table yet is not sent back through it on every sign-in.
export const WELCOMED_KEY = 'welcomed';

/**
 * True for a signed-in account that has not been through /welcome and runs no table and plays
 * at none: a brand-new account, from Google or email alike. Accounts from before /welcome
 * asked for a profile have a table or a seat, so they are never sent back. Any query failure
 * reads as false, so an outage sends nobody to the welcome steps by mistake.
 */
export async function needsWelcome(supabase: SupabaseClient<Database>): Promise<boolean> {
  const { data } = await supabase.auth.getUser();
  if (!data.user || data.user.user_metadata[WELCOMED_KEY] === true) return false;
  const [bars, seats] = await Promise.all([
    supabase.from('bars').select('id', { count: 'exact', head: true }),
    supabase.from('players').select('id', { count: 'exact', head: true }).eq('user_id', data.user.id),
  ]);
  if (bars.error || seats.error) return false;
  return bars.count === 0 && seats.count === 0;
}

/** /welcome, carrying where to go after it. A plain '/' means nobody chose, so it is left off. */
export function welcomePath(next: string): string {
  return next === '/' ? '/welcome' : `/welcome?${new URLSearchParams({ next })}`;
}

/** Where a fresh session goes: /welcome first for a new account, `next` for everyone else. */
export async function afterSignIn(supabase: SupabaseClient<Database>, next: string): Promise<string> {
  return (await needsWelcome(supabase)) ? welcomePath(next) : next;
}
