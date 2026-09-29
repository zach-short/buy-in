/**
 * What leaving a table does to a player, given their balance there.
 *
 * Takes the computeBalanceCents convention as it stands: **positive means the player owes
 * the house**. Leaving hands the row back to the host unclaimed, so a debt stays on the
 * host's books with nobody to collect it from, and a credit stays with nobody to ask for it —
 * hence a block for the first and a warning for the second. leave_table (0010) makes the same
 * call in SQL and is the one that enforces it; this is what the button reads to explain it.
 */
export type LeaveTableVerdict = 'blocked' | 'owed' | 'clear';

export function leaveTableVerdict(balanceCents: number): LeaveTableVerdict {
  if (balanceCents > 0) return 'blocked';
  if (balanceCents < 0) return 'owed';
  return 'clear';
}
