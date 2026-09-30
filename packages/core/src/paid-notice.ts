import { formatCents } from './money';

/**
 * The text a member sends their host after paying: "I paid my $38 balance at your table".
 * The amount is what they paid, which is the whole balance unless they paid part of it.
 * Wording chosen by the owner 2026-09-29; "debt" changed to "balance" the same day.
 */
export function paidNotice(amountCents: number): string {
  return `I paid my $${formatCents(Math.abs(amountCents))} balance at your table`;
}
