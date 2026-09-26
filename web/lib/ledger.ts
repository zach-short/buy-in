import { computeBalanceCents, type AmountLike, type OrderLike, type PaymentLike } from '@pb/core';

import type { BuyInRow, CashoutRow, OrderRow, PaymentRow } from '@/lib/supabase/queries';

// The balance math, in integer cents, over rows exactly as Postgres returns them. It is
// @pb/core's computeBalanceCents — the float computeBalance in bar-api.ts, ported with its
// convention intact: positive means the player owes the house (DESIGN.md §8.2). This file
// only adapts row shapes; it adds no rule of its own. `orders.paid` is deliberately not
// read: it is a display flag, and the balance comes from payments (§8.2).

/** `payments.direction` is `text` with a check constraint, so the generated type is `string`. */
export function paymentDirection(value: string): PaymentLike['direction'] {
  if (value === 'received' || value === 'sent') return value;
  throw new Error(`payments.direction is "${value}", which the schema's check constraint forbids`);
}

function toOrderLike(order: OrderRow): OrderLike {
  return { playerId: order.player_id, priceCents: order.price_cents };
}

function toAmountLike(row: BuyInRow | CashoutRow): AmountLike {
  return { playerId: row.player_id, amountCents: row.amount_cents };
}

function toPaymentLike(payment: PaymentRow): PaymentLike {
  return { playerId: payment.player_id, amountCents: payment.amount_cents, direction: paymentDirection(payment.direction) };
}

/** Replaces bar-api.ts `computeBalance` (dollars, float) for every screen phase 5 ports. */
export function playerBalanceCents(
  playerId: string,
  orders: readonly OrderRow[],
  buyIns: readonly BuyInRow[],
  cashouts: readonly CashoutRow[],
  payments: readonly PaymentRow[],
): number {
  return computeBalanceCents(
    playerId,
    orders.map(toOrderLike),
    buyIns.map(toAmountLike),
    cashouts.map(toAmountLike),
    payments.map(toPaymentLike),
  );
}

/** Sum of `price_cents` or `amount_cents` over rows — the per-screen subtotals, in cents. */
export function sumCents<Row>(rows: readonly Row[], cents: (row: Row) => number): number {
  return rows.reduce((total, row) => total + cents(row), 0);
}
