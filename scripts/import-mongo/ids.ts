import { createHash } from 'node:crypto';

import type { ObjectId } from 'mongodb';

// UUIDv5 (RFC 4122 §4.3) over a fixed namespace. Deterministic ids are what make a
// second run byte-identical to the first — D9's definition of idempotent — and they
// let any Postgres row be traced back to the Mongo document it came from. Changing
// this constant changes every imported id; never change it between a rehearsal and
// the real run.
const NAMESPACE = Buffer.from('fe2feaadf1f0425a8a580810972a3799', 'hex');

export type SourceKind =
  | 'players'
  | 'inventory'
  | 'drinks'
  | 'sessions'
  | 'orders'
  | 'buyins'
  | 'cashouts'
  | 'payments';

function formatUuid(bytes: Buffer): string {
  const hex = bytes.toString('hex');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-');
}

export function uuidFor(kind: SourceKind, id: ObjectId): string {
  const digest = createHash('sha1').update(NAMESPACE).update(`${kind}:${id.toHexString()}`).digest();
  const bytes = digest.subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  return formatUuid(bytes);
}
