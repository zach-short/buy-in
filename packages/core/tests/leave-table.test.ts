import { describe, expect, it } from 'vitest';

import { computeBalanceCents } from '../src/balance';
import { leaveTableVerdict } from '../src/leave-table';

describe('leaveTableVerdict', () => {
  it('blocks a player who owes the house', () => {
    expect(leaveTableVerdict(1)).toBe('blocked');
    expect(leaveTableVerdict(2500)).toBe('blocked');
  });

  it('warns a player the house owes', () => {
    expect(leaveTableVerdict(-1)).toBe('owed');
    expect(leaveTableVerdict(-4000)).toBe('owed');
  });

  it('lets a settled player go', () => {
    expect(leaveTableVerdict(0)).toBe('clear');
  });

  // The sign is the whole rule, so pin it against the real balance rather than a literal:
  // a $20 buy-in and a $30 cashout leaves the player owed $10, which must warn, not block.
  it('reads the sign computeBalanceCents produces', () => {
    const buyIns = [{ playerId: 'p', amountCents: 2000 }];
    const cashouts = [{ playerId: 'p', amountCents: 3000 }];
    expect(leaveTableVerdict(computeBalanceCents('p', [], buyIns, cashouts, []))).toBe('owed');
    expect(leaveTableVerdict(computeBalanceCents('p', [], buyIns, [], []))).toBe('blocked');
  });
});
