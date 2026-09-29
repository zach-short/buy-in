import type { PostgrestError } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/client';

// The tables this account is seated at, and leaving one. Both go to 0010_leave_table.sql, which
// enforces the rule — blocked while the player owes, refused without consent while they are
// owed — so nothing here is the check, only the way to ask.

/** `balanceCents` keeps computeBalanceCents' sign: positive means the player owes the house. */
export type MyTable = { barId: string; barName: string; balanceCents: number };

/** Every table the signed-in account holds a player row at, by name. */
export async function fetchMyTables(): Promise<MyTable[]> {
  const { data, error } = await createClient().rpc('get_my_tables');
  if (error) throw error;
  return data.map((row) => ({ barId: row.bar_id, barName: row.bar_name, balanceCents: row.balance_cents }));
}

// A player-facing failure reads as the database's own sentence, capitalised (claims.ts hostError).
// The words are 0010's and open for the owner (R7).
function leaveError(error: PostgrestError): Error {
  if (!error.code) return new Error("Couldn't reach Buy-In. Check your connection and try again.");
  return new Error(`${error.message.charAt(0).toUpperCase()}${error.message.slice(1)}.`);
}

/** `acceptCredit` is the player having read the warning that the house owes them. */
export async function leaveTable(barId: string, acceptCredit: boolean): Promise<void> {
  const { error } = await createClient().rpc('leave_table', { p_bar_id: barId, p_accept_credit: acceptCredit });
  if (error) throw leaveError(error);
}
