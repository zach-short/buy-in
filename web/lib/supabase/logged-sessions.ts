import type { PostgrestError } from '@supabase/supabase-js';

import { writeErrorMessage, type Database } from '@pb/core';
import { createClient } from '@/lib/supabase/client';

/**
 * A game the signed-in player logged themselves, away from any table (0021). Only the owner
 * can read or write one: logged_sessions_own is keyed on user_id = auth.uid(), so this select
 * needs no user filter and cannot return anyone else's row.
 */
export type LoggedSessionRow = Database['public']['Tables']['logged_sessions']['Row'];

/** What the log form writes. `user_id` defaults to auth.uid() in the table, so it is never sent. */
export type LoggedSessionInput = Omit<Database['public']['Tables']['logged_sessions']['Insert'], 'id' | 'user_id' | 'created_at'>;

/**
 * Every session the caller logged, oldest first. As fetchMyPerformance does, a read the Data
 * API capped at `max_rows` fails loudly: a short history would draw a cumulative total that is
 * silently wrong.
 */
export async function fetchMyLoggedSessions(): Promise<LoggedSessionRow[]> {
  const { data, error, count } = await createClient()
    .from('logged_sessions')
    .select('*', { count: 'exact' })
    .order('played_on')
    .order('id');
  if (error) throw error;
  if (count !== null && data.length < count) {
    throw new Error(`logged_sessions returned ${data.length} of ${count} sessions`);
  }
  return data;
}

// A hand-edited URL is not a uuid, and Postgres would answer it with a cast error (22P02). It
// names no row either way, so the edit page says "not found" rather than showing that error.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One logged session, or null when it is gone or another account's — RLS hides both alike. */
export async function fetchLoggedSession(id: string): Promise<LoggedSessionRow | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await createClient().from('logged_sessions').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

// Each write asks for the row back, as session-edits.ts does: a refused or already-deleted row
// matches nothing and returns no error, and saying "saved" then would be a lie about money.

function fail(error: PostgrestError): never {
  throw new Error(writeErrorMessage(error));
}

function requireRow(rows: readonly unknown[] | null, notFound: string): void {
  if (!rows?.length) throw new Error(notFound);
}

const GONE = 'That session is gone — it may have been deleted on another device';

export async function createLoggedSession(input: LoggedSessionInput): Promise<void> {
  const { data, error } = await createClient().from('logged_sessions').insert(input).select('id');
  if (error) fail(error);
  requireRow(data, 'That session was not saved — try again');
}

export async function updateLoggedSession(id: string, input: LoggedSessionInput): Promise<void> {
  const { data, error } = await createClient().from('logged_sessions').update(input).eq('id', id).select('id');
  if (error) fail(error);
  requireRow(data, GONE);
}

export async function deleteLoggedSession(id: string): Promise<void> {
  const { data, error } = await createClient().from('logged_sessions').delete().eq('id', id).select('id');
  if (error) fail(error);
  requireRow(data, GONE);
}
