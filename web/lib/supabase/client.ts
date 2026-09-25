import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@pb/core';
import { clientEnv } from '@/lib/env/client';

// BD-5 (PLAN.md §1): the one browser-side Supabase client. createBrowserClient is a singleton
// in the browser, so calling this per component does not open a second auth listener.
export function createClient() {
  return createBrowserClient<Database>(clientEnv.supabaseUrl, clientEnv.supabasePublishableKey);
}
