import type { PostgrestError } from '@supabase/supabase-js';

import { writeErrorMessage, type Json } from '@pb/core';
import { createClient } from '@/lib/supabase/client';
import { fetchBarId, type OrderRow, type PlayerRow } from '@/lib/supabase/queries';

// Phase 6 (PLAN.md): every write the Go API served, now straight to Postgres through the
// BD-5 browser client. Each function replaces one route and says which. RLS decides who
// may write — after D16 only an owner or host (is_bar_staff) — so nothing here checks a
// role. Money goes in as integer cents; callers convert typed dollars with toCents once.
//
// Single-row writes are plain table writes, as the phase's scope said. Every write that
// was one Mongo document but is several rows here is an RPC from 0002 (BD-9), so a
// dropped request cannot leave half of it behind.
//
// Failures throw an Error whose message is writeErrorMessage's — the Go API's own words
// where it had them — so the screens' existing `toast.error(e.message)` is unchanged.

function fail(error: PostgrestError): never {
  throw new Error(writeErrorMessage(error));
}

// Under RLS a refused UPDATE matches zero rows and returns no error. The Go handlers
// answered a missing row with 404 and these messages; say so rather than toast "Saved".
function requireRow(rows: readonly unknown[] | null, notFound: string): void {
  if (!rows?.length) throw new Error(notFound);
}

export interface PlayerFields {
  name: string;
  phone: string;
  venmo: string;
}

// Go stored an empty phone or Venmo as ''; the import wrote null (scripts/import-mongo/
// source.ts). Every screen reads both the same way (`player.phone ?? ''`, `!player.venmo`).
function orNull(value: string): string | null {
  return value || null;
}

/** POST /api/players (players.go CreatePlayer). */
export async function createPlayer(fields: PlayerFields): Promise<Pick<PlayerRow, 'id' | 'name'>> {
  const bar_id = await fetchBarId();
  const { data, error } = await createClient().from('players')
    .insert({ bar_id, name: fields.name, phone: orNull(fields.phone), venmo: orNull(fields.venmo) })
    .select('id, name').single();
  if (error) fail(error);
  return data;
}

/** PATCH /api/players/:id (players.go UpdatePlayer). */
export async function updatePlayer(id: string, fields: PlayerFields): Promise<void> {
  const { data, error } = await createClient().from('players')
    .update({ name: fields.name, phone: orNull(fields.phone), venmo: orNull(fields.venmo) })
    .eq('id', id).select('id');
  if (error) fail(error);
  requireRow(data, 'Player not found');
}

export interface InventoryFields {
  name: string;
  category: string;
  unit: string;
  qtyOnHand: number;
  reorderThreshold: number;
  costPerUnitCents: number;
}

/** POST /api/inventory (inventory.go CreateInventoryItem). */
export async function createInventoryItem(fields: InventoryFields): Promise<void> {
  const bar_id = await fetchBarId();
  const { error } = await createClient().from('inventory_items').insert({
    bar_id, name: fields.name, category: fields.category, unit: fields.unit,
    qty_on_hand: fields.qtyOnHand, reorder_threshold: fields.reorderThreshold,
    cost_per_unit_cents: fields.costPerUnitCents,
  });
  if (error) fail(error);
}

/** PATCH /api/inventory/:id with `{ qtyOnHand }` — the only field the screen ever sent. */
export async function setInventoryQty(id: string, qtyOnHand: number): Promise<void> {
  const { data, error } = await createClient().from('inventory_items')
    .update({ qty_on_hand: qtyOnHand }).eq('id', id).select('id');
  if (error) fail(error);
  requireRow(data, 'Item not found');
}

export interface DrinkFields {
  name: string;
  priceCents: number;
  costEstimateCents: number;
  ingredients: { itemId: string; qtyUsed: number }[];
}

/** POST /api/drinks, or PUT /api/drinks/:id when `drinkId` is given — 0002 save_drink. */
export async function saveDrink(fields: DrinkFields, drinkId?: string): Promise<void> {
  const ingredients: Json = fields.ingredients.map((i) => ({ item_id: i.itemId, qty_used: i.qtyUsed }));
  const { error } = await createClient().rpc('save_drink', {
    p_bar_id: await fetchBarId(), p_name: fields.name, p_price_cents: fields.priceCents,
    p_cost_estimate_cents: fields.costEstimateCents, p_ingredients: ingredients, p_drink_id: drinkId,
  });
  if (error) fail(error);
}

