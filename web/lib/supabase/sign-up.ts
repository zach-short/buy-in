import { createClient } from '@/lib/supabase/client';
import { PENDING_BAR_KEY, type BarFields } from '@/lib/supabase/pending-bar';

export type { BarFields };

// DESIGN.md D5's named reversal: self-service sign-up, then BD-1's create_bar for a host.
// The bar's owner membership comes from 0001's bars_owner_membership trigger, not from here.

export interface AccountFields {
  name: string;
  email: string;
  password: string;
}

/** `signed-in` when the project auto-confirms email; `confirm-email` when it does not. */
export type AccountResult = 'signed-in' | 'confirm-email';

// The confirm link lands on the same callback Google uses. `flow=signup` tells it that a failed
// code exchange (link opened in a different browser, so no PKCE verifier) still means the
// address is confirmed: Supabase confirms it before redirecting, and only the sign-in is lost.
export function confirmRedirectUrl(next: string): string {
  return `${window.location.origin}/auth/callback?flow=signup&next=${encodeURIComponent(next)}`;
}

export interface AccountOptions {
  next: string;
  /** A host's table, held in user metadata until a session exists to create it with. */
  pendingBar: BarFields | null;
}

export async function createAccount(fields: AccountFields, options: AccountOptions): Promise<AccountResult> {
  const { data, error } = await createClient().auth.signUp({
    email: fields.email.trim(),
    password: fields.password,
    options: {
      emailRedirectTo: confirmRedirectUrl(options.next),
      data: { full_name: fields.name.trim(), [PENDING_BAR_KEY]: options.pendingBar },
    },
  });
  if (error) throw new Error(error.message);
  // With Confirm email on, Supabase returns a user and no session, and for an address that
  // is already registered, a decoy user with no error. Either way nobody is signed in, so
  // create_bar would run as anon. Off (mailer_autoconfirm, live 2026-09-28) a session comes back.
  return data.session ? 'signed-in' : 'confirm-email';
}
