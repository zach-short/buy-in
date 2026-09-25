import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { Database } from '@pb/core';
import { clientEnv } from '@/lib/env/client';

// BD-5 (PLAN.md §1): the one server-side Supabase client, for Server Components, Server Actions
// and Route Handlers. Phase 4 wires it; phase 5 is the first to read data through it.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(clientEnv.supabaseUrl, clientEnv.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // A Server Component may not set cookies, so this throws there by design. Nothing is
          // lost: proxy.ts already refreshed the session on this same request.
        }
      },
    },
  });
}
