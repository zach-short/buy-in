import type { CashoutRow } from '@/lib/supabase/queries';

// The arithmetic and the write plan behind closing a night, kept apart from React so each
// rule is readable on its own. Every amount is integer cents.

export interface CashoutEntry {
  playerId: string;
  name: string;
  /** null = nothing typed yet. Never read as $0: busted is an explicit choice. */
  cents: number | null;
}

export type CashoutWrite =
  | { kind: 'insert'; playerId: string; cents: number }
  | { kind: 'update'; playerId: string; id: string; cents: number }
  | { kind: 'keep'; playerId: string };

export function missingNames(entries: readonly CashoutEntry[]): string[] {
  return entries.filter((e) => e.cents === null).map((e) => e.name);
}

export function totalOutCents(entries: readonly CashoutEntry[]): number {
  return entries.reduce((sum, e) => sum + (e.cents ?? 0), 0);
}

/**
 * One write per player against the cash-outs as they are in the database NOW (the caller
 * refetches first): a row that exists is updated — so editing a prefilled value is kept, and
 * a retry after a partial failure never re-inserts into cashouts_session_player_uniq — and
 * a row that matches is left alone.
 */
export function planCashoutWrites(entries: readonly CashoutEntry[], existing: readonly CashoutRow[]): CashoutWrite[] {
  return entries.map(({ playerId, cents }) => {
    if (cents === null) throw new Error('planCashoutWrites needs every cash-out entered');
    const row = existing.find((c) => c.player_id === playerId);
    if (!row) return { kind: 'insert', playerId, cents };
    if (row.amount_cents === cents) return { kind: 'keep', playerId };
    return { kind: 'update', playerId, id: row.id, cents };
  });
}
