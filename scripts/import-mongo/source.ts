import { MongoClient, type Document, type ObjectId } from 'mongodb';

import type { ImportEnv } from './env';
import {
  amount,
  flag,
  objectId,
  objectIdList,
  optionalObjectId,
  optionalText,
  optionalTimestamp,
  shapeError,
  text,
  timestamp,
} from './parse';

// The shapes are backend/models/barModels.go as the Go API wrote them. Read directly
// from Mongo via DATABASE_URL — never through the Go API, which D13 took down.

export interface SourcePlayer {
  id: ObjectId;
  name: string;
  phone: string | null;
  venmo: string | null;
  createdAt: Date | null;
}

export interface SourceItem {
  id: ObjectId;
  name: string;
  category: string;
  unit: string;
  qtyOnHand: number;
  reorderThreshold: number;
  costPerUnit: number;
}

export interface SourceIngredient {
  itemId: ObjectId;
  qtyUsed: number;
}

export interface SourceDrink {
  id: ObjectId;
  name: string;
  price: number;
  costEstimate: number;
  ingredients: SourceIngredient[];
}

export interface SourceSession {
  id: ObjectId;
  name: string;
  date: Date;
  status: string;
  playerIds: ObjectId[];
}

export interface SourceOrder {
  id: ObjectId;
  sessionId: ObjectId;
  playerId: ObjectId;
  drinkId: ObjectId | null;
  drinkName: string;
  price: number;
  costEstimate: number;
  timestamp: Date;
  paid: boolean;
}

/** A buy-in or a cash-out: the two share one shape in Mongo. */
export interface SourceEntry {
  id: ObjectId;
  sessionId: ObjectId;
  playerId: ObjectId;
  amount: number;
  timestamp: Date;
}

export interface SourcePayment {
  id: ObjectId;
  playerId: ObjectId;
  amount: number;
  note: string;
  direction: string;
  timestamp: Date;
}

export interface MongoSource {
  players: SourcePlayer[];
  inventory: SourceItem[];
  drinks: SourceDrink[];
  sessions: SourceSession[];
  orders: SourceOrder[];
  buyIns: SourceEntry[];
  cashouts: SourceEntry[];
  payments: SourcePayment[];
  /** Raw documents per collection, kept only so preflight can report missing fields. */
  raw: Record<string, Document[]>;
}

function parsePlayer(d: Document): SourcePlayer {
  return {
    id: objectId('players', d, '_id'),
    name: text('players', d, 'name'),
    phone: optionalText('players', d, 'phone'),
    venmo: optionalText('players', d, 'venmo'),
    createdAt: optionalTimestamp(d, 'createdAt'),
  };
}

function parseItem(d: Document): SourceItem {
  return {
    id: objectId('inventory', d, '_id'),
    name: text('inventory', d, 'name'),
    category: text('inventory', d, 'category'),
    unit: text('inventory', d, 'unit'),
    qtyOnHand: amount('inventory', d, 'qtyOnHand', 0),
    reorderThreshold: amount('inventory', d, 'reorderThreshold', 0),
    costPerUnit: amount('inventory', d, 'costPerUnit', 0),
  };
}

function parseIngredients(d: Document): SourceIngredient[] {
  const list: unknown = d.ingredients;
  // A Go nil slice marshals to BSON null, so a recipe with no ingredients is null.
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list)) throw shapeError('drinks', d, 'ingredients', 'a list');
  return list.map((ing: Document) => ({
    itemId: objectId('drinks', ing, 'itemId'),
    qtyUsed: amount('drinks', ing, 'qtyUsed'),
  }));
}

function parseDrink(d: Document): SourceDrink {
  return {
    id: objectId('drinks', d, '_id'),
    name: text('drinks', d, 'name'),
    price: amount('drinks', d, 'price'),
    costEstimate: amount('drinks', d, 'costEstimate', 0),
    ingredients: parseIngredients(d),
  };
}

function parseSession(d: Document): SourceSession {
  return {
    id: objectId('sessions', d, '_id'),
    name: text('sessions', d, 'name'),
    date: timestamp('sessions', d, 'date'),
    status: text('sessions', d, 'status'),
    playerIds: objectIdList('sessions', d, 'playerIds'),
  };
}

function parseOrder(d: Document): SourceOrder {
  return {
    id: objectId('orders', d, '_id'),
    sessionId: objectId('orders', d, 'sessionId'),
    playerId: objectId('orders', d, 'playerId'),
    drinkId: optionalObjectId('orders', d, 'drinkId'),
    drinkName: text('orders', d, 'drinkName'),
    price: amount('orders', d, 'price'),
    costEstimate: amount('orders', d, 'costEstimate', 0),
    timestamp: timestamp('orders', d, 'timestamp'),
    paid: flag('orders', d, 'paid', false),
  };
}

function parseEntry(collection: string): (d: Document) => SourceEntry {
  return (d) => ({
    id: objectId(collection, d, '_id'),
    sessionId: objectId(collection, d, 'sessionId'),
    playerId: objectId(collection, d, 'playerId'),
    amount: amount(collection, d, 'amount'),
    timestamp: timestamp(collection, d, 'timestamp'),
  });
}

function parsePayment(d: Document): SourcePayment {
  return {
    id: objectId('payments', d, '_id'),
    playerId: objectId('payments', d, 'playerId'),
    amount: amount('payments', d, 'amount'),
    note: optionalText('payments', d, 'note') ?? '',
    direction: text('payments', d, 'direction'),
    timestamp: timestamp('payments', d, 'timestamp'),
  };
}

export const COLLECTIONS = ['players', 'inventory', 'drinks', 'sessions', 'orders', 'buyins', 'cashouts', 'payments'];

function parseAll(raw: Record<string, Document[]>): MongoSource {
  const docs = (name: string): Document[] => raw[name] ?? [];
  return {
    players: docs('players').map(parsePlayer),
    inventory: docs('inventory').map(parseItem),
    drinks: docs('drinks').map(parseDrink),
    sessions: docs('sessions').map(parseSession),
    orders: docs('orders').map(parseOrder),
    buyIns: docs('buyins').map(parseEntry('buyins')),
    cashouts: docs('cashouts').map(parseEntry('cashouts')),
    payments: docs('payments').map(parsePayment),
    raw,
  };
}

export async function withMongo<T>(env: ImportEnv, work: (client: MongoClient) => Promise<T>): Promise<T> {
  const client = new MongoClient(env.mongoUrl, { serverApi: { version: '1' }, serverSelectionTimeoutMS: 15_000 });
  try {
    await client.connect();
    return await work(client);
  } finally {
    await client.close();
  }
}

/** Read every collection the import needs, sorted by _id so runs are deterministic. */
export async function readMongo(env: ImportEnv): Promise<MongoSource> {
  return withMongo(env, async (client) => {
    const db = client.db(env.mongoDatabase);
    const raw: Record<string, Document[]> = {};
    for (const name of COLLECTIONS) {
      raw[name] = await db.collection(name).find().sort({ _id: 1 }).toArray();
    }
    return parseAll(raw);
  });
}
