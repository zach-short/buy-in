import { createClient } from '@/lib/supabase/client';

/** Whether an account is registered for this address (0007). Throws when the lookup fails. */
export async function emailHasAccount(email: string): Promise<boolean> {
  const { data, error } = await createClient().rpc('email_has_account', { p_email: email.trim() });
  if (error) throw new Error(error.message);
  return data === true;
}
