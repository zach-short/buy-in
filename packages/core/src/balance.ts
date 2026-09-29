/**
 * A player's balance, in integer cents.
 *
 * The convention is load-bearing and is preserved exactly from the pre-migration
 * implementation (web/lib/bar-api.ts:127-140): **positive means the player owes the
 * house.** Drinks and buy-ins increase what they owe; cashouts and payments they have
 * already made reduce it; money sent back to them increases it again.
 */
export interface OrderLike {
  playerId: string;
  priceCents: number;
}

export interface AmountLike {
  playerId: string;
  amountCents: number;
}

export interface PaymentLike {
  playerId: string;
  amountCents: number;
  direction: 'received' | 'sent';
}

function sumFor(playerId: string, rows: readonly AmountLike[]): number {
  return rows
    .filter((r) => r.playerId === playerId)
    .reduce((total, r) => total + r.amountCents, 0);
}

function sumPayments(
  playerId: string,
  payments: readonly PaymentLike[],
  direction: PaymentLike['direction'],
): number {
  return payments
    .filter((p) => p.playerId === playerId && p.direction === direction)
    .reduce((total, p) => total + p.amountCents, 0);
}

export function computeBalanceCents(
  playerId: string,
  orders: readonly OrderLike[],
  buyIns: readonly AmountLike[],
  cashouts: readonly AmountLike[],
  payments: readonly PaymentLike[],
): number {
  const drinks = orders
    .filter((o) => o.playerId === playerId)
    .reduce((total, o) => total + o.priceCents, 0);
  const received = sumPayments(playerId, payments, 'received');
  const sent = sumPayments(playerId, payments, 'sent');
  return drinks + sumFor(playerId, buyIns) - sumFor(playerId, cashouts) - received + sent;
}

/**
 * Every player's computeBalanceCents in one pass over the four lists, for a screen listing
 * many players: calling computeBalanceCents per player rescans every list once per player.
 * computeBalanceCents stays the rule; the signs here are its signs, row by row, and
 * tests/balances-by-player.test.ts checks the two agree. A player with no rows is absent,
 * which a caller reads as 0 — what computeBalanceCents returns for them.
 */
export function balancesByPlayer(
  orders: readonly OrderLike[],
  buyIns: readonly AmountLike[],
  cashouts: readonly AmountLike[],
  payments: readonly PaymentLike[],
): Map<string, number> {
  const balances = new Map<string, number>();
  const add = (playerId: string, cents: number) => balances.set(playerId, (balances.get(playerId) ?? 0) + cents);
  for (const o of orders) add(o.playerId, o.priceCents);
  for (const b of buyIns) add(b.playerId, b.amountCents);
  for (const c of cashouts) add(c.playerId, -c.amountCents);
  for (const p of payments) {
    // Tested one direction at a time, as sumPayments does: any other value counts for nothing.
    if (p.direction === 'received') add(p.playerId, -p.amountCents);
    else if (p.direction === 'sent') add(p.playerId, p.amountCents);
  }
  return balances;
}

/**
 * In integer cents "settled" is exact equality, not the float epsilon
 * `Math.abs(balance) < 0.01` the pre-migration code had to use
 * (web/lib/bar-api.ts:134-139). Same rule, stated exactly.
 */
export function isSettled(balanceCents: number): boolean {
  return balanceCents === 0;
}
