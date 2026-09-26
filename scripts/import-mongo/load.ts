import { check, type Db } from './supabase';
import type { ImportRows } from './transform';

/**
 * How a run writes the bar, settled by drift.ts's guard before the first write:
 * - load: the bar is new, or its twelve tables hold nothing. Insert only.
 * - keep: the bar already holds exactly what this run writes. Write nothing.
 * - replace: it holds something else and --force was given. Clear the bar, then load.
 * Only replace deletes, so nothing is deleted unless the operator typed --force. A run
 * with the wrong --owner lands on load, and the round-2 undo's unscoped delete there
 * wiped the real bar's ledger (round-2 audit, B1).
 */
export type Plan = 'load' | 'keep' | 'replace';

// Children before parents: 0001 makes the ledger RESTRICT its session and player (D18),
// so a session cannot go while an order still points at it. Share and claim links are
// cleared first so a rehearsal never leaves a live token to a real ledger behind.
// clearBar deletes EVERY row of the bar in these tables, whoever wrote it; it runs only
// on the replace plan, after drift.ts has listed every difference, and drift.ts's table
// list is typed from this one so the two cannot drift apart.
export const CLEAR_ORDER = [
  'player_share_links',
  'player_claim_links',
  'orders',
  'buy_ins',
  'cashouts',
  'payments',
  'session_players',
  'sessions',
  'drink_ingredients',
  'drinks',
  'players',
  'inventory_items',
] as const;

export type ClearedTable = (typeof CLEAR_ORDER)[number];

const BATCH = 500;

async function clearBar(sb: Db, barId: string): Promise<void> {
  for (const table of CLEAR_ORDER) {
    const { error, count } = await sb.from(table).delete({ count: 'exact' }).eq('bar_id', barId);
    check(error, `clearing ${table}`);
    console.log(`  cleared ${table}: ${count ?? 0}`);
  }
}

type InsertResult = PromiseLike<{ error: { message: string; code?: string } | null }>;

async function insertBatches<R>(table: string, rows: R[], insert: (batch: R[]) => InsertResult): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await insert(rows.slice(i, i + BATCH));
    check(error, `inserting ${table}`);
  }
  console.log(`  inserted ${table}: ${rows.length}`);
}

// One explicit call per table, in foreign-key order: supabase-js cannot type an insert
// whose table name is a generic, and a cast to get around that is what T1 bans.
async function loadRows(sb: Db, rows: ImportRows): Promise<void> {
  await insertBatches('inventory_items', rows.inventory_items, (b) => sb.from('inventory_items').insert(b));
  await insertBatches('drinks', rows.drinks, (b) => sb.from('drinks').insert(b));
  await insertBatches('drink_ingredients', rows.drink_ingredients, (b) => sb.from('drink_ingredients').insert(b));
  await insertBatches('players', rows.players, (b) => sb.from('players').insert(b));
  await insertBatches('sessions', rows.sessions, (b) => sb.from('sessions').insert(b));
  await insertBatches('session_players', rows.session_players, (b) => sb.from('session_players').insert(b));
  await insertBatches('orders', rows.orders, (b) => sb.from('orders').insert(b));
  await insertBatches('buy_ins', rows.buy_ins, (b) => sb.from('buy_ins').insert(b));
  await insertBatches('cashouts', rows.cashouts, (b) => sb.from('cashouts').insert(b));
  await insertBatches('payments', rows.payments, (b) => sb.from('payments').insert(b));
}

// Children before parents again. Deleting a session, drink or player cascades the
// session_players, drink_ingredients and link rows under it (0001_init.sql:137, 171-172,
// 311-312, 339), so the eight tables with ids reach every row loadRows inserts.
const UNDO_ORDER = ['orders', 'buy_ins', 'cashouts', 'payments', 'sessions', 'drinks', 'players', 'inventory_items'] as const;

// Ids travel in the URL (id=in.(...)); a hundred uuids keep it near 4 KB.
const UNDO_BATCH = 100;

// By bar_id AND id. Ids are deterministic and global (ids.ts), not per bar, so the same
// id can be a row of another bar; matching on id alone is how B1 deleted the real bar's
// ledger. The bar_id keeps the undo inside the bar this run cleared, and the id keeps it
// to what this run inserted, not a row a concurrent writer added since the clear.
async function deleteIds(sb: Db, barId: string, table: (typeof UNDO_ORDER)[number], ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += UNDO_BATCH) {
    const { error } = await sb.from(table).delete().eq('bar_id', barId).in('id', ids.slice(i, i + UNDO_BATCH));
    check(error, `undoing ${table}`);
  }
}

async function undoLoad(sb: Db, barId: string, rows: ImportRows): Promise<void> {
  for (const table of UNDO_ORDER) await deleteIds(sb, barId, table, rows[table].map((row) => row.id));
}

async function undoOrReport(sb: Db, barId: string, rows: ImportRows): Promise<void> {
  try {
    await undoLoad(sb, barId, rows);
    console.log('  undo: every row this run inserted into this bar is removed, so it is empty; re-run once the cause is fixed (an empty bar needs no --force)');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.log(`  undo FAILED (${reason}) — the bar is half-loaded; the next run will refuse and list what is missing`);
  }
}

/**
 * The replace plan's load. clearBar and loadRows are separate requests, not one
 * transaction: PostgREST has no transaction spanning requests, and a server-side one
 * would need a function 0001 does not define. So a load that fails part-way removes the
 * rows this run inserted into this bar, leaving it empty — which the next run loads
 * without --force — instead of half-loaded, which it refuses. That delete is safe to keep
 * here: --force was typed, clearBar has just emptied this bar, and the undo is scoped to
 * it. A process killed outright cannot even do that; the next run's guard then refuses
 * and says the bar looks like an interrupted run.
 */
async function loadOrUndo(sb: Db, barId: string, rows: ImportRows): Promise<void> {
  try {
    await loadRows(sb, rows);
  } catch (error) {
    console.log('  load FAILED — removing the rows this run inserted into this bar, so it is not left half-loaded');
    await undoOrReport(sb, barId, rows);
    throw error;
  }
}

// The load plan's load, which deletes nothing even to recover: that delete would be the
// one a run without --force could make, and B1 was such a delete. What a failure leaves,
// the next run's guard lists as rows "only missing", and --force's clear is bar-scoped.
async function loadOrReport(sb: Db, rows: ImportRows): Promise<void> {
  try {
    await loadRows(sb, rows);
  } catch (error) {
    console.log('  load FAILED — nothing is deleted without --force, so whatever this run inserted stays in the bar');
    console.log("  a duplicate key on an id (..._pkey) means these rows are already in another bar: ids come from Mongo's _id, not the bar, so check --owner");
    console.log('  anything else: fix the cause and re-run; the guard will list what this run left and need --force to replace it');
    throw error;
  }
}

/** Every import write to the twelve tables goes through here; verify's temporary links and probes are its own. */
export async function writeBar(sb: Db, barId: string, plan: Plan, rows: ImportRows): Promise<void> {
  if (plan === 'keep') {
    console.log('load: skipped — the bar already holds exactly these rows, so nothing is cleared or written');
    return;
  }
  if (plan === 'replace') {
    console.log('clear:');
    await clearBar(sb, barId);
  }
  console.log('load:');
  await (plan === 'replace' ? loadOrUndo(sb, barId, rows) : loadOrReport(sb, rows));
}
