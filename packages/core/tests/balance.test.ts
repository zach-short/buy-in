import { describe, expect, it } from 'vitest';

import { computeBalanceCents, isSettled } from '../src/balance';
import { toCents } from '../src/money';

// ── The pre-migration implementation, copied verbatim from web/lib/bar-api.ts:127-140
// as it stood at 2026-09-16. It is here so these are characterization tests: they
// compare the behaviour that shipped against the behaviour that replaces it, rather
// than asserting that the new code does what the new code does (X1).

interface LegacyRow { playerId: string; }
interface LegacyOrder extends LegacyRow { price: number; }
interface LegacyAmount extends LegacyRow { amount: number; }
interface LegacyPayment extends LegacyAmount { direction: 'received' | 'sent'; }

function legacyComputeBalance(
  playerId: string,
  orders: LegacyOrder[],
  buyIns: LegacyAmount[],
  cashouts: LegacyAmount[],
  payments: LegacyPayment[],
): number {
  const drinks   = orders.filter(o => o.playerId === playerId).reduce((s, o) => s + o.price, 0);
  const buys     = buyIns.filter(b => b.playerId === playerId).reduce((s, b) => s + b.amount, 0);
  const outs     = cashouts.filter(c => c.playerId === playerId).reduce((s, c) => s + c.amount, 0);
  const received = payments.filter(p => p.playerId === playerId && p.direction === 'received').reduce((s, p) => s + p.amount, 0);
  const sent     = payments.filter(p => p.playerId === playerId && p.direction === 'sent').reduce((s, p) => s + p.amount, 0);
  return drinks + buys - outs - received + sent;
}

interface Scenario {
  name: string;
  orders: LegacyOrder[];
  buyIns: LegacyAmount[];
  cashouts: LegacyAmount[];
  payments: LegacyPayment[];
}

const P = 'player-1';
const OTHER = 'player-2';

const scenarios: Scenario[] = [
  {
    name: 'a plain night: three drinks and a buy-in, nothing settled',
    orders: [
      { playerId: P, price: 12 },
      { playerId: P, price: 8.5 },
      { playerId: P, price: 11.25 },
      { playerId: OTHER, price: 99 },
    ],
    buyIns: [{ playerId: P, amount: 20 }, { playerId: OTHER, amount: 40 }],
    cashouts: [],
    payments: [],
  },
  {
    name: 'cashed out ahead, so the house owes the player',
    orders: [{ playerId: P, price: 9.75 }],
    buyIns: [{ playerId: P, amount: 20 }],
    cashouts: [{ playerId: P, amount: 65.5 }],
    payments: [],
  },
  {
    name: 'partially paid: a received payment reduces what is owed',
    orders: [{ playerId: P, price: 14.25 }, { playerId: P, price: 7.75 }],
    buyIns: [{ playerId: P, amount: 20 }],
    cashouts: [{ playerId: P, amount: 10 }],
    payments: [{ playerId: P, amount: 15.5, direction: 'received' }],
  },
  {
    name: 'the house sent money back, which increases the balance again',
    orders: [],
    buyIns: [],
    cashouts: [{ playerId: P, amount: 30 }],
    payments: [{ playerId: P, amount: 30, direction: 'sent' }],
  },
  {
    name: 'the classic float trap: 0.1 + 0.2 amounts',
    orders: [{ playerId: P, price: 0.1 }, { playerId: P, price: 0.2 }],
    buyIns: [],
    cashouts: [],
    payments: [],
  },
  {
    name: 'settled exactly — the case the float epsilon existed for',
    orders: [{ playerId: P, price: 10.1 }, { playerId: P, price: 20.2 }],
    buyIns: [],
    cashouts: [],
    payments: [{ playerId: P, amount: 30.3, direction: 'received' }],
  },
  {
    name: 'no rows at all',
    orders: [],
    buyIns: [],
    cashouts: [],
    payments: [],
  },
];

/**
 * `Math.round` of a tiny negative float is `-0`, and `Object.is(-0, 0)` is false, so
 * `expect(0).toBe(-0)` fails even though `-0 === 0` is true in JavaScript. The ported
 * implementation sums integers and produces `+0`; the float one produces `-0` for the
 * same settled player. They agree on every question the app actually asks — `=== 0`,
 * `formatCents`, JSON — so the difference is normalized here rather than treated as a
 * behaviour change.
 */
