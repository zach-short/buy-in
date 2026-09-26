import type { PostgrestError } from '@supabase/supabase-js';

import type { Tables } from '@pb/core';
import { createClient } from '@/lib/supabase/client';

// Phase 5 (PLAN.md): every read the Go API served, now straight from Postgres through the
// BD-5 browser client. RLS scopes each one to the signed-in user's bar, so no query here
// filters on bar_id. Each fetcher replaces one GET route and keeps that route's sort order,
// cited, because screens render rows in the order they arrive (DESIGN.md §8.2).
//
// SWR keys at the call sites: the table name for a whole-bar list ('orders'), and
// [table, id] for a filtered one (['orders', sessionId]). The same query always uses the
// same key, so screens share a cache entry exactly as they shared '/api/orders'.
//
// Money arrives as integer cents (`*_cents`) and dates as full timestamptz strings. Render
// money with formatCents and dates with @pb/core's formatDate/formatTime — never a bare
// YYYY-MM-DD (BD-2).

export type PlayerRow = Tables<'players'>;
export type InventoryRow = Tables<'inventory_items'>;
export type OrderRow = Tables<'orders'>;
export type BuyInRow = Tables<'buy_ins'>;
export type CashoutRow = Tables<'cashouts'>;
export type PaymentRow = Tables<'payments'>;
export type IngredientRow = Pick<Tables<'drink_ingredients'>, 'item_id' | 'qty_used'>;
/** `player_ids` is `session_players` flattened — what Mongo embedded as `Session.playerIds[]`. */
export type SessionWithPlayers = Tables<'sessions'> & { player_ids: string[] };
/** `ingredients` is `drink_ingredients` embedded — what Mongo embedded as `DrinkRecipe.ingredients[]`. */
export type DrinkWithIngredients = Tables<'drinks'> & { ingredients: IngredientRow[] };

const SESSION_COLUMNS = '*, session_players(player_id, players(name))';
const DRINK_COLUMNS = '*, ingredients:drink_ingredients(item_id, qty_used)';

// The Data API returns at most `max_rows` rows per request — 1000 by default, set
// server-wide. The Go API returned every row, and balances are sums over whole-bar lists,
// so a single capped select would under-count a balance with no error at all. Page until
// a page holds every row still left (its exact count), so a cap lower than PAGE_SIZE
// still returns everything.
//
// Pages are keyset, not offset (PLAN.md phase 6, N1 from the phase 5 audit): each page
// asks for the rows strictly after the last one seen, on the same (column, id) order the
// query sorts by. By offset, a write landing between two pages of one fetch shifted every
// later row by one — on a newest-first list an insert re-read a row and double-counted it
// in a balance, a delete skipped one. Paging oldest-first alone would not have fixed the
// insert case.
const PAGE_SIZE = 1000;

type Page<Row> = PromiseLike<{ data: Row[] | null; error: PostgrestError | null; count: number | null }>;

/** The sort a list pages along; `id` ascending is always the tiebreak, as every query orders by it last. */
interface Keyset {
  column?: 'created_at' | 'played_on';
  ascending?: boolean;
}

type Keyed = { id: string; created_at?: string; played_on?: string };

// Values are double-quoted because a timestamptz carries PostgREST's reserved `.` and `:`
// (docs.postgrest.org v14, URL grammar, "Reserved characters").
function after(last: Keyed, keyset: Keyset): string {
  const byId = `id.gt.${last.id}`;
  if (!keyset.column) return byId;
  const value = `"${last[keyset.column]}"`;
  const op = keyset.ascending ? 'gt' : 'lt';
  return `${keyset.column}.${op}.${value},and(${keyset.column}.eq.${value},${byId})`;
}

function afterFilter<Q extends { or(filters: string): Q }>(query: Q, cursor: string | null): Q {
  return cursor ? query.or(cursor) : query;
}

async function selectAll<Row extends Keyed>(keyset: Keyset, page: (cursor: string | null) => Page<Row>): Promise<Row[]> {
  const rows: Row[] = [];
  for (;;) {
    const cursor = rows.length ? after(rows[rows.length - 1], keyset) : null;
    const { data, error, count } = await page(cursor);
    if (error) throw error;
    if (count === null) throw new Error('selectAll needs { count: "exact" } on its select');
    rows.push(...(data ?? []));
    if (!data?.length || data.length >= count) return rows;
  }
}

