import type { ObjectId } from 'mongodb';

import type { Database, Json } from '@pb/core';

import { computedCents, quantity, typedCents } from './convert';
import { uuidFor } from './ids';
import type {
  MongoSource,
  SourceDrink,
  SourceEntry,
  SourceItem,
  SourceOrder,
  SourcePayment,
  SourcePlayer,
  SourceSession,
} from './source';

type Tables = Database['public']['Tables'];

// Whole rows, not Insert shapes: every column is written, including the ones a default
// would fill the same way (players.user_id, sessions.settle_mode, ...). drift.ts compares
// every column of every live row against these, so a claimed player or a peer-mode
// session is a difference it can see. And when a migration adds a column and the types
// are regenerated, this file stops compiling until the import says what it writes there.
export type TableRow<T extends keyof Tables> = Tables[T]['Row'];

/** Every row the import writes, in the order it must be inserted (foreign keys). */
export interface ImportRows {
  inventory_items: TableRow<'inventory_items'>[];
  drinks: TableRow<'drinks'>[];
  drink_ingredients: TableRow<'drink_ingredients'>[];
  players: TableRow<'players'>[];
  sessions: TableRow<'sessions'>[];
  session_players: TableRow<'session_players'>[];
  orders: TableRow<'orders'>[];
  buy_ins: TableRow<'buy_ins'>[];
  cashouts: TableRow<'cashouts'>[];
  payments: TableRow<'payments'>[];
}

// H6 / DESIGN.md §9 gap (g): every created_at is written explicitly from Mongo. A
// default would stamp every row with the import's own clock and reorder every receipt.
// inventory and drinks carry no timestamp field, so their ObjectId's embedded creation
// second is the only real one there is.
function iso(date: Date): string {
  return date.toISOString();
}

function createdAtOf(id: ObjectId): string {
  return iso(id.getTimestamp());
}

function itemRow(barId: string, item: SourceItem): TableRow<'inventory_items'> {
  return {
    id: uuidFor('inventory', item.id),
    bar_id: barId,
    name: item.name,
    category: item.category,
    unit: item.unit,
    qty_on_hand: quantity(item.qtyOnHand),
    reorder_threshold: quantity(item.reorderThreshold),
    cost_per_unit_cents: typedCents(item.costPerUnit),
    created_at: createdAtOf(item.id),
  };
}

function drinkRow(barId: string, drink: SourceDrink): TableRow<'drinks'> {
  return {
    id: uuidFor('drinks', drink.id),
    bar_id: barId,
    name: drink.name,
    price_cents: typedCents(drink.price),
    cost_estimate_cents: computedCents(drink.costEstimate),
    created_at: createdAtOf(drink.id),
  };
}

function ingredientRows(barId: string, drink: SourceDrink): TableRow<'drink_ingredients'>[] {
  return drink.ingredients.map((ing) => ({
    bar_id: barId,
    drink_id: uuidFor('drinks', drink.id),
    item_id: uuidFor('inventory', ing.itemId),
    qty_used: quantity(ing.qtyUsed),
  }));
}

// user_id null: every Mongo player is a guest row; claiming is a Supabase-only flow.
function playerRow(barId: string, player: SourcePlayer): TableRow<'players'> {
  return {
    id: uuidFor('players', player.id),
    bar_id: barId,
    user_id: null,
    name: player.name,
    phone: player.phone,
    venmo: player.venmo,
    cashapp: null,
    created_at: player.createdAt ? iso(player.createdAt) : createdAtOf(player.id),
  };
}

// BD-2: played_on is the session's real timestamp, not a bare date. Mongo's `date` is
// set once, at creation (sessions.go:61), and no handler changes it, so it is also the
// session's creation time. Banked, because Mongo had no other mode (D2).
function sessionRow(barId: string, session: SourceSession): TableRow<'sessions'> {
  return {
    id: uuidFor('sessions', session.id),
    bar_id: barId,
    name: session.name,
    played_on: iso(session.date),
    status: session.status,
    settle_mode: 'banked',
    created_at: iso(session.date),
  };
}

