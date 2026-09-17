// Pure URL construction only. The navigation half — assigning window.location and the
// 1500ms fallback to the web URL — stays in web/, because @pb/core may not touch
// `window` or `document` (packages/core/src/index.ts:1-4).
//
// This replaces three divergent builders that disagreed about both the recipient and
// the note: web/lib/bar-api.ts:111-118 paid the *player's* handle with the note
// 'poker'; player-receipt paid the host's handle with 'poker' and charged when the
// balance was negative; receipt-ui paid the host's handle with the session name.
// DESIGN.md D12 settles the note; the recipient is always the host's handle, which
// after the migration comes from bars.venmo_handle rather than an env var (D6).

import { formatCents } from './money';

export const VENMO_NOTE_PREFIX = 'Poker Bar';

export type VenmoTxn = 'pay' | 'charge';

export interface VenmoUrls {
  deepLink: string;
  webUrl: string;
}

/** `Poker Bar — Friday Night`. The plain register, chosen at GATE 1 (DESIGN.md D12). */
export function venmoNote(sessionName: string): string {
  return `${VENMO_NOTE_PREFIX} — ${sessionName}`;
}

/**
 * Which direction the handoff runs, from a balance in the house convention:
 * positive means the player owes, so the player pays.
 */
export function venmoTxnFor(balanceCents: number): VenmoTxn {
  return balanceCents > 0 ? 'pay' : 'charge';
}

export function venmoUrls(
  handle: string,
  amountCents: number,
  note: string,
  txn: VenmoTxn = 'pay',
): VenmoUrls {
  const recipient = handle.replace(/^@/, '');
  const amount = formatCents(Math.abs(amountCents));
  const encoded = encodeURIComponent(note);
  const query = `recipients=${recipient}&amount=${amount}&note=${encoded}`;
  const webTxn = txn === 'charge' ? 'txn=charge&' : '';
  return {
    deepLink: `venmo://paycharge?txn=${txn}&${query}`,
    webUrl: `https://account.venmo.com/pay?${webTxn}${query}`,
  };
}