/** POST /api/sessions plus the buy-ins posted after it — 0002 start_session. Returns the session id. */
export async function startSession(name: string, players: { playerId: string; buyInCents: number }[]): Promise<string> {
  const p_players: Json = players.map((p) => ({ player_id: p.playerId, buy_in_cents: p.buyInCents }));
  const { data, error } = await createClient().rpc('start_session', { p_bar_id: await fetchBarId(), p_name: name, p_players });
  if (error) fail(error);
  return data;
}

/** PATCH /api/sessions/:id `{ playerIds }` plus its buy-in — 0002 add_session_player. */
export async function addSessionPlayer(sessionId: string, playerId: string, buyInCents: number): Promise<void> {
  const { error } = await createClient().rpc('add_session_player', {
    p_session_id: sessionId, p_player_id: playerId, p_buy_in_cents: buyInCents,
  });
  if (error) fail(error);
}

/** PATCH /api/sessions/:id `{ status: 'closed' }` (sessions.go UpdateSession). */
export async function closeSession(id: string): Promise<void> {
  const { data, error } = await createClient().from('sessions').update({ status: 'closed' }).eq('id', id).select('id');
  if (error) fail(error);
  requireRow(data, 'Session not found');
}

/** DELETE /api/sessions/:id — 0002 delete_session (D19): refuses while drinks remain. */
export async function deleteSession(id: string): Promise<void> {
  const { error } = await createClient().rpc('delete_session', { p_session_id: id });
  if (error) fail(error);
}

/** Buy-ins and cashouts take bar_id from their session, which the screen already holds. */
export interface SessionRef {
  id: string;
  bar_id: string;
}

/** POST /api/buyins (ledger.go CreateBuyIn). */
export async function createBuyIn(session: SessionRef, playerId: string, amountCents: number): Promise<void> {
  const { error } = await createClient().from('buy_ins')
    .insert({ bar_id: session.bar_id, session_id: session.id, player_id: playerId, amount_cents: amountCents });
  if (error) fail(error);
}

/** POST /api/cashouts (ledger.go CreateCashout). */
export async function createCashout(session: SessionRef, playerId: string, amountCents: number): Promise<void> {
  const { error } = await createClient().from('cashouts')
    .insert({ bar_id: session.bar_id, session_id: session.id, player_id: playerId, amount_cents: amountCents });
  if (error) fail(error);
}

/**
 * POST /api/payments (ledger.go CreatePayment). Go's Payment had no session, and by default
 * none is written. Settle-up passes `sessionId` so a night's receipt (get_shared_tab filters
 * a session link's payments by it) shows what was paid against that night. A tagged payment
 * restricts its session (0001's foreign key), so delete_session (D19) refuses a night that
 * has one — which is the point of the restrict: a night with money in it does not vanish.
 */
export async function createPayment(
  player: Pick<PlayerRow, 'id' | 'bar_id'>,
  amountCents: number,
  note: string,
  direction: 'received' | 'sent',
  sessionId: string | null = null,
): Promise<void> {
  const { error } = await createClient().from('payments').insert({
    bar_id: player.bar_id, session_id: sessionId, player_id: player.id, amount_cents: amountCents, note, direction,
  });
  if (error) fail(error);
}

/**
 * PATCH /api/sessions/:id/players/:playerId/paid (orders.go MarkPlayerTabPaid). One UPDATE,
 * so atomic. `orders.paid` stays a display flag the balance ignores (DESIGN.md §8.2).
 */
export async function setTabPaid(sessionId: string, playerId: string, paid: boolean): Promise<void> {
  const { error } = await createClient().from('orders').update({ paid }).eq('session_id', sessionId).eq('player_id', playerId);
  if (error) fail(error);
}

export interface PourResult {
  order: OrderRow;
  lowStockWarnings: string[];
}

/** POST /api/orders — 0001 create_order: checks stock, decrements, snapshots, inserts, all or nothing. */
export async function pourDrink(sessionId: string, playerId: string, drinkId: string): Promise<PourResult> {
  const { data, error } = await createClient().rpc('create_order', {
    p_session_id: sessionId, p_player_id: playerId, p_drink_id: drinkId,
  });
  if (error) fail(error);
  const result = data as { order: OrderRow; low_stock_warnings: string[] };
  return { order: result.order, lowStockWarnings: result.low_stock_warnings };
}

/** DELETE /api/orders/:id — 0001 delete_order: restores stock from the order's own snapshot. */
export async function undoOrder(orderId: string): Promise<void> {
  const { error } = await createClient().rpc('delete_order', { p_order_id: orderId });
  if (error) fail(error);
}
