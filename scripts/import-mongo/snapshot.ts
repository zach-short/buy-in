import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

import type { Json } from '@pb/core';

import { readAll } from './read';
import type { Db } from './supabase';

// D9's idempotency proof: two runs must leave the bar byte-identical. Every table is
// read in a fixed order and hashed. The file this writes holds real names, phone
// numbers and balances — point it outside the repo, never at a tracked path.
// takeSnapshot is also what drift.ts reads the live bar with, before any write.

export type Row = { [column: string]: Json | undefined };
type Page<R> = PromiseLike<{ data: R[] | null; error: { message: string; code?: string } | null }>;

export interface TableDump {
  table: string;
  rows: Row[];
}

async function dump<R extends Row>(table: string, page: (from: number, to: number) => Page<R>): Promise<TableDump> {
  return { table, rows: await readAll(`snapshotting ${table}`, page) };
}

export async function takeSnapshot(sb: Db, barId: string): Promise<TableDump[]> {
  return [
    await dump('bars', (f, t) => sb.from('bars').select('*').eq('id', barId).order('id').range(f, t)),
    await dump('bar_members', (f, t) => sb.from('bar_members').select('*').eq('bar_id', barId).order('user_id').range(f, t)),
    await dump('inventory_items', (f, t) => sb.from('inventory_items').select('*').eq('bar_id', barId).order('id').range(f, t)),
    await dump('drinks', (f, t) => sb.from('drinks').select('*').eq('bar_id', barId).order('id').range(f, t)),
    await dump('drink_ingredients', (f, t) => sb.from('drink_ingredients').select('*').eq('bar_id', barId).order('drink_id').order('item_id').range(f, t)),
    await dump('players', (f, t) => sb.from('players').select('*').eq('bar_id', barId).order('id').range(f, t)),
    await dump('sessions', (f, t) => sb.from('sessions').select('*').eq('bar_id', barId).order('id').range(f, t)),
    await dump('session_players', (f, t) => sb.from('session_players').select('*').eq('bar_id', barId).order('session_id').order('player_id').range(f, t)),
    await dump('orders', (f, t) => sb.from('orders').select('*').eq('bar_id', barId).order('id').range(f, t)),
    await dump('buy_ins', (f, t) => sb.from('buy_ins').select('*').eq('bar_id', barId).order('id').range(f, t)),
    await dump('cashouts', (f, t) => sb.from('cashouts').select('*').eq('bar_id', barId).order('id').range(f, t)),
    await dump('payments', (f, t) => sb.from('payments').select('*').eq('bar_id', barId).order('id').range(f, t)),
    await dump('player_share_links', (f, t) => sb.from('player_share_links').select('*').eq('bar_id', barId).order('token').range(f, t)),
    await dump('player_claim_links', (f, t) => sb.from('player_claim_links').select('*').eq('bar_id', barId).order('token').range(f, t)),
  ];
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/** Write the dump and print one line per table: row count and content hash. */
export function writeSnapshot(path: string, dumps: TableDump[]): void {
  const body = Object.fromEntries(dumps.map((d) => [d.table, d.rows]));
  writeFileSync(path, `${JSON.stringify(body, null, 2)}\n`, { mode: 0o600 });
  for (const d of dumps) {
    console.log(`  ${d.table}: ${d.rows.length} rows, sha256 ${sha256(JSON.stringify(d.rows)).slice(0, 16)}`);
  }
  console.log(`  whole snapshot sha256 ${sha256(JSON.stringify(body)).slice(0, 16)} → ${path}`);
}
