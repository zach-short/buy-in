// The peer-mode settlement optimizer. Built as pure logic per DESIGN.md D2, which
// ships the schema columns and this function but no peer-mode UI: nothing reads
// `sessions.settle_mode` yet. This exists now because it is cheap to write with
// tests and expensive to re-derive later.

export interface PlayerBalance {
  playerId: string;
  /** Positive means this player owes the group. Same convention as computeBalanceCents. */
  balanceCents: number;
}

export interface Transfer {
  fromPlayerId: string;
  toPlayerId: string;
  amountCents: number;
}

function byMagnitude(a: PlayerBalance, b: PlayerBalance): number {
  return Math.abs(b.balanceCents) - Math.abs(a.balanceCents);
}

function assertBalanced(balances: readonly PlayerBalance[]): void {
  const net = balances.reduce((total, b) => total + b.balanceCents, 0);
  if (net !== 0) {
    throw new Error(
      `settle() needs balances that net to zero; got ${net} cents. In banked mode the ` +
        `house absorbs the difference and this function does not apply.`,
    );
  }
}

/**
 * Greedily match the largest debtor against the largest creditor until everyone is
 * square. Returns the transfers to make, never mutating its input.
 *
 * Throws when the balances do not net to zero, rather than absorbing the difference:
 * an optimizer that quietly loses a cent is the silent failure this package exists to
 * prevent.
 */
export function settle(balances: readonly PlayerBalance[]): Transfer[] {
  assertBalanced(balances);
  const debtors = balances.filter((b) => b.balanceCents > 0).sort(byMagnitude);
  const creditors = balances.filter((b) => b.balanceCents < 0).sort(byMagnitude);
  const transfers: Transfer[] = [];
  let owed = debtors.map((d) => d.balanceCents);
  let due = creditors.map((c) => -c.balanceCents);

  for (let d = 0, c = 0; d < debtors.length && c < creditors.length; ) {
    const amountCents = Math.min(owed[d], due[c]);
    if (amountCents > 0) {
      transfers.push({
        fromPlayerId: debtors[d].playerId,
        toPlayerId: creditors[c].playerId,
        amountCents,
      });
    }
    owed[d] -= amountCents;
    due[c] -= amountCents;
    if (owed[d] === 0) d += 1;
    if (due[c] === 0) c += 1;
  }
  return transfers;
}
