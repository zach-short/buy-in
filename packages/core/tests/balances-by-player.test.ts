import { describe, expect, it } from 'vitest';

import {
  balancesByPlayer, computeBalanceCents, type AmountLike, type OrderLike, type PaymentLike,
} from '../src/balance';

// balancesByPlayer is a faster route to computeBalanceCents, never a second rule: for every
// player, over any mix of the four ledger lists, the two must return the same integer.

// A seeded generator, so a failure names a seed that reproduces it.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Ledger {
  players: string[];
  orders: OrderLike[];
  buyIns: AmountLike[];
  cashouts: AmountLike[];
  payments: PaymentLike[];
}

function randomLedger(seed: number): Ledger {
  const rand = mulberry32(seed);
  const int = (max: number) => Math.floor(rand() * max);
  // One more id than ever appears in a row, so a player with no rows is always covered.
  const players = Array.from({ length: 2 + int(12) }, (_, i) => `p${i}`);
  const anyone = () => players[int(players.length - 1)];
  const cents = () => int(50_000);
  return {
    players,
    orders: Array.from({ length: int(200) }, () => ({ playerId: anyone(), priceCents: cents() })),
    buyIns: Array.from({ length: int(60) }, () => ({ playerId: anyone(), amountCents: cents() })),
    cashouts: Array.from({ length: int(60) }, () => ({ playerId: anyone(), amountCents: cents() })),
    payments: Array.from({ length: int(80) }, () => ({
      playerId: anyone(), amountCents: cents(), direction: rand() < 0.5 ? 'received' as const : 'sent' as const,
    })),
  };
}

function expectAgreement(ledger: Ledger) {
  const { players, orders, buyIns, cashouts, payments } = ledger;
  const balances = balancesByPlayer(orders, buyIns, cashouts, payments);
  for (const id of players) {
    expect(balances.get(id) ?? 0).toBe(computeBalanceCents(id, orders, buyIns, cashouts, payments));
  }
  for (const id of balances.keys()) expect(players).toContain(id);
}

describe('balancesByPlayer', () => {
  it('agrees with computeBalanceCents for every player over 500 random ledgers', () => {
    for (let seed = 1; seed <= 500; seed++) {
      expectAgreement(randomLedger(seed));
    }
  });

  it('covers both payment directions and all four lists in the random ledgers', () => {
    const ledgers = Array.from({ length: 500 }, (_, i) => randomLedger(i + 1));
    expect(ledgers.some((l) => l.payments.some((p) => p.direction === 'received'))).toBe(true);
    expect(ledgers.some((l) => l.payments.some((p) => p.direction === 'sent'))).toBe(true);
    expect(ledgers.every((l) => l.orders.length + l.buyIns.length + l.cashouts.length + l.payments.length > 0)).toBe(true);
  });

  it('applies each sign by hand: drinks and buy-ins owe, cash-outs and received pay down, sent owes again', () => {
    const balances = balancesByPlayer(
      [{ playerId: 'a', priceCents: 800 }],
      [{ playerId: 'a', amountCents: 2000 }],
      [{ playerId: 'a', amountCents: 500 }],
      [
        { playerId: 'a', amountCents: 1000, direction: 'received' },
        { playerId: 'a', amountCents: 300, direction: 'sent' },
        { playerId: 'b', amountCents: 700, direction: 'sent' },
      ],
    );
    expect(balances.get('a')).toBe(800 + 2000 - 500 - 1000 + 300);
    expect(balances.get('b')).toBe(700);
  });

  it('is empty for an empty ledger', () => {
    expect(balancesByPlayer([], [], [], []).size).toBe(0);
  });
});
