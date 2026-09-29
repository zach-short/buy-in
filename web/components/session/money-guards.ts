import { formatCents } from '@pb/core';

import type { ConfirmOptions } from '@/hooks/use-confirm';

// Shared by every money entry on the live session screen, so a $200 rebuy, a $200 early
// cash-out and a $200 edit all ask the same question.

/** Anything over $100 in one entry is asked about: at a home game it is far likelier a typo (2000 for 20). */
export const LARGE_AMOUNT_CENTS = 10000;

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

/** Resolves true without asking when the amount is ordinary. `what` reads as "re-buy", "cash-out", … */
export function confirmLargeAmount(confirm: Confirm, cents: number, what: string, playerName: string): Promise<boolean> {
  if (cents <= LARGE_AMOUNT_CENTS) return Promise.resolve(true);
  return confirm({
    title: `Record $${formatCents(cents)} ${what} for ${playerName}?`,
    description: 'That is more than $100 in one entry. Check the amount before saving.',
    confirmLabel: 'Record it',
  });
}

// postgrest-js turns a fetch that never got an answer into `{ message: '<name>: <message>',
// code: '' }` — 'TypeError: Failed to fetch' (Chrome), 'TypeError: Load failed' (Safari),
// 'TypeError: NetworkError when attempting to fetch resource.' (Firefox) — and
// writeErrorMessage passes it through unchanged.
const NETWORK_FAILURE = /^(TypeError|FetchError): (Failed to fetch|Load failed|NetworkError)/;

export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return e instanceof Error && NETWORK_FAILURE.test(e.message);
}

/** The message to show for a failed write: the raw "TypeError: Failed to fetch" is not one. */
export function writeFailureMessage(e: unknown, offline: string): string {
  if (isNetworkError(e)) return offline;
  return e instanceof Error ? e.message : String(e);
}

/** cashouts_session_player_uniq (0001): one cash-out per player per night. */
export function isDuplicateCashout(e: unknown): boolean {
  return e instanceof Error && e.message.includes('cashouts_session_player_uniq');
}
