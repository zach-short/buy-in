import { createClient } from '@/lib/supabase/client';

// Self-service account deletion, backed by 0009_delete_my_account.sql (unapplied until the owner
// applies it). The database decides who may delete: a player row that owes money, or a bar with
// game history, refuses the delete inside the same transaction. This file only reads the check
// for the screen and asks for the delete — it enforces nothing.

export type BarAmount = { barName: string; cents: number };

export type DeletionCheck = {
  /** Bars where a row bound to this account owes the house. Any entry blocks the delete. */
  owes: BarAmount[];
  /** Bars where the house owes this account. Never blocks; the screen warns a second time. */
  owed: BarAmount[];
  /** Bars this account owns that hold sessions or payments. Any entry blocks the delete. */
  barsWithHistory: string[];
};

// PostgREST's "function not in the schema cache": 0009 is not applied where this build runs.
const FUNCTION_MISSING = 'PGRST202';

// 0009 raises one sentence per refusal. The words are open for the owner (R7).
const REFUSALS: Readonly<Record<string, string>> = {
  'you still owe money': "You can't delete your account while you owe money.",
  'you own a bar with game history': "You can't delete your account while you own a bar with game history.",
};

type Row = Record<string, unknown>;

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rows(value: unknown): Row[] {
  if (!Array.isArray(value) || !value.every(isRow)) throw new Error('Unexpected answer from the server.');
  return value;
}

function amounts(value: unknown): BarAmount[] {
  return rows(value).map((r) => {
    if (typeof r.bar_name !== 'string' || typeof r.cents !== 'number') throw new Error('Unexpected answer from the server.');
    return { barName: r.bar_name, cents: r.cents };
  });
}

function barNames(value: unknown): string[] {
  return rows(value).map((r) => {
    if (typeof r.bar_name !== 'string') throw new Error('Unexpected answer from the server.');
    return r.bar_name;
  });
}

function failure(error: { code?: string; message: string }): Error {
  if (error.code === FUNCTION_MISSING) return new Error("Account deletion isn't available yet.");
  if (!error.code) return new Error("Couldn't reach Buy-In. Check your connection and try again.");
  return new Error(REFUSALS[error.message] ?? error.message);
}

/** What this account owes, is owed, and owns — the screen's whole decision. */
export async function fetchDeletionCheck(): Promise<DeletionCheck> {
  const { data, error } = await createClient().rpc('get_account_deletion_check');
  if (error) throw failure(error);
  if (!isRow(data)) throw new Error('Unexpected answer from the server.');
  return { owes: amounts(data.owes), owed: amounts(data.owed), barsWithHistory: barNames(data.bars_with_history) };
}

/** Deletes the signed-in account. The caller signs out afterwards; the session outlives the user. */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await createClient().rpc('delete_my_account');
  if (error) throw failure(error);
}
