import { describe, expect, it } from 'vitest';

import { computeBalanceCents } from '../src/balance';
import { toCents } from '../src/money';
import { describeNet, nightNet, type NightRows } from '../src/night-net';

const P = 'player-1';
const OTHER = 'player-2';

const empty: NightRows = { orders: [], buyIns: [], cashouts: [], payments: [] };

function computeFrom(rows: NightRows): number {
  return computeBalanceCents(P, rows.orders, rows.buyIns, rows.cashouts, rows.payments);
}

describe('nightNet', () => {
  it('includes drinks — the session summary left them out', () => {
    const rows: NightRows = {
      ...empty,
      orders: [{ playerId: P, priceCents: 800 }, { playerId: P, priceCents: 1250 }],
      buyIns: [{ playerId: P, amountCents: 2000 }],
      cashouts: [{ playerId: P, amountCents: 1500 }],
    };
    const net = nightNet(P, rows);
    expect(net.drinksCents).toBe(2050);
    expect(net.netCents).toBe(2050 + 2000 - 1500);
  });

  it('subtracts payments received and adds back payments sent', () => {
    const rows: NightRows = {
      ...empty,
      buyIns: [{ playerId: P, amountCents: 4000 }],
      payments: [
        { playerId: P, amountCents: 3000, direction: 'received' },
        { playerId: P, amountCents: 500, direction: 'sent' },
      ],
    };
    const net = nightNet(P, rows);
    expect(net.paidCents).toBe(2500);
    expect(net.netCents).toBe(1500);
  });

  it('sums every cash-out, not only the first', () => {
    const rows: NightRows = {
      ...empty,
      buyIns: [{ playerId: P, amountCents: 2000 }, { playerId: P, amountCents: 2000 }],
      cashouts: [{ playerId: P, amountCents: 1000 }, { playerId: P, amountCents: 3500 }],
    };
    const net = nightNet(P, rows);
    expect(net.cashoutsCents).toBe(4500);
    expect(net.netCents).toBe(-500);
  });

  it('ignores other players and agrees with computeBalanceCents', () => {
    const rows: NightRows = {
      orders: [{ playerId: P, priceCents: 900 }, { playerId: OTHER, priceCents: 9900 }],
      buyIns: [{ playerId: P, amountCents: 2000 }, { playerId: OTHER, amountCents: 4000 }],
      cashouts: [{ playerId: OTHER, amountCents: 100 }],
      payments: [{ playerId: OTHER, amountCents: 700, direction: 'received' }],
    };
    const net = nightNet(P, rows);
    expect(net).toEqual({ drinksCents: 900, buyInsCents: 2000, cashoutsCents: 0, paidCents: 0, netCents: 2900 });
    expect(net.netCents).toBe(computeFrom(rows));
  });

  it('keeps whole cents exact where float dollars would drift', () => {
    const rows: NightRows = {
      ...empty,
      orders: [0.1, 0.2, 10.1, 20.2].map((d) => ({ playerId: P, priceCents: toCents(d) })),
      payments: [{ playerId: P, amountCents: toCents(30.6), direction: 'received' }],
    };
    expect(nightNet(P, rows).netCents).toBe(0);
  });

  it('is all zeros with no rows', () => {
    expect(nightNet(P, empty)).toEqual({ drinksCents: 0, buyInsCents: 0, cashoutsCents: 0, paidCents: 0, netCents: 0 });
  });
});

describe('describeNet', () => {
  it('positive: the player owes', () => {
    expect(describeNet(1200)).toEqual({ kind: 'owes', amountCents: 1200 });
  });

  it('negative: the player is owed, with no minus sign', () => {
    expect(describeNet(-1200)).toEqual({ kind: 'owed', amountCents: 1200 });
  });

  it('zero and negative zero: even', () => {
    expect(describeNet(0)).toEqual({ kind: 'even', amountCents: 0 });
    const minusZero = describeNet(-0);
    expect(minusZero.kind).toBe('even');
    expect(Object.is(minusZero.amountCents, 0)).toBe(true);
  });

  it('rounds to whole cents before choosing a direction', () => {
    expect(describeNet(0.4)).toEqual({ kind: 'even', amountCents: 0 });
    expect(describeNet(-0.4)).toEqual({ kind: 'even', amountCents: 0 });
    expect(describeNet(1299.6)).toEqual({ kind: 'owes', amountCents: 1300 });
    expect(describeNet(-1299.6)).toEqual({ kind: 'owed', amountCents: 1300 });
  });
});
