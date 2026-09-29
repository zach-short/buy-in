import type { PostgrestError } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/client';

// A player says "I sent $X" from their portal link. The host sees the report as pending, then
// confirms it (which writes the real payment) or dismisses it. Every call here goes to
// 0013_payment_reports.sql, and the database holds every rule: portal links only, at most 3
// pending per player, $10,000 at most, and no second decision on a report. Nothing here enforces
// any of them. This file is only the way to ask.
//
// Until 0013 is applied, each call fails with "Needs database update 0013". Nothing outside the
// new action calls it, so no existing page breaks.

/** Mirrors 0013's amount check on payment_reports: $10,000. */
export const PAYMENT_REPORT_MAX_CENTS = 1_000_000;
/** Mirrors 0013's note length check on payment_reports. */
export const PAYMENT_REPORT_NOTE_MAX_LENGTH = 140;

export type PaymentReportStatus = 'pending' | 'confirmed' | 'dismissed';

/** One of the player's own reports, as their portal shows it. */
export type PaymentReport = {
  id: string;
  amountCents: number;
  note: string | null;
  status: PaymentReportStatus;
  createdAt: string;
  decidedAt: string | null;
};

/** A report waiting on a host, with the player's name for the queue. */
export type PendingPaymentReport = {
  id: string;
  playerId: string;
  playerName: string;
  amountCents: number;
  note: string | null;
  createdAt: string;
};

// PostgREST answers "not in the schema cache" for a function (PGRST202) or a table (PGRST205)
// that the database does not have yet. 42P01 is Postgres's own undefined_table, for a server
// that passes the query through before its cache knows better.
const MIGRATION_MISSING = new Set(['PGRST202', 'PGRST205', '42P01']);

// 0013 raises these sentences, and a few read better reworded for the page. Any other
// sentence is shown as-is, capitalised, as tables.ts does. The words are open for the owner
// (R7).
const SENTENCES: Readonly<Record<string, string>> = {
  'invalid or expired link': 'This link is no longer valid. Ask your host for a new one.',
  'too many reports waiting for your host': 'You already have 3 payments waiting for your host to confirm.',
};

function failure(error: PostgrestError): Error {
  if (MIGRATION_MISSING.has(error.code)) return new Error('Needs database update 0013');
  // postgrest-js reports a transport failure with an empty code (join.ts).
  if (!error.code) return new Error("Couldn't reach Buy-In. Check your connection and try again.");
  const text = SENTENCES[error.message] ?? error.message;
  return new Error(`${text.charAt(0).toUpperCase()}${text.slice(1)}${/[.!?]$/.test(text) ? '' : '.'}`);
}

function isStatus(value: unknown): value is PaymentReportStatus {
  return value === 'pending' || value === 'confirmed' || value === 'dismissed';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toReport(value: unknown): PaymentReport {
  if (!isRecord(value)) throw new Error('Unexpected answer from the server.');
  const { id, amount_cents, note, status, created_at, decided_at } = value;
  if (typeof id !== 'string' || typeof amount_cents !== 'number' || !isStatus(status)
      || typeof created_at !== 'string' || (note !== null && typeof note !== 'string')
      || (decided_at !== null && typeof decided_at !== 'string')) {
    throw new Error('Unexpected answer from the server.');
  }
  return { id, amountCents: amount_cents, note, status, createdAt: created_at, decidedAt: decided_at };
}

/** Player, anonymous: reports a payment sent to the host. Returns the new report's id. */
export async function reportPayment(token: string, amountCents: number, note?: string): Promise<string> {
  const { data, error } = await createClient()
    .rpc('report_payment', { p_token: token, p_amount_cents: amountCents, p_note: note });
  if (error) throw failure(error);
  return data;
}

/** Player, anonymous: the player's own reports behind this portal link, newest first (at most 20). */
export async function myPaymentReports(token: string): Promise<PaymentReport[]> {
  const { data, error } = await createClient().rpc('my_payment_reports', { p_token: token });
  if (error) throw failure(error);
  if (!Array.isArray(data)) throw new Error('Unexpected answer from the server.');
  return data.map(toReport);
}

/** Host: every report waiting in this host's bars, oldest first. Optionally just one player's. */
export async function listPendingPaymentReports(playerId?: string): Promise<PendingPaymentReport[]> {
  const query = createClient().from('payment_reports')
    .select('id, player_id, amount_cents, note, created_at, players(name)')
    .eq('status', 'pending').order('created_at', { ascending: true });
  const { data, error } = await (playerId ? query.eq('player_id', playerId) : query);
  if (error) throw failure(error);
  return data.map((r) => ({
    id: r.id,
    playerId: r.player_id,
    playerName: r.players?.name ?? '',
    amountCents: r.amount_cents,
    note: r.note,
    createdAt: r.created_at,
  }));
}

/**
 * Host: writes the real payment and marks the report confirmed, in one transaction.
 * `amountCents` overrides the reported amount when the Venmo differs. Returns the new
 * payment's id.
 */
export async function confirmPaymentReport(id: string, amountCents?: number): Promise<string> {
  const { data, error } = await createClient()
    .rpc('confirm_payment_report', { p_id: id, p_amount_cents: amountCents });
  if (error) throw failure(error);
  return data;
}

/** Host: closes the report without writing a payment. */
export async function dismissPaymentReport(id: string): Promise<void> {
  const { error } = await createClient().rpc('dismiss_payment_report', { p_id: id });
  if (error) throw failure(error);
}
