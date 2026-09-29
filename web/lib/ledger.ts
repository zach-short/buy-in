import {
  computeBalanceCents, nightNet, type AmountLike, type NightNet, type OrderLike, type PaymentLike, type SharedTab,
} from '@pb/core';

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

/**
 * The same balance over a share link's tab (phase 7). Every row in a tab is already this
 * player's, because get_shared_tab filters by the token's player (D15), so the player id
 * only satisfies computeBalanceCents' signature.
 */
export function sharedBalanceCents(tab: SharedTab): number {
  const playerId = tab.player.id;
  const amount = (row: { amount_cents: number }): AmountLike => ({ playerId, amountCents: row.amount_cents });
  return computeBalanceCents(
    playerId,
    tab.orders.map((o) => ({ playerId, priceCents: o.price_cents })),
    tab.buy_ins.map(amount),
    tab.cashouts.map(amount),
    tab.payments.map((p) => ({ playerId, amountCents: p.amount_cents, direction: p.direction })),
  );
}

/**
 * One player's night — drinks, buy-ins, every cash-out, payments — over rows as Postgres
 * returns them. Other players' rows are ignored, but not other nights': pass one session's
 * orders, buy-ins and cash-outs, and only the payments whose `session_id` is that session.
 * `netCents` is the same number playerBalanceCents gives for those rows.
 */
export function nightNetFromRows(
  playerId: string,
  orders: readonly OrderRow[],
  buyIns: readonly BuyInRow[],
  cashouts: readonly CashoutRow[],
  payments: readonly PaymentRow[],
): NightNet {
  return nightNet(playerId, {
    orders: orders.map(toOrderLike),
    buyIns: buyIns.map(toAmountLike),
    cashouts: cashouts.map(toAmountLike),
    payments: payments.map(toPaymentLike),
  });
}

/**
 * One night of a share link's tab. A session link's rows are all that night already
 * (get_shared_tab, D15); a portal link's span every night, so each row is kept only if its
 * `session_id` is this one. A payment with no session belongs to no night — it counts in
 * sharedBalanceCents and nowhere here.
 */
export function sharedNightNet(tab: SharedTab, sessionId: string): NightNet {
  const playerId = tab.player.id;
  const inNight = <Row extends { session_id: string | null }>(rows: readonly Row[]) =>
    rows.filter((row) => row.session_id === sessionId);
  const amount = (row: { amount_cents: number }): AmountLike => ({ playerId, amountCents: row.amount_cents });
  return nightNet(playerId, {
    orders: inNight(tab.orders).map((o) => ({ playerId, priceCents: o.price_cents })),
    buyIns: inNight(tab.buy_ins).map(amount),
    cashouts: inNight(tab.cashouts).map(amount),
    payments: inNight(tab.payments).map((p) => ({ playerId, amountCents: p.amount_cents, direction: p.direction })),
  });
}

/** Sum of `price_cents` or `amount_cents` over rows — the per-screen subtotals, in cents. */
export function sumCents<Row>(rows: readonly Row[], cents: (row: Row) => number): number {
  return rows.reduce((total, row) => total + cents(row), 0);
}
