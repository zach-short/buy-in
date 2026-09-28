import { writeErrorMessage } from '@pb/core';
import { createClient } from '@/lib/supabase/client';

// DESIGN.md D5's named reversal: self-service sign-up, then BD-1's create_bar for a host.
// The bar's owner membership comes from 0001's bars_owner_membership trigger, not from here.

export interface AccountFields {
  name: string;
  email: string;
  password: string;
}

export interface BarFields {
  barName: string;
  venmo: string;
  cashapp: string;
}

/** `signed-in` when the project auto-confirms email; `confirm-email` when it does not. */
export type AccountResult = 'signed-in' | 'confirm-email';

export async function createAccount(fields: AccountFields): Promise<AccountResult> {
  const { data, error } = await createClient().auth.signUp({
    email: fields.email.trim(),
    password: fields.password,
    options: { data: { full_name: fields.name.trim() } },
  });
  if (error) throw new Error(error.message);
  // With Confirm email on, Supabase returns a user and no session, and for an address that
  // is already registered, a decoy user with no error. Either way nobody is signed in, so
  // create_bar would run as anon. Off (mailer_autoconfirm, live 2026-09-28) a session comes back.
  return data.session ? 'signed-in' : 'confirm-email';
}

export async function createBar(fields: BarFields): Promise<void> {
  // Omitted handles, not nulls: the generated Args type them `string | undefined`, and the
  // SQL defaults are null, so a blank field lands as null either way.
  const { error } = await createClient().rpc('create_bar', {
    p_name: fields.barName.trim(),
    p_venmo_handle: fields.venmo.trim() || undefined,
    p_cashapp_handle: fields.cashapp.trim() || undefined,
  });
  if (error) throw new Error(writeErrorMessage(error));
}
