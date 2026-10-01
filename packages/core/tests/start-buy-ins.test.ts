import { describe, expect, it } from 'vitest';

import { startBuyIns } from '../src/start-buy-ins';

describe('startBuyIns', () => {
  it('passes every typed buy-in through, in order', () => {
    expect(startBuyIns([{ playerId: 'a', cents: 2000 }, { playerId: 'b', cents: 5050 }])).toEqual({
      kind: 'ready',
      buyIns: [{ playerId: 'a', buyInCents: 2000 }, { playerId: 'b', buyInCents: 5050 }],
    });
  });

  it('keeps a typed 0 as a seat with no buy-in, not a blank', () => {
    expect(startBuyIns([{ playerId: 'a', cents: 0 }])).toEqual({ kind: 'ready', buyIns: [{ playerId: 'a', buyInCents: 0 }] });
  });

  it('blocks on a blank buy-in instead of reading it as $0', () => {
    expect(startBuyIns([{ playerId: 'a', cents: 2000 }, { playerId: 'b', cents: null }])).toEqual({
      kind: 'blank',
      playerIds: ['b'],
    });
  });

  it('names every blank player, in order', () => {
    const drafts = [{ playerId: 'a', cents: null }, { playerId: 'b', cents: 0 }, { playerId: 'c', cents: null }];
    expect(startBuyIns(drafts)).toEqual({ kind: 'blank', playerIds: ['a', 'c'] });
  });

  it('is ready with no buy-ins when nobody is seated (the screen requires a player itself)', () => {
    expect(startBuyIns([])).toEqual({ kind: 'ready', buyIns: [] });
  });
});
