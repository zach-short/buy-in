import { describe, expect, it } from 'vitest';

import { settle, type PlayerBalance } from '../src/settlement';

function netOf(balances: PlayerBalance[]): number {
  return balances.reduce((total, b) => total + b.balanceCents, 0);
}

describe('settle', () => {
  it('returns nothing when everyone is square', () => {
    expect(settle([{ playerId: 'a', balanceCents: 0 }, { playerId: 'b', balanceCents: 0 }])).toEqual([]);
  });

  it('moves one debt to one creditor', () => {
    const transfers = settle([
      { playerId: 'a', balanceCents: 2500 },
      { playerId: 'b', balanceCents: -2500 },
    ]);
    expect(transfers).toEqual([{ fromPlayerId: 'a', toPlayerId: 'b', amountCents: 2500 }]);
  });

  it('splits one debtor across two creditors', () => {
    const transfers = settle([
      { playerId: 'a', balanceCents: 3000 },
      { playerId: 'b', balanceCents: -2000 },
      { playerId: 'c', balanceCents: -1000 },
    ]);
    expect(transfers).toHaveLength(2);
    expect(transfers.every((t) => t.fromPlayerId === 'a')).toBe(true);
    expect(transfers.reduce((s, t) => s + t.amountCents, 0)).toBe(3000);
  });

  it('settles every player exactly, for a five-player night', () => {
    const balances: PlayerBalance[] = [
      { playerId: 'a', balanceCents: 4235 },
      { playerId: 'b', balanceCents: -1200 },
      { playerId: 'c', balanceCents: 875 },
      { playerId: 'd', balanceCents: -3910 },
      { playerId: 'e', balanceCents: 0 },
    ];
    const transfers = settle(balances);
    const applied = new Map(balances.map((b) => [b.playerId, b.balanceCents]));
    for (const t of transfers) {
      applied.set(t.fromPlayerId, (applied.get(t.fromPlayerId) ?? 0) - t.amountCents);
      applied.set(t.toPlayerId, (applied.get(t.toPlayerId) ?? 0) + t.amountCents);
    }
    expect([...applied.values()].every((v) => v === 0)).toBe(true);
  });

  it('never needs more transfers than there are players minus one', () => {
    const balances: PlayerBalance[] = [
      { playerId: 'a', balanceCents: 1000 },
      { playerId: 'b', balanceCents: 2000 },
      { playerId: 'c', balanceCents: -1500 },
      { playerId: 'd', balanceCents: -1500 },
    ];
    expect(settle(balances).length).toBeLessThanOrEqual(balances.length - 1);
  });

  it('does not mutate its input', () => {
    const balances: PlayerBalance[] = [
      { playerId: 'a', balanceCents: 500 },
      { playerId: 'b', balanceCents: -500 },
    ];
    settle(balances);
    expect(netOf(balances)).toBe(0);
    expect(balances[0].balanceCents).toBe(500);
  });

  it('refuses to settle balances that do not net to zero', () => {
    expect(() => settle([
      { playerId: 'a', balanceCents: 100 },
      { playerId: 'b', balanceCents: -50 },
    ])).toThrow(/net to zero/);
  });
});
