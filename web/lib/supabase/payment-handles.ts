import { writeErrorMessage } from '@pb/core';
import { createClient } from '@/lib/supabase/client';

// The host's Venmo and Cash App handles, set at signup (pending-bar.ts) and editable here.
// Its own module because bar-settings.ts belongs to another change. Same zero-row rule as
// there: only the owner passes bars_owner_write (0001), and anyone else matches no rows.

export interface PaymentHandles {
  barId: string;
  venmo: string;
  cashapp: string;
}

// Venmo links strip a leading @ (venmoUrls), so it is stored without one.
export function normalizeVenmo(raw: string): string {
  return raw.trim().replace(/^@+/, '');
}

// A cashtag is `$name`; hosts type it either way, so store one canonical form.
export function normalizeCashapp(raw: string): string {
  const name = raw.trim().replace(/^\$+/, '');
  return name && `$${name}`;
}

const VENMO_PATTERN = /^[A-Za-z0-9_-]{5,30}$/;
const CASHAPP_PATTERN = /^\$[A-Za-z][A-Za-z0-9_]{0,19}$/;

/** A message for a handle that cannot be real, or null. Blank is fine: it clears the handle. */
export function validateHandles(venmo: string, cashapp: string): string | null {
  if (venmo && !VENMO_PATTERN.test(venmo)) return 'Venmo handles are 5-30 letters, numbers, dashes or underscores';
  if (cashapp && !CASHAPP_PATTERN.test(cashapp)) return 'Cash App cashtags start with a letter and use letters, numbers or underscores';
  return null;
}

export async function fetchPaymentHandles(): Promise<PaymentHandles> {
  const { data, error } = await createClient().from('bars').select('id, venmo_handle, cashapp_handle').limit(2);
  if (error) throw new Error(writeErrorMessage(error));
  if (data.length !== 1) throw new Error(`Expected one bar for this account, found ${data.length}`);
  const [bar] = data;
  return { barId: bar.id, venmo: bar.venmo_handle ?? '', cashapp: bar.cashapp_handle ?? '' };
}

/** Blank handles are stored as `null`, which the receipt pages already treat as unset. */
export async function updatePaymentHandles(barId: string, venmo: string, cashapp: string): Promise<void> {
  const { data, error } = await createClient().from('bars')
    .update({ venmo_handle: venmo || null, cashapp_handle: cashapp || null }).eq('id', barId).select('id');
  if (error) throw new Error(writeErrorMessage(error));
  if (!data?.length) throw new Error('Only the bar owner can change payment handles');
}
