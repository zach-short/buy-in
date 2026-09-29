import type { PostgrestError } from '@supabase/supabase-js';

import { writeErrorMessage } from '@pb/core';
import { createClient } from '@/lib/supabase/client';

// Correcting a night's money from the live session screen: fixing or removing a mistyped
// buy-in or cash-out. Plain single-row writes — buy_ins_staff and cashouts_staff (0001) are
// `for all`, so RLS already admits staff updates and deletes and no migration is needed.
// Each asks for the row back, because a refused or already-deleted row matches nothing and
// returns no error; saying "saved" then would be a lie about money.

function fail(error: PostgrestError): never {
  throw new Error(writeErrorMessage(error));
}

function requireRow(rows: readonly unknown[] | null, notFound: string): void {
  if (!rows?.length) throw new Error(notFound);
}

const BUY_IN_GONE = 'That buy-in is gone — it may have been changed on another device';
const CASHOUT_GONE = 'That cash-out is gone — it may have been changed on another device';

/** buy_ins.amount_cents is `check (> 0)` (0001): a zero buy-in is a delete, not an edit. */
export async function updateBuyInAmount(id: string, amountCents: number): Promise<void> {
  const { data, error } = await createClient().from('buy_ins').update({ amount_cents: amountCents }).eq('id', id).select('id');
  if (error) fail(error);
  requireRow(data, BUY_IN_GONE);
}

export async function deleteBuyIn(id: string): Promise<void> {
  const { data, error } = await createClient().from('buy_ins').delete().eq('id', id).select('id');
  if (error) fail(error);
  requireRow(data, BUY_IN_GONE);
}

/** cashouts.amount_cents is `check (>= 0)` (0001): $0 is a real cash-out — the player busted. */
export async function updateCashoutAmount(id: string, amountCents: number): Promise<void> {
  const { data, error } = await createClient().from('cashouts').update({ amount_cents: amountCents }).eq('id', id).select('id');
  if (error) fail(error);
  requireRow(data, CASHOUT_GONE);
}

export async function deleteCashout(id: string): Promise<void> {
  const { data, error } = await createClient().from('cashouts').delete().eq('id', id).select('id');
  if (error) fail(error);
  requireRow(data, CASHOUT_GONE);
}
