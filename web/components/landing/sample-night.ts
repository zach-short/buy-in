import { computeBalanceCents, type AmountLike, type OrderLike, type RecipeLike, type StockLike } from '@pb/core';

// One invented poker night that every homepage demo reads from, so the table, the settle-up and
// the receipt agree to the cent. Chips in (200.00) equal chips out (200.00), as a real night must.

export const SESSION_NAME = 'Friday Night';

export type SamplePlayer = { id: string; name: string };

export const PLAYERS: readonly SamplePlayer[] = [
  { id: 'maya', name: 'Maya' },
  { id: 'theo', name: 'Theo' },
  { id: 'jordan', name: 'Jordan' },
  { id: 'priya', name: 'Priya' },
];

const OPENING_BUY_INS: readonly AmountLike[] = PLAYERS.map((p) => ({ playerId: p.id, amountCents: 4000 }));

export type TableEvent =
  | { kind: 'rebuy'; playerId: string; amountCents: number }
  | { kind: 'order'; playerId: string; drink: string; priceCents: number };

export const TABLE_EVENTS: readonly TableEvent[] = [
  { kind: 'order', playerId: 'theo', drink: 'Negroni', priceCents: 1000 },
  { kind: 'rebuy', playerId: 'maya', amountCents: 2000 },
  { kind: 'order', playerId: 'priya', drink: 'Old Fashioned', priceCents: 900 },
  { kind: 'order', playerId: 'maya', drink: 'Old Fashioned', priceCents: 900 },
  { kind: 'rebuy', playerId: 'theo', amountCents: 2000 },
  { kind: 'order', playerId: 'jordan', drink: 'Margarita', priceCents: 900 },
  { kind: 'order', playerId: 'maya', drink: 'Old Fashioned', priceCents: 900 },
];

const CASHOUTS: readonly AmountLike[] = [
  { playerId: 'maya', amountCents: 2500 },
  { playerId: 'theo', amountCents: 14500 },
  { playerId: 'jordan', amountCents: 0 },
  { playerId: 'priya', amountCents: 3000 },
];

export function playerName(playerId: string): string {
  return PLAYERS.find((p) => p.id === playerId)?.name ?? playerId;
}

function ledgerAfter(eventCount: number): { buyIns: AmountLike[]; orders: OrderLike[] } {
  const played = TABLE_EVENTS.slice(0, eventCount);
  const rebuys = played.flatMap((e) => (e.kind === 'rebuy' ? [{ playerId: e.playerId, amountCents: e.amountCents }] : []));
  const orders = played.flatMap((e) => (e.kind === 'order' ? [{ playerId: e.playerId, priceCents: e.priceCents }] : []));
  return { buyIns: [...OPENING_BUY_INS, ...rebuys], orders };
}

export type TableRow = { player: SamplePlayer; inCents: number; barCents: number; tabCents: number };

/** The live table after `eventCount` events: nobody has cashed out, so the tab is chips plus drinks. */
export function tableRows(eventCount: number): TableRow[] {
  const { buyIns, orders } = ledgerAfter(eventCount);
  return PLAYERS.map((player) => {
    const inCents = buyIns.filter((b) => b.playerId === player.id).reduce((t, b) => t + b.amountCents, 0);
    const barCents = orders.filter((o) => o.playerId === player.id).reduce((t, o) => t + o.priceCents, 0);
    return { player, inCents, barCents, tabCents: computeBalanceCents(player.id, orders, buyIns, [], []) };
  });
}

export type FinalBalance = { player: SamplePlayer; balanceCents: number };

/** End of the night, in the house convention: positive means the player owes the house. */
export function finalBalances(): FinalBalance[] {
  const { buyIns, orders } = ledgerAfter(TABLE_EVENTS.length);
  return PLAYERS.map((player) => ({
    player,
    balanceCents: computeBalanceCents(player.id, orders, buyIns, CASHOUTS, []),
  }));
}

export type ReceiptLine = { label: string; cents: number };

export function receiptLines(playerId: string): ReceiptLine[] {
  const events = TABLE_EVENTS.filter((e) => e.playerId === playerId);
  const cashout = CASHOUTS.find((c) => c.playerId === playerId)?.amountCents ?? 0;
  return [
    { label: 'Buy-in', cents: 4000 },
    ...events.map((e) => (e.kind === 'rebuy' ? { label: 'Rebuy', cents: e.amountCents } : { label: e.drink, cents: e.priceCents })),
    { label: 'Cash-out', cents: -cashout },
  ];
}

export type Bottle = StockLike & { name: string };

export const BOTTLES: readonly Bottle[] = [
  { id: 'bourbon', name: 'Bourbon', qtyOnHand: 24 },
  { id: 'gin', name: 'Gin', qtyOnHand: 18 },
  { id: 'campari', name: 'Campari', qtyOnHand: 12 },
  { id: 'vermouth', name: 'Sweet vermouth', qtyOnHand: 10 },
  { id: 'tequila', name: 'Tequila', qtyOnHand: 16 },
  { id: 'lime', name: 'Lime', qtyOnHand: 8 },
];

export type SampleDrink = RecipeLike & { name: string; priceCents: number };

export const DRINKS: readonly SampleDrink[] = [
  { name: 'Old Fashioned', priceCents: 900, ingredients: [{ itemId: 'bourbon', qtyUsed: 2 }] },
  {
    name: 'Negroni',
    priceCents: 1000,
    ingredients: [
      { itemId: 'gin', qtyUsed: 1 },
      { itemId: 'campari', qtyUsed: 1 },
      { itemId: 'vermouth', qtyUsed: 1 },
    ],
  },
  {
    name: 'Boulevardier',
    priceCents: 1000,
    ingredients: [
      { itemId: 'bourbon', qtyUsed: 1.25 },
      { itemId: 'campari', qtyUsed: 1 },
      { itemId: 'vermouth', qtyUsed: 1 },
    ],
  },
  {
    name: 'Margarita',
    priceCents: 900,
    ingredients: [
      { itemId: 'tequila', qtyUsed: 2 },
      { itemId: 'lime', qtyUsed: 1 },
    ],
  },
  { name: 'Gin & Tonic', priceCents: 700, ingredients: [{ itemId: 'gin', qtyUsed: 2 }] },
];
