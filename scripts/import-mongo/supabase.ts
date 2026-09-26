import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@pb/core';

import type { ImportEnv } from './env';

export type Db = SupabaseClient<Database>;

// A one-shot job: there is no session to persist, refresh, or pick up from a URL.
const SERVER_AUTH = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

/** Service role — bypasses RLS by design (D9). A trusted job the owner runs; never shipped. */
export function serviceClient(env: ImportEnv): Db {
  return createClient<Database>(env.supabaseUrl, env.serviceRoleKey, { auth: SERVER_AUTH });
}

/** The publishable key: exactly the anonymous caller a public receipt page is. */
export function anonClient(env: ImportEnv): Db {
  return createClient<Database>(env.supabaseUrl, env.publishableKey, { auth: SERVER_AUTH });
}

export function projectRef(env: ImportEnv): string {
  return new URL(env.supabaseUrl).hostname.split('.')[0] ?? '';
}

// Only the message and code are surfaced. PostgREST's `details` echoes the offending
// row's values — a name in a unique violation — and this output goes into reports.
export function check(error: { message: string; code?: string } | null, context: string): void {
  if (error) throw new Error(`${context}: ${error.message}${error.code ? ` (${error.code})` : ''}`);
}