const BY_ID: Keyset = {};
const NEWEST_FIRST: Keyset = { column: 'created_at', ascending: false };
const OLDEST_FIRST: Keyset = { column: 'created_at', ascending: true };

// Mongo sorted strings with its default simple binary collation (players.go:21,
// drinks.go:21, inventory.go:21); Postgres's `order by name` uses the database collation,
// which can put 'alice' before 'Bob'. Sorting here reproduces the Go API's order exactly.
function compareBinary(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function byName<Row extends { name: string }>(a: Row, b: Row): number {
  return compareBinary(a.name, b.name);
}

type SessionPlayerJoin = { player_id: string; players: { name: string } | null };

// NOT the Go API's order, and deliberately flagged rather than silently different: Mongo's
// Session.playerIds[] kept the order players were tapped in (session/new/page.tsx:75, then
// appended mid-session), and playerIds[0] was the session screen's default player. The
// /sessions card list, unlike the default-player rule, WAS already name-sorted on the Go
// side for most screens but not this one — sessions.go:21 returns Session.playerIds[] as-is,
// so the pre-port /sessions cards listed names in tap order, not alphabetically.
// session_players has no column that could hold insertion order (0001_init.sql:166-173), and
// Postgres returns unordered rows in no defined order. The owner decided 2026-09-25
// (DESIGN.md §8.2 amendment, HANDOFF.md step 18) to accept name order rather than add a
// `0002` position column: player_ids is in the same name order the screens display players
// in, so the default player is the first tab, and every session card now lists names
// alphabetically (a real, disclosed change from tap order, not merely "already true").
function withPlayerIds(row: Tables<'sessions'> & { session_players: SessionPlayerJoin[] }): SessionWithPlayers {
  const { session_players, ...session } = row;
  const ordered = [...session_players].sort((a, b) => compareBinary(a.players?.name ?? '', b.players?.name ?? ''));
  return { ...session, player_ids: ordered.map((sp) => sp.player_id) };
}

/** GET /api/sessions — `date` desc (sessions.go:21). */
export async function fetchSessions(): Promise<SessionWithPlayers[]> {
  const rows = await selectAll({ column: 'played_on', ascending: false }, (cursor) =>
    afterFilter(createClient().from('sessions').select(SESSION_COLUMNS, { count: 'exact' }), cursor)
      .order('played_on', { ascending: false }).order('id').limit(PAGE_SIZE),
  );
  return rows.map(withPlayerIds);
}

/** One session by id; `null` when it does not exist or is not this bar's. */
export async function fetchSession(id: string): Promise<SessionWithPlayers | null> {
  const { data, error } = await createClient().from('sessions').select(SESSION_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data && withPlayerIds(data);
}

/** GET /api/players — `name` asc (players.go:21). */
export async function fetchPlayers(): Promise<PlayerRow[]> {
  const rows = await selectAll(BY_ID, (cursor) =>
    afterFilter(createClient().from('players').select('*', { count: 'exact' }), cursor).order('id').limit(PAGE_SIZE),
  );
  return rows.sort(byName);
}

/** GET /api/drinks — `name` asc (drinks.go:21). */
export async function fetchDrinks(): Promise<DrinkWithIngredients[]> {
  const rows = await selectAll(BY_ID, (cursor) =>
    afterFilter(createClient().from('drinks').select(DRINK_COLUMNS, { count: 'exact' }), cursor).order('id').limit(PAGE_SIZE),
  );
  // drink_ingredients has no column for Mongo's array order (0001_init.sql:129-139), so
  // item_id is only a stable order, not the recipe's entry order.
  const ordered = rows.map((d) => ({ ...d, ingredients: [...d.ingredients].sort((a, b) => compareBinary(a.item_id, b.item_id)) }));
  return ordered.sort(byName);
}

/** GET /api/inventory — `category` asc, then `name` asc (inventory.go:21). */
export async function fetchInventory(): Promise<InventoryRow[]> {
  const rows = await selectAll(BY_ID, (cursor) =>
    afterFilter(createClient().from('inventory_items').select('*', { count: 'exact' }), cursor).order('id').limit(PAGE_SIZE),
  );
  return rows.sort((a, b) => compareBinary(a.category, b.category) || byName(a, b));
}

/** GET /api/orders — `timestamp` desc (orders.go:37). */
export async function fetchOrders(): Promise<OrderRow[]> {
  return selectAll(NEWEST_FIRST, (cursor) =>
    afterFilter(createClient().from('orders').select('*', { count: 'exact' }), cursor)
      .order('created_at', { ascending: false }).order('id').limit(PAGE_SIZE),
  );
}

/** GET /api/orders?sessionId= — `timestamp` desc (orders.go:37). */
export async function fetchSessionOrders(sessionId: string): Promise<OrderRow[]> {
  return selectAll(NEWEST_FIRST, (cursor) =>
    afterFilter(createClient().from('orders').select('*', { count: 'exact' }).eq('session_id', sessionId), cursor)
      .order('created_at', { ascending: false }).order('id').limit(PAGE_SIZE),
  );
}

/** GET /api/buyins — `timestamp` asc (ledger.go:34). The first row is labelled "Buy-in", the rest "Re-buy". */
export async function fetchBuyIns(): Promise<BuyInRow[]> {
  return selectAll(OLDEST_FIRST, (cursor) =>
    afterFilter(createClient().from('buy_ins').select('*', { count: 'exact' }), cursor)
      .order('created_at').order('id').limit(PAGE_SIZE),
  );
}

/** GET /api/buyins?sessionId= — `timestamp` asc (ledger.go:34). */
export async function fetchSessionBuyIns(sessionId: string): Promise<BuyInRow[]> {
  return selectAll(OLDEST_FIRST, (cursor) =>
    afterFilter(createClient().from('buy_ins').select('*', { count: 'exact' }).eq('session_id', sessionId), cursor)
      .order('created_at').order('id').limit(PAGE_SIZE),
  );
}

/** GET /api/cashouts — unsorted in Go (ledger.go:125), i.e. insertion order; `created_at` asc is that order stated. */
export async function fetchCashouts(): Promise<CashoutRow[]> {
  return selectAll(OLDEST_FIRST, (cursor) =>
    afterFilter(createClient().from('cashouts').select('*', { count: 'exact' }), cursor)
      .order('created_at').order('id').limit(PAGE_SIZE),
  );
}

/** GET /api/cashouts?sessionId= — see fetchCashouts. */
export async function fetchSessionCashouts(sessionId: string): Promise<CashoutRow[]> {
  return selectAll(OLDEST_FIRST, (cursor) =>
    afterFilter(createClient().from('cashouts').select('*', { count: 'exact' }).eq('session_id', sessionId), cursor)
      .order('created_at').order('id').limit(PAGE_SIZE),
  );
}

/** GET /api/payments — `timestamp` desc (ledger.go:195). */
export async function fetchPayments(): Promise<PaymentRow[]> {
  return selectAll(NEWEST_FIRST, (cursor) =>
    afterFilter(createClient().from('payments').select('*', { count: 'exact' }), cursor)
      .order('created_at', { ascending: false }).order('id').limit(PAGE_SIZE),
  );
}

/** GET /api/payments?playerId= — `timestamp` desc (ledger.go:195). */
export async function fetchPlayerPayments(playerId: string): Promise<PaymentRow[]> {
  return selectAll(NEWEST_FIRST, (cursor) =>
    afterFilter(createClient().from('payments').select('*', { count: 'exact' }).eq('player_id', playerId), cursor)
      .order('created_at', { ascending: false }).order('id').limit(PAGE_SIZE),
  );
}

/**
 * The signed-in host's bar, for the writes that start a row with no parent to take it from.
 * One bar per account is ratified scope (DESIGN.md §2); a second fails loudly rather than
 * writing into whichever bar Postgres returned first.
 */
export async function fetchBarId(): Promise<string> {
  const { data, error } = await createClient().from('bars').select('id').limit(2);
  if (error) throw error;
  if (data.length !== 1) throw new Error(`Expected one bar for this account, found ${data.length}`);
  return data[0].id;
}
