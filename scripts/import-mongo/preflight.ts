import { ObjectId, type Document } from 'mongodb';

import { computedCents, hasSubCent, hasSubThousandth, quantity, typedCents } from './convert';
import type { MongoSource } from './source';

// Everything here reads Mongo only and writes nothing. A blocking finding stops the
// import before its first write. Findings carry Mongo ObjectIds and counts — never a
// name, a phone number or an amount, because this output is pasted into reports.

export interface Finding {
  code: string;
  blocking: boolean;
  detail: string;
  ids: string[];
}

function finding(code: string, blocking: boolean, detail: string, ids: ObjectId[]): Finding {
  return { code, blocking, detail, ids: ids.map((id) => id.toHexString()) };
}

function hexSet(rows: { id: ObjectId }[]): Set<string> {
  return new Set(rows.map((row) => row.id.toHexString()));
}

/** Ids of every row whose key is shared with at least one other row. */
function duplicated<T>(rows: T[], key: (row: T) => string, id: (row: T) => ObjectId): ObjectId[] {
  const groups = new Map<string, ObjectId[]>();
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), id(row)]);
  return [...groups.values()].filter((ids) => ids.length > 1).flat();
}

// D10: both indexes exist because the UI assumes what nothing enforced. A violation in
// real data is a finding for the owner, never something to rename or delete past.
function d10Findings(s: MongoSource): Finding[] {
  const exact = duplicated(s.players, (p) => p.name, (p) => p.id);
  const exactSet = new Set(exact.map((id) => id.toHexString()));
  const loose = duplicated(s.players, (p) => p.name.trim().toLowerCase(), (p) => p.id)
    .filter((id) => !exactSet.has(id.toHexString()));
  const cashouts = duplicated(s.cashouts, (c) => `${c.sessionId.toHexString()}:${c.playerId.toHexString()}`, (c) => c.id);
  return [
    finding('D10_DUPLICATE_PLAYER_NAME', true, 'players sharing an exact name — players_bar_name_uniq would reject them', exact),
    finding('D10_DUPLICATE_CASHOUT', true, 'cash-outs sharing a (session, player) — cashouts_session_player_uniq would reject them', cashouts),
    finding('NAME_CASE_OR_SPACE_VARIANTS', false, 'names equal only after trim + lowercase; the index allows them', loose),
  ];
}

interface SessionMoneyRow {
  id: ObjectId;
  sessionId: ObjectId;
  playerId: ObjectId;
}

function ledgerRows(s: MongoSource): SessionMoneyRow[] {
  return [...s.orders, ...s.buyIns, ...s.cashouts];
}

// An orphaned money row cannot be stored (its foreign key has nothing to point at) but
// still counts in the Mongo balance, so importing without it would move a real balance.
function orphanFindings(s: MongoSource): Finding[] {
  const sessions = hexSet(s.sessions);
  const players = hexSet(s.players);
  const noSession = ledgerRows(s).filter((r) => !sessions.has(r.sessionId.toHexString())).map((r) => r.id);
  const noPlayer = [...ledgerRows(s), ...s.payments].filter((r) => !players.has(r.playerId.toHexString())).map((r) => r.id);
  const listsMissing = s.sessions.filter((x) => x.playerIds.some((id) => !players.has(id.toHexString()))).map((x) => x.id);
  const listsTwice = s.sessions.filter((x) => new Set(x.playerIds.map((id) => id.toHexString())).size < x.playerIds.length).map((x) => x.id);
  return [
    finding('ORPHAN_LEDGER_SESSION', true, 'orders/buy-ins/cash-outs whose session no longer exists', noSession),
    finding('ORPHAN_LEDGER_PLAYER', true, 'orders/buy-ins/cash-outs/payments whose player no longer exists', noPlayer),
    finding('SESSION_LISTS_MISSING_PLAYER', false, 'sessions whose playerIds name a player that does not exist (dropped from session_players)', listsMissing),
    finding('SESSION_LISTS_PLAYER_TWICE', false, 'sessions listing one player twice (deduplicated)', listsTwice),
  ];
}