function normalizeZero(cents: number): number {
  return cents === 0 ? 0 : cents;
}

function toCentsScenario(s: Scenario) {
  return {
    orders: s.orders.map((o) => ({ playerId: o.playerId, priceCents: toCents(o.price) })),
    buyIns: s.buyIns.map((b) => ({ playerId: b.playerId, amountCents: toCents(b.amount) })),
    cashouts: s.cashouts.map((c) => ({ playerId: c.playerId, amountCents: toCents(c.amount) })),
    payments: s.payments.map((p) => ({
      playerId: p.playerId,
      amountCents: toCents(p.amount),
      direction: p.direction,
    })),
  };
}

describe('computeBalanceCents characterizes the float implementation', () => {
  it.each(scenarios)('agrees to the cent: $name', (s) => {
    const legacy = legacyComputeBalance(P, s.orders, s.buyIns, s.cashouts, s.payments);
    const cents = toCentsScenario(s);
    const ported = computeBalanceCents(P, cents.orders, cents.buyIns, cents.cashouts, cents.payments);
    expect(normalizeZero(ported)).toBe(normalizeZero(toCents(legacy)));
  });

  it('produces +0 where the float version produced -0, and they are still equal', () => {
    const s = scenarios[5];
    const cents = toCentsScenario(s);
    const legacy = toCents(legacyComputeBalance(P, s.orders, s.buyIns, s.cashouts, s.payments));
    const ported = computeBalanceCents(P, cents.orders, cents.buyIns, cents.cashouts, cents.payments);
    expect(Object.is(legacy, -0)).toBe(true);
    expect(Object.is(ported, 0)).toBe(true);
    expect(ported === legacy).toBe(true);
  });

  it('ignores other players, exactly as the float version did', () => {
    const s = scenarios[0];
    const cents = toCentsScenario(s);
    expect(normalizeZero(computeBalanceCents(OTHER, cents.orders, cents.buyIns, cents.cashouts, cents.payments)))
      .toBe(normalizeZero(toCents(legacyComputeBalance(OTHER, s.orders, s.buyIns, s.cashouts, s.payments))));
  });

  it('treats the float epsilon case as exactly settled', () => {
    const s = scenarios[5];
    const cents = toCentsScenario(s);
    const balance = computeBalanceCents(P, cents.orders, cents.buyIns, cents.cashouts, cents.payments);
    // The float version could only say Math.abs(balance) < 0.01 here, because the
    // sum is 4.263256414560601e-15 rather than 0 (bar-api.ts:134-139).
    expect(Math.abs(legacyComputeBalance(P, s.orders, s.buyIns, s.cashouts, s.payments))).toBeGreaterThan(0);
    expect(balance).toBe(0);
    expect(isSettled(balance)).toBe(true);
  });
});

// ── The boundary rule, and the one case where the two implementations genuinely
// disagree. This is not a bug in either: it is why DESIGN.md H5 says the conversion
// is safe for values a human typed as dollars and cents, and must be checked
// separately for any value that was *computed*.

describe('where float and cents diverge — the import boundary rule', () => {
  const computed = 13 / 3; // 4.333333333333333, e.g. a cost split three ways

  it('sum-then-round and round-each-then-sum differ by a cent on computed values', () => {
    const orders = [computed, computed, computed];
    const sumThenRound = toCents(orders.reduce((s, p) => s + p, 0));
    const roundEachThenSum = orders.reduce((s, p) => s + toCents(p), 0);
    expect(sumThenRound).toBe(1300);
    expect(roundEachThenSum).toBe(1299);
    expect(sumThenRound).not.toBe(roundEachThenSum);
  });

  it('the ported implementation follows round-each-then-sum, by construction', () => {
    const cents = [computed, computed, computed].map((price) => ({ playerId: P, priceCents: toCents(price) }));
    expect(computeBalanceCents(P, cents, [], [], [])).toBe(1299);
  });

  it('agrees with the float version whenever every amount is real 2-decimal money', () => {
    const prices = [4.33, 4.33, 4.34];
    const legacy = legacyComputeBalance(P, prices.map((price) => ({ playerId: P, price })), [], [], []);
    const ported = computeBalanceCents(P, prices.map((price) => ({ playerId: P, priceCents: toCents(price) })), [], [], []);
    expect(ported).toBe(toCents(legacy));
    expect(ported).toBe(1300);
  });
});
