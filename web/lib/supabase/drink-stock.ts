import type { PostgrestError } from '@supabase/supabase-js';

import { writeErrorMessage } from '@pb/core';
import { createClient } from '@/lib/supabase/client';
import type { OrderRow } from '@/lib/supabase/queries';
import type { PourResult } from '@/lib/supabase/writes';

// The two writes that need 0011_drinks_stock.sql: pouring past a stock count the host says is
// wrong, and archiving a drink. Each is reached only from the action that needs it, so every
// existing screen keeps working on a database without 0011.

// What a database without 0011 answers: PostgREST cannot find create_order with p_allow_short
// (PGRST202) or drinks.archived_at (PGRST204) in its schema cache; Postgres itself would say
// undefined function (42883) or undefined column (42703) if the request got that far.
const MISSING_MIGRATION: ReadonlySet<string> = new Set(['PGRST202', 'PGRST204', '42883', '42703']);

export const NEEDS_MIGRATION_MESSAGE = 'Needs database update 0011';

function fail(error: PostgrestError): never {
  if (MISSING_MIGRATION.has(error.code)) throw new Error(NEEDS_MIGRATION_MESSAGE);
  throw new Error(writeErrorMessage(error));
}

/**
 * pourDrink (writes.ts) for "Pour anyway": 0011 create_order with p_allow_short, so a short
 * ingredient is taken to zero instead of refusing the pour. Only call it after the host chooses to.
 */
export async function createOrderAllowShort(sessionId: string, playerId: string, drinkId: string): Promise<PourResult> {
  const { data, error } = await createClient().rpc('create_order', {
    p_session_id: sessionId, p_player_id: playerId, p_drink_id: drinkId, p_allow_short: true,
  });
  if (error) fail(error);
  const result = data as { order: OrderRow; low_stock_warnings: string[] };
  return { order: result.order, lowStockWarnings: result.low_stock_warnings };
}

/** Archives or restores a drink. drinks_staff (0001) admits the update; RLS refusal matches no row. */
export async function setDrinkArchived(drinkId: string, archived: boolean): Promise<void> {
  const { data, error } = await createClient()
    .from('drinks')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', drinkId)
    .select('id');
  if (error) fail(error);
  if (!data?.length) throw new Error('Drink not found');
}

/** True only when the row carries a timestamp; a row read before 0011 has no column and is active. */
// Takes any object on purpose: callers pass their own row types, and some are read before the column exists.
export function isDrinkArchived(drink: object): boolean {
  return (drink as { archived_at?: string | null }).archived_at != null;
}