function catalogueFindings(s: MongoSource): Finding[] {
  const items = hexSet(s.inventory);
  const drinks = hexSet(s.drinks);
  const missingItem = s.drinks.filter((d) => d.ingredients.some((i) => !items.has(i.itemId.toHexString()))).map((d) => d.id);
  const itemTwice = s.drinks.filter((d) => new Set(d.ingredients.map((i) => i.itemId.toHexString())).size < d.ingredients.length).map((d) => d.id);
  const drinkGone = s.orders.filter((o) => o.drinkId !== null && !drinks.has(o.drinkId.toHexString())).map((o) => o.id);
  const noDrink = s.orders.filter((o) => o.drinkId === null).map((o) => o.id);
  return [
    finding('RECIPE_ITEM_MISSING', true, 'recipes naming an inventory item that does not exist (dropping it would make the drink look available)', missingItem),
    finding('RECIPE_ITEM_TWICE', true, 'recipes naming one item twice (drink_ingredients primary key)', itemTwice),
    finding('ORDER_DRINK_GONE', false, 'orders whose drink was deleted since — imported with drink_id null, name and price kept', drinkGone),
    finding('ORDER_WITHOUT_DRINK_ID', false, 'orders with no drinkId at all — imported with drink_id null', noDrink),
  ];
}

function sessionMembershipFindings(s: MongoSource): Finding[] {
  const members = new Map(s.sessions.map((x) => [x.id.toHexString(), new Set(x.playerIds.map((id) => id.toHexString()))]));
  const outside = ledgerRows(s)
    .filter((r) => members.get(r.sessionId.toHexString())?.has(r.playerId.toHexString()) === false)
    .map((r) => r.id);
  return [
    finding('LEDGER_PLAYER_NOT_IN_SESSION', false, 'money rows for a player the session does not list — imported and counted, but that session is absent from their receipt list', outside),
  ];
}

const CATEGORIES = new Set(['Spirit', 'Mixer', 'Garnish', 'Syrup', 'Equipment']);

// The check constraints of 0001_init.sql, evaluated on the converted values — a buy-in
// of $0.004 is a positive float and a zero-cent row, and Postgres sees the latter.
function constraintFindings(s: MongoSource): Finding[] {
  const ids = <T extends { id: ObjectId }>(rows: T[], bad: (row: T) => boolean): ObjectId[] => rows.filter(bad).map((r) => r.id);
  return [
    finding('BAD_CATEGORY', true, 'inventory category outside Spirit|Mixer|Garnish|Syrup|Equipment', ids(s.inventory, (i) => !CATEGORIES.has(i.category))),
    finding('NEGATIVE_STOCK', true, 'qty_on_hand below zero after conversion', ids(s.inventory, (i) => quantity(i.qtyOnHand) < 0)),
    finding('NONPOSITIVE_RECIPE_QTY', true, 'recipe qty_used not above zero after conversion', ids(s.drinks, (d) => d.ingredients.some((i) => quantity(i.qtyUsed) <= 0))),
    finding('NEGATIVE_MONEY', true, 'a price, cost estimate or unit cost below zero', [
      ...ids(s.inventory, (i) => typedCents(i.costPerUnit) < 0),
      ...ids(s.drinks, (d) => typedCents(d.price) < 0 || computedCents(d.costEstimate) < 0),
      ...ids(s.orders, (o) => typedCents(o.price) < 0 || computedCents(o.costEstimate) < 0),
    ]),
    finding('NONPOSITIVE_BUYIN', true, 'buy-ins of zero cents or less', ids(s.buyIns, (b) => typedCents(b.amount) <= 0)),
    finding('NEGATIVE_CASHOUT', true, 'cash-outs below zero', ids(s.cashouts, (c) => typedCents(c.amount) < 0)),
    finding('NONPOSITIVE_PAYMENT', true, 'payments of zero cents or less', ids(s.payments, (p) => typedCents(p.amount) <= 0)),
    finding('BAD_DIRECTION', true, 'payment direction outside received|sent', ids(s.payments, (p) => p.direction !== 'received' && p.direction !== 'sent')),
    finding('BAD_SESSION_STATUS', true, 'session status outside active|closed', ids(s.sessions, (x) => x.status !== 'active' && x.status !== 'closed')),
  ];
}

