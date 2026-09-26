import type { MongoSource } from './source';
import type { Db } from './supabase';
import type { ImportRows } from './transform';
import { verifyBalances } from './verify-balances';
import { verifyD10 } from './verify-d10';
import { verifyTimestamps } from './verify-timestamps';

export interface VerifyContext {
  sb: Db;
  anon: Db;
  barId: string;
  source: MongoSource;
  rows: ImportRows;
  /** ms since epoch; a stored timestamp at or after this came from a default, not Mongo. */
  importStartedAt: number;
}

/** PLAN.md phase 8's three proofs no gate supplies. Every one runs even if one fails. */
export async function verifyAll(ctx: VerifyContext): Promise<boolean> {
  console.log('verify: per-player balances (Mongo vs get_shared_tab)');
  const balances = await verifyBalances(ctx);
  console.log('verify: timestamps written explicitly');
  const timestamps = await verifyTimestamps(ctx);
  console.log('verify: D10 unique indexes on real data');
  const d10 = await verifyD10(ctx);
  const ok = balances && timestamps && d10;
  console.log(`verify: ${ok ? 'PASS' : 'FAIL'} (balances ${balances}, timestamps ${timestamps}, d10 ${d10})`);
  return ok;
}
