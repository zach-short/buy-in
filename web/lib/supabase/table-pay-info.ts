import { createClient } from '@/lib/supabase/client';

// The host's pay handles for each table this account sits at, from 0031. They are what a portal
// link already hands a player (get_shared_tab), so a seated member sees nothing new.

export type TablePayInfo = {
  barId: string;
  venmoHandle: string | null;
  cashappHandle: string | null;
  venmoNoteTemplate: string | null;
};

// PostgREST's "function not in the schema cache", as member-games.ts checks it.
const FUNCTION_MISSING = 'PGRST202';

/**
 * Where 0031 is not applied yet, no handles rather than an error: Home still shows what the
 * member owes and the "I paid" text, just without a Pay button.
 */
export async function fetchMyTablePayInfo(): Promise<TablePayInfo[]> {
  const { data, error } = await createClient().rpc('get_my_table_pay_info');
  if (error?.code === FUNCTION_MISSING) return [];
  if (error) throw error;
  return data.map((row) => ({
    barId: row.bar_id,
    venmoHandle: row.venmo_handle,
    cashappHandle: row.cashapp_handle,
    venmoNoteTemplate: row.venmo_note_template,
  }));
}