// H5, field by field. A ledger amount with sub-cent precision would make a balance
// depend on which rounding the import picked, so it blocks; the rest are reported.
function precisionFindings(s: MongoSource): Finding[] {
  const ids = <T extends { id: ObjectId }>(rows: T[], bad: (row: T) => boolean): ObjectId[] => rows.filter(bad).map((r) => r.id);
  const ruleMatters = (x: number): boolean => typedCents(x) !== computedCents(x);
  return [
    finding('SUBCENT_LEDGER_AMOUNT', true, 'typed ledger amounts (order price, buy-in, cash-out, payment) finer than a cent', [
      ...ids(s.orders, (o) => hasSubCent(o.price)),
      ...ids(s.buyIns, (b) => hasSubCent(b.amount)),
      ...ids(s.cashouts, (c) => hasSubCent(c.amount)),
      ...ids(s.payments, (p) => hasSubCent(p.amount)),
    ]),
    finding('SUBCENT_DRINK_PRICE', false, 'drink list prices finer than a cent (rounded by toCents)', ids(s.drinks, (d) => hasSubCent(d.price))),
    finding('SUBCENT_UNIT_COST', false, 'inventory cost-per-unit finer than a cent — cost_per_unit_cents keeps whole cents only', ids(s.inventory, (i) => hasSubCent(i.costPerUnit))),
    finding('COST_ESTIMATE_RULE_MATTERS', false, 'computed cost estimates where toCents and the computed rule disagree by a cent', [
      ...ids(s.drinks, (d) => ruleMatters(d.costEstimate)),
      ...ids(s.orders, (o) => ruleMatters(o.costEstimate)),
    ]),
    finding('QTY_FINER_THAN_THOUSANDTH', false, 'quantities with more than three decimals after removing float noise (rounded to numeric(12,3))', [
      ...ids(s.inventory, (i) => hasSubThousandth(i.qtyOnHand) || hasSubThousandth(i.reorderThreshold)),
      ...ids(s.drinks, (d) => d.ingredients.some((i) => hasSubThousandth(i.qtyUsed))),
    ]),
    finding('QTY_FLOAT_NOISE', false, 'stock levels carrying $inc float noise that conversion removes', ids(s.inventory, (i) => quantity(i.qtyOnHand) !== i.qtyOnHand && !hasSubThousandth(i.qtyOnHand))),
  ];
}

const EXPECTED_FIELDS: Record<string, string[]> = {
  players: ['name', 'createdAt'],
  inventory: ['qtyOnHand', 'reorderThreshold', 'costPerUnit'],
  drinks: ['price', 'costEstimate', 'ingredients'],
  sessions: ['date', 'status', 'playerIds'],
  orders: ['drinkId', 'price', 'costEstimate', 'timestamp', 'paid'],
  buyins: ['amount', 'timestamp'],
  cashouts: ['amount', 'timestamp'],
  payments: ['amount', 'note', 'direction', 'timestamp'],
};

function idOf(doc: Document): ObjectId[] {
  const id: unknown = doc._id;
  return id instanceof ObjectId ? [id] : [];
}

function missingFieldFindings(s: MongoSource): Finding[] {
  return Object.entries(EXPECTED_FIELDS).flatMap(([collection, fields]) =>
    fields.map((field) => {
      const docs = (s.raw[collection] ?? []).filter((d) => d[field] === undefined);
      return finding(`FIELD_MISSING ${collection}.${field}`, false, 'absent in these documents; parse used its documented default', docs.flatMap(idOf));
    }),
  );
}

export function preflight(s: MongoSource): Finding[] {
  return [
    ...d10Findings(s),
    ...orphanFindings(s),
    ...catalogueFindings(s),
    ...sessionMembershipFindings(s),
    ...constraintFindings(s),
    ...precisionFindings(s),
    ...missingFieldFindings(s),
  ];
}

export function printFindings(findings: Finding[]): boolean {
  const blocking = findings.filter((f) => f.blocking && f.ids.length > 0);
  for (const f of findings) {
    const tag = f.blocking ? (f.ids.length > 0 ? 'BLOCK' : 'ok   ') : 'info ';
    console.log(`  [${tag}] ${f.code}: ${f.ids.length} — ${f.detail}`);
    if (f.blocking && f.ids.length > 0) console.log(`          mongo _id: ${f.ids.join(', ')}`);
  }
  return blocking.length === 0;
}
