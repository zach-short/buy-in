import type { SupabaseClient } from '@supabase/supabase-js';

import { writeErrorMessage, type Database } from '@pb/core';

export interface BarFields {
  barName: string;
  venmo: string;
  cashapp: string;
}

// With Confirm email on, a host's table cannot be created at sign-up: create_bar needs a
// session and none exists until the link is clicked, possibly on another device. The fields
// ride along in the auth user's metadata instead, and whichever page first holds a session
// (/auth/callback, or /login) creates the table and clears them.
export const PENDING_BAR_KEY = 'pending_bar';

function isBarFields(value: unknown): value is BarFields {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.barName === 'string' && typeof v.venmo === 'string' && typeof v.cashapp === 'string';
}

export async function createBarWith(supabase: SupabaseClient<Database>, fields: BarFields): Promise<void> {
  // Omitted handles, not nulls: the generated Args type them `string | undefined`, and the
  // SQL defaults are null, so a blank field lands as null either way.
  const { error } = await supabase.rpc('create_bar', {
    p_name: fields.barName.trim(),
    p_venmo_handle: fields.venmo.trim() || undefined,
    p_cashapp_handle: fields.cashapp.trim() || undefined,
  });
  if (error) throw new Error(writeErrorMessage(error));
}

/** No-op unless this user signed up as a host and has not had a table created yet. */
export async function completePendingBar(supabase: SupabaseClient<Database>): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const pending: unknown = data.user?.user_metadata[PENDING_BAR_KEY];
  if (!isBarFields(pending)) return;
  await createBarWith(supabase, pending);
  // Cleared only after create_bar succeeds, so a failure leaves it for the next sign-in to retry.
  await supabase.auth.updateUser({ data: { [PENDING_BAR_KEY]: null } });
}