function sessionPlayerRows(barId: string, session: SourceSession, known: Set<string>): TableRow<'session_players'>[] {
  // Deduplicated, and limited to players that exist: Session.playerIds is a bare array
  // nothing kept consistent. A dropped id is reported by preflight.
  const present = new Map<string, ObjectId>();
  for (const id of session.playerIds) {
    if (known.has(id.toHexString())) present.set(id.toHexString(), id);
  }
  return [...present.values()].map((playerId) => ({
    bar_id: barId,
    session_id: uuidFor('sessions', session.id),
    player_id: uuidFor('players', playerId),
  }));
}

// Mongo orders carry no ingredient snapshot. The snapshot is rebuilt from the drink's
// recipe as it stands at import, which is exactly what the Go DeleteOrder restored
// (orders.go:218-228), so deleting an imported order behaves as it did before the move.
// Reversal: write '[]' instead, and deleting an imported order restores no stock.
function snapshotFor(order: SourceOrder, drinks: Map<string, SourceDrink>): Json {
  const drink = order.drinkId ? drinks.get(order.drinkId.toHexString()) : undefined;
  return (drink?.ingredients ?? []).map((ing) => ({
    item_id: uuidFor('inventory', ing.itemId),
    qty_used: quantity(ing.qtyUsed),
  }));
}

function orderRow(barId: string, order: SourceOrder, drinks: Map<string, SourceDrink>): TableRow<'orders'> {
  const drinkExists = order.drinkId !== null && drinks.has(order.drinkId.toHexString());
  return {
    id: uuidFor('orders', order.id),
    bar_id: barId,
    session_id: uuidFor('sessions', order.sessionId),
    player_id: uuidFor('players', order.playerId),
    // A drink deleted since (the seed script rewrites the whole collection) keeps the
    // order, its drink_name and its price — the same outcome as on delete set null.
    drink_id: drinkExists && order.drinkId ? uuidFor('drinks', order.drinkId) : null,
    drink_name: order.drinkName,
    price_cents: typedCents(order.price),
    cost_estimate_cents: computedCents(order.costEstimate),
    ingredients: snapshotFor(order, drinks),
    paid: order.paid,
    created_at: iso(order.timestamp),
  };
}

function entryRow(kind: 'buyins' | 'cashouts', barId: string, entry: SourceEntry): TableRow<'buy_ins'> {
  return {
    id: uuidFor(kind, entry.id),
    bar_id: barId,
    session_id: uuidFor('sessions', entry.sessionId),
    player_id: uuidFor('players', entry.playerId),
    amount_cents: typedCents(entry.amount),
    created_at: iso(entry.timestamp),
  };
}

// Mongo payments have no session (models.Payment), so session_id stays null — which
// get_shared_tab's portal scope includes and a session-scoped receipt does not, the
// same split the Go screens made. No counterparty either: peer settlement is new (D2).
function paymentRow(barId: string, payment: SourcePayment): TableRow<'payments'> {
  return {
    id: uuidFor('payments', payment.id),
    bar_id: barId,
    session_id: null,
    player_id: uuidFor('players', payment.playerId),
    counterparty_player_id: null,
    amount_cents: typedCents(payment.amount),
    note: payment.note,
    direction: payment.direction,
    created_at: iso(payment.timestamp),
  };
}

function byHex<T extends { id: ObjectId }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.id.toHexString(), row]));
}

export function buildRows(source: MongoSource, barId: string): ImportRows {
  const drinks = byHex(source.drinks);
  const known = new Set(byHex(source.players).keys());
  return {
    inventory_items: source.inventory.map((item) => itemRow(barId, item)),
    drinks: source.drinks.map((drink) => drinkRow(barId, drink)),
    drink_ingredients: source.drinks.flatMap((drink) => ingredientRows(barId, drink)),
    players: source.players.map((player) => playerRow(barId, player)),
    sessions: source.sessions.map((session) => sessionRow(barId, session)),
    session_players: source.sessions.flatMap((session) => sessionPlayerRows(barId, session, known)),
    orders: source.orders.map((order) => orderRow(barId, order, drinks)),
    buy_ins: source.buyIns.map((entry) => entryRow('buyins', barId, entry)),
    cashouts: source.cashouts.map((entry) => entryRow('cashouts', barId, entry)),
    payments: source.payments.map((payment) => paymentRow(barId, payment)),
  };
}
