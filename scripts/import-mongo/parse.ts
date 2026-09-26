import { ObjectId, type Document } from 'mongodb';

// Documents are parsed field by field rather than cast to a type: the Go handlers
// validated little (UpdateSession writes any status string, sessions.go:96-98), and a
// cast would let a malformed row reach Postgres as a wrong value instead of stopping
// here. Errors name the collection, the document id and the field — never the value,
// which may be a phone number or an amount.

export function shapeError(collection: string, doc: Document, field: string, expected: string): Error {
  const id = doc._id instanceof ObjectId ? doc._id.toHexString() : 'unknown-id';
  return new Error(`${collection} ${id}: field "${field}" is not ${expected}`);
}

export function objectId(collection: string, doc: Document, field: string): ObjectId {
  const value: unknown = doc[field];
  if (value instanceof ObjectId) return value;
  throw shapeError(collection, doc, field, 'an ObjectId');
}

// Go marshals an unset primitive.ObjectID as all zeroes, not as a missing field.
export function optionalObjectId(collection: string, doc: Document, field: string): ObjectId | null {
  const value: unknown = doc[field];
  if (value === undefined || value === null) return null;
  if (!(value instanceof ObjectId)) throw shapeError(collection, doc, field, 'an ObjectId');
  return /^0+$/.test(value.toHexString()) ? null : value;
}

export function objectIdList(collection: string, doc: Document, field: string): ObjectId[] {
  const value: unknown = doc[field];
  if (value === undefined || value === null) return [];
  if (Array.isArray(value) && value.every((v): v is ObjectId => v instanceof ObjectId)) return value;
  throw shapeError(collection, doc, field, 'a list of ObjectIds');
}

export function text(collection: string, doc: Document, field: string): string {
  const value: unknown = doc[field];
  if (typeof value === 'string') return value;
  throw shapeError(collection, doc, field, 'a string');
}

// The Go model marks phone and venmo `omitempty`, and UpdatePlayer writes "" to clear
// them (players.go:98-99), so missing and empty mean the same thing: no value.
export function optionalText(collection: string, doc: Document, field: string): string | null {
  const value: unknown = doc[field];
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') return value;
  throw shapeError(collection, doc, field, 'a string');
}

export function amount(collection: string, doc: Document, field: string, fallback?: number): number {
  const value: unknown = doc[field];
  if ((value === undefined || value === null) && fallback !== undefined) return fallback;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  throw shapeError(collection, doc, field, 'a finite number');
}

export function flag(collection: string, doc: Document, field: string, fallback: boolean): boolean {
  const value: unknown = doc[field];
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  throw shapeError(collection, doc, field, 'a boolean');
}

// Go's zero time.Time is 0001-01-01, which is "never set", not a real moment.
function isRealDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime()) && value.getUTCFullYear() > 1;
}

export function timestamp(collection: string, doc: Document, field: string): Date {
  const value: unknown = doc[field];
  if (isRealDate(value)) return value;
  throw shapeError(collection, doc, field, 'a real date');
}

export function optionalTimestamp(doc: Document, field: string): Date | null {
  const value: unknown = doc[field];
  return isRealDate(value) ? value : null;
}
