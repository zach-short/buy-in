import { computeBalanceCents, type AmountLike, type OrderLike, type PaymentLike } from './balance';

// One player's money for one night, in integer cents. Before this existed, three screens
// each re-derived it and each got a different part wrong: the session summary left out
// drinks, and the receipt and player page left out payments and read only the first
// cash-out. The net is computeBalanceCents — same formula, same sign (positive means the
// player owes the house) — so there is still exactly one place the rule is written.

/** A night's rows. Rows for other players may be included; they are ignored. */
export interface NightRows {
  orders: readonly OrderLike[];
  buyIns: readonly AmountLike[];
  cashouts: readonly AmountLike[];
  payments: readonly PaymentLike[];
}

/** The subtotals a receipt lists, plus the net they add up to. */
export interface NightNet {
  drinksCents: number;
  buyInsCents: number;
  /** Every cash-out summed — a player who re-buys can cash out more than once. */
  cashoutsCents: number;
  /** Received minus sent: what the player has already paid down, net of refunds. */
  paidCents: number;
  /** Positive means the player owes the house. Equals computeBalanceCents. */
  netCents: number;
}

export type NetKind = 'owes' | 'owed' | 'even';

/** A net ready to render with no sign: "Owes $12.00" / "You're owed $12.00" / "Even". */
export interface NetDisplay {
  kind: NetKind;
  /** Always >= 0. Pass to formatCents. */
  amountCents: number;
}

function sumFor<Row extends { playerId: string }>(
  playerId: string,
  rows: readonly Row[],
  cents: (row: Row) => number,
): number {
  return rows.filter((r) => r.playerId === playerId).reduce((total, r) => total + cents(r), 0);
}

export function nightNet(playerId: string, rows: NightRows): NightNet {
  const signed = (p: PaymentLike) => (p.direction === 'received' ? p.amountCents : -p.amountCents);
  return {
    drinksCents: sumFor(playerId, rows.orders, (o) => o.priceCents),
    buyInsCents: sumFor(playerId, rows.buyIns, (b) => b.amountCents),
    cashoutsCents: sumFor(playerId, rows.cashouts, (c) => c.amountCents),
    paidCents: sumFor(playerId, rows.payments, signed),
    netCents: computeBalanceCents(playerId, rows.orders, rows.buyIns, rows.cashouts, rows.payments),
  };
}

/**
 * Split a net into a direction and a magnitude, so no screen ever shows a minus sign
 * (`formatCents(-1200)` is `"-12.00"`, which is how winners were told "Total owed $-12.00").
 * Rounds to whole cents first, so a fractional input cannot read as "owed $0.00".
 */
export function describeNet(netCents: number): NetDisplay {
  const cents = Math.round(netCents);
  if (cents > 0) return { kind: 'owes', amountCents: cents };
  if (cents < 0) return { kind: 'owed', amountCents: -cents };
  return { kind: 'even', amountCents: 0 };
}
