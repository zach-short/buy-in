import type { ObjectId } from 'mongodb';

import { uuidFor } from './ids';
import { readAll } from './read';
import type { SourceOrder } from './source';
import type { VerifyContext } from './verify';

// H6 / gap (g): a created_at default would stamp every imported row with the import's
// own clock and reorder every receipt. Proved two ways: every row's timestamp equals its
// Mongo source exactly, and a sampled session's orders come back in Mongo's order.

interface Stamped {
  id: string;
  created_at: string;
}

type StampTable = 'inventory_items' | 'drinks' | 'players' | 'sessions' | 'orders' | 'buy_ins' | 'cashouts' | 'payments';

const STAMPED: StampTable[] = ['inventory_items', 'drinks', 'players', 'sessions', 'orders', 'buy_ins', 'cashouts', 'payments'];

async function readStamps(ctx: VerifyContext, table: StampTable): Promise<Stamped[]> {
  return readAll(`reading ${table} timestamps`, (from, to) =>
    ctx.sb.from(table).select('id, created_at').eq('bar_id', ctx.barId).order('id').range(from, to),
  );
}

function expectedStamps(ctx: VerifyContext, table: StampTable): Map<string | undefined, string | undefined> {
  const rows: { id?: string; created_at?: string }[] = ctx.rows[table];
  return new Map(rows.map((row) => [row.id, row.created_at]));
}

/** Rows whose stored created_at is not exactly the Mongo timestamp, or is missing. */
async function stampMismatches(ctx: VerifyContext, table: StampTable): Promise<{ wrong: number; late: number; total: number }> {
  const expected = expectedStamps(ctx, table);
  const actual = await readStamps(ctx, table);
  const wrong = actual.filter((row) => Date.parse(row.created_at) !== Date.parse(expected.get(row.id) ?? '')).length;
  const late = actual.filter((row) => Date.parse(row.created_at) >= ctx.importStartedAt).length;
  return { wrong: wrong + Math.max(0, expected.size - actual.length), late, total: actual.length };
}

async function playedOnMismatches(ctx: VerifyContext): Promise<number> {
  const expected = new Map(ctx.rows.sessions.map((row) => [row.id, row.played_on]));
  const actual = await readAll('reading sessions.played_on', (from, to) =>
    ctx.sb.from('sessions').select('id, played_on').eq('bar_id', ctx.barId).order('id').range(from, to),
  );
  return actual.filter((row) => Date.parse(row.played_on) !== Date.parse(expected.get(row.id) ?? '')).length;
}

async function verifyEveryStamp(ctx: VerifyContext): Promise<boolean> {
  let ok = true;
  for (const table of STAMPED) {
    const { wrong, late, total } = await stampMismatches(ctx, table);
    console.log(`  ${table}.created_at: ${total - wrong}/${total} equal their Mongo timestamp; ${late} at or after import start`);
    ok = ok && wrong === 0 && late === 0;
  }
  const playedOn = await playedOnMismatches(ctx);
  console.log(`  sessions.played_on: ${ctx.rows.sessions.length - playedOn}/${ctx.rows.sessions.length} equal Mongo's session date`);
  return ok && playedOn === 0;
}

function sameSession(session: ObjectId): (order: SourceOrder) => boolean {
  return (order) => order.sessionId.equals(session);
}

function busiestSession(ctx: VerifyContext): ObjectId | null {
  const counts = new Map<string, { id: ObjectId; n: number }>();
  for (const o of ctx.source.orders) {
    const hex = o.sessionId.toHexString();
    counts.set(hex, { id: o.sessionId, n: (counts.get(hex)?.n ?? 0) + 1 });
  }
  const best = [...counts.values()].sort((a, b) => b.n - a.n)[0];
  return best && best.n >= 2 ? best.id : null;
}

// Mongo's own order for the session: by timestamp, then _id — the Go API sorted orders
// by timestamp (orders.go:37).
function mongoOrderSequence(ctx: VerifyContext, session: ObjectId): string[] {
  return ctx.source.orders
    .filter(sameSession(session))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime() || a.id.toHexString().localeCompare(b.id.toHexString()))
    .map((o) => uuidFor('orders', o.id));
}

async function verifySampledSession(ctx: VerifyContext): Promise<boolean> {
  const session = busiestSession(ctx);
  if (!session) {
    console.log('  sampled session: no session has two or more orders — nothing to order-check');
    return false;
  }
  const mongo = mongoOrderSequence(ctx, session);
  const pg = await readAll('reading sampled session orders', (from, to) =>
    ctx.sb.from('orders').select('id, created_at').eq('session_id', uuidFor('sessions', session)).order('created_at').order('id').range(from, to),
  );
  const first = pg[0];
  const last = pg[pg.length - 1];
  const firstLast = first?.id === mongo[0] && last?.id === mongo[mongo.length - 1];
  const increasing = Boolean(first && last && Date.parse(first.created_at) < Date.parse(last.created_at));
  const sequence = pg.map((o) => o.id).join() === mongo.join();
  console.log(`  sampled session (mongo ${session.toHexString()}, ${pg.length} orders): first and last in Mongo's order: ${firstLast}; first strictly earlier than last: ${increasing}; whole sequence identical: ${sequence}`);
  return firstLast && increasing && sequence;
}

export async function verifyTimestamps(ctx: VerifyContext): Promise<boolean> {
  const every = await verifyEveryStamp(ctx);
  const sampled = await verifySampledSession(ctx);
  return every && sampled;
}
