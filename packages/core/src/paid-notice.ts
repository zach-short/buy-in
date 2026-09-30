import { formatCents } from './money';

/**
 * The text a member sends their host after paying: "I paid for my $38 debt at your table".
 * The amount is what they paid, which is the whole debt unless they paid part of it.
 * Wording chosen by the owner 2026-09-29.
 */
export function paidNotice(amountCents: number): string {
  return `I paid for my $${formatCents(Math.abs(amountCents))} debt at your table`;
}
