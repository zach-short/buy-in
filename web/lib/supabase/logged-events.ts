import type { PostgrestError } from '@supabase/supabase-js';

import { writeErrorMessage, type Database } from '@pb/core';
import { createClient } from '@/lib/supabase/client';

/**
 * A result the signed-in player logged themselves that is not poker — a sports bet, a night at
 * blackjack (0027). Only the owner can read or write one: logged_events_own is keyed on
 * user_id = auth.uid(), so this select needs no user filter and cannot return anyone else's row.
 * Its net is payout minus stake, won-positive (`eventNetCents` in @pb/core); never flip it.
 */
export type LoggedEventRow = Database['public']['Tables']['logged_events']['Row'];

/** What the event form writes. `user_id` defaults to auth.uid() in the table, so it is never sent. */
export type LoggedEventInput = Omit<Database['public']['Tables']['logged_events']['Insert'], 'id' | 'user_id' | 'created_at'>;

/**
 * Every event the caller logged, oldest first. As fetchMyLoggedSessions does, a read the Data
 * API capped at `max_rows` fails loudly: a short history would draw a cumulative total that is
 * silently wrong (log-events SCOPE H10).
 */
export async function fetchMyLoggedEvents(): Promise<LoggedEventRow[]> {
  const { data, error, count } = await createClient()
    .from('logged_events')
    .select('*', { count: 'exact' })
    .order('played_on')
    .order('id');
  if (error) throw error;
  if (count !== null && data.length < count) {
    throw new Error(`logged_events returned ${data.length} of ${count} events`);
  }
  return data;
}

// The helpers below are logged-sessions.ts's, copied rather than imported: that file is poker's,
// and the two tables are meant to change independently (log-events PLAN.md BD-1).

// A hand-edited URL is not a uuid, and Postgres would answer it with a cast error (22P02). It
// names no row either way, so the edit page says "not found" rather than showing that error.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One logged event, or null when it is gone or another account's — RLS hides both alike. */
export async function fetchLoggedEvent(id: string): Promise<LoggedEventRow | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await createClient().from('logged_events').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

// Each write asks for the row back: a refused or already-deleted row matches nothing and
// returns no error, and saying "saved" then would be a lie about money.

function fail(error: PostgrestError): never {
  throw new Error(writeErrorMessage(error));
}

function requireRow(rows: readonly unknown[] | null, notFound: string): void {
  if (!rows?.length) throw new Error(notFound);
}

const GONE = 'That event is gone — it may have been deleted on another device';

export async function createLoggedEvent(input: LoggedEventInput): Promise<void> {
  const { data, error } = await createClient().from('logged_events').insert(input).select('id');
  if (error) fail(error);
  requireRow(data, 'That event was not saved — try again');
}

export async function updateLoggedEvent(id: string, input: LoggedEventInput): Promise<void> {
  const { data, error } = await createClient().from('logged_events').update(input).eq('id', id).select('id');
  if (error) fail(error);
  requireRow(data, GONE);
}

export async function deleteLoggedEvent(id: string): Promise<void> {
  const { data, error } = await createClient().from('logged_events').delete().eq('id', id).select('id');
  if (error) fail(error);
  requireRow(data, GONE);
}
