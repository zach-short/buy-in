import { describe, expect, it } from 'vitest';

import { cashoutsChangedSince, refillCashouts } from '../src/cashout-refill';

// Characterization of the close guard as it stood in web/components/session/use-close-session.ts
// (`changedSince`, 951b9e6) before it moved here: every player whose cash-out appeared,
// vanished or changed amount since the snapshot.
describe('cashoutsChangedSince', () => {
  it('finds nothing when the database still matches the snapshot', () => {
    expect(cashoutsChangedSince({ a: 5000, b: 0 }, { a: 5000, b: 0 })).toEqual([]);
    expect(cashoutsChangedSince({}, {})).toEqual([]);
  });

  it('flags a changed amount, a new row and a deleted row', () => {
    expect(cashoutsChangedSince({ a: 5000 }, { a: 4000 })).toEqual(['a']);
    expect(cashoutsChangedSince({}, { a: 0 })).toEqual(['a']);
    expect(cashoutsChangedSince({ a: 0 }, {})).toEqual(['a']);
  });

  it('flags only the players that moved', () => {
    expect(cashoutsChangedSince({ a: 5000, b: 3000 }, { a: 5000, b: 2500, c: 100 }).sort()).toEqual(['b', 'c']);
  });
});

describe('refillCashouts', () => {
  it('on the first open, fills every field from the database — the plain prefill', () => {
    const current = { a: 5000, b: 0 };
    expect(refillCashouts({}, {}, current)).toEqual({ follow: ['a', 'b'], snapshot: { a: 5000, b: 0 } });
  });

  it('keeps an amount the host typed over a prefilled one, and the snapshot it was filled from', () => {
    const refill = refillCashouts({ a: 5000 }, { a: 4500 }, { a: 5000 });
    expect(refill).toEqual({ follow: [], snapshot: { a: 5000 } });
  });

  it('keeps an amount the host typed into a blank field, with no snapshot entry', () => {
    expect(refillCashouts({}, { a: 3000, b: 0 }, {})).toEqual({ follow: [], snapshot: {} });
  });

  it('treats a field the host emptied as typed: blank was their choice over the prefill', () => {
    expect(refillCashouts({ a: 5000 }, { a: null }, { a: 5000 })).toEqual({ follow: [], snapshot: { a: 5000 } });
  });

  it('lets an untouched prefilled field follow a change made between visits', () => {
    expect(refillCashouts({ a: 5000 }, { a: 5000 }, { a: 4000 })).toEqual({ follow: ['a'], snapshot: { a: 4000 } });
  });

  it('lets an untouched blank field take a cash-out written between visits', () => {
    expect(refillCashouts({}, { a: null }, { a: 2000 })).toEqual({ follow: ['a'], snapshot: { a: 2000 } });
  });

  it('empties an untouched field whose cash-out was deleted between visits', () => {
    expect(refillCashouts({ a: 5000 }, { a: 5000 }, {})).toEqual({ follow: ['a'], snapshot: {} });
  });

  it('gives a player seated between visits a blank field that follows the database', () => {
    expect(refillCashouts({ a: 5000 }, { a: 4500 }, { a: 5000, b: 1500 })).toEqual({
      follow: ['b'],
      snapshot: { a: 5000, b: 1500 },
    });
    expect(refillCashouts({ a: 5000 }, { a: 4500 }, { a: 5000 })).toEqual({ follow: [], snapshot: { a: 5000 } });
  });

  it('reads a retyped prefill amount as untouched, since it is the same cents', () => {
    expect(refillCashouts({ a: 5000 }, { a: 5000 }, { a: 5000 })).toEqual({ follow: ['a'], snapshot: { a: 5000 } });
  });

  it('does not change the snapshot it is given', () => {
    const snapshot = { a: 5000 };
    refillCashouts(snapshot, { a: 5000 }, {});
    expect(snapshot).toEqual({ a: 5000 });
  });

  // The whole point of keeping the old snapshot for a typed field: the close guard must still
  // refuse when the database moved under the host's typing, and must not refuse for a field
  // that followed the database.
  describe('with the close guard', () => {
    it('still refuses a close when a typed field was written elsewhere between visits', () => {
      const current = { a: 4000 };
      const { snapshot } = refillCashouts({ a: 5000 }, { a: 4500 }, current);
      expect(cashoutsChangedSince(snapshot, current)).toEqual(['a']);
    });

    it('still refuses when a typed blank field gained a cash-out between visits', () => {
      const current = { a: 2000 };
      const { snapshot } = refillCashouts({}, { a: 3000 }, current);
      expect(cashoutsChangedSince(snapshot, current)).toEqual(['a']);
    });

    it('does not refuse for fields that followed the database', () => {
      const current = { a: 4000, b: 1500 };
      const { snapshot } = refillCashouts({ a: 5000 }, { a: 5000 }, current);
      expect(cashoutsChangedSince(snapshot, current)).toEqual([]);
    });

    it('refuses for exactly the typed fields that moved, in a mixed table', () => {
      const current = { a: 4000, b: 2500, c: 900, d: 700 };
      const typed = { a: 5000, b: 3100, c: 1000 };
      const { snapshot } = refillCashouts({ a: 5000, b: 3000, c: 1000 }, typed, current);
      // a untouched → follows; b typed over 3000, moved to 2500 → refuse; c untouched but typed
      // equal to its fill → follows; d new → follows.
      expect(cashoutsChangedSince(snapshot, current)).toEqual(['b']);
    });
  });
});
