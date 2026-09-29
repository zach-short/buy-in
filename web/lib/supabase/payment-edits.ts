import type { PostgrestError } from '@supabase/supabase-js';

import { writeErrorMessage } from '@pb/core';
import { createClient } from '@/lib/supabase/client';

// Correcting the host's own payment records: a mistyped $450 must not be permanent. Staff may
// delete a payment under payments_staff (0001, `for all`), so this is a plain table write. The
// balance is a sum over rows (@pb/core computeBalanceCents), so deleting the row is the whole
// correction — nothing else stores a total. A payment a player reported and the host confirmed
// (0013) can be deleted too; 0013's foreign key nulls the report's payment_id and keeps it.

function fail(error: PostgrestError): never {
  throw new Error(writeErrorMessage(error));
}

/** Deletes one payment. Throws when nothing was deleted rather than reporting a silent success. */
export async function deletePayment(paymentId: string): Promise<void> {
  const { data, error } = await createClient().from('payments').delete().eq('id', paymentId).select('id');
  if (error) fail(error);
  // Under RLS a refused DELETE matches zero rows and returns no error (0002's header).
  if (!data.length) throw new Error('That payment is already gone.');
}
